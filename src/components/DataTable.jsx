import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  ArrowDownToLine,
  ArrowUpDown,
  ArrowUpToLine,
  Box,
  Boxes,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Clock,
  Columns2,
  Columns3,
  Copy,
  Database,
  Download,
  Filter,
  GripVertical,
  History,
  Link2,
  List,
  Lock,
  Maximize2,
  Minimize2,
  Loader2,
  Pencil,
  PieChart,
  Plus,
  RotateCcw,
  RotateCw,
  Rows3,
  Search,
  Share2,
  Redo2,
  Tag,
  Trash2,
  TriangleAlert,
  Undo2,
  Upload,
  WifiOff,
  X,
} from 'lucide-react'

// El visor 3D (APS) se carga en un chunk aparte, solo al abrir la vista 3D.
const ApsViewer = lazyWithReload(() => import('./ApsViewer.jsx'))
import { useEditableDataset } from '../hooks/useEditableDataset.js'
import { activeProjectId, authFetch, currentUser } from '../lib/auth.js'
import { dequeue as offlineDequeue, enqueue as offlineEnqueue, isOnline as offlineIsOnline } from '../lib/offline.js'
import { lazyWithReload } from '../lib/lazyWithReload.js'
import RecordDrawer from './RecordDrawer.jsx'
import ConnectAwpModal from './ConnectAwpModal.jsx'
import AwpCoveragePanel from './AwpCoveragePanel.jsx'
import ViewerErrorBoundary from './ViewerErrorBoundary.jsx'

/* ----------------------------- helpers ----------------------------- */

const isCostHeader = (h) => /COSTO/i.test(h)
const isWeightHeader = (h) => /PESO/i.test(h)
const isStatusHeader = (h) => /(ESTADO|APROB|AVANCE)/i.test(h)
// Columnas de paquete AWP (CWA/CWP/EWP/PWP/IWP/SWP): se muestran como badge.
const isAwpHeader = (h) => /^\s*(cwa|cwp|ewp|pwp|iwp|swp)\s*$/i.test(String(h))

const fmtCost = (v) =>
  v === '' || v == null
    ? '—'
    : new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(v))
const fmtWeight = (v) => (v === '' || v == null ? '—' : `${new Intl.NumberFormat('es-CL').format(Number(v))} kg`)

const statusStyles = (val) => {
  const v = String(val).toUpperCase()
  if (v.includes('NO APROB') || v.includes('RECHAZ')) return 'bg-rose-500/15 text-rose-600 ring-rose-500/30 dark:text-rose-300'
  if (v.includes('APROB')) return 'bg-emerald-500/15 text-emerald-600 ring-emerald-500/30 dark:text-emerald-300'
  if (v.startsWith('E4')) return 'bg-emerald-500/15 text-emerald-600 ring-emerald-500/30 dark:text-emerald-300'
  if (v.startsWith('E3')) return 'bg-brand-500/15 text-brand-700 ring-brand-500/30 dark:bg-accent/15 dark:text-accent dark:ring-accent/30'
  if (v.startsWith('E2')) return 'bg-amber-500/15 text-amber-600 ring-amber-500/30 dark:text-amber-300'
  if (v.startsWith('E1')) return 'bg-rose-500/15 text-rose-600 ring-rose-500/30 dark:text-rose-300'
  return 'bg-slate-500/10 text-slate-500 ring-slate-400/20 dark:text-slate-400'
}

const CHECK_W = 48
const defaultWidth = (h) => {
  if (/DESCRIP/i.test(h)) return 230
  if (isCostHeader(h) || isWeightHeader(h)) return 120
  if (/^(ID|TAG)/i.test(h)) return 150
  return 170
}

// Columna identidad inmutable (modelo "camino B"): es la llave por la que el
// plugin de Navisworks y el visor 3D vinculan cada fila con el elemento del
// modelo (= TAG original "congelado"). Se escribe UNA vez (cuando está vacía) y
// luego queda bloqueada, para no romper el vínculo dato↔modelo. La modularización
// va en la columna TAG, que sí es editable.
const isIdColumn = (h) => /^id$/i.test(String(h || '').trim())
const isLockedCell = (h, value) => isIdColumn(h) && String(value ?? '').trim() !== ''

/* --------------------------- component ----------------------------- */

