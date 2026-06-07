// Reportes PDF del Workspace AWP. Sin dependencias: arma un HTML con estilo de
// impresión y abre la ventana de impresión del navegador (el usuario elige
// "Guardar como PDF"). Ficha CWA e Informe CWP.

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]))
const fmt = (n) => Number(n || 0).toLocaleString('es-CL')
const fdate = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('es-CL') : '—')

const CSS = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #1e293b; margin: 0; padding: 28px 32px; }
  .top { display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #1e40af; padding-bottom:10px; margin-bottom:18px; }
  .brand { font-weight:800; font-size:20px; color:#1e40af; letter-spacing:.5px; }
  .top .code { font-family:monospace; font-weight:700; color:#1e40af; }
  .titlebar { background:#1e40af; color:#fff; border-radius:8px; padding:16px 18px; margin-bottom:18px; }
  .titlebar h1 { margin:0; font-size:13px; font-weight:600; opacity:.85; text-transform:uppercase; letter-spacing:1px; }
  .titlebar h2 { margin:4px 0 0; font-size:20px; }
  .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:16px; }
  .cell { border:1px solid #e2e8f0; border-radius:8px; padding:10px 12px; }
  .cell .l { font-size:10px; text-transform:uppercase; letter-spacing:.5px; color:#94a3b8; }
  .cell .v { font-size:14px; font-weight:600; margin-top:2px; }
  h3 { font-size:13px; color:#334155; border-bottom:1px solid #e2e8f0; padding-bottom:5px; margin:18px 0 8px; }
  p.desc { font-size:12px; line-height:1.5; color:#475569; white-space:pre-wrap; }
  table { width:100%; border-collapse:collapse; font-size:11px; }
  th { background:#f1f5f9; text-align:left; padding:6px 8px; color:#64748b; text-transform:uppercase; font-size:10px; }
  td { padding:6px 8px; border-top:1px solid #e2e8f0; }
  td.mono { font-family:monospace; font-weight:600; color:#1e40af; }
  td.num { text-align:right; font-variant-numeric:tabular-nums; }
  .foot { margin-top:24px; font-size:10px; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:8px; }
  .chip { display:inline-block; padding:1px 7px; border-radius:10px; font-size:10px; background:#eef2ff; color:#1e40af; }
  @media print { body { padding:0; } @page { margin:14mm; } }
`

function openPrint(title, body) {
  const w = window.open('', '_blank')
  if (!w) { alert('Permite las ventanas emergentes para generar el PDF.'); return }
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body>${body}<script>window.onload=function(){window.focus();window.print()}<\/script></body></html>`)
  w.document.close()
}

function head(project, config, rightCode) {
  return `<div class="top"><div class="brand">${esc(config.codigo || project?.code || 'AURA GIP')}</div><div class="code">${esc(rightCode)}</div></div>`
}
function foot(config, project) {
  return `<div class="foot">${esc(config.nombre || project?.name || '')} · ${esc(config.cliente || '')} · Generado el ${new Date().toLocaleDateString('es-CL')} — AURA GIP</div>`
}
function cell(l, v) { return `<div class="cell"><div class="l">${esc(l)}</div><div class="v">${esc(v)}</div></div>` }

export function printCwaReport({ cwa, cwps, iwps, discById, project, config }) {
  const myCwps = cwps.filter((c) => c.cwaId === cwa.id)
  const rows = myCwps.map((c) => {
    const d = discById(c.disciplinaId)
    const n = iwps.filter((i) => i.cwpId === c.id).length
    return `<tr><td class="mono">${esc(c.codigo)}</td><td>${esc(d?.prefijo || '')}</td><td>${esc(c.nombre)}</td><td class="num">${fmt(c.hh)}</td><td class="num">${n}</td></tr>`
  }).join('') || `<tr><td colspan="5" style="color:#94a3b8">Sin CWPs</td></tr>`
  const body =
    head(project, config, cwa.codigo) +
    `<div class="titlebar"><h1>Ficha de Área de Trabajo (CWA)</h1><h2>${esc(cwa.codigo)} — ${esc(cwa.nombre)}</h2></div>` +
    `<div class="grid">${cell('HH estimadas', fmt(cwa.hh) + ' HH')}${cell('Estado', cwa.estado || '—')}${cell('Secuencia (PoC)', cwa.secuenciaPoC || '—')}${cell('Inicio', fdate(cwa.fechaInicio))}${cell('Fin', fdate(cwa.fechaFin))}${cell('CWPs', myCwps.length)}</div>` +
    (cwa.descripcion ? `<h3>Descripción</h3><p class="desc">${esc(cwa.descripcion)}</p>` : '') +
    `<h3>Construction Work Packages (${myCwps.length})</h3>` +
    `<table><thead><tr><th>Código</th><th>Disc.</th><th>Nombre</th><th>HH</th><th>IWPs</th></tr></thead><tbody>${rows}</tbody></table>` +
    foot(config, project)
  openPrint(`Ficha ${cwa.codigo}`, body)
}

export function printCwpReport({ cwp, cwa, disc, iwps, project, config }) {
  const myIwps = iwps.filter((i) => i.cwpId === cwp.id)
  const rows = myIwps.map((i) => `<tr><td class="mono">${esc(i.codigo)}</td><td>${esc(i.nombre)}</td><td class="num">${fmt(i.hh)}</td><td>${esc(i.estado || '')}</td></tr>`).join('') || `<tr><td colspan="4" style="color:#94a3b8">Sin IWPs (el CWP no está abierto)</td></tr>`
  const body =
    head(project, config, cwp.codigo) +
    `<div class="titlebar"><h1>Informe de Construction Work Package (CWP)</h1><h2>${esc(cwp.codigo)} — ${esc(cwp.nombre)}</h2></div>` +
    `<div class="grid">${cell('CWA', cwa ? `${cwa.codigo} · ${cwa.nombre}` : '—')}${cell('Disciplina', disc?.nombre || '—')}${cell('HH estimadas', fmt(cwp.hh) + ' HH')}${cell('Estado', cwp.estado || '—')}${cell('Secuencia (PoC)', cwp.secuenciaPoC || '—')}${cell('IWPs', myIwps.length)}</div>` +
    (cwp.descripcion ? `<h3>Descripción / Cubicaciones</h3><p class="desc">${esc(cwp.descripcion)}</p>` : '') +
    `<h3>Installation Work Packages (${myIwps.length})</h3>` +
    `<table><thead><tr><th>Código</th><th>Nombre</th><th>HH</th><th>Estado</th></tr></thead><tbody>${rows}</tbody></table>` +
    foot(config, project)
  openPrint(`Informe ${cwp.codigo}`, body)
}
