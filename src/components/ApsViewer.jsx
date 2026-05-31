import { useEffect, useRef, useState } from 'react'
import { Loader2, Upload, X } from 'lucide-react'

/**
 * Visor de modelos reales con el SDK de Autodesk (APS Viewer).
 *
 * Carga el SDK desde el CDN de Autodesk, pide un token al backend de Sonqollay
 * (/api/aps/token) y muestra el modelo traducido (SVF2). Soporta subir un
 * modelo NWD/RVT/IFC… al backend, que lo traduce, y luego lo abre.
 *
 * Bidireccionalidad/AWP:
 *  - selectedTag: enfoca/aísla el objeto cuyo nombre/propiedad coincide.
 *  - onSelect(tag): clic en geometría -> notifica el TAG seleccionado.
 *
 * Requiere el backend corriendo (ver carpeta server/). La URL se toma de
 * VITE_APS_API (por defecto http://localhost:3000).
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

export default function ApsViewer({ selectedTag, onSelect }) {
  const mountRef = useRef(null)
  const viewerRef = useRef(null)
  const fileRef = useRef(null)
  const [status, setStatus] = useState('idle') // idle | loadingSdk | uploading | translating | ready | error
  const [message, setMessage] = useState('')
  const [urn, setUrn] = useState(import.meta.env.VITE_APS_URN || '')

  // Inicializa el SDK + visor una vez.
  useEffect(() => {
    let cancelled = false
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
        if (cancelled) return
        const viewer = new window.Autodesk.Viewing.GuiViewer3D(mountRef.current)
        viewer.start()
        viewer.setTheme(document.documentElement.classList.contains('dark') ? 'dark-theme' : 'light-theme')
        viewer.addEventListener(window.Autodesk.Viewing.SELECTION_CHANGED_EVENT, (e) => {
          const id = e.dbIdArray?.[0]
          if (id == null) return
          viewer.getProperties(id, (props) => onSelect?.(props.name || String(id)))
        })
        viewerRef.current = viewer
        setStatus(urn ? 'translating' : 'ready')
        if (urn) loadDocument(urn)
      } catch (e) {
        if (!cancelled) {
          setStatus('error')
          setMessage(e.message)
        }
      }
    })()
    return () => {
      cancelled = true
      viewerRef.current?.finish?.()
      viewerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function loadDocument(theUrn) {
    const viewer = viewerRef.current
    if (!viewer) return
    setStatus('translating')
    setMessage('Abriendo modelo…')
    window.Autodesk.Viewing.Document.load(
      `urn:${theUrn}`,
      (doc) => {
        const node = doc.getRoot().getDefaultGeometry()
        viewer.loadDocumentNode(doc, node).then(() => {
          setStatus('ready')
          setMessage('')
        })
      },
      (code) => {
        // 4xx típicamente = aún traduciendo; reintenta
        if (code === window.Autodesk.Viewing.ErrorCodes.NETWORK_FAILED || code === 9) {
          setMessage('El modelo aún se está traduciendo… reintentando en 8 s.')
          setTimeout(() => loadDocument(theUrn), 8000)
        } else {
          setStatus('error')
          setMessage(`No se pudo abrir el modelo (código ${code}).`)
        }
      },
    )
  }

  async function handleUpload(file) {
    try {
      setStatus('uploading')
      setMessage('Subiendo modelo a Autodesk…')
      const fd = new FormData()
      fd.append('file', file)
      const { urn: newUrn } = await fetch(`${API}/api/aps/models`, { method: 'POST', body: fd }).then((r) => {
        if (!r.ok) throw new Error('Falló la subida. ¿Está el backend corriendo y con credenciales?')
        return r.json()
      })
      setUrn(newUrn)
      setMessage('Traduciendo modelo (puede tardar varios minutos)…')
      pollStatus(newUrn)
    } catch (e) {
      setStatus('error')
      setMessage(e.message)
    }
  }

  async function pollStatus(theUrn) {
    setStatus('translating')
    const tick = async () => {
      try {
        const s = await fetch(`${API}/api/aps/models/${theUrn}/status`).then((r) => r.json())
        if (s.status === 'success') return loadDocument(theUrn)
        if (s.status === 'failed') {
          setStatus('error')
          setMessage('La traducción del modelo falló.')
          return
        }
        setMessage(`Traduciendo… ${s.progress || ''}`)
        setTimeout(tick, 6000)
      } catch {
        setTimeout(tick, 8000)
      }
    }
    tick()
  }

  // Aísla/enfoca el objeto que corresponde al TAG seleccionado en la planilla.
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || !selectedTag || status !== 'ready') return
    viewer.search(String(selectedTag), (dbIds) => {
      if (dbIds && dbIds.length) {
        viewer.isolate(dbIds)
        viewer.fitToView(dbIds)
      }
    })
  }, [selectedTag, status])

  const busy = ['loadingSdk', 'uploading', 'translating'].includes(status)

  return (
    <div className="relative h-full w-full">
      <div ref={mountRef} className="absolute inset-0" />

      {/* Barra: subir modelo */}
      <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
        <input ref={fileRef} type="file" accept=".nwd,.nwc,.rvt,.ifc,.dwg,.dwfx,.3ds,.obj,.glb,.gltf,.fbx,.step,.stp,.iam,.ipt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = '' }} />
        <button onClick={() => fileRef.current?.click()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow backdrop-blur transition hover:text-brand-600 disabled:opacity-60 dark:border-white/10 dark:bg-ink-800/90 dark:text-slate-200">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Subir modelo (NWD/RVT/IFC…)
        </button>
      </div>

      {/* Estado / errores */}
      {(busy || status === 'error' || message) && (
        <div className={['absolute left-1/2 top-3 z-10 max-w-md -translate-x-1/2 rounded-lg px-3 py-1.5 text-xs font-medium shadow backdrop-blur', status === 'error' ? 'bg-rose-500/90 text-white' : 'border border-slate-200 bg-white/90 text-slate-700 dark:border-white/10 dark:bg-ink-800/90 dark:text-slate-200'].join(' ')}>
          <span className="inline-flex items-center gap-1.5">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {message || (status === 'loadingSdk' ? 'Cargando visor de Autodesk…' : '')}
            {status === 'error' && <button onClick={() => { setStatus('ready'); setMessage('') }} className="ml-1"><X className="h-3 w-3" /></button>}
          </span>
        </div>
      )}

      {status === 'ready' && !urn && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="pointer-events-auto max-w-sm rounded-xl border border-slate-200 bg-white/90 p-5 text-center shadow-lg backdrop-blur dark:border-white/10 dark:bg-ink-800/90">
            <p className="text-sm font-semibold text-slate-800 dark:text-white">Visor de modelos reales (APS)</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Sube un modelo de Navisworks/Revit/IFC para verlo aquí. Se sube a Autodesk, se traduce y se muestra con la geometría real.</p>
            <button onClick={() => fileRef.current?.click()} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-600 dark:bg-accent dark:text-ink-900">
              <Upload className="h-4 w-4" /> Subir modelo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
