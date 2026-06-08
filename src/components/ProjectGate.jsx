import { useState } from 'react'
import App from '../App.jsx'
import ProjectSelector from './ProjectSelector.jsx'
import NewProjectWizard from './NewProjectWizard.jsx'
import { useProjects } from '../hooks/useProjects.js'

/**
 * Puerta de proyecto (entre el login y la app). Siempre arranca en el selector
 * ("bienvenido de nuevo"), destacando el último proyecto abierto. Al elegir uno,
 * muestra un breve estado de carga y monta <App> scopeada a ese proyecto.
 *
 * <App> se monta con `key={project.id}` para que, al cambiar de proyecto, sus
 * hooks (disciplinas, importaciones, planillas) re-inicialicen con el
 * almacenamiento del proyecto correcto, sin mezclar estado.
 */
// Proyecto activo de la SESIÓN actual (sessionStorage): sobrevive a una recarga
// dentro de la misma pestaña (p. ej. cuando el service worker se actualiza y
// recarga la página) pero NO entre pestañas/sesiones nuevas, donde se vuelve a
// mostrar el selector "bienvenido de nuevo".
const skey = (orgId) => `sqy-active-project-session${orgId ? `-${orgId}` : ''}`

export default function ProjectGate({ org, onChangeOrg }) {
  const SKEY = skey(org?.id)
  const { projects, opened, lastOpenedId, addProject, removeProject, markOpened } = useProjects(org?.id)
  // Restaura el proyecto activo de la sesión (evita que una recarga del SW te
  // devuelva al selector). Si no hay, arranca en el selector.
  const [active, setActive] = useState(() => {
    try { const id = sessionStorage.getItem(SKEY); return id ? (projects.find((p) => p.id === id) || null) : null } catch { return null }
  })
  const [entering, setEntering] = useState(null) // proyecto que se está abriendo (spinner)
  const [showNew, setShowNew] = useState(false)

  // Abre un proyecto con un breve respiro: el proyecto "con datos" dispara el
  // fetch de /api/disciplines, así que el spinner evita el salto en frío.
  function open(p) {
    if (entering) return
    setEntering(p)
    window.setTimeout(() => {
      markOpened(p.id)
      try { sessionStorage.setItem(SKEY, p.id) } catch { /* ignore */ }
      setActive(p); setEntering(null)
    }, 500)
  }
  function change() {
    try { sessionStorage.removeItem(SKEY) } catch { /* ignore */ }
    setActive(null)
  }
  function createAndOpen(data) {
    const p = addProject(data)
    setShowNew(false)
    if (p) open(p)
  }

  if (active) return <App key={active.id} project={active} onChangeProject={change} org={org} onChangeOrg={onChangeOrg} />

  return (
    <>
      <ProjectSelector
        projects={projects}
        opened={opened}
        lastOpenedId={lastOpenedId}
        busyId={entering?.id || null}
        org={org}
        onChangeOrg={onChangeOrg}
        onSelect={open}
        onNew={() => setShowNew(true)}
        onRemove={removeProject}
      />
      {showNew && <NewProjectWizard onCreate={createAndOpen} onClose={() => setShowNew(false)} />}
    </>
  )
}
