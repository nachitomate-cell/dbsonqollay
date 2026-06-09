/**
 * Organizaciones (empresas), proyectos y membresías — multi-tenant.
 *
 * Usa la conexión privilegiada SQY_DATABASE_URL (misma que db.js), que SALTEA
 * RLS. Por eso el aislamiento lo garantiza ESTE módulo: cada consulta filtra por
 * el usuario autenticado (su user_id sale del JWT en el endpoint). Tablas creadas
 * por la migración 001 (sqy_organizations / sqy_projects / sqy_memberships).
 */
import { getPool } from './db.js'

const ROLES = ['viewer', 'editor', 'approver', 'admin']

async function q(text, params) {
  const pool = getPool()
  if (!pool) throw new Error('Base de datos no configurada (SQY_DATABASE_URL).')
  const client = await pool.connect()
  try {
    return await client.query(text, params)
  } finally {
    client.release()
  }
}

/** Rol del usuario en una org, o null si no es miembro. */
export async function roleInOrg(userId, orgId) {
  const r = await q('select role from sqy_memberships where user_id = $1 and org_id = $2', [userId, orgId])
  return r.rows[0]?.role || null
}

/** Rol del usuario en la org dueña de un proyecto, o null si no tiene acceso. */
export async function projectRole(userId, projectId) {
  const r = await q(
    `select m.role from sqy_projects p
       join sqy_memberships m on m.org_id = p.org_id
      where p.id = $1 and m.user_id = $2`,
    [projectId, userId],
  )
  return r.rows[0]?.role || null
}

/** Empresas del usuario (donde es miembro), con su rol y nº de proyectos. */
export async function listUserOrgs(userId) {
  const r = await q(
    `select o.id, o.name, o.created_at, m.role,
            (select count(*) from sqy_projects p where p.org_id = o.id)::int as projects
       from sqy_organizations o
       join sqy_memberships m on m.org_id = o.id
      where m.user_id = $1
      order by o.created_at`,
    [userId],
  )
  return r.rows
}

/** Crea una empresa y deja al creador como admin. */
export async function createOrg(userId, name) {
  const clean = String(name || '').trim()
  if (!clean) throw new Error('Falta el nombre de la empresa.')
  const pool = getPool()
  if (!pool) throw new Error('Base de datos no configurada.')
  const client = await pool.connect()
  try {
    await client.query('begin')
    const o = await client.query('insert into sqy_organizations (name) values ($1) returning id, name, created_at', [clean])
    const org = o.rows[0]
    await client.query('insert into sqy_memberships (user_id, org_id, role) values ($1, $2, $3)', [userId, org.id, 'admin'])
    await client.query('commit')
    return { ...org, role: 'admin', projects: 0 }
  } catch (e) {
    try { await client.query('rollback') } catch {}
    throw e
  } finally {
    client.release()
  }
}

/** Proyectos de una empresa (solo si el usuario es miembro). */
export async function listOrgProjects(userId, orgId) {
  if (!(await roleInOrg(userId, orgId))) throw Object.assign(new Error('No es miembro de esta empresa.'), { status: 403 })
  const r = await q('select id, org_id, name, created_at from sqy_projects where org_id = $1 order by created_at', [orgId])
  return r.rows
}

/** Crea un proyecto en una empresa (requiere rol admin o editor). */
export async function createProject(userId, orgId, name) {
  const role = await roleInOrg(userId, orgId)
  if (!role) throw Object.assign(new Error('No es miembro de esta empresa.'), { status: 403 })
  if (!['admin', 'editor'].includes(role)) throw Object.assign(new Error('No tienes permiso para crear proyectos.'), { status: 403 })
  const clean = String(name || '').trim()
  if (!clean) throw new Error('Falta el nombre del proyecto.')
  const r = await q('insert into sqy_projects (org_id, name) values ($1, $2) returning id, org_id, name, created_at', [orgId, clean])
  return r.rows[0]
}

/** Miembros de una empresa (con email), solo si el usuario es miembro. */
export async function listOrgMembers(userId, orgId) {
  if (!(await roleInOrg(userId, orgId))) throw Object.assign(new Error('No es miembro de esta empresa.'), { status: 403 })
  const r = await q(
    `select m.user_id, m.role, m.created_at, u.email
       from sqy_memberships m
       join auth.users u on u.id = m.user_id
      where m.org_id = $1
      order by m.created_at`,
    [orgId],
  )
  return r.rows
}

/** Agrega (o actualiza el rol de) un usuario por email a una empresa. Requiere admin. */
export async function addMember(userId, orgId, email, role) {
  const myRole = await roleInOrg(userId, orgId)
  if (myRole !== 'admin') throw Object.assign(new Error('Solo un admin puede agregar miembros.'), { status: 403 })
  const r = String(role || 'viewer')
  if (!ROLES.includes(r)) throw new Error('Rol inválido.')
  const clean = String(email || '').trim().toLowerCase()
  if (!clean) throw new Error('Falta el email.')

  const u = await q('select id, email from auth.users where lower(email) = $1', [clean])
  if (!u.rows[0]) throw Object.assign(new Error('No existe un usuario con ese email. Pídele que se registre primero.'), { status: 404 })
  const target = u.rows[0]
  await q(
    `insert into sqy_memberships (user_id, org_id, role) values ($1, $2, $3)
     on conflict (user_id, org_id) do update set role = excluded.role`,
    [target.id, orgId, r],
  )
  return { user_id: target.id, email: target.email, role: r }
}
