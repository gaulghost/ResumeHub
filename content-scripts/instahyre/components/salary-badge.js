import { SELECTORS } from '../config/selectors.js';

export class SalaryBadge {
    /**
     * @param {HTMLElement} parentElement - The DOM element to which the badge will be appended.
     * @param {string} jobUrl - The unique URL for the job, used as an identifier.
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

    /**
     * Injects CSS styles for the salary badge to match Instahyre's design system (typically green/teal accents).
     */
    injectStyles() {
        if (document.getElementById('resumehub-instahyre-salary-badge-styles')) return;

        const style = document.createElement('style');
        style.id = 'resumehub-instahyre-salary-badge-styles';
        style.textContent = `
            .${SELECTORS.SALARY_BADGE.container} {
                margin-top: 6px;
                margin-bottom: 6px;
                display: inline-block;
                width: 100%;
            }
            
            .${SELECTORS.SALARY_BADGE.badge} {
                display: block;
                padding: 6px 10px;
                background-color: #f6fcf9;
                border: 1px solid #ccece0;
                border-radius: 6px;
                font-size: 11px;
                font-weight: 400;
                color: #2e5b4b;
                line-height: 1.4;
                transition: all 0.15s ease-in-out;
            }
            
            .${SELECTORS.SALARY_BADGE.badge}:hover {
                background-color: #ebf7f1;
                border-color: #b3dfcd;
            }
            
            .rh-tc-line {
                font-weight: 600;
                color: #1ba974; /* Instahyre Green */
                margin-bottom: 2px;
            }
            
            .rh-breakdown-line {
                color: #555555;
                margin-bottom: 2px;
            }
            
            .rh-source-line {
                color: #888888;
                font-size: 10px;
            }
            
            .${SELECTORS.SALARY_BADGE.loading} {
                display: block;
                padding: 6px 10px;
                background-color: #f6fcf9;
                border: 1px solid #ccece0;
                border-radius: 6px;
                font-size: 11px;
                color: #555555;
                line-height: 1.4;
                position: relative;
            }
            
            .${SELECTORS.SALARY_BADGE.loading}::after {
                content: '';
                width: 8px;
                height: 8px;
                border: 1px solid #2e5b4b;
                border-top: 1px solid transparent;
                border-radius: 50%;
                animation: resumehub-spin 1s linear infinite;
                margin-left: 4px;
                display: inline-block;
                vertical-align: middle;
            }
            
            .${SELECTORS.SALARY_BADGE.error} {
                background-color: #fff2f0;
                border-color: #ffccc7;
                color: #cf1322;
            }
            
            .${SELECTORS.SALARY_BADGE.retryBtn} {
                background: none;
                border: none;
                color: #1ba974;
                cursor: pointer;
                text-decoration: underline;
                font-size: 11px;
                padding: 0;
                margin-left: 4px;
            }
            
            @keyframes resumehub-spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }

    create() {
        if (!this.parentElement?.isConnected) {
            console.warn('[ResumeHub] Parent element not available or not connected to DOM');
            return false;
        }

        const existingBadge = this.parentElement.querySelector(`.${SELECTORS.SALARY_BADGE.container}`);
        if (existingBadge) {
            existingBadge.remove();
        }

        this.container = document.createElement('div');
        this.container.className = SELECTORS.SALARY_BADGE.container;
        this.container.setAttribute('data-job-url', this.jobUrl);

        this.showLoading();
        
        try {
            this.parentElement.appendChild(this.container);
            return true;
        } catch (error) {
            console.error('[ResumeHub] Error appending salary badge to parent:', error);
            return false;
        }
    }

    showLoading() {
        if (!this.container) return;
        this.container.innerHTML = '';
        const spinner = document.createElement('div');
        spinner.className = SELECTORS.SALARY_BADGE.loading;
        spinner.innerHTML = 'TC: Estimating... | Source: ResumeHub';
        this.container.appendChild(spinner);
    }

    showSalary(salaryData) {
        if (!this.container) return;
        
        const { totalCompensation, base, bonus, stock, confidence, currency } = salaryData;
        
        const tcText = totalCompensation ? `TC: ${currency}${totalCompensation}` : 'TC: N/A';
        const confidenceText = confidence ? `Confidence: ${confidence}` : 'Confidence: Medium';
        const baseText = base ? `Base: ${currency}${base}` : 'Base: N/A';
        const bonusText = bonus ? `Bonus: ${currency}${bonus}` : 'Bonus: N/A';
        const stockText = stock ? `Stock: ${currency}${stock}` : 'Stock: N/A';

        this.container.innerHTML = `
            <div class="${SELECTORS.SALARY_BADGE.badge}" title="Estimated Compensation Breakdown">
                <div class="rh-tc-line">${tcText} | ${confidenceText}</div>
                <div class="rh-breakdown-line">${baseText} | ${bonusText} | ${stockText}</div>
                <div class="rh-source-line">Source: ResumeHub</div>
            </div>
        `;
    }

    showError(message = 'N/A') {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <div class="${SELECTORS.SALARY_BADGE.badge} ${SELECTORS.SALARY_BADGE.error}" title="${message}">
                TC: ${message}
                <button class="${SELECTORS.SALARY_BADGE.retryBtn}" data-job-url="${this.jobUrl}">Retry</button> | Source: ResumeHub
            </div>
        `;
    }

    remove() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.container = null;
    }
}
