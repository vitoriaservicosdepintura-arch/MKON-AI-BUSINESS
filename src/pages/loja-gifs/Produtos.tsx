import { useCallback, useEffect, useState } from 'react'
import { Plus, Edit, Trash2, Image as ImageIcon, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/log'
import { Card, Button, Modal, Field, Skeleton, EmptyState } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'

type Product = {
  id: string
  sku: string
  name: string
  category_id: string
  subcategory_id?: string
  category_name?: string
  description: string | null
  cover_image_url: string | null
  gif_url: string | null
  sale_price: number
  production_cost: number
  dimensions: string | null
  material: string | null
  stock_quantity: number
  min_stock_alert: number
  production_days: number
  allows_customization: boolean
  status: 'ativo' | 'inativo' | 'esgotado'
  is_digital: boolean
}

type Category = { id: string; name: string }

export default function LojaGifsProdutos() {
  const toast = useToast()
  const [products, setProducts] = useState<Product[] | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [edit, setEdit] = useState<Product | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    const [prodsRes, catsRes] = await Promise.all([
      supabase.from('gif_products').select('*, category:gif_categories!category_id(name)').order('name'),
      supabase.from('gif_categories').select('id, name').eq('is_active', true)
    ])
    if (prodsRes.error) toast.push('error', prodsRes.error.message)
    else setProducts((prodsRes.data || []).map(p => ({ ...p, category_name: p.category?.name })))
    if (catsRes.data) setCategories(catsRes.data)
  }, [toast])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!edit) return
    setLoading(true)
    try {
      const payload = {
        name: edit.name,
        category_id: edit.category_id,
        description: edit.description,
        cover_image_url: edit.cover_image_url,
        gif_url: edit.gif_url,
        sale_price: edit.sale_price,
        production_cost: edit.production_cost,
        dimensions: edit.dimensions,
        material: edit.material,
        stock_quantity: edit.stock_quantity,
        min_stock_alert: edit.min_stock_alert,
        production_days: edit.production_days,
        allows_customization: edit.allows_customization,
        status: edit.status,
        is_digital: edit.is_digital
      }

      const { error } = edit.id
        ? await supabase.from('gif_products').update(payload).eq('id', edit.id)
        : await supabase.from('gif_products').insert(payload)

      if (error) throw error

      await logActivity('gif_product.saved', 'gif_products', edit.id || '', { name: edit.name })
      toast.push('success', edit.id ? 'Produto atualizado.' : 'Produto criado.')
      setEdit(null)
      load()
    } catch (error: any) {
      toast.push('error', error.message)
    } finally {
      setLoading(false)
    }
  }

  const calculateMargin = () => {
    if (!edit) return 0
    const cost = edit.production_cost || 0
    const price = edit.sale_price || 0
    if (price === 0) return 0
    return ((price - cost) / price * 100).toFixed(1)
  }

  if (!products) return <div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-24" />)}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Produtos / GIFs</h1>
          <p className="mt-1 text-sm text-white/50">Catálogo de produtos e GIFs animados</p>
        </div>
        <Button onClick={() => setEdit({ id: '', sku: '', name: '', category_id: '', description: '', cover_image_url: '', gif_url: '', sale_price: 0, production_cost: 0, dimensions: '', material: '', stock_quantity: 0, min_stock_alert: 5, production_days: 3, allows_customization: false, status: 'ativo', is_digital: false })}>
          <Plus className="h-4 w-4" /> Novo Produto
        </Button>
      </div>

      {products.length === 0 ? (
        <EmptyState icon={<ImageIcon className="h-5 w-5" />} title="Nenhum produto cadastrado" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {products.map(prod => (
            <Card key={prod.id} className={cn('p-4 transition', prod.status === 'inativo' && 'opacity-50', prod.status === 'esgotado' && 'border-red-500/30')}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white">{prod.name}</p>
                    <span className={cn('inline-flex rounded-full px-2 py-1 text-[10px] font-medium', prod.status === 'ativo' ? 'bg-emerald-500/20 text-emerald-300' : prod.status === 'esgotado' ? 'bg-red-500/20 text-red-300' : 'bg-slate-500/20 text-slate-300')}>{prod.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-white/40 font-mono">{prod.sku}</p>
                  {prod.category_name && <p className="mt-1 text-xs text-white/50">{prod.category_name}</p>}
                  {prod.cover_image_url && (
                    <div className="mt-3 h-24 w-full overflow-hidden rounded-lg bg-white/[0.05]">
                      <img src={prod.cover_image_url} alt={prod.name} className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-white">€{prod.sale_price.toFixed(2)}</span>
                    {prod.stock_quantity <= prod.min_stock_alert && (
                      <span className="flex items-center gap-1 text-[10px] text-amber-400">
                        <AlertCircle className="h-3 w-3" /> {prod.stock_quantity} un.
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEdit(prod)}><Edit className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm('Remover produto?')) { supabase.from('gif_products').delete().eq('id', prod.id).then(() => load()) } }}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar Produto' : 'Novo Produto'} footer={
        <>
          <Button variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button>
          <Button onClick={save} loading={loading}>Guardar</Button>
        </>
      }>
        {edit && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <Field label="Nome"><input className="input" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Categoria">
              <select className="input" value={edit.category_id} onChange={e => setEdit({ ...edit, category_id: e.target.value })}>
                <option value="">Selecione...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Descrição"><textarea className="input" rows={3} value={edit.description || ''} onChange={e => setEdit({ ...edit, description: e.target.value })} /></Field>
            <Field label="URL da Capa"><input className="input" value={edit.cover_image_url || ''} onChange={e => setEdit({ ...edit, cover_image_url: e.target.value })} placeholder="https://..." /></Field>
            <Field label="URL do GIF"><input className="input" value={edit.gif_url || ''} onChange={e => setEdit({ ...edit, gif_url: e.target.value })} placeholder="https://..." /></Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Preço de Venda (€)"><input type="number" step="0.01" className="input" value={edit.sale_price} onChange={e => setEdit({ ...edit, sale_price: Number(e.target.value) })} /></Field>
              <Field label="Custo de Produção (€)"><input type="number" step="0.01" className="input" value={edit.production_cost} onChange={e => setEdit({ ...edit, production_cost: Number(e.target.value) })} /></Field>
            </div>
            <p className="text-xs text-white/40">Margem estimada: <span className="font-medium text-emerald-400">{calculateMargin()}%</span></p>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Dimensões"><input className="input" value={edit.dimensions || ''} onChange={e => setEdit({ ...edit, dimensions: e.target.value })} placeholder="8x8cm" /></Field>
              <Field label="Material"><input className="input" value={edit.material || ''} onChange={e => setEdit({ ...edit, material: e.target.value })} placeholder="magnético" /></Field>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Estoque"><input type="number" className="input" value={edit.stock_quantity} onChange={e => setEdit({ ...edit, stock_quantity: Number(e.target.value) })} /></Field>
              <Field label="Alerta Mínimo"><input type="number" className="input" value={edit.min_stock_alert} onChange={e => setEdit({ ...edit, min_stock_alert: Number(e.target.value) })} /></Field>
              <Field label="Dias Produção"><input type="number" className="input" value={edit.production_days} onChange={e => setEdit({ ...edit, production_days: Number(e.target.value) })} /></Field>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Estado">
                <select className="input" value={edit.status} onChange={e => setEdit({ ...edit, status: e.target.value as any })}>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                  <option value="esgotado">Esgotado</option>
                </select>
              </Field>
              <Field label="Tipo">
                <select className="input" value={edit.is_digital ? 'digital' : 'fisico'} onChange={e => setEdit({ ...edit, is_digital: e.target.value === 'digital' })}>
                  <option value="fisico">Físico</option>
                  <option value="digital">Digital</option>
                </select>
              </Field>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="custom" checked={edit.allows_customization} onChange={e => setEdit({ ...edit, allows_customization: e.target.checked })} className="rounded border-white/20 bg-white/5" />
              <label htmlFor="custom" className="text-sm text-white/70">Permite personalização</label>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
