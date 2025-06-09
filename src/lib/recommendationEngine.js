import { getEarningsCalendar } from './earnings'
import { getMultipleOptionsChains } from './polygon'
import { calculatePOP, calculateConfidenceScore, calculateTimeToExpiry, calculateBreakeven, calculateMaxLoss, calculatePremiumPercentage } from './calculations'
import { supabase } from './supabase'
import { getCachedData, setCachedData } from './cache'

/**
 * Main recommendation engine that processes earnings and options data
 * Now supports expanded stock universe beyond major US stocks
 */
export class RecommendationEngine {
  constructor() {
    this.minDelta = 0.2 // Maximum delta for put options
    this.minPremiumPercentage = 3.5 // Minimum premium as % of stock price
    this.minPOP = 87 // Minimum probability of profit
    this.maxPOP = 93 // Maximum probability of profit
    this.maxDaysToExpiry = 14 // Maximum days to expiration
    this.minDaysToExpiry = 1 // Minimum days to expiration
    this.maxSymbolsToProcess = 50 // Increased from 8 to process more stocks
    this.minMarketCap = 1000000000 // $1B minimum market cap for liquidity
    this.minVolume = 10 // Minimum daily volume for options
    this.minOpenInterest = 50 // Minimum open interest for options
  }

  /**
   * Generate recommendations based on earnings calendar and options data
   * Now processes expanded stock universe
   * @returns {Promise<Array>} Array of recommendations
   */
  async generateRecommendations() {
    try {
      console.log('Starting recommendation generation with expanded stock universe...')
      
      // Check for cached recommendations first
      const cachedRecommendations = await this.getCachedRecommendations()
      if (cachedRecommendations.length > 0) {
        console.log(`Found ${cachedRecommendations.length} cached recommendations`)
      }
      
      // Step 1: Get earnings calendar with extended date range for broader coverage
      let earningsData
      try {
        earningsData = await getEarningsCalendar(null, null, true) // Use extended range
        console.log(`Found ${earningsData.length} companies with upcoming earnings (expanded universe)`)
      } catch (error) {
        console.error('Error fetching earnings data:', error)
        
        // If earnings fetch fails due to rate limits, use cached recommendations
        if (error.message.includes('rate limit') || error.message.includes('429')) {
          console.warn('Rate limit hit, using cached recommendations')
          return cachedRecommendations
        }
        
        // For other errors, still try cached recommendations
        if (cachedRecommendations.length > 0) {
          console.warn('Using cached recommendations due to earnings API error')
          return cachedRecommendations
        }
        
        throw error
      }
      
      if (earningsData.length === 0) {
        console.log('No earnings found for the current period, using cached recommendations')
        return cachedRecommendations
      }
      
      // Step 2: Filter and prioritize symbols for processing
      const prioritizedSymbols = this.prioritizeSymbols(earningsData)
      console.log(`Prioritized ${prioritizedSymbols.length} symbols for options analysis`)
      
      // Step 3: Process symbols in batches to avoid overwhelming APIs
      const recommendations = []
      const batchSize = 10 // Process 10 symbols at a time
      
      for (let i = 0; i < prioritizedSymbols.length; i += batchSize) {
        const batch = prioritizedSymbols.slice(i, i + batchSize)
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(prioritizedSymbols.length / batchSize)} (${batch.length} symbols)`)
        
        try {
          const batchRecommendations = await this.processBatch(batch, earningsData)
          recommendations.push(...batchRecommendations)
          
          // Add delay between batches to respect rate limits
          if (i + batchSize < prioritizedSymbols.length) {
            const delay = 3000 + Math.random() * 2000 // 3-5 second delay
            console.log(`Waiting ${Math.round(delay)}ms before next batch...`)
            await new Promise(resolve => setTimeout(resolve, delay))
          }
          
        } catch (error) {
          console.error(`Error processing batch starting at index ${i}:`, error)
          // Continue with next batch instead of failing completely
        }
      }
      
      // Step 4: Sort by confidence score and return top recommendations
      const sortedRecommendations = recommendations
        .sort((a, b) => b.confidence_score - a.confidence_score)
        .slice(0, 30) // Increased from 20 to 30 recommendations
      
      console.log(`Generated ${sortedRecommendations.length} new recommendations from expanded stock universe`)
      
      // Step 5: Save to database if we have new recommendations
      if (sortedRecommendations.length > 0) {
        await this.saveRecommendations(sortedRecommendations)
        return sortedRecommendations
      } else {
        // If no new recommendations generated, return cached ones
        console.log('No new recommendations generated, using cached recommendations')
        return cachedRecommendations
      }
      
    } catch (error) {
      console.error('Error generating recommendations:', error)
      
      // Always try to return cached recommendations as fallback
      const fallbackRecommendations = await this.getCachedRecommendations()
      if (fallbackRecommendations.length > 0) {
        console.log(`Returning ${fallbackRecommendations.length} cached recommendations as fallback`)
        return fallbackRecommendations
      }
      
      throw error
    }
  }

  /**
   * Prioritize symbols based on market cap, volume, and other factors
   * @param {Array} earningsData - Raw earnings data
   * @returns {Array} Prioritized symbol list
   */
  prioritizeSymbols(earningsData) {
    // Filter and score symbols
    const scoredSymbols = earningsData
      .filter(earning => {
        // Basic validation
        if (!earning.symbol || earning.symbol.length < 1 || earning.symbol.length > 5) {
          return false
        }
        
        // Exclude symbols with special characters (usually not optionable)
        if (earning.symbol.includes('.') || earning.symbol.includes('-') || earning.symbol.includes('/')) {
          return false
        }
        
        // Exclude symbols with numbers (usually not optionable)
        if (/\d/.test(earning.symbol)) {
          return false
        }
        
        // Market cap filter (if available)
        if (earning.marketCap && earning.marketCap < this.minMarketCap) {
          return false
        }
        
        return true
      })
      .map(earning => {
        // Calculate priority score
        let score = 0
        
        // Market cap score (higher is better)
        if (earning.marketCap) {
          score += Math.min(50, Math.log10(earning.marketCap / 1000000000) * 10)
        }
        
        // EPS growth score
        if (earning.epsGrowth) {
          score += Math.max(-10, Math.min(20, earning.epsGrowth / 5))
        }
        
        // Revenue score
        if (earning.revenue) {
          score += Math.min(20, Math.log10(earning.revenue / 1000) * 5)
        }
        
        // Symbol length preference (shorter symbols often more liquid)
        score += (6 - earning.symbol.length) * 2
        
        // Known high-volume sectors get bonus
        const symbol = earning.symbol.toUpperCase()
        if (['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'NFLX'].includes(symbol)) {
          score += 30 // Bonus for known liquid stocks
        }
        
        return {
          symbol: earning.symbol,
          score: score,
          earning: earning
        }
      })
      .sort((a, b) => b.score - a.score) // Sort by score descending
      .slice(0, this.maxSymbolsToProcess) // Take top N symbols
    
    console.log(`Symbol prioritization complete. Top 10 symbols:`)
    scoredSymbols.slice(0, 10).forEach((item, index) => {
      console.log(`${index + 1}. ${item.symbol} (score: ${item.score.toFixed(1)})`)
    })
    
    return scoredSymbols.map(item => item.symbol)
  }

  /**
   * Process a batch of symbols
   * @param {Array} symbols - Symbols to process
   * @param {Array} earningsData - Earnings data for reference
   * @returns {Array} Recommendations from this batch
   */
  async processBatch(symbols, earningsData) {
    const recommendations = []
    
    try {
      // Get options data for the batch
      const optionsData = await getMultipleOptionsChains(symbols)
      
      // Process each symbol in the batch
      for (const symbol of symbols) {
        try {
          const earnings = earningsData.find(e => e.symbol === symbol)
          const options = optionsData.results[symbol]
          
          if (!earnings || !options || !options.options) {
            console.log(`Skipping ${symbol}: missing earnings or options data`)
            continue
          }
          
          const symbolRecommendations = await this.processSymbol(symbol, earnings, options)
          recommendations.push(...symbolRecommendations)
          
        } catch (error) {
          console.error(`Error processing ${symbol}:`, error)
        }
      }
      
    } catch (error) {
      console.error('Error processing batch:', error)
    }
    
    return recommendations
  }

  /**
   * Process a single symbol to generate recommendations
   * @param {string} symbol - Stock symbol
   * @param {Object} earnings - Earnings data
   * @param {Object} options - Options data
   * @returns {Array} Recommendations for this symbol
   */
  async processSymbol(symbol, earnings, options) {
    const recommendations = []
    const stockPrice = options.underlyingPrice
    
    if (!stockPrice || stockPrice <= 0) {
      console.log(`Skipping ${symbol}: invalid stock price`)
      return recommendations
    }
    
    console.log(`Processing ${symbol}: stock price $${stockPrice}, ${options.options.length} options`)
    
    for (const option of options.options) {
      try {
        // Filter by basic criteria (same rigorous filtering as before)
        if (!this.meetsBasicCriteria(option, stockPrice, earnings.date)) {
          continue
        }
        
        // Calculate additional metrics
        const timeToExpiry = calculateTimeToExpiry(option.expiration)
        const pop = calculatePOP(
          stockPrice,
          option.strike,
          timeToExpiry,
          0.05, // Risk-free rate
          option.impliedVolatility
        )
        
        // Check if POP is within target range (same criteria)
        if (pop < this.minPOP || pop > this.maxPOP) {
          continue
        }
        
        const premiumPercentage = calculatePremiumPercentage(option.premium, stockPrice)
        const breakeven = calculateBreakeven(option.strike, option.premium)
        const maxLoss = calculateMaxLoss(option.strike, option.premium)
        
        // Calculate confidence score (same algorithm)
        const confidenceScore = calculateConfidenceScore(
          option.impliedVolatility,
          option.openInterest,
          option.volume,
          earnings.epsGrowth || 0,
          pop,
          premiumPercentage
        )
        
        const recommendation = {
          symbol: symbol,
          strike_price: option.strike,
          expiration_date: option.expiration,
          premium: option.premium,
          confidence_score: confidenceScore,
          pop: pop,
          delta: Math.abs(option.delta),
          implied_volatility: option.impliedVolatility,
          premium_percentage: premiumPercentage,
          max_loss: maxLoss,
          breakeven: breakeven,
          earnings_date: earnings.date,
          volume: option.volume,
          open_interest: option.openInterest,
          stock_price: stockPrice,
          eps_growth: earnings.epsGrowth || 0,
          created_at: new Date().toISOString(),
          is_active: true
        }
        
        recommendations.push(recommendation)
        
      } catch (error) {
        console.error(`Error processing option for ${symbol}:`, error)
      }
    }
    
    console.log(`Generated ${recommendations.length} recommendations for ${symbol}`)
    return recommendations
  }

  /**
   * Check if option meets basic filtering criteria (unchanged - same rigorous standards)
   * @param {Object} option - Option data
   * @param {number} stockPrice - Current stock price
   * @param {string} earningsDate - Earnings date
   * @returns {boolean} True if meets criteria
   */
  meetsBasicCriteria(option, stockPrice, earningsDate) {
    // Check delta (same criteria)
    if (Math.abs(option.delta) > this.minDelta) {
      return false
    }
    
    // Check premium percentage (same criteria)
    const premiumPercentage = calculatePremiumPercentage(option.premium, stockPrice)
    if (premiumPercentage < this.minPremiumPercentage) {
      return false
    }
    
    // Check days to expiration (same criteria)
    const daysToExpiry = Math.ceil(
      (new Date(option.expiration) - new Date()) / (1000 * 60 * 60 * 24)
    )
    
    if (daysToExpiry < this.minDaysToExpiry || daysToExpiry > this.maxDaysToExpiry) {
      return false
    }
    
    // Check if expiration is after earnings (same criteria)
    const expiryDate = new Date(option.expiration)
    const earningsDateObj = new Date(earningsDate)
    
    if (expiryDate <= earningsDateObj) {
      return false
    }
    
    // Check minimum volume and open interest (same criteria)
    if (option.volume < this.minVolume || option.openInterest < this.minOpenInterest) {
      return false
    }
    
    // Check if premium is reasonable (same criteria)
    if (option.premium <= 0 || option.premium > stockPrice * 0.1) {
      return false
    }
    
    return true
  }

  /**
   * Get cached recommendations from database
   * @returns {Promise<Array>} Cached recommendations
   */
  async getCachedRecommendations() {
    try {
      const { data, error } = await supabase
        .from('recommendations')
        .select('*')
        .eq('is_active', true)
        .order('confidence_score', { ascending: false })
        .limit(30) // Increased from 20 to 30
      
      if (error) {
        console.warn('Error fetching cached recommendations:', error)
        return []
      }
      
      return data || []
      
    } catch (error) {
      console.error('Error fetching cached recommendations:', error)
      return []
    }
  }

  /**
   * Save recommendations to database with enhanced error handling
   * @param {Array} recommendations - Array of recommendations
   */
  async saveRecommendations(recommendations) {
    try {
      // First, mark all existing recommendations as inactive
      const { error: updateError } = await supabase
        .from('recommendations')
        .update({ is_active: false })
        .eq('is_active', true)
      
      if (updateError) {
        console.warn('Error deactivating old recommendations:', updateError)
      }
      
      // Insert new recommendations
      if (recommendations.length > 0) {
        const { error: insertError } = await supabase
          .from('recommendations')
          .insert(recommendations)
        
        if (insertError) {
          console.error('Error saving recommendations:', insertError)
          throw insertError
        }
        
        console.log(`Saved ${recommendations.length} recommendations to database`)
        
        // Cache the recommendations as well
        await setCachedData('latest_recommendations', recommendations, 60) // Cache for 1 hour
      }
      
    } catch (error) {
      console.error('Error saving recommendations to database:', error)
      
      // Even if database save fails, cache the recommendations
      try {
        await setCachedData('latest_recommendations', recommendations, 60)
        console.log('Cached recommendations despite database error')
      } catch (cacheError) {
        console.error('Failed to cache recommendations:', cacheError)
      }
      
      throw error
    }
  }

  /**
   * Update filtering criteria
   * @param {Object} criteria - New criteria
   */
  updateCriteria(criteria) {
    if (criteria.minDelta !== undefined) this.minDelta = criteria.minDelta
    if (criteria.minPremiumPercentage !== undefined) this.minPremiumPercentage = criteria.minPremiumPercentage
    if (criteria.minPOP !== undefined) this.minPOP = criteria.minPOP
    if (criteria.maxPOP !== undefined) this.maxPOP = criteria.maxPOP
    if (criteria.maxDaysToExpiry !== undefined) this.maxDaysToExpiry = criteria.maxDaysToExpiry
    if (criteria.minDaysToExpiry !== undefined) this.minDaysToExpiry = criteria.minDaysToExpiry
    if (criteria.maxSymbolsToProcess !== undefined) this.maxSymbolsToProcess = criteria.maxSymbolsToProcess
    if (criteria.minMarketCap !== undefined) this.minMarketCap = criteria.minMarketCap
    
    console.log('Updated filtering criteria for expanded stock universe:', {
      minDelta: this.minDelta,
      minPremiumPercentage: this.minPremiumPercentage,
      minPOP: this.minPOP,
      maxPOP: this.maxPOP,
      maxDaysToExpiry: this.maxDaysToExpiry,
      minDaysToExpiry: this.minDaysToExpiry,
      maxSymbolsToProcess: this.maxSymbolsToProcess,
      minMarketCap: this.minMarketCap
    })
  }
}

// Create singleton instance
export const recommendationEngine = new RecommendationEngine()