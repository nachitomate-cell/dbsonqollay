/**
 * Registro de clientes (empresas) del plugin Aura BIM.
 *
 * Cada empresa que contrata Aura tiene:
 *   - id:     slug corto y estable (p. ej. "acme")
 *   - name:   nombre legible ("ACME Construcciones SpA")
 *   - key:    llave de DESCARGA (secreta) con la que baja SU instalador personalizado
 *             (GET /api/plugin/download?key=<key>)
 *   - token:  token que el plugin envía al backend para leer datasets
 *             (Authorization: Bearer <token>). Es lo que aísla a cada empresa.
 *   - baseUrl (opcional): backend propio si la empresa usa uno distinto.
 *   - active: false para revocar sin borrar (cliente moroso, llave filtrada).
 *
 * Fuente: variable de entorno PLUGIN_CLIENTS = JSON array. Ejemplo (en una línea):
 *   PLUGIN_CLIENTS=[{"id":"acme","name":"ACME SpA","key":"dl_ab12cd","token":"tok_9f7x","active":true}]
 *
 * Todavía sin base de datos a propósito: simple y suficiente para los primeros
 * clientes. Migrable a una tabla `clients` cuando el multi-tenant (Etapa 3) lo pida.
 */

/** Lee y parsea el registro desde PLUGIN_CLIENTS. Devuelve [] si no está o es inválido. */
export function loadClients() {
  const raw = process.env.PLUGIN_CLIENTS
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((c) => c && c.id) : []
  } catch (e) {
    console.error('[clients] PLUGIN_CLIENTS no es JSON válido:', e.message)
    return []
  }
}

/** Empresa activa por su llave de descarga, o null. */
export function clientByDownloadKey(key) {
  if (!key) return null
  return loadClients().find((c) => c.key === key && c.active !== false) || null
}

/** Tokens de plugin de todas las empresas activas (para autorizar la lectura). */
export function activeClientTokens() {
  return loadClients()
    .filter((c) => c.active !== false && c.token)
    .map((c) => c.token)
}
