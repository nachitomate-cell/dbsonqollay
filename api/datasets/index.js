import { readDatasetIndex, pluginAuthorized, send, fail } from '../_lib/aps.js'
import { clientByToken } from '../_lib/clients.js'

// GET /api/datasets[?project=<id>]  → lista las planillas publicadas (del proyecto
// activo, o globales) para que el plugin de Navisworks deje elegir cuáles
// sincronizar. Requiere el token del plugin. Respuesta: { datasets: [...] }
function resolveProject(req) {
  const q = String(req.query?.project || '').trim()
  if (q) return q
  const auth = req.headers?.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : (req.query?.token || '')
  return clientByToken(token)?.projectId || null
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return send(res, 405, { error: 'Método no permitido' })
    if (!pluginAuthorized(req)) {
      return send(res, 401, { error: 'No autorizado: falta o no coincide el token (Authorization: Bearer <SQY_API_TOKEN>).' })
    }
    const datasets = await readDatasetIndex(resolveProject(req))
    return send(res, 200, { datasets })
  } catch (e) {
    fail(res, 500, 'Error interno del servidor', e)
  }
}
