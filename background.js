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

// Helper to get the full DOM text content
async function getFullPageTextContent() {
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

// Function to call Gemini API specifically for extracting the job description
async function extractJobDescriptionViaAI(apiKey, pageTextContent) {
    console.log("Calling Google Gemini API for Job Description Extraction...");
    const modelName = 'gemini-1.5-flash-latest'; // Use a capable model
    const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    // Limit input size to avoid exceeding API limits / excessive cost
    const MAX_PAGE_TEXT_LENGTH = 150000; // Generous limit, adjust as needed
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
             maxOutputTokens: 8192, // Allow potentially long descriptions
             temperature: 0.2 // Lower temperature for more deterministic extraction
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
             // Simplified error handling for this specific call
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
             throw new Error("AI extraction response structure was unexpected.");
        }

        if (extractedText === "NO_JOB_DESCRIPTION_FOUND" || extractedText.length < 50) { // Basic check
            console.warn("AI extraction did not find a job description or result was too short.");
            throw new Error("AI could not confidently extract a job description from the page.");
        }
        
        console.log("AI extraction successful.");
        return extractedText;

    } catch (error) {
        console.error("Error during AI job description extraction:", error);
        // Re-throw for the main handler
        throw new Error(`AI-powered job description extraction failed: ${error.message}`);
    }
}


// === Summarization API Call (Remains largely the same) ===
async function callGoogleGeminiAPI_Summarize(apiKey, jobDescription, resumeData) {
    console.log("Calling Google Gemini API for Summarization...");
    const modelName = 'gemini-1.5-flash-latest'; 
    const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    // ... (Keep job description length check) ...
     const MAX_JD_LENGTH = 50000; 
    if (jobDescription.length > MAX_JD_LENGTH) {
        console.warn("Job description potentially too long for summary, truncating...");
        jobDescription = jobDescription.substring(0, MAX_JD_LENGTH);
    }

    // ... (Keep prompt for summarization) ...
     const prompt = `**Instruction:**
Carefully analyze the attached resume file and the following job description. Generate a concise, tailored resume summary based *only* on the content found within the attached resume file and the job description. 

**Constraints:**
1.  Extract relevant skills and experiences from the resume file that directly match requirements listed in the job description.
2.  **Strictly do not infer or include skills or experiences not explicitly present in the attached resume file**, even if they are typically associated with roles or are mentioned in the job description without corresponding evidence in the resume.
3.  The output summary must be a maximum of 650 words.
4.  The output summary must be a maximum of 4500 characters.
5.  Format the output as plain text paragraphs suitable for a resume summary section.

**--- Job Description ---**
${jobDescription}

**--- Tailored Summary Output ---**`;

    // ... (Keep request body construction with inline_data for resume) ...
     const requestBody = {
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: resumeData.mimeType,
                  data: resumeData.content 
                }
              }
            ]
          }
        ],
        generationConfig: {
           maxOutputTokens: 1024, 
        },
         safetySettings: [
           { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
           { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
           { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
           { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
         ]
    };

    // ... (Keep try/catch block for fetch call and response/constraint handling) ...
      try {
        console.log(`Sending summarization request to ${modelName} with file ${resumeData.filename} (${resumeData.mimeType})...`);
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        // ... (Error handling for response.ok remains the same) ...
        if (!response.ok) {
            let errorData;
            try {
                 errorData = await response.json();
                 console.error("Summarization API Error Response:", errorData);
            } catch (e) {
                 const errorText = await response.text();
                 console.error("Summarization API Error Response (non-JSON):", errorText);
                 errorData = { error: { message: `API request failed with status ${response.status}: ${response.statusText}. Response: ${errorText}` } };
            }
            if (errorData?.promptFeedback?.blockReason) {
                 throw new Error(`Summarization API request blocked due to safety settings: ${errorData.promptFeedback.blockReason}`);
            }
            throw new Error(`Summarization API Error: ${errorData?.error?.message || response.statusText}`);
        }

        const responseData = await response.json();
        console.log("Summarization API Response Received:", responseData);

        let generatedText = '';
        if (responseData.candidates && responseData.candidates[0].finishReason && responseData.candidates[0].finishReason !== 'STOP') {
             console.warn(`Summarization API call finished with reason: ${responseData.candidates[0].finishReason}`);
             if (responseData.candidates[0].finishReason === 'SAFETY') {
                 throw new Error("Summarization API generation stopped due to safety settings.");
             }
        }
        
        if (responseData.candidates && responseData.candidates[0].content?.parts[0]?.text) {
            generatedText = responseData.candidates[0].content.parts[0].text;
        } else {
             console.error("Could not find generated text in summarization API response structure.", responseData);
             if (responseData.candidates?.length > 0 && !responseData.candidates[0].content) {
                  throw new Error("Summarization API returned a candidate but no content, potentially blocked or empty.");
             }
             throw new Error("Summarization API response structure was unexpected. Could not extract summary.");
        }

        // ... (Constraint validation remains the same) ...
         const wordCount = generatedText.split(/\s+/).filter(Boolean).length;
        const charCount = generatedText.length;
        console.log(`Generated summary - Words: ${wordCount}, Chars: ${charCount}`);

        if (wordCount > 650 || charCount > 4500) {
            console.warn("API summary response exceeded constraints despite prompt instruction.");
            throw new Error(`Generated summary exceeded length limits (Words: ${wordCount}/650, Chars: ${charCount}/4500).`);
        }
        
        if (!generatedText.trim()) {
             throw new Error("API returned an empty summary.");
        }

        return { generatedResume: generatedText.trim() };

    } catch (error) {
        console.error("Error during Google Gemini Summarization API call:", error);
        throw new Error(`Failed to generate resume summary via API: ${error.message}`);
    }
}

// === NEW Async Handler Function for Preview ===
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
             console.log(`[${listenerId}] Preview AI: Page text acquired, calling AI extraction...`);
             jobDescription = await extractJobDescriptionViaAI(request.apiToken, pageText);
             console.log(`[${listenerId}] Preview AI: AI extraction finished.`);
        } else { // Default to 'standard'
             console.log(`[${listenerId}] Preview Standard: Calling standard extraction...`);
             jobDescription = await getJobDescriptionFromActiveTab_Standard();
             console.log(`[${listenerId}] Preview Standard: Standard extraction finished.`);
        }
        
        if (!jobDescription || jobDescription.length < 50) {
             console.warn(`[${listenerId}] Preview Warn: Extracted description too short or invalid.`);
             throw new Error("Could not extract a valid job description using the selected method.");
        }
        console.log(`[${listenerId}] Preview Success: Sending response...`);
        sendResponse({ success: true, jobDescription: jobDescription });
        console.log(`[${listenerId}] Preview Success: Response sent.`);
    } catch (error) {
         console.error(`[${listenerId}] Preview Error:`, error);
         console.log(`[${listenerId}] Preview Error: Sending error response...`);
         // Ensure sendResponse is called even on error
         if (typeof sendResponse === 'function') {
            sendResponse({ success: false, error: error.message });
            console.log(`[${listenerId}] Preview Error: Error response sent.`);
         } else {
             console.error(`[${listenerId}] Preview Error: sendResponse is not a function!`);
         }
    }
}

