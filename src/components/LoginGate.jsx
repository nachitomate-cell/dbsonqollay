import { createContext, useContext, useState } from 'react'
import { ArrowLeft, Box, Boxes, Database, Eye, EyeOff, FlaskConical, Loader2, Mail, ShieldCheck } from 'lucide-react'
import {
  authEnabled, getSession, signIn, signUp, signOut, signInDemo,
  sendMagicLink, sendPasswordReset, lastEmail, rememberEmail,
} from '../lib/auth.js'
import Landing from './Landing.jsx'

/**
 * Puerta de autenticación. Envuelve a <ProjectGate/> en main.jsx.
 *
 * - Si hay sesión (real o de prueba) → expone { user, isDemo, signOut } por
 *   contexto (useAuth) y renderiza la app. El cierre de sesión vive ahora en el
 *   menú de usuario del Header (no en un botón flotante).
 * - Si NO hay sesión → muestra la pantalla de login (layout split).
 */
const AuthContext = createContext(null)
export function useAuth() {
  return useContext(AuthContext) || { user: null, isDemo: false, signOut: () => {} }
}

// ¿La app corre como PWA instalada (no en una pestaña del navegador)? Entonces
// saltamos la landing de marketing y vamos directo al login: en una app instalada
// la página de presentación da impresión de "sitio web".
const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true)

export default function LoginGate({ children }) {
  const [session, setSession] = useState(() => getSession())
  // En web se muestra primero la landing pública; instalada como app, directo al
  // login. "Iniciar sesión" abre el form; "Volver" solo existe si hubo landing.
  const standalone = isStandalone()
  const [showLogin, setShowLogin] = useState(standalone)

  if (!session) {
    if (!showLogin) {
      return <Landing onLogin={() => setShowLogin(true)} />
    }
    return <LoginScreen onSuccess={(s) => setSession(s)} onBack={standalone ? undefined : () => setShowLogin(false)} />
  }

  return (
    <AuthContext.Provider value={{ user: session.user, isDemo: !!session.demo, signOut: () => { signOut(); setSession(null) } }}>
      {children}
    </AuthContext.Provider>
  )
}

