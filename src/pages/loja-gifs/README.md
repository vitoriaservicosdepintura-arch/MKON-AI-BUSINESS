# Loja de GIFs - Ímanes Personalizados

Módulo comercial para venda de GIFs personalizados e ímanes de geladeira dentro do sistema MKON AI Business.

## Estrutura

```
src/pages/loja-gifs/
├── Layout.tsx          # Layout principal com sidebar da loja
├── Dashboard.tsx       # Visão geral com indicadores
├── Categorias.tsx      # Gestão de categorias
├── Produtos.tsx        # Catálogo de produtos/GIFs
├── Personalizacoes.tsx # Gestão de personalizações
├── Pedidos.tsx         # Gestão de pedidos
├── Clientes.tsx        # Base de clientes
├── Promocoes.tsx       # Promoções e campanhas
├── Estoque.tsx         # Controle de estoque
├── Financeiro.tsx      # Indicadores financeiros
├── Relatorios.tsx      # Relatórios e análises
└── Configuracoes.tsx   # Configurações da loja
```

## Funcionalidades

### Categorias
- CRUD completo de categorias e subcategorias
- Imagens de capa
- Ordem de exibição
- Ativar/desativar categorias

### Produtos
- Cadastro de produtos com SKU automático
- Upload de imagens e GIFs
- Cálculo automático de margem de lucro
- Controle de estoque
- Estados: ativo, inativo, esgotado
- Suporte a produtos físicos e digitais

### Pedidos
- Número de pedido automático
- Estados do pedido
- Histórico de mudanças
- Integração com estoque

### Clientes
- Cadastro de clientes
- Histórico de compras
- Estatísticas de gastos
- Pesquisa e filtros

### Promoções
- Descontos percentuais e fixos
- Promoções por categoria/produto
- Códigos promocionais
- Campanhas sazonais

### Estoque
- Controle de entradas e saídas
- Alertas de estoque baixo
- Movimentações registradas
- Separação de produtos físicos e digitais

### Financeiro
- Faturamento bruto
- Custos de produção
- Lucro estimado
- Ticket médio
- Filtros por período

### Relatórios
- Análises de vendas
- Top produtos e categorias
- Estatísticas de clientes
- Exportação de dados

## Banco de Dados

### Tabelas Criadas
- `gif_categories` - Categorias da loja
- `gif_products` - Produtos/GIFs
- `gif_product_images` - Imagens adicionais
- `gif_customers` - Clientes
- `gif_orders` - Pedidos
- `gif_order_items` - Itens dos pedidos
- `gif_order_history` - Histórico de pedidos
- `gif_customizations` - Personalizações
- `gif_stock_movements` - Movimentações de estoque
- `gif_promotions` - Promoções
- `gif_promotion_products` - Produtos em promoção

### Migrations
- `0005_loja_gifs.sql` - Criação das tabelas e dados iniciais
- `0006_loja_gifs_rls.sql` - Políticas de segurança RLS

## Integração

- Usa a mesma infraestrutura de autenticação do MKON
- Chaves de API são universais (OpenAI, Groq, Gemini, etc.)
- Dados isolados das outras unidades de negócio
- Financeiro integrado ao sistema geral

## Rotas

- `/loja-gifs` - Dashboard
- `/loja-gifs/categorias` - Categorias
- `/loja-gifs/produtos` - Produtos
- `/loja-gifs/personalizacoes` - Personalizações
- `/loja-gifs/pedidos` - Pedidos
- `/loja-gifs/clientes` - Clientes
- `/loja-gifs/promocoes` - Promoções
- `/loja-gifs/estoque` - Estoque
- `/loja-gifs/financeiro` - Financeiro
- `/loja-gifs/relatorios` - Relatórios
- `/loja-gifs/configuracoes` - Configurações
