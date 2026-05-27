import { SELECTORS } from '../config/selectors.js';
import { SalaryBadge } from '../components/salary-badge.js';

export class JobSearchHandler {
    constructor(salaryEstimator) {
        this.salaryEstimator = salaryEstimator;
        this.processedJobIds = new Set();
        this.badgeInstances = new Map();
        this.failedJobIds = new Set();
        this.jobDataMap = new Map();
        
        this.retryClickListener = (event) => {
            const retryBtn = event.target.closest(`.${SELECTORS.SALARY_BADGE.retryBtn}`);
            if (retryBtn) {
                event.preventDefault();
                event.stopPropagation();
                if (event.stopImmediatePropagation) event.stopImmediatePropagation();
                console.log('[ResumeHub] Retry button clicked. Retrying failed Instahyre jobs...');
                this.retryFailedJobs();
            }
        };
        document.addEventListener('click', this.retryClickListener, true);
        
        this.observer = null;
        console.log('[ResumeHub] Instahyre JobSearchHandler constructed.');
    }

    destroy() {
        if (this.observer) {
            this.observer.disconnect();
        }
        if (this.scrollListener) {
            window.removeEventListener('scroll', this.scrollListener);
        }
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
        }
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
        }
        document.removeEventListener('click', this.retryClickListener, true);
        
        this.badgeInstances.forEach(badge => badge.remove());
        this.badgeInstances.clear();
        this.processedJobIds.clear();
        this.failedJobIds.clear();
        this.jobDataMap.clear();
        console.log('[ResumeHub] Instahyre JobSearchHandler destroyed.');
    }

    initialize() {
        console.log('[ResumeHub] Initializing Instahyre JobSearchHandler.');
        
        this.processAllVisibleJobs();

        this.observer = new MutationObserver((mutations) => {
            const hasJobCardMutations = mutations.some(mutation => {
                return Array.from(mutation.addedNodes).some(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        return SELECTORS.JOB_SEARCH_PAGE.jobListItem.some(selector => 
                            node.matches(selector) || (node.querySelector && node.querySelector(selector))
                        );
                    }
                    return false;
                });
            });
            
            if (hasJobCardMutations) {
                setTimeout(() => this.processAllVisibleJobs(), 500);
            }
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        this.scrollListener = () => {
            if (this.scrollTimeout) {
                clearTimeout(this.scrollTimeout);
            }
            this.scrollTimeout = setTimeout(() => {
                this.processAllVisibleJobs();
            }, 500);
        };
        window.addEventListener('scroll', this.scrollListener, { passive: true });
        
        this.setupIntersectionObserver();
    }

    setupIntersectionObserver() {
        this.intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    setTimeout(() => this.processAllVisibleJobs(), 1000);
                }
            });
        }, {
            root: null,
            rootMargin: '100px',
            threshold: 0.1
        });

        let jobCards = [];
        for (const selector of SELECTORS.JOB_SEARCH_PAGE.jobListItem) {
            const cards = document.querySelectorAll(selector);
            if (cards.length > 0) {
                jobCards = Array.from(cards);
                break;
            }
        }
        
        if (jobCards.length > 5) {
            this.intersectionObserver.observe(jobCards[jobCards.length - 5]);
        }
    }

    processAllVisibleJobs() {
        let jobCards = [];
        for (const selector of SELECTORS.JOB_SEARCH_PAGE.jobListItem) {
            const cards = document.querySelectorAll(selector);
            if (cards.length > 0) {
                jobCards = Array.from(cards);
                break;
            }
        }
        
        const newJobCards = [];
        jobCards.forEach(card => {
            const jobData = this.extractJobData(card);
            if (jobData && jobData.jobUrl) {
                const jobId = this._normalizeJobUrl(jobData.jobUrl);
                if (!this.processedJobIds.has(jobId)) {
                    newJobCards.push(card);
                }
            }
        });
        
        if (newJobCards.length > 0) {
            this.processJobCards(newJobCards);
        }
    }

    async processJobCards(jobCards) {
        if (!jobCards || jobCards.length === 0) return;

        const jobsNeedingEstimation = [];
        for (const card of jobCards) {
            const jobData = this.extractJobData(card);
            if (!jobData || !jobData.jobUrl) {
                console.warn('[ResumeHub][Instahyre] extractJobData returned null/no jobUrl for card:', card?.className || card);
                continue;
            }


            const jobId = this._normalizeJobUrl(jobData.jobUrl);
            if (this.processedJobIds.has(jobId)) continue;

            this.processedJobIds.add(jobId);
            this.createSalaryBadge(jobData, card);

            const cached = await this.salaryEstimator.getCachedEstimate(jobData);
            if (cached) {
                const badge = this.badgeInstances.get(jobId);
                if (badge) badge.showSalary(cached);
                continue;
            }

            jobsNeedingEstimation.push(jobData);
        }

        if (jobsNeedingEstimation.length === 0) {
            console.warn('[ResumeHub][Instahyre] No jobs to estimate — all cards had N/A data or were already processed.');
            return;
        }

        console.log('[ResumeHub][Instahyre] Sending to backend:', jobsNeedingEstimation.map(j => `${j.companyName} / ${j.jobTitle}`));

        try {
            const estimates = await this.salaryEstimator.batchEstimate(jobsNeedingEstimation);
            this.updateBadgesWithEstimates(estimates);
        } catch (error) {
            console.error('[ResumeHub] Error during Instahyre batch salary estimation:', error);
            this.updateBadgesWithError(jobsNeedingEstimation, error.message);
        }
    }

    extractJobData(jobCard) {
        try {
            const findElement = (selectors) => {
                for (const selector of selectors) {
                    const element = jobCard.querySelector(selector);
                    if (element) return element;
                }
                return null;
            };
            
            // Try to extract from mobile elements first where company and title are split
            const mobileTitleEl = jobCard.querySelector('.employer-details-mobile .employer-job-name');
            const mobileCompanyEl = jobCard.querySelector('.employer-details-mobile .employer-company-name');
            
            let jobTitle = mobileTitleEl ? mobileTitleEl.innerText.trim() : '';
            let companyName = mobileCompanyEl ? mobileCompanyEl.innerText.trim() : '';
            
            // Fallback to desktop layout extraction
            if (!jobTitle || !companyName) {
                const titleElement = findElement(SELECTORS.JOB_SEARCH_PAGE.jobTitle);
                const companyElement = findElement(SELECTORS.JOB_SEARCH_PAGE.companyName);
                
                const titleText = titleElement ? titleElement.innerText.trim() : '';
                const companyText = companyElement ? companyElement.innerText.trim() : '';
                
                // On desktop, title/company are often in one combined element e.g. "Snapmint - SDE 2 - Backend"
                if (titleText.includes(' - ')) {
                    const parts = titleText.split(' - ');
                    companyName = parts[0].trim();
                    jobTitle = parts.slice(1).join(' - ').trim();
                } else if (companyText.includes(' - ')) {
                    const parts = companyText.split(' - ');
                    companyName = parts[0].trim();
                    jobTitle = parts.slice(1).join(' - ').trim();
                } else {
                    jobTitle = titleText || 'N/A';
                    companyName = companyText || 'N/A';
                }
            }

            // Location extraction
            const locationElement = findElement(SELECTORS.JOB_SEARCH_PAGE.location);
            let location = 'Remote/India';
            if (locationElement) {
                location = locationElement.innerText.trim();
                // Clean Instahyre map prefix text
                location = location.replace(/Job available in/gi, '').trim();
                location = location.replace(/Remote/gi, '').trim();
                location = location.replace(/[^a-zA-Z\s,]/g, '').trim(); // Remove icons/special chars
                if (!location) location = 'India';
            }

            // Job URL extraction with robust fallback
            const urlElement = findElement(SELECTORS.JOB_SEARCH_PAGE.jobUrl);
            let jobUrl = null;
            if (urlElement && urlElement.href && (urlElement.href.includes('/jobs/') || urlElement.href.includes('/opportunity/'))) {
                jobUrl = urlElement.href;
            } else {
                // Check if any link exists
                const anyLink = jobCard.querySelector('a');
                if (anyLink && anyLink.href && (anyLink.href.includes('/jobs/') || anyLink.href.includes('/opportunity/'))) {
                    jobUrl = anyLink.href;
                } else {
                    // Search for skills list ID: e.g. id="job-skills-425800"
                    const skillsEl = jobCard.querySelector('ul[id^="job-skills-"]');
                    if (skillsEl) {
                        const idMatch = skillsEl.id.match(/job-skills-(\d+)/);
                        if (idMatch) {
                            jobUrl = `https://www.instahyre.com/jobs/opportunity-${idMatch[1]}`;
                        }
                    }
                }
            }

            // If we still don't have a jobUrl, generate a stable cached URL
            if (!jobUrl) {
                const stableId = btoa(encodeURIComponent(`${companyName}-${jobTitle}-${location}`)).substring(0, 24);
                jobUrl = `https://www.instahyre.com/jobs/opportunity-dummy-${stableId}`;
            }

            return { jobTitle, companyName, location, jobUrl };
        } catch (error) {
            console.error('[ResumeHub] Error extracting Instahyre job data:', error);
            return null;
        }
    }
    
    createSalaryBadge(jobData, card) {
        let targetContainer = null;
        for (const selector of SELECTORS.JOB_SEARCH_PAGE.cardActionsContainer) {
            const container = card.querySelector(selector);
            if (container) {
                targetContainer = container;
                break;
            }
        }
        
        if (!targetContainer) {
            targetContainer = card.querySelector('.employer-details') || card.querySelector('.employer-row') || card;
        }
        
        const jobId = this._normalizeJobUrl(jobData.jobUrl);
        if (targetContainer.querySelector(`.${SELECTORS.SALARY_BADGE.container}`)) {
            return;
        }

        const badge = new SalaryBadge(targetContainer, jobData.jobUrl);
        this.jobDataMap.set(jobId, jobData);
        badge.create();
        this.badgeInstances.set(jobId, badge);
    }
    
    updateBadgesWithEstimates(estimates) {
        if (!estimates) return;

        for (const [jobUrl, salaryData] of Object.entries(estimates)) {
            const jobId = this._normalizeJobUrl(jobUrl);
            const badge = this.badgeInstances.get(jobId);
            if (!badge) continue;

            if (salaryData && !salaryData.error) {
                badge.showSalary(salaryData);
                this.failedJobIds.delete(jobId);
            } else {
                badge.showError(salaryData?.error || 'Error');
                this.failedJobIds.add(jobId);
            }
        }
    }

    updateBadgesWithError(jobs, message) {
        for (const job of jobs) {
            const jobId = this._normalizeJobUrl(job.jobUrl);
            const badge = this.badgeInstances.get(jobId);
            if (badge) {
                badge.showError('API Error');
                this.failedJobIds.add(jobId);
            }
        }
    }

    _normalizeJobUrl(url) {
        try {
            // Instahyre URLs typically end in a job ID (e.g. -12345)
            const cleanUrl = url.replace(/\/$/, "");
            const match = cleanUrl.match(/-(\d+)$/);
            if (match) return match[1];

            const segments = cleanUrl.split('/');
            return segments[segments.length - 1];
        } catch (e) {
            return url;
        }
    }

    async retryFailedJobs() {
        if (this.failedJobIds.size === 0) return;

        const retryJobs = [];
        this.failedJobIds.forEach(jobId => {
            const jobData = this.jobDataMap.get(jobId);
            if (jobData) {
                retryJobs.push(jobData);
                const badge = this.badgeInstances.get(jobId);
                if (badge) badge.showLoading();
            }
        });

        if (retryJobs.length === 0) return;

        try {
            const estimates = await this.salaryEstimator.batchEstimate(retryJobs, { ignoreCache: true });
            this.updateBadgesWithEstimates(estimates);
        } catch (error) {
            this.updateBadgesWithError(retryJobs, error.message);
        }
    }
}
