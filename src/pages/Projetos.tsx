import { useCallback, useEffect, useState } from 'react'
import { FolderKanban, Plus, CheckCircle, AlertTriangle, ChevronRight, Hammer, PackageCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/log'
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader, Skeleton } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { cn, eur } from '@/lib/utils'
import { isDemoActive } from '@/lib/demo'

type Project = {
    id: string; code: string; title: string; stage: string; value: number
    starts_on: string | null; due_on: string | null; delivered_on: string | null; notes: string | null
    created_at: string; updated_at: string
    customers: { companies: { name: string; city: string | null } | null } | null
    products: { name: string; category: string } | null
}
type ProjectTask = { id: string; title: string; status: string; due_on: string | null; completed_at: string | null; created_at: string }

const STAGES: { key: string; label: string }[] = [
    { key: 'aguardando_materiais', label: 'Aguardando Materiais' },
    { key: 'planeamento', label: 'Planeamento' },
    { key: 'desenvolvimento', label: 'Desenvolvimento' },
    { key: 'revisao', label: 'Revisão' },
    { key: 'aprovacao', label: 'Aprovação' },
    { key: 'publicacao', label: 'Publicação' },
    { key: 'entregue', label: 'Entregue' },
]

const DEMO_PROJECTS: Project[] = [
    { id: 'pr1', code: 'PRJ-2024-001', title: 'Website Pinturas Alves', stage: 'desenvolvimento', value: 1200, starts_on: new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10), due_on: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10), delivered_on: null, notes: 'Aguardar fotos do cliente.', created_at: new Date(Date.now() - 20 * 86400000).toISOString(), updated_at: new Date(Date.now() - 2 * 86400000).toISOString(), customers: { companies: { name: 'Pinturas Alves & Filhos', city: 'Lisboa' } }, products: { name: 'Website Profissional', category: 'website' } },
    { id: 'pr2', code: 'PRJ-2024-002', title: 'Website Remodelações Norte', stage: 'entregue', value: 1800, starts_on: new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10), due_on: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), delivered_on: new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10), notes: null, created_at: new Date(Date.now() - 65 * 86400000).toISOString(), updated_at: new Date(Date.now() - 28 * 86400000).toISOString(), customers: { companies: { name: 'Remodelações Norte Lda.', city: 'Porto' } }, products: { name: 'Website Premium', category: 'website' } },
    { id: 'pr3', code: 'PRJ-2024-003', title: 'Website Acabamentos Premium', stage: 'revisao', value: 2200, starts_on: new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10), due_on: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10), delivered_on: null, notes: null, created_at: new Date(Date.now() - 12 * 86400000).toISOString(), updated_at: new Date(Date.now() - 86400000).toISOString(), customers: { companies: { name: 'Acabamentos Premium', city: 'Setúbal' } }, products: { name: 'Website Premium+SEO', category: 'website' } },
    { id: 'pr4', code: 'PRJ-2024-004', title: 'Pack NFC Grupo Habitat', stage: 'planeamento', value: 220, starts_on: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10), due_on: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10), delivered_on: null, notes: 'Aguardar logótipo atualizado.', created_at: new Date(Date.now() - 5 * 86400000).toISOString(), updated_at: new Date(Date.now() - 86400000).toISOString(), customers: { companies: { name: 'Grupo Habitat', city: 'Lisboa' } }, products: { name: 'NFC Pack x10', category: 'nfc' } },
]

const stageTone = (s: string): 'success' | 'warning' | 'brand' | 'neutral' | 'danger' =>
    s === 'entregue' ? 'success' : s === 'revisao' || s === 'aprovacao' ? 'warning' : s === 'desenvolvimento' || s === 'publicacao' ? 'brand' : 'neutral'

let projCounter = 5

