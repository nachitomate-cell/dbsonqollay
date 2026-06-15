import { useEffect, useState } from 'react'
import { Building2, Check, FolderPlus, Loader2, Plus, ShieldCheck, UserPlus, WifiOff, X } from 'lucide-react'
import { authFetch, currentUser, isDemoSession } from '../lib/auth.js'

const api = () => localStorage.getItem('sqy-api-url') || import.meta.env.VITE_APS_API || ''
const ROLES = ['viewer', 'editor', 'approver', 'admin']

async function call(path, opts) {
  const res = await authFetch(`${api()}${path}`, opts)
  const j = res.headers.get('content-type')?.includes('application/json') ? await res.json() : {}
  if (!res.ok) throw new Error(j.error || `Error ${res.status}`)
  return j
}

// Panel de administración multi-tenant: empresas → proyectos + miembros.
// Aditivo: usa /api/orgs, /api/projects, /api/members (requieren login real).
export default function AdminPanel({ open, onClose }) {
  const [orgs, setOrgs] = useState([])
  const [sel, setSel] = useState(null) // org seleccionada
  const [projects, setProjects] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [newOrg, setNewOrg] = useState('')
  const [newProj, setNewProj] = useState('')
  const [invite, setInvite] = useState({ email: '', role: 'editor' })
  // Administrar (empresas/proyectos/miembros) escribe al servidor: necesita internet.
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const demo = isDemoSession() || !currentUser()

  useEffect(() => {
    if (!open || demo) return
    setLoading(true); setErr('')
    call('/api/orgs')
      .then((list) => setOrgs(Array.isArray(list) ? list : []))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false))
  }, [open, demo])

  useEffect(() => {
    if (!sel) { setProjects([]); setMembers([]); return }
    Promise.all([
      call(`/api/projects?org=${sel.id}`).catch(() => []),
      call(`/api/members?org=${sel.id}`).catch(() => []),
    ]).then(([p, m]) => { setProjects(p); setMembers(m) })
  }, [sel])

  async function doCreateOrg() {
    const name = newOrg.trim(); if (!name) return
    try { const o = await call('/api/orgs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }); setOrgs((x) => [...x, o]); setNewOrg(''); setSel(o) }
    catch (e) { setErr(e.message) }
  }
  async function doCreateProject() {
    const name = newProj.trim(); if (!name || !sel) return
    try { const p = await call('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orgId: sel.id, name }) }); setProjects((x) => [...x, p]); setNewProj('') }
    catch (e) { setErr(e.message) }
  }
  async function doBackfill(p) {
    if (!window.confirm(`¿Copiar tus planillas globales actuales al proyecto “${p.name}”?\n(No pisa las que el proyecto ya tenga.)`)) return
    try {
      const r = await call('/api/datasets/backfill', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: p.id }) })
      setErr('')
      window.alert(`Listo: ${r.copied} planilla(s) copiadas al proyecto, ${r.skipped} omitidas.`)
    } catch (e) { setErr(e.message) }
  }
  async function doInvite() {
    const email = invite.email.trim(); if (!email || !sel) return
    try { await call('/api/members', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orgId: sel.id, email, role: invite.role }) }); setInvite({ email: '', role: 'editor' }); const m = await call(`/api/members?org=${sel.id}`); setMembers(m) }
    catch (e) { setErr(e.message) }
  }

  if (!open) return null

  const input = 'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none dark:border-white/10 dark:bg-ink-700 dark:text-slate-200'
  const btn = 'inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-600 dark:bg-accent dark:hover:bg-accent-600'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fadeIn" onClick={onClose} />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-modalIn dark:bg-ink-800">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <ShieldCheck className="h-4 w-4 text-brand-500 dark:text-accent" /> Administración
          </h3>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!online && (
            <p className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
              <WifiOff className="h-4 w-4 shrink-0" /> Sin conexión — la administración (empresas, proyectos y miembros) necesita internet.
            </p>
          )}
          {demo ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
              Inicia sesión con tu cuenta real (no la sesión de prueba) para administrar empresas, proyectos y miembros.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {/* Columna empresas */}
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400"><Building2 className="h-3.5 w-3.5" /> Empresas</p>
                {loading ? (
                  <div className="flex items-center gap-2 py-4 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
                ) : (
                  <div className="space-y-1">
                    {orgs.map((o) => (
                      <button key={o.id} onClick={() => setSel(o)} className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${sel?.id === o.id ? 'border-brand-400 bg-brand-50 text-brand-700 dark:border-accent/50 dark:bg-accent/10 dark:text-accent' : 'border-slate-200 text-slate-700 hover:border-slate-300 dark:border-white/10 dark:text-slate-200'}`}>
                        <span className="truncate font-medium">{o.name}</span>
                        <span className="shrink-0 text-[10px] text-slate-400">{o.role} · {o.projects}p</span>
                      </button>
                    ))}
                    {orgs.length === 0 && <p className="py-2 text-xs text-slate-400">Sin empresas todavía.</p>}
                  </div>
                )}
                <div className="mt-2 flex gap-1.5">
                  <input value={newOrg} onChange={(e) => setNewOrg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doCreateOrg()} placeholder="Nueva empresa" className={input} />
                  <button onClick={doCreateOrg} className={btn}><Plus className="h-4 w-4" /></button>
                </div>
              </div>

              {/* Columna proyectos + miembros de la empresa seleccionada */}
              <div>
                {!sel ? (
                  <p className="py-4 text-xs text-slate-400">Elige una empresa para ver sus proyectos y miembros.</p>
                ) : (
                  <div className="space-y-5">
                    <div>
                      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400"><FolderPlus className="h-3.5 w-3.5" /> Proyectos de {sel.name}</p>
                      <div className="space-y-1">
                        {projects.map((p) => (
                          <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-1.5 text-sm dark:border-white/5">
                            <span className="truncate text-slate-700 dark:text-slate-200">{p.name}</span>
                            <button onClick={() => doBackfill(p)} title="Copiar tus planillas globales actuales a este proyecto" className="shrink-0 text-[10px] font-medium text-brand-600 hover:underline dark:text-accent">Migrar planillas</button>
                          </div>
                        ))}
                        {projects.length === 0 && <p className="text-xs text-slate-400">Sin proyectos.</p>}
                      </div>
                      <div className="mt-2 flex gap-1.5">
                        <input value={newProj} onChange={(e) => setNewProj(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doCreateProject()} placeholder="Nuevo proyecto" className={input} />
                        <button onClick={doCreateProject} className={btn}><Plus className="h-4 w-4" /></button>
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400"><UserPlus className="h-3.5 w-3.5" /> Miembros</p>
                      <div className="space-y-1">
                        {members.map((m) => (
                          <div key={m.user_id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-1.5 text-xs dark:border-white/5">
                            <span className="truncate text-slate-600 dark:text-slate-300" title={m.email}>{m.email}</span>
                            <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-white/10 dark:text-slate-400">{m.role}</span>
                          </div>
                        ))}
                        {members.length === 0 && <p className="text-xs text-slate-400">Sin miembros.</p>}
                      </div>
                      <div className="mt-2 flex gap-1.5">
                        <input value={invite.email} onChange={(e) => setInvite((v) => ({ ...v, email: e.target.value }))} placeholder="email@empresa.cl" className={input} />
                        <select value={invite.role} onChange={(e) => setInvite((v) => ({ ...v, role: e.target.value }))} className="rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs text-slate-600 dark:border-white/10 dark:bg-ink-700 dark:text-slate-300">
                          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <button onClick={doInvite} className={btn}><Check className="h-4 w-4" /></button>
                      </div>
                      <p className="mt-1 text-[10px] text-slate-400">El usuario debe haberse registrado antes (con ese email).</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {err && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400">{err}</p>}
        </div>
      </div>
    </div>
  )
}
