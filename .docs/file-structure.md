# ResumeHub File and Function Structure

This document provides a complete breakdown of all actual files in the ResumeHub-v1 extension, including functions and their one-line descriptions.

---

## 📂 Extension Core Layer (Root)

### 📄 `background.js`
**Description**: Service worker handling API proxies, salary estimation routing, telemetry reporting, and extension lifecycle events.
**Functions**:
- `ACTION_HANDLERS`: Maps messaging action types (e.g. `getSettings`, `setAPIToken`, `estimateSalaryWithJD`) to their execution handlers.
- `chrome.runtime.onMessage.addListener(...)`: Main chrome extension event listener coordinating asynchronous messaging between content scripts, popups, and utility models.
- `chrome.runtime.onInstalled.addListener(...)`: Handles installation lifecycle, setting default sync configurations in storage.

### 📄 `popup.html`
**Description**: Popup interface layout structure showing API settings, resume upload status, and testing utilities.

### 📄 `popup.js`
**Description**: Main execution entry point for the popup interface.
**Functions**:
- `document.addEventListener('DOMContentLoaded', ...)`: Initializes the core Popup App Controller.
- `showError(message)`: Renders error messages in the DOM if initialization fails.

### 📄 `manifest.json`
**Description**: Manifest configuration specifying scripts, permissions, styles, and extension rules.

---

## 📂 Popup Module (`popup/`)

### 📄 `popup/app-controller.js`
**Description**: Main orchestrator of the popup's MVVM lifecycle.
**Functions**:
- `constructor()`: Instantiates state placeholders.
- `initialize()`: Sets up the managers, storage, and UI states.
- `getStatus()`: Returns current status indicators for debugging.
- `restart()`: Reboots the controller state.
- `shutdown()`: Cleans up running resources.

### 📄 `popup/storage-adapter.js`
**Description**: Wraps storage message dispatches to the background service worker.
**Functions**:
- `getSettings()`: Retrieves theme and extraction methods.
- `setSetting(key, value)`: Updates key-value configurations.
- `getResume()`: Fetches uploaded resume binary.
- `setResume(filename, content, mimeType)`: Saves resume data.
- `clearResume()`: Removes uploaded resume.
- `getAPIToken()`: Retrieves stored API keys.
- `setAPIToken(token)`: Saves API token.
- `clearAPIToken()`: Removes API token.

### 📄 `popup/file-handlers.js`
**Description**: Coordinates resume file uploads, read streams, and tailored resume downloads.
**Functions**:
- `constructor(stateManager, uiManager)`: Links state and UI management contexts.
- `handleResumeUpload(file)`: Validates, reads, and updates state with uploaded resumes.
- `readFileContent(file)`: Resolves file content as text or ArrayBuffer.
- `downloadGeneratedResume(format)`: Dispatches file generation (PDF, DOCX, TXT).
- `_downloadAsPdf(resumeJSON, filename)`: Triggers PDF export.
- `_downloadAsDocx(resumeJSON, filename)`: Triggers DOCX template file export.
- `_downloadAsText(resumeJSON, filename)`: Exports resume as standard formatting text.

### 📄 `popup/resume-processor.js`
**Description**: Handles job description previewing, AI tailoring triggers, and auto-form filling workflows.
**Functions**:
- `constructor(stateManager, uiManager)`: Connects processor to state and UI contexts.
- `generateTailoredResume()`: Coordinates background tailoring requests.
- `handlePreviewResponse(response)`: Populates preview fields in the UI.
- `autoFillForm()`: Sends message to active tab to trigger forms auto-filling.

### 📄 `popup/state-manager.js`
**Description**: MVVM state manager storing token, theme, and processing indicators.
**Functions**:
- `subscribe(key, callback)`: Binds callback methods to state changes.
- `setState(key, value, saveToStorage)`: Mutates states and syncs with persistent local adapters.
- `validateForGeneration()`: Checks requirements for trigger generation.

### 📄 `popup/ui-manager.js`
**Description**: Direct DOM access and UI element updates.
**Functions**:
- `applyTheme(theme)`: Switches styles for dark or light modes.
- `updateStatus(message, type)`: Updates application logging status texts.
- `setButtonLoading(button, isLoading)`: Adjusts loading flags and text for actions buttons.

