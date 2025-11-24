# ResumeHub-v1 File Structure

This document provides a detailed breakdown of the file structure, including functions and their descriptions.

## Popup Layer (`popup/`)

### `popup/app-controller.js`
**Description**: Main controller for the popup application. Orchestrates initialization, module management, and application lifecycle.
**Functions**:
- `constructor()`: Initializes state and module placeholders.
- `initialize()`: Sets up the application, initializes modules (Storage, State, UI, etc.), and handles errors.
- `getStatus()`: Returns the current status of the application and its modules.
- `restart()`: Re-initializes the application (useful for debugging).
- `shutdown()`: Cleans up resources and shuts down the application.
- `exposeForDebugging()`: Exposes the controller instance to `window` for debugging purposes.

### `popup/storage-adapter.js`
**Description**: Adapter for communicating with the background script for storage operations. Abstracts `chrome.runtime.sendMessage` calls.
**Functions**:
- `getSettings()`: Retrieves user settings (theme, extraction method).
- `setSetting(key, value)`: Saves a specific setting.
- `getResume()`: Retrieves the stored resume data.
- `setResume(filename, content, mimeType)`: Saves resume data.
- `clearResume()`: Removes stored resume data.
- `getAPIToken()`: Retrieves the stored API token.
- `setAPIToken(token)`: Saves the API token.
- `clearAPIToken()`: Removes the API token.
- `getValidCache(key)`: (Legacy) Returns null in popup context.
- `setCache(key, value)`: (Legacy) No-op setter.
- `setCacheWithExpiry(key, value, hours)`: (Legacy) No-op setter.

### `popup.js`
**Description**: Entry point for the popup. Initializes the `AppController` when the DOM is loaded.
**Functions**:
- `document.addEventListener('DOMContentLoaded', ...)`: Checks for required classes and initializes `AppController`.
- `showError(message)`: Displays a critical error message in the UI if initialization fails.

### `popup/file-handlers.js`
**Description**: Handles file upload, reading, and download operations.
**Functions**:
- `constructor(stateManager, uiManager)`: Initializes with state and UI managers.
- `handleResumeUpload(file)`: Processes a resume file upload, validates type/size, reads content, and updates state.
- `readFileContent(file)`: Reads file content as text or array buffer based on type.
- `downloadGeneratedResume(format)`: Initiates download of the tailored resume in the specified format (PDF, DOCX, TXT).
- `_downloadAsPdf(resumeJSON, filename)`: Generates and downloads a PDF version of the resume.
- `_downloadAsDocx(resumeJSON, filename)`: (Placeholder) Downloads as DOCX (currently falls back to text).
- `_downloadAsText(resumeJSON, filename)`: Converts resume JSON to text and downloads it.
- `_generateAndDownloadPdf(resumeJSON, filename)`: Internal method to generate PDF using `pdfMake`.

### `popup/resume-processor.js`
**Description**: Manages resume tailoring and job description analysis.
**Functions**:
- `constructor(stateManager, uiManager)`: Initializes with state and UI managers.
- `generateTailoredResume()`: Orchestrates the resume tailoring process (validates inputs, calls API, handles response).
- `handleGenerationResponse(response)`: Processes the API response for resume tailoring.
- `handleGenerationError(error)`: Handles errors during generation and updates UI.
- `previewJobDescription()`: Fetches and displays the job description from the current tab.
- `handlePreviewResponse(response)`: Updates UI with the extracted job description.
- `handlePreviewError(error)`: Handles errors during JD preview.
- `autoFillForm()`: Initiates the auto-fill process for job application forms.
- `handleAutoFillResponse(response)`: Displays results of the auto-fill operation.
- `handleAutoFillError(error)`: Handles errors during auto-fill.
- `sendBackgroundMessage(message)`: Helper to send messages to the background script.
- `validateJobDescription(text, minLength)`: Validates the job description text.
- `getExtractionMethodDisplayName(method)`: Returns a human-readable name for the extraction method.
- `checkBackgroundScript()`: Pings the background script to ensure it's active.
- `getProcessingStatus()`: Returns current processing flags.

