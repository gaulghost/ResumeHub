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
}
