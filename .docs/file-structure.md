# ResumeHub-v1 - Complete File Structure & Function Reference

**Last Updated:** November 16, 2025

This document provides a comprehensive mapping of all files, functions, and their descriptions in the ResumeHub-v1 Chrome extension project.

---

## Table of Contents

1. [Entry Points](#entry-points)
2. [Core Configuration](#core-configuration)
3. [Popup (Frontend Layer)](#popup-frontend-layer)
4. [Background Service Worker](#background-service-worker)
5. [Content Scripts (LinkedIn Integration)](#content-scripts-linkedin-integration)
6. [Utilities Layer](#utilities-layer)
7. [CSS & Styling](#css--styling)
8. [Library Files](#library-files)

---

## Entry Points

### popup.html
- **Location:** `/popup.html` (46 lines)
- **Description:** Main popup HTML file for the extension UI
- **Key Elements:**
  - `<!DOCTYPE html>` declaration for HTML5
  - CSS links for design tokens and modern popup styles
  - Root container with id `theme-container`
  - Theme class applied to both `<html>` and `<body>` elements

### popup.js
- **Location:** `/popup.js` (46 lines)
- **Description:** Main entry point for popup initialization
- **Functions:**

| Function | Lines | Description |
|----------|-------|-------------|
| `DOMContentLoaded` event handler | 6-35 | Initializes the application when DOM loads; validates required classes; creates AppController instance |
| `showError(message)` | 40-46 | Displays error messages to user in status-message element |

---

## Core Configuration

### core/config/constants.js
- **Location:** `/core/config/constants.js` (110 lines)
- **Description:** Centralized constants for the entire application
- **Exports:**

| Constant | Lines | Description |
|----------|-------|-------------|
| `CACHE` | 7-14 | Cache TTL values (JD: 5m, Resume: 5m, Optimized: 24h, Salary: 24h) |
| `TEXT_LIMITS` | 16-26 | Text length constraints (max page: 50k, min JD: 50-200, max resume: 3400 chars) |
| `RATE_LIMITS` | 28-33 | Rate limiting config (10 req/min, 3 concurrent, max retries: 3) |
| `STORAGE` | 35-39 | Storage limits (max 25 recent jobs, 10MB max file, 24h cache age) |
| `UI` | 41-51 | UI timing (debounce: 250ms, animation: 300ms, max z-index: 2147483646) |
| `API` | 53-61 | API config (temperature: 0.3, max tokens: 8192, timeout: 30s) |
| `VALIDATION` | 63-68 | Validation rules (min JD length: 200, max file: 10MB) |
| `SALARY` | 70-77 | Salary unit conversions (Lakh: 100k, Thousand: 1k, Million: 1M, Crore: 10M) |
| `RESUME` | 79-87 | Resume formats (upload: .pdf/.doc/.docx/.txt, download: txt/pdf/docx) |
| `TIMING` | 89-96 | Standard timing values (debounce: 250ms, throttle: 100ms, animation: 300ms) |

### core/config/app-config.js
- **Location:** `/core/config/app-config.js` (187 lines)
- **Description:** Centralized application configuration manager
- **Class:** `AppConfig`

| Method | Lines | Description |
|--------|-------|-------------|
| `constructor()` | 7-105 | Initializes app, api, storage, ui, resume, features, and dev configurations |
| `get(path, defaultValue)` | 108-111 | Retrieves config value using dot notation path |
| `set(path, value)` | 114-116 | Sets config value using dot notation path |
| `isFeatureEnabled(featureName)` | 119-122 | Checks if a feature flag is enabled |
| `getAPIConfig(serviceName)` | 125-128 | Returns API configuration for specific service |
| `_getNestedValue(obj, path)` | 131-133 | Helper to get nested object values using dot notation |
| `_setNestedValue(obj, path, value)` | 136-147 | Helper to set nested object values using dot notation |
| `_applyEnvironmentConfig()` | 150-160 | Applies environment-specific configuration overrides |

**Features Configured:** Resume tailoring, auto-fill, AI extraction, batch processing, LinkedIn right sidebar

### core/config/job-selectors.js
- **Location:** `/core/config/job-selectors.js` (28 lines)
- **Description:** Centralized CSS selectors for job description extraction
- **Exports:**

| Export | Lines | Description |
|--------|-------|-------------|
| `JOB_DESCRIPTION_SELECTORS` | 6-27 | Array of 22 CSS selectors for extracting job descriptions from various job boards |

**Supported Platforms:** LinkedIn, Indeed, Greenhouse, Lever, SmartRecruiters, Ashby

---

## Popup (Frontend Layer)

### popup/app-controller.js
- **Location:** `/popup/app-controller.js` 
- **Description:** Main controller orchestrating all popup components
- **Class:** `AppController`

| Method | Description |
|--------|-------------|
| `initialize()` | Initializes state manager, UI manager, and event handlers |
| `setupEventListeners()` | Wires up all user interaction events |
| `handleResumeUpload()` | Processes resume file uploads |
| `handleGenerateResume()` | Initiates resume generation with AI |

### popup/state-manager.js
- **Location:** `/popup/state-manager.js`
- **Description:** Reactive state management for popup
- **Class:** `StateManager`

| Method | Description |
|--------|-------------|
| `setState(key, value)` | Updates state and notifies observers |
| `getState(key)` | Retrieves state value |
| `subscribe(callback)` | Registers observer for state changes |
| `getTheme()` | Returns current theme (light/dark) |
| `setTheme(theme)` | Updates theme and persists to storage |

### popup/ui-manager.js
- **Location:** `/popup/ui-manager.js`
- **Description:** Handles DOM manipulation and UI updates
- **Class:** `UIManager`

| Method | Description |
|--------|-------------|
| `updateStatusMessage(message, type)` | Updates status display |
| `showLoading()` | Shows loading indicator |
| `hideLoading()` | Hides loading indicator |
| `applyTheme(theme)` | Applies theme CSS classes to DOM |
| `updateResumeStatus()` | Updates resume upload status display |
| `displayTailoredResume(content)` | Renders tailored resume content |

### popup/file-handlers.js
- **Location:** `/popup/file-handlers.js`
- **Description:** File upload and download operations
- **Class:** `FileHandlers`

| Method | Description |
|--------|-------------|
| `handleResumeUpload(file)` | Processes uploaded resume file and validates |
| `downloadGeneratedResume(format)` | Downloads tailored resume in specified format |
| `downloadAsText(data, filename)` | Exports resume as text file |
| `downloadAsPdf(data, filename)` | Exports resume as PDF |
| `downloadAsDocx(data, filename)` | Exports resume as DOCX |

### popup/resume-processor.js
- **Location:** `/popup/resume-processor.js`
- **Description:** Business logic for resume processing
- **Class:** `ResumeProcessor`

| Method | Description |
|--------|-------------|
| `parseResume(content)` | Parses raw resume content into structured JSON |
| `validateResume(data)` | Validates resume against schema |
| `extractSections(text)` | Extracts resume sections (experience, skills, education) |
| `tailorForJob(resume, jobDescription)` | Generates job-tailored resume using AI |

### popup/event-handlers.js
- **Location:** `/popup/event-handlers.js`
- **Description:** UI event handling and user interactions
- **Class:** `EventHandlers`

| Method | Description |
|--------|-------------|
| `setupUploadButton()` | Configures file upload input listeners |
| `setupGenerateButton()` | Configures generate button click handler |
| `setupThemeToggle()` | Configures theme switch toggle |
| `setupDownloadButtons()` | Configures download option buttons |
| `handleAPITokenInput()` | Processes API token input and validation |

### popup/storage-adapter.js
- **Location:** `/popup/storage-adapter.js`
- **Description:** Storage API wrapper for popup component
- **Class:** `StorageAdapter`

| Method | Description |
|--------|-------------|
| `getResume()` | Retrieves stored resume data |
| `setResume(data)` | Persists resume data to storage |
| `getTheme()` | Retrieves current theme preference |
| `setTheme(theme)` | Persists theme preference |
| `getAPIToken()` | Retrieves stored API token |
| `setAPIToken(token)` | Persists API token securely |

---

## Background Service Worker

### background.js
- **Location:** `/background.js` (~628 lines)
- **Description:** Service Worker handling message routing and orchestration
- **Global Variables:**
  - `apiClient` - GeminiAPIClient instance for AI operations
  - `salaryEstimator` - Salary estimation engine
  - `rateLimiter` - Request rate limiter
  - `jdCache` - Cached job descriptions (Map)
  - `resumeParseCache` - Cached parsed resumes (Map)

| Function | Lines | Description |
|----------|-------|-------------|
| `initialize()` | 26-47 | Initializes StorageManager, RateLimiter, API client, and Salary estimator |
| `executeInTab(tabId, func, args)` | 51-68 | Executes script in tab and returns result |
| `extractJDFromTab(tabId, preferAI, useCache)` | 70-137 | Extracts job description using AI or DOM selectors with caching |
| `upsertRecentJobEntry(entry)` | 139-155 | Adds or updates recent job entry in storage (max 25) |
| `handleJobChanged(request, sender, sendResponse)` | 157-??? | Queues auto-tailor job when job changes; checks AI mode and resume |
| `handleGetJobDescription(request, sender, sendResponse)` | ??? | Extracts job description using specified method (AI or standard) |
| `handleCreateTailoredResume(request, sender, sendResponse)` | ??? | Generates tailored resume using AI and job description |
| `handleBatchSalaryEstimation(request, sender, sendResponse)` | ??? | Estimates salaries for multiple jobs in parallel |
| `onMessage(request, sender, sendResponse)` | ??? | Main message router dispatching to handlers |
| `initialize()` called | ??? | Initialization on service worker startup |

---

## Content Scripts (LinkedIn Integration)

### content-scripts/linkedin/linkedin-controller.js
- **Location:** `/content-scripts/linkedin/linkedin-controller.js` (~200 lines)
- **Description:** Main controller for LinkedIn page integration
- **Class:** `LinkedInController`

| Method | Lines | Description |
|--------|-------|-------------|
| `constructor(salaryEstimator, JobSearchHandler, JobDetailsHandler, sidebar)` | | Initializes with dependencies |
| `initialize()` | | Sets up page observers and handlers |
| `attachMutationObserver()` | | Watches for page changes (SPA navigation) |
| `debouncedInitialize()` | | Debounced re-initialization (250ms) to prevent thrashing |
| `detectPageType()` | | Determines current page type (search, job details) |
| `handlePageChange()` | | Re-initializes handlers when page changes |

### content-scripts/linkedin/components/right-sidebar.js
- **Location:** `/content-scripts/linkedin/components/right-sidebar.js` (~3500 lines)
- **Description:** Monolithic right sidebar component (scheduled for modularization)
- **Class:** `ResumeHubSidebar`

| Major Section | Lines | Description |
|--------|-------|-------------|
| Constructor & Setup | | Initializes DOM, storage listeners, theme |
| AI Mode Controls | | Toggles AI mode, auto-tailor, salary filters |
| Job Context Display | | Shows current job title, company, location, salary |
| Resume Upload | | Handles resume file uploads and storage |
| Resume Tailoring | | Generates and displays tailored resumes |
| Job Insights | | Displays requirements, skills, interview questions, resources |
| Salary Display | | Fetches and displays estimated salary |
| Download Functions | | Exports resume as text, PDF, DOCX |
| Theme Management | | Switches between light/dark themes |
| Drag & Position | | Enables dragging sidebar and constrains to viewport |

**Key Methods:** `mount()`, `_loadTheme()`, `_setupAIToggle()`, `_tailorResume()`, `_displayInsights()`, `_downloadAsText()`, `_downloadAsPdf()`

### content-scripts/linkedin/components/job-insights-manager.js
- **Location:** `/content-scripts/linkedin/components/job-insights-manager.js`
- **Description:** Manages job insights display
- **Class:** `JobInsightsManager`

| Method | Description |
|--------|-------------|
| `fetchCompanyDetails(company)` | Fetches company information via AI |
| `fetchRequirements(jobDescription)` | Extracts key requirements from job description |
| `fetchSkills(jobDescription)` | Extracts required skills |
| `fetchInterviewQuestions(jobTitle, company)` | Generates interview questions |
| `fetchResources(skills)` | Suggests learning resources for skills |
| `displayInsights(container, insights)` | Renders insights to DOM |

### content-scripts/linkedin/components/salary-badge.js
- **Location:** `/content-scripts/linkedin/components/salary-badge.js`
- **Description:** Salary display badge component
- **Class:** `SalaryBadge`

| Method | Description |
|--------|-------------|
| `create(salary, position)` | Creates salary badge element |
| `inject(container)` | Injects badge into DOM at specified container |
| `update(salary)` | Updates badge content with new salary |
| `remove()` | Removes badge from DOM |
| `formatSalary(amount)` | Formats salary for display with currency |

### content-scripts/linkedin/pages/job-search-handler.js
- **Location:** `/content-scripts/linkedin/pages/job-search-handler.js`
- **Description:** Handles LinkedIn job search page events
- **Class:** `JobSearchHandler`

| Method | Description |
|--------|-------------|
| `initialize()` | Sets up observers on job search page |
| `onJobHover(jobElement)` | Fires when user hovers over job card |
| `onJobClick(jobElement)` | Fires when user clicks job listing |
| `extractJobPreview(element)` | Extracts job info from listing preview |

### content-scripts/linkedin/pages/job-details-handler.js
- **Location:** `/content-scripts/linkedin/pages/job-details-handler.js`
- **Description:** Handles LinkedIn job details page events
- **Class:** `JobDetailsHandler`

| Method | Description |
|--------|-------------|
| `initialize()` | Sets up observers on job details page |
| `extractJobDetails()` | Extracts full job information from details panel |
| `onJobDetailsLoaded()` | Fires when job details finish loading |
| `notifyJobChanged(jobData)` | Sends job change event to background |

### content-scripts/linkedin/config/selectors.js
- **Location:** `/content-scripts/linkedin/config/selectors.js`
- **Description:** LinkedIn-specific CSS selectors
- **Exports:**

| Export | Description |
|--------|-------------|
| `LINKEDIN_SELECTORS` | Object containing selectors for job cards, details, titles, companies |
| `getJobTitle()` | Finds job title element on page |
| `getCompanyName()` | Finds company name element on page |
| `getJobDescription()` | Finds job description text |
| `getSalaryElement()` | Finds salary display element |

---

## Utilities Layer

### utils/api-client.js
- **Location:** `/utils/api-client.js` (~280 lines)
- **Description:** Google Generative AI (Gemini) API client
- **Class:** `GeminiAPIClient`

| Method | Lines | Description |
|--------|-------|-------------|
| `constructor(apiKey)` | | Initializes with API key and sets up request config |
| `extractJobDescription(pageText)` | | Extracts structured job description from page text |
| `tailorResume(resume, jobDescription)` | | Generates job-tailored resume version |
| `estimateSalary(jobData)` | | Estimates salary based on job information |
| `generateInsights(jobDescription)` | | Generates interview questions, skills, resources |
| `_makeRequest(prompt, maxTokens)` | | Internal method for API calls with retry logic |
| `_handleAPIError(error)` | | Centralized error handling for API failures |

### utils/storage-manager.js
- **Location:** `/utils/storage-manager.js` (~350 lines)
- **Description:** Chrome Storage API wrapper and persistence layer
- **Class:** `StorageManager`

| Method | Description |
|--------|-------------|
| `initialize()` | Initializes storage system and loads default values |
| `get(keys, area)` | Retrieves values from Chrome storage (local or sync) |
| `set(data, area)` | Persists data to Chrome storage |
| `getResume()` | Gets current stored resume |
| `setResume(filename, content, mimeType)` | Stores resume file |
| `getAPIToken()` | Retrieves API token from secure storage |
| `setAPIToken(token)` | Securely stores API token |
| `getTheme()` | Retrieves theme preference |
| `setTheme(theme)` | Persists theme preference |
| `getRecentJobs()` | Retrieves recent job history |
| `addRecentJob(jobData)` | Adds job to recent history |
| `clear()` | Clears all user data |

### utils/logger.js
- **Location:** `/utils/logger.js` (165 lines)
- **Description:** Centralized logging system with levels and timestamps
- **Class:** `Logger`

| Method | Lines | Description |
|--------|-------|-------------|
| `constructor(context)` | | Creates logger instance with context name |
| `debug(message, ...args)` | | Logs debug level message |
| `info(message, ...args)` | | Logs info level message |
| `warn(message, ...args)` | | Logs warning level message |
| `error(message, error, ...args)` | | Logs error level message with error object |
| `child(subContext)` | | Creates child logger with nested context |

**Log Levels:** DEBUG (0), INFO (1), WARN (2), ERROR (3), NONE (4)

**Functions:**
- `createLogger(context)` - Creates Logger instance
- `setLogLevel(level)` - Sets global log level
- `getLogLevel()` - Returns current log level

### utils/unified-error-handler.js
- **Location:** `/utils/unified-error-handler.js` (~300 lines)
- **Description:** Centralized error handling and classification
- **Class:** `UnifiedErrorHandler`

| Method | Description |
|--------|-------------|
| `handle(error, context)` | Classifies and handles errors with user-friendly messages |
| `classify(error)` | Determines error type (Network, API, Validation, etc.) |
| `getRetryable(error)` | Determines if error is retryable |
| `toUserMessage(error)` | Converts error to user-friendly message |
| `log(error, context)` | Logs error with context |

**Error Types:** NetworkError, APIError, ValidationError, StorageError, TimeoutError

### utils/input-validator.js
- **Location:** `/utils/input-validator.js` (~250 lines)
- **Description:** Input validation and sanitization
- **Class:** `InputValidator`

| Method | Description |
|--------|-------------|
| `validateEmail(email)` | Validates email format |
| `validatePhone(phone)` | Validates phone number format |
| `validateFileType(file)` | Validates file type against allowed formats |
| `validateFileSize(file)` | Validates file size against limits |
| `validateResume(resumeData)` | Comprehensive resume validation |
| `validateJobDescription(jd)` | Validates job description content |
| `sanitizeText(text)` | Removes potentially harmful content from text |
| `sanitizeJSON(obj)` | Sanitizes object values |

### utils/file-downloader.js
- **Location:** `/utils/file-downloader.js` (~200 lines)
- **Description:** File download functionality (single source of truth)
- **Class:** `FileDownloader`

| Method | Description |
|--------|-------------|
| `downloadAsText(content, filename)` | Exports content as text file |
| `downloadAsPdf(content, filename)` | Exports content as PDF using pdfmake |
| `downloadAsDocx(content, filename)` | Exports content as DOCX |
| `downloadBlob(blob, filename)` | Generic blob download handler |
| `convertToText(data)` | Converts resume JSON to text format |
| `generateFilename(baseFilename, format)` | Generates filename with timestamp |

### utils/pdf-generator.js
- **Location:** `/utils/pdf-generator.js` (~200 lines)
- **Description:** PDF generation utility
- **Class:** `PDFGenerator`

| Method | Description |
|--------|-------------|
| `generate(content, options)` | Generates PDF from content with styling |
| `formatContent(resumeData)` | Formats resume data for PDF output |
| `addStyles(doc)` | Applies styling to PDF document |
| `addHeader(doc, data)` | Adds contact header to PDF |
| `addSection(doc, title, content)` | Adds formatted section to PDF |

### utils/salary-estimator.js
- **Location:** `/utils/salary-estimator.js` (~200 lines)
- **Description:** Salary estimation using AI and market data
- **Class:** `SalaryEstimator`

| Method | Description |
|--------|-------------|
| `constructor(apiClient, rateLimiter)` | Initializes with API client |
| `estimateForJob(jobData)` | Estimates salary for job posting |
| `estimateBatch(jobs)` | Batch estimates for multiple jobs |
| `parseExistingSalary(jobText)` | Extracts salary from job description |
| `formatSalaryRange(min, max, currency)` | Formats salary for display |
| `getCurrencySymbol(currency)` | Gets currency symbol for locale |

### utils/salary-parser.js
- **Location:** `/utils/salary-parser.js` (51 lines)
- **Description:** Parses salary strings to numeric values
- **Functions:**

| Function | Lines | Description |
|----------|-------|-------------|
| `parseSalaryValue(salaryStr)` | 17-49 | Converts salary string (e.g., "₹10-15L", "$100k-150k") to numeric value |

**Supported Formats:** Lakh (L), Thousand (K), Million (M), Crore (Cr)

### utils/simple-rate-limiter.js
- **Location:** `/utils/simple-rate-limiter.js` (~150 lines)
- **Description:** Request rate limiting
- **Class:** `SimpleRateLimiter`

| Method | Description |
|--------|-------------|
| `constructor(maxRequests, windowMs)` | Initializes rate limiter (e.g., 5 requests per 10 seconds) |
| `acquire()` | Acquires permission to make request; waits if limit exceeded |
| `isReady()` | Checks if request can be made without waiting |
| `reset()` | Resets rate limit window |
| `getStats()` | Returns current rate limit statistics |

### utils/parallel-processor.js
- **Location:** `/utils/parallel-processor.js` (~200 lines)
- **Description:** Parallel processing with concurrency control
- **Class:** `ParallelProcessor`

| Method | Description |
|--------|-------------|
| `process(items, processor, concurrency)` | Processes items in parallel with concurrency limit |
| `processBatch(batches, processor)` | Processes batches sequentially |
| `wait(ms)` | Utility delay function |

### utils/resume-cache-optimizer.js
- **Location:** `/utils/resume-cache-optimizer.js` (~250 lines)
- **Description:** Multi-tier caching for resume data
- **Class:** `ResumeCacheOptimizer`

| Method | Description |
|--------|-------------|
| `set(key, value, ttl)` | Stores value in cache with TTL |
| `get(key)` | Retrieves cached value if not expired |
| `has(key)` | Checks if cache key exists and is valid |
| `invalidate(key)` | Removes cached entry |
| `cleanup()` | Removes expired entries |
| `getStats()` | Returns cache hit/miss statistics |

### utils/script-injector.js
- **Location:** `/utils/script-injector.js` (~200 lines)
- **Description:** Injects and executes scripts in page context
- **Class:** `ScriptInjector`

| Method | Description |
|--------|-------------|
| `injectScript(scriptContent)` | Injects script tag into page |
| `executeInContext(func)` | Executes function in page's window context |
| `extractPageText()` | Extracts all text from page |
| `extractJobDescription()` | Uses selectors to find job description |
| `detectJobBoard()` | Identifies which job board is loaded |

### utils/shared-utilities.js
- **Location:** `/utils/shared-utilities.js` (~250 lines)
- **Description:** Common utility functions
- **Functions:**

| Function | Description |
|----------|-------------|
| `generateResumeHash(resumeData)` | Creates hash of resume for caching |
| `convertResumeJSONToText(resumeJSON)` | Formats resume JSON as plain text |
| `generateFilename(baseFilename, extension)` | Creates filename with timestamp |
| `delay(ms)` | Promise-based delay utility |
| `debounce(func, wait)` | Debounces function execution |
| `throttle(func, limit)` | Throttles function execution |
| `deepClone(obj)` | Creates deep copy of object |
| `mergeObjects(obj1, obj2)` | Merges two objects recursively |
| `getCurrentTimestamp()` | Returns current ISO timestamp |
| `isTimestampExpired(timestamp, ttl)` | Checks if timestamp is older than TTL |

### utils/sanitizer.js
- **Location:** `/utils/sanitizer.js` (185 lines)
- **Description:** HTML sanitization to prevent XSS attacks
- **Class:** `Sanitizer`

| Method | Lines | Description |
|--------|-------|-------------|
| `sanitizeHTML(html)` | | Sanitizes HTML string by escaping tags |
| `sanitizeText(text)` | | Removes all HTML and returns plain text |
| `sanitizeURL(url)` | | Prevents javascript: and data: protocol attacks |
| `sanitizeObject(obj, sanitizeKeys)` | | Recursively sanitizes all strings in object |
| `safeSetInnerHTML(element, content)` | | Safely sets innerHTML with automatic sanitization |
| `createSafeElement(tagName, attributes, content)` | | Creates DOM element with sanitized content |
| `escapeHTML(text)` | | Escapes HTML special characters |

### utils/request-validator.js
- **Location:** `/utils/request-validator.js` (137 lines)
- **Description:** Message request validation with schemas
- **Functions:**

| Function | Lines | Description |
|----------|-------|-------------|
| `validateRequest(request, schema)` | 13-57 | Validates request structure against schema |
| `getSchemaForAction(action)` | 126-129 | Returns validation schema for action type |

**Request Schemas:**
- `batchSalaryEstimation` - Validates array of jobs
- `createTailoredResume` - Validates resume and job description
- `getJobDescription` - Validates extraction method and API token
- `jobChanged` - Validates job data fields
- `setAPIToken` - Validates API token string
- `setResume` - Validates resume file data
- `estimateSalaryWithJD` - Validates job information
- `getAIResponse` - Validates prompt text

---

## CSS & Styling

### css/design-tokens.css
- **Location:** `/css/design-tokens.css` (82 lines)
- **Description:** Design system tokens shared across popup and sidebar
- **Key Token Categories:**

| Category | Lines | Description |
|----------|-------|-------------|
| Typography | 6-11 | Font families, sizes (12-16px), line height, letter spacing |
| Spacing | 13-19 | Spacing scale (xs: 4px to 2xl: 24px) |
| Border Radius | 21-24 | Radius values (sm: 8px to lg: 16px) |
| Shadows | 26-31 | Layered shadows for depth (sm to xl) |
| Colors (Light) | 33-44 | Light theme palette (background, text, border, accent) |
| Semantic Colors | 46-51 | Success, warning, danger, info colors |
| Transitions | 53-56 | Animation durations (fast: 150ms to slow: 300ms) |
| Dark Theme | 59-82 | Dark theme color overrides |

### css/popup_modern.css
- **Location:** `/css/popup_modern.css`
- **Description:** Popup component styling
- **Key Sections:**
  - Container layout and sizing
  - Header styling and typography
  - Form elements (input, button, textarea)
  - Status messages and notifications
  - Theme-specific colors
  - Responsive design for different popup sizes

---

## Library Files

### lib/pdfmake.min.js
- **Location:** `/lib/pdfmake.min.js`
- **Description:** PDFMake library minified for PDF generation
- **Usage:** Used by `PDFGenerator` class to create PDF files from content

### lib/vfs_fonts.js
- **Location:** `/lib/vfs_fonts.js`
- **Description:** Font files for PDFMake
- **Contents:** Base64-encoded font data for PDF rendering

---

## File Statistics

| Category | Count | Total Lines |
|----------|-------|------------|
| Entry Points | 2 | 46 |
| Core Configuration | 3 | 325 |
| Popup (Frontend) | 6 | ~1,500 |
| Background Service Worker | 1 | ~628 |
| Content Scripts | 6 | ~4,000 |
| Utilities | 13 | ~3,200 |
| CSS & Design | 2 | ~150 |
| Libraries | 2 | ~50,000+ |
| **TOTAL** | **~35** | **~59,850+** |

---

## Architecture Overview

### Layer Structure

```
┌─────────────────────────────────────────────────────────────┐
│  PRESENTATION LAYER                                         │
│  (popup.html, popup.js, popup/* components)                │
│  • User Interface                                           │
│  • State Management (StateManager)                          │
│  • Event Handling (EventHandlers)                           │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  APPLICATION LAYER                                          │
│  (app-controller.js, resume-processor.js)                  │
│  • Business Logic Coordination                              │
│  • Resume Processing                                        │
│  • User Input Handling                                      │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  SERVICE WORKER (background.js)                            │
│  • Message Routing                                          │
│  • API Orchestration                                        │
│  • State Synchronization                                    │
│  • Cache Management                                         │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  INFRASTRUCTURE LAYER                                       │
│  (utils/*)                                                  │
│  • API Client (api-client.js)                              │
│  • Storage (storage-manager.js)                            │
│  • Logging (logger.js)                                     │
│  • Error Handling (unified-error-handler.js)               │
│  • Rate Limiting (simple-rate-limiter.js)                  │
│  • Validation (input-validator.js, request-validator.js)   │
│  • Security (sanitizer.js)                                 │
│  • Utilities (shared-utilities.js, etc.)                   │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  EXTERNAL INTEGRATIONS                                      │
│  • Google Generative AI (Gemini API)                       │
│  • LinkedIn Page DOM                                        │
│  • Chrome APIs (storage, scripting, runtime)               │
│  • Third-party Libraries (pdfmake)                         │
└─────────────────────────────────────────────────────────────┘
```

### Content Script Integration

```
┌────────────────────────────────────────────────────────┐
│  LinkedIn Page (linkedin-controller.js)                │
│  • Detects job search and job details pages            │
│  • Manages JobSearchHandler and JobDetailsHandler      │
│  • Mounts ResumeHubSidebar component                   │
└────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────┐
│  ResumeHubSidebar (right-sidebar.js)                  │
│  • Displays job context (title, company, location)    │
│  • Shows salary estimates (SalaryBadge)                │
│  • Provides resume tailoring interface                │
│  • Displays job insights and analysis                 │
│  • Manages theme switching                            │
│  • Handles drag and positioning                       │
└────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────┐
│  Background Service Worker (background.js)             │
│  • Processes messages from sidebar                    │
│  • Calls Gemini API for AI features                   │
│  • Caches results for performance                     │
│  • Manages rate limiting                              │
└────────────────────────────────────────────────────────┘
```

### Data Flow: Resume Tailoring

```
1. User uploads resume in popup
   └→ FileHandlers.handleResumeUpload()
      └→ StorageManager.setResume()

2. User navigates to LinkedIn job posting
   └→ LinkedInController.initialize()
      └→ ResumeHubSidebar.mount()

3. Job details detected
   └→ JobDetailsHandler.onJobDetailsLoaded()
      └→ background.js: handleJobChanged()

4. User clicks "Tailor Resume"
   └→ ResumeHubSidebar._tailorResume()
      └→ background.js: handleCreateTailoredResume()
         └→ GeminiAPIClient.tailorResume()
            └→ API Call to Gemini

5. Tailored resume displayed
   └→ ResumeHubSidebar._displayTailoredResume()

6. User clicks "Download"
   └→ FileDownloader.downloadAsText/Pdf/Docx()
      └→ Browser download
```

---

## Key Dependencies & Imports

### External APIs
- **Google Generative AI (Gemini):** Used in `api-client.js` for AI-powered resume tailoring, job description extraction, and salary estimation

### Chrome APIs
- **chrome.storage:** Persistent data storage (local and sync areas)
- **chrome.runtime:** Message passing and extension lifecycle
- **chrome.scripting:** Script injection into content pages
- **chrome.tabs:** Tab management and navigation detection

### Third-party Libraries
- **pdfmake:** PDF generation library
- **vfs_fonts:** Font support for PDFMake

### Internal Module Dependencies
- `constants.js` ← used by most utility modules
- `app-config.js` ← used for feature flags and configuration
- `storage-manager.js` ← used by API client, resume processor
- `logger.js` ← used by all major components
- `unified-error-handler.js` ← centralized error handling
- `input-validator.js` ← used for validation
- `sanitizer.js` ← security layer for user input

---

## Future Modularization Notes

### Scheduled for Refactoring
1. **right-sidebar.js** - Will be split into:
   - DragManager, ThemeManager, AIControlsManager, AutoTailorManager
   - ResumeManager, JobContextManager, EventManager
   - JobInsightsService, SalaryService, AIService, StorageService
   - Separate style files and HTML templates

2. **Enterprise Architecture Migration**
   - Full 5-layer architecture (Presentation, Application, Domain, Infrastructure, Foundation)
   - Service Locator pattern for dependency injection
   - Domain-driven design with 5 business domains (Resume, Job, Salary, Insights, AI)
   - Comprehensive test coverage

---

**Document Version:** 1.0  
**Last Updated:** November 16, 2025  
**Maintained By:** ResumeHub Development Team
