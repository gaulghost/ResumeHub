/**
 * Salary Parser Utility
 * Extracts numeric salary value from salary string for threshold comparison
 */

import { CONSTANTS } from '../core/config/constants.js';

/**
 * Parse salary string to numeric value in base units
 * Supports formats like "₹10-15L", "$100k-150k", "₹50-70L", etc.
 * @param {string} salaryStr - Salary string (e.g., "₹10-15L", "$100k-150k")
 * @returns {number|null} Numeric salary value in base units, or null if parsing fails
 */
export function parseSalaryValue(salaryStr) {
    if (!salaryStr || typeof salaryStr !== 'string') {
        return null;
    }

    // Extract numbers and unit
    const match = salaryStr.match(/([\d,]+)[\s-]*([\d,]+)?([LKMkm]|thousand|million)?/i);
    if (match) {
        let min = parseFloat(match[1].replace(/,/g, ''));
        let max = match[2] ? parseFloat(match[2].replace(/,/g, '')) : min;
        const unit = (match[3] || '').toLowerCase();
        
        // Convert to base units (same currency as threshold)
        // Threshold is stored in base units (e.g., 2600000 for 26L in INR)
        // Keep salary in same currency units for comparison
        if (unit === 'l' || unit === 'lakh') {
            return max * CONSTANTS.SALARY.CONVERSION.LAKH;
        } else if (unit === 'k' || unit === 'thousand') {
            return max * CONSTANTS.SALARY.CONVERSION.THOUSAND;
        } else if (unit === 'm' || unit === 'million') {
            return max * CONSTANTS.SALARY.CONVERSION.MILLION;
        } else if (unit.includes('cr') || unit.includes('crore')) {
            return max * CONSTANTS.SALARY.CONVERSION.CRORE;
        } else {
            // Assume already in base units
            return max;
        }
    } else {
        // Try direct number extraction
        const numMatch = salaryStr.match(/[\d,]+/);
        if (numMatch) {
            return parseFloat(numMatch[0].replace(/,/g, ''));
        }
    }
    
    return null;
}

