import { useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent as RPointerEvent } from 'react'
import { ArrowDown, ArrowUp, Copy, Download, Eye, EyeOff, FilePlus2, ImageIcon, Lock, Redo2, Ruler, Square, Trash2, Type, Undo2, Unlock, Upload } from 'lucide-react'
import { Button, Card, CardHeader, EmptyState, Field, Modal, PageHeader } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { cn, dateTime } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Modelo de dados                                                     */
/* ------------------------------------------------------------------ */

type Shape = 'rect' | 'rounded' | 'circle' | 'heart'
type Hole = { x: number; y: number; d: number }
type Template = {
  id: string; name: string; group: string
  w: number; h: number            // medida final de corte (mm)
  bleed: number                   // sangria (mm), fora do corte
  safe: number                    // margem de segurança (mm), dentro do corte
  dpi: 150 | 300 | 600
  shape: Shape; radius: number
  hole?: Hole                     // furo de chaveiro, coordenadas dentro do corte
  builtin?: boolean
}
type Layer = {
  id: string; kind: 'image' | 'text' | 'rect'; name: string
  x: number; y: number; w: number; h: number   // mm, referencial = canto da área com sangria
  hidden?: boolean; locked?: boolean
  // imagem
  src?: string; srcW?: number; srcH?: number; zoom?: number; offX?: number; offY?: number
  // texto
  text?: string; font?: string; size?: number; bold?: boolean; align?: 'left' | 'center' | 'right'; color?: string
  // retângulo
  fill?: string; radius?: number
}
type Project = { id: string; name: string; template: Template; layers: Layer[]; updated: string }
type Store = { custom: Template[]; projects: Project[] }

const STORE_KEY = 'mkon-gabaritos-v1'
const MM = 25.4
const HEART = 'M50 90 C10 60 0 40 0 25 C0 10 12 0 25 0 C38 0 47 10 50 20 C53 10 62 0 75 0 C88 0 100 10 100 25 C100 40 90 60 50 90 Z'
const FONTS = ['Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Verdana', 'Trebuchet MS', 'Courier New', 'Impact']
const GROUPS = ['Ímanes de geladeira', 'Chaveiros', 'Ímanes de calendário']

const base = { bleed: 2, safe: 3, dpi: 300 as const, builtin: true }
/** Formatos iniciais de referência. Confirmar medidas de corte e acabamento com o fornecedor. */
const BUILTIN: Template[] = [
  { id: 'iman-90x50', name: 'Retangular 90 × 50 mm', group: GROUPS[0], w: 90, h: 50, shape: 'rounded', radius: 3, ...base },
  { id: 'iman-85x55', name: 'Cartão 85 × 55 mm', group: GROUPS[0], w: 85, h: 55, shape: 'rounded', radius: 3, ...base },
  { id: 'iman-70x50', name: 'Retangular 70 × 50 mm', group: GROUPS[0], w: 70, h: 50, shape: 'rounded', radius: 3, ...base },
  { id: 'iman-100x70', name: 'Retangular grande 100 × 70 mm', group: GROUPS[0], w: 100, h: 70, shape: 'rounded', radius: 3, ...base },
  { id: 'iman-circ-58', name: 'Circular 58 mm', group: GROUPS[0], w: 58, h: 58, shape: 'circle', radius: 0, ...base },
  { id: 'iman-circ-75', name: 'Circular 75 mm', group: GROUPS[0], w: 75, h: 75, shape: 'circle', radius: 0, ...base },
  { id: 'iman-coracao-70', name: 'Coração 70 mm', group: GROUPS[0], w: 70, h: 70, shape: 'heart', radius: 0, ...base },
  { id: 'chav-ret-50x70', name: 'Acrílico retangular 50 × 70 mm', group: GROUPS[1], w: 50, h: 70, shape: 'rounded', radius: 4, hole: { x: 25, y: 6, d: 4 }, ...base },
  { id: 'chav-circ-50', name: 'Acrílico circular 50 mm', group: GROUPS[1], w: 50, h: 50, shape: 'circle', radius: 0, hole: { x: 25, y: 6, d: 4 }, ...base },
  { id: 'chav-coracao-60', name: 'Acrílico coração 60 mm', group: GROUPS[1], w: 60, h: 60, shape: 'heart', radius: 0, hole: { x: 30, y: 8, d: 4 }, ...base },
  { id: 'cal-a4', name: 'Calendário de ímã A4 (210 × 297 mm)', group: GROUPS[2], w: 210, h: 297, shape: 'rect', radius: 0, ...base },
  { id: 'cal-a5', name: 'Calendário de ímã A5 (148 × 210 mm)', group: GROUPS[2], w: 148, h: 210, shape: 'rect', radius: 0, ...base },
  { id: 'cal-mini', name: 'Mini calendário 90 × 120 mm', group: GROUPS[2], w: 90, h: 120, shape: 'rounded', radius: 3, ...base },
]

/* ------------------------------------------------------------------ */
/* Utilitários                                                         */
/* ------------------------------------------------------------------ */

