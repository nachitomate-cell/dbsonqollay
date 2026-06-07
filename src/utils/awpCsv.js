/**
 * Parseo del CSV de CWPs exportado de Aura AWP. Mientras no haya API, el usuario
 * importa este CSV y la app lee la jerarquía CWA/CWP para conectar componentes.
 *
 * Columnas esperadas: Código, Nombre, CWA, Disciplina, Estado, HH Estimadas,
 * Fecha Inicio, Fecha Fin, EWP, EWP Estado, PWP, PWP Estado.
 */

// Parser CSV mínimo con soporte de comillas (campos con comas internas, p. ej.
// "I - Instrumentación, Control y Telecomunicaciones").
function parseCsvRows(text) {
  const s = String(text).replace(/\r\n?/g, '\n')
  const rows = []
  let field = '', row = [], inQ = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inQ) {
      if (ch === '"') { if (s[i + 1] === '"') { field += '"'; i++ } else inQ = false }
      else field += ch
    } else if (ch === '"') inQ = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else field += ch
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''))
}

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

// Índice de columna por palabra clave (sin acentos). `exact` prioriza la
// coincidencia exacta para distinguir "EWP" de "EWP Estado".
function colIdx(headers, kw, exact) {
  const k = norm(kw)
  if (exact) { const i = headers.findIndex((h) => norm(h) === k); if (i >= 0) return i }
  return headers.findIndex((h) => norm(h).includes(k))
}

/** Devuelve [{ codigo, nombre, cwa, disciplina, estado, hh, fechaInicio, fechaFin, ewp, pwp }]. */
export function parseAwpCwps(text) {
  const rows = parseCsvRows(text)
  if (rows.length < 2) return []
  const h = rows[0]
  const ix = {
    cod: colIdx(h, 'codigo'), nom: colIdx(h, 'nombre'), cwa: colIdx(h, 'cwa', true),
    dis: colIdx(h, 'disciplina'), est: colIdx(h, 'estado', true), hh: colIdx(h, 'hh'),
    fi: colIdx(h, 'inicio'), ff: colIdx(h, 'fin'), ewp: colIdx(h, 'ewp', true), pwp: colIdx(h, 'pwp', true),
  }
  const get = (c, i) => (i >= 0 ? String(c[i] ?? '').trim() : '')
  const out = []
  for (let r = 1; r < rows.length; r++) {
    const c = rows[r]
    const codigo = get(c, ix.cod)
    if (!codigo) continue
    out.push({
      codigo, nombre: get(c, ix.nom), cwa: get(c, ix.cwa), disciplina: get(c, ix.dis),
      estado: get(c, ix.est), hh: get(c, ix.hh), fechaInicio: get(c, ix.fi), fechaFin: get(c, ix.ff),
      ewp: get(c, ix.ewp), pwp: get(c, ix.pwp),
    })
  }
  return out
}
