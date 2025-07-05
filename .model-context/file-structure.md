# ResumeHub-v1 File and Function Structure

This document provides a detailed overview of the directory structure, files, and functions within the ResumeHub-v1 project.

## 📁 `.` (Root Directory)

-   **`background.js` (145 lines)**
    -   `initialize()` (lines 22-43): Initializes the background script, sets up API client and rate limiter.
    -   `handleBatchSalaryEstimation(request, sendResponse)` (lines 58-78): Handles batch salary estimation requests from the frontend.
    -   `handleCreateTailoredResume(request, sendResponse)` (lines 80-120): Creates a tailored resume based on job description.
    -   `chrome.runtime.onMessage.addListener(...)` (lines 135-144): Listens for messages from other parts of the extension.

-   **`popup.js` (46 lines)**
    -   `DOMContentLoaded` listener (lines 5-30): The main entry point for the popup, initializes the `AppController`.
    -   `showError(message)` (lines 35-42): Displays an error message in the UI.

-   **`build.sh` (349 lines)**
    -   `check_dependencies()` (lines 16-43): Checks for and installs required build tools.
    -   `combine_js_files()` (lines 46-86): Combines and minifies JavaScript files.
    -   `minify_css()` (lines 89-101): Minifies CSS files.
    -   `obfuscate_html()` (lines 104-180): Minifies HTML and updates script references.
    -   `add_protection()` (lines 183-214): Adds simple anti-copy protection to the build.

-   **`manifest.json` (48 lines)**: No functions.
-   **`popup.html` (141 lines)**: No functions.
-   **`README.md` (242 lines)**: No functions.
-   **`PRIVACY_POLICY.md` (48 lines)**: No functions.
-   **`package.json` (23 lines)**: No functions.
-   **`.gitignore` (14 lines)**: No functions.

## 📁 `assets`

-   `logo.png` (2901 lines)
-   `logo.svg` (4 lines)
-   `logo128.png` (22 lines)

## 📁 `content-scripts`

### 📁 `linkedin`

-   **`linkedin-controller.js` (79 lines)**
    -   `constructor()` (lines 9-15): Initializes the controller, salary estimator, and page handler.
    -   `initialize()` (lines 20-33): Initializes the controller based on the current LinkedIn page URL.
    -   `handleUrlChange()` (lines 38-52): Handles URL changes to re-initialize the controller.
    -   Self-executing async function (lines 59-78): Main execution block that initializes the controller.

#### 📁 `components`

-   **`salary-badge.js` (76 lines)**
    -   `constructor(parentElement, jobUrl)` (lines 7-14): Initializes the badge with a parent element and job URL.
    -   `create()` (lines 19-30): Creates and injects the badge with a loading spinner.
    -   `showSalary(salaryData)` (lines 36-49): Updates the badge to display the estimated salary.
    -   `showError(message)` (lines 54-63): Updates the badge to display an error message.
    -   `remove()` (lines 68-72): Removes the badge from the DOM.

#### 📁 `config`

-   **`selectors.js` (32 lines)**: No functions, contains constant object for CSS selectors.

#### 📁 `pages`

-   **`job-search-handler.js` (158 lines)**
    -   `constructor(salaryEstimator)` (lines 5-10): Initializes the handler with a salary estimator.
    -   `initialize()` (lines 12-15): Starts the observer to watch for job list changes.
    -   `startObserver()` (lines 17-40): Sets up a MutationObserver for new job cards.
    -   `processAllJobCards()` (lines 45-77): Processes all job cards to estimate salaries.
    -   `extractJobData(card, jobUrl)` (lines 83-103): Extracts structured data from a job card.
    -   `createSalaryBadge(card, jobUrl)` (lines 109-115): Creates a loading badge for a job card.
    -   `updateBadgesWithEstimates(estimates)` (lines 121-136): Updates badges with salary estimates.
    -   `updateBadgesWithError(jobs, message)` (lines 142-150): Updates badges to an error state.
    -   `disconnect()` (lines 152-156): Disconnects the MutationObserver.

