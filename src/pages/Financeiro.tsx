import { useCallback, useEffect, useState } from 'react'
import { Wallet, Plus, TrendingUp, TrendingDown, Euro, Receipt, Clock, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Badge, Button, Card, CardHeader, EmptyState, Field, Modal, PageHeader, Skeleton } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { cn, eur, relativeTime } from '@/lib/utils'
import { isDemoActive, DEMO } from '@/lib/demo'

type Expense = {
    id: string; category: string; description: string; amount: number; status: string
    incurred_on: string; due_on: string | null; paid_on: string | null; created_at: string
    suppliers: { name: string } | null
}
type Transaction = {
    id: string; type: string; amount: number; status: string; description: string | null
    due_on: string | null; paid_on: string | null; created_at: string
    sales: { description: string; customers: { companies: { name: string } | null } | null } | null
    expenses: { description: string } | null
}

const EXPENSE_CATEGORIES = ['ferramentas', 'apis', 'ia', 'dominios', 'hospedagem', 'fornecedores', 'publicidade', 'impostos', 'outros']

const DEMO_EXPENSES: Expense[] = [
    { id: 'e1', category: 'apis', description: 'OpenAI API — novembro', amount: 49, status: 'pago', incurred_on: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10), due_on: null, paid_on: new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 10), created_at: new Date(Date.now() - 5 * 86400000).toISOString(), suppliers: null },
    { id: 'e2', category: 'hospedagem', description: 'Vercel Pro — novembro', amount: 20, status: 'pago', incurred_on: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10), due_on: null, paid_on: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10), created_at: new Date(Date.now() - 3 * 86400000).toISOString(), suppliers: null },
    { id: 'e3', category: 'fornecedores', description: 'NFC Pack x20 — NFC Print Portugal', amount: 240, status: 'pendente', incurred_on: new Date(Date.now() - 86400000).toISOString().slice(0, 10), due_on: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10), paid_on: null, created_at: new Date(Date.now() - 86400000).toISOString(), suppliers: { name: 'NFC Print Portugal' } },
    { id: 'e4', category: 'publicidade', description: 'Google Ads — outubro', amount: 150, status: 'pago', incurred_on: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), due_on: null, paid_on: new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10), created_at: new Date(Date.now() - 30 * 86400000).toISOString(), suppliers: null },
]

const paymentStatusCfg: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
    pendente: { label: 'Pendente', tone: 'neutral' },
    pago: { label: 'Pago', tone: 'success' },
    atrasado: { label: 'Atrasado', tone: 'danger' },
    cancelado: { label: 'Cancelado', tone: 'neutral' },
}

