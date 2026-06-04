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

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SKEY) || 'null')
  } catch {
    return null
  }
}

function setSession(s) {
  if (s && s.access_token) localStorage.setItem(SKEY, JSON.stringify(s))
  else localStorage.removeItem(SKEY)
}

export function accessToken() {
  return getSession()?.access_token || null
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

export async function signIn(email, password) {
  const data = await authPost('token?grant_type=password', { email, password })
  setSession(data)
  return data
}

export async function signUp(email, password) {
  const data = await authPost('signup', { email, password })
  // Si el proyecto NO exige confirmar email, signup ya devuelve sesión.
  if (data.access_token) setSession(data)
  return data
}

export function signOut() {
  setSession(null)
}

// Renueva el access_token con el refresh_token (los access_token duran ~1h).
export async function refreshSession() {
  const s = getSession()
  if (!s?.refresh_token) return null
  try {
    const data = await authPost('token?grant_type=refresh_token', { refresh_token: s.refresh_token })
    setSession(data)
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
