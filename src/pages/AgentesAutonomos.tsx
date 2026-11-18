import { useCallback, useEffect, useState } from 'react'
import { Users, Send, Check, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Badge, Button, Card, CardHeader, PageHeader, Skeleton } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { relativeTime } from '@/lib/utils'
import { AgentOffice, type Step } from '@/components/agents/AgentOffice'

type Run = { id: string; query: string; status: string; created_at: string }
type Pkg = { id: string; company_id: string; title: string; total: number; notes: string | null; created_at: string; companies: { name: string } | null }
type SiteRow = { company_id: string; slug: string | null; status: string }

/** Página "Agentes autónomos": sala da equipa (ao vivo), pedido à equipa e pacotes para aprovação. Nada é enviado aos clientes. */
export default function AgentesAutonomos() {
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [run, setRun] = useState<Run | null>(null)
  const [steps, setSteps] = useState<Step[]>([])
  const [packages, setPackages] = useState<Pkg[] | null>(null)
  const [sites, setSites] = useState<Record<string, SiteRow>>({})
  const [approved, setApproved] = useState(0)
  const [deciding, setDeciding] = useState<string | null>(null)

  const runActive = !!run && !['concluida', 'erro'].includes(run.status)

  const load = useCallback(async () => {
    const [r, p, w, a] = await Promise.all([
      supabase.from('pipeline_runs').select('id, query, status, created_at').order('created_at', { ascending: false }).limit(1),
      supabase.from('proposals').select('id, company_id, title, total, notes, created_at, companies(name)').eq('status', 'rascunho').order('created_at', { ascending: false }).limit(30),
      supabase.from('websites').select('company_id, slug, status').eq('status', 'rascunho').not('slug', 'is', null).order('created_at', { ascending: false }).limit(100),
      supabase.from('proposals').select('id', { count: 'exact', head: true }).eq('status', 'aprovada'),
    ])
    const last = (r.data?.[0] ?? null) as Run | null
    setRun(last)
    if (last) {
      const { data: st } = await supabase.from('pipeline_steps').select('id, run_id, agent_code, message, status, created_at').eq('run_id', last.id).order('created_at')
      setSteps((st ?? []) as Step[])
    } else setSteps([])
    setPackages((p.data ?? []) as unknown as Pkg[])
    const byCompany: Record<string, SiteRow> = {}
    for (const row of (w.data ?? []) as SiteRow[]) if (!byCompany[row.company_id]) byCompany[row.company_id] = row
    setSites(byCompany)
    setApproved(a.count ?? 0)
  }, [])

  useEffect(() => { load() }, [load])

  // Ao vivo: enquanto a equipa trabalha, atualiza a cada 2 s; caso contrário, a cada 20 s.
  useEffect(() => {
    const ms = busy || runActive ? 2000 : 20000
    const t = setInterval(load, ms)
    return () => clearInterval(t)
  }, [busy, runActive, load])

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
    if (status === 'aprovada') setApproved(n => n + 1)
    toast.push('success', status === 'aprovada' ? 'Aprovado. O envio ao cliente ainda não está ligado; nada foi enviado.' : 'Pacote recusado.')
  }

  return (
    <>
      <PageHeader title="Agentes autónomos" description="A equipa capta, analisa, desenha e propõe sozinha, até ao contrato. Só envia depois da sua aprovação." />

      <Card className="mb-5 p-4">
        <p className="mb-2 text-xs text-white/50">Dê uma missão à equipa (ex.: “canalizadores em Viseu”)</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className="input flex-1" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Tipo de negócio e localidade" disabled={busy} />
          <Button onClick={send} loading={busy} disabled={!query.trim()}><Send className="h-4 w-4" /> Enviar à equipa</Button>
        </div>
      </Card>

      <Card className="mb-5 overflow-hidden">
        <CardHeader title="Escritório da equipa" subtitle={run ? `Estado em direto · ${relativeTime(run.created_at)}` : 'Ainda sem missões'} />
        <div className="p-4 sm:p-5">
          <AgentOffice steps={steps} runStatus={run?.status ?? null} runQuery={run?.query ?? null} busy={busy} approved={approved} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Pacotes prontos para aprovação" subtitle="Proposta e site preparados pela equipa. Nada sai daqui sem o seu clique." />
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