export default function DataTable({ dataset, subcategory, onBack, awp = {}, focusQuery, focusNonce, findTagAcross, onOpenSubcategory }) {
  const { cwps: awpCwps = [], importCwps, clearCwps } = awp
  const { columns, rows, addColumn, removeColumn, toggleColumn, moveColumn, updateRecord, updateRecords, applyPatches, addRecord, insertRecord, addRecords, deleteRecord, reset, dirty, undo, redo, canUndo, canRedo, loading } =
    useEditableDataset(subcategory.dataKey, dataset)

  const visibleCols = columns.filter((c) => c.visible)
  const headers = visibleCols.map((c) => c.key)

  // Densidad de la planilla (Cómodo / Compacto): preferencia global persistida.
  // Compacto reduce el alto/padding de las filas para ver más en pantalla.
  const [density, setDensity] = useState(() => {
    try { return localStorage.getItem('sqy-density') === 'compact' ? 'compact' : 'normal' } catch { return 'normal' }
  })
  useEffect(() => { try { localStorage.setItem('sqy-density', density) } catch { /* ignore */ } }, [density])
  const compact = density === 'compact'
  const rowH = compact ? 26 : 33 // alto de fila para el virtualizador
  const cellPad = compact ? 'px-2 py-0.5' : 'px-3 py-1.5'
  const bodyText = compact ? 'text-[12px]' : 'text-[13px]'

  // Estado de la vista persistido por planilla (orden, filtros, modo de vista):
  // se restaura al reabrir. El ancho de columnas se guarda aparte (colWidths) y el
  // orden/visibilidad de columnas viven en el dataset editable.
  const viewKey = `sqy-view-${subcategory.dataKey}`
  const persistedView = (() => {
    try { return JSON.parse(localStorage.getItem(viewKey)) || {} } catch { return {} }
  })()

  const [activeTab, setActiveTab] = useState('elements')
  // 'grid' (planilla) | 'bim' (3D) | 'split' (dividido). Una vista 'cards' antigua
  // persistida se normaliza a 'grid'.
  const [viewMode, setViewMode] = useState(() => (persistedView.viewMode === 'cards' ? 'grid' : persistedView.viewMode) || 'grid')
  const [fullscreen, setFullscreen] = useState(false) // ver la planilla a pantalla completa
  // Salir de pantalla completa con Escape.
  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e) => { if (e.key === 'Escape') setFullscreen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen])
  const [query, setQuery] = useState('')
  // "Saltar al elemento" desde el buscador global: siembra el filtro con el TAG.
  // El nonce re-dispara aunque el texto sea el mismo (p. ej. dos saltos seguidos).
  useEffect(() => {
    if (focusNonce && focusQuery != null) setQuery(focusQuery)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce])
  const [selected, setSelected] = useState(() => new Set())
  const [sort, setSort] = useState(persistedView.sort || { key: null, dir: 'asc' })
  const [colFilters, setColFilters] = useState(persistedView.colFilters || {})
  const [filterByCol, setFilterByCol] = useState('')
  const [propertyChange, setPropertyChange] = useState('')
  const [colWidths, setColWidths] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`sqy-w-${subcategory.dataKey}`)) || {}
    } catch {
      return {}
    }
  })
  // Planilla recién creada (vacía): abre el gestor de columnas para guiar al usuario.
  const [showColumns, setShowColumns] = useState(() => (dataset?.rows?.length ?? 0) === 0)
  const [newField, setNewField] = useState('')
  const [hdrDragKey, setHdrDragKey] = useState(null) // columna que se arrastra desde el encabezado
  const [editingId, setEditingId] = useState(null)
  // Pantalla chica (teléfono): un tap en una fila/celda abre la ficha (editar
  // campos en un panel) en vez de la edición inline, incómoda en la tabla ancha.
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const on = () => setIsMobile(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  // En móvil, los controles de buscar/ordenar/filtrar/AWP se colapsan detrás de un
  // botón para que la GRILLA quede visible arriba (si no, ocupan toda la pantalla).
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false)
  // Estado de conexión: para avisar qué no funciona sin internet (visor 3D,
  // publicar a Navisworks). Editar/guardar planillas SÍ funciona offline.
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  const [activeId, setActiveId] = useState(null) // selección cruzada con el 3D
  const [ctxMenu, setCtxMenu] = useState(null) // menú contextual de fila: { x, y, rowId }
  const [clipboardRow, setClipboardRow] = useState(null) // fila copiada (datos sin _id)
  const [showPackage, setShowPackage] = useState(false) // modal "Agrupar en paquete"
  const [showConnectAwp, setShowConnectAwp] = useState(false) // modal "Conectar a AWP"
  // Publicación a Navisworks: { status:'publishing'|'done'|'error', count, key, ms, error }
  const [publish, setPublish] = useState(null)
  const [publishElapsed, setPublishElapsed] = useState(0) // ms transcurridos (cronómetro en vivo)
  const publishStartRef = useRef(0)
  // Autoguardado en la base de datos: idle | saving | saved | error (+ at, error).
  const [autosave, setAutosave] = useState({ status: 'idle' })
  const autosaveTimer = useRef(null)
  const skipFirstAutosave = useRef(true) // no auto-subir al abrir/restaurar; solo tras editar
  // "Pendiente": hay cambios sin confirmar en la DB (entre una edición y un
  // guardado exitoso). Habilita "Guardar ahora" y el aviso al cerrar la pestaña.
  const [pendingSave, setPendingSave] = useState(false)
  const pendingRef = useRef(false) // espejo para el handler de beforeunload (sin re-render)
  const setPending = (v) => { pendingRef.current = v; setPendingSave(v) }
  // Versionado de ediciones: si llega una edición MIENTRAS se guarda, no marcamos
  // "guardado" al volver (quedaría pendiente la nueva). saved == edit ⇒ al día.
  const editVersionRef = useRef(0)
  const savedVersionRef = useRef(0)

  const scrollRef = useRef(null)
  const viewerWrapRef = useRef(null)
  const newFieldRef = useRef(null)
  const searchRef = useRef(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Pantalla completa del visor. Usa la Fullscreen API si el navegador la soporta
  // (Android/escritorio); en iOS (no la soporta en divs) cae a pantalla completa
  // por CSS (estado `fullscreen`, que pone la card en fixed inset-0).
  function toggleFullscreen() {
    const el = viewerWrapRef.current
    if (el && document.fullscreenEnabled && el.requestFullscreen) {
      if (document.fullscreenElement) document.exitFullscreen?.()
      else el.requestFullscreen().catch(() => setFullscreen((v) => !v))
      return
    }
    setFullscreen((v) => !v)
  }
  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !editingId && !/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) {
        // En pantalla completa, Escape SOLO sale de ese modo (lo maneja el otro
        // efecto); no debe además cambiar de vista ni volver atrás.
        if (fullscreen) return
        if (viewMode === 'bim' || viewMode === 'split') setViewMode('grid')
        else onBack()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack, editingId, viewMode, fullscreen])

  // Persiste el ancho de columnas por dataset.
  useEffect(() => {
    try {
      localStorage.setItem(`sqy-w-${subcategory.dataKey}`, JSON.stringify(colWidths))
    } catch {
      /* ignore */
    }
  }, [colWidths, subcategory.dataKey])

  // Cronómetro en vivo mientras se publica a Navisworks (actualiza cada 100 ms).
  useEffect(() => {
    if (publish?.status !== 'publishing') return
    const id = setInterval(() => setPublishElapsed(Date.now() - publishStartRef.current), 100)
    return () => clearInterval(id)
  }, [publish?.status])

  // Persiste el estado de la vista (modo, orden y filtros) por planilla.
  useEffect(() => {
    try {
      localStorage.setItem(viewKey, JSON.stringify({ viewMode, sort, colFilters }))
    } catch {
      /* ignore */
    }
  }, [viewKey, viewMode, sort, colFilters])

  // Aviso al cerrar/recargar si hay ediciones sin publicar (dirty). Las ediciones
  // se guardan localmente, pero esto evita perderlas si se limpia el navegador o
  // se cierra en un PC compartido antes de publicarlas a Navisworks.
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  // Publica la planilla editada en el backend para que el plugin de Navisworks
  // la lea por HTTP (GET /api/datasets/:key). La key es el dataKey de la
  // subcategoría. Ver docs/navisworks-plugin/.
  async function publishForNavisworks() {
    const apiBase = localStorage.getItem('sqy-api-url') || import.meta.env.VITE_APS_API || ''
    const start = Date.now()
    publishStartRef.current = start
    setPublishElapsed(0)
    setPublish({ status: 'publishing', count: rows.length, key: subcategory.dataKey })
    try {
      const pid = activeProjectId()
      const res = await authFetch(`${apiBase}/api/datasets/${encodeURIComponent(subcategory.dataKey)}${pid ? `?project=${pid}` : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: subcategory.name,
          tagField: headers[0],
          headers,
          columns, // set completo (con visibilidad) para no perder columnas ocultas
          rows: rows.map(({ _id, ...r }) => r),
          author: currentUser()?.email, // para el historial de cambios
        }),
      })
      const ct = res.headers.get('content-type') || ''
      const j = ct.includes('application/json') ? await res.json() : {}
      if (!res.ok) throw new Error(j.error || `Error ${res.status}`)
      const ms = Date.now() - start
      setPublish({ status: 'done', count: j.count ?? rows.length, key: subcategory.dataKey, ms })
      logAction(`Publicó la planilla para Navisworks (${j.count ?? rows.length} elementos, ${(ms / 1000).toFixed(1)} s)`)
    } catch (e) {
      const ms = Date.now() - start
      setPublish({ status: 'error', error: e.message, key: subcategory.dataKey, ms })
    }
  }

  // --- Autoguardado en la base de datos ---------------------------------------
  // Sube la planilla completa al backend (POST /api/datasets/:key), el mismo
  // endpoint del publish, que la persiste en Postgres (upsertDatasetToDb) además
  // del bucket APS. Es single-tenant: reemplaza el dataset de esta key (no hay
  // aislamiento por usuario aún → S1/B4 pendientes). Datos siempre frescos vía
  // ref para que el guardado diferido no use una copia vieja.
  const saveDataRef = useRef(null)
  saveDataRef.current = { rows, headers, columns, name: subcategory.name, dataKey: subcategory.dataKey }
  async function autosaveToDb() {
    const { rows, headers, columns, name, dataKey } = saveDataRef.current
    const apiBase = localStorage.getItem('sqy-api-url') || import.meta.env.VITE_APS_API || ''
    const version = editVersionRef.current // versión que estamos por persistir
    const pid = activeProjectId()
    // Encola SIEMPRE (única fuente de verdad de "falta subir"); se quita al subir
    // bien. Así, si se corta la red o se cierra la pestaña a mitad, el cambio se
    // sincroniza al reconectar/reabrir. El contenido ya está en localStorage.
    offlineEnqueue(dataKey, { projectId: pid, name, author: currentUser()?.email })
    // Sin conexión: no intentamos el POST (fallaría); queda en la cola.
    if (!offlineIsOnline()) {
      setAutosave({ status: 'offline', at: Date.now() })
      return
    }
    setAutosave({ status: 'saving' })
    try {
      const res = await authFetch(`${apiBase}/api/datasets/${encodeURIComponent(dataKey)}${pid ? `?project=${pid}` : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // `author` = quién edita (para el historial de cambios). Con login real
        // el backend usa el JWT; mientras tanto, el email de la sesión.
        body: JSON.stringify({ name, tagField: headers[0], headers, columns, rows: rows.map(({ _id, ...r }) => r), author: currentUser()?.email }),
      })
      const ct = res.headers.get('content-type') || ''
      const j = ct.includes('application/json') ? await res.json() : {}
      if (!res.ok) throw new Error(j.error || `Error ${res.status}`)
      // El publish nunca falla por la DB (es aditivo): si Postgres no está
      // configurado o falló, lo informa en j.db. No mentimos: lo marcamos error.
      if (j.db && (j.db.error || j.db.skipped)) {
        setAutosave({ status: 'error', at: Date.now(), error: j.db.error || 'La base de datos no está configurada en el servidor.' })
        return // queda pendiente (no tocamos pendingRef)
      }
      savedVersionRef.current = version
      offlineDequeue(dataKey) // por si había quedado encolada de una edición offline
      setAutosave({ status: 'saved', at: Date.now() })
      // Solo "al día" si no llegó otra edición mientras se guardaba.
      if (editVersionRef.current === version) setPending(false)
    } catch (e) {
      // Falló el POST (típicamente se cayó la red en medio): el cambio ya quedó
      // encolado arriba, así que el motor de sync lo reintentará al reconectar.
      setAutosave(offlineIsOnline()
        ? { status: 'error', at: Date.now(), error: e.message }
        : { status: 'offline', at: Date.now() })
    }
  }
  // Fuerza el guardado inmediato (botón "Guardar ahora"), sin esperar el debounce.
  function flushAutosave() {
    if (autosaveTimer.current) { clearTimeout(autosaveTimer.current); autosaveTimer.current = null }
    autosaveToDb()
  }

  // Debounce: tras cada edición agenda el guardado ~1.5 s después de la última
  // tecla (así no sube en cada pulsación). No corre en el primer render (mount o
  // restauración desde localStorage) para no auto-subir al abrir la planilla.
  useEffect(() => {
    if (skipFirstAutosave.current) { skipFirstAutosave.current = false; return }
    if (!dirty) return
    editVersionRef.current += 1
    setPending(true)
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(autosaveToDb, 1500)
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, columns, dirty])

  // Aviso del navegador si se cierra/recarga la pestaña con un guardado pendiente
  // (cambios aún no confirmados en la DB). Usa el ref para leer el último valor.
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!pendingRef.current) return
      e.preventDefault()
      e.returnValue = '' // dispara el diálogo estándar "¿Salir del sitio?"
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  // Exporta la vista actual (columnas visibles + filas filtradas) a CSV o Excel.
  async function handleExport(format) {
    const cols = headers
    const data = filtered
    const base = (subcategory.code || subcategory.name || 'export').replace(/\W+/g, '_')
    if (format === 'csv') {
      const esc = (v) => {
        const s = v == null ? '' : String(v)
        return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
      }
      const lines = [cols.map(esc).join(',')]
      for (const r of data) lines.push(cols.map((c) => esc(r[c])).join(','))
      const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${base}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      const XLSX = await import('xlsx')
      const aoa = [cols, ...data.map((r) => cols.map((c) => r[c] ?? ''))]
      const ws = XLSX.utils.aoa_to_sheet(aoa)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Datos')
      XLSX.writeFile(wb, `${base}.xlsx`)
    }
  }

  // Valores distintos de una columna con su conteo (para el buscador del filtro).
  const valueCounts = (h) => {
    const m = new Map()
    for (const r of rows) {
      const v = r[h]
      if (v === '' || v == null) continue
      const k = String(v)
      m.set(k, (m.get(k) || 0) + 1)
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0], 'es'))
  }
  // ¿La columna es mayormente numérica? → habilita filtro por rango.
  const isNumericCol = (h) => {
    let n = 0, ok = 0
    for (const r of rows) {
      const v = r[h]
      if (v === '' || v == null) continue
      n++
      if (!Number.isNaN(Number(v))) ok++
      if (n > 30) break
    }
    return n > 0 && ok / n > 0.8
  }
  const filterValues = useMemo(() => (filterByCol ? valueCounts(filterByCol) : []), [filterByCol, rows])
  const filterColIsNumeric = useMemo(() => (filterByCol ? isNumericCol(filterByCol) : false), [filterByCol, rows])

  // Evalúa un filtro (multi-valor o rango) sobre una fila.
  const matchFilter = (r, h, f) => {
    if (!f) return true
    if (f.type === 'range') {
      const num = Number(r[h])
      if (Number.isNaN(num)) return false
      if (f.min != null && num < f.min) return false
      if (f.max != null && num > f.max) return false
      return true
    }
    // multi-valor: la fila pasa si su valor está entre los seleccionados
    if (!f.values || f.values.length === 0) return true
    return f.values.includes(String(r[h] ?? ''))
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let data = rows.filter((r) => {
      for (const [h, f] of Object.entries(colFilters)) if (!matchFilter(r, h, f)) return false
      if (!q) return true
      return headers.some((h) => String(r[h] ?? '').toLowerCase().includes(q))
    })
    if (sort.key) {
      const dir = sort.dir === 'asc' ? 1 : -1
      data = [...data].sort((a, b) => {
        const av = a[sort.key]
        const bv = b[sort.key]
        const an = Number(av)
        const bn = Number(bv)
        const numeric = !Number.isNaN(an) && !Number.isNaN(bn) && av !== '' && bv !== ''
        return numeric ? (an - bn) * dir : String(av ?? '').localeCompare(String(bv ?? ''), 'es') * dir
      })
    }
    return data
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query, colFilters, sort, headers.join('|')])

  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowH,
    overscan: 16,
  })
  // Recalcula el alto virtual al cambiar la densidad (Cómodo ↔ Compacto).
  useEffect(() => { try { rowVirtualizer.measure() } catch { /* noop */ } }, [rowH]) // eslint-disable-line react-hooks/exhaustive-deps
  const virtualItems = rowVirtualizer.getVirtualItems()
  const totalSize = rowVirtualizer.getTotalSize()
  const padTop = virtualItems.length ? virtualItems[0].start : 0
  const padBottom = virtualItems.length ? totalSize - virtualItems[virtualItems.length - 1].end : 0

  // Desplaza la planilla al elemento activo (selección cruzada desde el 3D).
  // align:'auto' solo desplaza si la fila está fuera de vista — así clickear una
  // fila visible para editarla no la re-centra (no "salta" el input inline).
  useEffect(() => {
    if (!activeId || (viewMode !== 'grid' && viewMode !== 'split')) return
    const idx = filtered.findIndex((r) => r._id === activeId)
    if (idx >= 0) rowVirtualizer.scrollToIndex(idx, { align: 'auto' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  const allVisibleSelected = filtered.length > 0 && filtered.every((r) => selected.has(r._id))
  const toggleRow = (id) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  const toggleAll = () =>
    setSelected((prev) => {
      if (allVisibleSelected) return new Set()
      const next = new Set(prev)
      filtered.forEach((r) => next.add(r._id))
      return next
    })
  const setSortKey = (h) =>
    setSort((s) => (s.key === h ? { key: h, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: h, dir: 'asc' }))

  // Aplica/actualiza el filtro de una columna (multi-valor o rango).
  const setColumnFilter = (h, f) =>
    setColFilters((p) => {
      const n = { ...p }
      if (!f || (f.type !== 'range' && (!f.values || f.values.length === 0))) delete n[h]
      else if (f.type === 'range' && f.min == null && f.max == null) delete n[h]
      else n[h] = f
      return n
    })
  const toggleFilterValue = (h, value) =>
    setColFilters((p) => {
      const cur = p[h]?.values || []
      const values = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value]
      const n = { ...p }
      if (values.length) n[h] = { type: 'values', values }
      else delete n[h]
      return n
    })
  const removeFilter = (h) =>
    setColFilters((p) => {
      const n = { ...p }
      delete n[h]
      return n
    })
  function resetView() {
    setQuery('')
    setColFilters({})
    setSort({ key: null, dir: 'asc' })
    setFilterByCol('')
  }

  function startResize(e, header) {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = colWidths[header] ?? defaultWidth(header)
    const onMove = (ev) => setColWidths((w) => ({ ...w, [header]: Math.max(80, startW + ev.clientX - startX) }))
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
    }
    document.body.style.cursor = 'col-resize'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // Selección cruzada: activar resalta (y vuela el 3D); abrir ficha edita.
  const activate = (id) => setActiveId(id)
  const openFicha = (id) => {
    cancelEditRef.current = true // si había una edición inline en curso, se descarta
    setEditingCell(null)
    setActiveId(id)
    setEditingId(id)
  }

  // ---- Edición INLINE en la celda (un clic) ----
  // Un clic en una celda la vuelve editable ahí mismo (como Excel/Sheets); el
  // doble clic sigue abriendo la ficha completa. Se confirma con Enter/clic fuera
  // (onBlur) y se cancela con Esc. cancelEditRef distingue guardar vs descartar
  // en el onBlur (único punto de confirmación, evita guardado doble).
  const [editingCell, setEditingCell] = useState(null) // { id, key } | null
  const [cellDraft, setCellDraft] = useState('')
  const cancelEditRef = useRef(false)
  const suppressBlurRef = useRef(false) // Tab/Enter ya guarda: el blur no debe re-guardar
  function startInlineEdit(id, key, value) {
    if (isLockedCell(key, value)) return // ID inmutable ya asignado (camino B)
    cancelEditRef.current = false
    setCellDraft(value == null ? '' : String(value))
    setEditingCell({ id, key })
  }
  function commitInlineEdit() {
    if (suppressBlurRef.current) { suppressBlurRef.current = false; return } // ya se guardó al navegar
    setEditingCell((cur) => {
      if (cur && !cancelEditRef.current) {
        // Solo guarda si el valor cambió de verdad (abrir y cerrar una celda sin
        // tocarla no debe disparar el autoguardado).
        const curVal = rows.find((r) => r._id === cur.id)?.[cur.key]
        if (cellDraft !== String(curVal ?? '')) {
          updateRecord(cur.id, { [cur.key]: cellDraft })
          logAction('Editó una celda')
        }
      }
      return null
    })
  }
  // Navegación tipo planilla: guarda la celda y pasa a editar otra. Enter = abajo,
  // Tab = derecha; con Shift, sentido inverso. Tab en el borde salta de fila.
  function commitAndMove(id, key, dRow, dCol) {
    // Solo guarda si cambió (igual que commitInlineEdit); igual navega a la celda
    // siguiente aunque no haya cambio.
    const curVal = rows.find((r) => r._id === id)?.[key]
    if (cellDraft !== String(curVal ?? '')) {
      updateRecord(id, { [key]: cellDraft })
      logAction('Editó una celda')
    }
    const rowIdx = filtered.findIndex((r) => r._id === id)
    const colIdx = headers.indexOf(key)
    let nr = rowIdx + dRow
    let nc = colIdx + dCol
    if (dCol > 0 && nc >= headers.length) { nc = 0; nr = rowIdx + 1 }
    else if (dCol < 0 && nc < 0) { nc = headers.length - 1; nr = rowIdx - 1 }
    const nextRow = filtered[nr]
    const nextKey = headers[nc]
    suppressBlurRef.current = true // el blur del input actual no debe re-guardar
    if (nextRow && nextKey) {
      setActiveId(nextRow._id)
      startInlineEdit(nextRow._id, nextKey, nextRow[nextKey])
      try { rowVirtualizer.scrollToIndex(nr, { align: 'auto' }) } catch { /* noop */ }
    } else {
      setEditingCell(null) // no hay celda siguiente: cierra la edición
    }
  }
  // Pega un bloque copiado de Excel/Sheets (TSV) desde la celda actual,
  // rellenando hacia abajo/derecha sobre las filas y columnas existentes.
  function handleCellPaste(e, id, key) {
    const text = e.clipboardData?.getData('text/plain') ?? ''
    // Solo intercepta si es multi-celda (tabs o varias líneas); un valor simple
    // deja el pegado normal dentro del input.
    if (!text.includes('\t') && !/\n/.test(text.trim())) return
    e.preventDefault()
    const matrix = text.replace(/\r\n?/g, '\n').replace(/\n+$/, '').split('\n').map((l) => l.split('\t'))
    const startRow = filtered.findIndex((r) => r._id === id)
    const startCol = headers.indexOf(key)
    if (startRow < 0 || startCol < 0) return
    let applied = 0, trunc = 0
    const patches = {}
    matrix.forEach((cells, rOff) => {
      const target = filtered[startRow + rOff]
      if (!target) { trunc++; return }
      const patch = {}
      cells.forEach((val, cOff) => { const col = headers[startCol + cOff]; if (col) patch[col] = val })
      if (Object.keys(patch).length) { patches[target._id] = patch; applied++ }
    })
    applyPatches(patches) // un solo paso de deshacer para todo el pegado
    suppressBlurRef.current = true
    setEditingCell(null)
    logAction(`Pegó ${applied} fila(s) desde el portapapeles`)
    flash(`Pegado: ${applied} fila(s)${trunc ? ` · ${trunc} del portapapeles excedían la planilla` : ''}.`)
  }

  // Handler estable para el visor APS (evita re-renders por nueva fn cada render).
  const filteredRef = useRef(filtered)
  filteredRef.current = filtered
  const handleApsSelect = useCallback((tag) => {
    const row = filteredRef.current.find((r) => String(r[headers[0]]) === String(tag))
    if (row) {
      // Solo activa (resalta) la fila. La edición se hace en el panel del visor
      // (ApsViewer → "Datos de ingeniería"), que funciona también en pantalla
      // completa, donde el drawer lateral de la tabla no es visible. La ficha
      // completa sigue disponible con doble clic en la tabla.
      setActiveId(row._id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers[0]])

  function newRecord() {
    const id = addRecord()
    openFicha(id)
    logAction('Nuevo registro')
  }
  function saveRecord(patch) {
    updateRecord(editingId, patch)
    setEditingId(null)
    logAction('Editó un registro')
  }
  function removeRecord() {
    deleteRecord(editingId)
    setSelected((prev) => {
      const n = new Set(prev)
      n.delete(editingId)
      return n
    })
    setEditingId(null)
    logAction('Eliminó un registro')
  }
  // ---- Menú contextual de fila: copiar / pegar / duplicar ----
  // Abre el menú en la posición del clic derecho sobre una fila.
  function openRowMenu(e, rowId) {
    e.preventDefault()
    setActiveId(rowId)
    setCtxMenu({ x: e.clientX, y: e.clientY, rowId })
  }
  // Copia la fila a un portapapeles interno y, además, al del sistema en formato
  // TSV (tab-separado) para poder pegarla en Excel/Sheets.
  async function copyRow(id) {
    const r = rows.find((x) => x._id === id)
    if (!r) return
    const { _id, ...data } = r
    setClipboardRow(data)
    try { await navigator.clipboard.writeText(headers.map((h) => String(data[h] ?? '')).join('\t')) } catch { /* sin permiso */ }
    flash('Fila copiada. Usa “Pegar fila” con clic derecho.')
    logAction('Copió una fila')
  }
  // Convierte texto del portapapeles (TSV/celdas de Excel) en filas mapeadas por
  // posición a las columnas visibles.
  function parseClipboardRows(text) {
    const lines = text.replace(/\r\n?/g, '\n').split('\n')
    while (lines.length && lines[lines.length - 1] === '') lines.pop()
    return lines
      .filter((l) => l !== '')
      .map((line) => {
        const cells = line.split('\t')
        const obj = {}
        headers.forEach((h, i) => { obj[h] = cells[i] ?? '' })
        return obj
      })
  }
  // Pega debajo de la fila de referencia: primero intenta el portapapeles del
  // sistema (datos tabulares de Excel/Sheets) y, si no, usa la fila copiada en la app.
  async function pasteRow(refId) {
    let dataRows = null
    try {
      const text = await navigator.clipboard.readText()
      if (text && text.trim()) {
        // Sólo lo tratamos como datos del sistema si parece tabular (tab/varias
        // líneas) o si no hay nada copiado dentro de la app.
        if (/[\t\n]/.test(text.trim()) || !clipboardRow) dataRows = parseClipboardRows(text)
      }
    } catch { /* sin permiso de portapapeles: usamos el interno */ }
    if (!dataRows || !dataRows.length) {
      if (!clipboardRow) { flash('No hay nada para pegar.'); return }
      dataRows = [clipboardRow]
    }
    // Inserta en orden bajo la fila de referencia (recorre al revés para conservarlo).
    let lastId = null
    for (let i = dataRows.length - 1; i >= 0; i--) lastId = insertRecord(refId, dataRows[i], 'below')
    if (lastId) setActiveId(lastId)
    flash(dataRows.length > 1 ? `Pegadas ${dataRows.length} fila(s).` : 'Fila pegada.')
    logAction(`Pegó ${dataRows.length} fila(s)`)
  }
  // Duplica la fila (arriba o abajo) con todos sus valores.
  function duplicateRow(id, where) {
    const r = rows.find((x) => x._id === id)
    if (!r) return
    const { _id, ...data } = r
    const newId = insertRecord(id, data, where)
    setActiveId(newId)
    flash(where === 'above' ? 'Fila duplicada arriba.' : 'Fila duplicada abajo.')
    logAction('Duplicó una fila')
  }
  function addField() {
    if (newField.trim()) logAction(`Agregó columna “${newField.trim()}”`)
    addColumn(newField)
    setNewField('')
  }

  // ---- Feedback efímero (toast) + historial de sesión ----
  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)
  function flash(msg) {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2800)
  }
  const [history, setHistory] = useState([]) // acciones de la sesión (se reinicia al recargar)
  function logAction(text) {
    setHistory((h) => [{ t: Date.now(), text }, ...h].slice(0, 50))
  }

  // ---- Atajos de teclado de la planilla ----
  // No actúan mientras se tipea en un input/select ni con la ficha abierta.
  //   Ctrl/Cmd+F  → enfocar el buscador
  //   Ctrl/Cmd+A  → seleccionar todo lo filtrado
  //   Supr        → eliminar las filas seleccionadas
  //   Enter       → abrir la ficha de la fila activa
  //   ↑ / ↓       → mover la fila activa (y desplazarla a la vista)
  useEffect(() => {
    const onKey = (e) => {
      if (editingId) return
      const mod = e.ctrlKey || e.metaKey
      // Ctrl/Cmd+F enfoca el buscador aunque el foco esté en otro lado.
      if (mod && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select?.()
        return
      }
      const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) || e.target.isContentEditable
      if (typing) return

      // Deshacer / rehacer (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z o Ctrl/Cmd+Y). Solo
      // sobre la planilla: si se está editando una celda/campo (input), el guard
      // de arriba ya salió y el navegador maneja el deshacer del texto.
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return }
      if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return }

      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        setSelected(new Set(filtered.map((r) => r._id)))
        return
      }
      if (e.key === 'Delete') {
        const ids = [...selected]
        if (!ids.length) return
        e.preventDefault()
        ids.forEach((id) => deleteRecord(id))
        setSelected(new Set())
        if (ids.includes(activeId)) setActiveId(null)
        flash(`Eliminada(s) ${ids.length} fila(s).`)
        logAction(`Eliminó ${ids.length} fila(s)`)
        return
      }
      if (e.key === 'Enter' && activeId) {
        e.preventDefault()
        openFicha(activeId)
        return
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!filtered.length) return
        e.preventDefault()
        const cur = filtered.findIndex((r) => r._id === activeId)
        const nextIdx = e.key === 'ArrowDown'
          ? Math.min(filtered.length - 1, cur + 1)        // cur=-1 → primera fila
          : Math.max(0, (cur < 0 ? 0 : cur) - 1)
        const next = filtered[nextIdx]
        if (next) { setActiveId(next._id); rowVirtualizer.scrollToIndex(nextIdx, { align: 'auto' }) }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, filtered, selected, activeId, deleteRecord, undo, redo])

  const fileRef = useRef(null)
  const [showStats, setShowStats] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  // Filas sobre las que actúan Copiar/edición: las seleccionadas o, si no hay, las filtradas.
  const rowsForAction = () => {
    const sel = filtered.filter((r) => selected.has(r._id))
    return sel.length ? sel : filtered
  }
  // Copiar al portapapeles en formato TSV (se pega directo en Excel/Sheets).
  async function copySelection() {
    const data = rowsForAction()
    if (!data.length) { flash('No hay filas para copiar.'); return }
    const tsv = [headers.join('\t'), ...data.map((r) => headers.map((h) => String(r[h] ?? '')).join('\t'))].join('\n')
    try {
      await navigator.clipboard.writeText(tsv)
      flash(`Copiadas ${data.length} fila(s) al portapapeles.`)
      logAction(`Copió ${data.length} fila(s)`)
    } catch { flash('No se pudo copiar (permiso del navegador).') }
  }
  // Editar: abre la ficha de la fila seleccionada (o la activa).
  function editSelected() {
    const id = selected.size === 1 ? [...selected][0] : activeId
    if (id) { setActiveId(id); setEditingId(id) }
    else flash('Selecciona una fila (o haz clic en una) para editarla.')
  }
  // Parser CSV sencillo (maneja comillas y separador coma o punto y coma).
  function parseCsv(text) {
    const rowsArr = []
    const firstLine = text.slice(0, text.indexOf('\n') >= 0 ? text.indexOf('\n') : text.length)
    const delim = (firstLine.match(/;/g)?.length || 0) > (firstLine.match(/,/g)?.length || 0) ? ';' : ','
    let field = '', row = [], inQ = false
    const pushField = () => { row.push(field); field = '' }
    const pushRow = () => { rowsArr.push(row); row = [] }
    for (let i = 0; i < text.length; i++) {
      const c = text[i]
      if (inQ) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
        else if (c === '"') inQ = false
        else field += c
      } else if (c === '"') inQ = true
      else if (c === delim) pushField()
      else if (c === '\n') { pushField(); pushRow() }
      else if (c === '\r') { /* ignora */ }
      else field += c
    }
    if (field.length || row.length) { pushField(); pushRow() }
    const head = (rowsArr.shift() || []).map((h) => h.trim())
    return rowsArr.filter((r) => r.some((v) => v !== '')).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])))
  }
  // Importar CSV o Excel → agrega las filas al dataset (crea columnas que falten).
  async function importFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    flash('Importando…')
    try {
      let parsed = []
      if (/\.csv$/i.test(file.name)) parsed = parseCsv(await file.text())
      else {
        const XLSX = await import('xlsx')
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
        parsed = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
      }
      const n = addRecords(parsed)
      flash(n ? `Importadas ${n} fila(s) desde ${file.name}.` : 'No se encontraron filas en el archivo.')
      if (n) logAction(`Importó ${n} fila(s) (${file.name})`)
    } catch { flash('No se pudo leer el archivo (formato no válido).') }
  }
  // Edición múltiple: asigna un valor a una columna en las filas seleccionadas.
  // El AWP usa una columna CWA/CWP/EWP/IWP; el código de mercancía, una de código.
  function bulkUpdate(kind) {
    const ids = [...selected]
    if (!ids.length) { flash('Selecciona elementos primero.'); return }
    const re = kind === 'awp' ? /CWA|CWP|EWP|IWP|SWP|AWP|WBS/i : /COMMODITY|MERCANC|C[ÓO]DIGO|COMM/i
    const col = propertyChange || headers.find((h) => re.test(h))
    if (!col) { flash('Elige la columna a actualizar en “Cambio de propiedad”.'); return }
    const value = window.prompt(`Nuevo valor de “${col.replace(/_/g, ' ')}” para ${ids.length} elemento(s):`, '')
    if (value == null) return
    updateRecords(ids, { [col]: value })
    flash(`Actualizado “${col.replace(/_/g, ' ')}” en ${ids.length} elemento(s).`)
    logAction(`${kind === 'awp' ? 'Relación AWP' : 'Código de mercancía'}: ${col}=“${value}” en ${ids.length}`)
  }

  // ---- Agrupar varias filas seleccionadas en un paquete ----
  // El paquete se guarda en una columna ("PAQUETE" o la que ya exista que la
  // represente); todos los elementos seleccionados reciben el mismo valor.
  const PACKAGE_RE = /PAQUETE|PACKAGE/i
  const packageCol = useMemo(
    () => columns.find((c) => PACKAGE_RE.test(c.key))?.key || 'PAQUETE',
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columns.map((c) => c.key).join('|')],
  )
  // Paquetes ya creados (valores distintos de la columna) para reutilizarlos.
  const existingPackages = useMemo(() => {
    const set = new Set()
    rows.forEach((r) => { const v = String(r[packageCol] ?? '').trim(); if (v) set.add(v) })
    return [...set].sort((a, b) => a.localeCompare(b, 'es'))
  }, [rows, packageCol])

  // Conecta un conjunto de componentes (por _id) a un CWA/CWP del CSV de Aura
  // AWP: escribe el CWA y el CWP en las columnas correspondientes de la planilla
  // (las crea si faltan). Es un solo paso de deshacer. Reutilizable desde la
  // grilla (selección por checkbox) y desde el visor 3D (selección de objetos).
  const connectIdsToAwp = useCallback((ids, cwp) => {
    if (!ids?.length || !cwp) { flash('Selecciona componentes primero.'); return }
    const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    const findCol = (kw, fallback) =>
      columns.find((c) => norm(c.key) === norm(kw))?.key ||
      columns.find((c) => norm(c.key).includes(norm(kw)))?.key || fallback
    const cwaCol = findCol('cwa', 'CWA')
    const cwpCol = findCol('cwp', 'CWP')
    if (!columns.some((c) => c.key === cwaCol)) addColumn(cwaCol)
    if (!columns.some((c) => c.key === cwpCol)) addColumn(cwpCol)
    updateRecords(ids, { [cwaCol]: cwp.cwa, [cwpCol]: cwp.codigo })
    flash(`${ids.length} componente(s) conectados a ${cwp.codigo} (${cwp.cwa}).`)
    logAction(`Conectó ${ids.length} componente(s) a ${cwp.codigo}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns])
  function connectToAwp(cwp) {
    connectIdsToAwp([...selected], cwp)
    setShowConnectAwp(false)
  }

  // Columna CWP de la planilla (la que escribe "Conectar a AWP") y la de avance.
  const cwpCol = useMemo(() => headers.find((h) => /cwp/i.test(h)), [headers.join('|')])
  const avanceCol = useMemo(() => headers.find((h) => /AVANCE/i.test(h)), [headers.join('|')])
  // Filtra la grilla a un CWP (o a "sin CWP" con code === '') y va a Elementos.
  function filterByCwp(code) {
    if (cwpCol) setColumnFilter(cwpCol, { type: 'values', values: [code] })
    setActiveTab('elements')
  }

  // Asigna el paquete `name` a las filas seleccionadas (crea la columna si falta).
  function groupIntoPackage(name) {
    const value = String(name || '').trim()
    if (!value) return
    const ids = [...selected]
    if (!ids.length) { flash('Selecciona elementos primero.'); return }
    if (!columns.some((c) => c.key === packageCol)) addColumn(packageCol)
    updateRecords(ids, { [packageCol]: value })
    setShowPackage(false)
    flash(`${ids.length} elemento(s) agrupados en el paquete “${value}”.`)
    logAction(`Agrupó ${ids.length} elemento(s) en el paquete “${value}”`)
  }

  // Borra un paquete: quita su valor a todas las filas que lo tienen (los
  // elementos se conservan, solo se desagrupan) y limpia el filtro si estaba puesto.
  function deletePackage(name) {
    const value = String(name || '').trim()
    if (!value) return
    const ids = rows.filter((r) => String(r[packageCol] ?? '').trim() === value).map((r) => r._id)
    if (!ids.length) return
    if (!window.confirm(`¿Eliminar el paquete “${value}”? Sus ${ids.length} elemento(s) se conservan, solo se desagrupan.`)) return
    updateRecords(ids, { [packageCol]: '' })
    removeFilter(packageCol)
    flash(`Paquete “${value}” eliminado (${ids.length} elemento(s) desagrupados).`)
    logAction(`Eliminó el paquete “${value}” (${ids.length} elementos)`)
  }

  // Estadísticas de la vista filtrada (para el panel de Estadísticas).
  const stats = useMemo(() => {
    const statusH = headers.find((h) => isStatusHeader(h))
    const costH = headers.find(isCostHeader)
    const weightH = headers.find(isWeightHeader)
    const byStatus = new Map()
    let cost = 0, weight = 0
    filtered.forEach((r) => {
      if (statusH) { const k = String(r[statusH] ?? '').trim() || '—'; byStatus.set(k, (byStatus.get(k) || 0) + 1) }
      if (costH) { const n = Number(r[costH]); if (!Number.isNaN(n)) cost += n }
      if (weightH) { const n = Number(r[weightH]); if (!Number.isNaN(n)) weight += n }
    })
    return { total: filtered.length, statusH, byStatus: [...byStatus.entries()].sort((a, b) => b[1] - a[1]), costH, cost, weightH, weight }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, headers.join('|')])

  const activeFilters = Object.entries(colFilters).filter(([, v]) => v)
  const editingRecord = editingId ? rows.find((r) => r._id === editingId) : null
  const headBg = 'bg-slate-100 dark:bg-ink-700'
  const cellStickyBg = (isSel) =>
    isSel ? 'bg-brand-50 dark:bg-ink-700' : 'bg-white group-hover:bg-slate-50 dark:bg-ink-800 dark:group-hover:bg-ink-700'

  // Primer ingreso sin caché local: mientras llega lo de la nube mostramos un
  // estado de carga en vez de datos viejos que después saltan.
  if (loading) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center border border-slate-200 bg-white dark:border-white/10 dark:bg-ink-800">
        <div className="flex flex-col items-center gap-3 text-slate-400 dark:text-slate-500">
          <Loader2 className="h-7 w-7 animate-spin text-brand-500 dark:text-accent" />
          <p className="text-sm font-medium">Cargando datos…</p>
        </div>
      </div>
    )
  }

  return (
    <div className={[
      'flex min-h-0 flex-1 flex-col border border-slate-200 bg-white dark:border-white/10',
      fullscreen
        ? 'fixed inset-0 z-[60] rounded-none dark:bg-ink-900'
        : 'rounded-lg rounded-tl-none dark:bg-ink-800/40',
    ].join(' ')}>
      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-slate-200 px-3 pt-2 dark:border-white/10">
        {[
          { id: 'elements', label: 'Elementos' },
          { id: 'awp', label: 'AWP' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={[
              'rounded-t-md px-4 py-2 text-sm font-medium transition',
              activeTab === t.id
                ? 'border-b-2 border-brand-600 text-brand-600 dark:border-accent dark:text-accent'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab !== 'elements' ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <AwpCoveragePanel cwps={awpCwps} rows={rows} cwpCol={cwpCol} avanceCol={avanceCol} onSelectCwp={filterByCwp} onImport={importCwps} />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 px-4 py-2">
            {/* Herramientas de tabla: en móvil se ocultan cuando estás en 3D (no aplican). */}
            <div className={`${viewMode === 'bim' ? 'hidden md:flex' : 'flex'} max-w-full items-center gap-0.5 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-white/10 dark:bg-ink-900/40`}>
              <ToolIcon icon={RotateCw} title="Refrescar / Reset vista" onClick={resetView} />
              <ToolIcon icon={Undo2} title="Deshacer (Ctrl+Z)" onClick={undo} disabled={!canUndo} />
              <ToolIcon icon={Redo2} title="Rehacer (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo} />
              <ToolIcon icon={Plus} title="Nuevo registro" onClick={newRecord} />
              <ToolIcon icon={Copy} title="Copiar filas (seleccionadas o filtradas)" onClick={copySelection} />
              <ToolIcon icon={Pencil} title="Editar la fila seleccionada" onClick={editSelected} />
              <ExportMenu onExport={handleExport} />
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={importFile} />
              <ToolIcon icon={Upload} title="Importar (CSV / Excel)" onClick={() => fileRef.current?.click()} />
              <ToolIcon icon={Share2} title={online ? 'Publicar para Navisworks (API en vivo)' : 'Sin conexión — publicar a Navisworks necesita internet'} onClick={publishForNavisworks} disabled={!online} />
              <ToolIcon icon={Columns3} title="Campos / columnas" active={showColumns} onClick={() => setShowColumns((v) => !v)} />
              <ToolIcon icon={PieChart} title="Estadísticas" active={showStats} onClick={() => setShowStats((v) => !v)} />
              <ToolIcon icon={History} title="Historial de la sesión" active={showHistory} onClick={() => setShowHistory((v) => !v)} />
              <ToolIcon icon={Rows3} title={compact ? 'Vista cómoda (filas más altas)' : 'Vista compacta (más filas en pantalla)'} active={compact} onClick={() => setDensity((d) => (d === 'compact' ? 'normal' : 'compact'))} />
              <ToolIcon icon={fullscreen ? Minimize2 : Maximize2} title={fullscreen ? 'Salir de pantalla completa (Esc)' : 'Pantalla completa'} active={fullscreen} onClick={() => setFullscreen((v) => !v)} />
            </div>

            {/* View mode toggle */}
            <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-white/10 dark:bg-ink-900/40">
              <ViewToggle active={viewMode === 'grid'} icon={List} label="Planilla" onClick={() => setViewMode('grid')} />
              <ViewToggle active={viewMode === 'bim'} icon={Box} label="3D" onClick={() => setViewMode('bim')} />
              <ViewToggle active={viewMode === 'split'} icon={Columns2} label="Dividido" onClick={() => setViewMode('split')} />
            </div>

            {/* Indicador de autoguardado en la base de datos + "Guardar ahora" */}
            <AutosaveBadge state={autosave} onRetry={autosaveToDb} />
            {pendingSave && (autosave.status === 'idle' || autosave.status === 'saved') && (
              <button
                onClick={flushAutosave}
                title="Guardar los cambios en la base de datos ahora, sin esperar"
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-50 dark:border-accent/40 dark:bg-ink-800 dark:text-accent dark:hover:bg-accent/10"
              >
                <Database className="h-3.5 w-3.5" /> Guardar ahora
              </button>
            )}

            {/* Móvil: botón para mostrar/ocultar los controles de la tabla. */}
            {viewMode !== 'bim' && (
              <button
                onClick={() => setMobileToolsOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 md:hidden dark:border-white/10 dark:bg-ink-800 dark:text-slate-300"
              >
                <Filter className="h-3.5 w-3.5" /> Filtros y orden {mobileToolsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            )}

            {/* Buscar + ordenar: en móvil se ocultan en vista 3D y se colapsan en Planilla. */}
            <div className={`${(viewMode === 'bim' || !mobileToolsOpen) ? 'hidden md:flex' : 'flex'} flex-wrap items-end gap-2`}>
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 dark:border-white/10 dark:bg-ink-800">
                <Search className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar… (Ctrl+F)"
                  className="w-40 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none dark:text-slate-200 dark:placeholder:text-slate-600"
                />
                {query && (
                  <button onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <Labeled label="Ordenar por">
                <Select value={sort.key ?? ''} onChange={(v) => setSort((s) => ({ key: v || null, dir: s.dir }))}>
                  <option value="">—</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>{h.replace(/_/g, ' ')}</option>
                  ))}
                </Select>
              </Labeled>
              <Labeled label="Orden">
                <Select value={sort.dir} onChange={(v) => setSort((s) => ({ ...s, dir: v }))}>
                  <option value="asc">Ascendente</option>
                  <option value="desc">Descendente</option>
                </Select>
              </Labeled>
            </div>
          </div>

          {/* Panel de estadísticas */}
          {showStats && (
            <div className="mx-4 mb-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-ink-900/40">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="flex items-center gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200"><PieChart className="h-4 w-4 text-brand-500" /> Estadísticas de la vista</h4>
                <button onClick={() => setShowStats(false)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-white p-3 dark:bg-ink-800"><p className="text-[11px] uppercase tracking-wide text-slate-400">Elementos</p><p className="text-xl font-bold tabular-nums text-slate-800 dark:text-white">{stats.total}</p></div>
                {stats.costH && <div className="rounded-lg bg-white p-3 dark:bg-ink-800"><p className="text-[11px] uppercase tracking-wide text-slate-400">{stats.costH.replace(/_/g, ' ')}</p><p className="text-xl font-bold tabular-nums text-slate-800 dark:text-white">{fmtCost(stats.cost)}</p></div>}
                {stats.weightH && <div className="rounded-lg bg-white p-3 dark:bg-ink-800"><p className="text-[11px] uppercase tracking-wide text-slate-400">{stats.weightH.replace(/_/g, ' ')}</p><p className="text-xl font-bold tabular-nums text-slate-800 dark:text-white">{fmtWeight(stats.weight)}</p></div>}
                <div className="rounded-lg bg-white p-3 dark:bg-ink-800"><p className="text-[11px] uppercase tracking-wide text-slate-400">Seleccionados</p><p className="text-xl font-bold tabular-nums text-brand-600 dark:text-accent">{selected.size}</p></div>
              </div>
              {stats.statusH && stats.byStatus.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1.5 text-[11px] uppercase tracking-wide text-slate-400">Por {stats.statusH.replace(/_/g, ' ')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {stats.byStatus.map(([k, n]) => (
                      <span key={k} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusStyles(k)}`}>{k} <b className="tabular-nums">{n}</b></span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Panel de historial de la sesión */}
          {showHistory && (
            <div className="mx-4 mb-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-ink-900/40">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="flex items-center gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200"><History className="h-4 w-4 text-brand-500" /> Historial de la sesión</h4>
                <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
              </div>
              {history.length === 0 ? (
                <p className="py-2 text-center text-xs text-slate-400">Aún no hay acciones registradas en esta sesión.</p>
              ) : (
                <ul className="max-h-56 space-y-1 overflow-y-auto">
                  {history.map((h, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-1.5 text-xs dark:bg-ink-800">
                      <span className="text-slate-700 dark:text-slate-200">{h.text}</span>
                      <span className="shrink-0 tabular-nums text-slate-400">{new Date(h.t).toLocaleTimeString('es-CL')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Column manager */}
          {showColumns && (
            <ColumnManager
              columns={columns}
              onToggle={toggleColumn}
              onRemove={removeColumn}
              onMove={moveColumn}
              newField={newField}
              setNewField={setNewField}
              onAdd={addField}
              dirty={dirty}
              onReset={reset}
              onClose={() => setShowColumns(false)}
              inputRef={newFieldRef}
            />
          )}

          {/* Filter row — en móvil se oculta en vista 3D y se colapsa en Planilla. */}
          <div className={`${(viewMode === 'bim' || !mobileToolsOpen) ? 'hidden md:flex' : 'flex'} flex-wrap items-end gap-3 px-4 pb-2`}>
            <Labeled label="Filtrar por">
              <Select value={filterByCol} onChange={setFilterByCol}>
                <option value="">— Elegir columna —</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h.replace(/_/g, ' ')}{colFilters[h] ? ' ●' : ''}</option>
                ))}
              </Select>
            </Labeled>
            {filterByCol && (
              <FilterPopover
                column={filterByCol}
                numeric={filterColIsNumeric}
                values={filterValues}
                current={colFilters[filterByCol]}
                onToggleValue={(v) => toggleFilterValue(filterByCol, v)}
                onSetRange={(min, max) => setColumnFilter(filterByCol, { type: 'range', min, max })}
                onClear={() => removeFilter(filterByCol)}
              />
            )}

            {/* Filtro de paquetes: si no hay ninguno, invita a crear el primero */}
            <Labeled label="Paquete">
              {existingPackages.length > 0 ? (
                <div className="flex items-center gap-1.5">
                  <Select
                    value={colFilters[packageCol]?.values?.length === 1 ? colFilters[packageCol].values[0] : ''}
                    onChange={(v) => (v ? setColumnFilter(packageCol, { type: 'values', values: [v] }) : removeFilter(packageCol))}
                  >
                    <option value="">Todos los paquetes</option>
                    {existingPackages.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </Select>
                  {colFilters[packageCol]?.values?.length === 1 && (
                    <button
                      onClick={() => deletePackage(colFilters[packageCol].values[0])}
                      title="Eliminar este paquete (desagrupa sus elementos)"
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-slate-200 text-slate-400 transition hover:border-rose-300 hover:text-rose-500 dark:border-white/10 dark:text-slate-500 dark:hover:border-rose-500/40 dark:hover:text-rose-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setShowConnectAwp(true)}
                  disabled={!online}
                  title={online ? 'Conectar los componentes seleccionados a un CWA/CWP de Aura AWP' : 'Sin conexión — conectar a AWP necesita internet'}
                  className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-brand-300 bg-white px-3 py-1.5 text-sm font-medium text-brand-600 transition hover:border-brand-400 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-brand-300 disabled:hover:bg-white dark:border-accent/40 dark:bg-ink-900 dark:text-accent dark:hover:bg-accent/10"
                >
                  <Link2 className="h-4 w-4" /> Conectar a AWP
                </button>
              )}
            </Labeled>

            <div className="ml-auto">
              <Labeled label="Cambio de propiedad">
                <Select value={propertyChange} onChange={setPropertyChange}>
                  <option value="">—</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>{h.replace(/_/g, ' ')}</option>
                  ))}
                </Select>
              </Labeled>
            </div>
          </div>

          {/* Update buttons */}
          <div className={`${(viewMode === 'bim' || !mobileToolsOpen) ? 'hidden md:flex' : 'flex'} flex-wrap gap-2 px-4 pb-2`}>
            <UpdateButton icon={Link2} disabled={selected.size === 0 || !online} title={!online ? 'Sin conexión — conectar a AWP necesita internet' : undefined} onClick={() => setShowConnectAwp(true)}>Conectar a AWP</UpdateButton>
          </div>

          {/* Active filter chips */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 px-4 pb-2">
              {activeFilters.map(([h, f]) => (
                <span key={h} className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-1 text-xs font-medium text-brand-700 dark:bg-accent/15 dark:text-accent">
                  {h.replace(/_/g, ' ')}: {describeFilter(f)}
                  <button onClick={() => removeFilter(h)} className="hover:text-brand-900 dark:hover:text-white">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <button onClick={() => setColFilters({})} className="text-xs font-medium text-slate-400 hover:text-rose-500">Limpiar filtros</button>
            </div>
          )}

          {/* Stats bar */}
          <div className="mx-4 mb-2 flex flex-wrap gap-x-8 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-1.5 text-[13px] font-medium text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
            <span>Total de elementos : <b className="tabular-nums text-brand-600 dark:text-accent">{rows.length}</b></span>
            <span>Total de elementos seleccionados : <b className="tabular-nums text-brand-600 dark:text-accent">{selected.size}</b></span>
            <span>Total de elementos eliminados : <b className="tabular-nums">0</b></span>
            {filtered.length !== rows.length && (
              <span className="text-slate-500 dark:text-slate-400">Mostrando : <b className="tabular-nums">{filtered.length}</b></span>
            )}
          </div>

          {/* Content: planilla / 3D / split */}
          <div className="mx-4 mb-4 flex min-h-0 flex-1 flex-col gap-3 md:flex-row">
            {(viewMode === 'grid' || viewMode === 'split') && (
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200 dark:border-white/10">
              <table className={`w-max table-fixed border-separate border-spacing-0 ${bodyText}`}>
                <colgroup>
                  <col style={{ width: CHECK_W }} />
                  {headers.map((h) => (
                    <col key={h} style={{ width: colWidths[h] ?? defaultWidth(h) }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th className={`sticky left-0 top-0 z-30 border-b border-slate-200 px-3 py-1.5 dark:border-white/10 ${headBg}`}>
                      <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} className="h-4 w-4 cursor-pointer accent-brand-500 dark:accent-accent" />
                    </th>
                    {headers.map((h, idx) => {
                      const filterActive = !!colFilters[h]
                      return (
                        <th
                          key={h}
                          draggable
                          onDragStart={() => setHdrDragKey(h)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => { if (hdrDragKey && hdrDragKey !== h) moveColumn(hdrDragKey, h); setHdrDragKey(null) }}
                          onDragEnd={() => setHdrDragKey(null)}
                          style={{ left: idx === 0 ? CHECK_W : undefined }}
                          className={[
                            `sticky top-0 border-b border-slate-200 px-3 py-1.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:text-slate-400 ${headBg}`,
                            // Todos los encabezados se fijan arriba al hacer scroll vertical.
                            // idx 0 (TAG) ademas se fija a la izquierda (esquina) y va por
                            // encima del resto; los demas solo se fijan arriba.
                            idx === 0 ? 'z-30' : 'z-20',
                            hdrDragKey === h ? 'opacity-40' : '',
                          ].join(' ')}
                        >
                          <div className="flex items-center gap-1.5 pr-2">
                            {isIdColumn(h) && <Lock className="h-3 w-3 shrink-0 text-slate-400 dark:text-slate-500" title="Columna llave, no editable" />}
                            <button onClick={() => setSortKey(h)} className="inline-flex min-w-0 items-center gap-1 truncate transition hover:text-brand-600 dark:hover:text-accent" title={h.replace(/_/g, ' ')}>
                              <span className="truncate">{h.replace(/_/g, ' ')}</span>
                              {sort.key === h ? (
                                sort.dir === 'asc' ? <ChevronUp className="h-3 w-3 shrink-0 text-brand-600 dark:text-accent" /> : <ChevronDown className="h-3 w-3 shrink-0 text-brand-600 dark:text-accent" />
                              ) : (
                                <ArrowUpDown className="h-3 w-3 shrink-0 text-slate-300 dark:text-slate-600" />
                              )}
                            </button>
                            <button
                              onClick={() => setFilterByCol(h)}
                              title="Filtrar por esta columna"
                              className={`shrink-0 ${filterActive ? 'text-brand-600 dark:text-accent' : 'text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400'}`}
                            >
                              <Filter className="h-3 w-3" fill={filterActive ? 'currentColor' : 'none'} />
                            </button>
                          </div>
                          <span onMouseDown={(e) => startResize(e, h)} className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none hover:bg-brand-400/60" />
                        </th>
                      )
                    })}
                    {/* Botón + para agregar columna directamente desde el encabezado */}
                    <th className={`sticky top-0 z-20 border-b border-slate-200 px-2 py-1.5 dark:border-white/10 ${headBg}`}>
                      <button
                        onClick={() => {
                          setShowColumns(true)
                          setTimeout(() => newFieldRef.current?.focus(), 50)
                        }}
                        title="Agregar columna"
                        className="grid h-6 w-6 place-items-center rounded-md border border-dashed border-slate-300 text-slate-400 transition hover:border-brand-400 hover:text-brand-600 dark:border-white/15 dark:hover:border-accent/50 dark:hover:text-accent"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {padTop > 0 && (
                    <tr aria-hidden><td colSpan={headers.length + 1} style={{ height: padTop }} className="p-0" /></tr>
                  )}
                  {virtualItems.map((vi) => {
                    const r = filtered[vi.index]
                    const isSel = selected.has(r._id)
                    const isActive = r._id === activeId
                    return (
                      <tr key={r._id} onClick={() => activate(r._id)} onDoubleClick={() => openFicha(r._id)} onContextMenu={(e) => openRowMenu(e, r._id)} title="Clic en una celda: editar · doble clic: abrir ficha · clic derecho: copiar/duplicar" className={['group cursor-pointer transition-colors', isActive ? 'bg-brand-100/70 dark:bg-accent/15' : isSel ? 'bg-brand-50/50 dark:bg-accent/5' : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]'].join(' ')}>
                        <td onClick={(e) => e.stopPropagation()} className={`sticky left-0 z-10 border-b border-slate-100 ${cellPad} dark:border-white/5 ${cellStickyBg(isSel)}`}>
                          <input type="checkbox" checked={isSel} onChange={() => toggleRow(r._id)} className="h-4 w-4 cursor-pointer accent-brand-500 dark:accent-accent" />
                        </td>
                        {headers.map((h, idx) => {
                          const editing = editingCell && editingCell.id === r._id && editingCell.key === h
                          const locked = isLockedCell(h, r[h])
                          return (
                          <td
                            key={h}
                            onClick={() => { if (isMobile) { openFicha(r._id); return } if (!editing && !locked) startInlineEdit(r._id, h, r[h]) }}
                            title={locked ? 'ID inmutable: es la llave de vínculo con el modelo 3D / plugin. Edita el TAG para la modularización.' : undefined}
                            style={{ left: idx === 0 ? CHECK_W : undefined }}
                            className={[
                              `overflow-hidden text-ellipsis whitespace-nowrap border-b border-slate-100 ${cellPad} dark:border-white/5`,
                              locked ? 'cursor-not-allowed' : '',
                              idx === 0
                                ? `sticky z-10 font-mono text-xs font-semibold text-slate-900 dark:text-white ${cellStickyBg(isSel)}`
                                : 'text-slate-600 dark:text-slate-300',
                            ].join(' ')}
                          >
                            {editing ? (
                              <input
                                autoFocus
                                value={cellDraft}
                                onChange={(e) => setCellDraft(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => {
                                  e.stopPropagation()
                                  if (e.key === 'Enter') { e.preventDefault(); commitAndMove(r._id, h, e.shiftKey ? -1 : 1, 0) }
                                  else if (e.key === 'Tab') { e.preventDefault(); commitAndMove(r._id, h, 0, e.shiftKey ? -1 : 1) }
                                  else if (e.key === 'Escape') { e.preventDefault(); cancelEditRef.current = true; e.currentTarget.blur() }
                                }}
                                onBlur={commitInlineEdit}
                                onPaste={(e) => handleCellPaste(e, r._id, h)}
                                className="w-full rounded border border-brand-400 bg-white px-1.5 py-1 text-xs text-slate-900 outline-none ring-2 ring-brand-100 dark:border-accent/50 dark:bg-ink-900 dark:text-slate-100 dark:ring-accent/20"
                              />
                            ) : (
                              renderCell(h, r[h])
                            )}
                          </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                  {padBottom > 0 && (
                    <tr aria-hidden><td colSpan={headers.length + 1} style={{ height: padBottom }} className="p-0" /></tr>
                  )}
                  {filtered.length === 0 && (
                    <tr><td colSpan={headers.length + 1} className="px-4 py-16 text-center text-sm text-slate-400 dark:text-slate-500">
                      {rows.length === 0
                        ? 'Planilla vacía. Ajusta las columnas con “Campos / columnas” y agrega registros con “Nuevo registro” (＋).'
                        : 'No se encontraron elementos con los filtros actuales.'}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            )}
            {(viewMode === 'bim' || viewMode === 'split') && (
            <div ref={viewerWrapRef} className="relative min-h-[280px] flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-ink-900">
              {/* Aviso: el visor 3D necesita internet (se transmite desde Autodesk). */}
              {!online && (
                <div className="absolute inset-x-0 top-0 z-20 flex items-start gap-2 bg-amber-50/95 px-3 py-2 text-xs font-medium text-amber-800 backdrop-blur dark:bg-amber-500/15 dark:text-amber-200">
                  <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Sin conexión — el visor 3D necesita internet para cargar el modelo. Las planillas sí funcionan sin conexión.</span>
                </div>
              )}
              <button
                onClick={toggleFullscreen}
                title={(isFullscreen || fullscreen) ? 'Salir de pantalla completa (Esc)' : 'Pantalla completa'}
                className="absolute bottom-3 right-3 z-20 grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white/90 text-slate-600 shadow backdrop-blur transition hover:text-brand-600 dark:border-white/10 dark:bg-ink-800/90 dark:text-slate-300 dark:hover:text-accent"
              >
                {(isFullscreen || fullscreen) ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
              <ViewerErrorBoundary>
                <Suspense fallback={<ViewerLoading />}>
                <ApsViewer
                  rows={filtered}
                  headers={headers}
                  selectedTag={activeId ? filtered.find((r) => r._id === activeId)?.[headers[0]] : null}
                  onSelect={handleApsSelect}
                  onEditRecord={(id, patch) => { updateRecord(id, patch); logAction('Editó un registro') }}
                  onEditRecords={(ids, patch) => { updateRecords(ids, patch); logAction(`Editó ${ids.length} registros`) }}
                  awpCwps={awpCwps}
                  onImportCwps={importCwps}
                  onConnectAwp={connectIdsToAwp}
                  dataKey={subcategory.dataKey}
                  isFiltered={activeFilters.length > 0 || query.trim() !== ''}
                  findTagAcross={findTagAcross}
                  onOpenSubcategory={onOpenSubcategory}
                />
                </Suspense>
              </ViewerErrorBoundary>
            </div>
            )}
          </div>
        </div>
      )}

      {editingRecord && (
        <RecordDrawer
          record={editingRecord}
          columns={columns}
          title={editingRecord[headers[0]]}
          onSave={saveRecord}
          onDelete={removeRecord}
          onClose={() => setEditingId(null)}
        />
      )}

      {/* Modal: agrupar elementos seleccionados en un paquete */}
      {showPackage && (
        <PackageModal
          count={selected.size}
          existing={existingPackages}
          onConfirm={groupIntoPackage}
          onClose={() => setShowPackage(false)}
        />
      )}

      {/* Modal: conectar componentes a un CWA/CWP de Aura AWP */}
      {showConnectAwp && (
        <ConnectAwpModal
          cwps={awpCwps}
          count={selected.size}
          onImport={importCwps}
          onClear={clearCwps}
          onConnect={connectToAwp}
          onClose={() => setShowConnectAwp(false)}
        />
      )}

      {/* Menú contextual de fila (clic derecho): copiar / pegar / duplicar */}
      {ctxMenu && (
        <RowContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          canPaste={true}
          onCopy={() => { copyRow(ctxMenu.rowId); setCtxMenu(null) }}
          onPaste={() => { pasteRow(ctxMenu.rowId); setCtxMenu(null) }}
          onDupAbove={() => { duplicateRow(ctxMenu.rowId, 'above'); setCtxMenu(null) }}
          onDupBelow={() => { duplicateRow(ctxMenu.rowId, 'below'); setCtxMenu(null) }}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {/* Modal de publicación a Navisworks: progreso con cronómetro y resultado claro */}
      {publish && (
        <PublishModal
          state={publish}
          elapsedMs={publishElapsed}
          apiBase={localStorage.getItem('sqy-api-url') || import.meta.env.VITE_APS_API || ''}
          onRetry={publishForNavisworks}
          onClose={() => setPublish(null)}
        />
      )}

      {/* Aviso efímero de acciones (copiar, importar, edición múltiple…) */}
      {toast && (
        <div className="pointer-events-none fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white shadow-lg ring-1 ring-black/10 dark:bg-white dark:text-ink-900">
          {toast}
        </div>
      )}
    </div>
  )
}

// Modal de publicación a Navisworks. Muestra el progreso con cronómetro en vivo
// y, al terminar, un resultado claro (elementos publicados, clave y tiempo) o el
// error. Reemplaza el toast pequeño para que la acción quede explícita.
function PublishModal({ state, elapsedMs, apiBase, onRetry, onClose }) {
  const publishing = state.status === 'publishing'
  const done = state.status === 'done'
  const error = state.status === 'error'
  const secs = ((publishing ? elapsedMs : state.ms || 0) / 1000).toFixed(1)
  const endpoint = `${apiBase || location.origin}/api/datasets/${state.key}`

  // Cerrar con Escape (solo cuando ya terminó; durante la publicación no).
  useEffect(() => {
    if (publishing) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [publishing, onClose])

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm dark:bg-black/60"
        onClick={() => { if (!publishing) onClose() }}
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-ink-800">
        {/* Cabecera con icono de estado */}
        <div className="flex flex-col items-center gap-3 px-6 pt-7 text-center">
          <div
            className={[
              'grid h-16 w-16 place-items-center rounded-2xl',
              publishing ? 'bg-brand-50 text-brand-500 dark:bg-accent/10 dark:text-accent' : '',
              done ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-400' : '',
              error ? 'bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:text-rose-400' : '',
            ].join(' ')}
          >
            {publishing && <Loader2 className="h-8 w-8 animate-spin" />}
            {done && <Check className="h-8 w-8" strokeWidth={2.5} />}
            {error && <TriangleAlert className="h-8 w-8" strokeWidth={2.2} />}
          </div>
          <div>
            <h3 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
              {publishing && 'Publicando para Navisworks…'}
              {done && '¡Publicado correctamente!'}
              {error && 'No se pudo publicar'}
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {publishing && `Enviando ${state.count.toLocaleString('es-CL')} elemento(s) al servidor para que el plugin Aura GIP los lea.`}
              {done && `El plugin de Navisworks (Aura GIP) ya puede leer esta planilla en vivo.`}
              {error && 'Revisa la conexión con el servidor e inténtalo de nuevo.'}
            </p>
          </div>
        </div>

        {/* Cronómetro grande */}
        <div className="mx-6 mt-5 flex items-center justify-center gap-2 rounded-xl bg-slate-50 py-3 dark:bg-white/5">
          <Clock className={['h-4 w-4', publishing ? 'text-brand-500 dark:text-accent' : 'text-slate-400'].join(' ')} />
          <span className="text-sm text-slate-500 dark:text-slate-400">{publishing ? 'Tiempo transcurrido' : 'Tardó'}</span>
          <span className="tabular-nums text-lg font-bold text-slate-800 dark:text-white">{secs} s</span>
        </div>

        {/* Detalle del resultado */}
        <div className="px-6 py-5">
          {publishing && (
            <p className="text-center text-xs text-slate-400 dark:text-slate-500">
              Para muchos elementos puede tardar varios segundos. No cierres esta ventana.
            </p>
          )}
          {done && (
            <dl className="space-y-2 text-sm">
              <Row label="Elementos publicados" value={state.count.toLocaleString('es-CL')} />
              <Row label="Clave (key)" value={state.key} mono />
              <Row label="Endpoint" value={endpoint} mono small />
            </dl>
          )}
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
              {state.error}
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4 dark:border-white/10">
          {publishing ? (
            <button disabled className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-400 dark:bg-white/5">
              <Loader2 className="h-4 w-4 animate-spin" /> Publicando…
            </button>
          ) : (
            <>
              {error && (
                <button onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/15 dark:bg-ink-800 dark:text-slate-200 dark:hover:bg-white/5">
                  <RotateCw className="h-4 w-4" /> Reintentar
                </button>
              )}
              <button onClick={onClose} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 dark:bg-accent dark:text-ink-900">
                {done ? 'Entendido' : 'Cerrar'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, mono, small }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className={['min-w-0 truncate text-right font-semibold text-slate-800 dark:text-slate-100', mono ? 'font-mono' : '', small ? 'text-xs' : ''].join(' ')} title={String(value)}>
        {value}
      </dd>
    </div>
  )
}

/* ---------------------------- subcomponentes ---------------------------- */

function renderCell(header, value) {
  if (value === '' || value == null) return <span className="text-slate-300 dark:text-slate-600">—</span>
  if (isStatusHeader(header)) return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ${statusStyles(value)}`}>{value}</span>
  if (isAwpHeader(header)) return <span className="inline-flex items-center rounded-md bg-brand-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-brand-700 dark:bg-accent/15 dark:text-accent">{value}</span>
  if (isCostHeader(header)) return <span className="tabular-nums text-emerald-600 dark:text-emerald-300">{fmtCost(value)}</span>
  if (isWeightHeader(header)) return <span className="tabular-nums">{fmtWeight(value)}</span>
  return String(value)
}

function ColumnManager({ columns, onToggle, onRemove, onMove, newField, setNewField, onAdd, dirty, onReset, onClose, inputRef }) {
  const [dragKey, setDragKey] = useState(null)
  return (
    <div className="mx-4 mb-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-ink-800">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-bold text-slate-800 dark:text-white">Campos / columnas <span className="ml-1 text-[11px] font-normal text-slate-400">— arrastra para reordenar</span></h4>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-4">
        {columns.map((c) => (
          <div
            key={c.key}
            draggable
            onDragStart={() => setDragKey(c.key)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (dragKey && dragKey !== c.key) onMove?.(dragKey, c.key); setDragKey(null) }}
            onDragEnd={() => setDragKey(null)}
            className={['flex items-center gap-1.5 rounded transition', dragKey === c.key ? 'opacity-40' : ''].join(' ')}
          >
            <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-slate-300 dark:text-slate-600" title="Arrastrar para reordenar" />
            <input type="checkbox" checked={c.visible} onChange={() => onToggle(c.key)} className="h-3.5 w-3.5 cursor-pointer accent-brand-500 dark:accent-accent" />
            <span className="min-w-0 flex-1 truncate text-xs text-slate-600 dark:text-slate-300" title={c.key}>{c.key.replace(/_/g, ' ')}</span>
            <button onClick={() => onRemove(c.key)} title="Quitar campo" className="text-slate-300 transition hover:text-rose-500 dark:text-slate-600"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 dark:border-white/10">
        <input
          ref={inputRef}
          value={newField}
          onChange={(e) => setNewField(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onAdd()}
          placeholder="Nuevo campo…"
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none dark:border-white/10 dark:bg-ink-900 dark:text-slate-200"
        />
        <button onClick={onAdd} disabled={!newField.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50 dark:bg-accent dark:text-ink-900">
          <Plus className="h-4 w-4" /> Agregar campo
        </button>
        {dirty && (
          <button onClick={onReset} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:text-rose-500 dark:border-white/15 dark:text-slate-300" title="Descartar cambios y restaurar datos originales">
            <RotateCcw className="h-4 w-4" /> Restablecer datos
          </button>
        )}
      </div>
    </div>
  )
}

function ToolIcon({ icon: IconCmp, title, onClick, active, disabled }) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={[
        'grid h-8 w-8 place-items-center rounded-md transition',
        disabled
          ? 'cursor-not-allowed text-slate-300 dark:text-slate-600'
          : active
            ? 'bg-brand-500 text-white dark:bg-accent dark:text-ink-900'
            : 'text-slate-500 hover:bg-white hover:text-brand-600 hover:shadow-sm dark:text-slate-400 dark:hover:bg-ink-700 dark:hover:text-accent',
      ].join(' ')}
    >
      <IconCmp className="h-4 w-4" />
    </button>
  )
}

// Menú contextual de fila (clic derecho): copiar, pegar y duplicar arriba/abajo.
// Se posiciona junto al cursor y se cierra al hacer clic fuera, hacer scroll o Escape.
function RowContextMenu({ x, y, canPaste, onCopy, onPaste, onDupAbove, onDupBelow, onClose }) {
  useEffect(() => {
    const close = () => onClose()
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  // Evita que el menú se salga de la pantalla por el borde derecho/inferior.
  const W = 208, H = 168
  const left = Math.min(x, window.innerWidth - W - 8)
  const top = Math.min(y, window.innerHeight - H - 8)

  const items = [
    { icon: Copy, label: 'Copiar fila', onClick: onCopy },
    { icon: ClipboardPaste, label: 'Pegar fila', onClick: onPaste, disabled: !canPaste },
    { sep: true },
    { icon: ArrowUpToLine, label: 'Duplicar fila arriba', onClick: onDupAbove },
    { icon: ArrowDownToLine, label: 'Duplicar fila abajo', onClick: onDupBelow },
  ]

  return (
    <>
      <div className="fixed inset-0 z-[70]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose() }} />
      <div
        style={{ left, top, width: W }}
        className="fixed z-[71] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl dark:border-white/10 dark:bg-ink-800"
      >
        {items.map((it, i) =>
          it.sep ? (
            <div key={i} className="my-1 border-t border-slate-100 dark:border-white/10" />
          ) : (
            <button
              key={i}
              onClick={it.onClick}
              disabled={it.disabled}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-700 dark:text-slate-200 dark:hover:bg-ink-700 dark:hover:text-accent"
            >
              <it.icon className="h-4 w-4 shrink-0" />
              {it.label}
            </button>
          ),
        )}
      </div>
    </>
  )
}

// Modal para agrupar las filas seleccionadas en un paquete: se escribe un nombre
// nuevo o se reutiliza uno existente. Confirmar asigna ese valor a la columna
// del paquete en todas las filas seleccionadas.
function PackageModal({ count, existing, onConfirm, onClose }) {
  const [name, setName] = useState('')
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const value = name.trim()
  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/40" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-[81] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-ink-800">
        <div className="mb-1 flex items-center gap-2">
          <Boxes className="h-5 w-5 text-brand-500 dark:text-accent" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Agrupar en paquete</h3>
        </div>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">{count} elemento(s) seleccionado(s).</p>

        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">Nombre del paquete</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && value) onConfirm(value) }}
          placeholder="p. ej. PQ-CUBIERTAS-01"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-400 focus:outline-none dark:border-white/10 dark:bg-ink-900 dark:text-slate-100"
        />

        {existing.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">O usar uno existente</p>
            <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
              {existing.map((p) => (
                <button
                  key={p}
                  onClick={() => setName(p)}
                  className={[
                    'rounded-full border px-2.5 py-1 text-xs font-medium transition',
                    name === p
                      ? 'border-brand-400 bg-brand-50 text-brand-700 dark:border-accent/40 dark:bg-accent/10 dark:text-accent'
                      : 'border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-600 dark:border-white/10 dark:text-slate-300 dark:hover:border-accent/40 dark:hover:text-accent',
                  ].join(' ')}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/5">Cancelar</button>
          <button
            onClick={() => onConfirm(value)}
            disabled={!value}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50 dark:bg-accent dark:text-ink-900 dark:hover:bg-accent-400"
          >
            <Boxes className="h-4 w-4" /> Agrupar
          </button>
        </div>
      </div>
    </>
  )
}

function ExportMenu({ onExport }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <ToolIcon icon={Download} title="Exportar" active={open} onClick={() => setOpen((o) => !o)} />
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-9 z-40 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-ink-800">
            {[
              { f: 'csv', label: 'Exportar CSV' },
              { f: 'xlsx', label: 'Exportar Excel (.xlsx)' },
            ].map((o) => (
              <button
                key={o.f}
                onClick={() => { onExport(o.f); setOpen(false) }}
                className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 hover:text-brand-600 dark:text-slate-200 dark:hover:bg-white/5 dark:hover:text-accent"
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ViewerLoading() {
  return (
    <div className="grid h-full place-items-center text-slate-400 dark:text-slate-500">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
        <span className="text-sm">Cargando visor 3D…</span>
      </div>
    </div>
  )
}

function ViewToggle({ active, icon: IconCmp, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition',
        active ? 'bg-brand-500 text-white dark:bg-accent dark:text-ink-900' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
      ].join(' ')}
    >
      <IconCmp className="h-4 w-4" />
      {label}
    </button>
  )
}

// Indicador de autoguardado en la base de datos. Informa el estado real de la
// persistencia: idle (activo, sin cambios), saving (subiendo), saved (con hora) o
// error (clic para reintentar). NO afirma "guardado en la DB" si no lo está.
function AutosaveBadge({ state, onRetry }) {
  const fmt = (t) => { try { return new Date(t).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) } catch { return '' } }
  const base = 'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium'
  if (state.status === 'saving') {
    return (
      <span title="Autoguardando los cambios en la base de datos…" className={`${base} border-brand-200 bg-brand-50 text-brand-700 dark:border-accent/30 dark:bg-accent/10 dark:text-accent`}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Guardando en la base de datos…
      </span>
    )
  }
  if (state.status === 'saved') {
    return (
      <span title={`Tus cambios se guardaron en la base de datos a las ${fmt(state.at)}`} className={`${base} border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400`}>
        <Database className="h-3.5 w-3.5" /> Guardado en la base de datos <Check className="h-3.5 w-3.5" />
      </span>
    )
  }
  if (state.status === 'offline') {
    return (
      <span title="Sin conexión. Tus cambios quedaron guardados en este equipo y se subirán solos al reconectar." className={`${base} border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400`}>
        <WifiOff className="h-3.5 w-3.5" /> Guardado en este equipo (sin conexión)
      </span>
    )
  }
  if (state.status === 'error') {
    return (
      <button onClick={onRetry} title={state.error || 'No se pudo guardar en la base de datos. Clic para reintentar.'} className={`${base} border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400`}>
        <TriangleAlert className="h-3.5 w-3.5" /> Sin guardar — reintentar
      </button>
    )
  }
  // idle: informa que el autoguardado está activo aunque todavía no haya cambios.
  return (
    <span title="Tus cambios se guardan automáticamente en la base de datos" className={`${base} border-slate-200 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-ink-900/40 dark:text-slate-400`}>
      <Database className="h-3.5 w-3.5" /> Autoguardado activo
    </span>
  )
}

// Texto corto para el chip de filtro activo.
function describeFilter(f) {
  if (!f) return ''
  if (f.type === 'range') {
    if (f.min != null && f.max != null) return `${f.min}–${f.max}`
    if (f.min != null) return `≥ ${f.min}`
    if (f.max != null) return `≤ ${f.max}`
    return ''
  }
  const v = f.values || []
  return v.length <= 2 ? v.join(', ') : `${v.length} valores`
}

// Popover de filtro por columna: multi-selección de valores con buscador y
// conteo, o rango (min/max) para columnas numéricas.
function FilterPopover({ column, numeric, values, current, onToggleValue, onSetRange, onClear }) {
  const [open, setOpen] = useState(true)
  const [q, setQ] = useState('')
  const sel = new Set(current?.values || [])
  const shown = q ? values.filter(([v]) => v.toLowerCase().includes(q.toLowerCase())) : values

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={['inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition', current ? 'border-brand-400 bg-brand-50 text-brand-700 dark:border-accent/40 dark:bg-accent/10 dark:text-accent' : 'border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-ink-800 dark:text-slate-300'].join(' ')}
      >
        <Filter className="h-4 w-4" />
        {current ? describeFilter(current) : 'Definir filtro'}
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <div className="absolute left-0 top-12 z-30 w-64 rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-white/10 dark:bg-ink-800">
          {numeric ? (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Rango de {column.replace(/_/g, ' ')}</p>
              <div className="flex items-center gap-2">
                <input type="number" placeholder="Mín" defaultValue={current?.min ?? ''} onChange={(e) => onSetRange(e.target.value === '' ? null : Number(e.target.value), current?.max ?? null)} className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-white/10 dark:bg-ink-900 dark:text-slate-200" />
                <span className="text-slate-400">–</span>
                <input type="number" placeholder="Máx" defaultValue={current?.max ?? ''} onChange={(e) => onSetRange(current?.min ?? null, e.target.value === '' ? null : Number(e.target.value))} className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-white/10 dark:bg-ink-900 dark:text-slate-200" />
              </div>
            </div>
          ) : (
            <>
              <div className="mb-2 flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1 dark:border-white/10">
                <Search className="h-3.5 w-3.5 text-slate-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar valor…" className="w-full bg-transparent text-sm focus:outline-none dark:text-slate-200" />
              </div>
              <div className="max-h-56 space-y-0.5 overflow-y-auto">
                {shown.map(([v, count]) => (
                  <label key={v} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-slate-100 dark:hover:bg-white/5">
                    <input type="checkbox" checked={sel.has(v)} onChange={() => onToggleValue(v)} className="h-3.5 w-3.5 accent-brand-500 dark:accent-accent" />
                    <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200" title={v}>{v}</span>
                    <span className="shrink-0 text-[10px] text-slate-400">{count}</span>
                  </label>
                ))}
                {shown.length === 0 && <p className="py-3 text-center text-xs text-slate-400">Sin coincidencias.</p>}
              </div>
            </>
          )}
          <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 dark:border-white/10">
            <button onClick={onClear} className="text-xs font-medium text-slate-400 hover:text-rose-500">Quitar</button>
            <button onClick={() => setOpen(false)} className="text-xs font-medium text-brand-600 dark:text-accent">Listo</button>
          </div>
        </div>
      )}
    </div>
  )
}

function Labeled({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</span>
      {children}
    </label>
  )
}

function Select({ value, onChange, children, disabled }) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="min-w-[150px] rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none disabled:opacity-50 dark:border-white/10 dark:bg-ink-900 dark:text-slate-200 dark:focus:border-accent/50"
    >
      {children}
    </select>
  )
}

function UpdateButton({ icon: IconCmp, children, disabled, onClick, title }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={[
        'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition',
        disabled
          ? 'cursor-not-allowed border border-slate-200 bg-white text-slate-300 dark:border-white/10 dark:bg-ink-800 dark:text-slate-600'
          : 'bg-brand-500 text-white shadow-sm hover:bg-brand-600 dark:bg-accent dark:text-ink-900 dark:shadow-glow dark:hover:bg-accent-400',
      ].join(' ')}
    >
      <IconCmp className="h-4 w-4" />
      {children}
    </button>
  )
}

function RelationshipPlaceholder({ kind, count }) {
  const title = kind === 'awp' ? 'Relación AWP (CWA / CWP / EWP / IWP)' : 'Relación de código de mercancía'
  const desc =
    kind === 'awp'
      ? 'Gestiona el empaquetamiento de trabajo (Advanced Work Packaging) de los elementos seleccionados: asignación a CWA, CWP, EWP e IWP.'
      : 'Asigna y normaliza el código de mercancía de los elementos seleccionados según el catálogo de materiales del proyecto.'
  return (
    <div className="grid flex-1 place-items-center p-10 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-accent/10 dark:text-accent">
          {kind === 'awp' ? <Link2 className="h-7 w-7" /> : <Tag className="h-7 w-7" />}
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-white">{title}</h3>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{desc}</p>
        <p className="mt-4 text-sm font-medium text-slate-600 dark:text-slate-300">
          {count > 0 ? `${count} elemento(s) seleccionado(s).` : 'Selecciona elementos para comenzar.'}
        </p>
      </div>
    </div>
  )
}
