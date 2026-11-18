import type { SiteContent, SiteItem, SiteTheme } from '@/components/site/SiteView'

export type SiteStyle = 'pro' | 'simple'
export type SiteInput = { style: SiteStyle; name: string; city?: string | null; segment?: string | null; phone?: string | null; email?: string | null }

export const STYLE_INFO: Record<SiteStyle, { label: string; description: string }> = {
  simple: { label: 'Simples e moderno', description: 'Layout limpo e claro, com cartões leves e cores vivas. Ideal para pequenos negócios.' },
  pro: { label: 'Profissional e luxuoso', description: 'Visual escuro e dourado, tipografia com serifa, hero com gradiente animado e secções completas.' },
}

const THEMES: Record<SiteStyle, SiteTheme> = {
  simple: { primary: '#2563EB', accent: '#0EA5E9', bg: '#FFFFFF', text: '#0F172A' },
  pro: { primary: '#B8912F', accent: '#E6CD84', bg: '#0A0A0A', text: '#F5F1E6' },
}

const SEGMENT_LABEL: Record<string, string> = {
  pintura: 'pintura', remodelacao: 'remodelações', construcao: 'construção civil', eletricidade: 'eletricidade',
  canalizacao: 'canalização', manutencao: 'manutenção', jardim: 'jardinagem', limpeza: 'limpeza',
}

const SERVICES_BY_SEGMENT: Record<string, SiteItem[]> = {
  pintura: [
    { title: 'Pintura interior', text: 'Acabamentos limpos em paredes e tetos, com proteção de mobiliário e pavimentos.' },
    { title: 'Pintura exterior', text: 'Proteção contra humidade e sol, com tintas de alta durabilidade.' },
    { title: 'Restauro de fachadas', text: 'Preparação da superfície, reparação de fissuras e pintura final.' },
    { title: 'Pintura de madeiras e metal', text: 'Portas, janelas, grades e portões tratados e protegidos.' },
    { title: 'Texturas e efeitos', text: 'Acabamentos decorativos para um resultado sofisticado e único.' },
    { title: 'Pintura comercial', text: 'Escritórios e lojas pintados fora do horário de atividade.' },
  ],
}

function genericServices(label: string): SiteItem[] {
  return [
    { title: `Serviços de ${label}`, text: 'Trabalho executado por equipa qualificada, com materiais de qualidade e prazos cumpridos.' },
    { title: 'Visita técnica gratuita', text: 'Avaliamos o espaço no local e apresentamos um orçamento detalhado e sem compromisso.' },
    { title: 'Projetos à medida', text: 'Adaptamos cada intervenção às suas necessidades e ao seu orçamento.' },
    { title: 'Acompanhamento da obra', text: 'Comunicação clara do início ao fim, com relatórios de progresso.' },
    { title: 'Garantia de trabalho', text: 'Todas as intervenções têm garantia por escrito.' },
    { title: 'Manutenção pós-obra', text: 'Planos de manutenção para manter o resultado como no primeiro dia.' },
  ]
}

/** Gera um site completo (textos, secções, contactos e cores) a partir dos dados do cliente. */
export function generateSite(input: SiteInput): { content: SiteContent; theme: SiteTheme; slug: string } {
  const seg = (input.segment ?? '').toLowerCase()
  const label = SEGMENT_LABEL[seg] ?? (seg || 'serviços')
  const city = input.city?.trim() || ''
  const name = input.name.trim() || 'O seu negócio'
  const pro = input.style === 'pro'
  const services = SERVICES_BY_SEGMENT[seg] ?? genericServices(label)
  const where = city ? ` em ${city}` : ''

  const content: SiteContent = {
    style: input.style,
    brand: { name, tagline: pro ? `Excelência em ${label}${where}` : `${label.charAt(0).toUpperCase() + label.slice(1)}${where}` },
    menu: [
      { label: 'Serviços', href: '#servicos' },
      { label: 'Sobre', href: '#sobre' },
      { label: 'Processo', href: '#processo' },
      { label: 'Trabalhos', href: '#trabalhos' },
      { label: 'Contacto', href: '#contacto' },
    ],
    hero: {
      eyebrow: pro ? `Atelier de ${label}` : `${city || 'Serviços profissionais'}`,
      title: pro ? `${name}: a arte de transformar espaços` : `${name}: ${label} com rigor e prazos cumpridos`,
      subtitle: pro
        ? `Projetos de ${label} com acabamento impecável, materiais selecionados e uma equipa que cumpre cada detalhe${where}.`
        : `Trabalho limpo, prazos cumpridos e preços claros${where}. Peça o seu orçamento em menos de 24 horas.`,
      cta_label: pro ? 'Solicitar consultoria' : 'Pedir orçamento',
      cta_href: '#contacto',
    },
    sections: [
      { type: 'stats', items: [
        { title: '+10', text: 'Anos de experiência' },
        { title: '+300', text: 'Projetos concluídos' },
        { title: '4.9★', text: 'Avaliação média' },
        { title: '24h', text: 'Resposta a pedidos' },
      ] },
      { type: 'services', title: 'Serviços', items: services },
      { type: 'about', title: 'Sobre nós', text: pro
        ? `Somos uma empresa dedicada a ${label}${where}. Cada projeto começa com uma escuta atenta, segue com materiais de primeira linha e termina com um acabamento que se nota.`
        : `Somos uma equipa local${where}, dedicada a ${label}. Trabalhamos com honestidade, comunicamos tudo por escrito e respeitamos o seu espaço.` },
      { type: 'process', title: 'Como trabalhamos', items: [
        { title: 'Visita e orçamento', text: 'Analisamos o espaço e entregamos um orçamento detalhado.' },
        { title: 'Planeamento', text: 'Definimos materiais, calendário e acordos por escrito.' },
        { title: 'Execução e entrega', text: 'Trabalho acompanhado e revisão final antes da entrega.' },
      ] },
      { type: 'testimonials', title: 'O que dizem os nossos clientes', items: [
        { title: 'Cliente particular', text: 'Pontuais, limpos e com um acabamento excelente. Recomendo sem hesitar.' },
        { title: 'Gestor de condomínio', text: 'Comunicação clara e preço justo. Voltaremos a contratar.' },
        { title: 'Proprietária', text: 'Transformaram a casa em poucos dias, sem sujidade nem stress.' },
      ] },
      { type: 'gallery', title: 'Trabalhos recentes', images: [] },
    ],
    contact: {
      phone: input.phone ?? '',
      email: input.email ?? '',
      whatsapp: input.phone ? input.phone.replace(/\D/g, '') : '',
      address: city,
    },
  }

  const slug = `${name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'site'}-${Math.random().toString(36).slice(2, 6)}`
  return { content, theme: THEMES[input.style], slug }
}
