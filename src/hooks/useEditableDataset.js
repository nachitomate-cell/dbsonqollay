import { useEffect, useMemo, useState } from 'react'
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

function build(dataset) {
  const columns = (dataset?.headers ?? []).map((h) => ({ key: h, visible: true }))
  const rows = (dataset?.rows ?? []).map((r) => ({ ...r, _id: genId() }))
  return { columns, rows, dirty: false }
}

function init(dataKey, dataset) {
  const p = loadWorking(dataKey)
  if (p) return { ...p, dirty: true }
  return build(dataset)
}

export function useEditableDataset(dataKey, dataset) {
  const [state, setState] = useState(() => init(dataKey, dataset))

  useEffect(() => {
    if (state.dirty) saveWorking(dataKey, state)
  }, [dataKey, state])

  const mutate = (fn) => setState((s) => ({ ...fn(s), dirty: true }))

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
      updateRecord(id, patch) {
        mutate((s) => ({ ...s, rows: s.rows.map((r) => (r._id === id ? { ...r, ...patch } : r)) }))
      },
      addRecord() {
        const blank = { _id: genId() }
        mutate((s) => {
          s.columns.forEach((c) => (blank[c.key] = ''))
          return { ...s, rows: [blank, ...s.rows] }
        })
        return blank._id
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
            columns.forEach((c) => (row[c.key] = r[c.key] ?? ''))
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
        mutate((s) => ({ ...s, rows: s.rows.map((r) => (set.has(r._id) ? { ...r, ...patch } : r)) }))
      },
      deleteRecord(id) {
        mutate((s) => ({ ...s, rows: s.rows.filter((r) => r._id !== id) }))
      },
      reset() {
        removeWorking(dataKey)
        setState(build(dataset))
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dataKey, dataset],
  )

  return { columns: state.columns, rows: state.rows, dirty: state.dirty, ...api }
}
