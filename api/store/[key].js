import { putJsonObject, readJsonObject, pluginAuthorized, send, fail } from '../_lib/aps.js'
import { getUserFromRequest } from '../_lib/auth.js'

// Almacén genérico de JSON por clave (en el bucket APS). Lo usa el Workspace AWP
// para persistir en la nube la configuración del proyecto y las entidades
// (CWA/CWP/IWP, restricciones, revisiones, sesiones), no solo en localStorage.
//
//   GET  /api/store/:key  → devuelve el JSON guardado (404 si no hay)
//   POST /api/store/:key  → guarda el body como JSON
//
// Autoriza al plugin (token), a un usuario logueado (JWT) o a la sesión de prueba
// ('demo'), igual que /api/datasets. Las claves incluyen el id de proyecto, así
// que el aislamiento es por clave (scoping fuerte por project_id = pendiente B2).
const objKey = (key) => `sqy-store/${key}.json`

export default async function handler(req, res) {
  try {
    const key = String(req.query.key || '').trim()
    if (!key) return send(res, 400, { error: 'Falta key' })

    const okPlugin = pluginAuthorized(req)
    const okDemo = (req.headers?.authorization || '') === 'Bearer demo'
    const user = (okPlugin || okDemo) ? null : await getUserFromRequest(req)
    if (!okPlugin && !okDemo && !user) {
      return send(res, 401, { error: 'No autorizado: inicia sesión.' })
    }

    if (req.method === 'GET') {
      const data = await readJsonObject(objKey(key))
      if (!data) return send(res, 404, { error: 'Sin datos para esa clave.' })
      return send(res, 200, data)
    }

    if (req.method === 'POST') {
      const body = req.body
      if (!body || typeof body !== 'object') return send(res, 400, { error: 'Body inválido.' })
      await putJsonObject(objKey(key), body)
      return send(res, 200, { ok: true, key, updatedAt: new Date().toISOString() })
    }

    return send(res, 405, { error: 'Método no permitido' })
  } catch (e) {
    fail(res, 500, 'Error interno del servidor', e)
  }
}
