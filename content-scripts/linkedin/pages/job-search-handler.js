import { SELECTORS } from '../config/selectors.js';
import { SalaryBadge } from '../components/salary-badge.js';

export class JobSearchHandler {
    constructor(salaryEstimator) {
        this.salaryEstimator = salaryEstimator;
        // Track processed jobs and badge instances by a **normalized job ID** (extracted from the URL)
        this.processedJobIds = new Set();
        this.badgeInstances = new Map();
        this.failedJobIds = new Set(); // Track failed jobs for retry
        this.jobDataMap = new Map(); // Cache jobData by jobId for retry
        
        // Event delegation for retry button clicks
        this.retryClickListener = (event) => {
            const retryBtn = event.target.closest(`.${SELECTORS.SALARY_BADGE.retryBtn}`);
            if (retryBtn) {
                // Prevent LinkedIn navigation and stop all other handlers
                event.preventDefault();
                event.stopPropagation();
                if (event.stopImmediatePropagation) event.stopImmediatePropagation();
                console.log('[ResumeHub] Retry button clicked. Retrying failed jobs...');
                this.retryFailedJobs();
            }
        };
        document.addEventListener('click', this.retryClickListener, true);
        
        this.observer = null;
        console.log('[ResumeHub] JobSearchHandler constructed.');
    }

    destroy() {
        if (this.observer) {
            this.observer.disconnect();
            console.log('[ResumeHub] JobSearchHandler MutationObserver disconnected.');
        }
        
        // Remove scroll listener
        if (this.scrollListener) {
            window.removeEventListener('scroll', this.scrollListener);
            console.log('[ResumeHub] Scroll listener removed.');
        }
        
        // Clear scroll timeout
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
        }
        
