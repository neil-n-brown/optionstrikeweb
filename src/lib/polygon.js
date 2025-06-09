import { getCachedData, setCachedData } from './cache'
import { mockOptionsData, simulateDelay } from './mockData'

const POLYGON_BASE_URL = 'https://api.polygon.io'
const API_KEY = import.meta.env.VITE_POLYGON_API_KEY
const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true'

/**
 * Rate limiter for Polygon API (5 requests per minute for free tier)
 */
class RateLimiter {
  constructor(maxRequests = 5, windowMs = 60000) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
    this.requests = []
  }

  async checkLimit() {
    const now = Date.now()
    const windowStart = now - this.windowMs
    
    // Remove old requests outside the window
    this.requests = this.requests.filter(time => time > windowStart)
    
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...this.requests)
      const waitTime = this.windowMs - (now - oldestRequest)
      throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`)
    }
    
    this.requests.push(now)
    return true
  }
}

const polygonLimiter = new RateLimiter(5, 60000)

/**
 * Fetches current stock price from Polygon API
 * @param {string} symbol - Stock ticker symbol
 * @returns {Promise<Object>} Stock price data
 */
export async function getStockPrice(symbol) {
  const cacheKey = `stock_price_${symbol}`
  
  // Check cache first
  let cachedData = await getCachedData(cacheKey)
  if (cachedData) {
    console.log(`Using cached stock price for ${symbol}`)
    return cachedData
  }
  
  // Use mock data if enabled
  if (USE_MOCK_DATA) {
    console.log(`Using mock stock price for ${symbol}`)
    await simulateDelay(500)
    
    const mockPrice = mockOptionsData[symbol]?.underlyingPrice || 100.00
    const mockData = {
      ticker: symbol,
      queryCount: 1,
      resultsCount: 1,
      adjusted: true,
      results: [{
        c: mockPrice,
        h: mockPrice * 1.02,
        l: mockPrice * 0.98,
        o: mockPrice * 1.01,
        v: 1000000,
        t: Date.now()
      }]
    }
    
    await setCachedData(cacheKey, mockData, 5)
    return mockData
  }
  
  try {
    await polygonLimiter.checkLimit()
    
    const response = await fetch(
      `${POLYGON_BASE_URL}/v2/aggs/ticker/${symbol}/prev?adjusted=true&apikey=${API_KEY}`
    )
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (data.status !== 'OK') {
      throw new Error(`API error: ${data.error || 'Unknown error'}`)
    }
    
    // Cache for 5 minutes
    await setCachedData(cacheKey, data, 5)
    
    console.log(`Fetched fresh stock price for ${symbol}`)
    return data
    
  } catch (error) {
    console.error(`Error fetching stock price for ${symbol}:`, error)
    
    // Try to return stale cached data as fallback
    const staleData = await getCachedData(`stock_price_${symbol}_stale`)
    if (staleData) {
      console.log(`Using stale cached data for ${symbol}`)
      return staleData
    }
    
    throw error
  }
}

/**
 * Fetches options chain data from Polygon API
 * @param {string} symbol - Stock ticker symbol
 * @returns {Promise<Object>} Options chain data
 */
export async function getOptionsChain(symbol) {
  const cacheKey = `options_chain_${symbol}`
  
  // Check cache first
  let cachedData = await getCachedData(cacheKey)
  if (cachedData) {
    console.log(`Using cached options chain for ${symbol}`)
    return cachedData
  }
  
  // Use mock data if enabled
  if (USE_MOCK_DATA) {
    console.log(`Using mock options chain for ${symbol}`)
    await simulateDelay(800)
    
    const mockData = mockOptionsData[symbol] || {
      underlyingPrice: 100.00,
      options: []
    }
    
    await setCachedData(cacheKey, mockData, 15)
    return mockData
  }
  
  try {
    await polygonLimiter.checkLimit()
    
    const response = await fetch(
      `${POLYGON_BASE_URL}/v3/snapshot/options/${symbol}?apikey=${API_KEY}`
    )
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (data.status !== 'OK') {
      throw new Error(`API error: ${data.error || 'Unknown error'}`)
    }
    
    // Cache for 15 minutes during market hours
    await setCachedData(cacheKey, data, 15)
    
    console.log(`Fetched fresh options chain for ${symbol}`)
    return data
    
  } catch (error) {
    console.error(`Error fetching options chain for ${symbol}:`, error)
    
    // Try to return stale cached data as fallback
    const staleData = await getCachedData(`options_chain_${symbol}_stale`)
    if (staleData) {
      console.log(`Using stale cached data for ${symbol}`)
      return staleData
    }
    
    throw error
  }
}

/**
 * Health check for Polygon API
 * @returns {Promise<Object>} API status
 */
export async function checkPolygonAPIHealth() {
  try {
    if (USE_MOCK_DATA) {
      return { 
        status: 'OK', 
        message: 'Using mock data mode',
        timestamp: new Date().toISOString()
      }
    }
    
    const response = await fetch(`${POLYGON_BASE_URL}/v1/marketstatus/now?apikey=${API_KEY}`)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data = await response.json()
    return {
      status: data.status || 'OK',
      message: 'Polygon API is accessible',
      timestamp: new Date().toISOString()
    }
    
  } catch (error) {
    return {
      status: 'ERROR',
      message: error.message,
      timestamp: new Date().toISOString()
    }
  }
}