import { useMemo, useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import Header from './components/Header.jsx'
import DisciplineView from './components/DisciplineView.jsx'
import DataTable from './components/DataTable.jsx'
import { datasets, disciplines, getDiscipline, findSubcategory } from './data/disciplines.js'

/**
 * Navegación simulada (sin router): el estado vive en App.
 *  - activeDiscipline: disciplina seleccionada en el sidebar (Vista A).
 *  - activeSub: subcategoría abierta (Vista B / Data Grid). Si es null, se
 *    muestra la grilla de tarjetas de la disciplina.
 *
 * Flujo:
 *  Sidebar (disciplina) → DisciplineView (tarjetas) → DataTable (grilla).
 */
export default function App() {
  const [collapsed, setCollapsed] = useState(false)
  const [activeDiscipline, setActiveDiscipline] = useState(disciplines[3].id) // "Eléctrico" por defecto
  const [activeSub, setActiveSub] = useState(null)

  const discipline = getDiscipline(activeDiscipline)
  const subInfo = activeSub ? findSubcategory(activeSub) : null

  const crumbs = useMemo(() => {
    const list = [{ label: 'Sonqollay' }]
    if (discipline)
      list.push({
        label: discipline.name,
        onClick: () => setActiveSub(null),
      })
    if (subInfo) list.push({ label: subInfo.subcategory.name })
    return list
  }, [discipline, subInfo])

  function selectDiscipline(id) {
    setActiveDiscipline(id)
    setActiveSub(null)
  }

  const activeDataset = subInfo ? datasets[subInfo.subcategory.dataKey] : null

  return (
    <div className="flex h-screen overflow-hidden bg-grid">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        activeDiscipline={activeDiscipline}
        onSelect={selectDiscipline}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header crumbs={crumbs} />

        <main className="min-h-0 flex-1 overflow-hidden">
          {subInfo && activeDataset ? (
            <DataTable
              dataset={activeDataset}
              discipline={subInfo.discipline}
              subcategory={subInfo.subcategory}
              onBack={() => setActiveSub(null)}
            />
          ) : (
            <div className="h-full overflow-y-auto">
              <DisciplineView discipline={discipline} onOpenSubcategory={setActiveSub} />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
