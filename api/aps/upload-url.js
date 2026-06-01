import { getSignedUpload, send } from '../_lib/aps.js'

// POST /api/aps/upload-url  body: { name }
// Devuelve { objectKey, uploadKey, urls } para que el navegador suba el modelo
// directo a S3/Autodesk (evita el límite de tamaño de las funciones de Vercel).
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido' })
  try {
    const name = (req.body?.name || 'modelo').replace(/[^\w.\-]/g, '_')
    const objectKey = `${Date.now()}-${name}`
    const { uploadKey, urls } = await getSignedUpload(objectKey)
    send(res, 200, { objectKey, uploadKey, urls })
  } catch (e) {
    send(res, 500, { error: e.message })
  }
}
