// Centralized API client for Google Gemini
export class GeminiAPIClient {
  constructor(apiKey) {
    // Accept a single key string, a comma-separated string, or an array
    if (Array.isArray(apiKey)) {
      this.apiKeys = apiKey.map(k => String(k).trim()).filter(Boolean);
    } else if (typeof apiKey === 'string') {
      this.apiKeys = apiKey.split(',').map(k => k.trim()).filter(Boolean);
    } else {
      this.apiKeys = [];
    }

    // Legacy single-key reference kept for any external code that reads it
    this.apiKey = this.apiKeys[0] || '';

    this.models = [
      'gemini-flash-latest',
      'gemini-3-flash-preview',
      'gemini-flash-lite-latest'
    ];

    // Known RPM and RPD limits per model
    this.limits = {
      'gemini-flash-latest':    { rpm: 5,  rpd: 20  },
      'gemini-3-flash-preview': { rpm: 5,  rpd: 20  },
      'gemini-flash-lite-latest': { rpm: 15, rpd: 500 }
    };

    // call timestamps per "keyIndex_modelIndex" slot — in-memory only, resets on SW restart
    this.callHistory = {};  // `${keyIdx}_${modelIdx}` -> [timestamp, ...]
    // reactive blocks written when a 429/403 arrives from the API
    this.blockedPairs = {}; // `${keyIdx}_${modelIdx}` -> { rpm?: ts, rpd?: ts }

    // Round-robin cursor (persists between calls within the same SW lifetime)
    this._cursor = 0; // indexes into the flattened key×model space

    this.baseURL = 'https://generativelanguage.googleapis.com/v1beta/models';
    // defaultModel is kept so internal callers using this.defaultModel still work;
    // _getNextSlot() picks the actual model — this value is effectively ignored at call-time.
    this.defaultModel = this.models[0];
  }

  // ─── Internal limit helpers ───────────────────────────────────────────────

  _slotKey(ki, mi) { return `${ki}_${mi}`; }

  _isSlotAvailable(ki, mi) {
    const slot = this._slotKey(ki, mi);
    const now  = Date.now();

    // Reactive block written on a real 429/403 from the API
    const block = this.blockedPairs[slot];
    if (block) {
      if (block.rpd && now - block.rpd < 24 * 60 * 60 * 1000) return false; // daily exhausted
      if (block.rpm && now - block.rpm < 60 * 1000)             return false; // per-minute exhausted
    }

    // Proactive local tracking
    const model   = this.models[mi];
    const limit   = this.limits[model];
    if (!limit) return true;

    const history = this.callHistory[slot] || [];
    const oneDayAgo    = now - 24 * 60 * 60 * 1000;
    const oneMinuteAgo = now - 60 * 1000;

    // Prune stale entries
    const dayHistory = history.filter(t => t > oneDayAgo);
    this.callHistory[slot] = dayHistory;

    if (dayHistory.length >= limit.rpd)                              return false;
    if (dayHistory.filter(t => t > oneMinuteAgo).length >= limit.rpm) return false;

    return true;
  }

  _markBlocked(ki, mi, reason) {
    const slot = this._slotKey(ki, mi);
    if (!this.blockedPairs[slot]) this.blockedPairs[slot] = {};
    this.blockedPairs[slot][reason] = Date.now();
    const label = reason === 'rpd' ? '24 h (daily quota)' : '1 min (rate limit)';
    console.warn(`[GeminiAPIClient] key[${ki}] + ${this.models[mi]} blocked for ${label}`);
  }

  _recordCall(ki, mi) {
    const slot = this._slotKey(ki, mi);
    (this.callHistory[slot] = this.callHistory[slot] || []).push(Date.now());
  }

  // ─── Slot picker ─────────────────────────────────────────────────────────

  /**
   * Returns the next available {key, model, ki, mi} combination using round-robin,
   * skipping slots known to be rate-limited.
   * If ALL slots are blocked, falls through to the next cursor position anyway
   * (the real 429 will fire and `_markBlocked` will update state for next time).
   */
  _getNextSlot() {
    const nKeys   = this.apiKeys.length || 1;
    const nModels = this.models.length;
    const total   = nKeys * nModels;

    for (let i = 0; i < total; i++) {
      const idx = (this._cursor + i) % total;
      const ki  = Math.floor(idx / nModels);
      const mi  = idx % nModels;

      if (this._isSlotAvailable(ki, mi)) {
        this._cursor = (idx + 1) % total; // advance past the slot we're about to use
        return {
          key:   this.apiKeys[ki] || this.apiKey,
          model: this.models[mi],
          ki, mi
        };
      }
    }

    // All slots exhausted locally — return current cursor slot and let the API decide
    const idx = this._cursor % total;
    const ki  = Math.floor(idx / nModels);
    const mi  = idx % nModels;
    this._cursor = (this._cursor + 1) % total;
    console.warn('[GeminiAPIClient] All key/model combinations appear rate-limited locally; trying anyway.');
    return {
      key:   this.apiKeys[ki] || this.apiKey,
      model: this.models[mi],
      ki, mi
    };
  }

