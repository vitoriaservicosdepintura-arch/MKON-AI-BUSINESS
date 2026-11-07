-- =====================================================================
-- MKON AI BUSINESS — Esquema principal (PostgreSQL / Supabase)
-- Sistema privado de utilizador único (proprietário/administrador).
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------
-- Tipos enumerados
-- ---------------------------------------------------------------------
create type lead_stage as enum (
  'novo_lead','analisado','qualificado','contacto_preparado','contactado',
  'interessado','demonstracao_criada','proposta_enviada','negociacao',
  'venda_fechada','producao','entregue','perdido'
);
create type opportunity_level as enum ('excelente','elevada','moderada','baixa');
create type automation_mode as enum ('manual','supervisionado','automatico');
create type channel_type as enum ('email','whatsapp','formulario','telefone','outro');
create type message_direction as enum ('entrada','saida');
create type message_status as enum ('rascunho','aguarda_aprovacao','agendada','enviada','falhou','recebida');
create type proposal_status as enum ('rascunho','enviada','aprovada','recusada','expirada');
create type project_stage as enum (
  'aguardando_materiais','planeamento','desenvolvimento','revisao','aprovacao','publicacao','entregue'
);
create type task_status as enum ('pendente','em_curso','concluida','cancelada');
create type transaction_type as enum ('receita','despesa');
create type payment_status as enum ('pendente','pago','atrasado','cancelado');
create type integration_status as enum ('aguardando_configuracao','configurada','conectada','erro','desativada');
create type agent_status as enum ('inativo','ativo','pausado','erro');
create type product_category as enum ('website','landing_page','manutencao','seo','nfc','servico_adicional','pacote');
create type notification_level as enum ('info','sucesso','aviso','critico');

-- ---------------------------------------------------------------------
-- Funções utilitárias
-- ---------------------------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Administração
-- ---------------------------------------------------------------------
create table administrators (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role text not null default 'owner' check (role in ('owner')),
  avatar_url text,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table system_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references administrators(id)
);

create table integrations (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique,          -- google_places, openai, whatsapp, email, n8n, ...
  name text not null,
  description text,
  status integration_status not null default 'aguardando_configuracao',
  config jsonb not null default '{}'::jsonb,   -- apenas metadados NÃO secretos
  secret_ref text,                              -- referência ao segredo no backend (nunca o valor)
  monthly_limit numeric(12,2),
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table activity_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references administrators(id) on delete set null,
  action text not null,                  -- ex.: lead.created, company.updated
  entity_type text,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_logs_created_idx on activity_logs (created_at desc);
create index activity_logs_entity_idx on activity_logs (entity_type, entity_id);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  level notification_level not null default 'info',
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_unread_idx on notifications (created_at desc) where read_at is null;

-- ---------------------------------------------------------------------
-- Prospecção
-- ---------------------------------------------------------------------
create table lead_sources (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,             -- google_places, manual, diretorio, indicacao...
  name text not null,
  is_automatic boolean not null default false,
  created_at timestamptz not null default now()
);

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text generated always as (lower(regexp_replace(name, '\s+', ' ', 'g'))) stored,
  category text,
  country text not null default 'PT',
  region text,
  city text,
  address text,
  phone text,
  email text,
  website text,
  has_website boolean generated always as (website is not null and website <> '') stored,
  external_id text,                      -- ex.: place_id do Google
  source_id uuid references lead_sources(id),
  commercial_profile text,
  is_demo boolean not null default false,
  identified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index companies_external_uidx on companies (source_id, external_id) where external_id is not null;
create unique index companies_dedupe_uidx on companies (normalized_name, coalesce(city,''), coalesce(phone,''));
create index companies_name_trgm on companies using gin (name gin_trgm_ops);
create index companies_category_idx on companies (category);
create index companies_city_idx on companies (city);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  full_name text not null,
  role text,
  email text,
  phone text,
  whatsapp text,
  is_primary boolean not null default false,
  consent_commercial boolean not null default false,
  consent_at timestamptz,
  opted_out boolean not null default false,
  opted_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contacts_consent_chk check (not (opted_out and consent_commercial))
);
create index contacts_company_idx on contacts (company_id);