#### 📁 `shared`

*(This directory is empty)*

## 📁 `css`

-   **`popup_modern.css` (652 lines)**: No functions.

## 📁 `dist`

-   `ResumeHub-v1_prod_20250629_231610.zip`
-   `ResumeHub-v1_prod_20250630_025053.zip`
-   `BUILD_README.md` (62 lines): No functions.

## 📁 `documents`

-   `COMPREHENSIVE_SYSTEM_DESIGN.md` (580 lines): No functions.
-   `LAYOUT_OPTIMIZATION_SUMMARY.md` (120 lines): No functions.

## 📁 `lib`

-   `pdfmake.min.js`: (Minified library, skipped)
-   `vfs_fonts.js`: (Font data, skipped)

## 📁 `.model-context`

-   `file-structure.md` (0 lines)
-   `project-context.md` (0 lines)
-   `technical-requirements.md` (0 lines)

## 📁 `popup`

-   **`app-controller.js` (402 lines)**
    -   `constructor()` (lines 6-10): Initializes the controller's default state.
    -   `initialize()` (lines 15-28): Starts the application initialization process.
    -   `_performInitialization()` (lines 33-54): Core logic for module loading and setup.
    -   `initializeModules()` (lines 70-100): Initializes all application modules in order.
    -   `loadInitialState()` (lines 105-110): Loads application state from storage.
    -   `initializeUI()` (lines 115-128): Sets up the UI based on loaded state.
    -   `initializeEventHandlers()` (lines 133-141): Initializes all user interaction event handlers.
    -   `finalizeInitialization()` (lines 146-168): Performs final setup tasks.
    -   `updateUIFromState()` (lines 173-206): Updates UI components to reflect current state.
    -   `validateCriticalElements()` (lines 211-227): Checks for essential UI elements in the DOM.
    -   `setupGlobalErrorHandling()` (lines 232-250): Sets up global error listeners.
    -   `performPostInitializationTasks()` (lines 255-263): Runs tasks after main initialization.
    -   `logInitializationMetrics()` (lines 268-278): Logs metrics about the initialization process.
    -   `setInitialFocus()` (lines 283-290): Sets initial focus for accessibility.
    -   `handleInitializationError(error)` (lines 295-310): Handles errors during initialization.
    -   `disableInteractiveElements()` (lines 315-322): Disables all interactive UI elements.
    -   `getStatus()` (lines 327-334): Returns the current application status.
    -   `restart()` (lines 339-361): Restarts the application for debugging.
    -   `shutdown()` (lines 366-382): Shuts down the application and cleans up.
    -   `exposeForDebugging()` (lines 387-398): Exposes the controller for debugging.

-   **`event-handlers.js` (440 lines)**
    -   `constructor(...)` (lines 6-12): Initializes with all necessary modules.
    -   `initializeAllEvents()` (lines 17-38): Master initializer for all event handlers.
    -   `initializeFileEvents()` (lines 43-91): Sets up listeners for file operations.
    -   `initializeApiTokenEvents()` (lines 96-114): Sets up listeners for the API token input.
    -   `initializeExtractionMethodEvents()` (lines 119-133): Sets up listeners for extraction method radios.
    -   `initializeProcessingEvents()` (lines 138-158): Sets up listeners for main action buttons.
    -   `initializeDownloadEvents()` (lines 163-200): Sets up listeners for download buttons.
    -   `initializeStateListeners()` (lines 205-269): Subscribes to state changes to sync UI.
    -   `initializeKeyboardShortcuts()` (lines 274-297): Sets up keyboard shortcuts for common actions.
    -   `initializeWindowEvents()` (lines 302-315): Sets up listeners for window-level events.
    -   `initializeDragAndDrop()` (lines 320-357): Implements drag and drop for file uploads.
    -   `initializeFormValidation()` (lines 362-373): Sets up simple real-time form validation.
    -   `initializeAccessibility()` (lines 378-393): Adds accessibility features.
    -   `initialize()` (lines 398-405): Main entry point to call all initializers.
    -   `cleanup()` (lines 410-415): Removes event listeners to prevent memory leaks.
    -   `getStatus()` (lines 420-427): Returns the status of the event handlers.

