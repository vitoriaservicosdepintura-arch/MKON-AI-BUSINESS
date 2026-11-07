export type LeadStage =
  | 'novo_lead' | 'analisado' | 'qualificado' | 'contacto_preparado' | 'contactado'
  | 'interessado' | 'demonstracao_criada' | 'proposta_enviada' | 'negociacao'
  | 'venda_fechada' | 'producao' | 'entregue' | 'perdido'

export const STAGES: { key: LeadStage; label: string }[] = [
  { key: 'novo_lead', label: 'Novo lead' },
  { key: 'analisado', label: 'Analisado' },
  { key: 'qualificado', label: 'Qualificado' },
  { key: 'contacto_preparado', label: 'Contacto preparado' },
  { key: 'contactado', label: 'Contactado' },
  { key: 'interessado', label: 'Interessado' },
  { key: 'demonstracao_criada', label: 'Demonstração criada' },
  { key: 'proposta_enviada', label: 'Proposta enviada' },
  { key: 'negociacao', label: 'Negociação' },
  { key: 'venda_fechada', label: 'Venda fechada' },
  { key: 'producao', label: 'Produção' },
  { key: 'entregue', label: 'Entregue' },
  { key: 'perdido', label: 'Perdido' },
]

export const stageLabel = (k: string) => STAGES.find((s) => s.key === k)?.label ?? k

export const CATEGORIES = [
  'Pintor', 'Empresa de pintura', 'Remodelação', 'Construção civil', 'Pladur',
  'Eletricista', 'Canalizador', 'Manutenção', 'Arquiteto', 'Empreiteiro',
]

export const opportunityFromScore = (s: number | null) =>
  s == null ? null : s >= 90 ? 'excelente' : s >= 75 ? 'elevada' : s >= 50 ? 'moderada' : 'baixa'

export const OPPORTUNITY_LABEL: Record<string, string> = {
  excelente: 'Excelente', elevada: 'Elevada', moderada: 'Moderada', baixa: 'Baixa prioridade',
}
