// MKON Auto — executa automaticamente os agentes ligados (auto_enabled).
//
// Chamada por um agendador externo (a cada 30 minutos) com o cabeçalho x-cron-secret
// igual ao segredo CRON_SECRET desta função, ou pelo proprietário (botão Executar agora).
// Respeita: botão de emergência (automation_kill_switch), estado ativo do agente,
// limite diário de tarefas e intervalo mínimo entre execuções.
//
// Limitação atual: o agente produz análises e planos (ai_tasks). Não envia mensagens
// nem cria propostas por si; isso exige integração de canal e ferramentas próprias.

import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MIN_INTERVAL_MIN = 30
const MAX_AGENTS_PER_RUN = 5

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
    if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

    // Autorização: segredo do agendador (x-cron-secret) OU sessão do proprietário (botão "Executar agora").
    const expected = Deno.env.get('CRON_SECRET') ?? ''
    const byCron = !!expected && req.headers.get('x-cron-secret') === expected
    if (!byCron) {
        const authHeader = req.headers.get('Authorization') ?? ''
        if (!authHeader.startsWith('Bearer ')) return json({ error: 'Não autorizado.' }, 401)
        const userSb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
        const { data: owner } = await userSb.from('administrators').select('id').eq('role', 'owner').limit(1)
        if (!owner || owner.length === 0) return json({ error: 'Não autorizado.' }, 401)
    }

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: ks } = await sb.from('system_settings').select('value').eq('key', 'automation_kill_switch').maybeSingle()
    if (ks?.value === true) return json({ ok: true, skipped: 'Botão de emergência ativo.' })

    const { data: agents, error } = await sb.from('ai_agents')
        .select('id,code,name,description,system_prompt,auto_task,last_auto_run_at,daily_task_limit,status')
        .eq('auto_enabled', true).eq('status', 'ativo')
    if (error) return json({ error: error.message }, 500)

    const cutoff = Date.now() - MIN_INTERVAL_MIN * 60000
    const due = (agents ?? []).filter((a) => !a.last_auto_run_at || new Date(a.last_auto_run_at).getTime() < cutoff).slice(0, MAX_AGENTS_PER_RUN)

    const llmBase = (Deno.env.get('LLM_BASE_URL') ?? '').replace(/\/+$/, '')
    const llmKey = Deno.env.get('LLM_API_KEY') ?? ''
    const llmModel = Deno.env.get('LLM_MODEL') ?? 'auto'
    if (!llmBase || !llmKey) return json({ error: 'LLM_BASE_URL ou LLM_API_KEY não configurados.' }, 500)

    // Contexto real do sistema, igual para todos os agentes desta execução.
    const count = async (t: string, filter?: (q: any) => any) => {
        let q = sb.from(t).select('id', { count: 'exact', head: true })
        if (filter) q = filter(q)
        const { count } = await q
        return count ?? 0
    }
    const context = {
        empresas_sem_website: await count('companies', (q) => q.eq('has_website', false)),
        leads_analisados: await count('leads', (q) => q.eq('stage', 'analisado')),
        propostas_rascunho: await count('proposals', (q) => q.eq('status', 'rascunho')),
        propostas_enviadas: await count('proposals', (q) => q.eq('status', 'enviada')),
        tarefas_pendentes: await count('ai_tasks', (q) => q.eq('status', 'pendente')),
    }

    const { data: skills } = await sb.from('agent_skills').select('name,content').eq('enabled', true).order('created_at').limit(20)
    const skillsBlock = (skills ?? []).map((s) => `### ${s.name}\n${String(s.content).slice(0, 4000)}`).join('\n\n').slice(0, 20000)

    const results: { agent: string; status: string; error?: string }[] = []
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)

    for (const agent of due) {
        const { count: today } = await sb.from('ai_tasks').select('id', { count: 'exact', head: true }).eq('agent_id', agent.id).gte('created_at', startOfDay.toISOString())
        if ((today ?? 0) >= agent.daily_task_limit) { results.push({ agent: agent.name, status: 'limite diário atingido' }); continue }

        const task = agent.auto_task?.trim() || agent.description
        const startedAt = new Date().toISOString()
        // Marca a execução antes de chamar o LLM, para não repetir em caso de falha.
        await sb.from('ai_agents').update({ last_auto_run_at: startedAt }).eq('id', agent.id)

        const system = [
            `Você é o agente automático "${agent.name}" do sistema MKON AI Business, agência de websites, NFC e serviços digitais em Portugal.`,
            agent.description,
            agent.system_prompt ? `Regras: ${agent.system_prompt}` : '',
            skillsBlock ? `Habilidades do proprietário (siga-as quando forem relevantes):\n${skillsBlock}` : '',
            'Responda em Português de Portugal, de forma concreta. Não diga que enviou mensagens ou criou propostas: apenas recomende ou prepare.',
        ].filter(Boolean).join('\n\n')
        const user = `Tarefa automática: ${task}\n\nEstado atual do sistema (dados reais):\n${JSON.stringify(context, null, 2)}`

        try {
            const res = await fetch(`${llmBase}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${llmKey}` },
                body: JSON.stringify({ model: llmModel, temperature: 0.3, max_tokens: 1200, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
            })
            if (!res.ok) throw new Error(`Fornecedor de IA devolveu ${res.status}`)
            const data = await res.json()
            const reply = String(data?.choices?.[0]?.message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
            await sb.from('ai_tasks').insert({
                agent_id: agent.id, title: `[Automático] ${task}`.slice(0, 200), status: 'concluida',
                input: { task, automatic: true }, output: { reply }, started_at: startedAt, finished_at: new Date().toISOString(),
            })
            await sb.from('ai_agents').update({ last_error: null }).eq('id', agent.id)
            results.push({ agent: agent.name, status: 'concluida' })
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Erro desconhecido'
            await sb.from('ai_tasks').insert({
                agent_id: agent.id, title: `[Automático] ${task}`.slice(0, 200), status: 'cancelada',
                input: { task, automatic: true }, error_message: msg, started_at: startedAt, finished_at: new Date().toISOString(),
            })
            await sb.from('ai_agents').update({ last_error: msg }).eq('id', agent.id)
            results.push({ agent: agent.name, status: 'falhou', error: msg })
        }
    }

    return json({ ok: true, executados: results.length, resultados: results })
})

function json(payload: unknown, status = 200) {
    return new Response(JSON.stringify(payload), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}
