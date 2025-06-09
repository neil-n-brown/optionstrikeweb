/**
 * Enhanced rate limiting utility for API calls with exponential backoff
 */

export class RateLimiter {
  constructor(maxRequests = 10, windowMs = 60000, name = 'API') {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
    this.name = name
    this.requests = []
    this.lastReset = Date.now()
    this.retryCount = 0
    this.maxRetries = 3
    this.baseRetryDelay = 2000 // 2 seconds
  }

  /**
   * Check if request is within rate limit with exponential backoff
   * @returns {Promise<boolean>} True if request is allowed
   */
  async checkLimit() {
    const now = Date.now()
    const windowStart = now - this.windowMs
    
    // Remove old requests outside the window
    this.requests = this.requests.filter(time => time > windowStart)
    
    if (this.requests.length >= this.maxRequests) {
      // Calculate wait time until next available slot
      const oldestRequest = Math.min(...this.requests)
      const waitTime = this.windowMs - (now - oldestRequest)
      
      // Implement exponential backoff with jitter
      const backoffDelay = this.baseRetryDelay * Math.pow(2, this.retryCount) * (0.5 + Math.random() * 0.5)
      const totalDelay = Math.max(waitTime, backoffDelay)
      
      if (this.retryCount >= this.maxRetries) {
        this.retryCount = 0 // Reset for next time
        throw new Error(`${this.name} rate limit exceeded after ${this.maxRetries} retries. Please wait ${Math.ceil(totalDelay / 1000)} seconds.`)
      }
      
      console.warn(`${this.name} rate limit hit. Retry ${this.retryCount + 1}/${this.maxRetries} after ${Math.ceil(totalDelay / 1000)} seconds`)
      
      this.retryCount++
      await new Promise(resolve => setTimeout(resolve, totalDelay))
      
      // Recursive retry
      return this.checkLimit()
    }
    
    // Reset retry count on successful request
    this.retryCount = 0
    this.requests.push(now)
    
    console.log(`${this.name} rate limit: ${this.requests.length}/${this.maxRequests} requests in current window`)
    
    return true
  }

  /**
   * Get current usage statistics
   * @returns {Object} Usage stats
   */
  getUsage() {
    const now = Date.now()
    const windowStart = now - this.windowMs
    const currentRequests = this.requests.filter(time => time > windowStart)
    
    return {
      current: currentRequests.length,
      max: this.maxRequests,
      remaining: this.maxRequests - currentRequests.length,
      resetTime: new Date(Math.max(...this.requests, now) + this.windowMs),
      retryCount: this.retryCount
    }
  }

  /**
   * Reset the rate limiter
   */
  reset() {
    this.requests = []
    this.retryCount = 0
    this.lastReset = Date.now()
    console.log(`${this.name} rate limiter reset`)
  }

  /**
   * Check if we're currently in a backoff period
   */
  isInBackoff() {
    return this.retryCount > 0
  }
}

// Create rate limiters for different APIs with conservative limits
export const polygonLimiter = new RateLimiter(5, 60000, 'Polygon.io') // 5 requests per minute for free tier
export const fmpLimiter = new RateLimiter(8, 60000, 'FMP') // 8 requests per minute (conservative for FMP free tier)