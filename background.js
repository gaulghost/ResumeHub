// ResumeHub background service worker - Refactored with utility modules

// --- Imports ---
import { StorageManager } from './utils/storage-manager.js';
import { GeminiAPIClient } from './utils/api-client.js';
import { SalaryEstimator } from './utils/salary-estimator.js';
import { UnifiedErrorHandler } from './utils/unified-error-handler.js';
import { SimpleRateLimiter } from './utils/simple-rate-limiter.js';
import { ScriptInjector } from './utils/script-injector.js';
import { ParallelProcessor } from './utils/parallel-processor.js';
import { ResumeCacheOptimizer } from './utils/resume-cache-optimizer.js';

console.log('[ResumeHub BG] Service worker started, modules loaded.');

// --- Global State ---
let apiClient;
let salaryEstimator;
let rateLimiter;
let inFlightJobs = new Set();
// Cache for job descriptions and resume parsing to avoid redundant calls
let jdCache = new Map(); // tabId -> { jd, timestamp }
let resumeParseCache = new Map(); // resumeHash -> { resumeJSON, timestamp }
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// --- Initialization ---
async function initialize() {
    try {
        await StorageManager.initialize();
        rateLimiter = new SimpleRateLimiter(5, 10000); // 5 requests per 10 seconds
        console.log('[ResumeHub BG] Rate limiter initialized.');

        const apiKey = await StorageManager.getAPIToken();
        if (apiKey) {
            console.log('[ResumeHub BG] API token found. Initializing API client.');
            apiClient = new GeminiAPIClient(apiKey);
            salaryEstimator = new SalaryEstimator(apiClient, rateLimiter);
            console.log('[ResumeHub BG] API Client and Salary Estimator initialized.');
        } else {
            console.warn('[ResumeHub BG] API key not found. Salary estimator will not be initialized.');
            // Don't initialize salaryEstimator so the early exit condition works
            apiClient = null;
            salaryEstimator = null;
        }
    } catch (error) {
        console.error('[ResumeHub BG] Initialization failed:', error);
    }
}

// --- Helpers for Autopilot ---

async function executeInTab(tabId, func, args = []) {
    return new Promise((resolve, reject) => {
        try {
            chrome.scripting.executeScript({ target: { tabId }, func, args }, (results) => {
                if (chrome.runtime.lastError) {
                    return reject(new Error(`Script exec failed: ${chrome.runtime.lastError.message}`));
                }
                if (results && results[0] && results[0].result !== undefined) {
                    resolve(results[0].result);
                } else {
                    resolve(null);
                }
            });
        } catch (e) {
            reject(e);
        }
    });
}

async function extractJDFromTab(tabId, preferAI = true, useCache = true) {
    try {
        // Check cache first
        if (useCache && jdCache.has(tabId)) {
            const cached = jdCache.get(tabId);
            if (Date.now() - cached.timestamp < CACHE_TTL) {
                console.log('[ResumeHub BG] Using cached JD for tab', tabId);
                return cached.jd;
            } else {
                jdCache.delete(tabId);
            }
        }

        let jd = null;
        
        if (preferAI && apiClient) {
            const pageText = await executeInTab(tabId, () => {
                const t = document.body?.innerText || document.documentElement?.innerText || '';
                return t.length > 50000 ? t.substring(0, 50000) : t;
            });
            if (pageText && pageText.length > 100) {
                jd = await apiClient.extractJobDescription(pageText);
                if (jd && jd.length > 50) {
                    // Cache the result
                    jdCache.set(tabId, { jd, timestamp: Date.now() });
                    return jd;
                }
            }
        }
        
        // Fallback to standard DOM extraction in target tab
        const jdStd = await executeInTab(tabId, () => {
            const selectors = [
                '#job-description', '.job-description',
                '[class*="job-details"]', '[class*="jobDescription"]', '[class*="jobdesc"]',
                '[aria-label*="description"]', '[data-testid*="description"]',
                '.jobsearch-JobComponent-description',
                '.jobs-description-content__text',
                '#job_details',
                '.jobdesciptioncontent', '.jobDescriptionContent',
                'section[data-qa="job-description"]',
                '.job-details-content',
                '.ats-description-wrapper',
                '.content .description', 'article .job-body'
            ];
            for (const selector of selectors) {
                try {
                    const el = document.querySelector(selector);
                    if (el && el.innerText && el.innerText.trim().length > 100) return el.innerText;
                } catch {}
            }
            const main = document.querySelector('main');
            if (main && main.innerText?.trim()?.length > 100) return main.innerText;
            const bodyText = document.body?.innerText || '';
            return bodyText && bodyText.length > 100 ? bodyText.substring(0, 50000) : null;
        });
        
        // Cache standard extraction result too
        if (jdStd) {
            jdCache.set(tabId, { jd: jdStd, timestamp: Date.now() });
        }
        
        return jdStd;
    } catch (e) {
        console.warn('[ResumeHub BG] extractJDFromTab failed:', e.message);
        return null;
    }
}

