import { useCallback, useEffect, useState } from 'react'

/**
 * Entidades AWP nativas del proyecto: CWA → CWP → IWP (modelo de Aura AWP).
 * Scaffold por proyecto (localStorage); preparado para mover a la base de datos.
 * Los códigos se generan en el Workspace con la nomenclatura del proyecto y se
 * guardan en cada entidad (no cambian si luego se edita la nomenclatura).
 */
const KEY = (pid) => `sqy-awp-entities-${pid}`
let _seq = 0
const uid = (p) => `${p}_${Date.now().toString(36)}_${(_seq++).toString(36)}`

function load(pid) {
  try { const r = localStorage.getItem(KEY(pid)); if (r) { const d = JSON.parse(r); return { cwas: d.cwas || [], cwps: d.cwps || [], iwps: d.iwps || [] } } } catch { /* ignore */ }
  return { cwas: [], cwps: [], iwps: [] }
}

export function useAwpEntities(projectId) {
  const [data, setData] = useState(() => load(projectId))

  useEffect(() => { try { localStorage.setItem(KEY(projectId), JSON.stringify(data)) } catch { /* cuota */ } }, [projectId, data])

  const addCwa = useCallback((cwa) => {
    const id = uid('cwa')
    setData((d) => ({ ...d, cwas: [...d.cwas, { id, estado: 'Planificada', createdAt: Date.now(), ...cwa }] }))
    return id
  }, [])
  const updateCwa = useCallback((id, patch) => setData((d) => ({ ...d, cwas: d.cwas.map((c) => (c.id === id ? { ...c, ...patch } : c)) })), [])
  const removeCwa = useCallback((id) => setData((d) => {
    const cwpIds = new Set(d.cwps.filter((c) => c.cwaId === id).map((c) => c.id))
    return { cwas: d.cwas.filter((c) => c.id !== id), cwps: d.cwps.filter((c) => c.cwaId !== id), iwps: d.iwps.filter((i) => !cwpIds.has(i.cwpId)) }
  }), [])

  const addCwp = useCallback((cwp) => {
    const id = uid('cwp')
    setData((d) => ({ ...d, cwps: [...d.cwps, { id, estado: 'En planificación', createdAt: Date.now(), ...cwp }] }))
    return id
  }, [])
  const updateCwp = useCallback((id, patch) => setData((d) => ({ ...d, cwps: d.cwps.map((c) => (c.id === id ? { ...c, ...patch } : c)) })), [])
  const removeCwp = useCallback((id) => setData((d) => ({ ...d, cwps: d.cwps.filter((c) => c.id !== id), iwps: d.iwps.filter((i) => i.cwpId !== id) })), [])

  // Apertura: reemplaza los IWPs de un CWP por los generados.
  const setIwpsForCwp = useCallback((cwpId, iwps) => setData((d) => ({ ...d, iwps: [...d.iwps.filter((i) => i.cwpId !== cwpId), ...iwps] })), [])
  const clearIwpsForCwp = useCallback((cwpId) => setData((d) => ({ ...d, iwps: d.iwps.filter((i) => i.cwpId !== cwpId) })), [])

  return { ...data, addCwa, updateCwa, removeCwa, addCwp, updateCwp, removeCwp, setIwpsForCwp, clearIwpsForCwp }
}
