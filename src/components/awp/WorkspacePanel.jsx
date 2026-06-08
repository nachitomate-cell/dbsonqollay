import { useMemo, useState } from 'react'
import { Archive, Boxes, CalendarDays, FileCheck2, FileText, LayoutDashboard, LogOut, Map, MapPin, MessagesSquare, Pencil, Plus, Sigma, TriangleAlert, Trash2, X } from 'lucide-react'
import { genCode } from '../../utils/awpCodes.js'
import { useAwpPlanos } from '../../hooks/useAwpPlanos.js'
import { CWA_COLORS, Donut, Sunburst } from './charts.jsx'
import { printCwaReport, printCwpReport } from '../../utils/awpReports.js'
import WorkspaceCronograma from './WorkspaceCronograma.jsx'
import WorkspaceRestricciones from './WorkspaceRestricciones.jsx'
import WorkspaceRevisiones from './WorkspaceRevisiones.jsx'
import WorkspaceSesiones from './WorkspaceSesiones.jsx'
import WorkspacePlano from './WorkspacePlano.jsx'

/**
 * Workspace AWP del proyecto (modelo de Aura AWP): Dashboard + entidades
 * CWA → CWP → IWP. Overlay a pantalla completa con sub-navegación propia.
 * props: project, cfg (useProjectConfig), entities (useAwpEntities), onClose.
 */
const fmt = (n) => Number(n || 0).toLocaleString('es-CL')

