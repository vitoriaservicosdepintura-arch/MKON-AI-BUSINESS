import { useCallback, useEffect, useState } from 'react'
import { Plus, Edit, Trash2, Image as ImageIcon, EyeOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/log'
import { Card, Button, Modal, Field, Skeleton, EmptyState } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'

type Category = {
  id: string
  name: string
  slug: string
  description: string | null
  cover_image_url: string | null
  display_order: number
  is_active: boolean
  parent_id: string | null
  parent_name?: string
}

export default function LojaGifsCategorias() {
  const toast = useToast()
  const [categories, setCategories] = useState<Category[] | null>(null)
  const [edit, setEdit] = useState<Category | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('gif_categories')
      .select('*, parent:gif_categories(name)')
      .order('display_order')
    if (error) toast.push('error', error.message)
    else setCategories((data || []).map(c => ({ ...c, parent_name: c.parent?.name })))
  }, [toast])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!edit) return
    setLoading(true)
    try {
      const payload = {
        name: edit.name,
        slug: edit.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, ''),
        description: edit.description,
        cover_image_url: edit.cover_image_url,
        display_order: edit.display_order,
        is_active: edit.is_active,
        parent_id: edit.parent_id
      }

      const { error } = edit.id
        ? await supabase.from('gif_categories').update(payload).eq('id', edit.id)
        : await supabase.from('gif_categories').insert(payload)

      if (error) throw error

      await logActivity('gif_category.saved', 'gif_categories', edit.id || '', { name: edit.name })
      toast.push('success', edit.id ? 'Categoria atualizada.' : 'Categoria criada.')
      setEdit(null)
      load()
    } catch (error: any) {
      toast.push('error', error.message)
    } finally {
      setLoading(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Tem certeza? Isto pode afetar produtos associados.')) return
    const { error } = await supabase.from('gif_categories').delete().eq('id', id)
    if (error) toast.push('error', error.message)
    else {
      toast.push('success', 'Categoria removida.')
      load()
    }
  }

  if (!categories) return <div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-20" />)}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Categorias</h1>
          <p className="mt-1 text-sm text-white/50">Gerencie as categorias da loja de GIFs</p>
        </div>
        <Button onClick={() => setEdit({ id: '', name: '', slug: '', description: '', cover_image_url: '', display_order: 0, is_active: true, parent_id: null })}>
          <Plus className="h-4 w-4" /> Nova Categoria
        </Button>
      </div>

      {categories.length === 0 ? (
        <EmptyState icon={<ImageIcon className="h-5 w-5" />} title="Nenhuma categoria" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {categories.map(cat => (
            <Card key={cat.id} className={cn('p-4 transition', !cat.is_active && 'opacity-50')}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white">{cat.name}</p>
                    {!cat.is_active && <EyeOff className="h-3 w-3 text-white/30" />}
                  </div>
                  {cat.parent_name && <p className="mt-1 text-xs text-white/40">Subcategoria de {cat.parent_name}</p>}
                  {cat.description && <p className="mt-2 text-xs text-white/50 line-clamp-2">{cat.description}</p>}
                  {cat.cover_image_url && (
                    <div className="mt-3 h-20 w-full overflow-hidden rounded-lg bg-white/[0.05]">
                      <img src={cat.cover_image_url} alt={cat.name} className="h-full w-full object-cover" />
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEdit(cat)}><Edit className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(cat.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar Categoria' : 'Nova Categoria'} footer={
        <>
          <Button variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button>
          <Button onClick={save} loading={loading}>Guardar</Button>
        </>
      }>
        {edit && (
          <div className="space-y-4">
            <Field label="Nome" hint="Nome da categoria"><input className="input" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Descrição"><textarea className="input" rows={3} value={edit.description || ''} onChange={e => setEdit({ ...edit, description: e.target.value })} /></Field>
            <Field label="URL da Capa (opcional)"><input className="input" value={edit.cover_image_url || ''} onChange={e => setEdit({ ...edit, cover_image_url: e.target.value })} placeholder="https://..." /></Field>
            <Field label="Ordem de exibição"><input type="number" className="input" value={edit.display_order} onChange={e => setEdit({ ...edit, display_order: Number(e.target.value) })} /></Field>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="active" checked={edit.is_active} onChange={e => setEdit({ ...edit, is_active: e.target.checked })} className="rounded border-white/20 bg-white/5" />
              <label htmlFor="active" className="text-sm text-white/70">Categoria ativa</label>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
