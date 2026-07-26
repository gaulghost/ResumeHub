/**
 * Unified Error Handler for ResumeHub
 * Structured errors + user-friendly messaging for salary estimation / API paths
 */
export class UnifiedErrorHandler {
  
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
}
