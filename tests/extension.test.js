const fs = require('fs');
const path = require('path');

// Mock Chrome APIs before evaluating scripts
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    lastError: null
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    },
    sync: {
      get: jest.fn(),
      set: jest.fn()
    },
    onChanged: {
      addListener: jest.fn()
    }
  }
};

describe('ResumeHub Popup Unit/Integration Tests', () => {
  let stateManager;
  let uiManager;

  beforeEach(() => {
    // Reset chrome mock
    jest.clearAllMocks();
    
    // Load popup.html into the jsdom environment
    const htmlContent = fs.readFileSync(path.resolve(__dirname, '../popup.html'), 'utf8');
    document.documentElement.innerHTML = htmlContent;

    // Mock chrome.runtime.sendMessage to resolve with default settings/responses
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      if (message.action === 'getSettings') {
        callback({ theme: 'light', extractionMethod: 'standard', sidebarEnabled: true });
      } else if (message.action === 'setSetting') {
        callback({ success: true });
      } else if (message.action === 'getResume') {
        callback({ filename: null, content: null, mimeType: null });
      } else if (message.action === 'setResume') {
        callback({ success: true });
      } else if (message.action === 'getAPIToken') {
        callback({ token: 'mock-api-key' });
      } else if (message.action === 'getJobDescription') {
        callback({ success: true, jobDescription: 'Mocked standard job description text for standard extraction.' });
      } else if (message.action === 'createTailoredResume') {
        callback({ 
          success: true, 
          tailoredResumeJSON: {
            basics: { name: 'John Doe' },
            skills: ['JavaScript', 'Testing'],
            work: [{ position: 'Developer' }]
          } 
        });
      } else {
        callback({ success: true });
      }
    });

    // Mock PDFMake and other window-level libraries to avoid runtime errors during script evaluation
    global.pdfMake = { createPdf: jest.fn() };
    
    // Evaluate scripts manually to load classes on window
    const filesToLoad = [
      '../popup/storage-adapter.js',
      '../popup/state-manager.js',
      '../popup/ui-manager.js',
      '../popup/file-handlers.js',
      '../popup/resume-processor.js',
      '../popup/event-handlers.js',
      '../popup/app-controller.js'
    ];

    filesToLoad.forEach(file => {
      const filePath = path.resolve(__dirname, file);
      const code = fs.readFileSync(filePath, 'utf8');
      // Execute script in global scope
      const fn = new Function(code);
      fn();
    });

    // Initialize modules
    stateManager = new window.StateManager();
    uiManager = new window.UIManager();
    
    // Set up global references expected by modules
    window.stateManager = stateManager;
    window.uiManager = uiManager;
  });

  // Test Case 1: Dark Mode is working correctly
  test('Dark Mode is working correctly', async () => {
    // 1. Initially theme should be light
    expect(stateManager.getTheme()).toBe('light');

    // 2. Mock setting theme to dark via UI toggle or state change
    const themeToggle = document.getElementById('theme-toggle');
    expect(themeToggle).not.toBeNull();

    // Trigger theme toggle check event
    themeToggle.checked = true;
    
    // Simulate setting theme to 'dark'
    await stateManager.setTheme('dark');
    uiManager.applyTheme('dark', false);

    // 3. Document class should match theme-dark
    expect(document.documentElement.className).toBe('theme-dark');
    expect(document.body.className).toBe('theme-dark');
    expect(stateManager.getTheme()).toBe('dark');
    expect(themeToggle.checked).toBe(true);
  });

  // Test Case 2: Able to upload resume
  test('Able to upload resume', async () => {
    // Initially no resume stored
    expect(stateManager.hasResume()).toBe(false);

    const testFilename = 'resume.txt';
    const testContent = 'This is a sample resume text content.';
    const testMimeType = 'text/plain';

    // Simulate saving resume state
    await stateManager.setResume(testFilename, testContent, testMimeType);

    // Verify it is updated in stateManager
    expect(stateManager.hasResume()).toBe(true);
    expect(stateManager.getResume()).toEqual({
      filename: testFilename,
      content: testContent,
      mimeType: testMimeType
    });

    // Verify chrome message sent to background storage
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'setResume',
        data: { filename: testFilename, content: testContent, mimeType: testMimeType }
      }),
      expect.any(Function)
    );
  });

  // Test Case 3: Job extraction using standard works
  test('Job extraction using standard works', async () => {
    const resumeProcessor = new window.ResumeProcessor(stateManager, uiManager);
    
    // Set extraction method to standard
    await stateManager.setExtractionMethod('standard');
    expect(stateManager.getExtractionMethod()).toBe('standard');

    // Spy on sendBackgroundMessage or mock it
    const spySend = jest.spyOn(resumeProcessor, 'sendBackgroundMessage');

    // Call previewJobDescription
    await resumeProcessor.previewJobDescription();

    // Verify message sent to background script with 'standard' method
    expect(spySend).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'getJobDescription',
        extractionMethod: 'standard'
      })
    );

    // Verify UI is updated with the returned job description
    const previewOutput = document.getElementById('preview-jd-output');
    expect(previewOutput.value).toBe('Mocked standard job description text for standard extraction.');
  });

  // Test Case 4: Job extraction using AI works
  test('Job extraction using AI works', async () => {
    const resumeProcessor = new window.ResumeProcessor(stateManager, uiManager);
    
    // Set extraction method to AI
    await stateManager.setExtractionMethod('ai');
    expect(stateManager.getExtractionMethod()).toBe('ai');

    // Spy on sendBackgroundMessage
    const spySend = jest.spyOn(resumeProcessor, 'sendBackgroundMessage');

    // Mock chrome.runtime.sendMessage to return AI extraction mock response
    chrome.runtime.sendMessage.mockImplementationOnce((message, callback) => {
      if (message.action === 'getJobDescription') {
        callback({ success: true, jobDescription: 'Mocked AI extracted job description text.' });
      }
    });

    // Call previewJobDescription
    await resumeProcessor.previewJobDescription();

    // Verify message sent to background script with 'ai' method
    expect(spySend).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'getJobDescription',
        extractionMethod: 'ai'
      })
    );

    // Verify UI is updated with the returned AI job description
    const previewOutput = document.getElementById('preview-jd-output');
    expect(previewOutput.value).toBe('Mocked AI extracted job description text.');
  });

  // Test Case 5: Generate Tailored resume is working
  test('Generate Tailored resume is working', async () => {
    const resumeProcessor = new window.ResumeProcessor(stateManager, uiManager);

    // Set up prerequisite state: resume uploaded
    await stateManager.setResume('resume.txt', 'Developer Resume', 'text/plain');

    // Verify validation passes
    const validation = stateManager.validateForResumeGeneration();
    expect(validation.isValid).toBe(true);

    // Call generateTailoredResume
    await resumeProcessor.generateTailoredResume();

    // Verify it sent 'createTailoredResume' to background script
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'createTailoredResume',
        extractionMethod: 'standard'
      }),
      expect.any(Function)
    );

    // Verify status message is updated to success
    const statusMessage = document.getElementById('status-message');
    expect(statusMessage.textContent).toContain('Tailored resume generated successfully!');
    expect(stateManager.hasGeneratedResume()).toBe(true);
  });
});

