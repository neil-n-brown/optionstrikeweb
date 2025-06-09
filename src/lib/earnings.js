import { getCachedData, setCachedData } from './cache'
import { mockEarningsData, simulateDelay } from './mockData'

const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3'
const API_KEY = import.meta.env.VITE_FMP_API_KEY
const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true'

/**
 * Rate limiter for FMP API (250 requests per minute for free tier)
 */
class RateLimiter {
  constructor(maxRequests = 250, windowMs = 60000) {
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

const fmpLimiter = new RateLimiter(250, 60000)

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
 * Fetches earnings calendar data from FMP API
 * @param {string} fromDate - Start date (YYYY-MM-DD)
 * @param {string} toDate - End date (YYYY-MM-DD)
 * @returns {Promise<Array>} Earnings calendar data
 */
export async function getEarningsCalendar(fromDate = null, toDate = null) {
  // Use current week if no dates provided
  if (!fromDate || !toDate) {
    const weekRange = getCurrentWeekRange()
    fromDate = weekRange.from
    toDate = weekRange.to
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
    
    await setCachedData(cacheKey, filteredData, 240) // Cache for 4 hours
    return filteredData
  }
  
  try {
    await fmpLimiter.checkLimit()
    
    const response = await fetch(
      `${FMP_BASE_URL}/earning_calendar?from=${fromDate}&to=${toDate}&apikey=${API_KEY}`
    )
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (Array.isArray(data) && data.length === 0) {
      console.log(`No earnings found for ${fromDate} to ${toDate}`)
    }
    
    // Cache for 4 hours (earnings don't change frequently)
    await setCachedData(cacheKey, data, 240)
    
    console.log(`Fetched fresh earnings calendar for ${fromDate} to ${toDate}`)
    return data
    
  } catch (error) {
    console.error(`Error fetching earnings calendar:`, error)
    
    // Try to return stale cached data as fallback
    const staleData = await getCachedData(`earnings_${fromDate}_${toDate}_stale`)
    if (staleData) {
      console.log(`Using stale cached earnings data`)
      return staleData
    }
    
    throw error
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
    await fmpLimiter.checkLimit()
    
    const response = await fetch(
      `${FMP_BASE_URL}/profile/${symbol}?apikey=${API_KEY}`
    )
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data = await response.json()
    
    // Cache for 24 hours (company profiles don't change often)
    await setCachedData(cacheKey, data, 1440)
    
    console.log(`Fetched fresh company profile for ${symbol}`)
    return data
    
  } catch (error) {
    console.error(`Error fetching company profile for ${symbol}:`, error)
    
    // Try to return stale cached data as fallback
    const staleData = await getCachedData(`company_profile_${symbol}_stale`)
    if (staleData) {
      console.log(`Using stale cached company profile for ${symbol}`)
      return staleData
    }
    
    throw error
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
        timestamp: new Date().toISOString()
      }
    }
    
    // Test with a simple API call
    const response = await fetch(`${FMP_BASE_URL}/profile/AAPL?apikey=${API_KEY}`)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (data.error) {
      throw new Error(data.error)
    }
    
    return {
      status: 'OK',
      message: 'FMP API is accessible',
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