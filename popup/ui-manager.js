/**
 * UI Manager Module
 * Handles all UI-related operations including theme management, card toggles, and status updates
 */

class UIManager {
  constructor() {
    this.elements = this.initializeElements();
    this.state = {
      currentTheme: 'light',
      collapsedCards: new Set()
    };
  }

  /**
   * Initialize all UI elements
   */
  initializeElements() {
    return {
      // Theme
      themeToggle: document.getElementById('theme-toggle'),
      
      // Cards
      apiKeyCard: document.getElementById('api-key-card'),
      extractionCard: document.getElementById('extraction-method-card'),
      resumeCard: document.getElementById('resume-card'),
      collapsibleHeaders: document.querySelectorAll('.card-header'),
      
      // Status elements
      statusMessageDiv: document.getElementById('status-message'),
      apiTokenStatusSpan: document.getElementById('api-token-status'),
      resumeUploadStatusSpan: document.getElementById('resume-upload-status'),
      autoFillStatus: document.getElementById('auto-fill-status'),
      
      // Input elements
      apiTokenInput: document.getElementById('api-token'),
      
      // Buttons and controls
      createResumeBtn: document.getElementById('create-resume-btn'),
      previewBtn: document.getElementById('preview-jd-btn'),
      autoFillBtn: document.getElementById('auto-fill-btn'),
      clearResumeBtn: document.getElementById('clear-resume-btn'),
      downloadResumeBtn: document.getElementById('download-resume-btn'),
      
      // Download container
      downloadButtonsContainer: document.getElementById('download-buttons-container'),
      downloadDocxBtn: document.getElementById('download-docx-btn'),
      downloadPdfBtn: document.getElementById('download-pdf-btn'),
      downloadTxtBtn: document.getElementById('download-txt-btn'),
      
      // Input areas
      resumeUploadInput: document.getElementById('resume-upload'),
      previewOutput: document.getElementById('preview-jd-output'),
      
      // Theme elements
      themeContainer: document.getElementById('theme-container')
    };
  }

  /**
   * Apply theme to the interface
   */
  applyTheme(theme, isInitialLoad = false) {
    this.state.currentTheme = theme;
    
    // Apply theme to document.body like original implementation
    document.body.className = `theme-${theme}`;
    
    // Update checkbox state
    if (this.elements.themeToggle) {
      this.elements.themeToggle.checked = (theme === 'dark');
    }
    
    if (!isInitialLoad) {
      console.log('Theme applied to body:', theme);
      // Save theme preference to storage
      chrome.storage.sync.set({ theme: theme }, () => {
        console.log('Theme saved to storage:', theme);
      });
    }
  }

  /**
   * Toggle card collapse state
   */
  toggleCard(cardElement, forceCollapse = null) {
    if (!cardElement) {
      console.error('toggleCard called with null element');
      return;
    }
    
    const cardId = cardElement.id;
    const isCollapsed = cardElement.classList.contains('is-collapsed');
    const shouldCollapse = forceCollapse !== null ? forceCollapse : !isCollapsed;
    const button = cardElement.querySelector('.toggle-button');
    
    console.log(`Toggling card ${cardId}, currently collapsed: ${isCollapsed}, setting to: ${shouldCollapse}`);
    
    if (shouldCollapse) {
      cardElement.classList.add('is-collapsed');
      this.state.collapsedCards.add(cardId);
      if (button) {
        button.textContent = '▶';
        button.setAttribute('aria-expanded', 'false');
      }
    } else {
      cardElement.classList.remove('is-collapsed');
      this.state.collapsedCards.delete(cardId);
      if (button) {
        button.textContent = '▼';
        button.setAttribute('aria-expanded', 'true');
      }
    }
  }

  /**
   * Update status message with different types
   */
  updateStatus(message, type = 'info') {
    if (!this.elements.statusMessageDiv) return;
    
    this.elements.statusMessageDiv.textContent = message;
    this.elements.statusMessageDiv.className = `status-message ${type}`;
    
    console.log(`Status updated: ${type} - ${message}`);
  }

  /**
   * Update API token status
   */
  updateApiTokenStatus(message, isSuccess = false) {
    if (!this.elements.apiTokenStatusSpan) return;
    
    this.elements.apiTokenStatusSpan.textContent = message;
    this.elements.apiTokenStatusSpan.style.color = isSuccess 
      ? 'var(--color-success)' 
      : 'var(--text-secondary)';
  }

