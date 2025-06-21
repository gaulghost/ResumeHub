// ResumeHub background service worker

chrome.runtime.onInstalled.addListener(() => {
  console.log('ResumeHub extension installed.');
  chrome.storage.sync.set({ theme: 'light', extractionMethod: 'standard' }); // Set defaults
});

// === Standard Extraction (Using Selectors) ===

// Helper to inject the selector logic into the page
async function getJobDescriptionFromActiveTab_Standard() {
  console.log("Attempting standard job description extraction...");
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      if (!tabs[0]?.id) return reject(new Error("No active tab found."));
      const tabId = tabs[0].id;
      
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: findJobDescriptionOnPage_Standard, // Note: func, not function for passing the actual function
      }, (results) => {
        if (chrome.runtime.lastError) {
          console.error("Standard Extraction Script Error: ", chrome.runtime.lastError);
          return reject(chrome.runtime.lastError);
        }
        if (results && results[0] && results[0].result) {
          console.log("Standard extraction successful.");
          resolve(results[0].result);
        } else {
           // Fallback if specific selectors fail
           console.warn("Standard selectors failed, attempting fallback extraction (main content)...");
           chrome.scripting.executeScript({
               target: { tabId: tabId },
               func: () => { 
                  const mainElement = document.querySelector('main');
                  if (mainElement) return mainElement.innerText;
                  // Very basic fallback if no <main>
                  return document.body.innerText?.substring(0, 50000); // Limit fallback size
               },
           }, (fallbackResults) => {
                if (chrome.runtime.lastError) {
                    console.error("Fallback Extraction Script Error: ", chrome.runtime.lastError);
                    return reject(new Error("Standard extraction failed, fallback also failed."));
                }
                if (fallbackResults && fallbackResults[0] && fallbackResults[0].result) {
                     console.log("Fallback extraction successful.");
                     resolve(fallbackResults[0].result);
                } else {
                     reject(new Error("Standard and fallback extraction failed to find content."));
                }
           });
        }
      });
    });
  });
}

// Function injected for standard extraction (kept for reference, called by helper)
function findJobDescriptionOnPage_Standard() {
  const selectors = [
    // Common High-Level Containers
    '#job-description', '.job-description',
    '[class*="job-details"]', '[class*="jobDescription"]', '[class*="jobdesc"]', 
    '[aria-label*="description"]', '[data-testid*="description"]',
    // Specific Job Boards (Examples - Add More!)
    '.jobsearch-JobComponent-description', // Indeed
    '.jobs-description-content__text', // LinkedIn (Primary Description Area)
    '#job_details', // LinkedIn (Older? Might be specific views)
    '.jobdesciptioncontent', '.jobDescriptionContent', // Greenhouse
    'section[data-qa="job-description"]', // Lever
    '.job-details-content', // SmartRecruiters
    '.ats-description-wrapper', // Ashby?
    // Generic Content Areas (Lower Priority)
    '.content .description', 'article .job-body' 
  ];
  console.log("Running standard extraction selectors...");
  for (const selector of selectors) {
    try {
        const element = document.querySelector(selector);
        if (element && element.innerText?.trim()?.length > 100) { // Check for meaningful content
          console.log(`Standard extraction found via selector: ${selector}`);
          return element.innerText;
        }
    } catch (e) { console.warn(`Error with selector ${selector}: ${e.message}`); }
  }
  console.warn('Standard extraction could not find specific element using selectors.');
  return null; // Return null if nothing specific is found
}

// === AI-Powered Extraction ===

