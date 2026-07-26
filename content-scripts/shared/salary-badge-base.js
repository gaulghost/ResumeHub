/**
 * Shared salary badge behavior. Site modules supply theme CSS + style element id.
 */

export function createSalaryBadgeClass({ styleId, themeCss, selectors, domain = 'unknown' }) {
    return class SalaryBadge {
        /**
         * @param {HTMLElement} parentElement
         * @param {string} jobUrl
         */
        constructor(parentElement, jobUrl) {
            if (!parentElement) {
                throw new Error('[ResumeHub] SalaryBadge requires a parent element.');
            }
            this.parentElement = parentElement;
            this.jobUrl = jobUrl;
            this.container = null;
            this.injectStyles();
        }

        injectStyles() {
            if (document.getElementById(styleId)) return;
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = themeCss(selectors);
            document.head.appendChild(style);
        }

        create() {
            if (!this.parentElement?.isConnected) {
                console.warn('[ResumeHub] Parent element not available or not connected to DOM');
                try {
                    chrome.runtime.sendMessage({
                        action: 'telemetry',
                        eventType: 'ui_extraction_failed',
                        metadata: {
                            domain,
                            url: window.location.href,
                            source: 'salary_badge_mount',
                            detail: 'Parent element not connected to DOM',
                            cardHtml: (this.parentElement?.outerHTML || '').substring(0, 1500)
                        }
                    });
                } catch (err) {
                    console.warn('[ResumeHub] Telemetry message failed to send:', err);
                }
                return false;
            }

            const existingBadge = this.parentElement.querySelector(`.${selectors.container}`);
            if (existingBadge) existingBadge.remove();

            this.container = document.createElement('div');
            this.container.className = selectors.container;
            this.container.setAttribute('data-job-url', this.jobUrl);
            this.showLoading();

            try {
                this.parentElement.appendChild(this.container);
                return true;
            } catch (error) {
                console.error('[ResumeHub] Error appending salary badge to parent:', error);
                try {
                    chrome.runtime.sendMessage({
                        action: 'telemetry',
                        eventType: 'ui_extraction_failed',
                        metadata: {
                            domain,
                            url: window.location.href,
                            source: 'salary_badge_mount',
                            detail: `Append child failed: ${error.message || error}`,
                            cardHtml: (this.parentElement?.outerHTML || '').substring(0, 1500)
                        }
                    });
                } catch (err) {
                    console.warn('[ResumeHub] Telemetry message failed to send:', err);
                }
                return false;
            }
        }

        showLoading() {
            if (!this.container) return;
            this.container.innerHTML = '';
            const spinner = document.createElement('div');
            spinner.className = selectors.loading;
            spinner.textContent = 'TC: Estimating... | Source: ResumeHub';
            this.container.appendChild(spinner);
        }

        showSalary(salaryData) {
            if (!this.container) return;

            const { totalCompensation, base, bonus, stock, confidence, currency } = salaryData || {};
            const cur = currency != null ? String(currency) : '';

            const tcText = totalCompensation ? `TC: ${cur}${totalCompensation}` : 'TC: N/A';
            const confidenceText = confidence ? `Confidence: ${confidence}` : 'Confidence: Medium';
            const baseText = base ? `Base: ${cur}${base}` : 'Base: N/A';
            const bonusText = bonus ? `Bonus: ${cur}${bonus}` : 'Bonus: N/A';
            const stockText = stock ? `Stock: ${cur}${stock}` : 'Stock: N/A';

            this.container.replaceChildren();
            const badge = document.createElement('div');
            badge.className = selectors.badge;
            badge.title = 'Estimated Compensation Breakdown';

            const tcLine = document.createElement('div');
            tcLine.className = 'rh-tc-line';
            tcLine.textContent = `${tcText} | ${confidenceText}`;

            const breakdown = document.createElement('div');
            breakdown.className = 'rh-breakdown-line';
            breakdown.textContent = `${baseText} | ${bonusText} | ${stockText}`;

            const source = document.createElement('div');
            source.className = 'rh-source-line';
            source.textContent = 'Source: ResumeHub';

            badge.append(tcLine, breakdown, source);
            this.container.appendChild(badge);
        }

        showError(message = 'N/A') {
            if (!this.container) return;

            const safeMessage = String(message ?? 'N/A');
            this.container.replaceChildren();

            const badge = document.createElement('div');
            badge.className = `${selectors.badge} ${selectors.error}`;
            badge.title = safeMessage;
            badge.appendChild(document.createTextNode(`TC: ${safeMessage} `));

            const btn = document.createElement('button');
            btn.className = selectors.retryBtn;
            btn.dataset.jobUrl = this.jobUrl || '';
            btn.type = 'button';
            btn.textContent = 'Retry';
            badge.appendChild(btn);
            badge.appendChild(document.createTextNode(' | Source: ResumeHub'));

            this.container.appendChild(badge);
        }

        remove() {
            if (this.container && this.container.parentNode) {
                this.container.parentNode.removeChild(this.container);
            }
            this.container = null;
        }
    };
}
