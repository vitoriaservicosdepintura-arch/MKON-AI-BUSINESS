import { useEffect, useMemo, useRef, useState } from 'react'
import { Volume2, VolumeX, Radar, BarChart3, Palette, FileText, ShieldCheck, Bell, Moon } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Equipa, pela ordem de trabalho. `code` liga ao agente que grava os passos em pipeline_steps. */
export const AGENTS = [
  { code: 'pesquisador', name: 'Pesquisador', role: 'Capta leads', icon: Radar, color: '#38bdf8', hair: '#3b2a1a' },
  { code: 'analista', name: 'Analista', role: 'Avalia oportunidades', icon: BarChart3, color: '#a78bfa', hair: '#1f1f1f' },
  { code: 'designer', name: 'Designer', role: 'Monta o site', icon: Palette, color: '#f472b6', hair: '#7a4a24' },
  { code: 'vendedor', name: 'Propostas', role: 'Escreve a proposta', icon: FileText, color: '#34d399', hair: '#2a2a2a' },
  { code: 'supervisor', name: 'Revisor', role: 'Prepara o pacote', icon: ShieldCheck, color: '#fbbf24', hair: '#5a3b22' },
] as const

export type Step = { id: string; run_id: string; agent_code: string; message: string; status: string; created_at: string }
export type AgentStatus = 'trabalhando' | 'descanso' | 'espera' | 'aprovacao' | 'erro'

/** Estado de cada agente a partir dos passos reais da última execução. */
export function deriveStatus(steps: Step[], runStatus: string | null): Record<string, AgentStatus> {
  const out: Record<string, AgentStatus> = {}
  const last: Record<string, Step> = {}
  for (const s of steps) last[s.agent_code] = s
  const active = !!runStatus && !['concluida', 'erro'].includes(runStatus)
  const firstPending = AGENTS.findIndex(a => !last[a.code])
  AGENTS.forEach((a, i) => {
    const s = last[a.code]
    if (!runStatus) out[a.code] = 'espera'
    else if (s?.status === 'erro') out[a.code] = 'erro'
    else if (s?.status === 'aguarda_aprovacao') out[a.code] = 'aprovacao'
    else if (active) {
      if (s) out[a.code] = 'descanso'
      else if (i === firstPending) out[a.code] = 'trabalhando'
      else out[a.code] = 'espera'
    } else out[a.code] = s ? 'descanso' : 'espera'
  })
  return out
}

// Posições em percentagem da sala. Secretárias à esquerda, repouso e contrato à direita.
const DESK: Record<string, { x: number; y: number }> = {
  pesquisador: { x: 4, y: 8 }, analista: { x: 28, y: 8 }, designer: { x: 52, y: 8 },
  vendedor: { x: 16, y: 56 }, supervisor: { x: 40, y: 56 },
}
const REST: Record<string, { x: number; y: number }> = {
  pesquisador: { x: 76, y: 14 }, analista: { x: 90, y: 14 }, designer: { x: 76, y: 32 }, vendedor: { x: 90, y: 32 }, supervisor: { x: 83, y: 46 },
}
const STAGES = ['Pesquisa', 'Análise', 'Design', 'Proposta', 'Revisão', 'Aprovação', 'Contrato']

/** Sons sintetizados (sem ficheiros): teclado enquanto trabalham, sino quando alguém termina. */
function useSound() {
  const [on, setOn] = useState(false)
  const onRef = useRef(false)
  const ctxRef = useRef<AudioContext | null>(null)
  const tone = (freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number) => {
    if (!onRef.current) return
    try {
      if (!ctxRef.current) { const C = window.AudioContext || (window as any).webkitAudioContext; ctxRef.current = new C() }
      const c = ctxRef.current!
      const o = c.createOscillator(); const g = c.createGain()
      o.type = type; o.frequency.setValueAtTime(freq, c.currentTime)
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur)
      g.gain.setValueAtTime(vol, c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur)
      o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + dur)
    } catch { /* sem áudio: a sala continua a funcionar */ }
  }
  const toggle = () => {
    const next = !onRef.current
    onRef.current = next; setOn(next)
    if (next) tone(1200, 0.04, 'square', 0.03)
  }
  return { on, toggle, tone }
}

