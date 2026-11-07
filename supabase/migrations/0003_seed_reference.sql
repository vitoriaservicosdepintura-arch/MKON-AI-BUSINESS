-- =====================================================================
-- MKON AI BUSINESS — Dados de referência (configuração, NÃO dados de clientes)
-- Nenhum lead, cliente ou valor financeiro fictício é criado aqui.
-- =====================================================================

insert into system_settings (key, value, description) values
  ('automation_kill_switch', 'false'::jsonb, 'Botão de emergência: quando true, bloqueia toda atividade automática'),
  ('automation_mode',        '"manual"'::jsonb, 'Modo global de comunicação: manual | supervisionado | automatico'),
  ('tax_rate_estimate',      '0.23'::jsonb, 'Taxa de imposto estimada usada nos relatórios (IRC/IVA a validar com contabilista)'),
  ('currency',               '"EUR"'::jsonb, 'Moeda do sistema'),
  ('api_monthly_budget_eur', '50'::jsonb, 'Limite mensal global de custo de APIs')
on conflict (key) do nothing;

insert into lead_sources (code, name, is_automatic) values
  ('manual',        'Registo manual',            false),
  ('google_places', 'Google Places API',         true),
  ('diretorio',     'Diretório empresarial',     true),
  ('indicacao',     'Indicação',                 false),
  ('formulario',    'Formulário de contacto',    false)
on conflict (code) do nothing;

insert into integrations (provider, name, description) values
  ('google_places',  'Google Places API',          'Pesquisa de empresas por categoria e localização'),
  ('google_business','Google Business Profile',    'Gestão de perfis quando autorizado pelo cliente'),
  ('openai',         'OpenAI API',                 'Análise comercial, mensagens e agentes de IA'),
  ('whatsapp',       'WhatsApp Business Platform', 'Canal de mensagens com consentimento'),
  ('email',          'Provedor de email',          'Envio e receção de email comercial'),
  ('n8n',            'n8n / Webhooks',             'Automações e tarefas programadas'),
  ('hosting',        'Domínios e hospedagem',      'Publicação de websites aprovados')
on conflict (provider) do nothing;

insert into ai_agents (code, name, description, sort_order, system_prompt) values
  ('pesquisador',  'Pesquisador',  'Pesquisa empresas, encontra contactos e identifica oportunidades.', 1,
   'Pesquisas apenas em fontes autorizadas e compatíveis com os termos de utilização.'),
  ('analista',     'Analista',     'Analisa websites, presença digital e potencial comercial.', 2,
   'Pontua de 0 a 100 e explica sempre a pontuação.'),
  ('vendedor',     'Vendedor',     'Prepara mensagens, propostas e acompanha negociações.', 3,
   'Nunca envia mensagens sem a aprovação exigida pelo modo ativo. Respeita oposição e consentimento.'),
  ('atendimento',  'Atendimento',  'Ajuda a responder perguntas comerciais, identificar interesse e encaminhar contactos.', 4,
   'Identifica-se sempre com rigor. Nunca falsifica identidade.'),
  ('demonstrador', 'Demonstrador', 'Cria websites demonstrativos personalizados.', 5,
   'Não copia websites de terceiros nem usa imagens sem autorização.'),
  ('desenvolvedor','Desenvolvedor','Ajuda a desenvolver websites, gerar conteúdo e organizar entregas.', 6, null),
  ('financeiro',   'Financeiro',   'Analisa receitas, despesas, margens e resultados.', 7,
   'Propostas não são vendas. Só contabiliza receita com venda registada.'),
  ('supervisor',   'Supervisor',   'Acompanha os agentes, identifica falhas e apresenta recomendações.', 8, null)
on conflict (code) do nothing;

insert into website_templates (code, name, segment, structure, theme) values
  ('pintura-classic',   'Pintura — Clássico',      'pintura',      '["inicio","servicos","sobre","portfolio","galeria","contactos"]', '{"primary":"#E58A32","font":"Inter"}'),
  ('remodelacao-pro',   'Remodelação — Profissional','remodelacao', '["inicio","servicos","sobre","portfolio","galeria","contactos"]', '{"primary":"#1B1D21","font":"Inter"}'),
  ('construcao-solid',  'Construção — Sólido',     'construcao',   '["inicio","servicos","sobre","portfolio","galeria","contactos"]', '{"primary":"#292C31","font":"Inter"}'),
  ('pladur-clean',      'Pladur — Limpo',          'pladur',       '["inicio","servicos","sobre","portfolio","galeria","contactos"]', '{"primary":"#F3A34F","font":"Inter"}'),
  ('eletricidade-spark','Eletricidade',            'eletricidade', '["inicio","servicos","sobre","portfolio","galeria","contactos"]', '{"primary":"#E58A32","font":"Inter"}'),
  ('canalizacao-flow',  'Canalização',             'canalizacao',  '["inicio","servicos","sobre","portfolio","galeria","contactos"]', '{"primary":"#1B1D21","font":"Inter"}'),
  ('manutencao-care',   'Manutenção',              'manutencao',   '["inicio","servicos","sobre","portfolio","galeria","contactos"]', '{"primary":"#292C31","font":"Inter"}')
on conflict (code) do nothing;

insert into products (sku, name, category, unit_price, unit_cost, description) values
  ('WEB-INST',  'Website institucional',  'website',      0, 0, 'Preço a definir pelo proprietário'),
  ('WEB-PREM',  'Website premium',        'website',      0, 0, 'Preço a definir pelo proprietário'),
  ('LP',        'Landing page',           'landing_page', 0, 0, 'Preço a definir pelo proprietário'),
  ('REDESIGN',  'Redesign de website',    'website',      0, 0, 'Preço a definir pelo proprietário'),
  ('MANUT',     'Manutenção mensal',      'manutencao',   0, 0, 'Preço a definir pelo proprietário'),
  ('SEO',       'SEO',                    'seo',          0, 0, 'Preço a definir pelo proprietário'),
  ('NFC-PLAQ',  'Plaquinha NFC avaliações Google','nfc',  0, 0, 'Preço e custo a definir pelo proprietário')
on conflict (sku) do nothing;
