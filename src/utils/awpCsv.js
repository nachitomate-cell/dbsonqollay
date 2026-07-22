/**
 * Parseo del listado de CWPs exportado de Aura AWP (CSV o Excel). Mientras no
 * haya API, el usuario importa este archivo y la app lee la jerarquía CWA/CWP
 * para conectar componentes.
 *
 * Columnas esperadas: Código, Nombre, CWA, Disciplina, Estado, HH Estimadas,
 * Fecha Inicio, Fecha Fin, EWP, EWP Estado, PWP, PWP Estado.
 */

// Parser CSV mínimo con soporte de comillas (campos con comas internas, p. ej.
// "I - Instrumentación, Control y Telecomunicaciones"). Autodetecta el
// separador: Excel en español guarda los CSV con ';' en vez de ','.
function parseCsvRows(text) {
  const s = String(text).replace(/\r\n?/g, '\n')
  const first = s.slice(0, s.indexOf('\n') === -1 ? s.length : s.indexOf('\n'))
  const delim = (first.match(/;/g)?.length || 0) > (first.match(/,/g)?.length || 0) ? ';' : ','
  const rows = []
  let field = '', row = [], inQ = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inQ) {
      if (ch === '"') { if (s[i + 1] === '"') { field += '"'; i++ } else inQ = false }
      else field += ch
    } else if (ch === '"') inQ = true
    else if (ch === delim) { row.push(field); field = '' }
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

/** Devuelve [{ codigo, nombre, cwa, disciplina, estado, hh, fechaInicio, fechaFin, ewp, pwp, iwp, swp }].
 *  `iwp`/`swp` vienen vacíos si el export no incluye esas columnas (hoy no las trae). */
export function parseAwpCwps(text) {
  const rows = parseCsvRows(text)
  if (rows.length < 2) return []
  const h = rows[0]
  const ix = {
    cod: colIdx(h, 'codigo'), nom: colIdx(h, 'nombre'), cwa: colIdx(h, 'cwa', true),
    dis: colIdx(h, 'disciplina'), est: colIdx(h, 'estado', true), hh: colIdx(h, 'hh'),
    fi: colIdx(h, 'inicio'), ff: colIdx(h, 'fin'), ewp: colIdx(h, 'ewp', true), pwp: colIdx(h, 'pwp', true),
    iwp: colIdx(h, 'iwp', true), swp: colIdx(h, 'swp', true),
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
      ewp: get(c, ix.ewp), pwp: get(c, ix.pwp), iwp: get(c, ix.iwp), swp: get(c, ix.swp),
    })
  }
  return out
}

/**
 * Lee el archivo de CWPs y devuelve los CWPs parseados. Acepta CSV y también
 * Excel (.xlsx/.xls): el mismo archivo que el usuario abrió/edito en Excel se
 * puede reimportar sin convertirlo a mano. La primera hoja se convierte a CSV
 * con SheetJS (import dinámico para no inflar el bundle).
 */
export async function parseAwpFile(file) {
  if (/\.(xlsx|xls)$/i.test(file?.name || '')) {
    const XLSX = await import('xlsx')
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    return parseAwpCwps(ws ? XLSX.utils.sheet_to_csv(ws) : '')
  }
  return parseAwpCwps(await file.text())
}
