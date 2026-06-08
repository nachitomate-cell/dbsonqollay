import { useCallback, useEffect, useState } from 'react'

/**
 * Organizaciones (empresas) del usuario. Capa intermedia del flujo
 * autenticar → ORGANIZACIÓN → proyecto. Por ahora es scaffold local (localStorage);
 * cuando se active Supabase, se reemplaza por las orgs reales del usuario
 * (tabla organizations + memberships) sin cambiar la UI.
 *
 * Retorna { orgs, addOrg({name,icon}) -> org, removeOrg(id) }.
 */
const LS = 'sqy-orgs-v1'

function load() {
  try { const r = localStorage.getItem(LS); return r ? JSON.parse(r) : null } catch { return null }
}
function companyFromUser(user) {
  const dom = user?.email?.split('@')[1]?.split('.')[0]
  return dom ? dom.charAt(0).toUpperCase() + dom.slice(1) : 'Mi empresa'
}

export function useOrgs(user) {
  const [orgs, setOrgs] = useState(() => {
    const stored = load()
    if (stored?.length) return stored
    // Semilla: la empresa del usuario (derivada del dominio del email).
    return [{ id: 'org-default', name: companyFromUser(user), description: 'Tu organización.', icon: 'Building2' }]
  })

  useEffect(() => { try { localStorage.setItem(LS, JSON.stringify(orgs)) } catch { /* cuota */ } }, [orgs])

  const addOrg = useCallback(({ name, icon } = {}) => {
    const clean = String(name || '').trim()
    if (!clean) return null
    const o = { id: `org-${Date.now()}`, name: clean, icon: icon || 'Building2', description: 'Organización creada.', custom: true }
    setOrgs((prev) => [...prev, o])
    return o
  }, [])

  const removeOrg = useCallback((id) => {
    setOrgs((prev) => prev.filter((o) => o.id !== id))
    // Limpia las claves scopeadas a esa organización (evita datos huérfanos).
    try {
      localStorage.removeItem(`sqy-projects-v1-${id}`)
      localStorage.removeItem(`sqy-projects-opened-${id}`)
      sessionStorage.removeItem(`sqy-active-project-session-${id}`)
      if (sessionStorage.getItem('sqy-active-org') === id) sessionStorage.removeItem('sqy-active-org')
    } catch { /* ignore */ }
  }, [])

  return { orgs, addOrg, removeOrg }
}
