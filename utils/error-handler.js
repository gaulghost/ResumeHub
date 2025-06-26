// Standardized error handling for ResumeHub
class ErrorHandler {
  static createError(message, code, context = {}) {
    const error = new Error(message);
    error.code = code;
    error.context = context;
    error.timestamp = new Date().toISOString();
    return error;
  }

  static handleAPIError(error, operation) {
    console.error(`API Error during ${operation}:`, error);
    
    // Check for specific API error patterns
    if (error.message.includes('API key') || error.message.includes('401')) {
      return 'Invalid or missing API key. Please check your Google Gemini API key.';
    }
    
    if (error.message.includes('quota') || error.message.includes('429')) {
      return 'API quota exceeded. Please try again later or check your billing.';
    }
    
    if (error.message.includes('blocked') || error.message.includes('safety')) {
      return 'Content was blocked by safety filters. Please try with different content.';
    }

    if (error.message.includes('403')) {
      return 'API access forbidden. Please check your API key permissions.';
    }

    if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
      return 'Google API is temporarily unavailable. Please try again in a few minutes.';
    }

    if (error.message.includes('timeout') || error.message.includes('network')) {
      return 'Network timeout. Please check your internet connection and try again.';
    }
    
    return `${operation} failed: ${error.message}`;
  }

  static handleChromeError(error, operation) {
    console.error(`Chrome API Error during ${operation}:`, error);
    
    if (error.message.includes('activeTab') || error.message.includes('Cannot access')) {
      return 'Cannot access the current tab. Please refresh the page and try again.';
    }
    
    if (error.message.includes('storage')) {
      return 'Storage operation failed. Please check extension permissions.';
    }

    if (error.message.includes('scripting')) {
      return 'Cannot execute script on this page. Some pages (like chrome:// URLs) are protected.';
    }

    if (error.message.includes('tabs')) {
      return 'Cannot access tab information. Please ensure the extension has proper permissions.';
    }

    if (error.message.includes('Receiving end does not exist')) {
      return 'Extension communication failed. Please try refreshing the page.';
    }
    
    return `${operation} failed: ${error.message}`;
  }

  static handleFileError(error, operation) {
    console.error(`File Error during ${operation}:`, error);

    if (error.message.includes('type') || error.message.includes('format')) {
      return 'Unsupported file format. Please use PDF, DOCX, or TXT files.';
    }

    if (error.message.includes('size')) {
      return 'File is too large. Please use a smaller file (max 10MB).';
    }

    if (error.message.includes('read') || error.message.includes('parse')) {
      return 'Cannot read file. Please ensure the file is not corrupted.';
    }

    return `File ${operation} failed: ${error.message}`;
  }

  static async safeExecute(operation, errorMessage = 'Operation failed', context = {}) {
    try {
      return await operation();
    } catch (error) {
      console.error(errorMessage, error);
      throw this.createError(errorMessage, 'SAFE_EXECUTE_ERROR', { 
        originalError: error.message,
        ...context 
      });
    }
  }

  static async safeAPICall(apiCall, operation) {
    try {
      return await apiCall();
    } catch (error) {
      const userMessage = this.handleAPIError(error, operation);
      throw this.createError(userMessage, 'API_ERROR', { 
        operation,
        originalError: error.message 
      });
    }
  }

  static async safeChromeOperation(chromeCall, operation) {
    try {
      return await chromeCall();
    } catch (error) {
      const userMessage = this.handleChromeError(error, operation);
      throw this.createError(userMessage, 'CHROME_ERROR', { 
        operation,
        originalError: error.message 
      });
    }
  }

  static async safeFileOperation(fileCall, operation) {
    try {
      return await fileCall();
    } catch (error) {
      const userMessage = this.handleFileError(error, operation);
      throw this.createError(userMessage, 'FILE_ERROR', { 
        operation,
        originalError: error.message 
      });
    }
  }

  // Retry mechanism with exponential backoff
  static async withRetry(operation, maxRetries = 3, delay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        console.warn(`Attempt ${attempt} failed:`, error.message);
        
        // Don't retry certain types of errors
        if (this.isNonRetryableError(error)) {
          console.log('Non-retryable error detected, stopping retries');
          break;
        }
        
        if (attempt < maxRetries) {
          const waitTime = delay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`Waiting ${waitTime}ms before retry...`);
          await this.delay(waitTime);
        }
      }
    }
    
    throw lastError;
  }

  static isNonRetryableError(error) {
    const nonRetryablePatterns = [
      'API key',
      'Invalid',
      'blocked',
      'safety',
      'permissions',
      'format',
      'type'
    ];

    return nonRetryablePatterns.some(pattern => 
      error.message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  static delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Log error for debugging while showing user-friendly message
  static logAndThrow(error, userMessage, context = {}) {
    console.error('Detailed error:', {
      message: error.message,
      stack: error.stack,
      context: context,
      timestamp: new Date().toISOString()
    });

    throw this.createError(userMessage, 'USER_FACING_ERROR', context);
  }

  // Validate input and throw user-friendly errors
  static validateInput(value, fieldName, validators = {}) {
    if (validators.required && (!value || value.toString().trim() === '')) {
      throw this.createError(`${fieldName} is required`, 'VALIDATION_ERROR');
    }

    if (validators.minLength && value.length < validators.minLength) {
      throw this.createError(
        `${fieldName} must be at least ${validators.minLength} characters`, 
        'VALIDATION_ERROR'
      );
    }

    if (validators.maxLength && value.length > validators.maxLength) {
      throw this.createError(
        `${fieldName} cannot exceed ${validators.maxLength} characters`, 
        'VALIDATION_ERROR'
      );
    }

    if (validators.pattern && !validators.pattern.test(value)) {
      throw this.createError(
        `${fieldName} format is invalid`, 
        'VALIDATION_ERROR'
      );
    }

    return true;
  }

  // Format error for UI display
  static formatErrorForUI(error) {
    // If it's already a user-friendly error, return as is
    if (error.code && error.code.includes('ERROR')) {
      return error.message;
    }

    // For unexpected errors, provide generic message
    return 'An unexpected error occurred. Please try again or contact support if the problem persists.';
  }

  // Check if error should be reported to user vs logged silently
  static shouldReportToUser(error) {
    const silentErrors = ['CACHE_ERROR', 'ANALYTICS_ERROR', 'OPTIONAL_FEATURE_ERROR'];
    return !silentErrors.includes(error.code);
  }
}

// Make available globally for Chrome extension
if (typeof window !== 'undefined') {
  window.ErrorHandler = ErrorHandler;
} else if (typeof self !== 'undefined') {
  self.ErrorHandler = ErrorHandler;
} 