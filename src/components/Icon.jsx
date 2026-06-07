import {
  Anchor,
  Box,
  Boxes,
  BrickWall,
  Building2,
  Cable,
  Circle,
  Cog,
  Construction,
  Cpu,
  Droplet,
  Factory,
  Fan,
  FileCheck2,
  FlaskConical,
  Frame,
  Fuel,
  Gauge,
  GraduationCap,
  Grid3x3,
  Hospital,
  Layers,
  Lightbulb,
  Map,
  Mountain,
  Pickaxe,
  Pipette,
  Plane,
  Recycle,
  Route,
  Server,
  Settings,
  Spline,
  Sprout,
  TrainFront,
  TramFront,
  TreePine,
  Truck,
  Waves,
  Zap,
} from 'lucide-react'

/**
 * Registro explícito de íconos usados como string (`icon: 'Nombre'` en el
 * modelo de datos). Importar solo los íconos necesarios permite que el bundler
 * haga tree-shaking del resto de lucide-react (≈1.2k íconos), reduciendo
 * drásticamente el tamaño del bundle frente a `import * as icons`.
 */
const registry = {
  Anchor,
  Box,
  Boxes,
  BrickWall,
  Building2,
  Cable,
  Cog,
  Construction,
  Cpu,
  Droplet,
  Factory,
  Fan,
  FileCheck2,
  FlaskConical,
  Frame,
  Fuel,
  Gauge,
  GraduationCap,
  Grid3x3,
  Hospital,
  Layers,
  Lightbulb,
  Map,
  Mountain,
  Pickaxe,
  Pipette,
  Plane,
  Recycle,
  Route,
  Server,
  Settings,
  Spline,
  Sprout,
  TrainFront,
  TramFront,
  TreePine,
  Truck,
  Waves,
  Zap,
}

/**
 * Renderiza un ícono de lucide-react a partir de su nombre.
 * Si el nombre no está en el registro, cae a un ícono genérico.
 */
export default function Icon({ name, ...props }) {
  const Cmp = registry[name] || Circle
  return <Cmp {...props} />
}
