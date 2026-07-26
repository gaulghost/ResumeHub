# ResumeHub User & System Flows (v1.10)

---

## 1. User flow

```
Install → Upload resume (+ optional Gemini key)
                │
                ▼
     Browse LinkedIn / Naukri / Instahyre
                │
    ┌───────────┼───────────┐
    ▼           ▼           ▼
 Salary      Sidebar     Autofill
 badges     (LinkedIn)    forms
```

### Setup
1. Install / load unpacked from `.build/extension` (after `npm run build`) or the zip.
2. Open popup → upload resume (PDF/DOCX/TXT).
3. Optional: Advanced Settings → paste Gemini API key (enables client fallback + AI autofill extras).
4. Optional: toggle LinkedIn right sidebar.

### Salary discovery
1. Open a job search page — badges appear on cards after estimation.
2. Open a job details page — details badge uses the same background batch path.
3. Errors show Retry (wired on search and details).

### LinkedIn sidebar
1. Expand ResumeHub dock.
2. View job context, salary estimate, insights (requirements / skills / questions / resources).
3. Tailor resume → preview match → download PDF / DOCX / TXT.

### Autofill
1. Open an application form tab.
2. Popup → **Auto-Fill Current Form**.
3. Heuristics fill contact + common career fields; with a Gemini key, unmatched empty fields may be AI-mapped (capped).
4. Existing non-empty values are never overwritten.

---

## 2. System transactions

### A. Salary estimate
1. Handler extracts title / company / location / URL.
2. Local cache (24h) → miss → `batchSalaryEstimation` → backend `/api/salary-estimate`.
3. Backend SQLite cache → miss → `SALARY_MODELS` AI chain → store.
4. Optional client Gemini fallback + `/api/salary-estimate/report`.

### B. Tailor / insights
1. Sidebar or popup sends JD + resume to background.
2. Background uses `/api/get-ai-response` and/or local Gemini (`REWRITE` / parse chains as applicable).
3. JSON resume / insights rendered in UI.

### C. Autofill
1. Background resolves parsed resume JSON (cache / parse).
2. Injected script classifies fields and fills known keys.
3. Optional one-shot AI JSON map for remaining empty fields (requires local API key).

### D. Telemetry / resume upload
- Anonymous events → `POST /api/telemetry`.
- Resume upload/parse → `POST /api/resume` (disclosed in privacy policy).

---

## 3. Production compatibility notes

| Setting | Effect on existing users |
|---------|---------------------------|
| `FREE_MODE=true` (default) | No API key required — current clients keep working |
| `FREE_MODE=false` + `RESUMEHUB_API_SECRET` | Clients must send `X-ResumeHub-Key` (set `BACKEND.API_SECRET` in extension) |
| Model lists | Unchanged unless you edit `PARSE_MODELS` / `SALARY_MODELS` / `REWRITE_MODELS` |

Admin dashboard: `GET /admin?secret=ADMIN_SECRET` (secret required; empty secret is rejected).
