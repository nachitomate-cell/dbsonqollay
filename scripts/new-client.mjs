/**
 * Genera la entrada de una empresa (cliente) para PLUGIN_CLIENTS.
 *
 * Uso:
 *   node scripts/new-client.mjs "ACME Construcciones SpA"
 *
 * Imprime un objeto JSON listo para agregar al array de PLUGIN_CLIENTS en Vercel.
 * `key`   = llave de descarga (la usa la web: /api/plugin/download?key=...)
 * `token` = token que el plugin envía al backend (Authorization: Bearer ...)
 */
import { randomBytes } from 'node:crypto'

const name = process.argv.slice(2).join(' ').trim()
if (!name) {
  console.error('Falta el nombre. Uso: node scripts/new-client.mjs "Nombre de la empresa"')
  process.exit(1)
}

const slug = name
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '') // sin tildes
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const rand = (n) => randomBytes(n).toString('base64url')

const entry = {
  id: slug || `empresa-${rand(3)}`,
  name,
  key: `dl_${rand(12)}`,
  token: `tok_${rand(18)}`,
  active: true,
}

console.log(JSON.stringify(entry))
console.error('\n↑ Agregá esta entrada al array de PLUGIN_CLIENTS (en una línea) en Vercel.')
console.error(`  Descarga: /api/plugin/download?key=${entry.key}`)
