import { listObjects, readJsonObject, send, fail } from '../_lib/aps.js'

// GET /api/audit  → ediciones recientes de TODAS las planillas, más nuevas
// primero: quién editó, qué planilla, cuándo y qué cambió (filas +/−/modif).
export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Método no permitido' })
  try {
    const objs = await listObjects()
    const auditKeys = objs
      .map((o) => o.objectKey)
      .filter((k) => String(k).startsWith('audit/'))

    const all = []
    for (const k of auditKeys) {
      const log = await readJsonObject(k)
      const name = log?.name || String(k).replace(/^audit\//, '').replace(/\.json$/, '')
      for (const e of log?.events || []) all.push({ ...e, dataset: name, key: log?.key })
    }
    all.sort((a, b) => Date.parse(b.at || 0) - Date.parse(a.at || 0))
    send(res, 200, all.slice(0, 200))
  } catch (e) {
    fail(res, 500, 'No se pudo leer el historial de cambios', e)
  }
}
