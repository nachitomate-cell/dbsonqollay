import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Empty, fmt } from './ui.jsx'

// Cronograma (Gantt) de CWAs → CWPs, a partir de sus fechas planificadas.

const parseD = (s) => (s ? new Date(s + 'T00:00:00').getTime() : null)
const startOfMonth = (ms) => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), 1).getTime() }
const nextMonth = (ms) => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime() }
function listMonths(start, end) {
  const out = []; let ms = start
  while (ms < end) { out.push({ ms, label: new Date(ms).toLocaleDateString('es-CL', { month: 'short', year: '2-digit' }) }); ms = nextMonth(ms) }
  return out
}
const estadoColor = (e) => {
  const v = String(e || '').toLowerCase()
  if (v.includes('complet')) return '#22c55e'
  if (v.includes('construc')) return '#f97316'
  return '#3b82f6'
}
const COLW = 84 // px por mes

export default function WorkspaceCronograma({ cwas, cwps, config, discById }) {
  const [expanded, setExpanded] = useState({})

  const dates = []
  const push = (s) => { const ms = parseD(s); if (ms) dates.push(ms) }
  cwas.forEach((c) => { push(c.fechaInicio); push(c.fechaFin) })
  cwps.forEach((c) => { push(c.fechaInicio); push(c.fechaFin) })
  push(config.fechaInicio); push(config.fechaFin)
  if (!dates.length) return <Empty msg="Asigna fechas planificadas a las CWAs/CWPs (o al proyecto en Configuración) para ver el cronograma." />

  const start = startOfMonth(Math.min(...dates))
  const end = nextMonth(Math.max(...dates))
  const total = end - start || 1
  const months = listMonths(start, end)
  const trackW = months.length * COLW
  const pct = (ms) => ((ms - start) / total) * 100

  function Bar({ a, b, color, label }) {
    const s = parseD(a), e = parseD(b)
    if (!s || !e || e < s) return <span className="text-[11px] text-slate-300 dark:text-slate-600">— sin fechas —</span>
    const left = pct(s), width = Math.max(1.5, pct(e) - pct(s))
    return (
      <div className="absolute top-1/2 -translate-y-1/2 overflow-hidden rounded-md px-2 text-[11px] font-semibold leading-[22px] text-white" style={{ left: `${left}%`, width: `${width}%`, height: 22, background: color }} title={`${label}: ${new Date(s).toLocaleDateString('es-CL')} → ${new Date(e).toLocaleDateString('es-CL')}`}>
        <span className="truncate">{label}</span>
      </div>
    )
  }

  const LABELW = 230
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-ink-800/60">
      <div style={{ minWidth: LABELW + trackW }}>
        {/* Header de meses */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-400 dark:border-white/10 dark:bg-white/5">
          <div className="shrink-0 px-3 py-2" style={{ width: LABELW }}>CWA / CWP</div>
          <div className="relative flex" style={{ width: trackW }}>
            {months.map((m) => <div key={m.ms} className="shrink-0 border-l border-slate-100 px-1 py-2 text-center capitalize dark:border-white/5" style={{ width: COLW }}>{m.label}</div>)}
          </div>
        </div>
        {/* Filas */}
        {cwas.map((cwa) => {
          const myCwps = cwps.filter((p) => p.cwaId === cwa.id)
          const open = expanded[cwa.id]
          return (
            <div key={cwa.id}>
              <div className="flex items-stretch border-b border-slate-100 dark:border-white/5">
                <div className="flex shrink-0 items-center gap-1 px-2 py-2" style={{ width: LABELW }}>
                  <button onClick={() => setExpanded((e) => ({ ...e, [cwa.id]: !e[cwa.id] }))} className="grid h-5 w-5 place-items-center rounded text-slate-400 hover:text-slate-600" disabled={!myCwps.length}>
                    {myCwps.length ? (open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : null}
                  </button>
                  <div className="min-w-0">
                    <span className="block truncate font-mono text-xs font-bold text-slate-800 dark:text-white">{cwa.codigo}</span>
                    <span className="block truncate text-[10px] text-slate-400">{fmt(cwa.hh)} HH</span>
                  </div>
                </div>
                <div className="relative" style={{ width: trackW }}>
                  {months.map((m, i) => <div key={m.ms} className="absolute top-0 h-full border-l border-slate-50 dark:border-white/[0.03]" style={{ left: i * COLW }} />)}
                  <Bar a={cwa.fechaInicio} b={cwa.fechaFin} color={estadoColor(cwa.estado)} label={cwa.codigo} />
                </div>
              </div>
              {open && myCwps.map((cwp) => (
                <div key={cwp.id} className="flex items-stretch border-b border-slate-100 bg-slate-50/40 dark:border-white/5 dark:bg-white/[0.02]">
                  <div className="shrink-0 py-1.5 pl-9 pr-2" style={{ width: LABELW }}>
                    <span className="block truncate font-mono text-[11px] font-semibold text-slate-600 dark:text-slate-300">{cwp.codigo}</span>
                  </div>
                  <div className="relative" style={{ width: trackW }}>
                    <Bar a={cwp.fechaInicio || cwa.fechaInicio} b={cwp.fechaFin || cwa.fechaFin} color={discById(cwp.disciplinaId)?.color || '#64748b'} label={cwp.codigo} />
                  </div>
                </div>
              ))}
            </div>
          )
        })}
        {/* Leyenda */}
        <div className="flex flex-wrap items-center gap-4 px-3 py-2 text-[11px] text-slate-500 dark:text-slate-400">
          <Leg c="#3b82f6" t="Planificada" /><Leg c="#f97316" t="En construcción" /><Leg c="#22c55e" t="Completada" /><span>CWP: color = disciplina</span>
        </div>
      </div>
    </div>
  )
}
const Leg = ({ c, t }) => <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-3.5 rounded-sm" style={{ background: c }} /> {t}</span>