const uid = () => Math.random().toString(36).slice(2, 10)
const round2 = (n: number) => Math.round(n * 100) / 100
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const dims = (t: Template) => ({ W: t.w + 2 * t.bleed, H: t.h + 2 * t.bleed })

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return { custom: [], projects: [] }
    const s = JSON.parse(raw)
    return { custom: Array.isArray(s.custom) ? s.custom : [], projects: Array.isArray(s.projects) ? s.projects : [] }
  } catch {
    return { custom: [], projects: [] }
  }
}

/** Calcula a posição e o tamanho da imagem dentro da caixa (cover + zoom + deslocamento, sem deixar vazios). */
function imgRect(l: Layer, iw: number, ih: number) {
  const s = Math.max(l.w / iw, l.h / ih) * (l.zoom ?? 1)   // mm por pixel da imagem original
  const dw = iw * s
  const dh = ih * s
  return {
    s, dw, dh,
    left: clamp((l.w - dw) / 2 + (l.offX ?? 0) * l.w, l.w - dw, 0),
    top: clamp((l.h - dh) / 2 + (l.offY ?? 0) * l.h, l.h - dh, 0),
  }
}

/** DPI efetivo de uma imagem na dimensão impressa. */
function effectiveDpi(l: Layer): number | null {
  if (l.kind !== 'image' || !l.srcW || !l.srcH) return null
  const s = Math.max(l.w / l.srcW, l.h / l.srcH) * (l.zoom ?? 1)
  return Math.round(MM / s)
}

function validateTemplate(d: Template): string | null {
  if (!d.name.trim()) return 'Dê um nome ao gabarito.'
  if (!(d.w >= 10 && d.w <= 1000 && d.h >= 10 && d.h <= 1000)) return 'Largura e altura devem estar entre 10 e 1000 mm.'
  if (!(d.bleed >= 0 && d.bleed <= 10)) return 'A sangria deve estar entre 0 e 10 mm.'
  if (!(d.safe >= 0 && d.safe < Math.min(d.w, d.h) / 2)) return 'A margem de segurança é demasiado grande para este formato.'
  if (d.hole && (d.hole.d <= 0 || d.hole.x < 0 || d.hole.y < 0 || d.hole.x > d.w || d.hole.y > d.h)) return 'O furo está fora do corte.'
  return null
}

function readImage(file: File): Promise<{ src: string; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      // Limite de 3000 px no maior lado para caber no armazenamento do navegador.
      const scale = Math.min(1, 3000 / Math.max(img.naturalWidth, img.naturalHeight))
      const c = document.createElement('canvas')
      c.width = Math.round(img.naturalWidth * scale)
      c.height = Math.round(img.naturalHeight * scale)
      const ctx = c.getContext('2d')
      if (!ctx) { URL.revokeObjectURL(url); return reject(new Error('Canvas indisponível neste navegador.')) }
      ctx.drawImage(img, 0, 0, c.width, c.height)
      const keepAlpha = ['image/png', 'image/webp', 'image/gif'].includes(file.type)
      const src = keepAlpha ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.92)
      URL.revokeObjectURL(url)
      resolve({ src, w: c.width, h: c.height })
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não consegui ler esta imagem.')) }
    img.src = url
  })
}

function loadImg(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image()
    im.onload = () => resolve(im)
    im.onerror = () => reject(new Error('Imagem inválida.'))
    im.src = src
  })
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

async function drawLayer(ctx: CanvasRenderingContext2D, l: Layer) {
  if (l.kind === 'rect') {
    ctx.fillStyle = l.fill ?? '#000000'
    roundedRectPath(ctx, l.x, l.y, l.w, l.h, l.radius ?? 0)
    ctx.fill()
    return
  }
  if (l.kind === 'text') {
    const size = l.size ?? 6
    ctx.save()
    ctx.font = `${l.bold ? '700 ' : ''}${size}px ${l.font ?? 'Arial'}`
    ctx.fillStyle = l.color ?? '#111111'
    ctx.textBaseline = 'top'
    const align = l.align ?? 'left'
    ctx.textAlign = align
    const ax = align === 'center' ? l.x + l.w / 2 : align === 'right' ? l.x + l.w : l.x
    ;(l.text ?? '').split('\n').forEach((line, i) => ctx.fillText(line, ax, l.y + i * size * 1.2))
    ctx.restore()
    return
  }
  if (l.kind === 'image' && l.src) {
    const im = await loadImg(l.src)
    const r = imgRect(l, im.naturalWidth, im.naturalHeight)
    ctx.save()
    ctx.beginPath()
    ctx.rect(l.x, l.y, l.w, l.h)
    ctx.clip()
    ctx.drawImage(im, l.x + r.left, l.y + r.top, r.dw, r.dh)
    ctx.restore()
  }
}

/** Gera o PNG na dimensão real de impressão (mm × DPI). Unidades do canvas = mm. */
async function renderPng(p: Project, dpi: number, withBleed: boolean): Promise<Blob> {
  const t = p.template
  const { W, H } = dims(t)
  const off = withBleed ? 0 : t.bleed
  const cw = withBleed ? W : t.w
  const ch = withBleed ? H : t.h
  const k = dpi / MM
  const c = document.createElement('canvas')
  c.width = Math.round(cw * k)
  c.height = Math.round(ch * k)
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponível neste navegador.')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.setTransform(k, 0, 0, k, -off * k, -off * k)
  for (const l of p.layers) {
    if (l.hidden) continue
    await drawLayer(ctx, l)
  }
  return new Promise((resolve, reject) =>
    c.toBlob(b => (b ? resolve(b) : reject(new Error('Falha ao gerar o PNG.'))), 'image/png'))
}