  /**
   * Update resume upload status
   */
  updateResumeStatus(filename = null) {
    if (!this.elements.resumeUploadStatusSpan) return;
    
    if (filename) {
      this.elements.resumeUploadStatusSpan.textContent = `Using: ${filename}`;
      this.elements.resumeUploadStatusSpan.style.color = 'var(--color-success)';
      
      // Show control buttons
      if (this.elements.clearResumeBtn) this.elements.clearResumeBtn.style.display = 'inline-block';
      if (this.elements.downloadResumeBtn) this.elements.downloadResumeBtn.style.display = 'inline-block';
      
      // Collapse resume card when file is loaded
      this.toggleCard(this.elements.resumeCard, true);
    } else {
      this.elements.resumeUploadStatusSpan.textContent = 'No file selected.';
      this.elements.resumeUploadStatusSpan.style.color = 'var(--text-secondary)';
      
      // Hide control buttons
      if (this.elements.clearResumeBtn) this.elements.clearResumeBtn.style.display = 'none';
      if (this.elements.downloadResumeBtn) this.elements.downloadResumeBtn.style.display = 'none';
      
      // Expand resume card when no file
      this.toggleCard(this.elements.resumeCard, false);
    }
  }

  /**
   * Update auto-fill status in its own local status area
   */
  updateAutoFillStatus(message, type = 'info') {
    if (!this.elements.autoFillStatus) return;
    
    this.elements.autoFillStatus.textContent = message;
    this.elements.autoFillStatus.className = `status-message ${type}`;
    
    console.log(`Auto-fill status updated: ${type} - ${message}`);
  }

  /**
   * Set button loading state
   */
  setButtonLoading(button, isLoading, loadingText = 'Loading...', originalText = null) {
    if (!button) return;
    
    if (isLoading) {
      // Store original text if not already stored
      if (!button.dataset.originalText) {
        button.dataset.originalText = button.textContent;
      }
      button.disabled = true;
      button.classList.add('button-loading');
      if (loadingText) button.textContent = loadingText;
    } else {
      button.disabled = false;
      button.classList.remove('button-loading');
      // Restore original text
      const textToRestore = originalText || button.dataset.originalText || 'Button';
      button.textContent = textToRestore;
      // Clean up stored text
      delete button.dataset.originalText;
    }
  }

  /**
   * Show/hide download buttons
   */
  toggleDownloadButtons(show = false) {
    if (!this.elements.downloadButtonsContainer) return;
    
    this.elements.downloadButtonsContainer.style.display = show ? 'block' : 'none';
    
    // Enable/disable individual download buttons
    const buttons = [
      this.elements.downloadDocxBtn,
      this.elements.downloadPdfBtn,
      this.elements.downloadTxtBtn
    ];
    
    buttons.forEach(btn => {
      if (btn) btn.disabled = !show;
    });
  }

  /**
   * Handle extraction method UI changes
   */
  updateExtractionMethodUI(method) {
    // Collapse extraction card when method is selected (since manual option removed)
    this.toggleCard(this.elements.extractionCard, true);
  }

  /**
   * Initialize card collapse event listeners
   */
  initializeCardEvents() {
    this.elements.collapsibleHeaders.forEach(header => {
      header.addEventListener('click', (event) => {
        const isToggleButton = event.target.classList.contains('toggle-button');
        
        // Only proceed if click wasn't on input/textarea/select OR if it was the toggle button
        if (!event.target.closest('input, textarea, select') || isToggleButton) {
          const card = header.closest('.collapsible');
          if (card) {
            this.toggleCard(card);
          }
        }
      });
    });
  }

  /**
   * Initialize theme toggle event listener
   */
  initializeThemeEvents() {
    if (this.elements.themeToggle) {
      this.elements.themeToggle.addEventListener('change', (event) => {
        const newTheme = event.target.checked ? 'dark' : 'light';
        console.log('Theme toggle clicked, new theme:', newTheme);
        this.applyTheme(newTheme);
      });
      console.log('Theme toggle event listener initialized');
    } else {
      console.error('Theme toggle element not found!');
    }
  }

  /**
   * Initialize all UI event listeners
   */
  initializeEvents() {
    this.initializeCardEvents();
    this.initializeThemeEvents();
  }

  /**
   * Get current theme
   */
  getCurrentTheme() {
    return this.state.currentTheme;
  }

  /**
   * Check if card is collapsed
   */
  isCardCollapsed(cardId) {
    return this.state.collapsedCards.has(cardId);
  }
}

// Make UIManager available globally for the popup
if (typeof window !== 'undefined') {
  window.UIManager = UIManager;
} 