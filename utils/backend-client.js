/**
 * Shared helpers for ResumeHub backend HTTP calls from the extension.
 */
import { BACKEND } from '../core/config/constants.js';

export function getBackendBase() {
  return BACKEND.BASE_URL || 'https://resumehub.duckdns.org';
}

/**
 * Build headers for backend API calls.
 * When BACKEND.API_SECRET is empty (default), no auth header is sent —
 * compatible with FREE_MODE=true servers.
 */
export function getBackendHeaders(extra = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...extra,
  };
  const secret = (BACKEND.API_SECRET || '').trim();
  if (secret) {
    headers['X-ResumeHub-Key'] = secret;
  }
  return headers;
}
