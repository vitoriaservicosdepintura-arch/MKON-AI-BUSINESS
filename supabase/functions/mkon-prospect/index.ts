// MKON Prospect — pesquisa de empresas no Google Maps por região e identificação
// de oportunidades (empresas SEM website). Só o proprietário pode usar.
//
// Fornecedor de dados (por ordem):
//   SERPAPI_API_KEY        → SerpAPI (engine google_maps), recomendado
//   GOOGLE_PLACES_API_KEY  → Google Places API (New), exige faturação ativa
// Opcional (para o resumo do agente): LLM_BASE_URL, LLM_API_KEY, LLM_MODEL
//
// Pedido: { query, lat?, lng?, zoom? } — lat/lng/zoom vêm do centro do mapa.
// Deploy: supabase functions deploy mkon-prospect

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText'
const PLACES_FIELDS = [
    'places.id', 'places.displayName', 'places.formattedAddress', 'places.nationalPhoneNumber',
    'places.websiteUri', 'places.rating', 'places.userRatingCount', 'places.primaryTypeDisplayName',
    'places.googleMapsUri', 'places.location',
].join(',')

/** Forma interna normalizada, igual para qualquer fornecedor. */
type Place = {
    id: string
    name: string
    address: string | null
    phone: string | null
    website: string | null
    rating: number | null
    reviews: number
    type: string | null
    lat: number | null
    lng: number | null
    mapsUrl: string | null
}

/** Pontuação determinística: quanto maior, melhor oportunidade para vender um website. */
function scorePlace(p: Place): { score: number; reasons: string[] } {
    let score = 50
    const reasons: string[] = []
    if (!p.website) { score += 25; reasons.push('sem website') }
    if (p.phone) { score += 10; reasons.push('tem telefone') }
    if ((p.rating ?? 0) >= 4 && p.reviews >= 20) { score += 10; reasons.push(`boas avaliações (${p.rating}★, ${p.reviews})`) }
    if (p.reviews >= 50) { score += 5; reasons.push('negócio ativo') }
    return { score: Math.min(100, score), reasons }
}

function opportunityFor(score: number): 'excelente' | 'elevada' | 'moderada' | 'baixa' {
    if (score >= 85) return 'excelente'
    if (score >= 75) return 'elevada'
    if (score >= 60) return 'moderada'
    return 'baixa'
}

/** Zoom do Google Maps → raio aproximado em km (para o viés da Places API). */
function radiusForZoom(zoom: number): number {
    return Math.min(50, Math.max(0.5, 40000 / Math.pow(2, zoom)))
}

async function searchSerpApi(query: string, apiKey: string, lat?: number, lng?: number, zoom?: number): Promise<Place[]> {
    const params = new URLSearchParams({ engine: 'google_maps', type: 'search', q: query, hl: 'pt-PT', gl: 'pt', api_key: apiKey })
    if (lat != null && lng != null) params.set('ll', `@${lat},${lng},${zoom ?? 13}z`)
    const res = await fetch(`https://serpapi.com/search.json?${params}`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data.error) throw new Error(`SerpAPI devolveu erro: ${String(data.error ?? res.status).slice(0, 160)}`)
    return ((data.local_results ?? []) as any[]).map((r) => ({
        id: String(r.place_id ?? r.data_id ?? r.title),
        name: String(r.title ?? 'Sem nome'),
        address: r.address ?? null,
        phone: r.phone ?? null,
        website: r.website ?? null,
        rating: typeof r.rating === 'number' ? r.rating : null,
        reviews: Number(r.reviews ?? 0),
        type: r.type ?? null,
        lat: r.gps_coordinates?.latitude ?? null,
        lng: r.gps_coordinates?.longitude ?? null,
        mapsUrl: r.place_id ? `https://www.google.com/maps/place/?q=place_id:${r.place_id}` : null,
    }))
}

