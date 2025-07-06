// Unified script injector for Chrome scripting operations
export class ScriptInjector {
  static async executeInActiveTab(func, args = []) {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(`Tab query failed: ${chrome.runtime.lastError.message}`));
        }
        
        if (!tabs[0]?.id) {
          return reject(new Error("No active tab found"));
        }

        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: func,
          args: args
        }, (results) => {
          if (chrome.runtime.lastError) {
            return reject(new Error(`Script execution failed: ${chrome.runtime.lastError.message}`));
          }
          
          if (results && results[0] && results[0].result !== undefined) {
            resolve(results[0].result);
          } else {
            reject(new Error("Script execution returned no results"));
          }
        });
      });
    });
  }

  static async getPageText() {
    console.log("Getting page text content...");
    return this.executeInActiveTab(() => {
      return document.body.innerText || document.documentElement.innerText || '';
    });
  }

  static async extractJobDescriptionStandard() {
    console.log("Running standard job description extraction...");
    return this.executeInActiveTab(() => {
      const selectors = [
        // Common High-Level Containers
        '#job-description', '.job-description',
        '[class*="job-details"]', '[class*="jobDescription"]', '[class*="jobdesc"]', 
        '[aria-label*="description"]', '[data-testid*="description"]',
        // Specific Job Boards
        '.jobsearch-JobComponent-description', // Indeed
        '.jobs-description-content__text', // LinkedIn
        '#job_details', // LinkedIn (alternative)
        '.jobdesciptioncontent', '.jobDescriptionContent', // Greenhouse
        'section[data-qa="job-description"]', // Lever
        '.job-details-content', // SmartRecruiters
        '.ats-description-wrapper', // Ashby
        // Generic Content Areas
        '.content .description', 'article .job-body' 
      ];

      console.log("Testing selectors for job description...");
      for (const selector of selectors) {
        try {
          const element = document.querySelector(selector);
          if (element && element.innerText?.trim()?.length > 100) {
            console.log(`Found job description with selector: ${selector}`);
            return element.innerText;
          }
        } catch (e) {
          console.warn(`Error with selector ${selector}:`, e.message);
        }
      }

      console.warn('No specific job description found, trying main content...');
      const mainElement = document.querySelector('main');
      if (mainElement && mainElement.innerText?.trim()?.length > 100) {
        return mainElement.innerText;
      }

      // Last resort - get body text (limited)
      const bodyText = document.body.innerText;
      if (bodyText && bodyText.length > 100) {
        return bodyText.substring(0, 50000); // Limit size
      }

      return null;
    });
  }

  static async getFormFields() {
    console.log("Getting form fields from page...");
    return this.executeInActiveTab(() => {
      // Helper functions defined inside the injected script
      function findFieldLabel(field) {
        // Try to find label by 'for' attribute
        if (field.id) {
          const labelElement = document.querySelector(`label[for="${field.id}"]`);
          if (labelElement) {
            return labelElement.textContent.trim();
          }
        }
        
        // Try to find label by proximity
        const parent = field.parentElement;
        if (parent) {
          // Look for label as sibling
          const label = parent.querySelector('label');
          if (label) {
            return label.textContent.trim();
          }
          
          // Look for text content in parent (excluding field value)
          const parentText = parent.textContent.replace(field.value, '').trim();
          if (parentText.length > 0 && parentText.length < 100) {
            return parentText.substring(0, 50);
          }
        }
        
        return '';
      }

      function generateSelector(field, index) {
        if (field.id) return `#${field.id}`;
        if (field.name) return `[name="${field.name}"]`;
        return `${field.tagName.toLowerCase()}:nth-of-type(${index + 1})`;
      }

      const formFields = [];
      const inputs = document.querySelectorAll('input, textarea, select');
      
      inputs.forEach((field, index) => {
        // Skip hidden, submit, and button inputs
        if (field.type === 'hidden' || field.type === 'submit' || field.type === 'button') {
          return;
        }
        
        const fieldInfo = {
          id: field.id || `field_${index}`,
          name: field.name || '',
          type: field.type || field.tagName.toLowerCase(),
          placeholder: field.placeholder || '',
          label: '',
          selector: '',
          value: field.value || ''
        };
        
        // Find associated label
        fieldInfo.label = findFieldLabel(field);
        fieldInfo.selector = generateSelector(field, index);
        
        formFields.push(fieldInfo);
      });
      
      return formFields;
    });
  }

  static async fillFormFields(fieldMappings) {
    console.log(`Filling ${fieldMappings.length} form fields...`);
    return this.executeInActiveTab((mappings) => {
      let filledCount = 0;
      
      for (const mapping of mappings) {
        try {
          const element = document.querySelector(mapping.fieldSelector);
          if (element && element.value !== undefined) {
            // Set the value
            element.value = mapping.fieldValue;
            
            // Trigger events to notify the page of the change
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            element.dispatchEvent(new Event('blur', { bubbles: true }));
            
            filledCount++;
            console.log(`Filled field: ${mapping.fieldSelector} = ${mapping.fieldValue}`);
          } else {
            console.warn(`Field not found or not fillable: ${mapping.fieldSelector}`);
          }
        } catch (error) {
          console.warn(`Failed to fill field ${mapping.fieldSelector}:`, error);
        }
      }
      
      return { fieldsFilled: filledCount };
    }, [fieldMappings]);
  }

  // Utility method to check if we can access the current tab
  static async canAccessCurrentTab() {
    try {
      await this.executeInActiveTab(() => true);
      return true;
    } catch (error) {
      console.warn('Cannot access current tab:', error.message);
      return false;
    }
  }

  // Utility method to get basic page info
  static async getPageInfo() {
    return this.executeInActiveTab(() => {
      return {
        title: document.title,
        url: window.location.href,
        domain: window.location.hostname,
        hasJobForms: document.querySelectorAll('input, textarea').length > 5,
        textLength: document.body.innerText?.length || 0
      };
    });
  }

  // Method to inject CSS for visual feedback
  static async injectCSS(css) {
    return this.executeInActiveTab((cssText) => {
      const style = document.createElement('style');
      style.textContent = cssText;
      document.head.appendChild(style);
      return true;
    }, [css]);
  }

  // Method to highlight filled fields temporarily
  static async highlightFilledFields(fieldSelectors, duration = 3000) {
    const highlightCSS = `
      .resumehub-filled {
        background-color: #e8f5e8 !important;
        border: 2px solid #4caf50 !important;
        transition: all 0.3s ease;
      }
    `;
    
    await this.injectCSS(highlightCSS);
    
    await this.executeInActiveTab((selectors, highlightDuration) => {
      selectors.forEach(selector => {
        const element = document.querySelector(selector);
        if (element) {
          element.classList.add('resumehub-filled');
          setTimeout(() => {
            element.classList.remove('resumehub-filled');
          }, highlightDuration);
        }
      });
    }, [fieldSelectors, duration]);
  }
}

// Make available globally for Chrome extension
/*
if (typeof window !== 'undefined') {
  window.ScriptInjector = ScriptInjector;
} else if (typeof self !== 'undefined') {
  self.ScriptInjector = ScriptInjector;
} else if (typeof global !== 'undefined') {
  global.ScriptInjector = ScriptInjector;
} else {
  // For service workers and other environments
  this.ScriptInjector = ScriptInjector;
}
*/