/**
 * Cliente universal de IA com suporte a múltiplos provedores.
 *
 * Suporta: OpenAI, Groq, Gemini, Anthropic, FreeLLMAPI e outros.
 * O sistema detecta automaticamente o provedor baseado na chave API.
 *
 * A chave e o endereço ficam apenas no localStorage deste browser
 * (Administração → Integrações). Nunca são escritos no código nem enviados
 * para o Supabase.
 */

import { getApiKey, getLlmBaseUrl, getUniversalUrl, detectProviderFromKey } from './apikeys'

export type ChatMsg = { role: 'system' | 'user' | 'assistant'; content: string }

export type LlmResult = {
    text: string
    /** Fornecedor/modelo que realmente respondeu (cabeçalho X-Routed-Via). */
    routedVia: string | null
    model: string | null
    inputTokens: number
    outputTokens: number
}

export const FREELLM_MODELS = [
    { id: 'auto', label: 'Automático (recomendado)' },
    { id: 'auto:fast', label: 'Rápido' },
    { id: 'auto:smart', label: 'Inteligente' },
] as const

export const isFreeLlmModel = (m: string | null | undefined) =>
    !!m && (m === 'fusion' || m === 'auto' || m.startsWith('auto:'))

/** Modelo efetivamente pedido ao FreeLLMAPI (valores antigos como gpt-4o-mini → auto). */
export const effectiveModel = (m: string | null | undefined) => (isFreeLlmModel(m) ? (m as string) : 'auto')

export function isFreeLlmConfigured(): boolean {
    const universalKey = getApiKey('universal')
    if (universalKey) return true
    return getApiKey('freellm').startsWith('freellmapi-')
}

function mixedContentProblem(base: string): boolean {
    if (typeof window === 'undefined' || window.location.protocol !== 'https:') return false
    if (!base.startsWith('http://')) return false
    const host = new URL(base).hostname
    return !(host === 'localhost' || host === '127.0.0.1' || host === '[::1]')
}

async function readError(res: Response): Promise<string> {
    try {
        const e = await res.json()
        return e?.error?.message ?? e?.message ?? ''
    } catch {
        return ''
    }
}

function friendlyHttpError(status: number, detail: string): Error {
    if (status === 401 || status === 403) return new Error('Chave FreeLLMAPI recusada. Confirme a chave em Administração → Integrações.')
    if (status === 404) return new Error('Endereço do FreeLLMAPI incorreto (404). Deve terminar em /v1, por exemplo http://localhost:3001/v1.')
    if (status === 429) return new Error('Todos os fornecedores gratuitos atingiram o limite neste momento. Tente novamente dentro de instantes.')
    return new Error(detail || `FreeLLMAPI devolveu erro ${status}.`)
}

function networkError(base: string): Error {
    if (mixedContentProblem(base)) {
        return new Error(`O browser bloqueia ${base} porque este site usa HTTPS. Publique o FreeLLMAPI com HTTPS ou abra o MKON em http://localhost.`)
    }
    return new Error(`Não foi possível ligar ao FreeLLMAPI em ${base}. Confirme que está a correr e que permite pedidos deste endereço (CORS).`)
}

const stripThink = (s: string) => s.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()

