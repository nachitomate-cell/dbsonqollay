/**
 * Importación del Excel de TODO el proyecto (el simétrico de projectExport.js).
 *
 * El export genera un libro multi-hoja: una hoja por subcategoría, nombrada con
 * su código (ARQ, MEC, ELE…). Acá se hace el camino de vuelta: cada hoja se
 * devuelve a SU planilla. Es el flujo que el cliente necesita —exportar todo,
 * editar en Excel, volver a subirlo— y evita el error de importar el libro
 * completo dentro de una sola planilla (que reemplazaba sus datos por los de
 * otra disciplina).
 *
 * El guardado reutiliza el camino ya probado: saveWorking (IndexedDB +
 * localStorage) + la cola offline, que sube cada planilla a la base de datos y
 * reintenta sola si se corta la red.
 */
import { loadWorkingAsync, saveWorking } from './datastore.js'
import { enqueue, flush, isOnline } from '../lib/offline.js'

/** Normaliza un nombre para comparar (sin acentos/espacios/símbolos). */
export const normKey = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '')

/**
 * Nombres de hoja con los que puede aparecer una subcategoría. El export usa
 * `code || name` recortado a 28 caracteres (límite de Excel), así que también
 * comparamos la versión recortada.
 */
export function sheetKeysOf(sub) {
  const out = new Set()
  for (const raw of [sub?.code, sub?.name]) {
    if (!raw) continue
    out.add(normKey(raw))
    out.add(normKey(String(raw).slice(0, 28)))
  }
  out.delete('')
  return out
}

/** ¿Alguno de los nombres de hoja corresponde a esta subcategoría? */
export function matchSheetFor(sub, sheetNames) {
  const keys = sheetKeysOf(sub)
  return sheetNames.find((n) => keys.has(normKey(n))) || null
}

let _seq = 0
const genId = () => `r${Date.now().toString(36)}_${(_seq++).toString(36)}`
// Misma regla de negocio que la grilla: los textos se guardan en MAYÚSCULAS.
const upper = (v) => (typeof v === 'string' ? v.toUpperCase() : v)

/** Convierte las filas de una hoja al estado editable { columns, rows }. */
function toState(headers, records) {
  const seen = new Set()
  const columns = headers
    .filter((h) => h != null && h !== '_id' && !seen.has(h) && seen.add(h))
    .map((key) => ({ key, visible: true }))
  const rows = records.map((r) => {
    const row = { _id: genId() }
    for (const c of columns) row[c.key] = upper(r[c.key] ?? '')
    return row
  })
  return { columns, rows, dirty: true }
}

/**
 * Lee el libro y arma el plan de importación SIN escribir nada: qué hoja va a
 * qué planilla, cuántas filas trae y cuántas tiene hoy. La escritura es un paso
 * aparte (applyProjectImport) para poder confirmarla antes.
 *
 * @returns {Promise<{ plan: Array, unmatched: string[], sheets: number }>}
 */
export async function planProjectImport(file, disciplines, { datasets = {}, createdSheets = {} } = {}) {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })

  // Hojas con datos: { nombre → { headers, records } }.
  const sheets = new Map()
  for (const name of wb.SheetNames) {
    const records = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' })
    if (!records.length) continue
    const headers = Object.keys(records[0]).filter((k) => k !== '_id')
    if (headers.length) sheets.set(name, { headers, records })
  }
  const names = [...sheets.keys()]

  const plan = []
  const used = new Set()
  const seenKeys = new Set()
  for (const d of disciplines || []) {
    for (const sub of d.subcategories || []) {
      const sheet = matchSheetFor(sub, names)
      if (!sheet || used.has(sheet)) continue
      // Planilla existente, o una "nueva" ya creada por el usuario; si la
      // subcategoría nunca tuvo datos, la hoja igual entra con una clave nueva.
      const dataKey = sub.dataKey || `new-${sub.id}`
      if (seenKeys.has(dataKey)) continue
      const { headers, records } = sheets.get(sheet)
      const current = await loadWorkingAsync(dataKey)
      used.add(sheet)
      seenKeys.add(dataKey)
      plan.push({
        sheet,
        dataKey,
        subId: sub.id,
        isNew: !sub.dataKey && !createdSheets[sub.id],
        name: sub.name,
        discipline: d.name,
        headers,
        records,
        fileRows: records.length,
        currentRows: current?.rows?.length ?? datasets[sub.dataKey]?.rows?.length ?? 0,
      })
    }
  }

  return { plan, unmatched: names.filter((n) => !used.has(n)), sheets: names.length }
}

/**
 * Escribe el plan: reemplaza cada planilla con su hoja y la deja encolada para
 * subir a la base de datos. Devuelve { rows, sheets, pending } — `pending` son
 * las planillas que aún no llegaron a la nube (quedan en la cola y se reintentan
 * solas al volver la conexión).
 */
export async function applyProjectImport(plan, { projectId = null, author = null, onProgress } = {}) {
  let rows = 0
  for (let i = 0; i < plan.length; i++) {
    const it = plan[i]
    saveWorking(it.dataKey, toState(it.headers, it.records))
    enqueue(it.dataKey, { projectId, name: it.name, author })
    rows += it.records.length
    onProgress?.({ done: i + 1, total: plan.length })
  }
  let pending = plan.length
  if (isOnline()) {
    const r = await flush()
    pending = Math.max(0, plan.length - r.ok)
  }
  return { rows, sheets: plan.length, pending }
}