// Helper to get the full DOM text content (or targeted)
async function getFullPageTextContent() {
     // Reverted to simpler innerText extraction as per user change. 
     // If issues persist with dynamic pages, re-evaluate the targeted/delay logic.
     console.log("Getting full page text content for AI extraction...");
     return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
            if (!tabs[0]?.id) return reject(new Error("No active tab found."));
            const tabId = tabs[0].id;

            chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: () => document.body.innerText || document.documentElement.innerText, // Get all visible text
            }, (results) => {
                if (chrome.runtime.lastError) {
                    console.error("Error getting page text content: ", chrome.runtime.lastError);
                    return reject(chrome.runtime.lastError);
                }
                if (results && results[0] && results[0].result) {
                    console.log("Successfully got page text content.");
                    resolve(results[0].result);
                } else {
                    reject(new Error("Could not retrieve text content from the page."));
                }
            });
        });
    });
}


// Function to call Gemini API specifically for *extracting* the job description text
// (This is kept separate from the tailoring logic now)
async function extractJobDescriptionViaAI(apiKey, pageTextContent) {
    console.log("Calling Google Gemini API for Job Description Extraction...");
    const modelName = 'gemini-2.5-flash'; // Using Gemini 2.5 Flash for efficient job description extraction
    const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    // Limit input size (using user's last value)
    const MAX_PAGE_TEXT_LENGTH = 10000; 
    if (pageTextContent.length > MAX_PAGE_TEXT_LENGTH) {
        console.warn(`Page text content truncated from ${pageTextContent.length} to ${MAX_PAGE_TEXT_LENGTH} characters.`);
        pageTextContent = pageTextContent.substring(0, MAX_PAGE_TEXT_LENGTH);
    }

    const prompt = `**Instruction:**
Analyze the following text content extracted from a webpage. Identify and extract *only* the main job description section. Exclude headers, footers, navigation, related job links, company boilerplates, EEO statements, and any text not part of the core job duties, qualifications, or description.

**Output Format:**
Return *only* the extracted job description text. If no job description is found, return the exact string "NO_JOB_DESCRIPTION_FOUND".

**--- Webpage Text Content ---**
${pageTextContent}

**--- Extracted Job Description ---**`;

    const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { 
             maxOutputTokens: 8192, 
             temperature: 0.2 
         },
         safetySettings: [
           { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
           { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
           { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
           { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
         ]
    };

    try {
        console.log(`Sending extraction request to ${modelName}...`);
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorText = await response.text(); 
            console.error("AI Extraction API Error:", response.status, errorText);
            throw new Error(`AI extraction API request failed (${response.status}).`);
        }

        const responseData = await response.json();
        console.log("AI Extraction Response Received.");

        let extractedText = '';
        if (responseData.candidates && responseData.candidates[0]?.content?.parts[0]?.text) {
            extractedText = responseData.candidates[0].content.parts[0].text.trim();
        } else {
             console.error("Could not find text in AI extraction response structure.", responseData);
              if (responseData.candidates?.length > 0 && !responseData.candidates[0].content) {
                    throw new Error("AI Extraction API returned a candidate but no content, potentially blocked.");
              } else if (responseData.promptFeedback?.blockReason) {
                   throw new Error(`AI Extraction API request blocked due to safety settings: ${responseData.promptFeedback.blockReason}`);
              }
             throw new Error("AI extraction response structure was unexpected.");
        }

        if (extractedText === "NO_JOB_DESCRIPTION_FOUND" || extractedText.length < 50) { 
            console.warn("AI extraction did not find a job description or result was too short.");
            // Return null instead of throwing error here, let the caller decide
            return null; 
        }
        
        console.log("AI extraction successful.");
        return extractedText;

    } catch (error) {
        console.error("Error during AI job description extraction:", error);
        // Re-throw for the main handler if needed, or return null
        throw new Error(`AI-powered job description extraction failed: ${error.message}`);
    }
}

// === NEW Function to Parse Resume to JSON ===
async function parseResumeToJSON(apiKey, resumeData) {
    console.log(`Attempting to parse resume ${resumeData.filename} (${resumeData.mimeType}) into JSON...`);
    const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`; // Using free Gemini 2.5 Flash model
    const modelName = "gemini-2.5-flash";

    // Define the target JSON structure in the prompt
    const targetJsonStructure = `{
  "contact": { "name": "string|null", "email": "string|null", "phone": "string|null", "linkedin": "string|null", "github": "string|null", "portfolio": "string|null" },
  "summary": "string|null",
  "experience": [ { "title": "string", "company": "string", "location": "string|null", "dates": "string|null", "bullets": ["string", "..."] } ],
  "education": [ { "institution": "string", "degree": "string", "location": "string|null", "dates": "string|null", "details": "string|null" } ],
  "skills": [ { "category": "string", "items": ["string", "..."] } ],
  "projects": [ { "name": "string", "description": "string|null", "technologies": ["string", "..."], "link": "string|null" } ],
  "achievements": [ "string", "..." ]
}`;

     const prompt = `**Instruction:**
Analyze the attached resume file content. Extract the information and structure it precisely according to the following JSON format. If a section or field is not present in the resume, represent it as 'null' (for objects/strings) or an empty array [] (for arrays like bullets/achievements).
For the "skills" section, group related skills into logical categories (e.g., "Programming Languages", "Frameworks & Libraries", "Databases", "Tools", "Cloud Platforms", "AI/ML") and represent it as an array of objects, each with a "category" name and an array of "items".
Do not add any information not present in the resume. Output *only* the valid JSON object, starting with { and ending with }.

**IMPORTANT: The final resume must comply with a 570 word / 3650 character limit.** Focus on capturing the most relevant content while staying within these constraints.

**Target JSON Structure:**
\`\`\`json
${targetJsonStructure}
\`\`\`

**--- Resume Content Analysis ---**
Parse the attached file and generate the JSON output.`;

     const requestBody = {
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: resumeData.mimeType,
                  data: resumeData.content // Assuming content is Base64
                }
              }
            ]
          }
        ],
        generationConfig: {
           responseMimeType: "application/json", // Request JSON output directly
           temperature: 0.1 // Low temperature for structured output
        },
        safetySettings: [ /* Standard safety settings */
           { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
           { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
           { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
           { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
         ]
    };

      try {
        console.log(`Sending resume parsing request to ${modelName}...`);
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
                 const errorText = await response.text();
             console.error("Resume Parsing API Error:", response.status, errorText);
             throw new Error(`Resume parsing API request failed (${response.status}). Response: ${errorText}`);
        }

        const responseData = await response.json();
        console.log("Resume Parsing Response Received.");

        if (responseData.candidates && responseData.candidates[0]?.content?.parts[0]?.text) {
            const jsonText = responseData.candidates[0].content.parts[0].text;
            try {
                 const parsedJson = JSON.parse(jsonText);
                 console.log("Successfully parsed resume JSON.");
                 return parsedJson;
            } catch (parseError) {
                 console.error("Failed to parse JSON response from resume parsing API:", parseError, "\nRaw Text:", jsonText);
                 throw new Error("Failed to parse JSON response from resume parsing API.");
            }
        } else {
             console.error("Could not find JSON text in resume parsing response structure.", responseData);
             // Check for blocks
             if (responseData.candidates?.length > 0 && !responseData.candidates[0].content) {
                    throw new Error("Resume parsing API returned a candidate but no content, potentially blocked.");
              } else if (responseData.promptFeedback?.blockReason) {
                   throw new Error(`Resume parsing API request blocked due to safety settings: ${responseData.promptFeedback.blockReason}`);
             }
             throw new Error("Resume parsing response structure was unexpected.");
        }

    } catch (error) {
        console.error("Error during resume JSON parsing API call:", error);
        throw new Error(`Failed to parse resume to JSON via API: ${error.message}`);
        }
}


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
             const pageText = await getFullPageTextContent();
             // console.log('pageText', pageText); // Keep commented unless debugging extraction
             console.log(`[${listenerId}] Preview AI: Page text acquired, calling AI extraction...`);
             jobDescription = await extractJobDescriptionViaAI(request.apiToken, pageText);
             console.log(`[${listenerId}] Preview AI: AI extraction finished.`);
        } else { // Default to 'standard'
             console.log(`[${listenerId}] Preview Standard: Calling standard extraction...`);
             jobDescription = await getJobDescriptionFromActiveTab_Standard();
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
        const originalResumeJSON = await parseResumeToJSON(request.apiToken, request.resumeData);
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
                 const pageText = await getFullPageTextContent(); // Assumes getFullPageTextContent is still defined
                 jobDescription = await extractJobDescriptionViaAI(request.apiToken, pageText); // Assumes extractJobDescriptionViaAI is still defined
            } else {
                 jobDescription = await getJobDescriptionFromActiveTab_Standard(); // Assumes getJobDescriptionFromActiveTab_Standard is still defined
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
            tailoredResumeJSON.summary = await callGoogleGeminiAPI_TailorSection(
                request.apiToken, jobDescription, { summary: originalResumeJSON.summary }, 'summary'
            )?.summary || originalResumeJSON.summary; // Fallback to original if tailoring fails
        } else {
            tailoredResumeJSON.summary = null;
        }

        // Tailor Experience (array)
        tailoredResumeJSON.experience = [];
        if (originalResumeJSON.experience && Array.isArray(originalResumeJSON.experience)) {
             for (const exp of originalResumeJSON.experience) {
                 const tailoredExp = await callGoogleGeminiAPI_TailorSection(
                     request.apiToken, jobDescription, exp, 'experience'
                 );
                 tailoredResumeJSON.experience.push(tailoredExp || exp); // Fallback to original entry
             }
        }
        
        // Tailor Education (array) - Often less tailoring needed, maybe just copy? Or tailor slightly.
         tailoredResumeJSON.education = [];
         if (originalResumeJSON.education && Array.isArray(originalResumeJSON.education)) {
             for (const edu of originalResumeJSON.education) {
                 // Decide if tailoring education makes sense. For now, let's copy it.
                 // const tailoredEdu = await callGoogleGeminiAPI_TailorSection(request.apiToken, jobDescription, edu, 'education');
                 // tailoredResumeJSON.education.push(tailoredEdu || edu);
                 tailoredResumeJSON.education.push(edu); // Copy original for now
             }
         }
         
         // Tailor Skills (object/string)
         if (originalResumeJSON.skills) {
              tailoredResumeJSON.skills = await callGoogleGeminiAPI_TailorSection(
                  request.apiToken, jobDescription, originalResumeJSON.skills, 'skills'
              ) || originalResumeJSON.skills; // Fallback
         } else {
             tailoredResumeJSON.skills = null;
         }

         // Tailor Projects (array)
         tailoredResumeJSON.projects = [];
         if (originalResumeJSON.projects && Array.isArray(originalResumeJSON.projects)) {
             for (const proj of originalResumeJSON.projects) {
                 const tailoredProj = await callGoogleGeminiAPI_TailorSection(
                     request.apiToken, jobDescription, proj, 'projects'
                 );
                 tailoredResumeJSON.projects.push(tailoredProj || proj); // Fallback
             }
         }
         
         // Tailor Achievements (array) - Copy for now, tailoring might be simple selection
         tailoredResumeJSON.achievements = [];
          if (originalResumeJSON.achievements && Array.isArray(originalResumeJSON.achievements)) {
              // Tailor achievements too instead of just copying
              const tailoredAch = await callGoogleGeminiAPI_TailorSection(
                  request.apiToken, jobDescription, originalResumeJSON.achievements, 'achievements'
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

  // If no handler matched
  console.log(`[${listenerId}] Listener End: No handler for action ${request.action}.`);
  // return false; 
});

// Cleanup TODOs from previous versions if any
// Removed old callGoogleGeminiAPI_TailorResume function
// Removed old handleCreateTailoredResume function

// TODO: Implement API call logic to Google Gemini/AI Platform
// TODO: Implement resume processing logic 