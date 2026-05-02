import { useEffect, useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import './App.css'
import StreamEvents from './components/StreamEvents'
import FusionResult from './components/FusionResult'

const STEP_CONFIG = [
  {
    key: 'physio',
    title: 'Physiological Input',
    accept: '.csv',
    description: 'Upload a CSV with HR, GSR, TEMP columns.',
    instructions: [
      'HR: heart rate per sample',
      'GSR: galvanic skin response values',
      'TEMP: skin/body temperature readings',
    ],
  },
  {
    key: 'motion',
    title: '3D Motion Input',
    accept: '.json',
    description: 'Upload JSON containing tracked 3D joints across frames.',
    instructions: [
      'Joint entries should be [x, y, z] arrays across time',
      'Head and key upper-body joints are recommended',
      'Optional metadata: frame_rate, duration_sec, stimming_detected',
    ],
  },
  {
    key: 'voice',
    title: 'Voice Input',
    accept: '.wav',
    description: 'Upload a clear WAV recording (mono preferred).',
    instructions: [
      'Use at least 10-20 seconds of speech',
      'Record in a quiet room with minimal echo',
      'Avoid clipping and heavy background noise',
    ],
  },
  {
    key: 'image',
    title: 'Facial Image Input',
    accept: '.jpg,.png',
    description: 'Upload a frontal facial image in JPG or PNG format.',
    instructions: [
      'Use neutral lighting and front-facing angle',
      'Keep face centered and fully visible',
      'Avoid heavy filters and motion blur',
    ],
  },
]

const LOADING_FACTS = [
  'Autism is a spectrum; each person has unique strengths and support needs.',
  'Screening tools help guide attention but do not replace expert diagnosis.',
  'Early support can improve communication, confidence, and quality of life.',
  'A calm routine before testing can improve data quality and comfort.',
  'Share full context with clinicians for better interpretation of model results.',
]

const HOME_SECTIONS = [
  {
    title: 'Understand Autism Spectrum',
    body: 'Autism spectrum disorder (ASD) presents differently across individuals. This platform estimates risk categories to support informed discussions with healthcare professionals.',
  },
  {
    title: 'Why Multimodal Matters',
    body: 'Physiology, movement, voice, and visual cues each offer partial signals. Combining all modalities improves coverage compared with single-source predictions.',
  },
  {
    title: 'How This Assessment Helps',
    body: 'Compass is designed as an assistive decision tool to organize observations and provide structured model outputs in a report-ready format.',
  },
]

function App() {
  const [stage, setStage] = useState('home')
  const [step, setStep] = useState(0)
  const [files, setFiles] = useState({})
  const [events, setEvents] = useState([])
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  const [loadingFactIndex, setLoadingFactIndex] = useState(0)

  useEffect(() => {
    if (stage !== 'predicting') return undefined
    const id = setInterval(() => {
      setLoadingFactIndex((prev) => (prev + 1) % LOADING_FACTS.length)
    }, 2800)
    return () => clearInterval(id)
  }, [stage])

  const currentStep = STEP_CONFIG[step]
  const allFilesReady = STEP_CONFIG.every((item) => files[item.key])

  const modalityRows = useMemo(
    () => events.filter((evt) => evt.event === 'modality'),
    [events],
  )
  const modalityErrors = useMemo(
    () => events.filter((evt) => evt.event === 'error' && evt.modality !== 'server' && evt.modality !== 'fusion'),
    [events],
  )

  const startAssessment = () => {
    setError('')
    setEvents([])
    setReport(null)
    setFiles({})
    setStep(0)
    setStage('upload')
  }

  const onUploadFile = (key, selectedFile) => {
    if (!selectedFile) return
    setFiles((prev) => ({ ...prev, [key]: selectedFile }))
  }

  const runPrediction = async () => {
    if (!allFilesReady) {
      setError('Please complete all uploads before prediction.')
      return
    }

    setError('')
    setEvents([])
    setReport(null)
    setStage('predicting')

    const formData = new FormData()
    STEP_CONFIG.forEach((item) => {
      formData.append(item.key, files[item.key])
    })

    try {
      const response = await fetch('/api/predict', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => null)
        throw new Error(errData?.detail || `Prediction failed (${response.status})`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fusion = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const payload = trimmed.slice(5).trim()
          if (!payload) continue
          const parsed = JSON.parse(payload)
          if (parsed.event === 'done') continue

          setEvents((prev) => [...prev, parsed])
          if (parsed.event === 'fusion') {
            fusion = parsed
          }
          if (parsed.event === 'error' && parsed.modality === 'server') {
            throw new Error(parsed.message || 'Server error during streaming.')
          }
        }
      }

      if (!fusion) {
        throw new Error('No final fusion result was returned.')
      }

      setReport({
        generatedAt: new Date().toISOString(),
        fusion,
      })
      setStage('results')
    } catch (err) {
      setError(err.message)
      setStage('upload')
    }
  }

  const exportPdf = () => {
    if (!report?.fusion) return
    const doc = new jsPDF()
    const fusion = report.fusion
    const generated = new Date(report.generatedAt).toLocaleString()

    doc.setFontSize(16)
    doc.text('Compass ASD Assessment Report', 14, 18)
    doc.setFontSize(10)
    doc.text(`Generated: ${generated}`, 14, 25)
    doc.text(`Final Label: ${formatLabel(fusion.label)}`, 14, 31)
    doc.text(`Confidence: ${(fusion.confidence * 100).toFixed(1)}%`, 14, 37)

    autoTable(doc, {
      startY: 44,
      head: [['Modality', 'Predicted Label', 'Top Feature', 'CV F1']],
      body: STEP_CONFIG.map((item) => {
        const row = modalityRows.find((evt) => evt.modality === item.key)
        const err = modalityErrors.find((evt) => evt.modality === item.key)
        return [
          item.title,
          row ? formatLabel(row.label) : 'Failed',
          row?.top_feature || (err ? err.message : '-'),
          row?.cv_f1?.toFixed(3) || '-',
        ]
      }),
    })

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [['Class', 'Probability']],
      body: Object.entries(fusion.probabilities || {})
        .sort((a, b) => b[1] - a[1])
        .map(([cls, prob]) => [formatLabel(cls), `${(prob * 100).toFixed(2)}%`]),
    })

    if (fusion.modality_shap) {
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 8,
        head: [['Modality', 'SHAP Importance']],
        body: Object.entries(fusion.modality_shap)
          .sort((a, b) => b[1] - a[1])
          .map(([modality, shap]) => [formatLabel(modality), shap.toFixed(4)]),
      })
    }

    doc.save(`compass-report-${Date.now()}.pdf`)
  }

  return (
    <div className="app-shell">
      <header className="hero-nav">
        <h1>Compass</h1>
        <button className="ghost-btn" onClick={() => setStage('home')}>Home</button>
      </header>

      {stage === 'home' && (
        <main className="home-view">
          <section className="hero-card reveal">
            <h2>Multimodal ASD Decision Support</h2>
            <p>
              A guided assessment workflow that combines physiology, motion, voice, and image
              signals into a structured, clinician-friendly report.
            </p>
            <button className="primary-btn" onClick={startAssessment}>Get Started</button>
          </section>

          <section className="section-grid">
            {HOME_SECTIONS.map((section) => (
              <article key={section.title} className="info-card reveal">
                <h3>{section.title}</h3>
                <p>{section.body}</p>
              </article>
            ))}
          </section>
        </main>
      )}

      {stage === 'upload' && (
        <main className="upload-view">
          <div className="stepper">
            {STEP_CONFIG.map((item, idx) => (
              <div key={item.key} className={`step-dot ${idx <= step ? 'active' : ''}`} />
            ))}
          </div>

          <section className="upload-card reveal">
            <h2>{currentStep.title}</h2>
            <p>{currentStep.description}</p>
            <ul>
              {currentStep.instructions.map((line) => <li key={line}>{line}</li>)}
            </ul>

            <label className="file-picker">
              <input
                type="file"
                accept={currentStep.accept}
                onChange={(event) => onUploadFile(currentStep.key, event.target.files?.[0])}
              />
              <span>{files[currentStep.key]?.name || 'Choose file'}</span>
            </label>
          </section>

          <div className="action-row">
            <button
              className="ghost-btn"
              onClick={() => setStep((prev) => Math.max(0, prev - 1))}
              disabled={step === 0}
            >
              Back
            </button>
            {step < STEP_CONFIG.length - 1 ? (
              <button
                className="primary-btn"
                onClick={() => setStep((prev) => Math.min(STEP_CONFIG.length - 1, prev + 1))}
                disabled={!files[currentStep.key]}
              >
                Next
              </button>
            ) : (
              <button className="primary-btn" onClick={() => setStage('review')} disabled={!allFilesReady}>
                Review & Proceed
              </button>
            )}
          </div>
          {error && <div className="error-box">{error}</div>}
        </main>
      )}

      {stage === 'review' && (
        <main className="review-view reveal">
          <h2>Proceed With Prediction</h2>
          <p>Verify all uploaded files before running the multimodal prediction.</p>
          <div className="review-table">
            {STEP_CONFIG.map((item) => (
              <div key={item.key} className="review-row">
                <span>{item.title}</span>
                <span>{files[item.key]?.name || 'Missing'}</span>
              </div>
            ))}
          </div>
          <div className="action-row">
            <button className="ghost-btn" onClick={() => setStage('upload')}>Edit Uploads</button>
            <button className="primary-btn" onClick={runPrediction}>Run Prediction</button>
          </div>
        </main>
      )}

      {stage === 'predicting' && (
        <main className="loading-view">
          <div className="loader-ring" />
          <h2>Analyzing Inputs...</h2>
          <p>{LOADING_FACTS[loadingFactIndex]}</p>
        </main>
      )}

      {stage === 'results' && report?.fusion && (
        <main className="results-view reveal">
          <div className="result-header">
            <h2>Assessment Result</h2>
            <button className="ghost-btn" onClick={exportPdf}>Export PDF</button>
          </div>

          <section className="detailed-section">
            <h3>Detailed Multimodal Results</h3>
            <p>Review all streamed modality outcomes and probability bars before reading the clinical summary.</p>
            <StreamEvents events={events} />
            <FusionResult result={report.fusion} />
          </section>

          <section className="summary-section">
            <h3>Clinical Summary (Tabular)</h3>
            <p>Structured summary suitable for sharing with clinicians.</p>
          <div className="result-banner">
            <div>
              <strong>Final Classification:</strong> {formatLabel(report.fusion.label)}
            </div>
            <div>
              <strong>Confidence:</strong> {(report.fusion.confidence * 100).toFixed(1)}%
            </div>
          </div>

          <table className="clinical-table">
            <thead>
              <tr>
                <th>Modality</th>
                <th>Prediction</th>
                <th>Top Feature</th>
                <th>CV F1</th>
              </tr>
            </thead>
            <tbody>
              {STEP_CONFIG.map((item) => {
                const row = modalityRows.find((evt) => evt.modality === item.key)
                const err = modalityErrors.find((evt) => evt.modality === item.key)
                return (
                <tr key={item.key}>
                  <td>{item.title}</td>
                  <td>{row ? formatLabel(row.label) : 'Failed'}</td>
                  <td>{row?.top_feature || (err ? err.message : '-')}</td>
                  <td>{row?.cv_f1?.toFixed(3) || '-'}</td>
                </tr>
                )
              })}
            </tbody>
          </table>

          <table className="clinical-table">
            <thead>
              <tr>
                <th>Class</th>
                <th>Probability</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(report.fusion.probabilities)
                .sort((a, b) => b[1] - a[1])
                .map(([cls, prob]) => (
                  <tr key={cls}>
                    <td>{formatLabel(cls)}</td>
                    <td>{(prob * 100).toFixed(2)}%</td>
                  </tr>
                ))}
            </tbody>
          </table>
          </section>

          <div className="action-row">
            <button className="ghost-btn" onClick={() => setStage('home')}>Back To Home</button>
            <button className="primary-btn" onClick={startAssessment}>Run New Assessment</button>
          </div>
        </main>
      )}
    </div>
  )
}

function formatLabel(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export default App
