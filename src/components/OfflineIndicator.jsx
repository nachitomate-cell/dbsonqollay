import { useEffect, useReducer } from 'react'
import { CloudOff, Loader2, RefreshCw } from 'lucide-react'
import { flush, isFlushing, isOnline, pendingCount, subscribe } from '../lib/offline.js'

/**
 * Chip de estado de conexión / sincronización (header). Solo se muestra cuando
 * hay algo que comunicar: sin conexión, sincronizando, o cambios pendientes.
 * Cuando todo está sincronizado y online, no estorba (no renderiza nada).
 */
export default function OfflineIndicator() {
  const [, force] = useReducer((n) => n + 1, 0)
  useEffect(() => {
    const un = subscribe(force)
    window.addEventListener('online', force)
    window.addEventListener('offline', force)
    return () => { un(); window.removeEventListener('online', force); window.removeEventListener('offline', force) }
  }, [])

  const online = isOnline()
  const pending = pendingCount()
  const flushing = isFlushing()
  if (online && !pending && !flushing) return null

  const base = 'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold'

  if (!online) {
    return (
      <span title={pending ? `Sin conexión. ${pending} planilla(s) con cambios guardados en este equipo; se sincronizarán al reconectar.` : 'Sin conexión. Tus cambios se guardan en este equipo y se sincronizan al reconectar.'}
        className={`${base} border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400`}>
        <CloudOff className="h-4 w-4" />
        <span className="hidden sm:inline">Sin conexión{pending ? ` · ${pending} sin sincronizar` : ''}</span>
      </span>
    )
  }
  if (flushing) {
    return (
      <span title="Sincronizando los cambios pendientes…" className={`${base} border-brand-200 bg-brand-50 text-brand-700 dark:border-accent/30 dark:bg-accent/10 dark:text-accent`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="hidden sm:inline">Sincronizando…</span>
      </span>
    )
  }
  // online + pendientes: ofrece sincronizar ahora.
  return (
    <button onClick={() => flush()} title={`${pending} planilla(s) pendientes de sincronizar. Clic para sincronizar ahora.`}
      className={`${base} border-amber-200 bg-amber-50 text-amber-700 transition hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400`}>
      <RefreshCw className="h-4 w-4" />
      <span className="hidden sm:inline">{pending} sin sincronizar · Sincronizar</span>
    </button>
  )
}
