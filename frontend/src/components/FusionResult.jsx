import './FusionResult.css'

function FusionResult({ result }) {
  const { label, probabilities, modality_shap, confidence } = result

  return (
    <div className="fusion-result">
      <div className="result-header">
        <span className="result-badge">Final Result</span>
      </div>

      <div className="result-prediction">
        <div className={`prediction-label ${label}`}>
          {formatLabel(label)}
        </div>
        <div className="prediction-confidence">
          Confidence: {(confidence * 100).toFixed(0)}%
        </div>
      </div>

      <div className="result-section">
        <h3>Class Probabilities</h3>
        <div className="prob-bars">
          {Object.entries(probabilities)
            .sort((a, b) => b[1] - a[1])
            .map(([cls, prob]) => (
              <div key={cls} className="prob-bar-row">
                <span className={`prob-dot ${cls}`} />
                <span className="prob-name">{formatLabel(cls)}</span>
                <div className="prob-bar-track">
                  <div
                    className={`prob-bar-fill ${cls}`}
                    style={{ width: `${prob * 100}%` }}
                  />
                </div>
                <span className="prob-pct">{(prob * 100).toFixed(1)}%</span>
              </div>
            ))}
        </div>
      </div>

      {modality_shap && (
        <div className="result-section">
          <h3>Modality Importance (SHAP)</h3>
          <div className="shap-bars">
            {Object.entries(modality_shap)
              .sort((a, b) => b[1] - a[1])
              .map(([mod, val]) => (
                <div key={mod} className="shap-bar-row">
                  <span className={`shap-dot ${mod}`} />
                  <span className="shap-name">{formatLabel(mod)}</span>
                  <div className="shap-bar-track">
                    <div
                      className={`shap-bar-fill ${mod}`}
                      style={{ width: `${(val / getMaxShap(modality_shap)) * 100}%` }}
                    />
                  </div>
                  <span className="shap-val">{val.toFixed(3)}</span>
                </div>
              ))}
          </div>
        </div>
      )}
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

export default FusionResult
