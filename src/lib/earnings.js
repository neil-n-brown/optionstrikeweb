import { getCachedData, setCachedData } from './cache'
import { mockEarningsData, simulateDelay } from './mockData'
import { APIClient, APIError } from './apiClient'
import { fmpLimiter } from './rateLimiter'

const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3'
const API_KEY = import.meta.env.VITE_FMP_API_KEY
const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true'
const CACHE_EARNINGS_MINUTES = parseInt(import.meta.env.VITE_CACHE_EARNINGS_MINUTES) || 240 // 4 hours default

// Create FMP API client only if API key is available
let fmpClient = null

if (API_KEY) {
  fmpClient = new APIClient(
    FMP_BASE_URL,
    {},
    fmpLimiter
  )
}

/**
 * Gets current week date range
 * @returns {Object} From and to dates for current week
 */
function getCurrentWeekRange() {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - dayOfWeek)
  
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)
  
  return {
    from: startOfWeek.toISOString().split('T')[0],
    to: endOfWeek.toISOString().split('T')[0]
  }
}

/**
 * Gets next week date range
 * @returns {Object} From and to dates for next week
 */
function getNextWeekRange() {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const startOfNextWeek = new Date(now)
  startOfNextWeek.setDate(now.getDate() + (7 - dayOfWeek))
  
  const endOfNextWeek = new Date(startOfNextWeek)
  endOfNextWeek.setDate(startOfNextWeek.getDate() + 6)
  
  return {
    from: startOfNextWeek.toISOString().split('T')[0],
    to: endOfNextWeek.toISOString().split('T')[0]
  }
}

/**
 * Gets extended date range for broader stock coverage
 * @returns {Object} From and to dates for extended period
 */
function getExtendedDateRange() {
  const now = new Date()
  const startDate = new Date(now)
  startDate.setDate(now.getDate() - 3) // Start 3 days ago
  
  const endDate = new Date(now)
  endDate.setDate(now.getDate() + 21) // Extend 3 weeks into future
  
  return {
    from: startDate.toISOString().split('T')[0],
    to: endDate.toISOString().split('T')[0]
  }
}

/**
 * Fetches earnings calendar data from FMP API with enhanced error handling and expanded coverage
 * @param {string} fromDate - Start date (YYYY-MM-DD)
 * @param {string} toDate - End date (YYYY-MM-DD)
 * @param {boolean} expandedRange - Whether to use extended date range for broader coverage
 * @returns {Promise<Array>} Earnings calendar data
 */
export async function getEarningsCalendar(fromDate = null, toDate = null, expandedRange = true) {
  // Use extended range for broader stock coverage if no dates provided
  if (!fromDate || !toDate) {
    if (expandedRange) {
      const extended = getExtendedDateRange()
      fromDate = extended.from
      toDate = extended.to
      console.log(`Using extended date range for broader coverage: ${fromDate} to ${toDate}`)
    } else {
      const currentWeek = getCurrentWeekRange()
      const nextWeek = getNextWeekRange()
      fromDate = currentWeek.from
      toDate = nextWeek.to
    }
  }
  
  const cacheKey = `fmp_earnings_${fromDate}_${toDate}${expandedRange ? '_extended' : ''}`
  
  // Check cache first (longer cache for FMP data)
  let cachedData = await getCachedData(cacheKey)
  if (cachedData) {
    console.log(`Using cached earnings calendar for ${fromDate} to ${toDate} (${cachedData.length} companies)`)
    return cachedData
  }
  
  // Use mock data if enabled or no API key
  if (USE_MOCK_DATA || !API_KEY || !fmpClient) {
    console.log(`Using mock earnings calendar for ${fromDate} to ${toDate}`)
    await simulateDelay(600)
    
    // Filter mock data to date range
    const filteredData = mockEarningsData.filter(item => {
      const itemDate = new Date(item.date)
      const from = new Date(fromDate)
      const to = new Date(toDate)
      return itemDate >= from && itemDate <= to
    })
    
    await setCachedData(cacheKey, filteredData, CACHE_EARNINGS_MINUTES)
    return filteredData
  }
  
  try {
    console.log(`Fetching earnings calendar from FMP API for ${fromDate} to ${toDate} (expanded coverage)`)
    
    // Check rate limiter before making request
    await fmpLimiter.checkLimit()
    
    const data = await fmpClient.get('/earning_calendar', {
      from: fromDate,
      to: toDate,
      apikey: API_KEY
    })
    
    if (!Array.isArray(data)) {
      throw new APIError('Invalid response format from earnings API', 500, 'FMP')
    }
    
    console.log(`Raw earnings data received: ${data.length} companies`)
    
    // Process and enhance earnings data
    const processedData = await processEarningsData(data)
    
    // Cache for longer duration (4 hours) since earnings don't change frequently
    await setCachedData(cacheKey, processedData, CACHE_EARNINGS_MINUTES)
    
    console.log(`Processed earnings calendar: ${processedData.length} companies with enhanced data`)
    return processedData
    
  } catch (error) {
    console.error(`Error fetching earnings calendar:`, error)
    
    // Handle rate limit errors specifically
    if (error.status === 429 || error.message.includes('Limit Reach')) {
      console.warn('FMP API rate limit reached, trying stale cache data')
      
      // Try to return stale cached data as fallback
      const staleData = await getCachedData(`${cacheKey}_stale`)
      if (staleData) {
        console.log(`Using stale cached earnings data (${staleData.length} companies)`)
        return staleData
      }
      
      // If no stale data, return empty array to prevent cascading failures
      console.warn('No stale data available, returning empty earnings calendar')
      return []
    }
    
    throw error
  }
}

