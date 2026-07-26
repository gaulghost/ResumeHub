/**
 * Shared salary estimation + retry wiring for job-details handlers.
 */

/**
 * @param {Object} opts
 * @param {Object} opts.salaryEstimator
 * @param {Object} opts.badge
 * @param {Object} opts.jobData
 * @param {string} opts.jobUrl
 * @param {string} opts.retryBtnClass
 * @param {boolean} [opts.ignoreCache=false]
 * @param {string} [opts.logPrefix='[ResumeHub]']
 */
export async function fetchAndShowDetailsEstimate({
    salaryEstimator,
    badge,
    jobData,
    jobUrl,
    retryBtnClass,
    ignoreCache = false,
    logPrefix = '[ResumeHub]',
}) {
    try {
        const jobs = [{
            jobTitle: jobData.jobTitle,
            location: jobData.location,
            companyName: jobData.companyName,
            jobUrl,
        }];
        const estimates = await salaryEstimator.batchEstimate(jobs, { ignoreCache });
        const estimate = estimates[jobUrl] || { error: 'No data', retry: true };

        if (estimate.error) {
            badge.showError(estimate.error);
            attachDetailsRetry({
                salaryEstimator,
                badge,
                jobData,
                jobUrl,
                retryBtnClass,
                logPrefix,
            });
        } else {
            badge.showSalary(estimate);
        }
    } catch (error) {
        console.error(`${logPrefix} Error estimating salary:`, error);
        badge.showError('API Error');
        attachDetailsRetry({
            salaryEstimator,
            badge,
            jobData,
            jobUrl,
            retryBtnClass,
            logPrefix,
        });
    }
}

function attachDetailsRetry({
    salaryEstimator,
    badge,
    jobData,
    jobUrl,
    retryBtnClass,
    logPrefix,
}) {
    const btn = badge.container?.querySelector(`.${retryBtnClass}`);
    if (!btn || btn.dataset.rhRetryBound) return;
    btn.dataset.rhRetryBound = '1';
    btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        badge.showLoading();
        await fetchAndShowDetailsEstimate({
            salaryEstimator,
            badge,
            jobData,
            jobUrl,
            retryBtnClass,
            ignoreCache: true,
            logPrefix,
        });
    }, true);
}
