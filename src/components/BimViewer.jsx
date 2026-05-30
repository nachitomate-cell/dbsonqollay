import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { Box, Loader2, Palette, Ruler, Search, Upload, X } from 'lucide-react'

/**
 * Visor BIM 3D (three.js) — Nivel 1 de interactividad:
 *  - Selección cruzada bidireccional: `selectedId` enfoca/vuela/resalta; al
 *    clicar en la lista o en la geometría se notifica vía onFocus/onSelect.
 *  - Color por estado (rojo/amarillo/verde) sobre volúmenes y sobre el modelo.
 *  - Vistas predefinidas (Planta, Elevaciones, Isométrica).
 *  - Herramienta de medición punto a punto.
 *  - Carga de modelo real glTF/GLB con mapeo configurable (campo de vínculo).
 *
 * props:
 *  - rows, headers, selectedId
 *  - onFocus(id):  el usuario enfocó un elemento (lista o geometría) → resaltar fila
 *  - onSelect(id): abrir la ficha del elemento (clic en geometría / botón)
 */
const CAP = 1500
const norm = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')

const COLORS = { green: 0x10b981, amber: 0xf59e0b, red: 0xef4444, gray: 0x586878 }
function statusColor(text) {
  const v = String(text || '').toUpperCase()
  if (/RECHAZ|RETEN|NO APROB|\bE1\b/.test(v)) return COLORS.red
  if (/FABRIC|PROCESO|TRANSIT|MONTAJE|\bE2\b|\bE3\b/.test(v)) return COLORS.amber
  if (/APROB|RECIB|EN OBRA|INSTAL|TERMIN|\bE4\b/.test(v)) return COLORS.green
  return COLORS.gray
}

