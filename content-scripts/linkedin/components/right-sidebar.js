// ResumeHub Right Sidebar (Shadow DOM)
// Provides a collapsible right dock similar to LeetHub's right bar, scoped to Shadow DOM.

import { JobInsightsManager } from './job-insights-manager.js';

export class ResumeHubSidebar {
  constructor(options = {}) {
    this.options = options;
    this.hostId = 'resumehub-right-sidebar-host';
    this.root = null; // ShadowRoot
    this.expanded = false;
    this.theme = 'light';
    this.lastUrl = location.href;
    this.mutationObserver = null;
    this.selectors = null; // Loaded lazily
    this._dragJustHappened = false;
    this._lastJobSig = '';
    this._lastExtractedJobSig = ''; // Track last extracted job to avoid duplicates
    this._isTailoring = false; // Track if tailoring is in progress
    this._currentTabId = null; // Track current tab ID for storage
    // Job insights manager (lazy initialization)
    this._insightsManager = null;
  }

  /**
   * Get or initialize insights manager
   */
  get _insightsManagerInstance() {
    if (!this._insightsManager) {
      this._insightsManager = new JobInsightsManager(this);
    }
    return this._insightsManager;
  }

  _initDrag() {
    const host = this.root?.host;
    const toggle = this.root.getElementById('rh-toggle');
    const header = this.root.getElementById('rh-header') || this.root.getElementById('rh-close')?.parentElement;
    if (!host) return;

    let startY = 0;
    let startTop = 0;
    let dragging = false;
    let dragMoved = false;
    const DRAG_THRESHOLD = 4;

    const onStart = (e) => {
      dragging = true;
      dragMoved = false;
      startY = e.touches ? e.touches[0].clientY : e.clientY;
      const rect = host.getBoundingClientRect();
      // Normalize positioning to pixel top with no transform
      host.style.top = `${rect.top}px`;
      host.style.transform = 'none';
      startTop = rect.top;
      window.addEventListener('mousemove', onMove);
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('mouseup', onEnd);
      window.addEventListener('touchend', onEnd);
    };

    const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

    const onMove = (e) => {
      if (!dragging) return;
      const y = e.touches ? e.touches[0].clientY : e.clientY;
      const dy = y - startY;
      if (Math.abs(dy) > DRAG_THRESHOLD) dragMoved = true;
      const hostH = host.getBoundingClientRect().height;
      const vh = window.innerHeight;
      const margin = 8;
      const newTop = clamp(startTop + dy, margin, Math.max(margin, vh - hostH - margin));
      host.style.top = `${newTop}px`;
      if (e.cancelable) e.preventDefault();
    };

    const onEnd = () => {
      dragging = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchend', onEnd);
      this._ensureInViewport();
      if (dragMoved) {
        this._dragJustHappened = true;
        setTimeout(() => { this._dragJustHappened = false; }, 150);
      }
    };

    // Drag from collapsed tab and expanded header
    if (toggle) {
      toggle.addEventListener('mousedown', onStart);
      toggle.addEventListener('touchstart', onStart, { passive: true });
    }
    const headerEl = this.root.querySelector('.rh-header');
    if (headerEl) {
      headerEl.addEventListener('mousedown', onStart);
      headerEl.addEventListener('touchstart', onStart, { passive: true });
    }

    // Keep in viewport on resize
    window.addEventListener('resize', () => this._ensureInViewport());
  }

  _ensureInViewport() {
    const host = this.root?.host;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const vh = window.innerHeight;
    const margin = 8;
    let top = rect.top;
    const maxTop = Math.max(margin, vh - rect.height - margin);
    const minTop = margin;
    if (top < minTop) top = minTop;
    if (top > maxTop) top = maxTop;
    host.style.top = `${top}px`;
  }

