# Como Executar as Migrations da Loja de GIFs

## Passo a Passo

1. **Acesse o Supabase Dashboard**
   - Vá para https://supabase.com/dashboard
   - Selecione seu projeto

2. **Abra o SQL Editor**
   - No menu lateral, clique em "SQL Editor"
   - Clique em "New query"

3. **Execute o script SQL**
   - Copie o conteúdo do arquivo `0005_loja_gifs_complete.sql`
   - Cole no SQL Editor
   - Clique em "Run" ou "Execute"

4. **Verifique se foi executado com sucesso**
   - Você deve ver uma mensagem de sucesso
   - Não deve haver erros

## Verificação

Após executar, você pode verificar se as tabelas foram criadas:

```sql
-- Verificar se as tabelas existem
select table_name 
from information_schema.tables 
where table_schema = 'public' 
  and table_name like 'gif_%'
order by table_name;
```

## Se houver erros

Se você receber erros como "relation already exists", isso significa que as tabelas já existem. Você pode ignorar esses erros e continuar.

Se receber erros de permissão, verifique se você está logado como administrador no Supabase.

## Arquivos de Migration

O projeto tem 3 arquivos de migration:
- `0005_loja_gifs.sql` - Tabelas e dados básicos
- `0006_loja_gifs_rls.sql` - Políticas de segurança
- `0007_loja_gifs_storage.sql` - Buckets do Storage

**Recomendação:** Execute o arquivo `0005_loja_gifs_complete.sql` que contém tudo em um único script.
