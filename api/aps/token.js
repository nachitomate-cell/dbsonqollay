import { getToken, send } from '../_lib/aps.js'

// GET /api/aps/token → token de solo lectura para el visor (sin exponer secret).
export default async function handler(_req, res) {
  try {
    const { access_token, expires_in } = await getToken('viewables:read')
    send(res, 200, { access_token, expires_in })
  } catch (e) {
    send(res, 500, { error: e.message })
  }
}
