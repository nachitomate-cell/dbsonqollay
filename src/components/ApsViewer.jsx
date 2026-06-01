import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Camera, FolderOpen, Layers, Loader2, Trash2, Upload, X } from 'lucide-react'
import { addProject, fetchAllProjects, listProjects, removeProject } from '../utils/apsProjects.js'

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
const API = import.meta.env.VITE_APS_API || 'http://localhost:3000'
const SDK_CSS = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css'
const SDK_JS = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js'

let sdkPromise = null
function loadSdk() {
  if (window.Autodesk?.Viewing) return Promise.resolve()
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise((resolve, reject) => {
    const css = document.createElement('link')
    css.rel = 'stylesheet'
    css.href = SDK_CSS
    document.head.appendChild(css)
    const js = document.createElement('script')
    js.src = SDK_JS
    js.onload = resolve
    js.onerror = () => reject(new Error('No se pudo cargar el SDK de APS (revisa tu conexión).'))
    document.head.appendChild(js)
  })
  return sdkPromise
}

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

// Estilo "profesional" del visor APS: fondo en degradé acorde al tema, alta
// calidad de render (AO + antialiasing), sombra de piso, iluminación neutra.
function applyViewerStyle(viewer) {
  try {
    const dark = document.documentElement.classList.contains('dark')
    // Fondo en degradé (top, bottom) en RGB 0-255.
    if (dark) viewer.setBackgroundColor(18, 24, 33, 5, 8, 12)
    else viewer.setBackgroundColor(238, 242, 246, 209, 217, 226)
    // Calidad: ambient occlusion + antialiasing.
    viewer.setQualityLevel(true, true)
    // Sombra de contacto en el piso para dar profundidad.
    viewer.setGroundShadow(true)
    viewer.setGroundReflection(false)
    // Estilo de iluminación neutro y luminoso (índice del preset de APS).
    if (viewer.setLightPreset) viewer.setLightPreset(dark ? 0 : 4)
    // Selección con el naranja de marca.
    if (viewer.setSelectionColor && window.THREE) {
      viewer.setSelectionColor(new window.THREE.Color(0xf77000))
    }
  } catch {
    /* el visor puede no estar listo para algunos ajustes; se reintenta al cargar */
  }
}

