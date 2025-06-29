/**
 * Unified Error Handler for ResumeHub
 * Combines comprehensive error management with user-friendly messaging
 */
class UnifiedErrorHandler {
  
  /**
   * Create structured error with context
   */
  static createError(message, code, context = {}) {
    const error = new Error(message);
    error.code = code;
    error.context = context;
    error.timestamp = new Date().toISOString();
    error.id = this.generateErrorId();
    return error;
  }

  /**
   * Generate unique error ID for tracking
   */
  static generateErrorId() {
    return 'err_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
  }

  /**
   * Classify error based on message and context
   */
  static classifyError(error) {
    const message = error.message.toLowerCase();
    
    // API-related errors
    if (message.includes('429') || message.includes('rate limit') || message.includes('too many requests')) return 'RATE_LIMITED';
    if (message.includes('quota') || message.includes('limit exceeded')) return 'API_QUOTA_EXCEEDED';
    if (message.includes('api key') || message.includes('unauthorized') || message.includes('invalid key')) return 'INVALID_API_KEY';
    if (message.includes('blocked') || message.includes('content policy') || message.includes('safety')) return 'CONTENT_BLOCKED';
    if (message.includes('403')) return 'API_FORBIDDEN';
    if (message.includes('500') || message.includes('502') || message.includes('503')) return 'API_SERVER_ERROR';
    
    // Network errors
    if (message.includes('network') || message.includes('fetch') || message.includes('connection') || message.includes('timeout')) return 'NETWORK_ERROR';
    
    // Chrome/Extension errors
    if (message.includes('activetab') || message.includes('cannot access')) return 'TAB_ACCESS_ERROR';
    if (message.includes('storage')) return 'STORAGE_ERROR';
    if (message.includes('scripting')) return 'SCRIPT_INJECTION_ERROR';
    if (message.includes('tabs')) return 'TAB_PERMISSION_ERROR';
    if (message.includes('receiving end does not exist')) return 'EXTENSION_COMMUNICATION_ERROR';
    
    // File errors
    if (message.includes('file size') || message.includes('too large')) return 'FILE_TOO_LARGE';
    if (message.includes('type') || message.includes('format')) return 'UNSUPPORTED_FILE_FORMAT';
    if (message.includes('read') || message.includes('parse') || message.includes('corrupted')) return 'FILE_READ_ERROR';
    
    // JSON errors
    if (message.includes('json') || message.includes('unexpected token')) return 'JSON_PARSE_ERROR';
    
    // Job description errors
    if (message.includes('job description') || message.includes('no_job_description_found')) return 'JOB_DESCRIPTION_NOT_FOUND';
    
    return 'UNKNOWN_ERROR';
  }

