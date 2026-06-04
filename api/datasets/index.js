import { readDatasetIndex, pluginAuthorized, send, fail } from '../_lib/aps.js'

// GET /api/datasets  → lista las planillas publicadas para que el plugin de
// Navisworks deje elegir cuáles sincronizar. Requiere el token del plugin.
// Respuesta: { datasets: [ { key, name, count, updatedAt } ] }
export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return send(res, 405, { error: 'Método no permitido' })
    if (!pluginAuthorized(req)) {
      return send(res, 401, { error: 'No autorizado: falta o no coincide el token (Authorization: Bearer <SQY_API_TOKEN>).' })
    }
    const datasets = await readDatasetIndex()
    return send(res, 200, { datasets })
  } catch (e) {
    fail(res, 500, 'Error interno del servidor', e)
  }
}