### `popup/state-manager.js`
**Description**: Manages the application state (resume data, API token, theme, etc.) and notifies subscribers of changes.
**Functions**:
- `constructor()`: Initializes default state.
- `initialize()`: Loads initial state from storage.
- `subscribe(key, callback)`: Subscribes a listener to changes in a specific state key.
- `notify(key, value)`: Notifies subscribers of a state change.
- `setState(key, value, saveToStorage)`: Updates state and optionally saves to storage.
- `setResume(filename, content, mimeType)`: Updates resume data in state and storage.
- `getResume()`: Returns current resume data.
- `setApiToken(token)`: Updates API token in state and storage.
- `getApiToken()`: Returns current API token.
- `setTheme(theme)`: Updates theme in state and storage.
- `setProcessing(isProcessing)`: Updates processing status.
- `isProcessing()`: Returns processing status.
- `setPreviewing(isPreviewing)`: Updates previewing status.
- `isPreviewing()`: Returns previewing status.
- `setGeneratedResume(resumeJSON)`: Stores the generated resume JSON.
- `getGeneratedResume()`: Returns the generated resume JSON.
- `clearGeneratedResume()`: Clears the generated resume.
- `validateForGeneration()`: Checks if all requirements for generation are met.
- `validateForAutoFill()`: Checks if all requirements for auto-fill are met.
- `getSnapshot()`: Returns a snapshot of the current state.

### `popup/ui-manager.js`
**Description**: Manages DOM elements and UI updates.
**Functions**:
- `constructor(stateManager)`: Initializes with state manager and caches DOM elements.
- `initializeAllEvents()`: Sets up event listeners for UI interactions.
- `cacheElements()`: Stores references to DOM elements.
- `applyTheme(theme, isInitialLoad)`: Updates the UI theme (light/dark).
- `toggleCard(cardElement, forceCollapse)`: Toggles the visibility of collapsible cards.
- `updateStatus(message, type)`: Updates the main status message.
- `updateApiTokenStatus(message, isSuccess)`: Updates the API token status indicator.
- `updateResumeStatus(filename)`: Updates the resume upload status and buttons.
- `updateAutoFillStatus(message, type)`: Updates the auto-fill status message.
- `setButtonLoading(button, isLoading, loadingText, originalText)`: Toggles button loading state.
- `toggleDownloadButtons(show)`: Shows or hides download buttons.
- `updateExtractionMethodUI(method)`: Updates UI based on selected extraction method.
- `initializeCardEvents()`: Sets up click handlers for collapsible cards.
- `initializeThemeEvents()`: (Legacy) Theme events are now handled by EventHandlers.
- `initializeEvents()`: Initializes all UI events.
- `getCurrentTheme()`: Returns the current theme.
- `isCardCollapsed(cardId)`: Checks if a card is collapsed.

### `popup/event-handlers.js`
**Description**: Centralizes event handling logic for the popup.
**Functions**:
- `constructor(stateManager, uiManager, fileHandlers, resumeProcessor)`: Initializes with all managers.
- `initializeAllEvents()`: Sets up all event listeners.
- `initializeInputEvents()`: Sets up input change listeners (API token, etc.).
- `initializeButtonEvents()`: Sets up button click listeners (Create, Preview, Auto-fill, Clear).
- `initializeDownloadEvents()`: Sets up download button listeners.
- `initializeStateListeners()`: Subscribes to state changes to update UI.
- `initializeKeyboardShortcuts()`: Sets up keyboard shortcuts (Ctrl+Enter, Ctrl+P).
- `initializeWindowEvents()`: Sets up window-level events (beforeunload, visibilitychange).
- `initializeDragAndDrop()`: Sets up drag-and-drop for file upload.
- `initializeFormValidation()`: Sets up real-time form validation.
- `initializeAccessibility()`: Adds accessibility features (keyboard nav, ARIA).
- `initialize()`: Main initialization method.
- `cleanup()`: Removes event listeners.
- `getStatus()`: Returns initialization status.

## Core Layer (`core/`)

### `core/config/constants.js`
**Description**: Defines application-wide constants.
**Functions**:
- (Exports constants like `STORAGE_KEYS`, `MESSAGE_ACTIONS`, `UI_SELECTORS`, etc. No functions.)

### `core/config/app-config.js`
**Description**: Configuration settings for the application.
**Functions**:
- (Exports configuration objects. No functions.)

