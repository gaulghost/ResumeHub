/** Extracted LinkedIn sidebar CSS + HTML template */

export function getSidebarCss() {
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
      
      .rh-sidebar.collapsed.rh-small-icon {
        width: 36px;
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

      .rh-sidebar.collapsed.rh-small-icon .rh-tab-label {
        display: none;
      }
      
      .rh-sidebar.collapsed.rh-small-icon .rh-tab-icon {
        width: 24px;
        height: 24px;
        font-size: 14px;
        margin-right: 8px;
      }

      .rh-sidebar.collapsed.rh-small-icon .rh-collapsed-tab {
        width: 36px;
        min-width: 36px;
        border-radius: var(--rh-radius) 0 0 var(--rh-radius);
      }
      
      .rh-sidebar.collapsed.rh-small-icon .rh-tab-content {
        padding: 0;
        margin: 0;
        justify-content: center;
        width: 100%;
        height: 100%;
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
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: var(--rh-bg);
        border: 1px solid var(--rh-border);
        top: 3px;
        left: 3px;
        transition: transform var(--rh-transition-base), inherit;
      }
      
      .theme-dark .rh-theme-toggle-label::after {
        background: var(--rh-bg-2);
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

      /* Generic Feature Toggle */
      .rh-feature-switch {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        color: var(--rh-text);
      }

      .rh-feature-toggle {
        position: relative;
        width: 44px;
        height: 24px;
      }

      .rh-feature-toggle-checkbox {
        opacity: 0;
        width: 0;
        height: 0;
        position: absolute;
      }

      .rh-feature-toggle-bg {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: var(--rh-bg-3);
        transition: .3s;
        border-radius: 12px;
        border: 1px solid var(--rh-border);
      }

      .rh-feature-toggle-bg:before {
        position: absolute;
        content: "";
        height: 18px;
        width: 18px;
        left: 2px;
        bottom: 2px;
        background-color: white;
        transition: .3s;
        border-radius: 50%;
        box-shadow: var(--rh-shadow-sm);
      }

      .theme-dark .rh-feature-toggle-bg:before {
        background-color: var(--rh-bg);
      }

      .rh-feature-toggle-checkbox:checked + .rh-feature-toggle-bg {
        background-color: var(--rh-accent);
        border-color: var(--rh-accent);
      }

      .rh-feature-toggle-checkbox:checked + .rh-feature-toggle-bg:before {
        transform: translateX(20px);
        background-color: white;
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

export function getSidebarHtml() {
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
        
          <div class="rh-section" id="rh-behavior" style="padding-bottom: 8px;">
            <div class="rh-feature-switch">
              <span style="font-size: 13px; font-weight: 500;">Compact Icon</span>
              <label class="rh-feature-toggle">
                <input type="checkbox" id="rh-minify-checkbox" class="rh-feature-toggle-checkbox">
                <span class="rh-feature-toggle-bg" id="rh-minify-bg"></span>
              </label>
            </div>
            <div style="font-size: 11px; color: var(--rh-text-secondary); margin-top: 4px;">Shrink the sidebar tab when closed.</div>
          </div>

          <div class="rh-section rh-collapsible collapsed" id="rh-api">
            <h4 class="rh-collapsible-header" id="rh-api-header">🔑 Self-Hosted API Config <span class="rh-chevron">▼</span></h4>
            <div class="rh-collapsible-content" id="rh-api-content">
              <div class="rh-row">
                <input type="password" id="rh-api-input" placeholder="Self-Hosted Gemini API Key" />
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
