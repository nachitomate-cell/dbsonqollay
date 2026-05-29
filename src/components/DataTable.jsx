import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Columns3,
  Copy,
  Download,
  Filter,
  History,
  Link2,
  List,
  Pencil,
  PieChart,
  Plus,
  RotateCw,
  Search,
  Tag,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import Icon from './Icon.jsx'

/* ----------------------------- helpers ----------------------------- */

const isCostHeader = (h) => /COSTO/i.test(h)
const isWeightHeader = (h) => /PESO/i.test(h)
const isStatusHeader = (h) => /(ESTADO|APROB|AVANCE)/i.test(h)

const fmtCost = (v) =>
  v === '' || v == null
    ? '—'
    : new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(v))

const fmtWeight = (v) =>
  v === '' || v == null ? '—' : `${new Intl.NumberFormat('es-CL').format(Number(v))} kg`

// Color de la píldora según estado de aprobación/avance.
const statusStyles = (val) => {
  const v = String(val).toUpperCase()
  if (v.includes('NO APROB') || v.includes('RECHAZ')) return 'bg-rose-500/15 text-rose-600 ring-rose-500/30 dark:text-rose-300'
  if (v.includes('APROB')) return 'bg-emerald-500/15 text-emerald-600 ring-emerald-500/30 dark:text-emerald-300'
  if (v.startsWith('E4')) return 'bg-emerald-500/15 text-emerald-600 ring-emerald-500/30 dark:text-emerald-300'
  if (v.startsWith('E3')) return 'bg-blue-500/15 text-blue-600 ring-blue-500/30 dark:bg-accent/15 dark:text-accent dark:ring-accent/30'
  if (v.startsWith('E2')) return 'bg-amber-500/15 text-amber-600 ring-amber-500/30 dark:text-amber-300'
  if (v.startsWith('E1')) return 'bg-rose-500/15 text-rose-600 ring-rose-500/30 dark:text-rose-300'
  return 'bg-slate-500/10 text-slate-500 ring-slate-400/20 dark:text-slate-400'
}

/* --------------------------- component ----------------------------- */

/**
 * Vista B — Grilla de datos de ingeniería (réplica de la plataforma de
 * referencia). Incluye:
 *  - enlace "Return To Engineering Element Selection" + chip del elemento
 *  - pestañas Elements / AWP / Commodity Code
 *  - barra de herramientas con búsqueda, Order By y Sort
 *  - fila Filter By / Value / Search + Property Change
 *  - botones Update AWP / Update Commodity Code Relationship
 *  - barra de totales (elementos / seleccionados / eliminados)
 *  - tabla dinámica con orden y filtro por columna, scroll y paneles fijos
 */