### `core/config/job-selectors.js`
**Description**: CSS selectors for extracting job information from LinkedIn.
**Functions**:
- (Exports `SELECTORS` object. No functions.)

## Background Script

### `background.js`
**Description**: Service worker that handles background tasks, API calls, and cross-component communication.
**Functions**:
- `ACTION_HANDLERS`: Object mapping action names to handler functions.
  - `getSettings`: Retrieves settings from storage.
  - `setSetting`: Saves settings to storage.
  - `getResume`: Retrieves resume from storage.
  - `setResume`: Saves resume to storage.
  - `clearResume`: Clears resume from storage.
  - `getAPIToken`: Retrieves API token.
  - `setAPIToken`: Saves API token and re-initializes API client.
  - `clearAPIToken`: Clears API token.
  - `getCurrentTabId`: Returns the sender's tab ID.
  - `estimateSalaryWithJD`: Orchestrates salary estimation using `SalaryEstimator` and AI enhancement.
  - `getAIResponse`: Handles generic AI prompts using `GeminiAPIClient`.
  - `ping`: Simple health check.
- `chrome.runtime.onMessage.addListener`: Main message listener that dispatches to `ACTION_HANDLERS`.
- `chrome.runtime.onInstalled.addListener`: Listener for extension installation/update events.
## Infrastructure Layer (`utils/`)

### `utils/api-client.js`
**Description**: Client for interacting with the Google Gemini API.
**Functions**:
- `constructor(apiKey)`: Initializes with API key.
- `callAPI(model, prompt, options, operation)`: Makes a request to the Gemini API with retries and error handling.
- `tailorResume(resumeData, jobDescription)`: Specific method to tailor a resume.
- `extractJobDescription(htmlContent)`: Uses AI to extract structured job description from HTML.
- `estimateSalary(jobData)`: Uses AI to estimate salary based on job data.
- `_handleError(error, operation)`: Internal error handler.

### `utils/storage-manager.js`
**Description**: Wrapper around `chrome.storage` for consistent data access.
**Functions**:
- `getSettings()`: Retrieves settings.
- `setSetting(key, value)`: Saves a setting.
- `getResume()`: Retrieves resume data.
- `setResume(filename, content, mimeType)`: Saves resume data.
- `clearResume()`: Clears resume data.
- `getAPIToken()`: Retrieves API token.
- `setAPIToken(token)`: Saves API token.
- `clearAPIToken()`: Clears API token.
- `getValidCache(key)`: Retrieves cached data if valid.
- `setCache(key, value)`: Saves data to cache.
- `setCacheWithExpiry(key, value, hours)`: Saves data with expiration.

### `utils/logger.js`
**Description**: Centralized logging utility.
**Functions**:
- `log(message, data)`: Logs info message.
- `warn(message, data)`: Logs warning.
- `error(message, error)`: Logs error.
- `debug(message, data)`: Logs debug message (if enabled).

### `utils/unified-error-handler.js`
**Description**: Centralized error handling and classification.
**Functions**:
- `handleError(error, context)`: Main entry point for handling errors.
- `classifyError(error)`: Determines the type of error (Network, API, Validation, etc.).
- `getUserFriendlyError(error)`: Returns a user-facing error message and action.
- `shouldReportToUser(error)`: Determines if error should be shown to user.
- `logError(error, context)`: Logs error to storage.
- `getErrorSuggestions(errorType)`: Returns actionable suggestions for specific errors.

### `utils/simple-rate-limiter.js`
**Description**: Rate limiter for API requests.
**Functions**:
- `constructor()`: Initializes queue and counters.
- `queueRequest(requestFn, operation)`: Adds a request to the queue.
- `processQueue()`: Processes queued requests respecting limits.
- `processRequestConcurrently(queueItem)`: Executes a single request.
- `isRateLimitError(error)`: Checks if an error is rate-limit related.
- `waitForNextMinute()`: Pauses execution until next minute window.
- `resetMinuteCounterIfNeeded()`: Resets counters if minute has passed.
- `getStatus()`: Returns current limiter status.
- `delay(ms)`: Utility delay function.
- `clearQueue()`: Clears all pending requests.

