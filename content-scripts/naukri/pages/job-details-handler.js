import { SELECTORS } from '../config/selectors.js';
import { SalaryBadge } from '../components/salary-badge.js';

export class JobDetailsHandler {
    constructor(salaryEstimator) {
        this.salaryEstimator = salaryEstimator;
        this.processedJobUrl = null;
        this.currentBadge = null;
        this.processingPromise = null;
    }

    initialize() {
        console.log('[ResumeHub] Naukri JobDetailsHandler initializing...');
        this.processJobDetails();
    }

    async processJobDetails() {
        const jobUrl = window.location.href;
        if (this.processedJobUrl === jobUrl && this.currentBadge) {
            return;
        }

        if (this.processingPromise) {
            return this.processingPromise;
        }

        this.processedJobUrl = jobUrl;
        this.cleanup();

        this.processingPromise = this.attemptProcessing();
        await this.processingPromise;
        this.processingPromise = null;
    }

    async attemptProcessing() {
        const jobData = await this.waitForJobData();
        
        if (!jobData) {
            console.warn('[ResumeHub] Could not extract job data from Naukri details page');
            return;
        }

        const badge = this.createSalaryBadge();
        if (!badge) {
            console.warn('[ResumeHub] Could not create salary badge on Naukri details page');
            return;
        }

        this.currentBadge = badge;
        
        try {
            const estimate = await this.salaryEstimator.estimate(
                jobData.jobTitle, 
                jobData.location, 
                jobData.companyName, 
                this.processedJobUrl
            );
            
            if (estimate.error) {
                badge.showError(estimate.error);
            } else {
                badge.showSalary(estimate);
            }
        } catch (error) {
            console.error('[ResumeHub] Error estimating salary on Naukri:', error);
            badge.showError('API Error');
        }
    }

    async waitForJobData(maxAttempts = 3, delay = 1000) {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const jobData = this.extractJobData();
            if (jobData) return jobData;
            
            if (attempt < maxAttempts - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        return null;
    }

    extractJobData() {
        try {
            const findElement = (selectors) => {
                for (const selector of selectors) {
                    const element = document.querySelector(selector);
                    if (element) return element;
                }
                return null;
            };

            const titleElement = findElement(SELECTORS.JOB_DETAILS_PAGE.jobTitle);
            const companyElement = findElement(SELECTORS.JOB_DETAILS_PAGE.companyInfo);

            const jobTitle = titleElement?.innerText.trim();
            if (!jobTitle) return null;

            const companyName = companyElement?.innerText.trim();
            if (!companyName) return null;

            // Extract location - try search page elements if details page doesn't have it explicitly
            const locationElement = document.querySelector(".loc, [class*='location']");
            const location = locationElement ? locationElement.innerText.trim() : 'India';

            return { 
                jobTitle, 
                companyName, 
                location 
            };
        } catch (error) {
            return null;
        }
    }
    
    createSalaryBadge() {
        let targetContainer = null;
        for (const selector of SELECTORS.JOB_DETAILS_PAGE.detailsPanelContainer) {
            const container = document.querySelector(selector);
            if (container) {
                targetContainer = container;
                break;
            }
        }
        
        if (!targetContainer) {
            return null;
        }
        
        const badgeContainer = document.createElement('div');
        targetContainer.insertBefore(badgeContainer, targetContainer.firstChild);

        const badge = new SalaryBadge(badgeContainer, window.location.href);
        return badge.create() ? badge : null;
    }

    cleanup() {
        if (this.currentBadge) {
            this.currentBadge.remove();
            this.currentBadge = null;
        }
    }

    destroy() {
        this.cleanup();
        this.processedJobUrl = null;
        this.processingPromise = null;
    }
}
