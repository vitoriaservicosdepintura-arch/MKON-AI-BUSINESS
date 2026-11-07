import { useCallback, useEffect, useState } from 'react'
import { Plus, Edit, Trash2, Tag, Calendar, Percent } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/log'
import { Card, Button, Modal, Field, Skeleton, EmptyState } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'

type Promotion = {
  id: string
  name: string
  description: string | null
  promotion_type: string
  discount_value: number
  start_date: string
  end_date: string
  is_active: boolean
  promo_code: string | null
}

export default function LojaGifsPromocoes() {
  const toast = useToast()
  const [promotions, setPromotions] = useState<Promotion[] | null>(null)
  const [edit, setEdit] = useState<Promotion | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('gif_promotions')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) toast.push('error', error.message)
    else setPromotions(data)
  }, [toast])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!edit) return
    setLoading(true)
    try {
      const payload = {
        name: edit.name,
        description: edit.description,
        promotion_type: edit.promotion_type,
        discount_value: edit.discount_value,
        start_date: edit.start_date,
        end_date: edit.end_date,
        is_active: edit.is_active,
        promo_code: edit.promo_code
      }

      const { error } = edit.id
        ? await supabase.from('gif_promotions').update(payload).eq('id', edit.id)
        : await supabase.from('gif_promotions').insert(payload)

      if (error) throw error
      await logActivity('gif_promotion.saved', 'gif_promotions', edit.id || '', { name: edit.name })
      toast.push('success', edit.id ? 'Promoção atualizada.' : 'Promoção criada.')
      setEdit(null)
      load()
    } catch (error: any) {
      toast.push('error', error.message)
    } finally {
      setLoading(false)
    }
  }

  if (!promotions) return <div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-20" />)}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Promoções</h1>
          <p className="mt-1 text-sm text-white/50">Campanhas promocionais e descontos</p>
        </div>
        <Button onClick={() => setEdit({ id: '', name: '', description: '', promotion_type: 'percentual', discount_value: 0, start_date: new Date().toISOString().split('T')[0], end_date: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0], is_active: true, promo_code: '' })}>
          <Plus className="h-4 w-4" /> Nova Promoção
        </Button>
      </div>

      {promotions.length === 0 ? (
        <EmptyState icon={<Tag className="h-5 w-5" />} title="Nenhuma promoção" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {promotions.map(p => (
            <Card key={p.id} className={cn('p-4', !p.is_active && 'opacity-50')}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white">{p.name}</p>
                    {!p.is_active && <span className="rounded-full bg-slate-500/20 px-2 py-1 text-[10px] font-medium text-slate-300">Inativa</span>}
                  </div>
                  {p.description && <p className="mt-1 text-xs text-white/50">{p.description}</p>}
                  <div className="mt-2 flex items-center gap-4 text-xs text-white/40">
                    <span className="flex items-center gap-1">
                      <Percent className="h-3 w-3" />
                      {p.promotion_type === 'percentual' ? `${p.discount_value}%` : `€${p.discount_value}`}
                    </span>
                    {p.promo_code && <span className="font-mono">{p.promo_code}</span>}
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-white/30">
                    <Calendar className="h-3 w-3" />
                    {new Date(p.start_date).toLocaleDateString('pt-PT')} - {new Date(p.end_date).toLocaleDateString('pt-PT')}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEdit(p)}><Edit className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm('Remover promoção?')) { supabase.from('gif_promotions').delete().eq('id', p.id).then(() => load()) } }}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar Promoção' : 'Nova Promoção'} footer={
        <>
          <Button variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button>
          <Button onClick={save} loading={loading}>Guardar</Button>
        </>
      }>
        {edit && (
          <div className="space-y-4">
            <Field label="Nome"><input className="input" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Descrição"><textarea className="input" rows={2} value={edit.description || ''} onChange={e => setEdit({ ...edit, description: e.target.value })} /></Field>
            <Field label="Tipo">
              <select className="input" value={edit.promotion_type} onChange={e => setEdit({ ...edit, promotion_type: e.target.value })}>
                <option value="percentual">Percentual</option>
                <option value="valor_fixo">Valor Fixo</option>
              </select>
            </Field>
            <Field label="Valor"><input type="number" step="0.01" className="input" value={edit.discount_value} onChange={e => setEdit({ ...edit, discount_value: Number(e.target.value) })} /></Field>
            <Field label="Código Promocional (opcional)"><input className="input" value={edit.promo_code || ''} onChange={e => setEdit({ ...edit, promo_code: e.target.value })} /></Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Data Início"><input type="date" className="input" value={edit.start_date} onChange={e => setEdit({ ...edit, start_date: e.target.value })} /></Field>
              <Field label="Data Fim"><input type="date" className="input" value={edit.end_date} onChange={e => setEdit({ ...edit, end_date: e.target.value })} /></Field>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="active" checked={edit.is_active} onChange={e => setEdit({ ...edit, is_active: e.target.checked })} className="rounded border-white/20 bg-white/5" />
              <label htmlFor="active" className="text-sm text-white/70">Promoção ativa</label>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
