import { SalaryEstimator } from '../../utils/salary-estimator.js';
import { JobSearchHandler } from './pages/job-search-handler.js';
import { JobDetailsHandler } from './pages/job-details-handler.js';
import { SpaPageController } from '../shared/spa-navigation.js';

class NaukriController extends SpaPageController {
    constructor(salaryEstimator, JobSearchHandler, JobDetailsHandler) {
        super();
        this.salaryEstimator = salaryEstimator;
        this.JobSearchHandler = JobSearchHandler;
        this.JobDetailsHandler = JobDetailsHandler;
        console.log('[ResumeHub] NaukriController constructed');
        this.setupSpaNavigation({ includeClicks: true, useDomObserver: false });
    }

    detectPageType(url) {
        if (url.includes('/job-listings')) {
            return 'details';
        }
        if (
            /\/(jobs|mnjuser|recommendedjobs|jobsearch)/i.test(url) ||
            /naukri\.com\/[^?#]*jobs?/i.test(url)
        ) {
            return 'search';
        }
        return null;
    }

    initialize() {
        console.log('[ResumeHub] Naukri Controller initializing at URL:', this.currentUrl);
        const newPageType = this.detectPageType(this.currentUrl);

        if (this.currentPageType === newPageType && newPageType === 'details' && this.pageHandler) {
            this.pageHandler.initialize();
            return;
        }
        if (this.currentPageType === newPageType && this.pageHandler && newPageType === 'search') {
            return;
        }

        this.currentPageType = newPageType;
        if (this.pageHandler && typeof this.pageHandler.destroy === 'function') {
            this.pageHandler.destroy();
        }

        if (newPageType === 'details') {
            this.pageHandler = new this.JobDetailsHandler(this.salaryEstimator);
        } else if (newPageType === 'search') {
            this.pageHandler = new this.JobSearchHandler(this.salaryEstimator);
        } else {
            this.pageHandler = null;
            return;
        }
        this.pageHandler.initialize();
    }

    destroy() {
        this.destroySpaNavigation();
    }
}

(async () => {
    try {
        console.log('[ResumeHub] Naukri Content script loaded.');
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const salaryEstimator = new SalaryEstimator();
        const controller = new NaukriController(salaryEstimator, JobSearchHandler, JobDetailsHandler);
        controller.initialize();
    } catch (error) {
        console.error('[ResumeHub] Error during Naukri content script initialization:', error);
    }
})();