describe('ResumeHub Right Sidebar Unit/Integration Tests', () => {
  let sidebar;

  beforeEach(async () => {
    // Reset chrome mock
    jest.clearAllMocks();

    // Mock chrome.storage.local/sync and window environment for sidebar
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      if (keys.includes('isSmallIconMode')) {
        callback({ isSmallIconMode: true });
      } else {
        callback({});
      }
    });
    chrome.storage.sync.get.mockImplementation((keys, callback) => {
      if (keys.includes('theme')) {
        callback({ theme: 'dark' });
      } else {
        callback({});
      }
    });

    // Mock window location href safely by mapping it to a global property
    window.mockLocationHref = 'https://www.linkedin.com/jobs/view/12345';

    // Mock chrome.runtime.sendMessage to resolve with default responses for right sidebar
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      if (message.action === 'getJobDescription') {
        callback({ success: true, jobDescription: 'Mocked extracted job description text from right sidebar extraction.' });
      } else if (message.action === 'getResume') {
        callback({ success: true, filename: 'test.pdf', content: 'Mocked resume text content for tailoring', mimeType: 'application/pdf' });
      } else if (message.action === 'getAPIToken') {
        callback({ token: 'mock-sidebar-api-key' });
      } else if (message.action === 'createTailoredResume') {
        callback({ 
          success: true, 
          tailoredResumeJSON: {
            basics: { name: 'John Doe Tailored' },
            skills: ['Tailored JS'],
            work: [{ position: 'Tailored Developer' }]
          } 
        });
      } else {
        callback({ success: true });
      }
    });

    // Evaluate Right Sidebar script after stripping ESM import/export statements
    const sidebarPath = path.resolve(__dirname, '../content-scripts/linkedin/components/right-sidebar.js');
    let sidebarCode = fs.readFileSync(sidebarPath, 'utf8');
    
    // Strip static imports, change export class, redirect location.href, and mock dynamic imports
    sidebarCode = sidebarCode
      .replace("import { JobInsightsManager } from './job-insights-manager.js';", '')
      .replace(/export\s+class\s+ResumeHubSidebar/g, 'class ResumeHubSidebar')
      .replace(/await\s+import\(chrome\.runtime\.getURL\([^)]+\)\)/g, '({ SELECTORS: {} })')
      .replace(/await\s+import\(src\)/g, '({ SELECTORS: {} })')
      .replace(/location\.href/g, 'window.mockLocationHref');

    // Explicitly attach class to window so it is accessible as a constructor globally
    sidebarCode += '\nwindow.ResumeHubSidebar = ResumeHubSidebar;';

    // Define dummy JobInsightsManager on window/global
    global.JobInsightsManager = class {
      constructor() {
        this.loadInsights = jest.fn().mockResolvedValue();
        this.clearCache = jest.fn();
      }
    };
    window.JobInsightsManager = global.JobInsightsManager;

    const fn = new Function(sidebarCode);
    fn();

    // Mock page scraping and tab methods to prevent JSDOM runtime selector errors
    window.ResumeHubSidebar.prototype._updateJobContext = jest.fn().mockResolvedValue();
    window.ResumeHubSidebar.prototype._getCurrentTabId = jest.fn().mockResolvedValue();
    window.ResumeHubSidebar.prototype._refreshApiStatus = jest.fn().mockResolvedValue();
    window.ResumeHubSidebar.prototype._getStoredTailoredResume = jest.fn().mockResolvedValue(null);

    // Clean up sidebar host element from document.documentElement if it exists from previous test runs
    const existingHost = document.getElementById('resumehub-right-sidebar-host');
    if (existingHost) {
      existingHost.remove();
    }
    document.body.innerHTML = '';
    
    // Instantiate Sidebar
    sidebar = new window.ResumeHubSidebar();
    await sidebar.mount();
    sidebar._wireActions();
  });

  test('Compact Icon switch text color is styled with theme text color', () => {
    const shadowRoot = sidebar.root;
    const styleElement = shadowRoot.querySelector('style');
    expect(styleElement).not.toBeNull();
    const styleText = styleElement.textContent;
    expect(styleText).toContain('.rh-feature-switch');
    expect(styleText).toContain('color: var(--rh-text)');
  });

  test('Sidebar loads isSmallIconMode and checkstate correctly without race conditions', async () => {
    // Wait for the async storage promise resolution
    await new Promise(resolve => setTimeout(resolve, 0));

    const minifyCheckbox = sidebar.root.getElementById('rh-minify-checkbox');
    const container = sidebar.root.querySelector('.rh-sidebar');

    expect(minifyCheckbox.checked).toBe(true);
    expect(container.classList.contains('rh-small-icon')).toBe(true);
  });

  test('Toggling Compact Icon switch updates storage and classList correctly', async () => {
    // Wait for the async storage promise resolution
    await new Promise(resolve => setTimeout(resolve, 0));

    const minifyCheckbox = sidebar.root.getElementById('rh-minify-checkbox');
    const container = sidebar.root.querySelector('.rh-sidebar');

    // Initially true from mockup
    expect(minifyCheckbox.checked).toBe(true);

    // Simulate clicking it (toggling it to off)
    minifyCheckbox.checked = false;
    const changeEvent = new Event('change');
    minifyCheckbox.dispatchEvent(changeEvent);

    expect(sidebar.isSmallIconMode).toBe(false);
    expect(container.classList.contains('rh-small-icon')).toBe(false);
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ isSmallIconMode: false });
  });

  test('Theme is loaded and applied correctly from sync storage', async () => {
    // Wait for async theme loader
    await new Promise(resolve => setTimeout(resolve, 0));

    const panel = sidebar.root.getElementById('rh-panel');
    const themeToggle = sidebar.root.getElementById('rh-theme-toggle');

    expect(sidebar.theme).toBe('dark');
    expect(panel.classList.contains('theme-dark')).toBe(true);
    expect(themeToggle.checked).toBe(true);
  });

  test('Extract JD button works and triggers job description extraction and updates display', async () => {
    // Spy on chrome.runtime.sendMessage
    const spySend = jest.spyOn(chrome.runtime, 'sendMessage');

    // Get the button
    const extractBtn = sidebar.root.getElementById('rh-extract');
    expect(extractBtn).not.toBeNull();

    // Trigger click
    extractBtn.click();

    // Wait for promise microtasks/ticks
    await new Promise(resolve => setTimeout(resolve, 0));

    // Verify chrome.runtime.sendMessage was called for getJobDescription
    expect(spySend).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'getJobDescription',
        extractionMethod: 'ai',
        forceRefresh: true
      }),
      expect.any(Function)
    );

    // Verify display element is updated
    const textarea = sidebar.root.getElementById('rh-extracted-jd');
    expect(textarea.value).toBe('Mocked extracted job description text from right sidebar extraction.');
  });

  test('Extract Insights button works and triggers insights loading', async () => {
    // 1. Set up a pre-extracted job description
    sidebar._lastExtractedJD = 'Mocked extracted job description text that is long enough to meet the 30 character threshold.';
    
    // Spy on loadInsights
    const spyLoadInsights = jest.spyOn(sidebar._insightsManagerInstance, 'loadInsights');

    // Get button
    const insightsBtn = sidebar.root.getElementById('rh-extract-insights');
    expect(insightsBtn).not.toBeNull();

    // Trigger click
    insightsBtn.click();

    // Wait for async events to settle
    await new Promise(resolve => setTimeout(resolve, 0));

    // Verify loadInsights was called (forced refresh = true)
    expect(spyLoadInsights).toHaveBeenCalledWith(true);

    // Verify company salary, job insights, and interview prep display block
    expect(sidebar.root.getElementById('rh-company-salary').style.display).toBe('block');
    expect(sidebar.root.getElementById('rh-job-insights').style.display).toBe('block');
    expect(sidebar.root.getElementById('rh-interview-prep').style.display).toBe('block');
  });

  test('Tailor button works and triggers tailoring process and enables download buttons', async () => {
    // Set up inputs
    sidebar._lastExtractedJD = 'Mocked extracted job description text that is long enough to meet the 30 character threshold.';
    const extractedJdTextarea = sidebar.root.getElementById('rh-extracted-jd');
    extractedJdTextarea.value = sidebar._lastExtractedJD;

    // Spy on chrome.runtime.sendMessage
    const spySend = jest.spyOn(chrome.runtime, 'sendMessage');
    
    // Mock store function
    sidebar._storeTailoredResume = jest.fn().mockResolvedValue();

    // Get button
    const tailorBtn = sidebar.root.getElementById('rh-tailor');
    expect(tailorBtn).not.toBeNull();

    // Click it
    tailorBtn.click();

    // Wait for async calls to settle
    await new Promise(resolve => setTimeout(resolve, 0));

    // Verify messages sent
    expect(spySend).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'getResume' }),
      expect.any(Function)
    );
    expect(spySend).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'getAPIToken' }),
      expect.any(Function)
    );
    expect(spySend).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'createTailoredResume',
        extractionMethod: 'ai',
        jobDescriptionOverride: sidebar._lastExtractedJD
      }),
      expect.any(Function)
    );

    // Verify stored
    expect(sidebar._storeTailoredResume).toHaveBeenCalledWith(
      expect.objectContaining({
        basics: { name: 'John Doe Tailored' }
      }),
      false
    );

    // Verify download buttons are shown
    const downloadButtons = sidebar.root.getElementById('rh-download-buttons');
    expect(downloadButtons.style.display).toBe('flex');
    expect(tailorBtn.textContent).toBe('✨ Tailor');
    expect(tailorBtn.disabled).toBe(false);
  });
});
