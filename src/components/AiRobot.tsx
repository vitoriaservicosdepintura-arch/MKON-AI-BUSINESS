import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, Send, X, Minimize2, Maximize2, Loader2, Zap, AlertCircle, Mic } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase, isConfigured } from '@/lib/supabase'
import { playBotOpen, playBotClose, playClick } from '@/lib/sfx'
import { greetingForNow, speakNatural, stopSpeaking } from '@/lib/voice'

const greetAndAsk = () => {
    const url = import.meta.env.VITE_SUPABASE_URL as string
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
    const getToken = async () => (await supabase.auth.getSession()).data.session?.access_token ?? null
    speakNatural(`${greetingForNow()}, senhor. O que deseja que eu faça?`, getToken, url, anonKey)
}

/** Agente no servidor (Edge Function mkon-agent): usa a sessão de login do proprietário. */
type AgentAction = { type: 'navigate'; path: string }

async function callAgent(messages: { role: 'user' | 'assistant'; content: string }[]): Promise<{ reply: string; tools_used: string[]; actions?: AgentAction[] }> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Sessão expirada. Inicie sessão novamente.')
    const url = import.meta.env.VITE_SUPABASE_URL as string
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
    const res = await fetch(`${url}/functions/v1/mkon-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, apikey: anonKey },
        body: JSON.stringify({ messages }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error ?? `O agente devolveu erro ${res.status}.`)
    return data
}

/* ─── Types ─── */
interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    ts: number
}

/* ─── System context ─── */
/* ─── Eye component ─── */
function Eye({ mouseX, mouseY, eyeRef }: { mouseX: number; mouseY: number; eyeRef: { current: HTMLDivElement | null } }) {
    const [pupilPos, setPupilPos] = useState({ x: 0, y: 0 })

    useEffect(() => {
        if (!eyeRef.current) return
        const rect = eyeRef.current.getBoundingClientRect()
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        const dx = mouseX - cx
        const dy = mouseY - cy
        const dist = Math.sqrt(dx * dx + dy * dy)
        const maxDist = 4
        const ratio = Math.min(dist, maxDist) / (dist || 1)
        setPupilPos({ x: dx * ratio, y: dy * ratio })
    }, [mouseX, mouseY, eyeRef])

    return (
        <div ref={eyeRef} className="relative flex h-5 w-5 items-center justify-center rounded-full bg-[#ffffff] shadow-inner">
            <div
                className="h-2.5 w-2.5 rounded-full bg-gray-900 transition-none"
                style={{ transform: `translate(${pupilPos.x}px, ${pupilPos.y}px)` }}
            >
                <div className="absolute right-0.5 top-0.5 h-1 w-1 rounded-full bg-white/80" />
            </div>
        </div>
    )
}

/* ─── Robot Body ─── */
function RobotFace({ mouseX, mouseY, isThinking, isOpen }: { mouseX: number; mouseY: number; isThinking: boolean; isOpen: boolean }) {
    const eye1Ref = useRef<HTMLDivElement>(null)
    const eye2Ref = useRef<HTMLDivElement>(null)

    return (
        <div className={cn('relative flex flex-col items-center', isThinking && 'animate-bounce-slow')}>
            {/* Antenna */}
            <div className="flex flex-col items-center">
                <div className="h-3 w-0.5 bg-gradient-to-b from-brand to-brand/50" />
                <div className={cn('h-2 w-2 rounded-full bg-brand shadow-[0_0_8px_2px] shadow-brand/70', isThinking && 'animate-pulse')} />
            </div>
            {/* Head */}
            <div className="relative mt-1 flex h-14 w-16 flex-col items-center justify-center gap-1 rounded-xl border border-white/20 bg-gradient-to-b from-slate-700 to-slate-800 shadow-xl">
                {/* Eyes */}
                <div className="flex gap-3">
                    <Eye mouseX={mouseX} mouseY={mouseY} eyeRef={eye1Ref} />
                    <Eye mouseX={mouseX} mouseY={mouseY} eyeRef={eye2Ref} />
                </div>
                {/* Mouth */}
                <div className={cn('flex gap-0.5', isOpen ? 'items-end' : 'items-center')}>
                    {isThinking ? (
                        <div className="flex gap-0.5">
                            {[0, 1, 2].map((i) => (
                                <div key={i} className="h-1 w-1 rounded-full bg-brand/80 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                            ))}
                        </div>
                    ) : (
                        <div className={cn('h-1 rounded-full bg-white/40 transition-all', isOpen ? 'w-6' : 'w-4')} />
                    )}
                </div>
                {/* Shine */}
                <div className="pointer-events-none absolute inset-x-2 top-1 h-px rounded-full bg-white/20" />
            </div>
            {/* Body */}
            <div className="mt-0.5 flex h-4 w-10 items-center justify-center rounded-b-lg border border-t-0 border-white/10 bg-slate-800">
                <div className="flex gap-1">
                    <div className={cn('h-1.5 w-1.5 rounded-full', isThinking ? 'bg-brand animate-pulse' : 'bg-white/20')} />
                    <div className={cn('h-1.5 w-1.5 rounded-full', isThinking ? 'bg-brand/60 animate-pulse' : 'bg-white/20')} style={{ animationDelay: '0.2s' }} />
                </div>
            </div>
        </div>
    )
}

/* ─── Message Bubble ─── */
function Bubble({ msg }: { msg: Message }) {
    const isUser = msg.role === 'user'
    return (
        <div className={cn('flex gap-2', isUser ? 'flex-row-reverse' : 'flex-row')}>
            {!isUser && (
                <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/20">
                    <Bot className="h-3.5 w-3.5 text-brand-soft" />
                </div>
            )}
            <div
                className={cn(
                    'max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed',
                    isUser
                        ? 'rounded-tr-sm bg-brand text-on-brand'
                        : 'rounded-tl-sm border border-white/[0.08] bg-white/[0.05] text-white/85'
                )}
                style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
            >
                {msg.content}
            </div>
        </div>
    )
}

/* ─── Main Robot Component ─── */
export function AiRobot() {
    const navigate = useNavigate()
    const [open, setOpen] = useState(false)
    const [minimized, setMinimized] = useState(false)
    const [visible, setVisible] = useState(() => {
        try { return localStorage.getItem('mkon.robot.visible') !== '0' } catch { return true }
    })
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [thinking, setThinking] = useState(false)
    const [error, setError] = useState('')
    const bottomRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    // Persistir visibilidade
    useEffect(() => {
        try { localStorage.setItem('mkon.robot.visible', visible ? '1' : '0') } catch { /* ignore */ }
    }, [visible])

    // Track mouse globally for eye animation
    useEffect(() => {
        const onMove = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY })
        window.addEventListener('mousemove', onMove)
        return () => window.removeEventListener('mousemove', onMove)
    }, [])

    // Auto-scroll
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, thinking])

    // Welcome message
    useEffect(() => {
        if (open && messages.length === 0) {
            const apiStatus = isConfigured
                ? 'Pronto! Ligado ao agente MKON (dados reais do sistema).'
                : '⚠️ Supabase não configurado neste site.'
            setMessages([{
                id: 'welcome',
                role: 'assistant',
                content: `Olá! Sou o MKON Bot 🤖\n\n${apiStatus}\n\nComo posso ajudar? Pode pedir-me para:\n• Analisar dados do negócio\n• Criar textos e propostas\n• Explicar como usar o sistema\n• Ajudar com código ou SQL\n• Qualquer tarefa que precise!`,
                ts: Date.now(),
            }])
        }
    }, [open, messages.length])

    const send = useCallback(async (override?: unknown) => {
        const text = (typeof override === 'string' ? override : input).trim()
        if (!text || thinking) return
        playClick()

        if (!isConfigured) {
            setError('Supabase não configurado neste site.')
            return
        }

        const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text, ts: Date.now() }
        const updatedMessages = [...messages, userMsg]
        setMessages(updatedMessages)
        setInput('')
        setThinking(true)
        setError('')

        try {
            const history = updatedMessages
                .filter((m) => m.id !== 'welcome')
                .map((m) => ({ role: m.role, content: m.content }))
            const r = await callAgent(history)
            setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: r.reply, ts: Date.now() }])
            // Ações devolvidas pelo agente (ex.: abrir uma página do menu)
            for (const a of r.actions ?? []) {
                if (a.type === 'navigate' && a.path.startsWith('/')) navigate(a.path)
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erro desconhecido.')
        } finally {
            setThinking(false)
        }
    }, [input, thinking, messages, navigate])

    const onKey = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
    }

    /* Microfone: reconhecimento de voz do browser (pt-PT). Envia a frase quando termina. */
    const [listening, setListening] = useState(false)
    const recognitionRef = useRef<any>(null)
    const speechSupported = typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)

    const toggleMic = () => {
        if (listening) { recognitionRef.current?.stop(); return }
        const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        if (!Ctor) return
        const rec = new Ctor()
        rec.lang = 'pt-PT'
        rec.interimResults = false
        rec.continuous = false
        rec.onresult = (ev: any) => {
            const said = String(ev.results?.[0]?.[0]?.transcript ?? '').trim()
            if (said) { setInput(said); send(said) }
        }
        rec.onerror = (ev: any) => setError(ev?.error === 'not-allowed' ? 'Permita o acesso ao microfone no browser.' : 'Não consegui ouvir. Tente novamente.')
        rec.onend = () => { setListening(false); recognitionRef.current = null }
        recognitionRef.current = rec
        setError('')
        setListening(true)
        rec.start()
    }

    const anyReady = isConfigured
    const isAiOnline = anyReady

    return (
        <>
            {/* Floating trigger button */}
            {visible && (
                <button
                    id="mkon-robot-btn"
                    onClick={() => { setOpen(true); setMinimized(false); playBotOpen(); greetAndAsk() }}
                    className={cn(
                        'fixed bottom-6 right-6 z-40 flex flex-col items-center gap-1 rounded-2xl border border-white/10 bg-graphite/95 p-3 shadow-2xl backdrop-blur-md transition-all duration-300 hover:scale-105 hover:border-brand/40',
                        open && !minimized ? 'opacity-0 pointer-events-none scale-75' : 'opacity-100'
                    )}
                    title="Abrir MKON Bot"
                >
                    <RobotFace mouseX={mousePos.x} mouseY={mousePos.y} isThinking={false} isOpen={false} />
                    <span className="text-[10px] font-medium tracking-wide text-brand-soft">MKON Bot</span>
                    {isAiOnline && <div className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-graphite bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)] animate-pulse" />}
                </button>
            )}

            {/* Toggle visibility button - próximo ao robô */}
            <button
                onClick={() => setVisible(!visible)}
                className={cn(
                    'fixed bottom-6 z-40 flex h-10 w-10 items-center justify-center rounded-full border-2 shadow-xl backdrop-blur-md transition-all duration-300 hover:scale-105',
                    visible 
                        ? 'right-16 border-cyan-400/50 bg-cyan-400/20 text-cyan-300 hover:border-cyan-400/70 hover:bg-cyan-400/30' 
                        : 'right-6 border-cyan-400/50 bg-cyan-400/20 text-cyan-300 hover:border-cyan-400/70 hover:bg-cyan-400/30'
                )}
                title={visible ? 'Esconder MKON Bot' : 'Mostrar MKON Bot'}
            >
                {visible ? <X className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </button>

            {/* Chat panel */}
            <div className={cn(
                'fixed bottom-6 right-6 z-50 flex flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-graphite/95 shadow-[0_25px_80px_rgba(0,0,0,0.7)] backdrop-blur-xl transition-all duration-300',
                open ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none',
                minimized ? 'h-20 w-72' : 'h-[580px] w-[380px]'
            )}>
                {/* Header */}
                <div className="flex items-center gap-3 border-b border-white/[0.07] bg-white/[0.03] px-4 py-3">
                    <div className="flex h-9 w-9 items-center justify-center">
                        <RobotFace mouseX={mousePos.x} mouseY={mousePos.y} isThinking={thinking} isOpen={!minimized} />
                    </div>
                    {!minimized && (
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold">MKON Bot</p>
                            <p className="text-[10px] text-white/40 truncate">
                                {thinking ? 'A pensar…' : anyReady ? 'Agente MKON · dados reais' : 'Supabase não configurado'}
                            </p>
                        </div>
                    )}
                    {minimized && <span className="flex-1 text-sm font-semibold">MKON Bot</span>}
                    <div className="flex items-center gap-1">
                        <button onClick={() => setMinimized((v) => !v)} className="rounded-md p-1.5 text-white/40 hover:bg-white/[0.06] hover:text-white" title={minimized ? 'Expandir' : 'Minimizar'}>
                            {minimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
                        </button>
                        <button onClick={() => { setOpen(false); playBotClose(); stopSpeaking() }} className="rounded-md p-1.5 text-white/40 hover:bg-white/[0.06] hover:text-white" title="Fechar">
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>

                {!minimized && (
                    <>
                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                            {messages.map((m) => <Bubble key={m.id} msg={m} />)}
                            {thinking && (
                                <div className="flex gap-2">
                                    <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/20">
                                        <Bot className="h-3.5 w-3.5 text-brand-soft" />
                                    </div>
                                    <div className="rounded-2xl rounded-tl-sm border border-white/[0.08] bg-white/[0.05] px-3 py-2">
                                        <div className="flex gap-1">
                                            {[0, 1, 2].map((i) => (
                                                <div key={i} className="h-1.5 w-1.5 rounded-full bg-brand/60 animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {error && (
                                <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.08] p-3 text-xs text-red-300">
                                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                    {error}
                                </div>
                            )}
                            <div ref={bottomRef} />
                        </div>

                        {/* Clear */}
                        {messages.length > 1 && (
                            <div className="px-4 pb-1 flex justify-end">
                                <button onClick={() => { setMessages([]); setError('') }} className="text-[10px] text-white/25 hover:text-white/50 transition">
                                    Limpar conversa
                                </button>
                            </div>
                        )}

                        {/* Input */}
                        <div className="border-t border-white/[0.07] p-3">
                            {!anyReady && (
                                <div className="mb-2 flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/[0.07] px-3 py-1.5 text-[10px] text-amber-300">
                                    <Zap className="h-3 w-3 shrink-0" />
                                    Supabase não configurado neste site
                                </div>
                            )}
                            <div className="flex items-end gap-2">
                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={onKey}
                                    placeholder="Escreva uma tarefa ou pergunta…"
                                    rows={2}
                                    disabled={thinking || !anyReady}
                                    className="flex-1 resize-none rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white placeholder-white/25 focus:border-brand/40 focus:outline-none focus:ring-0 disabled:opacity-40"
                                />
                                {speechSupported && (
                                    <button
                                        onClick={toggleMic}
                                        disabled={thinking || !anyReady}
                                        className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition disabled:opacity-40', listening ? 'border-red-400/60 bg-red-500/20 text-red-200 animate-pulse' : 'border-white/[0.1] bg-white/[0.04] text-white/70 hover:bg-white/[0.08]')}
                                        title={listening ? 'A ouvir… clique para parar' : 'Falar com o agente'}
                                        aria-label="Microfone"
                                    >
                                        <Mic className="h-4 w-4" />
                                    </button>
                                )}
                                <button
                                    onClick={() => send()}
                                    disabled={!input.trim() || thinking || !anyReady}
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-on-brand transition hover:bg-brand-soft disabled:opacity-40 disabled:pointer-events-none"
                                    title="Enviar (Enter)"
                                >
                                    {thinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                </button>
                            </div>
                            <p className="mt-1.5 text-[10px] text-white/20">Enter para enviar · Shift+Enter para nova linha</p>
                        </div>
                    </>
                )}
            </div>
        </>
    )
}
