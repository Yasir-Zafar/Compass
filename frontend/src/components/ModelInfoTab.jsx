import { useState, useEffect } from 'react'
import './ModelInfoTab.css'

function ModelInfoTab() {
  const [info, setInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/model-info')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch model info')
        return res.json()
      })
      .then((data) => {
        setInfo(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="info-loading"><span className="spinner-lg" /></div>
  if (error) return <div className="info-error">{error}</div>
  if (!info) return null

  return (
    <div className="model-info-tab">
      <div className="section-header">
        <h2>Model Information</h2>
        <p>Training metadata and performance metrics</p>
      </div>

      <div className="info-card">
        <h3>Classification Labels</h3>
        <div className="label-list">
          {info.label_order.map((label) => (
            <span key={label} className={`label-tag ${label}`}>
              {formatLabel(label)}
            </span>
          ))}
        </div>
      </div>

      <div className="info-card">
        <h3>Modalities</h3>
        <div className="modality-list">
          {info.modality_names.map((mod) => (
            <span key={mod} className={`modality-tag ${mod}`}>
              {formatLabel(mod)}
            </span>
          ))}
        </div>
      </div>

      <div className="info-card">
        <h3>Cross-Validation Scores</h3>
        <div className="cv-grid">
          {Object.entries(info.cv_scores).map(([key, score]) => (
            <div key={key} className={`cv-item ${key === 'fusion' ? 'fusion' : key}`}>
              <span className="cv-label">{formatLabel(key)}</span>
              <div className="cv-bar-track">
                <div
                  className={`cv-bar-fill ${key === 'fusion' ? 'fusion' : key}`}
                  style={{ width: `${score.mean * 100}%` }}
                />
              </div>
              <span className="cv-value">
                {score.mean.toFixed(3)} ± {score.std.toFixed(3)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="info-card">
        <h3>SHAP Feature Importance</h3>
        <div className="shap-importance">
          {Object.entries(info.shap_importance)
            .sort((a, b) => b[1] - a[1])
            .map(([mod, val]) => (
              <div key={mod} className={`shap-item ${mod}`}>
                <span className="shap-label">{formatLabel(mod)}</span>
                <div className="shap-track">
                  <div
                    className={`shap-fill ${mod}`}
                    style={{ width: `${(val / getMaxShap(info.shap_importance)) * 100}%` }}
                  />
                </div>
                <span className="shap-value">{val.toFixed(3)}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

function formatLabel(str) {
  return str
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function getMaxShap(shap) {
  return Math.max(...Object.values(shap))
}

export default ModelInfoTab
