/**
 * Capa de acceso a datos de las planillas editables (estado { columns, rows }).
 *
 * Es el ÚNICO lugar de la app que sabe DÓNDE se guardan los datos. Hoy usa
 * localStorage (un solo navegador). Para pasar a multiusuario con Firestore se
 * reescribe SOLO este archivo (las funciones pasan a async y leen/escriben en
 * la nube). Ningún componente o hook necesita cambiar su lógica.
 *
 * Ver docs/firebase-migration.md para el plan completo.
 */

const KEY = (dataKey) => `sqy-ds-${dataKey}`

/** Lee el estado editable persistido. Devuelve { columns, rows } o null. */
export function loadWorking(dataKey) {
  try {
    const raw = localStorage.getItem(KEY(dataKey))
    if (!raw) return null
    const p = JSON.parse(raw)
    if (p?.columns && p?.rows) return p
  } catch {
    /* ignore */
  }
  return null
}

/** Guarda el estado editable de una planilla. */
export function saveWorking(dataKey, state) {
  try {
    localStorage.setItem(KEY(dataKey), JSON.stringify(state))
  } catch {
    /* cuota excedida */
  }
}

/** Borra el estado editable (vuelve al dataset base). */
export function removeWorking(dataKey) {
  try {
    localStorage.removeItem(KEY(dataKey))
  } catch {
    /* ignore */
  }
}
