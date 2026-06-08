import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AWP_PRESETS, DISCIPLINAS_DEFAULT, NOMENCLATURA_DEFAULT } from '../data/awpCatalogs.js'
import { loadStore, saveStore } from '../utils/cloudStore.js'

/**
 * Configuración AWP de un proyecto (modelo de Aura AWP): identificación,
 * clasificación, ubicación, fechas, presupuesto, disciplinas (con prefijo+color)
 * y parámetros AWP + nomenclatura. Persiste en la NUBE (/api/store) además del
 * localStorage, así se recupera en cualquier equipo.
 */
const KEY = (projectId) => `sqy-awp-config-${projectId}`
const cloudKey = (pid) => `awp-config-${pid}`

function defaults(project) {
  return {
    // Identificación
    codigo: project?.code || '',
    nombre: project?.name || '',
    descripcion: project?.description || '',
    cliente: '',
    divisionCliente: '',
    contratista: '',
    // Clasificación
    tipoProyecto: '',
    tipoContrato: '',
    sector: '',
    fase: '',
    // Ubicación
    pais: 'Chile', region: '', ciudad: '', direccion: '',
    coordSistema: 'UTM', utmZona: '', hemisferio: 'S', easting: '', northing: '',
    altitud: '', zonaSismica: '',
    // Fechas
    fechaInicio: '', fechaFin: '', fechaEntregaOperaciones: '',
    // Presupuesto
    moneda: 'USD', presupuesto: '', hhEstimadas: '',
    // Disciplinas activas con prefijo + color
    disciplinas: DISCIPLINAS_DEFAULT.map((d) => ({ ...d })),
    // Parámetros AWP + nomenclatura
    awp: { ...AWP_PRESETS.cii, nomenclatura: structuredCloneSafe(NOMENCLATURA_DEFAULT) },
  }
}

function structuredCloneSafe(obj) {
  try { return JSON.parse(JSON.stringify(obj)) } catch { return obj }
}

function load(projectId, project) {
  const base = defaults(project)
  try {
    const raw = localStorage.getItem(KEY(projectId))
    if (!raw) return base
    const stored = JSON.parse(raw)
    // Merge superficial + awp/nomenclatura para no perder defaults nuevos.
    return {
      ...base, ...stored,
      awp: { ...base.awp, ...(stored.awp || {}), nomenclatura: { ...base.awp.nomenclatura, ...(stored.awp?.nomenclatura || {}) } },
      disciplinas: stored.disciplinas?.length ? stored.disciplinas : base.disciplinas,
    }
  } catch {
    return base
  }
}

export function useProjectConfig(projectId, project) {
  const [config, setConfig] = useState(() => load(projectId, project))
  const cloudReady = useRef(false)
  const edited = useRef(false)
  const mutate = useCallback((updater) => { edited.current = true; setConfig(updater) }, [])

  // Carga desde la nube al montar (gana sobre localStorage). Si la nube está
  // vacía, la siembra con lo local. Luego habilita el guardado a la nube.
  useEffect(() => {
    let alive = true
    loadStore(cloudKey(projectId)).then((d) => {
      if (!alive) return
      if (d && !edited.current) setConfig((cur) => ({ ...cur, ...d, awp: { ...cur.awp, ...(d.awp || {}), nomenclatura: { ...cur.awp.nomenclatura, ...(d.awp?.nomenclatura || {}) } } }))
      else if (!d) setConfig((cur) => { saveStore(cloudKey(projectId), cur); return cur })
    }).finally(() => { if (alive) cloudReady.current = true })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  useEffect(() => {
    try { localStorage.setItem(KEY(projectId), JSON.stringify(config)) } catch { /* cuota */ }
    if (cloudReady.current) saveStore(cloudKey(projectId), config)
  }, [projectId, config])

  // Setea un campo (soporta rutas tipo 'awp.hhMaxCwa').
  const setField = useCallback((path, value) => {
    mutate((c) => {
      if (!path.includes('.')) return { ...c, [path]: value }
      const [a, b, d] = path.split('.')
      if (d) return { ...c, [a]: { ...c[a], [b]: { ...(c[a]?.[b] || {}), [d]: value } } }
      return { ...c, [a]: { ...(c[a] || {}), [b]: value } }
    })
  }, [mutate])

  const setDisciplina = useCallback((id, patch) => {
    mutate((c) => ({ ...c, disciplinas: c.disciplinas.map((d) => (d.id === id ? { ...d, ...patch } : d)) }))
  }, [mutate])

  const applyPreset = useCallback((presetId) => {
    const p = AWP_PRESETS[presetId]
    if (p) mutate((c) => ({ ...c, awp: { ...c.awp, ...p } }))
  }, [mutate])

  const disciplinasActivas = useMemo(() => config.disciplinas.filter((d) => d.activa), [config.disciplinas])

  return { config, setField, setDisciplina, applyPreset, disciplinasActivas }
}
