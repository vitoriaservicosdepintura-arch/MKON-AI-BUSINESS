-- =====================================================================
-- MKON AI BUSINESS — Loja de GIFs - Storage Buckets (Migration 7)
-- Configuração de buckets para armazenamento de arquivos da loja
-- =====================================================================

-- Criar bucket para imagens de categorias
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gif-category-covers',
  'gif-category-covers',
  true,
  5242880, -- 5MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) on conflict (id) do nothing;

-- Criar bucket para imagens de produtos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gif-product-images',
  'gif-product-images',
  true,
  10485760, -- 10MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) on conflict (id) do nothing;

-- Criar bucket para GIFs animados
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gif-animations',
  'gif-animations',
  true,
  20971520, -- 20MB
  array['image/gif', 'video/mp4', 'video/webm']
) on conflict (id) do nothing;

-- Criar bucket para fotos de clientes (privado)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gif-customer-photos',
  'gif-customer-photos',
  false,
  10485760, -- 10MB
  array['image/jpeg', 'image/png', 'image/webp']
) on conflict (id) do nothing;

-- Criar bucket para arquivos personalizados (privado)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gif-customizations',
  'gif-customizations',
  false,
  20971520, -- 20MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
) on conflict (id) do nothing;

-- =====================================================================
-- Políticas de acesso para os buckets
-- =====================================================================

-- Políticas para gif-category-covers (público para leitura)
create policy "Imagens de categorias são públicas para leitura"
  on storage.objects for select
  using (bucket_id = 'gif-category-covers');

create policy "Administradores podem fazer upload em categorias"
  on storage.objects for insert
  with check (
    bucket_id = 'gif-category-covers' and
    exists (select 1 from administrators where id = auth.uid())
  );

create policy "Administradores podem atualizar imagens de categorias"
  on storage.objects for update
  using (
    bucket_id = 'gif-category-covers' and
    exists (select 1 from administrators where id = auth.uid())
  );

create policy "Administradores podem deletar imagens de categorias"
  on storage.objects for delete
  using (
    bucket_id = 'gif-category-covers' and
    exists (select 1 from administrators where id = auth.uid())
  );

-- Políticas para gif-product-images (público para leitura)
create policy "Imagens de produtos são públicas para leitura"
  on storage.objects for select
  using (bucket_id = 'gif-product-images');

create policy "Administradores podem fazer upload em produtos"
  on storage.objects for insert
  with check (
    bucket_id = 'gif-product-images' and
    exists (select 1 from administrators where id = auth.uid())
  );

create policy "Administradores podem atualizar imagens de produtos"
  on storage.objects for update
  using (
    bucket_id = 'gif-product-images' and
    exists (select 1 from administrators where id = auth.uid())
  );

create policy "Administradores podem deletar imagens de produtos"
  on storage.objects for delete
  using (
    bucket_id = 'gif-product-images' and
    exists (select 1 from administrators where id = auth.uid())
  );

-- Políticas para gif-animations (público para leitura)
create policy "GIFs animados são públicos para leitura"
  on storage.objects for select
  using (bucket_id = 'gif-animations');

create policy "Administradores podem fazer upload de GIFs"
  on storage.objects for insert
  with check (
    bucket_id = 'gif-animations' and
    exists (select 1 from administrators where id = auth.uid())
  );

create policy "Administradores podem atualizar GIFs"
  on storage.objects for update
  using (
    bucket_id = 'gif-animations' and
    exists (select 1 from administrators where id = auth.uid())
  );

create policy "Administradores podem deletar GIFs"
  on storage.objects for delete
  using (
    bucket_id = 'gif-animations' and
    exists (select 1 from administrators where id = auth.uid())
  );

-- Políticas para gif-customer-photos (privado - apenas admins)
create policy "Administradores podem acessar fotos de clientes"
  on storage.objects for all
  using (
    bucket_id = 'gif-customer-photos' and
    exists (select 1 from administrators where id = auth.uid())
  );

create policy "Administradores podem fazer upload de fotos de clientes"
  on storage.objects for insert
  with check (
    bucket_id = 'gif-customer-photos' and
    exists (select 1 from administrators where id = auth.uid())
  );

-- Políticas para gif-customizations (privado - apenas admins)
create policy "Administradores podem acessar personalizações"
  on storage.objects for all
  using (
    bucket_id = 'gif-customizations' and
    exists (select 1 from administrators where id = auth.uid())
  );

create policy "Administradores podem fazer upload de personalizações"
  on storage.objects for insert
  with check (
    bucket_id = 'gif-customizations' and
    exists (select 1 from administrators where id = auth.uid())
  );