export default function WorkspacePanel({ project, cfg, entities, onClose }) {
  const [section, setSection] = useState('dashboard')
  const [modal, setModal] = useState(null) // { type:'cwa'|'cwp'|'apertura', id?, cwp? }
  const [form, setForm] = useState({})

  const { config } = cfg
  const nom = config.awp.nomenclatura
  const planosApi = useAwpPlanos(project.id)
  const disciplinas = useMemo(() => config.disciplinas.filter((d) => d.activa), [config.disciplinas])
  const discById = (id) => config.disciplinas.find((d) => d.id === id)
  const { cwas, cwps, iwps } = entities

  const cwaHH = (cwaId) => cwps.filter((c) => c.cwaId === cwaId).reduce((s, c) => s + (Number(c.hh) || 0), 0)
  const cwpIwps = (cwpId) => iwps.filter((i) => i.cwpId === cwpId)

  // ---- code helpers ----
  const nextCwaNum = () => cwas.reduce((m, c) => Math.max(m, c.num || 0), 0) + 1
  const nextCwpNum = (cwaId, discId) => cwps.filter((c) => c.cwaId === cwaId && c.disciplinaId === discId).reduce((m, c) => Math.max(m, c.num || 0), 0) + 1

  // ---- actions ----
  function openCwa(cwa) { setForm(cwa ? { ...cwa } : { nombre: '', descripcion: '', hh: '', secuenciaPoC: '', fechaInicio: '', fechaFin: '' }); setModal({ type: 'cwa', id: cwa?.id }) }
  function openCwp(cwp) { setForm(cwp ? { ...cwp } : { cwaId: cwas[0]?.id || '', disciplinaId: disciplinas[0]?.id || '', nombre: '', descripcion: '', hh: '', secuenciaPoC: '', fechaInicio: '', fechaFin: '' }); setModal({ type: 'cwp', id: cwp?.id }) }
  function openApertura(cwp) { const sug = Math.max(1, Math.round((Number(cwp.hh) || 0) / (config.awp.hhObjetivoIwp || 750)) || 1); setForm({ n: sug }); setModal({ type: 'apertura', cwp }) }

  function saveCwa() {
    const nombre = (form.nombre || '').trim(); if (!nombre) return
    if (modal.id) { entities.updateCwa(modal.id, { nombre, descripcion: form.descripcion, hh: Number(form.hh) || 0, secuenciaPoC: form.secuenciaPoC, fechaInicio: form.fechaInicio, fechaFin: form.fechaFin }) }
    else { const num = nextCwaNum(); entities.addCwa({ num, codigo: genCode(nom, 'cwa', { corr: num }), nombre, descripcion: form.descripcion, hh: Number(form.hh) || 0, secuenciaPoC: form.secuenciaPoC, fechaInicio: form.fechaInicio, fechaFin: form.fechaFin }) }
    setModal(null)
  }
  function saveCwp() {
    const nombre = (form.nombre || '').trim(); if (!nombre || !form.cwaId || !form.disciplinaId) return
    if (modal.id) { entities.updateCwp(modal.id, { nombre, descripcion: form.descripcion, hh: Number(form.hh) || 0, secuenciaPoC: form.secuenciaPoC, fechaInicio: form.fechaInicio, fechaFin: form.fechaFin, cwaId: form.cwaId, disciplinaId: form.disciplinaId }) }
    else {
      const cwa = cwas.find((c) => c.id === form.cwaId); const disc = discById(form.disciplinaId)
      const num = nextCwpNum(form.cwaId, form.disciplinaId)
      entities.addCwp({ num, codigo: genCode(nom, 'cwp', { cwaNum: cwa?.num, disc: disc?.prefijo, corr: num }), cwaId: form.cwaId, disciplinaId: form.disciplinaId, nombre, descripcion: form.descripcion, hh: Number(form.hh) || 0, secuenciaPoC: form.secuenciaPoC, fechaInicio: form.fechaInicio, fechaFin: form.fechaFin })
    }
    setModal(null)
  }
  function doApertura() {
    const cwp = modal.cwp; const n = Math.max(1, Math.min(500, Number(form.n) || 1))
    const cwa = cwas.find((c) => c.id === cwp.cwaId); const disc = discById(cwp.disciplinaId)
    const hhEach = Math.round((Number(cwp.hh) || 0) / n)
    const out = Array.from({ length: n }, (_, i) => ({
      id: `${cwp.id}-iwp-${i + 1}`, cwpId: cwp.id, num: i + 1,
      codigo: genCode(nom, 'iwp', { cwaNum: cwa?.num, disc: disc?.prefijo, cwpNum: cwp.num, corr: i + 1 }),
      nombre: `${cwp.nombre} - ${String(i + 1).padStart(3, '0')}`, hh: hhEach, estado: 'Borrador',
    }))
    entities.setIwpsForCwp(cwp.id, out)
    setModal(null)
  }

  const totalHH = cwas.reduce((s, c) => s + (Number(c.hh) || 0), 0)
  const asignadaHH = cwps.reduce((s, c) => s + (Number(c.hh) || 0), 0)
  const estimadas = Number(config.hhEstimadas) || totalHH
  const pctAsign = estimadas ? Math.round((asignadaHH / estimadas) * 100) : 0

  // Validación de límites de HH (parámetros AWP del proyecto).
  const hhMaxCwa = Number(config.awp.hhMaxCwa) || 0
  const hhMaxCwp = Number(config.awp.hhMaxCwp) || 0
  const cwaOver = (c) => hhMaxCwa > 0 && Math.max(Number(c.hh) || 0, cwaHH(c.id)) > hhMaxCwa
  const cwpOver = (c) => hhMaxCwp > 0 && (Number(c.hh) || 0) > hhMaxCwp
  const cwasOver = cwas.filter(cwaOver)
  const cwpsOver = cwps.filter(cwpOver)
  const donutData = cwas.map((c, i) => ({ label: c.codigo, value: Number(c.hh) || cwaHH(c.id) || 1, color: CWA_COLORS[i % CWA_COLORS.length] }))

  const NAV = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, count: null },
    { id: 'cwas', label: 'CWAs', icon: Map, count: cwas.length },
    { id: 'cwps', label: 'CWPs', icon: Archive, count: cwps.length },
    { id: 'iwps', label: 'IWPs', icon: Boxes, count: iwps.length },
    { id: 'plano', label: 'Plot Plan', icon: MapPin, count: planosApi.planos.length || null },
    { id: 'cronograma', label: 'Cronograma', icon: CalendarDays, count: null },
    { id: 'restricciones', label: 'Restricciones', icon: TriangleAlert, count: entities.restricciones?.length || 0 },
    { id: 'sesiones', label: 'Sesiones IPS', icon: MessagesSquare, count: entities.sesiones?.length || 0 },
    { id: 'revisiones', label: 'Revisiones', icon: FileCheck2, count: entities.revisiones?.length || 0 },
  ]

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-slate-50 dark:bg-ink-900">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-5 py-2.5 dark:border-white/10 dark:bg-ink-800">
        <span className="rounded-md bg-brand-100 px-2 py-1 font-mono text-xs font-bold text-brand-700 dark:bg-accent/15 dark:text-accent">{config.codigo || project?.code || 'PROYECTO'}</span>
        <span className="truncate text-sm font-bold text-slate-800 dark:text-white">{config.nombre || project?.name}</span>
        <span className="text-xs text-slate-400">· Workspace AWP</span>
        <button onClick={onClose} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:text-slate-900 dark:border-white/10 dark:text-slate-300 dark:hover:text-white"><LogOut className="h-4 w-4" /> Salir</button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Sub-nav */}
        <nav className="w-52 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-2 dark:border-white/10 dark:bg-ink-800/60">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => setSection(n.id)} className={['flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition', section === n.id ? 'bg-brand-50 text-brand-700 dark:bg-accent/10 dark:text-accent' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5'].join(' ')}>
              <n.icon className="h-4 w-4" /> <span className="flex-1">{n.label}</span>
              {n.count != null && <span className="rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-500 dark:bg-white/10 dark:text-slate-400">{n.count}</span>}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1100px] px-6 py-5">
            {section === 'dashboard' && (
              <>
                <h1 className="mb-1 text-xl font-extrabold text-slate-800 dark:text-white">Dashboard del Workspace</h1>
                <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">Visión general de la estructura AWP del proyecto.</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat icon={Map} label="CWAs" value={cwas.length} />
                  <Stat icon={Archive} label="CWPs" value={cwps.length} />
                  <Stat icon={Boxes} label="IWPs" value={iwps.length} />
                  <Stat icon={Sigma} label="HH asignadas" value={fmt(asignadaHH)} sub={estimadas ? `${pctAsign}% de ${fmt(estimadas)}` : null} />
                </div>
                <div className="mt-4">
                  <div className="mb-1.5 flex justify-between text-[11px] font-medium text-slate-400"><span>Asignación de HH (CWPs vs estimadas del proyecto)</span><span className="tabular-nums">{pctAsign}%</span></div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-500" style={{ width: `${Math.min(100, pctAsign)}%` }} /></div>
                </div>
                {(cwasOver.length > 0 || cwpsOver.length > 0) && (
                  <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-semibold">Límites de HH superados</p>
                      {cwasOver.length > 0 && <p>{cwasOver.length} CWA(s) superan el máximo de {fmt(hhMaxCwa)} HH: {cwasOver.map((c) => c.codigo).join(', ')}.</p>}
                      {cwpsOver.length > 0 && <p>{cwpsOver.length} CWP(s) superan el máximo de {fmt(hhMaxCwp)} HH: {cwpsOver.map((c) => c.codigo).join(', ')}.</p>}
                    </div>
                  </div>
                )}
                {cwas.length > 0 ? (
                  <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <Card title="Jerarquía CWA / CWP / IWP">
                      <div className="flex items-center gap-4">
                        <div className="h-52 w-52 shrink-0">
                          <Sunburst cwas={cwas} cwps={cwps} iwps={iwps} discById={discById} weightCwa={(c) => Number(c.hh) || cwaHH(c.id)} weightCwp={(c) => Number(c.hh) || 0} weightIwp={(i) => Number(i.hh) || 0} />
                        </div>
                        <div className="min-w-0 flex-1 text-xs">
                          <p className="mb-1 text-slate-400">Anillos: CWA · CWP · IWP</p>
                          <div className="flex gap-3 font-semibold text-slate-600 dark:text-slate-300"><span>{cwas.length} CWAs</span><span>{cwps.length} CWPs</span><span>{iwps.length} IWPs</span></div>
                          <p className="mt-2 text-slate-400">Color del CWP/IWP = disciplina.</p>
                        </div>
                      </div>
                    </Card>
                    <Card title="Distribución de esfuerzo (HH por CWA)">
                      <div className="flex items-center gap-4">
                        <div className="h-44 w-44 shrink-0"><Donut data={donutData} /></div>
                        <div className="min-w-0 flex-1 space-y-1 overflow-y-auto text-xs" style={{ maxHeight: '11rem' }}>
                          {cwas.map((c, i) => { const hh = Number(c.hh) || cwaHH(c.id); return (
                            <div key={c.id} className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: CWA_COLORS[i % CWA_COLORS.length] }} />
                              <span className="min-w-0 flex-1 truncate font-mono text-slate-600 dark:text-slate-300">{c.codigo}</span>
                              <span className="shrink-0 tabular-nums text-slate-400">{fmt(hh)} HH</span>
                            </div>
                          ) })}
                        </div>
                      </div>
                    </Card>
                  </div>
                ) : <Empty msg="Aún no hay CWAs. Crea la primera área de trabajo en la sección CWAs." />}
              </>
            )}

            {section === 'cwas' && (
              <>
                <Head title="Áreas de Trabajo (CWA)" sub={`${cwas.length} CWA${cwas.length === 1 ? '' : 's'} · ${fmt(totalHH)} HH`} onNew={() => openCwa(null)} newLabel="Nueva CWA" />
                {cwas.length === 0 ? <Empty msg="Crea la primera Construction Work Area." /> : (
                  <Table cols={['Código', 'Nombre', 'HH', 'CWPs', 'Estado', '']}>
                    {cwas.map((c) => (
                      <tr key={c.id} className="border-t border-slate-100 dark:border-white/5">
                        <Td><span className="font-mono font-bold text-brand-700 dark:text-accent">{c.codigo}</span></Td>
                        <Td><span className="font-medium text-slate-800 dark:text-white">{c.nombre}</span></Td>
                        <Td><HhCell value={c.hh} over={cwaOver(c)} /></Td>
                        <Td><span className="tabular-nums text-slate-500">{cwps.filter((p) => p.cwaId === c.id).length}</span></Td>
                        <Td><Badge>{c.estado}</Badge></Td>
                        <Td><RowActions onReport={() => printCwaReport({ cwa: c, cwps, iwps, discById, project, config })} onEdit={() => openCwa(c)} onDelete={() => { if (confirm(`¿Eliminar ${c.codigo} y sus CWPs/IWPs?`)) entities.removeCwa(c.id) }} /></Td>
                      </tr>
                    ))}
                  </Table>
                )}
              </>
            )}

            {section === 'cwps' && (
              <>
                <Head title="Construction Work Packages (CWP)" sub={`${cwps.length} CWP${cwps.length === 1 ? '' : 's'}`} onNew={() => openCwp(null)} newLabel="Nuevo CWP" disabled={cwas.length === 0} />
                {cwas.length === 0 ? <Empty msg="Primero crea al menos una CWA." /> : cwps.length === 0 ? <Empty msg="Crea el primer CWP." /> : (
                  <Table cols={['Código', 'Nombre', 'CWA', 'Disc.', 'HH', 'IWPs', '']}>
                    {cwps.map((c) => { const d = discById(c.disciplinaId); const cwa = cwas.find((x) => x.id === c.cwaId); const nIwp = cwpIwps(c.id).length; return (
                      <tr key={c.id} className="border-t border-slate-100 dark:border-white/5">
                        <Td><span className="font-mono font-bold text-brand-700 dark:text-accent">{c.codigo}</span></Td>
                        <Td><span className="font-medium text-slate-800 dark:text-white">{c.nombre}</span></Td>
                        <Td><span className="font-mono text-xs text-slate-500">{cwa?.codigo || '—'}</span></Td>
                        <Td>{d ? <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} /><span className="text-xs">{d.prefijo}</span></span> : '—'}</Td>
                        <Td><HhCell value={c.hh} over={cwpOver(c)} /></Td>
                        <Td>{nIwp > 0 ? <button onClick={() => { if (confirm(`¿Revertir la apertura de ${c.codigo}? Se eliminan sus ${nIwp} IWPs.`)) entities.clearIwpsForCwp(c.id) }} className="rounded bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-accent/15 dark:text-accent" title="Revertir apertura">{nIwp} IWPs</button> : <button onClick={() => openApertura(c)} className="rounded border border-brand-300 px-2 py-0.5 text-[11px] font-semibold text-brand-700 transition hover:bg-brand-50 dark:border-accent/40 dark:text-accent" title="Abrir en IWPs">Abrir</button>}</Td>
                        <Td><RowActions onReport={() => printCwpReport({ cwp: c, cwa, disc: d, iwps, project, config })} onEdit={() => openCwp(c)} onDelete={() => { if (confirm(`¿Eliminar ${c.codigo} y sus IWPs?`)) entities.removeCwp(c.id) }} /></Td>
                      </tr>
                    ) })}
                  </Table>
                )}
              </>
            )}

            {section === 'iwps' && (
              <>
                <Head title="Installation Work Packages (IWP)" sub={`${iwps.length} IWP${iwps.length === 1 ? '' : 's'} en ${new Set(iwps.map((i) => i.cwpId)).size} CWPs`} />
                {iwps.length === 0 ? <Empty msg="Los IWPs se generan al 'Abrir' un CWP (sección CWPs)." /> : (
                  <Table cols={['Código', 'Nombre', 'CWP', 'HH', 'Estado']}>
                    {iwps.map((i) => { const cwp = cwps.find((c) => c.id === i.cwpId); return (
                      <tr key={i.id} className="border-t border-slate-100 dark:border-white/5">
                        <Td><span className="font-mono font-bold text-brand-700 dark:text-accent">{i.codigo}</span></Td>
                        <Td><span className="text-slate-700 dark:text-slate-200">{i.nombre}</span></Td>
                        <Td><span className="font-mono text-xs text-slate-500">{cwp?.codigo || '—'}</span></Td>
                        <Td><span className="tabular-nums">{fmt(i.hh)}</span></Td>
                        <Td><Badge>{i.estado}</Badge></Td>
                      </tr>
                    ) })}
                  </Table>
                )}
              </>
            )}

            {section === 'cronograma' && (
              <>
                <h1 className="mb-1 text-xl font-extrabold text-slate-800 dark:text-white">Cronograma de CWAs / CWPs</h1>
                <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Línea de tiempo de áreas y paquetes según sus fechas planificadas.</p>
                <WorkspaceCronograma cwas={cwas} cwps={cwps} config={config} discById={discById} />
              </>
            )}

            {section === 'restricciones' && (
              <WorkspaceRestricciones restricciones={entities.restricciones || []} cwas={cwas} cwps={cwps} addRestriccion={entities.addRestriccion} updateRestriccion={entities.updateRestriccion} removeRestriccion={entities.removeRestriccion} />
            )}

            {section === 'plano' && <WorkspacePlano planosApi={planosApi} cwas={cwas} />}

            {section === 'sesiones' && (
              <WorkspaceSesiones sesiones={entities.sesiones || []} addSesion={entities.addSesion} updateSesion={entities.updateSesion} removeSesion={entities.removeSesion} project={project} config={config} />
            )}

            {section === 'revisiones' && (
              <WorkspaceRevisiones revisiones={entities.revisiones || []} addRevision={entities.addRevision} updateRevision={entities.updateRevision} removeRevision={entities.removeRevision} />
            )}
          </div>
        </div>
      </div>

      {/* Modales */}
      {modal?.type === 'cwa' && (
        <Modal title={modal.id ? `Editar ${form.codigo || 'CWA'}` : 'Nueva CWA'} onClose={() => setModal(null)} onSave={saveCwa}>
          <FF label="Nombre"><In value={form.nombre} onChange={(v) => setForm((f) => ({ ...f, nombre: v }))} /></FF>
          <FF label="Descripción"><Ta value={form.descripcion} onChange={(v) => setForm((f) => ({ ...f, descripcion: v }))} /></FF>
          <Row2>
            <FF label="HH estimadas"><In value={form.hh} onChange={(v) => setForm((f) => ({ ...f, hh: v }))} /></FF>
            <FF label="Secuencia (PoC)"><In value={form.secuenciaPoC} onChange={(v) => setForm((f) => ({ ...f, secuenciaPoC: v }))} /></FF>
          </Row2>
          <Row2>
            <FF label="Inicio"><In type="date" value={form.fechaInicio} onChange={(v) => setForm((f) => ({ ...f, fechaInicio: v }))} /></FF>
            <FF label="Fin"><In type="date" value={form.fechaFin} onChange={(v) => setForm((f) => ({ ...f, fechaFin: v }))} /></FF>
          </Row2>
        </Modal>
      )}
      {modal?.type === 'cwp' && (
        <Modal title={modal.id ? `Editar ${form.codigo || 'CWP'}` : 'Nuevo CWP'} onClose={() => setModal(null)} onSave={saveCwp}>
          <Row2>
            <FF label="CWA"><Sel value={form.cwaId} onChange={(v) => setForm((f) => ({ ...f, cwaId: v }))} options={cwas.map((c) => ({ value: c.id, label: `${c.codigo} · ${c.nombre}` }))} /></FF>
            <FF label="Disciplina"><Sel value={form.disciplinaId} onChange={(v) => setForm((f) => ({ ...f, disciplinaId: v }))} options={disciplinas.map((d) => ({ value: d.id, label: `${d.prefijo} · ${d.nombre}` }))} /></FF>
          </Row2>
          <FF label="Nombre"><In value={form.nombre} onChange={(v) => setForm((f) => ({ ...f, nombre: v }))} /></FF>
          <FF label="Descripción (puede incluir cubicaciones)"><Ta value={form.descripcion} onChange={(v) => setForm((f) => ({ ...f, descripcion: v }))} /></FF>
          <Row2>
            <FF label="HH estimadas"><In value={form.hh} onChange={(v) => setForm((f) => ({ ...f, hh: v }))} /></FF>
            <FF label="Secuencia (PoC)"><In value={form.secuenciaPoC} onChange={(v) => setForm((f) => ({ ...f, secuenciaPoC: v }))} /></FF>
          </Row2>
        </Modal>
      )}
      {modal?.type === 'apertura' && (
        <Modal title={`Abrir ${modal.cwp.codigo} en IWPs`} onClose={() => setModal(null)} onSave={doApertura} saveLabel="Abrir">
          <p className="text-sm text-slate-500 dark:text-slate-400">Se generarán N IWPs repartiendo las {fmt(modal.cwp.hh)} HH del CWP en partes iguales. Es reversible.</p>
          <FF label="Cantidad de IWPs"><In value={form.n} onChange={(v) => setForm((f) => ({ ...f, n: v }))} /></FF>
          <p className="text-xs text-slate-400">≈ {fmt(Math.round((Number(modal.cwp.hh) || 0) / Math.max(1, Number(form.n) || 1)))} HH por IWP (objetivo del proyecto: {fmt(config.awp.hhObjetivoIwp)} HH).</p>
        </Modal>
      )}
    </div>
  )
}

