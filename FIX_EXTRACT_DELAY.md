# Fix: Extract Button Delay Issue

## Problem
When clicking the "Extract" button in the ResumeHub sidebar, the job description would not update immediately. Instead, it would take several minutes before a fresh extraction would occur. This was happening because cached job descriptions from previous extractions were being reused.

## Root Cause Analysis
The issue was in the caching mechanism:

1. **Location**: `background.js` → `handleGetJobDescription()` function
2. **Cache TTL**: 5 minutes (300,000ms)
3. **Problem**: When the Extract button was clicked, the background service worker would:
   - Check if a cached job description existed for the current tab
   - If the cache was less than 5 minutes old, **return the cached version immediately**
   - Ignore the user's explicit request for fresh extraction
   - Only extract new data after the cache expired (5 minutes later)

## Solution
Implemented a `forceRefresh` flag that allows the Extract button to bypass the cache and always fetch fresh data.

### Changes Made

#### 1. `background.js` (handleGetJobDescription function)
```javascript
// Added forceRefresh parameter
const { extractionMethod = 'standard', apiToken, forceRefresh = false } = request;

// Updated cache check to respect forceRefresh flag
if (!forceRefresh && tabId && jdCache.has(tabId)) {
    // Use cache only if forceRefresh is false
    ...
}

// Clear cache if force refresh is requested
if (forceRefresh && tabId && jdCache.has(tabId)) {
    jdCache.delete(tabId);
}
```

#### 2. `content-scripts/linkedin/components/right-sidebar.js` (Extract button click handler)
```javascript
// When Extract button is clicked, force refresh to always get fresh data
chrome.runtime.sendMessage({ 
    action: 'getJobDescription', 
    extractionMethod: 'ai', 
    forceRefresh: true  // ← Key change
}, (resp) => {
    // ... fallback logic also includes forceRefresh: true
});
```

## How It Works Now

### Before (Buggy Behavior):
1. User clicks "Extract" button
2. Background script checks cache
3. **If cached data exists and is fresh → Returns immediately without new extraction**
4. User sees old job description
5. Must wait 5 minutes for cache to expire before fresh extraction works

### After (Fixed Behavior):
1. User clicks "Extract" button
2. `forceRefresh: true` is sent to background
3. Background script **clears the cache entry immediately**
4. **Fresh extraction is performed right away**
5. User gets updated job description immediately

## Cache Behavior After Fix

- **Preview Button**: Uses cache (no forceRefresh) → Fast, reuses recent extraction
- **Extract Button**: Forces refresh → Always gets fresh data immediately
- **Auto-extraction** (background): Uses cache → Efficient for automatic operations
- **Manual Resume Generation**: Uses cache → Faster processing

## Benefits

✅ **Immediate extraction**: Clicking Extract now fetches fresh data right away  
✅ **No artificial delays**: No need to wait for cache expiration  
✅ **Smart caching preserved**: Other operations still benefit from caching  
✅ **User control**: Users can choose between fast (cached) and fresh (forced refresh)  
✅ **Performance optimized**: Auto-extraction and other background operations still use cache

## Testing

To verify the fix works:

1. Open a LinkedIn job listing
2. Click the **Extract** button in ResumeHub sidebar
3. Verify job description appears **immediately** (not after several minutes)
4. Edit the job description or navigate to a new job
5. Click **Extract** again
6. Verify new/updated job description appears **immediately**

## Files Modified

1. `background.js` - Added `forceRefresh` parameter handling
2. `content-scripts/linkedin/components/right-sidebar.js` - Pass `forceRefresh: true` on Extract button click

## Cache TTL Configuration

Current cache settings (can be adjusted if needed):
- **Cache TTL**: 5 minutes (300,000ms)
- **Cleanup interval**: Every 10 minutes
- **Cache scope**: Per tab (tabId based)

The cache is still useful for:
- Reducing redundant API calls
- Speeding up preview operations
- Optimizing auto-extraction features

