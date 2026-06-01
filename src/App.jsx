import { useEffect, useMemo, useState } from 'react'
import PwaPrompt from './components/PwaPrompt.jsx'
import Sidebar from './components/Sidebar.jsx'
import Header from './components/Header.jsx'
import DisciplineView from './components/DisciplineView.jsx'
import GridWorkspace from './components/GridWorkspace.jsx'
import { datasets as baseDatasets, disciplines as baseDisciplines, defaultColumns, emptyDataset } from './data/disciplines.js'
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
  // Subcategorías sin datos para las que el usuario creó una planilla vacía,
  // con las columnas elegidas. Se persiste { subId: columns[] } entre recargas.
  const [createdSheets, setCreatedSheets] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sqy-created-sheets-v2')) || {} } catch { return {} }
  })
  useEffect(() => {
    localStorage.setItem('sqy-created-sheets-v2', JSON.stringify(createdSheets))
  }, [createdSheets])

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

  // Plantillas de columnas disponibles al crear una planilla nueva: las columnas
  // por defecto + las de cada subcategoría que ya tiene datos (para copiarlas).
  const columnTemplates = useMemo(() => {
    const out = []
    for (const d of disciplines) {
      for (const s of d.subcategories) {
        const ds = s.dataKey && allDatasets[s.dataKey]
        if (ds?.headers?.length) {
          out.push({ id: s.id, label: `${s.name} · ${d.name}`, columns: ds.headers })
        }
      }
    }
    return out
  }, [disciplines, allDatasets])

  const discipline = disciplines.find((d) => d.id === activeDiscipline) || disciplines[0]
  const findSub = (subId) => {
    for (const d of disciplines) {
      const s = d.subcategories.find((sc) => sc.id === subId)
      if (s) {
        // Si no tiene datos pero el usuario creó la planilla, le damos un
        // dataKey sintético para que opere como una planilla editable vacía.
        if (!s.dataKey && createdSheets[s.id]) {
          return { discipline: d, subcategory: { ...s, dataKey: `new-${s.id}`, created: true, createdColumns: createdSheets[s.id] } }
        }
        return { discipline: d, subcategory: s }
      }
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
      // Planilla nueva (sin datos base): se entrega un dataset vacío con las
      // columnas elegidas; useEditableDataset lo persiste desde ahí.
      const dataset = info.subcategory.created
        ? emptyDataset(info.subcategory.createdColumns)
        : allDatasets[info.subcategory.dataKey]
      return { ...info, dataset }
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
  // Crear una planilla nueva en una subcategoría sin datos (con las columnas
  // elegidas) y abrirla.
  function createSheet(subId, columns) {
    setCreatedSheets((prev) => ({ ...prev, [subId]: columns && columns.length ? columns : undefined }))
    openSubcategory(subId)
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
                createdSheets={createdSheets}
                onCreateSheet={createSheet}
                columnTemplates={columnTemplates}
                defaultColumns={defaultColumns}
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

      <PwaPrompt />
    </div>
  )
}
