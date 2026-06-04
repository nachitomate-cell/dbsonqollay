import { useState } from 'react'
import { authEnabled, getSession, signIn, signUp, signOut } from '../lib/auth.js'

/**
 * Puerta de autenticación. Envuelve a <App/> en main.jsx.
 *
 * - Si NO hay env vars de Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY),
 *   authEnabled() es false y renderiza los children tal cual → la app funciona
 *   igual que hoy (sin login). Esto hace seguro el deploy antes de configurar auth.
 * - Si hay env vars y no hay sesión → muestra el login.
 * - Si hay sesión → renderiza la app + un botón discreto de "Salir".
 */
export default function LoginGate({ children }) {
  const [session, setSession] = useState(() => getSession())

  if (!authEnabled()) return children
  if (session) return <Authed onSignOut={() => { signOut(); setSession(null) }}>{children}</Authed>
  return <LoginScreen onSuccess={(s) => setSession(s)} />
}

function Authed({ children, onSignOut }) {
  return (
    <>
      {children}
      <button
        onClick={onSignOut}
        title="Cerrar sesión"
        className="fixed bottom-3 left-3 z-50 rounded-md border border-slate-200 bg-white/90 px-2.5 py-1 text-xs font-medium text-slate-500 shadow-sm backdrop-blur hover:text-slate-800 dark:border-white/10 dark:bg-ink-800/90 dark:text-slate-400 dark:hover:text-slate-100"
      >
        Salir
      </button>
    </>
  )
}

function LoginScreen({ onSuccess }) {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError(''); setInfo('')
    try {
      if (mode === 'signup') {
        const d = await signUp(email.trim(), password)
        if (d.access_token) onSuccess(d)
        else setInfo('Cuenta creada. Revisá tu email para confirmar y luego iniciá sesión.')
      } else {
        const d = await signIn(email.trim(), password)
        onSuccess(d)
      }
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesión.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-grid px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-7 shadow-xl dark:border-white/10 dark:bg-ink-800"
      >
        <div className="mb-6 text-center">
          <h1 className="text-lg font-bold leading-tight text-slate-800 dark:text-slate-100">Gestor de Información de Proyectos</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {mode === 'signup' ? 'Creá tu cuenta' : 'Iniciá sesión para continuar'}
          </p>
        </div>

        <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Email</label>
        <input
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className="mb-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#F77000] dark:border-white/10 dark:bg-ink-900 dark:text-slate-100"
        />

        <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Contraseña</label>
        <input
          type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          className="mb-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#F77000] dark:border-white/10 dark:bg-ink-900 dark:text-slate-100"
        />

        {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        {info && <p className="mb-3 text-sm text-emerald-600 dark:text-emerald-400">{info}</p>}

        <button
          type="submit" disabled={busy}
          className="w-full rounded-lg bg-[#F77000] py-2 text-sm font-semibold text-white hover:bg-[#e06600] disabled:opacity-60"
        >
          {busy ? 'Procesando…' : mode === 'signup' ? 'Crear cuenta' : 'Entrar'}
        </button>

        <button
          type="button"
          onClick={() => { setMode((m) => (m === 'signup' ? 'signin' : 'signup')); setError(''); setInfo('') }}
          className="mt-4 w-full text-center text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          {mode === 'signup' ? '¿Ya tenés cuenta? Iniciá sesión' : '¿No tenés cuenta? Registrate'}
        </button>
      </form>
    </div>
  )
}
