/**
 * Estructura pura del menú de Sonqollay (disciplinas → subcategorías), SIN
 * conteos ni datos. Es la fuente única de la jerarquía de navegación:
 *
 *  - El frontend la usa como menú estático de respaldo (`disciplines.js` le
 *    adjunta el `count` real con `withCounts`).
 *  - El backend la usa para SEMBRAR la tabla del menú en la base de datos la
 *    primera vez (ver `api/_lib/db.js` → `ensureDisciplines`).
 *
 * Por eso este archivo NO importa `engineering.json` ni `mock.js`: debe ser
 * liviano para poder importarse también desde una función serverless.
 *
 * Campos:
 *  - disciplina:    { id, name, icon, description, comingSoon?, subcategories[] }
 *  - subcategoría:  { id, code, name, icon, description, dataKey? }
 *    `dataKey` enlaza con un dataset real (engineering.json / mock.js).
 */
export const disciplinesStructure = [
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
        dataKey: 'can',
      },
      {
        id: 'pip-soportes',
        code: 'SCA',
        name: 'Soportes de cañerías (SCA)',
        icon: 'Anchor',
        description: 'Elementos de soportación de cañerías incluidos soportes especiales o no estándares.',
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
        dataKey: 'mdt',
      },
      {
        id: 'civ-frt',
        code: 'FRT',
        name: 'Fortificaciones (FRT)',
        icon: 'Construction',
        description:
          'Elementos diseñados para la contención que son requeridas por otras obras, como por ejemplo taludes, caminos o túneles.',
      },
      {
        id: 'civ-mur',
        code: 'MUR',
        name: 'Muros (MUR)',
        icon: 'BrickWall',
        description: 'Obra relacionada con la contención de la laguna de relaves.',
      },
      {
        id: 'civ-cam',
        code: 'CAM',
        name: 'Caminos (CAM)',
        icon: 'Route',
        description:
          'Obras desarrolladas para el acceso a las obras ya sea para la construcción, operación o accesos generales.',
        dataKey: 'cam',
      },
      {
        id: 'civ-geo',
        code: 'GEO',
        name: 'Geosintético (GEO)',
        icon: 'Layers',
        description:
          'Se refiere a un material sintético utilizado como revestimiento o barrera en diversas aplicaciones ambientales y de construcción.',
      },
      {
        id: 'civ-yac',
        code: 'YAC',
        name: 'Yacimientos (YAC)',
        icon: 'Truck',
        description:
          'Elementos gráficos relacionados con el diseño de yacimiento, espacios, acopios, proyecciones futuras y otros.',
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
        description: 'Modelos y elementos relacionados con los equipos de suministro eléctrico (EEL-01/02/03 unificados).',
        dataKey: 'ele',
      },
      {
        id: 'ele-alumbrado',
        code: 'ALU',
        name: 'Alumbrado (ALU)',
        icon: 'Lightbulb',
        description: 'Elementos gráficos relacionados con el diseño de Alumbrado.',
        dataKey: 'alu',
      },
      {
        id: 'ele-escalerillas',
        code: 'ESE',
        name: 'Escalerillas (ESE)',
        icon: 'Cable',
        description:
          'Modelos y elementos asociados con el diseño de escalerillas de suministro eléctrico, en el que se incluyen soportes de estos elementos.',
        dataKey: 'ese',
      },
      {
        id: 'ele-cables',
        code: 'CEE',
        name: 'Cables (CAB)',
        icon: 'Spline',
        description: 'Elementos relacionados con los cables de suministro eléctrico.',
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
        dataKey: 'hor',
      },
      {
        id: 'est-acero',
        code: 'EST',
        name: 'Acero (EST)',
        icon: 'Frame',
        description: 'Elementos y modelos relacionados con el diseño de estructuras de Acero.',
        dataKey: 'est',
      },
      {
        id: 'est-barandas',
        code: 'BAR',
        name: 'Barandas (BAR)',
        icon: 'Frame',
        description: 'Barandas industriales y elementos de protección en estructuras de acero.',
        dataKey: 'bar',
      },
      {
        id: 'est-armaduras',
        code: 'ARM',
        name: 'Armaduras (ARM)',
        icon: 'Grid3x3',
        description: 'Elementos gráficos relacionados con las armaduras de hormigones.',
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
      },
      {
        id: 'gen-cierres',
        code: 'CER',
        name: 'Cierres perimetrales (CER)',
        icon: 'Box',
        description: 'Cierres, cercos perimetrales y elementos de delimitación del proyecto.',
        dataKey: 'cer',
      },
      {
        id: 'gen-iex',
        code: 'IEX',
        name: 'Referencial e instalaciones existentes (IEX)',
        icon: 'Boxes',
        description:
          'Elementos referenciales necesarios para el diseño, como pueden ser maquinarias, espacios reservados u otros, e instalaciones existentes en terreno, en los cuales se incluyen modelos, nubes de punto y vectorizaciones de levantamientos en terreno.',
      },
      {
        id: 'gen-erm',
        code: 'ERM',
        name: 'Espacios reservados para mantención (ERM)',
        icon: 'Box',
        description:
          'Reservas de espacio relacionados con la estimación requerida para la mantención de equipos y componentes.',
      },
      {
        id: 'gen-ere',
        code: 'ERE',
        name: 'Espacios reservados para equipos móviles (ERE)',
        icon: 'Truck',
        description: 'Reservas de espacio relacionadas con el tránsito o movimientos de equipos.',
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
        dataKey: 'ins',
      },
      {
        id: 'ins-equipos',
        code: 'AUT',
        name: 'Equipos (AUT)',
        icon: 'Cpu',
        description:
          'Modelos y elementos relacionados con los equipos de suministro de instrumentación y automatización industrial.',
      },
      {
        id: 'ins-escalerillas',
        code: 'ESI',
        name: 'Escalerillas (ESI)',
        icon: 'Cable',
        description:
          'Modelos y elementos asociados con el diseño de escalerillas de suministro de instrumentación, control, automatización y telecomunicaciones, se incluyen soportes de estos elementos.',
      },
      {
        id: 'ins-cables',
        code: 'CII',
        name: 'Cables (CII)',
        icon: 'Spline',
        description:
          'Elementos relacionados con los cables de suministro de instrumentación, control, automatización y telecomunicaciones.',
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
        dataKey: 'mec',
      },
      {
        id: 'mec-hvac',
        code: 'HVC',
        name: 'HVAC (HVC)',
        icon: 'Fan',
        description:
          'Elementos y modelos relacionados con el diseño de sistemas de Calefacción, ventilación y aire acondicionado; se incluyen los soportes del sistema.',
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
      },
      {
        id: 'sus-lbs',
        code: 'LBS',
        name: 'Línea base (LBS)',
        icon: 'Map',
        description:
          'Representación volumétrica del (las) área(s) que son utilizadas como línea base para los diseños de sustentabilidad.',
      },
      {
        id: 'sus-pmf',
        code: 'PMF',
        name: 'Plan de manejo forestal (PMF)',
        icon: 'Sprout',
        description:
          'Representación gráfica de las áreas que son asociadas con el Plan de Manejo Forestal desarrollado para el proyecto.',
      },
      {
        id: 'sus-csa',
        code: 'CSA',
        name: 'Caminos sancionatorios (CSA)',
        icon: 'Route',
        description:
          'Representación volumétrica de los caminos, senderos o plataformas que se encuentran en terreno (existentes) o que han sido aprobados por instancias anteriores.',
      },
      {
        id: 'sus-bnp',
        code: 'BNP',
        name: 'Bosque nativo de preservación (BNP)',
        icon: 'TreePine',
        description:
          'Reserva de espacio relacionada con la individualización de especies forestales (y su entorno) que no pueden ser modificadas.',
      },
      {
        id: 'sus-adi',
        code: 'ADI',
        name: 'Áreas y curvas de inundación (ADI)',
        icon: 'Waves',
        description:
          'Representación gráfica de las estimaciones de inundación para diferentes condiciones, se pueden incluir los comportamientos esperados/futuros de la cuenca.',
      },
    ],
  },
]
