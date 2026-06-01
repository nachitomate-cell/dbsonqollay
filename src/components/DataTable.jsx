import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  ArrowUpDown,
  Box,
  Boxes,
  ChevronDown,
  ChevronUp,
  Columns2,
  Columns3,
  Copy,
  Download,
  Filter,
  History,
  LayoutGrid,
  Link2,
  List,
  Maximize2,
  Minimize2,
  Loader2,
  Pencil,
  PieChart,
  Plus,
  RotateCcw,
  RotateCw,
  Search,
  Tag,
  Trash2,
  Upload,
  X,
} from 'lucide-react'

// El visor BIM 3D (y three.js) se cargan en un chunk aparte, solo al abrir la vista 3D.
const BimViewer = lazy(() => import('./BimViewer.jsx'))
const ApsViewer = lazy(() => import('./ApsViewer.jsx'))
import { useEditableDataset } from '../hooks/useEditableDataset.js'
import RecordDrawer from './RecordDrawer.jsx'
import ViewerErrorBoundary from './ViewerErrorBoundary.jsx'

/* ----------------------------- helpers ----------------------------- */

const isCostHeader = (h) => /COSTO/i.test(h)
const isWeightHeader = (h) => /PESO/i.test(h)
const isStatusHeader = (h) => /(ESTADO|APROB|AVANCE)/i.test(h)

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
  if (/^TAG/i.test(h)) return 150
  return 170
}

function formatValue(header, value) {
  if (value === '' || value == null) return null
  if (isCostHeader(header)) return fmtCost(value)
  if (isWeightHeader(header)) return fmtWeight(value)
  return String(value)
}

/* --------------------------- component ----------------------------- */

