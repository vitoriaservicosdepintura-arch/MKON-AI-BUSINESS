# Como Executar as Migrations da Loja de GIFs

## ⚠️ IMPORTANTE: Execute o Script Seguro

Use o arquivo **`0005_loja_gifs_safe.sql`** que é seguro para executar múltiplas vezes.

## Passo a Passo

1. **Acesse o Supabase Dashboard**
   - Vá para https://supabase.com/dashboard
   - Selecione seu projeto

2. **Abra o SQL Editor**
   - Menu lateral → "SQL Editor" → "New query"

3. **Execute o script SQL**
   - Copie o conteúdo do arquivo `0005_loja_gifs_safe.sql`
   - Cole no SQL Editor
   - Clique em "Run" ou "Execute"

4. **Verifique o sucesso**
   - Você deve ver uma mensagem de sucesso
   - Não deve haver erros

## O que o script faz

O script `0005_loja_gifs_safe.sql` é **seguro para executar múltiplas vezes** porque:

- ✅ Remove tipos e tabelas existentes antes de recriar
- ✅ Usa `if not exists` onde possível
- ✅ Não causa erros de "already exists"
- ✅ Cria todas as tabelas, índices, triggers e políticas RLS
- ✅ Insere categorias iniciais
- ✅ Configura buckets do Supabase Storage

## Verificação

Após executar, verifique se as tabelas foram criadas:

```sql
select table_name 
from information_schema.tables 
where table_schema = 'public' 
  and table_name like 'gif_%'
order by table_name;
```

## Se houver erros

Se receber erros de permissão:
- Verifique se você está logado como administrador
- Certifique-se de ter permissão para criar tabelas

Se receber erros de "relation does not exist":
- Isso pode significar que a tabela `administrators` não existe
- Verifique se as migrations anteriores foram executadas

## Arquivos disponíveis

- `0005_loja_gifs.sql` - Migration original (pode dar erros se executado múltiplas vezes)
- `0005_loja_gifs_complete.sql` - Script completo (pode dar erros de "already exists")
- `0005_loja_gifs_safe.sql` - **RECOMENDADO** - Script seguro

## Próximos passos

Após executar o script com sucesso:
1. Acesse a aplicação
2. Vá para "Loja de GIFs" no menu lateral
3. Todas as seções devem funcionar corretamente
