import { useCallback, useEffect, useState } from 'react'
import { Nfc, Plus, Package, Truck, Users, Zap, ExternalLink, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/log'
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader, Skeleton } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { cn, eur, relativeTime } from '@/lib/utils'
import { isDemoActive } from '@/lib/demo'

type NfcDevice = {
    id: string; slug: string; review_url: string; model: string | null; status: string
    nfc_uid: string | null; manufacturing_cost: number; created_at: string
    customers: { companies: { name: string; city: string | null } | null } | null
}
type Supplier = { id: string; name: string; contact_name: string | null; email: string | null; phone: string | null; website: string | null; notes: string | null; created_at: string }
type Order = {
    id: string; kind: string; quantity: number; unit_price: number; total: number; status: string
    ordered_at: string; delivered_at: string | null; tracking_code: string | null
    customers: { companies: { name: string } | null } | null
    suppliers: { name: string } | null
    products: { name: string } | null
}

const DEMO_DEVICES: NfcDevice[] = [
    { id: 'n1', slug: 'pinturas-alves-01', review_url: 'https://g.page/r/pinturas-alves/review', model: 'Cartão PVC Premium', status: 'ativa', nfc_uid: 'A1B2C3D4', manufacturing_cost: 12, created_at: new Date(Date.now() - 30 * 86400000).toISOString(), customers: { companies: { name: 'Pinturas Alves & Filhos', city: 'Lisboa' } } },
    { id: 'n2', slug: 'remodelacoes-norte-01', review_url: 'https://g.page/r/remodelacoes-norte/review', model: 'Plaquinha Acrílico', status: 'entregue', nfc_uid: 'E5F6A7B8', manufacturing_cost: 15, created_at: new Date(Date.now() - 60 * 86400000).toISOString(), customers: { companies: { name: 'Remodelações Norte Lda.', city: 'Porto' } } },
    { id: 'n3', slug: 'construcoes-sul-01', review_url: 'https://g.page/r/construcoes-sul/review', model: 'Cartão PVC Premium', status: 'em_stock', nfc_uid: null, manufacturing_cost: 12, created_at: new Date(Date.now() - 5 * 86400000).toISOString(), customers: null },
    { id: 'n4', slug: 'eletro-torres-01', review_url: 'https://g.page/r/eletro-torres/review', model: 'Plaquinha Metal', status: 'vendida', nfc_uid: 'C9D0E1F2', manufacturing_cost: 18, created_at: new Date(Date.now() - 15 * 86400000).toISOString(), customers: { companies: { name: 'Eletro Torres', city: 'Coimbra' } } },
]
const DEMO_SUPPLIERS: Supplier[] = [
    { id: 's1', name: 'NFC Print Portugal', contact_name: 'António Ferreira', email: 'antonio@nfcprint.pt', phone: '212345678', website: 'https://nfcprint.pt', notes: 'Fornecedor principal de plaquinhas NFC e cartões PVC', created_at: new Date(Date.now() - 90 * 86400000).toISOString() },
    { id: 's2', name: 'TechCard Lda.', contact_name: 'Sandra Costa', email: 'sandra@techcard.pt', phone: '225678901', website: null, notes: 'Backup para encomendas urgentes', created_at: new Date(Date.now() - 60 * 86400000).toISOString() },
]

const deviceStatusCfg: Record<string, { label: string; tone: 'success' | 'warning' | 'brand' | 'neutral' | 'danger' }> = {
    em_stock: { label: 'Em stock', tone: 'neutral' },
    vendida: { label: 'Vendida', tone: 'brand' },
    entregue: { label: 'Entregue', tone: 'warning' },
    ativa: { label: 'Ativa', tone: 'success' },
    inativa: { label: 'Inativa', tone: 'danger' },
}

