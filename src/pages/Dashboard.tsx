import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  Building2, UserPlus, BadgeCheck, Flame, Send, MessageSquareReply, CalendarCheck, FileText, Handshake, Hammer,
  Nfc, Euro, Receipt, TrendingUp, Search, Globe, Plus, AlertTriangle, Sparkles, Activity, BarChart3,
  FlaskConical, KeyRound, Plug,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { isConfigured } from '@/lib/supabase'
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader, Skeleton } from '@/components/ui'
import { eur, relativeTime } from '@/lib/utils'
import { stageLabel, STAGES } from '@/lib/constants'
import { isDemoActive, DEMO, exitDemo } from '@/lib/demo'
import { useAuth } from '@/lib/auth'

type Lead = { id: string; stage: string; score: number | null; opportunity: string | null; created_at: string; next_action: string | null; next_action_at: string | null; companies: { name: string; city: string | null; source_id: string | null } | null }
type Sale = { amount: number; cost: number; sold_at: string; products: { name: string; category: string } | null }
type Expense = { amount: number; incurred_on: string; status: string }
type Proposal = { status: string; created_at: string }
type Task = { status: string; ai_agents: { name: string } | null }
type Log = { id: number; action: string; entity_type: string | null; created_at: string }

const CHART = { grid: 'rgba(255,255,255,0.06)', axis: 'rgba(255,255,255,0.35)' }
const PALETTE = ['#E58A32', '#F3A34F', '#8B8F98', '#5C6068', '#C96F1A', '#3B3F46']
const tip = { contentStyle: { background: '#1B1D21', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, fontSize: 12 }, cursor: { fill: 'rgba(255,255,255,0.04)' } }

const monthKey = (iso: string) => iso.slice(0, 7)
const monthLabel = (k: string) => new Date(k + '-01').toLocaleDateString('pt-PT', { month: 'short' })
function lastMonths(n: number) {
  const out: string[] = []
  const d = new Date(); d.setDate(1)
  for (let i = n - 1; i >= 0; i--) { const x = new Date(d); x.setMonth(d.getMonth() - i); out.push(x.toISOString().slice(0, 7)) }
  return out
}

function Kpi({ icon: Icon, label, value, loading, hint }: { icon: typeof Building2; label: string; value: string | number; loading: boolean; hint?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between text-white/40"><span className="text-[11px] font-medium uppercase tracking-wider">{label}</span><Icon className="h-4 w-4" strokeWidth={1.8} /></div>
      {loading ? <Skeleton className="mt-3 h-7 w-20" /> : <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>}
      {hint && <div className="mt-1 text-[11px] text-white/30">{hint}</div>}
    </Card>
  )
}

function ChartCard({ title, subtitle, empty, loading, children }: { title: string; subtitle?: string; empty: boolean; loading: boolean; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <div className="h-56 px-3 py-4">
        {loading ? <Skeleton className="h-full w-full" /> : empty ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <BarChart3 className="mb-2 h-5 w-5 text-white/20" />
            <p className="text-xs text-white/35">Sem dados ainda.<br />Aparecerá aqui quando existirem registos reais.</p>
          </div>
        ) : children}
      </div>
    </Card>
  )
}

/* ── Banner de aviso de chaves / modo demo ── */
function ConfigBanner() {
  const nav = useNavigate()
  const { isDemo } = useAuth()
  const [integrationsOk, setIntegrationsOk] = useState<boolean | null>(null)

  useEffect(() => {
    if (isDemo || !isConfigured) { setIntegrationsOk(false); return }
    supabase.from('integrations').select('status').eq('status', 'conectada').then(({ data }) => {
      setIntegrationsOk((data ?? []).length > 0)
    })
  }, [isDemo])

  if (isDemo) {
    return (
      <div className="mb-5 flex items-center gap-3 rounded-xl border border-brand/30 bg-brand/[0.07] px-4 py-3 text-sm">
        <FlaskConical className="h-4 w-4 shrink-0 text-brand-soft" />
        <span className="flex-1 text-white/70">
          <span className="font-semibold text-brand-soft">Modo demonstração</span> — todos os valores são fictícios e nenhuma ação tem efeito real.
        </span>
        <button
          onClick={exitDemo}
          className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/50 hover:text-snow transition"
        >
          Sair
        </button>
      </div>
    )
  }

  if (!isConfigured) {
    return (
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3">
        <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <div className="flex-1 text-xs leading-relaxed text-amber-100/80">
          <p className="mb-1 font-semibold text-amber-200">Supabase não configurado</p>
          Defina <code className="font-mono">VITE_SUPABASE_URL</code> e <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> no <code className="font-mono">.env</code> e reinicie o servidor.
        </div>
      </div>
    )
  }

  if (integrationsOk === false) {
    return (
      <div className="mb-5 flex items-center gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3">
        <Plug className="h-4 w-4 shrink-0 text-amber-400" />
        <p className="flex-1 text-xs text-amber-100/80">
          <span className="font-semibold">Nenhuma integração ativa.</span> Configure as chaves de API em{' '}
          <button onClick={() => nav('/admin')} className="font-medium text-brand-soft underline underline-offset-2 hover:no-underline">Administração → Integrações</button>.
        </p>
      </div>
    )
  }

  return null
}

