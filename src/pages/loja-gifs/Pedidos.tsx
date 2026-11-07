import { useCallback, useEffect, useState } from 'react'
import { Plus, ShoppingCart, CheckCircle, Truck, Package } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/log'
import { Card, Button, Skeleton, EmptyState, Modal, Field } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { cn, dateTime } from '@/lib/utils'

type Order = {
  id: string
  order_number: string
  customer_id: string
  customer_name?: string
  status: string
  total_amount: number
  payment_status: string
  shipping_method: string | null
  tracking_code: string | null
  customer_notes?: string
  created_at: string
}

export default function LojaGifsPedidos() {
  const toast = useToast()
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [edit, setEdit] = useState<Order | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('gif_orders')
      .select('*, customer:gif_customers(name)')
      .order('created_at', { ascending: false })
    if (error) toast.push('error', error.message)
    else setOrders((data || []).map(o => ({ ...o, customer_name: o.customer?.name })))
  }, [toast])

  useEffect(() => { load() }, [load])

  const updateStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase.from('gif_orders').update({ status: newStatus }).eq('id', orderId)
    if (error) toast.push('error', error.message)
    else {
      await logActivity('gif_order.status_changed', 'gif_orders', orderId, { status: newStatus })
      toast.push('success', 'Status atualizado.')
      load()
    }
  }

  const statusColor = (status: string) => {
    const colors: Record<string, string> = {
      novo_pedido: 'bg-amber-500/20 text-amber-300',
      aguardando_pagamento: 'bg-orange-500/20 text-orange-300',
      pagamento_confirmado: 'bg-blue-500/20 text-blue-300',
      em_producao: 'bg-purple-500/20 text-purple-300',
      pronto_envio: 'bg-green-500/20 text-green-300',
      enviado: 'bg-emerald-500/20 text-emerald-300',
      entregue: 'bg-slate-500/20 text-slate-300',
      cancelado: 'bg-red-500/20 text-red-300'
    }
    return colors[status] || 'bg-slate-500/20 text-slate-300'
  }

  const statusLabel = (status: string) => {
    const labels: Record<string, string> = {
      novo_pedido: 'Novo',
      aguardando_pagamento: 'Aguardando Pagamento',
      pagamento_confirmado: 'Pago',
      em_producao: 'Em Produção',
      pronto_envio: 'Pronto',
      enviado: 'Enviado',
      entregue: 'Entregue',
      cancelado: 'Cancelado'
    }
    return labels[status] || status
  }

  const save = async () => {
    if (!edit) return
    setLoading(true)
    try {
      const payload = {
        customer_id: edit.customer_id,
        status: edit.status,
        total_amount: edit.total_amount,
        payment_status: edit.payment_status,
        shipping_method: edit.shipping_method,
        tracking_code: edit.tracking_code
      }

      const { error } = await supabase.from('gif_orders').insert(payload)
      if (error) throw error
      await logActivity('gif_order.created', 'gif_orders', '', { number: edit.order_number })
      toast.push('success', 'Pedido criado.')
      setEdit(null)
      load()
    } catch (error: any) {
      toast.push('error', error.message)
    } finally {
      setLoading(false)
    }
  }

  if (!orders) return <div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-24" />)}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Pedidos</h1>
          <p className="mt-1 text-sm text-white/50">Gestão de pedidos da Loja de GIFs</p>
        </div>
        <Button onClick={() => setEdit({ id: '', order_number: '', customer_id: '', status: 'novo_pedido', total_amount: 0, payment_status: 'pendente', shipping_method: null, tracking_code: null, created_at: new Date().toISOString() })}>
          <Plus className="h-4 w-4" /> Novo Pedido
        </Button>
      </div>

      {orders.length === 0 ? (
        <EmptyState icon={<ShoppingCart className="h-5 w-5" />} title="Nenhum pedido" />
      ) : (
        <div className="space-y-3">
          {orders.map(order => (
            <Card key={order.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">{order.order_number}</p>
                    <p className="mt-1 text-xs text-white/50">{order.customer_name || 'Cliente não informado'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-mono text-white">€{order.total_amount.toFixed(2)}</span>
                  <span className={cn('inline-flex rounded-full px-2 py-1 text-[10px] font-medium', statusColor(order.status))}>
                    {statusLabel(order.status)}
                  </span>
                  <span className="text-xs text-white/30">{dateTime(order.created_at)}</span>
                  <div className="flex gap-1">
                    {order.status === 'novo_pedido' && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus(order.id, 'pagamento_confirmado')}>
                        <CheckCircle className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {order.status === 'pagamento_confirmado' && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus(order.id, 'em_producao')}>
                        <Package className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {order.status === 'em_producao' && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus(order.id, 'pronto_envio')}>
                        <Truck className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {order.status === 'pronto_envio' && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus(order.id, 'enviado')}>
                        <Truck className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title="Novo Pedido" footer={
        <>
          <Button variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button>
          <Button onClick={save} loading={loading}>Criar Pedido</Button>
        </>
      }>
        {edit && (
          <div className="space-y-4">
            <Field label="Cliente ID"><input className="input" value={edit.customer_id} onChange={e => setEdit({ ...edit, customer_id: e.target.value })} placeholder="UUID do cliente" /></Field>
            <Field label="Valor Total (€)"><input type="number" step="0.01" className="input" value={edit.total_amount} onChange={e => setEdit({ ...edit, total_amount: Number(e.target.value) })} /></Field>
            <Field label="Método de Envio">
              <select className="input" value={edit.shipping_method || ''} onChange={e => setEdit({ ...edit, shipping_method: e.target.value })}>
                <option value="">Selecione...</option>
                <option value="ctt_normal">CTT Normal</option>
                <option value="ctt_expresso">CTT Expresso</option>
                <option value="pickup">Recolha</option>
              </select>
            </Field>
            <Field label="Notas"><textarea className="input" rows={2} value={edit.customer_notes || ''} onChange={e => setEdit({ ...edit, customer_notes: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
    </div>
  )
}
