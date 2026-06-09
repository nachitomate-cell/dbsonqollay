import { listOrgMembers, addMember } from '../_lib/orgs.js'
import { getUserFromRequest } from '../_lib/auth.js'
import { send, fail } from '../_lib/aps.js'

// GET  /api/members?org=<id>               → miembros de la empresa (si es miembro)
// POST /api/members  {orgId, email, role}  → agrega/actualiza un miembro (admin)
export default async function handler(req, res) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return send(res, 401, { error: 'Inicia sesión.' })

    if (req.method === 'GET') {
      const orgId = req.query?.org
      if (!orgId) return send(res, 400, { error: 'Falta org' })
      return send(res, 200, await listOrgMembers(user.id, orgId))
    }
    if (req.method === 'POST') {
      const { orgId, email, role } = req.body || {}
      if (!orgId || !email) return send(res, 400, { error: 'Faltan orgId / email' })
      return send(res, 200, await addMember(user.id, orgId, email, role))
    }
    return send(res, 405, { error: 'Método no permitido' })
  } catch (e) {
    if (e.status) return send(res, e.status, { error: e.message })
    fail(res, 500, 'No se pudo procesar el miembro', e)
  }
}
