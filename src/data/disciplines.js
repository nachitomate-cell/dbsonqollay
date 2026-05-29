import engineering from './engineering.json'
import { mockDatasets } from './mock.js'

/**
 * Estructura de navegación de Sonqollay.
 *
 * Cada disciplina agrupa subcategorías. Una subcategoría puede apuntar a un
 * dataset real (`dataKey` -> clave dentro de engineering.json) o ser un
 * placeholder (sin datos todavía). El badge de "Total de elementos" se calcula
 * automáticamente desde los datos reales cuando existe `dataKey`.
 */

// Datasets reales (Excel SQY_*) combinados con datos mock de demostración.
export const datasets = { ...engineering, ...mockDatasets }

const realCount = (key) => (datasets[key] ? datasets[key].count : 0)

export const disciplines = [
  {
    id: 'arquitectura',
    name: 'Arquitectura',
    icon: 'Building2',
    subcategories: [
      { id: 'arq-terminaciones', code: 'ARQ', name: 'Terminaciones', icon: 'PaintRoller', description: 'Revestimientos, cielos y terminaciones arquitectónicas.', count: 0 },
      { id: 'arq-tabiqueria', code: 'TAB', name: 'Tabiquería', icon: 'LayoutPanelLeft', description: 'Muros divisorios y tabiques interiores.', count: 0 },
    ],
  },
  {
    id: 'canerias',
    name: 'Cañerías',
    icon: 'Pipette',
    subcategories: [
      { id: 'pip-spools', code: 'PIP', name: 'Spools (PIP)', icon: 'GitBranch', description: 'Carretes de cañería prefabricados.', count: 0 },
      { id: 'pip-soportes', code: 'SOP', name: 'Soportería (SOP)', icon: 'Anchor', description: 'Soportes y anclajes de cañería.', count: 0 },
      { id: 'pip-valvulas', code: 'VAL', name: 'Válvulas (VAL)', icon: 'Gauge', description: 'Válvulas e instrumentación en línea.', count: 0 },
    ],
  },
  {
    id: 'civil',
    name: 'Civil - Mov. de Tierra',
    icon: 'Mountain',
    subcategories: [
      { id: 'civ-excavacion', code: 'EXC', name: 'Excavaciones (EXC)', icon: 'Shovel', description: 'Volúmenes de excavación y movimiento de tierra.', count: 0 },
      { id: 'civ-relleno', code: 'REL', name: 'Rellenos (REL)', icon: 'Layers', description: 'Rellenos compactados y estructurales.', count: 0 },
    ],
  },
  {
    id: 'electrico',
    name: 'Eléctrico',
    icon: 'Zap',
    subcategories: [
      { id: 'ele-equipos', code: 'ELE', name: 'Equipos (ELE)', icon: 'Server', description: 'Equipos eléctricos de potencia y respaldo.', count: 39, dataKey: 'ele_mock' },
      { id: 'ele-alumbrado', code: 'ALU', name: 'Alumbrado (ALU)', icon: 'Lightbulb', description: 'Luminarias, postes y sistemas de iluminación.', count: realCount('alu'), dataKey: 'alu' },
      { id: 'ele-escalerillas', code: 'ESE', name: 'Escalerillas (ESE)', icon: 'Cable', description: 'Bandejas y escalerillas portacables.', count: 0 },
      { id: 'ele-cables', code: 'CEE', name: 'Cables (CEE)', icon: 'Spline', description: 'Cables de poder, control e instrumentación.', count: 0 },
    ],
  },
  {
    id: 'estructura',
    name: 'Estructura',
    icon: 'Frame',
    subcategories: [
      { id: 'est-hormigon', code: 'HOR', name: 'Hormigón (HOR)', icon: 'Boxes', description: 'Fundaciones, radieres y estructuras de hormigón.', count: realCount('hor'), dataKey: 'hor' },
      { id: 'est-acero', code: 'EST', name: 'Acero Estructural (EST)', icon: 'Frame', description: 'Perfilería, conexiones y montaje de acero.', count: 0 },
    ],
  },
  {
    id: 'general',
    name: 'General',
    icon: 'LayoutGrid',
    subcategories: [
      { id: 'gen-documentos', code: 'DOC', name: 'Control Documental', icon: 'FileText', description: 'Planos, especificaciones y entregables.', count: 0 },
      { id: 'gen-awp', code: 'AWP', name: 'Paquetes AWP', icon: 'PackageCheck', description: 'CWP / EWP / IWP — empaquetamiento de trabajo.', count: 0 },
    ],
  },
  {
    id: 'instrumentacion',
    name: 'Instrumentación',
    icon: 'Activity',
    subcategories: [
      { id: 'ins-campo', code: 'INS', name: 'Instrumentos (INS)', icon: 'Gauge', description: 'Transmisores, sensores y elementos de campo.', count: 0 },
      { id: 'ins-control', code: 'CTL', name: 'Control (CTL)', icon: 'Cpu', description: 'Lazos de control y arquitectura de automatización.', count: 0 },
    ],
  },
  {
    id: 'mecanica',
    name: 'Mecánica',
    icon: 'Cog',
    subcategories: [
      { id: 'mec-equipos', code: 'MEC', name: 'Equipos Mecánicos (MEC)', icon: 'Cog', description: 'Bombas, acumuladores y equipos rotativos/estáticos.', count: realCount('mec'), dataKey: 'mec' },
      { id: 'mec-fijos', code: 'FIJ', name: 'Equipos Fijos (FIJ)', icon: 'Container', description: 'Estanques, recipientes a presión e intercambiadores.', count: 0 },
    ],
  },
  {
    id: 'sustentabilidad',
    name: 'Sustentabilidad',
    icon: 'Leaf',
    subcategories: [
      { id: 'sus-ambiental', code: 'AMB', name: 'Ambiental (AMB)', icon: 'Leaf', description: 'Medidas ambientales y permisos sectoriales.', count: 0 },
    ],
  },
]

/** Devuelve la disciplina por id. */
export const getDiscipline = (id) => disciplines.find((d) => d.id === id) || null

/** Devuelve { discipline, subcategory } a partir de un id de subcategoría. */
export function findSubcategory(subId) {
  for (const d of disciplines) {
    const s = d.subcategories.find((sc) => sc.id === subId)
    if (s) return { discipline: d, subcategory: s }
  }
  return null
}
