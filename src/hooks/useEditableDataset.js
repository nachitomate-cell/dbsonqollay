import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadWorking, removeWorking, saveWorking } from '../utils/datastore'

/**
 * Capa editable sobre un dataset (headers + rows). Permite editar valores,
 * agregar/quitar/ocultar columnas y agregar/eliminar registros. Cada fila
 * recibe un `_id` estable para identificarla pese a orden/filtros. El estado se
 * persiste vía datastore (hoy localStorage; ver utils/datastore.js).
 *
 * Retorna: { columns, rows, addColumn, removeColumn, toggleColumn,
 *            updateRecord, updateRecords, addRecord, addRecords, deleteRecord,
 *            reset, dirty }
 *   - columns: [{ key, visible }]
 */
let _seq = 0
const genId = () => `r${Date.now().toString(36)}_${(_seq++).toString(36)}`

// Regla de negocio: TODO valor de texto de las planillas se almacena en
// MAYÚSCULAS. `upper` no toca números, null/undefined ni el `_id` de la fila.
const upper = (v) => (typeof v === 'string' ? v.toUpperCase() : v)
// Aplica `upper` a todos los valores de un patch/fila, preservando `_id`.
const upperPatch = (obj) => {
  const out = {}
  for (const k in obj) out[k] = k === '_id' ? obj[k] : upper(obj[k])
  return out
}
const upperRows = (rows) => (rows ?? []).map(upperPatch)

function build(dataset) {
  const columns = (dataset?.headers ?? []).map((h) => ({ key: h, visible: true }))
  // Migra a MAYÚSCULAS lo ya ingresado al construir el estado editable.
  const rows = (dataset?.rows ?? []).map((r) => ({ ...upperPatch(r), _id: genId() }))
  return { columns, rows, dirty: false }
}

function init(dataKey, dataset) {
  const p = loadWorking(dataKey)
  // También normaliza a MAYÚSCULAS el trabajo previo guardado en localStorage.
  if (p) return { ...p, rows: upperRows(p.rows), dirty: true }
  return build(dataset)
}

// Profundidad máxima del historial de deshacer/rehacer. Como las mutaciones son
// inmutables (cada cambio crea nuevos arrays), guardar estados previos es barato
// (solo referencias), pero igual lo acotamos para no acumular sin límite.
const HISTORY_LIMIT = 60

