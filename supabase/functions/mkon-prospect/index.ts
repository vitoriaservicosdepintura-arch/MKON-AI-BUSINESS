// MKON Prospect — pesquisa de empresas no Google Maps por região e identificação
// de oportunidades (empresas SEM website). Só o proprietário pode usar.
//
// Segredos necessários (Supabase → Edge Functions → Secrets):
//   GOOGLE_PLACES_API_KEY  → chave da Google Places API (New)
// Opcional (para o resumo do agente): LLM_BASE_URL, LLM_API_KEY, LLM_MODEL
//
// Deploy: supabase functions deploy mkon-prospect

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText'
const FIELD_MASK = [
    'places.id', 'places.displayName', 'places.formattedAddress', 'places.nationalPhoneNumber',
    'places.websiteUri', 'places.rating', 'places.userRatingCount', 'places.primaryTypeDisplayName',
    'places.googleMapsUri',
].join(',')

type Place = {
    id: string
    displayName?: { text?: string }
    formattedAddress?: string
    nationalPhoneNumber?: string
    websiteUri?: string
    rating?: number
    userRatingCount?: number
    primaryTypeDisplayName?: { text?: string }
    googleMapsUri?: string
}

/** Pontuação determinística: quanto maior, melhor oportunidade para vender um website. */
function scorePlace(p: Place): { score: number; reasons: string[] } {
    let score = 50
    const reasons: string[] = []
    if (!p.websiteUri) { score += 25; reasons.push('sem website') }
    if (p.nationalPhoneNumber) { score += 10; reasons.push('tem telefone') }
    if ((p.rating ?? 0) >= 4 && (p.userRatingCount ?? 0) >= 20) { score += 10; reasons.push(`boas avaliações (${p.rating}★, ${p.userRatingCount})`) }
    if ((p.userRatingCount ?? 0) >= 50) { score += 5; reasons.push('negócio ativo') }
    return { score: Math.min(100, score), reasons }
}

function opportunityFor(score: number): 'excelente' | 'elevada' | 'moderada' | 'baixa' {
    if (score >= 85) return 'excelente'
    if (score >= 75) return 'elevada'
    if (score >= 60) return 'moderada'
    return 'baixa'
}

async function searchPlaces(query: string, apiKey: string): Promise<Place[]> {
    const res = await fetch(PLACES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELD_MASK },
        body: JSON.stringify({ textQuery: query, languageCode: 'pt-PT', regionCode: 'PT', maxResultCount: 20 }),
    })
    if (!res.ok) {
        const detail = await res.text().catch(() => '')
        throw new Error(`Google Places devolveu erro ${res.status}. ${detail.slice(0, 160)}`)
    }
    const data = await res.json()
    return (data.places ?? []) as Place[]
}

async function ensureSource(sb: SupabaseClient): Promise<string> {
    const { data } = await sb.from('lead_sources').select('id').eq('code', 'google_places').maybeSingle()
    if (data) return data.id
    const { data: created, error } = await sb.from('lead_sources').insert({ code: 'google_places', name: 'Google Places API', is_automatic: true }).select('id').single()
    if (error) throw new Error(error.message)
    return created.id
}

