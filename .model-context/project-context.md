# Project Overview

ResumeHub is a sophisticated Chrome extension designed to streamline the job application process. It leverages Google's Gemini AI to automatically tailor a user's resume to a specific job description, ensuring that the most relevant skills and experiences are highlighted. Key features include AI-powered resume analysis, section-by-section optimization, intelligent form auto-filling on application pages, and advanced job description extraction. The extension provides a modern, user-friendly interface with light and dark themes, and it supports downloading the tailored resume in multiple formats (PDF, DOCX, TXT).

# Architecture Patterns

The project is built on a clean, **4-layer modular architecture** to ensure separation of concerns, maintainability, and scalability.

1.  **Frontend Layer (Popup)**: This layer is responsible for the user interface and local interactions within the extension's popup. It's built with vanilla JavaScript, HTML, and CSS, and it's composed of several coordinated modules:
    *   `AppController`: Orchestrates the initialization and communication between popup modules.
    *   `StateManager`: A centralized, reactive state store that manages all application data (resume, API key, UI state, etc.) and uses a publish/subscribe pattern to notify other modules of changes.
    *   `UIManager`: Manages all DOM manipulations, including theme changes, status updates, and dynamic UI components.
    *   `FileHandlers`: Handles all file-related operations, such as resume uploads and downloads in various formats.
    *   `ResumeProcessor`: Coordinates the core business logic, like initiating resume tailoring or form filling.
    *   `EventHandlers`: Manages all user interactions and events within the popup.

2.  **Backend Layer (Service Worker)**: This layer runs in the background (`background.js`) and handles tasks that require persistence or communication with external APIs.
    *   It acts as a message router, receiving commands from the frontend.
    *   Handles all communication with the Google Gemini API for tasks like resume tailoring, job description extraction, and form-field mapping.
    *   Manages long-running processes to avoid blocking the UI.

3.  **Utility Layer**: A collection of shared, reusable modules that provide core functionality across the extension.
    *   `GeminiAPIClient`: A dedicated client for all interactions with the Google Gemini API.
    *   `StorageManager`: An abstraction layer for all `chrome.storage` operations, ensuring consistent and reliable data persistence.
    *   `ScriptInjector`: Manages all interactions with the active web page, such as extracting text or filling forms.
    *   `UnifiedErrorHandler`: A centralized system for classifying, handling, and displaying errors.
    *   `ParallelProcessor`: Optimizes performance by running multiple API calls concurrently.
    *   `ResumeCacheOptimizer`: An intelligent caching system to reduce redundant API calls for resume parsing.
    *   `SimpleRateLimiter`: Manages API call frequency to avoid hitting rate limits.

4.  **External Integration Layer**: This layer represents the external services the extension relies on.
    *   **Google Gemini API**: For all AI-powered features.
    *   **Chrome Extension APIs**: For storage, scripting, messaging, and other browser-level interactions.

# Code Style Guide

The project follows a modern JavaScript style with a focus on clarity and maintainability.

*   **Syntax**: ES6+ features, including `class`, `async/await`, `const`/`let`, and modules (`import`/`export`).
*   **Structure**: The code is highly modular, with each class residing in its own file and responsible for a specific concern.
*   **Naming Conventions**:
    *   Classes: `PascalCase` (e.g., `StateManager`).
    *   Methods & Variables: `camelCase` (e.g., `handleResumeUpload`).
    *   Constants: `UPPER_CASE_SNAKE` (e.g., `MAX_RETRIES`).
*   **Comments**: JSDoc-style comments are used for classes and functions to explain their purpose, parameters, and return values. Inline comments are used sparingly for non-obvious logic.
*   **Error Handling**: All operations that can fail (API calls, file operations, etc.) are wrapped in `try...catch` blocks and use the `UnifiedErrorHandler` for consistent error management.
*   **Asynchronicity**: `async/await` is used for all asynchronous operations to improve readability and avoid callback hell.

# Current Challenges

The project is mature and well-optimized, but there are ongoing areas for improvement as outlined in the project roadmap.

*   **UX Enhancements**: The current focus (Phase 6) is on improving the user experience with better real-time progress indicators, a toast notification system, and more robust error recovery mechanisms.
*   **Performance Optimization**: While the system is already optimized, future plans (Phase 7) include an advanced caching system with smart invalidation and further memory optimization to handle very large documents or complex job applications seamlessly.
*   **Known Issues**:
    *   Processing very large resume files (>5MB) can be slow.
    *   Auto-filling may not work perfectly on websites with highly complex or non-standard form structures, sometimes requiring manual user verification.

# Success Criteria

A successful implementation of this project is defined by the following criteria:

*   **Maintainability**: The 4-layer architecture is strictly followed, and all new features are implemented in a modular and decoupled way. Code duplication remains below 5%.
*   **Performance**: The extension remains highly responsive. Resume generation and form-filling operations provide clear, real-time feedback and complete in a timely manner. API call usage is minimized through effective caching (`ResumeCacheOptimizer`) and rate limiting.
*   **Reliability**: The application is robust, with comprehensive error handling (`UnifiedErrorHandler`) for all potential failure points (API issues, network errors, file errors, etc.). The system can gracefully recover from and provide clear feedback on non-critical errors.
*   **Accuracy**: The AI-powered features deliver high-quality results. Resume tailoring accurately reflects the job description, and form-filling correctly maps resume data to form fields.
*   **User Experience**: The user interface is intuitive, and all asynchronous operations provide clear visual feedback (e.g., loading spinners, status messages). Users are never left guessing about the application's state.
