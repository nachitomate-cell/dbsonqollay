import { useEffect } from 'react'
import { Keyboard, Lightbulb, X } from 'lucide-react'

/**
 * Ayuda rápida: atajos de teclado + tips de uso. Se abre con el botón "?" del
 * header o con la tecla "?" (Shift+/) fuera de un campo de texto.
 */
const SHORTCUTS = [
  { keys: ['⌘', 'K'], alt: ['Ctrl', 'K'], desc: 'Buscar en todo el proyecto (TAG, planilla, CWP)' },
  { keys: ['Ctrl', 'F'], desc: 'Buscar dentro de la planilla abierta' },
  { keys: ['?'], desc: 'Abrir esta ayuda' },
  { keys: ['Esc'], desc: 'Cerrar menús y diálogos' },
]

const TIPS = [
  'Clic en un elemento del visor 3D para ver y editar sus datos de planilla.',
  'Para asignar a un paquete AWP: selecciona las filas en la planilla y pulsa “Conectar a AWP”.',
  'Publica el modelo desde Navisworks con “Publicar a la nube”. Mismo nombre = nueva versión.',
  'Configuración → “Historial de modificaciones” muestra quién cambió qué y cuándo.',
  'El buscador del header te lleva directo al elemento, planilla o paquete.',
]

export default function HelpModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-ink-800">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Ayuda y atajos</h3>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400"><Keyboard className="h-3.5 w-3.5" /> Atajos de teclado</p>
          <div className="mb-5 space-y-1.5">
            {SHORTCUTS.map((s, i) => (
              <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-1.5 dark:border-white/5">
                <span className="text-xs text-slate-600 dark:text-slate-300">{s.desc}</span>
                <span className="flex shrink-0 items-center gap-1">
                  {s.keys.map((k) => <kbd key={k} className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:border-white/10 dark:bg-ink-900 dark:text-slate-300">{k}</kbd>)}
                </span>
              </div>
            ))}
          </div>

          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400"><Lightbulb className="h-3.5 w-3.5" /> Tips</p>
          <ul className="space-y-1.5">
            {TIPS.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400 dark:bg-accent" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
