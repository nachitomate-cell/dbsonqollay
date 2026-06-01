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
export async function fetchAllProjects() {
  const local = listProjects()
  const API = import.meta.env.VITE_APS_API || 'http://localhost:3000'
  try {
    const remote = await fetch(`${API}/api/aps/models`).then((r) => (r.ok ? r.json() : []))
    const byUrn = new Map()
    // Locales primero (conservan nombre y fecha originales).
    for (const p of local) byUrn.set(p.urn, p)
    for (const r of remote) {
      if (!byUrn.has(r.urn)) byUrn.set(r.urn, { urn: r.urn, name: r.name, savedAt: null, remote: true })
    }
    return Array.from(byUrn.values())
  } catch {
    return local
  }
}
