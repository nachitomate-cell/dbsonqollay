import { useCallback, useEffect, useMemo, useState } from 'react'
import { AWP_PRESETS, DISCIPLINAS_DEFAULT, NOMENCLATURA_DEFAULT } from '../data/awpCatalogs.js'

/**
 * Configuración AWP de un proyecto (modelo de Aura AWP): identificación,
 * clasificación, ubicación, fechas, presupuesto, disciplinas (con prefijo+color)
 * y parámetros AWP + nomenclatura. Scaffold local por proyecto (localStorage);
 * preparado para mover a la base de datos sin cambiar la UI.
 */
const KEY = (projectId) => `sqy-awp-config-${projectId}`

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

  useEffect(() => {
    try { localStorage.setItem(KEY(projectId), JSON.stringify(config)) } catch { /* cuota */ }
  }, [projectId, config])

  // Setea un campo (soporta rutas tipo 'awp.hhMaxCwa').
  const setField = useCallback((path, value) => {
    setConfig((c) => {
      if (!path.includes('.')) return { ...c, [path]: value }
      const [a, b, d] = path.split('.')
      if (d) return { ...c, [a]: { ...c[a], [b]: { ...(c[a]?.[b] || {}), [d]: value } } }
      return { ...c, [a]: { ...(c[a] || {}), [b]: value } }
    })
  }, [])

  const setDisciplina = useCallback((id, patch) => {
    setConfig((c) => ({ ...c, disciplinas: c.disciplinas.map((d) => (d.id === id ? { ...d, ...patch } : d)) }))
  }, [])

  const applyPreset = useCallback((presetId) => {
    const p = AWP_PRESETS[presetId]
    if (p) setConfig((c) => ({ ...c, awp: { ...c.awp, ...p } }))
  }, [])

  const disciplinasActivas = useMemo(() => config.disciplinas.filter((d) => d.activa), [config.disciplinas])

  return { config, setField, setDisciplina, applyPreset, disciplinasActivas }
}
