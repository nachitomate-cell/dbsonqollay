import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Box, Check, Database, Layers, ShieldCheck, Sparkles, Upload, X } from 'lucide-react'

/**
 * Tour de bienvenida (paso a paso) que se muestra al entrar a un proyecto en
 * blanco. Enseña el flujo básico de la plataforma. props:
 *  - onClose():  saltar/cerrar (marca visto)
 *  - onFinish(): terminar el tour y empezar (abre "Agregar disciplina")
 */
const STEPS = [
  {
    icon: Sparkles,
    title: 'Bienvenido a tu proyecto',
    body: 'Aquí vas a organizar tu información de ingeniería, vincularla al modelo 3D y controlar su calidad. Te mostramos el flujo en unos pasos rápidos.',
  },
  {
    icon: Layers,
    title: '1 · Crea una disciplina',
    body: 'En el menú izquierdo usa «+ Agregar disciplina» (Eléctrico, Estructura, Cañerías…). Las disciplinas son la forma de organizar tus planillas.',
    tip: 'También puedes eliminarlas pasando el mouse por encima.',
  },
  {
    icon: Upload,
    title: '2 · Carga tus planillas',
    body: 'Dentro de la disciplina, importa un Excel o CSV (por ejemplo los SQY_*), o crea una planilla en blanco con las columnas que necesites.',
  },
  {
    icon: Database,
    title: '3 · Edita con autoguardado',
    body: 'Edita las celdas como en una planilla normal. Cada cambio se guarda solo en la base de datos: verás el indicador «Guardando… / Guardado».',
    tip: 'Puedes forzarlo con «Guardar ahora».',
  },
  {
    icon: Box,
    title: '4 · Vinculá al modelo 3D',
    body: 'Sube un modelo (NWD/RVT/IFC), activa la vista «Dividido» y al hacer clic en una fila se resalta esa pieza en el 3D — y al revés.',
  },
  {
    icon: ShieldCheck,
    title: '5 · Vista global y calidad',
    body: 'En «Todas las disciplinas» tienes una tabla combinada de todo el proyecto y un panel de Calidad que detecta TAGs duplicados o elementos sin TAG.',
  },
]

export default function OnboardingTour({ onClose, onFinish }) {
  const [i, setI] = useState(0)
  const step = STEPS[i]
  const last = i === STEPS.length - 1
  const Icon = step.icon

  const next = () => (last ? onFinish() : setI((n) => n + 1))
  const back = () => setI((n) => Math.max(0, n - 1))

  // Teclado: Esc salta, ←/→ y Enter navegan.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight' || e.key === 'Enter') next()
      else if (e.key === 'ArrowLeft') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i])

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm dark:bg-black/65" onClick={onClose} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-ink-800">
        {/* Cabecera con degradé de marca */}
        <div className="relative flex flex-col items-center bg-gradient-to-br from-brand-500 to-brand-600 px-8 pb-7 pt-9 text-center text-white dark:from-ink-900 dark:to-ink-800">
          <button onClick={onClose} title="Saltar tutorial (Esc)" className="absolute right-3 top-3 rounded-md p-1.5 text-white/70 transition hover:bg-white/15 hover:text-white">
            <X className="h-4 w-4" />
          </button>
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25">
            <Icon className="h-8 w-8" />
          </div>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-white/70">Paso {i + 1} de {STEPS.length}</p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight">{step.title}</h2>
        </div>

        {/* Cuerpo */}
        <div className="px-8 py-6">
          <p className="text-center text-sm leading-relaxed text-slate-600 dark:text-slate-300">{step.body}</p>
          {step.tip && (
            <p className="mx-auto mt-3 w-fit rounded-lg bg-brand-50 px-3 py-1.5 text-center text-xs font-medium text-brand-700 dark:bg-accent/10 dark:text-accent">
              💡 {step.tip}
            </p>
          )}

          {/* Puntos de progreso */}
          <div className="mt-6 flex items-center justify-center gap-1.5">
            {STEPS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setI(idx)}
                aria-label={`Ir al paso ${idx + 1}`}
                className={['h-1.5 rounded-full transition-all', idx === i ? 'w-6 bg-brand-500 dark:bg-accent' : 'w-1.5 bg-slate-300 hover:bg-slate-400 dark:bg-white/15 dark:hover:bg-white/30'].join(' ')}
              />
            ))}
          </div>
        </div>

        {/* Pie con navegación */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 dark:border-white/10">
          <button onClick={onClose} className="text-sm font-medium text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200">
            Saltar
          </button>
          <div className="flex items-center gap-2">
            {i > 0 && (
              <button onClick={back} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">
                <ArrowLeft className="h-4 w-4" /> Atrás
              </button>
            )}
            <button onClick={next} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 dark:bg-accent dark:text-ink-900">
              {last ? <>Empezar <Check className="h-4 w-4" /></> : <>Siguiente <ArrowRight className="h-4 w-4" /></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