export default function NfcPage() {
    const toast = useToast()
    const demo = isDemoActive()
    const [tab, setTab] = useState<'devices' | 'orders' | 'suppliers'>('devices')
    const [devices, setDevices] = useState<NfcDevice[]>(demo ? DEMO_DEVICES : [])
    const [suppliers, setSuppliers] = useState<Supplier[]>(demo ? DEMO_SUPPLIERS : [])
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(!demo)
    const [createDeviceOpen, setCreateDeviceOpen] = useState(false)
    const [createSupplierOpen, setCreateSupplierOpen] = useState(false)
    const [statusFilter, setStatusFilter] = useState('')

    const load = useCallback(async () => {
        if (demo) return
        const [dv, sv, od] = await Promise.all([
            supabase.from('nfc_devices').select('id, slug, review_url, model, status, nfc_uid, manufacturing_cost, created_at, customers(companies(name, city))').order('created_at', { ascending: false }),
            supabase.from('suppliers').select('*').order('name'),
            supabase.from('orders').select('id, kind, quantity, unit_price, total, status, ordered_at, delivered_at, tracking_code, customers(companies(name)), suppliers(name), products(name)').order('ordered_at', { ascending: false }).limit(50),
        ])
        if (dv.error) toast.push('error', dv.error.message)
        else setDevices((dv.data ?? []) as unknown as NfcDevice[])
        setSuppliers((sv.data ?? []) as Supplier[])
        setOrders((od.data ?? []) as unknown as Order[])
        setLoading(false)
    }, [demo])
    useEffect(() => { load() }, [load])

    const changeDeviceStatus = async (device: NfcDevice, status: string) => {
        if (demo) { toast.push('warning', 'Modo demo.'); return }
        const { error } = await supabase.from('nfc_devices').update({ status }).eq('id', device.id)
        if (error) return toast.push('error', error.message)
        setDevices(s => s.map(d => d.id === device.id ? { ...d, status } : d))
        toast.push('success', `Estado atualizado para "${deviceStatusCfg[status]?.label}".`)
    }

    const filtered = devices.filter(d => !statusFilter || d.status === statusFilter)
    const stats = { total: devices.length, ativas: devices.filter(d => d.status === 'ativa').length, stock: devices.filter(d => d.status === 'em_stock').length, vendidas: devices.filter(d => ['vendida', 'entregue', 'ativa'].includes(d.status)).length }

    return (
        <>
            <PageHeader title="NFC" description="Gestão de plaquinhas NFC, encomendas a fornecedores e clientes ativos." actions={
                <div className="flex gap-2">
                    {tab === 'devices' && <Button onClick={() => setCreateDeviceOpen(true)}><Plus className="h-4 w-4" /> Nova plaquinha</Button>}
                    {tab === 'suppliers' && <Button onClick={() => setCreateSupplierOpen(true)}><Plus className="h-4 w-4" /> Novo fornecedor</Button>}
                </div>
            } />

            {/* KPIs */}
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                    { label: 'Total dispositivos', value: stats.total, icon: Nfc },
                    { label: 'Ativas', value: stats.ativas, icon: Zap },
                    { label: 'Em stock', value: stats.stock, icon: Package },
                    { label: 'Vendidas/entregues', value: stats.vendidas, icon: CheckCircle },
                ].map(({ label, value, icon: Icon }) => (
                    <Card key={label} className="p-4">
                        <div className="flex items-center justify-between text-white/40"><span className="text-[11px] font-medium uppercase tracking-wider">{label}</span><Icon className="h-4 w-4" strokeWidth={1.8} /></div>
                        <p className="mt-2 text-2xl font-semibold">{loading ? '–' : value}</p>
                    </Card>
                ))}
            </div>

            {/* Tabs */}
            <div className="mb-4 flex gap-1 rounded-lg border border-white/10 p-0.5 w-fit">
                {[{ key: 'devices', label: 'Plaquinhas NFC', icon: Nfc }, { key: 'orders', label: 'Encomendas', icon: Truck }, { key: 'suppliers', label: 'Fornecedores', icon: Users }].map(t => (
                    <button key={t.key} onClick={() => setTab(t.key as 'devices' | 'orders' | 'suppliers')} className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition', tab === t.key ? 'bg-brand/15 text-brand-soft' : 'text-white/50 hover:text-snow')}>
                        <t.icon className="h-3.5 w-3.5" /> {t.label}
                    </button>
                ))}
            </div>

            {/* DEVICES TAB */}
            {tab === 'devices' && (
                <>
                    <div className="mb-3 flex flex-wrap gap-2">
                        <button onClick={() => setStatusFilter('')} className={cn('rounded-lg border px-3 py-1.5 text-xs transition', !statusFilter ? 'border-brand/50 bg-brand/10 text-brand-soft' : 'border-white/10 text-white/50 hover:text-snow')}>Todas ({devices.length})</button>
                        {Object.entries(deviceStatusCfg).map(([key, cfg]) => {
                            const count = devices.filter(d => d.status === key).length
                            return count > 0 && (
                                <button key={key} onClick={() => setStatusFilter(key)} className={cn('rounded-lg border px-3 py-1.5 text-xs transition', statusFilter === key ? 'border-brand/50 bg-brand/10 text-brand-soft' : 'border-white/10 text-white/50 hover:text-snow')}>
                                    {cfg.label} ({count})
                                </button>
                            )
                        })}
                    </div>

                    {loading ? <div className="space-y-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-16" />)}</div> : filtered.length === 0 ? (
                        <Card><EmptyState icon={<Nfc className="h-5 w-5" />} title="Nenhuma plaquinha" description="Registe a primeira plaquinha NFC." action={<Button onClick={() => setCreateDeviceOpen(true)}><Plus className="h-4 w-4" /> Nova plaquinha</Button>} /></Card>
                    ) : (
                        <div className="space-y-2">
                            {filtered.map(d => {
                                const cfg = deviceStatusCfg[d.status] ?? deviceStatusCfg.em_stock
                                return (
                                    <div key={d.id} className="card flex items-center gap-4 px-4 py-3">
                                        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border', d.status === 'ativa' ? 'border-green-500/30 bg-green-500/10' : 'border-white/10 bg-white/[0.04]')}>
                                            <Nfc className={cn('h-5 w-5', d.status === 'ativa' ? 'text-green-400' : 'text-white/40')} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-medium font-mono">{d.slug}</p>
                                                <Badge tone={cfg.tone}>{cfg.label}</Badge>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-white/40 mt-0.5">
                                                {d.customers?.companies?.name && <span>{d.customers.companies.name}</span>}
                                                {d.model && <span>{d.model}</span>}
                                                {d.nfc_uid && <span className="font-mono">UID: {d.nfc_uid}</span>}
                                                <span>Custo: {eur(d.manufacturing_cost)}</span>
                                            </div>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2">
                                            <a href={d.review_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11px] text-brand-soft hover:underline"><ExternalLink className="h-3 w-3" /> Review URL</a>
                                            {d.status === 'vendida' && <Button size="sm" variant="outline" onClick={() => changeDeviceStatus(d, 'entregue')}>Marcar entregue</Button>}
                                            {d.status === 'entregue' && <Button size="sm" variant="outline" onClick={() => changeDeviceStatus(d, 'ativa')}>Marcar ativa</Button>}
                                            <span className="text-[11px] text-white/25">{relativeTime(d.created_at)}</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </>
            )}

            {/* ORDERS TAB */}
            {tab === 'orders' && (
                <>
                    {loading ? <Skeleton className="h-48" /> : orders.length === 0 ? (
                        <Card><EmptyState icon={<Truck className="h-5 w-5" />} title="Sem encomendas" description="As encomendas a clientes e fornecedores aparecerão aqui." /></Card>
                    ) : (
                        <Card className="overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-[13px]">
                                    <thead className="border-b border-white/[0.06] text-[11px] uppercase tracking-wider text-white/35">
                                        <tr>{['Tipo', 'Entidade', 'Produto', 'Qtd.', 'Total', 'Estado', 'Data'].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.04]">
                                        {orders.map(o => (
                                            <tr key={o.id} className="hover:bg-white/[0.02]">
                                                <td className="px-4 py-3"><Badge tone={o.kind === 'cliente' ? 'brand' : 'neutral'}>{o.kind}</Badge></td>
                                                <td className="px-4 py-3">{o.kind === 'cliente' ? o.customers?.companies?.name : o.suppliers?.name}</td>
                                                <td className="px-4 py-3 text-white/55">{o.products?.name ?? '—'}</td>
                                                <td className="px-4 py-3 tabular-nums">{o.quantity}</td>
                                                <td className="px-4 py-3 tabular-nums font-medium">{eur(o.total)}</td>
                                                <td className="px-4 py-3"><Badge>{o.status}</Badge></td>
                                                <td className="px-4 py-3 text-white/35 text-xs">{new Date(o.ordered_at).toLocaleDateString('pt-PT')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )}
                </>
            )}

            {/* SUPPLIERS TAB */}
            {tab === 'suppliers' && (
                <>
                    {loading ? <div className="space-y-2">{[0, 1].map(i => <Skeleton key={i} className="h-20" />)}</div> : suppliers.length === 0 ? (
                        <Card><EmptyState icon={<Users className="h-5 w-5" />} title="Sem fornecedores" description="Adicione fornecedores de plaquinhas NFC." action={<Button onClick={() => setCreateSupplierOpen(true)}><Plus className="h-4 w-4" /> Novo fornecedor</Button>} /></Card>
                    ) : (
                        <div className="space-y-3">
                            {suppliers.map(s => (
                                <Card key={s.id} className="p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="font-medium">{s.name}</p>
                                            {s.contact_name && <p className="text-xs text-white/50 mt-0.5">Contacto: {s.contact_name}</p>}
                                            <div className="flex flex-wrap gap-3 mt-2 text-xs text-white/40">
                                                {s.email && <span>{s.email}</span>}
                                                {s.phone && <span>{s.phone}</span>}
                                                {s.website && <a href={s.website} target="_blank" rel="noreferrer" className="text-brand-soft hover:underline">{s.website}</a>}
                                            </div>
                                            {s.notes && <p className="mt-2 text-xs text-white/40">{s.notes}</p>}
                                        </div>
                                        <span className="text-[11px] text-white/25 shrink-0">{relativeTime(s.created_at)}</span>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </>
            )}

            <CreateDeviceModal open={createDeviceOpen} onClose={() => setCreateDeviceOpen(false)} onCreated={load} />
            <CreateSupplierModal open={createSupplierOpen} onClose={() => setCreateSupplierOpen(false)} onCreated={load} />
        </>
    )
}

function CreateDeviceModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
    const toast = useToast()
    const demo = isDemoActive()
    const [f, setF] = useState({ slug: '', review_url: 'https://g.page/r/', model: 'Cartão PVC Premium', manufacturing_cost: '12' })
    const [busy, setBusy] = useState(false)
    const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF(s => ({ ...s, [k]: e.target.value }))

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (demo) { toast.push('warning', 'Modo demo.'); onClose(); return }
        if (!f.slug.trim() || !f.review_url.startsWith('https://')) { toast.push('error', 'Slug e URL de avaliação são obrigatórios.'); return }
        setBusy(true)
        const { error } = await supabase.from('nfc_devices').insert({ slug: f.slug.trim(), review_url: f.review_url.trim(), model: f.model.trim() || null, manufacturing_cost: Number(f.manufacturing_cost) || 0 })
        setBusy(false)
        if (error) return toast.push('error', error.code === '23505' ? 'Este slug já existe.' : error.message)
        await logActivity('nfc.device_created', 'nfc_devices')
        toast.push('success', 'Plaquinha registada.')
        setF({ slug: '', review_url: 'https://g.page/r/', model: 'Cartão PVC Premium', manufacturing_cost: '12' })
        onClose(); onCreated()
    }
    return (
        <Modal open={open} onClose={onClose} title="Nova plaquinha NFC" footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" form="new-device" loading={busy}>Registar</Button></>}>
            <form id="new-device" onSubmit={submit} className="space-y-4">
                <Field label="Slug único *" hint="Será usado no URL de redirecionamento: /r/{slug}"><input required className="input" value={f.slug} onChange={set('slug')} placeholder="empresa-cliente-01" /></Field>
                <Field label="URL de avaliação Google *"><input required className="input" value={f.review_url} onChange={set('review_url')} /></Field>
                <Field label="Modelo"><select className="input" value={f.model} onChange={set('model')}>{['Cartão PVC Premium', 'Plaquinha Acrílico', 'Plaquinha Metal', 'Autocolante NFC'].map(m => <option key={m}>{m}</option>)}</select></Field>
                <Field label="Custo de produção (€)"><input className="input" type="number" min="0" step="0.01" value={f.manufacturing_cost} onChange={set('manufacturing_cost')} /></Field>
            </form>
        </Modal>
    )
}

function CreateSupplierModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
    const toast = useToast()
    const demo = isDemoActive()
    const [f, setF] = useState({ name: '', contact_name: '', email: '', phone: '', website: '', notes: '' })
    const [busy, setBusy] = useState(false)
    const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF(s => ({ ...s, [k]: e.target.value }))

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (demo) { toast.push('warning', 'Modo demo.'); onClose(); return }
        setBusy(true)
        const { error } = await supabase.from('suppliers').insert({ name: f.name.trim(), contact_name: f.contact_name.trim() || null, email: f.email.trim() || null, phone: f.phone.trim() || null, website: f.website.trim() || null, notes: f.notes.trim() || null })
        setBusy(false)
        if (error) return toast.push('error', error.code === '23505' ? 'Fornecedor já existe.' : error.message)
        toast.push('success', 'Fornecedor adicionado.')
        setF({ name: '', contact_name: '', email: '', phone: '', website: '', notes: '' }); onClose(); onCreated()
    }
    return (
        <Modal open={open} onClose={onClose} title="Novo fornecedor" footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" form="new-supplier" loading={busy}>Guardar</Button></>}>
            <form id="new-supplier" onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2"><Field label="Nome *"><input required className="input" value={f.name} onChange={set('name')} /></Field></div>
                <Field label="Contacto principal"><input className="input" value={f.contact_name} onChange={set('contact_name')} /></Field>
                <Field label="Email"><input type="email" className="input" value={f.email} onChange={set('email')} /></Field>
                <Field label="Telefone"><input type="tel" className="input" value={f.phone} onChange={set('phone')} /></Field>
                <Field label="Website"><input className="input" value={f.website} onChange={set('website')} /></Field>
                <div className="sm:col-span-2"><Field label="Notas"><textarea className="input" rows={2} value={f.notes} onChange={set('notes')} /></Field></div>
            </form>
        </Modal>
    )
}
