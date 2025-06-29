/**
 * Simple Rate Limiter for Gemini API
 * - Process max 3 concurrent requests
 * - Max 10 requests per minute
 * - Let API handle daily quota and other errors
 */

class SimpleRateLimiter {
  constructor() {
    this.requestQueue = [];
    this.requestsThisMinute = 0;
    this.minuteStartTime = Date.now();
    this.concurrentRequests = 0;
    this.maxConcurrent = 3;
    this.maxPerMinute = 10;
    this.isProcessing = false;
    
    console.log('🚦 Simple Rate Limiter initialized: 3 concurrent, 10/minute');
  }

  /**
   * Add request to queue and start processing
   */
  async queueRequest(requestFn, operation = 'unknown') {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        requestFn,
        resolve,
        reject,
        id: Math.random().toString(36).substr(2, 9),
        operation,
        retryCount: 0,
        maxRetries: 3
      });
      

      this.processQueue();
    });
  }

  /**
   * Process the request queue
   */
  async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.requestQueue.length > 0) {
      // Check if we can process more requests
      if (this.concurrentRequests >= this.maxConcurrent) {
        break;
      }

      // Check minute limit
      this.resetMinuteCounterIfNeeded();
      if (this.requestsThisMinute >= this.maxPerMinute) {
        await this.waitForNextMinute();
        continue;
      }

      // Process next request
      const queueItem = this.requestQueue.shift();
      this.processRequestConcurrently(queueItem);
    }

    this.isProcessing = false;
  }

  /**
   * Process individual request concurrently
   */
  async processRequestConcurrently(queueItem) {
    this.concurrentRequests++;
    this.requestsThisMinute++;

    try {
      const result = await queueItem.requestFn();
      queueItem.resolve(result);
      
    } catch (error) {
      // Check if it's a rate limit error
      if (this.isRateLimitError(error)) {
        queueItem.retryCount++;
        
        // Check if we've exceeded max retries
        if (queueItem.retryCount >= queueItem.maxRetries) {
          console.error(`❌ API rate limit exceeded - max retries reached (${queueItem.retryCount}/${queueItem.maxRetries}) for: ${queueItem.operation}`);
          queueItem.reject(error);
        } else {
          // Log retry attempt
          console.error(`❌ API rate limit exceeded - request queued for retry (attempt ${queueItem.retryCount}/${queueItem.maxRetries}) for: ${queueItem.operation}`);
          
          // Put request back at front of queue
          this.requestQueue.unshift(queueItem);
          this.requestsThisMinute--; // Don't count this attempt
          
          // Wait for next minute
          await this.waitForNextMinute();
        }
        
      } else {
        // Other errors (daily quota, invalid key, etc.) - let them bubble up
        queueItem.reject(error);
      }
      
    } finally {
      this.concurrentRequests--;
      
      // Continue processing queue
      setTimeout(() => this.processQueue(), 100);
    }
  }

  /**
   * Check if error is a rate limit error (not daily quota)
   */
  isRateLimitError(error) {
    const errorMessage = error.message?.toLowerCase() || '';
    return errorMessage.includes('rate limit') || 
           errorMessage.includes('too many requests') ||
           errorMessage.includes('quota exceeded per minute');
  }

  /**
   * Wait until next minute starts
   */
  async waitForNextMinute() {
    const now = Date.now();
    const timeInCurrentMinute = (now - this.minuteStartTime) % 60000;
    const waitTime = 60000 - timeInCurrentMinute;
    
    await this.delay(waitTime);
    this.resetMinuteCounter();
  }

  /**
   * Reset minute counter if needed
   */
  resetMinuteCounterIfNeeded() {
    const now = Date.now();
    const minutesSinceStart = Math.floor((now - this.minuteStartTime) / 60000);
    
    if (minutesSinceStart > 0) {
      this.resetMinuteCounter();
    }
  }

  /**
   * Reset minute counter
   */
  resetMinuteCounter() {
    this.requestsThisMinute = 0;
    this.minuteStartTime = Date.now();
  }

  /**
   * Get current status
   */
  getStatus() {
    this.resetMinuteCounterIfNeeded();
    
    return {
      queueLength: this.requestQueue.length,
      concurrentRequests: this.concurrentRequests,
      requestsThisMinute: this.requestsThisMinute,
      maxPerMinute: this.maxPerMinute,
      maxConcurrent: this.maxConcurrent
    };
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return SharedUtilities.delay(ms);
  }

  /**
   * Clear all queued requests
   */
  clearQueue() {
    // Reject all queued requests
    this.requestQueue.forEach(item => {
      item.reject(new Error('Request cancelled'));
    });
    
    this.requestQueue = [];
  }
}

// Create global instance
if (typeof window !== 'undefined') {
  window.simpleRateLimiter = new SimpleRateLimiter();
  window.SimpleRateLimiter = SimpleRateLimiter;
} else if (typeof self !== 'undefined') {
  self.simpleRateLimiter = new SimpleRateLimiter();
  self.SimpleRateLimiter = SimpleRateLimiter;
} else if (typeof global !== 'undefined') {
  global.simpleRateLimiter = new SimpleRateLimiter();
  global.SimpleRateLimiter = SimpleRateLimiter;
} else {
  // For service workers and other environments
  this.simpleRateLimiter = new SimpleRateLimiter();
  this.SimpleRateLimiter = SimpleRateLimiter;
}