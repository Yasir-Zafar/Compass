import { useState, useEffect } from 'react'
import './HealthTab.css'

function HealthTab() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastChecked, setLastChecked] = useState(null)

  const checkHealth = () => {
    setLoading(true)
    setError(null)
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) throw new Error('Health check failed')
        return res.json()
      })
      .then((data) => {
        setStatus(data)
        setLoading(false)
        setLastChecked(new Date())
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
        setLastChecked(new Date())
      })
  }

  useEffect(() => {
    checkHealth()
  }, [])

  return (
    <div className="health-tab">
      <div className="section-header">
        <h2>System Health</h2>
        <p>Backend service status</p>
      </div>

      <div className={`health-card ${loading ? 'loading' : error ? 'error' : status?.status === 'ok' ? 'healthy' : 'unknown'}`}>
        <div className="health-icon">
          {loading ? (
            <span className="spinner-lg" />
          ) : error ? (
            <span className="icon-error">!</span>
          ) : status?.status === 'ok' ? (
            <span className="icon-ok">✓</span>
          ) : (
            <span className="icon-unknown">?</span>
          )}
        </div>
        <div className="health-info">
          <div className="health-status">
            {loading ? 'Checking...' : error ? 'Unreachable' : status?.status === 'ok' ? 'Healthy' : 'Unknown'}
          </div>
          <div className="health-details">
            {status && (
              <>
                <span>Models loaded: {status.models_loaded ? 'Yes' : 'No'}</span>
                {lastChecked && (
                  <span>Last checked: {lastChecked.toLocaleTimeString()}</span>
                )}
              </>
            )}
            {error && <span>{error}</span>}
          </div>
        </div>
      </div>

      <button className="btn btn-primary refresh-btn" onClick={checkHealth} disabled={loading}>
        {loading ? 'Checking...' : 'Refresh'}
      </button>

      <div className="endpoints-card">
        <h3>API Endpoints</h3>
        <div className="endpoint-list">
          <EndpointItem method="GET" path="/health" desc="Health check" />
          <EndpointItem method="GET" path="/model-info" desc="Model metadata" />
          <EndpointItem method="POST" path="/predict" desc="Run prediction (SSE)" />
        </div>
      </div>
    </div>
  )
}

function EndpointItem({ method, path, desc }) {
  return (
    <div className="endpoint-item">
      <span className={`method-badge ${method.toLowerCase()}`}>{method}</span>
      <code className="endpoint-path">{path}</code>
      <span className="endpoint-desc">{desc}</span>
    </div>
  )
}

export default HealthTab
