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
        console.log('[ResumeHub] JobDetailsHandler initializing...');
        this.processJobDetails();
    }

    async processJobDetails() {
        const jobUrl = window.location.href;
        if (this.processedJobUrl === jobUrl && this.currentBadge) {
            return;
        }

        // Prevent concurrent processing
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
            console.warn('[ResumeHub] Could not extract job data');
            return;
        }

        const badge = this.createSalaryBadge();
        if (!badge) {
            console.warn('[ResumeHub] Could not create salary badge');
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
            console.error('[ResumeHub] Error estimating salary:', error);
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
            const titleElement = this.findElement(SELECTORS.JOB_DETAILS_PAGE.jobTitle);
            const companyInfoElement = this.findElement(SELECTORS.JOB_DETAILS_PAGE.companyInfo);

            const jobTitle = titleElement?.innerText.trim();
            if (!jobTitle) return null;

            const { companyName, location } = this.parseCompanyInfo(companyInfoElement);
            if (!companyName) return null;

            console.log('[ResumeHub] Extracted job data:', { jobTitle, companyName, location });
            
            return { 
                jobTitle, 
                companyName, 
                location: location || 'Remote/Unspecified' 
            };
        } catch (error) {
            console.error('[ResumeHub] Error extracting job data from details page', error);
            return null;
        }
    }

    findElement(selectors) {
        const selectorArray = Array.isArray(selectors) ? selectors : [selectors];
        for (const selector of selectorArray) {
            const element = document.querySelector(selector);
            if (element) return element;
        }
        return null;
    }

    parseCompanyInfo(companyInfoElement) {
        if (!companyInfoElement) return { companyName: null, location: null };

        const text = companyInfoElement.innerText.trim();
        const separators = ['·', '•', '|', '-'];
        
        // Try splitting by separators
        for (const sep of separators) {
            if (text.includes(sep)) {
                const parts = text.split(sep).map(part => part.trim());
                return {
                    companyName: parts[0] || null,
                    location: parts[1] || null
                };
            }
        }
        
        // Fallback: try to extract from link
        const linkElement = companyInfoElement.querySelector('a');
        if (linkElement) {
            const locationElement = document.querySelector('.jobs-unified-top-card__bullet, .jobs-unified-top-card__primary-description span:last-child');
            return {
                companyName: linkElement.innerText.trim(),
                location: locationElement?.innerText.trim() || null
            };
        }
        
        return { companyName: text, location: null };
    }
    
    createSalaryBadge() {
        const targetContainer = this.findElement(SELECTORS.JOB_DETAILS_PAGE.detailsPanelContainer);
        if (!targetContainer) {
            console.warn('[ResumeHub] Details panel container not found');
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
        console.log('[ResumeHub] JobDetailsHandler destroyed.');
        this.cleanup();
        this.processedJobUrl = null;
        this.processingPromise = null;
    }
} 