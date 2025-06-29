/**
 * Enhanced Error Handler
 * Provides user-friendly error messages and comprehensive error management
 */

class EnhancedErrorHandler extends ErrorHandler {
  
  /**
   * Create user-friendly error with actionable information
   */
  static createUserFriendlyError(error, context = {}) {
    const errorMap = {
      'API_QUOTA_EXCEEDED': {
        title: 'API Limit Reached',
        message: 'You\'ve reached your daily API limit. Try again tomorrow or check your API quota in Google AI Studio.',
        action: 'Check API Quota',
        actionUrl: 'https://aistudio.google.com/apikey',
        severity: 'warning',
        retryable: false
      },
      'INVALID_API_KEY': {
        title: 'API Key Issue',
        message: 'Your API key appears to be invalid or has expired. Please verify your key in settings.',
        action: 'Update API Key',
        severity: 'error',
        retryable: false
      },
      'NETWORK_ERROR': {
        title: 'Connection Problem',
        message: 'Unable to connect to AI services. Please check your internet connection and try again.',
        action: 'Retry',
        severity: 'warning',
        retryable: true
      },
      'RESUME_PARSE_ERROR': {
        title: 'Resume Format Issue',
        message: 'We couldn\'t read your resume file. Please try a different format (PDF, DOCX, or TXT) or check if the file is corrupted.',
        action: 'Choose Different File',
        severity: 'error',
        retryable: false
      },
      'JOB_DESCRIPTION_NOT_FOUND': {
        title: 'No Job Description Found',
        message: 'We couldn\'t find a job description on this page. Try navigating to a job posting page or paste the description manually.',
        action: 'Enter Manually',
        severity: 'info',
        retryable: false
      },
      'FILE_TOO_LARGE': {
        title: 'File Size Too Large',
        message: 'Your resume file is too large. Please use a file smaller than 10MB.',
        action: 'Choose Smaller File',
        severity: 'error',
        retryable: false
      },
      'RATE_LIMITED': {
        title: 'Too Many Requests',
        message: 'You\'re making requests too quickly. Please wait a moment before trying again.',
        action: 'Wait and Retry',
        severity: 'warning',
        retryable: true,
        retryDelay: 5000
      },
      'JSON_PARSE_ERROR': {
        title: 'Processing Error',
        message: 'There was an issue processing your resume. This usually resolves itself on retry.',
        action: 'Try Again',
        severity: 'warning',
        retryable: true
      },
      'PERMISSION_DENIED': {
        title: 'Permission Required',
        message: 'ResumeHub needs permission to access this page. Please reload the page and grant permissions when prompted.',
        action: 'Reload Page',
        severity: 'error',
        retryable: false
      },
      'CONTENT_BLOCKED': {
        title: 'Content Blocked',
        message: 'The AI service blocked this request due to content policies. Try with a different resume or job description.',
        action: 'Try Different Content',
        severity: 'warning',
        retryable: false
      }
    };

    const errorType = this.classifyError(error);
    const userError = errorMap[errorType] || {
      title: 'Something Went Wrong',
      message: 'An unexpected error occurred. Please try again, and if the problem persists, try refreshing the page.',
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
      id: this.generateErrorId()
    };
  }

  /**
   * Classify error based on message and context
   */
  static classifyError(error) {
    const message = error.message.toLowerCase();
    
    // API-related errors
    if (message.includes('quota') || message.includes('limit exceeded')) return 'API_QUOTA_EXCEEDED';
    if (message.includes('api key') || message.includes('unauthorized') || message.includes('invalid key')) return 'INVALID_API_KEY';
    if (message.includes('rate limit') || message.includes('too many requests')) return 'RATE_LIMITED';
    if (message.includes('blocked') || message.includes('content policy')) return 'CONTENT_BLOCKED';
    
    // Network errors
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) return 'NETWORK_ERROR';
    
    // File errors
    if (message.includes('file size') || message.includes('too large')) return 'FILE_TOO_LARGE';
    if (message.includes('parse') || message.includes('invalid type') || message.includes('corrupted')) return 'RESUME_PARSE_ERROR';
    
