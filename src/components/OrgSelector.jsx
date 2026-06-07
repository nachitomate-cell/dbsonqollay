import { useState } from 'react'
import { ArrowRight, Building2, LogOut, Plus, Trash2, X } from 'lucide-react'
import Icon from './Icon.jsx'
import { useAuth } from './LoginGate.jsx'

/**
 * Pantalla de organización (post-login, pre-proyecto): el usuario elige con qué
 * organización trabajar. props: orgs, onSelect(org), onCreate({name}), onRemove(id)
 */
export default function OrgSelector({ orgs = [], onSelect, onCreate, onRemove }) {
  const { user, signOut } = useAuth()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  function create() {
    const clean = name.trim()
    if (!clean) return
    onCreate?.({ name: clean })
    setName(''); setCreating(false)
  }

  return (
    <div className="min-h-screen overflow-y-auto bg-grid px-4 py-12">
      <div className="mx-auto max-w-3xl">
        {/* Cuenta */}
        <div className="mb-5 flex items-center justify-end gap-3">
          {user?.email && <span className="truncate text-xs text-slate-400">{user.email}</span>}
          <button onClick={signOut} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:text-rose-600 dark:border-white/10 dark:bg-ink-800 dark:text-slate-400 dark:hover:text-rose-400">
            <LogOut className="h-3.5 w-3.5" /> Cerrar sesión
          </button>
        </div>

        <header className="mb-8 flex flex-col items-center text-center">
          <img src="/aura1.png" alt="Aura" className="mb-3 h-14 w-14 object-contain" />
          <h1 className="text-xl font-extrabold tracking-tight text-slate-800 dark:text-white">Elige una organización</h1>
          <p className="mt-1.5 max-w-md text-sm text-slate-500 dark:text-slate-400">
            Selecciona la empresa con la que vas a trabajar. Cada organización tiene sus propios proyectos.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          {orgs.map((o) => (
            <div key={o.id} className="group/org relative">
              <button
                onClick={() => onSelect?.(o)}
                className="flex h-full w-full flex-col rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:border-white/10 dark:bg-ink-800/70 dark:hover:border-accent/40"
              >
                <div className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-sm">
                  <Icon name={o.icon || 'Building2'} className="h-6 w-6" />
                </div>
                <h2 className="text-base font-bold text-slate-800 dark:text-white">{o.name}</h2>
                <p className="mt-1 line-clamp-2 flex-1 text-sm text-slate-500 dark:text-slate-400">{o.description}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 dark:text-accent">
                  Entrar <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover/org:translate-x-0.5" />
                </span>
              </button>
              {o.custom && onRemove && (
                <button
                  onClick={(e) => { e.stopPropagation(); if (window.confirm(`¿Eliminar la organización “${o.name}”?`)) onRemove(o.id) }}
                  title="Eliminar organización"
                  className="absolute right-3 top-3 z-10 grid h-7 w-7 place-items-center rounded-full text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 group-hover/org:opacity-100 dark:text-slate-600 dark:hover:bg-rose-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}

          {/* Nueva organización */}
          {creating ? (
            <div className="flex flex-col justify-center gap-2 rounded-2xl border-2 border-brand-300 bg-white p-5 dark:border-accent/40 dark:bg-ink-800/70">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 shrink-0 text-brand-500 dark:text-accent" />
                <input
                  autoFocus value={name} onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') create(); if (e.key === 'Escape') { setCreating(false); setName('') } }}
                  placeholder="Nombre de la organización…"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-400 focus:outline-none dark:border-white/10 dark:bg-ink-900 dark:text-slate-100"
                />
                <button onClick={() => { setCreating(false); setName('') }} className="shrink-0 text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
              </div>
              <button onClick={create} disabled={!name.trim()} className="rounded-lg bg-brand-500 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50 dark:bg-accent dark:text-ink-900">Crear organización</button>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="group flex min-h-[150px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white/50 p-5 text-slate-500 transition hover:border-brand-400 hover:text-brand-600 dark:border-white/15 dark:bg-ink-800/40 dark:text-slate-400 dark:hover:border-accent/40 dark:hover:text-accent"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-dashed border-current transition group-hover:scale-105"><Plus className="h-5 w-5" /></span>
              <span className="text-sm font-semibold">Nueva organización</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
