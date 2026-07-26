"""
ResumeHub API security helpers (rate limiting + optional auth).

Backward compatible:
  - FREE_MODE=true (default): no API key required; rate limits still apply.
  - FREE_MODE=false: require header X-ResumeHub-Key == RESUMEHUB_API_SECRET.
"""

from __future__ import annotations

import os
import time
from collections import defaultdict

from flask import jsonify, request

FREE_MODE = os.environ.get("FREE_MODE", "true").lower() == "true"
RESUMEHUB_API_SECRET = os.environ.get("RESUMEHUB_API_SECRET", "")
RATE_LIMIT_PER_MINUTE = int(os.environ.get("RATE_LIMIT_PER_MINUTE", "60"))
# Stricter default when auth is required
LOCKED_RATE_LIMIT_PER_MINUTE = int(os.environ.get("LOCKED_RATE_LIMIT_PER_MINUTE", "30"))

_rate_buckets = defaultdict(list)


def client_ip() -> str:
    return request.headers.get("X-Real-IP") or request.remote_addr or "unknown"


def check_rate_limit(limit=None, window=60) -> bool:
    if limit is None:
        limit = LOCKED_RATE_LIMIT_PER_MINUTE if not FREE_MODE else RATE_LIMIT_PER_MINUTE
    ip = client_ip()
    now = time.time()
    bucket = [t for t in _rate_buckets[ip] if now - t < window]
    if len(bucket) >= limit:
        _rate_buckets[ip] = bucket
        return False
    bucket.append(now)
    _rate_buckets[ip] = bucket
    return True


def require_api_auth():
    """
    Returns a Flask (response, status) tuple when the request should be rejected,
    or None when the request may proceed.

    Backward compatible: when FREE_MODE is true, always allows (auth optional).
    """
    if FREE_MODE:
        return None

    if not RESUMEHUB_API_SECRET:
        return jsonify({
            "error": "Server misconfigured: FREE_MODE=false but RESUMEHUB_API_SECRET is unset"
        }), 503

    provided = (
        request.headers.get("X-ResumeHub-Key")
        or request.headers.get("X-API-Key")
        or ""
    ).strip()

    if provided != RESUMEHUB_API_SECRET:
        return jsonify({"error": "Unauthorized"}), 401

    return None


def guard_api_request():
    """
    Combined auth + rate-limit gate for /api/* handlers.
    Returns (response, status) on failure, else None.
    """
    denied = require_api_auth()
    if denied is not None:
        return denied
    if not check_rate_limit():
        return jsonify({"error": "Rate limit exceeded"}), 429
    return None