export default function DataTable({ dataset, subcategory, onBack }) {
  const { columns, rows, addColumn, removeColumn, toggleColumn, updateRecord, addRecord, deleteRecord, reset, dirty } =
    useEditableDataset(subcategory.dataKey, dataset)

  const visibleCols = columns.filter((c) => c.visible)
  const headers = visibleCols.map((c) => c.key)

  const [activeTab, setActiveTab] = useState('elements')
  const [viewMode, setViewMode] = useState('grid') // 'grid' (planilla) | 'cards' (fichas)
  const [engine, setEngine] = useState(() => localStorage.getItem('sqy-3d-engine') || 'three') // 'three' | 'aps'
  useEffect(() => { localStorage.setItem('sqy-3d-engine', engine) }, [engine])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [sort, setSort] = useState({ key: null, dir: 'asc' })
  const [colFilters, setColFilters] = useState({})
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
  const [editingId, setEditingId] = useState(null)
  const [activeId, setActiveId] = useState(null) // selección cruzada con el 3D

  const scrollRef = useRef(null)
  const viewerWrapRef = useRef(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Pantalla completa del contenedor del visor 3D (sirve para ambos motores).
  function toggleFullscreen() {
    const el = viewerWrapRef.current
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen?.()
    else el.requestFullscreen?.()
  }
  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !editingId && !/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) onBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack, editingId])

  // Persiste el ancho de columnas por dataset.
  useEffect(() => {
    try {
      localStorage.setItem(`sqy-w-${subcategory.dataKey}`, JSON.stringify(colWidths))
    } catch {
      /* ignore */
    }
  }, [colWidths, subcategory.dataKey])

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
    estimateSize: () => 41,
    overscan: 14,
  })
  const virtualItems = rowVirtualizer.getVirtualItems()
  const totalSize = rowVirtualizer.getTotalSize()
  const padTop = virtualItems.length ? virtualItems[0].start : 0
  const padBottom = virtualItems.length ? totalSize - virtualItems[virtualItems.length - 1].end : 0

  // Desplaza la planilla al elemento activo (selección cruzada desde el 3D).
  useEffect(() => {
    if (!activeId || (viewMode !== 'grid' && viewMode !== 'split')) return
    const idx = filtered.findIndex((r) => r._id === activeId)
    if (idx >= 0) rowVirtualizer.scrollToIndex(idx, { align: 'center' })
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
    setFilterByVal('')
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
    setActiveId(id)
    setEditingId(id)
  }

  // Handler estable para el visor APS (evita re-renders por nueva fn cada render).
  const filteredRef = useRef(filtered)
  filteredRef.current = filtered
  const handleApsSelect = useCallback((tag) => {
    const row = filteredRef.current.find((r) => String(r[headers[0]]) === String(tag))
    if (row) {
      setActiveId(row._id)
      setEditingId(row._id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers[0]])

  function newRecord() {
    const id = addRecord()
    openFicha(id)
  }
  function saveRecord(patch) {
    updateRecord(editingId, patch)
    setEditingId(null)
  }
  function removeRecord() {
    deleteRecord(editingId)
    setSelected((prev) => {
      const n = new Set(prev)
      n.delete(editingId)
      return n
    })
    setEditingId(null)
  }
  function addField() {
    addColumn(newField)
    setNewField('')
  }

  const activeFilters = Object.entries(colFilters).filter(([, v]) => v)
  const editingRecord = editingId ? rows.find((r) => r._id === editingId) : null
  const headBg = 'bg-slate-100 dark:bg-ink-700'
  const cellStickyBg = (isSel) =>
    isSel ? 'bg-brand-50 dark:bg-ink-700' : 'bg-white group-hover:bg-slate-50 dark:bg-ink-800 dark:group-hover:bg-ink-700'

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-lg rounded-tl-none border border-slate-200 bg-white dark:border-white/10 dark:bg-ink-800/40">
      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-slate-200 px-3 pt-2 dark:border-white/10">
        {[
          { id: 'elements', label: 'Elements' },
          { id: 'awp', label: 'AWP' },
          { id: 'commodity', label: 'Commodity Code' },
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
        <RelationshipPlaceholder kind={activeTab} count={selected.size} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-white/10 dark:bg-ink-900/40">
              <ToolIcon icon={RotateCw} title="Refrescar / Reset vista" onClick={resetView} />
              <ToolIcon icon={Plus} title="Nuevo registro" onClick={newRecord} />
              <ToolIcon icon={Copy} title="Copiar" />
              <ToolIcon icon={Pencil} title="Editar (clic en una fila)" />
              <ExportMenu onExport={handleExport} />
              <ToolIcon icon={Upload} title="Importar" />
              <ToolIcon icon={Columns3} title="Campos / columnas" active={showColumns} onClick={() => setShowColumns((v) => !v)} />
              <ToolIcon icon={PieChart} title="Estadísticas" />
              <ToolIcon icon={History} title="Historial" />
            </div>

            {/* View mode toggle */}
            <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-white/10 dark:bg-ink-900/40">
              <ViewToggle active={viewMode === 'grid'} icon={List} label="Planilla" onClick={() => setViewMode('grid')} />
              <ViewToggle active={viewMode === 'cards'} icon={LayoutGrid} label="Fichas" onClick={() => setViewMode('cards')} />
              <ViewToggle active={viewMode === 'bim'} icon={Box} label="3D" onClick={() => setViewMode('bim')} />
              <ViewToggle active={viewMode === 'split'} icon={Columns2} label="Split" onClick={() => setViewMode('split')} />
            </div>

            {/* Motor 3D: esquemático/glTF (sin backend) o APS (modelo real NWD/RVT/IFC) */}
            {(viewMode === 'bim' || viewMode === 'split') && (
              <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-white/10 dark:bg-ink-900/40">
                <ViewToggle active={engine === 'three'} icon={Box} label="3D propio" onClick={() => setEngine('three')} />
                <ViewToggle active={engine === 'aps'} icon={Boxes} label="APS (real)" onClick={() => setEngine('aps')} />
              </div>
            )}

            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 dark:border-white/10 dark:bg-ink-800">
              <Search className="h-4 w-4 text-slate-400 dark:text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                className="w-40 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none dark:text-slate-200 dark:placeholder:text-slate-600"
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <Labeled label="Order By">
              <Select value={sort.key ?? ''} onChange={(v) => setSort((s) => ({ key: v || null, dir: s.dir }))}>
                <option value="">—</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h.replace(/_/g, ' ')}</option>
                ))}
              </Select>
            </Labeled>
            <Labeled label="Sort">
              <Select value={sort.dir} onChange={(v) => setSort((s) => ({ ...s, dir: v }))}>
                <option value="asc">Ascendente</option>
                <option value="desc">Descendente</option>
              </Select>
            </Labeled>
          </div>

          {/* Column manager */}
          {showColumns && (
            <ColumnManager
              columns={columns}
              onToggle={toggleColumn}
              onRemove={removeColumn}
              newField={newField}
              setNewField={setNewField}
              onAdd={addField}
              dirty={dirty}
              onReset={reset}
              onClose={() => setShowColumns(false)}
            />
          )}

          {/* Filter row */}
          <div className="flex flex-wrap items-end gap-3 px-4 pb-3">
            <Labeled label="Filter By">
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
            <div className="ml-auto">
              <Labeled label="Property Change">
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
          <div className="flex flex-wrap gap-2 px-4 pb-3">
            <UpdateButton icon={Link2} disabled={selected.size === 0}>Update AWP Relationship</UpdateButton>
            <UpdateButton icon={Tag} disabled={selected.size === 0}>Update Commodity Code Relationship</UpdateButton>
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
          <div className="mx-4 mb-3 flex flex-wrap gap-x-8 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
            <span>Total Elements : <b className="tabular-nums text-brand-600 dark:text-accent">{rows.length}</b></span>
            <span>Total Elements Selected : <b className="tabular-nums text-brand-600 dark:text-accent">{selected.size}</b></span>
            <span>Total Elements Deleted : <b className="tabular-nums">0</b></span>
            {filtered.length !== rows.length && (
              <span className="text-slate-500 dark:text-slate-400">Mostrando : <b className="tabular-nums">{filtered.length}</b></span>
            )}
          </div>

          {/* Content: planilla / fichas / 3D / split */}
          {viewMode === 'cards' ? (
            <CardsView rows={filtered} headers={headers} selected={selected} onToggle={toggleRow} onOpen={openFicha} />
          ) : (
          <div className="mx-4 mb-4 flex min-h-0 flex-1 gap-3">
            {(viewMode === 'grid' || viewMode === 'split') && (
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200 dark:border-white/10">
              <table className="w-max table-fixed border-separate border-spacing-0 text-sm">
                <colgroup>
                  <col style={{ width: CHECK_W }} />
                  {headers.map((h) => (
                    <col key={h} style={{ width: colWidths[h] ?? defaultWidth(h) }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th className={`sticky left-0 top-0 z-30 border-b border-slate-200 px-3 py-2.5 dark:border-white/10 ${headBg}`}>
                      <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} className="h-4 w-4 cursor-pointer accent-brand-500 dark:accent-accent" />
                    </th>
                    {headers.map((h, idx) => {
                      const filterActive = !!colFilters[h]
                      return (
                        <th
                          key={h}
                          style={{ left: idx === 0 ? CHECK_W : undefined }}
                          className={[
                            `top-0 z-20 border-b border-slate-200 px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:text-slate-400 ${headBg}`,
                            idx === 0 ? 'sticky z-30' : 'relative',
                          ].join(' ')}
                        >
                          <div className="flex items-center gap-1.5 pr-2">
                            <button onClick={() => setSortKey(h)} className="inline-flex min-w-0 items-center gap-1 truncate transition hover:text-brand-600 dark:hover:text-accent" title={h.replace(/_/g, ' ')}>
                              <span className="truncate">{h.replace(/_/g, ' ')}</span>
                              {sort.key === h ? (
                                sort.dir === 'asc' ? <ChevronUp className="h-3 w-3 shrink-0 text-brand-600 dark:text-accent" /> : <ChevronDown className="h-3 w-3 shrink-0 text-brand-600 dark:text-accent" />
                              ) : (
                                <ArrowUpDown className="h-3 w-3 shrink-0 text-slate-300 dark:text-slate-600" />
                              )}
                            </button>
                            <button
                              onClick={() => { setFilterByCol(h); setFilterByVal('') }}
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
                      <tr key={r._id} onClick={() => activate(r._id)} onDoubleClick={() => openFicha(r._id)} title="Clic: seleccionar · doble clic: abrir ficha" className={['group cursor-pointer transition-colors', isActive ? 'bg-brand-100/70 dark:bg-accent/15' : isSel ? 'bg-brand-50/50 dark:bg-accent/5' : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]'].join(' ')}>
                        <td onClick={(e) => e.stopPropagation()} className={`sticky left-0 z-10 border-b border-slate-100 px-3 py-2.5 dark:border-white/5 ${cellStickyBg(isSel)}`}>
                          <input type="checkbox" checked={isSel} onChange={() => toggleRow(r._id)} className="h-4 w-4 cursor-pointer accent-brand-500 dark:accent-accent" />
                        </td>
                        {headers.map((h, idx) => (
                          <td
                            key={h}
                            style={{ left: idx === 0 ? CHECK_W : undefined }}
                            className={[
                              'overflow-hidden text-ellipsis whitespace-nowrap border-b border-slate-100 px-3 py-2.5 dark:border-white/5',
                              idx === 0
                                ? `sticky z-10 font-mono text-xs font-semibold text-slate-900 dark:text-white ${cellStickyBg(isSel)}`
                                : 'text-slate-600 dark:text-slate-300',
                            ].join(' ')}
                          >
                            {renderCell(h, r[h])}
                          </td>
                        ))}
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
            <div ref={viewerWrapRef} className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-ink-900">
              <button
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Salir de pantalla completa (Esc)' : 'Pantalla completa'}
                className="absolute bottom-3 right-3 z-20 grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white/90 text-slate-600 shadow backdrop-blur transition hover:text-brand-600 dark:border-white/10 dark:bg-ink-800/90 dark:text-slate-300 dark:hover:text-accent"
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
              <ViewerErrorBoundary>
                <Suspense fallback={<ViewerLoading />}>
                {engine === 'aps' ? (
                <ApsViewer
                  rows={filtered}
                  headers={headers}
                  selectedTag={activeId ? filtered.find((r) => r._id === activeId)?.[headers[0]] : null}
                  onSelect={handleApsSelect}
                  dataKey={subcategory.dataKey}
                />
              ) : (
                <BimViewer rows={filtered} headers={headers} selectedId={activeId} onFocus={activate} onSelect={openFicha} dataKey={subcategory.dataKey} onRequestApsEngine={() => setEngine('aps')} />
              )}
                </Suspense>
              </ViewerErrorBoundary>
            </div>
            )}
          </div>
          )}
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
    </div>
  )
}

/* ---------------------------- subcomponentes ---------------------------- */

function renderCell(header, value) {
  if (value === '' || value == null) return <span className="text-slate-300 dark:text-slate-600">—</span>
  if (isStatusHeader(header)) return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ${statusStyles(value)}`}>{value}</span>
  if (isCostHeader(header)) return <span className="tabular-nums text-emerald-600 dark:text-emerald-300">{fmtCost(value)}</span>
  if (isWeightHeader(header)) return <span className="tabular-nums">{fmtWeight(value)}</span>
  return String(value)
}

function CardsView({ rows, headers, selected, onToggle, onOpen }) {
  const cap = 300
  const shown = rows.slice(0, cap)
  const titleKey = headers[0]
  const fieldKeys = headers.slice(1, 6)
  return (
    <div className="mx-4 mb-4 min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200 p-3 dark:border-white/10">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((r) => {
          const isSel = selected.has(r._id)
          return (
            <button
              key={r._id}
              onClick={() => onOpen(r._id)}
              className={[
                'group relative rounded-xl border p-4 text-left transition hover:shadow-md',
                isSel ? 'border-brand-300 bg-brand-50/50 dark:border-accent/40 dark:bg-accent/5' : 'border-slate-200 bg-white dark:border-white/10 dark:bg-ink-800/60',
              ].join(' ')}
            >
              <span onClick={(e) => { e.stopPropagation(); onToggle(r._id) }} className="absolute right-3 top-3">
                <input type="checkbox" checked={isSel} readOnly className="h-4 w-4 cursor-pointer accent-brand-500 dark:accent-accent" />
              </span>
              <p className="mb-2 truncate pr-6 font-mono text-sm font-bold text-slate-900 dark:text-white">{r[titleKey] || '—'}</p>
              <dl className="space-y-1.5">
                {fieldKeys.map((k) => (
                  <div key={k} className="flex items-baseline justify-between gap-3 text-xs">
                    <dt className="shrink-0 font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{k.replace(/_/g, ' ')}</dt>
                    <dd className="min-w-0 truncate text-right text-slate-600 dark:text-slate-300">{formatValue(k, r[k]) ?? '—'}</dd>
                  </div>
                ))}
              </dl>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-600 opacity-0 transition group-hover:opacity-100 dark:text-accent">
                <Pencil className="h-3 w-3" /> Editar ficha
              </span>
            </button>
          )
        })}
      </div>
      {rows.length > cap && (
        <p className="mt-3 text-center text-xs text-slate-400 dark:text-slate-500">
          Mostrando {cap} de {rows.length}. Usa la búsqueda o filtros para acotar.
        </p>
      )}
    </div>
  )
}

function ColumnManager({ columns, onToggle, onRemove, newField, setNewField, onAdd, dirty, onReset, onClose }) {
  return (
    <div className="mx-4 mb-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-ink-800">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-bold text-slate-800 dark:text-white">Campos / columnas</h4>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-4">
        {columns.map((c) => (
          <div key={c.key} className="flex items-center gap-2">
            <input type="checkbox" checked={c.visible} onChange={() => onToggle(c.key)} className="h-3.5 w-3.5 cursor-pointer accent-brand-500 dark:accent-accent" />
            <span className="min-w-0 flex-1 truncate text-xs text-slate-600 dark:text-slate-300" title={c.key}>{c.key.replace(/_/g, ' ')}</span>
            <button onClick={() => onRemove(c.key)} title="Quitar campo" className="text-slate-300 transition hover:text-rose-500 dark:text-slate-600"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 dark:border-white/10">
        <input
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

function ToolIcon({ icon: IconCmp, title, onClick, active }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={[
        'grid h-8 w-8 place-items-center rounded-md transition',
        active
          ? 'bg-brand-500 text-white dark:bg-accent dark:text-ink-900'
          : 'text-slate-500 hover:bg-white hover:text-brand-600 hover:shadow-sm dark:text-slate-400 dark:hover:bg-ink-700 dark:hover:text-accent',
      ].join(' ')}
    >
      <IconCmp className="h-4 w-4" />
    </button>
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

function UpdateButton({ icon: IconCmp, children, disabled }) {
  return (
    <button
      disabled={disabled}
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
  const title = kind === 'awp' ? 'Relación AWP (CWA / CWP / EWP / IWP)' : 'Relación de Commodity Code'
  const desc =
    kind === 'awp'
      ? 'Gestiona el empaquetamiento de trabajo (Advanced Work Packaging) de los elementos seleccionados: asignación a CWA, CWP, EWP e IWP.'
      : 'Asigna y normaliza el código de commodity de los elementos seleccionados según el catálogo de materiales del proyecto.'
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
