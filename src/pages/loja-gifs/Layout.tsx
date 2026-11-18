import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, Tag, Package, Edit3, ShoppingCart, Users, Percent, Warehouse, Euro, BarChart3, Settings, LayoutTemplate, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const STORE_NAV = [
  { to: '/loja-gifs', label: 'Visão Geral', icon: LayoutDashboard },
  { to: '/loja-gifs/categorias', label: 'Categorias', icon: Tag },
  { to: '/loja-gifs/produtos', label: 'Produtos', icon: Package },
  { to: '/loja-gifs/personalizacoes', label: 'Personalizações', icon: Edit3 },
  { to: '/loja-gifs/gabaritos', label: 'Editor de Gabaritos', icon: LayoutTemplate },
  { to: '/loja-gifs/pedidos', label: 'Pedidos', icon: ShoppingCart },
  { to: '/loja-gifs/clientes', label: 'Clientes', icon: Users },
  { to: '/loja-gifs/promocoes', label: 'Promoções', icon: Percent },
  { to: '/loja-gifs/estoque', label: 'Estoque', icon: Warehouse },
  { to: '/loja-gifs/financeiro', label: 'Financeiro', icon: Euro },
  { to: '/loja-gifs/relatorios', label: 'Relatórios', icon: BarChart3 },
  { to: '/loja-gifs/configuracoes', label: 'Configurações', icon: Settings },
]

export default function LojaGifsLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const go = (to: string) => { navigate(to); setDrawerOpen(false) }

  return (
    <div className="flex h-full min-w-0 overflow-x-clip">
      {/* Sidebar da Loja */}
      {/* Fundo escuro no telemóvel quando o menu está aberto */}
      {drawerOpen && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setDrawerOpen(false)} aria-hidden />}

      <aside className={cn(
        'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-white/[0.06] bg-[#0b1020] transition-transform duration-200',
        'lg:static lg:z-auto lg:translate-x-0 lg:bg-white/[0.02] lg:transition-all',
        drawerOpen ? 'translate-x-0' : '-translate-x-full',
        collapsed ? 'lg:w-16' : 'lg:w-64'
      )}>
        <div className="flex items-center gap-3 border-b border-white/[0.06] p-4">
          <div className="rounded-lg bg-brand/20 p-2">
            <Package className="h-5 w-5 text-brand-soft" />
          </div>
          <div className={cn(collapsed && 'lg:hidden')}>
            <p className="text-sm font-semibold text-white">Loja de GIFs</p>
            <p className="text-[10px] text-white/40">Ímanes Personalizados</p>
          </div>
          <button onClick={() => setDrawerOpen(false)} className="ml-auto rounded-md p-1 text-white/50 hover:bg-white/[0.06] lg:hidden" aria-label="Fechar menu">
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-2">
          {STORE_NAV.map(item => {
            const Icon = item.icon
            const isActive = location.pathname === item.to || (item.to !== '/loja-gifs' && location.pathname.startsWith(item.to))
            return (
              <button
                key={item.to}
                onClick={() => go(item.to)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
                  isActive ? 'bg-brand/20 text-brand-soft' : 'text-white/60 hover:bg-white/[0.05] hover:text-white'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className={cn(collapsed && 'lg:hidden')}>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden border-t border-white/[0.06] p-3 text-xs text-white/40 hover:text-white/70 lg:block"
        >
          {collapsed ? '→' : '←'}
        </button>
      </aside>

      {/* Conteúdo principal */}
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-white/[0.06] bg-[#0b1020]/90 px-3 py-2 backdrop-blur lg:hidden">
          <button onClick={() => setDrawerOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-white/80 hover:bg-white/[0.05]" aria-label="Abrir menu da loja">
            <Menu className="h-4 w-4" /> Menu da loja
          </button>
        </div>
        <Outlet />
      </main>
    </div>
  )
}
