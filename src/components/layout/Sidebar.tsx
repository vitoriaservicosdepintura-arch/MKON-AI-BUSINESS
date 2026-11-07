import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { NavLink } from 'react-router-dom'
import { GripVertical, PanelLeftClose, PanelLeftOpen, PictureInPicture2, X } from 'lucide-react'
import { NAV } from '@/lib/nav'
import { cn } from '@/lib/utils'
import { useUiPrefs } from '@/lib/ui-prefs'
import { playNavigate } from '@/lib/sfx'
import { SwitchTrack } from '@/components/ui'

type Props = {
  collapsed: boolean
  onToggle: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
  badges: Record<string, number>
}

const POS_KEY = 'mkon.sidebar.pos'
const DEFAULT_POS = { x: 16, y: 72 }
const DESKTOP = '(min-width: 1024px)'

function readPos(): { x: number; y: number } {
  try {
    const j = JSON.parse(localStorage.getItem(POS_KEY) ?? '')
    if (typeof j?.x === 'number' && typeof j?.y === 'number') return j
  } catch { /* ignore */ }
  return DEFAULT_POS
}

export function Logo({ small }: { small?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-soft to-brand text-[13px] font-bold text-on-brand">
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

export function Sidebar({ collapsed, onToggle, mobileOpen, onCloseMobile, badges }: Props) {
  const { floating, setFloating } = useUiPrefs()
  const asideRef = useRef<HTMLElement>(null)
  const drag = useRef<{ dx: number; dy: number } | null>(null)
  const [pos, setPos] = useState(readPos)
  const [dragging, setDragging] = useState(false)

  // Mantém o menu dentro do ecrã (também quando a janela muda de tamanho)
  const clamp = useCallback((x: number, y: number) => {
    const w = asideRef.current?.offsetWidth ?? 240
    return {
      x: Math.min(Math.max(8, x), Math.max(8, window.innerWidth - w - 8)),
      y: Math.min(Math.max(8, y), Math.max(8, window.innerHeight - 120)),
    }
  }, [])

  useEffect(() => {
    const onResize = () => setPos((p) => clamp(p.x, p.y))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [clamp])

  useEffect(() => { try { localStorage.setItem(POS_KEY, JSON.stringify(pos)) } catch { /* ignore */ } }, [pos])

  // Ao ativar (ou mudar de largura), garante que fica visível
  useEffect(() => { if (floating) setPos((p) => clamp(p.x, p.y)) }, [floating, collapsed, clamp])

  const canDrag = () => floating && window.matchMedia(DESKTOP).matches

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!canDrag() || (e.target as HTMLElement).closest('button')) return
    const r = asideRef.current?.getBoundingClientRect()
    if (!r) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top }
    setDragging(true)
  }
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    setPos(clamp(e.clientX - drag.current.dx, e.clientY - drag.current.dy))
  }
  const onUp = () => { drag.current = null; setDragging(false) }

  return (
    <>
      {/* Fundo escurecido no mobile */}
      <div
        onClick={onCloseMobile}
        className={cn('fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity lg:hidden', mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0')}
      />
      <aside
        ref={asideRef}
        aria-label="Navegação principal"
        data-floating={floating ? 'true' : 'false'}
        style={{ '--fx': `${pos.x}px`, '--fy': `${pos.y}px` } as CSSProperties}
        className={cn(
          'glass fixed z-40 flex flex-col transition-[width,transform,left,top,background-color,border-radius,box-shadow] duration-300 ease-[cubic-bezier(.4,0,.2,1)]',
          'inset-y-0 left-0 w-64 border-y-0 border-l-0 bg-ink/70',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          dragging && '!transition-none',
          collapsed ? 'lg:w-[68px]' : 'lg:w-60',
          // Menu flutuante: solto, sobreposto ao conteúdo e bem transparente (só em ecrãs grandes)
          floating && 'lg:inset-y-auto lg:left-[var(--fx)] lg:top-[var(--fy)] lg:h-auto lg:max-h-[calc(100vh-var(--fy)-1rem)] lg:rounded-2xl lg:border lg:bg-ink/25 lg:shadow-2xl lg:shadow-black/25 lg:backdrop-blur-md',
        )}
      >
        <div
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className={cn('flex h-14 shrink-0 items-center justify-between px-4', floating && 'lg:cursor-grab lg:touch-none lg:select-none lg:active:cursor-grabbing')}
          title={floating ? 'Arraste para mover o menu' : undefined}
        >
          <Logo small={collapsed} />
          {floating && !collapsed && <GripVertical aria-hidden className="hidden h-4 w-4 text-white/30 lg:block" />}
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
                onClick={() => { playNavigate(); onCloseMobile?.() }}
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
                      <span className="rounded-full bg-brand px-1.5 text-[10px] font-semibold text-on-brand">{badge}</span>
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

        <div className="hidden shrink-0 space-y-0.5 border-t border-white/[0.06] p-2.5 lg:block">
          {/* Ativar / desativar menu flutuante */}
          <button
            role="switch"
            aria-checked={floating}
            onClick={() => setFloating(!floating)}
            title="Menu flutuante"
            className={cn(
              'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition hover:bg-white/[0.05]',
              floating ? 'text-brand-soft' : 'text-white/45 hover:text-snow',
            )}
          >
            <PictureInPicture2 className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span className="flex-1 whitespace-nowrap text-left">Menu flutuante</span>}
            {!collapsed && <SwitchTrack checked={floating} />}
            {collapsed && (
              <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-md border border-white/10 bg-graphite px-2 py-1 text-xs text-snow opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
                Menu flutuante: {floating ? 'ligado' : 'desligado'}
              </span>
            )}
          </button>

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
