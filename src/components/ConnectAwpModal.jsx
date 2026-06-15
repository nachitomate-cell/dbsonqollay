import { useEffect, useMemo, useRef, useState } from 'react'
import { Boxes, Check, Layers, Link2, Loader2, RefreshCw, Search, Upload, X } from 'lucide-react'

/**
 * Modal "Conectar a AWP": el usuario asocia los componentes seleccionados a un
 * CWA/CWP leído del CSV exportado de Aura AWP.
 *  - Si no hay CWPs importados → pantalla de importación del CSV.
 *  - Si hay → navegador CWA→CWP (buscable); al elegir un CWP se conecta.
 *
 * props:
 *  - cwps: [{ codigo, nombre, cwa, disciplina, estado, hh, ... }]
 *  - count: nº de componentes seleccionados
 *  - onImport(file): Promise<count> · onClear() · onConnect(cwp) · onClose()
 */
export default function ConnectAwpModal({ cwps = [], count = 0, onImport, onClear, onConnect, onClose }) {
  const [query, setQuery] = useState('')
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [closing, setClosing] = useState(false)
  const fileRef = useRef(null)

  // Cierra con animación de "caída": reproduce la animación y, al terminar,
  // ejecuta la acción real (cerrar, o conectar y cerrar). 450 ms = la animación.
  function requestClose(action) {
    if (closing) return
    setClosing(true)
    setTimeout(() => (action || onClose)(), 450)
  }

  // Cerrar con Escape (también con la animación).
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') requestClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closing])

  async function pick(file) {
    if (!file) return
    setImporting(true); setError('')
    try {
      const n = await onImport(file)
      if (!n) setError('No se encontraron CWPs en el archivo. Verifica que sea el CSV exportado de Aura AWP.')
    } catch (e) {
      setError(e.message || 'No se pudo leer el archivo.')
    } finally { setImporting(false) }
  }

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? cwps.filter((c) => [c.codigo, c.nombre, c.cwa, c.disciplina].some((v) => String(v ?? '').toLowerCase().includes(q)))
      : cwps
    const m = new Map()
    for (const c of filtered) { const k = c.cwa || '—'; if (!m.has(k)) m.set(k, []); m.get(k).push(c) }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'))
  }, [cwps, query])

  const hasData = cwps.length > 0

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className={`absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300 dark:bg-black/60 ${closing ? 'opacity-0' : 'opacity-100'}`} onClick={() => requestClose()} />
      <div className={`relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-ink-800 ${closing ? 'animate-fall' : ''}`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-brand-500 dark:text-accent" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Conectar a AWP</h3>
            {count > 0 && <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:bg-accent/15 dark:text-accent">{count} componente{count === 1 ? '' : 's'}</span>}
          </div>
          <button onClick={() => requestClose()} className="text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"><X className="h-4 w-4" /></button>
        </div>

        {!hasData ? (
          /* Importación del CSV */
          <div className="px-6 py-8 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl border border-brand-200 bg-brand-50 text-brand-500 dark:border-accent/30 dark:bg-accent/10 dark:text-accent">
              <Upload className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-white">Importa el listado de CWPs</p>
            <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Carga el CSV de CWPs exportado de Aura AWP. La app leerá la jerarquía CWA/CWP para conectar tus componentes.
            </p>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; pick(f); e.target.value = '' }} />
            <button onClick={() => fileRef.current?.click()} disabled={importing} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-60 dark:bg-accent dark:text-ink-900">
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Seleccionar CSV
            </button>
            {error && <p className="mt-3 text-xs font-medium text-rose-500">{error}</p>}
          </div>
        ) : (
          <>
            {count === 0 && (
              <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                <b>Primero selecciona los componentes.</b> Marca en la planilla las filas
                que quieres asignar (con las casillas de la izquierda) y vuelve a abrir
                “Conectar a AWP”. Sin selección, los paquetes quedan deshabilitados.
              </div>
            )}
            <div className="border-b border-slate-200 px-4 py-3 dark:border-white/10">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 dark:border-white/10 dark:bg-ink-900">
                <Search className="h-4 w-4 text-slate-400" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar CWP, CWA o disciplina…" className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none dark:text-slate-200" />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {groups.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">Ningún CWP coincide con la búsqueda.</p>
              ) : groups.map(([cwa, items]) => (
                <div key={cwa} className="mb-3">
                  <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <Layers className="h-3.5 w-3.5 text-brand-500 dark:text-accent" /> {cwa}
                  </p>
                  <div className="space-y-1">
                    {items.map((c) => (
                      <button
                        key={c.codigo}
                        onClick={() => count > 0 && requestClose(() => onConnect(c))}
                        disabled={count === 0}
                        title={count === 0 ? 'Selecciona componentes primero' : `Conectar ${count} componente(s) a ${c.codigo}`}
                        className="group flex w-full items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-left transition hover:border-brand-300 hover:bg-brand-50/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:hover:border-accent/40 dark:hover:bg-accent/5"
                      >
                        <Boxes className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-brand-500 dark:group-hover:text-accent" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-mono text-xs font-bold text-slate-800 dark:text-white">{c.codigo}</span>
                          <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400" title={c.nombre}>{c.nombre}</span>
                        </span>
                        <span className="shrink-0 text-right text-[10px] text-slate-400">
                          <span className="block">{c.disciplina?.split(' - ')[0] || ''}</span>
                          {c.hh && <span className="block tabular-nums">{Number(c.hh).toLocaleString('es-CL')} HH</span>}
                        </span>
                        <Check className="h-4 w-4 shrink-0 text-transparent group-hover:text-brand-500 dark:group-hover:text-accent" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs dark:border-white/10">
              <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 font-medium text-slate-400 transition hover:text-brand-600 dark:hover:text-accent">
                <RefreshCw className="h-3.5 w-3.5" /> Reimportar CSV
              </button>
              <span className="text-slate-400">{cwps.length} CWPs · elige uno para conectar</span>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; pick(f); e.target.value = '' }} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
