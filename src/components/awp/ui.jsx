// Primitivos de UI compartidos por los módulos del Workspace AWP.
import { Plus, X } from 'lucide-react'

export const fmt = (n) => Number(n || 0).toLocaleString('es-CL')

export function Head({ title, sub, onNew, newLabel, children }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-xl font-extrabold text-slate-800 dark:text-white">{title}</h1>{sub && <p className="text-sm text-slate-500 dark:text-slate-400">{sub}</p>}</div>
      <div className="flex items-center gap-2">
        {children}
        {onNew && <button onClick={onNew} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 dark:bg-accent dark:text-ink-900"><Plus className="h-4 w-4" /> {newLabel}</button>}
      </div>
    </div>
  )
}

export const Empty = ({ msg }) => (
  <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500 dark:border-white/15 dark:bg-ink-800/40 dark:text-slate-400">{msg}</div>
)

export function Modal({ title, children, onClose, onSave, saveLabel = 'Guardar' }) {
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-ink-800" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><h3 className="text-base font-bold text-slate-800 dark:text-white">{title}</h3><button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button></div>
        <div className="space-y-3">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 dark:border-white/10 dark:text-slate-300">Cancelar</button>
          {onSave && <button onClick={onSave} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 dark:bg-accent dark:text-ink-900">{saveLabel}</button>}
        </div>
      </div>
    </div>
  )
}

export const Row2 = ({ children }) => <div className="grid grid-cols-2 gap-3">{children}</div>
export const FF = ({ label, children }) => <label className="block"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>{children}</label>
const inCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-400 focus:outline-none dark:border-white/10 dark:bg-ink-900 dark:text-slate-100'
export const In = ({ value, onChange, type = 'text', placeholder }) => <input type={type} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={inCls} />
export const Ta = ({ value, onChange }) => <textarea rows={2} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={inCls} />
export const Sel = ({ value, onChange, options, placeholder = '—' }) => <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={inCls}><option value="">{placeholder}</option>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
