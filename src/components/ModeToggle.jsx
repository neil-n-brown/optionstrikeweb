export default function ModeToggle({ demoMode, onToggle, disabled = false }) {
  return (
    <div className="flex items-center space-x-3">
      <span className={`text-sm font-medium ${demoMode ? 'text-corporate-900' : 'text-corporate-500'}`}>
        Demo
      </span>
      
      <button
        type="button"
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2 ${
          demoMode ? 'bg-corporate-200' : 'bg-primary-600'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        role="switch"
        aria-checked={!demoMode}
        onClick={() => !disabled && onToggle(!demoMode)}
        disabled={disabled}
      >
        <span className="sr-only">Toggle between demo and full mode</span>
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            demoMode ? 'translate-x-0' : 'translate-x-5'
          }`}
        />
      </button>
      
      <span className={`text-sm font-medium ${!demoMode ? 'text-corporate-900' : 'text-corporate-500'}`}>
        Full
      </span>
      
      {!demoMode && (
        <div className="flex items-center ml-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-xs text-green-600 ml-1">LIVE</span>
        </div>
      )}
    </div>
  )
}