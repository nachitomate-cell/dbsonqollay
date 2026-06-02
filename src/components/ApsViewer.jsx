import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Camera, ChevronDown, FolderOpen, Layers, Loader2, Search, Sparkles, Trash2, Upload, X } from 'lucide-react'
import { addProject, deleteProjectRemote, fetchAllProjects, listProjects } from '../utils/apsProjects.js'
import { getApsViewer } from './apsViewerSingleton.js'

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
  (import.meta.env.DEV ? 'http://localhost:3000' : '')

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
function frameModel(viewer) {
  let tries = 0
  const fit = () => {
    if (!viewer || !viewer.model) return
    try {
      viewer.resize()
      // fitToView(ids, model, immediate=true) encuadra todo el modelo sin animar.
      viewer.fitToView(null, viewer.model, true)
    } catch { /* el visor aún no está listo; lo intenta el próximo tick */ }
    if (++tries < 6) setTimeout(fit, 250)
  }
  // Primer intento en el siguiente frame (deja que el canvas tome su tamaño).
  requestAnimationFrame(fit)
}

function ApsViewer({ rows = [], headers = [], selectedTag, onSelect, dataKey = 'default', isFiltered = false }) {
  const mountRef = useRef(null)
  const viewerRef = useRef(null)
  const fileRef = useRef(null)
  const ctxRef = useRef({}) // estado interno persistente (initStarted, urn cargado…)
  const [status, setStatus] = useState('idle') // idle|loadingSdk|uploading|translating|ready|error
  const [message, setMessage] = useState('')
  // El último modelo cargado se recuerda por subcategoría (localStorage), así
  // volver al 3D no obliga a re-subir ni re-traducir: el modelo sigue en
  // Autodesk y se reabre directo por su urn.
  const storeKey = `sqy-aps-model-${dataKey}`
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
  // Reabre un proyecto guardado (ya traducido) sin re-subir el archivo.
  function openProject(p) {
    setShowProjects(false)
    if (p.urn === ctxRef.current.loadedUrn) return // ya está abierto
    setUrn(p.urn); setModelName(p.name); rememberModel(p.urn, p.name)
    if (viewerRef.current) loadDocument(p.urn, { force: true })
  }
  function deleteProject(p) {
    deleteProjectRemote(p)
    setProjects((prev) => prev.filter((x) => x.urn !== p.urn))
  }
  function forgetModel() {
    try { localStorage.removeItem(storeKey) } catch { /* ignore */ }
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

  // Callback siempre fresco sin re-disparar efectos.
  const onSelectRef = useRef(onSelect)
  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])

  // ---- adopta el visor SINGLETON (un único contexto WebGL para toda la app) ----
  useEffect(() => {
    let cancelled = false
    setStatus('loadingSdk')
    getApsViewer(() =>
      fetch(`\${getAPI()}/api/aps/token`)
        .catch(() => { throw new Error(`No se pudo conectar al backend APS (\${getAPI()}). En el sitio publicado, configura VITE_APS_API con la URL del backend desplegado.`) })
        .then((r) => {
          if (!r.ok) throw new Error('Backend APS respondió con error. Revisa las credenciales del servidor.')
          return r.json()
        }),
    )
      .then(({ viewer, container }) => {
        if (cancelled) return
        viewerRef.current = viewer
        // Mueve el contenedor compartido del visor a este componente.
        mountRef.current?.appendChild(container)
        try { viewer.resize() } catch { /* noop */ }
        applyViewerStyle(viewer, hq)

        // Handlers propios de esta instancia (se quitan al desmontar).
        const onSel = (e) => {
          const id = e.dbIdArray?.[0]
          if (id == null) { setObjProps(null); return }
          viewer.getProperties(id, (props) => {
            onSelectRef.current?.(props.name || String(id))
            setObjProps({ name: props.name || `Objeto ${id}`, dbId: id, groups: groupProps(props.properties || []) })
          })
        }
        viewer.addEventListener(window.Autodesk.Viewing.SELECTION_CHANGED_EVENT, onSel)
        ctxRef.current.onSel = onSel

        const ro = new ResizeObserver(() => { try { viewer.resize() } catch { /* noop */ } })
        ro.observe(mountRef.current)
        ctxRef.current.resizeObs = ro
        const themeObs = new MutationObserver(() => applyViewerStyle(viewer, hq))
        themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
        ctxRef.current.themeObs = themeObs

        // Carga el modelo de esta subcategoría (si difiere del ya cargado).
        if (urn) loadDocument(urn, { force: ctxRef.current.loadedUrn !== urn })
        else setStatus('ready')
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
      if (cont && cont.parentNode) { try { cont.parentNode.removeChild(cont) } catch { /* noop */ } }
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
        if (!node) {
          ctxRef.current.loadingUrn = null
          setStatus('error'); setMessage('El modelo no tiene una vista 3D para mostrar.')
          return
        }
        const onGeom = () => {
          viewer.removeEventListener(window.Autodesk.Viewing.GEOMETRY_LOADED_EVENT, onGeom)
          ctxRef.current.loadingUrn = null
          ctxRef.current.loadedUrn = theUrn
          applyViewerStyle(viewer, hq)
          frameModel(viewer)
          setStatus('ready'); setMessage('')
          // Si llegó un pedido de cargar otro modelo mientras tanto, atiéndelo.
          const next = ctxRef.current.pendingUrn
          if (next && next !== theUrn) { ctxRef.current.pendingUrn = null; loadDocument(next) }
          else ctxRef.current.pendingUrn = null
        }
        viewer.addEventListener(window.Autodesk.Viewing.GEOMETRY_LOADED_EVENT, onGeom)
        viewer.loadDocumentNode(doc, node).catch(() => {
          ctxRef.current.loadingUrn = null
          setStatus('error'); setMessage('No se pudo cargar la vista del modelo.')
        })
      },
      (code) => {
        ctxRef.current.loadingUrn = null
        if (code === 9 || code === window.Autodesk.Viewing.ErrorCodes?.NETWORK_FAILED) {
          setMessage('El modelo aún se está traduciendo… reintentando en 8 s.')
          setTimeout(() => loadDocument(theUrn), 8000)
        } else { setStatus('error'); setMessage(`No se pudo abrir el modelo (código ${code}).`) }
      },
    )
  }

  async function handleUpload(file) {
    try {
      setStatus('uploading'); setMessage('Preparando subida…')
      const connErr = () => { throw new Error(`No se pudo conectar al backend APS. Verifica el despliegue (VITE_APS_API o las funciones /api).`) }

      // 1) Pedir URL firmada al backend (paquete pequeño, no el archivo).
      const { objectKey, uploadKey, urls } = await fetch(`\${getAPI()}/api/aps/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name }),
      }).catch(connErr).then((r) => {
        if (!r.ok) return r.json().then((j) => { throw new Error(j.error || 'No se pudo iniciar la subida.') })
        return r.json()
      })

      // 2) Subir el binario DIRECTO a Autodesk (S3), sin pasar por el backend
      //    (evita el límite de tamaño de las funciones serverless).
      setMessage('Subiendo modelo a Autodesk…')
      const put = await fetch(urls[0], { method: 'PUT', body: file }).catch(connErr)
      if (!put.ok) throw new Error('Falló la subida del archivo a Autodesk.')

      // 3) Confirmar y lanzar la traducción.
      setMessage('Procesando modelo…')
      const { urn: newUrn } = await fetch(`\${getAPI()}/api/aps/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectKey, uploadKey }),
      }).catch(connErr).then((r) => {
        if (!r.ok) return r.json().then((j) => { throw new Error(j.error || 'No se pudo procesar el modelo.') })
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
        const s = await fetch(`\${getAPI()}/api/aps/status/${theUrn}`).then((r) => r.json())
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
      viewer.search(String(text), (ids) => resolve(ids || []), () => resolve([]))
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
  async function findDbIds(values) {
    const viewer = viewerRef.current
    if (!viewer || !values.length) return []
    const all = new Set()
    // Para cada valor, intenta sus variantes y se queda con la PRIMERA que matchea
    // (evita falsos positivos de variantes demasiado cortas si la exacta ya sirvió).
    await Promise.all(values.map(async (v) => {
      for (const variant of tagVariants(v)) {
        const ids = await searchOne(viewer, variant)
        if (ids.length) { ids.forEach((id) => all.add(id)); break }
      }
    }))
    return [...all]
  }

  // Comportamiento de la lámina: aislar el paquete, resto en blanco + 75% transp.
  // Un "token" evita que un search asíncrono viejo pise un filtro más nuevo.
  async function isolatePackage() {
    const viewer = viewerRef.current
    if (!viewer || !packageTags.length) return
    const token = ++ctxRef.current.awpToken
    ctxRef.current.filterActive = false // el paquete AWP tiene prioridad sobre el filtro de planilla
    setMessage('Aislando paquete…')
    const dbIds = await findDbIds(packageTags)
    // Si llegó tarde (cambió el filtro o se limpió), descartar este resultado.
    if (token !== ctxRef.current.awpToken || !viewerRef.current) return
    if (!dbIds.length) { setMessage('No se encontraron objetos del paquete en el modelo (revisa el campo de vínculo).'); return }

    ctxRef.current.awpActive = true
    // Ghosting nativo: el resto del modelo queda como "fantasma" gris tenue que
    // SÍ da contexto sobre cualquier fondo (no blanco invisible). `isolate`
    // mantiene el paquete a color pleno y atenúa lo demás.
    viewer.setGhosting(true)
    viewer.isolate(dbIds)
    // Resalta el paquete elegido en naranja de marca para que destaque.
    const ORANGE = new window.THREE.Vector4(0.97, 0.44, 0, 1)
    viewer.clearThemingColors()
    dbIds.forEach((id) => viewer.setThemingColor(id, ORANGE))
    viewer.fitToView(dbIds)
    setMessage('')
  }

  // Aísla en el 3D los elementos que están en la planilla filtrada (resto en
  // fantasma). Se dispara solo cuando hay un filtro de planilla activo y NO hay
  // un paquete AWP seleccionado (ese tiene prioridad).
  async function isolateFilteredRows() {
    const viewer = viewerRef.current
    const tags = rows.map((r) => String(r[tagKey] ?? '')).filter(Boolean)
    if (!viewer || !tags.length) return
    const token = ++ctxRef.current.awpToken
    ctxRef.current.awpActive = false
    setMessage('Aislando elementos filtrados…')
    const dbIds = await findDbIds(tags)
    if (token !== ctxRef.current.awpToken || !viewerRef.current) return
    if (!dbIds.length) { setMessage('No se encontraron en el modelo los elementos filtrados (revisa el campo de vínculo).'); return }
    ctxRef.current.filterActive = true
    viewer.setGhosting(true)
    viewer.clearThemingColors()
    viewer.isolate(dbIds)
    viewer.fitToView(dbIds)
    setMessage('')
  }

  function clearIsolation() {
    const viewer = viewerRef.current
    if (!viewer) return
    ctxRef.current.awpActive = false
    ctxRef.current.filterActive = false
    ctxRef.current.awpToken = (ctxRef.current.awpToken || 0) + 1 // invalida searches en curso
    viewer.clearThemingColors()
    viewer.isolate([])
    viewer.showAll?.()
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

  // cross-selection: enfocar el TAG activo de la planilla (solo si cambió).
  // No actúa si hay un filtro AWP activo, para no pisar el aislado del paquete.
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || !selectedTag || status !== 'ready') return
    // No pisa el aislado del paquete AWP ni el de la planilla filtrada.
    if (ctxRef.current.awpActive || ctxRef.current.filterActive) return
    if (ctxRef.current.lastTag === selectedTag) return
    ctxRef.current.lastTag = selectedTag
    findDbIds([selectedTag]).then((ids) => {
      if (ctxRef.current.awpActive || ctxRef.current.filterActive || !viewerRef.current) return
      if (ids.length) { viewer.isolate(ids); viewer.fitToView(ids) }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTag, status])

  // Aislamiento automático del 3D, por prioridad:
  //   1) paquete AWP elegido en el visor  → aísla el paquete (naranja)
  //   2) planilla filtrada (sin paquete)   → aísla los elementos filtrados
  //   3) sin filtro ni paquete             → muestra todo
  useEffect(() => {
    if (status !== 'ready') return
    if (awpSel.length) isolatePackage()
    else if (isFiltered) isolateFilteredRows()
    else clearIsolation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awpSel, isFiltered, rows, status])

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
              <button onClick={() => { setShowProjects((v) => !v); if (!showProjects) refreshProjects() }} title="Proyectos guardados" className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:text-brand-600 dark:text-slate-200 dark:hover:text-accent ${glass}`}>
                <FolderOpen className="h-3.5 w-3.5" /> Proyectos
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
                      {projects.map((p) => (
                        <div key={p.urn} className="group flex items-center gap-1 rounded-md px-1 hover:bg-slate-100 dark:hover:bg-white/5">
                          <button onClick={() => openProject(p)} className="min-w-0 flex-1 py-1.5 pl-1.5 text-left">
                            <span className="block truncate text-xs font-medium text-slate-700 dark:text-slate-200" title={p.name}>{p.name}</span>
                            <span className="block text-[10px] text-slate-400">{p.savedAt ? new Date(p.savedAt).toLocaleDateString('es-CL') : (p.remote ? 'En la nube (APS)' : '')}</span>
                          </button>
                          <button onClick={() => deleteProject(p)} title="Eliminar modelo del proyecto" className="shrink-0 p-1.5 text-slate-300 opacity-0 transition hover:text-rose-500 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      ))}
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

      {/* Listado de componentes del/los paquete(s) */}
      {ready && awpSel.length > 0 && packageTags.length > 0 && (
        <div className={`absolute right-3 top-16 z-10 max-h-[45%] w-56 overflow-y-auto p-2 ${glass}`}>
          <p className="mb-1 px-1 text-[11px] font-bold text-slate-700 dark:text-white">{awpSel.length === 1 ? awpSel[0] : `${awpSel.length} paquetes`} · {packageTags.length} comp.</p>
          {packageTags.map((t) => (
            <button key={t} onClick={() => onSelect?.(t)} className="block w-full truncate rounded px-1.5 py-1 text-left font-mono text-[11px] text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5">{t}</button>
          ))}
        </div>
      )}

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
      {ready && objProps && !showProps && (
        <button onClick={() => setShowProps(true)} className="absolute bottom-3 left-3 z-10 rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow backdrop-blur transition hover:text-brand-600 dark:border-white/10 dark:bg-ink-800/90 dark:text-slate-200">
          Ver propiedades
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
