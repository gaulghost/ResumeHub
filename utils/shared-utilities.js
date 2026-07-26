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

// Namespace for non-module popup / sidebar scripts
export const SharedUtilities = {
  delay,
  formatFileSize,
  validateFileType,
  getFileExtension,
  convertJSONToText,
  generateTimestampedFilename,
  generateResumeHash
};

if (typeof window !== 'undefined') {
  window.SharedUtilities = SharedUtilities;
} else if (typeof self !== 'undefined') {
  self.SharedUtilities = SharedUtilities;
}