-   **`file-handlers.js` (597 lines)**
    -   `constructor(stateManager)` (lines 6-11): Initializes with the state manager.
    -   `handleResumeUpload(file)` (lines 16-56): Handles resume upload, validation, and storage.
    -   `readFileAsBase64(file)` (lines 71-84): Reads a file and converts it to base64.
    -   `downloadOriginalResume()` (lines 92-120): Downloads the user's original resume.
    -   `downloadGeneratedResume(format)` (lines 135-150): Downloads the tailored resume in different formats.
    -   `downloadAsText(...)` (lines 165-172): Downloads the resume as a text file.
    -   `downloadAsPdf(...)` (lines 178-189): Generates and downloads the resume as a PDF.
    -   `downloadAsDocx(...)` (lines 200-210): Downloads the resume as a DOCX file.
    -   `convertResumeJSONToText(jsonData)` (lines 220-222): Converts resume JSON to a text string.
    -   `formatSectionText(...)` (lines 227-238): Helper to format a resume section.
    -   `generatePdfDefinition(jsonData)` (lines 243-550): Creates the document definition for PDF generation.
    -   `downloadBlob(url, filename)` (lines 551-564): Triggers a download from a blob URL.
    -   `generateFilename()` (lines 568-570): Generates a timestamped filename.
    -   `getFileExtension(filename)` (lines 575-577): Gets the file extension.
    -   `isValidFileType(...)` (lines 582-584): Validates a file's type.
    -   `formatFileSize(bytes)` (lines 589-591): Formats file size into a readable string.

-   **`resume-processor.js` (402 lines)**
    -   `constructor(stateManager, uiManager)` (lines 6-9): Initializes with state and UI managers.
    -   `generateTailoredResume()` (lines 14-61): Main function to generate a tailored resume.
    -   `getJobDescriptionForGeneration()` (lines 66-86): Gets the job description for resume generation.
    -   `getMethodForStatus(jobDescription)` (lines 91-96): Gets the extraction method name for status display.
    -   `handleGenerationResponse(response)` (lines 101-114): Handles the response after resume generation.
    -   `handleGenerationError(error)` (lines 119-138): Handles errors during resume generation.
    -   `previewJobDescription()` (lines 143-181): Extracts and displays a job description preview.
    -   `handlePreviewResponse(response)` (lines 186-200): Handles the response after previewing.
    -   `handlePreviewError(error)` (lines 205-212): Handles errors during preview.
    -   `autoFillForm()` (lines 217-251): Initiates the form auto-fill process.
    -   `handleAutoFillResponse(response)` (lines 256-277): Handles the response after auto-fill.
    -   `handleAutoFillError(error)` (lines 282-284): Handles errors during auto-fill.
    -   `sendBackgroundMessage(message)` (lines 289-299): Utility to send a message to the background script.
    -   `validateJobDescription(text, minLength)` (lines 304-325): Validates the job description text.
    -   `getExtractionMethodDisplayName(method)` (lines 330-336): Gets a user-friendly extraction method name.
    -   `checkBackgroundScript()` (lines 341-348): Checks if the background script is responsive.
    -   `getProcessingStatus()` (lines 353-359): Returns the current processing status.

