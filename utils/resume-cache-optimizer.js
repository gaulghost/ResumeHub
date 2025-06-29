/**
 * Resume Cache Optimizer
 * Implements multi-pass resume parsing and intelligent caching
 */

class ResumeCacheOptimizer {
  constructor(apiClient) {
    this.apiClient = apiClient;
    this.cacheKey = 'optimized_resume_json';
    this.maxCacheAge = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Get optimized resume JSON with 3-pass approach and caching
   */
  async getOptimizedResumeJSON(resumeData) {
    console.log('🔍 Starting optimized resume JSON retrieval...');
    
    const resumeHash = this.generateResumeHash(resumeData);
    const cacheKey = `${this.cacheKey}_${resumeHash}`;
    
    // Check if we have cached optimized JSON
    const cached = await StorageManager.getValidCache(cacheKey);
    if (cached) {
      console.log('✅ Using cached optimized resume JSON');
      return {
        resumeJSON: cached.resumeJSON,
        metadata: {
          source: 'cache',
          cacheAge: Date.now() - cached.timestamp,
          originalPasses: cached.originalPasses || 3
        }
      };
    }

    console.log('🔄 No valid cache found, generating optimized resume JSON...');
    
    // Generate optimized JSON with 3-pass approach
    const optimizationResult = await this.generateOptimizedJSON(resumeData);
    
    // Cache the result
    await this.cacheOptimizedJSON(cacheKey, optimizationResult);
    
    return optimizationResult;
  }

  /**
   * Generate optimized JSON using 3-pass approach
   */
  async generateOptimizedJSON(resumeData) {
    console.log('🚀 Starting 3-pass resume optimization...');
    const startTime = Date.now();
    
    try {
      // Step 1: Generate 3 different JSON parses in parallel
      const jsonVariants = await this.generateMultipleParses(resumeData);
      console.log(`📊 Generated ${jsonVariants.length} JSON variants`);
      
      if (jsonVariants.length === 0) {
        throw new Error('Failed to generate any valid JSON variants');
      }
      
      // Step 2: Use AI to combine and optimize if we have multiple variants
      let optimizedJSON;
      if (jsonVariants.length === 1) {
        console.log('📝 Using single variant as optimized JSON');
        optimizedJSON = jsonVariants[0];
      } else {
        console.log('🧠 Combining multiple variants with AI optimization...');
        optimizedJSON = await this.combineAndOptimize(jsonVariants);
      }
      
      const processingTime = Date.now() - startTime;
      console.log(`✅ Resume optimization completed in ${processingTime}ms`);
      
      return {
        resumeJSON: optimizedJSON,
        metadata: {
          source: 'generated',
          processingTime,
          variantsGenerated: jsonVariants.length,
          timestamp: Date.now(),
          optimization: jsonVariants.length > 1 ? 'multi-pass' : 'single-pass'
        }
      };
      
    } catch (error) {
      console.error('❌ Resume optimization failed:', error);
      throw new Error(`Resume optimization failed: ${error.message}`);
    }
  }

  /**
   * Generate multiple JSON parses with different focus areas
   */
  async generateMultipleParses(resumeData) {
    console.log('🔄 Generating multiple JSON parses...');
    
    const parseConfigurations = [
      {
        name: 'comprehensive',
        focus: 'Extract all information comprehensively with detailed structure',
        temperature: 0.1,
        emphasis: 'completeness'
      },
      {
        name: 'skills_focused',
        focus: 'Focus on skills, technologies, and technical competencies',
        temperature: 0.15,
        emphasis: 'skills and experience optimization'
      },
      {
        name: 'structure_optimized',
        focus: 'Optimize structure, formatting, and professional presentation',
        temperature: 0.1,
        emphasis: 'structure and clarity'
      }
    ];

    // Generate parses in parallel with controlled concurrency
    const parsePromises = parseConfigurations.map(async (config, index) => {
      try {
        console.log(`🔄 Starting ${config.name} parse (${index + 1}/3)...`);
        
        const customPrompt = this.createCustomParsePrompt(config);
        const result = await this.apiClient.parseResumeToJSON(resumeData, {
          customPrompt,
          temperature: config.temperature,
          focus: config.emphasis
        });
        
        console.log(`✅ ${config.name} parse completed`);
        return {
          config: config.name,
          result: result,
          success: true
        };
        
      } catch (error) {
        console.warn(`⚠️ ${config.name} parse failed:`, error.message);
        return {
          config: config.name,
          error: error.message,
          success: false
        };
      }
    });

    // Wait for all parses with timeout
    const results = await Promise.allSettled(parsePromises);
    
    // Extract successful results
    const successfulVariants = results
      .filter(result => result.status === 'fulfilled' && result.value.success)
      .map(result => result.value.result);
    
    console.log(`📋 Generated ${successfulVariants.length}/3 successful JSON variants`);
    return successfulVariants;
  }

  /**
   * Create custom prompt for specific parse configuration
   */
  createCustomParsePrompt(config) {
    const baseStructure = `{
  "contact": { "name": "string|null", "email": "string|null", "phone": "string|null", "linkedin": "string|null", "github": "string|null", "portfolio": "string|null" },
  "summary": "string|null",
  "experience": [ { "title": "string", "company": "string", "location": "string|null", "dates": "string|null", "bullets": ["string", "..."] } ],
  "education": [ { "institution": "string", "degree": "string", "location": "string|null", "dates": "string|null", "details": "string|null" } ],
  "skills": [ { "category": "string", "items": ["string", "..."] } ],
  "projects": [ { "name": "string", "description": "string|null", "technologies": ["string", "..."], "link": "string|null" } ],
  "achievements": [ "string", "..." ]
}`;

    return `**Instruction:**
Analyze the attached resume file with special emphasis on ${config.emphasis}.

**Focus Area:** ${config.focus}

**Requirements:**
- Extract information and structure it according to the JSON format below
- ${config.name === 'comprehensive' ? 'Capture every detail and ensure no information is lost' : ''}
- ${config.name === 'skills_focused' ? 'Pay special attention to technical skills, tools, frameworks, and technologies. Group skills logically.' : ''}
- ${config.name === 'structure_optimized' ? 'Optimize for clarity, professional presentation, and ATS compatibility' : ''}
- If a section is not present, use null or empty arrays as appropriate
- Ensure dates are consistently formatted
- Group skills into logical categories
- Output only valid JSON starting with { and ending with }

**Target JSON Structure:**
\`\`\`json
${baseStructure}
\`\`\`

**Resume Analysis and JSON Output:**`;
  }

  /**
   * Combine multiple JSON variants into one optimized version
   */
  async combineAndOptimize(jsonVariants) {
    console.log('🧠 Combining and optimizing JSON variants...');
    
    if (jsonVariants.length === 1) {
      return jsonVariants[0];
    }

    const prompt = `**Task:** Analyze and combine these ${jsonVariants.length} JSON representations of the same resume into one optimized version.

${jsonVariants.map((json, i) => `
**Version ${i + 1}:**
\`\`\`json
${JSON.stringify(json, null, 2)}
\`\`\`
`).join('\n')}

**Combination Instructions:**
1. **Merge Information:** Combine the best elements from each version
2. **Resolve Conflicts:** Choose the most detailed and accurate information when versions differ
3. **Skill Optimization:** Merge all skills while removing duplicates and organizing logically
4. **Experience Enhancement:** Combine experience details, taking the most comprehensive bullet points
5. **Contact Information:** Use the most complete contact details
6. **Structure Consistency:** Maintain consistent formatting and structure
7. **Quality Assurance:** Ensure no information is lost in the combination

**Output Requirements:**
- Output ONLY the final optimized JSON structure
- Start with { and end with }
- Ensure all sections are properly formatted
- Remove any duplicate or redundant information
- Maintain professional language and clarity

**Final Optimized JSON:**`;

    try {
      const response = await this.apiClient.callAPI('gemini-2.5-flash', prompt, {
        temperature: 0.1,
        responseMimeType: "application/json",
        maxOutputTokens: 8192
      });

      if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
        try {
          const optimizedJSON = JSON.parse(response.candidates[0].content.parts[0].text);
          console.log('✅ Successfully combined and optimized JSON variants');
          return optimizedJSON;
        } catch (parseError) {
          console.warn('⚠️ Failed to parse optimized JSON, using best variant');
          return this.selectBestVariant(jsonVariants);
        }
      } else {
        console.warn('⚠️ Invalid response from optimization API, using best variant');
        return this.selectBestVariant(jsonVariants);
      }
    } catch (error) {
      console.error('❌ JSON optimization failed:', error);
      return this.selectBestVariant(jsonVariants);
    }
  }

  /**
   * Select the best variant when optimization fails
   */
  selectBestVariant(jsonVariants) {
    console.log('🎯 Selecting best variant from available options...');
    
    // Score variants based on completeness
    const scoredVariants = jsonVariants.map(variant => ({
      variant,
      score: this.scoreVariantCompleteness(variant)
    }));
    
    // Sort by score and return the best one
    scoredVariants.sort((a, b) => b.score - a.score);
    const bestVariant = scoredVariants[0].variant;
    
    console.log(`✅ Selected best variant with score: ${scoredVariants[0].score}`);
    return bestVariant;
  }

  /**
   * Score variant based on completeness and quality
   */
  scoreVariantCompleteness(variant) {
    let score = 0;
    
    // Contact information (20 points max)
    if (variant.contact) {
      score += variant.contact.name ? 5 : 0;
      score += variant.contact.email ? 5 : 0;
      score += variant.contact.phone ? 3 : 0;
      score += variant.contact.linkedin ? 3 : 0;
      score += variant.contact.github ? 2 : 0;
      score += variant.contact.portfolio ? 2 : 0;
    }
    
    // Experience (25 points max)
    if (variant.experience && Array.isArray(variant.experience)) {
      score += Math.min(variant.experience.length * 5, 15);
      const totalBullets = variant.experience.reduce((sum, exp) => 
        sum + (exp.bullets ? exp.bullets.length : 0), 0);
      score += Math.min(totalBullets * 1, 10);
    }
    
    // Skills (20 points max)
    if (variant.skills && Array.isArray(variant.skills)) {
      score += Math.min(variant.skills.length * 3, 15);
      const totalSkillItems = variant.skills.reduce((sum, skillCat) => 
        sum + (skillCat.items ? skillCat.items.length : 0), 0);
      score += Math.min(totalSkillItems * 0.5, 5);
    }
    
    // Education (15 points max)
    if (variant.education && Array.isArray(variant.education)) {
      score += Math.min(variant.education.length * 7, 15);
    }
    
    // Projects (10 points max)
    if (variant.projects && Array.isArray(variant.projects)) {
      score += Math.min(variant.projects.length * 3, 10);
    }
    
    // Summary and achievements (10 points max)
    score += variant.summary ? 5 : 0;
    if (variant.achievements && Array.isArray(variant.achievements)) {
      score += Math.min(variant.achievements.length * 1, 5);
    }
    
    return score;
  }

  /**
   * Cache optimized JSON result
   */
  async cacheOptimizedJSON(cacheKey, optimizationResult) {
    try {
      const cacheData = {
        resumeJSON: optimizationResult.resumeJSON,
        timestamp: Date.now(),
        metadata: optimizationResult.metadata,
        originalPasses: optimizationResult.metadata.variantsGenerated || 1
      };
      
      await StorageManager.setCache(cacheKey, cacheData, 24); // 24 hour expiry
      console.log(`💾 Cached optimized resume JSON with key: ${cacheKey}`);
      
    } catch (error) {
      console.warn('⚠️ Failed to cache optimized JSON:', error);
    }
  }

  /**
   * Generate hash for resume data
   * Uses SharedUtilities for consistent hashing across the application
   */
  generateResumeHash(resumeData) {
    return SharedUtilities.generateResumeHash(resumeData);
  }

  /**
   * Invalidate cached resume JSON
   */
  async invalidateResumeCache(resumeData = null) {
    console.log('🗑️ Invalidating resume JSON cache...');
    
    if (resumeData) {
      // Invalidate specific resume cache
      const resumeHash = this.generateResumeHash(resumeData);
      const cacheKey = `${this.cacheKey}_${resumeHash}`;
      await StorageManager.clearCache(cacheKey);
      console.log(`✅ Invalidated cache for specific resume: ${cacheKey}`);
    } else {
      // Invalidate all resume caches
      const allKeys = await this.getAllCacheKeys();
      const resumeCacheKeys = allKeys.filter(key => key.startsWith(this.cacheKey));
      
      for (const key of resumeCacheKeys) {
        await StorageManager.clearCache(key);
      }
      
      console.log(`✅ Invalidated ${resumeCacheKeys.length} resume cache entries`);
    }
  }

  /**
   * Get all cache keys (helper method)
   */
  async getAllCacheKeys() {
    try {
      const storage = await chrome.storage.local.get(null);
      return Object.keys(storage);
    } catch (error) {
      console.error('Failed to get cache keys:', error);
      return [];
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    const allKeys = await this.getAllCacheKeys();
    const resumeCacheKeys = allKeys.filter(key => key.startsWith(this.cacheKey));
    
    let totalSize = 0;
    let validCaches = 0;
    
    for (const key of resumeCacheKeys) {
      const cached = await StorageManager.getCache(key);
      if (cached) {
        totalSize += JSON.stringify(cached).length;
        
        // Check if cache is still valid
        if (await StorageManager.getValidCache(key)) {
          validCaches++;
        }
      }
    }
    
    return {
      totalEntries: resumeCacheKeys.length,
      validEntries: validCaches,
      totalSizeBytes: totalSize,
      averageSizeBytes: resumeCacheKeys.length > 0 ? Math.round(totalSize / resumeCacheKeys.length) : 0
    };
  }
}

// Make ResumeCacheOptimizer available globally
if (typeof window !== 'undefined') {
  window.ResumeCacheOptimizer = ResumeCacheOptimizer;
} 