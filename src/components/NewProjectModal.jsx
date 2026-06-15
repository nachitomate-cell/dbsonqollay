import { useEffect, useState } from 'react'
import { Database, Plus, Sprout, X } from 'lucide-react'
import Icon from './Icon.jsx'

// Iconos para el proyecto (deben existir en el registro de Icon.jsx).
const ICONS = ['Building2', 'Boxes', 'Layers', 'Mountain', 'Pickaxe', 'Construction', 'Server', 'Cog', 'Zap', 'Map', 'Route', 'Frame']

/**
 * Modal para crear un proyecto nuevo: nombre + icono + cómo arranca (vacío o con
 * las disciplinas base). props: onCreate({ name, icon, empty }), onClose()
 */
export default function NewProjectModal({ onCreate, onClose }) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('Building2')
  const [empty, setEmpty] = useState(false) // false = con disciplinas base
  const canCreate = name.trim().length > 0

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function submit() { if (canCreate) onCreate({ name: name.trim(), icon, empty }) }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-fadeIn dark:bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-modalIn dark:border-white/10 dark:bg-ink-800">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Nuevo proyecto</h3>
          <button onClick={onClose} className="text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"><X className="h-4 w-4" /></button>
        </div>

        <div className="px-5 py-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Nombre</span>
            <input
              autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
              placeholder="Ej.: Mina Norte, Ampliación Planta…"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-400 focus:outline-none dark:border-white/10 dark:bg-ink-900 dark:text-slate-100"
            />
          </label>

          <div className="mt-4">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Icono</span>
            <div className="grid grid-cols-6 gap-1.5">
              {ICONS.map((nm) => (
                <button key={nm} onClick={() => setIcon(nm)} title={nm}
                  className={['grid h-9 place-items-center rounded-lg border transition', icon === nm ? 'border-brand-400 bg-brand-50 text-brand-600 dark:border-accent/50 dark:bg-accent/10 dark:text-accent' : 'border-slate-200 text-slate-500 hover:border-brand-300 hover:text-brand-600 dark:border-white/10 dark:text-slate-400 dark:hover:text-accent'].join(' ')}>
                  <Icon name={nm} className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">¿Cómo arranca?</span>
            <div className="grid grid-cols-2 gap-2">
              <StartOption active={!empty} icon={Database} title="Con disciplinas base" desc="Trae las disciplinas de la plataforma." onClick={() => setEmpty(false)} />
              <StartOption active={empty} icon={Sprout} title="Vacío" desc="Sin disciplinas; empiezas de cero." onClick={() => setEmpty(true)} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-white/10">
          <button onClick={onClose} className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">Cancelar</button>
          <button onClick={submit} disabled={!canCreate} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-50 dark:bg-accent dark:text-ink-900">
            <Plus className="h-4 w-4" /> Crear proyecto
          </button>
        </div>
      </div>
    </div>
  )
}

function StartOption({ active, icon: IconCmp, title, desc, onClick }) {
  return (
    <button
      onClick={onClick}
      className={['flex flex-col gap-1 rounded-xl border-2 p-3 text-left transition', active ? 'border-brand-400 bg-brand-50/60 dark:border-accent/50 dark:bg-accent/10' : 'border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20'].join(' ')}
    >
      <IconCmp className={`h-4 w-4 ${active ? 'text-brand-600 dark:text-accent' : 'text-slate-400'}`} />
      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</span>
      <span className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">{desc}</span>
    </button>
  )
}
