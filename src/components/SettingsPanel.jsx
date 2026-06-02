import { useState } from 'react'
import { Check, Info, Moon, Server, Sun, Trash2, X } from 'lucide-react'

const DEFAULT_API = import.meta.env.VITE_APS_API || (import.meta.env.DEV ? 'http://localhost:3000' : '')

export default function SettingsPanel({ open, onClose, theme, onToggleTheme, onClearSheets, onClearImports }) {
  const [apiUrl, setApiUrl] = useState(() => localStorage.getItem('sqy-api-url') || '')
  const [apiSaved, setApiSaved] = useState(false)
  const [clearing, setClearing] = useState(null)

  function saveApi() {
    const v = apiUrl.trim()
    v ? localStorage.setItem('sqy-api-url', v) : localStorage.removeItem('sqy-api-url')
    setApiSaved(true)
    setTimeout(() => setApiSaved(false), 2500)
  }

  function confirmClear(key, action) {
    if (clearing === key) {
      action()
      setClearing(null)
    } else {
      setClearing(key)
      setTimeout(() => setClearing((c) => (c === key ? null : c)), 3000)
    }
  }

  const label = 'mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5'
  const divider = 'space-y-4 pb-5 border-b border-slate-100 dark:border-white/5'

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      )}

      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-80 flex-col bg-white shadow-2xl transition-transform duration-300 dark:bg-ink-800 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Encabezado */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Configuración</h2>
          <button
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* Apariencia */}
          <div className={divider}>
            <p className={label}>Apariencia</p>
            <div className="flex gap-2">
              {[
                { val: 'light', icon: Sun, text: 'Claro' },
                { val: 'dark', icon: Moon, text: 'Oscuro' },
              ].map(({ val, icon: Icon, text }) => (
                <button
                  key={val}
                  onClick={() => theme !== val && onToggleTheme()}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition ${
                    theme === val
                      ? 'border-brand-500 bg-brand-50 text-brand-600 dark:border-accent dark:bg-accent/10 dark:text-accent'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-white/10 dark:text-slate-400'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {text}
                </button>
              ))}
            </div>
          </div>

          {/* Backend APS */}
          <div className={divider}>
            <p className={label}><Server className="h-3.5 w-3.5" /> Backend APS</p>
            <p className="mb-2 text-xs text-slate-400 dark:text-slate-500">
              Deja vacío para usar el mismo origen del frontend.
              {DEFAULT_API && <span className="block mt-0.5 font-mono text-[10px] truncate">{DEFAULT_API}</span>}
            </p>
            <input
              type="url"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveApi()}
              placeholder={DEFAULT_API || 'https://mi-backend.vercel.app'}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none dark:border-white/10 dark:bg-ink-700 dark:text-slate-200 dark:placeholder:text-slate-600 dark:focus:border-accent/50"
            />
            <button
              onClick={saveApi}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-500 py-2 text-sm font-medium text-white transition hover:bg-brand-600 dark:bg-accent dark:hover:bg-accent-600"
            >
              {apiSaved ? <><Check className="h-4 w-4" /> Guardado</> : 'Guardar URL'}
            </button>
          </div>

          {/* Datos locales */}
          <div className={divider}>
            <p className={label}><Trash2 className="h-3.5 w-3.5" /> Datos locales</p>
            <div className="space-y-2">
              {[
                { key: 'sheets', label: 'Limpiar planillas creadas', action: onClearSheets },
                { key: 'imports', label: 'Limpiar datasets importados', action: onClearImports },
              ].map(({ key, label: btnLabel, action }) => (
                <button
                  key={key}
                  onClick={() => confirmClear(key, action)}
                  className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                    clearing === key
                      ? 'border-red-400 bg-red-50 text-red-600 dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-400'
                      : 'border-slate-200 text-slate-600 hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-white/10 dark:text-slate-400 dark:hover:border-red-500/30 dark:hover:bg-red-500/5 dark:hover:text-red-400'
                  }`}
                >
                  {clearing === key ? '¿Confirmar? Clic de nuevo para borrar' : btnLabel}
                </button>
              ))}
            </div>
          </div>

          {/* Acerca de */}
          <div>
            <p className={label}><Info className="h-3.5 w-3.5" /> Acerca de</p>
            <div className="rounded-lg border border-slate-200 p-3 text-xs space-y-1 dark:border-white/10">
              {[
                ['Aplicación', 'Sonqollay'],
                ['Versión', 'v0.1.0'],
                ['Plataforma', 'AWP · BIM · EPC'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>{k}</span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