-   **`state-manager.js` (343 lines)**
    -   `constructor()` (lines 6-25): Initializes with the default application state.
    -   `subscribe(key, callback)` (lines 30-41): Subscribes a callback to state changes.
    -   `notify(key, newValue, oldValue)` (lines 46-57): Notifies listeners of a state change.
    -   `setState(key, value)` (lines 62-81): Sets a value in the state and notifies listeners.
    -   `getState(key)` (lines 86-99): Retrieves a value from the state.
    -   `setResume(...)` (lines 104-111): Sets resume data in state and storage.
    -   `getResume()` (lines 113-115): Gets resume data from the state.
    -   `clearResume()` (lines 117-124): Clears resume data from state and storage.
    -   `hasResume()` (lines 126-129): Checks if a resume is stored.
    -   `setApiToken(token)` (lines 134-143): Sets the API token in state and storage.
    -   `getApiToken()` (lines 145-147): Gets the API token from the state.
    -   `hasApiToken()` (lines 149-152): Checks if an API token is stored.
    -   `setProcessing(isProcessing)` (lines 157-159): Sets the processing flag.
    -   `isProcessing()` (lines 161-163): Checks if the app is processing.
    -   `setPreviewing(isPreviewing)` (lines 165-167): Sets the previewing flag.
    -   `isPreviewing()` (lines 169-171): Checks if the app is previewing.
    -   `setExtractionMethod(method)` (lines 176-181): Sets the extraction method.
    -   `getExtractionMethod()` (lines 183-185): Gets the extraction method.
    -   `setTheme(theme)` (lines 187-192): Sets the UI theme.
    -   `getTheme()` (lines 194-196): Gets the UI theme.
    -   `setGeneratedResume(resumeJSON)` (lines 201-203): Stores the generated resume.
    -   `getGeneratedResume()` (lines 205-207): Gets the generated resume.
    -   `hasGeneratedResume()` (lines 209-211): Checks if a generated resume exists.
    -   `clearGeneratedResume()` (lines 213-215): Clears the generated resume.
    -   `loadFromStorage()` (lines 220-255): Loads the entire state from storage.
    -   `validateForResumeGeneration()` (lines 260-277): Validates state for resume generation.
    -   `validateForAutoFill()` (lines 282-294): Validates state for auto-fill.
    -   `getSnapshot()` (lines 299-301): Returns a snapshot of the current state.
    -   `reset()` (lines 306-314): Resets the state to default values.
    -   `debug()` (lines 319-321): Logs the current state to the console.

-   **`ui-manager.js` (284 lines)**
    -   `constructor()` (lines 6-12): Initializes the UI manager.
    -   `initializeElements()` (lines 17-53): Stores references to DOM elements.
    -   `applyTheme(theme, isInitialLoad)` (lines 58-74): Applies the light/dark theme.
    -   `toggleCard(cardElement, forceCollapse)` (lines 79-103): Toggles the state of a card.
    -   `updateStatus(message, type)` (lines 108-114): Updates the main status message.
    -   `updateApiTokenStatus(...)` (lines 119-126): Updates the API token status message.
    -   `updateResumeStatus(filename)` (lines 131-155): Updates the resume upload status.
    -   `updateAutoFillStatus(...)` (lines 160-165): Updates the auto-fill status message.
    -   `setButtonLoading(...)` (lines 170-190): Sets the loading state of a button.
    -   `toggleDownloadButtons(show)` (lines 195-212): Shows or hides download buttons.
    -   `updateExtractionMethodUI(method)` (lines 217-220): Updates UI when extraction method changes.
    -   `initializeCardEvents()` (lines 225-240): Initializes listeners for collapsible cards.
    -   `initializeThemeEvents()` (lines 245-249): Placeholder for theme event initialization.
    -   `initializeEvents()` (lines 254-257): Initializes all UI-related event listeners.
    -   `getCurrentTheme()` (lines 262-264): Gets the current theme.
    -   `isCardCollapsed(cardId)` (lines 269-271): Checks if a card is collapsed.

## 📁 `tests`

-   **`comprehensive-test.html` (635 lines)**
    -   `updateTestStatus(...)` (lines 268-281): Updates the UI to show test status.
    -   `testModuleLoading()` (lines 284-318): Tests if required modules are loaded.
    -   `testDOMElements()` (lines 321-355): Checks if critical DOM elements are present.
    -   `testStateManagement()` (lines 358-400): Tests the `StateManager`.
    -   `testThemeToggle()` (lines 403-433): Tests theme toggle functionality.
    -   `testBackgroundConnection()` (lines 436-458): Tests connection to the background script.
    -   `testLoadingStates()` (lines 461-501): Tests UI button loading states.
    -   `testStorageAccess()` (lines 504-539): Tests Chrome storage access.
    -   `testAPIToken()` (lines 542-563): Tests API token management.
    -   `runAllTests()` (lines 566-583): Runs all defined tests.
    -   `clearAllResults()` (lines 586-605): Clears all test results from the UI.
    -   `showOverallResults()` (lines 608-626): Displays a summary of test results.
    -   `window.addEventListener('load', ...)` (lines 629-646): Runs basic tests on page load.

