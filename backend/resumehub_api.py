"""
ResumeHub — Oracle AI Proxy Backend
Flask + SQLite

Endpoints:
  POST /api/salary-estimate          — Checks database cache, estimates misses via AI fallback chain
  POST /api/salary-estimate/report   — Caches client-estimated salary ranges in SQLite
  POST /api/telemetry                — Logs anonymous engagement / usage events
  POST /api/resume                   — Saves and optionally parses a user resume
  POST /api/get-ai-response          — Proxies AI rewrite / generation requests
  GET  /api/ai-quota                 — Returns current AI quota status
  GET  /admin                        — Analytics dashboard (requires ADMIN_SECRET)
  GET  /health                       — Health check
  GET  /                             — Root / service info
"""

import os
import json
import re
import datetime
from contextlib import contextmanager
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 15 * 1024 * 1024  # 15 MB

# CORS: Allow all origins for the extension requests
CORS(app, resources={r"/api/*": {"origins": "*"},
                     r"/health": {"origins": "*"}})

# Config
GROQ_API_KEY_1    = os.environ.get("GROQ_API_KEY_1", "")
GROQ_API_KEY_2    = os.environ.get("GROQ_API_KEY_2", "")
GEMINI_API_KEY_3  = os.environ.get("GEMINI_API_KEY_3", "")
GEMINI_API_KEY_4  = os.environ.get("GEMINI_API_KEY_4", "")

EGRESS_IP_1       = os.environ.get("EGRESS_IP_1", "")
EGRESS_IP_2       = os.environ.get("EGRESS_IP_2", "")

ADMIN_SECRET      = os.environ.get("ADMIN_SECRET", "")
# FREE_MODE / rate-limit / optional API auth live in rh_security (imported below).
# Keep local aliases for admin dashboard display compatibility.
from rh_security import (  # noqa: E402
    FREE_MODE,
    guard_api_request,
)
from rh_db import get_db, ensure_indexes  # noqa: E402
MAX_JOBS_PER_BATCH = int(os.environ.get("MAX_JOBS_PER_BATCH", "20"))

# ── Multi-IP Requests Adapter ──────────────────────────────────────────────
from requests.adapters import HTTPAdapter
class SourceIPAdapter(HTTPAdapter):
    def __init__(self, source_ip, **kwargs):
        self.source_ip = source_ip
        super().__init__(**kwargs)

    def init_poolmanager(self, connections, maxsize, block=False, **pool_connections):
        pool_connections['source_address'] = (self.source_ip, 0)
        return super().init_poolmanager(connections, maxsize, block, **pool_connections)

session_ip1 = requests.Session()
if EGRESS_IP_1:
    adapter = SourceIPAdapter(EGRESS_IP_1)
    session_ip1.mount("https://", adapter)
    session_ip1.mount("http://", adapter)

session_ip2 = requests.Session()
if EGRESS_IP_2:
    adapter = SourceIPAdapter(EGRESS_IP_2)
    session_ip2.mount("https://", adapter)
    session_ip2.mount("http://", adapter)

# ── AI Model fallback chains ───────────────────────────────────────────────
PARSE_MODELS = [
    {"id": "gemini-flash-latest",      "provider": "gemini", "use_key": 3, "session": session_ip1},
    {"id": "gemini-flash-latest",      "provider": "gemini", "use_key": 4, "session": session_ip2},
    {"id": "gemini-3-flash-preview",    "provider": "gemini", "use_key": 3, "session": session_ip1},
    {"id": "gemini-3-flash-preview",    "provider": "gemini", "use_key": 4, "session": session_ip2},
    {"id": "gemini-flash-lite-latest",  "provider": "gemini", "use_key": 3, "session": session_ip1},
    {"id": "gemini-flash-lite-latest",  "provider": "gemini", "use_key": 4, "session": session_ip2},
    {"id": "gemini-2.5-flash",          "provider": "gemini", "use_key": 3, "session": session_ip1},
    {"id": "gemini-2.5-flash",          "provider": "gemini", "use_key": 4, "session": session_ip2},
    {"id": "gemini-2.5-flash-lite",     "provider": "gemini", "use_key": 3, "session": session_ip1},
    {"id": "gemini-2.5-flash-lite",     "provider": "gemini", "use_key": 4, "session": session_ip2},
]

REWRITE_MODELS = [
    {"id": "openai/gpt-oss-120b",             "provider": "groq",   "use_key": 2, "session": session_ip2},
    {"id": "gemma-4-31b-it",                   "provider": "gemini", "use_key": 3, "session": session_ip1},
    {"id": "gemma-4-31b-it",                   "provider": "gemini", "use_key": 4, "session": session_ip2},
]

