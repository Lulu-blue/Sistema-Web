-- Correção da Tabela e Funções de Números Sequenciais
-- Executar no SQL Editor do Supabase

-- 1. Garantir que a coluna categoria_id existe na tabela de números disponíveis
ALTER TABLE IF EXISTS numeros_disponiveis 
ADD COLUMN IF NOT EXISTS categoria_id TEXT NOT NULL DEFAULT '1.4';

-- 2. Recriar a constraint UNIQUE para incluir categoria_id (evita conflitos ao devolver números)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'numeros_disponiveis_numero_sequencial_ano_key' AND table_name = 'numeros_disponiveis') THEN
        ALTER TABLE numeros_disponiveis DROP CONSTRAINT numeros_disponiveis_numero_sequencial_ano_key;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'numeros_disponiveis_numero_sequencial_ano_categoria_id_key' AND table_name = 'numeros_disponiveis') THEN
        ALTER TABLE numeros_disponiveis ADD CONSTRAINT numeros_disponiveis_numero_sequencial_ano_categoria_id_key UNIQUE(numero_sequencial, ano, categoria_id);
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- 3. Recriar a função reservar_numero_sequencial garantindo o filtro por categoria_id
CREATE OR REPLACE FUNCTION reservar_numero_sequencial(p_categoria_id TEXT, p_ano INTEGER)
RETURNS TEXT AS $$
DECLARE
    v_numero TEXT;
    v_digitos INTEGER;
    v_proximo INTEGER;
BEGIN
    -- Ofícios (1.4) usam 4 dígitos, os demais usam 3
    v_digitos := CASE WHEN p_categoria_id = '1.4' THEN 4 ELSE 3 END;

    -- 1. Tentar pegar da fila de disponíveis (filtrando ESTRITAMENTE pela categoria e ano)
    SELECT numero_sequencial INTO v_numero
    FROM numeros_disponiveis
    WHERE ano = p_ano AND categoria_id = p_categoria_id
    ORDER BY LPAD(split_part(numero_sequencial, '/', 1), 10, '0')
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_numero IS NOT NULL THEN
        -- Se encontrou na fila de descartados, remove para não ser usado de novo
        DELETE FROM numeros_disponiveis
        WHERE numero_sequencial = v_numero
          AND ano = p_ano
          AND categoria_id = p_categoria_id;
        RETURN v_numero;
    END IF;

    -- 2. Fila vazia: calcular próximo número via MAX numérico no controle_processual
    SELECT COALESCE(
        MAX(split_part(numero_sequencial, '/', 1)::integer),
        0
    ) + 1
    INTO v_proximo
    FROM controle_processual
    WHERE categoria_id = p_categoria_id
      AND numero_sequencial LIKE '%/' || p_ano;

    -- 3. Formatar número com zeros à esquerda
    RETURN LPAD(v_proximo::TEXT, v_digitos, '0') || '/' || p_ano;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Recriar a função devolver_numero_sequencial garantindo a inserção com a categoria correta
CREATE OR REPLACE FUNCTION devolver_numero_sequencial(p_numero TEXT, p_categoria_id TEXT, p_ano INTEGER)
RETURNS VOID AS $$
BEGIN
    INSERT INTO numeros_disponiveis (numero_sequencial, ano, categoria_id)
    VALUES (p_numero, p_ano, p_categoria_id)
    ON CONFLICT (numero_sequencial, ano, categoria_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
