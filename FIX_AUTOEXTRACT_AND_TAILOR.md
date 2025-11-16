# Fix: Auto-Extract and Tailor Button Issues

## Problems Identified

### 1. Auto-Extract Not Working (Background AI Mode)
When "Enable background AI mode" was enabled and you navigated to a new job, auto-extraction wasn't triggering properly.

**Root Cause**: The `_autoExtractJobDescription()` function was NOT using `forceRefresh: true`, so it would:
- Use cached data from previous extractions
- Return stale job descriptions
- Not extract fresh data when job changed

### 2. Tailor Button Not Working  
When clicking the Tailor button, it would either fail silently or show errors about missing `this` context.

**Root Cause 1**: The callback function passed to `chrome.runtime.sendMessage()` wasn't properly maintaining context, causing `this._storeTailoredResume()` and `this._toggleDownloadButtons()` to fail.

**Root Cause 2**: Context binding issue with inline async arrow function in callback

## Solutions Implemented

### Fix 1: Auto-Extract Force Refresh
**File**: `content-scripts/linkedin/components/right-sidebar.js`  
**Function**: `_autoExtractJobDescription()` (line 2941)

**Before (Buggy)**:
```javascript
chrome.runtime.sendMessage({ 
  action: 'getJobDescription', 
  extractionMethod: 'ai' 
}, (resp) => {
  // Uses cached data!
});
```

**After (Fixed)**:
```javascript
chrome.runtime.sendMessage({ 
  action: 'getJobDescription', 
  extractionMethod: 'ai',
  forceRefresh: true  // ← Forces fresh extraction
}, (resp) => {
  // Always gets fresh data
});
```

**Also applied to fallback**:
```javascript
chrome.runtime.sendMessage({ 
  action: 'getJobDescription', 
  extractionMethod: 'standard',
  forceRefresh: true  // ← Same for fallback
}, (resp2) => { ... });
```

### Fix 2: Tailor Button Context Binding
**File**: `content-scripts/linkedin/components/right-sidebar.js`  
**Function**: Tailor button onclick handler (line 3158)

**Before (Buggy)**:
```javascript
chrome.runtime.sendMessage({ 
  action: 'createTailoredResume', 
  resumeData, 
  jobDescriptionOverride: extractedJD,
  apiToken: apiToken,
  extractionMethod: 'ai'
}, async (resp) => {
  // Context binding issues here!
  this._storeTailoredResume(...)  // ← this might not be the class instance
  this._toggleDownloadButtons(...)  // ← this might not be the class instance
});
```

**After (Fixed)**:
```javascript
// Define handler separately to ensure proper context binding
const handleTailorResponse = async (resp) => {
  try {
    // ... validation ...
    await this._storeTailoredResume(tailoredResumeJSON, false);  // ← this is properly bound
    this._toggleDownloadButtons(true);  // ← this is properly bound
  } catch (e) {
    // ... error handling ...
  }
};

chrome.runtime.sendMessage({ 
  action: 'createTailoredResume', 
  resumeData, 
  jobDescriptionOverride: extractedJD,
  apiToken: apiToken,
  extractionMethod: 'ai'
}, handleTailorResponse);  // ← Pass the properly defined function
```

## Why These Fixes Work

### Auto-Extract Fix
- `forceRefresh: true` tells the background script to bypass cache
- Ensures fresh job description extraction on every job change
- Matches the behavior of the manual Extract button
- Background AI mode now actually auto-extracts when job changes

### Tailor Button Fix
- Named function `handleTailorResponse` is declared in the method's scope
- Maintains proper `this` binding to the class instance
- All methods like `this._storeTailoredResume()` can be called correctly
- Error handling works properly with correct context

## Flow - Now Fixed

### Background AI Mode Auto-Extract Flow
```
1. User enables "Background AI Mode"
2. User navigates to new job on LinkedIn
3. _updateJobContext() detects job change
4. _autoExtractJobDescription() is called
5. Sends: { action: 'getJobDescription', forceRefresh: true }
6. ✓ Fresh extraction (not cached)
7. JD displayed in sidebar
8. If autoTailorOnView enabled, resume tailors automatically
```

### Manual Tailor Button Flow
```
1. User clicks "Tailor" button
2. Tailor checks for extracted JD
3. If not found, calls extractJobDescriptionAsync()
4. ⏳ Waits for extraction
5. Gets JD and calls sendMessage('createTailoredResume', ...)
6. handleTailorResponse receives response
7. ✓ this._storeTailoredResume() works (proper context)
8. ✓ Download buttons show (proper context)
9. Resume successfully tailored
```

### Extract Button Flow
```
1. User clicks "Extract" button
2. extractJobDescriptionAsync() called
3. Sends: { action: 'getJobDescription', forceRefresh: true }
4. ✓ Fresh extraction (not cached)
5. JD displayed and returned as Promise
6. Ready for Tailor button to use
```

## Key Changes Summary

| Component | Issue | Fix |
|-----------|-------|-----|
| Auto-Extract | Used cached data | Added `forceRefresh: true` |
| Auto-Extract Fallback | Used cached data | Added `forceRefresh: true` |
| Tailor Callback | Context binding failed | Separated handler function |

## Testing

### Test 1: Background AI Mode Auto-Extract
1. Enable "Enable background AI mode" toggle
2. Navigate to multiple different LinkedIn job pages
3. **✓ Expected**: JD auto-extracts on each job change
4. **✓ Expected**: Fresh extraction (not cached from previous job)

### Test 2: Manual Tailor Button
1. Open a LinkedIn job page
2. Click "Extract" button → Wait for extraction
3. Click "Tailor" button
4. **✓ Expected**: Resume starts tailoring
5. **✓ Expected**: Download buttons appear after completion

### Test 3: Tailor Without Extract
1. Open a LinkedIn job page
2. Click "Tailor" button directly (without Extract)
3. **✓ Expected**: Auto-extracts job description first
4. **✓ Expected**: Then tailors resume
5. **✓ Expected**: Download buttons appear

### Test 4: Multiple Job Changes
1. Enable Background AI Mode
2. Navigate through 3-5 different job pages quickly
3. **✓ Expected**: Each job's description extracts fresh
4. **✓ Expected**: No stale/cached data mixing between jobs

## Files Modified
- `content-scripts/linkedin/components/right-sidebar.js`
  - `_autoExtractJobDescription()` - Added `forceRefresh: true` (2 places)
  - Tailor button handler - Fixed context binding with named function

## Related Fixes
- `FIX_EXTRACT_DELAY.md` - Extract button forces fresh data
- `FIX_ASYNC_AWAIT_TAB_ID.md` - Tab ID initialization fixed
- `FIX_TAILOR_BUTTON.md` - Previous tailor fix (Async/await)

## Severity
**CRITICAL** - Background AI mode (auto-extract/tailor) was completely broken due to missing forceRefresh flag