async function upsertRecentJobEntry(entry) {
    try {
        const data = await StorageManager.get(['recentJobsV1']);
        const arr = Array.isArray(data.recentJobsV1) ? data.recentJobsV1 : [];
        const idx = arr.findIndex(x => x.jobUrl === entry.jobUrl);
        if (idx >= 0) {
            arr.splice(idx, 1);
        }
        arr.unshift({ ...entry, timestamp: Date.now() });
        if (arr.length > 25) arr.length = 25;
        await StorageManager.set({ recentJobsV1: arr });
        // Notify any listeners (optional)
        chrome.runtime.sendMessage({ action: 'recentJobsUpdated', data: { count: arr.length } }, () => {});
    } catch (e) {
        console.warn('[ResumeHub BG] Failed to upsert recent job:', e.message);
    }
}

async function handleJobChanged(request, sender, sendResponse) {
    let jobKey;
    try {
        const { data } = request || {};
        const tabId = sender?.tab?.id;
        const jobTitle = data?.jobTitle || '';
        const companyName = data?.companyName || '';
        const location = data?.location || '';
        const jobUrl = data?.jobUrl || '';

        const settings = await StorageManager.get(['aiModeEnabled', 'aiFilters'], 'sync');
        const aiEnabled = !!settings.aiModeEnabled;
        const aiFilters = {
            autoTailorOnView: false,
            autoFetchSalary: true,
            requireSalary: false,
            salaryThreshold: null,
            minJDLength: 200,
            ...(settings.aiFilters || {})
        };
        
        // Remove old requireResume if present
        if (aiFilters.requireResume !== undefined) {
            delete aiFilters.requireResume;
        }

        if (!aiEnabled || !aiFilters.autoTailorOnView) {
            return sendResponse?.({ queued: false, reason: 'AI disabled or autoTailor off' });
        }
        if (!tabId) {
            return sendResponse?.({ queued: false, reason: 'No tabId' });
        }
        jobKey = `${jobUrl}|${jobTitle}|${companyName}`;
        if (inFlightJobs.has(jobKey)) {
            return sendResponse?.({ queued: false, reason: 'Already processing' });
        }
        inFlightJobs.add(jobKey);

        // Always check for resume - auto tailor requires resume
        const resume = await StorageManager.getResume();
        if (!resume?.content) {
            inFlightJobs.delete(jobKey);
            return sendResponse?.({ queued: false, reason: 'No resume' });
        }

        // Extract JD (with caching to avoid redundant calls)
        const jd = await extractJDFromTab(tabId, true, true);
        if (!jd || jd.length < (aiFilters.minJDLength || 200)) {
            inFlightJobs.delete(jobKey);
            return sendResponse?.({ queued: false, reason: 'JD too short' });
        }

        // Fetch salary if enabled (using existing SalaryEstimator)
        let salary = null;
        let salaryValue = null;
        if (aiFilters.autoFetchSalary && salaryEstimator) {
            try {
                salary = await salaryEstimator.estimate(jobTitle, location, companyName, jobUrl);
                // Extract numeric salary value for threshold comparison
                // Salary format: { totalCompensation: "₹10-15L", base: "...", bonus: "...", stock: "..." }
                if (salary && !salary.error && salary.totalCompensation) {
                    // Parse salary string like "₹10-15L", "$100k-150k", "₹50-70L", etc.
                    const salaryStr = salary.totalCompensation;
                    // Extract numbers and unit
                    const match = salaryStr.match(/([\d,]+)[\s-]*([\d,]+)?([LKMkm]|thousand|million)?/i);
                    if (match) {
                        let min = parseFloat(match[1].replace(/,/g, ''));
                        let max = match[2] ? parseFloat(match[2].replace(/,/g, '')) : min;
                        const unit = (match[3] || '').toLowerCase();
                        
                        // Convert to base units (same currency as threshold)
                        // Threshold is stored in base units (e.g., 2600000 for 26L in INR)
                        // Keep salary in same currency units for comparison
                        if (unit === 'l' || unit === 'lakh') {
                            salaryValue = max * 100000; // Convert Lakhs to base units (INR)
                        } else if (unit === 'k' || unit === 'thousand') {
                            salaryValue = max * 1000;
                        } else if (unit === 'm' || unit === 'million') {
                            salaryValue = max * 1000000;
                        } else if (unit.includes('cr') || unit.includes('crore')) {
                            salaryValue = max * 10000000; // Convert crores to base units
                        } else {
                            // Assume already in base units
                            salaryValue = max;
                        }
                    } else {
                        // Try direct number extraction
                        const numMatch = salaryStr.match(/[\d,]+/);
                        if (numMatch) {
                            salaryValue = parseFloat(numMatch[0].replace(/,/g, ''));
                        }
                    }
                }
            } catch (e) {
                salary = { error: e.message };
            }
        }
        
        // Check salary threshold if required
        if (aiFilters.requireSalary && aiFilters.salaryThreshold) {
            if (!salary || salary.error || !salaryValue) {
                inFlightJobs.delete(jobKey);
                return sendResponse?.({ queued: false, reason: 'Salary missing or invalid' });
            }
            // Compare in same currency units (both in base units, same currency)
            // Threshold is stored in base units (e.g., 2600000 for 26L)
            // Salary value is also in base units (same currency)
            if (salaryValue < aiFilters.salaryThreshold) {
                inFlightJobs.delete(jobKey);
                return sendResponse?.({ queued: false, reason: `Salary ${salaryValue} below threshold ${aiFilters.salaryThreshold}` });
            }
        }

        // Tailor resume
        if (!apiClient) {
            inFlightJobs.delete(jobKey);
            return sendResponse?.({ queued: false, reason: 'API key missing' });
        }

        // Get resume data and parse (with caching)
        const resumeData = await StorageManager.getResume();
        if (!resumeData?.content) {
            inFlightJobs.delete(jobKey);
            return sendResponse?.({ queued: false, reason: 'No resume data' });
        }

        // Check resume parse cache
        const { generateResumeHash } = await import('./utils/shared-utilities.js');
        const resumeHash = generateResumeHash(resumeData);
        let originalResumeJSON = null;
        
        if (resumeParseCache.has(resumeHash)) {
            const cached = resumeParseCache.get(resumeHash);
            if (Date.now() - cached.timestamp < CACHE_TTL) {
                console.log('[ResumeHub BG] Using cached resume parse');
                originalResumeJSON = cached.resumeJSON;
            } else {
                resumeParseCache.delete(resumeHash);
            }
        }

        // Parse if not cached
        if (!originalResumeJSON) {
            const resumeCacheOptimizer = new ResumeCacheOptimizer(apiClient);
            const optimizationResult = await resumeCacheOptimizer.getOptimizedResumeJSON(resumeData);
            originalResumeJSON = optimizationResult.resumeJSON;
            
            if (originalResumeJSON) {
                // Cache the parsed result
                resumeParseCache.set(resumeHash, { resumeJSON: originalResumeJSON, timestamp: Date.now() });
            }
        }

        if (!originalResumeJSON) {
            inFlightJobs.delete(jobKey);
            return sendResponse?.({ queued: false, reason: 'Failed to parse resume' });
        }

        const parallelProcessor = new ParallelProcessor(apiClient, { maxConcurrency: 3, batchDelay: 500 });
        const sectionResults = await parallelProcessor.processSectionsInParallel(jd, originalResumeJSON, () => {});
        const tailoredResumeJSON = parallelProcessor.combineResults(originalResumeJSON, sectionResults);
        tailoredResumeJSON.education = originalResumeJSON.education || [];

        // Cache recent job
        await upsertRecentJobEntry({
            jobTitle,
            companyName,
            location,
            jobUrl,
            jobDescription: jd,
            salary,
            tailoredResumeJSON
        });

        inFlightJobs.delete(jobKey);
        return sendResponse?.({ queued: true, success: true });
    } catch (error) {
        if (jobKey) inFlightJobs.delete(jobKey);
        console.error('[ResumeHub BG] jobChanged pipeline failed:', error);
        return sendResponse?.({ queued: false, error: error.message });
    }
}

