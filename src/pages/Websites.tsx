import { useCallback, useEffect, useState } from 'react'
import { Globe, Plus, ExternalLink, Eye, CheckCircle, Archive, FileCode, Palette, Layout } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader, Skeleton } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { cn, relativeTime } from '@/lib/utils'
import { isDemoActive } from '@/lib/demo'

type Website = {
    id: string; title: string; status: string; preview_url: string | null; published_url: string | null
    created_at: string; updated_at: string
    companies: { name: string; city: string | null } | null
    website_templates: { name: string; segment: string } | null
}
type Template = { id: string; code: string; name: string; segment: string; is_active: boolean }

const DEMO_WEBSITES: Website[] = [
    { id: 'w1', title: 'Website Pinturas Alves', status: 'demonstracao', preview_url: 'https://demo.mkon.pt/pinturas-alves', published_url: null, created_at: new Date(Date.now() - 2 * 86400000).toISOString(), updated_at: new Date(Date.now() - 86400000).toISOString(), companies: { name: 'Pinturas Alves & Filhos', city: 'Lisboa' }, website_templates: { name: 'Pintores Profissionais', segment: 'pintura' } },
    { id: 'w2', title: 'Website Remodelações Norte', status: 'publicado', preview_url: null, published_url: 'https://remodelacoes-norte.pt', created_at: new Date(Date.now() - 30 * 86400000).toISOString(), updated_at: new Date(Date.now() - 5 * 86400000).toISOString(), companies: { name: 'Remodelações Norte Lda.', city: 'Porto' }, website_templates: { name: 'Remodelação & Obras', segment: 'remodelacao' } },
    { id: 'w3', title: 'Website Grupo Habitat', status: 'aprovado', preview_url: 'https://demo.mkon.pt/grupo-habitat', published_url: null, created_at: new Date(Date.now() - 7 * 86400000).toISOString(), updated_at: new Date(Date.now() - 2 * 86400000).toISOString(), companies: { name: 'Grupo Habitat', city: 'Lisboa' }, website_templates: { name: 'Construção Civil', segment: 'construcao' } },
]
const DEMO_TEMPLATES: Template[] = [
    { id: 't1', code: 'pintura-pro', name: 'Pintores Profissionais', segment: 'pintura', is_active: true },
    { id: 't2', code: 'remodelacao-plus', name: 'Remodelação & Obras', segment: 'remodelacao', is_active: true },
    { id: 't3', code: 'construcao-corp', name: 'Construção Civil', segment: 'construcao', is_active: true },
    { id: 't4', code: 'eletricidade-tech', name: 'Eletricistas & Instalações', segment: 'eletricidade', is_active: true },
    { id: 't5', code: 'canalizacao-pro', name: 'Canalizadores', segment: 'canalizacao', is_active: true },
    { id: 't6', code: 'manutencao-geral', name: 'Manutenção Geral', segment: 'manutencao', is_active: true },
    { id: 't7', code: 'jardim-landscape', name: 'Jardinagem & Paisagismo', segment: 'jardim', is_active: true },
    { id: 't8', code: 'limpeza-clean', name: 'Serviços de Limpeza', segment: 'limpeza', is_active: true },
]

const statusCfg: Record<string, { label: string; tone: 'success' | 'warning' | 'brand' | 'neutral' | 'danger'; icon: typeof CheckCircle }> = {
    rascunho: { label: 'Rascunho', tone: 'neutral', icon: FileCode },
    demonstracao: { label: 'Demonstração', tone: 'brand', icon: Eye },
    aprovado: { label: 'Aprovado', tone: 'warning', icon: CheckCircle },
    publicado: { label: 'Publicado', tone: 'success', icon: Globe },
    arquivado: { label: 'Arquivado', tone: 'neutral', icon: Archive },
}

