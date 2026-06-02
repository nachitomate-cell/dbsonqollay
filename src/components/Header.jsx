import { useEffect, useState } from 'react'
import { Bell, ChevronRight, Download, Moon, Search, Settings, Sun, Trash2, Wifi, WifiOff, X } from 'lucide-react'
import InstallButton from './InstallButton.jsx'

// Borra los datos editados guardados en localStorage (claves sqy-*) y recarga.
function clearLocalData() {
  if (!window.confirm('Esto borrará los cambios y modelos guardados localmente en este navegador y recargará la página. ¿Continuar?')) return
  try {
    Object.keys(localStorage).filter((k) => k.startsWith('sqy-')).forEach((k) => localStorage.removeItem(k))
  } catch { /* ignore */ }
  window.location.reload()
}

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
  const iconBtnActive = 'border-brand-400 text-brand-600 dark:border-accent/40 dark:text-accent'

  const [menu, setMenu] = useState(null) // 'notif' | 'settings' | null
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  const panel = 'absolute right-0 top-11 z-40 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-ink-800'
  const item = 'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 hover:text-brand-600 dark:text-slate-200 dark:hover:bg-white/5 dark:hover:text-accent'

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
        {menu && <div className="fixed inset-0 z-30" onClick={() => setMenu(null)} />}

        <div className="relative">
          <button onClick={() => setMenu((m) => (m === 'notif' ? null : 'notif'))} className={`${iconBtn} ${menu === 'notif' ? iconBtnActive : ''}`} aria-label="Notificaciones" title="Notificaciones">
            <Bell className="h-4 w-4" />
            {!online && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-ink-900" />}
          </button>
          {menu === 'notif' && (
            <div className={panel}>
              <div className="flex items-center justify-between px-3 py-2">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Notificaciones</p>
                <button onClick={() => setMenu(null)} className="text-slate-400 hover:text-slate-600"><X className="h-3.5 w-3.5" /></button>
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

        <div className="relative">
          <button onClick={() => setMenu((m) => (m === 'settings' ? null : 'settings'))} className={`${iconBtn} ${menu === 'settings' ? iconBtnActive : ''}`} aria-label="Configuración" title="Configuración">
            <Settings className="h-4 w-4" />
          </button>
          {menu === 'settings' && (
            <div className={panel}>
              <p className="px-3 py-2 text-sm font-bold text-slate-700 dark:text-slate-200">Configuración</p>
              <button className={item} onClick={() => { onToggleTheme?.(); setMenu(null) }}>
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                Tema: {theme === 'dark' ? 'oscuro' : 'claro'}
              </button>
              <button className={item} onClick={() => { setMenu(null); clearLocalData() }}>
                <Trash2 className="h-4 w-4 text-rose-500" />
                Borrar datos locales
              </button>
              <p className="border-t border-slate-100 px-3 py-2 text-center text-[11px] text-slate-400 dark:border-white/5">Sonqollay · Control de Ingeniería · v0.3</p>
            </div>
          )}
        </div>
        <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-600 text-xs font-bold text-white">
          SQ
        </div>
      </div>
    </header>
  )
}
