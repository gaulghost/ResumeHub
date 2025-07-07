export const SELECTORS = {
  // Selectors for the job search page (e.g., /jobs/search/)
  JOB_SEARCH_PAGE: {
    jobListItem: 'li[data-occludable-job-id]',
    jobTitle: [
      '.job-card-list__title--link strong',
      '.job-card-list__title--link .visually-hidden', 
      'strong[aria-hidden="true"]',
      '.job-card-list__title strong',
      '.job-card-container__link strong'
    ],
    companyName: [
      '.artdeco-entity-lockup__subtitle span',
      '.job-card-container__company-name',
      '.job-card-list__company-name',
      'span.xFDDaasyWPZKoJblQZMMDPQXlHAnkGiQ'
    ],
    location: [
      '.job-card-container__metadata-wrapper span',
      '.job-card-list__footer-wrapper span',
      '.job-card-container__metadata span'
    ],
    jobUrl: [
      '.job-card-list__title--link',
      '.job-card-container__link',
      'a[href*="/jobs/view/"]'
    ],
    cardActionsContainer: [
      '.artdeco-entity-lockup__caption',
      '.job-card-list__footer-wrapper',
      '.job-card-container__footer-wrapper'
    ],
  },
  // Selectors for the individual job view page (e.g., /jobs/view/)
  JOB_DETAILS_PAGE: {
    jobTitle: '.t-24.t-bold.jobs-unified-top-card__job-title',
    companyInfo: '.jobs-unified-top-card__primary-description',
    jobDescription: '.jobs-description-content__text',
    // Container to inject analysis panel
    detailsPanelContainer: '.jobs-details__main-content'
  },
  // Our custom UI elements
  SALARY_BADGE: {
    container: 'rh-salary-badge-container',
    badge: 'rh-salary-badge',
    loading: 'rh-loading-spinner',
    error: 'rh-error-message',
    retryBtn: 'rh-retry-btn',
  },
};
