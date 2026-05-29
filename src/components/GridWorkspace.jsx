import { ArrowLeft, X } from 'lucide-react'
import Icon from './Icon.jsx'
import DataTable from './DataTable.jsx'

/**
 * Espacio de trabajo de grillas: enlace de retorno + tira de pestañas con todas
 * las subcategorías abiertas + la grilla activa. Permite tener varias
 * subcategorías abiertas a la vez (como en la plataforma de referencia).
 *
 * props:
 *  - tabs: [{ discipline, subcategory, dataset }]
 *  - activeSub: id de la subcategoría activa
 *  - onSwitch(subId), onClose(subId), onReturn()
 */
export default function GridWorkspace({ tabs, activeSub, onSwitch, onClose, onReturn }) {
  const active = tabs.find((t) => t.subcategory.id === activeSub)

  return (
    <div className="flex h-full flex-col overflow-hidden px-6 pt-4">
      <button
        onClick={onReturn}
        className="mx-auto mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 transition hover:underline dark:text-accent"
      >
        <ArrowLeft className="h-4 w-4" />
        Return To Engineering Element Selection.
      </button>

      {/* Tab strip */}
      <div className="flex flex-wrap items-end gap-1">
        {tabs.map((t) => {
          const isActive = t.subcategory.id === activeSub
          return (
            <div
              key={t.subcategory.id}
              className={[
                'group flex items-center gap-2 rounded-t-lg border border-b-0 px-3.5 py-2.5 transition',
                isActive
                  ? 'border-slate-200 bg-white dark:border-white/10 dark:bg-ink-800'
                  : 'border-transparent bg-slate-200/60 hover:bg-slate-200 dark:bg-ink-800/40 dark:hover:bg-ink-800/70',
              ].join(' ')}
            >
              <button onClick={() => onSwitch(t.subcategory.id)} className="flex items-center gap-2">
                <Icon name={t.subcategory.icon} className={isActive ? 'h-4 w-4 text-brand-600 dark:text-accent' : 'h-4 w-4 text-slate-500 dark:text-slate-400'} />
                <span className={isActive ? 'text-sm font-semibold text-slate-800 dark:text-white' : 'text-sm font-medium text-slate-600 dark:text-slate-300'}>
                  {t.subcategory.name}
                </span>
              </button>
              <button
                onClick={() => onClose(t.subcategory.id)}
                className="grid h-4 w-4 place-items-center rounded-sm bg-rose-500 text-white opacity-70 transition hover:bg-rose-600 group-hover:opacity-100"
                title="Cerrar"
              >
                <X className="h-3 w-3" strokeWidth={3} />
              </button>
            </div>
          )
        })}
      </div>

      {active && (
        <DataTable
          key={active.subcategory.id}
          dataset={active.dataset}
          subcategory={active.subcategory}
          onBack={onReturn}
        />
      )}
    </div>
  )
}
