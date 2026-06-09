import { getSignedUpload, projectSlug, send, fail } from '../_lib/aps.js'
import { clientByToken } from '../_lib/clients.js'

// POST /api/aps/upload-url  body: { name, project? }
// Devuelve { objectKey, uploadKey, urls } para que el cliente suba el modelo
// directo a S3/Autodesk (evita el límite de tamaño de las funciones de Vercel).
//
// objectKey = models/<tenant>/<slug>/<ts>-<archivo>
//   - <tenant>: empresa dueña del modelo, resuelta por el token del plugin
//     (aislamiento entre clientes). 'default' si no hay registro.
//   - <slug>:   proyecto (agrupa versiones). Mismo nombre → nueva versión.
//   - <ts>:     marca de tiempo → ordena las versiones.
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido' })
  try {
    const body = req.body || {}
    const fileName = (body.name || 'modelo').replace(/[^\w.\-]/g, '_')
    const slug = projectSlug(body.project || body.name || 'modelo')

    // Empresa (tenant) a partir del token del plugin.
    const auth = req.headers.authorization || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
    const tenant = clientByToken(token)?.id || 'default'

    const objectKey = `models/${tenant}/${slug}/${Date.now()}-${fileName}`
    const { uploadKey, urls } = await getSignedUpload(objectKey)
    send(res, 200, { objectKey, uploadKey, urls })
  } catch (e) {
    fail(res, 500, 'No se pudo generar la URL de subida', e)
  }
}
