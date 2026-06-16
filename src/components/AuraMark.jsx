/**
 * Logo de Aura GIP como ícono, para los botones que PUBLICAN / SINCRONIZAN al
 * plugin de Navisworks (en vez de un ícono genérico). Reusa el logo de marca
 * (/aura1.png), el mismo del sidebar. Acepta `className` para tamaño/estilo.
 */
export default function AuraMark({ className = 'h-4 w-4' }) {
  return <img src="/aura1.png" alt="" aria-hidden="true" className={`${className} object-contain`} />
}
