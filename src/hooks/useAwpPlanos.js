import { useCallback, useEffect, useState } from 'react'

/**
 * Planos del proyecto (Plot Plan): imagen del sitio + áreas (CWA) dibujadas
 * encima. Scaffold por proyecto (localStorage, clave aparte por el peso de las
 * imágenes). Cada shape guarda x/y/w/h en porcentaje (0–100) del plano, así
 * escala con el tamaño de visualización.
 */
const KEY = (pid) => `sqy-awp-planos-${pid}`
let _seq = 0
const uid = (p) => `${p}_${Date.now().toString(36)}_${(_seq++).toString(36)}`

function load(pid) {
  try { const r = localStorage.getItem(KEY(pid)); if (r) return JSON.parse(r) } catch { /* ignore */ }
  return []
}

export function useAwpPlanos(projectId) {
  const [planos, setPlanos] = useState(() => load(projectId))
  const [error, setError] = useState('')

  useEffect(() => {
    try { localStorage.setItem(KEY(projectId), JSON.stringify(planos)); setError('') }
    catch { setError('No se pudo guardar el plano (almacenamiento local lleno). Usa imágenes más livianas.') }
  }, [projectId, planos])

  const addPlano = useCallback(({ nombre, imagen }) => {
    const id = uid('pp')
    setPlanos((p) => [...p, { id, nombre: nombre || `Plano ${p.length + 1}`, imagen, shapes: [] }])
    return id
  }, [])
  const removePlano = useCallback((id) => setPlanos((p) => p.filter((x) => x.id !== id)), [])
  const renamePlano = useCallback((id, nombre) => setPlanos((p) => p.map((x) => (x.id === id ? { ...x, nombre } : x))), [])

  const addShape = useCallback((planoId, shape) => setPlanos((p) => p.map((x) => (x.id === planoId ? { ...x, shapes: [...x.shapes, { id: uid('sh'), ...shape }] } : x))), [])
  const removeShape = useCallback((planoId, shapeId) => setPlanos((p) => p.map((x) => (x.id === planoId ? { ...x, shapes: x.shapes.filter((s) => s.id !== shapeId) } : x))), [])

  return { planos, error, addPlano, removePlano, renamePlano, addShape, removeShape }
}

/** Lee un archivo de imagen y lo reduce/comprime a dataURL (para no llenar el
 *  almacenamiento local). Devuelve una promesa con el dataURL JPEG. */
export function fileToDataUrl(file, maxW = 1600) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width)
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale)
      const c = document.createElement('canvas'); c.width = w; c.height = h
      c.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      try { resolve(c.toDataURL('image/jpeg', 0.82)) } catch (e) { reject(e) }
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')) }
    img.src = url
  })
}
