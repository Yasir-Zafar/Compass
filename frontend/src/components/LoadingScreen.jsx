import { motion } from 'framer-motion'
import { HeartPulse } from 'lucide-react'

export default function LoadingScreen({ facts, currentFactIndex }) {
  return (
    <div className="loading-container">
      <motion.div 
        className="loading-content"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
      >
        <div className="pulsing-heart-container">
          <motion.div
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.5, 1, 0.5]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <HeartPulse size={80} className="heart-icon" />
          </motion.div>
        </div>
        
        <h2 className="loading-title">Analyzing Multimodal Data</h2>
        <div className="loading-bar-container">
          <motion.div 
            className="loading-bar-fill"
            animate={{ x: ["-100%", "100%"] }}
            transition={{ 
              duration: 2, 
              repeat: Infinity, 
              ease: "linear" 
            }}
          />
        </div>

        <motion.div 
          className="fact-container"
          key={currentFactIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.5 }}
        >
          <p className="fact-text">{facts[currentFactIndex]}</p>
        </motion.div>
      </motion.div>
    </div>
  )
}
