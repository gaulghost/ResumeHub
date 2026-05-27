class NaukriController {
    constructor(salaryEstimator, JobSearchHandler, JobDetailsHandler) {
        this.salaryEstimator = salaryEstimator;
        this.JobSearchHandler = JobSearchHandler;
        this.JobDetailsHandler = JobDetailsHandler;
        this.pageHandler = null;
        this.currentPageType = null;
        this.currentUrl = window.location.href; 
        this.mutationObserver = null;
        this.initializationTimeout = null;
        console.log('[ResumeHub] NaukriController constructed');
        this.setupEventListeners();
        this.setupMutationObserver();
    }

    setupEventListeners() {
        const handleUrlChange = this.handleUrlChange.bind(this);
        window.addEventListener("popstate", handleUrlChange);
        window.addEventListener("hashchange", handleUrlChange);
        document.addEventListener("click", handleUrlChange, true);
    }

    setupMutationObserver() {
        this.mutationObserver = new MutationObserver(() => {
            if (window.location.href !== this.currentUrl) {
                this.currentUrl = window.location.href;
                this.debouncedInitialize();
            }
        });

        this.mutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    initialize() {
        console.log('[ResumeHub] Naukri Controller initializing at URL:', this.currentUrl);

        let newPageType = null;
        if (this.currentUrl.includes('/job-listings')) {
            newPageType = 'details';
        } else {
            newPageType = 'search';
        }

        if (this.currentPageType === newPageType && this.pageHandler) {
            console.log(`[ResumeHub] Page type remained ${newPageType}, skipping page handler re-creation.`);
            return;
        }

        this.currentPageType = newPageType;

        if (this.pageHandler && typeof this.pageHandler.destroy === 'function') {
            this.pageHandler.destroy();
        }

        if (newPageType === 'details') {
            console.log('[ResumeHub] Naukri Job Details Page detected.');
            this.pageHandler = new this.JobDetailsHandler(this.salaryEstimator);
        } else {
            console.log('[ResumeHub] Naukri Job Search/List Page detected.');
            this.pageHandler = new this.JobSearchHandler(this.salaryEstimator);
        }

        if (this.pageHandler) {
            this.pageHandler.initialize();
            console.log('[ResumeHub] Naukri page handler initialized.');
        }
    }

    debouncedInitialize() {
        if (this.initializationTimeout) {
            clearTimeout(this.initializationTimeout);
        }
        this.initializationTimeout = setTimeout(() => this.initialize(), 250);
    }

    handleUrlChange() {
        setTimeout(() => {
            if (window.location.href !== this.currentUrl) {
                console.log('[ResumeHub] URL change detected, re-initializing Naukri controller.');
                this.currentUrl = window.location.href;
                this.debouncedInitialize();
            }
        }, 500);
    }

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

(async () => {
    try {
        console.log('[ResumeHub] Naukri Content script loaded. Importing modules dynamically...');

        const { SalaryEstimator } = await import(chrome.runtime.getURL('utils/salary-estimator.js'));
        const { JobSearchHandler } = await import(chrome.runtime.getURL('content-scripts/naukri/pages/job-search-handler.js'));
        const { JobDetailsHandler } = await import(chrome.runtime.getURL('content-scripts/naukri/pages/job-details-handler.js'));

        await new Promise((resolve) => setTimeout(resolve, 2000));

        const salaryEstimator = new SalaryEstimator();
        const controller = new NaukriController(
            salaryEstimator,
            JobSearchHandler,
            JobDetailsHandler
        );

        controller.initialize();
    } catch (error) {
        console.error('[ResumeHub] Error during Naukri content script initialization:', error);
    }
})();
