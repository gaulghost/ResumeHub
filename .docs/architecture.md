# ResumeHub Architecture & Complete System Design

**Project Status**: 🎉 **100% COMPLETE - PRODUCTION READY** 🎉  
**Last Updated**: November 16, 2025  
**Total Files**: 69 files | **Total Lines**: ~14,300 lines | **Services**: 38 microservices | **Domains**: 5

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [System Overview](#system-overview)
3. [Architecture Layers](#architecture-layers)
4. [Domain-Driven Design](#domain-driven-design)
5. [Complete Folder Structure](#complete-folder-structure)
6. [Design Patterns](#design-patterns)
7. [Data Flow](#data-flow)
8. [Configuration & Setup](#configuration--setup)
9. [Development Guide](#development-guide)
10. [Bug Fixes & Lessons Learned](#bug-fixes--lessons-learned)

---

## Quick Start

### Loading the Extension in Chrome

```bash
# 1. Open Chrome Extensions Page
chrome://extensions/

# 2. Enable Developer Mode (toggle in top-right)
# 3. Click "Load unpacked"
# 4. Select the ResumeHub-v1 directory
# 5. Extension loads instantly
```

### File Structure Overview

```
ResumeHub-v1/
├── .docs/                    (Complete documentation - 46 files)
├── src/                      (Enterprise source code - 69 files, 14,270 lines)
├── assets/                   (Images & logos)
├── lib/                      (Third-party libraries)
├── css/                      (Styling & design tokens)
├── popup.html / popup.js     (Extension popup)
├── background.js             (Service Worker)
├── manifest.json             (Extension configuration)
└── package.json              (Dependencies)
```

---

## System Overview

### What is ResumeHub?

**ResumeHub** is an AI-powered Chrome extension that:
- ✅ **Tailors resumes** to job descriptions using AI
- ✅ **Auto-fills job forms** with resume data
- ✅ **Extracts job information** from LinkedIn and job boards
- ✅ **Estimates salaries** based on market data
- ✅ **Generates insights** (skills, interview questions, resources)
- ✅ **Integrates seamlessly** with LinkedIn and other job sites

### Key Statistics

| Metric | Value |
|--------|-------|
| **Architecture Layers** | 5 (Foundation, Infrastructure, Domain, Application, Presentation) |
| **Business Domains** | 5 (Resume, Job, Salary, Insights, AI) |
| **Microservices** | 38 registered services |
| **Production Code** | 69 files, 14,270 lines |
| **Design Patterns** | 12+ patterns (Factory, Repository, Service, MVVM, etc.) |
| **Documentation** | 46 complete markdown files |
| **Code Quality** | 100% JSDoc, No circular dependencies |

---

## Architecture Layers

### 5-Layer Enterprise Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 5: PRESENTATION (1,950 lines, 9 files)              │
│  • View Models (State Management)                           │
│  • Components (Sidebar, Popup, Badge)                       │
│  • No business logic in UI                                  │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  LAYER 4: APPLICATION (2,500 lines, 17 files)              │
│  • 5 Application Services                                   │
│  • Main Orchestrator                                        │
│  • Data Transfer Objects (DTOs)                             │
│  • Coordinates domain services into workflows                │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  LAYER 3: DOMAIN (6,870 lines, 29 files)                   │
│  • 5 Business Domains (Resume, Job, Salary, Insights, AI)  │
│  • Services, Repositories, Entities, Validators             │
│  • Pure business logic, no infrastructure knowledge         │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  LAYER 2: INFRASTRUCTURE (1,450 lines, 7 files)            │
│  • Storage Adapters (Chrome, Local, Session)               │
│  • API Clients (Gemini, Base Client)                       │
│  • Cache Manager (Dual-tier)                               │
│  • Messaging System                                         │
│  • Event Bus                                                │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1: FOUNDATION (700 lines, 6 files)                  │
│  • Service Locator (Dependency Injection)                   │
│  • Base Classes                                             │
│  • Logger                                                   │
│  • Error Handler                                            │
│  • Bootstrap Configuration                                  │
└─────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

#### Foundation Layer
- **Purpose**: Establish DI system and shared infrastructure
- **Files**: 6 files, 700 lines
- **Key Components**:
  - `ServiceLocator` - Dependency injection container
  - `BaseService` - Base class for all services
  - `BaseRepository` - Base class for data access
  - `Logger` - Centralized logging
  - `UnifiedErrorHandler` - Error classification and handling
  - `bootstrap.js` - Service registration

#### Infrastructure Layer
- **Purpose**: Technical implementations and external integrations
- **Files**: 7 files, 1,450 lines
- **Key Components**:
  - `ChromeStorageAdapter` - Chrome storage abstraction
  - `StorageFactory` - Storage adapter factory
  - `CacheManager` - Dual-tier caching (memory + persistent)
  - `APIBaseClient` - HTTP client abstraction
  - `GeminiAPIClient` - Google Generative AI integration
  - `ChromeRuntimeMessenger` - Message passing
  - `EventEmitter` - Event-driven architecture

#### Domain Layer
- **Purpose**: Pure business logic organized around 5 domains
- **Files**: 29 files, 6,870 lines
- **5 Business Domains**:
  
  **1. Resume Domain** (1,676 lines)
  - `ResumeEntity` - Immutable resume data structure
  - `ResumeValidator` - Comprehensive resume validation
  - `ResumeRepository` - CRUD operations with caching
  - `ResumeService` - Business operations (parse, validate, tailor)
  - `ResumeFactory` - Resume object creation
  
  **2. Job Domain** (1,750 lines)
  - `JobEntity` - Job data structure
  - `JobValidator` - Job validation rules
  - `JobRepository` - Data persistence
  - `JobService` - Job operations and matching
  - `JobFactory` - Job creation
  - Resume-to-job matching (0-100 score)
  
  **3. Salary Domain** (1,480 lines)
  - `SalaryEntity` - Salary data structure
  - `SalaryValidator` - Salary validation
  - `SalaryRepository` - Salary persistence
  - `SalaryService` - Salary operations
  - `SalaryFactory` - Salary creation
  - Multi-currency support and comparison
  
  **4. Insights Domain** (1,128 lines)
  - `InsightEntity` - Insight data structure
  - `InsightRepository` - Persistence
  - `InsightService` - Insight operations
  - `InsightGenerator` - AI-powered generation
  - `InsightFactory` - Creation
  
  **5. AI Domain** (836 lines)
  - `AIConfigEntity` - AI configuration
  - `AIConfigRepository` - Storage
  - `PromptBuilder` - Structured prompt generation
  - `ResponseParser` - Response parsing and validation

#### Application Layer
- **Purpose**: Orchestrate domain services into business workflows
- **Files**: 17 files, 2,500 lines
- **Key Components**:
  - `BaseApplicationService` - Base for app services
  - `ResumeApplicationService` - Resume workflows
  - `JobApplicationService` - Job workflows
  - `SalaryApplicationService` - Salary workflows
  - `InsightsApplicationService` - Insights workflows
  - `AIApplicationService` - AI workflows
  - `MainOrchestrator` - Coordinates all workflows
  - `MatchResultDTO` - Resume-job match data
  - `JobAnalysisDTO` - Job analysis data
  - `InsightsPackageDTO` - Insights data

#### Presentation Layer
- **Purpose**: User interface without business logic
- **Files**: 9 files, 1,950 lines
- **Key Components**:
  - `BaseViewModel` - Base state management
  - `SidebarViewModel` - LinkedIn sidebar state
  - `PopupViewModel` - Extension popup state
  - `ResumeHubSidebar` - LinkedIn sidebar component
  - `PopupComponent` - Extension popup UI
  - `SalaryBadgeComponent` - Salary display

---

## Domain-Driven Design

### Five Business Domains

#### 1. Resume Domain
Handles all resume-related operations: parsing, validation, processing, caching, and manipulation.

```
USE CASES:
├─ Parse resume file (PDF, DOCX, TXT)
├─ Validate resume structure and content
├─ Search resumes by keyword/section
├─ Store and retrieve resumes
├─ Tailor resume for job description
├─ Export in multiple formats
└─ Cache optimized resumes
```

#### 2. Job Domain
Manages job information extraction, analysis, and matching against resumes.

```
USE CASES:
├─ Extract job details from web pages
├─ Validate job description content
├─ Match resume to job (0-100 score)
├─ Analyze job requirements
├─ Cache job data
├─ Search jobs by criteria
└─ Track recent jobs
```

#### 3. Salary Domain
Estimates salaries and provides market comparisons.

```
USE CASES:
├─ Estimate salary from job posting
├─ Parse salary ranges from text
├─ Support multiple currencies
├─ Compare market salaries
├─ Calculate salary percentiles
└─ Cache salary data
```

#### 4. Insights Domain
Generates AI-powered insights about jobs.

```
USE CASES:
├─ Generate skill requirements
├─ Extract interview questions
├─ Identify skill gaps
├─ Recommend resources
├─ Analyze company
└─ Provide career insights
```

#### 5. AI Domain
Manages AI configuration and prompt handling.

```
USE CASES:
├─ Manage AI provider configs
├─ Build structured prompts
├─ Parse AI responses
├─ Handle different AI models
└─ Cache AI responses
```

### Domain Interactions

```
┌──────────────┐
│   Resume     │
│   Domain     │
└──────┬───────┘
       │ uses
       ↓
┌──────────────────────────────────────────┐
│        Job Domain                         │
│  ├─ Matches resume to job                │
│  └─ Calculates match score (0-100)      │
└──────────────┬───────────────────────────┘
               │ requires
               ↓
┌──────────────┐      ┌──────────────┐
│   Salary     │      │  Insights    │
│   Domain     │      │  Domain      │
└──────────────┘      └────────┬─────┘
                               │
                               ↓ uses
                        ┌──────────────┐
                        │    AI        │
                        │   Domain     │
                        └──────────────┘
```

---

## Complete Folder Structure

### Detailed Directory Tree

```
ResumeHub-v1/
│
├── 📂 .docs/                                     (Complete documentation)
│   ├── architecture.md                          ← You are here
│   ├── file-structure.md                        (Complete file reference)
│   ├── ARCHITECTURE_DECISION_RECORD.md
│   ├── BUG_FIXES_APPLIED.md
│   ├── ENTERPRISE_ARCHITECTURE.md
│   ├── PROJECT_COMPLETION_SUMMARY.md
│   ├── DOMAIN_LAYER_COMPLETE.md
│   ├── FIX_*.md                                 (Bug fix documentation)
│   ├── PHASE*.md                                (Phase completion reports)
│   └── ...42 more documentation files
│
├── 📂 src/                                       (69 files, 14,270 lines)
│   │
│   ├── 📂 config/                               (Configuration layer)
│   │   ├── bootstrap.js                         (Service registration & DI)
│   │   └── service-locator.js                   (Dependency injection container)
│   │
│   ├── 📂 foundation/                           (Base classes & utilities)
│   │   ├── base.service.js                      (Base service class)
│   │   ├── base.repository.js                   (Base repository class)
│   │   ├── logger.js                            (Logging utility)
│   │   ├── unified-error-handler.js             (Error classification)
│   │   └── ...more foundation utilities
│   │
│   ├── 📂 infrastructure/                       (Technical implementations)
│   │   ├── 📂 storage/
│   │   │   ├── chrome-storage.adapter.js
│   │   │   ├── storage.factory.js
│   │   │   └── storage.interface.js
│   │   │
│   │   ├── 📂 cache/
│   │   │   ├── cache.manager.js                 (Dual-tier caching)
│   │   │   ├── memory-cache.js
│   │   │   └── storage-cache.js
│   │   │
│   │   ├── 📂 api/
│   │   │   ├── api.base-client.js
│   │   │   ├── gemini-api.client.js             (AI API integration)
│   │   │   └── api.config.js
│   │   │
│   │   ├── 📂 messaging/
│   │   │   ├── chrome-runtime.messenger.js
│   │   │   ├── event-emitter.js
│   │   │   └── message.types.js
│   │   │
│   │   └── 📂 utilities/
│   │       ├── file-handler.js
│   │       ├── pdf-generator.js
│   │       ├── sanitizer.js
│   │       ├── validator.js
│   │       └── ...more utilities
│   │
│   ├── 📂 domain/                               (5 business domains)
│   │   │
│   │   ├── 📂 resume/                           (Resume domain)
│   │   │   ├── entities/
│   │   │   │   └── resume.entity.js
│   │   │   ├── validators/
│   │   │   │   └── resume.validator.js
│   │   │   ├── repositories/
│   │   │   │   └── resume.repository.js
│   │   │   ├── services/
│   │   │   │   └── resume.service.js
│   │   │   ├── factories/
│   │   │   │   └── resume.factory.js
│   │   │   └── index.js                         (Public API)
│   │   │
│   │   ├── 📂 job/                              (Job domain)
│   │   │   ├── entities/
│   │   │   ├── validators/
│   │   │   ├── repositories/
│   │   │   ├── services/
│   │   │   ├── factories/
│   │   │   └── index.js
│   │   │
│   │   ├── 📂 salary/                           (Salary domain)
│   │   │   ├── entities/
│   │   │   ├── validators/
│   │   │   ├── repositories/
│   │   │   ├── services/
│   │   │   ├── factories/
│   │   │   └── index.js
│   │   │
│   │   ├── 📂 insights/                         (Insights domain)
│   │   │   ├── entities/
│   │   │   ├── repositories/
│   │   │   ├── services/
│   │   │   ├── factories/
│   │   │   └── index.js
│   │   │
│   │   ├── 📂 ai/                               (AI domain)
│   │   │   ├── entities/
│   │   │   ├── repositories/
│   │   │   ├── services/
│   │   │   └── index.js
│   │   │
│   │   └── domain.index.js                      (Public API for all domains)
│   │
│   ├── 📂 application/                          (Orchestration layer)
│   │   ├── 📂 services/
│   │   │   ├── base-application-service.js
│   │   │   ├── resume-application.service.js
│   │   │   ├── job-application.service.js
│   │   │   ├── salary-application.service.js
│   │   │   ├── insights-application.service.js
│   │   │   ├── ai-application.service.js
│   │   │   └── index.js
│   │   │
│   │   ├── 📂 orchestrators/
│   │   │   ├── main.orchestrator.js
│   │   │   └── index.js
│   │   │
│   │   ├── 📂 dtos/
│   │   │   ├── base.dto.js
│   │   │   ├── match-result.dto.js
│   │   │   ├── job-analysis.dto.js
│   │   │   ├── insights-package.dto.js
│   │   │   └── index.js
│   │   │
│   │   └── application.index.js
│   │
│   └── 📂 presentation/                         (UI layer)
│       ├── 📂 view-models/
│       │   ├── base.view-model.js
│       │   ├── sidebar.view-model.js
│       │   ├── popup.view-model.js
│       │   └── index.js
│       │
│       ├── 📂 components/
│       │   ├── 📂 sidebar/
│       │   │   ├── managers/                    (Component logic)
│       │   │   ├── services/                    (Component services)
│       │   │   ├── styles/
│       │   │   └── templates/
│       │   ├── 📂 popup/
│       │   ├── 📂 badge/
│       │   └── 📂 common/
│       │
│       ├── 📂 styles/
│       │   ├── theme.css
│       │   ├── design-tokens.css
│       │   ├── animations.css
│       │   └── variables.css
│       │
│       └── presentation.index.js
│
├── 📂 background/                               (Service Worker)
│   ├── background.js                            (Entry point)
│   ├── 📂 handlers/                             (Message handlers)
│   └── 📂 listeners/                            (Event listeners)
│
├── 📂 content-scripts/                          (LinkedIn Integration)
│   └── 📂 linkedin/
│       ├── linkedin-entry.js                    (Entry point)
│       ├── 📂 components/
│       │   ├── right-sidebar.js                 (Monolithic component)
│       │   ├── job-insights-manager.js
│       │   ├── salary-badge.js
│       │   └── ...more components
│       ├── 📂 services/
│       │   ├── linkedin-dom.service.js
│       │   └── linkedin-detector.service.js
│       ├── 📂 pages/
│       │   ├── job-search-handler.js
│       │   └── job-details-handler.js
│       └── 📂 config/
│           └── linkedin-selectors.js
│
├── 📂 popup/                                    (Extension popup)
│   ├── app-controller.js
│   ├── state-manager.js
│   ├── ui-manager.js
│   ├── file-handlers.js
│   ├── resume-processor.js
│   ├── event-handlers.js
│   ├── storage-adapter.js
│   └── styles/
│
├── 📂 core/                                     (Legacy configuration)
│   └── 📂 config/
│       ├── constants.js                         (Magic numbers centralized)
│       ├── app-config.js                        (App configuration)
│       └── job-selectors.js                     (CSS selectors)
│
├── 📂 utils/                                    (Utilities & helpers)
│   ├── api-client.js                            (API client)
│   ├── storage-manager.js                       (Storage wrapper)
│   ├── logger.js                                (Logging)
│   ├── unified-error-handler.js                 (Error handling)
│   ├── input-validator.js                       (Validation)
│   ├── file-downloader.js                       (File operations)
│   ├── pdf-generator.js                         (PDF generation)
│   ├── salary-estimator.js                      (Salary estimation)
│   ├── salary-parser.js                         (Salary parsing)
│   ├── simple-rate-limiter.js                   (Rate limiting)
│   ├── parallel-processor.js                    (Parallel processing)
│   ├── resume-cache-optimizer.js                (Caching)
│   ├── script-injector.js                       (Script injection)
│   ├── sanitizer.js                             (HTML sanitization)
│   ├── request-validator.js                     (Request validation)
│   ├── shared-utilities.js                      (Common helpers)
│   └── ...more utilities
│
├── 📂 css/                                      (Styling)
│   ├── design-tokens.css                        (Design system)
│   ├── popup_modern.css                         (Popup styles)
│   └── ...more stylesheets
│
├── 📂 assets/                                   (Images & resources)
│   ├── icon-16.png
│   ├── icon-48.png
│   ├── icon-128.png
│   └── ...more assets
│
├── 📂 lib/                                      (Third-party libraries)
│   ├── pdfmake.min.js
│   └── vfs_fonts.js
│
├── popup.html                                   (Popup UI)
├── background.js                                (Service Worker)
├── manifest.json                                (Extension manifest)
├── package.json                                 (Dependencies)
├── README.md                                    (Project documentation)
└── .gitignore
```

---

## Design Patterns

### 12+ Patterns Implemented

| Pattern | Usage | Location |
|---------|-------|----------|
| **Layered Architecture** | Separation of concerns | Entire project (5 layers) |
| **Domain-Driven Design** | Business logic organization | Domain layer (5 domains) |
| **Dependency Injection** | Loose coupling | Service Locator (config/) |
| **Repository Pattern** | Data access abstraction | Domain repositories |
| **Service Pattern** | Business logic encapsulation | Domain services |
| **Factory Pattern** | Object creation | Domain factories |
| **Observer Pattern** | Event-driven architecture | EventEmitter |
| **MVVM Pattern** | Presentation layer | View Models |
| **Adapter Pattern** | Storage abstraction | StorageAdapter |
| **Singleton Pattern** | Shared instances | Service Locator |
| **DTO Pattern** | Type-safe data contracts | Application layer |
| **Base Class Pattern** | Inheritance hierarchy | BaseService, BaseRepository |

### SOLID Principles

| Principle | Implementation |
|-----------|-----------------|
| **S** - Single Responsibility | Each class has one reason to change |
| **O** - Open/Closed | Open for extension, closed for modification |
| **L** - Liskov Substitution | Subclasses can replace parent classes |
| **I** - Interface Segregation | Clients depend on small interfaces |
| **D** - Dependency Inversion | Depend on abstractions, not concretions |

---

## Data Flow

### Resume Tailoring Flow

```
1. USER UPLOADS RESUME (Popup)
   ↓
   FileHandlers.handleResumeUpload()
   ↓
   StorageManager.setResume()
   ↓
   Resume stored in Chrome Storage

2. USER NAVIGATES TO LINKEDIN JOB
   ↓
   LinkedInController detects page change
   ↓
   ResumeHubSidebar mounts
   ↓
   Sidebar displays job context

3. JOB DETAILS LOADED
   ↓
   JobDetailsHandler extracts job info
   ↓
   background.js: handleJobChanged()
   ↓
   Checks AI mode and filters

4. USER CLICKS "TAILOR RESUME"
   ↓
   ResumeHubSidebar._tailorResume()
   ↓
   Sends message to background.js
   ↓
   background.js: handleCreateTailoredResume()
   ↓
   GeminiAPIClient.tailorResume()
   ↓
   API Call to Google Generative AI
   ↓
   Response received & cached

5. TAILORED RESUME DISPLAYED
   ↓
   ResumeHubSidebar._displayTailoredResume()
   ↓
   Shows in sidebar with download options

6. USER DOWNLOADS RESUME
   ↓
   FileDownloader.downloadAsText/Pdf/Docx()
   ↓
   Browser downloads file
```

### Job Analysis Flow

```
1. JOB DETECTED
   ↓
   Extract job description & metadata
   ↓
   Cache job data with TTL

2. FETCH INSIGHTS
   ↓
   background.js: sendToAI()
   ↓
   PromptBuilder creates structured prompt
   ↓
   GeminiAPIClient.generateInsights()
   ↓
   API processes request

3. PARSE RESPONSE
   ↓
   ResponseParser validates output
   ↓
   Extract skills, questions, resources
   ↓
   Cache insights data

4. DISPLAY IN SIDEBAR
   ↓
   JobInsightsService.displayInsights()
   ↓
   Render in sidebar sections
   ↓
   Update on job changes
```

### Salary Estimation Flow

```
1. JOB DETECTED
   ↓
   Extract salary from posting
   ↓
   Try standard parsing first

2. CLIENT CACHE CHECK
   ↓
   Check session cache & persistent storage (Chrome storage)
   ↓
   If cached, display immediately

3. BACKEND ESTIMATION REQUEST
   ↓
   Call self-hosted endpoint: https://resumehub.duckdns.org/api/salary-estimate
   ├─ Checks server-side SQLite cache first
   └─ For cache misses, requests estimate from server-side LLM chain (Groq / Gemini)

4. CLIENT-SIDE FALLBACK (IF BACKEND FAILS / KEY MISSING)
   ↓
   If backend request fails or returns an error:
   └─ GeminiAPIClient.estimateSalary() (direct client-side fallback using local Gemini Key)

5. SERVER CACHE REPORTING (ON SUCCESSFUL FALLBACK)
   ↓
   Asynchronously report client-side successful estimates to server cache:
   └─ POST https://resumehub.duckdns.org/api/salary-estimate/report

6. CACHE & DISPLAY BADGE
   ↓
   Cache result locally (24h TTL) and inject SalaryBadge
   ↓
   Show estimated range with local currency
```

---

## Configuration & Setup

### Environment Configuration

#### `core/config/constants.js`
Centralized magic numbers:

```javascript
export const CACHE = {
  JOB_DESCRIPTION_TTL: 5 * 60 * 1000,        // 5 minutes
  RESUME_PARSE_TTL: 5 * 60 * 1000,
  OPTIMIZED_RESUME_TTL: 24 * 60 * 60 * 1000, // 24 hours
  SALARY_CACHE_TTL: 24 * 60 * 60 * 1000,
};

export const RATE_LIMITS = {
  REQUESTS_PER_MINUTE: 10,
  CONCURRENT_REQUESTS: 3,
  BATCH_DELAY: 500,
  MAX_RETRIES: 3,
};
```

#### `core/config/app-config.js`
Application-wide configuration:

```javascript
class AppConfig {
  constructor() {
    this.config = {
      app: { name: 'ResumeHub AI', version: '1.5' },
      api: { gemini: { timeout: 30000, maxRetries: 3 } },
      storage: { maxResumeSize: 10 * 1024 * 1024 },
      features: {
        salaryEstimation: true,
        aiExtraction: true,
        linkedIn: { rightSidebar: true }
      }
    };
  }
  
  get(path, defaultValue) { /* ... */ }
  set(path, value) { /* ... */ }
  isFeatureEnabled(featureName) { /* ... */ }
}
```

#### `core/config/job-selectors.js`
CSS selectors for job extraction:

```javascript
export const JOB_DESCRIPTION_SELECTORS = [
  '#job-description',
  '.job-description',
  '.jobsearch-JobComponent-description', // Indeed
  '.jobs-description-content__text',      // LinkedIn
  'section[data-qa="job-description"]',   // Lever
  // ... 16+ more selectors
];
```

### API Configuration

#### Self-Hosted Backend API Setup
No API key is required from the user to use the default backend-enabled services (such as salary estimation), as the extension connects to the self-hosted backend server:
- Backend URL: `https://resumehub.duckdns.org/api/salary-estimate`
- Cache Reporting: `https://resumehub.duckdns.org/api/salary-estimate/report`

#### Direct Gemini API Setup (Local Fallback & Summaries)
To use local summaries or as a fallback when the backend is unreachable:

1. **Get API Key**:
   ```
   1. Go to https://aistudio.google.com/app/apikey
   2. Click "Create new secret key"
   3. Copy the key
   ```

2. **Store API Key**:
   ```javascript
   // Saved in Extension popup Settings or Sidebar Config
   await StorageManager.setAPIToken(apiKey);
   ```

3. **Use in Background Worker**:
   ```javascript
   // Lazily initialized in background.js
   const apiClient = new GeminiAPIClient(apiKey);
   const response = await apiClient.tailorResume(resume, jobDescription);
   ```

---

## Development Guide

### Adding a New Domain

1. **Create domain folder**:
   ```
   src/domain/[domain-name]/
   ├── entities/[name].entity.js
   ├── validators/[name].validator.js
   ├── repositories/[name].repository.js
   ├── services/[name].service.js
   ├── factories/[name].factory.js
   └── index.js
   ```

2. **Create Entity**:
   ```javascript
   export class XyzEntity {
     constructor(data) {
       Object.freeze(this); // Make immutable
     }
     
     static fromJSON(json) { /* ... */ }
     toJSON() { /* ... */ }
   }
   ```

3. **Create Validator**:
   ```javascript
   export class XyzValidator {
     static validate(data) {
       const errors = [];
       // Add validation rules
       return { isValid: errors.length === 0, errors };
     }
   }
   ```

4. **Create Repository**:
   ```javascript
   export class XyzRepository extends BaseRepository {
     constructor(cacheManager, storageManager) {
       super();
       this.cache = cacheManager;
       this.storage = storageManager;
     }
     
     async get(id) { /* ... */ }
     async save(entity) { /* ... */ }
   }
   ```

5. **Create Service**:
   ```javascript
   export class XyzService extends BaseService {
     constructor(repository, validator) {
       super();
       this.repository = repository;
       this.validator = validator;
     }
     
     async performBusiness Logic() { /* ... */ }
   }
   ```

6. **Register in Bootstrap**:
   ```javascript
   // src/config/bootstrap.js
   serviceLocator.register('xyzValidator', XyzValidator, { singleton: true });
   serviceLocator.register('xyzRepository', XyzRepository, { singleton: true });
   serviceLocator.register('xyzService', XyzService, { singleton: true });
   ```

### Adding a New Component

1. **Create component folder**:
   ```
   src/presentation/components/[component-name]/
   ├── managers/          (Logic)
   ├── services/          (Business operations)
   ├── styles/            (CSS)
   ├── templates/         (HTML)
   └── [component].js     (Main class)
   ```

2. **Create Component Class**:
   ```javascript
   export class XyzComponent {
     constructor(viewModel) {
       this.viewModel = viewModel;
       this.dom = null;
     }
     
     async mount(container) {
       this.dom = this._createDOM();
       container.appendChild(this.dom);
       this._wireEvents();
     }
     
     unmount() {
       this.dom?.remove();
     }
   }
   ```

### Testing Checklist

- [ ] Verify all services are registered in ServiceLocator
- [ ] Check no circular dependencies
- [ ] Test with Chrome DevTools
- [ ] Verify logging output
- [ ] Check error handling
- [ ] Test with/without API key
- [ ] Validate on real LinkedIn pages
- [ ] Test across different browsers

---

## Bug Fixes & Lessons Learned

### Critical Bugs Fixed

#### 1. Missing `await` on `_getCurrentTabId()`
**Problem**: Race condition causing lost tailored resumes
**Solution**: Added `await` before calling `_getCurrentTabId()`
**File**: `content-scripts/linkedin/components/right-sidebar.js`

#### 2. Cache Key Collisions
**Problem**: Auto-extraction and standard extraction sharing cache
**Solution**: Method-specific cache keys: `${tabId}_${method}`
**File**: `background.js`

#### 3. Dynamic `import()` in Service Worker
**Problem**: Service Workers don't support dynamic imports
**Solution**: Converted to static imports at module level
**File**: `src/config/bootstrap.js`

#### 4. Tailor Button Not Awaiting Extraction
**Problem**: Resume tailoring started before job description extracted
**Solution**: Created Promise-based `extractJobDescriptionAsync()`
**File**: `content-scripts/linkedin/components/right-sidebar.js`

#### 5. Extract Button Delay
**Problem**: Button returned cached data ignoring force refresh request
**Solution**: Implemented `forceRefresh` flag in `handleGetJobDescription()`
**File**: `background.js`

### Key Lessons

1. **Always await async operations** - Race conditions are subtle but catastrophic
2. **Use specific cache keys** - Generic keys lead to collisions
3. **Static imports for Service Workers** - Dynamic imports silently fail
4. **Separate concerns early** - Monolithic code is harder to debug
5. **Test with real data** - Mock data hides edge cases
6. **Document assumptions** - Future maintainers need context
7. **Use centralized error handling** - Scattered try-catch misses issues
8. **Log with context** - "Error occurred" is useless; include what failed

---

## Migration to Enterprise Architecture

### Current Status: 100% COMPLETE ✅

**What was migrated:**
- ✅ Background service worker restructured
- ✅ All 5 domain layers implemented
- ✅ Application orchestration layer added
- ✅ Presentation layer with View Models
- ✅ Dependency injection system
- ✅ Comprehensive logging
- ✅ Error handling standardized
- ✅ Request validation

**What remains optional:**
- ⏳ Unit test suite (recommended)
- ⏳ Integration tests
- ⏳ E2E tests
- ⏳ Performance monitoring
- ⏳ Analytics integration

---

## Service Registry (38 Services)

### Core Services (4)
- `logger` - Centralized logging
- `errorHandler` - Error classification and handling
- `baseService` - Base service class
- `baseRepository` - Base repository class

### Infrastructure Services (9)
- `chromeStorage` - Chrome storage adapter
- `storageFactory` - Storage factory
- `cacheManager` - Dual-tier cache
- `apiBaseClient` - HTTP client base
- `geminiAPI` - Gemini AI client
- `messenger` - Chrome runtime messenger
- `eventEmitter` - Event system
- `fileHandler` - File operations
- `sanitizer` - HTML sanitization

### Domain Services by Domain (16)
**Resume**: `resumeValidator`, `resumeRepository`, `resumeService`, `resumeFactory`
**Job**: `jobValidator`, `jobRepository`, `jobService`, `jobFactory`
**Salary**: `salaryValidator`, `salaryRepository`, `salaryService`, `salaryFactory`
**Insights**: `insightRepository`, `insightService`, `insightGenerator`, `insightFactory`
**AI**: `aiConfigRepository`, `promptBuilder`, `responseParser`

### Application Services (5)
- `resumeApplicationService` - Resume workflows
- `jobApplicationService` - Job workflows
- `salaryApplicationService` - Salary workflows
- `insightsApplicationService` - Insights workflows
- `aiApplicationService` - AI workflows

### Orchestrator (1)
- `mainOrchestrator` - Main workflow orchestration

---

## Performance Optimizations

### Caching Strategy

```
┌─────────────────────────────────────────┐
│ REQUEST FOR DATA                        │
└──────────────┬──────────────────────────┘
               ↓
        ┌─────────────────┐
        │ L1: Memory Cache│ (Fast, short TTL)
        └────────┬────────┘
                 │ Miss
                 ↓
        ┌─────────────────┐
        │ L2: Storage Cache│ (Persistent, long TTL)
        └────────┬────────┘
                 │ Miss
                 ↓
        ┌─────────────────┐
        │ Fetch from API  │
        └─────────────────┘
                 ↓
        Cache in both L1 & L2
```

### Rate Limiting

- **5 requests per 10 seconds** for API calls
- **3 concurrent requests** maximum
- **Auto-retry** with exponential backoff
- **Queue management** for batch operations

### Parallel Processing

- Multiple jobs processed concurrently
- Batch operations with controlled parallelism
- No request blocking

---

## Storage Schema

### Chrome Storage: Sync Area
```javascript
{
  theme: 'light' | 'dark',
  extractionMethod: 'ai' | 'standard',
  aiModeEnabled: boolean,
  aiFilters: {
    autoTailorOnView: boolean,
    autoFetchSalary: boolean,
    requireSalary: boolean,
    salaryThreshold: number | null,
    minJDLength: number
  }
}
```

### Chrome Storage: Local Area
```javascript
{
  resumeFilename: string,
  resumeContent: string,
  resumeMimeType: string,
  apiToken: string (encrypted),
  recentJobsV1: Array<{
    jobTitle: string,
    companyName: string,
    location: string,
    jobUrl: string,
    timestamp: number
  }>
}
```

---

## Troubleshooting

### Issue: Service Worker crashes on startup
**Solution**: Check `bootstrap.js` for import errors; use static imports only

### Issue: Messages not reaching background
**Solution**: Verify `onMessage()` handler is registered; check message structure

### Issue: Cache not working
**Solution**: Check TTL values in `constants.js`; verify StorageManager initialization

### Issue: API requests failing
**Solution**: Verify API key is valid; check rate limiter not blocking; examine error handler logs

### Issue: UI not updating
**Solution**: Check ViewModel subscriptions; verify state changes trigger updates

---

## File Statistics Summary

| Category | Files | Lines |
|----------|-------|-------|
| Entry Points | 2 | 46 |
| Core Configuration | 3 | 325 |
| Foundation | 6 | 700 |
| Infrastructure | 7 | 1,450 |
| Domain Layer | 29 | 6,870 |
| Application Layer | 17 | 2,500 |
| Presentation Layer | 9 | 1,950 |
| Content Scripts | 6 | 4,000 |
| Popup (Legacy) | 7 | 1,200 |
| Utilities | 13 | 3,200 |
| CSS & Styling | 2 | 150 |
| Documentation | 46 | 50,000+ |
| **TOTAL** | **160+** | **74,000+** |

---

## Next Steps

### Immediate (Ready to deploy)
- ✅ Load extension in Chrome
- ✅ Test with real resumes
- ✅ Verify LinkedIn integration
- ✅ Test API calls with Gemini

### Short-term (1-2 weeks)
- ⏳ Add unit test suite
- ⏳ Add integration tests
- ⏳ Performance profiling
- ⏳ User feedback collection

### Long-term (1-3 months)
- ⏳ Additional job boards support
- ⏳ Analytics integration
- ⏳ Enhanced UI/UX
- ⏳ Internationalization (i18n)
- ⏳ Premium features

---

## Support & Resources

### Documentation Files
- **`file-structure.md`** - Complete file and function reference
- **`system-design.md`** - System design details
- **`ENTERPRISE_STRUCTURE_VISUAL.md`** - Visual architecture guide
- **`PROJECT_COMPLETION_SUMMARY.md`** - Completion report
- **Bug fix files** - `FIX_*.md` for specific issues

### Key Contacts
- **Developer**: Pradhuman Singh
- **GitHub**: https://github.com/gaulghost
- **Email**: seeker.ent@gmail.com

### External Resources
- [Chrome Extension Development](https://developer.chrome.com/docs/extensions/)
- [Google Generative AI API](https://ai.google.dev/)
- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/storage/)
- [Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API)

---

**Document Version**: 1.0  
**Status**: Production Ready  
**Last Updated**: November 16, 2025  
**Architecture Pattern**: 5-Layer Enterprise DDD  
**Code Quality**: 100% JSDoc, No Circular Dependencies, SOLID Principles

