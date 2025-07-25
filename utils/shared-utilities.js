/**
 * Shared Utilities Module
 * Consolidates common utility functions used across the ResumeHub extension
 */

/**
 * Unified delay function
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} Promise that resolves after delay
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format file size in human readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Validate file type against allowed types
 * @param {string} filename - Name of the file
 * @param {Array} allowedTypes - Array of allowed file types
 * @returns {boolean} True if file type is valid
 */
export function validateFileType(filename, allowedTypes) {
  if (!filename || !allowedTypes || allowedTypes.length === 0) {
    return false;
  }
  
  const extension = filename.toLowerCase().split('.').pop();
  return allowedTypes.some(type => type.toLowerCase().includes(extension));
}

/**
 * Get file extension from filename
 * @param {string} filename - Name of the file
 * @returns {string} File extension
 */
export function getFileExtension(filename) {
  if (!filename) return '';
  return filename.split('.').pop().toLowerCase();
}

/**
 * Generate unique ID
 * @param {string} prefix - Optional prefix for the ID
 * @returns {string} Unique ID
 */
export function generateUniqueId(prefix = 'id') {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substr(2, 5);
  return `${prefix}_${timestamp}_${randomStr}`;
}

/**
 * Convert JSON resume data to formatted text
 * @param {Object} jsonData - Resume JSON data
 * @returns {string} Formatted text representation
 */
export function convertJSONToText(jsonData) {
  if (!jsonData) return '';
  
  let text = '';
  
  // Contact Information
  if (jsonData.contact) {
    text += '=== CONTACT INFORMATION ===\n';
    if (jsonData.contact.name) text += `Name: ${jsonData.contact.name}\n`;
    if (jsonData.jobTitle) text += `Job Title: ${jsonData.jobTitle}\n`;
    if (jsonData.contact.email) text += `Email: ${jsonData.contact.email}\n`;
    if (jsonData.contact.phone) text += `Phone: ${jsonData.contact.phone}\n`;
    if (jsonData.contact.linkedin) text += `LinkedIn: ${jsonData.contact.linkedin}\n`;
    if (jsonData.contact.github) text += `GitHub: ${jsonData.contact.github}\n`;
    if (jsonData.contact.portfolio) text += `Portfolio: ${jsonData.contact.portfolio}\n`;
    text += '\n';
  }

  // Summary
  if (jsonData.summary) {
    text += '=== PROFESSIONAL SUMMARY ===\n';
    text += `${jsonData.summary}\n\n`;
  }

  // Experience
  if (jsonData.experience && jsonData.experience.length > 0) {
    text += '=== PROFESSIONAL EXPERIENCE ===\n';
    jsonData.experience.forEach(exp => {
      text += `${exp.title} | ${exp.company}\n`;
      if (exp.location) text += `Location: ${exp.location}\n`;
      if (exp.dates) text += `Duration: ${exp.dates}\n`;
      if (exp.bullets && exp.bullets.length > 0) {
        exp.bullets.forEach(bullet => {
          text += `• ${bullet}\n`;
        });
      }
      text += '\n';
    });
  }

  // Education
  if (jsonData.education && jsonData.education.length > 0) {
    text += '=== EDUCATION ===\n';
    jsonData.education.forEach(edu => {
      text += `${edu.degree} | ${edu.institution}\n`;
      if (edu.location) text += `Location: ${edu.location}\n`;
      if (edu.dates) text += `Duration: ${edu.dates}\n`;
      if (edu.details) text += `Details: ${edu.details}\n`;
      text += '\n';
    });
  }

  // Skills
  if (jsonData.skills && jsonData.skills.length > 0) {
    text += '=== SKILLS ===\n';
    jsonData.skills.forEach(skillGroup => {
      text += `${skillGroup.category}:\n`;
      if (skillGroup.items && skillGroup.items.length > 0) {
        text += `${skillGroup.items.join(', ')}\n`;
      }
      text += '\n';
    });
  }

  // Projects
  if (jsonData.projects && jsonData.projects.length > 0) {
    text += '=== PROJECTS ===\n';
    jsonData.projects.forEach(project => {
      text += `${project.name}\n`;
      if (project.description) text += `Description: ${project.description}\n`;
      if (project.technologies && project.technologies.length > 0) {
        text += `Technologies: ${project.technologies.join(', ')}\n`;
      }
      if (project.link) text += `Link: ${project.link}\n`;
      text += '\n';
    });
  }

  // Achievements
  if (jsonData.achievements && jsonData.achievements.length > 0) {
    text += '=== ACHIEVEMENTS ===\n';
    jsonData.achievements.forEach(achievement => {
      text += `• ${achievement}\n`;
    });
    text += '\n';
  }

  return text;
}

