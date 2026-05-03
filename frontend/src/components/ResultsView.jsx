import { motion } from 'framer-motion'
import { Download, RefreshCcw, UserCircle2, Brain, Activity, Mic, Camera, Key } from 'lucide-react'

const MODALITY_ICONS = {
  physio: Activity,
  motion: Key,
  voice: Mic,
  image: Camera
}

function formatLabel(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export default function ResultsView({ 
  report, 
  stepConfig, 
  modalityRows, 
  modalityErrors, 
  onExportPdf, 
  onRestart 
}) {
  const fusion = report?.fusion
  if (!fusion) return null

  const confidencePct = (fusion.confidence * 100).toFixed(1)

  return (
    <motion.div 
      className="results-container"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="results-header">
        <div className="results-title-group">
          <UserCircle2 size={40} className="text-primary" />
          <div>
            <h2>Assessment Results</h2>
            <p className="subtitle">Generated on {new Date(report.generatedAt).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="results-actions">
          <button className="btn-ghost" onClick={onExportPdf}>
            <Download size={18} /> Export PDF
          </button>
          <button className="btn-primary" onClick={onRestart}>
            <RefreshCcw size={18} /> New Assessment
          </button>
        </div>
      </div>

      <div className="results-grid">
        {/* Left Column: Summary and Fusion Probabilities */}
        <div className="results-left-column">
          {/* Main Summary Card */}
          <motion.div 
            className="summary-card"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="card-header">
              <Brain size={24} />
              <h3>Multimodal Synthesis</h3>
            </div>
            <div className="synthesis-content">
              <div className="final-label">
                <span className="label-title">Estimated Category</span>
                <span className="label-value">{formatLabel(fusion.label)}</span>
              </div>
              <div className="confidence-meter">
                <div className="confidence-header">
                  <span>Model Confidence</span>
                  <span>{confidencePct}%</span>
                </div>
                <div className="confidence-track">
                  <div 
                    className="confidence-fill" 
                    style={{ width: `${confidencePct}%` }} 
                  />
                </div>
              </div>
              <p className="clinical-disclaimer">
                <strong>Note:</strong> This tool assists in observing potential patterns related to the autism spectrum. It is not a diagnostic tool. Please share this report with a qualified healthcare professional.
              </p>
            </div>
          </motion.div>

          {/* Probability Breakdown */}
          <motion.div 
            className="probabilities-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <h3>Overall Fusion Probabilities</h3>
            <div className="probability-bars">
              {Object.entries(fusion.probabilities)
                .sort((a, b) => b[1] - a[1])
                .map(([cls, prob]) => (
                  <div key={cls} className="prob-row">
                    <span className="prob-label">{formatLabel(cls)}</span>
                    <div className="prob-track">
                      <div 
                        className="prob-fill" 
                        style={{ width: `${(prob * 100).toFixed(1)}%` }} 
                      />
                    </div>
                    <span className="prob-value">{(prob * 100).toFixed(1)}%</span>
                  </div>
                ))}
            </div>
          </motion.div>
        </div>

        {/* Right Column: Detailed Modalities */}
        <div className="results-right-column">
          <motion.div 
            className="details-card"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h3>Individual Modality Insights</h3>
            <div className="modality-cards-grid">
              {stepConfig.map((item) => {
                const row = modalityRows.find((evt) => evt.modality === item.key)
                const err = modalityErrors.find((evt) => evt.modality === item.key)
                const Icon = MODALITY_ICONS[item.key] || Activity
                const relPct = row?.cv_f1 ? (row.cv_f1 * 100).toFixed(0) : null
                const probs = row?.probabilities || {}
                
                return (
                  <div key={item.key} className="modality-detail-card">
                    <div className="modality-card-header">
                      <div className="modality-title-group">
                        <div className="modality-icon-wrapper">
                          <Icon size={20} />
                        </div>
                        <h4>{item.title}</h4>
                      </div>
                      {relPct && (
                        <span className="modality-badge">Reliability: {relPct}%</span>
                      )}
                    </div>
                    
                    <div className="modality-card-body">
                      {err ? (
                        <div className="error-text">Failed to process: {err.message}</div>
                      ) : !row ? (
                        <div className="pending-text">Pending...</div>
                      ) : (
                        <>
                          <div className="modality-prediction-text">
                            <strong>Prediction:</strong> {formatLabel(row.label)}
                          </div>
                          {row.top_feature && (
                            <div className="modality-feature-text">
                              <strong>Key Feature:</strong> {row.top_feature}
                            </div>
                          )}
                          
                          {Object.keys(probs).length > 0 && (
                            <div className="modality-probs">
                              <div className="probs-title">Class Probabilities:</div>
                              <div className="probability-bars small-bars">
                                {Object.entries(probs)
                                  .sort((a, b) => b[1] - a[1])
                                  .map(([cls, prob]) => (
                                    <div key={cls} className="prob-row">
                                      <span className="prob-label">{formatLabel(cls)}</span>
                                      <div className="prob-track">
                                        <div 
                                          className="prob-fill" 
                                          style={{ width: `${(prob * 100).toFixed(1)}%` }} 
                                        />
                                      </div>
                                      <span className="prob-value">{(prob * 100).toFixed(0)}%</span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}
