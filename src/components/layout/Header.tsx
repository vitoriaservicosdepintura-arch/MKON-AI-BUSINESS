import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Bot, Command, LogOut, Menu, OctagonAlert, PanelLeft, Plug, Search, Settings, Volume2, VolumeX, LayoutPanelLeft } from 'lucide-react'
import { Button, Modal } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { cn, relativeTime } from '@/lib/utils'
import { logActivity } from '@/lib/log'
import { useUiPrefs } from '@/lib/uiPrefs'

type Notification = { id: string; level: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string }

function useClickOutside(onOut: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onOut()
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onOut])
  return ref
}

function Clock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(t) }, [])
  return (
    <div className="hidden text-right leading-tight xl:block">
      <div className="text-[13px] font-medium tabular-nums">{now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</div>
      <div className="text-[10px] text-white/40">{now.toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: 'short' })}</div>
    </div>
  )
}

export function Header({ onMenu, killSwitch, onKillChange, onNotifCount }: {
  onMenu: () => void; killSwitch: boolean; onKillChange: (v: boolean) => void; onNotifCount: (n: number) => void
}) {
  const nav = useNavigate()
  const { admin, signOut } = useAuth()
  const toast = useToast()
  const { sound, floating, toggleSound, toggleFloating } = useUiPrefs()
  const [query, setQuery] = useState('')
  const [palette, setPalette] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [confirmKill, setConfirmKill] = useState(false)
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [agents, setAgents] = useState({ active: 0, total: 0 })
  const [integrations, setIntegrations] = useState({ connected: 0, total: 0 })
  const notifRef = useClickOutside(() => setNotifOpen(false))
  const profileRef = useClickOutside(() => setProfileOpen(false))

  useEffect(() => {
    const load = async () => {
      const [n, a, i] = await Promise.all([
        supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(15),
        supabase.from('ai_agents').select('status'),
        supabase.from('integrations').select('status'),
      ])
      const list = (n.data ?? []) as Notification[]
      setNotifs(list)
      onNotifCount(list.filter((x) => !x.read_at).length)
      const ag = (a.data ?? []) as { status: string }[]
      setAgents({ active: ag.filter((x) => x.status === 'ativo').length, total: ag.length })
      const ig = (i.data ?? []) as { status: string }[]
      setIntegrations({ connected: ig.filter((x) => x.status === 'conectada').length, total: ig.length })
    }
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [onNotifCount])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(true) } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const unread = notifs.filter((n) => !n.read_at).length

  const markAllRead = async () => {
    const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
    if (error) return toast.push('error', 'Não foi possível atualizar as notificações.')
    setNotifs((s) => s.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })))
    onNotifCount(0)
  }

  const submitSearch = (e: FormEvent) => {
    e.preventDefault()
    if (query.trim()) nav(`/crm?q=${encodeURIComponent(query.trim())}`)
  }

  const toggleKill = async () => {
    const next = !killSwitch
    const { error } = await supabase.from('system_settings').upsert({ key: 'automation_kill_switch', value: next })
    setConfirmKill(false)
    if (error) return toast.push('error', 'Falha ao alterar o botão de emergência: ' + error.message)
    onKillChange(next)
    await logActivity(next ? 'kill_switch.activated' : 'kill_switch.released', 'system_settings', 'automation_kill_switch')
    toast.push(next ? 'info' : 'success', next ? 'Todas as atividades automáticas foram paradas.' : 'Atividades automáticas libertadas.')
  }

  return (
    <>
      <header className="glass sticky top-0 z-20 flex h-14 items-center gap-3 border-x-0 border-t-0 bg-ink/70 px-4">
        <button onClick={onMenu} className="rounded-md p-1.5 text-white/60 hover:bg-white/[0.06] lg:hidden" aria-label="Abrir menu">
          <Menu className="h-5 w-5" />
        </button>

        <form onSubmit={submitSearch} className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Pesquisar empresas, leads…" aria-label="Pesquisa global" className="input !bg-white/[0.04] pl-9" />
        </form>

        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={toggleSound} title={sound ? 'Desativar efeitos sonoros' : 'Ativar efeitos sonoros'} aria-label={sound ? 'Desativar efeitos sonoros' : 'Ativar efeitos sonoros'} aria-pressed={sound} className={cn('hidden rounded-lg p-2 transition sm:flex', sound ? 'text-brand-soft hover:bg-white/[0.05]' : 'text-white/35 hover:bg-white/[0.05] hover:text-white/70')}>
            {sound ? <Volume2 className="h-[18px] w-[18px]" /> : <VolumeX className="h-[18px] w-[18px]" />}
          </button>

          <button onClick={toggleFloating} title={floating ? 'Desativar menu flutuante' : 'Ativar menu flutuante'} aria-label={floating ? 'Desativar menu flutuante' : 'Ativar menu flutuante'} aria-pressed={floating} className={cn('hidden rounded-lg p-2 transition sm:flex', floating ? 'text-brand-soft hover:bg-white/[0.05]' : 'text-white/35 hover:bg-white/[0.05] hover:text-white/70')}>
            {floating ? <PanelLeft className="h-[18px] w-[18px]" /> : <LayoutPanelLeft className="h-[18px] w-[18px]" />}
          </button>

          <button onClick={() => setPalette(true)} className="hidden items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/50 transition hover:bg-white/[0.05] md:flex" aria-label="Comando rápido">
            <Command className="h-3.5 w-3.5" /> K
          </button>

          <button onClick={() => nav('/agentes')} title="Estado dos agentes de IA" className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-white/60 hover:bg-white/[0.05] md:flex">
            <Bot className="h-4 w-4" />
            <span className={cn('h-1.5 w-1.5 rounded-full', agents.active > 0 ? 'bg-emerald-400' : 'bg-white/25')} />
            {agents.active}/{agents.total}
          </button>

          <button onClick={() => nav('/admin')} title="Estado das integrações" className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-white/60 hover:bg-white/[0.05] md:flex">
            <Plug className="h-4 w-4" />
            <span className={cn('h-1.5 w-1.5 rounded-full', integrations.connected > 0 ? 'bg-emerald-400' : 'bg-amber-400')} />
            {integrations.connected}/{integrations.total}
          </button>

          <button onClick={() => setConfirmKill(true)} title={killSwitch ? 'Automação PARADA' : 'Parar todas as atividades automáticas'} className={cn('flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition', killSwitch ? 'border-red-500/50 bg-red-500/15 text-red-300' : 'border-white/10 text-white/60 hover:bg-white/[0.05]')}>
            <OctagonAlert className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{killSwitch ? 'Parado' : 'Emergência'}</span>
          </button>

          <div ref={notifRef} className="relative">
            <button onClick={() => setNotifOpen((v) => !v)} className="relative rounded-lg p-2 text-white/60 hover:bg-white/[0.05] hover:text-white/80" aria-label="Notificações">
              <Bell className="h-[18px] w-[18px]" />
              {unread > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-semibold text-white">{unread > 9 ? '9+' : unread}</span>}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-full mt-2 w-[360px] rounded-2xl border border-white/10 bg-[#101418]/95 p-2 shadow-2xl backdrop-blur-xl">
                <div className="mb-2 flex items-center justify-between px-2 pt-1">
                  <div>
                    <p className="text-sm font-medium">Notificações</p>
                    <p className="text-[11px] text-white/40">{unread} por ler</p>
                  </div>
                  <button onClick={markAllRead} className="text-[11px] text-brand-soft hover:underline">Marcar tudo como lido</button>
                </div>
                <div className="max-h-[320px] space-y-2 overflow-y-auto">
                  {notifs.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-white/45">Sem notificações recentes.</div>
                  ) : (
                    notifs.map((n) => (
                      <button key={n.id} onClick={() => n.link && nav(n.link)} className="w-full rounded-xl border border-white/5 bg-white/[0.02] p-3 text-left transition hover:bg-white/[0.04]">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className={cn('h-2 w-2 rounded-full', n.level === 'danger' ? 'bg-red-400' : n.level === 'warning' ? 'bg-amber-400' : 'bg-emerald-400')} />
                              <p className="text-xs font-medium text-white/80">{n.title}</p>
                            </div>
                            {n.body && <p className="mt-1 text-[11px] leading-relaxed text-white/45">{n.body}</p>}
                          </div>
                          {!n.read_at && <span className="mt-1 h-2 w-2 rounded-full bg-brand-soft" />}
                        </div>
                        <div className="mt-2 text-[10px] text-white/35">{relativeTime(n.created_at)}</div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div ref={profileRef} className="relative">
            <button onClick={() => setProfileOpen((v) => !v)} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-2 py-1.5 text-left hover:bg-white/[0.05]">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/15 text-[11px] font-semibold text-brand-soft">{admin?.full_name?.[0]?.toUpperCase() ?? 'P'}</div>
              <div className="hidden text-left sm:block">
                <div className="text-[11px] font-medium text-white/80">{admin?.full_name ?? 'Proprietário'}</div>
                <div className="text-[10px] text-white/35">{admin ? 'owner' : 'Proprietário'}</div>
              </div>
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-white/10 bg-[#101418]/95 p-2 shadow-2xl backdrop-blur-xl">
                <div className="mb-2 border-b border-white/5 px-2 pb-2">
                  <p className="text-sm font-medium text-white/90">{admin?.full_name ?? 'Conta'}</p>
                  <p className="text-[11px] text-white/40">{admin?.email ?? 'owner@local'}</p>
                </div>
                <button onClick={() => nav('/admin')} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-white/70 hover:bg-white/[0.04]">
                  <Settings className="h-4 w-4" /> Configurações
                </button>
                <button onClick={() => signOut()} className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-red-200 hover:bg-red-500/10">
                  <LogOut className="h-4 w-4" /> Sair
                </button>
              </div>
            )}
          </div>
        </div>

        <Clock />
      </header>

      <Modal open={palette} onClose={() => setPalette(false)} title="Comando rápido" wide>
        <div className="space-y-3">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar módulos, clientes, relatórios…" className="input w-full" autoFocus />
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { label: 'Dashboard', path: '/' },
              { label: 'CRM', path: '/crm' },
              { label: 'Agentes', path: '/agentes' },
              { label: 'Admin', path: '/admin' },
            ].map((item) => (
              <button key={item.path} onClick={() => { setPalette(false); nav(item.path) }} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-sm text-white/80 hover:bg-white/[0.05]">
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </Modal>

      <Modal open={confirmKill} onClose={() => setConfirmKill(false)} title={killSwitch ? 'Reativar automações' : 'Parar automações'}>
        <div className="space-y-4">
          <p className="text-sm text-white/70">
            {killSwitch ? 'Deseja reativar todas as automações e envios do sistema?' : 'Deseja interromper todas as automações e envios do sistema?'}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmKill(false)}>Cancelar</Button>
            <Button variant={killSwitch ? 'primary' : 'danger'} onClick={toggleKill}>{killSwitch ? 'Reativar' : 'Parar'}</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
