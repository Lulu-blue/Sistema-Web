-- =================================================================
-- SQL PARA GESTÃO DO CARGO: Secretário(a) do Secretário(a)
-- =================================================================

-- NOTA: O sistema já possui funções genéricas (is_secretario_ou_dev) 
-- que permitem ao Secretário gerenciar usuários. Este script 
-- fornece os comandos específicos para gerir o novo cargo.

-- 1. EXEMPLO: Criar um novo "Secretário(a) do Secretário(a)"
-- O Secretário principal pode executar este comando no SQL Editor:
-- SELECT public.criar_novo_usuario(
--     'email@exemplo.com',           -- Email
--     'Senha@123',                   -- Senha Temporária
--     'Nome do(a) Assistente',       -- Nome Completo
--     'Secretário(a) do Secretário(a)', -- Cargo (Exato como no JS)
--     '123.456.789-00',              -- CPF
--     'SEC-001'                      -- Matrícula
-- );


-- 2. EXEMPLO: Desativar um "Secretário(a) do Secretário(a)"
-- SELECT public.desativar_usuario('UUID-DO-USUARIO');


-- 3. TRANSFERÊNCIA DE CARGO (Promover/Alterar para o novo cargo)
-- Esta função permite mudar o cargo de um funcionário existente
CREATE OR REPLACE FUNCTION public.transferir_para_secretario_do_secretario(
    p_user_id UUID
)
RETURNS VOID AS $$
BEGIN
    -- Verificar se quem chama é Secretário ou Dev
    IF NOT public.is_secretario_ou_dev(auth.uid()) THEN
        RAISE EXCEPTION 'Permissão negada: apenas Secretário ou Desenvolvedores podem realizar transferências';
    END IF;

    -- Atualizar o cargo
    UPDATE public.profiles
    SET 
        role = 'Secretário(a) do Secretário(a)',
        ativo = TRUE
    WHERE id = p_user_id;

    -- Registrar log de alteração (opcional, se houver tabela de auditoria)
    -- INSERT INTO logs (user_id, acao) VALUES (auth.uid(), 'Transferiu usuário ' || p_user_id || ' para Sec do Sec');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.transferir_para_secretario_do_secretario IS 'Promove ou transfere um funcionário para o cargo de Secretário(a) do Secretário(a)';

-- =================================================================
-- INSTRUÇÕES ADICIONAIS:
-- =================================================================
-- Para usar a transferência de cargo via SQL:
-- SELECT public.transferir_para_secretario_do_secretario('UUID-DO-FUNCIONARIO');
-- =================================================================