create table leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  stage lead_stage not null default 'novo_lead',
  score smallint check (score between 0 and 100),
  opportunity opportunity_level,
  estimated_value numeric(12,2) check (estimated_value >= 0),
  owner_notes text,
  next_action text,
  next_action_at timestamptz,
  lost_reason text,
  stage_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_lost_reason_chk check (stage <> 'perdido' or lost_reason is not null)
);
create unique index leads_company_open_uidx on leads (company_id) where stage not in ('perdido','entregue');
create index leads_stage_idx on leads (stage);
create index leads_score_idx on leads (score desc nulls last);
create index leads_next_action_idx on leads (next_action_at) where next_action_at is not null;

create table lead_analyses (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  score smallint not null check (score between 0 and 100),
  opportunity opportunity_level not null,
  score_explanation text not null,
  diagnosis text,
  problem text,
  recommended_service text,
  sales_argument text,
  suggested_price numeric(12,2),
  suggested_message text,
  next_action text,
  findings jsonb not null default '{}'::jsonb,
  model text,
  created_at timestamptz not null default now()
);
create index lead_analyses_lead_idx on lead_analyses (lead_id, created_at desc);

-- ---------------------------------------------------------------------
-- Agentes de IA
-- ---------------------------------------------------------------------
create table ai_agents (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null,
  status agent_status not null default 'inativo',
  model text not null default 'gpt-4o-mini',
  provider text not null default 'openai',
  system_prompt text,
  settings jsonb not null default '{}'::jsonb,
  daily_task_limit integer not null default 50 check (daily_task_limit >= 0),
  monthly_budget_eur numeric(10,2) not null default 20 check (monthly_budget_eur >= 0),
  last_error text,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table ai_tasks (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references ai_agents(id) on delete cascade,
  lead_id uuid references leads(id) on delete set null,
  title text not null,
  status task_status not null default 'pendente',
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index ai_tasks_agent_idx on ai_tasks (agent_id, created_at desc);

create table ai_usage (
  id bigint generated always as identity primary key,
  agent_id uuid references ai_agents(id) on delete set null,
  task_id uuid references ai_tasks(id) on delete set null,
  provider text not null,
  model text not null,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  cost_eur numeric(10,4) not null default 0 check (cost_eur >= 0),
  created_at timestamptz not null default now()
);
create index ai_usage_created_idx on ai_usage (created_at desc);

-- ---------------------------------------------------------------------
-- Comunicações
-- ---------------------------------------------------------------------
create table conversations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  channel channel_type not null,
  subject text,
  interest_level smallint check (interest_level between 0 and 5),
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index conversations_company_idx on conversations (company_id);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  direction message_direction not null,
  status message_status not null default 'rascunho',
  body text not null,
  prepared_by_agent uuid references ai_agents(id) on delete set null,
  approved_at timestamptz,
  scheduled_for timestamptz,
  sent_at timestamptz,
  external_id text,
  created_at timestamptz not null default now(),
  -- envio exige aprovação explícita do administrador
  constraint messages_sent_approved_chk check (
    direction = 'entrada' or status not in ('agendada','enviada') or approved_at is not null
  )
);
create index messages_conversation_idx on messages (conversation_id, created_at);

create table automation_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mode automation_mode not null default 'manual',
  trigger_event text not null,
  conditions jsonb not null default '{}'::jsonb,
  actions jsonb not null default '{}'::jsonb,
  max_per_day integer not null default 20 check (max_per_day >= 0),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Catálogo, propostas e vendas
-- ---------------------------------------------------------------------
create table products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  category product_category not null,
  description text,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  unit_cost numeric(12,2) not null default 0 check (unit_cost >= 0),
  stock_qty integer check (stock_qty is null or stock_qty >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references companies(id) on delete restrict,
  lead_id uuid references leads(id) on delete set null,
  nif text,
  billing_address text,
  notes text,
  customer_since date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table proposals (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  lead_id uuid references leads(id) on delete set null,
  company_id uuid not null references companies(id) on delete restrict,
  title text not null,
  status proposal_status not null default 'rascunho',
  total numeric(12,2) not null default 0 check (total >= 0),
  delivery_days integer check (delivery_days is null or delivery_days > 0),
  terms text,
  payment_terms text,
  valid_until date,
  notes text,
  version integer not null default 1,
  parent_id uuid references proposals(id) on delete set null,
  sent_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index proposals_company_idx on proposals (company_id);

create table proposal_items (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  description text not null,
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) generated always as (round(quantity * unit_price, 2)) stored,
  position smallint not null default 0
);
create index proposal_items_proposal_idx on proposal_items (proposal_id);

create table sales (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete restrict,
  proposal_id uuid references proposals(id) on delete set null,
  product_id uuid references products(id) on delete set null,
  description text not null,
  amount numeric(12,2) not null check (amount >= 0),
  cost numeric(12,2) not null default 0 check (cost >= 0),
  sold_at date not null default current_date,
  created_at timestamptz not null default now()
);
create index sales_sold_at_idx on sales (sold_at);

-- ---------------------------------------------------------------------
-- Websites
-- ---------------------------------------------------------------------
create table website_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  segment text not null,               -- pintura, remodelacao, construcao, pladur, eletricidade, canalizacao, manutencao
  structure jsonb not null default '[]'::jsonb,
  theme jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table websites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  template_id uuid references website_templates(id) on delete set null,
  title text not null,
  status text not null default 'rascunho' check (status in ('rascunho','demonstracao','aprovado','publicado','arquivado')),
  content jsonb not null default '{}'::jsonb,
  theme jsonb not null default '{}'::jsonb,
  preview_url text,
  published_url text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index websites_company_idx on websites (company_id);

-- ---------------------------------------------------------------------
-- NFC
-- ---------------------------------------------------------------------
create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  contact_name text,
  email text,
  phone text,
  website text,
  notes text,
  created_at timestamptz not null default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('cliente','fornecedor')),
  customer_id uuid references customers(id) on delete restrict,
  supplier_id uuid references suppliers(id) on delete restrict,
  product_id uuid references products(id) on delete set null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  total numeric(12,2) generated always as (quantity * unit_price) stored,
  status text not null default 'pendente' check (status in ('pendente','em_producao','enviada','entregue','cancelada')),
  tracking_code text,
  ordered_at date not null default current_date,
  delivered_at date,
  created_at timestamptz not null default now(),
  constraint orders_party_chk check (
    (kind = 'cliente' and customer_id is not null) or (kind = 'fornecedor' and supplier_id is not null)
  )
);

