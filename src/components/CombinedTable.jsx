import { useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowUpDown, Check, Columns3, ChevronDown, ChevronUp, Download, ExternalLink, FileSpreadsheet, Search, X } from 'lucide-react'

// Columnas clave siempre disponibles para el atajo "Solo claves".
const KEY_COLS = ['TAG', 'DISCIPLINA', 'PLANILLA']

/**
 * Tabla COMBINADA de todo el proyecto (solo lectura): todas las filas de todas
 * las planillas con datos, unificadas con columnas TAG / DISCIPLINA / PLANILLA.
 * Permite buscar en TODO el contenido, ordenar por cualquier columna y exportar
 * lo que se ve a CSV/Excel. El filtro por disciplina ya viene aplicado aguas
 * arriba (chips de "Todas las disciplinas"), así que aquí solo sumamos texto +
 * orden. Cada fila puede abrir su planilla de origen.
 *
 * props:
 *  - headers: ['TAG', 'DISCIPLINA', 'PLANILLA', ...resto]
 *  - rows:    filas combinadas (cada una con _id, _subId, _dataKey, TAG, …)
 *  - onOpenRowSheet(subId): abre la planilla de origen de una fila (opcional)
 */
const CHECK = 0
const colWidth = (h) => (h === 'TAG' ? 200 : h === 'DISCIPLINA' || h === 'PLANILLA' ? 180 : 160)

