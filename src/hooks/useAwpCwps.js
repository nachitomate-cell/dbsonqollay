import { useCallback, useEffect, useState } from 'react'
import { parseAwpFile } from '../utils/awpCsv.js'
import { loadStore, saveStore } from '../utils/cloudStore.js'

/**
 * Listado de CWPs (jerarquía CWA/CWP) importado del export de Aura AWP (CSV o
 * Excel), por proyecto.
 *
 * Se guarda EN LA NUBE (almacén /api/store, clave por proyecto) además de en
 * localStorage como caché. Así cualquier usuario del proyecto ve el mismo listado
 * sin tener que reimportar el CSV en cada equipo. La nube es la fuente de verdad:
 * al montar se trae lo compartido; al importar/limpiar se sube.
 *
 * Retorna { cwps, importCwps(file) -> count, clearCwps() }.
 */
const lsKey = (pid) => `sqy-awp-cwps${pid ? `-${pid}` : ''}`
const cloudKey = (pid) => `awp-cwps-${pid || 'global'}`

function load(key) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : [] } catch { return [] }
}

export function useAwpCwps(projectId) {
  const KEY = lsKey(projectId)
  const CKEY = cloudKey(projectId)
  const [cwps, setCwps] = useState(() => load(KEY))

  // Caché local (rápida, también respaldo si no hay backend/sesión).
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(cwps)) } catch { /* cuota */ }
  }, [KEY, cwps])

  // Nube: al abrir el proyecto, trae el listado COMPARTIDO (fuente de verdad).
  useEffect(() => {
    let cancel = false
    loadStore(CKEY).then((data) => {
      if (cancel || !data) return
      const list = Array.isArray(data.cwps) ? data.cwps : (Array.isArray(data) ? data : null)
      if (list) setCwps(list)
    })
    return () => { cancel = true }
  }, [CKEY])

  const importCwps = useCallback(async (file) => {
    const parsed = await parseAwpFile(file)
    setCwps(parsed)
    saveStore(CKEY, { cwps: parsed, updatedAt: new Date().toISOString() }, 0) // a la nube, inmediato
    return parsed.length
  }, [CKEY])

  const clearCwps = useCallback(() => {
    setCwps([])
    saveStore(CKEY, { cwps: [], updatedAt: new Date().toISOString() }, 0)
  }, [CKEY])

  return { cwps, importCwps, clearCwps }
}
