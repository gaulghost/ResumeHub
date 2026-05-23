export const SELECTORS = {
    // Selectors for Naukri job search results pages
    JOB_SEARCH_PAGE: {
        jobListItem: [
            ".srp-jobtuple-container",  // Modern Naukri listing cards
            "article.jobTuple",         // Legacy Naukri listing cards
            ".jobTuple",                // Alternate container
            "div[class*='min-h-'][class*='rounded-3xl']", // New UI card container
            "div.cursor-pointer.rounded-3xl"
        ],
        jobTitle: [
            "a.title",
            ".title a",
            "a[href*='/job-listings']",
            "div[class*='text-title18Sb']",
            ".text-title18Sb"
        ],
        companyName: [
            "a.subTitle",
            "a.comp-name",
            ".comp-name",
            ".companyName",
            "div[class*='text-title16Sb']",
            ".text-title16Sb"
        ],
        location: [
            "span.locWdth",
            "span.loc-wrap",
            ".loc-wrap",
            ".location"
        ],
        jobUrl: [
            "a.title",
            ".title a",
            "a[href*='/job-listings']"
        ],
        cardActionsContainer: [
            ".job-info",
            ".jobTupleHeader",
            ".srp-jobtuple-container",
            ".jobTuple"
        ]
    },
    // Selectors for Naukri individual job details pages
    JOB_DETAILS_PAGE: {
        jobTitle: [
            "h1.jd-header-title",
            ".jd-header-title",
            "h1.title",
            ".job-desc-title"
        ],
        companyInfo: [
            "a.pad-rt-8",
            ".jd-header-comp-name",
            ".comp-info-detail a"
        ],
        jobDescription: [
            ".job-desc",
            "section.job-desc",
            ".jd-description",
            "#job-desc"
        ],
        detailsPanelContainer: [
            "section.jd-header",
            ".jd-header",
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
