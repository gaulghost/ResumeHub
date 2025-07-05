# Technology Stack

The ResumeHub extension is built with modern, lightweight web technologies, avoiding heavy frameworks to ensure performance and maintainability.

*   **Core Technologies**:
    *   **JavaScript (ES6+)**: The entire extension logic is written in modern, vanilla JavaScript, utilizing features like `async/await`, `class` syntax, and modules.
    *   **HTML5 & CSS3**: Used for the structure and styling of the popup interface.

*   **Platform**:
    *   **Chrome Extension (Manifest V3)**: The extension is built following the latest Chrome standards for security, performance, and privacy.

*   **Key Libraries**:
    *   **pdfmake.js**: A client-side library used for generating PDF versions of the tailored resumes directly in the browser.
    *   **vfs\_fonts.js**: Provides the virtual font system required by `pdfmake.js`.

*   **Development & Build Tooling**:
    *   **Node.js & npm**: Used for managing development dependencies and running build scripts.
    *   **Terser**: For minifying and obfuscating JavaScript code for the production build, reducing file size and protecting the source.
    *   **clean-css-cli**: For minifying CSS files to optimize loading times.
    *   **Bash Script (`build.sh`)**: A custom build script automates the entire process of creating a production-ready `.zip` file, including minification, file combination, and packaging.

# Performance Requirements

Performance is a critical aspect of the user experience, with a focus on speed, responsiveness, and efficient resource usage.

*   **Speed & Responsiveness**:
    *   **UI**: The popup UI must load instantly and remain responsive at all times. All long-running tasks (like API calls) are offloaded to the background service worker to prevent UI blocking.
    *   **Resume Generation**: The end-to-end process of tailoring a resume is optimized for speed using parallel processing (`ParallelProcessor`) for API calls to different resume sections.
    *   **API Calls**: API interactions are managed by a `SimpleRateLimiter` (configured for 10 requests/minute, 3 concurrent) to prevent hitting Google's rate limits, ensuring the extension remains functional without interruption.

*   **Memory Usage**:
    *   The extension is designed to have a low memory footprint.
    *   There is a hard limit of **10MB** for uploaded resume files to prevent excessive memory consumption during file processing.
    *   The roadmap includes further memory optimization and leak prevention as a key objective.

*   **Scalability & Constraints**:
    *   **AI Word Limits**: The system is designed to keep tailored resumes within a professional length, strictly adhering to a limit of **570 words / 3650 characters**.
    *   **Caching**: An intelligent, multi-pass caching system (`ResumeCacheOptimizer`) is implemented to minimize redundant API calls, reducing costs and improving performance on subsequent runs with the same resume.
    *   **Modular Architecture**: The 4-layer architecture allows for easy addition of new features or integration with other job boards without requiring a major refactor.

# Integration Points

The extension integrates with several internal and external systems to deliver its functionality.

*   **External APIs**:
    *   **Google Gemini API**: This is the core external integration for all AI-powered features, including resume parsing, section tailoring, job description extraction, and form-field mapping. All interactions are managed through a dedicated `GeminiAPIClient`.

*   **Browser & Web Page Integration**:
    *   **Chrome Extension APIs**: The extension heavily relies on Chrome's APIs for its core functionality:
        *   `chrome.storage`: For all data persistence, managed by the `StorageManager`.
        *   `chrome.scripting`: For injecting scripts into web pages to extract content and fill forms, managed by the `ScriptInjector`.
        *   `chrome.runtime`: For messaging between the popup, content scripts, and the background service worker.
        *   `chrome.tabs`: For querying and interacting with browser tabs.
    *   **Web Page DOM**: The `ScriptInjector` directly interacts with the DOM of job application websites to extract form field information and inject tailored resume data.

*   **Databases**:
    *   There is no external database. `chrome.storage` (`local` and `sync`) serves as the application's database for storing the user's API key, resume data, settings, and cache.

# Deployment Environment

*   **Runtime Environment**: The extension runs entirely within the Google Chrome browser on the user's local machine. It is compatible with any operating system that supports Google Chrome (Windows, macOS, Linux).
*   **Distribution**: The extension is designed to be packaged as a `.zip` file and distributed through the **Chrome Web Store**.
*   **Build Process**: The `build.sh` script creates a production-ready build by:
    1.  Cleaning previous build artifacts.
    2.  Copying essential files (`manifest.json`, assets, etc.).
    3.  Combining and minifying all JavaScript and CSS files.
    4.  Updating the `popup.html` to reference the new minified assets.
    5.  Adding a simple layer of obfuscation and anti-copy protection.
    6.  Packaging the entire `build_resumehub/` directory into a timestamped `.zip` file, ready for upload.
