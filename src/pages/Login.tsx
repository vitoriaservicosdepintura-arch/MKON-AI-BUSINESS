import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { DatabaseZap, FlaskConical, Lock } from 'lucide-react'
import { supabase, isConfigured } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { Button, Field } from '@/components/ui'
import { Logo } from '@/components/layout/Sidebar'
import { enterDemo } from '@/lib/demo'

export default function Login() {
  const { session, loading, isDemo } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!loading && (session || isDemo)) return <Navigate to="/" replace />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError('Credenciais inválidas ou conta ainda não registada como proprietário. Use o modo demonstração para continuar.')
      }
    } catch {
      setError('Não foi possível iniciar sessão. Tente novamente ou use o modo demonstração.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="card p-6">
          <div className="mb-5 flex items-center gap-2 text-sm font-semibold"><Lock className="h-4 w-4 text-brand" /> Acesso privado</div>

          {!isConfigured ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-xs leading-relaxed text-amber-100/90">
                <div className="mb-1.5 flex items-center gap-1.5 font-semibold"><DatabaseZap className="h-4 w-4" /> Aguardando configuração</div>
                Defina <code className="font-mono">VITE_SUPABASE_URL</code> e <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> no ficheiro <code className="font-mono">.env</code> e reinicie. Consulte o README.
              </div>
              <div className="relative flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-[11px] text-white/30">ou</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>
              <button
                onClick={enterDemo}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-brand/30 bg-brand/10 py-2.5 text-sm font-medium text-brand-soft transition hover:bg-brand/20"
              >
                <FlaskConical className="h-4 w-4" />
                Explorar em modo demonstração
              </button>
              <p className="text-center text-[10px] leading-relaxed text-white/25">
                Dados 100% fictícios · sem ligação à base de dados · apenas para visualização
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <form onSubmit={submit} className="space-y-4">
                <Field label="Email"><input className="input" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
                <Field label="Palavra-passe"><input className="input" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
                {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
                <Button type="submit" loading={busy} className="w-full">Entrar</Button>
              </form>

              <div className="relative flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-[11px] text-white/30">ou</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <button
                onClick={enterDemo}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 py-2.5 text-sm text-white/50 transition hover:border-brand/30 hover:text-brand-soft"
              >
                <FlaskConical className="h-4 w-4" />
                Modo demonstração (dados fictícios)
              </button>
            </div>
          )}
        </div>
        <p className="mt-6 text-center text-[11px] leading-relaxed text-white/30">
          Inteligência que encontra oportunidades.<br />Tecnologia que transforma oportunidades em negócios.
        </p>
      </div>
    </div>
  )
}