SALARY_MODELS = [
    {"id": "groq/compound",            "provider": "groq", "use_key": 1, "session": session_ip1},
    {"id": "groq/compound",            "provider": "groq", "use_key": 2, "session": session_ip2},
    {"id": "groq/compound-mini",       "provider": "groq", "use_key": 1, "session": session_ip1},
    {"id": "groq/compound-mini",       "provider": "groq", "use_key": 2, "session": session_ip2},
    {"id": "openai/gpt-oss-120b",      "provider": "groq", "use_key": 2, "session": session_ip2},
    {"id": "llama-3.3-70b-versatile",   "provider": "groq", "use_key": 1, "session": session_ip1},
]

import sys
sys.path.append("/home/ubuntu/oracle_common")
try:
    import oracle_ai
except ImportError:
    print("[WARN] oracle_ai not found — using minimal stub (AI exhaustion/quota tracking disabled)")

    class _OracleAIStub:
        class RateLimitError(Exception):
            def __init__(self, message, retry_after=60, reason=None):
                super().__init__(message)
                self.retry_after = retry_after
                self.reason = reason

        @staticmethod
        def mark_model_exhausted(*args, **kwargs):
            pass

        @staticmethod
        def mark_gemini_key_exhausted(*args, **kwargs):
            pass

        @staticmethod
        def record_gemini_call(*args, **kwargs):
            pass

        @staticmethod
        def is_model_exhausted(*args, **kwargs):
            return False

        @staticmethod
        def is_gemini_key_exhausted(*args, **kwargs):
            return False

        @staticmethod
        def can_use_gemini_key(*args, **kwargs):
            return True

        @staticmethod
        def update_groq_limits(*args, **kwargs):
            pass

        @staticmethod
        def init_shared_db():
            pass

        @staticmethod
        @contextmanager
        def get_shared_db():
            class _DummyCursor:
                def fetchall(self):
                    return []
                def fetchone(self):
                    return None
            class _DummyDB:
                def execute(self, *args, **kwargs):
                    return _DummyCursor()
            yield _DummyDB()

        @staticmethod
        def get_ai_quotas(*args, **kwargs):
            return {}

    oracle_ai = _OracleAIStub()


def _exhaustion_key(model_cfg: dict) -> str:
    """Return a per-key compound exhaustion ID so that key-1 and key-2
    of the same model are tracked independently in the DB."""
    return f"{model_cfg['id']}::key{model_cfg.get('use_key', 1)}"


def call_model(model_cfg: dict, messages: list, max_tokens: int, temperature: float, response_format: dict = None) -> str:
    """Single model call. Raises RateLimitError on 429, Exception on other failures."""
    use_key = model_cfg.get("use_key", 1)
    session = model_cfg.get("session")

    if model_cfg["provider"] == "groq":
        key = GROQ_API_KEY_1 if use_key == 1 else GROQ_API_KEY_2
        if not key:
            raise Exception(f"Groq API key ({use_key}) not configured")
        url  = "https://api.groq.com/openai/v1/chat/completions"
        auth = f"Bearer {key}"
    elif model_cfg["provider"] == "gemini":
        key = GEMINI_API_KEY_3 if use_key == 3 else GEMINI_API_KEY_4
        if not key:
            raise Exception(f"Gemini API key ({use_key}) not configured")
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

    post_fn = session.post if session is not None else requests.post
    resp = post_fn(
        url,
        headers={"Authorization": auth, "Content-Type": "application/json"},
        json=json_payload,
        timeout=60,
    )
    if resp.status_code == 429:
        retry_after = 60
        reason = "RPM"
        try:
            err_data = resp.json()
            err_msg = err_data.get("error", {}).get("message", "")
            err_msg_lower = err_msg.lower()
            if "tokens per minute" in err_msg_lower or "tpm" in err_msg_lower:
                reason = "TPM"
            elif "tokens per day" in err_msg_lower or "tpd" in err_msg_lower:
                reason = "TPD"
            elif "requests per day" in err_msg_lower or "rpd" in err_msg_lower:
                reason = "RPD"
            elif "requests per minute" in err_msg_lower or "rpm" in err_msg_lower:
                reason = "RPM"
            elif "tokens" in err_msg_lower:
                reason = "TPM"
            elif "requests" in err_msg_lower:
                reason = "RPM"

            if ("limit_value" in err_msg and ('"0"' in err_msg or " 0 " in err_msg or ": 0" in err_msg)) or "Request limit per minute for a region" in err_msg or "Generate Content API requests" in err_msg:
                retry_after = 24 * 3600
                if "request" in err_msg_lower:
                    reason = "RPD"
                elif "token" in err_msg_lower:
                    reason = "TPD"
            else:
                val = resp.headers.get("Retry-After")
                if val:
                    retry_after = int(float(val))
        except Exception:
            pass
        raise oracle_ai.RateLimitError(_exhaustion_key(model_cfg) + " rate limited", retry_after=retry_after, reason=reason)

    if model_cfg["provider"] == "gemini" and resp.status_code in [400, 403]:
        raise oracle_ai.RateLimitError(f"{model_cfg['id']} key disabled/forbidden", retry_after=24 * 3600, reason="RPD")

    resp.raise_for_status()

    # Log Groq headers to shared DB
    if model_cfg["provider"] == "groq":
        try:
            key_slot = f"key{model_cfg.get('use_key', 1)}"
            oracle_ai.update_groq_limits(model_cfg["id"], resp.headers, key_slot)
        except Exception as e:
            print(f"[LIMIT LOG ERROR] {e}")

    content = resp.json()["choices"][0]["message"]["content"] or ""
    content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
    content = re.sub(r"<thought>.*?</thought>", "", content, flags=re.DOTALL).strip()
    content = re.sub(r"<think>.*$", "", content, flags=re.DOTALL).strip()
    content = re.sub(r"<thought>.*$", "", content, flags=re.DOTALL).strip()
    return content


