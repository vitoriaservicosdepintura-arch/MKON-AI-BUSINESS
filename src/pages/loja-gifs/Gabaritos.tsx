import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type PointerEvent as RPointerEvent, type WheelEvent } from 'react'
import { createPortal } from 'react-dom'
import { AlignCenter, AlignCenterVertical, ArrowDown, ArrowLeft, ArrowUp, Copy, Download, Eye, EyeOff, FilePlus2, Frame, ImageIcon, Lock, Maximize, Minus, Plus, Printer, Redo2, Ruler, Square, Trash2, Type, Undo2, Unlock, Upload } from 'lucide-react'
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
  emoji?: string
}
type Layer = {
  id: string; kind: 'image' | 'text' | 'rect' | 'frame'; name: string
  x: number; y: number; w: number; h: number   // mm, referencial = canto da área com sangria
  hidden?: boolean; locked?: boolean
  src?: string; srcW?: number; srcH?: number; zoom?: number; offX?: number; offY?: number
  text?: string; font?: string; size?: number; bold?: boolean; align?: 'left' | 'center' | 'right'; color?: string
  fill?: string; radius?: number
  shape?: Shape; fit?: 'contain' | 'cover'; bg?: string   // quadro de imagem
}
type Project = { id: string; name: string; template: Template; layers: Layer[]; updated: string }
type Store = { custom: Template[]; projects: Project[] }

const STORE_KEY = 'mkon-gabaritos-v1'
const MM = 25.4
const HEART = 'M50 90 C10 60 0 40 0 25 C0 10 12 0 25 0 C38 0 47 10 50 20 C53 10 62 0 75 0 C88 0 100 10 100 25 C100 40 90 60 50 90 Z'
const FONTS = ['Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Verdana', 'Trebuchet MS', 'Courier New', 'Impact']
const GROUPS = ['Ímanes de geladeira', 'Chaveiros', 'Ímanes de calendário']
const GROUP_EMOJI: Record<string, string> = { [GROUPS[0]]: '🧲', [GROUPS[1]]: '🔑', [GROUPS[2]]: '📅' }

const base = { bleed: 2, safe: 3, dpi: 300 as const, builtin: true }
/** Formatos iniciais de referência. Confirmar medidas de corte e acabamento com o fornecedor. */
const BUILTIN: Template[] = [
  { id: 'iman-90x50', emoji: '🏷️', name: 'Retangular 90 × 50 mm', group: GROUPS[0], w: 90, h: 50, shape: 'rounded', radius: 3, ...base },
  { id: 'iman-85x55', emoji: '💳', name: 'Cartão 85 × 55 mm', group: GROUPS[0], w: 85, h: 55, shape: 'rounded', radius: 3, ...base },
  { id: 'iman-70x50', emoji: '🟩', name: 'Retangular 70 × 50 mm', group: GROUPS[0], w: 70, h: 50, shape: 'rounded', radius: 3, ...base },
  { id: 'iman-100x70', emoji: '🖼️', name: 'Retangular grande 100 × 70 mm', group: GROUPS[0], w: 100, h: 70, shape: 'rounded', radius: 3, ...base },
  { id: 'iman-circ-58', emoji: '⭕', name: 'Circular 58 mm', group: GROUPS[0], w: 58, h: 58, shape: 'circle', radius: 0, ...base },
  { id: 'iman-circ-75', emoji: '🔵', name: 'Circular 75 mm', group: GROUPS[0], w: 75, h: 75, shape: 'circle', radius: 0, ...base },
  { id: 'iman-coracao-70', emoji: '❤️', name: 'Coração 70 mm', group: GROUPS[0], w: 70, h: 70, shape: 'heart', radius: 0, ...base },
  { id: 'chav-ret-50x70', emoji: '🔑', name: 'Acrílico retangular 50 × 70 mm', group: GROUPS[1], w: 50, h: 70, shape: 'rounded', radius: 4, hole: { x: 25, y: 6, d: 4 }, ...base },
  { id: 'chav-circ-50', emoji: '🔘', name: 'Acrílico circular 50 mm', group: GROUPS[1], w: 50, h: 50, shape: 'circle', radius: 0, hole: { x: 25, y: 6, d: 4 }, ...base },
  { id: 'chav-coracao-60', emoji: '💖', name: 'Acrílico coração 60 mm', group: GROUPS[1], w: 60, h: 60, shape: 'heart', radius: 0, hole: { x: 30, y: 8, d: 4 }, ...base },
  { id: 'cal-a4', emoji: '📅', name: 'Calendário de ímã A4 (210 × 297 mm)', group: GROUPS[2], w: 210, h: 297, shape: 'rect', radius: 0, ...base },
  { id: 'cal-a5', emoji: '🗓️', name: 'Calendário de ímã A5 (148 × 210 mm)', group: GROUPS[2], w: 148, h: 210, shape: 'rect', radius: 0, ...base },
  { id: 'cal-mini', emoji: '📆', name: 'Mini calendário 90 × 120 mm', group: GROUPS[2], w: 90, h: 120, shape: 'rounded', radius: 3, ...base },
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

/** Posição e tamanho da imagem dentro da caixa (cover + zoom + deslocamento, sem deixar vazios). */
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

/** Foto dentro do quadro: caber sem cortar (padrão) ou preencher e cortar. Nunca deixa vazios nem sai da caixa. */
function frameRect(l: Layer, iw: number, ih: number) {
  const base = l.fit === 'cover' ? Math.max(l.w / iw, l.h / ih) : Math.min(l.w / iw, l.h / ih)
  const s = base * (l.zoom ?? 1)
  const dw = iw * s
  const dh = ih * s
  const lo = (box: number, d: number) => Math.min(0, box - d)
  const hi = (box: number, d: number) => Math.max(0, box - d)
  return {
    s, dw, dh,
    left: clamp((l.w - dw) / 2 + (l.offX ?? 0) * l.w, lo(l.w, dw), hi(l.w, dw)),
    top: clamp((l.h - dh) / 2 + (l.offY ?? 0) * l.h, lo(l.h, dh), hi(l.h, dh)),
  }
}

/** DPI efetivo de uma imagem na dimensão impressa. */
function effectiveDpi(l: Layer): number | null {
  if ((l.kind !== 'image' && l.kind !== 'frame') || !l.srcW || !l.srcH) return null
  const rw = l.w / l.srcW
  const rh = l.h / l.srcH
  const base = l.kind === 'frame' && l.fit !== 'cover' ? Math.min(rw, rh) : Math.max(rw, rh)
  return Math.round(MM / (base * (l.zoom ?? 1)))
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

/** Contorno da forma do quadro, em mm (coordenadas do gabarito). */
function shapePath(shape: Shape, x: number, y: number, w: number, h: number, r: number): Path2D {
  const p = new Path2D()
  if (shape === 'circle') { p.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2); return p }
  if (shape === 'heart') { p.addPath(new Path2D(HEART), new DOMMatrix([w / 100, 0, 0, h / 100, x, y])); return p }
  const rr = shape === 'rounded' ? Math.min(r, w / 2, h / 2) : 0
  p.moveTo(x + rr, y)
  p.arcTo(x + w, y, x + w, y + h, rr)
  p.arcTo(x + w, y + h, x, y + h, rr)
  p.arcTo(x, y + h, x, y, rr)
  p.arcTo(x, y, x + w, y, rr)
  p.closePath()
  return p
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
  if (l.kind === 'frame') {
    ctx.save()
    ctx.clip(shapePath(l.shape ?? 'rect', l.x, l.y, l.w, l.h, l.radius ?? 0))
    if (l.bg) { ctx.fillStyle = l.bg; ctx.fillRect(l.x, l.y, l.w, l.h) }
    if (l.src && l.srcW && l.srcH) {
      const im = await loadImg(l.src)
      const r = frameRect(l, im.naturalWidth, im.naturalHeight)
      ctx.drawImage(im, l.x + r.left, l.y + r.top, r.dw, r.dh)
    }
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

const SHAPE_LABEL: Record<Shape, string> = { rect: 'Retangular', rounded: 'Arredondado', circle: 'Circular', heart: 'Coração' }

/** Forma do quadro em coordenadas locais (mm). */
function FrameShape({ shape, w, h, r, fill, stroke, strokeWidth, dash }: {
  shape: Shape; w: number; h: number; r: number; fill?: string; stroke?: string; strokeWidth?: number; dash?: string
}) {
  if (shape === 'circle') return <circle cx={w / 2} cy={h / 2} r={Math.min(w, h) / 2} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dash} />
  if (shape === 'heart') return <path d={HEART} transform={`scale(${w / 100} ${h / 100})`} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dash} />
  return <rect width={w} height={h} rx={shape === 'rounded' ? Math.min(r, w / 2, h / 2) : 0} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dash} />
}

