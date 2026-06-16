import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cloudEnabled, fetchDbDataset, loadWorking, loadWorkingAsync, removeWorking, saveWorking } from '../utils/datastore'

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

// Quita columnas con `key` repetida: el import masivo puede traer headers
// duplicados, y como las filas solo tienen UNA clave por nombre, la segunda
// columna mostraría lo mismo y rompería las `key` de React. Conserva la 1ª.
const dedupeCols = (cols) => {
  const seen = new Set()
  return (cols ?? []).filter((c) => c && c.key != null && !seen.has(c.key) && seen.add(c.key))
}
const colsFromHeaders = (headers) => dedupeCols((headers ?? []).map((h) => ({ key: h, visible: true })))

// Nota (camino B): la columna identidad `ID` NO se inventa al abrir una planilla.
// Solo existe donde ya viene materializada: planillas nuevas (defaultColumns) o
// datasets ya migrados/conectados al modelo (scripts/migrate-id-from-tag.mjs).
// Para los datasets sin `ID` la llave de vínculo con el 3D sigue siendo la 1ª
// columna (el TAG), igual que antes. Así, los datos de un cliente nuevo se cargan
// tal cual, sin congelar/bloquear una columna arbitraria como ID.
function build(dataset) {
  const columns = colsFromHeaders(dataset?.headers)
  // Migra a MAYÚSCULAS lo ya ingresado al construir el estado editable.
  const rows = (dataset?.rows ?? []).map((r) => ({ ...upperPatch(r), _id: genId() }))
  return { columns, rows, dirty: false }
}

function init(dataKey, dataset) {
  const p = loadWorking(dataKey)
  // También normaliza a MAYÚSCULAS el trabajo previo guardado en localStorage.
  if (p) return { ...p, columns: dedupeCols(p.columns), rows: upperRows(p.rows), dirty: true }
  return build(dataset)
}

// ¿El estado `a` ya muestra el mismo contenido que el de la nube `b`? Compara
// las filas por las columnas de `b` (ignora `_id` y columnas ocultas). Sirve para
// NO re-renderizar la grilla cuando la nube coincide con lo que ya se ve (evita
// el "parpadeo"/salto al abrir una planilla).
function sameData(a, b) {
  const keys = b.columns.map((c) => c.key)
  if ((a.rows?.length ?? 0) !== (b.rows?.length ?? 0)) return false
  for (let i = 0; i < b.rows.length; i++) {
    const ra = a.rows[i], rb = b.rows[i]
    if (!ra) return false
    for (const k of keys) if (String(ra[k] ?? '') !== String(rb[k] ?? '')) return false
  }
  return true
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
  const userEditedRef = useRef(false) // ¿el usuario editó en esta sesión? (no pisar con la DB)
  // Carga inicial desde la nube: solo BLOQUEA con "cargando" cuando NO hay caché
  // local (primer ingreso) — así no se muestran datos viejos y luego saltan. Si
  // ya hay caché, se muestra al instante y la nube solo actualiza si difiere.
  const [loading, setLoading] = useState(() => cloudEnabled() && loadWorking(dataKey) == null)

  useEffect(() => {
    if (state.dirty) saveWorking(dataKey, state)
  }, [dataKey, state])

  // Recuperación offline desde IndexedDB: si al montar NO había trabajo en
  // localStorage (planilla grande guardada solo en IndexedDB, o desalojada por
  // cuota), recupéralo para no mostrar el dataset base en su lugar. Son ediciones
  // locales sin subir → marcamos userEdited para que la nube no las pise.
  useEffect(() => {
    if (loadWorking(dataKey) != null) return // el hot cache ya lo tiene
    let cancelled = false
    loadWorkingAsync(dataKey).then((p) => {
      if (cancelled || !p?.rows) return
      setHist((h) => {
        if (userEditedRef.current) return h
        const present = { columns: dedupeCols(p.columns), rows: upperRows(p.rows), dirty: true }
        if (sameData(h.present, present)) return h
        userEditedRef.current = true
        return { past: [], present, future: [] }
      })
    }).catch(() => { /* sin IDB: queda el dataset base */ })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey])

  // Al abrir la planilla, recupera de la BASE DE DATOS lo último guardado (la
  // fuente de verdad), para que los cambios persistan entre equipos/sesiones y no
  // dependan del localStorage. No pisa ediciones en curso (userEditedRef) ni
  // re-renderiza si la nube coincide con lo que ya se ve (sameData → sin parpadeo).
  useEffect(() => {
    let cancelled = false
    if (!cloudEnabled()) { setLoading(false); return }
    fetchDbDataset(dataKey).then((db) => {
      if (cancelled || !db) return
      const present = {
        // Usa el set completo de columnas (con visibilidad) si la DB lo trae; si
        // no (datasets viejos), reconstruye desde los headers visibles.
        columns: db.columns?.length ? dedupeCols(db.columns) : colsFromHeaders(db.headers),
        rows: (db.rows ?? []).map((r) => ({ ...upperPatch(r), _id: genId() })),
        dirty: false,
      }
      setHist((h) => {
        if (userEditedRef.current || sameData(h.present, present)) return h
        saveWorking(dataKey, present)
        return { past: [], present, future: [] }
      })
    }).catch(() => { /* sin DB: queda el localStorage / dataset base */ })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey])

  const mutate = (fn) => setHist((h) => {
    userEditedRef.current = true
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
    loading,
  }
}
