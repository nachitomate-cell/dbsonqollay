/**
 * Exportación de todo el proyecto a un único Excel multi-hoja: una hoja por
 * cada subcategoría con datos (incluyendo importadas y las planillas nuevas
 * creadas por el usuario que ya tengan registros). Refleja las ediciones
 * guardadas vía datastore cuando existen; si no, usa el dataset base. `xlsx` se
 * importa de forma dinámica para no inflar el bundle.
 */
import { loadWorkingAsync } from './datastore'

async function resolveWorking(dataKey, base) {
  const p = await loadWorkingAsync(dataKey)
  if (p) {
    const headers = p.columns.filter((c) => c.visible).map((c) => c.key)
    return { headers, rows: p.rows }
  }
  return base ? { headers: base.headers, rows: base.rows } : null
}

// Ids de subcategorías con planilla nueva creada por el usuario (persistido).
function createdSheetIds() {
  try {
    return Object.keys(JSON.parse(localStorage.getItem('sqy-created-sheets-v2')) || {})
  } catch {
    return []
  }
}

// Nombre de hoja válido para Excel: ≤31 chars, sin : \ / ? * [ ], único.
function sheetName(raw, used) {
  let name = String(raw || 'Hoja').replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 28) || 'Hoja'
  let candidate = name
  let i = 2
  while (used.has(candidate.toLowerCase())) candidate = `${name.slice(0, 25)} ${i++}`
  used.add(candidate.toLowerCase())
  return candidate
}

/**
 * @returns {Promise<number>} cantidad de hojas exportadas (0 = sin datos).
 */
export async function exportProjectToExcel(datasets, disciplines) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  const used = new Set()
  let count = 0

  for (const d of disciplines) {
    for (const sc of d.subcategories) {
      // Subcategorías con datos base/importados.
      let dataKey = sc.dataKey
      // Planillas nuevas creadas por el usuario (sin datos base): dataKey sintético.
      if (!dataKey && createdSheetIds().includes(sc.id)) dataKey = `new-${sc.id}`
      if (!dataKey) continue
      const working = await resolveWorking(dataKey, datasets[sc.dataKey])
      if (!working || !working.rows.length) continue
      const aoa = [working.headers, ...working.rows.map((r) => working.headers.map((h) => r[h] ?? ''))]
      const ws = XLSX.utils.aoa_to_sheet(aoa)
      XLSX.utils.book_append_sheet(wb, ws, sheetName(sc.code || sc.name, used))
      count++
    }
  }

  if (count) {
    const stamp = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `Sonqollay_Proyecto_${stamp}.xlsx`)
  }
  return count
}
