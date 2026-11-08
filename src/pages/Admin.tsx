import { useCallback, useEffect, useRef, useState } from 'react'
import { Bot, Database, FlaskConical, KeyRound, ListChecks, Plug, ScrollText, ShieldAlert, Workflow, Download, Upload, Info, Eye, EyeOff, CheckCircle2, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/log'
import { Badge, Button, Card, CardHeader, EmptyState, Field, Modal, PageHeader, Skeleton } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { cn, dateTime } from '@/lib/utils'
import { isDemoActive, DEMO } from '@/lib/demo'
import { getApiKey, setApiKey, hasApiKey, API_KEY_META, detectProviderFromKey, getUniversalUrl, setUniversalUrl, type ApiKeyId } from '@/lib/apikeys'
import { effectiveModel } from '@/lib/llm'
import { isAiReady } from '@/lib/ai'
import Agentes from '@/pages/Agentes'

type Tab = 'integracoes' | 'agentes' | 'automacao' | 'logs' | 'dados' | 'definicoes'
const TABS: { key: Tab; label: string; icon: typeof Plug }[] = [
  { key: 'integracoes', label: 'Integrações', icon: Plug },
  { key: 'agentes', label: 'Agentes', icon: Bot },
  { key: 'automacao', label: 'Automação', icon: Workflow },
  { key: 'logs', label: 'Logs', icon: ScrollText },
  { key: 'dados', label: 'Dados e RGPD', icon: Database },
  { key: 'definicoes', label: 'Definições', icon: ListChecks },
]

export default function Admin() {
  const [tab, setTab] = useState<Tab>('integracoes')
  const demo = isDemoActive()
  return (
    <>
      <PageHeader title="Administração" description="Controlo total do sistema. Acesso exclusivo do proprietário." />
      {demo && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-brand/25 bg-brand/[0.06] px-4 py-2.5 text-xs text-brand-soft">
          <FlaskConical className="h-4 w-4 shrink-0" />
          Modo demonstração — configurações e alterações não têm efeito real.
        </div>
      )}
      <div className="mb-5 flex flex-wrap gap-1 border-b border-white/[0.06]">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)} aria-pressed={tab === key}
            className={cn('-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] transition', tab === key ? 'border-brand text-brand-soft' : 'border-transparent text-white/50 hover:text-snow')}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>
      {tab === 'integracoes' && <Integrations />}
      {tab === 'agentes' && <Agents />}
      {tab === 'automacao' && <Automation />}
      {tab === 'logs' && <Logs />}
      {tab === 'dados' && <DataTools />}
      {tab === 'definicoes' && <Settings />}
    </>
  )
}

