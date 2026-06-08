// Cliente del almacén genérico de JSON en la nube (/api/store/:key). Lo usa el
// Workspace AWP para persistir su estado en la base de datos además del
// localStorage. Si no hay sesión o backend, devuelve null / no hace nada (la app
// sigue con localStorage como respaldo).
import { accessToken, authFetch } from '../lib/auth.js'

const api = () => localStorage.getItem('sqy-api-url') || import.meta.env.VITE_APS_API || ''

/** Trae el JSON guardado para `key`, o null. Funciona con sesión real o 'demo'. */
export async function loadStore(key) {
  if (!accessToken()) return null
  try {
    const res = await authFetch(`${api()}/api/store/${encodeURIComponent(key)}`, { cache: 'no-store' })
    if (!res.ok || !(res.headers.get('content-type') || '').includes('application/json')) return null
    return await res.json()
  } catch {
    return null
  }
}

// Guardado con debounce por clave (evita un POST por cada tecla/cambio).
const timers = {}
export function saveStore(key, data, delay = 1000) {
  if (!accessToken()) return
  clearTimeout(timers[key])
  timers[key] = setTimeout(() => {
    authFetch(`${api()}/api/store/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).catch(() => { /* respaldo local ya guardado */ })
  }, delay)
}