export function useEditableDataset(dataKey, dataset) {
  // Historial: { past:[], present, future:[] }. Cada mutación empuja el estado
  // actual a `past` y limpia `future`; deshacer/rehacer mueven entre las pilas.
  const [hist, setHist] = useState(() => ({ past: [], present: init(dataKey, dataset), future: [] }))
  const state = hist.present

  useEffect(() => {
    if (state.dirty) saveWorking(dataKey, state)
  }, [dataKey, state])

  const mutate = (fn) => setHist((h) => {
    const next = { ...fn(h.present), dirty: true }
    if (next.rows === h.present.rows && next.columns === h.present.columns) return h // no-op
    return { past: [...h.past, h.present].slice(-HISTORY_LIMIT), present: next, future: [] }
  })

  const undo = useCallback(() => setHist((h) => {
    if (!h.past.length) return h
    return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future].slice(0, HISTORY_LIMIT) }
  }), [])
  const redo = useCallback(() => setHist((h) => {
    if (!h.future.length) return h
    return { past: [...h.past, h.present].slice(-HISTORY_LIMIT), present: h.future[0], future: h.future.slice(1) }
  }), [])

  const api = useMemo(
    () => ({
      addColumn(name) {
        const key = String(name || '').trim()
        if (!key) return
        mutate((s) =>
          s.columns.some((c) => c.key === key)
            ? s
            : {
                ...s,
                columns: [...s.columns, { key, visible: true }],
                rows: s.rows.map((r) => ({ ...r, [key]: r[key] ?? '' })),
              },
        )
      },
      removeColumn(key) {
        mutate((s) => ({ ...s, columns: s.columns.filter((c) => c.key !== key) }))
      },
      toggleColumn(key) {
        mutate((s) => ({
          ...s,
          columns: s.columns.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c)),
        }))
      },
      // Reordena columnas: mueve `fromKey` a la posición de `toKey`.
      moveColumn(fromKey, toKey) {
        mutate((s) => {
          const from = s.columns.findIndex((c) => c.key === fromKey)
          const to = s.columns.findIndex((c) => c.key === toKey)
          if (from < 0 || to < 0 || from === to) return s
          const cols = [...s.columns]
          const [moved] = cols.splice(from, 1)
          cols.splice(to, 0, moved)
          return { ...s, columns: cols }
        })
      },
      updateRecord(id, patch) {
        const up = upperPatch(patch)
        mutate((s) => ({ ...s, rows: s.rows.map((r) => (r._id === id ? { ...r, ...up } : r)) }))
      },
      addRecord() {
        const blank = { _id: genId() }
        mutate((s) => {
          s.columns.forEach((c) => (blank[c.key] = ''))
          return { ...s, rows: [blank, ...s.rows] }
        })
        return blank._id
      },
      // Inserta una fila (con datos opcionales) arriba o abajo de otra fila.
      // Sirve para "pegar" y "duplicar" desde el menú contextual. Devuelve el
      // _id de la nueva fila. Si no se encuentra `referenceId`, la pone arriba.
      insertRecord(referenceId, data, where = 'below') {
        const _id = genId()
        mutate((s) => {
          const row = { _id }
          s.columns.forEach((c) => (row[c.key] = upper(data?.[c.key] ?? '')))
          const idx = s.rows.findIndex((r) => r._id === referenceId)
          const rows = [...s.rows]
          if (idx < 0) rows.unshift(row)
          else rows.splice(where === 'above' ? idx : idx + 1, 0, row)
          return { ...s, rows }
        })
        return _id
      },
      // Importación masiva: agrega varias filas y crea las columnas que falten.
      addRecords(incoming) {
        const list = Array.isArray(incoming) ? incoming : []
        if (!list.length) return 0
        mutate((s) => {
          const known = new Set(s.columns.map((c) => c.key))
          const newCols = []
          list.forEach((r) => Object.keys(r).forEach((k) => {
            if (k !== '_id' && !known.has(k)) { known.add(k); newCols.push({ key: k, visible: true }) }
          }))
          const columns = [...s.columns, ...newCols]
          const rows = list.map((r) => {
            const row = { _id: genId() }
            columns.forEach((c) => (row[c.key] = upper(r[c.key] ?? '')))
            return row
          })
          return { ...s, columns, rows: [...rows, ...s.rows] }
        })
        return list.length
      },
      // Edición múltiple: aplica el mismo patch a varias filas por _id.
      updateRecords(ids, patch) {
        const set = new Set(ids || [])
        if (!set.size) return
        const up = upperPatch(patch)
        mutate((s) => ({ ...s, rows: s.rows.map((r) => (set.has(r._id) ? { ...r, ...up } : r)) }))
      },
      // Aplica patches DISTINTOS a varias filas en UNA sola operación (un solo
      // paso de deshacer). patches: { [id]: { col: valor, ... } }. Para pegar
      // un bloque de Excel sin que cada fila sea un paso de historial aparte.
      applyPatches(patches) {
        const ids = Object.keys(patches || {})
        if (!ids.length) return
        mutate((s) => ({ ...s, rows: s.rows.map((r) => (patches[r._id] ? { ...r, ...upperPatch(patches[r._id]) } : r)) }))
      },
      deleteRecord(id) {
        mutate((s) => ({ ...s, rows: s.rows.filter((r) => r._id !== id) }))
      },
      reset() {
        removeWorking(dataKey)
        setHist({ past: [], present: build(dataset), future: [] })
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dataKey, dataset],
  )

  return {
    columns: state.columns, rows: state.rows, dirty: state.dirty, ...api,
    undo, redo, canUndo: hist.past.length > 0, canRedo: hist.future.length > 0,
  }
}
