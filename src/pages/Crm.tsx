import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight, Kanban, List, Plus, Table2, Users, Phone, Mail, Globe, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/log'
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader, Skeleton } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { CATEGORIES, OPPORTUNITY_LABEL, STAGES, opportunityFromScore, stageLabel, type LeadStage } from '@/lib/constants'
import { cn, dateTime, eur, normalizeWebsite, relativeTime } from '@/lib/utils'

type LeadRow = {
  id: string; company_id: string; stage: LeadStage; score: number | null; opportunity: string | null
  estimated_value: number | null; owner_notes: string | null; next_action: string | null; next_action_at: string | null
  lost_reason: string | null; created_at: string; updated_at: string
  companies: { id: string; name: string; category: string | null; city: string | null; region: string | null; address: string | null; phone: string | null; email: string | null; website: string | null } | null
}
type ContactRow = { id: string; full_name: string; role: string | null; email: string | null; phone: string | null; whatsapp: string | null; consent_commercial: boolean; opted_out: boolean }
type View = 'kanban' | 'tabela' | 'lista' | 'calendario'

const VIEWS: { key: View; label: string; icon: typeof Kanban }[] = [
  { key: 'kanban', label: 'Kanban', icon: Kanban },
  { key: 'tabela', label: 'Tabela', icon: Table2 },
  { key: 'lista', label: 'Lista', icon: List },
  { key: 'calendario', label: 'Calendário', icon: CalendarDays },
]
const PAGE_SIZE = 10
const SELECT = 'id, company_id, stage, score, opportunity, estimated_value, owner_notes, next_action, next_action_at, lost_reason, created_at, updated_at, companies(id, name, category, city, region, address, phone, email, website)'

const oppTone = (o: string | null) => (o === 'excelente' ? 'success' : o === 'elevada' ? 'brand' : o === 'moderada' ? 'warning' : 'neutral') as 'success' | 'brand' | 'warning' | 'neutral'