export default function DataTable({ dataset, subcategory, onBack }) {
  const headers = dataset?.headers ?? []
  const rows = dataset?.rows ?? []

  const [activeTab, setActiveTab] = useState('elements')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [sort, setSort] = useState({ key: null, dir: 'asc' })
  const [colFilters, setColFilters] = useState({})
  const [filterByCol, setFilterByCol] = useState('')
  const [filterByVal, setFilterByVal] = useState('')
  const [propertyChange, setPropertyChange] = useState(headers.includes('FACILITIES') ? 'FACILITIES' : headers[0] || '')

  // Esc vuelve a la selección de elementos (cuando el foco no está en un input).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) onBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack])

  const distinctValues = (h) => {
    const s = new Set()
    for (const r of rows) if (r[h] !== '' && r[h] != null) s.add(String(r[h]))
    return Array.from(s).sort()
  }
  const filterValues = useMemo(() => (filterByCol ? distinctValues(filterByCol) : []), [filterByCol, rows])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let data = rows.filter((r) => {
      for (const [h, val] of Object.entries(colFilters)) {
        if (val && String(r[h]) !== val) return false
      }
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
  }, [rows, headers, query, colFilters, sort])

  function rowKey(i) {
    return filtered[i]?.[headers[0]] ?? `row-${i}`
  }
  const allVisibleSelected = filtered.length > 0 && filtered.every((_, i) => selected.has(rowKey(i)))

  const toggleRow = (key) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  const toggleAll = () =>
    setSelected((prev) => {
      if (allVisibleSelected) return new Set()
      const next = new Set(prev)
      filtered.forEach((_, i) => next.add(rowKey(i)))
      return next
    })
  const setSortKey = (h) =>
    setSort((s) => (s.key === h ? { key: h, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: h, dir: 'asc' }))

  function applyFilter() {
    if (filterByCol && filterByVal) setColFilters((p) => ({ ...p, [filterByCol]: filterByVal }))
  }
  function removeFilter(h) {
    setColFilters((p) => {
      const n = { ...p }
      delete n[h]
      return n
    })
  }
  function resetAll() {
    setQuery('')
    setColFilters({})
    setSort({ key: null, dir: 'asc' })
    setFilterByCol('')
    setFilterByVal('')
  }

  const activeFilters = Object.entries(colFilters).filter(([, v]) => v)
  const headBg = 'bg-slate-100 dark:bg-ink-700'
  const cellStickyBg = (isSel) =>
    isSel ? 'bg-blue-50 dark:bg-ink-700' : 'bg-white group-hover:bg-slate-50 dark:bg-ink-800 dark:group-hover:bg-ink-700'

  return (
    <div className="flex h-full flex-col overflow-hidden px-6 pt-4">
      {/* Return link */}
      <button
        onClick={onBack}
        className="mx-auto mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 transition hover:underline dark:text-accent"
      >
        <ArrowLeft className="h-4 w-4" />
        Return To Engineering Element Selection.
      </button>

      {/* Element tab chip */}
      <div className="flex items-end gap-1">
        <div className="flex items-center gap-2 rounded-t-lg border border-b-0 border-slate-200 bg-white px-4 py-2.5 dark:border-white/10 dark:bg-ink-800">
          <Icon name={subcategory.icon} className="h-4 w-4 text-blue-600 dark:text-accent" />
          <span className="text-sm font-semibold text-slate-800 dark:text-white">{subcategory.name}</span>
          <button onClick={onBack} className="ml-1 grid h-4 w-4 place-items-center rounded-sm bg-rose-500 text-white transition hover:bg-rose-600" title="Cerrar">
            <X className="h-3 w-3" strokeWidth={3} />
          </button>
        </div>
      </div>

      {/* Card wrapper */}
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
                  ? 'border-b-2 border-blue-600 text-blue-600 dark:border-accent dark:text-accent'
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
                <ToolIcon icon={RotateCw} title="Refrescar / Reset" onClick={resetAll} />
                <ToolIcon icon={Plus} title="Agregar" />
                <ToolIcon icon={Tag} title="Etiquetar" />
                <ToolIcon icon={Copy} title="Copiar" />
                <ToolIcon icon={Pencil} title="Editar" />
                <ToolIcon icon={Trash2} title="Eliminar" />
                <ToolIcon icon={Download} title="Exportar" />
                <ToolIcon icon={Upload} title="Importar" />
                <ToolIcon icon={Columns3} title="Columnas" />
                <ToolIcon icon={PieChart} title="Estadísticas" />
                <ToolIcon icon={History} title="Historial" />
                <ToolIcon icon={List} title="Vista lista" />
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 dark:border-white/10 dark:bg-ink-800">
                <Search className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-44 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none dark:text-slate-200 dark:placeholder:text-slate-600"
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

            {/* Filter row */}
            <div className="flex flex-wrap items-end gap-3 px-4 pb-3">
              <Labeled label="Filter By">
                <Select
                  value={filterByCol}
                  onChange={(v) => {
                    setFilterByCol(v)
                    setFilterByVal('')
                  }}
                >
                  <option value="">—</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>{h.replace(/_/g, ' ')}</option>
                  ))}
                </Select>
              </Labeled>
              <Labeled label="Value">
                <Select value={filterByVal} onChange={setFilterByVal} disabled={!filterByCol}>
                  <option value="">—</option>
                  {filterValues.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </Select>
              </Labeled>
              <button
                onClick={applyFilter}
                disabled={!filterByCol || !filterByVal}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-accent dark:text-ink-900 dark:hover:bg-accent-400"
              >
                <Search className="h-4 w-4" />
                Search
              </button>

              <div className="ml-auto">
                <Labeled label="Property Change">
                  <Select value={propertyChange} onChange={setPropertyChange}>
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
                {activeFilters.map(([h, v]) => (
                  <span key={h} className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-accent/15 dark:text-accent">
                    {h.replace(/_/g, ' ')}: {v}
                    <button onClick={() => removeFilter(h)} className="hover:text-blue-900 dark:hover:text-white">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Stats bar */}
            <div className="mx-4 mb-3 flex flex-wrap gap-x-8 gap-y-1 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-900 dark:border-accent/30 dark:bg-accent/[0.07] dark:text-slate-200">
              <span>Total Elements : <b className="tabular-nums">{rows.length}</b></span>
              <span>Total Elements Selected : <b className="tabular-nums">{selected.size}</b></span>
              <span>Total Elements Deleted : <b className="tabular-nums">0</b></span>
              {filtered.length !== rows.length && (
                <span className="text-blue-700/70 dark:text-slate-400">Mostrando : <b className="tabular-nums">{filtered.length}</b></span>
              )}
            </div>

            {/* Data grid */}
            <div className="mx-4 mb-4 min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200 dark:border-white/10">
              <table className="min-w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    <th className={`sticky left-0 top-0 z-30 w-12 border-b border-slate-200 px-3 py-2.5 dark:border-white/10 ${headBg}`}>
                      <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} className="h-4 w-4 cursor-pointer accent-blue-600 dark:accent-accent" />
                    </th>
                    {headers.map((h, idx) => {
                      const filterActive = !!colFilters[h]
                      return (
                        <th
                          key={h}
                          className={[
                            `top-0 z-20 whitespace-nowrap border-b border-slate-200 px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:text-slate-400 ${headBg}`,
                            idx === 0 ? 'sticky left-12 z-30' : '',
                          ].join(' ')}
                        >
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => setSortKey(h)} className="inline-flex items-center gap-1 transition hover:text-blue-600 dark:hover:text-accent">
                              {h.replace(/_/g, ' ')}
                              {sort.key === h ? (
                                sort.dir === 'asc' ? <ChevronUp className="h-3 w-3 text-blue-600 dark:text-accent" /> : <ChevronDown className="h-3 w-3 text-blue-600 dark:text-accent" />
                              ) : (
                                <ArrowUpDown className="h-3 w-3 text-slate-300 dark:text-slate-600" />
                              )}
                            </button>
                            <button
                              onClick={() => {
                                setFilterByCol(h)
                                setFilterByVal('')
                              }}
                              title="Filtrar por esta columna"
                              className={filterActive ? 'text-blue-600 dark:text-accent' : 'text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400'}
                            >
                              <Filter className="h-3 w-3" fill={filterActive ? 'currentColor' : 'none'} />
                            </button>
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((rowData, i) => {
                    const key = rowKey(i)
                    const isSel = selected.has(key)
                    return (
                      <tr key={key} className={['group transition-colors', isSel ? 'bg-blue-50/50 dark:bg-accent/5' : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]'].join(' ')}>
                        <td className={`sticky left-0 z-10 border-b border-slate-100 px-3 py-2.5 dark:border-white/5 ${cellStickyBg(isSel)}`}>
                          <input type="checkbox" checked={isSel} onChange={() => toggleRow(key)} className="h-4 w-4 cursor-pointer accent-blue-600 dark:accent-accent" />
                        </td>
                        {headers.map((h, idx) => (
                          <td
                            key={h}
                            className={[
                              'whitespace-nowrap border-b border-slate-100 px-3 py-2.5 dark:border-white/5',
                              idx === 0
                                ? `sticky left-12 z-10 font-mono text-xs font-semibold text-slate-900 dark:text-white ${cellStickyBg(isSel)}`
                                : 'text-slate-600 dark:text-slate-300',
                            ].join(' ')}
                          >
                            {renderCell(h, rowData[h])}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={headers.length + 1} className="px-4 py-16 text-center text-sm text-slate-400 dark:text-slate-500">
                        No se encontraron elementos con los filtros actuales.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------------------------- subcomponentes ---------------------------- */

function renderCell(header, value) {
  if (value === '' || value == null) return <span className="text-slate-300 dark:text-slate-600">—</span>
  if (isStatusHeader(header)) {
    return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ${statusStyles(value)}`}>{value}</span>
  }
  if (isCostHeader(header)) return <span className="tabular-nums text-emerald-600 dark:text-emerald-300">{fmtCost(value)}</span>
  if (isWeightHeader(header)) return <span className="tabular-nums">{fmtWeight(value)}</span>
  return String(value)
}

function ToolIcon({ icon: IconCmp, title, onClick }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="grid h-8 w-8 place-items-center rounded-md text-slate-500 transition hover:bg-white hover:text-blue-600 hover:shadow-sm dark:text-slate-400 dark:hover:bg-ink-700 dark:hover:text-accent"
    >
      <IconCmp className="h-4 w-4" />
    </button>
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
      className="min-w-[150px] rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-blue-400 focus:outline-none disabled:opacity-50 dark:border-white/10 dark:bg-ink-900 dark:text-slate-200 dark:focus:border-accent/50"
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
          : 'bg-blue-600 text-white shadow-sm hover:bg-blue-500 dark:bg-accent dark:text-ink-900 dark:shadow-glow dark:hover:bg-accent-400',
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
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-accent/10 dark:text-accent">
          {kind === 'awp' ? <Link2 className="h-7 w-7" /> : <Tag className="h-7 w-7" />}
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-white">{title}</h3>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{desc}</p>
        <p className="mt-4 text-sm font-medium text-slate-600 dark:text-slate-300">
          {count > 0 ? `${count} elemento(s) seleccionado(s).` : 'Selecciona elementos en la pestaña Elements para comenzar.'}
        </p>
      </div>
    </div>
  )
}
