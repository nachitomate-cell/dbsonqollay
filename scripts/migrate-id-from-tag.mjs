/**
 * Migración (camino B): congela el TAG actual como columna identidad inmutable
 * `ID` en cada planilla publicada, dejando el `TAG` libre para editar (p. ej.
 * separarlo de la modularización) SIN romper el vínculo con el modelo 3D / plugin.
 *
 * Qué hace, por cada planilla:
 *   1) Agrega la columna `ID` como PRIMERA columna (si no está).
 *   2) Rellena `ID = TAG actual` SOLO donde `ID` esté vacío (idempotente: si ya
 *      tiene ID, no lo toca → podés correrlo las veces que quieras).
 *   3) Fija `tagField = 'ID'` (la llave por la que matchea el plugin / 3D).
 *   El `TAG` y la columna `MODULARIZACIÓN` quedan intactos.
 *
 * Por qué por la API (y no directo a la DB): `POST /api/datasets/:key` actualiza
 * a la vez el bucket JSON (que LEE el plugin) y la base Postgres (que lee el
 * modelo). Tocar solo la DB dejaría al plugin desincronizado.
 *
 * IMPORTANTE — orden seguro: corré esta migración ANTES de empezar a editar los
 * TAG. El `ID` se congela con el valor ACTUAL del TAG (el que está hoy en el
 * modelo). Si cambiás el TAG primero, el ID quedaría congelado con el valor nuevo
 * y se rompería el match.
 *
 * Uso:
 *   # 1) Previsualizar (no escribe nada):
 *   SQY_API_TOKEN=xxxx node scripts/migrate-id-from-tag.mjs --dry-run
 *   # 2) Aplicar (hace backup de cada planilla en scripts/backups/ antes de tocarla):
 *   SQY_API_TOKEN=xxxx node scripts/migrate-id-from-tag.mjs
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

// Calcula el dataset migrado. Devuelve { payload, filled, alreadyOk }.
function plan(data) {
  const hs = Array.isArray(data.headers) ? data.headers : []
  const oldKey = data.tagField || hs[0] || null
  if (!oldKey) return { skip: 'sin tagField/headers' }

  const newHeaders = ['ID', ...hs.filter((h) => !isId(h))]
  const newColumns = Array.isArray(data.columns)
    ? [{ key: 'ID', visible: true }, ...data.columns.filter((c) => c && !isId(c.key))]
    : null

  let filled = 0
  const rows = (Array.isArray(data.rows) ? data.rows : []).map((r) => {
    // valor de ID existente (cualquier variante de mayúsculas), si lo hay
    let idVal = ''
    for (const k in r) if (isId(k)) idVal = r[k]
    const cur = String(idVal ?? '').trim()
    const finalId = cur ? idVal : (r[oldKey] ?? '')
    if (!cur && String(finalId).trim()) filled++
    // ID PRIMERO en la fila: así el plugin lo escribe como 1ª propiedad de la
    // pestaña BIM (el orden de propiedades = orden de claves de la fila).
    const out = { ID: finalId }
    for (const k in r) if (!isId(k)) out[k] = r[k]
    return out
  })

  // Ya migrada solo si: ID es 1ª columna, tagField=ID, nada por rellenar y la
  // 1ª clave de las filas ya es ID (si no, hay que reordenar → re-publicar).
  const firstRow = (Array.isArray(data.rows) ? data.rows : [])[0]
  const idFirstInRows = firstRow ? isId(Object.keys(firstRow)[0]) : true
  const headersOk = hs.length && isId(hs[0]) && hs.slice(1).every((h) => !isId(h))
  const alreadyOk = headersOk && data.tagField === 'ID' && filled === 0 && idFirstInRows
  const payload = {
    name: data.name || data.key,
    tagField: 'ID',
    headers: newHeaders,
    ...(newColumns ? { columns: newColumns } : {}),
    rows,
    author: 'Migración ID (script)',
  }
  return { payload, filled, alreadyOk }
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
      if (res.alreadyOk) { console.log(`· ${key}: ya migrada (sin cambios)`); skipCount++; continue }

      const total = (data.rows || []).length
      console.log(`· ${key}: ${total} fila(s) · ID a rellenar: ${res.filled} · tagField → ID`)

      if (DRY) continue

      // Backup del original antes de tocar nada.
      writeFileSync(join(BACKUP_DIR, `${key}-${stamp}.json`), JSON.stringify(data, null, 2))

      const r = await fetch(`${BASE}/api/datasets/${encodeURIComponent(key)}${q()}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(res.payload),
      })
      if (!r.ok) throw new Error(`POST ${r.status} — ${await r.text().catch(() => '')}`)
      console.log(`  ✓ publicada (backup en scripts/backups/${key}-${stamp}.json)`)
      okCount++
    } catch (e) {
      console.error(`  ✗ ${key}: ${e.message}`)
      errCount++
    }
  }

  console.log(`\nListo. Migradas: ${okCount} · Omitidas: ${skipCount} · Errores: ${errCount}`)
  if (DRY) console.log('Fue un dry-run: no se escribió nada. Quitá --dry-run para aplicar.')
}

main().catch((e) => { console.error('Error:', e.message); process.exitCode = 1 })
