import {
  LayoutDashboard, Radar, Inbox, Kanban, Globe, FileText, Nfc, Wallet,
  FolderKanban, BarChart3, ShieldCheck, ImagePlus, CalendarCheck, type LucideIcon,
} from 'lucide-react'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  stage: 1
  description: string
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, stage: 1, description: 'Visão geral da inteligência comercial' },
  { to: '/prospeccao', label: 'Prospecção', icon: Radar, stage: 1, description: 'Pesquisa de empresas, análise e pontuação de oportunidades' },
  { to: '/mensagens', label: 'Mensagens', icon: Inbox, stage: 1, description: 'Caixa de entrada comercial centralizada' },
  { to: '/crm', label: 'CRM', icon: Kanban, stage: 1, description: 'Leads, clientes e negociações' },
  { to: '/websites', label: 'Websites', icon: Globe, stage: 1, description: 'Gerador de demonstrações e biblioteca de templates' },
  { to: '/reunioes', label: 'Reuniões', icon: CalendarCheck, stage: 1, description: 'Agendamento de reuniões com clientes e fecho de pedidos' },
  { to: '/propostas', label: 'Propostas', icon: FileText, stage: 1, description: 'Orçamentos e propostas comerciais' },
  { to: '/nfc', label: 'NFC', icon: Nfc, stage: 1, description: 'Plaquinhas NFC, encomendas e fornecedores' },
  { to: '/loja-gifs', label: 'Loja de GIFs', icon: ImagePlus, stage: 1, description: 'Venda de ímanes personalizados e GIFs animados' },
  { to: '/projetos', label: 'Projetos', icon: FolderKanban, stage: 1, description: 'Produção e entrega dos projetos vendidos' },
  { to: '/financeiro', label: 'Financeiro', icon: Wallet, stage: 1, description: 'Receitas, despesas e fluxo de caixa' },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3, stage: 1, description: 'Inteligência de negócio e exportações' },
  { to: '/admin', label: 'Administração', icon: ShieldCheck, stage: 1, description: 'Integrações, automações, logs e segurança' },
]
