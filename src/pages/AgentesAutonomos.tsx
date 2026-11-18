import { useCallback, useEffect, useMemo, useState } from 'react'
import { Users, Radar, BarChart3, Palette, FileText, ShieldCheck, Send, Check, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Badge, Button, Card, CardHeader, PageHeader, Skeleton } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { cn, relativeTime } from '@/lib/utils'

type Run = { id: string; query: string; status: string; created_at: string }
type Step = { id: string; run_id: string; agent_code: string; message: string; status: string; created_at: string }
type Pkg = { id: string; company_id: string; title: string; total: number; notes: string | null; created_at: string; companies: { name: string } | null }
type SiteRow = { company_id: string; slug: string | null; status: string }

/** Os cinco agentes da equipa, na ordem em que trabalham. `code` liga ao agente real que grava os passos. */
const AGENTS = [
  { code: 'pesquisador', name: 'Pesquisador', role: 'Capta leads na internet e no mapa', icon: Radar, color: '#38bdf8' },
  { code: 'analista', name: 'Analista', role: 'Avalia cada empresa e a oportunidade', icon: BarChart3, color: '#a78bfa' },
  { code: 'designer', name: 'Designer', role: 'Monta e personaliza a estrutura do site', icon: Palette, color: '#f472b6' },
  { code: 'vendedor', name: 'Propostas', role: 'Escreve a proposta de cada cliente', icon: FileText, color: '#34d399' },
  { code: 'supervisor', name: 'Revisor', role: 'Prepara o pacote para a sua aprovação', icon: ShieldCheck, color: '#fbbf24' },
] as const

/** Estado de cada agente a partir dos passos reais da última execução. */
function agentState(code: string, steps: Step[], busy: boolean, index: number, busyIndex: number) {
  if (busy) return index === busyIndex ? 'a trabalhar' : index < busyIndex ? 'concluido' : 'à espera'
  const mine = steps.filter(s => s.agent_code === code)
  if (mine.length === 0) return 'parado'
  const last = mine[mine.length - 1]
  if (last.status === 'erro') return 'erro'
  if (last.status === 'aguarda_aprovacao') return 'aguarda aprovação'
  return 'concluido'
}

const stateTone: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'brand'> = {
  'a trabalhar': 'brand', concluido: 'success', 'aguarda aprovação': 'warning', erro: 'danger', 'à espera': 'neutral', parado: 'neutral',
}

