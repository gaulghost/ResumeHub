// ResumeHub background service worker - Refactored with utility modules

// Import utility modules
try {
  importScripts('utils/shared-utilities.js');
  importScripts('utils/storage-manager.js');
  importScripts('utils/unified-error-handler.js');
  importScripts('utils/simple-rate-limiter.js');
  importScripts('utils/script-injector.js');
  importScripts('utils/api-client.js');
  importScripts('utils/parallel-processor.js');
  importScripts('utils/resume-cache-optimizer.js');
  
  console.log('✅ All required utility modules loaded');
} catch (error) {
  console.error('❌ Failed to load utility modules:', error.message);
}

// Field mapping cache and configuration for auto-fill
const FIELD_CACHE_KEY = 'resumehub_field_mappings';
const CACHE_EXPIRY_HOURS = 24;

const FIELD_CATEGORIES = {
    STATIC: ['first_name', 'fname', 'last_name', 'lname', 'name', 'full_name', 'email', 'phone', 'phone_number', 'mobile'],
    SEMI_STATIC: ['address', 'street', 'city', 'state', 'zip', 'zipcode', 'country', 'linkedin', 'website', 'portfolio', 'github'],
    DYNAMIC: ['experience', 'work', 'job', 'role', 'company', 'why', 'interested', 'cover', 'letter', 'describe', 'summary', 'objective', 'skills', 'projects']
};

// Maximum concurrent API calls for field mapping
const MAX_CONCURRENT_FIELD_CALLS = 3;

chrome.runtime.onInstalled.addListener(async () => {
  await StorageManager.setSettings({ theme: 'light', extractionMethod: 'ai' });
});

// === Core Handler Functions ===
// All processing delegated to utility modules for better separation of concerns


// === Async Handler Function for Preview (Kept for separate JD extraction) ===
async function handleGetJobDescriptionPreview(request, sendResponse, listenerId) {
    let jobDescription = '';
    try {
        if (request.extractionMethod === 'ai') {
             if (!request.apiToken) {
                 throw new Error("API Key is required for AI extraction preview.");
             }
             const pageText = await ScriptInjector.getPageText();
             const apiClient = new GeminiAPIClient(request.apiToken);
             jobDescription = await apiClient.extractJobDescription(pageText);
        } else { // Default to 'standard'
             jobDescription = await ScriptInjector.extractJobDescriptionStandard();
        }
        
        // Handle case where AI extraction returned null (meaning it didn't find JD)
        if (!jobDescription) {
             throw new Error("Could not extract a valid job description using the selected method.");
        }
        if (jobDescription.length < 50) { // Check length if not null
              throw new Error("Extracted job description seems too short.");
        }

        sendResponse({ success: true, jobDescription: jobDescription });
    } catch (error) {
         console.error(`❌ Job description preview failed: ${error.message}`);
         if (typeof sendResponse === 'function') {
            sendResponse({ success: false, error: error.message });
         }
    }
}


// === Async Handler Function for Auto-Fill Form ===
async function handleAutoFillForm(request, sendResponse, listenerId) {
    try {
        const { resumeData, apiToken } = request;
        
        if (!resumeData || !resumeData.content) {
            throw new Error('Missing resume data - please upload a resume first');
        }
        
        if (!apiToken) {
            throw new Error('API token is required for auto-fill functionality');
        }
        
        // Step 1: Get form fields from the current page
        const formFields = await getFormFieldsFromActiveTab();
        
        if (formFields.length === 0) {
            throw new Error('No form fields found on this page');
        }
        
        // Step 2: Parse resume data
        let resumeText = resumeData.content;
        if (resumeData.content.startsWith('data:')) {
            // Handle base64 encoded content
            const base64Data = resumeData.content.split(',')[1];
            resumeText = atob(base64Data);
        }
        
        // Parse resume to JSON using API client
        const apiClient = new GeminiAPIClient(apiToken);
        const resumeJSON = await apiClient.parseResumeToJSON(resumeData);
        
        // Step 3: Map resume data to form fields using AI
        const fieldMappings = await mapResumeToFormFields(apiToken, resumeJSON, formFields);
        
        // Step 4: Fill the form fields
        const fillResult = await fillFormFieldsOnPage(fieldMappings);
        
        console.log('🔍 Detected form fields:');
        fieldMappings.forEach(mapping => {
            console.log(`  • ${mapping.fieldId}: "${mapping.fieldValue}"`);
        });
        console.log('✅ Auto form filling completed');
        
        sendResponse({
            success: true,
            fieldsFound: formFields.length,
            fieldsFilled: fillResult.fieldsFilled || fieldMappings.length,
            message: 'Form auto-filled successfully'
        });
        
    } catch (error) {
        console.error(`❌ Auto-fill form failed: ${error.message}`);
        sendResponse({
            success: false,
            error: error.message || 'Failed to auto-fill form'
        });
    }
}

