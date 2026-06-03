/**
 * Conexión a la base de datos Sonqollay (Postgres / Supabase) para que el
 * modelo de Navisworks la lea EN VIVO vía DataTools (ODBC), vinculando por TAG.
 *
 * Es ADITIVO y opcional: si no está la variable de entorno SQY_DATABASE_URL,
 * todo se omite y el publish sigue funcionando igual que antes (bucket APS).
 *
 * Al publicar una planilla, se replican sus filas en:
 *   tabla  sqy_dataset_rows(dataset_key, tag, data jsonb)
 * y se (re)crea una VISTA por planilla  sqy_v_<key>  con una columna por
 * encabezado, que es lo que DataTools consulta y enlaza por TAG.
 */
import pg from 'pg'

let pool = null
function getPool() {
  const url = process.env.SQY_DATABASE_URL
  if (!url) return null
  if (!pool) {
    pool = new pg.Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false }, // Supabase exige SSL
      max: 3,
      idleTimeoutMillis: 10000,
    })
  }
  return pool
}

export function dbEnabled() {
  return !!process.env.SQY_DATABASE_URL
}

// Nombre de vista seguro a partir de la key (solo a-z0-9_).
function viewName(key) {
  const safe = String(key).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50)
  return `sqy_v_${safe || 'x'}`
}
// Identificador SQL entre comillas dobles (columnas/vistas).
function ident(name) {
  return '"' + String(name).replace(/"/g, '""').slice(0, 63) + '"'
}
// Literal SQL de texto (comillas simples).
function lit(s) {
  return "'" + String(s).replace(/'/g, "''") + "'"
}

/**
 * Replica una planilla publicada en la base de datos y refresca su vista.
 * @param {{key:string,name?:string,tagField?:string,headers?:string[],rows?:object[]}} payload
 */
export async function upsertDatasetToDb(payload) {
  const pool = getPool()
  if (!pool) return { skipped: true }

  const { key } = payload
  const headers = Array.isArray(payload.headers) ? payload.headers : []
  const rows = Array.isArray(payload.rows) ? payload.rows : []
  const tagField = payload.tagField || headers[0]
  if (!key || !tagField) return { skipped: true, reason: 'sin key o tagField' }

  // Cada fila → { tag, data } (descarta filas sin TAG).
  const items = rows
    .map((r) => ({ tag: String(r[tagField] ?? '').trim(), data: r }))
    .filter((x) => x.tag)

  const client = await pool.connect()
  try {
    await client.query('begin')

    await client.query(`
      create table if not exists sqy_dataset_rows (
        dataset_key text not null,
        tag         text not null,
        data        jsonb not null,
        updated_at  timestamptz not null default now(),
        primary key (dataset_key, tag)
      )`)
    await client.query(
      'create index if not exists sqy_dataset_rows_key on sqy_dataset_rows(dataset_key)')

    // Reemplaza por completo las filas de esta planilla (maneja filas borradas).
    await client.query('delete from sqy_dataset_rows where dataset_key = $1', [key])
    if (items.length) {
      await client.query(
        `insert into sqy_dataset_rows (dataset_key, tag, data)
         select $1, x->>'tag', x->'data'
         from jsonb_array_elements($2::jsonb) as x
         on conflict (dataset_key, tag)
         do update set data = excluded.data, updated_at = now()`,
        [key, JSON.stringify(items)])
    }

    // (Re)crear la vista de la planilla: una columna por encabezado.
    const vname = viewName(key)
    await client.query(`drop view if exists ${ident(vname)}`)
    if (headers.length) {
      const cols = headers.map((h) => `data->>${lit(h)} as ${ident(h)}`).join(', ')
      await client.query(
        `create view ${ident(vname)} as
         select tag, ${cols}
         from sqy_dataset_rows
         where dataset_key = ${lit(key)}`)
    }

    await client.query('commit')
    return { ok: true, view: vname, rows: items.length }
  } catch (e) {
    try { await client.query('rollback') } catch {}
    throw e
  } finally {
    client.release()
  }
}
