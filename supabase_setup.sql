-- =============================================
-- TABELA: registros_produtividade
-- Armazena cada registro de atividade do fiscal
-- =============================================
CREATE TABLE registros_produtividade (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    categoria_id TEXT NOT NULL,          -- ex: '2', '3', '4'...
    categoria_nome TEXT NOT NULL,        -- ex: 'Vistorias de limpeza de vias...'
    pontuacao INTEGER NOT NULL DEFAULT 0,
    campos JSONB NOT NULL DEFAULT '{}',  -- campos preenchidos (flexível por categoria)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_reg_user ON registros_produtividade(user_id);
CREATE INDEX idx_reg_categoria ON registros_produtividade(categoria_id);
CREATE INDEX idx_reg_created ON registros_produtividade(created_at DESC);

-- RLS (Row Level Security) - cada fiscal vê apenas seus próprios registros
ALTER TABLE registros_produtividade ENABLE ROW LEVEL SECURITY;

-- Política: fiscal pode ver apenas seus registros
CREATE POLICY "Fiscal vê próprios registros"
    ON registros_produtividade
    FOR SELECT
    USING (auth.uid() = user_id);

-- Política: fiscal pode inserir apenas seus registros
CREATE POLICY "Fiscal insere próprios registros"
    ON registros_produtividade
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Política: fiscal pode deletar apenas seus registros
CREATE POLICY "Fiscal deleta próprios registros"
    ON registros_produtividade
    FOR DELETE
    USING (auth.uid() = user_id);

-- Política: fiscal pode editar apenas seus registros
CREATE POLICY "Fiscal edita próprios registros"
    ON registros_produtividade
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- =============================================
-- TABELA: controle_processual
-- Histórico geral compartilhado entre fiscais
-- =============================================
CREATE TABLE controle_processual (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    fiscal_nome TEXT NOT NULL,
    categoria_id TEXT NOT NULL,
    categoria_nome TEXT NOT NULL,
    numero_sequencial TEXT,
    pontuacao INTEGER NOT NULL DEFAULT 0,
    campos JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cp_user ON controle_processual(user_id);
CREATE INDEX idx_cp_categoria ON controle_processual(categoria_id);
CREATE INDEX idx_cp_created ON controle_processual(created_at DESC);
CREATE INDEX idx_cp_numero ON controle_processual(numero_sequencial);

ALTER TABLE controle_processual ENABLE ROW LEVEL SECURITY;

-- Todos os fiscais podem VER todos os registros
CREATE POLICY "Todos veem registros CP"
    ON controle_processual
    FOR SELECT
    USING (true);

-- Fiscal insere apenas seus registros
CREATE POLICY "Fiscal insere próprios registros CP"
    ON controle_processual
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Fiscal edita apenas seus registros
CREATE POLICY "Fiscal edita próprios registros CP"
    ON controle_processual
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Fiscal deleta apenas seus registros
CREATE POLICY "Fiscal deleta próprios registros CP"
    ON controle_processual
    FOR DELETE
    USING (auth.uid() = user_id);

-- =============================================
-- STORAGE: bucket 'anexos' para PDFs
-- Criar via Dashboard: Storage > New Bucket > "anexos" (público)
-- =============================================
-- Política: qualquer pessoa autenticada pode ler
INSERT INTO storage.buckets (id, name, public) VALUES ('anexos', 'anexos', true)
ON CONFLICT (id) DO NOTHING;

-- Fiscais podem fazer upload na pasta do seu user_id
CREATE POLICY "Fiscal faz upload de anexos"
    ON storage.objects
    FOR INSERT
    WITH CHECK (bucket_id = 'anexos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Todos podem ler anexos (bucket público)
CREATE POLICY "Anexos públicos para leitura"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'anexos');

-- Fiscal pode deletar seus próprios anexos
CREATE POLICY "Fiscal deleta próprios anexos"
    ON storage.objects
    FOR DELETE
    USING (bucket_id = 'anexos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =============================================
-- STORAGE: bucket 'avatars' para fotos de perfil
-- Criar via Dashboard: Storage > New Bucket > "avatars" (público)
-- =============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Usuário autenticado faz upload de SEU avatar
CREATE POLICY "Usuário faz upload no seu avatar"
    ON storage.objects
    FOR INSERT
    WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Usuário atualiza (sobrescreve) o seu próprio avatar
CREATE POLICY "Usuário atualiza o seu avatar"
    ON storage.objects
    FOR UPDATE
    USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1])
    WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Usuário deleta o seu próprio avatar
CREATE POLICY "Usuário deleta o seu avatar"
    ON storage.objects
    FOR DELETE
    USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Todos (até anônimos, pois o bucket é public) podem ler avatares
CREATE POLICY "Avatares públicos para leitura"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'avatars');

-- =============================================
-- TABELA: profiles
-- Configurações de RLS para a tabela de Perfis
-- =============================================
-- Isso garante que a tabela possa ser lida caso o RLS seja ativado no Supabase.

-- Politica: Qualquer usuário autenticado ou anônimo pode ler os perfis (útil para ver o cargo na hora do login).
CREATE POLICY "Leitura publica de perfis"
    ON profiles
    FOR SELECT
    USING (true);

-- Politica: Usuário pode atualizar o seu próprio perfil
CREATE POLICY "Usuário atualiza proprio perfil"
    ON profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