  /**
   * Get user-friendly error information
   */
  static getUserFriendlyError(error, context = {}) {
    const errorType = this.classifyError(error);
    
    const errorMap = {
      'RATE_LIMITED': {
        title: 'Too Many Requests',
        message: 'You\'re making requests too quickly. Please wait a moment before trying again.',
        action: 'Wait and Retry',
        severity: 'warning',
        retryable: true,
        retryDelay: 5000
      },
      'API_QUOTA_EXCEEDED': {
        title: 'API Limit Reached',
        message: 'You\'ve reached your daily API limit. Try again tomorrow or check your API quota.',
        action: 'Check API Quota',
        actionUrl: 'https://aistudio.google.com/apikey',
        severity: 'error',
        retryable: false
      },
      'INVALID_API_KEY': {
        title: 'API Key Issue',
        message: 'Your API key appears to be invalid or has expired. Please verify your key in settings.',
        action: 'Update API Key',
        severity: 'error',
        retryable: false
      },
      'CONTENT_BLOCKED': {
        title: 'Content Blocked',
        message: 'The AI service blocked this request due to content policies. Try with different content.',
        action: 'Try Different Content',
        severity: 'warning',
        retryable: false
      },
      'API_FORBIDDEN': {
        title: 'API Access Denied',
        message: 'API access forbidden. Please check your API key permissions.',
        action: 'Check API Key',
        severity: 'error',
        retryable: false
      },
      'API_SERVER_ERROR': {
        title: 'Service Unavailable',
        message: 'Google AI service is temporarily unavailable. Please try again in a few minutes.',
        action: 'Retry Later',
        severity: 'warning',
        retryable: true
      },
      'NETWORK_ERROR': {
        title: 'Connection Problem',
        message: 'Unable to connect to AI services. Please check your internet connection.',
        action: 'Check Connection',
        severity: 'warning',
        retryable: true
      },
      'TAB_ACCESS_ERROR': {
        title: 'Page Access Required',
        message: 'Cannot access the current tab. Please refresh the page and try again.',
        action: 'Refresh Page',
        severity: 'error',
        retryable: false
      },
      'STORAGE_ERROR': {
        title: 'Storage Issue',
        message: 'Storage operation failed. Please check extension permissions.',
        action: 'Check Permissions',
        severity: 'error',
        retryable: false
      },
      'SCRIPT_INJECTION_ERROR': {
        title: 'Script Execution Failed',
        message: 'Cannot execute script on this page. Some pages are protected.',
        action: 'Try Different Page',
        severity: 'warning',
        retryable: false
      },
      'TAB_PERMISSION_ERROR': {
        title: 'Tab Permission Required',
        message: 'Cannot access tab information. Please ensure extension has proper permissions.',
        action: 'Check Permissions',
        severity: 'error',
        retryable: false
      },
      'EXTENSION_COMMUNICATION_ERROR': {
        title: 'Extension Communication Failed',
        message: 'Extension communication failed. Please try refreshing the page.',
        action: 'Refresh Page',
        severity: 'warning',
        retryable: true
      },
      'FILE_TOO_LARGE': {
        title: 'File Size Too Large',
        message: 'Your resume file is too large. Please use a file smaller than 10MB.',
        action: 'Choose Smaller File',
        severity: 'error',
        retryable: false
      },
      'UNSUPPORTED_FILE_FORMAT': {
        title: 'Unsupported File Format',
        message: 'Unsupported file format. Please use PDF, DOCX, or TXT files.',
        action: 'Choose Different Format',
        severity: 'error',
        retryable: false
      },
      'FILE_READ_ERROR': {
        title: 'File Read Error',
        message: 'Cannot read file. Please ensure the file is not corrupted.',
        action: 'Choose Different File',
        severity: 'error',
        retryable: false
      },
      'JSON_PARSE_ERROR': {
        title: 'Processing Error',
        message: 'There was an issue processing your resume. This usually resolves itself on retry.',
        action: 'Try Again',
        severity: 'warning',
        retryable: true
      },
      'JOB_DESCRIPTION_NOT_FOUND': {
        title: 'No Job Description Found',
        message: 'We couldn\'t find a job description on this page. Try navigating to a job posting page.',
        action: 'Enter Manually',
        severity: 'info',
        retryable: false
      }
    };

    const userError = errorMap[errorType] || {
      title: 'Something Went Wrong',
      message: 'An unexpected error occurred. Please try again.',
      action: 'Retry',
      severity: 'error',
      retryable: true
    };

    return {
      ...userError,
      originalError: error.message,
      timestamp: Date.now(),
      context,
      errorType,
      id: error.id || this.generateErrorId()
    };
  }

  /**
   * Create clean console error message
   */
  static createCleanErrorMessage(error, context = {}) {
    const errorType = this.classifyError(error);
    const attempt = context.attempt || 1;
    const maxAttempts = context.maxAttempts || 3;
    
    switch (errorType) {
      case 'RATE_LIMITED':
        return `⏳ Rate limit reached, waiting before retry (attempt ${attempt}/${maxAttempts})...`;
      case 'API_QUOTA_EXCEEDED':
        return `❌ API quota exceeded - check your billing or try again tomorrow`;
      case 'INVALID_API_KEY':
        return `❌ Invalid API key - please check your Google API key`;
      case 'NETWORK_ERROR':
        return `❌ Network error - check your internet connection (attempt ${attempt}/${maxAttempts})`;
      case 'CONTENT_BLOCKED':
        return `❌ Content blocked by AI safety filters - try different content`;
      case 'JSON_PARSE_ERROR':
        return `⚠️ JSON parsing error - retrying with different approach (attempt ${attempt}/${maxAttempts})`;
      default:
        return `❌ ${errorType.toLowerCase().replace(/_/g, ' ')} - ${error.message}`;
    }
  }

