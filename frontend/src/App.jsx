import { useEffect, useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { motion, AnimatePresence } from 'framer-motion'
import './App.css'
import './index.css'

// New Components
import Home from './components/Home'
import UploadFlow from './components/UploadFlow'
import LoadingScreen from './components/LoadingScreen'
import ResultsView from './components/ResultsView'

const STEP_CONFIG = [
  {
    key: 'physio',
    title: 'Physiological Input',
    accept: '.csv',
    description: 'Upload a CSV containing heart rate, skin response, and temperature.',
    instructions: [
      'Extract data from a clinical wearable (e.g., Empatica E4, Garmin, or Apple Watch) or a clinical lab session.',
      'HR: heart rate per sample',
      'GSR: galvanic skin response values',
      'TEMP: skin/body temperature readings',
      'Ensure data covers at least 5 minutes of baseline recording.'
    ],
  },
  {
    key: 'motion',
    title: '3D Motion Input',
    accept: '.json',
    description: 'Upload a JSON file containing tracked 3D joints across frames.',
    instructions: [
      'Extract JSON from a standard pose estimation tool (e.g., MediaPipe).',
      'Ensure the head and upper-body joints are fully visible.',
      'Recording should ideally be taken during a structured activity or free play.'
    ],
  },
  {
    key: 'voice',
    title: 'Voice Input',
    accept: '.wav',
    description: 'Upload a clear WAV audio recording.',
    instructions: [
      'Record in a quiet room with minimal background noise.',
      'Aim for at least 10-20 seconds of continuous speech or vocalization.',
      'Avoid heavy echo or clipping.'
    ],
  },
  {
    key: 'image',
    title: 'Facial Image Input',
    accept: '.jpg,.png',
    description: 'Upload a frontal facial image.',
    instructions: [
      'Use natural, neutral lighting.',
      'Keep the face centered and fully visible without obstructions.',
      'Ensure high resolution to capture subtle expressions.'
    ],
  },
]

const LOADING_FACTS = [
  'Autism is a spectrum; each person has unique strengths and support needs.',
  'Screening tools help guide attention but do not replace expert diagnosis.',
  'Early support can improve communication, confidence, and quality of life.',
  'A calm routine before testing can improve data quality and comfort.',
  'Multimodal analysis gives a more complete picture than any single test.',
  'Share full context with clinicians for better interpretation of model results.'
]

export default function App() {
  const [stage, setStage] = useState('home')
  const [step, setStep] = useState(0)
  const [files, setFiles] = useState({})
  const [events, setEvents] = useState([])
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  const [loadingFactIndex, setLoadingFactIndex] = useState(0)

  // Loading Screen Fact Rotation
  useEffect(() => {
    if (stage !== 'predicting') return undefined
    const id = setInterval(() => {
      setLoadingFactIndex((prev) => (prev + 1) % LOADING_FACTS.length)
    }, 4000)
    return () => clearInterval(id)
  }, [stage])

  const modalityRows = useMemo(
    () => events.filter((evt) => evt.event === 'modality'),
    [events]
  )
  const modalityErrors = useMemo(
    () => events.filter((evt) => evt.event === 'error' && evt.modality !== 'server' && evt.modality !== 'fusion'),
    [events]
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
    setError('')
  }

  const runPrediction = async () => {
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
      setStep(STEP_CONFIG.length) // Go back to review step
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
    
    // Label Formatting Helper
    const fmt = (val) => String(val || '').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase())

    doc.text(`Final Label: ${fmt(fusion.label)}`, 14, 31)
    doc.text(`Confidence: ${(fusion.confidence * 100).toFixed(1)}%`, 14, 37)

    autoTable(doc, {
      startY: 44,
      head: [['Modality', 'Predicted Label', 'Top Feature', 'CV F1']],
      body: STEP_CONFIG.map((item) => {
        const row = modalityRows.find((evt) => evt.modality === item.key)
        const err = modalityErrors.find((evt) => evt.modality === item.key)
        return [
          item.title,
          row ? fmt(row.label) : 'Failed',
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
        .map(([cls, prob]) => [fmt(cls), `${(prob * 100).toFixed(2)}%`]),
    })

    doc.save(`compass-report-${Date.now()}.pdf`)
  }

  return (
    <div className="app-layout">
      {/* Universal Header */}
      <header className="global-nav">
        <div className="logo-container" onClick={() => setStage('home')}>
          <div className="logo-mark"></div>
          <span className="logo-text">Compass</span>
        </div>
        <nav className="nav-links">
          {stage !== 'home' && (
            <button className="btn-ghost small" onClick={() => setStage('home')}>Return Home</button>
          )}
        </nav>
      </header>

      {/* Main Content Area with Transitions */}
      <main className="main-content">
        <AnimatePresence mode="wait">
          {stage === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Home onStart={startAssessment} />
            </motion.div>
          )}

          {stage === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <UploadFlow
                stepConfig={STEP_CONFIG}
                currentStepIndex={step}
                files={files}
                onUploadFile={onUploadFile}
                onNext={() => setStep(prev => prev + 1)}
                onBack={() => setStep(prev => Math.max(0, prev - 1))}
                onReview={runPrediction}
                error={error}
              />
            </motion.div>
          )}

          {stage === 'predicting' && (
            <motion.div
              key="predicting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <LoadingScreen 
                facts={LOADING_FACTS} 
                currentFactIndex={loadingFactIndex} 
              />
            </motion.div>
          )}

          {stage === 'results' && (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <ResultsView 
                report={report}
                stepConfig={STEP_CONFIG}
                modalityRows={modalityRows}
                modalityErrors={modalityErrors}
                onExportPdf={exportPdf}
                onRestart={startAssessment}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
