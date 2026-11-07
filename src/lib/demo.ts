/**
 * MODO DEMONSTRAÇÃO — dados 100% fictícios, sem ligação ao Supabase.
 * Ativo quando VITE_SUPABASE_URL não está definida ou é inválida,
 * ou quando o utilizador clica em "Entrar em modo demo" no login.
 */

export const DEMO_MODE_KEY = 'mkon_demo_mode'
export const isDemoActive = () =>
  typeof window !== 'undefined' && sessionStorage.getItem(DEMO_MODE_KEY) === '1'

export function enterDemo() { sessionStorage.setItem(DEMO_MODE_KEY, '1'); window.location.reload() }
export function exitDemo()  { sessionStorage.removeItem(DEMO_MODE_KEY); window.location.reload() }

/* ── Tipos ── */
export type DemoAdmin   = { id: string; full_name: string; email: string }
export type DemoCompany = { id: string; name: string; city: string | null; source_id: string | null }
export type DemoLead    = {
  id: string; stage: string; score: number | null; opportunity: string | null
  created_at: string; next_action: string | null; next_action_at: string | null
  companies: DemoCompany | null
}
export type DemoSale = { amount: number; cost: number; sold_at: string; products: { name: string; category: string } | null }
export type DemoExpense = { amount: number; incurred_on: string; status: string }
export type DemoProposal = { status: string; created_at: string }
export type DemoTask    = { status: string; ai_agents: { name: string } | null }
export type DemoLog     = { id: number; action: string; entity_type: string | null; created_at: string }
export type DemoIntegration = {
  id: string; provider: string; name: string; description: string | null
  status: string; monthly_limit: number | null; last_checked_at: string | null
  last_error: string | null; secret_ref: string | null
}
export type DemoAgent = {
  id: string; code: string; name: string; description: string; status: string
  model: string; provider: string; daily_task_limit: number; monthly_budget_eur: number
  last_error: string | null
}

/* ── Helpers ── */
const ago = (days: number, hours = 0) => {
  const d = new Date(); d.setDate(d.getDate() - days); d.setHours(d.getHours() - hours)
  return d.toISOString()
}
const monthAgo = (months: number, day = 15) => {
  const d = new Date(); d.setMonth(d.getMonth() - months); d.setDate(day)
  return d.toISOString().slice(0, 10)
}

