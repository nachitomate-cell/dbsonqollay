import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Database, Sprout, X } from 'lucide-react'
import Icon from './Icon.jsx'
import { TIPOS_PROYECTO, TIPOS_CONTRATO, FASES, SECTORES, MONEDAS } from '../data/awpCatalogs.js'

/**
 * Wizard para crear un proyecto (adaptado del de Aura AWP, con la paleta y los
 * contornos propios). Recoge la metadata que se muestra en la tarjeta del
 * selector. props: onCreate(data), onClose().
 */
const STEPS = ['Básico', 'Clasificación', 'Ubicación', 'Detalles', 'Resumen']
const PAISES = [
  { code: 'CL', name: 'Chile' }, { code: 'PE', name: 'Perú' }, { code: 'AR', name: 'Argentina' },
  { code: 'BO', name: 'Bolivia' }, { code: 'CO', name: 'Colombia' }, { code: 'EC', name: 'Ecuador' },
  { code: 'MX', name: 'México' }, { code: 'BR', name: 'Brasil' }, { code: 'US', name: 'Estados Unidos' },
]
const ICONS = ['Building2', 'Boxes', 'Layers', 'Mountain', 'Pickaxe', 'Factory', 'Zap', 'Droplet', 'Server', 'Route', 'Anchor', 'Cog']

const EMPTY_FORM = {
  code: '', name: '', cliente: '', division: '', contratista: '', description: '',
  tipo: '', contrato: '', sector: '', fase: '',
  pais: 'Chile', paisCode: 'CL', region: '', ciudad: '',
  fechaInicio: '', fechaFin: '', moneda: 'USD', presupuesto: '', hh: '', miembros: '',
  icon: 'Building2', empty: false,
}

