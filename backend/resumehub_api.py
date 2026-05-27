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

# Rate limiting states
_model_exhausted: dict = {}
_gemini_key_exhausted: dict = {}
_gemini_key_calls: dict = {}


class RateLimitError(Exception):
    pass


def _is_exhausted(model_id: str) -> bool:
    return _model_exhausted.get(model_id) == datetime.datetime.utcnow().strftime("%Y-%m-%d")


def _mark_exhausted(model_id: str):
    today = datetime.datetime.utcnow().strftime("%Y-%m-%d")
    _model_exhausted[model_id] = today
    print(f"[MODEL] {model_id} exhausted for {today}")


def _is_gemini_key_exhausted(key: str) -> bool:
    return _gemini_key_exhausted.get(key) == datetime.datetime.utcnow().strftime("%Y-%m-%d")


def _mark_gemini_key_exhausted(key: str):
    today = datetime.datetime.utcnow().strftime("%Y-%m-%d")
    _gemini_key_exhausted[key] = today
    print(f"[MODEL] Gemini API Key ending in ...{key[-6:] if len(key) > 6 else key} exhausted for {today}")


def _can_use_gemini_key(key: str, model_id: str) -> bool:
    if _is_gemini_key_exhausted(key):
        return False
        
    now = datetime.datetime.utcnow()
    calls = _gemini_key_calls.setdefault(key, [])
    
    # Clean up calls older than 24 hours
    one_day_ago = now - datetime.timedelta(days=1)
    calls = [t for t in calls if t > one_day_ago]
    _gemini_key_calls[key] = calls
    
    # Configure limits based on model type (Lite vs. Flash/Preview)
    if "lite" in model_id:
        daily_limit = 500
        rpm_limit = 15
    else:
        daily_limit = 20
        rpm_limit = 5
        
    if len(calls) >= daily_limit:
        _mark_gemini_key_exhausted(key)
        return False
        
    one_minute_ago = now - datetime.timedelta(minutes=1)
    recent_calls = [t for t in calls if t > one_minute_ago]
    if len(recent_calls) >= rpm_limit:
        print(f"[MODEL] Gemini API Key rate-limited for this minute ({rpm_limit} RPM for {model_id})")
        return False
        
    return True


def _record_gemini_key_call(key: str):
    now = datetime.datetime.utcnow()
    _gemini_key_calls.setdefault(key, []).append(now)


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
        raise RateLimitError(f"{model_cfg['id']} rate limited")
    resp.raise_for_status()
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
            if not _can_use_gemini_key(key, model_cfg["id"]):
                continue
        else:
            if _is_exhausted(model_cfg["id"]):
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
                _record_gemini_key_call(GEMINI_API_KEYS[model_cfg.get("key_index", 0)])
            return parsed, model_cfg["id"]
        except RateLimitError:
            if model_cfg["provider"] == "gemini":
                _mark_gemini_key_exhausted(GEMINI_API_KEYS[model_cfg.get("key_index", 0)])
            else:
                _mark_exhausted(model_cfg["id"])
            continue
        except Exception as e:
            print(f"[SALARY MODEL ERROR] {model_cfg['id']} failed during execution or JSON parse: {e}")
            continue
    raise Exception("All salary AI models exhausted for today.")


def clean_json_response(text: str) -> str:
    text = text.strip()
    first_brace = text.find('{')
    last_brace = text.rfind('}')
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        return text[first_brace:last_brace + 1]
    return text


# SQLite Cache Helpers
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
        db.commit()


init_db()


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


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "resumehub-api"}), 200


@app.route("/", methods=["GET"])
def root():
    return jsonify({"status": "running", "service": "resumehub-api"}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5060, debug=False)
