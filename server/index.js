/**
 * Backend mínimo de Sonqollay para Autodesk Platform Services (APS).
 *
 * Expone solo lo necesario para el visor del navegador, sin filtrar el
 * Client Secret al frontend:
 *   GET  /api/aps/token              -> token de solo lectura para el visor
 *   POST /api/aps/models            -> sube un modelo (multipart "file") y lo traduce
 *   GET  /api/aps/models/:urn/status-> estado de la traducción
 *   GET  /api/health                -> healthcheck
 *
 * Uso:
 *   1) cp .env.example .env  (y pegá tus llaves)
 *   2) npm install
 *   3) npm start
 */
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import {
  ensureBucket,
  getManifest,
  getViewerToken,
  translate,
  uploadObject,
} from './aps.js'

const app = express()
const PORT = process.env.PORT || 3000
const BUCKET = (process.env.APS_BUCKET || 'sonqollay-models').toLowerCase()

app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }))
app.use(express.json())

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } })

const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(e)
  res.status(500).json({ error: e.message })
})

app.get('/api/health', (_req, res) => res.json({ ok: true }))

// Token para el APS Viewer (scope viewables:read, sin secret).
app.get('/api/aps/token', wrap(async (_req, res) => {
  const access_token = await getViewerToken()
  res.json({ access_token, expires_in: 3000 })
}))

// Sube un modelo (campo multipart "file") al bucket y lanza la traducción.
app.post('/api/aps/models', upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Falta el archivo (campo "file").' })
  await ensureBucket(BUCKET)
  const objectKey = `${Date.now()}-${req.file.originalname.replace(/[^\w.\-]/g, '_')}`
  const objectId = await uploadObject(BUCKET, objectKey, req.file.buffer)
  const { urn } = await translate(objectId)
  res.json({ urn, objectKey, name: req.file.originalname })
}))

// Estado de la traducción.
app.get('/api/aps/models/:urn/status', wrap(async (req, res) => {
  const manifest = await getManifest(req.params.urn)
  res.json({ status: manifest.status, progress: manifest.progress })
}))

app.listen(PORT, () => {
  console.log(`Sonqollay APS server escuchando en http://localhost:${PORT}`)
  if (!process.env.APS_CLIENT_ID) console.warn('⚠️  Falta configurar .env (ver .env.example)')
})
