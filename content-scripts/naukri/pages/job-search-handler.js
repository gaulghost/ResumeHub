import { SELECTORS } from '../config/selectors.js';
import { SalaryBadge } from '../components/salary-badge.js';
import { observeJobList } from '../../shared/observe-job-list.js';

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
        this.isProcessingJobs = false;
        this._pendingJobs = []; // jobData queued for AI while a batch is in flight
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

        try {
            for (const card of this._queryJobCards()) {
                card.removeAttribute('data-rh-inspected');
                card.removeAttribute('data-rh-fail-count');
            }
        } catch (_) { /* ignore */ }

        this.badgeInstances.forEach(badge => badge.remove());
        this.badgeInstances.clear();
        this.processedJobIds.clear();
        this.failedJobIds.clear();
        this.jobDataMap.clear();
        this._pendingJobs = [];
        this.isProcessingJobs = false;
        console.log('[ResumeHub] Naukri JobSearchHandler destroyed.');
    }

    _queryJobCards() {
        const jobListSelectors = Array.isArray(SELECTORS.JOB_SEARCH_PAGE.jobListItem)
            ? SELECTORS.JOB_SEARCH_PAGE.jobListItem
            : [SELECTORS.JOB_SEARCH_PAGE.jobListItem];

        const seen = new Set();
        const cards = [];
        for (const selector of jobListSelectors) {
            let nodes;
            try {
                nodes = document.querySelectorAll(selector);
            } catch (_) {
                continue;
            }
            for (const node of nodes) {
                if (seen.has(node)) continue;
                if (cards.some((c) => c.contains(node))) continue;
                for (let i = cards.length - 1; i >= 0; i--) {
                    if (node.contains(cards[i])) {
                        seen.delete(cards[i]);
                        cards.splice(i, 1);
                    }
                }
                seen.add(node);
                cards.push(node);
            }
        }
        return cards;
    }

    initialize() {
        console.log('[ResumeHub] Initializing Naukri JobSearchHandler.');
        
        this.processAllVisibleJobs();

        this.observer = observeJobList({
            containerSelectors: [
                '.styles_jlc__list__',
                '.list',
                '#list-container',
                '[class*="jobTuple"]',
                'main',
                '#root',
            ],
            shouldProcess: (mutations) => mutations.some(mutation => {
                return Array.from(mutation.addedNodes).some(node => {
                    if (node.nodeType !== Node.ELEMENT_NODE) return false;
                    return SELECTORS.JOB_SEARCH_PAGE.jobListItem.some(selector =>
                        node.matches?.(selector) || node.querySelector?.(selector)
                    );
                });
            }),
            onUpdate: () => this.processAllVisibleJobs(),
            delay: 500,
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

        const jobCards = this._queryJobCards();
        if (jobCards.length > 5) {
            this.intersectionObserver.observe(jobCards[jobCards.length - 5]);
        }
    }

    processAllVisibleJobs() {
        const jobCards = this._queryJobCards();
        const newJobs = [];

        jobCards.forEach(card => {
            if (!card || card.getAttribute('data-rh-inspected') === 'true') return;
            if (this._shouldSkipCard(card)) return;

            const jobData = this.extractJobData(card);
            if (jobData && jobData.jobUrl) {
                const jobId = this._normalizeJobUrl(jobData.jobUrl);
                if (this.processedJobIds.has(jobId) || this.badgeInstances.has(jobId)) {
                    card.setAttribute('data-rh-inspected', 'true');
                    return;
                }
                // Mount loading badge immediately — do not wait for AI / in-flight batch
                this.createSalaryBadge(jobData, card);
                if (!this.badgeInstances.has(jobId)) return;
                this.processedJobIds.add(jobId);
                card.setAttribute('data-rh-inspected', 'true');
                newJobs.push(jobData);
            } else {
                const fails = Number(card.getAttribute('data-rh-fail-count') || '0') + 1;
                card.setAttribute('data-rh-fail-count', String(fails));
                if (fails >= 8) card.setAttribute('data-rh-inspected', 'true');
            }
        });

        if (newJobs.length > 0) {
            this._estimateJobs(newJobs);
        }
    }

    _shouldSkipCard(card) {
        const cls = `${card.className || ''}`.toString().toLowerCase();
        const skipTokens = ['skeleton', 'loading', 'placeholder', 'shimmer', 'ghost', 'promo', 'advert', 'ad-banner', 'ads-', 'sponsored'];
        if (skipTokens.some((t) => cls.includes(t))) return true;
        try {
            if (card.matches?.('[data-ad], [data-promoted], .adList, .naukri-jd-ad')) return true;
        } catch (_) { /* ignore */ }
        if ((card.textContent || '').trim().length < 5) return true;
        return false;
    }

    /**
     * Run cache + AI for jobs that already have loading badges mounted.
     * If a batch is in flight, queue jobData (UI already shows Estimating…).
     */
    async _estimateJobs(jobDataList) {
        if (!jobDataList || jobDataList.length === 0) return;

        if (this.isProcessingJobs) {
            this._pendingJobs.push(...jobDataList);
            console.log(`[ResumeHub][Naukri] AI in flight — queued ${jobDataList.length} more jobs (${this._pendingJobs.length} pending).`);
            return;
        }
        this.isProcessingJobs = true;

        try {
            const cacheChecks = await Promise.all(jobDataList.map(async (jobData) => ({
                jobData,
                cached: await this.salaryEstimator.getCachedEstimate(jobData),
            })));

            const jobsNeedingEstimation = [];
            for (const { jobData, cached } of cacheChecks) {
                const jobId = this._normalizeJobUrl(jobData.jobUrl);
                const badge = this.badgeInstances.get(jobId);
                if (cached) {
                    if (badge) badge.showSalary(cached);
                } else {
                    if (badge?.showLoading) badge.showLoading();
                    jobsNeedingEstimation.push(jobData);
                }
            }

            if (jobsNeedingEstimation.length === 0) return;

            console.log('[ResumeHub][Naukri] Sending to backend:', jobsNeedingEstimation.map(j => `${j.companyName} / ${j.jobTitle}`));

            try {
                const estimates = await this.salaryEstimator.batchEstimate(jobsNeedingEstimation);
                this.updateBadgesWithEstimates(estimates);
            } catch (error) {
                console.error('[ResumeHub] Error during Naukri batch salary estimation:', error);
                this.updateBadgesWithError(jobsNeedingEstimation, error.message);
            }
        } finally {
            this.isProcessingJobs = false;
            if (this._pendingJobs.length > 0) {
                const pending = this._pendingJobs.splice(0);
                await this._estimateJobs(pending);
            }
        }
    }

    /** @deprecated use _estimateJobs — kept for callers that still pass DOM cards */
    async processJobCards(jobCards) {
        if (!jobCards || jobCards.length === 0) return;
        const mounted = [];
        for (const card of jobCards) {
            const jobData = this.extractJobData(card);
            if (!jobData?.jobUrl) continue;
            const jobId = this._normalizeJobUrl(jobData.jobUrl);
            if (!this.processedJobIds.has(jobId)) {
                this.createSalaryBadge(jobData, card);
                if (!this.badgeInstances.has(jobId)) continue;
                this.processedJobIds.add(jobId);
                card.setAttribute('data-rh-inspected', 'true');
            }
            if (this.badgeInstances.has(jobId)) mounted.push(jobData);
        }
        await this._estimateJobs(mounted);
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

            if (jobTitle === 'N/A' || companyName === 'N/A') {
                const cardHtml = (jobCard.outerHTML || '').substring(0, 1500);
                chrome.runtime.sendMessage({
                    action: 'telemetry',
                    eventType: 'ui_extraction_failed',
                    metadata: { 
                        domain: 'naukri.com', 
                        url: window.location.href, 
                        source: 'job_search', 
                        extractedTitle: jobTitle, 
                        extractedCompany: companyName,
                        cardHtml: cardHtml
                    }
                });
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
        const existing = targetContainer.querySelector(`.${SELECTORS.SALARY_BADGE.container}`);
        if (existing && this.badgeInstances.has(jobId)) {
            return;
        }
        if (existing) existing.remove();

        const badge = new SalaryBadge(targetContainer, jobData.jobUrl);
        this.jobDataMap.set(jobId, jobData);
        badge.create();
        this.badgeInstances.set(jobId, badge);
    }
    
    updateBadgesWithEstimates(estimates) {
        if (!estimates) return;

        for (const [jobUrl, salaryData] of Object.entries(estimates)) {
            if (jobUrl === '__warning' || !salaryData || typeof salaryData !== 'object') continue;
            const jobId = this._normalizeJobUrl(jobUrl);
            const badge = this.badgeInstances.get(jobId);
            if (!badge) continue;

            if (!salaryData.error) {
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