// === Helper Functions for Auto-Fill Feature ===

async function getFormFieldsFromActiveTab() {
    console.log("Getting form fields from active tab...");
    return await UnifiedErrorHandler.safeChromeOperation(
        () => ScriptInjector.getFormFields(),
        'form field extraction'
    );
}

// === Auto-Fill Helper Functions ===

// Enhanced per-field AI mapping function with caching and parallelization
async function mapResumeToFormFields(apiKey, resumeJSON, formFields) {
    try {
        // Step 1: Generate resume hash for cache invalidation
        const resumeHash = generateResumeHashFromJSON(resumeJSON);
        
        // Step 2: Check cache first
        const cacheResults = await checkFieldCache(formFields, resumeHash);
        console.log(`📋 Cache hits: ${Object.keys(cacheResults).length}/${formFields.length}`);
        
        // Step 3: Identify fields needing AI calls
        const uncachedFields = formFields.filter(field => !cacheResults[field.id || field.name]);
        
        if (uncachedFields.length === 0) {
            console.log("✅ All fields resolved from cache!");
            return Object.values(cacheResults);
        }
        
        // Step 4: Classify and batch fields by priority
        const fieldBatches = batchFieldsByPriority(uncachedFields);
        
        // Log field categories with actual field names
        logFieldCategories(fieldBatches);
        
        // Step 5: Parallel AI calls with controlled concurrency
        const aiResults = await processFieldBatchesWithAI(fieldBatches, apiKey, resumeJSON);
        
        // Step 6: Pattern matching fallback for failed AI calls
        const failedFields = uncachedFields.filter(field => 
            !aiResults.some(result => result.fieldId === (field.id || field.name))
        );
        const fallbackResults = await applyPatternFallback(failedFields, resumeJSON);
        
        // Step 7: Combine all results
        const allResults = [...Object.values(cacheResults), ...aiResults, ...fallbackResults];
        
        // Step 8: Cache successful AI results
        await cacheFieldMappings([...aiResults, ...fallbackResults], resumeHash);
        
        console.log(`✅ Successfully mapped ${allResults.length} fields (${Object.keys(cacheResults).length} from cache, ${aiResults.length} from AI, ${fallbackResults.length} from fallback)`);
        return allResults;
        
    } catch (error) {
        console.error("❌ Error in advanced field mapping, falling back to basic pattern matching:", error);
        return await basicPatternMapping(resumeJSON, formFields);
    }
}

// Helper function to log field categories with actual field names
function logFieldCategories(fieldBatches) {
    if (fieldBatches.static && fieldBatches.static.length > 0) {
        const staticNames = fieldBatches.static.map(f => f.label || f.name || f.id).join(', ');
        console.log(`🔧 Processing static fields (${fieldBatches.static.length}): ${staticNames}`);
    }
    
    if (fieldBatches.semiStatic && fieldBatches.semiStatic.length > 0) {
        const semiStaticNames = fieldBatches.semiStatic.map(f => f.label || f.name || f.id).join(', ');
        console.log(`🔧 Processing semi-static fields (${fieldBatches.semiStatic.length}): ${semiStaticNames}`);
    }
    
    if (fieldBatches.dynamic && fieldBatches.dynamic.length > 0) {
        const dynamicNames = fieldBatches.dynamic.map(f => f.label || f.name || f.id).join(', ');
        console.log(`🔧 Processing dynamic fields (${fieldBatches.dynamic.length}): ${dynamicNames}`);
    }
}

