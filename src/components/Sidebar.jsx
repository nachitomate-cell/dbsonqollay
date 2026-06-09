import { ArrowLeftRight, ArrowRight, ChevronLeft, ChevronRight, FolderKanban, Globe, Home, Plus, Trash2 } from 'lucide-react'
import Icon from './Icon.jsx'
import { disciplines as staticDisciplines } from '../data/disciplines.js'

/**
 * Menú lateral colapsable con las disciplinas de Sonqollay.
 *
 * props:
 *  - collapsed, onToggle()
 *  - activeDiscipline, onSelect(id)
 *  - onSelectAll(): item "Todas las disciplinas"
 *  - disciplines: lista de disciplinas a mostrar. La provee App (viene de la base
 *    de datos vía useDisciplines). Si no se pasa, usa el menú estático de respaldo.
 */
export default function Sidebar({ collapsed, onToggle, activeDiscipline, allActive, homeActive, onSelectHome, onSelect, onSelectAll, onAddDiscipline, onRemoveDiscipline, projectName, onChangeProject, disciplines = staticDisciplines }) {
  return (
    <aside
      className={[
        'relative flex h-full flex-col border-r border-slate-200 bg-white transition-[width] duration-300 ease-in-out',
        'dark:border-white/5 dark:bg-ink-800/80 dark:backdrop-blur',
        collapsed ? 'w-[76px]' : 'w-72',
      ].join(' ')}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-5">
        <img src="/aura1.png" alt="Aura" className="h-10 w-10 shrink-0 object-contain" />
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-lg font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white">
              Aura <span className="text-brand-600 dark:text-accent">GIP</span>
            </p>
            <p className="text-[10px] font-semibold uppercase leading-tight tracking-wide text-slate-400 dark:text-slate-500">
              Gestor de Información<br />de Proyectos
            </p>
          </div>
        )}
      </div>

      {/* "Inicio" (dashboard del proyecto) */}
      {onSelectHome && (
        <div className="mb-1 px-3">
          <button
            onClick={onSelectHome}
            title={collapsed ? 'Inicio' : undefined}
            className={[
              'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors',
              homeActive
                ? 'bg-brand-500 text-white shadow-sm dark:bg-accent/15 dark:text-white dark:ring-1 dark:ring-accent/40'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white',
            ].join(' ')}
          >
            <Home className={['h-[18px] w-[18px] shrink-0 transition-transform duration-200 group-hover:scale-110', homeActive ? 'text-white dark:text-accent' : 'text-slate-500 dark:text-slate-400'].join(' ')} />
            {!collapsed && <span className="flex-1 truncate">Inicio</span>}
          </button>
        </div>
      )}

      {/* "Todas las disciplinas" */}
      <div className="px-3">
        <button
          onClick={onSelectAll}
          title={collapsed ? 'Todas las disciplinas' : undefined}
          className={[
            'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors',
            allActive
              ? 'bg-brand-500 text-white shadow-sm dark:bg-accent/15 dark:text-white dark:ring-1 dark:ring-accent/40'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white',
          ].join(' ')}
        >
          <Globe className={['h-[18px] w-[18px] shrink-0 transition-transform duration-300 ease-out group-hover:rotate-[20deg] group-hover:scale-110', allActive ? 'text-white dark:text-accent' : 'text-slate-500 dark:text-slate-400'].join(' ')} />
          {!collapsed && <span className="flex-1 truncate">Todas las disciplinas</span>}
        </button>
      </div>

      <div className="mx-3 my-2 border-t border-slate-200 dark:border-white/5" />

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-2">
        {disciplines.map((d) => {
          const active = d.id === activeDiscipline
          return (
            <div key={d.id} className="group/disc relative">
              <button
                onClick={() => onSelect(d.id)}
                title={collapsed ? d.name : undefined}
                className={[
                  'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                  active
                    ? 'bg-brand-500 text-white shadow-sm dark:bg-accent/15 dark:text-white dark:ring-1 dark:ring-accent/40'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100',
                ].join(' ')}
              >
                <Icon
                  name={d.icon}
                  className={[
                    'h-[18px] w-[18px] shrink-0 transition-all duration-200 ease-out group-hover:-rotate-6 group-hover:scale-125',
                    active ? 'text-white dark:text-accent' : 'text-slate-500 group-hover:text-slate-700 dark:text-slate-500 dark:group-hover:text-slate-300',
                  ].join(' ')}
                />
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate font-medium">{d.name}</span>
                    {/* Las personalizadas muestran botón de borrar al pasar el mouse;
                        el resto, la flecha de "entrar". */}
                    {!(d.custom && onRemoveDiscipline) && (
                      <span
                        className={[
                          'grid h-6 w-6 shrink-0 place-items-center rounded-full border transition-colors',
                          active
                            ? 'border-white/40 text-white dark:border-accent/40 dark:text-accent'
                            : 'border-slate-300 text-slate-400 group-hover:border-brand-400 group-hover:text-brand-500 dark:border-white/15 dark:text-slate-500 dark:group-hover:border-accent/40 dark:group-hover:text-accent',
                        ].join(' ')}
                      >
                        <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                      </span>
                    )}
                  </>
                )}
              </button>
              {/* Eliminar disciplina personalizada (solo expandido y al hacer hover). */}
              {d.custom && onRemoveDiscipline && !collapsed && (
                <button
                  onClick={(e) => { e.stopPropagation(); if (window.confirm(`¿Eliminar la disciplina “${d.name}”? Sus planillas importadas dejarán de mostrarse.`)) onRemoveDiscipline(d.id) }}
                  title="Eliminar disciplina"
                  className={[
                    'absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full opacity-0 transition group-hover/disc:opacity-100',
                    active ? 'text-white/80 hover:bg-white/15 hover:text-white' : 'text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10',
                  ].join(' ')}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )
        })}

        {/* Agregar disciplina nueva */}
        {onAddDiscipline && (
          <button
            onClick={onAddDiscipline}
            title={collapsed ? 'Agregar disciplina' : undefined}
            className={[
              'mt-1 flex w-full items-center gap-3 rounded-lg border border-dashed px-3 py-2.5 text-sm font-medium transition-colors',
              'border-slate-300 text-slate-500 hover:border-brand-400 hover:text-brand-600 dark:border-white/15 dark:text-slate-400 dark:hover:border-accent/40 dark:hover:text-accent',
              collapsed ? 'justify-center' : '',
            ].join(' ')}
          >
            <Plus className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span className="flex-1 truncate text-left">Agregar disciplina</span>}
          </button>
        )}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-7 grid h-6 w-6 place-items-center rounded-full border border-slate-300 bg-white text-slate-500 shadow-md transition hover:text-brand-600 dark:border-white/10 dark:bg-ink-700 dark:text-slate-300 dark:hover:text-accent"
        aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>

      <div className="border-t border-slate-200 px-3 py-3 dark:border-white/5">
        {/* Proyecto activo + cambiar */}
        {onChangeProject && (
          collapsed ? (
            <button
              onClick={onChangeProject}
              title={`Proyecto: ${projectName || ''} — cambiar`}
              className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-brand-300 hover:text-brand-600 dark:border-white/10 dark:text-slate-400 dark:hover:border-accent/40 dark:hover:text-accent"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={onChangeProject}
              title="Cambiar de proyecto"
              className="group mb-2.5 flex w-full items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-2 text-left transition hover:border-brand-300 dark:border-white/10 dark:hover:border-accent/40"
            >
              <FolderKanban className="h-4 w-4 shrink-0 text-brand-500 dark:text-accent" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{projectName}</span>
                <span className="block text-[10px] text-slate-400">Cambiar proyecto</span>
              </span>
              <ArrowLeftRight className="h-3.5 w-3.5 shrink-0 text-slate-400 transition group-hover:text-brand-500 dark:group-hover:text-accent" />
            </button>
          )
        )}
        {!collapsed && (
          <p className="px-1 text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
            AWP · BIM · Control Documental
            <br />
            <span className="text-slate-300 dark:text-slate-600">v0.3 · Gestor de Información de Proyectos</span>
          </p>
        )}
      </div>
    </aside>
  )
}
