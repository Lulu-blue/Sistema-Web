-- =====================================================================
-- MARCA DE LIMPEZA POR FISCAL  (banco SEMAC)
-- =====================================================================
--
-- Rode no SQL Editor do projeto SEMAC (marmpnusgmbjphffaynr) ANTES de
-- publicar a correção da sincronização.
--
-- Por que existe: a Limpeza Geral apaga os registros de produtividade dos
-- meses anteriores, mas a sincronização não tinha como saber disso e
-- recriava tudo na execução seguinte — com pontuação cheia, porque até o
-- dia 3 o mês anterior ainda é tolerado. Esta coluna guarda "limpei tudo
-- que é anterior a esta data"; a sincronização lê e para de recriar.
--
-- Fica no banco (e não só no navegador) para valer em qualquer aparelho
-- que o fiscal use.
-- =====================================================================

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS limpeza_realizada_ate timestamptz;

COMMENT ON COLUMN profiles.limpeza_realizada_ate IS
    'Data de corte da última Limpeza Geral do fiscal. A sincronização não recria '
    'registros de produtividade anteriores a ela, e insere no controle processual '
    'com pontuação 0. Gravada por executarLimpezaMensal() em produtividade.js.';

-- Confirmação
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'limpeza_realizada_ate';
