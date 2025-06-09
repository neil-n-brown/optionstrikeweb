export default function Disclaimer() {
  return (
    <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 mb-6 backdrop-blur-sm">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-yellow-300">Important Risk Disclaimer</h3>
          <div className="mt-2 text-sm text-yellow-200 space-y-2">
            <p>
              <strong>Options trading involves substantial risk and is not suitable for all investors.</strong> 
              You can lose more than your initial investment. Past performance does not guarantee future results.
            </p>
            <p>
              This tool provides analysis and educational information only and is <strong>not investment advice</strong>. 
              All trading decisions are your responsibility. Please consult with a qualified financial advisor 
              before making any trading decisions.
            </p>
            <p>
              The recommendations shown are based on mathematical models and historical data, which may not 
              accurately predict future market movements. Market conditions can change rapidly, affecting 
              option values and probabilities.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}