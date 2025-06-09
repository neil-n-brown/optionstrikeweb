export default function SystemStatus({ status }) {
  const getStatusColor = (statusValue) => {
    switch (statusValue) {
      case 'OK':
        return 'text-green-400'
      case 'ERROR':
        return 'text-red-400'
      case 'CHECKING':
        return 'text-yellow-400'
      default:
        return 'text-dark-400'
    }
  }

  const getStatusIcon = (statusValue) => {
    switch (statusValue) {
      case 'OK':
        return (
          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )
      case 'ERROR':
        return (
          <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )
      case 'CHECKING':
        return (
          <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
        )
      default:
        return (
          <svg className="w-4 h-4 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
    }
  }

  const hasErrors = Object.values(status).some(s => s.status === 'ERROR')
  const allOK = Object.values(status).every(s => s.status === 'OK')

  return (
    <div className={`rounded-lg border p-4 mb-6 backdrop-blur-sm ${
      hasErrors ? 'bg-red-900/20 border-red-500/30' : 
      allOK ? 'bg-green-900/20 border-green-500/30' : 
      'bg-yellow-900/20 border-yellow-500/30'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-white">System Status</h3>
        <div className={`text-xs px-2 py-1 rounded-full backdrop-blur-sm ${
          hasErrors ? 'bg-red-900/30 text-red-300 border border-red-500/30' :
          allOK ? 'bg-green-900/30 text-green-300 border border-green-500/30' :
          'bg-yellow-900/30 text-yellow-300 border border-yellow-500/30'
        }`}>
          {hasErrors ? 'Issues Detected' : allOK ? 'All Systems Operational' : 'Checking...'}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center space-x-2">
          {getStatusIcon(status.supabase?.status)}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white">Database</div>
            <div className={`text-xs truncate ${getStatusColor(status.supabase?.status)}`}>
              {status.supabase?.message || 'Unknown'}
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {getStatusIcon(status.polygon?.status)}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white">Options API</div>
            <div className={`text-xs truncate ${getStatusColor(status.polygon?.status)}`}>
              {status.polygon?.message || 'Unknown'}
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {getStatusIcon(status.fmp?.status)}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white">Earnings API</div>
            <div className={`text-xs truncate ${getStatusColor(status.fmp?.status)}`}>
              {status.fmp?.message || 'Unknown'}
            </div>
          </div>
        </div>
      </div>
      
      {hasErrors && (
        <div className="mt-3 pt-3 border-t border-red-500/30">
          <p className="text-xs text-red-300">
            Some services are experiencing issues. The app will use cached data when available.
          </p>
        </div>
      )}
    </div>
  )
}