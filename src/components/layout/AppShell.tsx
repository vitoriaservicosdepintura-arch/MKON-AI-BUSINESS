import { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { AiRobot } from '@/components/AiRobot'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { OctagonAlert } from 'lucide-react'
import { UiPrefsProvider, useUiPrefs } from '@/lib/uiPrefs'
import { playClick, playNavigate } from '@/lib/sfx'

const PREF_KEY = 'mkon.sidebar.collapsed'

export function AppShell() {
  return (
    <UiPrefsProvider>
      <Shell />
    </UiPrefsProvider>
  )
}

function Shell() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(PREF_KEY) === '1' } catch { return false }
  })
  const [mobileOpen, setMobileOpen] = useState(false)
  const [kill, setKill] = useState(false)
  const [notifCount, setNotifCount] = useState(0)
  const location = useLocation()
  const { sound, floating } = useUiPrefs()
  const firstRender = useRef(true)

  useEffect(() => { try { localStorage.setItem(PREF_KEY, collapsed ? '1' : '0') } catch { /* ignore */ } }, [collapsed])
  useEffect(() => { setMobileOpen(false) }, [location.pathname])
  useEffect(() => {
    supabase.from('system_settings').select('value').eq('key', 'automation_kill_switch').maybeSingle()
      .then(({ data }) => setKill(data?.value === true))
  }, [])

  // Efeitos sonoros ao clicar em botões e ligações
  useEffect(() => {
    if (!sound) return
    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest?.('button, a, [role="button"], summary')) playClick()
    }
    document.addEventListener('click', handler, true)
    return () => document.removeEventListener('click', handler, true)
  }, [sound])

  // Som de transição entre páginas
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    if (sound) playNavigate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  const onNotifCount = useCallback((n: number) => setNotifCount(n), [])

  const contentPadding = floating
    ? collapsed ? 'lg:pl-[80px]' : 'lg:pl-[252px]'
    : collapsed ? 'lg:pl-[68px]' : 'lg:pl-60'

  return (
    <div className="min-h-full">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} badges={{ '/': notifCount }} floating={floating} />
      <div className={cn('flex min-h-screen flex-col transition-[padding] duration-300 ease-[cubic-bezier(.4,0,.2,1)]', contentPadding)}>
        <Header onMenu={() => setMobileOpen(true)} killSwitch={kill} onKillChange={setKill} onNotifCount={onNotifCount} />
        {kill && (
          <div className="flex items-center gap-2 border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-200">
            <OctagonAlert className="h-4 w-4" /> Botão de emergência ativo: todas as atividades automáticas e envios estão parados.
          </div>
        )}
        <main key={location.pathname} className="mx-auto w-full max-w-[1400px] flex-1 animate-fade-up px-4 py-6 md:px-6">
          <Outlet />
        </main>
      </div>
      <AiRobot />
    </div>
  )
}
