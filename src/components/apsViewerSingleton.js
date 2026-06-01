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
// Versión del visor de Autodesk. Por defecto `7.*` (la última 7.x), pero se
// puede FIJAR a una versión estable concreta con VITE_APS_VIEWER_VERSION
// (p. ej. "7.95", "7.92", "7.90") sin tocar código. Útil porque la última 7.x
// a veces trae regresiones que rompen el render en GPUs Intel
// ("t.addEventListener is not a function" en WebGLRenderer/_initObject).
const VIEWER_VERSION = import.meta.env.VITE_APS_VIEWER_VERSION || '7.*'

const cdn = (v, file) => `https://developer.api.autodesk.com/modelderivative/v2/viewers/${v}/${file}`

let sdkPromise = null
// Carga el SDK de una versión concreta (CSS + JS). Resuelve al cargar el JS.
function loadSdkVersion(version) {
  return new Promise((resolve, reject) => {
    const css = document.createElement('link')
    css.rel = 'stylesheet'
    css.href = cdn(version, 'style.min.css')
    document.head.appendChild(css)
    const js = document.createElement('script')
    js.src = cdn(version, 'viewer3D.min.js')
    js.onload = resolve
    js.onerror = () => { css.remove(); js.remove(); reject(new Error(`SDK ${version} no disponible`)) }
    document.head.appendChild(js)
  })
}

function loadSdk() {
  if (window.Autodesk?.Viewing) return Promise.resolve()
  if (sdkPromise) return sdkPromise
  // Intenta la versión configurada; si falla (p. ej. una versión inexistente en
  // VITE_APS_VIEWER_VERSION → 404), cae a la última 7.x para no dejar el visor
  // sin cargar. El formato válido es "mayor.menor.patch", p. ej. "7.95.0".
  sdkPromise = loadSdkVersion(VIEWER_VERSION).catch((e) => {
    if (VIEWER_VERSION !== '7.*') {
      console.warn(`[APS] ${e.message}; usando 7.* como respaldo. Usa el formato 7.x.y (p. ej. 7.95.0).`)
      return loadSdkVersion('7.*')
    }
    throw new Error('No se pudo cargar el SDK de APS (revisa tu conexión).')
  })
  return sdkPromise
}

let viewer = null
let container = null
let initPromise = null

/** ¿El navegador/GPU puede entregar un contexto WebGL nuevo? */
function webglAvailable() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl'))
  } catch {
    return false
  }
}

/**
 * Si el contexto WebGL del visor se pierde de verdad (la GPU lo recicla cuando
 * se agotan los contextos), el visor queda inservible: cualquier render vuelve a
 * tirar "t.addEventListener is not a function". En ese caso reseteamos el
 * singleton para que la próxima entrada al 3D recree el visor desde cero.
 */
function watchContextLoss() {
  const canvas = viewer?.canvas || container?.querySelector('canvas')
  if (!canvas) return
  canvas.addEventListener('webglcontextlost', (e) => {
    // preventDefault() habilita el intento de restauración del navegador.
    e.preventDefault()
    console.warn('[APS] Contexto WebGL perdido — se recreará el visor al reabrir el 3D.')
    try { viewer?.tearDown?.() } catch { /* noop */ }
    try { viewer?.finish?.() } catch { /* noop */ }
    viewer = null
    container = null
    initPromise = null
  }, false)
}

/**
 * Devuelve { viewer, container }. Inicializa SDK + visor una sola vez.
 * @param {() => Promise<{access_token, expires_in}>} getToken
 */
export function getApsViewer(getToken) {
  if (viewer && container) return Promise.resolve({ viewer, container })
  if (initPromise) return initPromise
  initPromise = (async () => {
    if (!webglAvailable()) {
      throw new Error('Tu navegador/GPU agotó los contextos WebGL disponibles. Cierra otras pestañas con 3D/mapas y recarga la página.')
    }
    await loadSdk()
    const token = await getToken()
    await new Promise((resolve) => {
      window.Autodesk.Viewing.Initializer(
        { env: 'AutodeskProduction', api: 'streamingV2', getAccessToken: (cb) => cb(token.access_token, token.expires_in) },
        resolve,
      )
    })
    // El contenedor se crea DESLIGADO del DOM con estilo de relleno: el visor lo
    // usa tal cual y el componente React lo "adopta" moviéndolo a su <div>. Es
    // el mismo arranque que el SDK espera; montarlo en otro lado antes de
    // start() confunde la construcción interna de paneles (bug "tBodies").
    container = document.createElement('div')
    container.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;'
    try {
      viewer = new window.Autodesk.Viewing.GuiViewer3D(container)
      const code = viewer.start()
      // start() devuelve un código != 0 si falló la creación del contexto WebGL.
      if (code) throw new Error('start() falló')
    } catch (err) {
      // Limpieza: deja el singleton en estado recreable y propaga un mensaje claro.
      try { viewer?.finish?.() } catch { /* noop */ }
      viewer = null
      container = null
      initPromise = null
      throw new Error('No se pudo iniciar el visor 3D (contextos WebGL agotados). Cierra otras pestañas y recarga la página.')
    }
    watchContextLoss()
    return { viewer, container }
  })()
  return initPromise
}

/** ¿El SDK/visor ya está creado? */
export function hasApsViewer() {
  return !!viewer
}