/** Quadro de imagem: a foto é recortada pela forma e posicionada com frameRect. */
function FrameView({ l, ppm }: { l: Layer; ppm: number }) {
  const shape = l.shape ?? 'rect'
  const r = l.radius ?? 0
  const clipId = `fr-${l.id}`
  const fr = l.src && l.srcW && l.srcH ? frameRect(l, l.srcW, l.srcH) : null
  return (
    <svg className="pointer-events-none absolute inset-0 overflow-visible" width={l.w * ppm} height={l.h * ppm} viewBox={`0 0 ${l.w} ${l.h}`}>
      <defs>
        <clipPath id={clipId}><FrameShape shape={shape} w={l.w} h={l.h} r={r} /></clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {l.bg && <rect x={0} y={0} width={l.w} height={l.h} fill={l.bg} />}
        {fr && l.src && <image href={l.src} x={fr.left} y={fr.top} width={fr.dw} height={fr.dh} preserveAspectRatio="none" />}
      </g>
      {!fr && (
        <>
          <FrameShape shape={shape} w={l.w} h={l.h} r={r} fill="rgba(148,163,184,0.12)" stroke="#94a3b8" strokeWidth={0.3} dash="1.5 1" />
          <text x={l.w / 2} y={l.h / 2} textAnchor="middle" dominantBaseline="middle" fontSize={Math.max(2.5, Math.min(l.w, l.h) / 8)} fill="#94a3b8" fontFamily="Arial">Foto</text>
        </>
      )}
    </svg>
  )
}

function TemplateModal({ open, mode, initial, onClose, onApply, onSaveLibrary }: {
  open: boolean; mode: 'project' | 'library' | 'new-art'; initial: Template
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
    <Modal open={open} onClose={onClose} title={mode === 'project' ? 'Medidas do gabarito desta arte' : mode === 'new-art' ? 'Nova arte com medidas' : 'Gabarito na biblioteca'} wide
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        {mode === 'new-art'
          ? <Button onClick={() => finish(onApply)}>Criar arte</Button>
          : mode === 'project'
          ? <Button onClick={() => finish(onApply)}>Aplicar a esta arte</Button>
          : <Button onClick={() => finish(onSaveLibrary)}>Guardar na biblioteca</Button>}
      </>}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Nome"><input className="input" value={d.name} onChange={e => setD({ ...d, name: e.target.value })} /></Field>
          <Field label="Emoji"><input className="input" maxLength={4} value={d.emoji ?? ''} onChange={e => setD({ ...d, emoji: e.target.value })} /></Field>
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
/* Exportação: PNG, JPG, PDF, Word, Excel, folha e impressão           */
/* ------------------------------------------------------------------ */

type ExportOpts = { kind: 'single' | 'sheet'; dpi: number; withBleed: boolean; pw: number; ph: number; margin: number; gap: number; marks: boolean }
type Fmt = 'pdf' | 'png' | 'jpg' | 'docx' | 'xlsx'

const FORMATS: { id: Fmt; label: string; hint: string }[] = [
  { id: 'pdf', label: 'PDF', hint: 'Para imprimir ou enviar à gráfica' },
  { id: 'png', label: 'PNG', hint: 'Imagem de alta qualidade' },
  { id: 'jpg', label: 'JPG', hint: 'Imagem leve para enviar' },
  { id: 'docx', label: 'Word', hint: 'Documento editável com a arte' },
  { id: 'xlsx', label: 'Excel', hint: 'Planilha com a arte inserida' },
]
const PAPERS = [
  { id: 'A4', label: 'A4 (210 × 297 mm)', w: 210, h: 297 },
  { id: 'A3', label: 'A3 (297 × 420 mm)', w: 297, h: 420 },
  { id: 'A5', label: 'A5 (148 × 210 mm)', w: 148, h: 210 },
  { id: '10x15', label: '10 × 15 cm (foto)', w: 100, h: 150 },
  { id: 'custom', label: 'Personalizado', w: 0, h: 0 },
]

/** Tamanho de cada peça (mm), com ou sem sangria. */
function cellSize(t: Template, withBleed: boolean) {
  return withBleed ? { cw: t.w + 2 * t.bleed, ch: t.h + 2 * t.bleed } : { cw: t.w, ch: t.h }
}

/** Quantas peças cabem no papel, em colunas e linhas. */
function gridCount(t: Template, withBleed: boolean, pw: number, ph: number, margin: number, gap: number) {
  const { cw, ch } = cellSize(t, withBleed)
  const cols = Math.floor((pw - 2 * margin + gap) / (cw + gap))
  const rows = Math.floor((ph - 2 * margin + gap) / (ch + gap))
  return { cols: Math.max(0, cols), rows: Math.max(0, rows), cw, ch }
}

/** Monta a imagem final: arte única ou folha com peças centradas em colunas e linhas. */
async function buildCanvas(p: Project, o: ExportOpts) {
  const t = p.template
  const { cw, ch } = cellSize(t, o.withBleed)
  const off = o.withBleed ? 0 : t.bleed
  let pageW = cw
  let pageH = ch
  const cells: [number, number][] = []
  if (o.kind === 'single') {
    cells.push([0, 0])
  } else {
    const { cols, rows } = gridCount(t, o.withBleed, o.pw, o.ph, o.margin, o.gap)
    if (cols < 1 || rows < 1) throw new Error('A peça não cabe neste papel. Escolha um papel maior ou reduza a margem.')
    pageW = o.pw
    pageH = o.ph
    const gridW = cols * cw + (cols - 1) * o.gap
    const gridH = rows * ch + (rows - 1) * o.gap
    const x0 = (pageW - gridW) / 2
    const y0 = (pageH - gridH) / 2
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) cells.push([x0 + c * (cw + o.gap), y0 + r * (ch + o.gap)])
    }
  }
  const k = o.dpi / MM
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(pageW * k)
  canvas.height = Math.round(pageH * k)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponível neste navegador.')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  for (const [x, y] of cells) {
    ctx.save()
    ctx.setTransform(k, 0, 0, k, 0, 0)
    ctx.beginPath()
    ctx.rect(x, y, cw, ch)
    ctx.clip()
    ctx.setTransform(k, 0, 0, k, (x - off) * k, (y - off) * k)
    for (const l of p.layers) {
      if (!l.hidden) await drawLayer(ctx, l)
    }
    ctx.restore()
  }
  if (o.kind === 'sheet' && o.marks) {
    // Marcas de corte nos cantos de cada peça, fora da sangria.
    ctx.save()
    ctx.setTransform(k, 0, 0, k, 0, 0)
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 0.1
    const b = o.withBleed ? t.bleed : 0
    const s = b + 1
    const L = 3
    for (const [x, y] of cells) {
      const x1 = x + b
      const y1 = y + b
      const x2 = x1 + t.w
      const y2 = y1 + t.h
      const corners: [number, number, number, number][] = [[x1, y1, -1, -1], [x2, y1, 1, -1], [x1, y2, -1, 1], [x2, y2, 1, 1]]
      for (const [cx, cy, sx, sy] of corners) {
        ctx.beginPath(); ctx.moveTo(cx + sx * s, cy); ctx.lineTo(cx + sx * (s + L), cy); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(cx, cy + sy * s); ctx.lineTo(cx, cy + sy * (s + L)); ctx.stroke()
      }
    }
    ctx.restore()
  }
  return { canvas, pageW, pageH }
}

