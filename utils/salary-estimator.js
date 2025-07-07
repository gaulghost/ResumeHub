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
                console.log(`[ResumeHub] Cache hit for job: ${this._normalizeJobUrl(job.jobUrl)}`);
            } else {
                jobsToFetch.push(job);
                console.log(`[ResumeHub] Cache miss for job: ${this._normalizeJobUrl(job.jobUrl)}`);
            }
        }

        // 2. Use AI batch processing for jobs that weren't in the cache
        if (jobsToFetch.length > 0) {
            console.log(`[ResumeHub] Processing ${jobsToFetch.length} jobs with AI batch estimation`);

            // Gemini can occasionally fail to return valid JSON for large prompts.
            // We therefore process jobs in small chunks and fall back to single calls when needed.
            const CHUNK_SIZE = 5;
            const chunks = [];
            for (let i = 0; i < jobsToFetch.length; i += CHUNK_SIZE) {
                chunks.push(jobsToFetch.slice(i, i + CHUNK_SIZE));
            }

            for (const chunk of chunks) {
                try {
                    let estimates;
                    if (this.isContentScript) {
                        estimates = await this._batchAIEstimateViaMessage(chunk);
                    } else {
                        estimates = await this._batchAIEstimate(chunk);
                    }

                    for (const job of chunk) {
                        const est = estimates[job.jobUrl];
                        if (est && !est.error) {
                            results[job.jobUrl] = { ...est, jobUrl: job.jobUrl, location: job.location };
                            await this._cacheResult(job, est);
                        } else {
                            results[job.jobUrl] = { error: 'No data' };
                        }
                    }

                } catch (chunkError) {
                    console.warn('[ResumeHub] Chunk estimation failed, falling back to per-job calls:', chunkError);

                    // Fallback to per-job estimation inside this chunk
                    for (const job of chunk) {
                        try {
                            let singleEst;
                            if (this.isContentScript) {
                                // Content script must request background
                                singleEst = await this._batchAIEstimateViaMessage([job]);
                                singleEst = singleEst[job.jobUrl];
                            } else {
                                singleEst = await this.estimate(job.jobTitle, job.location, job.companyName, job.jobUrl);
                            }

                            if (singleEst && !singleEst.error) {
                                results[job.jobUrl] = { ...singleEst, jobUrl: job.jobUrl, location: job.location };
                                await this._cacheResult(job, singleEst);
                            } else {
                                results[job.jobUrl] = { error: 'Estimation failed' };
                            }
                        } catch (singleErr) {
                            console.error('[ResumeHub] Single estimation failed:', singleErr);
                            results[job.jobUrl] = { error: 'Estimation failed' };
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
     * @returns {Object} - Salary data or an error object.
     */
    async estimate(jobTitle, location, companyName, jobUrl) {
        return UnifiedErrorHandler.safeAPICall(async () => {
            if (!this.apiClient) {
                console.warn('[ResumeHub BG] API client not available for salary estimation. Using mock data.');
                return this._getMockSalary(jobTitle);
            }
            
            if (this.rateLimiter) {
                await this.rateLimiter.wait();
            }

            const salary = await this.apiClient.estimateSalary(jobTitle, location, companyName);
            return { ...salary, source: 'api' };

        }, `salary estimation for ${jobTitle}`, { fallback: () => this._getMockSalary(jobTitle) });
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
            throw new Error('API client not available');
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

        console.log('[ResumeHub] Sending batch AI request for', jobs.length, 'jobs');
        
        try {
            const response = await this.apiClient.batchEstimateSalary(batchRequest);
            
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

    _getMockSalary(jobTitle) {
        const seniority = /senior|sr|lead/i.test(jobTitle) ? 1.2 : (/junior|jr/i.test(jobTitle) ? 0.8 : 1);
        const baseTC = 2500000; // 25L base in Indian Rupees
        const tcMin = Math.round((baseTC * seniority) / 100000) * 100000; // Round to nearest lakh
        const tcMax = tcMin + 500000; // 5L range
        
        const baseMin = Math.round(tcMin * 0.6 / 100000) * 100000; // 60% of TC
        const baseMax = Math.round(tcMax * 0.6 / 100000) * 100000;
        
        const bonusMin = Math.round(tcMin * 0.15 / 100000) * 100000; // 15% of TC
        const bonusMax = Math.round(tcMax * 0.15 / 100000) * 100000;
        
        const stockMin = Math.round(tcMin * 0.25 / 100000) * 100000; // 25% of TC
        const stockMax = Math.round(tcMax * 0.25 / 100000) * 100000;
        
        return {
            totalCompensation: `${(tcMin/100000).toFixed(0)}L-${(tcMax/100000).toFixed(0)}L`,
            base: `${(baseMin/100000).toFixed(0)}L-${(baseMax/100000).toFixed(0)}L`,
            bonus: `${(bonusMin/100000).toFixed(0)}L-${(bonusMax/100000).toFixed(0)}L`,
            stock: `${(stockMin/100000).toFixed(0)}L-${(stockMax/100000).toFixed(0)}L`,
            confidence: 'Medium',
            currency: '₹',
            source: 'mock'
        };
    }

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
            console.log('[ResumeHub] Old cache format cleared (one-time) for migration to normalized keys');
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
