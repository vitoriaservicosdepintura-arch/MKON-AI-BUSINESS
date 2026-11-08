import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/lib/auth'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { AppShell } from '@/components/layout/AppShell'
import { Skeleton } from '@/components/ui'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Crm from '@/pages/Crm'
import Admin from '@/pages/Admin'
import Prospeccao from '@/pages/Prospeccao'
import Agentes from '@/pages/Agentes'
import Mensagens from '@/pages/Mensagens'
import Websites from '@/pages/Websites'
import Propostas from '@/pages/Propostas'
import Reunioes from '@/pages/Reunioes'
import NfcPage from '@/pages/Nfc'
import Projetos from '@/pages/Projetos'
import Financeiro from '@/pages/Financeiro'
import Relatorios from '@/pages/Relatorios'
import LojaGifsLayout from '@/pages/loja-gifs/Layout'
import LojaGifsDashboard from '@/pages/loja-gifs/Dashboard'
import LojaGifsCategorias from '@/pages/loja-gifs/Categorias'
import LojaGifsProdutos from '@/pages/loja-gifs/Produtos'
import LojaGifsPersonalizacoes from '@/pages/loja-gifs/Personalizacoes'
import LojaGifsPedidos from '@/pages/loja-gifs/Pedidos'
import LojaGifsClientes from '@/pages/loja-gifs/Clientes'
import LojaGifsPromocoes from '@/pages/loja-gifs/Promocoes'
import LojaGifsEstoque from '@/pages/loja-gifs/Estoque'
import LojaGifsFinanceiro from '@/pages/loja-gifs/Financeiro'
import LojaGifsRelatorios from '@/pages/loja-gifs/Relatorios'
import LojaGifsConfiguracoes from '@/pages/loja-gifs/Configuracoes'
import { activateApiKeyFromUrl } from '@/lib/apikeys'
import { UiPrefsProvider } from '@/lib/ui-prefs'

function UrlKeyActivator() {
  const toast = useToast()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true

    async function run() {
      const candidate = await activateApiKeyFromUrl()
      if (!active) return

      if (candidate) {
        const providerLabels: Record<string, string> = {
          groq: 'Groq',
          gemini: 'Gemini',
          openai: 'OpenAI',
          anthropic: 'Anthropic',
          universal: 'Chave Universal'
        }
        const label = providerLabels[candidate.provider] || 'Chave de IA'
        toast.push('success', `${label} ativada e pronta para uso em todos os módulos.`)
      }

      setReady(true)
    }

    run()
    return () => { active = false }
  }, [toast])

  return ready ? null : <div className="hidden" />
}

function Protected() {
  const { session, admin, loading, signOut, isDemo } = useAuth()
  if (loading) return <div className="p-8"><Skeleton className="h-8 w-48" /></div>
  if (!isDemo && !session) return <Navigate to="/login" replace />
  if (!admin) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm font-medium">Acesso não autorizado.</p>
        <p className="max-w-md text-xs leading-relaxed text-white/45">
          {session
            ? 'A sua conta está autenticada, mas ainda não está registada como proprietário no sistema. Execute o script de correção em Supabase e depois volte a iniciar sessão.'
            : 'Este sistema é privado e exclusivo do proprietário.'}
        </p>
        <p className="max-w-lg rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] leading-relaxed text-amber-100/90">
          SQL no Supabase: <span className="font-mono text-[10px]">INSERT INTO administrators (id, full_name, email, role) SELECT u.id, COALESCE(u.raw_user_meta_data-&gt;'full_name', SPLIT_PART(u.email, '@', 1)), u.email, 'owner' FROM auth.users u WHERE u.email = 'SEU_EMAIL@DOMINIO.com' ON CONFLICT (id) DO NOTHING;</span>
        </p>
        {session && (
          <button onClick={() => signOut()} className="text-xs text-brand-soft hover:underline">Terminar sessão</button>
        )}
      </div>
    )
  }
  return <AppShell />
}

export default function App() {
  return (
    <UiPrefsProvider>
    <ToastProvider>
      <UrlKeyActivator />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<Protected />}>
              <Route index element={<Dashboard />} />
              <Route path="crm" element={<Crm />} />
              <Route path="admin" element={<Admin />} />
              <Route path="prospeccao" element={<Prospeccao />} />
              <Route path="agentes" element={<Agentes />} />
              <Route path="mensagens" element={<Mensagens />} />
              <Route path="websites" element={<Websites />} />
              <Route path="reunioes" element={<Reunioes />} />
              <Route path="propostas" element={<Propostas />} />
              <Route path="nfc" element={<NfcPage />} />
              <Route path="projetos" element={<Projetos />} />
              <Route path="financeiro" element={<Financeiro />} />
              <Route path="relatorios" element={<Relatorios />} />
              <Route path="loja-gifs" element={<LojaGifsLayout />}>
                <Route index element={<LojaGifsDashboard />} />
                <Route path="categorias" element={<LojaGifsCategorias />} />
                <Route path="produtos" element={<LojaGifsProdutos />} />
                <Route path="personalizacoes" element={<LojaGifsPersonalizacoes />} />
                <Route path="pedidos" element={<LojaGifsPedidos />} />
                <Route path="clientes" element={<LojaGifsClientes />} />
                <Route path="promocoes" element={<LojaGifsPromocoes />} />
                <Route path="estoque" element={<LojaGifsEstoque />} />
                <Route path="financeiro" element={<LojaGifsFinanceiro />} />
                <Route path="relatorios" element={<LojaGifsRelatorios />} />
                <Route path="configuracoes" element={<LojaGifsConfiguracoes />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
    </UiPrefsProvider>
  )
}