function canvasBlob(c: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) =>
    c.toBlob(b => (b ? resolve(b) : reject(new Error('Falha ao gerar a imagem.'))), type, quality))
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function safeName(s: string) {
  return s.replace(/[^\w\-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'arte'
}

function escXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Abre a janela de impressão com a imagem no tamanho do papel. */
function printImage(dataUrl: string, pw: number, ph: number) {
  const w = window.open('', '_blank')
  if (!w) throw new Error('O navegador bloqueou a janela de impressão. Permita pop-ups para este site.')
  w.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>Imprimir</title><style>` +
    `@page{size:${pw}mm ${ph}mm;margin:0}html,body{margin:0;padding:0}img{display:block;width:${pw}mm;height:${ph}mm}` +
    `</style></head><body><img src="${dataUrl}" onload="window.print()"></body></html>`)
  w.document.close()
}

/* ---------- Utilitários de ficheiro (sem bibliotecas externas) ---------- */

const te = new TextEncoder()

function concat(parts: Uint8Array[]): Uint8Array {
  const n = parts.reduce((a, p) => a + p.length, 0)
  const out = new Uint8Array(n)
  let o = 0
  for (const p of parts) { out.set(p, o); o += p.length }
  return out
}

const CRC_TABLE = (() => {
  const tb = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    tb[n] = c >>> 0
  }
  return tb
})()

function crc32(b: Uint8Array) {
  let c = 0xffffffff
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** ZIP sem compressão, base do .docx e do .xlsx. */
function zip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const DATE = ((2026 - 1980) << 9) | (11 << 5) | 12
  const TIME = 0
  const local: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const f of files) {
    const name = te.encode(f.name)
    const crc = crc32(f.data)
    const size = f.data.length
    const lh = new DataView(new ArrayBuffer(30))
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true)
    lh.setUint16(10, TIME, true); lh.setUint16(12, DATE, true); lh.setUint32(14, crc, true)
    lh.setUint32(18, size, true); lh.setUint32(22, size, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true)
    local.push(new Uint8Array(lh.buffer), name, f.data)
    const ch = new DataView(new ArrayBuffer(46))
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true)
    ch.setUint16(10, 0, true); ch.setUint16(12, TIME, true); ch.setUint16(14, DATE, true); ch.setUint32(16, crc, true)
    ch.setUint32(20, size, true); ch.setUint32(24, size, true); ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true)
    central.push(new Uint8Array(ch.buffer), name)
    offset += 30 + name.length + size
  }
  const cdata = concat(central)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true)
  end.setUint32(12, cdata.length, true); end.setUint32(16, offset, true)
  return concat([...local, cdata, new Uint8Array(end.buffer)])
}

/** PDF com uma página do tamanho do papel e a imagem JPEG em tamanho total. */
function buildPdf(jpeg: Uint8Array, imgW: number, imgH: number, pwMm: number, phMm: number): Uint8Array {
  const W = (pwMm * 72 / MM).toFixed(2)
  const H = (phMm * 72 / MM).toFixed(2)
  const content = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`
  const bodies: Uint8Array[] = [
    te.encode('<< /Type /Catalog /Pages 2 0 R >>'),
    te.encode('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    te.encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`),
    te.encode(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`),
    concat([
      te.encode(`<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),
      jpeg,
      te.encode('\nendstream'),
    ]),
  ]
  const parts: Uint8Array[] = []
  const offsets: number[] = []
  let pos = 0
  const push = (b: Uint8Array) => { parts.push(b); pos += b.length }
  push(te.encode('%PDF-1.4\n'))
  bodies.forEach((b, i) => {
    offsets.push(pos)
    push(te.encode(`${i + 1} 0 obj\n`))
    push(b)
    push(te.encode('\nendobj\n'))
  })
  const xref = pos
  let x = `xref\n0 ${bodies.length + 1}\n0000000000 65535 f \n` + offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
  x += `trailer\n<< /Size ${bodies.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  push(te.encode(x))
  return concat(parts)
}

const EMU_PER_MM = 36000
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'

/** Word: página do tamanho do papel com a arte inserida. */
function buildDocx(jpeg: Uint8Array, pwMm: number, phMm: number): Uint8Array {
  const tw = (mm: number) => Math.round(mm * 1440 / 25.4)
  const cx = Math.round(pwMm * EMU_PER_MM)
  const cy = Math.round(phMm * EMU_PER_MM)
  const drawing =
    `<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/>` +
    `<wp:docPr id="1" name="Arte"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
    `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="1" name="arte.jpg"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`
  const doc = `${XML_HEAD}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ` +
    `xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>` +
    `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r>${drawing}</w:r></w:p>` +
    `<w:sectPr><w:pgSz w:w="${tw(pwMm)}" w:h="${tw(phMm)}"/>` +
    `<w:pgMar w:top="0" w:right="0" w:bottom="0" w:left="0" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>` +
    `</w:body></w:document>`
  const REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
  const OD = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
  return zip([
    { name: '[Content_Types].xml', data: te.encode(`${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/>` +
      `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`) },
    { name: '_rels/.rels', data: te.encode(`${XML_HEAD}<Relationships xmlns="${REL}"><Relationship Id="rId1" Type="${OD}/officeDocument" Target="word/document.xml"/></Relationships>`) },
    { name: 'word/_rels/document.xml.rels', data: te.encode(`${XML_HEAD}<Relationships xmlns="${REL}"><Relationship Id="rId1" Type="${OD}/image" Target="media/image1.jpg"/></Relationships>`) },
    { name: 'word/document.xml', data: te.encode(doc) },
    { name: 'word/media/image1.jpg', data: jpeg },
  ])
}

/** Excel: uma folha com um título e a arte inserida abaixo. */
function buildXlsx(jpeg: Uint8Array, pwMm: number, phMm: number, title: string): Uint8Array {
  const cx = Math.round(pwMm * EMU_PER_MM)
  const cy = Math.round(phMm * EMU_PER_MM)
  const SS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
  const OD = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
  const REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
  const sheet = `${XML_HEAD}<worksheet xmlns="${SS}" xmlns:r="${OD}"><sheetData><row r="1">` +
    `<c r="A1" t="inlineStr"><is><t>${escXml(title)}</t></is></c></row></sheetData><drawing r:id="rId1"/></worksheet>`
  const drawing = `${XML_HEAD}<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" ` +
    `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:oneCellAnchor>` +
    `<xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>2</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>` +
    `<xdr:ext cx="${cx}" cy="${cy}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="2" name="Arte"/><xdr:cNvPicPr/></xdr:nvPicPr>` +
    `<xdr:blipFill><a:blip xmlns:r="${OD}" r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>` +
    `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>` +
    `</xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>`
  const styles = `${XML_HEAD}<styleSheet xmlns="${SS}"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>` +
    `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
    `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>` +
    `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`
  return zip([
    { name: '[Content_Types].xml', data: te.encode(`${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
      `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
      `<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`) },
    { name: '_rels/.rels', data: te.encode(`${XML_HEAD}<Relationships xmlns="${REL}"><Relationship Id="rId1" Type="${OD}/officeDocument" Target="xl/workbook.xml"/></Relationships>`) },
    { name: 'xl/workbook.xml', data: te.encode(`${XML_HEAD}<workbook xmlns="${SS}" xmlns:r="${OD}"><sheets><sheet name="Arte" sheetId="1" r:id="rId1"/></sheets></workbook>`) },
    { name: 'xl/_rels/workbook.xml.rels', data: te.encode(`${XML_HEAD}<Relationships xmlns="${REL}">` +
      `<Relationship Id="rId1" Type="${OD}/worksheet" Target="worksheets/sheet1.xml"/>` +
      `<Relationship Id="rId2" Type="${OD}/styles" Target="styles.xml"/></Relationships>`) },
    { name: 'xl/styles.xml', data: te.encode(styles) },
    { name: 'xl/worksheets/sheet1.xml', data: te.encode(sheet) },
    { name: 'xl/worksheets/_rels/sheet1.xml.rels', data: te.encode(`${XML_HEAD}<Relationships xmlns="${REL}"><Relationship Id="rId1" Type="${OD}/drawing" Target="../drawings/drawing1.xml"/></Relationships>`) },
    { name: 'xl/drawings/drawing1.xml', data: te.encode(drawing) },
    { name: 'xl/drawings/_rels/drawing1.xml.rels', data: te.encode(`${XML_HEAD}<Relationships xmlns="${REL}"><Relationship Id="rId1" Type="${OD}/image" Target="../media/image1.jpg"/></Relationships>`) },
    { name: 'xl/media/image1.jpg', data: jpeg },
  ])
}

/** Copia os bytes para um Blob (evita o tipo ArrayBufferLike, que o navegador não aceita). */
function blobOf(u: Uint8Array, opts: BlobPropertyBag) {
  return new Blob([new Uint8Array(u)], opts)
}

/** Gera o ficheiro a partir de uma imagem já montada. */
async function exportCanvas(canvas: HTMLCanvasElement, pageW: number, pageH: number, fmt: Fmt, base: string) {
  if (fmt === 'png') return download(await canvasBlob(canvas, 'image/png'), `${base}.png`)
  if (fmt === 'jpg') return download(await canvasBlob(canvas, 'image/jpeg', 0.95), `${base}.jpg`)
  const jpeg = new Uint8Array(await (await canvasBlob(canvas, 'image/jpeg', 0.95)).arrayBuffer())
  if (fmt === 'pdf') {
    return download(blobOf(buildPdf(jpeg, canvas.width, canvas.height, pageW, pageH), { type: 'application/pdf' }), `${base}.pdf`)
  }
  if (fmt === 'docx') {
    return download(blobOf(buildDocx(jpeg, pageW, pageH), { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), `${base}.docx`)
  }
  return download(blobOf(buildXlsx(jpeg, pageW, pageH, base), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${base}.xlsx`)
}

/** Gera o ficheiro no formato escolhido e descarrega-o. */
async function exportFile(p: Project, o: ExportOpts, fmt: Fmt, base: string) {
  const { canvas, pageW, pageH } = await buildCanvas(p, o)
  return exportCanvas(canvas, pageW, pageH, fmt, base)
}

/* ---------- Folha de imagens: várias fotos em colunas e linhas ---------- */

type PhotoOpts = { dpi: number; pw: number; ph: number; cw: number; ch: number; margin: number; gap: number; fill: boolean; marks: boolean; circle?: boolean }

const CELL_PRESETS: { id: string; label: string; w: number; h: number; circle?: boolean }[] = [
  { id: '90x50', label: 'Ímã 90 × 50 mm', w: 90, h: 50 },
  { id: '85x55', label: 'Cartão 85 × 55 mm', w: 85, h: 55 },
  { id: '70x50', label: 'Ímã 70 × 50 mm', w: 70, h: 50 },
  { id: '100x70', label: 'Ímã grande 100 × 70 mm', w: 100, h: 70 },
  { id: '50x70', label: 'Chaveiro 50 × 70 mm', w: 50, h: 70 },
  { id: '90x120', label: 'Mini calendário 90 × 120 mm', w: 90, h: 120 },
  { id: '148x210', label: 'Calendário A5 148 × 210 mm', w: 148, h: 210 },
  { id: '10x15', label: 'Foto 10 × 15 cm', w: 100, h: 150 },
  { id: 'molde-25', label: 'Molde redondo 25 mm', w: 25, h: 25, circle: true },
  { id: 'molde-32', label: 'Molde redondo 32 mm', w: 32, h: 32, circle: true },
  { id: 'molde-44', label: 'Molde redondo 44 mm', w: 44, h: 44, circle: true },
  { id: 'molde-58', label: 'Molde redondo 58 mm', w: 58, h: 58, circle: true },
  { id: 'custom', label: 'Medida personalizada', w: 0, h: 0 },
]

/** Quantas colunas e linhas cabem, com a medida escolhida. */
function photoGrid(o: { pw: number; ph: number; cw: number; ch: number; margin: number; gap: number }) {
  const cols = Math.max(0, Math.floor((o.pw - 2 * o.margin + o.gap) / (o.cw + o.gap)))
  const rows = Math.max(0, Math.floor((o.ph - 2 * o.margin + o.gap) / (o.ch + o.gap)))
  return { cols, rows }
}

/**
 * Preenche a folha com as imagens, linha a linha. Se houver menos imagens do que peças,
 * as imagens repetem-se. Com "preencher a folha", o espaço entre peças é distribuído
 * para que o conjunto ocupe toda a área útil (margem a margem).
 */
function buildPhotoSheet(imgs: HTMLImageElement[], o: PhotoOpts) {
  const { cols, rows } = photoGrid(o)
  if (imgs.length === 0) throw new Error('Selecione pelo menos uma imagem.')
  if (cols < 1 || rows < 1) throw new Error('A peça não cabe neste papel. Escolha um papel maior, uma medida menor ou reduza a margem.')
  const { pw, ph, cw, ch, margin, gap } = o
  let gx = gap
  let gy = gap
  if (o.fill) {
    if (cols > 1) gx = (pw - 2 * margin - cols * cw) / (cols - 1)
    if (rows > 1) gy = (ph - 2 * margin - rows * ch) / (rows - 1)
  }
  const gridW = cols * cw + (cols - 1) * gx
  const gridH = rows * ch + (rows - 1) * gy
  const x0 = o.fill ? margin + (cols === 1 ? (pw - 2 * margin - cw) / 2 : 0) : (pw - gridW) / 2
  const y0 = o.fill ? margin + (rows === 1 ? (ph - 2 * margin - ch) / 2 : 0) : (ph - gridH) / 2

  const k = o.dpi / MM
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(pw * k)
  canvas.height = Math.round(ph * k)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponível neste navegador.')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const cells: [number, number][] = []
  let i = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = x0 + c * (cw + gx)
      const y = y0 + r * (ch + gy)
      cells.push([x, y])
      const img = imgs[i % imgs.length]
      i++
      // A foto cabe inteira dentro da peça (sem perder nada), centrada.
      const s = Math.min(cw / img.naturalWidth, ch / img.naturalHeight)
      const dw = img.naturalWidth * s
      const dh = img.naturalHeight * s
      ctx.save()
      ctx.setTransform(k, 0, 0, k, 0, 0)
      ctx.beginPath()
      if (o.circle) ctx.arc(x + cw / 2, y + ch / 2, Math.min(cw, ch) / 2, 0, Math.PI * 2)
      else ctx.rect(x, y, cw, ch)
      ctx.clip()
      ctx.drawImage(img, x + (cw - dw) / 2, y + (ch - dh) / 2, dw, dh)
      ctx.restore()
    }
  }
  if (o.marks) {
    ctx.save()
    ctx.setTransform(k, 0, 0, k, 0, 0)
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 0.1
    const s = 1
    const L = 3
    for (const [x, y] of cells) {
      const corners: [number, number, number, number][] = [[x, y, -1, -1], [x + cw, y, 1, -1], [x, y + ch, -1, 1], [x + cw, y + ch, 1, 1]]
      for (const [cx, cy, sx, sy] of corners) {
        ctx.beginPath(); ctx.moveTo(cx + sx * s, cy); ctx.lineTo(cx + sx * (s + L), cy); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(cx, cy + sy * s); ctx.lineTo(cx, cy + sy * (s + L)); ctx.stroke()
      }
    }
    ctx.restore()
  }
  return { canvas, pageW: pw, pageH: ph, cols, rows }
}

