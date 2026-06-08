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

const EMPTY = { cwas: [], cwps: [], iwps: [], restricciones: [], revisiones: [], sesiones: [] }
function load(pid) {
  try { const r = localStorage.getItem(KEY(pid)); if (r) { return { ...EMPTY, ...JSON.parse(r) } } } catch { /* ignore */ }
  return { ...EMPTY }
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

  // Restricciones (gestión de bloqueos AWP).
  const addRestriccion = useCallback((r) => {
    const id = uid('rst')
    setData((d) => {
      const num = d.restricciones.reduce((m, x) => Math.max(m, x.num || 0), 0) + 1
      return { ...d, restricciones: [...d.restricciones, { id, num, codigo: `RST-${String(num).padStart(3, '0')}`, estado: 'Identificada', createdAt: Date.now(), ...r }] }
    })
    return id
  }, [])
  const updateRestriccion = useCallback((id, patch) => setData((d) => ({ ...d, restricciones: d.restricciones.map((r) => (r.id === id ? { ...r, ...patch } : r)) })), [])
  const removeRestriccion = useCallback((id) => setData((d) => ({ ...d, restricciones: d.restricciones.filter((r) => r.id !== id) })), [])

  // Revisiones (control de revisiones de reportes/entregables).
  const addRevision = useCallback((r) => { const id = uid('rev'); setData((d) => ({ ...d, revisiones: [...d.revisiones, { id, createdAt: Date.now(), ...r }] })); return id }, [])
  const updateRevision = useCallback((id, patch) => setData((d) => ({ ...d, revisiones: d.revisiones.map((r) => (r.id === id ? { ...r, ...patch } : r)) })), [])
  const removeRevision = useCallback((id) => setData((d) => ({ ...d, revisiones: d.revisiones.filter((r) => r.id !== id) })), [])

  // Sesiones IPS (Interactive Planning Sessions).
  const addSesion = useCallback((s) => {
    const id = uid('ips')
    setData((d) => { const num = d.sesiones.reduce((m, x) => Math.max(m, x.num || 0), 0) + 1; return { ...d, sesiones: [...d.sesiones, { id, num, codigo: `IPS-${String(num).padStart(3, '0')}`, estado: 'Programada', decisiones: [], actionItems: [], createdAt: Date.now(), ...s }] } })
    return id
  }, [])
  const updateSesion = useCallback((id, patch) => setData((d) => ({ ...d, sesiones: d.sesiones.map((s) => (s.id === id ? { ...s, ...patch } : s)) })), [])
  const removeSesion = useCallback((id) => setData((d) => ({ ...d, sesiones: d.sesiones.filter((s) => s.id !== id) })), [])

  return { ...data, addCwa, updateCwa, removeCwa, addCwp, updateCwp, removeCwp, setIwpsForCwp, clearIwpsForCwp, addRestriccion, updateRestriccion, removeRestriccion, addRevision, updateRevision, removeRevision, addSesion, updateSesion, removeSesion }
}
