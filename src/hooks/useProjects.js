import { useCallback, useEffect, useState } from 'react'
import { DEMO_PROJECTS } from '../data/projects.js'

/**
 * Proyectos del usuario: los dos demo fijos + los que cree (localStorage), más
 * el registro de "última apertura" por proyecto (para destacar "Continuar" y
 * mostrar "abierto hace X"). El estado editable de cada proyecto ya se scopea por
 * `project.id` en sus propios hooks.
 *
 * Retorna { projects, opened, lastOpenedId, addProject, removeProject, markOpened }
 */
const lsProjects = (orgId) => `sqy-projects-v1${orgId ? `-${orgId}` : ''}`
const lsOpened = (orgId) => `sqy-projects-opened${orgId ? `-${orgId}` : ''}`

function load(key, fb) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fb } catch { return fb }
}

export function useProjects(orgId) {
  const KEY = lsProjects(orgId)
  const KEY_OPENED = lsOpened(orgId)
  const [custom, setCustom] = useState(() => load(KEY, []))
  const [opened, setOpened] = useState(() => load(KEY_OPENED, {}))

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(custom)) } catch { /* cuota */ } }, [KEY, custom])
  useEffect(() => { try { localStorage.setItem(KEY_OPENED, JSON.stringify(opened)) } catch { /* cuota */ } }, [KEY_OPENED, opened])

  const projects = [...DEMO_PROJECTS, ...custom]

  // Acepta toda la metadata del wizard (code, cliente, division, contratista,
  // tipo, contrato, sector, fase, pais, region, ciudad, fechas, moneda,
  // presupuesto, hh, miembros, icon, empty, description…). Solo `name` es obligatorio.
  const addProject = useCallback((data = {}) => {
    const name = String(data.name || '').trim()
    if (!name) return null
    const p = {
      icon: 'Building2',
      estado: 'Activo',
      description: data.empty
        ? 'Proyecto en blanco. Agrega disciplinas e importa tus planillas para empezar.'
        : 'Proyecto con las disciplinas base de la plataforma listas para cargar datos.',
      ...data,
      id: `proj-${Date.now()}`,
      name,
      empty: !!data.empty,
      custom: true,
      createdAt: Date.now(),
    }
    setCustom((prev) => [...prev, p])
    return p
  }, [])

  const removeProject = useCallback((id) => {
    setCustom((prev) => prev.filter((p) => p.id !== id))
    setOpened((prev) => { const n = { ...prev }; delete n[id]; return n })
  }, [])

  const markOpened = useCallback((id) => {
    setOpened((prev) => ({ ...prev, [id]: Date.now() }))
  }, [])

  const lastOpenedId = Object.keys(opened).sort((a, b) => (opened[b] || 0) - (opened[a] || 0))[0] || null

  return { projects, opened, lastOpenedId, addProject, removeProject, markOpened }
}
