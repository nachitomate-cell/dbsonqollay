/**
 * Exportación de todo el proyecto a un único Excel multi-hoja: una hoja por
 * cada subcategoría con datos (incluyendo importadas). Refleja las ediciones
 * guardadas en localStorage (`sqy-ds-<dataKey>`) cuando existen; si no, usa el
 * dataset base. `xlsx` se importa de forma dinámica para no inflar el bundle.
 */

function resolveWorking(dataKey, base) {
  try {
    const raw = localStorage.getItem(`sqy-ds-${dataKey}`)
    if (raw) {
      const p = JSON.parse(raw)
      if (p?.columns && p?.rows) {
        const headers = p.columns.filter((c) => c.visible).map((c) => c.key)
        return { headers, rows: p.rows }
      }
    }
  } catch {
    /* ignore */
  }
  return base ? { headers: base.headers, rows: base.rows } : null
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
      if (!sc.dataKey) continue
      const working = resolveWorking(sc.dataKey, datasets[sc.dataKey])
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
