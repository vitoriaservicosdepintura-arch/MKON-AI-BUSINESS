/**
 * MKON AI — Serviço central de IA.
 * Ordem de preferência: Chave Universal (auto-detect) → FreeLLMAPI.
 * Todos os módulos (bot, agentes, prospeção…) passam por chatAI()/askAI().
 */

import { getApiKey, detectProviderFromKey } from './apikeys'
import { isFreeLlmConfigured, llmChat, type ChatMsg } from './llm'

export type { ChatMsg } from './llm'
export type AiProvider = 'universal' | 'freellm'

export type AiResult = {
    text: string
    provider: AiProvider
    model: string
    routedVia: string | null
    inputTokens: number
    outputTokens: number
}

export type AiOptions = { model?: string; temperature?: number; maxTokens?: number }

export function getActiveProvider(): AiProvider | null {
    const universalKey = getApiKey('universal')
    if (universalKey) return 'universal'
    if (isFreeLlmConfigured()) return 'freellm'
    return null
}

export function isAiReady(): boolean {
    return getActiveProvider() !== null
}

export function getProviderLabel(): string {
    const provider = getActiveProvider()
    if (provider === 'universal') {
        const key = getApiKey('universal')
        const detected = detectProviderFromKey(key)
        return detected.label
    }
    if (provider === 'freellm') return 'FreeLLMAPI (chave unificada)'
    return 'Sem IA configurada'
}

/** Conversa completa (com histórico) através do melhor fornecedor disponível. */
export async function chatAI(messages: ChatMsg[], o: AiOptions = {}): Promise<AiResult> {
    const provider = getActiveProvider()
    if (!provider) throw new Error('Nenhuma chave de IA configurada. Adicione a chave Universal em Administração → Integrações.')
    
    const r = await llmChat({ messages, model: o.model, temperature: o.temperature, maxTokens: o.maxTokens })
    return { text: r.text, provider, model: r.model ?? o.model ?? 'auto', routedVia: r.routedVia, inputTokens: r.inputTokens, outputTokens: r.outputTokens }
}

