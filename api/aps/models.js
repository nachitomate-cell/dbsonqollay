import { deleteObject, listObjects, send } from '../_lib/aps.js'

// GET    /api/aps/models                → lista los modelos del bucket
// DELETE /api/aps/models?objectKey=...   → borra un objeto del bucket
export default async function handler(req, res) {
  try {
    if (req.method === 'DELETE') {
      const objectKey = req.query?.objectKey
      if (!objectKey) return send(res, 400, { error: 'Falta objectKey' })
      await deleteObject(objectKey)
      return send(res, 200, { ok: true })
    }
    send(res, 200, await listObjects())
  } catch (e) {
    send(res, 500, { error: e.message })
  }
}