-   **`optimization-test.html` (425 lines)**
    -   `addResult(...)` (lines 173-179): Adds a test result message to the UI.
    -   `clearResults(containerId)` (lines 181-183): Clears results from a container.
    -   `testStorageConsolidation()` (lines 185-217): Tests storage operations consolidation.
    -   `testHashGeneration()` (lines 219-242): Tests consolidated hash generation.
    -   `testDelayFunctions()` (lines 244-263): Tests consolidated delay function.
    -   `testFileUtilities()` (lines 265-296): Tests consolidation of file utilities.
    -   `testThemeManagement()` (lines 298-327): Tests consolidated theme management.
    -   `testPerformance()` (lines 329-361): Runs performance benchmarks.
    -   `runAllTests()` (lines 363-382): Runs all optimization tests.

-   `layout-optimization-test.html` (264 lines): No complex functions.
-   `manual-test-guide.html` (611 lines): No functions.
-   `test-functionality.html` (311 lines): No complex functions.

## 📁 `utils`

-   **`api-client.js` (388 lines)**
    -   `constructor(apiKey)` (lines 3-6): Initializes the API client.
    -   `callAPI(...)` (lines 8-23): Makes a rate-limited call to the Gemini API.
    -   `_makeAPICall(...)` (lines 25-57): Performs the actual API fetch request.
    -   `parseResumeToJSON(...)` (lines 60-126): Parses resume content into JSON.
    -   `extractJobDescription(...)` (lines 129-164): Extracts job description from a webpage.
    -   `tailorSection(...)` (lines 167-219): Tailors a resume section to a job description.
    -   `estimateSalary(...)` (lines 221-273): Estimates salary range for a job.
    -   `mapFieldToResume(...)` (lines 276-319): Maps a form field to resume data.
    -   `callAPIWithCustomBody(...)` (lines 322-336): Makes an API call with a custom body.
    -   `_makeAPICallWithCustomBody(...)` (lines 338-358): Private method for custom body API calls.
    -   `createCompactResumeData(resumeJSON)` (lines 361-366): Creates a compact summary of resume data.
    -   `getSafetySettings()` (lines 368-375): Returns safety settings for API requests.

-   **`parallel-processor.js` (229 lines)**
    -   `constructor(apiClient, options)` (lines 7-14): Initializes with API client and options.
    -   `processSectionsInParallel(...)` (lines 19-86): Processes resume sections in parallel.
    -   `prepareSectionTasks(...)` (lines 91-112): Prepares and prioritizes section tailoring tasks.
    -   `processTaskWithRetry(task)` (lines 117-135): Processes a single task.
    -   `createBatches(...)` (lines 140-146): Creates batches of tasks.
    -   `delay(ms)` (lines 151-153): A simple delay utility.
    -   `cancelAllRequests()` (lines 158-162): Cancels all active and queued requests.
    -   `getStats()` (lines 167-175): Returns statistics about the processing state.
    -   `combineResults(...)` (lines 180-213): Combines tailored sections with original resume.

