/**
 * Almacén clave-valor mínimo sobre IndexedDB (sin dependencias).
 *
 * Se usa como copia DURABLE del estado editable de las planillas: a diferencia
 * de localStorage (~5 MB para todo el origen), IndexedDB maneja cientos de MB,
 * así una planilla minera grande no se pierde por falta de espacio.
 *
 * Todas las funciones degradan a no-op / null si IndexedDB no está disponible
 * (modo privado viejo, SSR, etc.), para no romper el flujo normal.
 */
const DB_NAME = 'sqy-offline'
const STORE = 'working'
const VERSION = 1
let dbPromise = null

function open() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    try {
      if (typeof indexedDB === 'undefined') return reject(new Error('sin IndexedDB'))
      const req = indexedDB.open(DB_NAME, VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    } catch (e) { reject(e) }
  })
  return dbPromise
}

function tx(mode, run) {
  return open().then((db) => new Promise((resolve, reject) => {
    let out
    const t = db.transaction(STORE, mode)
    t.oncomplete = () => resolve(out)
    t.onerror = () => reject(t.error)
    t.onabort = () => reject(t.error)
    const req = run(t.objectStore(STORE))
    if (req) req.onsuccess = () => { out = req.result }
  }))
}

/** Lee un valor (objeto) por clave. Devuelve null si no está o si falla. */
export const idbGet = (key) => tx('readonly', (s) => s.get(key)).catch(() => null)
/** Escribe un valor por clave. No-op si falla. */
export const idbSet = (key, val) => tx('readwrite', (s) => s.put(val, key)).catch(() => {})
/** Borra una clave. No-op si falla. */
export const idbDel = (key) => tx('readwrite', (s) => s.delete(key)).catch(() => {})