create table nfc_devices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete restrict,
  order_id uuid references orders(id) on delete set null,
  product_id uuid references products(id) on delete set null,
  nfc_uid text unique,
  slug text not null unique,              -- /r/<slug> regista a interação e redireciona
  review_url text not null,               -- endereço oficial de avaliação da empresa
  model text,
  customization jsonb not null default '{}'::jsonb,
  manufacturing_cost numeric(12,2) not null default 0 check (manufacturing_cost >= 0),
  status text not null default 'em_stock' check (status in ('em_stock','vendida','entregue','ativa','inativa')),
  created_at timestamptz not null default now(),
  constraint nfc_review_url_chk check (review_url ~* '^https://')
);

create table nfc_interactions (
  id bigint generated always as identity primary key,
  device_id uuid not null references nfc_devices(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  source text not null default 'nfc' check (source in ('nfc','qr')),
  device_type text                         -- minimização: sem IP, sem identificadores pessoais
);
create index nfc_interactions_device_idx on nfc_interactions (device_id, occurred_at desc);

-- ---------------------------------------------------------------------
-- Projetos
-- ---------------------------------------------------------------------
create table projects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  customer_id uuid not null references customers(id) on delete restrict,
  sale_id uuid references sales(id) on delete set null,
  product_id uuid references products(id) on delete set null,
  title text not null,
  stage project_stage not null default 'aguardando_materiais',
  value numeric(12,2) not null default 0 check (value >= 0),
  starts_on date,
  due_on date,
  delivered_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_dates_chk check (due_on is null or starts_on is null or due_on >= starts_on)
);
create index projects_stage_idx on projects (stage);

create table project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  status task_status not null default 'pendente',
  due_on date,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index project_tasks_project_idx on project_tasks (project_id);

