/**
 * API Keys — armazenamento local seguro (apenas no browser do proprietário).
 * As chaves NUNCA são enviadas para o Supabase.
 * A única chave de IA suportada é a FreeLLM (API unificada OpenAI-compatible).
 */

const PREFIX = 'mkon_apikey_'
const LEGACY_AI_KEYS = ['groq', 'gemini'] as const
const BASE_URL_KEY = 'mkon_apikey_unified_base'

const FALLBACK_UNIFIED_BASE_URL = 'http://localhost:3001/v1'

/**
 * Domínios públicos que já não servem a API FreeLLMAPI (devolvem 410 Gone).
 * Valores antigos guardados no browser são ignorados para que a app volte
 * automaticamente para a instância local.
 */
const DEAD_UNIFIED_HOSTS = new Set(['api.free-llm.com', 'free-llm.com', 'www.free-llm.com'])

function normalizeBaseUrl(value: string): string {
    const trimmed = value.trim().replace(/\/+$/, '')
    if (!trimmed) return ''

    try {
        const parsed = new URL(trimmed)
        if (!['http:', 'https:'].includes(parsed.protocol)) return ''
        if (DEAD_UNIFIED_HOSTS.has(parsed.hostname.toLowerCase())) return ''
        return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`
    } catch {
        return ''
    }
}

export function isKnownDeadUnifiedHost(value: string): boolean {
    try {
        return DEAD_UNIFIED_HOSTS.has(new URL(value.trim()).hostname.toLowerCase())
    } catch {
        return false
    }
}

export const DEFAULT_UNIFIED_KEY = (import.meta.env.VITE_UNIFIED_API_KEY as string | undefined ?? '').trim()
export const DEFAULT_UNIFIED_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_UNIFIED_API_BASE_URL as string | undefined ?? '') || FALLBACK_UNIFIED_BASE_URL

/** Endereço da instância FreeLLMAPI (self-hosted). Pode ser alterado na Administração. */
export function getUnifiedBaseUrl(): string {
    try {
        const stored = localStorage.getItem(BASE_URL_KEY) ?? ''
        const custom = normalizeBaseUrl(stored)
        if (custom) return custom
        // Endereço morto (ou inválido) guardado numa sessão anterior: limpar.
        if (stored) localStorage.removeItem(BASE_URL_KEY)
    } catch { /* ignore */ }
    return DEFAULT_UNIFIED_BASE_URL
}

export function setUnifiedBaseUrl(value: string) {
    try {
        const normalized = normalizeBaseUrl(value)
        if (normalized) localStorage.setItem(BASE_URL_KEY, normalized)
        else localStorage.removeItem(BASE_URL_KEY)
    } catch { /* ignore */ }
}

export type ApiKeyId = 'unified' | 'openai' | 'google_places' | 'whatsapp' | 'n8n'
export type ApiKeyProvider = 'unified'

export const API_KEY_META: Record<ApiKeyId, { label: string; placeholder: string; url: string; provider: string }> = {
    unified: { label: 'FreeLLM / Unified API Key', placeholder: 'freellmapi-...', url: 'https://github.com/tashfeenahmed/freellmapi', provider: 'unified' },
    openai: { label: 'OpenAI API Key', placeholder: 'sk-...', url: 'https://platform.openai.com/api-keys', provider: 'openai' },
    google_places: { label: 'Google Places API Key', placeholder: 'AIza...', url: 'https://console.cloud.google.com/apis/credentials', provider: 'google_places' },
    whatsapp: { label: 'WhatsApp Access Token', placeholder: 'EAAh...', url: 'https://developers.facebook.com/apps/', provider: 'whatsapp' },
    n8n: { label: 'n8n Webhook Secret', placeholder: 'whsec_...', url: 'https://docs.n8n.io/integrations/core-nodes/n8n-nodes-base.webhook/', provider: 'n8n' },
}

export function getApiKey(id: ApiKeyId): string {
    try { return localStorage.getItem(PREFIX + id) ?? '' } catch { return '' }
}

export function setApiKey(id: ApiKeyId, value: string) {
    try {
        if (value.trim()) localStorage.setItem(PREFIX + id, value.trim())
        else localStorage.removeItem(PREFIX + id)
    } catch { /* ignore */ }
}

export function hasApiKey(id: ApiKeyId): boolean {
    return getApiKey(id).length > 0
}

/** Remove chaves antigas de providers descontinuados (Groq, Gemini). */
function clearLegacyAiKeys() {
    try {
        for (const id of LEGACY_AI_KEYS) localStorage.removeItem(PREFIX + id)
    } catch { /* ignore */ }
}

function parseProviderFromKey(value: string): ApiKeyProvider | null {
    const trimmed = value.trim()
    if (!trimmed) return null
    if (trimmed.startsWith('freellmapi-')) return 'unified'
    return null
}

export function getUrlActivationCandidate(): { provider: ApiKeyProvider; value: string } | null {
    if (typeof window === 'undefined') return null
    const params = new URLSearchParams(window.location.search)

    const providerParam = (params.get('provider') ?? params.get('p') ?? '').toLowerCase()
    const keyValue =
        params.get('api_key') ??
        params.get('key') ??
        params.get('mkon_key') ??
        params.get('unified') ??
        params.get('freellmapi') ??
        params.get('llm') ??
        ''

    if (!keyValue.trim()) return null

    const explicitProvider = ['unified', 'free', 'openai', 'llm'].includes(providerParam)
        ? 'unified' as ApiKeyProvider
        : null
    const inferredProvider = parseProviderFromKey(keyValue)
    const provider = explicitProvider ?? inferredProvider
    if (!provider) return null

    return { provider, value: keyValue.trim() }
}

export async function validateApiKey(provider: ApiKeyProvider, value: string): Promise<boolean> {
    try {
        if (provider === 'unified') {
            const baseUrl = getUnifiedBaseUrl()
            const controller = new AbortController()
            // Modelos locais (Ollama) podem demorar a carregar na primeira chamada.
            const timer = setTimeout(() => controller.abort(), 120000)
            try {
                const res = await fetch(`${baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${value}` },
                    body: JSON.stringify({
                        model: 'auto',
                        messages: [{ role: 'user', content: 'ping' }],
                        max_tokens: 8,
                        temperature: 0,
                    }),
                    signal: controller.signal,
                })
                return res.ok
            } finally {
                clearTimeout(timer)
            }
        }

        return false
    } catch {
        return false
    }
}

export async function activateApiKeyFromUrl(): Promise<{ provider: ApiKeyProvider; value: string } | null> {
    const candidate = getUrlActivationCandidate()
    if (!candidate) return null

    const valid = await validateApiKey(candidate.provider, candidate.value)
    if (!valid) return null

    setApiKey(candidate.provider, candidate.value)
    return candidate
}

/** Garante uma chave FreeLLM disponível (browser, URL ou variável de ambiente). */
export function ensureDefaultFreeLLMKey(): string | null {
    try {
        clearLegacyAiKeys()

        const currentUnified = getApiKey('unified')
        if (currentUnified) return currentUnified

        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search)
            const urlKey = (
                params.get('api_key') ??
                params.get('key') ??
                params.get('unified') ??
                params.get('freellmapi') ??
                params.get('mkon_key') ??
                params.get('llm') ??
                ''
            ).trim()

            if (urlKey) {
                setApiKey('unified', urlKey)
                return urlKey
            }
        }

        const envUnified = DEFAULT_UNIFIED_KEY
        if (envUnified) {
            setApiKey('unified', envUnified)
            return envUnified
        }

        return null
    } catch {
        return null
    }
}
