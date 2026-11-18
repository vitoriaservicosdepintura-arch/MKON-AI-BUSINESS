import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Plus, Save, Trash2, Upload, Globe } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button, Card, CardHeader, Field, Skeleton } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { SiteView, type SiteContent, type SiteItem, type SiteSection, type SiteSectionType, type SiteTheme } from '@/components/site/SiteView'

type Row = { id: string; title: string; status: string; slug: string | null; content: SiteContent; theme: Partial<SiteTheme> }

const RESERVED = ['crm', 'admin', 'prospeccao', 'agentes', 'agentes-autonomos', 'mensagens', 'websites', 'reunioes', 'mkon-ai', 'propostas', 'nfc', 'projetos', 'financeiro', 'relatorios', 'loja-gifs', 'login', 'r', 's', 'api', 'assets']
const DEFAULT_THEME: SiteTheme = { primary: '#2563EB', accent: '#0EA5E9', bg: '#FFFFFF', text: '#0F172A' }
const SECTION_NAMES: Record<SiteSectionType, string> = { services: 'Serviços', about: 'Sobre nós', gallery: 'Galeria', stats: 'Números', process: 'Processo', testimonials: 'Testemunhos' }
const ITEM_LABELS: Partial<Record<SiteSectionType, [string, string]>> = {
  services: ['Serviço', 'Descrição'], process: ['Etapa', 'Descrição'], testimonials: ['Nome do cliente', 'Testemunho'], stats: ['Valor (ex.: +300)', 'Legenda'],
}

