import { useCallback, useEffect, useState } from 'react'
import { Bot, CheckCircle2, Pencil, Save, Settings2, XCircle, FileEdit, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/log'
import { Badge, Button, Card, CardHeader, EmptyState, Field, PageHeader, Skeleton } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { dateTime, eur } from '@/lib/utils'

type Config = { provider: 'groq' | 'openrouter' | 'outro'; model: string; temperature: number; monthly_limit_eur: number }
type Draft = { id: string; kind: string; title: string; body: string; status: 'pendente' | 'aprovado' | 'rejeitado' | 'rascunho'; created_at: string; decided_at: string | null }
type Usage = { id: number; provider: string; model: string; input_tokens: number; output_tokens: number; cost_eur: number; created_at: string }

const DEFAULT_CONFIG: Config = { provider: 'groq', model: '', temperature: 0.4, monthly_limit_eur: 20 }
const STATUS_LABEL: Record<Draft['status'], { label: string; tone: 'brand' | 'success' | 'danger' | 'warning' | 'neutral' }> = {
  pendente: { label: 'Aguarda aprovação', tone: 'warning' },
  aprovado: { label: 'Aprovado', tone: 'success' },
  rejeitado: { label: 'Rejeitado', tone: 'danger' },
  rascunho: { label: 'Rascunho', tone: 'neutral' },
}

/** MKON AI: configuração do provedor, consumo e fila de aprovação humana. A IA nunca envia nada sozinha. */
export default function MkonAi() {
  const toast = useToast()
  const [cfg, setCfg] = useState<Config>(DEFAULT_CONFIG)
  const [savingCfg, setSavingCfg] = useState(false)
  const [usage, setUsage] = useState<Usage[] | null>(null)
  const [drafts, setDrafts] = useState<Draft[] | null>(null)
  const [filter, setFilter] = useState<Draft['status']>('pendente')
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null)
  const [nd, setNd] = useState({ kind: 'mensagem', title: '', body: '' })

  const loadCfg = useCallback(async () => {
    const { data } = await supabase.from('system_settings').select('value').eq('key', 'ai_config').maybeSingle()
    if (data?.value) setCfg({ ...DEFAULT_CONFIG, ...(data.value as Partial<Config>) })
  }, [])

  const loadUsage = useCallback(async () => {
    const since = new Date(Date.now() - 30 * 86400000).toISOString()
    const { data, error } = await supabase.from('ai_usage').select('id, provider, model, input_tokens, output_tokens, cost_eur, created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(200)
    if (error) return toast.push('error', error.message)
    setUsage((data ?? []) as Usage[])
  }, [toast])

  const loadDrafts = useCallback(async () => {
    const { data, error } = await supabase.from('ai_drafts').select('id, kind, title, body, status, created_at, decided_at').eq('status', filter).order('created_at', { ascending: false }).limit(100)
    if (error) return toast.push('error', error.message)
    setDrafts((data ?? []) as Draft[])
  }, [filter, toast])

  useEffect(() => { loadCfg(); loadUsage() }, [loadCfg, loadUsage])
  useEffect(() => { loadDrafts() }, [loadDrafts])

  const saveCfg = async () => {
    if (!cfg.model.trim()) return toast.push('error', 'Indique o modelo (ex.: llama-3.3-70b-versatile).')
    if (cfg.temperature < 0 || cfg.temperature > 2) return toast.push('error', 'A temperatura deve estar entre 0 e 2.')
    setSavingCfg(true)
    const { error } = await supabase.from('system_settings').upsert({ key: 'ai_config', value: cfg, updated_at: new Date().toISOString() })
    setSavingCfg(false)
    if (error) return toast.push('error', error.message)
    await logActivity('ai.config_updated', 'system_settings', 'ai_config', { provider: cfg.provider, model: cfg.model })
    toast.push('success', 'Configuração guardada.')
  }

  const decide = async (d: Draft, status: Draft['status'], body?: string) => {
    const patch: Record<string, unknown> = { status, decided_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    if (body !== undefined) patch.body = body
    const { error } = await supabase.from('ai_drafts').update(patch).eq('id', d.id)
    if (error) return toast.push('error', error.message)
    await logActivity('ai.draft_' + status, 'ai_drafts', d.id)
    toast.push('success', status === 'aprovado' ? 'Aprovado. Envio feito manualmente, a IA não envia nada.' : 'Atualizado.')
    setEditing(null)
    loadDrafts()
  }

  const createDraft = async () => {
    if (!nd.title.trim()) return toast.push('error', 'Dê um título ao rascunho.')
    const { error } = await supabase.from('ai_drafts').insert({ kind: nd.kind, title: nd.title.trim(), body: nd.body, status: 'pendente' })
    if (error) return toast.push('error', error.message)
    setNd({ kind: 'mensagem', title: '', body: '' })
    toast.push('success', 'Rascunho enviado para aprovação.')
    if (filter === 'pendente') loadDrafts()
  }

  const monthCost = (usage ?? []).reduce((a, u) => a + Number(u.cost_eur), 0)
  const monthTokens = (usage ?? []).reduce((a, u) => a + u.input_tokens + u.output_tokens, 0)
  const overLimit = cfg.monthly_limit_eur > 0 && monthCost >= cfg.monthly_limit_eur

  return (
    <>
      <PageHeader title="MKON AI" description="Assistente comercial e operacional. Configure o provedor, acompanhe o consumo e aprove o que a IA prepara. A chave fica só no servidor." />

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader title="Configuração" subtitle="A chave de API é definida nos segredos do Supabase (LLM_API_KEY), nunca aqui." />
          <div className="space-y-4 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Provedor">
                <select className="input" value={cfg.provider} onChange={e => setCfg({ ...cfg, provider: e.target.value as Config['provider'] })}>
                  <option value="groq">Groq</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="outro">Outro (compatível com OpenAI)</option>
                </select>
              </Field>
              <Field label="Modelo"><input className="input" value={cfg.model} onChange={e => setCfg({ ...cfg, model: e.target.value })} placeholder="ex.: llama-3.3-70b-versatile" /></Field>
              <Field label={`Temperatura (${cfg.temperature.toFixed(1)})`}>
                <input type="range" min={0} max={2} step={0.1} className="w-full" value={cfg.temperature} onChange={e => setCfg({ ...cfg, temperature: Number(e.target.value) })} />
              </Field>
              <Field label="Limite mensal (€)" hint="Aviso quando o consumo do mês atinge este valor.">
                <input type="number" min={0} step={1} className="input" value={cfg.monthly_limit_eur} onChange={e => setCfg({ ...cfg, monthly_limit_eur: Number(e.target.value) })} />
              </Field>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-white/40">{usage === null ? 'A verificar consumo…' : usage.length > 0 ? `Última utilização: ${dateTime(usage[0].created_at)}` : 'Ainda sem utilizações registadas.'}</p>
              <Button onClick={saveCfg} loading={savingCfg}><Save className="h-4 w-4" /> Guardar</Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Consumo (30 dias)" subtitle="Registado a cada chamada ao assistente" />
          <div className="space-y-4 p-5">
            {usage === null ? <Skeleton className="h-24" /> : (
              <>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg border border-white/[0.07] p-3"><p className="text-lg font-semibold">{usage.length}</p><p className="text-[11px] text-white/40">chamadas</p></div>
                  <div className="rounded-lg border border-white/[0.07] p-3"><p className="text-lg font-semibold">{monthTokens.toLocaleString('pt-PT')}</p><p className="text-[11px] text-white/40">tokens</p></div>
                  <div className="rounded-lg border border-white/[0.07] p-3"><p className={`text-lg font-semibold ${overLimit ? 'text-red-300' : ''}`}>{eur(monthCost)}</p><p className="text-[11px] text-white/40">custo</p></div>
                </div>
                {overLimit && <p className="rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-xs text-red-200">O consumo atingiu o limite mensal definido.</p>}
                <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
                  {usage.slice(0, 15).map(u => (
                    <li key={u.id} className="flex justify-between gap-2 text-white/55"><span className="truncate">{u.provider} · {u.model}</span><span className="shrink-0 text-white/35">{dateTime(u.created_at)}</span></li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader title="Aprovações" subtitle="A IA prepara textos e propostas. Nada é enviado sem a sua aprovação." />
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(STATUS_LABEL) as Draft['status'][]).map(s => (
              <button key={s} onClick={() => setFilter(s)} aria-pressed={filter === s}
                className={filter === s ? 'rounded-lg border border-brand/50 bg-brand/10 px-3 py-1.5 text-xs text-brand-soft' : 'rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/55 hover:text-snow'}>
                {STATUS_LABEL[s].label}
              </button>
            ))}
          </div>

          {drafts === null ? <Skeleton className="h-20" /> : drafts.length === 0 ? (
            <EmptyState icon={<Bot className="h-5 w-5" />} title="Sem itens nesta lista" description="Quando o assistente preparar um texto, aparece aqui para aprovar." />
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {drafts.map(d => (
                <div key={d.id} className="space-y-2 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0"><p className="truncate text-sm font-medium">{d.title}</p><p className="text-[11px] text-white/40">{d.kind} · {dateTime(d.created_at)}</p></div>
                    <Badge tone={STATUS_LABEL[d.status].tone}>{STATUS_LABEL[d.status].label}</Badge>
                  </div>
                  {editing?.id === d.id ? (
                    <div className="space-y-2">
                      <textarea rows={5} className="input" value={editing.body} onChange={e => setEditing({ id: d.id, body: e.target.value })} />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => decide(d, d.status, editing.body)}><Save className="h-3.5 w-3.5" /> Guardar texto</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <p className="whitespace-pre-line rounded-lg bg-white/[0.03] p-3 text-xs text-white/70">{d.body || '—'}</p>
                  )}
                  {editing?.id !== d.id && d.status !== 'aprovado' && (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => decide(d, 'aprovado')}><CheckCircle2 className="h-3.5 w-3.5" /> Aprovar</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditing({ id: d.id, body: d.body })}><Pencil className="h-3.5 w-3.5" /> Editar</Button>
                      <Button size="sm" variant="ghost" onClick={() => decide(d, 'rascunho')}><FileEdit className="h-3.5 w-3.5" /> Guardar como rascunho</Button>
                      <Button size="sm" variant="ghost" onClick={() => decide(d, 'rejeitado')}><XCircle className="h-3.5 w-3.5" /> Rejeitar</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="rounded-lg border border-white/[0.07] p-4">
            <p className="label mb-2 flex items-center gap-1.5"><Settings2 className="h-3.5 w-3.5" /> Preparar um texto para aprovação</p>
            <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
              <Field label="Tipo">
                <select className="input" value={nd.kind} onChange={e => setNd({ ...nd, kind: e.target.value })}>
                  <option value="mensagem">Mensagem</option><option value="proposta">Proposta</option><option value="descricao">Descrição de produto</option><option value="texto">Texto</option>
                </select>
              </Field>
              <Field label="Título"><input className="input" value={nd.title} onChange={e => setNd({ ...nd, title: e.target.value })} /></Field>
            </div>
            <div className="mt-3"><Field label="Texto"><textarea rows={3} className="input" value={nd.body} onChange={e => setNd({ ...nd, body: e.target.value })} /></Field></div>
            <div className="mt-3 flex justify-end"><Button variant="outline" onClick={createDraft}><Plus className="h-4 w-4" /> Enviar para aprovação</Button></div>
          </div>
        </div>
      </Card>
    </>
  )
}
