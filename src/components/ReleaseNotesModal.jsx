import { useEffect, useMemo, useState } from 'react'
import { Box, Boxes, Sparkles, X } from 'lucide-react'
import { releaseNotes } from '../data/releaseNotes.js'

/**
 * Modal "Novedades": muestra las notas de versión de la plataforma web Y del
 * plugin de Navisworks en un solo lugar. Se abre desde el botón del Header.
 *
 * Los datos viven en src/data/releaseNotes.js (scope: 'app' | 'plugin').
 */
const FILTERS = [
  { id: 'all', label: 'Todo' },
  { id: 'app', label: 'Plataforma' },
  { id: 'plugin', label: 'Plugin' },
]

function fmtDate(d) {
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch { return d }
}

export default function ReleaseNotesModal({ open, onClose }) {
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const list = useMemo(() => {
    const items = filter === 'all' ? releaseNotes : releaseNotes.filter((r) => r.scope === filter)
    return [...items].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  }, [filter])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-ink-800">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <Sparkles className="h-4 w-4 text-brand-500 dark:text-accent" /> Novedades
          </h3>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>

        {/* Filtro */}
        <div className="flex shrink-0 gap-1.5 border-b border-slate-100 px-5 py-2.5 dark:border-white/5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                filter === f.id
                  ? 'bg-brand-500 text-white dark:bg-accent dark:text-ink-900'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <ol className="space-y-5">
            {list.map((r) => {
              const isPlugin = r.scope === 'plugin'
              return (
                <li key={r.scope + r.version} className="relative border-l-2 border-slate-100 pl-4 dark:border-white/10">
                  <span className={`absolute -left-[7px] top-1 grid h-3 w-3 place-items-center rounded-full ${isPlugin ? 'bg-sky-500' : 'bg-brand-500 dark:bg-accent'}`} />
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      isPlugin
                        ? 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400'
                        : 'bg-brand-50 text-brand-600 dark:bg-accent/10 dark:text-accent'
                    }`}>
                      {isPlugin ? <Box className="h-3 w-3" /> : <Boxes className="h-3 w-3" />}
                      {isPlugin ? 'Plugin' : 'Plataforma'}
                    </span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100">v{r.version}</span>
                    <span className="text-xs text-slate-400">· {fmtDate(r.date)}</span>
                  </div>
                  {r.title && <p className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">{r.title}</p>}
                  <ul className="space-y-1">
                    {r.items.map((it, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300 dark:bg-white/20" />
                        {it}
                      </li>
                    ))}
                  </ul>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </div>
  )
}
