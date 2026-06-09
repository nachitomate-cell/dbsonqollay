/**
 * Catálogo de "Proyectos" BIM guardados (modelos APS ya subidos y traducidos).
 *
 * Un modelo NWD/RVT/IFC, una vez subido, queda almacenado y traducido en
 * Autodesk; lo único que la app necesita recordar para reabrirlo al instante es
 * su `urn` (más el nombre y la fecha). Eso se guarda aquí en localStorage, de
 * forma global, para que el usuario pueda reabrir cualquier modelo sin volver a
 * subir el archivo aunque cierre y abra la aplicación.
 */
const KEY = 'sqy-aps-projects'

export function listProjects() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || []
  } catch {
    return []
  }
}

function save(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* cuota excedida: se ignora */
  }
}

/** Agrega o actualiza un proyecto por urn. Devuelve la lista nueva. */
export function addProject({ urn, name }) {
  if (!urn) return listProjects()
  const list = listProjects().filter((p) => p.urn !== urn)
  list.unshift({ urn, name: name || 'Modelo BIM', savedAt: new Date().toISOString() })
  save(list)
  return list
}

export function removeProject(urn) {
  const list = listProjects().filter((p) => p.urn !== urn)
  save(list)
  return list
}

/**
 * Lista los modelos del bucket de APS vía el backend (visibles desde cualquier
 * dispositivo) y los fusiona con los guardados localmente. Si el backend no
 * responde, devuelve solo los locales.
 */
const apiBase = () =>
  localStorage.getItem('sqy-api-url') ||
  import.meta.env.VITE_APS_API ||
  ''

// El bucket de APS guarda TANTO los modelos 3D subidos COMO las planillas
// publicadas para Navisworks (`datasets/<key>.json`, `datasets/__index__.json`).
// Estas últimas NO son modelos: hay que excluirlas para que no aparezcan en la
// lista de "Modelos guardados". Un modelo nunca es un `.json` ni vive bajo
// `datasets/`.
function isModelObject(objectKey, name) {
  const k = String(objectKey || name || '').toLowerCase()
  if (!k) return false
  if (k.startsWith('datasets/') || k.includes('__index__')) return false
  if (k.endsWith('.json')) return false
  return true
}

// Envuelve los modelos locales como "proyectos" de una sola versión (fallback
// cuando el backend no responde).
function groupLocal() {
  return listProjects().map((p) => ({
    id: p.urn,
    name: p.name,
    urn: p.urn,
    objectKey: p.objectKey,
    savedAt: p.savedAt,
    remote: !!p.remote,
    latest: { urn: p.urn, objectKey: p.objectKey, ts: 0, name: p.name, n: 1 },
    versions: [{ urn: p.urn, objectKey: p.objectKey, ts: 0, name: p.name, n: 1 }],
  }))
}

/**
 * Lista los modelos del bucket agrupados por PROYECTO, cada uno con sus
 * VERSIONES (la más nueva primero). Publicar con el mismo nombre crea una nueva
 * versión del mismo proyecto en vez de un duplicado. Si el backend no responde,
 * cae a los modelos locales.
 */
export async function fetchAllProjects() {
  try {
    // Futuro (Etapa 3 / login): filtrar por la empresa logueada.
    const tenant = localStorage.getItem('sqy-tenant') || ''
    const q = tenant ? `?tenant=${encodeURIComponent(tenant)}` : ''
    const remote = await fetch(`${apiBase()}/api/aps/models${q}`).then((r) => {
      if (!r.ok || !r.headers.get('content-type')?.includes('application/json')) return []
      return r.json()
    })
    const models = remote.filter((r) => isModelObject(r.objectKey, r.name))
    if (!models.length) return groupLocal()

    // Agrupa por proyecto (tenant/slug); cada objeto es una versión.
    const byProject = new Map()
    for (const r of models) {
      const id = `${r.tenant || 'default'}/${r.project || (r.name || r.urn).toLowerCase()}`
      const g = byProject.get(id) || { id, tenant: r.tenant || 'default', project: r.project, versions: [] }
      g.versions.push({ urn: r.urn, objectKey: r.objectKey, ts: r.ts || 0, name: r.name, size: r.size })
      byProject.set(id, g)
    }

    const projects = []
    for (const g of byProject.values()) {
      g.versions.sort((a, b) => b.ts - a.ts) // más nueva primero
      g.versions.forEach((v, i) => { v.n = g.versions.length - i }) // v1 = la más vieja
      const latest = g.versions[0]
      projects.push({
        id: g.id,
        tenant: g.tenant,
        project: g.project,
        name: latest.name,
        urn: latest.urn, // compat: openProject/delete usan .urn (= última versión)
        objectKey: latest.objectKey,
        savedAt: latest.ts ? new Date(latest.ts).toISOString() : null,
        remote: true,
        latest,
        versions: g.versions,
      })
    }
    projects.sort((a, b) => (b.latest.ts || 0) - (a.latest.ts || 0))
    return projects
  } catch {
    return groupLocal()
  }
}

/** Borra TODAS las versiones del proyecto en el bucket y lo quita de la lista local. */
export async function deleteProjectRemote(project) {
  const keys = (project?.versions?.length ? project.versions.map((v) => v.objectKey) : [project?.objectKey]).filter(Boolean)
  for (const k of keys) {
    try {
      await fetch(`${apiBase()}/api/aps/models?objectKey=${encodeURIComponent(k)}`, { method: 'DELETE' })
    } catch {
      /* ignora errores de red; igual se quita de la lista local */
    }
  }
  return removeProject(project.urn)
}
