import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import * as THREE from 'three'
import { supabase } from '@/lib/supabase'

type Room = { id: string; name: string; photos: string[]; caption?: string }
type Tour = { title: string; slug: string; rooms: Room[] }

// Medidas em metros. Divisões em linha, ligadas por portas abertas.
const W = 6        // largura de cada divisão
const D = 5        // profundidade
const H = 2.7      // pé-direito
const EYE = 1.65   // altura dos olhos
const DOOR = 1.6   // largura das portas
const SPEED = 2.2  // m/s
const TURN = 1.8   // rad/s
const GUIDE_MS = 90000 // duração do modo tour guiado

/** Visita virtual de um imóvel: cada divisão tem as fotos nas paredes; anda-se com setas (PC) ou botões (telemóvel). */
export default function PublicTour() {
  const { slug = '' } = useParams()
  const [tour, setTour] = useState<Tour | null | undefined>(undefined)
  const [current, setCurrent] = useState('')
  const [caption, setCaption] = useState('')
  const [guiding, setGuiding] = useState(false)
  const guide = useRef<{ start: () => void; stop: () => void } | null>(null)
  const mountRef = useRef<HTMLDivElement>(null)
  const minimapRef = useRef<HTMLCanvasElement>(null)
  const held = useRef({ fwd: 0, turn: 0 })
  const rot = useRef({ yaw: Math.PI, pitch: 0 })
  const dragging = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    supabase.rpc('public_tour', { p_slug: slug }).then(({ data }) => setTour((data as Tour | null) ?? null))
  }, [slug])

  useEffect(() => {
    if (!tour || !tour.rooms?.length || !mountRef.current) return
    const mount = mountRef.current
    const rooms = tour.rooms
    const n = rooms.length
    const totalW = n * W

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    mount.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#e7e5e4')
    const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 100)
    scene.add(new THREE.HemisphereLight('#ffffff', '#c8b8a6', 1.1))

    // Pisos e tetos
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(totalW, D), new THREE.MeshStandardMaterial({ color: '#b08968' }))
    floor.rotation.x = -Math.PI / 2; floor.position.set(totalW / 2, 0, D / 2); scene.add(floor)
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(totalW, D), new THREE.MeshStandardMaterial({ color: '#f5f5f4' }))
    ceil.rotation.x = Math.PI / 2; ceil.position.set(totalW / 2, H, D / 2); scene.add(ceil)

    // Fotos nas paredes (carregadas uma vez por URL)
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')
    const texCache = new Map<string, THREE.Texture>()
    const texFor = (url: string) => {
      if (!texCache.has(url)) {
        const t = loader.load(url)
        t.colorSpace = THREE.SRGBColorSpace
        texCache.set(url, t)
      }
      return texCache.get(url)!
    }
    const wallMat = (room: Room, k: number) => {
      const photo = room.photos[k % Math.max(room.photos.length, 1)]
      return new THREE.MeshStandardMaterial({
        map: photo ? texFor(photo) : null, color: photo ? '#ffffff' : '#f5f5f4', side: THREE.DoubleSide,
      })
    }
    const wall = (cx: number, cz: number, width: number, rotY: number, mat: THREE.Material) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(width, H), mat)
      m.position.set(cx, H / 2, cz); m.rotation.y = rotY; scene.add(m)
    }
    const doorA = D / 2 - DOOR / 2
    const doorB = D / 2 + DOOR / 2
    rooms.forEach((room, i) => {
      const x0 = i * W
      wall(x0 + W / 2, 0, W, 0, wallMat(room, 0))                 // sul
      wall(x0 + W / 2, D, W, Math.PI, wallMat(room, 1))           // norte
      if (i === 0) wall(0, D / 2, D, Math.PI / 2, wallMat(room, 2))        // oeste (exterior)
      if (i === n - 1) wall(totalW, D / 2, D, -Math.PI / 2, wallMat(room, 3)) // este (exterior)
      if (i < n - 1) {
        // parede partilhada com porta aberta
        const bx = x0 + W
        wall(bx, doorA / 2, doorA, Math.PI / 2, wallMat(room, 2))
        wall(bx, (doorB + D) / 2, D - doorB, Math.PI / 2, wallMat(room, 2))
      }
    })
    const lamp = new THREE.PointLight('#fff4e0', 6, 14)
    rooms.forEach((_, i) => { const l = lamp.clone(); l.position.set(i * W + W / 2, H - 0.3, D / 2); scene.add(l) })

    // Posição e colisões: só dentro das divisões ou pelas portas.
    const player = { x: W / 2, z: D / 2 }
    const inside = (x: number, z: number) => {
      const m = 0.3
      for (let i = 0; i < n; i++) {
        if (x >= i * W + m && x <= (i + 1) * W - m && z >= m && z <= D - m) return true
        if (i < n - 1 && Math.abs(x - (i + 1) * W) <= 0.5 && z >= doorA + 0.1 && z <= doorB - 0.1) return true
      }
      return false
    }
    const roomAt = (x: number) => Math.min(n - 1, Math.max(0, Math.floor(x / W)))

    // Modo guiado: a câmara desliza pelas divisões em ordem, em cerca de 90 segundos.
    let guideT0: number | null = null
    const stopGuide = () => { guideT0 = null; setGuiding(false) }
    const startGuide = () => {
      guideT0 = performance.now(); setGuiding(true)
      player.x = 0.3; player.z = D / 2; rot.current.yaw = -Math.PI / 2; rot.current.pitch = 0
    }
    guide.current = { start: startGuide, stop: stopGuide }

    const resize = () => {
      const w = mount.clientWidth, h = mount.clientHeight
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize); ro.observe(mount)

    // Desenho do minimapa
    const mm = minimapRef.current?.getContext('2d')
    const drawMinimap = () => {
      if (!mm || !minimapRef.current) return
      const c = minimapRef.current, cw = c.width, ch = c.height
      mm.clearRect(0, 0, cw, ch)
      mm.fillStyle = 'rgba(15,23,42,0.75)'; mm.fillRect(0, 0, cw, ch)
      const s = (cw - 12) / totalW
      rooms.forEach((r, i) => {
        mm.strokeStyle = 'rgba(255,255,255,0.7)'; mm.lineWidth = 1
        mm.strokeRect(6 + i * W * s, ch / 2 - (D * s) / 2, W * s, D * s)
        mm.fillStyle = 'rgba(255,255,255,0.8)'; mm.font = '9px sans-serif'
        mm.fillText(r.name.slice(0, 8), 8 + i * W * s, ch / 2 - (D * s) / 2 + 10)
      })
      const px = 6 + player.x * s, pz = ch / 2 - (D * s) / 2 + player.z * s
      mm.fillStyle = '#34d399'; mm.beginPath(); mm.arc(px, pz, 3.5, 0, Math.PI * 2); mm.fill()
      mm.strokeStyle = '#34d399'; mm.beginPath(); mm.moveTo(px, pz)
      mm.lineTo(px - Math.sin(rot.current.yaw) * 8, pz - Math.cos(rot.current.yaw) * 8); mm.stroke()
    }

    // Controlos: teclado (setas e WASD), arrastar com rato ou dedo
    const keys = new Set<string>()
    const onKeyDown = (e: KeyboardEvent) => { stopGuide(); keys.add(e.key.toLowerCase()); if (e.key.startsWith('Arrow')) e.preventDefault() }
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase())
    window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp)
    const canvas = renderer.domElement
    canvas.style.touchAction = 'none'
    const onDown = (e: PointerEvent) => { stopGuide(); dragging.current = { x: e.clientX, y: e.clientY } }
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return
      rot.current.yaw -= (e.clientX - dragging.current.x) * 0.005
      rot.current.pitch = Math.max(-1.2, Math.min(1.2, rot.current.pitch - (e.clientY - dragging.current.y) * 0.004))
      dragging.current = { x: e.clientX, y: e.clientY }
    }
    const onUp = () => { dragging.current = null }
    canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)

    let last = performance.now(); let frame = 0; let lastRoom = ''
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now
      const left = keys.has('arrowleft') ? 1 : 0
      const right = keys.has('arrowright') ? 1 : 0
      const fwdKey = (keys.has('arrowup') || keys.has('w') ? 1 : 0) - (keys.has('arrowdown') || keys.has('s') ? 1 : 0)
      const turnKey = right - left
      const strafe = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0)
      const fwd = fwdKey + held.current.fwd
      const turn = turnKey + held.current.turn
      if (guideT0 === null) {
      rot.current.yaw += turn * TURN * dt
      const yaw = rot.current.yaw
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw)
      const rx = Math.cos(yaw), rz = -Math.sin(yaw)
      const mx = (fx * fwd + rx * strafe) * SPEED * dt
      const mz = (fz * fwd + rz * strafe) * SPEED * dt
      if (inside(player.x + mx, player.z)) player.x += mx
      if (inside(player.x, player.z + mz)) player.z += mz
      } else {
        const p = (now - guideT0) / GUIDE_MS
        if (p >= 1) stopGuide()
        else { player.x = 0.3 + p * (totalW - 0.6); player.z = D / 2; rot.current.yaw = -Math.PI / 2 + Math.sin(p * Math.PI * 6) * 0.08 }
      }
      camera.position.set(player.x, EYE, player.z)
      camera.rotation.set(rot.current.pitch, rot.current.yaw, 0, 'YXZ')
      renderer.render(scene, camera)
      if (frame++ % 6 === 0) {
        drawMinimap()
        const name = rooms[roomAt(player.x)].name
        if (name !== lastRoom) { lastRoom = name; setCurrent(name); setCaption(rooms[roomAt(player.x)].caption ?? '') }
      }
      raf = requestAnimationFrame(loop)
    }
    let raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp)
      canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      renderer.dispose()
      texCache.forEach(t => t.dispose())
      mount.removeChild(canvas)
    }
  }, [tour])

  useEffect(() => { if (tour) document.title = `${tour.title} · Tour 3D`; }, [tour])

  if (tour === undefined) return <div className="flex min-h-dvh items-center justify-center bg-slate-950 text-sm text-white/60">A carregar o tour…</div>
  if (tour === null || !tour.rooms?.length) {
    return <div className="flex min-h-dvh items-center justify-center bg-slate-950 p-6 text-center text-sm text-white/60">Tour não encontrado ou ainda sem divisões.</div>
  }

  const pad = (dir: 'fwd' | 'back' | 'left' | 'right', on: boolean) => {
    if (on) guide.current?.stop()
    if (dir === 'fwd') held.current.fwd = on ? 1 : 0
    if (dir === 'back') held.current.fwd = on ? -1 : 0
    if (dir === 'left') held.current.turn = on ? -1 : 0
    if (dir === 'right') held.current.turn = on ? 1 : 0
  }
  const btn = (dir: 'fwd' | 'back' | 'left' | 'right', label: string) => (
    <button
      aria-label={label}
      onPointerDown={() => pad(dir, true)} onPointerUp={() => pad(dir, false)} onPointerLeave={() => pad(dir, false)} onPointerCancel={() => pad(dir, false)}
      className="flex h-12 w-12 select-none items-center justify-center rounded-xl bg-white/15 text-xl text-white backdrop-blur active:bg-white/35"
    >{label}</button>
  )

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-slate-950">
      <div ref={mountRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-black/50 px-3 py-2 text-white">
        <p className="text-[10px] uppercase tracking-wider text-white/60">{tour.title}</p>
        <p className="text-sm font-semibold">{current || tour.rooms[0].name}</p>
        {caption && <p className="mt-0.5 max-w-[16rem] text-xs text-white/85">{caption}</p>}
      </div>
      <div className="absolute right-3 top-3 rounded-lg border border-white/20 p-1">
        <canvas ref={minimapRef} width={150} height={64} className="block" />
        <p className="px-1 text-[9px] text-white/70">● você está aqui</p>
      </div>
      <div className="absolute bottom-4 left-4 grid grid-cols-3 gap-1.5 sm:hidden" aria-label="Controlos">
        <span />{btn('fwd', '▲')}<span />
        {btn('left', '◀')}{btn('back', '▼')}{btn('right', '▶')}
      </div>
      <button
        onClick={() => (guiding ? guide.current?.stop() : guide.current?.start())}
        className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-lg"
      >{guiding ? 'Parar tour' : 'Começar tour'}</button>
      <p className="pointer-events-none absolute bottom-4 right-4 hidden rounded bg-black/50 px-2 py-1 text-[11px] text-white/80 sm:block">
        Setas: andar e rodar · arraste com o rato para olhar
      </p>
    </div>
  )
}
