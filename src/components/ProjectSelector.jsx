import { useMemo } from 'react'
import { ArrowRight, Building2, Database, Layers, Loader2, LogOut, Plus, Sigma, Sprout, Trash2 } from 'lucide-react'
import Icon from './Icon.jsx'
import { useAuth } from './LoginGate.jsx'
import { computeProjectStats } from '../utils/projectStats.js'

/**
 * Pantalla intermedia (post-login): la empresa elige con qué proyecto trabajar,
 * crea proyectos nuevos y ve métricas reales de cada uno.
 *
 * props:
 *  - projects: [{ id, name, description, icon, empty, custom }]
 *  - opened: { [id]: ts } · lastOpenedId · busyId (proyecto que se está abriendo)
 *  - onSelect(project), onNew(), onRemove(id)
 */
function companyName(user) {
  const dom = user?.email?.split('@')[1]?.split('.')[0]
  if (!dom) return 'Mi empresa'
  return dom.charAt(0).toUpperCase() + dom.slice(1)
}

function timeAgo(ts) {
  if (!ts) return null
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'recién'
  const m = Math.floor(s / 60); if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60); if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24); if (d < 30) return `hace ${d} d`
  const mo = Math.floor(d / 30); return `hace ${mo} mes${mo > 1 ? 'es' : ''}`
}

export default function ProjectSelector({ projects = [], opened = {}, lastOpenedId, busyId, onSelect, onNew, onRemove }) {
  const { user, signOut } = useAuth()
  const company = companyName(user)
  const last = lastOpenedId ? projects.find((p) => p.id === lastOpenedId) : null

  return (
    <div className="min-h-screen overflow-y-auto bg-grid px-4 py-8">
      <div className="mx-auto max-w-4xl">
        {/* Barra de cuenta */}
        <div className="mb-5 flex items-center justify-end gap-3">
          {user?.email && <span className="truncate text-xs text-slate-400">{user.email}</span>}
          <button onClick={signOut} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:text-rose-600 dark:border-white/10 dark:bg-ink-800 dark:text-slate-400 dark:hover:text-rose-400">
            <LogOut className="h-3.5 w-3.5" /> Cerrar sesión
          </button>
        </div>

        {/* Empresa (contexto multi-proyecto) */}
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 dark:border-white/10 dark:bg-ink-800/70">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-sm">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Empresa</p>
            <h1 className="truncate text-lg font-extrabold tracking-tight text-slate-800 dark:text-white">{company}</h1>
          </div>
          <span className="ml-auto shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 dark:bg-white/10 dark:text-slate-400">
            {projects.length} proyecto{projects.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Continuar en el último proyecto abierto */}
        {last && (
          <button
            onClick={() => onSelect(last)} disabled={!!busyId}
            className="mb-6 flex w-full items-center gap-3.5 rounded-2xl border-2 border-brand-300 bg-brand-50/50 px-5 py-4 text-left transition hover:bg-brand-50 disabled:opacity-70 dark:border-accent/40 dark:bg-accent/5 dark:hover:bg-accent/10"
          >
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-brand-200 bg-white text-brand-500 dark:border-accent/30 dark:bg-ink-800 dark:text-accent">
              <Icon name={last.icon} className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-600 dark:text-accent">Bienvenido de nuevo · continuar</p>
              <p className="truncate text-base font-bold text-slate-800 dark:text-white">{last.name}</p>
            </div>
            {busyId === last.id ? <Loader2 className="h-5 w-5 shrink-0 animate-spin text-brand-500 dark:text-accent" /> : <ArrowRight className="h-5 w-5 shrink-0 text-brand-500 dark:text-accent" />}
          </button>
        )}

        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Tus proyectos</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              openedAt={opened[p.id]}
              busy={busyId === p.id}
              disabled={!!busyId}
              onSelect={() => onSelect(p)}
              onRemove={p.custom ? () => onRemove(p.id) : null}
            />
          ))}

          {/* Crear proyecto nuevo */}
          <button
            onClick={onNew} disabled={!!busyId}
            className="group flex min-h-[150px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white/50 p-5 text-slate-500 transition hover:border-brand-400 hover:text-brand-600 disabled:opacity-60 dark:border-white/15 dark:bg-ink-800/40 dark:text-slate-400 dark:hover:border-accent/40 dark:hover:text-accent"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl border border-dashed border-current transition group-hover:scale-105"><Plus className="h-5 w-5" /></span>
            <span className="text-sm font-semibold">Nuevo proyecto</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function ProjectCard({ project, openedAt, busy, disabled, onSelect, onRemove }) {
  const stats = useMemo(() => computeProjectStats(project), [project])
  const ago = timeAgo(openedAt)
  const demo = !project.custom

  return (
    <div className="group/card relative">
      <button
        onClick={onSelect} disabled={disabled}
        className="flex h-full w-full flex-col rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md disabled:opacity-70 disabled:hover:translate-y-0 dark:border-white/10 dark:bg-ink-800/70 dark:hover:border-accent/40 dark:hover:shadow-card"
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="grid h-12 w-12 place-items-center rounded-xl border border-brand-200 bg-brand-50 text-brand-500 transition-transform duration-200 group-hover/card:scale-105 dark:border-accent/30 dark:bg-accent/10 dark:text-accent">
            <Icon name={project.icon} className="h-6 w-6" />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {demo && <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white dark:bg-white dark:text-ink-900">Demo</span>}
            <span className={['inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', project.empty ? 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'].join(' ')}>
              {project.empty ? <><Sprout className="h-3 w-3" /> Vacío</> : <><Database className="h-3 w-3" /> Con datos</>}
            </span>
          </div>
        </div>

        <h3 className="text-base font-bold text-slate-800 dark:text-white">{project.name}</h3>
        <p className="mt-1 line-clamp-2 flex-1 text-sm text-slate-500 dark:text-slate-400">{project.description}</p>

        {/* Métricas */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1"><Layers className="h-3.5 w-3.5 text-slate-400" /> {stats.disciplines} disciplina{stats.disciplines === 1 ? '' : 's'}</span>
          <span className="inline-flex items-center gap-1"><Sigma className="h-3.5 w-3.5 text-slate-400" /> {stats.elements.toLocaleString('es-CL')} elemento{stats.elements === 1 ? '' : 's'}</span>
          <span className="text-slate-400">· {ago ? `abierto ${ago}` : 'sin abrir'}</span>
        </div>

        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 dark:text-accent">
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Abriendo…</> : <>Abrir proyecto <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover/card:translate-x-0.5" /></>}
        </span>
      </button>

      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); if (window.confirm(`¿Eliminar el proyecto “${project.name}”? Se borrará su contenido local.`)) onRemove() }}
          title="Eliminar proyecto"
          className="absolute right-3 top-3 z-10 grid h-7 w-7 place-items-center rounded-full text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 group-hover/card:opacity-100 dark:text-slate-600 dark:hover:bg-rose-500/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
