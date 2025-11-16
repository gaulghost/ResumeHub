# Fix: Missing `await` on Async `_getCurrentTabId()` Call

## Problem
The `_getCurrentTabId()` async function was called without `await` on line 209 in the `mount()` method of `ResumeHubSidebar`. This caused a race condition where the subsequent function `_checkExistingTailoredResume()` would execute before `this._currentTabId` was set.

### Impact
1. **Race Condition**: `_checkExistingTailoredResume()` on line 212 executed before `this._currentTabId` was initialized
2. **Null Storage Keys**: When `_getStorageKey()` was called, `this._currentTabId` was still `null`, causing fallback to `location.href`
3. **Inconsistent Storage**: The same tailored resume could be stored under different keys:
   - If called with proper tab ID later: `tailoredResume_<tabId>`
   - If called initially (buggy): `tailoredResume_<url>`
4. **Lost Resumes**: Previously stored tailored resumes wouldn't be found if the storage key changed between storage and retrieval
5. **Storage Chain**: Affected functions in order:
   - `mount()` line 209: Called `_getCurrentTabId()` without await
   - `_checkExistingTailoredResume()` line 212: Tries to retrieve stored resume
   - `_getStoredTailoredResume()` line 3066: Calls `_getStorageKey()`
   - `_getStorageKey()` line 3047: Uses `this._currentTabId || location.href`

## Solution
Added `await` keyword before `_getCurrentTabId()` call to ensure it completes before the dependent function executes.

### Code Change
**File**: `content-scripts/linkedin/components/right-sidebar.js`  
**Lines**: 208-209

**Before (Buggy)**:
```javascript
// Get current tab ID for storage
this._getCurrentTabId();

// Check if we already have a tailored resume for this tab
this._checkExistingTailoredResume();
```

**After (Fixed)**:
```javascript
// Get current tab ID for storage (must be awaited before using _currentTabId)
await this._getCurrentTabId();

// Check if we already have a tailored resume for this tab
this._checkExistingTailoredResume();
```

## Technical Details

### `_getCurrentTabId()` Function (line 3024)
```javascript
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
      this._currentTabId = response.tabId;  // ← Sets this._currentTabId
    } else {
      // Fallback: use URL as identifier
      this._currentTabId = location.href;
    }
  // ...
}
```

The function:
1. Sends async message to background script
2. Waits for response (involves network communication)
3. Sets `this._currentTabId` based on response
4. **Must complete before any code that uses `this._currentTabId`**

### Storage Key Generation (line 3045)
```javascript
_getStorageKey() {
  // Use tab ID if available, otherwise use URL
  const identifier = this._currentTabId || location.href;
  return `tailoredResume_${identifier}`;
}
```

Without the await:
- `this._currentTabId` = `null` initially
- Falls back to `location.href` = `"https://www.linkedin.com/jobs/view/..."`
- Storage key = `"tailoredResume_https://www.linkedin.com/jobs/view/..."`

With the await:
- `this._currentTabId` = `<actual_tab_id>` (e.g., `12345`)
- Storage key = `"tailoredResume_12345"`

## Why This Matters

### Scenario 1: Storing and Retrieving Same Resume
1. User tailors resume (stores with tab ID: `"tailoredResume_12345"`)
2. User reloads page
3. Mount runs without await bug:
   - `_getCurrentTabId()` starts but hasn't completed
   - `_checkExistingTailoredResume()` runs immediately
   - Tries to get resume with key `"tailoredResume_https://..."`
   - **Resume not found** because it was stored as `"tailoredResume_12345"`
4. Download buttons don't show even though resume exists!

### Scenario 2: Auto-Tailored Resume
1. Background script stores auto-tailored resume with tab ID
2. Content script checks for it with URL key (due to bug)
3. **Auto-tailored resume not found**
4. Re-extraction happens unnecessarily

## Dependencies Fixed

```
mount() [line 206]
├── await this._updateJobContext()
├── await this._getCurrentTabId() [FIXED: added await]
│   └── sets this._currentTabId
├── this._checkExistingTailoredResume() [depends on _currentTabId]
│   └── this._getStoredTailoredResume()
│       └── this._getStorageKey()
│           └── uses this._currentTabId ✓ now properly initialized
└── this._startAutoTailorPolling()
```

## Testing

To verify the fix works:

1. **Manual Test**: 
   - Open a LinkedIn job page
   - Click "Tailor" to generate a tailored resume
   - Click "Download" to verify resume is stored
   - Reload the page (F5)
   - Verify "Download" buttons appear immediately (resume is found)

2. **Auto-Tailor Test**:
   - Enable AI Autopilot mode
   - Navigate between job pages
   - Verify tailored resumes are properly retrieved each time

3. **Browser DevTools**:
   - Open `chrome://extensions/` → ResumeHub → Inspect
   - Check console for storage key logs
   - Verify consistency: Should use tab ID, not URL

## Files Modified
- `content-scripts/linkedin/components/right-sidebar.js` (line 209)

## Related Functions
- `_getCurrentTabId()` (line 3024) - Sets `_currentTabId`
- `_getStorageKey()` (line 3045) - Uses `_currentTabId`
- `_getStoredTailoredResume()` (line 3064) - Calls `_getStorageKey()`
- `_checkExistingTailoredResume()` (line 270) - Calls `_getStoredTailoredResume()`
- `mount()` (line 128) - Calls both functions

## Severity
**HIGH** - This is a critical race condition that could cause:
- Loss of user-generated tailored resumes
- Inability to retrieve stored resumes after page reload
- Inconsistent application behavior between first load and subsequent loads

