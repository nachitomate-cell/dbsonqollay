import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { BoxSelect, Camera, ChevronDown, Check, FolderOpen, Gauge, Layers, Link2, ListChecks, Loader2, Save, Search, Sparkles, Trash2, Upload, X } from 'lucide-react'
import { addProject, deleteProjectRemote, fetchAllProjects, listProjects } from '../utils/apsProjects.js'
import { getApsViewer, parkApsViewer } from './apsViewerSingleton.js'
import ConnectAwpModal from './ConnectAwpModal.jsx'

/**
 * Visor de modelos reales con el SDK de Autodesk (APS Viewer) + comportamientos
 * AWP de la lámina "Uso de BIM":
 *   - Aislar por CWA / CWP / IWP / SWP: el resto del modelo queda en blanco con
 *     ~75% de transparencia y solo el paquete elegido se ve resaltado.
 *   - Exportar imagen del estado actual en formato 16:9.
 *   - Listado de componentes del paquete (TAGs) tomado de los datos.
 *
 * El vínculo datos ↔ geometría se hace por el valor del TAG (o el campo de
 * vínculo) contra el nombre/propiedad del objeto del modelo. Como cada modelo
 * nombra distinto, se cruza por "search" del Viewer sobre el valor del TAG.
 *
 * props:
 *   rows, headers           — datos de la subcategoría (para listar el paquete)
 *   selectedTag             — TAG activo (cross-selection desde la planilla)
 *   onSelect(tag)           — clic en geometría -> notifica el TAG
 */
// Base del backend APS. Prioridad: localStorage > VITE_APS_API > mismo origen.
const getAPI = () =>
  localStorage.getItem('sqy-api-url') ||
  import.meta.env.VITE_APS_API ||
  ''

// Agrupa las propiedades del objeto por su "displayCategory" (como en Navisworks).
function groupProps(properties) {
  const map = new Map()
  for (const p of properties) {
    if (p.hidden || p.displayValue === '' || p.displayValue == null) continue
    const cat = p.displayCategory || 'General'
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat).push({ name: p.displayName, value: String(p.displayValue), units: p.units || '' })
  }
  return Array.from(map.entries()).map(([category, items]) => ({ category, items }))
}

// Estilo "profesional" del visor APS. `hq` = alta calidad (sombras, AO,
// reflejo de piso, bordes); en `false` prioriza rendimiento (GPU modestas).
// Cada ajuste va envuelto por separado: si uno falla (el visor puede no estar
// listo, o un efecto no es compatible con la GPU), no debe abortar los demás.
function safe(fn) {
  try { fn() } catch { /* ajuste no disponible aún o no soportado */ }
}

// El visor solo acepta theming/aislado cuando ya tiene un modelo cargado y su
// `impl` interno listo. Llamarlo antes (o tras perder el contexto WebGL) lanza
// "Cannot read properties of undefined (reading 'clearThemingColors')", que el
// ErrorBoundary captura y reemplaza el visor por la pantalla de error. Este
// guard evita esa caída: si el visor no está listo, la operación es un no-op.
function viewerHasModel(v) {
  try { return !!(v && v.impl && (v.model || v.getVisibleModels?.().length)) } catch { return false }
}

const normTagStr = (s) => String(s ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')

// Índice TAG→fila de la planilla (normalizado) para matchear rápido.
function buildTagSet(rows, tagk) {
  const set = new Map()
  rows.forEach((r) => { const k = normTagStr(r?.[tagk]); if (k) set.set(k, r[tagk]) })
  return set
}

// Busca, entre el nombre y TODAS las propiedades del objeto, un valor que
// coincida con un TAG de la planilla. Es lo mismo que hace viewer.search (mira
// todas las props), por eso el aislado por TAG funciona aunque el nombre del
// objeto sea genérico ("Conjunto de caras 3D"). Devuelve el TAG o null.
function matchTagInSet(name, properties, set) {
  if (set.has(normTagStr(name))) return set.get(normTagStr(name))
  for (const p of properties || []) {
    const hit = set.get(normTagStr(p.displayValue))
    if (hit) return hit
  }
  return null
}

// Resuelve, para varios dbId, los TAG de planilla que les corresponden mirando
// TODAS sus propiedades (no solo el nombre). getBulkProperties (rápido) con
// fallback a getProperties uno por uno.
function resolveMatchedTags(viewer, ids, rows, tagk, cb) {
  const set = buildTagSet(rows, tagk)
  const done = (vals) => cb([...new Set(vals.filter(Boolean))])
  const viaOneByOne = () => Promise.all(ids.map((id) => new Promise((res) => {
    try { viewer.getProperties(id, (p) => res(matchTagInSet(p?.name, p?.properties, set)), () => res(null)) } catch { res(null) }
  }))).then(done)
  const model = viewer?.model
  try {
    if (model?.getBulkProperties) {
      model.getBulkProperties(ids, { ignoreHidden: false },
        (res) => done((res || []).map((o) => matchTagInSet(o.name, o.properties, set))),
        () => viaOneByOne())
      return
    }
  } catch { /* fallback */ }
  viaOneByOne()
}

function applyViewerStyle(viewer, hq = true) {
  const dark = document.documentElement.classList.contains('dark')
  // Fondo en degradé (top, bottom) en RGB 0-255 — más luminoso y "estudio".
  safe(() => (dark ? viewer.setBackgroundColor(26, 33, 46, 7, 10, 16) : viewer.setBackgroundColor(247, 249, 252, 214, 222, 232)))

  // Iluminación tipo estudio fotográfico (preset de APS):
  //  - Claro: "Boardwalk"(7) da luz suave y agradable.
  //  - Oscuro: "Plaza"(2) mantiene contraste sin quemar.
  safe(() => viewer.setLightPreset?.(dark ? 2 : 7))

  // Calidad de render: SAO (ambient occlusion) + FXAA antialiasing.
  safe(() => viewer.setQualityLevel(hq, true))
  // OJO: tanto la sombra (setGroundShadow) como el reflejo (setGroundReflection)
  // de piso hacen un pase extra que re-proyecta la escena; en GPUs Intel (y según
  // la versión del SDK) ese pase revienta en _projectObject/_initObject con
  // "t.addEventListener is not a function" y tumba el render. Ambos se dejan
  // SIEMPRE desactivados; el resto del look (AO, bordes) se mantiene.
  safe(() => viewer.setGroundShadow(false))
  safe(() => viewer.setGroundReflection(false))
  // Bordes/contornos: resaltan la geometría y dan look técnico (CAD).
  safe(() => viewer.setDisplayEdges?.(hq))
  // Selección y rollover con el naranja de marca.
  if (window.THREE) {
    safe(() => viewer.setSelectionColor?.(new window.THREE.Color(0xf77000)))
    safe(() => viewer.set2dSelectionColor?.(new window.THREE.Color(0xf77000)))
  }
  safe(() => viewer.impl?.renderer?.().setUnitScale?.(1))
}

// Encuadra el modelo completo (zoom-to-fit). Tras GEOMETRY_LOADED la geometría
// puede seguir llegando por streaming y, en el primer intento, fitToView usa una
// bounding-box parcial y deja el modelo como un puntito al centro. Por eso se
// reintenta unas cuantas veces durante ~1.5 s; cada intento es inmediato (sin
// animación) para no marear, y el último deja el encuadre definitivo.
// ¿El elemento tiene tamaño real (no 0×0)? El visor de Autodesk emite
// "Rendering to a canvas that was resized to zero" y puede quedar inservible si
// se le hace resize/render mientras su contenedor está colapsado (transición de
// layout, o adoptado antes de tomar tamaño). Solo operamos cuando hay tamaño.
function hasSize(el) {
  return !!el && el.clientWidth > 0 && el.clientHeight > 0
}

// Diagonal del bounding box (para saber si el modelo dejó de crecer). Evita
// depender de THREE: usa min/max del Box3 directamente.
function bboxSpan(b) {
  if (!b?.min || !b?.max) return 0
  const dx = b.max.x - b.min.x, dy = b.max.y - b.min.y, dz = b.max.z - b.min.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

// Acerca la cámara hacia el objetivo manteniendo el centro (dolly). El fit
// completo deja el modelo lejos/pequeño —sobre todo en plantas grandes donde
// interesa una zona—, así que por defecto entramos un poco más. factor<1 = más
// cerca. Bajalo para acercar más, subilo (hasta 1) para alejar.
const FRAME_ZOOM = 0.85
function zoomCloser(viewer, factor) {
  try {
    const nav = viewer.navigation, T = window.THREE
    if (!nav || !T) return
    const eye = nav.getPosition(), tgt = nav.getTarget()
    nav.setView(
      new T.Vector3(tgt.x + (eye.x - tgt.x) * factor, tgt.y + (eye.y - tgt.y) * factor, tgt.z + (eye.z - tgt.z) * factor),
      tgt,
    )
  } catch { /* noop */ }
}

// Bounding box ROBUSTO: encuadra al grueso del modelo ignorando elementos
// atípicos (un punto/equipo "perdido" lejísimos infla la caja y deja el modelo
// como un puntito). Usa los percentiles 2–98 de los centros de los fragmentos,
// así descarta los outliers. Devuelve null si no puede (→ se usa el bbox normal).
function robustBounds(viewer) {
  try {
    const T = window.THREE, model = viewer.model
    const fl = model?.getFragmentList?.()
    if (!T || !fl) return null
    const n = typeof fl.getCount === 'function' ? fl.getCount() : (fl.fragments?.length || 0)
    if (n < 8) return null // modelos chicos: no hace falta filtrar outliers
    const cx = [], cy = [], cz = [], tmp = new T.Box3()
    for (let i = 0; i < n; i++) {
      try {
        fl.getWorldBounds(i, tmp)
        if (!tmp.isEmpty()) { cx.push((tmp.min.x + tmp.max.x) / 2); cy.push((tmp.min.y + tmp.max.y) / 2); cz.push((tmp.min.z + tmp.max.z) / 2) }
      } catch { /* fragmento sin bounds: lo salta */ }
    }
    if (cx.length < 8) return null
    const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.max(0, Math.min(s.length - 1, Math.floor((s.length - 1) * p)))] }
    const box = new T.Box3(
      new T.Vector3(pct(cx, 0.02), pct(cy, 0.02), pct(cz, 0.02)),
      new T.Vector3(pct(cx, 0.98), pct(cy, 0.98), pct(cz, 0.98)),
    )
    if (box.isEmpty()) return null
    const size = box.getSize(new T.Vector3())
    box.expandByVector(size.multiplyScalar(0.12)) // margen para no cortar bordes
    return box
  } catch { return null }
}

