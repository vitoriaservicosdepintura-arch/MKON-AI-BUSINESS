import type { CSSProperties } from 'react'

export type SiteTheme = { primary: string; accent: string; bg: string; text: string }
export type SiteItem = { title: string; text: string }
export type SiteSectionType = 'services' | 'about' | 'gallery' | 'stats' | 'process' | 'testimonials'
export type SiteSection = { type: SiteSectionType; title?: string; text?: string; items?: SiteItem[]; images?: string[] }
export type SiteContent = {
  style?: 'pro' | 'simple'
  brand?: { name?: string; tagline?: string }
  menu?: { label: string; href: string }[]
  hero?: { eyebrow?: string; title?: string; subtitle?: string; cta_label?: string; cta_href?: string; image?: string }
  sections?: SiteSection[]
  contact?: { phone?: string; email?: string; whatsapp?: string; address?: string }
}

const DEFAULT_THEME: SiteTheme = { primary: '#10B981', accent: '#F59E0B', bg: '#0B1020', text: '#F8FAFC' }
const ANCHOR: Record<SiteSectionType, string> = { services: 'servicos', about: 'sobre', gallery: 'trabalhos', stats: 'numeros', process: 'processo', testimonials: 'testemunhos' }

/** Renderiza um site a partir do conteúdo guardado. Usado na página pública e na pré-visualização do editor. */
export function SiteView({ content, theme }: { content: SiteContent; theme?: Partial<SiteTheme> }) {
  const t = { ...DEFAULT_THEME, ...(theme ?? {}) }
  const c = content ?? {}
  const pro = c.style !== 'simple'
  const fg = pro ? '#FFFFFF' : t.text
  const soft = `${t.text}b3`
  const line = `${t.text}1f`
  const serif = pro ? 'Georgia, "Times New Roman", serif' : undefined
  const vars = { '--p': t.primary, '--a': t.accent, '--bg': t.bg, '--tx': t.text } as CSSProperties
  const heroBg: CSSProperties = pro
    ? { background: `linear-gradient(120deg, ${t.bg} 0%, ${t.bg}ee 45%, ${t.primary}55 100%)` }
    : { background: `linear-gradient(160deg, ${t.primary}14, ${t.bg})` }
  const heroImg = c.hero?.image
  const sections = c.sections ?? []
  const hasSection = (type: SiteSectionType) => sections.some(s => s.type === type)

  return (
    <div style={{ ...vars, background: t.bg, color: t.text, minHeight: '100%', fontFamily: pro ? serif : 'ui-sans-serif, system-ui, sans-serif' }}>
      <style>{`
        @keyframes mksGradient { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
        @keyframes mksFadeUp { from { opacity:0; transform: translateY(18px) } to { opacity:1; transform: none } }
        @keyframes mksFloat { 0%,100%{ transform: translateY(0) } 50%{ transform: translateY(-18px) } }
        @keyframes mksShine { 0%{ background-position:-200% 0 } 100%{ background-position:200% 0 } }
        .mks-fade { animation: mksFadeUp .8s ease both }
        .mks-fade-2 { animation: mksFadeUp .8s .2s ease both }
        .mks-fade-3 { animation: mksFadeUp .8s .4s ease both }
        .mks-blob { position:absolute; border-radius:9999px; filter: blur(50px); opacity:.35; animation: mksFloat 9s ease-in-out infinite; pointer-events:none }
        .mks-card { transition: transform .25s ease, box-shadow .25s ease }
        .mks-card:hover { transform: translateY(-4px); box-shadow: 0 18px 40px rgba(0,0,0,.25) }
        .mks-btn { transition: transform .2s ease, filter .2s ease }
        .mks-btn:hover { transform: translateY(-2px); filter: brightness(1.08) }
        .mks-shine { background-size: 200% 100%; animation: mksShine 6s linear infinite }
        html { scroll-behavior: smooth }
      `}</style>

      <header style={{ background: pro ? `${t.bg}f2` : `${t.bg}ee`, borderBottom: `1px solid ${line}`, position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(10px)' }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <p className="text-lg font-bold tracking-wide" style={{ color: pro ? t.accent : t.primary }}>{c.brand?.name || 'Site'}</p>
            {c.brand?.tagline && <p className="text-[11px] tracking-wider" style={{ color: soft }}>{c.brand.tagline}</p>}
          </div>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            {(c.menu ?? []).map((m, i) => <a key={i} href={m.href} className="transition hover:opacity-70" style={{ color: fg }}>{m.label}</a>)}
            {c.contact?.phone && <a href={`tel:${c.contact.phone.replace(/\s/g, '')}`} className="rounded-full px-4 py-1.5 text-xs font-semibold" style={{ background: pro ? t.accent : t.primary, color: pro ? t.bg : '#fff' }}>Ligar</a>}
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden" style={heroBg}>
        {pro && <span className="mks-blob" style={{ width: 300, height: 300, background: t.accent, top: -80, right: -60 }} />}
        {pro && <span className="mks-blob" style={{ width: 220, height: 220, background: t.primary, bottom: -60, left: '8%', animationDelay: '2s' }} />}
        {heroImg && <img src={heroImg} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ opacity: pro ? 0.35 : 0.9 }} />}
        {heroImg && <div className="absolute inset-0" style={{ background: pro ? `linear-gradient(90deg, ${t.bg} 10%, ${t.bg}66 80%)` : `linear-gradient(90deg, ${t.bg} 30%, ${t.bg}55 100%)` }} />}
        <div className="relative mx-auto max-w-6xl px-5 py-24 md:py-36">
          {c.hero?.eyebrow && <p className="mks-fade mb-4 text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: pro ? t.accent : t.primary }}>{c.hero.eyebrow}</p>}
          <h1 className="mks-fade-2 max-w-3xl text-4xl font-bold leading-tight md:text-6xl" style={{ color: fg, fontFamily: serif }}>{c.hero?.title}</h1>
          {c.hero?.subtitle && <p className="mks-fade-3 mt-6 max-w-2xl text-lg leading-relaxed" style={{ color: soft }}>{c.hero.subtitle}</p>}
          <div className="mks-fade-3 mt-10 flex flex-wrap gap-3">
            {c.hero?.cta_label && (
              <a href={c.hero.cta_href || '#contacto'} className={`mks-btn rounded-xl px-7 py-3.5 font-semibold shadow-lg ${pro ? 'mks-shine' : ''}`}
                style={{ background: pro ? `linear-gradient(90deg, ${t.accent}, ${t.primary}, ${t.accent})`: t.primary, color: pro ? t.bg : '#fff' }}>{c.hero.cta_label}</a>
            )}
            {hasSection('services') && <a href="#servicos" className="rounded-xl border px-7 py-3.5 font-semibold transition hover:opacity-70" style={{ borderColor: `${fg}55`, color: fg }}>Ver serviços</a>}
          </div>
        </div>
      </section>

      {sections.map((s, i) => (
        <section key={i} id={ANCHOR[s.type]} className="mx-auto max-w-6xl px-5 py-20">
          {s.title && (
            <div className="mb-12 text-center">
              {pro && <div className="mx-auto mb-4 h-px w-16" style={{ background: t.accent }} />}
              <h2 className="text-3xl font-bold md:text-4xl" style={{ color: pro ? t.accent : t.text, fontFamily: serif }}>{s.title}</h2>
            </div>
          )}

          {s.type === 'services' && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {(s.items ?? []).map((it, j) => (
                <div key={j} className="mks-card rounded-2xl border p-7" style={{ borderColor: line, background: pro ? `${t.text}08` : '#fff', boxShadow: pro ? 'none' : '0 4px 20px rgba(15,23,42,.06)' }}>
                  <p className="mb-3 text-xs font-semibold tracking-[0.2em]" style={{ color: t.accent }}>{String(j + 1).padStart(2, '0')}</p>
                  <p className="mb-2 text-lg font-semibold" style={{ color: fg }}>{it.title}</p>
                  <p className="text-sm leading-relaxed" style={{ color: soft }}>{it.text}</p>
                </div>
              ))}
            </div>
          )}

          {s.type === 'about' && <p className="mx-auto max-w-3xl text-center text-lg leading-relaxed" style={{ color: soft }}>{s.text}</p>}

          {s.type === 'stats' && (
            <div className="grid grid-cols-2 gap-8 text-center md:grid-cols-4">
              {(s.items ?? []).map((it, j) => (
                <div key={j}>
                  <p className="text-4xl font-bold md:text-5xl" style={{ color: pro ? t.accent : t.primary, fontFamily: serif }}>{it.title}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.2em]" style={{ color: soft }}>{it.text}</p>
                </div>
              ))}
            </div>
          )}

          {s.type === 'process' && (
            <ol className="grid gap-8 md:grid-cols-3">
              {(s.items ?? []).map((it, j) => (
                <li key={j} className="relative pl-16">
                  <span className="absolute left-0 top-0 flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold" style={{ background: pro ? t.accent : t.primary, color: pro ? t.bg : '#fff' }}>{j + 1}</span>
                  <p className="mb-1 font-semibold" style={{ color: fg }}>{it.title}</p>
                  <p className="text-sm leading-relaxed" style={{ color: soft }}>{it.text}</p>
                </li>
              ))}
            </ol>
          )}

          {s.type === 'testimonials' && (
            <div className="grid gap-6 md:grid-cols-3">
              {(s.items ?? []).map((it, j) => (
                <figure key={j} className="mks-card rounded-2xl border p-7" style={{ borderColor: line, background: pro ? `${t.text}08` : '#fff' }}>
                  <p className="mb-4 text-3xl leading-none" style={{ color: t.accent }}>“</p>
                  <blockquote className="mb-5 text-sm leading-relaxed" style={{ color: soft }}>{it.text}</blockquote>
                  <figcaption className="text-sm font-semibold" style={{ color: fg }}>{it.title}</figcaption>
                </figure>
              ))}
            </div>
          )}

          {s.type === 'gallery' && (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {(s.images ?? []).length === 0 && <p className="col-span-full text-center text-sm" style={{ color: soft }}>Fotos dos trabalhos em breve.</p>}
              {(s.images ?? []).map((src, j) => <img key={j} src={src} alt="" loading="lazy" className="mks-card aspect-[4/3] w-full rounded-xl object-cover" />)}
            </div>
          )}
        </section>
      ))}

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="relative overflow-hidden rounded-3xl px-8 py-14 text-center" style={{ background: pro ? `linear-gradient(120deg, ${t.primary}, ${t.accent})` : t.primary, color: '#fff' }}>
          <h2 className="text-3xl font-bold md:text-4xl" style={{ fontFamily: serif }}>Pronto para começar?</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm opacity-90">Peça um orçamento sem compromisso. Respondemos no mesmo dia.</p>
          <a href="#contacto" className="mks-btn mt-7 inline-block rounded-xl bg-white px-7 py-3 font-semibold" style={{ color: t.primary }}>Pedir orçamento</a>
        </div>
      </section>

      <section id="contacto" className="mx-auto max-w-6xl px-5 pb-20">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="mb-4 text-3xl font-bold md:text-4xl" style={{ color: pro ? t.accent : t.text, fontFamily: serif }}>Contacto</h2>
            <p className="mb-8 text-sm leading-relaxed" style={{ color: soft }}>Fale connosco por telefone, email ou WhatsApp. Estamos disponíveis para visitas técnicas e orçamentos.</p>
            <div className="space-y-4 text-sm">
              {c.contact?.phone && <p><span className="block text-[11px] uppercase tracking-[0.2em]" style={{ color: t.accent }}>Telefone</span><a className="text-base font-semibold" href={`tel:${c.contact.phone.replace(/\s/g, '')}`}>{c.contact.phone}</a></p>}
              {c.contact?.email && <p><span className="block text-[11px] uppercase tracking-[0.2em]" style={{ color: t.accent }}>Email</span><a className="text-base font-semibold" href={`mailto:${c.contact.email}`}>{c.contact.email}</a></p>}
              {c.contact?.address && <p><span className="block text-[11px] uppercase tracking-[0.2em]" style={{ color: t.accent }}>Zona de atuação</span>{c.contact.address}</p>}
            </div>
          </div>
          <div className="flex flex-col justify-center gap-3 rounded-2xl border p-8" style={{ borderColor: line, background: pro ? `${t.text}08` : '#fff' }}>
            {c.contact?.whatsapp && <a href={`https://wa.me/${c.contact.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="mks-btn rounded-xl px-6 py-4 text-center font-semibold text-white" style={{ background: '#25D366' }}>Falar no WhatsApp</a>}
            {c.contact?.email && <a href={`mailto:${c.contact.email}`} className="mks-btn rounded-xl border px-6 py-4 text-center font-semibold" style={{ borderColor: line, color: fg }}>Enviar email</a>}
            {c.contact?.phone && <a href={`tel:${c.contact.phone.replace(/\s/g, '')}`} className="mks-btn rounded-xl border px-6 py-4 text-center font-semibold" style={{ borderColor: line, color: fg }}>Ligar agora</a>}
          </div>
        </div>
      </section>

      <footer className="border-t px-5 py-8 text-center text-xs" style={{ borderColor: line, color: soft }}>
        © {new Date().getFullYear()} {c.brand?.name || ''}{c.contact?.address ? ` · ${c.contact.address}` : ''}
      </footer>
    </div>
  )
}
