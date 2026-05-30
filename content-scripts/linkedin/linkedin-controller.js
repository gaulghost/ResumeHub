/**
 * This script is the main entry point for all LinkedIn-related functionality.
 * It detects the current page and initializes the appropriate handler.
 * It's injected by the manifest.json onto LinkedIn job pages.
 */

import { SalaryEstimator } from '../../utils/salary-estimator.js';
import { JobSearchHandler } from './pages/job-search-handler.js';
import { JobDetailsHandler } from './pages/job-details-handler.js';
import '../../core/config/app-config.js';
import { ResumeHubSidebar } from './components/right-sidebar.js';

class LinkedInController {
    constructor(salaryEstimator, JobSearchHandler, JobDetailsHandler, sidebar) {
        this.salaryEstimator = salaryEstimator;
        this.JobSearchHandler = JobSearchHandler;
        this.JobDetailsHandler = JobDetailsHandler;
        this.sidebar = sidebar || null;
        this.pageHandler = null;
        this.currentPageType = null;
        this.currentUrl = window.location.href; 
        this.mutationObserver = null;
        this.initializationTimeout = null;
        this.isInitializing = false;
        console.log('[ResumeHub] LinkedInController constructed');
        this.setupEventListeners();
        this.setupMutationObserver();
    }

    setupEventListeners() {
        const handleUrlChange = this.handleUrlChange.bind(this);
        window.addEventListener("popstate", handleUrlChange);
        window.addEventListener("hashchange", handleUrlChange);
        document.addEventListener("click", handleUrlChange, true);
    }

    /**
     * Sets up mutation observer to watch for DOM changes
     */
    setupMutationObserver() {
        // Simple mutation observer for URL changes
        this.mutationObserver = new MutationObserver(() => {
            // Check for URL changes
            if (window.location.href !== this.currentUrl) {
                this.currentUrl = window.location.href;
                this.debouncedInitialize();
                if (this.sidebar && typeof this.sidebar.onNavigate === 'function') {
                    this.sidebar.onNavigate();
                }
            }
        });

        this.mutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Initializes the controller, determines the page type, and starts the appropriate handler.
     */
    initialize() {
        console.log('[ResumeHub] LinkedIn Controller initializing at URL:', this.currentUrl);

        let newPageType = null;
        if (this.currentUrl.includes('/jobs/view/')) {
            newPageType = 'details';
        } else if (this.currentUrl.includes('/jobs/')) {
            newPageType = 'search';
        }

        if (this.currentPageType === newPageType && this.pageHandler) {
            console.log(`[ResumeHub] Page type remained ${newPageType}, skipping page handler re-creation.`);
            return;
        }

        this.currentPageType = newPageType;

        // Clean up any existing handler
        if (this.pageHandler && typeof this.pageHandler.destroy === 'function') {
            this.pageHandler.destroy();
        }

        if (newPageType === 'details') {
            console.log('[ResumeHub] Job Details Page detected.');
            this.pageHandler = new this.JobDetailsHandler(this.salaryEstimator);
        } else if (newPageType === 'search') {
            console.log('[ResumeHub] Job Search/List Page detected.');
            this.pageHandler = new this.JobSearchHandler(this.salaryEstimator);
        } else {
            this.pageHandler = null;
            console.warn('[ResumeHub] No specific handler for this LinkedIn page:', this.currentUrl);
        }

        if (this.pageHandler) {
            this.pageHandler.initialize();
            console.log('[ResumeHub] Page handler initialized.');
        }
    }

    /**
     * Debounced initialize to prevent thrashing during rapid SPA updates
     */
    debouncedInitialize() {
        if (this.initializationTimeout) {
            clearTimeout(this.initializationTimeout);
        }
        this.initializationTimeout = setTimeout(() => this.initialize(), 250);
    }



    /**
     * Handles single-page application navigation changes.
     * We use a short delay to allow the DOM to update after a navigation event.
     */
    handleUrlChange() {
        setTimeout(() => {
            if (window.location.href !== this.currentUrl) {
                console.log('[ResumeHub] URL change detected, re-initializing controller.');
                this.currentUrl = window.location.href;
                this.debouncedInitialize();
                if (this.sidebar && typeof this.sidebar.onNavigate === 'function') {
                    this.sidebar.onNavigate();
                }
            }
        }, 500); // Delay to ensure new page content is loaded
    }

    /**
     * Cleanup method
     */
    destroy() {
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
        }
        if (this.initializationTimeout) {
            clearTimeout(this.initializationTimeout);
        }
        if (this.pageHandler && typeof this.pageHandler.destroy === 'function') {
            this.pageHandler.destroy();
        }
    }
}

/**
 * Main execution block.
 * We wait for the DOM to be ready and add a small delay to ensure
 * LinkedIn's JavaScript has finished rendering the page.
 */
(async () => {
    try {
        console.log('[ResumeHub] Content script loaded. Starting static imports...');

        let isSidebarEnabled = window.AppConfig?.isFeatureEnabled?.('linkedIn.rightSidebar') ?? true;
        
        // Check user preferences in chrome storage
        try {
            const storageResult = await new Promise(resolve => chrome.storage.sync.get(['sidebarEnabled'], resolve));
            if (storageResult && storageResult.sidebarEnabled !== undefined) {
                isSidebarEnabled = isSidebarEnabled && storageResult.sidebarEnabled;
            }
        } catch (storageErr) {
            console.warn("[ResumeHub] Failed to read sidebar settings from storage.", storageErr);
        }
        
        console.log("[ResumeHub] Sidebar feature enabled:", isSidebarEnabled);
        let sidebar = null;

        await new Promise((resolve) => setTimeout(resolve, 2000));

        console.log("[ResumeHub] Initializing SalaryEstimator...");
        const salaryEstimator = new SalaryEstimator();
        console.log("[ResumeHub] SalaryEstimator initialized.");

        if (isSidebarEnabled) {
            try {
                console.log("[ResumeHub] Mounting ResumeHubSidebar...");
                sidebar = new ResumeHubSidebar();
                await sidebar.mount();
                console.log("[ResumeHub] ResumeHubSidebar mounted.");
            } catch (e) {
                console.warn("[ResumeHub] Sidebar mount failed; continuing without sidebar.", e);
                try {
                    chrome.runtime.sendMessage({
                        action: 'telemetry',
                        eventType: 'ui_extraction_failed',
                        metadata: {
                            domain: 'linkedin.com',
                            url: window.location.href,
                            source: 'sidebar_mount',
                            detail: `Sidebar mount failed: ${e.message || e}`
                        }
                    });
                } catch (err) {
                    console.warn("[ResumeHub] Telemetry message failed to send:", err);
                }
            }
        } else {
            console.log("[ResumeHub] Right sidebar is disabled via feature flag.");
        }

        console.log("[ResumeHub] Initializing LinkedInController...");
        const controller = new LinkedInController(
            salaryEstimator,
            JobSearchHandler,
            JobDetailsHandler,
            sidebar
        );
        console.log("[ResumeHub] LinkedInController initialized.");

        controller.initialize();

        console.log("[ResumeHub] Controller initialization complete.");
    } catch (error) {
        console.error(
            "[ResumeHub] Critical error in content script initialization:",
            error
        );
    }
})();
