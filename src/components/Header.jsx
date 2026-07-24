import { useEffect, useRef, useState } from 'react'
import { ArrowLeftRight, Bell, Building2, ChevronRight, Download, FlaskConical, HelpCircle, LayoutDashboard, Loader2, LogOut, Menu, Moon, Settings, SlidersHorizontal, Sparkles, Sun, Upload, Wifi, WifiOff, X } from 'lucide-react'
import InstallButton from './InstallButton.jsx'
import AuraMark from './AuraMark.jsx'
import GlobalSearch from './GlobalSearch.jsx'
import HelpModal from './HelpModal.jsx'
import ReleaseNotesModal from './ReleaseNotesModal.jsx'
import OfflineIndicator from './OfflineIndicator.jsx'
import { latestReleaseKey } from '../data/releaseNotes.js'

const NEWS_SEEN_KEY = 'sqy-news-seen'

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
 *  - theme, onToggleTheme(), onExportProject(), onImportProject(file), onOpenSettings()
 *  - user: { name?, email?, role? } · isDemo · onSignOut() · onChangeProject()
 */
export default function Header({ crumbs = [], theme, onToggleTheme, onExportProject, onImportProject, onSyncAll, syncingAll, onOpenSettings, onOpenProjectConfig, onOpenWorkspace, onOpenMobileNav, user, isDemo, onSignOut, onChangeProject, onChangeOrg, orgName, search, onSearchResult }) {
  const iconBtn =
    'grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:text-brand-600 dark:border-white/10 dark:bg-ink-800 dark:text-slate-400 dark:hover:text-accent'
  const iconBtnActive = 'border-brand-400 text-brand-600 dark:border-accent/40 dark:text-accent'
  const projectFileRef = useRef(null)

  const [notifOpen, setNotifOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [newsOpen, setNewsOpen] = useState(false)
  // Globo de "novedades sin leer": hay novedad si la última difiere de la vista.
  const [hasNews, setHasNews] = useState(() => {
    try { return latestReleaseKey() !== localStorage.getItem(NEWS_SEEN_KEY) } catch { return false }
  })
  const openNews = () => {
    setNewsOpen(true)
    try { localStorage.setItem(NEWS_SEEN_KEY, latestReleaseKey()) } catch { /* sin storage */ }
    setHasNews(false)
  }
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)

  // Atajo "?" (Shift+/) abre la ayuda, salvo que estés escribiendo en un campo.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '?' ) return
      const t = e.target
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      e.preventDefault(); setHelpOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const panel = 'absolute right-0 top-11 z-40 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-ink-800'

  return (
    <>
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/80 px-4 py-3.5 backdrop-blur-xl sm:gap-4 sm:px-6 dark:border-white/5 dark:bg-ink-900/70">
      {/* Hamburguesa (cajón lateral) — solo en pantallas chicas */}
      {onOpenMobileNav && (
        <button onClick={onOpenMobileNav} className={`${iconBtn} shrink-0 lg:hidden`} aria-label="Menú" title="Menú">
          <Menu className="h-4 w-4" />
        </button>
      )}

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
        {search && <GlobalSearch search={search} onResult={onSearchResult} />}

        <OfflineIndicator />

        <InstallButton />

        {onOpenWorkspace && (
          <button
            onClick={onOpenWorkspace}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 dark:bg-accent dark:text-ink-900"
            title="Workspace AWP: CWA / CWP / IWP"
          >
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden lg:inline">Workspace AWP</span>
          </button>
        )}

        {onSyncAll && (
          <button
            onClick={onSyncAll}
            disabled={syncingAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-400 hover:text-brand-600 disabled:opacity-60 dark:border-white/10 dark:bg-ink-800 dark:text-slate-300 dark:hover:border-accent/40 dark:hover:text-accent"
            title="Publicar TODAS las planillas a Navisworks (el plugin las leerá todas)"
          >
            {syncingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <AuraMark className="h-4 w-4" />}
            <span className="hidden lg:inline">{syncingAll ? 'Sincronizando…' : 'Sincronizar todo'}</span>
          </button>
        )}

        <button
          onClick={onExportProject}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-400 hover:text-brand-600 dark:border-white/10 dark:bg-ink-800 dark:text-slate-300 dark:hover:border-accent/40 dark:hover:text-accent"
          title="Exportar todo el proyecto a Excel (multi-hoja)"
        >
          <Download className="h-4 w-4" />
          <span className="hidden lg:inline">Exportar</span>
        </button>

        {/* Camino de vuelta de "Exportar": el mismo Excel, con cada hoja de
            regreso en su planilla. */}
        {onImportProject && (
          <>
            <input
              ref={projectFileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onImportProject(f) }}
            />
            <button
              onClick={() => projectFileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-400 hover:text-brand-600 dark:border-white/10 dark:bg-ink-800 dark:text-slate-300 dark:hover:border-accent/40 dark:hover:text-accent"
              title="Importar el Excel del proyecto: cada hoja vuelve a su planilla"
            >
              <Upload className="h-4 w-4" />
              <span className="hidden lg:inline">Importar</span>
            </button>
          </>
        )}

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

        {/* Novedades / notas de versión (plataforma + plugin) */}
        <button onClick={openNews} className={`${iconBtn} relative hidden sm:grid ${hasNews ? iconBtnActive : ''}`} aria-label="Novedades" title={hasNews ? 'Novedades — hay novedades nuevas' : 'Novedades — notas de versión'}>
          <Sparkles className="h-4 w-4" />
          {hasNews && (
            <span className="absolute right-1 top-1 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75 dark:bg-accent" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-500 ring-2 ring-white dark:bg-accent dark:ring-ink-900" />
            </span>
          )}
        </button>

        {/* Ayuda y atajos */}
        <button onClick={() => setHelpOpen(true)} className={`${iconBtn} hidden sm:grid`} aria-label="Ayuda" title="Ayuda y atajos (?)">
          <HelpCircle className="h-4 w-4" />
        </button>

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
              {(isDemo || orgName) && (
                <div className="mx-3 mb-1 flex flex-wrap items-center gap-1.5">
                  {orgName && <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300"><Building2 className="h-3.5 w-3.5" /> {orgName}</span>}
                  {isDemo && <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"><FlaskConical className="h-3.5 w-3.5" /> Prueba</span>}
                </div>
              )}
              <div className="my-1 border-t border-slate-100 dark:border-white/5" />
              {onOpenProjectConfig && (
                <button
                  onClick={() => { setUserOpen(false); onOpenProjectConfig() }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                >
                  <SlidersHorizontal className="h-4 w-4 text-slate-400" /> Configuración del proyecto
                </button>
              )}
              {onChangeOrg && (
                <button
                  onClick={() => { setUserOpen(false); onChangeOrg() }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                >
                  <Building2 className="h-4 w-4 text-slate-400" /> Cambiar organización
                </button>
              )}
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

    {/* Fuera del <header> (que tiene backdrop-blur y crea contexto de
        posicionamiento para los fixed): así el modal cubre toda la pantalla. */}
    <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    <ReleaseNotesModal open={newsOpen} onClose={() => setNewsOpen(false)} />
    </>
  )
}
