# ResumeHub Architecture (v1.10)

System design for the Chrome MV3 extension + Flask backend.

---

## 1. Overview

```
Popup / Content Scripts  ──chrome.runtime──►  background.js (service worker)
                                                    │
                                         optional X-ResumeHub-Key
                                                    │
                                                    ▼
                              https://resumehub.duckdns.org  (Flask + SQLite)
                                                    │
                                         Groq / Gemini fallback chains
```

- **FREE_MODE=true (default):** API endpoints stay open (existing clients keep working).
- **FREE_MODE=false:** requires `X-ResumeHub-Key` matching `RESUMEHUB_API_SECRET`.
- AI **model fallback order is fixed** in `backend/resumehub_api.py` (`PARSE_MODELS`, `SALARY_MODELS`, `REWRITE_MODELS`).

---

## 2. Layers

### Presentation
| Surface | Role |
|--------|------|
| `popup/` + `popup.html` | Upload resume, theme, extraction method, tailor, autofill, downloads |
| `content-scripts/linkedin/` | SPA controller, salary badges, right sidebar + insights |
| `content-scripts/naukri/` / `instahyre/` | SPA controller + salary badges |
| `content-scripts/shared/` | Shared SPA navigation, job-list observers, salary badge base, details estimate helper |

### Background
| Module | Role |
|--------|------|
| `background.js` | Message hub: salary batch, tailor, JD extract, telemetry, autofill, AI proxy |
| `utils/*` | API client, salary estimator, storage, sanitizer, PDF/DOCX, form-autofill, backend headers |

### Backend
| Module | Role |
|--------|------|
| `resumehub_api.py` | Flask routes, AI model chains, resume/salary/telemetry handlers |
| `rh_security.py` | Rate limits + optional API auth (`FREE_MODE`) |
| `rh_db.py` | SQLite connect (WAL) + indexes |
| `rh_admin.py` | `/admin` analytics dashboard |

---

## 3. Key flows

### Salary estimation
1. Search/details handler extracts title/company/location/URL.
2. Content-script `SalaryEstimator` uses cache, then `batchEstimate` → background → backend `/api/salary-estimate`.
3. Backend: SQLite cache → AI salary chain → store result.
4. On backend failure, client may fall back to local Gemini (if key set) and `POST /api/salary-estimate/report`.

### Resume tailor
1. Sidebar or popup sends JD + resume to background.
2. Background uses backend `/api/get-ai-response` and/or local Gemini.
3. Structured JSON resume returned for preview / PDF / DOCX / TXT.

### Autofill
1. Popup → `autoFillForm` → background loads parsed resume JSON.
2. Heuristic fill (name, email, phone, company, title, YOE, skills, …).
3. If Gemini key present, up to 8 remaining empty fields mapped in one AI call.
4. Never overwrites non-empty inputs.

---

## 4. Build / load

```bash
npm run build
```

Outputs (only under `.build/`):

| Path | Use |
|------|-----|
| `.build/extension/` | Chrome → Load unpacked |
| `.build/resumehub-extension.zip` | Distribution zip |

There is **no** root `dist/` folder. Source tree is what you edit; `.build/extension` is the packed copy.

---

## 5. Patterns

- **Mediator:** `background.js` between popup, content scripts, and network.
- **Shared SPA base:** `SpaPageController` + history patch + URL poll (avoids body-wide MutationObservers for URL).
- **Strategy fallback:** backend AI → client Gemini when keys exist.
- **Sanitization:** badges/insights use DOM text APIs / `Sanitizer` for AI strings.
