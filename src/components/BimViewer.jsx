import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import {
  Box,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Layers,
  ListTree,
  Loader2,
  MapPin,
  Palette,
  Pause,
  Play,
  Ruler,
  Scissors,
  Search,
  StickyNote,
  Trash2,
  Upload,
  X,
} from 'lucide-react'

/**
 * Visor BIM 3D (three.js) — Niveles 1, 2 y 3.
 *
 * N1: selección cruzada, color por estado, vistas, medición, carga glTF/GLB.
 * N2: árbol de modelo (visibilidad por grupo/nodo), planos de corte, notas 3D.
 * N3: filtros visuales AWP (aislar por CWA/CWP/…) y simulación 4D (timeline
 *     que revela elementos según su fecha de instalación planificada).
 *
 * props: rows, headers, selectedId, onFocus(id), onSelect(id), dataKey
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
const NOTE_STATES = ['Abierta', 'En revisión', 'Resuelta']
const notesKey = (dk) => `sqy-notes-${dk}`
const parseDate = (v) => {
  if (v == null || v === '') return null
  const s = String(v)
  if (!/\d{4}-\d{1,2}|\d{1,2}\/\d{1,2}\/\d{2,4}/.test(s)) return null
  const t = Date.parse(s)
  return Number.isNaN(t) ? null : t
}
const fmtDate = (ms) => new Date(ms).toLocaleDateString('es-CL', { year: 'numeric', month: 'short', day: '2-digit' })

export default function BimViewer({ rows, headers, selectedId, onFocus, onSelect, dataKey, onRequestApsEngine }) {
  const mountRef = useRef(null)
  const fileRef = useRef(null)
  const ctx = useRef({})
  const [focusId, setFocusId] = useState(selectedId || null)
  const [listQuery, setListQuery] = useState('')
  const [matchKey, setMatchKey] = useState(headers[0])
  const [groupKey, setGroupKey] = useState(headers.find((h) => /ESPECIAL|CWA|SECTOR|TIPO/i.test(h)) || headers[0])
  const [modelName, setModelName] = useState(null)
  const [loadingModel, setLoadingModel] = useState(false)
  const [modelError, setModelError] = useState(null)
  const [colorByStatus, setColorByStatus] = useState(true)
  const [measuring, setMeasuring] = useState(false)
  const [measureDist, setMeasureDist] = useState(null)
  const [annotating, setAnnotating] = useState(false)
  const [panel, setPanel] = useState('list')
  const [showSections, setShowSections] = useState(false)
  const [sections, setSections] = useState({ x: { on: false, t: 0.5 }, y: { on: false, t: 0.5 }, z: { on: false, t: 0.5 } })
  const [hidden, setHidden] = useState(() => new Set())
  const [showAwp, setShowAwp] = useState(false)
  const [awp, setAwp] = useState({ field: '', value: '' })
  const [fourD, setFourD] = useState({ on: false, field: '', t: 1 })
  const [playing, setPlaying] = useState(false)
  const [editingNote, setEditingNote] = useState(null)
  const [notes, setNotes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(notesKey(dataKey))) || []
    } catch {
      return []
    }
  })
  const [tick, setTick] = useState(0)

  const tagKey = headers[0]
  const statusKeys = useMemo(() => headers.filter((h) => /APROB|AVANCE|ESTADO/i.test(h)), [headers])
  const items = useMemo(() => rows.slice(0, CAP), [rows])
  const listItems = useMemo(() => {
    const q = listQuery.trim().toLowerCase()
    return q ? items.filter((r) => String(r[tagKey] ?? '').toLowerCase().includes(q)) : items
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, listQuery])
  const groups = useMemo(() => {
    const m = new Map()
    items.forEach((r) => {
      const g = String(r[groupKey] ?? '—') || '—'
      if (!m.has(g)) m.set(g, [])
      m.get(g).push(r)
    })
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0], 'es'))
  }, [items, groupKey])

  const rowColor = (r) => (colorByStatus ? statusColor(statusKeys.map((k) => r[k]).join(' ')) : COLORS.gray)

  const awpFields = useMemo(() => headers.filter((h) => /CWA|CWP|EWP|PWP|IWP|SWP|WBS|AWP/i.test(h)), [headers])
  const dateFields = useMemo(() => {
    return headers.filter((h) => {
      let ok = 0
      let n = 0
      for (const r of items) {
        const v = r[h]
        if (v === '' || v == null) continue
        n++
        if (parseDate(v) != null) ok++
        if (n > 25) break
      }
      return n > 0 && ok / n > 0.5
    })
  }, [items, headers])
  const awpValues = useMemo(() => {
    if (!awp.field) return []
    const s = new Set()
    items.forEach((r) => r[awp.field] !== '' && r[awp.field] != null && s.add(String(r[awp.field])))
    return Array.from(s).sort()
  }, [items, awp.field])
  const dateRange = useMemo(() => {
    if (!fourD.field) return null
    let min = Infinity
    let max = -Infinity
    items.forEach((r) => {
      const d = parseDate(r[fourD.field])
      if (d != null) {
        if (d < min) min = d
        if (d > max) max = d
      }
    })
    return min <= max ? { min, max } : null
  }, [items, fourD.field])
  const currentDate = dateRange ? dateRange.min + (dateRange.max - dateRange.min) * fourD.t : null

  useEffect(() => { if (!awp.field && awpFields.length) setAwp((a) => ({ ...a, field: awpFields[0] })) }, [awpFields, awp.field])
  useEffect(() => { if (!fourD.field && dateFields.length) setFourD((f) => ({ ...f, field: dateFields[0] })) }, [dateFields, fourD.field])

  const rowVisible = (r) => {
    if (hidden.has(String(r[groupKey] ?? '—') || '—')) return false
    if (awp.field && awp.value && String(r[awp.field] ?? '') !== awp.value) return false
    if (fourD.on && fourD.field && currentDate != null) {
      const d = parseDate(r[fourD.field])
      if (d != null && d > currentDate) return false
    }
    return true
  }

  useEffect(() => {
    try {
      localStorage.setItem(notesKey(dataKey), JSON.stringify(notes))
    } catch {
      /* ignore */
    }
  }, [notes, dataKey])

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
    renderer.localClippingEnabled = true
    mount.appendChild(renderer.domElement)

    const camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 8000)
    camera.position.set(30, 28, 38)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08

    scene.add(new THREE.AmbientLight(0xffffff, 0.75))
    const dirL = new THREE.DirectionalLight(0xffffff, 1.1)
    dirL.position.set(40, 60, 30)
    scene.add(dirL)

    const schematicGroup = new THREE.Group()
    const measureGroup = new THREE.Group()
    const noteGroup = new THREE.Group()
    scene.add(schematicGroup, measureGroup, noteGroup)

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

    const ro = new ResizeObserver(() => {
      const nw = mount.clientWidth || 1
      const nh = mount.clientHeight || 1
      renderer.setSize(nw, nh)
      camera.aspect = nw / nh
      camera.updateProjectionMatrix()
    })
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
    function intersect(e, objs) {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      return raycaster.intersectObjects(objs, true)
    }
    function onClick(e) {
      const geomTargets = ctx.current.modelGroup ? [ctx.current.modelGroup] : ctx.current.schematicMeshes || []
      if (ctx.current.measuring) {
        const hit = intersect(e, geomTargets)[0]
        if (hit) ctx.current.addMeasurePoint(hit.point.clone())
        return
      }
      if (ctx.current.annotating) {
        const hit = intersect(e, geomTargets)[0]
        if (hit) ctx.current.addNote(hit.point.clone(), resolveId(hit.object))
        return
      }
      const noteHit = intersect(e, [noteGroup])[0]
      if (noteHit) {
        ctx.current.onNotePick?.(noteHit.object.userData.noteId)
        return
      }
      const hit = intersect(e, geomTargets)[0]
      if (hit) {
        const id = resolveId(hit.object)
        if (id) {
          setFocusId(id)
          ctx.current.onFocus?.(id)
          ctx.current.onSelect?.(id)
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
      noteGroup.children.forEach((m) => m.lookAt(camera.position))
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    const getBounds = () => {
      const obj = ctx.current.modelGroup || schematicGroup
      const b = new THREE.Box3().setFromObject(obj)
      if (b.isEmpty()) b.set(new THREE.Vector3(-10, -10, -10), new THREE.Vector3(10, 10, 10))
      return b
    }

    ctx.current = {
      ...ctx.current,
      scene, renderer, camera, controls, schematicGroup, measureGroup, noteGroup,
      schematicMeshes: [], meshById: new Map(), nameToId: new Map(), modelGroup: null,
      measuring: false, annotating: false, measurePts: [],
      onFocus, onSelect, getBounds,
      flyTo: (pos, dist = 9) => { target.copy(pos); camTarget.copy(pos).add(new THREE.Vector3(dist, dist * 0.85, dist)); flying = true },
      flyToPoint: (pos) => { const d = getBounds().getSize(new THREE.Vector3()).length() * 0.12 || 6; target.copy(pos); camTarget.copy(pos).add(new THREE.Vector3(d, d, d)); flying = true },
      frame: (obj) => {
        const box = new THREE.Box3().setFromObject(obj)
        if (box.isEmpty()) return
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())
        const d = (Math.max(size.x, size.y, size.z) || 10) * 1.6
        controls.target.copy(center)
        camera.position.copy(center).add(new THREE.Vector3(d, d * 0.8, d))
        camTarget.copy(camera.position); target.copy(center)
      },
      setView: (kind) => {
        const box = getBounds()
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
        target.copy(c); camTarget.copy(c).add(off); flying = true
      },
      addMeasurePoint: (p) => {
        const pts = ctx.current.measurePts
        if (pts.length === 2) { measureGroup.clear(); pts.length = 0; setMeasureDist(null) }
        pts.push(p)
        const rr = getBounds().getSize(new THREE.Vector3()).length() * 0.004
        const dot = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.15, rr), 12, 12), new THREE.MeshBasicMaterial({ color: 0xf77000 }))
        dot.position.copy(p); measureGroup.add(dot)
        if (pts.length === 2) {
          measureGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xf77000 })))
          setMeasureDist(pts[0].distanceTo(pts[1]))
        }
      },
      clearMeasure: () => { measureGroup.clear(); ctx.current.measurePts = []; setMeasureDist(null) },
      setClipping: (planes) => { renderer.clippingPlanes = planes },
    }

    const themeObserver = new MutationObserver(setTheme)
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    return () => {
      cancelAnimationFrame(raf)
      themeObserver.disconnect(); ro.disconnect()
      renderer.domElement.removeEventListener('click', onClick)
      controls.dispose(); renderer.dispose()
      // Libera el contexto WebGL de la GPU. Sin esto, abrir/cerrar el visor
      // varias veces agota el límite de contextos (~16) del navegador y el
      // siguiente WebGLRenderer falla ("addEventListener is not a function").
      renderer.forceContextLoss?.()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { ctx.current.onFocus = onFocus; ctx.current.onSelect = onSelect }, [onFocus, onSelect])
  useEffect(() => { ctx.current.measuring = measuring; if (!measuring) ctx.current.clearMeasure?.() }, [measuring])
  useEffect(() => { ctx.current.annotating = annotating }, [annotating])

  // volúmenes esquemáticos
  useEffect(() => {
    const c = ctx.current
    if (!c.scene) return
    c.schematicMeshes.forEach((m) => { c.schematicGroup.remove(m); m.geometry.dispose(); m.material.dispose() })
    const meshes = []
    const meshById = new Map()
    const cols = Math.max(1, Math.ceil(Math.sqrt(items.length)))
    items.forEach((r, i) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 1.4, 1.4),
        new THREE.MeshStandardMaterial({ color: rowColor(r), metalness: 0.1, roughness: 0.65 }),
      )
      mesh.position.set((i % cols) * 2.4 - (cols * 2.4) / 2, 0, Math.floor(i / cols) * 2.4 - (cols * 2.4) / 2)
      mesh.userData.id = r._id
      mesh.userData.group = String(r[groupKey] ?? '—') || '—'
      mesh.visible = rowVisible(r)
      c.schematicGroup.add(mesh); meshes.push(mesh); meshById.set(r._id, mesh)
    })
    c.schematicMeshes = meshes; c.meshById = meshById
    c.schematicGroup.visible = !c.modelGroup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, headers.join('|'), colorByStatus, groupKey])

  // visibilidad combinada (grupo + AWP + 4D)
  useEffect(() => {
    const c = ctx.current
    if (!c.scene) return
    const byId = new Map(items.map((r) => [r._id, r]))
    c.schematicMeshes?.forEach((m) => { const r = byId.get(m.userData.id); m.visible = r ? rowVisible(r) : true })
    if (c.modelGroup && c.modelMeshes) {
      c.modelMeshes.forEach((m) => { const id = resolveModelId(c, m); const r = id && byId.get(id); m.visible = r ? rowVisible(r) : true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidden, awp, fourD, currentDate, items, groupKey, tick])

  useEffect(() => {
    if (!playing || !fourD.on || !dateRange) return
    const id = setInterval(() => setFourD((f) => ({ ...f, t: Math.min(1, f.t + 0.012) })), 90)
    return () => clearInterval(id)
  }, [playing, fourD.on, dateRange])
  useEffect(() => { if (playing && fourD.t >= 1) setPlaying(false) }, [fourD.t, playing])

  useEffect(() => {
    const map = new Map()
    items.forEach((r) => map.set(norm(r[matchKey]), r._id))
    ctx.current.nameToId = map
  }, [items, matchKey])

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

  useEffect(() => {
    const c = ctx.current
    if (!c.scene) return
    if (c.lastHi) c.lastHi.forEach((m) => { m.material.emissive?.setHex(m.userData._emi ?? 0x000000); if (m.userData.id) m.scale.setScalar(1) })
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
    const box = new THREE.Box3()
    meshes.forEach((m) => {
      if (m.material.emissive) { m.userData._emi = m.material.emissive.getHex(); m.material.emissive.setHex(0xf77000); m.material.emissiveIntensity = 0.7 }
      if (m.userData.id) m.scale.setScalar(1.35)
      box.expandByObject(m)
    })
    c.lastHi = meshes
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    c.flyTo(center, Math.max(size.x, size.y, size.z, 4) * 1.5)
  }, [focusId, items, matchKey])

  useEffect(() => { if (selectedId) setFocusId(selectedId) }, [selectedId])

  // planos de corte
  useEffect(() => {
    const c = ctx.current
    if (!c.setClipping) return
    const b = c.getBounds()
    const lerp = (a, z, t) => a + (z - a) * t
    const planes = []
    if (sections.x.on) planes.push(new THREE.Plane(new THREE.Vector3(-1, 0, 0), lerp(b.min.x, b.max.x, sections.x.t)))
    if (sections.y.on) planes.push(new THREE.Plane(new THREE.Vector3(0, -1, 0), lerp(b.min.y, b.max.y, sections.y.t)))
    if (sections.z.on) planes.push(new THREE.Plane(new THREE.Vector3(0, 0, -1), lerp(b.min.z, b.max.z, sections.z.t)))
    c.setClipping(planes)
  }, [sections, modelName, items])

  // marcadores de notas
  useEffect(() => {
    const c = ctx.current
    if (!c.noteGroup) return
    c.noteGroup.clear()
    const rr = (c.getBounds().getSize(new THREE.Vector3()).length() || 40) * 0.012
    notes.forEach((n) => {
      const color = n.status === 'Resuelta' ? 0x10b981 : n.status === 'En revisión' ? 0xf59e0b : 0xef4444
      const m = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.4, rr), 14, 14), new THREE.MeshBasicMaterial({ color }))
      m.position.set(n.x, n.y, n.z)
      m.userData.noteId = n.id
      c.noteGroup.add(m)
    })
  }, [notes])

  useEffect(() => {
    ctx.current.addNote = (point, elementId) => {
      const n = { id: `n${Date.now().toString(36)}`, x: point.x, y: point.y, z: point.z, text: '', status: 'Abierta', elementId: elementId || null, createdAt: new Date().toISOString() }
      setNotes((prev) => [...prev, n])
      setPanel('notes')
      setAnnotating(false)
      setEditingNote(n.id)
    }
    ctx.current.onNotePick = (id) => {
      setPanel('notes'); setEditingNote(id)
      const n = notes.find((x) => x.id === id)
      if (n) ctx.current.flyToPoint?.(new THREE.Vector3(n.x, n.y, n.z))
    }
  }, [notes])

  // --- carga glTF/GLB ---
  function addModel(root, name) {
    const c = ctx.current
    if (c.modelGroup) { c.scene.remove(c.modelGroup); c.modelGroup.traverse((o) => o.isMesh && (o.geometry?.dispose(), o.material?.dispose?.())) }
    const modelMeshes = []
    root.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.userData._origColor = o.material.color?.getHex?.() ?? 0x999999; modelMeshes.push(o) } })
    c.scene.add(root); c.modelGroup = root; c.modelMeshes = modelMeshes; c.schematicGroup.visible = false
    if (colorByStatus) modelMeshes.forEach((m) => { const id = resolveModelId(c, m); const row = id && items.find((r) => r._id === id); if (row) m.material.color.setHex(rowColor(row)) })
    c.frame(root); setModelName(name); setTick((t) => t + 1)
  }
  async function loadModelFile(file) {
    // Formatos propietarios (NWD/RVT/IFC…) no los lee three.js: requieren APS.
    if (/\.(nwd|nwc|rvt|rfa|ifc|dwg|dwf|dwfx|nwf)$/i.test(file.name)) {
      setModelError('proprietary')
      return
    }
    setLoadingModel(true); setModelError(null)
    try {
      const loader = new GLTFLoader()
      const data = /\.glb$/i.test(file.name) ? await file.arrayBuffer() : await file.text()
      loader.parse(data, '', (gltf) => { addModel(gltf.scene, file.name); setLoadingModel(false) }, () => { setModelError('No se pudo cargar el modelo.'); setLoadingModel(false) })
    } catch { setModelError('Archivo inválido.'); setLoadingModel(false) }
  }
  function clearModel() {
    const c = ctx.current
    if (c.modelGroup) { c.scene.remove(c.modelGroup); c.modelGroup.traverse((o) => o.isMesh && (o.geometry?.dispose(), o.material?.dispose?.())); c.modelGroup = null; c.modelMeshes = [] }
    c.schematicGroup.visible = true; c.frame(c.schematicGroup); setModelName(null); setModelError(null); setTick((t) => t + 1)
  }

  function toggleGroup(g) { setHidden((prev) => { const n = new Set(prev); n.has(g) ? n.delete(g) : n.add(g); return n }) }
  function updateNote(id, patch) { setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n))) }
  function deleteNote(id) { setNotes((prev) => prev.filter((n) => n.id !== id)); if (editingNote === id) setEditingNote(null) }
  function gotoNote(id) { setEditingNote(id); const n = notes.find((x) => x.id === id); if (n) ctx.current.flyToPoint?.(new THREE.Vector3(n.x, n.y, n.z)) }

  const focusRow = focusId ? items.find((r) => r._id === focusId) : null
  const views = [['top', 'Planta'], ['iso', 'Iso'], ['north', 'N'], ['south', 'S'], ['east', 'E'], ['west', 'O']]

  return (
    <div className="flex h-full">
      {/* Panel izquierdo */}
      <div className="flex w-60 shrink-0 flex-col border-r border-slate-200 dark:border-white/10">
        <div className="flex border-b border-slate-200 dark:border-white/10">
          {[['list', 'Lista'], ['tree', 'Árbol'], ['notes', `Notas${notes.length ? ` (${notes.length})` : ''}`]].map(([id, label]) => (
            <button key={id} onClick={() => setPanel(id)} className={['flex-1 px-2 py-2 text-xs font-semibold transition', panel === id ? 'border-b-2 border-brand-500 text-brand-600 dark:border-accent dark:text-accent' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'].join(' ')}>{label}</button>
          ))}
        </div>

        {panel === 'list' && (
          <>
            <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-white/10">
              <Search className="h-4 w-4 text-slate-400" />
              <input value={listQuery} onChange={(e) => setListQuery(e.target.value)} placeholder="Buscar TAG…" className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none dark:text-slate-200" />
            </div>
            <label className="flex items-center gap-2 border-b border-slate-200 px-3 py-1.5 dark:border-white/10">
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Vínculo</span>
              <select value={matchKey} onChange={(e) => setMatchKey(e.target.value)} title="Campo que coincide con el nombre del objeto del modelo" className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700 dark:border-white/10 dark:bg-ink-900 dark:text-slate-200">
                {headers.map((h) => <option key={h} value={h}>{h.replace(/_/g, ' ')}</option>)}
              </select>
            </label>
            <div className="min-h-0 flex-1 overflow-y-auto py-1">
              {listItems.map((r) => (
                <button key={r._id} onClick={() => { setFocusId(r._id); onFocus?.(r._id) }} className={['flex w-full items-center gap-2 truncate px-3 py-1.5 text-left font-mono text-xs transition', r._id === focusId ? 'bg-brand-500 text-white dark:bg-accent dark:text-ink-900' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5'].join(' ')}>
                  <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: `#${rowColor(r).toString(16).padStart(6, '0')}` }} />
                  <span className="truncate">{r[tagKey] || '—'}</span>
                </button>
              ))}
              {listItems.length === 0 && <p className="px-3 py-4 text-center text-xs text-slate-400">Sin elementos.</p>}
            </div>
          </>
        )}

        {panel === 'tree' && (
          <ModelTree modelGroup={ctx.current.modelGroup} tick={tick} groups={groups} groupKey={groupKey} setGroupKey={setGroupKey} headers={headers} hidden={hidden} toggleGroup={toggleGroup} onFocusRow={(id) => { setFocusId(id); onFocus?.(id) }} focusId={focusId} />
        )}

        {panel === 'notes' && (
          <NotesPanel notes={notes} editingNote={editingNote} setEditingNote={gotoNote} updateNote={updateNote} deleteNote={deleteNote} startAnnotate={() => setAnnotating(true)} annotating={annotating} />
        )}
      </div>

      {/* Canvas */}
      <div className="relative min-w-0 flex-1">
        <div ref={mountRef} className="h-full w-full" />

        {/* Barra superior */}
        <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
          <div className="pointer-events-auto flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" accept=".glb,.gltf,.nwd,.nwc,.rvt,.ifc,.dwg" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) loadModelFile(f); e.target.value = '' }} />
            <button onClick={() => fileRef.current?.click()} disabled={loadingModel} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow backdrop-blur transition hover:text-brand-600 disabled:opacity-60 dark:border-white/10 dark:bg-ink-800/90 dark:text-slate-200 dark:hover:text-accent">
              {loadingModel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {modelName ? 'Cambiar' : 'Cargar modelo'}
            </button>
            {modelName && (
              <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white/90 px-2 py-1.5 text-xs text-slate-600 shadow backdrop-blur dark:border-white/10 dark:bg-ink-800/90 dark:text-slate-300">
                <span className="max-w-[110px] truncate">{modelName}</span>
                <button onClick={clearModel} title="Quitar modelo" className="text-slate-400 hover:text-rose-500"><X className="h-3 w-3" /></button>
              </span>
            )}
            {modelError && modelError !== 'proprietary' && <span className="rounded-lg bg-rose-500/90 px-2 py-1.5 text-xs font-medium text-white shadow">{modelError}</span>}
          </div>

          <div className="pointer-events-auto flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white/90 p-1 shadow backdrop-blur dark:border-white/10 dark:bg-ink-800/90">
            {views.map(([k, label]) => (
              <button key={k} onClick={() => ctx.current.setView?.(k)} className="rounded-md px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-brand-500 hover:text-white dark:text-slate-300 dark:hover:bg-accent dark:hover:text-ink-900">{label}</button>
            ))}
            <span className="mx-0.5 h-4 w-px bg-slate-200 dark:bg-white/10" />
            <ToolBtn active={colorByStatus} onClick={() => setColorByStatus((v) => !v)} title="Color por estado"><Palette className="h-4 w-4" /></ToolBtn>
            <ToolBtn active={showSections} onClick={() => setShowSections((v) => !v)} title="Planos de corte"><Scissors className="h-4 w-4" /></ToolBtn>
            <ToolBtn active={measuring} onClick={() => { setMeasuring((v) => !v); setAnnotating(false) }} title="Medir distancia"><Ruler className="h-4 w-4" /></ToolBtn>
            <ToolBtn active={annotating} onClick={() => { setAnnotating((v) => !v); setMeasuring(false) }} title="Anotar (clic en el modelo)"><MapPin className="h-4 w-4" /></ToolBtn>
            <span className="mx-0.5 h-4 w-px bg-slate-200 dark:bg-white/10" />
            <ToolBtn active={showAwp} onClick={() => setShowAwp((v) => !v)} title="Filtro visual AWP (aislar CWA/CWP…)"><Layers className="h-4 w-4" /></ToolBtn>
            <ToolBtn active={fourD.on} onClick={() => setFourD((f) => ({ ...f, on: !f.on }))} title="Simulación de construcción 4D"><CalendarRange className="h-4 w-4" /></ToolBtn>
          </div>
        </div>

        {/* Panel filtro AWP */}
        {showAwp && (
          <div className="absolute left-3 top-16 w-60 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur dark:border-white/10 dark:bg-ink-800/95">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-white"><Layers className="h-4 w-4 text-brand-500" /> Filtro visual AWP</p>
            <label className="mb-2 block">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Campo</span>
              <select value={awp.field} onChange={(e) => setAwp({ field: e.target.value, value: '' })} className="mt-0.5 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 dark:border-white/10 dark:bg-ink-900 dark:text-slate-200">
                {(awpFields.length ? awpFields : headers).map((h) => <option key={h} value={h}>{h.replace(/_/g, ' ')}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Aislar valor</span>
              <select value={awp.value} onChange={(e) => setAwp((a) => ({ ...a, value: e.target.value }))} className="mt-0.5 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 dark:border-white/10 dark:bg-ink-900 dark:text-slate-200">
                <option value="">— Mostrar todo —</option>
                {awpValues.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            {awp.value && <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">Mostrando solo <b className="text-brand-600 dark:text-accent">{awp.value}</b>; el resto se oculta.</p>}
          </div>
        )}

        {/* Panel de secciones */}
        {showSections && (
          <div className="absolute right-3 top-16 w-56 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur dark:border-white/10 dark:bg-ink-800/95">
            <p className="mb-2 text-xs font-bold text-slate-700 dark:text-white">Planos de corte</p>
            {['x', 'y', 'z'].map((ax) => (
              <div key={ax} className="mb-2">
                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <input type="checkbox" checked={sections[ax].on} onChange={() => setSections((s) => ({ ...s, [ax]: { ...s[ax], on: !s[ax].on } }))} className="accent-brand-500 dark:accent-accent" />
                  Eje {ax.toUpperCase()}
                </label>
                <input type="range" min="0" max="1" step="0.01" value={sections[ax].t} disabled={!sections[ax].on} onChange={(e) => setSections((s) => ({ ...s, [ax]: { ...s[ax], t: parseFloat(e.target.value) } }))} className="mt-1 w-full accent-brand-500 disabled:opacity-40 dark:accent-accent" />
              </div>
            ))}
            <button onClick={() => setSections({ x: { on: false, t: 0.5 }, y: { on: false, t: 0.5 }, z: { on: false, t: 0.5 } })} className="mt-1 text-[11px] text-slate-500 hover:text-rose-500">Restablecer cortes</button>
          </div>
        )}

        {(measuring || annotating) && (
          <div className="absolute left-1/2 top-16 -translate-x-1/2 rounded-lg border border-brand-300 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 shadow backdrop-blur dark:border-accent/40 dark:bg-ink-800/90 dark:text-slate-200">
            {measuring ? (measureDist != null ? <>Distancia: <b className="text-brand-600 dark:text-accent">{measureDist.toFixed(2)} u</b> · clic para reiniciar</> : 'Medición: clic en 2 puntos') : 'Anotación: clic sobre el modelo para fijar la nota'}
          </div>
        )}

        {/* Timeline 4D */}
        {fourD.on && (
          <div className="absolute bottom-4 left-1/2 w-[min(680px,72%)] -translate-x-1/2 rounded-xl border border-slate-200 bg-white/95 px-4 py-2.5 shadow-lg backdrop-blur dark:border-white/10 dark:bg-ink-800/95">
            {dateRange ? (
              <div className="flex items-center gap-3">
                <button onClick={() => { if (fourD.t >= 1) setFourD((f) => ({ ...f, t: 0 })); setPlaying((p) => !p) }} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-500 text-white transition hover:bg-brand-600 dark:bg-accent dark:text-ink-900">
                  {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    <span>{fmtDate(dateRange.min)}</span>
                    <span className="font-bold text-brand-600 dark:text-accent">{currentDate != null ? fmtDate(currentDate) : ''}</span>
                    <span>{fmtDate(dateRange.max)}</span>
                  </div>
                  <input type="range" min="0" max="1" step="0.005" value={fourD.t} onChange={(e) => setFourD((f) => ({ ...f, t: parseFloat(e.target.value) }))} className="w-full accent-brand-500 dark:accent-accent" />
                </div>
                <select value={fourD.field} onChange={(e) => setFourD((f) => ({ ...f, field: e.target.value, t: 1 }))} title="Campo de fecha planificada" className="shrink-0 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700 dark:border-white/10 dark:bg-ink-900 dark:text-slate-200">
                  {(dateFields.length ? dateFields : headers).map((h) => <option key={h} value={h}>{h.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
            ) : (
              <p className="text-center text-xs text-slate-500 dark:text-slate-400">Sin campo de fecha detectado. Elige uno en la base de datos (p. ej. ETA) para la simulación 4D.</p>
            )}
          </div>
        )}

        {focusRow && !fourD.on && (
          <div className="absolute bottom-4 left-4 max-w-xs rounded-xl border border-slate-200 bg-white/90 p-3 shadow-lg backdrop-blur dark:border-white/10 dark:bg-ink-800/90">
            <p className="font-mono text-sm font-bold text-slate-900 dark:text-white">{focusRow[tagKey]}</p>
            <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{focusRow[headers[1]] ?? ''}</p>
            <button onClick={() => onSelect?.(focusRow._id)} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-600 dark:bg-accent dark:text-ink-900">Abrir ficha</button>
          </div>
        )}

        <div className="absolute right-4 top-16 flex flex-col gap-1 rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-[11px] font-medium shadow backdrop-blur dark:border-white/10 dark:bg-ink-800/90" style={{ display: showSections ? 'none' : undefined }}>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Aprobado / en obra</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> En proceso</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-rose-500" /> Retenido / rechazado</span>
        </div>

        {items.length === 0 && (
          <div className="absolute inset-0 grid place-items-center text-sm text-slate-400">
            <div className="flex flex-col items-center gap-2"><Box className="h-6 w-6" />Sin elementos para visualizar.</div>
          </div>
        )}

        {/* Aviso: formato propietario (NWD/RVT/IFC) -> requiere el motor APS */}
        {modelError === 'proprietary' && (
          <div className="absolute inset-0 z-20 grid place-items-center p-4">
            <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm dark:bg-black/50" onClick={() => setModelError(null)} />
            <div className="relative max-w-sm rounded-xl border border-slate-200 bg-white p-5 text-center shadow-2xl dark:border-white/10 dark:bg-ink-800">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
                <Box className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Formato no compatible con el 3D propio</h3>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                Los archivos <b>NWD, RVT, IFC</b> son formatos de Autodesk y solo se pueden ver con el motor <b>APS (real)</b>. El 3D propio admite glTF/GLB.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <button onClick={() => setModelError(null)} className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/15 dark:bg-ink-800 dark:text-slate-300 dark:hover:bg-white/5">Cancelar</button>
                {onRequestApsEngine && (
                  <button onClick={() => { setModelError(null); onRequestApsEngine() }} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 dark:bg-accent dark:text-ink-900">
                    Cambiar a APS (real)
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ToolBtn({ active, onClick, title, children }) {
  return (
    <button onClick={onClick} title={title} className={['grid h-7 w-7 place-items-center rounded-md transition', active ? 'bg-brand-500 text-white dark:bg-accent dark:text-ink-900' : 'text-slate-500 hover:text-brand-600 dark:text-slate-300'].join(' ')}>{children}</button>
  )
}

function ModelTree({ modelGroup, tick, groups, groupKey, setGroupKey, headers, hidden, toggleGroup, onFocusRow, focusId }) {
  void tick
  if (modelGroup) return <GltfTree root={modelGroup} />
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <label className="flex items-center gap-2 border-b border-slate-200 px-3 py-1.5 dark:border-white/10">
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Agrupar</span>
        <select value={groupKey} onChange={(e) => setGroupKey(e.target.value)} className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700 dark:border-white/10 dark:bg-ink-900 dark:text-slate-200">
          {headers.map((h) => <option key={h} value={h}>{h.replace(/_/g, ' ')}</option>)}
        </select>
      </label>
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {groups.map(([g, rs]) => (
          <GroupNode key={g} name={g} rows={rs} hidden={hidden.has(g)} onToggle={() => toggleGroup(g)} onFocusRow={onFocusRow} focusId={focusId} tagKey={headers[0]} />
        ))}
      </div>
    </div>
  )
}

function GroupNode({ name, rows, hidden, onToggle, onFocusRow, focusId, tagKey }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <div className={['flex items-center gap-1 px-2 py-1.5 text-xs', hidden ? 'opacity-50' : ''].join(' ')}>
        <button onClick={() => setOpen((v) => !v)} className="text-slate-400 hover:text-slate-600">{open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</button>
        <button onClick={onToggle} title="Mostrar/ocultar grupo" className="text-slate-400 hover:text-brand-600 dark:hover:text-accent">{hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>
        <span className="min-w-0 flex-1 truncate font-semibold text-slate-700 dark:text-slate-200" title={name}>{name}</span>
        <span className="shrink-0 text-[10px] text-slate-400">{rows.length}</span>
      </div>
      {open && (
        <div className="ml-6">
          {rows.slice(0, 200).map((r) => (
            <button key={r._id} onClick={() => onFocusRow(r._id)} className={['block w-full truncate px-2 py-1 text-left font-mono text-[11px] transition', r._id === focusId ? 'bg-brand-500 text-white dark:bg-accent dark:text-ink-900' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5'].join(' ')}>{r[tagKey] || '—'}</button>
          ))}
          {rows.length > 200 && <p className="px-2 py-1 text-[10px] text-slate-400">+{rows.length - 200} más…</p>}
        </div>
      )}
    </div>
  )
}

function GltfTree({ root }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto py-1">
      <p className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400"><ListTree className="h-3.5 w-3.5" /> Jerarquía del modelo</p>
      {root.children.map((c, i) => <GltfNode key={c.uuid || i} obj={c} depth={0} />)}
    </div>
  )
}

function GltfNode({ obj, depth }) {
  const [open, setOpen] = useState(depth < 1)
  const [, force] = useState(0)
  const kids = obj.children?.filter((c) => c.type !== 'Bone') || []
  const name = obj.name || obj.type || 'Objeto'
  return (
    <div>
      <div className="flex items-center gap-1 py-1 pr-2 text-xs" style={{ paddingLeft: 8 + depth * 12 }}>
        {kids.length ? (
          <button onClick={() => setOpen((v) => !v)} className="text-slate-400 hover:text-slate-600">{open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</button>
        ) : <span className="w-3.5" />}
        <button onClick={() => { obj.visible = !obj.visible; force((n) => n + 1) }} title="Mostrar/ocultar" className="text-slate-400 hover:text-brand-600 dark:hover:text-accent">{obj.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}</button>
        <span className={['min-w-0 flex-1 truncate', obj.visible ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 line-through'].join(' ')} title={name}>{name}</span>
      </div>
      {open && kids.map((c, i) => <GltfNode key={c.uuid || i} obj={c} depth={depth + 1} />)}
    </div>
  )
}

function NotesPanel({ notes, editingNote, setEditingNote, updateNote, deleteNote, startAnnotate, annotating }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-slate-200 p-2 dark:border-white/10">
        <button onClick={startAnnotate} className={['flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition', annotating ? 'bg-brand-600 text-white' : 'bg-brand-500 text-white hover:bg-brand-600 dark:bg-accent dark:text-ink-900'].join(' ')}>
          <MapPin className="h-3.5 w-3.5" /> {annotating ? 'Clic en el modelo…' : 'Nueva anotación'}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {notes.length === 0 && <p className="px-1 py-4 text-center text-xs text-slate-400">Sin anotaciones. Crea una sobre una interferencia del modelo.</p>}
        {notes.map((n) => (
          <div key={n.id} className={['mb-2 rounded-lg border p-2 text-xs transition', editingNote === n.id ? 'border-brand-400 bg-brand-50/50 dark:border-accent/40 dark:bg-accent/5' : 'border-slate-200 dark:border-white/10'].join(' ')}>
            <div className="flex items-center gap-2">
              <StickyNote className="h-3.5 w-3.5 shrink-0 text-brand-500" />
              <select value={n.status} onChange={(e) => updateNote(n.id, { status: e.target.value })} className="flex-1 rounded border border-slate-200 bg-white px-1 py-0.5 text-[11px] dark:border-white/10 dark:bg-ink-900 dark:text-slate-200">
                {NOTE_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={() => deleteNote(n.id)} className="text-slate-400 hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
            <textarea value={n.text} onFocus={() => setEditingNote(n.id)} onChange={(e) => updateNote(n.id, { text: e.target.value })} placeholder="Describe la interferencia / observación…" rows={2} className="mt-2 w-full resize-y rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 focus:border-brand-400 focus:outline-none dark:border-white/10 dark:bg-ink-900 dark:text-slate-200" />
            <button onClick={() => setEditingNote(n.id)} className="mt-1 text-[10px] font-medium text-brand-600 hover:underline dark:text-accent">Ir a la nota</button>
          </div>
        ))}
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
