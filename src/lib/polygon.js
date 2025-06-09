import { getCachedData, setCachedData } from './cache'
import { mockOptionsData, simulateDelay } from './mockData'
import { APIClient, APIError } from './apiClient'
import { polygonLimiter } from './rateLimiter'

const POLYGON_BASE_URL = 'https://api.polygon.io'
const API_KEY = import.meta.env.VITE_POLYGON_API_KEY
const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true'
const CACHE_STOCK_MINUTES = parseInt(import.meta.env.VITE_CACHE_STOCK_MINUTES) || 5
const CACHE_OPTIONS_MINUTES = parseInt(import.meta.env.VITE_CACHE_OPTIONS_MINUTES) || 15

console.log('🔧 POLYGON: Configuration loaded:', {
  hasApiKey: !!API_KEY,
  useMockData: USE_MOCK_DATA,
  cacheStockMinutes: CACHE_STOCK_MINUTES,
  cacheOptionsMinutes: CACHE_OPTIONS_MINUTES,
  apiKeyPrefix: API_KEY ? `${API_KEY.substring(0, 8)}...` : 'NOT_SET'
})

// Create Polygon API client only if API key is available
let polygonClient = null

if (API_KEY) {
  polygonClient = new APIClient(
    POLYGON_BASE_URL,
    {},
    polygonLimiter
  )
  console.log('✅ POLYGON: Polygon API client initialized')
} else {
  console.log('⚠️ POLYGON: No Polygon API key - will use mock data')
}

/**
 * Fetches current stock price from Polygon API
 * @param {string} symbol - Stock ticker symbol
 * @returns {Promise<Object>} Stock price data
 */
