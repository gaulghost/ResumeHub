/**
 * Storage Adapter for Popup
 * Communicates with background script for storage operations
 */

class StorageAdapter {
  /**
   * Get settings from storage via background script
   */
  static async getSettings() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error getting settings:', chrome.runtime.lastError);
          resolve({ theme: 'light', extractionMethod: 'ai' });
        } else {
          resolve(response || { theme: 'light', extractionMethod: 'ai' });
        }
      });
    });
  }

  /**
   * Set a setting in storage via background script
   */
  static async setSetting(key, value) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ 
        action: 'setSetting', 
        data: { key, value } 
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error setting value:', chrome.runtime.lastError);
          resolve(false);
        } else {
          resolve(response?.success || false);
        }
      });
    });
  }

  /**
   * Get resume data from storage via background script
   */
  static async getResume() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getResume' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error getting resume:', chrome.runtime.lastError);
          resolve({ filename: null, content: null, mimeType: null });
        } else {
          resolve(response || { filename: null, content: null, mimeType: null });
        }
      });
    });
  }

  /**
   * Set resume data in storage via background script
   */
  static async setResume(filename, content, mimeType) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ 
        action: 'setResume', 
        data: { filename, content, mimeType } 
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error setting resume:', chrome.runtime.lastError);
          resolve(false);
        } else {
          resolve(response?.success || false);
        }
      });
    });
  }

  /**
   * Clear resume data from storage via background script
   */
  static async clearResume() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'clearResume' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error clearing resume:', chrome.runtime.lastError);
          resolve(false);
        } else {
          resolve(response?.success || false);
        }
      });
    });
  }

  /**
   * Get API token from storage via background script
   */
  static async getAPIToken() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getAPIToken' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error getting API token:', chrome.runtime.lastError);
          resolve(null);
        } else {
          resolve(response?.token || null);
        }
      });
    });
  }

  /**
   * Set API token in storage via background script
   */
  static async setAPIToken(token) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ 
        action: 'setAPIToken', 
        data: { token } 
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error setting API token:', chrome.runtime.lastError);
          resolve(false);
        } else {
          resolve(response?.success || false);
        }
      });
    });
  }

  /**
   * Clear API token from storage via background script
   */
  static async clearAPIToken() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'clearAPIToken' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error clearing API token:', chrome.runtime.lastError);
          resolve(false);
        } else {
          resolve(response?.success || false);
        }
      });
    });
  }

  /**
   * Legacy cache helper – always returns null in popup context.
   * Background script manages real cache; popup only needs API presence to avoid errors.
   */
  static async getValidCache(key) {
    return null; // No-op cache in popup context
  }

  // Provide no-op setters to maintain interface parity
  static async setCache(key, value) { return false; }
  static async setCacheWithExpiry(key, value, hours) { return false; }
}

// Make StorageManager available as alias for backward compatibility
window.StorageManager = StorageAdapter; 