// Listen for startup and storage changes to re-initialize.
chrome.runtime.onStartup.addListener(initialize);
chrome.storage.onChanged.addListener((changes, area) => {
    if (changes.apiToken && area === 'local') {
        console.log('[ResumeHub BG] API token changed. Re-initializing.');
        initialize();
    }
});

// Initial call
initialize();

// Cleanup old cache entries periodically to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    // Clean JD cache
    for (const [tabId, cached] of jdCache.entries()) {
        if (now - cached.timestamp > CACHE_TTL) {
            jdCache.delete(tabId);
        }
    }
    // Clean resume parse cache
    for (const [hash, cached] of resumeParseCache.entries()) {
        if (now - cached.timestamp > CACHE_TTL) {
            resumeParseCache.delete(hash);
        }
    }
}, 10 * 60 * 1000); // Run every 10 minutes

// --- Message Handlers ---

async function handleBatchSalaryEstimation(request, sendResponse) {
    try {
        console.log('[ResumeHub BG] Received batch salary estimation request:', request);
        
        if (!request.data || !request.data.jobs) {
            console.error('[ResumeHub BG] Invalid request format. Expected request.data.jobs');
            return sendResponse({ success: false, error: 'Invalid request format' });
        }
        
        const { jobs } = request.data;
        console.log(`[ResumeHub BG] Processing ${jobs.length} jobs for salary estimation`);
        
        // Add detailed logging for API key status
        console.log('[ResumeHub BG] API key status check:');
        console.log('  - apiClient exists:', !!apiClient);
        console.log('  - salaryEstimator exists:', !!salaryEstimator);
        if (apiClient) {
            console.log('  - apiClient.apiKey exists:', !!apiClient.apiKey);
        }
        
        if (!salaryEstimator) {
            console.warn('[ResumeHub BG] Salary estimator not ready - API key missing.');
            // Return error response indicating missing API key for all jobs
            const estimates = {};
            jobs.forEach(job => {
                estimates[job.jobUrl] = { error: 'No Api Key', retry: true };
            });
            console.log('[ResumeHub BG] Returning "No Api Key" response for all jobs:', estimates);
            return sendResponse({ success: true, data: estimates });
        }
        
        console.log(`[ResumeHub BG] Starting batch salary estimation for ${jobs.length} jobs.`);
        const estimates = await salaryEstimator.batchEstimate(jobs);
        console.log('[ResumeHub BG] Batch salary estimation completed:', estimates);
        sendResponse({ success: true, data: estimates });

    } catch (error) {
        console.error(`❌ Batch salary estimation failed: ${error.message}`, error);
        sendResponse({ success: false, error: `Batch processing error: ${error.message}` });
    }
}

