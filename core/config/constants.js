/**
 * Application Constants
 * Centralized constants for ResumeHub - single source of truth for all magic numbers
 */

export const CACHE = {
  // Cache TTL values (in milliseconds)
  JOB_DESCRIPTION_TTL: 5 * 60 * 1000,        // 5 minutes
  RESUME_PARSE_TTL: 5 * 60 * 1000,           // 5 minutes
  CLEANUP_INTERVAL: 10 * 60 * 1000,          // 10 minutes
  OPTIMIZED_RESUME_TTL: 24 * 60 * 60 * 1000, // 24 hours
  SALARY_CACHE_TTL: 24 * 60 * 60 * 1000,     // 24 hours
  INSIGHTS_CACHE_TTL: 60 * 60 * 1000,        // 1 hour
};

export const TEXT_LIMITS = {
  PAGE_TEXT_MAX: 50000,                       // Max page text length
  PAGE_TEXT_MIN: 100,                        // Min page text for processing
  JOB_DESCRIPTION_MIN: 50,                    // Min JD length
  JOB_DESCRIPTION_MIN_STRICT: 100,           // Min JD length (strict)
  JOB_DESCRIPTION_MIN_AI: 200,               // Min JD length for AI mode
  RESUME_WORD_MAX: 550,                       // Max resume word count
  RESUME_CHAR_MAX: 3400,                      // Max resume character count
  RESUME_CHAR_MIN: 3000,                      // Min resume character count
  PROMPT_ENHANCE_PREVIEW: 2000,               // Preview length for enhancement
};

export const RATE_LIMITS = {
  REQUESTS_PER_MINUTE: 10,                    // Max requests per minute
  CONCURRENT_REQUESTS: 3,                     // Max concurrent requests
  BATCH_DELAY: 500,                           // Delay between batches (ms)
  WINDOW_MS: 10000,                           // Rate limit window (10 seconds)
  MAX_RETRIES: 3,                             // Max retry attempts
};

export const STORAGE = {
  MAX_RECENT_JOBS: 25,                        // Max recent jobs to store
  MAX_RESUME_SIZE: 10 * 1024 * 1024,         // 10MB max file size
  MAX_CACHE_AGE: 24 * 60 * 60 * 1000,        // 24 hours
};

export const UI = {
  DEBOUNCE_DELAY: 250,                        // Debounce delay (ms)
  DRAG_THRESHOLD: 4,                          // Drag threshold (px)
  DRAG_RESET_DELAY: 150,                      // Drag reset delay (ms)
  ANIMATION_DURATION: 300,                    // Animation duration (ms)
  Z_INDEX_MAX: 2147483646,                   // Max z-index for sidebar
  SIDEBAR_HEIGHT_EXPANDED: '100vh',           // Expanded sidebar height
  SIDEBAR_HEIGHT_COLLAPSED: '30vh',           // Collapsed sidebar height
};

export const API = {
  DEFAULT_TEMPERATURE: 0.3,                   // Default AI temperature
  DEFAULT_MAX_TOKENS: 8192,                  // Default max output tokens
  ENHANCE_MAX_TOKENS: 500,                    // Max tokens for enhancement
  BATCH_MAX_TOKENS: 100,                     // Max tokens for batch operations
  TIMEOUT: 30000,                             // API timeout (ms)
  MAX_PAGE_TEXT_LENGTH: 10000,                // Max page text for API calls
};

export const VALIDATION = {
  MIN_JD_LENGTH: 200,                         // Minimum JD length for validation
  MIN_PAGE_TEXT: 100,                         // Minimum page text length
  MIN_JOB_DESCRIPTION: 50,                    // Minimum job description length
  MAX_FILE_SIZE: 10 * 1024 * 1024,           // 10MB
};

export const SALARY = {
  CONVERSION: {
    LAKH: 100000,                             // 1 Lakh = 100,000
    THOUSAND: 1000,                           // 1 Thousand = 1,000
    MILLION: 1000000,                         // 1 Million = 1,000,000
    CRORE: 10000000,                          // 1 Crore = 10,000,000
  },
};

export const RESUME = {
  SKILLS: {
    MAX_CATEGORIES: 5,                        // Max skill categories
    MIN_ITEMS_PER_CATEGORY: 3,               // Min items per category
    MAX_ITEMS_PER_CATEGORY: 6,               // Max items per category
  },
  FORMATS: {
    UPLOAD: ['.pdf', '.doc', '.docx', '.txt'],
    DOWNLOAD: ['txt', 'pdf', 'docx'],
  },
};

export const TIMING = {
  DEBOUNCE: 250,                              // Standard debounce (ms)
  THROTTLE: 100,                              // Standard throttle (ms)
  CLEANUP_INTERVAL: 10 * 60 * 1000,          // Cleanup interval (ms)
  RETRY_DELAY: 1000,                          // Retry delay (ms)
  ANIMATION: 300,                             // Animation duration (ms)
};

// Export all constants as a single object for convenience
export const CONSTANTS = {
  CACHE,
  TEXT_LIMITS,
  RATE_LIMITS,
  STORAGE,
  UI,
  API,
  VALIDATION,
  SALARY,
  RESUME,
  TIMING,
};

