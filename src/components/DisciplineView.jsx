import { ArrowUpRight, Database, Lock } from 'lucide-react'
import Icon from './Icon.jsx'

/**
 * Vista A — Menú de subcategorías de una disciplina.
 * Renderiza tarjetas (cards) por cada subcategoría con ícono, título,
 * descripción y un badge con el total de elementos.
 *
 * props:
 *  - discipline: objeto disciplina
 *  - onOpenSubcategory(subId)
 */
export default function DisciplineView({ discipline, onOpenSubcategory }) {
  if (!discipline) return null

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-8 flex items-start gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-xl border border-white/10 bg-ink-800 shadow-card">
          <Icon name={discipline.icon} className="h-6 w-6 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">{discipline.name}</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Selecciona una subcategoría para abrir su grilla de datos de ingeniería.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {discipline.subcategories.map((sc) => {
          const hasData = (sc.count || 0) > 0
          return (
            <button
              key={sc.id}
              onClick={() => hasData && onOpenSubcategory(sc.id)}
              disabled={!hasData}
              className={[
                'group relative flex items-center gap-4 overflow-hidden rounded-xl border p-5 text-left transition-all',
                hasData
                  ? 'border-white/10 bg-ink-800/70 shadow-card hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-glow'
                  : 'cursor-not-allowed border-white/5 bg-ink-800/40 opacity-60',
              ].join(' ')}
            >
              {/* Accent glow on hover */}
              {hasData && (
                <span className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              )}

              <div
                className={[
                  'grid h-12 w-12 shrink-0 place-items-center rounded-lg border transition-colors',
                  hasData
                    ? 'border-accent/20 bg-accent/10 text-accent'
                    : 'border-white/5 bg-white/5 text-slate-500',
                ].join(' ')}
              >
                <Icon name={sc.icon} className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-semibold text-white">{sc.name}</h3>
                  <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                    {sc.code}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-400">{sc.description}</p>
                <div className="mt-3 flex items-center gap-2">
                  <span
                    className={[
                      'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold',
                      hasData ? 'bg-accent/10 text-accent' : 'bg-white/5 text-slate-500',
                    ].join(' ')}
                  >
                    {hasData ? <Database className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    Total de elementos: {sc.count}
                  </span>
                </div>
              </div>

              {hasData && (
                <ArrowUpRight className="h-5 w-5 shrink-0 text-slate-600 transition-colors group-hover:text-accent" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
