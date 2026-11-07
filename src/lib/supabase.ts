import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && anonKey)

// Apenas a chave pública (anon) existe no frontend. A segurança vem do RLS.
export const supabase = createClient(url ?? 'http://localhost:54321', anonKey ?? 'not-configured', {
  auth: { persistSession: true, autoRefreshToken: true },
})
