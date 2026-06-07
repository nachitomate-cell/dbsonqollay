import { useMemo, useRef, useState } from 'react'
import { Boxes, Database, Layers, Link2, Loader2, Sigma, TriangleAlert, Upload } from 'lucide-react'

/**
 * Pestaña AWP: cobertura de paquetización de la planilla. Por cada CWP (del CSV
 * importado y/o asignado en las filas) muestra cuántos componentes tiene
 * asignados y sus HH; resalta los componentes SIN CWP. Clic en un CWP → filtra
 * la grilla a ese CWP.
 *
 * props: cwps, rows, cwpCol, onSelectCwp(code|''), onImport(file)
 */
export default function AwpCoveragePanel({ cwps = [], rows = [], cwpCol, onSelectCwp, onImport }) {
  const fileRef = useRef(null)
  const [importing, setImporting] = useState(false)

  const stats = useMemo(() => {
    const byCode = new Map()
    let noCwp = 0
    for (const r of rows) {
      const v = cwpCol ? String(r[cwpCol] ?? '').trim() : ''
      if (!v) { noCwp++; continue }
      byCode.set(v, (byCode.get(v) || 0) + 1)
    }
    return { byCode, noCwp, total: rows.length, assigned: rows.length - noCwp }
  }, [rows, cwpCol])

  // CWPs importados + los que aparecen en filas pero no están en el CSV.
  const groups = useMemo(() => {
    const m = new Map()
    for (const c of cwps) m.set(c.codigo, { ...c, count: stats.byCode.get(c.codigo) || 0 })
    for (const [code, count] of stats.byCode) if (!m.has(code)) m.set(code, { codigo: code, cwa: '', nombre: '(no está en el CSV)', hh: '', count })
    const g = new Map()
    for (const c of m.values()) { const k = c.cwa || '—'; if (!g.has(k)) g.set(k, []); g.get(k).push(c) }
    return [...g.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'es'))
      .map(([cwa, items]) => [cwa, items.sort((a, b) => a.codigo.localeCompare(b.codigo, 'es'))])
  }, [cwps, stats])

  async function pick(file) {
    if (!file || !onImport) return
    setImporting(true)
    try { await onImport(file) } finally { setImporting(false) }
  }

  const usedCwps = stats.byCode.size

  if (!cwps.length && stats.assigned === 0) {
    return (
      <div className="grid h-full place-items-center px-6">
        <div className="max-w-md rounded-2xl border border-dashed border-slate-300 bg-white px-8 py-12 text-center dark:border-white/15 dark:bg-ink-800/50">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-glow"><Link2 className="h-7 w-7" /></div>
          <h2 className="text-base font-bold text-slate-800 dark:text-white">Conecta esta disciplina a AWP</h2>
          <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            Importa el CSV de CWPs exportado de Aura AWP para ver la cobertura de paquetización y conectar tus componentes.
          </p>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; pick(f); e.target.value = '' }} />
          <button onClick={() => fileRef.current?.click()} disabled={importing} className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-60 dark:bg-accent dark:text-ink-900">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Importar CSV de CWPs
          </button>
        </div>
      </div>
    )
  }

  const pct = stats.total ? Math.round((stats.assigned / stats.total) * 100) : 0

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-5">
      {/* Resumen */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={Sigma} label="Componentes" value={stats.total.toLocaleString('es-CL')} />
        <Stat icon={Database} label="Con CWP" value={stats.assigned.toLocaleString('es-CL')} sub={`${pct}%`} tone="ok" />
        <Stat icon={TriangleAlert} label="Sin CWP" value={stats.noCwp.toLocaleString('es-CL')} tone={stats.noCwp ? 'bad' : 'ok'} onClick={stats.noCwp ? () => onSelectCwp?.('') : null} />
        <Stat icon={Boxes} label="CWPs usados" value={usedCwps.toLocaleString('es-CL')} sub={cwps.length ? `de ${cwps.length}` : null} />
      </div>

      {/* Barra de cobertura */}
      <div className="mb-5 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-500 transition-all" style={{ width: `${pct}%` }} />
      </div>

      {/* Listado por CWA */}
      <div className="space-y-5">
        {groups.map(([cwa, items]) => (
          <section key={cwa}>
            <div className="mb-2 flex items-center gap-2">
              <Layers className="h-4 w-4 text-brand-500 dark:text-accent" />
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">{cwa}</h3>
              <div className="ml-1 h-px flex-1 bg-slate-200 dark:bg-white/10" />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((c) => (
                <button
                  key={c.codigo}
                  onClick={() => onSelectCwp?.(c.codigo)}
                  title={`Filtrar la planilla a ${c.codigo}`}
                  className={['group flex items-center gap-3 rounded-xl border bg-white p-3 text-left transition hover:border-brand-300 hover:shadow-sm dark:bg-ink-800/60 dark:hover:border-accent/40', c.count > 0 ? 'border-slate-200 dark:border-white/10' : 'border-dashed border-slate-200 opacity-70 dark:border-white/10'].join(' ')}
                >
                  <Boxes className={['h-4 w-4 shrink-0', c.count > 0 ? 'text-brand-500 dark:text-accent' : 'text-slate-300 dark:text-slate-600'].join(' ')} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-xs font-bold text-slate-800 dark:text-white">{c.codigo}</span>
                    <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400" title={c.nombre}>{c.nombre || ''}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className={['block text-sm font-bold tabular-nums', c.count > 0 ? 'text-brand-600 dark:text-accent' : 'text-slate-300 dark:text-slate-600'].join(' ')}>{c.count}</span>
                    {c.hh && <span className="block text-[10px] tabular-nums text-slate-400">{Number(c.hh).toLocaleString('es-CL')} HH</span>}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

const TONE = {
  ok: 'border-slate-200 bg-white text-slate-500 dark:border-white/10 dark:bg-ink-800/60',
  bad: 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400',
}
function Stat({ icon: IconCmp, label, value, sub, tone = 'ok', onClick }) {
  const Cmp = onClick ? 'button' : 'div'
  return (
    <Cmp onClick={onClick || undefined} className={['flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition', TONE[tone], onClick ? 'hover:shadow-sm cursor-pointer' : ''].join(' ')}>
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/60 dark:bg-black/20"><IconCmp className="h-4 w-4" /></div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide opacity-80">{label}</p>
        <p className="text-xl font-bold leading-tight tabular-nums text-slate-800 dark:text-white">{value}{sub && <span className="ml-1 text-xs font-medium opacity-70">{sub}</span>}</p>
      </div>
    </Cmp>
  )
}
