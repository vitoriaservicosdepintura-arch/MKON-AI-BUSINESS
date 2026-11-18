-- =====================================================================
-- Sites: endereço público por slug, imagens e editor
-- URL público: https://mkonaibusiness.vercel.app/<slug>
-- Incremental: não altera dados existentes.
-- =====================================================================

alter table websites add column if not exists slug text unique;

-- Imagens dos sites (leitura pública, escrita só do proprietário)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-media', 'site-media', true, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

drop policy if exists "site-media leitura publica" on storage.objects;
create policy "site-media leitura publica" on storage.objects for select using (bucket_id = 'site-media');
drop policy if exists "site-media owner insere" on storage.objects;
create policy "site-media owner insere" on storage.objects for insert with check (bucket_id = 'site-media' and is_owner());
drop policy if exists "site-media owner altera" on storage.objects;
create policy "site-media owner altera" on storage.objects for update using (bucket_id = 'site-media' and is_owner());
drop policy if exists "site-media owner apaga" on storage.objects;
create policy "site-media owner apaga" on storage.objects for delete using (bucket_id = 'site-media' and is_owner());

-- Leitura pública de um site publicado ou de demonstração (sem expor outros dados)
create or replace function public.public_site(p_slug text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('title', w.title, 'status', w.status, 'content', w.content, 'theme', w.theme)
  from websites w
  where w.slug = lower(p_slug) and w.status in ('demonstracao', 'aprovado', 'publicado')
  limit 1
$$;
grant execute on function public.public_site(text) to anon, authenticated;

-- Dois sites de demonstração (empresas marcadas como is_demo)
insert into companies (name, category, city, region, is_demo)
select 'Demo — Pintura Prime', 'Pintura', 'Lisboa', 'Lisboa', true
where not exists (select 1 from companies where name = 'Demo — Pintura Prime');
insert into companies (name, category, city, region, is_demo)
select 'Demo — Pintura Simples', 'Pintura', 'Porto', 'Porto', true
where not exists (select 1 from companies where name = 'Demo — Pintura Simples');

insert into websites (company_id, title, status, slug, theme, content)
select c.id, 'Site demonstrativo profissional', 'demonstracao', 'demo-pintura-pro',
  $t${"primary":"#10B981","accent":"#F59E0B","bg":"#0B1020","text":"#F8FAFC"}$t$::jsonb,
  $j${
    "style": "pro",
    "brand": {"name": "Pintura Prime", "tagline": "Pintura profissional com acabamento impecável"},
    "menu": [
      {"label": "Serviços", "href": "#servicos"},
      {"label": "Trabalhos", "href": "#trabalhos"},
      {"label": "Sobre", "href": "#sobre"},
      {"label": "Contacto", "href": "#contacto"}
    ],
    "hero": {"eyebrow": "Pintura de interiores e exteriores", "title": "A sua casa merece cor à altura", "subtitle": "Equipa certificada, materiais de qualidade e orçamento sem compromisso em 24 horas.", "cta_label": "Pedir orçamento", "cta_href": "#contacto", "image": ""},
    "sections": [
      {"type": "services", "title": "Os nossos serviços", "items": [
        {"title": "Pintura de interiores", "text": "Acabamentos lisos e uniformes, com proteção de móveis e limpeza final."},
        {"title": "Pintura de exteriores", "text": "Proteção contra humidade e sol, com tintas de longa duração."},
        {"title": "Restauro e preparação", "text": "Correção de fissuras, estuque e preparação completa das superfícies."}
      ]},
      {"type": "about", "title": "Sobre nós", "text": "Há mais de 15 anos a transformar espaços em Lisboa e arredores. Trabalhamos com pontualidade, comunicação clara e garantia escrita."},
      {"type": "gallery", "title": "Trabalhos recentes", "images": []}
    ],
    "contact": {"phone": "912 345 678", "email": "contacto@pinturaprime.pt", "whatsapp": "351912345678", "address": "Lisboa"}
  }$j$::jsonb
from companies c where c.name = 'Demo — Pintura Prime'
on conflict (slug) do nothing;

insert into websites (company_id, title, status, slug, theme, content)
select c.id, 'Site demonstrativo simples', 'demonstracao', 'demo-pintura-simples',
  $t${"primary":"#2563EB","accent":"#2563EB","bg":"#FFFFFF","text":"#111827"}$t$::jsonb,
  $j${
    "style": "simple",
    "brand": {"name": "Pintura Simples", "tagline": ""},
    "menu": [
      {"label": "Serviços", "href": "#servicos"},
      {"label": "Contacto", "href": "#contacto"}
    ],
    "hero": {"eyebrow": "", "title": "Pintura de qualidade", "subtitle": "Peça já o seu orçamento grátis.", "cta_label": "Contactar", "cta_href": "#contacto", "image": ""},
    "sections": [
      {"type": "services", "title": "Serviços", "items": [
        {"title": "Interiores", "text": "Pintura de casas e escritórios."},
        {"title": "Exteriores", "text": "Fachadas e varandas."}
      ]}
    ],
    "contact": {"phone": "912 000 111", "email": "ola@pintura-simples.pt", "whatsapp": "351912000111", "address": "Porto"}
  }$j$::jsonb
from companies c where c.name = 'Demo — Pintura Simples'
on conflict (slug) do nothing;
