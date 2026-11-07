import { useCallback, useEffect, useState } from 'react'
import { Edit, Image as ImageIcon, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, Button, Skeleton, EmptyState } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'

type Customization = {
  id: string
  order_item_id: string
  customer_id: string
  customer_name?: string
  status: string
  customization_type: string[]
  custom_text: string | null
  customer_instructions: string | null
  production_notes: string | null
  created_at: string
}

export default function LojaGifsPersonalizacoes() {
  const toast = useToast()
  const [customizations, setCustomizations] = useState<Customization[] | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('gif_customizations')
      .select('*, customer:gif_customers(name)')
      .order('created_at', { ascending: false })
    if (error) toast.push('error', error.message)
    else setCustomizations((data || []).map(c => ({ ...c, customer_name: c.customer?.name })))
  }, [toast])

  useEffect(() => { load() }, [load])

  const updateStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase.from('gif_customizations').update({ status: newStatus }).eq('id', id)
    if (error) toast.push('error', error.message)
    else {
      toast.push('success', 'Status atualizado.')
      load()
    }
  }

  const statusColor = (status: string) => {
    const colors: Record<string, string> = {
      aguardando_personalizacao: 'bg-amber-500/20 text-amber-300',
      personalizacao_andamento: 'bg-blue-500/20 text-blue-300',
      aguardando_aprovacao: 'bg-purple-500/20 text-purple-300',
      aprovado_cliente: 'bg-green-500/20 text-green-300',
      em_producao: 'bg-orange-500/20 text-orange-300',
      finalizado: 'bg-emerald-500/20 text-emerald-300'
    }
    return colors[status] || 'bg-slate-500/20 text-slate-300'
  }

  const statusLabel = (status: string) => {
    const labels: Record<string, string> = {
      aguardando_personalizacao: 'Aguardando',
      personalizacao_andamento: 'Em Andamento',
      aguardando_aprovacao: 'Aguardando Aprovação',
      aprovado_cliente: 'Aprovado',
      em_producao: 'Em Produção',
      finalizado: 'Finalizado'
    }
    return labels[status] || status
  }

  if (!customizations) return <div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-24" />)}</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Personalizações</h1>
        <p className="mt-1 text-sm text-white/50">Gestão de personalizações solicitadas pelos clientes</p>
      </div>

      {customizations.length === 0 ? (
        <EmptyState icon={<ImageIcon className="h-5 w-5" />} title="Nenhuma personalização" />
      ) : (
        <div className="space-y-3">
          {customizations.map(c => (
            <Card key={c.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold text-white">{c.customer_name || 'Cliente'}</p>
                    <span className={cn('inline-flex rounded-full px-2 py-1 text-[10px] font-medium', statusColor(c.status))}>
                      {statusLabel(c.status)}
                    </span>
                  </div>
                  {c.custom_text && <p className="mt-2 text-xs text-white/70">{c.custom_text}</p>}
                  {c.customer_instructions && <p className="mt-1 text-xs text-white/50 italic">{c.customer_instructions}</p>}
                </div>
                <div className="flex gap-1">
                  {c.status === 'aguardando_personalizacao' && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus(c.id, 'personalizacao_andamento')}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {c.status === 'personalizacao_andamento' && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus(c.id, 'aguardando_aprovacao')}>
                      <CheckCircle className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
