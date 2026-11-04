import { useCallback, useEffect, useState } from 'react'
import { FileText, Plus, Send, CheckCircle, XCircle, Eye, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/log'
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader, Skeleton } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { cn, eur, relativeTime } from '@/lib/utils'
import { isDemoActive } from '@/lib/demo'

type Proposal = {
    id: string; number: string; title: string; status: string; total: number
    valid_until: string | null; sent_at: string | null; created_at: string
    companies: { name: string; city: string | null } | null
    leads: { stage: string } | null
}
type ProposalItem = { id: string; description: string; quantity: number; unit_price: number; line_total: number; position: number }
type Product = { id: string; name: string; category: string; unit_price: number }

const DEMO_PROPOSALS: Proposal[] = [
    { id: 'p1', number: 'PROP-2024-001', title: 'Website Profissional', status: 'enviada', total: 1200, valid_until: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10), sent_at: new Date(Date.now() - 3 * 86400000).toISOString(), created_at: new Date(Date.now() - 5 * 86400000).toISOString(), companies: { name: 'Pinturas Alves & Filhos', city: 'Lisboa' }, leads: { stage: 'proposta_enviada' } },
    { id: 'p2', number: 'PROP-2024-002', title: 'Website Premium + NFC Pack x10', status: 'aprovada', total: 2170, valid_until: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10), sent_at: new Date(Date.now() - 20 * 86400000).toISOString(), created_at: new Date(Date.now() - 22 * 86400000).toISOString(), companies: { name: 'Remodelações Norte Lda.', city: 'Porto' }, leads: { stage: 'venda_fechada' } },
    { id: 'p3', number: 'PROP-2024-003', title: 'Pack Starter Completo', status: 'rascunho', total: 1450, valid_until: null, sent_at: null, created_at: new Date(Date.now() - 86400000).toISOString(), companies: { name: 'Construções Sul S.A.', city: 'Faro' }, leads: null },
    { id: 'p4', number: 'PROP-2024-004', title: 'Manutenção + SEO Mensal', status: 'recusada', total: 199, valid_until: new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10), sent_at: new Date(Date.now() - 30 * 86400000).toISOString(), created_at: new Date(Date.now() - 32 * 86400000).toISOString(), companies: { name: 'Eletro Torres', city: 'Coimbra' }, leads: { stage: 'perdido' } },
]

const statusCfg: Record<string, { label: string; tone: 'success' | 'warning' | 'brand' | 'neutral' | 'danger' }> = {
    rascunho: { label: 'Rascunho', tone: 'neutral' },
    enviada: { label: 'Enviada', tone: 'brand' },
    aprovada: { label: 'Aprovada', tone: 'success' },
    recusada: { label: 'Recusada', tone: 'danger' },
    expirada: { label: 'Expirada', tone: 'neutral' },
}

let propCounter = 5

