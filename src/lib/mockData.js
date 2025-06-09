/**
 * Mock data for development and testing
 * Updated with current dates (June 2025)
 */

export const mockEarningsData = [
  {
    symbol: 'AAPL',
    date: '2025-06-25',
    eps: 2.18,
    epsEstimated: 2.10,
    revenue: 119.58,
    revenueEstimated: 117.91,
    epsGrowth: 8.5,
    marketCap: 3000000000000,
    time: 'amc'
  },
  {
    symbol: 'MSFT',
    date: '2025-06-24',
    eps: 2.93,
    epsEstimated: 2.78,
    revenue: 62.02,
    revenueEstimated: 61.12,
    epsGrowth: 12.3,
    marketCap: 2800000000000,
    time: 'bmo'
  },
  {
    symbol: 'GOOGL',
    date: '2025-06-30',
    eps: 1.64,
    epsEstimated: 1.59,
    revenue: 80.54,
    revenueEstimated: 79.13,
    epsGrowth: 15.7,
    marketCap: 1800000000000,
    time: 'amc'
  },
  {
    symbol: 'TSLA',
    date: '2025-06-26',
    eps: 0.71,
    epsEstimated: 0.73,
    revenue: 25.17,
    revenueEstimated: 25.87,
    epsGrowth: -5.2,
    marketCap: 800000000000,
    time: 'amc'
  },
  {
    symbol: 'NVDA',
    date: '2025-06-28',
    eps: 5.16,
    epsEstimated: 4.64,
    revenue: 60.92,
    revenueEstimated: 57.97,
    epsGrowth: 45.8,
    marketCap: 2200000000000,
    time: 'amc'
  },
  {
    symbol: 'META',
    date: '2025-06-27',
    eps: 3.85,
    epsEstimated: 3.72,
    revenue: 36.45,
    revenueEstimated: 35.89,
    epsGrowth: 22.1,
    marketCap: 1200000000000,
    time: 'amc'
  },
  {
    symbol: 'AMZN',
    date: '2025-06-29',
    eps: 1.12,
    epsEstimated: 1.05,
    revenue: 143.31,
    revenueEstimated: 142.45,
    epsGrowth: 18.9,
    marketCap: 1500000000000,
    time: 'amc'
  },
  {
    symbol: 'NFLX',
    date: '2025-06-23',
    eps: 4.88,
    epsEstimated: 4.75,
    revenue: 8.54,
    revenueEstimated: 8.42,
    epsGrowth: 9.7,
    marketCap: 180000000000,
    time: 'amc'
  },
  {
    symbol: 'CRM',
    date: '2025-06-25',
    eps: 2.44,
    epsEstimated: 2.38,
    revenue: 9.13,
    revenueEstimated: 9.01,
    epsGrowth: 14.2,
    marketCap: 250000000000,
    time: 'amc'
  },
  {
    symbol: 'ADBE',
    date: '2025-06-26',
    eps: 3.91,
    epsEstimated: 3.85,
    revenue: 5.05,
    revenueEstimated: 4.98,
    epsGrowth: 11.8,
    marketCap: 220000000000,
    time: 'amc'
  }
]

