/**
 * Reversa del "camino B": ELIMINA la columna identidad `ID` de cada planilla
 * publicada y deja como llave de vínculo la columna TAG (TAG/COMMODITY).
 *
 * Motivo: el cruce con el modelo vuelve a hacerse por el TAG (que en el modelo
 * vive en la pestaña nativa "Elemento" → Nombre/Capa, no editable), así que la
 * columna ID artificial ya no hace falta y conviene quitarla de los datos.
 *
 * Qué hace, por cada planilla:
 *   1) Quita la columna `ID` de headers, columns y de cada fila.
 *   2) Fija `tagField` = la columna TAG (busca /tag|commodity/i; si no hay, la 1ª
 *      columna que quede tras sacar el ID).
 *   3) Re-publica por `POST /api/datasets/:key` (actualiza bucket JSON + Postgres).
 *
 * Igual que la migración: idempotente (si ya no hay ID, no toca nada) y hace
 * backup de cada planilla en scripts/backups/ antes de escribir.
 *
 * Uso:
 *   # 1) Previsualizar (no escribe nada):
 *   SQY_API_TOKEN=xxxx node scripts/remove-id-column.mjs --dry-run
 *   # 2) Aplicar:
 *   SQY_API_TOKEN=xxxx node scripts/remove-id-column.mjs
 *
 * Variables (se leen de .env si existe):
 *   SQY_API_TOKEN  (requerido)  token del plugin (mismo SQY_API_TOKEN del server)
 *   SQY_API_URL    (opcional)   base, por defecto https://basesonqollay.synaptechspa.cl
 *   SQY_PROJECT    (opcional)   id de proyecto; si el listado sale vacío, probá con esto
 */
import 'dotenv/config'
import { mkdirSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const DRY = process.argv.includes('--dry-run')
const BASE = (process.env.SQY_API_URL || 'https://basesonqollay.synaptechspa.cl').replace(/\/+$/, '')
const TOKEN = process.env.SQY_API_TOKEN
const PROJECT = (process.env.SQY_PROJECT || '').trim()

if (!TOKEN) {
  console.error('Falta SQY_API_TOKEN (definilo en .env o en el entorno).')
  process.exit(1)
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const BACKUP_DIR = join(__dirname, 'backups')

const isId = (h) => /^id$/i.test(String(h || '').trim())
// Columna TAG (la que cruza con el modelo): preferimos TAG/COMMODITY.
const isTag = (h) => /tag|commodity/i.test(String(h || ''))
const q = (extra = {}) => {
  const p = new URLSearchParams(extra)
  if (PROJECT) p.set('project', PROJECT)
  const s = p.toString()
  return s ? `?${s}` : ''
}
const headers = { Authorization: `Bearer ${TOKEN}` }

async function getJson(url) {
  const r = await fetch(url, { headers })
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} — ${await r.text().catch(() => '')}`)
  return r.json()
}

// Calcula el dataset sin ID. Devuelve { payload, removed, alreadyOk } o { skip }.
function plan(data) {
  const hs = Array.isArray(data.headers) ? data.headers : []
  if (!hs.length) return { skip: 'sin headers' }

  const hadId = hs.some(isId)
  const newHeaders = hs.filter((h) => !isId(h))
  if (!newHeaders.length) return { skip: 'la planilla solo tenía la columna ID' }

  const newColumns = Array.isArray(data.columns)
    ? data.columns.filter((c) => c && !isId(c.key))
    : null

  // tagField: la columna TAG si existe; si no, la 1ª que quede.
  const newTagField = newHeaders.find(isTag) || newHeaders[0]

  const rows = (Array.isArray(data.rows) ? data.rows : []).map((r) => {
    const out = {}
    for (const k in r) if (!isId(k)) out[k] = r[k]
    return out
  })

  const alreadyOk = !hadId && data.tagField === newTagField
  const payload = {
    name: data.name || data.key,
    tagField: newTagField,
    headers: newHeaders,
    ...(newColumns ? { columns: newColumns } : {}),
    rows,
    author: 'Quitar ID (script)',
  }
  return { payload, removed: hadId, newTagField, alreadyOk }
}

async function main() {
  console.log(`Servidor: ${BASE}${PROJECT ? ` · proyecto: ${PROJECT}` : ' · (scope global)'}`)
  console.log(DRY ? '== DRY RUN (no se escribe nada) ==\n' : '== APLICANDO cambios ==\n')

  const list = await getJson(`${BASE}/api/datasets${q()}`)
  const datasets = Array.isArray(list.datasets) ? list.datasets : []
  if (!datasets.length) {
    console.log('No se listaron planillas. Si esperabas algunas, probá con SQY_PROJECT=<id>.')
    return
  }
  console.log(`Planillas encontradas: ${datasets.length}\n`)

  if (!DRY) mkdirSync(BACKUP_DIR, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  let okCount = 0, skipCount = 0, errCount = 0

  for (const d of datasets) {
    const key = d.key
    try {
      const data = await getJson(`${BASE}/api/datasets/${encodeURIComponent(key)}${q()}`)
      const res = plan(data)
      if (res.skip) { console.log(`· ${key}: omitida (${res.skip})`); skipCount++; continue }
      if (res.alreadyOk) { console.log(`· ${key}: ya sin ID (sin cambios)`); skipCount++; continue }

      const total = (data.rows || []).length
      console.log(`· ${key}: ${total} fila(s) · ID ${res.removed ? 'se quita' : 'no había'} · tagField → ${res.newTagField}`)

      if (DRY) continue

      // Backup del original antes de tocar nada.
      writeFileSync(join(BACKUP_DIR, `${key}-preRemoveId-${stamp}.json`), JSON.stringify(data, null, 2))

      const r = await fetch(`${BASE}/api/datasets/${encodeURIComponent(key)}${q()}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(res.payload),
      })
      if (!r.ok) throw new Error(`POST ${r.status} — ${await r.text().catch(() => '')}`)
      console.log(`  ✓ publicada (backup en scripts/backups/${key}-preRemoveId-${stamp}.json)`)
      okCount++
    } catch (e) {
      console.error(`  ✗ ${key}: ${e.message}`)
      errCount++
    }
  }

  console.log(`\nListo. Sin ID: ${okCount} · Omitidas: ${skipCount} · Errores: ${errCount}`)
  if (DRY) console.log('Fue un dry-run: no se escribió nada. Quitá --dry-run para aplicar.')
}

main().catch((e) => { console.error('Error:', e.message); process.exitCode = 1 })
