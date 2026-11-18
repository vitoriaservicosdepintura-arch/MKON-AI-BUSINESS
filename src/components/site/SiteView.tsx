import type { CSSProperties } from 'react'

export type SiteTheme = { primary: string; accent: string; bg: string; text: string }
export type SiteSection = { type: 'services' | 'about' | 'gallery'; title?: string; text?: string; items?: { title: string; text: string }[]; images?: string[] }
export type SiteContent = {
  style?: 'pro' | 'simple'
  brand?: { name?: string; tagline?: string }
  menu?: { label: string; href: string }[]
  hero?: { eyebrow?: string; title?: string; subtitle?: string; cta_label?: string; cta_href?: string; image?: string }
  sections?: SiteSection[]
  contact?: { phone?: string; email?: string; whatsapp?: string; address?: string }
}

const DEFAULT_THEME: SiteTheme = { primary: '#10B981', accent: '#F59E0B', bg: '#0B1020', text: '#F8FAFC' }
const ANCHOR: Record<string, string> = { services: 'servicos', about: 'sobre', gallery: 'trabalhos' }

/** Renderiza um site a partir do conteúdo guardado. Usado na página pública e no preview do editor. */
export function SiteView({ content, theme }: { content: SiteContent; theme?: Partial<SiteTheme> }) {
  const t = { ...DEFAULT_THEME, ...(theme ?? {}) }
  const c = content ?? {}
  const pro = c.style !== 'simple'
  const vars = { '--p': t.primary, '--a': t.accent, '--bg': t.bg, '--tx': t.text } as CSSProperties
  const heroBg = pro
    ? { background: `linear-gradient(120deg, ${t.primary}, ${t.accent}, ${t.primary})`, backgroundSize: '300% 300%', animation: 'mksGradient 12s ease infinite' }
    : { background: t.bg }
  const heroImg = c.hero?.image

  return (
    <div style={{ ...vars, background: t.bg, color: t.text, minHeight: '100%' }} className="font-sans">
      <style>{`
        @keyframes mksGradient { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
        @keyframes mksFadeUp { from { opacity:0; transform: translateY(18px) } to { opacity:1; transform: none } }
        @keyframes mksFloat { 0%,100%{ transform: translateY(0) } 50%{ transform: translateY(-18px) } }
        .mks-fade { animation: mksFadeUp .8s ease both }
        .mks-fade-2 { animation: mksFadeUp .8s .2s ease both }
        .mks-fade-3 { animation: mksFadeUp .8s .4s ease both }
        .mks-blob { position:absolute; border-radius:9999px; filter: blur(40px); opacity:.35; animation: mksFloat 9s ease-in-out infinite }
        .mks-card { transition: transform .25s ease, box-shadow .25s ease }
        .mks-card:hover { transform: translateY(-4px); box-shadow: 0 18px 40px rgba(0,0,0,.25) }
        html { scroll-behavior: smooth }
      `}</style>

      <header style={{ background: pro ? 'rgba(0,0,0,.25)' : t.bg, borderBottom: `1px solid ${t.text}22`, position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(8px)' }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-base font-bold" style={{ color: pro ? t.text : t.primary }}>{c.brand?.name || 'Site'}</p>
            {c.brand?.tagline && <p className="text-[11px] opacity-70">{c.brand.tagline}</p>}
          </div>
          <nav className="flex flex-wrap gap-4 text-sm">
            {(c.menu ?? []).map((m, i) => <a key={i} href={m.href} className="opacity-85 hover:opacity-100">{m.label}</a>)}
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden" style={heroBg}>
        {pro && <span className="mks-blob" style={{ width: 260, height: 260, background: t.accent, top: -60, right: -40 }} />}
        {pro && <span className="mks-blob" style={{ width: 200, height: 200, background: t.text, bottom: -50, left: '10%', animationDelay: '2s' }} />}
        {heroImg && <img src={heroImg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />}
        <div className="relative mx-auto max-w-6xl px-4 py-20 md:py-28">
          {c.hero?.eyebrow && <p className="mks-fade mb-3 text-xs font-semibold uppercase tracking-[0.25em] opacity-90">{c.hero.eyebrow}</p>}
          <h1 className="mks-fade-2 max-w-3xl text-4xl font-extrabold leading-tight md:text-6xl" style={{ color: pro ? '#fff' : t.text }}>{c.hero?.title}</h1>
          {c.hero?.subtitle && <p className="mks-fade-3 mt-5 max-w-2xl text-lg opacity-90" style={{ color: pro ? '#fff' : t.text }}>{c.hero.subtitle}</p>}
          {c.hero?.cta_label && (
            <a href={c.hero.cta_href || '#contacto'} className="mks-fade-3 mt-8 inline-block rounded-xl px-6 py-3 font-semibold shadow-lg transition hover:scale-105"
              style={{ background: pro ? '#fff' : t.primary, color: pro ? t.primary : '#fff' }}>{c.hero.cta_label}</a>
          )}
        </div>
      </section>

      {(c.sections ?? []).map((s, i) => (
        <section key={i} id={ANCHOR[s.type]} className="mx-auto max-w-6xl px-4 py-16">
          {s.title && <h2 className="mb-8 text-2xl font-bold md:text-3xl" style={{ color: pro ? t.primary : t.text }}>{s.title}</h2>}
          {s.type === 'services' && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {(s.items ?? []).map((it, j) => (
                <div key={j} className={`mks-card rounded-2xl border p-6 ${pro ? '' : 'shadow-sm'}`} style={{ borderColor: `${t.text}22`, background: pro ? `${t.text}08` : '#fff' }}>
                  <p className="mb-2 font-semibold" style={{ color: t.accent }}>{it.title}</p>
                  <p className="text-sm leading-relaxed opacity-85">{it.text}</p>
                </div>
              ))}
            </div>
          )}
          {s.type === 'about' && <p className="max-w-3xl text-lg leading-relaxed opacity-90">{s.text}</p>}
          {s.type === 'gallery' && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {(s.images ?? []).length === 0 && <p className="col-span-full text-sm opacity-60">Adicione fotos dos seus trabalhos no editor.</p>}
              {(s.images ?? []).map((src, j) => <img key={j} src={src} alt="" className="mks-card aspect-[4/3] w-full rounded-xl object-cover" />)}
            </div>
          )}
        </section>
      ))}

      <section id="contacto" className="mx-auto max-w-6xl px-4 py-16">
        <div className="rounded-2xl p-8" style={{ background: pro ? `linear-gradient(120deg, ${t.primary}, ${t.accent})` : t.primary, color: '#fff' }}>
          <h2 className="mb-4 text-2xl font-bold">Contacto</h2>
          <div className="grid gap-3 text-sm md:grid-cols-2">
            {c.contact?.phone && <p>Telefone: <a className="underline" href={`tel:${c.contact.phone.replace(/\s/g, '')}`}>{c.contact.phone}</a></p>}
            {c.contact?.email && <p>Email: <a className="underline" href={`mailto:${c.contact.email}`}>{c.contact.email}</a></p>}
            {c.contact?.whatsapp && <p>WhatsApp: <a className="underline" href={`https://wa.me/${c.contact.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">Enviar mensagem</a></p>}
            {c.contact?.address && <p>Zona: {c.contact.address}</p>}
          </div>
        </div>
      </section>

      <footer className="py-8 text-center text-xs opacity-60">© {new Date().getFullYear()} {c.brand?.name || ''}</footer>
    </div>
  )
}