def call_with_fallback_salary(messages: list, max_tokens: int = 2048, temperature: float = 0.3, response_format: dict = None):
    for model_cfg in SALARY_MODELS:
        if model_cfg["provider"] == "gemini":
            use_key = model_cfg.get("use_key", 3)
            key = GEMINI_API_KEY_3 if use_key == 3 else GEMINI_API_KEY_4
            if not key or not oracle_ai.can_use_gemini_key(key, model_cfg["id"]):
                continue
        else:
            if oracle_ai.is_model_exhausted(_exhaustion_key(model_cfg)):
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
                oracle_ai.record_gemini_call(key, model_cfg["id"])
            return parsed, model_cfg["id"]
        except oracle_ai.RateLimitError as rle:
            if model_cfg["provider"] == "gemini":
                oracle_ai.mark_gemini_key_exhausted(key, rle.retry_after)
            else:
                oracle_ai.mark_model_exhausted(_exhaustion_key(model_cfg), rle.retry_after)
            continue
        except Exception as e:
            print(f"[SALARY MODEL ERROR] {model_cfg['id']} failed during execution or JSON parse: {e}")
            continue
    raise Exception("All salary AI models exhausted for today.")


def call_with_fallback_ai(messages: list, max_tokens: int = 4096, temperature: float = 0.3, response_format: dict = None):
    for model_cfg in REWRITE_MODELS:
        if model_cfg["provider"] == "gemini":
            use_key = model_cfg.get("use_key", 3)
            key = GEMINI_API_KEY_3 if use_key == 3 else GEMINI_API_KEY_4
            if not key or not oracle_ai.can_use_gemini_key(key, model_cfg["id"]):
                continue
        else:
            if oracle_ai.is_model_exhausted(_exhaustion_key(model_cfg)):
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
                oracle_ai.record_gemini_call(key, model_cfg["id"])
            return answer, model_cfg["id"]
        except oracle_ai.RateLimitError as rle:
            if model_cfg["provider"] == "gemini":
                oracle_ai.mark_gemini_key_exhausted(key, rle.retry_after)
            else:
                oracle_ai.mark_model_exhausted(_exhaustion_key(model_cfg), rle.retry_after)
            continue
        except Exception as e:
            print(f"[AI MODEL ERROR] {model_cfg['id']} failed during execution: {e}")
            continue
    raise Exception("All AI models exhausted for today.")


def clean_json_response(text: str) -> str:
    text = text.strip()
    first_brace = text.find('{')
    first_bracket = text.find('[')
    # Prefer JSON arrays when '[' appears before '{'
    if first_bracket != -1 and (first_brace == -1 or first_bracket < first_brace):
        last_bracket = text.rfind(']')
        if last_bracket != -1 and last_bracket > first_bracket:
            return text[first_bracket:last_bracket + 1]
    last_brace = text.rfind('}')
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        return text[first_brace:last_brace + 1]
    return text


# SQLite helpers live in rh_db.py (get_db imported above)


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
        ensure_indexes(db)
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

