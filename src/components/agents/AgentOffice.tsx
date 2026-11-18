import { useEffect, useMemo, useRef, useState } from 'react'
import { Volume2, VolumeX, Bell, Moon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Os 10 funcionários do escritório. `code` liga ao agente real da pipeline quando existe
 * (supervisor, pesquisador, analista, designer, vendedor). Os restantes ficam à espera até terem tarefas reais.
 */
export const AGENTS = [
  { code: 'supervisor', name: 'Diretor de Operações', short: 'Diretor', color: '#fbbf24', hair: '#5a3b22', desk: { x: 76, y: 38 }, real: true },
  { code: 'pesquisador', name: 'Inteligência Comercial', short: 'Comercial', color: '#38bdf8', hair: '#3b2a1a', desk: { x: 4, y: 30 }, real: true },
  { code: 'analista', name: 'Estrategista de Vendas', short: 'Estrategista', color: '#a78bfa', hair: '#1f1f1f', desk: { x: 14.5, y: 30 }, real: true },
  { code: 'marketing', name: 'Marketing e Copy', short: 'Marketing', color: '#fb7185', hair: '#8a5a2b', desk: { x: 25, y: 30 }, real: true },
  { code: 'designer', name: 'Web Designer', short: 'Designer', color: '#f472b6', hair: '#7a4a24', desk: { x: 4, y: 62 }, real: true },
  { code: 'dev', name: 'Desenvolvedor Web', short: 'Dev', color: '#60a5fa', hair: '#222', desk: { x: 14.5, y: 62 }, real: true },
  { code: 'qa', name: 'QA', short: 'QA', color: '#2dd4bf', hair: '#4b3621', desk: { x: 25, y: 62 }, real: true },
  { code: 'vendedor', name: 'Propostas Comerciais', short: 'Propostas', color: '#34d399', hair: '#2a2a2a', desk: { x: 35.5, y: 62 }, real: true },
  { code: 'negociacao', name: 'Negociação', short: 'Negociação', color: '#f97316', hair: '#6b4423', desk: { x: 48, y: 64 }, real: true },
  { code: 'relacionamento', name: 'Relacionamento', short: 'Relação', color: '#facc15', hair: '#1c1c1c', desk: { x: 35.5, y: 30 }, real: true },
] as const

export type Step = { id: string; run_id: string; agent_code: string; message: string; status: string; created_at: string }
export type AgentStatus = 'trabalhando' | 'descanso' | 'espera' | 'aprovacao' | 'erro'

const PIPELINE_ORDER = ['pesquisador', 'analista', 'designer', 'dev', 'qa', 'vendedor', 'marketing', 'relacionamento', 'negociacao', 'supervisor'] as const

/** Estado de cada agente a partir dos passos reais da última execução. Só a pipeline faz trabalho real. */
export function deriveStatus(steps: Step[], runStatus: string | null): Record<string, AgentStatus> {
  const out: Record<string, AgentStatus> = {}
  const last: Record<string, Step> = {}
  for (const s of steps) last[s.agent_code] = s
  const active = !!runStatus && !['concluida', 'erro'].includes(runStatus)
  const firstPending = PIPELINE_ORDER.find(c => !last[c])
  for (const a of AGENTS) {
    const s = last[a.code]
    if (!runStatus || !a.real) { out[a.code] = s && runStatus ? 'descanso' : 'espera'; continue }
    if (s?.status === 'erro') out[a.code] = 'erro'
    else if (s?.status === 'aguarda_aprovacao') out[a.code] = 'aprovacao'
    else if (active) out[a.code] = s ? 'descanso' : a.code === firstPending ? 'trabalhando' : 'espera'
    else out[a.code] = s ? 'descanso' : 'espera'
  }
  return out
}

// Layout do piso (percentagens). Mesmo esquema da planta: salas de reunião em vidro no topo,
// secretárias em duas filas, lounge ao centro, repouso e painel do gerente à direita.
const REST_SPOTS = [
  { x: 76, y: 9 }, { x: 84, y: 9 }, { x: 92, y: 9 }, { x: 76, y: 17 }, { x: 84, y: 17 },
  { x: 92, y: 17 }, { x: 76, y: 25 }, { x: 84, y: 25 }, { x: 92, y: 25 }, { x: 88, y: 31 },
]
const MEETING_ROOMS = [{ x: 3, label: 'Reunião 1' }, { x: 21, label: 'Reunião 2' }, { x: 39, label: 'Reunião 3' }]
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

  useEffect(() => {
    if (!sound.on || !working) return
    const t = setInterval(() => sound.tone(1800 + Math.random() * 700, 0.025, 'square', 0.015), 170)
    return () => clearInterval(t)
  }, [sound.on, working])

  useEffect(() => {
    const prev = prevRef.current
    const finished = AGENTS.some(a => prev[a.code] === 'trabalhando' && status[a.code] === 'descanso')
    const ready = AGENTS.some(a => prev[a.code] !== 'aprovacao' && status[a.code] === 'aprovacao')
    if (finished) sound.tone(880, 0.3, 'sine', 0.05, 1320)
    if (ready) setTimeout(() => sound.tone(1046, 0.4, 'triangle', 0.06), 200)
    prevRef.current = status
  }, [status])

  const restingIdx = (code: string) => AGENTS.findIndex(a => a.code === code)
  const doneCount = PIPELINE_ORDER.filter(c => status[c] === 'descanso' || status[c] === 'aprovacao').length
  const stageIndex = approved > 0 ? 6 : doneCount >= PIPELINE_ORDER.length ? 5 : Math.min(Math.floor((doneCount / PIPELINE_ORDER.length) * 5), 4)

  return (
    <div className="space-y-3">
      <style>{`
        @keyframes oBar { 0%,100% { height: var(--h0) } 50% { height: var(--h1) } }
        @keyframes oType { 0%,100% { transform: translate(-50%,-50%) translateY(0) } 50% { transform: translate(-50%,-50%) translateY(-2px) } }
        @keyframes oZ { 0% { opacity: 0; transform: translate(0,0) } 30% { opacity: 1 } 100% { opacity: 0; transform: translate(8px,-12px) } }
        @keyframes oGlow { 0%,100% { opacity: .55 } 50% { opacity: 1 } }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-white/50">{runQuery ? `Missão: “${runQuery}”` : 'Sem missão ativa'}{busy ? ' · a equipa está a trabalhar' : ''}</p>
        <button onClick={sound.toggle} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/70 hover:bg-white/[0.05]" aria-label={sound.on ? 'Desligar som' : 'Ligar som'}>
          {sound.on ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />} {sound.on ? 'Som ligado' : 'Ligar som'}
        </button>
      </div>

      <div className="-mx-1 overflow-x-auto pb-1">
        <div className="relative min-w-[680px] rounded-2xl border border-white/[0.08]" style={{ aspectRatio: '16 / 10', background: '#c9ced6', perspective: '1200px' }}>
          <div className="absolute inset-0" style={{ transform: 'rotateX(14deg)', transformOrigin: '50% 70%', transformStyle: 'preserve-3d' }}>
            {/* Piso e paredes */}
            <div className="absolute inset-0 rounded-2xl" style={{ background: 'linear-gradient(135deg,#d7dbe2,#b9c0ca)', boxShadow: 'inset 0 0 0 6px #1f2937' }} />

            {/* Salas de reunião em vidro */}
            {MEETING_ROOMS.map(r => (
              <div key={r.label} className="absolute rounded-md border-2 border-slate-600/70 bg-sky-100/40" style={{ left: `${r.x}%`, top: '4%', width: '16%', height: '22%' }}>
                <span className="absolute left-1 top-0.5 text-[8px] uppercase tracking-wider text-slate-600">{r.label}</span>
                <div className="absolute left-[18%] top-[30%] h-[40%] w-[64%] rounded-lg bg-amber-100/80 shadow-sm" />
                {[0, 1, 2, 3].map(i => <span key={i} className="absolute h-2 w-2 rounded-full bg-slate-500/70" style={{ left: `${12 + i * 22}%`, top: '12%' }} />)}
              </div>
            ))}

            {/* Sala de repouso */}
            <div className="absolute rounded-lg bg-emerald-100/60" style={{ left: '70%', top: '3%', width: '28%', height: '29%', border: '2px solid #34d39966' }}>
              <span className="absolute left-1.5 top-1 flex items-center gap-1 text-[8px] uppercase tracking-wider text-emerald-700"><Moon className="h-2.5 w-2.5" /> Repouso</span>
            </div>

            {/* Lounge com sofás */}
            <div className="absolute rounded-xl bg-stone-300/60" style={{ left: '48%', top: '34%', width: '20%', height: '24%' }}>
              <div className="absolute left-[8%] top-[18%] h-[26%] w-[84%] rounded-full bg-orange-800/70" />
              <div className="absolute left-[8%] top-[62%] h-[26%] w-[84%] rounded-full bg-orange-800/70" />
              <div className="absolute left-[38%] top-[44%] h-[14%] w-[24%] rounded-md bg-stone-500/70" />
            </div>

            {/* Plantas */}
            {[{ x: 46, y: 2 }, { x: 68, y: 27 }, { x: 2, y: 94 }, { x: 96, y: 96 }].map((p, i) => (
              <span key={i} className="absolute h-6 w-6 rounded-full bg-emerald-600/80 shadow" style={{ left: `${p.x}%`, top: `${p.y}%` }} />
            ))}

            {/* Painel de contrato e entregas */}
            <div className="absolute rounded-lg border border-amber-400/50 bg-amber-50 p-1.5 shadow" style={{ left: '70%', top: '56%', width: '28%', height: '40%' }}>
              <p className="text-[8px] uppercase tracking-wider text-amber-700">Contrato · entregas</p>
              <p className="mt-1 text-xl font-bold text-amber-700" style={{ fontVariantNumeric: 'tabular-nums' }}>{approved}</p>
              <p className="text-[8px] text-slate-500">aprovados · envio por ligar</p>
            </div>

            {/* Secretárias */}
            {AGENTS.map(a => {
              const st = status[a.code]
              const on = st === 'trabalhando'
              return (
                <div key={`desk-${a.code}`} className="absolute rounded-md bg-amber-900/70 shadow" style={{ left: `${a.desk.x}%`, top: `${a.desk.y}%`, width: '9%', height: '14%' }}>
                  <div className="absolute left-[12%] top-[10%] h-[52%] w-[76%] overflow-hidden rounded-sm bg-slate-950" style={{ boxShadow: on ? `0 0 10px ${a.color}aa` : 'none' }}>
                    <div className="absolute inset-x-[10%] bottom-[10%] flex h-[80%] items-end gap-[8%]">
                      {[0.45, 0.8, 0.6, 0.95].map((h, i) => (
                        <span key={i} className="flex-1 rounded-t-[1px]" style={{
                          background: a.color, opacity: on ? 0.95 : 0.25, height: `${h * 100}%`,
                          ['--h0' as any]: `${h * 40}%`, ['--h1' as any]: `${h * 100}%`,
                          animation: on ? `oBar ${0.9 + i * 0.15}s ease-in-out ${i * 0.1}s infinite` : 'none',
                        }} />
                      ))}
                    </div>
                  </div>
                  <div className="absolute bottom-[10%] left-[18%] h-[12%] w-[64%] rounded-sm bg-slate-300/80" />
                </div>
              )
            })}

            {/* Cadeiras e pessoas (movem-se entre a secretária e o repouso) */}
            {AGENTS.map(a => {
              const st = status[a.code]
              const resting = st === 'descanso'
              const idx = restingIdx(a.code)
              const pos = resting ? REST_SPOTS[idx % REST_SPOTS.length] : { x: a.desk.x + 4.5, y: a.desk.y + 19 }
              const typing = st === 'trabalhando'
              return (
                <div key={`agent-${a.code}`} className="absolute flex flex-col items-center" style={{
                  left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%,-50%)',
                  transition: 'left 1.6s ease-in-out, top 1.6s ease-in-out', zIndex: 3,
                }}>
                  {st === 'descanso' && <span className="absolute -top-3 right-[-6px] text-[9px] font-bold text-emerald-700" style={{ animation: 'oZ 2s ease-out infinite' }}>z</span>}
                  {st === 'aprovacao' && <Bell className="absolute -top-4 h-3 w-3 text-amber-600" style={{ animation: 'oGlow 1s ease-in-out infinite' }} />}
                  {st === 'erro' && <span className="absolute -top-4 text-xs font-bold text-red-600">!</span>}
                  <div className="flex flex-col items-center" style={{ animation: typing ? 'oType .35s ease-in-out infinite' : 'none' }}>
                    <div className="relative h-3.5 w-3.5 rounded-full border border-black/30" style={{ background: '#f1c9a5' }}>
                      <span className="absolute inset-x-0 top-0 h-1.5 rounded-t-full" style={{ background: a.hair }} />
                    </div>
                    <div className="-mt-0.5 h-2.5 w-6 rounded-t-xl" style={{ background: a.color, opacity: st === 'espera' ? 0.5 : 1 }} />
                  </div>
                  <span className={cn('mt-0.5 whitespace-nowrap rounded px-1 text-[8px] font-medium', st === 'trabalhando' ? 'bg-sky-600 text-white' : st === 'erro' ? 'bg-red-600 text-white' : 'bg-slate-800/80 text-white')}>
                    {a.short}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
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
      <p className="text-[11px] text-white/35">Cada agente trabalha quando a pipeline lhe atribui a sua tarefa real. Os que ainda não têm tarefa aguardam sentados.</p>
    </div>
  )
}
