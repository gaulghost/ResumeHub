import { UnifiedErrorHandler } from './unified-error-handler.js';
import { StorageManager } from './storage-manager.js';

/**
 * Handles salary estimation logic, including batch processing, caching, and API communication.
 * This class is intended for use in the background script.
 */
export class SalaryEstimator {
    constructor(apiClient = null, rateLimiter = null) {
        this.apiClient = apiClient;
        this.rateLimiter = rateLimiter;
        this.sessionCache = new Map(); // Simple in-memory cache for the session
        this.cacheKey = 'salaryCacheV3';
        this.cacheDuration = 24 * 60 * 60 * 1000; // 24 hours
        this.isContentScript = !apiClient && !rateLimiter; // Detect if running in content script
        
        // Clear old cache format (one-time migration)
        this._clearOldCache();
    }

    /**
     * Estimates salaries for a batch of jobs, utilizing a cache first and AI batch processing.
     * @param {Array<Object>} jobs - An array of job objects.
     * @param {Object} options - Optional options for batch estimation
     * @returns {Object} - A map of jobUrl to salary data.
     */
    async batchEstimate(jobs, options = {}) {
        const ignoreCache = options.ignoreCache || false;
        const results = {};
        const jobsToFetch = [];

        // 1. Check persistent and session cache for each job
        for (const job of jobs) {
            const cached = ignoreCache ? null : await this._checkCache(job);
            if (cached) {
                results[job.jobUrl] = { ...cached, jobUrl: job.jobUrl, location: job.location };
            } else {
                jobsToFetch.push(job);
            }
        }

        // 2. Use AI batch processing (chunked) for jobs that weren't in the cache
        if (jobsToFetch.length > 0) {
            const CHUNK_SIZE = 5;
            const chunks = [];
            for (let i = 0; i < jobsToFetch.length; i += CHUNK_SIZE) {
                chunks.push(jobsToFetch.slice(i, i + CHUNK_SIZE));
            }

            for (const chunk of chunks) {
                try {
                    let estimates;
                    if (this.isContentScript) {
                        // Content script must ask background to estimate
                        estimates = await this._batchAIEstimateViaMessage(chunk);
                    } else {
                        // Background can call API directly in batch
                        estimates = await this._batchAIEstimate(chunk);
                    }

                    for (const job of chunk) {
                        const est = estimates[job.jobUrl];
                        if (est && !est.error) {
                            results[job.jobUrl] = { ...est, jobUrl: job.jobUrl, location: job.location };
                            await this._cacheResult(job, est);
                        } else if (est && (est.error === 'API_KEY_MISSING' || est.error === 'No Api Key')) {
                            results[job.jobUrl] = { error: 'No Api Key', retry: true };
                        } else {
                            results[job.jobUrl] = { error: 'No data' };
                        }
                    }
                } catch (chunkErr) {
                    // If the error is due to missing API key, mark entire chunk accordingly
                    if (chunkErr.message === 'API_KEY_MISSING' || chunkErr.message === 'No Api Key' || !this.apiClient) {
                        for (const job of chunk) {
                            results[job.jobUrl] = { error: 'No Api Key', retry: true };
                        }
                        continue;
                    }

                    // Fallback: estimate each job individually
                    for (const job of chunk) {
                        try {
                            let singleEst;
                            if (this.isContentScript) {
                                singleEst = await this._batchAIEstimateViaMessage([job]);
                                singleEst = singleEst[job.jobUrl];
                            } else {
                                singleEst = await this.estimate(job.jobTitle, job.location, job.companyName, job.jobUrl);
                            }

                            if (singleEst && !singleEst.error) {
                                results[job.jobUrl] = { ...singleEst, jobUrl: job.jobUrl, location: job.location };
                                await this._cacheResult(job, singleEst);
                            } else if (singleEst && (singleEst.error === 'API_KEY_MISSING' || singleEst.error === 'No Api Key')) {
                                results[job.jobUrl] = { error: 'No Api Key', retry: true };
                            } else {
                                results[job.jobUrl] = { error: 'No data' };
                            }
                        } catch (singleErr) {
                            if (singleErr.message === 'API_KEY_MISSING' || singleErr.message === 'No Api Key' || !this.apiClient) {
                                results[job.jobUrl] = { error: 'No Api Key', retry: true };
                            } else {
                                results[job.jobUrl] = { error: 'No data' };
                            }
                        }
                    }
                }
            }
        }
        
        return results;
    }

