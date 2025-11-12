/**
 * JobInsightsManager - Enterprise-grade module for managing job insights
 * Handles caching, state management, and optimized AI calls
 */
export class JobInsightsManager {
  constructor(sidebarInstance) {
    this.sidebar = sidebarInstance;
    this.cache = new Map(); // Cache for insights by job signature
    this.loadingState = new Set(); // Track what's currently loading
    this.jobSignature = null; // Current job signature
  }

  /**
   * Generate a unique signature for the current job
   */
  _getJobSignature(jobTitle, companyName, jobUrl) {
    return `${jobTitle}|${companyName}|${jobUrl || window.location.href}`;
  }

  /**
   * Check if insights are already loaded for current job
   */
  _isInsightsLoaded(signature) {
    return this.cache.has(signature) && this.cache.get(signature).loaded;
  }

  /**
   * Check if a specific insight type is already loaded
   */
  _isInsightTypeLoaded(signature, insightType) {
    const cached = this.cache.get(signature);
    return cached && cached.insights && cached.insights[insightType] !== undefined;
  }

  /**
   * Get cached insights
   */
  _getCachedInsights(signature) {
    return this.cache.get(signature)?.insights || null;
  }

  /**
   * Set cached insights
   */
  _setCachedInsights(signature, insights) {
    if (!this.cache.has(signature)) {
      this.cache.set(signature, { loaded: false, insights: {} });
    }
    const cached = this.cache.get(signature);
    Object.assign(cached.insights, insights);
    cached.loaded = true;
  }

  /**
   * Mark insight type as loading
   */
  _setLoading(insightType, isLoading) {
    if (isLoading) {
      this.loadingState.add(insightType);
    } else {
      this.loadingState.delete(insightType);
    }
  }

  /**
   * Check if insight type is loading
   */
  _isLoading(insightType) {
    return this.loadingState.has(insightType);
  }

  /**
   * Extract job description from various sources
   */
  async _getJobDescription() {
    const extractedJdTextarea = this.sidebar.root.getElementById('rh-extracted-jd');
    let jobDescription = extractedJdTextarea?.value || this.sidebar._lastExtractedJD || '';
    
    if (!jobDescription || jobDescription.length < 50) {
      const jobDescriptionEl = document.querySelector('#job-details, .jobs-description__text, .jobs-description-content__text');
      if (jobDescriptionEl) {
        jobDescription = jobDescriptionEl.textContent || '';
      }
    }
    
    return jobDescription && jobDescription.length >= 50 ? jobDescription : null;
  }

  /**
   * Get job context (title, company, location)
   */
  _getJobContext() {
    const jobTitle = this.sidebar.root.getElementById('rh-job-title')?.textContent || '';
    const jobMeta = this.sidebar.root.getElementById('rh-job-meta')?.textContent || '';
    const companyName = jobMeta.split('•')[0]?.trim() || '';
    const location = jobMeta.split('•')[1]?.trim() || '';
    const jobUrl = window.location.href || '';
    
    return { jobTitle, companyName, location, jobUrl };
  }

  /**
   * Batch fetch all insights in a single optimized AI call
   */
  async _fetchAllInsightsBatch(jobDescription, context) {
    const { jobTitle, companyName } = context;
    
    const prompt = `Analyze this job description and extract ALL insights in a single response. Return a JSON object with the following structure:

{
  "requirements": ["requirement1", "requirement2", ...], // 5-7 key requirements (years of experience, education, certifications, soft skills, work authorization)
  "skills": ["skill1", "skill2", ...], // 8-12 technical skills/tools/technologies
  "companyDetails": {
    "size": "company size",
    "industry": "industry sector",
    "culture": "company culture in 3-5 words",
    "growthStage": "growth stage in 2-4 words"
  },
  "interviewQuestions": [
    {"type": "technical", "question": "question text"},
    {"type": "behavioral", "question": "question text"}
  ],
  "resources": [
    {"name": "Resource Name", "url": "https://..."}
  ]
}

IMPORTANT RULES:
- Requirements: Extract exact years mentioned (e.g., "4+ years"), exclude technical skills
- Skills: Only technical skills/tools, exclude experience/education
- Company: Keep each field concise (max 10 words)
- Questions: 5-6 total, max 15 words each
- Resources: 4-5 specific resources, max 3-4 words per name

Job Title: ${jobTitle}
Company: ${companyName}
Job Description:
${jobDescription.substring(0, 3000)}`;

    try {
      const response = await this.sidebar._callAI(prompt, true);
      return response;
    } catch (e) {
      console.warn('[JobInsightsManager] Batch fetch failed:', e);
      return null;
    }
  }

