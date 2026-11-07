import { useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, Plus, Radar, Search, Sparkles, TrendingUp, Globe, Phone, MapPin, Tag, Bot, Loader2, Copy, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/log'
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader, Skeleton } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { CATEGORIES } from '@/lib/constants'
import { cn, normalizeWebsite, relativeTime } from '@/lib/utils'
import { isDemoActive } from '@/lib/demo'
import { analyzeLeadWithAI, generateProspectingMessage, isAiReady } from '@/lib/ai'

type Company = {
    id: string; name: string; category: string | null; city: string | null; region: string | null
    phone: string | null; email: string | null; website: string | null; has_website: boolean
    commercial_profile: string | null; identified_at: string
    lead_sources: { name: string } | null
    leads: { id: string; stage: string; score: number | null }[]
}

const DEMO_COMPANIES: Company[] = [
    { id: 'c1', name: 'Pinturas Alves & Filhos', category: 'Pintura', city: 'Lisboa', region: 'Lisboa', phone: '912345678', email: 'contato@pinturas-alves.pt', website: null, has_website: false, commercial_profile: 'Empresa familiar de pintura com 15 anos de experiência.', identified_at: new Date(Date.now() - 86400000).toISOString(), lead_sources: { name: 'Google Maps' }, leads: [{ id: 'l1', stage: 'qualificado', score: 82 }] },
    { id: 'c2', name: 'Remodelações Norte Lda.', category: 'Remodelação', city: 'Porto', region: 'Porto', phone: '932987654', email: null, website: 'https://remodlacoes-norte.pt', has_website: true, commercial_profile: null, identified_at: new Date(Date.now() - 3 * 86400000).toISOString(), lead_sources: { name: 'Google Maps' }, leads: [{ id: 'l2', stage: 'proposta_enviada', score: 91 }] },
    { id: 'c3', name: 'Construções Sul S.A.', category: 'Construção Civil', city: 'Faro', region: 'Algarve', phone: '964321098', email: 'geral@construcoessul.com', website: null, has_website: false, commercial_profile: 'Grande construtora regional sem presença digital.', identified_at: new Date(Date.now() - 7 * 86400000).toISOString(), lead_sources: { name: 'Indicação' }, leads: [] },
    { id: 'c4', name: 'Eletro Torres', category: 'Eletricidade', city: 'Coimbra', region: 'Centro', phone: '239876543', email: null, website: null, has_website: false, commercial_profile: null, identified_at: new Date(Date.now() - 2 * 86400000).toISOString(), lead_sources: { name: 'Manual' }, leads: [{ id: 'l4', stage: 'negociacao', score: 88 }] },
    { id: 'c5', name: 'Canalizações Ferreira', category: 'Canalização', city: 'Braga', region: 'Minho', phone: '253012345', email: 'ferreira@canaliz.pt', website: null, has_website: false, commercial_profile: 'Empresa local sem site nem avaliações Google.', identified_at: new Date(Date.now() - 14 * 86400000).toISOString(), lead_sources: { name: 'Google Maps' }, leads: [] },
    { id: 'c6', name: 'Acabamentos Premium', category: 'Remodelação', city: 'Setúbal', region: 'Setúbal', phone: '265432187', email: null, website: 'https://acabamentos.pt', has_website: true, commercial_profile: null, identified_at: new Date(Date.now() - 5 * 86400000).toISOString(), lead_sources: { name: 'Site Próprio' }, leads: [] },
]

