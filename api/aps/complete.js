import { completeUpload, send, translate } from '../_lib/aps.js'

// POST /api/aps/complete  body: { objectKey, uploadKey }
// Confirma la subida S3 y lanza la traducción a SVF2. Devuelve { urn }.
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido' })
  try {
    const { objectKey, uploadKey } = req.body || {}
    if (!objectKey || !uploadKey) return send(res, 400, { error: 'Faltan objectKey / uploadKey' })
    const { objectId } = await completeUpload(objectKey, uploadKey)
    const { urn } = await translate(objectId)
    send(res, 200, { urn, objectKey })
  } catch (e) {
    send(res, 500, { error: e.message })
  }
}
