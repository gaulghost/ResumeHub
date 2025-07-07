/**
 * This script is the main entry point for all LinkedIn-related functionality.
 * It detects the current page and initializes the appropriate handler.
 * It's injected by the manifest.json onto LinkedIn job pages.
 */

// Dynamic imports will be used below to ensure compatibility with classic content-script execution.

class LinkedInController {
    constructor(salaryEstimator, JobSearchHandler, JobDetailsHandler) {
        this.salaryEstimator = salaryEstimator;
        this.JobSearchHandler = JobSearchHandler;
        this.JobDetailsHandler = JobDetailsHandler;
        this.pageHandler = null;
        this.currentUrl = window.location.href; 
        console.log('[ResumeHub] LinkedInController constructed');

        // Listen for SPA navigation events
        window.addEventListener('popstate', this.handleUrlChange.bind(this));
        window.addEventListener('hashchange', this.handleUrlChange.bind(this));
        // We also listen for clicks, as they can trigger navigation without URL changes.
        document.addEventListener('click', this.handleUrlChange.bind(this), true);
    }

    /**
     * Initializes the controller, determines the page type, and starts the appropriate handler.
     */
    initialize() {
        console.log('[ResumeHub] LinkedIn Controller initializing at URL:', this.currentUrl);

        // Clean up any existing handler
        if (this.pageHandler && typeof this.pageHandler.destroy === 'function') {
            this.pageHandler.destroy();
        }

        if (this.currentUrl.includes('/jobs/search/')) {
            console.log('[ResumeHub] Job Search Page detected.');
            this.pageHandler = new this.JobSearchHandler(this.salaryEstimator);
        } else if (this.currentUrl.includes('/jobs/view/')) {
            console.log('[ResumeHub] Job Details Page detected.');
            this.pageHandler = new this.JobDetailsHandler(this.salaryEstimator);
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
     * Handles single-page application navigation changes.
     * We use a short delay to allow the DOM to update after a navigation event.
     */
    handleUrlChange() {
        setTimeout(() => {
            if (window.location.href !== this.currentUrl) {
                console.log('[ResumeHub] URL change detected, re-initializing controller.');
                this.currentUrl = window.location.href;
                this.initialize();
            }
        }, 500); // Delay to ensure new page content is loaded
    }
}

/**
 * Main execution block.
 * We wait for the DOM to be ready and add a small delay to ensure
 * LinkedIn's JavaScript has finished rendering the page.
 */
(async () => {
    try {
        console.log('[ResumeHub] Content script loaded. Starting dynamic imports...');

        console.log('[ResumeHub] Importing SalaryEstimator...');
        const { SalaryEstimator } = await import(chrome.runtime.getURL('utils/salary-estimator.js'));
        console.log('[ResumeHub] SalaryEstimator imported successfully.');

        console.log('[ResumeHub] Importing JobSearchHandler...');
        const { JobSearchHandler } = await import(chrome.runtime.getURL('content-scripts/linkedin/pages/job-search-handler.js'));
        console.log('[ResumeHub] JobSearchHandler imported successfully.');

        console.log('[ResumeHub] Importing JobDetailsHandler...');
        const { JobDetailsHandler } = await import(chrome.runtime.getURL('content-scripts/linkedin/pages/job-details-handler.js'));
        console.log('[ResumeHub] JobDetailsHandler imported successfully.');

        console.log('[ResumeHub] All modules imported dynamically.');

        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log('[ResumeHub] Initializing SalaryEstimator...');
        const salaryEstimator = new SalaryEstimator();
        console.log('[ResumeHub] SalaryEstimator initialized.');

        console.log('[ResumeHub] Initializing LinkedInController...');
        const controller = new LinkedInController(salaryEstimator, JobSearchHandler, JobDetailsHandler);
        console.log('[ResumeHub] LinkedInController initialized.');

        controller.initialize();

        console.log('[ResumeHub] Controller initialization complete.');

    } catch (error) {
        console.error('[ResumeHub] Critical error in content script initialization:', error);
    }
})();
