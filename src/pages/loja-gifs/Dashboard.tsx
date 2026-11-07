import { useEffect, useState } from 'react'
import { Euro, TrendingUp, Users, AlertTriangle, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardHeader, Skeleton } from '@/components/ui'
import { cn, dateTime } from '@/lib/utils'

type GifStats = {
  totalSales: number
  monthlyRevenue: number
  estimatedProfit: number
  pendingOrders: number
  inProduction: number
  shippedOrders: number
  totalCustomers: number
  totalProducts: number
  topProducts: Array<{ name: string; sales: number }>
  topCategories: Array<{ name: string; revenue: number }>
  recentOrders: Array<{
    id: string
    order_number: string
    customer_name: string
    total_amount: number
    status: string
    created_at: string
  }>
  lowStock: Array<{ name: string; stock: number; min_stock: number }>
}

export default function LojaGifsDashboard() {
  const [stats, setStats] = useState<GifStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    setLoading(true)
    try {
      const [
        salesRes,
        ordersRes,
        customersRes,
        productsRes,
        recentRes,
        lowStockRes
      ] = await Promise.all([
        supabase.from('gif_orders').select('total_amount, created_at'),
        supabase.from('gif_orders').select('id, status, total_amount'),
        supabase.from('gif_customers').select('id'),
        supabase.from('gif_products').select('id, status'),
        supabase.from('gif_orders').select('id, order_number, total_amount, status, created_at, gif_customers(name)').order('created_at', { ascending: false }).limit(10),
        supabase.from('gif_products').select('name, stock_quantity, min_stock_alert').lt('stock_quantity', 'min_stock_alert')
      ])

      const orders = ordersRes.data || []
      const products = productsRes.data || []
      const recentOrders = recentRes.data || []
      const lowStock = lowStockRes.data || []

      const sales = salesRes.data || []
      const now = new Date()
      const currentMonth = now.getMonth()
      const currentYear = now.getFullYear()

      const monthlySales = sales.filter(s => {
        const d = new Date(s.created_at)
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear
      })

      const totalSales = sales.reduce((sum, s) => sum + Number(s.total_amount), 0)
      const monthlyRevenue = monthlySales.reduce((sum, s) => sum + Number(s.total_amount), 0)
      const estimatedProfit = monthlyRevenue * 0.4 // 40% margem estimada

      setStats({
        totalSales,
        monthlyRevenue,
        estimatedProfit,
        pendingOrders: orders.filter(o => o.status === 'novo_pedido').length,
        inProduction: orders.filter(o => o.status === 'em_producao').length,
        shippedOrders: orders.filter(o => o.status === 'enviado').length,
        totalCustomers: customersRes.data?.length || 0,
        totalProducts: products.filter(p => p.status === 'ativo').length,
        topProducts: [],
        topCategories: [],
        recentOrders: recentOrders.map(r => ({
          id: r.id,
          order_number: r.order_number,
          customer_name: (r as any).gif_customers?.name || 'N/A',
          total_amount: r.total_amount,
          status: r.status,
          created_at: r.created_at
        })),
        lowStock: lowStock.map(l => ({
          name: l.name,
          stock: l.stock_quantity,
          min_stock: l.min_stock_alert
        }))
      })
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error)
    } finally {
      setLoading(false)
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Loja de GIFs</h1>
        <p className="mt-1 text-sm text-white/50">Visão geral da loja de ímanes e GIFs personalizados</p>
      </div>

      {/* Indicadores principais */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/40">Faturamento Mês</p>
              <p className="mt-2 text-2xl font-semibold text-white">€{stats?.monthlyRevenue.toFixed(2)}</p>
            </div>
            <div className="rounded-lg bg-brand/20 p-3">
              <Euro className="h-5 w-5 text-brand-soft" />
            </div>
          </div>
          <p className="mt-3 text-[11px] text-white/35">Total: €{stats?.totalSales.toFixed(2)}</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/40">Lucro Estimado</p>
              <p className="mt-2 text-2xl font-semibold text-white">€{stats?.estimatedProfit.toFixed(2)}</p>
            </div>
            <div className="rounded-lg bg-emerald-500/20 p-3">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
            </div>
          </div>
          <p className="mt-3 text-[11px] text-white/35">Margem ~40%</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/40">Pedidos Pendentes</p>
              <p className="mt-2 text-2xl font-semibold text-white">{stats?.pendingOrders}</p>
            </div>
            <div className="rounded-lg bg-amber-500/20 p-3">
              <Clock className="h-5 w-5 text-amber-400" />
            </div>
          </div>
          <p className="mt-3 text-[11px] text-white/35">{stats?.inProduction} em produção</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/40">Total Clientes</p>
              <p className="mt-2 text-2xl font-semibold text-white">{stats?.totalCustomers}</p>
            </div>
            <div className="rounded-lg bg-blue-500/20 p-3">
              <Users className="h-5 w-5 text-blue-400" />
            </div>
          </div>
          <p className="mt-3 text-[11px] text-white/35">{stats?.totalProducts} produtos ativos</p>
        </Card>
      </div>

      {/* Alertas de estoque baixo */}
      {stats?.lowStock && stats.lowStock.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader title="Alertas de Estoque" subtitle="Produtos com estoque abaixo do mínimo" />
          <div className="p-5 space-y-2">
            {stats.lowStock.map((item, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-2">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <span className="text-sm text-white">{item.name}</span>
                </div>
                <span className="text-xs font-mono text-amber-300">{item.stock} / {item.min_stock}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Pedidos recentes */}
      <Card>
        <CardHeader title="Pedidos Recentes" subtitle="Últimos 10 pedidos" />
        <div className="divide-y divide-white/[0.05]">
          {stats?.recentOrders && stats.recentOrders.length > 0 ? (
            stats.recentOrders.map(order => (
              <div key={order.id} className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02]">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-sm font-medium text-white">{order.order_number}</p>
                    <p className="text-xs text-white/40">{order.customer_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-mono text-white">€{order.total_amount.toFixed(2)}</span>
                  <span className={cn('rounded-full px-2 py-1 text-[10px] font-medium', statusColor(order.status))}>
                    {statusLabel(order.status)}
                  </span>
                  <span className="text-xs text-white/30">{dateTime(order.created_at)}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-sm text-white/40">Nenhum pedido registrado</div>
          )}
        </div>
      </Card>
    </div>
  )
}
