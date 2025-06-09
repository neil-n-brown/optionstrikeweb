/**
 * Generic API client with retry logic and error handling
 */

export class APIError extends Error {
  constructor(message, status, source, response = null) {
    super(message)
    this.name = 'APIError'
    this.status = status
    this.source = source
    this.response = response
  }
}

/**
 * Generic API client with exponential backoff retry
 */
export class APIClient {
  constructor(baseURL, defaultHeaders = {}, rateLimiter = null) {
    this.baseURL = baseURL
    this.defaultHeaders = defaultHeaders
    this.rateLimiter = rateLimiter
  }

  /**
   * Make HTTP request with retry logic
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Fetch options
   * @param {number} maxRetries - Maximum retry attempts
   * @returns {Promise<Object>} API response
   */
  async request(endpoint, options = {}, maxRetries = 3) {
    const url = `${this.baseURL}${endpoint}`
    
    // Check rate limit if limiter is provided
    if (this.rateLimiter) {
      await this.rateLimiter.checkLimit()
    }

    const requestOptions = {
      ...options,
      headers: {
        ...this.defaultHeaders,
        ...options.headers
      }
    }

    let lastError = null
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Making API request to ${url} (attempt ${attempt + 1}/${maxRetries + 1})`)
        
        const response = await fetch(url, requestOptions)
        
        if (!response.ok) {
          const errorText = await response.text()
          throw new APIError(
            `HTTP ${response.status}: ${errorText}`,
            response.status,
            this.baseURL,
            response
          )
        }
        
        const data = await response.json()
        
        // Check for API-specific error responses
        if (data.error) {
          throw new APIError(
            data.error,
            response.status,
            this.baseURL,
            response
          )
        }
        
        if (data.status === 'ERROR') {
          throw new APIError(
            data.message || 'API returned error status',
            response.status,
            this.baseURL,
            response
          )
        }
        
        console.log(`API request successful: ${url}`)
        return data
        
      } catch (error) {
        lastError = error
        
        // Don't retry on client errors (4xx) except rate limits
        if (error.status >= 400 && error.status < 500 && error.status !== 429) {
          console.error(`Client error, not retrying: ${error.message}`)
          throw error
        }
        
        // Don't retry on the last attempt
        if (attempt === maxRetries) {
          console.error(`Max retries reached for ${url}: ${error.message}`)
          throw error
        }
        
        // Calculate exponential backoff delay
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000) // Max 10 seconds
        console.warn(`Request failed, retrying in ${delay}ms: ${error.message}`)
        
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    throw lastError
  }

  /**
   * GET request
   * @param {string} endpoint - API endpoint
   * @param {Object} params - Query parameters
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} API response
   */
  async get(endpoint, params = {}, options = {}) {
    const queryString = new URLSearchParams(params).toString()
    const url = queryString ? `${endpoint}?${queryString}` : endpoint
    
    return this.request(url, {
      method: 'GET',
      ...options
    })
  }

  /**
   * POST request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} API response
   */
  async post(endpoint, data = {}, options = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    })
  }
}