import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { SiteView, type SiteContent, type SiteTheme } from '@/components/site/SiteView'

type Loaded = { title: string; content: SiteContent; theme: Partial<SiteTheme> } | null

/** Página pública de um site: https://mkonaibusiness.vercel.app/<slug> */
export default function PublicSite() {
  const { slug = '' } = useParams()
  const [site, setSite] = useState<Loaded | undefined>(undefined)

  useEffect(() => {
    let alive = true
    supabase.rpc('public_site', { p_slug: slug }).then(({ data, error }) => {
      if (!alive) return
      if (error || !data) return setSite(null)
      setSite(data as Loaded)
    })
    return () => { alive = false }
  }, [slug])

  useEffect(() => { if (site) document.title = site.title }, [site])

  if (site === undefined) return <div className="flex min-h-screen items-center justify-center bg-[#0B1020] text-sm text-white/50">A carregar…</div>
  if (site === null) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-[#0B1020] p-6 text-center text-white">
      <p className="text-xl font-semibold">Site não encontrado</p>
      <p className="text-sm text-white/50">Verifique o endereço ou tente mais tarde.</p>
    </div>
  )
  return <SiteView content={site.content} theme={site.theme} />
}
