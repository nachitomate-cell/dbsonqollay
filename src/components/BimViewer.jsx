import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Box, Search } from 'lucide-react'

/**
 * Visor BIM 3D ligero (WebGL / three.js) con bidireccionalidad:
 *  - Clic en un TAG de la lista  → la cámara vuela al elemento y lo resalta.
 *  - Clic en un elemento del 3D  → se resalta y se selecciona en la lista.
 *  - Botón "Abrir ficha"         → abre la ficha de edición del elemento.
 *
 * Es una representación esquemática (un volumen por elemento) pensada como base
 * para conectar luego un modelo real (IFC/glTF o Autodesk Platform Services).
 *
 * props: rows (filas filtradas, con _id), headers, selectedId, onSelect(id)
 */
const CAP = 1500

export default function BimViewer({ rows, headers, selectedId, onSelect }) {
  const mountRef = useRef(null)
  const three = useRef({})
  const [focusId, setFocusId] = useState(selectedId || null)
  const [listQuery, setListQuery] = useState('')

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

    const camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 2000)
    camera.position.set(30, 28, 38)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08

    scene.add(new THREE.AmbientLight(0xffffff, 0.75))
    const dir = new THREE.DirectionalLight(0xffffff, 1.1)
    dir.position.set(40, 60, 30)
    scene.add(dir)

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const target = new THREE.Vector3(0, 0, 0)
    const camTarget = new THREE.Vector3().copy(camera.position)
    let flying = false
    let raf

    function setTheme() {
      const dark = document.documentElement.classList.contains('dark')
      scene.background = new THREE.Color(dark ? 0x0c1116 : 0xeef1f4)
      if (three.current.grid) scene.remove(three.current.grid)
      const grid = new THREE.GridHelper(400, 80, dark ? 0x33414f : 0xc3ccd6, dark ? 0x1a232e : 0xdce2e8)
      grid.position.y = -0.6
      scene.add(grid)
      three.current.grid = grid
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

    function onClick(e) {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects(three.current.meshes || [], false)
      if (hits.length) setFocusId(hits[0].object.userData.id)
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

    three.current = {
      ...three.current,
      scene,
      renderer,
      camera,
      controls,
      meshes: [],
      meshById: new Map(),
      flyTo: (pos) => {
        target.copy(pos)
        camTarget.copy(pos).add(new THREE.Vector3(8, 7, 8))
        flying = true
      },
      setTheme,
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

  // --- (re)construye los volúmenes cuando cambian las filas ---
  useEffect(() => {
    const ctx = three.current
    if (!ctx.scene) return
    ctx.meshes.forEach((m) => {
      ctx.scene.remove(m)
      m.geometry.dispose()
      m.material.dispose()
    })
    const meshes = []
    const meshById = new Map()
    const cols = Math.max(1, Math.ceil(Math.sqrt(items.length)))
    const statusKey = headers.find((h) => /APROB/i.test(h)) || headers.find((h) => /AVANCE|ESTADO/i.test(h))

    items.forEach((r, i) => {
      const sv = String(r[statusKey] ?? '').toUpperCase()
      let color = 0x586878 // steel por defecto
      if (sv.includes('NO APROB') || sv.startsWith('E1') || sv.startsWith('E2')) color = 0xf77000 // naranja marca
      else if (sv.includes('APROB') || sv.startsWith('E4')) color = 0x10b981 // verde

      const geo = new THREE.BoxGeometry(1.4, 1.4, 1.4)
      const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.1, roughness: 0.65 })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set((i % cols) * 2.4 - (cols * 2.4) / 2, 0, Math.floor(i / cols) * 2.4 - (cols * 2.4) / 2)
      mesh.userData.id = r._id
      mesh.userData.baseColor = color
      ctx.scene.add(mesh)
      meshes.push(mesh)
      meshById.set(r._id, mesh)
    })
    ctx.meshes = meshes
    ctx.meshById = meshById
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, headers.join('|')])

  // --- resalta y vuela al elemento enfocado ---
  useEffect(() => {
    const ctx = three.current
    if (!ctx.meshById) return
    ctx.meshes?.forEach((m) => {
      m.material.emissive?.setHex(0x000000)
      m.scale.setScalar(1)
    })
    const mesh = focusId && ctx.meshById.get(focusId)
    if (mesh) {
      mesh.material.emissive?.setHex(0xf77000)
      mesh.material.emissiveIntensity = 0.6
      mesh.scale.setScalar(1.35)
      ctx.flyTo?.(mesh.position)
    }
  }, [focusId, items])

  useEffect(() => {
    if (selectedId) setFocusId(selectedId)
  }, [selectedId])

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
