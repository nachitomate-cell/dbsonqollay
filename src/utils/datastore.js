/**
 * Capa de acceso a datos de las planillas editables (estado { columns, rows }).
 *
 * Es el ÚNICO lugar de la app que sabe DÓNDE se guardan los datos. Hoy usa
 * localStorage (un solo navegador). Para pasar a multiusuario con Firestore se
 * reescribe SOLO este archivo (las funciones pasan a async y leen/escriben en
 * la nube). Ningún componente o hook necesita cambiar su lógica.
 *
 * Ver docs/firebase-migration.md para el plan completo.
 */

import { accessToken, activeProjectId, authFetch } from '../lib/auth.js'

const KEY = (dataKey) => `sqy-ds-${dataKey}`
const getAPI = () => localStorage.getItem('sqy-api-url') || import.meta.env.VITE_APS_API || ''

/** ¿Hay sesión (real o de prueba) para leer/escribir en la nube? */
export const cloudEnabled = () => !!accessToken()

/**
 * Trae el dataset publicado en la base de datos (GET autenticado con el token de
 * la sesión: JWT real o 'demo'). Permite que la grilla RECUPERE lo guardado al
 * reabrir, en cualquier equipo (no solo del localStorage). Incluye la sesión de
 * prueba para que el cliente pueda probar la persistencia real. Devuelve
 * { headers, rows, ... } o null (sin sesión, sin backend, o no publicado).
 */
export async function fetchDbDataset(dataKey) {
  if (!accessToken()) return null // sin sesión, no hay nada que recuperar
  try {
    const p = activeProjectId()
    const res = await authFetch(`${getAPI()}/api/datasets/${encodeURIComponent(dataKey)}${p ? `?project=${p}` : ''}`, { cache: 'no-store' })
    if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return null
    const d = await res.json()
    return d && Array.isArray(d.rows) ? d : null
  } catch {
    return null
  }
}

/** Lee el estado editable persistido. Devuelve { columns, rows } o null. */
export function loadWorking(dataKey) {
  try {
    const raw = localStorage.getItem(KEY(dataKey))
    if (!raw) return null
    const p = JSON.parse(raw)
    if (p?.columns && p?.rows) return p
  } catch {
    /* ignore */
  }
  return null
}

/** Guarda el estado editable de una planilla. */
export function saveWorking(dataKey, state) {
  try {
    localStorage.setItem(KEY(dataKey), JSON.stringify(state))
  } catch {
    /* cuota excedida */
  }
}

/** Borra el estado editable (vuelve al dataset base). */
export function removeWorking(dataKey) {
  try {
    localStorage.removeItem(KEY(dataKey))
  } catch {
    /* ignore */
  }
}
