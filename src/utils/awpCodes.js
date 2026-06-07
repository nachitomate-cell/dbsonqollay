// Generador de códigos AWP a partir de la nomenclatura configurada del proyecto.
// Replica el formato de Aura AWP: CWA-01, CWP-01-M-01, IWP-01-M-01-01, etc.
//
// genCode(nomenclatura, nivel, partes) donde:
//   nivel ∈ 'cwa' | 'cwp' | 'ewp' | 'pwp' | 'iwp'
//   partes = { cwaNum, disc, cwpNum, corr }  (los que apliquen al nivel)

const pad = (n, d) => String(n ?? 1).padStart(Math.max(1, d || 2), '0')

export function genCode(nomenclatura, nivel, partes = {}) {
  const cfg = (nomenclatura && nomenclatura[nivel]) || {}
  const sep = cfg.separador ?? '-'
  const segs = [cfg.prefijo || nivel.toUpperCase()]
  if (nivel !== 'cwa') {
    if (cfg.incluyeCwa && partes.cwaNum != null) segs.push(pad(partes.cwaNum, 2))
    if (cfg.incluyeDisc && partes.disc) segs.push(partes.disc)
    if (nivel === 'iwp' && cfg.incluyeCwp && partes.cwpNum != null) segs.push(pad(partes.cwpNum, 2))
  }
  segs.push(pad(partes.corr, cfg.digitos))
  return segs.join(sep)
}

// Ejemplo de cada nivel (para el preview de la nomenclatura). disc = prefijo de
// una disciplina de muestra (ej. 'M').
export function previewCodes(nomenclatura, disc = 'M') {
  return {
    cwa: genCode(nomenclatura, 'cwa', { corr: 1 }),
    cwp: genCode(nomenclatura, 'cwp', { cwaNum: 1, disc, corr: 1 }),
    ewp: genCode(nomenclatura, 'ewp', { cwaNum: 1, disc, corr: 1 }),
    pwp: genCode(nomenclatura, 'pwp', { cwaNum: 1, disc, corr: 1 }),
    iwp: genCode(nomenclatura, 'iwp', { cwaNum: 1, disc, cwpNum: 1, corr: 1 }),
  }
}
