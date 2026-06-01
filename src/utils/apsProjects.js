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
const apiBase = () => import.meta.env.VITE_APS_API ?? (import.meta.env.DEV ? 'http://localhost:3000' : '')

export async function fetchAllProjects() {
  const local = listProjects()
  try {
    const remote = await fetch(`${apiBase()}/api/aps/models`).then((r) => (r.ok ? r.json() : []))
    const byUrn = new Map()
    for (const p of local) byUrn.set(p.urn, { ...p })
    for (const r of remote) {
      const existing = byUrn.get(r.urn)
      if (existing) existing.objectKey = r.objectKey // enlaza el objeto del bucket para poder borrarlo
      else byUrn.set(r.urn, { urn: r.urn, name: r.name, objectKey: r.objectKey, savedAt: null, remote: true })
    }
    // Agrupa duplicados por nombre: deja solo el más reciente de cada nombre
    // (en el bucket quedan varias subidas del mismo archivo).
    const list = Array.from(byUrn.values())
    const seen = new Set()
    const deduped = []
    for (const p of list) {
      const key = (p.name || p.urn).toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      deduped.push(p)
    }
    return deduped
  } catch {
    return local
  }
}

/** Borra el objeto del bucket (si tiene objectKey) y lo quita de la lista local. */
export async function deleteProjectRemote(project) {
  if (project?.objectKey) {
    try {
      await fetch(`${apiBase()}/api/aps/models?objectKey=${encodeURIComponent(project.objectKey)}`, { method: 'DELETE' })
    } catch {
      /* ignora errores de red; igual se quita de la lista local */
    }
  }
  return removeProject(project.urn)
}
