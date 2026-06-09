/**
 * Búsqueda global del proyecto: planillas, elementos (TAG/valor) y CWPs.
 * Devuelve resultados categorizados y acotados para el desplegable del header.
 *
 * @param {string} q  texto buscado
 * @param {{disciplines:Array, datasets:Object, cwps:Array}} ctx
 */
export function globalSearch(q, { disciplines = [], datasets = {}, cwps = [] } = {}) {
  const query = String(q || '').trim().toLowerCase()
  const empty = { planillas: [], elementos: [], cwps: [] }
  if (query.length < 2) return empty

  const inc = (v) => String(v ?? '').toLowerCase().includes(query)

  // Planillas (subcategorías) por nombre/código + mapa dataKey→subcategoría.
  const planillas = []
  const subByDataKey = new Map()
  for (const d of disciplines) {
    for (const s of d.subcategories || []) {
      if (inc(s.name) || inc(s.code)) planillas.push({ subId: s.id, name: s.name, discipline: d.name })
      if (s.dataKey) subByDataKey.set(s.dataKey, { subId: s.id, planilla: s.name })
    }
  }

  // Elementos: TAG o cualquier valor de fila que coincida (acotado).
  const elementos = []
  const MAX = 10
  for (const [dataKey, meta] of subByDataKey) {
    const ds = datasets[dataKey]
    if (!ds?.rows?.length) continue
    const tagKey = ds.headers?.[0]
    for (const row of ds.rows) {
      const tag = String(row[tagKey] ?? '')
      let detail = null
      if (inc(tag)) detail = ''
      else {
        for (const k in row) { if (inc(row[k])) { detail = `${k}: ${row[k]}`; break } }
      }
      if (detail !== null) {
        elementos.push({ subId: meta.subId, planilla: meta.planilla, tag: tag || '(sin TAG)', detail })
        if (elementos.length >= MAX) break
      }
    }
    if (elementos.length >= MAX) break
  }

  // CWPs por código/nombre/CWA/disciplina.
  const cwpResults = cwps
    .filter((c) => inc(c.codigo) || inc(c.nombre) || inc(c.cwa) || inc(c.disciplina))
    .slice(0, 6)
    .map((c) => ({ codigo: c.codigo, nombre: c.nombre, cwa: c.cwa }))

  return { planillas: planillas.slice(0, 6), elementos, cwps: cwpResults }
}
