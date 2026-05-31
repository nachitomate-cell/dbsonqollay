import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Layers, Loader2, Upload, X } from 'lucide-react'

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

function ApsViewer({ rows = [], headers = [], selectedTag, onSelect }) {
  const mountRef = useRef(null)
  const viewerRef = useRef(null)
  const fileRef = useRef(null)
  const ctxRef = useRef({}) // estado interno persistente (initStarted, urn cargado…)
  const [status, setStatus] = useState('idle') // idle|loadingSdk|uploading|translating|ready|error
  const [message, setMessage] = useState('')
  const [urn, setUrn] = useState(import.meta.env.VITE_APS_URN || '')

  // Filtro AWP
  const tagKey = headers[0]
  const awpFields = useMemo(() => headers.filter((h) => /CWA|CWP|EWP|PWP|IWP|SWP|WBS|AWP/i.test(h)), [headers])
  const [awpField, setAwpField] = useState('')
  const [awpValue, setAwpValue] = useState('')

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
        const token = await fetch(`${API}/api/aps/token`).then((r) => {
          if (!r.ok) throw new Error('Backend APS no disponible. Inicia el servidor (carpeta server/).')
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
        viewer.setTheme(document.documentElement.classList.contains('dark') ? 'dark-theme' : 'light-theme')
        viewer.addEventListener(window.Autodesk.Viewing.SELECTION_CHANGED_EVENT, (e) => {
          const id = e.dbIdArray?.[0]
          if (id == null) return
          viewer.getProperties(id, (props) => onSelectRef.current?.(props.name || String(id)))
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
        viewer.loadDocumentNode(doc, node).then(() => { setStatus('ready'); setMessage('') })
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
      const { urn: newUrn } = await fetch(`${API}/api/aps/models`, { method: 'POST', body: fd }).then((r) => {
        if (!r.ok) throw new Error('Falló la subida. ¿Está el backend corriendo y con credenciales?')
        return r.json()
      })
      setUrn(newUrn); setMessage('Traduciendo modelo (puede tardar varios minutos)…')
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

  return (
    <div className="relative h-full w-full">
      <div ref={mountRef} className="absolute inset-0" />

      {/* Barra superior: subir modelo + filtro AWP + exportar */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-wrap items-start justify-between gap-2">
        <div className="pointer-events-auto flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".nwd,.nwc,.rvt,.ifc,.dwg,.dwfx,.3ds,.obj,.glb,.gltf,.fbx,.step,.stp,.iam,.ipt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = '' }} />
          <button onClick={() => fileRef.current?.click()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow backdrop-blur transition hover:text-brand-600 disabled:opacity-60 dark:border-white/10 dark:bg-ink-800/90 dark:text-slate-200">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {urn ? 'Cambiar modelo' : 'Subir modelo (NWD/RVT/IFC…)'}
          </button>
        </div>

        {ready && urn && (
          <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white/90 p-1.5 shadow backdrop-blur dark:border-white/10 dark:bg-ink-800/90">
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
        <div className="absolute right-3 top-16 z-10 max-h-[45%] w-56 overflow-y-auto rounded-lg border border-slate-200 bg-white/95 p-2 shadow-lg backdrop-blur dark:border-white/10 dark:bg-ink-800/95">
          <p className="mb-1 px-1 text-[11px] font-bold text-slate-700 dark:text-white">{awpValue} · {packageTags.length} comp.</p>
          {packageTags.map((t) => (
            <button key={t} onClick={() => onSelect?.(t)} className="block w-full truncate rounded px-1.5 py-1 text-left font-mono text-[11px] text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5">{t}</button>
          ))}
        </div>
      )}

      {/* Estado / errores */}
      {(busy || status === 'error' || message) && (
        <div className={['absolute left-1/2 top-14 z-10 max-w-md -translate-x-1/2 rounded-lg px-3 py-1.5 text-xs font-medium shadow backdrop-blur', status === 'error' ? 'bg-rose-500/90 text-white' : 'border border-slate-200 bg-white/90 text-slate-700 dark:border-white/10 dark:bg-ink-800/90 dark:text-slate-200'].join(' ')}>
          <span className="inline-flex items-center gap-1.5">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {message || (status === 'loadingSdk' ? 'Cargando visor de Autodesk…' : '')}
            {status === 'error' && <button onClick={() => { setStatus('ready'); setMessage('') }} className="ml-1"><X className="h-3 w-3" /></button>}
          </span>
        </div>
      )}

      {ready && !urn && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="pointer-events-auto max-w-sm rounded-xl border border-slate-200 bg-white/90 p-5 text-center shadow-lg backdrop-blur dark:border-white/10 dark:bg-ink-800/90">
            <p className="text-sm font-semibold text-slate-800 dark:text-white">Visor de modelos reales (APS)</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Sube un modelo de Navisworks/Revit/IFC. Luego podrás aislar por CWA/CWP/IWP/SWP (resto en blanco translúcido) y exportar la imagen en 16:9.</p>
            <button onClick={() => fileRef.current?.click()} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-600 dark:bg-accent dark:text-ink-900">
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
