import engineering from './engineering.json'
import { mockDatasets } from './mock.js'
import { disciplinesStructure } from './disciplinesStructure.js'

/**
 * Estructura de navegación de Sonqollay.
 *
 * La jerarquía (disciplinas → subcategorías) vive en `disciplinesStructure.js`
 * (fuente única, sin conteos). Aquí le adjuntamos el `count` real calculado desde
 * los datasets. Una subcategoría puede apuntar a un dataset real (`dataKey` ->
 * clave dentro de engineering.json / mock.js) o no tener datos.
 *
 * El menú puede venir de la base de datos (GET /api/disciplines, ver
 * useDisciplines.js); si la DB no está disponible se usa esta versión estática
 * como respaldo. En ambos casos los conteos se adjuntan con `withCounts`.
 */

// Datasets reales (Excel SQY_*) combinados con datos mock de demostración.
export const datasets = { ...engineering, ...mockDatasets }

const realCount = (key) => (datasets[key] ? datasets[key].count : 0)

/**
 * Adjunta el conteo real (desde `datasets`) a cada subcategoría de una estructura
 * de disciplinas, venga del menú estático o de la base de datos. Mantiene el
 * resto de los campos intactos.
 */
export function withCounts(structure) {
  return (structure || []).map((d) => ({
    ...d,
    subcategories: (d.subcategories || []).map((s) => ({
      ...s,
      count: s.dataKey ? realCount(s.dataKey) : (s.count ?? 0),
    })),
  }))
}

// Menú estático (respaldo): la estructura con sus conteos reales adjuntos.
export const disciplines = withCounts(disciplinesStructure)

/** Devuelve la disciplina por id. */
export const getDiscipline = (id) => disciplines.find((d) => d.id === id) || null

/**
 * Columnas por defecto para una planilla nueva (subcategoría sin datos).
 * Siguen el modelo de ingeniería AWP/BIM usado en el resto de la plataforma.
 */
export const defaultColumns = [
  'TAG',
  'DESCRIPCIÓN_GENERAL',
  'DESCRIPCIÓN_COMPLEMENTARIA',
  'ESTADO_APROBACIÓN',
  'ESTADO_AVANCE',
  'ESPECIALIDAD',
  'COSTO',
  'PESO',
  'SECTOR_OBRA',
  'CONTRATO_CONSTRUCCIÓN',
  'WBS',
  'CWA',
  'CWP',
  'EWP',
  'PWP',
  'IWP',
]

/** Dataset vacío con columnas (las dadas o las por defecto) para una planilla nueva. */
export const emptyDataset = (columns) => ({
  headers: columns && columns.length ? [...columns] : [...defaultColumns],
  rows: [],
  count: 0,
})

/** Devuelve { discipline, subcategory } a partir de un id de subcategoría. */
export function findSubcategory(subId) {
  for (const d of disciplines) {
    const s = d.subcategories.find((sc) => sc.id === subId)
    if (s) return { discipline: d, subcategory: s }
  }
  return null
}
