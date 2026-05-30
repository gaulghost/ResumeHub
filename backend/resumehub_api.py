"""
ResumeHub — Oracle AI Proxy Backend
Flask + SQLite

Endpoints:
  POST /api/salary-estimate          — Checks database cache, estimates misses via Gemini fallback chain
  POST /api/salary-estimate/report   — Caches client-estimated salary ranges in SQLite
  GET  /health                       — Health check
"""

import os
import sqlite3
import json
import re
import datetime
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)

# CORS: Allow all origins for the extension requests
CORS(app, resources={r"/api/*": {"origins": "*"},
                     r"/health": {"origins": "*"}})

# Config
GROQ_API_KEY      = os.environ.get("GROQ_API_KEY", "")
DB_PATH           = os.environ.get("DB_PATH", "resumehub.db")
ADMIN_SECRET      = os.environ.get("ADMIN_SECRET", "")
FREE_MODE         = os.environ.get("FREE_MODE", "true").lower() == "true"

gemini_keys_raw   = os.environ.get("GEMINI_API_KEYS", "")
if gemini_keys_raw:
    GEMINI_API_KEYS = [k.strip() for k in gemini_keys_raw.split(",") if k.strip()]
else:
    legacy_key = os.environ.get("GEMINI_API_KEY", "")
    GEMINI_API_KEYS = [legacy_key] if legacy_key else []

# Fallback chain for salary estimation
SALARY_AI_MODELS = []
for i in range(len(GEMINI_API_KEYS)):
    SALARY_AI_MODELS.append({"id": "gemini-flash-latest", "provider": "gemini", "key_index": i})
for i in range(len(GEMINI_API_KEYS)):
    SALARY_AI_MODELS.append({"id": "gemini-flash-lite-latest", "provider": "gemini", "key_index": i})
for i in range(len(GEMINI_API_KEYS)):
    SALARY_AI_MODELS.append({"id": "gemini-3-flash-preview", "provider": "gemini", "key_index": i})
SALARY_AI_MODELS.extend([
    {"id": "llama-3.3-70b-versatile",                   "provider": "groq"},
    {"id": "qwen/qwen3-32b",                            "provider": "groq"},
    {"id": "llama-3.1-8b-instant",                      "provider": "groq"},
])

import sys
sys.path.append("/home/ubuntu/oracle_common")
import oracle_ai


def call_model(model_cfg: dict, messages: list, max_tokens: int, temperature: float, response_format: dict = None) -> str:
    if model_cfg["provider"] == "groq":
        if not GROQ_API_KEY:
            raise Exception("GROQ_API_KEY not configured")
        url  = "https://api.groq.com/openai/v1/chat/completions"
        auth = f"Bearer {GROQ_API_KEY}"
    elif model_cfg["provider"] == "gemini":
        key_idx = model_cfg.get("key_index", 0)
        if not GEMINI_API_KEYS or key_idx >= len(GEMINI_API_KEYS):
            raise Exception(f"Gemini API key at index {key_idx} not configured")
        key = GEMINI_API_KEYS[key_idx]
        url  = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
        auth = f"Bearer {key}"
    else:
        raise Exception(f"Unknown provider: {model_cfg['provider']}")

    json_payload = {
        "model"      : model_cfg["id"],
        "messages"   : messages,
        "max_tokens" : max_tokens,
        "temperature": temperature,
    }
    if response_format:
        json_payload["response_format"] = response_format

    resp = requests.post(
        url,
        headers={"Authorization": auth, "Content-Type": "application/json"},
        json=json_payload,
        timeout=30,
    )
    if resp.status_code == 429:
        retry_after = 60
        try:
            val = resp.headers.get("Retry-After")
            if val:
                retry_after = int(float(val))
        except Exception:
            pass
        raise oracle_ai.RateLimitError(f"{model_cfg['id']} rate limited", retry_after=retry_after)
    resp.raise_for_status()

    # Log Groq headers to shared DB
    if model_cfg["provider"] == "groq":
        try:
            oracle_ai.update_groq_limits(model_cfg["id"], resp.headers)
        except Exception as e:
            print(f"[LIMIT LOG ERROR] {e}")

    content = resp.json()["choices"][0]["message"]["content"] or ""
    content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
    return content


def call_with_fallback_salary(messages: list, max_tokens: int = 2048, temperature: float = 0.3, response_format: dict = None):
    for model_cfg in SALARY_AI_MODELS:
        if model_cfg["provider"] == "gemini":
            key_idx = model_cfg.get("key_index", 0)
            if key_idx >= len(GEMINI_API_KEYS):
                continue
            key = GEMINI_API_KEYS[key_idx]
            if not oracle_ai.can_use_gemini_key(key, model_cfg["id"]):
                continue
        else:
            if oracle_ai.is_model_exhausted(model_cfg["id"]):
                continue
        try:
            answer = call_model(model_cfg, messages, max_tokens, temperature, response_format)
            if not answer:
                continue

            cleaned_answer = clean_json_response(answer)
            parsed = json.loads(cleaned_answer)

            if isinstance(parsed, dict):
                ai_results = parsed.get("results") or parsed.get("salaries") or parsed.get("estimates") or list(parsed.values())[0] if parsed.values() else []
                if not isinstance(ai_results, list):
                    ai_results = [parsed]
            elif isinstance(parsed, list):
                ai_results = parsed
            else:
                ai_results = []

            if not ai_results:
                raise Exception("Model returned empty results list")

            if model_cfg["provider"] == "gemini":
                oracle_ai.record_gemini_call(GEMINI_API_KEYS[model_cfg.get("key_index", 0)], model_cfg["id"])
            return parsed, model_cfg["id"]
        except oracle_ai.RateLimitError as rle:
            if model_cfg["provider"] == "gemini":
                oracle_ai.mark_gemini_key_exhausted(GEMINI_API_KEYS[model_cfg.get("key_index", 0)], rle.retry_after)
            else:
                oracle_ai.mark_model_exhausted(model_cfg["id"], rle.retry_after)
            continue
        except Exception as e:
            print(f"[SALARY MODEL ERROR] {model_cfg['id']} failed during execution or JSON parse: {e}")
            continue
    raise Exception("All salary AI models exhausted for today.")


