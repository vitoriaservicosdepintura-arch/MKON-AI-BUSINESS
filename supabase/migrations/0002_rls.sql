-- =====================================================================
-- MKON AI BUSINESS — Row Level Security
-- Sistema privado: apenas o proprietário (tabela administrators) acede.
-- Não existe registo público: Auth deve ter "Allow new users to sign up" DESATIVADO.
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
    execute format('create policy "owner_all" on %I for all to authenticated using (is_owner()) with check (is_owner())', t);
  end loop;
end $$;

-- Logs de auditoria são apenas de leitura/inserção para o proprietário (sem edição)
drop policy "owner_all" on activity_logs;
create policy "owner_read_logs" on activity_logs for select to authenticated using (is_owner());
create policy "owner_insert_logs" on activity_logs for insert to authenticated with check (is_owner());

-- Primeiro utilizador autenticado torna-se proprietário; nenhum outro é aceite.
create or replace function bootstrap_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from administrators) then
    raise exception 'Sistema privado: já existe um proprietário. Registo não permitido.';
  end if;
  insert into administrators (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), new.email);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function bootstrap_owner();

-- Endpoint público mínimo de redirecionamento NFC (regista interação, sem dados pessoais)
create or replace function nfc_redirect(p_slug text, p_source text default 'nfc', p_device_type text default null)
returns text
language plpgsql security definer set search_path = public as $$
declare d nfc_devices;
begin
  select * into d from nfc_devices where slug = p_slug and status <> 'inativa';
  if not found then return null; end if;
  insert into nfc_interactions (device_id, source, device_type)
  values (d.id, case when p_source = 'qr' then 'qr' else 'nfc' end, left(p_device_type, 40));
  return d.review_url;
end $$;
revoke all on function nfc_redirect(text, text, text) from public;
grant execute on function nfc_redirect(text, text, text) to anon, authenticated;