export default function Financeiro() {
    const toast = useToast()
    const demo = isDemoActive()
    const [expenses, setExpenses] = useState<Expense[]>(demo ? DEMO_EXPENSES : [])
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [loading, setLoading] = useState(!demo)
    const [tab, setTab] = useState<'resumo' | 'despesas' | 'transacoes'>('resumo')
    const [createExpenseOpen, setCreateExpenseOpen] = useState(false)
    const [statusFilter, setStatusFilter] = useState('')
    const [catFilter, setCatFilter] = useState('')

    const load = useCallback(async () => {
        if (demo) return
        const [ex, tx] = await Promise.all([
            supabase.from('expenses').select('id, category, description, amount, status, incurred_on, due_on, paid_on, created_at, suppliers(name)').order('incurred_on', { ascending: false }),
            supabase.from('transactions').select('id, type, amount, status, description, due_on, paid_on, created_at, sales(description, customers(companies(name))), expenses(description)').order('created_at', { ascending: false }).limit(50),
        ])
        if (ex.error) toast.push('error', ex.error.message)
        else setExpenses((ex.data ?? []) as unknown as Expense[])
        setTransactions((tx.data ?? []) as unknown as Transaction[])
        setLoading(false)
    }, [demo])
    useEffect(() => { load() }, [load])

    const markPaid = async (expense: Expense) => {
        if (demo) { toast.push('warning', 'Modo demo.'); return }
        const { error } = await supabase.from('expenses').update({ status: 'pago', paid_on: new Date().toISOString().slice(0, 10) }).eq('id', expense.id)
        if (error) return toast.push('error', error.message)
        setExpenses(s => s.map(e => e.id === expense.id ? { ...e, status: 'pago', paid_on: new Date().toISOString().slice(0, 10) } : e))
        toast.push('success', 'Despesa marcada como paga.')
    }

    // Cálculos
    const thisMonth = new Date().toISOString().slice(0, 7)
    const demoSales = demo ? DEMO.sales : []
    const demoExpenses = demo ? DEMO.expenses : []
    const revenue = demoSales.filter(s => s.sold_at.startsWith(thisMonth)).reduce((a, s) => a + s.amount, 0)
    const expenseTotal = (demo ? demoExpenses : expenses).filter(e => (demo ? (e as typeof demoExpenses[0]).incurred_on : (e as Expense).incurred_on)?.startsWith(thisMonth)).reduce((a, e) => a + Number(e.amount), 0)
    const profit = revenue - expenseTotal
    const pending = expenses.filter(e => e.status === 'pendente')
    const pendingTotal = pending.reduce((a, e) => a + Number(e.amount), 0)
    const overdue = expenses.filter(e => e.status === 'pendente' && e.due_on && new Date(e.due_on) < new Date())

    const filteredExpenses = expenses.filter(e =>
        (!statusFilter || e.status === statusFilter) &&
        (!catFilter || e.category === catFilter)
    )

    return (
        <>
            <PageHeader title="Financeiro" description="Controlo de receitas, despesas e fluxo de caixa do negócio." actions={
                <Button onClick={() => setCreateExpenseOpen(true)}><Plus className="h-4 w-4" /> Nova despesa</Button>
            } />

            {/* Tabs */}
            <div className="mb-5 flex gap-1 rounded-lg border border-white/10 p-0.5 w-fit">
                {[{ key: 'resumo', label: 'Resumo' }, { key: 'despesas', label: 'Despesas' }, { key: 'transacoes', label: 'Transações' }].map(t => (
                    <button key={t.key} onClick={() => setTab(t.key as 'resumo' | 'despesas' | 'transacoes')} className={cn('rounded-md px-3 py-1.5 text-xs transition', tab === t.key ? 'bg-brand/15 text-brand-soft' : 'text-white/50 hover:text-snow')}>{t.label}</button>
                ))}
            </div>

            {/* RESUMO */}
            {tab === 'resumo' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {[
                            { label: 'Receita do mês', value: eur(revenue), icon: TrendingUp, positive: true },
                            { label: 'Despesas do mês', value: eur(expenseTotal), icon: TrendingDown, positive: false },
                            { label: 'Lucro estimado', value: eur(profit), icon: Euro, positive: profit >= 0 },
                            { label: 'Pendente a pagar', value: eur(pendingTotal), icon: Clock, positive: false },
                        ].map(({ label, value, icon: Icon, positive }) => (
                            <Card key={label} className="p-4">
                                <div className="flex items-center justify-between text-white/40"><span className="text-[11px] font-medium uppercase tracking-wider">{label}</span><Icon className="h-4 w-4" strokeWidth={1.8} /></div>
                                <p className={cn('mt-2 text-2xl font-semibold tabular-nums', loading ? '' : positive ? 'text-green-400' : 'text-red-300')}>{loading ? '–' : value}</p>
                            </Card>
                        ))}
                    </div>

                    {overdue.length > 0 && (
                        <div className="rounded-xl border border-red-500/25 bg-red-500/[0.06] p-4">
                            <div className="flex items-center gap-2 mb-2"><AlertTriangle className="h-4 w-4 text-red-400" /><p className="text-sm font-medium text-red-300">{overdue.length} despesa(s) com pagamento vencido</p></div>
                            {overdue.map(e => (
                                <div key={e.id} className="flex items-center justify-between gap-3 py-1.5 text-xs">
                                    <span className="text-white/60">{e.description}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="tabular-nums text-red-300">{eur(e.amount)}</span>
                                        <Badge tone="danger">Venceu {new Date(e.due_on!).toLocaleDateString('pt-PT')}</Badge>
                                        <Button size="sm" onClick={() => markPaid(e)}>Marcar pago</Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Despesas recentes */}
                    <Card>
                        <CardHeader title="Despesas recentes" />
                        {loading ? <Skeleton className="h-24 m-4" /> : expenses.slice(0, 6).length === 0 ? (
                            <EmptyState icon={<Receipt className="h-5 w-5" />} title="Sem despesas" description="Registe a primeira despesa." />
                        ) : (
                            <div className="divide-y divide-white/[0.05]">
                                {expenses.slice(0, 6).map(e => {
                                    const cfg = paymentStatusCfg[e.status] ?? paymentStatusCfg.pendente
                                    return (
                                        <div key={e.id} className="flex items-center justify-between gap-3 px-5 py-3">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm">{e.description}</p>
                                                <p className="text-xs text-white/35">{e.category} {e.suppliers ? `· ${e.suppliers.name}` : ''}</p>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-2">
                                                <span className="font-semibold tabular-nums">{eur(e.amount)}</span>
                                                <Badge tone={cfg.tone}>{cfg.label}</Badge>
                                                {e.status === 'pendente' && <Button size="sm" variant="outline" onClick={() => markPaid(e)}>Pagar</Button>}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </Card>
                </div>
            )}

            {/* DESPESAS */}
            {tab === 'despesas' && (
                <>
                    <div className="mb-3 flex flex-wrap gap-2">
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input !w-36">
                            <option value="">Todos os estados</option>
                            {Object.entries(paymentStatusCfg).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="input !w-40">
                            <option value="">Todas as categorias</option>
                            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <span className="ml-auto self-center text-xs text-white/35">{filteredExpenses.length} despesa(s)</span>
                    </div>

                    {loading ? <Skeleton className="h-48" /> : filteredExpenses.length === 0 ? (
                        <Card><EmptyState icon={<Receipt className="h-5 w-5" />} title="Sem despesas" action={<Button onClick={() => setCreateExpenseOpen(true)}><Plus className="h-4 w-4" /> Nova despesa</Button>} /></Card>
                    ) : (
                        <Card className="overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-[13px]">
                                    <thead className="border-b border-white/[0.06] text-[11px] uppercase tracking-wider text-white/35">
                                        <tr>{['Descrição', 'Categoria', 'Valor', 'Estado', 'Data', 'Prazo', 'Ações'].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.04]">
                                        {filteredExpenses.map(e => {
                                            const cfg = paymentStatusCfg[e.status] ?? paymentStatusCfg.pendente
                                            const isOverdue = e.status === 'pendente' && e.due_on && new Date(e.due_on) < new Date()
                                            return (
                                                <tr key={e.id} className="hover:bg-white/[0.02]">
                                                    <td className="px-4 py-3">{e.description}</td>
                                                    <td className="px-4 py-3"><Badge>{e.category}</Badge></td>
                                                    <td className="px-4 py-3 font-semibold tabular-nums">{eur(e.amount)}</td>
                                                    <td className="px-4 py-3"><Badge tone={cfg.tone}>{cfg.label}</Badge></td>
                                                    <td className="px-4 py-3 text-white/40 text-xs">{new Date(e.incurred_on).toLocaleDateString('pt-PT')}</td>
                                                    <td className="px-4 py-3 text-xs">{e.due_on ? <span className={cn(isOverdue ? 'text-red-400' : 'text-white/40')}>{new Date(e.due_on).toLocaleDateString('pt-PT')}</span> : <span className="text-white/20">—</span>}</td>
                                                    <td className="px-4 py-3">{e.status === 'pendente' && <Button size="sm" variant="outline" onClick={() => markPaid(e)}>Pagar</Button>}</td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )}
                </>
            )}

            {/* TRANSAÇÕES */}
            {tab === 'transacoes' && (
                <>
                    {loading ? <Skeleton className="h-48" /> : transactions.length === 0 ? (
                        <Card><EmptyState icon={<Wallet className="h-5 w-5" />} title="Sem transações" description="As transações são criadas automaticamente a partir de vendas e despesas." /></Card>
                    ) : (
                        <Card className="overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-[13px]">
                                    <thead className="border-b border-white/[0.06] text-[11px] uppercase tracking-wider text-white/35">
                                        <tr>{['Tipo', 'Descrição', 'Valor', 'Estado', 'Prazo', 'Data'].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.04]">
                                        {transactions.map(t => {
                                            const cfg = paymentStatusCfg[t.status] ?? paymentStatusCfg.pendente
                                            const isRevenue = t.type === 'receita'
                                            return (
                                                <tr key={t.id} className="hover:bg-white/[0.02]">
                                                    <td className="px-4 py-3"><Badge tone={isRevenue ? 'success' : 'danger'}>{isRevenue ? 'Receita' : 'Despesa'}</Badge></td>
                                                    <td className="px-4 py-3">{t.description ?? t.sales?.description ?? t.expenses?.description ?? '—'}</td>
                                                    <td className={cn('px-4 py-3 font-semibold tabular-nums', isRevenue ? 'text-green-400' : 'text-red-300')}>{isRevenue ? '+' : '-'}{eur(t.amount)}</td>
                                                    <td className="px-4 py-3"><Badge tone={cfg.tone}>{cfg.label}</Badge></td>
                                                    <td className="px-4 py-3 text-white/40 text-xs">{t.due_on ? new Date(t.due_on).toLocaleDateString('pt-PT') : '—'}</td>
                                                    <td className="px-4 py-3 text-white/35 text-xs">{relativeTime(t.created_at)}</td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )}
                </>
            )}

            <CreateExpenseModal open={createExpenseOpen} onClose={() => setCreateExpenseOpen(false)} onCreated={load} />
        </>
    )
}

function CreateExpenseModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
    const toast = useToast()
    const demo = isDemoActive()
    const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([])
    const [f, setF] = useState({ category: 'ferramentas', description: '', amount: '', supplier_id: '', incurred_on: new Date().toISOString().slice(0, 10), due_on: '' })
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        if (!open) return
        supabase.from('suppliers').select('id, name').order('name').then(({ data }) => setSuppliers(data ?? []))
    }, [open])

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (demo) { toast.push('warning', 'Modo demo.'); onClose(); return }
        if (!f.amount || Number(f.amount) <= 0) { toast.push('error', 'Valor inválido.'); return }
        setBusy(true)
        const { error } = await supabase.from('expenses').insert({ category: f.category, description: f.description.trim(), amount: Number(f.amount), supplier_id: f.supplier_id || null, incurred_on: f.incurred_on, due_on: f.due_on || null })
        setBusy(false)
        if (error) return toast.push('error', error.message)
        toast.push('success', 'Despesa registada.')
        setF({ category: 'ferramentas', description: '', amount: '', supplier_id: '', incurred_on: new Date().toISOString().slice(0, 10), due_on: '' })
        onClose(); onCreated()
    }

    return (
        <Modal open={open} onClose={onClose} title="Nova despesa" footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" form="new-expense" loading={busy}>Registar</Button></>}>
            <form id="new-expense" onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
                <Field label="Categoria *"><select required className="input" value={f.category} onChange={e => setF(s => ({ ...s, category: e.target.value }))}>{EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></Field>
                <Field label="Valor (€) *"><input required type="number" min="0.01" step="0.01" className="input" value={f.amount} onChange={e => setF(s => ({ ...s, amount: e.target.value }))} /></Field>
                <div className="sm:col-span-2"><Field label="Descrição *"><input required className="input" value={f.description} onChange={e => setF(s => ({ ...s, description: e.target.value }))} placeholder="Ex.: OpenAI API — novembro" /></Field></div>
                <Field label="Data da despesa"><input type="date" className="input" value={f.incurred_on} onChange={e => setF(s => ({ ...s, incurred_on: e.target.value }))} /></Field>
                <Field label="Prazo de pagamento"><input type="date" className="input" value={f.due_on} onChange={e => setF(s => ({ ...s, due_on: e.target.value }))} /></Field>
                <div className="sm:col-span-2"><Field label="Fornecedor"><select className="input" value={f.supplier_id} onChange={e => setF(s => ({ ...s, supplier_id: e.target.value }))}><option value="">—</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field></div>
            </form>
        </Modal>
    )
}