  /**
   * Safe execution wrapper with comprehensive error handling
   */
  static async safeExecute(operation, errorMessage = 'Operation failed', context = {}) {
    try {
      return await operation();
    } catch (error) {
      const enhancedError = this.createError(errorMessage, 'SAFE_EXECUTE_ERROR', { 
        originalError: error.message,
        ...context 
      });
      
      // Log clean error message
      console.error(this.createCleanErrorMessage(error, context));
      
      throw enhancedError;
    }
  }

  /**
   * Safe API call with specific API error handling
   */
  static async safeAPICall(apiCall, operation, context = {}) {
    try {
      return await apiCall();
    } catch (error) {
      // Create clean error message for console
      const cleanMessage = this.createCleanErrorMessage(error, context);
      console.error(cleanMessage);
      
      // Create user-friendly error
      const userFriendlyError = this.getUserFriendlyError(error, { operation, ...context });
      
      // Throw structured error
      throw this.createError(userFriendlyError.message, 'API_ERROR', { 
        operation,
        errorType: userFriendlyError.errorType,
        originalError: error.message,
        ...context
      });
    }
  }

  /**
   * Safe Chrome operation wrapper
   */
  static async safeChromeOperation(chromeCall, operation, context = {}) {
    try {
      return await chromeCall();
    } catch (error) {
      const userFriendlyError = this.getUserFriendlyError(error, { operation, ...context });
      
      throw this.createError(userFriendlyError.message, 'CHROME_ERROR', { 
        operation,
        errorType: userFriendlyError.errorType,
        originalError: error.message,
        ...context
      });
    }
  }

  /**
   * Safe file operation wrapper
   */
  static async safeFileOperation(fileCall, operation, context = {}) {
    try {
      return await fileCall();
    } catch (error) {
      const userFriendlyError = this.getUserFriendlyError(error, { operation, ...context });
      
      throw this.createError(userFriendlyError.message, 'FILE_ERROR', { 
        operation,
        errorType: userFriendlyError.errorType,
        originalError: error.message,
        ...context
      });
    }
  }

  /**
   * Retry mechanism with exponential backoff and user feedback
   */
  static async withRetry(operation, maxRetries = 3, baseDelay = 1000, progressCallback = null) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (progressCallback) {
          progressCallback({ attempt, maxRetries, status: 'attempting' });
        }
        
