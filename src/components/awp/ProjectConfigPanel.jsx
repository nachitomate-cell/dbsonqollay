import { useState } from 'react'
import { Boxes, Building2, Calendar, DollarSign, Layers, MapPin, Settings2, Tag, X } from 'lucide-react'
import Icon from '../Icon.jsx'
import { TIPOS_PROYECTO, TIPOS_CONTRATO, FASES, SECTORES, MONEDAS } from '../../data/awpCatalogs.js'
import { previewCodes } from '../../utils/awpCodes.js'

/**
 * Configuración AWP del proyecto (modelo de Aura AWP), como overlay con pestañas.
 * props: project, cfg (de useProjectConfig), onClose.
 */
const TABS = [
  { id: 'identificacion', label: 'Identificación', icon: Tag },
  { id: 'clasificacion', label: 'Clasificación', icon: Layers },
  { id: 'ubicacion', label: 'Ubicación', icon: MapPin },
  { id: 'fechas', label: 'Fechas', icon: Calendar },
  { id: 'presupuesto', label: 'Presupuesto', icon: DollarSign },
  { id: 'disciplinas', label: 'Disciplinas', icon: Boxes },
  { id: 'awp', label: 'Configuración AWP', icon: Settings2 },
]

export default function ProjectConfigPanel({ project, cfg, onClose }) {
  const [tab, setTab] = useState('identificacion')
  const { config, setField, setDisciplina, applyPreset } = cfg

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-slate-50 dark:bg-ink-900">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-5 py-3 dark:border-white/10 dark:bg-ink-800">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 text-white"><Settings2 className="h-5 w-5" /></div>
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold text-slate-800 dark:text-white">Configuración del proyecto</h1>
          <p className="truncate text-xs text-slate-400">{config.codigo ? `${config.codigo} · ` : ''}{config.nombre || project?.name}</p>
        </div>
        <button onClick={onClose} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:text-slate-900 dark:border-white/10 dark:text-slate-300 dark:hover:text-white">
          <X className="h-4 w-4" /> Cerrar
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Tabs */}
        <nav className="w-56 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-2 dark:border-white/10 dark:bg-ink-800/60">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={['flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition', tab === t.id ? 'bg-brand-50 text-brand-700 dark:bg-accent/10 dark:text-accent' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5'].join(' ')}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-6 py-6">
            {tab === 'identificacion' && (
              <Section title="Identificación del proyecto">
                <Grid2>
                  <Field label="Código"><Input value={config.codigo} onChange={(v) => setField('codigo', v.toUpperCase())} placeholder="SQY-2025-01" /></Field>
                  <Field label="Nombre"><Input value={config.nombre} onChange={(v) => setField('nombre', v)} /></Field>
                </Grid2>
                <Field label="Descripción"><Textarea value={config.descripcion} onChange={(v) => setField('descripcion', v)} /></Field>
                <Grid2>
                  <Field label="Cliente"><Input value={config.cliente} onChange={(v) => setField('cliente', v)} placeholder="Minera del Norte S.A." /></Field>
                  <Field label="División del cliente"><Input value={config.divisionCliente} onChange={(v) => setField('divisionCliente', v)} placeholder="División Cobre Norte" /></Field>
                </Grid2>
                <Field label="Contratista"><Input value={config.contratista} onChange={(v) => setField('contratista', v)} /></Field>
              </Section>
            )}

            {tab === 'clasificacion' && (
              <Section title="Clasificación del proyecto">
                <Field label="Tipo de proyecto">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {TIPOS_PROYECTO.map((t) => (
                      <button key={t.id} onClick={() => setField('tipoProyecto', t.id)} className={['flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center text-xs font-medium transition', config.tipoProyecto === t.id ? 'border-brand-400 bg-brand-50 text-brand-700 dark:border-accent/50 dark:bg-accent/10 dark:text-accent' : 'border-slate-200 text-slate-600 hover:border-brand-300 dark:border-white/10 dark:text-slate-300'].join(' ')}>
                        <Icon name={t.icon} className="h-5 w-5" /> {t.nombre}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Tipo de contrato">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {TIPOS_CONTRATO.map((t) => (
                      <button key={t.id} onClick={() => setField('tipoContrato', t.id)} className={['rounded-xl border p-3 text-left transition', config.tipoContrato === t.id ? 'border-brand-400 bg-brand-50 dark:border-accent/50 dark:bg-accent/10' : 'border-slate-200 hover:border-brand-300 dark:border-white/10'].join(' ')}>
                        <span className="block text-sm font-bold text-slate-800 dark:text-white">{t.nombre}</span>
                        <span className="block text-[11px] text-slate-500 dark:text-slate-400">{t.desc}</span>
                      </button>
                    ))}
                  </div>
                </Field>
                <Grid2>
                  <Field label="Sector industrial"><Select value={config.sector} onChange={(v) => setField('sector', v)} options={SECTORES.map((s) => ({ value: s, label: s }))} /></Field>
                  <Field label="Fase del proyecto"><Select value={config.fase} onChange={(v) => setField('fase', v)} options={FASES.map((f) => ({ value: f.id, label: f.nombre }))} /></Field>
                </Grid2>
              </Section>
            )}

            {tab === 'ubicacion' && (
              <Section title="Ubicación del proyecto">
                <Grid2>
                  <Field label="País"><Input value={config.pais} onChange={(v) => setField('pais', v)} /></Field>
                  <Field label="Región"><Input value={config.region} onChange={(v) => setField('region', v)} /></Field>
                </Grid2>
                <Grid2>
                  <Field label="Ciudad"><Input value={config.ciudad} onChange={(v) => setField('ciudad', v)} /></Field>
                  <Field label="Dirección"><Input value={config.direccion} onChange={(v) => setField('direccion', v)} /></Field>
                </Grid2>
                <Field label="Sistema de coordenadas">
                  <div className="flex gap-1 rounded-lg border border-slate-200 p-0.5 dark:border-white/10 w-fit">
                    {['UTM', 'WGS84'].map((s) => (
                      <button key={s} onClick={() => setField('coordSistema', s)} className={['rounded-md px-3 py-1 text-xs font-semibold transition', config.coordSistema === s ? 'bg-brand-500 text-white dark:bg-accent dark:text-ink-900' : 'text-slate-500'].join(' ')}>{s}</button>
                    ))}
                  </div>
                </Field>
                <Grid2>
                  <Field label="Zona UTM"><Input value={config.utmZona} onChange={(v) => setField('utmZona', v)} placeholder="19" /></Field>
                  <Field label="Hemisferio"><Select value={config.hemisferio} onChange={(v) => setField('hemisferio', v)} options={[{ value: 'S', label: 'Sur (S)' }, { value: 'N', label: 'Norte (N)' }]} /></Field>
                </Grid2>
                <Grid2>
                  <Field label="Easting (m)"><Input value={config.easting} onChange={(v) => setField('easting', v)} /></Field>
                  <Field label="Northing (m)"><Input value={config.northing} onChange={(v) => setField('northing', v)} /></Field>
                </Grid2>
                <Grid2>
                  <Field label="Altitud (m.s.n.m.)"><Input value={config.altitud} onChange={(v) => setField('altitud', v)} /></Field>
                  <Field label="Zona sísmica"><Input value={config.zonaSismica} onChange={(v) => setField('zonaSismica', v)} placeholder="3" /></Field>
                </Grid2>
              </Section>
            )}

            {tab === 'fechas' && (
              <Section title="Fechas de construcción">
                <Grid2>
                  <Field label="Inicio planificado"><Input type="date" value={config.fechaInicio} onChange={(v) => setField('fechaInicio', v)} /></Field>
                  <Field label="Fin planificado"><Input type="date" value={config.fechaFin} onChange={(v) => setField('fechaFin', v)} /></Field>
                </Grid2>
                <Field label="Entrega a operaciones"><Input type="date" value={config.fechaEntregaOperaciones} onChange={(v) => setField('fechaEntregaOperaciones', v)} /></Field>
              </Section>
            )}

            {tab === 'presupuesto' && (
              <Section title="Presupuesto y recursos">
                <Grid2>
                  <Field label="Moneda"><Select value={config.moneda} onChange={(v) => setField('moneda', v)} options={MONEDAS.map((m) => ({ value: m, label: m }))} /></Field>
                  <Field label="Presupuesto total"><Input value={config.presupuesto} onChange={(v) => setField('presupuesto', v)} placeholder="500000" /></Field>
                </Grid2>
                <Field label="Horas-Hombre estimadas (HH)"><Input value={config.hhEstimadas} onChange={(v) => setField('hhEstimadas', v)} placeholder="258850" /></Field>
              </Section>
            )}

            {tab === 'disciplinas' && (
              <Section title="Disciplinas de ingeniería" desc="Cada disciplina tiene un prefijo de código y un color para identificarla en los CWP e IWP.">
                <div className="space-y-1.5">
                  {config.disciplinas.map((d) => (
                    <div key={d.id} className={['flex items-center gap-3 rounded-xl border px-3 py-2.5 transition', d.activa ? 'border-slate-200 bg-white dark:border-white/10 dark:bg-ink-800/60' : 'border-dashed border-slate-200 opacity-60 dark:border-white/10'].join(' ')}>
                      <button onClick={() => setDisciplina(d.id, { activa: !d.activa })} className={['relative h-5 w-9 shrink-0 rounded-full transition', d.activa ? 'bg-brand-500 dark:bg-accent' : 'bg-slate-300 dark:bg-white/15'].join(' ')}>
                        <span className={['absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all', d.activa ? 'left-[18px]' : 'left-0.5'].join(' ')} />
                      </button>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700 dark:text-slate-200">{d.nombre}</span>
                      <label className="flex items-center gap-1.5 text-[11px] text-slate-400">Prefijo
                        <input value={d.prefijo} onChange={(e) => setDisciplina(d.id, { prefijo: e.target.value.toUpperCase().slice(0, 3) })} className="w-12 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-center font-mono text-xs font-bold text-slate-800 dark:border-white/10 dark:bg-ink-900 dark:text-slate-100" />
                      </label>
                      <label className="flex items-center gap-1.5 text-[11px] text-slate-400">Color
                        <input type="color" value={d.color} onChange={(e) => setDisciplina(d.id, { color: e.target.value })} className="h-7 w-9 cursor-pointer rounded border border-slate-200 bg-white dark:border-white/10" />
                      </label>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {tab === 'awp' && <AwpTab config={config} setField={setField} applyPreset={applyPreset} />}
          </div>
        </div>
      </div>
    </div>
  )
}

function AwpTab({ config, setField, applyPreset }) {
  const disc = config.disciplinas.find((d) => d.activa)?.prefijo || 'M'
  const pv = previewCodes(config.awp.nomenclatura, disc)
  return (
    <>
      <Section title="Parámetros de Horas-Hombre" desc="Valores de control de la metodología AWP (recomendaciones del CII).">
        <div className="mb-3 flex flex-wrap gap-2">
          {[{ id: 'cii', n: 'Estándar CII' }, { id: 'grande', n: 'Proyecto grande' }, { id: 'pequeno', n: 'Proyecto pequeño' }].map((p) => (
            <button key={p.id} onClick={() => applyPreset(p.id)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand-400 hover:text-brand-600 dark:border-white/10 dark:text-slate-300">{p.n}</button>
          ))}
        </div>
        <Grid2>
          <Field label="HH máx por CWA"><Input value={config.awp.hhMaxCwa} onChange={(v) => setField('awp.hhMaxCwa', Number(v) || 0)} /></Field>
          <Field label="HH máx por CWP"><Input value={config.awp.hhMaxCwp} onChange={(v) => setField('awp.hhMaxCwp', Number(v) || 0)} /></Field>
        </Grid2>
        <Grid2>
          <Field label="HH objetivo por IWP"><Input value={config.awp.hhObjetivoIwp} onChange={(v) => setField('awp.hhObjetivoIwp', Number(v) || 0)} /></Field>
          <Field label="Semanas look-ahead restricciones"><Input value={config.awp.semanasLookahead} onChange={(v) => setField('awp.semanasLookahead', Number(v) || 0)} /></Field>
        </Grid2>
      </Section>

      <Section title="Nomenclatura de paquetes" desc="Formato de los códigos de CWA, CWP, EWP, PWP e IWP.">
        {['cwa', 'cwp', 'ewp', 'pwp', 'iwp'].map((lvl) => {
          const n = config.awp.nomenclatura[lvl]
          return (
            <div key={lvl} className="mb-2 rounded-xl border border-slate-200 p-3 dark:border-white/10">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-300">{lvl}</span>
                <span className="font-mono text-xs text-brand-600 dark:text-accent">{pv[lvl]}</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-[11px] text-slate-400">Prefijo
                  <input value={n.prefijo} onChange={(e) => setField(`awp.nomenclatura.${lvl}`, { ...n, prefijo: e.target.value.toUpperCase() })} className="ml-1 w-16 rounded-md border border-slate-200 bg-white px-1.5 py-1 font-mono text-xs dark:border-white/10 dark:bg-ink-900 dark:text-slate-100" />
                </label>
                <label className="text-[11px] text-slate-400">Dígitos
                  <select value={n.digitos} onChange={(e) => setField(`awp.nomenclatura.${lvl}`, { ...n, digitos: Number(e.target.value) })} className="ml-1 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs dark:border-white/10 dark:bg-ink-900 dark:text-slate-100">
                    {[1, 2, 3, 4, 5, 6].map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </label>
                {lvl !== 'cwa' && (
                  <>
                    <Check label="Incluir nº CWA" checked={!!n.incluyeCwa} onChange={(v) => setField(`awp.nomenclatura.${lvl}`, { ...n, incluyeCwa: v })} />
                    <Check label="Incluir disciplina" checked={!!n.incluyeDisc} onChange={(v) => setField(`awp.nomenclatura.${lvl}`, { ...n, incluyeDisc: v })} />
                  </>
                )}
                {lvl === 'iwp' && <Check label="Incluir nº CWP" checked={!!n.incluyeCwp} onChange={(v) => setField(`awp.nomenclatura.${lvl}`, { ...n, incluyeCwp: v })} />}
              </div>
            </div>
          )
        })}
      </Section>
    </>
  )
}

// ---- UI helpers ----
function Section({ title, desc, children }) {
  return (
    <section className="mb-6">
      <h2 className="text-base font-bold text-slate-800 dark:text-white">{title}</h2>
      {desc && <p className="mb-3 mt-0.5 text-sm text-slate-500 dark:text-slate-400">{desc}</p>}
      <div className={desc ? 'space-y-3' : 'mt-3 space-y-3'}>{children}</div>
    </section>
  )
}
const Grid2 = ({ children }) => <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
function Field({ label, children }) {
  return <label className="block"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>{children}</label>
}
const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-400 focus:outline-none dark:border-white/10 dark:bg-ink-900 dark:text-slate-100'
const Input = ({ value, onChange, type = 'text', placeholder }) => <input type={type} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={inputCls} />
const Textarea = ({ value, onChange }) => <textarea rows={3} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={inputCls} />
const Select = ({ value, onChange, options }) => (
  <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={inputCls}>
    <option value="">— Seleccionar —</option>
    {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
)
const Check = ({ label, checked, onChange }) => (
  <label className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-300">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-3.5 w-3.5 accent-brand-500 dark:accent-accent" /> {label}
  </label>
)
