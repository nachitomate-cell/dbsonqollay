import { disciplines as staticDisciplines } from '../data/disciplines.js'

/**
 * Calcula métricas de un proyecto para mostrar en el selector, leyendo lo mismo
 * que usa App: disciplinas base (estáticas, salvo proyecto `empty`) +
 * personalizadas e importaciones scopeadas por `project.id` en localStorage.
 *
 * Devuelve { disciplines, elements }.
 */
function lsGet(key, fallback) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback } catch { return fallback }
}

export function computeProjectStats(project) {
  const base = project.empty ? [] : staticDisciplines
  const custom = lsGet(`sqy-custom-disciplines-v1-${project.id}`, [])
  const imports = lsGet(`sqy-imports-v1-${project.id}`, { datasets: {}, subs: {} })

  const all = [...base, ...custom]
  let elements = 0
  const discWith = new Set()
  for (const d of all) {
    const extra = imports.subs?.[d.id] || []
    const subs = [...(d.subcategories || []), ...extra]
    for (const s of subs) {
      const c = s.count ?? (s.dataKey && imports.datasets?.[s.dataKey]?.count) ?? 0
      elements += c
    }
    if (subs.length) discWith.add(d.id)
  }
  return { disciplines: discWith.size, elements }
}
