/**
 * Event Handlers Module
 * Manages all event listeners and user interactions in the popup
 */

class EventHandlers {
  constructor(stateManager, uiManager, fileHandlers, resumeProcessor) {
    this.stateManager = stateManager;
    this.uiManager = uiManager;
    this.fileHandlers = fileHandlers;
    this.resumeProcessor = resumeProcessor;
    
    this.elements = this.uiManager.elements;
  }

  /**
   * Initialize all event listeners
   */
  initializeAllEvents() {
    console.log('Initializing event handlers...');
    
    // UI events (handled by UIManager)
    this.uiManager.initializeEvents();
    
    // File upload events
    this.initializeFileEvents();
    
    // API token events
    this.initializeApiTokenEvents();
    
    // Extraction method events
    this.initializeExtractionMethodEvents();
    
    // Processing events
    this.initializeProcessingEvents();
    
    // Download events
    this.initializeDownloadEvents();
    
    // State change listeners
    this.initializeStateListeners();
    
    console.log('All event handlers initialized');
  }

  /**
   * Initialize file upload and management events
   */
  initializeFileEvents() {
    // Resume upload
    if (this.elements.resumeUploadInput) {
      this.elements.resumeUploadInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
          const result = await this.fileHandlers.handleResumeUpload(file);
          console.log('File uploaded successfully:', result);
          
          // Update UI through state change listeners
          // (handled automatically by StateManager notifications)
          
        } catch (error) {
          console.error('File upload error:', error);
          this.uiManager.updateStatus(`Upload error: ${error.message}`, 'error');
          
          // Reset file input
          event.target.value = '';
        }
      });
    }

    // Clear resume button
    if (this.elements.clearResumeBtn) {
      this.elements.clearResumeBtn.addEventListener('click', async () => {
        await this.stateManager.clearResume();
        
        // Reset file input
        if (this.elements.resumeUploadInput) {
          this.elements.resumeUploadInput.value = '';
        }
        
        console.log('Resume cleared');
      });
    }

    // Download original resume button
    if (this.elements.downloadResumeBtn) {
      this.elements.downloadResumeBtn.addEventListener('click', () => {
        try {
          this.fileHandlers.downloadOriginalResume();
        } catch (error) {
          console.error('Download error:', error);
          this.uiManager.updateStatus(`Download error: ${error.message}`, 'error');
        }
      });
    }
  }

  /**
   * Initialize API token events
   */
  initializeApiTokenEvents() {
    if (this.elements.apiTokenInput) {
      this.elements.apiTokenInput.addEventListener('input', async () => {
        const token = this.elements.apiTokenInput.value.trim();
        await this.stateManager.setApiToken(token);
        
        // Update status
        if (token) {
          console.log('🔑 Successfully added Google API key');
          this.uiManager.updateApiTokenStatus('API Key entered.', true);
          this.uiManager.toggleCard(this.elements.apiKeyCard, true);
        } else {
          this.uiManager.updateApiTokenStatus('', false);
          this.uiManager.toggleCard(this.elements.apiKeyCard, false);
        }
      });
    }
  }

  /**
   * Initialize extraction method events
   */
  initializeExtractionMethodEvents() {
    // Extraction method change handlers
    const extractionMethodRadios = document.querySelectorAll('input[name="extractionMethod"]');
    extractionMethodRadios.forEach(radio => {
      radio.addEventListener('change', async (event) => {
        if (event.target.checked) {
          const method = event.target.value;
          await this.stateManager.setExtractionMethod(method);
          this.uiManager.updateExtractionMethodUI(method);
          
          console.log(`🔧 User selected ${method === 'ai' ? 'AI Powered' : 'Standard'} extraction method`);
        }
      });
    });
  }

  /**
   * Initialize processing events (resume generation, preview, auto-fill)
   */
  initializeProcessingEvents() {
    // Create resume button
    if (this.elements.createResumeBtn) {
      this.elements.createResumeBtn.addEventListener('click', async () => {
        await this.resumeProcessor.generateTailoredResume();
      });
    }

    // Preview job description button
    if (this.elements.previewBtn) {
      this.elements.previewBtn.addEventListener('click', async () => {
        await this.resumeProcessor.previewJobDescription();
      });
    }

    // Auto-fill button
    if (this.elements.autoFillBtn) {
      this.elements.autoFillBtn.addEventListener('click', async () => {
        await this.resumeProcessor.autoFillForm();
      });
    }
  }

  /**
   * Initialize download events
   */
  initializeDownloadEvents() {
    // Download DOCX
    if (this.elements.downloadDocxBtn) {
      this.elements.downloadDocxBtn.addEventListener('click', () => {
        try {
          this.fileHandlers.downloadGeneratedResume('docx');
        } catch (error) {
          console.error('DOCX download error:', error);
          this.uiManager.updateStatus(`Download error: ${error.message}`, 'error');
        }
      });
    }

    // Download PDF
    if (this.elements.downloadPdfBtn) {
      this.elements.downloadPdfBtn.addEventListener('click', () => {
        try {
          this.fileHandlers.downloadGeneratedResume('pdf');
        } catch (error) {
          console.error('PDF download error:', error);
          this.uiManager.updateStatus(`Download error: ${error.message}`, 'error');
        }
      });
    }

    // Download TXT
    if (this.elements.downloadTxtBtn) {
      this.elements.downloadTxtBtn.addEventListener('click', () => {
        try {
          this.fileHandlers.downloadGeneratedResume('txt');
        } catch (error) {
          console.error('TXT download error:', error);
          this.uiManager.updateStatus(`Download error: ${error.message}`, 'error');
        }
      });
    }
  }

  /**
   * Initialize state change listeners
   */
  initializeStateListeners() {
    // Resume state changes
    this.stateManager.subscribe('storedResume.filename', (filename) => {
      this.uiManager.updateResumeStatus(filename);
    });

    // API token state changes
    this.stateManager.subscribe('apiToken', (token) => {
      if (this.elements.apiTokenInput && this.elements.apiTokenInput.value !== token) {
        this.elements.apiTokenInput.value = token || '';
      }
      
      if (token) {
        this.uiManager.updateApiTokenStatus('Loaded from storage.', true);
        this.uiManager.toggleCard(this.elements.apiKeyCard, true);
      } else {
        this.uiManager.updateApiTokenStatus('', false);
        this.uiManager.toggleCard(this.elements.apiKeyCard, false);
      }
    });

    // Theme state changes
    this.stateManager.subscribe('currentTheme', (theme) => {
      this.uiManager.applyTheme(theme, false);
    });

    // Extraction method state changes
    this.stateManager.subscribe('selectedExtractionMethod', (method) => {
      // Update radio button
      const radio = document.querySelector(`input[name="extractionMethod"][value="${method}"]`);
      if (radio && !radio.checked) {
        radio.checked = true;
      }
      
      this.uiManager.updateExtractionMethodUI(method);
    });

    // Processing state changes
    this.stateManager.subscribe('isProcessing', (isProcessing) => {
      if (this.elements.createResumeBtn) {
        this.elements.createResumeBtn.disabled = isProcessing;
      }
    });

    this.stateManager.subscribe('isPreviewing', (isPreviewing) => {
      if (this.elements.previewBtn) {
        this.elements.previewBtn.disabled = isPreviewing;
      }
    });

    // Theme toggle event
    if (this.elements.themeToggle) {
      this.elements.themeToggle.addEventListener('change', async (event) => {
        const newTheme = event.target.checked ? 'dark' : 'light';
        console.log('Theme toggle clicked, new theme:', newTheme);
        await this.stateManager.setTheme(newTheme);
      });
    }

    // Generated resume state changes
    this.stateManager.subscribe('currentGeneratedResumeJSON', (resumeJSON) => {
      this.uiManager.toggleDownloadButtons(!!resumeJSON);
    });
  }

  /**
   * Handle keyboard shortcuts
   */
  initializeKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
      // Ctrl/Cmd + Enter to generate resume
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        if (!this.stateManager.isProcessing()) {
          this.resumeProcessor.generateTailoredResume();
        }
        event.preventDefault();
      }

      // Ctrl/Cmd + P to preview job description
      if ((event.ctrlKey || event.metaKey) && event.key === 'p') {
        if (!this.stateManager.isPreviewing()) {
          this.resumeProcessor.previewJobDescription();
        }
        event.preventDefault();
      }

      // Escape to cancel operations (if possible)
      if (event.key === 'Escape') {
        // Could implement cancellation logic here
      }
    });
  }

  /**
   * Handle window/popup events
   */
  initializeWindowEvents() {
    // Handle popup close
    window.addEventListener('beforeunload', () => {
      // Could save any unsaved state here
    });

    // Handle visibility changes
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        // Could refresh state or check for updates when popup becomes visible
      }
    });
  }

  /**
   * Handle drag and drop for file upload
   */
  initializeDragAndDrop() {
    const dropZone = this.elements.resumeCard;
    if (!dropZone) return;

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    // Highlight drop zone when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => {
        dropZone.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => {
        dropZone.classList.remove('drag-over');
      });
    });

    // Handle dropped files
    dropZone.addEventListener('drop', async (e) => {
      const files = Array.from(e.dataTransfer.files);
      const file = files[0]; // Only handle first file
      
      if (file) {
        try {
          await this.fileHandlers.handleResumeUpload(file);
        } catch (error) {
          console.error('Drag and drop upload error:', error);
          this.uiManager.updateStatus(`Upload error: ${error.message}`, 'error');
        }
      }
    });
  }

  /**
   * Handle form validation
   */
  initializeFormValidation() {
    // Real-time validation for API token
    if (this.elements.apiTokenInput) {
      this.elements.apiTokenInput.addEventListener('blur', () => {
        const token = this.elements.apiTokenInput.value.trim();
        if (token && token.length < 20) {
          this.uiManager.updateApiTokenStatus('API key seems too short', false);
        }
      });
    }


  }

  /**
   * Initialize accessibility features
   */
  initializeAccessibility() {
    // Add keyboard navigation for custom elements
    const customButtons = document.querySelectorAll('.toggle-button');
    customButtons.forEach(button => {
      button.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          button.click();
          event.preventDefault();
        }
      });
    });

    // Add ARIA labels where missing
    if (this.elements.themeToggle && !this.elements.themeToggle.getAttribute('aria-label')) {
      this.elements.themeToggle.setAttribute('aria-label', 'Toggle dark mode');
    }
  }

  /**
   * Initialize all events (main entry point)
   */
  initialize() {
    this.initializeAllEvents();
    this.initializeKeyboardShortcuts();
    this.initializeWindowEvents();
    this.initializeDragAndDrop();
    this.initializeFormValidation();
    this.initializeAccessibility();
  }

  /**
   * Cleanup event listeners (for testing or reinitializing)
   */
  cleanup() {
    // Remove global event listeners
    document.removeEventListener('keydown', this.handleKeyboardShortcuts);
    window.removeEventListener('beforeunload', this.handleWindowClose);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  /**
   * Get event handler status
   */
  getStatus() {
    return {
      initialized: true,
      elementsFound: Object.keys(this.elements).filter(key => this.elements[key]).length,
      totalElements: Object.keys(this.elements).length
    };
  }
}

// Make EventHandlers available globally for the popup
if (typeof window !== 'undefined') {
  window.EventHandlers = EventHandlers;
} 