/**
 * Resume Processor Module
 * Handles resume generation, job description extraction, and auto-fill operations
 */

class ResumeProcessor {
  constructor(stateManager, uiManager) {
    this.stateManager = stateManager;
    this.uiManager = uiManager;
  }

  /**
   * Generate tailored resume
   */
  async generateTailoredResume() {
    try {
      // Validate state
      const validation = this.stateManager.validateForResumeGeneration();
      if (!validation.isValid) {
        throw new Error(validation.errors[0]);
      }

      // Check if already processing
      if (this.stateManager.isProcessing()) {
        console.log('Resume generation already in progress');
        return;
      }

      // Set processing state
      this.stateManager.setProcessing(true);
      this.uiManager.setButtonLoading(
        this.uiManager.elements.createResumeBtn, 
        true, 
        'Generating...'
      );
      console.log('Generate button set to loading state');

      // Clear previous results
      this.uiManager.updateStatus('', 'info');
      this.uiManager.toggleDownloadButtons(false);
      this.stateManager.clearGeneratedResume();

      // Get job description
      const jobDescription = await this.getJobDescriptionForGeneration();
      const methodForStatus = this.getMethodForStatus(jobDescription);

      // Update status
      this.uiManager.updateStatus(
        `Processing (using ${methodForStatus})... Generating a tailored resume with max 570 words, focusing on most relevant skills`,
        'processing'
      );

      console.log(`Sending request to background (method: ${methodForStatus})...`);

      // Send message to background script
      const response = await this.sendBackgroundMessage({
        action: "createTailoredResume",
        resumeData: this.stateManager.getResume(),
        apiToken: this.stateManager.getApiToken(),
        jobDescriptionOverride: jobDescription.override,
        extractionMethod: this.stateManager.getExtractionMethod()
      });

      // Handle response
      await this.handleGenerationResponse(response);

    } catch (error) {
      console.error('Error generating tailored resume:', error);
      this.handleGenerationError(error);
    } finally {
      // Reset processing state
      this.stateManager.setProcessing(false);
      this.uiManager.setButtonLoading(
        this.uiManager.elements.createResumeBtn, 
        false
      );
      console.log('Generate button loading state reset');
    }
  }

  /**
   * Get job description for generation
   */
  async getJobDescriptionForGeneration() {
    const previewText = this.uiManager.elements.previewOutput?.value.trim() || '';
    const placeholderText = this.uiManager.elements.previewOutput?.placeholder || '';
    
    // Check if preview text is user input
    const isPreviewTextUserInput = previewText && 
      previewText !== placeholderText && 
      !previewText.startsWith('Attempting extraction...') &&
      !previewText.startsWith('Error:') &&
      !previewText.startsWith('[No description extracted]');

    if (isPreviewTextUserInput) {
      console.log('Using job description from preview/edit area.');
      return { override: previewText, method: 'Preview/Edited Text' };
    }

    // Manual input method removed - only preview area available for manual editing
    const extractionMethod = this.stateManager.getExtractionMethod();

    // Use background extraction
    console.log(`Using background extraction method: ${extractionMethod}`);
    return { override: null, method: extractionMethod };
  }

  /**
   * Get method name for status display
   */
  getMethodForStatus(jobDescription) {
    if (jobDescription.override) {
      return jobDescription.method;
    }
    return this.stateManager.getExtractionMethod();
  }

  /**
   * Handle generation response
   */
  async handleGenerationResponse(response) {
    if (response && response.success && response.tailoredResumeJSON) {
      console.log("Received successful JSON response from background script.");
      
      // Store generated resume
      this.stateManager.setGeneratedResume(response.tailoredResumeJSON);
      
      // Update UI
      this.uiManager.updateStatus('Tailored resume generated successfully!', 'success');
      this.uiManager.toggleDownloadButtons(true);
      
      console.log("Stored tailored resume JSON:", response.tailoredResumeJSON);
      
    } else if (response && response.error) {
      throw new Error(response.error);
    } else {
      throw new Error('Unknown error or invalid response format. Check console.');
    }
  }

  /**
   * Handle generation error
   */
  handleGenerationError(error) {
    this.uiManager.updateStatus(`Error: ${error.message}`, 'error');
    this.stateManager.clearGeneratedResume();
  }

  /**
   * Preview job description
   */
  async previewJobDescription() {
    try {
      // Check if already previewing
      if (this.stateManager.isPreviewing()) {
        console.log('Job description preview already in progress');
        return;
      }

      // Set previewing state
      this.stateManager.setPreviewing(true);
      this.uiManager.setButtonLoading(
        this.uiManager.elements.previewBtn,
        true,
        'Loading...'
      );
      console.log('Preview button set to loading state');

      // Clear previous preview
      if (this.uiManager.elements.previewOutput) {
        this.uiManager.elements.previewOutput.value = 'Attempting extraction...';
        this.uiManager.elements.previewOutput.style.color = 'var(--text-secondary)';
      }

      const extractionMethod = this.stateManager.getExtractionMethod();
      const apiToken = this.stateManager.getApiToken();

      // Validate API token for AI method
      if (extractionMethod === 'ai' && !apiToken) {
        throw new Error('API Key is required for AI extraction preview.');
      }

      console.log(`Starting job description preview (method: ${extractionMethod})...`);

      // Send message to background script
      const response = await this.sendBackgroundMessage({
        action: "getJobDescription",
        apiToken: apiToken,
        extractionMethod: extractionMethod
      });

      // Handle response
      this.handlePreviewResponse(response);

    } catch (error) {
      console.error('Error previewing job description:', error);
      this.handlePreviewError(error);
    } finally {
      // Reset previewing state
      this.stateManager.setPreviewing(false);
      this.uiManager.setButtonLoading(
        this.uiManager.elements.previewBtn,
        false
      );
      console.log('Preview button loading state reset');
    }
  }

