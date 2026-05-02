import './FileUpload.css'

const modalityIcons = {
  physio: '♥',
  motion: '↔',
  voice: '♫',
  image: '◻',
}

function FileUpload({ modality, file, onChange }) {
  const handleChange = (e) => {
    const selected = e.target.files?.[0]
    if (selected) {
      onChange(selected)
    }
  }

  return (
    <label className={`file-upload ${modality.color} ${file ? 'has-file' : ''}`}>
      <input
        type="file"
        accept={modality.accept}
        onChange={handleChange}
        className="file-input"
      />
      <div className="upload-content">
        <div className="upload-icon">{modalityIcons[modality.key]}</div>
        <div className="upload-info">
          <span className="upload-label">{modality.label}</span>
          {file ? (
            <span className="upload-file-name">{file.name}</span>
          ) : (
            <span className="upload-desc">{modality.desc}</span>
          )}
        </div>
        <div className="upload-status">
          {file ? (
            <span className="status-check">✓</span>
          ) : (
            <span className="status-arrow">↑</span>
          )}
        </div>
      </div>
    </label>
  )
}

export default FileUpload
