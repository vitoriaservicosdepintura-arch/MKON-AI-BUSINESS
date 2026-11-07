import { useCallback, useEffect, useState } from 'react'
import { Inbox, Send, MessageSquare, Plus, Phone, Mail, Globe, Search, CheckCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader, Skeleton } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { cn, dateTime, relativeTime } from '@/lib/utils'
import { isDemoActive } from '@/lib/demo'

type Conversation = {
    id: string; channel: string; subject: string | null; interest_level: number | null
    last_message_at: string | null; created_at: string
    companies: { id: string; name: string; city: string | null } | null
    contacts: { full_name: string; phone: string | null; email: string | null } | null
}
type Message = {
    id: string; direction: string; status: string; body: string
    sent_at: string | null; created_at: string
}

const DEMO_CONVS: Conversation[] = [
    { id: 'cv1', channel: 'whatsapp', subject: 'Proposta website', interest_level: 4, last_message_at: new Date(Date.now() - 3600000).toISOString(), created_at: new Date(Date.now() - 86400000).toISOString(), companies: { id: 'c1', name: 'Pinturas Alves & Filhos', city: 'Lisboa' }, contacts: { full_name: 'João Alves', phone: '912345678', email: null } },
    { id: 'cv2', channel: 'email', subject: 'Dúvidas sobre NFC', interest_level: 3, last_message_at: new Date(Date.now() - 7200000).toISOString(), created_at: new Date(Date.now() - 3 * 86400000).toISOString(), companies: { id: 'c2', name: 'Remodelações Norte Lda.', city: 'Porto' }, contacts: { full_name: 'Maria Santos', phone: null, email: 'maria@remodelacoes.pt' } },
    { id: 'cv3', channel: 'telefone', subject: null, interest_level: 2, last_message_at: new Date(Date.now() - 2 * 86400000).toISOString(), created_at: new Date(Date.now() - 5 * 86400000).toISOString(), companies: { id: 'c4', name: 'Eletro Torres', city: 'Coimbra' }, contacts: { full_name: 'Carlos Torres', phone: '239876543', email: null } },
]
const DEMO_MSGS: Message[] = [
    { id: 'm1', direction: 'saida', status: 'enviada', body: 'Bom dia João! Conforme falado, envio em anexo a proposta para o seu website profissional. Ficamos ao dispor para qualquer esclarecimento.', sent_at: new Date(Date.now() - 90000000).toISOString(), created_at: new Date(Date.now() - 90000000).toISOString() },
    { id: 'm2', direction: 'entrada', status: 'recebida', body: 'Boa tarde! Recebi a proposta, obrigado. Vou analisar com calma e dar resposta até ao final da semana.', sent_at: null, created_at: new Date(Date.now() - 3600000).toISOString() },
]

const channelIcon: Record<string, typeof MessageSquare> = { whatsapp: Phone, email: Mail, telefone: Phone, formulario: Globe, outro: MessageSquare }
const channelLabel: Record<string, string> = { whatsapp: 'WhatsApp', email: 'Email', telefone: 'Telefone', formulario: 'Formulário', outro: 'Outro' }