export default function Websites() {
    const toast = useToast()
    const demo = isDemoActive()
    const [websites, setWebsites] = useState<Website[]>(demo ? DEMO_WEBSITES : [])
    const [templates, setTemplates] = useState<Template[]>(demo ? DEMO_TEMPLATES : [])
    const [loading, setLoading] = useState(!demo)
    const [tab, setTab] = useState<'websites' | 'templates'>('websites')
    const [statusFilter, setStatusFilter] = useState('')
    const [createOpen, setCreateOpen] = useState(false)
    const [selected, setSelected] = useState<Website | null>(null)

    const load = useCallback(async () => {
        if (demo) return
        const [ws, ts] = await Promise.all([
            supabase.from('websites').select('id, title, status, preview_url, published_url, created_at, updated_at, companies(name, city), website_templates(name, segment)').order('updated_at', { ascending: false }),
            supabase.from('website_templates').select('id, code, name, segment, is_active').order('name'),
        ])
        if (ws.error) toast.push('error', ws.error.message)
        else setWebsites((ws.data ?? []) as unknown as Website[])
        setTemplates((ts.data ?? []) as Template[])
        setLoading(false)
    }, [demo])
    useEffect(() => { load() }, [load])

    const changeStatus = async (site: Website, status: string) => {
        if (demo) { toast.push('warning', 'Modo demo.'); return }
        const { error } = await supabase.from('websites').update({ status }).eq('id', site.id)
        if (error) return toast.push('error', error.message)
        setWebsites(s => s.map(w => w.id === site.id ? { ...w, status } : w))
        toast.push('success', `Estado alterado para "${statusCfg[status]?.label}".`)
    }

    const filtered = websites.filter(w => !statusFilter || w.status === statusFilter)

    const statCounts = Object.fromEntries(Object.keys(statusCfg).map(s => [s, websites.filter(w => w.status === s).length]))

    return (
        <>
            <PageHeader title="Websites" description="Geração e gestão de websites para clientes. Crie demonstrações e publique com um clique." actions={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Novo website</Button>} />

            {/* Tabs */}
            <div className="mb-5 flex gap-1 rounded-lg border border-white/10 p-0.5 w-fit">
                {[{ key: 'websites', label: 'Websites', icon: Globe }, { key: 'templates', label: 'Templates', icon: Layout }].map(t => (
                    <button key={t.key} onClick={() => setTab(t.key as 'websites' | 'templates')} className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition', tab === t.key ? 'bg-brand/15 text-brand-soft' : 'text-white/50 hover:text-snow')}>
                        <t.icon className="h-3.5 w-3.5" /> {t.label}
                    </button>
                ))}
            </div>

            {tab === 'websites' && (
                <>
                    {/* Status filter pills */}
                    <div className="mb-4 flex flex-wrap gap-2">
                        <button onClick={() => setStatusFilter('')} className={cn('rounded-lg border px-3 py-1.5 text-xs transition', !statusFilter ? 'border-brand/50 bg-brand/10 text-brand-soft' : 'border-white/10 text-white/50 hover:text-snow')}>
                            Todos ({websites.length})
                        </button>
                        {Object.entries(statusCfg).map(([key, cfg]) => statCounts[key] > 0 && (
                            <button key={key} onClick={() => setStatusFilter(key)} className={cn('rounded-lg border px-3 py-1.5 text-xs transition', statusFilter === key ? 'border-brand/50 bg-brand/10 text-brand-soft' : 'border-white/10 text-white/50 hover:text-snow')}>
                                {cfg.label} ({statCounts[key]})
                            </button>
                        ))}
                    </div>

                    {loading ? (
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-40" />)}</div>
                    ) : filtered.length === 0 ? (
                        <Card><EmptyState icon={<Globe className="h-5 w-5" />} title="Nenhum website" description="Crie o primeiro website para um cliente." action={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Novo website</Button>} /></Card>
                    ) : (
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {filtered.map(w => {
                                const cfg = statusCfg[w.status] ?? statusCfg.rascunho
                                const Icon = cfg.icon
                                return (
                                    <Card key={w.id} className="flex flex-col">
                                        {/* Preview area */}
                                        <div className="flex h-32 items-center justify-center rounded-t-xl border-b border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-white/[0.01]">
                                            <div className="flex flex-col items-center gap-2 text-white/20">
                                                <Globe className="h-8 w-8" />
                                                <span className="text-[11px]">{w.website_templates?.segment ?? 'website'}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-1 flex-col p-4">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium">{w.title}</p>
                                                    <p className="truncate text-[11px] text-white/40">{w.companies?.name} {w.companies?.city ? `· ${w.companies.city}` : ''}</p>
                                                </div>
                                                <Badge tone={cfg.tone}><Icon className="h-3 w-3" /> {cfg.label}</Badge>
                                            </div>
                                            {w.website_templates && <p className="mt-1 text-[11px] text-white/30">{w.website_templates.name}</p>}
                                            <div className="mt-3 flex items-center gap-2">
                                                {w.preview_url && <a href={w.preview_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11px] text-brand-soft hover:underline"><ExternalLink className="h-3 w-3" /> Preview</a>}
                                                {w.published_url && <a href={w.published_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11px] text-green-400 hover:underline"><ExternalLink className="h-3 w-3" /> Publicado</a>}
                                                <span className="ml-auto text-[11px] text-white/25">{relativeTime(w.updated_at)}</span>
                                            </div>
                                            <div className="mt-3 flex gap-1.5">
                                                <Button size="sm" variant="ghost" className="flex-1" onClick={() => setSelected(w)}>Ver detalhes</Button>
                                                {w.status === 'demonstracao' && <Button size="sm" variant="outline" onClick={() => changeStatus(w, 'aprovado')}>Aprovar</Button>}
                                                {w.status === 'aprovado' && <Button size="sm" onClick={() => changeStatus(w, 'publicado')}>Publicar</Button>}
                                            </div>
                                        </div>
                                    </Card>
                                )
                            })}
                        </div>
                    )}
                </>
            )}

            {tab === 'templates' && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {templates.map(t => (
                        <Card key={t.id} className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10"><Palette className="h-4 w-4 text-brand-soft" /></div>
                                <div><p className="text-sm font-medium">{t.name}</p><p className="text-[11px] text-white/40">{t.segment}</p></div>
                            </div>
                            <Badge tone={t.is_active ? 'success' : 'neutral'}>{t.is_active ? 'Ativo' : 'Inativo'}</Badge>
                        </Card>
                    ))}
                </div>
            )}

            <CreateWebsiteModal open={createOpen} templates={templates} onClose={() => setCreateOpen(false)} onCreated={load} />
            <WebsiteDetailModal website={selected} onClose={() => setSelected(null)} onStatusChange={changeStatus} />
        </>
    )
}

function CreateWebsiteModal({ open, templates, onClose, onCreated }: { open: boolean; templates: Template[]; onClose: () => void; onCreated: () => void }) {
    const toast = useToast()
    const demo = isDemoActive()
    const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
    const [f, setF] = useState({ company_id: '', template_id: '', title: '' })
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        if (!open) return
        supabase.from('companies').select('id, name').order('name').limit(100).then(({ data }) => setCompanies(data ?? []))
    }, [open])

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (demo) { toast.push('warning', 'Modo demo.'); onClose(); return }
        setBusy(true)
        const { error } = await supabase.from('websites').insert({ company_id: f.company_id, template_id: f.template_id || null, title: f.title.trim(), status: 'rascunho' })
        setBusy(false)
        if (error) return toast.push('error', error.message)
        toast.push('success', 'Website criado.')
        setF({ company_id: '', template_id: '', title: '' }); onClose(); onCreated()
    }

    return (
        <Modal open={open} onClose={onClose} title="Novo website" footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" form="new-website" loading={busy}>Criar</Button></>}>
            <form id="new-website" onSubmit={submit} className="space-y-4">
                <Field label="Empresa *"><select required className="input" value={f.company_id} onChange={e => setF(s => ({ ...s, company_id: e.target.value }))}><option value="">— Selecionar —</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
                <Field label="Template"><select className="input" value={f.template_id} onChange={e => setF(s => ({ ...s, template_id: e.target.value }))}><option value="">— Sem template —</option>{templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
                <Field label="Título do website *"><input required className="input" value={f.title} onChange={e => setF(s => ({ ...s, title: e.target.value }))} placeholder="Ex.: Website Pinturas Alves" /></Field>
            </form>
        </Modal>
    )
}

