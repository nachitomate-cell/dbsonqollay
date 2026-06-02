import { useState } from 'react'
import { Check, GraduationCap, Send, Sparkles } from 'lucide-react'

const LS_KEY = 'sqy-academia-suggestions'

function loadSuggestions() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || [] } catch { return [] }
}

export default function AcademiaView() {
  const [text, setText] = useState('')
  const [sent, setSent] = useState(false)

  function handleSend() {
    const trimmed = text.trim()
    if (!trimmed) return
    try {
      const prev = loadSuggestions()
      localStorage.setItem(LS_KEY, JSON.stringify([
        { text: trimmed, sentAt: new Date().toISOString() },
        ...prev,
      ]))
    } catch { /* cuota excedida */ }
    setText('')
    setSent(true)
    setTimeout(() => setSent(false), 3500)
  }

  return (
    <div className="flex min-h-full items-center justify-center px-6 py-16">
      <div className="mx-auto w-full max-w-lg text-center">
        {/* Ícono */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-500 to-brand-600 shadow-lg shadow-brand-500/30 dark:from-accent/80 dark:to-accent dark:shadow-accent/20">
          <GraduationCap className="h-10 w-10 text-white" />
        </div>

        {/* Títulos */}
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-500 dark:text-accent">
          Academia Sonqollay
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          El conocimiento que transforma
        </h1>
        <p className="mt-1 text-lg font-medium text-slate-500 dark:text-slate-400">
          está en camino.
        </p>

        {/* Badge */}
        <span className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-400">
          <Sparkles className="h-3.5 w-3.5" />
          Próximamente
        </span>

        {/* Cuerpo */}
        <p className="mx-auto mt-6 max-w-sm text-base leading-relaxed text-slate-600 dark:text-slate-300">
          Estamos construyendo algo especial para ti.
        </p>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          ¿Tienes ideas de qué quieres aprender?<br />
          Tus sugerencias dan forma a lo que viene.
        </p>

        {/* Formulario de sugerencia */}
        <div className="mx-auto mt-8 max-w-sm">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSend()
            }}
            placeholder="Escribe aquí tu idea o tema de aprendizaje…"
            rows={3}
            className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none dark:border-white/10 dark:bg-ink-800 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-accent/50"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sent}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-60 dark:bg-accent dark:text-ink-900 dark:hover:bg-accent-400"
          >
            {sent
              ? <><Check className="h-4 w-4" /> ¡Gracias por tu sugerencia!</>
              : <><Send className="h-4 w-4" /> Enviar sugerencia</>}
          </button>
          {sent && (
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
              Guardamos tu idea. Te avisaremos cuando el contenido esté listo.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