def call_with_fallback_ai(messages: list, max_tokens: int = 4096, temperature: float = 0.3, response_format: dict = None):
    for model_cfg in SALARY_AI_MODELS:
        if model_cfg["provider"] == "gemini":
            key_idx = model_cfg.get("key_index", 0)
            if key_idx >= len(GEMINI_API_KEYS):
                continue
            key = GEMINI_API_KEYS[key_idx]
            if not oracle_ai.can_use_gemini_key(key, model_cfg["id"]):
                continue
        else:
            if oracle_ai.is_model_exhausted(model_cfg["id"]):
                continue
        try:
            answer = call_model(model_cfg, messages, max_tokens, temperature, response_format)
            if not answer:
                continue

            if response_format and response_format.get("type") == "json_object":
                cleaned_answer = clean_json_response(answer)
                parsed = json.loads(cleaned_answer)
                answer = json.dumps(parsed)

            if model_cfg["provider"] == "gemini":
                oracle_ai.record_gemini_call(GEMINI_API_KEYS[model_cfg.get("key_index", 0)], model_cfg["id"])
            return answer, model_cfg["id"]
        except oracle_ai.RateLimitError as rle:
            if model_cfg["provider"] == "gemini":
                oracle_ai.mark_gemini_key_exhausted(GEMINI_API_KEYS[model_cfg.get("key_index", 0)], rle.retry_after)
            else:
                oracle_ai.mark_model_exhausted(model_cfg["id"], rle.retry_after)
            continue
        except Exception as e:
            print(f"[AI MODEL ERROR] {model_cfg['id']} failed during execution: {e}")
            continue
    raise Exception("All AI models exhausted for today.")


def clean_json_response(text: str) -> str:
    text = text.strip()
    first_brace = text.find('{')
    last_brace = text.rfind('}')
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        return text[first_brace:last_brace + 1]
    return text


