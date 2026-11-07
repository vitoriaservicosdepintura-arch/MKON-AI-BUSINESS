-- =====================================================================
-- MKON AI BUSINESS — Loja de GIFs - Script SQL Completo
-- Execute este script no Supabase SQL Editor
-- =====================================================================

-- Criar extensões se não existirem
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- Função para updated_at
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Tipos enumerados
create type gif_product_status as enum ('ativo','inativo','esgotado');
create type gif_order_status as enum (
  'novo_pedido','aguardando_pagamento','pagamento_confirmado',
  'aguardando_personalizacao','em_producao','controle_qualidade',
  'pronto_envio','enviado','entregue','cancelado'
);
create type gif_customization_status as enum (
  'aguardando_personalizacao','personalizacao_andamento',
  'aguardando_aprovacao','aprovado_cliente','em_producao','finalizado'
);
create type gif_payment_method as enum ('multibanco','mbway','credit_card','paypal','transferencia');
create type gif_shipping_method as enum ('ctt_normal','ctt_expresso','pickup');
create type gif_promotion_type as enum ('percentual','valor_fixo','combo','quantidade');
create type gif_stock_movement_type as enum ('entrada','saida','ajuste','reserva','devolucao','danificado');

-- Tabela de categorias
create table if not exists gif_categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references gif_categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  cover_image_url text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tabela de produtos
create table if not exists gif_products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  category_id uuid references gif_categories(id) on delete restrict,
  subcategory_id uuid references gif_categories(id) on delete restrict,
  description text,
  cover_image_url text,
  gif_url text,
  preview_gif_url text,
  sale_price numeric(10,2) not null,
  production_cost numeric(10,2) not null default 0,
  dimensions text,
  material text,
  finish_type text,
  stock_quantity integer not null default 0,
  min_stock_alert integer not null default 5,
  production_days integer not null default 3,
  allows_customization boolean not null default false,
  status gif_product_status not null default 'ativo',
  is_digital boolean not null default false,
  tags text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tabela de imagens de produtos
create table if not exists gif_product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references gif_products(id) on delete cascade,
  image_url text not null,
  alt_text text,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Tabela de clientes
create table if not exists gif_customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  whatsapp text,
  country text default 'Portugal',
  city text,
  address text,
  postal_code text,
  total_spent numeric(12,2) not null default 0,
  orders_count integer not null default 0,
  last_purchase_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tabela de pedidos
create table if not exists gif_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid references gif_customers(id) on delete set null,
  status gif_order_status not null default 'novo_pedido',
  subtotal numeric(12,2) not null,
  discount_amount numeric(12,2) not null default 0,
  shipping_cost numeric(10,2) not null default 0,
  total_amount numeric(12,2) not null,
  production_cost_total numeric(12,2) not null default 0,
  estimated_profit numeric(12,2) not null default 0,
  payment_method gif_payment_method,
  payment_status text not null default 'pendente',
  shipping_address jsonb,
  shipping_method gif_shipping_method,
  tracking_code text,
  customer_notes text,
  internal_notes text,
  promotion_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tabela de itens do pedido
create table if not exists gif_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references gif_orders(id) on delete cascade,
  product_id uuid references gif_products(id) on delete restrict,
  product_name text not null,
  quantity integer not null,
  unit_price numeric(10,2) not null,
  discount_amount numeric(10,2) not null default 0,
  total_price numeric(10,2) not null,
  production_cost numeric(10,2) not null default 0,
  customization_id uuid,
  created_at timestamptz not null default now()
);

