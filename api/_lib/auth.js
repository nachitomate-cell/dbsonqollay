// Verificación del usuario autenticado en las funciones serverless, sin secreto:
// se valida el access_token del usuario contra Supabase (GET /auth/v1/user).
// Devuelve el usuario { id, email, ... } o null si no hay token válido.
//
// Guardado por env vars: si no está SUPABASE_URL, authEnabled() === false y los
// endpoints siguen comportándose como hoy (sin exigir login). Esto permite
// desplegar el código antes de activar auth, y luego encender el enforcement.

const URL = process.env.SUPABASE_URL
const ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''

export function authEnabled() {
  return Boolean(URL)
}

function bearer(req) {
  const h = req.headers?.authorization || ''
  return h.startsWith('Bearer ') ? h.slice(7).trim() : ''
}

/** Devuelve el usuario de Supabase si el token es válido; null si no. */
export async function getUserFromRequest(req) {
  if (!URL) return null
  const token = bearer(req)
  if (!token) return null
  try {
    const res = await fetch(`${URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: ANON },
    })
    if (!res.ok) return null
    const user = await res.json()
    return user?.id ? user : null
  } catch {
    return null
  }
}

/** Helper de enforcement: corre `handler(user)` solo si hay usuario; si no, 401.
 *  Cuando auth no está configurada (sin SUPABASE_URL), deja pasar (modo actual). */
export async function withUser(req, res, send, handler) {
  if (!authEnabled()) return handler(null)
  const user = await getUserFromRequest(req)
  if (!user) {
    res.status(401)
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'No autorizado: iniciá sesión.' }))
    return
  }
  return handler(user)
}
