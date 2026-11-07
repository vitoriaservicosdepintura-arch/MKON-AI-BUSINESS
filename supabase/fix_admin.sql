-- =====================================================================
-- MKON AI BUSINESS — Script de correção de acesso
-- Execute este script no Supabase SQL Editor se o login mostrar
-- "Acesso não autorizado".
--
-- COMO USAR:
-- 1. Vá a https://supabase.com/dashboard/project/vpnjrpipubqexdgpdvog/editor
-- 2. Cole e execute este script completo
-- =====================================================================

-- Passo 1: Ver utilizadores registados no Supabase Auth
SELECT id, email, created_at FROM auth.users ORDER BY created_at;

-- DEPOIS de ver o resultado acima, o seu utilizador já deve aparecer.
-- O script abaixo insere-o na tabela de administradores caso ainda não exista.
-- Substitua 'O_SEU_EMAIL@aqui.com' pelo email com que fez login.

-- Passo 2: Registar o proprietário na tabela administrators
INSERT INTO administrators (id, full_name, email, role)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', SPLIT_PART(u.email, '@', 1)) AS full_name,
  u.email,
  'owner'
FROM auth.users u
WHERE u.email = 'O_SEU_EMAIL@aqui.com'   -- <-- SUBSTITUA pelo seu email
ON CONFLICT (id) DO NOTHING;

-- Passo 3: Confirmar que ficou registado
SELECT id, full_name, email, role, created_at FROM administrators;
