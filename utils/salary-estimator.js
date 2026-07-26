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
        this.cacheKey = 'salaryCacheV4';
        this.cacheDuration = 24 * 60 * 60 * 1000; // 24 hours
        this.isContentScript = !apiClient && !rateLimiter; // Detect if running in content script
        
        // Clear old cache format (one-time migration)
        this._clearOldCache();
    }

    /**
     * Estimates salaries for a batch of jobs, utilizing a cache first and AI batch processing.
     * Content scripts send the full list to the background in one message.
     * Background processes backend-sized chunks in parallel (not sequential waits).
     * @param {Array<Object>} jobs - An array of job objects.
     * @param {Object} options - Optional options for batch estimation
     * @returns {Object} - A map of jobUrl to salary data.
     */
    async batchEstimate(jobs, options = {}) {
        const ignoreCache = options.ignoreCache || false;
        const results = {};
        const jobsToFetch = [];

        // Parallel cache lookups (avoid serial await per job)
        const cacheChecks = await Promise.all(jobs.map(async (job) => ({
            job,
            cached: ignoreCache ? null : await this._checkCache(job),
        })));

        for (const { job, cached } of cacheChecks) {
            if (cached) {
                results[job.jobUrl] = { ...cached, jobUrl: job.jobUrl, location: job.location };
            } else {
                jobsToFetch.push(job);
            }
        }

        if (jobsToFetch.length === 0) {
            return results;
        }

        // Content script: one round-trip; background owns chunking + parallelism
        if (this.isContentScript) {
            try {
                const estimates = await this._batchAIEstimateViaMessage(jobsToFetch);
                for (const job of jobsToFetch) {
                    const est = estimates?.[job.jobUrl];
                    if (est) {
                        results[job.jobUrl] = { ...est, jobUrl: job.jobUrl };
                    } else {
                        results[job.jobUrl] = { error: 'No data', retry: true };
                    }
                }
            } catch (error) {
                const errorMsg = error.message || '';
                const mapped = this._mapBatchError(errorMsg);
                for (const job of jobsToFetch) {
                    results[job.jobUrl] = { ...mapped };
                }
            }
            return results;
        }

        // Background: backend accepts ≤20 jobs per request. Fire up to 2 batches in parallel
        // so large pages don't wait serially; avoid unbounded parallelism (5xx overload).
        const BACKEND_MAX = 20;
        const PARALLEL_BATCHES = 2;
        const chunks = [];
        for (let i = 0; i < jobsToFetch.length; i += BACKEND_MAX) {
            chunks.push(jobsToFetch.slice(i, i + BACKEND_MAX));
        }

        for (let i = 0; i < chunks.length; i += PARALLEL_BATCHES) {
            const wave = chunks.slice(i, i + PARALLEL_BATCHES);
            const waveMaps = await Promise.all(wave.map((chunk) => this._estimateChunkWithRetry(chunk)));
            for (const chunkMap of waveMaps) {
                Object.assign(results, chunkMap);
            }
        }

        return results;
    }

    /**
     * Map thrown batch errors to badge-friendly payloads.
     */
    _mapBatchError(errorMsg = '') {
        if (errorMsg.includes('API_KEY_MISSING') || errorMsg.includes('No Api Key')) {
            return { error: 'No Api Key', retry: true };
        }
        if (errorMsg.includes('429') || errorMsg.toLowerCase().includes('rate limit')) {
            return { error: 'Rate Limited', retry: true };
        }
        if (
            errorMsg.includes('BACKEND_SERVICE_ERROR')
            || errorMsg.includes('502')
            || errorMsg.includes('500')
            || errorMsg.includes('503')
            || errorMsg.toLowerCase().includes('exhausted')
            || errorMsg.toLowerCase().includes('ai busy')
            || errorMsg.toLowerCase().includes('fetch')
            || errorMsg.toLowerCase().includes('network')
            || errorMsg.toLowerCase().includes('failed to fetch')
        ) {
            if (errorMsg.toLowerCase().includes('exhausted') || errorMsg.toLowerCase().includes('ai busy')) {
                return { error: 'AI busy', retry: true };
            }
            return { error: 'Server Error', retry: true };
        }
        return { error: 'No data', retry: true };
    }

    /**
     * Estimate one chunk with one automatic retry on transient server failures.
     */
    async _estimateChunkWithRetry(chunk, maxAttempts = 2) {
        let lastError = null;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const estimates = await this._batchAIEstimate(chunk);
                const results = {};
                for (const job of chunk) {
                    const est = estimates[job.jobUrl];
                    if (est && !est.error && est.totalCompensation && est.totalCompensation !== 'N/A') {
                        results[job.jobUrl] = { ...est, jobUrl: job.jobUrl, location: job.location };
                        await this._cacheResult(job, est);
                    } else if (est && (est.error === 'API_KEY_MISSING' || est.error === 'No Api Key')) {
                        results[job.jobUrl] = { error: 'No Api Key', retry: true };
                    } else if (est && (est.error === 'Server Error' || String(est.error || '').includes('BACKEND_SERVICE_ERROR'))) {
                        results[job.jobUrl] = { error: 'Server Error', retry: true };
                    } else if (est?.error === 'Estimation failed' || est?.error === 'Rate Limited' || est?.error === 'AI busy') {
                        results[job.jobUrl] = { error: est.error, retry: true };
                    } else if (est?.error && /exhaust/i.test(String(est.error))) {
                        results[job.jobUrl] = { error: 'AI busy', retry: true };
                    } else {
                        results[job.jobUrl] = { error: est?.error || 'No data', retry: true };
                    }
                }

                // Soft-fail batch where every job failed with exhaustion — do not hammer singles.
                const values = Object.values(results);
                const allExhausted = values.length > 0 && values.every((r) =>
                    r.error === 'Estimation failed'
                    || r.error === 'AI busy'
                    || /exhaust/i.test(String(r.error || ''))
                );
                if (allExhausted && estimates.__warning && /exhaust/i.test(estimates.__warning)) {
                    for (const job of chunk) {
                        results[job.jobUrl] = { error: 'AI busy', retry: true };
                    }
                }

                return results;
            } catch (chunkErr) {
                lastError = chunkErr;
                const errorMsg = chunkErr.message || '';
                const transient =
                    errorMsg.includes('BACKEND_SERVICE_ERROR')
                    || errorMsg.includes('502')
                    || errorMsg.includes('500')
                    || errorMsg.includes('503')
                    || errorMsg.includes('429')
                    || errorMsg.includes('Network')
                    || errorMsg.includes('fetch');

                if (transient && attempt < maxAttempts) {
                    console.warn(`[ResumeHub] Batch chunk retry ${attempt}/${maxAttempts}:`, errorMsg);
                    await new Promise((r) => setTimeout(r, 700 * attempt));
                    continue;
                }

                // Non-retryable or exhausted: map error, optionally try singles once
                if (
                    errorMsg.includes('API_KEY_MISSING')
                    || errorMsg.includes('No Api Key')
                    || !this.apiClient
                ) {
                    const results = {};
                    for (const job of chunk) {
                        results[job.jobUrl] = { error: 'No Api Key', retry: true };
                    }
                    return results;
                }

                // Transient batch failure: retry jobs one-by-one (smaller AI prompts recover more often)
                // Skip when the whole backend AI pool is exhausted — singles will fail the same way.
                if (transient && chunk.length > 1 && !/exhaust/i.test(errorMsg)) {
                    console.warn('[ResumeHub] Batch failed; falling back to single-job estimates');
                    return this._estimateJobsIndividually(chunk);
                }

                if (transient || /exhaust/i.test(errorMsg)) {
                    const results = {};
                    const mapped = /exhaust/i.test(errorMsg)
                        ? { error: 'AI busy', retry: true }
                        : { error: 'Server Error', retry: true };
                    for (const job of chunk) {
                        results[job.jobUrl] = { ...mapped };
                    }
                    return results;
                }

                return this._estimateJobsIndividually(chunk);
            }
        }

        const mapped = this._mapBatchError(lastError?.message || '');
        const results = {};
        for (const job of chunk) {
            results[job.jobUrl] = { ...mapped };
        }
        return results;
    }

    /**
     * Estimate jobs with limited concurrency (not fully serial).
     * Used when a multi-job batch returns 5xx — skipped when AI pool is exhausted.
     */
    async _estimateJobsIndividually(jobs) {
        const results = {};
        const CONCURRENCY = 3;
        for (let i = 0; i < jobs.length; i += CONCURRENCY) {
            const slice = jobs.slice(i, i + CONCURRENCY);
            await Promise.all(slice.map(async (job) => {
            try {
                // Prefer a direct 1-job backend batch (bypasses content-script path)
                const singleMap = await this._batchAIEstimate([job]);
                const singleEst = singleMap[job.jobUrl];
                if (singleEst && !singleEst.error && singleEst.totalCompensation && singleEst.totalCompensation !== 'N/A') {
                    results[job.jobUrl] = { ...singleEst, jobUrl: job.jobUrl, location: job.location };
                    await this._cacheResult(job, singleEst);
                    return;
                }
                if (singleEst?.error === 'API_KEY_MISSING' || singleEst?.error === 'No Api Key') {
                    results[job.jobUrl] = { error: 'No Api Key', retry: true };
                } else if (
                    singleEst?.error === 'Server Error'
                    || String(singleEst?.error || '').includes('BACKEND_SERVICE_ERROR')
                ) {
                    results[job.jobUrl] = { error: 'Server Error', retry: true };
                } else if (singleEst?.error && /exhaust/i.test(String(singleEst.error))) {
                    results[job.jobUrl] = { error: 'AI busy', retry: true };
                } else if (singleEst?.error) {
                    results[job.jobUrl] = { error: singleEst.error, retry: true };
                } else {
                    results[job.jobUrl] = { error: 'No data', retry: true };
                }
            } catch (err) {
                results[job.jobUrl] = this._mapBatchError(err.message || '');
            }
            }));
            // If this wave is fully exhausted, stop — further singles won't help.
            const waveFailed = slice.every((j) => {
                const r = results[j.jobUrl];
                return r && (r.error === 'AI busy' || r.error === 'Estimation failed' || /exhaust/i.test(String(r.error || '')));
            });
            if (waveFailed) {
                for (const job of jobs.slice(i + CONCURRENCY)) {
                    results[job.jobUrl] = { error: 'AI busy', retry: true };
                }
                break;
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
        try {
            const job = { jobTitle, location, companyName, jobUrl };

            // Content scripts have no API client — route through background messaging
            if (this.isContentScript) {
                const cached = await this._checkCache(job);
                if (cached) {
                    return { ...cached, jobUrl, location };
                }

                if (jobDescription) {
                    return await this._estimateWithJDViaMessage(jobTitle, location, companyName, jobUrl, jobDescription);
                }

                const results = await this._batchAIEstimateViaMessage([job]);
                return results[jobUrl] || { error: 'No data', retry: true };
            }

            if (!this.apiClient) {
                console.warn('[ResumeHub BG] API client not available for salary estimation – API key missing.');
                return { error: 'API_KEY_MISSING', retry: true };
            }
            
            let salary;
            if (this.rateLimiter) {
                salary = await this.rateLimiter.queueRequest(
                    () => this.apiClient.estimateSalary(jobTitle, location, companyName, jobUrl, jobDescription),
                    `salary estimation for ${jobTitle}`
                );
            } else {
                salary = await this.apiClient.estimateSalary(jobTitle, location, companyName, jobUrl, jobDescription);
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
        } catch (error) {
            if (error.message === 'API_KEY_MISSING') {
                return { error: 'API_KEY_MISSING', retry: true };
            }
            // Log clean error message
            const cleanMessage = UnifiedErrorHandler.createCleanErrorMessage(error);
            console.error(cleanMessage);
            
            // Create user-friendly error
            const userFriendlyError = UnifiedErrorHandler.getUserFriendlyError(error, { operation: `salary estimation for ${jobTitle}` });
            
            // Throw structured error
            throw UnifiedErrorHandler.createError(userFriendlyError.message, 'API_ERROR', { 
                operation: `salary estimation for ${jobTitle}`,
                errorType: userFriendlyError.errorType,
                originalError: error.message
            });
        }
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
     * Single-job salary estimate with JD via background (content-script safe).
     */
    async _estimateWithJDViaMessage(jobTitle, location, companyName, jobUrl, jobDescription) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                action: 'estimateSalaryWithJD',
                data: { jobTitle, companyName, location, jobUrl, jobDescription }
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error('Background script communication failed'));
                    return;
                }
                if (response?.success && response.salary && !response.salary.error) {
                    resolve(response.salary);
                } else if (response?.salary?.error) {
                    resolve({ error: response.salary.error, retry: true });
                } else {
                    resolve({ error: response?.error || 'No data', retry: true });
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
            // Backend salary calls must NOT go through the Gemini rate limiter —
            // that limiter is for local Gemini RPM and was causing backend batches
            // to queue/contend incorrectly. Local Gemini fallback inside api-client
            // has its own slot tracking.
            const response = await this.apiClient.batchEstimateSalary(batchRequest);
            
            // Transform AI response to our format
            const results = {};
            if (response.warning) {
                results.__warning = String(response.warning);
            }
            const exhaustedPool = /exhaust/i.test(String(response.warning || ''));
            for (const jobResult of response.results || []) {
                if (jobResult.error) {
                    const err = exhaustedPool && jobResult.error === 'Estimation failed'
                        ? 'AI busy'
                        : jobResult.error;
                    results[jobResult.jobUrl] = { error: err };
                } else {
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
     * Parses a range string like "25L-30L", "₹32L-₹48L", "$120k-$150k" into numeric min/max.
     * Strips currency symbols and whitespace before matching.
     */
    _parseRange(rangeStr) {
        if (!rangeStr) return null;
        // Strip currency symbols (₹, $, €, £, ¥), commas, and spaces before parsing
        const cleaned = rangeStr.replace(/[₹$€£¥,\s]/g, '');
        const match = cleaned.match(/([\d\.]+)([kKlL]?)-([\d\.]+)([kKlL]?)/);
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
