/**
 * Shared SPA navigation helpers for job-board content scripts.
 * Patches history once and provides a single URL-watch mechanism.
 */

/**
 * Patch history.pushState / replaceState once per page to emit `locationchange`.
 */
export function patchHistoryOnce() {
    if (window.__rhHistoryPatched) return;
    const patch = (method) => {
        const original = history[method];
        history[method] = (...args) => {
            const result = original.apply(history, args);
            window.dispatchEvent(new Event('locationchange'));
            return result;
        };
    };
    patch('pushState');
    patch('replaceState');
    window.__rhHistoryPatched = true;
}

/**
 * Wire popstate / hashchange / locationchange (+ optional click) to a callback.
 * @returns {Function} cleanup
 */
export function bindNavigationEvents(onNavigate, { includeClicks = true } = {}) {
    const handler = () => onNavigate();
    window.addEventListener('popstate', handler);
    window.addEventListener('hashchange', handler);
    window.addEventListener('locationchange', handler);
    if (includeClicks) {
        document.addEventListener('click', handler, true);
    }
    return () => {
        window.removeEventListener('popstate', handler);
        window.removeEventListener('hashchange', handler);
        window.removeEventListener('locationchange', handler);
        if (includeClicks) {
            document.removeEventListener('click', handler, true);
        }
    };
}

/**
 * Lightweight URL poller as a safety net when SPA routers bypass history APIs.
 * Cheaper than a full document.body MutationObserver for URL-only tracking.
 * @returns {Function} cleanup
 */
export function startUrlPoll(getCurrentUrl, onUrlChange, intervalMs = 1000) {
    let last = getCurrentUrl();
    const id = setInterval(() => {
        const now = getCurrentUrl();
        if (now !== last) {
            last = now;
            onUrlChange(now);
        }
    }, intervalMs);
    return () => clearInterval(id);
}

/**
 * Base SPA controller mixin helpers for job sites.
 */
export class SpaPageController {
    constructor() {
        this.pageHandler = null;
        this.currentPageType = null;
        this.currentUrl = window.location.href;
        this.initializationTimeout = null;
        this._navCleanup = null;
        this._pollCleanup = null;
    }

    setupSpaNavigation({ includeClicks = false, useDomObserver = false, onUrlChange = null } = {}) {
        patchHistoryOnce();
        const handle = () => {
            setTimeout(() => {
                if (window.location.href !== this.currentUrl) {
                    this.currentUrl = window.location.href;
                    if (typeof onUrlChange === 'function') onUrlChange(this.currentUrl);
                    this.debouncedInitialize();
                }
            }, 300);
        };
        // Default off: per-click listeners race history and fire on every LinkedIn interaction.
        // pushState patch + 1s URL poll already catch SPA navigations.
        this._navCleanup = bindNavigationEvents(handle, { includeClicks });
        // Prefer cheap polling over a body-wide MutationObserver for URL detection
        this._pollCleanup = startUrlPoll(
            () => window.location.href,
            (url) => {
                this.currentUrl = url;
                if (typeof onUrlChange === 'function') onUrlChange(url);
                this.debouncedInitialize();
            },
            1000
        );
        // Optional legacy DOM observer (off by default)
        if (useDomObserver) {
            this.mutationObserver = new MutationObserver(() => {
                if (window.location.href !== this.currentUrl) {
                    this.currentUrl = window.location.href;
                    if (typeof onUrlChange === 'function') onUrlChange(this.currentUrl);
                    this.debouncedInitialize();
                }
            });
            this.mutationObserver.observe(document.body, { childList: true, subtree: true });
        }
    }

    debouncedInitialize(delay = 250) {
        if (this.initializationTimeout) clearTimeout(this.initializationTimeout);
        this.initializationTimeout = setTimeout(() => this.initialize(), delay);
    }

    destroySpaNavigation() {
        if (this._navCleanup) this._navCleanup();
        if (this._pollCleanup) this._pollCleanup();
        if (this.mutationObserver) this.mutationObserver.disconnect();
        if (this.initializationTimeout) clearTimeout(this.initializationTimeout);
        if (this.pageHandler && typeof this.pageHandler.destroy === 'function') {
            this.pageHandler.destroy();
        }
    }

    // Subclasses must implement
    initialize() {
        throw new Error('initialize() not implemented');
    }
}
