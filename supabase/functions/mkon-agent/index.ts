// MKON Agent — agente no servidor (Supabase Edge Function).
//
// - Só o proprietário autenticado pode usar (verificado com o próprio JWT + RLS).
// - Lê o sistema através de ferramentas (tabelas permitidas) e pode criar tarefas de IA.
// - Usa qualquer endpoint compatível com OpenAI (FreeLLMAPI público, Groq, OpenAI…).
//   Segredos definidos com: supabase secrets set LLM_BASE_URL=... LLM_API_KEY=... LLM_MODEL=...
//
// Deploy: supabase functions deploy mkon-agent

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** Tabelas que o agente pode ler e as colunas que pode usar como filtro (sem segredos). */
const READABLE: Record<string, { filters: string[]; select: string }> = {
    companies: { filters: ['category', 'city', 'has_website'], select: 'id,name,category,city,region,phone,email,website,has_website,commercial_profile,created_at' },
    leads: { filters: ['stage', 'opportunity'], select: 'id,company_id,stage,score,opportunity,estimated_value,next_action,next_action_at,lost_reason,created_at' },
    proposals: { filters: ['status', 'company_id', 'lead_id'], select: 'id,number,company_id,lead_id,title,status,total,delivery_days,valid_until,sent_at,decided_at,notes,created_at' },
    proposal_items: { filters: ['proposal_id'], select: '*' },
    projects: { filters: ['stage'], select: 'id,code,title,stage,value,starts_on,due_on,delivered_on,notes' },
    websites: { filters: ['status', 'company_id'], select: 'id,company_id,title,status,preview_url,published_url,approved_at' },
    ai_agents: { filters: ['status', 'code'], select: 'id,code,name,description,status,model,last_error' },
    ai_tasks: { filters: ['status', 'agent_id', 'lead_id'], select: 'id,agent_id,lead_id,title,status,error_message,created_at,finished_at' },
}

