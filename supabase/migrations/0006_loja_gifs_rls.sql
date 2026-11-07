-- =====================================================================
-- MKON AI BUSINESS — Loja de GIFs - RLS (Migration 6)
-- Políticas de segurança Row Level Security
-- =====================================================================

-- ---------------------------------------------------------------------
-- Habilitar RLS em todas as tabelas da Loja de GIFs
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Políticas para gif_categories
-- ---------------------------------------------------------------------
create policy "Administradores podem tudo em categorias"
  on gif_categories for all
  using (exists (
    select 1 from administrators where id = auth.uid()
  ));

-- ---------------------------------------------------------------------
-- Políticas para gif_products
-- ---------------------------------------------------------------------
create policy "Administradores podem tudo em produtos"
  on gif_products for all
  using (exists (
    select 1 from administrators where id = auth.uid()
  ));

-- ---------------------------------------------------------------------
-- Políticas para gif_product_images
-- ---------------------------------------------------------------------
create policy "Administradores podem tudo em imagens de produtos"
  on gif_product_images for all
  using (exists (
    select 1 from administrators where id = auth.uid()
  ));

-- ---------------------------------------------------------------------
-- Políticas para gif_customers
-- ---------------------------------------------------------------------
create policy "Administradores podem tudo em clientes"
  on gif_customers for all
  using (exists (
    select 1 from administrators where id = auth.uid()
  ));

-- ---------------------------------------------------------------------
-- Políticas para gif_orders
-- ---------------------------------------------------------------------
create policy "Administradores podem tudo em pedidos"
  on gif_orders for all
  using (exists (
    select 1 from administrators where id = auth.uid()
  ));

-- ---------------------------------------------------------------------
-- Políticas para gif_order_items
-- ---------------------------------------------------------------------
create policy "Administradores podem tudo em itens de pedido"
  on gif_order_items for all
  using (exists (
    select 1 from administrators where id = auth.uid()
  ));

-- ---------------------------------------------------------------------
-- Políticas para gif_order_history
-- ---------------------------------------------------------------------
create policy "Administradores podem tudo em histórico de pedidos"
  on gif_order_history for all
  using (exists (
    select 1 from administrators where id = auth.uid()
  ));

-- ---------------------------------------------------------------------
-- Políticas para gif_customizations
-- ---------------------------------------------------------------------
create policy "Administradores podem tudo em personalizações"
  on gif_customizations for all
  using (exists (
    select 1 from administrators where id = auth.uid()
  ));

-- ---------------------------------------------------------------------
-- Políticas para gif_stock_movements
-- ---------------------------------------------------------------------
create policy "Administradores podem tudo em movimentações de estoque"
  on gif_stock_movements for all
  using (exists (
    select 1 from administrators where id = auth.uid()
  ));

-- ---------------------------------------------------------------------
-- Políticas para gif_promotions
-- ---------------------------------------------------------------------
create policy "Administradores podem tudo em promoções"
  on gif_promotions for all
  using (exists (
    select 1 from administrators where id = auth.uid()
  ));

-- ---------------------------------------------------------------------
-- Políticas para gif_promotion_products
-- ---------------------------------------------------------------------
create policy "Administradores podem tudo em produtos de promoção"
  on gif_promotion_products for all
  using (exists (
    select 1 from administrators where id = auth.uid()
  ));