// === NEW Async Handler Function for Create Summary ===
async function handleCreateTailoredResume(request, sendResponse, listenerId) {
    console.log(`[${listenerId}] Create Async Handler Started.`);
    let jobDescription = '';
    try {
      console.log(`[${listenerId}] Create Flow: Received resume data: ${request.resumeData.filename} (Type: ${request.resumeData.mimeType})`);
      console.log(`[${listenerId}] Create Flow: Received API token (first 5 chars): ${request.apiToken.substring(0, 5)}`);

      // --- Step 1: Extract Job Description (Conditional) ---
      console.log(`[${listenerId}] Create Flow: Executing extraction (Method: ${request.extractionMethod})...`);
      if (request.extractionMethod === 'ai') {
          const pageText = await getFullPageTextContent();
          jobDescription = await extractJobDescriptionViaAI(request.apiToken, pageText);
      } else { // Default to 'standard'
          jobDescription = await getJobDescriptionFromActiveTab_Standard();
      }
      
      if (!jobDescription || jobDescription.length < 50) { 
          throw new Error("Could not extract a valid job description using the selected method.");
      }
      console.log(`[${listenerId}] Create Flow: Extracted Job Description using ${request.extractionMethod} (first 100 chars): ${jobDescription.substring(0, 100)}`);

      // --- Step 2: Call Summarization API ---
      console.log(`[${listenerId}] Create Flow: Calling Summarization API...`);
      const apiResult = await callGoogleGeminiAPI_Summarize(request.apiToken, jobDescription, request.resumeData);
      console.log(`[${listenerId}] Create Flow: Summarization API finished.`);

      if (!apiResult.generatedResume) { 
          throw new Error("Summarization API did not return generated resume content.");
      }
      
      console.log(`[${listenerId}] Create Flow: Summarization API call successful, sending response to popup.`);
      // --- Step 3: Send Success Response ---
      sendResponse({ success: true, generatedResume: apiResult.generatedResume });
      console.log(`[${listenerId}] Create Flow: Success response sent.`);

    } catch (error) {
      console.error(`[${listenerId}] Error in createTailoredResume flow:`, error);
      // --- Step 4: Send Error Response ---
      console.log(`[${listenerId}] Create Flow Error: Sending error response...`);
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

  if (request.action === "createTailoredResume") {
     console.log(`[${listenerId}] Create Handler Entered. Calling async handler...`);
     handleCreateTailoredResume(request, sendResponse, listenerId);
     console.log(`[${listenerId}] Create Handler: Returning true (async).`);
     return true; // Keep returning true
  }

  // If no handler matched
  console.log(`[${listenerId}] Listener End: No handler for action ${request.action}.`);
  // Return false or nothing if the response is synchronous or no response needed
  // return false; 
});

// TODO: Implement API call logic to Google Gemini/AI Platform
// TODO: Implement resume processing logic 