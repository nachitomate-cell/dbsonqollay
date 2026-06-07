import { useEffect, useState } from 'react'
import { disciplines as staticDisciplines, withCounts } from '../data/disciplines.js'

/**
 * Fusiona el menú de la base de datos con el estático para que NUNCA falte una
 * disciplina/subcategoría. La DB manda para los IDs que coinciden (nombre, orden,
 * personalizaciones), pero todo lo que esté en el estático y no en la DB se
 * agrega (evita que un menú de DB desactualizado "pierda" planillas y rebote al
 * usuario al inicio al podar la pestaña abierta).
 */
function mergeMenus(dbTree, staticTree) {
  const staticById = new Map(staticTree.map((d) => [d.id, d]))
  const merged = dbTree.map((d) => {
    const s = staticById.get(d.id)
    if (!s) return d
    const have = new Set((d.subcategories || []).map((x) => x.id))
    const missing = (s.subcategories || []).filter((x) => !have.has(x.id))
    return missing.length ? { ...d, subcategories: [...(d.subcategories || []), ...missing] } : d
  })
  const dbIds = new Set(dbTree.map((d) => d.id))
  for (const s of staticTree) if (!dbIds.has(s.id)) merged.push(s)
  return merged
}

/**
 * Trae el menú de disciplinas desde la base de datos (GET /api/disciplines) y le
 * adjunta los conteos reales (desde los datasets) con `withCounts`.
 *
 * Arranca SIEMPRE con el menú estático (respuesta inmediata, sin parpadeo) y lo
 * reemplaza cuando llega el de la DB. Si la DB no está configurada, falla, o el
 * endpoint no existe (p. ej. dev local sin backend), se queda con el estático.
 * Así el menú nunca se rompe.
 *
 * Devuelve { disciplines, source } donde source ∈ 'static' | 'db'.
 */
export function useDisciplines() {
  const [disciplines, setDisciplines] = useState(staticDisciplines)
  const [source, setSource] = useState('static')

  useEffect(() => {
    let cancelled = false
    const api = localStorage.getItem('sqy-api-url') || import.meta.env.VITE_APS_API || ''
    fetch(`${api}/api/disciplines`, { cache: 'no-store' })
      .then((r) => (r.ok && (r.headers.get('content-type') || '').includes('application/json') ? r.json() : null))
      .then((j) => {
        // Solo reemplazamos si la DB devolvió un menú no vacío; si vino null
        // (DB apagada o error) mantenemos el estático.
        if (cancelled || !j || !Array.isArray(j.disciplines) || j.disciplines.length === 0) return
        setDisciplines(mergeMenus(withCounts(j.disciplines), staticDisciplines))
        setSource(j.source || 'db')
      })
      .catch(() => { /* sin red / sin backend: se mantiene el menú estático */ })
    return () => { cancelled = true }
  }, [])

  return { disciplines, source }
}