  /**
   * Display requirements
   */
  _displayRequirements(requirements) {
    const requirementsEl = this.sidebar.root.getElementById('rh-key-requirements');
    if (!requirementsEl || !requirements || !Array.isArray(requirements)) return;

    // Filter out technical skills
    const filtered = requirements.filter(req => {
      const lower = req.toLowerCase();
      return !lower.includes('javascript') && !lower.includes('python') && 
             !lower.includes('react') && !lower.includes('aws') && 
             !lower.includes('sql') && !lower.includes('api') &&
             !lower.includes('framework') && !lower.includes('database');
    });

    requirementsEl.innerHTML = (filtered.length > 0 ? filtered : requirements.slice(0, 7))
      .map(req => `<div class="rh-requirement-item">• ${req.trim()}</div>`)
      .join('');
  }

  /**
   * Display company details
   */
  _displayCompanyDetails(companyDetails, fallbackDetails) {
    const companyDetailsEl = this.sidebar.root.getElementById('rh-company-details');
    if (!companyDetailsEl) return;

    const companyStatsEl = companyDetailsEl.querySelector('.rh-company-stats');
    if (!companyStatsEl) return;

    const details = [];
    
    if (companyDetails) {
      if (companyDetails.size || fallbackDetails?.companySize) {
        const size = (companyDetails.size || fallbackDetails.companySize).split(' ').slice(0, 3).join(' ');
        details.push(`👥 ${size}`);
      }
      if (companyDetails.industry || fallbackDetails?.industry) {
        const industry = (companyDetails.industry || fallbackDetails.industry).split(' ').slice(0, 2).join(' ');
        details.push(`🏭 ${industry}`);
      }
      if (fallbackDetails?.linkedinEmployees) {
        details.push(`🔗 ${fallbackDetails.linkedinEmployees}`);
      }
      if (companyDetails.culture) {
        const cultureShort = companyDetails.culture.split(',').slice(0, 2).join(',').trim();
        details.push(`💼 ${cultureShort}`);
      }
      if (companyDetails.growthStage) {
        const growthShort = companyDetails.growthStage.split(' ').slice(0, 4).join(' ').trim();
        details.push(`📈 ${growthShort}`);
      }
    } else if (fallbackDetails) {
      if (fallbackDetails.companySize) details.push(`👥 ${fallbackDetails.companySize}`);
      if (fallbackDetails.industry) details.push(`🏭 ${fallbackDetails.industry}`);
      if (fallbackDetails.linkedinEmployees) details.push(`🔗 ${fallbackDetails.linkedinEmployees}`);
    }

    if (details.length > 0) {
      companyStatsEl.innerHTML = details.map(d => `<div style="margin: 4px 0;">${d}</div>`).join('');
    } else {
      companyStatsEl.textContent = 'No company details available';
    }
  }

  /**
   * Display required skills
   */
  _displaySkills(skills) {
    const skillsEl = this.sidebar.root.getElementById('rh-required-skills');
    if (!skillsEl || !skills || !Array.isArray(skills)) return;

    const uniqueSkills = [...new Set(skills.map(s => s.trim()))]
      .filter(s => s.length > 0 && s.length < 30)
      .slice(0, 12);
    
    skillsEl.innerHTML = uniqueSkills.map(skill => 
      `<span class="rh-skill-tag">${skill}</span>`
    ).join('');
  }

  /**
   * Display interview questions
   */
  _displayInterviewQuestions(questions) {
    const questionsEl = this.sidebar.root.getElementById('rh-interview-questions');
    if (!questionsEl || !questions || !Array.isArray(questions)) return;

    const formattedQuestions = questions.slice(0, 6).map(q => {
      const icon = q.type === 'technical' ? '⚡' : '💭';
      const question = q.question.length > 80 ? q.question.substring(0, 77) + '...' : q.question;
      const starNote = q.type === 'behavioral' ? ' <em>(STAR)</em>' : '';
      return `${icon} ${question}${starNote}`;
    });

    questionsEl.innerHTML = formattedQuestions.map(q => 
      `<div class="rh-question-item">${q}</div>`
    ).join('');
  }

