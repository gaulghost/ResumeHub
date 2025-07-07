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
            console.warn('[ResumeHub BG] API key not found. Salary estimation will use mock data.');
            // Initialize with null client to allow mock data fallback
            salaryEstimator = new SalaryEstimator(null, rateLimiter);
        }
    } catch (error) {
        console.error('[ResumeHub BG] Initialization failed:', error);
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
        
        if (!salaryEstimator) {
            // This can happen if initialization is slow or failed.
            console.warn('[ResumeHub BG] Salary estimator not ready. Using fallback.');
            const mockEstimator = new SalaryEstimator(null);
            const estimates = await mockEstimator.batchEstimate(jobs);
            console.log('[ResumeHub BG] Fallback estimation completed:', estimates);
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
    // This function seems complex and out of scope of the salary estimation refactor.
    // For now, I'm keeping it as is, but it might need its own refactoring later.
    // The key change is ensuring GeminiAPIClient is initialized properly.
    try {
        if (!apiClient) {
            throw new Error("API Client not initialized. Please set your API key in settings.");
        }
        const resumeCacheOptimizer = new ResumeCacheOptimizer(apiClient);
        
        const optimizationResult = await resumeCacheOptimizer.getOptimizedResumeJSON(request.resumeData);
        const originalResumeJSON = optimizationResult.resumeJSON;
        
        if (!originalResumeJSON) {
             throw new Error("Failed to parse original resume into JSON structure.");
        }

        let jobDescription = request.jobDescriptionOverride;
        if (!jobDescription) {
            const pageText = await ScriptInjector.getPageText();
            jobDescription = await apiClient.extractJobDescription(pageText);
        }
        
        if (!jobDescription || jobDescription.length < 50) {
            throw new Error("Could not extract a valid job description.");
        }

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

        let jobDescription = null;

        if (extractionMethod === 'ai') {
            // Ensure API client exists (initialize lazily if needed)
            if (!apiClient) {
                if (!apiToken) {
                    return sendResponse({ success: false, error: 'API key is required for AI extraction' });
                }
                apiClient = new GeminiAPIClient(apiToken);
            }

            const pageText = await ScriptInjector.getPageText();
            if (!pageText || pageText.length < 100) {
                return sendResponse({ success: false, error: 'Failed to retrieve page text' });
            }

            jobDescription = await apiClient.extractJobDescription(pageText);
        } else {
            // Standard DOM selector extraction
            jobDescription = await ScriptInjector.extractJobDescriptionStandard();
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
                salaryEstimator = new SalaryEstimator(null, rateLimiter);
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
    'ping': (request, sendResponse) => sendResponse({ status: 'pong' })
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const handler = ACTION_HANDLERS[request.action];
    if (handler) {
        console.log(`[ResumeHub BG] Received action: ${request.action}`);
        handler(request, sendResponse);
        return true; // Indicate async response
    }
    console.warn(`[ResumeHub BG] No handler for action: ${request.action}`);
    return false;
});

// Clean up old onInstalled listeners if any
chrome.runtime.onInstalled.addListener(() => {
    console.log('[ResumeHub BG] Extension installed/updated.');
});