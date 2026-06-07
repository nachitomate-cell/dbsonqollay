import { useCallback, useEffect, useState } from 'react'
import { parseAwpCwps } from '../utils/awpCsv.js'

/**
 * Listado de CWPs (jerarquía CWA/CWP) importado del CSV de Aura AWP, por proyecto.
 * Mientras no exista API, el usuario importa el CSV una vez por proyecto y la app
 * lo usa para conectar componentes a un CWA/CWP. Persistido en localStorage.
 *
 * Retorna { cwps, importCwps(file) -> count, clearCwps() }.
 */
const lsKey = (pid) => `sqy-awp-cwps${pid ? `-${pid}` : ''}`
function load(key) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : [] } catch { return [] }
}

export function useAwpCwps(projectId) {
  const KEY = lsKey(projectId)
  const [cwps, setCwps] = useState(() => load(KEY))

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(cwps)) } catch { /* cuota */ }
  }, [KEY, cwps])

  const importCwps = useCallback(async (file) => {
    const parsed = parseAwpCwps(await file.text())
    setCwps(parsed)
    return parsed.length
  }, [])

  const clearCwps = useCallback(() => setCwps([]), [])

  return { cwps, importCwps, clearCwps }
}
