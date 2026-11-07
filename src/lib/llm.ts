/**
 * Cliente único do FreeLLMAPI (API compatível com OpenAI).
 *
 * O FreeLLMAPI é um serviço que corre na tua máquina ou num servidor teu
 * (por omissão http://localhost:3001/v1) e junta vários fornecedores gratuitos
 * atrás de uma só chave "freellmapi-…". Modelos virtuais aceites:
 *   auto · auto:fast · auto:smart · fusion · ou um ID de modelo específico.
 *
 * A chave e o endereço ficam apenas no localStorage deste browser
 * (Administração → Integrações). Nunca são escritos no código nem enviados
 * para o Supabase.
 */

import { getApiKey, getLlmBaseUrl } from './apikeys'

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
    const key = getApiKey('freellm')
    if (!key) throw new Error('Chave FreeLLMAPI não configurada. Adicione-a em Administração → Integrações.')
    const base = getLlmBaseUrl()
    const model = isFreeLlmModel(opts.model) ? (opts.model as string) : 'auto'

    let res: Response
    try {
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
    } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') throw e
        throw networkError(base)
    }

    if (!res.ok) throw friendlyHttpError(res.status, await readError(res))

    const data = await res.json().catch(() => null)
    const text = stripThink(String(data?.choices?.[0]?.message?.content ?? ''))
    if (!text) throw new Error('O FreeLLMAPI devolveu uma resposta vazia.')

    return {
        text,
        routedVia: res.headers.get('x-routed-via'),
        model: data?.model ?? null,
        inputTokens: Number(data?.usage?.prompt_tokens) || 0,
        outputTokens: Number(data?.usage?.completion_tokens) || 0,
    }
}

/** Testa endereço + chave sem gastar pedidos de geração (GET /v1/models). */
export async function testFreeLlm(): Promise<{ ok: boolean; message: string; models: number }> {
    const key = getApiKey('freellm')
    if (!key) return { ok: false, message: 'Introduza e guarde a chave primeiro.', models: 0 }
    const base = getLlmBaseUrl()
    try {
        const res = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${key}` } })
        if (!res.ok) return { ok: false, message: friendlyHttpError(res.status, await readError(res)).message, models: 0 }
        const data = await res.json().catch(() => null)
        const n = Array.isArray(data?.data) ? data.data.length : 0
        return { ok: true, message: `Ligado ao FreeLLMAPI em ${base}.`, models: n }
    } catch {
        return { ok: false, message: networkError(base).message, models: 0 }
    }
}