async function handleCreateTailoredResume(request, sendResponse) {
    try {
        if (!apiClient) {
            throw new Error("API Client not initialized. Please set your API key in settings.");
        }

        // Get resume data
        const resumeData = request.resumeData || await StorageManager.getResume();
        if (!resumeData?.content) {
            throw new Error("No resume data provided.");
        }

        // Check resume parse cache to avoid redundant parsing
        const { generateResumeHash } = await import('./utils/shared-utilities.js');
        const resumeHash = generateResumeHash(resumeData);
        let originalResumeJSON = null;
        
        if (resumeParseCache.has(resumeHash)) {
            const cached = resumeParseCache.get(resumeHash);
            if (Date.now() - cached.timestamp < CACHE_TTL) {
                console.log('[ResumeHub BG] Using cached resume parse for manual generation');
                originalResumeJSON = cached.resumeJSON;
            } else {
                resumeParseCache.delete(resumeHash);
            }
        }

        // Parse if not cached
        if (!originalResumeJSON) {
            const resumeCacheOptimizer = new ResumeCacheOptimizer(apiClient);
            const optimizationResult = await resumeCacheOptimizer.getOptimizedResumeJSON(resumeData);
            originalResumeJSON = optimizationResult.resumeJSON;
            
            if (originalResumeJSON) {
                // Cache the parsed result
                resumeParseCache.set(resumeHash, { resumeJSON: originalResumeJSON, timestamp: Date.now() });
            }
        }
        
        if (!originalResumeJSON) {
            throw new Error("Failed to parse original resume into JSON structure.");
        }

        // Get job description - prefer override, then check cache, then extract
        let jobDescription = request.jobDescriptionOverride;
        if (!jobDescription) {
            // Try to get from active tab with caching
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab?.id) {
                jobDescription = await extractJDFromTab(tab.id, true, true); // Use cache
            }
            
            // If still no JD, try direct extraction
            if (!jobDescription) {
                const pageText = await ScriptInjector.getPageText();
                if (pageText && pageText.length > 100) {
                    jobDescription = await apiClient.extractJobDescription(pageText);
                }
            }
        }
        
        if (!jobDescription || jobDescription.length < 50) {
            throw new Error("Could not extract a valid job description.");
        }

        // Process sections in parallel
        const parallelProcessor = new ParallelProcessor(apiClient, { maxConcurrency: 3, batchDelay: 500 });
        const sectionResults = await parallelProcessor.processSectionsInParallel(jobDescription, originalResumeJSON, () => {});
        const tailoredResumeJSON = parallelProcessor.combineResults(originalResumeJSON, sectionResults);
        tailoredResumeJSON.education = originalResumeJSON.education || [];

        sendResponse({ success: true, tailoredResumeJSON: tailoredResumeJSON });

    } catch (error) {
        console.error(`❌ Resume generation failed: ${error.message}`);
        sendResponse({ success: false, error: error.message }); 
    }
}

