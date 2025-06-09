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
    
    console.log('🚀 RECOMMENDATION_ENGINE: Initialized with criteria:', {
      minDelta: this.minDelta,
      minPremiumPercentage: this.minPremiumPercentage,
      minPOP: this.minPOP,
      maxPOP: this.maxPOP,
      maxDaysToExpiry: this.maxDaysToExpiry,
      minDaysToExpiry: this.minDaysToExpiry,
      maxSymbolsToProcess: this.maxSymbolsToProcess,
      minMarketCap: this.minMarketCap,
      minVolume: this.minVolume,
      minOpenInterest: this.minOpenInterest
    })
  }

  /**
   * Generate recommendations based on earnings calendar and options data
   * Now processes expanded stock universe
   * @returns {Promise<Array>} Array of recommendations
   */
  async generateRecommendations() {
    try {
      console.log('🚀 RECOMMENDATION_ENGINE: Starting recommendation generation with expanded stock universe...')
      
      // Check for cached recommendations first
      const cachedRecommendations = await this.getCachedRecommendations()
      if (cachedRecommendations.length > 0) {
        console.log(`✅ RECOMMENDATION_ENGINE: Found ${cachedRecommendations.length} cached recommendations`)
      }
      
      // Step 1: Get earnings calendar with extended date range for broader coverage
      let earningsData
      try {
        console.log('📅 RECOMMENDATION_ENGINE: Step 1 - Fetching earnings calendar...')
        earningsData = await getEarningsCalendar(null, null, true) // Use extended range
        console.log(`📊 RECOMMENDATION_ENGINE: Found ${earningsData.length} companies with upcoming earnings (expanded universe)`)
        
        if (earningsData.length > 0) {
          console.log('📊 RECOMMENDATION_ENGINE: Sample earnings data:', earningsData.slice(0, 5).map(e => ({
            symbol: e.symbol,
            date: e.date,
            epsGrowth: e.epsGrowth,
            marketCap: e.marketCap
          })))
        }
        
      } catch (error) {
        console.error('💥 RECOMMENDATION_ENGINE: Error fetching earnings data:', error)
        
        // If earnings fetch fails due to rate limits, use cached recommendations
        if (error.message.includes('rate limit') || error.message.includes('429')) {
          console.warn('⚠️ RECOMMENDATION_ENGINE: Rate limit hit, using cached recommendations')
          return cachedRecommendations
        }
        
        // For other errors, still try cached recommendations
        if (cachedRecommendations.length > 0) {
          console.warn('⚠️ RECOMMENDATION_ENGINE: Using cached recommendations due to earnings API error')
          return cachedRecommendations
        }
        
        throw error
      }
      
      if (earningsData.length === 0) {
        console.log('❌ RECOMMENDATION_ENGINE: No earnings found for the current period, using cached recommendations')
        return cachedRecommendations
      }
      
      // Step 2: Filter and prioritize symbols for processing
      console.log('🔧 RECOMMENDATION_ENGINE: Step 2 - Prioritizing symbols...')
      const prioritizedSymbols = this.prioritizeSymbols(earningsData)
      console.log(`📊 RECOMMENDATION_ENGINE: Prioritized ${prioritizedSymbols.length} symbols for options analysis`)
      
      // Step 3: Process symbols in batches to avoid overwhelming APIs
      console.log('🔧 RECOMMENDATION_ENGINE: Step 3 - Processing symbols in batches...')
      const recommendations = []
      const batchSize = 10 // Process 10 symbols at a time
      
      for (let i = 0; i < prioritizedSymbols.length; i += batchSize) {
        const batch = prioritizedSymbols.slice(i, i + batchSize)
        console.log(`🔧 RECOMMENDATION_ENGINE: Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(prioritizedSymbols.length / batchSize)} (${batch.length} symbols):`, batch)
        
        try {
          const batchRecommendations = await this.processBatch(batch, earningsData)
          recommendations.push(...batchRecommendations)
          
          console.log(`✅ RECOMMENDATION_ENGINE: Batch ${Math.floor(i / batchSize) + 1} complete: ${batchRecommendations.length} recommendations`)
          
          // Add delay between batches to respect rate limits
          if (i + batchSize < prioritizedSymbols.length) {
            const delay = 3000 + Math.random() * 2000 // 3-5 second delay
            console.log(`⏳ RECOMMENDATION_ENGINE: Waiting ${Math.round(delay)}ms before next batch...`)
            await new Promise(resolve => setTimeout(resolve, delay))
          }
          
        } catch (error) {
          console.error(`💥 RECOMMENDATION_ENGINE: Error processing batch starting at index ${i}:`, error)
          // Continue with next batch instead of failing completely
        }
      }
      
      // Step 4: Sort by confidence score and return top recommendations
      console.log('🔧 RECOMMENDATION_ENGINE: Step 4 - Sorting and finalizing recommendations...')
      const sortedRecommendations = recommendations
        .sort((a, b) => b.confidence_score - a.confidence_score)
        .slice(0, 30) // Increased from 20 to 30 recommendations
      
      console.log(`✅ RECOMMENDATION_ENGINE: Generated ${sortedRecommendations.length} new recommendations from expanded stock universe`)
      
      if (sortedRecommendations.length > 0) {
        console.log('📊 RECOMMENDATION_ENGINE: Top 5 recommendations:', sortedRecommendations.slice(0, 5).map(r => ({
          symbol: r.symbol,
          strike: r.strike_price,
          confidence: r.confidence_score,
          pop: r.pop,
          premium: r.premium
        })))
      }
      
      // Step 5: Save to database if we have new recommendations
      if (sortedRecommendations.length > 0) {
        console.log('💾 RECOMMENDATION_ENGINE: Step 5 - Saving recommendations to database...')
        await this.saveRecommendations(sortedRecommendations)
        return sortedRecommendations
      } else {
        // If no new recommendations generated, return cached ones
        console.log('⚠️ RECOMMENDATION_ENGINE: No new recommendations generated, using cached recommendations')
        return cachedRecommendations
      }
      
    } catch (error) {
      console.error('💥 RECOMMENDATION_ENGINE: Error generating recommendations:', error)
      
      // Always try to return cached recommendations as fallback
      const fallbackRecommendations = await this.getCachedRecommendations()
      if (fallbackRecommendations.length > 0) {
        console.log(`🔄 RECOMMENDATION_ENGINE: Returning ${fallbackRecommendations.length} cached recommendations as fallback`)
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
    console.log('🔧 RECOMMENDATION_ENGINE: Starting symbol prioritization...')
    
    // Filter and score symbols
    const scoredSymbols = earningsData
      .filter(earning => {
        // Basic validation
        if (!earning.symbol || earning.symbol.length < 1 || earning.symbol.length > 5) {
          console.log(`❌ RECOMMENDATION_ENGINE: Filtered out ${earning.symbol} - invalid length`)
          return false
        }
        
        // Exclude symbols with special characters (usually not optionable)
        if (earning.symbol.includes('.') || earning.symbol.includes('-') || earning.symbol.includes('/')) {
          console.log(`❌ RECOMMENDATION_ENGINE: Filtered out ${earning.symbol} - special characters`)
          return false
        }
        
        // Exclude symbols with numbers (usually not optionable)
        if (/\d/.test(earning.symbol)) {
          console.log(`❌ RECOMMENDATION_ENGINE: Filtered out ${earning.symbol} - contains numbers`)
          return false
        }
        
        // Market cap filter (if available)
        if (earning.marketCap && earning.marketCap < this.minMarketCap) {
          console.log(`❌ RECOMMENDATION_ENGINE: Filtered out ${earning.symbol} - market cap too low: ${earning.marketCap}`)
          return false
        }
        
        console.log(`✅ RECOMMENDATION_ENGINE: ${earning.symbol} passed basic filtering`)
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
        
        console.log(`📊 RECOMMENDATION_ENGINE: Scored ${earning.symbol}: ${score.toFixed(1)}`)
        
        return {
          symbol: earning.symbol,
          score: score,
          earning: earning
        }
      })
      .sort((a, b) => b.score - a.score) // Sort by score descending
      .slice(0, this.maxSymbolsToProcess) // Take top N symbols
    
    console.log(`📊 RECOMMENDATION_ENGINE: Symbol prioritization complete. Top 10 symbols:`)
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
    console.log(`🔧 RECOMMENDATION_ENGINE: Processing batch of ${symbols.length} symbols:`, symbols)
    
    const recommendations = []
    
    try {
      // Get options data for the batch
      console.log('📊 RECOMMENDATION_ENGINE: Fetching options data for batch...')
      const optionsData = await getMultipleOptionsChains(symbols)
      
      console.log(`📊 RECOMMENDATION_ENGINE: Options data received:`, {
        successCount: Object.keys(optionsData.results).length,
        errorCount: optionsData.errors.length,
        successSymbols: Object.keys(optionsData.results),
        errorSymbols: optionsData.errors.map(e => e.symbol)
      })
      
      // Process each symbol in the batch
      for (const symbol of symbols) {
        try {
          console.log(`🔧 RECOMMENDATION_ENGINE: Processing ${symbol}...`)
          
          const earnings = earningsData.find(e => e.symbol === symbol)
          const options = optionsData.results[symbol]
          
          if (!earnings) {
            console.log(`❌ RECOMMENDATION_ENGINE: Skipping ${symbol} - no earnings data`)
            continue
          }
          
          if (!options || !options.options) {
            console.log(`❌ RECOMMENDATION_ENGINE: Skipping ${symbol} - no options data`)
            continue
          }
          
          console.log(`📊 RECOMMENDATION_ENGINE: ${symbol} has ${options.options.length} options to analyze`)
          
          const symbolRecommendations = await this.processSymbol(symbol, earnings, options)
          recommendations.push(...symbolRecommendations)
          
          console.log(`✅ RECOMMENDATION_ENGINE: ${symbol} generated ${symbolRecommendations.length} recommendations`)
          
        } catch (error) {
          console.error(`💥 RECOMMENDATION_ENGINE: Error processing ${symbol}:`, error)
        }
      }
      
    } catch (error) {
      console.error('💥 RECOMMENDATION_ENGINE: Error processing batch:', error)
    }
    
    console.log(`✅ RECOMMENDATION_ENGINE: Batch processing complete: ${recommendations.length} total recommendations`)
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
    console.log(`🔧 RECOMMENDATION_ENGINE: Processing symbol ${symbol}`)
    
    const recommendations = []
    const stockPrice = options.underlyingPrice
    
    if (!stockPrice || stockPrice <= 0) {
      console.log(`❌ RECOMMENDATION_ENGINE: Skipping ${symbol} - invalid stock price: ${stockPrice}`)
      return recommendations
    }
    
    console.log(`📈 RECOMMENDATION_ENGINE: Processing ${symbol}: stock price $${stockPrice}, ${options.options.length} options`)
    
    let optionsAnalyzed = 0
    let optionsPassedBasic = 0
    let optionsPassedPOP = 0
    
    for (const option of options.options) {
      try {
        optionsAnalyzed++
        
        // Filter by basic criteria (same rigorous filtering as before)
        if (!this.meetsBasicCriteria(option, stockPrice, earnings.date)) {
          console.log(`❌ RECOMMENDATION_ENGINE: ${symbol} option (strike: ${option.strike}, exp: ${option.expiration}) failed basic criteria`)
          continue
        }
        
        optionsPassedBasic++
        console.log(`✅ RECOMMENDATION_ENGINE: ${symbol} option (strike: ${option.strike}) passed basic criteria`)
        
        // Calculate additional metrics
        const timeToExpiry = calculateTimeToExpiry(option.expiration)
        const pop = calculatePOP(
          stockPrice,
          option.strike,
          timeToExpiry,
          0.05, // Risk-free rate
          option.impliedVolatility
        )
        
        console.log(`📊 RECOMMENDATION_ENGINE: ${symbol} option POP calculation: ${pop.toFixed(1)}% (target: ${this.minPOP}-${this.maxPOP}%)`)
        
        // Check if POP is within target range (same criteria)
        if (pop < this.minPOP || pop > this.maxPOP) {
          console.log(`❌ RECOMMENDATION_ENGINE: ${symbol} option failed POP criteria: ${pop.toFixed(1)}%`)
          continue
        }
        
        optionsPassedPOP++
        
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
        
        console.log(`📊 RECOMMENDATION_ENGINE: ${symbol} option confidence score: ${confidenceScore.toFixed(1)}%`)
        
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
        
        console.log(`✅ RECOMMENDATION_ENGINE: Created recommendation for ${symbol}:`, {
          strike: recommendation.strike_price,
          premium: recommendation.premium,
          confidence: recommendation.confidence_score,
          pop: recommendation.pop
        })
        
        recommendations.push(recommendation)
        
      } catch (error) {
        console.error(`💥 RECOMMENDATION_ENGINE: Error processing option for ${symbol}:`, error)
      }
    }
    
    console.log(`📊 RECOMMENDATION_ENGINE: ${symbol} filtering summary:`, {
      optionsAnalyzed,
      optionsPassedBasic,
      optionsPassedPOP,
      finalRecommendations: recommendations.length
    })
    
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
      console.log(`❌ RECOMMENDATION_ENGINE: Delta too high: ${Math.abs(option.delta)} > ${this.minDelta}`)
      return false
    }
    
    // Check premium percentage (same criteria)
    const premiumPercentage = calculatePremiumPercentage(option.premium, stockPrice)
    if (premiumPercentage < this.minPremiumPercentage) {
      console.log(`❌ RECOMMENDATION_ENGINE: Premium percentage too low: ${premiumPercentage.toFixed(2)}% < ${this.minPremiumPercentage}%`)
      return false
    }
    
    // Check days to expiration (same criteria)
    const daysToExpiry = Math.ceil(
      (new Date(option.expiration) - new Date()) / (1000 * 60 * 60 * 24)
    )
    
    if (daysToExpiry < this.minDaysToExpiry || daysToExpiry > this.maxDaysToExpiry) {
      console.log(`❌ RECOMMENDATION_ENGINE: Days to expiry out of range: ${daysToExpiry} (range: ${this.minDaysToExpiry}-${this.maxDaysToExpiry})`)
      return false
    }
    
    // Check if expiration is after earnings (same criteria)
    const expiryDate = new Date(option.expiration)
    const earningsDateObj = new Date(earningsDate)
    
    if (expiryDate <= earningsDateObj) {
      console.log(`❌ RECOMMENDATION_ENGINE: Expiration before earnings: ${option.expiration} <= ${earningsDate}`)
      return false
    }
    
    // Check minimum volume and open interest (same criteria)
    if (option.volume < this.minVolume || option.openInterest < this.minOpenInterest) {
      console.log(`❌ RECOMMENDATION_ENGINE: Volume/OI too low: vol=${option.volume} (min=${this.minVolume}), OI=${option.openInterest} (min=${this.minOpenInterest})`)
      return false
    }
    
    // Check if premium is reasonable (same criteria)
    if (option.premium <= 0 || option.premium > stockPrice * 0.1) {
      console.log(`❌ RECOMMENDATION_ENGINE: Premium unreasonable: ${option.premium} (stock: ${stockPrice})`)
      return false
    }
    
    console.log(`✅ RECOMMENDATION_ENGINE: Option passed all basic criteria`)
    return true
  }

  /**
   * Get cached recommendations from database
   * @returns {Promise<Array>} Cached recommendations
   */
  async getCachedRecommendations() {
    try {
      console.log('🔍 RECOMMENDATION_ENGINE: Fetching cached recommendations from database...')
      
      const { data, error } = await supabase
        .from('recommendations')
        .select('*')
        .eq('is_active', true)
        .order('confidence_score', { ascending: false })
        .limit(30) // Increased from 20 to 30
      
      if (error) {
        console.warn('⚠️ RECOMMENDATION_ENGINE: Error fetching cached recommendations:', error)
        return []
      }
      
      console.log(`✅ RECOMMENDATION_ENGINE: Found ${data?.length || 0} cached recommendations`)
      return data || []
      
    } catch (error) {
      console.error('💥 RECOMMENDATION_ENGINE: Error fetching cached recommendations:', error)
      return []
    }
  }

  /**
   * Save recommendations to database with enhanced error handling
   * @param {Array} recommendations - Array of recommendations
   */
  async saveRecommendations(recommendations) {
    try {
      console.log(`💾 RECOMMENDATION_ENGINE: Saving ${recommendations.length} recommendations to database...`)
      
      // First, mark all existing recommendations as inactive
      const { error: updateError } = await supabase
        .from('recommendations')
        .update({ is_active: false })
        .eq('is_active', true)
      
      if (updateError) {
        console.warn('⚠️ RECOMMENDATION_ENGINE: Error deactivating old recommendations:', updateError)
      } else {
        console.log('✅ RECOMMENDATION_ENGINE: Deactivated old recommendations')
      }
      
      // Insert new recommendations
      if (recommendations.length > 0) {
        const { error: insertError } = await supabase
          .from('recommendations')
          .insert(recommendations)
        
        if (insertError) {
          console.error('💥 RECOMMENDATION_ENGINE: Error saving recommendations:', insertError)
          throw insertError
        }
        
        console.log(`✅ RECOMMENDATION_ENGINE: Saved ${recommendations.length} recommendations to database`)
        
        // Cache the recommendations as well
        await setCachedData('latest_recommendations', recommendations, 60) // Cache for 1 hour
        console.log('✅ RECOMMENDATION_ENGINE: Cached recommendations for 1 hour')
      }
      
    } catch (error) {
      console.error('💥 RECOMMENDATION_ENGINE: Error saving recommendations to database:', error)
      
      // Even if database save fails, cache the recommendations
      try {
        await setCachedData('latest_recommendations', recommendations, 60)
        console.log('✅ RECOMMENDATION_ENGINE: Cached recommendations despite database error')
      } catch (cacheError) {
        console.error('💥 RECOMMENDATION_ENGINE: Failed to cache recommendations:', cacheError)
      }
      
      throw error
    }
  }

  /**
   * Update filtering criteria
   * @param {Object} criteria - New criteria
   */
  updateCriteria(criteria) {
    console.log('🔧 RECOMMENDATION_ENGINE: Updating filtering criteria:', criteria)
    
    if (criteria.minDelta !== undefined) this.minDelta = criteria.minDelta
    if (criteria.minPremiumPercentage !== undefined) this.minPremiumPercentage = criteria.minPremiumPercentage
    if (criteria.minPOP !== undefined) this.minPOP = criteria.minPOP
    if (criteria.maxPOP !== undefined) this.maxPOP = criteria.maxPOP
    if (criteria.maxDaysToExpiry !== undefined) this.maxDaysToExpiry = criteria.maxDaysToExpiry
    if (criteria.minDaysToExpiry !== undefined) this.minDaysToExpiry = criteria.minDaysToExpiry
    if (criteria.maxSymbolsToProcess !== undefined) this.maxSymbolsToProcess = criteria.maxSymbolsToProcess
    if (criteria.minMarketCap !== undefined) this.minMarketCap = criteria.minMarketCap
    
    console.log('✅ RECOMMENDATION_ENGINE: Updated filtering criteria for expanded stock universe:', {
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