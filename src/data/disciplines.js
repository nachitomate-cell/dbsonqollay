import engineering from './engineering.json'
import { mockDatasets } from './mock.js'

/**
 * Estructura de navegación de Sonqollay.
 *
 * Cada disciplina tiene una `description` (banner informativo) y agrupa
 * subcategorías. Una subcategoría puede apuntar a un dataset real
 * (`dataKey` -> clave dentro de engineering.json / mock.js) o no tener datos.
 * El badge de "Total de elementos" se calcula desde los datos reales.
 *
 * Textos y subcategorías replican la plataforma de referencia.
 */

// Datasets reales (Excel SQY_*) combinados con datos mock de demostración.
export const datasets = { ...engineering, ...mockDatasets }

const realCount = (key) => (datasets[key] ? datasets[key].count : 0)

export const disciplines = [
  {
    id: 'arquitectura',
    name: 'Arquitectura',
    icon: 'Building2',
    description:
      'Disciplina encargada de los diseños arquitectónicos del proyecto, los cuales incluyen los requerimientos de espacio, materialidad y armonía con el entorno, entre otros, cumpliendo las especificaciones del proyecto y normativa vigente.',
    subcategories: [
      {
        id: 'arq-arquitectura',
        code: 'ARQ',
        name: 'Arquitectura (ARQ)',
        icon: 'Building2',
        description: 'Modelos y elementos relacionados con Arquitectura.',
        count: 0,
      },
    ],
  },
  {
    id: 'canerias',
    name: 'Cañerías',
    icon: 'Pipette',
    description: 'Disciplina encargada del diseño del sistema de tuberías del proyecto.',
    subcategories: [
      {
        id: 'pip-canerias',
        code: 'CAN',
        name: 'Cañerías (CAN)',
        icon: 'Pipette',
        description:
          'Modelos, elementos y geometrías relacionadas con el diseño de tuberías, en el que se incluyen válvulas e ítems propios de cañerías.',
        count: 0,
      },
      {
        id: 'pip-soportes',
        code: 'SCA',
        name: 'Soportes de cañerías (SCA)',
        icon: 'Anchor',
        description: 'Elementos de soportación de cañerías incluidos soportes especiales o no estándares.',
        count: 0,
      },
    ],
  },
  {
    id: 'civil',
    name: 'Civil - Mov. de tierra',
    icon: 'Mountain',
    description:
      'Disciplina encargada de los diseños de movimientos de tierras que son requeridos para cumplir los objetivos del proyecto.',
    subcategories: [
      {
        id: 'civ-mdt',
        code: 'MDT',
        name: 'Movimientos de tierra (MDT)',
        icon: 'Pickaxe',
        description:
          'Obras relacionadas con los movimientos de tierras que no tienen una definición particular, por ejemplo acopio de material o espacio reservado.',
        count: 0,
      },
      {
        id: 'civ-frt',
        code: 'FRT',
        name: 'Fortificaciones (FRT)',
        icon: 'Construction',
        description:
          'Elementos diseñados para la contención que son requeridas por otras obras, como por ejemplo taludes, caminos o túneles.',
        count: 0,
      },
      {
        id: 'civ-mur',
        code: 'MUR',
        name: 'Muros (MUR)',
        icon: 'BrickWall',
        description: 'Obra relacionada con la contención de la laguna de relaves.',
        count: 0,
      },
      {
        id: 'civ-cam',
        code: 'CAM',
        name: 'Caminos (CAM)',
        icon: 'Route',
        description:
          'Obras desarrolladas para el acceso a las obras ya sea para la construcción, operación o accesos generales.',
        count: 0,
      },
      {
        id: 'civ-geo',
        code: 'GEO',
        name: 'Geosintético (GEO)',
        icon: 'Layers',
        description:
          'Se refiere a un material sintético utilizado como revestimiento o barrera en diversas aplicaciones ambientales y de construcción.',
        count: 0,
      },
      {
        id: 'civ-yac',
        code: 'YAC',
        name: 'Yacimientos (YAC)',
        icon: 'Truck',
        description:
          'Elementos gráficos relacionados con el diseño de yacimiento, espacios, acopios, proyecciones futuras y otros.',
        count: 0,
      },
    ],
  },
  {
    id: 'electrico',
    name: 'Eléctrico',
    icon: 'Zap',
    description:
      'Disciplina encargada del diseño del sistema eléctrico del proyecto, incluyendo componentes eléctricos, de iluminación y de suministro, entre otros.',
    subcategories: [
      {
        id: 'ele-equipos',
        code: 'ELE',
        name: 'Equipos (ELE)',
        icon: 'Server',
        description: 'Modelos y elementos relacionados con los equipos de suministro eléctrico.',
        count: realCount('ele_mock'),
        dataKey: 'ele_mock',
      },
      {
        id: 'ele-alumbrado',
        code: 'ALU',
        name: 'Alumbrado (ALU)',
        icon: 'Lightbulb',
        description: 'Elementos gráficos relacionados con el diseño de Alumbrado.',
        count: realCount('alu'),
        dataKey: 'alu',
      },
      {
        id: 'ele-escalerillas',
        code: 'ESE',
        name: 'Escalerillas (ESE)',
        icon: 'Cable',
        description:
          'Modelos y elementos asociados con el diseño de escalerillas de suministro eléctrico, en el que se incluyen soportes de estos elementos.',
        count: 0,
      },
      {
        id: 'ele-cables',
        code: 'CEE',
        name: 'Cables (CEE)',
        icon: 'Spline',
        description: 'Elementos relacionados con los cables de suministro eléctrico.',
        count: 0,
      },
    ],
  },
  {
    id: 'estructura',
    name: 'Estructura',
    icon: 'Frame',
    description: 'Disciplina encargada de los diseños estructurales de obras, instalaciones y equipos.',
    subcategories: [
      {
        id: 'est-hormigon',
        code: 'HOR',
        name: 'Hormigón (HOR)',
        icon: 'Boxes',
        description: 'Elementos y Modelos relacionados con el diseño de estructuras de hormigón, soportes y fundaciones.',
        count: realCount('hor'),
        dataKey: 'hor',
      },
      {
        id: 'est-acero',
        code: 'EST',
        name: 'Acero (EST)',
        icon: 'Frame',
        description: 'Elementos y modelos relacionados con el diseño de estructuras de Acero.',
        count: 0,
      },
      {
        id: 'est-armaduras',
        code: 'ARM',
        name: 'Armaduras (ARM)',
        icon: 'Grid3x3',
        description: 'Elementos gráficos relacionados con las armaduras de hormigones.',
        count: 0,
      },
    ],
  },
  {
    id: 'general',
    name: 'General',
    icon: 'Box',
    description:
      'Disciplina transversal que agrupa elementos generales, control documental y empaquetamiento de trabajo (AWP) del proyecto.',
    subcategories: [
      {
        id: 'gen-documentos',
        code: 'DOC',
        name: 'Control Documental (DOC)',
        icon: 'FileText',
        description: 'Planos, especificaciones y entregables del proyecto.',
        count: 0,
      },
      {
        id: 'gen-awp',
        code: 'AWP',
        name: 'Paquetes AWP (AWP)',
        icon: 'PackageCheck',
        description: 'CWA / CWP / EWP / IWP — empaquetamiento de trabajo (Advanced Work Packaging).',
        count: 0,
      },
    ],
  },
  {
    id: 'instrumentacion',
    name: 'Instrumentación',
    icon: 'Gauge',
    description: 'Disciplina encargada del diseño del sistema de instrumentación y control del proyecto.',
    subcategories: [
      {
        id: 'ins-campo',
        code: 'INS',
        name: 'Instrumentos (INS)',
        icon: 'Gauge',
        description: 'Transmisores, sensores y elementos de campo.',
        count: 0,
      },
      {
        id: 'ins-control',
        code: 'CTL',
        name: 'Control (CTL)',
        icon: 'Cpu',
        description: 'Lazos de control y arquitectura de automatización.',
        count: 0,
      },
    ],
  },
  {
    id: 'mecanica',
    name: 'Mecánica',
    icon: 'Settings',
    description: 'Disciplina encargada del diseño de equipos mecánicos del proyecto.',
    subcategories: [
      {
        id: 'mec-equipos',
        code: 'MEC',
        name: 'Equipos Mecánicos (MEC)',
        icon: 'Cog',
        description: 'Bombas, acumuladores y equipos rotativos/estáticos.',
        count: realCount('mec'),
        dataKey: 'mec',
      },
      {
        id: 'mec-fijos',
        code: 'FIJ',
        name: 'Equipos Fijos (FIJ)',
        icon: 'Container',
        description: 'Estanques, recipientes a presión e intercambiadores.',
        count: 0,
      },
    ],
  },
  {
    id: 'sustentabilidad',
    name: 'Sustentabilidad',
    icon: 'Recycle',
    description: 'Disciplina encargada de las medidas ambientales y de sustentabilidad del proyecto.',
    subcategories: [
      {
        id: 'sus-ambiental',
        code: 'AMB',
        name: 'Ambiental (AMB)',
        icon: 'Leaf',
        description: 'Medidas ambientales y permisos sectoriales.',
        count: 0,
      },
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
