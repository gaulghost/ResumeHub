/**
 * Application Controller
 * Main controller that initializes and coordinates all popup modules
 */

class AppController {
  constructor() {
    this.modules = {};
    this.initialized = false;
    this.initializationPromise = null;
  }

  /**
   * Initialize the application
   */
  async initialize() {
    if (this.initialized) {
      console.log('App already initialized');
      return;
    }

    if (this.initializationPromise) {
      console.log('App initialization in progress, waiting...');
      return await this.initializationPromise;
    }

    this.initializationPromise = this._performInitialization();
    return await this.initializationPromise;
  }

  /**
   * Perform the actual initialization
   */
  async _performInitialization() {
    try {
      console.log('🚀 Starting ResumeHub popup initialization...');

      // Step 1: Initialize core modules
      await this.initializeModules();

      // Step 2: Load state from storage
      await this.loadInitialState();

      // Step 3: Initialize UI
      await this.initializeUI();

      // Step 4: Setup event handlers
      await this.initializeEventHandlers();

      // Step 5: Perform final setup
      await this.finalizeInitialization();

      this.initialized = true;
      console.log('✅ ResumeHub popup initialized successfully');

      // Perform post-initialization tasks
      this.performPostInitializationTasks();

    } catch (error) {
      console.error('❌ Failed to initialize ResumeHub popup:', error);
      this.handleInitializationError(error);
      throw error;
    }
  }

  /**
   * Initialize all modules
   */
  async initializeModules() {
    console.log('Initializing modules...');

    try {
      // Initialize StateManager first (other modules depend on it)
      this.modules.stateManager = new StateManager();
      console.log('✓ StateManager initialized');

      // Initialize UIManager
      this.modules.uiManager = new UIManager();
      console.log('✓ UIManager initialized');

      // Initialize FileHandlers (depends on StateManager)
      this.modules.fileHandlers = new FileHandlers(this.modules.stateManager);
      console.log('✓ FileHandlers initialized');

      // Initialize ResumeProcessor (depends on StateManager and UIManager)
      this.modules.resumeProcessor = new ResumeProcessor(
        this.modules.stateManager,
        this.modules.uiManager
      );
      console.log('✓ ResumeProcessor initialized');

      // Initialize EventHandlers last (depends on all other modules)
      this.modules.eventHandlers = new EventHandlers(
        this.modules.stateManager,
        this.modules.uiManager,
        this.modules.fileHandlers,
        this.modules.resumeProcessor
      );
      console.log('✓ EventHandlers initialized');

      console.log('All modules initialized successfully');

    } catch (error) {
      console.error('Error initializing modules:', error);
      throw new Error(`Module initialization failed: ${error.message}`);
    }
  }

  /**
   * Load initial state from Chrome storage
   */
  async loadInitialState() {
    console.log('Loading initial state...');

    try {
      const success = await this.modules.stateManager.loadFromStorage();
      if (success) {
        console.log('✓ Initial state loaded from storage');
      } else {
        console.log('⚠️ Could not load state from storage, using defaults');
      }
    } catch (error) {
      console.error('Error loading initial state:', error);
      // Don't throw - continue with default state
    }
  }

  /**
   * Initialize UI components
   */
  async initializeUI() {
    console.log('Initializing UI...');

    try {
      // Apply theme
      const theme = this.modules.stateManager.getTheme();
      this.modules.uiManager.applyTheme(theme, true);

      // Update UI based on current state
      this.updateUIFromState();

      console.log('✓ UI initialized');

    } catch (error) {
      console.error('Error initializing UI:', error);
      throw new Error(`UI initialization failed: ${error.message}`);
    }
  }

  /**
   * Initialize event handlers
   */
  async initializeEventHandlers() {
    console.log('Initializing event handlers...');

    try {
      this.modules.eventHandlers.initialize();
      console.log('✓ Event handlers initialized');

    } catch (error) {
      console.error('Error initializing event handlers:', error);
      throw new Error(`Event handler initialization failed: ${error.message}`);
    }
  }

  /**
   * Finalize initialization
   */
  async finalizeInitialization() {
    console.log('Finalizing initialization...');

    try {
      // Check background script availability
      const backgroundAvailable = await this.modules.resumeProcessor.checkBackgroundScript();
      if (!backgroundAvailable) {
        console.warn('⚠️ Background script not available - some features may not work');
        this.modules.uiManager.updateStatus(
          'Warning: Background script not available. Please reload the extension.',
          'warning'
        );
      }

      // Validate critical elements
      this.validateCriticalElements();

      // Setup global error handling
      this.setupGlobalErrorHandling();

      console.log('✓ Initialization finalized');

    } catch (error) {
      console.error('Error finalizing initialization:', error);
      throw new Error(`Finalization failed: ${error.message}`);
    }
  }

  /**
   * Update UI based on current state
   */
  updateUIFromState() {
    const state = this.modules.stateManager;
    const ui = this.modules.uiManager;

    // Update resume status
    const resume = state.getResume();
    ui.updateResumeStatus(resume.filename);

    // Update API token status
    const apiToken = state.getApiToken();
    if (ui.elements.apiTokenInput) {
      ui.elements.apiTokenInput.value = apiToken || '';
    }
    
    if (apiToken) {
      ui.updateApiTokenStatus('Loaded from storage.', true);
      ui.toggleCard(ui.elements.apiKeyCard, true);
    } else {
      ui.updateApiTokenStatus('', false);
      ui.toggleCard(ui.elements.apiKeyCard, false);
    }

    // Update extraction method
    const extractionMethod = state.getExtractionMethod();
    ui.updateExtractionMethodUI(extractionMethod);

    // Set radio button
    const radio = document.querySelector(`input[name="extractionMethod"][value="${extractionMethod}"]`);
    if (radio) radio.checked = true;

    // Update download buttons based on generated resume
    const hasGeneratedResume = state.hasGeneratedResume();
    ui.toggleDownloadButtons(hasGeneratedResume);
  }

