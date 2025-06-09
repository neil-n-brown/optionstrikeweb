import { getCachedData, setCachedData } from './cache'
import { mockEarningsData, simulateDelay } from './mockData'
import { APIClient, APIError } from './apiClient'
import { fmpLimiter } from './rateLimiter'

const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3'
const API_KEY = import.meta.env.VITE_FMP_API_KEY
const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true'
const CACHE_EARNINGS_MINUTES = parseInt(import.meta.env.VITE_CACHE_EARNINGS_MINUTES) || 240

// Create FMP API client
const fmpClient = new APIClient(
  FMP_BASE_URL,
  {},
  fmpLimiter
)

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
 * Fetches earnings calendar data from FMP API
 * @param {string} fromDate - Start date (YYYY-MM-DD)
 * @param {string} toDate - End date (YYYY-MM-DD)
 * @returns {Promise<Array>} Earnings calendar data
 */
export async function getEarningsCalendar(fromDate = null, toDate = null) {
  // Use current and next week if no dates provided
  if (!fromDate || !toDate) {
    const currentWeek = getCurrentWeekRange()
    const nextWeek = getNextWeekRange()
    fromDate = currentWeek.from
    toDate = nextWeek.to
  }
  
  const cacheKey = `earnings_${fromDate}_${toDate}`
  
  // Check cache first
  let cachedData = await getCachedData(cacheKey)
  if (cachedData) {
    console.log(`Using cached earnings calendar for ${fromDate} to ${toDate}`)
    return cachedData
  }
  
  // Use mock data if enabled
  if (USE_MOCK_DATA) {
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
    const data = await fmpClient.get('/earning_calendar', {
      from: fromDate,
      to: toDate,
      apikey: API_KEY
    })
    
    if (!Array.isArray(data)) {
      throw new APIError('Invalid response format from earnings API', 500, 'FMP')
    }
    
    // Process and enhance earnings data
    const processedData = await processEarningsData(data)
    
    // Cache for specified hours
    await setCachedData(cacheKey, processedData, CACHE_EARNINGS_MINUTES)
    
    console.log(`Fetched fresh earnings calendar for ${fromDate} to ${toDate}: ${processedData.length} companies`)
    return processedData
    
  } catch (error) {
    console.error(`Error fetching earnings calendar:`, error)
    
    // Try to return stale cached data as fallback
    const staleData = await getCachedData(`${cacheKey}_stale`)
    if (staleData) {
      console.log(`Using stale cached earnings data`)
      return staleData
    }
    
    throw error
  }
}

/**
 * Process and enhance earnings data
 * @param {Array} rawData - Raw earnings data from API
 * @returns {Array} Processed earnings data
 */
async function processEarningsData(rawData) {
  const processedData = []
  
  for (const earning of rawData) {
    try {
      // Calculate EPS growth if we have historical data
      const epsGrowth = await calculateEPSGrowth(earning.symbol)
      
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
 * Calculate EPS growth for a symbol
 * @param {string} symbol - Stock symbol
 * @returns {Promise<number>} EPS growth percentage
 */
async function calculateEPSGrowth(symbol) {
  const cacheKey = `eps_growth_${symbol}`
  
  // Check cache first
  let cachedGrowth = await getCachedData(cacheKey)
  if (cachedGrowth !== null) {
    return cachedGrowth
  }
  
  try {
    // Get historical earnings data
    const data = await fmpClient.get(`/historical/earning_calendar/${symbol}`, {
      limit: 8, // Get last 8 quarters
      apikey: API_KEY
    })
    
    if (!Array.isArray(data) || data.length < 2) {
      return 0 // Not enough data
    }
    
    // Calculate year-over-year growth (compare with 4 quarters ago)
    const currentEPS = data[0]?.eps || 0
    const yearAgoEPS = data[4]?.eps || 0
    
    if (yearAgoEPS === 0) {
      return 0
    }
    
    const growth = ((currentEPS - yearAgoEPS) / Math.abs(yearAgoEPS)) * 100
    
    // Cache for 24 hours
    await setCachedData(cacheKey, growth, 1440)
    
    return growth
    
  } catch (error) {
    console.warn(`Error calculating EPS growth for ${symbol}:`, error)
    return 0
  }
}

/**
 * Fetches company profile data from FMP API
 * @param {string} symbol - Stock ticker symbol
 * @returns {Promise<Object>} Company profile data
 */
export async function getCompanyProfile(symbol) {
  const cacheKey = `company_profile_${symbol}`
  
  // Check cache first
  let cachedData = await getCachedData(cacheKey)
  if (cachedData) {
    console.log(`Using cached company profile for ${symbol}`)
    return cachedData
  }
  
  // Use mock data if enabled
  if (USE_MOCK_DATA) {
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
    
    // Try to return stale cached data as fallback
    const staleData = await getCachedData(`${cacheKey}_stale`)
    if (staleData) {
      console.log(`Using stale cached company profile for ${symbol}`)
      return staleData
    }
    
    throw error
  }
}

/**
 * Get earnings for multiple symbols
 * @param {Array} symbols - Array of stock symbols
 * @returns {Promise<Object>} Combined earnings data
 */
export async function getMultipleEarnings(symbols) {
  const results = {}
  const errors = []
  
  for (const symbol of symbols) {
    try {
      console.log(`Fetching earnings data for ${symbol}...`)
      results[symbol] = await getCompanyProfile(symbol)
      
      // Add small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100))
      
    } catch (error) {
      console.error(`Failed to fetch earnings for ${symbol}:`, error)
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
 * Health check for FMP API
 * @returns {Promise<Object>} API status
 */
export async function checkFMPAPIHealth() {
  try {
    if (USE_MOCK_DATA) {
      return { 
        status: 'OK', 
        message: 'Using mock data mode',
        timestamp: new Date().toISOString(),
        usage: { current: 0, max: 250, remaining: 250 }
      }
    }
    
    // Test with a simple API call
    const data = await fmpClient.get('/profile/AAPL', {
      apikey: API_KEY
    })
    
    if (!Array.isArray(data) || data.length === 0) {
      throw new APIError('Invalid response from FMP API', 500, 'FMP')
    }
    
    const usage = fmpLimiter.getUsage()
    
    return {
      status: 'OK',
      message: 'FMP API is accessible',
      timestamp: new Date().toISOString(),
      usage: usage
    }
    
  } catch (error) {
    const usage = fmpLimiter.getUsage()
    
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
export function getFMPUsage() {
  return fmpLimiter.getUsage()
}