/* ------------------------------------------------------------------ */
type Integration = { id: string; provider: string; name: string; description: string | null; status: string; monthly_limit: number | null; last_checked_at: string | null; last_error: string | null; secret_ref: string | null }
const STATUS: Record<string, { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' }> = {
  aguardando_configuracao: { label: 'Aguardando configuração', tone: 'warning' },
  configurada: { label: 'Configurada (por validar)', tone: 'neutral' },
  conectada: { label: 'Conectada', tone: 'success' },
  erro: { label: 'Erro', tone: 'danger' },
  desativada: { label: 'Desativada', tone: 'neutral' },
}
/* ── API Key Row ── */
function ApiKeyRow({ id, onSaved }: { id: ApiKeyId; onSaved?: () => void }) {
  const toast = useToast()
  const meta = API_KEY_META[id]
  const [value, setValue] = useState(() => getApiKey(id))
  const [show, setShow] = useState(false)
  const [saved, setSaved] = useState(() => hasApiKey(id))

  const save = () => {
    setApiKey(id, value)
    setSaved(hasApiKey(id))
    onSaved?.()
    toast.push('success', saved && !value.trim() ? `${meta.label} removida.` : `${meta.label} guardada localmente.`)
  }

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <label className="label flex items-center gap-1.5">
          {meta.label}
          {saved && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
        </label>
        <div className="relative">
          <input
            type={show ? 'text' : 'password'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={meta.placeholder}
            className="input pr-9 font-mono text-xs"
            autoComplete="off"
          />
          <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70">
            {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
      <Button size="sm" variant={saved ? 'outline' : 'primary'} onClick={save} className="mb-px shrink-0">
        {saved ? 'Atualizar' : 'Guardar'}
      </Button>
    </div>
  )
}

/* ── Universal API Key: chave única com detecção automática + URL universal ── */
function UniversalApiKeyPanel() {
  const toast = useToast()
  const [value, setValue] = useState(() => getApiKey('universal'))
  const [show, setShow] = useState(false)
  const [saved, setSaved] = useState(() => hasApiKey('universal'))
  const [url, setUrl] = useState(() => getUniversalUrl())
  const [testing, setTesting] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null)
  const [detected, setDetected] = useState(() => value ? detectProviderFromKey(value) : null)

  const save = () => {
    setApiKey('universal', value)
    setSaved(hasApiKey('universal'))
    setUniversalUrl(url)
    setDetected(value ? detectProviderFromKey(value) : null)
    setStatus(null)
    toast.push('success', saved && !value.trim() ? 'Chave removida.' : 'Chave e URL guardadas localmente.')
  }

  const onKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setValue(newValue)
    setDetected(newValue ? detectProviderFromKey(newValue) : null)
  }

  const test = async () => {
    if (!value.trim()) {
      toast.push('error', 'Adicione uma chave primeiro.')
      return
    }
    setTesting(true)
    setStatus(null)
    
    try {
      const detected = detectProviderFromKey(value)
      let testUrl = url.trim()
      
      if (!testUrl) {
        if (detected.provider === 'groq') testUrl = 'https://api.groq.com/openai/v1'
        else if (detected.provider === 'openai') testUrl = 'https://api.openai.com/v1'
        else if (detected.provider === 'gemini') testUrl = 'https://generativelanguage.googleapis.com'
        else testUrl = 'https://api.openai.com/v1'
      }

      if (detected.provider === 'groq') {
        const res = await fetch(`${testUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${value}` },
          body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: 'ping' }], max_tokens: 8, temperature: 0 }),
        })
        setStatus({ ok: res.ok, message: res.ok ? 'Conexão estabelecida com sucesso!' : `Erro: ${res.status}` })
      } else if (detected.provider === 'openai' || detected.provider === 'universal') {
        const res = await fetch(`${testUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${value}` },
          body: JSON.stringify({ model: 'gpt-3.5-turbo', messages: [{ role: 'user', content: 'ping' }], max_tokens: 8, temperature: 0 }),
        })
        setStatus({ ok: res.ok, message: res.ok ? 'Conexão estabelecida com sucesso!' : `Erro: ${res.status}` })
      } else if (detected.provider === 'gemini') {
        const res = await fetch(`${testUrl}/v1beta/models/gemini-2.0-flash:generateContent?key=${value}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'ping' }] }], generationConfig: { maxOutputTokens: 8, temperature: 0 } }),
        })
        setStatus({ ok: res.ok, message: res.ok ? 'Conexão estabelecida com sucesso!' : `Erro: ${res.status}` })
      } else {
        setStatus({ ok: false, message: 'Tipo de chave não suportado para teste automático.' })
      }
    } catch (error) {
      setStatus({ ok: false, message: `Erro ao conectar: ${error instanceof Error ? error.message : 'Desconhecido'}` })
    }
    
    setTesting(false)
  }

  return (
    <div className="space-y-3 rounded-xl border border-brand/25 bg-brand/[0.05] p-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">Chave Universal de IA</span>
        <Badge tone="brand">Universal</Badge>
        <span className="text-[11px] text-white/40">Cole qualquer chave API - o sistema detecta automaticamente o provedor.</span>
      </div>
      
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="label flex items-center gap-1.5">
            Chave API
            {saved && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
            {detected && <span className="text-[10px] text-white/50">{detected.label}</span>}
          </label>
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={value}
              onChange={onKeyChange}
              placeholder="Cole qualquer chave API (OpenAI, Groq, Gemini, etc.)"
              className="input pr-9 font-mono text-xs"
              autoComplete="off"
            />
            <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70">
              {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
        <Button size="sm" variant={saved ? 'outline' : 'primary'} onClick={save} className="mb-px shrink-0">
          {saved ? 'Atualizar' : 'Guardar'}
        </Button>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="label">URL da API (opcional)</label>
          <input 
            value={url} 
            onChange={(e) => setUrl(e.target.value)} 
            placeholder="https://api.openai.com/v1 (ou deixe vazio para usar URL padrão)" 
            className="input font-mono text-xs" 
            autoComplete="off" 
          />
        </div>
        <Button size="sm" onClick={test} loading={testing} className="mb-px shrink-0">Testar ligação</Button>
      </div>

      <p className="text-[11px] leading-relaxed text-white/40">
        O sistema detecta automaticamente o provedor (OpenAI, Groq, Gemini, Anthropic, etc.) pelo formato da chave. Você pode configurar uma URL customizada para usar proxies ou endpoints alternativos.
      </p>
      
      {status && (
        <p className={cn('rounded-lg border px-3 py-2 text-xs', status.ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300')}>
          {status.ok ? '✓ ' : '✕ '}{status.message}
        </p>
      )}
    </div>
  )
}

function Integrations() {
  const toast = useToast()
  const demo = isDemoActive()
  const [items, setItems] = useState<Integration[] | null>(null)
  const [edit, setEdit] = useState<Integration | null>(null)
  const [limit, setLimit] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (demo) { setItems(DEMO.integrations as Integration[]); return }
    const { data, error } = await supabase.from('integrations').select('id, provider, name, description, status, monthly_limit, last_checked_at, last_error, secret_ref').order('name')
    if (error) toast.push('error', error.message); else setItems((data ?? []) as Integration[])
  }, [toast, demo])
  useEffect(() => { load() }, [load])

  const open = (i: Integration) => { setEdit(i); setLimit(i.monthly_limit?.toString() ?? '') }
  const save = async () => {
    if (!edit) return
    if (demo) { toast.push('info', 'Modo demo — alteração não guardada.'); setEdit(null); return }
    setBusy(true)
    const { error } = await supabase.from('integrations').update({ monthly_limit: limit ? Number(limit) : null }).eq('id', edit.id)
    setBusy(false)
    if (error) return toast.push('error', error.message)
    toast.push('success', 'Limite guardado.'); setEdit(null); load()
  }
  const saveStatus = async (status: string) => {
    if (!edit) return
    if (demo) { toast.push('info', 'Modo demo — estado não alterado.'); return }
    const { error } = await supabase.from('integrations').update({ status, last_checked_at: new Date().toISOString(), last_error: null }).eq('id', edit.id)
    if (error) return toast.push('error', error.message)
    await logActivity('integration.status_changed', 'integrations', edit.id, { provider: edit.provider, status })
    setEdit(null); load()
  }

  if (!items) return <div className="grid gap-3 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>

  // Determine which API key IDs map to supabase providers
  const providerKeyMap: Record<string, ApiKeyId | undefined> = {
    openai: 'universal', google_places: 'google_places', google_business: undefined,
    whatsapp: 'whatsapp', email: undefined, n8n: 'n8n', hosting: undefined,
  }

  return (
    <>
      {/* ── AI Keys section ── */}
      <Card className="mb-6">
        <CardHeader
          title="Chaves de IA"
          subtitle="Chave universal com detecção automática de provedor. Guardadas apenas no seu browser."
        />
        <div className="space-y-4 p-5">
          <div className="flex items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-white/45">
            <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-soft" />
            As chaves são armazenadas em <code className="font-mono">localStorage</code> do seu browser. Nunca saem do seu dispositivo.
          </div>
          <UniversalApiKeyPanel />
        </div>
      </Card>

      {/* ── Other integrations ── */}
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 text-xs leading-relaxed text-white/55">
        <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-brand-soft" />
        <span>As chaves abaixo também são guardadas <strong className="text-white/80">apenas no seu browser</strong>. O estado "Conectada" deve ser marcado após validar cada integração.</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((i) => {
          const keyId = providerKeyMap[i.provider]
          return (
            <Card key={i.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-sm font-semibold">{i.name}</p><p className="mt-0.5 text-xs text-white/40">{i.description}</p></div>
                <Badge tone={STATUS[i.status]?.tone}>{STATUS[i.status]?.label ?? i.status}</Badge>
              </div>
              {keyId && (
                <div className="mt-3 border-t border-white/[0.06] pt-3">
                  <ApiKeyRow id={keyId} />
                  <a href={API_KEY_META[keyId].url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[10px] text-brand-soft/70 hover:text-brand-soft">
                    Obter chave <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
              )}
              {i.last_error && <p className="mt-1 text-[11px] text-red-300">{i.last_error}</p>}
              <div className="mt-3"><Button size="sm" variant="outline" onClick={() => open(i)}>Estado e limites</Button></div>
            </Card>
          )
        })}
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.name ?? ''} footer={<><Button variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button><Button onClick={save} loading={busy}>Guardar limite</Button></>}>
        {edit && (
          <div className="space-y-4">
            <Field label="Limite de custo mensal (€)" hint="Usado para controlar o custo de APIs."><input type="number" min="0" step="0.01" className="input" value={limit} onChange={(e) => setLimit(e.target.value)} /></Field>
            <div className="rounded-lg border border-white/[0.07] p-3 text-xs leading-relaxed text-white/55">
              <p className="mb-1 font-medium text-white/80">Estado da integração</p>
              Marque como "Configurada" após adicionar a chave, e "Conectada" após validar a ligação real com o serviço.
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => saveStatus('configurada')}>Marcar configurada</Button>
              <Button size="sm" variant="outline" onClick={() => saveStatus('conectada')}>Marcar conectada</Button>
              <Button size="sm" variant="outline" onClick={() => saveStatus('aguardando_configuracao')}>Aguardando config.</Button>
              <Button size="sm" variant="ghost" onClick={() => saveStatus('desativada')}>Desativar</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

/* ------------------------------------------------------------------ */
type Agent = { id: string; code: string; name: string; description: string; status: string; model: string; provider: string; daily_task_limit: number; monthly_budget_eur: number; last_error: string | null }
function Agents() {
  const toast = useToast()
  const [agents, setAgents] = useState<Agent[] | null>(null)
  const [stats, setStats] = useState<Record<string, { done: number; failed: number; cost: number }>>({})
  const [edit, setEdit] = useState<Agent | null>(null)
  const [form, setForm] = useState({ model: '', daily: '', budget: '' })
  const [openAiReady, setOpenAiReady] = useState(false)
  const aiReady = isAiReady()

  const demo = isDemoActive()
  const load = useCallback(async () => {
    if (demo) {
      setAgents(DEMO.agents as Agent[])
      setStats(Object.fromEntries(DEMO.agents.map((ag) => [ag.id, DEMO.agentStats[ag.id] ?? { done: 0, failed: 0, cost: 0 }])))
      setOpenAiReady(false)
      return
    }
    const [a, t, u, i] = await Promise.all([
      supabase.from('ai_agents').select('id, code, name, description, status, model, provider, daily_task_limit, monthly_budget_eur, last_error').order('sort_order'),
      supabase.from('ai_tasks').select('agent_id, status'),
      supabase.from('ai_usage').select('agent_id, cost_eur'),
      supabase.from('integrations').select('status').eq('provider', 'openai').maybeSingle(),
    ])
    setAgents((a.data ?? []) as Agent[])
    const s: Record<string, { done: number; failed: number; cost: number }> = {}
      ; (t.data ?? []).forEach((x) => { s[x.agent_id] ??= { done: 0, failed: 0, cost: 0 }; if (x.status === 'concluida') s[x.agent_id].done++; if (x.status === 'cancelada') s[x.agent_id].failed++ })
      ; (u.data ?? []).forEach((x) => { if (x.agent_id) { s[x.agent_id] ??= { done: 0, failed: 0, cost: 0 }; s[x.agent_id].cost += Number(x.cost_eur) } })
    setStats(s); setOpenAiReady(i.data?.status === 'conectada')
  }, [demo])
  useEffect(() => { load() }, [load])

  const setStatus = async (a: Agent, status: string) => {
    if (demo) { toast.push('info', 'Modo demo — estado não alterado.'); return }
    const { error } = await supabase.from('ai_agents').update({ status }).eq('id', a.id)
    if (error) return toast.push('error', error.message)
    toast.push('success', `${a.name}: ${status}.`); load()
  }
  const openEdit = (a: Agent) => { setEdit(a); setForm({ model: a.model, daily: String(a.daily_task_limit), budget: String(a.monthly_budget_eur) }) }
  const save = async () => {
    if (!edit) return
    if (demo) { toast.push('info', 'Modo demo — alteração não guardada.'); setEdit(null); return }
    const { error } = await supabase.from('ai_agents').update({ model: form.model.trim(), daily_task_limit: Number(form.daily), monthly_budget_eur: Number(form.budget) }).eq('id', edit.id)
    if (error) return toast.push('error', error.message)
    toast.push('success', 'Agente atualizado.'); setEdit(null); load()
  }

  if (!agents) return <Skeleton className="h-64" />
  return (
    <>
      {!aiReady && !openAiReady && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] p-3 text-xs text-amber-100/90">
          <Info className="mt-0.5 h-4 w-4 shrink-0" /> Sem chave de IA. Adicione a chave <strong>Universal</strong> em Integrações: sem ela os agentes <strong>não executam tarefas</strong>.
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {agents.map((a) => {
          const s = stats[a.id] ?? { done: 0, failed: 0, cost: 0 }
          const total = s.done + s.failed
          return (
            <Card key={a.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-sm font-semibold">{a.name}</p><p className="mt-0.5 text-xs text-white/40">{a.description}</p></div>
                <Badge tone={a.status === 'ativo' ? 'success' : a.status === 'erro' ? 'danger' : 'neutral'}>{a.status}</Badge>
              </div>
              <dl className="mt-3 grid grid-cols-4 gap-2 text-[11px]">
                {[['Modelo', effectiveModel(a.model)], ['Tarefas', total], ['Sucesso', total ? `${Math.round((s.done / total) * 100)}%` : '—'], ['Custo', `${s.cost.toFixed(2)} €`]].map(([k, v]) => (
                  <div key={String(k)}><dt className="text-white/30">{k}</dt><dd className="truncate text-white/70">{v}</dd></div>
                ))}
              </dl>
              {a.last_error && <p className="mt-2 text-[11px] text-red-300">{a.last_error}</p>}
              <div className="mt-3 flex gap-2">
                {a.status === 'ativo' ? <Button size="sm" variant="outline" onClick={() => setStatus(a, 'pausado')}>Pausar</Button> : <Button size="sm" variant="outline" onClick={() => setStatus(a, 'ativo')}>Ativar</Button>}
                <Button size="sm" variant="ghost" onClick={() => openEdit(a)}>Configurar</Button>
              </div>
            </Card>
          )
        })}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={`Configurar — ${edit?.name ?? ''}`} footer={<><Button variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button><Button onClick={save}>Guardar</Button></>}>
        <div className="space-y-3">
          <Field label="Modelo de IA"><input className="input" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></Field>
          <Field label="Limite de tarefas por dia"><input className="input" type="number" min="0" value={form.daily} onChange={(e) => setForm({ ...form, daily: e.target.value })} /></Field>
          <Field label="Orçamento mensal (€)"><input className="input" type="number" min="0" step="0.01" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></Field>
        </div>
      </Modal>
    </>
  )
}

/* ------------------------------------------------------------------ */
function Automation() {
  const toast = useToast()
  const [mode, setMode] = useState<string | null>(null)
  const [kill, setKill] = useState(false)
  useEffect(() => {
    supabase.from('system_settings').select('key, value').in('key', ['automation_mode', 'automation_kill_switch']).then(({ data }) => {
      setMode((data?.find((d) => d.key === 'automation_mode')?.value as string) ?? 'manual')
      setKill(data?.find((d) => d.key === 'automation_kill_switch')?.value === true)
    })
  }, [])
  const choose = async (m: string) => {
    const { error } = await supabase.from('system_settings').upsert({ key: 'automation_mode', value: m })
    if (error) return toast.push('error', error.message)
    setMode(m); await logActivity('automation.mode_changed', 'system_settings', 'automation_mode', { mode: m }); toast.push('success', 'Modo atualizado.')
  }
  const modes = [
    { key: 'manual', title: 'Manual', text: 'A IA prepara as mensagens; o envio é sempre feito manualmente por si.' },
    { key: 'supervisionado', title: 'Supervisionado', text: 'A IA prepara e agenda, mas cada envio exige a sua aprovação.' },
    { key: 'automatico', title: 'Automático', text: 'Apenas automações previamente aprovadas, com consentimento, limites de frequência e opção de cancelamento.' },
  ]
  if (!mode) return <Skeleton className="h-48" />
  return (
    <>
      <div className="mb-8"><Agentes /></div>
      {kill && <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200"><ShieldAlert className="h-4 w-4" /> Botão de emergência ativo — nada é enviado, independentemente do modo.</div>}
      <div className="grid gap-3 md:grid-cols-3">
        {modes.map((m) => (
          <button key={m.key} onClick={() => choose(m.key)} aria-pressed={mode === m.key} className={cn('card p-4 text-left transition', mode === m.key ? 'border-brand/60 bg-brand/[0.06]' : 'hover:border-white/20')}>
            <div className="mb-1 flex items-center justify-between"><span className="text-sm font-semibold">{m.title}</span>{mode === m.key && <Badge tone="brand">Ativo</Badge>}</div>
            <p className="text-xs leading-relaxed text-white/45">{m.text}</p>
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs text-white/35">Regras de automação detalhadas, sequências e canais são configurados na Etapa 3 e Etapa 6. Contactos com oposição registada nunca recebem mensagens comerciais (garantido na base de dados).</p>
      <SkillsPanel />
    </>
  )
}

/* ------------------------------------------------------------------ */
type SkillRow = { id: string; name: string; kind: string; source_url: string | null; content: string; enabled: boolean; created_at: string }

/** Converte um link do GitHub (blob/tree) para o endereço raw, que o browser consegue ler. */
function toRawGithubUrl(input: string): string | null {
  try {
    const u = new URL(input.trim())
    if (u.hostname === 'raw.githubusercontent.com') return u.toString()
    if (u.hostname !== 'github.com') return null
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts.length < 5 || (parts[2] !== 'blob' && parts[2] !== 'tree')) return null
    const [owner, repo, , branch, ...rest] = parts
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${rest.join('/')}`
  } catch { return null }
}