        // Disconnect intersection observer
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
            console.log('[ResumeHub] Intersection observer disconnected.');
        }
        
        // Remove retry listener
        document.removeEventListener('click', this.retryClickListener, true);
        
        // Clear badges
        this.badgeInstances.forEach(badge => badge.remove());
        this.badgeInstances.clear();
        this.processedJobIds.clear();
        this.failedJobIds.clear();
        this.jobDataMap.clear();
        console.log('[ResumeHub] JobSearchHandler destroyed and cleaned up.');
    }

    initialize() {
        console.log('[ResumeHub] Initializing JobSearchHandler with MutationObserver strategy.');
        
        // Initial scan for jobs already on the page
        this.processAllVisibleJobs();

        // Use a MutationObserver to detect when new job cards are added to the DOM (e.g., on scroll).
        // We observe the body, as it's a reliable parent element. A more specific container
        // could be used if a stable selector is identified, which would improve performance.
        this.observer = new MutationObserver((mutations) => {
            // Check if any mutations actually added job cards
            const hasJobCardMutations = mutations.some(mutation => {
                return Array.from(mutation.addedNodes).some(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if the added node is a job card or contains job cards
                        return node.matches && (
                            node.matches('li[data-occludable-job-id]') ||
                            node.querySelector && node.querySelector('li[data-occludable-job-id]')
                        );
                    }
                    return false;
                });
            });
            
            if (hasJobCardMutations) {
                // A small delay helps ensure that the new elements are fully rendered.
                setTimeout(() => this.processAllVisibleJobs(), 500);
            }
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Add scroll listener as a backup for detecting new jobs
        this.scrollTimeout = null;
        this.lastJobCount = 0;
        this.scrollListener = () => {
            if (this.scrollTimeout) {
                clearTimeout(this.scrollTimeout);
            }
            this.scrollTimeout = setTimeout(() => {
                // Check if new jobs have been added
                const currentJobCount = document.querySelectorAll(SELECTORS.JOB_SEARCH_PAGE.jobListItem).length;
                if (currentJobCount > this.lastJobCount) {
                    console.log(`[ResumeHub] Scroll detected new jobs: ${currentJobCount} (was ${this.lastJobCount})`);
                    this.lastJobCount = currentJobCount;
                    this.processAllVisibleJobs();
                }
            }, 500); // Reduced delay for more responsive detection
        };
        
        window.addEventListener('scroll', this.scrollListener, { passive: true });
        
        // Also add intersection observer for better scroll detection
        this.setupIntersectionObserver();

        console.log('[ResumeHub] MutationObserver and scroll listener are now watching for new job cards.');
    }

    setupIntersectionObserver() {
        // Create an intersection observer to detect when we're near the bottom of the job list
        this.intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    console.log('[ResumeHub] Bottom of job list reached, checking for new jobs...');
                    setTimeout(() => this.processAllVisibleJobs(), 1000);
                }
            });
        }, {
            root: null,
            rootMargin: '100px',
            threshold: 0.1
        });

        // Find the job list container and observe the last few job cards
        const jobCards = document.querySelectorAll(SELECTORS.JOB_SEARCH_PAGE.jobListItem);
        if (jobCards.length > 5) {
            // Observe the 5th from last job card
            this.intersectionObserver.observe(jobCards[jobCards.length - 5]);
        }
    }

    processAllVisibleJobs() {
        const jobCards = document.querySelectorAll(SELECTORS.JOB_SEARCH_PAGE.jobListItem);
        
        console.log(`[ResumeHub] Found ${jobCards.length} job cards using selector: ${SELECTORS.JOB_SEARCH_PAGE.jobListItem}`);
        
        // Update job count tracking
        this.lastJobCount = jobCards.length;
        
        if (jobCards.length === 0) {
            console.warn('[ResumeHub] No job cards found. Checking DOM structure...');
            const alternativeSelectors = [
                'li[data-occludable-job-id]',
                '.job-card-container',
                '.job-card-list',
                'li.scaffold-layout__list-item'
            ];
            
            alternativeSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                console.log(`[ResumeHub] Found ${elements.length} elements with selector: ${selector}`);
            });
            return;
        }
        
        // Filter out already processed job cards
        const newJobCards = [];
        let skippedCount = 0;
        
        Array.from(jobCards).forEach(card => {
            const jobData = this.extractJobData(card);
            if (jobData && jobData.jobUrl) {
                const jobId = this._normalizeJobUrl(jobData.jobUrl);
                if (this.processedJobIds.has(jobId)) {
                    skippedCount++;
                    return; // skip this card
                }
                newJobCards.push(card);
            } else {
                skippedCount++;
                // Debug failed extractions
                if (skippedCount <= 3) { // Only log first 3 failures to avoid spam
                    console.warn(`[ResumeHub] Failed to extract job data from card ${skippedCount}:`, card);
                }
            }
        });
        
        if (skippedCount > 0) {
            console.log(`[ResumeHub] Skipped ${skippedCount} job cards (already processed or failed extraction)`);
        }
        
        if (newJobCards.length > 0) {
            console.log(`[ResumeHub] Processing ${newJobCards.length} new job cards.`);
            this.processJobCards(newJobCards);
        } else {
            console.log('[ResumeHub] No new job cards to process.');
        }
    }

    async processJobCards(jobCards) {
        const jobsNeedingEstimation = [];

        for (const card of jobCards) {
            const jobData = this.extractJobData(card);
            if (!jobData || !jobData.jobUrl) continue;

            const jobId = this._normalizeJobUrl(jobData.jobUrl);
            if (this.processedJobIds.has(jobId)) continue;

            this.processedJobIds.add(jobId);
            this.createSalaryBadge(jobData, card);

            // Try cache first
            const cached = await this.salaryEstimator.getCachedEstimate(jobData);
            if (cached) {
                // Show salary immediately
                const badge = this.badgeInstances.get(jobId);
                if (badge) badge.showSalary(cached);
                continue; // No need to fetch
            }

            jobsNeedingEstimation.push(jobData);
        }

        if (jobsNeedingEstimation.length === 0) return;

        console.log(`[ResumeHub] Batch estimating salaries for ${jobsNeedingEstimation.length} new jobs.`);
        try {
            const estimates = await this.salaryEstimator.batchEstimate(jobsNeedingEstimation);
            this.updateBadgesWithEstimates(estimates);
        } catch (error) {
            console.error('[ResumeHub] Error during batch salary estimation:', error);
            this.updateBadgesWithError(jobsNeedingEstimation, error.message);
        }
    }

    extractJobData(jobCard) {
        try {
            // Helper function to try multiple selectors
            const findElement = (selectors) => {
                if (typeof selectors === 'string') {
                    return jobCard.querySelector(selectors);
                }
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

            // The URL is the most critical piece of data
            let jobUrl = null;
            
            if (!urlElement || !urlElement.href) {
                // Try all URL selectors from the config
                const urlSelectors = Array.isArray(SELECTORS.JOB_SEARCH_PAGE.jobUrl) 
                    ? SELECTORS.JOB_SEARCH_PAGE.jobUrl 
                    : [SELECTORS.JOB_SEARCH_PAGE.jobUrl];
                
                let foundUrl = null;
                for (const selector of urlSelectors) {
                    const altElement = jobCard.querySelector(selector);
                    if (altElement && altElement.href) {
                        foundUrl = altElement.href;
                        break;
                    }
                }
                
                if (!foundUrl) {
                    // Log failed extractions for debugging
                    console.warn('[ResumeHub] Failed to extract URL from job card:', jobCard);
                    return null;
                }
                
                jobUrl = new URL(foundUrl).href;
            } else {
                jobUrl = new URL(urlElement.href).href;
            }

            const jobTitle = titleElement ? titleElement.innerText.trim() : 'N/A';
            const companyName = companyElement ? companyElement.innerText.trim() : 'N/A';
            const location = locationElement ? locationElement.innerText.trim() : 'N/A';
            
            // Only log successful extractions to reduce noise
            if (jobTitle !== 'N/A' && companyName !== 'N/A' && location !== 'N/A') {
                console.log('[ResumeHub] Extracted job data:', { jobTitle, companyName, location, jobUrl });
            }
            
            return { jobTitle, companyName, location, jobUrl };
        } catch (error) {
            console.warn('[ResumeHub] Could not extract data from a job card.', { error: error.message });
            return null;
        }
    }
    
    createSalaryBadge(jobData, card) {
        // Helper function to try multiple selectors
        const findElement = (selectors) => {
            if (typeof selectors === 'string') {
                return card.querySelector(selectors);
            }
            for (const selector of selectors) {
                const element = card.querySelector(selector);
                if (element) {
                    return element;
                }
            }
            return null;
        };
        
        const footerContainer = findElement(SELECTORS.JOB_SEARCH_PAGE.cardActionsContainer);
        
        if (footerContainer) {
            if (footerContainer.querySelector(`.${SELECTORS.SALARY_BADGE.container}`)) {
                return; // Badge already exists
            }
            console.log(`[ResumeHub] Creating salary badge for: ${jobData.jobUrl}`);
            const badge = new SalaryBadge(footerContainer, jobData.jobUrl);
            this.jobDataMap.set(this._normalizeJobUrl(jobData.jobUrl), jobData);
            badge.create();
            this.badgeInstances.set(this._normalizeJobUrl(jobData.jobUrl), badge);
        } else {
            // Try to inject the badge in a fallback location
            const fallbackContainer = card.querySelector('.job-card-container') || card;
            if (fallbackContainer) {
                console.log(`[ResumeHub] Using fallback container for: ${jobData.jobUrl}`);
                const badge = new SalaryBadge(fallbackContainer, jobData.jobUrl);
                this.jobDataMap.set(this._normalizeJobUrl(jobData.jobUrl), jobData);
                badge.create();
                this.badgeInstances.set(this._normalizeJobUrl(jobData.jobUrl), badge);
            }
        }
    }
    
    updateBadgesWithEstimates(estimates) {
        if (!estimates) return;

        console.log('[ResumeHub] Updating badges with salary estimates:', estimates);
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
        console.log(`[ResumeHub] Updating ${jobs.length} badges with error:`, message);
        for (const job of jobs) {
            const jobId = this._normalizeJobUrl(job.jobUrl);
            const badge = this.badgeInstances.get(jobId);
            if (badge) {
                badge.showError('API Error');
                this.failedJobIds.add(jobId);
            }
        }
    }

    /**
     * Normalizes LinkedIn job URLs by extracting the numeric job ID.
     * Falls back to full URL if the pattern does not match.
     * @param {string} url
     * @returns {string}
     */
    _normalizeJobUrl(url) {
        try {
            const match = url.match(/\/jobs\/view\/(\d+)/);
            return match ? match[1] : url;
        } catch (e) {
            return url;
        }
    }

    /**
     * Retries salary estimation for all failed jobs.
     * Triggered when user clicks any retry button.
     */
    async retryFailedJobs() {
        if (this.failedJobIds.size === 0) {
            console.log('[ResumeHub] No failed jobs to retry.');
            return;
        }

        const retryJobs = [];
        this.failedJobIds.forEach(jobId => {
            const jobData = this.jobDataMap.get(jobId);
            if (jobData) {
                retryJobs.push(jobData);
                // Show loading state again
                const badge = this.badgeInstances.get(jobId);
                if (badge && badge.showLoading) {
                    badge.showLoading();
                }
            }
        });

        if (retryJobs.length === 0) return;

        try {
            const estimates = await this.salaryEstimator.batchEstimate(retryJobs, { ignoreCache: true });
            this.updateBadgesWithEstimates(estimates);
        } catch (error) {
            console.error('[ResumeHub] Retry batch estimation failed:', error);
            this.updateBadgesWithError(retryJobs, error.message);
        }
    }
}
