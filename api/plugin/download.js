import { clientByDownloadKey } from '../_lib/clients.js'
import { fetchTemplate, personalizeZip } from '../_lib/installer.js'
import { send, fail } from '../_lib/aps.js'

/**
 * GET /api/plugin/download[?key=<llave de descarga>]
 *
 * Sirve el instalador del plugin DESDE el backend (el repo puede ser privado).
 *   - Con `key` válida  → instalador con el token de ESA empresa inyectado.
 *   - Con `key` inválida → 403 (cliente desconocido o desactivado).
 *   - Sin `key`         → REDIRIGE a la Release pública de GitHub (dominio con
 *                         reputación → Chrome no marca "descarga sospechosa").
 *                         El ZIP de la Release ya trae el token compartido.
 *                         Si el repo es PRIVADO, setear PLUGIN_NO_REDIRECT=1 para
 *                         servir desde el backend (con el costo del aviso).
 */
export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return send(res, 405, { error: 'Método no permitido' })

    const key = String(req.query.key || '').trim()

    // Descarga genérica (sin empresa): redirige a GitHub. Evita el bloqueo de
    // "descarga sospechosa" de Chrome (ZIP con scripts desde dominio sin reputación).
    if (!key && process.env.PLUGIN_NO_REDIRECT !== '1') {
      const repo = process.env.PLUGIN_REPO || 'nachitomate-cell/dbsonqollay'
      const asset = process.env.PLUGIN_ASSET || 'AuraBIM-instalador.zip'
      res.statusCode = 302
      res.setHeader('Location', `https://github.com/${repo}/releases/latest/download/${asset}`)
      res.setHeader('Cache-Control', 'no-store')
      res.end()
      return
    }

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

    const filename = client ? `Aura-GIP-${client.id}.zip` : 'Aura-GIP-Instalador.zip'
    res.status(200)
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Cache-Control', 'no-store, max-age=0')
    res.end(zip)
  } catch (e) {
    fail(res, 500, 'No se pudo preparar la descarga del plugin', e)
  }
}
