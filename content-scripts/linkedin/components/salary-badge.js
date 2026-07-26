import { SELECTORS } from '../config/selectors.js';
import { createSalaryBadgeClass } from '../../shared/salary-badge-base.js';

const S = SELECTORS.SALARY_BADGE;

export const SalaryBadge = createSalaryBadgeClass({
    styleId: 'resumehub-salary-badge-styles',
    domain: 'linkedin.com',
    selectors: S,
    themeCss: (sel) => `
        .${sel.container} {
            margin-top: 8px;
            margin-bottom: 4px;
            width: 100% !important;
            flex-basis: 100% !important;
        }
        .${sel.badge} {
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
        .${sel.badge}:hover {
            background-color: #e9e5df;
            border-color: #d0ccc0;
        }
        .rh-tc-line { font-weight: 600; color: #0a66c2; margin-bottom: 2px; }
        .rh-breakdown-line { color: #666666; margin-bottom: 2px; }
        .rh-source-line { color: #999999; font-size: 10px; }
        .${sel.loading} {
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
            background: none; border: none; color: #0a66c2;
            cursor: pointer; text-decoration: underline;
            font-size: 11px; padding: 0; margin-left: 4px;
        }
        @keyframes resumehub-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `,
});
