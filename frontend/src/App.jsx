import { useState } from 'react'
import './App.css'
import PredictTab from './components/PredictTab'
import ModelInfoTab from './components/ModelInfoTab'
import HealthTab from './components/HealthTab'

const tabs = [
  { id: 'predict', label: 'Predict', icon: '⚡' },
  { id: 'info', label: 'Model Info', icon: '📊' },
  { id: 'health', label: 'Health', icon: '💚' },
]

function App() {
  const [activeTab, setActiveTab] = useState('predict')

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Compass</h1>
        <p className="app-subtitle">Multimodal ASD Detection</p>
      </header>

      <nav className="tab-bar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      <main className="tab-content">
        {activeTab === 'predict' && <PredictTab />}
        {activeTab === 'info' && <ModelInfoTab />}
        {activeTab === 'health' && <HealthTab />}
      </main>
    </div>
  )
}

export default App
