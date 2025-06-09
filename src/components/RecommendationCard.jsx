import { useState } from 'react'

export default function RecommendationCard({ recommendation }) {
  const [showDetails, setShowDetails] = useState(false)
  
  const getConfidenceColor = (score) => {
    if (score >= 80) return 'bg-green-900/30 text-green-300 border-green-500/30'
    if (score >= 60) return 'bg-yellow-900/30 text-yellow-300 border-yellow-500/30'
    return 'bg-red-900/30 text-red-300 border-red-500/30'
  }

  const getConfidenceLabel = (score) => {
    if (score >= 80) return 'High'
    if (score >= 60) return 'Moderate'
    return 'Low'
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value)
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const daysToExpiration = Math.ceil(
    (new Date(recommendation.expiration_date) - new Date()) / (1000 * 60 * 60 * 24)
  )

  return (
    <div className="card-dark rounded-lg hover:shadow-dark-lg transition-all duration-300">
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-bold text-white">{recommendation.symbol}</h3>
            <p className="text-dark-300">Strike: {formatCurrency(recommendation.strike_price)}</p>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium border backdrop-blur-sm ${getConfidenceColor(recommendation.confidence_score)}`}>
            {getConfidenceLabel(recommendation.confidence_score)}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="space-y-3 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-dark-300 text-sm">Premium:</span>
            <span className="font-semibold text-white">{formatCurrency(recommendation.premium)}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-dark-300 text-sm">Confidence Score:</span>
            <span className="font-semibold text-white">{recommendation.confidence_score.toFixed(1)}%</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-dark-300 text-sm">Probability of Profit:</span>
            <span className="font-semibold text-green-400">{recommendation.pop.toFixed(1)}%</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-dark-300 text-sm">Delta:</span>
            <span className="font-semibold text-white">{recommendation.delta.toFixed(3)}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-dark-300 text-sm">Premium %:</span>
            <span className="font-semibold text-white">{recommendation.premium_percentage.toFixed(2)}%</span>
          </div>
        </div>

        {/* Expiration Info */}
        <div className="bg-dark-800/50 rounded-lg p-3 mb-4 border border-dark-600">
          <div className="flex justify-between items-center text-sm">
            <span className="text-dark-300">Expires:</span>
            <span className="font-medium text-white">{formatDate(recommendation.expiration_date)}</span>
          </div>
          <div className="flex justify-between items-center text-sm mt-1">
            <span className="text-dark-300">Days to expiry:</span>
            <span className={`font-medium ${daysToExpiration <= 7 ? 'text-red-400' : 'text-white'}`}>
              {daysToExpiration} days
            </span>
          </div>
        </div>

        {/* Risk Metrics */}
        <div className="border-t border-dark-600 pt-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-dark-300 block">Max Loss:</span>
              <span className="font-semibold text-red-400">{formatCurrency(recommendation.max_loss)}</span>
            </div>
            <div>
              <span className="text-dark-300 block">Breakeven:</span>
              <span className="font-semibold text-white">{formatCurrency(recommendation.breakeven)}</span>
            </div>
          </div>
        </div>

        {/* Earnings Date */}
        {recommendation.earnings_date && (
          <div className="mt-4 pt-4 border-t border-dark-600">
            <div className="flex items-center text-sm">
              <svg className="w-4 h-4 text-dark-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-dark-300">Earnings: </span>
              <span className="font-medium text-white ml-1">{formatDate(recommendation.earnings_date)}</span>
            </div>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full mt-4 bg-gradient-to-r from-primary-600 to-primary-700 text-white py-2 px-4 rounded-lg hover:from-primary-700 hover:to-primary-800 transition-all duration-200 text-sm font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
        >
          {showDetails ? 'Hide Details' : 'View Details'}
        </button>

        {/* Detailed Information */}
        {showDetails && (
          <div className="mt-4 pt-4 border-t border-dark-600 space-y-3">
            <h4 className="font-semibold text-white text-sm">Additional Metrics</h4>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-dark-300 block">Implied Volatility:</span>
                <span className="font-medium text-white">{(recommendation.implied_volatility * 100).toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-dark-300 block">Created:</span>
                <span className="font-medium text-white">
                  {new Date(recommendation.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3 mt-4 backdrop-blur-sm">
              <p className="text-yellow-200 text-xs">
                <strong>Risk Warning:</strong> This is not investment advice. Options trading involves substantial risk. 
                Please conduct your own research and consult with a financial advisor before making any trading decisions.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}