/**
 * Prepara el instalador del plugin Aura GIP para descargarlo DESDE el backend
 * (no desde un link público de GitHub). Así el repositorio puede ser privado y
 * cada empresa baja un instalador con SU token inyectado.
 *
 * Flujo:
 *   1) fetchTemplate(): trae el ZIP "plantilla" (AuraBIM-instalador.zip) de la
 *      última GitHub Release del repo PRIVADO, usando un token de servidor.
 *      Se cachea en memoria un rato para no pegarle a GitHub en cada descarga.
 *   2) personalizeZip(): abre el ZIP, reemplaza el apiToken (y baseUrl si aplica)
 *      en AuraBIM.bundle/Contents/AuraBIM.config.json y devuelve el ZIP nuevo.
 *
 * Variables de entorno (en el proyecto Vercel):
 *   GITHUB_TOKEN          PAT con permiso de lectura del repo privado (Contents: read)
 *   PLUGIN_REPO           "owner/repo"            (def: nachitomate-cell/dbsonqollay)
 *   PLUGIN_ASSET          nombre del asset        (def: AuraBIM-instalador.zip)
 *   PLUGIN_CACHE_TTL_MS   cache del template (ms) (def: 600000 = 10 min)
 *   PLUGIN_TEMPLATE_PATH  (opcional) ruta local a un ZIP, para desarrollo/pruebas
 */
import AdmZip from 'adm-zip'

const REPO = process.env.PLUGIN_REPO || 'nachitomate-cell/dbsonqollay'
const ASSET = process.env.PLUGIN_ASSET || 'AuraBIM-instalador.zip'
const TTL = Number(process.env.PLUGIN_CACHE_TTL_MS || 600_000)

let cached = null // { buf: Buffer, at: number }

/** Trae el ZIP plantilla (cacheado). Lanza si no hay forma de obtenerlo. */
export async function fetchTemplate() {
  if (cached && Date.now() - cached.at < TTL) return cached.buf

  // Atajo para desarrollo: servir un ZIP local en vez de bajarlo de GitHub.
  const localPath = process.env.PLUGIN_TEMPLATE_PATH
  if (localPath) {
    const { readFile } = await import('node:fs/promises')
    const buf = await readFile(localPath)
    cached = { buf, at: Date.now() }
    return buf
  }

  const ghToken = process.env.GITHUB_TOKEN || process.env.PLUGIN_REPO_TOKEN
  if (!ghToken) {
    throw new Error('Falta GITHUB_TOKEN (o PLUGIN_TEMPLATE_PATH) para obtener el instalador.')
  }
  const headers = {
    Authorization: `Bearer ${ghToken}`,
    'User-Agent': 'aura-bim-backend',
    Accept: 'application/vnd.github+json',
  }

  // 1) última release → buscar el asset por nombre
  const relRes = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers })
  if (!relRes.ok) throw new Error(`GitHub releases/latest falló (${relRes.status})`)
  const rel = await relRes.json()
  const asset = (rel.assets || []).find((a) => a.name === ASSET)
  if (!asset) throw new Error(`No se encontró el asset "${ASSET}" en la última release de ${REPO}.`)

  // 2) descargar el binario del asset (octet-stream sigue el redirect a S3)
  const dl = await fetch(`https://api.github.com/repos/${REPO}/releases/assets/${asset.id}`, {
    headers: { ...headers, Accept: 'application/octet-stream' },
  })
  if (!dl.ok) throw new Error(`Descarga del asset falló (${dl.status})`)
  const buf = Buffer.from(await dl.arrayBuffer())
  cached = { buf, at: Date.now() }
  return buf
}

/**
 * Devuelve un ZIP nuevo con el token (y baseUrl) del cliente inyectados en
 * AuraBIM.config.json. No muta el buffer original.
 */
export function personalizeZip(buffer, { apiToken, baseUrl } = {}) {
  const zip = new AdmZip(buffer)
  const entry = zip
    .getEntries()
    .find((e) => /(^|\/)AuraBIM\.config\.json$/i.test(e.entryName))
  if (!entry) throw new Error('El instalador no contiene AuraBIM.config.json.')

  let cfg
  try {
    cfg = JSON.parse(zip.readAsText(entry))
  } catch {
    cfg = {}
  }
  if (apiToken) cfg.apiToken = apiToken
  if (baseUrl) cfg.baseUrl = baseUrl

  zip.updateFile(entry, Buffer.from(JSON.stringify(cfg, null, 2)))
  return zip.toBuffer()
}
