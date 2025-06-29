# ResumeHub – Smart Resume & Job Form Assistant

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?logo=google-chrome)](https://chrome.google.com/webstore)
[![Version](https://img.shields.io/badge/version-1.1-green)](https://github.com/gaulghost/ResumeHub)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

> **Tailor your resume to any job description and auto-fill job forms using AI.**

ResumeHub is a powerful Chrome extension that leverages Google's Gemini AI to automatically customize your resume for specific job postings and intelligently fill out job application forms.

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

ResumeHub features a clean **4-layer modular architecture**:

### Frontend Layer (Popup)
- **StateManager**: Centralized state with pub/sub pattern
- **UIManager**: Theme, cards, status messages, button states  
- **FileHandlers**: Upload/download, format conversion
- **ResumeProcessor**: Core business logic coordination
- **EventHandlers**: User interactions and event management
- **AppController**: Module orchestration and initialization

### Backend Layer (Service Worker)
- **background.js**: Message router with specialized handlers
- **Job Description Handler**: Extraction and processing
- **Resume Tailoring Handler**: AI-powered customization
- **Auto-Fill Handler**: Form detection and filling

### Utility Layer
- **GeminiAPIClient**: Unified AI API operations
- **StorageManager**: Chrome storage abstraction
- **ScriptInjector**: Page interaction and script injection
- **ErrorHandler**: Standardized error management with retry logic
- **ParallelProcessor**: Concurrent section processing
- **ResumeCacheOptimizer**: Intelligent resume parsing cache
- **SimpleRateLimiter**: API rate limiting with exponential backoff

### External Integration
- Google Gemini API for AI operations
- Chrome Extension APIs (storage, scripting, tabs)
- Web page DOM manipulation

## 📊 Performance Features

- **87% Reduction** in code duplication through modular design
- **70% Fewer API Calls** via intelligent caching system
- **Parallel Processing** for faster resume generation
- **Rate Limiting** with automatic retry and exponential backoff
- **Memory Optimization** with proper cleanup and resource management

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
├── popup.html                 # Main UI
├── popup.js                   # Entry point
├── background.js              # Service worker
├── css/
│   └── popup_modern.css       # Styling
├── popup/                     # Frontend modules
│   ├── app-controller.js
│   ├── state-manager.js
│   ├── ui-manager.js
│   ├── file-handlers.js
│   ├── resume-processor.js
│   └── event-handlers.js
├── utils/                     # Backend utilities
│   ├── api-client.js
│   ├── storage-manager.js
│   ├── script-injector.js
│   ├── error-handler.js
│   ├── enhanced-error-handler.js
│   ├── parallel-processor.js
│   ├── resume-cache-optimizer.js
│   └── simple-rate-limiter.js
├── tests/                     # Test suites
│   ├── comprehensive-test.html
│   ├── manual-test-guide.html
│   └── test-functionality.html
└── documents/                 # Documentation
    └── SYSTEM_ANALYSIS.md
```

## 🔒 Privacy & Security

- **Local Storage**: All data stored locally on your device
- **No Data Collection**: We don't collect or store personal information
- **API Key Security**: Your API key is stored securely in Chrome's encrypted storage
- **Direct API Calls**: Data sent directly to Google's API, not through our servers

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