/**
 * API Keys — armazenamento local seguro (apenas no browser do proprietário).
 * As chaves NUNCA são enviadas para o Supabase.
 */

const PREFIX = 'mkon_apikey_'

export type ApiKeyId = 'freellm' | 'groq' | 'gemini' | 'openai' | 'google_places' | 'whatsapp' | 'n8n'
export type ApiKeyProvider = 'groq' | 'gemini'

export const API_KEY_META: Record<ApiKeyId, { label: string; placeholder: string; url: string; provider: string }> = {
    freellm: { label: 'FreeLLMAPI — chave unificada', placeholder: 'freellmapi-...', url: 'https://github.com/tashfeenahmed/freellmapi', provider: 'freellmapi' },
    groq: { label: 'Groq API Key', placeholder: 'gsk_...', url: 'https://console.groq.com/keys', provider: 'groq' },
    gemini: { label: 'Google Gemini API Key', placeholder: 'AIza...', url: 'https://aistudio.google.com/app/apikey', provider: 'google_studio' },
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

const LLM_URL_KEY = 'mkon_llm_base_url'
export const DEFAULT_LLM_BASE_URL = 'http://localhost:3001/v1'

/** Normaliza para algo como https://host:porta/v1 (sem barra final). */
export function normalizeLlmBaseUrl(raw: string): string {
    let u = raw.trim().replace(/\/+$/, '')
    if (!u) return DEFAULT_LLM_BASE_URL
    if (!/^https?:\/\//i.test(u)) u = `http://${u}`
    u = u.replace(/\/chat\/completions$/, '')
    if (!/\/v1$/.test(u)) u += '/v1'
    return u
}

export function getLlmBaseUrl(): string {
    try { return normalizeLlmBaseUrl(localStorage.getItem(LLM_URL_KEY) ?? '') } catch { return DEFAULT_LLM_BASE_URL }
}

export function setLlmBaseUrl(value: string) {
    try {
        if (value.trim()) localStorage.setItem(LLM_URL_KEY, normalizeLlmBaseUrl(value))
        else localStorage.removeItem(LLM_URL_KEY)
    } catch { /* ignore */ }
}

export function hasApiKey(id: ApiKeyId): boolean {
    return getApiKey(id).length > 0
}

function parseProviderFromKey(value: string): ApiKeyProvider | null {
    const trimmed = value.trim()
    if (!trimmed) return null
    if (trimmed.startsWith('gsk_')) return 'groq'
    if (trimmed.startsWith('AIza')) return 'gemini'
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
        params.get('groq') ??
        params.get('gemini') ??
        params.get('google') ??
        ''

    if (!keyValue.trim()) return null

    const explicitProvider = providerParam === 'groq' || providerParam === 'gemini' ? providerParam : null
    const inferredProvider = parseProviderFromKey(keyValue)
    const provider = explicitProvider ?? inferredProvider
    if (!provider) return null

    return { provider, value: keyValue.trim() }
}

export async function validateApiKey(provider: ApiKeyProvider, value: string): Promise<boolean> {
    try {
        if (provider === 'groq') {
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${value}` },
                body: JSON.stringify({
                    model: 'openai/gpt-oss-20b',
                    messages: [{ role: 'user', content: 'ping' }],
                    max_tokens: 8,
                    temperature: 0,
                }),
            })
            if (!res.ok) return false
            return true
        }

        if (provider === 'gemini') {
            const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${value}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
                        generationConfig: { maxOutputTokens: 8, temperature: 0 },
                    }),
                }
            )
            return res.ok
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
