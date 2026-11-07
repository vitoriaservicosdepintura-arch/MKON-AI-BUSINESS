/**
 * Conhecimento do MKON Bot sobre o sistema: módulos, categorias e estado real.
 * Usado no prompt do bot e para reconhecer comandos de navegação.
 */
import { NAV } from './nav'
import { supabase, isConfigured } from './supabase'
import { isDemoActive, DEMO } from './demo'

export type ModuleKnowledge = {
    route: string
    label: string
    description: string
    keywords: string[]
}

const EXTRA_KEYWORDS: Record<string, string[]> = {
    '/': ['dashboard', 'visao geral', 'visão geral', 'indicadores', 'kpi', 'resumo', 'painel'],
    '/prospeccao': ['prospeccao', 'prospecção', 'prospectar', 'pesquisa de empresas', 'google maps', 'novos leads', 'oportunidades', 'analise de lead'],
    '/agentes': ['agentes', 'agente', 'ia', 'bot', 'tarefas dos agentes', 'executar tarefa', 'automacoes de ia'],
    '/mensagens': ['mensagens', 'mensagem', 'inbox', 'caixa de entrada', 'whatsapp', 'conversas', 'chat'],
    '/crm': ['crm', 'clientes', 'empresas', 'leads', 'negociacoes', 'negociações', 'pipeline', 'funil', 'contactos'],
    '/websites': ['websites', 'website', 'site', 'sites', 'demonstracoes', 'templates', 'paginas'],
    '/propostas': ['propostas', 'proposta', 'orcamentos', 'orçamentos', 'cotacao', 'cotação'],
    '/nfc': ['nfc', 'plaquinhas', 'avaliacoes google', 'avaliações google', 'reviews', 'encomendas nfc'],
    '/projetos': ['projetos', 'projeto', 'producao', 'produção', 'entregas', 'tarefas de projeto'],
    '/financeiro': ['financeiro', 'receitas', 'despesas', 'faturacao', 'faturação', 'fluxo de caixa', 'financas', 'finanças', 'lucro'],
    '/relatorios': ['relatorios', 'relatórios', 'exportacoes', 'exportações', 'exportar', 'analise de dados', 'inteligencia de negocio'],
    '/admin': ['administracao', 'administração', 'integracoes', 'integrações', 'configuracoes', 'configurações', 'logs', 'seguranca', 'backup', 'rgpd', 'chaves', 'chave freellm'],
}

export const MODULE_KNOWLEDGE: ModuleKnowledge[] = NAV.map((item) => ({
    route: item.to,
    label: item.label,
    description: item.description,
    keywords: EXTRA_KEYWORDS[item.to] ?? [],
}))

export type SystemSnapshot = {
    demo: boolean
    modules: ModuleKnowledge[]
    companies: number
    leads: number
    agentsActive: number
    agentsTotal: number
    integrationsConnected: number
    integrationsTotal: number
    generatedAt: string
}

async function countRows(table: string): Promise<number> {
    try {
        const { count } = await supabase.from(table).select('id', { count: 'exact', head: true })
        return count ?? 0
    } catch {
        return 0
    }
}

export async function loadSystemSnapshot(): Promise<SystemSnapshot> {
    const demo = isDemoActive() || !isConfigured
    const base: SystemSnapshot = {
        demo,
        modules: MODULE_KNOWLEDGE,
        companies: 0,
        leads: 0,
        agentsActive: 0,
        agentsTotal: 0,
        integrationsConnected: 0,
        integrationsTotal: 0,
        generatedAt: new Date().toISOString(),
    }

    if (demo) {
        return {
            ...base,
            companies: DEMO.companies,
            leads: DEMO.leads.length,
            agentsActive: DEMO.agents.filter((a) => a.status === 'ativo').length,
            agentsTotal: DEMO.agents.length,
            integrationsConnected: DEMO.integrations.filter((i) => i.status === 'conectada').length,
            integrationsTotal: DEMO.integrations.length,
        }
    }

    try {
        const [companies, leads, agents, integrations] = await Promise.all([
            countRows('companies'),
            countRows('leads'),
            supabase.from('ai_agents').select('status'),
            supabase.from('integrations').select('status'),
        ])
        const agentRows = (agents.data ?? []) as { status: string }[]
        const integrationRows = (integrations.data ?? []) as { status: string }[]
        return {
            ...base,
            companies,
            leads,
            agentsActive: agentRows.filter((a) => a.status === 'ativo').length,
            agentsTotal: agentRows.length,
            integrationsConnected: integrationRows.filter((i) => i.status === 'conectada').length,
            integrationsTotal: integrationRows.length,
        }
    } catch {
        return base
    }
}

export function formatSystemContext(snapshot: SystemSnapshot | null): string {
    const modules = (snapshot?.modules ?? MODULE_KNOWLEDGE)
        .map((m) => `- ${m.label} (${m.route}): ${m.description}`)
        .join('\n')

    const state = snapshot
        ? [
            `Origem dos dados: ${snapshot.demo ? 'modo demonstração (valores fictícios)' : 'base de dados real'}`,
            `Empresas: ${snapshot.companies} · Leads: ${snapshot.leads}`,
            `Agentes ativos: ${snapshot.agentsActive}/${snapshot.agentsTotal} · Integrações conectadas: ${snapshot.integrationsConnected}/${snapshot.integrationsTotal}`,
        ].join('\n')
        : 'Estado do sistema ainda não carregado.'

    return [
        'RECONHECIMENTO DO SISTEMA MKON AI BUSINESS:',
        'Módulos e categorias que conheces:',
        modules,
        '',
        'ESTADO ATUAL:',
        state,
        '',
        'REGRAS DE RECONHECIMENTO:',
        '- Reconhece qualquer módulo, categoria, campo e fluxo acima e explica onde encontrar cada coisa.',
        '- Se o utilizador pedir para abrir/ir/navegar para um módulo, confirma em uma frase curta.',
        '- Quando faltar um dado concreto, indica em que módulo o pode consultar.',
        '- Fala como o J.A.R.V.I.S.: formal, eficiente, trata o utilizador por "senhor".',
    ].join('\n')
}

function normalize(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
}

const NAV_VERBS = /^(abre|abrir|abram|vai|ir|vamos|navega|navegar|mostra|mostrar|mostra-me|mostra me|leva|leva-me|leva me|entra|entrar|acede|aceder|acessa|acessar|abrir o|abrir a)\b/

export function detectNavigationCommand(text: string): ModuleKnowledge | null {
    const normalized = normalize(text).trim()
    if (!normalized) return null
    if (!NAV_VERBS.test(normalized)) return null

    let best: { module: ModuleKnowledge; score: number } | null = null
    for (const module of MODULE_KNOWLEDGE) {
        const candidates = [module.label, module.route, ...module.keywords].map(normalize).filter(Boolean)
        for (const keyword of candidates) {
            if (normalized.includes(keyword)) {
                const score = keyword.length
                if (!best || score > best.score) best = { module, score }
            }
        }
    }
    return best?.module ?? null
}
