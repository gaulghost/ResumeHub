/**
 * State Manager Module
 * Handles application state including resume data, API tokens, processing flags, and settings
 */

class StateManager {
  constructor() {
    this.state = {
      // Resume data
      storedResume: {
        filename: null,
        content: null,
        mimeType: null
      },
      
      // Processing flags
      isProcessing: false,
      isPreviewing: false,
      
      // Settings
      selectedExtractionMethod: 'standard',
      currentTheme: 'light',
      
      // Generated data
      currentGeneratedResumeJSON: null,
      
      // API token
      apiToken: null
    };
    
    this.listeners = new Map();
  }

  /**
   * Subscribe to state changes
   */
  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(key);
      if (callbacks) {
        callbacks.delete(callback);
      }
    };
  }

  /**
   * Notify listeners of state changes
   */
  notify(key, newValue, oldValue) {
    const callbacks = this.listeners.get(key);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(newValue, oldValue, key);
        } catch (error) {
          console.error('Error in state change callback:', error);
        }
      });
    }
  }

  /**
   * Set state value and notify listeners
   */
  setState(key, value) {
    const oldValue = this.getState(key);
    
    // Handle nested keys like 'storedResume.filename'
    const keys = key.split('.');
    let current = this.state;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
    
    // Notify listeners
    this.notify(key, value, oldValue);
  }

  /**
   * Get state value
   */
  getState(key) {
    const keys = key.split('.');
    let current = this.state;
    
    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return undefined;
      }
    }
    
    return current;
  }

  /**
   * Resume management methods
   */
  async setResume(filename, content, mimeType) {
    this.setState('storedResume.filename', filename);
    this.setState('storedResume.content', content);
    this.setState('storedResume.mimeType', mimeType);
    
    // Save to Chrome storage using StorageManager
    await StorageManager.setResume(filename, content, mimeType);
  }

  getResume() {
    return this.getState('storedResume');
  }

  async clearResume() {
    this.setState('storedResume.filename', null);
    this.setState('storedResume.content', null);
    this.setState('storedResume.mimeType', null);
    
    // Clear from Chrome storage using StorageManager
    await StorageManager.clearResume();
  }

  hasResume() {
    const resume = this.getResume();
    return !!(resume.filename && resume.content && resume.mimeType);
  }

  /**
   * API Token management
   */
  async setApiToken(token) {
    this.setState('apiToken', token);
    
    // Save to Chrome storage using StorageManager
    if (token) {
      await StorageManager.setAPIToken(token);
    } else {
      await StorageManager.clearAPIToken();
    }
  }

  getApiToken() {
    return this.getState('apiToken');
  }

  hasApiToken() {
    const token = this.getApiToken();
    return !!(token && token.trim());
  }

  /**
   * Processing state management
   */
  setProcessing(isProcessing) {
    this.setState('isProcessing', isProcessing);
  }

  isProcessing() {
    return this.getState('isProcessing');
  }

  setPreviewing(isPreviewing) {
    this.setState('isPreviewing', isPreviewing);
  }

  isPreviewing() {
    return this.getState('isPreviewing');
  }

  /**
   * Settings management
   */
  async setExtractionMethod(method) {
    this.setState('selectedExtractionMethod', method);
    
    // Save to Chrome storage using StorageManager
    await StorageManager.setSetting('extractionMethod', method);
  }

  getExtractionMethod() {
    return this.getState('selectedExtractionMethod');
  }

  async setTheme(theme) {
    this.setState('currentTheme', theme);
    
    // Save to Chrome storage using StorageManager
    await StorageManager.setSetting('theme', theme);
  }

  getTheme() {
    return this.getState('currentTheme');
  }

  /**
   * Generated resume management
   */
  setGeneratedResume(resumeJSON) {
    this.setState('currentGeneratedResumeJSON', resumeJSON);
  }

  getGeneratedResume() {
    return this.getState('currentGeneratedResumeJSON');
  }

  hasGeneratedResume() {
    return !!this.getGeneratedResume();
  }

  clearGeneratedResume() {
    this.setState('currentGeneratedResumeJSON', null);
  }

  /**
   * Load state from Chrome storage using StorageManager
   */
  async loadFromStorage() {
    try {
      // Load settings using StorageManager
      const settings = await StorageManager.getSettings();
      
      // Load resume data using StorageManager
      const resumeData = await StorageManager.getResume();
      
      // Load API token using StorageManager
      const apiToken = await StorageManager.getAPIToken();
      
      // Apply settings
      if (settings.theme) {
        this.setState('currentTheme', settings.theme);
      }
      
      if (settings.extractionMethod) {
        this.setState('selectedExtractionMethod', settings.extractionMethod);
      }
      
      // Apply resume data
      if (resumeData.filename && resumeData.content && resumeData.mimeType) {
        this.setState('storedResume.filename', resumeData.filename);
        this.setState('storedResume.content', resumeData.content);
        this.setState('storedResume.mimeType', resumeData.mimeType);
      }
      
      // Apply API token
      if (apiToken) {
        this.setState('apiToken', apiToken);
      }
      
      console.log('✅ State loaded from Chrome storage using StorageManager');
      return true;
      
    } catch (error) {
      console.error('❌ Failed to load state from storage:', error);
      return false;
    }
  }

  /**
   * Validate current state
   */
  validateForResumeGeneration() {
    const errors = [];
    
    if (!this.hasResume()) {
      errors.push('Please upload your resume file first.');
    }
    
    if (!this.hasApiToken()) {
      errors.push('Please enter your Google API Key.');
    }
    
    const extractionMethod = this.getExtractionMethod();

    
    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Validate for auto-fill functionality
   */
  validateForAutoFill() {
    const errors = [];
    
    if (!this.hasResume()) {
      errors.push('Missing resume data - please upload a resume first');
    }
    
    if (!this.hasApiToken()) {
      errors.push('API token is required for auto-fill functionality');
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Get current state snapshot
   */
  getSnapshot() {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Reset all state
   */
  reset() {
    this.clearResume();
    this.setApiToken(null);
    this.setProcessing(false);
    this.setPreviewing(false);
    this.clearGeneratedResume();
    
    console.log('State reset');
  }

  /**
   * Debug method to log current state
   */
  debug() {
    console.log('Current State:', this.getSnapshot());
  }
}

// Make StateManager available globally for the popup
if (typeof window !== 'undefined') {
  window.StateManager = StateManager;
} 