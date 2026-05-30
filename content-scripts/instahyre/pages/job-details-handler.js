import { SELECTORS } from '../config/selectors.js';
import { SalaryBadge } from '../components/salary-badge.js';

export class JobDetailsHandler {
    constructor(salaryEstimator) {
        this.salaryEstimator = salaryEstimator;
        this.processedJobUrl = null;
        this.currentBadge = null;
        this.processingPromise = null;
        console.log('[ResumeHub] Instahyre JobDetailsHandler constructed.');
    }

    initialize() {
        console.log('[ResumeHub] Instahyre JobDetailsHandler initializing...');
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
            console.warn('[ResumeHub] Could not extract job data from Instahyre details page');
            chrome.runtime.sendMessage({
                action: 'telemetry',
                eventType: 'ui_extraction_failed',
                metadata: { domain: 'instahyre.com', url: window.location.href, source: 'job_details', detail: 'Could not extract jobData (title/company)' }
            });
            return;
        }

        const badge = this.createSalaryBadge();
        if (!badge) {
            console.warn('[ResumeHub] Could not create salary badge on Instahyre details page');
            chrome.runtime.sendMessage({
                action: 'telemetry',
                eventType: 'ui_extraction_failed',
                metadata: { domain: 'instahyre.com', url: window.location.href, source: 'job_details', detail: 'Could not create salary badge container' }
            });
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
            console.error('[ResumeHub] Error estimating salary on Instahyre:', error);
            badge.showError('API Error');
        }
    }

    async waitForJobData(maxAttempts = 3, delay = 1000) {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const jobData = this.extractJobData();
            if (jobData) return jobData;
            
            if (attempt < maxAttempts - 1) {
                console.log(`[ResumeHub] Job data not ready, retrying... (${attempt + 1}/${maxAttempts})`);
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

            // Remove company rating or other details if included in company text
            let companyName = companyElement?.innerText.trim();
            if (!companyName) return null;

            // Instahyre company elements can sometimes contain rating info or location. Let's clean it.
            companyName = companyName.split('\n')[0].trim();

            const locationElement = document.querySelector(".location, .loc, [class*='location']");
            const location = locationElement ? locationElement.innerText.trim() : 'Remote/India';

            return { 
                jobTitle, 
                companyName, 
                location 
            };
        } catch (error) {
            console.error('[ResumeHub] Error in extractJobData:', error);
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
            console.warn('[ResumeHub] Instahyre details panel container not found');
            return null;
        }
        
        if (targetContainer.querySelector(`.${SELECTORS.SALARY_BADGE.container}`)) {
            return null; // Badge already exists
        }

        const badgeContainer = document.createElement('div');
        if (targetContainer.firstChild) {
            targetContainer.insertBefore(badgeContainer, targetContainer.firstChild);
        } else {
            targetContainer.appendChild(badgeContainer);
        }

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
        console.log('[ResumeHub] Instahyre JobDetailsHandler destroyed.');
        this.cleanup();
        this.processedJobUrl = null;
        this.processingPromise = null;
    }
}
