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

import { accessToken, activeProjectId, authFetch } from '../lib/auth.js'
import { idbDel, idbGet, idbSet } from '../lib/idbStore.js'
// Import circular con offline.js (que usa loadWorkingAsync): es seguro porque
// ninguno de los dos llama al otro al cargar el módulo, solo dentro de funciones.
import { hasPending } from '../lib/offline.js'

const KEY = (dataKey) => `sqy-ds-${dataKey}`
// Tope para el "hot cache" en localStorage. Las planillas más grandes que esto se
// guardan SOLO en IndexedDB (durable, sin tope), para no llenar localStorage y
// desalojar otras planillas. ~600k chars ≈ 1.2 MB.
const LS_MAX = 600_000
const getAPI = () => localStorage.getItem('sqy-api-url') || import.meta.env.VITE_APS_API || ''

/** ¿Hay sesión (real o de prueba) para leer/escribir en la nube? */
export const cloudEnabled = () => !!accessToken()

/**
 * Trae el dataset publicado en la base de datos (GET autenticado con el token de
 * la sesión: JWT real o 'demo'). Permite que la grilla RECUPERE lo guardado al
 * reabrir, en cualquier equipo (no solo del localStorage). Incluye la sesión de
 * prueba para que el cliente pueda probar la persistencia real. Devuelve
 * { headers, rows, ... } o null (sin sesión, sin backend, o no publicado).
 */
export async function fetchDbDataset(dataKey) {
  if (!accessToken()) return null // sin sesión, no hay nada que recuperar
  try {
    const p = activeProjectId()
    const res = await authFetch(`${getAPI()}/api/datasets/${encodeURIComponent(dataKey)}${p ? `?project=${p}` : ''}`, { cache: 'no-store' })
    if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return null
    const d = await res.json()
    return d && Array.isArray(d.rows) ? d : null
  } catch {
    return null
  }
}

/**
 * Lee el estado editable persistido del "hot cache" SÍNCRONO (localStorage).
 * Devuelve { columns, rows } o null. Las planillas grandes viven solo en
 * IndexedDB → para esas, esto devuelve null y se usa loadWorkingAsync.
 */
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

/**
 * Lee el estado editable desde donde esté: primero localStorage (instantáneo),
 * y si no está, IndexedDB (planillas grandes o desalojadas por cuota). Lo usan
 * la sincronización y la recuperación al abrir una planilla.
 */
export async function loadWorkingAsync(dataKey) {
  const local = loadWorking(dataKey)
  if (local) return local
  try {
    const v = await idbGet(KEY(dataKey))
    if (v?.columns && v?.rows) return v
  } catch {
    /* ignore */
  }
  return null
}

/**
 * Guarda el estado editable de una planilla. SIEMPRE lo persiste en IndexedDB
 * (copia durable, sin tope). Además lo deja en localStorage como caché rápido,
 * salvo que sea muy grande o la cuota esté llena (entonces queda solo en IDB,
 * sin perder nada). Devuelve true (los datos quedan a salvo en IndexedDB).
 */
export function saveWorking(dataKey, state) {
  idbSet(KEY(dataKey), state) // durable (async, no bloquea)
  let json
  try { json = JSON.stringify(state) } catch { return true }
  try {
    if (json.length <= LS_MAX) {
      localStorage.setItem(KEY(dataKey), json)
    } else {
      localStorage.removeItem(KEY(dataKey)) // muy grande: solo IndexedDB
    }
    return true
  } catch {
    // Cuota llena: el dato igual está en IndexedDB. Quitamos la versión vieja del
    // hot cache y avisamos a la UI (no perdemos cambios, pero conviene saberlo).
    try { localStorage.removeItem(KEY(dataKey)) } catch { /* ignore */ }
    try { window.dispatchEvent(new CustomEvent('sqy-storage-full', { detail: { dataKey } })) } catch { /* ignore */ }
    return true
  }
}

/** Borra el estado editable (vuelve al dataset base) de ambos almacenes. */
export function removeWorking(dataKey) {
  try { localStorage.removeItem(KEY(dataKey)) } catch { /* ignore */ }
  idbDel(KEY(dataKey))
}

// Columna de vínculo (TAG/Commodity) entre las columnas visibles.
const pickTagField = (headers) => headers.find((h) => /tag|commodity/i.test(h)) || headers[0] || null

/**
 * Publica TODAS las planillas dadas al bucket que lee el plugin de Navisworks
 * (mismo endpoint POST /api/datasets/:key que el botón "Publicar para Navisworks"
 * por hoja). Es idempotente.
 *
 * Orden de preferencia de la fuente de cada planilla:
 *   1. La copia LOCAL, solo si tiene cambios sin subir (está en la cola offline).
 *   2. La copia de la NUBE (la editaron en otro equipo, en otra sesión, o se
 *      corrigió en el servidor).
 *   3. La copia local aunque no tenga pendientes (sin nube disponible).
 *   4. El dataset base que viene con la app (planilla nunca tocada).
 *
 * El paso 2 es crítico: sin él, una planilla que ESTE navegador nunca abrió se
 * publicaba con los datos de fábrica y PISABA en la nube lo editado desde otro
 * equipo. De ahí el síntoma que reportó el cliente ("solo funciona si tienes
 * abierta la planilla que estás cargando"): había que abrir cada planilla para
 * que bajara la copia buena antes de sincronizar.
 *
 * entries: [{ key, name, headers, rows }] · opts: { author, onProgress({done,total,ok,fail}) }
 * Devuelve { ok, fail, total }.
 */
export async function syncAllToNavisworks(entries, { author, onProgress } = {}) {
  if (!cloudEnabled()) throw new Error('Inicia sesión para sincronizar a Navisworks.')
  const projectId = activeProjectId()
  const list = Array.isArray(entries) ? entries : []
  let ok = 0, fail = 0
  for (let i = 0; i < list.length; i++) {
    const e = list[i]
    try {
      // La copia local solo manda si tiene cambios SIN SUBIR (está en la cola).
      // Si no, es un caché que puede estar viejo: la nube es la fuente de verdad
      // (p. ej. una corrección de datos hecha en el servidor o desde otro equipo).
      // Antes la local ganaba siempre, y "Sincronizar todo" re-publicaba lo viejo.
      const working = hasPending(e.key) ? await loadWorkingAsync(e.key) : null
      const local = working?.rows?.length ? working : null
      const src = local || (await fetchDbDataset(e.key)) || (await loadWorkingAsync(e.key)) || null
      const columns = src?.columns?.length
        ? src.columns
        : (src?.headers?.length ? src.headers : (e.headers || [])).map((h) => ({ key: h, visible: true }))
      const rows = src?.rows?.length ? src.rows : (e.rows || [])
      const headers = columns.filter((c) => c.visible !== false).map((c) => c.key)
      const res = await authFetch(
        `${getAPI()}/api/datasets/${encodeURIComponent(e.key)}${projectId ? `?project=${projectId}` : ''}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: e.name || e.key,
            tagField: pickTagField(headers),
            headers,
            columns,
            rows: rows.map(({ _id, ...r }) => r),
            author,
          }),
        },
      )
      if (!res.ok) throw new Error(`${e.key}: HTTP ${res.status}`)
      ok++
    } catch { fail++ }
    onProgress?.({ done: i + 1, total: list.length, ok, fail })
  }
  return { ok, fail, total: list.length }
}
