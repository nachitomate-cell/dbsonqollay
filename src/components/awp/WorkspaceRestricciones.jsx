import { useMemo, useState } from 'react'
import { Pencil, Trash2, TriangleAlert } from 'lucide-react'
import { Empty, FF, Head, In, Modal, Row2, Sel, Ta } from './ui.jsx'

// Gestión de restricciones (bloqueos) AWP: identificar, rastrear y eliminar
// obstáculos antes de liberar el trabajo a terreno.

export const TIPOS = ['Equipos', 'Permisos', 'Documentación', 'Materiales', 'Ingeniería', 'Otro']
export const PRIORIDADES = ['Alta', 'Media', 'Baja']
export const ESTADOS = ['Identificada', 'En Gestión', 'Resuelta']

const today = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() }
const parseD = (s) => (s ? new Date(s + 'T00:00:00').getTime() : null)
const diasVencida = (r) => { const f = parseD(r.fechaLimite); if (!f || r.estado === 'Resuelta') return 0; const d = Math.floor((today() - f) / 86400000); return d > 0 ? d : 0 }

const prioCls = (p) => ({ Alta: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300', Media: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', Baja: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300' }[p] || 'bg-slate-100 text-slate-600')
const estadoCls = (e) => ({ Identificada: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300', 'En Gestión': 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', Resuelta: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' }[e] || 'bg-slate-100 text-slate-600')

export default function WorkspaceRestricciones({ restricciones, cwas, cwps, addRestriccion, updateRestriccion, removeRestriccion }) {
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [fTipo, setFTipo] = useState(''); const [fEstado, setFEstado] = useState(''); const [fPrio, setFPrio] = useState(''); const [q, setQ] = useState('')

  const cwaById = (id) => cwas.find((c) => c.id === id)
  const cwpById = (id) => cwps.find((c) => c.id === id)

  const stats = useMemo(() => ({
    total: restricciones.length,
    criticas: restricciones.filter((r) => r.prioridad === 'Alta' && r.estado !== 'Resuelta').length,
    gestion: restricciones.filter((r) => r.estado === 'En Gestión').length,
    resueltas: restricciones.filter((r) => r.estado === 'Resuelta').length,
    vencidas: restricciones.filter((r) => diasVencida(r) > 0).length,
  }), [restricciones])

  const filtered = restricciones.filter((r) =>
    (!fTipo || r.tipo === fTipo) && (!fEstado || r.estado === fEstado) && (!fPrio || r.prioridad === fPrio) &&
    (!q.trim() || `${r.codigo} ${r.titulo}`.toLowerCase().includes(q.toLowerCase())))

  function open(r) { setForm(r ? { ...r } : { titulo: '', prioridad: 'Media', tipo: 'Documentación', estado: 'Identificada', cwaId: '', cwpId: '', responsable: '', fechaLimite: '', descripcion: '' }); setModal({ id: r?.id }) }
  function save() {
    const titulo = (form.titulo || '').trim(); if (!titulo) return
    const data = { titulo, prioridad: form.prioridad, tipo: form.tipo, estado: form.estado, cwaId: form.cwaId, cwpId: form.cwpId, responsable: form.responsable, fechaLimite: form.fechaLimite, descripcion: form.descripcion }
    if (modal.id) updateRestriccion(modal.id, data); else addRestriccion(data)
    setModal(null)
  }

  return (
    <>
      <Head title="Restricciones" sub="Gestiona los bloqueos identificados en el proyecto." onNew={() => open(null)} newLabel="Nueva restricción" />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Total" value={stats.total} />
        <Stat label="Críticas" value={stats.criticas} tone="rose" />
        <Stat label="En gestión" value={stats.gestion} tone="amber" />
        <Stat label="Resueltas" value={stats.resueltas} tone="emerald" />
        <Stat label="Vencidas" value={stats.vencidas} tone="rose" />
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar código o título…" className="min-w-[180px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-white/10 dark:bg-ink-900 dark:text-slate-100" />
        <Filt value={fTipo} onChange={setFTipo} options={TIPOS} all="Todos los tipos" />
        <Filt value={fEstado} onChange={setFEstado} options={ESTADOS} all="Todos los estados" />
        <Filt value={fPrio} onChange={setFPrio} options={PRIORIDADES} all="Toda prioridad" />
      </div>

      {restricciones.length === 0 ? <Empty msg="Sin restricciones. Crea la primera para gestionar la liberación del trabajo." /> : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-ink-800/60">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:bg-white/5">{['Código', 'Título', 'CWA / CWP', 'Tipo', 'Fecha límite', 'Estado', ''].map((c, i) => <th key={i} className="px-3 py-2">{c}</th>)}</tr></thead>
            <tbody>
              {filtered.map((r) => { const dv = diasVencida(r); return (
                <tr key={r.id} className={['border-t border-slate-100 dark:border-white/5', dv > 0 ? 'bg-rose-50/40 dark:bg-rose-500/[0.04]' : ''].join(' ')}>
                  <td className="px-3 py-2"><div className="flex items-center gap-1.5"><span className="font-mono font-bold text-brand-700 dark:text-accent">{r.codigo}</span><span className={['rounded px-1.5 py-0.5 text-[10px] font-semibold', prioCls(r.prioridad)].join(' ')}>{r.prioridad}</span></div></td>
                  <td className="px-3 py-2"><span className="font-medium text-slate-800 dark:text-white">{r.titulo}</span></td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">{cwaById(r.cwaId)?.codigo || '—'}{r.cwpId ? ` / ${cwpById(r.cwpId)?.codigo || ''}` : ''}</td>
                  <td className="px-3 py-2 text-xs">{r.tipo}</td>
                  <td className="px-3 py-2 text-xs">{r.fechaLimite ? <span className={dv > 0 ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-slate-500'}>{new Date(r.fechaLimite + 'T00:00:00').toLocaleDateString('es-CL')}{dv > 0 && <span className="block text-[10px]">{dv} días vencida</span>}</span> : '—'}</td>
                  <td className="px-3 py-2"><span className={['rounded-md px-2 py-0.5 text-[11px] font-semibold', estadoCls(r.estado)].join(' ')}>{r.estado}</span></td>
                  <td className="px-3 py-2"><div className="flex gap-1">
                    <button onClick={() => open(r)} className="grid h-7 w-7 place-items-center rounded text-slate-400 hover:text-brand-600 dark:hover:bg-white/5"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => { if (confirm(`¿Eliminar ${r.codigo}?`)) removeRestriccion(r.id) }} className="grid h-7 w-7 place-items-center rounded text-slate-400 hover:text-rose-500 dark:hover:bg-rose-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div></td>
                </tr>
              ) })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal title={modal.id ? `Editar ${form.codigo || 'restricción'}` : 'Nueva restricción'} onClose={() => setModal(null)} onSave={save}>
          <FF label="Título"><In value={form.titulo} onChange={(v) => setForm((f) => ({ ...f, titulo: v }))} /></FF>
          <Row2>
            <FF label="Prioridad"><Sel value={form.prioridad} onChange={(v) => setForm((f) => ({ ...f, prioridad: v }))} options={PRIORIDADES.map((p) => ({ value: p, label: p }))} /></FF>
            <FF label="Tipo"><Sel value={form.tipo} onChange={(v) => setForm((f) => ({ ...f, tipo: v }))} options={TIPOS.map((t) => ({ value: t, label: t }))} /></FF>
          </Row2>
          <Row2>
            <FF label="CWA"><Sel value={form.cwaId} onChange={(v) => setForm((f) => ({ ...f, cwaId: v, cwpId: '' }))} options={cwas.map((c) => ({ value: c.id, label: c.codigo }))} /></FF>
            <FF label="CWP"><Sel value={form.cwpId} onChange={(v) => setForm((f) => ({ ...f, cwpId: v }))} options={cwps.filter((c) => !form.cwaId || c.cwaId === form.cwaId).map((c) => ({ value: c.id, label: c.codigo }))} /></FF>
          </Row2>
          <Row2>
            <FF label="Responsable"><In value={form.responsable} onChange={(v) => setForm((f) => ({ ...f, responsable: v }))} /></FF>
            <FF label="Fecha límite"><In type="date" value={form.fechaLimite} onChange={(v) => setForm((f) => ({ ...f, fechaLimite: v }))} /></FF>
          </Row2>
          <FF label="Estado"><Sel value={form.estado} onChange={(v) => setForm((f) => ({ ...f, estado: v }))} options={ESTADOS.map((e) => ({ value: e, label: e }))} /></FF>
          <FF label="Descripción"><Ta value={form.descripcion} onChange={(v) => setForm((f) => ({ ...f, descripcion: v }))} /></FF>
        </Modal>
      )}
    </>
  )
}

const TONE = { rose: 'text-rose-600 dark:text-rose-400', amber: 'text-amber-600 dark:text-amber-400', emerald: 'text-emerald-600 dark:text-emerald-400', slate: 'text-slate-800 dark:text-white' }
const Stat = ({ label, value, tone = 'slate' }) => (
  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center dark:border-white/10 dark:bg-ink-800/60">
    <p className={['text-2xl font-bold tabular-nums', TONE[tone]].join(' ')}>{value}</p>
    <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
  </div>
)
const Filt = ({ value, onChange, options, all }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-600 dark:border-white/10 dark:bg-ink-900 dark:text-slate-300">
    <option value="">{all}</option>{options.map((o) => <option key={o} value={o}>{o}</option>)}
  </select>
)
