import { useCallback, useEffect, useState } from 'react'
import { Euro, TrendingUp, Package, ShoppingCart } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardHeader, Skeleton } from '@/components/ui'
import { cn } from '@/lib/utils'

type FinancialData = {
  totalRevenue: number
  totalOrders: number
  averageTicket: number
  totalProductionCost: number
  totalDiscounts: number
  totalShipping: number
  grossProfit: number
  netProfit: number
  topProducts: Array<{ name: string; revenue: number; quantity: number }>
  monthlyData: Array<{ month: string; revenue: number; orders: number }>
}

export default function LojaGifsFinanceiro() {
  const [data, setData] = useState<FinancialData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const now = new Date()
      let startDate = new Date()
      
      if (period === 'month') startDate.setMonth(now.getMonth() - 1)
      else if (period === 'quarter') startDate.setMonth(now.getMonth() - 3)
      else startDate.setFullYear(now.getFullYear() - 1)

      const { data: orders } = await supabase
        .from('gif_orders')
        .select('*, gif_order_items(*)')
        .gte('created_at', startDate.toISOString())
        .neq('status', 'cancelado')

      const ordersData = orders || []
      
      const totalRevenue = ordersData.reduce((sum, o) => sum + Number(o.total_amount), 0)
      const totalOrders = ordersData.length
      const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0
      
      const totalProductionCost = ordersData.reduce((sum: number, o: any) => {
        const items = o.gif_order_items || []
        return sum + items.reduce((s: number, i: any) => s + (Number(i.production_cost) * i.quantity), 0)
      }, 0)
      
      const totalDiscounts = ordersData.reduce((sum, o) => sum + Number(o.discount_amount), 0)
      const totalShipping = ordersData.reduce((sum, o) => sum + Number(o.shipping_cost), 0)
      const grossProfit = totalRevenue - totalProductionCost
      const netProfit = grossProfit - totalShipping

      const productMap = new Map<string, { name: string; revenue: number; quantity: number }>()
      ordersData.forEach(o => {
        (o.gif_order_items || []).forEach((item: any) => {
          const existing = productMap.get(item.product_id) || { name: item.product_name, revenue: 0, quantity: 0 }
          existing.revenue += Number(item.total_price)
          existing.quantity += item.quantity
          productMap.set(item.product_id, existing)
        })
      })

      const topProducts = Array.from(productMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)

      const monthlyMap = new Map<string, { revenue: number; orders: number }>()
      ordersData.forEach(o => {
        const month = new Date(o.created_at).toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' })
        const existing = monthlyMap.get(month) || { revenue: 0, orders: 0 }
        existing.revenue += Number(o.total_amount)
        existing.orders += 1
        monthlyMap.set(month, existing)
      })

      const monthlyData = Array.from(monthlyMap.entries())
        .map(([month, data]) => ({ month, ...data }))
        .slice(-6)

      setData({
        totalRevenue,
        totalOrders,
        averageTicket,
        totalProductionCost,
        totalDiscounts,
        totalShipping,
        grossProfit,
        netProfit,
        topProducts,
        monthlyData
      })
    } catch (error) {
      console.error('Erro ao carregar dados financeiros:', error)
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { load() }, [load])

  if (loading) {
    return <div className="space-y-6"><Skeleton className="h-8 w-48" /><div className="grid gap-4 md:grid-cols-4">{[0,1,2,3].map(i => <Skeleton key={i} className="h-32" />)}</div></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Financeiro da Loja</h1>
          <p className="mt-1 text-sm text-white/50">Indicadores financeiros da Loja de GIFs</p>
        </div>
        <div className="flex gap-2">
          {(['month', 'quarter', 'year'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs transition',
                period === p ? 'bg-brand/20 text-brand-soft' : 'bg-white/5 text-white/50 hover:text-white'
              )}
            >
              {p === 'month' ? 'Mês' : p === 'quarter' ? 'Trimestre' : 'Ano'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/40">Faturamento</p>
              <p className="mt-2 text-2xl font-semibold text-white">€{data?.totalRevenue.toFixed(2)}</p>
            </div>
            <div className="rounded-lg bg-brand/20 p-3">
              <Euro className="h-5 w-5 text-brand-soft" />
            </div>
          </div>
          <p className="mt-3 text-[11px] text-white/35">{data?.totalOrders} pedidos</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/40">Ticket Médio</p>
              <p className="mt-2 text-2xl font-semibold text-white">€{data?.averageTicket.toFixed(2)}</p>
            </div>
            <div className="rounded-lg bg-blue-500/20 p-3">
              <ShoppingCart className="h-5 w-5 text-blue-400" />
            </div>
          </div>
          <p className="mt-3 text-[11px] text-white/35">Por pedido</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/40">Lucro Bruto</p>
              <p className="mt-2 text-2xl font-semibold text-white">€{data?.grossProfit.toFixed(2)}</p>
            </div>
            <div className="rounded-lg bg-emerald-500/20 p-3">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
            </div>
          </div>
          <p className="mt-3 text-[11px] text-white/35">Antes de envio</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/40">Lucro Líquido</p>
              <p className="mt-2 text-2xl font-semibold text-white">€{data?.netProfit.toFixed(2)}</p>
            </div>
            <div className="rounded-lg bg-purple-500/20 p-3">
              <Package className="h-5 w-5 text-purple-400" />
            </div>
          </div>
          <p className="mt-3 text-[11px] text-white/35">Após custos</p>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="Custos Detalhados" />
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">Custo de Produção</span>
              <span className="font-mono text-white">€{data?.totalProductionCost.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">Descontos Concedidos</span>
              <span className="font-mono text-white">€{data?.totalDiscounts.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">Custos de Envio</span>
              <span className="font-mono text-white">€{data?.totalShipping.toFixed(2)}</span>
            </div>
            <div className="border-t border-white/[0.06] pt-3 flex items-center justify-between text-sm font-medium">
              <span className="text-white">Lucro Líquido</span>
              <span className="font-mono text-emerald-400">€{data?.netProfit.toFixed(2)}</span>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Produtos Mais Vendidos" />
          <div className="p-5 space-y-2 max-h-64 overflow-y-auto">
            {data?.topProducts && data.topProducts.length > 0 ? (
              data.topProducts.map((p, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                  <div className="flex-1">
                    <p className="text-sm text-white">{p.name}</p>
                    <p className="text-xs text-white/40">{p.quantity} un.</p>
                  </div>
                  <span className="text-sm font-mono text-white">€{p.revenue.toFixed(2)}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-white/40 text-center py-8">Sem dados</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
