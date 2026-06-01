import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'

/**
 * Botón "Instalar app": captura el evento `beforeinstallprompt` del navegador y
 * ofrece instalar la PWA. Se oculta si ya está instalada o si el navegador no
 * soporta la instalación (p. ej. iOS Safari, donde se instala desde Compartir →
 * "Agregar a inicio").
 */
export default function InstallButton() {
  const [deferred, setDeferred] = useState(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault()
      setDeferred(e)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }
    // Ya corriendo en modo app instalada.
    if (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone) {
      setInstalled(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed || !deferred) return null

  async function install() {
    deferred.prompt()
    try {
      await deferred.userChoice
    } finally {
      setDeferred(null)
    }
  }

  return (
    <button
      onClick={install}
      title="Instalar Sonqollay como aplicación"
      className="inline-flex items-center gap-1.5 rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 dark:border-accent/40 dark:bg-accent/10 dark:text-accent"
    >
      <Download className="h-4 w-4" />
      <span className="hidden lg:inline">Instalar app</span>
    </button>
  )
}
