// Centralized storage management for Chrome extension
export class StorageManager {
  static initialize() {
    // This method is called on startup to ensure the manager is ready.
    // Currently no specific initialization logic is needed here, but it's a good practice to have it.
    console.log('[ResumeHub] StorageManager Initialized.');
  }

  static async get(keys, area = 'local') {
    return new Promise((resolve, reject) => {
      chrome.storage[area].get(keys, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result);
        }
      });
    });
  }

  static async set(data, area = 'local') {
    return new Promise((resolve, reject) => {
      chrome.storage[area].set(data, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  static async remove(keys, area = 'local') {
    return new Promise((resolve, reject) => {
      chrome.storage[area].remove(keys, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  static async clear(area = 'local') {
    return new Promise((resolve, reject) => {
      chrome.storage[area].clear(() => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  // Resume-specific methods
  static async getResume() {
    try {
      const data = await this.get(['resumeFilename', 'resumeContent', 'resumeMimeType']);
      return {
        filename: data.resumeFilename || null,
        content: data.resumeContent || null,
        mimeType: data.resumeMimeType || null
      };
    } catch (error) {
      console.error('Error getting resume from storage:', error);
      return { filename: null, content: null, mimeType: null };
    }
  }

  static async setResume(filename, content, mimeType) {
    try {
      await this.set({
        resumeFilename: filename,
        resumeContent: content,
        resumeMimeType: mimeType
      });
      console.log('Resume saved to storage:', filename);
      return true;
    } catch (error) {
      console.error('Error saving resume to storage:', error);
      return false;
    }
  }

  static async clearResume() {
    try {
      await this.remove(['resumeFilename', 'resumeContent', 'resumeMimeType']);
      console.log('Resume cleared from storage');
      return true;
    } catch (error) {
      console.error('Error clearing resume from storage:', error);
      return false;
    }
  }

  // API Token methods
  static async getAPIToken() {
    try {
      const data = await this.get(['apiToken']);
      return data.apiToken || null;
    } catch (error) {
      console.error('Error getting API token from storage:', error);
      return null;
    }
  }

  static async setAPIToken(token) {
    try {
      await this.set({ apiToken: token });
      console.log('API token saved to storage');
      return true;
    } catch (error) {
      console.error('Error saving API token to storage:', error);
      return false;
    }
  }

  static async clearAPIToken() {
    try {
      await this.remove(['apiToken']);
      console.log('API token cleared from storage');
      return true;
    } catch (error) {
      console.error('Error clearing API token from storage:', error);
      return false;
    }
  }

  // Settings methods (sync storage)
  static async getSettings() {
    try {
      const data = await this.get(['theme', 'extractionMethod'], 'sync');
      return {
        theme: data.theme || 'light',
        extractionMethod: data.extractionMethod || 'standard'
      };
    } catch (error) {
      console.error('Error getting settings from storage:', error);
      return { theme: 'light', extractionMethod: 'standard' };
    }
  }

  static async setSettings(settings) {
    try {
      await this.set(settings, 'sync');
      console.log('Settings saved to storage:', settings);
      return true;
    } catch (error) {
      console.error('Error saving settings to storage:', error);
      return false;
    }
  }

  static async setSetting(key, value) {
    try {
      await this.set({ [key]: value }, 'sync');
      console.log(`Setting ${key} saved:`, value);
      return true;
    } catch (error) {
      console.error(`Error saving setting ${key}:`, error);
      return false;
    }
  }

  // Cache methods
  static async getCache(key) {
    try {
      const data = await this.get([key]);
      return data[key] || null;
    } catch (error) {
      console.error(`Error getting cache ${key}:`, error);
      return null;
    }
  }

  static async setCache(key, value, expiryHours = 24) {
    try {
      const cacheEntry = {
        data: value,
        timestamp: Date.now(),
        expiryHours: expiryHours
      };
      await this.set({ [key]: cacheEntry });
      console.log(`Cache ${key} saved with ${expiryHours}h expiry`);
      return true;
    } catch (error) {
      console.error(`Error saving cache ${key}:`, error);
      return false;
    }
  }

  static async isCacheExpired(key) {
    try {
      const cached = await this.getCache(key);
      if (!cached || !cached.timestamp) return true;
      
      const now = Date.now();
      const expiryMs = (cached.expiryHours || 24) * 60 * 60 * 1000;
      return (now - cached.timestamp) > expiryMs;
    } catch (error) {
      console.error(`Error checking cache expiry for ${key}:`, error);
      return true;
    }
  }

  static async getValidCache(key) {
    try {
      if (await this.isCacheExpired(key)) {
        console.log(`Cache ${key} expired`);
        return null;
      }
      const cached = await this.getCache(key);
      return cached?.data || null;
    } catch (error) {
      console.error(`Error getting valid cache ${key}:`, error);
      return null;
    }
  }

  static async clearCache(key) {
    try {
      await this.remove([key]);
      console.log(`Cache ${key} cleared`);
      return true;
    } catch (error) {
      console.error(`Error clearing cache ${key}:`, error);
      return false;
    }
  }

  // Utility method to get storage usage
  static async getStorageUsage(area = 'local') {
    return new Promise((resolve, reject) => {
      chrome.storage[area].getBytesInUse(null, (bytesInUse) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(bytesInUse);
        }
      });
    });
  }
}

// Make available globally for Chrome extension
/*
if (typeof window !== 'undefined') {
  window.StorageManager = StorageManager;
} else if (typeof self !== 'undefined') {
  self.StorageManager = StorageManager;
} 
*/ 