// Generate hash for resume JSON to detect changes
function generateResumeHashFromJSON(resumeJSON) {
    // Use SharedUtilities for consistent hash generation
    if (typeof SharedUtilities === 'undefined') {
        importScripts('./utils/shared-utilities.js');
    }
    return SharedUtilities.generateResumeHash(resumeJSON);
}

// Check cache for existing field mappings using StorageManager
async function checkFieldCache(formFields, resumeHash) {
    try {
        const cache = await StorageManager.getValidCache(FIELD_CACHE_KEY) || {};
        const results = {};
        
        for (const field of formFields) {
            const fieldKey = generateFieldCacheKey(field);
            const entry = cache[fieldKey];
            
            if (entry && entry.resumeHash === resumeHash) {
                results[field.id || field.name] = entry.mapping;
            }
        }
        
        return results;
    } catch (error) {
        console.warn("Cache check failed:", error);
        return {};
    }
}

// Generate cache key for a field
function generateFieldCacheKey(field) {
    const identifier = `${field.name || ''}_${field.id || ''}_${field.label || ''}_${field.placeholder || ''}`.toLowerCase();
    return btoa(identifier).substring(0, 12);
}

// Cache management delegated to StorageManager

// Batch fields by priority for processing
function batchFieldsByPriority(fields) {
    const staticFields = [];
    const semiStaticFields = [];
    const dynamicFields = [];
    
    for (const field of fields) {
        const fieldText = `${field.name || ''} ${field.id || ''} ${field.label || ''} ${field.placeholder || ''}`.toLowerCase();
        
        if (FIELD_CATEGORIES.STATIC.some(keyword => fieldText.includes(keyword))) {
            staticFields.push(field);
        } else if (FIELD_CATEGORIES.SEMI_STATIC.some(keyword => fieldText.includes(keyword))) {
            semiStaticFields.push(field);
        } else {
            dynamicFields.push(field);
        }
    }
    
    return [
        { priority: 'static', fields: staticFields },
        { priority: 'semi-static', fields: semiStaticFields },
        { priority: 'dynamic', fields: dynamicFields }
    ].filter(batch => batch.fields.length > 0);
}

