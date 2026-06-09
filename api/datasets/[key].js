import { datasetObjectKey, putJsonObject, readJsonObject, upsertDatasetIndex, removeFromDatasetIndex, deleteObject, pluginAuthorized, send, fail } from '../_lib/aps.js'
import { upsertDatasetToDb, deleteDatasetFromDb } from '../_lib/db.js'
import { getUserFromRequest } from '../_lib/auth.js'
import { recordDatasetEdit } from '../_lib/audit.js'

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
      // Regla de negocio: TODO valor de texto de las planillas se almacena en
      // MAYÚSCULAS (números y no-texto se dejan tal cual). Red de seguridad en
      // el servidor por si llega algo sin normalizar desde el cliente.
      const upper = (v) => (typeof v === 'string' ? v.toUpperCase() : v)
      const rows = (Array.isArray(b.rows) ? b.rows : []).map((r) => {
        if (!r || typeof r !== 'object') return r
        const out = {}
        for (const k in r) out[k] = upper(r[k])
        return out
      })
      // Límites anti-abuso (defensa básica mientras no haya auth; Vercel ya
      // limita el body a ~4.5MB). Una planilla real ronda cientos de filas.
      if (headers.length > 500) return send(res, 413, { error: 'Demasiadas columnas (máx 500).' })
      if (rows.length > 200000) return send(res, 413, { error: 'Demasiadas filas (máx 200000).' })
      // Set completo de columnas con visibilidad (para la web): no se pierden las
      // columnas ocultas al recuperar el dataset en otro equipo. `headers` (solo
      // visibles) se conserva para el plugin de Navisworks.
      const columns = Array.isArray(b.columns)
        ? b.columns.filter((c) => c && typeof c.key === 'string').map((c) => ({ key: c.key, visible: c.visible !== false }))
        : null
      const payload = {
        key,
        name: b.name || key,
        tagField: b.tagField || headers[0] || null,
        headers,
        ...(columns ? { columns } : {}),
        rows,
        count: rows.length,
        updatedAt: new Date().toISOString(),
      }
      // Audit (quién/cuándo/qué cambió). ANTES de sobrescribir, para poder
      // comparar contra el dataset anterior. Best-effort: nunca rompe el guardado.
      try {
        const u = await getUserFromRequest(req)
        const author = u?.email || b.author || (pluginAuthorized(req) ? 'Plugin Navisworks' : 'desconocido')
        await recordDatasetEdit({
          key,
          name: payload.name,
          user: author,
          tagField: payload.tagField,
          newRows: rows,
          getOld: () => readJsonObject(objectKey),
          at: payload.updatedAt,
        })
      } catch (e) {
        console.error('[audit]', e?.message)
      }

      await putJsonObject(objectKey, payload)
      await upsertDatasetIndex({ key, name: payload.name, count: rows.length, updatedAt: payload.updatedAt })

      // Aditivo: replicar a la base de datos (Postgres/Supabase) para que el
      // modelo la lea en vivo por DataTools. Si falla o no está configurada,
      // NO rompe el publish (el bucket APS ya quedó guardado arriba).
      let db = { skipped: true }
      try {
        db = await upsertDatasetToDb(payload)
      } catch (e) {
        db = { error: e.message }
      }

      return send(res, 200, { ok: true, key, count: rows.length, db, url: `/api/datasets/${encodeURIComponent(key)}` })
    }

    if (req.method === 'GET') {
      // Autoriza al PLUGIN (token SQY_API_TOKEN), a un USUARIO logueado (JWT de
      // Supabase), o a la SESIÓN DE PRUEBA (token 'demo') para que el cliente pueda
      // probar la persistencia real sin login. Así la web recupera de la DB lo
      // último guardado al reabrir, en cualquier equipo.
      // TODO (cierre): quitar `okDemo` y scopear por project_id (migración 002).
      const okPlugin = pluginAuthorized(req)
      const okDemo = (req.headers?.authorization || '') === 'Bearer demo'
      const user = (okPlugin || okDemo) ? null : await getUserFromRequest(req)
      if (!okPlugin && !okDemo && !user) {
        return send(res, 401, { error: 'No autorizado: inicia sesión o usa el token del plugin.' })
      }
      const data = await readJsonObject(objectKey)
      if (!data) return send(res, 404, { error: 'Dataset no publicado todavía para esa key.' })
      return send(res, 200, data)
    }

    if (req.method === 'DELETE') {
      // Destructivo: exige el token del plugin (igual que el GET).
      if (!pluginAuthorized(req)) {
        return send(res, 401, { error: 'No autorizado: falta o no coincide el token (Authorization: Bearer <SQY_API_TOKEN>).' })
      }
      await deleteObject(objectKey)
      const removedFromIndex = await removeFromDatasetIndex(key)

      let db = { skipped: true }
      try {
        db = await deleteDatasetFromDb(key)
      } catch (e) {
        db = { error: e.message }
      }

      return send(res, 200, { ok: true, key, removedFromIndex, db })
    }

    return send(res, 405, { error: 'Método no permitido' })
  } catch (e) {
    fail(res, 500, 'Error interno del servidor', e)
  }
}
