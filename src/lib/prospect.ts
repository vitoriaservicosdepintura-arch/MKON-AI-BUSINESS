import { supabase } from './supabase'

/** Origens criadas pela pesquisa no mapa (mkon-prospect). */
export const PROSPECT_SOURCES = ['serpapi_maps', 'google_places']

export type ProspectCompany = {
    id: string; name: string; city: string | null; website: string | null; phone: string | null; identified_at: string
}

/** Empresas vindas da prospecção que ainda não foram limpas. */
export async function loadProspectCompanies(limit = 50): Promise<ProspectCompany[]> {
    const { data, error } = await supabase
        .from('companies')
        .select('id,name,city,website,phone,identified_at, lead_sources!inner(code)')
        .in('lead_sources.code', PROSPECT_SOURCES)
        .eq('prospect_dismissed', false)
        .order('identified_at', { ascending: false })
        .limit(limit)
    if (error) throw new Error(error.message)
    return (data ?? []) as unknown as ProspectCompany[]
}

/** Limpa uma empresa da lista de prospecção (não apaga nada do CRM). */
export async function dismissProspect(id: string) {
    const { error } = await supabase.from('companies').update({ prospect_dismissed: true }).eq('id', id)
    if (error) throw new Error(error.message)
}

/** Limpa todas as empresas da lista de prospecção (não apaga nada do CRM). */
export async function dismissAllProspects(ids: string[]) {
    if (ids.length === 0) return
    const { error } = await supabase.from('companies').update({ prospect_dismissed: true }).in('id', ids)
    if (error) throw new Error(error.message)
}

/** Limpa da lista todas as empresas vindas da prospecção (não apaga nada do CRM). */
export async function dismissAllProspectSources(): Promise<number> {
    const { data: sources, error: sErr } = await supabase.from('lead_sources').select('id').in('code', PROSPECT_SOURCES)
    if (sErr) throw new Error(sErr.message)
    const ids = (sources ?? []).map((s) => s.id)
    if (ids.length === 0) return 0
    const { data, error } = await supabase.from('companies').update({ prospect_dismissed: true }).in('source_id', ids).eq('prospect_dismissed', false).select('id')
    if (error) throw new Error(error.message)
    return data?.length ?? 0
}
