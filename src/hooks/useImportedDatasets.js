import { useCallback, useEffect, useState } from 'react'

/**
 * Hook de ingesta de datos: permite cargar archivos Excel (.xlsx/.xls) o CSV
 * (como los SQY_*) y registrarlos como nuevos datasets/subcategorías sin tocar
 * código. Los datos se persisten en localStorage para sobrevivir recargas.
 *
 * `xlsx` se importa dinámicamente solo al importar un archivo, para no inflar
 * el bundle inicial.
 *
 * Retorna:
 *  - datasets:  { [key]: { headers, rows, count } }
 *  - extraSubs: { [disciplineId]: [subcategoría, ...] }
 *  - importFile(file, disciplineId): Promise<subId>
 *  - removeImported(subId)
 *  - importing, error
 */
const lsKey = (projectId) => `sqy-imports-v1${projectId ? `-${projectId}` : ''}`

function loadPersisted(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return { datasets: {}, subs: {} }
    const parsed = JSON.parse(raw)
    return { datasets: parsed.datasets || {}, subs: parsed.subs || {} }
  } catch {
    return { datasets: {}, subs: {} }
  }
}

// CSV mínimo con soporte de comillas y autodetección de separador (, o ;).
function parseCsv(text) {
  const firstLine = text.slice(0, text.indexOf('\n') === -1 ? text.length : text.indexOf('\n'))
  const delim = (firstLine.match(/;/g)?.length || 0) > (firstLine.match(/,/g)?.length || 0) ? ';' : ','
  const rows = []
  let field = ''
  let row = []
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === delim) { row.push(field); field = '' }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (ch !== '\r') field += ch
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''))
}

function aoaToDataset(aoa) {
  // Headers únicos: si el archivo trae nombres de columna repetidos, se renombra
  // el duplicado ("ESTADO" → "ESTADO (2)") para no perder su dato (last-wins) ni
  // chocar las `key` de la grilla. No cambia la cantidad (mantiene la alineación
  // con las celdas de cada fila).
  const seen = new Map()
  const headers = (aoa[0] || []).map((h) => String(h ?? '').trim()).filter(Boolean).map((h) => {
    const n = (seen.get(h) || 0) + 1; seen.set(h, n)
    return n === 1 ? h : `${h} (${n})`
  })
  const ncol = headers.length
  const rows = []
  for (let i = 1; i < aoa.length; i++) {
    const r = aoa[i]
    if (!r || r.every((c) => c === '' || c == null)) continue
    if (r[0] === '' || r[0] == null) continue
    const rec = {}
    for (let c = 0; c < ncol; c++) {
      let v = r[c]
      if (v == null) v = ''
      // Los datos de las planillas se almacenan en MAYÚSCULAS (los números
      // y demás tipos no-texto se dejan tal cual).
      if (typeof v === 'string') v = v.toUpperCase()
      rec[headers[c]] = v
    }
    rows.push(rec)
  }
  return { headers, rows, count: rows.length }
}

export function useImportedDatasets(projectId) {
  const KEY = lsKey(projectId)
  const [{ datasets, subs }, setState] = useState(() => loadPersisted(KEY))
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ datasets, subs }))
    } catch {
      /* cuota excedida: se ignora la persistencia */
    }
  }, [KEY, datasets, subs])

  const importFile = useCallback(async (file, disciplineId) => {
    setImporting(true)
    setError(null)
    try {
      const name = file.name.replace(/\.[^.]+$/, '')
      const code = name.replace(/[^A-Za-z0-9]+/g, '').slice(0, 4).toUpperCase() || 'IMP'
      let dataset
      if (/\.csv$/i.test(file.name)) {
        dataset = aoaToDataset(parseCsv(await file.text()))
      } else {
        const XLSX = await import('xlsx')
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        dataset = aoaToDataset(XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true }))
      }
      if (!dataset.headers.length) throw new Error('No se detectaron columnas en el archivo.')

      const key = `imp_${Date.now()}`
      const subId = `imp-${Date.now()}`
      const sub = {
        id: subId,
        code,
        name: `${name} (${code})`,
        icon: 'Boxes',
        description: `Dataset importado desde ${file.name} · ${dataset.count} elementos.`,
        count: dataset.count,
        dataKey: key,
        imported: true,
      }
      setState((prev) => ({
        datasets: { ...prev.datasets, [key]: dataset },
        subs: { ...prev.subs, [disciplineId]: [...(prev.subs[disciplineId] || []), sub] },
      }))
      return subId
    } catch (e) {
      setError(e.message || 'Error al importar el archivo.')
      throw e
    } finally {
      setImporting(false)
    }
  }, [])

  const clearAll = useCallback(() => {
    setState({ datasets: {}, subs: {} })
  }, [])

  const removeImported = useCallback((subId) => {
    setState((prev) => {
      const subsCopy = {}
      let key = null
      for (const [disc, list] of Object.entries(prev.subs)) {
        const filtered = list.filter((s) => {
          if (s.id === subId) { key = s.dataKey; return false }
          return true
        })
        if (filtered.length) subsCopy[disc] = filtered
      }
      const dsCopy = { ...prev.datasets }
      if (key) delete dsCopy[key]
      return { datasets: dsCopy, subs: subsCopy }
    })
  }, [])

  return { datasets, extraSubs: subs, importFile, removeImported, clearAll, importing, error }
}
