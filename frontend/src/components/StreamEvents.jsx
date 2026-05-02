import './StreamEvents.css'

const modalityLabels = {
  physio: 'Physiological',
  motion: 'Motion',
  voice: 'Voice',
  image: 'Image',
}

const modalityColors = {
  physio: 'physio',
  motion: 'motion',
  voice: 'voice',
  image: 'image',
}

function StreamEvents({ events }) {
  if (events.length === 0) return null

  const modalityEvents = events.filter((e) => e.event === 'modality')
  const errorEvents = events.filter((e) => e.event === 'error')
  const fusionEvent = events.find((e) => e.event === 'fusion')

  const completedModalities = new Set([
    ...modalityEvents.map((e) => e.modality),
    ...errorEvents.map((e) => e.modality),
  ])

  const processingEvents = events.filter(
    (e) => e.event === 'processing' && !completedModalities.has(e.modality),
  )

  return (
    <div className="stream-events">
      {processingEvents.map((evt, i) => (
        <div key={`proc-${evt.modality}`} className="stream-item processing">
          <span className="stream-dot" />
          <span>Processing {modalityLabels[evt.modality] || evt.modality}...</span>
        </div>
      ))}

      {modalityEvents.map((evt, i) => (
        <div key={`mod-${i}`} className={`stream-item modality ${modalityColors[evt.modality] || ''}`}>
          <span className={`modality-badge ${modalityColors[evt.modality] || ''}`}>
            {modalityLabels[evt.modality] || evt.modality}
          </span>
          <div className="modality-details">
            <div className="modality-result">
              <span className="result-label">Prediction:</span>
              <span className={`result-value ${evt.label}`}>{formatLabel(evt.label)}</span>
            </div>
            <div className="modality-meta">
              <span>Top feature: <code>{evt.top_feature}</code></span>
              <span>CV F1: {evt.cv_f1?.toFixed(3)}</span>
            </div>
            {evt.probabilities && (
              <ProbBar probabilities={evt.probabilities} />
            )}
          </div>
        </div>
      ))}

      {errorEvents.map((evt, i) => (
        <div key={`err-${i}`} className="stream-item error">
          <span className="error-icon-sm">!</span>
          <span>{modalityLabels[evt.modality] || evt.modality}: {evt.message}</span>
        </div>
      ))}

      {fusionEvent && (
        <div className="stream-item fusion-complete">
          <span className="fusion-icon">◆</span>
          <span>Fusion complete — scroll down for final result</span>
        </div>
      )}
    </div>
  )
}

function ProbBar({ probabilities }) {
  const labels = Object.keys(probabilities)
  const maxProb = Math.max(...Object.values(probabilities))

  return (
    <div className="prob-bar-container">
      {labels.map((label) => (
        <div key={label} className="prob-row">
          <span className="prob-label">{formatLabel(label)}</span>
          <div className="prob-track">
            <div
              className="prob-fill"
              style={{
                width: `${probabilities[label] * 100}%`,
                opacity: probabilities[label] === maxProb ? 1 : 0.5,
              }}
            />
          </div>
          <span className="prob-value">{(probabilities[label] * 100).toFixed(0)}%</span>
        </div>
      ))}
    </div>
  )
}

function formatLabel(label) {
  return label
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export default StreamEvents
