import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Download } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '@/lib/supabase'
import { Button, Card, CardHeader, PageHeader, Skeleton } from '@/components/ui'
import { cn, eur } from '@/lib/utils'
import { isDemoActive, DEMO } from '@/lib/demo'

const CHART = { grid: 'rgba(255,255,255,0.06)', axis: 'rgba(255,255,255,0.35)' }
const PALETTE = ['#E58A32', '#F3A34F', '#8B8F98', '#5C6068', '#C96F1A', '#3B3F46', '#6B7280', '#D97706']
const tip = { contentStyle: { background: '#1B1D21', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, fontSize: 12 }, cursor: { fill: 'rgba(255,255,255,0.04)' } }

const monthKey = (iso: string) => iso.slice(0, 7)
const monthLabel = (k: string) => new Date(k + '-01').toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' })
function lastMonths(n: number) {
    const out: string[] = []
    const d = new Date(); d.setDate(1)
    for (let i = n - 1; i >= 0; i--) { const x = new Date(d); x.setMonth(d.getMonth() - i); out.push(x.toISOString().slice(0, 7)) }
    return out
}

type SaleRow = { amount: number; cost: number; sold_at: string; products: { name: string; category: string } | null }
type ExpRow = { amount: number; incurred_on: string; category: string }
type LeadRow = { stage: string; created_at: string; companies: { category: string | null } | null }

const PERIOD_OPTIONS = [
    { label: 'Últimos 3 meses', months: 3 },
    { label: 'Últimos 6 meses', months: 6 },
    { label: 'Últimos 12 meses', months: 12 },
]

