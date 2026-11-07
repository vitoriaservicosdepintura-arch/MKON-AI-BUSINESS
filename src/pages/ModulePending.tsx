import { useLocation, useNavigate } from 'react-router-dom'
import { Hammer } from 'lucide-react'
import { NAV } from '@/lib/nav'
import { Button, Card, EmptyState, PageHeader } from '@/components/ui'

const STAGE_SCOPE: Record<number, string> = {
  2: 'Prospecção, pesquisa de empresas, análise de oportunidades e IA',
  3: 'Agentes comerciais, central de mensagens, atendimento e propostas',
  4: 'Gerador de websites, templates e gestão de produção',
  5: 'NFC, produtos, encomendas e fornecedores',
  6: 'Financeiro, relatórios, integrações e automações',
}

/** Módulo ainda não implementado. O esquema da base de dados já está pronto; a interface chega na etapa indicada. */
export default function ModulePending() {
  const { pathname } = useLocation()
  const nav = useNavigate()
  const item = NAV.find((n) => n.to === pathname)
  if (!item) return null
  return (
    <>
      <PageHeader title={item.label} description={item.description} />
      <Card>
        <EmptyState
          icon={<Hammer className="h-5 w-5" />}
          title={`Módulo previsto para a Etapa ${item.stage}`}
          description={`${STAGE_SCOPE[item.stage]}. As tabelas e regras de segurança deste módulo já existem na base de dados.`}
          action={<Button variant="outline" onClick={() => nav('/')}>Voltar ao dashboard</Button>}
        />
      </Card>
    </>
  )
}
