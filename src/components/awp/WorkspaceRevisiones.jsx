import { useMemo, useState } from 'react'
import { CheckCircle2, Trash2 } from 'lucide-react'
import { Empty, FF, Head, In, Modal, Row2, Sel } from './ui.jsx'

// Control de revisiones de reportes/entregables (Rev A, B, C…). Al crear una nueva
// revisión de un documento, las anteriores quedan "Reemplazada"; se aprueba por
// revisores y al completarse pasa a "Aprobada".

const ESTADOS = ['Borrador', 'En revisión', 'Aprobada', 'Rechazada', 'Reemplazada']
const estadoCls = (e) => ({
  Borrador: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300',
  'En revisión': 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  Aprobada: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  Rechazada: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  Reemplazada: 'bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500',
}[e] || 'bg-slate-100 text-slate-600')

export default function WorkspaceRevisiones({ revisiones, addRevision, updateRevision, removeRevision, autorDefault }) {
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({})

  const documentos = useMemo(() => [...new Set(revisiones.map((r) => r.documento))], [revisiones])
  const grupos = useMemo(() => documentos.map((doc) => ({ doc, revs: revisiones.filter((r) => r.documento === doc).sort((a, b) => (b.rev || '').localeCompare(a.rev || '')) })), [documentos, revisiones])

  function openNew() { setForm({ documento: documentos[0] || '', documentoNuevo: '', autor: autorDefault || '', revisoresTotal: 1, fecha: new Date().toISOString().slice(0, 10) }); setModal(true) }
  function save() {
    const doc = (form.documentoNuevo || '').trim() || form.documento
    if (!doc) return
    const prev = revisiones.filter((r) => r.documento === doc)
    // Siguiente letra = máxima existente + 1 (robusto si se borró una intermedia).
    const rev = String.fromCharCode(prev.reduce((m, r) => Math.max(m, (r.rev || 'A').charCodeAt(0)), 64) + 1) // A, B, C…
    prev.forEach((r) => { if (r.estado !== 'Reemplazada') updateRevision(r.id, { estado: 'Reemplazada' }) })
    addRevision({ documento: doc, rev, estado: 'En revisión', fecha: form.fecha, autor: form.autor, revisoresTotal: Number(form.revisoresTotal) || 1, revisoresAprobados: 0 })
    setModal(false)
  }
  function aprobar(r) {
    const ap = (r.revisoresAprobados || 0) + 1
    updateRevision(r.id, { revisoresAprobados: ap, estado: ap >= (r.revisoresTotal || 1) ? 'Aprobada' : 'En revisión' })
  }

  return (
    <>
      <Head title="Revisiones" sub="Control de revisiones de reportes y entregables." onNew={openNew} newLabel="Nueva revisión" />
      {revisiones.length === 0 ? <Empty msg="Sin revisiones. Crea la primera revisión de un reporte/entregable." /> : (
        <div className="space-y-5">
          {grupos.map(({ doc, revs }) => (
            <section key={doc}>
              <h3 className="mb-2 text-sm font-bold text-slate-600 dark:text-slate-300">{doc}</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {revs.map((r) => (
                  <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-ink-800/60">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 dark:text-white">Rev {r.rev}</span>
                      <span className={['rounded-md px-2 py-0.5 text-[11px] font-semibold', estadoCls(r.estado)].join(' ')}>{r.estado}</span>
                      <button onClick={() => { if (confirm(`¿Eliminar ${doc} Rev ${r.rev}?`)) removeRevision(r.id) }} className="ml-auto grid h-7 w-7 place-items-center rounded text-slate-400 hover:text-rose-500 dark:hover:bg-rose-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span>{r.fecha ? new Date(r.fecha + 'T00:00:00').toLocaleDateString('es-CL') : '—'}</span>
                      <span>{r.revisoresAprobados || 0}/{r.revisoresTotal || 1} revisores</span>
                      {r.autor && <span>· {r.autor}</span>}
                    </div>
                    {(r.estado === 'En revisión' || r.estado === 'Borrador') && (
                      <div className="mt-2 flex gap-2">
                        <button onClick={() => aprobar(r)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Aprobar</button>
                        <select value={r.estado} onChange={(e) => updateRevision(r.id, { estado: e.target.value })} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 dark:border-white/10 dark:bg-ink-900 dark:text-slate-300">
                          {ESTADOS.filter((e) => e !== 'Reemplazada').map((e) => <option key={e} value={e}>{e}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {modal && (
        <Modal title="Nueva revisión" onClose={() => setModal(false)} onSave={save}>
          {documentos.length > 0 && <FF label="Documento existente"><Sel value={form.documento} onChange={(v) => setForm((f) => ({ ...f, documento: v }))} options={documentos.map((d) => ({ value: d, label: d }))} placeholder="— nuevo —" /></FF>}
          <FF label="…o nuevo documento"><In value={form.documentoNuevo} onChange={(v) => setForm((f) => ({ ...f, documentoNuevo: v }))} placeholder="Reporte General de CWAs" /></FF>
          <Row2>
            <FF label="Autor"><In value={form.autor} onChange={(v) => setForm((f) => ({ ...f, autor: v }))} /></FF>
            <FF label="Fecha"><In type="date" value={form.fecha} onChange={(v) => setForm((f) => ({ ...f, fecha: v }))} /></FF>
          </Row2>
          <FF label="Revisores requeridos"><In value={form.revisoresTotal} onChange={(v) => setForm((f) => ({ ...f, revisoresTotal: v }))} /></FF>
          <p className="text-xs text-slate-400">La letra de revisión (A, B, C…) se asigna automáticamente; las revisiones previas del documento quedan "Reemplazada".</p>
        </Modal>
      )}
    </>
  )
}