### 📄 `popup/event-handlers.js`
**Description**: Sets up event listeners, keyboard shortcuts, and drag-and-drop triggers for the popup UI.
**Functions**:
- `initializeAllEvents()`: Connects DOM click, change, and key events to respective handlers.
- `initializeDragAndDrop()`: Configures file upload zones.

---

## 📂 Content Scripts Layer (`content-scripts/`)

### 📂 LinkedIn Integration (`content-scripts/linkedin/`)
* **`linkedin-controller.js`**: Orchestrates SPA URL changes, observes mutations, and mounts handlers.
  * *Functions*: `setupEventListeners()`, `setupMutationObserver()`, `initialize()`, `handleUrlChange()`, `destroy()`.
* **`config/selectors.js`**: Static dictionary of CSS query strings targeting LinkedIn job components.
* **`components/right-sidebar.js`**: Renders and wires the modern AI matching drawer on LinkedIn details page.
  * *Functions*: `mount()`, `unmount()`, `updateJobData()`, `_handleTailorClick()`, `_storeTailoredResume()`, `_downloadResume()`.
* **`components/job-insights-manager.js`**: Visualizes skills checklist, potential interview prep, and resources.
  * *Functions*: `update(jobData)`, `_renderInsights()`, `_fetchInsights()`.
* **`components/salary-badge.js`**: Elegant badge injection next to LinkedIn titles showing salary ranges.
  * *Functions*: `create()`, `showLoading()`, `showSalary()`, `showError()`.
* **`pages/job-details-handler.js`**: Controls extraction details and mounts elements on full-page detail views.
  * *Functions*: `initialize()`, `processJobDetails()`, `extractJobData()`, `createSalaryBadge()`.
* **`pages/job-search-handler.js`**: Renders batch estimates and badges on active search list results cards.
  * *Functions*: `initialize()`, `processAllVisibleJobs()`, `processJobCards()`, `retryFailedJobs()`.

### 📂 Naukri Integration (`content-scripts/naukri/`)
* **`naukri-controller.js`**: Controls site layout initialization and detects active tabs.
  * *Functions*: `setupEventListeners()`, `initialize()`, `handleUrlChange()`, `destroy()`.
* **`config/selectors.js`**: Target selectors query maps for Naukri lists and panels.
* **`components/salary-badge.js`**: Embeds compensation badge details inside Naukri listings.
  * *Functions*: `create()`, `showSalary()`, `showError()`.
* **`pages/job-details-handler.js`**: Parses Naukri detailed description parameters to compute values.
  * *Functions*: `initialize()`, `processJobDetails()`, `extractJobData()`.
* **`pages/job-search-handler.js`**: Tracks lazy scrolling results and queries batch listings on Naukri searches.
  * *Functions*: `initialize()`, `processAllVisibleJobs()`, `processJobCards()`, `extractJobData()`.

### 📂 Instahyre Integration (`content-scripts/instahyre/`)
* **`instahyre-controller.js`**: Controller monitoring Instahyre URL routing and details card states.
  * *Functions*: `setupEventListeners()`, `initialize()`, `handleUrlChange()`, `destroy()`.
* **`config/selectors.js`**: Instahyre CSS selector reference points.
* **`components/salary-badge.js`**: UI badges reporting Instahyre salary predictions.
  * *Functions*: `create()`, `showSalary()`, `showError()`.
* **`pages/job-details-handler.js`**: Extracts Instahyre job metadata and company info.
  * *Functions*: `initialize()`, `processJobDetails()`, `extractJobData()`.
* **`pages/job-search-handler.js`**: Batches query data and mounts components on cards list view in Instahyre search panel.
  * *Functions*: `initialize()`, `processAllVisibleJobs()`, `processJobCards()`, `extractJobData()`.

---

## 📂 Utilities and Adapters (`utils/`)

### 📄 `utils/api-client.js`
**Description**: Network client coordinating calls to Gemini LLM model API or the self-hosted Flask API.
**Functions**:
- `callAPI(model, prompt, options)`: Invokes direct Google Gemini endpoint queries.
- `tailorResume(resumeData, jobDescription)`: Dispatches AI prompts to tailor resumes.
- `estimateSalary(jobTitle, location, companyName, jobUrl)`: Queries the duckdns backend API for salary estimation.
- `batchEstimateSalary(batchRequest)`: Batch queries backend proxy API for salary arrays.

