/**
 * Visor APS como singleton: una ÚNICA instancia de GuiViewer3D para toda la app.
 *
 * Motivo: cada instancia del visor crea su propio contexto WebGL, y los
 * navegadores limitan ~8-16 contextos (peor en GPU Intel). Crear/destruir el
 * visor al cambiar de pestaña/modo agota los contextos y rompe el render
 * ("t.addEventListener is not a function"). Con un único visor reutilizado el
 * problema desaparece de raíz.
 *
 * El componente React "adopta" el contenedor del visor (lo mueve a su <div>)
 * cuando está activo, y lo libera al desmontar. El visor nunca se destruye.
 */
const SDK_CSS = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css'
const SDK_JS = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js'

let sdkPromise = null
function loadSdk() {
  if (window.Autodesk?.Viewing) return Promise.resolve()
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise((resolve, reject) => {
    const css = document.createElement('link')
    css.rel = 'stylesheet'
    css.href = SDK_CSS
    document.head.appendChild(css)
    const js = document.createElement('script')
    js.src = SDK_JS
    js.onload = resolve
    js.onerror = () => reject(new Error('No se pudo cargar el SDK de APS (revisa tu conexión).'))
    document.head.appendChild(js)
  })
  return sdkPromise
}

let viewer = null
let container = null
let initPromise = null

/**
 * Devuelve { viewer, container }. Inicializa SDK + visor una sola vez.
 * @param {() => Promise<{access_token, expires_in}>} getToken
 */
export function getApsViewer(getToken) {
  if (viewer && container) return Promise.resolve({ viewer, container })
  if (initPromise) return initPromise
  initPromise = (async () => {
    await loadSdk()
    const token = await getToken()
    await new Promise((resolve) => {
      window.Autodesk.Viewing.Initializer(
        { env: 'AutodeskProduction', api: 'streamingV2', getAccessToken: (cb) => cb(token.access_token, token.expires_in) },
        resolve,
      )
    })
    container = document.createElement('div')
    container.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;'
    viewer = new window.Autodesk.Viewing.GuiViewer3D(container)
    viewer.start()
    return { viewer, container }
  })()
  return initPromise
}

/** ¿El SDK/visor ya está creado? */
export function hasApsViewer() {
  return !!viewer
}