-- Tabela de histórico de pedidos
create table if not exists gif_order_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references gif_orders(id) on delete cascade,
  status gif_order_status not null,
  notes text,
  changed_by uuid references administrators(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Tabela de personalizações
create table if not exists gif_customizations (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid references gif_order_items(id) on delete cascade,
  customer_id uuid references gif_customers(id) on delete set null,
  status gif_customization_status not null default 'aguardando_personalizacao',
  customization_type text[],
  custom_text text,
  photo_urls text[],
  customer_instructions text,
  production_notes text,
  approved_at timestamptz,
  preview_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tabela de movimentações de estoque
create table if not exists gif_stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references gif_products(id) on delete cascade,
  movement_type gif_stock_movement_type not null,
  quantity integer not null,
  previous_quantity integer not null,
  new_quantity integer not null,
  reason text,
  order_id uuid references gif_orders(id) on delete set null,
  created_by uuid references administrators(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Tabela de promoções
create table if not exists gif_promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  promotion_type gif_promotion_type not null,
  discount_value numeric(10,2) not null,
  applies_to text not null,
  category_id uuid references gif_categories(id) on delete set null,
  min_quantity integer,
  max_uses integer,
  current_uses integer not null default 0,
  start_date timestamptz not null,
  end_date timestamptz not null,
  is_active boolean not null default true,
  promo_code text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tabela de produtos em promoção
create table if not exists gif_promotion_products (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references gif_promotions(id) on delete cascade,
  product_id uuid not null references gif_products(id) on delete cascade,
  discount_value numeric(10,2),
  created_at timestamptz not null default now()
);

-- Índices
create index if not exists gif_categories_parent_idx on gif_categories(parent_id);
create index if not exists gif_categories_slug_idx on gif_categories(slug);
create index if not exists gif_categories_active_idx on gif_categories(is_active, display_order);
create index if not exists gif_products_sku_idx on gif_products(sku);
create index if not exists gif_products_category_idx on gif_products(category_id);
create index if not exists gif_products_status_idx on gif_products(status);
create index if not exists gif_product_images_product_idx on gif_product_images(product_id, display_order);
create index if not exists gif_customers_email_idx on gif_customers(email);
create index if not exists gif_orders_number_idx on gif_orders(order_number);
create index if not exists gif_orders_customer_idx on gif_orders(customer_id);
create index if not exists gif_orders_status_idx on gif_orders(status);
create index if not exists gif_orders_created_idx on gif_orders(created_at desc);
create index if not exists gif_order_items_order_idx on gif_order_items(order_id);
create index if not exists gif_order_items_product_idx on gif_order_items(product_id);
create index if not exists gif_order_history_order_idx on gif_order_history(order_id, created_at desc);
create index if not exists gif_customizations_order_item_idx on gif_customizations(order_item_id);
create index if not exists gif_customizations_status_idx on gif_customizations(status);
create index if not exists gif_stock_movements_product_idx on gif_stock_movements(product_id, created_at desc);
create index if not exists gif_stock_movements_order_idx on gif_stock_movements(order_id);
create index if not exists gif_promotions_active_idx on gif_promotions(is_active, start_date, end_date);
create index if not exists gif_promotions_code_idx on gif_promotions(promo_code);
create unique index if not exists gif_promotion_products_unique on gif_promotion_products(promotion_id, product_id);

-- Triggers para updated_at
create trigger gif_categories_updated_at before update on gif_categories
  for each row execute function set_updated_at();

create trigger gif_products_updated_at before update on gif_products
  for each row execute function set_updated_at();

create trigger gif_customers_updated_at before update on gif_customers
  for each row execute function set_updated_at();

create trigger gif_orders_updated_at before update on gif_orders
  for each row execute function set_updated_at();

create trigger gif_customizations_updated_at before update on gif_customizations
  for each row execute function set_updated_at();

create trigger gif_promotions_updated_at before update on gif_promotions
  for each row execute function set_updated_at();

-- Função para gerar número de pedido
create or replace function generate_gif_order_number() returns text
language plpgsql as $$
declare
  prefix text := 'GIF';
  year_part text := to_char(now(), 'YY');
  month_part text := to_char(now(), 'MM');
  seq_num integer;
  result text;
begin
  select coalesce(max(
    (substring(order_number from 8 for 4))::integer
  ), 0) + 1
  into seq_num
  from gif_orders
  where order_number like prefix || year_part || month_part || '%';

  result := prefix || year_part || month_part || lpad(seq_num::text, 4, '0');
  return result;
end;
$$;

create trigger gif_orders_order_number before insert on gif_orders
  for each row
  when (new.order_number is null)
  execute procedure generate_gif_order_number();

-- Função para gerar SKU
create or replace function generate_gif_sku() returns text
language plpgsql as $$
declare
  prefix text := 'GIF';
  seq_num integer;
  result text;
begin
  select coalesce(max(
    (substring(sku from 5 for 5))::integer
  ), 0) + 1
  into seq_num
  from gif_products
  where sku like prefix || '%';

  result := prefix || lpad(seq_num::text, 5, '0');
  return result;
end;
$$;

create trigger gif_products_sku before insert on gif_products
  for each row
  when (new.sku is null)
  execute procedure generate_gif_sku();

-- Função para atualizar totais do cliente
create or replace function update_gif_customer_totals() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update gif_customers
    set
      total_spent = total_spent + new.total_amount,
      orders_count = orders_count + 1,
      last_purchase_at = new.created_at,
      updated_at = now()
    where id = new.customer_id;
  elsif tg_op = 'UPDATE' then
    update gif_customers
    set
      total_spent = total_spent - old.total_amount + new.total_amount,
      updated_at = now()
    where id = new.customer_id;
  elsif tg_op = 'DELETE' then
    update gif_customers
    set
      total_spent = total_spent - old.total_amount,
      orders_count = greatest(orders_count - 1, 0),
      updated_at = now()
    where id = old.customer_id;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger gif_orders_customer_totals
  after insert or update or delete on gif_orders
  for each row execute procedure update_gif_customer_totals();

-- =====================================================================
-- RLS Policies
-- =====================================================================

alter table gif_categories enable row level security;
alter table gif_products enable row level security;
alter table gif_product_images enable row level security;
alter table gif_customers enable row level security;
alter table gif_orders enable row level security;
alter table gif_order_items enable row level security;
alter table gif_order_history enable row level security;
alter table gif_customizations enable row level security;
alter table gif_stock_movements enable row level security;
alter table gif_promotions enable row level security;
alter table gif_promotion_products enable row level security;

-- Políticas para todas as tabelas (administradores têm acesso total)
create policy "Administradores podem tudo em categorias"
  on gif_categories for all
  using (exists (select 1 from administrators where id = auth.uid()));

create policy "Administradores podem tudo em produtos"
  on gif_products for all
  using (exists (select 1 from administrators where id = auth.uid()));

create policy "Administradores podem tudo em imagens de produtos"
  on gif_product_images for all
  using (exists (select 1 from administrators where id = auth.uid()));

create policy "Administradores podem tudo em clientes"
  on gif_customers for all
  using (exists (select 1 from administrators where id = auth.uid()));

create policy "Administradores podem tudo em pedidos"
  on gif_orders for all
  using (exists (select 1 from administrators where id = auth.uid()));

create policy "Administradores podem tudo em itens de pedido"
  on gif_order_items for all
  using (exists (select 1 from administrators where id = auth.uid()));

create policy "Administradores podem tudo em histórico de pedidos"
  on gif_order_history for all
  using (exists (select 1 from administrators where id = auth.uid()));

create policy "Administradores podem tudo em personalizações"
  on gif_customizations for all
  using (exists (select 1 from administrators where id = auth.uid()));

create policy "Administradores podem tudo em movimentações de estoque"
  on gif_stock_movements for all
  using (exists (select 1 from administrators where id = auth.uid()));

create policy "Administradores podem tudo em promoções"
  on gif_promotions for all
  using (exists (select 1 from administrators where id = auth.uid()));

create policy "Administradores podem tudo em produtos de promoção"
  on gif_promotion_products for all
  using (exists (select 1 from administrators where id = auth.uid()));

-- =====================================================================
-- Dados iniciais - Categorias
-- =====================================================================

insert into gif_categories (name, slug, description, display_order) values
  ('Família e recordações', 'familia-recordacoes', 'GIFs para momentos especiais em família', 1),
  ('Casais e romance', 'casais-romance', 'Romance e amor para casais', 2),
  ('Animais de estimação', 'animais-estimacao', 'Seus melhores amigos', 3),
  ('Bebés e crianças', 'bebes-criancas', 'Para os mais pequenos', 4),
  ('Aniversários', 'aniversarios', 'Parabéns!', 5),
  ('Casamentos', 'casamentos', 'O grande dia', 6),
  ('Batizados', 'batizados', 'Celebração sagrada', 7),
  ('Natal', 'natal', 'Espírito natalino', 8),
  ('Páscoa', 'pascoa', 'Celebração da Páscoa', 9),
  ('Dia dos Namorados', 'dia-namorados', 'Amor no ar', 10),
  ('Dia das Mães', 'dia-maes', 'Para a mamã', 11),
  ('Dia dos Pais', 'dia-pais', 'Para o papá', 12),
  ('Viagens e turismo', 'viagens-turismo', 'Lugares incríveis', 13),
  ('Futebol e desporto', 'futebol-desporto', 'Paixão pelo desporto', 14),
  ('Profissões', 'profissoes', 'Homenagem ao trabalho', 15),
  ('Humor e frases', 'humor-frases', 'Para rir', 16),
  ('Motivacionais', 'motivacionais', 'Inspiração diária', 17),
  ('Personalizados com fotografias', 'personalizados-fotos', 'Suas memórias', 18),
  ('Coleções exclusivas', 'colecoes-exclusivas', 'Edições limitadas', 19)
on conflict (slug) do nothing;

-- =====================================================================
-- Storage Buckets
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gif-category-covers',
  'gif-category-covers',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gif-product-images',
  'gif-product-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gif-animations',
  'gif-animations',
  true,
  20971520,
  array['image/gif', 'video/mp4', 'video/webm']
) on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gif-customer-photos',
  'gif-customer-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
) on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gif-customizations',
  'gif-customizations',
  false,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
) on conflict (id) do nothing;

