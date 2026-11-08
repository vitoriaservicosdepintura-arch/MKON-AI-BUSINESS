import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { CalendarCheck, Plus, CheckCircle2, XCircle, Handshake } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/log'
import { Badge, Button, Card, CardHeader, EmptyState, Field, Modal, PageHeader, Skeleton } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { STAGES, stageLabel, type LeadStage } from '@/lib/constants'
import { dateTime } from '@/lib/utils'
import { loadProspectCompanies, type ProspectCompany } from '@/lib/prospect'

type Meeting = {
  id: string; title: string; scheduled_at: string; status: 'agendada' | 'realizada' | 'cancelada'; notes: string | null
  company_id: string | null; lead_id: string | null
  companies: { name: string } | null
  leads: { stage: LeadStage } | null
}

type Origin = 'prospeccao' | 'crm' | 'novo'

const STATUS: Record<Meeting['status'], { label: string; tone: 'brand' | 'success' | 'danger' }> = {
  agendada: { label: 'Agendada', tone: 'brand' },
  realizada: { label: 'Realizada', tone: 'success' },
  cancelada: { label: 'Cancelada', tone: 'danger' },
}

export default function Reunioes() {
  const toast = useToast()
  const [rows, setRows] = useState<Meeting[] | null>(null)
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('meetings')
      .select('id, title, scheduled_at, status, notes, company_id, lead_id, companies(name), leads(stage)')
      .order('scheduled_at', { ascending: true })
    if (error) { toast.push('error', error.message); setRows([]); return }
    setRows((data ?? []) as unknown as Meeting[])
  }, [toast])
  useEffect(() => { load() }, [load])

  const setStatus = async (m: Meeting, status: Meeting['status'], extra: Record<string, unknown> = {}) => {
    const { error } = await supabase.from('meetings').update({ status, ...extra }).eq('id', m.id)
    if (error) return toast.push('error', error.message)
    await logActivity('meeting.' + status, 'meetings', m.id, { company: m.companies?.name })
    load()
  }

  const markDone = (m: Meeting) => {
    const outcome = window.prompt('Resultado da reunião (opcional):', '') ?? ''
    const notes = [m.notes, outcome.trim() && `Resultado: ${outcome.trim()}`].filter(Boolean).join('\n')
    setStatus(m, 'realizada', { notes: notes || null })
    toast.push('success', 'Reunião marcada como realizada.')
  }

  /** Fecha o pedido: cria a proposta em rascunho e move o lead para Venda fechada. */
  const closeOrder = async (m: Meeting) => {
    if (!m.company_id) return toast.push('error', 'Esta reunião não tem empresa associada.')
    if (!window.confirm(`Fechar pedido com ${m.companies?.name ?? 'o cliente'}? O lead passa a Venda fechada.`)) return
    const number = `PROP-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`
    const { error: pe } = await supabase.from('proposals').insert({
      number, company_id: m.company_id, lead_id: m.lead_id, title: `Pedido — ${m.companies?.name ?? m.title}`,
      status: 'aprovada', total: 0, notes: `Pedido fechado na reunião "${m.title}". Preço a definir.`,
    })
    if (pe) return toast.push('error', pe.message)
    if (m.lead_id) await supabase.from('leads').update({ stage: 'venda_fechada' }).eq('id', m.lead_id)
    await logActivity('order.closed', 'meetings', m.id, { number })
    toast.push('success', `Pedido ${number} criado e lead em Venda fechada.`)
    load()
  }

  return (
    <>
      <PageHeader
        title="Reuniões"
        description="Agende reuniões com clientes. Ao concluir, feche o pedido ou mantenha o lead no CRM."
        actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Agendar reunião</Button>}
      />

      <Card>
        <CardHeader title="Agenda" subtitle="Reuniões por data" />
        {!rows ? <div className="p-5"><Skeleton className="h-16" /></div> : rows.length === 0 ? (
          <EmptyState icon={<CalendarCheck className="h-5 w-5" />} title="Sem reuniões" description="Agende a primeira reunião com um cliente." />
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {rows.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.title}</p>
                  <p className="text-xs text-white/40">
                    {dateTime(m.scheduled_at)} · {m.companies?.name ?? 'Sem empresa'} · CRM: {m.leads ? stageLabel(m.leads.stage) : 'sem lead'}
                  </p>
                  {m.notes && <p className="mt-1 whitespace-pre-line text-[11px] text-white/35">{m.notes}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={STATUS[m.status].tone}>{STATUS[m.status].label}</Badge>
                  {m.status === 'agendada' && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => markDone(m)}><CheckCircle2 className="h-3.5 w-3.5" /> Realizada</Button>
                      <Button size="sm" variant="ghost" onClick={() => setStatus(m, 'cancelada')}><XCircle className="h-3.5 w-3.5" /> Cancelar</Button>
                    </>
                  )}
                  {m.status === 'realizada' && (
                    <Button size="sm" onClick={() => closeOrder(m)}><Handshake className="h-3.5 w-3.5" /> Fechar pedido</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ScheduleModal open={open} onClose={() => setOpen(false)} onSaved={load} />
    </>
  )
}

function ScheduleModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const empty = { title: '', scheduled_at: '', notes: '', stage: 'interessado' as LeadStage, company_id: '', name: '', phone: '', city: '' }
  const [origin, setOrigin] = useState<Origin>('prospeccao')
  const [f, setF] = useState(empty)
  const [busy, setBusy] = useState(false)
  const [prospects, setProspects] = useState<ProspectCompany[]>([])
  const [crm, setCrm] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    if (!open) return
    loadProspectCompanies(200).then(setProspects).catch(() => setProspects([]))
    supabase.from('companies').select('id, name').order('name').limit(500).then(({ data }) => setCrm((data ?? []) as { id: string; name: string }[]))
  }, [open])

  const set = (k: keyof typeof empty) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!f.title.trim() || !f.scheduled_at) return toast.push('error', 'Indique o título e a data da reunião.')
    setBusy(true)
    try {
      // 1. Empresa (da prospecção, do CRM ou nova)
      let companyId = f.company_id || null
      if (origin === 'novo') {
        if (!f.name.trim()) throw new Error('Indique o nome da empresa.')
        const { data: src } = await supabase.from('lead_sources').select('id').eq('code', 'manual').maybeSingle()
        const { data: c, error: ce } = await supabase.from('companies').insert({
          name: f.name.trim(), city: f.city.trim() || null, phone: f.phone.trim() || null, source_id: src?.id ?? null,
        }).select('id').single()
        if (ce) throw new Error(ce.message)
        companyId = c.id
      }
      if (!companyId) throw new Error('Escolha a empresa.')

      // 2. Lead no CRM com a etapa escolhida
      const { data: lead } = await supabase.from('leads').select('id').eq('company_id', companyId).limit(1).maybeSingle()
      let leadId = lead?.id as string | undefined
      if (leadId) {
        await supabase.from('leads').update({ stage: f.stage }).eq('id', leadId)
      } else {
        const { data: nl, error: le } = await supabase.from('leads').insert({ company_id: companyId, stage: f.stage }).select('id').single()
        if (le) throw new Error(le.message)
        leadId = nl.id
      }

      // 3. Reunião
      const { error } = await supabase.from('meetings').insert({
        company_id: companyId, lead_id: leadId, title: f.title.trim(),
        scheduled_at: new Date(f.scheduled_at).toISOString(), notes: f.notes.trim() || null, status: 'agendada',
      })
      if (error) throw new Error(error.message)
      await logActivity('meeting.scheduled', 'meetings', companyId, { title: f.title })
      toast.push('success', 'Reunião agendada e lead enviado para o CRM.')
      setF(empty); onSaved(); onClose()
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : 'Não foi possível agendar.')
    } finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Agendar reunião" wide footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" form="schedule-meeting" loading={busy}>Agendar</Button></>}>
      <form id="schedule-meeting" onSubmit={submit} className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {([['prospeccao', 'Da prospecção'], ['crm', 'Do CRM'], ['novo', 'Adicionar novo lead']] as [Origin, string][]).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setOrigin(k)} aria-pressed={origin === k}
              className={origin === k ? 'rounded-lg border border-brand/50 bg-brand/10 px-3 py-2 text-xs text-brand-soft' : 'rounded-lg border border-white/10 px-3 py-2 text-xs text-white/55 hover:text-snow'}>
              {label}
            </button>
          ))}
        </div>

        {origin === 'prospeccao' && (
          <Field label="Empresa da prospecção" hint={prospects.length === 0 ? 'Ainda não há empresas da prospecção (ou foram limpas).' : undefined}>
            <select className="input" value={f.company_id} onChange={set('company_id')}>
              <option value="">Escolher…</option>
              {prospects.map((p) => <option key={p.id} value={p.id}>{p.name}{p.city ? ` · ${p.city}` : ''}</option>)}
            </select>
          </Field>
        )}
        {origin === 'crm' && (
          <Field label="Empresa do CRM">
            <select className="input" value={f.company_id} onChange={set('company_id')}>
              <option value="">Escolher…</option>
              {crm.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        )}
        {origin === 'novo' && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Nome da empresa"><input className="input" value={f.name} onChange={set('name')} /></Field>
            <Field label="Telefone"><input className="input" value={f.phone} onChange={set('phone')} /></Field>
            <Field label="Cidade"><input className="input" value={f.city} onChange={set('city')} /></Field>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Título"><input className="input" value={f.title} onChange={set('title')} placeholder="Ex.: Apresentação de website" /></Field>
          <Field label="Data e hora"><input type="datetime-local" className="input" value={f.scheduled_at} onChange={set('scheduled_at')} /></Field>
        </div>
        <Field label="Enviar para o CRM como" hint="A etapa do lead no CRM é atualizada ao agendar.">
          <select className="input" value={f.stage} onChange={set('stage')}>
            {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Notas"><textarea rows={3} className="input" value={f.notes} onChange={set('notes')} /></Field>
      </form>
    </Modal>
  )
}
