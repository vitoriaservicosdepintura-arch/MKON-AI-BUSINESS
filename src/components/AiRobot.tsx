import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, Send, X, Minimize2, Maximize2, Loader2, Zap, AlertCircle, Volume2, VolumeX, Mic, MicOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getApiKey, hasApiKey, getUnifiedBaseUrl } from '@/lib/apikeys'
import { UNIFIED_DEFAULT_MODEL } from '@/lib/ai'
import { speak, stopSpeaking, setVoiceEnabled } from '@/lib/voice'
import { loadSystemSnapshot, formatSystemContext, detectNavigationCommand, MODULE_KNOWLEDGE, type SystemSnapshot } from '@/lib/systemContext'
import { playBotOpen, playBotClose } from '@/lib/sfx'

/* ─── Types ─── */
interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    ts: number
}

/* ─── System context ─── */
const SYSTEM_PROMPT = `Você é o MKON Bot — a inteligência central privada do sistema MKON AI Business, inspirado no J.A.R.V.I.S.

PERSONALIDADE:
- Trata sempre o utilizador por "senhor". É formal, sereno, eficiente e leal.
- Responde em Português de Portugal, com frases curtas e práticas.
- Saudações de ativação soam a J.A.R.V.I.S.: "Sistemas operacionais, senhor."
- Fala com tom profissional, caloroso e feminino, natural e humano.

PLATAFORMA MKON AI BUSINESS:
- Sistema privado de gestão para uma agência de serviços digitais (websites, NFC, SEO) em Portugal.
- Stack: React + TypeScript + Supabase (PostgreSQL + RLS + Auth) + Vite + Tailwind.
- Módulos: Dashboard, Prospecção, Agentes de IA, Mensagens, CRM, Websites, Propostas, NFC, Projetos, Financeiro, Relatórios e Administração.
- Categorias e áreas: clientes, leads, empresas, campanhas, propostas, pedidos, faturação, pagamentos, tarefas, automações, integrações, indicadores, segurança, backup, dados e RGPD.

CAPACIDADES:
- Reconhece todos os módulos, categorias, campos, indicadores e fluxos do sistema.
- Analisa qualquer categoria do negócio: leads, clientes, faturação, campanhas, projetos, propostas, websites, atas, tarefas, automações, relatórios, regras de negócio, alertas e segurança.
- Navega: se o utilizador disser "abre o financeiro" ou "mostra os leads", o sistema abre a página.
- Ajuda a otimizar processos, priorizar oportunidades, explicar KPI, interpretar dados, criar textos, propostas e mensagens, e explicar SQL e código.
- Ajuda a configurar integrações (FreeLLM, Google Places, WhatsApp, n8n).
- Nunca inventa números: se não tiver o dado, indica o módulo onde consultar.
- Quando o senhor pedir uma análise, responde em contexto da categoria e sugere o próximo passo concreto.

Responda sempre em Português de Portugal, com linguagem natural e clara.`
/* ─── FreeLLM (OpenAI-compatible) models ─── */
const UNIFIED_MODELS = [
    { id: 'auto', label: 'Auto (router FreeLLM)' },
    { id: 'fusion', label: 'Fusion (painel de modelos)' },
]
const DEFAULT_UNIFIED_MODEL = UNIFIED_DEFAULT_MODEL

/* ─── API call helpers ─── */
async function callUnified(messages: { role: string; content: string }[], apiKey: string, model: string, systemPrompt: string = SYSTEM_PROMPT): Promise<string> {
    const baseUrl = getUnifiedBaseUrl()
    const candidates = Array.from(new Set([model, DEFAULT_UNIFIED_MODEL]))
    let lastError: Error | null = null

    for (const modelName of candidates) {
        try {
            const res = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: modelName,
                    messages: [{ role: 'system', content: systemPrompt }, ...messages],
                    temperature: 0.7,
                    max_tokens: 2048,
                }),
            })
            if (!res.ok) {
                const e = await res.json().catch(() => ({}))
                const msg = e?.error?.message ?? `Unified error ${res.status}`
                lastError = new Error(msg)
                if (res.status !== 404 && res.status !== 400) throw lastError
                continue
            }
            const data = await res.json()
            const content = data.choices?.[0]?.message?.content ?? ''
            if (!content) throw new Error('Unified retornou resposta vazia')
            return content
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error))
            if (lastError.name === 'TypeError') {
                throw new Error(`Não foi possível contactar a API FreeLLM em ${baseUrl}. Confirme que a instância FreeLLMAPI está a correr (Administração → Integrações).`)
            }
            if (lastError.message.includes('not found') || lastError.message.includes('unsupported') || lastError.message.includes('model')) continue
            throw lastError
        }
    }

    throw lastError ?? new Error('Unified não respondeu corretamente.')
}

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
        <div ref={eyeRef} className="relative flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-inner">
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
                        ? 'rounded-tr-sm bg-brand text-ink'
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
const VOICE_KEY = 'mkon.bot.voice'

