import { useState } from 'react'

export default function CacheManager({ cacheStats, onClearCache, clearingCache, onRefreshStats }) {
  const [showDetails, setShowDetails] = useState(false)

  const formatCacheSize = (count) => {
    if (!count) return '0'
    if (count < 1000) return count.toString()
    if (count < 1000000) return `${(count / 1000).toFixed(1)}K`
    return `${(count / 1000000).toFixed(1)}M`
  }

  const getCacheHealthColor = () => {
    if (!cacheStats) return 'text-corporate-500'
    if (cacheStats.expired > cacheStats.active) return 'text-yellow-600'
    if (cacheStats.total > 1000) return 'text-yellow-600'
    return 'text-green-600'
  }

  const getCacheHealthStatus = () => {
    if (!cacheStats) return 'Unknown'
    if (cacheStats.expired > cacheStats.active) return 'Needs Cleanup'
    if (cacheStats.total > 1000) return 'Large Cache'
    return 'Healthy'
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center space-x-2 text-sm text-corporate-600 hover:text-corporate-700 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
        </svg>
        <span>Cache</span>
        {cacheStats && (
          <span className={`text-xs px-2 py-1 rounded-full ${
            getCacheHealthColor() === 'text-green-600' ? 'bg-green-100 text-green-800' :
            getCacheHealthColor() === 'text-yellow-600' ? 'bg-yellow-100 text-yellow-800' :
            'bg-corporate-100 text-corporate-800'
          }`}>
            {formatCacheSize(cacheStats.total)}
          </span>
        )}
      </button>

      {showDetails && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-lg border border-corporate-200 p-4 z-50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-corporate-900">Cache Management</h3>
            <button
              onClick={() => setShowDetails(false)}
              className="text-corporate-400 hover:text-corporate-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {cacheStats ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="text-center">
                  <div className="text-lg font-semibold text-corporate-900">{cacheStats.total}</div>
                  <div className="text-xs text-corporate-600">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-green-600">{cacheStats.active}</div>
                  <div className="text-xs text-corporate-600">Active</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-red-600">{cacheStats.expired}</div>
                  <div className="text-xs text-corporate-600">Expired</div>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-corporate-600">Status:</span>
                <span className={`font-medium ${getCacheHealthColor()}`}>
                  {getCacheHealthStatus()}
                </span>
              </div>

              <div className="border-t border-corporate-200 pt-3 space-y-2">
                <button
                  onClick={onRefreshStats}
                  className="w-full text-sm bg-corporate-100 text-corporate-700 px-3 py-2 rounded hover:bg-corporate-200 transition-colors"
                >
                  Refresh Stats
                </button>
                
                <button
                  onClick={onClearCache}
                  disabled={clearingCache}
                  className="w-full text-sm bg-red-100 text-red-700 px-3 py-2 rounded hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {clearingCache ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-3 h-3 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>Clearing...</span>
                    </div>
                  ) : (
                    'Clear All Cache'
                  )}
                </button>
              </div>

              <div className="text-xs text-corporate-500 mt-2">
                <p>Cache stores API responses to reduce external calls and improve performance.</p>
                <p className="mt-1">Clear cache if you're experiencing stale data issues.</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="text-sm text-corporate-500">Loading cache statistics...</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}