  async mount() {
    if (document.getElementById(this.hostId)) {
      // Already mounted
      return;
    }

    // Create host
    const host = document.createElement('div');
    host.id = this.hostId;
    host.style.position = 'fixed';
    host.style.top = '0';
    host.style.right = '0';
    host.style.zIndex = '2147483646'; // Just under max to avoid LinkedIn overlays
    host.style.height = '100vh';
    host.style.pointerEvents = 'auto'; // Host accepts events; internal container manages pass-through
    host.style.width = '48px'; // Prevent host from covering the page

    // Shadow root
    const shadow = host.attachShadow({ mode: 'open' });
    this.root = shadow;

    // Build UI
    const style = document.createElement('style');
    style.textContent = this._css();

    const container = document.createElement('div');
    container.className = 'rh-sidebar collapsed theme-light';
    container.innerHTML = this._html();

    shadow.appendChild(style);
    shadow.appendChild(container);
    document.documentElement.appendChild(host);

    // Initial collapsed positioning (smaller and vertically centered numerically)
    host.style.height = '30vh';
    host.style.transform = 'none';
    host.style.width = '48px';
    // After applying height, compute a centered top
    const initRect = host.getBoundingClientRect();
    const initTop = Math.max(8, Math.round((window.innerHeight - initRect.height) / 2));
    host.style.top = `${initTop}px`;

    // Wire events
    this._wireEvents();

    // Enable drag
    this._initDrag();

    // Load theme setting and sync with storage changes
    this._loadTheme();
    
    // Listen for theme changes from popup or other tabs
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes.theme) {
        const newTheme = changes.theme.newValue || 'light';
        this._applyTheme(newTheme);
      }
    });

    // Load API token status
    this._refreshApiStatus();

    // Setup collapsible sections
    this._setupCollapsibleSections();

    // Setup resume context persistence
    this._setupContextPersistence();

    // Initialize AI mode controls and filters
    // await this._initAIModeControls(); // REMOVED

    // Observe page for changes to update job context
    this._startObservers();

    // Listen for messages from background script
    // this._setupMessageListener(); // REMOVED as it was for auto-tailor

    // Initial job context
    await this._updateJobContext();

    // Get current tab ID for storage (must be awaited before using _currentTabId)
    await this._getCurrentTabId();
    
    // Check if we already have a tailored resume for this tab
    this._checkExistingTailoredResume();
    
    // Start polling for auto-tailored resumes (check every 2 seconds)
    // this._startAutoTailorPolling(); // REMOVED
  }



  async _checkExistingTailoredResume() {
    try {
      const storedResume = await this._getStoredTailoredResume();
      if (storedResume) {
        // Check if it's auto-tailored
        const isAutoTailor = storedResume._isAutoTailor || false;
        // Show download buttons for both manual and auto-tailored resumes
        this._toggleDownloadButtons(true);
      }
    } catch (e) {
      // Ignore errors
    }
  }



  destroy() {
    try {
      if (this._onKeyDown) {
        window.removeEventListener('keydown', this._onKeyDown);
        this._onKeyDown = null;
      }
      if (this.mutationObserver) this.mutationObserver.disconnect();
      const host = document.getElementById(this.hostId);
      if (host && host.parentNode) host.parentNode.removeChild(host);
      this.root = null;
    } catch (e) {
      // no-op
    }
  }

  async onNavigate() {
    if (this.lastUrl !== location.href) {
      this.lastUrl = location.href;
      await this._updateJobContext();
    }
  }

  // ----------------- Internal -----------------

  _css() {
    return `
      :host { all: initial; }
      *, *::before, *::after { box-sizing: border-box; }

      /* Modern Design System - Shared with Popup */
      :host, .rh-sidebar {
        --rh-width-collapsed: 48px;
        --rh-width-expanded: 380px;
        --rh-header-height: 56px;
        --rh-footer-height: 60px;
        /* Colors - Light Theme (matching design-tokens.css) */
        --rh-bg: #ffffff;
        --rh-bg-2: #f8fafc;
        --rh-bg-3: #f1f5f9;
        --rh-text: #0f172a;
        --rh-text-secondary: #475569;
        --rh-subtle: #64748b;
        --rh-border: #e2e8f0;
        --rh-border-light: #f1f5f9;
        --rh-input-bg: #ffffff;
        /* Shadows - Modern layered shadows */
        --rh-shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.05);
        --rh-shadow-md: 0 4px 6px -1px rgba(15, 23, 42, 0.1), 0 2px 4px -1px rgba(15, 23, 42, 0.06);
        --rh-shadow-lg: 0 10px 15px -3px rgba(15, 23, 42, 0.1), 0 4px 6px -2px rgba(15, 23, 42, 0.05);
        --rh-shadow-xl: 0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 10px 10px -5px rgba(15, 23, 42, 0.04);
        /* Accent Colors */
        --rh-accent: #3b82f6;
        --rh-accent-hover: #2563eb;
        --rh-accent-light: #dbeafe;
        /* Semantic Colors */
        --rh-success: #10b981;
        --rh-success-light: #d1fae5;
        --rh-warning: #f59e0b;
        --rh-danger: #ef4444;
        /* Glass effects */
        --rh-glass: rgba(248, 250, 252, 0.8);
        --rh-glass-dark: rgba(15, 23, 42, 0.6);
        /* Border Radius */
        --rh-radius: 12px;
        --rh-radius-lg: 16px;
        --rh-radius-sm: 8px;
        /* Typography */
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', sans-serif;
        --rh-font-size-base: 14px;
        --rh-font-size-sm: 12px;
        --rh-font-size-lg: 16px;
        /* Transitions */
        --rh-transition-fast: 0.15s ease;
        --rh-transition-base: 0.2s ease;
        --rh-transition-slow: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      /* Hide collapsed tab when expanded */
      .expanded .rh-collapsed-tab { display: none; }
      /* Hide panel entirely when collapsed so it doesn't affect layout */
      .collapsed .rh-panel { display: none; }

      .rh-sidebar.theme-dark, .theme-dark {
        /* Dark Theme (matching design-tokens.css) */
        --rh-bg: #0f172a;
        --rh-bg-2: #1e293b;
        --rh-bg-3: #334155;
        --rh-text: #f8fafc;
        --rh-text-secondary: #cbd5e1;
        --rh-subtle: #94a3b8;
        --rh-border: #334155;
        --rh-border-light: #475569;
        --rh-input-bg: #1e293b;
        --rh-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.2);
        --rh-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2);
        --rh-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2);
        --rh-shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.3);
        --rh-accent: #60a5fa;
        --rh-accent-hover: #3b82f6;
        --rh-accent-light: #1e3a8a;
        --rh-glass: rgba(15, 23, 42, 0.8);
      }

      .rh-sidebar {
        position: absolute;
        inset: 0;
        height: 100%;
        display: flex;
        align-items: stretch;
        pointer-events: none; /* container ignores events so clicks pass through */
        /* The child interactive pieces re-enable pointer-events */
      }

      .rh-sidebar .rh-collapsed-tab,
      .rh-sidebar .rh-panel {
        pointer-events: auto; /* UI accepts interactions */
      }

      .rh-sidebar.collapsed {
        width: var(--rh-width-collapsed);
      }

      .rh-sidebar.expanded {
        width: var(--rh-width-expanded);
      }

      /* Modern collapsed tab - improved visibility */
      .rh-collapsed-tab {
        width: var(--rh-width-collapsed);
        flex: 0 0 var(--rh-width-collapsed);
        min-width: var(--rh-width-collapsed);
        flex-shrink: 0;
        background: linear-gradient(135deg, var(--rh-bg) 0%, var(--rh-bg-2) 100%);
        border: 1px solid var(--rh-border);
        border-right: none;
        border-radius: var(--rh-radius) 0 0 var(--rh-radius);
        box-shadow: var(--rh-shadow-lg), inset 0 1px 0 rgba(255, 255, 255, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        user-select: none;
        backdrop-filter: blur(20px) saturate(180%);
        height: 100%;
        align-self: center;
        position: relative;
        overflow: hidden;
        transition: all var(--rh-transition-slow);
      }

      .rh-collapsed-tab:hover {
        background: linear-gradient(135deg, var(--rh-bg-2) 0%, var(--rh-bg-3) 100%);
        box-shadow: var(--rh-shadow-xl), inset 0 1px 0 rgba(255, 255, 255, 0.2);
        transform: scale(1.02);
      }

      .rh-collapsed-tab::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(90deg, var(--rh-accent), var(--rh-success));
        opacity: 0;
        transition: opacity var(--rh-transition-base);
        border-radius: var(--rh-radius) var(--rh-radius) 0 0;
      }

      .rh-collapsed-tab:hover::before {
        opacity: 1;
      }

      .rh-tab-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 4px 0;
      }

      .rh-tab-icon {
        width: 18px;
        height: 18px;
        background: linear-gradient(135deg, var(--rh-accent), var(--rh-success));
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        color: white;
        font-weight: 700;
        transition: all var(--rh-transition-base);
        box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
      }

      .rh-collapsed-tab:hover .rh-tab-icon {
        transform: scale(1.1) rotate(5deg);
        box-shadow: 0 4px 8px rgba(59, 130, 246, 0.4);
      }

      .rh-tab-label {
        writing-mode: vertical-rl;
        text-orientation: mixed;
        transform: rotate(180deg);
        font-size: 10px;
        font-weight: 600;
        color: var(--rh-text-secondary);
        letter-spacing: 0.8px;
        transition: all var(--rh-transition-base);
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
      }

      .rh-collapsed-tab:hover .rh-tab-label {
        color: var(--rh-text);
        transform: rotate(180deg) scale(1.05);
      }

      /* Modern panel */
      .rh-panel {
        width: var(--rh-width-expanded);
        flex: 0 0 var(--rh-width-expanded);
        height: 100%;
        background: var(--rh-bg);
        border: 1px solid var(--rh-border);
        border-radius: var(--rh-radius-lg);
        box-shadow: var(--rh-shadow-xl);
        display: flex;
        position: relative;
        flex-direction: column;
        opacity: 0;
        visibility: hidden;
        transform: translateX(20px);
        transition: all var(--rh-transition-slow);
        backdrop-filter: blur(20px) saturate(180%);
        overflow: hidden;
      }
      .expanded .rh-panel {
        opacity: 1;
        visibility: visible;
        transform: translateX(0);
      }

      .rh-header {
        height: var(--rh-header-height);
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 20px;
        border-bottom: 1px solid var(--rh-border-light);
        background: linear-gradient(135deg, var(--rh-bg) 0%, var(--rh-bg-2) 100%);
        cursor: grab;
        position: relative;
        gap: 12px;
      }
      
      .rh-header-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .rh-header::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 20px;
        right: 20px;
        height: 1px;
        background: linear-gradient(90deg, transparent 0%, var(--rh-border) 50%, transparent 100%);
      }
      
      .rh-title {
        font-weight: 700;
        color: var(--rh-text);
        font-size: var(--rh-font-size-lg);
        letter-spacing: -0.02em;
        display: flex;
        align-items: center;
        gap: var(--rh-radius-sm);
      }
      
      .rh-title::before {
        content: '';
        width: 8px;
        height: 8px;
        background: linear-gradient(135deg, var(--rh-accent), var(--rh-success));
        border-radius: 50%;
        box-shadow: 0 0 0 2px var(--rh-accent-light);
      }
      
      .rh-close {
        appearance: none;
        border: 0;
        background: var(--rh-bg-2);
        color: var(--rh-subtle);
        cursor: pointer;
        font-size: var(--rh-font-size-base);
        border-radius: var(--rh-radius-sm);
        padding: var(--rh-radius-sm);
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all var(--rh-transition-base);
        box-shadow: var(--rh-shadow-sm);
      }
      
      .rh-close:hover {
        color: var(--rh-text);
        background: var(--rh-bg-3);
        box-shadow: var(--rh-shadow-md);
        transform: scale(1.05);
      }
      
      .rh-close:focus {
        outline: 2px solid var(--rh-accent);
        outline-offset: 2px;
      }
      
      /* Theme toggle */
      .rh-theme-toggle {
        position: relative;
        width: 50px;
        height: 26px;
      }
      
      .rh-theme-toggle-checkbox {
        opacity: 0;
        position: absolute;
        width: 100%;
        height: 100%;
        cursor: pointer;
        z-index: 1;
      }
      
      .rh-theme-toggle-label {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 50px;
        height: 26px;
        background: var(--rh-bg-2);
        border: 1px solid var(--rh-border);
        border-radius: 13px;
        padding: 3px;
        cursor: pointer;
        transition: all var(--rh-transition-base);
        box-shadow: var(--rh-shadow-sm);
      }
      
      .rh-theme-toggle-label::after {
        content: "";
        position: absolute;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: var(--rh-bg);
        border: 1px solid var(--rh-border);
        top: 2px;
        left: 2px;
        transition: transform var(--rh-transition-base), background-color var(--rh-transition-base);
      }
      
      .rh-theme-toggle-checkbox:checked + .rh-theme-toggle-label {
        background: var(--rh-accent);
        border-color: var(--rh-accent);
      }
      
      .rh-theme-toggle-checkbox:checked + .rh-theme-toggle-label::after {
        transform: translateX(24px);
        background: white;
        border-color: transparent;
      }
      
      .rh-theme-toggle-label .rh-theme-icon {
        font-size: 12px;
        transition: opacity var(--rh-transition-base);
        z-index: 0;
      }
      
      .rh-theme-toggle-label .rh-theme-sun {
        opacity: 0;
      }
      
      .rh-theme-toggle-label .rh-theme-moon {
        opacity: 1;
      }
      
      .rh-theme-toggle-checkbox:checked + .rh-theme-toggle-label .rh-theme-sun {
        opacity: 1;
      }
      
      .rh-theme-toggle-checkbox:checked + .rh-theme-toggle-label .rh-theme-moon {
        opacity: 0;
      }
      
      .rh-theme-toggle-label:focus-within {
        outline: 2px solid var(--rh-accent);
        outline-offset: 2px;
      }

      .rh-content {
        flex: 1;
        min-height: 0;
        overflow: auto;
        background: var(--rh-bg-2);
        padding: 20px;
        scrollbar-width: thin;
        scrollbar-color: var(--rh-border) transparent;
      }
      
      .rh-content::-webkit-scrollbar { width: 6px; }
      .rh-content::-webkit-scrollbar-track { background: transparent; }
      .rh-content::-webkit-scrollbar-thumb {
        background: var(--rh-border);
        border-radius: 3px;
      }
      
      .rh-section {
        background: var(--rh-bg);
        border: 1px solid var(--rh-border-light);
        border-radius: var(--rh-radius);
        padding: var(--rh-radius-lg);
        margin-bottom: var(--rh-radius-lg);
        box-shadow: var(--rh-shadow-sm);
        transition: all var(--rh-transition-base);
        position: relative;
        overflow: hidden;
      }
      
      .rh-section::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: linear-gradient(90deg, var(--rh-accent), var(--rh-success));
        opacity: 0;
        transition: opacity var(--rh-transition-base);
      }
      
      .rh-section:hover {
        box-shadow: var(--rh-shadow-md);
        /* transform: translateY(-1px); */
      }
      
      .rh-section:hover::before { opacity: 1; }
      
      .rh-section h4 {
        margin: 0 0 12px 0;
        font-size: var(--rh-font-size-sm);
        color: var(--rh-text-secondary);
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: var(--rh-radius-sm);
        transition: color var(--rh-transition-base);
      }
      
      .rh-section:hover h4 {
        color: var(--rh-text);
      }
      
      .rh-collapsible.collapsed h4 {
        margin-bottom: 0;
      }
      
      .rh-row {
        display: flex;
        gap: 10px;
        align-items: center;
        margin-bottom: 8px;
      }
      
      .rh-row:last-child { margin-bottom: 0; }
      
      .rh-row label {
        color: var(--rh-text);
      }
      
      .rh-row label span {
        color: var(--rh-text);
      }
      
      .rh-row input[type="text"], 
      .rh-row input[type="password"],
      .rh-row input[type="number"] {
        flex: 1;
        height: 32px;
        padding: 0 12px;
        border: 1px solid var(--rh-border);
        border-radius: var(--rh-radius-sm);
        background: var(--rh-input-bg);
        color: var(--rh-text);
        outline: none;
        font-size: var(--rh-font-size-sm);
        transition: all var(--rh-transition-base);
        box-shadow: var(--rh-shadow-sm);
      }
      
      .rh-row input[type="text"]:focus, 
      .rh-row input[type="password"]:focus,
      .rh-row input[type="number"]:focus {
        border-color: var(--rh-accent);
        box-shadow: 0 0 0 3px var(--rh-accent-light), var(--rh-shadow-md);
        background: var(--rh-input-bg);
      }

      .rh-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-top: 8px;
      }
      
      .rh-download-buttons {
        display: flex;
        gap: 6px;
        margin-top: 8px;
        width: 100%;
        flex-wrap: wrap;
      }
      
      .rh-btn {
        height: 32px;
        padding: 0 12px;
        border-radius: var(--rh-radius-sm);
        border: none;
        cursor: pointer;
        background: linear-gradient(135deg, var(--rh-accent) 0%, var(--rh-accent-hover) 100%);
        color: white;
        font-weight: 500;
        font-size: var(--rh-font-size-sm);
        letter-spacing: -0.01em;
        box-shadow: var(--rh-shadow-sm);
        transition: all var(--rh-transition-base);
        position: relative;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        min-width: 70px;
      }
      
      .rh-btn::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
        transition: left 0.5s ease;
      }
      
      .rh-btn:hover::before { left: 100%; }
      
      .rh-btn:hover {
        /* transform: translateY(-2px); */
        box-shadow: var(--rh-shadow-lg);
        background: linear-gradient(135deg, var(--rh-accent-hover) 0%, var(--rh-accent) 100%);
      }
      
      .rh-btn:active {
        transform: translateY(0);
        box-shadow: var(--rh-shadow-sm);
      }
      
      .rh-btn:focus {
        outline: 2px solid var(--rh-accent);
        outline-offset: 2px;
      }
      
      .rh-btn.secondary {
        background: var(--rh-bg);
        color: var(--rh-text-secondary);
        border: 1px solid var(--rh-border);
        box-shadow: var(--rh-shadow-sm);
        height: 32px;
      }
      
      .rh-btn.secondary:hover {
        background: var(--rh-bg-3);
        color: var(--rh-text);
        border-color: var(--rh-border);
        /* transform: translateY(-1px); */
        box-shadow: var(--rh-shadow-md);
      }
      
      .rh-btn.icon-btn {
        width: 32px;
        padding: 0;
        min-width: 32px;
        height: 32px;
      }

      .rh-meta {
        font-size: 12px;
        color: var(--rh-subtle);
        margin-top: 6px;
        padding: 8px 12px;
        background: var(--rh-bg-2);
        border-radius: var(--rh-radius-sm);
        border-left: 3px solid var(--rh-accent-light);
      }
      
      .rh-job-title {
        font-size: 15px;
        color: var(--rh-text);
        font-weight: 600;
        line-height: 1.4;
        margin-bottom: 4px;
      }
      
      .rh-job-meta {
        font-size: 13px;
        color: var(--rh-text-secondary);
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .rh-output {
        width: 100%;
        height: 180px;
        resize: vertical;
        padding: 14px;
        border: 1px solid var(--rh-border);
        border-radius: var(--rh-radius);
        background: var(--rh-input-bg);
        color: var(--rh-text);
        outline: none;
        font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
        font-size: var(--rh-font-size-sm);
        line-height: 1.5;
        transition: all var(--rh-transition-base);
        box-shadow: var(--rh-shadow-sm);
      }
      
      .rh-output:focus {
        border-color: var(--rh-accent);
        box-shadow: 0 0 0 3px var(--rh-accent-light), var(--rh-shadow-md);
        background: var(--rh-input-bg);
      }
      
      .rh-textarea {
        width: 100%;
        height: 120px;
        resize: vertical;
        padding: 14px;
        border: 1px solid var(--rh-border);
        border-radius: var(--rh-radius);
        background: var(--rh-input-bg);
        color: var(--rh-text);
        outline: none;
        font-size: var(--rh-font-size-base);
        line-height: 1.5;
        transition: all var(--rh-transition-base);
        box-shadow: var(--rh-shadow-sm);
      }
      
      .rh-textarea:focus {
        border-color: var(--rh-accent);
        box-shadow: 0 0 0 3px var(--rh-accent-light), var(--rh-shadow-md);
        background: var(--rh-input-bg);
      }

      .rh-footer {
        height: var(--rh-footer-height);
        border-top: 1px solid var(--rh-border-light);
        background: linear-gradient(135deg, var(--rh-bg) 0%, var(--rh-bg-2) 100%);
        padding: 0 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      
      .rh-footer-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
      }
      
      .rh-hint {
        font-size: 12px;
        color: var(--rh-subtle);
        font-weight: 500;
      }
      
      .rh-status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--rh-success), var(--rh-accent));
        box-shadow: 0 0 0 2px var(--rh-success-light);
        animation: pulse 2s ease-in-out infinite alternate;
      }
      
      @keyframes pulse {
        0% { opacity: 1; }
        100% { opacity: 0.6; }
      }

      /* Collapsible sections */
      .rh-collapsible-header {
        cursor: pointer;
        user-select: none;
        display: flex;
        align-items: center;
        justify-content: space-between;
        transition: all var(--rh-transition-base);
      }
      
      .rh-collapsible-header:hover {
        color: var(--rh-accent);
      }
      
      .rh-chevron {
        font-size: 10px;
        transition: transform var(--rh-transition-base);
      }
      
      .rh-collapsible.collapsed .rh-chevron {
        transform: rotate(-90deg);
      }
      
      .rh-collapsible-content {
        overflow: hidden;
        transition: all var(--rh-transition-slow);
        opacity: 1;
        max-height: 500px;
        padding: 4px;
      }
      
      .rh-collapsible.collapsed .rh-collapsible-content {
        max-height: 0;
        opacity: 0;
        padding: 0;
        margin-top: 0;
        margin-bottom: 0;
      }
      
      /* Job insights styles */
      .rh-subsection {
        margin-bottom: 16px;
      }
      
      .rh-subsection h5 {
        margin: 0 0 8px 0;
        font-size: 12px;
        color: var(--rh-text-secondary);
        font-weight: 600;
      }
      
      .rh-list {
        font-size: 13px;
        line-height: 1.5;
        color: var(--rh-text);
      }
      
      .rh-requirement-item {
        color: var(--rh-text);
        margin-bottom: 4px;
      }
      
      .rh-company-card {
        background: var(--rh-bg-2);
        border-radius: var(--rh-radius-sm);
        padding: 12px;
        font-size: 13px;
        color: var(--rh-text);
      }
      
      .rh-company-stats {
        display: flex;
        flex-direction: column;
        gap: 6px;
        color: var(--rh-text);
      }
      
      .rh-skills-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        color: var(--rh-text-secondary);
      }
      
      .rh-skill-tag {
        background: var(--rh-accent-light);
        color: var(--rh-accent);
        padding: 4px 8px;
        border-radius: var(--rh-radius-sm);
        font-size: 11px;
        font-weight: 500;
      }
      
      .rh-questions-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        color: var(--rh-text-secondary);
      }
      
      .rh-question-item {
        background: var(--rh-bg-2);
        border-radius: var(--rh-radius-sm);
        padding: 10px;
        font-size: 12px;
        border-left: 3px solid var(--rh-accent);
        color: var(--rh-text);
        line-height: 1.5;
      }
      
      .rh-question-item em {
        color: var(--rh-text-secondary);
        font-style: italic;
      }
      
      .rh-resources-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        color: var(--rh-text-secondary);
      }
      
      .rh-resource-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: var(--rh-text-secondary);
      }
      
      .rh-resource-link {
        color: var(--rh-accent);
        text-decoration: none;
        flex: 1;
      }
      
      .rh-resource-link:hover {
        text-decoration: underline;
      }
      
      .rh-job-details {
        margin: 12px 0;
        padding: 12px;
        background: var(--rh-bg-2);
        border-radius: var(--rh-radius-sm);
        font-size: 13px;
      }
      
      .rh-job-salary {
        font-weight: 600;
        color: var(--rh-success);
        margin-bottom: 6px;
      }
      
      .rh-job-company-info, .rh-job-applicants {
        color: var(--rh-text-secondary);
        margin-bottom: 4px;
      }

      /* Resize handle */
      .rh-resize-handle {
        position: absolute;
        left: 0;
        right: 0;
        bottom: var(--rh-footer-height);
        height: 10px;
        cursor: ns-resize;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
        z-index: 2;
      }
      .rh-resize-handle::after {
        content: '';
        width: 40px;
        height: 4px;
        border-radius: 2px;
        background: var(--rh-border);
      }

      @media (max-width: 768px) {
        :root { --rh-width-expanded: 300px; }
      }
      .rh-job-salary-estimate {
        display: none;
        margin-bottom: 12px;
        padding: 12px;
        background: var(--rh-bg-2);
        border-radius: var(--rh-radius-sm);
        font-size: 12px;
        border: 1px solid var(--rh-border);
      }

      .rh-salary-tc {
        font-weight: 600;
        color: var(--rh-accent);
        margin-bottom: 6px;
      }

      .rh-salary-breakdown {
        color: var(--rh-text);
        margin-bottom: 4px;
      }

      .rh-salary-confidence {
        font-size: 11px;
        color: var(--rh-text-secondary);
      }
    `;
  }

  _html() {
    return `
      <div class="rh-collapsed-tab" id="rh-toggle">
        <div class="rh-tab-content">
          <div class="rh-tab-icon">R</div>
          <div class="rh-tab-label">ResumeHub</div>
        </div>
      </div>
      <div class="rh-panel theme-light" id="rh-panel">
        <div class="rh-header">
          <div class="rh-title">ResumeHub</div>
          <div class="rh-header-actions">
            <div class="rh-theme-toggle">
              <input type="checkbox" id="rh-theme-toggle" class="rh-theme-toggle-checkbox">
              <label for="rh-theme-toggle" class="rh-theme-toggle-label">
                <span class="rh-theme-icon rh-theme-sun">☀️</span>
                <span class="rh-theme-icon rh-theme-moon">🌙</span>
              </label>
            </div>
            <button class="rh-close" id="rh-close" title="Collapse">×</button>
          </div>
        </div>
        <div class="rh-content">
          <div class="rh-section rh-collapsible collapsed" id="rh-api">
            <h4 class="rh-collapsible-header" id="rh-api-header">🔑 API Configuration <span class="rh-chevron">▼</span></h4>
            <div class="rh-collapsible-content" id="rh-api-content">
              <div class="rh-row">
                <input type="password" id="rh-api-input" placeholder="Enter your Gemini API key" />
                <button class="rh-btn secondary icon-btn" id="rh-api-show" title="Show/Hide">👁</button>
              </div>
              <div class="rh-actions">
                <button class="rh-btn" id="rh-api-save">💾 Save</button>
                <button class="rh-btn secondary" id="rh-api-clear">🗑 Clear</button>
                <button class="rh-btn secondary" id="rh-api-get">🔗 Get Key</button>
              </div>
              <div id="rh-api-status" class="rh-meta">Checking key status…</div>
            </div>
          </div>



          <div class="rh-section" id="rh-job">
            <h4>💼 Current Job</h4>
            <div class="rh-job-title" id="rh-job-title">No job selected</div>
            <div class="rh-job-meta" id="rh-job-meta">Select a job to get started</div>

            <div class="rh-job-details" id="rh-job-details" style="display: none;">
              <div class="rh-job-salary" id="rh-job-salary"></div>
              <div class="rh-job-company-info" id="rh-job-company-info"></div>
              <div class="rh-job-applicants" id="rh-job-applicants"></div>
            </div>
            <div class="rh-actions">
              <button class="rh-btn secondary" id="rh-extract">📄 Extract JD</button>
              <button class="rh-btn secondary" id="rh-extract-insights">💡 Extract Insights</button>
              <button class="rh-btn" id="rh-tailor">✨ Tailor</button>
              <div class="rh-download-buttons" id="rh-download-buttons" style="display: none; gap: 6px; margin-top: 8px;">
                <button class="rh-btn secondary" id="rh-download-docx" style="font-size: 11px; padding: 0 8px; height: 28px;">📄 DOCX</button>
                <button class="rh-btn secondary" id="rh-download-pdf" style="font-size: 11px; padding: 0 8px; height: 28px;">📕 PDF</button>
                <button class="rh-btn secondary" id="rh-download-txt" style="font-size: 11px; padding: 0 8px; height: 28px;">📝 TXT</button>
              </div>
            </div>
            <div class="rh-context-section rh-collapsible collapsed" id="rh-context-wrap">
              <h5 class="rh-collapsible-header" style="margin: 16px 0 8px 0; font-size: 12px; color: var(--rh-text-secondary); font-weight: 600; cursor: pointer; user-select: none;">📝 Resume Context <span class="rh-chevron">▼</span></h5>
              <div class="rh-collapsible-content">
                <textarea class="rh-textarea" id="rh-context" placeholder="Add career summary, target role, key skills, or preferences to personalize your resume…" style="height: 80px; font-size: 12px;"></textarea>
                <div class="rh-meta" id="rh-context-status" style="margin-top: 4px; font-size: 11px;">Auto-saves as you type</div>
              </div>
            </div>
            <div class="rh-context-section rh-collapsible collapsed" id="rh-extracted-jd-wrap" style="display: none;">
              <h5 class="rh-collapsible-header" style="margin: 16px 0 8px 0; font-size: 12px; color: var(--rh-text-secondary); font-weight: 600; cursor: pointer; user-select: none;">📄 Extracted Job Description <span class="rh-chevron">▼</span></h5>
              <div class="rh-collapsible-content">
                <textarea class="rh-textarea" id="rh-extracted-jd" placeholder="Extracted job description will appear here..." style="height: 200px; font-size: 12px;" readonly></textarea>
                <div class="rh-meta" id="rh-extracted-jd-status" style="margin-top: 4px; font-size: 11px;">Click Extract or enable Background AI mode to extract</div>
              </div>
            </div>
          </div>

          <div class="rh-section" id="rh-company-salary" style="display: none;">
            <h4>🏢 Company & Salary</h4>
            <div class="rh-job-salary-estimate" id="rh-job-salary-estimate">
              <div class="rh-salary-tc" id="rh-salary-tc"></div>
              <div class="rh-salary-breakdown" id="rh-salary-breakdown"></div>
              <div class="rh-salary-confidence" id="rh-salary-confidence"></div>
            </div>
            <div class="rh-subsection">
              <h5>📊 Company Details</h5>
              <div id="rh-company-details" class="rh-company-card">
                <div class="rh-company-stats">Loading...</div>
              </div>
            </div>
          </div>

          <div class="rh-section" id="rh-job-insights" style="display: none;">
            <h4>🎯 Job Insights</h4>
            <div class="rh-subsection">
              <h5>📋 Key Requirements</h5>
              <div id="rh-key-requirements" class="rh-list">Loading...</div>
            </div>
            <div class="rh-subsection">
              <h5>🛠️ Required Skills</h5>
              <div id="rh-required-skills" class="rh-skills-grid">Loading...</div>
            </div>
          </div>

          <div class="rh-section" id="rh-interview-prep" style="display: none;">
            <h4>🎤 Interview Preparation</h4>
            <div class="rh-subsection">
              <h5>❓ Potential Questions</h5>
              <div id="rh-interview-questions" class="rh-questions-list">Loading...</div>
            </div>
            <div class="rh-subsection">
              <h5>📚 Helpful Resources</h5>
              <div id="rh-helpful-resources" class="rh-resources-list">Loading...</div>
            </div>
          </div>

          <div class="rh-resize-handle" id="rh-resize" title="Drag to resize"></div>
        </div>
        <div class="rh-footer">
          <div class="rh-footer-content">
            <span class="rh-hint" id="rh-hint">💡 Extract job description first, then tailor your resume</span>
            <div class="rh-status-dot"></div>
          </div>
        </div>
      </div>
    `;
  }

  _wireEvents() {
    const container = this.root.querySelector('.rh-sidebar');
    const panel = this.root.getElementById('rh-panel');
    const toggle = this.root.getElementById('rh-toggle');
    const closeBtn = this.root.getElementById('rh-close');

    const setExpanded = (expanded) => {
      this.expanded = expanded;
      container.classList.toggle('expanded', expanded);
      container.classList.toggle('collapsed', !expanded);
      // Update host width to avoid overlaying full page
      const host = this.root.host;
      if (host) {
        host.style.width = expanded
          ? '380px'
          : '48px';
        if (expanded) {
          host.style.height = '70vh';
          host.style.transform = 'none';
          host.style.right = '12px'; // detach from edge when open
        } else {
          host.style.height = '30vh';
          host.style.transform = 'none';
          host.style.right = '0px'; // flush to edge when collapsed
        }
        this._ensureInViewport();
      }
      if (panel) {
        panel.classList.toggle('theme-dark', this.theme === 'dark');
        panel.classList.toggle('theme-light', this.theme !== 'dark');
      }
      // Propagate theme to container for variables
      container.classList.toggle('theme-dark', this.theme === 'dark');
      container.classList.toggle('theme-light', this.theme !== 'dark');
    };

    toggle.addEventListener('click', (e) => {
      if (this._dragJustHappened) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      setExpanded(true);
    });
    closeBtn.addEventListener('click', () => setExpanded(false));

    // Theme toggle
    const themeToggle = this.root.getElementById('rh-theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('change', async (e) => {
        const newTheme = e.target.checked ? 'dark' : 'light';
        await this._setTheme(newTheme);
      });
    }

    // Keyboard shortcuts: Alt+R to toggle, Esc to collapse
    const onKeyDown = (e) => {
      const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
      const isTextField = tag === 'input' || tag === 'textarea' || (e.target && e.target.isContentEditable);
      if (e.altKey && (e.key === 'r' || e.key === 'R')) {
        if (!isTextField) {
          setExpanded(!this.expanded);
          e.preventDefault();
        }
      } else if (e.key === 'Escape') {
        if (this.expanded) {
          setExpanded(false);
          e.preventDefault();
        }
      }
    };
    this._onKeyDown = onKeyDown;
    window.addEventListener('keydown', onKeyDown);

    // Resize handle (vertical resize in expanded state)
    const resizeHandle = this.root.getElementById('rh-resize');
    if (resizeHandle) {
      let resizing = false;
      let startY = 0;
      let startH = 0;
      const onResizeStart = (e) => {
        if (!this.expanded) return;
        resizing = true;
        startY = e.touches ? e.touches[0].clientY : e.clientY;
        const host = this.root.host;
        startH = host.getBoundingClientRect().height;
        window.addEventListener('mousemove', onResizeMove);
        window.addEventListener('touchmove', onResizeMove, { passive: false });
        window.addEventListener('mouseup', onResizeEnd);
        window.addEventListener('touchend', onResizeEnd);
        e.preventDefault();
        e.stopPropagation();
      };
      const clamp = (val, min, max) => Math.min(Math.max(val, min), max);
      const onResizeMove = (e) => {
        if (!resizing) return;
        const y = e.touches ? e.touches[0].clientY : e.clientY;
        const dy = y - startY;
        const vh = window.innerHeight;
        const minH = Math.max(220, Math.round(0.3 * vh));
        const maxH = Math.round(0.7 * vh);
        const newH = clamp(startH + dy, minH, maxH);
        const host = this.root.host;
        host.style.height = `${newH}px`;
        if (e.cancelable) e.preventDefault();
      };
      const onResizeEnd = () => {
        if (!resizing) return;
        resizing = false;
        window.removeEventListener('mousemove', onResizeMove);
        window.removeEventListener('touchmove', onResizeMove);
        window.removeEventListener('mouseup', onResizeEnd);
        window.removeEventListener('touchend', onResizeEnd);
        this._ensureInViewport();
      };
      resizeHandle.addEventListener('mousedown', onResizeStart);
      resizeHandle.addEventListener('touchstart', onResizeStart, { passive: false });
    }
  }

  _startObservers() {
    // Observe URL changes and DOM mutations
    let debounceTimeout;
    this.mutationObserver = new MutationObserver(() => {
      const urlChanged = location.href !== this.lastUrl;
      
      if (urlChanged) {
        this.lastUrl = location.href;
        // Immediate update on URL change
        this._updateJobContext();
      }

      // Debounce update for DOM changes (to catch content loading after URL change)
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        this._updateJobContext();
      }, 500);
    });
    this.mutationObserver.observe(document.body, { childList: true, subtree: true });
  }

  async _loadTheme() {
    try {
      const getSync = (keys) => new Promise((res) => chrome.storage.sync.get(keys, (r) => res(r || {})));
      const result = await getSync(['theme']);
      this.theme = result.theme === 'dark' ? 'dark' : 'light';
      await this._applyTheme(this.theme);
    } catch (e) {
      // default stays
    }
  }

  async _setTheme(theme) {
    this.theme = theme;
    const syncSet = (data) => new Promise((res) => chrome.storage.sync.set(data, () => res()));
    await syncSet({ theme: theme });
    await this._applyTheme(theme);
  }

  async _applyTheme(theme) {
    const panel = this.root.getElementById('rh-panel');
    const container = this.root.querySelector('.rh-sidebar');
    const themeToggle = this.root.getElementById('rh-theme-toggle');
    
    if (panel) {
      panel.classList.toggle('theme-dark', theme === 'dark');
      panel.classList.toggle('theme-light', theme !== 'dark');
    }
    if (container) {
      container.classList.toggle('theme-dark', theme === 'dark');
      container.classList.toggle('theme-light', theme !== 'dark');
    }
    if (themeToggle) {
      themeToggle.checked = (theme === 'dark');
    }
  }



  _maybeNotifyJobChanged(title, company, locationText) {
    try {
      const t = (title || '').trim();
      const c = (company || '').trim();
      const l = (locationText || '').trim();
      const url = location.href;
      const sig = `${t}|${c}|${l}|${url}`;
      if (!t || !c) return;
      if (sig === this._lastJobSig) return;
      this._lastJobSig = sig;
      chrome.runtime.sendMessage({
        action: 'jobChanged',
        data: { jobTitle: t, companyName: c, location: l, jobUrl: url }
      }, () => {});
    } catch (e) {
      // no-op
    }
  }

  _setupCollapsibleSections() {
    const apiHeader = this.root.getElementById('rh-api-header');
    const apiSection = this.root.getElementById('rh-api');
    
    if (apiHeader && apiSection) {
      apiHeader.addEventListener('click', () => {
        apiSection.classList.toggle('collapsed');
      });
    }



    const contextHeader = this.root.querySelector('#rh-context-wrap .rh-collapsible-header');
    const contextSection = this.root.getElementById('rh-context-wrap');
    
    if (contextHeader && contextSection) {
      contextHeader.addEventListener('click', () => {
        contextSection.classList.toggle('collapsed');
      });
    }

    const extractedJdHeader = this.root.querySelector('#rh-extracted-jd-wrap .rh-collapsible-header');
    const extractedJdSection = this.root.getElementById('rh-extracted-jd-wrap');
    
    if (extractedJdHeader && extractedJdSection) {
      extractedJdHeader.addEventListener('click', () => {
        extractedJdSection.classList.toggle('collapsed');
      });
    }
  }

  async _refreshApiStatus() {
    const statusEl = this.root.getElementById('rh-api-status');
    const inputEl = this.root.getElementById('rh-api-input');
    const saveBtn = this.root.getElementById('rh-api-save');
    const clearBtn = this.root.getElementById('rh-api-clear');
    const showBtn = this.root.getElementById('rh-api-show');
    const getBtn = this.root.getElementById('rh-api-get');

    // Read current token
    chrome.runtime.sendMessage({ action: 'getAPIToken' }, (resp) => {
      const token = resp && resp.token;
      statusEl.textContent = token ? 'Key: Set' : 'Key: Not Set';
      inputEl.value = '';
      inputEl.placeholder = token ? '********' : 'Google Gemini API Key';
    });

    // Show/hide password - fixed functionality
    showBtn.addEventListener('click', () => {
      if (inputEl.type === 'password') {
        // Show the actual API key if available
        chrome.runtime.sendMessage({ action: 'getAPIToken' }, (resp) => {
          if (resp && resp.token) {
            inputEl.value = resp.token;
            inputEl.type = 'text';
            showBtn.textContent = '🙈';
            showBtn.title = 'Hide key';
          }
        });
      } else {
        inputEl.value = '';
        inputEl.type = 'password';
        showBtn.textContent = '👁';
        showBtn.title = 'Show key';
        chrome.runtime.sendMessage({ action: 'getAPIToken' }, (resp) => {
          const token = resp && resp.token;
          inputEl.placeholder = token ? '********' : 'Google Gemini API Key';
        });
      }
    });

    // Save
    const doSave = () => {
      const clean = (inputEl.value || '').trim();
      chrome.runtime.sendMessage({ action: 'setAPIToken', data: { token: clean } }, (resp) => {
        if (resp && resp.success) {
          statusEl.textContent = clean ? 'Key: Set' : 'Key: Not Set';
          inputEl.value = '';
          inputEl.placeholder = clean ? '********' : 'Google Gemini API Key';
        } else {
          statusEl.textContent = 'Error saving key';
        }
      });
    };
    saveBtn.addEventListener('click', doSave);
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        doSave();
        e.preventDefault();
      }
    });

    // Clear
    clearBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'clearAPIToken' }, (resp) => {
        statusEl.textContent = 'Key: Not Set';
        inputEl.value = '';
        inputEl.placeholder = 'Google Gemini API Key';
      });
    });

    // Get Key (opens Google AI Studio in a new tab)
    if (getBtn) {
      getBtn.addEventListener('click', () => {
        try { window.open('https://aistudio.google.com/app/apikey', '_blank'); } catch (e) {}
      });
    }
  }

  async _setupContextPersistence() {
    const textarea = this.root.getElementById('rh-context');
    const status = this.root.getElementById('rh-context-status');
    if (!textarea) return;

    const loadContext = () => new Promise((res) => chrome.storage.local.get(['resumeContext'], (r) => res((r && r.resumeContext) || '')));
    const saveContext = (v) => new Promise((res) => {
      chrome.storage.local.set({ resumeContext: v }, () => res());
    });

    try {
      const existing = await loadContext();
      textarea.value = existing || '';
      status.textContent = existing ? 'Context loaded' : 'Context empty';
    } catch (e) {
      status.textContent = 'Could not load context';
    }

    let t;
    const commit = async () => {
      const v = (textarea.value || '').trim();
      await saveContext(v);
      status.textContent = v ? 'Context saved' : 'Context empty';
    };

    textarea.addEventListener('input', () => {
      status.textContent = 'Saving…';
      if (t) clearTimeout(t);
      t = setTimeout(commit, 400);
    });
  }

  async _ensureSelectors() {
    if (this.selectors) return this.selectors;
    try {
      const { SELECTORS } = await import(chrome.runtime.getURL('content-scripts/linkedin/config/selectors.js'));
      this.selectors = SELECTORS;
    } catch (e) {
      this.selectors = null;
    }
    return this.selectors;
  }

  // Prefer elements within the right-side job details containers to avoid picking from the left job list
  _findInJobDetails(selectorList) {
    try {
      const details = this.selectors?.JOB_DETAILS_PAGE || {};
      const containerSelectors = [
        ...(Array.isArray(details.detailsPanelContainer) ? details.detailsPanelContainer : []),
        '.scaffold-layout__detail',
        '.jobs-details',
        '.jobs-unified-top-card',
        '.jobs-unified-top-card__content',
      ];

      // Collect unique containers
      const containers = [];
      for (const cs of containerSelectors) {
        try {
          document.querySelectorAll(cs).forEach(el => containers.push(el));
        } catch {}
      }
      const uniqueContainers = Array.from(new Set(containers));

      const tryFindInRoot = (root) => {
        for (const sel of selectorList || []) {
          try {
            const el = root.querySelector(sel);
            if (el && el.innerText && el.innerText.trim().length > 0) return el;
          } catch {}
        }
        return null;
      };

      for (const root of uniqueContainers) {
        const found = tryFindInRoot(root);
        if (found) return found;
      }

      // Fallback: search document but skip elements inside left job list/card containers
      for (const sel of selectorList || []) {
        try {
          const el = document.querySelector(sel);
          if (!el) continue;
          const isInList = el.closest('li[data-occludable-job-id], .job-card-container, .jobs-search-results-list, .jobs-search__results-list, .semantic-search-results-list__list-item, .job-card-job-posting-card-wrapper');
          if (isInList) continue;
          if (el.innerText && el.innerText.trim().length > 0) return el;
        } catch {}
      }
    } catch {}
    return null;
  }

  async _updateJobContext() {
    await this._ensureSelectors();
    let title = '—';
    let company = '—';
    let locationText = '—';
    let salary = '';
    let applicants = '';
    let companySize = '';
    let industry = '';
    let linkedinEmployees = '';

    try {
      if (this.selectors && this.selectors.JOB_DETAILS_PAGE) {
        const s = this.selectors.JOB_DETAILS_PAGE;
        const findOne = (sel) => {
          const arr = Array.isArray(sel) ? sel : [sel];
          for (const q of arr) { const el = document.querySelector(q); if (el) return el; }
          return null;
        };
        
        // Basic job info
        const titleEl = this._findInJobDetails(s.jobTitle) || findOne(s.jobTitle);
        const companyInfoEl = this._findInJobDetails(s.companyInfo) || findOne(s.companyInfo);
        
        if (titleEl && titleEl.innerText) title = titleEl.innerText.trim();
        if (companyInfoEl && companyInfoEl.innerText) {
          const text = companyInfoEl.innerText.trim();
          const separators = ['·', '•', '|', '-'];
          let parts = [text, ''];
          for (const sep of separators) {
            if (text.includes(sep)) { parts = text.split(sep).map(p => p.trim()); break; }
          }
          company = parts[0] || company;
          locationText = parts[1] || locationText;
        }

        // Extract comprehensive job details
        const jobDetails = this._extractJobDetails();
        salary = jobDetails.salary;
        applicants = jobDetails.applicants;
        companySize = jobDetails.companySize;
        industry = jobDetails.industry;
        linkedinEmployees = jobDetails.linkedinEmployees;
      }
    } catch (e) {
      // ignore extraction errors
    }

    // Update basic UI
    const titleEl2 = this.root.getElementById('rh-job-title');
    const metaEl = this.root.getElementById('rh-job-meta');
    if (titleEl2) titleEl2.textContent = title || '—';
    
    // Robust extraction for Company and Location if missing
    let displayCompany = company;
    let displayLocation = locationText;

    // 1. Try to extract Company Name if missing or invalid
    const isInvalidCompany = !displayCompany || displayCompany === '—' || displayCompany.includes('follower');
    if (isInvalidCompany) {
        // Strategy A: New UI - aria-label container or link inside it
        // The selector "div[aria-label^='Company,'] a" should give us the element with text "ETS"
        const companyEl = this._findInJobDetails(this.selectors.JOB_DETAILS_PAGE.companyInfo);
        if (companyEl && companyEl.innerText && companyEl.innerText.trim()) {
             let rawText = companyEl.innerText.trim();
             // Clean up: If text contains newlines or "followers", take the first part
             // Example: "Company Name\n1,000 followers" -> "Company Name"
             if (rawText.includes('\n')) {
                 rawText = rawText.split('\n')[0].trim();
             }
             if (rawText.toLowerCase().includes('follower')) {
                 // Fallback: if the first line itself has "follower" (unlikely but possible), ignore it?
                 // Usually "Name" is on first line.
                 // If the whole text is just "1000 followers", we should probably ignore it.
                 if (!rawText.toLowerCase().includes('follower')) {
                     displayCompany = rawText;
                 }
             } else {
                 displayCompany = rawText;
             }
        }
        
        // If still invalid (or empty), fallback to aria-label parsing
        if (!displayCompany || displayCompany === '—' || displayCompany.includes('follower')) {
            const logoContainer = document.querySelector('div[aria-label^="Company,"]');
            if (logoContainer) {
                const label = logoContainer.getAttribute('aria-label');
                if (label) {
                    // Format: "Company, [Name]."
                    let name = label.replace('Company, ', '');
                    if (name.endsWith('.')) name = name.slice(0, -1);
                    displayCompany = name.trim();
                }
            }
        }

        // Strategy B: New UI - About the company section link (Fallback)
        if ((!displayCompany || displayCompany === '—') && document.querySelector('h2')) {
            // Look for the "About the company" header, then find the company link nearby
            const aboutSection = Array.from(document.querySelectorAll('h2')).find(el => el.textContent.trim() === 'About the company');
            if (aboutSection) {
                // The company name is usually in a link within the same container or section
                // Try to find a link that is NOT "Show more" or "Learn more"
                const container = aboutSection.closest('.jobs-company__box') || aboutSection.closest('.job-details-module') || aboutSection.parentElement.parentElement;
                if (container) {
                    const companyLink = container.querySelector('a[href*="/company/"]:not([aria-label*="Learn more"]):not([aria-label*="Show more"])');
                    if (companyLink) {
                         displayCompany = companyLink.textContent.trim();
                    }
                }
            }
        }

        // Strategy C: Old UI - specific class
        if (!displayCompany || displayCompany.includes('follower')) {
            const companyEl = document.querySelector('.job-details-jobs-unified-top-card__company-name a');
            if (companyEl) {
                displayCompany = companyEl.textContent.trim();
            }
        }
        
        // Strategy D: Fallback to sticky header if available
        if (!displayCompany || displayCompany.includes('follower')) {
             const stickyHeaderEl = document.querySelector('.job-details-jobs-unified-top-card__title-container .t-14');
             if (stickyHeaderEl) {
                 const text = stickyHeaderEl.textContent.trim();
                 const parts = text.split('·');
                 if (parts.length >= 1) {
                     displayCompany = parts[0].trim();
                 }
             }
        }
    }

    // Strategy E: Left Sidebar (Active Job Card) - High Priority Fallback
    // This is often the most reliable source when switching jobs
    if (isInvalidCompany || !displayCompany || displayCompany.includes('follower')) {
        const activeCard = document.querySelector('.jobs-search-results-list__list-item--active');
        if (activeCard) {
            const companyEl = activeCard.querySelector('.job-card-container__primary-description');
            if (companyEl) {
                displayCompany = companyEl.textContent.trim();
            }
        }
    }

    // 2. Try to extract Location if missing or invalid
    if (!displayLocation || displayLocation === '—' || displayLocation === '-') {
        // Strategy A: Primary description container (e.g. "Bengaluru, Karnataka, India")
        const primaryLocEl = document.querySelector('.job-details-jobs-unified-top-card__primary-description-container .tvm__text--low-emphasis');
        if (primaryLocEl) {
            displayLocation = primaryLocEl.textContent.trim();
        }

        // Strategy B: New UI - Location in paragraph with "·" and time (e.g. "Gurgaon, Haryana, India · 2 weeks ago")
        if (!displayLocation || displayLocation === '—') {
             // Find the paragraph that contains the location. It usually follows the company name/title.
             // We look for a paragraph with a span that has the location text.
             const jobDetailsContainer = document.querySelector('div[data-view-name="job-detail-page"]');
             if (jobDetailsContainer) {
                 // The location is often in a paragraph with multiple spans separated by "·"
                 const paragraphs = jobDetailsContainer.querySelectorAll('p');
                 for (const p of paragraphs) {
                     const text = p.textContent.trim();
                     // Check for pattern "Location · Time" or just "Location" if it's the primary description
                     // The new HTML shows: <p><span>Gurugram...</span><span>·</span><span>1 day ago...</span></p>
                     if (text.includes('·') && (text.includes('ago') || text.includes('posted') || text.includes('apply') || text.includes('people'))) {
                         const parts = text.split('·');
                         if (parts.length > 0) {
                             // Sometimes the first part is the location
                             let loc = parts[0].trim();
                             // Verify it's not the company name (simple check)
                             if (loc !== displayCompany && loc.length < 100) {
                                 displayLocation = loc;
                                 break;
                             }
                         }
                     }
                 }
             }
        }

        // Strategy C: Sticky header (e.g. "Autodesk · Bengaluru, Karnataka, India (Hybrid)")
        if (!displayLocation || displayLocation === '—') {
            const stickyHeaderEl = document.querySelector('.job-details-jobs-unified-top-card__title-container .t-14');
            if (stickyHeaderEl) {
                const text = stickyHeaderEl.textContent.trim();
                // Format: "Company · Location"
                const parts = text.split('·');
                if (parts.length >= 2) {
                    displayLocation = parts[1].trim();
                    // If we also missed company, we can get it here
                    if (!displayCompany || displayCompany === '—') {
                        displayCompany = parts[0].trim();
                    }
                }
            }
        }
    }
    
    // Strategy C: Left Sidebar (Active Job Card) for Location
    if (!displayLocation || displayLocation === '—' || displayLocation === '-') {
         const activeCard = document.querySelector('.jobs-search-results-list__list-item--active');
         if (activeCard) {
             const locEl = activeCard.querySelector('.job-card-container__metadata-item');
             if (locEl) {
                 displayLocation = locEl.textContent.trim();
             }
         }
    }

    if (metaEl) metaEl.textContent = `${displayCompany || '—'} • ${displayLocation || '—'}`;

    // Update job details section
    this._updateJobDetailsDisplay(salary, applicants, companySize, industry, linkedinEmployees);

    // Check if this is a different job than what we have extracted
    // Use the displayed values for the signature to ensure consistency
    const currentJobSig = `${title}|${displayCompany}|${location.href}`;
    const jobChanged = currentJobSig !== this._lastJobSig;
    const extractionNeeded = currentJobSig !== this._lastExtractedJobSig;
    
    if (jobChanged && this._lastJobSig !== '') {
      // Different job detected - IMMEDIATELY clear all UI and show loading states
      this._updateExtractedJDDisplay('', false);
      const extractedJdWrap = this.root.getElementById('rh-extracted-jd-wrap');
      if (extractedJdWrap) extractedJdWrap.style.display = 'none';
      this._lastExtractedJD = '';
      
      // Clear all insights sections immediately and show loading states
      const requirementsEl = this.root.getElementById('rh-key-requirements');
      const skillsEl = this.root.getElementById('rh-required-skills');
      const questionsEl = this.root.getElementById('rh-interview-questions');
      const resourcesEl = this.root.getElementById('rh-helpful-resources');
      const companyStatsEl = this.root.getElementById('rh-company-details')?.querySelector('.rh-company-stats');
      
      if (requirementsEl) requirementsEl.innerHTML = 'Analyzing requirements...';
      if (skillsEl) skillsEl.innerHTML = 'Analyzing skills...';
      if (questionsEl) questionsEl.innerHTML = 'Generating personalized questions...';
      if (resourcesEl) resourcesEl.innerHTML = 'Loading resources...';
      if (companyStatsEl) companyStatsEl.innerHTML = 'Loading...';

      // Hide sections until requested
      const companySalaryEl = this.root.getElementById('rh-company-salary');
      const insightsEl = this.root.getElementById('rh-job-insights');
      const prepEl = this.root.getElementById('rh-interview-prep');
      if (companySalaryEl) companySalaryEl.style.display = 'none';
      if (insightsEl) insightsEl.style.display = 'none';
      if (prepEl) prepEl.style.display = 'none';
      
      // Clear insights cache for the old job
      this._clearInsightsCache();
      // Reset extraction signature to force re-extraction
      this._lastExtractedJobSig = '';
    }

    // Update last job signature
    this._lastJobSig = currentJobSig;

    // Notify background of job change (throttled by signature)
    this._maybeNotifyJobChanged(title, company, locationText);

    // Wire buttons that rely on context
    this._wireActions();
  }

  _extractJobDetails() {
    const details = {
      salary: '',
      applicants: '',
      companySize: '',
      industry: '',
      linkedinEmployees: ''
    };

    try {
      // Extract salary information
      const salarySelectors = [
        '.job-details-jobs-unified-top-card__job-insight .jobs-unified-top-card__job-insight-value',
        '.job-details-fit-level-preferences button:first-child .tvm__text--low-emphasis strong',
        '.salary-insights .salary-value',
        '.compensation-insights'
      ];
      
      for (const sel of salarySelectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent && (el.textContent.includes('₹') || el.textContent.includes('$') || el.textContent.includes('L') || el.textContent.includes('/yr'))) {
          details.salary = el.textContent.trim();
          break;
        }
      }

      // Extract applicant count
      const applicantSelectors = [
        '.job-details-jobs-unified-top-card__tertiary-description-container',
        '.jobs-unified-top-card__subtitle-secondary-grouping'
      ];
      
      for (const sel of applicantSelectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent && el.textContent.includes('applicant')) {
          const match = el.textContent.match(/(\d+)\s*applicants?/);
          if (match) {
            details.applicants = match[0];
            break;
          }
        }
      }

      // Extract company information
      const companySection = document.querySelector('.jobs-company, .job-details-about-company-module, .jobs-company__box, [data-test-id="about-us"]');
      if (companySection) {
        const companyText = companySection.textContent;
        
        // Company size - improved regex to capture numbers with commas (e.g., "10,001+ employees")
        // Try multiple patterns to catch different formats
        const sizePatterns = [
          /(\d{1,3}(?:,\d{3})+\+?)\s*employees?/i,  // Matches "10,001+ employees" or "10,001 employees"
          /(\d{4,}\+?)\s*employees?/i,              // Matches "10001+ employees" (no comma, 4+ digits)
          /(\d+[,-]\d+\+?)\s*employees?/i,          // Matches "10-001+ employees" or "10,001+ employees"
          /(\d+\+?)\s*employees?/i                   // Fallback: any number
        ];
        
        for (const pattern of sizePatterns) {
          const sizeMatch = companyText.match(pattern);
        if (sizeMatch) {
            // Ensure we capture the full number, not just "001+"
            const fullMatch = companyText.match(new RegExp(`(${sizeMatch[1].replace(/[+()]/g, '\\$&')}\\+?)\\s*employees?`, 'i'));
            if (fullMatch) {
              details.companySize = fullMatch[0].trim();
              break;
            }
          }
        }

        // LinkedIn employees - improved regex to capture full number with commas (e.g., "95,264 on LinkedIn")
        // Find the number immediately before "on LinkedIn"
        const linkedinIndex = companyText.toLowerCase().indexOf('on linkedin');
        if (linkedinIndex > 0) {
          // Extract text before "on LinkedIn" and find the last number in that text
          const beforeLinkedIn = companyText.substring(0, linkedinIndex);
          // Try patterns from most specific to least specific
          const linkedinPatterns = [
            /\b(\d{1,3}(?:,\d{3})+)\s*on\s+LinkedIn/i,  // Matches "95,264 on LinkedIn" (with word boundary)
            /(\d{1,3}(?:,\d{3})+)\s*on\s+LinkedIn/i,   // Matches "95,264 on LinkedIn"
            /(\d{4,})\s*on\s+LinkedIn/i,                 // Matches "95264 on LinkedIn" (no comma, 4+ digits)
          ];
          
          let found = false;
          for (const pattern of linkedinPatterns) {
            const linkedinMatch = companyText.match(pattern);
        if (linkedinMatch) {
              details.linkedinEmployees = `${linkedinMatch[1]} on LinkedIn`;
              found = true;
              break;
            }
          }
          
          // If no match, try to find the largest number before "on LinkedIn"
          if (!found) {
            const allNumbers = beforeLinkedIn.match(/\d{1,3}(?:,\d{3})+|\d{4,}/g) || [];
            if (allNumbers.length > 0) {
              // Get the number closest to "on LinkedIn" (last one in the text before it)
              const lastNumber = allNumbers[allNumbers.length - 1];
              details.linkedinEmployees = `${lastNumber} on LinkedIn`;
            }
          }
        }

        // Industry
        const industryMatch = companyText.match(/^([^\n•·]+)(?:\s*•|\n|$)/);
        if (industryMatch && !industryMatch[1].includes('employee')) {
          details.industry = industryMatch[1].trim();
        }
      }

    } catch (e) {
      console.warn('[ResumeHub] Error extracting job details:', e);
    }

    return details;
  }

  _updateJobDetailsDisplay(salary, applicants, companySize, industry, linkedinEmployees) {
    const jobDetailsEl = this.root.getElementById('rh-job-details');
    const salaryEl = this.root.getElementById('rh-job-salary');
    const companyInfoEl = this.root.getElementById('rh-job-company-info');
    const applicantsEl = this.root.getElementById('rh-job-applicants');

    if (salary || applicants || companySize || industry) {
      jobDetailsEl.style.display = 'block';
      
      if (salary) {
        salaryEl.textContent = `💰 ${salary}`;
      } else {
        salaryEl.textContent = '';
      }

      const companyInfo = [];
      if (industry) companyInfo.push(`🏭 ${industry}`);
      if (companySize) companyInfo.push(`👥 ${companySize}`);
      if (linkedinEmployees) companyInfo.push(`🔗 ${linkedinEmployees}`);
      companyInfoEl.textContent = companyInfo.join(' • ');

      if (applicants) {
        applicantsEl.textContent = `📊 ${applicants}`;
      } else {
        applicantsEl.textContent = '';
      }
    } else {
      jobDetailsEl.style.display = 'none';
    }

    // Update Company Details section in Job Insights
    this._updateCompanyDetailsSection(companySize, industry, linkedinEmployees);
  }

  async _fetchCompanyDetails(jobDescription, companyName, jobTitle) {
    const companyDetailsEl = this.root.getElementById('rh-company-details');
    if (!companyDetailsEl) return;

    const companyStatsEl = companyDetailsEl.querySelector('.rh-company-stats');
    if (!companyStatsEl) return;

    companyStatsEl.textContent = 'Analyzing company details...';

    try {
      // First get basic details from page
      const jobDetails = this._extractJobDetails();
      const companySize = jobDetails.companySize;
      const industry = jobDetails.industry;
      const linkedinEmployees = jobDetails.linkedinEmployees;

      // Enhance with AI if we have company name
      if (companyName && companyName !== '—') {
        const prompt = `Extract concise company information from this job description. Return ONLY:
- Company size (e.g., "Startup", "Mid-size", "Enterprise") - single word/phrase
- Industry sector - single word/phrase
- Company culture in 3-5 words max (e.g., "Innovation-focused, collaborative")
- Growth stage in 2-4 words (e.g., "Rapid growth", "Established leader")

Return as JSON object: {size, industry, culture, growthStage}
Keep each field to a single line, max 10 words. Eliminate redundant information.

Company Name: ${companyName}
Job Description:
${jobDescription.substring(0, 3000)}`;

        const aiDetails = await this._callAI(prompt, true);
        if (aiDetails && typeof aiDetails === 'object') {
          const details = [];
          if (aiDetails.size || companySize) details.push(`👥 ${(aiDetails.size || companySize).split(' ').slice(0, 3).join(' ')}`);
          if (aiDetails.industry || industry) details.push(`🏭 ${(aiDetails.industry || industry).split(' ').slice(0, 2).join(' ')}`);
          if (linkedinEmployees) details.push(`🔗 ${linkedinEmployees}`);
          if (aiDetails.culture) {
            const cultureShort = aiDetails.culture.split(',').slice(0, 2).join(',').trim();
            details.push(`💼 ${cultureShort}`);
          }
          if (aiDetails.growthStage) {
            const growthShort = aiDetails.growthStage.split(' ').slice(0, 4).join(' ').trim();
            details.push(`📈 ${growthShort}`);
          }
          
          if (details.length > 0) {
            companyStatsEl.innerHTML = details.map(d => `<div style="margin: 4px 0;">${d}</div>`).join('');
            return;
          }
        }
      }

      // Fallback to basic details
      this._updateCompanyDetailsSection(companySize, industry, linkedinEmployees);
    } catch (e) {
      console.warn('[ResumeHub] Error fetching company details:', e);
      const jobDetails = this._extractJobDetails();
      this._updateCompanyDetailsSection(jobDetails.companySize, jobDetails.industry, jobDetails.linkedinEmployees);
    }
  }

  _updateCompanyDetailsSection(companySize, industry, linkedinEmployees) {
    const companyDetailsEl = this.root.getElementById('rh-company-details');
    if (!companyDetailsEl) return;

    const companyStatsEl = companyDetailsEl.querySelector('.rh-company-stats');
    if (!companyStatsEl) return;

    const details = [];
    if (companySize) details.push(`👥 ${companySize}`);
    if (industry) details.push(`🏭 ${industry}`);
    if (linkedinEmployees) details.push(`🔗 ${linkedinEmployees}`);

    if (details.length > 0) {
      companyStatsEl.innerHTML = details.map(d => `<div style="margin: 4px 0;">${d}</div>`).join('');
    } else {
      companyStatsEl.textContent = 'No company details available';
    }
  }

  _showJobInsights(title, company) {
    const companySalaryEl = this.root.getElementById('rh-company-salary');
    const insightsEl = this.root.getElementById('rh-job-insights');
    const prepEl = this.root.getElementById('rh-interview-prep');
    
    if (companySalaryEl) companySalaryEl.style.display = 'block';
    if (insightsEl) insightsEl.style.display = 'block';
    if (prepEl) prepEl.style.display = 'block';
  }

  /**
   * Extract and display job insights (optimized with caching)
   * Uses JobInsightsManager for enterprise-grade caching and optimization
   */
  async _extractAndDisplayJobInsights(forceRefresh = false) {
    // Use insights manager for optimized, cached fetching
    await this._insightsManagerInstance.loadInsights(forceRefresh);
  }

  async _fetchAndDisplaySalary(jobDescription, jobTitle, companyName) {
    const salaryEstimateEl = this.root.getElementById('rh-job-salary-estimate');
    if (!salaryEstimateEl) return;

    const tcEl = this.root.getElementById('rh-salary-tc');
    const breakdownEl = this.root.getElementById('rh-salary-breakdown');
    const confidenceEl = this.root.getElementById('rh-salary-confidence');

    if (!tcEl || !breakdownEl || !confidenceEl) return;

    // Show loading state
    salaryEstimateEl.style.display = 'block';
    tcEl.textContent = 'Estimating salary...';
    breakdownEl.textContent = '';
    confidenceEl.textContent = '';



    try {
      // Get location from job meta
      const jobMeta = this.root.getElementById('rh-job-meta')?.textContent || '';
      // Try to extract location more robustly
      let location = '';
      const metaParts = jobMeta.split('•');
      if (metaParts.length >= 2) {
          location = metaParts[1].trim();
      }
      
      // Fallback: if location is empty or just a dash, try to find it in the job insights or other elements
      if (!location || location === '—' || location === '-') {
          // Try to find location in the job card details if available
          const locationEl = document.querySelector('.job-details-jobs-unified-top-card__primary-description-container .tvm__text--low-emphasis');
          if (locationEl) {
              const text = locationEl.textContent.trim();
              // Usually format is "Company Name · Location · Time"
              const parts = text.split('·');
              if (parts.length >= 2) {
                  location = parts[1].trim();
              }
          }
      }

      // Second fallback: try to get it from the active job card in the list
      if (!location || location === '—' || location === '-') {
           const activeCard = document.querySelector('.jobs-search-results-list__list-item--active');
           if (activeCard) {
               const locEl = activeCard.querySelector('.job-card-container__metadata-item');
               if (locEl) location = locEl.textContent.trim();
           }
      }
      
      const jobUrl = window.location.href || '';



      // Call background script to estimate salary with job description context
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'estimateSalaryWithJD',
          data: {
            jobTitle,
            companyName,
            location,
            jobUrl,
            jobDescription: jobDescription.substring(0, 3000) // Limit description length
          }
        }, (resp) => resolve(resp));
      });




      if (response && response.success && response.salary && !response.salary.error) {
        const { totalCompensation, base, bonus, stock, confidence, currency = '₹' } = response.salary;

        // Format TC line
        const tcText = totalCompensation 
          ? `TC: ${currency}${totalCompensation}` 
          : 'TC: N/A';
        const confidenceText = confidence || 'Medium';
        tcEl.textContent = `${tcText} | Confidence: ${confidenceText}`;

        // Format breakdown
        const parts = [];
        if (base) parts.push(`Base: ${currency}${base}`);
        if (bonus) parts.push(`Bonus: ${currency}${bonus}`);
        if (stock) parts.push(`Stock: ${currency}${stock}`);
        breakdownEl.textContent = parts.length > 0 ? parts.join(' | ') : 'Breakdown: N/A';

        // Confidence indicator
        const confidenceColor = confidence === 'High' ? '#28a745' : 
                               confidence === 'Medium' ? '#ffc107' : '#dc3545';
        confidenceEl.textContent = `Source: ResumeHub`;
        confidenceEl.style.color = confidenceColor;
      } else {
        // Show error state instead of hiding
        console.warn('[ResumeHub] Salary fetch failed or no data:', response);
        if (response.details) {
          console.warn('[ResumeHub] Error details:', response.details);
        }
        tcEl.textContent = 'Salary estimate unavailable';
        breakdownEl.textContent = response?.error || 'No data returned';
        // salaryEstimateEl.style.display = 'none'; // Keep visible for debug
      }
    } catch (e) {
      console.warn('[ResumeHub] Error fetching salary:', e);
      tcEl.textContent = 'Error estimating salary';
      breakdownEl.textContent = e.message;
      // salaryEstimateEl.style.display = 'none'; // Keep visible for debug
    }
  }

  /**
   * Fetch key requirements (used by JobInsightsManager or standalone)
   * @public - can be called by insights manager
   */
  async _fetchKeyRequirements(jobDescription, jobTitle = '') {
    const requirementsEl = this.root.getElementById('rh-key-requirements');
    if (!requirementsEl) return;

    // Check if already populated to prevent overwriting
    if (requirementsEl.innerHTML && 
        requirementsEl.innerHTML !== 'Loading...' && 
        requirementsEl.innerHTML !== 'Analyzing requirements...' &&
        !requirementsEl.innerHTML.includes('Error') &&
        !requirementsEl.innerHTML.includes('No specific') &&
        requirementsEl.innerHTML.includes('rh-requirement-item')) {
      return; // Already populated, don't overwrite
    }

    requirementsEl.innerHTML = 'Analyzing requirements...';

    try {
      const prompt = `Extract 5-7 key requirements from this job description. Focus ONLY on:
- Years of experience required (CRITICAL: Extract exact years mentioned in job description)
- Education level/degree requirements
- Essential certifications or licenses
- Critical soft skills (communication, leadership, etc.)
- Work authorization or location requirements

IMPORTANT: 
- Exclude technical skills/tools/technologies (those go in a separate "skills" section)
- Each requirement must be a single, concise line (max 15 words)
- Return as JSON array of strings
- Eliminate redundant information

YEARS OF EXPERIENCE EXTRACTION RULES:
1. FIRST PRIORITY: If the job description explicitly mentions years (e.g., "4+ years", "at least 5 years", "3-5 years"), use those EXACT numbers
2. SECOND PRIORITY: If the job description mentions experience ranges or minimums (e.g., "minimum 3 years", "2-4 years experience"), extract and use those
3. THIRD PRIORITY: If only job level keywords are mentioned (Associate, Junior, Senior, etc.), analyze the job description context to infer years:
   - Look at the responsibilities, required skills complexity, and other context clues
   - Consider the company size, industry standards mentioned, and role scope
   - Infer reasonable years based on the job description content, not generic industry standards
4. Always phrase as explicit years (e.g., "4+ years", "3-5 years", "minimum 2 years") - never just use level keywords

Job Title: ${jobTitle}
Job Description:
${jobDescription.substring(0, 3000)}`;

      const aiRequirements = await this._callAI(prompt);
      if (aiRequirements && Array.isArray(aiRequirements) && aiRequirements.length > 0) {
        // Filter out any technical skills that might have slipped in
        const filtered = aiRequirements.filter(req => {
          const lower = req.toLowerCase();
          return !lower.includes('javascript') && !lower.includes('python') && 
                 !lower.includes('react') && !lower.includes('aws') && 
                 !lower.includes('sql') && !lower.includes('api') &&
                 !lower.includes('framework') && !lower.includes('database');
        });
        requirementsEl.innerHTML = (filtered.length > 0 ? filtered : aiRequirements.slice(0, 7))
          .map(req => `<div class="rh-requirement-item">• ${req.trim()}</div>`)
          .join('');
        return;
      }

      // Fallback to pattern matching
      this._extractKeyRequirementsFallback(jobDescription, requirementsEl);
    } catch (e) {
      console.warn('[ResumeHub] Error fetching key requirements:', e);
      requirementsEl.textContent = 'Error extracting requirements';
    }
  }

  _extractKeyRequirementsFallback(jobDescription, requirementsEl) {
      const requirements = [];
      const lines = jobDescription.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      
      for (const line of lines) {
        if ((line.match(/^[\s]*[\•\-\*]/) || line.match(/^\d+[\.\)]/)) && 
            (line.toLowerCase().includes('year') || line.toLowerCase().includes('experience') || 
             line.toLowerCase().includes('skill') || line.toLowerCase().includes('knowledge'))) {
          requirements.push(line.replace(/^[\s]*[\•\-\*\d\.\)]+/, '').trim());
        }
      }

      if (requirements.length > 0) {
        requirementsEl.innerHTML = requirements.slice(0, 5).map(req => 
          `<div class="rh-requirement-item">• ${req}</div>`
        ).join('');
      } else {
        requirementsEl.textContent = 'No specific requirements found';
    }
  }

  async _fetchRequiredSkills(jobDescription) {
    const skillsEl = this.root.getElementById('rh-required-skills');
    if (!skillsEl) return;

    skillsEl.innerHTML = 'Analyzing skills...';

    try {
      const prompt = `Extract ONLY technical skills, tools, and technologies from this job description.

IMPORTANT:
- Exclude years of experience, education, certifications, soft skills (those are in "requirements")
- Return 8-12 unique skills as JSON array
- Each skill: single term or 2-word phrase max (e.g., "JavaScript", "React", "AWS", "Docker", "REST APIs")
- No redundant skills (e.g., don't include both "JavaScript" and "JS")
- Prioritize most frequently mentioned skills

Job Description:
${jobDescription.substring(0, 3000)}`;

      const aiSkills = await this._callAI(prompt);
      if (aiSkills && Array.isArray(aiSkills) && aiSkills.length > 0) {
        // Remove duplicates and limit length
        const uniqueSkills = [...new Set(aiSkills.map(s => s.trim()))]
          .filter(s => s.length > 0 && s.length < 30)
          .slice(0, 12);
        skillsEl.innerHTML = uniqueSkills.map(skill => 
          `<span class="rh-skill-tag">${skill}</span>`
        ).join('');
        return;
      }

      // Fallback to pattern matching
      this._extractRequiredSkillsFallback(jobDescription, skillsEl);
          } catch (e) {
      console.warn('[ResumeHub] Error fetching required skills:', e);
      this._extractRequiredSkillsFallback(jobDescription, skillsEl);
    }
  }

  _extractRequiredSkillsFallback(jobDescription, skillsEl) {
      const commonSkills = [
        'JavaScript', 'Python', 'Java', 'React', 'Node.js', 'SQL', 'MongoDB', 
        'AWS', 'Docker', 'Kubernetes', 'Git', 'API', 'REST', 'GraphQL',
        'TypeScript', 'Angular', 'Vue.js', 'PostgreSQL', 'Redis', 'Elasticsearch',
        'Machine Learning', 'AI', 'Data Science', 'Analytics', 'DevOps', 'CI/CD',
        'Microservices', 'Agile', 'Scrum', 'Problem Solving', 'Communication'
      ];

      const foundSkills = commonSkills.filter(skill => 
        jobDescription.toLowerCase().includes(skill.toLowerCase())
      );

      if (foundSkills.length > 0) {
        skillsEl.innerHTML = foundSkills.slice(0, 8).map(skill => 
          `<span class="rh-skill-tag">${skill}</span>`
        ).join('');
      } else {
        skillsEl.innerHTML = '<span class="rh-skill-tag">Software Development</span><span class="rh-skill-tag">Problem Solving</span>';
    }
  }

  async _fetchInterviewQuestions(jobDescription, jobTitle = '') {
    const questionsEl = this.root.getElementById('rh-interview-questions');
    if (!questionsEl) return;
    
      questionsEl.innerHTML = 'Generating personalized questions...';
      
      try {
      const prompt = `Generate 5-6 concise interview questions for this role.

Requirements:
- 2-3 technical questions (one line each, max 15 words)
- 2-3 behavioral questions (one line each, max 15 words)
- Questions must be specific to this job's technologies/responsibilities
- Keep questions short and direct - no verbose explanations

Return as JSON array: [{"type": "technical"|"behavioral", "question": "..."}]
Each question must be a single, concise line.

Job Title: ${jobTitle}
Job Description:
${jobDescription.substring(0, 3000)}`;

      const aiQuestions = await this._callAI(prompt);
      if (aiQuestions && Array.isArray(aiQuestions) && aiQuestions.length > 0) {
        const formattedQuestions = aiQuestions.slice(0, 6).map(q => {
          const icon = q.type === 'technical' ? '⚡' : '💭';
          const question = q.question.length > 80 ? q.question.substring(0, 77) + '...' : q.question;
          const starNote = q.type === 'behavioral' ? ' <em>(STAR)</em>' : '';
          return `${icon} ${question}${starNote}`;
        });
        questionsEl.innerHTML = formattedQuestions.map(q => 
            `<div class="rh-question-item">${q}</div>`
          ).join('');
        return;
      }

          // Fallback questions
          this._setFallbackQuestions(questionsEl);
      } catch (e) {
      console.warn('[ResumeHub] Error fetching interview questions:', e);
        this._setFallbackQuestions(questionsEl);
      }
    }
    
  async _fetchHelpfulResources(jobDescription, jobTitle = '', companyName = '') {
    const resourcesEl = this.root.getElementById('rh-helpful-resources');
    if (!resourcesEl) return;

    resourcesEl.innerHTML = 'Loading resources...';

    try {
      const prompt = `Based on this job description, suggest 4-5 specific helpful resources for interview preparation.

Return as JSON array of objects: [{"name": "Resource Name", "url": "https://..."}]
Resources should be:
- Specific to the technologies/skills mentioned in the job
- Relevant learning platforms, documentation, or practice sites
- Company-specific resources if available
- Interview preparation tools relevant to the role

Keep resource names concise (max 3-4 words). Return actual URLs when possible.

Job Title: ${jobTitle}
Company: ${companyName}
Job Description:
${jobDescription.substring(0, 2000)}`;

      const aiResources = await this._callAI(prompt);
      if (aiResources && Array.isArray(aiResources) && aiResources.length > 0) {
        const validResources = aiResources
          .filter(r => r && r.name && r.url)
          .slice(0, 5)
          .map(r => ({
            name: r.name.length > 30 ? r.name.substring(0, 27) + '...' : r.name,
            url: r.url.startsWith('http') ? r.url : '#'
          }));
        
        if (validResources.length > 0) {
          resourcesEl.innerHTML = validResources.map(res => 
            `<div class="rh-resource-item">
              <span>🔗</span>
              <a href="${res.url}" target="_blank" class="rh-resource-link">${res.name}</a>
            </div>`
          ).join('');
          return;
        }
      }

      // Fallback to generic resources
      this._setFallbackResources(resourcesEl);
    } catch (e) {
      console.warn('[ResumeHub] Error fetching helpful resources:', e);
      this._setFallbackResources(resourcesEl);
    }
  }

  _setFallbackResources(resourcesEl) {
    if (!resourcesEl) return;
      const resources = [
        { name: 'LeetCode Practice', url: 'https://leetcode.com' },
        { name: 'System Design Primer', url: 'https://github.com/donnemartin/system-design-primer' },
      { name: 'Glassdoor Reviews', url: 'https://glassdoor.com' }
      ];
      
      resourcesEl.innerHTML = resources.map(res => 
        `<div class="rh-resource-item">
          <span>🔗</span>
          <a href="${res.url}" target="_blank" class="rh-resource-link">${res.name}</a>
        </div>`
      ).join('');
    }

  async _generateInterviewContent(jobDescription) {
    // This is now handled by _fetchInterviewQuestions and _fetchHelpfulResources
    // Keeping for backward compatibility
    this._setFallbackResources(this.root.getElementById('rh-helpful-resources'));
  }

  // Unified AI call helper
  async _callAI(prompt, expectJSON = true) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'getAIResponse',
        prompt: prompt
      }, (response) => {
        if (response && response.success && response.content) {
          try {
            if (expectJSON) {
              // Try to parse as JSON
              const parsed = JSON.parse(response.content);
              resolve(parsed);
            } else {
              // Return as text
              resolve(response.content);
            }
          } catch (e) {
            // If JSON parsing fails, try to extract JSON from text
            if (expectJSON) {
              try {
                // Look for JSON array or object in the response
                const jsonMatch = response.content.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
                if (jsonMatch) {
                  const parsed = JSON.parse(jsonMatch[0]);
                  resolve(parsed);
                } else {
                  // Fallback: try to parse as array of strings (one per line)
            const lines = response.content.split('\n')
                    .map(line => line.replace(/^[\s\-\•\*\d\.\)]+/, '').trim())
                    .filter(line => line.length > 10);
                  resolve(lines);
                }
              } catch (e2) {
                console.warn('[ResumeHub] Failed to parse AI response:', e2);
                resolve(null);
              }
            } else {
              resolve(response.content);
            }
          }
        } else {
          resolve(null);
        }
      });
    });
  }

  _setFallbackQuestions(questionsEl) {
    const fallbackQuestions = [
      '⚡ Implement a function to reverse a linked list',
      '⚡ Design a URL shortening service like bit.ly',
      '⚡ Explain the difference between SQL and NoSQL databases',
      '💭 Describe a time you had to learn a new technology quickly <em>(Use STAR format)</em>',
      '💭 Tell me about a project where you had to work with a difficult team member <em>(Use STAR format)</em>',
      '💭 How do you handle conflicting priorities and tight deadlines? <em>(Use STAR format)</em>'
    ];
    
    questionsEl.innerHTML = fallbackQuestions.map(q => 
      `<div class="rh-question-item">${q}</div>`
    ).join('');
  }



  /**
   * Clear insights cache when job changes significantly
   */
  _clearInsightsCache() {
    if (this._insightsManager) {
      this._insightsManager.clearCache();
    }
  }

  _updateExtractedJDDisplay(text, isLoading = false, isError = false) {
    const extractedJdWrap = this.root.getElementById('rh-extracted-jd-wrap');
    const extractedJdTextarea = this.root.getElementById('rh-extracted-jd');
    const extractedJdStatus = this.root.getElementById('rh-extracted-jd-status');
    
    if (!extractedJdWrap || !extractedJdTextarea || !extractedJdStatus) return;
    
    // Show the section if we have content or are loading
    if (text && text.trim().length > 0) {
      extractedJdWrap.style.display = '';
      extractedJdTextarea.value = text;
      
      if (isLoading) {
        extractedJdStatus.textContent = 'Extracting...';
        extractedJdStatus.style.color = 'var(--rh-text-secondary)';
      } else if (isError) {
        extractedJdStatus.textContent = 'Extraction failed';
        extractedJdStatus.style.color = 'var(--rh-danger)';
      } else {
        extractedJdStatus.textContent = `Extracted ${text.length} characters`;
        extractedJdStatus.style.color = 'var(--rh-success)';
      }
    } else if (isLoading) {
      extractedJdWrap.style.display = '';
      extractedJdTextarea.value = '';
      extractedJdStatus.textContent = 'Extracting...';
      extractedJdStatus.style.color = 'var(--rh-text-secondary)';
    }
  }

  async _getCurrentTabId() {
    try {
      // Content scripts can't use chrome.tabs.query directly
      // Request tab ID from background script
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'getCurrentTabId' }, (resp) => {
          resolve(resp);
        });
      });
      if (response && response.tabId) {
        this._currentTabId = response.tabId;
      } else {
        // Fallback: use URL as identifier
        this._currentTabId = location.href;
      }
    } catch (e) {
      // Fallback: use URL as identifier
      this._currentTabId = location.href;
    }
  }

  _getStorageKey() {
    // Use tab ID if available, otherwise use URL
    const identifier = this._currentTabId || location.href;
    return `tailoredResume_${identifier}`;
  }

  async _storeTailoredResume(resumeJSON, isAutoTailor = false) {
    try {
      const key = this._getStorageKey();
      // Store resume with auto-tailor flag if needed
      const resumeToStore = isAutoTailor ? { ...resumeJSON, _isAutoTailor: true } : resumeJSON;
      await new Promise((resolve) => {
        chrome.storage.local.set({ [key]: resumeToStore }, () => resolve());
      });
    } catch (e) {
      console.warn('[ResumeHub] Failed to store tailored resume:', e);
    }
  }

  async _getStoredTailoredResume() {
    try {
      const key = this._getStorageKey();
      const result = await new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => resolve(result));
      });
      return result[key] || null;
    } catch (e) {
      console.warn('[ResumeHub] Failed to get stored tailored resume:', e);
      return null;
    }
  }

  _wireActions() {
    const output = this.root.getElementById('rh-output');
    const extractBtn = this.root.getElementById('rh-extract');
    const extractInsightsBtn = this.root.getElementById('rh-extract-insights');
    const tailorBtn = this.root.getElementById('rh-tailor');
    const downloadButtons = this.root.getElementById('rh-download-buttons');
    const downloadDocxBtn = this.root.getElementById('rh-download-docx');
    const downloadPdfBtn = this.root.getElementById('rh-download-pdf');
    const downloadTxtBtn = this.root.getElementById('rh-download-txt');

    // Wire download buttons
    if (downloadDocxBtn) {
      downloadDocxBtn.onclick = () => this._downloadResume('docx');
    }
    if (downloadPdfBtn) {
      downloadPdfBtn.onclick = () => this._downloadResume('pdf');
    }
    if (downloadTxtBtn) {
      downloadTxtBtn.onclick = () => this._downloadResume('txt');
    }

    // Helper function to extract job description (returns Promise)
    const extractJobDescriptionAsync = () => {
      return new Promise((resolve) => {
        this._updateExtractedJDDisplay('Extracting job description…', true);
        
        // Prefer AI method if key is set; background will validate (same as Preview button)
        // Force refresh to always get fresh data instead of cached data
        chrome.runtime.sendMessage({ action: 'getJobDescription', extractionMethod: 'ai', forceRefresh: true }, (resp) => {
          if (!resp || !resp.success) {
            // Fallback to standard with force refresh
            chrome.runtime.sendMessage({ action: 'getJobDescription', extractionMethod: 'standard', forceRefresh: true }, (resp2) => {
              if (resp2 && resp2.success && resp2.jobDescription) {
                // Update both output (if exists) and extracted JD display
                if (output) output.value = resp2.jobDescription || '';
                this._lastExtractedJD = resp2.jobDescription;
                this._updateExtractedJDDisplay(resp2.jobDescription, false);
                // Fetch AI insights after extraction
                this._extractAndDisplayJobInsights();
                // Resolve with the extracted JD
                resolve(resp2.jobDescription);
              } else {
                const errorMsg = resp2?.error || 'Failed to extract job description';
                if (output) output.value = errorMsg;
                this._updateExtractedJDDisplay(errorMsg, false, true);
                resolve(null);
              }
              // Update last extracted signature
              const currentJobSig = `${this.root.getElementById('rh-job-title')?.textContent || ''}|${this.root.getElementById('rh-job-meta')?.textContent || ''}|${location.href}`;
              this._lastExtractedJobSig = currentJobSig;
            });
            return;
          }
          if (resp.jobDescription) {
            // Update both output (if exists) and extracted JD display
            if (output) output.value = resp.jobDescription || '';
            this._lastExtractedJD = resp.jobDescription;
            this._updateExtractedJDDisplay(resp.jobDescription, false);
            // Update last extracted signature
            const currentJobSig = `${this.root.getElementById('rh-job-title')?.textContent || ''}|${this.root.getElementById('rh-job-meta')?.textContent || ''}|${location.href}`;
            this._lastExtractedJobSig = currentJobSig;
            // Fetch AI insights after extraction (no force refresh needed)
            this._extractAndDisplayJobInsights(false);
            // Resolve with the extracted JD
            resolve(resp.jobDescription);
          } else {
            const errorMsg = 'No job description found';
            if (output) output.value = errorMsg;
            this._updateExtractedJDDisplay(errorMsg, false, true);
            resolve(null);
          }
        });
      });
    };

    extractBtn.onclick = () => {
      extractJobDescriptionAsync();
    };

    if (extractInsightsBtn) {
      extractInsightsBtn.onclick = async () => {
        // Ensure we have a job description first
        let extractedJD = this._lastExtractedJD || output?.value || '';
        if (!extractedJD || extractedJD.length < 30) {
          extractedJD = await extractJobDescriptionAsync();
        }
        
        if (extractedJD && extractedJD.length >= 30) {
          // Show insights sections
          const title = this.root.getElementById('rh-job-title')?.textContent || '';
          const company = this.root.getElementById('rh-job-meta')?.textContent || '';
          this._showJobInsights(title, company);
          
          // Trigger insights extraction
          this._extractAndDisplayJobInsights(true);
        }
      };
    }

    tailorBtn.onclick = async () => {
      // Prevent multiple simultaneous tailoring operations
      if (this._isTailoring) {
        return;
      }

      // Get job description from extracted JD section, stored value, or output
      const extractedJdTextarea = this.root.getElementById('rh-extracted-jd');
      let extractedJD = extractedJdTextarea?.value || this._lastExtractedJD || output?.value || '';
      
      // Requires a resume in storage and a job description
      if (!extractedJD || extractedJD.length < 30) {
        // Try to get JD first - wait for extraction to complete
        extractedJD = await extractJobDescriptionAsync();
        if (!extractedJD || extractedJD.length < 30) {
          // Extraction failed or produced insufficient content
          return;
        }
      }

      // Set processing state
      this._isTailoring = true;
      tailorBtn.disabled = true;
      tailorBtn.textContent = '⏳ Tailoring...';
      this._toggleDownloadButtons(false);

      try {
        // Get resume from background (same as Generate Tailored Resume)
        const getResume = () => new Promise((res) => chrome.runtime.sendMessage({ action: 'getResume' }, (r) => res(r)));
        const resumeData = await getResume();
        if (!resumeData || !resumeData.content) {
          throw new Error('No resume found. Please upload your resume via the extension popup first.');
        }

        // Get API token for extraction method
        const getApiToken = () => new Promise((res) => {
          chrome.runtime.sendMessage({ action: 'getAPIToken' }, (resp) => {
            res(resp?.token || null);
          });
        });
        const apiToken = await getApiToken();

        // Call same function as Generate Tailored Resume
        // Use arrow function with proper context binding
        const handleTailorResponse = async (resp) => {
          try {
            if (!resp || !resp.success) {
              throw new Error(resp?.error || 'Failed to tailor resume.');
            }

            const tailoredResumeJSON = resp.tailoredResumeJSON;
            if (!tailoredResumeJSON) {
              throw new Error('No tailored resume returned.');
            }

            // Store tailored resume for this tab (manual tailoring, not auto)
            await this._storeTailoredResume(tailoredResumeJSON, false);

            // Show success and enable download buttons (manual tailoring shows buttons)
            this._toggleDownloadButtons(true);
            tailorBtn.textContent = '✨ Tailor';
            tailorBtn.disabled = false;
            
            // Update status if output exists
            if (output) {
              output.value = 'Resume tailored successfully! Use download buttons to save.';
            }
          } catch (e) {
            console.error('[ResumeHub] Error in tailor callback:', e);
            tailorBtn.textContent = '✨ Tailor';
            tailorBtn.disabled = false;
            if (output) {
              output.value = `Error: ${e.message}`;
            }
          }
        };
        
        chrome.runtime.sendMessage({ 
          action: 'createTailoredResume', 
          resumeData, 
          jobDescriptionOverride: extractedJD,
          apiToken: apiToken,
          extractionMethod: 'ai' // Use AI method like popup
        }, handleTailorResponse);
      } catch (e) {
        console.error('[ResumeHub] Tailoring failed:', e);
        tailorBtn.textContent = '✨ Tailor';
        tailorBtn.disabled = false;
        if (output) {
          output.value = `Error: ${e.message}`;
        }
      } finally {
        this._isTailoring = false;
      }
    };
  }

  _toggleDownloadButtons(show) {
    const downloadButtons = this.root.getElementById('rh-download-buttons');
    if (downloadButtons) {
      downloadButtons.style.display = show ? 'flex' : 'none';
    }
  }

  async _downloadResume(format) {
    try {
      // Get stored tailored resume for this tab
      const resumeJSON = await this._getStoredTailoredResume();
      
      if (!resumeJSON) {
        alert('No tailored resume available. Please tailor your resume first.');
            return;
          }

      // Generate filename with timestamp
      // Note: Dynamic imports are not allowed in service worker context, so we generate the timestamp locally
      let baseFilename = 'tailored_resume';
      try {
        if (typeof SharedUtilities !== 'undefined' && SharedUtilities.generateTimestampedFilename) {
          baseFilename = SharedUtilities.generateTimestampedFilename('tailored_resume', '').replace(/\.$/, '');
        } else {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
          baseFilename = `tailored_resume_${timestamp}`;
        }
      } catch (e) {
        // Fallback if SharedUtilities fails
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        baseFilename = `tailored_resume_${timestamp}`;
      }

      switch (format.toLowerCase()) {
        case 'txt':
          this._downloadAsText(resumeJSON, baseFilename);
          break;
        case 'pdf':
          this._downloadAsPdf(resumeJSON, baseFilename);
          break;
        case 'docx':
          this._downloadAsDocx(resumeJSON, baseFilename);
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }
    } catch (error) {
      console.error(`[ResumeHub] Download ${format} failed:`, error);
      alert(`Download failed: ${error.message}`);
    }
  }

  _downloadAsText(resumeJSON, baseFilename) {
    let textContent;
    if (typeof SharedUtilities !== 'undefined' && SharedUtilities.convertJSONToText) {
      textContent = SharedUtilities.convertJSONToText(resumeJSON);
    } else {
      // Fallback text conversion
      textContent = this._convertResumeJSONToTextFallback(resumeJSON);
    }
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    this._downloadBlob(url, `${baseFilename}.txt`);
  }

  _convertResumeJSONToTextFallback(resumeJSON) {
    // Simple fallback text conversion
    let text = '';
    
    if (resumeJSON.contact) {
      if (resumeJSON.contact.name) text += `${resumeJSON.contact.name}\n`;
      if (resumeJSON.contact.email) text += `Email: ${resumeJSON.contact.email}\n`;
      if (resumeJSON.contact.phone) text += `Phone: ${resumeJSON.contact.phone}\n`;
      text += '\n';
    }
    
    if (resumeJSON.experience && Array.isArray(resumeJSON.experience)) {
      text += 'WORK EXPERIENCE\n\n';
      resumeJSON.experience.forEach(exp => {
        text += `${exp.title || ''} | ${exp.company || ''}\n`;
        if (exp.dates) text += `${exp.dates}\n`;
        if (exp.bullets) {
          exp.bullets.forEach(bullet => text += `  • ${bullet}\n`);
        }
        text += '\n';
      });
    }
    
    if (resumeJSON.education && Array.isArray(resumeJSON.education)) {
      text += 'EDUCATION\n\n';
      resumeJSON.education.forEach(edu => {
        text += `${edu.institution || ''} - ${edu.degree || ''}\n`;
        if (edu.dates) text += `${edu.dates}\n`;
        text += '\n';
      });
    }
    
    if (resumeJSON.skills && Array.isArray(resumeJSON.skills)) {
      text += 'SKILLS\n\n';
      resumeJSON.skills.forEach(skillCat => {
        if (skillCat.category) text += `${skillCat.category}: `;
        if (skillCat.items) text += skillCat.items.join(', ');
        text += '\n';
      });
    }
    
    return text;
  }

  async _downloadAsPdf(resumeJSON, baseFilename) {
    try {
      // Check if pdfMake is available
      if (typeof pdfMake === 'undefined') {
        try {
          // Dynamically import pdfmake and vfs_fonts into the content script context
          await import(chrome.runtime.getURL('lib/pdfmake.min.js'));
          await import(chrome.runtime.getURL('lib/vfs_fonts.js'));
          
          // Wait a brief moment to ensure global assignment (if any async init)
          if (typeof pdfMake === 'undefined' && typeof window.pdfMake !== 'undefined') {
             // In case it attached to window but not local scope
             // Note: In modules, top-level 'this' is undefined, so libs might attach to 'window' explicitly.
          }
        } catch (e) {
          console.error('[ResumeHub] Failed to load pdfMake via import:', e);
          // Fallback to script injection if import fails (though this puts it in page context, which won't help us here)
          // If import fails, we probably can't generate PDF in content script.
          throw new Error('Could not load PDF libraries');
        }
      }
      
      this._generateAndDownloadPdf(resumeJSON, baseFilename);
    } catch (error) {
      console.error('[ResumeHub] PDF generation failed:', error);
      alert('PDF generation failed. Please try TXT format instead.');
      this._downloadAsText(resumeJSON, baseFilename);
    }
  }

  _generateAndDownloadPdf(resumeJSON, baseFilename) {
    try {
      // Check if PdfGenerator is available
    if (typeof PdfGenerator === 'undefined') {
      (async () => {
        try {
          const src = chrome.runtime.getURL('utils/pdf-generator.js');
          const module = await import(src);
          // If the module exports PdfGenerator directly or as default, or we can use the named export
          const generator = module.PdfGenerator || module; 
          // Note: The module attaches to window.PdfGenerator, but in content script import() might not share window in the same way if it was a separate context, 
          // but import() returns the module namespace object.
          // Our pdf-generator.js exports 'generatePdfDefinition' and 'PdfGenerator'.
          
          const docDefinition = module.generatePdfDefinition(resumeJSON);
          pdfMake.createPdf(docDefinition).download(`${baseFilename}.pdf`);

        } catch (e) {
          console.error('[ResumeHub] Failed to load PDF generator:', e);
          alert('PDF generation failed. Falling back to text format.');
          this._downloadAsText(resumeJSON, baseFilename);
        }
      })();
      return;
    }
      const docDefinition = PdfGenerator.generatePdfDefinition(resumeJSON);
      pdfMake.createPdf(docDefinition).download(`${baseFilename}.pdf`);

    } catch (error) {
      console.error('[ResumeHub] PDF generation error:', error);
      alert('PDF generation failed. Falling back to text format.');
      this._downloadAsText(resumeJSON, baseFilename);
    }
  }



  _downloadAsDocx(resumeJSON, baseFilename) {
    // Check if DocxGenerator is available
    if (typeof DocxGenerator === 'undefined') {
      (async () => {
        try {
          const src = chrome.runtime.getURL('utils/docx-generator.js');
          const module = await import(src);
          const generator = module.DocxGenerator || module;
          
          const blob = module.generateDocxBlob(resumeJSON);
          const url = URL.createObjectURL(blob);
          this._downloadBlob(url, `${baseFilename}.docx`);

        } catch (e) {
          console.error('[ResumeHub] Failed to load DOCX generator:', e);
          alert('DOCX generation failed. Falling back to text format.');
          this._downloadAsText(resumeJSON, baseFilename);
        }
      })();
      return;
    }

    const blob = DocxGenerator.generateDocxBlob(resumeJSON);
    const url = URL.createObjectURL(blob);
    this._downloadBlob(url, `${baseFilename}.docx`);

  }

  _downloadBlob(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
