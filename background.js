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
import { generateResumeHash } from './utils/shared-utilities.js';

console.log('[ResumeHub BG] Service worker started, modules loaded.');

// --- Backend Configuration & Telemetry ---
const BACKEND_BASE = 'https://resumehub.duckdns.org';

async function sendTelemetry(eventType, metadata = {}) {
    try {
        const userId = await StorageManager.getUserId();
        const telemetryURL = `${BACKEND_BASE}/api/telemetry`;
        
        fetch(telemetryURL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                event_type: eventType,
                metadata: metadata
            })
        }).catch(err => console.warn('[ResumeHub BG] Telemetry send failed:', err));
    } catch (e) {
        console.warn('[ResumeHub BG] sendTelemetry failed:', e);
    }
}

async function uploadResumeToBackend(filename, content, mimeType, parsedJson = null) {
    try {
        const userId = await StorageManager.getUserId();
        const uploadURL = `${BACKEND_BASE}/api/resume`;
        
        const payload = {
            user_id: userId,
            filename: filename,
            content: content,
            mime_type: mimeType
        };
        if (parsedJson) {
            payload.parsed_json = parsedJson;
        }
        
        sendTelemetry(parsedJson ? 'resume_parsed_upload' : 'resume_parsing_backend_requested');
        
        const resp = await fetch(uploadURL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (resp.ok) {
            const resData = await resp.json();
            if (resData.success) {
                console.log('[ResumeHub BG] Resume successfully saved/parsed on backend');
                sendTelemetry(parsedJson ? 'resume_saved_backend' : 'resume_parsed_backend_success', { model: resData.model_used });
                
                // Save to local cache if parsed by backend
                if (!parsedJson && resData.parsed_json) {
                    const resumeHash = generateResumeHash({ content });
                    const cacheKey = `optimized_resume_json_${resumeHash}`;
                    const cacheData = {
                        resumeJSON: resData.parsed_json,
                        timestamp: Date.now(),
                        metadata: {
                            source: 'backend-generated',
                            processingTime: 0,
                            variantsGenerated: 1,
                            timestamp: Date.now(),
                            optimization: 'single-pass-backend'
                        },
                        originalPasses: 1
                    };
                    await StorageManager.setCache(cacheKey, cacheData, 24);
                    console.log('[ResumeHub BG] Saved backend-parsed JSON to local cache');
                }
            } else {
                console.warn('[ResumeHub BG] Backend parse/save failed:', resData.error);
                sendTelemetry('resume_save_backend_failed', { error: resData.error });
            }
        } else {
            const errText = await resp.text();
            console.warn('[ResumeHub BG] Backend returned status:', resp.status, errText);
            sendTelemetry('resume_save_backend_failed', { error: `HTTP ${resp.status}` });
        }
    } catch (e) {
        console.warn('[ResumeHub BG] uploadResumeToBackend error:', e);
        sendTelemetry('resume_save_backend_failed', { error: e.message });
    }
}

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
let initPromise = null;

function ensureInitialized() {
    if (!initPromise) {
        initPromise = initialize();
    }
    return initPromise;
}

async function initialize() {
    try {
        await StorageManager.initialize();
        rateLimiter = new SimpleRateLimiter(5, 10000); // 5 requests per 10 seconds
        console.log('[ResumeHub BG] Rate limiter initialized.');

        const apiKey = await StorageManager.getAPIToken();
        console.log('[ResumeHub BG] Initializing API client (has key:', !!apiKey, ').');
        apiClient = new GeminiAPIClient(apiKey || '');
        salaryEstimator = new SalaryEstimator(apiClient, rateLimiter);
        console.log('[ResumeHub BG] API Client and Salary Estimator initialized.');
        
        // Initialize user tracking
        const userId = await StorageManager.getUserId();
        console.log('[ResumeHub BG] User ID initialized:', userId);
        sendTelemetry('dau_ping');
    } catch (error) {
        console.error('[ResumeHub BG] Initialization failed:', error);
        initPromise = null; // Clear promise so retry is possible
        throw error;
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
                '#job-details', '.jobs-description__text', // Added from working content script
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
    // Auto-tailor functionality has been removed.
    // This handler is kept as a placeholder or for future non-AI job tracking if needed.
    const { data } = request || {};
    console.log('[ResumeHub BG] Job changed detected:', data?.jobTitle, 'at', data?.companyName);
    return sendResponse?.({ queued: false, success: true });
}

// Listen for startup and storage changes to re-initialize.
chrome.runtime.onStartup.addListener(() => ensureInitialized());
chrome.storage.onChanged.addListener((changes, area) => {
    if (changes.apiToken && area === 'local') {
        console.log('[ResumeHub BG] API token changed. Re-initializing.');
        initPromise = initialize();
    }
});

// Initial call
ensureInitialized();

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
        if (!request.data || !request.data.jobs) {
            console.error('[ResumeHub BG] Invalid request format. Expected request.data.jobs');
            return sendResponse({ success: false, error: 'Invalid request format' });
        }
        
        const { jobs } = request.data;
        sendTelemetry('salary_estimation_requested', { count: jobs.length });
        
        if (!salaryEstimator) {
            console.warn('[ResumeHub BG] Salary estimator not ready.');
            // Return error response indicating missing API key for all jobs as a safe fallback
            const estimates = {};
            jobs.forEach(job => {
                estimates[job.jobUrl] = { error: 'No Api Key', retry: true };
            });
            sendTelemetry('salary_estimation_failed', { error: 'No API Key' });
            return sendResponse({ success: true, data: estimates });
        }
        
        const estimates = await salaryEstimator.batchEstimate(jobs);
        sendTelemetry('salary_estimation_completed', { count: jobs.length, success: true });
        sendResponse({ success: true, data: estimates });

    } catch (error) {
        console.error(`❌ Batch salary estimation failed: ${error.message}`, error);
        sendTelemetry('salary_estimation_failed', { error: error.message });
        sendResponse({ success: false, error: `Batch processing error: ${error.message}` });
    }
}

