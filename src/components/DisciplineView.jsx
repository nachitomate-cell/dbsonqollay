import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUpRight,
  Check,
  FolderPlus,
  FolderSync,
  Info,
  LayoutGrid,
  Loader2,
  Trash2,
  TriangleAlert,
  Upload,
  X,
} from 'lucide-react'
import Icon from './Icon.jsx'

/**
 * Vista A — Menú de subcategorías de una disciplina (dos columnas).
 *  - Izquierda: banner descriptivo, tarjeta "Seleccionar todos", tarjetas de
 *    subcategoría con badge de selección (✓ verde / ⚠ ámbar).
 *  - Derecha: panel resumen + acciones de espacio + importación de datos.
 *
 * props:
 *  - discipline, onOpenSubcategory(subId)
 *  - onImport(file), importing, importError, onRemoveImported(subId)
 */
export default function DisciplineView({ discipline, onOpenSubcategory, onImport, importing, importError, onRemoveImported }) {
  const [selected, setSelected] = useState(() => new Set())
  const fileInput = useRef(null)

  useEffect(() => {
    if (discipline) setSelected(new Set(discipline.subcategories.map((s) => s.id)))
  }, [discipline])

  if (!discipline) return null

  const subs = discipline.subcategories
  const allSelected = subs.length > 0 && subs.every((s) => selected.has(s.id))
  const selectedSubs = subs.filter((s) => selected.has(s.id))
  const total = useMemo(() => selectedSubs.reduce((acc, s) => acc + (s.count || 0), 0), [selectedSubs])
  const hasData = total > 0

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(subs.map((s) => s.id)))

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (file) onImport?.(file, discipline.id)
    e.target.value = ''
  }

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        {/* ---------------- Columna izquierda ---------------- */}
        <div className="min-w-0">
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
            <p>{discipline.description}</p>
          </div>

          <SelectAllCard checked={allSelected} onToggle={toggleAll} />

          <div className="mt-3 space-y-3">
            {subs.map((sc) => (
              <SubcategoryCard
                key={sc.id}
                sub={sc}
                selected={selected.has(sc.id)}
                onToggleSelect={() => toggle(sc.id)}
                onOpen={() => (sc.count || 0) > 0 && onOpenSubcategory(sc.id)}
                onRemove={sc.imported ? () => onRemoveImported?.(sc.id) : null}
              />
            ))}
          </div>
        </div>

        {/* ---------------- Columna derecha ---------------- */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <SummaryPanel hasData={hasData} total={total} items={selectedSubs} />

          <div className="mt-4 flex flex-wrap gap-2">
            <SpaceButton primary icon={FolderPlus}>Nuevo espacio</SpaceButton>
            <SpaceButton icon={FolderSync}>Agregar a espacio existente</SpaceButton>
            <SpaceButton icon={Trash2} onClick={() => setSelected(new Set())}>Limpiar espacio</SpaceButton>
          </div>

          {/* Importación de datos */}
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-4 dark:border-white/15 dark:bg-ink-800/40">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <Upload className="h-4 w-4 text-brand-500" />
              Importar datos de ingeniería
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Carga un Excel (.xlsx/.xls) o CSV (p. ej. SQY_*) y se agregará como nueva subcategoría en {discipline.name}.
            </p>
            <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
            <button
              onClick={() => fileInput.current?.click()}
              disabled={importing}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60 dark:bg-accent dark:text-ink-900 dark:hover:bg-accent-400"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {importing ? 'Importando…' : 'Seleccionar archivo'}
            </button>
            {importError && <p className="mt-2 text-xs font-medium text-rose-500">{importError}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------- subcomponentes ---------------------------- */

function StatusBadge({ ok }) {
  return (
    <span
      className={[
        'absolute -left-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full text-white shadow ring-2 ring-white dark:ring-ink-800',
        ok ? 'bg-emerald-500' : 'bg-amber-400',
      ].join(' ')}
    >
      {ok ? <Check className="h-3 w-3" strokeWidth={3} /> : <TriangleAlert className="h-3 w-3" strokeWidth={2.5} />}
    </span>
  )
}

function SelectAllCard({ checked, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-left shadow-sm transition hover:border-brand-300 dark:border-white/10 dark:bg-ink-800/70 dark:hover:border-accent/40"
    >
      <div className="relative">
        <StatusBadge ok={checked} />
        <div className="grid h-12 w-12 place-items-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-ink-700 dark:text-slate-300">
          <LayoutGrid className="h-5 w-5" />
        </div>
      </div>
      <span className="font-semibold text-slate-800 dark:text-slate-100">
        Seleccionar todos los elementos de ingeniería
      </span>
    </button>
  )
}

function SubcategoryCard({ sub, selected, onToggleSelect, onOpen, onRemove }) {
  const hasData = (sub.count || 0) > 0
  return (
    <div
      className={[
        'group relative flex items-center gap-4 overflow-hidden rounded-xl border p-4 transition-all',
        selected
          ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-500/[0.06]'
          : 'border-slate-200 bg-white dark:border-white/10 dark:bg-ink-800/70',
        hasData ? 'hover:shadow-md dark:hover:shadow-card' : '',
      ].join(' ')}
    >
      <button onClick={onToggleSelect} className="relative shrink-0" title={selected ? 'Quitar de la selección' : 'Agregar a la selección'}>
        <StatusBadge ok={selected} />
        <div className="grid h-14 w-14 place-items-center rounded-lg border border-brand-200 bg-brand-50 text-brand-500 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300">
          <Icon name={sub.icon} className="h-6 w-6" />
        </div>
      </button>

      <button onClick={onOpen} disabled={!hasData} className={['min-w-0 flex-1 text-left', hasData ? 'cursor-pointer' : 'cursor-default'].join(' ')}>
        <div className="flex items-center gap-2">
          <h3 className="truncate font-semibold text-slate-800 dark:text-white">{sub.name}</h3>
          {hasData && (
            <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-accent/15 dark:text-accent">
              {sub.count}
            </span>
          )}
          {sub.imported && (
            <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
              Importado
            </span>
          )}
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{sub.description}</p>
      </button>

      {onRemove && (
        <button onClick={onRemove} title="Eliminar dataset importado" className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10">
          <X className="h-4 w-4" />
        </button>
      )}
      {hasData && (
        <button onClick={onOpen} className="shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-white/5 dark:hover:text-accent" title="Abrir grilla de datos">
          <ArrowUpRight className="h-5 w-5" />
        </button>
      )}
    </div>
  )
}

function SummaryPanel({ hasData, total, items }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
      {hasData ? (
        <>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
            Total de elementos : <span className="tabular-nums text-brand-600 dark:text-accent">{total.toLocaleString('es-CL')}</span>
          </p>
          <div className="my-3 border-t border-slate-200 dark:border-white/10" />
          <ul className="space-y-2 text-sm">
            {items.map((s) => (
              <li key={s.id} className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                <span className="truncate">{s.name.replace(/\s*\(.*\)$/, '')}</span>
                <span className="ml-3 shrink-0 font-semibold tabular-nums text-brand-600 dark:text-accent">{s.count}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-center text-sm font-medium text-slate-600 dark:text-slate-300">
          La disciplina seleccionada no tiene datos
        </p>
      )}
    </div>
  )
}

function SpaceButton({ icon: IconCmp, children, primary, onClick }) {
  return (
    <button
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition',
        primary
          ? 'bg-brand-500 text-white shadow-sm hover:bg-brand-600 dark:bg-accent dark:text-ink-900 dark:shadow-glow dark:hover:bg-accent-400'
          : 'border border-slate-300 bg-white text-slate-700 hover:border-brand-400 hover:text-brand-600 dark:border-white/15 dark:bg-ink-800 dark:text-slate-300 dark:hover:border-accent/40 dark:hover:text-accent',
      ].join(' ')}
    >
      <IconCmp className="h-4 w-4" />
      {children}
    </button>
  )
}
