-- ============================================
-- SQL PARA PERMISSÕES DO SECRETÁRIO E DEVS
-- Permitir que Secretário e desenvolvedores 
-- possam excluir/criar qualquer usuário
-- ============================================

-- 1. Criar função para verificar se é Secretário ou Dev
CREATE OR REPLACE FUNCTION public.is_secretario_ou_dev(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
    user_email TEXT;
BEGIN
    -- Verificar o cargo do usuário
    SELECT role, email INTO user_role, user_email
    FROM public.profiles
    WHERE id = user_id;
    
    -- Verificar se é Secretário (qualquer variação)
    IF user_role ILIKE '%secretário%' OR user_role ILIKE '%secretario%' OR 
       user_role ILIKE '%secretária%' OR user_role ILIKE '%secretaria%' THEN
        RETURN TRUE;
    END IF;
    
    -- Verificar se é desenvolvedor (email contém dev ou é admin do sistema)
    IF user_email ILIKE '%dev@%' OR user_email ILIKE '%admin@%' OR 
       user_email ILIKE '%desenvolvedor%' OR user_role ILIKE '%admin%' THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Política RLS para permitir que Secretário/Dev DELETE qualquer perfil
DROP POLICY IF EXISTS "Permitir Secretario e Devs excluir qualquer perfil" ON public.profiles;

CREATE POLICY "Permitir Secretario e Devs excluir qualquer perfil"
ON public.profiles
FOR DELETE
TO authenticated
USING (
    is_secretario_ou_dev(auth.uid())
);

-- 3. Política RLS para permitir que Secretário/Dev UPDATE qualquer perfil
DROP POLICY IF EXISTS "Permitir Secretario e Devs atualizar qualquer perfil" ON public.profiles;

CREATE POLICY "Permitir Secretario e Devs atualizar qualquer perfil"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
    is_secretario_ou_dev(auth.uid())
)
WITH CHECK (
    is_secretario_ou_dev(auth.uid())
);

-- 4. Função para criar novo usuário (apenas Secretário/Dev)
CREATE OR REPLACE FUNCTION public.criar_novo_usuario(
    p_email TEXT,
    p_senha TEXT,
    p_nome TEXT,
    p_cargo TEXT,
    p_cpf TEXT DEFAULT NULL,
    p_matricula TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    new_user_id UUID;
BEGIN
    -- Verificar se quem está chamando é Secretário ou Dev
    IF NOT is_secretario_ou_dev(auth.uid()) THEN
        RAISE EXCEPTION 'Permissão negada: apenas Secretário ou Desenvolvedores podem criar usuários';
    END IF;
    
    -- Criar usuário no auth.users (usando admin API via RPC)
    -- Nota: Isso requer a extensão pg_net ou similar, ou fazer via Edge Function
    -- Alternativa: Inserir diretamente se tiver permissões suficientes
    
    INSERT INTO auth.users (
        email,
        encrypted_password,
        email_confirmed_at,
        raw_user_meta_data
    ) VALUES (
        p_email,
        crypt(p_senha, gen_salt('bf')),
        NOW(),
        jsonb_build_object('nome', p_nome, 'cargo', p_cargo)
    )
    RETURNING id INTO new_user_id;
    
    -- Criar perfil na tabela profiles
    INSERT INTO public.profiles (
        id,
        full_name,
        role,
        cpf,
        matricula,
        email
    ) VALUES (
        new_user_id,
        p_nome,
        p_cargo,
        p_cpf,
        p_matricula,
        p_email
    );
    
    RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Função para desativar/excluir usuário (soft delete)
CREATE OR REPLACE FUNCTION public.desativar_usuario(
    p_user_id UUID
)
RETURNS VOID AS $$
BEGIN
    -- Verificar se quem está chamando é Secretário ou Dev
    IF NOT is_secretario_ou_dev(auth.uid()) THEN
        RAISE EXCEPTION 'Permissão negada: apenas Secretário ou Desenvolvedores podem desativar usuários';
    END IF;
    
    -- Verificar se não está tentando excluir a si mesmo
    IF p_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Você não pode excluir a si mesmo';
    END IF;
    
    -- Marcar como inativo ao invés de deletar (soft delete)
    UPDATE public.profiles
    SET 
        role = 'inativo',
        ativo = FALSE,
        data_desativacao = NOW()
    WHERE id = p_user_id;
    
    -- Opcional: Desativar no auth.users também
    -- UPDATE auth.users SET banned_until = 'infinity' WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Função para exclusão permanente (hard delete) - apenas Devs
CREATE OR REPLACE FUNCTION public.excluir_usuario_permanente(
    p_user_id UUID
)
RETURNS VOID AS $$
DECLARE
    user_email TEXT;
BEGIN
    -- Verificar se é dev (apenas desenvolvedores podem excluir permanentemente)
    SELECT email INTO user_email FROM public.profiles WHERE id = auth.uid();
    
    IF user_email NOT ILIKE '%dev@%' AND user_email NOT ILIKE '%admin@%' THEN
        RAISE EXCEPTION 'Apenas desenvolvedores podem excluir usuários permanentemente';
    END IF;
    
    -- Verificar se não está tentando excluir a si mesmo
    IF p_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Você não pode excluir a si mesmo';
    END IF;
    
    -- Excluir da tabela profiles primeiro
    DELETE FROM public.profiles WHERE id = p_user_id;
    
    -- Excluir do auth.users
    DELETE FROM auth.users WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Adicionar coluna 'ativo' na tabela profiles se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'ativo') THEN
        ALTER TABLE public.profiles ADD COLUMN ativo BOOLEAN DEFAULT TRUE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'data_desativacao') THEN
        ALTER TABLE public.profiles ADD COLUMN data_desativacao TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- 8. Garantir que a tabela profiles tem RLS habilitado
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 9. Comentários explicativos
COMMENT ON FUNCTION public.is_secretario_ou_dev IS 'Verifica se o usuário é Secretário ou Desenvolvedor';
COMMENT ON FUNCTION public.criar_novo_usuario IS 'Cria novo usuário (apenas Secretário/Dev)';
COMMENT ON FUNCTION public.desativar_usuario IS 'Desativa usuário (soft delete) - apenas Secretário/Dev';
COMMENT ON FUNCTION public.excluir_usuario_permanente IS 'Exclui usuário permanentemente (apenas Devs)';

-- ============================================
-- INSTRUÇÕES DE USO:
-- ============================================
-- 
-- 1. Executar este SQL no Editor SQL do Supabase
--
-- 2. Para criar novo usuário (como Secretário/Dev):
--    SELECT criar_novo_usuario('email@teste.com', 'senha123', 'Nome Completo', 'Fiscal de Posturas', '123.456.789-00', 'MAT123');
--
-- 3. Para desativar usuário (soft delete):
--    SELECT desativar_usuario('UUID-DO-USUARIO');
--
-- 4. Para excluir permanentemente (apenas Devs):
--    SELECT excluir_usuario_permanente('UUID-DO-USUARIO');
--
-- ============================================
