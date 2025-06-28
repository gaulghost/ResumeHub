// ResumeHub background service worker - Refactored with utility modules

console.log('Loading ResumeHub background service worker...');

// Import utility modules
try {
  importScripts('utils/storage-manager.js');
  console.log('StorageManager loaded:', typeof StorageManager);
  
  importScripts('utils/error-handler.js');
  console.log('ErrorHandler loaded:', typeof ErrorHandler);
  
  importScripts('utils/script-injector.js');
  console.log('ScriptInjector loaded:', typeof ScriptInjector);
  
  importScripts('utils/api-client.js');
  console.log('GeminiAPIClient loaded:', typeof GeminiAPIClient);
  
  console.log('All utility modules loaded successfully');
} catch (error) {
  console.error('Failed to load utility modules:', error);
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
  console.log('ResumeHub extension installed.');
  await StorageManager.setSettings({ theme: 'light', extractionMethod: 'standard' });
});

// === Refactored Job Description Extraction Functions ===
// (Functions moved to utility modules)

// === Resume Parsing === (Deprecated - use GeminiAPIClient directly)
// Function kept for backward compatibility but redirects to API client


// === NEW Function to Tailor a Specific Resume Section ===
async function callGoogleGeminiAPI_TailorSection(apiKey, jobDescription, originalSectionData, sectionType) {
    console.log(`Tailoring section: ${sectionType}...`);
    // Add a specific log for skills structure
    if (sectionType === 'skills') {
        console.log("Original skills structure received for tailoring:", JSON.stringify(originalSectionData, null, 2));
    }
    const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`; // Use flash
    const modelName = "gemini-1.5-flash-latest";

    // Create a prompt specific to the section type
    let prompt = `**Instruction:**
Analyze the following original resume section (\`${sectionType}\`) and the provided job description. Generate a tailored version of *only this section*, highlighting skills and experiences relevant to the job description.
- Use strong action verbs.
- Quantify achievements where possible based *only* on the original section data.
- Maintain the original meaning and key information.
- **Strictly do not add any skills or experiences not present in the original section data.**
- **IMPORTANT: The final resume must not exceed 570 words or 3650 characters in total. This is a hard limit.**
- Prioritize the most relevant content to the job description and remove less important details.
${sectionType === 'skills' ? 
`- **Skills Focus**: ONLY include skills directly relevant to the job description. Remove any skills not mentioned in or related to the position requirements. Displaying too many skills dilutes impact, so focus on quality over quantity.
- If needed, regroup skills into more job-relevant categories.` 
: ''}
- Be concise and impactful - focus on quality over quantity.
- Output the result as a JSON object that matches the structure of the original section data provided. Output *only* the valid JSON object.

**Job Description:**
\`\`\`
${jobDescription}
\`\`\`

**Original Resume Section (${sectionType}):**
\`\`\`json
${JSON.stringify(originalSectionData, null, 2)}
\`\`\`

**--- Tailored Section JSON Output (${sectionType}) ---**
`;

    const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
           responseMimeType: "application/json",
           temperature: 0.4 // Slightly higher temp for creative tailoring, but still structured
        },
         safetySettings: [ /* Standard safety settings */
           { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
           { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
           { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
           { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        ]
    };

     try {
        console.log(`Sending section tailoring request (${sectionType}) to ${modelName}...`);
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

         if (!response.ok) {
             const errorText = await response.text();
             console.error(`Section (${sectionType}) Tailoring API Error:`, response.status, errorText);
             throw new Error(`Section (${sectionType}) tailoring API request failed (${response.status}).`);
        }

        const responseData = await response.json();
        console.log(`Section (${sectionType}) Tailoring Response Received.`);

        if (responseData.candidates && responseData.candidates[0]?.content?.parts[0]?.text) {
            const jsonText = responseData.candidates[0].content.parts[0].text;
             try {
                 const tailoredJson = JSON.parse(jsonText);
                 console.log(`Successfully parsed tailored JSON for section: ${sectionType}`);
                 // Add a specific log for skills structure
                 if (sectionType === 'skills') {
                     console.log("Tailored skills structure returned:", JSON.stringify(tailoredJson, null, 2));
                 }
                 return tailoredJson;
            } catch (parseError) {
                 console.error(`Failed to parse JSON response from section (${sectionType}) tailoring API:`, parseError, "\nRaw Text:", jsonText);
                 throw new Error(`Failed to parse JSON response from section (${sectionType}) tailoring API.`);
            }
        } else {
             console.error(`Could not find JSON text in section (${sectionType}) tailoring response structure.`, responseData);
              // Check for blocks
              if (responseData.candidates?.length > 0 && !responseData.candidates[0].content) {
                    throw new Error(`Section (${sectionType}) tailoring API returned a candidate but no content, potentially blocked.`);
              } else if (responseData.promptFeedback?.blockReason) {
                   throw new Error(`Section (${sectionType}) tailoring API request blocked due to safety settings: ${responseData.promptFeedback.blockReason}`);
              }
             throw new Error(`Section (${sectionType}) tailoring response structure was unexpected.`);
        }

    } catch (error) {
        console.error(`Error during section (${sectionType}) tailoring API call:`, error);
        // Don't re-throw immediately, allow the main handler to decide
        // We return null to indicate failure for this section.
         return null; 
    }
}

// === Section Tailoring === (Deprecated - use GeminiAPIClient directly)
// Function kept for backward compatibility but redirects to API client


// === Async Handler Function for Preview (Kept for separate JD extraction) ===
async function handleGetJobDescriptionPreview(request, sendResponse, listenerId) {
    console.log(`[${listenerId}] Preview Async Handler Started.`);
    let jobDescription = '';
    try {
        console.log(`[${listenerId}] Preview Start: Executing extraction (Method: ${request.extractionMethod})...`);
        if (request.extractionMethod === 'ai') {
             if (!request.apiToken) {
                 throw new Error("API Key is required for AI extraction preview.");
             }
             console.log(`[${listenerId}] Preview AI: Getting page text...`);
             const pageText = await ScriptInjector.getPageText();
             // console.log('pageText', pageText); // Keep commented unless debugging extraction
             console.log(`[${listenerId}] Preview AI: Page text acquired, calling AI extraction...`);
             const apiClient = new GeminiAPIClient(request.apiToken);
             jobDescription = await apiClient.extractJobDescription(pageText);
             console.log(`[${listenerId}] Preview AI: AI extraction finished.`);
        } else { // Default to 'standard'
             console.log(`[${listenerId}] Preview Standard: Calling standard extraction...`);
             jobDescription = await ScriptInjector.extractJobDescriptionStandard();
             console.log(`[${listenerId}] Preview Standard: Standard extraction finished.`);
        }
        
        // Handle case where AI extraction returned null (meaning it didn't find JD)
        if (!jobDescription) {
             console.warn(`[${listenerId}] Preview Warn: No valid job description extracted.`);
             throw new Error("Could not extract a valid job description using the selected method.");
        }
        if (jobDescription.length < 50) { // Check length if not null
             console.warn(`[${listenerId}] Preview Warn: Extracted description too short.`);
              throw new Error("Extracted job description seems too short.");
        }

        console.log(`[${listenerId}] Preview Success: Sending response...`);
        sendResponse({ success: true, jobDescription: jobDescription });
        console.log(`[${listenerId}] Preview Success: Response sent.`);
    } catch (error) {
         console.error(`[${listenerId}] Preview Error:`, error);
         console.log(`[${listenerId}] Preview Error: Sending error response...`);
         if (typeof sendResponse === 'function') {
            sendResponse({ success: false, error: error.message });
            console.log(`[${listenerId}] Preview Error: Error response sent.`);
         } else {
             console.error(`[${listenerId}] Preview Error: sendResponse is not a function!`);
         }
    }
}


// === Async Handler Function for Auto-Fill Form ===
async function handleAutoFillForm(request, sendResponse, listenerId) {
    console.log(`[${listenerId}] Auto-Fill Handler Started.`);
    
    try {
        const { resumeData, apiToken } = request;
        
        if (!resumeData || !resumeData.content) {
            throw new Error('Missing resume data - please upload a resume first');
        }
        
        if (!apiToken) {
            throw new Error('API token is required for auto-fill functionality');
        }
        
        console.log(`[${listenerId}] Getting form fields from active tab...`);
        
        // Step 1: Get form fields from the current page
        const formFields = await getFormFieldsFromActiveTab();
        console.log(`[${listenerId}] Found ${formFields.length} form fields`);
        
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
        console.log(`[${listenerId}] Resume parsed successfully`);
        
        // Step 3: Map resume data to form fields using AI
        const fieldMappings = await mapResumeToFormFields(apiToken, resumeJSON, formFields);
        console.log(`[${listenerId}] Generated ${fieldMappings.length} field mappings`);
        
        // Step 4: Fill the form fields
        const fillResult = await fillFormFieldsOnPage(fieldMappings);
        console.log(`[${listenerId}] Form filling completed:`, fillResult);
        
        sendResponse({
            success: true,
            fieldsFound: formFields.length,
            fieldsFilled: fillResult.fieldsFilled || fieldMappings.length,
            message: 'Form auto-filled successfully'
        });
        
    } catch (error) {
        console.error(`[${listenerId}] Auto-Fill Error:`, error);
        sendResponse({
            success: false,
            error: error.message || 'Failed to auto-fill form'
        });
    }
}

// === Helper Functions for Auto-Fill Feature ===

async function getFormFieldsFromActiveTab() {
    console.log("Getting form fields from active tab...");
    return await ErrorHandler.safeChromeOperation(
        () => ScriptInjector.getFormFields(),
        'form field extraction'
    );
}

// === Auto-Fill Helper Functions ===

// Enhanced per-field AI mapping function with caching and parallelization
async function mapResumeToFormFields(apiKey, resumeJSON, formFields) {
    console.log("Starting advanced field mapping with AI, caching, and parallelization...");
    
    try {
        // Step 1: Generate resume hash for cache invalidation
        const resumeHash = generateResumeHash(resumeJSON);
        
        // Step 2: Check cache first
        const cacheResults = await checkFieldCache(formFields, resumeHash);
        console.log(`Cache hits: ${Object.keys(cacheResults).length}/${formFields.length}`);
        
        // Step 3: Identify fields needing AI calls
        const uncachedFields = formFields.filter(field => !cacheResults[field.id || field.name]);
        console.log(`Fields needing AI calls: ${uncachedFields.length}`);
        
        if (uncachedFields.length === 0) {
            console.log("All fields resolved from cache!");
            return Object.values(cacheResults);
        }
        
        // Step 4: Classify and batch fields by priority
        const fieldBatches = batchFieldsByPriority(uncachedFields);
        
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
        
        console.log(`Successfully mapped ${allResults.length} fields (${Object.keys(cacheResults).length} from cache, ${aiResults.length} from AI, ${fallbackResults.length} from fallback)`);
        return allResults;
        
    } catch (error) {
        console.error("Error in advanced field mapping, falling back to basic pattern matching:", error);
        return await basicPatternMapping(resumeJSON, formFields);
    }
}

// Generate hash for resume to detect changes
function generateResumeHash(resumeJSON) {
    const staticData = {
        personal: resumeJSON.contact,
        // Exclude dynamic fields that change per job
    };
    return btoa(JSON.stringify(staticData)).substring(0, 16);
}

// Check cache for existing field mappings
async function checkFieldCache(formFields, resumeHash) {
    try {
        const cache = await StorageManager.getValidCache(FIELD_CACHE_KEY) || {};
        const results = {};
        
        for (const field of formFields) {
            const fieldKey = generateFieldCacheKey(field);
            const entry = cache[fieldKey];
            
            if (entry && entry.resumeHash === resumeHash && !isCacheExpired(entry.timestamp)) {
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

// Check if cache entry is expired
function isCacheExpired(timestamp) {
    const now = Date.now();
    const expiryMs = CACHE_EXPIRY_HOURS * 60 * 60 * 1000;
    return (now - timestamp) > expiryMs;
}

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
    return await ErrorHandler.safeAPICall(async () => {
        const apiClient = new GeminiAPIClient(apiKey);
        return await apiClient.mapFieldToResume(field, resumeJSON);
    }, `field mapping for ${field.name || field.id}`);
}

// Create compact resume data for individual field processing
function createCompactResumeData(resumeJSON) {
    return `Name: ${resumeJSON.contact?.name || 'N/A'}
Email: ${resumeJSON.contact?.email || 'N/A'}
Phone: ${resumeJSON.contact?.phone || 'N/A'}
LinkedIn: ${resumeJSON.contact?.linkedin || 'N/A'}
Summary: ${resumeJSON.summary || 'N/A'}`;
}

// Apply pattern matching fallback for failed AI calls
async function applyPatternFallback(failedFields, resumeJSON) {
    console.log(`Applying pattern fallback for ${failedFields.length} fields`);
    return await basicPatternMapping(resumeJSON, failedFields);
}

// Cache successful field mappings
async function cacheFieldMappings(mappings, resumeHash) {
    try {
        const cache = await StorageManager.getCache(FIELD_CACHE_KEY) || {};
        
        for (const mapping of mappings) {
            if (mapping && mapping.fieldId) {
                // Find original field info (this is simplified)
                const fieldKey = mapping.fieldId; // Simplified key generation
                cache[fieldKey] = {
                    mapping: mapping,
                    resumeHash: resumeHash,
                    timestamp: Date.now()
                };
            }
        }
        
        await StorageManager.setCache(FIELD_CACHE_KEY, cache, CACHE_EXPIRY_HOURS);
        console.log(`Cached ${mappings.length} field mappings`);
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
            mappings.push({
                fieldId: field.id,
                fieldSelector: field.selector,
                fieldValue: value,
                fieldType: field.type
            });
        }
    }
    
    return mappings;
}

// Function to fill form fields on the page
async function fillFormFieldsOnPage(fieldMappings) {
    console.log("Filling form fields on page...");
    return await ErrorHandler.safeChromeOperation(
        () => ScriptInjector.fillFormFields(fieldMappings),
        'form field filling'
    );
}

// === Helper function to estimate word and character count in the resume JSON ===
function countResumeStats(resumeJSON) {
    let wordCount = 0;
    let charCount = 0;
    
    // Helper to count text
    function countText(text) {
        if (!text) return;
        const trimmed = text.trim();
        charCount += trimmed.length;
        wordCount += trimmed.split(/\s+/).filter(Boolean).length;
    }
    
    // Count summary
    if (resumeJSON.summary) {
        countText(resumeJSON.summary);
    }
    
    // Count experience
    if (resumeJSON.experience && Array.isArray(resumeJSON.experience)) {
        resumeJSON.experience.forEach(exp => {
            countText(exp.title);
            countText(exp.company);
            countText(exp.location);
            countText(exp.dates);
            if (exp.bullets && Array.isArray(exp.bullets)) {
                exp.bullets.forEach(bullet => countText(bullet));
            }
        });
    }
    
    // Count education
    if (resumeJSON.education && Array.isArray(resumeJSON.education)) {
        resumeJSON.education.forEach(edu => {
            countText(edu.institution);
            countText(edu.degree);
            countText(edu.location);
            countText(edu.dates);
            countText(edu.details);
        });
    }
    
    // Count skills
    if (resumeJSON.skills && Array.isArray(resumeJSON.skills)) {
        resumeJSON.skills.forEach(skill => {
            countText(skill.category);
            if (skill.items && Array.isArray(skill.items)) {
                skill.items.forEach(item => countText(item));
            }
        });
    }
    
    // Count projects
    if (resumeJSON.projects && Array.isArray(resumeJSON.projects)) {
        resumeJSON.projects.forEach(proj => {
            countText(proj.name);
            countText(proj.description);
            if (proj.technologies && Array.isArray(proj.technologies)) {
                proj.technologies.forEach(tech => countText(tech));
            }
        });
    }
    
    // Count achievements
    if (resumeJSON.achievements && Array.isArray(resumeJSON.achievements)) {
        resumeJSON.achievements.forEach(achievement => countText(achievement));
    }
    
    return { wordCount, charCount };
}

// === NEW Async Handler Function for Create Tailored Resume (JSON based) ===
async function handleCreateTailoredResume(request, sendResponse, listenerId) {
    console.log(`[${listenerId}] Create JSON Handler Started.`);
    try {
        console.log(`[${listenerId}] Create Flow: Received resume data: ${request.resumeData.filename}`);
        console.log(`[${listenerId}] Create Flow: API token provided.`);

        // --- Step 1: Parse Original Resume to JSON ---
        console.log(`[${listenerId}] Create Flow: Parsing original resume to JSON...`);
        const apiClient = new GeminiAPIClient(request.apiToken);
        const originalResumeJSON = await apiClient.parseResumeToJSON(request.resumeData);
        if (!originalResumeJSON) { // Should not happen if parseResumeToJSON throws errors correctly
             throw new Error("Failed to parse original resume into JSON structure.");
        }
        console.log(`[${listenerId}] Create Flow: Original resume parsed successfully.`);
        // console.log("Parsed Original Resume JSON:", JSON.stringify(originalResumeJSON, null, 2)); // Optional: Log parsed structure

        // Get initial stats
        const initialStats = countResumeStats(originalResumeJSON);
        console.log(`[${listenerId}] Create Flow: Original resume stats - Words: ${initialStats.wordCount}, Characters: ${initialStats.charCount}`);

        // --- Step 2: Extract Job Description ( Reuse existing logic or use override ) ---
        let jobDescription = '';
        if (request.jobDescriptionOverride) {
            console.log(`[${listenerId}] Create Flow: Using provided job description override.`);
            jobDescription = request.jobDescriptionOverride;
        } else {
            console.log(`[${listenerId}] Create Flow: Extracting job description (Method: ${request.extractionMethod})...`);
      if (request.extractionMethod === 'ai') {
                const pageText = await ScriptInjector.getPageText();
                const apiClient = new GeminiAPIClient(request.apiToken);
                jobDescription = await apiClient.extractJobDescription(pageText);
            } else {
                jobDescription = await ScriptInjector.extractJobDescriptionStandard();
            }
             // Handle null return from AI extraction
             if (!jobDescription) {
                 throw new Error("Could not extract a job description using the selected method (AI might have failed).");
      }
             if (jobDescription.length < 50) { // Check length if not null
                 throw new Error("Extracted job description seems too short.");
             }
            console.log(`[${listenerId}] Create Flow: Extracted Job Description successfully.`);
        }

        // --- Step 3: Tailor Each Section ---
        console.log(`[${listenerId}] Create Flow: Starting section-by-section tailoring...`);
        console.log(`[${listenerId}] Create Flow: Note - Tailoring with 570 words/3650 characters limit`);
        const tailoredResumeJSON = {}; // Initialize the final object

        // Tailor Summary (if exists)
        if (originalResumeJSON.summary) {
            const tailoredSummary = await apiClient.tailorSection(
                jobDescription, { summary: originalResumeJSON.summary }, 'summary'
            );
            tailoredResumeJSON.summary = tailoredSummary?.summary || originalResumeJSON.summary; // Fallback to original if tailoring fails
        } else {
            tailoredResumeJSON.summary = null;
        }

        // Tailor Experience (array)
        if (originalResumeJSON.experience && Array.isArray(originalResumeJSON.experience)) {
            const tailoredExperience = await apiClient.tailorSection(
                jobDescription, originalResumeJSON.experience, 'experience'
                 );
            tailoredResumeJSON.experience = tailoredExperience || originalResumeJSON.experience; // Fallback to original
        } else {
            tailoredResumeJSON.experience = [];
        }
        
        // Tailor Education (array) - Often less tailoring needed, maybe just copy? Or tailor slightly.
         tailoredResumeJSON.education = [];
         if (originalResumeJSON.education && Array.isArray(originalResumeJSON.education)) {
             for (const edu of originalResumeJSON.education) {
                 // Decide if tailoring education makes sense. For now, let's copy it.
                 // const tailoredEdu = await apiClient.tailorSection(jobDescription, edu, 'education');
                 // tailoredResumeJSON.education.push(tailoredEdu || edu);
                 tailoredResumeJSON.education.push(edu); // Copy original for now
             }
         }
         
         // Tailor Skills (object/string)
         if (originalResumeJSON.skills) {
              tailoredResumeJSON.skills = await apiClient.tailorSection(
                  jobDescription, originalResumeJSON.skills, 'skills'
              ) || originalResumeJSON.skills; // Fallback
         } else {
             tailoredResumeJSON.skills = null;
         }

         // Tailor Projects (array)
         if (originalResumeJSON.projects && Array.isArray(originalResumeJSON.projects)) {
             const tailoredProjects = await apiClient.tailorSection(
                 jobDescription, originalResumeJSON.projects, 'projects'
                 );
             tailoredResumeJSON.projects = tailoredProjects || originalResumeJSON.projects; // Fallback
         } else {
             tailoredResumeJSON.projects = [];
         }
         
         // Tailor Achievements (array) - Copy for now, tailoring might be simple selection
         tailoredResumeJSON.achievements = [];
          if (originalResumeJSON.achievements && Array.isArray(originalResumeJSON.achievements)) {
              // Tailor achievements too instead of just copying
              const tailoredAch = await apiClient.tailorSection(
                  jobDescription, originalResumeJSON.achievements, 'achievements'
              );
              tailoredResumeJSON.achievements = tailoredAch || originalResumeJSON.achievements;
          }

         // Copy Contact Info (no tailoring needed)
         tailoredResumeJSON.contact = originalResumeJSON.contact || null;

        // Check final word/character count
        const finalStats = countResumeStats(tailoredResumeJSON);
        console.log(`[${listenerId}] Create Flow: Tailored resume stats - Words: ${finalStats.wordCount}, Characters: ${finalStats.charCount}`);
        if (finalStats.wordCount > 570 || finalStats.charCount > 3650) {
            console.log(`[${listenerId}] Create Flow: Warning - Tailored resume exceeds the target limits`);
        }
      
        console.log(`[${listenerId}] Create Flow: Section tailoring finished.`);
        // console.log("Final Tailored Resume JSON:", JSON.stringify(tailoredResumeJSON, null, 2)); // Optional log

        // --- Step 4: Send Success Response with JSON ---
        console.log(`[${listenerId}] Create Flow: Sending success response to popup...`);
        sendResponse({ success: true, tailoredResumeJSON: tailoredResumeJSON }); // Send JSON object
      console.log(`[${listenerId}] Create Flow: Success response sent.`);

    } catch (error) {
        console.error(`[${listenerId}] Error in createTailoredResume (JSON flow):`, error);
        // --- Step 5: Send Error Response ---
      console.log(`[${listenerId}] Create Flow Error: Sending error response...`);
        // Ensure sendResponse is called even on error
      if (typeof sendResponse === 'function') {
         sendResponse({ success: false, error: error.message }); 
         console.log(`[${listenerId}] Create Flow Error: Error response sent.`);
      } else {
          console.error(`[${listenerId}] Create Flow Error: sendResponse is not a function!`);
      }
    }
}

// --- Main Message Listener ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const listenerId = Date.now(); 
  console.log(`[${listenerId}] Listener Start: Action=${request.action}, Method=${request.extractionMethod || 'N/A'}`);

  if (request.action === "getJobDescription") {
     console.log(`[${listenerId}] Preview Handler Entered. Calling async handler...`);
     handleGetJobDescriptionPreview(request, sendResponse, listenerId); 
     console.log(`[${listenerId}] Preview Handler: Returning true (async).`);
     return true; // Keep returning true to indicate async response
  }

  // Route to the NEW JSON-based handler
  if (request.action === "createTailoredResume") {
     console.log(`[${listenerId}] Create Handler Entered. Calling JSON async handler...`);
     handleCreateTailoredResume(request, sendResponse, listenerId);
     console.log(`[${listenerId}] Create Handler: Returning true (async).`);
     return true; // Keep returning true
  }

  // Handle auto-fill form action
  if (request.action === "autoFillForm") {
     console.log(`[${listenerId}] Auto-Fill Handler Entered. Calling async handler...`);
     handleAutoFillForm(request, sendResponse, listenerId);
     console.log(`[${listenerId}] Auto-Fill Handler: Returning true (async).`);
     return true; // Keep returning true
  }

  // Handle ping action for connection testing
  if (request.action === "ping") {
     console.log(`[${listenerId}] Ping received, responding with pong`);
     sendResponse({ success: true, message: "pong" });
     return true;
  }

  // If no handler matched
  console.log(`[${listenerId}] Listener End: No handler for action ${request.action}.`);
  // return false; 
});