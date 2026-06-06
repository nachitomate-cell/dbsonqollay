import { useState } from 'react'
import App from '../App.jsx'
import ProjectSelector from './ProjectSelector.jsx'
import NewProjectModal from './NewProjectModal.jsx'
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
export default function ProjectGate() {
  const { projects, opened, lastOpenedId, addProject, removeProject, markOpened } = useProjects()
  const [active, setActive] = useState(null)
  const [entering, setEntering] = useState(null) // proyecto que se está abriendo (spinner)
  const [showNew, setShowNew] = useState(false)

  // Abre un proyecto con un breve respiro: el proyecto "con datos" dispara el
  // fetch de /api/disciplines, así que el spinner evita el salto en frío.
  function open(p) {
    if (entering) return
    setEntering(p)
    window.setTimeout(() => { markOpened(p.id); setActive(p); setEntering(null) }, 500)
  }
  function change() { setActive(null) }
  function createAndOpen({ name, icon, empty }) {
    const p = addProject({ name, icon, empty })
    setShowNew(false)
    if (p) open(p)
  }

  if (active) return <App key={active.id} project={active} onChangeProject={change} />

  return (
    <>
      <ProjectSelector
        projects={projects}
        opened={opened}
        lastOpenedId={lastOpenedId}
        busyId={entering?.id || null}
        onSelect={open}
        onNew={() => setShowNew(true)}
        onRemove={removeProject}
      />
      {showNew && <NewProjectModal onCreate={createAndOpen} onClose={() => setShowNew(false)} />}
    </>
  )
}
