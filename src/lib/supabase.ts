import { createClient } from '@supabase/supabase-js'

const readEnv = (value: string | undefined) => value?.trim() ?? ''
const hasPlaceholderValue = (value: string) => {
  const normalized = value.toLowerCase().replace(/\s+/g, '')
  return normalized === '' || normalized === 'seu-projeto' || normalized === 'sua_anon_key' || normalized.includes('seu-projeto.supabase.co') || normalized.includes('suaanonkey') || normalized.includes('not-configured')
}

const url = readEnv(import.meta.env.VITE_SUPABASE_URL)
const anonKey = readEnv(import.meta.env.VITE_SUPABASE_ANON_KEY)

export const isConfigured = Boolean(url && anonKey && !hasPlaceholderValue(url) && !hasPlaceholderValue(anonKey))

// Apenas a chave pública (anon) existe no frontend. A segurança vem do RLS.
export const supabase = createClient(isConfigured ? url : 'http://localhost:54321', isConfigured ? anonKey : 'not-configured', {
  auth: { persistSession: true, autoRefreshToken: true },
})
