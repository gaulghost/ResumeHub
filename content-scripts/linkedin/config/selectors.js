export const SELECTORS = {
    // Selectors for the job search page (e.g., /jobs/search/)
    JOB_SEARCH_PAGE: {
        // Updated to handle both old and new LinkedIn UI
        jobListItem: [
            "li[data-occludable-job-id]", // Old UI
            "li.semantic-search-results-list__list-item", // New UI
            "li.scaffold-layout__list-item", // Alternative new UI
            "div[data-job-id]", // New UI with data-job-id
        ],
        jobTitle: [
            // New UI selectors (prioritized)
            ".artdeco-entity-lockup__title strong",
            ".job-card-job-posting-card-wrapper__title strong",
            ".artdeco-entity-lockup__title span[aria-hidden='true'] strong",
            // Old UI selectors (fallback)
            ".job-card-list__title--link strong",
            ".job-card-list__title--link .visually-hidden",
            'strong[aria-hidden="true"]',
            ".job-card-list__title strong",
            ".job-card-container__link strong",
        ],
        companyName: [
            // New UI selectors (prioritized)
            ".artdeco-entity-lockup__subtitle div",
            ".artdeco-entity-lockup__subtitle",
            // Old UI selectors (fallback)
            ".artdeco-entity-lockup__subtitle span",
            ".job-card-container__company-name",
            ".job-card-list__company-name",
            "span.xFDDaasyWPZKoJblQZMMDPQXlHAnkGiQ",
        ],
        location: [
            // New UI selectors (prioritized)
            ".artdeco-entity-lockup__caption div",
            ".artdeco-entity-lockup__caption",
            // Old UI selectors (fallback)
            ".job-card-container__metadata-wrapper span",
            ".job-card-list__footer-wrapper span",
            ".job-card-container__metadata span",
        ],
        jobUrl: [
            // New UI selectors (prioritized)
            ".job-card-job-posting-card-wrapper__card-link",
            "a.LmfeiLKoocWbXCNApouwKExPrfRknwNE",
            // Old UI selectors (fallback)
            ".job-card-list__title--link",
            ".job-card-container__link",
            'a[href*="/jobs/view/"]',
            'a[href*="/jobs/search-results/"]', // New UI URLs
            'a[href*="currentJobId="]', // New UI URLs with currentJobId parameter
        ],
        cardActionsContainer: [
            // New UI selectors (prioritized) - more specific targeting
            ".artdeco-entity-lockup__metadata:last-child",
            ".artdeco-entity-lockup__metadata:has(.job-card-job-posting-card-wrapper__footer-items)",
            ".job-card-job-posting-card-wrapper__footer-items",
            ".artdeco-entity-lockup__caption",
            ".job-card-job-posting-card-wrapper__content .flex-grow-1",
            ".artdeco-entity-lockup__metadata",
            // Old UI selectors (fallback)
            ".job-card-list__footer-wrapper",
            ".job-card-container__footer-wrapper",
        ],
    },
    // Selectors for the individual job view page (e.g., /jobs/view/)
    JOB_DETAILS_PAGE: {
        jobTitle: [
            // Current selectors
            ".jobs-unified-top-card__job-title",
            ".jobs-unified-top-card__job-title a",
            "h1.t-24.t-bold",
            'h1[data-test-id="job-title"]',
            // Additional selectors for potential new UI
            ".job-details-jobs-unified-top-card__job-title",
            ".artdeco-entity-lockup__title",
        ],
        companyInfo: [
            // Current selectors
            ".jobs-unified-top-card__primary-description",
            ".jobs-unified-top-card__primary-description-without-tagline",
            ".jobs-unified-top-card__company-name",
            ".jobs-unified-top-card__subtitle",
            // Additional selectors for potential new UI
            ".job-details-jobs-unified-top-card__primary-description",
            ".artdeco-entity-lockup__subtitle",
        ],
        jobDescription: [
            // Current selectors
            ".jobs-description-content__text",
            ".jobs-description__content",
            ".jobs-box__html-content",
            // Additional selectors for potential new UI
            ".job-details-description__text",
            ".jobs-description-content",
        ],
        // Container to inject analysis panel
        detailsPanelContainer: [
            // Current selectors
            ".jobs-details__main-content",
            ".jobs-unified-top-card__content--two-pane",
            ".jobs-unified-top-card__content",
            ".jobs-details",
            // Additional selectors for potential new UI
            ".job-details-jobs-unified-top-card",
            ".jobs-details-top-card",
        ],
    },
    // Our custom UI elements
    SALARY_BADGE: {
        container: "rh-salary-badge-container",
        badge: "rh-salary-badge",
        loading: "rh-loading-spinner",
        error: "rh-error-message",
        retryBtn: "rh-retry-btn",
    },
};
