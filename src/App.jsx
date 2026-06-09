import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Sprout } from 'lucide-react'
import PwaPrompt from './components/PwaPrompt.jsx'
import Sidebar from './components/Sidebar.jsx'
import Header from './components/Header.jsx'
import DisciplineView from './components/DisciplineView.jsx'
import AllDisciplinesView from './components/AllDisciplinesView.jsx'
import ProjectHome from './components/ProjectHome.jsx'
import GridWorkspace from './components/GridWorkspace.jsx'
import SettingsPanel from './components/SettingsPanel.jsx'
import AddDisciplineModal from './components/AddDisciplineModal.jsx'
import OnboardingTour from './components/OnboardingTour.jsx'
import ProjectConfigPanel from './components/awp/ProjectConfigPanel.jsx'
import WorkspacePanel from './components/awp/WorkspacePanel.jsx'
import { useProjectConfig } from './hooks/useProjectConfig.js'
import { useAwpEntities } from './hooks/useAwpEntities.js'
import { useAuth } from './components/LoginGate.jsx'
import { datasets as baseDatasets, defaultColumns, emptyDataset } from './data/disciplines.js'
import { useDisciplines } from './hooks/useDisciplines.js'
import { useImportedDatasets } from './hooks/useImportedDatasets.js'
import { useCustomDisciplines } from './hooks/useCustomDisciplines.js'
import { useAwpCwps } from './hooks/useAwpCwps.js'
import { exportProjectToExcel } from './utils/projectExport.js'
import { globalSearch } from './utils/globalSearch.js'

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
export default function App({ project, onChangeProject, org, onChangeOrg }) {
  const { user, isDemo, signOut } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileNav, setMobileNav] = useState(false) // cajón lateral en pantallas chicas
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Navegación interna persistida por proyecto (sessionStorage): si el service
  // worker se actualiza y recarga la página, el usuario vuelve a la misma
  // disciplina/planilla en vez de rebotar al inicio del proyecto.
  const NAVK = `sqy-nav-${project.id}`
  const initNav = () => { try { return JSON.parse(sessionStorage.getItem(NAVK) || 'null') || {} } catch { return {} } }
  const [activeDiscipline, setActiveDiscipline] = useState(() => initNav().activeDiscipline ?? 'electrico')
  const [showAll, setShowAll] = useState(() => initNav().showAll ?? false) // vista "Todas las disciplinas"
  // Home del proyecto (dashboard de entrada). Por defecto al abrir un proyecto nuevo.
  const [showHome, setShowHome] = useState(() => { const n = initNav(); return n.showHome ?? (n.activeSub == null && n.showAll !== true && n.activeDiscipline == null) })
  const [openSubs, setOpenSubs] = useState(() => initNav().openSubs ?? [])
  const [activeSub, setActiveSub] = useState(() => initNav().activeSub ?? null)

  useEffect(() => {
    try { sessionStorage.setItem(NAVK, JSON.stringify({ activeDiscipline, showAll, showHome, openSubs, activeSub })) } catch { /* cuota */ }
  }, [NAVK, activeDiscipline, showAll, showHome, openSubs, activeSub])
  const [theme, setTheme] = useState(() => {
    // Si el usuario ya eligió tema, se respeta; si no, se usa el del sistema.
    const saved = localStorage.getItem('sqy-theme')
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const [notice, setNotice] = useState(null)
  // Subcategorías sin datos para las que el usuario creó una planilla vacía,
  // con las columnas elegidas. Se persiste { subId: columns[] } por proyecto.
  const createdSheetsKey = `sqy-created-sheets-v2-${project.id}`
  const [createdSheets, setCreatedSheets] = useState(() => {
    try { return JSON.parse(localStorage.getItem(createdSheetsKey)) || {} } catch { return {} }
  })
  useEffect(() => {
    localStorage.setItem(createdSheetsKey, JSON.stringify(createdSheets))
  }, [createdSheetsKey, createdSheets])

  const [showAddDiscipline, setShowAddDiscipline] = useState(false)
  // Tour de bienvenida: se muestra al entrar a un proyecto en blanco la primera
  // vez (se recuerda por proyecto). Reabrible desde el estado vacío.
  const tourKey = `sqy-onboarding-${project.id}`
  const [showTour, setShowTour] = useState(() => {
    if (!project.empty) return false
    try { return localStorage.getItem(tourKey) !== '1' } catch { return true }
  })
  function dismissTour(openAdd) {
    try { localStorage.setItem(tourKey, '1') } catch { /* ignore */ }
    setShowTour(false)
    if (openAdd) setShowAddDiscipline(true)
  }

  // Menú de disciplinas: viene de la base de datos (con fallback al estático).
  // Un proyecto vacío arranca SIN disciplinas base (solo las que cree el usuario).
  const { disciplines: dbDisciplines } = useDisciplines()
  const baseDisciplines = project.empty ? [] : dbDisciplines
  // Disciplinas creadas por el usuario (scopeadas al proyecto), fusionadas.
  const { customDisciplines, addDiscipline, removeDiscipline } = useCustomDisciplines(project.id)

  const { datasets: importedDatasets, extraSubs, importFile, removeImported, clearAll: clearImports, importing, error } = useImportedDatasets(project.id)
  // CWPs (AWP) importados del CSV de Aura AWP, por proyecto. Para "Conectar a AWP".
  const { cwps: awpCwps, importCwps, clearCwps } = useAwpCwps(project.id)
  // Configuración AWP del proyecto (modelo de Aura AWP) + overlays.
  const projectCfg = useProjectConfig(project.id, project)
  const awpEntities = useAwpEntities(project.id)
  // OCULTOS por indicación del cliente: solo se quería el acceso inicial
  // org→proyecto, no el clon de Aura AWP (Workspace + Configuración). El código y
  // estos estados se conservan; para reactivar, volver a pasar onOpenWorkspace /
  // onOpenProjectConfig al <Header> (ver más abajo).
  const [showProjectConfig, setShowProjectConfig] = useState(false)
  const [showWorkspace, setShowWorkspace] = useState(false)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('sqy-theme', theme)
  }, [theme])

  // Datasets y disciplinas fusionados (base + personalizadas + importados).
  const allDatasets = useMemo(() => ({ ...baseDatasets, ...importedDatasets }), [importedDatasets])
  const disciplines = useMemo(
    () =>
      [...baseDisciplines, ...customDisciplines].map((d) =>
        extraSubs[d.id]?.length ? { ...d, subcategories: [...d.subcategories, ...extraSubs[d.id]] } : d,
      ),
    [baseDisciplines, customDisciplines, extraSubs],
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
    // Organización (vuelve al selector de org) → proyecto (vuelve al selector de
    // proyecto) → disciplina/planilla.
    const list = []
    if (org) list.push({ label: org.name, onClick: onChangeOrg })
    list.push({ label: project.name, onClick: onChangeProject })
    if (activeSub) {
      // Una planilla abierta: muestra su disciplina real (sirve también cuando se
      // abrió desde "Todas las disciplinas") y su nombre.
      const info = findSub(activeSub)
      const d = info?.discipline || discipline
      if (d) list.push({ label: d.name, onClick: () => setActiveSub(null) })
      if (info) list.push({ label: info.subcategory.name })
    } else if (showHome) {
      list.push({ label: 'Inicio' })
    } else if (showAll) {
      list.push({ label: 'Todas las disciplinas' })
    } else if (discipline) {
      list.push({ label: discipline.name })
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discipline, activeSub, disciplines, showAll, showHome])

  function selectHome() { setShowHome(true); setActiveSub(null); setShowAll(false); setMobileNav(false) }
  function selectDiscipline(id) {
    setActiveDiscipline(id)
    setActiveSub(null)
    setShowAll(false)
    setShowHome(false)
    setMobileNav(false)
  }
  // Crea una disciplina nueva y la deja seleccionada.
  function createDiscipline({ name, icon }) {
    const id = addDiscipline({ name, icon })
    setShowAddDiscipline(false)
    if (id) selectDiscipline(id)
  }
  // Elimina una disciplina personalizada; si estaba activa, deja que se resuelva
  // a la primera disponible (o al estado vacío si el proyecto se queda sin ninguna).
  function deleteDiscipline(id) {
    removeDiscipline(id)
    setActiveDiscipline((cur) => (cur === id ? '' : cur))
    if (activeDiscipline === id) { setActiveSub(null); setShowAll(false) }
  }
  function selectAllDisciplines() {
    setShowAll(true)
    setActiveSub(null)
    setShowHome(false)
    setMobileNav(false)
  }
  function openSubcategory(subId) {
    setOpenSubs((prev) => (prev.includes(subId) ? prev : [...prev, subId]))
    setActiveSub(subId)
    setShowHome(false)
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

  // --- Buscador global (header) -------------------------------------------------
  // Foco para "saltar al elemento": al abrir una planilla desde un resultado, se
  // siembra el buscador interno de la grilla con el TAG (nonce re-dispara aunque
  // sea el mismo texto). El visor/grid lo lee por props.
  const [gridFocus, setGridFocus] = useState(null) // { sub, query, nonce }
  const runGlobalSearch = useCallback(
    (q) => globalSearch(q, { disciplines, datasets: allDatasets, cwps: awpCwps }),
    [disciplines, allDatasets, awpCwps],
  )
  function handleSearchResult(item) {
    if (!item) return
    if (item.type === 'cwp') { selectAllDisciplines(); return } // los CWP viven en "Todas las disciplinas"
    if (!item.subId) return
    openSubcategory(item.subId)
    if (item.type === 'elemento') setGridFocus({ sub: item.subId, query: item.tag, nonce: Date.now() })
  }

  // Localizador de TAG entre TODAS las planillas (para el panel 3D: cuando el TAG
  // del elemento no está en la planilla activa, sugerir en cuál sí está).
  const tagLocator = useMemo(() => {
    const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')
    const idx = new Map()
    for (const d of disciplines) {
      for (const s of d.subcategories || []) {
        const ds = s.dataKey && allDatasets[s.dataKey]
        if (!ds?.rows?.length) continue
        const tagKey = ds.headers?.[0]
        for (const row of ds.rows) {
          const t = norm(row[tagKey])
          if (t && !idx.has(t)) idx.set(t, { subId: s.id, planilla: s.name })
        }
      }
    }
    return idx
  }, [disciplines, allDatasets])
  const findTagAcross = useCallback(
    (tag) => tagLocator.get(String(tag ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')) || null,
    [tagLocator],
  )

  function clearCreatedSheets() {
    setOpenSubs((prev) => prev.filter((id) => !createdSheets[id]))
    setActiveSub((cur) => (createdSheets[cur] ? null : cur))
    setCreatedSheets({})
  }

  function handleClearImports() {
    const importedSubIds = new Set(Object.values(extraSubs).flat().map((s) => s.id))
    setOpenSubs((prev) => {
      const next = prev.filter((id) => !importedSubIds.has(id))
      if (activeSub && importedSubIds.has(activeSub)) setActiveSub(next[next.length - 1] ?? null)
      return next
    })
    clearImports()
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
        disciplines={disciplines}
        activeDiscipline={showAll || showHome ? null : discipline?.id}
        allActive={showAll}
        homeActive={showHome}
        onSelectHome={selectHome}
        onSelect={selectDiscipline}
        onSelectAll={selectAllDisciplines}
        onAddDiscipline={() => setShowAddDiscipline(true)}
        onRemoveDiscipline={deleteDiscipline}
        projectName={project.name}
        onChangeProject={onChangeProject}
        mobileOpen={mobileNav}
        onCloseMobile={() => setMobileNav(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          crumbs={crumbs}
          onOpenMobileNav={() => setMobileNav(true)}
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          onExportProject={exportProject}
          onOpenSettings={() => setSettingsOpen(true)}
          user={user}
          isDemo={isDemo}
          onSignOut={signOut}
          onChangeProject={onChangeProject}
          onChangeOrg={onChangeOrg}
          orgName={org?.name}
          search={runGlobalSearch}
          onSearchResult={handleSearchResult}
        />

        <main className="min-h-0 flex-1 overflow-hidden">
          {showGrid ? (
            <GridWorkspace
              tabs={tabs}
              activeSub={activeSub}
              onSwitch={setActiveSub}
              onClose={closeTab}
              onReturn={() => setActiveSub(null)}
              awp={{ cwps: awpCwps, importCwps, clearCwps }}
              focus={gridFocus}
              findTagAcross={findTagAcross}
              onOpenSubcategory={openSubcategory}
            />
          ) : showHome ? (
            <div className="h-full overflow-y-auto">
              <ProjectHome
                project={project}
                disciplines={disciplines}
                datasets={allDatasets}
                cwps={awpCwps}
                createdSheets={createdSheets}
                onOpenDiscipline={selectDiscipline}
                onOpenAll={selectAllDisciplines}
              />
            </div>
          ) : showAll ? (
            <div className="h-full overflow-y-auto">
              <AllDisciplinesView
                disciplines={disciplines}
                datasets={allDatasets}
                createdSheets={createdSheets}
                onOpenSubcategory={openSubcategory}
                awp={{ cwps: awpCwps, importCwps }}
              />
            </div>
          ) : discipline ? (
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
          ) : (
            // Proyecto sin disciplinas (p. ej. proyecto en blanco): invita a crear.
            <div className="grid h-full place-items-center px-6">
              <div className="max-w-md rounded-2xl border border-dashed border-slate-300 bg-white px-8 py-12 text-center dark:border-white/15 dark:bg-ink-800/50">
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-glow">
                  <Sprout className="h-7 w-7" />
                </div>
                <h2 className="text-base font-bold text-slate-800 dark:text-white">Proyecto sin disciplinas</h2>
                <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  Este proyecto está vacío. Agrega una disciplina para empezar a importar planillas y datos de ingeniería.
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  <button
                    onClick={() => setShowAddDiscipline(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 dark:bg-accent dark:text-ink-900"
                  >
                    <Plus className="h-4 w-4" /> Agregar disciplina
                  </button>
                  <button
                    onClick={() => setShowTour(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:text-brand-600 dark:border-white/10 dark:text-slate-300 dark:hover:text-accent"
                  >
                    Ver tutorial
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {notice && (
        <div className="fixed bottom-5 right-5 z-50 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-lg dark:border-white/10 dark:bg-ink-800 dark:text-slate-200">
          {notice}
        </div>
      )}

      {showAddDiscipline && (
        <AddDisciplineModal onCreate={createDiscipline} onClose={() => setShowAddDiscipline(false)} />
      )}

      {showTour && (
        <OnboardingTour onClose={() => dismissTour(false)} onFinish={() => dismissTour(true)} />
      )}

      {showProjectConfig && (
        <ProjectConfigPanel project={project} cfg={projectCfg} onClose={() => setShowProjectConfig(false)} />
      )}

      {showWorkspace && (
        <WorkspacePanel project={project} cfg={projectCfg} entities={awpEntities} onClose={() => setShowWorkspace(false)} />
      )}

      <PwaPrompt />

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        onClearSheets={clearCreatedSheets}
        onClearImports={handleClearImports}
      />
    </div>
  )
}
