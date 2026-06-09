import { useCallback, useEffect, useState } from 'react'
import { authEnabled, authFetch, isDemoSession } from '../lib/auth.js'

/**
 * Organizaciones (empresas) del usuario. Capa intermedia del flujo
 * autenticar → ORGANIZACIÓN → proyecto.
 *
 * - Sesión REAL (Supabase activo y no demo): lee/crea las empresas reales del
 *   usuario desde la DB (/api/orgs, migración 001).
 * - Sesión de prueba (demo): scaffold local en localStorage (como antes).
 *
 * Retorna { orgs, addOrg({name,icon}) -> Promise<org>|org, removeOrg(id) }.
 */
const LS = 'sqy-orgs-v1'
const apiBase = () => localStorage.getItem('sqy-api-url') || import.meta.env.VITE_APS_API || ''
const useDb = () => authEnabled() && !isDemoSession()

function load() {
  try { const r = localStorage.getItem(LS); return r ? JSON.parse(r) : null } catch { return null }
}
function companyFromUser(user) {
  const dom = user?.email?.split('@')[1]?.split('.')[0]
  return dom ? dom.charAt(0).toUpperCase() + dom.slice(1) : 'Mi empresa'
}
const normalizeDbOrg = (o) => ({ id: o.id, name: o.name, icon: 'Building2', role: o.role, projects: o.projects, description: 'Tu organización.' })

export function useOrgs(user) {
  const db = useDb()
  const [orgs, setOrgs] = useState(() => {
    if (db) return []
    const stored = load()
    if (stored?.length) return stored
    // Semilla: la empresa del usuario (derivada del dominio del email).
    return [{ id: 'org-default', name: companyFromUser(user), description: 'Tu organización.', icon: 'Building2' }]
  })

  // localStorage solo en modo demo (en DB la fuente de verdad es el backend).
  useEffect(() => { if (db) return; try { localStorage.setItem(LS, JSON.stringify(orgs)) } catch { /* cuota */ } }, [db, orgs])

  // DB: trae las empresas reales del usuario.
  useEffect(() => {
    if (!db) return
    let cancel = false
    authFetch(`${apiBase()}/api/orgs`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => { if (!cancel && Array.isArray(list)) setOrgs(list.map(normalizeDbOrg)) })
      .catch(() => { /* sin backend: queda vacío y se puede crear */ })
    return () => { cancel = true }
  }, [db])

  const addOrg = useCallback(async ({ name, icon } = {}) => {
    const clean = String(name || '').trim()
    if (!clean) return null
    if (db) {
      try {
        const res = await authFetch(`${apiBase()}/api/orgs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: clean }) })
        if (!res.ok) return null
        const o = normalizeDbOrg(await res.json())
        setOrgs((prev) => [...prev, o])
        return o
      } catch { return null }
    }
    const o = { id: `org-${Date.now()}`, name: clean, icon: icon || 'Building2', description: 'Organización creada.', custom: true }
    setOrgs((prev) => [...prev, o])
    return o
  }, [db])

  const removeOrg = useCallback((id) => {
    if (db) return // borrar empresas en la DB no está soportado todavía
    setOrgs((prev) => prev.filter((o) => o.id !== id))
    // Limpia las claves scopeadas a esa organización (evita datos huérfanos).
    try {
      localStorage.removeItem(`sqy-projects-v1-${id}`)
      localStorage.removeItem(`sqy-projects-opened-${id}`)
      sessionStorage.removeItem(`sqy-active-project-session-${id}`)
      if (sessionStorage.getItem('sqy-active-org') === id) sessionStorage.removeItem('sqy-active-org')
    } catch { /* ignore */ }
  }, [db])

  return { orgs, addOrg, removeOrg }
}