/** Resumo curto das melhores oportunidades, escrito por um agente (se o LLM estiver configurado). */
async function agentSummary(top: { name: string; city: string | null; score: number; reasons: string[] }[]): Promise<string | null> {
    const base = (Deno.env.get('LLM_BASE_URL') ?? '').replace(/\/+$/, '')
    const key = Deno.env.get('LLM_API_KEY') ?? ''
    if (!base || !key || top.length === 0) return null
    const list = top.map((t) => `- ${t.name} (${t.city ?? 'sem cidade'}): ${t.reasons.join(', ')}`).join('\n')
    try {
        const res = await fetch(`${base}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
            body: JSON.stringify({
                model: Deno.env.get('LLM_MODEL') ?? 'auto',
                temperature: 0.3,
                max_tokens: 300,
                messages: [
                    { role: 'system', content: 'Você é o Analista do MKON AI Business, agência de websites em Portugal. Responda em Português de Portugal, em no máximo 3 frases, destacando por que estas empresas são boas oportunidades para vender um website.' },
                    { role: 'user', content: `Melhores oportunidades encontradas:\n${list}` },
                ],
            }),
        })
        if (!res.ok) return null
        const data = await res.json()
        return String(data?.choices?.[0]?.message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim() || null
    } catch {
        return null
    }
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
    if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Sessão em falta.' }, 401)

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
    })
    const { data: owner } = await sb.from('administrators').select('id').eq('role', 'owner').limit(1)
    if (!owner || owner.length === 0) return json({ error: 'Acesso reservado ao proprietário.' }, 403)

    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY')
    if (!apiKey) return json({ error: 'GOOGLE_PLACES_API_KEY não configurada nos segredos do Supabase.' }, 500)

    let body: { query?: string }
    try { body = await req.json() } catch { return json({ error: 'Pedido inválido.' }, 400) }
    const query = String(body.query ?? '').trim().slice(0, 200)
    if (!query) return json({ error: 'Indique uma região e um tipo de negócio, por exemplo "canalizadores em Braga".' }, 400)

    let places: Place[]
    try {
        places = await searchPlaces(query, apiKey)
    } catch (e) {
        return json({ error: e instanceof Error ? e.message : 'Falha na pesquisa Google.' }, 502)
    }

    const sourceId = await ensureSource(sb)
    const withoutSite = places.filter((p) => !p.websiteUri)
    let created = 0
    let existing = 0
    const scored: { name: string; city: string | null; score: number; reasons: string[] }[] = []

    for (const p of withoutSite) {
        const name = p.displayName?.text ?? 'Sem nome'
        const city = p.formattedAddress ? p.formattedAddress.split(',').slice(-2, -1)[0]?.trim() ?? null : null
        const { score, reasons } = scorePlace(p)

        const { data: found } = await sb.from('companies').select('id').eq('source_id', sourceId).eq('external_id', p.id).maybeSingle()
        let companyId = found?.id as string | undefined
        if (!companyId) {
            const { data: comp, error } = await sb.from('companies').insert({
                name, category: p.primaryTypeDisplayName?.text ?? query, city, region: null,
                phone: p.nationalPhoneNumber ?? null, website: null, source_id: sourceId, external_id: p.id,
                commercial_profile: `Google Maps: ${p.formattedAddress ?? ''}. ${p.googleMapsUri ?? ''}`.trim(),
            }).select('id').single()
            if (error) continue
            companyId = comp.id
            created++
        } else {
            existing++
        }

        const { data: lead } = await sb.from('leads').select('id').eq('company_id', companyId!).limit(1).maybeSingle()
        if (!lead) {
            await sb.from('leads').insert({
                company_id: companyId, stage: 'analisado', score,
                opportunity: opportunityFor(score),
                next_action: 'Contactar para proposta de website',
                owner_notes: `Pontuação ${score}: ${reasons.join(', ')}.`,
            })
        }
        scored.push({ name, city, score, reasons })
    }

    scored.sort((a, b) => b.score - a.score)
    const top = scored.filter((s) => s.score >= 75).slice(0, 5)

    if (top.length > 0) {
        const summary = await agentSummary(top)
        const lines = top.map((t) => `${t.name} · ${t.score} · ${t.city ?? ''}`).join('\n')
        await sb.from('notifications').insert({
            level: 'sucesso',
            title: `${top.length} oportunidades para website: ${query}`,
            body: [summary, lines].filter(Boolean).join('\n\n'),
            link: '/prospeccao',
        })
    }

    return json({
        query,
        encontradas: places.length,
        sem_website: withoutSite.length,
        novas_empresas: created,
        ja_existiam: existing,
        melhores: top,
    })
})

function json(payload: unknown, status = 200) {
    return new Response(JSON.stringify(payload), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}