function frameModel(viewer) {
  let tries = 0, lastSpan = -1, stable = 0
  const fit = () => {
    if (!viewer) return
    if (viewer.model && hasSize(viewer.container)) {
      try {
        viewer.resize()
        // Encuadra al grueso del modelo (bbox robusto que ignora outliers); si no
        // se puede, al bounding box completo; último recurso, fitToView.
        const bbox = robustBounds(viewer) || viewer.model.getBoundingBox?.()
        if (bbox && viewer.navigation?.fitBounds) viewer.navigation.fitBounds(true, bbox)
        else viewer.fitToView(null, viewer.model, true)
        // Acerca un poco el encuadre por defecto (el fit completo queda muy lejos).
        zoomCloser(viewer, FRAME_ZOOM)
        // ¿El bounding box dejó de crecer? La geometría llega por streaming, así
        // que reencuadramos mientras crece y paramos cuando se estabiliza (evita
        // dejarlo "muy lejos" por un encuadre prematuro a una caja parcial).
        const span = bboxSpan(bbox)
        if (span > 0 && Math.abs(span - lastSpan) <= span * 0.001) { if (++stable >= 3) return }
        else stable = 0
        lastSpan = span
      } catch { /* el visor aún no está listo; lo intenta el próximo tick */ }
    }
    // Reintenta hasta ~6 s (la geometría grande tarda en terminar de llegar).
    if (++tries < 30) setTimeout(fit, 200)
  }
  // Primer intento en el siguiente frame (deja que el canvas tome su tamaño).
  requestAnimationFrame(fit)
}

// Paleta de colores distintos para "Colorear por CWP" (cicla si hay más CWPs).
const CWP_PALETTE = [
  '#f77000', '#2563eb', '#16a34a', '#db2777', '#9333ea', '#0891b2', '#ca8a04',
  '#dc2626', '#4f46e5', '#059669', '#e11d48', '#7c3aed', '#0284c7', '#65a30d',
]
// hex "#rrggbb" → THREE.Vector4 (componentes 0..1) para setThemingColor.
function hexToVec4(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return window.THREE ? new window.THREE.Vector4(r, g, b, 1) : null
}

// Peso de avance de un estado "E<n>": E1=0 … E4=1. null si no se reconoce.
function avanceWeight(v) {
  const m = /e\s*(\d+)/i.exec(String(v ?? '').trim())
  if (!m) return null
  return Math.max(0, Math.min(1, (Number(m[1]) - 1) / 3))
}
// Color de "mapa de calor" para un peso 0..1: rojo (0) → ámbar (0.5) → verde (1).
function heatVec(w) {
  if (!window.THREE) return null
  const stops = [[220, 38, 38], [245, 158, 11], [22, 163, 74]]
  const seg = w <= 0.5 ? 0 : 1
  const t = w <= 0.5 ? w / 0.5 : (w - 0.5) / 0.5
  const a = stops[seg], b = stops[seg + 1]
  return new window.THREE.Vector4(
    (a[0] + (b[0] - a[0]) * t) / 255,
    (a[1] + (b[1] - a[1]) * t) / 255,
    (a[2] + (b[2] - a[2]) * t) / 255,
    1,
  )
}