export default function NewProjectWizard({ onCreate, onClose }) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(EMPTY_FORM)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const canNext = step !== 0 || form.name.trim().length > 0

  function finish() {
    if (!form.name.trim()) { setStep(0); return }
    const num = (v) => (v === '' || v == null ? undefined : Number(v))
    const t = (v) => (v && v.trim ? v.trim() || undefined : v || undefined)
    onCreate({
      code: t(form.code) && form.code.trim().toUpperCase(), name: form.name.trim(),
      cliente: t(form.cliente), division: t(form.division), contratista: t(form.contratista), description: t(form.description),
      tipo: form.tipo || undefined, contrato: form.contrato || undefined, sector: form.sector || undefined, fase: form.fase || undefined,
      pais: form.pais || undefined, paisCode: form.paisCode || undefined, region: t(form.region), ciudad: t(form.ciudad),
      fechaInicio: form.fechaInicio || undefined, fechaFin: form.fechaFin || undefined,
      moneda: form.moneda || undefined, presupuesto: num(form.presupuesto), hh: num(form.hh), miembros: num(form.miembros),
      icon: form.icon, empty: form.empty,
    })
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-slate-50 dark:bg-ink-900">
      {/* Header + stepper */}
      <div className="border-b border-slate-200 bg-white px-5 py-3 dark:border-white/10 dark:bg-ink-800">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-base font-bold text-slate-800 dark:text-white">Nuevo proyecto</h1>
            <p className="text-xs text-slate-400">Configura un nuevo proyecto en tu organización.</p>
          </div>
          <button onClick={onClose} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:text-slate-900 dark:border-white/10 dark:text-slate-300 dark:hover:text-white"><X className="h-4 w-4" /> Cerrar</button>
        </div>
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto">
          {STEPS.map((s, i) => (
            <div key={s} className="flex shrink-0 items-center gap-1.5">
              <button onClick={() => i <= step && setStep(i)} disabled={i > step} className={['flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition', i === step ? 'bg-brand-500 text-white dark:bg-accent dark:text-ink-900' : i < step ? 'text-brand-600 dark:text-accent' : 'text-slate-400'].join(' ')}>
                <span className={['grid h-5 w-5 place-items-center rounded-full text-[10px]', i === step ? 'bg-white/25' : i < step ? 'bg-brand-100 dark:bg-accent/20' : 'bg-slate-200 dark:bg-white/10'].join(' ')}>{i < step ? <Check className="h-3 w-3" /> : i + 1}</span>
                {s}
              </button>
              {i < STEPS.length - 1 && <span className="h-px w-4 bg-slate-200 dark:bg-white/10" />}
            </div>
          ))}
        </div>
      </div>

      {/* Contenido */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-6 py-6">
          {step === 0 && (
            <Card title="Información básica" desc="Datos principales del proyecto.">
              <Row2>
                <Field label="Código del proyecto"><In value={form.code} onChange={(v) => set('code', v.toUpperCase())} placeholder="SQY-2025-01" /></Field>
                <Field label="Nombre del proyecto *"><In value={form.name} onChange={(v) => set('name', v)} placeholder="Planta de Servicios Auxiliares" /></Field>
              </Row2>
              <Row2>
                <Field label="Cliente"><In value={form.cliente} onChange={(v) => set('cliente', v)} placeholder="Minera del Norte S.A." /></Field>
                <Field label="División del cliente"><In value={form.division} onChange={(v) => set('division', v)} placeholder="División Cobre Norte" /></Field>
              </Row2>
              <Field label="Contratista principal"><In value={form.contratista} onChange={(v) => set('contratista', v)} placeholder="Empresa de Ingeniería SQY" /></Field>
              <Field label="Descripción"><Ta value={form.description} onChange={(v) => set('description', v)} /></Field>
            </Card>
          )}

          {step === 1 && (
            <Card title="Clasificación" desc="Tipo y características del proyecto.">
              <Field label="Tipo de proyecto">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {TIPOS_PROYECTO.map((t) => (
                    <button key={t.id} onClick={() => set('tipo', t.nombre)} className={['flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center text-xs font-medium transition', form.tipo === t.nombre ? 'border-brand-400 bg-brand-50 text-brand-700 dark:border-accent/50 dark:bg-accent/10 dark:text-accent' : 'border-slate-200 text-slate-600 hover:border-brand-300 dark:border-white/10 dark:text-slate-300'].join(' ')}>
                      <Icon name={t.icon} className="h-5 w-5" /> {t.nombre}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Tipo de contrato">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {TIPOS_CONTRATO.map((t) => (
                    <button key={t.id} onClick={() => set('contrato', t.id)} className={['rounded-xl border p-3 text-left transition', form.contrato === t.id ? 'border-brand-400 bg-brand-50 dark:border-accent/50 dark:bg-accent/10' : 'border-slate-200 hover:border-brand-300 dark:border-white/10'].join(' ')}>
                      <span className="block text-sm font-bold text-slate-800 dark:text-white">{t.nombre}</span>
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400">{t.desc}</span>
                    </button>
                  ))}
                </div>
              </Field>
              <Row2>
                <Field label="Sector industrial"><Sel value={form.sector} onChange={(v) => set('sector', v)} options={SECTORES.map((s) => ({ value: s, label: s }))} /></Field>
                <Field label="Fase del proyecto"><Sel value={form.fase} onChange={(v) => set('fase', v)} options={FASES.map((f) => ({ value: f.id, label: f.nombre }))} /></Field>
              </Row2>
            </Card>
          )}

          {step === 2 && (
            <Card title="Ubicación" desc="Dónde se emplaza el proyecto.">
              <Field label="País"><Sel value={form.paisCode} onChange={(v) => { const p = PAISES.find((x) => x.code === v); set('paisCode', v); set('pais', p?.name || '') }} options={PAISES.map((p) => ({ value: p.code, label: p.name }))} /></Field>
              <Row2>
                <Field label="Región / Estado"><In value={form.region} onChange={(v) => set('region', v)} placeholder="Antofagasta" /></Field>
                <Field label="Ciudad"><In value={form.ciudad} onChange={(v) => set('ciudad', v)} placeholder="Calama" /></Field>
              </Row2>
            </Card>
          )}

          {step === 3 && (
            <Card title="Detalles" desc="Fechas, presupuesto, equipo y cómo arranca.">
              <Row2>
                <Field label="Inicio planificado"><In type="date" value={form.fechaInicio} onChange={(v) => set('fechaInicio', v)} /></Field>
                <Field label="Fin planificado"><In type="date" value={form.fechaFin} onChange={(v) => set('fechaFin', v)} /></Field>
              </Row2>
              <Row2>
                <Field label="Moneda"><Sel value={form.moneda} onChange={(v) => set('moneda', v)} options={MONEDAS.map((m) => ({ value: m, label: m }))} /></Field>
                <Field label="Presupuesto total"><In value={form.presupuesto} onChange={(v) => set('presupuesto', v)} placeholder="500000" /></Field>
              </Row2>
              <Row2>
                <Field label="HH estimadas"><In value={form.hh} onChange={(v) => set('hh', v)} placeholder="258850" /></Field>
                <Field label="Miembros del equipo"><In value={form.miembros} onChange={(v) => set('miembros', v)} placeholder="7" /></Field>
              </Row2>
              <Field label="Icono">
                <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
                  {ICONS.map((nm) => (
                    <button key={nm} onClick={() => set('icon', nm)} className={['grid h-9 place-items-center rounded-lg border transition', form.icon === nm ? 'border-brand-400 bg-brand-50 text-brand-600 dark:border-accent/50 dark:bg-accent/10 dark:text-accent' : 'border-slate-200 text-slate-500 hover:border-brand-300 dark:border-white/10 dark:text-slate-400'].join(' ')}><Icon name={nm} className="h-4 w-4" /></button>
                  ))}
                </div>
              </Field>
              <Field label="¿Cómo arranca?">
                <div className="grid grid-cols-2 gap-2">
                  <Start active={!form.empty} icon={Database} title="Con disciplinas base" desc="Trae las disciplinas de la plataforma." onClick={() => set('empty', false)} />
                  <Start active={form.empty} icon={Sprout} title="Vacío" desc="Sin disciplinas; empiezas de cero." onClick={() => set('empty', true)} />
                </div>
              </Field>
            </Card>
          )}

          {step === 4 && (
            <Card title="Resumen" desc="Revisa antes de crear el proyecto.">
              <Sum label="Código" v={form.code} />
              <Sum label="Nombre" v={form.name} />
              <Sum label="Cliente" v={[form.cliente, form.division].filter(Boolean).join(' / ')} />
              <Sum label="Contratista" v={form.contratista} />
              <Sum label="Tipo" v={form.tipo} />
              <Sum label="Contrato" v={form.contrato} />
              <Sum label="Sector / Fase" v={[form.sector, form.fase].filter(Boolean).join(' · ')} />
              <Sum label="Ubicación" v={[form.ciudad, form.region, form.pais].filter(Boolean).join(', ')} />
              <Sum label="Fechas" v={[form.fechaInicio, form.fechaFin].filter(Boolean).join(' → ')} />
              <Sum label="Presupuesto / HH" v={[form.presupuesto && `${form.moneda} ${Number(form.presupuesto).toLocaleString('es-CL')}`, form.hh && `${Number(form.hh).toLocaleString('es-CL')} HH`].filter(Boolean).join(' · ')} />
              <Sum label="Equipo" v={form.miembros && `${form.miembros} miembros`} />
              <Sum label="Arranque" v={form.empty ? 'Vacío' : 'Con disciplinas base'} />
            </Card>
          )}
        </div>
      </div>

      {/* Navegación */}
      <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-white px-5 py-3 dark:border-white/10 dark:bg-ink-800">
        <button onClick={() => (step === 0 ? onClose() : setStep(step - 1))} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:text-slate-900 dark:border-white/10 dark:text-slate-300">
          <ArrowLeft className="h-4 w-4" /> {step === 0 ? 'Cancelar' : 'Anterior'}
        </button>
        {step < STEPS.length - 1 ? (
          <button onClick={() => canNext && setStep(step + 1)} disabled={!canNext} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50 dark:bg-accent dark:text-ink-900">
            Siguiente <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button onClick={finish} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 dark:bg-accent dark:text-ink-900">
            <Check className="h-4 w-4" /> Crear proyecto
          </button>
        )}
      </div>
    </div>
  )
}

