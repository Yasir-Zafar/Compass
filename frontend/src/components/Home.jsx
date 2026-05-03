import { motion } from 'framer-motion'
import { Activity, Brain, Shield, ArrowRight, Mic, Camera, Key } from 'lucide-react'

const HOME_SECTIONS = [
  {
    title: 'Physiological Signals',
    body: 'We analyze heart rate, skin temperature, and galvanic skin response to understand underlying stress and arousal levels.',
    icon: Activity,
  },
  {
    title: '3D Motion Tracking',
    body: 'By analyzing movement patterns and joint tracking, we identify specific motor behaviors and potential stimming actions.',
    icon: Key,
  },
  {
    title: 'Voice & Acoustics',
    body: 'Vocal analysis helps detect unique speech patterns, pitch variations, and rhythm associated with the spectrum.',
    icon: Mic,
  },
  {
    title: 'Facial Expressions',
    body: 'Visual cues and micro-expressions offer insight into emotional regulation and non-verbal communication styles.',
    icon: Camera,
  },
]

export default function Home({ onStart }) {
  return (
    <div className="home-container">
      {/* Section 1: Welcome */}
      <section className="snap-section hero-section">
        <motion.div 
          className="hero-content"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="main-title">Welcome to Compass</h1>
          <p className="subtitle">
            A professional, guided multimodal assessment tool for Autism Spectrum evaluation.
          </p>
          <p className="hero-description">
            Scroll down to learn more, or start the assessment immediately if you have your files ready.
          </p>
          <button className="btn-primary large" onClick={onStart}>
            Begin Assessment <ArrowRight className="btn-icon" size={20} />
          </button>
        </motion.div>
      </section>

      {/* Section 2: About Autism & the Platform */}
      <section className="snap-section split-section bg-light-blue">
        <motion.div 
          className="split-text"
          initial={{ opacity: 0, x: -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.8 }}
        >
          <h2>Understanding the Spectrum</h2>
          <p>
            Autism is not a single condition but a spectrum of diverse strengths and challenges. 
            Because every individual is unique, relying on a single observation method can miss important context.
          </p>
          <p>
            Compass uses advanced multimodal analysis—looking at physiological responses, movement patterns, vocal traits, and facial expressions—to provide a comprehensive, objective overview.
          </p>
        </motion.div>
        <motion.div 
          className="split-visual abstract-visual-1"
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          {/* Abstract placeholder for art */}
          <div className="art-placeholder">
            <Brain size={80} className="art-icon" />
          </div>
        </motion.div>
      </section>

      {/* Section 3: How it works (The 4 pillars) */}
      <section className="snap-section features-section">
        <motion.div 
          className="features-header"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2>Why Multimodal?</h2>
          <p>We analyze four distinct types of data to form a holistic picture.</p>
        </motion.div>

        <div className="features-grid">
          {HOME_SECTIONS.map((section, idx) => (
            <motion.div 
              key={section.title} 
              className="feature-card"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, delay: idx * 0.15 }}
            >
              <div className="icon-wrapper">
                <section.icon size={32} />
              </div>
              <h3>{section.title}</h3>
              <p>{section.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Section 4: Final CTA */}
      <section className="snap-section cta-section bg-gradient-blue">
        <motion.div 
          className="cta-content"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2>Ready to Begin?</h2>
          <p>
            You will need physiological data (CSV), motion tracking data (JSON), 
            a voice recording (WAV), and a facial image (JPG/PNG).
          </p>
          <p className="reassurance">
            Take your time. You will be guided through each step individually.
          </p>
          <button className="btn-primary large white-btn" onClick={onStart}>
            Get Started Now
          </button>
        </motion.div>
      </section>
    </div>
  )
}
