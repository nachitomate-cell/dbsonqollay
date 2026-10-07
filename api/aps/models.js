import { deleteObject, listObjects, pluginAuthorized, send, fail } from '../_lib/aps.js'
import { getUserFromRequest } from '../_lib/auth.js'

// Solo se borran ARCHIVOS DE MODELO. El bucket guarda también las planillas
// (datasets/), su historial (audit/) y el estado AWP (sqy-store/): antes este
// DELETE aceptaba cualquier objectKey sin token, así que cualquiera con la URL
// podía borrar las planillas del cliente.
const MODEL_FILE = /\.(nwd|nwc|nwf|rvt|ifc|dwg|dxf)$/i
const PROTECTED = /^(datasets|audit|sqy-store)\//i

// GET    /api/aps/models[?tenant=<empresa>] → lista los modelos del bucket
//                                              (filtrados por empresa si se pasa)
// DELETE /api/aps/models?objectKey=...        → borra un objeto del bucket
export default async function handler(req, res) {
  try {
    if (req.method === 'DELETE') {
      const objectKey = req.query?.objectKey
      if (!objectKey) return send(res, 400, { error: 'Falta objectKey' })
      if (PROTECTED.test(objectKey) || !MODEL_FILE.test(objectKey)) {
        return send(res, 403, { error: 'Solo se pueden borrar archivos de modelo.' })
      }
      // Mismo criterio que leer una planilla (api/datasets/[key].js): token del
      // plugin, sesión de prueba o usuario logueado.
      const okPlugin = pluginAuthorized(req)
      const okDemo = (req.headers?.authorization || '') === 'Bearer demo'
      if (!okPlugin && !okDemo && !(await getUserFromRequest(req))) {
        return send(res, 401, { error: 'No autorizado: inicia sesión para borrar modelos.' })
      }
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