// Process field batches with AI using controlled concurrency
async function processFieldBatchesWithAI(batches, apiKey, resumeJSON) {
    const allResults = [];
    
    for (const batch of batches) {
        console.log(`Processing ${batch.priority} fields: ${batch.fields.length} fields`);
        
        // Process fields in parallel with controlled concurrency
        const promises = [];
        for (let i = 0; i < batch.fields.length; i += MAX_CONCURRENT_FIELD_CALLS) {
            const fieldChunk = batch.fields.slice(i, i + MAX_CONCURRENT_FIELD_CALLS);
            const chunkPromises = fieldChunk.map(field => mapSingleFieldWithAI(field, apiKey, resumeJSON));
            promises.push(...chunkPromises);
        }
        
        const batchResults = await Promise.allSettled(promises);
        const successfulResults = batchResults
            .filter(result => result.status === 'fulfilled' && result.value)
            .map(result => result.value);
        
        allResults.push(...successfulResults);
        
        // Small delay between batches to be API-friendly
        if (batches.indexOf(batch) < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    return allResults;
}

// Map a single field using AI
async function mapSingleFieldWithAI(field, apiKey, resumeJSON) {
    const fieldDisplayName = field.label || field.name || field.id || 'Unknown field';
    console.log(`🔍 Fetching details for: ${fieldDisplayName} (${field.name || field.id})`);
    
    try {
        const result = await UnifiedErrorHandler.safeAPICall(async () => {
            const apiClient = new GeminiAPIClient(apiKey);
            return await apiClient.mapFieldToResume(field, resumeJSON);
        }, `field mapping for ${field.name || field.id}`);
        
        if (result && result.fieldValue) {
            const truncatedValue = result.fieldValue.length > 50 
                ? result.fieldValue.substring(0, 50) + '...' 
                : result.fieldValue;
            console.log(`✅ Fetched ${fieldDisplayName}: "${truncatedValue}"`);
        } else {
            console.log(`⚠️ No mapping found for: ${fieldDisplayName}`);
        }
        
        return result;
    } catch (error) {
        console.log(`❌ Failed to fetch ${fieldDisplayName}: ${error.message}`);
        throw error;
    }
}

// Resume data compaction handled by GeminiAPIClient

// Apply pattern matching fallback for failed AI calls
async function applyPatternFallback(failedFields, resumeJSON) {
    if (failedFields.length > 0) {
        const fieldNames = failedFields.map(f => f.label || f.name || f.id).join(', ');
        console.log(`🔄 Applying pattern fallback for ${failedFields.length} fields: ${fieldNames}`);
    }
    return await basicPatternMapping(resumeJSON, failedFields);
}

// Cache successful field mappings using StorageManager
async function cacheFieldMappings(mappings, resumeHash) {
    try {
        // Get existing valid cache or start with empty object
        const existingCache = await StorageManager.getValidCache(FIELD_CACHE_KEY) || {};
        
        for (const mapping of mappings) {
            if (mapping && mapping.fieldId) {
                const fieldKey = generateFieldCacheKey({ 
                    id: mapping.fieldId, 
                    name: mapping.fieldId 
                });
                existingCache[fieldKey] = {
                    mapping: mapping,
                    resumeHash: resumeHash,
                    timestamp: Date.now()
                };
            }
        }
        
        await StorageManager.setCache(FIELD_CACHE_KEY, existingCache, CACHE_EXPIRY_HOURS);
        console.log(`💾 Cached ${mappings.length} field mappings with ${CACHE_EXPIRY_HOURS}h expiry using StorageManager`);
    } catch (error) {
        console.warn("Failed to cache field mappings:", error);
    }
}

// Basic pattern mapping for fallback
async function basicPatternMapping(resumeJSON, formFields) {
    const mappings = [];
    
    for (const field of formFields) {
        let value = '';
        const fieldName = (field.name || field.id || '').toLowerCase();
        const fieldLabel = (field.label || '').toLowerCase();
        const fieldPlaceholder = (field.placeholder || '').toLowerCase();
        const fieldText = `${fieldName} ${fieldLabel} ${fieldPlaceholder}`;
        
        // Map basic contact information
        if (fieldText.includes('first') && fieldText.includes('name')) {
            const fullName = resumeJSON.contact?.name || '';
            value = fullName.split(' ')[0] || '';
        } else if (fieldText.includes('last') && fieldText.includes('name')) {
            const fullName = resumeJSON.contact?.name || '';
            const nameParts = fullName.split(' ');
            value = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
        } else if (fieldText.includes('name') && !fieldText.includes('first') && !fieldText.includes('last')) {
            value = resumeJSON.contact?.name || '';
        } else if (fieldText.includes('email')) {
            value = resumeJSON.contact?.email || '';
        } else if (fieldText.includes('phone')) {
            value = resumeJSON.contact?.phone || '';
        } else if (fieldText.includes('linkedin')) {
            value = resumeJSON.contact?.linkedin || '';
        } else if (fieldText.includes('github')) {
            value = resumeJSON.contact?.github || '';
        } else if (fieldText.includes('portfolio') || fieldText.includes('website')) {
            value = resumeJSON.contact?.portfolio || '';
        }
        
        if (value) {
            const fieldDisplayName = field.label || field.name || field.id || 'Unknown field';
            console.log(`🎯 Pattern matched ${fieldDisplayName}: "${value}"`);
            mappings.push({
                fieldId: field.id,
                fieldSelector: field.selector,
                fieldValue: value,
                fieldType: field.type
            });
        }
    }
    
    if (mappings.length > 0) {
        console.log(`✅ Successfully mapped ${mappings.length} fields using pattern matching`);
    }
    
    return mappings;
}

// Function to fill form fields on the page
async function fillFormFieldsOnPage(fieldMappings) {
    return await UnifiedErrorHandler.safeChromeOperation(
        () => ScriptInjector.fillFormFields(fieldMappings),
        'form field filling'
    );
}

// === Helper function to estimate word and character count using SharedUtilities ===
function countResumeStats(resumeJSON) {
    // Convert resume to text and count using SharedUtilities
    const resumeText = SharedUtilities.convertJSONToText(resumeJSON);
    return {
        wordCount: SharedUtilities.countWords(resumeText),
        charCount: SharedUtilities.countCharacters(resumeText)
    };
}

// === NEW Async Handler Function for Create Tailored Resume (JSON based) ===
async function handleCreateTailoredResume(request, sendResponse, listenerId) {
    try {
        // Check if using cached resume JSON or creating new one
        const apiClient = new GeminiAPIClient(request.apiToken);
        const resumeCacheOptimizer = new ResumeCacheOptimizer(apiClient);
        
        const optimizationResult = await resumeCacheOptimizer.getOptimizedResumeJSON(request.resumeData);
        const originalResumeJSON = optimizationResult.resumeJSON;
        
        if (!originalResumeJSON) {
             throw new Error("Failed to parse original resume into JSON structure.");
        }
        
        // Log resume source
        if (optimizationResult.metadata.source === 'cache') {
            console.log('📋 Picking up resume from cached resume JSON');
        } else {
            console.log('🔄 Making API call to create resume JSON');
        }

        // Extract job description if needed
        let jobDescription = '';
        if (request.jobDescriptionOverride) {
            jobDescription = request.jobDescriptionOverride;
        } else {
            if (request.extractionMethod === 'ai') {
                const pageText = await ScriptInjector.getPageText();
                const apiClient = new GeminiAPIClient(request.apiToken);
                jobDescription = await apiClient.extractJobDescription(pageText);
            } else {
                jobDescription = await ScriptInjector.extractJobDescriptionStandard();
            }
             if (!jobDescription) {
                 throw new Error("Could not extract a job description using the selected method (AI might have failed).");
             }
             if (jobDescription.length < 50) {
                 throw new Error("Extracted job description seems too short.");
             }
        }

        // Initialize parallel processor
        const parallelProcessor = new ParallelProcessor(apiClient, {
            maxConcurrency: 3,
            batchDelay: 500
            // Retry logic handled by SimpleRateLimiter
        });

        // Process all sections in parallel
        const sectionResults = await parallelProcessor.processSectionsInParallel(
            jobDescription, 
            originalResumeJSON, 
            () => {} // Empty progress callback
        );

        // Combine results with fallbacks
        const tailoredResumeJSON = parallelProcessor.combineResults(originalResumeJSON, sectionResults);

        // Always preserve education (copy as-is for now)
        tailoredResumeJSON.education = originalResumeJSON.education || [];

        console.log('📄 Creating PDF');
        console.log('✅ PDF generation completed');

        sendResponse({ success: true, tailoredResumeJSON: tailoredResumeJSON });

    } catch (error) {
        console.error(`❌ Resume generation failed: ${error.message}`);
        if (typeof sendResponse === 'function') {
         sendResponse({ success: false, error: error.message }); 
        }
    }
}

// --- Optimized Message Listener ---
const ACTION_HANDLERS = {
  'getJobDescription': handleGetJobDescriptionPreview,
  'createTailoredResume': handleCreateTailoredResume,
  'autoFillForm': handleAutoFillForm,
  'ping': (request, sendResponse) => {
    sendResponse({ success: true, message: "pong" });
  }
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handler = ACTION_HANDLERS[request.action];
  if (handler) {
    const listenerId = Date.now();
    handler(request, sendResponse, listenerId);
    return true; // Async response
  }
  return false; // Unhandled action
});