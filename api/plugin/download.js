import { clientByDownloadKey } from '../_lib/clients.js'
import { fetchTemplate, personalizeZip } from '../_lib/installer.js'
import { send, fail } from '../_lib/aps.js'

/**
 * GET /api/plugin/download[?key=<llave de descarga>]
 *
 * Sirve el instalador del plugin DESDE el backend (el repo puede ser privado).
 *   - Con `key` válida  → instalador con el token de ESA empresa inyectado.
 *   - Con `key` inválida → 403 (cliente desconocido o desactivado).
 *   - Sin `key`         → instalador con el token por defecto
 *                         (PLUGIN_DEFAULT_TOKEN o SQY_API_TOKEN); si no hay
 *                         ninguno, se sirve el ZIP tal cual lo armó el CI.
 *                         Esto mantiene andando el despliegue de un solo cliente.
 */
export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return send(res, 405, { error: 'Método no permitido' })

    const key = String(req.query.key || '').trim()
    let client = null
    if (key) {
      client = clientByDownloadKey(key)
      if (!client) {
        return send(res, 403, { error: 'Llave de descarga inválida o cliente desactivado.' })
      }
    }

    const token = client?.token || process.env.PLUGIN_DEFAULT_TOKEN || process.env.SQY_API_TOKEN || null

    const template = await fetchTemplate()
    const zip = token ? personalizeZip(template, { apiToken: token, baseUrl: client?.baseUrl }) : template

    const filename = client ? `AuraBIM-${client.id}.zip` : 'AuraBIM-instalador.zip'
    res.status(200)
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Cache-Control', 'no-store, max-age=0')
    res.end(zip)
  } catch (e) {
    fail(res, 500, 'No se pudo preparar la descarga del plugin', e)
  }
}