### 📄 `utils/storage-manager.js`
**Description**: Direct persistent browser local and sync storage interfaces.
**Functions**:
- `getSettings()`, `setSetting(key, value)`: Core configuration handlers.
- `getResume()`, `setResume(filename, content, mimeType)`: Persistence managers for uploaded resumes.
- `getValidCache(key)`: Fetches non-expired cached entries.
- `setCacheWithExpiry(key, value, hours)`: Persists entries with validation lifetimes.

### 📄 `utils/salary-estimator.js`
**Description**: Coordinates database caches, backend API queries, and direct direct fallback methods.
**Functions**:
- `estimate(...)`: Estimates salary for details page.
- `batchEstimate(...)`: Batches multiple card estimates simultaneously.
- `_checkCache(...)`: Pulls local estimates if available to avoid redundant network hits.

### 📄 `utils/salary-parser.js`
**Description**: Parses salary strings into numerical ranges, currencies, and payment schedules.
**Functions**:
- `parse(salaryString)`: Extracts ranges and structures raw texts.
- `_normalize(...)`: Removes formatting clutter (commas, spaces).

### 📄 `utils/pdf-generator.js`
**Description**: Generates formatted PDF resume structures using the `pdfMake` library.
**Functions**:
- `generatePDF(resumeData)`: Builds document visual streams.
- `_createDocumentDefinition(...)`: Compiles sections layout rules (Education, Skills, Experience).

### 📄 `utils/docx-generator.js`
**Description**: Generates DOCX files. Currently acts as a formatter placeholder downloading formatted text.
**Functions**:
- `generateDocx(resumeJSON)`: Compiles data structure for download.

### 📄 `utils/unified-error-handler.js`
**Description**: Standardizes exception reporting, logs issues to background telemetry, and yields user-friendly errors.
**Functions**:
- `handleError(error, context)`: Central log router.
- `classifyError(error)`: Yields Network, API, or local storage validation classes.

### 📄 `utils/simple-rate-limiter.js`
**Description**: Prevents API throttling using request delay queues.
**Functions**:
- `queueRequest(requestFn, operation)`: Buffers API triggers.
- `processQueue()`: Executes requests adhering to safe pacing limits.

### 📄 `utils/parallel-processor.js`
**Description**: Processes batches using a configured concurrency limit.
**Functions**:
- `process(items, processFn, concurrency)`: Splits tasks into chunks to avoid browser blockages.

### 📄 `utils/sanitizer.js`
**Description**: Sanitizes input strings to protect against code injection.
**Functions**:
- `sanitizeHTML(html)`: Standardizes safe attributes and DOM elements.

### 📄 `utils/input-validator.js`
**Description**: Validates format parameters before transmission.
**Functions**:
- `validateResume(file)`: Ensures size, type, and contents meet upload criteria.

### 📄 `utils/request-validator.js`
**Description**: Validates runtime message signatures.
**Functions**:
- `validateRequest(request, schema)`: Asserts message parameters.

### 📄 `utils/script-injector.js`
**Description**: Safely appends stylesheet rules and JS modules to active pages.
**Functions**:
- `injectCSS(file)`, `injectScript(file)`: Appends styling or script elements directly to DOM headers.

### 📄 `utils/resume-cache-optimizer.js`
**Description**: Helper containing caching rules and storage weight checks.

### 📄 `utils/shared-utilities.js`
**Description**: Core shared helpers. Includes functions: `debounce(func, wait)`, `throttle(func, limit)`, `delay(ms)`.

---

## 📂 Backend Server (`backend/`)

### 📄 `backend/resumehub_api.py`
**Description**: Python Flask API microservice coordinating AI estimation prompts, token aggregation, and database caches.
**Functions**:
- `get_db_connection()`: Provides thread-safe SQLite connection handles.
- `init_db()`: Initializes SQL schema databases.
- `query_cache(job_title, location, company_name)`: Fetches cached salaries.
- `cache_result(job_title, location, company_name, min_sal, max_sal, currency)`: Writes calculated ranges.
- `query_llm(...)`: Contacts Gemini or Groq model services to predict salary brackets from details context.
- `/api/salary-estimate` [POST]: Primary entry point returning predicted brackets for single or batched lists.
- `/api/get-ai-response` [POST]: Proxy endpoint routing client-side resume tailoring prompts.
- `/api/salary-estimate/report` [POST]: Allows client instances to write validated API estimate fallbacks back into database.
