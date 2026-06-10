import { ArrowRight, Box, Boxes, Building2, CheckCircle2, CloudUpload, Database, Gauge, History, Instagram, Layers, Linkedin, Link2, LogIn, Mail, Phone, Search, ShieldCheck, Youtube } from 'lucide-react'

/**
 * Landing pública (antes del login), estilo sitio corporativo Sonqollay:
 * barra superior + nav + hero con visual + features + cómo funciona + para quién
 * + banda de confianza + CTA + contacto + footer. Español neutro.
 *
 * Nota: la entrada con "datos de prueba" NO está acá; solo aparece en el login.
 *
 * props: onLogin()
 */
const NAV = [
  { href: '#caracteristicas', label: 'Características' },
  { href: '#como', label: 'Cómo funciona' },
  { href: '#para-quien', label: 'Para quién' },
  { href: '#contacto', label: 'Contacto' },
]

const FEATURES = [
  { icon: Boxes, title: 'Planillas por disciplina (AWP)', desc: 'Importa Excel/CSV, edita en grilla y autoguarda en la nube.' },
  { icon: Box, title: 'Visor BIM 3D ligado a los datos', desc: 'Selecciona un elemento y ve/edita su registro de planilla por TAG.' },
  { icon: CloudUpload, title: 'Publicar a la nube desde Navisworks', desc: 'Un clic en el plugin sube el modelo. Mismo nombre = nueva versión.' },
  { icon: ShieldCheck, title: 'Multi-empresa, datos aislados', desc: 'Cada cliente ve solo sus proyectos, planillas y modelos.' },
  { icon: Link2, title: 'Paquetes de trabajo (AWP)', desc: 'Conecta componentes a CWA/CWP y mide la cobertura.' },
  { icon: History, title: 'Auditoría y versionado', desc: 'Quién cambió qué y cuándo, con historial de modelos.' },
]

const STEPS = [
  { icon: Database, title: 'Carga tus planillas', desc: 'Importa los datos de ingeniería por disciplina.' },
  { icon: Box, title: 'Vincula al modelo 3D', desc: 'El plugin escribe las propiedades en Navisworks por TAG.' },
  { icon: Gauge, title: 'Publica y controla', desc: 'Sube el modelo a la nube y sigue el avance del proyecto.' },
]

const AUDIENCES = [
  { title: 'Mineras y mandantes', desc: 'Trazabilidad y control de avance de sus proyectos de capital.' },
  { title: 'Constructoras / EPC', desc: 'Empaquetamiento de trabajo (AWP) y datos ligados al modelo.' },
  { title: 'Consultoras de ingeniería', desc: 'Centralizan planillas y modelos de varios clientes, aislados.' },
]