export function AgentOffice({ steps, runStatus, runQuery, busy, approved }: {
  steps: Step[]; runStatus: string | null; runQuery: string | null; busy: boolean; approved: number
}) {
  const status = useMemo(() => deriveStatus(steps, runStatus), [steps, runStatus])
  const sound = useSound()
  const prevRef = useRef<Record<string, AgentStatus>>({})
  const working = Object.values(status).some(s => s === 'trabalhando')

  // Teclado enquanto alguém trabalha.
  useEffect(() => {
    if (!sound.on || !working) return
    const t = setInterval(() => sound.tone(1800 + Math.random() * 700, 0.025, 'square', 0.015), 170)
    return () => clearInterval(t)
  }, [sound.on, working])

  // Sino quando alguém termina a função e vai descansar, ou quando o pacote fica pronto.
  useEffect(() => {
    const prev = prevRef.current
    const finished = AGENTS.some(a => prev[a.code] === 'trabalhando' && status[a.code] === 'descanso')
    const readyForApproval = AGENTS.some(a => prev[a.code] !== 'aprovacao' && status[a.code] === 'aprovacao')
    if (finished) sound.tone(880, 0.3, 'sine', 0.05, 1320)
    if (readyForApproval) setTimeout(() => sound.tone(1046, 0.4, 'triangle', 0.06), 200)
    prevRef.current = status
  }, [status])

  const doneCount = AGENTS.filter(a => status[a.code] === 'descanso' || status[a.code] === 'aprovacao').length
  const stageIndex = approved > 0 ? 6 : Math.min(doneCount, 5)

  return (
    <div className="space-y-3">
      <style>{`
        @keyframes oBar { 0%,100% { height: var(--h0) } 50% { height: var(--h1) } }
        @keyframes oType { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-2px) } }
        @keyframes oZ { 0% { opacity: 0; transform: translate(0,0) } 30% { opacity: 1 } 100% { opacity: 0; transform: translate(8px,-14px) } }
        @keyframes oGlow { 0%,100% { opacity: .65 } 50% { opacity: 1 } }
        @keyframes oBob { 0%,100% { transform: translate(-50%,-50%) } 50% { transform: translate(-50%,-56%) } }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-white/50">{runQuery ? `Missão: “${runQuery}”` : 'Sem missão ativa'}{busy ? ' · a equipa está a trabalhar' : ''}</p>
        <button onClick={sound.toggle} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/70 hover:bg-white/[0.05]" aria-label={sound.on ? 'Desligar som' : 'Ligar som'}>
          {sound.on ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />} {sound.on ? 'Som ligado' : 'Ligar som'}
        </button>
      </div>

      <div className="relative w-full overflow-hidden rounded-2xl border border-white/[0.07]" style={{ aspectRatio: '16 / 10', minHeight: 300, background: 'linear-gradient(160deg,#0f172a,#0b1020)' }}>
        {/* Piso */}
        <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(148,163,184,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.06) 1px, transparent 1px)', backgroundSize: '5% 8%' }} />

        {/* Sala de repouso */}
        <div className="absolute rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04]" style={{ left: '70%', top: '3%', width: '27%', height: '50%' }}>
          <p className="absolute left-2 top-1.5 flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-300/70"><Moon className="h-3 w-3" /> Sala de repouso</p>
          <div className="absolute left-[12%] top-[40%] h-[14%] w-[30%] rounded-full bg-emerald-900/60" />
          <div className="absolute left-[55%] top-[62%] h-[14%] w-[30%] rounded-full bg-emerald-900/60" />
          <div className="absolute right-2 top-2 h-4 w-4 rounded-full bg-emerald-500/40" />
        </div>

        {/* Contrato */}
        <div className="absolute rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-2" style={{ left: '70%', top: '57%', width: '27%', height: '40%' }}>
          <p className="text-[10px] uppercase tracking-wider text-amber-300/70">Contrato</p>
          <p className="mt-1 text-2xl font-bold text-amber-200" style={{ fontVariantNumeric: 'tabular-nums' }}>{approved}</p>
          <p className="text-[10px] text-white/40">aprovados · envio por ligar</p>
        </div>

        {/* Secretárias */}
        {AGENTS.map(a => {
          const d = DESK[a.code]
          const st = status[a.code]
          const on = st === 'trabalhando'
          return (
            <div key={`desk-${a.code}`} className="absolute rounded-lg border border-white/10 bg-slate-800/70" style={{ left: `${d.x}%`, top: `${d.y}%`, width: '20%', height: '26%' }}>
              {/* Ecrã com gráfico */}
              <div className="absolute left-[18%] top-[8%] h-[52%] w-[64%] overflow-hidden rounded-sm border border-sky-300/20 bg-slate-950" style={{ boxShadow: on ? `0 0 14px ${a.color}55` : 'none' }}>
                <div className="absolute inset-x-[8%] bottom-[10%] flex h-[78%] items-end gap-[6%]">
                  {[0.45, 0.8, 0.6, 0.95, 0.5].map((h, i) => (
                    <span key={i} className="flex-1 rounded-t-[2px]" style={{
                      background: a.color, opacity: on ? 0.95 : 0.25,
                      height: `${h * 100}%`,
                      ['--h0' as any]: `${h * 40}%`, ['--h1' as any]: `${h * 100}%`,
                      animation: on ? `oBar ${0.9 + i * 0.15}s ease-in-out ${i * 0.1}s infinite` : 'none',
                    }} />
                  ))}
                </div>
              </div>
              {/* Teclado */}
              <div className="absolute bottom-[8%] left-[22%] h-[8%] w-[56%] rounded-sm bg-slate-600/60" />
              {on && <span className="absolute left-[46%] top-[62%] h-1.5 w-1.5 rounded-full" style={{ background: a.color, animation: 'oGlow .8s ease-in-out infinite' }} />}
            </div>
          )
        })}

        {/* Agentes (movem-se entre a secretária e a sala de repouso) */}
        {AGENTS.map(a => {
          const st = status[a.code]
          const resting = st === 'descanso'
          const pos = resting ? REST[a.code] : (st === 'aprovacao' || st === 'erro' || st === 'espera' || st === 'trabalhando') ? { x: DESK[a.code].x + 10, y: DESK[a.code].y + 19 } : DESK[a.code]
          const Icon = a.icon
          const typing = st === 'trabalhando'
          return (
            <div key={`agent-${a.code}`} className="absolute flex flex-col items-center" style={{
              left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%,-50%)',
              transition: 'left 1.6s ease-in-out, top 1.6s ease-in-out', zIndex: 2,
            }}>
              {st === 'descanso' && <span className="absolute -top-3 right-[-6px] text-[10px] text-emerald-300" style={{ animation: 'oZ 2s ease-out infinite' }}>z</span>}
              {st === 'aprovacao' && <Bell className="absolute -top-4 h-3.5 w-3.5 text-amber-300" style={{ animation: 'oGlow 1s ease-in-out infinite' }} />}
              {st === 'erro' && <span className="absolute -top-4 text-xs font-bold text-red-400">!</span>}
              <div className="relative flex flex-col items-center" style={{ animation: typing ? 'oType .35s ease-in-out infinite' : 'none' }}>
                <div className="h-3.5 w-3.5 rounded-full border border-black/30" style={{ background: '#f1c9a5' }}>
                  <span className="block h-1.5 w-full rounded-t-full" style={{ background: a.hair, marginTop: -1 }} />
                </div>
                <div className="-mt-0.5 h-3 w-7 rounded-t-xl" style={{ background: a.color }} />
              </div>
              <div className="mt-0.5 flex items-center gap-1 rounded-md bg-slate-900/80 px-1.5 py-0.5">
                <Icon className="h-2.5 w-2.5" style={{ color: a.color }} />
                <span className="whitespace-nowrap text-[9px] text-white/80">{a.name}</span>
              </div>
              <span className={cn('mt-0.5 text-[8px] uppercase tracking-wider', st === 'trabalhando' ? 'text-sky-300' : st === 'erro' ? 'text-red-400' : 'text-white/40')}>
                {st === 'trabalhando' ? 'a trabalhar' : st === 'descanso' ? 'descanso' : st === 'aprovacao' ? 'aguarda aprovação' : st === 'erro' ? 'erro' : 'à espera'}
              </span>
            </div>
          )
        })}
      </div>

      {/* Caminho até ao contrato */}
      <ol className="grid grid-cols-7 gap-1 text-center">
        {STAGES.map((s, i) => (
          <li key={s} className="min-w-0">
            <div className={cn('mx-auto h-2 w-full rounded-full', i <= stageIndex ? 'bg-brand' : 'bg-white/10')} style={{ opacity: i === stageIndex ? 1 : i < stageIndex ? 0.7 : 1 }} />
            <p className={cn('mt-1 truncate text-[10px]', i === stageIndex ? 'text-brand-soft' : 'text-white/40')}>{s}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}
