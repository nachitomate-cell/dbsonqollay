import { ArrowRight, ChevronLeft, ChevronRight, Globe } from 'lucide-react'
import Icon from './Icon.jsx'
import { disciplines } from '../data/disciplines.js'

/**
 * Menú lateral colapsable con las disciplinas de Sonqollay.
 *
 * props:
 *  - collapsed, onToggle()
 *  - activeDiscipline, onSelect(id)
 *  - onSelectAll(): item "Todas las disciplinas"
 */
export default function Sidebar({ collapsed, onToggle, activeDiscipline, onSelect, onSelectAll }) {
  return (
    <aside
      className={[
        'relative flex h-full flex-col border-r border-slate-200 bg-white transition-[width] duration-300 ease-in-out',
        'dark:border-white/5 dark:bg-ink-800/80 dark:backdrop-blur',
        collapsed ? 'w-[76px]' : 'w-72',
      ].join(' ')}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-5">
        <img src="/logo-mark.png" alt="Sonqollay" className="h-10 w-10 shrink-0 object-contain" />
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-base font-extrabold tracking-tight text-steel-700 dark:text-white">
              Sonqollay
            </p>
            <p className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Todas las disciplinas
            </p>
          </div>
        )}
      </div>

      {/* "Todas las disciplinas" */}
      <div className="px-3">
        <button
          onClick={onSelectAll}
          title={collapsed ? 'Todas las disciplinas' : undefined}
          className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
        >
          <Globe className="h-[18px] w-[18px] shrink-0 text-slate-500 dark:text-slate-400" />
          {!collapsed && <span className="flex-1 truncate">Todas las disciplinas</span>}
        </button>
      </div>

      <div className="mx-3 my-2 border-t border-slate-200 dark:border-white/5" />

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-2">
        {disciplines.map((d) => {
          const active = d.id === activeDiscipline
          return (
            <button
              key={d.id}
              onClick={() => onSelect(d.id)}
              title={collapsed ? d.name : undefined}
              className={[
                'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                active
                  ? 'bg-brand-500 text-white shadow-sm dark:bg-accent/15 dark:text-white dark:ring-1 dark:ring-accent/40'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100',
              ].join(' ')}
            >
              <Icon
                name={d.icon}
                className={[
                  'h-[18px] w-[18px] shrink-0 transition-colors',
                  active ? 'text-white dark:text-accent' : 'text-slate-500 group-hover:text-slate-700 dark:text-slate-500 dark:group-hover:text-slate-300',
                ].join(' ')}
              />
              {!collapsed && (
                <>
                  <span className="flex-1 truncate font-medium">{d.name}</span>
                  <span
                    className={[
                      'grid h-6 w-6 shrink-0 place-items-center rounded-full border transition-colors',
                      active
                        ? 'border-white/40 text-white dark:border-accent/40 dark:text-accent'
                        : 'border-slate-300 text-slate-400 group-hover:border-brand-400 group-hover:text-brand-500 dark:border-white/15 dark:text-slate-500 dark:group-hover:border-accent/40 dark:group-hover:text-accent',
                    ].join(' ')}
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </>
              )}
            </button>
          )
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-7 grid h-6 w-6 place-items-center rounded-full border border-slate-300 bg-white text-slate-500 shadow-md transition hover:text-brand-600 dark:border-white/10 dark:bg-ink-700 dark:text-slate-300 dark:hover:text-accent"
        aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>

      <div className="border-t border-slate-200 px-4 py-3 dark:border-white/5">
        {!collapsed ? (
          <p className="text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
            AWP · BIM · Control Documental
            <br />
            <span className="text-slate-300 dark:text-slate-600">v0.3 · Sonqollay</span>
          </p>
        ) : (
          <div className="mx-auto h-1.5 w-1.5 rounded-full bg-brand-500 dark:bg-accent/60" />
        )}
      </div>
    </aside>
  )
}