-- ---------------------------------------------------------------------
-- Financeiro
-- ---------------------------------------------------------------------
create table expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('ferramentas','apis','ia','dominios','hospedagem','fornecedores','publicidade','impostos','outros')),
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  status payment_status not null default 'pendente',
  supplier_id uuid references suppliers(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  incurred_on date not null default current_date,
  due_on date,
  paid_on date,
  created_at timestamptz not null default now()
);
create index expenses_incurred_idx on expenses (incurred_on);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  type transaction_type not null,
  amount numeric(12,2) not null check (amount > 0),
  status payment_status not null default 'pendente',
  sale_id uuid references sales(id) on delete restrict,
  expense_id uuid references expenses(id) on delete restrict,
  project_id uuid references projects(id) on delete set null,
  description text,
  due_on date,
  paid_on date,
  created_at timestamptz not null default now(),
  constraint transactions_ref_chk check (
    (type = 'receita' and sale_id is not null and expense_id is null) or
    (type = 'despesa' and expense_id is not null and sale_id is null)
  )
);
create index transactions_paid_idx on transactions (paid_on);

-- ---------------------------------------------------------------------
-- Triggers: updated_at
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'administrators','integrations','companies','contacts','leads','ai_agents',
    'conversations','automation_rules','products','customers','proposals',
    'websites','projects'
  ] loop
    execute format('create trigger trg_%1$s_updated before update on %1$s for each row execute function set_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Regras de negócio no banco
-- ---------------------------------------------------------------------
-- Mudança de etapa regista data
create or replace function lead_stage_touch() returns trigger language plpgsql as $$
begin
  if new.stage is distinct from old.stage then
    new.stage_changed_at = now();
  end if;
  return new;
end $$;
create trigger trg_leads_stage before update on leads for each row execute function lead_stage_touch();

-- Auditoria genérica (histórico de alterações)
create or replace function audit_row() returns trigger language plpgsql security definer set search_path = public as $$
declare rec record; payload jsonb;
begin
  rec := case when tg_op = 'DELETE' then old else new end;
  payload := case
    when tg_op = 'UPDATE' then jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
    else to_jsonb(rec)
  end;
  insert into activity_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), lower(tg_table_name || '.' || tg_op), tg_table_name, rec.id::text, payload);
  return rec;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'companies','leads','contacts','proposals','sales','customers','projects',
    'transactions','expenses','ai_agents','integrations','automation_rules','orders','nfc_devices'
  ] loop
    execute format('create trigger trg_%1$s_audit after insert or update or delete on %1$s for each row execute function audit_row()', t);
  end loop;
end $$;

-- Proposta: total sempre derivado dos itens
create or replace function proposal_recalc() returns trigger language plpgsql as $$
declare pid uuid := coalesce(new.proposal_id, old.proposal_id);
begin
  update proposals set total = coalesce((select sum(line_total) from proposal_items where proposal_id = pid), 0) where id = pid;
  return null;
end $$;
create trigger trg_proposal_items_total after insert or update or delete on proposal_items for each row execute function proposal_recalc();

-- Integridade financeira: registos pagos não podem ser alterados nem apagados
create or replace function protect_paid() returns trigger language plpgsql as $$
begin
  if old.status = 'pago' then
    raise exception 'Registo financeiro pago é imutável (id %)', old.id using errcode = 'check_violation';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger trg_transactions_protect before update or delete on transactions for each row execute function protect_paid();
create trigger trg_expenses_protect before update or delete on expenses for each row execute function protect_paid();

-- Opt-out de contacto nunca é revertido silenciosamente
create or replace function contact_optout_guard() returns trigger language plpgsql as $$
begin
  if old.opted_out and not new.opted_out then
    raise exception 'Oposição a comunicações não pode ser revertida sem novo consentimento registado' using errcode = 'check_violation';
  end if;
  if new.opted_out and old.opted_out is not true then
    new.opted_out_at = now();
    new.consent_commercial = false;
  end if;
  return new;
end $$;
create trigger trg_contacts_optout before update on contacts for each row execute function contact_optout_guard();

-- Botão de emergência: bloqueia envios quando ativo
create or replace function block_sends_on_kill() returns trigger language plpgsql as $$
begin
  if new.direction = 'saida' and new.status in ('agendada','enviada')
     and coalesce((select (value)::text = 'true' from system_settings where key = 'automation_kill_switch'), false) then
    raise exception 'Botão de emergência ativo: envios bloqueados' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger trg_messages_kill before insert or update on messages for each row execute function block_sends_on_kill();
