import { lazy, Suspense, useMemo, useState } from 'react'
import { ArrowUpRight, Box, Filter, Globe, LayoutGrid, Layers, List, Loader2, Search, ShieldCheck, Sigma, Table2, X } from 'lucide-react'
import Icon from './Icon.jsx'
import ViewerErrorBoundary from './ViewerErrorBoundary.jsx'
import CombinedTable from './CombinedTable.jsx'
import QualityPanel from './QualityPanel.jsx'

// El visor APS (SDK de Autodesk) se carga en un chunk aparte, solo al abrir el 3D.
const ApsViewer = lazy(() => import('./ApsViewer.jsx'))

/**
 * Vista "Todas las disciplinas" — conjunto de TODAS las planillas existentes del
 * proyecto (subcategorías con datos + planillas creadas por el usuario),
 * agrupadas por disciplina. Sirve como índice global para abrir cualquier
 * planilla sin tener que entrar disciplina por disciplina.
 *
 * props:
 *  - disciplines: lista fusionada (base + importadas).
 *  - createdSheets: { subId: columns[] } de planillas nuevas creadas.
 *  - onOpenSubcategory(subId)
 */
export default function AllDisciplinesView({ disciplines, datasets = {}, createdSheets = {}, onOpenSubcategory }) {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState('sheets') // 'sheets' (índice) | 'table' (tabla) | 'quality' (calidad) | 'model' (3D)
  const [discFilter, setDiscFilter] = useState(() => new Set()) // ids de disciplina; vacío = todas
  const toggleDisc = (id) =>
    setDiscFilter((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  const discPass = (id) => discFilter.size === 0 || discFilter.has(id)

  // Conjunto combinado de TODO el proyecto para el visor APS: une las filas de
  // cada subcategoría con datos y normaliza su TAG (primera columna del dataset)
  // en un campo "TAG" común, para que el vínculo dato↔geometría y el aislado por
  // paquetes (CWA/CWP/IWP/SWP) funcionen a nivel proyecto, no por planilla.
  // Respeta el filtro de disciplina: solo se incluyen las disciplinas elegidas.
  const combined = useMemo(() => {
    const headerSet = new Set()
    const rows = []
    for (const d of disciplines) {
      if (discFilter.size && !discFilter.has(d.id)) continue
      for (const s of d.subcategories) {
        const ds = s.dataKey && datasets[s.dataKey]
        if (!ds?.rows?.length) continue
        const tagk = ds.headers?.[0]
        ;(ds.headers || []).forEach((h) => headerSet.add(h))
        ds.rows.forEach((r, i) => {
          rows.push({ ...r, _id: `${s.dataKey}-${i}`, _subId: s.id, _dataKey: s.dataKey, TAG: r[tagk] ?? '', DISCIPLINA: d.name, PLANILLA: s.name })
        })
      }
    }
    // TAG primero (clave de vínculo); luego disciplina/planilla y el resto de columnas.
    const rest = [...headerSet].filter((h) => !['TAG', 'DISCIPLINA', 'PLANILLA'].includes(h))
    return { headers: ['TAG', 'DISCIPLINA', 'PLANILLA', ...rest], rows }
  }, [disciplines, datasets, discFilter])

  // Conteo liviano de problemas de calidad (sin TAG + TAGs duplicados) para el
  // indicador del modo "Calidad". El detalle se calcula dentro de QualityPanel.
  const qualityIssues = useMemo(() => {
    let noTag = 0
    const seen = new Map()
    for (const r of combined.rows) {
      const t = String(r.TAG ?? '').trim().toLowerCase()
      if (!t) { noTag++; continue }
      seen.set(t, (seen.get(t) || 0) + 1)
    }
    let dupTags = 0
    for (const c of seen.values()) if (c > 1) dupTags++
    return noTag + dupTags
  }, [combined])

  // Aplana todas las planillas "abribles": con datos (count > 0) o creadas vacías.
  const groups = useMemo(() => {
    return disciplines
      .map((d) => {
        const sheets = d.subcategories
          .map((s) => {
            const created = !!createdSheets[s.id]
            const count = s.count || 0
            const openable = count > 0 || created
            return openable ? { sub: s, count, created } : null
          })
          .filter(Boolean)
        return { discipline: d, sheets }
      })
      .filter((g) => g.sheets.length > 0)
  }, [disciplines, createdSheets])

  // Totales del proyecto (sobre todas las planillas, sin filtro de búsqueda).
  const totals = useMemo(() => {
    let sheets = 0, elements = 0
    for (const g of groups) {
      sheets += g.sheets.length
      for (const s of g.sheets) elements += s.count
    }
    return { sheets, elements, disciplines: groups.length }
  }, [groups])

  // Filtro de búsqueda (texto) + filtro por disciplina (chips).
  const q = query.trim().toLowerCase()
  const filteredGroups = useMemo(() => {
    let gs = discFilter.size ? groups.filter((g) => discFilter.has(g.discipline.id)) : groups
    if (!q) return gs
    return gs
      .map((g) => {
        const dMatches = g.discipline.name.toLowerCase().includes(q)
        const sheets = dMatches
          ? g.sheets
          : g.sheets.filter(({ sub }) =>
              [sub.name, sub.code, sub.description].some((v) => String(v || '').toLowerCase().includes(q)),
            )
        return { ...g, sheets }
      })
      .filter((g) => g.sheets.length > 0)
  }, [groups, q, discFilter])

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      {/* Encabezado / resumen */}
      <div className="mb-5 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 dark:border-white/10 dark:from-ink-800/70 dark:to-ink-800/30">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-brand-200 bg-brand-50 text-brand-500 dark:border-accent/30 dark:bg-accent/10 dark:text-accent">
              <Globe className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-extrabold tracking-tight text-slate-800 dark:text-white">Todas las disciplinas</h1>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                Conjunto de todas las planillas existentes del proyecto. Abre cualquiera para ver y editar sus datos.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Conmutador Planillas / Modelo 3D */}
            <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-white/10 dark:bg-ink-900/40">
              <ModeToggle active={mode === 'sheets'} icon={List} label="Planillas" onClick={() => setMode('sheets')} />
              <ModeToggle active={mode === 'table'} icon={Table2} label="Tabla" onClick={() => setMode('table')} />
              <ModeToggle active={mode === 'quality'} icon={ShieldCheck} label="Calidad" badge={qualityIssues} onClick={() => setMode('quality')} />
              <ModeToggle active={mode === 'model'} icon={Box} label="Modelo 3D" onClick={() => setMode('model')} />
            </div>

            {/* Buscador (solo en el índice de planillas) */}
            {mode === 'sheets' && (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 dark:border-white/10 dark:bg-ink-800">
                <Search className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar planilla o disciplina…"
                  className="w-52 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none dark:text-slate-200 dark:placeholder:text-slate-600"
                />
                {query && (
                  <button onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Métricas */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Metric icon={LayoutGrid} label="Planillas" value={totals.sheets} />
          <Metric icon={Sigma} label="Elementos" value={totals.elements.toLocaleString('es-CL')} />
          <Metric icon={Layers} label="Disciplinas con datos" value={totals.disciplines} />
        </div>
      </div>

      {/* Filtro por disciplina (afecta tanto el índice de planillas como el Modelo 3D) */}
      {groups.length > 1 && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 pr-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <Filter className="h-3.5 w-3.5" /> Disciplinas
          </span>
          <DiscChip label="Todas" active={discFilter.size === 0} onClick={() => setDiscFilter(new Set())} />
          {groups.map((g) => (
            <DiscChip
              key={g.discipline.id}
              icon={g.discipline.icon}
              label={g.discipline.name}
              count={g.sheets.length}
              active={discFilter.has(g.discipline.id)}
              onClick={() => toggleDisc(g.discipline.id)}
            />
          ))}
        </div>
      )}

      {/* Modo Modelo 3D: visor APS con los datos combinados de todo el proyecto */}
      {mode === 'model' ? (
        <div className="h-[72vh] min-h-[460px] overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-ink-900">
          <ViewerErrorBoundary>
            <Suspense fallback={<ViewerLoading />}>
              <ApsViewer
                rows={combined.rows}
                headers={combined.headers}
                dataKey="all-disciplines"
                isFiltered={discFilter.size > 0}
              />
            </Suspense>
          </ViewerErrorBoundary>
        </div>
      ) : mode === 'table' ? (
        /* Modo Tabla combinada: todas las filas del proyecto en una grilla única,
           buscable / ordenable / exportable. Respeta el filtro de disciplina. */
        <CombinedTable headers={combined.headers} rows={combined.rows} onOpenRowSheet={onOpenSubcategory} />
      ) : mode === 'quality' ? (
        /* Modo Calidad: TAGs duplicados (cruce de disciplinas) y elementos sin TAG. */
        <QualityPanel rows={combined.rows} onOpenRowSheet={onOpenSubcategory} />
      ) : /* Grupos por disciplina */ filteredGroups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-white/15 dark:bg-ink-800/40">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {totals.sheets === 0
              ? 'Aún no hay planillas en el proyecto. Entra a una disciplina para importar datos o crear una planilla.'
              : 'No se encontraron planillas con los filtros actuales.'}
          </p>
        </div>
      ) : (
        <div className="space-y-7">
          {filteredGroups.map(({ discipline, sheets }) => (
            <section key={discipline.id}>
              <div className="mb-3 flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-ink-700 dark:text-slate-300">
                  <Icon name={discipline.icon} className="h-[18px] w-[18px]" />
                </div>
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">{discipline.name}</h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-white/10 dark:text-slate-400">
                  {sheets.length}
                </span>
                <div className="ml-1 h-px flex-1 bg-slate-200 dark:bg-white/10" />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {sheets.map(({ sub, count, created }) => (
                  <SheetCard
                    key={sub.id}
                    sub={sub}
                    count={count}
                    created={created}
                    onOpen={() => onOpenSubcategory(sub.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------------------------- subcomponentes ---------------------------- */

function DiscChip({ icon, label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition',
        active
          ? 'border-brand-400 bg-brand-500 text-white shadow-sm dark:border-accent/50 dark:bg-accent dark:text-ink-900'
          : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-600 dark:border-white/10 dark:bg-ink-800 dark:text-slate-300 dark:hover:border-accent/40 dark:hover:text-accent',
      ].join(' ')}
    >
      {icon && <Icon name={icon} className="h-3.5 w-3.5" />}
      {label}
      {count != null && (
        <span className={['rounded-full px-1.5 text-[10px] tabular-nums', active ? 'bg-white/20 text-white dark:bg-ink-900/20 dark:text-ink-900' : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400'].join(' ')}>
          {count}
        </span>
      )}
    </button>
  )
}

function ModeToggle({ active, icon: IconCmp, label, badge, onClick }) {
  return (
    <button
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition',
        active
          ? 'bg-brand-500 text-white shadow-sm dark:bg-accent dark:text-ink-900'
          : 'text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-accent',
      ].join(' ')}
    >
      <IconCmp className="h-4 w-4" />
      {label}
      {badge > 0 && (
        <span className={['rounded-full px-1.5 text-[10px] font-bold tabular-nums', active ? 'bg-white/25 text-white dark:bg-ink-900/25 dark:text-ink-900' : 'bg-rose-500 text-white'].join(' ')}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  )
}

function ViewerLoading() {
  return (
    <div className="grid h-full place-items-center text-slate-400 dark:text-slate-500">
      <span className="inline-flex items-center gap-2 text-sm font-medium">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando visor 3D…
      </span>
    </div>
  )
}

function Metric({ icon: IconCmp, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-ink-800/60">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-500 dark:bg-accent/10 dark:text-accent">
        <IconCmp className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
        <p className="text-xl font-bold tabular-nums text-slate-800 dark:text-white">{value}</p>
      </div>
    </div>
  )
}

function SheetCard({ sub, count, created, onOpen }) {
  const hasData = count > 0
  return (
    <button
      onClick={onOpen}
      className="group flex items-center gap-3.5 rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-brand-300 hover:shadow-md dark:border-white/10 dark:bg-ink-800/70 dark:hover:border-accent/40 dark:hover:shadow-card"
    >
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-brand-200 bg-brand-50 text-brand-500 transition-transform duration-200 ease-out group-hover:scale-105 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300">
        <Icon name={sub.icon} className="h-5 w-5 transition-transform duration-200 ease-out group-hover:-rotate-6 group-hover:scale-110" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-semibold text-slate-800 dark:text-white">{sub.name}</h3>
          {hasData && (
            <span className="shrink-0 rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-accent/15 dark:text-accent">
              {count}
            </span>
          )}
          {sub.imported && (
            <span className="shrink-0 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
              Importado
            </span>
          )}
          {!hasData && created && (
            <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              Nueva
            </span>
          )}
        </div>
        <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{sub.description}</p>
      </div>
      <ArrowUpRight className="h-5 w-5 shrink-0 text-slate-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-600 dark:text-slate-600 dark:group-hover:text-accent" />
    </button>
  )
}