/** Página "Agentes autónomos": sala da equipa, pedido à equipa e pacotes prontos para aprovação. Nada é enviado aos clientes. */
export default function AgentesAutonomos() {
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [busyIndex, setBusyIndex] = useState(0)
  const [run, setRun] = useState<Run | null>(null)
  const [steps, setSteps] = useState<Step[]>([])
  const [packages, setPackages] = useState<Pkg[] | null>(null)
  const [sites, setSites] = useState<Record<string, SiteRow>>({})
  const [deciding, setDeciding] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [r, p, w] = await Promise.all([
      supabase.from('pipeline_runs').select('id, query, status, created_at').order('created_at', { ascending: false }).limit(1),
      supabase.from('proposals').select('id, company_id, title, total, notes, created_at, companies(name)').eq('status', 'rascunho').order('created_at', { ascending: false }).limit(30),
      supabase.from('websites').select('company_id, slug, status').eq('status', 'rascunho').not('slug', 'is', null).order('created_at', { ascending: false }).limit(100),
    ])
    const byCompany: Record<string, SiteRow> = {}
    for (const row of (w.data ?? []) as SiteRow[]) if (!byCompany[row.company_id]) byCompany[row.company_id] = row
    setSites(byCompany)
    const last = (r.data?.[0] ?? null) as Run | null
    setRun(last)
    if (last) {
      const { data: st } = await supabase.from('pipeline_steps').select('id, run_id, agent_code, message, status, created_at').eq('run_id', last.id).order('created_at')
      setSteps((st ?? []) as Step[])
    } else setSteps([])
    setPackages((p.data ?? []) as unknown as Pkg[])
  }, [])

  useEffect(() => { load() }, [load])

  // Enquanto a equipa trabalha, a sala mostra o agente ativo a avançar pela ordem.
  useEffect(() => {
    if (!busy) return
    setBusyIndex(0)
    const t = setInterval(() => setBusyIndex(i => Math.min(i + 1, AGENTS.length - 1)), 2200)
    return () => clearInterval(t)
  }, [busy])

  const send = async () => {
    const q = query.trim()
    if (!q || busy) return
    setBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão expirada. Inicie sessão novamente.')
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mkon-pipeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string },
        body: JSON.stringify({ query: q }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? `Erro ${res.status}`)
      toast.push('success', 'A equipa concluiu o trabalho. Nada foi enviado.')
      setQuery('')
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Falha ao contactar a equipa.')
    } finally {
      setBusy(false)
      load()
    }
  }

  const decide = async (pkg: Pkg, status: 'aprovada' | 'recusada') => {
    setDeciding(pkg.id)
    const { error } = await supabase.from('proposals').update({ status, decided_at: new Date().toISOString() }).eq('id', pkg.id)
    setDeciding(null)
    if (error) return toast.push('error', error.message)
    setPackages(p => (p ?? []).filter(x => x.id !== pkg.id))
    toast.push('success', status === 'aprovada' ? 'Aprovado. O envio ao cliente ainda não está ligado; nada foi enviado.' : 'Pacote recusado.')
  }

  const busyIdx = busyIndex
  const roster = useMemo(() => AGENTS.map((a, i) => ({ ...a, state: agentState(a.code, steps, busy, i, busyIdx) })), [steps, busy, busyIdx])
  const bubble = (code: string) => {
    if (busy) return ''
    const m = steps.filter(s => s.agent_code === code).pop()
    return m?.message ?? ''
  }

  return (
    <>
      <PageHeader title="Agentes autónomos" description="A sua equipa de agentes capta, analisa, desenha e propõe. Só envia depois da sua aprovação." />

      <Card className="mb-5 p-4">
        <p className="mb-2 text-xs text-white/50">Dê uma missão à equipa (ex.: “canalizadores em Viseu”)</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className="input flex-1" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Tipo de negócio e localidade" disabled={busy} />
          <Button onClick={send} loading={busy} disabled={!query.trim()}><Send className="h-4 w-4" /> Enviar à equipa</Button>
        </div>
      </Card>

      {/* Sala da equipa: cenário em perspetiva, com uma estação por agente. */}
      <Card className="mb-5 overflow-hidden">
        <CardHeader title="Sala da equipa" subtitle={run ? `Última missão: “${run.query}” · ${relativeTime(run.created_at)}` : 'Ainda sem missões'} />
        <div className="relative p-4 sm:p-6" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(56,189,248,0.10), transparent 60%), #0b1020' }}>
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5" style={{ transform: 'perspective(1000px) rotateX(14deg)', transformOrigin: '50% 0%' }}>
            {roster.map((a) => {
              const Icon = a.icon
              const active = a.state === 'a trabalhar'
              const text = bubble(a.code)
              return (
                <div key={a.code} className="flex flex-col items-center">
                  <div className={cn('relative min-h-[64px] w-full max-w-[150px] rounded-t-lg px-2 py-1.5 text-center text-[11px] leading-snug text-white/75', text ? 'bg-white/[0.08]' : 'bg-transparent')}>
                    {text && <span className="line-clamp-4">{text}</span>}
                  </div>
                  <div className={cn('relative flex h-16 w-16 items-center justify-center rounded-full border-2 transition-transform duration-500', active && 'animate-bounce')}
                    style={{ borderColor: a.color, background: `${a.color}22`, boxShadow: active ? `0 0 24px ${a.color}aa` : 'none' }}>
                    <Icon className="h-7 w-7" style={{ color: a.color }} />
                  </div>
                  <div className="mt-2 h-2 w-24 rounded-full bg-white/10" style={{ boxShadow: active ? `0 0 12px ${a.color}` : 'none' }} />
                  <p className="mt-2 text-sm font-medium">{a.name}</p>
                  <p className="text-center text-[10px] text-white/40">{a.role}</p>
                  <div className="mt-1.5"><Badge tone={stateTone[a.state] ?? 'neutral'}>{a.state}</Badge></div>
                </div>
              )
            })}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Pacotes prontos para aprovação" subtitle="Proposta e site preparados pela equipa. Aprove ou recuse; nada sai daqui sem o seu clique." />
        <div className="space-y-3 p-4">
          {packages === null ? <Skeleton className="h-24" /> : packages.length === 0 ? (
            <p className="py-6 text-center text-sm text-white/45"><Users className="mx-auto mb-2 h-5 w-5 opacity-50" />Nenhum pacote à espera de aprovação.</p>
          ) : packages.map(p => (
            <div key={p.id} className="rounded-xl border border-white/[0.07] p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{p.title}</p>
                  <p className="text-[11px] text-white/40">{p.companies?.name ?? 'Cliente'} · {relativeTime(p.created_at)}</p>
                </div>
                <Badge tone="warning">À espera</Badge>
              </div>
              {sites[p.company_id]?.slug && (
                <a href={`/${sites[p.company_id].slug}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-brand-soft hover:underline">
                  Pré-visualizar o site preparado pelo Designer
                </a>
              )}
              {p.notes && <p className="mt-2 line-clamp-4 whitespace-pre-line text-xs leading-relaxed text-white/60">{p.notes}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => decide(p, 'aprovada')} loading={deciding === p.id}><Check className="h-3.5 w-3.5" /> Aprovar</Button>
                <Button size="sm" variant="ghost" onClick={() => decide(p, 'recusada')} disabled={deciding === p.id}><X className="h-3.5 w-3.5" /> Recusar</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}