-- =====================================================================
-- Storage Policies
-- =====================================================================

-- gif-category-covers
create policy "Imagens de categorias são públicas para leitura"
  on storage.objects for select
  using (bucket_id = 'gif-category-covers');

create policy "Administradores podem fazer upload em categorias"
  on storage.objects for insert
  with check (
    bucket_id = 'gif-category-covers' and
    exists (select 1 from administrators where id = auth.uid())
  );

-- gif-product-images
create policy "Imagens de produtos são públicas para leitura"
  on storage.objects for select
  using (bucket_id = 'gif-product-images');

create policy "Administradores podem fazer upload em produtos"
  on storage.objects for insert
  with check (
    bucket_id = 'gif-product-images' and
    exists (select 1 from administrators where id = auth.uid())
  );

-- gif-animations
create policy "GIFs animados são públicos para leitura"
  on storage.objects for select
  using (bucket_id = 'gif-animations');

create policy "Administradores podem fazer upload de GIFs"
  on storage.objects for insert
  with check (
    bucket_id = 'gif-animations' and
    exists (select 1 from administrators where id = auth.uid())
  );

-- gif-customer-photos (privado)
create policy "Administradores podem acessar fotos de clientes"
  on storage.objects for all
  using (
    bucket_id = 'gif-customer-photos' and
    exists (select 1 from administrators where id = auth.uid())
  );

-- gif-customizations (privado)
create policy "Administradores podem acessar personalizações"
  on storage.objects for all
  using (
    bucket_id = 'gif-customizations' and
    exists (select 1 from administrators where id = auth.uid())
  );
