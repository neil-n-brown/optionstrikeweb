import { useState } from 'react'

export default function RecommendationCard({ recommendation }) {
  const [showDetails, setShowDetails] = useState(false)
  
  const getConfidenceColor = (score) => {
    if (score >= 80) return 'bg-green-100 text-green-800 border-green-200'
    if (score >= 60) return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    return 'bg-red-100 text-red-800 border-red-200'
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
    <div className="bg-white rounded-lg shadow-sm border border-corporate-200 hover:shadow-md transition-shadow">
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-bold text-corporate-900">{recommendation.symbol}</h3>
            <p className="text-corporate-600">Strike: {formatCurrency(recommendation.strike_price)}</p>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium border ${getConfidenceColor(recommendation.confidence_score)}`}>
            {getConfidenceLabel(recommendation.confidence_score)}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="space-y-3 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-corporate-600 text-sm">Premium:</span>
            <span className="font-semibold text-corporate-900">{formatCurrency(recommendation.premium)}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-corporate-600 text-sm">Confidence Score:</span>
            <span className="font-semibold text-corporate-900">{recommendation.confidence_score.toFixed(1)}%</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-corporate-600 text-sm">Probability of Profit:</span>
            <span className="font-semibold text-green-600">{recommendation.pop.toFixed(1)}%</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-corporate-600 text-sm">Delta:</span>
            <span className="font-semibold text-corporate-900">{recommendation.delta.toFixed(3)}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-corporate-600 text-sm">Premium %:</span>
            <span className="font-semibold text-corporate-900">{recommendation.premium_percentage.toFixed(2)}%</span>
          </div>
        </div>

        {/* Expiration Info */}
        <div className="bg-corporate-50 rounded-lg p-3 mb-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-corporate-600">Expires:</span>
            <span className="font-medium text-corporate-900">{formatDate(recommendation.expiration_date)}</span>
          </div>
          <div className="flex justify-between items-center text-sm mt-1">
            <span className="text-corporate-600">Days to expiry:</span>
            <span className={`font-medium ${daysToExpiration <= 7 ? 'text-red-600' : 'text-corporate-900'}`}>
              {daysToExpiration} days
            </span>
          </div>
        </div>

        {/* Risk Metrics */}
        <div className="border-t border-corporate-200 pt-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-corporate-600 block">Max Loss:</span>
              <span className="font-semibold text-red-600">{formatCurrency(recommendation.max_loss)}</span>
            </div>
            <div>
              <span className="text-corporate-600 block">Breakeven:</span>
              <span className="font-semibold text-corporate-900">{formatCurrency(recommendation.breakeven)}</span>
            </div>
          </div>
        </div>

        {/* Earnings Date */}
        {recommendation.earnings_date && (
          <div className="mt-4 pt-4 border-t border-corporate-200">
            <div className="flex items-center text-sm">
              <svg className="w-4 h-4 text-corporate-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 002 2z" />
              </svg>
              <span className="text-corporate-600">Earnings: </span>
              <span className="font-medium text-corporate-900 ml-1">{formatDate(recommendation.earnings_date)}</span>
            </div>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full mt-4 bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
        >
          {showDetails ? 'Hide Details' : 'View Details'}
        </button>

        {/* Detailed Information */}
        {showDetails && (
          <div className="mt-4 pt-4 border-t border-corporate-200 space-y-3">
            <h4 className="font-semibold text-corporate-900 text-sm">Additional Metrics</h4>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-corporate-600 block">Implied Volatility:</span>
                <span className="font-medium text-corporate-900">{(recommendation.implied_volatility * 100).toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-corporate-600 block">Created:</span>
                <span className="font-medium text-corporate-900">
                  {new Date(recommendation.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-4">
              <p className="text-yellow-800 text-xs">
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