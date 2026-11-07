import { useCallback, useEffect, useState } from 'react'
import { Plus, ArrowUpCircle, ArrowDownCircle, AlertTriangle, Package } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/log'
import { Card, CardHeader, Button, Modal, Field, Skeleton, EmptyState } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'

type Product = {
  id: string
  sku: string
  name: string
  stock_quantity: number
  min_stock_alert: number
}

type Movement = {
  id: string
  product_id: string
  product_name?: string
  movement_type: string
  quantity: number
  previous_quantity: number
  new_quantity: number
  reason: string | null
  created_at: string
}

export default function LojaGifsEstoque() {
  const toast = useToast()
  const [products, setProducts] = useState<Product[] | null>(null)
  const [movements, setMovements] = useState<Movement[]>([])
  const [edit, setEdit] = useState<{ product_id: string; movement_type: string; quantity: number; reason: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    const [prodsRes, movsRes] = await Promise.all([
      supabase.from('gif_products').select('id, sku, name, stock_quantity, min_stock_alert').order('name'),
      supabase.from('gif_stock_movements').select('*, product:gif_products(name)').order('created_at', { ascending: false }).limit(50)
    ])
    if (prodsRes.error) toast.push('error', prodsRes.error.message)
    else setProducts(prodsRes.data)
    if (movsRes.data) setMovements((movsRes.data || []).map(m => ({ ...m, product_name: m.product?.name })))
  }, [toast])

  useEffect(() => { load() }, [load])

  const saveMovement = async () => {
    if (!edit) return
    setLoading(true)
    try {
      const product = products?.find(p => p.id === edit.product_id)
      if (!product) throw new Error('Produto não encontrado')

      const quantity = edit.movement_type === 'entrada' ? edit.quantity : -edit.quantity
      const newQuantity = product.stock_quantity + quantity

      if (newQuantity < 0) throw new Error('Estoque insuficiente')

      const { error } = await supabase.from('gif_stock_movements').insert({
        product_id: edit.product_id,
        movement_type: edit.movement_type,
        quantity: Math.abs(edit.quantity),
        previous_quantity: product.stock_quantity,
        new_quantity: newQuantity,
        reason: edit.reason
      })

      if (error) throw error

      await supabase.from('gif_products').update({ stock_quantity: newQuantity }).eq('id', edit.product_id)
      await logActivity('gif_stock.movement', 'gif_stock_movements', '', { product: product.name, type: edit.movement_type, quantity: edit.quantity })
      toast.push('success', 'Movimentação registrada.')
      setEdit(null)
      load()
    } catch (error: any) {
      toast.push('error', error.message)
    } finally {
      setLoading(false)
    }
  }

  const lowStock = products?.filter(p => p.stock_quantity <= p.min_stock_alert) || []

  if (!products) return <div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-20" />)}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Estoque</h1>
          <p className="mt-1 text-sm text-white/50">Controle de estoque e movimentações</p>
        </div>
        <Button onClick={() => setEdit({ product_id: '', movement_type: 'entrada', quantity: 1, reason: '' })}>
          <Plus className="h-4 w-4" /> Nova Movimentação
        </Button>
      </div>

      {lowStock.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader title="Alertas de Estoque Baixo" />
          <div className="p-5 space-y-2">
            {lowStock.map(p => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-2">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <span className="text-sm text-white">{p.name}</span>
                </div>
                <span className="text-xs font-mono text-amber-300">{p.stock_quantity} / {p.min_stock_alert}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="Produtos em Estoque" />
          <div className="divide-y divide-white/[0.05] max-h-96 overflow-y-auto">
            {products.map(p => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-white">{p.name}</p>
                  <p className="text-xs text-white/40 font-mono">{p.sku}</p>
                </div>
                <div className="text-right">
                  <p className={cn('text-sm font-mono', p.stock_quantity <= p.min_stock_alert ? 'text-amber-400' : 'text-white')}>
                    {p.stock_quantity}
                  </p>
                  <p className="text-[10px] text-white/30">mín: {p.min_stock_alert}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Movimentações Recentes" />
          <div className="divide-y divide-white/[0.05] max-h-96 overflow-y-auto">
            {movements.length === 0 ? (
              <EmptyState icon={<Package className="h-5 w-5" />} title="Sem movimentações" />
            ) : (
              movements.map(m => (
                <div key={m.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    {m.movement_type === 'entrada' ? (
                      <ArrowDownCircle className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <ArrowUpCircle className="h-4 w-4 text-red-400" />
                    )}
                    <div>
                      <p className="text-sm text-white">{m.product_name}</p>
                      <p className="text-xs text-white/40">{m.reason || m.movement_type}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn('text-sm font-mono', m.movement_type === 'entrada' ? 'text-emerald-400' : 'text-red-400')}>
                      {m.movement_type === 'entrada' ? '+' : '-'}{m.quantity}
                    </p>
                    <p className="text-[10px] text-white/30">{m.new_quantity}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title="Nova Movimentação" footer={
        <>
          <Button variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button>
          <Button onClick={saveMovement} loading={loading}>Registrar</Button>
        </>
      }>
        {edit && (
          <div className="space-y-4">
            <Field label="Produto">
              <select className="input" value={edit.product_id} onChange={e => setEdit({ ...edit, product_id: e.target.value })}>
                <option value="">Selecione...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
              </select>
            </Field>
            <Field label="Tipo">
              <select className="input" value={edit.movement_type} onChange={e => setEdit({ ...edit, movement_type: e.target.value })}>
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
                <option value="ajuste">Ajuste</option>
              </select>
            </Field>
            <Field label="Quantidade"><input type="number" className="input" value={edit.quantity} onChange={e => setEdit({ ...edit, quantity: Number(e.target.value) })} /></Field>
            <Field label="Motivo"><input className="input" value={edit.reason} onChange={e => setEdit({ ...edit, reason: e.target.value })} placeholder="Ex: Compra de materiais, Venda, etc." /></Field>
          </div>
        )}
      </Modal>
    </div>
  )
}
