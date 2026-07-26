/**
 * Observe a job-list root for new cards instead of the entire document.body
 * when a stable container exists.
 *
 * Re-attaches when LinkedIn/Naukri replace the list container on pagination
 * (detached MutationObserver is a common cause of missing badges on page change).
 */

/**
 * @param {string|string[]} containerSelectors
 * @param {Document|Element} [root=document]
 * @returns {Element}
 */
export function resolveObserveRoot(containerSelectors, root = document) {
    const selectors = Array.isArray(containerSelectors)
        ? containerSelectors
        : [containerSelectors].filter(Boolean);

    for (const selector of selectors) {
        try {
            const el = root.querySelector(selector);
            if (el) return el;
        } catch (_) { /* invalid selector */ }
    }
    return document.body;
}

/**
 * @param {Object} options
 * @param {string|string[]} options.containerSelectors
 * @param {(mutations: MutationRecord[]) => boolean} options.shouldProcess
 * @param {() => void} options.onUpdate
 * @param {number} [options.delay=500]
 * @returns {MutationObserver & { disconnect: Function }}
 */
export function observeJobList({
    containerSelectors,
    shouldProcess,
    onUpdate,
    delay = 500,
}) {
    let timer = null;
    let observedRoot = null;
    let reattachTimer = null;

    const observer = new MutationObserver((mutations) => {
        if (!shouldProcess(mutations)) return;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => onUpdate(), delay);
    });

    const attach = () => {
        const root = resolveObserveRoot(containerSelectors);
        if (root === observedRoot && observedRoot?.isConnected) {
            return;
        }
        try {
            observer.disconnect();
        } catch (_) { /* ignore */ }
        observedRoot = root;
        observer.observe(root, { childList: true, subtree: true });
    };

    attach();

    // LinkedIn replaces list containers on pagination; re-bind if detached
    // or if a more specific list root appears under body.
    // Throttle onUpdate so a detached root does not re-scan every tick.
    let lastForcedUpdate = 0;
    const FORCE_UPDATE_MS = 4000;
    const maybeUpdate = () => {
        const now = Date.now();
        if (now - lastForcedUpdate < FORCE_UPDATE_MS) return;
        lastForcedUpdate = now;
        onUpdate();
    };

    reattachTimer = setInterval(() => {
        if (!observedRoot || !observedRoot.isConnected) {
            attach();
            maybeUpdate();
            return;
        }
        const preferred = resolveObserveRoot(containerSelectors);
        if (
            preferred
            && preferred !== observedRoot
            && preferred.isConnected
            && preferred !== document.body
        ) {
            attach();
            maybeUpdate();
        }
    }, 1200);

    const originalDisconnect = observer.disconnect.bind(observer);
    observer.disconnect = () => {
        if (reattachTimer) {
            clearInterval(reattachTimer);
            reattachTimer = null;
        }
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
        originalDisconnect();
    };

    return observer;
}
