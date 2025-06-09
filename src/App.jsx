import Dashboard from './components/Dashboard'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

function App() {
  return (
    <ErrorBoundary>
      <div className="App">
        <Dashboard />
      </div>
    </ErrorBoundary>
  )
}

export default App