export default function Prospeccao() {
    const toast = useToast()
    const demo = isDemoActive()
    const [companies, setCompanies] = useState<Company[]>(demo ? DEMO_COMPANIES : [])
    const [loading, setLoading] = useState(!demo)
    const [q, setQ] = useState('')
    const [catFilter, setCatFilter] = useState('')
    const [noWebFilter, setNoWebFilter] = useState(false)
    const [noLeadFilter, setNoLeadFilter] = useState(false)
    const [selected, setSelected] = useState<Company | null>(null)
    const [addLeadFor, setAddLeadFor] = useState<Company | null>(null)
    const [addOpen, setAddOpen] = useState(false)

    const load = useCallback(async () => {
        if (demo) return
        const { data, error } = await supabase
            .from('companies')
            .select('id, name, category, city, region, phone, email, website, has_website, commercial_profile, identified_at, lead_sources(name), leads(id, stage, score)')
            .order('identified_at', { ascending: false })
            .limit(200)
        if (error) toast.push('error', error.message)
        else setCompanies((data ?? []) as unknown as Company[])
        setLoading(false)
    }, [demo])
    useEffect(() => { load() }, [load])

    const filtered = useMemo(() => {
        const term = q.trim().toLowerCase()
        return companies.filter(c =>
            (!catFilter || c.category === catFilter) &&
            (!noWebFilter || !c.has_website) &&
            (!noLeadFilter || c.leads.length === 0) &&
            (!term || [c.name, c.city, c.phone, c.email].some(v => v?.toLowerCase().includes(term)))
        )
    }, [companies, q, catFilter, noWebFilter, noLeadFilter])

    const stats = useMemo(() => ({
        total: companies.length,
        withLead: companies.filter(c => c.leads.length > 0).length,
        noWebsite: companies.filter(c => !c.has_website).length,
        noLead: companies.filter(c => c.leads.length === 0).length,
    }), [companies])

    return (
        <>
            <PageHeader
                title="Prospecção"
                description="Base de empresas identificadas. Converta-as em leads e oportunidades."
                actions={<Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Adicionar empresa</Button>}
            />

            {/* KPIs */}
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                    { label: 'Total empresas', value: stats.total, icon: Building2 },
                    { label: 'Com lead aberto', value: stats.withLead, icon: TrendingUp },
                    { label: 'Sem website', value: stats.noWebsite, icon: Globe, hint: 'Oportunidade' },
                    { label: 'Sem lead', value: stats.noLead, icon: Radar, hint: 'Por prospectar' },
                ].map(({ label, value, icon: Icon, hint }) => (
                    <Card key={label} className="p-4">
                        <div className="flex items-center justify-between text-white/40">
                            <span className="text-[11px] font-medium uppercase tracking-wider">{label}</span>
                            <Icon className="h-4 w-4" strokeWidth={1.8} />
                        </div>
                        <div className="mt-2 text-2xl font-semibold tabular-nums">{loading ? '–' : value}</div>
                        {hint && <div className="mt-0.5 text-[11px] text-brand-soft">{hint}</div>}
                    </Card>
                ))}
            </div>

            {/* Pesquisa no Google Maps por região */}
            <GoogleMapsSearch onDone={load} />

            {/* Filtros */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Pesquisar empresas…" className="input !pl-8 w-full" />
                </div>
                <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="input !w-44">
                    <option value="">Todas as categorias</option>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
                <button onClick={() => setNoWebFilter(v => !v)} className={cn('flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition', noWebFilter ? 'border-brand/50 bg-brand/10 text-brand-soft' : 'border-white/10 text-white/50 hover:text-snow')}>
                    <Globe className="h-3.5 w-3.5" /> Sem website
                </button>
                <button onClick={() => setNoLeadFilter(v => !v)} className={cn('flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition', noLeadFilter ? 'border-brand/50 bg-brand/10 text-brand-soft' : 'border-white/10 text-white/50 hover:text-snow')}>
                    <Radar className="h-3.5 w-3.5" /> Sem lead
                </button>
                <span className="ml-auto text-xs text-white/35">{filtered.length} empresa(s)</span>
            </div>

            {/* Lista */}
            {loading ? (
                <div className="space-y-2">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>
            ) : filtered.length === 0 ? (
                <Card><EmptyState icon={<Building2 className="h-5 w-5" />} title="Nenhuma empresa encontrada" description="Adicione empresas manualmente ou utilize a integração com Google Places." action={<Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Adicionar empresa</Button>} /></Card>
            ) : (
                <div className="space-y-2">
                    {filtered.map(c => (
                        <button key={c.id} onClick={() => setSelected(c)} className="card flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:border-brand/40">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <p className="truncate text-sm font-medium">{c.name}</p>
                                    {!c.has_website && <Badge tone="warning">Sem website</Badge>}
                                </div>
                                <div className="mt-0.5 flex items-center gap-3 text-xs text-white/40">
                                    {c.category && <span className="flex items-center gap-1"><Tag className="h-3 w-3" />{c.category}</span>}
                                    {c.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{c.city}</span>}
                                    {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                                </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                {c.leads.length > 0 ? (
                                    <Badge tone={c.leads[0].score && c.leads[0].score >= 75 ? 'success' : 'brand'}>
                                        {c.leads[0].score != null ? `Score ${c.leads[0].score}` : 'Lead ativo'}
                                    </Badge>
                                ) : (
                                    <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); setAddLeadFor(c) }}>
                                        <Plus className="h-3 w-3" /> Lead
                                    </Button>
                                )}
                                <span className="text-[11px] text-white/25">{relativeTime(c.identified_at)}</span>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            <CompanyModal company={selected} onClose={() => setSelected(null)} onAddLead={c => { setSelected(null); setAddLeadFor(c) }} onChanged={load} />
            <AddCompanyModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={load} />
            <AddLeadModal company={addLeadFor} onClose={() => setAddLeadFor(null)} onCreated={() => { setAddLeadFor(null); load() }} />
        </>
    )
}

function CompanyModal({ company: c, onClose, onAddLead, onChanged }: { company: Company | null; onClose: () => void; onAddLead: (c: Company) => void; onChanged: () => void }) {
    const toast = useToast()
    const [analyzing, setAnalyzing] = useState(false)
    const [aiResult, setAiResult] = useState<{ score: number; opportunity: string; analysis: string; suggested_message: string; next_action: string } | null>(null)
    const [genMsg, setGenMsg] = useState(false)
    const [message, setMessage] = useState('')
    const [isEditing, setIsEditing] = useState(false)
    const [busy, setBusy] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [form, setForm] = useState({
        name: c?.name ?? '',
        category: c?.category ?? '',
        city: c?.city ?? '',
        region: c?.region ?? '',
        phone: c?.phone ?? '',
        email: c?.email ?? '',
        website: c?.website ?? '',
    })
    const aiReady = isAiReady()

    useEffect(() => {
        if (!c) return
        setForm({
            name: c.name,
            category: c.category ?? '',
            city: c.city ?? '',
            region: c.region ?? '',
            phone: c.phone ?? '',
            email: c.email ?? '',
            website: c.website ?? '',
        })
        setIsEditing(false)
        setConfirmDelete(false)
    }, [c])

    const setField = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setForm((s) => ({ ...s, [key]: e.target.value }))
    }

    const save = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!c) return
        setBusy(true)
        try {
            const payload = {
                name: form.name.trim(),
                category: form.category || null,
                city: form.city.trim() || null,
                region: form.region.trim() || null,
                phone: form.phone.trim() || null,
                email: form.email.trim() || null,
                website: normalizeWebsite(form.website),
            }
            const { error } = await supabase.from('companies').update(payload).eq('id', c.id)
            if (error) { toast.push('error', error.message); return }
            await logActivity('company.updated', 'companies', c.id, { name: payload.name })
            toast.push('success', 'Empresa atualizada.')
            setIsEditing(false)
            onChanged()
            onClose()
        } finally { setBusy(false) }
    }

    const remove = async () => {
        if (!c) return
        setBusy(true)
        try {
            const { error } = await supabase.from('companies').delete().eq('id', c.id)
            if (error) { toast.push('error', error.message); return }
            await logActivity('company.deleted', 'companies', c.id, { name: c.name })
            toast.push('success', 'Empresa removida.')
            setConfirmDelete(false)
            onChanged()
            onClose()
        } finally { setBusy(false) }
    }

    const runAnalysis = async () => {
        if (!c) return
        setAnalyzing(true); setAiResult(null)
        try {
            const result = await analyzeLeadWithAI({
                name: c.name, category: c.category, city: c.city,
                phone: c.phone, email: c.email, website: c.website,
                commercial_profile: c.commercial_profile,
            })
            setAiResult(result)
        } catch (e) {
            toast.push('error', e instanceof Error ? e.message : 'Erro na análise de IA.')
        } finally { setAnalyzing(false) }
    }

    const runGenMsg = async (channel: 'whatsapp' | 'email') => {
        if (!c) return
        setGenMsg(true); setMessage('')
        try {
            const msg = await generateProspectingMessage({ name: c.name, category: c.category, city: c.city, has_website: c.has_website }, channel)
            setMessage(msg)
        } catch (e) {
            toast.push('error', e instanceof Error ? e.message : 'Erro ao gerar mensagem.')
        } finally { setGenMsg(false) }
    }

    if (!c) return null
    const oppTone: Record<string, 'success' | 'brand' | 'warning' | 'neutral'> = { excelente: 'success', elevada: 'brand', moderada: 'warning', baixa: 'neutral' }
    return (
        <Modal open onClose={onClose} title={c.name} wide footer={isEditing ? (<><Button variant="ghost" onClick={() => setIsEditing(false)}>Cancelar</Button><Button type="submit" form="edit-company" loading={busy}>Guardar</Button></>) : confirmDelete ? (<><span className="mr-auto self-center text-xs text-red-300">Eliminar esta empresa?</span><Button variant="ghost" onClick={() => setConfirmDelete(false)}>Não</Button><Button variant="danger" loading={busy} onClick={remove}>Sim, eliminar</Button></>) : (<><Button variant="ghost" onClick={onClose}>Fechar</Button><Button variant="outline" onClick={() => setIsEditing(true)}><Pencil className="h-3.5 w-3.5" />Editar</Button><Button variant="danger" onClick={() => setConfirmDelete(true)}><Trash2 className="h-3.5 w-3.5" />Remover</Button></>)}>
            {isEditing ? (
                <form id="edit-company" onSubmit={save} className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2"><Field label="Nome da empresa *"><input required className="input" value={form.name} onChange={setField('name')} /></Field></div>
                    <Field label="Categoria"><select className="input" value={form.category} onChange={setField('category')}><option value="">—</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></Field>
                    <Field label="Cidade"><input className="input" value={form.city} onChange={setField('city')} /></Field>
                    <Field label="Região"><input className="input" value={form.region} onChange={setField('region')} /></Field>
                    <Field label="Telefone"><input className="input" type="tel" value={form.phone} onChange={setField('phone')} /></Field>
                    <Field label="Email"><input className="input" type="email" value={form.email} onChange={setField('email')} /></Field>
                    <div className="sm:col-span-2"><Field label="Website"><input className="input" value={form.website} onChange={setField('website')} placeholder="exemplo.pt" /></Field></div>
                </form>
            ) : (
                <div className="space-y-4">
                    <div className="flex flex-wrap gap-2 text-xs">
                        {c.category && <Badge>{c.category}</Badge>}
                        {c.has_website ? <Badge tone="success">Tem website</Badge> : <Badge tone="warning">Sem website</Badge>}
                        {c.lead_sources && <Badge>{c.lead_sources.name}</Badge>}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 text-sm">
                        {c.city && <div><p className="label">Cidade</p><p className="text-white/70">{[c.city, c.region].filter(Boolean).join(', ')}</p></div>}
                        {c.phone && <div><p className="label">Telefone</p><p className="text-white/70">{c.phone}</p></div>}
                        {c.email && <div><p className="label">Email</p><p className="text-white/70">{c.email}</p></div>}
                        {c.website && <div><p className="label">Website</p><a href={c.website} target="_blank" rel="noreferrer" className="text-brand-soft hover:underline">{c.website}</a></div>}
                    </div>
                    {c.commercial_profile && <div><p className="label">Perfil comercial</p><p className="text-sm text-white/70">{c.commercial_profile}</p></div>}

                    {/* AI Analysis section */}
                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                        <div className="flex items-center justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2">
                                <Bot className="h-4 w-4 text-brand-soft" />
                                <span className="text-sm font-medium">Análise de IA</span>
                            </div>
                            <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={runAnalysis} disabled={!aiReady || analyzing}>
                                    {analyzing ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />A analisar…</> : <><Sparkles className="h-3.5 w-3.5" />Analisar lead</>}
                                </Button>
                            </div>
                        </div>
                        {!aiReady && <p className="text-[11px] text-amber-400/80">Configure uma chave Universal em Administração → Integrações para usar IA.</p>}
                        {aiResult && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="text-center">
                                        <div className="text-2xl font-bold tabular-nums text-brand-soft">{aiResult.score}</div>
                                        <div className="text-[10px] text-white/35">Score</div>
                                    </div>
                                    <Badge tone={oppTone[aiResult.opportunity] ?? 'neutral'}>{aiResult.opportunity}</Badge>
                                </div>
                                <p className="text-xs leading-relaxed text-white/65">{aiResult.analysis}</p>
                                {aiResult.next_action && (
                                    <div className="rounded-lg border border-brand/20 bg-brand/[0.06] px-3 py-2 text-xs text-brand-soft">
                                        <span className="font-medium">Próxima ação:</span> {aiResult.next_action}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Generate message */}
                        {aiReady && (
                            <div className="mt-3 border-t border-white/[0.06] pt-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-[11px] text-white/40">Gerar mensagem de contacto:</span>
                                    <Button size="sm" variant="ghost" onClick={() => runGenMsg('whatsapp')} disabled={genMsg}>
                                        {genMsg ? <Loader2 className="h-3 w-3 animate-spin" /> : 'WhatsApp'}
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => runGenMsg('email')} disabled={genMsg}>Email</Button>
                                </div>
                                {message && (
                                    <div className="relative">
                                        <textarea readOnly value={message} rows={5} className="input w-full resize-none text-xs leading-relaxed" />
                                        <button onClick={() => { navigator.clipboard.writeText(message); toast.push('success', 'Mensagem copiada!') }} className="absolute right-2 top-2 rounded-md p-1 text-white/30 hover:text-white/70 transition">
                                            <Copy className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {c.leads.length === 0 ? (
                        <div className="rounded-xl border border-brand/20 bg-brand/[0.05] p-4 flex items-center justify-between">
                            <div><p className="text-sm font-medium">Sem lead ativo</p><p className="text-xs text-white/40">Esta empresa ainda não foi prospetada.</p></div>
                            <Button onClick={() => onAddLead(c)}><Sparkles className="h-4 w-4" /> Criar lead</Button>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-white/[0.08] p-3">
                            <p className="text-xs text-white/40 mb-1">Lead ativo</p>
                            <div className="flex items-center gap-2">
                                <Badge tone="brand">{c.leads[0].stage.replace(/_/g, ' ')}</Badge>
                                {c.leads[0].score != null && <Badge>{c.leads[0].score}</Badge>}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </Modal>
    )
}

function AddCompanyModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
    const toast = useToast()
    const empty = { name: '', category: '', city: '', region: '', phone: '', email: '', website: '' }
    const [f, setF] = useState(empty)
    const [busy, setBusy] = useState(false)
    const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF(s => ({ ...s, [k]: e.target.value }))

    const submit = async (e: React.FormEvent) => {
        e.preventDefault(); setBusy(true)
        try {
            const { data: src } = await supabase.from('lead_sources').select('id').eq('code', 'manual').maybeSingle()
            const { error } = await supabase.from('companies').insert({
                name: f.name.trim(), category: f.category || null, city: f.city.trim() || null,
                region: f.region.trim() || null, phone: f.phone.trim() || null, email: f.email.trim() || null,
                website: normalizeWebsite(f.website), source_id: src?.id ?? null,
            })
            if (error) { toast.push('error', error.code === '23505' ? 'Empresa já existe.' : error.message); return }
            toast.push('success', 'Empresa adicionada.')
            setF(empty); onClose(); onCreated()
        } finally { setBusy(false) }
    }

    return (
        <Modal open={open} onClose={onClose} title="Adicionar empresa" wide footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" form="add-company" loading={busy}>Guardar</Button></>}>
            <form id="add-company" onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2"><Field label="Nome da empresa *"><input required className="input" value={f.name} onChange={set('name')} /></Field></div>
                <Field label="Categoria"><select className="input" value={f.category} onChange={set('category')}><option value="">—</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></Field>
                <Field label="Cidade"><input className="input" value={f.city} onChange={set('city')} /></Field>
                <Field label="Região"><input className="input" value={f.region} onChange={set('region')} /></Field>
                <Field label="Telefone"><input className="input" type="tel" value={f.phone} onChange={set('phone')} /></Field>
                <Field label="Email"><input className="input" type="email" value={f.email} onChange={set('email')} /></Field>
                <Field label="Website"><input className="input" value={f.website} onChange={set('website')} placeholder="exemplo.pt" /></Field>
            </form>
        </Modal>
    )
}

function AddLeadModal({ company, onClose, onCreated }: { company: Company | null; onClose: () => void; onCreated: () => void }) {
    const toast = useToast()
    const [value, setValue] = useState('')
    const [busy, setBusy] = useState(false)

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!company) return
        setBusy(true)
        try {
            const { data, error } = await supabase.from('leads').insert({ company_id: company.id, estimated_value: value ? Number(value) : null }).select('id').single()
            if (error) { toast.push('error', error.code === '23505' ? 'Já existe um lead para esta empresa.' : error.message); return }
            await logActivity('lead.created', 'leads', data.id, { company: company.name })
            toast.push('success', 'Lead criado com sucesso!')
            setValue(''); onCreated()
        } finally { setBusy(false) }
    }

    return (
        <Modal open={!!company} onClose={onClose} title={`Criar lead — ${company?.name}`} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" form="add-lead" loading={busy}>Criar lead</Button></>}>
            <form id="add-lead" onSubmit={submit}>
                <Field label="Valor estimado (€)" hint="Opcional — pode ajustar depois no CRM."><input className="input" type="number" min="0" step="0.01" value={value} onChange={e => setValue(e.target.value)} /></Field>
            </form>
        </Modal>
    )
}

/** Pesquisa empresas no Google Maps por região e destaca as que não têm website. */
function GoogleMapsSearch({ onDone }: { onDone: () => void }) {
    const toast = useToast()
    const [query, setQuery] = useState('')
    const [busy, setBusy] = useState(false)
    const [result, setResult] = useState<{ encontradas: number; sem_website: number; novas_empresas: number; ja_existiam: number; melhores: { name: string; city: string | null; score: number }[] } | null>(null)

    const run = async () => {
        const q = query.trim()
        if (!q || busy) return
        setBusy(true); setResult(null)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) throw new Error('Sessão expirada. Inicie sessão novamente.')
            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mkon-prospect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string },
                body: JSON.stringify({ query: q }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data?.error ?? `Erro ${res.status}`)
            setResult(data)
            toast.push('success', `${data.novas_empresas} novas empresas sem website encontradas.`)
            onDone()
        } catch (e) {
            toast.push('error', e instanceof Error ? e.message : 'Falha na pesquisa.')
        } finally { setBusy(false) }
    }

    return (
        <Card className="mb-4 p-4">
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[220px]">
                    <MapPin className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
                    <input
                        className="input pl-9"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') run() }}
                        placeholder="Ex.: canalizadores em Braga, pintores em Setúbal…"
                        disabled={busy}
                    />
                </div>
                <Button onClick={run} loading={busy} disabled={!query.trim()}>
                    <Radar className="h-4 w-4" /> Pesquisar no Google Maps
                </Button>
            </div>
            {result && (
                <div className="mt-3 text-xs text-white/60">
                    Encontradas {result.encontradas} · sem website {result.sem_website} · novas {result.novas_empresas} · já existiam {result.ja_existiam}
                    {result.melhores.length > 0 && (
                        <ul className="mt-2 space-y-1">
                            {result.melhores.map((m) => (
                                <li key={m.name}>★ <span className="text-white/85">{m.name}</span> {m.city ? `· ${m.city}` : ''} · pontuação {m.score}</li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </Card>
    )
}
