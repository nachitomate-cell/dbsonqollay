import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, CircleCheck, ExternalLink, FileSpreadsheet, ShieldCheck, Tag, TriangleAlert } from 'lucide-react'

/**
 * Panel de CALIDAD del dato sobre el conjunto combinado del proyecto. Detecta los
 * dos problemas más comunes del pipeline (la memoria menciona dup tags / tags
 * vacíos):
 *   - TAGs DUPLICADOS: el mismo TAG en más de una fila. Se marca aparte el caso
 *     crítico de que el TAG cruce DISCIPLINAS distintas (colisión real entre
 *     planillas → el match dato↔modelo se vuelve ambiguo).
 *   - Elementos SIN TAG: filas cuya clave de vínculo está vacía (no se podrán
 *     asignar al modelo).
 * El análisis respeta el filtro de disciplina (viene aplicado en `rows`).
 *
 * props:
 *  - rows: filas combinadas (con TAG, DISCIPLINA, PLANILLA, _subId, _id)
 *  - onOpenRowSheet(subId): abre la planilla de origen de una fila
 */
export default function QualityPanel({ rows = [], onOpenRowSheet }) {
  const [expanded, setExpanded] = useState(() => new Set())
  const [onlyCross, setOnlyCross] = useState(false)
  const toggle = (k) => setExpanded((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })

  const a = useMemo(() => {
    const noTag = []
    const byTag = new Map() // tagNorm -> { tag, rows: [] }
    for (const r of rows) {
      const raw = String(r.TAG ?? '').trim()
      if (!raw) { noTag.push(r); continue }
      const k = raw.toLowerCase()
      if (!byTag.has(k)) byTag.set(k, { tag: raw, rows: [] })
      byTag.get(k).rows.push(r)
    }
    const duplicates = []
    for (const { tag, rows: rs } of byTag.values()) {
      if (rs.length < 2) continue
      const disc = [...new Set(rs.map((r) => r.DISCIPLINA))]
      duplicates.push({ key: tag.toLowerCase(), tag, rows: rs, disciplines: disc, cross: disc.length > 1 })
    }
    // Primero los que cruzan disciplinas, luego por cantidad de ocurrencias.
    duplicates.sort((x, y) => Number(y.cross) - Number(x.cross) || y.rows.length - x.rows.length)
    return {
      total: rows.length,
      withTag: rows.length - noTag.length,
      noTag,
      uniqueTags: byTag.size,
      duplicates,
      dupRows: duplicates.reduce((n, d) => n + d.rows.length, 0),
      crossCount: duplicates.filter((d) => d.cross).length,
    }
  }, [rows])

  const shownDups = onlyCross ? a.duplicates.filter((d) => d.cross) : a.duplicates
  const issues = a.noTag.length + a.duplicates.length
  const clean = issues === 0 && a.total > 0

  async function exportReport() {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()
    const dup = [['TAG', 'OCURRENCIAS', 'CRUZA_DISCIPLINAS', 'DISCIPLINAS', 'PLANILLAS']]
    for (const d of a.duplicates) dup.push([d.tag, d.rows.length, d.cross ? 'SÍ' : 'NO', d.disciplines.join(' | '), [...new Set(d.rows.map((r) => r.PLANILLA))].join(' | ')])
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dup), 'TAGs duplicados')
    const no = [['DISCIPLINA', 'PLANILLA']]
    for (const r of a.noTag) no.push([r.DISCIPLINA, r.PLANILLA])
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(no), 'Sin TAG')
    XLSX.writeFile(wb, 'Reporte_Calidad.xlsx')
  }

  if (a.total === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-white/15 dark:bg-ink-800/40">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No hay elementos para analizar en las disciplinas seleccionadas.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Con TAG" value={a.withTag.toLocaleString('es-CL')} tone="ok" icon={CircleCheck} />
        <Stat label="Sin TAG" value={a.noTag.length.toLocaleString('es-CL')} tone={a.noTag.length ? 'bad' : 'ok'} icon={Tag} />
        <Stat label="TAGs duplicados" value={a.duplicates.length.toLocaleString('es-CL')} sub={a.dupRows ? `${a.dupRows} filas` : null} tone={a.duplicates.length ? 'warn' : 'ok'} icon={TriangleAlert} />
        <Stat label="Cruzan disciplinas" value={a.crossCount.toLocaleString('es-CL')} tone={a.crossCount ? 'bad' : 'ok'} icon={TriangleAlert} />
      </div>

      {/* Acciones */}
      <div className="flex flex-wrap items-center gap-3">
        {a.duplicates.length > 0 && (
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={onlyCross} onChange={() => setOnlyCross((v) => !v)} className="h-3.5 w-3.5 accent-brand-500 dark:accent-accent" />
            Solo los que cruzan disciplinas
          </label>
        )}
        <button onClick={exportReport} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:text-brand-600 dark:border-white/10 dark:bg-ink-800 dark:text-slate-300 dark:hover:text-accent">
          <FileSpreadsheet className="h-3.5 w-3.5" /> Exportar reporte
        </button>
      </div>

      {clean && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          <ShieldCheck className="h-6 w-6 shrink-0" />
          <div>
            <p className="text-sm font-bold">Sin problemas de calidad detectados</p>
            <p className="text-xs opacity-80">Todos los elementos tienen TAG y no hay TAGs duplicados.</p>
          </div>
        </div>
      )}

      {/* TAGs duplicados */}
      {a.duplicates.length > 0 && (
        <section>
          <SectionTitle icon={TriangleAlert} tone="warn">TAGs duplicados {onlyCross && `· cruzan disciplinas`}</SectionTitle>
          <div className="space-y-1.5">
            {shownDups.slice(0, 200).map((d) => {
              const open = expanded.has(d.key)
              return (
                <div key={d.key} className={['rounded-lg border', d.cross ? 'border-rose-200 bg-rose-50/50 dark:border-rose-500/30 dark:bg-rose-500/5' : 'border-slate-200 bg-white dark:border-white/10 dark:bg-ink-800/60'].join(' ')}>
                  <button onClick={() => toggle(d.key)} className="flex w-full items-center gap-2 px-3 py-2 text-left">
                    {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                    <span className="font-mono text-xs font-bold text-slate-800 dark:text-white">{d.tag}</span>
                    <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-600 dark:bg-white/10 dark:text-slate-300">×{d.rows.length}</span>
                    {d.cross && <span className="rounded bg-rose-200 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">CRUZA DISCIPLINAS</span>}
                    <span className="ml-auto truncate text-[11px] text-slate-400">{d.disciplines.join(' · ')}</span>
                  </button>
                  {open && (
                    <ul className="border-t border-slate-100 px-3 py-1.5 dark:border-white/5">
                      {d.rows.map((r) => (
                        <li key={r._id} className="flex items-center gap-2 py-1 text-xs">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-white/10 dark:text-slate-400">{r.DISCIPLINA}</span>
                          <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300" title={r.PLANILLA}>{r.PLANILLA}</span>
                          {onOpenRowSheet && r._subId && (
                            <button onClick={() => onOpenRowSheet(r._subId)} title={`Abrir “${r.PLANILLA}”`} className="shrink-0 text-slate-300 transition hover:text-brand-600 dark:text-slate-600 dark:hover:text-accent"><ExternalLink className="h-3.5 w-3.5" /></button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
            {shownDups.length > 200 && <p className="px-1 pt-1 text-[11px] text-slate-400">Mostrando 200 de {shownDups.length.toLocaleString('es-CL')}. Exporta el reporte para verlos todos.</p>}
          </div>
        </section>
      )}

      {/* Elementos sin TAG */}
      {a.noTag.length > 0 && (
        <section>
          <SectionTitle icon={Tag} tone="bad">Elementos sin TAG · {a.noTag.length.toLocaleString('es-CL')}</SectionTitle>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
            {a.noTag.slice(0, 120).map((r) => (
              <div key={r._id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-white/10 dark:bg-ink-800/60">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-white/10 dark:text-slate-400">{r.DISCIPLINA}</span>
                <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300" title={r.PLANILLA}>{r.PLANILLA}</span>
                {onOpenRowSheet && r._subId && (
                  <button onClick={() => onOpenRowSheet(r._subId)} title={`Abrir “${r.PLANILLA}”`} className="shrink-0 text-slate-300 transition hover:text-brand-600 dark:text-slate-600 dark:hover:text-accent"><ExternalLink className="h-3.5 w-3.5" /></button>
                )}
              </div>
            ))}
            {a.noTag.length > 120 && <p className="px-1 text-[11px] text-slate-400">Mostrando 120 de {a.noTag.length.toLocaleString('es-CL')}. Exporta el reporte para verlos todos.</p>}
          </div>
        </section>
      )}
    </div>
  )
}

/* ---------------------------- subcomponentes ---------------------------- */

const TONES = {
  ok: 'border-slate-200 bg-white text-slate-500 dark:border-white/10 dark:bg-ink-800/60',
  warn: 'border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400',
  bad: 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400',
}

function Stat({ label, value, sub, tone = 'ok', icon: IconCmp }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${TONES[tone]}`}>
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/60 dark:bg-black/20"><IconCmp className="h-4 w-4" /></div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide opacity-80">{label}</p>
        <p className="text-xl font-bold tabular-nums leading-tight text-slate-800 dark:text-white">{value}</p>
        {sub && <p className="text-[10px] opacity-70">{sub}</p>}
      </div>
    </div>
  )
}

function SectionTitle({ icon: IconCmp, tone, children }) {
  const color = tone === 'bad' ? 'text-rose-500' : tone === 'warn' ? 'text-amber-500' : 'text-slate-500'
  return (
    <div className="mb-2 flex items-center gap-2">
      <IconCmp className={`h-4 w-4 ${color}`} />
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">{children}</h2>
      <div className="ml-1 h-px flex-1 bg-slate-200 dark:bg-white/10" />
    </div>
  )
}
