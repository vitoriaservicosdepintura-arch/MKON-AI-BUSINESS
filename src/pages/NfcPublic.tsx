import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ExternalLink, Globe, MessageCircle, Star } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Page = { company: string | null; message: string | null; review_url: string; website: string | null; whatsapp: string | null; logo: string | null }

const https = (u: string | null | undefined) => (u && /^https:\/\//.test(u) ? u : null)

/** Página pública da plaquinha NFC (/r/{slug}). Não exige login e não mostra dados internos. */
export default function NfcPublic() {
  const { slug = '' } = useParams()
  const [params] = useSearchParams()
  const [page, setPage] = useState<Page | null | undefined>(undefined)

  useEffect(() => {
    let alive = true
    const device = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
    supabase.rpc('nfc_public_page', { p_slug: slug, p_source: params.get('src') === 'qr' ? 'qr' : 'nfc', p_device_type: device })
      .then(({ data, error }) => { if (alive) setPage(error ? null : ((data as Page | null) ?? null)) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  if (page === undefined) return <div className="flex min-h-screen items-center justify-center text-sm text-white/40">A carregar…</div>
  if (page === null) return <div className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-white/50">Esta página não está disponível.</div>

  const wa = page.whatsapp ? `https://wa.me/${page.whatsapp}` : null
  const web = https(page.website)
  const btn = 'flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3.5 text-sm font-medium hover:border-emerald-400/50 hover:bg-emerald-400/10'

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        {page.logo && https(page.logo) && <img src={page.logo} alt={page.company ?? ''} className="mx-auto h-20 object-contain" />}
        {page.company && <h1 className="text-2xl font-semibold">{page.company}</h1>}
        {page.message && <p className="text-sm text-white/60">{page.message}</p>}
        <div className="space-y-3">
          <a href={https(page.review_url) ?? '#'} target="_blank" rel="noreferrer noopener" className={btn}><Star className="h-4 w-4 text-emerald-400" /> Deixar avaliação no Google</a>
          {wa && <a href={wa} target="_blank" rel="noreferrer noopener" className={btn}><MessageCircle className="h-4 w-4 text-emerald-400" /> Falar no WhatsApp</a>}
          {web && <a href={web} target="_blank" rel="noreferrer noopener" className={btn}><Globe className="h-4 w-4 text-emerald-400" /> Visitar website</a>}
        </div>
        <p className="flex items-center justify-center gap-1 text-[11px] text-white/25"><ExternalLink className="h-3 w-3" /> MKON Digital</p>
      </div>
    </div>
  )
}
