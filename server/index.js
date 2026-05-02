import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import multer from 'multer'

const app = express()
const upload = multer({ storage: multer.memoryStorage() })

const PORT = Number(process.env.PORT || 5000)
const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://127.0.0.1:8000'

app.use(cors())
app.use(express.json({ limit: '2mb' }))

app.get('/api/health', async (_req, res) => {
  try {
    const response = await fetch(`${PYTHON_API_URL}/health`)
    const data = await response.json()
    res.json({
      ...data,
      mern_gateway: true,
    })
  } catch (error) {
    res.status(502).json({
      status: 'error',
      message: `Python API unavailable: ${error.message}`,
    })
  }
})

app.get('/api/model-info', async (_req, res) => {
  try {
    const response = await fetch(`${PYTHON_API_URL}/model-info`)
    const data = await response.json()
    res.json(data)
  } catch (error) {
    res.status(502).json({ message: `Unable to fetch model info: ${error.message}` })
  }
})

app.post(
  '/api/predict',
  upload.fields([
    { name: 'physio', maxCount: 1 },
    { name: 'motion', maxCount: 1 },
    { name: 'voice', maxCount: 1 },
    { name: 'image', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const requiredFields = ['physio', 'motion', 'voice', 'image']
      for (const field of requiredFields) {
        if (!req.files?.[field]?.[0]) {
          return res.status(400).json({ detail: `Missing upload: ${field}` })
        }
      }

      const formData = new FormData()
      for (const field of requiredFields) {
        const file = req.files[field][0]
        formData.append(field, new Blob([file.buffer]), file.originalname)
      }

      const upstream = await fetch(`${PYTHON_API_URL}/predict`, {
        method: 'POST',
        body: formData,
      })

      if (!upstream.ok || !upstream.body) {
        const fallback = await upstream.text()
        return res.status(upstream.status).json({
          detail: fallback || 'Prediction upstream error',
        })
      }

      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')

      const reader = upstream.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        res.write(decoder.decode(value, { stream: true }))
      }
      res.end()
    } catch (error) {
      res.status(500).json({ detail: `Prediction proxy failed: ${error.message}` })
    }
  },
)

app.listen(PORT, () => {
  console.log(`Compass server listening on http://localhost:${PORT}`)
  console.log(`Proxying ML requests to ${PYTHON_API_URL}`)
})
