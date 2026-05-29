import { ChevronLeft, ChevronRight, Layers3 } from 'lucide-react'
import Icon from './Icon.jsx'
import { disciplines } from '../data/disciplines.js'

/**
 * Menú lateral colapsable con las disciplinas de Sonqollay.
 *
 * props:
 *  - collapsed: boolean
 *  - onToggle(): colapsa/expande
 *  - activeDiscipline: id de disciplina activa
 *  - onSelect(id): selecciona una disciplina
 */
export default function Sidebar({ collapsed, onToggle, activeDiscipline, onSelect }) {
  const totalElements = disciplines.reduce(
    (acc, d) => acc + d.subcategories.reduce((s, sc) => s + (sc.count || 0), 0),
    0,
  )

  return (
    <aside
      className={[
        'relative flex h-full flex-col border-r border-white/5 bg-ink-800/80 backdrop-blur',
        'transition-[width] duration-300 ease-in-out',
        collapsed ? 'w-[76px]' : 'w-72',
      ].join(' ')}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-5">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent-600 shadow-glow">
          <Layers3 className="h-5 w-5 text-ink-900" strokeWidth={2.5} />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold tracking-tight text-white">
              Sonqollay
            </p>
            <p className="truncate text-[11px] font-medium text-slate-400">
              Todas las disciplinas
            </p>
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="mx-3 mb-2 rounded-lg border border-white/5 bg-ink-700/60 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Elementos totales</p>
          <p className="text-lg font-bold text-accent text-glow">{totalElements.toLocaleString('es-CL')}</p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {disciplines.map((d) => {
          const active = d.id === activeDiscipline
          const count = d.subcategories.reduce((s, sc) => s + (sc.count || 0), 0)
          return (
            <button
              key={d.id}
              onClick={() => onSelect(d.id)}
              title={collapsed ? d.name : undefined}
              className={[
                'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                active
                  ? 'bg-accent/10 text-white ring-1 ring-accent/40'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
              ].join(' ')}
            >
              <Icon
                name={d.icon}
                className={[
                  'h-[18px] w-[18px] shrink-0 transition-colors',
                  active ? 'text-accent' : 'text-slate-500 group-hover:text-slate-300',
                ].join(' ')}
              />
              {!collapsed && (
                <>
                  <span className="flex-1 truncate font-medium">{d.name}</span>
                  {count > 0 && (
                    <span
                      className={[
                        'rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                        active ? 'bg-accent/20 text-accent' : 'bg-white/5 text-slate-400',
                      ].join(' ')}
                    >
                      {count}
                    </span>
                  )}
                </>
              )}
            </button>
          )
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-7 grid h-6 w-6 place-items-center rounded-full border border-white/10 bg-ink-700 text-slate-300 shadow-card transition hover:text-accent"
        aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>

      <div className="border-t border-white/5 px-4 py-3">
        {!collapsed ? (
          <p className="text-[10px] leading-relaxed text-slate-500">
            AWP · BIM · Control Documental
            <br />
            <span className="text-slate-600">v0.1 · Premium Dark</span>
          </p>
        ) : (
          <div className="mx-auto h-1.5 w-1.5 rounded-full bg-accent/60" />
        )}
      </div>
    </aside>
  )
}
