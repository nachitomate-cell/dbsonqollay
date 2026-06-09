// Autenticación contra Supabase Auth vía fetch (sin SDK ni dependencias nuevas,
// para no tocar package-lock ni el bundle). Guardada por env vars: si no están
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, authEnabled() === false y la app
// funciona como hoy (sin login).
//
// La sesión (access_token + refresh_token + user) se guarda en localStorage.
// El access_token se manda como Authorization: Bearer en las llamadas a la API.

const URL = import.meta.env.VITE_SUPABASE_URL
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY
const SKEY = 'sqy-auth-session'

export function authEnabled() {
  return Boolean(URL && ANON)
}

// La sesión puede vivir en localStorage (persistente, "mantener sesión") o en
// sessionStorage (solo mientras la pestaña esté abierta). Se lee de ambos.
export function getSession() {
  try {
    const raw = localStorage.getItem(SKEY) || sessionStorage.getItem(SKEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function setSession(s, remember = true) {
  // Limpia ambos almacenamientos antes de escribir (evita sesiones duplicadas).
  try { localStorage.removeItem(SKEY); sessionStorage.removeItem(SKEY) } catch { /* ignore */ }
  if (s && (s.access_token || s.demo)) {
    const store = remember ? localStorage : sessionStorage
    try { store.setItem(SKEY, JSON.stringify(s)) } catch { /* cuota */ }
  }
}

export function accessToken() {
  return getSession()?.access_token || null
}

// Proyecto activo de la sesión (para scopear las planillas por proyecto). Solo
// devuelve proyectos REALES de la DB (uuid); los demo/locales → '' (global), así
// la sesión de prueba y los datos legacy no cambian de comportamiento.
export function activeProjectId() {
  try {
    const org = sessionStorage.getItem('sqy-active-org') || ''
    const pid = sessionStorage.getItem(`sqy-active-project-session${org ? `-${org}` : ''}`) || ''
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pid) ? pid : ''
  } catch {
    return ''
  }
}

export function currentUser() {
  return getSession()?.user || null
}

async function authPost(path, body) {
  const res = await fetch(`${URL}/auth/v1/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error_description || data.msg || data.error || `Error ${res.status}`)
  }
  return data
}

export async function signIn(email, password, remember = true) {
  const data = await authPost('token?grant_type=password', { email, password })
  setSession(data, remember)
  return data
}

export async function signUp(email, password, remember = true) {
  const data = await authPost('signup', { email, password })
  // Si el proyecto NO exige confirmar email, signup ya devuelve sesión.
  if (data.access_token) setSession(data, remember)
  return data
}

// Sesión de PRUEBA (sin backend): permite entrar a la app con los datos de
// ejemplo. `remember` decide si persiste entre reinicios del navegador
// (localStorage) o solo dura la pestaña actual (sessionStorage).
export function signInDemo(remember = true) {
  const data = {
    demo: true,
    access_token: 'demo',
    user: { email: 'demo@sonqollay.cl', name: 'Usuario de prueba', role: 'demo' },
  }
  setSession(data, remember)
  return data
}

export function isDemoSession() {
  return Boolean(getSession()?.demo)
}

// Enlace mágico (OTP por correo): inicia sesión sin contraseña. Supabase manda
// un email con el enlace; al volver, la sesión llega por el hash de la URL.
export async function sendMagicLink(email) {
  return authPost('otp', { email, create_user: true })
}

// Recuperación de contraseña: envía un correo con el enlace para restablecerla.
export async function sendPasswordReset(email) {
  return authPost('recover', { email })
}

// Último email usado (para prefijarlo en el próximo login).
const EKEY = 'sqy-last-email'
export function lastEmail() {
  try { return localStorage.getItem(EKEY) || '' } catch { return '' }
}
export function rememberEmail(email) {
  try { if (email) localStorage.setItem(EKEY, email) } catch { /* ignore */ }
}

export function signOut() {
  setSession(null)
  // Limpia el scope de la sesión (org/proyecto/navegación activos) para que el
  // próximo usuario en el mismo navegador no herede dónde estaba el anterior.
  try {
    sessionStorage.removeItem('sqy-active-org')
    for (const k of Object.keys(sessionStorage)) {
      if (k.startsWith('sqy-active-project-session') || k.startsWith('sqy-nav-')) sessionStorage.removeItem(k)
    }
  } catch { /* ignore */ }
}

// Renueva el access_token con el refresh_token (los access_token duran ~1h).
export async function refreshSession() {
  const s = getSession()
  if (!s?.refresh_token) return null
  const remember = !!localStorage.getItem(SKEY) // preserva dónde vivía la sesión
  try {
    const data = await authPost('token?grant_type=refresh_token', { refresh_token: s.refresh_token })
    setSession(data, remember)
    return data
  } catch {
    setSession(null)
    return null
  }
}

// fetch con el token del usuario inyectado (para llamar a la API protegida).
export async function authFetch(input, init = {}) {
  const token = accessToken()
  const headers = new Headers(init.headers || {})
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return fetch(input, { ...init, headers })
}
