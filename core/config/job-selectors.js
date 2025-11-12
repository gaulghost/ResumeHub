/**
 * Centralized Job Description Extraction Selectors
 * Used by both background.js and script-injector.js to ensure consistency
 */

export const JOB_DESCRIPTION_SELECTORS = [
  // Common High-Level Containers
  '#job-description', 
  '.job-description',
  '[class*="job-details"]', 
  '[class*="jobDescription"]', 
  '[class*="jobdesc"]',
  '[aria-label*="description"]', 
  '[data-testid*="description"]',
  // Specific Job Boards
  '.jobsearch-JobComponent-description', // Indeed
  '.jobs-description-content__text', // LinkedIn
  '#job_details', // LinkedIn (alternative)
  '.jobdesciptioncontent', 
  '.jobDescriptionContent', // Greenhouse
  'section[data-qa="job-description"]', // Lever
  '.job-details-content', // SmartRecruiters
  '.ats-description-wrapper', // Ashby
  // Generic Content Areas
  '.content .description', 
  'article .job-body'
];

