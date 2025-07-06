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
        this.cacheKey = 'salaryCache';
        this.cacheDuration = 24 * 60 * 60 * 1000; // 24 hours
        this.isContentScript = !apiClient && !rateLimiter; // Detect if running in content script
        
        // Clear old cache format (one-time migration)
        this._clearOldCache();
    }

    /**
     * Estimates salaries for a batch of jobs, utilizing a cache first and AI batch processing.
     * @param {Array<Object>} jobs - An array of job objects.
     * @returns {Object} - A map of jobUrl to salary data.
     */
    async batchEstimate(jobs) {
        const results = {};
        const jobsToFetch = [];

        // 1. Check persistent and session cache for each job
        for (const job of jobs) {
            const cached = await this._checkCache(job.jobUrl);
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
            
            try {
                let batchEstimates;
                
                if (this.isContentScript) {
                    // Use message passing to communicate with background script
                    batchEstimates = await this._batchAIEstimateViaMessage(jobsToFetch);
                } else {
                    // Direct API call from background script
                    batchEstimates = await this._batchAIEstimate(jobsToFetch);
                }
                
                // 3. Process and cache the new estimates
                for (const job of jobsToFetch) {
                    const estimate = batchEstimates[job.jobUrl] || this._getMockSalary(job.jobTitle);
                    results[job.jobUrl] = { ...estimate, jobUrl: job.jobUrl, location: job.location };
                    
                    // Cache valid results
                    if (!estimate.error && estimate.source !== 'mock') {
                        await this._cacheResult(job.jobUrl, estimate);
                    }
                }
            } catch (error) {
                console.error('[ResumeHub] Batch AI estimation failed, falling back to mock data:', error);
                
                // Fallback to mock data for all jobs
                for (const job of jobsToFetch) {
                    const mockEstimate = this._getMockSalary(job.jobTitle);
                    results[job.jobUrl] = { ...mockEstimate, jobUrl: job.jobUrl, location: job.location };
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

    async _checkCache(jobUrl) {
        // Normalize job URL to extract job ID for consistent caching
        const normalizedKey = this._normalizeJobUrl(jobUrl);
        
        // Check session cache first for speed
        if (this.sessionCache.has(normalizedKey)) {
            return this.sessionCache.get(normalizedKey);
        }

        // Check persistent storage
        try {
            const cacheData = await StorageManager.get(this.cacheKey) || {};
            const cachedItem = cacheData[normalizedKey];
            if (cachedItem && (Date.now() - cachedItem.timestamp < this.cacheDuration)) {
                this.sessionCache.set(normalizedKey, cachedItem.data); // Hydrate session cache
                return cachedItem.data;
            }
        } catch (error) {
            console.warn('[ResumeHub BG] Failed to read from persistent salary cache (non-critical):', error.message);
        }
        return null;
    }
    
    async _cacheResult(jobUrl, data) {
        // Normalize job URL to extract job ID for consistent caching
        const normalizedKey = this._normalizeJobUrl(jobUrl);
        
        this.sessionCache.set(normalizedKey, data);
        
        try {
            const cacheData = await StorageManager.get(this.cacheKey) || {};
            cacheData[normalizedKey] = {
                data: data,
                timestamp: Date.now()
            };
            await StorageManager.set(this.cacheKey, cacheData);
        } catch (error) {
            // Only log as warning since this is not critical for functionality
            console.warn('[ResumeHub BG] Failed to write to persistent salary cache (non-critical):', error.message);
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
            // Clear session cache
            this.sessionCache.clear();
            
            // Clear persistent cache
            await StorageManager.set(this.cacheKey, {});
            console.log('[ResumeHub] Old cache format cleared for migration to normalized keys');
        } catch (error) {
            console.warn('[ResumeHub] Failed to clear old cache (non-critical):', error.message);
        }
    }
}