    /**
     * Estimates salary for a single job.
     * @param {string} jobTitle
     * @param {string} location
     * @param {string} companyName
     * @param {string} jobUrl - Used as a unique key for caching.
     * @param {string} [jobDescription] - Optional full job description
     * @returns {Object} - Salary data or an error object.
     */
    async estimate(jobTitle, location, companyName, jobUrl, jobDescription = '') {
        return UnifiedErrorHandler.safeAPICall(async () => {
            if (!this.apiClient) {
                console.warn('[ResumeHub BG] API client not available for salary estimation – API key missing.');
                return { error: 'API_KEY_MISSING', retry: true };
            }
            
            let salary;
            if (this.rateLimiter) {
                salary = await this.rateLimiter.queueRequest(
                    () => this.apiClient.estimateSalary(jobTitle, location, companyName, jobDescription),
                    `salary estimation for ${jobTitle}`
                );
            } else {
                salary = await this.apiClient.estimateSalary(jobTitle, location, companyName, jobDescription);
            }
            
            // Map API response fields to UI expected format
            return {
                totalCompensation: salary.totalCompensation,
                base: salary.baseSalary,
                bonus: salary.bonus,
                stock: salary.stockOptions,
                confidence: salary.confidence,
                currency: salary.currency,
                source: 'api',
                debug: salary.debug // Pass debug info
            };

        }, `salary estimation for ${jobTitle}`, { fallback: () => ({ error: 'API_KEY_MISSING', retry: true }) });
    }

