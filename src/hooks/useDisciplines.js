import { useEffect, useState } from 'react'
import { disciplines as staticDisciplines, withCounts } from '../data/disciplines.js'

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
        setDisciplines(withCounts(j.disciplines))
        setSource(j.source || 'db')
      })
      .catch(() => { /* sin red / sin backend: se mantiene el menú estático */ })
    return () => { cancelled = true }
  }, [])

  return { disciplines, source }
}
