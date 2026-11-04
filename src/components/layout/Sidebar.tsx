import { NavLink } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { NAV } from '@/lib/nav'
import { cn } from '@/lib/utils'

type Props = {
  collapsed: boolean
  onToggle: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
  badges: Record<string, number>
  floating: boolean
}

export function Logo({ small }: { small?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-soft to-brand text-[13px] font-bold text-ink">
        M
      </div>
      {!small && (
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-[0.18em]">MKON</div>
          <div className="text-[9px] uppercase tracking-[0.2em] text-white/35">AI Business</div>
        </div>
      )}
    </div>
  )
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onCloseMobile, badges, floating }: Props) {
  return (
    <>
      {/* Fundo escurecido no mobile */}
      <div
        onClick={onCloseMobile}
        className={cn('fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity lg:hidden', mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0')}
      />
      <aside
        aria-label="Navegação principal"
        className={cn(
          'glass fixed inset-y-0 left-0 z-40 flex flex-col border-y-0 border-l-0 bg-ink/70 transition-[width,transform] duration-300 ease-[cubic-bezier(.4,0,.2,1)]',
          collapsed ? 'lg:w-[68px]' : 'lg:w-60',
          'w-64',
          floating && 'lg:inset-y-3 lg:left-3 lg:rounded-2xl lg:border lg:bg-ink/15 lg:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9)] lg:backdrop-blur-2xl',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="flex h-14 items-center justify-between px-4">
          <Logo small={collapsed} />
          <button onClick={onCloseMobile} className="rounded-md p-1 text-white/50 hover:bg-white/[0.06] lg:hidden" aria-label="Fechar menu">
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden px-2.5 py-3">
          {NAV.map(({ to, label, icon: Icon, stage }) => {
            const badge = badges[to] ?? 0
            return (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  cn(
                    'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                    isActive ? 'bg-brand/15 text-brand-soft' : 'text-white/55 hover:bg-white/[0.05] hover:text-snow',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r bg-brand" />}
                    <span className="relative shrink-0">
                      <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                      {badge > 0 && collapsed && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-brand ring-2 ring-ink" />}
                    </span>
                    <span className={cn('flex-1 whitespace-nowrap transition-opacity duration-200', collapsed ? 'lg:pointer-events-none lg:w-0 lg:opacity-0' : 'opacity-100')}>
                      {label}
                    </span>
                    {!collapsed && badge > 0 && (
                      <span className="rounded-full bg-brand px-1.5 text-[10px] font-semibold text-ink">{badge}</span>
                    )}
                    {!collapsed && stage > 1 && <span className="rounded bg-white/[0.06] px-1.5 text-[9px] text-white/35">E{stage}</span>}
                    {/* Tooltip quando recolhida */}
                    {collapsed && (
                      <span className="pointer-events-none absolute left-full ml-3 hidden whitespace-nowrap rounded-md border border-white/10 bg-graphite px-2 py-1 text-xs text-snow opacity-0 shadow-xl transition-opacity group-hover:opacity-100 lg:block">
                        {label}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>

        <div className="hidden border-t border-white/[0.06] p-2.5 lg:block">
          <button
            onClick={onToggle}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-white/45 transition hover:bg-white/[0.05] hover:text-snow"
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
            {!collapsed && <span>Recolher</span>}
          </button>
        </div>
      </aside>
    </>
  )
}
