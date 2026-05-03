import { motion } from 'framer-motion'
import { Upload, CheckCircle2, ChevronRight, ChevronLeft, Info, Activity, Camera, Mic, Key } from 'lucide-react'

const STEP_ICONS = {
  physio: Activity,
  motion: Key,
  voice: Mic,
  image: Camera
}

export default function UploadFlow({
  stepConfig,
  currentStepIndex,
  files,
  onUploadFile,
  onNext,
  onBack,
  onReview,
  error
}) {
  const isReviewStep = currentStepIndex === stepConfig.length
  
  if (isReviewStep) {
    const allFilesReady = stepConfig.every((item) => files[item.key])
    return (
      <motion.div 
        className="upload-flow-container review-container"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <div className="review-card">
          <h2 className="step-title">Proceed With Prediction</h2>
          <p className="step-desc">Verify all uploaded files before running the multimodal prediction. Our models will process this securely.</p>
          
          <div className="review-list">
            {stepConfig.map((item) => (
              <div key={item.key} className="review-item">
                <div className="review-item-info">
                  <CheckCircle2 className="success-icon" size={24} />
                  <span className="review-label">{item.title}</span>
                </div>
                <span className="review-filename">{files[item.key]?.name || 'Missing'}</span>
              </div>
            ))}
          </div>

          {error && (
            <motion.div 
              className="error-banner"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {error}
            </motion.div>
          )}

          <div className="step-actions review-actions">
            <button className="btn-ghost" onClick={onBack}>
              Edit Uploads
            </button>
            <button 
              className="btn-primary large" 
              onClick={onReview}
              disabled={!allFilesReady}
            >
              Run Prediction
            </button>
          </div>
        </div>
      </motion.div>
    )
  }

  const currentStep = stepConfig[currentStepIndex]
  const StepIcon = STEP_ICONS[currentStep.key] || Activity

  return (
    <div className="upload-flow-container">
      {/* Progress Indicator */}
      <div className="progress-bar-container">
        <div className="progress-track">
          <motion.div 
            className="progress-fill" 
            initial={{ width: 0 }}
            animate={{ width: `${(currentStepIndex / stepConfig.length) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <p className="progress-text">Step {currentStepIndex + 1} of {stepConfig.length}</p>
      </div>

      {/* Main Upload Card */}
      <motion.div 
        key={currentStep.key} // Forces re-animation on step change
        className="upload-card-wrapper"
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -50 }}
        transition={{ duration: 0.4 }}
      >
        <div className="upload-header">
          <div className="icon-circle">
            <StepIcon size={32} />
          </div>
          <h2 className="step-title">{currentStep.title}</h2>
        </div>
        
        <p className="step-desc">{currentStep.description}</p>
        
        <div className="info-box">
          <Info size={20} className="info-icon" />
          <div className="info-content">
            <h4>How to get this data:</h4>
            <ul>
              {currentStep.instructions.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        </div>

        <label className="file-dropzone">
          <input
            type="file"
            accept={currentStep.accept}
            onChange={(e) => onUploadFile(currentStep.key, e.target.files?.[0])}
            className="hidden-input"
          />
          <div className="dropzone-content">
            {files[currentStep.key] ? (
              <>
                <CheckCircle2 size={48} className="success-icon" />
                <span className="file-selected">{files[currentStep.key].name}</span>
                <span className="file-reselect">Click to change file</span>
              </>
            ) : (
              <>
                <Upload size={48} className="upload-icon" />
                <span className="upload-prompt">Click or drag file to upload</span>
                <span className="upload-hint">Accepted formats: {currentStep.accept}</span>
              </>
            )}
          </div>
        </label>

        {error && (
          <motion.div className="error-banner" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {error}
          </motion.div>
        )}

        <div className="step-actions">
          <button 
            className="btn-ghost" 
            onClick={onBack}
            disabled={currentStepIndex === 0}
          >
            <ChevronLeft size={20} /> Back
          </button>
          <button 
            className="btn-primary" 
            onClick={onNext}
            disabled={!files[currentStep.key]}
          >
            Next Step <ChevronRight size={20} />
          </button>
        </div>
      </motion.div>
    </div>
  )
}