export default function Mensagens() {
    const toast = useToast()
    const demo = isDemoActive()
    const [convs, setConvs] = useState<Conversation[]>(demo ? DEMO_CONVS : [])
    const [msgs, setMsgs] = useState<Message[]>([])
    const [selected, setSelected] = useState<Conversation | null>(demo ? DEMO_CONVS[0] : null)
    const [loading, setLoading] = useState(!demo)
    const [q, setQ] = useState('')
    const [compose, setCompose] = useState('')
    const [sending, setSending] = useState(false)
    const [newOpen, setNewOpen] = useState(false)

    const loadConvs = useCallback(async () => {
        if (demo) return
        const { data, error } = await supabase
            .from('conversations')
            .select('id, channel, subject, interest_level, last_message_at, created_at, companies(id, name, city), contacts(full_name, phone, email)')
            .order('last_message_at', { ascending: false, nullsFirst: false })
        if (error) toast.push('error', error.message)
        else { setConvs((data ?? []) as unknown as Conversation[]); if (!selected && (data ?? []).length > 0) setSelected((data as unknown as Conversation[])[0]) }
        setLoading(false)
    }, [demo])

    const loadMsgs = useCallback(async (convId: string) => {
        if (demo) { setMsgs(DEMO_MSGS); return }
        const { data, error } = await supabase.from('messages').select('id, direction, status, body, sent_at, created_at').eq('conversation_id', convId).order('created_at')
        if (error) toast.push('error', error.message)
        else setMsgs((data ?? []) as Message[])
    }, [demo])

    useEffect(() => { loadConvs() }, [loadConvs])
    useEffect(() => { if (selected) loadMsgs(selected.id) }, [selected, loadMsgs])

    const sendMessage = async () => {
        if (!compose.trim() || !selected) return
        if (demo) { toast.push('warning', 'Modo demo.'); setCompose(''); return }
        setSending(true)
        const { error } = await supabase.from('messages').insert({ conversation_id: selected.id, direction: 'saida', status: 'aguarda_aprovacao', body: compose.trim() })
        setSending(false)
        if (error) return toast.push('error', error.message)
        toast.push('success', 'Mensagem guardada (aguarda aprovação).')
        setCompose(''); loadMsgs(selected.id)
    }

    const filtered = convs.filter(c => !q || [c.companies?.name, c.contacts?.full_name, c.subject].some(v => v?.toLowerCase().includes(q.toLowerCase())))

    return (
        <>
            <PageHeader title="Mensagens" description="Caixa de entrada centralizada de todas as conversas comerciais." actions={<Button onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> Nova conversa</Button>} />

            <div className="flex h-[calc(100vh-220px)] gap-4 min-h-[500px]">
                {/* Sidebar conversas */}
                <div className="flex w-72 shrink-0 flex-col gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
                        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Pesquisar…" className="input !pl-8 w-full" />
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                        {loading ? [0, 1, 2].map(i => <Skeleton key={i} className="h-16" />) : filtered.length === 0 ? (
                            <Card><EmptyState icon={<Inbox className="h-5 w-5" />} title="Sem conversas" /></Card>
                        ) : filtered.map(c => {
                            const Icon = channelIcon[c.channel] ?? MessageSquare
                            return (
                                <button key={c.id} onClick={() => setSelected(c)} className={cn('card flex w-full items-start gap-3 p-3 text-left transition', selected?.id === c.id ? 'border-brand/40 bg-brand/[0.06]' : 'hover:border-brand/20')}>
                                    <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', c.channel === 'whatsapp' ? 'bg-green-500/15' : 'bg-white/[0.05]')}>
                                        <Icon className={cn('h-4 w-4', c.channel === 'whatsapp' ? 'text-green-400' : 'text-white/50')} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-xs font-medium">{c.companies?.name ?? 'Sem empresa'}</p>
                                        <p className="truncate text-[11px] text-white/40">{c.contacts?.full_name ?? channelLabel[c.channel]}</p>
                                        {c.last_message_at && <p className="text-[10px] text-white/25">{relativeTime(c.last_message_at)}</p>}
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Painel mensagens */}
                <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02]">
                    {!selected ? (
                        <div className="flex flex-1 items-center justify-center">
                            <EmptyState icon={<MessageSquare className="h-6 w-6" />} title="Selecione uma conversa" description="Escolha uma conversa à esquerda." />
                        </div>
                    ) : (
                        <>
                            {/* Header */}
                            <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
                                <div>
                                    <p className="text-sm font-medium">{selected.companies?.name}</p>
                                    <p className="text-xs text-white/40">{selected.contacts?.full_name} · {channelLabel[selected.channel]}</p>
                                </div>
                                <div className="ml-auto flex items-center gap-2">
                                    {selected.interest_level && <Badge tone="brand">Interesse {selected.interest_level}/5</Badge>}
                                    <Badge>{channelLabel[selected.channel]}</Badge>
                                </div>
                            </div>

                            {/* Mensagens */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {msgs.map((m, i) => (
                                    <div key={m.id ?? i} className={cn('flex', m.direction === 'saida' ? 'justify-end' : 'justify-start')}>
                                        <div className={cn('max-w-[75%] rounded-2xl px-4 py-2.5 text-sm', m.direction === 'saida' ? 'bg-brand/20 text-white' : 'bg-white/[0.07] text-white/80')}>
                                            <p className="leading-relaxed">{m.body}</p>
                                            <div className={cn('mt-1 flex items-center gap-1 text-[10px]', m.direction === 'saida' ? 'justify-end text-white/40' : 'text-white/30')}>
                                                <span>{dateTime(m.created_at)}</span>
                                                {m.direction === 'saida' && <CheckCheck className="h-3 w-3" />}
                                                {m.direction === 'saida' && m.status === 'aguarda_aprovacao' && <span className="text-amber-400">(aguarda aprovação)</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {msgs.length === 0 && <div className="flex h-32 items-center justify-center text-xs text-white/25">Sem mensagens nesta conversa</div>}
                            </div>

                            {/* Compose */}
                            <div className="border-t border-white/[0.06] p-3 flex items-end gap-2">
                                <textarea
                                    value={compose} onChange={e => setCompose(e.target.value)}
                                    placeholder="Escrever mensagem… (aguarda aprovação antes de enviar)"
                                    rows={2} className="input flex-1 resize-none text-sm"
                                    onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) sendMessage() }}
                                />
                                <Button onClick={sendMessage} loading={sending} disabled={!compose.trim()}>
                                    <Send className="h-4 w-4" />
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <NewConversationModal open={newOpen} onClose={() => setNewOpen(false)} onCreated={loadConvs} />
        </>
    )
}

function NewConversationModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
    const toast = useToast()
    const demo = isDemoActive()
    const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
    const [f, setF] = useState({ company_id: '', channel: 'whatsapp', subject: '' })
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        if (!open) return
        supabase.from('companies').select('id, name').order('name').limit(100).then(({ data }) => setCompanies(data ?? []))
    }, [open])

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (demo) { toast.push('warning', 'Modo demo.'); onClose(); return }
        setBusy(true)
        const { error } = await supabase.from('conversations').insert({ company_id: f.company_id, channel: f.channel, subject: f.subject.trim() || null })
        setBusy(false)
        if (error) return toast.push('error', error.message)
        toast.push('success', 'Conversa criada.')
        setF({ company_id: '', channel: 'whatsapp', subject: '' }); onClose(); onCreated()
    }

    return (
        <Modal open={open} onClose={onClose} title="Nova conversa" footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" form="new-conv" loading={busy}>Criar</Button></>}>
            <form id="new-conv" onSubmit={submit} className="space-y-4">
                <Field label="Empresa *"><select required className="input" value={f.company_id} onChange={e => setF(s => ({ ...s, company_id: e.target.value }))}>
                    <option value="">— Selecionar —</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select></Field>
                <Field label="Canal"><select className="input" value={f.channel} onChange={e => setF(s => ({ ...s, channel: e.target.value }))}>
                    {['whatsapp', 'email', 'telefone', 'formulario', 'outro'].map(ch => <option key={ch} value={ch}>{channelLabel[ch]}</option>)}
                </select></Field>
                <Field label="Assunto"><input className="input" value={f.subject} onChange={e => setF(s => ({ ...s, subject: e.target.value }))} placeholder="Ex.: Proposta website" /></Field>
            </form>
        </Modal>
    )
}
