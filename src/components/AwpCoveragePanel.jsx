import { useMemo, useRef, useState } from 'react'
import { Boxes, Database, Gauge, Layers, Link2, Loader2, Sigma, TriangleAlert, Upload } from 'lucide-react'

/**
 * Pestaña AWP: cobertura y AVANCE de paquetización de la planilla. Por cada CWP
 * (del CSV importado y/o asignado en las filas) muestra cuántos componentes tiene
 * asignados, su % de avance (de los estados E1–E4) y sus HH; resalta los
 * componentes SIN CWP. Clic en un CWP → filtra la grilla a ese CWP.
 *
 * props: cwps, rows, cwpCol, avanceCol, onSelectCwp(code|''), onImport(file)
 */

// Peso de avance de un estado "E<n>": E1=0% … E4=100% (E1 inicio, E4 completo).
// Valores no reconocidos cuentan como 0% (no iniciado).
const STATE_MAX = 4
function stateWeight(v) {
  const m = /e\s*(\d+)/i.exec(String(v ?? '').trim())
  if (!m) return 0
  return Math.max(0, Math.min(1, (Number(m[1]) - 1) / (STATE_MAX - 1)))
}
const pctTone = (p) => (p >= 80 ? 'text-emerald-600 dark:text-emerald-400' : p >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400')

export default function AwpCoveragePanel({ cwps = [], rows = [], cwpCol, avanceCol, onSelectCwp, onImport }) {
  const fileRef = useRef(null)
  const [importing, setImporting] = useState(false)

  const stats = useMemo(() => {
    const byCode = new Map() // code -> { count, wsum }
    let noCwp = 0
    for (const r of rows) {
      const v = cwpCol ? String(r[cwpCol] ?? '').trim() : ''
      if (!v) { noCwp++; continue }
      const e = byCode.get(v) || { count: 0, wsum: 0 }
      e.count++
      e.wsum += avanceCol ? stateWeight(r[avanceCol]) : 0
      byCode.set(v, e)
    }
    return { byCode, noCwp, total: rows.length, assigned: rows.length - noCwp }
  }, [rows, cwpCol, avanceCol])

  // CWPs importados + los que aparecen en filas pero no están en el CSV, con
  // count, % avance y HH adjuntos.
  const merged = useMemo(() => {
    const m = new Map()
    for (const c of cwps) m.set(c.codigo, { ...c })
    for (const code of stats.byCode.keys()) if (!m.has(code)) m.set(code, { codigo: code, cwa: '', nombre: '(no está en el CSV)', hh: '' })
    for (const c of m.values()) {
      const s = stats.byCode.get(c.codigo)
      c.count = s?.count || 0
      c.avance = s && s.count ? Math.round((s.wsum / s.count) * 100) : 0
    }
    return m
  }, [cwps, stats])

  const groups = useMemo(() => {
    const g = new Map()
    for (const c of merged.values()) { const k = c.cwa || '—'; if (!g.has(k)) g.set(k, []); g.get(k).push(c) }
    return [...g.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'es'))
      .map(([cwa, items]) => [cwa, items.sort((a, b) => a.codigo.localeCompare(b.codigo, 'es'))])
  }, [merged])

  // Avance global: ponderado por HH (estilo EVM) y, si no hay HH, por nº de
  // componentes. Solo cuenta CWPs con componentes asignados.
  const overall = useMemo(() => {
    let hhNum = 0, hhDen = 0, wsum = 0, cnt = 0
    for (const c of merged.values()) {
      const s = stats.byCode.get(c.codigo)
      if (!s || !s.count) continue
      wsum += s.wsum; cnt += s.count
      const hh = Number(c.hh) || 0
      if (hh) { hhNum += (s.wsum / s.count) * hh; hhDen += hh }
    }
    return { byHH: hhDen ? Math.round((hhNum / hhDen) * 100) : null, byCount: cnt ? Math.round((wsum / cnt) * 100) : 0 }
  }, [merged, stats])

  async function pick(file) {
    if (!file || !onImport) return
    setImporting(true)
    try { await onImport(file) } finally { setImporting(false) }
  }

  if (!cwps.length && stats.assigned === 0) {
    return (
      <div className="grid h-full place-items-center px-6">
        <div className="max-w-md rounded-2xl border border-dashed border-slate-300 bg-white px-8 py-12 text-center dark:border-white/15 dark:bg-ink-800/50">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-glow"><Link2 className="h-7 w-7" /></div>
          <h2 className="text-base font-bold text-slate-800 dark:text-white">Conecta esta disciplina a AWP</h2>
          <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            Importa el listado de CWPs exportado de Aura AWP (CSV o Excel) para ver la cobertura y el avance de paquetización.
          </p>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; pick(f); e.target.value = '' }} />
          <button onClick={() => fileRef.current?.click()} disabled={importing} className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-60 dark:bg-accent dark:text-ink-900">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Importar CWPs (CSV o Excel)
          </button>
        </div>
      </div>
    )
  }

  const cov = stats.total ? Math.round((stats.assigned / stats.total) * 100) : 0
  const avg = overall.byHH ?? overall.byCount

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-5">
      {/* Resumen */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={Sigma} label="Componentes" value={stats.total.toLocaleString('es-CL')} />
        <Stat icon={Database} label="Con CWP" value={stats.assigned.toLocaleString('es-CL')} sub={`${cov}%`} />
        <Stat icon={TriangleAlert} label="Sin CWP" value={stats.noCwp.toLocaleString('es-CL')} tone={stats.noCwp ? 'bad' : 'ok'} onClick={stats.noCwp ? () => onSelectCwp?.('') : null} />
        <Stat icon={Gauge} label={overall.byHH != null ? 'Avance (HH)' : 'Avance'} value={`${avg}%`} tone={avg >= 80 ? 'good' : avg >= 40 ? 'warn' : 'ok'} />
      </div>

      {/* Barra de avance global */}
      <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-slate-400">
        <span>Avance de paquetización</span><span className="tabular-nums">{avg}%</span>
      </div>
      <div className="mb-5 h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-500 transition-all" style={{ width: `${avg}%` }} />
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
                  className={['group rounded-xl border bg-white p-3 text-left transition hover:border-brand-300 hover:shadow-sm dark:bg-ink-800/60 dark:hover:border-accent/40', c.count > 0 ? 'border-slate-200 dark:border-white/10' : 'border-dashed border-slate-200 opacity-70 dark:border-white/10'].join(' ')}
                >
                  <div className="flex items-center gap-3">
                    <Boxes className={['h-4 w-4 shrink-0', c.count > 0 ? 'text-brand-500 dark:text-accent' : 'text-slate-300 dark:text-slate-600'].join(' ')} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-xs font-bold text-slate-800 dark:text-white">{c.codigo}</span>
                      <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400" title={c.nombre}>{c.nombre || ''}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className={['block text-sm font-bold tabular-nums', c.count > 0 ? 'text-brand-600 dark:text-accent' : 'text-slate-300 dark:text-slate-600'].join(' ')}>{c.count}</span>
                      {c.hh && <span className="block text-[10px] tabular-nums text-slate-400">{Number(c.hh).toLocaleString('es-CL')} HH</span>}
                    </span>
                  </div>
                  {c.count > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                        <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-500" style={{ width: `${c.avance}%` }} />
                      </div>
                      <span className={['shrink-0 text-[10px] font-semibold tabular-nums', pctTone(c.avance)].join(' ')}>{c.avance}%</span>
                    </div>
                  )}
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
  good: 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400',
  warn: 'border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400',
  bad: 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400',
}
function Stat({ icon: IconCmp, label, value, sub, tone = 'ok', onClick }) {
  const Cmp = onClick ? 'button' : 'div'
  return (
    <Cmp onClick={onClick || undefined} className={['flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition', TONE[tone], onClick ? 'cursor-pointer hover:shadow-sm' : ''].join(' ')}>
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/60 dark:bg-black/20"><IconCmp className="h-4 w-4" /></div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide opacity-80">{label}</p>
        <p className="text-xl font-bold leading-tight tabular-nums text-slate-800 dark:text-white">{value}{sub && <span className="ml-1 text-xs font-medium opacity-70">{sub}</span>}</p>
      </div>
    </Cmp>
  )
}
