/**
 * Helpers de Autodesk Platform Services (APS) para las funciones serverless de
 * Vercel. Solo usan `fetch` (Node 18+). El Client Secret vive en variables de
 * entorno del proyecto Vercel (APS_CLIENT_ID / APS_CLIENT_SECRET), nunca en el
 * frontend. Carpeta `_lib` → Vercel no la expone como ruta.
 */
import { activeClientTokens } from './clients.js'

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

// Slug estable de un nombre de proyecto (agrupa versiones del mismo modelo).
export function projectSlug(s) {
  return (
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // sin tildes
      .replace(/\.[a-z0-9]+$/, '') // sin extensión
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'modelo'
  )
}

// Interpreta un objectKey y devuelve { tenant, project, ts, name }.
// Esquema nuevo:  models/<tenant>/<slug>/<ts>-<archivo>
// Esquema viejo:  <ts>-<archivo>  (raíz) → tenant 'default', slug del nombre
export function parseModelKey(objectKey) {
  const parts = String(objectKey || '').split('/')
  if (parts[0] === 'models' && parts.length === 4) {
    const [, tenant, slug, file] = parts
    const m = /^(\d+)-(.+)$/.exec(file)
    return { tenant, project: slug, ts: m ? Number(m[1]) : 0, name: m ? m[2] : file }
  }
  const base = parts[parts.length - 1]
  const m = /^(\d+)-(.+)$/.exec(base)
  const name = m ? m[2] : base
  return { tenant: 'default', project: projectSlug(name), ts: m ? Number(m[1]) : 0, name }
}

export async function listObjects() {
  const { access_token } = await getToken('data:read bucket:read')
  const res = await fetch(`${BASE}/oss/v2/buckets/${BUCKET}/objects?limit=100`, {
    headers: { Authorization: `Bearer ${access_token}` },
  })
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`Listar objetos falló (${res.status}): ${await res.text()}`)
  const json = await res.json()
  return (json.items || []).map((o) => {
    const meta = parseModelKey(o.objectKey)
    return {
      urn: toBase64Urn(o.objectId),
      objectKey: o.objectKey,
      name: meta.name,
      size: o.size,
      tenant: meta.tenant,
      project: meta.project,
      ts: meta.ts,
    }
  })
}

/** Borra un objeto del bucket por su objectKey. */
export async function deleteObject(objectKey) {
  const { access_token } = await getToken('data:write data:read')
  const res = await fetch(`${BASE}/oss/v2/buckets/${BUCKET}/objects/${encodeURIComponent(objectKey)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${access_token}` },
  })
  if (!res.ok && res.status !== 404) throw new Error(`Borrar objeto falló (${res.status}): ${await res.text()}`)
  return { ok: true }
}

/** Clave de objeto en el bucket para un dataset publicado (planilla editada).
 *  Con `projectId` queda scopeada al proyecto (aislamiento entre empresas);
 *  sin él, en el espacio global/legacy (compatibilidad con lo ya publicado). */
export function datasetObjectKey(key, projectId) {
  const safe = String(key).replace(/[^\w.\-]/g, '_')
  return projectId ? `datasets/${projectId}/${safe}.json` : `datasets/${safe}.json`
}

/** Guarda un objeto JSON pequeño en el bucket (mismo flujo S3 firmado que los modelos). */
export async function putJsonObject(objectKey, obj) {
  await ensureBucket()
  const { uploadKey, urls } = await getSignedUpload(objectKey)
  const put = await fetch(urls[0], { method: 'PUT', body: JSON.stringify(obj) })
  if (!put.ok) throw new Error(`Subida de JSON falló (${put.status}): ${await put.text()}`)
  await completeUpload(objectKey, uploadKey)
}

/** Lee un objeto JSON del bucket. Devuelve null si no existe. */
export async function readJsonObject(objectKey) {
  const { access_token } = await getToken('data:read')
  const enc = encodeURIComponent(objectKey)
  const res = await fetch(`${BASE}/oss/v2/buckets/${BUCKET}/objects/${enc}/signeds3download`, {
    headers: { Authorization: `Bearer ${access_token}` },
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`signeds3download GET falló (${res.status}): ${await res.text()}`)
  const { url } = await res.json()
  if (!url) return null
  const file = await fetch(url)
  if (file.status === 404) return null
  if (!file.ok) throw new Error(`Descarga de JSON falló (${file.status})`)
  return file.json()
}

// Índice de datasets publicados (por proyecto, o global), para listar las
// planillas por nombre sin leerlas todas. Se mantiene en un objeto aparte.
const indexKey = (projectId) => (projectId ? `datasets/${projectId}/__index__.json` : 'datasets/__index__.json')

/** Lista de datasets publicados del proyecto (o globales): [{ key, name, count, updatedAt }]. */
export async function readDatasetIndex(projectId) {
  const idx = await readJsonObject(indexKey(projectId))
  return Array.isArray(idx?.datasets) ? idx.datasets : []
}

/** Agrega o actualiza una entrada del índice del proyecto (o global). */
export async function upsertDatasetIndex(entry, projectId) {
  const list = await readDatasetIndex(projectId)
  const i = list.findIndex((e) => e.key === entry.key)
  if (i >= 0) list[i] = entry
  else list.push(entry)
  await putJsonObject(indexKey(projectId), { datasets: list })
}

/** Quita una entrada del índice por key. Devuelve cuántas sacó (0 si no estaba). */
export async function removeFromDatasetIndex(key, projectId) {
  const list = await readDatasetIndex(projectId)
  const next = list.filter((e) => e.key !== key)
  if (next.length !== list.length) await putJsonObject(indexKey(projectId), { datasets: next })
  return list.length - next.length
}

/** Autoriza al plugin (Authorization: Bearer o ?token=). Solo lectura.
 *  Acepta el token COMPARTIDO (SQY_API_TOKEN) o el token de cualquier EMPRESA
 *  activa del registro (PLUGIN_CLIENTS) — así cada cliente tiene su propio token,
 *  revocable, sin romper el compartido. Si no hay ninguno configurado, la lectura
 *  queda abierta (modo dev). */
export function pluginAuthorized(req) {
  const shared = process.env.SQY_API_TOKEN
  const clientTokens = activeClientTokens()
  if (!shared && clientTokens.length === 0) return true // nada configurado → dev abierto

  const auth = req.headers.authorization || ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  const provided = bearer || req.query?.token || ''
  if (!provided) return false
  if (shared && provided === shared) return true
  return clientTokens.includes(provided)
}

/** Respuesta de error que NO filtra internals: loguea el detalle en el server
 *  (visible en los logs de la función) y devuelve un mensaje genérico al cliente.
 *  Usar en los catch 500; los 4xx con mensaje intencional siguen usando send(). */
export function fail(res, status, publicMessage, err) {
  if (err) console.error(`[api] ${publicMessage}:`, err?.stack || err?.message || err)
  send(res, status, { error: publicMessage })
}

/** Helper de respuesta JSON con manejo de errores. */
export function send(res, status, body) {
  res.status(status)
  res.setHeader('Content-Type', 'application/json')
  // Las respuestas de la API son dinámicas (token efímero, estado de traducción):
  // nunca deben cachearse. Sin esto, el edge/CDN puede servir una respuesta vieja
  // para /api/* (p. ej. un index.html cacheado de antes del fix de routing).
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  res.end(JSON.stringify(body))
}