export default function BimViewer({ rows, headers, selectedId, onFocus, onSelect }) {
  const mountRef = useRef(null)
  const fileRef = useRef(null)
  const ctx = useRef({})
  const [focusId, setFocusId] = useState(selectedId || null)
  const [listQuery, setListQuery] = useState('')
  const [matchKey, setMatchKey] = useState(headers[0])
  const [modelName, setModelName] = useState(null)
  const [loadingModel, setLoadingModel] = useState(false)
  const [modelError, setModelError] = useState(null)
  const [colorByStatus, setColorByStatus] = useState(true)
  const [measuring, setMeasuring] = useState(false)
  const [measureDist, setMeasureDist] = useState(null)

  const tagKey = headers[0]
  const statusKeys = useMemo(
    () => headers.filter((h) => /APROB|AVANCE|ESTADO/i.test(h)),
    [headers],
  )
  const items = useMemo(() => rows.slice(0, CAP), [rows])
  const listItems = useMemo(() => {
    const q = listQuery.trim().toLowerCase()
    return q ? items.filter((r) => String(r[tagKey] ?? '').toLowerCase().includes(q)) : items
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, listQuery])

  const rowColor = (r) => (colorByStatus ? statusColor(statusKeys.map((k) => r[k]).join(' ')) : COLORS.gray)

  // --- init escena (una vez) ---
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const w = mount.clientWidth || 800
    const h = mount.clientHeight || 600

    const scene = new THREE.Scene()
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w, h)
    mount.appendChild(renderer.domElement)

    const camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 8000)
    camera.position.set(30, 28, 38)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08

    scene.add(new THREE.AmbientLight(0xffffff, 0.75))
    const dir = new THREE.DirectionalLight(0xffffff, 1.1)
    dir.position.set(40, 60, 30)
    scene.add(dir)

    const schematicGroup = new THREE.Group()
    scene.add(schematicGroup)

    // capa de medición
    const measureGroup = new THREE.Group()
    scene.add(measureGroup)

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const target = new THREE.Vector3(0, 0, 0)
    const camTarget = new THREE.Vector3().copy(camera.position)
    let flying = false
    let raf

    function setTheme() {
      const dark = document.documentElement.classList.contains('dark')
      scene.background = new THREE.Color(dark ? 0x05080c : 0xeef1f4)
      if (ctx.current.grid) scene.remove(ctx.current.grid)
      const grid = new THREE.GridHelper(400, 80, dark ? 0x2a3744 : 0xc3ccd6, dark ? 0x141d27 : 0xdce2e8)
      grid.position.y = -0.6
      scene.add(grid)
      ctx.current.grid = grid
    }
    setTheme()

    function onResize() {
      const nw = mount.clientWidth || 1
      const nh = mount.clientHeight || 1
      renderer.setSize(nw, nh)
      camera.aspect = nw / nh
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(onResize)
    ro.observe(mount)

    function resolveId(object) {
      let o = object
      while (o) {
        if (o.userData?.id) return o.userData.id
        if (o.name && ctx.current.nameToId?.has(norm(o.name))) return ctx.current.nameToId.get(norm(o.name))
        o = o.parent
      }
      return null
    }
    function pickPoint(e) {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const targets = ctx.current.modelGroup ? [ctx.current.modelGroup] : ctx.current.schematicMeshes || []
      return raycaster.intersectObjects(targets, true)
    }
    function onClick(e) {
      const hits = pickPoint(e)
      if (ctx.current.measuring) {
        if (!hits.length) return
        ctx.current.addMeasurePoint(hits[0].point.clone())
        return
      }
      if (hits.length) {
        const id = resolveId(hits[0].object)
        if (id) {
          setFocusId(id)
          ctx.current.onFocus?.(id)
          ctx.current.onSelect?.(id) // 3D → abre ficha automáticamente
        }
      }
    }
    renderer.domElement.addEventListener('click', onClick)

    function animate() {
      raf = requestAnimationFrame(animate)
      if (flying) {
        camera.position.lerp(camTarget, 0.09)
        controls.target.lerp(target, 0.09)
        if (camera.position.distanceTo(camTarget) < 0.4) flying = false
      }
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    function bounds() {
      const obj = ctx.current.modelGroup || schematicGroup
      const box = new THREE.Box3().setFromObject(obj)
      if (box.isEmpty()) box.set(new THREE.Vector3(-10, -10, -10), new THREE.Vector3(10, 10, 10))
      return box
    }

    ctx.current = {
      ...ctx.current,
      scene,
      renderer,
      camera,
      controls,
      schematicGroup,
      measureGroup,
      schematicMeshes: [],
      meshById: new Map(),
      nameToId: new Map(),
      modelGroup: null,
      measuring: false,
      measurePts: [],
      onFocus,
      onSelect,
      flyTo: (pos, dist = 9) => {
        target.copy(pos)
        camTarget.copy(pos).add(new THREE.Vector3(dist, dist * 0.85, dist))
        flying = true
      },
      frame: (obj) => {
        const box = new THREE.Box3().setFromObject(obj)
        if (box.isEmpty()) return
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z) || 10
        const d = maxDim * 1.6
        controls.target.copy(center)
        camera.position.copy(center).add(new THREE.Vector3(d, d * 0.8, d))
        camTarget.copy(camera.position)
        target.copy(center)
      },
      setView: (kind) => {
        const box = bounds()
        const c = box.getCenter(new THREE.Vector3())
        const s = box.getSize(new THREE.Vector3())
        const d = Math.max(s.x, s.y, s.z) || 20
        const off = new THREE.Vector3()
        if (kind === 'top') off.set(0.001, d * 2, 0)
        else if (kind === 'iso') off.set(d, d * 0.8, d)
        else if (kind === 'north') off.set(0, d * 0.3, d * 1.8)
        else if (kind === 'south') off.set(0, d * 0.3, -d * 1.8)
        else if (kind === 'east') off.set(d * 1.8, d * 0.3, 0)
        else if (kind === 'west') off.set(-d * 1.8, d * 0.3, 0)
        target.copy(c)
        camTarget.copy(c).add(off)
        flying = true
      },
      addMeasurePoint: (p) => {
        const pts = ctx.current.measurePts
        if (pts.length === 2) {
          // reiniciar para una nueva medición
          measureGroup.clear()
          pts.length = 0
          setMeasureDist(null)
        }
        pts.push(p)
        const dotGeo = new THREE.SphereGeometry(Math.max(0.15, bounds().getSize(new THREE.Vector3()).length() * 0.004), 12, 12)
        const dot = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0xf77000 }))
        dot.position.copy(p)
        measureGroup.add(dot)
        if (pts.length === 2) {
          const g = new THREE.BufferGeometry().setFromPoints(pts)
          measureGroup.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xf77000 })))
          setMeasureDist(pts[0].distanceTo(pts[1]))
        }
      },
      clearMeasure: () => {
        measureGroup.clear()
        ctx.current.measurePts = []
        setMeasureDist(null)
      },
    }

    const themeObserver = new MutationObserver(setTheme)
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    return () => {
      cancelAnimationFrame(raf)
      themeObserver.disconnect()
      ro.disconnect()
      renderer.domElement.removeEventListener('click', onClick)
      controls.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // callbacks/measuring siempre frescos en el ctx
  useEffect(() => {
    ctx.current.onFocus = onFocus
    ctx.current.onSelect = onSelect
  }, [onFocus, onSelect])
  useEffect(() => {
    ctx.current.measuring = measuring
    if (!measuring) ctx.current.clearMeasure?.()
  }, [measuring])

  // --- (re)construye volúmenes esquemáticos ---
  useEffect(() => {
    const c = ctx.current
    if (!c.scene) return
    c.schematicMeshes.forEach((m) => {
      c.schematicGroup.remove(m)
      m.geometry.dispose()
      m.material.dispose()
    })
    const meshes = []
    const meshById = new Map()
    const cols = Math.max(1, Math.ceil(Math.sqrt(items.length)))
    items.forEach((r, i) => {
      const geo = new THREE.BoxGeometry(1.4, 1.4, 1.4)
      const mat = new THREE.MeshStandardMaterial({ color: rowColor(r), metalness: 0.1, roughness: 0.65 })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set((i % cols) * 2.4 - (cols * 2.4) / 2, 0, Math.floor(i / cols) * 2.4 - (cols * 2.4) / 2)
      mesh.userData.id = r._id
      c.schematicGroup.add(mesh)
      meshes.push(mesh)
      meshById.set(r._id, mesh)
    })
    c.schematicMeshes = meshes
    c.meshById = meshById
    c.schematicGroup.visible = !c.modelGroup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, headers.join('|'), colorByStatus])

  // --- mapa identificador → fila (campo de vínculo configurable) ---
  useEffect(() => {
    const map = new Map()
    items.forEach((r) => map.set(norm(r[matchKey]), r._id))
    ctx.current.nameToId = map
  }, [items, matchKey])

  // --- color por estado sobre el modelo real ---
  useEffect(() => {
    const c = ctx.current
    if (!c.modelGroup || !c.modelMeshes) return
    c.modelMeshes.forEach((m) => {
      const id = resolveModelId(c, m)
      const row = id && items.find((r) => r._id === id)
      if (colorByStatus && row) m.material.color.setHex(rowColor(row))
      else if (m.userData._origColor != null) m.material.color.setHex(m.userData._origColor)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorByStatus, items, matchKey])

  // --- resalta y vuela al elemento enfocado ---
  useEffect(() => {
    const c = ctx.current
    if (!c.scene) return
    if (c.lastHi) {
      c.lastHi.forEach((m) => {
        m.material.emissive?.setHex(m.userData._emi ?? 0x000000)
        if (m.userData.id) m.scale.setScalar(1)
      })
    }
    c.lastHi = []
    if (!focusId) return
    let meshes = []
    if (c.modelGroup) {
      const row = items.find((r) => r._id === focusId)
      const tag = norm(row?.[matchKey])
      if (tag) c.modelMeshes?.forEach((m) => norm(m.name).includes(tag) && meshes.push(m))
    } else {
      const m = c.meshById?.get(focusId)
      if (m) meshes = [m]
    }
    if (!meshes.length) return
    const center = new THREE.Vector3()
    const box = new THREE.Box3()
    meshes.forEach((m) => {
      if (m.material.emissive) {
        m.userData._emi = m.material.emissive.getHex()
        m.material.emissive.setHex(0xf77000)
        m.material.emissiveIntensity = 0.7
      }
      if (m.userData.id) m.scale.setScalar(1.35)
      box.expandByObject(m)
    })
    c.lastHi = meshes
    box.getCenter(center)
    const size = box.getSize(new THREE.Vector3())
    c.flyTo(center, Math.max(size.x, size.y, size.z, 4) * 1.5)
  }, [focusId, items, matchKey])

  useEffect(() => {
    if (selectedId) setFocusId(selectedId)
  }, [selectedId])

  // --- carga de modelo glTF/GLB ---
  function addModel(root, name) {
    const c = ctx.current
    if (c.modelGroup) {
      c.scene.remove(c.modelGroup)
      c.modelGroup.traverse((o) => o.isMesh && (o.geometry?.dispose(), o.material?.dispose?.()))
    }
    const modelMeshes = []
    root.traverse((o) => {
      if (o.isMesh) {
        o.material = o.material.clone()
        o.userData._origColor = o.material.color?.getHex?.() ?? 0x999999
        modelMeshes.push(o)
      }
    })
    c.scene.add(root)
    c.modelGroup = root
    c.modelMeshes = modelMeshes
    c.schematicGroup.visible = false
    // aplica color por estado si corresponde
    if (colorByStatus) {
      modelMeshes.forEach((m) => {
        const id = resolveModelId(c, m)
        const row = id && items.find((r) => r._id === id)
        if (row) m.material.color.setHex(rowColor(row))
      })
    }
    c.frame(root)
    setModelName(name)
  }
  async function loadModelFile(file) {
    setLoadingModel(true)
    setModelError(null)
    try {
      const loader = new GLTFLoader()
      const isGlb = /\.glb$/i.test(file.name)
      const data = isGlb ? await file.arrayBuffer() : await file.text()
      loader.parse(data, '', (gltf) => { addModel(gltf.scene, file.name); setLoadingModel(false) }, () => { setModelError('No se pudo cargar el modelo.'); setLoadingModel(false) })
    } catch {
      setModelError('Archivo inválido.')
      setLoadingModel(false)
    }
  }
  function clearModel() {
    const c = ctx.current
    if (c.modelGroup) {
      c.scene.remove(c.modelGroup)
      c.modelGroup.traverse((o) => o.isMesh && (o.geometry?.dispose(), o.material?.dispose?.()))
      c.modelGroup = null
      c.modelMeshes = []
    }
    c.schematicGroup.visible = true
    c.frame(c.schematicGroup)
    setModelName(null)
    setModelError(null)
  }

  const focusRow = focusId ? items.find((r) => r._id === focusId) : null
  const views = [
    ['top', 'Planta'],
    ['iso', 'Iso'],
    ['north', 'Norte'],
    ['south', 'Sur'],
    ['east', 'Este'],
    ['west', 'Oeste'],
  ]

  return (
    <div className="flex h-full">
      {/* Lista de TAGs */}
      <div className="flex w-56 shrink-0 flex-col border-r border-slate-200 dark:border-white/10">
        <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-white/10">
          <Search className="h-4 w-4 text-slate-400" />
          <input value={listQuery} onChange={(e) => setListQuery(e.target.value)} placeholder="Buscar TAG…" className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none dark:text-slate-200" />
        </div>
        <label className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-white/10">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Vincular por</span>
          <select value={matchKey} onChange={(e) => setMatchKey(e.target.value)} title="Campo que coincide con el nombre del objeto en el modelo" className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700 focus:border-brand-400 focus:outline-none dark:border-white/10 dark:bg-ink-900 dark:text-slate-200">
            {headers.map((h) => <option key={h} value={h}>{h.replace(/_/g, ' ')}</option>)}
          </select>
        </label>
        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {listItems.map((r) => (
            <button
              key={r._id}
              onClick={() => { setFocusId(r._id); onFocus?.(r._id) }}
              className={['flex w-full items-center gap-2 truncate px-3 py-1.5 text-left font-mono text-xs transition', r._id === focusId ? 'bg-brand-500 text-white dark:bg-accent dark:text-ink-900' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5'].join(' ')}
            >
              <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: `#${rowColor(r).toString(16).padStart(6, '0')}` }} />
              <span className="truncate">{r[tagKey] || '—'}</span>
            </button>
          ))}
          {listItems.length === 0 && <p className="px-3 py-4 text-center text-xs text-slate-400">Sin elementos.</p>}
        </div>
      </div>

      {/* Canvas */}
      <div className="relative min-w-0 flex-1">
        <div ref={mountRef} className="h-full w-full" />

        {/* Barra superior: cargar modelo + vistas + herramientas */}
        <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
          <div className="pointer-events-auto flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" accept=".glb,.gltf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) loadModelFile(f); e.target.value = '' }} />
            <button onClick={() => fileRef.current?.click()} disabled={loadingModel} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow backdrop-blur transition hover:text-brand-600 disabled:opacity-60 dark:border-white/10 dark:bg-ink-800/90 dark:text-slate-200 dark:hover:text-accent">
              {loadingModel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {modelName ? 'Cambiar' : 'Cargar modelo'}
            </button>
            {modelName && (
              <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white/90 px-2 py-1.5 text-xs text-slate-600 shadow backdrop-blur dark:border-white/10 dark:bg-ink-800/90 dark:text-slate-300">
                <span className="max-w-[120px] truncate">{modelName}</span>
                <button onClick={clearModel} title="Quitar modelo" className="text-slate-400 hover:text-rose-500"><X className="h-3 w-3" /></button>
              </span>
            )}
            {modelError && <span className="rounded-lg bg-rose-500/90 px-2 py-1.5 text-xs font-medium text-white shadow">{modelError}</span>}
          </div>

          <div className="pointer-events-auto flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white/90 p-1 shadow backdrop-blur dark:border-white/10 dark:bg-ink-800/90">
            {views.map(([k, label]) => (
              <button key={k} onClick={() => ctx.current.setView?.(k)} className="rounded-md px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-brand-500 hover:text-white dark:text-slate-300 dark:hover:bg-accent dark:hover:text-ink-900">
                {label}
              </button>
            ))}
            <span className="mx-0.5 h-4 w-px bg-slate-200 dark:bg-white/10" />
            <button onClick={() => setColorByStatus((v) => !v)} title="Colorear por estado" className={['grid h-7 w-7 place-items-center rounded-md transition', colorByStatus ? 'bg-brand-500 text-white dark:bg-accent dark:text-ink-900' : 'text-slate-500 hover:text-brand-600 dark:text-slate-300'].join(' ')}>
              <Palette className="h-4 w-4" />
            </button>
            <button onClick={() => setMeasuring((v) => !v)} title="Medir distancia (clic en 2 puntos)" className={['grid h-7 w-7 place-items-center rounded-md transition', measuring ? 'bg-brand-500 text-white dark:bg-accent dark:text-ink-900' : 'text-slate-500 hover:text-brand-600 dark:text-slate-300'].join(' ')}>
              <Ruler className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Indicador de medición */}
        {measuring && (
          <div className="absolute left-1/2 top-16 -translate-x-1/2 rounded-lg border border-brand-300 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 shadow backdrop-blur dark:border-accent/40 dark:bg-ink-800/90 dark:text-slate-200">
            {measureDist != null ? <>Distancia: <b className="text-brand-600 dark:text-accent">{measureDist.toFixed(2)} u</b> · clic para reiniciar</> : 'Modo medición: clic en 2 puntos del modelo'}
          </div>
        )}

        {/* Ficha del elemento enfocado */}
        {focusRow && (
          <div className="absolute bottom-4 left-4 max-w-xs rounded-xl border border-slate-200 bg-white/90 p-3 shadow-lg backdrop-blur dark:border-white/10 dark:bg-ink-800/90">
            <p className="font-mono text-sm font-bold text-slate-900 dark:text-white">{focusRow[tagKey]}</p>
            <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{focusRow[headers[1]] ?? ''}</p>
            <button onClick={() => onSelect?.(focusRow._id)} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-600 dark:bg-accent dark:text-ink-900">Abrir ficha</button>
          </div>
        )}

        {/* Leyenda */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-1 rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-[11px] font-medium shadow backdrop-blur dark:border-white/10 dark:bg-ink-800/90">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Aprobado / en obra</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> En proceso</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-rose-500" /> Retenido / rechazado</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: '#586878' }} /> Sin estado</span>
        </div>

        {items.length === 0 && (
          <div className="absolute inset-0 grid place-items-center text-sm text-slate-400">
            <div className="flex flex-col items-center gap-2"><Box className="h-6 w-6" />Sin elementos para visualizar.</div>
          </div>
        )}
      </div>
    </div>
  )
}

function resolveModelId(c, mesh) {
  let o = mesh
  while (o) {
    if (o.name && c.nameToId?.has(norm(o.name))) return c.nameToId.get(norm(o.name))
    o = o.parent
  }
  return null
}
