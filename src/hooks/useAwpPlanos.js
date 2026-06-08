import { useCallback, useEffect, useRef, useState } from 'react'
import { loadStore, saveStore } from '../utils/cloudStore.js'

/**
 * Planos del proyecto (Plot Plan): imagen del sitio + áreas (CWA) dibujadas
 * encima. Persiste en la NUBE (/api/store) además del localStorage, así los
 * planos se recuperan en cualquier equipo. La imagen se comprime al cargarla
 * (ver fileToDataUrl) para no pasar el límite de tamaño. Cada shape guarda
 * x/y/w/h en porcentaje (0–100) del plano.
 */
const KEY = (pid) => `sqy-awp-planos-${pid}`
const cloudKey = (pid) => `awp-planos-${pid}`
let _seq = 0
const uid = (p) => `${p}_${(typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now().toString(36)}_${(_seq++).toString(36)}`}`

function load(pid) {
  try { const r = localStorage.getItem(KEY(pid)); if (r) return JSON.parse(r) } catch { /* ignore */ }
  return []
}

export function useAwpPlanos(projectId) {
  const [planos, setPlanos] = useState(() => load(projectId))
  const [error, setError] = useState('')
  const cloudReady = useRef(false)
  const edited = useRef(false)
  const mutate = useCallback((updater) => { edited.current = true; setPlanos(updater) }, [])

  // Carga desde la nube al montar (gana sobre localStorage; si está vacía, la
  // siembra). Luego habilita el guardado a la nube.
  useEffect(() => {
    let alive = true
    loadStore(cloudKey(projectId)).then((d) => {
      if (!alive) return
      if (Array.isArray(d) && !edited.current) setPlanos(d)
      else if (!d) setPlanos((cur) => { saveStore(cloudKey(projectId), cur); return cur })
    }).finally(() => { if (alive) cloudReady.current = true })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  useEffect(() => {
    try { localStorage.setItem(KEY(projectId), JSON.stringify(planos)); setError('') }
    catch { setError('La imagen es muy pesada para el caché local; igual se guarda en la nube.') }
    if (cloudReady.current) saveStore(cloudKey(projectId), planos)
  }, [projectId, planos])

  const addPlano = useCallback(({ nombre, imagen }) => {
    const id = uid('pp')
    mutate((p) => [...p, { id, nombre: nombre || `Plano ${p.length + 1}`, imagen, shapes: [] }])
    return id
  }, [mutate])
  const removePlano = useCallback((id) => mutate((p) => p.filter((x) => x.id !== id)), [mutate])
  const renamePlano = useCallback((id, nombre) => mutate((p) => p.map((x) => (x.id === id ? { ...x, nombre } : x))), [mutate])

  const addShape = useCallback((planoId, shape) => mutate((p) => p.map((x) => (x.id === planoId ? { ...x, shapes: [...x.shapes, { id: uid('sh'), ...shape }] } : x))), [mutate])
  const removeShape = useCallback((planoId, shapeId) => mutate((p) => p.map((x) => (x.id === planoId ? { ...x, shapes: x.shapes.filter((s) => s.id !== shapeId) } : x))), [mutate])

  return { planos, error, addPlano, removePlano, renamePlano, addShape, removeShape }
}

/** Lee un archivo de imagen y lo reduce/comprime a dataURL. Comprimido para
 *  caber en el almacenamiento en la nube (límite de ~4.5 MB por request) y en el
 *  caché local. Devuelve una promesa con el dataURL JPEG. */
export function fileToDataUrl(file, maxW = 1400) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width)
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale)
      const c = document.createElement('canvas'); c.width = w; c.height = h
      c.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      try { resolve(c.toDataURL('image/jpeg', 0.72)) } catch (e) { reject(e) }
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')) }
    img.src = url
  })
}
