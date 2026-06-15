/**
 * Coordina el guardado de cambios ANTES de recargar la app por una actualización
 * nueva (service worker). Objetivo: no perder nada.
 *
 * Dos fases:
 *   1) Confirmar borradores en curso: se quita el foco del input activo (su onBlur
 *      confirma la celda) y se emite el evento `sqy:commit-drafts` para que la
 *      ficha abierta guarde su borrador.
 *   2) Forzar el guardado a la base de datos (flushers registrados, p. ej. el
 *      "Guardar ahora" de la planilla).
 *
 * Como cada cambio confirmado ya se persiste en localStorage al instante, esto
 * cubre además lo no confirmado y lo que faltaba subir a la nube.
 */
const flushers = new Set()

// Registra un "flusher" (suele ser el guardado a la DB). Devuelve una función
// para desregistrarlo (usar en el cleanup del efecto).
export function onBeforeAppReload(fn) {
  flushers.add(fn)
  return () => flushers.delete(fn)
}

// Ejecuta el guardado completo y resuelve cuando terminó (best-effort: ningún
// fallo individual frena al resto ni a la actualización).
export async function flushBeforeAppReload() {
  // Fase 1: confirmar borradores en curso.
  try { document.activeElement?.blur?.() } catch { /* sin foco */ }
  try { window.dispatchEvent(new Event('sqy:commit-drafts')) } catch { /* noop */ }
  // Deja que React aplique los commits (setState) y que se escriba localStorage.
  await new Promise((r) => setTimeout(r, 150))
  // Fase 2: forzar el guardado a la nube de cada planilla abierta.
  await Promise.allSettled([...flushers].map((f) => {
    try { return Promise.resolve(f()) } catch { return null }
  }))
}