function ApsViewer({ rows = [], headers = [], selectedTag, onSelect, onEditRecord, onEditRecords, awpCwps = [], onImportCwps, onConnectAwp, dataKey = 'default', isFiltered = false, findTagAcross, onOpenSubcategory }) {
  const mountRef = useRef(null)
  const viewerRef = useRef(null)
  const fileRef = useRef(null)
  const ctxRef = useRef({}) // estado interno persistente (initStarted, urn cargado…)
  // Refs siempre frescas para el handler de selección (vive en un efecto que se
  // monta una sola vez y no debe capturar rows/headers viejos).
  const rowsRef = useRef(rows); rowsRef.current = rows
  const headersRef = useRef(headers); headersRef.current = headers
  const [status, setStatus] = useState('idle') // idle|loadingSdk|uploading|translating|ready|error
  const [message, setMessage] = useState('')
  // El modelo 3D es el modelo federado del PROYECTO: se comparte entre todas las
  // disciplinas/vistas (NO se recuerda por subcategoría). Así, al cambiar de
  // disciplina, el visor sigue mostrando el mismo modelo en vez de quedar en
  // blanco. Se guarda en localStorage para reabrirlo directo por su urn sin
  // re-subir ni re-traducir.
  const storeKey = 'sqy-aps-model'
  const restored = (() => {
    try { return JSON.parse(localStorage.getItem(storeKey)) || {} } catch { return {} }
  })()
  const [urn, setUrn] = useState(restored.urn || import.meta.env.VITE_APS_URN || '')
  const [modelName, setModelName] = useState(restored.name || null)
  const [projects, setProjects] = useState(() => listProjects())
  const [showProjects, setShowProjects] = useState(false)
  const [loadingProjects, setLoadingProjects] = useState(false)
  // Alta calidad (sombras/AO/bordes) vs. rendimiento. Persistido por usuario.
  const [hq, setHq] = useState(() => localStorage.getItem('sqy-aps-hq') !== '0')
  useEffect(() => { localStorage.setItem('sqy-aps-hq', hq ? '1' : '0') }, [hq])
  // Reaplica el estilo cuando cambia la calidad.
  useEffect(() => { if (viewerRef.current) applyViewerStyle(viewerRef.current, hq) }, [hq])

  // Carga la lista combinada (bucket de APS + locales) al abrir el desplegable.
  function refreshProjects() {
    setLoadingProjects(true)
    fetchAllProjects().then((list) => { setProjects(list); setLoadingProjects(false) })
  }
  useEffect(() => { fetchAllProjects().then(setProjects) }, [])

  function rememberModel(u, name) {
    try { localStorage.setItem(storeKey, JSON.stringify({ urn: u, name: name || null })) } catch { /* ignore */ }
  }
  // Reabre un proyecto guardado (ya traducido) sin re-subir el archivo. Abre
  // SIEMPRE la última versión.
  function openProject(p) {
    setShowProjects(false)
    if (p.urn === ctxRef.current.loadedUrn) return // ya está abierto
    setUrn(p.urn); setModelName(p.name); rememberModel(p.urn, p.name)
    if (viewerRef.current) loadDocument(p.urn, { force: true })
  }
  // Abre una VERSIÓN puntual del proyecto (desde el selector de versiones).
  function openVersion(p, vUrn) {
    if (!vUrn) return
    setShowProjects(false)
    if (vUrn === ctxRef.current.loadedUrn) return
    setUrn(vUrn); setModelName(p.name); rememberModel(vUrn, p.name)
    if (viewerRef.current) loadDocument(vUrn, { force: true })
  }
  function deleteProject(p) {
    deleteProjectRemote(p)
    setProjects((prev) => prev.filter((x) => x.urn !== p.urn))
  }
  function forgetModel() {
    try { localStorage.removeItem(storeKey) } catch { /* ignore */ }
    // Descarga el modelo del visor singleton (compartido entre disciplinas) para
    // que "Quitar modelo" lo saque de todas las vistas, no solo de ésta.
    const v = viewerRef.current
    if (v) {
      try { (v.getVisibleModels?.() || []).forEach((m) => v.unloadModel?.(m)) } catch { /* noop */ }
    }
    ctxRef.current.loadedUrn = null
    setUrn(''); setModelName(null)
    setStatus('ready')
  }

  // Filtro AWP
  const tagKey = headers[0]
  const awpFields = useMemo(() => headers.filter((h) => /CWA|CWP|EWP|PWP|IWP|SWP|WBS|AWP/i.test(h)), [headers])
  const [awpField, setAwpField] = useState('')
  const [awpSel, setAwpSel] = useState([]) // valores AWP seleccionados (multi)
  const [awpOpen, setAwpOpen] = useState(false)
  const [awpQuery, setAwpQuery] = useState('')
  const [objProps, setObjProps] = useState(null) // propiedades del objeto pinchado
  const [showProps, setShowProps] = useState(true)

  // ---- vínculo con la planilla: editar los datos de ingeniería del objeto ----
  // Al pinchar un objeto se busca su registro en la planilla por TAG y se
  // muestran sus campos EDITABLES en el panel. Se guardan con onEditRecord, que
  // persiste en el dataset editable → queda sincronizado con la tabla. Esto
  // funciona también en pantalla completa (el drawer de la tabla no se ve ahí).
  const [linkRow, setLinkRow] = useState(null) // { id } del registro vinculado
  const [draft, setDraft] = useState(null)     // borrador editable de sus campos
  const [savedField, setSavedField] = useState(false)
  const normTag = (s) => String(s ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  useEffect(() => {
    // objProps.tag = TAG de la planilla resuelto al pinchar (buscado en TODAS
    // las propiedades del objeto, no solo el nombre).
    if (!objProps || !objProps.tag) { setLinkRow(null); setDraft(null); return }
    const tagk = headers[0]
    const target = normTag(objProps.tag)
    const row = rows.find((r) => normTag(r[tagk]) === target)
    if (row) { setLinkRow({ id: row._id }); setDraft({ ...row }) }
    else { setLinkRow(null); setDraft(null) }
    setSavedField(false)
    // Solo al cambiar de objeto (no en cada edición), para no pisar lo escrito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objProps?.dbId])
  function saveLinked() {
    if (!linkRow || !draft || !onEditRecord) return
    const patch = {}
    headers.forEach((h) => { patch[h] = draft[h] ?? '' })
    onEditRecord(linkRow.id, patch)
    setSavedField(true)
    setTimeout(() => setSavedField(false), 2000)
  }

  // ---- edición múltiple: Ctrl/Cmd+clic en el 3D selecciona varios ----
  // `multiNames` = TAGs de los objetos seleccionados (null si hay <2). Se
  // matchean contra la planilla por TAG para obtener los registros a editar.
  const [multiNames, setMultiNames] = useState(null)
  const [bulkField, setBulkField] = useState('')
  const [bulkValue, setBulkValue] = useState('')
  const [bulkSaved, setBulkSaved] = useState(false)
  // Conjunto a editar elegido por filtro/paquete (sin clic en 3D): { ids, tags, label }.
  const [bulkSet, setBulkSet] = useState(null)
  const [showConnectAwp, setShowConnectAwp] = useState(false) // modal "Conectar a AWP" desde el 3D
  const [colorMode, setColorMode] = useState('none') // 'none' | 'cwp' | 'avance'
  const [cwpLegend, setCwpLegend] = useState([]) // [{ cwp, hex, count, found }]
  // Modo "selección por área" (arrastre): activa la extensión BoxSelection.
  const [areaMode, setAreaMode] = useState(false)
  const multiRows = useMemo(() => {
    if (!multiNames || multiNames.length < 2) return null
    const tagk = headers[0]
    const map = new Map() // _id → TAG (deduplica si dos objetos mapean al mismo registro)
    multiNames.forEach((nm) => {
      const t = normTag(nm)
      if (!t) return
      // Match exacto por TAG; el fallback por substring solo para TAGs largos
      // (>=4 chars) para evitar falsos positivos con TAGs cortos como "P1"/"01".
      const row = rows.find((r) => normTag(r[tagk]) === t)
        || rows.find((r) => { const nt = normTag(r[tagk]); return nt && nt.length >= 4 && t.includes(nt) })
      if (row) map.set(row._id, row[tagk])
    })
    return { ids: [...map.keys()], tags: [...map.values()] }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiNames, rows, headers.join('|')])

  useEffect(() => { if (!awpField && awpFields.length) setAwpField(awpFields[0]) }, [awpFields, awpField])
  // Al cambiar de campo AWP, limpia la selección.
  useEffect(() => { setAwpSel([]) }, [awpField])

  // Valores del campo AWP con su conteo de elementos.
  const awpValues = useMemo(() => {
    if (!awpField) return []
    const m = new Map()
    rows.forEach((r) => {
      const v = r[awpField]
      if (v === '' || v == null) return
      const k = String(v)
      m.set(k, (m.get(k) || 0) + 1)
    })
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0], 'es'))
  }, [rows, awpField])

  // TAGs que pertenecen a los paquetes seleccionados (listado de componentes).
  const packageTags = useMemo(() => {
    if (!awpField || !awpSel.length) return []
    const set = new Set(awpSel)
    return rows.filter((r) => set.has(String(r[awpField] ?? ''))).map((r) => String(r[tagKey] ?? '')).filter(Boolean)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, awpField, awpSel])

  // Conjunto activo para edición masiva: el elegido por filtro/paquete tiene
  // prioridad; si no, los objetos seleccionados en el 3D (Ctrl/Cmd+clic o área).
  const activeBulk = bulkSet || multiRows
  function saveBulk() {
    if (!activeBulk || !activeBulk.ids.length || !bulkField || !onEditRecords) return
    onEditRecords(activeBulk.ids, { [bulkField]: bulkValue })
    setBulkSaved(true)
    setTimeout(() => setBulkSaved(false), 2000)
  }
  function closeBulk() {
    if (bulkSet) setBulkSet(null)
    else { setMultiNames(null); safe(() => viewerRef.current?.clearSelection?.()) }
    setBulkField(''); setBulkValue('') // no dejar el campo/valor pre-cargados para la próxima selección
  }
  // Edita TODO el conjunto activo sin seleccionar a mano: el paquete AWP elegido,
  // o si no, las filas actualmente filtradas en la planilla (lo que se ve).
  function editActiveSet() {
    const tagk = headers[0]
    let target = rows
    let label = isFiltered ? 'filtrados' : 'del modelo'
    if (awpSel.length && packageTags.length) {
      const set = new Set(packageTags.map(normTag))
      target = rows.filter((r) => set.has(normTag(r[tagk])))
      label = awpSel.length === 1 ? `paquete ${awpSel[0]}` : `${awpSel.length} paquetes`
    }
    if (!target.length) return
    setObjProps(null); setMultiNames(null)
    setBulkField(''); setBulkValue('')
    setBulkSet({ ids: target.map((r) => r._id), tags: target.map((r) => String(r[tagk] ?? '')), label })
    setShowProps(true)
  }
  // Selección por área: arrastrar un rectángulo selecciona todo lo que toca
  // (incluidos los elementos pequeños). Usa la extensión oficial BoxSelection;
  // su resultado dispara SELECTION_CHANGED → el panel de edición múltiple.
  async function toggleArea() {
    const v = viewerRef.current
    if (!v) return
    try {
      if (!ctxRef.current.boxExt) ctxRef.current.boxExt = await v.loadExtension('Autodesk.BoxSelection')
      const ext = ctxRef.current.boxExt
      const next = !areaMode
      if (next) { ext.activate ? ext.activate() : v.toolController?.activateTool?.('box-selection') }
      else { ext.deactivate ? ext.deactivate() : v.toolController?.deactivateTool?.('box-selection') }
      setAreaMode(next)
    } catch (e) {
      console.warn('[APS] Selección por área no disponible:', e?.message || e)
      setMessage('La selección por área no está disponible en este visor.')
    }
  }

  // Callback siempre fresco sin re-disparar efectos.
  const onSelectRef = useRef(onSelect)
  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])

  // ---- adopta el visor SINGLETON (un único contexto WebGL para toda la app) ----
  useEffect(() => {
    let cancelled = false
    setStatus('loadingSdk')
    getApsViewer(() =>
      fetch(`${getAPI()}/api/aps/token`, { cache: 'no-store' })
        .catch(() => { throw new Error(`No se pudo conectar al backend APS (${getAPI() || location.origin}). En el sitio publicado, configura VITE_APS_API con la URL del backend desplegado.`) })
        .then(async (r) => {
          const ct = r.headers.get('content-type') || ''
          const isJson = ct.includes('application/json')
          if (!isJson) {
            const preview = await r.text().then((t) => t.slice(0, 120)).catch(() => '?')
            throw new Error(
              `El backend APS devolvió ${r.status} con content-type "${ct}" — esperaba JSON.\n` +
              `URL real: ${getAPI() || location.origin}/api/aps/token\n` +
              `SW activo: ${navigator.serviceWorker?.controller ? 'SÍ (' + (navigator.serviceWorker.controller.scriptURL) + ')' : 'NO'}\n` +
              `Respuesta: ${preview}`
            )
          }
          const data = await r.json()
          if (!r.ok) throw new Error(data.error || `Error ${r.status} del backend APS`)
          return data
        }),
    )
      .then(({ viewer, container }) => {
        if (cancelled) return
        viewerRef.current = viewer
        // Mueve el contenedor compartido del visor a este componente.
        mountRef.current?.appendChild(container)
        // Solo redimensiona si ya tiene tamaño: si está colapsado, el
        // ResizeObserver hará el resize al crecer (evita "canvas resized to zero").
        if (hasSize(mountRef.current)) { try { viewer.resize() } catch { /* noop */ } }
        applyViewerStyle(viewer, hq)

        // Handlers propios de esta instancia (se quitan al desmontar).
        const onSel = (e) => {
          const ids = e.dbIdArray || []
          if (ids.length === 0) { setObjProps(null); setMultiNames(null); return }
          if (ids.length === 1) {
            // Selección simple: ficha + edición de un registro (comportamiento normal).
            setMultiNames(null)
            const id = ids[0]
            viewer.getProperties(id, (props) => {
              onSelectRef.current?.(props.name || String(id))
              // El TAG de la planilla puede estar en cualquier propiedad (no solo
              // el nombre): se busca en todas para vincular el registro a editar.
              const tag = matchTagInSet(props.name, props.properties, buildTagSet(rowsRef.current, headersRef.current[0]))
              setObjProps({ name: props.name || `Objeto ${id}`, tag, dbId: id, groups: groupProps(props.properties || []) })
            })
            return
          }
          // Selección múltiple (Ctrl/Cmd+clic o área): panel de edición masiva.
          // Se resuelven los TAG de todos los objetos mirando todas sus props.
          setObjProps(null)
          resolveMatchedTags(viewer, ids, rowsRef.current, headersRef.current[0], (tags) => setMultiNames(tags))
        }
        viewer.addEventListener(window.Autodesk.Viewing.SELECTION_CHANGED_EVENT, onSel)
        ctxRef.current.onSel = onSel

        const ro = new ResizeObserver(() => { if (hasSize(mountRef.current)) { try { viewer.resize() } catch { /* noop */ } } })
        ro.observe(mountRef.current)
        ctxRef.current.resizeObs = ro
        const themeObs = new MutationObserver(() => applyViewerStyle(viewer, hq))
        themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
        ctxRef.current.themeObs = themeObs

        // Carga el modelo (compartido por todas las disciplinas vía storeKey). Una
        // instancia nueva siempre recarga (force): es el camino que SÍ renderiza
        // tras re-adoptar el canvas en otro contenedor. El modelo/derivado queda
        // cacheado en Autodesk, así que reabrir el mismo urn es rápido.
        if (urn) {
          loadDocument(urn, { force: ctxRef.current.loadedUrn !== urn })
        } else {
          // Sin modelo recordado: carga AUTOMÁTICAMENTE el modelo por defecto del
          // proyecto (el primero disponible en el bucket APS). Así el visor siempre
          // muestra el modelo sin que el usuario tenga que seleccionarlo. Queda
          // recordado para los próximos montajes.
          setStatus('ready')
          fetchAllProjects()
            .then((list) => {
              if (cancelled || !viewerRef.current || !list.length) return
              const def = list[0]
              setProjects(list)
              setUrn(def.urn); setModelName(def.name); rememberModel(def.urn, def.name)
              loadDocument(def.urn, { force: true })
            })
            .catch(() => { /* sin backend: queda el prompt de subir modelo */ })
        }
      })
      .catch((e) => { if (!cancelled) { setStatus('error'); setMessage(e.message) } })

    return () => {
      cancelled = true
      // NO se destruye el visor (es singleton). Solo se "suelta": se quitan los
      // listeners de esta instancia y se saca el contenedor del DOM de este
      // componente. El visor y su contexto WebGL siguen vivos para reusarse.
      ctxRef.current.themeObs?.disconnect?.()
      ctxRef.current.resizeObs?.disconnect?.()
      const v = viewerRef.current
      if (v && ctxRef.current.onSel) {
        try { v.removeEventListener(window.Autodesk.Viewing.SELECTION_CHANGED_EVENT, ctxRef.current.onSel) } catch { /* noop */ }
      }
      const cont = v?.container
      // Solo se suelta el contenedor si SIGUE colgando de NUESTRO mount. Si otra
      // instancia (otra disciplina) ya lo adoptó, su parentNode es el mount de la
      // otra: NO se lo robamos, o esa vista quedaría en blanco. En vez de sacarlo
      // del DOM (lo dejaría a 0×0 → warning "canvas resized to zero"), se ESTACIONA
      // en un host oculto con tamaño real hasta que otra vista lo re-adopte.
      if (cont && mountRef.current && cont.parentNode === mountRef.current) {
        parkApsViewer()
      }
      viewerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function loadDocument(theUrn, opts = {}) {
    const viewer = viewerRef.current
    if (!viewer) return
    // Evita cargas concurrentes (OtgLoader "stopping load before complete" →
    // corrompe la escena). Si ya está cargado/cargándose ese urn, no recarga.
    if (!opts.force && (ctxRef.current.loadingUrn === theUrn || ctxRef.current.loadedUrn === theUrn)) return
    if (ctxRef.current.loadingUrn && ctxRef.current.loadingUrn !== theUrn) {
      // Hay otra carga en curso: reintenta cuando termine.
      ctxRef.current.pendingUrn = theUrn
      return
    }
    ctxRef.current.loadingUrn = theUrn
    // Descarga modelos previos antes de cargar el nuevo (evita superposición).
    try { (viewer.getVisibleModels?.() || []).forEach((m) => viewer.unloadModel?.(m)) } catch { /* noop */ }

    // Si la traducción aún no terminó, los derivados (SVF) todavía no existen y la
    // carga falla con 403 / "sin acceso". En vez de mostrar un error que asusta,
    // consultamos el progreso real y reintentamos solo, abriéndolo al terminar.
    const waitAndRetry = async () => {
      ctxRef.current.loadingUrn = null
      const n = (ctxRef.current.retry?.urn === theUrn ? ctxRef.current.retry.n : 0) + 1
      ctxRef.current.retry = { urn: theUrn, n }
      if (n > 40) { setStatus('error'); setMessage('El modelo tardó demasiado en procesarse. Reintenta más tarde.'); return }
      let st = '', progress = ''
      try {
        const s = await fetch(`${getAPI()}/api/aps/status/${theUrn}`, { cache: 'no-store' }).then((r) => r.json())
        st = s.status; progress = s.progress
      } catch { /* sin estado: igual reintentamos */ }
      if (st === 'failed' || st === 'timeout') {
        setStatus('error'); setMessage('La traducción del modelo falló en la nube. Vuelve a publicarlo.'); return
      }
      setStatus('translating')
      setMessage(`Procesando el modelo en la nube${progress && progress !== 'complete' ? ` (${progress})` : ''}… se abrirá solo al terminar.`)
      setTimeout(() => loadDocument(theUrn, { force: true }), 8000)
    }

    setStatus('translating'); setMessage('Abriendo modelo…')
    window.Autodesk.Viewing.Document.load(
      `urn:${theUrn}`,
      (doc) => {
        // El callback puede llegar tras desmontar (cambio de pestaña): si el
        // visor ya no existe, abortamos para no tocar un objeto destruido.
        if (!viewerRef.current) { ctxRef.current.loadingUrn = null; return }
        const root = doc.getRoot()
        let node = root.getDefaultGeometry()
        if (!node) {
          const geoms = root.search({ type: 'geometry', role: '3d' })
          node = geoms?.[0] || root.search({ type: 'geometry' })?.[0]
        }
        // Sin vista 3D todavía: el derivado probablemente aún se está generando.
        if (!node) { waitAndRetry(); return }
        const onGeom = () => {
          viewer.removeEventListener(window.Autodesk.Viewing.GEOMETRY_LOADED_EVENT, onGeom)
          ctxRef.current.loadingUrn = null
          ctxRef.current.loadedUrn = theUrn
          ctxRef.current.retry = null // cargó OK: resetea el contador de reintentos
          applyViewerStyle(viewer, hq)
          frameModel(viewer)
          setStatus('ready'); setMessage('')
          // Si llegó un pedido de cargar otro modelo mientras tanto, atiéndelo.
          const next = ctxRef.current.pendingUrn
          if (next && next !== theUrn) { ctxRef.current.pendingUrn = null; loadDocument(next) }
          else ctxRef.current.pendingUrn = null
        }
        viewer.addEventListener(window.Autodesk.Viewing.GEOMETRY_LOADED_EVENT, onGeom)
        // Falla típica cuando el SVF aún no está disponible (403): reintentar.
        viewer.loadDocumentNode(doc, node).catch(() => {
          viewer.removeEventListener(window.Autodesk.Viewing.GEOMETRY_LOADED_EVENT, onGeom)
          waitAndRetry()
        })
      },
      (code) => {
        if (code === 9 || code === window.Autodesk.Viewing.ErrorCodes?.NETWORK_FAILED) waitAndRetry()
        else { ctxRef.current.loadingUrn = null; setStatus('error'); setMessage(`No se pudo abrir el modelo (código ${code}).`) }
      },
    )
  }

  async function handleUpload(file) {
    try {
      setStatus('uploading'); setMessage('Preparando subida…')
      const connErr = () => { throw new Error(`No se pudo conectar al backend APS. Verifica el despliegue (VITE_APS_API o las funciones /api).`) }

      // 1) Pedir URL firmada al backend (paquete pequeño, no el archivo).
      const { objectKey, uploadKey, urls } = await fetch(`${getAPI()}/api/aps/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name }),
      }).catch(connErr).then((r) => {
        if (!r.ok || !r.headers.get('content-type')?.includes('application/json')) throw new Error('No se pudo iniciar la subida.')
        return r.json()
      })

      // 2) Subir el binario DIRECTO a Autodesk (S3), sin pasar por el backend
      //    (evita el límite de tamaño de las funciones serverless).
      setMessage('Subiendo modelo a Autodesk…')
      const put = await fetch(urls[0], { method: 'PUT', body: file }).catch(connErr)
      if (!put.ok) throw new Error('Falló la subida del archivo a Autodesk.')

      // 3) Confirmar y lanzar la traducción.
      setMessage('Procesando modelo…')
      const { urn: newUrn } = await fetch(`${getAPI()}/api/aps/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectKey, uploadKey }),
      }).catch(connErr).then((r) => {
        if (!r.ok || !r.headers.get('content-type')?.includes('application/json')) throw new Error('No se pudo procesar el modelo.')
        return r.json()
      })

      setUrn(newUrn); setModelName(file.name); rememberModel(newUrn, file.name)
      setProjects(addProject({ urn: newUrn, name: file.name })) // queda como proyecto guardado
      setMessage('Traduciendo modelo (puede tardar varios minutos)…')
      pollStatus(newUrn)
    } catch (e) { setStatus('error'); setMessage(e.message) }
  }

  async function pollStatus(theUrn) {
    setStatus('translating')
    const tick = async () => {
      try {
        const s = await fetch(`${getAPI()}/api/aps/status/${theUrn}`).then((r) => {
          if (!r.ok || !r.headers.get('content-type')?.includes('application/json')) throw new Error('status fetch error')
          return r.json()
        })
        if (s.status === 'success') return loadDocument(theUrn)
        if (s.status === 'failed') { setStatus('error'); setMessage('La traducción del modelo falló.'); return }
        setMessage(`Traduciendo… ${s.progress || ''}`)
        setTimeout(tick, 6000)
      } catch { setTimeout(tick, 8000) }
    }
    tick()
  }

  // ---- utilidades de geometría ----
  // Busca los dbIds cuyo nombre/propiedad coincide con alguno de los valores.
  // El vínculo dato↔geometría se hace por TAG, pero los modelos nombran/etiquetan
  // distinto, así que: (1) se busca en TODAS las propiedades (no solo "name") y
  // (2) se prueban variantes del TAG por si en el modelo aparece sin el prefijo
  // de área o sin separadores (p. ej. "230-AIR-011" ↔ "AIR-011" ↔ "230AIR011").
  function searchOne(viewer, text) {
    return new Promise((resolve) => {
      if (!text) { resolve([]); return }
      // Sin lista de atributos → Forge busca en displayName y todas las props string.
      try { viewer.search(String(text), (ids) => resolve(ids || []), () => resolve([])) }
      catch { resolve([]) }
    })
  }
  function tagVariants(v) {
    const s = String(v).trim()
    if (!s) return []
    const out = new Set([s])
    out.add(s.replace(/[\s_]+/g, '-')) // normaliza separadores a guion
    out.add(s.replace(/[^A-Za-z0-9]/g, '')) // sin separadores
    const seg = s.split(/[-_\s]/).filter(Boolean)
    if (seg.length > 1) out.add(seg.slice(1).join('-')) // sin el primer bloque (área)
    return [...out].filter(Boolean)
  }
  // Filtra los candidatos de `viewer.search` dejando SOLO los que de verdad tienen
  // una propiedad cuyo valor coincide EXACTO (normalizado) con alguno de los TAGs
  // buscados. Hace falta porque Forge tokeniza la consulta: buscar "06940-AIR-001"
  // matchea TODO lo que contenga "06940" (el prefijo de área), no el único elemento.
  // `wanted` = Set de variantes normalizadas (incluye el TAG sin prefijo/sin
  // separadores), así que un modelo que nombra distinto sigue matcheando.
  function verifyTagMatches(viewer, ids, wanted) {
    return new Promise((resolve) => {
      if (!ids.length) { resolve([]); return }
      const hit = (name, props) => {
        if (wanted.has(normTagStr(name))) return true
        for (const p of props || []) if (wanted.has(normTagStr(p.displayValue))) return true
        return false
      }
      const keep = []
      const viaOneByOne = () => Promise.all(ids.map((id) => new Promise((res) => {
        try { viewer.getProperties(id, (p) => res(hit(p?.name, p?.properties) ? id : null), () => res(null)) } catch { res(null) }
      }))).then((arr) => resolve(arr.filter((x) => x != null)))
      const model = viewer?.model
      try {
        if (model?.getBulkProperties) {
          model.getBulkProperties(ids, { ignoreHidden: false },
            (res) => { (res || []).forEach((o) => { if (hit(o.name, o.properties)) keep.push(o.dbId) }); resolve(keep) },
            () => viaOneByOne())
          return
        }
      } catch { /* fallback abajo */ }
      viaOneByOne()
    })
  }
  async function findDbIds(values) {
    const viewer = viewerRef.current
    if (!viewer || !values.length) return []
    // 1) Junta candidatos de TODAS las variantes (la búsqueda de Forge sobre-matchea
    //    por tokenización) y arma el set de variantes normalizadas a verificar.
    const wanted = new Set()
    const candidates = new Set()
    await Promise.all(values.map(async (v) => {
      for (const variant of tagVariants(v)) {
        wanted.add(normTagStr(variant))
        const ids = await searchOne(viewer, variant)
        ids.forEach((id) => candidates.add(id))
      }
    }))
    wanted.delete('')
    // 2) Verifica contra el valor real de las propiedades: descarta los falsos
    //    positivos (p. ej. todo el área "06940") y deja solo los TAGs exactos.
    if (!candidates.size || !wanted.size) return []
    return verifyTagMatches(viewer, [...candidates], wanted)
  }

  // Comportamiento de la lámina: aislar el paquete, resto en blanco + 75% transp.
  // Un "token" evita que un search asíncrono viejo pise un filtro más nuevo.
  async function isolatePackage() {
    const viewer = viewerRef.current
    if (!viewer || !packageTags.length || !viewerHasModel(viewer)) return
    const token = ++ctxRef.current.awpToken
    ctxRef.current.filterActive = false // el paquete AWP tiene prioridad sobre el filtro de planilla
    setMessage('Aislando paquete…')
    const dbIds = await findDbIds(packageTags)
    // Si llegó tarde (cambió el filtro o se limpió), descartar este resultado.
    if (token !== ctxRef.current.awpToken || !viewerRef.current) return
    if (!dbIds.length) { setMessage('No se encontraron objetos del paquete en el modelo (revisa el campo de vínculo).'); return }

    ctxRef.current.awpActive = true
    ctxRef.current.hlIds = [] // el theming del paquete (abajo) sustituye al realce de fila
    // Ghosting nativo: el resto del modelo queda como "fantasma" gris tenue que
    // SÍ da contexto sobre cualquier fondo (no blanco invisible). `isolate`
    // mantiene el paquete a color pleno y atenúa lo demás.
    safe(() => {
      viewer.setGhosting(true)
      viewer.isolate(dbIds)
      // Resalta el paquete elegido en naranja de marca para que destaque.
      const ORANGE = new window.THREE.Vector4(0.97, 0.44, 0, 1)
      viewer.clearThemingColors()
      dbIds.forEach((id) => viewer.setThemingColor(id, ORANGE))
      viewer.fitToView(dbIds)
    })
    setMessage('')
  }

  // Aísla en el 3D los elementos que están en la planilla filtrada (resto en
  // fantasma). Se dispara solo cuando hay un filtro de planilla activo y NO hay
  // un paquete AWP seleccionado (ese tiene prioridad).
  async function isolateFilteredRows() {
    const viewer = viewerRef.current
    const tags = rows.map((r) => String(r[tagKey] ?? '')).filter(Boolean)
    if (!viewer || !tags.length || !viewerHasModel(viewer)) return
    const token = ++ctxRef.current.awpToken
    ctxRef.current.awpActive = false
    setMessage('Aislando elementos filtrados…')
    const dbIds = await findDbIds(tags)
    if (token !== ctxRef.current.awpToken || !viewerRef.current) return
    if (!dbIds.length) { setMessage('No se encontraron en el modelo los elementos filtrados (revisa el campo de vínculo).'); return }
    ctxRef.current.filterActive = true
    ctxRef.current.hlIds = [] // clearThemingColors (abajo) ya borra el realce de fila
    safe(() => {
      viewer.setGhosting(true)
      viewer.clearThemingColors()
      viewer.isolate(dbIds)
      viewer.fitToView(dbIds)
    })
    setMessage('')
  }

  function clearIsolation() {
    const viewer = viewerRef.current
    if (!viewer) return
    ctxRef.current.awpActive = false
    ctxRef.current.filterActive = false
    ctxRef.current.hlIds = [] // clearThemingColors (abajo) ya borra el realce de fila
    ctxRef.current.awpToken = (ctxRef.current.awpToken || 0) + 1 // invalida searches en curso
    if (!viewerHasModel(viewer)) return // sin modelo no hay nada que limpiar (y el SDK tiraría)
    safe(() => {
      viewer.clearThemingColors()
      viewer.isolate([])
      viewer.showAll?.()
    })
  }

  // Columna CWP de la planilla (la que escribe "Conectar a AWP").
  const cwpCol = useMemo(() => headers.find((h) => /cwp/i.test(h)), [headers.join('|')])

  // Colorea TODO el modelo por CWP: cada CWP distinto recibe un color de la
  // paleta y sus componentes (matcheados por TAG) se pintan con setThemingColor.
  // Los componentes sin CWP quedan sin teñir. Arma la leyenda CWP→color.
  async function colorModelByCwp() {
    const viewer = viewerRef.current
    if (!viewer || !viewerHasModel(viewer)) return
    if (!cwpCol) { setMessage('La planilla no tiene columna CWP.'); return }
    // Agrupa los TAGs por valor de CWP.
    const groups = new Map()
    rows.forEach((r) => {
      const v = String(r[cwpCol] ?? '').trim()
      const t = String(r[tagKey] ?? '')
      if (!v || !t) return
      if (!groups.has(v)) groups.set(v, [])
      groups.get(v).push(t)
    })
    const token = ++ctxRef.current.awpToken
    ctxRef.current.colorActive = true
    setMessage('Coloreando por CWP…')
    safe(() => { viewer.setGhosting(false); viewer.showAll?.(); viewer.clearThemingColors() })
    const legend = []
    let i = 0
    for (const [cwp, tags] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'))) {
      const hex = CWP_PALETTE[i++ % CWP_PALETTE.length]
      const vec = hexToVec4(hex)
      const dbIds = await findDbIds(tags)
      if (token !== ctxRef.current.awpToken || !viewerRef.current) return // se canceló
      if (vec) safe(() => dbIds.forEach((id) => viewer.setThemingColor(id, vec)))
      legend.push({ cwp, hex, count: tags.length, found: dbIds.length })
    }
    setCwpLegend(legend)
    setMessage('')
  }

  function clearCwpColors() {
    const viewer = viewerRef.current
    ctxRef.current.colorActive = false
    ctxRef.current.awpToken = (ctxRef.current.awpToken || 0) + 1
    setCwpLegend([])
    if (viewer && viewerHasModel(viewer)) safe(() => viewer.clearThemingColors())
  }

  // Columna de avance (ESTADO_AVANCE) de la planilla.
  const avanceCol = useMemo(() => headers.find((h) => /AVANCE/i.test(h)), [headers.join('|')])

  // Mapa de calor de avance: pinta cada componente según su estado E1→E4
  // (rojo → ámbar → verde). Los componentes sin estado quedan grises. Agrupa por
  // valor de estado para hacer una sola búsqueda por estado (rápido).
  async function colorModelByAvance() {
    const viewer = viewerRef.current
    if (!viewer || !viewerHasModel(viewer)) return
    if (!avanceCol) { setMessage('La planilla no tiene columna de avance (ESTADO_AVANCE).'); return }
    const groups = new Map() // estado -> tags
    rows.forEach((r) => {
      const t = String(r[tagKey] ?? '')
      if (!t) return
      const v = String(r[avanceCol] ?? '').trim() || '—'
      if (!groups.has(v)) groups.set(v, [])
      groups.get(v).push(t)
    })
    const token = ++ctxRef.current.awpToken
    ctxRef.current.colorActive = true
    setMessage('Coloreando por avance…')
    safe(() => { viewer.setGhosting(false); viewer.showAll?.(); viewer.clearThemingColors() })
    const GRAY = window.THREE ? new window.THREE.Vector4(0.8, 0.84, 0.88, 1) : null
    for (const [state, tags] of groups) {
      const w = avanceWeight(state)
      const vec = w == null ? GRAY : heatVec(w)
      const dbIds = await findDbIds(tags)
      if (token !== ctxRef.current.awpToken || !viewerRef.current) return
      if (vec) safe(() => dbIds.forEach((id) => viewer.setThemingColor(id, vec)))
    }
    setCwpLegend([]) // el avance usa una escala fija (gradiente), no leyenda por ítem
    setMessage('')
  }

  // Exportar imagen 16:9 del estado actual.
  function exportImage16x9() {
    const viewer = viewerRef.current
    if (!viewer) return
    const w = 1920, h = 1080
    viewer.getScreenshot(w, h, (blob) => {
      const url = typeof blob === 'string' ? blob : URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(awpSel[0] || 'vista').replace(/\W+/g, '_')}_16x9.png`
      a.click()
      if (typeof blob !== 'string') URL.revokeObjectURL(url)
    })
  }

  // Quita el realce de theming de la fila previamente vinculada. Como el visor
  // no permite limpiar el color de un solo dbId, se distingue por modo:
  //   - En modo paquete AWP las piezas siguen perteneciendo al paquete → se las
  //     devuelve al naranja del paquete (no se limpia todo el theming, que
  //     borraría el aislado naranja).
  //   - En modo normal/filtrado el ÚNICO theming activo es este realce → se
  //     limpia todo de una.
  function clearRowHighlight() {
    const viewer = viewerRef.current
    const prev = ctxRef.current.hlIds || []
    ctxRef.current.hlIds = []
    if (!viewer || !prev.length || !viewerHasModel(viewer)) return
    if (ctxRef.current.awpActive && window.THREE) {
      const ORANGE = new window.THREE.Vector4(0.97, 0.44, 0, 1)
      safe(() => prev.forEach((id) => viewer.setThemingColor(id, ORANGE)))
    } else {
      safe(() => viewer.clearThemingColors())
    }
  }

  // cross-selection planilla → 3D: al activar una fila, RESALTA y enfoca ese
  // elemento dentro del modelo SIN ocultar el resto, para no perder el contexto
  // del conjunto. Antes se hacía isolate(), que dejaba el modelo "en negro" salvo
  // la pieza y desorientaba; ahora solo se resalta la pieza en su sitio, con:
  //   - selección nativa (naranja de marca), y
  //   - un realce persistente por theming en CIAN (distinto del naranja del
  //     aislado por paquete) para que destaque en modelos densos aunque la pieza
  //     pierda el foco de selección nativo.
  //   - Si hay un aislado activo (paquete AWP o planilla filtrada) se conserva su
  //     encuadre: se resalta la pieza sin volar la cámara (no pisa el aislado).
  //   - Si no hay aislado, además se vuela la cámara a la pieza para ubicarla.
  //   - Sin TAG activo (se deselecciona la fila) se limpia selección y realce.
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || status !== 'ready' || !viewerHasModel(viewer)) return
    if (!selectedTag) {
      if (ctxRef.current.lastTag != null) {
        ctxRef.current.lastTag = null
        clearRowHighlight()
        safe(() => viewer.clearSelection?.())
      }
      return
    }
    if (ctxRef.current.lastTag === selectedTag) return
    ctxRef.current.lastTag = selectedTag
    // Token: si el usuario salta de fila mientras el search asíncrono está en
    // curso, descarta el resultado viejo para no resaltar la pieza equivocada.
    const token = ctxRef.current.selToken = (ctxRef.current.selToken || 0) + 1
    findDbIds([selectedTag]).then((ids) => {
      if (token !== ctxRef.current.selToken || !viewerRef.current) return
      clearRowHighlight() // quita el realce de la fila anterior
      if (!ids.length) { safe(() => viewer.clearSelection?.()); return }
      const keepFraming = ctxRef.current.awpActive || ctxRef.current.filterActive
      const HL = window.THREE ? new window.THREE.Vector4(0.0, 0.78, 1.0, 1) : null // cian de realce
      safe(() => {
        viewer.select(ids)                                      // resaltado nativo (naranja de marca)
        if (HL) ids.forEach((id) => viewer.setThemingColor(id, HL)) // realce persistente cian
        if (!keepFraming) viewer.fitToView(ids)                 // vuela a la pieza solo si no hay aislado activo
      })
      ctxRef.current.hlIds = ids
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTag, status])

  // Aislamiento automático del 3D, por prioridad:
  //   1) paquete AWP elegido en el visor  → aísla el paquete (naranja)
  //   2) planilla filtrada (sin paquete)   → aísla los elementos filtrados
  //   3) sin filtro ni paquete             → muestra todo
  // No corre con un modo de color activo (ese modo tiñe todo el modelo y manda).
  useEffect(() => {
    if (status !== 'ready' || colorMode !== 'none') return
    if (awpSel.length) isolatePackage()
    else if (isFiltered) isolateFilteredRows()
    else clearIsolation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awpSel, isFiltered, rows, status, colorMode])

  // Colorear por CWP o por avance: pinta/limpia el modelo cuando cambia el modo o
  // las filas (reasignaciones/cambios de estado) estando activo.
  useEffect(() => {
    if (status !== 'ready') return
    if (colorMode === 'cwp') colorModelByCwp()
    else if (colorMode === 'avance') colorModelByAvance()
    else clearCwpColors()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorMode, rows, status])

  const busy = ['loadingSdk', 'uploading', 'translating'].includes(status)
  const ready = status === 'ready'

  // Estilos compartidos para una apariencia de visor profesional.
  const glass = 'rounded-xl border border-white/60 bg-white/80 shadow-lg ring-1 ring-black/5 backdrop-blur-md dark:border-white/10 dark:bg-ink-800/80 dark:ring-white/5'

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={mountRef} className="absolute inset-0" />

      {/* Barra superior: subir modelo + filtro AWP + exportar */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-wrap items-start justify-between gap-2">
        <div className="pointer-events-auto flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".nwd,.nwc,.rvt,.ifc,.dwg,.dwfx,.3ds,.obj,.glb,.gltf,.fbx,.step,.stp,.iam,.ipt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = '' }} />
          <button onClick={() => fileRef.current?.click()} disabled={busy} className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:text-brand-600 disabled:opacity-60 dark:text-slate-200 dark:hover:text-accent ${glass}`}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {urn ? 'Cambiar modelo' : 'Subir modelo (NWD/RVT/IFC…)'}
          </button>

          {projects.length > 0 && (
            <div className="relative">
              <button onClick={() => { setShowProjects((v) => !v); if (!showProjects) refreshProjects() }} title="Modelos 3D guardados" className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:text-brand-600 dark:text-slate-200 dark:hover:text-accent ${glass}`}>
                <FolderOpen className="h-3.5 w-3.5" /> Modelos
                <span className="rounded bg-brand-100 px-1 text-[10px] text-brand-700 dark:bg-accent/20 dark:text-accent">{projects.length}</span>
              </button>
              {showProjects && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowProjects(false)} />
                  <div className={`absolute left-0 top-11 z-20 w-64 overflow-hidden p-1 ${glass}`}>
                    <p className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Modelos guardados {loadingProjects && <Loader2 className="h-3 w-3 animate-spin" />}
                    </p>
                    <div className="max-h-72 overflow-y-auto">
                      {projects.map((p) => {
                        const nver = p.versions?.length || 1
                        return (
                        <div key={p.id || p.urn} className="group flex items-center gap-1 rounded-md px-1 hover:bg-slate-100 dark:hover:bg-white/5">
                          <button onClick={() => openProject(p)} className="min-w-0 flex-1 py-1.5 pl-1.5 text-left">
                            <span className="block truncate text-xs font-medium text-slate-700 dark:text-slate-200" title={p.name}>{p.name}</span>
                            <span className="block text-[10px] text-slate-400">
                              {nver > 1 && <span className="text-brand-600 dark:text-accent">v{nver} · </span>}
                              {p.savedAt ? new Date(p.savedAt).toLocaleDateString('es-CL') : (p.remote ? 'En la nube (APS)' : '')}
                            </span>
                          </button>
                          {nver > 1 && (
                            <select
                              value=""
                              onChange={(e) => openVersion(p, e.target.value)}
                              title="Abrir una versión anterior"
                              className="shrink-0 rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px] text-slate-500 dark:border-white/10 dark:bg-ink-900 dark:text-slate-300"
                            >
                              <option value="">Versiones</option>
                              {p.versions.map((v) => (
                                <option key={v.urn} value={v.urn}>v{v.n} · {v.ts ? new Date(v.ts).toLocaleDateString('es-CL') : '—'}</option>
                              ))}
                            </select>
                          )}
                          <button onClick={() => deleteProject(p)} title="Eliminar modelo (todas las versiones)" className="shrink-0 p-1.5 text-slate-300 opacity-0 transition hover:text-rose-500 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          {urn && modelName && (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-2 text-xs text-slate-600 dark:text-slate-300 ${glass}`}>
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="max-w-[140px] truncate font-medium" title={modelName}>{modelName}</span>
              <button onClick={forgetModel} title="Quitar modelo" className="text-slate-400 hover:text-rose-500"><X className="h-3 w-3" /></button>
            </span>
          )}
        </div>

        {ready && urn && (
          <div className={`pointer-events-auto flex flex-wrap items-center gap-1.5 p-1.5 ${glass}`}>
            <Layers className="ml-1 h-4 w-4 text-brand-500" />
            <select value={awpField} onChange={(e) => setAwpField(e.target.value)} title="Tipo de paquete de trabajo" className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700 dark:border-white/10 dark:bg-ink-900 dark:text-slate-200">
              {(awpFields.length ? awpFields : headers).map((h) => <option key={h} value={h}>{h.replace(/_/g, ' ')}</option>)}
            </select>

            {/* Selector AWP multi-valor con buscador y conteo */}
            <div className="relative">
              <button
                onClick={() => setAwpOpen((v) => !v)}
                className={['inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition', awpSel.length ? 'border-brand-400 bg-brand-50 text-brand-700 dark:border-accent/40 dark:bg-accent/10 dark:text-accent' : 'border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-300'].join(' ')}
              >
                {awpSel.length ? `${awpSel.length} paquete(s)` : '— Ver todo —'}
                <ChevronDown className="h-3 w-3" />
              </button>
              {awpOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setAwpOpen(false)} />
                  <div className="absolute left-0 top-9 z-20 w-60 rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-white/10 dark:bg-ink-800">
                    <div className="mb-2 flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1 dark:border-white/10">
                      <Search className="h-3.5 w-3.5 text-slate-400" />
                      <input value={awpQuery} onChange={(e) => setAwpQuery(e.target.value)} placeholder="Buscar paquete…" className="w-full bg-transparent text-xs focus:outline-none dark:text-slate-200" />
                    </div>
                    <div className="max-h-56 space-y-0.5 overflow-y-auto">
                      {awpValues
                        .filter(([v]) => !awpQuery || v.toLowerCase().includes(awpQuery.toLowerCase()))
                        .map(([v, count]) => (
                          <label key={v} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-slate-100 dark:hover:bg-white/5">
                            <input
                              type="checkbox"
                              checked={awpSel.includes(v)}
                              onChange={() => setAwpSel((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]))}
                              className="h-3.5 w-3.5 accent-brand-500 dark:accent-accent"
                            />
                            <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200" title={v}>{v}</span>
                            <span className="shrink-0 text-[10px] text-slate-400">{count}</span>
                          </label>
                        ))}
                    </div>
                    <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 dark:border-white/10">
                      <button onClick={() => setAwpSel([])} className="text-[11px] font-medium text-slate-400 hover:text-rose-500">Ver todo</button>
                      <button onClick={() => setAwpOpen(false)} className="text-[11px] font-medium text-brand-600 dark:text-accent">Listo</button>
                    </div>
                  </div>
                </>
              )}
            </div>
            {cwpCol && (
              <button
                onClick={() => setColorMode((m) => (m === 'cwp' ? 'none' : 'cwp'))}
                title="Colorear el modelo por CWP: cada paquete con un color distinto"
                className={['inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition', colorMode === 'cwp' ? 'bg-brand-500 text-white hover:bg-brand-600 dark:bg-accent dark:text-ink-900' : 'border border-slate-200 text-slate-600 hover:text-brand-600 dark:border-white/10 dark:text-slate-300'].join(' ')}
              >
                <Layers className="h-3.5 w-3.5" /> Por CWP
              </button>
            )}
            {avanceCol && (
              <button
                onClick={() => setColorMode((m) => (m === 'avance' ? 'none' : 'avance'))}
                title="Mapa de calor de avance: rojo (E1) → ámbar → verde (E4)"
                className={['inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition', colorMode === 'avance' ? 'bg-brand-500 text-white hover:bg-brand-600 dark:bg-accent dark:text-ink-900' : 'border border-slate-200 text-slate-600 hover:text-brand-600 dark:border-white/10 dark:text-slate-300'].join(' ')}
              >
                <Gauge className="h-3.5 w-3.5" /> Por avance
              </button>
            )}
            <button
              onClick={toggleArea}
              title="Selección por área: arrastra un rectángulo sobre el modelo para seleccionar varios elementos (incluidos los pequeños)"
              className={['inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition', areaMode ? 'bg-brand-500 text-white hover:bg-brand-600 dark:bg-accent dark:text-ink-900' : 'border border-slate-200 text-slate-600 hover:text-brand-600 dark:border-white/10 dark:text-slate-300'].join(' ')}
            >
              <BoxSelect className="h-3.5 w-3.5" /> Área
            </button>
            <button
              onClick={editActiveSet}
              title={awpSel.length ? 'Editar en masa todos los elementos del paquete seleccionado' : isFiltered ? 'Editar en masa todos los elementos filtrados en la planilla' : 'Editar en masa todos los elementos del modelo'}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:text-brand-600 dark:border-white/10 dark:text-slate-300"
            >
              <ListChecks className="h-3.5 w-3.5" /> Editar {awpSel.length && packageTags.length ? `paquete` : isFiltered ? `filtrados` : 'todos'}
            </button>
            <button
              onClick={() => setHq((v) => !v)}
              title={hq ? 'Calidad alta (sombras, AO, bordes) — clic para priorizar rendimiento' : 'Modo rendimiento — clic para alta calidad'}
              className={['inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition', hq ? 'bg-brand-500 text-white hover:bg-brand-600 dark:bg-accent dark:text-ink-900' : 'border border-slate-200 text-slate-600 hover:text-brand-600 dark:border-white/10 dark:text-slate-300'].join(' ')}
            >
              <Sparkles className="h-3.5 w-3.5" /> {hq ? 'HD' : 'Rápido'}
            </button>
            <button onClick={exportImage16x9} title="Exportar imagen 16:9" className="inline-flex items-center gap-1 rounded-md bg-brand-500 px-2 py-1 text-xs font-semibold text-white transition hover:bg-brand-600 dark:bg-accent dark:text-ink-900">
              <Camera className="h-3.5 w-3.5" /> 16:9
            </button>
          </div>
        )}
      </div>

      {/* Leyenda: color por CWP */}
      {ready && colorMode === 'cwp' && cwpLegend.length > 0 && (
        <div className={`absolute right-3 top-16 z-10 max-h-[55%] w-56 overflow-y-auto p-2 ${glass}`}>
          <p className="mb-1.5 px-1 text-[11px] font-bold text-slate-700 dark:text-white">Color por CWP · {cwpLegend.length}</p>
          {cwpLegend.map((l) => (
            <div key={l.cwp} className="flex items-center gap-2 rounded px-1.5 py-1 text-[11px]">
              <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: l.hex }} />
              <span className="min-w-0 flex-1 truncate font-mono text-slate-700 dark:text-slate-200" title={l.cwp}>{l.cwp}</span>
              <span className="shrink-0 tabular-nums text-slate-400" title={`${l.found} encontrados en el modelo`}>{l.count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Leyenda: mapa de calor de avance (escala fija) */}
      {ready && colorMode === 'avance' && (
        <div className={`absolute right-3 top-16 z-10 w-56 p-2.5 ${glass}`}>
          <p className="mb-1.5 px-1 text-[11px] font-bold text-slate-700 dark:text-white">Avance</p>
          <div className="h-2.5 w-full rounded-full" style={{ background: 'linear-gradient(to right, #dc2626, #f59e0b, #16a34a)' }} />
          <div className="mt-1 flex justify-between px-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">
            <span>E1</span><span>E2</span><span>E3</span><span>E4</span>
          </div>
          <p className="mt-1.5 px-0.5 text-[10px] text-slate-400">Gris = sin estado</p>
        </div>
      )}

      {/* Listado de componentes del/los paquete(s) */}
      {ready && colorMode === 'none' && awpSel.length > 0 && packageTags.length > 0 && (
        <div className={`absolute right-3 top-16 z-10 max-h-[45%] w-56 overflow-y-auto p-2 ${glass}`}>
          <p className="mb-1 px-1 text-[11px] font-bold text-slate-700 dark:text-white">{awpSel.length === 1 ? awpSel[0] : `${awpSel.length} paquetes`} · {packageTags.length} comp.</p>
          {packageTags.map((t) => (
            <button key={t} onClick={() => onSelect?.(t)} className="block w-full truncate rounded px-1.5 py-1 text-left font-mono text-[11px] text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5">{t}</button>
          ))}
        </div>
      )}

      {/* Panel de edición múltiple (Ctrl/Cmd+clic, arrastre por área o por filtro) */}
      {ready && activeBulk && showProps && (
        <div className={`absolute bottom-3 left-3 z-10 flex max-h-[55%] w-72 flex-col overflow-hidden ${glass}`}>
          <div className="flex items-start justify-between gap-2 border-b border-slate-200 px-3 py-2 dark:border-white/10">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-500">Edición múltiple{bulkSet?.label ? ` · ${bulkSet.label}` : ''}</p>
              <p className="text-sm font-bold text-slate-800 dark:text-white">{activeBulk.ids.length} elemento{activeBulk.ids.length === 1 ? '' : 's'} de la planilla</p>
            </div>
            <button onClick={closeBulk} className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="h-4 w-4" /></button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
            {activeBulk.ids.length === 0 ? (
              <p className="rounded-lg bg-slate-50 px-2 py-2 text-[10px] text-slate-400 dark:bg-white/5">Ninguno de los elementos coincide con la planilla (TAG).</p>
            ) : (
              <>
                <label className="block">
                  <span className="mb-0.5 block text-[9px] font-semibold uppercase tracking-wider text-slate-400">Campo a cambiar</span>
                  <select value={bulkField} onChange={(e) => setBulkField(e.target.value)} className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 focus:border-brand-400 focus:outline-none dark:border-white/10 dark:bg-ink-900 dark:text-slate-100">
                    <option value="">— Elegir campo —</option>
                    {headers.map((h) => <option key={h} value={h}>{h.replace(/_/g, ' ')}</option>)}
                  </select>
                </label>
                <label className="mt-2 block">
                  <span className="mb-0.5 block text-[9px] font-semibold uppercase tracking-wider text-slate-400">Nuevo valor (igual para todos)</span>
                  <input
                    value={bulkValue}
                    onChange={(e) => setBulkValue(e.target.value)}
                    onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') saveBulk() }}
                    className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 focus:border-brand-400 focus:outline-none dark:border-white/10 dark:bg-ink-900 dark:text-slate-100"
                  />
                </label>
                <button onClick={saveBulk} disabled={!bulkField} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-brand-500 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50 dark:bg-accent dark:text-ink-900">
                  {bulkSaved ? <><Check className="h-3.5 w-3.5" /> Aplicado</> : <><Save className="h-3.5 w-3.5" /> Aplicar a {activeBulk.ids.length}</>}
                </button>
                {onConnectAwp && (
                  <button onClick={() => setShowConnectAwp(true)} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-brand-300 bg-brand-50/50 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100 dark:border-accent/40 dark:bg-accent/10 dark:text-accent">
                    <Link2 className="h-3.5 w-3.5" /> Conectar a AWP
                  </button>
                )}
                <p className="mt-2 mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Elementos</p>
                <div className="flex flex-wrap gap-1">
                  {activeBulk.tags.slice(0, 80).map((t, i) => (
                    <span key={i} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-white/5 dark:text-slate-300">{t}</span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal: conectar a un CWA/CWP los elementos seleccionados en el modelo
          (selección múltiple) o el único objeto vinculado a una fila. */}
      {showConnectAwp && (() => {
        const ids = activeBulk?.ids?.length ? activeBulk.ids : (linkRow ? [linkRow.id] : [])
        return (
          <ConnectAwpModal
            cwps={awpCwps}
            count={ids.length}
            onImport={onImportCwps}
            onConnect={(cwp) => { onConnectAwp?.(ids, cwp); setShowConnectAwp(false) }}
            onClose={() => setShowConnectAwp(false)}
          />
        )
      })()}

      {/* Panel de propiedades del objeto pinchado */}
      {ready && objProps && showProps && (
        <div className={`absolute bottom-3 left-3 z-10 flex max-h-[55%] w-72 flex-col overflow-hidden ${glass}`}>
          <div className="flex items-start justify-between gap-2 border-b border-slate-200 px-3 py-2 dark:border-white/10">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-500">Propiedades del objeto</p>
              <p className="truncate text-sm font-bold text-slate-800 dark:text-white" title={objProps.name}>{objProps.name}</p>
            </div>
            <button onClick={() => setShowProps(false)} className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="h-4 w-4" /></button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
            {/* Datos de ingeniería (planilla), editables y vinculados por TAG */}
            {draft ? (
              <div className="mb-3 rounded-lg border border-brand-200 bg-brand-50/60 p-2 dark:border-accent/20 dark:bg-accent/5">
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-accent">Datos de ingeniería</p>
                <div className="space-y-1.5">
                  {headers.map((h) => (
                    <label key={h} className="block">
                      <span className="mb-0.5 block text-[9px] font-semibold uppercase tracking-wider text-slate-400">{h.replace(/_/g, ' ')}</span>
                      <input
                        value={draft[h] ?? ''}
                        onChange={(e) => setDraft((d) => ({ ...d, [h]: e.target.value }))}
                        onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') saveLinked() }}
                        className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 focus:border-brand-400 focus:outline-none dark:border-white/10 dark:bg-ink-900 dark:text-slate-100"
                      />
                    </label>
                  ))}
                </div>
                <button onClick={saveLinked} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-brand-500 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-600 dark:bg-accent dark:text-ink-900">
                  {savedField ? <><Check className="h-3.5 w-3.5" /> Guardado</> : <><Save className="h-3.5 w-3.5" /> Guardar en planilla</>}
                </button>
                {onConnectAwp && linkRow && (
                  <button onClick={() => setShowConnectAwp(true)} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-brand-300 bg-white py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-50 dark:border-accent/40 dark:bg-ink-900 dark:text-accent dark:hover:bg-accent/10">
                    <Link2 className="h-3.5 w-3.5" /> Conectar a AWP
                  </button>
                )}
              </div>
            ) : (
              (() => {
                // Sin match en la planilla activa: buscar el TAG en TODAS las
                // planillas y sugerir en cuál está (evita el "no coincide" a secas).
                const elsewhere = objProps.tag && findTagAcross ? findTagAcross(objProps.tag) : null
                if (elsewhere) return (
                  <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] dark:border-amber-500/30 dark:bg-amber-500/10">
                    <p className="text-amber-800 dark:text-amber-300">El TAG <span className="font-mono font-semibold">{objProps.tag}</span> está en la planilla <b>{elsewhere.planilla}</b>, no en esta.</p>
                    {onOpenSubcategory && (
                      <button onClick={() => onOpenSubcategory(elsewhere.subId)} className="mt-1 font-semibold text-amber-700 hover:underline dark:text-amber-300">Abrir “{elsewhere.planilla}” →</button>
                    )}
                  </div>
                )
                return <p className="mb-3 rounded-lg bg-slate-50 px-2 py-1.5 text-[10px] text-slate-400 dark:bg-white/5">{objProps.tag ? `El TAG “${objProps.tag}” no está en ninguna planilla cargada.` : 'Este objeto no tiene un TAG vinculable a las planillas.'}</p>
              })()
            )}
            {objProps.groups.length > 0 && <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Propiedades del modelo (solo lectura)</p>}
            {objProps.groups.length === 0 && <p className="py-3 text-center text-xs text-slate-400">Este objeto no tiene propiedades.</p>}
            {objProps.groups.map((g) => (
              <div key={g.category} className="mb-3">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{g.category}</p>
                <dl className="space-y-0.5">
                  {g.items.map((it, i) => (
                    <div key={i} className="flex items-baseline justify-between gap-2 text-xs">
                      <dt className="shrink-0 text-slate-500 dark:text-slate-400" title={it.name}>{it.name}</dt>
                      <dd className="min-w-0 truncate text-right font-medium text-slate-700 dark:text-slate-200" title={`${it.value} ${it.units}`}>{it.value}{it.units ? ` ${it.units}` : ''}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </div>
      )}
      {ready && (objProps || activeBulk) && !showProps && (
        <button onClick={() => setShowProps(true)} className="absolute bottom-3 left-3 z-10 rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow backdrop-blur transition hover:text-brand-600 dark:border-white/10 dark:bg-ink-800/90 dark:text-slate-200">
          {activeBulk ? `Ver edición múltiple (${activeBulk.ids.length})` : 'Ver propiedades'}
        </button>
      )}

      {/* Estado / errores */}
      {(busy || status === 'error' || message) && (
        <div className={['absolute left-1/2 top-14 z-10 max-w-md -translate-x-1/2 px-3 py-2 text-xs font-medium', status === 'error' ? 'rounded-xl bg-rose-500/90 text-white shadow-lg' : `text-slate-700 dark:text-slate-200 ${glass}`].join(' ')}>
          <span className="inline-flex items-center gap-1.5">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {message || (status === 'loadingSdk' ? 'Cargando visor de Autodesk…' : '')}
            {status === 'error' && <button onClick={() => { setStatus('ready'); setMessage('') }} className="ml-1"><X className="h-3 w-3" /></button>}
          </span>
        </div>
      )}

      {ready && !urn && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className={`pointer-events-auto max-w-sm p-6 text-center ${glass}`}>
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-glow">
              <Layers className="h-7 w-7" />
            </div>
            <p className="text-base font-bold text-slate-800 dark:text-white">Visor de modelos reales (APS)</p>
            <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-slate-500 dark:text-slate-400">Sube un modelo de Navisworks/Revit/IFC. Luego podrás aislar por CWA/CWP/IWP/SWP (resto en blanco translúcido), ver propiedades y exportar la imagen en 16:9.</p>
            <button onClick={() => fileRef.current?.click()} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-600 dark:bg-accent dark:text-ink-900">
              <Upload className="h-4 w-4" /> Subir modelo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// memo: evita re-renders del visor por cambios del padre que no afectan al 3D.
export default memo(ApsViewer)
