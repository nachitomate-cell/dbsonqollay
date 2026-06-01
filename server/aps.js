/**
 * Cliente mínimo de Autodesk Platform Services (APS) usando la API REST v2.
 * Solo depende de `fetch` (Node 18+). Implementa:
 *   - Autenticación 2-legged (client credentials)
 *   - Creación de bucket OSS (idempotente)
 *   - Subida de objetos vía Signed S3 Upload (el método vigente)
 *   - Lanzamiento y consulta de traducción (Model Derivative -> SVF2)
 *
 * Doc: https://aps.autodesk.com/en/docs/
 */

const BASE = 'https://developer.api.autodesk.com'

let cachedToken = null // { access_token, expires_at }

/** Token 2-legged con cache simple en memoria. */
export async function getToken(scope = 'data:read data:write data:create bucket:create bucket:read viewables:read') {
  if (cachedToken && cachedToken.expires_at > Date.now() + 60_000 && cachedToken.scope === scope) {
    return cachedToken.access_token
  }
  const id = process.env.APS_CLIENT_ID
  const secret = process.env.APS_CLIENT_SECRET
  if (!id || !secret) throw new Error('Faltan APS_CLIENT_ID / APS_CLIENT_SECRET en el .env')

  const body = new URLSearchParams({ grant_type: 'client_credentials', scope })
  const res = await fetch(`${BASE}/authentication/v2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
    },
    body,
  })
  if (!res.ok) throw new Error(`Auth APS falló (${res.status}): ${await res.text()}`)
  const json = await res.json()
  cachedToken = { access_token: json.access_token, expires_at: Date.now() + json.expires_in * 1000, scope }
  return json.access_token
}

/** Token de solo lectura para el visor del navegador (no expone el secret). */
export async function getViewerToken() {
  const token = await getToken('viewables:read')
  return token
}

/** Crea el bucket si no existe (ignora "ya existe"). */
export async function ensureBucket(bucketKey) {
  const token = await getToken('bucket:create bucket:read')
  const res = await fetch(`${BASE}/oss/v2/buckets`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucketKey, policyKey: 'persistent' }),
  })
  if (res.status === 409) return // ya existe
  if (!res.ok) throw new Error(`No se pudo crear el bucket (${res.status}): ${await res.text()}`)
}

/**
 * Sube un buffer al bucket vía Signed S3 Upload (3 pasos).
 * Devuelve el objectId (urn sin codificar).
 */
export async function uploadObject(bucketKey, objectKey, buffer) {
  const token = await getToken('data:write data:create data:read')
  const enc = encodeURIComponent(objectKey)

  // 1) pedir URL firmada
  const signRes = await fetch(`${BASE}/oss/v2/buckets/${bucketKey}/objects/${enc}/signeds3upload`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!signRes.ok) throw new Error(`signeds3upload GET falló (${signRes.status}): ${await signRes.text()}`)
  const { uploadKey, urls } = await signRes.json()

  // 2) subir el binario a S3
  const putRes = await fetch(urls[0], { method: 'PUT', body: buffer })
  if (!putRes.ok) throw new Error(`PUT a S3 falló (${putRes.status})`)

  // 3) confirmar la subida
  const doneRes = await fetch(`${BASE}/oss/v2/buckets/${bucketKey}/objects/${enc}/signeds3upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ uploadKey }),
  })
  if (!doneRes.ok) throw new Error(`signeds3upload POST falló (${doneRes.status}): ${await doneRes.text()}`)
  const json = await doneRes.json()
  return json.objectId // urn::sin codificar (urn:adsk.objects:os.object:bucket/objectKey)
}

/** urn base64url (sin padding) para Model Derivative. */
export function toBase64Urn(objectId) {
  return Buffer.from(objectId).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Lanza la traducción a SVF2 (visor web). Para NWD/RVT/IFC/etc. */
export async function translate(objectId) {
  const token = await getToken('data:read data:write data:create')
  const urn = toBase64Urn(objectId)
  const res = await fetch(`${BASE}/modelderivative/v2/designdata/job`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-ads-force': 'true' },
    body: JSON.stringify({
      input: { urn },
      output: { formats: [{ type: 'svf2', views: ['2d', '3d'] }] },
    }),
  })
  if (!res.ok) throw new Error(`Traducción falló (${res.status}): ${await res.text()}`)
  return { urn, ...(await res.json()) }
}

/** Estado de la traducción (manifest). */
export async function getManifest(urn) {
  const token = await getToken('data:read')
  const res = await fetch(`${BASE}/modelderivative/v2/designdata/${urn}/manifest`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 404) return { status: 'pending', progress: '0%' }
  if (!res.ok) throw new Error(`Manifest falló (${res.status}): ${await res.text()}`)
  return res.json()
}

/**
 * Lista los objetos del bucket OSS (modelos subidos). Para cada uno arma el urn
 * base64 y un nombre legible. Así los proyectos aparecen en cualquier
 * dispositivo, no solo en el navegador que los subió.
 */
export async function listObjects(bucketKey) {
  const token = await getToken('data:read bucket:read')
  const res = await fetch(`${BASE}/oss/v2/buckets/${bucketKey}/objects?limit=100`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 404) return [] // el bucket aún no existe
  if (!res.ok) throw new Error(`Listar objetos falló (${res.status}): ${await res.text()}`)
  const json = await res.json()
  return (json.items || []).map((o) => {
    // objectKey con prefijo de timestamp: "<ms>-<nombre>"; lo limpiamos.
    const pretty = String(o.objectKey).replace(/^\d+-/, '')
    return { urn: toBase64Urn(o.objectId), objectKey: o.objectKey, name: pretty, size: o.size }
  })
}
