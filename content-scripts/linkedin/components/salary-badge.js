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
     * Injects CSS styles for the salary badge to match LinkedIn's design system.
     */
    injectStyles() {
        if (document.getElementById('resumehub-salary-badge-styles')) return;

        const style = document.createElement('style');
        style.id = 'resumehub-salary-badge-styles';
        style.textContent = `
            .${SELECTORS.SALARY_BADGE.container} {
                margin-top: 4px;
                margin-bottom: 4px;
            }
            
            .${SELECTORS.SALARY_BADGE.badge} {
                display: block;
                padding: 6px 8px;
                background-color: #f3f2ef;
                border: 1px solid #e0ddd6;
                border-radius: 4px;
                font-size: 11px;
                font-weight: 400;
                color: #666666;
                line-height: 1.4;
                transition: all 0.15s ease-in-out;
            }
            
            .${SELECTORS.SALARY_BADGE.badge}:hover {
                background-color: #e9e5df;
                border-color: #d0ccc0;
            }
            
            .rh-tc-line {
                font-weight: 600;
                color: #0a66c2;
                margin-bottom: 2px;
            }
            
            .rh-breakdown-line {
                color: #666666;
                margin-bottom: 2px;
            }
            
            .rh-source-line {
                color: #999999;
                font-size: 10px;
            }
            
            .${SELECTORS.SALARY_BADGE.loading} {
                display: block;
                padding: 6px 8px;
                background-color: #f3f2ef;
                border: 1px solid #e0ddd6;
                border-radius: 4px;
                font-size: 11px;
                color: #666666;
                line-height: 1.4;
                position: relative;
            }
            
            .${SELECTORS.SALARY_BADGE.loading}::after {
                content: '';
                width: 8px;
                height: 8px;
                border: 1px solid #666666;
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
            
            @keyframes resumehub-spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Creates and injects the initial loading state of the badge.
     */
    create() {
        // Create a div to be placed in the caption area
        this.container = document.createElement('div');
        this.container.className = `${SELECTORS.SALARY_BADGE.container}`;
        this.container.setAttribute('data-job-url', this.jobUrl);

        // Loading state without icons
        const spinner = document.createElement('div');
        spinner.className = SELECTORS.SALARY_BADGE.loading;
        spinner.innerHTML = 'TC: Estimating... | Source: ResumeHub';
        this.container.appendChild(spinner);
        
        this.parentElement.appendChild(this.container);
    }

    /**
     * Updates the badge to show the estimated salary.
     * @param {object} salaryData - The salary data object.
     * @param {string} salaryData.totalCompensation - The total compensation range.
     * @param {string} salaryData.base - The base salary range.
     * @param {string} salaryData.bonus - The bonus range.
     * @param {string} salaryData.stock - The stock/ESOP range.
     * @param {string} salaryData.confidence - The confidence level.
     * @param {string} salaryData.currency - The currency symbol.
     */
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

    /**
     * Updates the badge to show an error message.
     * @param {string} [message='N/A'] - The error message to display.
     */
    showError(message = 'N/A') {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <div class="${SELECTORS.SALARY_BADGE.badge} ${SELECTORS.SALARY_BADGE.error}" title="${message}">
                TC: ${message} | Source: ResumeHub
            </div>
        `;
    }

    /**
     * Removes the badge from the DOM.
     */
    remove() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}