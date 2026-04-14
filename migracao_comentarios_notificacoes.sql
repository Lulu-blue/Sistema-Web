-- =====================================================
-- MIGRAÇÃO: Comentários em Tarefas + Sistema de Notificações
-- Execute este script no SQL Editor do Supabase
-- =====================================================

-- 1. Tabela de comentários em tarefas
CREATE TABLE IF NOT EXISTS public.tarefa_comentarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tarefa_id UUID NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_name TEXT,
    texto TEXT NOT NULL,
    anexo_url TEXT,
    anexo_nome TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de anexos de comentários
CREATE TABLE IF NOT EXISTS public.tarefa_comentario_anexos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comentario_id UUID NOT NULL REFERENCES public.tarefa_comentarios(id) ON DELETE CASCADE,
    nome_arquivo TEXT NOT NULL,
    url TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Políticas RLS para tarefa_comentarios
ALTER TABLE public.tarefa_comentarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Comentários: SELECT para autenticados" ON public.tarefa_comentarios;
CREATE POLICY "Comentários: SELECT para autenticados" ON public.tarefa_comentarios
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Comentários: INSERT para autenticados" ON public.tarefa_comentarios;
CREATE POLICY "Comentários: INSERT para autenticados" ON public.tarefa_comentarios
FOR INSERT TO authenticated WITH CHECK (true);

-- Políticas RLS para tarefa_comentario_anexos
ALTER TABLE public.tarefa_comentario_anexos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anexos comentário: SELECT para autenticados" ON public.tarefa_comentario_anexos;
CREATE POLICY "Anexos comentário: SELECT para autenticados" ON public.tarefa_comentario_anexos
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anexos comentário: INSERT para autenticados" ON public.tarefa_comentario_anexos;
CREATE POLICY "Anexos comentário: INSERT para autenticados" ON public.tarefa_comentario_anexos
FOR INSERT TO authenticated WITH CHECK (true);

-- 3. Tabela de visualizações de tarefas
CREATE TABLE IF NOT EXISTS public.tarefa_visualizacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tarefa_id UUID NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    visualizado_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(tarefa_id, user_id)
);

-- Políticas RLS para tarefa_visualizacoes
ALTER TABLE public.tarefa_visualizacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Visualizações: SELECT para autenticados" ON public.tarefa_visualizacoes;
CREATE POLICY "Visualizações: SELECT para autenticados" ON public.tarefa_visualizacoes
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Visualizações: INSERT para autenticados" ON public.tarefa_visualizacoes;
CREATE POLICY "Visualizações: INSERT para autenticados" ON public.tarefa_visualizacoes
FOR INSERT TO authenticated WITH CHECK (true);

-- =====================================================
-- GARANTIR ON DELETE CASCADE NAS TABELAS EXISTENTES
-- =====================================================

-- 1. tarefa_anexos -> tarefas
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'tarefa_anexos' AND constraint_name = 'tarefa_anexos_tarefa_id_fkey'
    ) THEN
        ALTER TABLE public.tarefa_anexos
        DROP CONSTRAINT tarefa_anexos_tarefa_id_fkey;
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.tarefa_anexos
ADD CONSTRAINT tarefa_anexos_tarefa_id_fkey
FOREIGN KEY (tarefa_id) REFERENCES public.tarefas(id) ON DELETE CASCADE;

-- 2. tarefa_responsaveis -> tarefas
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'tarefa_responsaveis' AND constraint_name = 'tarefa_responsaveis_tarefa_id_fkey'
    ) THEN
        ALTER TABLE public.tarefa_responsaveis
        DROP CONSTRAINT tarefa_responsaveis_tarefa_id_fkey;
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.tarefa_responsaveis
ADD CONSTRAINT tarefa_responsaveis_tarefa_id_fkey
FOREIGN KEY (tarefa_id) REFERENCES public.tarefas(id) ON DELETE CASCADE;

-- 3. tarefas (subtarefas) -> tarefas
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'tarefas' AND constraint_name = 'tarefas_tarefa_pai_id_fkey'
    ) THEN
        ALTER TABLE public.tarefas
        DROP CONSTRAINT tarefas_tarefa_pai_id_fkey;
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.tarefas
ADD CONSTRAINT tarefas_tarefa_pai_id_fkey
FOREIGN KEY (tarefa_pai_id) REFERENCES public.tarefas(id) ON DELETE CASCADE;

-- 2. Tabela de notificações
CREATE TABLE IF NOT EXISTS public.notificacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL DEFAULT 'comentario_tarefa',
    titulo TEXT NOT NULL,
    mensagem TEXT,
    tarefa_id UUID REFERENCES public.tarefas(id) ON DELETE CASCADE,
    lida BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índice para performance
CREATE INDEX IF NOT EXISTS idx_notificacoes_user_id_lida ON public.notificacoes(user_id, lida);
CREATE INDEX IF NOT EXISTS idx_notificacoes_created_at ON public.notificacoes(created_at DESC);

-- Políticas RLS para notificacoes
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Notificações: SELECT próprias" ON public.notificacoes;
CREATE POLICY "Notificações: SELECT próprias" ON public.notificacoes
FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Notificações: INSERT para autenticados" ON public.notificacoes;
CREATE POLICY "Notificações: INSERT para autenticados" ON public.notificacoes
FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Notificações: UPDATE próprias" ON public.notificacoes;
CREATE POLICY "Notificações: UPDATE próprias" ON public.notificacoes
FOR UPDATE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Notificações: DELETE próprias" ON public.notificacoes;
CREATE POLICY "Notificações: DELETE próprias" ON public.notificacoes
FOR DELETE TO authenticated USING (user_id = auth.uid());