/* ── Dados fictícios ── */
export const DEMO: {
  admin: DemoAdmin
  companies: number
  nfcSold: number
  websitesInProd: number
  contacts: number
  replies: number
  leads: DemoLead[]
  sales: DemoSale[]
  expenses: DemoExpense[]
  proposals: DemoProposal[]
  tasks: DemoTask[]
  logs: DemoLog[]
  sources: { id: string; name: string }[]
  companySources: { source_id: string | null }[]
  overdueTx: number
  overdueProjects: number
  integrations: DemoIntegration[]
  agents: DemoAgent[]
  agentStats: Record<string, { done: number; failed: number; cost: number }>
} = {
  admin: { id: 'demo', full_name: 'Utilizador Demo', email: 'demo@mkon.ai' },

  companies: 87,
  nfcSold: 24,
  websitesInProd: 6,
  contacts: 143,
  replies: 58,
  overdueTx: 2,
  overdueProjects: 1,

  sources: [
    { id: 's1', name: 'Google Maps' },
    { id: 's2', name: 'Indicação' },
    { id: 's3', name: 'Site Próprio' },
    { id: 's4', name: 'LinkedIn' },
    { id: 's5', name: 'Feiras' },
  ],

  companySources: [
    ...Array(32).fill({ source_id: 's1' }),
    ...Array(21).fill({ source_id: 's2' }),
    ...Array(18).fill({ source_id: 's3' }),
    ...Array(10).fill({ source_id: 's4' }),
    ...Array(6).fill({ source_id: 's5' }),
  ],

  leads: [
    { id: 'l1', stage: 'novo_lead', score: 82, opportunity: 'elevada', created_at: ago(1), next_action: 'Ligar', next_action_at: ago(0, 2), companies: { id: 'c1', name: 'Pinturas Alves & Filhos', city: 'Lisboa', source_id: 's1' } },
    { id: 'l2', stage: 'qualificado', score: 91, opportunity: 'excelente', created_at: ago(3), next_action: 'Enviar proposta', next_action_at: ago(0), companies: { id: 'c2', name: 'Remodelações Norte Lda.', city: 'Porto', source_id: 's1' } },
    { id: 'l3', stage: 'proposta_enviada', score: 76, opportunity: 'elevada', created_at: ago(7), next_action: 'Follow-up', next_action_at: ago(2), companies: { id: 'c3', name: 'Construções Sul S.A.', city: 'Faro', source_id: 's2' } },
    { id: 'l4', stage: 'negociacao', score: 88, opportunity: 'excelente', created_at: ago(10), next_action: null, next_action_at: null, companies: { id: 'c4', name: 'Eletro Torres', city: 'Coimbra', source_id: 's3' } },
    { id: 'l5', stage: 'venda_fechada', score: 95, opportunity: 'excelente', created_at: ago(14), next_action: null, next_action_at: null, companies: { id: 'c5', name: 'Canalizações Ferreira', city: 'Braga', source_id: 's2' } },
    { id: 'l6', stage: 'producao', score: 79, opportunity: 'elevada', created_at: ago(20), next_action: null, next_action_at: null, companies: { id: 'c6', name: 'Acabamentos Premium', city: 'Setúbal', source_id: 's1' } },
    { id: 'l7', stage: 'entregue', score: 93, opportunity: 'excelente', created_at: ago(35), next_action: null, next_action_at: null, companies: { id: 'c7', name: 'Grupo Habitat', city: 'Lisboa', source_id: 's4' } },
    { id: 'l8', stage: 'analisado', score: 54, opportunity: 'moderada', created_at: ago(2), next_action: 'Analisar concorrência', next_action_at: ago(0), companies: { id: 'c8', name: 'Obras Barros', city: 'Aveiro', source_id: 's5' } },
    { id: 'l9', stage: 'contactado', score: 66, opportunity: 'moderada', created_at: ago(5), next_action: 'Reunião', next_action_at: ago(1), companies: { id: 'c9', name: 'Gesseiro Silva', city: 'Évora', source_id: 's3' } },
    { id: 'l10', stage: 'interessado', score: 85, opportunity: 'elevada', created_at: ago(8), next_action: 'Demo website', next_action_at: ago(0), companies: { id: 'c10', name: 'Pintura & Arte Lda.', city: 'Leiria', source_id: 's1' } },
    { id: 'l11', stage: 'novo_lead', score: 42, opportunity: 'baixa', created_at: ago(0), next_action: null, next_action_at: null, companies: { id: 'c11', name: 'Obras Rapidas Unip.', city: 'Viseu', source_id: 's1' } },
    { id: 'l12', stage: 'perdido', score: 31, opportunity: 'baixa', created_at: ago(30), next_action: null, next_action_at: null, companies: { id: 'c12', name: 'Reforma Barata', city: 'Beja', source_id: 's5' } },
  ],

  sales: [
    { amount: 1200, cost: 300, sold_at: monthAgo(0, 5), products: { name: 'Website Profissional', category: 'website' } },
    { amount: 950, cost: 180, sold_at: monthAgo(0, 12), products: { name: 'NFC Pack x10', category: 'nfc' } },
    { amount: 1800, cost: 500, sold_at: monthAgo(0, 8), products: { name: 'Website Premium', category: 'website' } },
    { amount: 600, cost: 120, sold_at: monthAgo(1, 3), products: { name: 'NFC Pack x5', category: 'nfc' } },
    { amount: 1400, cost: 350, sold_at: monthAgo(1, 18), products: { name: 'Website Profissional', category: 'website' } },
    { amount: 2200, cost: 700, sold_at: monthAgo(1, 25), products: { name: 'Website Premium+SEO', category: 'website' } },
    { amount: 800, cost: 160, sold_at: monthAgo(2, 7), products: { name: 'NFC Pack x8', category: 'nfc' } },
    { amount: 1100, cost: 280, sold_at: monthAgo(2, 20), products: { name: 'Website Profissional', category: 'website' } },
    { amount: 500, cost: 100, sold_at: monthAgo(3, 10), products: { name: 'NFC Personalizada', category: 'nfc' } },
    { amount: 1700, cost: 460, sold_at: monthAgo(3, 22), products: { name: 'Website Premium', category: 'website' } },
    { amount: 1350, cost: 320, sold_at: monthAgo(4, 14), products: { name: 'Website Profissional', category: 'website' } },
    { amount: 750, cost: 140, sold_at: monthAgo(4, 28), products: { name: 'NFC Pack x6', category: 'nfc' } },
    { amount: 900, cost: 200, sold_at: monthAgo(5, 9), products: { name: 'NFC Pack x9', category: 'nfc' } },
    { amount: 1600, cost: 420, sold_at: monthAgo(5, 21), products: { name: 'Website Profissional', category: 'website' } },
  ],

  expenses: [
    { amount: 49, incurred_on: monthAgo(0, 1), status: 'pago' },
    { amount: 120, incurred_on: monthAgo(0, 5), status: 'pago' },
    { amount: 35, incurred_on: monthAgo(0, 10), status: 'pendente' },
    { amount: 200, incurred_on: monthAgo(1, 3), status: 'pago' },
    { amount: 80, incurred_on: monthAgo(1, 15), status: 'pago' },
    { amount: 60, incurred_on: monthAgo(2, 8), status: 'pago' },
    { amount: 150, incurred_on: monthAgo(2, 20), status: 'pago' },
    { amount: 45, incurred_on: monthAgo(3, 12), status: 'pago' },
    { amount: 180, incurred_on: monthAgo(4, 6), status: 'pago' },
    { amount: 70, incurred_on: monthAgo(5, 18), status: 'pago' },
  ],

  proposals: [
    { status: 'enviada', created_at: monthAgo(0, 3) },
    { status: 'aprovada', created_at: monthAgo(0, 7) },
    { status: 'enviada', created_at: monthAgo(0, 11) },
    { status: 'aprovada', created_at: monthAgo(1, 4) },
    { status: 'enviada', created_at: monthAgo(1, 10) },
    { status: 'aprovada', created_at: monthAgo(1, 17) },
    { status: 'recusada', created_at: monthAgo(2, 5) },
    { status: 'aprovada', created_at: monthAgo(2, 19) },
    { status: 'enviada', created_at: monthAgo(3, 8) },
    { status: 'aprovada', created_at: monthAgo(3, 23) },
    { status: 'enviada', created_at: monthAgo(4, 13) },
    { status: 'aprovada', created_at: monthAgo(5, 2) },
  ],

  tasks: [
    { status: 'concluida', ai_agents: { name: 'Lead Analyst' } },
    { status: 'concluida', ai_agents: { name: 'Lead Analyst' } },
    { status: 'concluida', ai_agents: { name: 'Lead Analyst' } },
    { status: 'cancelada', ai_agents: { name: 'Lead Analyst' } },
    { status: 'concluida', ai_agents: { name: 'Copy Agent' } },
    { status: 'concluida', ai_agents: { name: 'Copy Agent' } },
    { status: 'cancelada', ai_agents: { name: 'Copy Agent' } },
    { status: 'concluida', ai_agents: { name: 'Proposal Bot' } },
    { status: 'concluida', ai_agents: { name: 'Proposal Bot' } },
    { status: 'concluida', ai_agents: { name: 'Proposal Bot' } },
    { status: 'concluida', ai_agents: { name: 'Proposal Bot' } },
  ],

  logs: [
    { id: 1, action: 'lead.stage_changed', entity_type: 'leads', created_at: ago(0, 1) },
    { id: 2, action: 'proposal.sent', entity_type: 'proposals', created_at: ago(0, 3) },
    { id: 3, action: 'sale.registered', entity_type: 'sales', created_at: ago(1) },
    { id: 4, action: 'ai_task.completed', entity_type: 'ai_tasks', created_at: ago(1, 4) },
    { id: 5, action: 'integration.status_changed', entity_type: 'integrations', created_at: ago(2) },
    { id: 6, action: 'lead.created', entity_type: 'leads', created_at: ago(2, 6) },
    { id: 7, action: 'backup.exported', entity_type: 'system', created_at: ago(3) },
    { id: 8, action: 'settings.updated', entity_type: 'system_settings', created_at: ago(5) },
  ],

  integrations: [
    { id: 'i1', provider: 'openai', name: 'OpenAI', description: 'Modelos GPT para análise de leads e geração de conteúdos', status: 'aguardando_configuracao', monthly_limit: 50, last_checked_at: null, last_error: null, secret_ref: 'OPENAI_API_KEY' },
    { id: 'i2', provider: 'google_places', name: 'Google Places API', description: 'Pesquisa de empresas por categoria e localização', status: 'aguardando_configuracao', monthly_limit: 30, last_checked_at: null, last_error: null, secret_ref: 'GOOGLE_PLACES_API_KEY' },
    { id: 'i3', provider: 'google_business', name: 'Google Business Profile', description: 'Publicação de respostas a avaliações e gestão de perfis', status: 'aguardando_configuracao', monthly_limit: null, last_checked_at: null, last_error: null, secret_ref: 'GOOGLE_BUSINESS_CLIENT_SECRET' },
    { id: 'i4', provider: 'whatsapp', name: 'WhatsApp Business API', description: 'Envio de mensagens comerciais e follow-ups', status: 'aguardando_configuracao', monthly_limit: 20, last_checked_at: null, last_error: null, secret_ref: 'WHATSAPP_ACCESS_TOKEN' },
    { id: 'i5', provider: 'email', name: 'Provedor de Email', description: 'Envio de propostas e comunicações formais por email', status: 'aguardando_configuracao', monthly_limit: 10, last_checked_at: null, last_error: null, secret_ref: 'EMAIL_PROVIDER_API_KEY' },
    { id: 'i6', provider: 'n8n', name: 'n8n Webhooks', description: 'Automações e integrações de fluxo de trabalho', status: 'aguardando_configuracao', monthly_limit: null, last_checked_at: null, last_error: null, secret_ref: 'N8N_WEBHOOK_SECRET' },
    { id: 'i7', provider: 'hosting', name: 'Alojamento de Sites', description: 'Deploy automatizado dos sites criados para clientes', status: 'aguardando_configuracao', monthly_limit: null, last_checked_at: null, last_error: null, secret_ref: 'HOSTING_API_TOKEN' },
  ],

  agents: [
    { id: 'a1', code: 'lead_analyst', name: 'Lead Analyst', description: 'Analisa perfis de empresas e pontua oportunidades de negócio', status: 'pausado', model: 'gpt-4o-mini', provider: 'openai', daily_task_limit: 50, monthly_budget_eur: 10, last_error: null },
    { id: 'a2', code: 'copy_agent', name: 'Copy Agent', description: 'Gera mensagens de contacto e follow-up personalizadas', status: 'pausado', model: 'gpt-4o-mini', provider: 'openai', daily_task_limit: 30, monthly_budget_eur: 8, last_error: null },
    { id: 'a3', code: 'proposal_bot', name: 'Proposal Bot', description: 'Elabora propostas comerciais em PDF com base no perfil do cliente', status: 'pausado', model: 'gpt-4o', provider: 'openai', daily_task_limit: 20, monthly_budget_eur: 15, last_error: null },
    { id: 'a4', code: 'review_responder', name: 'Review Responder', description: 'Responde a avaliações do Google Business de forma personalizada', status: 'pausado', model: 'gpt-4o-mini', provider: 'openai', daily_task_limit: 40, monthly_budget_eur: 5, last_error: null },
  ],

  agentStats: {
    'a1': { done: 3, failed: 1, cost: 0.42 },
    'a2': { done: 2, failed: 1, cost: 0.28 },
    'a3': { done: 4, failed: 0, cost: 1.15 },
    'a4': { done: 0, failed: 0, cost: 0 },
  },
}