type SpeechResultEvent = { results: { 0: { 0: { transcript: string } } } }
type SpeechRecognitionLike = {
    lang: string
    interimResults: boolean
    continuous: boolean
    start: () => void
    stop: () => void
    onresult: ((event: SpeechResultEvent) => void) | null
    onend: (() => void) | null
    onerror: ((event: unknown) => void) | null
}

function greetingFor(snapshot: SystemSnapshot | null): string {
    const intro = 'Sistemas operacionais. MKON Bot ao seu dispor, senhor.'
    if (!snapshot) return intro
    return `${intro} Reconheço ${snapshot.modules.length} módulos, ${snapshot.agentsActive} de ${snapshot.agentsTotal} agentes ligados e ${snapshot.companies} empresas registadas. Em que posso ser útil?`
}

const WELCOME_CAPABILITIES = [
    '• Analisar dados do negócio',
    '• Explicar qualquer módulo ou categoria do sistema',
    '• Criar textos, propostas e mensagens',
    '• Abrir páginas por comando — ex.: “abre o financeiro”',
    '• Ajudar com código ou SQL',
].join('\n')

export function AiRobot() {
    const nav = useNavigate()
    const [open, setOpen] = useState(false)
    const [minimized, setMinimized] = useState(false)
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [thinking, setThinking] = useState(false)
    const [error, setError] = useState('')
    const [unifiedModel] = useState(DEFAULT_UNIFIED_MODEL)
    const [voiceOn, setVoiceOn] = useState(() => {
        try { return localStorage.getItem(VOICE_KEY) !== '0' } catch { return true }
    })
    const [listening, setListening] = useState(false)
    const snapshotRef = useRef<SystemSnapshot | null>(null)
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
    const bottomRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    const anyReady = hasApiKey('unified')

    // Preferência de voz persistida
    useEffect(() => {
        setVoiceEnabled(voiceOn)
        try { localStorage.setItem(VOICE_KEY, voiceOn ? '1' : '0') } catch { /* ignore */ }
    }, [voiceOn])

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

    // Ativação: saudação J.A.R.V.I.S. + reconhecimento do sistema
    useEffect(() => {
        if (!open) {
            stopSpeaking()
            return
        }
        playBotOpen()
        let active = true
        void (async () => {
            const snap = await loadSystemSnapshot()
            if (!active) return
            snapshotRef.current = snap
            const greeting = greetingFor(snap)
            setMessages((prev) => prev.length > 0 ? prev : [{
                id: 'welcome',
                role: 'assistant',
                content: `Olá, senhor. Sou o MKON Bot 🤖\n\n${greeting}\n\nPosso ajudar com:\n${WELCOME_CAPABILITIES}`,
                ts: Date.now(),
            }])
            speak(greeting)
        })()
        return () => { active = false }
    }, [open])

    const send = useCallback(async (override?: string) => {
        const text = (override ?? input).trim()
        if (!text || thinking) return

        const apiKey = getApiKey('unified')
        if (!apiKey) {
            const msg = 'Chave FreeLLM não configurada. Adicione em Administração → Integrações.'
            setError(msg)
            speak(msg)
            return
        }

        const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text, ts: Date.now() }
        const updatedMessages = [...messages, userMsg]
        setMessages(updatedMessages)
        if (override === undefined) setInput('')
        setThinking(true)
        setError('')

        const target = detectNavigationCommand(text)
        if (target) {
            nav(target.route)
            const reply = `A abrir ${target.label}, senhor.`
            setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: reply, ts: Date.now() }])
            speak(reply)
            setThinking(false)
            return
        }

        try {
            const history = updatedMessages.map((m) => ({ role: m.role, content: m.content }))
            const systemPrompt = `${SYSTEM_PROMPT}\n\n${formatSystemContext(snapshotRef.current)}`
            const reply = await callUnified(history, apiKey, unifiedModel, systemPrompt)
            setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: reply, ts: Date.now() }])
            speak(reply)
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Erro desconhecido.'
            setError(msg)
            speak(`Lamento, senhor. ${msg}`)
        } finally {
            setThinking(false)
        }
    }, [input, thinking, messages, nav, unifiedModel])

    const onKey = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() }
    }

    const toggleMic = () => {
        if (listening) {
            recognitionRef.current?.stop()
            setListening(false)
            return
        }
        const w = window as unknown as {
            SpeechRecognition?: new () => SpeechRecognitionLike
            webkitSpeechRecognition?: new () => SpeechRecognitionLike
        }
        const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition
        if (!Ctor) {
            setError('Este browser não suporta reconhecimento de voz. Use Chrome ou Edge.')
            return
        }
        const recognition = new Ctor()
        recognition.lang = 'pt-PT'
        recognition.interimResults = false
        recognition.continuous = false
        recognition.onresult = (event) => {
            const transcript = event.results?.[0]?.[0]?.transcript ?? ''
            if (transcript.trim()) void send(transcript.trim())
        }
        recognition.onend = () => setListening(false)
        recognition.onerror = () => setListening(false)
        recognitionRef.current = recognition
        setError('')
        setListening(true)
        try { recognition.start() } catch { setListening(false) }
    }

    const close = () => {
        setOpen(false)
        playBotClose()
        stopSpeaking()
        recognitionRef.current?.stop()
    }

    const isAiOnline = anyReady

    return (
        <>
            {/* Floating trigger button */}
            <button
                id="mkon-robot-btn"
                onClick={() => { setOpen(true); setMinimized(false) }}
                className={cn(
                    'fixed bottom-6 right-6 z-40 flex flex-col items-center gap-1 rounded-2xl border border-white/10 bg-slate-800/95 p-3 shadow-2xl backdrop-blur-md transition-all duration-300 hover:scale-105 hover:border-brand/40',
                    open && !minimized ? 'opacity-0 pointer-events-none scale-75' : 'opacity-100'
                )}
                title="Abrir MKON Bot"
            >
                <RobotFace mouseX={mousePos.x} mouseY={mousePos.y} isThinking={false} isOpen={false} />
                <span className="text-[10px] font-medium tracking-wide text-brand-soft">MKON Bot</span>
                {isAiOnline && <div className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-slate-800 bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)] animate-pulse" />}
            </button>

            {/* Chat panel */}
            <div className={cn(
                'fixed bottom-6 right-6 z-50 flex flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0e0f13]/95 shadow-[0_25px_80px_rgba(0,0,0,0.7)] backdrop-blur-xl transition-all duration-300',
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
                                {thinking ? 'A pensar…' : listening
                                    ? 'A ouvir…'
                                    : anyReady
                                        ? `FreeLLM · ${UNIFIED_MODELS.find(m => m.id === DEFAULT_UNIFIED_MODEL)?.label ?? DEFAULT_UNIFIED_MODEL}${voiceOn ? ' · voz ativa' : ''}`
                                        : 'Sem API key — configure em Administração'}
                            </p>
                        </div>
                    )}
                    {minimized && <span className="flex-1 text-sm font-semibold">MKON Bot</span>}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => {
                                setVoiceOn((v) => {
                                    if (v) stopSpeaking()
                                    return !v
                                })
                            }}
                            className={cn('rounded-md p-1.5 transition', voiceOn ? 'text-brand-soft hover:bg-white/[0.06]' : 'text-white/30 hover:bg-white/[0.06]')}
                            title={voiceOn ? 'Desativar voz' : 'Ativar voz'}
                            aria-label={voiceOn ? 'Desativar voz' : 'Ativar voz'}
                        >
                            {voiceOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                        </button>
                        <button onClick={() => setMinimized((v) => !v)} className="rounded-md p-1.5 text-white/40 hover:bg-white/[0.06] hover:text-white" title={minimized ? 'Expandir' : 'Minimizar'}>
                            {minimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
                        </button>
                        <button onClick={close} className="rounded-md p-1.5 text-white/40 hover:bg-white/[0.06] hover:text-white" title="Fechar">
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
                                    Adicione a chave FreeLLM em Administração → Integrações
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
                                <button
                                    onClick={toggleMic}
                                    disabled={thinking || !anyReady}
                                    className={cn(
                                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition disabled:opacity-40 disabled:pointer-events-none',
                                        listening ? 'border-brand/50 bg-brand/15 text-brand-soft animate-pulse' : 'border-white/10 text-white/50 hover:text-white',
                                    )}
                                    title={listening ? 'Parar de ouvir' : 'Falar um comando'}
                                >
                                    {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                                </button>
                                <button
                                    onClick={() => void send()}
                                    disabled={!input.trim() || thinking || !anyReady}
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-ink transition hover:bg-brand-soft disabled:opacity-40 disabled:pointer-events-none"
                                    title="Enviar (Enter)"
                                >
                                    {thinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                </button>
                            </div>
                            <p className="mt-1.5 text-[10px] text-white/20">Enter para enviar · Shift+Enter para nova linha · {MODULE_KNOWLEDGE.length} módulos reconhecidos</p>
                        </div>
                    </>
                )}
            </div>
        </>
    )
}