/** Pergunta única (sistema + utilizador) → texto. */
export async function askAI(systemPrompt: string, userPrompt: string, o: AiOptions = {}): Promise<string> {
    const r = await chatAI([{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], o)
    return r.text
}

/* ═══════════════════════════════════════════════════════════
   PROMPTS ESPECIALIZADOS — um por módulo do sistema
   ═══════════════════════════════════════════════════════════ */

const BASE_CONTEXT = `Você é o assistente de IA do sistema MKON AI Business — uma plataforma privada de gestão de negócios para uma agência de serviços digitais (websites, NFC, SEO) em Portugal. Responda sempre em Português de Portugal. Seja direto, prático e profissional.`

/* ── Análise de Lead ── */
export async function analyzeLeadWithAI(company: {
    name: string; category?: string | null; city?: string | null
    phone?: string | null; email?: string | null; website?: string | null
    commercial_profile?: string | null
}): Promise<{ score: number; opportunity: 'excelente' | 'elevada' | 'moderada' | 'baixa'; analysis: string; suggested_message: string; next_action: string }> {
    const system = `${BASE_CONTEXT}
Você é o Analista de Leads. Analisa empresas e avalia o potencial comercial para vender websites, NFC e serviços digitais.
SEMPRE responda em JSON válido com esta estrutura exata:
{"score": NUMBER_0_TO_100, "opportunity": "excelente|elevada|moderada|baixa", "analysis": "TEXTO", "suggested_message": "TEXTO_MENSAGEM_CONTACTO", "next_action": "TEXTO_ACCAO"}`

    const user = `Analise esta empresa para potencial de venda de serviços digitais:
Nome: ${company.name}
Categoria: ${company.category ?? 'desconhecida'}
Cidade: ${company.city ?? 'desconhecida'}
Telefone: ${company.phone ?? 'não disponível'}
Email: ${company.email ?? 'não disponível'}
Website: ${company.website ? `SIM — ${company.website}` : 'NÃO TEM WEBSITE'}
Perfil: ${company.commercial_profile ?? 'sem informação adicional'}

Pontuação de oportunidade deve ser MAIOR se:
- Não tem website (oportunidade de venda de website)
- Não tem email profissional
- É uma empresa de construção/remodelação/pintura/canalização/eletricidade (público-alvo ideal)

Forneça sugestão de mensagem de contacto personalizada e próxima ação concreta.`

    const raw = await askAI(system, user)

    // Parse JSON robustly
    try {
        const match = raw.match(/\{[\s\S]*\}/)
        if (!match) throw new Error('no json')
        const parsed = JSON.parse(match[0])
        return {
            score: Math.min(100, Math.max(0, Number(parsed.score) || 50)),
            opportunity: ['excelente', 'elevada', 'moderada', 'baixa'].includes(parsed.opportunity) ? parsed.opportunity : 'moderada',
            analysis: parsed.analysis ?? raw,
            suggested_message: parsed.suggested_message ?? '',
            next_action: parsed.next_action ?? 'Contactar empresa',
        }
    } catch {
        return { score: 60, opportunity: 'moderada', analysis: raw, suggested_message: '', next_action: 'Contactar empresa' }
    }
}

/* ── Gerar mensagem de prospeção ── */
export async function generateProspectingMessage(company: {
    name: string; category?: string | null; city?: string | null
    has_website: boolean; contact_name?: string
}, channel: 'whatsapp' | 'email' | 'sms' = 'whatsapp'): Promise<string> {
    const system = `${BASE_CONTEXT}
Você é o Agente de Vendas. Cria mensagens de contacto inicial personalizadas, naturais e persuasivas.
A mensagem deve ser profissional mas informal, nunca agressiva. Máximo 150 palavras para WhatsApp, 250 para email.`

    const user = `Crie uma mensagem de ${channel} para prospeção:
Empresa: ${company.name}
Setor: ${company.category ?? 'construção/obras'}
Cidade: ${company.city ?? 'Portugal'}
Tem website: ${company.has_website ? 'SIM' : 'NÃO'}
${company.contact_name ? `Contacto: ${company.contact_name}` : ''}

O objetivo é marcar uma breve conversa para apresentar soluções digitais (website, NFC para Google Reviews, etc.).
Seja específico ao setor da empresa. Não mencione preços. Inclua uma pergunta de qualificação no final.`

    return askAI(system, user)
}

/* ── Gerar proposta comercial ── */
export async function generateProposalText(data: {
    company_name: string; service: string; price?: number
    delivery_days?: number; notes?: string
}): Promise<string> {
    const system = `${BASE_CONTEXT}
Você é o Proposal Bot. Cria propostas comerciais profissionais e convincentes em formato de texto estruturado.
Use linguagem formal mas acessível. Destaque benefícios, não apenas funcionalidades.`

    const user = `Crie o texto de uma proposta comercial:
Cliente: ${data.company_name}
Serviço/Produto: ${data.service}
${data.price ? `Investimento: €${data.price}` : ''}
${data.delivery_days ? `Prazo: ${data.delivery_days} dias úteis` : ''}
${data.notes ? `Notas adicionais: ${data.notes}` : ''}

Inclua: introdução, descrição do serviço, benefícios principais (3-4 pontos), o que está incluído, prazo e próximos passos.`

    return askAI(system, user)
}

/* ── Gerar resposta a avaliação Google ── */
export async function generateReviewResponse(review: {
    rating: number; text: string; company_name: string
}): Promise<string> {
    const system = `${BASE_CONTEXT}
Você é o Review Responder. Cria respostas profissionais a avaliações do Google Business.
Para avaliações positivas: agradeça de forma genuína e personalizada.
Para avaliações negativas: reconheça, peça desculpa e ofereça solução. Nunca culpe o cliente.
Máximo 100 palavras.`

    const user = `Empresa: ${review.company_name}
Avaliação: ${review.rating} estrelas
Texto: "${review.text}"

Crie uma resposta profissional para publicar no Google Business.`

    return askAI(system, user)
}

/* ── Analisar financeiro / relatório ── */
export async function generateFinancialInsight(data: {
    total_revenue: number; total_expenses: number; margin: number
    top_product?: string; month?: string
}): Promise<string> {
    const system = `${BASE_CONTEXT}
Você é o Agente Financeiro. Analisa dados financeiros e fornece insights acionáveis e recomendações concretas.
Seja direto — identifique padrões, riscos e oportunidades de crescimento.`

    const user = `Analise estes dados financeiros:
${data.month ? `Período: ${data.month}` : ''}
Receita total: €${data.total_revenue.toFixed(2)}
Despesas totais: €${data.total_expenses.toFixed(2)}
Margem líquida: ${data.margin.toFixed(1)}%
${data.top_product ? `Produto com mais vendas: ${data.top_product}` : ''}

Forneça:
1. Avaliação geral (1 frase)
2. Principal ponto positivo
3. Principal ponto de atenção
4. Uma recomendação concreta para o próximo mês`

    return askAI(system, user)
}

/* ── Gerar conteúdo para website de cliente ── */
export async function generateWebsiteContent(company: {
    name: string; category: string; city: string; services?: string
}): Promise<{ headline: string; subheadline: string; about: string; cta: string }> {
    const system = `${BASE_CONTEXT}
Você é o Demonstrador — especialista em criar conteúdo para websites de empresas de construção e obras.
Responda APENAS em JSON com a estrutura exata pedida. Textos em Português de Portugal, persuasivos e profissionais.`

    const user = `Crie conteúdo para o website de:
Empresa: ${company.name}
Setor: ${company.category}
Cidade: ${company.city}
${company.services ? `Serviços: ${company.services}` : ''}

JSON obrigatório:
{"headline": "TÍTULO_IMPACTANTE", "subheadline": "SUBTÍTULO_COM_BENEFÍCIO", "about": "PARÁGRAFO_SOBRE_EMPRESA_60_PALAVRAS", "cta": "TEXTO_BOTÃO_CONTACTO"}`

    const raw = await askAI(system, user)
    try {
        const match = raw.match(/\{[\s\S]*\}/)
        if (!match) throw new Error()
        return JSON.parse(match[0])
    } catch {
        return {
            headline: `${company.name} — Qualidade e Confiança`,
            subheadline: `Os especialistas em ${company.category} na região de ${company.city}`,
            about: `A ${company.name} é uma empresa dedicada a prestar serviços de ${company.category} com qualidade e profissionalismo. Com experiência comprovada na região de ${company.city}, garantimos trabalhos rigorosos e clientes satisfeitos.`,
            cta: 'Pedir Orçamento Gratuito',
        }
    }
}

/* ── Supervisão: resumo do dia ── */
export async function generateDailySummary(data: {
    leads_in_pipeline: number; proposals_sent: number; sales_this_month: number
    pending_tasks: number; overdue: number
}): Promise<string> {
    const system = `${BASE_CONTEXT}
Você é o Supervisor. Cria resumos executivos diários concisos e lista as 3 prioridades mais urgentes.`

    const user = `Estado atual do negócio:
- Leads em pipeline: ${data.leads_in_pipeline}
- Propostas enviadas (pendentes): ${data.proposals_sent}
- Vendas este mês: ${data.sales_this_month}
- Tarefas pendentes: ${data.pending_tasks}
- Itens em atraso: ${data.overdue}

Crie um resumo executivo de 3-4 frases e liste as 3 ações prioritárias para hoje.`

    return askAI(system, user)
}