/** Forma de corte em coordenadas do artboard (mm). */
function ShapeEl({ t, fill, stroke, strokeWidth }: { t: Template; fill?: string; stroke?: string; strokeWidth?: number }) {
  const { bleed: b, w, h } = t
  if (t.shape === 'circle') return <circle cx={b + w / 2} cy={b + h / 2} r={Math.min(w, h) / 2} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
  if (t.shape === 'heart') return <path d={HEART} transform={`translate(${b} ${b}) scale(${w / 100} ${h / 100})`} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
  return <rect x={b} y={b} width={w} height={h} rx={t.shape === 'rounded' ? t.radius : 0} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
}

function Guides({ t, ppm }: { t: Template; ppm: number }) {
  const { W, H } = dims(t)
  const b = t.bleed
  return (
    <svg className="pointer-events-none absolute inset-0" width={W * ppm} height={H * ppm} viewBox={`0 0 ${W} ${H}`}>
      <mask id="mk-cut">
        <rect width={W} height={H} fill="white" />
        <ShapeEl t={t} fill="black" />
      </mask>
      <rect width={W} height={H} fill="rgba(0,0,0,0.45)" mask="url(#mk-cut)" />
      <ShapeEl t={t} fill="none" stroke="#22d3ee" strokeWidth={0.25} />
      <rect x={b + t.safe} y={b + t.safe} width={t.w - 2 * t.safe} height={t.h - 2 * t.safe} fill="none" stroke="#4ade80" strokeWidth={0.2} strokeDasharray="1 1" />
      {t.hole && <circle cx={b + t.hole.x} cy={b + t.hole.y} r={t.hole.d / 2} fill="none" stroke="#f472b6" strokeWidth={0.25} />}
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Modal de gabarito (medidas)                                         */
/* ------------------------------------------------------------------ */

function TemplateModal({ open, mode, initial, onClose, onApply, onSaveLibrary }: {
  open: boolean; mode: 'project' | 'library'; initial: Template
  onClose: () => void; onApply: (t: Template) => void; onSaveLibrary: (t: Template) => void
}) {
  const toast = useToast()
  const [d, setD] = useState<Template>(initial)
  const [hasHole, setHasHole] = useState(!!initial.hole)

  useEffect(() => {
    if (open) { setD(initial); setHasHole(!!initial.hole) }
  }, [open, initial])

  const num = (k: 'w' | 'h' | 'bleed' | 'safe' | 'radius') => (e: ChangeEvent<HTMLInputElement>) =>
    setD(s => ({ ...s, [k]: Number(e.target.value) }))
  const holeNum = (k: 'x' | 'y' | 'd') => (e: ChangeEvent<HTMLInputElement>) =>
    setD(s => {
      const hl = s.hole ?? { x: s.w / 2, y: 6, d: 4 }
      return { ...s, hole: { ...hl, [k]: Number(e.target.value) } }
    })

  const finish = (fn: (t: Template) => void) => {
    const finalT = { ...d, hole: hasHole ? (d.hole ?? { x: d.w / 2, y: 6, d: 4 }) : undefined }
    const err = validateTemplate(finalT)
    if (err) return toast.push('error', err)
    fn(finalT)
  }

  return (
    <Modal open={open} onClose={onClose} title={mode === 'project' ? 'Medidas do gabarito desta arte' : 'Novo gabarito na biblioteca'} wide
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        {mode === 'project'
          ? <Button onClick={() => finish(onApply)}>Aplicar a esta arte</Button>
          : <Button onClick={() => finish(onSaveLibrary)}>Guardar na biblioteca</Button>}
      </>}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome"><input className="input" value={d.name} onChange={e => setD({ ...d, name: e.target.value })} /></Field>
          <Field label="Grupo">
            <select className="input" value={d.group} onChange={e => setD({ ...d, group: e.target.value })}>
              {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Largura corte (mm)"><input type="number" className="input" value={d.w} onChange={num('w')} /></Field>
          <Field label="Altura corte (mm)"><input type="number" className="input" value={d.h} onChange={num('h')} /></Field>
          <Field label="Sangria (mm)"><input type="number" step="0.5" className="input" value={d.bleed} onChange={num('bleed')} /></Field>
          <Field label="Área segura (mm)"><input type="number" step="0.5" className="input" value={d.safe} onChange={num('safe')} /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Resolução (DPI)">
            <select className="input" value={d.dpi} onChange={e => setD({ ...d, dpi: Number(e.target.value) as 150 | 300 | 600 })}>
              <option value={150}>150 DPI</option><option value={300}>300 DPI</option><option value={600}>600 DPI</option>
            </select>
          </Field>
          <Field label="Formato">
            <select className="input" value={d.shape} onChange={e => setD({ ...d, shape: e.target.value as Shape })}>
              <option value="rect">Retangular</option>
              <option value="rounded">Retangular arredondado</option>
              <option value="circle">Circular</option>
              <option value="heart">Coração</option>
            </select>
          </Field>
          {d.shape === 'rounded' && (
            <Field label="Raio dos cantos (mm)"><input type="number" step="0.5" className="input" value={d.radius} onChange={num('radius')} /></Field>
          )}
        </div>
        <div className="rounded-lg border border-white/10 p-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={hasHole} onChange={e => setHasHole(e.target.checked)} /> Tem furo para chaveiro
          </label>
          {hasHole && (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Field label="Centro X no corte (mm)"><input type="number" step="0.5" className="input" value={d.hole?.x ?? 0} onChange={holeNum('x')} /></Field>
              <Field label="Centro Y no corte (mm)"><input type="number" step="0.5" className="input" value={d.hole?.y ?? 0} onChange={holeNum('y')} /></Field>
              <Field label="Diâmetro (mm)"><input type="number" step="0.5" className="input" value={d.hole?.d ?? 4} onChange={holeNum('d')} /></Field>
            </div>
          )}
        </div>
        <p className="text-xs text-white/40">
          Referência inicial, não é gabarito oficial do fabricante. Confirme as medidas de corte e acabamento com o fornecedor antes de produzir.
        </p>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

export default function Gabaritos() {
  const toast = useToast()
  const [store, setStore] = useState<Store>(loadStore)
  const [currentId, setCurrentId] = useState<string | null>(store.projects[0]?.id ?? null)
  const [selId, setSelId] = useState<string | null>(null)
  const [past, setPast] = useState<Layer[][]>([])
  const [future, setFuture] = useState<Layer[][]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [tplMode, setTplMode] = useState<'project' | 'library' | null>(null)
  const [tplDraft, setTplDraft] = useState<Template>(BUILTIN[0])
  const [showGuides, setShowGuides] = useState(true)
  const [withBleed, setWithBleed] = useState(true)
  const [saved, setSaved] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)
  const replaceRef = useRef<HTMLInputElement>(null)
  const replaceIdRef = useRef<string | null>(null)
  const dragRef = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number; before: Layer[]; moved: boolean } | null>(null)

  const library = useMemo(() => [...BUILTIN, ...store.custom], [store.custom])
  const project = store.projects.find(p => p.id === currentId) ?? null
  const t = project?.template ?? null
  const dim = t ? dims(t) : null
  const ppm = dim ? Math.min(640 / dim.W, 520 / dim.H) : 1

  /* Persistência local (debounce) */
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(store))
        setSaved(true)
      } catch {
        setSaved(false)
        toast.push('error', 'Armazenamento do navegador cheio. Remova artes antigas ou imagens grandes.')
      }
    }, 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store])

  const patchProject = (fn: (p: Project) => Project) =>
    setStore(s => ({ ...s, projects: s.projects.map(p => (p.id === currentId ? { ...fn(p), updated: new Date().toISOString() } : p)) }))

  const setLayers = (layers: Layer[], record = true) => {
    if (!project) return
    if (record) {
      setPast(p => [...p.slice(-49), project.layers])
      setFuture([])
    }
    patchProject(p => ({ ...p, layers }))
  }

  const updateLayer = (id: string, patch: Partial<Layer>, record = true) => {
    if (!project) return
    setLayers(project.layers.map(x => (x.id === id ? { ...x, ...patch } : x)), record)
  }

  const undo = () => {
    if (!project || past.length === 0) return
    const prev = past[past.length - 1]
    setPast(past.slice(0, -1))
    setFuture(f => [project.layers, ...f])
    patchProject(p => ({ ...p, layers: prev }))
  }
  const redo = () => {
    if (!project || future.length === 0) return
    const next = future[0]
    setFuture(future.slice(1))
    setPast(p => [...p, project.layers])
    patchProject(p => ({ ...p, layers: next }))
  }

  /* Atalhos: Ctrl+Z, Ctrl+Y, Delete */
  const keyHandler = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
    const mod = e.ctrlKey || e.metaKey
    const k = e.key.toLowerCase()
    if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
    else if (mod && (k === 'y' || (e.shiftKey && k === 'z'))) { e.preventDefault(); redo() }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && selId) { e.preventDefault(); deleteLayer(selId) }
  }
  const keyRef = useRef(keyHandler)
  keyRef.current = keyHandler
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current(e)
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  /* Projetos */
  const openProject = (id: string) => {
    setCurrentId(id); setSelId(null); setPast([]); setFuture([])
  }
  const createProject = (tpl: Template) => {
    const p: Project = { id: uid(), name: `${tpl.name} — arte ${store.projects.length + 1}`, template: { ...tpl, builtin: false }, layers: [], updated: new Date().toISOString() }
    setStore(s => ({ ...s, projects: [p, ...s.projects] }))
    setCurrentId(p.id); setSelId(null); setPast([]); setFuture([])
    setPickerOpen(false)
  }
  const duplicateProject = (p: Project) => {
    const c: Project = { ...p, id: uid(), name: `${p.name} (cópia)`, layers: p.layers.map(l => ({ ...l, id: uid() })), updated: new Date().toISOString() }
    setStore(s => ({ ...s, projects: [c, ...s.projects] }))
    openProject(c.id)
  }
  const deleteProject = (p: Project) => {
    if (!window.confirm(`Apagar a arte "${p.name}"?`)) return
    const rest = store.projects.filter(x => x.id !== p.id)
    setStore(s => ({ ...s, projects: s.projects.filter(x => x.id !== p.id) }))
    if (currentId === p.id) { setCurrentId(rest[0]?.id ?? null); setSelId(null); setPast([]); setFuture([]) }
  }

  /* Camadas */
  const addText = () => {
    if (!project || !dim) return
    const l: Layer = { id: uid(), kind: 'text', name: 'Texto', x: dim.W / 2 - 25, y: dim.H / 2 - 4, w: 50, h: 10, text: 'Seu texto', font: 'Arial', size: 6, bold: false, align: 'center', color: '#111111' }
    setLayers([...project.layers, l]); setSelId(l.id)
  }
  const addRect = () => {
    if (!project || !dim) return
    const l: Layer = { id: uid(), kind: 'rect', name: 'Retângulo', x: dim.W / 2 - 20, y: dim.H / 2 - 12, w: 40, h: 24, fill: '#1d4ed8', radius: 0 }
    setLayers([...project.layers, l]); setSelId(l.id)
  }
  const deleteLayer = (id: string) => {
    if (!project) return
    setLayers(project.layers.filter(x => x.id !== id)); setSelId(null)
  }
  const duplicateLayer = (id: string) => {
    if (!project) return
    const idx = project.layers.findIndex(x => x.id === id)
    if (idx < 0) return
    const src = project.layers[idx]
    const copy: Layer = { ...src, id: uid(), name: `${src.name} cópia`, x: src.x + 2, y: src.y + 2 }
    const next = [...project.layers]; next.splice(idx + 1, 0, copy)
    setLayers(next); setSelId(copy.id)
  }
  const moveLayer = (id: string, dir: -1 | 1) => {
    if (!project) return
    const idx = project.layers.findIndex(x => x.id === id)
    const j = idx + dir
    if (idx < 0 || j < 0 || j >= project.layers.length) return
    const next = [...project.layers]
    ;[next[idx], next[j]] = [next[j], next[idx]]
    setLayers(next)
  }

  const onImageFile = async (file: File | undefined, replaceId?: string | null) => {
    if (!file || !project || !dim) return
    if (!file.type.startsWith('image/')) return toast.push('error', 'Escolha uma imagem (JPG, PNG, WEBP ou GIF).')
    try {
      const img = await readImage(file)
      if (replaceId) {
        updateLayer(replaceId, { src: img.src, srcW: img.w, srcH: img.h, zoom: 1, offX: 0, offY: 0 })
        return
      }
      const { W, H } = dim
      let w = W * 0.8
      let h = w * img.h / img.w
      if (h > H * 0.8) { h = H * 0.8; w = h * img.w / img.h }
      const l: Layer = {
        id: uid(), kind: 'image', name: `Imagem ${project.layers.filter(x => x.kind === 'image').length + 1}`,
        x: (W - w) / 2, y: (H - h) / 2, w: round2(w), h: round2(h),
        src: img.src, srcW: img.w, srcH: img.h, zoom: 1, offX: 0, offY: 0,
      }
      setLayers([...project.layers, l]); setSelId(l.id)
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Falha ao carregar a imagem.')
    }
  }

  /* Arrastar camadas no preview */
  const startDrag = (e: RPointerEvent<HTMLDivElement>, l: Layer) => {
    if (!project || l.locked) return
    e.stopPropagation()
    setSelId(l.id)
    dragRef.current = { id: l.id, sx: e.clientX, sy: e.clientY, ox: l.x, oy: l.y, before: project.layers, moved: false }
    const move = (ev: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const dx = (ev.clientX - d.sx) / ppm
      const dy = (ev.clientY - d.sy) / ppm
      if (Math.abs(dx) + Math.abs(dy) > 0.05) d.moved = true
      const nx = round2(d.ox + dx), ny = round2(d.oy + dy)
      patchProject(p => ({ ...p, layers: p.layers.map(x => (x.id === d.id ? { ...x, x: nx, y: ny } : x)) }))
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      const d = dragRef.current
      dragRef.current = null
      if (d?.moved) { setPast(p => [...p.slice(-49), d.before]); setFuture([]) }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  /* Exportação */
  const exportPng = async () => {
    if (!project || !t) return
    const low = project.layers.filter(l => !l.hidden && l.kind === 'image' && (effectiveDpi(l) ?? Infinity) < t.dpi)
    if (low.length && !window.confirm(`Há ${low.length} imagem(ns) abaixo de ${t.dpi} DPI na dimensão impressa. A qualidade pode sair pixelizada. Exportar mesmo assim?`)) return
    try {
      const blob = await renderPng(project, t.dpi, withBleed)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const { W, H } = dims(t)
      a.href = url
      a.download = `${project.name.replace(/[^\w\-]+/g, '_').slice(0, 60)}_${withBleed ? W : t.w}x${withBleed ? H : t.h}mm_${t.dpi}dpi.png`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.push('success', `PNG exportado em ${t.dpi} DPI.`)
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Falha na exportação.')
    }
  }

  const selected = project?.layers.find(l => l.id === selId) ?? null

  /* ---------------- Render ---------------- */

  const renderLayer = (l: Layer) => {
    if (!t) return null
    const sel = selId === l.id
    const common = {
      left: l.x * ppm, top: l.y * ppm, width: l.w * ppm, height: l.h * ppm,
      display: l.hidden ? 'none' : undefined,
    } as const
    return (
      <div key={l.id} onPointerDown={e => startDrag(e, l)}
        className={cn('absolute', l.locked ? 'pointer-events-none' : 'cursor-move', sel && 'outline outline-1 outline-dashed outline-cyan-300')}
        style={{ ...common, overflow: l.kind === 'text' ? 'visible' : 'hidden' }}>
        {l.kind === 'image' && l.src && l.srcW && l.srcH && (() => {
          const r = imgRect(l, l.srcW, l.srcH)
          return <img src={l.src} alt="" draggable={false} className="pointer-events-none absolute max-w-none select-none"
            style={{ left: r.left * ppm, top: r.top * ppm, width: r.dw * ppm, height: r.dh * ppm }} />
        })()}
        {l.kind === 'text' && (
          <div className="pointer-events-none w-full whitespace-pre-wrap leading-[1.2]"
            style={{ fontFamily: l.font ?? 'Arial', fontSize: (l.size ?? 6) * ppm, fontWeight: l.bold ? 700 : 400, color: l.color ?? '#111111', textAlign: l.align ?? 'left' }}>
            {l.text}
          </div>
        )}
        {l.kind === 'rect' && (
          <div className="pointer-events-none h-full w-full" style={{ background: l.fill ?? '#000', borderRadius: (l.radius ?? 0) * ppm }} />
        )}
      </div>
    )
  }

  const layersTopFirst = project ? [...project.layers].reverse() : []

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Editor de Gabaritos"
        description="Artes para ímanes, chaveiros e calendários, com medidas reais em mm, sangria, área segura e exportação em PNG para impressão."
        actions={<Button variant="outline" onClick={() => setPickerOpen(true)}><FilePlus2 className="h-4 w-4" /> Nova arte</Button>}
      />

      <div className="grid gap-4 xl:grid-cols-[260px_1fr_300px]">
        {/* Projetos */}
        <Card>
          <CardHeader title="Artes" subtitle={`${store.projects.length} guardadas neste navegador`} />
          {store.projects.length === 0 ? (
            <EmptyState icon={<ImageIcon className="h-5 w-5" />} title="Sem artes" description="Escolha um gabarito para começar." />
          ) : (
            <div className="max-h-[70vh] divide-y divide-white/[0.05] overflow-y-auto">
              {store.projects.map(p => (
                <div key={p.id} className={cn('flex items-start gap-2 px-4 py-3', p.id === currentId && 'bg-brand/10')}>
                  <button className="min-w-0 flex-1 text-left" onClick={() => openProject(p.id)}>
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-[11px] text-white/40">{p.template.w}×{p.template.h} mm · {dateTime(p.updated)}</p>
                  </button>
                  <button title="Duplicar" className="p-1 text-white/40 hover:text-white" onClick={() => duplicateProject(p)}><Copy className="h-3.5 w-3.5" /></button>
                  <button title="Apagar" className="p-1 text-white/40 hover:text-red-300" onClick={() => deleteProject(p)}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Área de trabalho */}
        <Card className="min-w-0">
          {!project || !t || !dim ? (
            <EmptyState icon={<Square className="h-5 w-5" />} title="Nenhuma arte aberta"
              description="Crie uma arte a partir de um gabarito da biblioteca."
              action={<Button onClick={() => setPickerOpen(true)}>Escolher gabarito</Button>} />
          ) : (
            <div className="p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <input className="input max-w-xs" value={project.name} onChange={e => patchProject(p => ({ ...p, name: e.target.value }))} aria-label="Nome da arte" />
                <Button size="sm" variant="ghost" onClick={() => setTplMode('project')}><Ruler className="h-3.5 w-3.5" /> Medidas</Button>
                <Button size="sm" variant="ghost" onClick={undo} disabled={past.length === 0} title="Desfazer (Ctrl+Z)"><Undo2 className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="ghost" onClick={redo} disabled={future.length === 0} title="Refazer (Ctrl+Y)"><Redo2 className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="ghost" onClick={() => setShowGuides(!showGuides)}>
                  {showGuides ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />} Guias
                </Button>
                <span className="ml-auto text-[11px] text-white/40">{saved ? 'Guardado neste navegador' : 'Não guardado'}</span>
              </div>

              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-white/60">
                <span>Corte {t.w}×{t.h} mm</span>
                <span>· Sangria {t.bleed} mm</span>
                <span>· Área segura {t.safe} mm</span>
                <span>· {t.dpi} DPI</span>
                <label className="ml-auto flex items-center gap-1"><input type="checkbox" checked={withBleed} onChange={e => setWithBleed(e.target.checked)} /> Exportar com sangria</label>
                <Button size="sm" onClick={exportPng}><Download className="h-3.5 w-3.5" /> Exportar PNG {t.dpi} DPI</Button>
              </div>

              <div className="overflow-auto rounded-xl bg-[#0b1020] p-6">
                <div className="relative mx-auto bg-white shadow-2xl" style={{ width: dim.W * ppm, height: dim.H * ppm, overflow: 'hidden' }}
                  onPointerDown={() => setSelId(null)}>
                  {project.layers.map(renderLayer)}
                  {showGuides && <Guides t={t} ppm={ppm} />}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-white/50">
                <span><span className="inline-block h-2 w-3 bg-cyan-400 align-middle" /> Linha de corte</span>
                <span><span className="inline-block h-2 w-3 border border-dashed border-green-400 align-middle" /> Área segura</span>
                <span><span className="inline-block h-2 w-3 bg-black/50 align-middle" /> Sangria (fora do corte)</span>
                {t.hole && <span><span className="inline-block h-2 w-3 border border-pink-400 align-middle" /> Furo do chaveiro</span>}
              </div>
              <p className="mt-2 text-[11px] text-white/35">
                Os formatos são referências iniciais. Confirme as medidas com o fornecedor antes de produzir.
              </p>
            </div>
          )}
        </Card>

        {/* Camadas e propriedades */}
        <div className="space-y-4">
          {project && t && (
            <>
              <Card>
                <CardHeader title="Adicionar" />
                <div className="grid grid-cols-3 gap-2 p-4">
                  <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-3.5 w-3.5" /> Imagem</Button>
                  <Button size="sm" variant="outline" onClick={addText}><Type className="h-3.5 w-3.5" /> Texto</Button>
                  <Button size="sm" variant="outline" onClick={addRect}><Square className="h-3.5 w-3.5" /> Forma</Button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { onImageFile(e.target.files?.[0]); e.target.value = '' }} />
                  <input ref={replaceRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { onImageFile(e.target.files?.[0], replaceIdRef.current); e.target.value = '' }} />
                </div>
              </Card>

              <Card>
                <CardHeader title="Camadas" subtitle="De cima para baixo" />
                {layersTopFirst.length === 0 ? (
                  <p className="p-4 text-xs text-white/40">Sem camadas. Adicione uma imagem, texto ou forma.</p>
                ) : (
                  <div className="divide-y divide-white/[0.05]">
                    {layersTopFirst.map(l => {
                      const dpi = effectiveDpi(l)
                      const lowRes = dpi !== null && dpi < t.dpi
                      return (
                        <div key={l.id} onClick={() => setSelId(l.id)}
                          className={cn('flex items-center gap-1 px-3 py-2 text-xs', selId === l.id ? 'bg-brand/10' : 'hover:bg-white/[0.03]')}>
                          <span className="min-w-0 flex-1 truncate">
                            {l.name}
                            {lowRes && <span className="ml-1 text-amber-300">⚠ {dpi} DPI</span>}
                          </span>
                          <button title={l.hidden ? 'Mostrar' : 'Ocultar'} className="p-1 text-white/50 hover:text-white" onClick={e => { e.stopPropagation(); updateLayer(l.id, { hidden: !l.hidden }) }}>
                            {l.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                          <button title={l.locked ? 'Desbloquear' : 'Bloquear'} className="p-1 text-white/50 hover:text-white" onClick={e => { e.stopPropagation(); updateLayer(l.id, { locked: !l.locked }) }}>
                            {l.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                          </button>
                          <button title="Subir" className="p-1 text-white/50 hover:text-white" onClick={e => { e.stopPropagation(); moveLayer(l.id, 1) }}><ArrowUp className="h-3.5 w-3.5" /></button>
                          <button title="Descer" className="p-1 text-white/50 hover:text-white" onClick={e => { e.stopPropagation(); moveLayer(l.id, -1) }}><ArrowDown className="h-3.5 w-3.5" /></button>
                          <button title="Duplicar" className="p-1 text-white/50 hover:text-white" onClick={e => { e.stopPropagation(); duplicateLayer(l.id) }}><Copy className="h-3.5 w-3.5" /></button>
                          <button title="Apagar" className="p-1 text-white/50 hover:text-red-300" onClick={e => { e.stopPropagation(); deleteLayer(l.id) }}><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>

              {selected && (
                <Card>
                  <CardHeader title="Propriedades" subtitle={selected.kind === 'image' ? 'Imagem' : selected.kind === 'text' ? 'Texto' : 'Forma'} />
                  <div className="space-y-3 p-4">
                    <Field label="Nome"><input className="input" value={selected.name} onChange={e => updateLayer(selected.id, { name: e.target.value })} /></Field>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="X (mm)"><input type="number" step="0.5" className="input" value={selected.x} onChange={e => updateLayer(selected.id, { x: Number(e.target.value) })} /></Field>
                      <Field label="Y (mm)"><input type="number" step="0.5" className="input" value={selected.y} onChange={e => updateLayer(selected.id, { y: Number(e.target.value) })} /></Field>
                      <Field label="Largura (mm)"><input type="number" step="0.5" className="input" value={selected.w} onChange={e => updateLayer(selected.id, { w: Number(e.target.value) })} /></Field>
                      <Field label="Altura (mm)"><input type="number" step="0.5" className="input" value={selected.h} onChange={e => updateLayer(selected.id, { h: Number(e.target.value) })} /></Field>
                    </div>

                    {selected.kind === 'image' && (
                      <>
                        <Field label={`Zoom (${(selected.zoom ?? 1).toFixed(2)}×)`}>
                          <input type="range" min={1} max={3} step={0.01} className="w-full" value={selected.zoom ?? 1} onChange={e => updateLayer(selected.id, { zoom: Number(e.target.value) })} />
                        </Field>
                        <Field label="Deslocar horizontal">
                          <input type="range" min={-0.5} max={0.5} step={0.01} className="w-full" value={selected.offX ?? 0} onChange={e => updateLayer(selected.id, { offX: Number(e.target.value) })} />
                        </Field>
                        <Field label="Deslocar vertical">
                          <input type="range" min={-0.5} max={0.5} step={0.01} className="w-full" value={selected.offY ?? 0} onChange={e => updateLayer(selected.id, { offY: Number(e.target.value) })} />
                        </Field>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className={cn(selected.srcW && effectiveDpi(selected) !== null && (effectiveDpi(selected) ?? 0) < t.dpi ? 'text-amber-300' : 'text-white/50')}>
                            Resolução efetiva: {effectiveDpi(selected) ?? '—'} DPI
                          </span>
                          <Button size="sm" variant="outline" onClick={() => { replaceIdRef.current = selected.id; replaceRef.current?.click() }}>
                            <Upload className="h-3.5 w-3.5" /> Substituir imagem
                          </Button>
                        </div>
                      </>
                    )}

                    {selected.kind === 'text' && (
                      <>
                        <Field label="Texto">
                          <textarea rows={3} className="input" value={selected.text ?? ''} onChange={e => updateLayer(selected.id, { text: e.target.value })} />
                        </Field>
                        <div className="grid grid-cols-2 gap-2">
                          <Field label="Fonte">
                            <select className="input" value={selected.font ?? 'Arial'} onChange={e => updateLayer(selected.id, { font: e.target.value })}>
                              {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                          </Field>
                          <Field label="Tamanho (mm)"><input type="number" step="0.5" min={1} className="input" value={selected.size ?? 6} onChange={e => updateLayer(selected.id, { size: Number(e.target.value) })} /></Field>
                          <Field label="Cor"><input type="color" className="input h-9 p-1" value={selected.color ?? '#111111'} onChange={e => updateLayer(selected.id, { color: e.target.value })} /></Field>
                          <Field label="Alinhamento">
                            <select className="input" value={selected.align ?? 'left'} onChange={e => updateLayer(selected.id, { align: e.target.value as Layer['align'] })}>
                              <option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option>
                            </select>
                          </Field>
                        </div>
                        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!selected.bold} onChange={e => updateLayer(selected.id, { bold: e.target.checked })} /> Negrito</label>
                      </>
                    )}

                    {selected.kind === 'rect' && (
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Cor"><input type="color" className="input h-9 p-1" value={selected.fill ?? '#000000'} onChange={e => updateLayer(selected.id, { fill: e.target.value })} /></Field>
                        <Field label="Raio (mm)"><input type="number" step="0.5" min={0} className="input" value={selected.radius ?? 0} onChange={e => updateLayer(selected.id, { radius: Number(e.target.value) })} /></Field>
                      </div>
                    )}
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </div>

      {/* Escolha de gabarito */}
      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title="Escolher gabarito" wide
        footer={<Button variant="outline" onClick={() => { setPickerOpen(false); setTplDraft({ ...BUILTIN[0], id: '', name: 'Novo gabarito', builtin: false }); setTplMode('library') }}>
          <FilePlus2 className="h-4 w-4" /> Novo gabarito personalizado
        </Button>}>
        <div className="space-y-5">
          {GROUPS.map(g => (
            <div key={g}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">{g}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {library.filter(x => x.group === g).map(tpl => (
                  <div key={tpl.id} className="flex items-center gap-2 rounded-lg border border-white/10 p-3 hover:border-brand/40">
                    <button className="min-w-0 flex-1 text-left" onClick={() => createProject(tpl)}>
                      <p className="truncate text-sm">{tpl.name}</p>
                      <p className="text-[11px] text-white/40">{tpl.w}×{tpl.h} mm · sangria {tpl.bleed} mm · {tpl.dpi} DPI{tpl.hole ? ' · furo' : ''}</p>
                    </button>
                    <button title="Copiar e editar" className="p-1 text-white/40 hover:text-white"
                      onClick={() => { setPickerOpen(false); setTplDraft({ ...tpl, id: '', name: `${tpl.name} (cópia)`, builtin: false }); setTplMode('library') }}>
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    {!tpl.builtin && (
                      <button title="Remover da biblioteca" className="p-1 text-white/40 hover:text-red-300"
                        onClick={() => { if (window.confirm(`Remover o gabarito "${tpl.name}"?`)) setStore(s => ({ ...s, custom: s.custom.filter(c => c.id !== tpl.id) })) }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* Medidas: aplicar à arte ou guardar na biblioteca */}
      <TemplateModal
        open={tplMode !== null}
        mode={tplMode ?? 'project'}
        initial={tplMode === 'project' && t ? t : tplDraft}
        onClose={() => setTplMode(null)}
        onApply={nt => { patchProject(p => ({ ...p, template: { ...nt, builtin: false } })); setTplMode(null); toast.push('success', 'Medidas aplicadas a esta arte.') }}
        onSaveLibrary={nt => {
          const saved: Template = { ...nt, id: uid(), builtin: false }
          setStore(s => ({ ...s, custom: [...s.custom, saved] }))
          setTplMode(null)
          toast.push('success', 'Gabarito guardado na biblioteca.')
        }}
      />
    </div>
  )
}
