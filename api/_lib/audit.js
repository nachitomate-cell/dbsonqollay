/**
 * Registro de cambios (audit log) de cada planilla: quién la editó, cuándo y
 * qué cambió (filas agregadas / eliminadas / modificadas).
 *
 * Se guarda como JSON en el mismo bucket de APS (audit/<key>.json), así NO
 * depende de Supabase: funciona ya, con el usuario de la sesión (real cuando el
 * login esté activo, o el de prueba mientras tanto).
 *
 * Coalescencia: ediciones seguidas del MISMO usuario (autosave cada ~1.5 s) se
 * agrupan en UNA "sesión de edición" (se actualiza su hora y conteo) en vez de
 * generar un evento por tecla. Un evento nuevo se abre al cambiar de usuario o
 * tras un hueco de inactividad.
 */
import { readJsonObject, putJsonObject } from './aps.js'

const COALESCE_MS = 10 * 60 * 1000 // 10 min: misma sesión de edición
const MAX_EVENTS = 100 // historial por planilla (los más nuevos)

const auditKey = (key) => `audit/${String(key).replace(/[^\w.\-]/g, '_')}.json`

/** Diferencia entre dos juegos de filas, emparejando por la columna TAG. */
function diffRows(oldRows, newRows, tagKey) {
  const norm = (r) => String(r?.[tagKey] ?? '').trim().toLowerCase()
  const oldMap = new Map((oldRows || []).map((r) => [norm(r), r]))
  const newMap = new Map((newRows || []).map((r) => [norm(r), r]))
  let added = 0, removed = 0, modified = 0
  for (const [k, nr] of newMap) {
    if (!k) continue
    if (!oldMap.has(k)) added++
    else if (JSON.stringify(oldMap.get(k)) !== JSON.stringify(nr)) modified++
  }
  for (const k of oldMap.keys()) if (k && !newMap.has(k)) removed++
  return { added, removed, modified }
}

/**
 * Registra una edición de la planilla `key`. Best-effort: nunca debe romper el
 * guardado (se llama en try/catch desde el handler). `getOld` lee el dataset
 * anterior solo cuando hace falta (al abrir una sesión nueva, para el diff).
 */
export async function recordDatasetEdit({ key, name, user, tagField, newRows, getOld, at }) {
  const okey = auditKey(key)
  const log = (await readJsonObject(okey)) || { key, events: [] }
  const events = Array.isArray(log.events) ? log.events : []
  const last = events[0]
  const now = at || new Date().toISOString()
  const author = user || 'desconocido'
  const toCount = Array.isArray(newRows) ? newRows.length : 0

  // ¿Misma sesión de edición? (mismo usuario, hueco corto) → actualiza el evento.
  if (last && last.user === author && Date.parse(now) - Date.parse(last.at) < COALESCE_MS) {
    last.at = now
    last.toCount = toCount
  } else {
    // Sesión nueva: calcula el diff contra el dataset anterior.
    let diff = { added: 0, removed: 0, modified: 0 }
    let fromCount = last?.toCount ?? 0
    try {
      const old = getOld ? await getOld() : null
      if (old && Array.isArray(old.rows)) {
        fromCount = old.rows.length
        diff = diffRows(old.rows, newRows, tagField || old.tagField || (old.headers || [])[0])
      }
    } catch { /* sin diff: igual registramos el evento */ }
    events.unshift({ at: now, user: author, name: name || key, fromCount, toCount, ...diff })
  }

  log.key = key
  log.name = name || log.name || key
  log.events = events.slice(0, MAX_EVENTS)
  await putJsonObject(okey, log)
  return log
}

/** Eventos de una planilla (más nuevos primero). */
export async function listDatasetAudit(key) {
  const log = await readJsonObject(auditKey(key))
  return Array.isArray(log?.events) ? log.events : []
}
