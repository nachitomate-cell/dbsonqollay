import { useEffect, useRef, useState } from 'react'
import { Lock, Save, Trash2, X } from 'lucide-react'

// Columna identidad inmutable (camino B): llave de vínculo con el modelo 3D /
// plugin. Se escribe una vez y queda bloqueada (igual que en la grilla).
const isIdColumn = (h) => /^id$/i.test(String(h || '').trim())

/**
 * Ficha de edición de un registro. Panel lateral (drawer) con un campo por cada
 * columna visible. Edita un borrador local y confirma con Guardar.
 *
 * props:
 *  - record: objeto fila (con _id)
 *  - columns: [{ key, visible }]
 *  - title: encabezado (p. ej. el TAG)
 *  - onSave(patch), onDelete(), onClose()
 */
export default function RecordDrawer({ record, columns, title, onSave, onDelete, onClose }) {
  const [draft, setDraft] = useState(record)

  useEffect(() => setDraft(record), [record])

  // ¿Hay cambios sin guardar respecto del registro original?
  const isDirty = () => {
    if (!record) return false
    for (const k of new Set([...Object.keys(record), ...Object.keys(draft)])) {
      if (k === '_id') continue
      if ((draft[k] ?? '') !== (record[k] ?? '')) return true
    }
    return false
  }

  // Cierra el drawer, pero si hay cambios sin guardar pide confirmación para no
  // perder el avance. Se usa en TODAS las salidas: X, Cancelar, clic fuera y Esc.
  const requestClose = () => {
    if (isDirty() && !window.confirm('Tienes cambios sin guardar en esta ficha.\n¿Quieres salir y perderlos?')) return
    onClose()
  }
  // Ref siempre fresca para el handler de Esc (evita resuscribir en cada tecla).
  const requestCloseRef = useRef(requestClose)
  requestCloseRef.current = requestClose

  // Esc cierra el drawer (con confirmación si hay cambios sin guardar).
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') requestCloseRef.current() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Antes de recargar por una actualización de la app, si hay un borrador sin
  // guardar en la ficha, lo persiste para no perderlo. Ref para leer lo último.
  const saveDraftRef = useRef(() => {})
  saveDraftRef.current = () => {
    if (record && isDirty()) { const { _id, ...patch } = draft; onSave(patch) }
  }
  useEffect(() => {
    const h = () => saveDraftRef.current()
    window.addEventListener('sqy:commit-drafts', h)
    return () => window.removeEventListener('sqy:commit-drafts', h)
  }, [])

  if (!record) return null
  const visible = columns.filter((c) => c.visible)

  // Todo lo ingresado en las planillas se guarda y se muestra en MAYÚSCULAS.
  // El ID inmutable nunca se modifica (blindaje extra además del readOnly).
  const set = (key, value) => {
    if (isIdColumn(key) && String(record[key] ?? '').trim() !== '') return
    setDraft((d) => ({ ...d, [key]: value.toUpperCase() }))
  }
  const isLong = (key) => /DESCRIP|OBSERV|NOTA|COMENT/i.test(key)

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm dark:bg-black/60" onClick={requestClose} />

      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-ink-800">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-500">Ficha de elemento</p>
            <h3 className="truncate text-lg font-bold text-slate-900 dark:text-white">{title || 'Registro'}</h3>
          </div>
          <button onClick={requestClose} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/5" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Fields */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {visible.map((c) => {
            // Set-once: el ID se bloquea si el registro original ya trae valor.
            const locked = isIdColumn(c.key) && String(record[c.key] ?? '').trim() !== ''
            return (
            <label key={c.key} className="block">
              <span className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {c.key.replace(/_/g, ' ')}
                {locked && <Lock className="h-3 w-3 text-slate-400" />}
              </span>
              {locked ? (
                <>
                  <input
                    value={draft[c.key] ?? ''}
                    readOnly
                    title="ID inmutable: es la llave de vínculo con el modelo 3D / plugin. Edita el TAG para la modularización."
                    className="w-full cursor-not-allowed select-none rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400"
                  />
                  <span className="mt-1 block text-[10px] text-slate-400">No editable — llave del modelo. Edita el TAG para la modularización.</span>
                </>
              ) : isLong(c.key) ? (
                <textarea
                  rows={2}
                  value={draft[c.key] ?? ''}
                  onChange={(e) => set(c.key, e.target.value)}
                  className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-ink-900 dark:text-slate-100 dark:focus:border-accent/50"
                />
              ) : (
                <input
                  value={draft[c.key] ?? ''}
                  onChange={(e) => set(c.key, e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-ink-900 dark:text-slate-100 dark:focus:border-accent/50"
                />
              )}
            </label>
            )
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-5 py-4 dark:border-white/10">
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
          >
            <Trash2 className="h-4 w-4" />
            Eliminar
          </button>
          <div className="flex gap-2">
            <button onClick={requestClose} className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/15 dark:bg-ink-800 dark:text-slate-300 dark:hover:bg-white/5">
              Cancelar
            </button>
            <button
              onClick={() => {
                const { _id, ...patch } = draft
                onSave(patch)
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 dark:bg-accent dark:text-ink-900 dark:hover:bg-accent-400"
            >
              <Save className="h-4 w-4" />
              Guardar
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}