  // ─── Shared fetch error handler ───────────────────────────────────────────

  _handleErrorResponse(status, errorText, ki, mi) {
    const lower = errorText.toLowerCase();
    if (status === 429 || status === 403) {
      // 403 can also mean quota exceeded on free-tier keys
      const isDailyExhausted =
        lower.includes('quota')     ||
        lower.includes('daily')     ||
        lower.includes('exhausted') ||
        lower.includes('resource has been exhausted');
      this._markBlocked(ki, mi, isDailyExhausted ? 'rpd' : 'rpm');
    }
  }

  // ─── Public API call methods ──────────────────────────────────────────────

  async callAPI(model, prompt, config = {}, operation = 'API call') {
    if (!this.apiKeys || this.apiKeys.length === 0) {
      throw new Error('API_KEY_MISSING');
    }

    const rateLimiter = (typeof window !== 'undefined' && window.simpleRateLimiter) ||
                        (typeof self   !== 'undefined' && self.simpleRateLimiter)   ||
                        (typeof global !== 'undefined' && global.simpleRateLimiter);

    const maxAttempts = Math.max(
      this.apiKeys.length * this.models.length,
      3
    );
    let lastError = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const slot = this._getNextSlot();

      try {
        const call = () => this._makeAPICall(slot.model, slot.key, slot.ki, slot.mi, prompt, config);
        return rateLimiter
          ? await rateLimiter.queueRequest(call, operation)
          : await call();
      } catch (err) {
        console.error(`[GeminiAPIClient] ${operation} attempt ${attempt + 1}/${maxAttempts} failed:`, err.message);
        lastError = err;
        if (attempt < maxAttempts - 1) await new Promise(r => setTimeout(r, 500));
      }
    }
    throw lastError || new Error(`${operation} failed after ${maxAttempts} attempts`);
  }

  async _makeAPICall(model, apiKey, ki, mi, prompt, config = {}) {
    const defaultConfig = {
      temperature: 0.3,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
      thinking: false
    };
    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { ...defaultConfig, ...config },
      safetySettings: this.getSafetySettings()
    };

    const response = await fetch(
      `${this.baseURL}/${model}:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) }
    );

    if (!response.ok) {
      const errorText = await response.text();
      this._handleErrorResponse(response.status, errorText, ki, mi);

      // 'thinking' not supported — retry same slot without it
      if (response.status === 400 && errorText.includes('thinking') &&
          requestBody.generationConfig.thinking !== undefined) {
        delete requestBody.generationConfig.thinking;
        return this._makeAPICallWithCustomBody(model, apiKey, ki, mi, requestBody);
      }
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    this._recordCall(ki, mi);
    return data;
  }

  // Specialized method for resume parsing
  async parseResumeToJSON(resumeData, options = {}) {
    const targetJsonStructure = `{
  "contact": { "name": "string|null", "email": "string|null", "phone": "string|null", "linkedin": "string|null", "github": "string|null", "portfolio": "string|null" },
  "jobTitle": "string|null",
  "summary": "string|null",
  "experience": [ { "title": "string", "company": "string", "location": "string|null", "dates": "string|null", "bullets": ["string", "..."] } ],
  "education": [ { "institution": "string", "degree": "string", "location": "string|null", "dates": "string|null", "details": "string|null" } ],
  "skills": [ { "category": "string", "items": ["string", "..."] } ],
  "projects": [ { "name": "string", "description": "string|null", "technologies": ["string", "..."], "link": "string|null" } ],
  "achievements": [ "string", "..." ]
}`;

    // Use custom prompt if provided, otherwise use default
    const prompt = options.customPrompt || `**Instruction:**
Analyze the attached resume file content. Extract the information and structure it precisely according to the following JSON format. If a section or field is not present in the resume, represent it as 'null' (for objects/strings) or an empty array [] (for arrays like bullets/achievements).
For the "jobTitle" field, extract the person's current or most recent job title/position from their work experience or professional summary. This should be their primary professional role.
For the "skills" section, group related skills into logical categories (e.g., "Programming Languages", "Frameworks & Libraries", "Databases", "Tools", "Cloud Platforms", "AI/ML") and represent it as an array of objects, each with a "category" name and an array of "items".
Do not add any information not present in the resume. Output *only* the valid JSON object, starting with { and ending with }.

**IMPORTANT: The final resume must comply with a 500 word / 3000 character limit.** Focus on capturing the most relevant content while staying within these constraints.

**SPACE OPTIMIZATION GUIDELINES:**
- For skills: Limit to 4-5 categories maximum, with 3-6 items per category
- Consolidate similar skills and remove redundant entries
- Prioritize breadth over exhaustive lists

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
                data: resumeData.content
              }
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: options.temperature || 0.1,
        thinking: false
      },
      safetySettings: this.getSafetySettings()
    };

    const response = await this.callAPIWithCustomBody(this.defaultModel, requestBody, 'resume parsing');
    
    if (response.candidates && response.candidates[0]?.content?.parts[0]?.text) {
      const jsonText = response.candidates[0].content.parts[0].text;
      try {
        return JSON.parse(jsonText);
      } catch (parseError) {
        console.error('Failed to parse JSON response:', parseError);
        throw new Error('Failed to parse JSON response from resume parsing API');
      }
    } else {
      throw new Error('Unexpected response structure from resume parsing API');
    }
  }

  // Specialized method for job description extraction
  async extractJobDescription(pageTextContent) {
    const MAX_PAGE_TEXT_LENGTH = 10000;
    if (pageTextContent.length > MAX_PAGE_TEXT_LENGTH) {
      console.warn(`Page text truncated from ${pageTextContent.length} to ${MAX_PAGE_TEXT_LENGTH} characters`);
      pageTextContent = pageTextContent.substring(0, MAX_PAGE_TEXT_LENGTH);
    }

    const prompt = `**Instruction:**
Analyze the following text content extracted from a webpage. Identify and extract *only* the main job description section. Exclude headers, footers, navigation, related job links, company boilerplates, EEO statements, and any text not part of the core job duties, qualifications, or description.

**Output Format:**
Return *only* the extracted job description text. If no job description is found, return the exact string "NO_JOB_DESCRIPTION_FOUND".

**--- Webpage Text Content ---**
${pageTextContent}

**--- Extracted Job Description ---**`;

    const response = await this.callAPI(this.defaultModel, prompt, {
      temperature: 0.2,
      responseMimeType: "text/plain",
      thinking: false
    }, 'job description extraction');

    if (response.candidates && response.candidates[0]?.content?.parts[0]?.text) {
      const extractedText = response.candidates[0].content.parts[0].text.trim();
      
      if (extractedText === "NO_JOB_DESCRIPTION_FOUND" || extractedText.length < 50) {
        console.warn("AI extraction did not find a job description or result was too short");
        return null;
      }
      
      return extractedText;
    } else {
      throw new Error('Unexpected response structure from job description extraction API');
    }
  }

  // Specialized method for section tailoring
  async tailorSection(jobDescription, originalSectionData, sectionType) {
    const prompt = `**Instruction:**
Analyze the following original resume section (\`${sectionType}\`) and the provided job description. Generate a tailored version of *only this section*, highlighting skills and experiences relevant to the job description.
- Use strong action verbs.
- Quantify achievements where possible based *only* on the original section data.
- Maintain the original meaning and key information.
- **Strictly do not add any skills or experiences not present in the original section data.**
- **IMPORTANT WORD LIMITS (HARD):** Ensure the *entire* final resume (all sections combined) is **≥ 3000 characters AND ≤ 3400 characters AND ≤ 550 words**.  
  - If your draft is longer than the limits, iteratively remove the *least* relevant lines until the limits are satisfied.  
  - If your draft is shorter than 3000 characters, expand bullet points with additional quantifiable detail *present in the original section data* until the lower limit is reached.  
- **SPACE OPTIMIZATION: You may skip less relevant skills or consolidate similar skills to save space and stay within limits.**
- Prioritize the most relevant content to the job description and remove less important details.
${sectionType === 'skills' ? 
`- **Skills Focus**: ONLY include skills directly relevant to the job description. Remove any skills not mentioned in or related to the position requirements.
- **Aggressive Space Saving**: Skip entire skill categories if not relevant. Consolidate similar skills into single entries.
- **Quality over Quantity**: Aim for 3-5 skill categories maximum, with 3-6 items per category.
- If needed, regroup skills into more job-relevant categories and eliminate redundant entries.` 
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

**--- Tailored Section JSON Output (${sectionType}) ---**`;

    const response = await this.callAPI(this.defaultModel, prompt, {
      temperature: 0.4,
      responseMimeType: "application/json",
      thinking: false
    }, `section tailoring for ${sectionType}`);

    if (response.candidates && response.candidates[0]?.content?.parts[0]?.text) {
      const jsonText = response.candidates[0].content.parts[0].text;
      try {
        return JSON.parse(jsonText);
      } catch (parseError) {
        return null;
      }
    } else {
      return null;
    }
  }

  /**
   * Estimates the salary for a job.
   * @param {string} jobTitle
   * @param {string} location
   * @param {string} companyName
   * @param {string} [jobDescription] - Optional full job description
   * @returns {Promise<object>} - A promise that resolves to an object like {min: string, max: string, currency: string}
   */
  async estimateSalary(jobTitle, location, companyName, jobUrl = '', jobDescription = '') {
    // 1. Attempt backend estimation first (by calling batchEstimateSalary with 1 job)
    const batchRequest = {
      jobs: [{
        position: jobTitle,
        company: companyName,
        location: location,
        jobUrl: jobUrl
      }]
    };
    
    try {
      const batchResult = await this.batchEstimateSalary(batchRequest);
      if (batchResult && batchResult.results && batchResult.results.length > 0) {
        const jobResult = batchResult.results[0];
        // If there was no error, return the successful result mapped to estimate's format
        if (jobResult && !jobResult.error) {
          return {
            totalCompensation: jobResult.totalCompensation,
            baseSalary: jobResult.baseSalary,
            bonus: jobResult.bonus,
            stockOptions: jobResult.stockOptions,
            confidence: jobResult.confidence,
            currency: jobResult.currency
          };
        }
      }
    } catch (e) {
      console.warn('[ResumeHub API] Single backend estimate failed, falling back to direct:', e);
    }

    // 2. Direct client-side AI fallback (original logic)
    const prompt = `**Instruction:**
Analyze the provided job title, location, company name${jobDescription ? ', and job description' : ''} to estimate the annual salary range.

**Job Information:**
- **Title:** ${jobTitle}
- **Company:** ${companyName}
- **Location:** ${location}
${jobDescription ? `- **Job Description:**\n\`\`\`\n${jobDescription}\n\`\`\`` : ''}

