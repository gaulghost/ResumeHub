/**
 * Application Configuration Manager
 * Centralized configuration management for ResumeHub
 */

class AppConfig {
  constructor() {
    this.config = {
      app: {
        name: 'ResumeHub AI',
        version: '1.4',
        description: 'AI-powered resume tailoring and job form auto-filling',
        author: 'Pradhuman Singh'
      },
      
      // API Configuration
      api: {
        gemini: {
          baseURL: 'https://generativelanguage.googleapis.com/v1beta/models',
          defaultModel: 'gemini-2.5-flash',
          timeout: 30000,
          maxRetries: 3,
          rateLimits: {
            requestsPerMinute: 10,
            concurrentRequests: 3,
            batchDelay: 500
          }
        }
      },

      // Storage Configuration
      storage: {
        areas: {
          local: ['resumeFilename', 'resumeContent', 'resumeMimeType', 'apiToken'],
          sync: ['theme', 'extractionMethod', 'userPreferences']
        },
        limits: {
          maxResumeSize: 10 * 1024 * 1024, // 10MB
          maxCacheAge: 24 * 60 * 60 * 1000 // 24 hours
        }
      },

      // UI Configuration
      ui: {
        themes: ['light', 'dark'],
        defaultTheme: 'light',
        animations: {
          duration: 300,
          enabled: true
        },
        keyboard: {
          shortcuts: {
            generate: 'Ctrl+Enter',
            preview: 'Ctrl+P',
            save: 'Ctrl+S'
          }
        }
      },

      // Resume Processing Configuration
      resume: {
        formats: {
          supported: ['.pdf', '.doc', '.docx', '.txt'],
          output: ['txt', 'pdf', 'docx']
        },
        validation: {
          minLength: 100,
          maxLength: 10000,
          requiredFields: ['contact', 'experience']
        },
        limits: {
          wordCount: 550,
          characterCount: 3400,
          minCharacterCount: 3000
        }
      },

      // Feature Flags
      features: {
        salaryEstimation: true,
        autoFill: true,
        aiExtraction: true,
        batchProcessing: true,
        templateSystem: false, // Future feature
        analytics: false, // Future feature
        linkedIn: {
          rightSidebar: true
        }
      },

      // Error Handling Configuration
      errorHandling: {
        maxRetries: 3,
        retryDelay: 1000,
        logLevel: 'error',
        userFriendlyMessages: true
      },

      // Development Configuration
      dev: {
        debugMode: false,
        verbose: false,
        mockData: false
      }
    };

    // Environment-specific overrides
    this._applyEnvironmentConfig();
  }

  /**
   * Get configuration value by path
   */
  get(path, defaultValue = null) {
    return this._getNestedValue(this.config, path) ?? defaultValue;
  }

  /**
   * Set configuration value by path
   */
  set(path, value) {
    this._setNestedValue(this.config, path, value);
  }

  /**
   * Check if a feature is enabled
   */
  isFeatureEnabled(featureName) {
    return this.get(`features.${featureName}`, false);
  }

  /**
   * Get API configuration for a specific service
   */
  getAPIConfig(serviceName) {
    return this.get(`api.${serviceName}`, {});
  }

  /**
   * Get nested value using dot notation
   */
  _getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Set nested value using dot notation
   */
  _setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  /**
   * Apply environment-specific configuration overrides
   */
  _applyEnvironmentConfig() {
    // Check if we're in development mode
    const isDev = typeof chrome !== 'undefined' && chrome.runtime?.getManifest?.()?.key === undefined;
    
    if (isDev) {
      this.config.dev.debugMode = true;
      this.config.dev.verbose = true;
      this.config.errorHandling.logLevel = 'debug';
    }
  }
}

// Create singleton instance
const appConfig = new AppConfig();

// Make available globally for non-module contexts
if (typeof window !== 'undefined') {
  window.AppConfig = appConfig;
}

// Export for module contexts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = appConfig;
}
