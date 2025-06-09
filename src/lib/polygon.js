import { getCachedData, setCachedData } from './cache'
import { mockOptionsData, simulateDelay } from './mockData'
import { APIClient, APIError } from './apiClient'
import { polygonLimiter } from './rateLimiter'

const POLYGON_BASE_URL = 'https://api.polygon.io'
const API_KEY = import.meta.env.VITE_POLYGON_API_KEY
const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true'
const CACHE_STOCK_MINUTES = parseInt(import.meta.env.VITE_CACHE_STOCK_MINUTES) || 5
const CACHE_OPTIONS_MINUTES = parseInt(import.meta.env.VITE_CACHE_OPTIONS_MINUTES) || 15

// Create Polygon API client
const polygonClient = new APIClient(
  POLYGON_BASE_URL,
  {},
  polygonLimiter
)

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
      }],
      status: 'OK'
    }
    
    await setCachedData(cacheKey, mockData, CACHE_STOCK_MINUTES)
    return mockData
  }
  
  try {
    const data = await polygonClient.get(`/v2/aggs/ticker/${symbol}/prev`, {
      adjusted: 'true',
      apikey: API_KEY
    })
    
    if (data.status !== 'OK') {
      throw new APIError(`API error: ${data.error || 'Unknown error'}`, 500, 'Polygon')
    }
    
    // Cache for specified minutes
    await setCachedData(cacheKey, data, CACHE_STOCK_MINUTES)
    
    console.log(`Fetched fresh stock price for ${symbol}`)
    return data
    
  } catch (error) {
    console.error(`Error fetching stock price for ${symbol}:`, error)
    
    // Try to return stale cached data as fallback
    const staleData = await getCachedData(`${cacheKey}_stale`)
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
 * @param {string} expirationDate - Optional expiration date filter (YYYY-MM-DD)
 * @returns {Promise<Object>} Options chain data
 */
export async function getOptionsChain(symbol, expirationDate = null) {
  const cacheKey = `options_chain_${symbol}${expirationDate ? `_${expirationDate}` : ''}`
  
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
    
    await setCachedData(cacheKey, mockData, CACHE_OPTIONS_MINUTES)
    return mockData
  }
  
  try {
    // Get options snapshot
    const data = await polygonClient.get(`/v3/snapshot/options/${symbol}`, {
      apikey: API_KEY
    })
    
    if (data.status !== 'OK') {
      throw new APIError(`API error: ${data.error || 'Unknown error'}`, 500, 'Polygon')
    }
    
    // Process and filter options data
    const processedData = await processOptionsData(data, symbol, expirationDate)
    
    // Cache for specified minutes
    await setCachedData(cacheKey, processedData, CACHE_OPTIONS_MINUTES)
    
    console.log(`Fetched fresh options chain for ${symbol}`)
    return processedData
    
  } catch (error) {
    console.error(`Error fetching options chain for ${symbol}:`, error)
    
    // Try to return stale cached data as fallback
    const staleData = await getCachedData(`${cacheKey}_stale`)
    if (staleData) {
      console.log(`Using stale cached data for ${symbol}`)
      return staleData
    }
    
    throw error
  }
}

/**
 * Process raw options data from Polygon API
 * @param {Object} rawData - Raw API response
 * @param {string} symbol - Stock symbol
 * @param {string} expirationDate - Optional expiration filter
 * @returns {Object} Processed options data
 */
async function processOptionsData(rawData, symbol, expirationDate = null) {
  try {
    // Get current stock price for calculations
    const stockData = await getStockPrice(symbol)
    const currentPrice = stockData.results?.[0]?.c || 0
    
    const processedOptions = []
    
    if (rawData.results && Array.isArray(rawData.results)) {
      for (const option of rawData.results) {
        // Filter by expiration date if specified
        if (expirationDate && option.details?.expiration_date !== expirationDate) {
          continue
        }
        
        // Only process put options
        if (option.details?.contract_type !== 'put') {
          continue
        }
        
        // Calculate additional metrics
        const strike = option.details?.strike_price || 0
        const premium = option.market_status === 'open' ? 
          ((option.bid || 0) + (option.ask || 0)) / 2 : 
          option.last_quote?.price || 0
        
        const processedOption = {
          symbol: symbol,
          strike: strike,
          expiration: option.details?.expiration_date,
          type: 'put',
          bid: option.bid || 0,
          ask: option.ask || 0,
          premium: premium,
          delta: option.greeks?.delta || 0,
          impliedVolatility: option.implied_volatility || 0,
          volume: option.session?.volume || 0,
          openInterest: option.open_interest || 0,
          stockPrice: currentPrice
        }
        
        processedOptions.push(processedOption)
      }
    }
    
    return {
      symbol: symbol,
      underlyingPrice: currentPrice,
      options: processedOptions,
      timestamp: new Date().toISOString(),
      status: 'OK'
    }
    
  } catch (error) {
    console.error('Error processing options data:', error)
    throw error
  }
}

/**
 * Get options for multiple symbols with earnings
 * @param {Array} symbols - Array of stock symbols
 * @returns {Promise<Object>} Combined options data
 */
export async function getMultipleOptionsChains(symbols) {
  const results = {}
  const errors = []
  
  for (const symbol of symbols) {
    try {
      console.log(`Fetching options for ${symbol}...`)
      results[symbol] = await getOptionsChain(symbol)
      
      // Add small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 200))
      
    } catch (error) {
      console.error(`Failed to fetch options for ${symbol}:`, error)
      errors.push({ symbol, error: error.message })
    }
  }
  
  return {
    results,
    errors,
    timestamp: new Date().toISOString()
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
        timestamp: new Date().toISOString(),
        usage: { current: 0, max: 5, remaining: 5 }
      }
    }
    
    // Test with a simple market status call
    const data = await polygonClient.get('/v1/marketstatus/now', {
      apikey: API_KEY
    })
    
    const usage = polygonLimiter.getUsage()
    
    return {
      status: data.status || 'OK',
      message: `Polygon API is accessible. Market: ${data.market || 'unknown'}`,
      timestamp: new Date().toISOString(),
      usage: usage
    }
    
  } catch (error) {
    const usage = polygonLimiter.getUsage()
    
    return {
      status: 'ERROR',
      message: error.message,
      timestamp: new Date().toISOString(),
      usage: usage
    }
  }
}

/**
 * Get rate limiter usage statistics
 * @returns {Object} Usage statistics
 */
export function getPolygonUsage() {
  return polygonLimiter.getUsage()
}