import { useCallback, useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, ExternalLink, Globe, Plus, Save, Sparkles, Trash2, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Badge, Button, Card, CardHeader, Field, PageHeader, Skeleton } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'

type Room = { id: string; name: string; photos: string[]; caption?: string }
type Tour = { id: string; title: string; slug: string | null; status: 'rascunho' | 'publicado'; rooms: Room[] }

const RESERVED = ['crm', 'admin', 'prospeccao', 'agentes', 'agentes-autonomos', 'mensagens', 'websites', 'imoveis-tour', 'tour', 'propostas', 'nfc', 'login', 'r', 's', 'api', 'assets']
const uid = () => Math.random().toString(36).slice(2, 10)

async function uploadPhoto(tourId: string, roomId: string, file: File): Promise<string> {
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${tourId}/${roomId}/${Date.now()}-${uid()}.${ext}`
  const { error } = await supabase.storage.from('tour-media').upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw error
  return supabase.storage.from('tour-media').getPublicUrl(path).data.publicUrl
}

/** Imóveis tour 3D: venda do serviço a corretores, editor de tours (fotos por divisão) e guia de prompts. */
export default function ImoveisTour() {
  const toast = useToast()
  const [tours, setTours] = useState<Tour[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('property_tours').select('id, title, slug, status, rooms').order('created_at', { ascending: false })
    if (error) { toast.push('error', error.message); return setTours([]) }
    setTours((data ?? []) as Tour[])
  }, [toast])

  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!newTitle.trim()) return
    setBusy(true)
    const slug = `${newTitle.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'imovel'}-${uid().slice(0, 4)}`
    const { data, error } = await supabase.from('property_tours').insert({ title: newTitle.trim(), slug, rooms: [] }).select('id').single()
    setBusy(false)
    if (error) return toast.push('error', error.message)
    setNewTitle(''); setOpenId(data.id); load()
  }

  const tour = tours?.find(t => t.id === openId) ?? null

  return (
    <>
      <PageHeader title="Imóveis tour 3D" description="Transforme as fotos de um imóvel num tour que o comprador percorre no navegador, com setas no PC e no telemóvel." />

      <Card className="mb-5 p-5">
        <p className="text-sm font-semibold">Para corretores</p>
        <p className="mt-1 text-sm leading-relaxed text-white/60">
          Envia as fotos de cada divisão. O tour liga as divisões pela ordem em que as coloca e publica um link para o anúncio, para o comprador visitar sem sair de casa.
          Além do tour, o pacote inclui o guia de prompts abaixo.
        </p>
        <p className="mt-2 text-[11px] text-white/35">Venda e pagamento ainda não estão ligados; o preço fica por definir.</p>
      </Card>

      {!tour && (
        <Card className="mb-5 p-5">
          <p className="mb-2 text-sm font-semibold">Novo tour</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input className="input flex-1" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Ex.: T2 Rua das Flores, 12" />
            <Button onClick={create} loading={busy} disabled={!newTitle.trim()}><Plus className="h-4 w-4" /> Criar tour</Button>
          </div>
        </Card>
      )}

      {tour ? <TourEditor key={tour.id} tour={tour} onBack={() => { setOpenId(null); load() }} onSaved={load} /> : (
        <Card className="mb-5">
          <CardHeader title="Os meus tours" />
          <div className="space-y-2 p-4">
            {tours === null ? <Skeleton className="h-16" /> : tours.length === 0 ? <p className="text-sm text-white/45">Ainda não tem tours.</p> : tours.map(t => (
              <button key={t.id} onClick={() => setOpenId(t.id)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/[0.07] p-3 text-left hover:bg-white/[0.03]">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{t.title}</span>
                  <span className="text-[11px] text-white/40">{t.rooms?.length ?? 0} divisões</span>
                </span>
                <Badge tone={t.status === 'publicado' ? 'success' : 'neutral'}>{t.status === 'publicado' ? 'Publicado' : 'Rascunho'}</Badge>
              </button>
            ))}
          </div>
        </Card>
      )}

    </>
  )
}

function TourEditor({ tour, onBack, onSaved }: { tour: Tour; onBack: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [title, setTitle] = useState(tour.title)
  const [slug, setSlug] = useState(tour.slug ?? '')
  const [rooms, setRooms] = useState<Room[]>(tour.rooms ?? [])
  const [roomName, setRoomName] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const generateCaptions = async () => {
    setGenerating(true)
    try {
      const { data, error } = await supabase.functions.invoke('mkon-tour', { body: { action: 'captions', title, rooms: rooms.map(r => ({ id: r.id, name: r.name, photo: r.photos[0] ?? null })) } })
      if (error) throw error
      const map = ((data as { captions?: Record<string, string> })?.captions) ?? {}
      setRooms(rs => rs.map(r => (map[r.id] ? { ...r, caption: map[r.id] } : r)))
      toast.push('success', 'Legendas geradas. Revise antes de publicar.')
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Falha ao gerar legendas.')
    } finally { setGenerating(false) }
  }

  const publicUrl = slug ? `${window.location.origin}/tour/${slug}` : null

  const save = async (publish = false): Promise<boolean> => {
    const clean = slug.trim().toLowerCase()
    if (!/^[a-z0-9-]{3,60}$/.test(clean) || RESERVED.includes(clean)) { toast.push('error', 'Endereço inválido: 3 a 60 letras minúsculas, números ou hífen.'); return false }
    if (publish && rooms.every(r => r.photos.length === 0)) { toast.push('warning', 'Adicione pelo menos uma foto antes de publicar.'); return false }
    setSaving(true)
    const patch: Record<string, unknown> = { title: title.trim() || 'Imóvel', slug: clean, rooms }
    if (publish) patch.status = 'publicado'
    const { error } = await supabase.from('property_tours').update(patch).eq('id', tour.id)
    setSaving(false)
    if (error) { toast.push('error', error.code === '23505' ? 'Esse endereço já está em uso.' : error.message); return false }
    toast.push('success', publish ? 'Tour publicado.' : 'Guardado.')
    onSaved()
    return true
  }

  const addRoom = () => {
    if (!roomName.trim()) return
    setRooms(r => [...r, { id: uid(), name: roomName.trim(), photos: [] }])
    setRoomName('')
  }
  const patchRoom = (i: number, p: Partial<Room>) => setRooms(rs => rs.map((r, j) => (j === i ? { ...r, ...p } : r)))
  const move = (i: number, d: -1 | 1) => setRooms(rs => {
    const j = i + d
    if (j < 0 || j >= rs.length) return rs
    const copy = [...rs]; [copy[i], copy[j]] = [copy[j], copy[i]]; return copy
  })

  const addPhotos = async (i: number, files: FileList | null) => {
    if (!files || files.length === 0) return
    const room = rooms[i]
    setUploading(room.id)
    try {
      const urls: string[] = []
      for (const f of Array.from(files)) urls.push(await uploadPhoto(tour.id, room.id, f))
      setRooms(rs => rs.map((r, j) => (j === i ? { ...r, photos: [...r.photos, ...urls] } : r)))
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Falha ao enviar as fotos.')
    } finally { setUploading(null) }
  }

  return (
    <div className="mb-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button onClick={onBack} className="text-sm text-white/60 hover:text-white">← Todos os tours</button>
        <div className="flex flex-wrap gap-2">
          {publicUrl && tour.status === 'publicado' && <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-sm hover:bg-white/[0.05]"><ExternalLink className="h-4 w-4" /> Abrir tour</a>}
          <Button variant="outline" onClick={() => save(false)} loading={saving}><Save className="h-4 w-4" /> Guardar</Button>
          <Button onClick={() => save(true)} loading={saving}><Globe className="h-4 w-4" /> Publicar</Button>
        </div>
      </div>

      <Card>
        <CardHeader title="Imóvel" subtitle={publicUrl ?? 'Defina o endereço para obter o link'} />
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          <Field label="Nome do anúncio"><input className="input w-full" value={title} onChange={e => setTitle(e.target.value)} /></Field>
          <Field label="Endereço (slug)"><input className="input w-full" value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} /></Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Divisões" subtitle="A ordem da lista é a ordem da visita. Cada divisão leva as fotos nas paredes." />
        <div className="space-y-3 p-5">
          {rooms.map((r, i) => (
            <div key={r.id} className="space-y-3 rounded-xl border border-white/[0.07] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <input className="input min-w-0 flex-1" value={r.name} onChange={e => patchRoom(i, { name: e.target.value })} aria-label="Nome da divisão" />
                <Button size="sm" variant="ghost" onClick={() => move(i, -1)} aria-label="Subir"><ArrowUp className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="ghost" onClick={() => move(i, 1)} aria-label="Descer"><ArrowDown className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="ghost" onClick={() => setRooms(rs => rs.filter((_, j) => j !== i))} aria-label="Remover divisão"><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
              <input className="input w-full" value={r.caption ?? ''} onChange={e => patchRoom(i, { caption: e.target.value })} placeholder="Legenda de uma linha, como anúncio" aria-label="Legenda da divisão" />
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {r.photos.map((src, k) => (
                  <div key={k} className="relative">
                    <img src={src} alt="" className="aspect-[4/3] w-full rounded-lg object-cover" />
                    <button className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white" onClick={() => patchRoom(i, { photos: r.photos.filter((_, m) => m !== k) })} aria-label="Remover foto"><Trash2 className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-white/75 hover:bg-white/[0.05]">
                <Upload className="h-4 w-4" /> {uploading === r.id ? 'A enviar…' : 'Adicionar fotos'}
                <input type="file" accept="image/*" multiple className="hidden" onChange={e => { addPhotos(i, e.target.files); e.target.value = '' }} />
              </label>
            </div>
          ))}
          {rooms.length > 0 && <Button variant="outline" onClick={generateCaptions} loading={generating}><Sparkles className="h-4 w-4" /> Gerar legendas com IA</Button>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <input className="input flex-1" value={roomName} onChange={e => setRoomName(e.target.value)} placeholder="Ex.: Sala, Cozinha, Quarto 1" onKeyDown={e => e.key === 'Enter' && addRoom()} />
            <Button onClick={addRoom} disabled={!roomName.trim()}><Plus className="h-4 w-4" /> Adicionar divisão</Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
