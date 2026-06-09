import { lazy } from 'react'

/**
 * `lazy()` resistente a deploys: cuando cambia el build, los chunks viejos que
 * el navegador tenía cacheados (PWA/Service Worker) dejan de existir y el import
 * dinámico falla con "Failed to fetch dynamically imported module" (el server
 * devuelve el index.html → MIME text/html). Acá lo detectamos y RECARGAMOS una
 * vez: la recarga trae el index.html nuevo con los hashes correctos.
 *
 * Un flag en sessionStorage evita el bucle de recarga si tras recargar sigue
 * fallando (ahí sí propaga el error al ErrorBoundary).
 */
const FLAG = 'sqy-chunk-reloaded'

export function lazyWithReload(factory) {
  return lazy(() =>
    factory()
      .then((m) => { try { sessionStorage.removeItem(FLAG) } catch { /* ignore */ } return m })
      .catch((err) => {
        let already = false
        try { already = !!sessionStorage.getItem(FLAG) } catch { /* ignore */ }
        if (!already) {
          try { sessionStorage.setItem(FLAG, '1') } catch { /* ignore */ }
          window.location.reload()
          return new Promise(() => {}) // no resuelve: la recarga toma el control
        }
        throw err
      }),
  )
}
