import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Nota: NO se usa <React.StrictMode>. El visor de Autodesk (APS Viewer) no es
// compatible con el doble montaje que StrictMode hace en desarrollo: crea dos
// instancias del visor sobre el mismo contenedor y corrompe sus listeners
// internos ("t.addEventListener is not a function") y provoca parpadeos.
ReactDOM.createRoot(document.getElementById('root')).render(<App />)
