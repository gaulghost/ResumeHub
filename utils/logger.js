/**
 * Logging Utility
 * Centralized logging with levels, timestamps, and context
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4,
};

const LOG_LEVEL_NAMES = {
  [LOG_LEVELS.DEBUG]: 'DEBUG',
  [LOG_LEVELS.INFO]: 'INFO',
  [LOG_LEVELS.WARN]: 'WARN',
  [LOG_LEVELS.ERROR]: 'ERROR',
};

// Default log level (can be overridden)
let currentLogLevel = LOG_LEVELS.INFO;

// Check if we're in development mode
const isDev = typeof chrome !== 'undefined' && 
              chrome.runtime?.getManifest?.()?.key === undefined;

if (isDev) {
  currentLogLevel = LOG_LEVELS.DEBUG;
}

/**
 * Format log message with timestamp and context
 */
function formatMessage(level, context, message, ...args) {
  const timestamp = new Date().toISOString();
  const levelName = LOG_LEVEL_NAMES[level] || 'LOG';
  const contextStr = context ? `[${context}]` : '';
  
  return {
    timestamp,
    level: levelName,
    context: contextStr,
    message,
    args: args.length > 0 ? args : undefined,
  };
}

/**
 * Get console method for log level
 */
function getConsoleMethod(level) {
  switch (level) {
    case LOG_LEVELS.DEBUG:
      return console.debug || console.log;
    case LOG_LEVELS.INFO:
      return console.log;
    case LOG_LEVELS.WARN:
      return console.warn;
    case LOG_LEVELS.ERROR:
      return console.error;
    default:
      return console.log;
  }
}

/**
 * Logger class
 */
export class Logger {
  constructor(context = 'ResumeHub') {
    this.context = context;
  }

  /**
   * Log debug message
   */
  debug(message, ...args) {
    if (currentLogLevel <= LOG_LEVELS.DEBUG) {
      const formatted = formatMessage(LOG_LEVELS.DEBUG, this.context, message, ...args);
      const consoleMethod = getConsoleMethod(LOG_LEVELS.DEBUG);
      consoleMethod(`[${formatted.timestamp}] ${formatted.level} ${formatted.context} ${formatted.message}`, ...(formatted.args || []));
    }
  }

  /**
   * Log info message
   */
  info(message, ...args) {
    if (currentLogLevel <= LOG_LEVELS.INFO) {
      const formatted = formatMessage(LOG_LEVELS.INFO, this.context, message, ...args);
      const consoleMethod = getConsoleMethod(LOG_LEVELS.INFO);
      consoleMethod(`[${formatted.timestamp}] ${formatted.level} ${formatted.context} ${formatted.message}`, ...(formatted.args || []));
    }
  }

  /**
   * Log warning message
   */
  warn(message, ...args) {
    if (currentLogLevel <= LOG_LEVELS.WARN) {
      const formatted = formatMessage(LOG_LEVELS.WARN, this.context, message, ...args);
      const consoleMethod = getConsoleMethod(LOG_LEVELS.WARN);
      consoleMethod(`[${formatted.timestamp}] ${formatted.level} ${formatted.context} ${formatted.message}`, ...(formatted.args || []));
    }
  }

  /**
   * Log error message
   */
  error(message, error = null, ...args) {
    if (currentLogLevel <= LOG_LEVELS.ERROR) {
      const formatted = formatMessage(LOG_LEVELS.ERROR, this.context, message, ...args);
      const consoleMethod = getConsoleMethod(LOG_LEVELS.ERROR);
      
      if (error) {
        consoleMethod(`[${formatted.timestamp}] ${formatted.level} ${formatted.context} ${formatted.message}`, error, ...(formatted.args || []));
      } else {
        consoleMethod(`[${formatted.timestamp}] ${formatted.level} ${formatted.context} ${formatted.message}`, ...(formatted.args || []));
      }
    }
  }

  /**
   * Create child logger with sub-context
   */
  child(subContext) {
    return new Logger(`${this.context}:${subContext}`);
  }
}

/**
 * Create logger instance
 */
export function createLogger(context = 'ResumeHub') {
  return new Logger(context);
}

/**
 * Set global log level
 */
export function setLogLevel(level) {
  if (typeof level === 'string') {
    const upperLevel = level.toUpperCase();
    currentLogLevel = LOG_LEVELS[upperLevel] ?? LOG_LEVELS.INFO;
  } else {
    currentLogLevel = level;
  }
}

/**
 * Get current log level
 */
export function getLogLevel() {
  return currentLogLevel;
}

/**
 * Export log levels for external use
 */
export { LOG_LEVELS };

// Default logger instance
export const logger = createLogger('ResumeHub');

