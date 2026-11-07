import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Bot, Check, Command, Menu, Palette, Plug, Search, Settings, LogOut, OctagonAlert } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { NAV } from '@/lib/nav'
import { cn, relativeTime } from '@/lib/utils'
import { Modal, Switch } from '@/components/ui'
import { THEMES, useUiPrefs } from '@/lib/ui-prefs'
import { useToast } from '@/components/ui/Toast'
import { logActivity } from '@/lib/log'

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
  const { theme, setTheme, floating, setFloating } = useUiPrefs()
  const [themeOpen, setThemeOpen] = useState(false)
  const themeRef = useClickOutside(() => setThemeOpen(false))
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

  // Atalho Ctrl/Cmd+K
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

  const submitSearch = (e: React.FormEvent) => {
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
    <header className="glass sticky top-0 z-20 flex h-14 items-center gap-3 border-x-0 border-t-0 bg-ink/70 px-4">
      <button onClick={onMenu} className="rounded-md p-1.5 text-white/60 hover:bg-white/[0.06] lg:hidden" aria-label="Abrir menu">
        <Menu className="h-5 w-5" />
      </button>

      <form onSubmit={submitSearch} className="relative max-w-md flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Pesquisar empresas, leads…" aria-label="Pesquisa global" className="input !bg-white/[0.04] pl-9" />
      </form>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          onClick={() => setPalette(true)}
          className="hidden items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/50 transition hover:bg-white/[0.05] md:flex"
          aria-label="Comando rápido"
        >
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

        {/* Emergência */}
        <button
          onClick={() => setConfirmKill(true)}
          title={killSwitch ? 'Automação PARADA — clique para libertar' : 'Parar todas as atividades automáticas'}
          className={cn(
            'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition',
            killSwitch ? 'border-red-500/50 bg-red-500/15 text-red-300' : 'border-white/10 text-white/50 hover:border-red-500/40 hover:text-red-300',
          )}
        >
          <OctagonAlert className="h-4 w-4" />
          <span className="hidden sm:inline">{killSwitch ? 'Parado' : 'Emergência'}</span>
        </button>

        <Clock />

        {/* Notificações */}
        <div ref={notifRef} className="relative">
          <button onClick={() => setNotifOpen((v) => !v)} className="relative rounded-lg p-2 text-white/60 hover:bg-white/[0.05]" aria-label="Notificações">
            <Bell className="h-[18px] w-[18px]" />
            {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand ring-2 ring-ink" />}
          </button>
          {notifOpen && (
            <div className="card absolute right-0 mt-2 w-80 animate-scale-in overflow-hidden bg-graphite shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                <span className="text-sm font-semibold">Notificações</span>
                {unread > 0 && <button onClick={markAllRead} className="text-xs text-brand-soft hover:underline">Marcar como lidas</button>}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifs.length === 0 ? (
                  <p className="px-4 py-8 text-center text-xs text-white/40">Sem notificações.</p>
                ) : notifs.map((n) => (
                  <button key={n.id} onClick={() => { setNotifOpen(false); if (n.link) nav(n.link) }} className="block w-full border-b border-white/[0.04] px-4 py-3 text-left hover:bg-white/[0.03]">
                    <div className="flex items-center gap-2">
                      {!n.read_at && <span className="h-1.5 w-1.5 rounded-full bg-brand" />}
                      <span className="text-[13px] font-medium">{n.title}</span>
                    </div>
                    {n.body && <p className="mt-0.5 text-xs text-white/45">{n.body}</p>}
                    <p className="mt-1 text-[10px] text-white/30">{relativeTime(n.created_at)}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Aparência: cor do tema + menu flutuante */}
        <div ref={themeRef} className="relative">
          <button onClick={() => setThemeOpen((v) => !v)} className="rounded-lg p-2 text-white/60 hover:bg-white/[0.05]" aria-label="Aparência" aria-expanded={themeOpen} title="Cor do tema">
            <Palette className="h-[18px] w-[18px]" />
          </button>
          {themeOpen && (
            <div className="card absolute right-0 mt-2 w-64 animate-scale-in bg-graphite p-4 shadow-2xl">
              <p className="text-sm font-semibold">Cor do tema</p>
              <div className="mt-3 grid grid-cols-4 gap-2" role="radiogroup" aria-label="Cor do tema">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    role="radio"
                    aria-checked={theme === t.id}
                    aria-label={t.label}
                    title={t.label}
                    onClick={() => setTheme(t.id)}
                    className="group flex flex-col items-center gap-1.5 focus:outline-none"
                  >
                    <span
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-full border transition group-focus-visible:ring-2 group-focus-visible:ring-brand/60',
                        theme === t.id ? 'border-brand ring-2 ring-brand/40' : 'border-white/20 group-hover:border-white/40',
                      )}
                      style={{ background: t.swatch }}
                    >
                      {theme === t.id && <Check className="h-4 w-4" style={{ color: t.id === 'branco' || t.id === 'laranja' ? '#18181B' : '#FFFFFF' }} />}
                    </span>
                    <span className="text-center text-[10px] leading-tight text-white/50">{t.short}</span>
                  </button>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
                <div>
                  <p className="text-[13px] font-medium">Menu flutuante</p>
                  <p className="text-[11px] text-white/40">Solto sobre a página, transparente</p>
                </div>
                <span className="hidden lg:block"><Switch checked={floating} onChange={setFloating} label="Menu flutuante" /></span>
                <span className="text-[10px] text-white/30 lg:hidden">só em ecrãs grandes</span>
              </div>
            </div>
          )}
        </div>

        <button onClick={() => nav('/admin')} className="rounded-lg p-2 text-white/60 hover:bg-white/[0.05]" aria-label="Configurações">
          <Settings className="h-[18px] w-[18px]" />
        </button>

        {/* Perfil */}
        <div ref={profileRef} className="relative">
          <button onClick={() => setProfileOpen((v) => !v)} className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/20 text-xs font-semibold text-brand-soft ring-1 ring-brand/30" aria-label="Perfil">
            {(admin?.full_name ?? 'A').slice(0, 1).toUpperCase()}
          </button>
          {profileOpen && (
            <div className="card absolute right-0 mt-2 w-60 animate-scale-in bg-graphite p-1.5 shadow-2xl">
              <div className="px-3 py-2">
                <p className="text-sm font-medium">{admin?.full_name ?? 'Administrador'}</p>
                <p className="truncate text-xs text-white/40">{admin?.email}</p>
                <p className="mt-1.5 text-[10px] uppercase tracking-wider text-brand-soft">Proprietário</p>
              </div>
              <button onClick={() => signOut()} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-white/70 hover:bg-white/[0.05]">
                <LogOut className="h-4 w-4" /> Terminar sessão
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Paleta de comandos */}
      <Modal open={palette} onClose={() => setPalette(false)} title="Comando rápido">
        <div className="space-y-1">
          {NAV.map(({ to, label, icon: Icon, description }) => (
            <button key={to} onClick={() => { setPalette(false); nav(to) }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-white/[0.05]">
              <Icon className="h-4 w-4 text-brand-soft" />
              <div>
                <div className="text-sm">{label}</div>
                <div className="text-xs text-white/40">{description}</div>
              </div>
            </button>
          ))}
        </div>
      </Modal>

      {/* Confirmação do botão de emergência */}
      <Modal
        open={confirmKill}
        onClose={() => setConfirmKill(false)}
        title={killSwitch ? 'Libertar atividades automáticas?' : 'Parar todas as atividades automáticas?'}
        footer={
          <>
            <button onClick={() => setConfirmKill(false)} className="rounded-lg px-3.5 py-2 text-sm text-white/70 hover:bg-white/[0.06]">Cancelar</button>
            <button onClick={toggleKill} className={cn('rounded-lg px-3.5 py-2 text-sm font-medium', killSwitch ? 'bg-brand text-on-brand' : 'bg-red-500 text-[#ffffff]')}>
              {killSwitch ? 'Libertar' : 'Parar tudo'}
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-white/60">
          {killSwitch
            ? 'As automações e o envio de mensagens poderão voltar a funcionar, respeitando o modo configurado.'
            : 'Bloqueia imediatamente o envio de mensagens e qualquer automação ou agente a correr. A proteção é aplicada também na base de dados.'}
        </p>
      </Modal>
    </header>
  )
}
