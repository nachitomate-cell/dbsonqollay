import { getManifest, send } from '../../_lib/aps.js'

// GET /api/aps/status/:urn → estado de la traducción.
export default async function handler(req, res) {
  try {
    const { urn } = req.query
    const manifest = await getManifest(urn)
    send(res, 200, { status: manifest.status, progress: manifest.progress })
  } catch (e) {
    send(res, 500, { error: e.message })
  }
}
