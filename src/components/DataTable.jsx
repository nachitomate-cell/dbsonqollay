import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Code2,
  Download,
  Filter,
  Link2,
  Search,
  X,
} from 'lucide-react'
import Icon from './Icon.jsx'

/* ----------------------------- helpers ----------------------------- */

const isCostHeader = (h) => /COSTO/i.test(h)
const isWeightHeader = (h) => /PESO/i.test(h)
const isStatusHeader = (h) => /(ESTADO|APROB)/i.test(h)

const fmtCost = (v) =>
  v === '' || v == null
    ? '—'
    : new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(v))

const fmtWeight = (v) =>
  v === '' || v == null ? '—' : `${new Intl.NumberFormat('es-CL').format(Number(v))} kg`

// Color de la píldora según estado de aprobación/avance (E1..E4).
const statusStyles = (val) => {
  const v = String(val).toUpperCase()
  if (v.startsWith('E4')) return 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30'
  if (v.startsWith('E3')) return 'bg-accent/15 text-accent ring-accent/30'
  if (v.startsWith('E2')) return 'bg-amber-500/15 text-amber-300 ring-amber-500/30'
  if (v.startsWith('E1')) return 'bg-rose-500/15 text-rose-300 ring-rose-500/30'
  return 'bg-white/5 text-slate-400 ring-white/10'
}

/* --------------------------- component ----------------------------- */

/**
 * Vista B — Grilla de datos de ingeniería.
 * Tabla dinámica que se adapta a las columnas del dataset activo, con:
 *  - búsqueda global
 *  - filtros por columna (auto-detectados sobre columnas categóricas)
 *  - ordenamiento por columna
 *  - selección con checkbox + acciones AWP / Commodity
 *  - scroll horizontal y vertical, encabezado y primera columna fijos (sticky)
 *
 * props:
 *  - dataset: { headers: string[], rows: object[] }
 *  - discipline, subcategory
 *  - onBack()
 */
