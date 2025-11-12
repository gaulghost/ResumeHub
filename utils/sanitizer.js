/**
 * HTML Sanitization Utility
 * Prevents XSS attacks by sanitizing user-generated and external content
 */

export class Sanitizer {
  /**
   * Sanitize HTML string to prevent XSS
   * Removes script tags, event handlers, and dangerous attributes
   * @param {string} html - HTML string to sanitize
   * @returns {string} Sanitized HTML string
   */
  static sanitizeHTML(html) {
    if (!html || typeof html !== 'string') {
      return '';
    }

    // Create a temporary div element
    const temp = document.createElement('div');
    temp.textContent = html; // This automatically escapes HTML
    return temp.innerHTML;
  }

  /**
   * Sanitize text content (removes all HTML)
   * @param {string} text - Text to sanitize
   * @returns {string} Plain text with HTML escaped
   */
  static sanitizeText(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    const temp = document.createElement('div');
    temp.textContent = text;
    return temp.textContent || temp.innerText || '';
  }

  /**
   * Sanitize URL to prevent javascript: and data: protocol attacks
   * @param {string} url - URL to sanitize
   * @returns {string} Sanitized URL or empty string if invalid
   */
  static sanitizeURL(url) {
    if (!url || typeof url !== 'string') {
      return '';
    }

    const trimmed = url.trim();
    
    // Block dangerous protocols
    const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
    const lowerUrl = trimmed.toLowerCase();
    
    for (const protocol of dangerousProtocols) {
      if (lowerUrl.startsWith(protocol)) {
        return '';
      }
    }

    // Allow http, https, mailto, tel, and relative URLs
    if (/^(https?:\/\/|mailto:|tel:|\/|#)/.test(trimmed)) {
      return trimmed;
    }

    // If no protocol, assume relative URL
    if (!trimmed.includes('://')) {
      return trimmed;
    }

    return '';
  }

  /**
   * Sanitize object with nested strings
   * Recursively sanitizes all string values in an object
   * @param {any} obj - Object to sanitize
   * @param {boolean} sanitizeKeys - Whether to sanitize object keys
   * @returns {any} Sanitized object
   */
  static sanitizeObject(obj, sanitizeKeys = false) {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.sanitizeText(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item, sanitizeKeys));
    }

    if (typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        const safeKey = sanitizeKeys ? this.sanitizeText(key) : key;
        sanitized[safeKey] = this.sanitizeObject(value, sanitizeKeys);
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * Safely set innerHTML with sanitization
   * @param {HTMLElement} element - DOM element
   * @param {string} content - Content to set (will be sanitized)
   */
  static safeSetInnerHTML(element, content) {
    if (!element || !(element instanceof HTMLElement)) {
      return;
    }
    
    // Use textContent for safety, or sanitize HTML if needed
    if (content && typeof content === 'string') {
      // Check if content contains HTML tags
      if (/<[^>]+>/.test(content)) {
        // Sanitize HTML
        element.innerHTML = this.sanitizeHTML(content);
      } else {
        // Plain text - use textContent
        element.textContent = content;
      }
    } else {
      element.textContent = '';
    }
  }

  /**
   * Create safe HTML element with sanitized content
   * @param {string} tagName - HTML tag name
   * @param {Object} attributes - Element attributes (will be sanitized)
   * @param {string} content - Element content (will be sanitized)
   * @returns {HTMLElement} Safe DOM element
   */
  static createSafeElement(tagName, attributes = {}, content = '') {
    const element = document.createElement(tagName);
    
    // Set sanitized attributes
    for (const [key, value] of Object.entries(attributes)) {
      if (key === 'href' || key === 'src') {
        const safeUrl = this.sanitizeURL(value);
        if (safeUrl) {
          element.setAttribute(key, safeUrl);
        }
      } else if (key.startsWith('on')) {
        // Skip event handlers
        continue;
      } else {
        element.setAttribute(key, this.sanitizeText(String(value)));
      }
    }
    
    // Set sanitized content
    if (content) {
      this.safeSetInnerHTML(element, content);
    }
    
    return element;
  }

  /**
   * Escape HTML special characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  static escapeHTML(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };

    return text.replace(/[&<>"']/g, m => map[m]);
  }
}