export default function Projetos() {
    const toast = useToast()
    const demo = isDemoActive()
    const [projects, setProjects] = useState<Project[]>(demo ? DEMO_PROJECTS : [])
    const [loading, setLoading] = useState(!demo)
    const [view, setView] = useState<'kanban' | 'lista'>('lista')
    const [selected, setSelected] = useState<Project | null>(null)
    const [createOpen, setCreateOpen] = useState(false)
    const [stageFilter, setStageFilter] = useState('')

    const load = useCallback(async () => {
        if (demo) return
        const { data, error } = await supabase
            .from('projects')
            .select('id, code, title, stage, value, starts_on, due_on, delivered_on, notes, created_at, updated_at, customers(companies(name, city)), products(name, category)')
            .order('updated_at', { ascending: false })
        if (error) toast.push('error', error.message)
        else setProjects((data ?? []) as unknown as Project[])
        setLoading(false)
    }, [demo])
    useEffect(() => { load() }, [load])

    const moveStage = async (project: Project, stage: string) => {
        if (demo) { toast.push('warning', 'Modo demo.'); return }
        const patch: Record<string, unknown> = { stage }
        if (stage === 'entregue') patch.delivered_on = new Date().toISOString().slice(0, 10)
        const { error } = await supabase.from('projects').update(patch).eq('id', project.id)
        if (error) return toast.push('error', error.message)
        await logActivity('project.stage_changed', 'projects', project.id, { from: project.stage, to: stage })
        setProjects(s => s.map(p => p.id === project.id ? { ...p, stage, ...(stage === 'entregue' ? { delivered_on: new Date().toISOString().slice(0, 10) } : {}) } : p))
        toast.push('success', `Projeto movido para "${STAGES.find(s => s.key === stage)?.label}".`)
    }

    const overdue = projects.filter(p => p.due_on && new Date(p.due_on) < new Date() && p.stage !== 'entregue').length
    const inProgress = projects.filter(p => !['entregue'].includes(p.stage)).length
    const delivered = projects.filter(p => p.stage === 'entregue').length
    const totalValue = projects.filter(p => p.stage !== 'entregue').reduce((a, p) => a + Number(p.value), 0)

    const filtered = projects.filter(p => !stageFilter || p.stage === stageFilter)

    return (
        <>
            <PageHeader title="Projetos" description="Acompanhamento de produção e entrega dos projetos vendidos." actions={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Novo projeto</Button>} />

            {/* KPIs */}
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                    { label: 'Em curso', value: inProgress, icon: Hammer },
                    { label: 'Entregues', value: delivered, icon: PackageCheck },
                    { label: 'Em atraso', value: overdue, icon: AlertTriangle },
                    { label: 'Valor em produção', value: eur(totalValue), icon: FolderKanban },
                ].map(({ label, value, icon: Icon }) => (
                    <Card key={label} className="p-4">
                        <div className="flex items-center justify-between text-white/40"><span className="text-[11px] font-medium uppercase tracking-wider">{label}</span><Icon className="h-4 w-4" strokeWidth={1.8} /></div>
                        <p className="mt-2 text-2xl font-semibold">{loading ? '–' : value}</p>
                    </Card>
                ))}
            </div>

            {/* View toggle + Filtro */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
                <div className="flex gap-1 rounded-lg border border-white/10 p-0.5">
                    {[{ key: 'lista', label: 'Lista' }, { key: 'kanban', label: 'Kanban' }].map(v => (
                        <button key={v.key} onClick={() => setView(v.key as 'lista' | 'kanban')} className={cn('rounded-md px-3 py-1.5 text-xs transition', view === v.key ? 'bg-brand/15 text-brand-soft' : 'text-white/50 hover:text-snow')}>{v.label}</button>
                    ))}
                </div>
                <select value={stageFilter} onChange={e => setStageFilter(e.target.value)} className="input !w-48">
                    <option value="">Todas as etapas</option>
                    {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
                {overdue > 0 && <span className="flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-300"><AlertTriangle className="h-3.5 w-3.5" />{overdue} projeto(s) em atraso</span>}
            </div>

            {loading ? (
                <div className="space-y-2">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>
            ) : filtered.length === 0 ? (
                <Card><EmptyState icon={<FolderKanban className="h-5 w-5" />} title="Nenhum projeto" description="Os projetos são criados a partir de vendas fechadas." action={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Novo projeto</Button>} /></Card>
            ) : view === 'lista' ? (
                <div className="space-y-2">
                    {filtered.map(p => {
                        const isOverdue = p.due_on && new Date(p.due_on) < new Date() && p.stage !== 'entregue'
                        const stageLabel = STAGES.find(s => s.key === p.stage)?.label ?? p.stage
                        return (
                            <button key={p.id} onClick={() => setSelected(p)} className="card flex w-full items-center gap-4 px-4 py-3 text-left transition hover:border-brand/40">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="truncate text-sm font-medium">{p.title}</p>
                                        <Badge tone={stageTone(p.stage)}>{stageLabel}</Badge>
                                        {isOverdue && <Badge tone="danger">Atrasado</Badge>}
                                    </div>
                                    <div className="mt-0.5 flex items-center gap-3 text-xs text-white/40">
                                        <span>{p.customers?.companies?.name ?? '—'}</span>
                                        {p.due_on && <span className={cn(isOverdue ? 'text-red-400' : '')}>Prazo: {new Date(p.due_on).toLocaleDateString('pt-PT')}</span>}
                                        <span>{eur(p.value)}</span>
                                    </div>
                                </div>
                                <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
                            </button>
                        )
                    })}
                </div>
            ) : (
                // Kanban
                <div className="-mx-4 overflow-x-auto px-4 pb-4">
                    <div className="flex gap-3" style={{ minWidth: `${STAGES.length * 220}px` }}>
                        {STAGES.map(s => {
                            const items = filtered.filter(p => p.stage === s.key)
                            return (
                                <div key={s.key} className="w-52 shrink-0 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2">
                                    <div className="mb-2 flex items-center justify-between px-2 pt-1">
                                        <span className="text-xs font-medium text-white/70">{s.label}</span>
                                        <span className="text-[11px] text-white/30">{items.length}</span>
                                    </div>
                                    <div className="space-y-2">
                                        {items.map(p => (
                                            <button key={p.id} onClick={() => setSelected(p)} className="card w-full p-3 text-left transition hover:border-brand/40">
                                                <p className="truncate text-xs font-medium">{p.title}</p>
                                                <p className="mt-0.5 truncate text-[10px] text-white/35">{p.customers?.companies?.name}</p>
                                                <p className="mt-1.5 text-[11px] font-semibold text-brand-soft">{eur(p.value)}</p>
                                            </button>
                                        ))}
                                        {items.length === 0 && <p className="px-2 py-3 text-center text-[11px] text-white/20">Vazio</p>}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            <ProjectModal project={selected} onClose={() => setSelected(null)} onMove={moveStage} onRefresh={load} />
            <CreateProjectModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} />
        </>
    )
}

function ProjectModal({ project: p, onClose, onMove, onRefresh }: { project: Project | null; onClose: () => void; onMove: (p: Project, s: string) => void; onRefresh: () => void }) {
    const toast = useToast()
    const demo = isDemoActive()
    const [tasks, setTasks] = useState<ProjectTask[]>([])
    const [newTaskTitle, setNewTaskTitle] = useState('')
    const [notes, setNotes] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!p) return
        setNotes(p.notes ?? '')
        if (demo) { setTasks([]); return }
        supabase.from('project_tasks').select('id, title, status, due_on, completed_at, created_at').eq('project_id', p.id).order('created_at').then(({ data }) => setTasks((data ?? []) as ProjectTask[]))
    }, [p, demo])

    if (!p) return null

    const nextStages = STAGES.slice(STAGES.findIndex(s => s.key === p.stage) + 1)
    const isOverdue = p.due_on && new Date(p.due_on) < new Date() && p.stage !== 'entregue'

    const addTask = async () => {
        if (!newTaskTitle.trim() || demo) return
        const { data, error } = await supabase.from('project_tasks').insert({ project_id: p.id, title: newTaskTitle.trim() }).select('id, title, status, due_on, completed_at, created_at').single()
        if (error) return toast.push('error', error.message)
        setTasks(s => [...s, data as ProjectTask])
        setNewTaskTitle('')
    }

    const toggleTask = async (task: ProjectTask) => {
        if (demo) return
        const status = task.status === 'concluida' ? 'pendente' : 'concluida'
        const { error } = await supabase.from('project_tasks').update({ status, completed_at: status === 'concluida' ? new Date().toISOString() : null }).eq('id', task.id)
        if (error) return toast.push('error', error.message)
        setTasks(s => s.map(t => t.id === task.id ? { ...t, status } : t))
    }

    const saveNotes = async () => {
        if (demo) { toast.push('warning', 'Modo demo.'); return }
        setSaving(true)
        const { error } = await supabase.from('projects').update({ notes: notes.trim() || null }).eq('id', p.id)
        setSaving(false)
        if (error) return toast.push('error', error.message)
        toast.push('success', 'Notas guardadas.'); onRefresh()
    }

    const completed = tasks.filter(t => t.status === 'concluida').length
    const stageLabel = STAGES.find(s => s.key === p.stage)?.label ?? p.stage

    return (
        <Modal open onClose={onClose} title={`${p.code} — ${p.title}`} wide footer={
            <div className="flex w-full gap-2">
                {nextStages.length > 0 && <Button onClick={() => { onMove(p, nextStages[0].key); onClose() }}>Avançar → {nextStages[0].label}</Button>}
                <Button variant="outline" loading={saving} onClick={saveNotes}>Guardar notas</Button>
                <Button variant="ghost" className="ml-auto" onClick={onClose}>Fechar</Button>
            </div>
        }>
            <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={stageTone(p.stage)}>{stageLabel}</Badge>
                    {isOverdue && <Badge tone="danger">Atrasado</Badge>}
                    {p.products && <Badge>{p.products.name}</Badge>}
                </div>
                <div className="grid gap-3 sm:grid-cols-3 text-sm">
                    <div><p className="label">Cliente</p><p className="text-white/70">{p.customers?.companies?.name ?? '—'}</p></div>
                    <div><p className="label">Valor</p><p className="font-semibold text-brand-soft">{eur(p.value)}</p></div>
                    {p.due_on && <div><p className="label">Prazo</p><p className={cn(isOverdue ? 'text-red-400' : 'text-white/70')}>{new Date(p.due_on).toLocaleDateString('pt-PT')}</p></div>}
                    {p.delivered_on && <div><p className="label">Entregue em</p><p className="text-green-400">{new Date(p.delivered_on).toLocaleDateString('pt-PT')}</p></div>}
                </div>

                {/* Checklist */}
                <div>
                    <p className="label mb-2">Tarefas {tasks.length > 0 && `(${completed}/${tasks.length})`}</p>
                    {tasks.length > 0 && (
                        <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                            <div className="h-full bg-brand/60 rounded-full transition-all" style={{ width: `${tasks.length ? (completed / tasks.length) * 100 : 0}%` }} />
                        </div>
                    )}
                    <div className="space-y-1.5 mb-3">
                        {tasks.map(t => (
                            <button key={t.id} onClick={() => toggleTask(t)} className={cn('flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-xs transition', t.status === 'concluida' ? 'border-green-500/20 bg-green-500/[0.06] text-white/40 line-through' : 'border-white/[0.06] text-white/70 hover:border-brand/30')}>
                                <CheckCircle className={cn('h-3.5 w-3.5 shrink-0', t.status === 'concluida' ? 'text-green-400' : 'text-white/20')} />
                                {t.title}
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <input className="input flex-1 text-sm" placeholder="Nova tarefa…" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTask()} />
                        <Button size="sm" variant="outline" onClick={addTask} disabled={!newTaskTitle.trim()}>Adicionar</Button>
                    </div>
                </div>

                {/* Notas */}
                <Field label="Notas internas">
                    <textarea rows={3} className="input" value={notes} onChange={e => setNotes(e.target.value)} />
                </Field>

                {/* Mover para */}
                {nextStages.length > 0 && (
                    <div>
                        <p className="label mb-2">Avançar para</p>
                        <div className="flex flex-wrap gap-2">
                            {nextStages.map(s => (
                                <Button key={s.key} size="sm" variant="outline" onClick={() => { onMove(p, s.key); onClose() }}>{s.label}</Button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    )
}

function CreateProjectModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
    const toast = useToast()
    const demo = isDemoActive()
    const [customers, setCustomers] = useState<{ id: string; companies: { name: string } | null }[]>([])
    const [products, setProducts] = useState<{ id: string; name: string }[]>([])
    const [f, setF] = useState({ customer_id: '', product_id: '', title: '', value: '', starts_on: '', due_on: '', notes: '' })
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        if (!open) return
        Promise.all([
            supabase.from('customers').select('id, companies(name)').order('created_at', { ascending: false }).limit(100),
            supabase.from('products').select('id, name').eq('is_active', true).order('name'),
        ]).then(([c, p]) => { setCustomers((c.data ?? []) as unknown as typeof customers); setProducts(p.data ?? []) })
    }, [open])

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (demo) { toast.push('warning', 'Modo demo.'); onClose(); return }
        setBusy(true)
        const code = `PRJ-${new Date().getFullYear()}-${String(projCounter++).padStart(3, '0')}`
        const { error } = await supabase.from('projects').insert({ code, customer_id: f.customer_id, product_id: f.product_id || null, title: f.title.trim(), value: Number(f.value) || 0, starts_on: f.starts_on || null, due_on: f.due_on || null, notes: f.notes.trim() || null })
        setBusy(false)
        if (error) return toast.push('error', error.message)
        await logActivity('project.created', 'projects')
        toast.push('success', `Projeto ${code} criado.`)
        setF({ customer_id: '', product_id: '', title: '', value: '', starts_on: '', due_on: '', notes: '' }); onClose(); onCreated()
    }

    return (
        <Modal open={open} onClose={onClose} title="Novo projeto" wide footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" form="new-project" loading={busy}>Criar</Button></>}>
            <form id="new-project" onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2"><Field label="Título *"><input required className="input" value={f.title} onChange={e => setF(s => ({ ...s, title: e.target.value }))} placeholder="Ex.: Website Pinturas XYZ" /></Field></div>
                <Field label="Cliente *"><select required className="input" value={f.customer_id} onChange={e => setF(s => ({ ...s, customer_id: e.target.value }))}><option value="">— Selecionar —</option>{customers.map(c => <option key={c.id} value={c.id}>{c.companies?.name ?? c.id}</option>)}</select></Field>
                <Field label="Produto/Serviço"><select className="input" value={f.product_id} onChange={e => setF(s => ({ ...s, product_id: e.target.value }))}><option value="">—</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
                <Field label="Valor (€)"><input type="number" min="0" step="0.01" className="input" value={f.value} onChange={e => setF(s => ({ ...s, value: e.target.value }))} /></Field>
                <Field label="Data início"><input type="date" className="input" value={f.starts_on} onChange={e => setF(s => ({ ...s, starts_on: e.target.value }))} /></Field>
                <Field label="Prazo de entrega"><input type="date" className="input" value={f.due_on} onChange={e => setF(s => ({ ...s, due_on: e.target.value }))} /></Field>
                <div className="sm:col-span-2"><Field label="Notas"><textarea rows={2} className="input" value={f.notes} onChange={e => setF(s => ({ ...s, notes: e.target.value }))} /></Field></div>
            </form>
        </Modal>
    )
}