export default function Crm() {
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [view, setView] = useState<View>(() => (localStorage.getItem('mkon.crm.view') as View) || 'kanban')
  const [rows, setRows] = useState<LeadRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState(params.get('q') ?? '')
  const [stageFilter, setStageFilter] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(params.get('novo') === '1')
  const [selected, setSelected] = useState<LeadRow | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [lostFor, setLostFor] = useState<LeadRow | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('leads').select(SELECT).order('updated_at', { ascending: false })
    if (error) setError(error.message)
    else { setRows((data ?? []) as unknown as LeadRow[]); setError(null) }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { try { localStorage.setItem('mkon.crm.view', view) } catch { /* ignore */ } }, [view])
  useEffect(() => { setPage(1) }, [q, stageFilter, catFilter])
  useEffect(() => { if (params.get('q') !== null) setQ(params.get('q') ?? '') }, [params])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return rows.filter((r) =>
      (!stageFilter || r.stage === stageFilter) &&
      (!catFilter || r.companies?.category === catFilter) &&
      (!term || [r.companies?.name, r.companies?.city, r.companies?.email, r.companies?.phone].some((v) => v?.toLowerCase().includes(term))),
    )
  }, [rows, q, stageFilter, catFilter])

  const moveStage = async (lead: LeadRow, stage: LeadStage, lostReason?: string) => {
    if (lead.stage === stage) return
    if (stage === 'perdido' && !lostReason) { setLostFor(lead); return }
    const prev = rows
    setRows((s) => s.map((r) => (r.id === lead.id ? { ...r, stage, lost_reason: lostReason ?? r.lost_reason } : r)))
    const { error } = await supabase.from('leads').update({ stage, ...(lostReason ? { lost_reason: lostReason } : {}) }).eq('id', lead.id)
    if (error) { setRows(prev); return toast.push('error', 'Não foi possível mover o lead: ' + error.message) }
    await logActivity('lead.stage_changed', 'leads', lead.id, { from: lead.stage, to: stage })
    // Venda fechada → garantir registo de cliente
    if (stage === 'venda_fechada') {
      const { error: ce } = await supabase.from('customers').upsert({ company_id: lead.company_id, lead_id: lead.id }, { onConflict: 'company_id' })
      if (ce) toast.push('error', 'Lead movido, mas não foi possível criar o cliente: ' + ce.message)
      else toast.push('success', 'Venda fechada — cliente criado.')
    } else toast.push('success', `Movido para "${stageLabel(stage)}".`)
    if (selected?.id === lead.id) setSelected((s) => (s ? { ...s, stage } : s))
  }

  const onDrop = (stage: LeadStage) => {
    const lead = rows.find((r) => r.id === dragId)
    setDragId(null)
    if (lead) moveStage(lead, stage)
  }

  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

  return (
    <>
      <PageHeader
        title="CRM"
        description="Leads e clientes ao longo de todas as etapas comerciais."
        actions={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Novo lead</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-white/10 p-0.5">
          {VIEWS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setView(key)} aria-pressed={view === key}
              className={cn('flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition', view === key ? 'bg-brand/15 text-brand-soft' : 'text-white/50 hover:text-snow')}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>
        <input value={q} onChange={(e) => { setQ(e.target.value); setParams(e.target.value ? { q: e.target.value } : {}, { replace: true }) }} placeholder="Pesquisar…" className="input !w-52" />
        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className="input !w-44" aria-label="Filtrar por etapa">
          <option value="">Todas as etapas</option>{STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="input !w-44" aria-label="Filtrar por categoria">
          <option value="">Todas as categorias</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <span className="ml-auto text-xs text-white/35">{filtered.length} lead(s)</span>
      </div>

      {error ? (
        <Card><EmptyState icon={<Users className="h-5 w-5" />} title="Erro ao carregar" description={error} /></Card>
      ) : loading ? (
        <div className="grid gap-3 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={<Users className="h-5 w-5" />} title="Ainda não tem leads" description="Adicione o primeiro manualmente. Na Etapa 2 a prospecção automática alimentará esta lista." action={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Novo lead</Button>} /></Card>
      ) : (
        <>
          {view === 'kanban' && (
            <div className="-mx-4 overflow-x-auto px-4 pb-3 md:-mx-6 md:px-6">
              <div className="flex gap-3">
                {STAGES.map((s) => {
                  const items = filtered.filter((r) => r.stage === s.key)
                  return (
                    <div key={s.key} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(s.key)} className="w-64 shrink-0 rounded-xl2 border border-white/[0.06] bg-white/[0.02] p-2">
                      <div className="mb-2 flex items-center justify-between px-2 pt-1"><span className="text-xs font-medium text-white/70">{s.label}</span><span className="text-[11px] text-white/30">{items.length}</span></div>
                      <div className="space-y-2">
                        {items.map((r) => (
                          <div key={r.id} draggable onDragStart={() => setDragId(r.id)} onClick={() => setSelected(r)}
                            className="card cursor-grab p-3 text-left transition hover:border-brand/40 active:cursor-grabbing">
                            <p className="truncate text-sm font-medium">{r.companies?.name}</p>
                            <p className="mt-0.5 truncate text-[11px] text-white/40">{[r.companies?.category, r.companies?.city].filter(Boolean).join(' · ') || '—'}</p>
                            <div className="mt-2 flex items-center gap-1.5">
                              {r.score != null && <Badge tone={oppTone(r.opportunity)}>{r.score}</Badge>}
                              {r.estimated_value ? <span className="text-[11px] text-white/40">{eur(r.estimated_value)}</span> : null}
                            </div>
                          </div>
                        ))}
                        {items.length === 0 && <p className="px-2 py-4 text-center text-[11px] text-white/20">Arraste leads para aqui</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {view === 'tabela' && (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead className="border-b border-white/[0.06] text-[11px] uppercase tracking-wider text-white/35">
                    <tr>{['Empresa', 'Categoria', 'Cidade', 'Etapa', 'Pontuação', 'Valor', 'Atualizado'].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {pageRows.map((r) => (
                      <tr key={r.id} onClick={() => setSelected(r)} className="cursor-pointer hover:bg-white/[0.03]">
                        <td className="px-4 py-3 font-medium">{r.companies?.name}</td>
                        <td className="px-4 py-3 text-white/55">{r.companies?.category ?? '—'}</td>
                        <td className="px-4 py-3 text-white/55">{r.companies?.city ?? '—'}</td>
                        <td className="px-4 py-3"><Badge>{stageLabel(r.stage)}</Badge></td>
                        <td className="px-4 py-3">{r.score != null ? <Badge tone={oppTone(r.opportunity)}>{r.score}</Badge> : <span className="text-white/25">—</span>}</td>
                        <td className="px-4 py-3 tabular-nums text-white/55">{r.estimated_value ? eur(r.estimated_value) : '—'}</td>
                        <td className="px-4 py-3 text-white/35">{relativeTime(r.updated_at)}</td>
                      </tr>
                    ))}
                    {pageRows.length === 0 && <tr><td colSpan={7}><EmptyState icon={<Users className="h-5 w-5" />} title="Nenhum resultado" description="Ajuste os filtros." /></td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-2.5 text-xs text-white/40">
                <span>Página {page} de {pages}</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Página seguinte"><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            </Card>
          )}

          {view === 'lista' && (
            <div className="space-y-2">
              {filtered.map((r) => (
                <button key={r.id} onClick={() => setSelected(r)} className="card flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:border-brand/40">
                  <div className="min-w-0"><p className="truncate text-sm font-medium">{r.companies?.name}</p><p className="truncate text-xs text-white/40">{[r.companies?.category, r.companies?.city].filter(Boolean).join(' · ') || '—'}{r.next_action ? ` · Próxima: ${r.next_action}` : ''}</p></div>
                  <div className="flex shrink-0 items-center gap-2">{r.score != null && <Badge tone={oppTone(r.opportunity)}>{r.score}</Badge>}<Badge>{stageLabel(r.stage)}</Badge></div>
                </button>
              ))}
              {filtered.length === 0 && <Card><EmptyState icon={<Users className="h-5 w-5" />} title="Nenhum resultado" /></Card>}
            </div>
          )}

          {view === 'calendario' && <CalendarView rows={filtered} onSelect={setSelected} />}
        </>
      )}

      <CreateLeadModal open={createOpen} onClose={() => { setCreateOpen(false); if (params.get('novo')) setParams({}, { replace: true }) }} onCreated={load} />
      <LeadModal lead={selected} onClose={() => setSelected(null)} onChanged={load} onMove={moveStage} />
      <LostModal lead={lostFor} onClose={() => setLostFor(null)} onConfirm={(reason) => { if (lostFor) moveStage(lostFor, 'perdido', reason); setLostFor(null) }} />
    </>
  )
}

/* ------------------------------------------------------------------ */
function CalendarView({ rows, onSelect }: { rows: LeadRow[]; onSelect: (l: LeadRow) => void }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const year = cursor.getFullYear(), month = cursor.getMonth()
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7
  const days = new Date(year, month + 1, 0).getDate()
  const cells = Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, i) => i - offset + 1)
  const byDay = (d: number) => rows.filter((r) => { if (!r.next_action_at) return false; const x = new Date(r.next_action_at); return x.getFullYear() === year && x.getMonth() === month && x.getDate() === d })
  const unscheduled = rows.filter((r) => !r.next_action_at).length
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold capitalize">{cursor.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}</h3>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="Mês anterior"><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="Mês seguinte"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-white/[0.06]">
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => <div key={d} className="bg-graphite px-2 py-1.5 text-center text-[10px] uppercase tracking-wider text-white/35">{d}</div>)}
        {cells.map((d, i) => (
          <div key={i} className={cn('min-h-[84px] bg-graphite/90 p-1.5', (d < 1 || d > days) && 'opacity-30')}>
            {d >= 1 && d <= days && (<>
              <div className="mb-1 text-[11px] text-white/40">{d}</div>
              {byDay(d).slice(0, 3).map((r) => <button key={r.id} onClick={() => onSelect(r)} className="mb-0.5 block w-full truncate rounded bg-brand/15 px-1.5 py-0.5 text-left text-[10px] text-brand-soft">{r.companies?.name}</button>)}
              {byDay(d).length > 3 && <span className="text-[10px] text-white/30">+{byDay(d).length - 3}</span>}
            </>)}
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-white/30">Mostra a data da próxima ação de cada lead. {unscheduled > 0 && `${unscheduled} lead(s) sem data agendada.`}</p>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
function CreateLeadModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const toast = useToast()
  const empty = { name: '', category: '', city: '', region: '', address: '', phone: '', email: '', website: '', contact: '', value: '' }
  const [f, setF] = useState(empty)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const { data: src } = await supabase.from('lead_sources').select('id').eq('code', 'manual').maybeSingle()
      const { data: company, error: ce } = await supabase.from('companies').insert({
        name: f.name.trim(), category: f.category || null, city: f.city.trim() || null, region: f.region.trim() || null, address: f.address.trim() || null,
        phone: f.phone.trim() || null, email: f.email.trim() || null, website: normalizeWebsite(f.website), source_id: src?.id ?? null,
      }).select('id').single()
      if (ce) {
        toast.push('error', ce.code === '23505' ? 'Esta empresa já existe (nome, cidade e telefone iguais).' : 'Erro ao criar empresa: ' + ce.message)
        return
      }
      const { data: lead, error: le } = await supabase.from('leads').insert({ company_id: company.id, estimated_value: f.value ? Number(f.value) : null }).select('id').single()
      if (le) { toast.push('error', le.code === '23505' ? 'Já existe um lead aberto para esta empresa.' : 'Erro ao criar lead: ' + le.message); return }
      if (f.contact.trim()) await supabase.from('contacts').insert({ company_id: company.id, full_name: f.contact.trim(), email: f.email.trim() || null, phone: f.phone.trim() || null, is_primary: true })
      await logActivity('lead.created', 'leads', lead.id, { company: f.name })
      toast.push('success', 'Lead criado.')
      setF(empty); onClose(); onCreated()
    } finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Novo lead" wide footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" form="create-lead" loading={busy}>Criar lead</Button></>}>
      <form id="create-lead" onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="Nome da empresa *"><input required className="input" value={f.name} onChange={set('name')} /></Field></div>
        <Field label="Categoria"><select className="input" value={f.category} onChange={set('category')}><option value="">—</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Responsável / contacto"><input className="input" value={f.contact} onChange={set('contact')} /></Field>
        <Field label="Cidade"><input className="input" value={f.city} onChange={set('city')} /></Field>
        <Field label="Região"><input className="input" value={f.region} onChange={set('region')} /></Field>
        <div className="sm:col-span-2"><Field label="Morada"><input className="input" value={f.address} onChange={set('address')} /></Field></div>
        <Field label="Telefone comercial"><input className="input" type="tel" value={f.phone} onChange={set('phone')} /></Field>
        <Field label="Email público"><input className="input" type="email" value={f.email} onChange={set('email')} /></Field>
        <Field label="Website" hint="Deixe vazio se a empresa não tem website."><input className="input" value={f.website} onChange={set('website')} placeholder="exemplo.pt" /></Field>
        <Field label="Valor estimado (€)"><input className="input" type="number" min="0" step="0.01" value={f.value} onChange={set('value')} /></Field>
      </form>
    </Modal>
  )
}

function LostModal({ lead, onClose, onConfirm }: { lead: LeadRow | null; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('')
  useEffect(() => { setReason('') }, [lead])
  return (
    <Modal open={!!lead} onClose={onClose} title="Marcar como perdido" footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="danger" disabled={!reason.trim()} onClick={() => onConfirm(reason.trim())}>Confirmar</Button></>}>
      <Field label="Motivo da perda *"><input className="input" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: já tem fornecedor, sem orçamento…" /></Field>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
function LeadModal({ lead, onClose, onChanged, onMove }: { lead: LeadRow | null; onClose: () => void; onChanged: () => void; onMove: (l: LeadRow, s: LeadStage) => void }) {
  const toast = useToast()
  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [logs, setLogs] = useState<{ id: number; action: string; created_at: string }[]>([])
  const [form, setForm] = useState({ next_action: '', next_action_at: '', owner_notes: '', estimated_value: '', score: '' })
  const [newContact, setNewContact] = useState({ full_name: '', email: '', phone: '' })
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!lead) return
    setForm({
      next_action: lead.next_action ?? '', next_action_at: lead.next_action_at ? lead.next_action_at.slice(0, 16) : '',
      owner_notes: lead.owner_notes ?? '', estimated_value: lead.estimated_value?.toString() ?? '', score: lead.score?.toString() ?? '',
    })
    setConfirmDelete(false)
    supabase.from('contacts').select('id, full_name, role, email, phone, whatsapp, consent_commercial, opted_out').eq('company_id', lead.company_id).order('created_at').then(({ data }) => setContacts((data ?? []) as ContactRow[]))
    supabase.from('activity_logs').select('id, action, created_at').eq('entity_type', 'leads').eq('entity_id', lead.id).order('created_at', { ascending: false }).limit(10).then(({ data }) => setLogs(data ?? []))
  }, [lead])

  if (!lead) return null
  const c = lead.companies

  const save = async () => {
    setBusy(true)
    const score = form.score === '' ? null : Math.max(0, Math.min(100, Number(form.score)))
    const { error } = await supabase.from('leads').update({
      next_action: form.next_action.trim() || null,
      next_action_at: form.next_action_at ? new Date(form.next_action_at).toISOString() : null,
      owner_notes: form.owner_notes.trim() || null,
      estimated_value: form.estimated_value ? Number(form.estimated_value) : null,
      score, opportunity: opportunityFromScore(score),
    }).eq('id', lead.id)
    setBusy(false)
    if (error) return toast.push('error', 'Erro ao guardar: ' + error.message)
    toast.push('success', 'Alterações guardadas.')
    onChanged()
  }

  const addContact = async () => {
    if (!newContact.full_name.trim()) return
    const { data, error } = await supabase.from('contacts').insert({ company_id: lead.company_id, full_name: newContact.full_name.trim(), email: newContact.email.trim() || null, phone: newContact.phone.trim() || null })
      .select('id, full_name, role, email, phone, whatsapp, consent_commercial, opted_out').single()
    if (error) return toast.push('error', 'Erro ao adicionar contacto: ' + error.message)
    setContacts((s) => [...s, data as ContactRow]); setNewContact({ full_name: '', email: '', phone: '' })
    await logActivity('contact.created', 'contacts', data.id)
  }

  const setConsent = async (ct: ContactRow, patch: Partial<ContactRow>) => {
    const { error } = await supabase.from('contacts').update({ ...patch, ...(patch.consent_commercial ? { consent_at: new Date().toISOString() } : {}) }).eq('id', ct.id)
    if (error) return toast.push('error', error.message)
    setContacts((s) => s.map((x) => (x.id === ct.id ? { ...x, ...patch } : x)))
    toast.push('success', patch.opted_out ? 'Oposição registada. Este contacto não receberá comunicações comerciais.' : 'Consentimento registado.')
  }

  const remove = async () => {
    const { error } = await supabase.from('leads').delete().eq('id', lead.id)
    if (error) return toast.push('error', 'Erro ao eliminar: ' + error.message)
    await logActivity('lead.deleted', 'leads', lead.id, { company: c?.name })
    toast.push('success', 'Lead eliminado.'); onClose(); onChanged()
  }

  return (
    <Modal open onClose={onClose} title={c?.name ?? 'Lead'} wide footer={<>
      {confirmDelete ? (<><span className="mr-auto self-center text-xs text-red-300">Eliminar este lead?</span><Button variant="ghost" onClick={() => setConfirmDelete(false)}>Não</Button><Button variant="danger" onClick={remove}>Sim, eliminar</Button></>) : (<>
        <Button variant="ghost" className="mr-auto text-red-300" onClick={() => setConfirmDelete(true)}><Trash2 className="h-4 w-4" /> Eliminar</Button>
        <Button variant="ghost" onClick={onClose}>Fechar</Button><Button onClick={save} loading={busy}>Guardar</Button></>)}
    </>}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-white/50">
          {c?.category && <Badge>{c.category}</Badge>}
          {lead.opportunity && <Badge tone={oppTone(lead.opportunity)}>{OPPORTUNITY_LABEL[lead.opportunity]}</Badge>}
          {c?.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
          {c?.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
          {c?.website ? <a href={c.website} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1 text-brand-soft hover:underline"><Globe className="h-3 w-3" />{c.website}</a> : <Badge tone="warning">Sem website</Badge>}
          {(c?.address || c?.city) && <span>{[c.address, c.city, c.region].filter(Boolean).join(', ')}</span>}
        </div>

        <Field label="Etapa comercial">
          <select className="input" value={lead.stage} onChange={(e) => onMove(lead, e.target.value as LeadStage)}>{STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
        </Field>
        {lead.stage === 'perdido' && lead.lost_reason && <p className="text-xs text-red-300">Motivo: {lead.lost_reason}</p>}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Próxima ação"><input className="input" value={form.next_action} onChange={(e) => setForm({ ...form, next_action: e.target.value })} /></Field>
          <Field label="Data da próxima ação"><input type="datetime-local" className="input" value={form.next_action_at} onChange={(e) => setForm({ ...form, next_action_at: e.target.value })} /></Field>
          <Field label="Valor estimado (€)"><input type="number" min="0" step="0.01" className="input" value={form.estimated_value} onChange={(e) => setForm({ ...form, estimated_value: e.target.value })} /></Field>
          <Field label="Pontuação (0–100)" hint="Preenchida automaticamente pela IA na Etapa 2; pode ajustar manualmente."><input type="number" min="0" max="100" className="input" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} /></Field>
        </div>
        <Field label="Notas"><textarea rows={3} className="input" value={form.owner_notes} onChange={(e) => setForm({ ...form, owner_notes: e.target.value })} /></Field>

        <div>
          <p className="label">Contactos e consentimento (RGPD)</p>
          <div className="space-y-2">
            {contacts.map((ct) => (
              <div key={ct.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.07] px-3 py-2 text-xs">
                <div><p className="text-[13px] font-medium">{ct.full_name}</p><p className="text-white/40">{[ct.email, ct.phone].filter(Boolean).join(' · ') || 'Sem contactos'}</p></div>
                <div className="flex items-center gap-1.5">
                  {ct.opted_out ? <Badge tone="danger">Oposição registada</Badge> : ct.consent_commercial ? <Badge tone="success">Consentimento</Badge> : <Badge>Sem consentimento</Badge>}
                  {!ct.opted_out && !ct.consent_commercial && <Button size="sm" variant="outline" onClick={() => setConsent(ct, { consent_commercial: true })}>Registar consentimento</Button>}
                  {!ct.opted_out && <Button size="sm" variant="ghost" onClick={() => setConsent(ct, { opted_out: true, consent_commercial: false })}>Registar oposição</Button>}
                </div>
              </div>
            ))}
            {contacts.length === 0 && <p className="text-xs text-white/30">Sem contactos registados.</p>}
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <input className="input" placeholder="Nome" value={newContact.full_name} onChange={(e) => setNewContact({ ...newContact, full_name: e.target.value })} />
            <input className="input" placeholder="Email" value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} />
            <input className="input" placeholder="Telefone" value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} />
            <Button variant="outline" onClick={addContact}>Adicionar</Button>
          </div>
        </div>

        <div>
          <p className="label">Histórico</p>
          {logs.length === 0 ? <p className="text-xs text-white/30">Sem registos.</p> : (
            <ul className="space-y-1 text-xs">{logs.map((l) => <li key={l.id} className="flex justify-between text-white/50"><span className="font-mono">{l.action}</span><span className="text-white/30">{dateTime(l.created_at)}</span></li>)}</ul>
          )}
        </div>
      </div>
    </Modal>
  )
}