function SkillsPanel() {
  const toast = useToast()
  const [skills, setSkills] = useState<SkillRow[] | null>(null)
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [ghUrl, setGhUrl] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('agent_skills').select('id,name,kind,source_url,content,enabled,created_at').order('created_at', { ascending: false })
    if (error) { toast.push('error', error.message); setSkills([]); return }
    setSkills((data ?? []) as SkillRow[])
  }, [toast])
  useEffect(() => { load() }, [load])

  const addHabilidade = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !text.trim()) return toast.push('error', 'Indique um nome e a instrução.')
    setBusy(true)
    const { error } = await supabase.from('agent_skills').insert({ name: name.trim().slice(0, 120), kind: 'habilidade', content: text.trim().slice(0, 20000) })
    setBusy(false)
    if (error) return toast.push('error', error.message)
    await logActivity('agent_skill.created', 'agent_skills', name.trim(), { kind: 'habilidade' })
    setName(''); setText(''); toast.push('success', 'Habilidade adicionada. O robot passa a usá-la.'); load()
  }

  const addGithub = async (e: React.FormEvent) => {
    e.preventDefault()
    const raw = toRawGithubUrl(ghUrl)
    if (!raw) return toast.push('error', 'Use um link de ficheiro do GitHub (github.com/dono/repo/blob/branch/ficheiro.md).')
    setBusy(true)
    let content = ''
    try {
      const res = await fetch(raw)
      if (!res.ok) throw new Error(`O GitHub devolveu ${res.status}. Só repositórios públicos funcionam sem token.`)
      content = (await res.text()).slice(0, 20000)
    } catch (err) {
      setBusy(false)
      return toast.push('error', err instanceof Error ? err.message : 'Não foi possível ler o ficheiro.')
    }
    const fileName = decodeURIComponent(raw.split('/').pop() ?? 'skill').replace(/\.(md|txt)$/i, '')
    const { error } = await supabase.from('agent_skills').insert({ name: fileName.slice(0, 120), kind: 'github', source_url: ghUrl.trim(), content })
    setBusy(false)
    if (error) return toast.push('error', error.message)
    await logActivity('agent_skill.created', 'agent_skills', fileName, { kind: 'github', source: ghUrl.trim() })
    setGhUrl(''); toast.push('success', 'Skill do GitHub importada.'); load()
  }

  const toggle = async (s: SkillRow) => {
    const { error } = await supabase.from('agent_skills').update({ enabled: !s.enabled }).eq('id', s.id)
    if (error) return toast.push('error', error.message)
    load()
  }

  const remove = async (s: SkillRow) => {
    if (!window.confirm(`Remover "${s.name}"?`)) return
    const { error } = await supabase.from('agent_skills').delete().eq('id', s.id)
    if (error) return toast.push('error', error.message)
    load()
  }

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Adicionar habilidades" subtitle="Ensine o robot a fazer ou saber algo sobre as páginas do sistema." />
        <form onSubmit={addHabilidade} className="space-y-3 p-5">
          <Field label="Nome"><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Criar proposta a partir de uma empresa" /></Field>
          <Field label="Instrução" hint="Descreva passos, regras e onde estão os dados.">
            <textarea className="input w-full resize-none" rows={5} value={text} onChange={e => setText(e.target.value)} />
          </Field>
          <Button type="submit" loading={busy}>Guardar habilidade</Button>
        </form>
      </Card>
      <Card>
        <CardHeader title="Adicionar skill do GitHub" subtitle="Cole o link de um ficheiro .md de um repositório público." />
        <form onSubmit={addGithub} className="space-y-3 p-5">
          <Field label="Link do ficheiro">
            <input className="input" value={ghUrl} onChange={e => setGhUrl(e.target.value)} placeholder="https://github.com/dono/repo/blob/main/skills/SKILL.md" />
          </Field>
          <Button type="submit" loading={busy}>Importar skill</Button>
        </form>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader title="Habilidades e skills" subtitle={`${skills?.filter(s => s.enabled).length ?? 0} ativas`} />
        {!skills ? <div className="p-5"><Skeleton className="h-10" /></div> : skills.length === 0 ? (
          <EmptyState icon={<Workflow className="h-5 w-5" />} title="Sem habilidades" description="As habilidades que adicionar aparecem aqui." />
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {skills.map(s => (
              <div key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm">{s.name} <Badge tone={s.kind === 'github' ? 'brand' : 'neutral'}>{s.kind === 'github' ? 'GitHub' : 'Habilidade'}</Badge></p>
                  <p className="truncate text-xs text-white/35">{s.source_url ?? s.content.slice(0, 120)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => toggle(s)}>{s.enabled ? 'Desativar' : 'Ativar'}</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(s)}>Remover</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------ */
type LogRow = { id: number; action: string; entity_type: string | null; entity_id: string | null; created_at: string; details: unknown }
function Logs() {
  const [rows, setRows] = useState<LogRow[] | null>(null)
  const [entity, setEntity] = useState('')
  const [page, setPage] = useState(0)
  const [detail, setDetail] = useState<LogRow | null>(null)
  const size = 20
  useEffect(() => {
    setRows(null)
    let q = supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).range(page * size, page * size + size - 1)
    if (entity) q = q.eq('entity_type', entity)
    q.then(({ data }) => setRows((data ?? []) as LogRow[]))
  }, [entity, page])
  return (
    <Card>
      <CardHeader title="Registo de auditoria" subtitle="Alterações às tabelas críticas são registadas por triggers e não podem ser editadas." action={
        <select className="input !w-44" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(0) }} aria-label="Filtrar por entidade">
          <option value="">Todas as entidades</option>
          {['companies', 'leads', 'contacts', 'proposals', 'sales', 'customers', 'projects', 'transactions', 'expenses', 'ai_agents', 'integrations', 'system_settings'].map((e) => <option key={e}>{e}</option>)}
        </select>} />
      {!rows ? <div className="space-y-2 p-5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-4" />)}</div> : rows.length === 0 ? (
        <EmptyState icon={<ScrollText className="h-5 w-5" />} title="Sem registos" />
      ) : (
        <div className="divide-y divide-white/[0.05]">
          {rows.map((r) => (
            <button key={r.id} onClick={() => setDetail(r)} className="flex w-full items-center justify-between gap-3 px-5 py-2.5 text-left text-xs hover:bg-white/[0.03]">
              <span className="font-mono text-white/75">{r.action}</span><span className="truncate text-white/30">{r.entity_id}</span><span className="shrink-0 text-white/35">{dateTime(r.created_at)}</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex justify-between border-t border-white/[0.06] px-4 py-2.5">
        <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
        <Button size="sm" variant="ghost" disabled={!rows || rows.length < size} onClick={() => setPage((p) => p + 1)}>Seguinte</Button>
      </div>
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.action ?? ''} wide>
        <pre className="max-h-96 overflow-auto rounded-lg bg-ink p-3 font-mono text-[11px] leading-relaxed text-white/70">{JSON.stringify(detail?.details, null, 2)}</pre>
      </Modal>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
// Ordem respeitando chaves estrangeiras. Colunas geradas não podem ser reinseridas.
const BACKUP_TABLES = [
  'system_settings', 'lead_sources', 'integrations', 'ai_agents', 'products', 'suppliers', 'website_templates', 'automation_rules',
  'companies', 'contacts', 'leads', 'lead_analyses', 'customers', 'proposals', 'proposal_items', 'sales', 'websites',
  'conversations', 'messages', 'orders', 'nfc_devices', 'projects', 'project_tasks', 'expenses', 'transactions', 'ai_tasks', 'notifications',
]
const GENERATED: Record<string, string[]> = { companies: ['normalized_name', 'has_website'], proposal_items: ['line_total'], orders: ['total'] }
const CONFLICT: Record<string, string> = { system_settings: 'key' }

function DataTools() {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<Record<string, Record<string, unknown>[]> | null>(null)
  const [company, setCompany] = useState('')

  const download = (name: string, data: unknown) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url)
  }

  const backup = async () => {
    setBusy(true)
    const out: Record<string, unknown[]> = {}
    for (const t of BACKUP_TABLES) {
      const { data, error } = await supabase.from(t).select('*')
      if (error) { setBusy(false); return toast.push('error', `Falha em ${t}: ${error.message}`) }
      out[t] = data ?? []
    }
    download(`mkon-backup-${new Date().toISOString().slice(0, 10)}.json`, { version: 1, created_at: new Date().toISOString(), tables: out })
    await logActivity('backup.exported', 'system', 'backup', { tables: BACKUP_TABLES.length })
    setBusy(false); toast.push('success', 'Backup exportado. Guarde-o em local seguro (contém dados pessoais).')
  }

  const onFile = async (f: File | undefined) => {
    if (!f) return
    try {
      const json = JSON.parse(await f.text())
      if (!json?.tables) throw new Error('formato')
      setPending(json.tables)
    } catch { toast.push('error', 'Ficheiro de backup inválido.') }
    if (fileRef.current) fileRef.current.value = ''
  }

  const restore = async () => {
    if (!pending) return
    setBusy(true)
    for (const t of BACKUP_TABLES) {
      const rows = (pending[t] ?? []).map((r) => { const c = { ...r }; (GENERATED[t] ?? []).forEach((g) => delete c[g]); return c })
      if (!rows.length) continue
      const { error } = await supabase.from(t).upsert(rows, { onConflict: CONFLICT[t] ?? 'id' })
      if (error) { setBusy(false); setPending(null); return toast.push('error', `Restauro interrompido em ${t}: ${error.message}`) }
    }
    await logActivity('backup.restored', 'system', 'backup')
    setBusy(false); setPending(null); toast.push('success', 'Restauro concluído (registos existentes foram atualizados, nenhum foi apagado).')
  }

  const exportCompany = async () => {
    const term = company.trim()
    if (!term) return
    const { data: comps } = await supabase.from('companies').select('*').or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`)
    if (!comps?.length) return toast.push('info', 'Nenhuma empresa encontrada.')
    const ids = comps.map((c) => c.id)
    const [contacts, leads, conv] = await Promise.all([
      supabase.from('contacts').select('*').in('company_id', ids), supabase.from('leads').select('*').in('company_id', ids), supabase.from('conversations').select('*, messages(*)').in('company_id', ids),
    ])
    download(`mkon-dados-${term.replace(/\W+/g, '_')}.json`, { companies: comps, contacts: contacts.data, leads: leads.data, conversations: conv.data })
    await logActivity('gdpr.export', 'companies', ids.join(','))
    toast.push('success', 'Dados exportados (direito de acesso/portabilidade).')
  }

  const eraseCompany = async () => {
    const term = company.trim()
    if (!term) return
    const { data: comps } = await supabase.from('companies').select('id, name').ilike('name', term)
    if (!comps || comps.length !== 1) return toast.push('info', comps?.length ? 'Seja mais específico: o nome tem de corresponder a uma única empresa.' : 'Nenhuma empresa com esse nome exato.')
    const { error } = await supabase.from('companies').delete().eq('id', comps[0].id)
    if (error) return toast.push('error', error.code === '23503' ? 'Empresa com cliente/propostas associados: por obrigações contabilísticas não pode ser apagada.' : error.message)
    await logActivity('gdpr.erased', 'companies', comps[0].id, { name: comps[0].name })
    toast.push('success', 'Dados da empresa eliminados (direito ao apagamento).'); setCompany('')
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Backup e restauro" subtitle="Exporta/importa os dados de negócio em JSON." />
        <div className="space-y-3 p-5">
          <div className="flex gap-2">
            <Button onClick={backup} loading={busy}><Download className="h-4 w-4" /> Exportar backup</Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> Restaurar…</Button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </div>
          <p className="text-[11px] leading-relaxed text-white/35">O restauro atualiza/insere registos; nunca apaga. Para backups completos e automáticos do PostgreSQL, ative os backups diários do projeto Supabase.</p>
        </div>
      </Card>
      <Card>
        <CardHeader title="Direitos RGPD" subtitle="Acesso, portabilidade e apagamento de dados de uma empresa/contacto." />
        <div className="space-y-3 p-5">
          <Field label="Nome (exportar: parcial; apagar: exato), email ou telefone"><input className="input" value={company} onChange={(e) => setCompany(e.target.value)} /></Field>
          <div className="flex gap-2"><Button variant="outline" onClick={exportCompany}>Exportar dados</Button><Button variant="danger" onClick={eraseCompany}>Eliminar dados</Button></div>
        </div>
      </Card>
      <Modal open={!!pending} onClose={() => setPending(null)} title="Confirmar restauro" footer={<><Button variant="ghost" onClick={() => setPending(null)}>Cancelar</Button><Button onClick={restore} loading={busy}>Restaurar</Button></>}>
        <p className="text-sm text-white/60">Serão inseridos ou atualizados registos de {pending ? Object.keys(pending).length : 0} tabelas a partir do ficheiro. Esta ação fica registada.</p>
      </Modal>
    </div>
  )
}

/* ------------------------------------------------------------------ */
function Settings() {
  const toast = useToast()
  const [tax, setTax] = useState('')
  const [budget, setBudget] = useState('')
  useEffect(() => {
    supabase.from('system_settings').select('key, value').in('key', ['tax_rate_estimate', 'api_monthly_budget_eur']).then(({ data }) => {
      setTax(String(Number(data?.find((d) => d.key === 'tax_rate_estimate')?.value ?? 0.23) * 100))
      setBudget(String(data?.find((d) => d.key === 'api_monthly_budget_eur')?.value ?? 50))
    })
  }, [])
  const save = async () => {
    const t = Number(tax), b = Number(budget)
    if (!(t >= 0 && t <= 100) || !(b >= 0)) return toast.push('error', 'Valores inválidos.')
    const { error } = await supabase.from('system_settings').upsert([{ key: 'tax_rate_estimate', value: t / 100 }, { key: 'api_monthly_budget_eur', value: b }])
    if (error) return toast.push('error', error.message)
    await logActivity('settings.updated', 'system_settings', 'financial')
    toast.push('success', 'Definições guardadas.')
  }
  return (
    <Card className="max-w-xl">
      <CardHeader title="Definições gerais" />
      <div className="space-y-4 p-5">
        <Field label="Taxa de imposto estimada (%)" hint="Usada apenas em estimativas. Valide com o seu contabilista."><input className="input" type="number" min="0" max="100" step="0.1" value={tax} onChange={(e) => setTax(e.target.value)} /></Field>
        <Field label="Orçamento mensal global de APIs (€)"><input className="input" type="number" min="0" step="1" value={budget} onChange={(e) => setBudget(e.target.value)} /></Field>
        <Button onClick={save}>Guardar</Button>
      </div>
    </Card>
  )
}
