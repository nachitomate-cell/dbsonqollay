/**
 * Soporte offline (Fase 1) para las planillas.
 *
 * Idea: el dispositivo es la fuente de verdad mientras no hay red. Las ediciones
 * ya se guardan en localStorage (utils/datastore: saveWorking). Acá agregamos:
 *   - Un "outbox" (cola de cambios pendientes de subir), uno por planilla (dataKey),
 *     coalescado: solo importa el último estado de cada planilla.
 *   - Un motor que vacía la cola contra /api/datasets cuando vuelve la conexión.
 *   - Estado observable (online + pendientes) para el indicador del header.
 *
 * Política de conflictos (Fase 1): última-escritura-gana a nivel de planilla
 * (el POST reemplaza el dataset de esa key, igual que el autoguardado normal).
 * El merge fino por TAG queda para la Fase 2.
 */
import { authFetch } from './auth.js'
import { loadWorking } from '../utils/datastore.js'

const OUTBOX = 'sqy-outbox'
const listeners = new Set()
let flushing = false
let started = false

const apiBase = () => localStorage.getItem('sqy-api-url') || import.meta.env.VITE_APS_API || ''

function readOutbox() {
  try { return JSON.parse(localStorage.getItem(OUTBOX) || '{}') } catch { return {} }
}
function writeOutbox(o) {
  try { localStorage.setItem(OUTBOX, JSON.stringify(o)) } catch { /* cuota */ }
  notify()
}
function notify() { for (const cb of listeners) { try { cb() } catch { /* ignore */ } } }

/** ¿Hay conexión? (heurística del navegador). */
export function isOnline() { return typeof navigator === 'undefined' ? true : navigator.onLine !== false }
/** ¿Se está sincronizando ahora? */
export function isFlushing() { return flushing }
/** Cantidad de planillas con cambios pendientes de subir. */
export function pendingCount() { return Object.keys(readOutbox()).length }
/** Suscribe a cambios de estado (online/pendientes). Devuelve función para desuscribir. */
export function subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb) }

/**
 * Encola una planilla para subir cuando haya red. Solo guarda metadatos; el
 * contenido (filas/columnas) se lee de localStorage al momento de sincronizar,
 * así siempre sube el último estado y la cola se mantiene chica.
 */
export function enqueue(dataKey, { projectId = null, name = null, author = null } = {}) {
  if (!dataKey) return
  const o = readOutbox()
  o[dataKey] = { dataKey, projectId, name: name || dataKey, author, at: Date.now() }
  writeOutbox(o)
}

/** Saca una planilla de la cola (cuando se subió bien). */
export function dequeue(dataKey) {
  const o = readOutbox()
  if (o[dataKey] != null) { delete o[dataKey]; writeOutbox(o) }
}

/**
 * Vacía la cola: sube cada planilla pendiente al backend. Las que fallan quedan
 * en la cola para el próximo intento. Devuelve { ok, fail }.
 */
export async function flush() {
  if (flushing || !isOnline()) return { ok: 0, fail: 0 }
  const o = readOutbox()
  const keys = Object.keys(o)
  if (!keys.length) return { ok: 0, fail: 0 }
  flushing = true; notify()
  let ok = 0, fail = 0
  try {
    for (const k of keys) {
      const e = o[k]
      const ws = loadWorking(k)
      if (!ws || !Array.isArray(ws.rows)) { dequeue(k); continue } // nada que enviar
      const headers = (ws.columns || []).map((c) => c.key)
      const body = {
        name: e.name,
        tagField: headers[0],
        headers,
        columns: ws.columns,
        rows: ws.rows.map(({ _id, ...r }) => r),
        author: e.author,
      }
      try {
        const res = await authFetch(`${apiBase()}/api/datasets/${encodeURIComponent(k)}${e.projectId ? `?project=${e.projectId}` : ''}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const ct = res.headers.get('content-type') || ''
        const j = ct.includes('application/json') ? await res.json() : {}
        if (!res.ok) throw new Error(j.error || `Error ${res.status}`)
        if (j.db && (j.db.error || j.db.skipped)) throw new Error('db-no-config')
        dequeue(k); ok++
      } catch { fail++ } // queda en la cola para reintentar
    }
  } finally { flushing = false; notify() }
  return { ok, fail }
}

/**
 * Arranca el motor de sincronización (una sola vez): vacía la cola al volver la
 * red, reintenta periódicamente, y un intento inicial al cargar (por si quedó
 * algo de una sesión offline previa).
 */
export function initSync() {
  if (started || typeof window === 'undefined') return
  started = true
  const tryFlush = () => { notify(); if (isOnline() && pendingCount()) flush() }
  window.addEventListener('online', tryFlush)
  window.addEventListener('offline', notify)
  setInterval(() => { if (isOnline() && pendingCount()) flush() }, 30000)
  setTimeout(tryFlush, 1500)
}
