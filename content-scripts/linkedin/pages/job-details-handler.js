import { SELECTORS } from '../config/selectors.js';
import { SalaryBadge } from '../components/salary-badge.js';

export class JobDetailsHandler {
    constructor(salaryEstimator) {
        this.salaryEstimator = salaryEstimator;
        this.processedJobUrl = null;
    }

    initialize() {
        console.log('[ResumeHub] JobDetailsHandler initializing...');
        this.processJobDetails();
    }

    async processJobDetails() {
        const jobUrl = window.location.href;
        if (this.processedJobUrl === jobUrl) {
            return;
        }

        this.processedJobUrl = jobUrl;
        const jobData = this.extractJobData();

        if (jobData) {
            const badge = this.createSalaryBadge();
            try {
                const estimate = await this.salaryEstimator.estimate(jobData.jobTitle, jobData.location, jobData.companyName, jobUrl);
                if (estimate.error) {
                    badge.showError(estimate.error);
                } else {
                    badge.showSalary(estimate);
                }
            } catch (error) {
                badge.showError('API Error');
            }
        }
    }

    extractJobData() {
        try {
            const titleElement = document.querySelector(SELECTORS.JOB_DETAILS_PAGE.jobTitle);
            const companyInfoElement = document.querySelector(SELECTORS.JOB_DETAILS_PAGE.companyInfo);

            const jobTitle = titleElement ? titleElement.innerText.trim() : 'N/A';
            
            let companyName = 'N/A';
            let location = 'N/A';

            if (companyInfoElement) {
                const parts = companyInfoElement.innerText.split('·').map(part => part.trim());
                companyName = parts[0] || 'N/A';
                location = parts[1] || 'N/A';
            }
            
            if (jobTitle === 'N/A' || companyName === 'N/A' || location === 'N/A') {
                console.warn('[ResumeHub] Incomplete job data on details page.');
                return null;
            }

            return { jobTitle, companyName, location };
        } catch (error) {
            console.error('[ResumeHub] Error extracting job data from details page', error);
            return null;
        }
    }
    
    createSalaryBadge() {
        const targetContainer = document.querySelector(SELECTORS.JOB_DETAILS_PAGE.detailsPanelContainer);
        if (!targetContainer) {
            console.warn('[ResumeHub] Details panel container not found.');
            return null;
        }
        
        const badgeContainer = document.createElement('div');
        targetContainer.prepend(badgeContainer);

        const badge = new SalaryBadge(badgeContainer, window.location.href);
        badge.create();
        return badge;
    }

    destroy() {
        console.log('[ResumeHub] JobDetailsHandler destroyed.');
        // No specific listeners or observers to disconnect in this handler yet.
    }
} 