export default function DataTable({ dataset, discipline, subcategory, onBack }) {
  const headers = dataset?.headers ?? []
  const rows = dataset?.rows ?? []

  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [sort, setSort] = useState({ key: null, dir: 'asc' })
  const [showFilters, setShowFilters] = useState(false)
  const [colFilters, setColFilters] = useState({}) // header -> value

  // Columnas categóricas: pocas opciones distintas → buen candidato para filtro.
  const categorical = useMemo(() => {
    const out = []
    for (const h of headers) {
      const distinct = new Set()
      for (const r of rows) {
        const v = r[h]
        if (v !== '' && v != null) distinct.add(String(v))
        if (distinct.size > 18) break
      }
      if (distinct.size > 1 && distinct.size <= 18) {
        out.push({ header: h, options: Array.from(distinct).sort() })
      }
    }
    return out.slice(0, 4)
  }, [headers, rows])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let data = rows.filter((r) => {
      // filtros por columna
      for (const [h, val] of Object.entries(colFilters)) {
        if (val && String(r[h]) !== val) return false
      }
      // búsqueda global
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
        if (numeric) return (an - bn) * dir
        return String(av ?? '').localeCompare(String(bv ?? ''), 'es') * dir
      })
    }
    return data
  }, [rows, headers, query, colFilters, sort])

  const activeFilterCount =
    Object.values(colFilters).filter(Boolean).length + (query.trim() ? 1 : 0)

  const allVisibleSelected = filtered.length > 0 && filtered.every((_, i) => selected.has(rowKey(i)))

  function rowKey(i) {
    // clave estable basada en TAG si existe, si no, índice del dataset
    const r = filtered[i]
    return r?.[headers[0]] ?? `row-${i}`
  }

  function toggleRow(key) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function toggleAll() {
    setSelected((prev) => {
      if (allVisibleSelected) return new Set()
      const next = new Set(prev)
      filtered.forEach((_, i) => next.add(rowKey(i)))
      return next
    })
  }

  function setSortKey(h) {
    setSort((s) => (s.key === h ? { key: h, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: h, dir: 'asc' }))
  }

  function clearFilters() {
    setColFilters({})
    setQuery('')
  }

  return (
    <div className="flex h-full flex-col">
      {/* Top bar: back + title */}
      <div className="flex items-center gap-3 px-6 pt-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm font-medium text-slate-300 transition hover:border-accent/40 hover:text-accent"
        >
          <ArrowLeft className="h-4 w-4" />
          Atrás
        </button>
        <div className="flex items-center gap-2">
          <Icon name={subcategory.icon} className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-bold text-white">{subcategory.name}</h2>
          <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs font-medium text-slate-400">
            {filtered.length} / {rows.length}
          </span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-6 py-4">
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-ink-800 px-3 py-2">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en todos los campos…"
            className="w-56 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-slate-500 hover:text-slate-300">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {categorical.length > 0 && (
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={[
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition',
              showFilters || activeFilterCount
                ? 'border-accent/40 bg-accent/10 text-accent'
                : 'border-white/10 bg-ink-800 text-slate-300 hover:text-accent',
            ].join(' ')}
          >
            <Filter className="h-4 w-4" />
            Filter by
            {activeFilterCount > 0 && (
              <span className="rounded bg-accent/20 px-1.5 text-[10px] font-bold text-accent">
                {activeFilterCount}
              </span>
            )}
            {showFilters ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        )}

        {activeFilterCount > 0 && (
          <button onClick={clearFilters} className="text-xs text-slate-500 hover:text-slate-300">
            Limpiar
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-xs text-slate-500 sm:inline">
            {selected.size} seleccionado{selected.size === 1 ? '' : 's'}
          </span>
          <ActionButton icon={Link2} disabled={selected.size === 0}>
            Update AWP Relationship
          </ActionButton>
          <ActionButton icon={Code2} disabled={selected.size === 0}>
            Update Commodity Code
          </ActionButton>
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm font-medium text-slate-300 transition hover:text-accent">
            <Download className="h-4 w-4" />
            <span className="hidden md:inline">Exportar</span>
          </button>
        </div>
      </div>

      {/* Column filter panel */}
      {showFilters && categorical.length > 0 && (
        <div className="mx-6 mb-3 flex flex-wrap gap-3 rounded-lg border border-white/10 bg-ink-800/60 p-4">
          {categorical.map(({ header, options }) => (
            <label key={header} className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {header.replace(/_/g, ' ')}
              </span>
              <select
                value={colFilters[header] ?? ''}
                onChange={(e) =>
                  setColFilters((p) => ({ ...p, [header]: e.target.value }))
                }
                className="min-w-[160px] rounded-md border border-white/10 bg-ink-900 px-2.5 py-1.5 text-sm text-slate-200 focus:border-accent/50 focus:outline-none"
              >
                <option value="">Todos</option>
                {options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}

      {/* Data grid */}
      <div className="mx-6 mb-6 flex-1 overflow-auto rounded-xl border border-white/10 bg-ink-800/40 shadow-card">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              {/* sticky checkbox col */}
              <th className="sticky left-0 top-0 z-30 w-12 border-b border-white/10 bg-ink-700 px-3 py-3">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 cursor-pointer accent-accent"
                />
              </th>
              {headers.map((h, idx) => (
                <th
                  key={h}
                  className={[
                    'top-0 z-20 whitespace-nowrap border-b border-white/10 bg-ink-700 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400',
                    idx === 0 ? 'sticky left-12 z-30' : '',
                  ].join(' ')}
                >
                  <button
                    onClick={() => setSortKey(h)}
                    className="inline-flex items-center gap-1.5 transition hover:text-accent"
                  >
                    {h.replace(/_/g, ' ')}
                    {sort.key === h ? (
                      sort.dir === 'asc' ? (
                        <ChevronUp className="h-3 w-3 text-accent" />
                      ) : (
                        <ChevronDown className="h-3 w-3 text-accent" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-slate-600" />
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => {
              const key = rowKey(i)
              const isSel = selected.has(key)
              return (
                <tr
                  key={key}
                  className={['group transition-colors', isSel ? 'bg-accent/5' : 'hover:bg-white/[0.03]'].join(' ')}
                >
                  <td
                    className={[
                      'sticky left-0 z-10 border-b border-white/5 px-3 py-2.5',
                      isSel ? 'bg-ink-700' : 'bg-ink-800 group-hover:bg-ink-700',
                    ].join(' ')}
                  >
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => toggleRow(key)}
                      className="h-4 w-4 cursor-pointer accent-accent"
                    />
                  </td>
                  {headers.map((h, idx) => (
                    <td
                      key={h}
                      className={[
                        'whitespace-nowrap border-b border-white/5 px-4 py-2.5',
                        idx === 0
                          ? `sticky left-12 z-10 font-mono text-xs font-semibold text-white ${isSel ? 'bg-ink-700' : 'bg-ink-800 group-hover:bg-ink-700'}`
                          : 'text-slate-300',
                      ].join(' ')}
                    >
                      {renderCell(h, row[h])}
                    </td>
                  ))}
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={headers.length + 1} className="px-4 py-16 text-center text-sm text-slate-500">
                  No se encontraron elementos con los filtros actuales.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function renderCell(header, value) {
  if (value === '' || value == null) return <span className="text-slate-600">—</span>
  if (isStatusHeader(header)) {
    return (
      <span
        className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ${statusStyles(value)}`}
      >
        {value}
      </span>
    )
  }
  if (isCostHeader(header)) return <span className="tabular-nums text-emerald-300">{fmtCost(value)}</span>
  if (isWeightHeader(header)) return <span className="tabular-nums">{fmtWeight(value)}</span>
  return String(value)
}

function ActionButton({ icon: IconCmp, children, disabled }) {
  return (
    <button
      disabled={disabled}
      className={[
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition',
        disabled
          ? 'cursor-not-allowed border border-white/10 bg-ink-800 text-slate-600'
          : 'bg-accent text-ink-900 shadow-glow hover:bg-accent-400',
      ].join(' ')}
    >
      <IconCmp className="h-4 w-4" />
      <span className="hidden lg:inline">{children}</span>
    </button>
  )
}