def call_gemini_native(model_id: str, key: str, prompt: str, file_content_b64: str = None, mime_type: str = None, session = None) -> str:
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
    post_fn = session.post if session is not None else requests.post
    resp = post_fn(url, headers=headers, json=payload, timeout=45)
    
    if resp.status_code == 429:
        retry_after = 60
        try:
            err_data = resp.json()
            err_msg = err_data.get("error", {}).get("message", "")
            if "Request limit per minute for a region" in err_msg or "Generate Content API requests" in err_msg:
                retry_after = 24 * 3600
        except Exception:
            pass
        raise oracle_ai.RateLimitError(f"Gemini API limit hit on model {model_id}", retry_after=retry_after)
        
    if resp.status_code in [400, 403]:
        raise oracle_ai.RateLimitError(f"Gemini API key disabled on model {model_id}", retry_after=24 * 3600)
        
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
    for model_cfg in PARSE_MODELS:
        if model_cfg["provider"] == "gemini":
            use_key = model_cfg.get("use_key", 3)
            key = GEMINI_API_KEY_3 if use_key == 3 else GEMINI_API_KEY_4
            if not key or not oracle_ai.can_use_gemini_key(key, model_cfg["id"]):
                continue
            try:
                answer = call_gemini_native(model_cfg["id"], key, PARSE_PROMPT, file_content_b64, mime_type, model_cfg.get("session"))
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
    blocked = guard_api_request()
    if blocked is not None:
        return blocked
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
    blocked = guard_api_request()
    if blocked is not None:
        return blocked
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

# Routes
@app.route("/api/salary-estimate", methods=["POST"])
def api_salary_estimate():
    blocked = guard_api_request()
    if blocked is not None:
        return blocked
    data = request.get_json(force=True) or {}
    jobs = data.get("jobs", [])

    if not jobs:
        return jsonify({"results": []}), 200

    if len(jobs) > MAX_JOBS_PER_BATCH:
        return jsonify({
            "error": f"Too many jobs in batch. Maximum is {MAX_JOBS_PER_BATCH}, got {len(jobs)}."
        }), 400

    results = []
    jobs_to_estimate = []
    
    thirty_days_ago = (datetime.datetime.utcnow() - datetime.timedelta(days=30)).isoformat()

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
                    (job_key, thirty_days_ago)
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
                # Soft-fail: keep cache hits, mark misses — avoid hard 500 for the whole batch
                print("[SALARY] AI returned empty results list")
                for job in jobs_to_estimate:
                    job_url = job.get("jobUrl") or ""
                    if not any((r.get("jobUrl") or "") == job_url for r in results):
                        results.append({
                            "jobUrl": job_url,
                            "error": "Estimation failed",
                        })
                return jsonify({
                    "results": results,
                    "warning": "AI returned empty results",
                }), 200
            
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
                if ai_res.get("jobUrl") is not None:
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
                if not any((r.get("jobUrl") or "") == (job.get("jobUrl") or "") for r in results):
                    results.append({
                        "jobUrl": job.get("jobUrl"),
                        "error": "Estimation failed"
                    })

        except Exception as ai_err:
            print(f"[SALARY AI FALLBACK ERROR] {ai_err}")
            # Keep any SQLite cache hits already in `results`, and mark the rest failed.
            # Returning 500 here used to discard cache hits and force the extension into "Server Error".
            for job in jobs_to_estimate:
                job_url = job.get("jobUrl") or ""
                if not any((r.get("jobUrl") or "") == job_url for r in results):
                    results.append({
                        "jobUrl": job_url,
                        "error": "Estimation failed",
                    })
            if results:
                return jsonify({
                    "results": results,
                    "warning": f"AI estimation failed: {str(ai_err)}",
                }), 200
            return jsonify({"error": f"AI estimation failed: {str(ai_err)}"}), 503

    return jsonify({"results": results}), 200


@app.route("/api/salary-estimate/report", methods=["POST"])
def api_salary_estimate_report():
    blocked = guard_api_request()
    if blocked is not None:
        return blocked
    data = request.get_json(force=True) or {}
    reports = data.get("reports", [])
    if not reports:
        return jsonify({"success": False, "message": "No reports provided"}), 400

    try:
        cached_count = 0
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
                cached_count += 1
            db.commit()
        return jsonify({"success": True, "message": f"Successfully cached {cached_count} reports"}), 200
    except Exception as e:
        print(f"[SALARY CACHE REPORT ERROR] {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/get-ai-response", methods=["POST"])
def api_get_ai_response():
    blocked = guard_api_request()
    if blocked is not None:
        return blocked
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
        quotas = oracle_ai.get_ai_quotas([GEMINI_API_KEY_3, GEMINI_API_KEY_4])
        return jsonify(quotas), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "resumehub-api"}), 200


@app.route("/", methods=["GET"])
def root():
    return jsonify({"status": "running", "service": "resumehub-api"}), 200


from rh_admin import register_admin_routes
register_admin_routes(
    app,
    get_db=get_db,
    ADMIN_SECRET=ADMIN_SECRET,
    FREE_MODE=FREE_MODE,
    PARSE_MODELS=PARSE_MODELS,
    SALARY_MODELS=SALARY_MODELS,
    REWRITE_MODELS=REWRITE_MODELS,
    oracle_ai=oracle_ai,
)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5060, debug=False)