export const mockOptionsData = {
  'AAPL': {
    underlyingPrice: 185.64,
    options: [
      {
        strike: 180,
        expiration: '2025-07-04',
        type: 'put',
        bid: 2.15,
        ask: 2.25,
        premium: 2.20,
        delta: -0.18,
        impliedVolatility: 0.28,
        volume: 1250,
        openInterest: 3420
      },
      {
        strike: 175,
        expiration: '2025-07-04',
        type: 'put',
        bid: 1.45,
        ask: 1.55,
        premium: 1.50,
        delta: -0.12,
        impliedVolatility: 0.26,
        volume: 890,
        openInterest: 2180
      },
      {
        strike: 170,
        expiration: '2025-07-11',
        type: 'put',
        bid: 1.85,
        ask: 1.95,
        premium: 1.90,
        delta: -0.15,
        impliedVolatility: 0.29,
        volume: 1560,
        openInterest: 4230
      }
    ]
  },
  'MSFT': {
    underlyingPrice: 402.56,
    options: [
      {
        strike: 395,
        expiration: '2025-07-04',
        type: 'put',
        bid: 8.20,
        ask: 8.40,
        premium: 8.30,
        delta: -0.19,
        impliedVolatility: 0.31,
        volume: 780,
        openInterest: 1890
      },
      {
        strike: 390,
        expiration: '2025-07-11',
        type: 'put',
        bid: 9.15,
        ask: 9.35,
        premium: 9.25,
        delta: -0.17,
        impliedVolatility: 0.30,
        volume: 1120,
        openInterest: 2650
      }
    ]
  },
  'TSLA': {
    underlyingPrice: 207.83,
    options: [
      {
        strike: 200,
        expiration: '2025-07-04',
        type: 'put',
        bid: 4.85,
        ask: 5.05,
        premium: 4.95,
        delta: -0.16,
        impliedVolatility: 0.45,
        volume: 2340,
        openInterest: 5670
      },
      {
        strike: 195,
        expiration: '2025-07-11',
        type: 'put',
        bid: 5.20,
        ask: 5.40,
        premium: 5.30,
        delta: -0.14,
        impliedVolatility: 0.43,
        volume: 1890,
        openInterest: 4120
      }
    ]
  },
  'GOOGL': {
    underlyingPrice: 142.35,
    options: [
      {
        strike: 140,
        expiration: '2025-07-04',
        type: 'put',
        bid: 3.25,
        ask: 3.45,
        premium: 3.35,
        delta: -0.17,
        impliedVolatility: 0.32,
        volume: 980,
        openInterest: 2340
      }
    ]
  },
  'NVDA': {
    underlyingPrice: 125.89,
    options: [
      {
        strike: 120,
        expiration: '2025-07-04',
        type: 'put',
        bid: 2.85,
        ask: 3.05,
        premium: 2.95,
        delta: -0.16,
        impliedVolatility: 0.48,
        volume: 3450,
        openInterest: 8920
      }
    ]
  }
}

export const mockRecommendations = [
  {
    id: 1,
    symbol: 'AAPL',
    strike_price: 180.00,
    expiration_date: '2025-07-04',
    premium: 2.20,
    confidence_score: 87.5,
    pop: 89.2,
    delta: -0.18,
    implied_volatility: 0.28,
    premium_percentage: 4.2,
    max_loss: 1780.00,
    breakeven: 177.80,
    earnings_date: '2025-06-25',
    created_at: new Date().toISOString(),
    is_active: true
  },
  {
    id: 2,
    symbol: 'MSFT',
    strike_price: 395.00,
    expiration_date: '2025-07-04',
    premium: 8.30,
    confidence_score: 82.1,
    pop: 85.7,
    delta: -0.19,
    implied_volatility: 0.31,
    premium_percentage: 3.8,
    max_loss: 3867.00,
    breakeven: 386.70,
    earnings_date: '2025-06-24',
    created_at: new Date().toISOString(),
    is_active: true
  },
  {
    id: 3,
    symbol: 'TSLA',
    strike_price: 200.00,
    expiration_date: '2025-07-04',
    premium: 4.95,
    confidence_score: 78.9,
    pop: 84.3,
    delta: -0.16,
    implied_volatility: 0.45,
    premium_percentage: 4.1,
    max_loss: 1950.50,
    breakeven: 195.05,
    earnings_date: '2025-06-26',
    created_at: new Date().toISOString(),
    is_active: true
  }
]

/**
 * Simulates API delay for realistic testing
 * @param {number} ms - Delay in milliseconds
 */
export function simulateDelay(ms = 1000) {
  console.log(`🕐 MOCK: Simulating ${ms}ms delay...`)
  return new Promise(resolve => setTimeout(resolve, ms))
}