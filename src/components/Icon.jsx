import * as icons from 'lucide-react'

/**
 * Renderiza un ícono de lucide-react a partir de su nombre.
 * Si el nombre no existe, cae a un ícono genérico para no romper la UI.
 */
export default function Icon({ name, ...props }) {
  const Cmp = icons[name] || icons.Circle
  return <Cmp {...props} />
}
