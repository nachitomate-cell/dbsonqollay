import { listObjects, send } from '../_lib/aps.js'

// GET /api/aps/models → lista los modelos del bucket (proyectos guardados).
export default async function handler(_req, res) {
  try {
    send(res, 200, await listObjects())
  } catch (e) {
    send(res, 500, { error: e.message })
  }
}
