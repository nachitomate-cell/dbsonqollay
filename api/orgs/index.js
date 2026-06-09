import { listUserOrgs, createOrg } from '../_lib/orgs.js'
import { getUserFromRequest } from '../_lib/auth.js'
import { send, fail } from '../_lib/aps.js'

// GET  /api/orgs            → empresas del usuario (con rol y nº de proyectos)
// POST /api/orgs  {name}    → crea una empresa (el creador queda como admin)
export default async function handler(req, res) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return send(res, 401, { error: 'Inicia sesión.' })

    if (req.method === 'GET') return send(res, 200, await listUserOrgs(user.id))
    if (req.method === 'POST') return send(res, 200, await createOrg(user.id, req.body?.name))
    return send(res, 405, { error: 'Método no permitido' })
  } catch (e) {
    if (e.status) return send(res, e.status, { error: e.message })
    fail(res, 500, 'No se pudo procesar la empresa', e)
  }
}
