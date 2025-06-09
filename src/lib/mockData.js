/**
 * Mock data for development and testing
 * This prevents excessive API calls during development
 */

export const mockEarningsData = [
  {
    symbol: 'AAPL',
    date: '2024-01-25',
    eps: 2.18,
    epsEstimated: 2.10,
    revenue: 119.58,
    revenueEstimated: 117.91
  },
  {
    symbol: 'MSFT',
    date: '2024-01-24',
    eps: 2.93,
    epsEstimated: 2.78,
    revenue: 62.02,
    revenueEstimated: 61.12
  },
  {
    symbol: 'GOOGL',
    date: '2024-01-30',
    eps: 1.64,
    epsEstimated: 1.59,
    revenue: 80.54,
    revenueEstimated: 79.13
  },
  {
    symbol: 'TSLA',
    date: '2024-01-24',
    eps: 0.71,
    epsEstimated: 0.73,
    revenue: 25.17,
    revenueEstimated: 25.87
  },
  {
    symbol: 'NVDA',
    date: '2024-02-21',
    eps: 5.16,
    epsEstimated: 4.64,
    revenue: 60.92,
    revenueEstimated: 57.97
  }
]

export const mockOptionsData = {
  'AAPL': {
    underlyingPrice: 185.64,
    options: [
      {
        strike: 180,
        expiration: '2024-02-02',
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
        expiration: '2024-02-02',
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
        expiration: '2024-02-09',
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
        expiration: '2024-02-02',
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
        expiration: '2024-02-09',
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
        expiration: '2024-02-02',
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
        expiration: '2024-02-09',
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
  }
}

export const mockRecommendations = [
  {
    id: 1,
    symbol: 'AAPL',
    strike_price: 180.00,
    expiration_date: '2024-02-02',
    premium: 2.20,
    confidence_score: 87.5,
    pop: 89.2,
    delta: -0.18,
    implied_volatility: 0.28,
    premium_percentage: 4.2,
    max_loss: 1780.00,
    breakeven: 177.80,
    earnings_date: '2024-01-25',
    created_at: new Date().toISOString(),
    is_active: true
  },
  {
    id: 2,
    symbol: 'MSFT',
    strike_price: 395.00,
    expiration_date: '2024-02-02',
    premium: 8.30,
    confidence_score: 82.1,
    pop: 85.7,
    delta: -0.19,
    implied_volatility: 0.31,
    premium_percentage: 3.8,
    max_loss: 3867.00,
    breakeven: 386.70,
    earnings_date: '2024-01-24',
    created_at: new Date().toISOString(),
    is_active: true
  },
  {
    id: 3,
    symbol: 'TSLA',
    strike_price: 200.00,
    expiration_date: '2024-02-02',
    premium: 4.95,
    confidence_score: 78.9,
    pop: 84.3,
    delta: -0.16,
    implied_volatility: 0.45,
    premium_percentage: 4.1,
    max_loss: 1950.50,
    breakeven: 195.05,
    earnings_date: '2024-01-24',
    created_at: new Date().toISOString(),
    is_active: true
  }
]

/**
 * Simulates API delay for realistic testing
 * @param {number} ms - Delay in milliseconds
 */
export function simulateDelay(ms = 1000) {
  return new Promise(resolve => setTimeout(resolve, ms))
}