  /**
   * Display helpful resources
   */
  _displayResources(resources) {
    const resourcesEl = this.sidebar.root.getElementById('rh-helpful-resources');
    if (!resourcesEl || !resources || !Array.isArray(resources)) return;

    const validResources = resources
      .filter(r => r && r.name && r.url)
      .slice(0, 5)
      .map(r => ({
        name: r.name.length > 30 ? r.name.substring(0, 27) + '...' : r.name,
        url: r.url.startsWith('http') ? r.url : '#'
      }));

    if (validResources.length > 0) {
      resourcesEl.innerHTML = validResources.map(res => 
        `<div class="rh-resource-item">
          <span>🔗</span>
          <a href="${res.url}" target="_blank" class="rh-resource-link">${res.name}</a>
        </div>`
      ).join('');
    } else {
      this._setFallbackResources(resourcesEl);
    }
  }

  /**
   * Set fallback resources
   */
  _setFallbackResources(resourcesEl) {
    if (!resourcesEl) return;
    const resources = [
      { name: 'LeetCode Practice', url: 'https://leetcode.com' },
      { name: 'System Design Primer', url: 'https://github.com/donnemartin/system-design-primer' },
      { name: 'Glassdoor Reviews', url: 'https://glassdoor.com' }
    ];
    
    resourcesEl.innerHTML = resources.map(res => 
      `<div class="rh-resource-item">
        <span>🔗</span>
        <a href="${res.url}" target="_blank" class="rh-resource-link">${res.name}</a>
      </div>`
    ).join('');
  }

  /**
   * Main method to load all insights (with caching and optimization)
   */
  async loadInsights(forceRefresh = false) {
    const jobDescription = await this._getJobDescription();
    if (!jobDescription) {
      console.warn('[JobInsightsManager] No job description available');
      return;
    }

    const context = this._getJobContext();
    if (!context.jobTitle || !context.companyName) {
      console.warn('[JobInsightsManager] Missing job context');
      return;
    }

    const signature = this._getJobSignature(context.jobTitle, context.companyName, context.jobUrl);
    
    // Check cache first
    if (!forceRefresh && this._isInsightsLoaded(signature)) {
      const cached = this._getCachedInsights(signature);
      this._displayAllInsights(cached, context);
      return;
    }

    // Check if already loading
    if (this._isLoading('all') && !forceRefresh) {
      console.log('[JobInsightsManager] Already loading insights');
      return;
    }

    this._setLoading('all', true);
    this.jobSignature = signature;

    // Show loading states
    this._showLoadingStates();

    try {
      // Try batch fetch first (single AI call - optimized)
      const batchResults = await this._fetchAllInsightsBatch(jobDescription, context);
      
      if (batchResults && typeof batchResults === 'object' && 
          (batchResults.requirements || batchResults.skills || batchResults.companyDetails)) {
        // Successfully got batch results
        const insights = {
          requirements: batchResults.requirements || [],
          skills: batchResults.skills || [],
          companyDetails: batchResults.companyDetails || null,
          interviewQuestions: batchResults.interviewQuestions || [],
          resources: batchResults.resources || []
        };

        // Get fallback company details from page
        const fallbackDetails = this.sidebar._extractJobDetails();
        
        // Cache and display
        this._setCachedInsights(signature, insights);
        this._displayAllInsights(insights, context, fallbackDetails);
        
        // Fetch salary separately (uses different API, not cached in batch)
        await this._fetchSalary(jobDescription, context);
      } else {
        // Fallback to individual fetches if batch fails (only fetch what's missing)
        console.warn('[JobInsightsManager] Batch fetch failed or incomplete, falling back to individual calls');
        await this._fetchInsightsIndividually(jobDescription, context, signature);
      }
    } catch (error) {
      console.error('[JobInsightsManager] Error loading insights:', error);
      this._showErrorStates();
    } finally {
      this._setLoading('all', false);
    }
  }

