import { datasetObjectKey, putJsonObject, readJsonObject, upsertDatasetIndex, pluginAuthorized, send } from '../_lib/aps.js'

// POST /api/datasets/:key  → publica el dataset editado (desde la web Sonqollay)
// GET  /api/datasets/:key  → lo descarga (plugin de Navisworks; requiere token)
//
// El dataset se guarda como JSON en el bucket de APS. Formato devuelto en GET:
//   { key, name, tagField, headers: [...], rows: [ {col: val, ...} ], count, updatedAt }
// `tagField` es la columna que vincula cada fila con el modelo (por defecto la 1ª).
export default async function handler(req, res) {
  try {
    const key = String(req.query.key || '').trim()
    if (!key) return send(res, 400, { error: 'Falta key' })
    const objectKey = datasetObjectKey(key)

    if (req.method === 'POST') {
      const b = req.body || {}
      const headers = Array.isArray(b.headers) ? b.headers : []
      const rows = Array.isArray(b.rows) ? b.rows : []
      const payload = {
        key,
        name: b.name || key,
        tagField: b.tagField || headers[0] || null,
        headers,
        rows,
        count: rows.length,
        updatedAt: new Date().toISOString(),
      }
      await putJsonObject(objectKey, payload)
      await upsertDatasetIndex({ key, name: payload.name, count: rows.length, updatedAt: payload.updatedAt })
      return send(res, 200, { ok: true, key, count: rows.length, url: `/api/datasets/${encodeURIComponent(key)}` })
    }

    if (req.method === 'GET') {
      if (!pluginAuthorized(req)) {
        return send(res, 401, { error: 'No autorizado: falta o no coincide el token (Authorization: Bearer <SQY_API_TOKEN>).' })
      }
      const data = await readJsonObject(objectKey)
      if (!data) return send(res, 404, { error: 'Dataset no publicado todavía para esa key.' })
      return send(res, 200, data)
    }

    return send(res, 405, { error: 'Método no permitido' })
  } catch (e) {
    send(res, 500, { error: e.message })
  }
}