function LoginScreen({ onSuccess, onBack }) {
  const realAuth = authEnabled()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState(() => lastEmail())
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [remember, setRemember] = useState(true) // "mantener sesión iniciada"
  const [busy, setBusy] = useState(false) // false | 'form' | 'demo' | 'magic' | 'reset'
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  function enterDemo() {
    setBusy('demo'); setError(''); setInfo('')
    setTimeout(() => onSuccess(signInDemo(remember)), 150)
  }

  async function submit(e) {
    e.preventDefault()
    setBusy('form'); setError(''); setInfo('')
    try {
      if (mode === 'signup') {
        const d = await signUp(email.trim(), password, remember)
        rememberEmail(email.trim())
        if (d.access_token) onSuccess(d)
        else setInfo('Cuenta creada. Revisa tu correo para confirmar y luego inicia sesión.')
      } else {
        const d = await signIn(email.trim(), password, remember)
        rememberEmail(email.trim())
        onSuccess(d)
      }
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesión.')
    } finally {
      setBusy(false)
    }
  }

  async function magicLink() {
    if (!email.trim()) { setError('Escribe tu email para enviarte el enlace.'); return }
    setBusy('magic'); setError(''); setInfo('')
    try {
      await sendMagicLink(email.trim()); rememberEmail(email.trim())
      setInfo('Te enviamos un enlace de acceso a tu correo. Ábrelo para entrar.')
    } catch (err) {
      setError(err.message || 'No se pudo enviar el enlace.')
    } finally { setBusy(false) }
  }

  async function forgotPassword() {
    if (!email.trim()) { setError('Escribe tu email para recuperar la contraseña.'); return }
    setBusy('reset'); setError(''); setInfo('')
    try {
      await sendPasswordReset(email.trim())
      setInfo('Te enviamos un correo para restablecer tu contraseña.')
    } catch (err) {
      setError(err.message || 'No se pudo enviar el correo.')
    } finally { setBusy(false) }
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-ink-900">
      {/* Panel de marca (claro), split inspirado en Label Studio */}
      <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-orange-50 via-amber-50 to-brand-100/60 p-12 lg:flex dark:from-ink-900 dark:via-ink-900 dark:to-ink-800">
        {/* Logo + nombre */}
        <div className="relative z-10 flex items-center gap-3.5">
          <img src="/aura1.png" alt="Aura" className="h-14 w-14 object-contain" />
          <div className="leading-tight">
            <p className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Aura <span className="text-brand-600 dark:text-accent">GIP</span></p>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-white/60">Gestor de Información de Proyectos</p>
          </div>
        </div>

        {/* Tagline + features */}
        <div className="relative z-10">
          <h2 className="text-[2.5rem] font-extrabold leading-[1.08] tracking-tight text-slate-900 dark:text-white">
            Ingeniería, BIM y AWP<br />en un solo lugar.
          </h2>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-slate-600 dark:text-white/70">
            Centraliza las planillas de ingeniería, vincúlalas al modelo 3D y controla el avance de tus proyectos mineros.
          </p>
          <ul className="mt-8 space-y-4">
            <Feature icon={Boxes} title="Planillas por disciplina (AWP)" desc="Empaquetamiento de trabajo y datos de ingeniería." />
            <Feature icon={Box} title="Visor BIM 3D ligado a los datos" desc="Selecciona en la planilla y resáltalo en el modelo." />
            <Feature icon={ShieldCheck} title="Calidad y trazabilidad" desc="Detección de TAGs duplicados y elementos sin TAG." />
            <Feature icon={Database} title="Autoguardado en la nube" desc="Tus cambios se guardan en la base de datos." />
          </ul>
        </div>

        <p className="relative z-10 text-xs font-medium text-slate-400 dark:text-white/40">AWP · BIM · Minería</p>

        {/* Formas geométricas decorativas (esquina inferior derecha) */}
        <div className="pointer-events-none absolute -bottom-6 right-6 z-0">
          <div className="relative h-52 w-60">
            <span className="absolute bottom-0 right-0 h-28 w-28 rounded-3xl bg-brand-400/80" />
            <span className="absolute bottom-20 right-24 h-20 w-20 rounded-2xl bg-amber-300/80" />
            <span className="absolute bottom-28 right-1 h-16 w-16 rounded-2xl bg-brand-200/80" />
            <span className="absolute bottom-2 right-36 h-14 w-14 rounded-xl bg-orange-300/70" />
          </div>
        </div>
      </aside>

      {/* Panel del formulario (tarjeta) */}
      <main className="flex w-full items-center justify-center px-4 py-10 lg:w-1/2">
        <div className="w-full max-w-md">
          {onBack && (
            <button onClick={onBack} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-brand-600 dark:text-slate-400 dark:hover:text-accent">
              <ArrowLeft className="h-4 w-4" /> Volver
            </button>
          )}
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl dark:border-white/10 dark:bg-ink-800">
            {/* Marca en móvil (en desktop la muestra el panel izquierdo) */}
            <img src="/aura1.png" alt="Aura" className="mb-4 h-12 w-12 object-contain lg:hidden" />
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {realAuth && mode === 'signup' ? 'Crear cuenta' : 'Entrar'}
            </h1>
            <p className="mb-7 mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              {realAuth ? (mode === 'signup' ? 'Regístrate o entra con datos de prueba' : 'Inicia sesión o entra con datos de prueba') : 'Accede para explorar la plataforma'}
            </p>

            {/* Formulario real (solo si Supabase está configurado) */}
            {realAuth && (
              <form onSubmit={submit} className="mb-5 space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Email</label>
                  <input
                    type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 dark:border-white/10 dark:bg-ink-900 dark:text-slate-100 dark:focus:ring-accent/20"
                  />
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Contraseña</label>
                    {mode === 'signin' && (
                      <button type="button" onClick={forgotPassword} disabled={!!busy} className="text-xs font-medium text-slate-400 transition hover:text-brand-600 disabled:opacity-60 dark:hover:text-accent">
                        {busy === 'reset' ? 'Enviando…' : '¿Olvidaste tu contraseña?'}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 pr-11 text-sm text-slate-800 outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 dark:border-white/10 dark:bg-ink-900 dark:text-slate-100 dark:focus:ring-accent/20"
                    />
                    <button type="button" onClick={() => setShowPwd((v) => !v)} title={showPwd ? 'Ocultar' : 'Mostrar'} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200">
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit" disabled={!!busy}
                  className="w-full rounded-lg bg-[#F77000] py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#e06600] disabled:opacity-60"
                >
                  {busy === 'form' ? 'Procesando…' : mode === 'signup' ? 'Crear cuenta' : 'Entrar'}
                </button>
                <button
                  type="button" onClick={magicLink} disabled={!!busy}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-600 disabled:opacity-60 dark:border-white/10 dark:text-slate-300 dark:hover:border-accent/40 dark:hover:text-accent"
                >
                  {busy === 'magic' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  Entrar con enlace por correo
                </button>
              </form>
            )}

            {realAuth && (
              <div className="my-5 flex items-center gap-3 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" /> o <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
              </div>
            )}

            {/* Acceso con datos de prueba (CTA principal) */}
            <button
              type="button" onClick={enterDemo} disabled={!!busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#F77000] py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#e06600] disabled:opacity-60"
            >
              {busy === 'demo' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
              Iniciar con datos de prueba
            </button>

            {/* Mantener sesión iniciada */}
            <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-sm font-medium text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={remember} onChange={() => setRemember((v) => !v)} className="h-4 w-4 accent-[#F77000]" />
              Mantener sesión iniciada
            </label>

            {realAuth && (
              <button
                type="button"
                onClick={() => { setMode((m) => (m === 'signup' ? 'signin' : 'signup')); setError(''); setInfo('') }}
                className="mt-5 w-full text-center text-sm text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                {mode === 'signup' ? '¿Ya tienes cuenta? ' : '¿No tienes cuenta? '}
                <span className="font-semibold text-brand-600 dark:text-accent">{mode === 'signup' ? 'Inicia sesión' : 'Regístrate'}</span>
              </button>
            )}

            {error && <p className="mt-4 text-center text-sm text-red-600 dark:text-red-400">{error}</p>}
            {info && <p className="mt-4 text-center text-sm text-emerald-600 dark:text-emerald-400">{info}</p>}
          </div>

          <p className="mt-5 px-2 text-center text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
            La sesión de prueba usa datos de ejemplo en este navegador. {remember ? 'Permanecerás conectado al volver.' : 'Se cerrará al cerrar la pestaña.'}
          </p>
        </div>
      </main>
    </div>
  )
}

function Feature({ icon: IconCmp, title, desc }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-brand-600 shadow-sm ring-1 ring-brand-100/70 dark:bg-white/10 dark:text-accent dark:ring-white/10">
        <IconCmp className="h-[18px] w-[18px]" />
      </span>
      <span>
        <span className="block text-sm font-bold text-slate-800 dark:text-white">{title}</span>
        <span className="block text-xs text-slate-500 dark:text-white/60">{desc}</span>
      </span>
    </li>
  )
}