// ---- UI helpers ----
function Stat({ icon: I, label, value, sub }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-ink-800/60">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-600 dark:bg-accent/10 dark:text-accent"><I className="h-4 w-4" /></div>
      <div className="min-w-0"><p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p><p className="text-xl font-bold tabular-nums text-slate-800 dark:text-white">{value}{sub && <span className="ml-1 text-xs font-medium text-slate-400">{sub}</span>}</p></div>
    </div>
  )
}
function Head({ title, sub, onNew, newLabel, disabled }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div><h1 className="text-xl font-extrabold text-slate-800 dark:text-white">{title}</h1><p className="text-sm text-slate-500 dark:text-slate-400">{sub}</p></div>
      {onNew && <button onClick={onNew} disabled={disabled} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50 dark:bg-accent dark:text-ink-900"><Plus className="h-4 w-4" /> {newLabel}</button>}
    </div>
  )
}
const Table = ({ cols, children }) => (
  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-ink-800/60">
    <table className="w-full text-sm">
      <thead><tr className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:bg-white/5">{cols.map((c, i) => <th key={i} className="px-3 py-2">{c}</th>)}</tr></thead>
      <tbody>{children}</tbody>
    </table>
  </div>
)
const Td = ({ children }) => <td className="px-3 py-2">{children}</td>
const Badge = ({ children }) => <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">{children}</span>
const RowActions = ({ onEdit, onDelete, onReport }) => (
  <div className="flex items-center gap-1">
    {onReport && <button onClick={onReport} title="Generar PDF" className="grid h-7 w-7 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-white/5"><FileText className="h-3.5 w-3.5" /></button>}
    <button onClick={onEdit} title="Editar" className="grid h-7 w-7 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-white/5"><Pencil className="h-3.5 w-3.5" /></button>
    <button onClick={onDelete} title="Eliminar" className="grid h-7 w-7 place-items-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
  </div>
)
const Card = ({ title, children }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-ink-800/60">
    <h3 className="mb-3 text-sm font-bold text-slate-600 dark:text-slate-300">{title}</h3>
    {children}
  </div>
)
const HhCell = ({ value, over }) => (
  <span className={['inline-flex items-center gap-1 tabular-nums', over ? 'font-semibold text-amber-600 dark:text-amber-400' : ''].join(' ')}>
    {over && <TriangleAlert className="h-3.5 w-3.5" />}{Number(value || 0).toLocaleString('es-CL')}
  </span>
)
const Empty = ({ msg }) => (
  <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500 dark:border-white/15 dark:bg-ink-800/40 dark:text-slate-400">{msg}</div>
)
function Modal({ title, children, onClose, onSave, saveLabel = 'Guardar' }) {
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-ink-800" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><h3 className="text-base font-bold text-slate-800 dark:text-white">{title}</h3><button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button></div>
        <div className="space-y-3">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 dark:border-white/10 dark:text-slate-300">Cancelar</button>
          <button onClick={onSave} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 dark:bg-accent dark:text-ink-900">{saveLabel}</button>
        </div>
      </div>
    </div>
  )
}
const Row2 = ({ children }) => <div className="grid grid-cols-2 gap-3">{children}</div>
const FF = ({ label, children }) => <label className="block"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>{children}</label>
const inCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-400 focus:outline-none dark:border-white/10 dark:bg-ink-900 dark:text-slate-100'
const In = ({ value, onChange, type = 'text' }) => <input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={inCls} />
const Ta = ({ value, onChange }) => <textarea rows={2} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={inCls} />
const Sel = ({ value, onChange, options }) => <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={inCls}><option value="">—</option>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
