/**
 * Notas de versión (changelog) de Aura GIP.
 *
 * Incluye TANTO la plataforma web (`scope: 'app'`) COMO el plugin de Navisworks
 * (`scope: 'plugin'`), para que el usuario vea todo en un solo lugar desde el
 * software (Header → botón "Novedades").
 *
 * Mantener al día en cada release. El plugin tiene además su propia copia de
 * SUS notas en `docs/navisworks-plugin/AuraBIM.cs` (lista `ReleaseNotes`), que se
 * muestra dentro del plugin. Al publicar una versión del plugin, actualizá ambos.
 *
 * Cada entrada: { version, date: 'YYYY-MM-DD', scope: 'app'|'plugin', title, items: [] }
 * Orden: el más reciente primero (el componente igual ordena por fecha).
 */
// Identificador de la novedad más reciente (fecha + scope + versión). Sirve para
// el "globo" del header: si difiere de lo último visto por el usuario, hay novedad.
export function latestReleaseKey() {
  let best = null
  for (const r of releaseNotes) if (!best || r.date > best.date) best = r
  return best ? `${best.date}|${best.scope}|${best.version}` : ''
}

export const releaseNotes = [
  // ───────── Plataforma web (app) ─────────
  {
    version: '0.6', date: '2026-06-15', scope: 'app', title: 'Nueva landing pública',
    items: [
      'Rediseño completo de la landing con imágenes propias (hero, showcase, “Cómo funciona”).',
      '“Contactar con la empresa” como acción principal; inicio de sesión más discreto.',
      'Vista previa al compartir el enlace (Open Graph) renovada.',
    ],
  },
  {
    version: '0.5', date: '2026-06-12', scope: 'app', title: 'Mejoras móviles',
    items: [
      'Banner de estado offline y edición por ficha al tocar una fila en el teléfono.',
      'Controles de la planilla colapsables para que la grilla quede visible en pantallas chicas.',
    ],
  },
  {
    version: '0.4', date: '2026-06-10', scope: 'app', title: 'Trabajo sin conexión',
    items: [
      'Caché durable en el navegador (IndexedDB) para planillas grandes.',
      'Cola de sincronización robusta con reintentos y aviso de última sincronización.',
      'Edición offline: tus cambios se guardan localmente y suben solos al reconectar.',
    ],
  },
  {
    version: '0.3', date: '2026-05-28', scope: 'app', title: 'Workspace AWP y auditoría',
    items: [
      'Workspace AWP: conecta componentes a CWA / CWP / IWP y mide la cobertura.',
      'Historial de modificaciones: quién cambió qué y cuándo.',
      'Detección de TAGs duplicados y elementos sin TAG.',
    ],
  },

  // ───────── Plugin de Navisworks ─────────
  {
    version: '1.25.0', date: '2026-06-16', scope: 'plugin', title: 'Cruce por la Capa nativa del modelo',
    items: [
      'El cruce con el modelo usa la "Capa" nativa (pestaña Elemento), no la pestaña BIM.',
      'Funciona en modelos sin propiedades previas (la capa viene directo del DWG).',
    ],
  },
  {
    version: '1.24.0', date: '2026-06-16', scope: 'plugin', title: 'Orden de columnas en la pestaña BIM',
    items: [
      'Las propiedades se escriben en el mismo orden de columnas que en la web.',
      'Reordenar una columna en la planilla reordena la pestaña BIM en el próximo sync.',
    ],
  },
  {
    version: '1.23.0', date: '2026-06-11', scope: 'plugin', title: 'Estabilidad y conjuntos',
    items: [
      'Creación de conjuntos de selección por TAG desde el modelo.',
      'Aviso automático cuando hay una versión nueva del plugin disponible.',
      'Acerca de: estado del servidor, token y pestaña BIM de un vistazo.',
    ],
  },
  {
    version: '1.8.0', date: '2026-06-04', scope: 'plugin', title: 'Ribbon propio “Aura GIP”',
    items: [
      'Pestaña “Aura GIP” en la cinta con botones “Asignar propiedades”, “Solo selección” y “Publicar”.',
      'Se distribuye como bundle e instalador, con desinstalación de la versión anterior.',
      '“Publicar a la nube” el modelo desde Navisworks (mismo nombre = nueva versión).',
    ],
  },
  {
    version: '1.7.0', date: '2026-05-20', scope: 'plugin', title: 'Sincronización por TAG',
    items: [
      'El plugin baja los datos publicados desde Aura GIP y los escribe en el modelo.',
      'Match por la propiedad BIM “TAG/Commodity” (independiente del idioma de Navisworks).',
      'Sin Excel: la fuente de datos pasa a ser la nube.',
    ],
  },
]