/* ---------- Janela de exportação com pré-visualização ---------- */

type PhotoItem = { id: string; url: string; name: string }

function ExportOverlay({ project, onClose }: { project: Project; onClose: () => void }) {
  const toast = useToast()
  const t = project.template
  const [kind, setKind] = useState<'single' | 'sheet' | 'photos'>('single')
  const [withBleed, setWithBleed] = useState(true)
  const [paperId, setPaperId] = useState('A4')
  const [cw, setCw] = useState(210)
  const [ch, setCh] = useState(297)
  const [margin, setMargin] = useState(10)
  const [gap, setGap] = useState(8)
  const [marks, setMarks] = useState(true)
  const [fill, setFill] = useState(true)
  const [cellId, setCellId] = useState('90x50')
  const [cellW, setCellW] = useState(90)
  const [cellH, setCellH] = useState(50)
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const photosRef = useRef<PhotoItem[]>([])
  photosRef.current = photos
  const fileRef = useRef<HTMLInputElement>(null)
  const [fmt, setFmt] = useState<Fmt>('pdf')
  const [preview, setPreview] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const paper = paperId === 'custom'
    ? { id: 'custom', label: `${cw} × ${ch} mm`, w: cw, h: ch }
    : PAPERS.find(x => x.id === paperId) ?? PAPERS[0]
  const cellPreset = CELL_PRESETS.find(c => c.id === cellId) ?? CELL_PRESETS[0]
  const cell = cellId === 'custom' ? { w: cellW, h: cellH } : { w: cellPreset.w, h: cellPreset.h }
  const fmtInfo = FORMATS.find(f => f.id === fmt) ?? FORMATS[0]

  const photoOptsFor = (dpi: number): PhotoOpts => ({ dpi, pw: paper.w, ph: paper.h, cw: cell.w, ch: cell.h, margin, gap, fill, marks, circle: !!cellPreset.circle })
  const grid = kind === 'photos'
    ? photoGrid({ pw: paper.w, ph: paper.h, cw: cell.w, ch: cell.h, margin, gap })
    : gridCount(t, withBleed, paper.w, paper.h, margin, gap)
  const sheetCount = grid.cols * grid.rows

  // Libera as imagens da memória ao fechar.
  useEffect(() => () => photosRef.current.forEach(p => URL.revokeObjectURL(p.url)), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const addPhotos = (files: FileList | null) => {
    if (!files) return
    const list = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (list.length === 0) return toast.push('error', 'Escolha imagens (JPG, PNG, WEBP).')
    setPhotos(p => [...p, ...list.map(f => ({ id: uid(), url: URL.createObjectURL(f), name: f.name }))])
  }
  const removePhoto = (id: string) => {
    const item = photos.find(p => p.id === id)
    if (item) URL.revokeObjectURL(item.url)
    setPhotos(p => p.filter(x => x.id !== id))
  }

  // Pré-visualização rápida (96 DPI). O ficheiro final sai na resolução do gabarito.
  useEffect(() => {
    let alive = true
    const timer = setTimeout(async () => {
      if (kind === 'photos' && photos.length === 0) {
        if (alive) { setPreview(null); setErr(null) }
        return
      }
      try {
        let canvas: HTMLCanvasElement
        if (kind === 'photos') {
          const imgs = await Promise.all(photos.map(p => loadImg(p.url)))
          canvas = buildPhotoSheet(imgs, photoOptsFor(96)).canvas
        } else {
          canvas = (await buildCanvas(project, { kind, dpi: 96, withBleed, pw: paper.w, ph: paper.h, margin, gap, marks })).canvas
        }
        if (alive) { setPreview(canvas.toDataURL('image/png')); setErr(null) }
      } catch (e) {
        if (alive) { setErr(e instanceof Error ? e.message : 'Erro na pré-visualização.'); setPreview(null) }
      }
    }, 150)
    return () => { alive = false; clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, kind, withBleed, paperId, cw, ch, margin, gap, marks, fill, cellId, cellW, cellH, photos])

  const run = async (mode: 'save' | 'print') => {
    setBusy(true)
    try {
      if (kind === 'photos') {
        if (photos.length === 0) throw new Error('Selecione pelo menos uma imagem.')
        const imgs = await Promise.all(photos.map(p => loadImg(p.url)))
        const { canvas, pageW, pageH } = buildPhotoSheet(imgs, photoOptsFor(t.dpi))
        if (mode === 'print') {
          printImage(canvas.toDataURL('image/jpeg', 0.95), pageW, pageH)
        } else {
          const base = `${safeName(project.name)}_folha-imagens-${paper.w}x${paper.h}mm_${t.dpi}dpi`
          await exportCanvas(canvas, pageW, pageH, fmt, base)
          toast.push('success', `Ficheiro ${fmtInfo.label} gerado.`)
        }
      } else {
        const o: ExportOpts = { kind, dpi: t.dpi, withBleed, pw: paper.w, ph: paper.h, margin, gap, marks }
        const base = `${safeName(project.name)}_${kind === 'sheet' ? `folha-${paper.w}x${paper.h}mm` : 'arte'}_${t.dpi}dpi`
        if (mode === 'print') {
          const { canvas, pageW, pageH } = await buildCanvas(project, o)
          printImage(canvas.toDataURL('image/jpeg', 0.95), pageW, pageH)
        } else {
          await exportFile(project, o, fmt, base)
          toast.push('success', `Ficheiro ${fmtInfo.label} gerado.`)
        }
      }
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Falha na exportação.')
    } finally {
      setBusy(false)
    }
  }

  const seg = (on: boolean) => cn('rounded-lg border px-3 py-2 text-left text-xs', on ? 'border-brand/60 bg-brand/15 text-white' : 'border-white/10 text-white/60 hover:text-white')
  const paperBlock = (
    <>
      <Field label="Papel">
        <select className="input" value={paperId} onChange={e => setPaperId(e.target.value)}>
          {PAPERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </Field>
      {paperId === 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Largura (mm)"><input type="number" className="input" value={cw} onChange={e => setCw(Number(e.target.value))} /></Field>
          <Field label="Altura (mm)"><input type="number" className="input" value={ch} onChange={e => setCh(Number(e.target.value))} /></Field>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Margem (mm)"><input type="number" step="0.5" className="input" value={margin} onChange={e => setMargin(Number(e.target.value))} /></Field>
        <Field label="Espaço entre peças (mm)"><input type="number" step="0.5" className="input" value={gap} onChange={e => setGap(Number(e.target.value))} /></Field>
      </div>
      {kind === 'photos' && (
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={fill} onChange={e => setFill(e.target.checked)} /> Preencher toda a folha (distribui o espaço)</label>
      )}
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={marks} onChange={e => setMarks(e.target.checked)} /> Marcas de corte</label>
      <p className="text-[11px] text-white/40">Para as marcas de corte, use espaço entre peças de pelo menos 6 mm.</p>
    </>
  )

  return createPortal(
    <div className="fixed inset-0 z-40 flex flex-col bg-[#0b1020] text-white">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 bg-[#0f1628] px-4">
        <button className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs text-white/80 hover:bg-white/10" onClick={onClose}>
          <ArrowLeft className="h-4 w-4" /> Voltar ao editor
        </button>
        <span className="truncate text-sm font-medium">Salvar ou imprimir · {project.name}</span>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-80 shrink-0 space-y-5 overflow-y-auto border-r border-white/10 bg-[#0f1628] p-4">
          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/40">O que gerar</p>
            <div className="grid grid-cols-1 gap-2">
              <button className={seg(kind === 'single')} onClick={() => setKind('single')}><span className="block font-medium">Arte única</span><span className="text-white/40">Uma peça no tamanho do gabarito</span></button>
              <button className={seg(kind === 'sheet')} onClick={() => setKind('sheet')}><span className="block font-medium">Folha da arte</span><span className="text-white/40">A mesma arte repetida em colunas e linhas</span></button>
              <button className={seg(kind === 'photos')} onClick={() => setKind('photos')}><span className="block font-medium">Folha de imagens</span><span className="text-white/40">Várias imagens diferentes, na medida escolhida</span></button>
            </div>
          </section>

          {kind !== 'photos' && (
            <section className="space-y-2">
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={withBleed} onChange={e => setWithBleed(e.target.checked)} /> Incluir sangria</label>
              <p className="text-[11px] text-white/40">Tamanho de cada peça: {cellSize(t, withBleed).cw} × {cellSize(t, withBleed).ch} mm</p>
            </section>
          )}

          {kind === 'photos' && (
            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/40">Medida de cada peça</p>
              <Field label="Medida">
                <select className="input" value={cellId} onChange={e => setCellId(e.target.value)}>
                  {CELL_PRESETS.map(c => <option key={c.id} value={c.id}>{c.label}{c.id !== 'custom' ? ` (${c.w} × ${c.h} mm)` : ''}</option>)}
                </select>
              </Field>
              {cellId === 'custom' && (
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Largura (mm)"><input type="number" step="0.5" className="input" value={cellW} onChange={e => setCellW(Number(e.target.value))} /></Field>
                  <Field label="Altura (mm)"><input type="number" step="0.5" className="input" value={cellH} onChange={e => setCellH(Number(e.target.value))} /></Field>
                </div>
              )}

              <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-white/40">Imagens ({photos.length})</p>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { addPhotos(e.target.files); e.target.value = '' }} />
              <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> Selecionar imagens</Button>
              {photos.length > 0 && (
                <div className="grid grid-cols-4 gap-1.5">
                  {photos.map(p => (
                    <div key={p.id} className="group relative">
                      <img src={p.url} alt={p.name} className="aspect-square w-full rounded object-cover" />
                      <button title="Remover" onClick={() => removePhoto(p.id)}
                        className="absolute right-0.5 top-0.5 rounded bg-black/70 px-1 text-[11px] text-white hover:bg-red-500">×</button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-white/40">As imagens são colocadas por ordem, da esquerda para a direita e de cima para baixo. Se houver menos imagens do que peças, repetem-se.</p>
            </section>
          )}

          {kind !== 'single' && (
            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/40">Papel e organização</p>
              {paperBlock}
              <div className={cn('rounded-lg border p-3 text-xs', sheetCount > 0 ? 'border-white/10 text-white/70' : 'border-red-400/30 text-red-200')}>
                {sheetCount > 0
                  ? <>{grid.cols} colunas × {grid.rows} linhas = <strong>{sheetCount} peças</strong> em {paper.label}{kind === 'photos' && photos.length > 0 ? ` · ${photos.length} imagem(ns)` : ''}</>
                  : 'A peça não cabe neste papel.'}
              </div>
            </section>
          )}

          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/40">Formato do ficheiro</p>
            <div className="grid grid-cols-2 gap-2">
              {FORMATS.map(f => (
                <button key={f.id} className={seg(fmt === f.id)} onClick={() => setFmt(f.id)}>
                  <span className="block font-medium">{f.label}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-white/40">{fmtInfo.hint}. Resolução: {t.dpi} DPI.</p>
          </section>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button variant="outline" onClick={() => run('print')} loading={busy}><Printer className="h-4 w-4" /> Imprimir</Button>
            <Button onClick={() => run('save')} loading={busy}><Download className="h-4 w-4" /> Salvar {fmtInfo.label}</Button>
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center overflow-auto p-6">
          {err ? (
            <p className="max-w-md rounded-lg border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{err}</p>
          ) : preview ? (
            <img src={preview} alt="Pré-visualização antes de imprimir ou salvar" className="max-h-[calc(100vh-9rem)] max-w-full object-contain shadow-2xl" />
          ) : (
            <p className="text-sm text-white/50">{kind === 'photos' ? 'Selecione as imagens à esquerda para montar a folha.' : 'A gerar pré-visualização…'}</p>
          )}
          <p className="mt-3 text-xs text-white/40">Pré-visualização. O ficheiro sai em {t.dpi} DPI.</p>
        </main>
      </div>
    </div>,
    document.body,
  )
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

export default function Gabaritos() {
  const toast = useToast()
  const [store, setStore] = useState<Store>(loadStore)
  const [currentId, setCurrentId] = useState<string | null>(null)   // arte aberta em tela cheia
  const [selId, setSelId] = useState<string | null>(null)
  const [past, setPast] = useState<Layer[][]>([])
  const [future, setFuture] = useState<Layer[][]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [tplMode, setTplMode] = useState<'project' | 'library' | 'new-art' | null>(null)
  const [tplDraft, setTplDraft] = useState<Template>(BUILTIN[0])
  const [showGuides, setShowGuides] = useState(true)
  const [exportOpen, setExportOpen] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState({ w: 900, h: 600 })
  const [saved, setSaved] = useState(true)
  const [dragOver, setDragOver] = useState(false)
  const [frameMode, setFrameMode] = useState<'move' | 'image'>('move')   // quadro: mover o quadro ou a foto
  useEffect(() => { setFrameMode('move') }, [selId])
  const fileRef = useRef<HTMLInputElement>(null)
  const replaceRef = useRef<HTMLInputElement>(null)
  const replaceIdRef = useRef<string | null>(null)
  const areaRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ id: string; mode: 'move' | 'image' | 'resize'; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number; ofx: number; ofy: number; before: Layer[]; moved: boolean } | null>(null)

  const library = useMemo(() => [...BUILTIN, ...store.custom], [store.custom])
  const project = store.projects.find(p => p.id === currentId) ?? null
  const t = project?.template ?? null
  const dim = t ? dims(t) : null
  const editorOpen = !!(project && t && dim)

  /* Medida da área de desenho para encaixar o gabarito inteiro na tela */
  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setArea({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setArea({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [editorOpen])

  const fitPpm = dim ? Math.min((area.w - 80) / dim.W, (area.h - 130) / dim.H) : 1
  const ppm = Math.max(0.5, fitPpm * zoom)

  /* Persistência local (debounce) */
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(store))
        setSaved(true)
      } catch {
        setSaved(false)
        toast.push('error', 'Armazenamento do navegador cheio. Apague artes antigas ou use imagens menores.')
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

  const deleteLayer = (id: string) => {
    if (!project) return
    setLayers(project.layers.filter(x => x.id !== id)); setSelId(null)
  }

  /* Atalhos: Ctrl+Z, Ctrl+Y, Delete, setas (ajuste fino), Esc */
  const keyHandler = (e: KeyboardEvent) => {
    if (!editorOpen) return
    const el = e.target as HTMLElement | null
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
    const mod = e.ctrlKey || e.metaKey
    const k = e.key.toLowerCase()
    if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
    else if (mod && (k === 'y' || (e.shiftKey && k === 'z'))) { e.preventDefault(); redo() }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && selId) { e.preventDefault(); deleteLayer(selId) }
    else if (e.key === 'Escape') setSelId(null)
    else if (selId && project && e.key.startsWith('Arrow')) {
      e.preventDefault()
      const step = e.shiftKey ? 5 : 0.5
      const l = project.layers.find(x => x.id === selId)
      if (!l || l.locked) return
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
      updateLayer(selId, { x: round2(l.x + dx), y: round2(l.y + dy) })
    }
  }
  const keyRef = useRef(keyHandler)
  keyRef.current = keyHandler
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current(e)
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  /* Bloquear o scroll da página enquanto o editor está em tela cheia */
  useEffect(() => {
    if (!editorOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [editorOpen])

  /* Projetos */
  const openProject = (id: string) => {
    setCurrentId(id); setSelId(null); setPast([]); setFuture([]); setZoom(1)
  }
  const closeEditor = () => { setCurrentId(null); setSelId(null); setPast([]); setFuture([]) }
  const createProject = (tpl: Template) => {
    const p: Project = { id: uid(), name: `${tpl.name} — arte ${store.projects.length + 1}`, template: { ...tpl, builtin: false }, layers: [], updated: new Date().toISOString() }
    setStore(s => ({ ...s, projects: [p, ...s.projects] }))
    setPickerOpen(false)
    openProject(p.id)
  }
  const duplicateProject = (p: Project) => {
    const c: Project = { ...p, id: uid(), name: `${p.name} (cópia)`, layers: p.layers.map(l => ({ ...l, id: uid() })), updated: new Date().toISOString() }
    setStore(s => ({ ...s, projects: [c, ...s.projects] }))
  }
  const deleteProject = (p: Project) => {
    if (!window.confirm(`Apagar a arte "${p.name}"?`)) return
    setStore(s => ({ ...s, projects: s.projects.filter(x => x.id !== p.id) }))
    if (currentId === p.id) closeEditor()
  }

  /* Camadas */
  const addText = () => {
    if (!project || !dim) return
    const l: Layer = { id: uid(), kind: 'text', name: 'Texto', x: dim.W / 2 - 25, y: dim.H / 2 - 4, w: 50, h: 10, text: 'Seu texto', font: 'Arial', size: 6, bold: false, align: 'center', color: '#111111' }
    setLayers([...project.layers, l]); setSelId(l.id)
  }
  const addRect = () => {
    if (!project || !dim) return
    const l: Layer = { id: uid(), kind: 'rect', name: 'Forma', x: dim.W / 2 - 20, y: dim.H / 2 - 12, w: 40, h: 24, fill: '#1d4ed8', radius: 0 }
    setLayers([...project.layers, l]); setSelId(l.id)
  }
  /** Quadro de imagem com a medida do formato, reduzido se não couber na arte. */
  const addFrame = (tp: Template) => {
    if (!project || !dim) return
    const k = Math.min(1, (dim.W - 8) / tp.w, (dim.H - 8) / tp.h)
    const w = round2(tp.w * k)
    const h = round2(tp.h * k)
    const l: Layer = {
      id: uid(), kind: 'frame', name: `Quadro ${tp.name}`,
      x: round2((dim.W - w) / 2), y: round2((dim.H - h) / 2), w, h,
      shape: tp.shape, radius: tp.radius, fit: 'contain', zoom: 1, offX: 0, offY: 0,
    }
    setLayers([...project.layers, l]); setSelId(l.id)
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

  /** Centraliza ou preenche o corte em relação ao gabarito (não à sangria). */
  const centerLayer = (axis: 'h' | 'v') => {
    if (!selected || !t) return
    const b = t.bleed
    if (axis === 'h') updateLayer(selected.id, { x: round2(b + (t.w - selected.w) / 2) })
    else updateLayer(selected.id, { y: round2(b + (t.h - selected.h) / 2) })
  }
  const fillCut = () => {
    if (!selected || !t || selected.kind !== 'image' || !selected.srcW || !selected.srcH) return
    const s = Math.max(t.w / selected.srcW, t.h / selected.srcH)
    const w = round2(selected.srcW * s), h = round2(selected.srcH * s)
    updateLayer(selected.id, { x: round2(t.bleed + (t.w - w) / 2), y: round2(t.bleed + (t.h - h) / 2), w, h, zoom: 1, offX: 0, offY: 0 })
  }

  const onImageFile = async (file: File | undefined, replaceId?: string | null) => {
    if (!file || !project || !dim) return
    if (!file.type.startsWith('image/')) return toast.push('error', 'Escolha uma imagem (JPG, PNG, WEBP ou GIF).')
    try {
      const img = await readImage(file)
      if (replaceId) {
        const fr = project.layers.find(x => x.id === replaceId)
        // Quadro retangular: ajusta a altura à foto, mantendo a largura escolhida.
        const h = fr && fr.kind === 'frame' && fr.shape !== 'circle' ? round2(fr.w * img.h / img.w) : undefined
        updateLayer(replaceId, { src: img.src, srcW: img.w, srcH: img.h, zoom: 1, offX: 0, offY: 0, fit: 'contain', ...(h !== undefined ? { h } : {}) })
        setSelId(replaceId)
        return
      }
      const { W, H } = dim
      let w = W * 0.8
      let h = w * img.h / img.w
      if (h > H * 0.8) { h = H * 0.8; w = h * img.w / img.h }
      const l: Layer = {
        id: uid(), kind: 'image', name: `Imagem ${project.layers.filter(x => x.kind === 'image').length + 1}`,
        x: round2((W - w) / 2), y: round2((H - h) / 2), w: round2(w), h: round2(h),
        src: img.src, srcW: img.w, srcH: img.h, zoom: 1, offX: 0, offY: 0,
      }
      setLayers([...project.layers, l]); setSelId(l.id)
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Falha ao carregar a imagem.')
    }
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const f = Array.from(e.dataTransfer.files).find(x => x.type.startsWith('image/'))
    const frameEl = (e.target as HTMLElement).closest('[data-frame-id]') as HTMLElement | null
    if (f) onImageFile(f, frameEl?.dataset.frameId ?? (selected?.kind === 'frame' ? selected.id : null))
    else toast.push('error', 'Arraste uma imagem (JPG, PNG, WEBP ou GIF).')
  }

  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey) return
    e.preventDefault()
    setZoom(z => clamp(z * (e.deltaY < 0 ? 1.1 : 0.9), 0.25, 4))
  }

  /* Arrastar: mover a camada, mover a foto dentro do quadro ou ajustar o tamanho do quadro */
  const startDrag = (e: RPointerEvent<HTMLDivElement>, l: Layer, mode: 'move' | 'image' | 'resize' = 'move') => {
    if (!project || l.locked) return
    e.stopPropagation()
    setSelId(l.id)
    dragRef.current = { id: l.id, mode, sx: e.clientX, sy: e.clientY, ox: l.x, oy: l.y, ow: l.w, oh: l.h, ofx: l.offX ?? 0, ofy: l.offY ?? 0, before: project.layers, moved: false }
    const r3 = (v: number) => Math.round(v * 1000) / 1000
    const move = (ev: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const dx = (ev.clientX - d.sx) / ppm
      const dy = (ev.clientY - d.sy) / ppm
      if (Math.abs(dx) + Math.abs(dy) > 0.05) d.moved = true
      patchProject(p => ({
        ...p,
        layers: p.layers.map(x => {
          if (x.id !== d.id) return x
          if (d.mode === 'resize') {
            if (x.shape === 'circle') { const s = round2(Math.max(5, d.ow + dx, d.oh + dy)); return { ...x, w: s, h: s } }
            return { ...x, w: round2(Math.max(5, d.ow + dx)), h: round2(Math.max(5, d.oh + dy)) }
          }
          if (d.mode === 'image') return { ...x, offX: clamp(r3(d.ofx + dx / x.w), -1, 1), offY: clamp(r3(d.ofy + dy / x.h), -1, 1) }
          return { ...x, x: round2(d.ox + dx), y: round2(d.oy + dy) }
        }),
      }))
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

  const selected = project?.layers.find(l => l.id === selId) ?? null
  const layersTopFirst = project ? [...project.layers].reverse() : []

  /* ---------------- Render de camadas no canvas ---------------- */

  const renderLayer = (l: Layer) => {
    const sel = selId === l.id
    if (l.kind === 'frame') return (
      <div key={l.id} data-frame-id={l.id} onPointerDown={e => startDrag(e, l, frameMode === 'image' && sel ? 'image' : 'move')}
        className={cn('absolute', l.locked ? 'pointer-events-none' : frameMode === 'image' && sel ? 'cursor-grab' : 'cursor-move', sel && 'outline outline-2 outline-cyan-300')}
        style={{ left: l.x * ppm, top: l.y * ppm, width: l.w * ppm, height: l.h * ppm, display: l.hidden ? 'none' : undefined }}>
        <FrameView l={l} ppm={ppm} />
        {sel && !l.locked && (
          <div onPointerDown={e => startDrag(e, l, 'resize')} title="Arraste para ajustar o tamanho"
            className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-sm border-2 border-cyan-300 bg-[#0b1020]" />
        )}
      </div>
    )
    return (
      <div key={l.id} onPointerDown={e => startDrag(e, l)}
        className={cn('absolute', l.locked ? 'pointer-events-none' : 'cursor-move', sel && 'outline outline-2 outline-cyan-300')}
        style={{
          left: l.x * ppm, top: l.y * ppm, width: l.w * ppm, height: l.h * ppm,
          display: l.hidden ? 'none' : undefined,
          overflow: l.kind === 'text' ? 'visible' : 'hidden',
        }}>
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

  const toggle = (on: boolean) => cn('rounded-lg border px-2 py-1.5 text-xs', on ? 'border-brand/60 bg-brand/15 text-white' : 'border-white/10 text-white/60 hover:text-white')
  const btn = 'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs text-white/80 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent'

  /* ---------------- Editor em tela cheia ---------------- */

  const editor = editorOpen && project && t && dim ? (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#0b1020] text-white">
      {/* Barra superior */}
      <header className="flex h-14 shrink-0 items-center gap-2 overflow-x-auto border-b border-white/10 bg-[#0f1628] px-3">
        <button className={btn} onClick={closeEditor}><ArrowLeft className="h-4 w-4" /> Voltar às artes</button>
        <span className="text-lg" aria-hidden>{t.emoji ?? '🖼️'}</span>
        <input className="input h-8 w-64 max-w-[40vw]" value={project.name} aria-label="Nome da arte"
          onChange={e => patchProject(p => ({ ...p, name: e.target.value }))} />
        <button className={btn} onClick={() => setTplMode('project')}><Ruler className="h-4 w-4" /> Medidas</button>
        <span className="mx-1 h-5 w-px bg-white/10" />
        <button className={btn} onClick={undo} disabled={past.length === 0} title="Desfazer (Ctrl+Z)"><Undo2 className="h-4 w-4" /> Desfazer</button>
        <button className={btn} onClick={redo} disabled={future.length === 0} title="Refazer (Ctrl+Y)"><Redo2 className="h-4 w-4" /> Refazer</button>
        <span className="mx-1 h-5 w-px bg-white/10" />
        <button className={btn} onClick={() => setZoom(z => clamp(z * 0.8, 0.25, 4))} title="Diminuir"><Minus className="h-4 w-4" /></button>
        <button className={cn(btn, 'min-w-[3.5rem] justify-center')} onClick={() => setZoom(1)} title="Ajustar à tela">{Math.round(zoom * 100)}%</button>
        <button className={btn} onClick={() => setZoom(z => clamp(z * 1.25, 0.25, 4))} title="Aumentar"><Plus className="h-4 w-4" /></button>
        <button className={btn} onClick={() => setZoom(1)} title="Ajustar à tela"><Maximize className="h-4 w-4" /> Ajustar</button>
        <button className={btn} onClick={() => setShowGuides(!showGuides)}>
          {showGuides ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />} Guias
        </button>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden shrink-0 whitespace-nowrap text-[11px] text-white/40 xl:inline">{saved ? 'Guardado neste navegador' : 'Não guardado'}</span>
          <Button size="sm" className="shrink-0 whitespace-nowrap" onClick={() => setExportOpen(true)}><Printer className="h-4 w-4" /> Salvar / Imprimir</Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Painel esquerdo: adicionar e camadas */}
        <aside className="flex w-64 shrink-0 flex-col gap-4 overflow-y-auto border-r border-white/10 bg-[#0f1628] p-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">Adicionar</p>
            <div className="grid grid-cols-1 gap-2">
              <button className="flex items-center gap-3 rounded-lg border border-white/10 p-3 text-left text-sm hover:border-brand/50 hover:bg-brand/10" onClick={() => fileRef.current?.click()}>
                <ImageIcon className="h-5 w-5 text-brand-soft" />
                <span><span className="block font-medium">Imagem</span><span className="text-[11px] text-white/40">Ou arraste para o canvas</span></span>
              </button>
              <button className="flex items-center gap-3 rounded-lg border border-white/10 p-3 text-left text-sm hover:border-brand/50 hover:bg-brand/10" onClick={addText}>
                <Type className="h-5 w-5 text-brand-soft" />
                <span><span className="block font-medium">Texto</span><span className="text-[11px] text-white/40">Nome, data, frase</span></span>
              </button>
              <button className="flex items-center gap-3 rounded-lg border border-white/10 p-3 text-left text-sm hover:border-brand/50 hover:bg-brand/10" onClick={addRect}>
                <Square className="h-5 w-5 text-brand-soft" />
                <span><span className="block font-medium">Forma</span><span className="text-[11px] text-white/40">Faixa ou fundo colorido</span></span>
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { onImageFile(e.target.files?.[0]); e.target.value = '' }} />
              <input ref={replaceRef} type="file" accept="image/*" className="hidden"
                onChange={e => { onImageFile(e.target.files?.[0], replaceIdRef.current); e.target.value = '' }} />
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-white/40">Quadros de imagem</p>
            <p className="mb-2 text-[11px] text-white/40">A foto cabe inteira no quadro. Depois ajuste o tamanho e a largura.</p>
            <div className="space-y-3">
              {GROUPS.map(g => (
                <div key={g}>
                  <p className="mb-1.5 text-[11px] text-white/55">{GROUP_EMOJI[g]} {g}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {BUILTIN.filter(x => x.group === g).map(tp => (
                      <button key={tp.id} title={tp.name} onClick={() => addFrame(tp)}
                        className="rounded-lg border border-white/10 p-2 text-left text-[11px] hover:border-brand/50 hover:bg-brand/10">
                        <span className="block text-sm leading-none">{tp.emoji}</span>
                        <span className="mt-1 block font-medium">{tp.w} × {tp.h} mm</span>
                        <span className="block text-white/40">{SHAPE_LABEL[tp.shape]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="min-h-0">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">Camadas <span className="normal-case text-white/30">(topo primeiro)</span></p>
            {layersTopFirst.length === 0 ? (
              <p className="text-xs text-white/40">Ainda sem camadas.</p>
            ) : (
              <div className="space-y-1">
                {layersTopFirst.map(l => {
                  const dpi = effectiveDpi(l)
                  const lowRes = dpi !== null && dpi < t.dpi
                  return (
                    <div key={l.id} onClick={() => setSelId(l.id)}
                      className={cn('flex items-center gap-0.5 rounded-lg px-2 py-1.5 text-xs', selId === l.id ? 'bg-brand/20' : 'hover:bg-white/[0.05]', l.hidden && 'opacity-50')}>
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
          </div>
        </aside>

        {/* Canvas */}
        <main ref={areaRef} className="relative min-w-0 flex-1 overflow-auto"
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onWheel={onWheel}>
          <div className="flex min-h-full min-w-full items-center justify-center p-10"
            onPointerDown={() => setSelId(null)}>
            <div className="relative">
              <div className={cn('relative bg-white shadow-2xl transition-shadow', dragOver && 'ring-4 ring-brand/60')}
                style={{ width: dim.W * ppm, height: dim.H * ppm, overflow: 'hidden' }}
                onPointerDown={e => { e.stopPropagation(); setSelId(null) }}>
                {project.layers.map(renderLayer)}
                {showGuides && <Guides t={t} ppm={ppm} />}
                {project.layers.length === 0 && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-slate-400">
                    Arraste uma imagem para aqui<br />ou use os botões à esquerda
                  </div>
                )}
              </div>
              <div className="mt-3 flex flex-wrap justify-center gap-4 text-[11px] text-white/50">
                <span><span className="inline-block h-2 w-3 bg-cyan-400 align-middle" /> Linha de corte</span>
                <span><span className="inline-block h-2 w-3 border border-dashed border-green-400 align-middle" /> Área segura</span>
                <span><span className="inline-block h-2 w-3 bg-black/50 align-middle" /> Sangria</span>
                {t.hole && <span><span className="inline-block h-2 w-3 border border-pink-400 align-middle" /> Furo</span>}
                <span>{t.w}×{t.h} mm · sangria {t.bleed} mm · {t.dpi} DPI</span>
              </div>
            </div>
          </div>
        </main>

        {/* Painel direito: propriedades */}
        <aside className="flex w-72 shrink-0 flex-col gap-4 overflow-y-auto border-l border-white/10 bg-[#0f1628] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/40">Propriedades</p>
          {!selected ? (
            <div className="rounded-lg border border-dashed border-white/10 p-4 text-xs text-white/50">
              Clique numa imagem, texto ou forma no canvas para editar. Pode também selecioná-la na lista de camadas.
            </div>
          ) : (
            <div className="space-y-3">
              <Field label="Nome"><input className="input" value={selected.name} onChange={e => updateLayer(selected.id, { name: e.target.value })} /></Field>

              <div>
                <p className="mb-1 text-[11px] text-white/40">Posição no corte</p>
                <div className="grid grid-cols-2 gap-2">
                  <button className={btn + ' justify-center border border-white/10'} onClick={() => centerLayer('h')}><AlignCenter className="h-3.5 w-3.5" /> Centro H</button>
                  <button className={btn + ' justify-center border border-white/10'} onClick={() => centerLayer('v')}><AlignCenterVertical className="h-3.5 w-3.5" /> Centro V</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Field label="X (mm)"><input type="number" step="0.5" className="input" value={selected.x} onChange={e => updateLayer(selected.id, { x: Number(e.target.value) })} /></Field>
                <Field label="Y (mm)"><input type="number" step="0.5" className="input" value={selected.y} onChange={e => updateLayer(selected.id, { y: Number(e.target.value) })} /></Field>
                <Field label="Largura (mm)"><input type="number" step="0.5" className="input" value={selected.w} onChange={e => updateLayer(selected.id, { w: Number(e.target.value) })} /></Field>
                <Field label="Altura (mm)"><input type="number" step="0.5" className="input" value={selected.h} onChange={e => updateLayer(selected.id, { h: Number(e.target.value) })} /></Field>
              </div>

              {selected.kind === 'frame' && (
                <>
                  <Field label="Formato do quadro">
                    <select className="input" value={selected.shape ?? 'rect'} onChange={e => updateLayer(selected.id, { shape: e.target.value as Shape })}>
                      <option value="rect">Retangular</option>
                      <option value="rounded">Retangular arredondado</option>
                      <option value="circle">Circular</option>
                      <option value="heart">Coração</option>
                    </select>
                  </Field>
                  {selected.shape === 'rounded' && (
                    <Field label="Raio dos cantos (mm)"><input type="number" step="0.5" min={0} className="input" value={selected.radius ?? 0} onChange={e => updateLayer(selected.id, { radius: Number(e.target.value) })} /></Field>
                  )}

                  <div>
                    <p className="mb-1 text-[11px] text-white/40">Foto no quadro</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button className={toggle((selected.fit ?? 'contain') === 'contain')} onClick={() => updateLayer(selected.id, { fit: 'contain' })}>Caber sem cortar</button>
                      <button className={toggle(selected.fit === 'cover')} onClick={() => updateLayer(selected.id, { fit: 'cover' })}>Preencher e cortar</button>
                    </div>
                  </div>

                  <div>
                    <p className="mb-1 text-[11px] text-white/40">Ao arrastar no canvas</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button className={toggle(frameMode === 'move')} onClick={() => setFrameMode('move')}>Mover quadro</button>
                      <button className={toggle(frameMode === 'image')} onClick={() => setFrameMode('image')}>Mover a foto</button>
                    </div>
                    <p className="mt-1 text-[11px] text-white/40">Com "Mover a foto", arraste a imagem dentro do quadro.</p>
                  </div>

                  <button className={btn + ' w-full justify-center border border-white/10'} onClick={() => { replaceIdRef.current = selected.id; replaceRef.current?.click() }}>
                    <Upload className="h-3.5 w-3.5" /> {selected.src ? 'Trocar foto' : 'Escolher foto'}
                  </button>
                  <Field label={`Zoom da foto (${(selected.zoom ?? 1).toFixed(2)}×)`}>
                    <input type="range" min={0.5} max={3} step={0.01} className="w-full" value={selected.zoom ?? 1} onChange={e => updateLayer(selected.id, { zoom: Number(e.target.value) })} />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <button className={btn + ' justify-center border border-white/10'} onClick={() => updateLayer(selected.id, { offX: 0, offY: 0 })}><AlignCenter className="h-3.5 w-3.5" /> Centrar foto</button>
                    {selected.shape !== 'circle' && !!selected.srcW && (
                      <button className={btn + ' justify-center border border-white/10'} onClick={() => { if (selected.srcW && selected.srcH) updateLayer(selected.id, { h: round2(selected.w * selected.srcH / selected.srcW) }) }}>Altura da foto</button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 items-end gap-2">
                    <Field label="Cor de fundo"><input type="color" className="input h-9 p-1" value={selected.bg ?? '#ffffff'} onChange={e => updateLayer(selected.id, { bg: e.target.value })} /></Field>
                    <button className={btn + ' h-9 justify-center border border-white/10'} onClick={() => updateLayer(selected.id, { bg: undefined })}>Sem fundo</button>
                  </div>
                  <p className={cn('text-xs', (effectiveDpi(selected) ?? 0) < t.dpi ? 'text-amber-300' : 'text-white/50')}>
                    Resolução efetiva: {effectiveDpi(selected) ?? '—'} DPI {(effectiveDpi(selected) ?? 0) < t.dpi && '· abaixo do recomendado'}
                  </p>
                </>
              )}

              {selected.kind === 'image' && (
                <>
                  <button className={btn + ' w-full justify-center border border-white/10'} onClick={fillCut}><Frame className="h-3.5 w-3.5" /> Preencher o corte</button>
                  <Field label={`Zoom (${(selected.zoom ?? 1).toFixed(2)}×)`}>
                    <input type="range" min={1} max={3} step={0.01} className="w-full" value={selected.zoom ?? 1} onChange={e => updateLayer(selected.id, { zoom: Number(e.target.value) })} />
                  </Field>
                  <Field label="Deslocar horizontal">
                    <input type="range" min={-0.5} max={0.5} step={0.01} className="w-full" value={selected.offX ?? 0} onChange={e => updateLayer(selected.id, { offX: Number(e.target.value) })} />
                  </Field>
                  <Field label="Deslocar vertical">
                    <input type="range" min={-0.5} max={0.5} step={0.01} className="w-full" value={selected.offY ?? 0} onChange={e => updateLayer(selected.id, { offY: Number(e.target.value) })} />
                  </Field>
                  <p className={cn('text-xs', (effectiveDpi(selected) ?? 0) < t.dpi ? 'text-amber-300' : 'text-white/50')}>
                    Resolução efetiva: {effectiveDpi(selected) ?? '—'} DPI {(effectiveDpi(selected) ?? 0) < t.dpi && '· abaixo do recomendado'}
                  </p>
                  <button className={btn + ' w-full justify-center border border-white/10'} onClick={() => { replaceIdRef.current = selected.id; replaceRef.current?.click() }}>
                    <Upload className="h-3.5 w-3.5" /> Substituir imagem
                  </button>
                </>
              )}

              {selected.kind === 'text' && (
                <>
                  <Field label="Texto">
                    <textarea rows={3} className="input" value={selected.text ?? ''} onChange={e => updateLayer(selected.id, { text: e.target.value })} />
                  </Field>
                  <Field label="Fonte">
                    <select className="input" value={selected.font ?? 'Arial'} onChange={e => updateLayer(selected.id, { font: e.target.value })}>
                      {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Tamanho (mm)"><input type="number" step="0.5" min={1} className="input" value={selected.size ?? 6} onChange={e => updateLayer(selected.id, { size: Number(e.target.value) })} /></Field>
                    <Field label="Cor"><input type="color" className="input h-9 p-1" value={selected.color ?? '#111111'} onChange={e => updateLayer(selected.id, { color: e.target.value })} /></Field>
                  </div>
                  <div className="flex items-center gap-2">
                    {(['left', 'center', 'right'] as const).map(a => (
                      <button key={a} onClick={() => updateLayer(selected.id, { align: a })}
                        className={cn('flex-1 rounded-lg border px-2 py-1.5 text-xs', (selected.align ?? 'left') === a ? 'border-brand/60 bg-brand/15' : 'border-white/10 text-white/60 hover:text-white')}>
                        {a === 'left' ? 'Esquerda' : a === 'center' ? 'Centro' : 'Direita'}
                      </button>
                    ))}
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
          )}
        </aside>
      </div>

      {/* Dica de atalhos */}
      <footer className="border-t border-white/10 bg-[#0f1628] px-4 py-1.5 text-[11px] text-white/45">
        Arraste para mover · Setas: ajustar 0,5 mm (Shift: 5 mm) · Delete: apagar · Ctrl+Z / Ctrl+Y: desfazer / refazer · Ctrl+roda do rato: zoom · Esc: desselecionar
      </footer>
    </div>
  ) : null

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Editor de Gabaritos"
        description="Artes para ímanes, chaveiros e calendários, com medidas reais em mm, sangria, área segura e exportação em PNG para impressão."
        actions={<Button onClick={() => setPickerOpen(true)}><FilePlus2 className="h-4 w-4" /> Nova arte</Button>}
      />

      {store.projects.length === 0 ? (
        <Card>
          <EmptyState icon={<ImageIcon className="h-5 w-5" />} title="Sem artes"
            description="Escolha um gabarito para abrir o editor em tela cheia."
            action={<Button onClick={() => setPickerOpen(true)}>Escolher gabarito</Button>} />
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader title="Artes guardadas" subtitle={`${store.projects.length} neste navegador · ${saved ? 'guardado' : 'não guardado'}`} />
            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {store.projects.map(p => (
                <div key={p.id} className="flex flex-col rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:border-brand/40">
                  <button className="min-w-0 text-left" onClick={() => openProject(p.id)}>
                    <p className="truncate text-sm font-medium"><span className="mr-1.5">{p.template.emoji ?? '🖼️'}</span>{p.name}</p>
                    <p className="mt-1 text-[11px] text-white/40">{p.template.w}×{p.template.h} mm · {p.layers.length} camadas · {dateTime(p.updated)}</p>
                  </button>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" onClick={() => openProject(p.id)}>Abrir editor</Button>
                    <Button size="sm" variant="ghost" onClick={() => duplicateProject(p)}><Copy className="h-3.5 w-3.5" /> Duplicar</Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteProject(p)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {editor && createPortal(editor, document.body)}
      {exportOpen && project && <ExportOverlay project={project} onClose={() => setExportOpen(false)} />}

      {/* Escolha de gabarito */}
      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title="Escolher gabarito" wide
        footer={<div className="flex flex-wrap gap-2">
          <Button onClick={() => { setPickerOpen(false); setTplDraft({ ...BUILTIN[0], id: '', name: 'Arte personalizada', group: GROUPS[0], emoji: '✏️', builtin: false }); setTplMode('new-art') }}><Ruler className="h-4 w-4" /> Criar arte com medidas</Button>
          <Button variant="outline" onClick={() => { setPickerOpen(false); setTplDraft({ ...BUILTIN[0], id: '', name: 'Novo gabarito', builtin: false }); setTplMode('library') }}><FilePlus2 className="h-4 w-4" /> Novo gabarito personalizado</Button>
        </div>}>
        <div className="space-y-5">
          {GROUPS.map(g => (
            <div key={g}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">{GROUP_EMOJI[g]} {g}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {library.filter(x => x.group === g).map(tpl => (
                  <div key={tpl.id} className="flex items-center gap-2 rounded-lg border border-white/10 p-3 hover:border-brand/40">
                    <button className="min-w-0 flex-1 text-left" onClick={() => createProject(tpl)}>
                      <p className="truncate text-sm"><span className="mr-2 text-lg">{tpl.emoji ?? '🖼️'}</span>{tpl.name}</p>
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
        onApply={nt => { if (tplMode === 'new-art') { createProject({ ...nt, id: 'custom', builtin: false }); setTplMode(null); return } patchProject(p => ({ ...p, template: { ...nt, builtin: false } })); setTplMode(null); toast.push('success', 'Medidas aplicadas a esta arte.') }}
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