async function handleGetJobDescription(request, sendResponse) {
    try {
        const { extractionMethod = 'standard', apiToken } = request;

        console.log(`[ResumeHub BG] getJobDescription called (method=${extractionMethod})`);

        // Ensure we can access the active tab
        const canAccess = await ScriptInjector.canAccessCurrentTab();
        if (!canAccess) {
            return sendResponse({ success: false, error: 'Unable to access current tab' });
        }

        // Get tab ID for caching
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const tabId = tab?.id;

        // Check cache first (if we have a tab ID)
        if (tabId && jdCache.has(tabId)) {
            const cached = jdCache.get(tabId);
            if (Date.now() - cached.timestamp < CACHE_TTL) {
                console.log('[ResumeHub BG] Using cached JD for getJobDescription');
                return sendResponse({ success: true, jobDescription: cached.jd });
            } else {
                jdCache.delete(tabId);
            }
        }

        let jobDescription = null;

        if (extractionMethod === 'ai') {
            // Ensure API client exists (initialize lazily if needed)
            if (!apiClient) {
                if (!apiToken) {
                    return sendResponse({ success: false, error: 'API key is required for AI extraction' });
                }
                apiClient = new GeminiAPIClient(apiToken);
            }

            // Use cached extraction if available, otherwise extract
            if (tabId) {
                jobDescription = await extractJDFromTab(tabId, true, true);
            }
            
            // Fallback to direct extraction if cache didn't work
            if (!jobDescription) {
                const pageText = await ScriptInjector.getPageText();
                if (!pageText || pageText.length < 100) {
                    return sendResponse({ success: false, error: 'Failed to retrieve page text' });
                }
                jobDescription = await apiClient.extractJobDescription(pageText);
                
                // Cache the result
                if (tabId && jobDescription) {
                    jdCache.set(tabId, { jd: jobDescription, timestamp: Date.now() });
                }
            }
        } else {
            // Standard DOM selector extraction
            if (tabId) {
                jobDescription = await extractJDFromTab(tabId, false, true);
            } else {
                jobDescription = await ScriptInjector.extractJobDescriptionStandard();
            }
        }

        if (!jobDescription) {
            return sendResponse({ success: false, error: 'Job description not found' });
        }

        sendResponse({ success: true, jobDescription });

    } catch (error) {
        console.error('[ResumeHub BG] getJobDescription error:', error);
        sendResponse({ success: false, error: error.message || 'Unknown error' });
    }
}

// --- Message Listener ---

