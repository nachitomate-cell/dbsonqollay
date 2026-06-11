import { useEffect, useReducer, useState } from 'react'
import { CloudOff, HardDrive, Loader2, RefreshCw, TriangleAlert } from 'lucide-react'
import { flush, isFlushing, isOnline, stuckCount, subscribe, unsyncedCount } from '../lib/offline.js'

/**
 * Banner de estado de conexión/sincronización para PANTALLAS CHICAS (teléfono).
 * En escritorio basta el chip del header (OfflineIndicator); en móvil ese chip
 * queda como un ícono diminuto, así que acá mostramos una franja clara y ancha
 * bajo el header. Solo aparece si hay algo que comunicar.
 */
export default function OfflineBanner() {
  const [, force] = useReducer((n) => n + 1, 0)
  const [storageFull, setStorageFull] = useState(false)
  useEffect(() => {
    const un = subscribe(force)
    const onFull = () => setStorageFull(true)
    window.addEventListener('online', force)
    window.addEventListener('offline', force)
    window.addEventListener('sqy-storage-full', onFull)
    return () => { un(); window.removeEventListener('online', force); window.removeEventListener('offline', force); window.removeEventListener('sqy-storage-full', onFull) }
  }, [])

  const online = isOnline()
  const unsynced = unsyncedCount()
  const stuck = stuckCount()
  const flushing = isFlushing()
  if (!storageFull && online && !unsynced && !flushing) return null

  const wrap = 'flex items-center gap-2 px-4 py-2 text-xs font-semibold md:hidden'

  if (storageFull) {
    return (
      <div className={`${wrap} border-b border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300`}>
        <HardDrive className="h-4 w-4 shrink-0" />
        <span>Almacenamiento del equipo lleno. Sincroniza y recarga para liberar espacio.</span>
      </div>
    )
  }
  if (!online) {
    return (
      <div className={`${wrap} border-b border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300`}>
        <CloudOff className="h-4 w-4 shrink-0" />
        <span>Sin conexión{unsynced ? ` — ${unsynced} cambio(s) guardados en este equipo. Se sincronizan al reconectar.` : ' — tus cambios se guardan en este equipo.'}</span>
      </div>
    )
  }
  if (flushing) {
    return (
      <div className={`${wrap} border-b border-brand-200 bg-brand-50 text-brand-700 dark:border-accent/30 dark:bg-accent/10 dark:text-accent`}>
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        <span>Sincronizando cambios…</span>
      </div>
    )
  }
  if (stuck) {
    return (
      <button onClick={() => flush({ retryStuck: true })} className={`${wrap} w-full border-b border-rose-200 bg-rose-50 text-left text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300`}>
        <TriangleAlert className="h-4 w-4 shrink-0" />
        <span className="flex-1">{stuck} cambio(s) no se sincronizaron.</span>
        <span className="rounded-md bg-rose-600 px-2 py-1 text-white">Reintentar</span>
      </button>
    )
  }
  return (
    <button onClick={() => flush()} className={`${wrap} w-full border-b border-amber-200 bg-amber-50 text-left text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300`}>
      <RefreshCw className="h-4 w-4 shrink-0" />
      <span className="flex-1">{unsynced} cambio(s) sin sincronizar.</span>
      <span className="rounded-md bg-amber-600 px-2 py-1 text-white">Sincronizar</span>
    </button>
  )
}