**Output Requirements:**
- **CRITICAL:** Estimate salary specifically for the **${location}** market. Do NOT use US/Global averages unless the location is in the US.
- **CRITICAL:** Use the **LOCAL CURRENCY** for that location (e.g., ₹ for India, € for Europe, £ for UK, $ for US).
- Provide detailed compensation breakdown (Base, Bonus, Stock).
- Format amounts in local units (e.g., "25L-30L" for Indian Lakhs, "120k-150k" for US thousands).
- Provide confidence level (High/Medium/Low).

**JSON Schema:**
\`\`\`json
{
  "totalCompensation": "string",
  "baseSalary": "string",
  "bonus": "string",
  "stockOptions": "string",
  "confidence": "High|Medium|Low",
  "currency": "string"
}
\`\`\`

**Example (India):**
\`\`\`json
{
  "totalCompensation": "25L-30L",
  "baseSalary": "15L-20L",
  "bonus": "3L-5L",
  "stockOptions": "5L-7L",
  "confidence": "High",
  "currency": "₹"
}
\`\`\`

**Example (US):**
\`\`\`json
{
  "totalCompensation": "150k-200k",
  "baseSalary": "120k-160k",
  "bonus": "15k-20k",
  "stockOptions": "15k-20k",
  "confidence": "High",
  "currency": "$"
}
\`\`\`

**--- Estimated Salary JSON Output ---**`;


    const response = await this.callAPI(this.defaultModel, prompt, {
      temperature: 0.3,
      responseMimeType: "application/json",
      thinking: false
    }, 'salary estimation');
    
    if (response.candidates && response.candidates[0]?.content?.parts[0]?.text) {
      const jsonText = response.candidates[0].content.parts[0].text;
      try {
        const result = JSON.parse(jsonText);
        // Attach debug info
        result.debug = {
            prompt: prompt,
            location: location
        };
        return result;
      } catch (parseError) {
        console.error('Failed to parse JSON response for salary estimation:', parseError);
        throw new Error('Failed to parse salary estimation JSON response');
      }
    } else {
      throw new Error('Unexpected response structure from salary estimation API');
    }
  }

  async batchEstimateSalary(batchRequest) {
    const { jobs } = batchRequest;
    
    let backendFailed = false;
    let backendErrorDetail = '';
    try {
      const backendURL = 'https://resumehub.duckdns.org/api/salary-estimate';
      const response = await fetch(backendURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobs: jobs.map(j => ({
          position: j.position,
          company: j.company,
          location: j.location,
          jobUrl: j.jobUrl
        })) })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.results) {
          return data;
        }
      } else {
        backendFailed = true;
        backendErrorDetail = `HTTP ${response.status}`;
        console.warn('[ResumeHub API] Backend returned status:', response.status, '- falling back to direct client-side AI');
      }
    } catch (e) {
      backendFailed = true;
      backendErrorDetail = e.message || 'Fetch error';
      console.warn('[ResumeHub API] Backend request failed - falling back to direct client-side AI:', e);
    }

    // 2. Direct client-side AI fallback (original logic)
    if (!this.apiKeys || this.apiKeys.length === 0) {
      if (backendFailed) {
        throw new Error(`BACKEND_SERVICE_ERROR: Self-hosted server returned error (${backendErrorDetail}) and no local Gemini API key is configured.`);
      } else {
        throw new Error('API_KEY_MISSING');
      }
    }
    const jobsText = jobs.map((job, index) => 
      `${index + 1}. Position: ${job.position}
   Company: ${job.company}
   Location: ${job.location}
   JobURL: ${job.jobUrl}`
    ).join('\n\n');

    const prompt = `**Instruction:**
Analyze the following ${jobs.length} job positions and provide detailed compensation estimates for each. Use local market data and industry standards for accurate estimates.

**Jobs to Analyze:**
${jobsText}

**Output Requirements:**
- Provide detailed compensation breakdown for each job
- Use local currency based on job location (₹ for India, $ for US, etc.)
- Include total compensation, base salary, bonus, and stock options/ESOP
- Provide confidence level (High/Medium/Low) based on data availability
- Format amounts in local units (e.g., "25L-30L" for Indian Lakhs, "120k-150k" for US thousands)

**JSON Schema:**
\`\`\`json
{
  "results": [
    {
      "jobUrl": "string",
      "totalCompensation": "string",
      "baseSalary": "string", 
      "bonus": "string",
      "stockOptions": "string",
      "confidence": "High|Medium|Low",
      "currency": "string"
    }
  ]
}
\`\`\`

**Example Output:**
\`\`\`json
{
  "results": [
    {
      "jobUrl": "https://example.com/job1",
      "totalCompensation": "25L-30L",
      "baseSalary": "15L-20L",
      "bonus": "3L-5L", 
      "stockOptions": "5L-7L",
      "confidence": "High",
      "currency": "₹"
    }
  ]
}
\`\`\`

**--- Batch Salary Estimation JSON Output ---**`;

    const response = await this.callAPI(this.defaultModel, prompt, {
      temperature: 0.3,
      responseMimeType: "application/json",
      thinking: false
    }, 'batch salary estimation');
    
    if (response.candidates && response.candidates[0]?.content?.parts[0]?.text) {
      const jsonText = response.candidates[0].content.parts[0].text;
      try {
        const parsed = JSON.parse(jsonText);
        
        // Asynchronously report successful client-side estimates to the backend server to cache them
        if (parsed && parsed.results && parsed.results.length > 0) {
          const reportURL = 'https://resumehub.duckdns.org/api/salary-estimate/report';
          const reports = parsed.results.map(res => {
            const matchedJob = jobs.find(j => j.jobUrl === res.jobUrl);
            return {
              position: matchedJob ? matchedJob.position : '',
              company: matchedJob ? matchedJob.company : '',
              location: matchedJob ? matchedJob.location : '',
              totalCompensation: res.totalCompensation,
              baseSalary: res.baseSalary,
              bonus: res.bonus,
              stockOptions: res.stockOptions,
              confidence: res.confidence,
              currency: res.currency
            };
          }).filter(r => r.position && r.company);

          if (reports.length > 0) {
            fetch(reportURL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reports })
            }).then(resp => {
              if (resp.ok) {
                console.log('[ResumeHub API] Reported client-side estimates to server cache successfully');
              }
            }).catch(reportErr => {
              console.warn('[ResumeHub API] Failed to report client-side estimates to server cache:', reportErr);
            });
          }
        }

        return parsed;
      } catch (parseError) {
        console.error('Failed to parse JSON response for batch salary estimation:', parseError);
        throw new Error('Failed to parse batch salary estimation JSON response');
      }
    } else {
      throw new Error('Unexpected response structure from batch salary estimation API');
    }
  }

  // Method for field mapping in auto-fill
  async mapFieldToResume(field, resumeJSON) {
    const fieldContext = `Field: ${field.name || field.id || 'unknown'}
Label: ${field.label || 'none'}
Placeholder: ${field.placeholder || 'none'}
Type: ${field.type || 'text'}`;

    const resumeContext = this.createCompactResumeData(resumeJSON);
    
    const prompt = `Map the following form field to appropriate resume data:

${fieldContext}

Resume Data:
${resumeContext}

Instructions:
- Analyze the field context and determine the most appropriate value from the resume
- For name fields, extract first/last name appropriately
- For contact fields, use exact matches
- For experience/skills fields, provide relevant content
- Return ONLY the value to fill, or "null" if no appropriate match

Value:`;

    const fieldName = field.name || field.id || 'unknown field';
    const response = await this.callAPI(this.defaultModel, prompt, {
      temperature: 0.1,
      maxOutputTokens: 100,
      responseMimeType: "text/plain",
      thinking: false
    }, `field mapping for ${fieldName}`);

    const value = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
    
    if (value && value !== "null" && value.length > 0) {
      return {
        fieldId: field.id || field.name,
        fieldSelector: field.selector,
        fieldValue: value,
        fieldType: field.type
      };
    }
    
    return null;
  }

  // Helper method for custom request body (used for resume parsing with file data, etc.)
  async callAPIWithCustomBody(model, requestBody, operation = 'API call') {
    if (!this.apiKeys || this.apiKeys.length === 0) {
      throw new Error('API_KEY_MISSING');
    }

    const rateLimiter = (typeof window !== 'undefined' && window.simpleRateLimiter) ||
                        (typeof self   !== 'undefined' && self.simpleRateLimiter)   ||
                        (typeof global !== 'undefined' && global.simpleRateLimiter);

    const maxAttempts = Math.max(
      this.apiKeys.length * this.models.length,
      3
    );
    let lastError = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const slot = this._getNextSlot();

      try {
        const call = () => this._makeAPICallWithCustomBody(slot.model, slot.key, slot.ki, slot.mi, requestBody);
        return rateLimiter
          ? await rateLimiter.queueRequest(call, operation)
          : await call();
      } catch (err) {
        console.error(`[GeminiAPIClient] ${operation} attempt ${attempt + 1}/${maxAttempts} failed:`, err.message);
        lastError = err;
        if (attempt < maxAttempts - 1) await new Promise(r => setTimeout(r, 500));
      }
    }
    throw lastError || new Error(`${operation} failed after ${maxAttempts} attempts`);
  }

  async _makeAPICallWithCustomBody(model, apiKey, ki, mi, requestBody) {
    const response = await fetch(
      `${this.baseURL}/${model}:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) }
    );

    if (!response.ok) {
      const errorText = await response.text();
      this._handleErrorResponse(response.status, errorText, ki, mi);

      // 'thinking' not supported — retry same slot without it
      if (response.status === 400 && errorText.includes('thinking') &&
          requestBody.generationConfig?.thinking !== undefined) {
        delete requestBody.generationConfig.thinking;
        return this._makeAPICallWithCustomBody(model, apiKey, ki, mi, requestBody);
      }
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    this._recordCall(ki, mi);
    return data;

  }

  // Helper method to create compact resume data for field mapping
  createCompactResumeData(resumeJSON) {
    return `Name: ${resumeJSON.contact?.name || 'N/A'}
Email: ${resumeJSON.contact?.email || 'N/A'}
Phone: ${resumeJSON.contact?.phone || 'N/A'}
LinkedIn: ${resumeJSON.contact?.linkedin || 'N/A'}
Summary: ${resumeJSON.summary || 'N/A'}`;
  }

  getSafetySettings() {
    return [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
    ];
  }
}

// Make available globally for Chrome extension
/*
if (typeof window !== 'undefined') {
  window.GeminiAPIClient = GeminiAPIClient;
} else if (typeof self !== 'undefined') {
  self.GeminiAPIClient = GeminiAPIClient;
} else if (typeof global !== 'undefined') {
  global.GeminiAPIClient = GeminiAPIClient;
} else {
  // For service workers and other environments
  this.GeminiAPIClient = GeminiAPIClient;
}
*/