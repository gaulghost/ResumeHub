# ResumeHub Architecture & Complete System Design

This document details the actual system architecture, design patterns, data flows, and caching strategies of the ResumeHub extension.

---

## 1. Architectural Overview

ResumeHub is built using a decoupled **MVVM (Model-View-ViewModel)** UI structure on the presentation layer, communicating with a **Service Worker (Background)** mediator via Chrome's messaging API, which interacts with a **Self-Hosted Flask Backend** or direct client-side fallback AI models.

```
                  ┌───────────────────────────────┐
                  │      PRESENTATION LAYER       │
                  │  (Popup UI / Content Scripts) │
                  └──────────────┬────────────────┘
                                 │
                     Chrome message passing
                                 │
                                 ↓
                  ┌───────────────────────────────┐
                  │       BACKGROUND LAYER        │
                  │   (Service Worker Mediator)   │
                  └──────────────┬────────────────┘
                                 │
                        HTTPS / Rest calls
                                 │
                                 ↓
                  ┌───────────────────────────────┐
                  │         BACKEND LAYER         │
                  │  (Flask Server / SQLite Cache)│
                  └───────────────────────────────┘
```

---

## 2. System Modules & Layer Isolation

The application isolates responsibilities across three core layers:

### A. Presentation Layer (Extension Frontend & DOM Injections)
* **Extension Popup UI (`/popup`)**: The user dashboard allowing base resume uploads, API key configurations, settings management, and manually triggered tailoring previews. Built on an MVVM setup:
  * **View (HTML/CSS)**: Renders popup controls.
  * **ViewModel (`popup/state-manager.js`, `popup/ui-manager.js`)**: Coordinates state subscriptions and updates view elements in response to mutations.
  * **Controller (`popup/app-controller.js`)**: Bootstraps elements and routes events to correct modules.
* **Content Scripts (`/content-scripts`)**: Context-isolated frontend elements injected into job portals (LinkedIn, Naukri, Instahyre).
  * **Controllers (e.g. `linkedin-controller.js`)**: Coordinates mutation observers, listens to SPA URL updates, and coordinates page handlers.
  * **Page Handlers (e.g. `pages/job-details-handler.js`)**: Extracts details from DOM and coordinates UI badge placement.
  * **Salary Badges & Sidebars**: Dynamic DOM elements injected directly into target pages.

### B. Background Layer (Extension Service Worker)
* **Background Mediator (`background.js`)**: Orchestrates network payloads, reads local storage indices, intercepts and updates background proxies, and processes runtime message communications from the popup and content scripts.
* **Utilities (`/utils`)**: Stateless library functions providing rate limiting, data parsing, PDF generation, sanitizer controls, storage management, and logging.

### C. Backend Layer (Python Flask Microservice)
* **Flask API Server (`/backend`)**: Manages AI proxies, coordinates heavy LLM calls, caches market salary values in a local SQLite database, and handles client estimation telemetry reports.

---

## 3. Communication & Data Flows

### A. Real-Time Resume Tailoring Flow
```
1. User uploads resume in Popup -> reads file -> updates StorageManager.
2. User views LinkedIn job post -> JobDetailsHandler extracts Job Title & Description.
3. User clicks "Tailor" in Sidebar -> posts `createTailoredResume` message to background.js.
4. background.js routes request through ApiClient to Backend API /api/get-ai-response (or client-side fallback).
5. AI digests resume + JD context -> responds with JSON structure.
6. Sidebar parses matching JSON -> shows match score -> activates download formats (PDF/Text/Docx).
```

### B. Salary Estimation Flow (Dual-Tier Caching & Fallback)
```
1. Page Handler detects job cards or detail views -> extracts Job Title, Company, and Location.
2. Senders query SalaryEstimator -> runs _checkCache() locally (24-hour TTL) -> if hit, returns immediately.
3. If miss, calls duckdns Flask Backend API /api/salary-estimate:
   a. Backend checks SQLite cache -> returns range if found.
   b. Backend cache miss -> queries LLM (Groq / Gemini) -> caches result in SQLite -> returns estimate.
4. If backend fails (network error, API timeout), client triggers local direct fallback:
   a. Client queries direct client-side Gemini LLM using user's local API keys.
   b. Reports estimate back to server cache via POST /api/salary-estimate/report.
5. Injects SalaryBadge into target DOM container.
```

---

## 4. Key Design Patterns Implemented

1. **Mediator Pattern**: `background.js` acts as a central message mediator between components.
2. **Adapter Pattern**: `popup/storage-adapter.js` abstracts message details into storage methods.
3. **Factory Pattern**: Core content pages use custom detectors to instantiate correct target handlers.
4. **Strategy Pattern**: Fallback mechanisms switch from server-side AI processing to direct client-side LLM calls when network issues occur.
