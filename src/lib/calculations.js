/**
 * Mathematical calculations for options trading
 */

/**
 * Normal cumulative distribution function approximation
 * @param {number} x - Input value
 * @returns {number} CDF value
 */
function normalCDF(x) {
  return 0.5 * (1 + erf(x / Math.sqrt(2)))
}

/**
 * Error function approximation (Abramowitz and Stegun)
 * @param {number} x - Input value
 * @returns {number} Error function value
 */
function erf(x) {
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911

  const sign = x >= 0 ? 1 : -1
  x = Math.abs(x)

  const t = 1.0 / (1.0 + p * x)
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)

  return sign * y
}

/**
 * Calculate Probability of Profit for put options using Black-Scholes
 * @param {number} stockPrice - Current stock price
 * @param {number} strikePrice - Option strike price
 * @param {number} timeToExpiry - Time to expiration in years
 * @param {number} riskFreeRate - Risk-free interest rate (default 0.05)
 * @param {number} impliedVolatility - Implied volatility
 * @returns {number} Probability of profit as percentage
 */
export function calculatePOP(stockPrice, strikePrice, timeToExpiry, riskFreeRate = 0.05, impliedVolatility) {
  if (timeToExpiry <= 0 || impliedVolatility <= 0) {
    return 0
  }

  const d2 = (Math.log(stockPrice / strikePrice) + 
             (riskFreeRate - 0.5 * Math.pow(impliedVolatility, 2)) * timeToExpiry) /
             (impliedVolatility * Math.sqrt(timeToExpiry))
  
  // For put options, POP is the probability that stock price stays above strike
  return normalCDF(d2) * 100
}

/**
 * Calculate confidence score based on multiple factors
 * @param {number} impliedVol - Implied volatility (0-1)
 * @param {number} openInterest - Open interest
 * @param {number} volume - Daily volume
 * @param {number} epsGrowth - EPS growth percentage
 * @param {number} pop - Probability of profit
 * @param {number} premiumPct - Premium as percentage of stock price
 * @returns {number} Confidence score (0-100)
 */
export function calculateConfidenceScore(impliedVol, openInterest, volume, epsGrowth, pop, premiumPct) {
  // IV Score: Lower IV is better (less uncertainty)
  const ivScore = Math.max(0, 100 - (impliedVol * 200))
  
  // Open Interest Score: Higher OI is better (more liquidity)
  const oiScore = Math.min(100, Math.log10(Math.max(1, openInterest)) * 25)
  
  // Volume Score: Higher volume is better (more activity)
  const volumeScore = Math.min(100, Math.log10(Math.max(1, volume)) * 20)
  
  // EPS Growth Score: Positive growth is better
  const epsScore = Math.max(0, Math.min(100, (epsGrowth + 50) * 1.33))
  
  // POP Score: Higher probability is better
  const popScore = Math.max(0, Math.min(100, pop))
  
  // Premium Score: Higher premium percentage is better (more income)
  const premiumScore = Math.min(100, premiumPct * 20)
  
  // Weighted average
  const confidence = (
    ivScore * 0.25 + 
    oiScore * 0.20 + 
    volumeScore * 0.20 + 
    epsScore * 0.15 + 
    popScore * 0.10 + 
    premiumScore * 0.10
  )
  
  return Math.max(0, Math.min(100, confidence))
}

/**
 * Calculate time to expiration in years
 * @param {string} expirationDate - Expiration date string
 * @returns {number} Time to expiration in years
 */
export function calculateTimeToExpiry(expirationDate) {
  const now = new Date()
  const expiry = new Date(expirationDate)
  const diffMs = expiry.getTime() - now.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  return Math.max(0, diffDays / 365.25)
}

/**
 * Calculate breakeven price for put option
 * @param {number} strikePrice - Strike price
 * @param {number} premium - Option premium
 * @returns {number} Breakeven price
 */
export function calculateBreakeven(strikePrice, premium) {
  return strikePrice - premium
}

/**
 * Calculate maximum loss for put option
 * @param {number} strikePrice - Strike price
 * @param {number} premium - Option premium received
 * @returns {number} Maximum loss
 */
export function calculateMaxLoss(strikePrice, premium) {
  return (strikePrice - premium) * 100 // Per contract (100 shares)
}

/**
 * Calculate premium as percentage of stock price
 * @param {number} premium - Option premium
 * @param {number} stockPrice - Current stock price
 * @returns {number} Premium percentage
 */
export function calculatePremiumPercentage(premium, stockPrice) {
  if (stockPrice <= 0) return 0
  return (premium / stockPrice) * 100
}