/**
 * Truncate text to specified length with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export function truncateText(text, maxLength = 100) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Capitalize first letter of each word
 * @param {string} text - Text to capitalize
 * @returns {string} Capitalized text
 */
export function capitalizeWords(text) {
  if (!text) return '';
  return text.replace(/\w\S*/g, (txt) => 
    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
}

/**
 * Clean and normalize text
 * @param {string} text - Text to clean
 * @returns {string} Cleaned text
 */
export function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/\n+/g, '\n') // Replace multiple newlines with single newline
    .trim();
}

/**
 * Check if object is empty
 * @param {Object} obj - Object to check
 * @returns {boolean} True if object is empty
 */
export function isEmptyObject(obj) {
  return !obj || Object.keys(obj).length === 0;
}

/**
 * Deep clone an object
 * @param {Object} obj - Object to clone
 * @returns {Object} Cloned object
 */
export function deepClone(obj) {
  if (!obj) return obj;
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Count words in text
 * @param {string} text - Text to count words in
 * @returns {number} Word count
 */
export function countWords(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Count characters in text (excluding whitespace)
 * @param {string} text - Text to count characters in
 * @returns {number} Character count
 */
export function countCharacters(text) {
  if (!text) return 0;
  return text.replace(/\s/g, '').length;
}

/**
 * Generate filename with timestamp
 * @param {string} baseName - Base name for the file
 * @param {string} extension - File extension
 * @returns {string} Generated filename
 */
export function generateTimestampedFilename(baseName = 'resume', extension = 'txt') {
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .substring(0, 19);
  return `${baseName}_${timestamp}.${extension}`;
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if email is valid
 */
export function isValidEmail(email) {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if phone is valid
 */
export function isValidPhone(phone) {
  if (!phone) return false;
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
}

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} True if URL is valid
 */
export function isValidUrl(url) {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get current timestamp in ISO format
 * @returns {string} ISO timestamp
 */
export function getCurrentTimestamp() {
  return new Date().toISOString();
}

/**
 * Check if timestamp is expired
 * @param {number} timestamp - Timestamp to check
 * @param {number} expiryHours - Hours until expiry
 * @returns {boolean} True if expired
 */
export function isTimestampExpired(timestamp, expiryHours = 24) {
  if (!timestamp) return true;
  const now = Date.now();
  const expiryMs = expiryHours * 60 * 60 * 1000;
  return (now - timestamp) > expiryMs;
}

/**
 * Generate consistent hash for resume data
 * @param {Object} resumeData - Resume data object (can be JSON or raw data)
 * @returns {string} Consistent hash string
 */
export function generateResumeHash(resumeData) {
  try {
    let dataToHash;
    
    if (typeof resumeData === 'string') {
      // If it's a string, use as-is
      dataToHash = resumeData;
    } else if (resumeData && resumeData.content) {
      // If it's a file data object with content
      dataToHash = resumeData.content;
    } else if (resumeData && typeof resumeData === 'object') {
      // If it's a JSON object, extract static parts for consistent hashing
      const staticData = {
        contact: resumeData.contact || null,
        // Only include non-dynamic fields for cache consistency
      };
      dataToHash = JSON.stringify(staticData);
    } else {
      // Fallback
      dataToHash = JSON.stringify(resumeData || {});
    }
    
    // Generate base64 hash (consistent with existing implementation)
    return btoa(dataToHash).substring(0, 16);
  } catch (error) {
    console.warn('Error generating resume hash:', error);
    // Fallback hash
    return btoa(Date.now().toString()).substring(0, 16);
  }
}

// Create a namespace object for backward compatibility with legacy global usage
export const SharedUtilities = {
  delay,
  formatFileSize,
  validateFileType,
  getFileExtension,
  generateUniqueId,
  convertJSONToText,
  truncateText,
  capitalizeWords,
  cleanText,
  isEmptyObject,
  deepClone,
  countWords,
  countCharacters,
  generateTimestampedFilename,
  isValidEmail,
  isValidPhone,
  isValidUrl,
  getCurrentTimestamp,
  isTimestampExpired,
  generateResumeHash
};

// Expose globally so non-module popup scripts can access it
if (typeof window !== 'undefined') {
  window.SharedUtilities = SharedUtilities;
} else if (typeof self !== 'undefined') {
  self.SharedUtilities = SharedUtilities;
} else if (typeof global !== 'undefined') {
  global.SharedUtilities = SharedUtilities;
} 