    /**
     * Performs batch AI estimation via message passing to background script.
     * @param {Array<Object>} jobs - Array of job objects with jobTitle, companyName, location, jobUrl
     * @returns {Object} - Map of jobUrl to salary data
     */
    async _batchAIEstimateViaMessage(jobs) {
        return new Promise((resolve, reject) => {
            const message = {
                action: 'batchSalaryEstimation',
                data: { jobs: jobs }
            };
            
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('[ResumeHub] Message passing error:', chrome.runtime.lastError);
                    reject(new Error('Background script communication failed'));
                    return;
                }
                
                if (response && response.success) {
                    resolve(response.data);
                } else {
                    console.error('[ResumeHub] Background script error:', response?.error);
                    reject(new Error(response?.error || 'Unknown error'));
                }
            });
        });
    }

    /**
     * Performs batch AI estimation for multiple jobs in a single request.
     * @param {Array<Object>} jobs - Array of job objects with jobTitle, companyName, location, jobUrl
     * @returns {Object} - Map of jobUrl to salary data
     */
    async _batchAIEstimate(jobs) {
        if (!this.apiClient) {
            console.warn('[ResumeHub] API client not available for batch AI estimation');
            // Intentionally throw so caller can map to "No Api Key"
            throw new Error('API_KEY_MISSING');
        }

        // Rate limiting is handled by the queueRequest method in the API client

        // Prepare batch request data
        const batchRequest = {
            jobs: jobs.map(job => ({
                position: job.jobTitle,
                company: job.companyName,
                location: job.location,
                jobUrl: job.jobUrl
            })),
            format: 'detailed_compensation'
        };

        try {
            let response;
            if (this.rateLimiter) {
                response = await this.rateLimiter.queueRequest(
                    () => this.apiClient.batchEstimateSalary(batchRequest),
                    'batch salary estimation'
                );
            } else {
                response = await this.apiClient.batchEstimateSalary(batchRequest);
            }
            
            // Transform AI response to our format
            const results = {};
            for (const jobResult of response.results || []) {
                results[jobResult.jobUrl] = {
                    totalCompensation: jobResult.totalCompensation,
                    base: jobResult.baseSalary,
                    bonus: jobResult.bonus,
                    stock: jobResult.stockOptions,
                    confidence: jobResult.confidence,
                    currency: jobResult.currency || '₹',
                    source: 'ai'
                };
            }
            
            return results;
        } catch (error) {
            console.error('[ResumeHub] Batch AI estimation failed:', error);
            throw error;
        }
    }

    _getMockSalary() { return { error: 'API_KEY_MISSING', retry: true }; }

    async _checkCache(job) {
        const key = this._makeCompositeKey(job.companyName, job.location, job.jobTitle);

        // First check session cache
        if (this.sessionCache.has(key)) return this.sessionCache.get(key);

        try {
            const stored = await StorageManager.get([this.cacheKey]);
            const cacheData = stored[this.cacheKey] || {};
            const record = cacheData[key];

            if (!record) return null;

            // Expiry check (7 days)
            const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
            if (Date.now() - record.lastUpdated > SEVEN_DAYS) return null;

            // Convert numeric record back to strings expected by UI
            const salaryData = {
                totalCompensation: this._formatRange(record.tc.min, record.tc.max, record.unit),
                base: this._formatRange(record.base.min, record.base.max, record.unit),
                bonus: this._formatRange(record.bonus.min, record.bonus.max, record.unit),
                stock: this._formatRange(record.stock.min, record.stock.max, record.unit),
                confidence: record.confidence || 'Medium',
                currency: record.currency || '₹',
                source: 'cache'
            };

            this.sessionCache.set(key, salaryData);
            return salaryData;
        } catch (err) {
            console.warn('[ResumeHub BG] Failed to read cache:', err.message);
            return null;
        }
    }
    
    async _cacheResult(job, data) {
        if (!data || data.error) return;

        const key = this._makeCompositeKey(job.companyName, job.location, job.jobTitle);

        // Parse ranges into numeric
        const tcRange = this._parseRange(data.totalCompensation);
        const baseRange = this._parseRange(data.base);
        const bonusRange = this._parseRange(data.bonus);
        const stockRange = this._parseRange(data.stock);
        if (!tcRange || !baseRange || !bonusRange || !stockRange) return;

        try {
            const stored = await StorageManager.get([this.cacheKey]);
            const cacheData = stored[this.cacheKey] || {};

            if (!cacheData[key]) {
                cacheData[key] = {
                    tc: { min: tcRange.min, max: tcRange.max },
                    base: { min: baseRange.min, max: baseRange.max },
                    bonus: { min: bonusRange.min, max: bonusRange.max },
                    stock: { min: stockRange.min, max: stockRange.max },
                    unit: tcRange.unit || 'L',
                    currency: data.currency || '₹',
                    confidence: data.confidence || 'Medium',
                    samples: 1,
                    lastUpdated: Date.now()
                };
            } else {
                const rec = cacheData[key];
                const s = rec.samples || 1;
                rec.tc = this._mergeRange(rec.tc, tcRange, s);
                rec.base = this._mergeRange(rec.base, baseRange, s);
                rec.bonus = this._mergeRange(rec.bonus, bonusRange, s);
                rec.stock = this._mergeRange(rec.stock, stockRange, s);
                rec.samples = s + 1;
                rec.lastUpdated = Date.now();
            }

            // Write back
            await StorageManager.set({ [this.cacheKey]: cacheData });

            // Update session cache with formatted string
            const formatted = {
                totalCompensation: data.totalCompensation,
                base: data.base,
                bonus: data.bonus,
                stock: data.stock,
                confidence: data.confidence,
                currency: data.currency,
                source: 'cache'
            };
            this.sessionCache.set(key, formatted);
        } catch (err) {
            console.warn('[ResumeHub BG] Failed to write cache:', err.message);
        }
    }

    /**
     * Normalizes job URL to extract job ID for consistent caching
     * @param {string} jobUrl - Full LinkedIn job URL with tracking parameters
     * @returns {string} - Normalized job ID for caching
     */
    _normalizeJobUrl(jobUrl) {
        try {
            // Extract job ID from LinkedIn URL
            // Examples:
            // https://www.linkedin.com/jobs/view/4233549531/?trk=flagship3_search_srp_jobs
            // https://www.linkedin.com/jobs/view/4233549531/?eBP=CwEAAAGX4E9xUI81JkA...
            const match = jobUrl.match(/\/jobs\/view\/(\d+)/);
            if (match) {
                return `linkedin_job_${match[1]}`;
            }
            
            // Fallback to original URL if pattern doesn't match
            console.warn('[ResumeHub] Could not extract job ID from URL:', jobUrl);
            return jobUrl;
        } catch (error) {
            console.warn('[ResumeHub] Error normalizing job URL:', error);
            return jobUrl;
        }
    }

    /**
     * Clears old cache format (one-time migration)
     * This ensures we start fresh with the new normalized cache keys
     */
    async _clearOldCache() {
        try {
            const migrationKey = 'salaryCacheMigratedV2';
            const migrationFlag = await StorageManager.get([migrationKey]);
            if (migrationFlag && migrationFlag[migrationKey]) {
                // Already migrated
                return;
            }

            // Clear session cache
            this.sessionCache.clear();
            
            // Clear persistent cache
            await StorageManager.set({ [this.cacheKey]: {}, [migrationKey]: true });
        } catch (error) {
            console.warn('[ResumeHub] Failed to clear old cache (non-critical):', error.message);
        }
    }

    /**
     * Returns cached estimate if available (session or persistent) without making API calls.
     * @param {string} jobUrl
     * @returns {Object|null}
     */
    async getCachedEstimate(jobData) {
        return await this._checkCache(jobData);
    }

    /**
     * Generates a composite cache key using company, location and position
     */
    _makeCompositeKey(company, location, position) {
        return `${company.trim().toLowerCase()}|${location.trim().toLowerCase()}|${position.trim().toLowerCase()}`;
    }

    /**
     * Parses a range string like "25L-30L" or "120k-150k" into numeric min/max rupees
     */
    _parseRange(rangeStr) {
        if (!rangeStr) return null;
        const match = rangeStr.replace(/[,\s]/g, '').match(/([\d\.]+)([kKlL]?)-([\d\.]+)([kKlL]?)/);
        if (!match) return null;
        const unit = match[2] || match[4] || '';
        const multiplier = unit.toLowerCase() === 'k' ? 1000 : (unit.toLowerCase() === 'l' ? 100000 : 1);
        const min = Math.round(parseFloat(match[1]) * multiplier);
        const max = Math.round(parseFloat(match[3]) * multiplier);
        return { min, max, unit: unit || '' };
    }

    _formatRange(min, max, unit) {
        const multiplier = unit.toLowerCase() === 'k' ? 1000 : (unit.toLowerCase() === 'l' ? 100000 : 1);
        const toUnitVal = (val) => {
            if (multiplier === 1) return val.toString();
            return (val / multiplier).toFixed(0);
        };
        return `${toUnitVal(min)}${unit}-${toUnitVal(max)}${unit}`;
    }

    _mergeRange(existingRange, newRange, samples) {
        const min = Math.round((existingRange.min * samples + newRange.min) / (samples + 1));
        const max = Math.round((existingRange.max * samples + newRange.max) / (samples + 1));
        return { min, max, unit: existingRange.unit || newRange.unit };
    }
}