async function handleCreateTailoredResume(request, sendResponse) {
    try {
        if (!apiClient) {
            throw new Error("API Client not initialized.");
        }

        // Get resume data
        const resumeData = request.resumeData || await StorageManager.getResume();
        if (!resumeData?.content) {
            throw new Error("No resume data provided.");
        }
        
        sendTelemetry('resume_tailoring_requested', { filename: resumeData.filename });

        // Check resume parse cache to avoid redundant parsing
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
            if (!apiClient.apiKeys || apiClient.apiKeys.length === 0) {
                // Parse on backend if no local API key configured
                console.log('[ResumeHub BG] No local API key. Requesting backend resume parsing...');
                const userId = await StorageManager.getUserId();
                const uploadURL = `${BACKEND_BASE}/api/resume`;
                const payload = {
                    user_id: userId,
                    filename: resumeData.filename,
                    content: resumeData.content,
                    mime_type: resumeData.mimeType
                };
                
                const resp = await fetch(uploadURL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (!resp.ok) {
                    throw new Error(`Backend resume parsing failed with status ${resp.status}`);
                }
                
                const resData = await resp.json();
                if (!resData.success) {
                    throw new Error(resData.error || "Backend resume parsing failed");
                }
                
                originalResumeJSON = resData.parsed_json;
                
                if (originalResumeJSON) {
                    resumeParseCache.set(resumeHash, { resumeJSON: originalResumeJSON, timestamp: Date.now() });
                    const cacheKey = `optimized_resume_json_${resumeHash}`;
                    const cacheData = {
                        resumeJSON: originalResumeJSON,
                        timestamp: Date.now(),
                        metadata: {
                            source: 'backend-generated',
                            processingTime: 0,
                            variantsGenerated: 1,
                            timestamp: Date.now(),
                            optimization: 'single-pass-backend'
                        },
                        originalPasses: 1
                    };
                    await StorageManager.setCache(cacheKey, cacheData, 24);
                }
            } else {
                const resumeCacheOptimizer = new ResumeCacheOptimizer(apiClient);
                const optimizationResult = await resumeCacheOptimizer.getOptimizedResumeJSON(resumeData);
                originalResumeJSON = optimizationResult.resumeJSON;
                
                if (originalResumeJSON) {
                    // Cache the parsed result
                    resumeParseCache.set(resumeHash, { resumeJSON: originalResumeJSON, timestamp: Date.now() });
                    // Asynchronously upload pre-parsed JSON to the backend database
                    uploadResumeToBackend(resumeData.filename, resumeData.content, resumeData.mimeType, originalResumeJSON);
                }
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

        sendTelemetry('resume_tailoring_completed', { filename: resumeData.filename, success: true });
        sendResponse({ success: true, tailoredResumeJSON: tailoredResumeJSON });

    } catch (error) {
        console.error(`❌ Resume generation failed: ${error.message}`);
        sendTelemetry('resume_tailoring_failed', { error: error.message });
        sendResponse({ success: false, error: error.message }); 
    }
}

async function handleGetJobDescription(request, sendResponse) {
    try {
        const { extractionMethod = 'standard', apiToken, forceRefresh = false } = request;

        console.log(`[ResumeHub BG] getJobDescription called (method=${extractionMethod}, forceRefresh=${forceRefresh})`);
        sendTelemetry('job_description_requested', { method: extractionMethod });

        // Ensure we can access the active tab
        const canAccess = await ScriptInjector.canAccessCurrentTab();
        if (!canAccess) {
            sendTelemetry('job_description_failed', { method: extractionMethod, error: 'Unable to access current tab' });
            return sendResponse({ success: false, error: 'Unable to access current tab' });
        }

        // Get tab ID for caching
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const tabId = tab?.id;

        // Check cache first (if we have a tab ID and not forcing refresh)
        if (!forceRefresh && tabId && jdCache.has(tabId)) {
            const cached = jdCache.get(tabId);
            if (Date.now() - cached.timestamp < CACHE_TTL) {
                console.log('[ResumeHub BG] Using cached JD for getJobDescription');
                sendTelemetry('job_description_completed', { method: extractionMethod, source: 'cache', success: true });
                return sendResponse({ success: true, jobDescription: cached.jd });
            } else {
                jdCache.delete(tabId);
            }
        }
        
        // If forceRefresh is true, clear the cache entry
        if (forceRefresh && tabId && jdCache.has(tabId)) {
            jdCache.delete(tabId);
        }

        let jobDescription = null;

        if (extractionMethod === 'ai') {
            // Ensure API client exists
            if (!apiClient) {
                apiClient = new GeminiAPIClient(apiToken || '');
            }

            // Use cached extraction if available, otherwise extract
            if (tabId) {
                jobDescription = await extractJDFromTab(tabId, true, true);
            }
            
            // Fallback to direct extraction if cache didn't work
            if (!jobDescription) {
                const pageText = await ScriptInjector.getPageText();
                if (!pageText || pageText.length < 100) {
                    sendTelemetry('job_description_failed', { method: extractionMethod, error: 'Failed to retrieve page text' });
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
            sendTelemetry('job_description_failed', { method: extractionMethod, error: 'Not found' });
            return sendResponse({ success: false, error: 'Job description not found' });
        }

        sendTelemetry('job_description_completed', { method: extractionMethod, source: 'extracted', success: true });
        sendResponse({ success: true, jobDescription });

    } catch (error) {
        console.error('[ResumeHub BG] getJobDescription error:', error);
        sendTelemetry('job_description_failed', { method: extractionMethod, error: error.message });
        sendResponse({ success: false, error: error.message || 'Unknown error' });
    }
}

// --- Message Listener ---

const ACTION_HANDLERS = {
    'telemetry': async (request, sendResponse) => {
        try {
            await sendTelemetry(request.eventType, request.metadata || {});
            sendResponse({ success: true });
        } catch (e) {
            sendResponse({ success: false, error: e.message });
        }
    },
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
            // Asynchronously upload and parse on the backend
            uploadResumeToBackend(filename, content, mimeType);
        } catch (error) {
            console.error('[ResumeHub BG] Error setting resume:', error);
            sendResponse({ success: false });
        }
    },
    'autoFillForm': async (request, sendResponse) => {
        try {
            sendTelemetry('autofill_requested');
            sendTelemetry('autofill_completed', { success: true });
            sendResponse({ success: true, fieldsFound: 0, fieldsFilled: 0 });
        } catch (error) {
            sendTelemetry('autofill_failed', { error: error.message });
            sendResponse({ success: false, error: error.message });
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
            if (success) {
                apiClient = new GeminiAPIClient(token || '');
                salaryEstimator = new SalaryEstimator(apiClient, rateLimiter);
                console.log('[ResumeHub BG] API Client re-initialized.');
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
            // Reset API client with empty key
            if (success) {
                apiClient = new GeminiAPIClient('');
                salaryEstimator = new SalaryEstimator(apiClient, rateLimiter);
                console.log('[ResumeHub BG] API Client cleared (using empty key).');
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
            
            if (!jobTitle || !companyName) {
                sendResponse({ success: false, error: 'Missing job details (jobTitle or companyName)' });
                return; // Do not return true here, as it's handled by the outer listener
            }

            if (!salaryEstimator) {
                return sendResponse({ success: false, error: 'Salary estimator not available' });
            }

            // First get base estimate
            let salary = await salaryEstimator.estimate(jobTitle, location || '', companyName, jobUrl || '', jobDescription);
            
            // Secondary enhancement logic removed as it is now handled in the primary estimate call
            // which includes the job description context directly.

            sendResponse({ success: true, salary });
        } catch (error) {
            console.error('[ResumeHub BG] estimateSalaryWithJD error:', error);
            sendResponse({ 
                success: false, 
                error: error.message,
                details: error.context || error.originalError || error.stack
            });
        }
    },
    'getAIResponse': async (request, sender, sendResponse) => {
        try {
            if (!apiClient) {
                const apiKey = await StorageManager.getAPIToken();
                apiClient = new GeminiAPIClient(apiKey || '');
            }

            const { prompt } = request;
            if (!prompt) {
                return sendResponse({ success: false, error: 'No prompt provided' });
            }

            const response = await apiClient.callAPI('gemini-flash-latest', prompt, {
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
        
        ensureInitialized().then(() => {
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
        }).catch(err => {
            console.error('[ResumeHub BG] Initialization error before handling action:', err);
            try { sendResponse({ success: false, error: `Background initialization failed: ${err.message}` }); } catch {}
        });
        return true; // Indicate async response
    }
    console.warn(`[ResumeHub BG] No handler for action: ${request.action}`);
    return false;
});

// Clean up old onInstalled listeners if any
chrome.runtime.onInstalled.addListener(() => {
    console.log('[ResumeHub BG] Extension installed/updated.');
});