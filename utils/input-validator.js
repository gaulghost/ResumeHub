/**
 * Input Validation Utility
 * Validates user inputs and API responses to prevent errors and security issues
 */

export class InputValidator {
  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {boolean} True if valid email
   */
  static isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  /**
   * Validate URL format
   * @param {string} url - URL to validate
   * @returns {boolean} True if valid URL
   */
  static isValidURL(url) {
    if (!url || typeof url !== 'string') return false;
    try {
      new URL(url);
      return true;
    } catch {
      // Check if it's a relative URL
      return url.startsWith('/') || url.startsWith('#');
    }
  }

  /**
   * Validate phone number format
   * @param {string} phone - Phone number to validate
   * @returns {boolean} True if phone is valid
   */
  static isValidPhone(phone) {
    if (!phone || typeof phone !== 'string') return false;
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  }

  /**
   * Validate API key format (basic check)
   * @param {string} apiKey - API key to validate
   * @returns {boolean} True if appears to be valid format
   */
  static isValidAPIKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') return false;
    const trimmed = apiKey.trim();
    // Basic validation: should be at least 20 characters and contain alphanumeric
    return trimmed.length >= 20 && /^[A-Za-z0-9_-]+$/.test(trimmed);
  }

  /**
   * Validate job description text
   * @param {string} jobDescription - Job description to validate
   * @param {number} minLength - Minimum length (default: 50)
   * @param {number} maxLength - Maximum length (default: 50000)
   * @returns {Object} { valid: boolean, error: string }
   */
  static validateJobDescription(jobDescription, minLength = 50, maxLength = 50000) {
    if (!jobDescription || typeof jobDescription !== 'string') {
      return { valid: false, error: 'Job description is required' };
    }

    const trimmed = jobDescription.trim();
    
    if (trimmed.length < minLength) {
      return { valid: false, error: `Job description must be at least ${minLength} characters` };
    }

    if (trimmed.length > maxLength) {
      return { valid: false, error: `Job description must be less than ${maxLength} characters` };
    }

    return { valid: true, error: null };
  }

  /**
   * Validate resume JSON structure
   * @param {Object} resumeJSON - Resume JSON to validate
   * @returns {Object} { valid: boolean, error: string }
   */
  static validateResumeJSON(resumeJSON) {
    if (!resumeJSON || typeof resumeJSON !== 'object') {
      return { valid: false, error: 'Resume data is required' };
    }

    // Check for required top-level fields
    const requiredFields = ['contact', 'experience'];
    for (const field of requiredFields) {
      if (!resumeJSON[field]) {
        return { valid: false, error: `Missing required field: ${field}` };
      }
    }

    // Validate contact information
    if (resumeJSON.contact) {
      if (resumeJSON.contact.email && !this.isValidEmail(resumeJSON.contact.email)) {
        return { valid: false, error: 'Invalid email address' };
      }
    }

    // Validate experience array
    if (resumeJSON.experience && Array.isArray(resumeJSON.experience)) {
      if (resumeJSON.experience.length === 0) {
        return { valid: false, error: 'At least one work experience is required' };
      }
    }

    return { valid: true, error: null };
  }

  /**
   * Validate file type
   * @param {File} file - File to validate
   * @param {string[]} allowedTypes - Allowed MIME types or extensions
   * @returns {Object} { valid: boolean, error: string }
   */
  static validateFileType(file, allowedTypes = ['.pdf', '.doc', '.docx', '.txt']) {
    if (!file || !(file instanceof File)) {
      return { valid: false, error: 'Invalid file object' };
    }

    const fileName = file.name.toLowerCase();
    const fileExtension = fileName.substring(fileName.lastIndexOf('.'));

    if (!allowedTypes.includes(fileExtension)) {
      return { 
        valid: false, 
        error: `File type ${fileExtension} not allowed. Allowed types: ${allowedTypes.join(', ')}` 
      };
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return { valid: false, error: 'File size exceeds 10MB limit' };
    }

    return { valid: true, error: null };
  }

  /**
   * Validate API response structure
   * @param {any} response - API response to validate
   * @param {string} expectedType - Expected response type ('json', 'text', 'array')
   * @returns {Object} { valid: boolean, error: string }
   */
  static validateAPIResponse(response, expectedType = 'json') {
    if (response === null || response === undefined) {
      return { valid: false, error: 'API response is empty' };
    }

    switch (expectedType) {
      case 'json':
        if (typeof response !== 'object') {
          return { valid: false, error: 'Expected JSON object response' };
        }
        break;
      case 'array':
        if (!Array.isArray(response)) {
          return { valid: false, error: 'Expected array response' };
        }
        break;
      case 'text':
        if (typeof response !== 'string') {
          return { valid: false, error: 'Expected string response' };
        }
        break;
    }

    return { valid: true, error: null };
  }

  /**
   * Validate salary input string
   * @param {string} salaryInput - Salary input (e.g., "26LPA", "26L", "2600000")
   * @returns {Object} { valid: boolean, value: number, error: string }
   */
  static validateSalaryInput(salaryInput) {
    if (!salaryInput || typeof salaryInput !== 'string') {
      return { valid: false, value: null, error: 'Salary input is required' };
    }

    const trimmed = salaryInput.trim().toUpperCase();
    
    // Match patterns like "26LPA", "26L", "2600000", "26,00,000"
    const patterns = [
      /^(\d+(?:\.\d+)?)\s*LPA?$/i,  // 26LPA, 26L
      /^(\d{1,3}(?:,\d{2,3})*)$/,    // 26,00,000
      /^(\d+)$/                      // 2600000
    ];

    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        let value = parseFloat(match[1].replace(/,/g, ''));
        
        // If it's in LPA format, convert to actual number
        if (/LPA?$/i.test(trimmed)) {
          value = value * 100000; // Convert LPA to actual amount
        }

        if (value > 0 && value < 100000000) { // Reasonable upper limit
          return { valid: true, value, error: null };
        }
      }
    }

    return { valid: false, value: null, error: 'Invalid salary format. Use: 26LPA, 26L, or 2600000' };
  }

  /**
   * Sanitize and validate text input
   * @param {string} text - Text to sanitize and validate
   * @param {number} maxLength - Maximum length
   * @returns {Object} { valid: boolean, sanitized: string, error: string }
   */
  static sanitizeAndValidateText(text, maxLength = 10000) {
    if (!text || typeof text !== 'string') {
      return { valid: false, sanitized: '', error: 'Text input is required' };
    }

    const trimmed = text.trim();
    
    if (trimmed.length === 0) {
      return { valid: false, sanitized: '', error: 'Text cannot be empty' };
    }

    if (trimmed.length > maxLength) {
      return { valid: false, sanitized: '', error: `Text exceeds maximum length of ${maxLength} characters` };
    }

    // Basic sanitization: remove null bytes and control characters
    const sanitized = trimmed.replace(/[\x00-\x1F\x7F]/g, '');

    return { valid: true, sanitized, error: null };
  }

  /**
   * Validate numeric input
   * @param {any} value - Value to validate
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {Object} { valid: boolean, value: number, error: string }
   */
  static validateNumber(value, min = null, max = null) {
    const num = typeof value === 'string' ? parseFloat(value) : Number(value);

    if (isNaN(num)) {
      return { valid: false, value: null, error: 'Invalid number' };
    }

    if (min !== null && num < min) {
      return { valid: false, value: num, error: `Value must be at least ${min}` };
    }

    if (max !== null && num > max) {
      return { valid: false, value: num, error: `Value must be at most ${max}` };
    }

    return { valid: true, value: num, error: null };
  }
}

