import { listOrgProjects, createProject } from '../_lib/orgs.js'
import { getUserFromRequest } from '../_lib/auth.js'
import { send, fail } from '../_lib/aps.js'

// GET  /api/projects?org=<id>        → proyectos de la empresa (si es miembro)
// POST /api/projects  {orgId, name}  → crea un proyecto (admin/editor)
export default async function handler(req, res) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return send(res, 401, { error: 'Inicia sesión.' })

    if (req.method === 'GET') {
      const orgId = req.query?.org
      if (!orgId) return send(res, 400, { error: 'Falta org' })
      return send(res, 200, await listOrgProjects(user.id, orgId))
    }
    if (req.method === 'POST') {
      const { orgId, name } = req.body || {}
      if (!orgId) return send(res, 400, { error: 'Falta orgId' })
      return send(res, 200, await createProject(user.id, orgId, name))
    }
    return send(res, 405, { error: 'Método no permitido' })
  } catch (e) {
    if (e.status) return send(res, e.status, { error: e.message })
    fail(res, 500, 'No se pudo procesar el proyecto', e)
  }
}
