/**
 * Application Constants
 * Backend proxy settings for ResumeHub.
 *
 * Leave API_SECRET empty while the server runs with FREE_MODE=true (default).
 * When the server sets FREE_MODE=false, set API_SECRET to the same value as
 * RESUMEHUB_API_SECRET on the server. Empty secret remains fully backward compatible.
 */
export const BACKEND = {
  BASE_URL: 'https://resumehub.duckdns.org',
  API_SECRET: '',
};
