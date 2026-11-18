-- 0010: tours 3D de imóveis. Cada tour tem divisões com fotos; o viewer público lê só tours publicados.
create table if not exists public.property_tours (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique,
  status text not null default 'rascunho' check (status in ('rascunho', 'publicado')),
  rooms jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.property_tours enable row level security;
drop policy if exists "owner manages property tours" on public.property_tours;
create policy "owner manages property tours" on public.property_tours
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

drop trigger if exists trg_property_tours_updated on public.property_tours;
create trigger trg_property_tours_updated before update on public.property_tours
  for each row execute function set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tour-media', 'tour-media', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "tour media public read" on storage.objects;
create policy "tour media public read" on storage.objects for select using (bucket_id = 'tour-media');
drop policy if exists "tour media owner insert" on storage.objects;
create policy "tour media owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'tour-media' and public.is_owner());
drop policy if exists "tour media owner update" on storage.objects;
create policy "tour media owner update" on storage.objects for update to authenticated
  using (bucket_id = 'tour-media' and public.is_owner()) with check (bucket_id = 'tour-media' and public.is_owner());
drop policy if exists "tour media owner delete" on storage.objects;
create policy "tour media owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'tour-media' and public.is_owner());

create or replace function public.public_tour(p_slug text)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select to_jsonb(t) from (
    select title, slug, rooms from public.property_tours
    where slug = p_slug and status = 'publicado'
  ) t
$$;
grant execute on function public.public_tour(text) to anon, authenticated;
