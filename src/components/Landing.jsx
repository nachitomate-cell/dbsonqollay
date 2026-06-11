import { ArrowRight, Box, Boxes, Building2, CheckCircle2, CloudUpload, Database, Gauge, History, Instagram, Layers, Linkedin, Link2, Mail, Phone, ShieldCheck, Smartphone, Youtube } from 'lucide-react'

/**
 * Landing pública (antes del login), estilo sitio corporativo:
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
  { icon: Database, img: '/landing/paso1-cargar.png', title: 'Carga tus planillas', desc: 'Importa los datos de ingeniería por disciplina desde Excel/CSV.' },
  { icon: Box, img: '/landing/paso2-vincular.png', title: 'Vincula al modelo 3D', desc: 'El plugin escribe las propiedades en Navisworks por TAG.' },
  { icon: Gauge, img: '/landing/paso3-publicar.png', title: 'Publica y controla', desc: 'Sube el modelo a la nube y sigue el avance del proyecto.' },
]

const AUDIENCES = [
  { img: '/landing/centro-control.png', title: 'Mineras y mandantes', desc: 'Trazabilidad y control de avance de sus proyectos de capital.' },
  { img: '/landing/obra.png', title: 'Constructoras / EPC', desc: 'Empaquetamiento de trabajo (AWP) y datos ligados al modelo.' },
  { img: '/landing/consultora.png', title: 'Consultoras de ingeniería', desc: 'Centralizan planillas y modelos de varios clientes, aislados.' },
]

const SHOWCASE = [
  {
    img: '/landing/offline.png', tag: 'Trabajo en terreno',
    title: 'Funciona online y sin conexión',
    desc: 'Carga y consulta tus planillas en la mina, con o sin señal. Cuando vuelve la conexión, todo se sincroniza solo con la nube.',
    points: ['Modo offline en terreno', 'Sincronización automática', 'Datos siempre actualizados'],
  },
  {
    img: '/landing/bim3d.png', tag: 'Visor BIM 3D',
    title: 'El modelo, ligado a cada dato',
    desc: 'Visualiza el modelo 3D de la planta coloreado por avance o por paquete de trabajo. Selecciona un elemento y ve su registro de planilla por TAG.',
    points: ['Modelo coloreado por avance', 'Vínculo por TAG', 'Sin licencias extra'],
  },
  {
    img: '/landing/terreno.png', tag: 'Vista dividida',
    title: 'Datos y modelo, lado a lado',
    desc: 'Trabaja la planilla y el modelo 3D al mismo tiempo, incluso desde la tablet a pie de obra. Lo que editas queda reflejado y publicado para todo el equipo.',
    points: ['Tabla + 3D simultáneos', 'Edición en contexto', 'Disponible en terreno'],
  },
  {
    img: '/landing/flujo.png', tag: 'Integración Navisworks',
    title: 'Conectado a tu modelo BIM',
    desc: 'El plugin enlaza Navisworks con la base de datos central en ambos sentidos: las propiedades y el avance viajan ligados al modelo.',
    points: ['Sincronización bidireccional', 'Propiedades por TAG', 'Base de datos central y segura'],
  },
  {
    img: '/landing/seguridad.png', tag: 'Multi-empresa',
    title: 'Cada cliente, sus datos aislados',
    desc: 'Una sola plataforma para varias empresas, con la información de cada cliente separada y protegida. Acceso seguro y controlado por roles.',
    points: ['Datos aislados por empresa', 'Acceso seguro y por roles', 'Trazabilidad y auditoría'],
  },
  {
    img: '/landing/beneficios.png', tag: 'Decisiones por datos',
    title: 'Menos errores, más eficiencia',
    desc: 'Información confiable y actualizada para todo el equipo: mejor colaboración, trazabilidad total y decisiones basadas en datos.',
    points: ['Información confiable y única', 'Trazabilidad total', 'Equipos más productivos'],
  },
  {
    img: '/landing/capacitacion.png', tag: 'Adopción del equipo',
    title: 'Tu equipo, a bordo rápido',
    desc: 'Una plataforma simple de adoptar: capacita a ingenieros y supervisores para cargar, consultar y reportar desde el primer día.',
    points: ['Curva de aprendizaje corta', 'Roles por disciplina', 'Soporte y onboarding'],
  },
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
        <div className="flex items-center gap-2 sm:gap-4">
          <button onClick={onLogin} className="hidden text-sm font-medium text-slate-400 transition hover:text-brand-600 sm:inline-flex dark:text-slate-500 dark:hover:text-accent">
            Iniciar sesión
          </button>
          <a href="#contacto" className="inline-flex items-center gap-1.5 rounded-lg bg-[#F77000] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#e06600]">
            <Mail className="h-4 w-4" /> Contactar
          </a>
        </div>
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
              <a href="#contacto" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F77000] px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-500/20 transition hover:bg-[#e06600]">
                <Mail className="h-5 w-5" /> Contactar con la empresa
              </a>
              <a href="#como" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-base font-semibold text-slate-700 transition hover:border-brand-400 hover:text-brand-600 dark:border-white/15 dark:bg-ink-800 dark:text-slate-200 dark:hover:border-accent/40 dark:hover:text-accent">
                Ver cómo funciona <ArrowRight className="h-4 w-4" />
              </a>
            </div>
            <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">
              ¿Ya tienes cuenta?{' '}
              <button onClick={onLogin} className="font-semibold text-slate-500 underline-offset-2 transition hover:text-brand-600 hover:underline dark:text-slate-400 dark:hover:text-accent">Iniciar sesión</button>
            </p>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
              {['Datos aislados por empresa', 'Visor BIM 3D ligado a los datos', 'Plugin para Navisworks'].map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-brand-500 dark:text-accent" /> {t}</li>
              ))}
            </ul>
          </div>

          {/* Visual: captura real de la app (dashboard del proyecto) */}
          <div className="relative">
            <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-2xl ring-1 ring-black/5 dark:border-white/10">
              <img src="/landing/hero.png" alt="Aura GIP en laptop y tablet: planilla de ingeniería y modelo BIM 3D con KPIs de avance" className="block w-full" width="1200" height="800" />
            </div>
            <div className="pointer-events-none absolute -bottom-5 -left-5 hidden h-20 w-20 rounded-2xl bg-brand-400/80 sm:block" />
          </div>
        </div>
      </section>

      {/* Banda de confianza */}
      <section className="border-y border-slate-200 bg-slate-50 px-6 py-6 dark:border-white/10 dark:bg-ink-800/40">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Especialistas en <b>AWP, BIM y Lean Construction</b> para minería.
          </p>
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

      {/* Showcase: capturas reales (zigzag) */}
      <section className="mx-auto max-w-6xl space-y-20 px-6 py-16 sm:py-20">
        {SHOWCASE.map((s, i) => (
          <div key={s.title} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
            <div className={i % 2 === 1 ? 'lg:order-2' : ''}>
              <span className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-accent">{s.tag}</span>
              <h3 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{s.title}</h3>
              <p className="mt-3 text-base leading-relaxed text-slate-500 dark:text-slate-400">{s.desc}</p>
              <ul className="mt-5 space-y-2.5">
                {s.points.map((p) => (
                  <li key={p} className="flex items-center gap-2.5 text-sm font-medium text-slate-600 dark:text-slate-300">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-500 dark:text-accent" /> {p}
                  </li>
                ))}
              </ul>
            </div>
            <div className={i % 2 === 1 ? 'lg:order-1' : ''}>
              <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-xl ring-1 ring-black/5 dark:border-white/10">
                <img src={s.img} alt={s.title} loading="lazy" className="block w-full" width="1200" height="900" />
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Banda móvil */}
      <section className="mx-auto max-w-6xl px-6 pb-4">
        <div className="grid items-center gap-8 overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 lg:grid-cols-2 dark:border-white/10 dark:bg-ink-800/40">
          <div className="p-8 sm:p-10">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:border-accent/30 dark:bg-accent/10 dark:text-accent">
              <Smartphone className="h-3.5 w-3.5" /> En cualquier dispositivo
            </span>
            <h3 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">Llévalo a terreno, en tu teléfono</h3>
            <p className="mt-3 text-base leading-relaxed text-slate-500 dark:text-slate-400">
              Consulta planillas, avance y modelos desde el celular, a pie de obra. La misma
              información, actualizada para todo el equipo, sin importar dónde estés.
            </p>
            <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
              {['Sin instalar nada', 'Funciona en terreno', 'Datos en tiempo real'].map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-brand-500 dark:text-accent" /> {t}</li>
              ))}
            </ul>
          </div>
          <div className="h-full">
            <img src="/landing/movil.png" alt="App de Aura GIP en un teléfono, usada en terreno minero" loading="lazy" className="h-full w-full object-cover" width="600" height="450" />
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section id="como" className="bg-slate-50 px-6 py-16 dark:bg-ink-800/40">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-10 text-center text-3xl font-extrabold tracking-tight">Cómo funciona</h2>
          <div className="grid gap-5 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-ink-800">
                <div className="border-b border-slate-100 bg-slate-50/60 p-4 dark:border-white/5 dark:bg-white/5">
                  <img src={s.img} alt={s.title} loading="lazy" className="mx-auto aspect-[4/3] w-full max-w-[260px] object-contain" width="360" height="270" />
                </div>
                <div className="relative p-6">
                  <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-brand-500 text-white dark:bg-accent dark:text-ink-900">
                    <s.icon className="h-5 w-5" />
                  </div>
                  <span className="absolute right-4 top-4 text-3xl font-extrabold text-slate-100 dark:text-white/5">{i + 1}</span>
                  <h3 className="text-base font-bold">{s.title}</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{s.desc}</p>
                </div>
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
        <div className="grid gap-5 sm:grid-cols-3">
          {AUDIENCES.map((a) => (
            <div key={a.title} className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-ink-800/70">
              <img src={a.img} alt={a.title} loading="lazy" className="aspect-[4/3] w-full object-cover" width="600" height="450" />
              <div className="p-5">
                <h3 className="flex items-center gap-2 text-base font-bold"><Building2 className="h-5 w-5 text-brand-500 dark:text-accent" /> {a.title}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{a.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-12">
        <div className="relative mx-auto flex max-w-5xl flex-col items-center gap-4 overflow-hidden rounded-3xl px-6 py-24 text-center text-white sm:py-28">
          <img src="/landing/cta-bg.png" alt="" aria-hidden="true" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#7a3200]/85 via-[#b34800]/45 to-[#F77000]/25" />
          <div className="relative flex flex-col items-center gap-4">
            <h2 className="text-3xl font-extrabold tracking-tight [text-shadow:0_2px_14px_rgba(0,0,0,0.4)]">Comienza con Aura GIP</h2>
            <p className="max-w-md text-white/95 [text-shadow:0_1px_10px_rgba(0,0,0,0.4)]">Cuéntanos sobre tu proyecto y te mostramos cómo centralizar tus planillas, el modelo 3D y el avance.</p>
            <a href="#contacto" className="mt-1 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-[#F77000] shadow-lg transition hover:bg-slate-50">
              <Mail className="h-4 w-4" /> Contactar con la empresa
            </a>
            <button onClick={onLogin} className="text-sm font-medium text-white/80 underline-offset-2 transition hover:text-white hover:underline">
              o inicia sesión
            </button>
          </div>
        </div>
      </section>

      {/* Contacto */}
      <section id="contacto" className="border-t border-slate-200 px-6 py-16 dark:border-white/10">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight">¿Hablamos?</h2>
          <p className="mx-auto mt-2 max-w-md text-slate-500 dark:text-slate-400">Contáctanos para una demo o para sumar tu empresa a la plataforma.</p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <a href="mailto:contacto@auragip.cl" className="inline-flex items-center gap-2 rounded-xl bg-[#F77000] px-6 py-3 text-sm font-semibold text-white shadow transition hover:bg-[#e06600]">
              <Mail className="h-4 w-4" /> contacto@auragip.cl
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
          <p className="text-xs text-slate-400">© 2026 Aura GIP · Gestión de Proyectos · Todos los derechos reservados.</p>
          <p className="text-xs text-slate-400">AWP · BIM · Control Documental — Minería</p>
        </div>
      </footer>
    </div>
  )
}