const TOOLS = [
    {
        type: 'function',
        function: {
            name: 'get_system_overview',
            description: 'Contagens reais do sistema: empresas, leads, propostas, projetos, websites, agentes ativos e tarefas de IA.',
            parameters: { type: 'object', properties: {}, additionalProperties: false },
        },
    },
    {
        type: 'function',
        function: {
            name: 'query_table',
            description: 'Lê linhas de uma tabela do sistema. Tabelas: ' + Object.keys(READABLE).join(', ') + '. Máximo 50 linhas.',
            parameters: {
                type: 'object',
                properties: {
                    table: { type: 'string', enum: Object.keys(READABLE) },
                    filter_column: { type: 'string', description: 'Coluna para filtrar (opcional). Ex.: stage, status, category, company_id.' },
                    filter_value: { type: 'string', description: 'Valor exato do filtro.' },
                    limit: { type: 'integer', minimum: 1, maximum: 50 },
                },
                required: ['table'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'create_proposal',
            description: 'Cria uma proposta comercial em RASCUNHO para uma empresa, com itens. Não envia nada ao cliente. Use para propostas de websites, NFC, SEO, etc.',
            parameters: {
                type: 'object',
                properties: {
                    company_id: { type: 'string', description: 'UUID da empresa (obtenha com query_table em companies)' },
                    lead_id: { type: 'string', description: 'UUID do lead (opcional)' },
                    title: { type: 'string' },
                    items: {
                        type: 'array',
                        minItems: 1,
                        items: {
                            type: 'object',
                            properties: {
                                description: { type: 'string' },
                                quantity: { type: 'number', minimum: 0.01 },
                                unit_price: { type: 'number', minimum: 0 },
                            },
                            required: ['description', 'unit_price'],
                            additionalProperties: false,
                        },
                    },
                    delivery_days: { type: 'integer', minimum: 1 },
                    notes: { type: 'string' },
                },
                required: ['company_id', 'title', 'items'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'draft_message',
            description: 'Prepara uma mensagem de contacto para uma empresa, ficando AGUARDA_APROVACAO. Nunca é enviada automaticamente; o proprietário aprova.',
            parameters: {
                type: 'object',
                properties: {
                    company_id: { type: 'string' },
                    channel: { type: 'string', enum: ['email', 'whatsapp', 'formulario', 'telefone', 'outro'] },
                    body: { type: 'string', description: 'Texto completo da mensagem em Português de Portugal' },
                },
                required: ['company_id', 'channel', 'body'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'update_lead_next_action',
            description: 'Define o próximo passo de um lead e a data em que deve ser feito.',
            parameters: {
                type: 'object',
                properties: {
                    lead_id: { type: 'string' },
                    next_action: { type: 'string' },
                    next_action_at: { type: 'string', description: 'Data/hora ISO 8601 (opcional)' },
                },
                required: ['lead_id', 'next_action'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'create_ai_task',
            description: 'Cria uma tarefa para um agente de IA existente (fica pendente). Usar quando o proprietário pedir para criar/agendar trabalho.',
            parameters: {
                type: 'object',
                properties: {
                    agent_code: { type: 'string', description: 'Código do agente em ai_agents.code' },
                    title: { type: 'string' },
                    lead_id: { type: 'string', description: 'UUID do lead (opcional)' },
                    input: { type: 'object', description: 'Dados adicionais da tarefa (opcional)' },
                },
                required: ['agent_code', 'title'],
                additionalProperties: false,
            },
        },
    },
]

const SYSTEM_PROMPT = `Você é o MKON Agent, agente de IA do sistema privado MKON AI Business (agência de websites, NFC e serviços digitais em Portugal).
Responda sempre em Português de Portugal, de forma clara e direta, tratando o utilizador por "senhor".
Use as ferramentas para consultar dados reais antes de afirmar qualquer número ou estado. Nunca invente dados: se uma ferramenta não devolver nada, diga-o.
Módulos: Dashboard, CRM (empresas, leads), Prospeção, Agentes IA, Mensagens, Websites, Propostas, NFC, Projetos, Financeiro, Relatórios, Administração.
Ao analisar propostas, avalie valor, prazo, itens, estado e próximos passos. Ao criar tarefas, confirme o que foi criado.`

async function runTool(name: string, args: Record<string, unknown>, sb: SupabaseClient): Promise<unknown> {
    if (name === 'get_system_overview') {
        const count = async (t: string, q?: (x: any) => any) => {
            let query = sb.from(t).select('id', { count: 'exact', head: true })
            if (q) query = q(query)
            const { count } = await query
            return count ?? 0
        }
        const [companies, leads, proposals, projects, websites, agentsActive, tasksPending] = await Promise.all([
            count('companies'),
            count('leads'),
            count('proposals'),
            count('projects'),
            count('websites'),
            count('ai_agents', (q) => q.eq('status', 'ativo')),
            count('ai_tasks', (q) => q.eq('status', 'pendente')),
        ])
        return { companies, leads, proposals, projects, websites, agentes_ativos: agentsActive, tarefas_pendentes: tasksPending }
    }

    if (name === 'query_table') {
        const table = String(args.table ?? '')
        const cfg = READABLE[table]
        if (!cfg) return { error: 'Tabela não permitida.' }
        const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 50)
        let q = sb.from(table).select(cfg.select).limit(limit)
        if (args.filter_column) {
            const col = String(args.filter_column)
            if (!cfg.filters.includes(col)) return { error: `Filtro não permitido na tabela ${table}: ${col}. Use: ${cfg.filters.join(', ')}` }
            q = q.eq(col, String(args.filter_value ?? ''))
        }
        const { data, error } = await q
        if (error) return { error: error.message }
        return { rows: data, count: data?.length ?? 0 }
    }

    if (name === 'create_proposal') {
        const items = Array.isArray(args.items) ? args.items as any[] : []
        if (items.length === 0) return { error: 'A proposta precisa de pelo menos um item.' }
        const number = 'PR-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase()
        const { data: prop, error } = await sb.from('proposals').insert({
            number,
            company_id: String(args.company_id ?? ''),
            lead_id: args.lead_id ?? null,
            title: String(args.title ?? '').slice(0, 200),
            status: 'rascunho',
            delivery_days: args.delivery_days ?? null,
            notes: args.notes ?? null,
        }).select('id,number,title,status,total').single()
        if (error) return { error: error.message }
        const rows = items.map((it, i) => ({
            proposal_id: prop.id,
            description: String(it.description ?? '').slice(0, 300),
            quantity: Number(it.quantity) || 1,
            unit_price: Number(it.unit_price) || 0,
            position: i,
        }))
        const { error: itemsErr } = await sb.from('proposal_items').insert(rows)
        if (itemsErr) return { error: itemsErr.message, proposal: prop }
        const { data: fresh } = await sb.from('proposals').select('id,number,title,status,total').eq('id', prop.id).single()
        return { created: fresh ?? prop, note: 'Rascunho criado. Não foi enviado ao cliente.' }
    }

    if (name === 'draft_message') {
        const channel = String(args.channel ?? 'email')
        const companyId = String(args.company_id ?? '')
        // Reutiliza a conversa existente desse canal ou cria uma nova
        let { data: conv } = await sb.from('conversations').select('id').eq('company_id', companyId).eq('channel', channel).limit(1).maybeSingle()
        if (!conv) {
            const { data: created, error: convErr } = await sb.from('conversations').insert({ company_id: companyId, channel, subject: 'Prospeção' }).select('id').single()
            if (convErr) return { error: convErr.message }
            conv = created
        }
        const { data: agent } = await sb.from('ai_agents').select('id').eq('code', 'vendedor').maybeSingle()
        const { data: msg, error } = await sb.from('messages').insert({
            conversation_id: conv!.id,
            direction: 'saida',
            status: 'aguarda_aprovacao',
            body: String(args.body ?? ''),
            prepared_by_agent: agent?.id ?? null,
        }).select('id,status').single()
        if (error) return { error: error.message }
        return { draft: msg, note: 'Mensagem preparada e à espera de aprovação. Não foi enviada.' }
    }

    if (name === 'update_lead_next_action') {
        const { data, error } = await sb.from('leads').update({
            next_action: String(args.next_action ?? '').slice(0, 300),
            next_action_at: args.next_action_at ?? null,
        }).eq('id', String(args.lead_id ?? '')).select('id,next_action,next_action_at').single()
        if (error) return { error: error.message }
        return { updated: data }
    }

    if (name === 'create_ai_task') {
        const { data: agent, error: agentErr } = await sb.from('ai_agents').select('id,code').eq('code', String(args.agent_code ?? '')).maybeSingle()
        if (agentErr) return { error: agentErr.message }
        if (!agent) return { error: 'Agente não encontrado. Consulte ai_agents para ver os códigos válidos.' }
        const { data, error } = await sb.from('ai_tasks').insert({
            agent_id: agent.id,
            lead_id: args.lead_id ?? null,
            title: String(args.title ?? '').slice(0, 200),
            input: (args.input as object) ?? {},
            status: 'pendente',
        }).select('id,title,status').single()
        if (error) return { error: error.message }
        return { created: data }
    }

    return { error: `Ferramenta desconhecida: ${name}` }
}

type ChatMessage = { role: string; content: string | null; tool_calls?: any[]; tool_call_id?: string; name?: string }

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
    if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Sessão em falta. Inicie sessão novamente.' }, 401)

    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    // Cliente com o JWT do utilizador: as regras RLS aplicam-se a tudo o que o agente lê ou escreve.
    const sb = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })

    const { data: owner } = await sb.from('administrators').select('id').eq('role', 'owner').limit(1)
    if (!owner || owner.length === 0) return json({ error: 'Acesso reservado ao proprietário.' }, 403)

    const llmBase = (Deno.env.get('LLM_BASE_URL') ?? '').replace(/\/+$/, '')
    const llmKey = Deno.env.get('LLM_API_KEY') ?? ''
    const llmModel = Deno.env.get('LLM_MODEL') ?? 'auto'
    if (!llmBase || !llmKey) return json({ error: 'LLM_BASE_URL ou LLM_API_KEY não configurados nos segredos do Supabase.' }, 500)

    let body: { messages?: { role: 'user' | 'assistant'; content: string }[]; agent_code?: string }
    try { body = await req.json() } catch { return json({ error: 'Pedido inválido.' }, 400) }
    const history = (body.messages ?? []).filter((m) => m && typeof m.content === 'string').slice(-30)
    if (history.length === 0) return json({ error: 'Mensagem vazia.' }, 400)

    // Agente escolhido na página Agentes: usa o seu nome, descrição e regras.
    let systemPrompt = SYSTEM_PROMPT
    const agentCode = (body as any).agent_code as string | undefined
    if (agentCode) {
        const { data: agent } = await sb.from('ai_agents').select('name,description,system_prompt').eq('code', agentCode).maybeSingle()
        if (agent) {
            systemPrompt = [
                `Você é o agente "${agent.name}" no sistema MKON AI Business (agência de serviços digitais em Portugal).`,
                agent.description,
                agent.system_prompt ? `Regras: ${agent.system_prompt}` : '',
                SYSTEM_PROMPT,
            ].filter(Boolean).join('\n')
        }
    }

    const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }, ...history]
    const toolsUsed: string[] = []

    for (let step = 0; step < 6; step++) {
        let res: Response
        try {
            res = await fetch(`${llmBase}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${llmKey}` },
                body: JSON.stringify({ model: llmModel, messages, tools: TOOLS, temperature: 0.3, max_tokens: 2048 }),
            })
        } catch {
            return json({ error: 'Não foi possível ligar ao fornecedor de IA a partir do servidor. Verifique LLM_BASE_URL (tem de ser um endereço público, não localhost).' }, 502)
        }
        if (!res.ok) {
            const detail = await res.text().catch(() => '')
            return json({ error: `Fornecedor de IA devolveu erro ${res.status}.`, detail: detail.slice(0, 300) }, 502)
        }

        const data = await res.json()
        const msg = data?.choices?.[0]?.message
        if (!msg) return json({ error: 'Resposta vazia do fornecedor de IA.' }, 502)

        const calls = msg.tool_calls ?? []
        if (calls.length === 0) {
            const reply = String(msg.content ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
            return json({ reply: reply || 'Sem resposta.', tools_used: toolsUsed })
        }

        messages.push({ role: 'assistant', content: msg.content ?? null, tool_calls: calls })
        for (const call of calls) {
            let args: Record<string, unknown> = {}
            try { args = JSON.parse(call.function?.arguments || '{}') } catch { /* argumentos inválidos */ }
            toolsUsed.push(call.function?.name ?? 'desconhecida')
            const result = await runTool(call.function?.name ?? '', args, sb).catch((e) => ({ error: String(e) }))
            messages.push({ role: 'tool', tool_call_id: call.id, name: call.function?.name, content: JSON.stringify(result) })
        }
    }

    return json({ reply: 'Não consegui concluir o pedido dentro do limite de passos. Tente dividi-lo em partes mais pequenas.', tools_used: toolsUsed })
})

function json(payload: unknown, status = 200) {
    return new Response(JSON.stringify(payload), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}
