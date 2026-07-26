import { SalaryEstimator } from '../../utils/salary-estimator.js';
import { JobSearchHandler } from './pages/job-search-handler.js';
import { JobDetailsHandler } from './pages/job-details-handler.js';
import { SpaPageController } from '../shared/spa-navigation.js';

class InstahyreController extends SpaPageController {
    constructor(salaryEstimator, JobSearchHandler, JobDetailsHandler) {
        super();
        this.salaryEstimator = salaryEstimator;
        this.JobSearchHandler = JobSearchHandler;
        this.JobDetailsHandler = JobDetailsHandler;
        console.log('[ResumeHub] InstahyreController constructed');
        this.setupSpaNavigation({ includeClicks: true, useDomObserver: false });
    }

    isJobDetailsPage(url) {
        try {
            const path = new URL(url).pathname;
            if (path.includes('/opportunity/')) return true;
            const segments = path.split('/').filter(Boolean);
            if (segments[0] === 'jobs' && segments.length > 1) {
                return /\d+/.test(segments[segments.length - 1]);
            }
            return false;
        } catch (e) {
            return false;
        }
    }

    isJobSearchPage(url) {
        try {
            const path = new URL(url).pathname;
            return (
                path === '/jobs' ||
                path.startsWith('/jobs/') ||
                path.includes('/candidate/') ||
                path.includes('/search')
            ) && !this.isJobDetailsPage(url);
        } catch (e) {
            return false;
        }
    }

    initialize() {
        console.log('[ResumeHub] Instahyre Controller initializing at URL:', this.currentUrl);
        let newPageType = null;
        if (this.isJobDetailsPage(this.currentUrl)) newPageType = 'details';
        else if (this.isJobSearchPage(this.currentUrl)) newPageType = 'search';

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
        console.log('[ResumeHub] Instahyre Content script loaded.');
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const salaryEstimator = new SalaryEstimator();
        const controller = new InstahyreController(salaryEstimator, JobSearchHandler, JobDetailsHandler);
        controller.initialize();
    } catch (error) {
        console.error('[ResumeHub] Error during Instahyre content script initialization:', error);
    }
})();