### `utils/salary-estimator.js`
**Description**: Estimates salary based on job details using heuristics and AI.
**Functions**:
- `constructor(apiClient, rateLimiter)`: Initializes with dependencies.
- `estimate(jobTitle, location, company, jobUrl)`: Main estimation method.
- `batchEstimate(jobs, options)`: Estimates salary for multiple jobs.
- `_getCacheKey(jobUrl)`: Generates cache key.
- `_estimateWithHeuristics(jobTitle, location)`: Fallback estimation using rules.
- `_estimateWithAI(jobTitle, location, company, jobUrl)`: AI-based estimation.
- `_parseAIResponse(response)`: Parses AI output.
- `_mergeEstimates(heuristic, ai)`: Combines heuristic and AI estimates.

### `utils/salary-parser.js`
**Description**: Parses salary strings into structured data.
**Functions**:
- `parse(salaryString)`: Main parsing method.
- `_normalize(salaryString)`: Cleans up input string.
- `_extractRange(normalized)`: Extracts min/max values.
- `_detectCurrency(salaryString)`: Identifies currency.
- `_detectPeriod(salaryString)`: Identifies pay period (year, month, hour).

### `utils/file-downloader.js`
**Description**: Handles file downloads in the browser.
**Functions**:
- `downloadAsText(content, filename)`: Downloads string content as .txt.
- `downloadAsPdf(content, filename)`: Downloads content as .pdf (using pdfMake).
- `downloadAsDocx(content, filename)`: Downloads content as .docx.
- `_saveFile(blob, filename)`: Internal method to trigger download.

### `utils/input-validator.js`
**Description**: Validates user input.
**Functions**:
- `validateResume(file)`: Validates resume file (type, size).
- `validateApiToken(token)`: Validates API token format.
- `validateJobDescription(text)`: Validates job description content.
- `validateAPIResponse(response, expectedType)`: Validates API response structure.
- `validateSalaryInput(input)`: Validates salary strings.
- `sanitizeAndValidateText(text, maxLength)`: Sanitizes and validates text.
- `validateNumber(value, min, max)`: Validates numeric input.

### `utils/request-validator.js`
**Description**: Validates message requests against schemas.
**Functions**:
- `validateRequest(request, schema)`: Validates a request object.
- `getSchemaForAction(action)`: Retrieves the schema for a specific action.
- (Exports `REQUEST_SCHEMAS` constant).

### `utils/script-injector.js`
**Description**: Injects scripts and styles into web pages.
**Functions**:
- `injectScript(file)`: Injects a JS file.
- `injectCSS(file)`: Injects a CSS file.
- `removeScript(file)`: Removes an injected script.
- `removeCSS(file)`: Removes an injected CSS file.

### `utils/resume-cache-optimizer.js`
**Description**: Optimizes resume storage and caching.
**Functions**:
- `compress(content)`: Compresses resume content (placeholder).
- `decompress(content)`: Decompresses resume content.
- `shouldCache(resumeData)`: Determines if resume should be cached.

### `utils/sanitizer.js`
**Description**: Sanitizes input to prevent XSS and injection.
**Functions**:
- `sanitizeHTML(html)`: Removes unsafe HTML tags/attributes.
- `sanitizeText(text)`: Removes control characters.
- `sanitizeJSON(json)`: Recursively sanitizes JSON objects.

### `utils/parallel-processor.js`
**Description**: Helper for parallel processing with concurrency limits.
**Functions**:
- `process(items, processFn, concurrency)`: Processes items in parallel.
- `_processBatch(batch, processFn)`: Internal batch processor.

### `utils/shared-utilities.js`
**Description**: Common utility functions.
**Functions**:
- `delay(ms)`: Returns a promise that resolves after ms.
- `generateTimestampedFilename(prefix, extension)`: Generates a filename with current timestamp.
- `convertJSONToText(json)`: Converts resume JSON to a readable text format.
- `debounce(func, wait)`: Debounces a function.
- `throttle(func, limit)`: Throttles a function.

### `utils/pdf-generator.js`
**Description**: Generates PDF documents from resume data.
**Functions**:
- `generatePDF(resumeData)`: Main generation method.
- `_createDocumentDefinition(resumeData)`: Creates pdfMake document definition.
- `_formatContact(contact)`: Formats contact section.
- `_formatExperience(experience)`: Formats experience section.
- `_formatEducation(education)`: Formats education section.
- `_formatSkills(skills)`: Formats skills section.
## Content Scripts (`content-scripts/`)

