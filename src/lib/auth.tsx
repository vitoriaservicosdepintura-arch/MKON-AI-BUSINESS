import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, isConfigured } from './supabase'
import { isDemoActive, DEMO } from './demo'

type Admin = { id: string; full_name: string; email: string }
type AuthState = {
  session: Session | null
  admin: Admin | null
  loading: boolean
  isDemo: boolean
  signOut: () => Promise<void>
}
const Ctx = createContext<AuthState>({ session: null, admin: null, loading: true, isDemo: false, signOut: async () => { } })
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [loading, setLoading] = useState(true)
  const demo = isDemoActive()

  useEffect(() => {
    if (demo) {
      // Em modo demo: simular sessão com dados fictícios
      setAdmin(DEMO.admin)
      setLoading(false)
      return
    }
    if (!isConfigured) { setLoading(false); return }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) {
        setAdmin(null)
        setLoading(false)
      }
    }).catch(() => {
      setAdmin(null)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (!s) {
        setAdmin(null)
        setLoading(false)
      }
    })

    return () => sub.subscription.unsubscribe()
  }, [demo])

  useEffect(() => {
    if (demo || !session) return

    void (async () => {
      try {
        const { data, error } = await supabase.from('administrators').select('id, full_name, email').eq('id', session.user.id).maybeSingle()
        if (error) {
          setAdmin(null)
        } else {
          setAdmin((data as Admin | null) ?? null)
        }
      } catch {
        setAdmin(null)
      } finally {
        setLoading(false)
      }
    })()
  }, [session, demo])

  const signOut = async () => {
    if (demo) { const { exitDemo } = await import('./demo'); exitDemo(); return }
    await supabase.auth.signOut()
  }

  return <Ctx.Provider value={{ session, admin, loading, isDemo: demo, signOut }}>{children}</Ctx.Provider>
}
