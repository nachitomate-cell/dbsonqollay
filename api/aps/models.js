import { deleteObject, listObjects, send, fail } from '../_lib/aps.js'

// GET    /api/aps/models[?tenant=<empresa>] → lista los modelos del bucket
//                                              (filtrados por empresa si se pasa)
// DELETE /api/aps/models?objectKey=...        → borra un objeto del bucket
export default async function handler(req, res) {
  try {
    if (req.method === 'DELETE') {
      const objectKey = req.query?.objectKey
      if (!objectKey) return send(res, 400, { error: 'Falta objectKey' })
      await deleteObject(objectKey)
      return send(res, 200, { ok: true })
    }
    const all = await listObjects()
    const tenant = req.query?.tenant
    send(res, 200, tenant ? all.filter((o) => o.tenant === tenant) : all)
  } catch (e) {
    fail(res, 500, 'Error interno del servidor', e)
  }
}
