import { useState, useEffect } from 'react'
import { supabase, testConnection } from '../lib/supabase'
import { checkPolygonAPIHealth } from '../lib/polygon'
import { checkFMPAPIHealth } from '../lib/earnings'
import { mockRecommendations } from '../lib/mockData'
import RecommendationCard from './RecommendationCard'
import SystemStatus from './SystemStatus'
import Disclaimer from './Disclaimer'

export default function Dashboard() {
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [systemStatus, setSystemStatus] = useState({
    supabase: { status: 'CHECKING', message: 'Checking connection...' },
    polygon: { status: 'CHECKING', message: 'Checking connection...' },
    fmp: { status: 'CHECKING', message: 'Checking connection...' }
  })

  useEffect(() => {
    checkSystemHealth()
    loadRecommendations()
  }, [])

  const checkSystemHealth = async () => {
    console.log('Checking system health...')
    
    // Check Supabase connection
    const supabaseHealth = await testConnection()
    
    // Check API connections
    const polygonHealth = await checkPolygonAPIHealth()
    const fmpHealth = await checkFMPAPIHealth()
    
    setSystemStatus({
      supabase: supabaseHealth,
      polygon: polygonHealth,
      fmp: fmpHealth
    })
  }

  const loadRecommendations = async () => {
    setLoading(true)
    setError(null)
    
    try {
      console.log('Loading recommendations...')
      
      // Try to load from Supabase first
      const { data, error: supabaseError } = await supabase
        .from('recommendations')
        .select('*')
        .eq('is_active', true)
        .order('confidence_score', { ascending: false })
      
      if (supabaseError) {
        console.warn('Supabase query failed, using mock data:', supabaseError)
        // Fall back to mock data
        setRecommendations(mockRecommendations)
      } else if (data && data.length > 0) {
        console.log(`Loaded ${data.length} recommendations from Supabase`)
        setRecommendations(data)
      } else {
        console.log('No recommendations in database, using mock data')
        setRecommendations(mockRecommendations)
      }
      
      setLastUpdate(new Date())
      
    } catch (err) {
      console.error('Error loading recommendations:', err)
      setError(err.message)
      // Fall back to mock data on error
      setRecommendations(mockRecommendations)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    await Promise.all([
      checkSystemHealth(),
      loadRecommendations()
    ])
  }

  const isDataStale = lastUpdate && (Date.now() - lastUpdate.getTime()) > 30 * 60 * 1000 // 30 minutes

  return (
    <div className="min-h-screen bg-gradient-dark">
      {/* Header */}
      <header className="glass-effect border-b border-dark-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-sm">OS</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">OptionStrike</h1>
                <p className="text-sm text-dark-300">High-Probability Put Options</p>
              </div>
            </div>
            
            <div className="mt-4 sm:mt-0 flex items-center space-x-4">
              {lastUpdate && (
                <div className="text-sm text-dark-300">
                  <span className="hidden sm:inline">Last updated: </span>
                  <span className={isDataStale ? 'text-red-400 font-medium' : 'text-dark-200'}>
                    {lastUpdate.toLocaleTimeString()}
                  </span>
                  {isDataStale && (
                    <span className="ml-2 text-red-400">⚠️ Data may be stale</span>
                  )}
                </div>
              )}
              
              <button 
                onClick={handleRefresh}
                className="bg-gradient-to-r from-primary-600 to-primary-700 text-white px-4 py-2 rounded-lg hover:from-primary-700 hover:to-primary-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                disabled={loading}
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
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* System Status */}
        <SystemStatus status={systemStatus} />
        
        {/* Disclaimer */}
        <Disclaimer />
        
        {/* Error State */}
        {error && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-6 backdrop-blur-sm">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400\" viewBox="0 0 20 20\" fill="currentColor">
                  <path fillRule="evenodd\" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z\" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-300">Error Loading Data</h3>
                <div className="mt-2 text-sm text-red-200">
                  <p>{error}</p>
                  <p className="mt-1">Displaying cached or mock data instead.</p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Loading State */}
        {loading ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-dark-600 border-t-primary-500 rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-dark-200">Loading recommendations...</p>
            <p className="text-sm text-dark-400 mt-2">Analyzing options data and calculating confidence scores</p>
          </div>
        ) : recommendations.length > 0 ? (
          <>
            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="card-dark rounded-lg p-4">
                <div className="text-2xl font-bold text-white">{recommendations.length}</div>
                <div className="text-sm text-dark-300">Active Recommendations</div>
              </div>
              <div className="card-dark rounded-lg p-4">
                <div className="text-2xl font-bold text-green-400">
                  {recommendations.filter(r => r.confidence_score >= 80).length}
                </div>
                <div className="text-sm text-dark-300">High Confidence</div>
              </div>
              <div className="card-dark rounded-lg p-4">
                <div className="text-2xl font-bold text-white">
                  {(recommendations.reduce((sum, r) => sum + r.pop, 0) / recommendations.length).toFixed(1)}%
                </div>
                <div className="text-sm text-dark-300">Avg. Probability of Profit</div>
              </div>
            </div>
            
            {/* Recommendations Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {recommendations.map((rec) => (
                <RecommendationCard key={rec.id} recommendation={rec} />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-dark-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-dark-200 text-lg">No recommendations available</p>
            <p className="text-dark-400 text-sm mt-2">Check back later or refresh to load new data</p>
          </div>
        )}
      </main>
    </div>
  )
}