-   **`resume-cache-optimizer.js` (432 lines)**
    -   `constructor(apiClient)` (lines 6-10): Initializes with an API client.
    -   `getOptimizedResumeJSON(...)` (lines 14-36): Gets optimized resume JSON, using cache.
    -   `generateOptimizedJSON(...)` (lines 41-78): Generates optimized JSON with a 3-pass approach.
    -   `generateMultipleParses(...)` (lines 83-162): Generates multiple JSON parses of the resume.
    -   `createCustomParsePrompt(config)` (lines 165-200): Creates a custom prompt for parsing.
    -   `combineAndOptimize(...)` (lines 203-262): Combines multiple JSON variants into one.
    -   `selectBestVariant(...)` (lines 265-282): Selects the best variant if optimization fails.
    -   `scoreVariantCompleteness(variant)` (lines 285-333): Scores a resume variant based on completeness.
    -   `cacheOptimizedJSON(...)` (lines 336-353): Caches the optimized resume JSON.
    -   `generateResumeHash(resumeData)` (lines 356-360): Generates a hash for resume data.
    -   `invalidateResumeCache(...)` (lines 363-386): Invalidates the resume cache.
    -   `getAllCacheKeys()` (lines 389-398): Retrieves all keys from local storage.
    -   `getCacheStats()` (lines 401-428): Gathers statistics about cache usage.

-   **`salary-estimator.js` (129 lines)**
    -   `constructor(apiClient, rateLimiter)` (lines 8-14): Initializes with API client and rate limiter.
    -   `batchEstimate(jobs)` (lines 20-56): Estimates salaries for a batch of jobs.
    -   `estimate(...)` (lines 65-79): Estimates salary for a single job.
    -   `_getMockSalary(jobTitle)` (lines 81-90): Generates a mock salary.
    -   `_checkCache(jobUrl)` (lines 92-107): Checks cache for a salary.
    -   `_cacheResult(jobUrl, data)` (lines 109-122): Caches a salary estimation result.

-   **`script-injector.js` (260 lines)**
    -   `executeInActiveTab(func, args)` (lines 3-31): Executes a function in the active tab.
    -   `getPageText()` (lines 33-37): Retrieves the text of the active tab.
    -   `extractJobDescriptionStandard()` (lines 39-87): Extracts job description using selectors.
    -   `getFormFields()` (lines 89-157): Scans the page for form fields.
    -   `fillFormFields(fieldMappings)` (lines 159-189): Fills form fields on the page.
    -   `canAccessCurrentTab()` (lines 192-199): Checks if scripts can be injected.
    -   `getPageInfo()` (lines 202-212): Gathers basic information about the page.
    -   `injectCSS(css)` (lines 215-222): Injects CSS into the page.
    -   `highlightFilledFields(...)` (lines 225-251): Highlights auto-filled fields.

-   **`shared-utilities.js` (357 lines)**
    -   `delay(ms)` (lines 10-12): A promise-based delay function.
    -   `formatFileSize(bytes)` (lines 18-26): Converts bytes to a readable string.
    -   `validateFileType(...)` (lines 32-39): Validates a file's extension.
    -   `getFileExtension(filename)` (lines 45-48): Extracts the extension from a filename.
    -   `generateUniqueId(prefix)` (lines 54-58): Generates a unique ID.
    -   `convertJSONToText(jsonData)` (lines 64-166): Converts resume JSON to a text string.
    -   `truncateText(...)` (lines 172-175): Truncates text to a max length.
    -   `capitalizeWords(text)` (lines 181-186): Capitalizes the first letter of each word.
    -   `cleanText(text)` (lines 192-198): Cleans and normalizes text.
    -   `isEmptyObject(obj)` (lines 204-206): Checks if an object is empty.
    -   `deepClone(obj)` (lines 212-215): Performs a deep clone of an object.
    -   `countWords(text)` (lines 221-224): Counts words in a string.
    -   `countCharacters(text)` (lines 230-233): Counts non-whitespace characters.
    -   `generateTimestampedFilename(...)` (lines 239-247): Creates a filename with a timestamp.
    -   `isValidEmail(email)` (lines 253-257): Validates an email address.
    -   `isValidPhone(phone)` (lines 263-267): Validates a phone number.
    -   `isValidUrl(url)` (lines 273-280): Validates a URL.
    -   `getCurrentTimestamp()` (lines 286-288): Returns the current ISO timestamp.
    -   `isTimestampExpired(...)` (lines 294-299): Checks if a timestamp has expired.
    -   `generateResumeHash(resumeData)` (lines 305-334): Generates a hash for resume data.

