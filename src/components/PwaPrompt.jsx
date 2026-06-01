import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { Download, RefreshCw, WifiOff, X } from 'lucide-react'

/**
 * Avisos de la PWA (no intrusivos):
 *  - "Hay una nueva versión" → botón para actualizar (recarga con el SW nuevo).
 *  - "Listo para usar sin conexión" → confirmación efímera.
 *
 * El service worker se registra con autoUpdate; este componente solo muestra
 * los estados al usuario.
 */
export default function PwaPrompt() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [offlineReady, setOfflineReady] = useState(false)
  const [updateSW, setUpdateSW] = useState(() => () => {})

  useEffect(() => {
    const fn = registerSW({
      immediate: true,
      onNeedRefresh: () => setNeedRefresh(true),
      onOfflineReady: () => {
        setOfflineReady(true)
        setTimeout(() => setOfflineReady(false), 5000)
      },
    })
    setUpdateSW(() => fn)
  }, [])

  if (!needRefresh && !offlineReady) return null

  return (
    <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2">
      {needRefresh ? (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg ring-1 ring-black/5 dark:border-white/10 dark:bg-ink-800 dark:ring-white/5">
          <RefreshCw className="h-5 w-5 shrink-0 text-brand-500" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Hay una nueva versión de Sonqollay.</span>
          <button
            onClick={() => updateSW(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-600 dark:bg-accent dark:text-ink-900"
          >
            <Download className="h-4 w-4" /> Actualizar
          </button>
          <button onClick={() => setNeedRefresh(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-lg ring-1 ring-black/5 dark:border-white/10 dark:bg-ink-800 dark:text-slate-200 dark:ring-white/5">
          <WifiOff className="h-4 w-4 text-emerald-500" />
          Listo para usar sin conexión.
        </div>
      )}
    </div>
  )
}
