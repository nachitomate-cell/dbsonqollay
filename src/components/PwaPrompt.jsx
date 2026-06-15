import { useEffect, useRef, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { RefreshCw, WifiOff } from 'lucide-react'

/**
 * Avisos de la PWA (no intrusivos):
 *  - Nueva versión → se aplica AUTOMÁTICAMENTE (sin que el usuario haga clic): se
 *    activa el service worker nuevo y la página se recarga sola. Mostramos un
 *    toast breve "Actualizando…". Como los datos se autoguardan (y la navegación
 *    se persiste por proyecto), la recarga es segura.
 *  - "Listo para usar sin conexión" → confirmación efímera.
 */
export default function PwaPrompt() {
  const [updating, setUpdating] = useState(false)
  const [offlineReady, setOfflineReady] = useState(false)
  const updateRef = useRef(() => {})

  useEffect(() => {
    // Cuando el SW nuevo toma el control, recarga una vez para no mezclar chunks
    // viejos con nuevos. Guard para no entrar en bucle de recargas.
    if ('serviceWorker' in navigator) {
      let reloaded = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return
        reloaded = true
        window.location.reload()
      })
    }
    const fn = registerSW({
      immediate: true,
      onNeedRefresh: () => {
        // Aplica solo: activa el SW nuevo → controllerchange → recarga.
        setUpdating(true)
        updateRef.current(true)
      },
      onOfflineReady: () => {
        setOfflineReady(true)
        setTimeout(() => setOfflineReady(false), 5000)
      },
    })
    updateRef.current = fn
  }, [])

  if (!updating && !offlineReady) return null

  return (
    <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2">
      {updating ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-lg ring-1 ring-black/5 dark:border-white/10 dark:bg-ink-800 dark:text-slate-200 dark:ring-white/5">
          <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-brand-500" />
          Actualizando a la nueva versión…
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
