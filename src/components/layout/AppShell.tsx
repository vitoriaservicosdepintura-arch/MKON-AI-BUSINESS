import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { AiRobot } from '@/components/AiRobot'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useUiPrefs } from '@/lib/ui-prefs'
import { OctagonAlert } from 'lucide-react'

const PREF_KEY = 'mkon.sidebar.collapsed'

export function AppShell() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(PREF_KEY) === '1' } catch { return false }
  })
  const [mobileOpen, setMobileOpen] = useState(false)
  const [kill, setKill] = useState(false)
  const [notifCount, setNotifCount] = useState(0)
  const location = useLocation()
  const { floating } = useUiPrefs()

  useEffect(() => { try { localStorage.setItem(PREF_KEY, collapsed ? '1' : '0') } catch { /* ignore */ } }, [collapsed])
  useEffect(() => { setMobileOpen(false) }, [location.pathname])
  useEffect(() => {
    supabase.from('system_settings').select('value').eq('key', 'automation_kill_switch').maybeSingle()
      .then(({ data }) => setKill(data?.value === true))
  }, [])

  const onNotifCount = useCallback((n: number) => setNotifCount(n), [])

  return (
    <div className="min-h-full">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} badges={{ '/': notifCount }} />
      <div className={cn('flex min-h-screen flex-col transition-[padding] duration-300 ease-[cubic-bezier(.4,0,.2,1)]', floating ? 'lg:pl-0' : collapsed ? 'lg:pl-[68px]' : 'lg:pl-60')}>
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
