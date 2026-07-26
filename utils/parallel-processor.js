import { delay } from './shared-utilities.js';

/**
 * Parallel Processor for AI API calls
 * Handles concurrent section processing with rate limiting and intelligent batching
 */

export class ParallelProcessor {
  constructor(apiClient, options = {}) {
    this.apiClient = apiClient;
    this.maxConcurrency = 3; // Fixed at 3, rate limiter handles the rest
    this.batchDelay = 500; // ms between batches
    this.activeRequests = new Set();
    this.results = new Map();
  }

  /**
   * Process multiple resume sections in parallel
   */
  async processSectionsInParallel(jobDescription, resumeSections, progressCallback) {
    const sectionTasks = this.prepareSectionTasks(jobDescription, resumeSections);
    const batches = this.createBatches(sectionTasks, this.maxConcurrency);
    
    const results = new Map();
    let processedSections = 0;
    const totalSections = sectionTasks.length;

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
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

      // Process batch in parallel (rate limiter handles the queuing)
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
          
          if (value.success) {
            console.log(`🔧 Optimizing section: ${value.sectionType}`);
            console.log(`✅ Optimized: ${value.sectionType}`);
          } else {
            console.error(`❌ ${value.sectionType} failed: ${value.error}`);
          }
        });

        // Add delay between batches
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
    
    return tasks;
  }

  /**
   * Process individual task (retry logic handled by rate limiter)
   */
  async processTaskWithRetry(task) {
    const requestId = task.id;
    this.activeRequests.add(requestId);

    try {
      const result = await this.apiClient.tailorSection(
        task.jobDescription,
        task.data,
        task.sectionType
      );
      
      this.activeRequests.delete(requestId);
      return result;
      
    } catch (error) {
      this.activeRequests.delete(requestId);
      throw error;
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
    return delay(ms);
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
