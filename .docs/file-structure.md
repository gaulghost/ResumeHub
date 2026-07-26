# ResumeHub File Structure (v1.10)

Source layout. Build artifacts live only under `.build/`.

---

## Root

| Path | Purpose |
|------|---------|
| `manifest.json` | MV3 extension manifest (v1.10) |
| `background.js` | Service worker / message hub |
| `popup.html` / `popup.js` | Popup shell |
| `index.html` | Marketing / landing page |
| `PRIVACY_POLICY.md` / `privacy-policy.html` | Privacy disclosure |
| `nginx_resumehub` | Nginx reverse-proxy snippet for production API |
| `package.json` | Build tooling (`npm run build`) |
| `.build/build.sh` | Packs extension → `.build/extension` + zip |
| `.docs/` | `architecture.md`, `file-structure.md`, `user-flow.md` |

---

## `popup/`

| File | Role |
|------|------|
| `app-controller.js` | Popup bootstrap |
| `state-manager.js` | MVVM state |
| `ui-manager.js` | DOM updates |
| `storage-adapter.js` | Storage via background messages |
| `file-handlers.js` | Resume upload + downloads |
| `resume-processor.js` | Tailor / preview / autofill triggers |
| `event-handlers.js` | Click / keyboard / DnD |

---

## `content-scripts/`

### Shared (`content-scripts/shared/`)
| File | Role |
|------|------|
| `spa-navigation.js` | History patch, URL poll, `SpaPageController` |
| `observe-job-list.js` | Scoped MutationObserver for job lists |
| `salary-badge-base.js` | Shared badge class factory |
| `details-salary.js` | Details-page estimate + retry helper |

### Per site (`linkedin/` \| `naukri/` \| `instahyre/`)
| Path | Role |
|------|------|
| `*-controller.js` | SPA routing → search vs details handler (esbuild entry) |
| `pages/job-search-handler.js` | List badges + observers |
| `pages/job-details-handler.js` | Details badge |
| `components/salary-badge.js` | Site-themed badge (thin wrapper) |
| `config/selectors.js` | DOM selectors |

### LinkedIn-only extras
| Path | Role |
|------|------|
| `components/right-sidebar.js` | Shadow DOM sidebar (tailor / insights / salary) |
| `components/sidebar-template.js` | Sidebar CSS + HTML template |
| `components/job-insights-manager.js` | Insights cache / batch orchestration |

---

## `core/config/`

| File | Role |
|------|------|
| `app-config.js` | Feature flags, version (`window.AppConfig`) |
| `constants.js` | `BACKEND.BASE_URL` / `API_SECRET` |

---

## `utils/`

| File | Role |
|------|------|
| `api-client.js` | Gemini client + backend AI/salary calls |
| `backend-client.js` | Backend base URL + optional auth headers |
| `salary-estimator.js` | Cache + batch estimate (BG & content-script modes) |
| `storage-manager.js` | chrome.storage wrappers |
| `form-autofill.js` | Resume → form value extraction / AI context |
| `sanitizer.js` | HTML / URL sanitization |
| `pdf-generator.js` | PDF export (popup + LinkedIn sidebar) |
| `docx-generator.js` | DOCX export (popup + LinkedIn sidebar) |
| `resume-cache-optimizer.js` | Parsed-resume cache (background) |
| `simple-rate-limiter.js` | Client request pacing |
| `unified-error-handler.js` | Error classification / messages |
| `shared-utilities.js` | delay, file helpers, resume hash, etc. |
| `script-injector.js` | Active-tab JD extract / page text (background) |
| `parallel-processor.js` | Parallel section processing (background) |

---

## `backend/`

| File | Role |
|------|------|
| `resumehub_api.py` | Flask app, model chains, API routes |
| `rh_security.py` | `FREE_MODE`, rate limit, optional API key gate |
| `rh_db.py` | SQLite WAL connection + indexes |
| `rh_admin.py` | `/admin` dashboard |
| `requirements.txt` | Pinned Python deps |
| `.env.example` | Env var template (no secrets) |

Runtime DB path defaults to `resumehub.db` (gitignored). Local `venv/` is gitignored.

---

## `css/` / `assets/` / `lib/` / `tests/`

| Path | Role |
|------|------|
| `css/design-tokens.css` | CSS variables for popup |
| `css/popup_modern.css` | Popup styles |
| `assets/logo128.png` | Extension icons (16/48/128 in manifest) |
| `lib/pdfmake.min.js` + `vfs_fonts.js` | PDF rendering |
| `tests/extension.test.js` | Jest smoke tests |

---

## Build outputs (not source)

| Path | Role |
|------|------|
| `.build/extension/` | Unpacked build — **Load unpacked** in Chrome |
| `.build/resumehub-extension.zip` | Zip package |

**No root `dist/`.** Controllers are esbuild-bundled into `.build/extension/content-scripts/*/`.

### Manifest `web_accessible_resources` (runtime `getURL` only)
- `lib/pdfmake.min.js`, `lib/vfs_fonts.js`
- `utils/pdf-generator.js`, `utils/docx-generator.js`
- `content-scripts/linkedin/config/selectors.js` (LinkedIn sidebar dynamic import)

---

## Intentionally not in git / often hidden in VS Code

| Path | Why |
|------|-----|
| `node_modules/` | npm deps |
| `.build/extension/`, `*.zip` | Build outputs |
| `package-lock.json` | Local lockfile (gitignored by project policy) |
| `backend/venv/`, `*.db`, `.env` | Local Python env / secrets / DB |
| `.DS_Store` | macOS Finder metadata |

Finder shows these; VS Code may hide gitignored items — that is expected.
