import { Bell, ChevronRight, Download, Moon, Search, Settings, Sun } from 'lucide-react'

/**
 * Encabezado del área principal: breadcrumbs, búsqueda global, exportación del
 * proyecto, toggle de tema y acciones rápidas.
 *
 * props:
 *  - crumbs: [{ label, onClick? }]
 *  - theme: 'light' | 'dark'
 *  - onToggleTheme()
 *  - onExportProject()
 */
export default function Header({ crumbs = [], theme, onToggleTheme, onExportProject }) {
  const iconBtn =
    'grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:text-brand-600 dark:border-white/10 dark:bg-ink-800 dark:text-slate-400 dark:hover:text-accent'

  return (
    <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-slate-200 bg-white/80 px-6 py-3.5 backdrop-blur-xl dark:border-white/5 dark:bg-ink-900/70">
      {/* Breadcrumbs */}
      <nav className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1
          return (
            <span key={i} className="flex items-center gap-1.5 truncate">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-600" />}
              {c.onClick && !last ? (
                <button
                  onClick={c.onClick}
                  className="truncate font-medium text-slate-500 transition hover:text-brand-600 dark:text-slate-400 dark:hover:text-accent"
                >
                  {c.label}
                </button>
              ) : (
                <span
                  className={
                    last
                      ? 'truncate font-semibold text-slate-900 dark:text-white'
                      : 'truncate text-slate-500 dark:text-slate-400'
                  }
                >
                  {c.label}
                </span>
              )}
            </span>
          )
        })}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 md:flex dark:border-white/10 dark:bg-ink-800">
          <Search className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          <input
            placeholder="Buscar TAG, CWP, equipo…"
            className="w-48 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none dark:text-slate-200 dark:placeholder:text-slate-600"
          />
          <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-white/5">⌘K</kbd>
        </div>

        <button
          onClick={onExportProject}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-400 hover:text-brand-600 dark:border-white/10 dark:bg-ink-800 dark:text-slate-300 dark:hover:border-accent/40 dark:hover:text-accent"
          title="Exportar todo el proyecto a Excel (multi-hoja)"
        >
          <Download className="h-4 w-4" />
          <span className="hidden lg:inline">Exportar</span>
        </button>

        <button onClick={onToggleTheme} className={iconBtn} aria-label="Cambiar tema" title="Cambiar tema">
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <button className={iconBtn} aria-label="Notificaciones">
          <Bell className="h-4 w-4" />
        </button>
        <button className={iconBtn} aria-label="Configuración">
          <Settings className="h-4 w-4" />
        </button>
        <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-600 text-xs font-bold text-white">
          SQ
        </div>
      </div>
    </header>
  )
}
