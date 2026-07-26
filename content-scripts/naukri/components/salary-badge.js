import { SELECTORS } from '../config/selectors.js';
import { createSalaryBadgeClass } from '../../shared/salary-badge-base.js';

const S = SELECTORS.SALARY_BADGE;

export const SalaryBadge = createSalaryBadgeClass({
    styleId: 'resumehub-naukri-salary-badge-styles',
    domain: 'naukri.com',
    selectors: S,
    themeCss: (sel) => `
        .${sel.container} {
            margin-top: 6px;
            margin-bottom: 6px;
            display: block !important;
            width: 100% !important;
            flex-basis: 100% !important;
        }
        .cust-job-tuple .row3,
        .srp-jobtuple-wrapper .row3,
        .srp-jobtuple-container .row3 {
            display: flex !important;
            flex-direction: column !important;
            align-items: flex-start !important;
        }
        .${sel.badge} {
            display: block;
            padding: 6px 10px;
            background-color: #f7f9fa;
            border: 1px solid #e1e5e8;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 400;
            color: #4a545e;
            line-height: 1.4;
            transition: all 0.15s ease-in-out;
        }
        .${sel.badge}:hover {
            background-color: #eff2f4;
            border-color: #cbd2d6;
        }
        .rh-tc-line { font-weight: 600; color: #4a90e2; margin-bottom: 2px; }
        .rh-breakdown-line { color: #666666; margin-bottom: 2px; }
        .rh-source-line { color: #999999; font-size: 10px; }
        .${sel.loading} {
            display: block;
            padding: 6px 10px;
            background-color: #f7f9fa;
            border: 1px solid #e1e5e8;
            border-radius: 6px;
            font-size: 11px;
            color: #666666;
            line-height: 1.4;
            position: relative;
        }
        .${sel.loading}::after {
            content: '';
            width: 8px; height: 8px;
            border: 1px solid #666666;
            border-top: 1px solid transparent;
            border-radius: 50%;
            animation: resumehub-spin 1s linear infinite;
            margin-left: 4px;
            display: inline-block;
            vertical-align: middle;
        }
        .${sel.error} {
            background-color: #fff2f0;
            border-color: #ffccc7;
            color: #cf1322;
        }
        .${sel.retryBtn} {
            background: none; border: none; color: #4a90e2;
            cursor: pointer; text-decoration: underline;
            font-size: 11px; padding: 0; margin-left: 4px;
        }
        @keyframes resumehub-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `,
});
