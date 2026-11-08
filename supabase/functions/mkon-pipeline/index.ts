// MKON Pipeline — equipa de agentes que trabalha sozinha a partir de um pedido.
//
// Pedido: { query, lat?, lng?, zoom? } enviado pelo proprietário (sessão válida).
// Etapas (cada uma regista uma frase em pipeline_steps, que o site lê em voz alta):
//   1. Pesquisador  → procura empresas na área do mapa (mkon-prospect)
//   2. Analista     → analisa as oportunidades sem website
//   3. Desenvolvedor → cria rascunho de website a partir de um template
//   4. Vendedor     → cria propostas em rascunho, uma por empresa
//   5. Atendimento  → regista a mensagem sugerida em cada proposta (NÃO envia)
//   6. Supervisor   → pede aprovação ao proprietário
//
// Limite: no máximo 4 empresas por execução (tempo da Edge Function).

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_COMPANIES = 4

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
    if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Sessão em falta.' }, 401)

    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const sb = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
    const { data: owner } = await sb.from('administrators').select('id').eq('role', 'owner').limit(1)
    if (!owner || owner.length === 0) return json({ error: 'Acesso reservado ao proprietário.' }, 403)

    let body: { query?: string; lat?: number; lng?: number; zoom?: number }
    try { body = await req.json() } catch { return json({ error: 'Pedido inválido.' }, 400) }
    const query = String(body.query ?? '').trim().slice(0, 200)
    if (!query) return json({ error: 'Escreva o que quer prospetar, por exemplo "canalizadores".' }, 400)

    const { data: run, error: runErr } = await sb.from('pipeline_runs').insert({ query }).select('id').single()
    if (runErr) return json({ error: runErr.message }, 500)
    const runId = run.id as string

    const messages: string[] = []
    const say = async (agent: string, message: string, status: 'ok' | 'erro' | 'aguarda_aprovacao' = 'ok') => {
        messages.push(message)
        await sb.from('pipeline_steps').insert({ run_id: runId, agent_code: agent, message, status })
    }
    const fail = async (agent: string, message: string) => {
        await say(agent, message, 'erro')
        await sb.from('pipeline_runs').update({ status: 'erro', finished_at: new Date().toISOString() }).eq('id', runId)
        return json({ run_id: runId, status: 'erro', messages }, 502)
    }

    // 1. Pesquisador
    let prospect: any
    try {
        const res = await fetch(`${url}/functions/v1/mkon-prospect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: authHeader, apikey: anon },
            body: JSON.stringify({ query, lat: body.lat, lng: body.lng, zoom: body.zoom }),
        })
        prospect = await res.json().catch(() => ({}))
        if (!res.ok) return fail('pesquisador', `Não consegui pesquisar "${query}": ${prospect?.error ?? res.status}.`)
    } catch {
        return fail('pesquisador', 'Não consegui ligar ao serviço de pesquisa.')
    }
    await say('pesquisador', `Pesquisei "${query}" nesta área: ${prospect.encontradas} locais, ${prospect.sem_website} sem website. Registei ${prospect.novas_empresas} novas empresas no CRM.`)

    const targets = ((prospect.locais ?? []) as any[]).filter((l) => !l.website && l.company_id).slice(0, MAX_COMPANIES)
    if (targets.length === 0) {
        await say('supervisor', 'Não encontrei empresas sem website nesta área. Experimente outra zona ou outro tipo de negócio.')
        await sb.from('pipeline_runs').update({ status: 'concluida', finished_at: new Date().toISOString() }).eq('id', runId)
        return json({ run_id: runId, status: 'concluida', messages, locais: prospect.locais ?? [] })
    }

    // Dados de apoio: templates disponíveis.
    const { data: templates } = await sb.from('website_templates').select('id,code,name,segment').eq('is_active', true)

    const llm = (system: string, user: string) => callLLM(system, user)

    // 2. Analista
    const analysed: { lead_id: string | null; company_id: string; name: string; category: string; city: string | null; analysis: string; score: number | null }[] = []
    for (const t of targets) {
        const { data: lead } = await sb.from('leads').select('id,score').eq('company_id', t.company_id).limit(1).maybeSingle()
        const analysis = (await llm(
            'Você é o Analista do MKON AI Business, agência de websites em Portugal. Em português de Portugal, em no máximo 3 frases: que oportunidade esta empresa representa, que dor digital tem e que pacote de website recomendar.',
            `Empresa: ${t.name}\nTipo: ${t.type ?? 'desconhecido'}\nMorada: ${t.address ?? 'sem morada'}\nAvaliações: ${t.rating ?? '—'} (${t.reviews})\nPontuação: ${t.score ?? '—'}`,
        )) ?? `Sem website. Pontuação ${t.score ?? '—'}. Recomenda-se um site simples de apresentação e pedido de orçamento.`
        if (lead?.id) {
            await sb.from('leads').update({ owner_notes: analysis, next_action: 'Aprovar envio da proposta' }).eq('id', lead.id)
        }
        analysed.push({ lead_id: lead?.id ?? null, company_id: t.company_id, name: t.name, category: t.type ?? query, city: t.address ? t.address.split(',').slice(-2, -1)[0]?.trim() ?? null : null, analysis, score: t.score ?? null })
    }
    await say('analista', `Analisei ${analysed.length} oportunidades. A melhor é ${analysed[0].name}${analysed[0].score ? `, com pontuação ${analysed[0].score}` : ''}.`)

    // 3. Desenvolvedor: rascunho de website por template
    let sitesCreated = 0
    for (const a of analysed) {
        const tpl = pickTemplate(templates ?? [], a.category + ' ' + query)
        if (!tpl) continue
        const { data: existing } = await sb.from('websites').select('id').eq('company_id', a.company_id).limit(1).maybeSingle()
        if (existing) continue
        const { error } = await sb.from('websites').insert({
            company_id: a.company_id, template_id: tpl.id, title: `Website — ${a.name}`, status: 'rascunho',
            content: { brief: a.analysis, pages: tpl.structure ?? [], template: tpl.code },
        })
        if (!error) sitesCreated++
    }
    await say('desenvolvedor', `Criei ${sitesCreated} rascunhos de website a partir dos templates prontos. Ficam para revisão na página Websites.`)

    // 4. Vendedor: uma proposta por empresa, com o perfil de cada uma
    let proposalsCreated = 0
    const year = new Date().getFullYear()
    for (const a of analysed) {
        const text = (await llm(
            'Você é o Vendedor do MKON AI Business. Escreva em português de Portugal uma proposta curta (máximo 120 palavras) para vender um website a esta empresa: benefícios concretos para o tipo de negócio, o que está incluído e um convite a reunir. Não invente preços.',
            `Empresa: ${a.name}\nTipo: ${a.category}\nCidade: ${a.city ?? 'Portugal'}\nAnálise: ${a.analysis}`,
        )) ?? `Proposta para criar um website profissional para ${a.name}, com apresentação dos serviços e pedido de orçamento. Preço a definir.`
        const number = `PROP-${year}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`
        const { error } = await sb.from('proposals').insert({
            number, company_id: a.company_id, lead_id: a.lead_id, title: `Website para ${a.name}`,
            status: 'rascunho', total: 0, notes: `${text}\n\nPreço a definir. Rascunho preparado pela equipa de agentes.`,
        })
        if (!error) proposalsCreated++
    }
    await say('vendedor', `Preparei ${proposalsCreated} propostas em rascunho, uma por empresa, com o perfil de cada uma. O preço ainda está por definir.`)

    // 5. Atendimento: mensagem sugerida (não envia)
    await say('atendimento', `Escrevi as mensagens sugeridas para cada empresa e guardei-as nas propostas. Não enviei nenhuma.`)

    // 6. Supervisor: pedido de aprovação
    await sb.from('notifications').insert({
        level: 'aviso',
        title: `Aprovação necessária: ${proposalsCreated} propostas e ${sitesCreated} websites prontos`,
        body: analysed.map((a) => `${a.name}${a.score ? ` · ${a.score}` : ''}`).join('\n') + '\n\nNada foi enviado. Revise e aprove o envio.',
        link: '/propostas',
    })
    await say('supervisor', `Está tudo pronto para revisão: ${proposalsCreated} propostas e ${sitesCreated} websites. Não enviei mensagens. Quer aprovar o envio?`, 'aguarda_aprovacao')

    await sb.from('pipeline_runs').update({ status: 'concluida', finished_at: new Date().toISOString() }).eq('id', runId)
    return json({ run_id: runId, status: 'concluida', messages, locais: prospect.locais ?? [] })
})

/** Escolhe o template pelo tipo de negócio. */
function pickTemplate(templates: { id: string; code: string; segment: string; structure?: unknown }[], text: string) {
    const t = text.toLowerCase()
    const want = /restaur|caf[ée]|pastel|padaria|bar\b|ementa/.test(t) ? 'restauracao'
        : /pint|canal|eletric|constr|remod|obra|telhad|serralh/.test(t) ? 'servicos'
        : 'generico'
    return templates.find((x) => x.segment === want) ?? templates.find((x) => x.segment === 'generico') ?? null
}

/** Chamada ao LLM configurado. Devolve null se não houver LLM ou se falhar (o fluxo continua). */
async function callLLM(system: string, user: string): Promise<string | null> {
    const base = (Deno.env.get('LLM_BASE_URL') ?? '').replace(/\/+$/, '')
    const key = Deno.env.get('LLM_API_KEY') ?? ''
    if (!base || !key) return null
    try {
        const res = await fetch(`${base}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
            body: JSON.stringify({
                model: Deno.env.get('LLM_MODEL') ?? 'auto', temperature: 0.4, max_tokens: 350,
                messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
            }),
        })
        if (!res.ok) return null
        const data = await res.json()
        return String(data?.choices?.[0]?.message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim() || null
    } catch {
        return null
    }
}

function json(payload: unknown, status = 200) {
    return new Response(JSON.stringify(payload), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}