export async function getStockPrice(symbol) {
  console.log(`📈 POLYGON: Getting stock price for ${symbol}`)
  
  const cacheKey = `stock_price_${symbol}`
  
  // Check cache first
  let cachedData = await getCachedData(cacheKey)
  if (cachedData) {
    console.log(`✅ POLYGON: Using cached stock price for ${symbol}: $${cachedData.results?.[0]?.c}`)
    return cachedData
  }
  
  // Determine if we should use mock data
  const shouldUseMockData = USE_MOCK_DATA || !API_KEY || !polygonClient
  console.log(`🎭 POLYGON: Should use mock data for ${symbol}: ${shouldUseMockData}`)
  
  // Use mock data if enabled or no API key
  if (shouldUseMockData) {
    console.log(`🎭 POLYGON: Using mock stock price for ${symbol}`)
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
    
    console.log(`🎭 POLYGON: Mock stock price for ${symbol}: $${mockPrice}`)
    
    await setCachedData(cacheKey, mockData, CACHE_STOCK_MINUTES)
    return mockData
  }
  
  try {
    console.log(`🌐 POLYGON: Fetching real stock price for ${symbol} from API`)
    
    const data = await polygonClient.get(`/v2/aggs/ticker/${symbol}/prev`, {
      adjusted: 'true',
      apikey: API_KEY
    })
    
    console.log(`🌐 POLYGON: Stock price API response for ${symbol}:`, {
      status: data.status,
      resultsCount: data.resultsCount,
      price: data.results?.[0]?.c
    })
    
    if (data.status !== 'OK') {
      throw new APIError(`API error: ${data.error || 'Unknown error'}`, 500, 'Polygon')
    }
    
    // Cache for specified minutes
    await setCachedData(cacheKey, data, CACHE_STOCK_MINUTES)
    
    console.log(`✅ POLYGON: Fetched fresh stock price for ${symbol}: $${data.results?.[0]?.c}`)
    return data
    
  } catch (error) {
    console.error(`💥 POLYGON: Error fetching stock price for ${symbol}:`, error)
    
    // Try to return stale cached data as fallback
    const staleData = await getCachedData(`${cacheKey}_stale`)
    if (staleData) {
      console.log(`🔄 POLYGON: Using stale cached data for ${symbol}`)
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
  console.log(`📊 POLYGON: Getting options chain for ${symbol}`, { expirationDate })
  
  const cacheKey = `options_chain_${symbol}${expirationDate ? `_${expirationDate}` : ''}`
  
  // Check cache first
  let cachedData = await getCachedData(cacheKey)
  if (cachedData) {
    console.log(`✅ POLYGON: Using cached options chain for ${symbol} (${cachedData.options?.length || 0} options)`)
    return cachedData
  }
  
  // Determine if we should use mock data
  const shouldUseMockData = USE_MOCK_DATA || !API_KEY || !polygonClient
  console.log(`🎭 POLYGON: Should use mock data for ${symbol} options: ${shouldUseMockData}`)
  
  // Use mock data if enabled or no API key
  if (shouldUseMockData) {
    console.log(`🎭 POLYGON: Using mock options chain for ${symbol}`)
    await simulateDelay(800)
    
    const mockData = mockOptionsData[symbol] || {
      underlyingPrice: 100.00,
      options: []
    }
    
    console.log(`🎭 POLYGON: Mock options for ${symbol}:`, {
      underlyingPrice: mockData.underlyingPrice,
      optionsCount: mockData.options.length,
      options: mockData.options.map(o => ({ strike: o.strike, expiration: o.expiration, premium: o.premium }))
    })
    
    await setCachedData(cacheKey, mockData, CACHE_OPTIONS_MINUTES)
    return mockData
  }
  
  try {
    console.log(`🌐 POLYGON: Fetching real options chain for ${symbol} from API`)
    
    // Get options snapshot
    const data = await polygonClient.get(`/v3/snapshot/options/${symbol}`, {
      apikey: API_KEY
    })
    
    console.log(`🌐 POLYGON: Options API response for ${symbol}:`, {
      status: data.status,
      resultsCount: data.results?.length || 0,
      firstThreeResults: data.results?.slice(0, 3)
    })
    
    if (data.status !== 'OK') {
      throw new APIError(`API error: ${data.error || 'Unknown error'}`, 500, 'Polygon')
    }
    
    // Process and filter options data
    const processedData = await processOptionsData(data, symbol, expirationDate)
    
    // Cache for specified minutes
    await setCachedData(cacheKey, processedData, CACHE_OPTIONS_MINUTES)
    
    console.log(`✅ POLYGON: Fetched fresh options chain for ${symbol} (${processedData.options?.length || 0} options)`)
    return processedData
    
  } catch (error) {
    console.error(`💥 POLYGON: Error fetching options chain for ${symbol}:`, error)
    
    // Try to return stale cached data as fallback
    const staleData = await getCachedData(`${cacheKey}_stale`)
    if (staleData) {
      console.log(`🔄 POLYGON: Using stale cached data for ${symbol}`)
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
  console.log(`🔧 POLYGON: Processing options data for ${symbol}`)
  
  try {
    // Get current stock price for calculations
    const stockData = await getStockPrice(symbol)
    const currentPrice = stockData.results?.[0]?.c || 0
    
    console.log(`📈 POLYGON: Current stock price for ${symbol}: $${currentPrice}`)
    
    const processedOptions = []
    
    if (rawData.results && Array.isArray(rawData.results)) {
      console.log(`🔧 POLYGON: Processing ${rawData.results.length} raw options for ${symbol}`)
      
      for (const option of rawData.results) {
        // Filter by expiration date if specified
        if (expirationDate && option.details?.expiration_date !== expirationDate) {
          console.log(`❌ POLYGON: Filtered out option - expiration mismatch: ${option.details?.expiration_date} vs ${expirationDate}`)
          continue
        }
        
        // Only process put options
        if (option.details?.contract_type !== 'put') {
          console.log(`❌ POLYGON: Filtered out option - not a put: ${option.details?.contract_type}`)
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
        
        console.log(`✅ POLYGON: Processed put option for ${symbol}:`, {
          strike: processedOption.strike,
          expiration: processedOption.expiration,
          premium: processedOption.premium,
          delta: processedOption.delta
        })
        
        processedOptions.push(processedOption)
      }
    }
    
    const result = {
      symbol: symbol,
      underlyingPrice: currentPrice,
      options: processedOptions,
      timestamp: new Date().toISOString(),
      status: 'OK'
    }
    
    console.log(`✅ POLYGON: Processed options data for ${symbol}:`, {
      underlyingPrice: result.underlyingPrice,
      totalOptions: result.options.length
    })
    
    return result
    
  } catch (error) {
    console.error('💥 POLYGON: Error processing options data:', error)
    throw error
  }
}

/**
 * Get options for multiple symbols with earnings
 * @param {Array} symbols - Array of stock symbols
 * @returns {Promise<Object>} Combined options data
 */
export async function getMultipleOptionsChains(symbols) {
  console.log(`📊 POLYGON: Getting options chains for ${symbols.length} symbols:`, symbols)
  
  const results = {}
  const errors = []
  
  for (const symbol of symbols) {
    try {
      console.log(`📊 POLYGON: Fetching options for ${symbol}...`)
      results[symbol] = await getOptionsChain(symbol)
      
      // Add small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 200))
      
    } catch (error) {
      console.error(`💥 POLYGON: Failed to fetch options for ${symbol}:`, error)
      errors.push({ symbol, error: error.message })
    }
  }
  
  console.log(`✅ POLYGON: Multiple options chains fetch complete:`, {
    successCount: Object.keys(results).length,
    errorCount: errors.length,
    successSymbols: Object.keys(results),
    errorSymbols: errors.map(e => e.symbol)
  })
  
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
    console.log('🏥 POLYGON: Starting Polygon API health check...')
    
    // If no API key, return demo status
    if (!API_KEY) {
      return { 
        status: 'DEMO', 
        message: 'Demo mode - Polygon API not configured',
        timestamp: new Date().toISOString(),
        usage: { current: 0, max: 5, remaining: 5 },
        details: {
          missingApiKey: true,
          suggestion: 'Add VITE_POLYGON_API_KEY to enable real data'
        }
      }
    }
    
    if (USE_MOCK_DATA) {
      return { 
        status: 'DEMO', 
        message: 'Using mock data mode',
        timestamp: new Date().toISOString(),
        usage: { current: 0, max: 5, remaining: 5 }
      }
    }
    
    if (!polygonClient) {
      return {
        status: 'ERROR',
        message: 'Polygon client not initialized',
        timestamp: new Date().toISOString(),
        usage: { current: 0, max: 5, remaining: 5 }
      }
    }
    
    // Test with a simple market status call
    const data = await polygonClient.get('/v1/marketstatus/now', {
      apikey: API_KEY
    })
    
    const usage = polygonLimiter.getUsage()
    
    console.log('✅ POLYGON: Polygon API health check passed:', { status: data.status, market: data.market })
    
    return {
      status: data.status || 'OK',
      message: `Polygon API is accessible. Market: ${data.market || 'unknown'}`,
      timestamp: new Date().toISOString(),
      usage: usage
    }
    
  } catch (error) {
    console.error('💥 POLYGON: Polygon API health check failed:', error)
    
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