        return await operation();
      } catch (error) {
        lastError = error;
        const errorType = this.classifyError(error);
        
        // Log attempt with clean message
        console.warn(this.createCleanErrorMessage(error, { attempt, maxAttempts: maxRetries }));
        
        // Don't retry certain types of errors
        if (this.isNonRetryableError(error)) {
          console.log('Non-retryable error detected, stopping retries');
          if (progressCallback) {
            progressCallback({ attempt, maxRetries, status: 'failed', error: errorType });
          }
          break;
        }
        
        if (attempt < maxRetries) {
          const waitTime = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
          
          if (progressCallback) {
            progressCallback({ attempt, maxRetries, status: 'retrying', waitTime });
          }
          
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await this.delay(waitTime);
        } else {
          if (progressCallback) {
            progressCallback({ attempt, maxRetries, status: 'exhausted', error: errorType });
          }
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Check if error should not be retried
   */
  static isNonRetryableError(error) {
    const nonRetryableTypes = [
      'INVALID_API_KEY',
      'API_QUOTA_EXCEEDED',
      'CONTENT_BLOCKED',
      'API_FORBIDDEN',
      'FILE_TOO_LARGE',
      'UNSUPPORTED_FILE_FORMAT',
      'TAB_ACCESS_ERROR',
      'STORAGE_ERROR',
      'SCRIPT_INJECTION_ERROR',
      'TAB_PERMISSION_ERROR'
    ];
    
    const errorType = this.classifyError(error);
    return nonRetryableTypes.includes(errorType);
  }

  /**
   * Delay utility for retry mechanism
   */
  static delay(ms) {
    return SharedUtilities.delay(ms);
  }

  /**
   * Validate input with comprehensive validation
   */
  static validateInput(value, fieldName, validators = {}) {
    const errors = [];
    
    // Required validation
    if (validators.required && (!value || value.toString().trim() === '')) {
      errors.push(`${fieldName} is required`);
    }
    
    // Type validation
    if (value && validators.type) {
      const actualType = typeof value;
      if (actualType !== validators.type) {
        errors.push(`${fieldName} must be of type ${validators.type}, got ${actualType}`);
      }
    }
    
    // Length validation
    if (value && validators.minLength && value.toString().length < validators.minLength) {
      errors.push(`${fieldName} must be at least ${validators.minLength} characters`);
    }
    
    if (value && validators.maxLength && value.toString().length > validators.maxLength) {
      errors.push(`${fieldName} must be no more than ${validators.maxLength} characters`);
    }
    
    // Pattern validation
    if (value && validators.pattern && !validators.pattern.test(value.toString())) {
      errors.push(`${fieldName} format is invalid`);
    }
    
    // Custom validation
    if (value && validators.custom && typeof validators.custom === 'function') {
      const customResult = validators.custom(value);
      if (customResult !== true) {
        errors.push(customResult || `${fieldName} validation failed`);
      }
    }
    
    if (errors.length > 0) {
      throw this.createError(errors.join(', '), 'VALIDATION_ERROR', { fieldName, value, validators });
    }
    
    return true;
  }

  /**
   * Format error for UI display
   */
  static formatErrorForUI(error) {
    const userFriendlyError = this.getUserFriendlyError(error);
    
    return {
      title: userFriendlyError.title,
      message: userFriendlyError.message,
      action: userFriendlyError.action,
      actionUrl: userFriendlyError.actionUrl,
      severity: userFriendlyError.severity,
      retryable: userFriendlyError.retryable,
      retryDelay: userFriendlyError.retryDelay,
      timestamp: userFriendlyError.timestamp,
      id: userFriendlyError.id
    };
  }

  /**
   * Determine if error should be reported to user
   */
  static shouldReportToUser(error) {
    const silentErrorTypes = [
      'RATE_LIMITED' // These are handled by retry mechanism
    ];
    
    const errorType = this.classifyError(error);
    return !silentErrorTypes.includes(errorType);
  }

  /**
   * Log error with context (simplified version)
   */
  static async logError(error, context = {}) {
    try {
      const errorLog = {
        id: error.id || this.generateErrorId(),
        timestamp: Date.now(),
        error: error.message,
        type: this.classifyError(error),
        context,
        url: (typeof window !== 'undefined' && window.location?.href) || 'service-worker'
      };

      // Get existing logs
      const result = await chrome.storage.local.get(['error_logs']);
      const logs = result.error_logs || [];
      
      // Add new log and keep only last 20 errors
      logs.push(errorLog);
      if (logs.length > 20) {
        logs.splice(0, logs.length - 20);
      }
      
      // Save back to storage
      await chrome.storage.local.set({ error_logs: logs });
      
    } catch (logError) {
      console.warn('Failed to log error to storage:', logError.message);
    }
  }

  /**
   * Get error suggestions based on error type
   */
  static getErrorSuggestions(errorType) {
    const suggestions = {
      'INVALID_API_KEY': [
        'Verify your API key is correct',
        'Check if your API key has expired',
        'Ensure you have proper API permissions'
      ],
      'API_QUOTA_EXCEEDED': [
        'Wait until your quota resets',
        'Check your billing settings',
        'Consider upgrading your API plan'
      ],
      'NETWORK_ERROR': [
        'Check your internet connection',
        'Try again in a few moments',
        'Disable VPN if active'
      ],
      'FILE_TOO_LARGE': [
        'Use a smaller resume file',
        'Compress your PDF',
        'Convert to a different format'
      ],
      'JOB_DESCRIPTION_NOT_FOUND': [
        'Navigate to a job posting page',
        'Use manual input instead',
        'Try a different job board'
      ]
    };
    
    return suggestions[errorType] || [
      'Try refreshing the page',
      'Check your internet connection',
      'Contact support if problem persists'
    ];
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UnifiedErrorHandler;
} else if (typeof window !== 'undefined') {
  window.UnifiedErrorHandler = UnifiedErrorHandler;
}