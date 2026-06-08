import { useRef, useState } from 'react'
import { Eye, EyeOff, Image as ImageIcon, Loader2, Pencil, Trash2, Upload, X } from 'lucide-react'
import { CWA_COLORS } from './charts.jsx'
import { fileToDataUrl } from '../../hooks/useAwpPlanos.js'
import { Empty } from './ui.jsx'

// Plot Plan: sube el plano del sitio y dibuja las CWAs (rectángulos) encima.
const clamp = (n) => Math.max(0, Math.min(100, n))

export default function WorkspacePlano({ planosApi, cwas }) {
  const { planos, error, addPlano, removePlano, addShape, removeShape } = planosApi
  const [selId, setSelId] = useState(planos[0]?.id || null)
  const [drawCwaId, setDrawCwaId] = useState('')
  const [show, setShow] = useState(true)
  const [draw, setDraw] = useState(null) // { x0,y0,x1,y1 }
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)
  const wrapRef = useRef(null)

  const plano = planos.find((p) => p.id === selId) || planos[0]
  const cwaColor = (id) => CWA_COLORS[Math.max(0, cwas.findIndex((c) => c.id === id)) % CWA_COLORS.length]
  const cwaCode = (id) => cwas.find((c) => c.id === id)?.codigo || '?'

  async function onFile(e) {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    setBusy(true)
    try { const dataUrl = await fileToDataUrl(f); const id = addPlano({ nombre: f.name.replace(/\.[^.]+$/, ''), imagen: dataUrl }); setSelId(id) }
    catch { /* ignore */ } finally { setBusy(false) }
  }

  const pctXY = (e) => { const r = wrapRef.current.getBoundingClientRect(); return [clamp(((e.clientX - r.left) / r.width) * 100), clamp(((e.clientY - r.top) / r.height) * 100)] }
  function down(e) { if (!drawCwaId || !plano) return; const [x, y] = pctXY(e); setDraw({ x0: x, y0: y, x1: x, y1: y }) }
  function move(e) { if (!draw) return; const [x, y] = pctXY(e); setDraw((d) => ({ ...d, x1: x, y1: y })) }
  function up() {
    if (!draw) return
    const x = Math.min(draw.x0, draw.x1), y = Math.min(draw.y0, draw.y1), w = Math.abs(draw.x1 - draw.x0), h = Math.abs(draw.y1 - draw.y0)
    if (w > 1.5 && h > 1.5) addShape(plano.id, { cwaId: drawCwaId, x, y, w, h })
    setDraw(null)
  }

  return (
    <>
      <div className="mb-1 text-xl font-extrabold text-slate-800 dark:text-white">Plot Plan</div>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Sube el plano del sitio y delimita las CWAs sobre él.</p>
      {error && <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">{error}</div>}

      <div className="flex min-h-0 gap-4">
        {/* Lateral: planos */}
        <div className="w-52 shrink-0 space-y-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          <button onClick={() => fileRef.current?.click()} disabled={busy} className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60 dark:bg-accent dark:text-ink-900">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Cargar plano
          </button>
          {planos.map((p) => (
            <div key={p.id} className={['group flex items-center gap-2 rounded-lg border px-2.5 py-2 text-sm transition', p.id === plano?.id ? 'border-brand-400 bg-brand-50 dark:border-accent/50 dark:bg-accent/10' : 'border-slate-200 hover:border-brand-300 dark:border-white/10'].join(' ')}>
              <button onClick={() => setSelId(p.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left"><ImageIcon className="h-4 w-4 shrink-0 text-slate-400" /><span className="truncate text-slate-700 dark:text-slate-200">{p.nombre}</span></button>
              <span className="shrink-0 text-[10px] text-slate-400">{p.shapes.length}</span>
              <button onClick={() => { if (confirm(`¿Eliminar "${p.nombre}"?`)) { removePlano(p.id); if (selId === p.id) setSelId(null) } }} className="shrink-0 text-slate-300 opacity-0 transition hover:text-rose-500 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>

        {/* Canvas */}
        <div className="min-w-0 flex-1">
          {!plano ? <Empty msg="Carga una imagen del plano del sitio para empezar." /> : (
            <>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-slate-400">Dibujar CWA:</span>
                <select value={drawCwaId} onChange={(e) => setDrawCwaId(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm dark:border-white/10 dark:bg-ink-900 dark:text-slate-200">
                  <option value="">— ninguna (solo ver) —</option>
                  {cwas.map((c) => <option key={c.id} value={c.id}>{c.codigo} · {c.nombre}</option>)}
                </select>
                {drawCwaId && <span className="inline-flex items-center gap-1 text-xs text-brand-600 dark:text-accent"><Pencil className="h-3.5 w-3.5" /> Arrastra sobre el plano</span>}
                <button onClick={() => setShow((v) => !v)} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:border-white/10 dark:text-slate-300">{show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} {show ? 'Ocultar' : 'Mostrar'} áreas</button>
              </div>

              <div
                ref={wrapRef}
                onMouseDown={down} onMouseMove={move} onMouseUp={up} onMouseLeave={() => setDraw(null)}
                className="relative select-none overflow-hidden rounded-xl border border-slate-200 dark:border-white/10"
                style={{ cursor: drawCwaId ? 'crosshair' : 'default' }}
              >
                <img src={plano.imagen} alt={plano.nombre} draggable={false} className="block w-full" />
                {show && plano.shapes.map((s) => (
                  <div key={s.id} className="group/sh absolute" style={{ left: `${s.x}%`, top: `${s.y}%`, width: `${s.w}%`, height: `${s.h}%`, border: `2px solid ${cwaColor(s.cwaId)}`, background: `${cwaColor(s.cwaId)}33` }}>
                    <span className="absolute left-0 top-0 max-w-full truncate px-1 text-[10px] font-bold leading-tight text-white" style={{ background: cwaColor(s.cwaId) }}>{cwaCode(s.cwaId)}</span>
                    <button onMouseDown={(e) => e.stopPropagation()} onClick={() => removeShape(plano.id, s.id)} className="absolute right-0.5 top-0.5 hidden h-5 w-5 place-items-center rounded bg-white/90 text-rose-500 shadow group-hover/sh:grid dark:bg-ink-900/90"><X className="h-3 w-3" /></button>
                  </div>
                ))}
                {draw && (
                  <div className="absolute border-2 border-dashed border-brand-500 bg-brand-500/20" style={{ left: `${Math.min(draw.x0, draw.x1)}%`, top: `${Math.min(draw.y0, draw.y1)}%`, width: `${Math.abs(draw.x1 - draw.x0)}%`, height: `${Math.abs(draw.y1 - draw.y0)}%` }} />
                )}
              </div>

              {/* Leyenda de CWAs dibujadas */}
              {cwas.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
                  {cwas.map((c) => { const n = plano.shapes.filter((s) => s.cwaId === c.id).length; return (
                    <span key={c.id} className={['inline-flex items-center gap-1.5', n ? '' : 'opacity-40'].join(' ')}>
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: cwaColor(c.id) }} />
                      <span className="font-mono text-slate-600 dark:text-slate-300">{c.codigo}</span>{n > 0 && <span className="text-slate-400">×{n}</span>}
                    </span>
                  ) })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
