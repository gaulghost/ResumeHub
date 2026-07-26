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
import { SpaPageController } from '../shared/spa-navigation.js';

class LinkedInController extends SpaPageController {
    constructor(salaryEstimator, JobSearchHandler, JobDetailsHandler, sidebar) {
        super();
        this.salaryEstimator = salaryEstimator;
        this.JobSearchHandler = JobSearchHandler;
        this.JobDetailsHandler = JobDetailsHandler;
        this.sidebar = sidebar || null;
        this.isInitializing = false;
        console.log('[ResumeHub] LinkedInController constructed');
        // Shared SPA navigation (history patch + poll). No body MutationObserver for URL.
        this.setupSpaNavigation({
            includeClicks: false,
            useDomObserver: false,
            onUrlChange: () => {
                if (this.sidebar && typeof this.sidebar.onNavigate === 'function') {
                    this.sidebar.onNavigate();
                }
            }
        });
    }

    /**
     * Identity of the jobs *list* (filters/pagination), ignoring selection/tracking params.
     * Clicking a job only changes currentJobId — that must NOT remount badges / re-estimate.
     */
    _jobsListKey(url) {
        try {
            const u = new URL(url);
            const params = new URLSearchParams(u.search);
            for (const key of [...params.keys()]) {
                if (/^(currentJobId|eBP|refId|trackingId|trk|lipi|originToLandingJobPostings)$/i.test(key)) {
                    params.delete(key);
                }
            }
            return `${u.pathname}?${params.toString()}`;
        } catch (_) {
            return String(url || '');
        }
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

        if (this.currentPageType === newPageType && newPageType === 'details' && this.pageHandler) {
            this.pageHandler.initialize();
            return;
        }

        // Same search result set (only selected job / tracking changed) — keep badges.
        if (this.currentPageType === 'search' && newPageType === 'search' && this.pageHandler) {
            const listKey = this._jobsListKey(this.currentUrl);
            if (this._lastJobsListKey === listKey) {
                return;
            }
            // Pagination / filters changed — remount so loading badges appear for the new page.
            this._lastJobsListKey = listKey;
            if (typeof this.pageHandler.destroy === 'function') {
                this.pageHandler.destroy();
            }
            this.pageHandler = new this.JobSearchHandler(this.salaryEstimator);
            this.pageHandler.initialize();
            return;
        }

        this.currentPageType = newPageType;
        if (newPageType === 'search') {
            this._lastJobsListKey = this._jobsListKey(this.currentUrl);
        } else {
            this._lastJobsListKey = null;
        }

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

    destroy() {
        this.destroySpaNavigation();
    }

    // LinkedIn's React router needs a longer settle time than other sites
    debouncedInitialize(delay = 800) {
        super.debouncedInitialize(delay);
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
                            detail: `Sidebar mount failed: ${e.message || e}`,
                            cardHtml: (document.querySelector('main')?.outerHTML || document.body?.outerHTML || '').substring(0, 1500)
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

        // Apply sidebar toggle without requiring a full page reload
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== 'sync' || !changes.sidebarEnabled) return;
            const enabled = changes.sidebarEnabled.newValue !== false;
            if (!enabled && controller.sidebar) {
                try {
                    if (typeof controller.sidebar.destroy === 'function') {
                        controller.sidebar.destroy();
                    }
                } catch (_) { /* ignore */ }
                controller.sidebar = null;
            } else if (enabled && !controller.sidebar) {
                // Remount requires a refresh for a clean Shadow DOM lifecycle
                console.log('[ResumeHub] Sidebar enabled — reload the page to show it.');
            }
        });

        console.log("[ResumeHub] Controller initialization complete.");
    } catch (error) {
        console.error(
            "[ResumeHub] Critical error in content script initialization:",
            error
        );
    }
})();