export async function llmChat(opts: {
    messages: ChatMsg[]
    model?: string
    temperature?: number
    maxTokens?: number
    signal?: AbortSignal
}): Promise<LlmResult> {
    const universalKey = getApiKey('universal')
    const freeLlmKey = getApiKey('freellm')
    
    let key = universalKey || freeLlmKey
    if (!key) throw new Error('Chave de IA não configurada. Adicione-a em Administração → Integrações.')
    
    const detected = detectProviderFromKey(key)
    let base = getUniversalUrl() || getLlmBaseUrl()
    
    // Se não tiver URL customizada, usa a URL padrão do provedor detectado
    if (!getUniversalUrl()) {
        if (detected.provider === 'groq') base = 'https://api.groq.com/openai/v1'
        else if (detected.provider === 'openai') base = 'https://api.openai.com/v1'
        else if (detected.provider === 'anthropic') base = 'https://api.anthropic.com/v1'
        else if (detected.provider === 'gemini') base = 'https://generativelanguage.googleapis.com'
        else if (detected.provider === 'freellmapi') base = getLlmBaseUrl()
    }
    
    const model = isFreeLlmModel(opts.model) ? (opts.model as string) : 'auto'

    let res: Response
    try {
        if (detected.provider === 'gemini') {
            // Gemini usa formato diferente
            const geminiModel = model === 'auto' ? 'gemini-2.0-flash' : model
            res = await fetch(`${base}/v1beta/models/${geminiModel}:generateContent?key=${key}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: opts.messages.map(m => ({
                        role: m.role === 'assistant' ? 'model' : m.role,
                        parts: [{ text: m.content }]
                    })),
                    generationConfig: {
                        temperature: opts.temperature ?? 0.6,
                        maxOutputTokens: opts.maxTokens ?? 1500,
                    }
                }),
                signal: opts.signal,
            })
        } else if (detected.provider === 'anthropic') {
            // Anthropic usa formato diferente
            res = await fetch(`${base}/messages`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-api-key': key,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: model === 'auto' ? 'claude-3-5-sonnet-20241022' : model,
                    messages: opts.messages.filter(m => m.role !== 'system'),
                    system: opts.messages.find(m => m.role === 'system')?.content,
                    max_tokens: opts.maxTokens ?? 1500,
                    temperature: opts.temperature ?? 0.6,
                }),
                signal: opts.signal,
            })
        } else {
            // OpenAI-compatible (Groq, OpenAI, FreeLLMAPI, etc.)
            res = await fetch(`${base}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
                body: JSON.stringify({
                    model,
                    messages: opts.messages,
                    temperature: opts.temperature ?? 0.6,
                    max_tokens: opts.maxTokens ?? 1500,
                }),
                signal: opts.signal,
            })
        }
    } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') throw e
        throw networkError(base)
    }

    if (!res.ok) throw friendlyHttpError(res.status, await readError(res))

    const data = await res.json().catch(() => null)
    let text = ''
    
    if (detected.provider === 'gemini') {
        text = stripThink(String(data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''))
    } else if (detected.provider === 'anthropic') {
        text = stripThink(String(data?.content?.[0]?.text ?? ''))
    } else {
        text = stripThink(String(data?.choices?.[0]?.message?.content ?? ''))
    }
    
    if (!text) throw new Error('O provedor de IA devolveu uma resposta vazia.')

    return {
        text,
        routedVia: res.headers.get('x-routed-via') || detected.label,
        model: data?.model ?? null,
        inputTokens: Number(data?.usage?.prompt_tokens || data?.usage?.input_tokens) || 0,
        outputTokens: Number(data?.usage?.completion_tokens || data?.usage?.output_tokens) || 0,
    }
}

/** Testa endereço + chave sem gastar pedidos de geração (GET /v1/models). */
export async function testFreeLlm(): Promise<{ ok: boolean; message: string; models: number }> {
    const universalKey = getApiKey('universal')
    const freeLlmKey = getApiKey('freellm')
    
    const key = universalKey || freeLlmKey
    if (!key) return { ok: false, message: 'Introduza e guarde a chave primeiro.', models: 0 }
    
    const detected = detectProviderFromKey(key)
    let base = getUniversalUrl() || getLlmBaseUrl()
    
    // Se não tiver URL customizada, usa a URL padrão do provedor detectado
    if (!getUniversalUrl()) {
        if (detected.provider === 'groq') base = 'https://api.groq.com/openai/v1'
        else if (detected.provider === 'openai') base = 'https://api.openai.com/v1'
        else if (detected.provider === 'anthropic') base = 'https://api.anthropic.com/v1'
        else if (detected.provider === 'gemini') base = 'https://generativelanguage.googleapis.com'
        else if (detected.provider === 'freellmapi') base = getLlmBaseUrl()
    }
    
    try {
        let res: Response
        if (detected.provider === 'gemini') {
            res = await fetch(`${base}/v1beta/models?key=${key}`)
        } else if (detected.provider === 'anthropic') {
            // Anthropic não tem endpoint de models público
            res = await fetch(`${base}/messages`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-api-key': key,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-5-sonnet-20241022',
                    messages: [{ role: 'user', content: 'ping' }],
                    max_tokens: 1,
                }),
            })
        } else {
            res = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${key}` } })
        }
        
        if (!res.ok) return { ok: false, message: friendlyHttpError(res.status, await readError(res)).message, models: 0 }
        
        const data = await res.json().catch(() => null)
        const n = Array.isArray(data?.data) ? data.data.length : 0
        return { ok: true, message: `Ligado a ${detected.label} em ${base}.`, models: n }
    } catch {
        return { ok: false, message: networkError(base).message, models: 0 }
    }
}