  /**
   * Handle preview response
   */
  handlePreviewResponse(response) {
    if (response && response.success && response.jobDescription) {
      console.log('Job description extracted successfully');
      
      if (this.uiManager.elements.previewOutput) {
        this.uiManager.elements.previewOutput.value = response.jobDescription;
        this.uiManager.elements.previewOutput.style.color = 'var(--text-primary)';
      }
      
    } else if (response && response.error) {
      throw new Error(response.error);
    } else {
      throw new Error('No job description received from extraction');
    }
  }

  /**
   * Handle preview error
   */
  handlePreviewError(error) {
    console.error('Preview error:', error);
    
    if (this.uiManager.elements.previewOutput) {
      this.uiManager.elements.previewOutput.value = `Error: ${error.message}`;
      this.uiManager.elements.previewOutput.style.color = 'var(--color-error)';
    }
  }

  /**
   * Auto-fill form
   */
  async autoFillForm() {
    try {
      // Validate state
      const validation = this.stateManager.validateForAutoFill();
      if (!validation.isValid) {
        this.uiManager.updateAutoFillStatus(`❌ Error: ${validation.errors[0]}`, 'error');
        return;
      }

      // Set loading state
      this.uiManager.setButtonLoading(
        this.uiManager.elements.autoFillBtn,
        true,
        'Processing...'
      );
      console.log('Auto-fill button set to loading state');

      // Update auto-fill status in its local area
      this.uiManager.updateAutoFillStatus('🔄 Analyzing form fields and filling data...', 'processing');

      console.log('Starting auto-fill process...');

      // Send message to background script
      const response = await this.sendBackgroundMessage({
        action: "autoFillForm",
        resumeData: this.stateManager.getResume(),
        apiToken: this.stateManager.getApiToken()
      });

      // Handle response
      this.handleAutoFillResponse(response);

    } catch (error) {
      console.error('Error auto-filling form:', error);
      this.handleAutoFillError(error);
    } finally {
      // Reset loading state
      this.uiManager.setButtonLoading(
        this.uiManager.elements.autoFillBtn,
        false
      );
      console.log('Auto-fill button loading state reset');
    }
  }

  /**
   * Handle auto-fill response
   */
  handleAutoFillResponse(response) {
    if (response && response.success) {
      const message = `✅ Form auto-filled successfully! ${response.fieldsFound || 0} fields detected, ${response.fieldsFilled || 0} fields filled.`;
      
      this.uiManager.updateAutoFillStatus(message, 'success');
      console.log('Auto-fill completed successfully:', response);
      
    } else if (response && response.error) {
      throw new Error(response.error);
    } else {
      throw new Error('Unknown error during auto-fill process');
    }
  }

  /**
   * Handle auto-fill error
   */
  handleAutoFillError(error) {
    this.uiManager.updateAutoFillStatus(`❌ Error: ${error.message}`, 'error');
  }

  /**
   * Send message to background script
   */
  sendBackgroundMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Validate job description text
   */
  validateJobDescription(text, minLength = 50) {
    if (!text || typeof text !== 'string') {
      return { isValid: false, error: 'Job description is required' };
    }

    const trimmed = text.trim();
    if (trimmed.length < minLength) {
      return { isValid: false, error: `Job description is too short (minimum ${minLength} characters)` };
    }

    // Check for placeholder text
    const placeholderTexts = [
      'Attempting extraction...',
      'Error:',
      '[No description extracted]',
      'Preview not applicable'
    ];

    if (placeholderTexts.some(placeholder => trimmed.startsWith(placeholder))) {
      return { isValid: false, error: 'Please provide a valid job description' };
    }

    return { isValid: true };
  }

  /**
   * Get extraction method display name
   */
  getExtractionMethodDisplayName(method) {
    const names = {
      'standard': 'Standard DOM Extraction',
      'ai': 'AI-Powered Extraction'
    };
    return names[method] || method;
  }

  /**
   * Check if background script is available
   */
  async checkBackgroundScript() {
    try {
      const response = await this.sendBackgroundMessage({ action: 'ping' });
      return response !== undefined;
    } catch (error) {
      console.error('Background script not available:', error);
      return false;
    }
  }

  /**
   * Get processing status
   */
  getProcessingStatus() {
    return {
      isProcessing: this.stateManager.isProcessing(),
      isPreviewing: this.stateManager.isPreviewing(),
      hasGeneratedResume: this.stateManager.hasGeneratedResume()
    };
  }
}

// Make ResumeProcessor available globally for the popup
if (typeof window !== 'undefined') {
  window.ResumeProcessor = ResumeProcessor;
} 