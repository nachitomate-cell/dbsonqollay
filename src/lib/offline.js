/**
 * Soporte offline para las planillas — Fase 1 + Fase 2.
 *
 * Idea: el dispositivo es la fuente de verdad mientras no hay red. Las ediciones
 * ya se guardan en localStorage (utils/datastore: saveWorking). Acá:
 *   - Un "outbox" (cola de cambios pendientes de subir), uno por planilla (dataKey),
 *     coalescado: solo importa el último estado de cada planilla.
 *   - Un motor que vacía la cola contra /api/datasets al volver la conexión.
 *   - Estado observable (online + pendientes + atascados + última sync).
 *
 * Fase 2:
 *   - La cola es la ÚNICA fuente de verdad de "falta subir": se encola SIEMPRE
 *     al guardar (no solo cuando falla) y se quita al subir bien. Así, si se
 *     corta a mitad o se cierra la pestaña, el cambio se sincroniza al reabrir.
 *   - Límite de reintentos: tras varios fallos, la planilla queda "atascada"
 *     (stuck) y se muestra para reintento manual, en vez de reintentar para
 *     siempre en silencio.
 *   - Marca de "última sincronización".
 *
 * Política de conflictos (Fase 1/2): última-escritura-gana por planilla (el POST
 * reemplaza el dataset de esa key). El merge fino por TAG queda para Fase 3 (sin
 * tracking por fila, un merge ingenuo re-agregaría filas borradas localmente).
 */
import { authFetch } from './auth.js'
import { loadWorking } from '../utils/datastore.js'

const OUTBOX = 'sqy-outbox'
const LASTSYNC = 'sqy-last-sync'
const MAX_ATTEMPTS = 6 // tras estos fallos seguidos, la planilla queda "atascada"
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
/** Total de planillas con cambios sin subir (pendientes + atascadas). */
export function unsyncedCount() { return Object.keys(readOutbox()).length }
/** Planillas que fallaron repetidas veces y esperan reintento manual. */
export function stuckCount() { return Object.values(readOutbox()).filter((e) => e.stuck).length }
/** Marca de tiempo de la última sincronización exitosa (ms) o null. */
export function lastSyncAt() { const v = localStorage.getItem(LASTSYNC); return v ? Number(v) : null }
/** Suscribe a cambios de estado. Devuelve función para desuscribir. */
export function subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb) }

function markSynced() { try { localStorage.setItem(LASTSYNC, String(Date.now())) } catch { /* ignore */ } }

/**
 * Encola/refresca una planilla para subir. Resetea los reintentos (es un cambio
 * nuevo). Solo guarda metadatos; el contenido se lee de localStorage al subir.
 */
export function enqueue(dataKey, { projectId = null, name = null, author = null } = {}) {
  if (!dataKey) return
  const o = readOutbox()
  const prev = o[dataKey]
  o[dataKey] = {
    dataKey,
    projectId: projectId ?? prev?.projectId ?? null,
    name: name || prev?.name || dataKey,
    author: author ?? prev?.author ?? null,
    at: Date.now(),
    attempts: 0,
    stuck: false,
  }
  writeOutbox(o)
}

/** Saca una planilla de la cola (cuando se subió bien). */
export function dequeue(dataKey) {
  const o = readOutbox()
  if (o[dataKey] != null) { delete o[dataKey]; writeOutbox(o) }
}

function bumpAttempt(dataKey) {
  const o = readOutbox()
  const e = o[dataKey]
  if (!e) return
  e.attempts = (e.attempts || 0) + 1
  if (e.attempts >= MAX_ATTEMPTS) e.stuck = true
  writeOutbox(o)
}

/**
 * Vacía la cola: sube cada planilla pendiente. Las que fallan suman un intento;
 * tras MAX_ATTEMPTS quedan "atascadas" (se omiten hasta un reintento manual con
 * { retryStuck: true }). Devuelve { ok, fail }.
 */
export async function flush({ retryStuck = false } = {}) {
  if (flushing || !isOnline()) return { ok: 0, fail: 0 }
  const o = readOutbox()
  const keys = Object.keys(o).filter((k) => retryStuck || !o[k].stuck)
  if (!keys.length) return { ok: 0, fail: 0 }
  if (retryStuck) { for (const k of keys) { o[k].stuck = false; o[k].attempts = 0 } writeOutbox(o) }
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
        dequeue(k); ok++; markSynced()
      } catch { bumpAttempt(k); fail++ } // queda en la cola para reintentar
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
  const tryFlush = () => { notify(); if (isOnline() && unsyncedCount()) flush() }
  window.addEventListener('online', tryFlush)
  window.addEventListener('offline', notify)
  setInterval(() => { if (isOnline() && unsyncedCount() > stuckCount()) flush() }, 30000)
  setTimeout(tryFlush, 1500)
}