    // JSON errors
    if (message.includes('json') || message.includes('unexpected token')) return 'JSON_PARSE_ERROR';
    
    // Permission errors
    if (message.includes('permission') || message.includes('access denied')) return 'PERMISSION_DENIED';
    
    // Job description errors
    if (message.includes('job description') || message.includes('no_job_description_found')) return 'JOB_DESCRIPTION_NOT_FOUND';
    
    return 'UNKNOWN_ERROR';
  }

  /**
   * Generate unique error ID for tracking
   */
  static generateErrorId() {
    return 'err_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
  }

  /**
   * Log error with context for debugging
   */
  static async logError(error, context = {}) {
    const errorLog = {
      id: this.generateErrorId(),
      timestamp: Date.now(),
      error: error.message,
      stack: error.stack,
      context,
      userAgent: navigator.userAgent,
      url: window.location.href,
      extensionVersion: chrome.runtime.getManifest()?.version || 'unknown'
    };

    try {
      // Get existing logs
      const result = await StorageManager.get(['error_logs']);
      const logs = result.error_logs || [];
      
      // Add new log
      logs.push(errorLog);
      
      // Keep only last 50 errors to prevent storage bloat
      if (logs.length > 50) {
        logs.splice(0, logs.length - 50);
      }
      
      // Save back to storage
      await StorageManager.set({ error_logs: logs });
      
      console.log(`📝 Error logged with ID: ${errorLog.id}`);
      
    } catch (storageError) {
      console.error('Failed to log error to storage:', storageError);
    }
    
    return errorLog.id;
  }

  /**
   * Get error statistics for debugging
   */
  static async getErrorStats(days = 7) {
    try {
      const result = await StorageManager.get(['error_logs']);
      const logs = result.error_logs || [];
      
      const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
      const recentLogs = logs.filter(log => log.timestamp > cutoffTime);
      
      const stats = {
        totalErrors: recentLogs.length,
        errorsByType: {},
        errorsByDay: {},
        mostCommonErrors: {},
        timeRange: `Last ${days} days`
      };
      
      recentLogs.forEach(log => {
        // Count by type
        const errorType = this.classifyError({ message: log.error });
        stats.errorsByType[errorType] = (stats.errorsByType[errorType] || 0) + 1;
        
        // Count by day
        const day = new Date(log.timestamp).toDateString();
        stats.errorsByDay[day] = (stats.errorsByDay[day] || 0) + 1;
        
        // Count common error messages
        const shortMessage = log.error.substring(0, 50);
        stats.mostCommonErrors[shortMessage] = (stats.mostCommonErrors[shortMessage] || 0) + 1;
      });
      
      return stats;
      
    } catch (error) {
      console.error('Failed to get error stats:', error);
      return { totalErrors: 0, error: error.message };
    }
  }

  /**
   * Clear old error logs
   */
  static async clearErrorLogs(olderThanDays = 30) {
    try {
      const result = await StorageManager.get(['error_logs']);
      const logs = result.error_logs || [];
      
      const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
      const recentLogs = logs.filter(log => log.timestamp > cutoffTime);
      
      await StorageManager.set({ error_logs: recentLogs });
      
      console.log(`🗑️ Cleared ${logs.length - recentLogs.length} old error logs`);
      return logs.length - recentLogs.length;
      
    } catch (error) {
      console.error('Failed to clear error logs:', error);
      return 0;
    }
  }

  /**
   * Enhanced safe execution with user feedback
   */
  static async safeExecuteWithFeedback(operation, errorMessage = 'Operation failed', context = {}, progressCallback = null) {
    try {
      if (progressCallback) {
        progressCallback({ phase: 'starting', message: 'Initializing...' });
      }
      
      const result = await operation();
      
      if (progressCallback) {
        progressCallback({ phase: 'completed', message: 'Operation completed successfully' });
      }
      
      return { success: true, result };
      
    } catch (error) {
      console.error('Safe execution failed:', error);
      
      // Log the error
      const errorId = await this.logError(error, context);
      
      // Create user-friendly error
      const userError = this.createUserFriendlyError(error, { ...context, errorId });
      
      if (progressCallback) {
        progressCallback({ 
          phase: 'error', 
          error: userError,
          message: userError.message 
        });
      }
      
      return { 
        success: false, 
        error: userError,
        errorId 
      };
    }
  }

  /**
   * Retry operation with exponential backoff
   */
  static async retryWithUserFeedback(operation, maxRetries = 3, baseDelay = 1000, progressCallback = null) {
    let lastError = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (progressCallback && attempt > 0) {
          progressCallback({
            phase: 'retrying',
            attempt: attempt + 1,
            maxAttempts: maxRetries + 1,
            message: `Retry attempt ${attempt + 1}...`
          });
        }
        
        const result = await operation();
        
        if (progressCallback && attempt > 0) {
          progressCallback({
            phase: 'retry_success',
            message: `Succeeded on attempt ${attempt + 1}`
          });
        }
        
        return { success: true, result, attempts: attempt + 1 };
        
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries) {
          break; // Don't delay on last attempt
        }
        
        // Check if error is retryable
        const userError = this.createUserFriendlyError(error);
        if (!userError.retryable) {
          break; // Don't retry non-retryable errors
        }
        
        // Calculate delay with exponential backoff
        const delay = baseDelay * Math.pow(2, attempt);
        
        if (progressCallback) {
          progressCallback({
            phase: 'retry_delay',
            attempt: attempt + 1,
            delay: delay,
            message: `Waiting ${Math.round(delay / 1000)}s before retry...`
          });
        }
        
        await this.delay(delay);
      }
    }
    
    // All retries failed
    const errorId = await this.logError(lastError, { maxRetries, attempts: maxRetries + 1 });
    const userError = this.createUserFriendlyError(lastError, { errorId });
    
    return { 
      success: false, 
      error: userError,
      attempts: maxRetries + 1,
      errorId 
    };
  }

  /**
   * Format error for display in UI
   */
  static formatErrorForUI(error) {
    if (error.title && error.message) {
      // Already a user-friendly error
      return error;
    }
    
    // Convert raw error to user-friendly format
    return this.createUserFriendlyError(error);
  }

  /**
   * Check if error should be reported to user
   */
  static shouldReportToUser(error) {
    const silentErrors = [
      'AbortError', // User cancelled operation
      'NetworkError', // Temporary network issues
    ];
    
    return !silentErrors.includes(error.name);
  }

  /**
   * Get user-friendly suggestions based on error type
   */
  static getErrorSuggestions(errorType) {
    const suggestions = {
      'API_QUOTA_EXCEEDED': [
        'Wait until tomorrow when your quota resets',
        'Consider upgrading your Google AI Studio plan',
        'Use the extension less frequently to stay within limits'
      ],
      'INVALID_API_KEY': [
        'Verify your API key is copied correctly',
        'Check if your API key has expired',
        'Generate a new API key from Google AI Studio'
      ],
      'NETWORK_ERROR': [
        'Check your internet connection',
        'Try again in a few moments',
        'Disable VPN if you\'re using one'
      ],
      'RESUME_PARSE_ERROR': [
        'Try converting your resume to PDF format',
        'Ensure your resume file isn\'t corrupted',
        'Use a simpler resume format with standard sections'
      ],
      'JOB_DESCRIPTION_NOT_FOUND': [
        'Navigate to a job posting page',
        'Look for pages with detailed job descriptions',
        'Copy and paste the job description manually'
      ]
    };
    
    return suggestions[errorType] || [
      'Try refreshing the page',
      'Restart the browser if problems persist',
      'Check the console for more details'
    ];
  }
}

// Make EnhancedErrorHandler available globally
if (typeof window !== 'undefined') {
  window.EnhancedErrorHandler = EnhancedErrorHandler;
} 