import { useState, useEffect } from 'react'
import { supabase, testConnection } from '../lib/supabase'
import { checkPolygonAPIHealth } from '../lib/polygon'
import { checkFMPAPIHealth } from '../lib/earnings'
import { recommendationEngine } from '../lib/recommendationEngine'
import { mockRecommendations } from '../lib/mockData'
import { clearAllCache, getCacheStats } from '../lib/cache'
import RecommendationCard from './RecommendationCard'
import SystemStatus from './SystemStatus'
import Disclaimer from './Disclaimer'
import LoadingSpinner from './LoadingSpinner'
import ErrorBoundary from './ErrorBoundary'
import ModeToggle from './ModeToggle'
import CacheManager from './CacheManager'

export default function Dashboard() {
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [rateLimited, setRateLimited] = useState(false)
  const [demoMode, setDemoMode] = useState(false) // Changed to false - start in full mode
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [cacheStats, setCacheStats] = useState(null)
  const [clearingCache, setClearingCache] = useState(false)
  const [systemStatus, setSystemStatus] = useState({
    supabase: { status: 'UNKNOWN', message: 'Not checked yet' },
    polygon: { status: 'UNKNOWN', message: 'Not checked yet' },
    fmp: { status: 'UNKNOWN', message: 'Not checked yet' }
  })

  // Load cache stats on component mount
  useEffect(() => {
    loadCacheStats()
  }, [])

  const loadCacheStats = async () => {
    try {
      const stats = await getCacheStats()
      setCacheStats(stats)
    } catch (error) {
      console.error('Error loading cache stats:', error)
    }
  }

  const handleClearCache = async () => {
    setClearingCache(true)
    try {
      console.log('🧹 DASHBOARD: Clearing all cached data...')
      
      // Clear Supabase cache
      const success = await clearAllCache()
      
      // Clear any local storage cache
      if (typeof Storage !== 'undefined') {
        localStorage.removeItem('optionstrike_cache')
        sessionStorage.clear()
        console.log('🧹 DASHBOARD: Cleared local storage')
      }
      
      if (success) {
        console.log('✅ DASHBOARD: Cache cleared successfully')
        await loadCacheStats() // Refresh cache stats
        
        // Show success message briefly
        const originalError = error
        setError('Cache cleared successfully!')
        setTimeout(() => {
          setError(originalError)
        }, 3000)
      } else {
        setError('Failed to clear cache completely')
      }
      
    } catch (error) {
      console.error('💥 DASHBOARD: Error clearing cache:', error)
      setError(`Failed to clear cache: ${error.message}`)
    } finally {
      setClearingCache(false)
    }
  }

  const checkSystemHealth = async () => {
    console.log('🏥 DASHBOARD: Checking system health...')
    
    try {
      // In demo mode, show demo status
      if (demoMode) {
        setSystemStatus({
          supabase: { status: 'DEMO', message: 'Demo mode - using mock data' },
          polygon: { status: 'DEMO', message: 'Demo mode - using mock data' },
          fmp: { status: 'DEMO', message: 'Demo mode - using mock data' }
        })
        return
      }

      // Check all systems in parallel for full mode
      const [supabaseHealth, polygonHealth, fmpHealth] = await Promise.allSettled([
        testConnection(),
        checkPolygonAPIHealth(),
        checkFMPAPIHealth()
      ])
      
      setSystemStatus({
        supabase: supabaseHealth.status === 'fulfilled' ? supabaseHealth.value : 
          { status: 'ERROR', message: supabaseHealth.reason?.message || 'Connection failed' },
        polygon: polygonHealth.status === 'fulfilled' ? polygonHealth.value : 
          { status: 'ERROR', message: polygonHealth.reason?.message || 'Connection failed' },
        fmp: fmpHealth.status === 'fulfilled' ? fmpHealth.value : 
          { status: 'ERROR', message: fmpHealth.reason?.message || 'Connection failed' }
      })
    } catch (error) {
      console.error('💥 DASHBOARD: Error checking system health:', error)
    }
  }

  const loadRecommendations = async (forceRefresh = false) => {
    setLoading(true)
    setError(null)
    setRateLimited(false)
    
    try {
      console.log(`🔄 DASHBOARD: Loading recommendations in ${demoMode ? 'demo' : 'full'} mode... (forceRefresh: ${forceRefresh})`)
      
      if (demoMode) {
        console.log('🎭 DASHBOARD: Using mock recommendations (demo mode)')
        // Simulate loading delay for demo
        await new Promise(resolve => setTimeout(resolve, 1500))
        setRecommendations(mockRecommendations)
        setLastUpdate(new Date())
        setHasLoadedOnce(true)
        return
      }
      
      // Full mode: Try to load from Supabase first
      console.log('📊 DASHBOARD: Attempting to load from Supabase...')
      const { data, error: supabaseError } = await supabase
        .from('recommendations')
        .select('*')
        .eq('is_active', true)
        .order('confidence_score', { ascending: false })
      
      if (supabaseError) {
        console.warn('⚠️ DASHBOARD: Supabase query failed:', supabaseError)
        throw new Error(`Database error: ${supabaseError.message}`)
      } 
      
      if (data && data.length > 0) {
        console.log(`✅ DASHBOARD: Loaded ${data.length} recommendations from Supabase`)
        setRecommendations(data)
        setHasLoadedOnce(true)
        setLastUpdate(new Date())
      } else {
        console.log('❌ DASHBOARD: No recommendations in database, showing empty state')
        setRecommendations([])
        setHasLoadedOnce(true)
        setLastUpdate(new Date())
      }
      
    } catch (err) {
      console.error('💥 DASHBOARD: Error loading recommendations:', err)
      setError(err.message)
      
      // Check if error is rate limit related
      if (err.message.includes('rate limit') || err.message.includes('429') || err.message.includes('Limit Reach')) {
        setRateLimited(true)
      }
      
      setHasLoadedOnce(true)
    } finally {
      setLoading(false)
    }
  }

  const generateNewRecommendations = async (forceRefresh = false) => {
    setIsGenerating(true)
    setError(null)
    setRateLimited(false)
    
    try {
      console.log(`🚀 DASHBOARD: Generating new recommendations in ${demoMode ? 'demo' : 'full'} mode... (forceRefresh: ${forceRefresh})`)
      
      if (demoMode) {
        // In demo mode, just refresh the mock data
        console.log('🎭 DASHBOARD: Refreshing mock recommendations (demo mode)')
        await new Promise(resolve => setTimeout(resolve, 2000)) // Simulate generation time
        setRecommendations(mockRecommendations)
        setLastUpdate(new Date())
        setHasLoadedOnce(true)
        return
      }
      
      // Full mode: Use the recommendation engine
      console.log('🚀 DASHBOARD: Using recommendation engine to generate new recommendations...')
      
      // If force refresh, clear cache first
      if (forceRefresh) {
        console.log('🧹 DASHBOARD: Force refresh - clearing cache first...')
        await clearAllCache()
      }
      
      const newRecommendations = await recommendationEngine.generateRecommendations()
      
      if (newRecommendations.length > 0) {
        setRecommendations(newRecommendations)
        setLastUpdate(new Date())
        setHasLoadedOnce(true)
        console.log(`✅ DASHBOARD: Generated ${newRecommendations.length} new recommendations`)
      } else {
        setError('No recommendations could be generated with current market conditions')
        setRecommendations([])
        setHasLoadedOnce(true)
      }
      
    } catch (err) {
      console.error('💥 DASHBOARD: Error generating recommendations:', err)
      
      // Check if error is rate limit related
      if (err.message.includes('rate limit') || err.message.includes('429') || err.message.includes('Limit Reach')) {
        setRateLimited(true)
        setError('API rate limit reached. Please try again later or switch to demo mode.')
      } else {
        setError(`Failed to generate recommendations: ${err.message}`)
      }
      
      setHasLoadedOnce(true)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleGetRecommendations = async () => {
    // Check system health first if in full mode
    if (!demoMode) {
      await checkSystemHealth()
    }
    
    // Load existing recommendations first
    await loadRecommendations()
  }

  const handleRefresh = async () => {
    // Check system health if in full mode
    if (!demoMode) {
      await checkSystemHealth()
    }
    
    // Reload recommendations
    await loadRecommendations()
  }

  const handleForceRefresh = async () => {
    console.log('🔄 DASHBOARD: Force refresh triggered - bypassing all cache')
    
    // Check system health if in full mode
    if (!demoMode) {
      await checkSystemHealth()
    }
    
    // Generate new recommendations with force refresh
    await generateNewRecommendations(true)
  }

  const handleModeToggle = (isDemoMode) => {
    console.log(`🔄 DASHBOARD: Switching to ${isDemoMode ? 'demo' : 'full'} mode`)
    
    setDemoMode(isDemoMode)
    setRecommendations([]) // Clear current recommendations
    setError(null)
    setRateLimited(false)
    setHasLoadedOnce(false)
    setLastUpdate(null)
    
    // Reset system status when switching modes
    if (isDemoMode) {
      setSystemStatus({
        supabase: { status: 'DEMO', message: 'Demo mode - using mock data' },
        polygon: { status: 'DEMO', message: 'Demo mode - using mock data' },
        fmp: { status: 'DEMO', message: 'Demo mode - using mock data' }
      })
    } else {
      setSystemStatus({
        supabase: { status: 'UNKNOWN', message: 'Not checked yet' },
        polygon: { status: 'UNKNOWN', message: 'Not checked yet' },
        fmp: { status: 'UNKNOWN', message: 'Not checked yet' }
      })
    }
  }

  const isDataStale = lastUpdate && (Date.now() - lastUpdate.getTime()) > 30 * 60 * 1000 // 30 minutes

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-corporate-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-corporate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">OS</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-corporate-900">OptionStrike</h1>
                  <p className="text-sm text-corporate-600">
                    High-Probability Put Options {demoMode && '(Demo Mode)'}
                  </p>
                </div>
              </div>
              
              <div className="mt-4 sm:mt-0 flex items-center space-x-4">
                {/* Cache Manager */}
                <CacheManager 
                  cacheStats={cacheStats}
                  onClearCache={handleClearCache}
                  clearingCache={clearingCache}
                  onRefreshStats={loadCacheStats}
                />
                
                {/* Mode Toggle */}
                <ModeToggle 
                  demoMode={demoMode} 
                  onToggle={handleModeToggle}
                  disabled={loading || isGenerating}
                />
                
                {lastUpdate && (
                  <div className="text-sm text-corporate-600">
                    <span className="hidden sm:inline">Last updated: </span>
                    <span className={isDataStale ? 'text-red-600 font-medium' : ''}>
                      {lastUpdate.toLocaleTimeString()}
                    </span>
                    {isDataStale && (
                      <span className="ml-2 text-red-600">⚠️ Data may be stale</span>
                    )}
                  </div>
                )}
                
                <div className="flex space-x-2">
                  {hasLoadedOnce && (
                    <>
                      <button 
                        onClick={handleRefresh}
                        className="bg-corporate-600 text-white px-4 py-2 rounded-lg hover:bg-corporate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={loading || isGenerating}
                      >
                        {loading ? (
                          <div className="flex items-center space-x-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Loading...</span>
                          </div>
                        ) : (
                          'Refresh'
                        )}
                      </button>
                      
                      {!demoMode && (
                        <button 
                          onClick={handleForceRefresh}
                          className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={loading || isGenerating}
                          title="Bypass all cache and make fresh API calls"
                        >
                          {isGenerating ? (
                            <div className="flex items-center space-x-2">
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              <span>Fresh...</span>
                            </div>
                          ) : (
                            'Force Fresh'
                          )}
                        </button>
                      )}
                    </>
                  )}
                  
                  <button 
                    onClick={hasLoadedOnce ? generateNewRecommendations : handleGetRecommendations}
                    className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={loading || isGenerating}
                  >
                    {isGenerating ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>{demoMode ? 'Loading Demo...' : 'Generating...'}</span>
                      </div>
                    ) : loading ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Loading...</span>
                      </div>
                    ) : hasLoadedOnce ? (
                      demoMode ? 'Refresh Demo Data' : 'Generate New'
                    ) : (
                      'Get Recommendations'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* System Status - show after first load */}
          {hasLoadedOnce && <SystemStatus status={systemStatus} />}
          
          {/* Demo Mode Info */}
          {demoMode && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400\" viewBox="0 0 20 20\" fill="currentColor">
                    <path fillRule="evenodd\" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z\" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">Demo Mode Active</h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>You're currently viewing sample data to explore the application features.</p>
                    <p className="mt-1">Switch to <strong>Full Mode</strong> using the toggle above to connect to real market data APIs.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Disclaimer */}
          <Disclaimer />
          
          {/* API Setup Notice - only show in full mode and before first load */}
          {!demoMode && !hasLoadedOnce && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400\" viewBox="0 0 20 20\" fill="currentColor">
                    <path fillRule="evenodd\" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z\" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">Full Mode - Expanded Stock Universe</h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>You're using real market data with expanded coverage:</p>
                    <ul className="mt-2 list-disc list-inside space-y-1">
                      <li><strong>All US-listed stocks</strong> - Not just major companies</li>
                      <li><strong>ADRs</strong> - American Depositary Receipts of foreign companies</li>
                      <li><strong>Any symbol</strong> with liquid options on US exchanges</li>
                      <li><strong>Same rigorous filtering</strong> - Delta &lt;0.2, Premium &gt;3.5%, POP 87-93%</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Rate Limit Warning */}
          {rateLimited && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">API Rate Limit Warning</h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>
                      We've hit rate limits with our data provider. Some data may be cached or limited.
                      Please try again later or consider upgrading to a higher API plan for more frequent updates.
                    </p>
                    <p className="mt-2">
                      <strong>Tip:</strong> Switch to Demo Mode to explore the app without API limitations.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Error State */}
          {error && (
            <div className={`border rounded-lg p-4 mb-6 ${
              error.includes('successfully') ? 
                'bg-green-50 border-green-200' : 
                'bg-red-50 border-red-200'
            }`}>
              <div className="flex">
                <div className="flex-shrink-0">
                  {error.includes('successfully') ? (
                    <svg className="h-5 w-5 text-green-400\" viewBox="0 0 20 20\" fill="currentColor">
                      <path fillRule="evenodd\" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z\" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div className="ml-3">
                  <h3 className={`text-sm font-medium ${
                    error.includes('successfully') ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {error.includes('successfully') ? 'Success' : 'Error Loading Data'}
                  </h3>
                  <div className={`mt-2 text-sm ${
                    error.includes('successfully') ? 'text-green-700' : 'text-red-700'
                  }`}>
                    <p>{error}</p>
                    {!error.includes('successfully') && (
                      <p className="mt-1">
                        {demoMode ? 
                          'Please try refreshing the demo data.' : 
                          'Please check your API configuration and try again, or switch to Demo Mode.'
                        }
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Generation Progress */}
          {isGenerating && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <LoadingSpinner size="sm" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    {demoMode ? 'Loading Demo Data' : 'Scanning Expanded Stock Universe'}
                  </h3>
                  <p className="text-sm text-blue-700 mt-1">
                    {demoMode ? 
                      'Preparing sample recommendations for demonstration...' :
                      'Analyzing earnings calendar and options data across all US-listed stocks. This may take a few minutes...'
                    }
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Loading State */}
          {loading ? (
            <div className="text-center py-12">
              <LoadingSpinner size="lg" message={demoMode ? "Loading demo data..." : "Loading recommendations..."} />
              <p className="text-sm text-corporate-500 mt-2">
                {demoMode ? 
                  'Preparing sample options data for demonstration' :
                  'Analyzing options data and calculating confidence scores'
                }
              </p>
            </div>
          ) : !hasLoadedOnce ? (
            /* Welcome State - Show when no data has been loaded yet */
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-corporate-900 mb-2">Welcome to OptionStrike</h2>
              <p className="text-corporate-600 text-lg mb-4">
                {demoMode ? 
                  'Ready to explore high-probability put options with sample data' :
                  'Ready to analyze the entire US stock universe for high-probability put options'
                }
              </p>
              <p className="text-corporate-500 text-sm mb-6">
                {demoMode ? 
                  'Click "Get Recommendations" to see sample options trading recommendations' :
                  'Click "Get Recommendations" to scan all US-listed stocks for opportunities'
                }
              </p>
              <button 
                onClick={handleGetRecommendations}
                className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors text-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading || isGenerating}
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Loading...</span>
                  </div>
                ) : (
                  'Get Recommendations'
                )}
              </button>
            </div>
          ) : recommendations.length > 0 ? (
            <>
              {/* Stats Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-lg shadow-sm border border-corporate-200 p-4">
                  <div className="text-2xl font-bold text-corporate-900">{recommendations.length}</div>
                  <div className="text-sm text-corporate-600">
                    {demoMode ? 'Demo Recommendations' : 'Active Recommendations'}
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-corporate-200 p-4">
                  <div className="text-2xl font-bold text-green-600">
                    {recommendations.filter(r => r.confidence_score >= 80).length}
                  </div>
                  <div className="text-sm text-corporate-600">High Confidence</div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-corporate-200 p-4">
                  <div className="text-2xl font-bold text-corporate-900">
                    {(recommendations.reduce((sum, r) => sum + r.pop, 0) / recommendations.length).toFixed(1)}%
                  </div>
                  <div className="text-sm text-corporate-600">Avg. Probability of Profit</div>
                </div>
              </div>
              
              {/* Recommendations Grid */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {recommendations.map((rec) => (
                  <RecommendationCard key={rec.id || `${rec.symbol}-${rec.strike_price}-${rec.expiration_date}`} recommendation={rec} />
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-corporate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-corporate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <p className="text-corporate-600 text-lg">No recommendations available</p>
              <p className="text-corporate-500 text-sm mt-2 mb-4">
                {demoMode ? 
                  'No demo data loaded yet. Click "Get Recommendations" to load sample data.' :
                  'No recommendations found in the database. Click "Generate New" to scan the entire stock universe for opportunities.'
                }
              </p>
              {!demoMode && (
                <button 
                  onClick={generateNewRecommendations}
                  className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading || isGenerating}
                >
                  {isGenerating ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Scanning...</span>
                    </div>
                  ) : (
                    'Scan All Stocks'
                  )}
                </button>
              )}
            </div>
          )}
        </main>
      </div>
    </ErrorBoundary>
  )
}