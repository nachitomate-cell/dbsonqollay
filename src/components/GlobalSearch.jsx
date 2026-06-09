import { useEffect, useMemo, useRef, useState } from 'react'
import { Boxes, FileSpreadsheet, Layers, Search } from 'lucide-react'

/**
 * Buscador global del proyecto (header): busca planillas, elementos (TAG/valor)
 * y CWPs, y muestra un desplegable de resultados. Al elegir uno, navega vía
 * onResult(item). ⌘K / Ctrl+K enfoca el buscador desde cualquier pantalla.
 *
 * props:
 *  - search(query) -> { planillas:[{subId,name,discipline}], elementos:[{subId,planilla,tag,detail}], cwps:[{codigo,nombre,cwa}] }
 *  - onResult(item) · item lleva `type` ('planilla' | 'elemento' | 'cwp')
 */
export default function GlobalSearch({ search, onResult }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)

  // ⌘K / Ctrl+K → enfocar el buscador.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); inputRef.current?.focus(); setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const res = useMemo(() => (query.trim().length >= 2 ? search(query) : { planillas: [], elementos: [], cwps: [] }), [query, search])

  // Lista plana para navegación con teclado.
  const flat = useMemo(() => [
    ...res.planillas.map((p) => ({ type: 'planilla', ...p })),
    ...res.elementos.map((e) => ({ type: 'elemento', ...e })),
    ...res.cwps.map((c) => ({ type: 'cwp', ...c })),
  ], [res])

  useEffect(() => { setActive(0) }, [query])

  function choose(item) {
    if (!item) return
    onResult(item)
    setQuery(''); setOpen(false)
    inputRef.current?.blur()
  }
  function onKeyDown(e) {
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, flat.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); choose(flat[active]) }
  }

  const showPanel = open && query.trim().length >= 2
  const total = flat.length
  // Índice base de cada grupo (para resaltar el activo en la lista plana).
  const iEl = res.planillas.length
  const iCwp = iEl + res.elementos.length

  return (
    <div className="relative hidden md:block">
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-ink-800">
        <Search className="h-4 w-4 text-slate-400 dark:text-slate-500" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Buscar TAG, CWP, equipo…"
          className="w-48 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none dark:text-slate-200 dark:placeholder:text-slate-600"
        />
        <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-white/5">⌘K</kbd>
      </div>

      {showPanel && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-40 max-h-[70vh] w-96 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1.5 shadow-2xl dark:border-white/10 dark:bg-ink-800">
            {total === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">Sin resultados para “{query}”.</p>
            ) : (
              <>
                {res.planillas.length > 0 && (
                  <Group icon={FileSpreadsheet} label="Planillas">
                    {res.planillas.map((p, i) => (
                      <Row key={`p-${p.subId}`} activeRow={active === i} onPick={() => choose({ type: 'planilla', ...p })}
                        title={p.name} sub={p.discipline} />
                    ))}
                  </Group>
                )}
                {res.elementos.length > 0 && (
                  <Group icon={Boxes} label="Elementos">
                    {res.elementos.map((e, i) => (
                      <Row key={`e-${e.subId}-${i}`} activeRow={active === iEl + i} onPick={() => choose({ type: 'elemento', ...e })}
                        title={e.tag} sub={e.detail ? `${e.planilla} · ${e.detail}` : e.planilla} mono />
                    ))}
                  </Group>
                )}
                {res.cwps.length > 0 && (
                  <Group icon={Layers} label="Paquetes de trabajo (CWP)">
                    {res.cwps.map((c, i) => (
                      <Row key={`c-${c.codigo}`} activeRow={active === iCwp + i} onPick={() => choose({ type: 'cwp', ...c })}
                        title={c.codigo} sub={`${c.cwa ? c.cwa + ' · ' : ''}${c.nombre || ''}`} mono />
                    ))}
                  </Group>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Group({ icon: Icon, label, children }) {
  return (
    <div className="mb-1">
      <p className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        <Icon className="h-3 w-3" /> {label}
      </p>
      {children}
    </div>
  )
}

function Row({ activeRow, onPick, title, sub, mono }) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onPick() }}
      className={`flex w-full items-baseline justify-between gap-3 px-3 py-1.5 text-left transition ${activeRow ? 'bg-brand-50 dark:bg-accent/10' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}
    >
      <span className={`shrink-0 ${mono ? 'font-mono' : ''} text-xs font-semibold text-slate-800 dark:text-slate-100`}>{title}</span>
      <span className="min-w-0 flex-1 truncate text-right text-[11px] text-slate-400">{sub}</span>
    </button>
  )
}
