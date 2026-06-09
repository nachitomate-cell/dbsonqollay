import { useCallback, useEffect, useState } from 'react'
import { DEMO_PROJECTS } from '../data/projects.js'
import { authEnabled, authFetch, isDemoSession } from '../lib/auth.js'

/**
 * Proyectos de una organización.
 *
 * - Sesión REAL (Supabase activo, no demo): lee/crea los proyectos reales de la
 *   empresa desde la DB (/api/projects?org=, migración 001). No muestra los demo.
 * - Sesión de prueba (demo): los dos demo fijos + los locales (localStorage).
 *
 * Retorna { projects, opened, lastOpenedId, addProject, removeProject, markOpened }.
 */
const lsProjects = (orgId) => `sqy-projects-v1${orgId ? `-${orgId}` : ''}`
const lsOpened = (orgId) => `sqy-projects-opened${orgId ? `-${orgId}` : ''}`
const apiBase = () => localStorage.getItem('sqy-api-url') || import.meta.env.VITE_APS_API || ''
const useDb = () => authEnabled() && !isDemoSession()

function load(key, fb) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fb } catch { return fb }
}
const normalizeDbProject = (p) => ({
  id: p.id, name: p.name, icon: 'Building2', estado: 'Activo', empty: false, custom: true,
  createdAt: p.created_at ? Date.parse(p.created_at) : Date.now(),
  description: 'Proyecto de la empresa. Agrega disciplinas e importa tus planillas.',
})

export function useProjects(orgId) {
  const db = useDb()
  const KEY = lsProjects(orgId)
  const KEY_OPENED = lsOpened(orgId)
  const [custom, setCustom] = useState(() => (db ? [] : load(KEY, [])))
  const [opened, setOpened] = useState(() => load(KEY_OPENED, {}))

  // localStorage de proyectos solo en modo demo (en DB manda el backend).
  useEffect(() => { if (db) return; try { localStorage.setItem(KEY, JSON.stringify(custom)) } catch { /* cuota */ } }, [db, KEY, custom])
  // El registro de "última apertura" se guarda siempre local (es preferencia de UI).
  useEffect(() => { try { localStorage.setItem(KEY_OPENED, JSON.stringify(opened)) } catch { /* cuota */ } }, [KEY_OPENED, opened])

  // DB: trae los proyectos reales de la empresa.
  useEffect(() => {
    if (!db || !orgId) return
    let cancel = false
    authFetch(`${apiBase()}/api/projects?org=${encodeURIComponent(orgId)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => { if (!cancel && Array.isArray(list)) setCustom(list.map(normalizeDbProject)) })
      .catch(() => { /* sin backend: vacío, se puede crear */ })
    return () => { cancel = true }
  }, [db, orgId])

  const projects = db ? custom : [...DEMO_PROJECTS, ...custom]

  const addProject = useCallback(async (data = {}) => {
    const name = String(data.name || '').trim()
    if (!name) return null
    if (db) {
      try {
        const res = await authFetch(`${apiBase()}/api/projects`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orgId, name }) })
        if (!res.ok) return null
        const p = normalizeDbProject(await res.json())
        setCustom((prev) => [...prev, p])
        return p
      } catch { return null }
    }
    const p = {
      icon: 'Building2', estado: 'Activo',
      description: data.empty
        ? 'Proyecto en blanco. Agrega disciplinas e importa tus planillas para empezar.'
        : 'Proyecto con las disciplinas base de la plataforma listas para cargar datos.',
      ...data, id: `proj-${Date.now()}`, name, empty: !!data.empty, custom: true, createdAt: Date.now(),
    }
    setCustom((prev) => [...prev, p])
    return p
  }, [db, orgId])

  const removeProject = useCallback((id) => {
    setCustom((prev) => prev.filter((p) => p.id !== id))
    setOpened((prev) => { const n = { ...prev }; delete n[id]; return n })
    // (En DB el borrado definitivo de proyectos se agregará con su endpoint.)
  }, [])

  const markOpened = useCallback((id) => { setOpened((prev) => ({ ...prev, [id]: Date.now() })) }, [])

  const lastOpenedId = Object.keys(opened).sort((a, b) => (opened[b] || 0) - (opened[a] || 0))[0] || null

  return { projects, opened, lastOpenedId, addProject, removeProject, markOpened }
}
