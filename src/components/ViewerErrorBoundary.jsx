import { Component } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

/**
 * Aísla los visores 3D (APS / three.js) del resto de la app.
 *
 * Sin esto, un error de render dentro del visor tira abajo TODO el árbol de
 * React. Como el visor de Autodesk carga geometría de forma asíncrona, ese
 * desmontaje abrupto deja al SDK tocando un canvas ya destruido y dispara el
 * críptico "t.addEventListener is not a function". Con el boundary el fallo
 * queda contenido y se ofrece reintentar sin recargar la página.
 */
export default class ViewerErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[Visor 3D] error de render contenido:', error, info)
  }

  reset = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      return (
        <div className="grid h-full w-full place-items-center p-6 text-center">
          <div className="max-w-sm rounded-xl border border-slate-200 bg-white/80 p-6 shadow-lg dark:border-white/10 dark:bg-ink-800/80">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <p className="text-base font-bold text-slate-800 dark:text-white">El visor 3D tuvo un problema</p>
            <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {this.state.error?.message || 'Ocurrió un error inesperado al dibujar el modelo.'} Si persiste, cierra otras pestañas con 3D/mapas (la GPU agota los contextos WebGL) y recarga la página.
            </p>
            <button
              onClick={this.reset}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-600 dark:bg-accent dark:text-ink-900"
            >
              <RotateCcw className="h-4 w-4" /> Reintentar
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
