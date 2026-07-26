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

  static async canAccessCurrentTab() {
    try {
      await this.executeInActiveTab(() => true);
      return true;
    } catch (error) {
      console.warn('Cannot access current tab:', error.message);
      return false;
    }
  }
}