const ACTION_HANDLERS = {
    'batchSalaryEstimation': handleBatchSalaryEstimation,
    'createTailoredResume': handleCreateTailoredResume,
    'getJobDescription': handleGetJobDescription,
    'jobChanged': handleJobChanged,
    'getRecentJobs': async (request, sender, sendResponse) => {
        try {
            const data = await StorageManager.get(['recentJobsV1']);
            sendResponse({ success: true, jobs: data.recentJobsV1 || [] });
        } catch (e) {
            sendResponse({ success: false, jobs: [] });
        }
    },
    // Storage operations for popup
    'getSettings': async (request, sendResponse) => {
        try {
            const settings = await StorageManager.getSettings();
            sendResponse(settings);
        } catch (error) {
            console.error('[ResumeHub BG] Error getting settings:', error);
            sendResponse({ theme: 'light', extractionMethod: 'ai' });
        }
    },
    'setSetting': async (request, sendResponse) => {
        try {
            const { key, value } = request.data;
            const success = await StorageManager.setSetting(key, value);
            sendResponse({ success });
        } catch (error) {
            console.error('[ResumeHub BG] Error setting value:', error);
            sendResponse({ success: false });
        }
    },
    'getResume': async (request, sendResponse) => {
        try {
            const resumeData = await StorageManager.getResume();
            sendResponse(resumeData);
        } catch (error) {
            console.error('[ResumeHub BG] Error getting resume:', error);
            sendResponse({ filename: null, content: null, mimeType: null });
        }
    },
    'setResume': async (request, sendResponse) => {
        try {
            const { filename, content, mimeType } = request.data;
            const success = await StorageManager.setResume(filename, content, mimeType);
            sendResponse({ success });
        } catch (error) {
            console.error('[ResumeHub BG] Error setting resume:', error);
            sendResponse({ success: false });
        }
    },
    'clearResume': async (request, sendResponse) => {
        try {
            const success = await StorageManager.clearResume();
            sendResponse({ success });
        } catch (error) {
            console.error('[ResumeHub BG] Error clearing resume:', error);
            sendResponse({ success: false });
        }
    },
    'getAPIToken': async (request, sendResponse) => {
        try {
            const token = await StorageManager.getAPIToken();
            sendResponse({ token });
        } catch (error) {
            console.error('[ResumeHub BG] Error getting API token:', error);
            sendResponse({ token: null });
        }
    },
    'setAPIToken': async (request, sendResponse) => {
        try {
            const { token } = request.data;
            const success = await StorageManager.setAPIToken(token);
            // Re-initialize API client with new token
            if (success && token) {
                apiClient = new GeminiAPIClient(token);
                salaryEstimator = new SalaryEstimator(apiClient, rateLimiter);
                console.log('[ResumeHub BG] API Client re-initialized with new token.');
            }
            sendResponse({ success });
        } catch (error) {
            console.error('[ResumeHub BG] Error setting API token:', error);
            sendResponse({ success: false });
        }
    },
    'clearAPIToken': async (request, sendResponse) => {
        try {
            const success = await StorageManager.clearAPIToken();
            // Reset API client
            if (success) {
                apiClient = null;
                salaryEstimator = null;
                console.log('[ResumeHub BG] API Client cleared.');
            }
            sendResponse({ success });
        } catch (error) {
            console.error('[ResumeHub BG] Error clearing API token:', error);
            sendResponse({ success: false });
        }
    },
    // other handlers like getJobDescription, autoFillForm can be added here
    // For now, focusing on the salary estimation flow.
    'getCurrentTabId': async (request, sender, sendResponse) => {
        try {
            const tabId = sender?.tab?.id;
            sendResponse({ tabId: tabId || null });
        } catch (e) {
            sendResponse({ tabId: null });
        }
    },
    'estimateSalaryWithJD': async (request, sender, sendResponse) => {
        try {
            const { jobTitle, companyName, location, jobUrl, jobDescription } = request.data || {};
            
            if (!salaryEstimator) {
                return sendResponse({ success: false, error: 'Salary estimator not available' });
            }

            // First get base estimate
            let salary = await salaryEstimator.estimate(jobTitle, location || '', companyName, jobUrl || '');
            
            // If we have job description, enhance the estimate with AI
            if (jobDescription && jobDescription.length > 100 && apiClient) {
                try {
                    const enhancePrompt = `Based on this job description, refine the salary estimate. Consider:
- Required experience level and seniority
- Specific technical skills mentioned
- Responsibilities and scope
- Industry and company size indicators

Job Title: ${jobTitle}
Company: ${companyName}
Location: ${location}
Current Estimate: ${salary.totalCompensation || 'N/A'}

Job Description (first 2000 chars):
${jobDescription.substring(0, 2000)}

Return a JSON object with refined estimates:
{
  "totalCompensation": "range in format like '₹43L-72L' or '$100k-150k'",
  "base": "base salary range",
  "bonus": "bonus range",
  "stock": "stock/equity range",
  "confidence": "High|Medium|Low",
  "reasoning": "brief explanation"
}

If the current estimate seems reasonable, keep it. Otherwise, adjust based on job description details.`;

                    const enhanced = await apiClient.callAPI('gemini-1.5-flash', enhancePrompt, {
                        temperature: 0.2,
                        maxOutputTokens: 500
                    });

                    if (enhanced && enhanced.candidates && enhanced.candidates[0]) {
                        const content = enhanced.candidates[0].content.parts[0].text;
                        try {
                            const jsonMatch = content.match(/\{[\s\S]*\}/);
                            if (jsonMatch) {
                                const enhancedData = JSON.parse(jsonMatch[0]);
                                // Merge enhanced data with original
                                salary = {
                                    ...salary,
                                    totalCompensation: enhancedData.totalCompensation || salary.totalCompensation,
                                    base: enhancedData.base || salary.base,
                                    bonus: enhancedData.bonus || salary.bonus,
                                    stock: enhancedData.stock || salary.stock,
                                    confidence: enhancedData.confidence || salary.confidence || 'Medium'
                                };
                            }
                        } catch (parseErr) {
                            console.warn('[ResumeHub BG] Failed to parse enhanced salary:', parseErr);
                        }
                    }
                } catch (enhanceErr) {
                    console.warn('[ResumeHub BG] Failed to enhance salary with JD:', enhanceErr);
                    // Continue with base estimate
                }
            }

            sendResponse({ success: true, salary });
        } catch (error) {
            console.error('[ResumeHub BG] estimateSalaryWithJD error:', error);
            sendResponse({ success: false, error: error.message });
        }
    },
    'getAIResponse': async (request, sender, sendResponse) => {
        try {
            if (!apiClient) {
                const apiKey = await StorageManager.getAPIToken();
                if (!apiKey) {
                    return sendResponse({ success: false, error: 'API key not set' });
                }
                apiClient = new GeminiAPIClient(apiKey);
            }

            const { prompt } = request;
            if (!prompt) {
                return sendResponse({ success: false, error: 'No prompt provided' });
            }

            const response = await apiClient.callAPI('gemini-2.5-flash', prompt, {
                temperature: 0.3,
                maxOutputTokens: 4096,
                responseMimeType: "text/plain"
            }, 'AI response');

            if (response.candidates && response.candidates[0]?.content?.parts[0]?.text) {
                const content = response.candidates[0].content.parts[0].text.trim();
                sendResponse({ success: true, content });
            } else {
                sendResponse({ success: false, error: 'Unexpected response structure' });
            }
        } catch (error) {
            console.error('[ResumeHub BG] getAIResponse error:', error);
            sendResponse({ success: false, error: error.message || 'AI request failed' });
        }
    },
    'ping': (request, sendResponse) => sendResponse({ status: 'pong' })
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const handler = ACTION_HANDLERS[request.action];
    if (handler) {
        console.log(`[ResumeHub BG] Received action: ${request.action}`);
        try {
            // Support both (request, sendResponse) and (request, sender, sendResponse)
            if (handler.length >= 3) {
                handler(request, sender, sendResponse);
            } else {
                handler(request, sendResponse);
            }
        } catch (e) {
            console.error('[ResumeHub BG] Handler error:', e);
            try { sendResponse({ success: false, error: e.message }); } catch {}
        }
        return true; // Indicate async response
    }
    console.warn(`[ResumeHub BG] No handler for action: ${request.action}`);
    return false;
});

// Clean up old onInstalled listeners if any
chrome.runtime.onInstalled.addListener(() => {
    console.log('[ResumeHub BG] Extension installed/updated.');
});