// Designer do MKON AI Business: monta o site de cada oportunidade a partir da análise e dos dados do mapa.
// Usa só dados reais (nome, tipo, morada, telefone, nota e nº de avaliações do Google). Não inventa
// números, prémios, anos de experiência nem depoimentos de clientes.

export type BuildInput = {
    name: string; category: string; city: string; address: string; phone: string | null
    rating: number | null; reviews: number; score: number | null; analysis: string
}
type Item = { title: string; text: string }
type LLM = (system: string, user: string) => Promise<string | null>

const PRO_THEME = { primary: '#B8912F', accent: '#E6CD84', bg: '#0A0A0A', text: '#F5F1E6' }
const SIMPLE_THEME = { primary: '#2563EB', accent: '#0EA5E9', bg: '#FFFFFF', text: '#0F172A' }

export async function buildSite(input: BuildInput, llm: LLM) {
    const pro = (input.rating ?? 0) >= 4.5 && input.reviews >= 50
    const style = pro ? 'pro' : 'simple'
    const copy = await designCopy(input, pro, llm)

    const sections: any[] = []
    if (input.rating && input.reviews > 0) {
        sections.push({ type: 'stats', items: [
            { title: `${input.rating.toFixed(1)}★`, text: 'Avaliação no Google' },
            { title: String(input.reviews), text: 'Avaliações de clientes' },
        ] })
    }
    sections.push({ type: 'services', title: 'Serviços', items: copy.services })
    sections.push({ type: 'about', title: 'Sobre nós', text: copy.about })
    sections.push({ type: 'process', title: 'Como trabalhamos', items: [
        { title: 'Contacto e visita', text: 'Fale connosco e marcamos uma visita para ver o que precisa.' },
        { title: 'Orçamento claro', text: 'Entregamos um orçamento detalhado, sem compromisso.' },
        { title: 'Execução cuidada', text: 'Trabalho acompanhado e revisão final antes da entrega.' },
    ] })
    sections.push({ type: 'gallery', title: 'Trabalhos', images: [] })

    const content = {
        style,
        brand: { name: input.name, tagline: copy.tagline },
        menu: [
            { label: 'Serviços', href: '#servicos' }, { label: 'Sobre', href: '#sobre' },
            { label: 'Processo', href: '#processo' }, { label: 'Trabalhos', href: '#trabalhos' },
            { label: 'Contacto', href: '#contacto' },
        ],
        hero: { eyebrow: input.city || 'Serviços profissionais', title: copy.hero_title, subtitle: copy.hero_subtitle, cta_label: 'Pedir orçamento', cta_href: '#contacto' },
        sections,
        contact: {
            phone: input.phone ?? '', email: '',
            whatsapp: input.phone ? input.phone.replace(/\D/g, '') : '',
            address: input.address || input.city || '',
        },
    }
    const base = input.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'site'
    const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`
    return { content, theme: pro ? PRO_THEME : SIMPLE_THEME, slug, style }
}

/** Textos do site a partir da análise. Se o modelo falhar ou responder mal, usa textos base do tipo de negócio. */
async function designCopy(input: BuildInput, pro: boolean, llm: LLM) {
    const label = input.category || 'serviços'
    const where = input.city ? ` em ${input.city}` : ''
    const fallback = {
        tagline: `${label.charAt(0).toUpperCase() + label.slice(1)}${where}`,
        hero_title: `${input.name}: ${label} com rigor`,
        hero_subtitle: `Trabalho cuidado e prazos cumpridos${where}. Peça o seu orçamento sem compromisso.`,
        about: `Somos a ${input.name}${where}, dedicada a ${label}. Trabalhamos com honestidade e comunicamos tudo por escrito.`,
        services: genericServices(label),
    }
    const raw = await llm(
        'Você é o Designer do MKON AI Business. Escreva em português de Portugal os textos do website de uma empresa real. Responda APENAS com JSON válido, sem texto antes ou depois, com as chaves: "tagline" (até 60 caracteres), "hero_title" (até 70), "hero_subtitle" (até 160), "about" (2 a 3 frases), "services" (lista de 6 objetos {"title","text"}, text até 120 caracteres). Baseie-se na análise. Não invente números, prémios, anos de experiência, nomes de clientes nem depoimentos.',
        `Empresa: ${input.name}\nTipo: ${input.category}\nMorada: ${input.address || 'sem morada'}\nAvaliações Google: ${input.rating ?? '—'} (${input.reviews})\nEstilo: ${pro ? 'profissional e luxuoso' : 'simples e moderno'}\nAnálise da oportunidade: ${input.analysis}`,
    )
    if (!raw) return fallback
    try {
        const match = raw.match(/\{[\s\S]*\}/)
        const j = JSON.parse(match ? match[0] : raw)
        const str = (v: unknown, max: number, dflt: string) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : dflt)
        const services: Item[] = Array.isArray(j.services)
            ? j.services.filter((x: any) => x && typeof x.title === 'string').slice(0, 6).map((x: any) => ({ title: str(x.title, 60, 'Serviço'), text: str(x.text, 120, '') }))
            : []
        return {
            tagline: str(j.tagline, 60, fallback.tagline),
            hero_title: str(j.hero_title, 70, fallback.hero_title),
            hero_subtitle: str(j.hero_subtitle, 160, fallback.hero_subtitle),
            about: str(j.about, 400, fallback.about),
            services: services.length >= 3 ? services : fallback.services,
        }
    } catch {
        return fallback
    }
}

function genericServices(label: string): Item[] {
    return [
        { title: `Serviços de ${label}`, text: 'Trabalho executado por equipa qualificada, com materiais de qualidade.' },
        { title: 'Visita técnica', text: 'Avaliamos o espaço no local e apresentamos um orçamento detalhado.' },
        { title: 'Projetos à medida', text: 'Adaptamos cada intervenção às suas necessidades e ao seu orçamento.' },
        { title: 'Acompanhamento', text: 'Comunicação clara do início ao fim.' },
        { title: 'Garantia', text: 'Trabalho com garantia por escrito.' },
        { title: 'Manutenção', text: 'Planos de manutenção para manter o resultado.' },
    ]
}
