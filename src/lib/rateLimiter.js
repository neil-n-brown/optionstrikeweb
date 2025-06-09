/**
 * Rate limiting utility for API calls
 */

export class RateLimiter {
  constructor(maxRequests = 100, windowMs = 60000, name = 'API') {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
    this.name = name
    this.requests = []
    this.lastReset = Date.now()
  }

  /**
   * Check if request is within rate limit
   * @returns {Promise<boolean>} True if request is allowed
   */
  async checkLimit() {
    const now = Date.now()
    const windowStart = now - this.windowMs
    
    // Remove old requests outside the window
    this.requests = this.requests.filter(time => time > windowStart)
    
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...this.requests)
      const waitTime = this.windowMs - (now - oldestRequest)
      
      console.warn(`${this.name} rate limit exceeded. Need to wait ${Math.ceil(waitTime / 1000)} seconds.`)
      
      throw new Error(`Rate limit exceeded for ${this.name}. Please wait ${Math.ceil(waitTime / 1000)} seconds.`)
    }
    
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
      resetTime: new Date(Math.max(...this.requests) + this.windowMs)
    }
  }

  /**
   * Reset the rate limiter
   */
  reset() {
    this.requests = []
    this.lastReset = Date.now()
    console.log(`${this.name} rate limiter reset`)
  }
}

// Create rate limiters for different APIs
export const polygonLimiter = new RateLimiter(5, 60000, 'Polygon.io') // 5 requests per minute for free tier
export const fmpLimiter = new RateLimiter(250, 60000, 'FMP') // 250 requests per minute for free tier