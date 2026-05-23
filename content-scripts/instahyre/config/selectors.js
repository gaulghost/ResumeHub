export const SELECTORS = {
    // Selectors for Instahyre job search result listings
    JOB_SEARCH_PAGE: {
        jobListItem: [
            ".employer-block",        // Main employer block container
            ".opportunity-card",      // Main Instahyre job listing card selector
            ".job-card",              // Alternate selector
            "[id^='opportunity-']"    // Opportunity container ID patterns
        ],
        jobTitle: [
            ".position",
            "h4.position",
            "h3.position",
            ".job-title",
            ".employer-job-name",
            ".company-name"
        ],
        companyName: [
            ".company-name",
            ".company",
            "span.company-name",
            ".employer-company-name"
        ],
        location: [
            ".location",
            ".job-loc",
            "span.loc",
            ".employer-locations"
        ],
        jobUrl: [
            "a[href*='/jobs/']",
            "a[href*='/opportunity/']",
            "a"
        ],
        cardActionsContainer: [
            ".opportunity-action-links",
            ".opportunity-card",
            ".job-card",
            ".opp-card-actions",
            ".opportunity-card .flex" // Injects inside card layout flex container
        ]
    },
    // Selectors for Instahyre individual job details pages
    JOB_DETAILS_PAGE: {
        jobTitle: [
            ".position",
            "h1.position",
            "h1",
            ".job-detail-title"
        ],
        companyInfo: [
            ".company-name",
            ".company",
            ".company-name a",
            ".opp-header-company"
        ],
        jobDescription: [
            ".job-description",
            "#job-description",
            ".opp-details",
            ".job-desc"
        ],
        detailsPanelContainer: [
            ".job-detail",
            ".opp-details",
            "main",
            "#root"
        ]
    },
    // Custom UI elements CSS classes
    SALARY_BADGE: {
        container: "rh-salary-badge-container",
        badge: "rh-salary-badge",
        loading: "rh-loading-spinner",
        error: "rh-error-message",
        retryBtn: "rh-retry-btn"
    }
};