export default function Landing({ onLogin }) {
  return (
    <div className="min-h-screen scroll-smooth bg-white text-slate-800 dark:bg-ink-900 dark:text-slate-100">
      {/* Barra superior */}
      <div className="hidden items-center justify-between border-b border-slate-200/70 px-8 py-1.5 text-xs text-slate-500 md:flex dark:border-white/10 dark:text-slate-400">
        <span>Aura GIP — Gestión de Información de Proyectos · BIM · AWP · Lean</span>
        <div className="flex items-center gap-3">
          <a href="https://www.linkedin.com" target="_blank" rel="noreferrer" className="hover:text-brand-600 dark:hover:text-accent"><Linkedin className="h-4 w-4" /></a>
          <a href="https://www.youtube.com" target="_blank" rel="noreferrer" className="hover:text-brand-600 dark:hover:text-accent"><Youtube className="h-4 w-4" /></a>
          <a href="https://www.instagram.com" target="_blank" rel="noreferrer" className="hover:text-brand-600 dark:hover:text-accent"><Instagram className="h-4 w-4" /></a>
        </div>
      </div>

      {/* Nav */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/90 px-5 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-ink-900/80 sm:px-8">
        <a href="#top" className="flex items-center gap-2.5">
          <img src="/aura1.png" alt="Aura GIP" className="h-9 w-9 object-contain" />
          <span className="text-xl font-extrabold tracking-tight">Aura <span className="text-brand-600 dark:text-accent">GIP</span></span>
        </a>
        <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 lg:flex dark:text-slate-300">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="transition hover:text-brand-600 dark:hover:text-accent">{n.label}</a>
          ))}
        </nav>
        <button onClick={onLogin} className="inline-flex items-center gap-1.5 rounded-lg bg-[#F77000] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#e06600]">
          <LogIn className="h-4 w-4" /> Iniciar sesión
        </button>
      </header>

      {/* Hero */}
      <section id="top" className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-100/60 blur-3xl dark:bg-accent/10" />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:border-accent/30 dark:bg-accent/10 dark:text-accent">
              <Layers className="h-3.5 w-3.5" /> AWP · BIM · Minería
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
              La plataforma para<br /><span className="text-brand-600 dark:text-accent">ingeniería, BIM y AWP</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-500 dark:text-slate-400 sm:text-lg">
              Centraliza las planillas de ingeniería, vincúlalas al modelo 3D y controla
              el avance de tus proyectos mineros — con datos aislados por empresa.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button onClick={onLogin} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F77000] px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-500/20 transition hover:bg-[#e06600]">
                <LogIn className="h-5 w-5" /> Iniciar sesión
              </button>
              <a href="#como" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-base font-semibold text-slate-700 transition hover:border-brand-400 hover:text-brand-600 dark:border-white/15 dark:bg-ink-800 dark:text-slate-200 dark:hover:border-accent/40 dark:hover:text-accent">
                Ver cómo funciona <ArrowRight className="h-4 w-4" />
              </a>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
              {['Datos aislados por empresa', 'Visor BIM 3D ligado a los datos', 'Plugin para Navisworks'].map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-brand-500 dark:text-accent" /> {t}</li>
              ))}
            </ul>
          </div>

          {/* Visual: mockup de la app */}
          <div className="relative">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-ink-800">
              <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-2.5 dark:border-white/5 dark:bg-ink-900/60">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span className="ml-3 inline-flex items-center gap-1.5 rounded-md bg-white px-2 py-0.5 text-[10px] text-slate-400 dark:bg-ink-800"><Search className="h-3 w-3" /> Aura GIP</span>
              </div>
              <div className="p-5">
                <div className="mb-4 grid grid-cols-3 gap-3">
                  {[['Elementos', '1.240'], ['Disciplinas', '8/9'], ['Cobertura', '86%']].map(([k, v]) => (
                    <div key={k} className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-white/5 dark:bg-ink-900/40">
                      <p className="text-lg font-extrabold tabular-nums text-slate-800 dark:text-white">{v}</p>
                      <p className="text-[10px] text-slate-400">{k}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2.5">
                  {[['Eléctrico', 92], ['Cañerías', 74], ['Estructura', 100], ['Mecánica', 48]].map(([d, p]) => (
                    <div key={d}>
                      <div className="mb-1 flex justify-between text-[11px] text-slate-500 dark:text-slate-400"><span>{d}</span><span className="tabular-nums">{p}%</span></div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                        <div className={`h-full rounded-full ${p === 100 ? 'bg-emerald-500' : 'bg-[#F77000]'}`} style={{ width: `${p}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="pointer-events-none absolute -bottom-5 -left-5 hidden h-20 w-20 rounded-2xl bg-brand-400/80 sm:block" />
          </div>
        </div>
      </section>

      {/* Banda de confianza */}
      <section className="border-y border-slate-200 bg-slate-50 px-6 py-6 dark:border-white/10 dark:bg-ink-800/40">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Desarrollado por <a href="https://sonqollay.cl" target="_blank" rel="noreferrer" className="font-bold text-brand-600 hover:underline dark:text-accent">Sonqollay</a>,
            consultora experta en <b>AWP, BIM y Lean Construction</b> para minería.
          </p>
          <a href="https://sonqollay.cl" target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline dark:text-accent">
            Conoce la consultora <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      {/* Características */}
      <section id="caracteristicas" className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight">Todo el proyecto, en un solo lugar</h2>
          <p className="mx-auto mt-2 max-w-xl text-slate-500 dark:text-slate-400">Datos de ingeniería, modelo 3D y avance — conectados y trazables.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:border-white/10 dark:bg-ink-800/70 dark:hover:border-accent/40">
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
      <section id="como" className="bg-slate-50 px-6 py-16 dark:bg-ink-800/40">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-10 text-center text-3xl font-extrabold tracking-tight">Cómo funciona</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="relative rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-ink-800">
                <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-brand-500 text-white dark:bg-accent dark:text-ink-900">
                  <s.icon className="h-5 w-5" />
                </div>
                <span className="absolute right-4 top-4 text-3xl font-extrabold text-slate-100 dark:text-white/5">{i + 1}</span>
                <h3 className="text-base font-bold">{s.title}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Para quién */}
      <section id="para-quien" className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight">Para quién es</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {AUDIENCES.map((a) => (
            <div key={a.title} className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-ink-800/70">
              <Building2 className="mb-3 h-7 w-7 text-brand-500 dark:text-accent" />
              <h3 className="text-base font-bold">{a.title}</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{a.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-12">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 rounded-3xl bg-gradient-to-br from-[#F77000] to-[#e85d00] px-6 py-12 text-center text-white">
          <h2 className="text-3xl font-extrabold tracking-tight">Comienza con Aura GIP</h2>
          <p className="max-w-md text-white/90">Inicia sesión y centraliza tus planillas, el modelo 3D y el avance de tus proyectos de ingeniería.</p>
          <button onClick={onLogin} className="mt-1 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-[#F77000] shadow-lg transition hover:bg-slate-50">
            <LogIn className="h-4 w-4" /> Iniciar sesión
          </button>
        </div>
      </section>

      {/* Contacto */}
      <section id="contacto" className="border-t border-slate-200 px-6 py-16 dark:border-white/10">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight">¿Hablamos?</h2>
          <p className="mx-auto mt-2 max-w-md text-slate-500 dark:text-slate-400">Contáctanos para una demo o para sumar tu empresa a la plataforma.</p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <a href="mailto:contacto@sonqollay.cl" className="inline-flex items-center gap-2 rounded-xl bg-[#F77000] px-6 py-3 text-sm font-semibold text-white shadow transition hover:bg-[#e06600]">
              <Mail className="h-4 w-4" /> contacto@sonqollay.cl
            </a>
            <a href="tel:+56995485305" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-brand-400 hover:text-brand-600 dark:border-white/15 dark:text-slate-200 dark:hover:border-accent/40 dark:hover:text-accent">
              <Phone className="h-4 w-4" /> +56 9 9548 5305
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50 px-6 py-10 dark:border-white/10 dark:bg-ink-900">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-2.5">
            <img src="/aura1.png" alt="Aura GIP" className="h-8 w-8 object-contain" />
            <span className="text-lg font-extrabold tracking-tight">Aura <span className="text-brand-600 dark:text-accent">GIP</span></span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <a href="https://www.linkedin.com" target="_blank" rel="noreferrer" className="hover:text-brand-600 dark:hover:text-accent"><Linkedin className="h-5 w-5" /></a>
            <a href="https://www.youtube.com" target="_blank" rel="noreferrer" className="hover:text-brand-600 dark:hover:text-accent"><Youtube className="h-5 w-5" /></a>
            <a href="https://www.instagram.com" target="_blank" rel="noreferrer" className="hover:text-brand-600 dark:hover:text-accent"><Instagram className="h-5 w-5" /></a>
          </div>
          <p className="text-xs text-slate-400">© 2026 Consultora Sonqollay SpA · Gestión de Proyectos · Todos los derechos reservados.</p>
          <p className="text-xs text-slate-400">AWP · BIM · Control Documental — Minería · <a href="https://sonqollay.cl" target="_blank" rel="noreferrer" className="text-brand-600 hover:underline dark:text-accent">sonqollay.cl</a></p>
        </div>
      </footer>
    </div>
  )
}