export default function CombinedTable({ headers = [], rows = [], onOpenRowSheet }) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState({ key: null, dir: 'asc' })
  const scrollRef = useRef(null)

  // Columnas ocultas (selector de columnas), persistidas entre sesiones. Las que
  // ya no existan en el dataset actual simplemente se ignoran.
  const [hidden, setHidden] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('sqy-combined-hidden') || '[]')) } catch { return new Set() }
  })
  useEffect(() => {
    try { localStorage.setItem('sqy-combined-hidden', JSON.stringify([...hidden])) } catch { /* cuota */ }
  }, [hidden])
  const visibleHeaders = useMemo(() => headers.filter((h) => !hidden.has(h)), [headers, hidden])
  const [colMenu, setColMenu] = useState(false)
  const [colQuery, setColQuery] = useState('')
  // Oculta/muestra una columna; si se oculta la que ordena, se quita el orden.
  function toggleCol(h) {
    setHidden((s) => { const n = new Set(s); n.has(h) ? n.delete(h) : n.add(h); return n })
    setSort((s) => (s.key === h ? { key: null, dir: 'asc' } : s))
  }

  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => {
    let data = q
      ? rows.filter((r) => visibleHeaders.some((h) => String(r[h] ?? '').toLowerCase().includes(q)))
      : rows
    if (sort.key) {
      const dir = sort.dir === 'asc' ? 1 : -1
      data = [...data].sort((a, b) => {
        const av = a[sort.key] ?? '', bv = b[sort.key] ?? ''
        const an = parseFloat(av), bn = parseFloat(bv)
        const bothNum = !isNaN(an) && !isNaN(bn) && String(av).trim() !== '' && String(bv).trim() !== ''
        if (bothNum) return (an - bn) * dir
        return String(av).localeCompare(String(bv), 'es', { numeric: true }) * dir
      })
    }
    return data
  }, [rows, visibleHeaders, q, sort])

  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 38,
    overscan: 16,
  })
  const virtualItems = rowVirtualizer.getVirtualItems()
  const totalSize = rowVirtualizer.getTotalSize()
  const padTop = virtualItems.length ? virtualItems[0].start : 0
  const padBottom = virtualItems.length ? totalSize - virtualItems[virtualItems.length - 1].end : 0

  function toggleSort(h) {
    setSort((s) => (s.key !== h ? { key: h, dir: 'asc' } : s.dir === 'asc' ? { key: h, dir: 'desc' } : { key: null, dir: 'asc' }))
  }

  // Exporta lo que se ve (filas filtradas + columnas VISIBLES) a CSV o Excel.
  async function handleExport(format) {
    const cols = visibleHeaders
    const data = filtered
    const base = 'Proyecto_Combinado'
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
      XLSX.utils.book_append_sheet(wb, ws, 'Combinado')
      XLSX.writeFile(wb, `${base}.xlsx`)
    }
  }

  const totalW = visibleHeaders.reduce((sum, h) => sum + colWidth(h), CHECK) + (onOpenRowSheet ? 44 : 0)

  return (
    <div className="flex h-[72vh] min-h-[460px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-ink-900">
      {/* Barra: búsqueda global + conteo + export */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-white/10">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 dark:border-white/10 dark:bg-ink-800">
          <Search className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en todo el proyecto (TAG, valor, planilla…)"
            className="w-72 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none dark:text-slate-200 dark:placeholder:text-slate-600"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-600"><X className="h-3.5 w-3.5" /></button>
          )}
        </div>

        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          <span className="tabular-nums font-bold text-slate-700 dark:text-slate-200">{filtered.length.toLocaleString('es-CL')}</span>
          {q && <> de {rows.length.toLocaleString('es-CL')}</>} elemento{filtered.length === 1 ? '' : 's'}
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Selector de columnas */}
          <div className="relative">
            <button
              onClick={() => { setColMenu((v) => !v); setColQuery('') }}
              title="Mostrar u ocultar columnas"
              className={['inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition', hidden.size ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-accent/40 dark:bg-accent/10 dark:text-accent' : 'border-slate-200 bg-white text-slate-600 hover:text-brand-600 dark:border-white/10 dark:bg-ink-800 dark:text-slate-300 dark:hover:text-accent'].join(' ')}
            >
              <Columns3 className="h-3.5 w-3.5" /> Columnas
              <span className="rounded bg-slate-100 px-1 text-[10px] tabular-nums text-slate-500 dark:bg-white/10 dark:text-slate-400">{visibleHeaders.length}/{headers.length}</span>
            </button>
            {colMenu && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setColMenu(false)} />
                <div className="absolute right-0 top-10 z-30 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-white/10 dark:bg-ink-800">
                  <div className="mb-2 flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1 dark:border-white/10">
                    <Search className="h-3.5 w-3.5 text-slate-400" />
                    <input value={colQuery} onChange={(e) => setColQuery(e.target.value)} placeholder="Buscar columna…" className="w-full bg-transparent text-xs focus:outline-none dark:text-slate-200" />
                  </div>
                  <div className="max-h-64 space-y-0.5 overflow-y-auto">
                    {headers
                      .filter((h) => !colQuery || h.toLowerCase().includes(colQuery.toLowerCase()))
                      .map((h) => (
                        <label key={h} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-slate-100 dark:hover:bg-white/5">
                          <input type="checkbox" checked={!hidden.has(h)} onChange={() => toggleCol(h)} className="h-3.5 w-3.5 accent-brand-500 dark:accent-accent" />
                          <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200" title={h}>{h.replace(/_/g, ' ')}</span>
                        </label>
                      ))}
                  </div>
                  <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 dark:border-white/10">
                    <button onClick={() => setHidden(new Set())} className="text-[11px] font-medium text-brand-600 dark:text-accent">Todas</button>
                    <button onClick={() => setHidden(new Set(headers.filter((h) => !KEY_COLS.includes(h))))} className="text-[11px] font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">Solo claves</button>
                  </div>
                </div>
              </>
            )}
          </div>
          <button onClick={() => handleExport('csv')} title="Exportar a CSV" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:text-brand-600 dark:border-white/10 dark:bg-ink-800 dark:text-slate-300 dark:hover:text-accent">
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
          <button onClick={() => handleExport('xlsx')} title="Exportar a Excel" className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-600 dark:bg-accent dark:text-ink-900">
            <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
          </button>
        </div>
      </div>

      {/* Grilla virtualizada */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
        {visibleHeaders.length === 0 ? (
          <div className="grid h-full place-items-center px-6 text-center text-sm text-slate-400 dark:text-slate-500">
            Todas las columnas están ocultas. Usa “Columnas” → “Todas” para mostrarlas.
          </div>
        ) : filtered.length === 0 ? (
          <div className="grid h-full place-items-center px-6 text-center text-sm text-slate-400 dark:text-slate-500">
            {rows.length === 0 ? 'No hay planillas con datos en las disciplinas seleccionadas.' : 'Ningún elemento coincide con la búsqueda.'}
          </div>
        ) : (
          <table className="border-separate border-spacing-0 text-sm" style={{ minWidth: totalW }}>
            <thead>
              <tr>
                {visibleHeaders.map((h, idx) => {
                  const active = sort.key === h
                  return (
                    <th
                      key={h}
                      style={{ width: colWidth(h), left: idx === 0 ? 0 : undefined }}
                      className={[
                        'sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-left dark:border-white/10 dark:bg-ink-800',
                        idx === 0 ? 'z-30' : '',
                      ].join(' ')}
                    >
                      <button onClick={() => toggleSort(h)} className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-slate-500 transition hover:text-brand-600 dark:text-slate-400 dark:hover:text-accent">
                        <span className="truncate">{h.replace(/_/g, ' ')}</span>
                        {active ? (sort.dir === 'asc' ? <ChevronUp className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />) : <ArrowUpDown className="h-3 w-3 shrink-0 text-slate-300 dark:text-slate-600" />}
                      </button>
                    </th>
                  )
                })}
                {onOpenRowSheet && <th className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-2 py-2.5 dark:border-white/10 dark:bg-ink-800" />}
              </tr>
            </thead>
            <tbody>
              {padTop > 0 && <tr aria-hidden><td colSpan={visibleHeaders.length + (onOpenRowSheet ? 1 : 0)} style={{ height: padTop }} className="p-0" /></tr>}
              {virtualItems.map((vi) => {
                const r = filtered[vi.index]
                return (
                  <tr key={r._id} className="group transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                    {visibleHeaders.map((h, idx) => (
                      <td
                        key={h}
                        style={{ left: idx === 0 ? 0 : undefined }}
                        className={[
                          'overflow-hidden text-ellipsis whitespace-nowrap border-b border-slate-100 px-3 py-2 dark:border-white/5',
                          idx === 0
                            ? 'sticky z-10 bg-white font-mono text-xs font-semibold text-slate-900 group-hover:bg-slate-50 dark:bg-ink-900 dark:text-white dark:group-hover:bg-ink-800'
                            : h === 'DISCIPLINA' || h === 'PLANILLA'
                              ? 'text-slate-500 dark:text-slate-400'
                              : 'text-slate-600 dark:text-slate-300',
                        ].join(' ')}
                        title={String(r[h] ?? '')}
                      >
                        {h === 'DISCIPLINA' || h === 'PLANILLA'
                          ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] dark:bg-white/10">{r[h]}</span>
                          : r[h]}
                      </td>
                    ))}
                    {onOpenRowSheet && (
                      <td className="border-b border-slate-100 px-2 py-2 dark:border-white/5">
                        <button
                          onClick={() => r._subId && onOpenRowSheet(r._subId)}
                          title={`Abrir la planilla “${r.PLANILLA}”`}
                          className="grid h-7 w-7 place-items-center rounded-md text-slate-300 opacity-0 transition hover:text-brand-600 group-hover:opacity-100 dark:text-slate-600 dark:hover:text-accent"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
              {padBottom > 0 && <tr aria-hidden><td colSpan={visibleHeaders.length + (onOpenRowSheet ? 1 : 0)} style={{ height: padBottom }} className="p-0" /></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
