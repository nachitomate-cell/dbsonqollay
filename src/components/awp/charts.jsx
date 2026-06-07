// Gráficos SVG livianos para el Workspace AWP (sin dependencias externas):
// Donut (distribución por HH) y Sunburst (jerarquía CWA → CWP → IWP).

// Paleta para CWAs (tonos distinguibles, estilo Aura).
export const CWA_COLORS = ['#f97316', '#ea580c', '#fb923c', '#c2410c', '#fdba74', '#9a3412', '#fed7aa', '#7c2d12', '#fb7185', '#e11d48']

const pt = (cx, cy, r, a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)]

function annular(cx, cy, ri, ro, a0, a1) {
  const large = a1 - a0 > Math.PI ? 1 : 0
  const [xo0, yo0] = pt(cx, cy, ro, a0), [xo1, yo1] = pt(cx, cy, ro, a1)
  const [xi1, yi1] = pt(cx, cy, ri, a1), [xi0, yi0] = pt(cx, cy, ri, a0)
  return `M${xo0},${yo0} A${ro},${ro} 0 ${large} 1 ${xo1},${yo1} L${xi1},${yi1} A${ri},${ri} 0 ${large} 0 ${xi0},${yi0} Z`
}

// Devuelve 1 o 2 paths (parte un anillo casi completo para que el arco SVG no falle).
function annularPaths(cx, cy, ri, ro, a0, a1) {
  if (a1 - a0 >= 2 * Math.PI - 0.001) {
    const mid = a0 + Math.PI
    return [annular(cx, cy, ri, ro, a0, mid), annular(cx, cy, ri, ro, mid, a1)]
  }
  return [annular(cx, cy, ri, ro, a0, a1)]
}

const TWO_PI = Math.PI * 2

export function Donut({ data, size = 180, thickness = 30 }) {
  const total = data.reduce((s, d) => s + (d.value || 0), 0) || 1
  const r = size / 2, ri = r - thickness, cx = r, cy = r
  let a = 0
  const segs = []
  data.forEach((d, i) => {
    const a1 = a + (Math.max(0, d.value || 0) / total) * TWO_PI
    annularPaths(cx, cy, ri, r, a, a1).forEach((p, j) => segs.push({ p, color: d.color, key: `${i}-${j}`, title: `${d.label}: ${d.value}` }))
    a = a1
  })
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full">
      {segs.map((s) => <path key={s.key} d={s.p} fill={s.color}><title>{s.title}</title></path>)}
    </svg>
  )
}

/**
 * Sunburst de 3 anillos: CWAs (interior) → CWPs (medio) → IWPs (exterior).
 * weightCwa(cwa), weightCwp(cwp), weightIwp(iwp) dan el peso (HH; mínimo 1).
 */
export function Sunburst({ cwas, cwps, iwps, discById, weightCwa, weightCwp, weightIwp, size = 300 }) {
  const cx = size / 2, cy = size / 2
  const R = [size * 0.16, size * 0.30, size * 0.40, size * 0.49] // r0..r3
  const segs = []
  const totalW = cwas.reduce((s, c) => s + Math.max(1, weightCwa(c)), 0) || 1
  let a = 0
  cwas.forEach((cwa, ci) => {
    const aw = (Math.max(1, weightCwa(cwa)) / totalW) * TWO_PI
    const color = CWA_COLORS[ci % CWA_COLORS.length]
    annularPaths(cx, cy, R[0], R[1], a, a + aw).forEach((p, j) => segs.push({ p, color, key: `cwa-${ci}-${j}`, title: cwa.codigo }))
    const myCwps = cwps.filter((c) => c.cwaId === cwa.id)
    const subW = myCwps.reduce((s, c) => s + Math.max(1, weightCwp(c)), 0)
    let b = a
    myCwps.forEach((cwp, pi) => {
      const bw = subW ? (Math.max(1, weightCwp(cwp)) / subW) * aw : 0
      const dcol = discById(cwp.disciplinaId)?.color || '#94a3b8'
      annularPaths(cx, cy, R[1], R[2], b, b + bw).forEach((p, j) => segs.push({ p, color: dcol, key: `cwp-${ci}-${pi}-${j}`, title: cwp.codigo }))
      const myIwps = iwps.filter((i) => i.cwpId === cwp.id)
      const iw = myIwps.reduce((s, i) => s + Math.max(1, weightIwp(i)), 0)
      let c = b
      myIwps.forEach((iwp, ii) => {
        const cw = iw ? (Math.max(1, weightIwp(iwp)) / iw) * bw : 0
        annularPaths(cx, cy, R[2], R[3], c, c + cw).forEach((p, j) => segs.push({ p, color: dcol, opacity: 0.5, key: `iwp-${ci}-${pi}-${ii}-${j}`, title: iwp.codigo }))
        c += cw
      })
      b += bw
    })
    a += aw
  })
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full">
      {segs.map((s) => <path key={s.key} d={s.p} fill={s.color} fillOpacity={s.opacity ?? 1} stroke="#fff" strokeWidth="0.5"><title>{s.title}</title></path>)}
    </svg>
  )
}
