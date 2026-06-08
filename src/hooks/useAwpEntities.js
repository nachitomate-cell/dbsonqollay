import { useCallback, useEffect, useRef, useState } from 'react'
import { loadStore, saveStore } from '../utils/cloudStore.js'

/**
 * Entidades AWP nativas del proyecto: CWA → CWP → IWP (modelo de Aura AWP).
 * Persiste en la NUBE (/api/store) además del localStorage: al abrir el
 * Workspace recupera lo guardado en cualquier equipo. Los códigos se generan en
 * el Workspace con la nomenclatura del proyecto y se guardan en cada entidad.
 */
const KEY = (pid) => `sqy-awp-entities-${pid}`
const cloudKey = (pid) => `awp-entities-${pid}`
let _seq = 0
const uid = (p) => `${p}_${(typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now().toString(36)}_${(_seq++).toString(36)}`}`

const EMPTY = { cwas: [], cwps: [], iwps: [], restricciones: [], revisiones: [], sesiones: [] }
function load(pid) {
  try { const r = localStorage.getItem(KEY(pid)); if (r) { return { ...EMPTY, ...JSON.parse(r) } } } catch { /* ignore */ }
  return { ...EMPTY }
}

export function useAwpEntities(projectId) {
  const [data, setData] = useState(() => load(projectId))
  const [saveError, setSaveError] = useState('')
  const cloudReady = useRef(false) // ya resolvió la carga de la nube
  const edited = useRef(false) // el usuario editó (no pisar con la nube)
  // Toda mutación marca `edited` para que la carga async de la nube no pise.
  const mutate = useCallback((updater) => { edited.current = true; setData(updater) }, [])

  // Carga inicial desde la nube (gana sobre el localStorage si existe). Si la nube
  // está vacía, siembra con lo local. Luego habilita el guardado a la nube.
  useEffect(() => {
    let alive = true
    loadStore(cloudKey(projectId)).then((d) => {
      if (!alive) return
      if (d && !edited.current) setData({ ...EMPTY, ...d })
      else if (!d) setData((cur) => { saveStore(cloudKey(projectId), cur); return cur })
    }).finally(() => { if (alive) cloudReady.current = true })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  useEffect(() => {
    try { localStorage.setItem(KEY(projectId), JSON.stringify(data)); setSaveError('') }
    catch { setSaveError('No se pudo guardar localmente (almacenamiento lleno); igual se guarda en la nube.') }
    if (cloudReady.current) saveStore(cloudKey(projectId), data)
  }, [projectId, data])

  const addCwa = useCallback((cwa) => {
    const id = uid('cwa')
    mutate((d) => ({ ...d, cwas: [...d.cwas, { id, estado: 'Planificada', createdAt: Date.now(), ...cwa }] }))
    return id
  }, [])
  const updateCwa = useCallback((id, patch) => mutate((d) => ({ ...d, cwas: d.cwas.map((c) => (c.id === id ? { ...c, ...patch } : c)) })), [])
  const removeCwa = useCallback((id) => mutate((d) => {
    const cwpIds = new Set(d.cwps.filter((c) => c.cwaId === id).map((c) => c.id))
    return {
      ...d, // conserva restricciones/revisiones/sesiones
      cwas: d.cwas.filter((c) => c.id !== id),
      cwps: d.cwps.filter((c) => c.cwaId !== id),
      iwps: d.iwps.filter((i) => !cwpIds.has(i.cwpId)),
      // desvincula (no borra) las restricciones que apuntaban a lo eliminado
      restricciones: d.restricciones.map((r) => ((r.cwaId === id || cwpIds.has(r.cwpId)) ? { ...r, cwaId: r.cwaId === id ? '' : r.cwaId, cwpId: cwpIds.has(r.cwpId) ? '' : r.cwpId } : r)),
    }
  }), [])

  const addCwp = useCallback((cwp) => {
    const id = uid('cwp')
    mutate((d) => ({ ...d, cwps: [...d.cwps, { id, estado: 'En planificación', createdAt: Date.now(), ...cwp }] }))
    return id
  }, [])
  const updateCwp = useCallback((id, patch) => mutate((d) => ({ ...d, cwps: d.cwps.map((c) => (c.id === id ? { ...c, ...patch } : c)) })), [])
  const removeCwp = useCallback((id) => mutate((d) => ({ ...d, cwps: d.cwps.filter((c) => c.id !== id), iwps: d.iwps.filter((i) => i.cwpId !== id), restricciones: d.restricciones.map((r) => (r.cwpId === id ? { ...r, cwpId: '' } : r)) })), [])

  // Apertura: reemplaza los IWPs de un CWP por los generados.
  const setIwpsForCwp = useCallback((cwpId, iwps) => mutate((d) => ({ ...d, iwps: [...d.iwps.filter((i) => i.cwpId !== cwpId), ...iwps] })), [])
  const clearIwpsForCwp = useCallback((cwpId) => mutate((d) => ({ ...d, iwps: d.iwps.filter((i) => i.cwpId !== cwpId) })), [])

  // Restricciones (gestión de bloqueos AWP).
  const addRestriccion = useCallback((r) => {
    const id = uid('rst')
    mutate((d) => {
      const num = d.restricciones.reduce((m, x) => Math.max(m, x.num || 0), 0) + 1
      return { ...d, restricciones: [...d.restricciones, { id, num, codigo: `RST-${String(num).padStart(3, '0')}`, estado: 'Identificada', createdAt: Date.now(), ...r }] }
    })
    return id
  }, [])
  const updateRestriccion = useCallback((id, patch) => mutate((d) => ({ ...d, restricciones: d.restricciones.map((r) => (r.id === id ? { ...r, ...patch } : r)) })), [])
  const removeRestriccion = useCallback((id) => mutate((d) => ({ ...d, restricciones: d.restricciones.filter((r) => r.id !== id) })), [])

  // Revisiones (control de revisiones de reportes/entregables).
  const addRevision = useCallback((r) => { const id = uid('rev'); mutate((d) => ({ ...d, revisiones: [...d.revisiones, { id, createdAt: Date.now(), ...r }] })); return id }, [])
  const updateRevision = useCallback((id, patch) => mutate((d) => ({ ...d, revisiones: d.revisiones.map((r) => (r.id === id ? { ...r, ...patch } : r)) })), [])
  const removeRevision = useCallback((id) => mutate((d) => ({ ...d, revisiones: d.revisiones.filter((r) => r.id !== id) })), [])

  // Sesiones IPS (Interactive Planning Sessions).
  const addSesion = useCallback((s) => {
    const id = uid('ips')
    mutate((d) => { const num = d.sesiones.reduce((m, x) => Math.max(m, x.num || 0), 0) + 1; return { ...d, sesiones: [...d.sesiones, { id, num, codigo: `IPS-${String(num).padStart(3, '0')}`, estado: 'Programada', decisiones: [], actionItems: [], createdAt: Date.now(), ...s }] } })
    return id
  }, [])
  const updateSesion = useCallback((id, patch) => mutate((d) => ({ ...d, sesiones: d.sesiones.map((s) => (s.id === id ? { ...s, ...patch } : s)) })), [])
  const removeSesion = useCallback((id) => mutate((d) => ({ ...d, sesiones: d.sesiones.filter((s) => s.id !== id) })), [])

  return { ...data, saveError, addCwa, updateCwa, removeCwa, addCwp, updateCwp, removeCwp, setIwpsForCwp, clearIwpsForCwp, addRestriccion, updateRestriccion, removeRestriccion, addRevision, updateRevision, removeRevision, addSesion, updateSesion, removeSesion }
}
