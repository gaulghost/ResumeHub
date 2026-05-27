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
                console.log('[ResumeHub] Retry button clicked. Retrying failed Naukri jobs...');
                this.retryFailedJobs();
            }
        };
        document.addEventListener('click', this.retryClickListener, true);
        
        this.observer = null;
        console.log('[ResumeHub] Naukri JobSearchHandler constructed.');
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
        console.log('[ResumeHub] Naukri JobSearchHandler destroyed.');
    }

    initialize() {
        console.log('[ResumeHub] Initializing Naukri JobSearchHandler.');
        
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
                console.warn('[ResumeHub][Naukri] extractJobData returned null/no jobUrl for card:', card?.className || card);
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
            console.warn('[ResumeHub][Naukri] No jobs to estimate — all cards had N/A data or were already processed.');
            return;
        }

        console.log('[ResumeHub][Naukri] Sending to backend:', jobsNeedingEstimation.map(j => `${j.companyName} / ${j.jobTitle}`));

        try {
            const estimates = await this.salaryEstimator.batchEstimate(jobsNeedingEstimation);
            this.updateBadgesWithEstimates(estimates);
        } catch (error) {
            console.error('[ResumeHub] Error during Naukri batch salary estimation:', error);
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
            
            const titleElement = findElement(SELECTORS.JOB_SEARCH_PAGE.jobTitle);
            const companyElement = findElement(SELECTORS.JOB_SEARCH_PAGE.companyName);
            const locationElement = findElement(SELECTORS.JOB_SEARCH_PAGE.location);
            const urlElement = findElement(SELECTORS.JOB_SEARCH_PAGE.jobUrl);

            // Job Title extraction
            let jobTitle = 'N/A';
            if (titleElement) {
                jobTitle = titleElement.innerText.trim();
            } else {
                // Fallback: look for the first div with a title-like Next.js class
                const titleDiv = jobCard.querySelector('div[class*="text-title18Sb"]') || jobCard.querySelector('div.text-title18Sb');
                if (titleDiv) {
                    jobTitle = titleDiv.innerText.trim();
                } else {
                    // Try to guess from the layout structure
                    const guessTitle = jobCard.querySelector('ul')?.previousElementSibling;
                    if (guessTitle) {
                        jobTitle = guessTitle.innerText.trim();
                    }
                }
            }

            // Company Name extraction
            let companyName = 'N/A';
            if (companyElement) {
                companyName = companyElement.innerText.trim();
            } else {
                const compDiv = jobCard.querySelector('div[class*="text-title16Sb"]') || jobCard.querySelector('div.text-title16Sb') || jobCard.querySelector('h4 div');
                if (compDiv) {
                    companyName = compDiv.innerText.trim();
                }
            }

            // Location extraction
            let location = 'Remote/India';
            if (locationElement) {
                location = locationElement.innerText.trim();
            } else {
                // Fallback: find by image alt="location"
                const locImg = jobCard.querySelector('img[alt="location"]');
                if (locImg) {
                    const liEl = locImg.closest('li');
                    if (liEl) {
                        location = liEl.innerText.trim();
                    }
                }
            }

            // Clean location prefix if it contains "Hybrid - " or similar
            if (location.startsWith('Hybrid - ')) {
                location = location.replace('Hybrid - ', '').trim();
            }

            // Job URL / ID extraction
            let jobUrl = null;
            if (urlElement && urlElement.href) {
                jobUrl = urlElement.href;
            } else {
                const anyLink = jobCard.querySelector('a');
                if (anyLink && anyLink.href) {
                    jobUrl = anyLink.href;
                } else {
                    // Create a deterministic unique job identifier for the cache key
                    const stableId = btoa(encodeURIComponent(`${companyName}-${jobTitle}-${location}`)).substring(0, 24);
                    jobUrl = `https://www.naukri.com/job-listings-dummy-${stableId}`;
                }
            }

            return { jobTitle, companyName, location, jobUrl };
        } catch (error) {
            console.error('[ResumeHub] Error extracting Naukri job data:', error);
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
        
        // Sibling fallback (e.g. right column containing job details next to icons)
        if (!targetContainer && card.children && card.children.length > 1) {
            targetContainer = card.children[1];
        }
        
        if (!targetContainer) {
            targetContainer = card;
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
            // Naukri URLs typically end in a unique 12-digit number (e.g. -210526001234)
            const match = url.match(/-(\d{12})$/);
            if (match) return match[1];

            // Alternate digit matches
            const match2 = url.match(/-(\d+)$/);
            if (match2) return match2[1];

            return url;
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
