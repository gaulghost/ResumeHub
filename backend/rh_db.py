"""
SQLite helpers for ResumeHub API.

Kept separate from the Flask route module so resumehub_api.py can stay focused
on HTTP handlers / AI orchestration. Model fallback chains remain in resumehub_api.py.
"""

from __future__ import annotations

import os
import sqlite3

DB_PATH = os.environ.get("DB_PATH", "resumehub.db")


def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA busy_timeout=30000")
    except Exception:
        pass
    return conn


def ensure_indexes(db):
    db.execute("CREATE INDEX IF NOT EXISTS idx_telemetry_ts ON telemetry(timestamp)")
    db.execute("CREATE INDEX IF NOT EXISTS idx_telemetry_type_ts ON telemetry(event_type, timestamp)")
    db.execute("CREATE INDEX IF NOT EXISTS idx_salary_updated ON salary_cache(last_updated)")
    db.execute("CREATE INDEX IF NOT EXISTS idx_resumes_hash ON resumes(hash)")