async function uploadImage(siteId: string, file: File): Promise<string> {
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${siteId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from('site-media').upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw error
  return supabase.storage.from('site-media').getPublicUrl(path).data.publicUrl
}

/** Editor do site: textos, cores, menu, imagens, secções e contactos, com pré-visualização e abertura no browser. */
export default function WebsiteEditor() {
  const { id = '' } = useParams()
  const toast = useToast()
  const [row, setRow] = useState<Row | null | undefined>(undefined)
  const [content, setContent] = useState<SiteContent>({})
  const [theme, setTheme] = useState<SiteTheme>(DEFAULT_THEME)
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('websites').select('id,title,status,slug,content,theme').eq('id', id).maybeSingle()
    if (error) { toast.push('error', error.message); return setRow(null) }
    if (!data) return setRow(null)
    const r = data as Row
    setRow(r); setTitle(r.title); setSlug(r.slug ?? ''); setContent(r.content ?? {})
    setTheme({ ...DEFAULT_THEME, ...(r.theme ?? {}) })
  }, [id, toast])

  useEffect(() => { load() }, [load])

  const set = (patch: Partial<SiteContent>) => setContent(prev => ({ ...prev, ...patch }))
  const setHero = (patch: Record<string, string>) => set({ hero: { ...(content.hero ?? {}), ...patch } })
  const setBrand = (patch: Record<string, string>) => set({ brand: { ...(content.brand ?? {}), ...patch } })
  const setContact = (patch: Record<string, string>) => set({ contact: { ...(content.contact ?? {}), ...patch } })
  const sections = content.sections ?? []
  /** Atualização segura mesmo com várias chamadas seguidas (ex.: upload de várias fotos). */
  const setSections = (next: SiteSection[] | ((prev: SiteSection[]) => SiteSection[])) =>
    setContent(prev => ({ ...prev, sections: typeof next === 'function' ? next(prev.sections ?? []) : next }))
  const updateSection = (i: number, patch: Partial<SiteSection>) => setSections(sections.map((x, j) => j === i ? { ...x, ...patch } : x))
  const menu = content.menu ?? []

  const validSlug = (s: string) => /^[a-z0-9-]{3,60}$/.test(s) && !RESERVED.includes(s)

  /** Guarda o rascunho (ou publica). Devolve true se correu bem. */
  const save = async (publish = false): Promise<boolean> => {
    const cleanSlug = slug.trim().toLowerCase()
    if (cleanSlug && !validSlug(cleanSlug)) { toast.push('error', 'Endereço inválido: use 3 a 60 letras minúsculas, números ou hífen, sem palavras reservadas.'); return false }
    setSaving(true)
    const patch: Record<string, unknown> = { title: title.trim() || 'Site', slug: cleanSlug || null, content, theme, updated_at: new Date().toISOString() }
    if (publish) { patch.status = 'publicado'; patch.published_url = `${window.location.origin}/${cleanSlug}` }
    const { error } = await supabase.from('websites').update(patch).eq('id', id)
    setSaving(false)
    if (error) { toast.push('error', error.code === '23505' ? 'Esse endereço já está em uso por outro site.' : error.message); return false }
    toast.push('success', publish ? 'Site publicado.' : 'Alterações guardadas.')
    load()
    return true
  }

  const openInBrowser = async () => {
    if (!slug.trim()) return toast.push('warning', 'Defina primeiro um endereço para o site.')
    if (!(await save(false))) return
    window.open(`/${slug.trim().toLowerCase()}`, '_blank', 'noopener')
  }

  const onImage = async (file: File | undefined, apply: (url: string) => void) => {
    if (!file) return
    setUploading(true)
    try { apply(await uploadImage(id, file)) }
    catch (e) { toast.push('error', e instanceof Error ? e.message : 'Falha no envio da imagem.') }
    finally { setUploading(false) }
  }

  const addSection = (type: SiteSectionType) => {
    const base: SiteSection = type === 'about' ? { type, title: 'Sobre nós', text: '' } : type === 'gallery' ? { type, title: 'Trabalhos', images: [] } : { type, title: SECTION_NAMES[type], items: [] }
    setSections([...sections, base])
  }

  const updateItem = (i: number, k: number, patch: Partial<SiteItem>) =>
    updateSection(i, { items: (sections[i].items ?? []).map((y, m) => m === k ? { ...y, ...patch } : y) })
  const removeItem = (i: number, k: number) => updateSection(i, { items: (sections[i].items ?? []).filter((_, m) => m !== k) })
  const addItem = (i: number) => updateSection(i, { items: [...(sections[i].items ?? []), { title: '', text: '' }] })

  if (row === undefined) return <div className="space-y-3"><Skeleton className="h-10" /><Skeleton className="h-96" /></div>
  if (row === null) return <p className="text-sm text-white/60">Site não encontrado. <Link className="underline" to="/websites">Voltar</Link></p>

  const publicUrl = slug.trim() ? `${window.location.origin}/${slug.trim().toLowerCase()}` : null
  const input = 'input w-full'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/websites" className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white"><ArrowLeft className="h-4 w-4" /> Websites</Link>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={openInBrowser} disabled={saving}><ExternalLink className="h-4 w-4" /> Abrir no browser</Button>
          <Button variant="outline" onClick={() => save(false)} loading={saving}><Save className="h-4 w-4" /> Guardar</Button>
          <Button onClick={() => save(true)} loading={saving}><Globe className="h-4 w-4" /> Publicar</Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader title="Endereço e nome" subtitle="O site fica disponível em /endereco" />
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              <Field label="Nome interno"><input className={input} value={title} onChange={e => setTitle(e.target.value)} /></Field>
              <Field label="Endereço (slug)" hint={publicUrl ?? 'Ex.: pintura-lisboa'}>
                <input className={input} value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="pintura-lisboa" />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Cores e estilo" />
            <div className="grid gap-3 p-5 sm:grid-cols-4">
              {(['primary', 'accent', 'bg', 'text'] as const).map(k => (
                <Field key={k} label={{ primary: 'Principal', accent: 'Destaque', bg: 'Fundo', text: 'Texto' }[k]}>
                  <input type="color" className="h-10 w-full cursor-pointer rounded-lg border border-white/10 bg-transparent" value={theme[k]} onChange={e => setTheme({ ...theme, [k]: e.target.value })} />
                </Field>
              ))}
              <Field label="Estilo" hint="Simples e moderno, ou profissional e luxuoso.">
                <select className={input} value={content.style ?? 'simple'} onChange={e => set({ style: e.target.value as 'pro' | 'simple' })}>
                  <option value="simple">Simples e moderno</option>
                  <option value="pro">Profissional e luxuoso</option>
                </select>
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Cabeçalho e menu" />
            <div className="space-y-3 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nome da marca"><input className={input} value={content.brand?.name ?? ''} onChange={e => setBrand({ name: e.target.value })} /></Field>
                <Field label="Slogan"><input className={input} value={content.brand?.tagline ?? ''} onChange={e => setBrand({ tagline: e.target.value })} /></Field>
              </div>
              {menu.map((m, i) => (
                <div key={i} className="flex gap-2">
                  <input className={input} placeholder="Texto" value={m.label} onChange={e => set({ menu: menu.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} />
                  <input className={input} placeholder="#secao" value={m.href} onChange={e => set({ menu: menu.map((x, j) => j === i ? { ...x, href: e.target.value } : x) })} />
                  <Button size="sm" variant="ghost" onClick={() => set({ menu: menu.filter((_, j) => j !== i) })} aria-label="Remover"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => set({ menu: [...menu, { label: 'Novo', href: '#contacto' }] })}><Plus className="h-3.5 w-3.5" /> Adicionar item</Button>
            </div>
          </Card>

          <Card>
            <CardHeader title="Hero (topo do site)" />
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              <Field label="Pequeno título"><input className={input} value={content.hero?.eyebrow ?? ''} onChange={e => setHero({ eyebrow: e.target.value })} /></Field>
              <Field label="Título"><input className={input} value={content.hero?.title ?? ''} onChange={e => setHero({ title: e.target.value })} /></Field>
              <div className="sm:col-span-2"><Field label="Subtítulo"><textarea rows={2} className={input} value={content.hero?.subtitle ?? ''} onChange={e => setHero({ subtitle: e.target.value })} /></Field></div>
              <Field label="Texto do botão"><input className={input} value={content.hero?.cta_label ?? ''} onChange={e => setHero({ cta_label: e.target.value })} /></Field>
              <Field label="Destino do botão"><input className={input} value={content.hero?.cta_href ?? ''} onChange={e => setHero({ cta_href: e.target.value })} /></Field>
              <div className="sm:col-span-2">
                <Field label="Imagem de fundo">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-white/75 hover:bg-white/[0.05]">
                    <Upload className="h-4 w-4" /> {uploading ? 'A enviar…' : 'Escolher imagem'}
                    <input type="file" accept="image/*" className="hidden" onChange={e => onImage(e.target.files?.[0], url => setHero({ image: url }))} />
                  </label>
                  {content.hero?.image && <div className="mt-2 flex items-center gap-2"><img src={content.hero.image} alt="" className="h-12 w-20 rounded object-cover" /><Button size="sm" variant="ghost" onClick={() => setHero({ image: '' })}>Remover</Button></div>}
                </Field>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Secções" subtitle="Acrescente e edite as partes do site" />
            <div className="space-y-4 p-5">
              {sections.map((s, i) => {
                const labels = ITEM_LABELS[s.type]
                return (
                  <div key={i} className="min-w-0 space-y-2 rounded-xl border border-white/[0.07] p-4">
                    <div className="flex items-center gap-2">
                      <input className={input} value={s.title ?? ''} onChange={e => updateSection(i, { title: e.target.value })} aria-label="Título da secção" />
                      <Button size="sm" variant="ghost" onClick={() => setSections(sections.filter((_, j) => j !== i))} aria-label="Remover secção"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                    <p className="text-[11px] uppercase tracking-wider text-white/35">{SECTION_NAMES[s.type]}</p>

                    {s.type === 'about' && <textarea rows={4} className={input} value={s.text ?? ''} onChange={e => updateSection(i, { text: e.target.value })} />}

                    {labels && (
                      <>
                        {(s.items ?? []).map((it, k) => (
                          <div key={k} className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]">
                            <input className={input} placeholder={labels[0]} value={it.title} onChange={e => updateItem(i, k, { title: e.target.value })} />
                            <input className={input} placeholder={labels[1]} value={it.text} onChange={e => updateItem(i, k, { text: e.target.value })} />
                            <Button size="sm" variant="ghost" onClick={() => removeItem(i, k)} aria-label="Remover item"><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        ))}
                        <Button size="sm" variant="outline" onClick={() => addItem(i)}><Plus className="h-3.5 w-3.5" /> Adicionar</Button>
                      </>
                    )}

                    {s.type === 'gallery' && (
                      <>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {(s.images ?? []).map((src, k) => (
                            <div key={k} className="relative">
                              <img src={src} alt="" className="aspect-[4/3] w-full rounded-lg object-cover" />
                              <button className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white" onClick={() => updateSection(i, { images: (s.images ?? []).filter((_, m) => m !== k) })} aria-label="Remover foto"><Trash2 className="h-3 w-3" /></button>
                            </div>
                          ))}
                        </div>
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-white/75 hover:bg-white/[0.05]">
                          <Upload className="h-4 w-4" /> {uploading ? 'A enviar…' : 'Adicionar fotos'}
                          <input type="file" accept="image/*" multiple className="hidden" onChange={async e => {
                            for (const f of Array.from(e.target.files ?? [])) await onImage(f, url => setSections(prev => prev.map((x, j) => j === i ? { ...x, images: [...(x.images ?? []), url] } : x)))
                          }} />
                        </label>
                      </>
                    )}
                  </div>
                )
              })}
              <div className="flex flex-wrap gap-2">
                {(Object.keys(SECTION_NAMES) as SiteSectionType[]).map(t => (
                  <Button key={t} size="sm" variant="outline" onClick={() => addSection(t)}><Plus className="h-3.5 w-3.5" /> {SECTION_NAMES[t]}</Button>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Contactos" />
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              <Field label="Telefone"><input className={input} value={content.contact?.phone ?? ''} onChange={e => setContact({ phone: e.target.value })} /></Field>
              <Field label="Email"><input className={input} value={content.contact?.email ?? ''} onChange={e => setContact({ email: e.target.value })} /></Field>
              <Field label="WhatsApp (com indicativo, ex.: 351912345678)"><input className={input} value={content.contact?.whatsapp ?? ''} onChange={e => setContact({ whatsapp: e.target.value })} /></Field>
              <Field label="Zona / morada"><input className={input} value={content.contact?.address ?? ''} onChange={e => setContact({ address: e.target.value })} /></Field>
            </div>
          </Card>
        </div>

        <div className="min-w-0 xl:sticky xl:top-4 xl:self-start">
          <Card>
            <CardHeader title="Pré-visualização" subtitle={publicUrl ?? 'Defina um endereço para ver o link público'} action={publicUrl ? <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-brand-soft hover:underline"><ExternalLink className="h-3 w-3" /> Abrir</a> : undefined} />
            <div className="max-h-[80vh] overflow-y-auto rounded-b-xl">
              <SiteView content={content} theme={theme} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
