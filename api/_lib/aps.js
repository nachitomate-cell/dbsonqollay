/**
 * Helpers de Autodesk Platform Services (APS) para las funciones serverless de
 * Vercel. Solo usan `fetch` (Node 18+). El Client Secret vive en variables de
 * entorno del proyecto Vercel (APS_CLIENT_ID / APS_CLIENT_SECRET), nunca en el
 * frontend. Carpeta `_lib` → Vercel no la expone como ruta.
 */
const BASE = 'https://developer.api.autodesk.com'
export const BUCKET = (process.env.APS_BUCKET || 'sonqollay-models-2026').toLowerCase()

export async function getToken(scope) {
  const id = process.env.APS_CLIENT_ID
  const secret = process.env.APS_CLIENT_SECRET
  if (!id || !secret) throw new Error('Faltan APS_CLIENT_ID / APS_CLIENT_SECRET en las variables de entorno.')
  const res = await fetch(`${BASE}/authentication/v2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
    },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope }),
  })
  if (!res.ok) throw new Error(`Auth APS falló (${res.status}): ${await res.text()}`)
  return res.json()
}

export async function ensureBucket() {
  const { access_token } = await getToken('bucket:create bucket:read')
  const res = await fetch(`${BASE}/oss/v2/buckets`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucketKey: BUCKET, policyKey: 'persistent' }),
  })
  if (res.status !== 409 && !res.ok) throw new Error(`Crear bucket falló (${res.status}): ${await res.text()}`)
}

export function toBase64Urn(objectId) {
  return Buffer.from(objectId).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** URL(s) firmada(s) S3 para subir un objeto directamente desde el navegador. */
export async function getSignedUpload(objectKey) {
  await ensureBucket()
  const { access_token } = await getToken('data:write data:create data:read')
  const enc = encodeURIComponent(objectKey)
  const res = await fetch(`${BASE}/oss/v2/buckets/${BUCKET}/objects/${enc}/signeds3upload`, {
    headers: { Authorization: `Bearer ${access_token}` },
  })
  if (!res.ok) throw new Error(`signeds3upload GET falló (${res.status}): ${await res.text()}`)
  return res.json() // { uploadKey, urls }
}

/** Confirma la subida S3 y devuelve el objectId. */
export async function completeUpload(objectKey, uploadKey) {
  const { access_token } = await getToken('data:write data:create data:read')
  const enc = encodeURIComponent(objectKey)
  const res = await fetch(`${BASE}/oss/v2/buckets/${BUCKET}/objects/${enc}/signeds3upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ uploadKey }),
  })
  if (!res.ok) throw new Error(`signeds3upload POST falló (${res.status}): ${await res.text()}`)
  return res.json() // { objectId, ... }
}

export async function translate(objectId) {
  const { access_token } = await getToken('data:read data:write data:create')
  const urn = toBase64Urn(objectId)
  const res = await fetch(`${BASE}/modelderivative/v2/designdata/job`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json', 'x-ads-force': 'true' },
    body: JSON.stringify({ input: { urn }, output: { formats: [{ type: 'svf2', views: ['2d', '3d'] }] } }),
  })
  if (!res.ok) throw new Error(`Traducción falló (${res.status}): ${await res.text()}`)
  return { urn, ...(await res.json()) }
}

export async function getManifest(urn) {
  const { access_token } = await getToken('data:read')
  const res = await fetch(`${BASE}/modelderivative/v2/designdata/${urn}/manifest`, {
    headers: { Authorization: `Bearer ${access_token}` },
  })
  if (res.status === 404) return { status: 'pending', progress: '0%' }
  if (!res.ok) throw new Error(`Manifest falló (${res.status}): ${await res.text()}`)
  return res.json()
}

export async function listObjects() {
  const { access_token } = await getToken('data:read bucket:read')
  const res = await fetch(`${BASE}/oss/v2/buckets/${BUCKET}/objects?limit=100`, {
    headers: { Authorization: `Bearer ${access_token}` },
  })
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`Listar objetos falló (${res.status}): ${await res.text()}`)
  const json = await res.json()
  return (json.items || []).map((o) => ({
    urn: toBase64Urn(o.objectId),
    objectKey: o.objectKey,
    name: String(o.objectKey).replace(/^\d+-/, ''),
    size: o.size,
  }))
}

/** Helper de respuesta JSON con manejo de errores. */
export function send(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}