  /**
   * Validate critical elements exist
   */
  validateCriticalElements() {
    const criticalElements = [
      'createResumeBtn',
      'resumeUploadInput',
      'apiTokenInput',
      'statusMessageDiv'
    ];

    // Debug: log all available elements
    console.log('Available UI elements:', Object.keys(this.modules.uiManager.elements));
    console.log('Elements status:', criticalElements.map(id => ({
      id,
      exists: !!this.modules.uiManager.elements[id],
      element: this.modules.uiManager.elements[id]
    })));

    const missing = criticalElements.filter(elementId => 
      !this.modules.uiManager.elements[elementId]
    );

    if (missing.length > 0) {
      console.error('❌ Missing elements:', missing);
      console.error('All UI Manager elements:', this.modules.uiManager.elements);
      throw new Error(`Critical UI elements missing: ${missing.join(', ')}`);
    }

    console.log('✓ All critical elements validated');
  }

  /**
   * Setup global error handling
   */
  setupGlobalErrorHandling() {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      this.modules.uiManager.updateStatus(
        'An unexpected error occurred. Please try again.',
        'error'
      );
    });

    // Handle general errors
    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error);
      // Don't show UI error for every script error, just log it
    });

    console.log('✓ Global error handling setup');
  }

  /**
   * Perform post-initialization tasks
   */
  performPostInitializationTasks() {
    // Check for updates or announcements (if needed)
    // this.checkForUpdates();

    // Log initialization metrics
    this.logInitializationMetrics();

    // Focus on appropriate element
    this.setInitialFocus();
  }

  /**
   * Log initialization metrics
   */
  logInitializationMetrics() {
    const metrics = {
      modulesLoaded: Object.keys(this.modules).length,
      elementsFound: this.modules.eventHandlers.getStatus().elementsFound,
      stateLoaded: this.modules.stateManager.hasResume() || this.modules.stateManager.hasApiToken(),
      backgroundAvailable: true // Will be updated by background check
    };

    console.log('📊 Initialization metrics:', metrics);
  }

  /**
   * Set initial focus for accessibility
   */
  setInitialFocus() {
    // Focus on the first input that needs attention
    if (!this.modules.stateManager.hasApiToken() && this.modules.uiManager.elements.apiTokenInput) {
      this.modules.uiManager.elements.apiTokenInput.focus();
    } else if (!this.modules.stateManager.hasResume() && this.modules.uiManager.elements.resumeUploadInput) {
      this.modules.uiManager.elements.resumeUploadInput.focus();
    }
  }

  /**
   * Handle initialization errors
   */
  handleInitializationError(error) {
    console.error('Initialization error details:', error);

    // Try to show error in UI if possible
    try {
      const statusDiv = document.getElementById('status-message');
      if (statusDiv) {
        statusDiv.textContent = `Initialization failed: ${error.message}`;
        statusDiv.className = 'status-message error';
      }
    } catch (uiError) {
      console.error('Could not update UI with error:', uiError);
    }

    // Disable interactive elements to prevent further errors
    this.disableInteractiveElements();
  }

  /**
   * Disable interactive elements on error
   */
  disableInteractiveElements() {
    const buttons = document.querySelectorAll('button');
    const inputs = document.querySelectorAll('input');
    
    buttons.forEach(btn => btn.disabled = true);
    inputs.forEach(input => input.disabled = true);
  }

  /**
   * Get application status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      modules: Object.keys(this.modules),
      state: this.modules.stateManager?.getSnapshot() || null,
      eventHandlers: this.modules.eventHandlers?.getStatus() || null
    };
  }

  /**
   * Restart the application (for debugging)
   */
  async restart() {
    console.log('🔄 Restarting application...');

    try {
      // Cleanup existing modules
      if (this.modules.eventHandlers) {
        this.modules.eventHandlers.cleanup();
      }

      // Reset state
      this.initialized = false;
      this.initializationPromise = null;
      this.modules = {};

      // Reinitialize
      await this.initialize();

      console.log('✅ Application restarted successfully');

    } catch (error) {
      console.error('❌ Failed to restart application:', error);
      throw error;
    }
  }

  /**
   * Cleanup and shutdown
   */
  shutdown() {
    console.log('🛑 Shutting down application...');

    try {
      if (this.modules.eventHandlers) {
        this.modules.eventHandlers.cleanup();
      }

      this.initialized = false;
      this.modules = {};

      console.log('✅ Application shutdown complete');

    } catch (error) {
      console.error('❌ Error during shutdown:', error);
    }
  }

  /**
   * Debug method to expose modules globally
   */
  exposeForDebugging() {
    if (typeof window !== 'undefined') {
      window.ResumeHubApp = {
        controller: this,
        modules: this.modules,
        status: () => this.getStatus(),
        restart: () => this.restart(),
        shutdown: () => this.shutdown()
      };
      console.log('🔧 Debug interface exposed as window.ResumeHubApp');
    }
  }
}

// Make AppController available globally but don't auto-initialize
// Let popup.js handle the initialization
if (typeof window !== 'undefined') {
  window.AppController = AppController;
} 