export default function Relatorios() {
    const demo = isDemoActive()
    const [period, setPeriod] = useState(6)
    const [loading, setLoading] = useState(!demo)
    const [sales, setSales] = useState<SaleRow[]>(demo ? DEMO.sales as unknown as SaleRow[] : [])
    const [expenses, setExpenses] = useState<ExpRow[]>(demo ? DEMO.expenses as unknown as ExpRow[] : [])
    const [leads, setLeads] = useState<LeadRow[]>(demo ? DEMO.leads as unknown as LeadRow[] : [])

    useEffect(() => {
        if (demo) return
        const since = new Date(); since.setMonth(since.getMonth() - period)
        const sinceStr = since.toISOString().slice(0, 10)
        Promise.all([
            supabase.from('sales').select('amount, cost, sold_at, products(name, category)').gte('sold_at', sinceStr),
            supabase.from('expenses').select('amount, incurred_on, category').gte('incurred_on', sinceStr),
            supabase.from('leads').select('stage, created_at, companies(category)').gte('created_at', since.toISOString()),
        ]).then(([s, e, l]) => {
            setSales((s.data ?? []) as unknown as SaleRow[])
            setExpenses((e.data ?? []) as unknown as ExpRow[])
            setLeads((l.data ?? []) as unknown as LeadRow[])
            setLoading(false)
        })
    }, [demo, period])

    const months = useMemo(() => lastMonths(period), [period])

    const charts = useMemo(() => {
        // Receita vs Despesa por mês
        const revenueByMonth = months.map(k => ({
            mes: monthLabel(k),
            receita: sales.filter(s => monthKey(s.sold_at) === k).reduce((a, s) => a + Number(s.amount), 0),
            despesa: expenses.filter(e => monthKey(e.incurred_on) === k).reduce((a, e) => a + Number(e.amount), 0),
        }))
        const profitByMonth = revenueByMonth.map(m => ({ ...m, lucro: m.receita - m.despesa }))

        // Por produto
        const byProduct = Object.entries(sales.reduce<Record<string, number>>((acc, s) => {
            const k = s.products?.name ?? 'Outros'; acc[k] = (acc[k] ?? 0) + Number(s.amount); return acc
        }, {})).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

        // Por categoria de empresa
        const byCategory = Object.entries(leads.reduce<Record<string, number>>((acc, l) => {
            const k = l.companies?.category ?? 'Sem categoria'; acc[k] = (acc[k] ?? 0) + 1; return acc
        }, {})).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

        // Despesas por categoria
        const byExpenseCategory = Object.entries(expenses.reduce<Record<string, number>>((acc, e) => {
            acc[e.category] = (acc[e.category] ?? 0) + Number(e.amount); return acc
        }, {})).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

        // Totais
        const totalRevenue = sales.reduce((a, s) => a + Number(s.amount), 0)
        const totalCost = sales.reduce((a, s) => a + Number(s.cost), 0)
        const totalExpenses = expenses.reduce((a, e) => a + Number(e.amount), 0)
        const totalProfit = totalRevenue - totalExpenses
        const margin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue * 100).toFixed(1) : '0'
        const conversionRate = leads.length > 0 ? (leads.filter(l => ['venda_fechada', 'producao', 'entregue'].includes(l.stage)).length / leads.length * 100).toFixed(1) : '0'

        return { revenueByMonth, profitByMonth, byProduct, byCategory, byExpenseCategory, totalRevenue, totalCost, totalExpenses, totalProfit, margin, conversionRate }
    }, [sales, expenses, leads, months])

    const KpiCard = ({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) => (
        <Card className="p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">{label}</p>
            <p className={cn('mt-2 text-2xl font-semibold tabular-nums', positive === true ? 'text-green-400' : positive === false ? 'text-red-300' : '')}>{loading ? '–' : value}</p>
            {sub && <p className="mt-0.5 text-[11px] text-white/30">{sub}</p>}
        </Card>
    )

    const ChartCard = ({ title, subtitle, empty, children }: { title: string; subtitle?: string; empty: boolean; children: React.ReactNode }) => (
        <Card>
            <CardHeader title={title} subtitle={subtitle} />
            <div className="h-56 px-3 py-4">
                {loading ? <Skeleton className="h-full w-full" /> : empty ? (
                    <div className="flex h-full flex-col items-center justify-center text-center">
                        <BarChart3 className="mb-2 h-5 w-5 text-white/20" />
                        <p className="text-xs text-white/35">Sem dados ainda.</p>
                    </div>
                ) : children}
            </div>
        </Card>
    )

    const exportCSV = () => {
        const rows = [
            ['Mês', 'Receita (€)', 'Despesa (€)', 'Lucro (€)'],
            ...charts.revenueByMonth.map(m => [m.mes, m.receita.toFixed(2), m.despesa.toFixed(2), (m.receita - m.despesa).toFixed(2)]),
        ]
        const csv = rows.map(r => r.join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = 'relatorio-mkon.csv'; a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <>
            <PageHeader
                title="Relatórios"
                description="Inteligência de negócio — análise de performance comercial e financeira."
                actions={<div className="flex gap-2">
                    <select value={period} onChange={e => setPeriod(Number(e.target.value))} className="input !w-44">
                        {PERIOD_OPTIONS.map(o => <option key={o.months} value={o.months}>{o.label}</option>)}
                    </select>
                    <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4" /> Exportar CSV</Button>
                </div>}
            />

            {/* KPIs principais */}
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                <KpiCard label="Receita total" value={eur(charts.totalRevenue)} positive={true} />
                <KpiCard label="Custo direto" value={eur(charts.totalCost)} positive={false} />
                <KpiCard label="Despesas" value={eur(charts.totalExpenses)} positive={false} />
                <KpiCard label="Lucro líquido" value={eur(charts.totalProfit)} positive={charts.totalProfit >= 0} />
                <KpiCard label="Margem bruta" value={`${charts.margin}%`} sub="(receita - custo)" />
                <KpiCard label="Taxa de conversão" value={`${charts.conversionRate}%`} sub="leads → venda" />
            </div>

            {/* Gráficos linha 1 */}
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3 mb-4">
                <ChartCard title="Receita vs. Despesa" subtitle="Por mês" empty={charts.revenueByMonth.every(m => m.receita === 0 && m.despesa === 0)}>
                    <ResponsiveContainer>
                        <BarChart data={charts.revenueByMonth}>
                            <CartesianGrid stroke={CHART.grid} vertical={false} />
                            <XAxis dataKey="mes" stroke={CHART.axis} fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis stroke={CHART.axis} fontSize={11} tickLine={false} axisLine={false} width={44} />
                            <Tooltip {...tip} formatter={(v: number) => eur(v)} />
                            <Bar dataKey="receita" name="Receita" fill="#E58A32" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="despesa" name="Despesa" fill="#5C6068" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Lucro mensal" subtitle="Receita - Despesas" empty={charts.profitByMonth.every(m => m.lucro === 0)}>
                    <ResponsiveContainer>
                        <AreaChart data={charts.profitByMonth}>
                            <defs><linearGradient id="gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} /><stop offset="100%" stopColor="#22c55e" stopOpacity={0} /></linearGradient></defs>
                            <CartesianGrid stroke={CHART.grid} vertical={false} />
                            <XAxis dataKey="mes" stroke={CHART.axis} fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis stroke={CHART.axis} fontSize={11} tickLine={false} axisLine={false} width={44} />
                            <Tooltip {...tip} formatter={(v: number) => eur(v)} />
                            <Area type="monotone" dataKey="lucro" name="Lucro" stroke="#22c55e" strokeWidth={2} fill="url(#gl)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Receita por produto" empty={charts.byProduct.length === 0}>
                    <ResponsiveContainer>
                        <PieChart>
                            <Pie data={charts.byProduct} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2} stroke="none">
                                {charts.byProduct.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                            </Pie>
                            <Tooltip {...tip} formatter={(v: number) => eur(v)} />
                        </PieChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>

            {/* Gráficos linha 2 */}
            <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard title="Leads por setor de empresa" subtitle="Distribuição por categoria" empty={charts.byCategory.length === 0}>
                    <ResponsiveContainer>
                        <BarChart data={charts.byCategory.slice(0, 8)} layout="vertical" margin={{ left: 20 }}>
                            <CartesianGrid stroke={CHART.grid} horizontal={false} />
                            <XAxis type="number" allowDecimals={false} stroke={CHART.axis} fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis type="category" dataKey="name" stroke={CHART.axis} fontSize={10} width={120} tickLine={false} axisLine={false} />
                            <Tooltip {...tip} />
                            <Bar dataKey="value" name="Leads" fill="#E58A32" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Despesas por categoria" empty={charts.byExpenseCategory.length === 0}>
                    <ResponsiveContainer>
                        <BarChart data={charts.byExpenseCategory} layout="vertical" margin={{ left: 20 }}>
                            <CartesianGrid stroke={CHART.grid} horizontal={false} />
                            <XAxis type="number" stroke={CHART.axis} fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis type="category" dataKey="name" stroke={CHART.axis} fontSize={10} width={100} tickLine={false} axisLine={false} />
                            <Tooltip {...tip} formatter={(v: number) => eur(v)} />
                            <Bar dataKey="value" name="Valor" fill="#8B8F98" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>

            {/* Tabela de vendas por produto */}
            {charts.byProduct.length > 0 && (
                <div className="mt-4">
                    <Card>
                        <CardHeader title="Breakdown de receita por produto" subtitle={`Período: últimos ${period} meses`} />
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-[13px]">
                                <thead className="border-b border-white/[0.06] text-[11px] uppercase tracking-wider text-white/35">
                                    <tr>{['Produto', 'Receita', '% do total'].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.04]">
                                    {charts.byProduct.map((row, i) => (
                                        <tr key={row.name}>
                                            <td className="px-4 py-3 flex items-center gap-2">
                                                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                                                {row.name}
                                            </td>
                                            <td className="px-4 py-3 font-semibold tabular-nums">{eur(row.value)}</td>
                                            <td className="px-4 py-3 text-white/55">{charts.totalRevenue > 0 ? ((row.value / charts.totalRevenue) * 100).toFixed(1) : 0}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}
        </>
    )
}