export default function Dashboard() {
  const nav = useNavigate()
  const demo = isDemoActive()
  const [loading, setLoading] = useState(!demo)
  const [error, setError] = useState<string | null>(null)
  const [d, setD] = useState(() => {
    if (demo) return {
      companies: DEMO.companies, nfcSold: DEMO.nfcSold, websitesInProd: DEMO.websitesInProd,
      contacts: DEMO.contacts, replies: DEMO.replies, meetings: 0,
      leads: DEMO.leads as Lead[], sales: DEMO.sales as Sale[], expenses: DEMO.expenses as Expense[],
      proposals: DEMO.proposals as Proposal[], tasks: DEMO.tasks as Task[],
      logs: DEMO.logs as Log[], sources: DEMO.sources,
      companySources: DEMO.companySources, overdueTx: DEMO.overdueTx, overdueProjects: DEMO.overdueProjects,
    }
    return {
      companies: 0, nfcSold: 0, websitesInProd: 0, contacts: 0, replies: 0, meetings: 0,
      leads: [] as Lead[], sales: [] as Sale[], expenses: [] as Expense[], proposals: [] as Proposal[], tasks: [] as Task[],
      logs: [] as Log[], sources: [] as { id: string; name: string }[], companySources: [] as { source_id: string | null }[],
      overdueTx: 0, overdueProjects: 0,
    }
  })

  useEffect(() => {
    if (demo) return
      ; (async () => {
        const today = new Date().toISOString().slice(0, 10)
        const [c, l, s, e, p, t, lg, src, nfc, prj, conv, msgIn, overdueTx, overdueProj, cs] = await Promise.all([
          supabase.from('companies').select('id', { count: 'exact', head: true }),
          supabase.from('leads').select('id, stage, score, opportunity, created_at, next_action, next_action_at, companies(name, city, source_id)'),
          supabase.from('sales').select('amount, cost, sold_at, products(name, category)'),
          supabase.from('expenses').select('amount, incurred_on, status'),
          supabase.from('proposals').select('status, created_at'),
          supabase.from('ai_tasks').select('status, ai_agents(name)'),
          supabase.from('activity_logs').select('id, action, entity_type, created_at').order('created_at', { ascending: false }).limit(8),
          supabase.from('lead_sources').select('id, name'),
          supabase.from('nfc_devices').select('id', { count: 'exact', head: true }).in('status', ['vendida', 'entregue', 'ativa']),
          supabase.from('projects').select('id', { count: 'exact', head: true }).not('stage', 'in', '(entregue)'),
          supabase.from('messages').select('id', { count: 'exact', head: true }).eq('direction', 'saida').eq('status', 'enviada'),
          supabase.from('messages').select('id', { count: 'exact', head: true }).eq('direction', 'entrada'),
          supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('status', 'pendente').lt('due_on', today),
          supabase.from('projects').select('id', { count: 'exact', head: true }).neq('stage', 'entregue').lt('due_on', today),
          supabase.from('companies').select('source_id'),
        ])
        const firstErr = [c, l, s, e, p, t, lg, src, nfc, prj, conv, msgIn, overdueTx, overdueProj, cs].find((r) => r.error)
        if (firstErr?.error) { setError(firstErr.error.message); setLoading(false); return }
        setD({
          companies: c.count ?? 0, nfcSold: nfc.count ?? 0, websitesInProd: prj.count ?? 0,
          contacts: conv.count ?? 0, replies: msgIn.count ?? 0, meetings: 0,
          leads: (l.data ?? []) as unknown as Lead[], sales: (s.data ?? []) as unknown as Sale[],
          expenses: (e.data ?? []) as Expense[], proposals: (p.data ?? []) as Proposal[],
          tasks: (t.data ?? []) as unknown as Task[], logs: (lg.data ?? []) as Log[],
          sources: (src.data ?? []) as { id: string; name: string }[],
          companySources: (cs.data ?? []) as { source_id: string | null }[],
          overdueTx: overdueTx.count ?? 0, overdueProjects: overdueProj.count ?? 0,
        })
        setLoading(false)
      })()
  }, [demo])

  const m = useMemo(() => {
    const months = lastMonths(6)
    const thisMonth = new Date().toISOString().slice(0, 7)
    const revenue = d.sales.filter((s) => monthKey(s.sold_at) === thisMonth).reduce((a, s) => a + Number(s.amount), 0)
    const expenses = d.expenses.filter((x) => monthKey(x.incurred_on) === thisMonth).reduce((a, x) => a + Number(x.amount), 0)
    const leadsByMonth = months.map((k) => ({ mes: monthLabel(k), leads: d.leads.filter((x) => monthKey(x.created_at) === k).length }))
    const salesByMonth = months.map((k) => ({ mes: monthLabel(k), valor: d.sales.filter((x) => monthKey(x.sold_at) === k).reduce((a, x) => a + Number(x.amount), 0) }))
    const proposalsByMonth = months.map((k) => ({ mes: monthLabel(k), enviadas: d.proposals.filter((x) => monthKey(x.created_at) === k).length, aprovadas: d.proposals.filter((x) => monthKey(x.created_at) === k && x.status === 'aprovada').length }))
    const funnel = STAGES.map((s) => ({ etapa: s.label, total: d.leads.filter((l) => l.stage === s.key).length })).filter((x) => x.total > 0)
    const byProduct = Object.entries(d.sales.reduce<Record<string, number>>((acc, s) => { const k = s.products?.name ?? 'Outros'; acc[k] = (acc[k] ?? 0) + Number(s.amount); return acc }, {})).map(([name, value]) => ({ name, value }))
    const agentPerf = Object.values(d.tasks.reduce<Record<string, { agente: string; concluidas: number; falhadas: number }>>((acc, t) => {
      const n = t.ai_agents?.name ?? '—'; acc[n] ??= { agente: n, concluidas: 0, falhadas: 0 }
      if (t.status === 'concluida') acc[n].concluidas++; if (t.status === 'cancelada') acc[n].falhadas++
      return acc
    }, {}))
    const origin = Object.entries(d.companySources.reduce<Record<string, number>>((acc, c) => { const n = d.sources.find((s) => s.id === c.source_id)?.name ?? 'Sem origem'; acc[n] = (acc[n] ?? 0) + 1; return acc }, {})).map(([name, value]) => ({ name, value }))
    const stageCount = (...ks: string[]) => d.leads.filter((l) => ks.includes(l.stage)).length
    const now = Date.now()
    const overdueActions = d.leads.filter((l) => l.next_action_at && new Date(l.next_action_at).getTime() < now && !['perdido', 'entregue', 'venda_fechada'].includes(l.stage)).length
    return {
      revenue, expenses, profit: revenue - expenses, leadsByMonth, salesByMonth, proposalsByMonth, funnel, byProduct, agentPerf, origin,
      newLeads: stageCount('novo_lead'), qualified: stageCount('qualificado'), priority: d.leads.filter((l) => (l.score ?? 0) >= 75 && !['perdido', 'entregue'].includes(l.stage)).length,
      proposalsSent: d.proposals.filter((p) => p.status === 'enviada').length, sold: stageCount('venda_fechada', 'producao', 'entregue'), overdueActions,
      topOpps: d.leads.filter((l) => (l.score ?? 0) >= 75 && !['perdido', 'entregue', 'venda_fechada'].includes(l.stage)).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 5),
    }
  }, [d])

  const alerts = [
    m.overdueActions > 0 && `${m.overdueActions} próxima(s) ação(ões) de lead em atraso`,
    d.overdueTx > 0 && `${d.overdueTx} pagamento(s) pendente(s) vencido(s)`,
    d.overdueProjects > 0 && `${d.overdueProjects} projeto(s) com prazo ultrapassado`,
  ].filter(Boolean) as string[]

  const quick = [
    { label: 'Encontrar empresas', icon: Search, to: '/prospeccao' },
    { label: 'Criar proposta', icon: FileText, to: '/propostas' },
    { label: 'Adicionar cliente', icon: Plus, to: '/crm?novo=1' },
    { label: 'Demonstração de website', icon: Globe, to: '/websites' },
    { label: 'Registar venda', icon: Receipt, to: '/financeiro' },
    { label: 'Cadastrar plaquinha NFC', icon: Nfc, to: '/nfc' },
  ]

  if (error) return (
    <Card><EmptyState icon={<AlertTriangle className="h-5 w-5" />} title="Não foi possível carregar os dados" description={error + ' — verifique se as migrações SQL foram aplicadas.'} /></Card>
  )

  return (
    <>
      <PageHeader title="Dashboard" description={demo ? 'Visualização com dados fictícios — modo demonstração ativo.' : 'Inteligência comercial em tempo real. Todos os números vêm da base de dados.'} />

      <ConfigBanner />

      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {quick.map(({ label, icon: Icon, to }) => (
          <button key={label} onClick={() => nav(to)} className="card group flex items-center gap-2.5 px-3.5 py-3 text-left text-[13px] transition hover:border-brand/40 hover:bg-white/[0.04]">
            <Icon className="h-4 w-4 shrink-0 text-brand-soft" strokeWidth={1.8} /><span className="text-white/75 group-hover:text-snow">{label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Kpi loading={loading} icon={Building2} label="Empresas" value={d.companies} />
        <Kpi loading={loading} icon={UserPlus} label="Novos leads" value={m.newLeads} />
        <Kpi loading={loading} icon={BadgeCheck} label="Qualificados" value={m.qualified} />
        <Kpi loading={loading} icon={Flame} label="Prioritárias" value={m.priority} hint="Pontuação ≥ 75" />
        <Kpi loading={loading} icon={Send} label="Contactos feitos" value={d.contacts} />
        <Kpi loading={loading} icon={MessageSquareReply} label="Respostas" value={d.replies} />
        <Kpi loading={loading} icon={CalendarCheck} label="Reuniões" value="—" hint="Agenda: Etapa 3" />
        <Kpi loading={loading} icon={FileText} label="Propostas enviadas" value={m.proposalsSent} />
        <Kpi loading={loading} icon={Handshake} label="Vendas fechadas" value={m.sold} />
        <Kpi loading={loading} icon={Hammer} label="Em produção" value={d.websitesInProd} />
        <Kpi loading={loading} icon={Nfc} label="NFC vendidas" value={d.nfcSold} />
        <Kpi loading={loading} icon={Euro} label="Faturamento mês" value={eur(m.revenue)} hint="Só vendas registadas" />
        <Kpi loading={loading} icon={Receipt} label="Despesas mês" value={eur(m.expenses)} />
        <Kpi loading={loading} icon={TrendingUp} label="Lucro estimado" value={eur(m.profit)} hint="Antes de impostos" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <ChartCard title="Evolução de leads" subtitle="Últimos 6 meses" loading={loading} empty={m.leadsByMonth.every((x) => x.leads === 0)}>
          <ResponsiveContainer><AreaChart data={m.leadsByMonth}>
            <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#E58A32" stopOpacity={0.35} /><stop offset="100%" stopColor="#E58A32" stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid stroke={CHART.grid} vertical={false} /><XAxis dataKey="mes" stroke={CHART.axis} fontSize={11} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} stroke={CHART.axis} fontSize={11} tickLine={false} axisLine={false} width={28} />
            <Tooltip {...tip} /><Area type="monotone" dataKey="leads" name="Leads" stroke="#E58A32" strokeWidth={2} fill="url(#g)" />
          </AreaChart></ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Conversão comercial" subtitle="Leads por etapa do funil" loading={loading} empty={m.funnel.length === 0}>
          <ResponsiveContainer><BarChart data={m.funnel} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid stroke={CHART.grid} horizontal={false} /><XAxis type="number" allowDecimals={false} stroke={CHART.axis} fontSize={11} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="etapa" stroke={CHART.axis} fontSize={10} width={110} tickLine={false} axisLine={false} />
            <Tooltip {...tip} /><Bar dataKey="total" name="Leads" fill="#E58A32" radius={[0, 4, 4, 0]} />
          </BarChart></ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Vendas mensais" subtitle="Valor das vendas registadas" loading={loading} empty={m.salesByMonth.every((x) => x.valor === 0)}>
          <ResponsiveContainer><BarChart data={m.salesByMonth}>
            <CartesianGrid stroke={CHART.grid} vertical={false} /><XAxis dataKey="mes" stroke={CHART.axis} fontSize={11} tickLine={false} axisLine={false} /><YAxis stroke={CHART.axis} fontSize={11} tickLine={false} axisLine={false} width={44} />
            <Tooltip {...tip} formatter={(v: number) => eur(v)} /><Bar dataKey="valor" name="Vendas" fill="#E58A32" radius={[4, 4, 0, 0]} />
          </BarChart></ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Faturamento por produto" loading={loading} empty={m.byProduct.length === 0}>
          <ResponsiveContainer><PieChart><Pie data={m.byProduct} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2} stroke="none">
            {m.byProduct.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Pie><Tooltip {...tip} formatter={(v: number) => eur(v)} /></PieChart></ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Desempenho dos agentes de IA" subtitle="Tarefas executadas" loading={loading} empty={m.agentPerf.length === 0}>
          <ResponsiveContainer><BarChart data={m.agentPerf}>
            <CartesianGrid stroke={CHART.grid} vertical={false} /><XAxis dataKey="agente" stroke={CHART.axis} fontSize={10} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} stroke={CHART.axis} fontSize={11} tickLine={false} axisLine={false} width={28} />
            <Tooltip {...tip} /><Bar dataKey="concluidas" name="Concluídas" stackId="a" fill="#E58A32" /><Bar dataKey="falhadas" name="Falhadas" stackId="a" fill="#5C6068" radius={[4, 4, 0, 0]} />
          </BarChart></ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Origem dos clientes" loading={loading} empty={m.origin.length === 0}>
          <ResponsiveContainer><PieChart><Pie data={m.origin} dataKey="value" nameKey="name" outerRadius={80} stroke="none">
            {m.origin.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Pie><Tooltip {...tip} /></PieChart></ResponsiveContainer>
        </ChartCard>

        <div className="lg:col-span-2 xl:col-span-3">
          <ChartCard title="Evolução das propostas" subtitle="Criadas vs. aprovadas" loading={loading} empty={m.proposalsByMonth.every((x) => x.enviadas === 0)}>
            <ResponsiveContainer><BarChart data={m.proposalsByMonth}>
              <CartesianGrid stroke={CHART.grid} vertical={false} /><XAxis dataKey="mes" stroke={CHART.axis} fontSize={11} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} stroke={CHART.axis} fontSize={11} tickLine={false} axisLine={false} width={28} />
              <Tooltip {...tip} /><Bar dataKey="enviadas" name="Criadas" fill="#5C6068" radius={[4, 4, 0, 0]} /><Bar dataKey="aprovadas" name="Aprovadas" fill="#E58A32" radius={[4, 4, 0, 0]} />
            </BarChart></ResponsiveContainer>
          </ChartCard>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Atividades recentes" />
          {loading ? <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-4 w-full" />)}</div> : d.logs.length === 0 ? (
            <EmptyState icon={<Activity className="h-5 w-5" />} title="Sem atividade" description="As operações importantes ficam registadas aqui." />
          ) : (
            <ul className="divide-y divide-white/[0.05]">{d.logs.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-xs"><span className="truncate font-mono text-white/70">{l.action}</span><span className="shrink-0 text-white/30">{relativeTime(l.created_at)}</span></li>
            ))}</ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Oportunidades recomendadas pela IA" subtitle="Pontuação ≥ 75" />
          {loading ? <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-4 w-full" />)}</div> : m.topOpps.length === 0 ? (
            <EmptyState icon={<Sparkles className="h-5 w-5" />} title="Sem oportunidades analisadas" description="A análise por IA chega na Etapa 2 (requer chave OpenAI configurada)." />
          ) : (
            <ul className="divide-y divide-white/[0.05]">{m.topOpps.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0"><p className="truncate text-sm">{l.companies?.name}</p><p className="text-[11px] text-white/35">{l.companies?.city ?? '—'} · {stageLabel(l.stage)}</p></div>
                <Badge tone="brand">{l.score}</Badge>
              </li>
            ))}</ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Alertas importantes" />
          {loading ? <div className="space-y-3 p-5"><Skeleton className="h-4 w-full" /></div> : alerts.length === 0 ? (
            <EmptyState icon={<BadgeCheck className="h-5 w-5" />} title="Tudo em ordem" description="Sem atrasos nem pendências detetados." />
          ) : (
            <ul className="space-y-2 p-4">{alerts.map((a) => (
              <li key={a} className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.07] px-3 py-2.5 text-xs text-amber-100/90"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{a}</li>
            ))}</ul>
          )}
        </Card>
      </div>
      <div className="mt-4 flex justify-end"><Button variant="ghost" size="sm" onClick={() => nav('/crm')}>Abrir CRM</Button></div>
    </>
  )
}
