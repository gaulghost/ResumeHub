// Centralized API client for Google Gemini
export class GeminiAPIClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://generativelanguage.googleapis.com/v1beta/models';
  }

  async callAPI(model, prompt, config = {}, operation = 'API call') {
    // Use simple rate limiter if available
    const rateLimiter = (typeof window !== 'undefined' && window.simpleRateLimiter) || 
                       (typeof self !== 'undefined' && self.simpleRateLimiter) ||
                       (typeof global !== 'undefined' && global.simpleRateLimiter);
                       
    if (rateLimiter) {
      return await rateLimiter.queueRequest(
        () => this._makeAPICall(model, prompt, config),
        operation
      );
    } else {
      // Fallback to direct call if rate limiter not available
      return await this._makeAPICall(model, prompt, config);
    }
  }

  async _makeAPICall(model, prompt, config = {}) {
    const endpoint = `${this.baseURL}/${model}:generateContent?key=${this.apiKey}`;
    const defaultConfig = {
      temperature: 0.3,
      maxOutputTokens: 8192,
      responseMimeType: "application/json"
    };
    
    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { ...defaultConfig, ...config },
      safetySettings: this.getSafetySettings()
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status}`);
      }

      const responseData = await response.json();
      return responseData;
    } catch (error) {
      throw error;
    }
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
        temperature: options.temperature || 0.1
      },
      safetySettings: this.getSafetySettings()
    };

    const response = await this.callAPIWithCustomBody('gemini-2.5-flash', requestBody, 'resume parsing');
    
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

    const response = await this.callAPI('gemini-2.5-flash', prompt, {
      temperature: 0.2,
      responseMimeType: "text/plain"
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

    const response = await this.callAPI('gemini-2.5-flash', prompt, {
      temperature: 0.4,
      responseMimeType: "application/json"
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
   * @returns {Promise<object>} - A promise that resolves to an object like {min: string, max: string, currency: string}
   */
  async estimateSalary(jobTitle, location, companyName) {
    const prompt = `**Instruction:**
Analyze the provided job title, location, and company name to estimate the annual salary range.

**Job Information:**
- **Title:** ${jobTitle}
- **Company:** ${companyName}
- **Location:** ${location}

**Output Format:**
Return a JSON object with the estimated annual salary range. The "min" and "max" values should be formatted as strings representing thousands (e.g., "120k", "150k").
- Do not add any commentary or extra text.
- Output *only* the valid JSON object.

**JSON Schema:**
\`\`\`json
{
  "min": "string",
  "max": "string",
  "currency": "string"
}
\`\`\`

**Example:**
For a "Senior Software Engineer" in "San Francisco, CA", the output might be:
\`\`\`json
{
  "min": "150k",
  "max": "200k",
  "currency": "$"
}
\`\`\`

**--- Estimated Salary JSON Output ---**`;

    const response = await this.callAPI('gemini-2.5-flash', prompt, {
      temperature: 0.3,
      responseMimeType: "application/json"
    }, 'salary estimation');
    
    if (response.candidates && response.candidates[0]?.content?.parts[0]?.text) {
      const jsonText = response.candidates[0].content.parts[0].text;
      try {
        return JSON.parse(jsonText);
      } catch (parseError) {
        console.error('Failed to parse JSON response for salary estimation:', parseError);
        throw new Error('Failed to parse salary estimation JSON response');
      }
    } else {
      throw new Error('Unexpected response structure from salary estimation API');
    }
  }

  /**
   * Estimates salaries for multiple jobs in a single batch request.
   * @param {object} batchRequest - Contains jobs array and format specification
   * @returns {Promise<object>} - A promise that resolves to batch results
   */
  async batchEstimateSalary(batchRequest) {
    const { jobs, format } = batchRequest;
    
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

    const response = await this.callAPI('gemini-2.5-flash', prompt, {
      temperature: 0.3,
      responseMimeType: "application/json"
    }, 'batch salary estimation');
    
    if (response.candidates && response.candidates[0]?.content?.parts[0]?.text) {
      const jsonText = response.candidates[0].content.parts[0].text;
      try {
        return JSON.parse(jsonText);
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
    const response = await this.callAPI('gemini-2.5-flash', prompt, {
      temperature: 0.1,
      maxOutputTokens: 100,
      responseMimeType: "text/plain"
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

  // Helper method for custom request body
  async callAPIWithCustomBody(model, requestBody, operation = 'API call') {
    // Use simple rate limiter if available
    const rateLimiter = (typeof window !== 'undefined' && window.simpleRateLimiter) || 
                       (typeof self !== 'undefined' && self.simpleRateLimiter) ||
                       (typeof global !== 'undefined' && global.simpleRateLimiter);
                       
    if (rateLimiter) {
      return await rateLimiter.queueRequest(
        () => this._makeAPICallWithCustomBody(model, requestBody),
        operation
      );
    } else {
      // Fallback to direct call if rate limiter not available
      return await this._makeAPICallWithCustomBody(model, requestBody);
    }
  }

  async _makeAPICallWithCustomBody(model, requestBody) {
    const endpoint = `${this.baseURL}/${model}:generateContent?key=${this.apiKey}`;
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
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