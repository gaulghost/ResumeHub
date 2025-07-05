# ResumeHub – Smart Resume & Job Form Assistant

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?logo=google-chrome)](https://chrome.google.com/webstore)
[![Version](https://img.shields.io/badge/version-1.1-green)](https://github.com/gaulghost/ResumeHub)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

> **Tailor your resume to any job description and auto-fill job forms using AI.**

ResumeHub is a sophisticated Chrome extension designed to streamline the job application process. It leverages Google's Gemini AI to automatically tailor a user's resume to a specific job description, ensuring that the most relevant skills and experiences are highlighted. Key features include AI-powered resume analysis, section-by-section optimization, intelligent form auto-filling on application pages, and advanced job description extraction.

## ✨ Features

### 🎯 **Smart Resume Tailoring**
- **AI-Powered Analysis**: Uses Google Gemini to analyze job descriptions and match relevant skills
- **Section Optimization**: Automatically tailors summary, experience, skills, and projects sections
- **Multiple Formats**: Download tailored resumes in TXT, PDF, or DOCX formats
- **Word Limit Compliance**: Maintains professional resume length (570 words / 3650 characters)

### 📝 **Intelligent Form Auto-Fill**
- **Field Detection**: Automatically identifies form fields on job application pages
- **Smart Mapping**: Maps resume data to appropriate form fields using AI
- **Batch Processing**: Efficiently handles multiple fields with rate limiting
- **Visual Feedback**: Highlights filled fields for user verification

### 🔍 **Job Description Extraction**
- **Standard Extraction**: Fast DOM-based job description detection
- **AI Extraction**: Advanced AI-powered cleaning and formatting
- **Manual Input**: Direct job description input for maximum control
- **Preview Function**: Review extracted content before processing

### 🎨 **Modern User Experience**
- **Clean Interface**: Intuitive card-based design with collapsible sections
- **Dark/Light Themes**: Automatic theme switching with preference persistence
- **Loading States**: Real-time progress indicators for all operations
- **Error Handling**: Comprehensive error messages with suggested solutions
- **Keyboard Shortcuts**: Quick access via Ctrl+Enter (generate) and Ctrl+P (preview)

## 🚀 Quick Start

### Installation
1. Download the extension from the Chrome Web Store (coming soon) or install manually
2. Get a [Google Gemini API key](https://makersuite.google.com/app/apikey)
3. Click the ResumeHub icon in your Chrome toolbar
4. Enter your API key in the configuration section
5. Upload your resume file (PDF, DOC, DOCX, or TXT)

### Basic Usage
1. **Navigate** to a job posting webpage
2. **Open** ResumeHub popup
3. **Click** "Preview Job Description" to extract job details
4. **Click** "Generate Tailored Resume" to create customized version
5. **Download** in your preferred format
6. **Use** "Auto-Fill Current Form" on application pages

## 🏗️ Architecture

The project is built on a clean, **4-layer modular architecture** to ensure separation of concerns, maintainability, and scalability.

### 1. Frontend Layer (Popup)
This layer is responsible for the user interface and local interactions within the extension's popup. It's built with vanilla JavaScript, HTML, and CSS, and it's composed of several coordinated modules:
- **`AppController`**: Orchestrates the initialization and communication between popup modules.
- **`StateManager`**: A centralized, reactive state store that manages all application data (resume, API key, UI state, etc.) and uses a publish/subscribe pattern to notify other modules of changes.
- **`UIManager`**: Manages all DOM manipulations, including theme changes, status updates, and dynamic UI components.
- **`FileHandlers`**: Handles all file-related operations, such as resume uploads and downloads in various formats.
- **`ResumeProcessor`**: Coordinates the core business logic, like initiating resume tailoring or form filling.
- **`EventHandlers`**: Manages all user interactions and events within the popup.

### 2. Backend Layer (Service Worker)
This layer runs in the background (`background.js`) and handles tasks that require persistence or communication with external APIs.
- It acts as a message router, receiving commands from the frontend.
- Handles all communication with the Google Gemini API for tasks like resume tailoring, job description extraction, and form-field mapping.
- Manages long-running processes to avoid blocking the UI.

### 3. Utility Layer
A collection of shared, reusable modules that provide core functionality across the extension.
- **`api-client.js`**: A dedicated client for all interactions with the Google Gemini API.
- **`storage-manager.js`**: An abstraction layer for all `chrome.storage` operations.
- **`script-injector.js`**: Manages interactions with the active web page, such as extracting text or filling forms.
- **`unified-error-handler.js`**: A centralized system for classifying, handling, and displaying errors.
- **`parallel-processor.js`**: Optimizes performance by running multiple API calls concurrently.
- **`resume-cache-optimizer.js`**: An intelligent caching system to reduce redundant API calls.
- **`simple-rate-limiter.js`**: Manages API call frequency to avoid hitting rate limits.

### 4. External Integration Layer
This layer represents the external services the extension relies on.
- **Google Gemini API**: For all AI-powered features.
- **Chrome Extension APIs**: For storage, scripting, messaging, and other browser-level interactions.

## 📊 Performance Features

- **Optimized for Speed**: The UI loads instantly and remains responsive by offloading long-running tasks to the background service worker. Resume generation is accelerated using parallel processing for API calls.
- **Efficient API Usage**: API interactions are carefully managed by a `SimpleRateLimiter` (10 requests/minute, 3 concurrent) to prevent hitting rate limits. An intelligent `ResumeCacheOptimizer` significantly reduces redundant API calls, lowering costs and improving speed on subsequent runs.
- **Low Resource Consumption**: The extension is designed for a low memory footprint, with a 10MB limit on resume uploads to ensure smooth performance.
- **Maintainable by Design**: The modular architecture has led to an **87% reduction** in code duplication and makes the system easier to maintain and extend.

## 🧪 Testing

### Automated Tests
Run the comprehensive test suite:
```bash
# Open in Chrome extension context
tests/comprehensive-test.html
```

### Manual Testing
Follow the detailed manual testing guide:
```bash
# User testing procedures
tests/manual-test-guide.html
```

### Test Coverage
- ✅ Module loading and initialization
- ✅ UI components and interactions
- ✅ State management and persistence
- ✅ Theme system functionality
- ✅ File operations (upload/download)
- ✅ API integration and error handling
- ✅ Background script communication
- ✅ Form detection and auto-fill

## 🔧 Development

### Technology Stack
- **Core**: JavaScript (ES6+), HTML5, CSS3
- **Platform**: Chrome Extension (Manifest V3)
- **Key Libraries**: `pdfmake.js` for client-side PDF generation
- **Build Tooling**: `Terser`, `clean-css-cli`, and a custom Bash script (`build.sh`) for creating production-ready builds.

### Prerequisites
- Chrome Browser (latest version)
- Google Gemini API key
- Basic understanding of Chrome Extensions

### Local Development
1. **Clone** the repository
2. **Load** unpacked extension in Chrome
3. **Configure** API key and test resume
4. **Run** tests to verify functionality
5. **Make** changes and reload extension

### File Structure
```
ResumeHub-v1/
├── manifest.json              # Extension configuration
├── popup.html                 # Main UI popup
├── popup.js                   # Main entry point for the popup
├── background.js              # Background service worker
├── css/
│   └── popup_modern.css       # All styles for the popup
├── popup/                     # Frontend modules for the popup UI
│   ├── app-controller.js      # Main application controller
│   ├── state-manager.js       # Centralized state management
│   ├── ui-manager.js          # DOM manipulation and UI updates
│   ├── file-handlers.js       # File upload/download logic
│   ├── resume-processor.js    # Core resume processing logic
│   └── event-handlers.js      # User interaction event listeners
├── utils/                     # Shared utilities and services
│   ├── api-client.js          # Client for Google Gemini API
│   ├── storage-manager.js     # Abstraction for chrome.storage
│   ├── script-injector.js     # Injects scripts into web pages
│   ├── unified-error-handler.js # Centralized error handling
│   ├── parallel-processor.js  # Concurrent API request management
│   ├── resume-cache-optimizer.js # Caching for resume parsing
│   ├── simple-rate-limiter.js # API call rate limiting
│   └── shared-utilities.js    # Common helper functions
├── content-scripts/           # Scripts injected into web pages
│   └── linkedin/              # LinkedIn-specific functionality
├── lib/                       # Third-party libraries
│   ├── pdfmake.min.js
│   └── vfs_fonts.js
├── assets/                    # Icons and logos
├── tests/                     # Automated and manual tests
│   ├── comprehensive-test.html
│   ├── optimization-test.html
│   └── manual-test-guide.html
└── README.md
```

## 🔒 Privacy & Security

- **Local Storage**: All data, including your resume and API key, is stored locally on your device using Chrome's secure storage.
- **No Data Collection**: We don't collect or store your personal information on any servers.
- **API Key Security**: Your API key is stored securely in `chrome.storage.local`, which is encrypted by the browser.
- **Direct API Calls**: Data is sent directly from your browser to the Google Gemini API, not through any intermediary servers.

See [PRIVACY_POLICY.md](PRIVACY_POLICY.md) for complete details.

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Run** tests to ensure functionality
4. **Commit** changes (`git commit -m 'Add amazing feature'`)
5. **Push** to branch (`git push origin feature/amazing-feature`)
6. **Open** a Pull Request

### Development Guidelines
- Follow the existing modular architecture
- Add tests for new functionality
- Update documentation as needed
- Ensure backward compatibility
- Test thoroughly in Chrome extension environment

## 📋 Roadmap

### Phase 6: UX Enhancements (In Progress)
- [ ] Real-time progress tracking for resume generation
- [ ] Enhanced visual feedback for all async operations
- [ ] Toast notification system
- [ ] Improved error recovery mechanisms

### Phase 7: Performance Optimizations
- [ ] Advanced caching system with smart invalidation
- [ ] Template system for multiple resume formats
- [ ] Batch processing for multiple job applications
- [ ] Memory optimization and leak prevention

### Phase 8: Advanced Features
- [ ] Resume templates and customization
- [ ] Usage analytics (privacy-compliant)
- [ ] Bulk operations and batch processing
- [ ] Integration with job boards

## 🐛 Known Issues

- Large PDF files (>5MB) may take longer to process
- Some complex job application forms may require manual field verification
- AI extraction quality depends on job posting format and clarity

## 📞 Support

- **Issues**: Report bugs via [GitHub Issues](https://github.com/gaulghost/ResumeHub/issues)
- **Email**: Contact seeker.ent@gmail.com for support
- **Documentation**: Check `documents/SYSTEM_ANALYSIS.md` for technical details

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Google Gemini AI** for powerful language processing capabilities
- **Chrome Extension APIs** for seamless browser integration
- **pdfMake** for PDF generation functionality
- **Community Contributors** for testing and feedback

---

**Made with ❤️ by [Pradhuman Singh](https://github.com/gaulghost)**

*Transform your job application process with AI-powered resume tailoring and intelligent form filling.* 