  /**
   * Fallback: Fetch insights individually
   */
  async _fetchInsightsIndividually(jobDescription, context, signature) {
    const fallbackDetails = this.sidebar._extractJobDetails();
    
    // Fetch in parallel but only if not already loaded
    const fetchPromises = [];
    
    if (!this._isInsightTypeLoaded(signature, 'requirements')) {
      fetchPromises.push(this._fetchRequirements(jobDescription, context.jobTitle));
    }
    
    if (!this._isInsightTypeLoaded(signature, 'skills')) {
      fetchPromises.push(this._fetchSkills(jobDescription));
    }
    
    if (!this._isInsightTypeLoaded(signature, 'companyDetails')) {
      fetchPromises.push(this._fetchCompanyDetails(jobDescription, context.companyName, context.jobTitle, fallbackDetails));
    }
    
    if (!this._isInsightTypeLoaded(signature, 'interviewQuestions')) {
      fetchPromises.push(this._fetchInterviewQuestions(jobDescription, context.jobTitle));
    }
    
    if (!this._isInsightTypeLoaded(signature, 'resources')) {
      fetchPromises.push(this._fetchResources(jobDescription, context.jobTitle, context.companyName));
    }

    await Promise.all(fetchPromises);
    await this._fetchSalary(jobDescription, context);
  }

  /**
   * Display all insights
   */
  _displayAllInsights(insights, context, fallbackDetails = null) {
    if (insights.requirements) this._displayRequirements(insights.requirements);
    if (insights.skills) this._displaySkills(insights.skills);
    if (insights.companyDetails || fallbackDetails) {
      this._displayCompanyDetails(insights.companyDetails, fallbackDetails);
    }
    if (insights.interviewQuestions) this._displayInterviewQuestions(insights.interviewQuestions);
    if (insights.resources) this._displayResources(insights.resources);
  }

  /**
   * Show loading states
   */
  _showLoadingStates() {
    const requirementsEl = this.sidebar.root.getElementById('rh-key-requirements');
    const skillsEl = this.sidebar.root.getElementById('rh-required-skills');
    const companyStatsEl = this.sidebar.root.getElementById('rh-company-details')?.querySelector('.rh-company-stats');
    const questionsEl = this.sidebar.root.getElementById('rh-interview-questions');
    const resourcesEl = this.sidebar.root.getElementById('rh-helpful-resources');

    if (requirementsEl && !requirementsEl.innerHTML.includes('•')) {
      requirementsEl.innerHTML = 'Analyzing requirements...';
    }
    if (skillsEl && !skillsEl.innerHTML.includes('rh-skill-tag')) {
      skillsEl.innerHTML = 'Analyzing skills...';
    }
    if (companyStatsEl && companyStatsEl.textContent === 'No company details available') {
      companyStatsEl.textContent = 'Analyzing company details...';
    }
    if (questionsEl && !questionsEl.innerHTML.includes('rh-question-item')) {
      questionsEl.innerHTML = 'Generating personalized questions...';
    }
    if (resourcesEl && resourcesEl.textContent === 'Loading...') {
      resourcesEl.innerHTML = 'Loading resources...';
    }
  }

  /**
   * Show error states
   */
  _showErrorStates() {
    // Error states are handled individually by each fetch method
  }

  /**
   * Individual fetch methods (fallback)
   */
  async _fetchRequirements(jobDescription, jobTitle) {
    // Use existing sidebar method but with caching check
    return this.sidebar._fetchKeyRequirements(jobDescription, jobTitle);
  }

  async _fetchSkills(jobDescription) {
    return this.sidebar._fetchRequiredSkills(jobDescription);
  }

  async _fetchCompanyDetails(jobDescription, companyName, jobTitle, fallbackDetails) {
    return this.sidebar._fetchCompanyDetails(jobDescription, companyName, jobTitle);
  }

  async _fetchInterviewQuestions(jobDescription, jobTitle) {
    return this.sidebar._fetchInterviewQuestions(jobDescription, jobTitle);
  }

  async _fetchResources(jobDescription, jobTitle, companyName) {
    return this.sidebar._fetchHelpfulResources(jobDescription, jobTitle, companyName);
  }

  async _fetchSalary(jobDescription, context) {
    return this.sidebar._fetchAndDisplaySalary(jobDescription, context.jobTitle, context.companyName);
  }

  /**
   * Clear cache for a specific job
   */
  clearCache(signature = null) {
    if (signature) {
      this.cache.delete(signature);
    } else {
      this.cache.clear();
    }
    this.loadingState.clear();
  }

  /**
   * Get cache stats (for debugging)
   */
  getCacheStats() {
    return {
      cacheSize: this.cache.size,
      loadingCount: this.loadingState.size,
      currentJob: this.jobSignature
    };
  }
}