/**
 * Process and enhance earnings data with batch processing
 * @param {Array} rawData - Raw earnings data from API
 * @returns {Array} Processed earnings data
 */
async function processEarningsData(rawData) {
  const processedData = []
  
  // Filter out symbols that are clearly not suitable for options trading
  const filteredData = rawData.filter(earning => {
    const symbol = earning.symbol
    
    // Basic symbol validation
    if (!symbol || symbol.length < 1 || symbol.length > 5) {
      return false
    }
    
    // Exclude obvious penny stocks or problematic symbols
    if (symbol.includes('.') || symbol.includes('-') || symbol.includes('/')) {
      return false
    }
    
    // Exclude symbols with numbers (usually not optionable)
    if (/\d/.test(symbol)) {
      return false
    }
    
    // Exclude symbols that are too short or too long
    if (symbol.length < 1 || symbol.length > 5) {
      return false
    }
    
    return true
  })
  
  console.log(`Filtered earnings data: ${filteredData.length} suitable symbols from ${rawData.length} total`)
  
  // Process in smaller batches to avoid rate limits
  const batchSize = 5
  const symbols = [...new Set(filteredData.map(e => e.symbol))]
  
  console.log(`Processing ${symbols.length} unique symbols in batches of ${batchSize}`)
  
  // Get EPS growth data in batches
  const epsGrowthData = await calculateEPSGrowthBatch(symbols, batchSize)
  
  for (const earning of filteredData) {
    try {
      const epsGrowth = epsGrowthData[earning.symbol] || 0
      
      const processedEarning = {
        symbol: earning.symbol,
        date: earning.date,
        eps: earning.eps,
        epsEstimated: earning.epsEstimated,
        revenue: earning.revenue,
        revenueEstimated: earning.revenueEstimated,
        epsGrowth: epsGrowth,
        marketCap: earning.marketCap || 0,
        time: earning.time || 'bmo' // before market open
      }
      
      processedData.push(processedEarning)
      
    } catch (error) {
      console.warn(`Error processing earnings for ${earning.symbol}:`, error)
      // Include the earning anyway with default values
      processedData.push({
        ...earning,
        epsGrowth: 0
      })
    }
  }
  
  return processedData
}

/**
 * Calculate EPS growth for multiple symbols in batches
 * @param {Array} symbols - Array of stock symbols
 * @param {number} batchSize - Number of symbols to process at once
 * @returns {Promise<Object>} EPS growth data by symbol
 */
