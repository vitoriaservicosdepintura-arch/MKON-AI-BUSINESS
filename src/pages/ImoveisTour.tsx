import { Building2, Camera, Check, Globe, Smartphone, Sparkles } from 'lucide-react'
import { Badge, Card, CardHeader, PageHeader } from '@/components/ui'

// Preencha antes de publicar: é para onde vai o pedido de demonstração.
const CONTACT_EMAIL = ''

const STEPS = [
  { icon: Camera, title: 'Envia as fotos', text: 'Fotos de cada divisão, interior e exterior. Não precisa de equipamento especial.' },
  { icon: Sparkles, title: 'A IA organiza', text: 'A IA sugere a ordem da visita e escreve uma legenda de anúncio para cada divisão.' },
  { icon: Globe, title: 'Publica o link', text: 'Recebe um endereço próprio para o anúncio, pronto a partilhar com o comprador.' },
]

const FEATURES = [
  'Tour em primeira pessoa, com setas no PC e botões no telemóvel',
  'Modo tour guiado: a câmara percorre a casa em cerca de 90 segundos',
  'Legenda de uma linha por cômodo, escrita como anúncio',
  'Minimapa com a posição de quem visita',
  'Link próprio para cada imóvel, sem instalar nada',
]

export default function ImoveisTour() {
  const mailto = CONTACT_EMAIL
    ? `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Pedido de demonstração: tour 3D para corretores')}`
    : undefined

  return (
    <>
      <PageHeader title="Imóveis tour 3D" description="Tour virtual 3D de imóveis a partir das fotos, para vender a corretores." />

      <Card className="mb-5 p-6 sm:p-8">
        <Badge tone="neutral">Para corretores de imóveis</Badge>
        <h2 className="mt-3 text-2xl font-semibold leading-tight sm:text-3xl">Mostre o imóvel inteiro antes da primeira visita</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/65">
          Com as fotos do imóvel, criamos um tour 3D que o comprador percorre no navegador, do sofá ou do telemóvel.
          Mais contactos qualificados, menos visitas perdidas e um anúncio que se destaca.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {mailto
            ? <a href={mailto} className="inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-white">Pedir demonstração</a>
            : <span className="inline-flex h-10 items-center rounded-lg bg-white/10 px-4 text-sm text-white/50">Pedido de demonstração em breve</span>}
        </div>
      </Card>

      <Card className="mb-5">
        <CardHeader title="Como funciona" />
        <div className="grid gap-3 p-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="rounded-xl border border-white/[0.07] p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/15 text-brand-soft"><s.icon className="h-4 w-4" /></div>
              <p className="mt-3 text-sm font-semibold">{i + 1}. {s.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-white/55">{s.text}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mb-5">
        <CardHeader title="O que o comprador recebe" />
        <ul className="grid gap-2 p-5 sm:grid-cols-2">
          {FEATURES.map(f => (
            <li key={f} className="flex items-start gap-2 text-sm text-white/75"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />{f}</li>
          ))}
        </ul>
        <div className="flex items-center gap-2 border-t border-white/[0.06] px-5 py-3 text-xs text-white/45">
          <Smartphone className="h-3.5 w-3.5" /> Funciona em telemóvel e computador.
          <Building2 className="ml-2 h-3.5 w-3.5" /> Preço por definir.
        </div>
      </Card>
    </>
  )
}
