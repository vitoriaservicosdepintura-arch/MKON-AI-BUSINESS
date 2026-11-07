import { useCallback, useEffect, useState } from 'react'
import { BarChart3, TrendingUp, Euro, ShoppingCart, Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardHeader, Skeleton, Button } from '@/components/ui'
import { cn } from '@/lib/utils'

type ReportData = {
  totalRevenue: number
  totalOrders: number
  averageTicket: number
  totalProfit: number
  conversionRate: number
  topCategories: Array<{ name: string; revenue: number; orders: number }>
  monthlyTrends: Array<{ month: string; revenue: number; orders: number; profit: number }>
  customerStats: {
    newCustomers: number
    returningCustomers: number
    averageSpend: number
  }
  productStats: {
    totalProducts: number
    activeProducts: number
    outOfStock: number
  }
}

export default function LojaGifsRelatorios() {
  const [data, setData] = useState<ReportData | null>(null)
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

      const [
        ordersRes,
        productsRes,
        customersRes
      ] = await Promise.all([
        supabase.from('gif_orders').select('*, gif_order_items(*), gif_customers(*)').gte('created_at', startDate.toISOString()).neq('status', 'cancelado'),
        supabase.from('gif_products').select('*, gif_categories(name)'),
        supabase.from('gif_customers').select('*, gif_orders(count)')
      ])

      const orders = ordersRes.data || []
      const products = productsRes.data || []
      const customers = customersRes.data || []

      const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total_amount), 0)
      const totalOrders = orders.length
      const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0
      const totalProductionCost = orders.reduce((sum: number, o: any) => {
        const items = o.gif_order_items || []
        return sum + items.reduce((s: number, i: any) => s + (Number(i.production_cost) * i.quantity), 0)
      }, 0)
      
      const totalProfit = totalRevenue - totalProductionCost

      const newCustomers = customers.filter(c => {
        const firstOrder = c.gif_orders?.[0]
        return firstOrder && new Date(firstOrder.created_at) >= startDate
      }).length

      const returningCustomers = customers.length - newCustomers
      const averageSpend = customers.length > 0 ? customers.reduce((sum, c) => sum + Number(c.total_spent), 0) / customers.length : 0

      const productStats = {
        totalProducts: products.length,
        activeProducts: products.filter(p => p.status === 'ativo').length,
        outOfStock: products.filter(p => p.stock_quantity === 0).length
      }

      const categoryMap = new Map<string, { name: string; revenue: number; orders: number }>()
      orders.forEach((o: any) => {
        (o.gif_order_items || []).forEach((item: any) => {
          const product = products.find((p: any) => p.id === item.product_id)
          const categoryName = product?.gif_categories?.name || 'Sem Categoria'
          const existing = categoryMap.get(categoryName) || { name: categoryName, revenue: 0, orders: 0 }
          existing.revenue += Number(item.total_price)
          existing.orders += 1
          categoryMap.set(categoryName, existing)
        })
      })

      const topCategories = Array.from(categoryMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)

      const monthlyMap = new Map<string, { revenue: number; orders: number; profit: number }>()
      orders.forEach(o => {
        const month = new Date(o.created_at).toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' })
        const existing = monthlyMap.get(month) || { revenue: 0, orders: 0, profit: 0 }
        existing.revenue += Number(o.total_amount)
        existing.orders += 1
        existing.profit += Number(o.total_amount) * 0.4
        monthlyMap.set(month, existing)
      })

      const monthlyTrends = Array.from(monthlyMap.entries())
        .map(([month, data]) => ({ month, ...data }))
        .slice(-6)

      setData({
        totalRevenue,
        totalOrders,
        averageTicket,
        totalProfit,
        conversionRate: 0,
        topCategories,
        monthlyTrends,
        customerStats: {
          newCustomers,
          returningCustomers,
          averageSpend
        },
        productStats
      })
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error)
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { load() }, [load])

  const exportReport = () => {
    if (!data) return
    
    const csv = [
      ['Relatório Loja de GIFs', `Período: ${period}`],
      [],
      ['Faturamento Total', `€${data.totalRevenue.toFixed(2)}`],
      ['Total de Pedidos', data.totalOrders],
      ['Ticket Médio', `€${data.averageTicket.toFixed(2)}`],
      ['Lucro Total', `€${data.totalProfit.toFixed(2)}`],
      [],
      ['Top Categorias'],
      ['Categoria', 'Receita', 'Pedidos'],
      ...data.topCategories.map(c => [c.name, `€${c.revenue.toFixed(2)}`, c.orders])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio-loja-gifs-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div className="space-y-6"><Skeleton className="h-8 w-48" /><div className="grid gap-4 md:grid-cols-4">{[0,1,2,3].map(i => <Skeleton key={i} className="h-32" />)}</div></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Relatórios</h1>
          <p className="mt-1 text-sm text-white/50">Análises e insights da Loja de GIFs</p>
        </div>
        <div className="flex items-center gap-2">
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
          <Button variant="outline" onClick={exportReport}>
            <Download className="h-4 w-4" /> Exportar
          </Button>
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
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/40">Pedidos</p>
              <p className="mt-2 text-2xl font-semibold text-white">{data?.totalOrders}</p>
            </div>
            <div className="rounded-lg bg-blue-500/20 p-3">
              <ShoppingCart className="h-5 w-5 text-blue-400" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/40">Lucro</p>
              <p className="mt-2 text-2xl font-semibold text-white">€{data?.totalProfit.toFixed(2)}</p>
            </div>
            <div className="rounded-lg bg-emerald-500/20 p-3">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/40">Ticket Médio</p>
              <p className="mt-2 text-2xl font-semibold text-white">€{data?.averageTicket.toFixed(2)}</p>
            </div>
            <div className="rounded-lg bg-purple-500/20 p-3">
              <BarChart3 className="h-5 w-5 text-purple-400" />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="Top Categorias" />
          <div className="p-5 space-y-3 max-h-64 overflow-y-auto">
            {data?.topCategories && data.topCategories.length > 0 ? (
              data.topCategories.map((c, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-white/50 w-6">{i + 1}.</span>
                    <span className="text-sm text-white">{c.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono text-white">€{c.revenue.toFixed(2)}</p>
                    <p className="text-[10px] text-white/30">{c.orders} pedidos</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-white/40 text-center py-8">Sem dados</p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Estatísticas de Clientes" />
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">Novos Clientes</span>
              <span className="font-mono text-white">{data?.customerStats.newCustomers}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">Clientes Recorrentes</span>
              <span className="font-mono text-white">{data?.customerStats.returningCustomers}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">Gasto Médio</span>
              <span className="font-mono text-white">€{data?.customerStats.averageSpend.toFixed(2)}</span>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Produtos" />
        <div className="p-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-center">
            <p className="text-2xl font-semibold text-white">{data?.productStats.totalProducts}</p>
            <p className="text-xs text-white/40">Total Produtos</p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-center">
            <p className="text-2xl font-semibold text-white">{data?.productStats.activeProducts}</p>
            <p className="text-xs text-white/40">Ativos</p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-center">
            <p className="text-2xl font-semibold text-white">{data?.productStats.outOfStock}</p>
            <p className="text-xs text-white/40">Esgotados</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
