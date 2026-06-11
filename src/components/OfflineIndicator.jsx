import { useEffect, useReducer, useState } from 'react'
import { CloudOff, HardDrive, Loader2, RefreshCw, TriangleAlert } from 'lucide-react'
import { flush, isFlushing, isOnline, lastSyncAt, stuckCount, subscribe, unsyncedCount } from '../lib/offline.js'

/** "hace 2 min" / "hace 1 h" a partir de un timestamp. */
function hace(ts) {
  if (!ts) return null
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000))
  if (s < 60) return 'hace un momento'
  const m = Math.round(s / 60)
  if (m < 60) return `hace ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.round(h / 24)} d`
}

/**
 * Chip de estado de conexión / sincronización (header). Solo se muestra cuando
 * hay algo que comunicar: sin conexión, sincronizando, pendientes o atascados.
 * Online y al día → no renderiza nada (no estorba).
 */
export default function OfflineIndicator() {
  const [, force] = useReducer((n) => n + 1, 0)
  const [storageFull, setStorageFull] = useState(false)
  useEffect(() => {
    const un = subscribe(force)
    const onFull = () => setStorageFull(true)
    window.addEventListener('online', force)
    window.addEventListener('offline', force)
    window.addEventListener('sqy-storage-full', onFull)
    // Refresca el "hace X min" cada 30 s sin depender de otros eventos.
    const t = setInterval(force, 30000)
    return () => { un(); clearInterval(t); window.removeEventListener('online', force); window.removeEventListener('offline', force); window.removeEventListener('sqy-storage-full', onFull) }
  }, [])

  const online = isOnline()
  const unsynced = unsyncedCount()
  const stuck = stuckCount()
  const flushing = isFlushing()

  const base = 'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold'
  const syncTip = lastSyncAt() ? ` · Última sincronización ${hace(lastSyncAt())}` : ''

  // Prioridad máxima: el almacenamiento del equipo está lleno (riesgo de perder
  // cambios). Se libera al sincronizar y recargar; avisamos para que no sea mudo.
  if (storageFull) {
    return (
      <span title="El almacenamiento de este equipo está lleno. Sincroniza (cuando haya red) y recarga para liberar espacio; mientras tanto, algunos cambios podrían no guardarse localmente."
        className={`${base} border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400`}>
        <HardDrive className="h-4 w-4" />
        <span className="hidden sm:inline">Almacenamiento lleno</span>
      </span>
    )
  }
  if (online && !unsynced && !flushing) return null

  if (!online) {
    return (
      <span title={`Sin conexión. ${unsynced ? `${unsynced} planilla(s) con cambios guardados en este equipo; se subirán al reconectar.` : 'Tus cambios se guardan en este equipo y se sincronizan al reconectar.'}${syncTip}`}
        className={`${base} border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400`}>
        <CloudOff className="h-4 w-4" />
        <span className="hidden sm:inline">Sin conexión{unsynced ? ` · ${unsynced} sin sincronizar` : ''}</span>
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
  // Online con atascados: fallaron varias veces, necesitan reintento manual.
  if (stuck) {
    return (
      <button onClick={() => flush({ retryStuck: true })} title={`${stuck} planilla(s) no se pudieron sincronizar tras varios intentos. Clic para reintentar.${syncTip}`}
        className={`${base} border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400`}>
        <TriangleAlert className="h-4 w-4" />
        <span className="hidden sm:inline">{stuck} sin sincronizar · Reintentar</span>
      </button>
    )
  }
  // Online con pendientes normales: ofrece sincronizar ahora.
  return (
    <button onClick={() => flush()} title={`${unsynced} planilla(s) pendientes de sincronizar. Clic para sincronizar ahora.${syncTip}`}
      className={`${base} border-amber-200 bg-amber-50 text-amber-700 transition hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400`}>
      <RefreshCw className="h-4 w-4" />
      <span className="hidden sm:inline">{unsynced} sin sincronizar · Sincronizar</span>
    </button>
  )
}
