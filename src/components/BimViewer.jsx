import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { Box, Loader2, Search, Upload, X } from 'lucide-react'

/**
 * Visor BIM 3D ligero (WebGL / three.js) con bidireccionalidad:
 *  - Clic en un TAG de la lista  → la cámara vuela al elemento y lo resalta.
 *  - Clic en un elemento del 3D  → se resalta y se selecciona en la lista.
 *  - Botón "Abrir ficha"         → abre la ficha de edición del elemento.
 *
 * Soporta dos fuentes de geometría:
 *  - Esquemática: un volumen por elemento (por defecto, sin modelo).
 *  - Modelo real: carga un archivo glTF/GLB; si los objetos del modelo tienen
 *    nombres que coinciden con los TAG, la bidireccionalidad opera sobre la
 *    geometría real (vuelo + resaltado al objeto correcto).
 *
 * props: rows (filas filtradas, con _id), headers, selectedId, onSelect(id)
 */
const CAP = 1500
const norm = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')

export default function BimViewer({ rows, headers, selectedId, onSelect }) {
  const mountRef = useRef(null)
  const fileRef = useRef(null)
  const ctx = useRef({})
  const [focusId, setFocusId] = useState(selectedId || null)
  const [listQuery, setListQuery] = useState('')
  const [modelName, setModelName] = useState(null)
  const [loadingModel, setLoadingModel] = useState(false)
  const [modelError, setModelError] = useState(null)
  const [matchKey, setMatchKey] = useState(headers[0])

  const tagKey = headers[0]
  const items = useMemo(() => rows.slice(0, CAP), [rows])
  const listItems = useMemo(() => {
    const q = listQuery.trim().toLowerCase()
    return q ? items.filter((r) => String(r[tagKey] ?? '').toLowerCase().includes(q)) : items
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, listQuery])

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

    const camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 5000)
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
    function onClick(e) {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const targets = ctx.current.modelGroup ? [ctx.current.modelGroup] : ctx.current.schematicMeshes || []
      const hits = raycaster.intersectObjects(targets, true)
      if (hits.length) {
        const id = resolveId(hits[0].object)
        if (id) setFocusId(id)
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

    ctx.current = {
      ...ctx.current,
      scene,
      renderer,
      camera,
      controls,
      schematicGroup,
      schematicMeshes: [],
      meshById: new Map(),
      nameToId: new Map(),
      modelGroup: null,
      setTheme,
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

  // --- (re)construye los volúmenes esquemáticos cuando cambian las filas ---
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
    const statusKey = headers.find((h) => /APROB/i.test(h)) || headers.find((h) => /AVANCE|ESTADO/i.test(h))

    items.forEach((r, i) => {
      const sv = String(r[statusKey] ?? '').toUpperCase()
      let color = 0x586878
      if (sv.includes('NO APROB') || sv.startsWith('E1') || sv.startsWith('E2')) color = 0xf77000
      else if (sv.includes('APROB') || sv.startsWith('E4')) color = 0x10b981

      const geo = new THREE.BoxGeometry(1.4, 1.4, 1.4)
      const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.1, roughness: 0.65 })
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
  }, [items, headers.join('|')])

  // --- mapa identificador → fila (campo de vínculo configurable) ---
  useEffect(() => {
    const map = new Map()
    items.forEach((r) => map.set(norm(r[matchKey]), r._id))
    ctx.current.nameToId = map
  }, [items, matchKey])

  // --- resalta y vuela al elemento enfocado ---
  useEffect(() => {
    const c = ctx.current
    if (!c.scene) return
    // reset resaltado previo
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
      c.modelGroup.traverse((o) => {
        if (o.isMesh) {
          o.geometry?.dispose()
          o.material?.dispose?.()
        }
      })
    }
    const modelMeshes = []
    root.traverse((o) => {
      if (o.isMesh) {
        o.material = o.material.clone() // material propio para resaltar sin sangrado
        modelMeshes.push(o)
      }
    })
    c.scene.add(root)
    c.modelGroup = root
    c.modelMeshes = modelMeshes
    c.schematicGroup.visible = false
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
      loader.parse(
        data,
        '',
        (gltf) => {
          addModel(gltf.scene, file.name)
          setLoadingModel(false)
        },
        () => {
          setModelError('No se pudo cargar el modelo.')
          setLoadingModel(false)
        },
      )
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

  return (
    <div className="flex h-full">
      {/* Lista de TAGs */}
      <div className="flex w-60 shrink-0 flex-col border-r border-slate-200 dark:border-white/10">
        <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-white/10">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={listQuery}
            onChange={(e) => setListQuery(e.target.value)}
            placeholder="Buscar TAG…"
            className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none dark:text-slate-200"
          />
        </div>
        <label className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-white/10">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Vincular 3D por</span>
          <select
            value={matchKey}
            onChange={(e) => setMatchKey(e.target.value)}
            title="Campo cuyo valor coincide con el nombre del objeto en el modelo BIM"
            className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700 focus:border-brand-400 focus:outline-none dark:border-white/10 dark:bg-ink-900 dark:text-slate-200"
          >
            {headers.map((h) => (
              <option key={h} value={h}>{h.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </label>
        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {listItems.map((r) => (
            <button
              key={r._id}
              onClick={() => setFocusId(r._id)}
              className={[
                'block w-full truncate px-3 py-1.5 text-left font-mono text-xs transition',
                r._id === focusId
                  ? 'bg-brand-500 text-white dark:bg-accent dark:text-ink-900'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5',
              ].join(' ')}
            >
              {r[tagKey] || '—'}
            </button>
          ))}
          {listItems.length === 0 && <p className="px-3 py-4 text-center text-xs text-slate-400">Sin elementos.</p>}
        </div>
      </div>

      {/* Canvas */}
      <div className="relative min-w-0 flex-1">
        <div ref={mountRef} className="h-full w-full" />

        {/* Cargar modelo */}
        <div className="absolute left-4 top-4 flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".glb,.gltf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) loadModelFile(f); e.target.value = '' }} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={loadingModel}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow backdrop-blur transition hover:text-brand-600 disabled:opacity-60 dark:border-white/10 dark:bg-ink-800/90 dark:text-slate-200 dark:hover:text-accent"
          >
            {loadingModel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {modelName ? 'Cambiar modelo' : 'Cargar modelo (.glb/.gltf)'}
          </button>
          {modelName && (
            <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white/90 px-2 py-1.5 text-xs text-slate-600 shadow backdrop-blur dark:border-white/10 dark:bg-ink-800/90 dark:text-slate-300">
              <span className="max-w-[140px] truncate">{modelName}</span>
              <button onClick={clearModel} title="Quitar modelo" className="text-slate-400 hover:text-rose-500"><X className="h-3 w-3" /></button>
            </span>
          )}
          {modelError && <span className="rounded-lg bg-rose-500/90 px-2 py-1.5 text-xs font-medium text-white shadow">{modelError}</span>}
        </div>

        {/* Tarjeta del elemento enfocado */}
        {focusRow && (
          <div className="absolute bottom-4 left-4 max-w-xs rounded-xl border border-slate-200 bg-white/90 p-3 shadow-lg backdrop-blur dark:border-white/10 dark:bg-ink-800/90">
            <p className="font-mono text-sm font-bold text-slate-900 dark:text-white">{focusRow[tagKey]}</p>
            <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{focusRow[headers[1]] ?? ''}</p>
            <button
              onClick={() => onSelect(focusRow._id)}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-600 dark:bg-accent dark:text-ink-900"
            >
              Abrir ficha
            </button>
          </div>
        )}

        {/* Leyenda */}
        <div className="absolute right-4 top-4 flex items-center gap-3 rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-[11px] font-medium shadow backdrop-blur dark:border-white/10 dark:bg-ink-800/90">
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Aprobado</span>
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-brand-500" /> Pendiente</span>
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: '#586878' }} /> Otro</span>
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
