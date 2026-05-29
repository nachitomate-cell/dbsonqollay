import { Bell, ChevronRight, Search, Settings } from 'lucide-react'

/**
 * Encabezado del área principal. Muestra breadcrumbs de la navegación actual,
 * una búsqueda global y acciones rápidas.
 *
 * props:
 *  - crumbs: [{ label, onClick? }]
 */
export default function Header({ crumbs = [] }) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-white/5 bg-ink-900/70 px-6 py-3.5 backdrop-blur-xl">
      {/* Breadcrumbs */}
      <nav className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1
          return (
            <span key={i} className="flex items-center gap-1.5 truncate">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-600" />}
              {c.onClick && !last ? (
                <button
                  onClick={c.onClick}
                  className="truncate font-medium text-slate-400 transition hover:text-accent"
                >
                  {c.label}
                </button>
              ) : (
                <span className={last ? 'truncate font-semibold text-white' : 'truncate text-slate-400'}>
                  {c.label}
                </span>
              )}
            </span>
          )
        })}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-lg border border-white/10 bg-ink-800 px-3 py-2 md:flex">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            placeholder="Buscar TAG, CWP, equipo…"
            className="w-48 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none"
          />
          <kbd className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-500">⌘K</kbd>
        </div>

        <button className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-ink-800 text-slate-400 transition hover:text-accent">
          <Bell className="h-4 w-4" />
        </button>
        <button className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-ink-800 text-slate-400 transition hover:text-accent">
          <Settings className="h-4 w-4" />
        </button>
        <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-accent to-accent-600 text-xs font-bold text-ink-900">
          SQ
        </div>
      </div>
    </header>
  )
}