function WebsiteDetailModal({ website: w, onClose, onStatusChange }: { website: Website | null; onClose: () => void; onStatusChange: (w: Website, s: string) => void }) {
    if (!w) return null
    const cfg = statusCfg[w.status] ?? statusCfg.rascunho
    return (
        <Modal open onClose={onClose} title={w.title} wide footer={<Button variant="ghost" onClick={onClose}>Fechar</Button>}>
            <div className="space-y-4">
                <div className="flex flex-wrap gap-2"><Badge tone={cfg.tone}>{cfg.label}</Badge>{w.website_templates && <Badge>{w.website_templates.name}</Badge>}</div>
                <div className="grid gap-3 sm:grid-cols-2 text-sm">
                    {w.companies && <div><p className="label">Cliente</p><p className="text-white/70">{w.companies.name} {w.companies.city ? `(${w.companies.city})` : ''}</p></div>}
                    {w.preview_url && <div><p className="label">Link de preview</p><a href={w.preview_url} target="_blank" rel="noreferrer" className="text-brand-soft hover:underline">{w.preview_url}</a></div>}
                    {w.published_url && <div><p className="label">URL publicado</p><a href={w.published_url} target="_blank" rel="noreferrer" className="text-green-400 hover:underline">{w.published_url}</a></div>}
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                    {w.status === 'rascunho' && <Button onClick={() => { onStatusChange(w, 'demonstracao'); onClose() }}>Marcar como demonstração</Button>}
                    {w.status === 'demonstracao' && <Button onClick={() => { onStatusChange(w, 'aprovado'); onClose() }}>Marcar como aprovado</Button>}
                    {w.status === 'aprovado' && <Button onClick={() => { onStatusChange(w, 'publicado'); onClose() }}>Publicar</Button>}
                    {w.status === 'publicado' && <Button variant="outline" onClick={() => { onStatusChange(w, 'arquivado'); onClose() }}>Arquivar</Button>}
                </div>
            </div>
        </Modal>
    )
}
