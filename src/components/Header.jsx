import { useEffect, useState } from 'react'
import { ArrowLeftRight, Bell, ChevronRight, Download, FlaskConical, LogOut, Moon, Search, Settings, Sun, Wifi, WifiOff, X } from 'lucide-react'
import InstallButton from './InstallButton.jsx'

// Iniciales para el avatar a partir del nombre o el email.
function initials(user) {
  const base = user?.name || user?.email || 'SQ'
  const parts = String(base).replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean)
  const ini = (parts[0]?.[0] || '') + (parts[1]?.[0] || '')
  return (ini || base.slice(0, 2)).toUpperCase()
}

/**
 * Encabezado del área principal: breadcrumbs, búsqueda global, exportación del
 * proyecto, toggle de tema, acciones rápidas y menú de usuario.
 *
 * props:
 *  - crumbs: [{ label, onClick? }]
 *  - theme, onToggleTheme(), onExportProject(), onOpenSettings()
 *  - user: { name?, email?, role? } · isDemo · onSignOut() · onChangeProject()
 */
export default function Header({ crumbs = [], theme, onToggleTheme, onExportProject, onOpenSettings, user, isDemo, onSignOut, onChangeProject }) {
  const iconBtn =
    'grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:text-brand-600 dark:border-white/10 dark:bg-ink-800 dark:text-slate-400 dark:hover:text-accent'
  const iconBtnActive = 'border-brand-400 text-brand-600 dark:border-accent/40 dark:text-accent'

  const [notifOpen, setNotifOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const panel = 'absolute right-0 top-11 z-40 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-ink-800'

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
                <span className={last ? 'truncate font-semibold text-slate-900 dark:text-white' : 'truncate text-slate-500 dark:text-slate-400'}>
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

        <InstallButton />

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

        {notifOpen && <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />}

        {/* Notificaciones */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className={`${iconBtn} relative ${notifOpen ? iconBtnActive : ''}`}
            aria-label="Notificaciones"
            title="Notificaciones"
          >
            <Bell className="h-4 w-4" />
            {!online && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-ink-900" />}
          </button>
          {notifOpen && (
            <div className={panel}>
              <div className="flex items-center justify-between px-3 py-2">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Notificaciones</p>
                <button onClick={() => setNotifOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="h-3.5 w-3.5" /></button>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 text-sm">
                {online
                  ? <><Wifi className="h-4 w-4 text-emerald-500" /><span className="text-slate-600 dark:text-slate-300">En línea</span></>
                  : <><WifiOff className="h-4 w-4 text-amber-500" /><span className="text-slate-600 dark:text-slate-300">Sin conexión — trabajando con datos locales</span></>}
              </div>
              <p className="border-t border-slate-100 px-3 py-2.5 text-center text-xs text-slate-400 dark:border-white/5">No tienes notificaciones nuevas.</p>
            </div>
          )}
        </div>

        {/* Configuración — abre el panel lateral */}
        <button
          onClick={onOpenSettings}
          className={iconBtn}
          aria-label="Configuración"
          title="Configuración"
        >
          <Settings className="h-4 w-4" />
        </button>

        {/* Menú de usuario */}
        <div className="relative">
          {userOpen && <div className="fixed inset-0 z-30" onClick={() => setUserOpen(false)} />}
          <button
            onClick={() => setUserOpen((v) => !v)}
            title={user?.name || user?.email || 'Cuenta'}
            className={`relative z-40 grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-600 text-xs font-bold text-white ring-offset-2 transition hover:opacity-90 dark:ring-offset-ink-900 ${userOpen ? 'ring-2 ring-brand-400 dark:ring-accent/50' : ''}`}
          >
            {initials(user)}
          </button>
          {userOpen && (
            <div className={panel}>
              <div className="flex items-center gap-2.5 px-3 py-2.5">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-600 text-xs font-bold text-white">{initials(user)}</div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{user?.name || 'Sesión'}</p>
                  <p className="truncate text-xs text-slate-400">{user?.email || ''}</p>
                </div>
              </div>
              {isDemo && (
                <div className="mx-3 mb-1 flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                  <FlaskConical className="h-3.5 w-3.5" /> Sesión de prueba
                </div>
              )}
              <div className="my-1 border-t border-slate-100 dark:border-white/5" />
              {onChangeProject && (
                <button
                  onClick={() => { setUserOpen(false); onChangeProject() }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                >
                  <ArrowLeftRight className="h-4 w-4 text-slate-400" /> Cambiar proyecto
                </button>
              )}
              <button
                onClick={() => { setUserOpen(false); onSignOut?.() }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
              >
                <LogOut className="h-4 w-4" /> Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
