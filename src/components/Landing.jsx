import { ArrowRight, Box, Boxes, CloudUpload, Database, FlaskConical, History, Layers, Link2, LogIn, ShieldCheck } from 'lucide-react'

/**
 * Página pública de presentación (antes del login). Explica qué es Aura GIP y
 * ofrece dos accesos: "Probar con datos de prueba" (demo) e "Iniciar sesión".
 *
 * props: onLogin(), onDemo()
 */
const FEATURES = [
  { icon: Boxes, title: 'Planillas por disciplina (AWP)', desc: 'Importa Excel/CSV, edita en grilla y autoguarda en la nube.' },
  { icon: Box, title: 'Visor BIM 3D ligado a los datos', desc: 'Selecciona un elemento y ve/edita su registro de planilla por TAG.' },
  { icon: CloudUpload, title: 'Publicar a la nube desde Navisworks', desc: 'Un clic en el plugin sube el modelo. Mismo nombre = nueva versión.' },
  { icon: ShieldCheck, title: 'Multi-empresa aislado', desc: 'Cada cliente ve solo sus proyectos, planillas y modelos.' },
  { icon: Link2, title: 'Paquetes de trabajo (AWP)', desc: 'Conecta componentes a CWA/CWP y mide la cobertura.' },
  { icon: History, title: 'Auditoría y versiones', desc: 'Quién cambió qué y cuándo, con historial de modelos.' },
]

const STEPS = [
  { n: 1, title: 'Carga tus planillas', desc: 'Importa los datos de ingeniería por disciplina.' },
  { n: 2, title: 'Vincula al modelo 3D', desc: 'El plugin escribe las propiedades en Navisworks por TAG.' },
  { n: 3, title: 'Publica y controla', desc: 'Sube el modelo a la nube y sigue el avance del proyecto.' },
]

export default function Landing({ onLogin, onDemo }) {
  return (
    <div className="min-h-screen bg-grid text-slate-800 dark:bg-ink-900 dark:text-slate-100">
      {/* Barra superior */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200/70 bg-white/80 px-5 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-ink-900/70 sm:px-8">
        <div className="flex items-center gap-2.5">
          <img src="/aura1.png" alt="Aura GIP" className="h-9 w-9 object-contain" />
          <span className="text-lg font-extrabold tracking-tight">Aura <span className="text-brand-600 dark:text-accent">GIP</span></span>
        </div>
        <button onClick={onLogin} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-600 dark:border-white/10 dark:bg-ink-800 dark:text-slate-200 dark:hover:border-accent/40 dark:hover:text-accent">
          <LogIn className="h-4 w-4" /> Iniciar sesión
        </button>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pb-10 pt-16 text-center sm:pt-24">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:border-accent/30 dark:bg-accent/10 dark:text-accent">
          <Layers className="h-3.5 w-3.5" /> AWP · BIM · Minería
        </span>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-6xl">
          Ingeniería, BIM y AWP<br />en un solo lugar.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-500 dark:text-slate-400 sm:text-lg">
          Centraliza las planillas de ingeniería, vincúlalas al modelo 3D y controla
          el avance de tus proyectos mineros — con datos aislados por empresa.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button onClick={onDemo} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#F77000] px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-500/20 transition hover:bg-[#e06600] sm:w-auto">
            <FlaskConical className="h-5 w-5" /> Probar con datos de prueba
          </button>
          <button onClick={onLogin} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-base font-semibold text-slate-700 transition hover:border-brand-400 hover:text-brand-600 dark:border-white/15 dark:bg-ink-800 dark:text-slate-200 dark:hover:border-accent/40 dark:hover:text-accent sm:w-auto">
            Iniciar sesión <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-400">La prueba usa datos de ejemplo en tu navegador. Sin registro.</p>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-6 py-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-ink-800/70">
              <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-500 dark:bg-accent/10 dark:text-accent">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold">{f.title}</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="mx-auto max-w-5xl px-6 py-10">
        <h2 className="mb-6 text-center text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Cómo funciona</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-ink-800/70">
              <div className="mb-3 grid h-9 w-9 place-items-center rounded-full bg-brand-500 text-sm font-bold text-white dark:bg-accent dark:text-ink-900">{s.n}</div>
              <h3 className="text-sm font-bold">{s.title}</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-brand-200 bg-gradient-to-br from-brand-50 to-amber-50 px-6 py-10 text-center dark:border-accent/20 dark:from-ink-800 dark:to-ink-800/60">
          <Database className="h-8 w-8 text-brand-500 dark:text-accent" />
          <h2 className="text-2xl font-extrabold tracking-tight">Probá la plataforma en 1 minuto</h2>
          <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">Entra con datos de ejemplo y recorre las planillas, el visor 3D y el avance del proyecto.</p>
          <button onClick={onDemo} className="mt-1 inline-flex items-center gap-2 rounded-xl bg-[#F77000] px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-[#e06600]">
            <FlaskConical className="h-4 w-4" /> Probar con datos de prueba
          </button>
        </div>
      </section>

      {/* Pie */}
      <footer className="border-t border-slate-200 px-6 py-8 text-center text-xs text-slate-400 dark:border-white/10">
        <p className="font-semibold text-slate-500 dark:text-slate-300">Aura GIP · Gestor de Información de Proyectos</p>
        <p className="mt-1">AWP · BIM · Control Documental — Minería</p>
        <p className="mt-1">Soporte: <a href="https://synaptechspa.cl" className="text-brand-600 hover:underline dark:text-accent">synaptechspa.cl</a></p>
      </footer>
    </div>
  )
}
