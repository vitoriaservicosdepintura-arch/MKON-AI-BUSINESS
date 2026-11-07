-- =====================================================================
-- 0005 — Proteção RLS aplicada ao projeto MKON AI Business
-- Já aplicada diretamente no Supabase (migração "mkon_enable_owner_only_rls").
-- Este ficheiro regista a alteração no repositório, para histórico e
-- para recriar o mesmo estado noutro projeto.
-- Idempotente: pode ser executado mais do que uma vez.
-- =====================================================================

create or replace function is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from administrators a where a.id = auth.uid() and a.role = 'owner');
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'administrators','system_settings','integrations','activity_logs','notifications',
    'lead_sources','companies','contacts','leads','lead_analyses','ai_agents','ai_tasks','ai_usage',
    'conversations','messages','automation_rules','products','customers','proposals','proposal_items',
    'sales','website_templates','websites','suppliers','orders','nfc_devices','nfc_interactions',
    'projects','project_tasks','expenses','transactions'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on table %I from anon', t);
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='owner_all') then
      execute format('create policy "owner_all" on %I for all to authenticated using (is_owner()) with check (is_owner())', t);
    end if;
  end loop;
end $$;

drop policy if exists "owner_all" on activity_logs;
drop policy if exists "owner_read_logs" on activity_logs;
drop policy if exists "owner_insert_logs" on activity_logs;
create policy "owner_read_logs" on activity_logs for select to authenticated using (is_owner());
create policy "owner_insert_logs" on activity_logs for insert to authenticated with check (is_owner());
