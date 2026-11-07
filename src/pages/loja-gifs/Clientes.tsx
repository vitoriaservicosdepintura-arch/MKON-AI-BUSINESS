import { useCallback, useEffect, useState } from 'react'
import { Plus, Edit, Trash2, Users, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/log'
import { Card, Button, Modal, Field, Skeleton, EmptyState } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'

type Customer = {
  id: string
  name: string
  email: string | null
  phone: string | null
  whatsapp: string | null
  city: string | null
  total_spent: number
  orders_count: number
  last_purchase_at: string | null
  notes: string | null
}

export default function LojaGifsClientes() {
  const toast = useToast()
  const [customers, setCustomers] = useState<Customer[] | null>(null)
  const [edit, setEdit] = useState<Customer | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('gif_customers')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) toast.push('error', error.message)
    else setCustomers(data)
  }, [toast])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!edit) return
    setLoading(true)
    try {
      const payload = {
        name: edit.name,
        email: edit.email,
        phone: edit.phone,
        whatsapp: edit.whatsapp,
        city: edit.city,
        notes: edit.notes
      }

      const { error } = edit.id
        ? await supabase.from('gif_customers').update(payload).eq('id', edit.id)
        : await supabase.from('gif_customers').insert(payload)

      if (error) throw error
      await logActivity('gif_customer.saved', 'gif_customers', edit.id || '', { name: edit.name })
      toast.push('success', edit.id ? 'Cliente atualizado.' : 'Cliente criado.')
      setEdit(null)
      load()
    } catch (error: any) {
      toast.push('error', error.message)
    } finally {
      setLoading(false)
    }
  }

  const filtered = customers?.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  ) || []

  if (!customers) return <div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-20" />)}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Clientes</h1>
          <p className="mt-1 text-sm text-white/50">Base de clientes da Loja de GIFs</p>
        </div>
        <Button onClick={() => setEdit({ id: '', name: '', email: '', phone: '', whatsapp: '', city: '', total_spent: 0, orders_count: 0, last_purchase_at: null, notes: '' })}>
          <Plus className="h-4 w-4" /> Novo Cliente
        </Button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            className="input !pl-10"
            placeholder="Pesquisar por nome, email ou telefone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Users className="h-5 w-5" />} title={search ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(c => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">{c.name}</p>
                  {c.email && <p className="mt-1 text-xs text-white/50">{c.email}</p>}
                  {c.phone && <p className="mt-1 text-xs text-white/50">{c.phone}</p>}
                  {c.city && <p className="mt-1 text-xs text-white/40">{c.city}</p>}
                  <div className="mt-3 flex items-center gap-4 text-xs">
                    <span className="text-white/60">{c.orders_count} pedidos</span>
                    <span className="font-medium text-white">€{c.total_spent.toFixed(2)}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEdit(c)}><Edit className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm('Remover cliente?')) { supabase.from('gif_customers').delete().eq('id', c.id).then(() => load()) } }}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar Cliente' : 'Novo Cliente'} footer={
        <>
          <Button variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button>
          <Button onClick={save} loading={loading}>Guardar</Button>
        </>
      }>
        {edit && (
          <div className="space-y-4">
            <Field label="Nome"><input className="input" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Email"><input type="email" className="input" value={edit.email || ''} onChange={e => setEdit({ ...edit, email: e.target.value })} /></Field>
            <Field label="Telefone"><input className="input" value={edit.phone || ''} onChange={e => setEdit({ ...edit, phone: e.target.value })} /></Field>
            <Field label="WhatsApp"><input className="input" value={edit.whatsapp || ''} onChange={e => setEdit({ ...edit, whatsapp: e.target.value })} /></Field>
            <Field label="Cidade"><input className="input" value={edit.city || ''} onChange={e => setEdit({ ...edit, city: e.target.value })} /></Field>
            <Field label="Notas"><textarea className="input" rows={3} value={edit.notes || ''} onChange={e => setEdit({ ...edit, notes: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
    </div>
  )
}
