/**
 * Parallel Processor for AI API calls
 * Handles concurrent section processing with rate limiting and intelligent batching
 */

class ParallelProcessor {
  constructor(apiClient, options = {}) {
    this.apiClient = apiClient;
    this.maxConcurrency = options.maxConcurrency || 3;
    this.batchDelay = options.batchDelay || 500; // ms between batches
    this.retryAttempts = options.retryAttempts || 2;
    this.activeRequests = new Set();
    this.requestQueue = [];
    this.results = new Map();
  }

  /**
   * Process multiple resume sections in parallel
   */
  async processSectionsInParallel(jobDescription, resumeSections, progressCallback) {
    console.log('🔄 Starting parallel section processing...');
    
    const sectionTasks = this.prepareSectionTasks(jobDescription, resumeSections);
    const batches = this.createBatches(sectionTasks, this.maxConcurrency);
    
    console.log(`📊 Processing ${sectionTasks.length} sections in ${batches.length} batches`);
    
    const results = new Map();
    let processedSections = 0;
    const totalSections = sectionTasks.length;

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`🚀 Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} sections`);
      
      // Update progress
      if (progressCallback) {
        progressCallback({
          phase: 'processing',
          batchIndex: batchIndex + 1,
          totalBatches: batches.length,
          sectionsInBatch: batch.length,
          completedSections: processedSections,
          totalSections: totalSections
        });
      }

      // Process batch in parallel
      const batchPromises = batch.map(task => 
        this.processTaskWithRetry(task)
          .then(result => ({
            sectionType: task.sectionType,
            result: result,
            success: true,
            processingTime: Date.now() - task.startTime
          }))
          .catch(error => ({
            sectionType: task.sectionType,
            error: error.message,
            success: false,
            processingTime: Date.now() - task.startTime
          }))
      );

      try {
        const batchResults = await Promise.allSettled(batchPromises);
        
        // Process results
        batchResults.forEach(({ value }) => {
          results.set(value.sectionType, value);
          processedSections++;
          
          // Only log failures, successes are logged in batch summary
          if (!value.success) {
            console.error(`❌ ${value.sectionType} failed: ${value.error}`);
          }
        });

        // Add delay between batches to respect rate limits
        if (batchIndex < batches.length - 1) {
          await this.delay(this.batchDelay);
        }

      } catch (error) {
        console.error(`❌ Batch ${batchIndex + 1} processing error:`, error);
      }
    }

    // Final progress update
    if (progressCallback) {
      progressCallback({
        phase: 'complete',
        completedSections: processedSections,
        totalSections: totalSections,
        successfulSections: Array.from(results.values()).filter(r => r.success).length
      });
    }

    console.log(`🎉 Parallel processing complete: ${processedSections}/${totalSections} sections processed`);
    return results;
  }

  /**
   * Prepare section tasks with priority ordering
   */
  prepareSectionTasks(jobDescription, resumeSections) {
    const tasks = [];
    
    // Priority order: Most important sections first for better user experience
    const sectionPriority = ['experience', 'skills', 'summary', 'projects', 'achievements'];
    
    sectionPriority.forEach((sectionType, index) => {
      if (resumeSections[sectionType] && resumeSections[sectionType] !== null) {
        tasks.push({
          sectionType,
          data: resumeSections[sectionType],
          jobDescription,
          priority: index,
          startTime: Date.now(),
          id: `${sectionType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        });
      }
    });
    
    console.log(`📋 Prepared ${tasks.length} section tasks:`, tasks.map(t => t.sectionType));
    return tasks;
  }

  /**
   * Process individual task with retry logic
   */
  async processTaskWithRetry(task) {
    const requestId = task.id;
    this.activeRequests.add(requestId);

    try {
      for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
                 try {
           const result = await this.apiClient.tailorSection(
             task.jobDescription,
             task.data,
             task.sectionType
           );
          
          this.activeRequests.delete(requestId);
          return result;
          
        } catch (error) {
          console.warn(`⚠️ ${task.sectionType} attempt ${attempt + 1} failed:`, error.message);
          
          if (attempt === this.retryAttempts) {
            throw error;
          }
          
                     // Exponential backoff
           const backoffDelay = Math.pow(2, attempt) * 1000;
           await this.delay(backoffDelay);
        }
      }
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * Create batches respecting concurrency limits
   */
  createBatches(tasks, batchSize) {
    const batches = [];
    for (let i = 0; i < tasks.length; i += batchSize) {
      batches.push(tasks.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cancel all active requests
   */
  cancelAllRequests() {
    console.log(`🛑 Cancelling ${this.activeRequests.size} active requests`);
    this.activeRequests.clear();
    this.requestQueue = [];
  }

  /**
   * Get processing statistics
   */
  getStats() {
    return {
      activeRequests: this.activeRequests.size,
      queuedRequests: this.requestQueue.length,
      maxConcurrency: this.maxConcurrency,
      retryAttempts: this.retryAttempts
    };
  }

  /**
   * Combine parallel processing results with original resume
   */
  combineResults(originalResumeJSON, sectionResults) {
    console.log('🔧 Combining parallel processing results...');
    
    const tailoredResumeJSON = {
      // Always preserve contact info
      contact: originalResumeJSON.contact || null
    };

    let successCount = 0;
    let failureCount = 0;

    // Process each section result
    sectionResults.forEach((resultData, sectionType) => {
      if (resultData.success && resultData.result) {
        tailoredResumeJSON[sectionType] = resultData.result;
        successCount++;
      } else {
        // Fallback to original data if tailoring failed
        tailoredResumeJSON[sectionType] = originalResumeJSON[sectionType];
        console.warn(`⚠️ Using original ${sectionType} due to processing failure`);
        failureCount++;
      }
    });

    // Ensure all original sections are included (even if not processed)
    Object.keys(originalResumeJSON).forEach(key => {
      if (!tailoredResumeJSON.hasOwnProperty(key)) {
        tailoredResumeJSON[key] = originalResumeJSON[key];
      }
    });

    console.log(`🎯 Result combination complete: ${successCount} tailored, ${failureCount} original`);
    return tailoredResumeJSON;
  }
}

// Make ParallelProcessor available globally
if (typeof window !== 'undefined') {
  window.ParallelProcessor = ParallelProcessor;
} 