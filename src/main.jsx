import ReactDOM from 'react-dom/client'
import LoginGate from './components/LoginGate.jsx'
import ProjectGate from './components/ProjectGate.jsx'
import './index.css'

// Nota: NO se usa <React.StrictMode>. El visor de Autodesk (APS Viewer) no es
// compatible con el doble montaje que StrictMode hace en desarrollo: crea dos
// instancias del visor sobre el mismo contenedor y corrompe sus listeners
// internos ("t.addEventListener is not a function") y provoca parpadeos.
//
// <LoginGate> muestra la pantalla de login si no hay sesión. Por ahora el acceso
// principal es la sesión de PRUEBA (sin backend); si se configuran las env vars
// de Supabase, además aparece el login real de email/contraseña. Ver src/lib/auth.js.
ReactDOM.createRoot(document.getElementById('root')).render(
  <LoginGate>
    <ProjectGate />
  </LoginGate>,
)