function ApsViewer({ rows = [], headers = [], selectedTag, onSelect, dataKey = 'default' }) {
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
    setUrn(p.urn); setModelName(p.name); rememberModel(p.urn, p.name)
    if (viewerRef.current) loadDocument(p.urn)
  }
  function deleteProject(urn) {
    setProjects(removeProject(urn))
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
  const [awpValue, setAwpValue] = useState('')
  const [objProps, setObjProps] = useState(null) // propiedades del objeto pinchado
  const [showProps, setShowProps] = useState(true)

  useEffect(() => { if (!awpField && awpFields.length) setAwpField(awpFields[0]) }, [awpFields, awpField])

  const awpValues = useMemo(() => {
    if (!awpField) return []
    const s = new Set()
    rows.forEach((r) => r[awpField] !== '' && r[awpField] != null && s.add(String(r[awpField])))
    return Array.from(s).sort()
  }, [rows, awpField])

  // TAGs que pertenecen al paquete elegido (listado de componentes).
  const packageTags = useMemo(() => {
    if (!awpField || !awpValue) return []
    return rows.filter((r) => String(r[awpField] ?? '') === awpValue).map((r) => String(r[tagKey] ?? '')).filter(Boolean)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, awpField, awpValue])

  // Callback siempre fresco sin re-disparar efectos.
  const onSelectRef = useRef(onSelect)
  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])

  // ---- init SDK + viewer (una sola vez, a prueba de StrictMode) ----
  useEffect(() => {
    let cancelled = false
    if (ctxRef.current.initStarted) return // evita doble inicialización (dev StrictMode)
    ctxRef.current.initStarted = true
    ;(async () => {
      try {
        setStatus('loadingSdk')
        await loadSdk()
        if (cancelled) return
        const token = await fetch(`${API}/api/aps/token`)
          .catch(() => { throw new Error(`No se pudo conectar al backend APS (${API}). En el sitio publicado, configura VITE_APS_API con la URL del backend desplegado.`) })
          .then((r) => {
            if (!r.ok) throw new Error('Backend APS respondió con error. Revisa las credenciales del servidor.')
            return r.json()
          })
        if (cancelled) return
        await new Promise((resolve) => {
          window.Autodesk.Viewing.Initializer(
            { env: 'AutodeskProduction', api: 'streamingV2', getAccessToken: (cb) => cb(token.access_token, token.expires_in) },
            resolve,
          )
        })
        if (cancelled || !mountRef.current) return
        const viewer = new window.Autodesk.Viewing.GuiViewer3D(mountRef.current)
        viewer.start()
        applyViewerStyle(viewer)
        // Re-aplica el estilo al cambiar el tema claro/oscuro de Sonqollay.
        const themeObs = new MutationObserver(() => applyViewerStyle(viewer))
        themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
        ctxRef.current.themeObs = themeObs
        viewer.addEventListener(window.Autodesk.Viewing.SELECTION_CHANGED_EVENT, (e) => {
          const id = e.dbIdArray?.[0]
          if (id == null) { setObjProps(null); return }
          viewer.getProperties(id, (props) => {
            onSelectRef.current?.(props.name || String(id))
            // Propiedades del objeto para mostrarlas dentro de Sonqollay.
            setObjProps({
              name: props.name || `Objeto ${id}`,
              dbId: id,
              groups: groupProps(props.properties || []),
            })
          })
        })
        viewerRef.current = viewer
        setStatus(urn ? 'translating' : 'ready')
        if (urn) loadDocument(urn)
      } catch (e) {
        if (!cancelled) { setStatus('error'); setMessage(e.message) }
      }
    })()
    return () => {
      cancelled = true
      // Solo destruye el visor al desmontar de verdad (no en el doble-montaje de dev).
      ctxRef.current.themeObs?.disconnect?.()
      if (viewerRef.current) { viewerRef.current.finish?.(); viewerRef.current = null }
      ctxRef.current.initStarted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function loadDocument(theUrn) {
    const viewer = viewerRef.current
    if (!viewer) return
    setStatus('translating'); setMessage('Abriendo modelo…')
    window.Autodesk.Viewing.Document.load(
      `urn:${theUrn}`,
      (doc) => {
        const node = doc.getRoot().getDefaultGeometry()
        viewer.loadDocumentNode(doc, node).then(() => {
          setStatus('ready'); setMessage('')
          // Algunos ajustes (sombra de piso, AO) requieren geometría cargada.
          applyViewerStyle(viewer)
          viewer.fitToView()
        })
      },
      (code) => {
        if (code === 9 || code === window.Autodesk.Viewing.ErrorCodes?.NETWORK_FAILED) {
          setMessage('El modelo aún se está traduciendo… reintentando en 8 s.')
          setTimeout(() => loadDocument(theUrn), 8000)
        } else { setStatus('error'); setMessage(`No se pudo abrir el modelo (código ${code}).`) }
      },
    )
  }

  async function handleUpload(file) {
    try {
      setStatus('uploading'); setMessage('Subiendo modelo a Autodesk…')
      const fd = new FormData()
      fd.append('file', file)
      const { urn: newUrn } = await fetch(`${API}/api/aps/models`, { method: 'POST', body: fd })
        .catch(() => { throw new Error(`No se pudo conectar al backend APS (${API}). Configura VITE_APS_API con la URL del backend desplegado.`) })
        .then((r) => {
          if (!r.ok) throw new Error('Falló la subida. ¿Está el backend con credenciales válidas?')
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
        const s = await fetch(`${API}/api/aps/models/${theUrn}/status`).then((r) => r.json())
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
  function findDbIds(values) {
    const viewer = viewerRef.current
    if (!viewer || !values.length) return Promise.resolve([])
    return new Promise((resolve) => {
      const all = new Set()
      let pending = values.length
      values.forEach((v) => {
        viewer.search(
          String(v),
          (ids) => { (ids || []).forEach((id) => all.add(id)); if (--pending === 0) resolve([...all]) },
          () => { if (--pending === 0) resolve([...all]) },
          ['name'],
        )
      })
    })
  }

  // Comportamiento de la lámina: aislar el paquete, resto en blanco + 75% transp.
  async function isolatePackage() {
    const viewer = viewerRef.current
    if (!viewer || !packageTags.length) return
    setMessage('Aislando paquete…')
    const dbIds = await findDbIds(packageTags)
    if (!dbIds.length) { setMessage('No se encontraron objetos del paquete en el modelo (revisa el campo de vínculo).'); return }
    // resto fantasma (blanco translúcido) + paquete resaltado
    viewer.isolate(dbIds)          // oculta/atenúa el resto (ghosting nativo ~ transparente)
    viewer.setGhosting(true)
    const WHITE = new window.THREE.Vector4(1, 1, 1, 0.25) // 25% opacidad = 75% transparencia
    // pinta el "resto" de blanco translúcido
    const tree = viewer.model.getInstanceTree()
    if (tree) {
      const allIds = []
      tree.enumNodeChildren(tree.getRootId(), function rec(id) {
        allIds.push(id)
        tree.enumNodeChildren(id, rec)
      }, true)
      const pkg = new Set(dbIds)
      allIds.forEach((id) => { if (!pkg.has(id)) viewer.setThemingColor(id, WHITE) })
    }
    viewer.fitToView(dbIds)
    setMessage('')
  }

  function clearIsolation() {
    const viewer = viewerRef.current
    if (!viewer) return
    viewer.clearThemingColors()
    viewer.isolate([])
    viewer.setGhosting(true)
    viewer.fitToView()
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
      a.download = `${(awpValue || 'vista').replace(/\W+/g, '_')}_16x9.png`
      a.click()
      if (typeof blob !== 'string') URL.revokeObjectURL(url)
    })
  }

  // cross-selection: enfocar el TAG activo de la planilla (solo si cambió).
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || !selectedTag || status !== 'ready') return
    if (ctxRef.current.lastTag === selectedTag) return
    ctxRef.current.lastTag = selectedTag
    findDbIds([selectedTag]).then((ids) => { if (ids.length) { viewer.isolate(ids); viewer.fitToView(ids) } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTag, status])

  // aplicar filtro AWP automáticamente al elegir valor
  useEffect(() => {
    if (status !== 'ready') return
    if (awpValue) isolatePackage()
    else clearIsolation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awpValue])

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
                          {!p.remote && (
                            <button onClick={() => deleteProject(p.urn)} title="Quitar de la lista" className="shrink-0 p-1.5 text-slate-300 opacity-0 transition hover:text-rose-500 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
                          )}
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
            <select value={awpField} onChange={(e) => { setAwpField(e.target.value); setAwpValue('') }} title="Tipo de paquete de trabajo" className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700 dark:border-white/10 dark:bg-ink-900 dark:text-slate-200">
              {(awpFields.length ? awpFields : headers).map((h) => <option key={h} value={h}>{h.replace(/_/g, ' ')}</option>)}
            </select>
            <select value={awpValue} onChange={(e) => setAwpValue(e.target.value)} title="Aislar paquete" className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700 dark:border-white/10 dark:bg-ink-900 dark:text-slate-200">
              <option value="">— Ver todo —</option>
              {awpValues.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <button onClick={exportImage16x9} title="Exportar imagen 16:9" className="inline-flex items-center gap-1 rounded-md bg-brand-500 px-2 py-1 text-xs font-semibold text-white transition hover:bg-brand-600 dark:bg-accent dark:text-ink-900">
              <Camera className="h-3.5 w-3.5" /> 16:9
            </button>
          </div>
        )}
      </div>

      {/* Listado de componentes del paquete */}
      {ready && awpValue && packageTags.length > 0 && (
        <div className={`absolute right-3 top-16 z-10 max-h-[45%] w-56 overflow-y-auto p-2 ${glass}`}>
          <p className="mb-1 px-1 text-[11px] font-bold text-slate-700 dark:text-white">{awpValue} · {packageTags.length} comp.</p>
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