async function calculateEPSGrowthBatch(symbols, batchSize = 5) {
  const results = {}
  
  // If no API key, return zeros for all symbols
  if (!API_KEY || !fmpClient) {
    console.log('No FMP API key, returning zero EPS growth for all symbols')
    symbols.forEach(symbol => {
      results[symbol] = 0
    })
    return results
  }
  
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize)
    
    console.log(`Processing EPS growth batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(symbols.length / batchSize)}`)
    
    const batchPromises = batch.map(async (symbol) => {
      try {
        const growth = await calculateEPSGrowth(symbol)
        return { symbol, growth }
      } catch (error) {
        console.warn(`Failed to calculate EPS growth for ${symbol}:`, error)
        return { symbol, growth: 0 }
      }
    })
    
    // Wait between batches to avoid overwhelming the API
    if (i > 0) {
      const delay = 2000 + Math.random() * 1000 // 2-3 second delay
      console.log(`Waiting ${Math.round(delay)}ms before next batch...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
    
    const batchResults = await Promise.allSettled(batchPromises)
    
    batchResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        const { symbol, growth } = result.value
        results[symbol] = growth
      }
    })
  }
  
  return results
}

/**
 * Calculate EPS growth for a symbol with enhanced caching
 * @param {string} symbol - Stock symbol
 * @returns {Promise<number>} EPS growth percentage
 */
async function calculateEPSGrowth(symbol) {
  const cacheKey = `fmp_eps_growth_${symbol}`
  
  // Check cache first (24 hour cache for EPS growth)
  let cachedGrowth = await getCachedData(cacheKey)
  if (cachedGrowth !== null) {
    return cachedGrowth
  }
  
  // If no API key, return 0
  if (!API_KEY || !fmpClient) {
    await setCachedData(cacheKey, 0, 1440) // Cache 0 for 24 hours
    return 0
  }
  
  try {
    // Check rate limiter before making request
    await fmpLimiter.checkLimit()
    
    // Get historical earnings data
    const data = await fmpClient.get(`/historical/earning_calendar/${symbol}`, {
      limit: 8, // Get last 8 quarters
      apikey: API_KEY
    })
    
    if (!Array.isArray(data) || data.length < 2) {
      await setCachedData(cacheKey, 0, 1440) // Cache 0 for 24 hours
      return 0 // Not enough data
    }
    
    // Calculate year-over-year growth (compare with 4 quarters ago)
    const currentEPS = data[0]?.eps || 0
    const yearAgoEPS = data[4]?.eps || 0
    
    if (yearAgoEPS === 0) {
      await setCachedData(cacheKey, 0, 1440)
      return 0
    }
    
    const growth = ((currentEPS - yearAgoEPS) / Math.abs(yearAgoEPS)) * 100
    
    // Cache for 24 hours
    await setCachedData(cacheKey, growth, 1440)
    
    return growth
    
  } catch (error) {
    console.warn(`Error calculating EPS growth for ${symbol}:`, error)
    
    // Cache 0 to avoid repeated failed requests
    await setCachedData(cacheKey, 0, 1440)
    return 0
  }
}

/**
 * Fetches company profile data from FMP API with enhanced error handling
 * @param {string} symbol - Stock ticker symbol
 * @returns {Promise<Object>} Company profile data
 */
export async function getCompanyProfile(symbol) {
  const cacheKey = `fmp_company_profile_${symbol}`
  
  // Check cache first (24 hour cache)
  let cachedData = await getCachedData(cacheKey)
  if (cachedData) {
    console.log(`Using cached company profile for ${symbol}`)
    return cachedData
  }
  
  // Use mock data if enabled or no API key
  if (USE_MOCK_DATA || !API_KEY || !fmpClient) {
    console.log(`Using mock company profile for ${symbol}`)
    await simulateDelay(400)
    
    const mockProfile = {
      symbol: symbol,
      companyName: `${symbol} Inc.`,
      industry: 'Technology',
      sector: 'Technology',
      marketCap: 1000000000,
      beta: 1.2,
      price: mockEarningsData.find(e => e.symbol === symbol)?.revenue || 100
    }
    
    await setCachedData(cacheKey, [mockProfile], 1440) // Cache for 24 hours
    return [mockProfile]
  }
  
  try {
    // Check rate limiter before making request
    await fmpLimiter.checkLimit()
    
    const data = await fmpClient.get(`/profile/${symbol}`, {
      apikey: API_KEY
    })
    
    if (!Array.isArray(data) || data.length === 0) {
      throw new APIError(`No profile data found for ${symbol}`, 404, 'FMP')
    }
    
    // Cache for 24 hours (company profiles don't change often)
    await setCachedData(cacheKey, data, 1440)
    
    console.log(`Fetched fresh company profile for ${symbol}`)
    return data
    
  } catch (error) {
    console.error(`Error fetching company profile for ${symbol}:`, error)
    
    // Handle rate limit errors
    if (error.status === 429 || error.message.includes('Limit Reach')) {
      console.warn(`Rate limit reached for ${symbol} profile, using fallback`)
      
      // Try to return stale cached data as fallback
      const staleData = await getCachedData(`${cacheKey}_stale`)
      if (staleData) {
        console.log(`Using stale cached company profile for ${symbol}`)
        return staleData
      }
    }
    
    throw error
  }
}

/**
 * Get earnings for multiple symbols with enhanced batch processing
 * @param {Array} symbols - Array of stock symbols
 * @returns {Promise<Object>} Combined earnings data
 */
export async function getMultipleEarnings(symbols) {
  const results = {}
  const errors = []
  const batchSize = 3 // Smaller batch size for company profiles
  
  console.log(`Fetching earnings for ${symbols.length} symbols in batches of ${batchSize}`)
  
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize)
    
    console.log(`Processing earnings batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(symbols.length / batchSize)}`)
    
    const batchPromises = batch.map(async (symbol) => {
      try {
        const data = await getCompanyProfile(symbol)
        return { symbol, data }
      } catch (error) {
        console.error(`Failed to fetch earnings for ${symbol}:`, error)
        return { symbol, error: error.message }
      }
    })
    
    // Add delay between batches
    if (i > 0) {
      const delay = 3000 + Math.random() * 2000 // 3-5 second delay
      console.log(`Waiting ${Math.round(delay)}ms before next batch...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
    
    const batchResults = await Promise.allSettled(batchPromises)
    
    batchResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        const { symbol, data, error } = result.value
        if (data) {
          results[symbol] = data
        } else if (error) {
          errors.push({ symbol, error })
        }
      } else {
        errors.push({ symbol: 'unknown', error: result.reason?.message || 'Unknown error' })
      }
    })
  }
  
  return {
    results,
    errors,
    timestamp: new Date().toISOString()
  }
}

