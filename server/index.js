import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth.js'

dotenv.config({ path: new URL('../.env', import.meta.url).pathname })

const app  = express()
const PORT = process.env.PORT || 3001

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json())

// Routes
app.use('/api/auth', authRoutes)

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }))

app.listen(PORT, () => {
  console.log(`\n  ╔══════════════════════════════════════╗`)
  console.log(`  ║  Eleventh Round API  → :${PORT}        ║`)
  console.log(`  ╚══════════════════════════════════════╝\n`)
})
