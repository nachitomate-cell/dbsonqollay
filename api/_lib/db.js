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

  // Cada fila → { tag, data }. Dedupe por TAG (última fila gana): el modelo enlaza
  // 1 elemento ↔ 1 fila por TAG, y la PK (dataset_key, tag) no admite duplicados
  // (el bucket APS y la web conservan igualmente todas las filas).
  const byTag = new Map()
  for (const r of rows) {
    const tag = String(r[tagField] ?? '').trim()
    if (tag) byTag.set(tag, r)
  }
  const items = [...byTag.entries()].map(([tag, data]) => ({ tag, data }))

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
      // Encabezados únicos: una columna repetida rompe la creación de la vista.
      const seenH = new Set()
      const uniqHeaders = headers.filter((h) => { const k = String(h); if (seenH.has(k)) return false; seenH.add(k); return true })
      const cols = uniqHeaders.map((h) => `data->>${lit(h)} as ${ident(h)}`).join(', ')
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

/**
 * Menú de disciplinas/subcategorías desde la base de datos.
 *
 * Crea las tablas si no existen y, la PRIMERA vez (tabla vacía), las SIEMBRA con
 * la estructura estática que recibe (`seed`, de src/data/disciplinesStructure.js).
 * Después devuelve el árbol [{ id, name, icon, description, comingSoon,
 * subcategories:[{ id, code, name, icon, description, dataKey }] }].
 *
 * Es de SOLO LECTURA para la app: para cambiar el menú se edita la base
 * (sqy_disciplines / sqy_subcategories) directamente. Si la DB no está
 * configurada devuelve null y el front usa el menú estático.
 */
export async function ensureDisciplines(seed) {
  const pool = getPool()
  if (!pool) return null

  const client = await pool.connect()
  try {
    await client.query(`
      create table if not exists sqy_disciplines (
        id          text primary key,
        name        text not null,
        icon        text,
        description text,
        coming_soon boolean not null default false,
        sort_order  int not null default 0
      )`)
    await client.query(`
      create table if not exists sqy_subcategories (
        id            text primary key,
        discipline_id text not null references sqy_disciplines(id) on delete cascade,
        code          text,
        name          text not null,
        icon          text,
        description   text,
        data_key      text,
        sort_order    int not null default 0
      )`)
    await client.query(
      'create index if not exists sqy_subcategories_disc on sqy_subcategories(discipline_id)')

    // Siembra inicial: solo si la tabla está vacía (no pisa ediciones manuales).
    const { rows: cnt } = await client.query('select count(*)::int as n from sqy_disciplines')
    if (cnt[0].n === 0 && Array.isArray(seed) && seed.length) {
      await client.query('begin')
      try {
        let di = 0
        for (const d of seed) {
          await client.query(
            `insert into sqy_disciplines (id, name, icon, description, coming_soon, sort_order)
             values ($1,$2,$3,$4,$5,$6) on conflict (id) do nothing`,
            [d.id, d.name, d.icon || null, d.description || null, !!d.comingSoon, di++])
          let si = 0
          for (const s of (d.subcategories || [])) {
            await client.query(
              `insert into sqy_subcategories (id, discipline_id, code, name, icon, description, data_key, sort_order)
               values ($1,$2,$3,$4,$5,$6,$7,$8) on conflict (id) do nothing`,
              [s.id, d.id, s.code || null, s.name, s.icon || null, s.description || null, s.dataKey || null, si++])
          }
        }
        await client.query('commit')
      } catch (e) {
        try { await client.query('rollback') } catch {}
        throw e
      }
    }

    // Lectura del árbol, respetando el orden (sort_order).
    const { rows: ds } = await client.query(
      'select id, name, icon, description, coming_soon from sqy_disciplines order by sort_order, name')
    const { rows: subs } = await client.query(
      'select id, discipline_id, code, name, icon, description, data_key from sqy_subcategories order by discipline_id, sort_order, name')

    const byId = new Map()
    const tree = ds.map((d) => {
      const node = {
        id: d.id, name: d.name, icon: d.icon || undefined,
        description: d.description || undefined,
        ...(d.coming_soon ? { comingSoon: true } : {}),
        subcategories: [],
      }
      byId.set(d.id, node)
      return node
    })
    for (const s of subs) {
      const parent = byId.get(s.discipline_id)
      if (!parent) continue
      parent.subcategories.push({
        id: s.id, code: s.code || undefined, name: s.name,
        icon: s.icon || undefined, description: s.description || undefined,
        ...(s.data_key ? { dataKey: s.data_key } : {}),
      })
    }
    return tree
  } finally {
    client.release()
  }
}

/** Borra una planilla de la base de datos: su vista y sus filas. */
export async function deleteDatasetFromDb(key) {
  const pool = getPool()
  if (!pool) return { skipped: true }
  if (!key) return { skipped: true, reason: 'sin key' }
  const client = await pool.connect()
  try {
    await client.query(`drop view if exists ${ident(viewName(key))}`)
    const r = await client.query('delete from sqy_dataset_rows where dataset_key = $1', [key])
    return { ok: true, deleted: r.rowCount }
  } finally {
    client.release()
  }
}