// ---- helpers ----
function Card({ title, desc, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-ink-800/60">
      <h2 className="text-base font-bold text-slate-800 dark:text-white">{title}</h2>
      {desc && <p className="mb-4 mt-0.5 text-sm text-slate-500 dark:text-slate-400">{desc}</p>}
      <div className="space-y-3">{children}</div>
    </div>
  )
}
const Row2 = ({ children }) => <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
const Field = ({ label, children }) => <label className="block"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>{children}</label>
const inCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-400 focus:outline-none dark:border-white/10 dark:bg-ink-900 dark:text-slate-100'
const In = ({ value, onChange, type = 'text', placeholder }) => <input type={type} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={inCls} />
const Ta = ({ value, onChange }) => <textarea rows={3} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={inCls} />
const Sel = ({ value, onChange, options }) => <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={inCls}><option value="">— Seleccionar —</option>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
const Sum = ({ label, v }) => <div className="flex items-start gap-3 border-b border-slate-100 py-1.5 text-sm last:border-0 dark:border-white/5"><span className="w-36 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span><span className="text-slate-700 dark:text-slate-200">{v || <span className="text-slate-300 dark:text-slate-600">—</span>}</span></div>
function Start({ active, icon: IconCmp, title, desc, onClick }) {
  return (
    <button onClick={onClick} className={['flex flex-col gap-1 rounded-xl border-2 p-3 text-left transition', active ? 'border-brand-400 bg-brand-50/60 dark:border-accent/50 dark:bg-accent/10' : 'border-slate-200 hover:border-slate-300 dark:border-white/10'].join(' ')}>
      <IconCmp className={`h-4 w-4 ${active ? 'text-brand-600 dark:text-accent' : 'text-slate-400'}`} />
      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</span>
      <span className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">{desc}</span>
    </button>
  )
}
