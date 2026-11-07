import { useCallback, useEffect, useState } from 'react'
import { Bot, Play, Pause, AlertCircle, CheckCircle, Clock, Cpu, Zap, BarChart3, ChevronDown, ChevronUp, Send, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Badge, Button, Card, CardHeader, EmptyState, Field, Modal, PageHeader, Skeleton } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { cn, relativeTime } from '@/lib/utils'
import { isDemoActive, DEMO } from '@/lib/demo'
import { isConfigured } from '@/lib/supabase'
import { FREELLM_MODELS, isFreeLlmModel } from '@/lib/llm'

/** Executa a tarefa no servidor (Edge Function mkon-agent) com o agente escolhido. */
async function runAgentOnServer(agentCode: string, task: string): Promise<{ reply: string; tools_used: string[] }> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Sessão expirada. Inicie sessão novamente.')
    const url = import.meta.env.VITE_SUPABASE_URL as string
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
    const res = await fetch(`${url}/functions/v1/mkon-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, apikey: anonKey },
        body: JSON.stringify({ agent_code: agentCode, messages: [{ role: 'user', content: task }] }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error ?? `O agente devolveu erro ${res.status}.`)
    return data
}

type Agent = {
    id: string; code: string; name: string; description: string; status: string
    model: string; provider: string; daily_task_limit: number; monthly_budget_eur: number
    last_error: string | null; sort_order: number; system_prompt?: string | null
}

/** Modelo mostrado no cartão do agente (o servidor escolhe o fornecedor). */
function modelForAgent(agent: Pick<Agent, 'model'>): string {
    return agent.model || 'auto'
}
type Task = {
    id: string; title: string; status: string; error_message: string | null
    started_at: string | null; finished_at: string | null; created_at: string
    ai_agents: { name: string } | null
    leads: { companies: { name: string } | null } | null
}

const statusConfig: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' | 'brand'; icon: typeof CheckCircle }> = {
    ativo: { label: 'Ativo', tone: 'success', icon: CheckCircle },
    pausado: { label: 'Pausado', tone: 'warning', icon: Pause },
    inativo: { label: 'Inativo', tone: 'neutral', icon: Clock },
    erro: { label: 'Erro', tone: 'danger', icon: AlertCircle },
}
const taskStatus: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' | 'brand' }> = {
    pendente: { label: 'Pendente', tone: 'neutral' },
    em_curso: { label: 'Em curso', tone: 'brand' },
    concluida: { label: 'Concluída', tone: 'success' },
    cancelada: { label: 'Cancelada', tone: 'danger' },
}

export default function Agentes() {
    const toast = useToast()
    const demo = isDemoActive()
    const [agents, setAgents] = useState<Agent[]>(demo ? DEMO.agents as unknown as Agent[] : [])
    const [tasks, setTasks] = useState<Task[]>([])
    const [loading, setLoading] = useState(!demo)
    const [editAgent, setEditAgent] = useState<Agent | null>(null)
    const [expandedAgent, setExpandedAgent] = useState<string | null>(null)

    const load = useCallback(async () => {
        if (demo) return
        const [ag, tk] = await Promise.all([
            supabase.from('ai_agents').select('*').order('sort_order'),
            supabase.from('ai_tasks').select('id, title, status, error_message, started_at, finished_at, created_at, ai_agents(name), leads(companies(name))').order('created_at', { ascending: false }).limit(50),
        ])
        if (ag.error) toast.push('error', ag.error.message)
        else setAgents((ag.data ?? []) as Agent[])
        setTasks((tk.data ?? []) as unknown as Task[])
        setLoading(false)
    }, [demo])
    useEffect(() => { load() }, [load])

    const toggleStatus = async (agent: Agent) => {
        if (demo) { toast.push('info', 'Modo demo — sem efeito real.'); return }
        const next = agent.status === 'ativo' ? 'pausado' : 'ativo'
        const { error } = await supabase.from('ai_agents').update({ status: next }).eq('id', agent.id)
        if (error) return toast.push('error', error.message)
        setAgents(s => s.map(a => a.id === agent.id ? { ...a, status: next } : a))
        toast.push('success', `Agente ${next === 'ativo' ? 'ativado' : 'pausado'}.`)
    }

    const activateAll = async () => {
        if (demo) { toast.push('info', 'Modo demo — sem efeito real.'); return }
        const { error } = await supabase.from('ai_agents').update({ status: 'ativo' }).neq('status', 'ativo')
        if (error) return toast.push('error', error.message)
        toast.push('success', 'Todos os agentes foram ativados.')
        load()
    }

    const agentStats = (agentId: string) => {
        if (demo) return DEMO.agentStats[agentId] ?? { done: 0, failed: 0, cost: 0 }
        const agTasks = tasks.filter(t => t.ai_agents?.name === agents.find(a => a.id === agentId)?.name)
        return {
            done: agTasks.filter(t => t.status === 'concluida').length,
            failed: agTasks.filter(t => t.status === 'cancelada').length,
            cost: 0,
        }
    }

    const recentTasks = demo
        ? DEMO.tasks.map((t, i) => ({ ...t, id: `t${i}`, title: 'Tarefa de IA', error_message: null, started_at: null, finished_at: null, created_at: new Date(Date.now() - i * 3600000).toISOString(), leads: null }))
        : tasks

    return (
        <>
            <PageHeader
                title="Agentes de IA"
                description="Centro de controlo dos agentes especializados. Ative, configure e monitorize cada agente."
                actions={agents.some(a => a.status !== 'ativo') ? <Button size="sm" onClick={activateAll}><Play className="h-3.5 w-3.5" /> Ativar todos</Button> : undefined}
            />

            {/* Info banner */}
            <div className={cn('mb-5 flex items-start gap-3 rounded-xl border px-4 py-3', isConfigured ? 'border-green-500/20 bg-green-500/[0.05]' : 'border-white/[0.08] bg-white/[0.02]')}>
                <Cpu className="mt-0.5 h-4 w-4 shrink-0 text-brand-soft" />
                <p className="text-xs text-white/60">
                    {isConfigured
                        ? <><strong className="text-green-400">✓ IA pronta</strong> — agente MKON no servidor ligado. Ative um agente e clique em “Executar tarefa”.</>
                        : <>Os agentes requerem a chave <strong className="text-white/80">FreeLLMAPI</strong> configurada em <strong className="text-white/80">Administração → Integrações</strong>.</>
                    }
                </p>
            </div>

            {/* Agentes */}
            {loading ? (
                <div className="space-y-3">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}</div>
            ) : agents.length === 0 ? (
                <Card><EmptyState icon={<Bot className="h-5 w-5" />} title="Nenhum agente configurado" description="Os agentes são criados automaticamente ao aplicar o schema da base de dados." /></Card>
            ) : (
                <div className="space-y-3">
                    {agents.map(agent => {
                        const cfg = statusConfig[agent.status] ?? statusConfig.inativo
                        const stats = agentStats(agent.id)
                        const agTasks = recentTasks.filter(t => t.ai_agents?.name === agent.name)
                        const expanded = expandedAgent === agent.id
                        return (
                            <Card key={agent.id}>
                                <div className="flex items-start gap-4 p-5">
                                    <div className={cn('mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border', agent.status === 'ativo' ? 'border-green-500/30 bg-green-500/10' : agent.status === 'erro' ? 'border-red-500/30 bg-red-500/10' : 'border-white/10 bg-white/[0.04]')}>
                                        <Bot className={cn('h-5 w-5', agent.status === 'ativo' ? 'text-green-400' : agent.status === 'erro' ? 'text-red-400' : 'text-white/40')} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="text-sm font-semibold">{agent.name}</h3>
                                            <Badge tone={cfg.tone}>{cfg.label}</Badge>
                                            <span className="text-[11px] text-white/30">{modelForAgent(agent)}</span>
                                        </div>
                                        <p className="mt-1 text-xs text-white/50">{agent.description}</p>
                                        <div className="mt-3 flex items-center gap-4 text-[11px] text-white/35">
                                            <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-green-400/70" />{stats.done} concluídas</span>
                                            <span className="flex items-center gap-1"><AlertCircle className="h-3 w-3 text-red-400/70" />{stats.failed} falhadas</span>
                                            <span className="flex items-center gap-1"><Zap className="h-3 w-3" />Limite: {agent.daily_task_limit}/dia</span>
                                            <span className="flex items-center gap-1"><BarChart3 className="h-3 w-3" />€{agent.monthly_budget_eur}/mês</span>
                                        </div>
                                        {agent.last_error && <p className="mt-2 text-[11px] text-red-300">Erro: {agent.last_error}</p>}
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                        <Button variant="ghost" size="sm" onClick={() => setExpandedAgent(expanded ? null : agent.id)}>
                                            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        </Button>
                                        {isConfigured && <RunTaskButton agent={agent} onDone={load} disabled={!demo && agent.status !== 'ativo'} />}
                                        <Button size="sm" variant={agent.status === 'ativo' ? 'outline' : 'primary'} onClick={() => toggleStatus(agent)}>
                                            {agent.status === 'ativo' ? <><Pause className="h-3.5 w-3.5" /> Pausar</> : <><Play className="h-3.5 w-3.5" /> Ativar</>}
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => setEditAgent(agent)}>Configurar</Button>
                                    </div>
                                </div>
                                {expanded && (
                                    <div className="border-t border-white/[0.06] px-5 py-3">
                                        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-white/30">Tarefas recentes</p>
                                        {agTasks.length === 0 ? (
                                            <p className="text-xs text-white/30">Nenhuma tarefa registada.</p>
                                        ) : (
                                            <div className="space-y-1.5">
                                                {agTasks.slice(0, 5).map((t, i) => (
                                                    <div key={t.id ?? i} className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.05] px-3 py-2">
                                                        <div className="min-w-0">
                                                            <p className="truncate text-xs">{t.title}</p>
                                                            {t.leads?.companies?.name && <p className="text-[11px] text-white/35">{t.leads.companies.name}</p>}
                                                        </div>
                                                        <div className="flex shrink-0 items-center gap-2">
                                                            <Badge tone={taskStatus[t.status]?.tone ?? 'neutral'}>{taskStatus[t.status]?.label ?? t.status}</Badge>
                                                            <span className="text-[11px] text-white/25">{relativeTime(t.created_at)}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </Card>
                        )
                    })}
                </div>
            )}

            {/* Tarefas recentes globais */}
            <div className="mt-6">
                <Card>
                    <CardHeader title="Todas as tarefas recentes" subtitle="Últimas 50 execuções" />
                    {loading ? <Skeleton className="h-24 m-4" /> : recentTasks.length === 0 ? (
                        <EmptyState icon={<Clock className="h-5 w-5" />} title="Sem tarefas" description="As tarefas aparecem aqui quando os agentes estiverem ativos." />
                    ) : (
                        <div className="divide-y divide-white/[0.05]">
                            {recentTasks.slice(0, 10).map((t, i) => (
                                <div key={t.id ?? i} className="flex items-center justify-between gap-4 px-5 py-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm">{t.title}</p>
                                        <p className="text-xs text-white/35">{t.ai_agents?.name} {t.leads?.companies?.name ? `· ${t.leads.companies.name}` : ''}</p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                        <Badge tone={taskStatus[t.status]?.tone ?? 'neutral'}>{taskStatus[t.status]?.label ?? t.status}</Badge>
                                        <span className="text-[11px] text-white/25">{relativeTime(t.created_at)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>

            <EditAgentModal agent={editAgent} onClose={() => setEditAgent(null)} onSaved={load} />
        </>
    )
}

/* ── Run Task inline ── */
function RunTaskButton({ agent, onDone, disabled }: { agent: Agent; onDone: () => void; disabled?: boolean }) {
    const toast = useToast()
    const [open, setOpen] = useState(false)
    const [task, setTask] = useState('')
    const [running, setRunning] = useState(false)
    const [result, setResult] = useState('')
    const [via, setVia] = useState('')
    const demo = isDemoActive()

    const close = () => { setOpen(false); setResult(''); setVia(''); setTask('') }

    const run = async () => {
        if (!task.trim()) return
        setRunning(true); setResult(''); setVia('')

        // Proteções: botão de emergência e limite diário
        if (!demo) {
            const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
            const [ks, today] = await Promise.all([
                supabase.from('system_settings').select('value').eq('key', 'automation_kill_switch').maybeSingle(),
                supabase.from('ai_tasks').select('id', { count: 'exact', head: true }).eq('agent_id', agent.id).gte('created_at', startOfDay.toISOString()),
            ])
            if (ks.data?.value === true) { toast.push('error', 'Botão de emergência ativo: os agentes estão parados.'); setRunning(false); return }
            if ((today.count ?? 0) >= agent.daily_task_limit) { toast.push('error', `${agent.name} atingiu o limite diário (${agent.daily_task_limit} tarefas).`); setRunning(false); return }
        }

        const startedAt = new Date().toISOString()
        try {
            const r = await runAgentOnServer(agent.code, task)
            setResult(r.reply)
            setVia(r.tools_used?.length ? `ferramentas: ${r.tools_used.join(', ')}` : 'agente MKON')

            if (!demo) {
                const { data: row, error } = await supabase.from('ai_tasks').insert({
                    agent_id: agent.id, title: task.slice(0, 100), status: 'concluida',
                    input: { prompt: task }, output: { reply: r.reply, tools_used: r.tools_used },
                    started_at: startedAt, finished_at: new Date().toISOString(),
                }).select('id').single()
                if (error) toast.push('info', `Resposta obtida, mas o registo da tarefa falhou: ${error.message}`)
                await supabase.from('ai_usage').insert({
                    agent_id: agent.id, task_id: row?.id ?? null,
                    provider: 'mkon-agent',
                    model: 'mkon-agent', input_tokens: 0, output_tokens: 0, cost_eur: 0,
                })
                if (agent.last_error) await supabase.from('ai_agents').update({ last_error: null }).eq('id', agent.id)
                onDone()
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Erro ao executar tarefa.'
            toast.push('error', msg)
            if (!demo) {
                await supabase.from('ai_tasks').insert({
                    agent_id: agent.id, title: task.slice(0, 100), status: 'cancelada',
                    input: { prompt: task }, error_message: msg, started_at: startedAt, finished_at: new Date().toISOString(),
                })
                await supabase.from('ai_agents').update({ last_error: msg }).eq('id', agent.id)
                onDone()
            }
        } finally { setRunning(false) }
    }

    return (
        <>
            <Button size="sm" variant="outline" disabled={disabled} title={disabled ? 'Ative o agente para executar tarefas' : undefined} onClick={() => setOpen(true)}>
                <Send className="h-3.5 w-3.5" /> Executar tarefa
            </Button>
            <Modal open={open} onClose={close} title={`Executar — ${agent.name}`}
                footer={<><Button variant="ghost" onClick={close}>Fechar</Button><Button onClick={run} loading={running} disabled={!task.trim()}><Send className="h-4 w-4" /> Executar</Button></>}>
                <div className="space-y-3">
                    <p className="text-xs text-white/50">{agent.description}</p>
                    <Field label="Descreva a tarefa">
                        <textarea value={task} onChange={e => setTask(e.target.value)} rows={3} placeholder="Ex: Analisa a empresa X e sugere abordagem comercial..." className="input w-full resize-none" />
                    </Field>
                    {running && (
                        <div className="flex items-center gap-2 text-xs text-white/40">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> A executar…
                        </div>
                    )}
                    {result && (
                        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-white/30">Resultado{via ? ` · ${via}` : ''}</p>
                            <p className="text-sm leading-relaxed text-white/80 whitespace-pre-wrap">{result}</p>
                        </div>
                    )}
                </div>
            </Modal>
        </>
    )
}

function EditAgentModal({ agent, onClose, onSaved }: { agent: Agent | null; onClose: () => void; onSaved: () => void }) {
    const toast = useToast()
    const [form, setForm] = useState({ daily_task_limit: '', monthly_budget_eur: '', model: '' })
    const [busy, setBusy] = useState(false)
    const demo = isDemoActive()

    useEffect(() => {
        if (!agent) return
        setForm({ daily_task_limit: String(agent.daily_task_limit), monthly_budget_eur: String(agent.monthly_budget_eur), model: isFreeLlmModel(agent.model) ? agent.model : 'auto' })
    }, [agent])

    const save = async (e: React.FormEvent) => {
        e.preventDefault()
        if (demo) { toast.push('info', 'Modo demo.'); onClose(); return }
        if (!agent) return
        setBusy(true)
        const { error } = await supabase.from('ai_agents').update({
            daily_task_limit: Number(form.daily_task_limit),
            monthly_budget_eur: Number(form.monthly_budget_eur),
            model: form.model,
            provider: 'freellmapi',
        }).eq('id', agent.id)
        setBusy(false)
        if (error) return toast.push('error', error.message)
        toast.push('success', 'Configurações guardadas.')
        onSaved(); onClose()
    }

    return (
        <Modal open={!!agent} onClose={onClose} title={`Configurar — ${agent?.name}`} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" form="edit-agent" loading={busy}>Guardar</Button></>}>
            <form id="edit-agent" onSubmit={save} className="space-y-4">
                <Field label="Modelo" hint="Com a chave unificada FreeLLMAPI o encaminhamento é automático.">
                    <select className="input" value={isFreeLlmModel(form.model) ? form.model : 'auto'} onChange={e => setForm(f => ({ ...f, model: e.target.value }))}>
                        <optgroup label="FreeLLMAPI (chave unificada)">
                            {FREELLM_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                        </optgroup>
                    </select>
                </Field>
                <Field label="Limite diário de tarefas"><input className="input" type="number" min="0" value={form.daily_task_limit} onChange={e => setForm(f => ({ ...f, daily_task_limit: e.target.value }))} /></Field>
                <Field label="Orçamento mensal (€)"><input className="input" type="number" min="0" step="0.01" value={form.monthly_budget_eur} onChange={e => setForm(f => ({ ...f, monthly_budget_eur: e.target.value }))} /></Field>
            </form>
        </Modal>
    )
}
