import { useEffect, useMemo, useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import Header from './components/Header.jsx'
import DisciplineView from './components/DisciplineView.jsx'
import GridWorkspace from './components/GridWorkspace.jsx'
import { datasets as baseDatasets, disciplines as baseDisciplines } from './data/disciplines.js'
import { useImportedDatasets } from './hooks/useImportedDatasets.js'
import { exportProjectToExcel } from './utils/projectExport.js'

/**
 * Navegación simulada (sin router). El estado vive en App:
 *  - activeDiscipline: disciplina seleccionada en el sidebar.
 *  - openSubs: subcategorías abiertas como pestañas (multi-tab).
 *  - activeSub: pestaña activa; si es null se muestra la Vista A (tarjetas).
 *  - theme: 'light' | 'dark' (persistido).
 *
 * Los datasets importados (hook) se fusionan con los base, y sus subcategorías
 * se inyectan dinámicamente en la disciplina correspondiente.
 */
export default function App() {
  const [collapsed, setCollapsed] = useState(false)
  const [activeDiscipline, setActiveDiscipline] = useState('electrico')
  const [openSubs, setOpenSubs] = useState([])
  const [activeSub, setActiveSub] = useState(null)
  const [theme, setTheme] = useState(() => localStorage.getItem('sqy-theme') || 'light')
  const [notice, setNotice] = useState(null)

  const { datasets: importedDatasets, extraSubs, importFile, removeImported, importing, error } = useImportedDatasets()

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('sqy-theme', theme)
  }, [theme])

  // Datasets y disciplinas fusionados (base + importados).
  const allDatasets = useMemo(() => ({ ...baseDatasets, ...importedDatasets }), [importedDatasets])
  const disciplines = useMemo(
    () =>
      baseDisciplines.map((d) =>
        extraSubs[d.id]?.length ? { ...d, subcategories: [...d.subcategories, ...extraSubs[d.id]] } : d,
      ),
    [extraSubs],
  )

  const discipline = disciplines.find((d) => d.id === activeDiscipline) || disciplines[0]
  const findSub = (subId) => {
    for (const d of disciplines) {
      const s = d.subcategories.find((sc) => sc.id === subId)
      if (s) return { discipline: d, subcategory: s }
    }
    return null
  }

  // Poda pestañas que ya no existen (p. ej. dataset importado eliminado).
  useEffect(() => {
    setOpenSubs((prev) => {
      const valid = prev.filter((id) => findSub(id))
      if (valid.length !== prev.length) {
        if (activeSub && !valid.includes(activeSub)) setActiveSub(valid[valid.length - 1] ?? null)
        return valid
      }
      return prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disciplines])

  const tabs = openSubs
    .map((id) => {
      const info = findSub(id)
      if (!info) return null
      return { ...info, dataset: allDatasets[info.subcategory.dataKey] }
    })
    .filter(Boolean)

  const crumbs = useMemo(() => {
    const list = [{ label: 'Sonqollay' }]
    if (discipline) list.push({ label: discipline.name, onClick: () => setActiveSub(null) })
    if (activeSub) {
      const info = findSub(activeSub)
      if (info) list.push({ label: info.subcategory.name })
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discipline, activeSub, disciplines])

  function selectDiscipline(id) {
    setActiveDiscipline(id)
    setActiveSub(null)
  }
  function openSubcategory(subId) {
    setOpenSubs((prev) => (prev.includes(subId) ? prev : [...prev, subId]))
    setActiveSub(subId)
  }
  function closeTab(subId) {
    setOpenSubs((prev) => {
      const next = prev.filter((id) => id !== subId)
      if (activeSub === subId) setActiveSub(next[next.length - 1] ?? null)
      return next
    })
  }

  async function exportProject() {
    setNotice('Generando Excel del proyecto…')
    try {
      const n = await exportProjectToExcel(allDatasets, disciplines)
      setNotice(n ? `Proyecto exportado · ${n} hoja(s).` : 'No hay subcategorías con datos para exportar.')
    } catch {
      setNotice('No se pudo exportar el proyecto.')
    }
    setTimeout(() => setNotice(null), 4000)
  }

  const showGrid = activeSub && tabs.some((t) => t.subcategory.id === activeSub)

  return (
    <div className="flex h-screen overflow-hidden bg-grid">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        activeDiscipline={discipline?.id}
        onSelect={selectDiscipline}
        onSelectAll={() => selectDiscipline(disciplines[0].id)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          crumbs={crumbs}
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          onExportProject={exportProject}
        />

        <main className="min-h-0 flex-1 overflow-hidden">
          {showGrid ? (
            <GridWorkspace
              tabs={tabs}
              activeSub={activeSub}
              onSwitch={setActiveSub}
              onClose={closeTab}
              onReturn={() => setActiveSub(null)}
            />
          ) : (
            <div className="h-full overflow-y-auto">
              <DisciplineView
                discipline={discipline}
                onOpenSubcategory={openSubcategory}
                onImport={importFile}
                importing={importing}
                importError={error}
                onRemoveImported={removeImported}
              />
            </div>
          )}
        </main>
      </div>

      {notice && (
        <div className="fixed bottom-5 right-5 z-50 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-lg dark:border-white/10 dark:bg-ink-800 dark:text-slate-200">
          {notice}
        </div>
      )}
    </div>
  )
}
