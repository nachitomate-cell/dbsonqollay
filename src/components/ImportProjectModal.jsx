import { useEffect } from 'react'
import { ArrowRight, Loader2, TriangleAlert, Upload } from 'lucide-react'

/**
 * Confirmación de "Importar proyecto": muestra a QUÉ planilla va cada hoja del
 * Excel y cuántas filas reemplaza, antes de escribir nada. Es el paso que evita
 * el error de dejar datos en la planilla equivocada: acá se ve el destino.
 *
 * props:
 *  - fileName · plan: [{ sheet, name, discipline, fileRows, currentRows, isNew }]
 *  - unmatched: nombres de hoja sin planilla · working: bool · onConfirm() · onClose()
 */
export default function ImportProjectModal({ fileName, plan = [], unmatched = [], working, onConfirm, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !working) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, working])

  const totalRows = plan.reduce((n, p) => n + p.fileRows, 0)
  const n = (v) => v.toLocaleString('es-CL')

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/40" onClick={working ? undefined : onClose} />
      <div className="fixed left-1/2 top-1/2 z-[81] flex max-h-[85vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-ink-800">
        <div className="mb-1 flex items-center gap-2">
          <Upload className="h-5 w-5 text-brand-500 dark:text-accent" />
          <h3 className="min-w-0 truncate text-base font-bold text-slate-900 dark:text-white" title={fileName}>
            Importar proyecto
          </h3>
        </div>

        {plan.length === 0 ? (
          <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            Ninguna hoja de <b className="text-slate-700 dark:text-slate-200">{fileName}</b> corresponde a una planilla de
            este proyecto. Usa el Excel generado con <b className="text-slate-700 dark:text-slate-200">Exportar</b>: cada
            hoja lleva el código de su planilla (ARQ, MEC, ELE…).
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
              Cada hoja de <b className="text-slate-700 dark:text-slate-200">{fileName}</b> vuelve a su planilla:{' '}
              <b className="text-slate-700 dark:text-slate-200">{plan.length}</b> planilla(s),{' '}
              <b className="text-slate-700 dark:text-slate-200">{n(totalRows)}</b> fila(s) en total.
            </p>

            <div className="-mx-1 min-h-0 flex-1 space-y-1 overflow-y-auto px-1">
              {plan.map((p) => (
                <div
                  key={p.dataKey}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/10"
                >
                  <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                    {p.sheet}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200" title={`${p.name} · ${p.discipline}`}>
                    {p.name}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                    {p.isNew || p.currentRows === 0
                      ? `${n(p.fileRows)} fila(s)`
                      : `${n(p.currentRows)} → ${n(p.fileRows)}`}
                  </span>
                </div>
              ))}
            </div>

            <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              El archivo manda: el contenido actual de esas planillas se reemplaza por el del Excel. Las demás no se tocan.
            </p>

            {unmatched.length > 0 && (
              <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Sin planilla que les corresponda (se omiten): {unmatched.join(', ')}
              </p>
            )}
          </>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={working}
            className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/5"
          >
            {plan.length ? 'Cancelar' : 'Cerrar'}
          </button>
          {plan.length > 0 && (
            <button
              onClick={onConfirm}
              disabled={working}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60 dark:bg-accent dark:text-ink-900"
            >
              {working && <Loader2 className="h-4 w-4 animate-spin" />}
              {working ? 'Importando…' : `Importar ${plan.length} planilla(s)`}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
