# MKON AI BUSINESS

> Inteligência que encontra oportunidades. Tecnologia que transforma oportunidades em negócios.

Sistema **privado** de inteligência comercial, prospecção, vendas e gestão. Uso exclusivo do proprietário: sem registo público, sem planos, sem multi-utilizador.

**Stack:** React 18 · TypeScript · Vite · Tailwind CSS · Lucide · Recharts · Supabase (PostgreSQL, Auth, RLS).

---

## Estado atual — Etapa 1 concluída

| Módulo | Estado |
|---|---|
| Base de dados (31 tabelas, RLS, auditoria, regras de negócio) | ✅ Completa, testada |
| Autenticação e área protegida (proprietário único) | ✅ |
| Layout: sidebar glass retrátil, cabeçalho, paleta de comandos (Ctrl/Cmd+K) | ✅ |
| Dashboard (14 KPIs, 7 gráficos, atividades, alertas, oportunidades) | ✅ dados reais; vazio = estado vazio, nunca números inventados |
| CRM (Kanban com arrastar, Tabela com filtros/paginação, Lista, Calendário) | ✅ |
| Administração (integrações, agentes, modos de automação, logs, backup/restauro, RGPD, definições) | ✅ |
| Botão global de emergência | ✅ (aplicado também na base de dados) |
| Prospecção + IA (Etapa 2) · Agentes, mensagens, propostas (3) · Websites e projetos (4) · NFC (5) · Financeiro, relatórios (6) | ⏳ Esquema pronto; interface nas etapas seguintes |

Páginas ainda não implementadas mostram claramente "Módulo previsto para a Etapa N" — não há botões decorativos nem dados simulados.

---

## Instalação

### 1. Supabase
1. Crie um projeto em <https://supabase.com>.
2. **Authentication → Providers → Email:** desative **"Allow new users to sign up"** (sistema privado).
3. **SQL Editor:** execute por ordem
   - `supabase/migrations/0001_schema.sql`
   - `supabase/migrations/0002_rls.sql`
   - `supabase/migrations/0003_seed_reference.sql`
4. **Authentication → Users → Add user:** crie o seu utilizador (email + palavra-passe).
   O primeiro utilizador torna-se automaticamente o **proprietário**; qualquer outro é rejeitado pela base de dados.
   > Se desativou o registo *antes* de criar o utilizador, use "Add user" no painel (não é afetado).
5. Ative os backups diários do projeto (Project Settings → Database → Backups).

### 2. Aplicação
```bash
cp .env.example .env     # preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm install
npm run dev              # http://localhost:5173
npm run build            # produção (pasta dist/)
```

---

## Segurança

- **RLS ativo em todas as tabelas**; só `administrators` com `role = 'owner'` acede (`is_owner()`).
- O frontend só tem a chave **anon**. **Nenhum segredo** (OpenAI, Google Places, WhatsApp, email) fica no navegador: serão usados como *secrets* de Edge Functions (`supabase secrets set ...`).
- Logs de auditoria por *triggers* nas tabelas críticas; os logs não são editáveis.
- Integridade financeira: despesas/transações **pagas são imutáveis**; total da proposta é calculado pelos itens; propostas não contam como vendas.
- RGPD: consentimento e oposição por contacto (oposição não pode ser revertida sem novo registo), exportação e eliminação de dados na Administração, `nfc_interactions` sem IP nem identificadores pessoais.
- Envio de mensagens exige aprovação registada; o **botão de emergência** bloqueia envios ao nível da base de dados.
- Links NFC só aceitam `https://` e redirecionam para o endereço oficial de avaliação (função `nfc_redirect`).

## Estrutura
```
supabase/migrations/   0001 esquema · 0002 RLS e proprietário · 0003 dados de referência
src/lib/               supabase, auth, nav, constantes, utilitários, log
src/components/        layout (Sidebar, Header, AppShell) e ui (Button, Card, Modal, Toast…)
src/pages/             Login, Dashboard, Crm, Admin, ModulePending
```

## Notas
- Os produtos iniciais têm preço 0 € — defina os seus preços.
- A taxa de imposto estimada (23 %) é apenas indicativa; valide com o seu contabilista.
- Tarefas de IA falhadas usam o estado `cancelada` do enum `task_status`.
