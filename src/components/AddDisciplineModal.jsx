import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import Icon from './Icon.jsx'

// Iconos ofrecidos para la disciplina (deben existir en el registro de Icon.jsx).
const ICONS = [
  'Layers', 'Boxes', 'Zap', 'Cog', 'Pipette', 'Cable', 'Server', 'Cpu',
  'Fan', 'Gauge', 'Truck', 'Pickaxe', 'Mountain', 'Waves', 'Recycle', 'Sprout',
  'TreePine', 'Building2', 'BrickWall', 'Construction', 'Route', 'Spline', 'Map', 'Lightbulb',
  'Anchor', 'Settings', 'Frame', 'Grid3x3',
]

/**
 * Modal para crear una disciplina nueva (nombre + icono), con vista previa.
 * props: onCreate({ name, icon }), onClose()
 */
export default function AddDisciplineModal({ onCreate, onClose }) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('Layers')
  const canCreate = name.trim().length > 0

  // Cerrar con Escape.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function submit() { if (canCreate) onCreate({ name: name.trim(), icon }) }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm dark:bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-ink-800">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Nueva disciplina</h3>
          <button onClick={onClose} className="text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"><X className="h-4 w-4" /></button>
        </div>

        <div className="px-5 py-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Nombre</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
              placeholder="Ej.: Instrumentación, Tronadura, Geotecnia…"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-400 focus:outline-none dark:border-white/10 dark:bg-ink-900 dark:text-slate-100"
            />
          </label>

          <div className="mt-4">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Icono</span>
            <div className="grid grid-cols-8 gap-1.5">
              {ICONS.map((nm) => (
                <button
                  key={nm}
                  onClick={() => setIcon(nm)}
                  title={nm}
                  className={['grid h-9 place-items-center rounded-lg border transition', icon === nm ? 'border-brand-400 bg-brand-50 text-brand-600 dark:border-accent/50 dark:bg-accent/10 dark:text-accent' : 'border-slate-200 text-slate-500 hover:border-brand-300 hover:text-brand-600 dark:border-white/10 dark:text-slate-400 dark:hover:text-accent'].join(' ')}
                >
                  <Icon name={nm} className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>

          {/* Vista previa */}
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-white/10 dark:bg-white/5">
            <div className="grid h-9 w-9 place-items-center rounded-lg border border-brand-200 bg-brand-50 text-brand-500 dark:border-accent/30 dark:bg-accent/10 dark:text-accent"><Icon name={icon} className="h-[18px] w-[18px]" /></div>
            <span className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{name.trim() || 'Vista previa de la disciplina'}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-white/10">
          <button onClick={onClose} className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">Cancelar</button>
          <button onClick={submit} disabled={!canCreate} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-50 dark:bg-accent dark:text-ink-900">
            <Plus className="h-4 w-4" /> Crear disciplina
          </button>
        </div>
      </div>
    </div>
  )
}
