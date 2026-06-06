import { useCallback, useEffect, useState } from 'react'

/**
 * Disciplinas creadas por el usuario (sin tocar la base de datos ni el menú
 * estático). Se persisten en localStorage para sobrevivir recargas y se fusionan
 * con las disciplinas base en App. Cada una arranca SIN subcategorías: se les
 * agregan datos importando un Excel/CSV (useImportedDatasets) bajo su id.
 *
 * Forma: { id, name, icon, description, subcategories: [], custom: true }
 *
 * Retorna { customDisciplines, addDiscipline({name, icon}) -> id, removeDiscipline(id) }
 */
const lsKey = (projectId) => `sqy-custom-disciplines-v1${projectId ? `-${projectId}` : ''}`

function load(key) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : [] } catch { return [] }
}

export function useCustomDisciplines(projectId) {
  const KEY = lsKey(projectId)
  const [customDisciplines, setCustom] = useState(() => load(KEY))

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(customDisciplines)) } catch { /* cuota excedida */ }
  }, [KEY, customDisciplines])

  const addDiscipline = useCallback(({ name, icon } = {}) => {
    const clean = String(name || '').trim()
    if (!clean) return null
    const id = `cus-${Date.now()}`
    const disc = {
      id,
      name: clean,
      icon: icon || 'Layers',
      description: `Disciplina personalizada. Importa un Excel/CSV para agregar datos a ${clean}.`,
      subcategories: [],
      custom: true,
    }
    setCustom((prev) => [...prev, disc])
    return id
  }, [])

  const removeDiscipline = useCallback((id) => {
    setCustom((prev) => prev.filter((d) => d.id !== id))
  }, [])

  return { customDisciplines, addDiscipline, removeDiscipline }
}
