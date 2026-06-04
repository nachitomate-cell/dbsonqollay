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
        count: realCount('arq'),
        dataKey: 'arq',
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
        count: realCount('can'),
        dataKey: 'can',
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
        count: realCount('mdt'),
        dataKey: 'mdt',
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
        count: realCount('cam'),
        dataKey: 'cam',
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
        name: 'Equipos EEL-01 (ELE)',
        icon: 'Server',
        description: 'Modelos y elementos relacionados con los equipos de suministro eléctrico.',
        count: realCount('eel01'),
        dataKey: 'eel01',
      },
      {
        id: 'ele-equipos-02',
        code: 'ELE',
        name: 'Equipos EEL-02 (ELE)',
        icon: 'Server',
        description: 'Modelos y elementos relacionados con los equipos de suministro eléctrico.',
        count: realCount('eel02'),
        dataKey: 'eel02',
      },
      {
        id: 'ele-equipos-03',
        code: 'ELE',
        name: 'Equipos EEL-03 (ELE)',
        icon: 'Server',
        description: 'Modelos y elementos relacionados con los equipos de suministro eléctrico.',
        count: realCount('eel03'),
        dataKey: 'eel03',
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
        count: realCount('ese'),
        dataKey: 'ese',
      },
      {
        id: 'ele-cables',
        code: 'CEE',
        name: 'Cables (CAB)',
        icon: 'Spline',
        description: 'Elementos relacionados con los cables de suministro eléctrico.',
        count: realCount('cab'),
        dataKey: 'cab',
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
        count: realCount('est'),
        dataKey: 'est',
      },
      {
        id: 'est-barandas',
        code: 'BAR',
        name: 'Barandas (BAR)',
        icon: 'Frame',
        description: 'Barandas industriales y elementos de protección en estructuras de acero.',
        count: realCount('bar'),
        dataKey: 'bar',
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
      'Concepto asociado a los elementos que no pertenecen a una disciplina en particular, pero que son requeridos para el diseño del proyecto.',
    subcategories: [
      {
        id: 'gen-topografia',
        code: 'TOP',
        name: 'Topografía (TOP)',
        icon: 'Map',
        description: 'Base topográfica del proyecto, incluidas sus posibles particiones o versiones.',
        count: 0,
      },
      {
        id: 'gen-cierres',
        code: 'CER',
        name: 'Cierres perimetrales (CER)',
        icon: 'Box',
        description: 'Cierres, cercos perimetrales y elementos de delimitación del proyecto.',
        count: realCount('cer'),
        dataKey: 'cer',
      },
      {
        id: 'gen-iex',
        code: 'IEX',
        name: 'Referencial e instalaciones existentes (IEX)',
        icon: 'Boxes',
        description:
          'Elementos referenciales necesarios para el diseño, como pueden ser maquinarias, espacios reservados u otros, e instalaciones existentes en terreno, en los cuales se incluyen modelos, nubes de punto y vectorizaciones de levantamientos en terreno.',
        count: 0,
      },
      {
        id: 'gen-erm',
        code: 'ERM',
        name: 'Espacios reservados para mantención (ERM)',
        icon: 'Box',
        description:
          'Reservas de espacio relacionados con la estimación requerida para la mantención de equipos y componentes.',
        count: 0,
      },
      {
        id: 'gen-ere',
        code: 'ERE',
        name: 'Espacios reservados para equipos móviles (ERE)',
        icon: 'Truck',
        description: 'Reservas de espacio relacionadas con el tránsito o movimientos de equipos.',
        count: 0,
      },
    ],
  },
  {
    id: 'instrumentacion',
    name: 'Instrumentación',
    icon: 'Gauge',
    description:
      'Disciplina encargada de los diseños asociados con la instrumentación, control, automatización y telecomunicaciones del proyecto.',
    subcategories: [
      {
        id: 'ins-instrumentos',
        code: 'INS',
        name: 'Instrumentos (INS)',
        icon: 'Gauge',
        description: 'Elementos relacionados con los instrumentos y sus componentes.',
        count: realCount('ins'),
        dataKey: 'ins',
      },
      {
        id: 'ins-equipos',
        code: 'AUT',
        name: 'Equipos (AUT)',
        icon: 'Cpu',
        description:
          'Modelos y elementos relacionados con los equipos de suministro de instrumentación y automatización industrial.',
        count: 0,
      },
      {
        id: 'ins-escalerillas',
        code: 'ESI',
        name: 'Escalerillas (ESI)',
        icon: 'Cable',
        description:
          'Modelos y elementos asociados con el diseño de escalerillas de suministro de instrumentación, control, automatización y telecomunicaciones, se incluyen soportes de estos elementos.',
        count: 0,
      },
      {
        id: 'ins-cables',
        code: 'CII',
        name: 'Cables (CII)',
        icon: 'Spline',
        description:
          'Elementos relacionados con los cables de suministro de instrumentación, control, automatización y telecomunicaciones.',
        count: 0,
      },
    ],
  },
  {
    id: 'mecanica',
    name: 'Mecánica',
    icon: 'Settings',
    description:
      'Disciplina encargada de los diseños asociados con los equipos mecánicos, distribución de elementos en la planta y consideraciones generales del proyecto.',
    subcategories: [
      {
        id: 'mec-equipos',
        code: 'MEC',
        name: 'Equipos (MEC)',
        icon: 'Cog',
        description:
          'Modelos y elementos asociados con el diseño de equipos mecánicos, incluyendo equipos rotativos, estáticos, de almacenamiento y todos los elementos relacionados.',
        count: realCount('mec'),
        dataKey: 'mec',
      },
      {
        id: 'mec-hvac',
        code: 'HVC',
        name: 'HVAC (HVC)',
        icon: 'Fan',
        description:
          'Elementos y modelos relacionados con el diseño de sistemas de Calefacción, ventilación y aire acondicionado; se incluyen los soportes del sistema.',
        count: 0,
      },
    ],
  },
  {
    id: 'sustentabilidad',
    name: 'Sustentabilidad',
    icon: 'Recycle',
    description: 'Disciplina encargada del diseño que tiene en cuenta los aspectos ambientales del proyecto.',
    subcategories: [
      {
        id: 'sus-rca',
        code: 'RCA',
        name: 'Resolución de calificación ambiental (RCA)',
        icon: 'FileCheck2',
        description:
          'Representación volumétrica del área aprobada (o en desarrollo) de la Resolución de Calificación Ambiental o RCA.',
        count: 0,
      },
      {
        id: 'sus-lbs',
        code: 'LBS',
        name: 'Línea base (LBS)',
        icon: 'Map',
        description:
          'Representación volumétrica del (las) área(s) que son utilizadas como línea base para los diseños de sustentabilidad.',
        count: 0,
      },
      {
        id: 'sus-pmf',
        code: 'PMF',
        name: 'Plan de manejo forestal (PMF)',
        icon: 'Sprout',
        description:
          'Representación gráfica de las áreas que son asociadas con el Plan de Manejo Forestal desarrollado para el proyecto.',
        count: 0,
      },
      {
        id: 'sus-csa',
        code: 'CSA',
        name: 'Caminos sancionatorios (CSA)',
        icon: 'Route',
        description:
          'Representación volumétrica de los caminos, senderos o plataformas que se encuentran en terreno (existentes) o que han sido aprobados por instancias anteriores.',
        count: 0,
      },
      {
        id: 'sus-bnp',
        code: 'BNP',
        name: 'Bosque nativo de preservación (BNP)',
        icon: 'TreePine',
        description:
          'Reserva de espacio relacionada con la individualización de especies forestales (y su entorno) que no pueden ser modificadas.',
        count: 0,
      },
      {
        id: 'sus-adi',
        code: 'ADI',
        name: 'Áreas y curvas de inundación (ADI)',
        icon: 'Waves',
        description:
          'Representación gráfica de las estimaciones de inundación para diferentes condiciones, se pueden incluir los comportamientos esperados/futuros de la cuenca.',
        count: 0,
      },
    ],
  },
  {
    id: 'academia',
    name: 'Academia',
    icon: 'GraduationCap',
    comingSoon: true,
    description: 'Formación y capacitación en AWP, BIM y gestión de proyectos de ingeniería.',
    subcategories: [],
  },
]

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