-   **`simple-rate-limiter.js` (205 lines)**
    -   `constructor()` (lines 8-16): Initializes with concurrency and per-minute limits.
    -   `queueRequest(...)` (lines 21-35): Adds a request to the queue.
    -   `processQueue()` (lines 40-62): Processes the request queue respecting limits.
    -   `processRequestConcurrently(...)` (lines 67-115): Processes a single request with retries.
    -   `isRateLimitError(error)` (lines 118-124): Checks if an error is a rate limit error.
    -   `waitForNextMinute()` (lines 127-136): Waits for the next minute to reset counter.
    -   `resetMinuteCounterIfNeeded()` (lines 139-148): Resets the per-minute counter.
    -   `resetMinuteCounter()` (lines 151-155): Resets the per-minute counter and start time.
    -   `getStatus()` (lines 160-171): Gets the current status of the rate limiter.
    -   `delay(ms)` (lines 174-178): A simple delay utility.
    -   `clearQueue()` (lines 183-191): Clears all requests from the queue.

-   **`storage-manager.js` (252 lines)**
    -   `initialize()` (lines 3-7): Logs initialization.
    -   `get(keys, area)` (lines 9-19): Retrieves items from storage.
    -   `set(data, area)` (lines 21-31): Saves items to storage.
    -   `remove(keys, area)` (lines 33-43): Removes items from storage.
    -   `clear(area)` (lines 45-55): Removes all items from storage.
    -   `getResume()` (lines 58-69): Retrieves resume data.
    -   `setResume(...)` (lines 71-84): Saves resume data.
    -   `clearResume()` (lines 86-96): Clears resume data.
    -   `getAPIToken()` (lines 99-106): Retrieves the API token.
    -   `setAPIToken(token)` (lines 108-117): Saves the API token.
    -   `clearAPIToken()` (lines 119-129): Clears the API token.
    -   `getSettings()` (lines 132-142): Retrieves user settings.
    -   `setSettings(settings)` (lines 144-153): Saves user settings.
    -   `setSetting(key, value)` (lines 155-165): Saves a single setting.
    -   `getCache(key)` (lines 168-175): Retrieves a cached item.
    -   `setCache(...)` (lines 177-191): Saves an item to the cache.
    -   `isCacheExpired(key)` (lines 193-205): Checks if a cached item has expired.
    -   `getValidCache(key)` (lines 207-219): Retrieves a non-expired cached item.
    -   `clearCache(key)` (lines 221-231): Clears an item from the cache.
    -   `getStorageUsage(area)` (lines 234-244): Gets the storage usage in bytes.

-   **`unified-error-handler.js` (550 lines)**
    -   `createError(...)` (lines 9-16): Creates a structured error object.
    -   `generateErrorId()` (lines 21-23): Generates a unique error ID.
    -   `classifyError(error)` (lines 28-65): Classifies an error into a category.
    -   `getUserFriendlyError(...)` (lines 70-213): Generates a user-friendly error message.
    -   `createCleanErrorMessage(...)` (lines 218-239): Creates a concise console error message.
    -   `safeExecute(...)` (lines 244-258): Wraps an operation for safe execution.
    -   `safeAPICall(...)` (lines 263-282): Wrapper for API calls with error handling.
    -   `safeChromeOperation(...)` (lines 287-300): Wrapper for Chrome API calls.
    -   `safeFileOperation(...)` (lines 305-318): Wrapper for file operations.
    -   `withRetry(...)` (lines 323-367): Retries an operation with exponential backoff.
    -   `isNonRetryableError(error)` (lines 372-388): Checks if an error should not be retried.
    -   `delay(ms)` (lines 393-395): A simple delay utility.
    -   `validateInput(...)` (lines 400-443): Validates an input value.
    -   `formatErrorForUI(error)` (lines 448-462): Formats an error for UI display.
    -   `shouldReportToUser(error)` (lines 467-474): Determines if an error should be shown to the user.
    -   `logError(...)` (lines 479-506): Logs an error to storage for debugging.
    -   `getErrorSuggestions(errorType)` (lines 511-547): Provides user suggestions based on error type.
