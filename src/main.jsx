import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import LoginGate from './components/LoginGate.jsx'
import './index.css'

// Nota: NO se usa <React.StrictMode>. El visor de Autodesk (APS Viewer) no es
// compatible con el doble montaje que StrictMode hace en desarrollo: crea dos
// instancias del visor sobre el mismo contenedor y corrompe sus listeners
// internos ("t.addEventListener is not a function") y provoca parpadeos.
//
// <LoginGate> es transparente si no hay env vars de Supabase (la app funciona
// como hoy); cuando se configuran, exige login. Ver src/lib/auth.js.
ReactDOM.createRoot(document.getElementById('root')).render(
  <LoginGate>
    <App />
  </LoginGate>,
)
