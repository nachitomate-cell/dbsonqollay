// Catálogos del modelo AWP (replican el concepto de Aura AWP). Listas de opciones
// para la configuración de un proyecto y valores por defecto.

// Tipos de proyecto (con ícono lucide).
export const TIPOS_PROYECTO = [
  { id: 'planta-proceso-minero', nombre: 'Planta de Proceso Minero', icon: 'Factory' },
  { id: 'oil-gas', nombre: 'Planta Oil & Gas', icon: 'Fuel' },
  { id: 'quimica', nombre: 'Planta Química', icon: 'FlaskConical' },
  { id: 'energia', nombre: 'Planta de Energía', icon: 'Zap' },
  { id: 'tratamiento-agua', nombre: 'Planta de Tratamiento de Agua', icon: 'Droplet' },
  { id: 'mina-cielo-abierto', nombre: 'Mina a Cielo Abierto', icon: 'Pickaxe' },
  { id: 'mina-subterranea', nombre: 'Mina Subterránea', icon: 'Mountain' },
  { id: 'tranque-relaves', nombre: 'Tranque de Relaves', icon: 'Waves' },
  { id: 'carretera', nombre: 'Carretera / Autopista', icon: 'Route' },
  { id: 'puente', nombre: 'Puente', icon: 'Construction' },
  { id: 'puerto', nombre: 'Puerto', icon: 'Anchor' },
  { id: 'aeropuerto', nombre: 'Aeropuerto', icon: 'Plane' },
  { id: 'metro-superficie', nombre: 'Metro de Superficie', icon: 'TramFront' },
  { id: 'metro-subterraneo', nombre: 'Metro Subterráneo', icon: 'TrainFront' },
  { id: 'edificio-altura', nombre: 'Edificio en Altura', icon: 'Building2' },
  { id: 'hospital', nombre: 'Hospital', icon: 'Hospital' },
  { id: 'centro-datos', nombre: 'Centro de Datos', icon: 'Server' },
  { id: 'linea-at', nombre: 'Línea de Alta Tensión', icon: 'Cable' },
  { id: 'linea-mt', nombre: 'Línea de Media Tensión', icon: 'Cable' },
  { id: 'subestacion', nombre: 'Subestación Eléctrica', icon: 'Cog' },
  { id: 'trolley', nombre: 'Sistema de Trolley', icon: 'TramFront' },
]

// Tipos de contrato (alcance del contratista).
export const TIPOS_CONTRATO = [
  { id: 'EPC', nombre: 'EPC', desc: 'Interviene en Ingeniería de Detalles, Adquisiciones, Construcción' },
  { id: 'EPCM', nombre: 'EPCM', desc: 'Ingeniería de Detalles, Adquisiciones, Construcción, Administración' },
  { id: 'E', nombre: 'E', desc: 'Interviene en Estudios e Ingeniería' },
  { id: 'EP', nombre: 'EP', desc: 'Interviene en Ingeniería de Detalles y Adquisiciones' },
  { id: 'C', nombre: 'C', desc: 'Interviene en Construcción' },
  { id: 'PC', nombre: 'PC', desc: 'Interviene en Adquisiciones y Construcción' },
]

// Fases FEL (Front-End Loading).
export const FASES = [
  { id: 'FEL-1', nombre: 'FEL-1 Visualización o Ingeniería de Perfil' },
  { id: 'FEL-2', nombre: 'FEL-2 Estudio de Prefactibilidad o Ingeniería Conceptual' },
  { id: 'FEL-3', nombre: 'FEL-3 Estudio de Factibilidad o Ingeniería Básica' },
  { id: 'EJECUCION', nombre: 'Ejecución / Ingeniería de Detalles' },
  { id: 'CONSTRUCCION', nombre: 'Construcción' },
  { id: 'OPERACION', nombre: 'Operación' },
]

export const SECTORES = ['Minería', 'Energía', 'Oil & Gas', 'Infraestructura', 'Industrial', 'Agua y Saneamiento', 'Otro']

export const MONEDAS = ['USD', 'CLP', 'EUR', 'PEN', 'ARS']

// Disciplinas de ingeniería con su prefijo de código y color (para CWP/IWP).
// El usuario puede activarlas/desactivarlas y ajustar prefijo/color por proyecto.
export const DISCIPLINAS_DEFAULT = [
  { id: 'arquitectura', nombre: 'Arquitectura', prefijo: 'A', color: '#8FBC8F', activa: true },
  { id: 'canerias', nombre: 'Cañerías / Tuberías', prefijo: 'P', color: '#FFFF00', activa: true },
  { id: 'civil', nombre: 'Civil / Geotecnia', prefijo: 'C', color: '#B0C4DE', activa: true },
  { id: 'electricidad', nombre: 'Electricidad', prefijo: 'E', color: '#ADD8E6', activa: true },
  { id: 'estructuras-acero', nombre: 'Estructuras de Acero', prefijo: 'S', color: '#4682B4', activa: true },
  { id: 'estructuras-hormigon', nombre: 'Estructuras de Hormigón', prefijo: 'H', color: '#C0C0C0', activa: true },
  { id: 'mecanica', nombre: 'Mecánica / Equipos', prefijo: 'M', color: '#2E8B57', activa: true },
  { id: 'instrumentacion', nombre: 'Instrumentación, Control y Telecom.', prefijo: 'I', color: '#FF7F50', activa: true },
  { id: 'mov-tierra', nombre: 'Movimientos de Tierra Masivos', prefijo: 'T', color: '#BDB76B', activa: true },
  { id: 'hvac', nombre: 'HVAC', prefijo: 'V', color: '#87CEEB', activa: false },
  { id: 'vialidad', nombre: 'Vialidad', prefijo: 'Y', color: '#A0522D', activa: false },
]

// Presets de parámetros AWP (recomendaciones del CII).
export const AWP_PRESETS = {
  cii: { hhMaxCwa: 100000, hhMaxCwp: 40000, hhObjetivoIwp: 750, semanasLookahead: 6 },
  grande: { hhMaxCwa: 250000, hhMaxCwp: 80000, hhObjetivoIwp: 1000, semanasLookahead: 9 },
  pequeno: { hhMaxCwa: 50000, hhMaxCwp: 20000, hhObjetivoIwp: 500, semanasLookahead: 4 },
}

// Nomenclatura por defecto (formato estándar AWP). Cada nivel define prefijo,
// separador, nº de dígitos del correlativo y qué segmentos incluye.
export const NOMENCLATURA_DEFAULT = {
  cwa: { prefijo: 'CWA', separador: '-', digitos: 2 },
  cwp: { prefijo: 'CWP', separador: '-', digitos: 2, incluyeCwa: true, incluyeDisc: true },
  ewp: { prefijo: 'EWP', separador: '-', digitos: 2, incluyeCwa: true, incluyeDisc: true },
  pwp: { prefijo: 'PWP', separador: '-', digitos: 2, incluyeCwa: true, incluyeDisc: true },
  iwp: { prefijo: 'IWP', separador: '-', digitos: 2, incluyeCwa: true, incluyeDisc: true, incluyeCwp: true },
}