export default function Propostas() {
    const toast = useToast()
    const demo = isDemoActive()
    const [proposals, setProposals] = useState<Proposal[]>(demo ? DEMO_PROPOSALS : [])
    const [loading, setLoading] = useState(!demo)
    const [statusFilter, setStatusFilter] = useState('')
    const [createOpen, setCreateOpen] = useState(false)
    const [selected, setSelected] = useState<Proposal | null>(null)

    const load = useCallback(async () => {
        if (demo) return
        const { data, error } = await supabase
            .from('proposals')
            .select('id, number, title, status, total, valid_until, sent_at, created_at, companies(name, city), leads(stage)')
            .order('created_at', { ascending: false })
        if (error) toast.push('error', error.message)
        else setProposals((data ?? []) as unknown as Proposal[])
        setLoading(false)
    }, [demo])
    useEffect(() => { load() }, [load])

    const changeStatus = async (p: Proposal, status: string) => {
        if (demo) { toast.push('warning', 'Modo demo.'); return }
        const patch: Record<string, unknown> = { status }
        if (status === 'enviada') patch.sent_at = new Date().toISOString()
        if (status === 'aprovada' || status === 'recusada') patch.decided_at = new Date().toISOString()
        const { error } = await supabase.from('proposals').update(patch).eq('id', p.id)
        if (error) return toast.push('error', error.message)
        await logActivity('proposal.status_changed', 'proposals', p.id, { from: p.status, to: status })
        setProposals(s => s.map(x => x.id === p.id ? { ...x, status } : x))
        toast.push('success', `Proposta marcada como "${statusCfg[status]?.label}".`)
    }

    const filtered = proposals.filter(p => !statusFilter || p.status === statusFilter)
    const totals: Record<string, number> = { all: proposals.length, ...Object.fromEntries(Object.keys(statusCfg).map(s => [s, proposals.filter(p => p.status === s).length])) }
    const revenue = proposals.filter(p => p.status === 'aprovada').reduce((a, p) => a + Number(p.total), 0)

    return (
        <>
            <PageHeader title="Propostas" description="Gestão de orçamentos e propostas comerciais enviadas a clientes." actions={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Nova proposta</Button>} />

            {/* KPIs */}
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                    { label: 'Total', value: totals.all },
                    { label: 'Enviadas', value: totals.enviada || 0 },
                    { label: 'Aprovadas', value: totals.aprovada || 0 },
                    { label: 'Valor aprovado', value: eur(revenue) },
                ].map(({ label, value }) => (
                    <Card key={label} className="p-4">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">{label}</p>
                        <p className="mt-2 text-2xl font-semibold tabular-nums">{loading ? '–' : value}</p>
                    </Card>
                ))}
            </div>

            {/* Filtros */}
            <div className="mb-4 flex flex-wrap gap-2">
                <button onClick={() => setStatusFilter('')} className={cn('rounded-lg border px-3 py-1.5 text-xs transition', !statusFilter ? 'border-brand/50 bg-brand/10 text-brand-soft' : 'border-white/10 text-white/50 hover:text-snow')}>Todas ({totals.all})</button>
                {Object.entries(statusCfg).map(([key, cfg]) => (totals[key] || 0) > 0 && (
                    <button key={key} onClick={() => setStatusFilter(key)} className={cn('rounded-lg border px-3 py-1.5 text-xs transition', statusFilter === key ? 'border-brand/50 bg-brand/10 text-brand-soft' : 'border-white/10 text-white/50 hover:text-snow')}>
                        {cfg.label} ({totals[key] || 0})
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="space-y-2">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>
            ) : filtered.length === 0 ? (
                <Card><EmptyState icon={<FileText className="h-5 w-5" />} title="Nenhuma proposta" description="Crie a primeira proposta para um cliente." action={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Nova proposta</Button>} /></Card>
            ) : (
                <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-[13px]">
                            <thead className="border-b border-white/[0.06] text-[11px] uppercase tracking-wider text-white/35">
                                <tr>{['Nº', 'Título', 'Cliente', 'Total', 'Estado', 'Data', 'Ações'].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.04]">
                                {filtered.map(p => {
                                    const cfg = statusCfg[p.status] ?? statusCfg.rascunho
                                    const expired = p.valid_until && new Date(p.valid_until) < new Date() && p.status === 'enviada'
                                    return (
                                        <tr key={p.id} className="hover:bg-white/[0.02] transition">
                                            <td className="px-4 py-3 font-mono text-xs text-white/50">{p.number}</td>
                                            <td className="px-4 py-3 font-medium">{p.title}</td>
                                            <td className="px-4 py-3 text-white/55">{p.companies?.name ?? '—'}</td>
                                            <td className="px-4 py-3 font-semibold tabular-nums">{eur(p.total)}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col gap-1">
                                                    <Badge tone={cfg.tone}>{cfg.label}</Badge>
                                                    {expired && <span className="text-[10px] text-orange-400">Validade expirada</span>}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-white/35 text-xs">{relativeTime(p.created_at)}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1">
                                                    <Button size="sm" variant="ghost" onClick={() => setSelected(p)}><Eye className="h-3.5 w-3.5" /></Button>
                                                    {p.status === 'rascunho' && <Button size="sm" variant="ghost" onClick={() => changeStatus(p, 'enviada')}><Send className="h-3.5 w-3.5" /></Button>}
                                                    {p.status === 'enviada' && <>
                                                        <Button size="sm" variant="ghost" onClick={() => changeStatus(p, 'aprovada')}><CheckCircle className="h-3.5 w-3.5 text-green-400" /></Button>
                                                        <Button size="sm" variant="ghost" onClick={() => changeStatus(p, 'recusada')}><XCircle className="h-3.5 w-3.5 text-red-400" /></Button>
                                                    </>}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            <CreateProposalModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} />
            <ProposalDetailModal proposal={selected} onClose={() => setSelected(null)} onStatusChange={changeStatus} />
        </>
    )
}

function CreateProposalModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
    const toast = useToast()
    const demo = isDemoActive()
    const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
    const [products, setProducts] = useState<Product[]>([])
    const [f, setF] = useState({ company_id: '', title: '', valid_until: '', payment_terms: 'Pagamento a 30 dias após entrega', delivery_days: '' })
    const [items, setItems] = useState<{ description: string; quantity: string; unit_price: string; product_id: string }[]>([{ description: '', quantity: '1', unit_price: '', product_id: '' }])
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        if (!open) return
        Promise.all([
            supabase.from('companies').select('id, name').order('name').limit(100),
            supabase.from('products').select('id, name, category, unit_price').eq('is_active', true).order('name'),
        ]).then(([c, p]) => { setCompanies(c.data ?? []); setProducts((p.data ?? []) as Product[]) })
    }, [open])

    const addItem = () => setItems(s => [...s, { description: '', quantity: '1', unit_price: '', product_id: '' }])
    const removeItem = (i: number) => setItems(s => s.filter((_, j) => j !== i))
    const setItem = (i: number, k: string, v: string) => setItems(s => s.map((x, j) => j === i ? { ...x, [k]: v } : x))
    const pickProduct = (i: number, productId: string) => {
        const p = products.find(x => x.id === productId)
        if (p) setItems(s => s.map((x, j) => j === i ? { ...x, product_id: productId, description: p.name, unit_price: String(p.unit_price) } : x))
        else setItem(i, 'product_id', productId)
    }
    const total = items.reduce((a, x) => a + (Number(x.quantity) || 0) * (Number(x.unit_price) || 0), 0)

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (demo) { toast.push('warning', 'Modo demo.'); onClose(); return }
        if (!f.company_id || !f.title.trim()) { toast.push('error', 'Preencha empresa e título.'); return }
        const validItems = items.filter(x => x.description.trim() && Number(x.quantity) > 0 && Number(x.unit_price) >= 0)
        if (validItems.length === 0) { toast.push('error', 'Adicione pelo menos um item.'); return }
        setBusy(true)
        try {
            const number = `PROP-${new Date().getFullYear()}-${String(propCounter++).padStart(3, '0')}`
            const { data: prop, error: pe } = await supabase.from('proposals').insert({ number, company_id: f.company_id, title: f.title.trim(), valid_until: f.valid_until || null, payment_terms: f.payment_terms.trim() || null, delivery_days: f.delivery_days ? Number(f.delivery_days) : null }).select('id').single()
            if (pe) { toast.push('error', pe.message); return }
            await supabase.from('proposal_items').insert(validItems.map((x, i) => ({ proposal_id: prop.id, product_id: x.product_id || null, description: x.description.trim(), quantity: Number(x.quantity), unit_price: Number(x.unit_price), position: i })))
            await logActivity('proposal.created', 'proposals', prop.id)
            toast.push('success', `Proposta ${number} criada.`)
            setF({ company_id: '', title: '', valid_until: '', payment_terms: 'Pagamento a 30 dias após entrega', delivery_days: '' })
            setItems([{ description: '', quantity: '1', unit_price: '', product_id: '' }])
            onClose(); onCreated()
        } finally { setBusy(false) }
    }

    return (
        <Modal open={open} onClose={onClose} title="Nova proposta" wide footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" form="new-proposal" loading={busy}>Criar proposta</Button></>}>
            <form id="new-proposal" onSubmit={submit} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Cliente *"><select required className="input" value={f.company_id} onChange={e => setF(s => ({ ...s, company_id: e.target.value }))}><option value="">— Selecionar —</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
                    <Field label="Título *"><input required className="input" value={f.title} onChange={e => setF(s => ({ ...s, title: e.target.value }))} placeholder="Ex.: Website Profissional" /></Field>
                    <Field label="Válida até"><input type="date" className="input" value={f.valid_until} onChange={e => setF(s => ({ ...s, valid_until: e.target.value }))} /></Field>
                    <Field label="Prazo de entrega (dias)"><input type="number" min="1" className="input" value={f.delivery_days} onChange={e => setF(s => ({ ...s, delivery_days: e.target.value }))} /></Field>
                    <div className="sm:col-span-2"><Field label="Condições de pagamento"><input className="input" value={f.payment_terms} onChange={e => setF(s => ({ ...s, payment_terms: e.target.value }))} /></Field></div>
                </div>

                {/* Itens */}
                <div>
                    <div className="mb-2 flex items-center justify-between"><p className="label">Itens da proposta</p><Button size="sm" variant="ghost" type="button" onClick={addItem}><Plus className="h-3.5 w-3.5" /> Adicionar item</Button></div>
                    <div className="space-y-2">
                        {items.map((item, i) => (
                            <div key={i} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-end">
                                <Field label={i === 0 ? 'Descrição / Produto' : undefined}>
                                    <select className="input mb-1" value={item.product_id} onChange={e => pickProduct(i, e.target.value)}>
                                        <option value="">Livre</option>
                                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                    <input className="input" placeholder="Descrição" value={item.description} onChange={e => setItem(i, 'description', e.target.value)} />
                                </Field>
                                <Field label={i === 0 ? 'Qtd.' : undefined}><input className="input !w-16" type="number" min="0.01" step="0.01" value={item.quantity} onChange={e => setItem(i, 'quantity', e.target.value)} /></Field>
                                <Field label={i === 0 ? 'Preço unit. (€)' : undefined}><input className="input !w-28" type="number" min="0" step="0.01" value={item.unit_price} onChange={e => setItem(i, 'unit_price', e.target.value)} /></Field>
                                <Field label={i === 0 ? 'Total' : undefined}><div className="input !w-28 text-white/60 tabular-nums">{eur((Number(item.quantity) || 0) * (Number(item.unit_price) || 0))}</div></Field>
                                <button type="button" onClick={() => removeItem(i)} className="mb-1 text-white/30 hover:text-red-400 transition"><Trash2 className="h-4 w-4" /></button>
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 flex justify-end"><span className="text-sm font-semibold">Total: <span className="text-brand-soft">{eur(total)}</span></span></div>
                </div>
            </form>
        </Modal>
    )
}

function ProposalDetailModal({ proposal: p, onClose, onStatusChange }: { proposal: Proposal | null; onClose: () => void; onStatusChange: (p: Proposal, s: string) => void }) {
    const [items, setItems] = useState<ProposalItem[]>([])
    const demo = isDemoActive()

    useEffect(() => {
        if (!p || demo) return
        supabase.from('proposal_items').select('id, description, quantity, unit_price, line_total, position').eq('proposal_id', p.id).order('position').then(({ data }) => setItems((data ?? []) as ProposalItem[]))
    }, [p, demo])

    if (!p) return null
    const cfg = statusCfg[p.status] ?? statusCfg.rascunho

    return (
        <Modal open onClose={onClose} title={`${p.number} — ${p.title}`} wide footer={
            <div className="flex w-full items-center gap-2">
                {p.status === 'rascunho' && <Button onClick={() => { onStatusChange(p, 'enviada'); onClose() }}><Send className="h-4 w-4" /> Marcar como enviada</Button>}
                {p.status === 'enviada' && <>
                    <Button onClick={() => { onStatusChange(p, 'aprovada'); onClose() }}><CheckCircle className="h-4 w-4" /> Aprovada</Button>
                    <Button variant="outline" onClick={() => { onStatusChange(p, 'recusada'); onClose() }}><XCircle className="h-4 w-4" /> Recusada</Button>
                </>}
                <Button variant="ghost" className="ml-auto" onClick={onClose}>Fechar</Button>
            </div>
        }>
            <div className="space-y-4">
                <div className="flex flex-wrap gap-2"><Badge tone={cfg.tone}>{cfg.label}</Badge>{p.companies && <Badge>{p.companies.name}</Badge>}</div>
                <div className="grid gap-3 sm:grid-cols-3 text-sm">
                    {p.valid_until && <div><p className="label">Válida até</p><p className="text-white/70">{new Date(p.valid_until).toLocaleDateString('pt-PT')}</p></div>}
                    {p.sent_at && <div><p className="label">Enviada em</p><p className="text-white/70">{new Date(p.sent_at).toLocaleDateString('pt-PT')}</p></div>}
                    <div><p className="label">Total</p><p className="text-lg font-semibold text-brand-soft">{eur(p.total)}</p></div>
                </div>
                {items.length > 0 && (
                    <div>
                        <p className="label mb-2">Itens</p>
                        <div className="overflow-x-auto rounded-lg border border-white/[0.07]">
                            <table className="w-full text-[13px]">
                                <thead className="border-b border-white/[0.06] text-[11px] uppercase tracking-wider text-white/35">
                                    <tr>{['Descrição', 'Qtd.', 'Preço unit.', 'Total'].map(h => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.04]">
                                    {items.map(item => (
                                        <tr key={item.id}>
                                            <td className="px-3 py-2">{item.description}</td>
                                            <td className="px-3 py-2 text-white/60">{item.quantity}</td>
                                            <td className="px-3 py-2 text-white/60 tabular-nums">{eur(item.unit_price)}</td>
                                            <td className="px-3 py-2 font-medium tabular-nums">{eur(item.line_total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    )
}
