/**
 * Proyectos de demostración para el selector intermedio (post-login).
 *
 * Una empresa puede tener varios proyectos; por ahora se ofrecen dos de prueba:
 *  - 'demo-full'  → muestra las disciplinas/planillas ya cargadas (base de datos).
 *  - 'demo-empty' → proyecto vacío, sin disciplinas (arrancar de cero).
 *
 * El estado editable (disciplinas personalizadas, importaciones, planillas
 * creadas) se persiste por proyecto, así no se mezclan entre uno y otro.
 */
export const DEMO_PROJECTS = [
  {
    id: 'demo-full',
    name: 'Planta Servicios Auxiliares',
    description: 'Proyecto con las disciplinas y planillas cargadas en la base de datos. Ideal para explorar la plataforma con datos reales.',
    icon: 'Building2',
    empty: false,
  },
  {
    id: 'demo-empty',
    name: 'Proyecto en blanco',
    description: 'Proyecto vacío, sin disciplinas. Agrega disciplinas e importa tus planillas para empezar desde cero.',
    icon: 'Sprout',
    empty: true,
  },
]
