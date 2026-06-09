import { useMemo } from 'react'
import { ArrowRight, Boxes, Database, FileSpreadsheet, Layers, Link2, Sigma } from 'lucide-react'
import Icon from './Icon.jsx'

/**
 * Home del proyecto: panel de entrada con KPIs y avance por disciplina (cobertura
 * de datos). Da orientación de un vistazo antes de entrar a una planilla.
 *
 * props: project, disciplines, datasets (allDatasets), cwps, createdSheets,
 *        onOpenDiscipline(id), onOpenAll(), onOpenSubcategory(subId)
 */
export default function ProjectHome({ project, disciplines = [], datasets = {}, cwps = [], createdSheets = {}, onOpenDiscipline, onOpenAll }) {
  const stats = useMemo(() => {
    const perDisc = []
    let elements = 0, subsWithData = 0, totalSubs = 0, discWithData = 0
    for (const d of disciplines) {
      const subs = d.subcategories || []
      let dElements = 0, dWith = 0
      for (const s of subs) {
        totalSubs++
        const ds = s.dataKey && datasets[s.dataKey]
        const c = ds ? (ds.count ?? ds.rows?.length ?? 0) : 0
        const has = c > 0 || (createdSheets && createdSheets[s.id])
        if (has) { dWith++; subsWithData++ }
        dElements += c
      }
      elements += dElements
      if (dWith > 0) discWithData++
      perDisc.push({ id: d.id, name: d.name, icon: d.icon, subs: subs.length, withData: dWith, elements: dElements })
    }
    const cwas = new Set(cwps.map((c) => c.cwa).filter(Boolean))
    return {
      elements, subsWithData, totalSubs, discWithData, totalDisc: disciplines.length,
      coverage: totalSubs ? Math.round((subsWithData / totalSubs) * 100) : 0,
      cwps: cwps.length, cwas: cwas.size, perDisc,
    }
  }, [disciplines, datasets, cwps, createdSheets])

  const kpis = [
    { icon: Sigma, label: 'Elementos', value: stats.elements.toLocaleString('es-CL'), hint: 'en todas las planillas' },
    { icon: Layers, label: 'Disciplinas', value: `${stats.discWithData}/${stats.totalDisc}`, hint: 'con datos' },
    { icon: FileSpreadsheet, label: 'Planillas', value: `${stats.subsWithData}/${stats.totalSubs}`, hint: 'con datos' },
    { icon: Link2, label: 'Paquetes AWP', value: stats.cwps.toLocaleString('es-CL'), hint: `${stats.cwas} CWA` },
  ]

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Encabezado */}
      <div className="mb-6 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-600 dark:text-accent">Proyecto</p>
          <h1 className="truncate text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">{project?.name || 'Proyecto'}</h1>
        </div>
        <button
          onClick={onOpenAll}
          className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-600 sm:inline-flex dark:border-white/10 dark:bg-ink-800 dark:text-slate-300 dark:hover:border-accent/40 dark:hover:text-accent"
        >
          <Database className="h-4 w-4" /> Ver todas las disciplinas
        </button>
      </div>

      {/* Cobertura global */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 dark:border-white/10 dark:from-ink-800 dark:to-ink-800/60">
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Cobertura de datos del proyecto</p>
          <p className="text-2xl font-extrabold text-brand-600 dark:text-accent">{stats.coverage}%</p>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all dark:from-accent dark:to-accent-600" style={{ width: `${stats.coverage}%` }} />
        </div>
        <p className="mt-1.5 text-xs text-slate-400">{stats.subsWithData} de {stats.totalSubs} planillas con datos cargados</p>
      </div>

      {/* KPIs */}
      <div className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-ink-800">
            <div className="mb-2 grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-500 dark:bg-accent/10 dark:text-accent">
              <k.icon className="h-5 w-5" />
            </div>
            <p className="text-2xl font-extrabold tabular-nums text-slate-800 dark:text-white">{k.value}</p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{k.label}</p>
            <p className="text-[10px] text-slate-400">{k.hint}</p>
          </div>
        ))}
      </div>

      {/* Avance por disciplina */}
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Avance por disciplina</h2>
      {stats.perDisc.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-400 dark:border-white/10">
          Este proyecto aún no tiene disciplinas. Agrega una desde el menú lateral.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {stats.perDisc.map((d) => {
            const pct = d.subs ? Math.round((d.withData / d.subs) * 100) : 0
            return (
              <button
                key={d.id}
                onClick={() => onOpenDiscipline(d.id)}
                className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:border-white/10 dark:bg-ink-800 dark:hover:border-accent/40"
              >
                <div className="mb-2 flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-brand-200 bg-brand-50 text-brand-500 dark:border-accent/30 dark:bg-accent/10 dark:text-accent">
                    <Icon name={d.icon} className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-800 dark:text-white">{d.name}</p>
                    <p className="text-[11px] text-slate-400">{d.withData}/{d.subs} planillas · {d.elements.toLocaleString('es-CL')} elem.</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500 dark:group-hover:text-accent" />
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                  <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-brand-500 dark:bg-accent'}`} style={{ width: `${pct}%` }} />
                </div>
              </button>
            )
          })}
        </div>
      )}

      {cwps.length === 0 && (
        <div className="mt-6 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
          <Boxes className="h-4 w-4 shrink-0 text-slate-400" />
          Aún no importaste el listado de CWPs (AWP). Hazlo desde una planilla → “Conectar a AWP”.
        </div>
      )}
    </div>
  )
}
