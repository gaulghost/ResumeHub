export const SELECTORS = {
    // Selectors for the job search page (e.g., /jobs/search/)
    JOB_SEARCH_PAGE: {
        // Updated to handle both old and new LinkedIn UI
        jobListItem: [
            "li[data-occludable-job-id]", // Old UI
            "li.semantic-search-results-list__list-item", // New UI
            "li.scaffold-layout__list-item", // Alternative new UI
            "div[data-job-id]", // New UI with data-job-id
            "[componentkey*='job-card-component-ref-']", // New UI with componentkey
        ],
        jobTitle: [
            // New UI selectors (prioritized)
            "p[style*='--_714e7ac9'] span[aria-hidden='true']",
            "p._38a45f7f span[aria-hidden='true']",
            "p._09b65e6e span[aria-hidden='true']",
            "span._028ae6a1", // Obfuscated class for verified job title in new UI
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
            "p.bec82545", // Obfuscated class for company name in new UI
            "div._3d2f5c77 p", // Obfuscated layout for company name in new UI
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
            "p._354585b3", // Obfuscated class for location in new UI
            "p._78ccd462", // Obfuscated class for location in new UI
            "p._3d2f5c77", // Obfuscated class for location in new UI
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
            "div.c3a4baa6", // Obfuscated footer container class in new UI
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
            // New LinkedIn UI (2025+) - LazyColumn layout
            // Title is an <a href='/jobs/view/...'> inside a <p> inside the detail column
            "[data-testid='lazy-column'] p a[href*='/jobs/view/']",
            "[data-component-type='LazyColumn'] p a[href*='/jobs/view/']",
            // Current/old standard selectors
            ".jobs-unified-top-card__job-title",
            ".jobs-unified-top-card__job-title a",
            "h1.t-24.t-bold",
            'h1[data-test-id="job-title"]',
            // Additional selectors for potential new UI
            ".job-details-jobs-unified-top-card__job-title",
            ".artdeco-entity-lockup__title",
            // New UI from user HTML - more generic
            "div[data-view-name='job-detail-page'] .job-details-jobs-unified-top-card__job-title h1",
            "div[data-view-name='job-detail-page'] h1",
            "div[data-view-name='job-detail-page'] a[href*='/jobs/view/']",
            ".scaffold-layout__detail h1",
            ".scaffold-layout__detail h2",
            ".jobs-search__job-details h1",
            // Generic fallback: any <a> directly linking to a jobs/view page in the detail panel
            'a[href*="/jobs/view/"][href*="trackingId"]',
        ],
        companyInfo: [
            // New LinkedIn UI (2025+) - company name is an <a> inside a <p> inside aria-label div
            "div[aria-label^='Company,'] a",
            // New UI: LazyColumn layout - company link
            "[data-testid='lazy-column'] a[href*='/company/']",
            "[data-component-type='LazyColumn'] a[href*='/company/']",
            // Restoring this as it's needed for some layouts
            "div[aria-label^='Company,']",
            
            // Old/Standard UI
            ".job-details-jobs-unified-top-card__company-name a",
            ".job-details-jobs-unified-top-card__company-name",
            ".artdeco-entity-lockup__subtitle",
            
            // Fallback/Older selectors
            ".job-details-jobs-unified-top-card__primary-description",
            ".jobs-unified-top-card__primary-description",
            ".jobs-unified-top-card__primary-description-without-tagline",
            ".jobs-unified-top-card__company-name",
            ".jobs-unified-top-card__subtitle",
            ".scaffold-layout__detail [class*='company-name']",
            ".scaffold-layout__detail a[href*='/company/']",
            ".jobs-search__job-details a[href*='/company/']",
        ],
        jobDescription: [
            // Current selectors
            ".jobs-description-content__text",
            ".jobs-description__content",
            ".jobs-box__html-content",
            // Additional selectors for potential new UI
            ".job-details-description__text",
            ".jobs-description-content",
            ".jobs-description",
            ".job-details-description",
            ".jobs-description__container",
        ],
        // Container to inject analysis panel
        detailsPanelContainer: [
            // New LinkedIn UI (2025+) - LazyColumn is the main detail container
            "[data-testid='lazy-column'][data-component-type='LazyColumn']",
            "[data-component-type='LazyColumn']",
            // Current selectors
            ".jobs-details__main-content",
            ".jobs-unified-top-card__content--two-pane",
            ".jobs-unified-top-card__content",
            ".jobs-details",
            // Additional selectors for potential new UI
            ".job-details-jobs-unified-top-card",
            ".jobs-details-top-card",
            // New UI from user HTML
            "div[data-view-name='job-detail-page']",
            ".scaffold-layout__detail",
            ".jobs-search__job-details--container",
            ".jobs-search__job-details",
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
