import { SELECTORS } from '../config/selectors.js';
import { SalaryBadge } from '../components/salary-badge.js';
import { observeJobList } from '../../shared/observe-job-list.js';

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
        this.isProcessingJobs = false;
        this._pendingJobs = []; // jobData queued for AI while a batch is in flight
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
        // Strip inspect marks so a remount (pagination/filters) can re-process
        // recycled LinkedIn list nodes that keep the same DOM attributes.
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
        console.log('[ResumeHub] JobSearchHandler destroyed and cleaned up.');
    }

    initialize() {
        console.log('[ResumeHub] Initializing JobSearchHandler with MutationObserver strategy.');
        
        // LinkedIn SPA pagination often paints cards after the URL settles —
        // wait briefly so loading badges appear for the new page immediately.
        this._bootSequence();
    }

    async _bootSequence() {
        await this._waitForJobCards(10, 350);
        this.processAllVisibleJobs();
        this._attachObservers();
        // Second pass after LinkedIn finishes hydration / virtualization
        setTimeout(() => this.processAllVisibleJobs(), 900);
        setTimeout(() => this.processAllVisibleJobs(), 2000);
    }

    async _waitForJobCards(maxAttempts = 10, delayMs = 350) {
        for (let i = 0; i < maxAttempts; i++) {
            if (this._queryJobCards().length > 0) return true;
            await new Promise((r) => setTimeout(r, delayMs));
        }
        return false;
    }

    _queryJobCards() {
        const jobListSelectors = Array.isArray(SELECTORS.JOB_SEARCH_PAGE.jobListItem)
            ? SELECTORS.JOB_SEARCH_PAGE.jobListItem
            : [SELECTORS.JOB_SEARCH_PAGE.jobListItem];

        // Union ALL selectors — do NOT return on the first hit.
        // LinkedIn mixes old/new card markup; the first selector often matches
        // only 1 leftover `data-occludable-job-id` card and skips the rest.
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
                // Prefer the outermost list item when both parent+child match
                if (cards.some((c) => c.contains(node))) continue;
                // Drop previously collected nested matches inside this node
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

    _attachObservers() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }

        this.observer = observeJobList({
            containerSelectors: [
                '.scaffold-layout__list',
                '.jobs-search-results-list',
                '.semantic-search-results-list',
                'div.jobs-search-results-list',
                'ul.scaffold-layout__list-container',
                'main',
            ],
            shouldProcess: (mutations) => mutations.some(mutation => {
                return Array.from(mutation.addedNodes).some(node => {
                    if (node.nodeType !== Node.ELEMENT_NODE) return false;
                    const jobCardSelectors = [
                        'li[data-occludable-job-id]',
                        'li.semantic-search-results-list__list-item',
                        'li.scaffold-layout__list-item',
                        'div[data-job-id]'
                    ];
                    return node.matches && jobCardSelectors.some(selector =>
                        node.matches(selector) ||
                        (node.querySelector && node.querySelector(selector))
                    );
                });
            }),
            onUpdate: () => this.processAllVisibleJobs(),
            delay: 400,
        });

        if (this.scrollListener) {
            window.removeEventListener('scroll', this.scrollListener);
        }
        this.scrollTimeout = null;
        this.lastJobSignature = this._jobListSignature();
        this.scrollListener = () => {
            if (this.scrollTimeout) clearTimeout(this.scrollTimeout);
            this.scrollTimeout = setTimeout(() => {
                const sig = this._jobListSignature();
                if (sig !== this.lastJobSignature) {
                    console.log('[ResumeHub] Job list changed (scroll/pagination).');
                    this.lastJobSignature = sig;
                    this.processAllVisibleJobs();
                }
            }, 400);
        };
        window.addEventListener('scroll', this.scrollListener, { passive: true });

        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
        }
        this.setupIntersectionObserver();
        console.log('[ResumeHub] MutationObserver and scroll listener are now watching for new job cards.');
    }

    _jobListSignature() {
        const cards = this._queryJobCards();
        const ids = cards.slice(0, 8).map((card) => {
            return card.getAttribute('data-occludable-job-id')
                || card.querySelector?.('[data-job-id]')?.getAttribute('data-job-id')
                || (card.textContent || '').trim().slice(0, 40);
        });
        return `${cards.length}:${ids.join('|')}`;
    }

    setupIntersectionObserver() {
        // Create an intersection observer to detect when we're near the bottom of the job list
        this.intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    console.log('[ResumeHub] Bottom of job list reached, checking for new jobs...');
                    setTimeout(() => this.processAllVisibleJobs(), 800);
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
        this.lastJobSignature = this._jobListSignature();
        
        if (jobCards.length === 0) {
            console.warn('[ResumeHub] No job cards found. Checking DOM structure...');
            const alternativeSelectors = [
                'li[data-occludable-job-id]',
                'li.semantic-search-results-list__list-item',
                'li.scaffold-layout__list-item',
                'div[data-job-id]',
                '.job-card-container',
                '.job-card-list',
                '.job-card-job-posting-card-wrapper'
            ];
            
            alternativeSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                console.log(`[ResumeHub] Found ${elements.length} elements with selector: ${selector}`);
            });
            return;
        }

        console.log(`[ResumeHub] Found ${jobCards.length} job cards.`);
        
        // Filter out already processed job cards
        const newJobCards = [];
        let skippedCount = 0;
        
        Array.from(jobCards).forEach(card => {
            if (!card || card.getAttribute('data-rh-inspected') === 'true') {
                skippedCount++;
                return;
            }

            // Skip skeleton / ad / empty nodes without permanently marking (allow retry when DOM fills in)
            if (this._shouldSkipCard(card)) {
                skippedCount++;
                return;
            }

            const jobData = this.extractJobData(card);
            if (jobData && jobData.jobUrl) {
                const jobId = this._normalizeJobUrl(jobData.jobUrl);
                if (this.processedJobIds.has(jobId) || this.badgeInstances.has(jobId)) {
                    card.setAttribute('data-rh-inspected', 'true');
                    skippedCount++;
                    return;
                }
                // Mount loading badge immediately — do not wait for AI / in-flight batch
                this.createSalaryBadge(jobData, card);
                if (!this.badgeInstances.has(jobId)) {
                    skippedCount++;
                    return; // injection failed — retry on next scan
                }
                this.processedJobIds.add(jobId);
                card.setAttribute('data-rh-inspected', 'true');
                newJobCards.push(jobData);
            } else {
                // Soft-fail: keep retrying lazy cards (do not permanently inspect too early)
                const fails = Number(card.getAttribute('data-rh-fail-count') || '0') + 1;
                card.setAttribute('data-rh-fail-count', String(fails));
                if (fails >= 8) card.setAttribute('data-rh-inspected', 'true');
                skippedCount++;
            }
        });
        
        if (skippedCount > 0) {
            console.log(`[ResumeHub] Skipped ${skippedCount} job cards (already processed or not ready)`);
        }
        
        if (newJobCards.length > 0) {
            console.log(`[ResumeHub] Queued ${newJobCards.length} jobs for salary estimation (loading badges mounted).`);
            this._estimateJobs(newJobCards);
        } else {
            console.log('[ResumeHub] No new job cards to process.');
        }
    }

    /**
     * Run cache + AI for jobs that already have loading badges mounted.
     * If a batch is in flight, queue jobData (UI already shows Estimating…).
     */
    async _estimateJobs(jobDataList) {
        if (!jobDataList || jobDataList.length === 0) return;

        if (this.isProcessingJobs) {
            this._pendingJobs.push(...jobDataList);
            console.log(`[ResumeHub] AI in flight — queued ${jobDataList.length} more jobs (${this._pendingJobs.length} pending).`);
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

            try {
                const estimates = await this.salaryEstimator.batchEstimate(jobsNeedingEstimation);
                this.updateBadgesWithEstimates(estimates);
            } catch (error) {
                console.error('[ResumeHub] Error during batch salary estimation:', error);
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
                this.processedJobIds.add(jobId);
                this.createSalaryBadge(jobData, card);
                card.setAttribute('data-rh-inspected', 'true');
            }
            if (this.badgeInstances.has(jobId)) mounted.push(jobData);
        }
        await this._estimateJobs(mounted);
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
            let jobId = null;
            
            // First try to get job ID from data attributes (more reliable for new UI)
            const jobCardWrapper = jobCard.querySelector('[data-job-id]');
            if (jobCardWrapper) {
                jobId = jobCardWrapper.getAttribute('data-job-id');
                if (jobId) {
                    // Construct URL from job ID
                    jobUrl = `https://www.linkedin.com/jobs/view/${jobId}`;
                    console.log(`[ResumeHub] Extracted job ID from data attribute: ${jobId}`);
                }
            }
            
            // Check componentkey attribute on the card itself or its children (new UI fallback)
            if (!jobId) {
                const compKey = jobCard.getAttribute('componentkey') || jobCard.querySelector('[componentkey*="job-card-component-ref-"]')?.getAttribute('componentkey');
                if (compKey) {
                    const match = compKey.match(/job-card-component-ref-(\d+)/);
                    if (match) {
                        jobId = match[1];
                        jobUrl = `https://www.linkedin.com/jobs/view/${jobId}`;
                        console.log(`[ResumeHub] Extracted job ID from componentkey: ${jobId}`);
                    }
                }
            }
            
            // Fallback to URL extraction if no data attribute found
            if (!jobUrl) {
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
                        console.log('[ResumeHub] URL missing or not a job card:', jobCard);
                        return null;
                    }
                    
                    // Handle new UI URL format
                    const url = new URL(foundUrl);
                    const currentJobId = url.searchParams.get('currentJobId');
                    if (currentJobId) {
                        jobUrl = `https://www.linkedin.com/jobs/view/${currentJobId}`;
                        console.log(`[ResumeHub] Converted new UI URL to standard format: ${jobUrl}`);
                    } else {
                        jobUrl = foundUrl;
                    }
                } else {
                    // Handle new UI URL format
                    const url = new URL(urlElement.href);
                    const currentJobId = url.searchParams.get('currentJobId');
                    if (currentJobId) {
                        jobUrl = `https://www.linkedin.com/jobs/view/${currentJobId}`;
                        console.log(`[ResumeHub] Converted new UI URL to standard format: ${jobUrl}`);
                    } else {
                        jobUrl = urlElement.href;
                    }
                }
            }

            // Enhanced text extraction for new UI
            const extractText = (element) => {
                if (!element) return 'N/A';
                
                // Try to get text from various sources
                let text = '';
                
                // First try innerText (most reliable)
                if (element.innerText && element.innerText.trim()) {
                    text = element.innerText.trim();
                } 
                // Then try textContent as fallback
                else if (element.textContent && element.textContent.trim()) {
                    text = element.textContent.trim();
                }
                
                // Clean up common LinkedIn artifacts
                text = text.replace(/\s+/g, ' '); // Normalize whitespace
                text = text.replace(/^\s*•\s*/, ''); // Remove bullet points
                text = text.replace(/\s*\|\s*$/, ''); // Remove trailing separators
                
                return text || 'N/A';
            };

            const jobTitle = extractText(titleElement);
            const companyName = extractText(companyElement);
            const location = extractText(locationElement);
            
            // Additional validation for new UI structure
            if (jobTitle === 'N/A' || companyName === 'N/A') {
                // Try alternative extraction methods for new UI
                const alternativeTitle = jobCard.querySelector('.job-card-job-posting-card-wrapper__title')?.innerText?.trim();
                const alternativeCompany = jobCard.querySelector('.artdeco-entity-lockup__subtitle')?.innerText?.trim();
                
                if (alternativeTitle && jobTitle === 'N/A') {
                    console.log('[ResumeHub] Using alternative title extraction');
                }
                if (alternativeCompany && companyName === 'N/A') {
                    console.log('[ResumeHub] Using alternative company extraction');
                }
                
                const finalTitle = alternativeTitle || jobTitle;
                const finalCompany = alternativeCompany || companyName;
                if (finalTitle === 'N/A' || finalCompany === 'N/A') {
                    const cardHtml = (jobCard.outerHTML || '').substring(0, 1500);
                    chrome.runtime.sendMessage({
                        action: 'telemetry',
                        eventType: 'ui_extraction_failed',
                        metadata: { 
                            domain: 'linkedin.com', 
                            url: window.location.href, 
                            source: 'job_search', 
                            extractedTitle: finalTitle, 
                            extractedCompany: finalCompany,
                            cardHtml: cardHtml
                        }
                    });
                }
                return {
                    jobTitle: finalTitle,
                    companyName: finalCompany,
                    location,
                    jobUrl
                };
            }

            console.log('[ResumeHub] Extracted job data:', { jobTitle, companyName, location, jobUrl });
            return { jobTitle, companyName, location, jobUrl };
        } catch (error) {
            console.warn('[ResumeHub] Could not extract data from a job card.', { error: error.message });
            return null;
        }
    }

    _shouldSkipCard(card) {
        const cls = `${card.className || ''}`.toString().toLowerCase();
        const skipTokens = ['skeleton', 'loading', 'placeholder', 'shimmer', 'ghost', 'promo', 'advert', 'ad-banner', 'ads-', 'sponsored'];
        if (skipTokens.some((t) => cls.includes(t))) return true;
        try {
            if (card.matches?.('[data-ad], [data-promoted], .ad-entity, .jobs-search-results__feedback')) return true;
        } catch (_) { /* ignore */ }
        if ((card.textContent || '').trim().length < 5) return true;
        return false;
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
        
        let targetContainer = findElement(SELECTORS.JOB_SEARCH_PAGE.cardActionsContainer);
        
        // Enhanced container finding for new UI
        if (!targetContainer) {
            // Try specific new UI containers in order of preference
            const newUIContainers = [
                '.artdeco-entity-lockup__metadata:last-child', // Best placement - after job insights
                '.artdeco-entity-lockup__metadata:has(.job-card-job-posting-card-wrapper__footer-items)', // Metadata with footer items
                '.job-card-job-posting-card-wrapper__content .flex-grow-1', // Inside main content
                '.artdeco-entity-lockup__metadata', // Any metadata section
                '.job-card-job-posting-card-wrapper__content', // Main content wrapper
                '.artdeco-entity-lockup' // Entity lockup container
            ];
            
            for (const selector of newUIContainers) {
                const containers = card.querySelectorAll(selector);
                if (containers.length > 0) {
                    // For metadata sections, prefer the last one (usually contains footer items)
                    targetContainer = containers[containers.length - 1];
                    console.log(`[ResumeHub] Found new UI container with selector: ${selector} (${containers.length} found, using last)`);
                    break;
                }
            }
        }
        
        // Fallback: use location element's parent container to prevent layout shifts/flex squeezing
        if (!targetContainer) {
            const locationEl = findElement(SELECTORS.JOB_SEARCH_PAGE.location);
            if (locationEl && locationEl.parentElement) {
                targetContainer = locationEl.parentElement;
                console.log('[ResumeHub] Using location element parent as target container');
            }
        }
        
        if (targetContainer) {
            const existing = targetContainer.querySelector(`.${SELECTORS.SALARY_BADGE.container}`);
            const jobId = this._normalizeJobUrl(jobData.jobUrl);
            if (existing && this.badgeInstances.has(jobId)) {
                return; // Badge already exists
            }
            if (existing) existing.remove();
            console.log(`[ResumeHub] Creating salary badge for: ${jobData.jobUrl}`);
            const badge = new SalaryBadge(targetContainer, jobData.jobUrl);
            this.jobDataMap.set(jobId, jobData);
            badge.create();
            this.badgeInstances.set(jobId, badge);
        } else {
            // Try to inject the badge in a fallback location
            const fallbackContainers = [
                '.job-card-job-posting-card-wrapper',
                '.job-card-container',
                card
            ];
            
            for (const fallbackContainer of fallbackContainers) {
                const container = typeof fallbackContainer === 'string' 
                    ? card.querySelector(fallbackContainer) 
                    : fallbackContainer;
                    
                if (container) {
                    console.log(`[ResumeHub] Using fallback container for: ${jobData.jobUrl}`);
                    const badge = new SalaryBadge(container, jobData.jobUrl);
                    this.jobDataMap.set(this._normalizeJobUrl(jobData.jobUrl), jobData);
                    badge.create();
                    this.badgeInstances.set(this._normalizeJobUrl(jobData.jobUrl), badge);
                    break;
                }
            }
        }
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
            // Handle both old and new URL formats
            let match = url.match(/\/jobs\/view\/(\d+)/); // Old format
            if (match) return match[1];
            
            match = url.match(/currentJobId=(\d+)/); // New format
            if (match) return match[1];
            
            match = url.match(/jobId=(\d+)/); // Alternative new format
            if (match) return match[1];
            
            return url;
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
