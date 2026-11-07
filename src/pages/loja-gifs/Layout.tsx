import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, Tag, Package, Edit3, ShoppingCart, Users, Percent, Warehouse, Euro, BarChart3, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const STORE_NAV = [
  { to: '/loja-gifs', label: 'Visão Geral', icon: LayoutDashboard },
  { to: '/loja-gifs/categorias', label: 'Categorias', icon: Tag },
  { to: '/loja-gifs/produtos', label: 'Produtos', icon: Package },
  { to: '/loja-gifs/personalizacoes', label: 'Personalizações', icon: Edit3 },
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

  return (
    <div className="flex h-full">
      {/* Sidebar da Loja */}
      <aside className={cn(
        'flex flex-col border-r border-white/[0.06] bg-white/[0.02] transition-all',
        collapsed ? 'w-16' : 'w-64'
      )}>
        <div className="flex items-center gap-3 border-b border-white/[0.06] p-4">
          <div className="rounded-lg bg-brand/20 p-2">
            <Package className="h-5 w-5 text-brand-soft" />
          </div>
          {!collapsed && (
            <div>
              <p className="text-sm font-semibold text-white">Loja de GIFs</p>
              <p className="text-[10px] text-white/40">Ímanes Personalizados</p>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-1 p-2">
          {STORE_NAV.map(item => {
            const Icon = item.icon
            const isActive = location.pathname === item.to || (item.to !== '/loja-gifs' && location.pathname.startsWith(item.to))
            return (
              <button
                key={item.to}
                onClick={() => navigate(item.to)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
                  isActive ? 'bg-brand/20 text-brand-soft' : 'text-white/60 hover:bg-white/[0.05] hover:text-white'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </button>
            )
          })}
        </nav>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="border-t border-white/[0.06] p-3 text-xs text-white/40 hover:text-white/70"
        >
          {collapsed ? '→' : '←'}
        </button>
      </aside>

      {/* Conteúdo principal */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