### `content-scripts/linkedin/linkedin-controller.js`
**Description**: Main controller for LinkedIn integration. Detects page changes and initializes components.
**Functions**:
- `constructor()`: Initializes state and observers.
- `init()`: Sets up URL observation and initial page detection.
- `_handleUrlChange(url)`: Routes to appropriate handler based on URL.
- `_handleJobSearchPage()`: Initializes `JobSearchHandler`.
- `_handleJobDetailsPage()`: Initializes `JobDetailsHandler`.
- `_cleanup()`: Cleans up current handlers.

### `content-scripts/linkedin/config/selectors.js`
**Description**: CSS selectors specific to LinkedIn's DOM structure.
**Functions**:
- (Exports `SELECTORS` object. No functions.)

### `content-scripts/linkedin/components/right-sidebar.js`
**Description**: Manages the injected sidebar UI on LinkedIn.
**Functions**:
- `constructor()`: Initializes sidebar state.
- `mount()`: Creates and injects the sidebar into the DOM.
- `unmount()`: Removes the sidebar.
- `updateJobData(jobData)`: Updates the sidebar with new job information.
- `_createSidebarHTML()`: Generates the sidebar HTML structure.
- `_attachEventListeners()`: Sets up sidebar interactions.
- `_handleTailorClick()`: Handles "Tailor Resume" button click.
- `_storeTailoredResume(resumeJSON, isAuto)`: Stores the tailored resume.
- `_getStoredTailoredResume()`: Retrieves stored tailored resume.
- `_toggleDownloadButtons(show)`: Shows/hides download options.
- `_downloadResume(format)`: Handles resume download.
- `_downloadAsText(resumeJSON, filename)`: Downloads as text.
- `_downloadAsPdf(resumeJSON, filename)`: Downloads as PDF (or fallback).
- `_downloadAsDocx(resumeJSON, filename)`: Downloads as DOCX (or fallback).
- `_generateAndDownloadPdf(resumeJSON, filename)`: Internal PDF generation.

### `content-scripts/linkedin/components/job-insights-manager.js`
**Description**: Manages the display of job insights within the sidebar.
**Functions**:
- `constructor(container)`: Initializes with container element.
- `update(jobData)`: Fetches and displays insights for the job.
- `_renderInsights(insights)`: Renders the insights UI.
- `_fetchInsights(jobData)`: Calls background script to get AI insights.

### `content-scripts/linkedin/components/salary-badge.js`
**Description**: Renders salary estimate badges on job cards.
**Functions**:
- `constructor(container, jobUrl)`: Initializes with container and job URL.
- `create()`: Creates the badge element.
- `showLoading()`: Updates badge to loading state.
- `showSalary(salaryData)`: Updates badge with salary estimate.
- `showError(message)`: Updates badge with error state.
- `_createBadgeHTML()`: Generates badge HTML.

### `content-scripts/linkedin/pages/job-details-handler.js`
**Description**: Handles logic for the Job Details page.
**Functions**:
- `constructor(controller)`: Initializes with parent controller.
- `handle()`: Main entry point for page handling.
- `_extractJobData()`: Extracts job details from the DOM.
- `_injectSidebar(jobData)`: Mounts the sidebar.

### `content-scripts/linkedin/pages/job-search-handler.js`
**Description**: Handles logic for the Job Search page (list view).
**Functions**:
- `constructor(controller)`: Initializes with parent controller.
- `handle()`: Main entry point for page handling.
- `_observeJobCards()`: Sets up observer for job card loading.
- `_processJobCard(card)`: Extracts data from a job card and injects salary badge.
- `_extractJobDataFromCard(card)`: Helper to extract data from a single card.
- `createSalaryBadge(jobData, card)`: Creates a salary badge instance.
- `updateBadgesWithEstimates(estimates)`: Updates badges with batch API results.
- `updateBadgesWithError(jobs, message)`: Updates badges with error.
- `retryFailedJobs()`: Retries estimation for failed badges.
- `_normalizeJobUrl(url)`: Standardizes job URLs.

