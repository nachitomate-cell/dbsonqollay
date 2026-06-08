import { useState } from 'react'
import { ArrowLeft, Check, FileText, Plus, Trash2 } from 'lucide-react'
import { Empty, FF, Head, In, Modal, Row2, Sel, Ta } from './ui.jsx'
import { printPocReport } from '../../utils/awpReports.js'

// Sesiones IPS (Interactive Planning Sessions): planificación colaborativa AWP.
// Cada sesión acumula decisiones y action items; alimenta el Informe PoC.

const ESTADOS = ['Programada', 'En curso', 'Completada']
const estadoCls = (e) => ({ Programada: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300', 'En curso': 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', Completada: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' }[e] || 'bg-slate-100 text-slate-600')
let _ai = 0
const aiId = () => `ai_${Date.now().toString(36)}_${_ai++}`

export default function WorkspaceSesiones({ sesiones, addSesion, updateSesion, removeSesion, project, config }) {
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({})
  const [selId, setSelId] = useState(null)
  const sel = sesiones.find((s) => s.id === selId)

  function openNew() { setForm({ titulo: '', fecha: new Date().toISOString().slice(0, 10), facilitador: '', asistentes: '', estado: 'Programada' }); setModal(true) }
  function save() { const titulo = (form.titulo || '').trim(); if (!titulo) return; addSesion({ titulo, fecha: form.fecha, facilitador: form.facilitador, asistentes: form.asistentes, estado: form.estado }); setModal(false) }

  // ---- detalle ----
  if (sel) {
    const setDecisiones = (decisiones) => updateSesion(sel.id, { decisiones })
    const setAI = (actionItems) => updateSesion(sel.id, { actionItems })
    return <Detalle s={sel} onBack={() => setSelId(null)} updateSesion={updateSesion} setDecisiones={setDecisiones} setAI={setAI} project={project} config={config} />
  }

  return (
    <>
      <Head title="Sesiones IPS" sub="Sesiones de planificación interactiva (Interactive Planning Sessions)." onNew={openNew} newLabel="Nueva sesión" />
      {sesiones.length === 0 ? <Empty msg="Sin sesiones. Crea la primera sesión de planificación." /> : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {sesiones.map((s) => (
            <button key={s.id} onClick={() => setSelId(s.id)} className="rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-brand-300 hover:shadow-sm dark:border-white/10 dark:bg-ink-800/60 dark:hover:border-accent/40">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-brand-700 dark:text-accent">{s.codigo}</span>
                <span className={['ml-auto rounded-md px-2 py-0.5 text-[11px] font-semibold', estadoCls(s.estado)].join(' ')}>{s.estado}</span>
              </div>
              <h3 className="mt-1.5 font-semibold text-slate-800 dark:text-white">{s.titulo}</h3>
              <p className="mt-0.5 text-xs text-slate-400">{s.fecha ? new Date(s.fecha + 'T00:00:00').toLocaleDateString('es-CL') : '—'}{s.facilitador ? ` · ${s.facilitador}` : ''}</p>
              <div className="mt-2 flex gap-3 text-[11px] text-slate-500 dark:text-slate-400"><span>{(s.decisiones || []).length} decisiones</span><span>{(s.actionItems || []).length} action items</span></div>
            </button>
          ))}
        </div>
      )}

      {modal && (
        <Modal title="Nueva sesión IPS" onClose={() => setModal(false)} onSave={save}>
          <FF label="Título"><In value={form.titulo} onChange={(v) => setForm((f) => ({ ...f, titulo: v }))} placeholder="Sesión de planificación — Área de proceso" /></FF>
          <Row2>
            <FF label="Fecha"><In type="date" value={form.fecha} onChange={(v) => setForm((f) => ({ ...f, fecha: v }))} /></FF>
            <FF label="Facilitador"><In value={form.facilitador} onChange={(v) => setForm((f) => ({ ...f, facilitador: v }))} /></FF>
          </Row2>
          <FF label="Asistentes"><Ta value={form.asistentes} onChange={(v) => setForm((f) => ({ ...f, asistentes: v }))} /></FF>
          <FF label="Estado"><Sel value={form.estado} onChange={(v) => setForm((f) => ({ ...f, estado: v }))} options={ESTADOS.map((e) => ({ value: e, label: e }))} /></FF>
        </Modal>
      )}
    </>
  )
}

function Detalle({ s, onBack, updateSesion, setDecisiones, setAI, project, config }) {
  const [dec, setDec] = useState('')
  const [aiTexto, setAiTexto] = useState(''); const [aiResp, setAiResp] = useState('')
  const decisiones = s.decisiones || []
  const actionItems = s.actionItems || []

  return (
    <>
      <button onClick={onBack} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"><ArrowLeft className="h-4 w-4" /> Sesiones</button>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><span className="font-mono text-sm font-bold text-brand-700 dark:text-accent">{s.codigo}</span>
            <select value={s.estado} onChange={(e) => updateSesion(s.id, { estado: e.target.value })} className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs dark:border-white/10 dark:bg-ink-900 dark:text-slate-200">{ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}</select>
          </div>
          <h1 className="mt-1 text-xl font-extrabold text-slate-800 dark:text-white">{s.titulo}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{s.fecha ? new Date(s.fecha + 'T00:00:00').toLocaleDateString('es-CL') : '—'}{s.facilitador ? ` · ${s.facilitador}` : ''}</p>
        </div>
        <button onClick={() => printPocReport({ sesion: s, project, config })} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:text-brand-600 dark:border-white/10 dark:text-slate-300"><FileText className="h-4 w-4" /> Informe PoC (PDF)</button>
      </div>

      {s.asistentes && <Box title="Asistentes"><p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{s.asistentes}</p></Box>}

      <Box title={`Decisiones (${decisiones.length})`}>
        <ul className="mb-2 space-y-1">
          {decisiones.map((d, i) => (
            <li key={i} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-sm dark:bg-white/5">
              <span className="flex-1 text-slate-700 dark:text-slate-200">{d}</span>
              <button onClick={() => setDecisiones(decisiones.filter((_, j) => j !== i))} className="text-slate-400 hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input value={dec} onChange={(e) => setDec(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && dec.trim()) { setDecisiones([...decisiones, dec.trim()]); setDec('') } }} placeholder="Agregar decisión…" className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-white/10 dark:bg-ink-900 dark:text-slate-100" />
          <button onClick={() => { if (dec.trim()) { setDecisiones([...decisiones, dec.trim()]); setDec('') } }} className="rounded-lg bg-brand-500 px-3 text-sm font-semibold text-white dark:bg-accent dark:text-ink-900"><Plus className="h-4 w-4" /></button>
        </div>
      </Box>

      <Box title={`Action items (${actionItems.length})`}>
        <ul className="mb-2 space-y-1">
          {actionItems.map((a) => (
            <li key={a.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-sm dark:bg-white/5">
              <button onClick={() => setAI(actionItems.map((x) => (x.id === a.id ? { ...x, estado: x.estado === 'Hecha' ? 'Pendiente' : 'Hecha' } : x)))} className={['grid h-5 w-5 place-items-center rounded border', a.estado === 'Hecha' ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 dark:border-white/20'].join(' ')}>{a.estado === 'Hecha' && <Check className="h-3.5 w-3.5" />}</button>
              <span className={['flex-1', a.estado === 'Hecha' ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'].join(' ')}>{a.texto}{a.responsable ? <span className="ml-1 text-xs text-slate-400">· {a.responsable}</span> : ''}</span>
              <button onClick={() => setAI(actionItems.filter((x) => x.id !== a.id))} className="text-slate-400 hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <input value={aiTexto} onChange={(e) => setAiTexto(e.target.value)} placeholder="Tarea…" className="min-w-[160px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-white/10 dark:bg-ink-900 dark:text-slate-100" />
          <input value={aiResp} onChange={(e) => setAiResp(e.target.value)} placeholder="Responsable" className="w-36 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-white/10 dark:bg-ink-900 dark:text-slate-100" />
          <button onClick={() => { if (aiTexto.trim()) { setAI([...actionItems, { id: aiId(), texto: aiTexto.trim(), responsable: aiResp.trim(), estado: 'Pendiente' }]); setAiTexto(''); setAiResp('') } }} className="rounded-lg bg-brand-500 px-3 text-sm font-semibold text-white dark:bg-accent dark:text-ink-900"><Plus className="h-4 w-4" /></button>
        </div>
      </Box>
    </>
  )
}
const Box = ({ title, children }) => (
  <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-ink-800/60">
    <h3 className="mb-2 text-sm font-bold text-slate-600 dark:text-slate-300">{title}</h3>{children}
  </div>
)
