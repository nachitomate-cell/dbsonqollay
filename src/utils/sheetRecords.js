/**
 * Lee una hoja de Excel como `XLSX.utils.sheet_to_json`, pero sin perder los
 * ceros a la izquierda de los códigos.
 *
 * Por defecto SheetJS entrega el valor CRUDO de la celda: un WBS "06940" que en
 * Excel es un número con formato "00000" llega como 6940. Así se corrompió el
 * WBS de las planillas (y el plugin lo escribió mal en el modelo). Acá, si una
 * celda numérica se VE en Excel con ceros a la izquierda, se usa ese texto.
 * El resto de los números se deja tal cual (cantidades, costos, pesos).
 *
 * Mismas opciones que sheet_to_json (p. ej. { header: 1 } para filas como arrays).
 */
export function sheetRecords(XLSX, ws, opts = {}) {
  const raw = XLSX.utils.sheet_to_json(ws, { defval: '', ...opts })
  const text = XLSX.utils.sheet_to_json(ws, { defval: '', ...opts, raw: false })
  const padded = (v) => /^0\d+$/.test(String(v ?? '').trim())
  return raw.map((r, i) => {
    const t = text[i]
    if (!t || !r || typeof r !== 'object') return r
    let out = r
    for (const k of Object.keys(r)) {
      if (typeof r[k] === 'number' && padded(t[k])) {
        if (out === r) out = Array.isArray(r) ? [...r] : { ...r }
        out[k] = String(t[k]).trim()
      }
    }
    return out
  })
}
