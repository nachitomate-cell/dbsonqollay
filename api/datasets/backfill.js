import { readDatasetIndex, datasetObjectKey, readJsonObject, putJsonObject, upsertDatasetIndex, send, fail } from '../_lib/aps.js'
import { upsertDatasetToDb } from '../_lib/db.js'
import { getUserFromRequest } from '../_lib/auth.js'
import { projectRole } from '../_lib/orgs.js'

// POST /api/datasets/backfill  { projectId }
// Copia las planillas GLOBALES (legacy, las publicadas antes del multi-tenant)
// al proyecto indicado, para migrar los datos existentes sin perder nada. No
// pisa una planilla que el proyecto ya tenga. Requiere admin/editor del proyecto.
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido' })
    const user = await getUserFromRequest(req)
    if (!user) return send(res, 401, { error: 'Inicia sesión.' })

    const projectId = String(req.body?.projectId || '').trim()
    if (!projectId) return send(res, 400, { error: 'Falta projectId' })

    const role = await projectRole(user.id, projectId)
    if (!['admin', 'editor'].includes(role)) {
      return send(res, 403, { error: 'No tienes permiso sobre ese proyecto.' })
    }

    const globalIdx = await readDatasetIndex(null)
    let copied = 0, skipped = 0
    for (const entry of globalIdx) {
      const data = await readJsonObject(datasetObjectKey(entry.key, null))
      if (!data) { skipped++; continue }
      // No pisar si el proyecto ya tiene esa planilla.
      if (await readJsonObject(datasetObjectKey(entry.key, projectId))) { skipped++; continue }
      await putJsonObject(datasetObjectKey(entry.key, projectId), data)
      await upsertDatasetIndex(
        { key: entry.key, name: data.name || entry.name, count: data.count ?? (data.rows?.length || 0), updatedAt: data.updatedAt },
        projectId,
      )
      try { await upsertDatasetToDb(data, projectId) } catch { /* DataTools best-effort */ }
      copied++
    }
    return send(res, 200, { ok: true, copied, skipped, project: projectId })
  } catch (e) {
    if (e.status) return send(res, e.status, { error: e.message })
    fail(res, 500, 'No se pudo migrar las planillas', e)
  }
}
