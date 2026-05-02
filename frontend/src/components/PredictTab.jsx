import { useState } from 'react'
import './PredictTab.css'
import FileUpload from './FileUpload'
import StreamEvents from './StreamEvents'
import FusionResult from './FusionResult'

const modalities = [
  { key: 'physio', label: 'Physiological', accept: '.csv', desc: 'CSV with HR, GSR, TEMP columns', color: 'physio' },
  { key: 'motion', label: 'Motion', accept: '.json', desc: 'JSON with 3D joint tracking data', color: 'motion' },
  { key: 'voice', label: 'Voice', accept: '.wav', desc: 'WAV audio recording', color: 'voice' },
  { key: 'image', label: 'Image', accept: '.jpg,.png', desc: 'JPG or PNG facial photograph', color: 'image' },
]

function PredictTab() {
  const [files, setFiles] = useState({})
  const [streamEvents, setStreamEvents] = useState([])
  const [fusionResult, setFusionResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleFileChange = (key, file) => {
    setFiles((prev) => ({ ...prev, [key]: file }))
    setError(null)
  }

  const allFilesReady = modalities.every((m) => files[m.key])

  const handleSubmit = async () => {
    if (!allFilesReady) return

    setLoading(true)
    setStreamEvents([])
    setFusionResult(null)
    setError(null)

    const formData = new FormData()
    modalities.forEach((m) => {
      formData.append(m.key, files[m.key])
    })

    try {
      const response = await fetch('/api/predict', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => null)
        throw new Error(errData?.detail || `Server error: ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data:')) continue

          try {
            const data = JSON.parse(trimmed.slice(5))
            setStreamEvents((prev) => [...prev, data])

            if (data.event === 'fusion') {
              setFusionResult(data)
            }
          } catch {
            // skip malformed SSE data
          }
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setFiles({})
    setStreamEvents([])
    setFusionResult(null)
    setError(null)
    setLoading(false)
  }

  return (
    <div className="predict-tab">
      <div className="section-header">
        <h2>Upload Data</h2>
        <p>Upload files for all 4 modalities to get a prediction</p>
      </div>

      <div className="upload-grid">
        {modalities.map((mod) => (
          <FileUpload
            key={mod.key}
            modality={mod}
            file={files[mod.key] || null}
            onChange={(file) => handleFileChange(mod.key, file)}
          />
        ))}
      </div>

      <div className="action-bar">
        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={!allFilesReady || loading}
        >
          {loading ? (
            <>
              <span className="spinner" />
              Processing...
            </>
          ) : (
            'Run Prediction'
          )}
        </button>
        {(streamEvents.length > 0 || fusionResult) && (
          <button className="btn btn-secondary" onClick={handleReset}>
            Reset
          </button>
        )}
      </div>

      {error && (
        <div className="error-banner">
          <span className="error-icon">!</span>
          <span>{error}</span>
        </div>
      )}

      {streamEvents.length > 0 && (
        <div className="section-header" style={{ marginTop: 24 }}>
          <h2>Processing</h2>
        </div>
      )}

      <StreamEvents events={streamEvents} />

      {fusionResult && <FusionResult result={fusionResult} />}
    </div>
  )
}

export default PredictTab