/**
 * Health check for FMP API with enhanced diagnostics
 * @returns {Promise<Object>} API status
 */
export async function checkFMPAPIHealth() {
  try {
    // If no API key, return demo status
    if (!API_KEY) {
      return { 
        status: 'DEMO', 
        message: 'Demo mode - FMP API not configured',
        timestamp: new Date().toISOString(),
        usage: { current: 0, max: 250, remaining: 250 },
        details: {
          missingApiKey: true,
          suggestion: 'Add VITE_FMP_API_KEY to enable real data'
        }
      }
    }
    
    if (USE_MOCK_DATA) {
      return { 
        status: 'DEMO', 
        message: 'Using mock data mode',
        timestamp: new Date().toISOString(),
        usage: { current: 0, max: 250, remaining: 250 }
      }
    }
    
    if (!fmpClient) {
      return {
        status: 'ERROR',
        message: 'FMP client not initialized',
        timestamp: new Date().toISOString(),
        usage: { current: 0, max: 250, remaining: 250 }
      }
    }
    
    // Test with a simple API call
    await fmpLimiter.checkLimit()
    
    const data = await fmpClient.get('/profile/AAPL', {
      apikey: API_KEY
    })
    
    if (!Array.isArray(data) || data.length === 0) {
      throw new APIError('Invalid response from FMP API', 500, 'FMP')
    }
    
    const usage = fmpLimiter.getUsage()
    
    return {
      status: 'OK',
      message: 'FMP API is accessible - Expanded stock universe enabled',
      timestamp: new Date().toISOString(),
      usage: usage,
      rateLimitInfo: {
        inBackoff: fmpLimiter.isInBackoff(),
        retryCount: usage.retryCount
      }
    }
    
  } catch (error) {
    const usage = fmpLimiter.getUsage()
    
    // Provide specific guidance for rate limit errors
    let message = error.message
    if (error.status === 429 || error.message.includes('Limit Reach')) {
      message = 'FMP API rate limit exceeded. Using cached data when available.'
    }
    
    return {
      status: 'ERROR',
      message: message,
      timestamp: new Date().toISOString(),
      usage: usage,
      rateLimitInfo: {
        inBackoff: fmpLimiter.isInBackoff(),
        retryCount: usage.retryCount
      }
    }
  }
}

/**
 * Get rate limiter usage statistics
 * @returns {Object} Usage statistics
 */
export function getFMPUsage() {
  return fmpLimiter.getUsage()
}

/**
 * Reset FMP rate limiter (use with caution)
 */
export function resetFMPLimiter() {
  fmpLimiter.reset()
  console.log('FMP rate limiter has been reset')
}