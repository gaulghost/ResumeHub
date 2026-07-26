import { SELECTORS } from '../config/selectors.js';
import { createSalaryBadgeClass } from '../../shared/salary-badge-base.js';

const S = SELECTORS.SALARY_BADGE;

export const SalaryBadge = createSalaryBadgeClass({
    styleId: 'resumehub-instahyre-salary-badge-styles',
    domain: 'instahyre.com',
    selectors: S,
    themeCss: (sel) => `
        .${sel.container} {
            margin-top: 6px;
            margin-bottom: 6px;
            display: inline-block;
            width: 100%;
        }
        .${sel.badge} {
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
        .${sel.badge}:hover {
            background-color: #ebf7f1;
            border-color: #b3dfcd;
        }
        .rh-tc-line { font-weight: 600; color: #1ba974; margin-bottom: 2px; }
        .rh-breakdown-line { color: #555555; margin-bottom: 2px; }
        .rh-source-line { color: #888888; font-size: 10px; }
        .${sel.loading} {
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
        .${sel.loading}::after {
            content: '';
            width: 8px; height: 8px;
            border: 1px solid #2e5b4b;
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
            background: none; border: none; color: #1ba974;
            cursor: pointer; text-decoration: underline;
            font-size: 11px; padding: 0; margin-left: 4px;
        }
        @keyframes resumehub-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `,
});