# SQLite DB and Analytics Helpers
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS salary_cache (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                job_key       TEXT UNIQUE NOT NULL,
                job_title     TEXT,
                company       TEXT,
                location      TEXT,
                tc            TEXT,
                base          TEXT,
                bonus         TEXT,
                stock         TEXT,
                confidence    TEXT,
                currency      TEXT,
                last_updated  TEXT NOT NULL
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id       TEXT PRIMARY KEY,
                username      TEXT,
                email         TEXT,
                created_at    TEXT NOT NULL,
                last_seen     TEXT
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS resumes (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id       TEXT,
                filename      TEXT,
                mime_type     TEXT,
                parsed_json   TEXT,
                uploaded_at   TEXT NOT NULL,
                hash          TEXT,
                content       TEXT
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS telemetry (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id       TEXT,
                event_type    TEXT NOT NULL,
                timestamp     TEXT NOT NULL,
                metadata      TEXT
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS ai_usage (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id       TEXT NOT NULL,
                date          TEXT NOT NULL,
                count         INTEGER DEFAULT 0,
                UNIQUE(user_id, date)
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS ai_conversations (
                id                 INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id            TEXT,
                timestamp          TEXT NOT NULL,
                operation          TEXT,
                model_used         TEXT,
                prompt_tokens      INTEGER,
                completion_tokens  INTEGER,
                status             TEXT,
                country_code       TEXT,
                country            TEXT
            )
        """)
        # Migrations in case tables exist
        for table, col in [("users", "last_seen TEXT"), ("resumes", "hash TEXT")]:
            try:
                db.execute(f"ALTER TABLE {table} ADD COLUMN {col}")
            except Exception:
                pass
        db.commit()

        try:
            oracle_ai.init_shared_db()
        except Exception as e:
            print(f"[SHARED DB ERROR] {e}")


init_db()


# ── Geo-IP Helper ──────────────────────────────────────────────────────────

def get_country_from_ip(ip: str):
    """Resolve IP → (country_code, country_name). Returns ('', '') on failure."""
    if not ip or ip in ("127.0.0.1", "::1"):
        return "", ""
    try:
        r = requests.get(
            f"http://ip-api.com/json/{ip}?fields=countryCode,country",
            timeout=3,
        )
        if r.status_code == 200:
            data = r.json()
            return data.get("countryCode", ""), data.get("country", "")
    except Exception:
        pass
    return "", ""


# ── Native Gemini Client for File parsing ────────────────────────────────────

def call_gemini_native(model_id: str, key: str, prompt: str, file_content_b64: str = None, mime_type: str = None) -> str:
    """Calls native Gemini generateContent API (supports inline document parsing)."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent?key={key}"
    
    parts = [{"text": prompt}]
    if file_content_b64 and mime_type:
        parts.append({
            "inline_data": {
                "mime_type": mime_type,
                "data": file_content_b64
            }
        })
        
    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.1
        }
    }
    
    headers = {"Content-Type": "application/json"}
    resp = requests.post(url, headers=headers, json=payload, timeout=45)
    
    if resp.status_code == 429:
        raise RateLimitError(f"Gemini API limit hit on model {model_id}")
    resp.raise_for_status()
    
    resp_json = resp.json()
    try:
        content = resp_json["candidates"][0]["content"]["parts"][0]["text"]
        return content.strip()
    except (KeyError, IndexError):
        raise Exception(f"Invalid API response schema: {json.dumps(resp_json)}")


PARSE_PROMPT = """**Instruction:**
Analyze the attached resume file content. Extract the information and structure it precisely according to the following JSON format. If a section or field is not present in the resume, represent it as 'null' (for objects/strings) or an empty array [] (for arrays like bullets/achievements).
For the "jobTitle" field, extract the person's current or most recent job title/position from their work experience or professional summary. This should be their primary professional role.
For the "skills" section, group related skills into logical categories (e.g., "Programming Languages", "Frameworks & Libraries", "Databases", "Tools", "Cloud Platforms", "AI/ML") and represent it as an array of objects, each with a "category" name and an array of "items".
Do not add any information not present in the resume. Output *only* the valid JSON object, starting with { and ending with }.

**IMPORTANT: The final resume must comply with a 500 word / 3000 character limit.** Focus on capturing the most relevant content while staying within these constraints.

**SPACE OPTIMIZATION GUIDELINES:**
- For skills: Limit to 4-5 categories maximum, with 3-6 items per category
- Consolidate similar skills and remove redundant entries
- Prioritize breadth over exhaustive lists

**Target JSON Structure:**
```json
{
  "contact": { "name": "string|null", "email": "string|null", "phone": "string|null", "linkedin": "string|null", "github": "string|null", "portfolio": "string|null" },
  "jobTitle": "string|null",
  "summary": "string|null",
  "experience": [ { "title": "string", "company": "string", "location": "string|null", "dates": "string|null", "bullets": ["string", "..."] } ],
  "education": [ { "institution": "string", "degree": "string", "location": "string|null", "dates": "string|null", "details": "string|null" } ],
  "skills": [ { "category": "string", "items": ["string", "..."] } ],
  "projects": [ { "name": "string", "description": "string|null", "technologies": ["string", "..."], "link": "string|null" } ],
  "achievements": [ "string", "..." ]
}
```

**--- Resume Content Analysis ---**
Parse the attached file and generate the JSON output."""


def parse_resume_with_fallback(file_content_b64: str, mime_type: str):
    """Fallback loop across configured Gemini keys for parsing resume."""
    for model_cfg in SALARY_AI_MODELS:
        if model_cfg["provider"] == "gemini":
            key_idx = model_cfg.get("key_index", 0)
            if not GEMINI_API_KEYS or key_idx >= len(GEMINI_API_KEYS):
                continue
            key = GEMINI_API_KEYS[key_idx]
            if not oracle_ai.can_use_gemini_key(key, model_cfg["id"]):
                continue
            try:
                answer = call_gemini_native(model_cfg["id"], key, PARSE_PROMPT, file_content_b64, mime_type)
                if not answer:
                    continue

                cleaned_answer = clean_json_response(answer)
                parsed = json.loads(cleaned_answer)

                oracle_ai.record_gemini_call(key, model_cfg["id"])
                return parsed, model_cfg["id"]
            except oracle_ai.RateLimitError as rle:
                oracle_ai.mark_gemini_key_exhausted(key, rle.retry_after)
                continue
            except Exception as e:
                print(f"[BACKEND PARSE ATTEMPT ERROR] Model {model_cfg['id']} failed: {e}")
                continue
    raise Exception("All Gemini API endpoints/keys exhausted for resume parsing.")


# ── Telemetry and Resume Saving Endpoints ────────────────────────────────────

@app.route("/api/telemetry", methods=["POST"])
def api_telemetry():
    """
    POST /api/telemetry
    Body: { user_id, event_type, metadata }
    Logs user engagement.
    """
    data       = request.get_json(force=True) or {}
    user_id    = data.get("user_id", "anonymous").strip()
    event_type = data.get("event_type", "unknown").strip()
    metadata   = data.get("metadata", {})
    
    now_iso = datetime.datetime.utcnow().isoformat()
    
    with get_db() as db:
        # Guarantee user profile exists
        db.execute("""
            INSERT INTO users (user_id, username, email, created_at, last_seen)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                last_seen = excluded.last_seen
        """, (user_id, "Anonymous", None, now_iso, now_iso))
        
        db.execute(
            """INSERT INTO telemetry (user_id, event_type, timestamp, metadata)
               VALUES (?, ?, ?, ?)""",
            (user_id, event_type, now_iso, json.dumps(metadata))
        )
        db.commit()
        
    return jsonify({"status": "logged"}), 200


@app.route("/api/resume", methods=["POST"])
def api_resume():
    """
    POST /api/resume
    Body: { user_id, filename, content (b64), mime_type, parsed_json }
    Saves and optionally parses user's resume.
    """
    data        = request.get_json(force=True) or {}
    user_id     = data.get("user_id", "").strip()
    filename    = data.get("filename", "").strip()
    content     = data.get("content", "").strip()
    mime_type   = data.get("mime_type", "").strip()
    parsed_json = data.get("parsed_json")
    
    if not user_id:
        return jsonify({"error": "Missing user_id"}), 400
        
    now_iso = datetime.datetime.utcnow().isoformat()
    today_str = datetime.datetime.utcnow().strftime("%Y-%m-%d")
    user_ip = request.headers.get("X-Real-IP") or request.remote_addr or ""
    country_code, country = get_country_from_ip(user_ip)
    
    # MD5 hash of resume to check for duplicates
    import hashlib
    content_hash = ""
    if content:
        content_hash = hashlib.md5(content.encode('utf-8')).hexdigest()
    elif filename:
        content_hash = hashlib.md5(filename.encode('utf-8')).hexdigest()
        
    parsed_dict = None
    model_used = "client-parsed"
    
    if parsed_json:
        # Pre-parsed by client
        if isinstance(parsed_json, str):
            try:
                parsed_dict = json.loads(parsed_json)
            except Exception:
                pass
        elif isinstance(parsed_json, dict):
            parsed_dict = parsed_json
        parsed_str = json.dumps(parsed_dict) if parsed_dict else str(parsed_json)
    else:
        # Parse on backend
        if not content or not mime_type:
            return jsonify({"error": "Missing resume content or mime_type for parsing"}), 400
            
        try:
            parsed_dict, model_used = parse_resume_with_fallback(content, mime_type)
            parsed_str = json.dumps(parsed_dict)
            
            with get_db() as db:
                db.execute(
                    """INSERT INTO ai_usage (user_id, date, count) VALUES (?, ?, 1)
                       ON CONFLICT(user_id, date) DO UPDATE SET count = count + 1""",
                    (user_id, today_str)
                )
                db.execute(
                    """INSERT INTO ai_conversations 
                       (user_id, timestamp, operation, model_used, prompt_tokens, completion_tokens, status, country_code, country)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (user_id, now_iso, "resume_parsing", model_used, 1200, 800, "success", country_code, country)
                )
                db.commit()
        except Exception as e:
            print(f"[BACKEND PARSE ERROR] {e}")
            with get_db() as db:
                db.execute(
                    """INSERT INTO ai_conversations 
                       (user_id, timestamp, operation, model_used, prompt_tokens, completion_tokens, status, country_code, country)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (user_id, now_iso, "resume_parsing", "failed", 0, 0, "failed", country_code, country)
                )
                db.commit()
            return jsonify({"error": f"Failed to parse resume: {str(e)}"}), 500

    # Extract user details
    email = None
    username = "Anonymous"
    if parsed_dict:
        contact = parsed_dict.get("contact", {})
        if contact:
            username = contact.get("name") or "Anonymous"
            email = contact.get("email")
            
    with get_db() as db:
        # Create or update user profile
        db.execute("""
            INSERT INTO users (user_id, username, email, created_at, last_seen)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                username = COALESCE(excluded.username, users.username),
                email = COALESCE(excluded.email, users.email),
                last_seen = excluded.last_seen
        """, (user_id, username, email, now_iso, now_iso))
        
        # Prevent duplicates
        existing = None
        if content_hash:
            existing = db.execute(
                "SELECT id FROM resumes WHERE user_id = ? AND hash = ?",
                (user_id, content_hash)
            ).fetchone()
            
        if not existing:
            db.execute("""
                INSERT INTO resumes (user_id, filename, mime_type, parsed_json, uploaded_at, hash, content)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (user_id, filename, mime_type, parsed_str, now_iso, content_hash, content))
            
        db.commit()
        
    return jsonify({
        "success": True, 
        "parsed_json": parsed_dict,
        "model_used": model_used
    }), 200


# ── Analytics Admin Panel ────────────────────────────────────────────────────

@app.route("/admin", methods=["GET"])
def admin_dashboard():
    """
    GET /admin?secret=ADMIN_SECRET
    Analytics dashboard — reads live data from SQLite.
    """
    secret = request.args.get("secret", "")
    if ADMIN_SECRET and secret != ADMIN_SECRET:
        return "<h2 style='font-family:sans-serif;margin:40px'>401 — Unauthorized</h2>", 401

    now_iso   = datetime.datetime.utcnow().isoformat()
    today_str = datetime.datetime.utcnow().strftime("%Y-%m-%d")
    auth_qs   = f"?secret={secret}" if secret else "?"

    with get_db() as db:
        # Metric counts
        total_users     = db.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        total_resumes   = db.execute("SELECT COUNT(*) FROM resumes").fetchone()[0]
        total_telemetry = db.execute("SELECT COUNT(*) FROM telemetry").fetchone()[0]
        telemetry_today = db.execute(
            "SELECT COUNT(*) FROM telemetry WHERE date(timestamp) = ?", (today_str,)
        ).fetchone()[0]
        total_ai_calls  = db.execute("SELECT COALESCE(SUM(count),0) FROM ai_usage").fetchone()[0]
        ai_today        = db.execute(
            "SELECT COALESCE(SUM(count),0) FROM ai_usage WHERE date = ?", (today_str,)
        ).fetchone()[0]
        dau_today       = db.execute(
            "SELECT COUNT(DISTINCT user_id) FROM telemetry WHERE event_type='dau_ping' AND date(timestamp)=?",
            (today_str,)
        ).fetchone()[0]

        # 30-day user signups trend
        signups_30d = db.execute(
            """SELECT date(created_at) as day, COUNT(*) as cnt
               FROM users WHERE created_at > datetime('now','-30 days')
               GROUP BY day ORDER BY day"""
        ).fetchall()

        # 14-day telemetry trend
        telem_14d = db.execute(
            """SELECT date(timestamp) as day, COUNT(*) as cnt
               FROM telemetry WHERE timestamp > datetime('now','-14 days')
               GROUP BY day ORDER BY day"""
        ).fetchall()

        # 14-day resumes saved trend
        resumes_14d = db.execute(
            """SELECT date(uploaded_at) as day, COUNT(*) as cnt
               FROM resumes WHERE uploaded_at > datetime('now','-14 days')
               GROUP BY day ORDER BY day"""
        ).fetchall()

        # 14-day DAU trend
        dau_14d = db.execute(
            """SELECT date(timestamp) as day, COUNT(DISTINCT user_id) as cnt
               FROM telemetry WHERE event_type='dau_ping' AND timestamp > datetime('now','-14 days')
               GROUP BY day ORDER BY day"""
        ).fetchall()

        # Top AI Users
        top_ai_users = db.execute(
            """SELECT user_id, SUM(count) as total
               FROM ai_usage GROUP BY user_id ORDER BY total DESC LIMIT 10"""
        ).fetchall()

        # Telemetry Type Breakdown
        telem_breakdown = db.execute(
            """SELECT event_type, COUNT(*) as cnt
               FROM telemetry GROUP BY event_type ORDER BY cnt DESC"""
        ).fetchall()

        # Recent Users list
        recent_users = db.execute(
            """SELECT user_id, username, email, created_at, last_seen
               FROM users ORDER BY last_seen DESC LIMIT 25"""
        ).fetchall()

        # Resumes List
        recent_resumes = db.execute(
            """SELECT r.id, r.user_id, r.filename, r.mime_type, r.uploaded_at, r.parsed_json,
                      u.username, u.email
               FROM resumes r
               LEFT JOIN users u ON r.user_id = u.user_id
               ORDER BY r.uploaded_at DESC LIMIT 25"""
        ).fetchall()

        # Telemetry Log
        recent_telem = db.execute(
            """SELECT user_id, event_type, timestamp, metadata
               FROM telemetry ORDER BY timestamp DESC LIMIT 30"""
        ).fetchall()

        # Salary Cache
        recent_salaries = db.execute(
            """SELECT job_title, company, location, tc, currency, last_updated
               FROM salary_cache ORDER BY last_updated DESC LIMIT 25"""
        ).fetchall()

    # Prep Chart.js variables
    signup_labels = [r["day"] for r in signups_30d]
    signup_data   = [r["cnt"] for r in signups_30d]
    dau_labels    = [r["day"] for r in dau_14d]
    dau_data      = [r["cnt"] for r in dau_14d]
    telem_labels  = [r["day"] for r in telem_14d]
    telem_data    = [r["cnt"] for r in telem_14d]
    res_labels    = [r["day"] for r in resumes_14d]
    res_data      = [r["cnt"] for r in resumes_14d]

    # Pre-build HTML table rows to avoid nested f-string syntax issues in Python < 3.12
    html_telem_breakdown = ""
    if telem_breakdown:
        for r in telem_breakdown:
            html_telem_breakdown += f"<tr><td><span class='badge bp'>{r['event_type']}</span></td><td><b>{r['cnt']}</b></td></tr>"
    else:
        html_telem_breakdown = "<tr><td colspan='2' class='empty'>No telemetry recorded</td></tr>"

    html_top_ai_users = ""
    if top_ai_users:
        for r in top_ai_users:
            html_top_ai_users += f"<tr><td>{r['user_id']}</td><td><b>{r['total']}</b></td></tr>"
    else:
        html_top_ai_users = "<tr><td colspan='2' class='empty'>No AI calls logged</td></tr>"

    html_recent_resumes = ""
    if recent_resumes:
        for r in recent_resumes:
            username_val = html_escape(r['username'] or 'Anonymous')
            email_val = html_escape(r['email'] or 'N/A')
            filename_val = html_escape(r['filename'] or 'N/A')
            mime_val = r['mime_type']
            uploaded_val = r['uploaded_at']
            user_id_or_username = html_escape(r['username'] or r['user_id'])
            parsed_json_val = html_escape_js(r['parsed_json'] or "{}")
            html_recent_resumes += f"<tr><td><b>{username_val}</b></td><td>{email_val}</td><td>{filename_val}</td><td>{mime_val}</td><td>{uploaded_val}</td><td><span class='clickable' onclick='openJsonModal(\"Parsed JSON: {user_id_or_username}\",\"{parsed_json_val}\")'>View JSON</span></td></tr>"
    else:
        html_recent_resumes = "<tr><td colspan='6' class='empty'>No resumes uploaded yet</td></tr>"

    html_recent_salaries = ""
    if recent_salaries:
        for r in recent_salaries:
            title_val = html_escape(r['job_title'] or 'N/A')
            company_val = html_escape(r['company'] or 'N/A')
            loc_val = html_escape(r['location'] or 'N/A')
            tc_val = r['tc']
            curr_val = r['currency']
            updated_val = r['last_updated']
            html_recent_salaries += f"<tr><td><b>{title_val}</b></td><td>{company_val}</td><td>{loc_val}</td><td><span class='badge bg'>{tc_val}</span></td><td><b>{curr_val}</b></td><td>{updated_val}</td></tr>"
    else:
        html_recent_salaries = "<tr><td colspan='6' class='empty'>No salary cache data</td></tr>"

    html_recent_telem = ""
    if recent_telem:
        for r in recent_telem:
            uid_val = r['user_id']
            ev_val = r['event_type']
            ts_val = r['timestamp']
            meta_val = html_escape(r['metadata'] or '')
            html_recent_telem += f"<tr><td>{uid_val}</td><td><span class='badge bo'>{ev_val}</span></td><td>{ts_val}</td><td style='font-family:monospace;font-size:10px'>{meta_val}</td></tr>"
    else:
        html_recent_telem = "<tr><td colspan='4' class='empty'>No activity logged</td></tr>"

    html_recent_users = ""
    if recent_users:
        for r in recent_users:
            uid_val = r['user_id']
            uname_val = html_escape(r['username'] or 'Anonymous')
            email_val = html_escape(r['email'] or 'N/A')
            created_val = r['created_at']
            seen_val = r['last_seen']
            html_recent_users += f"<tr><td>{uid_val}</td><td><b>{uname_val}</b></td><td>{email_val}</td><td>{created_val}</td><td>{seen_val}</td></tr>"
    else:
        html_recent_users = "<tr><td colspan='5' class='empty'>No users registered</td></tr>"

    suspended = []
    try:
        with oracle_ai.get_shared_db() as sdb:
            now_iso = datetime.datetime.utcnow().isoformat()
            rows = sdb.execute("SELECT model_id, resume_time FROM model_exhaustion WHERE resume_time > ?", (now_iso,)).fetchall()
            for r in rows:
                res_dt = datetime.datetime.fromisoformat(r["resume_time"])
                suspended.append(f"{r['model_id']} (until {res_dt.strftime('%H:%M:%S UTC')})")
    except Exception as e:
        print(f"[ERR] Failed to get suspensions: {e}")
    exhausted_display = ", ".join(suspended) or "none"
    model_chain = " → ".join(m["id"].split("/")[-1] for m in SALARY_AI_MODELS)
    free_mode_display = "✓ ON — all users pro" if FREE_MODE else "✗ OFF — gating active"

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>ResumeHub AI — Analytics</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
  :root {{
    --bg:#08070d;--card:#100f1c;--border:#1e1b30;
    --text:#f3f4f6;--muted:#8b8fa3;
    --accent:#8b5cf6;--green:#10b981;--blue:#3b82f6;--orange:#f59e0b;--red:#ef4444;
  }}
  *{{box-sizing:border-box;margin:0;padding:0;}}
  body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
        background:var(--bg);color:var(--text);padding:24px;font-size:14px;}}
  h1{{font-size:22px;font-weight:700;margin-bottom:4px;background: linear-gradient(135deg, #a78bfa, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent;}}
  h2{{font-size:13px;font-weight:700;margin:28px 0 14px;color:var(--muted);
      text-transform:uppercase;letter-spacing:.06em;}}
  .subtitle{{color:var(--muted);font-size:12px;margin-bottom:24px;}}
  .cards{{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:24px;}}
  .card{{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px;box-shadow: 0 4px 12px rgba(0,0,0,0.3);}}
  .card-label{{color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;}}
  .card-value{{font-size:24px;font-weight:700;}}
  .card-value.accent{{color:var(--accent);}} .card-value.green{{color:var(--green);}}
  .card-value.blue{{color:var(--blue);}} .card-value.orange{{color:var(--orange);}} .card-value.red{{color:var(--red);}}
  .card-sub{{color:var(--muted);font-size:10px;margin-top:3px;}}
  .g2{{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;}}
  @media(max-width:800px){{.g2{{grid-template-columns:1fr;}}}}
  .chart-box{{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:16px;box-shadow: 0 4px 12px rgba(0,0,0,0.3);}}
  .chart-title{{font-size:12px;font-weight:600;margin-bottom:10px;color:var(--muted);text-transform:uppercase;}}
  .section{{background:var(--card);border:1px solid var(--border);border-radius:10px;
            padding:16px;margin-bottom:14px;overflow:hidden;box-shadow: 0 4px 12px rgba(0,0,0,0.3);}}
  .section-title{{font-size:12px;font-weight:600;margin-bottom:10px;color:var(--muted);text-transform:uppercase;}}
  .tw{{overflow-x:auto;max-height: 400px; overflow-y: auto;}}
  table{{width:100%;border-collapse:collapse;font-size:11px;}}
  th{{color:var(--muted);text-align:left;padding:7px 10px;font-weight:600;
      border-bottom:1px solid var(--border);white-space:nowrap;}}
  td{{padding:8px 10px;border-bottom:1px solid var(--border);vertical-align:top;
      max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}}
  tr:last-child td{{border-bottom:none;}}
  tr:hover td {{background: rgba(255,255,255,0.02);}}
  .badge{{display:inline-block;padding:2px 7px;border-radius:999px;font-size:10px;font-weight:700;}}
  .bp{{background:rgba(139, 92, 246, 0.2);color:#c084fc;border:1px solid rgba(139, 92, 246, 0.4);}}
  .bg{{background:rgba(16, 185, 129, 0.2);color:#34d399;border:1px solid rgba(16, 185, 129, 0.4);}}
  .bo{{background:rgba(245, 158, 11, 0.2);color:#fbbf24;border:1px solid rgba(245, 158, 11, 0.4);}}
  .empty{{color:var(--muted);font-size:11px;padding:12px 0;text-align:center;}}
  .clickable{{cursor:pointer;color:var(--accent);text-decoration:underline dotted;font-weight:600;}}
  #lhModal{{display:none;position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;
            align-items:center;justify-content:center;backdrop-filter:blur(4px);}}
  #lhModal.open{{display:flex;}}
  #lhModalBox{{background:#121124;border:1px solid var(--border);border-radius:10px;
                padding:28px 24px 20px;max-width:720px;width:92%;max-height:80vh;
                overflow-y:auto;position:relative;box-shadow:0 10px 30px rgba(0,0,0,0.5);}}
  #lhModalLabel{{font-size:12px;font-weight:700;letter-spacing:.05em;
                  text-transform:uppercase;color:var(--accent);margin-bottom:12px;}}
  #lhModalText{{white-space:pre-wrap;word-break:break-word;font-size:12px;
                 color:#e2e8f0;margin:0;font-family:monospace;line-height:1.6;background:#090912;padding:14px;border-radius:6px;border:1px solid var(--border);}}
  #lhModalClose{{position:absolute;top:14px;right:16px;background:none;border:none;
                 color:var(--muted);font-size:22px;cursor:pointer;line-height:1;}}
  .infobar{{background:#1e2d40;border:1px solid var(--border);border-radius:8px;
            padding:9px 14px;font-size:11px;color:var(--muted);margin-bottom:18px;word-break:break-all;}}
  .infobar b{{color:var(--text);}}
</style>
</head>
<body>
<div id="lhModal" onclick="if(event.target===this)closeLHModal()">
  <div id="lhModalBox">
    <button id="lhModalClose" onclick="closeLHModal()">&#x2715;</button>
    <div id="lhModalLabel"></div>
    <pre id="lhModalText"></pre>
  </div>
</div>
<h1>ResumeHub AI Analytics</h1>
<p class="subtitle">Live System Analytics · SQLite ·
  <a href="{auth_qs}" style="color:var(--accent);text-decoration:none">Refresh</a> ·
  {datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")}</p>

<div class="infobar">
  <b>FREE_MODE:</b> {free_mode_display}
  &nbsp;|&nbsp;
  <b>Chain:</b> {model_chain}
  &nbsp;|&nbsp;
  <b>Exhausted:</b> {exhausted_display}
</div>

<div class="cards">
  <div class="card">
    <div class="card-label">Total Users</div>
    <div class="card-value accent">{total_users}</div>
    <div class="card-sub">all-time installs</div>
  </div>
  <div class="card">
    <div class="card-label">Saved Resumes</div>
    <div class="card-value green">{total_resumes}</div>
    <div class="card-sub">parsed & backup</div>
  </div>
  <div class="card">
    <div class="card-label">DAU Today</div>
    <div class="card-value blue">{dau_today}</div>
    <div class="card-sub">unique active users</div>
  </div>
  <div class="card">
    <div class="card-label">AI Calls Today</div>
    <div class="card-value orange">{ai_today}</div>
    <div class="card-sub">limit-monitored</div>
  </div>
  <div class="card">
    <div class="card-label">Total AI Calls</div>
    <div class="card-value red">{total_ai_calls}</div>
    <div class="card-sub">cumulative load</div>
  </div>
</div>
 
<div class="g2">
  <div class="chart-box">
    <div class="chart-title">DAU & Signups Trend (Last 30 Days)</div>
    <canvas id="signupChart" style="max-height:220px"></canvas>
  </div>
  <div class="chart-box">
    <div class="chart-title">Action & Parsing Volume (Last 14 Days)</div>
    <canvas id="volumeChart" style="max-height:220px"></canvas>
  </div>
</div>
 
<div class="g2">
  <div class="section">
    <div class="section-title">Telemetry Breakdown</div>
    <div class="tw">
      <table>
        <thead>
          <tr>
            <th>Event Type</th>
            <th>Count</th>
          </tr>
        </thead>
        <tbody>
          {html_telem_breakdown}
        </tbody>
      </table>
    </div>
  </div>
 
  <div class="section">
    <div class="section-title">Top AI Usage Users</div>
    <div class="tw">
      <table>
        <thead>
          <tr>
            <th>User ID</th>
            <th>Total AI Calls</th>
          </tr>
        </thead>
        <tbody>
          {html_top_ai_users}
        </tbody>
      </table>
    </div>
  </div>
</div>
 
<div class="section">
  <div class="section-title">Recent Uploaded Resumes ({len(recent_resumes)})</div>
  <div class="tw">
    <table>
      <thead>
        <tr>
          <th>User Name</th>
          <th>Email</th>
          <th>File Name</th>
          <th>MIME Type</th>
          <th>Uploaded At</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        {html_recent_resumes}
      </tbody>
    </table>
  </div>
</div>
 
<div class="section">
  <div class="section-title">Recent Salary Estimates Cache ({len(recent_salaries)})</div>
  <div class="tw">
    <table>
      <thead>
        <tr>
          <th>Job Title</th>
          <th>Company</th>
          <th>Location</th>
          <th>Compensation Range</th>
          <th>Currency</th>
          <th>Cached At</th>
        </tr>
      </thead>
      <tbody>
        {html_recent_salaries}
      </tbody>
    </table>
  </div>
</div>
 
<div class="section">
  <div class="section-title">Recent Activity Log (Telemetry)</div>
  <div class="tw">
    <table>
      <thead>
        <tr>
          <th>User ID</th>
          <th>Event Type</th>
          <th>Timestamp</th>
          <th>Metadata</th>
        </tr>
      </thead>
      <tbody>
        {html_recent_telem}
      </tbody>
    </table>
  </div>
</div>
 
<div class="section">
  <div class="section-title">Recent Registered Users</div>
  <div class="tw">
    <table>
      <thead>
        <tr>
          <th>User ID</th>
          <th>Extracted Name</th>
          <th>Extracted Email</th>
          <th>First Seen</th>
          <th>Last Seen</th>
        </tr>
      </thead>
      <tbody>
        {html_recent_users}
      </tbody>
    </table>
  </div>
</div>
 
<script>
  function openJsonModal(title, jsonText) {{
    document.getElementById('lhModalLabel').textContent = title;
    try {{
      const parsed = JSON.parse(jsonText);
      document.getElementById('lhModalText').textContent = JSON.stringify(parsed, null, 2);
    }} catch(e) {{
      document.getElementById('lhModalText').textContent = jsonText;
    }}
    document.getElementById('lhModal').classList.add('open');
  }}
  function closeLHModal() {{
    document.getElementById('lhModal').classList.remove('open');
  }}
 
  // ── Charts Setup ──
  const ctxSignup = document.getElementById('signupChart').getContext('2d');
  new Chart(ctxSignup, {{
    type: 'line',
    data: {{
      labels: {json.dumps(signup_labels)},
      datasets: [
        {{
          label: 'New Registrations',
          data: {json.dumps(signup_data)},
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          fill: true,
          tension: 0.3,
          borderWidth: 2
        }},
        {{
          label: 'Daily Active Users (DAU)',
          data: {json.dumps([r["cnt"] for r in dau_14d])},
          borderColor: '#3b82f6',
          backgroundColor: 'transparent',
          borderDash: [5, 5],
          tension: 0.3,
          borderWidth: 2
        }}
      ]
    }},
    options: {{
      responsive: true,
      scales: {{
        y: {{ grid: {{ color: '#1e1b30' }}, ticks: {{ color: '#8b8fa3' }} }},
        x: {{ grid: {{ display: false }}, ticks: {{ color: '#8b8fa3' }} }}
      }},
      plugins: {{ legend: {{ labels: {{ color: '#f3f4f6' }} }} }}
    }}
  }});
 
  const ctxVolume = document.getElementById('volumeChart').getContext('2d');
  new Chart(ctxVolume, {{
    type: 'bar',
    data: {{
      labels: {json.dumps(telem_labels)},
      datasets: [
        {{
          label: 'Telemetry Events',
          data: {json.dumps(telem_data)},
          backgroundColor: '#3b82f6',
          borderRadius: 4
        }},
        {{
          label: 'Resumes Saved',
          data: {json.dumps(res_data)},
          backgroundColor: '#10b981',
          borderRadius: 4
        }}
      ]
    }},
    options: {{
      responsive: true,
      scales: {{
        y: {{ grid: {{ color: '#1e1b30' }}, ticks: {{ color: '#8b8fa3' }} }},
        x: {{ grid: {{ display: false }}, ticks: {{ color: '#8b8fa3' }} }}
      }},
      plugins: {{ legend: {{ labels: {{ color: '#f3f4f6' }} }} }}
    }}
  }});
</script>
</body>
</html>"""
    return html


# Helper escaping functions for safety and JS interpolation
def html_escape(val):
    if val is None:
        return ""
    import html as html_mod
    return html_mod.escape(str(val))


def html_escape_js(val):
    if val is None:
        return ""
    return str(val).replace("\\", "\\\\").replace("`", "\\`").replace("'", "\\'").replace('"', '\\"')



# Routes
@app.route("/api/salary-estimate", methods=["POST"])
def api_salary_estimate():
    data = request.get_json(force=True) or {}
    jobs = data.get("jobs", [])

    if not jobs:
        return jsonify({"results": []}), 200

    results = []
    jobs_to_estimate = []
    
    seven_days_ago = (datetime.datetime.utcnow() - datetime.timedelta(days=7)).isoformat()

    try:
        with get_db() as db:
            for job in jobs:
                pos = (job.get("position") or "").strip()
                company = (job.get("company") or "").strip()
                loc = (job.get("location") or "").strip()
                job_url = (job.get("jobUrl") or "").strip()

                if not pos or not company:
                    continue

                job_key = f"{company.lower()}|{loc.lower()}|{pos.lower()}"
                
                cached = db.execute(
                    "SELECT * FROM salary_cache WHERE job_key = ? AND last_updated > ?",
                    (job_key, seven_days_ago)
                ).fetchone()

                if cached and cached["tc"] and cached["tc"] != "N/A" and cached["tc"] != "None":
                    results.append({
                        "jobUrl": job_url,
                        "totalCompensation": cached["tc"],
                        "baseSalary": cached["base"],
                        "bonus": cached["bonus"],
                        "stockOptions": cached["stock"],
                        "confidence": cached["confidence"],
                        "currency": cached["currency"]
                    })
                else:
                    jobs_to_estimate.append(job)
    except Exception as e:
        print(f"[SALARY CACHE READ ERROR] {e}")
        jobs_to_estimate = jobs

    if jobs_to_estimate:
        jobs_text = "\n\n".join([
            f"{i + 1}. Position: {job.get('position')}\n   Company: {job.get('company')}\n   Location: {job.get('location')}\n   JobURL: {job.get('jobUrl')}"
            for i, job in enumerate(jobs_to_estimate)
        ])
        
        prompt = f"""Analyze the following {len(jobs_to_estimate)} job positions and estimate their annual salary ranges based on the local market.
Jobs to Analyze:
{jobs_text}

Output Requirements:
- Use local currency based on job location (₹ for India, $ for US, etc.)
- Format amounts in local units (e.g., "25L-30L" for Indian Lakhs, "120k-150k" for US thousands)
- Maintain the exact JSON schema below. Output ONLY valid JSON starting with {{ and ending with }}.

JSON Schema:
{{
  "results": [
    {{
      "index": 1, // 1-based index of the job in the list above
      "totalCompensation": "string",
      "baseSalary": "string", 
      "bonus": "string",
      "stockOptions": "string",
      "confidence": "High|Medium|Low",
      "currency": "string"
    }}
  ]
}}"""
        
        try:
            parsed, model_used = call_with_fallback_salary(
                messages=[{"role": "user", "content": prompt}],
                max_tokens=2048,
                temperature=0.3,
                response_format={"type": "json_object"}
            )
            
            if isinstance(parsed, list):
                ai_results = parsed
            elif isinstance(parsed, dict):
                ai_results = parsed.get("results") or parsed.get("salaries") or parsed.get("estimates") or list(parsed.values())[0] if parsed.values() else []
                if not isinstance(ai_results, list):
                    ai_results = [parsed]
            else:
                ai_results = []
            
            if not ai_results:
                return jsonify({"error": "AI returned empty results"}), 500
            
            try:
                with get_db() as db:
                    for ai_res in ai_results:
                        matched_job = None
                        idx_val = ai_res.get("index")
                        if idx_val is not None:
                            try:
                                job_idx = int(idx_val) - 1
                                if 0 <= job_idx < len(jobs_to_estimate):
                                    matched_job = jobs_to_estimate[job_idx]
                            except (ValueError, TypeError):
                                pass
                        
                        if not matched_job:
                            cur_job_url = ai_res.get("jobUrl", "")
                            matched_job = next((j for j in jobs_to_estimate if j.get("jobUrl") == cur_job_url), None)
                            
                        if not matched_job:
                            pos_val = (ai_res.get("position") or "").strip().lower()
                            comp_val = (ai_res.get("company") or "").strip().lower()
                            matched_job = next((j for j in jobs_to_estimate if j.get("position", "").strip().lower() == pos_val and j.get("company", "").strip().lower() == comp_val), None)

                        if not matched_job:
                            continue

                        ai_res["jobUrl"] = matched_job.get("jobUrl", "")

                        tc_val = ai_res.get("totalCompensation")
                        if tc_val and tc_val != "N/A" and tc_val != "None":
                            pos = (matched_job.get("position") or "").strip()
                            company = (matched_job.get("company") or "").strip()
                            loc = (matched_job.get("location") or "").strip()
                            job_key = f"{company.lower()}|{loc.lower()}|{pos.lower()}"

                            db.execute("""
                                INSERT INTO salary_cache (job_key, job_title, company, location, tc, base, bonus, stock, confidence, currency, last_updated)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                ON CONFLICT(job_key) DO UPDATE SET
                                    tc = excluded.tc,
                                    base = excluded.base,
                                    bonus = excluded.bonus,
                                    stock = excluded.stock,
                                    confidence = excluded.confidence,
                                    currency = excluded.currency,
                                    last_updated = excluded.last_updated
                            """, (
                                job_key, pos, company, loc,
                                tc_val, ai_res.get("baseSalary"),
                                ai_res.get("bonus"), ai_res.get("stockOptions"),
                                ai_res.get("confidence"), ai_res.get("currency"),
                                datetime.datetime.utcnow().isoformat()
                            ))
                    db.commit()
            except Exception as cache_write_err:
                print(f"[SALARY CACHE WRITE ERROR] {cache_write_err}")

            for ai_res in ai_results:
                if ai_res.get("jobUrl"):
                    results.append({
                        "jobUrl": ai_res.get("jobUrl"),
                        "totalCompensation": ai_res.get("totalCompensation"),
                        "baseSalary": ai_res.get("baseSalary"),
                        "bonus": ai_res.get("bonus"),
                        "stockOptions": ai_res.get("stockOptions"),
                        "confidence": ai_res.get("confidence"),
                        "currency": ai_res.get("currency")
                    })

            for job in jobs_to_estimate:
                if not any(r.get("jobUrl") == job.get("jobUrl") for r in results):
                    results.append({
                        "jobUrl": job.get("jobUrl"),
                        "error": "Estimation failed"
                    })

        except Exception as ai_err:
            print(f"[SALARY AI FALLBACK ERROR] {ai_err}")
            return jsonify({"error": f"AI estimation failed: {str(ai_err)}"}), 500

    return jsonify({"results": results}), 200


@app.route("/api/salary-estimate/report", methods=["POST"])
def api_salary_estimate_report():
    data = request.get_json(force=True) or {}
    reports = data.get("reports", [])
    if not reports:
        return jsonify({"success": False, "message": "No reports provided"}), 400

    try:
        with get_db() as db:
            for rep in reports:
                pos = (rep.get("position") or "").strip()
                company = (rep.get("company") or "").strip()
                loc = (rep.get("location") or "").strip()
                tc_val = rep.get("totalCompensation")
                
                if not pos or not company or not tc_val or tc_val == "N/A" or tc_val == "None":
                    continue

                job_key = f"{company.lower()}|{loc.lower()}|{pos.lower()}"
                db.execute("""
                    INSERT INTO salary_cache (job_key, job_title, company, location, tc, base, bonus, stock, confidence, currency, last_updated)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(job_key) DO UPDATE SET
                        tc = excluded.tc,
                        base = excluded.base,
                        bonus = excluded.bonus,
                        stock = excluded.stock,
                        confidence = excluded.confidence,
                        currency = excluded.currency,
                        last_updated = excluded.last_updated
                """, (
                    job_key, pos, company, loc,
                    rep.get("totalCompensation"), rep.get("baseSalary"),
                    rep.get("bonus"), rep.get("stockOptions"),
                    rep.get("confidence"), rep.get("currency"),
                    datetime.datetime.utcnow().isoformat()
                ))
            db.commit()
        return jsonify({"success": True, "message": f"Successfully cached {len(reports)} reports"}), 200
    except Exception as e:
        print(f"[SALARY CACHE REPORT ERROR] {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/get-ai-response", methods=["POST"])
def api_get_ai_response():
    data = request.get_json(force=True) or {}
    prompt = data.get("prompt", "")
    system_instruction = data.get("system_instruction", "")
    response_mime_type = data.get("response_mime_type", "text/plain")
    temperature = data.get("temperature", 0.3)
    user_id = data.get("user_id", "anonymous").strip()

    if not prompt:
        return jsonify({"success": False, "error": "Missing prompt"}), 400

    now_iso = datetime.datetime.utcnow().isoformat()
    today_str = datetime.datetime.utcnow().strftime("%Y-%m-%d")
    user_ip = request.headers.get("X-Real-IP") or request.remote_addr or ""
    country_code, country = get_country_from_ip(user_ip)

    messages = []
    if system_instruction:
        messages.append({"role": "system", "content": system_instruction})
    messages.append({"role": "user", "content": prompt})

    response_format = None
    if response_mime_type == "application/json":
        response_format = {"type": "json_object"}

    try:
        content, model_used = call_with_fallback_ai(
            messages=messages,
            max_tokens=4096,
            temperature=temperature,
            response_format=response_format
        )

        with get_db() as db:
            db.execute(
                """INSERT INTO ai_usage (user_id, date, count) VALUES (?, ?, 1)
                   ON CONFLICT(user_id, date) DO UPDATE SET count = count + 1""",
                (user_id, today_str)
            )
            db.execute(
                """INSERT INTO ai_conversations 
                   (user_id, timestamp, operation, model_used, prompt_tokens, completion_tokens, status, country_code, country)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (user_id, now_iso, "ai_response", model_used, len(prompt)//4, len(content)//4, "success", country_code, country)
            )
            db.commit()

        return jsonify({
            "success": True,
            "content": content,
            "model_used": model_used
        }), 200

    except Exception as e:
        print(f"[BACKEND AI RESPONSE ERROR] {e}")
        with get_db() as db:
            db.execute(
                """INSERT INTO ai_conversations 
                   (user_id, timestamp, operation, model_used, prompt_tokens, completion_tokens, status, country_code, country)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (user_id, now_iso, "ai_response", "failed", 0, 0, "failed", country_code, country)
            )
            db.commit()
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/ai-quota", methods=["GET"])
def api_ai_quota():
    try:
        quotas = oracle_ai.get_ai_quotas(GEMINI_API_KEYS)
        return jsonify(quotas), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "resumehub-api"}), 200


@app.route("/", methods=["GET"])
def root():
    return jsonify({"status": "running", "service": "resumehub-api"}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5060, debug=False)
