import { getEarningsCalendar } from './earnings'
import { getMultipleOptionsChains } from './polygon'
import { calculatePOP, calculateConfidenceScore, calculateTimeToExpiry, calculateBreakeven, calculateMaxLoss, calculatePremiumPercentage } from './calculations'
import { supabase } from './supabase'

/**
 * Main recommendation engine that processes earnings and options data
 */
export class RecommendationEngine {
  constructor() {
    this.minDelta = 0.2 // Maximum delta for put options
    this.minPremiumPercentage = 3.5 // Minimum premium as % of stock price
    this.minPOP = 87 // Minimum probability of profit
    this.maxPOP = 93 // Maximum probability of profit
    this.maxDaysToExpiry = 14 // Maximum days to expiration
    this.minDaysToExpiry = 1 // Minimum days to expiration
  }

  /**
   * Generate recommendations based on earnings calendar and options data
   * @returns {Promise<Array>} Array of recommendations
   */
  async generateRecommendations() {
    try {
      console.log('Starting recommendation generation...')
      
      // Step 1: Get earnings calendar for current and next week
      const earningsData = await getEarningsCalendar()
      console.log(`Found ${earningsData.length} companies with upcoming earnings`)
      
      if (earningsData.length === 0) {
        console.log('No earnings found for the current period')
        return []
      }
      
      // Step 2: Extract symbols and get options data
      const symbols = earningsData.map(e => e.symbol).slice(0, 10) // Limit to first 10 to avoid rate limits
      console.log(`Fetching options data for symbols: ${symbols.join(', ')}`)
      
      const optionsData = await getMultipleOptionsChains(symbols)
      
      // Step 3: Process each symbol and generate recommendations
      const recommendations = []
      
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
      
      // Step 4: Sort by confidence score and return top recommendations
      const sortedRecommendations = recommendations
        .sort((a, b) => b.confidence_score - a.confidence_score)
        .slice(0, 20) // Top 20 recommendations
      
      console.log(`Generated ${sortedRecommendations.length} recommendations`)
      
      // Step 5: Save to database
      await this.saveRecommendations(sortedRecommendations)
      
      return sortedRecommendations
      
    } catch (error) {
      console.error('Error generating recommendations:', error)
      throw error
    }
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
        // Filter by basic criteria
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
        
        // Check if POP is within target range
        if (pop < this.minPOP || pop > this.maxPOP) {
          continue
        }
        
        const premiumPercentage = calculatePremiumPercentage(option.premium, stockPrice)
        const breakeven = calculateBreakeven(option.strike, option.premium)
        const maxLoss = calculateMaxLoss(option.strike, option.premium)
        
        // Calculate confidence score
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
   * Check if option meets basic filtering criteria
   * @param {Object} option - Option data
   * @param {number} stockPrice - Current stock price
   * @param {string} earningsDate - Earnings date
   * @returns {boolean} True if meets criteria
   */
  meetsBasicCriteria(option, stockPrice, earningsDate) {
    // Check delta
    if (Math.abs(option.delta) > this.minDelta) {
      return false
    }
    
    // Check premium percentage
    const premiumPercentage = calculatePremiumPercentage(option.premium, stockPrice)
    if (premiumPercentage < this.minPremiumPercentage) {
      return false
    }
    
    // Check days to expiration
    const daysToExpiry = Math.ceil(
      (new Date(option.expiration) - new Date()) / (1000 * 60 * 60 * 24)
    )
    
    if (daysToExpiry < this.minDaysToExpiry || daysToExpiry > this.maxDaysToExpiry) {
      return false
    }
    
    // Check if expiration is after earnings
    const expiryDate = new Date(option.expiration)
    const earningsDateObj = new Date(earningsDate)
    
    if (expiryDate <= earningsDateObj) {
      return false
    }
    
    // Check minimum volume and open interest
    if (option.volume < 10 || option.openInterest < 50) {
      return false
    }
    
    // Check if premium is reasonable
    if (option.premium <= 0 || option.premium > stockPrice * 0.1) {
      return false
    }
    
    return true
  }

  /**
   * Save recommendations to database
   * @param {Array} recommendations - Array of recommendations
   */
  async saveRecommendations(recommendations) {
    try {
      // First, mark all existing recommendations as inactive
      await supabase
        .from('recommendations')
        .update({ is_active: false })
        .eq('is_active', true)
      
      // Insert new recommendations
      if (recommendations.length > 0) {
        const { error } = await supabase
          .from('recommendations')
          .insert(recommendations)
        
        if (error) {
          console.error('Error saving recommendations:', error)
          throw error
        }
        
        console.log(`Saved ${recommendations.length} recommendations to database`)
      }
      
    } catch (error) {
      console.error('Error saving recommendations to database:', error)
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
    
    console.log('Updated filtering criteria:', {
      minDelta: this.minDelta,
      minPremiumPercentage: this.minPremiumPercentage,
      minPOP: this.minPOP,
      maxPOP: this.maxPOP,
      maxDaysToExpiry: this.maxDaysToExpiry,
      minDaysToExpiry: this.minDaysToExpiry
    })
  }
}

// Create singleton instance
export const recommendationEngine = new RecommendationEngine()