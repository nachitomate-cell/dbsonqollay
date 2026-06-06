/**
 * Migración única: pasa a MAYÚSCULAS todos los valores de texto ya guardados en
 * la base (tabla sqy_dataset_rows). Alinea los datos viejos con la regla de
 * negocio "todo lo ingresado en las planillas va en mayúscula".
 *
 * Qué hace:
 *   1) Reescribe `data` (jsonb) poniendo en MAYÚSCULAS cada valor de tipo texto.
 *      Números, booleanos, null y objetos/arrays se dejan intactos.
 *   2) Pasa a MAYÚSCULAS la columna `tag` (la clave de enlace con el modelo),
 *      SALVO cuando colisionaría con otro tag ya existente del mismo dataset
 *      (la PK (dataset_key, tag) no admite duplicados). Esas colisiones se
 *      reportan y se dejan sin tocar para no perder filas.
 *   Las vistas sqy_v_<key> leen `data->>encabezado`, así que reflejan el cambio
 *   automáticamente: no hace falta recrearlas.
 *
 * Uso:
 *   node scripts/uppercase-rows.mjs --dry-run   # solo muestra qué cambiaría
 *   node scripts/uppercase-rows.mjs             # aplica los cambios
 *
 * Requiere SQY_DATABASE_URL (se lee de .env si existe).
 */
import 'dotenv/config'
import pg from 'pg'

const DRY = process.argv.includes('--dry-run')
const url = process.env.SQY_DATABASE_URL
if (!url) {
  console.error('Falta SQY_DATABASE_URL (definila en .env o en el entorno).')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 3 })

// Reescribe un objeto jsonb con sus valores de texto en MAYÚSCULAS.
const UPPER_DATA = `(
  select coalesce(jsonb_object_agg(
    k,
    case when jsonb_typeof(v) = 'string' then to_jsonb(upper(v #>> '{}')) else v end
  ), '{}'::jsonb)
  from jsonb_each(data) as e(k, v)
)`

const client = await pool.connect()
try {
  const { rows: tbl } = await client.query(
    `select to_regclass('public.sqy_dataset_rows') as t`)
  if (!tbl[0].t) {
    console.log('La tabla sqy_dataset_rows no existe todavía: nada que migrar.')
    process.exit(0)
  }

  const { rows: tot } = await client.query('select count(*)::int as n from sqy_dataset_rows')
  console.log(`Filas totales: ${tot[0].n}`)

  // ¿Cuántas filas tienen al menos un valor de texto que cambiaría?
  const { rows: dataDiff } = await client.query(
    `select count(*)::int as n from sqy_dataset_rows where data is distinct from ${UPPER_DATA}`)
  console.log(`Filas con texto a convertir en data: ${dataDiff[0].n}`)

  // Tags que cambiarían y cuáles colisionan (se omiten).
  const { rows: tagChange } = await client.query(
    `select count(*)::int as n from sqy_dataset_rows where tag <> upper(tag)`)
  const { rows: tagConflict } = await client.query(`
    select s.dataset_key, s.tag, upper(s.tag) as upper_tag
    from sqy_dataset_rows s
    where s.tag <> upper(s.tag)
      and exists (
        select 1 from sqy_dataset_rows t
        where t.dataset_key = s.dataset_key
          and t.tag = upper(s.tag)
          and t.tag <> s.tag
      )
    order by s.dataset_key, s.tag`)
  console.log(`Tags a convertir: ${tagChange[0].n} (en conflicto, se omiten: ${tagConflict.length})`)
  if (tagConflict.length) {
    console.log('  Tags omitidos por colisión (dataset_key | tag → UPPER):')
    for (const r of tagConflict) console.log(`   - ${r.dataset_key} | ${r.tag} → ${r.upper_tag}`)
  }

  if (DRY) {
    console.log('\n[dry-run] No se aplicó ningún cambio.')
    process.exit(0)
  }

  await client.query('begin')

  const upData = await client.query(
    `update sqy_dataset_rows
     set data = ${UPPER_DATA}, updated_at = now()
     where data is distinct from ${UPPER_DATA}`)

  // Solo los tags que NO colisionan con un tag ya en mayúsculas del mismo dataset.
  const upTag = await client.query(`
    update sqy_dataset_rows s
    set tag = upper(s.tag), updated_at = now()
    where s.tag <> upper(s.tag)
      and not exists (
        select 1 from sqy_dataset_rows t
        where t.dataset_key = s.dataset_key
          and t.tag = upper(s.tag)
          and t.tag <> s.tag
      )`)

  await client.query('commit')
  console.log(`\nListo. data actualizado en ${upData.rowCount} fila(s); tag en ${upTag.rowCount} fila(s).`)
  if (tagConflict.length) {
    console.log(`Quedaron ${tagConflict.length} tag(s) sin convertir por colisión (ver arriba); su data SÍ quedó en mayúsculas.`)
  }
} catch (e) {
  try { await client.query('rollback') } catch {}
  console.error('Error en la migración:', e.message)
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