async function searchPlaces(query: string, apiKey: string, lat?: number, lng?: number, zoom?: number): Promise<Place[]> {
    const body: Record<string, unknown> = { textQuery: query, languageCode: 'pt-PT', regionCode: 'PT', maxResultCount: 20 }
    if (lat != null && lng != null) {
        body.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: radiusForZoom(zoom ?? 13) * 1000 } }
    }
    const res = await fetch(PLACES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': PLACES_FIELDS },
        body: JSON.stringify(body),
    })
    if (!res.ok) {
        const detail = await res.text().catch(() => '')
        throw new Error(`Google Places devolveu erro ${res.status}. ${detail.slice(0, 160)}`)
    }
    const data = await res.json()
    return ((data.places ?? []) as any[]).map((p) => ({
        id: p.id,
        name: p.displayName?.text ?? 'Sem nome',
        address: p.formattedAddress ?? null,
        phone: p.nationalPhoneNumber ?? null,
        website: p.websiteUri ?? null,
        rating: typeof p.rating === 'number' ? p.rating : null,
        reviews: Number(p.userRatingCount ?? 0),
        type: p.primaryTypeDisplayName?.text ?? null,
        lat: p.location?.latitude ?? null,
        lng: p.location?.longitude ?? null,
        mapsUrl: p.googleMapsUri ?? null,
    }))
}

async function ensureSource(sb: SupabaseClient, code: string, name: string): Promise<string> {
    const { data } = await sb.from('lead_sources').select('id').eq('code', code).maybeSingle()
    if (data) return data.id
    const { data: created, error } = await sb.from('lead_sources').insert({ code, name, is_automatic: true }).select('id').single()
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

    const serpKey = Deno.env.get('SERPAPI_API_KEY')
    const placesKey = Deno.env.get('GOOGLE_PLACES_API_KEY')
    if (!serpKey && !placesKey) return json({ error: 'Configure SERPAPI_API_KEY (ou GOOGLE_PLACES_API_KEY) nos segredos do Supabase.' }, 500)

    let body: { query?: string; lat?: number; lng?: number; zoom?: number }
    try { body = await req.json() } catch { return json({ error: 'Pedido inválido.' }, 400) }
    const query = String(body.query ?? '').trim().slice(0, 200)
    if (!query) return json({ error: 'Indique o tipo de negócio, por exemplo "canalizadores".' }, 400)
    const lat = typeof body.lat === 'number' ? body.lat : undefined
    const lng = typeof body.lng === 'number' ? body.lng : undefined
    const zoom = typeof body.zoom === 'number' ? body.zoom : undefined

    let places: Place[]
    let provider: string
    let sourceCode: string
    try {
        if (serpKey) { places = await searchSerpApi(query, serpKey, lat, lng, zoom); provider = 'SerpAPI'; sourceCode = 'serpapi_maps' }
        else { places = await searchPlaces(query, placesKey!, lat, lng, zoom); provider = 'Google Places'; sourceCode = 'google_places' }
    } catch (e) {
        return json({ error: e instanceof Error ? e.message : 'Falha na pesquisa.' }, 502)
    }

    const sourceId = await ensureSource(sb, sourceCode, provider)
    const withoutSite = places.filter((p) => !p.website)
    let created = 0
    let existing = 0
    const scoredById = new Map<string, { score: number; opportunity: string; companyId: string | null }>()
    const scored: { name: string; city: string | null; score: number; reasons: string[] }[] = []

    for (const p of withoutSite) {
        const city = p.address ? p.address.split(',').slice(-2, -1)[0]?.trim() ?? null : null
        const { score, reasons } = scorePlace(p)

        const { data: found } = await sb.from('companies').select('id').eq('source_id', sourceId).eq('external_id', p.id).maybeSingle()
        let companyId = found?.id as string | undefined
        if (!companyId) {
            const { data: comp, error } = await sb.from('companies').insert({
                name: p.name, category: p.type ?? query, city, region: null,
                phone: p.phone, website: null, source_id: sourceId, external_id: p.id,
                commercial_profile: `Google Maps: ${p.address ?? ''}. ${p.mapsUrl ?? ''}`.trim(),
            }).select('id').single()
            if (error) { scoredById.set(p.id, { score, opportunity: opportunityFor(score), companyId: null }); continue }
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
        scoredById.set(p.id, { score, opportunity: opportunityFor(score), companyId: companyId ?? null })
        scored.push({ name: p.name, city, score, reasons })
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

    // Todos os locais, para o mapa (com e sem website; só os sem website recebem pontuação/empresa).
    const locais = places.map((p) => {
        const s = scoredById.get(p.id)
        return { ...p, score: s?.score ?? null, opportunity: s?.opportunity ?? null, company_id: s?.companyId ?? null }
    })

    return json({
        query,
        provider,
        encontradas: places.length,
        sem_website: withoutSite.length,
        novas_empresas: created,
        ja_existiam: existing,
        melhores: top,
        locais,
    })
})

function json(payload: unknown, status = 200) {
    return new Response(JSON.stringify(payload), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}
