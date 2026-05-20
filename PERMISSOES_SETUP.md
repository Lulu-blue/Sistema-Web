# 🔐 Configuração de Permissões Hierárquicas

Este guia documenta as permissões reais do banco de dados Supabase do SEMAC, consolidando políticas RLS, hierarquia de cargos e tabelas do sistema.

> **Última atualização:** Abril/2026 (sincronizado com os CSVs de políticas do Supabase)

---

## 📋 Resumo da Hierarquia

```
Secretário(a) (nível 4)
 ├── Diretor(a) de Meio Ambiente (nível 3)
 │    ├── Gerente de Posturas (nível 2) → Fiscal (nível 1)
 │    ├── Gerente de Regularização Ambiental (nível 2) → Equipe Ambiental (nível 1)
 │    └── Consórcio (nível 2) → Analista do Consórcio (nível 1)
 ├── Diretor(a) do Cuidado Animal (nível 3)
 │    └── Gerente do Cuidado Animal (nível 2)
 │         └── Coordenador(a) do Cuidado Animal (nível 1)
 ├── Gerente de Interface Jurídica (Cargo Especial)
 └── Agente de Administração (Cargo Especial)

Permissões de exclusão:
Secretário(a) → pode excluir: Diretor, Gerente, Fiscal, Equipe Ambiental, Consórcio, Analista do Consórcio
Diretor(a) → pode excluir: Gerente, Fiscal, Equipe Ambiental, Consórcio, Analista do Consórcio
Gerente → pode excluir: Fiscal, Equipe Ambiental
Consórcio → pode excluir: Analista do Consórcio
```


### Instalar Supabase CLI
```bash
npm install -g supabase
```

### Login e Link
```bash
supabase login
supabase link --project-ref seu-project-ref-aqui
```

### Criar a Edge Function
```bash
supabase functions new delete-user
```

### Criar o arquivo da função

Crie o arquivo `supabase/functions/delete-user/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userIdToDelete, adminCpf, adminPassword } = await req.json()
    
    // Validar inputs
    if (!userIdToDelete || !adminCpf || !adminPassword) {
      return new Response(
        JSON.stringify({ error: 'Dados incompletos' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Criar client com service_role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    // Verificar se quem está pedindo é admin/gerente
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email: adminCpf.replace(/\D/g, '') + '@email.com',
      password: adminPassword
    })
    
    if (authError || !authData.user) {
      return new Response(
        JSON.stringify({ error: 'Autenticação falhou' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Verificar cargo do admin
    const { data: adminProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, full_name')
      .eq('id', authData.user.id)
      .single()
    
    if (profileError) {
      return new Response(
        JSON.stringify({ error: 'Erro ao verificar perfil' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Verificar se é cargo permitido
    const allowedRoles = [
      'Gerente de Posturas', 'Gerente', 'gerente', 'gerente de posturas',
      'Diretor(a) de Meio Ambiente', 'Diretor(a)', 'diretor', 'diretor de meio ambiente',
      'Secretário(a)', 'secretário', 'secretario'
    ]
    
    if (!allowedRoles.includes(adminProfile?.role)) {
      return new Response(
        JSON.stringify({ error: 'Permissão negada: ' + adminProfile?.role }), 
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Verificar nível hierárquico
    const getNivel = (role: string) => {
      if (!role) return 0
      const r = role.toLowerCase()
      if (r.includes('secretário') || r.includes('secretario')) return 3
      if (r.includes('diretor')) return 2
      if (r.includes('gerente')) return 1
      return 0
    }
    
    // Buscar nível do alvo
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('role, full_name')
      .eq('id', userIdToDelete)
      .single()
    
    const nivelAdmin = getNivel(adminProfile?.role)
    const nivelAlvo = getNivel(targetProfile?.role)
    
    if (nivelAdmin <= nivelAlvo) {
      return new Response(
        JSON.stringify({ error: 'Você não pode excluir alguém do mesmo nível ou superior' }), 
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Deletar da tabela profiles primeiro
    const { error: deleteProfileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userIdToDelete)
    
    if (deleteProfileError) {
      return new Response(
        JSON.stringify({ error: 'Erro ao deletar perfil: ' + deleteProfileError.message }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Deletar de auth.users
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userIdToDelete)
    
    if (deleteAuthError) {
      return new Response(
        JSON.stringify({ error: 'Erro ao deletar usuário: ' + deleteAuthError.message }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Usuário ${targetProfile?.full_name} excluído com sucesso`,
        deletedBy: adminProfile?.full_name
      }), 
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Erro interno: ' + error.message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

### Passo 5: Deploy
```bash
supabase functions deploy delete-user
```

### Passo 6: Atualizar o JavaScript

No arquivo `gerente.js`, atualize a função `executarExclusaoFiscal`:

```javascript
async function executarExclusaoFiscal(fiscalId, nomeFiscal) {
    const cpfGerente = document.getElementById('excluir-cpf-gerente').value.replace(/\D/g, '');
    const senhaGerente = document.getElementById('excluir-senha-gerente').value;
    const confirmacao = document.getElementById('excluir-confirmacao').value.trim();
    const msgEl = document.getElementById('msg-excluir-fiscal');
    const btnExcluir = document.getElementById('btn-confirmar-exclusao');

    // Validações...
    if (confirmacao !== 'EXCLUIR') {
        msgEl.textContent = 'Digite EXCLUIR para confirmar.';
        msgEl.style.color = '#ef4444';
        return;
    }

    btnExcluir.textContent = 'Excluindo...';
    btnExcluir.disabled = true;
    msgEl.textContent = '';

    try {
        // Chamar a Edge Function
        const { data, error } = await supabaseClient.functions.invoke('delete-user', {
            body: {
                userIdToDelete: fiscalId,
                adminCpf: cpfGerente,
                adminPassword: senhaGerente
            }
        });

        if (error) {
            throw error;
        }

        if (data.success) {
            alert('Fiscal excluído com sucesso!');
            document.getElementById('modal-excluir-fiscal').remove();
            // Recarregar lista
            if (typeof carregarGraficoFiscais === 'function') carregarGraficoFiscais();
        } else {
            throw new Error(data.error || 'Erro desconhecido');
        }

    } catch (err) {
        console.error('Erro ao excluir:', err);
        msgEl.textContent = 'Erro: ' + (err.message || 'Falha na exclusão');
        msgEl.style.color = '#ef4444';
        btnExcluir.textContent = 'Confirmar Exclusão';
        btnExcluir.disabled = false;
    }
}
```

---

## Permissões Especiais do Secretário e Desenvolvedores

Para permitir que **Secretários** e **Desenvolvedores** possam **criar e excluir qualquer usuário** no sistema:


### Uso das Funções

#### Criar Novo Usuário (apenas Secretário/Dev):
```sql
SELECT criar_novo_usuario(
    'email@exemplo.com',     -- email
    'senhaSegura123',        -- senha
    'Nome Completo',         -- nome
    'Fiscal de Posturas',    -- cargo
    '123.456.789-00',        -- CPF (opcional)
    'MAT123'                 -- matrícula (opcional)
);
```

#### Desativar Usuário (soft delete - apenas Secretário/Dev):
```sql
SELECT desativar_usuario('UUID-DO-USUARIO');
```

#### Excluir Permanentemente (apenas Desenvolvedores):
```sql
SELECT excluir_usuario_permanente('UUID-DO-USUARIO');
```

### Requisitos para Identificação

O sistema identifica Secretários/Desenvolvedores por:

| Tipo | Critério |
|------|----------|
| **Secretário** | Campo `role` contém "Secretário", "Secretario", "Secretária" ou "Secretaria" |
| **Desenvolvedor** | Campo `email` contém "dev@", "admin@", ou "desenvolvedor"; OU `role` contém "admin" |

### Segurança

- ✅ Apenas Secretários e Devs podem executar estas funções
- ✅ Não é possível excluir a si mesmo
- ✅ Soft delete preserva dados do usuário (marca como inativo)
- ✅ Hard delete apenas para desenvolvedores (usa com cuidado!)
- ✅ Todas as operações verificam permissão antes de executar

---

## 🛡️ Configuração das Variáveis de Ambiente

No Supabase Dashboard:

1. Vá em "Settings" > "API"
2. Copie a "service_role key" (⚠️ mantenha em segredo!)
3. Vá em "Edge Functions" > "Manage secrets"
4. Adicione:
   - `SUPABASE_URL`: sua URL do Supabase
   - `SUPABASE_SERVICE_ROLE_KEY`: a chave de serviço

---

## ✅ Testando

1. Faça login como Gerente
2. Clique no ícone de lixeira ao lado de um Fiscal
3. Digite seu CPF, senha e "EXCLUIR"
4. O usuário deve ser removido completamente

---

## 📝 Logs de Exclusão

Para manter um registro de exclusões, consulte a tabela `exclusao_logs`:

```sql
SELECT * FROM public.exclusao_logs ORDER BY created_at DESC;
```

> **Nota:** A tabela antiga `log_exclusoes` foi descontinuada. Use `exclusao_logs`.

---

## 🆘 Solução de Problemas

### Erro: "Permissão negada"
- Verifique se o cargo do usuário está correto na tabela `profiles`
- Certifique-se de que a política RLS foi aplicada

### Erro: "Failed to send a request to the Edge Function"
- Verifique se a função foi deployada corretamente
- Confirme as variáveis de ambiente

### Erro: "Invalid credentials"
- O CPF e senha do gerente devem estar corretos
- O CPF deve estar no formato com ou sem pontuação

---

## 🔒 Segurança

⚠️ **IMPORTANTE:**
- Nunca exponha a `service_role_key` no frontend
- Sempre use Edge Functions para operações administrativas
- Mantenha logs de todas as exclusões
- Considere implementar um sistema de aprovação para exclusões

---

## 🏗️ Anexo A: Configuração de Novo Cargo - Secretário(a) do Secretário(a)

O sistema permite que o Secretário principal promova servidores para o cargo via SQL:

```sql
CREATE OR REPLACE FUNCTION public.transferir_para_secretario_do_secretario(
    p_user_id UUID
)
RETURNS VOID AS $$
BEGIN
    IF NOT public.is_secretario_ou_dev(auth.uid()) THEN
        RAISE EXCEPTION 'Permissão negada';
    END IF;

    UPDATE public.profiles
    SET role = 'Secretário(a) do Secretário(a)', ativo = TRUE
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Uso: `SELECT public.transferir_para_secretario_do_secretario('UUID-AQUI');`

---

## 🗃️ Anexo B: Catálogo Completo de Políticas RLS por Tabela

> Este anexo foi gerado a partir dos dados reais exportados do Supabase (arquivos CSV). Reflete o estado atual do banco em produção.

### Tabela: `areas` (Áreas de Atuação)

| Política | Comando | Público | Restrição |
|----------|---------|---------|-----------|
| Gerencia altera areas | ALL | authenticated | Apenas Gerentes, Diretores, Secretários e admins |
| Visualizacao publica de areas | SELECT | public | Livre |

**Resumo:** Visualização pública. Alterações restritas à gerência.

---

### Tabela: `bairros` (Bairros Mapeados)

| Política | Comando | Público | Restrição |
|----------|---------|---------|-----------|
| Gerencia altera bairros | ALL | authenticated | Apenas Gerentes, Diretores, Secretários e admins |
| Visualizacao publica de bairros | SELECT | public | Livre |

**Resumo:** Visualização pública. Alterações restritas à gerência.

---

### Tabela: `controle_processual` (Documentos Oficiais)

| Política | Comando | Público | Restrição |
|----------|---------|---------|-----------|
| Admin_Update_Processual_Completa | UPDATE | public | Admin, Administrador de Posturas, Gerente de Posturas |
| Fiscal deleta próprios registros CP | DELETE | authenticated | `user_id = auth.uid()` |
| Gerencia pode ver todos os registros CP | SELECT | authenticated | `get_nivel_hierarquico() >= 1` OU dono |
| Gerente pode ler todos os registros de CP | SELECT | public | Dono OU roles gerente/admin |
| Gerentes podem deletar CP | DELETE | authenticated | `role = 'Gerente de Posturas'` |
| Permitir insert para o proprio usuario | INSERT | authenticated | `user_id = auth.uid()` |
| Permitir update em controle_processual para admin | UPDATE | public | Admin, Administrador, Gerente de Posturas, Gerente Fiscal |
| Permitir update para o proprio usuario | UPDATE | authenticated | `user_id = auth.uid()` |
| Todos veem registros CP | SELECT | public | Livre |

**Resumo:** Todos visualizam. Fiscais inserem/editam/deletam apenas os próprios. Gerentes e admins têm poderes amplos de gestão.

---

### Tabela: `eventos` (Calendário de Eventos/Projetos)

| Política | Comando | Público | Restrição |
|----------|---------|---------|-----------|
| Eventos: atualização para autenticados | UPDATE | authenticated | Livre |
| Eventos: exclusão para autenticados | DELETE | authenticated | Livre |
| Eventos: inserção para autenticados | INSERT | authenticated | Livre |
| Eventos: leitura para todos autenticados | SELECT | authenticated | Livre |

**Resumo:** Qualquer usuário autenticado pode criar, editar e excluir eventos. Controle de criação é feito no frontend (apenas Diretor/Secretário).

#### Schema da Tabela `eventos`

```sql
-- Criação completa (para novas instalações)
CREATE TABLE IF NOT EXISTS public.eventos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo TEXT DEFAULT 'evento',
    titulo TEXT NOT NULL,
    descricao TEXT,
    data_inicio TIMESTAMP WITH TIME ZONE,
    data_fim TIMESTAMP WITH TIME ZONE,
    cor TEXT DEFAULT '#3b82f6',
    criado_por UUID REFERENCES auth.users(id),
    responsavel_id UUID REFERENCES auth.users(id),
    localizacao TEXT,
    parcerias JSONB DEFAULT '[]'::jsonb,
    orcamentos JSONB DEFAULT '[]'::jsonb,
    patrocinios JSONB DEFAULT '[]'::jsonb,
    responsaveis TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Adicionar colunas faltantes em bancos existentes (executar no SQL Editor do Supabase)
ALTER TABLE public.eventos
ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'evento',
ADD COLUMN IF NOT EXISTS localizacao TEXT,
ADD COLUMN IF NOT EXISTS parcerias JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS orcamentos JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS patrocinios JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS responsaveis TEXT;
```

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | PK, auto |
| `tipo` | TEXT | `evento` ou `projeto` |
| `titulo` | TEXT | Título do evento |
| `descricao` | TEXT | Descrição detalhada |
| `data_inicio` | TIMESTAMPTZ | Data/hora de início |
| `data_fim` | TIMESTAMPTZ | Data/hora de término |
| `cor` | TEXT | Cor hexadecimal do evento |
| `criado_por` | UUID | FK → auth.users |
| `responsavel_id` | UUID | FK → auth.users (responsável principal) |
| `localizacao` | TEXT | Endereço/local do evento |
| `parcerias` | JSONB | Array de strings com parceiros |
| `orcamentos` | JSONB | Array de objetos `{descricao, valor, data}` |
| `patrocinios` | JSONB | Array de objetos `{descricao, valor, data}` |
| `responsaveis` | TEXT | Nomes dos responsáveis (exibição rápida) |
| `created_at` | TIMESTAMPTZ | Data de criação |

---

### Tabela: `exclusao_logs` (Logs de Exclusão)

| Política | Comando | Público | Restrição |
|----------|---------|---------|-----------|
| exclusao_logs_insert | INSERT | authenticated | Livre |
| exclusao_logs_select | SELECT | authenticated | Livre |

**Resumo:** Registro de exclusões. Tabela substituiu a antiga `log_exclusoes`.

---

### Tabela: `notificacoes` (Sistema de Notificações)

| Política | Comando | Público | Restrição |
|----------|---------|---------|-----------|
| Notificações: DELETE próprias | DELETE | authenticated | `user_id = auth.uid()` |
| Notificações: INSERT para autenticados | INSERT | authenticated | Livre |
| Notificações: SELECT próprias | SELECT | authenticated | `user_id = auth.uid()` |
| Notificações: UPDATE próprias | UPDATE | authenticated | `user_id = auth.uid()` |

**Resumo:** Cada usuário vê, edita e apaga apenas suas próprias notificações. Qualquer um pode inserir notificações para outros.

---

### Tabela: `profiles` (Perfis de Usuários)

> Possui **26 políticas RLS** — a tabela mais complexa do sistema.

#### Políticas de Inserção (INSERT)
| Política | Restrição |
|----------|-----------|
| Diretor CA cria usuarios CA | Diretor do Cuidado Animal cria Gerentes/Coordenadores CA |
| Diretores podem inserir perfis | Diretores e Secretários |
| Gerente CA cria coordenadores | Gerente do Cuidado Animal cria Coordenadores CA |
| Gerente pode cadastrar novos perfis | Gerentes Fiscais, Gerentes e Admins |
| Gestão Total do Secretário | Secretários têm poder total |
| Permitir insercao por gestores | Qualquer gestor (Secretário, Diretor, Gerente) ativo |
| Permitir insert para diretores e secretarios | Diretores e Secretários |
| Secretario cria usuarios | Secretários ativos |
| Secretário pode inserir novos perfis | Secretários |
| Usuario pode criar seu proprio perfil | `auth.uid() = id` (public) |
| profiles_insert | Livre para authenticated |

#### Políticas de Atualização (UPDATE)
| Política | Restrição |
|----------|-----------|
| Editar próprio perfil | `auth.uid() = id` |
| Gerente atualiza perfis | Gerentes, Gerentes Fiscais, Admins |
| Gerente pode atualizar perfis | Dono OU Gerente Fiscal/Gerente/Admin |
| Gestão de Diretores sobre Gerentes | Diretores, Secretários OU dono |
| Permitir atualizacao por gestores ou proprio | Gestor ativo que pode gerenciar o alvo |
| Permitir desativacao hierarquica | Hierarquia: Secretário > Diretor > Gerente > Fiscal |
| Permitir update hierarquico | `get_nivel_hierarquico()` maior que o do alvo |
| Permitir update para diretores e secretarios | Diretores, Secretários OU dono |
| Usuário atualiza proprio perfil | `auth.uid() = id` (public) |
| profiles_update | Livre para authenticated |

#### Políticas de Exclusão (DELETE)
| Política | Restrição |
|----------|-----------|
| Gerente pode excluir perfis | Gerentes Fiscais, Gerentes, Admins |
| Gestão Total do Secretário | Secretários têm poder total |
| Gestão de Diretores sobre Gerentes | Diretores, Secretários OU dono |
| Permitir exclusao hierarquica | `pode_excluir_usuario(id)` |

#### Políticas de Leitura (SELECT)
| Política | Restrição |
|----------|-----------|
| Leitura publica de perfis | Livre (public) |
| Perfis visíveis para todos | Livre (authenticated) |
| Permitir select para todos autenticados | Livre (authenticated) |
| profiles_select | Livre (authenticated) |

**Resumo:** Hierarquia rigorosa. Secretários têm gestão total. Diretores gerenciam Gerentes e abaixo. Gerentes gerenciam Fiscais e abaixo. Cada um edita o próprio perfil.

---

### Tabela: `registros_produtividade` (Produtividade Comum)

| Política | Comando | Público | Restrição |
|----------|---------|---------|-----------|
| Fiscal deleta próprios registros | DELETE | public | `auth.uid() = user_id` |
| Fiscal edita próprios registros | UPDATE | public | `auth.uid() = user_id` |
| Fiscal insere próprios registros | INSERT | public | `auth.uid() = user_id` |
| Fiscal vê próprios registros | SELECT | public | `auth.uid() = user_id` |
| Gerencia pode ver todos os registros | SELECT | authenticated | `get_nivel_hierarquico() >= 1` OU dono |
| Gerente pode ler todos os registros de produtividade | SELECT | public | Dono OU roles gerente/admin |
| Gerentes podem deletar Produtividade | DELETE | authenticated | `role = 'Gerente de Posturas'` |
| Permitir insert para registros comuns | INSERT | authenticated | `user_id = auth.uid()` |
| Permitir update para registros comuns | UPDATE | authenticated | `user_id = auth.uid()` |

**Resumo:** Similar ao `controle_processual`. Fiscais gerenciam apenas os próprios registros. Gerência visualiza tudo e pode deletar.

---

### Tabela: `tarefas` (Tarefas e Subtarefas)

| Política | Comando | Público | Restrição |
|----------|---------|---------|-----------|
| Agente Administracao ve proprias tarefas | ALL | authenticated | Agente de Administração + dono/responsável |
| Coordenador Cuidado Animal ve proprias tarefas | SELECT | authenticated | Coordenador CA + dono/responsável |
| Diretor Cuidado Animal ve todas tarefas CA | SELECT | authenticated | Diretor CA vê toda a equipe CA |
| Gerente Cuidado Animal ve tarefas da equipe | SELECT | authenticated | Gerente CA vê tarefas dos coordenadores |
| Gerente Interface Juridica ve proprias tarefas | ALL | authenticated | Gerente Jurídico + dono/responsável |
| Secretario ve todas tarefas | ALL | authenticated | Secretários têm poder total |
| Tarefas: atualização | UPDATE | authenticated | Livre |
| Tarefas: exclusão | DELETE | authenticated | Livre |
| Tarefas: inserção | INSERT | authenticated | Livre |
| Tarefas: leitura para todos | SELECT | authenticated | Livre |
| tarefas_delete | DELETE | authenticated | `is_chefe()` OU criador |
| tarefas_insert | INSERT | authenticated | Livre |
| tarefas_select | SELECT | authenticated | Livre |
| tarefas_update | UPDATE | authenticated | `is_chefe()` OU criador |

**Resumo:** Leitura livre para autenticados. Edição/exclusão controlada por `is_chefe()`, cargo hierárquico ou ser o criador. Cargos especiais (Jurídico, Administração) veem apenas as próprias tarefas.

---

### Tabela: `tarefa_responsaveis` (Responsáveis por Tarefa)

| Política | Comando | Público | Restrição |
|----------|---------|---------|-----------|
| Cargo especial gerencia proprios responsaveis | ALL | authenticated | Gerente Jurídico ou Agente de Administração |
| Diretor CA gerencia responsaveis | ALL | authenticated | Diretor do Cuidado Animal |
| Gerente CA gerencia responsaveis | ALL | authenticated | Gerente do Cuidado Animal |
| Responsáveis: exclusão | DELETE | authenticated | Livre |
| Responsáveis: inserção | INSERT | authenticated | Livre |
| Responsáveis: leitura | SELECT | authenticated | Livre |
| Secretario gerencia responsaveis | ALL | authenticated | Secretários |
| tarefa_responsaveis_delete | DELETE | authenticated | `is_chefe()` |
| tarefa_responsaveis_insert | INSERT | authenticated | Livre |
| tarefa_responsaveis_select | SELECT | authenticated | Livre |
| tarefa_responsaveis_update | UPDATE | authenticated | `is_chefe()` |

**Resumo:** Leitura livre. Modificação restrita a `is_chefe()` ou gestores específicos por área (CA, Jurídico, Secretário).

---

### Tabela: `tarefa_anexos` (Anexos de Tarefas)

| Política | Comando | Público | Restrição |
|----------|---------|---------|-----------|
| Anexos: exclusão | DELETE | authenticated | Livre |
| Anexos: inserção | INSERT | authenticated | Livre |
| Anexos: leitura | SELECT | authenticated | Livre |
| tarefa_anexos_delete | DELETE | authenticated | `is_chefe()` |
| tarefa_anexos_insert | INSERT | authenticated | Livre |
| tarefa_anexos_select | SELECT | authenticated | Livre |

**Resumo:** Upload e leitura livres. Exclusão controlada por `is_chefe()`.

---

### Tabela: `tarefa_comentarios` (Comentários em Tarefas)

| Política | Comando | Público | Restrição |
|----------|---------|---------|-----------|
| Comentários: INSERT para autenticados | INSERT | authenticated | Livre |
| Comentários: SELECT para autenticados | SELECT | authenticated | Livre |

**Resumo:** Qualquer usuário autenticado pode comentar e visualizar comentários.

---

### Tabela: `tarefa_comentario_anexos` (Anexos em Comentários)

| Política | Comando | Público | Restrição |
|----------|---------|---------|-----------|
| Anexos comentário: INSERT para autenticados | INSERT | authenticated | Livre |
| Anexos comentário: SELECT para autenticados | SELECT | authenticated | Livre |

**Resumo:** Qualquer usuário autenticado pode anexar e visualizar anexos de comentários.

---

### Tabela: `tarefa_visualizacoes` (Visualizações de Tarefas)

| Política | Comando | Público | Restrição |
|----------|---------|---------|-----------|
| Visualizações: INSERT para autenticados | INSERT | authenticated | Livre |
| Visualizações: SELECT para autenticados | SELECT | authenticated | Livre |

**Resumo:** Qualquer usuário autenticado pode registrar e visualizar quem abriu as tarefas.

---

## ⚠️ Anexo C: Tabelas Vazias ou Descontinuadas

As seguintes tabelas existem no banco mas **estão sem dados** e/ou **foram substituídas**:

| Tabela | Status | Observação |
|--------|--------|------------|
| `evento_anexos` | Vazia | Não possui registros nem políticas RLS ativas |
| `log_desativacoes` | Vazia | Não possui registros |
| `log_exclusoes` | Descontinuada | Substituída por `exclusao_logs` |
| `password_reset_tokens` | Vazia | Não possui registros |

> **Atenção:** Tabelas vazias podem ser removidas em futuras migrações de limpeza, desde que confirmado que não há dependências no código.

---

## 🛡️ Anexo D: SQL de Criação das Tabelas do Módulo de Tarefas

recriar/atualizar as tabelas e políticas de segurança do módulo de Tarefas:

```sql
-- =====================================================
-- MIGRAÇÃO: Comentários em Tarefas + Sistema de Notificações
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

-- Tabela de visualizações de tarefas
CREATE TABLE IF NOT EXISTS public.tarefa_visualizacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tarefa_id UUID NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    visualizado_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(tarefa_id, user_id)
);

-- Tabela de notificações
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

CREATE INDEX IF NOT EXISTS idx_notificacoes_user_id_lida ON public.notificacoes(user_id, lida);
CREATE INDEX IF NOT EXISTS idx_notificacoes_created_at ON public.notificacoes(created_at DESC);

-- Garantir ON DELETE CASCADE nas tabelas existentes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'tarefa_anexos' AND constraint_name = 'tarefa_anexos_tarefa_id_fkey') THEN
        ALTER TABLE public.tarefa_anexos DROP CONSTRAINT tarefa_anexos_tarefa_id_fkey;
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
ALTER TABLE public.tarefa_anexos ADD CONSTRAINT tarefa_anexos_tarefa_id_fkey FOREIGN KEY (tarefa_id) REFERENCES public.tarefas(id) ON DELETE CASCADE;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'tarefa_responsaveis' AND constraint_name = 'tarefa_responsaveis_tarefa_id_fkey') THEN
        ALTER TABLE public.tarefa_responsaveis DROP CONSTRAINT tarefa_responsaveis_tarefa_id_fkey;
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
ALTER TABLE public.tarefa_responsaveis ADD CONSTRAINT tarefa_responsaveis_tarefa_id_fkey FOREIGN KEY (tarefa_id) REFERENCES public.tarefas(id) ON DELETE CASCADE;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'tarefas' AND constraint_name = 'tarefas_tarefa_pai_id_fkey') THEN
        ALTER TABLE public.tarefas DROP CONSTRAINT tarefas_tarefa_pai_id_fkey;
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
ALTER TABLE public.tarefas ADD CONSTRAINT tarefas_tarefa_pai_id_fkey FOREIGN KEY (tarefa_pai_id) REFERENCES public.tarefas(id) ON DELETE CASCADE;

-- Políticas RLS: tarefa_comentarios
ALTER TABLE public.tarefa_comentarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Comentários: SELECT para autenticados" ON public.tarefa_comentarios;
CREATE POLICY "Comentários: SELECT para autenticados" ON public.tarefa_comentarios FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Comentários: INSERT para autenticados" ON public.tarefa_comentarios;
CREATE POLICY "Comentários: INSERT para autenticados" ON public.tarefa_comentarios FOR INSERT TO authenticated WITH CHECK (true);

-- Políticas RLS: tarefa_comentario_anexos
ALTER TABLE public.tarefa_comentario_anexos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anexos comentário: SELECT para autenticados" ON public.tarefa_comentario_anexos;
CREATE POLICY "Anexos comentário: SELECT para autenticados" ON public.tarefa_comentario_anexos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Anexos comentário: INSERT para autenticados" ON public.tarefa_comentario_anexos;
CREATE POLICY "Anexos comentário: INSERT para autenticados" ON public.tarefa_comentario_anexos FOR INSERT TO authenticated WITH CHECK (true);

-- Políticas RLS: tarefa_visualizacoes
ALTER TABLE public.tarefa_visualizacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Visualizações: SELECT para autenticados" ON public.tarefa_visualizacoes;
CREATE POLICY "Visualizações: SELECT para autenticados" ON public.tarefa_visualizacoes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Visualizações: INSERT para autenticados" ON public.tarefa_visualizacoes;
CREATE POLICY "Visualizações: INSERT para autenticados" ON public.tarefa_visualizacoes FOR INSERT TO authenticated WITH CHECK (true);

-- Políticas RLS: notificacoes
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Notificações: SELECT próprias" ON public.notificacoes;
CREATE POLICY "Notificações: SELECT próprias" ON public.notificacoes FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Notificações: INSERT para autenticados" ON public.notificacoes;
CREATE POLICY "Notificações: INSERT para autenticados" ON public.notificacoes FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Notificações: UPDATE próprias" ON public.notificacoes;
CREATE POLICY "Notificações: UPDATE próprias" ON public.notificacoes FOR UPDATE TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Notificações: DELETE próprias" ON public.notificacoes;
CREATE POLICY "Notificações: DELETE próprias" ON public.notificacoes FOR DELETE TO authenticated USING (user_id = auth.uid());
```

### Políticas de Storage para `tarefa_anexos`
O bucket `tarefa_anexos` precisa das seguintes políticas de storage:

```sql
-- SELECT (download/visualização)
DROP POLICY IF EXISTS "tarefa_anexos_select_authenticated" ON storage.objects;
CREATE POLICY "tarefa_anexos_select_authenticated" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'tarefa_anexos');

-- INSERT (upload)
DROP POLICY IF EXISTS "tarefa_anexos_insert_authenticated" ON storage.objects;
CREATE POLICY "tarefa_anexos_insert_authenticated" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'tarefa_anexos');

-- DELETE (remoção de arquivos)
DROP POLICY IF EXISTS "tarefa_anexos_delete_authenticated" ON storage.objects;
CREATE POLICY "tarefa_anexos_delete_authenticated" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'tarefa_anexos');
```

---

## 🎯 Tabela e Funções RPC para Fila de Números Sequenciais

> **Quando usar:** Execute esta seção para criar a infraestrutura de fila global de reutilização de números cancelados (resolve race condition, isolamento entre navegadores e ordenação numérica correta).

### Tabela `numeros_disponiveis`

```sql
-- Tabela para guardar números cancelados que podem ser reutilizados globalmente
CREATE TABLE IF NOT EXISTS numeros_disponiveis (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    numero_sequencial TEXT NOT NULL,
    ano INTEGER NOT NULL,
    categoria_id TEXT NOT NULL DEFAULT '1.4',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(numero_sequencial, ano, categoria_id)
);

-- Habilitar RLS
ALTER TABLE numeros_disponiveis ENABLE ROW LEVEL SECURITY;

-- Política: qualquer usuário autenticado pode manipular a fila
DROP POLICY IF EXISTS "numeros_disponiveis_acesso_total" ON public.numeros_disponiveis;
CREATE POLICY "numeros_disponiveis_acesso_total" ON public.numeros_disponiveis
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

### Função RPC: `reservar_numero_sequencial`

Retorna o próximo número disponível de forma **atômica** (sem race condition):
1. Verifica a fila global (`numeros_disponiveis`) e retorna o menor número
2. Se a fila estiver vazia, calcula o próximo via `MAX(...::integer)` em `controle_processual`
3. Usa `FOR UPDATE SKIP LOCKED` para evitar concorrência na fila

```sql
CREATE OR REPLACE FUNCTION reservar_numero_sequencial(p_categoria_id TEXT, p_ano INTEGER)
RETURNS TEXT AS $$
DECLARE
    v_numero TEXT;
    v_digitos INTEGER;
    v_proximo INTEGER;
BEGIN
    v_digitos := CASE WHEN p_categoria_id = '1.4' THEN 4 ELSE 3 END;

    -- 1. Tentar pegar da fila de disponíveis (menor número, com lock de linha)
    SELECT numero_sequencial INTO v_numero
    FROM numeros_disponiveis
    WHERE ano = p_ano AND categoria_id = p_categoria_id
    ORDER BY LPAD(split_part(numero_sequencial, '/', 1), 10, '0')
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_numero IS NOT NULL THEN
        DELETE FROM numeros_disponiveis
        WHERE numero_sequencial = v_numero
          AND ano = p_ano
          AND categoria_id = p_categoria_id;
        RETURN v_numero;
    END IF;

    -- 2. Fila vazia: calcular próximo número via MAX numérico (ignora padding/zeros)
    SELECT COALESCE(
        MAX(split_part(numero_sequencial, '/', 1)::integer),
        0
    ) + 1
    INTO v_proximo
    FROM controle_processual
    WHERE categoria_id = p_categoria_id
      AND numero_sequencial LIKE '%/' || p_ano;

    RETURN LPAD(v_proximo::TEXT, v_digitos, '0') || '/' || p_ano;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Função RPC: `devolver_numero_sequencial`

Devolve um número cancelado para a fila global, permitindo que qualquer usuário o reutilize:

```sql
CREATE OR REPLACE FUNCTION devolver_numero_sequencial(p_numero TEXT, p_categoria_id TEXT, p_ano INTEGER)
RETURNS VOID AS $$
BEGIN
    INSERT INTO numeros_disponiveis (numero_sequencial, ano, categoria_id)
    VALUES (p_numero, p_ano, p_categoria_id)
    ON CONFLICT (numero_sequencial, ano, categoria_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 🆕 Atualizações para Cargos de Consórcio (Abril/2026)

### Novos Cargos
- **Consórcio** — cargo de gestão (nível hierárquico 1, igual a Gerente)
- **Analista do Consórcio** — cargo de equipe (nível hierárquico 0, igual a Fiscal/Equipe Ambiental)

### Hierarquia Atualizada
```
Secretário(a) (nível 4)
 ├── Diretor(a) de Meio Ambiente (nível 3)
 │    └── Gerente de Regularização Ambiental (nível 2)
 │         ├── Equipe Ambiental (nível 1)
 │         └── Consórcio (nível 2) → Analista do Consórcio (nível 1)
```

### SQLs a Executar no Supabase

#### 1. Atualizar `get_nivel_hierarquico()`
Adicionar reconhecimento do cargo "Consórcio" como nível 1:

> ⚠️ **NÃO use DROP!** Esta função é usada por políticas RLS do banco. Use `CREATE OR REPLACE` mantendo o nome do parâmetro **exatamente igual** ao original (`user_id`).

```sql
CREATE OR REPLACE FUNCTION get_nivel_hierarquico(user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role INTO v_role FROM profiles WHERE id = user_id;
    IF v_role IS NULL THEN RETURN 0; END IF;
    
    v_role := lower(v_role);
    IF v_role LIKE '%secretário%' OR v_role LIKE '%secretario%' THEN RETURN 4; END IF;
    IF v_role LIKE '%diretor%' THEN RETURN 3; END IF;
    IF v_role LIKE '%gerente%' THEN RETURN 2; END IF;
    IF v_role LIKE '%consorcio%' AND v_role NOT LIKE '%analista%' THEN RETURN 2; END IF;
    RETURN 1; -- Fiscal, Equipe Ambiental, Analista do Consórcio, etc.
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

> **Nota:** Ajuste o valor retornado conforme a escala numérica real usada no projeto (algumas versões usam 0-3, outras 1-4).

#### 2. Atualizar `pode_gerenciar_usuario()`
Garantir que Consórcio possa gerenciar apenas Analistas do Consórcio (nível 0):

> ⚠️ **NÃO use DROP!** Mantenha os nomes dos parâmetros exatamente iguais aos originais para evitar quebrar as políticas RLS.

```sql
CREATE OR REPLACE FUNCTION pode_gerenciar_usuario(gerente_id UUID, alvo_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_manager_role TEXT;
    v_target_role TEXT;
    v_manager_nivel INTEGER;
    v_target_nivel INTEGER;
BEGIN
    SELECT role INTO v_manager_role FROM profiles WHERE id = gerente_id;
    SELECT role INTO v_target_role FROM profiles WHERE id = alvo_id;
    
    IF v_manager_role IS NULL OR v_target_role IS NULL THEN RETURN FALSE; END IF;
    
    v_manager_nivel := get_nivel_hierarquico(gerente_id);
    v_target_nivel := get_nivel_hierarquico(alvo_id);
    
    -- Consórcio só pode gerenciar Analistas do Consórcio (nível inferior)
    IF lower(v_manager_role) LIKE '%consorcio%' AND lower(v_manager_role) NOT LIKE '%analista%' THEN
        RETURN lower(v_target_role) LIKE '%analista%' AND lower(v_target_role) LIKE '%consorcio%';
    END IF;
    
    RETURN v_manager_nivel > v_target_nivel;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### 3. Atualizar Edge Function `delete-user`
Incluir os novos cargos no array `allowedRoles`:

```typescript
const allowedRoles = [
  'Gerente de Posturas', 'Gerente', 'gerente', 'gerente de posturas',
  'Diretor(a) de Meio Ambiente', 'Diretor(a)', 'diretor', 'diretor de meio ambiente',
  'Secretário(a)', 'secretário', 'secretario',
  'Consórcio', 'consorcio'
]
```

### Resumo de Permissões dos Novos Cargos

| Cargo | Nível | Pode Gerenciar | Pode Ser Gerenciado Por |
|-------|-------|----------------|------------------------|
| Consórcio | 1 (ou 2)* | Analista do Consórcio | Secretário, Diretor |
| Analista do Consórcio | 0 (ou 1)* | — | Secretário, Diretor, Consórcio |

> \* Depende da escala numérica adotada na função SQL `get_nivel_hierarquico()` do projeto.


---

## 🆕 Tabela: `controle_denuncias` (Controle Interno de Denúncias)

> **Adicionado:** Maio/2026

Tabela única para registro e acompanhamento de demandas internas (Comunicação Interna, Vereadores, MP, APP, Ouvidoria, Protocolo).

### Estrutura SQL

```sql
create table if not exists controle_denuncias (
  id uuid default gen_random_uuid() primary key,
  tipo text not null check (tipo in ('comunicacao_interna','vereadores','mp','app','ouvidoria','protocolo')),
  data date,
  tarefa text,
  origem text,
  descricao text,
  endereco text,
  bairro text,
  encaminhado_para uuid references auth.users(id),
  encaminhado_para_nome text,
  prazo_conclusao date,
  data_entrega date,
  protocolo text,
  solicitante text,
  obs text,
  concluido boolean default false,
  created_at timestamp with time zone default now(),
  created_by uuid references auth.users(id)
);

-- Índices úteis
create index if not exists idx_controle_denuncias_tipo on controle_denuncias(tipo);
create index if not exists idx_controle_denuncias_data on controle_denuncias(data);
create index if not exists idx_controle_denuncias_encaminhado on controle_denuncias(encaminhado_para);

-- Habilitar RLS
alter table controle_denuncias enable row level security;
```

### Políticas RLS

```sql
-- SELECT: todos os usuários autenticados podem visualizar
CREATE POLICY "controle_denuncias_select_all"
ON controle_denuncias FOR SELECT
TO authenticated
USING (true);

-- INSERT: todos os usuários autenticados podem inserir
CREATE POLICY "controle_denuncias_insert_all"
ON controle_denuncias FOR INSERT
TO authenticated
WITH CHECK (true);

-- UPDATE: apenas o criador ou cargos gerenciais (Gerente, Diretor, Secretário)
CREATE POLICY "controle_denuncias_update_gerencia"
ON controle_denuncias FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (
      profiles.role ILIKE '%gerente%'
      OR profiles.role ILIKE '%diretor%'
      OR profiles.role ILIKE '%secretario%'
      OR profiles.role ILIKE '%secretário%'
    )
  )
);

-- DELETE: apenas o criador ou cargos gerenciais
CREATE POLICY "controle_denuncias_delete_gerencia"
ON controle_denuncias FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (
      profiles.role ILIKE '%gerente%'
      OR profiles.role ILIKE '%diretor%'
      OR profiles.role ILIKE '%secretario%'
      OR profiles.role ILIKE '%secretário%'
    )
  )
);
```

### Campos por Tipo

| Tipo | Campos Obrigatórios | Campos Opcionais |
|------|---------------------|------------------|
| Comunicação Interna | data, tarefa, origem, encaminhado_para | endereco, bairro, descricao, prazo_conclusao, data_entrega, obs, concluido |
| Vereadores | data, tarefa, origem, descricao, encaminhado_para | bairro, prazo_conclusao, data_entrega, obs, concluido |
| MP | data, tarefa, origem, descricao, encaminhado_para | bairro, prazo_conclusao, data_entrega, obs, concluido |
| APP | data, tarefa, origem, encaminhado_para | endereco, bairro, descricao, protocolo, prazo_conclusao, data_entrega, obs, concluido |
| Ouvidoria | data, tarefa, origem, descricao, encaminhado_para | bairro, prazo_conclusao, data_entrega, obs, concluido |
| Protocolo | data, protocolo, solicitante, descricao, encaminhado_para | endereco, bairro, prazo_conclusao, data_entrega, concluido |

### Regras de Interface (Frontend)
- **Linha verde** (`#dcfce7`) quando `concluido = true` (sobrepõe qualquer outra cor).
- **Linha vermelha** (`#fee2e2`) quando `prazo_conclusao < hoje` e `concluido = false`.
- Todos os usuários autenticados podem inserir registros.
- Apenas o criador ou cargos gerenciais podem editar/excluir.


## 8. Atualização Geográfica de Bairros (PostGIS)

Este script habilita o PostGIS (para cálculos de distância precisos no futuro), adiciona as colunas necessárias e atualiza as coordenadas dos bairros existentes no sistema.

```sql
-- 1. Habilitar a extensão PostGIS (necessário para o tipo geography)
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Garantir que as colunas existam (incluindo o tipo geography)
ALTER TABLE bairros ADD COLUMN IF NOT EXISTS latitude float8;
ALTER TABLE bairros ADD COLUMN IF NOT EXISTS longitude float8;
ALTER TABLE bairros ADD COLUMN IF NOT EXISTS geolocalizacao geography(POINT, 4326);

-- 3. Atualização em massa dos bairros com coordenadas
UPDATE bairros AS b SET
    latitude = v.lat,
    longitude = v.lon,
    geolocalizacao = ST_SetSRID(ST_MakePoint(v.lon, v.lat), 4326)
FROM (VALUES
    ('002ce4fe-7d9e-4c21-a68e-10ab2bbb10e1', -20.096882, -44.873039),
    ('01606ccb-21b9-4d42-868c-ac3dc99b04ca', -20.1509500, -44.8385871),
    ('01b960df-94bf-46d7-ba74-4a5d4e4b2ae9', -20.1638, -44.8247),
    ('01da8e70-3ed1-43b2-a5a0-1cd7c0eb56ce', -20.1105569, -44.9002537),
    ('01fbc54f-9884-4be2-8741-93ad6de25ec5', -20.1346084, -44.8721978),
    ('0335bc34-2679-457c-a5e0-8fb934b8c8bb', -20.1291928, -44.9221111),
    ('03ad7545-f0f5-49e9-a994-872f200ecb8a', -20.1347495, -44.8563406),
    ('03bacef9-56a9-4526-932d-0b37c4027eb6', -20.1504, -44.9187),
    ('03e1dfc0-05bf-45b9-a082-4c66237fc76b', -20.1088493, -44.8510191),
    ('04476fa3-85b4-4fd5-902b-205b9e922447', -20.095309, -44.865522),
    ('05f1aa9b-914e-4af4-be59-b310e3587f57', -20.1322, -44.9195),
    ('07aa8370-e5df-429c-96e6-ee55c3a855be', -20.1392583, -44.8899716),
    ('07e3133a-bb0e-41f4-8551-c536c35de7bf', -20.1573321, -44.8744701),
    ('086aa7d0-ec00-4fa3-a191-cb99308fa323', -20.1321718, -44.8894620),
    ('0bdf58c6-0e20-4c02-b9f8-b4e57d96e4db', -20.1370187, -44.8696566),
    ('0d4ecaaa-647f-49a3-8cd5-131a4f1da24d', -20.1655, -44.8978),
    ('0e08bd29-6377-40ed-b491-438470840ab2', -20.1782, -44.8891),
    ('0ecb10fd-328b-4b52-9471-12ff6798bd1b', -20.1852, -44.9221),
    ('0ee0d2c6-8ede-4b5f-b910-59b918c4453f', -20.1341, -44.8654),
    ('0ffa14f2-5ecf-457e-8fc3-41061e3b38b1', -20.1614362, -44.9081956),
    ('10165b0b-617b-4ea7-86d4-77c169114b99', -20.145200, -44.932100),
    ('1164acbf-c9b8-4919-8a56-98cd0feda4ff', -20.0998824, -44.8760388),
    ('13b0edc4-104f-4997-9f3b-34d370243899', -20.1692160, -44.8435304),
    ('149ea94b-a173-4c5b-84eb-cafc5a457268', -20.1468569, -44.8753521),
    ('150747ec-9d84-4f22-ad45-2a61c3d1577c', -20.1416394, -44.8746869),
    ('15a3624f-7e60-4237-b03b-eadb572c9319', -20.1985, -44.8522),
    ('170d6a6f-185c-4fd6-ae38-eaa24636be97', -20.1683523, -44.8994911),
    ('184f2912-c430-48c9-b436-df89017f569f', -20.1648653, -44.8488519),
    ('1897d4fb-ca87-4c4c-bf34-aa4c3f0fe8f3', -20.0815, -44.9242),
    ('19358d03-7e2b-4594-915e-ec76ee4e62e0', -20.1689, -44.9254),
    ('1be9112d-b51c-4dc9-a6bd-1a1b1dfb5d71', -20.1136801, -44.8686037),
    ('1c299a36-7b0f-4247-9c08-9bbf20f67a9d', -20.1491801, -44.8525249),
    ('1cf534ad-f66a-483a-b7e4-a47dfb927338', -20.1308713, -44.8781416),
    ('1edc2942-8d95-4a31-b8af-66cc19d3f6d7', -20.1132821, -44.9072919),
    ('23ab8b4d-77cc-43ce-9c0e-85bb0b3d0bdc', -20.1952, -44.941),
    ('24487973-1d06-46e1-890d-25a746c7343d', -20.1390242, -44.9132061),
    ('25cb35dd-160a-461b-8580-c5b8008c236b', -20.1318320, -44.8396170),
    ('25ea66e3-e30f-434a-ac95-177baaa9a5c1', -20.168965, -44.862610),
    ('2735a5d4-ab2a-4ce4-abd0-255704b4fb47', -20.1645971, -44.9201262),
    ('279a42e1-50fd-4468-a679-0740ec555d6e', -20.1609344, -44.8896019),
    ('29edfb7d-8095-40b2-a34a-691402c74ea0', -20.1118, -44.8692),
    ('2d6bdf12-9681-4bac-8f31-ce397cbe099e', -20.1573, -44.8697),
    ('2ef5cff8-3379-4d2b-80ce-ca0a6a4f48b3', -20.1311533, -44.8706314),
    ('33738b79-2bde-494a-b81c-2075473aa7da', -20.1939268, -44.9206734),
    ('34167b67-51f1-4455-96c3-0286c3ae8317', -20.1861040, -44.8140046),
    ('3473c285-ef45-4b62-9740-4f4b853d09d8', -20.1346084, -44.8721978),
    ('355f2b00-907f-49fb-b065-f23b7b9a971a', -20.1577435, -44.9330116),
    ('35ac4f42-a789-4b3d-9109-ae2d13356d68', -20.1023, -44.8215),
    ('36b6de96-6074-4e4d-bd30-c4a63fa692ec', -20.1055548, -44.8822186),
    ('36c295a7-b451-41ab-aa78-e7ad42f7008f', -20.1192, -44.8455),
    ('36e4fef7-64c4-41fb-87d9-3a0de6cbea1b', -20.1366116, -44.8883810),
    ('37141916-80f1-4b46-b72c-d3043e1001e2', -20.1848151, -44.8812315),
    ('3763336f-9d1c-44d9-b880-035d35859ac6', -20.1854931, -44.8547330),
    ('387b1ebc-9c2d-4f74-a30b-cca2e89edea0', -20.1398, -44.8945),
    ('390c1d4b-5f74-48cd-ac83-a622d47f158f', -20.204771, -44.919669),
    ('3b3bfdaa-40bd-4f98-9a3e-ef41bd4b3714', -20.1584498, -44.8830769),
    ('3bfd39c6-e56f-4d74-b4b5-499fa150f435', -20.127064, -44.881468),
    ('3c97532a-6628-4ac1-a025-cb0c0cb8e438', -20.1339638, -44.8593876),
    ('3fdc51d5-b228-455c-a7b2-1ee0540cad8c', -20.133612, -44.885381),
    ('405a7fd8-5952-448f-a2c5-c61b5bf8a87d', -20.1982, -44.9155),
    ('4153d9a8-9d14-4d3b-ab51-7b5b740704c0', -20.105784, -44.904506),
    ('4570780d-805c-40f6-a536-a42f186ec637', -20.1250697, -44.8762360),
    ('46eaabff-f96d-4a83-9184-f11d180a0255', -20.1092925, -44.8597524),
    ('4901bfb5-0444-4074-a3c9-22707b3924d2', -20.1911275, -44.9328614),
    ('4ab2723f-5dd1-47fe-95a8-172895468b54', -20.1645971, -44.9201262),
    ('4b1e9979-0ef2-4622-aa28-26c696fd2d93', -20.1728408, -44.9233471),
    ('4bb544ba-5f70-4461-b4bb-8db13272bf52', -20.1412, -44.9285),
    ('4c441451-f3ab-4fb0-b7a2-b10627d39dc8', -20.1722775, -44.8509976),
    ('4c83df62-e6bf-44bf-8851-454e53019e93', -20.136024, -44.910206),
    ('4cbf1aff-71fb-4e8c-a145-58a2a744f0a3', -20.1550762, -44.8880367),
    ('4f0d4a17-9810-4885-8886-9200f24ce0aa', -20.1534748, -44.8932831),
    ('4fd5a03c-268d-4024-84f8-62d8926dc473', -20.1254, -44.9082),
    ('520e35f3-f015-465a-af23-7edad894486a', -20.1748342, -44.9302435),
    ('52b9f019-29dc-4442-a004-00f85546810f', -20.1185, -44.9321),
    ('543ab2bc-245b-451a-9192-c3aa06408186', -20.1312, -44.8725),
    ('544300f2-002c-4b8d-bf9f-5692bd967d56', -20.1673327, -44.8554823),
    ('56e077cb-306b-4cbb-9fd2-82f401dd0fd1', -20.2154, -44.8322),
    ('57247501-fc94-4e44-acfb-4fa08251e4d6', -20.1352771, -44.9254585),
    ('5784df57-4862-4690-9b6d-f15c5f81399e', -20.1427548, -44.8965298),
    ('580d7bfc-6bfe-48f7-8414-6f471bf03f82', -20.1588075, -44.8968683),
    ('5a6453a1-e953-4aa3-a47b-14eb5ef3ec62', -20.1848151, -44.8812315),
    ('5ad4d43f-493d-46d1-b9db-90334c05b394', -20.1646546, -44.9203616),
    ('5b8c0a6e-e6e7-4295-bdd0-fab00a851530', -20.1728408, -44.9233471),
    ('5cb38e82-8056-47dd-84d4-d6f192b71e85', -20.1599776, -44.9079877),
    ('5da50550-b49f-4dfc-83de-9d15764d58db', -20.1712843, -44.9069727),
    ('5dc8acb4-13c4-42c9-a2ae-28feda9fd156', -20.1227569, -44.8973140),
    ('5ddaa8db-6b36-4c12-91b6-497a7e40fe80', -20.1523966, -44.8677132),
    ('5edff30f-5df7-4853-ab2a-7f0c6504475f', -20.153526, -44.861602),
    ('604ee77a-b5ff-4c95-be1b-b41f39e5cf27', -20.1502, -44.9315),
    ('61466a0d-1e07-462d-91f9-25dfffb85da7', -20.1667687, -44.8851583),
    ('61a58277-0853-4a0f-98cf-20270ab271d4', -20.1912081, -44.9040437),
    ('62da305f-9634-4059-984a-3d52144b47db', -20.1378155, -44.8262704),
    ('63e729d3-525b-4ea9-a9d9-73b284989857', -20.1762915, -44.9080035),
    ('643ea907-19b1-4be7-83d6-47ebf234d8bd', -20.1473190, -44.9216175),
    ('64cd12ee-88be-4938-8a98-0bd35463629f', -20.1738183, -44.8584005),
    ('652ea19a-5402-4c0d-862a-f5ac04aeaa84', -20.1056575, -44.8650886),
    ('65500104-80f6-4bc2-bcce-05a5d348ecf4', -20.1503105, -44.9254799),
    ('66fd0b14-dba6-4947-bc19-89bce1d4e9dd', -20.1412312, -44.9207884),
    ('694b7a4d-3a86-4a53-8c21-17ada0b63076', -20.130964, -44.856388),
    ('6aed3280-da50-475e-9221-c68f804da958', -20.1699348, -44.9086464),
    ('6b92ddd7-9221-4fff-b711-e06d095c104e', -20.1047085, -44.8774120),
    ('6bb449bd-25fd-4dd0-9f5d-ab7faa6e7e61', -20.1218, -44.8512),
    ('6df80db0-6b09-40c0-9562-b5c32e4191ef', -20.1652581, -44.8763606),
    ('6f117868-2419-4292-a57a-b512e40a90da', -20.1588, -44.8395),
    ('6f181af1-c2ca-4513-b72f-a8fbbc2bf6a2', -20.1178257, -44.8508904),
    ('6f1d562d-0c26-454b-a968-2298c2a59601', -20.1384, -44.8982),
    ('702be8c0-b01c-4910-a046-9def38df03bb', -20.1191000, -44.8885593),
    ('70426f4f-3081-485d-9235-3d07b3c3b3c0', -20.1663256, -44.8818323),
    ('720babc8-b63e-4051-a43f-db25e383727a', -20.1678564, -44.8681852),
    ('73375757-9981-4dfd-b543-ab3697feed24', -20.132277, -44.922458),
    ('749123bc-190e-416c-ba88-cc839834a56f', -20.1882879, -44.9192572),
    ('75db166e-d751-4a9d-8536-76dc3dc2df6b', -20.1151157, -44.9065945),
    ('75e02976-937a-4037-b1ee-05220412212c', -20.1892861, -44.8866818),
    ('763215f1-a03f-4a2a-8c33-1694aefeae71', -20.1565261, -44.8646018),
    ('77ec4541-4ecc-4c91-b9d5-857fcbcfb21f', -20.1265, -44.8771),
    ('781750c1-403a-4021-b6b6-221c9f36c135', -20.1064079, -44.9788948),
    ('782fc425-e9b6-4dcc-89fc-1e79f7d24c5c', -20.1487597, -44.9066417),
    ('7a979b63-d000-4a72-9c2a-9610e57f834e', -20.1715, -44.9284),
    ('7aa077e8-80e2-4f57-a963-c8af39b796f7', -20.129172, -44.886462),
    ('7b7081a7-005d-4c85-9547-b317132db498', -20.1742, -44.9351),
    ('7b7afe1f-68a5-4acf-bb61-dd86237826dc', -20.1285, -44.8522),
    ('7bee1717-47ec-4837-90d4-3efa76121195', -20.1181417, -44.8363984),
    ('7d968878-bdf8-465c-ac4d-7f0e1d6d366a', -20.1584219, -44.9062321),
    ('813f4773-1405-426b-a319-56b78b7091ba', -20.1086009, -44.9093488),
    ('843380bc-b5a9-4f23-931a-5b83fc7dd417', -20.1443187, -44.8684213),
    ('856283e6-817d-41c3-9703-b396052a3a5d', -20.1362604, -44.8441312),
    ('8589a7b5-799a-4e3b-9e24-bb2e6abeb80c', -20.0854, -44.9125),
    ('8603f63d-667a-4691-8176-a1addbcd0dc6', -20.1861040, -44.8140046),
    ('87b7f2d7-3783-413f-b3f5-a813164a0a82', -20.1628107, -44.8544953),
    ('89d33caf-d8b1-4aad-8f03-27531d9b8a3d', -20.1280557, -44.8901257),
    ('8a43d896-6e66-4ede-aff2-a5d686e67646', -20.1533371, -44.9008033),
    ('8a676b0d-8086-416f-80f1-f37e3d349938', -20.1470319, -44.9091184),
    ('8ad620fc-8a5d-43b1-9b67-f37de906e177', -20.1387294, -44.9064404),
    ('8c92abcd-b84d-4330-b59e-7e31a4e53956', -20.110680, -44.865604),
    ('8d75f115-df27-449f-9bf4-a066e79b879b', -20.1729220, -44.8339603),
    ('8e367931-ccd5-4ff6-ac15-3fcb9c498a9e', -20.168868, -44.901741),
    ('8e38784c-f766-443b-900e-8d856f492f4c', -20.1852166, -44.9049449),
    ('8fb0486d-d427-40c2-8889-0504f67a612d', -20.1495, -44.8615),
    ('9105112c-79fc-4b15-b2b7-f2d220759899', -20.1667587, -44.8374364),
    ('91869f03-be5b-419c-8cd9-7a6471073b4a', -20.1463965, -44.8809205),
    ('93b1c4b4-9e94-439a-b48a-021b8b9d5a5a', -20.1211753, -44.8754701),
    ('93ebc36e-4147-412b-ba5e-bf39836f6e70', -20.1043324, -44.9706980),
    ('945051ff-104d-47a9-b143-402a0f1b9a37', -20.150337, -44.897803),
    ('96075f07-a97b-456a-8950-7372470c39e6', -20.1601, -44.8352),
    ('96c2c937-98a4-4cfd-9a79-95789832a0e6', -20.1769289, -44.9221111),
    ('97a14564-1d98-483b-b795-bfd556a12e22', -20.1372, -44.8734),
    ('97b74a79-8863-4ce9-a652-8b5b5b28bc94', -20.1576428, -44.9274969),
    ('982a775f-4379-4fc0-93e5-0bbb5ab0aaf1', -20.1240968, -44.9121842),
    ('98eb842e-5b17-43dc-987d-d13759b07503', -20.1554220, -44.8205626),
    ('997debf1-4c82-4258-b19d-20cad53eced2', -20.125454, -44.871751),
    ('998454dc-8ca8-4f6a-8809-0635d50e670f', -20.1855, -44.8642),
    ('9bf43aff-3d76-4ce8-af72-251bc968b0f5', -20.1718684, -44.9047411),
    ('9c72f49b-3e2a-458a-a055-850e60f93f1e', -20.1423040, -44.9063049),
    ('9d057e78-b15b-4db9-8fd1-bb516b7be389', -20.1814605, -44.9224329),
    ('9deadc9f-8671-4bf5-8ffa-421e6c5e69db', -20.1982062, -44.9229479),
    ('9f446ce9-e155-4d26-8c9f-55c25c4e50eb', -20.141151, -44.911805),
    ('9f478930-9c63-4642-80be-040199dc3db1', -20.125308, -44.906459),
    ('a13305b3-b9bf-456c-873c-56152e9f0a44', -20.0983091, -44.8685217),
    ('a1739629-173f-4f81-b1d2-32e61e71464e', -20.1892, -44.8874),
    ('a1a83e04-0306-4f8a-a60f-d71c29b48f1b', -20.1182941, -44.8816499),
    ('a1f96d33-303b-444d-b443-4281eb6a2e3e', -20.1338717, -44.8933270),
    ('a24b31b0-a841-42cf-95e2-eb177586b137', -20.1582320, -44.9004710),
    ('a30a4b7e-4b95-4d96-a408-0da2b4dd5838', -20.1852368, -44.9103523),
    ('a3a112ac-d5e3-491d-8054-9fac42ff783e', -20.1967261, -44.9408865),
    ('a3d3d503-7442-4a66-8a51-1e7a161d4d2e', -20.1385330, -44.8958564),
    ('a59ec6b1-2767-4d33-ae3a-bae3b90caab6', -20.1466012, -44.8969829),
    ('a6fe9c11-db15-40b8-a15b-d7dded138d8b', -20.1763964, -44.8770687),
    ('a7e75cf8-a891-4136-bc72-b386751075af', -20.1441512, -44.9148047),
    ('a825da6a-38b3-4299-b781-618c159339cf', -20.1747448, -44.8791930),
    ('a96febae-4bd8-4073-8cd2-76ecc8182cc1', -20.1078184, -44.9717709),
    ('ac28e369-ec33-4a3c-9909-4aa9980d10c7', -20.1374730, -44.8382652),
    ('ae272140-f73d-4de1-8b1d-8e07d9a551c3', -20.1215279, -44.8829803),
    ('aebbb54d-db59-4de0-a787-54c78c9e679f', -20.1939871, -44.9410266),
    ('af48f2e6-2238-4964-ac1a-d3d817008732', -20.1245, -44.8451),
    ('b523ca11-a5e7-4fea-9255-89958a4266a9', -20.154513, -44.855680),
    ('b5e1e882-357c-4860-9277-6bc27d318bcd', -20.1198, -44.8765),
    ('b6d40805-2e7d-413e-a296-dbe66d949276', -20.1482, -44.9351),
    ('b8dc6535-23a4-4ac5-b387-178695d85158', -20.1344309, -44.9301577),
    ('b8f12c69-16c4-41aa-8262-318f508dbde4', -20.1810987, -44.8521227),
    ('b91be2f6-bfdd-4239-8f79-13eb26ac5ea5', -20.1889928, -44.9220467),
    ('bbe296f4-3b7b-415a-ba05-c969defd8399', -20.1613962, -44.9376256),
    ('bc3dd583-5e19-4ead-a009-2147267b1118', -20.1293905, -44.8595593),
    ('bca4a32f-682b-4722-9da9-7624e495466e', -20.155422, -44.903232),
    ('bfef9e6f-f644-4c8d-b364-eb2b13c613d2', -20.135533, -44.892856),
    ('c2c34d7b-d0d6-4254-b183-e8940b941175', -20.1838370, -44.9491048),
    ('c4d9017e-498b-4f62-911d-6bcc70b247ac', -20.1057299, -44.9029040),
    ('c500ef80-7c5b-4adf-b1d1-f6cffe443853', -20.1236837, -44.8867139),
    ('c5237e31-d94b-4b5e-bfcd-6ef4c839e62b', -20.1464377, -44.8341668),
    ('c6122411-04d6-4eee-baee-4e169d8c6f89', -20.1012, -44.9458),
    ('c61a2cf0-96d2-4672-b8bc-58179a948fbb', -20.1890331, -44.9477744),
    ('c710f4fc-3a64-4ddc-b49d-cc57ac4ed23c', -20.1640577, -44.8596187),
    ('c75fd0d8-442f-4ad4-ba46-3099587c421e', -20.1450, -44.8910),
    ('c93fee51-ae7c-4f80-afda-f0b820cf6f21', -20.130984, -44.862288),
    ('ca1469d2-285d-48b1-bdd1-0aeb53844138', -20.1116589, -44.8850637),
    ('ca67f4ed-bbb3-4837-a174-9ace58f8f829', -20.150475, -44.890283),
    ('ca93dd1f-438d-46ea-ab96-28724aea6219', -20.1712201, -44.8819182),
    ('cb68d628-c0ea-4059-a084-789015f7001e', -20.159417, -44.927008),
    ('cbd3b103-d19e-4c02-afe4-11de189abc49', -20.1287357, -44.8623058),
    ('cc35e31c-1f0f-4643-b618-628c050ba635', -20.1512081, -44.8582718),
    ('cc6d8284-30a8-4771-9c14-68ab9f0eadaf', -20.1910067, -44.9165321),
    ('cdb7ba05-d3ee-4587-82c1-951e2ed13320', -20.1821, -44.9242),
    ('d0c9436e-76f3-422c-9166-5d31f60ed420', -20.1184754, -44.8605785),
    ('d2c64369-1ffe-4565-8140-125b207999bd', -20.1771857, -44.9018228),
    ('d5013934-094d-4ff2-b2db-55e5ce923ee8', -20.1719653, -44.8656103),
    ('d5353505-c5eb-4820-8510-881213ed6e15', -20.1167326, -44.8965308),
    ('d6f7ed3a-fb71-4d65-ba87-093db73beee0', -20.2211554, -44.8844637),
    ('d80b97ae-e9c8-4b15-9509-3cb4e4c2c025', -20.1060049, -44.9634453),
    ('d93e2e57-ed05-463b-ba31-737c26ed223b', -20.1390242, -44.9132061),
    ('d96750a4-79c1-4355-a706-8e63f5989095', -20.1234632, -44.8475754),
    ('d974e715-0d68-414e-a7f1-3257485274b4', -20.1270232, -44.8688075),
    ('d980bb14-67ca-4bbf-b9e0-2f8fb0979c22', -20.144032, -44.906118),
    ('deb7c979-136c-47b7-8c8d-78e92ae6d317', -20.1863948, -44.9400926),
    ('e00d4975-a99a-43f6-8ed6-e6d958640116', -20.1976021, -44.9182058),
    ('e02cc854-342c-4992-85c1-11d5c7c49457', -20.1339839, -44.8652885),
    ('e0bb4ae5-5d51-44c8-8b88-9171ff3f98d7', -20.1129900, -44.8929689),
    ('e0e33747-a02d-432d-b72f-e371ba4aeb59', -20.1551, -44.9124),
    ('e13363df-4288-4453-a8b4-204d9fdbd07b', -20.128832, -44.836617),
    ('e1c4197d-b5b4-4da8-9cdf-bb646af458f2', -20.1284536, -44.8747513),
    ('e2fd5eb5-312a-41d2-9a34-af510916e6e6', -20.1604339, -44.8479077),
    ('e44f6941-c5c5-47d0-b1ed-ce2ad5aff7c4', -20.1383139, -44.8874369),
    ('e45aff47-bb39-4eae-8a35-6e7e159058a5', -20.1624167, -44.9300075),
    ('e5b2897b-1c67-4ffe-b9ee-6280e7a847d2', -20.1464377, -44.8341668),
    ('e6fa6dcf-a532-43b0-8bbe-64eb2eabfd2b', -20.1523015, -44.8904982),
    ('e72913e0-5795-49eb-b973-c35ab62e0543', -20.152076, -44.885037),
    ('e743bc79-252d-40b0-8b12-f50556aa0fc2', -20.1167646, -44.9674579),
    ('e7ff10d7-b040-4e7f-9b51-350c423e504d', -20.1697792, -44.9451776),
    ('e9834a42-260a-454b-9ead-054d84b75f59', -20.1283076, -44.9094591),
    ('ea2330a9-2aa7-426b-9545-1f85edec34bc', -20.2077715, -44.9226690),
    ('ebace4bc-22e1-4e60-8e8a-0e6ae12dfa3f', -20.1833436, -44.9038935),
    ('ec2a175f-05a9-42c5-bd66-adaabf37deec', -20.1213969, -44.9081716),
    ('ed63c0d1-88dc-443b-8676-06a62151425b', -20.1300640, -44.8844677),
    ('eefe68a3-3eb4-41ca-9a5b-336f893a17d2', -20.1888115, -44.9087215),
    ('ef485299-f220-44fa-95d1-d12bf3b1bd23', -20.1853387, -44.8070309),
    ('ef89a243-9626-4176-a274-4c910882c08d', -20.1910067, -44.9165321),
    ('f01fb1a8-546a-407b-8b91-0caeafe2c118', -20.114826, -44.847890),
    ('f048cbd4-5e13-475d-990e-f51d16c0bcd4', -20.0828125, -44.9344170),
    ('f06b50eb-c24c-46dd-9f0c-e528aa7a2ace', -20.1087838, -44.9075064),
    ('f0b45282-d997-4f83-ad3c-8523aba2c510', -20.1706158, -44.8784849),
    ('f28ce53a-cf49-483b-9c3b-6ca0f6bd4554', -20.1239696, -44.9310911),
    ('f33d7ac5-1507-4689-ba53-1be8d5abe1c1', -20.1238336, -44.8324502),
    ('f485013e-3bf6-4f46-97bc-1c1253a0b6ec', -20.1707971, -44.8712322),
    ('f579a137-89e5-47eb-a23d-91778e20a0ba', -20.1331214, -44.9126053),
    ('f5dca6fd-3449-48ab-80fb-7d619ad20d03', -20.1575131, -44.8586795),
    ('f7a24760-381d-44a4-b5a3-590f6c761d0e', -20.1037715, -44.8527357),
    ('f7d0a95d-f9e2-4d9b-8c01-56a55138e031', -20.1667587, -44.8374364),
    ('f7e802ce-9327-4bea-bea1-f9fd5e0f104a', -20.175802, -44.923016),
    ('f836bc3d-e43e-4eca-b6fd-9445d165dae7', -20.1480895, -44.8421061),
    ('f95fe2f1-806f-448e-8163-53464d304dec', -20.1177300, -44.8726806),
    ('fc332943-214e-47bf-9f01-cc0b8e2206d8', -20.2510200, -44.8734770),
    ('fe21f7f3-037c-45fe-961d-8d47f9e25f40', -20.1137342, -44.9344170),
    ('fee5e067-5292-4ad9-9eaa-4039ecc72469', -20.1654, -44.9185),
    ('ff124bc4-c482-4786-9521-00e749d0e0c5', -20.1534, -44.8856),
    ('ff4bef7f-7419-4ed4-9368-6b1c159bf2e6', -20.1788020, -44.9260164)) AS v(id, lat, lon)
WHERE b.id = v.id::uuid;

-- 4. Correções de coordenadas baseadas no polígono do OpenStreetMap (GeoJSON)
--    Bairros com coordenadas fora do próprio polígono (verificação automática 2026-05-15)
UPDATE bairros SET latitude = -20.1284300, longitude = -44.8721963, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.8721963, -20.1284300), 4326) WHERE nome = 'Manoel Valinhas';
UPDATE bairros SET latitude = -20.1804787, longitude = -44.8795814, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.8795814, -20.1804787), 4326) WHERE nome = 'Maria Peçanha';
UPDATE bairros SET latitude = -20.1712747, longitude = -44.9086675, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.9086675, -20.1712747), 4326) WHERE nome = 'Morada Nova';
UPDATE bairros SET latitude = -20.2007709, longitude = -44.9225341, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.9225341, -20.2007709), 4326) WHERE nome = 'Morumbi';
UPDATE bairros SET latitude = -20.1108540, longitude = -44.9799086, geolocalizacao = ST_SetSRID(ST_MakePoint(-44.9799086, -20.1108540), 4326) WHERE nome = 'Santa Cruz';
```

---

-- ============================================
-- SEED / UPSERT COMPLETO DOS 255 BAIRROS
-- (Gerado a partir do CSV exportado do Supabase)
-- ============================================

```sql
-- Use ON CONFLICT para não duplicar

INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('002ce4fe-7d9e-4c21-a68e-10ab2bbb10e1', 'Prolongamento Jardim Candelária', 'c551a112-ef94-4265-b42e-40e314887950', '2026-03-01 20:17:39.635135+00', -20.1011191, -44.8753985, '0101000020E6100000D63BDC0E0D7046C03E80FBF0E21934C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('01606ccb-21b9-4d42-868c-ac3dc99b04ca', 'Nova Suiça', '5ecc6b12-eb98-4331-8717-7387845d5999', '2026-03-01 20:17:39.635135+00', -20.15095, -44.8385871, '0101000020E61000007AAC74D2566B46C0CA54C1A8A42634C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('01b960df-94bf-46d7-ba74-4a5d4e4b2ae9', 'Morada Nova', 'ca01ed34-9647-4d98-b157-9cb350e78235', '2026-05-12 14:04:48.777746+00', -20.1712747, -44.9086675, '0101000020E61000006F8104C58F6946C0B515FBCBEE2934C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('01da8e70-3ed1-43b2-a5a0-1cd7c0eb56ce', 'Serra Verde', 'c551a112-ef94-4265-b42e-40e314887950', '2026-03-01 20:17:39.635135+00', -20.1105569, -44.9002537, '0101000020E61000002FCD63833B7346C0DED8FD744D1C34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('01fbc54f-9884-4be2-8741-93ad6de25ec5', 'Espirito Santo', '7152fd6e-c5d1-410d-bcfa-96257a80d2fa', '2026-03-01 20:17:39.635135+00', -20.1346084, -44.8721978, '0101000020E61000005352712DA46F46C053C433B2752234C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('0335bc34-2679-457c-a5e0-8fb934b8c8bb', 'Balneário Rancho Alegre', '8050b9e3-b371-4340-a846-df9d536e505f', '2026-03-01 20:17:39.635135+00', -20.1291928, -44.9221111, '0101000020E6100000A9E38CBC077646C0F0E082C7122134C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('03ad7545-f0f5-49e9-a994-872f200ecb8a', 'Primavera', '7152fd6e-c5d1-410d-bcfa-96257a80d2fa', '2026-03-01 20:17:39.635135+00', -20.1347495, -44.8563406, '0101000020E6100000579E9B919C6D46C001A777F17E2234C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('03bacef9-56a9-4526-932d-0b37c4027eb6', 'Vila Roseira', '971aadc1-7707-4cc0-b986-471bbe5ec378', '2026-03-01 20:17:39.635135+00', -20.1746341, -44.8471138, '0101000020E6100000C27E99396E6C46C0324404D2B42C34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('03e1dfc0-05bf-45b9-a082-4c66237fc76b', 'São Caetano', 'd397d282-c04f-4667-a5f3-ca8a4c298166', '2026-03-01 20:17:39.635135+00', -20.1088493, -44.8510191, '0101000020E6100000BC62A131EE6C46C047B1378CDD1B34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('04476fa3-85b4-4fd5-902b-205b9e922447', 'Prologamento Eldorado', '5ecc6b12-eb98-4331-8717-7387845d5999', '2026-03-01 20:17:39.635135+00', -20.0970437, -44.8699375, '0101000020E61000003108AC1C5A6F46C068C81DDBD71834C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('05f1aa9b-914e-4af4-be59-b310e3587f57', 'Mariza Pardini', '971aadc1-7707-4cc0-b986-471bbe5ec378', '2026-03-01 20:17:39.635135+00', -20.1322, -44.9195, '0101000020E610000004560E2DB27546C0FD87F4DBD72134C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('07aa8370-e5df-429c-96e6-ee55c3a855be', 'Vila Central do Divino', '1214e817-fc60-4a84-a084-0def6f198ddd', '2026-03-01 20:17:39.635135+00', -20.1392583, -44.8899716, '0101000020E6100000352FE296EA7146C05232946EA62334C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('07e3133a-bb0e-41f4-8551-c536c35de7bf', 'Prologamento Interlagos', '605abb09-9d29-472e-9be5-0edcaf1dd264', '2026-03-01 20:17:39.635135+00', -20.157571, -44.8750655, '0101000020E6100000CF2D7425027046C04BCCB392562834C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('086aa7d0-ec00-4fa3-a191-cb99308fa323', 'Afonso Pena', '1214e817-fc60-4a84-a084-0def6f198ddd', '2026-03-01 20:17:39.635135+00', -20.1321718, -44.889462, '0101000020E610000073840CE4D97146C01574D602D62134C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('0bdf58c6-0e20-4c02-b9f8-b4e57d96e4db', 'Itaí', '7152fd6e-c5d1-410d-bcfa-96257a80d2fa', '2026-03-01 20:17:39.635135+00', -20.1370187, -44.8696566, '0101000020E610000012E04FE8506F46C0C07053A8132334C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('0d4ecaaa-647f-49a3-8cd5-131a4f1da24d', 'Prolongamento São Sebastião', '1214e817-fc60-4a84-a084-0def6f198ddd', '2026-03-01 20:17:39.635135+00', -20.1279938, -44.891413, '0101000020E6100000581D39D2197246C03C17A133C42034C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('0e08bd29-6377-40ed-b491-438470840ab2', 'Prolongamento Antônio Fonseca', '3106de99-1c0e-469e-bf07-a37c60410632', '2026-03-01 20:17:39.635135+00', -20.1604571, -44.8832692, '0101000020E610000034C813F70E7146C037E96CB7132934C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('0ecb10fd-328b-4b52-9471-12ff6798bd1b', 'Solaris', '4cde76ed-250e-485f-8d05-c77e29c9cb01', '2026-03-01 20:17:39.635135+00', -20.1852, -44.9221, '0101000020E610000020D26F5F077646C01D386744692F34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('0ee0d2c6-8ede-4b5f-b910-59b918c4453f', 'J. K', 'ca01ed34-9647-4d98-b157-9cb350e78235', '2026-03-01 20:17:39.635135+00', -20.2027977, -44.9149871, '0101000020E610000085611B4C1E7546C03B34D18CEA3334C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('0ffa14f2-5ecf-457e-8fc3-41061e3b38b1', 'São Judas Tadeu', 'ca01ed34-9647-4d98-b157-9cb350e78235', '2026-03-01 20:17:39.635135+00', -20.1614362, -44.9081956, '0101000020E6100000802FE0C03F7446C0F963FFE1532934C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('10165b0b-617b-4ea7-86d4-77c169114b99', 'Prolongamento L. P. Pereira', 'ac623dfd-ed4c-47ca-be91-e5e1b0d40a6c', '2026-03-01 20:17:39.635135+00', -20.1327626, -44.9095924, '0101000020E6100000575815866D7446C0C621D1BAFC2134C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('1164acbf-c9b8-4919-8a56-98cd0feda4ff', 'Jardim Candelária', 'c551a112-ef94-4265-b42e-40e314887950', '2026-03-01 20:17:39.635135+00', -20.0998824, -44.8760388, '0101000020E61000007803160A227046C02C7299E4911934C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('13b0edc4-104f-4997-9f3b-34d370243899', 'Santa Lúcia', '971aadc1-7707-4cc0-b986-471bbe5ec378', '2026-03-01 20:17:39.635135+00', -20.169216, -44.8435304, '0101000020E61000004597DCCDF86B46C0BEF561BD512B34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('149ea94b-a173-4c5b-84eb-cafc5a457268', 'São João de Deus', 'd397d282-c04f-4667-a5f3-ca8a4c298166', '2026-05-12 16:20:32.006873+00', -20.1468569, -44.8753521, '0101000020E610000012FEA0890B7046C023B1EE69982534C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('150747ec-9d84-4f22-ad45-2a61c3d1577c', 'Niterói', 'd397d282-c04f-4667-a5f3-ca8a4c298166', '2026-05-13 12:26:07.109241+00', -20.1416394, -44.8746869, '0101000020E6100000ACDE86BDF56F46C037D3CE7A422434C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('15a3624f-7e60-4237-b03b-eadb572c9319', 'Granjas do Sheik', 'ca01ed34-9647-4d98-b157-9cb350e78235', '2026-03-01 20:17:39.635135+00', -20.1985, -44.8522, '0101000020E61000005BD3BCE3146D46C0894160E5D03234C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('170d6a6f-185c-4fd6-ae38-eaa24636be97', 'Del Rei', '7152fd6e-c5d1-410d-bcfa-96257a80d2fa', '2026-03-01 20:17:39.635135+00', -20.1377853530437, -44.8520708084107, '0101000020E610000083C53C86227346C0D5B4E622192B34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('184f2912-c430-48c9-b436-df89017f569f', 'Davanuze', '971aadc1-7707-4cc0-b986-471bbe5ec378', '2026-03-01 20:17:39.635135+00', -20.1648653, -44.8488519, '0101000020E6100000E0D2D62DA76C46C0C7BEBF9C342A34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('1897d4fb-ca87-4c4c-bf34-aa4c3f0fe8f3', 'Chácara Pari', '971aadc1-7707-4cc0-b986-471bbe5ec378', '2026-03-01 20:17:39.635135+00', -20.0815, -44.9242, '0101000020E61000004A7B832F4C7646C0BE9F1A2FDD1434C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('19358d03-7e2b-4594-915e-ec76ee4e62e0', 'C. H. F  das Pedras', 'c551a112-ef94-4265-b42e-40e314887950', '2026-03-01 20:17:39.635135+00', -20.1092158435524, -44.8878192901611, '0101000020E6100000F5DBD781737646C05E4BC8073D2B34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('1be9112d-b51c-4dc9-a6bd-1a1b1dfb5d71', 'Vila Romana', '7152fd6e-c5d1-410d-bcfa-96257a80d2fa', '2026-03-01 20:17:39.635135+00', -20.1136801, -44.8686037, '0101000020E6100000A157F2672E6F46C0BDB497231A1D34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('1c299a36-7b0f-4247-9c08-9bbf20f67a9d', 'Progresso', 'd03c2fb6-2f32-4110-8807-c9fce2c7fc40', '2026-03-01 20:17:39.635135+00', -20.1491801, -44.8525249, '0101000020E6100000494332891F6D46C0C9B6C2AA302634C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('1cf534ad-f66a-483a-b7e4-a47dfb927338', 'Da Luz', '7152fd6e-c5d1-410d-bcfa-96257a80d2fa', '2026-03-01 20:17:39.635135+00', -20.1308713, -44.8781416, '0101000020E6100000E9A0A6F1667046C0297C11C8802134C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('1edc2942-8d95-4a31-b8af-66cc19d3f6d7', 'Anchieta', 'c551a112-ef94-4265-b42e-40e314887950', '2026-03-01 20:17:39.635135+00', -20.1132821, -44.9072919, '0101000020E61000007D361724227446C0E2B8420E001D34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('23ab8b4d-77cc-43ce-9c0e-85bb0b3d0bdc', 'Chácaras Samambaia', NULL, '2026-05-12 13:57:05.314384+00', -20.1952, -44.941, '0101000020E61000009CC420B0727846C0E02D90A0F83134C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('24487973-1d06-46e1-890d-25a746c7343d', 'São Roque', '8050b9e3-b371-4340-a846-df9d536e505f', '2026-03-01 20:17:39.635135+00', -20.136847, -44.921142, '0101000020E6100000FC00FFEFE37446C0425A0817972334C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('25cb35dd-160a-461b-8580-c5b8008c236b', 'Jardim dos Candidés', '5ecc6b12-eb98-4331-8717-7387845d5999', '2026-03-01 20:17:39.635135+00', -20.131832, -44.839617, '0101000020E61000003315E291786B46C0F790F0BDBF2134C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('25ea66e3-e30f-434a-ac95-177baaa9a5c1', 'Prolongamento Paraíso', 'd03c2fb6-2f32-4110-8807-c9fce2c7fc40', '2026-03-01 20:17:39.635135+00', -20.1730723, -44.8660709, '0101000020E610000036C24769DB6E46C0F0575C774E2C34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('2735a5d4-ab2a-4ce4-abd0-255704b4fb47', 'Prolongamento J.A Gonçalves', '4cde76ed-250e-485f-8d05-c77e29c9cb01', '2026-03-01 20:17:39.635135+00', -20.1648756, -44.9205111, '0101000020E6100000700DC74ED37546C08BE88D49352A34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('279a42e1-50fd-4468-a679-0740ec555d6e', 'Antares', '605abb09-9d29-472e-9be5-0edcaf1dd264', '2026-03-01 20:17:39.635135+00', -20.1609344, -44.8896019, '0101000020E6100000D07A9D79DE7146C027CD30FF322934C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('29edfb7d-8095-40b2-a34a-691402c74ea0', 'Residencial Alta Vista', '7152fd6e-c5d1-410d-bcfa-96257a80d2fa', '2026-03-01 20:17:39.635135+00', -20.1319832235129, -44.8827123641968, '0101000020E610000073D712F2416F46C05BB1BFEC9E1C34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('2d6bdf12-9681-4bac-8f31-ce397cbe099e', 'Interlagos', '605abb09-9d29-472e-9be5-0edcaf1dd264', '2026-03-01 20:17:39.635135+00', -20.1573, -44.8697, '0101000020E610000065AA6054526F46C02AA913D0442834C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('2ef5cff8-3379-4d2b-80ce-ca0a6a4f48b3', 'Universitário', '7152fd6e-c5d1-410d-bcfa-96257a80d2fa', '2026-03-01 20:17:39.635135+00', -20.1311533, -44.8706314, '0101000020E610000073EF86D9706F46C032433E43932134C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('33738b79-2bde-494a-b81c-2075473aa7da', 'São Domingos', 'ca01ed34-9647-4d98-b157-9cb350e78235', '2026-03-01 20:17:39.635135+00', -20.1939268, -44.9206734, '0101000020E610000008A63FA0D87546C064D1CF2FA53134C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('34167b67-51f1-4455-96c3-0286c3ae8317', 'Chácara Novo Horizonte', '971aadc1-7707-4cc0-b986-471bbe5ec378', '2026-03-01 20:17:39.635135+00', -20.186104, -44.8140046, '0101000020E610000093E57F4D316846C0A0A70183A42F34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('3473c285-ef45-4b62-9740-4f4b853d09d8', 'Prolongamento Espírito Santo', '7152fd6e-c5d1-410d-bcfa-96257a80d2fa', '2026-03-01 20:17:39.635135+00', -20.1349776, -44.8730633, '0101000020E61000003E6BC889C06F46C04CB159E48D2234C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('355f2b00-907f-49fb-b065-f23b7b9a971a', 'Chácara Santa Rita', '4cde76ed-250e-485f-8d05-c77e29c9cb01', '2026-03-01 20:17:39.635135+00', -20.1577435, -44.9330116, '0101000020E6100000F26492EC6C7746C015A8C5E0612834C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('35ac4f42-a789-4b3d-9109-ae2d13356d68', 'Inhame', NULL, '2026-05-12 13:56:45.010218+00', -20.1023, -44.8215, '0101000020E6100000FED478E9266946C07C613255301A34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('36b6de96-6074-4e4d-bd30-c4a63fa692ec', 'Residencial Dom Cristiano', 'c551a112-ef94-4265-b42e-40e314887950', '2026-03-01 20:17:39.635135+00', -20.1055548, -44.8822186, '0101000020E61000002276018AEC7046C092EFADA3051B34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('36c295a7-b451-41ab-aa78-e7ad42f7008f', 'Recanto do Sol', '7152fd6e-c5d1-410d-bcfa-96257a80d2fa', '2026-03-01 20:17:39.635135+00', -20.2373952045896, -44.8678207397461, '0101000020E61000004E621058396C46C0E6AE25E4831E34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('36e4fef7-64c4-41fb-87d9-3a0de6cbea1b', 'Vila Cruzeiro', '1214e817-fc60-4a84-a084-0def6f198ddd', '2026-03-01 20:17:39.635135+00', -20.1366116, -44.888381, '0101000020E6100000A3B1F677B67146C0154152FAF82234C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('37141916-80f1-4b46-b72c-d3043e1001e2', 'Residencial Terra Azul', '605abb09-9d29-472e-9be5-0edcaf1dd264', '2026-03-01 20:17:39.635135+00', -20.1848151, -44.8812315, '0101000020E61000003E5A9C31CC7046C0964EDA0A502F34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('3763336f-9d1c-44d9-b880-035d35859ac6', 'São Bento', '971aadc1-7707-4cc0-b986-471bbe5ec378', '2026-03-01 20:17:39.635135+00', -20.1854931, -44.854733, '0101000020E6100000EFE714E4676D46C03722CE797C2F34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('387b1ebc-9c2d-4f74-a30b-cca2e89edea0', 'Vila Antunes', '32f58717-8492-4758-ba9e-e775936e8f78', '2026-03-01 20:17:39.635135+00', -20.1527731903448, -44.8969602584839, '0101000020E6100000D122DBF97E7246C016FBCBEEC92334C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('390c1d4b-5f74-48cd-ac83-a622d47f158f', 'Prolongamento Jardim Copacabana', '3106de99-1c0e-469e-bf07-a37c60410632', '2026-03-01 20:17:39.635135+00', -20.2064684, -44.9252823, '0101000020E6100000A90881A66F7646C04EA8F11CDB3434C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('3b3bfdaa-40bd-4f98-9a3e-ef41bd4b3714', 'Antônio Fonseca', '3106de99-1c0e-469e-bf07-a37c60410632', '2026-03-01 20:17:39.635135+00', -20.1584498, -44.8830769, '0101000020E610000031ADF2A9087146C0C80E852A902834C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('3bfd39c6-e56f-4d74-b4b5-499fa150f435', 'Prolongamento Santa Clara', '1214e817-fc60-4a84-a084-0def6f198ddd', '2026-03-01 20:17:39.635135+00', -20.1311693, -44.884314, '0101000020E61000008EB27E33317146C03DBDAD4F942134C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('3c97532a-6628-4ac1-a025-cb0c0cb8e438', 'São Lucas', '7152fd6e-c5d1-410d-bcfa-96257a80d2fa', '2026-03-01 20:17:39.635135+00', -20.1339638, -44.8593876, '0101000020E6100000414BB269006E46C00FD99B734B2234C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('3c987d6f-43b8-4885-9caa-dddc5a7c7df7', 'Núcleo L. P Pereira', 'ac623dfd-ed4c-47ca-be91-e5e1b0d40a6c', '2026-03-01 20:17:39.635135+00', -20.1299384, -44.9138145, '0101000020E6100000280EA0DFF77446C09C7E9AA4432134C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('3fdc51d5-b228-455c-a7b2-1ee0540cad8c', 'Prolongamento Vila Cruzeiro', '1214e817-fc60-4a84-a084-0def6f198ddd', '2026-03-01 20:17:39.635135+00', -20.1367391, -44.8873686, '0101000020E6100000A83F564B957146C0A0956A55012334C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('405a7fd8-5952-448f-a2c5-c61b5bf8a87d', 'Estâncias do Gafanhoto', '5ecc6b12-eb98-4331-8717-7387845d5999', '2026-03-01 20:17:39.635135+00', -20.1062739757351, -44.8463201522827, '0101000020E610000077BE9F1A2F7546C03411363CBD3234C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('4153d9a8-9d14-4d3b-ab51-7b5b740704c0', 'Prolongamento Nova Fortaleza', 'c551a112-ef94-4265-b42e-40e314887950', '2026-03-01 20:17:39.635135+00', -20.112154, -44.9096094, '0101000020E61000002D91B0146E7446C0971DE21FB61C34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('4570780d-805c-40f6-a536-a42f186ec637', 'Nossa Senhora da Graça', '605abb09-9d29-472e-9be5-0edcaf1dd264', '2026-03-01 20:17:39.635135+00', -20.1250697, -44.876236, '0101000020E6100000F7C95180287046C075385F91042034C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('46eaabff-f96d-4a83-9184-f11d180a0255', 'Residencial Lagoa dos Mandarins', '5ecc6b12-eb98-4331-8717-7387845d5999', '2026-03-01 20:17:39.635135+00', -20.1092925, -44.8597524, '0101000020E61000002954DC5D0C6E46C0B532E197FA1B34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('4901bfb5-0444-4074-a3c9-22707b3924d2', 'Floresta', '4cde76ed-250e-485f-8d05-c77e29c9cb01', '2026-03-01 20:17:39.635135+00', -20.1911275, -44.9328614, '0101000020E6100000B3599A00687746C0C2DD59BBED3034C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('4ab2723f-5dd1-47fe-95a8-172895468b54', 'J. A Gonçalves', '4cde76ed-250e-485f-8d05-c77e29c9cb01', '2026-03-01 20:17:39.635135+00', -20.1645971, -44.9201262, '0101000020E6100000AC9800B2C67546C036841909232A34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('4b1e9979-0ef2-4622-aa28-26c696fd2d93', 'Marajó', '4cde76ed-250e-485f-8d05-c77e29c9cb01', '2026-03-01 20:17:39.635135+00', -20.1728408, -44.9233471, '0101000020E6100000A0ADDE3C307646C01B6A6F4B3F2C34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('4bb544ba-5f70-4461-b4bb-8db13272bf52', 'Doutor José Tomaz', '7152fd6e-c5d1-410d-bcfa-96257a80d2fa', '2026-03-01 20:17:39.635135+00', -20.1329502600608, -44.8777341842651, '0101000020E6100000022B8716D97646C0F931E6AE252434C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('4c441451-f3ab-4fb0-b7a2-b10627d39dc8', 'Padre Eustáquio', '971aadc1-7707-4cc0-b986-471bbe5ec378', '2026-03-01 20:17:39.635135+00', -20.1722775, -44.8509976, '0101000020E6100000BC7C467DED6C46C02E56D4601A2C34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('4c83df62-e6bf-44bf-8851-454e53019e93', 'Prolongamento Orion', '8050b9e3-b371-4340-a846-df9d536e505f', '2026-03-01 20:17:39.635135+00', -20.1385866, -44.9167188, '0101000020E61000006ED0A80A577546C0F1A952697A2334C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('4cbf1aff-71fb-4e8c-a145-58a2a744f0a3', 'Francisco Machado Filho', '605abb09-9d29-472e-9be5-0edcaf1dd264', '2026-03-01 20:17:39.635135+00', -20.1550762, -44.8880367, '0101000020E6100000EA12C42FAB7146C05163E712B32734C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('4f0d4a17-9810-4885-8886-9200f24ce0aa', 'Vila Operária', '605abb09-9d29-472e-9be5-0edcaf1dd264', '2026-03-01 20:17:39.635135+00', -20.1534748, -44.8932831, '0101000020E6100000E548C219577246C099C2DE1F4A2734C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('4fd5a03c-268d-4024-84f8-62d8926dc473', 'Garcia Leão', '1214e817-fc60-4a84-a084-0def6f198ddd', '2026-03-01 20:17:39.635135+00', -20.1254, -44.9082, '0101000020E6100000151DC9E53F7446C01CEBE2361A2034C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('520e35f3-f015-465a-af23-7edad894486a', 'Padre Herculano', '4cde76ed-250e-485f-8d05-c77e29c9cb01', '2026-03-01 20:17:39.635135+00', -20.1748342, -44.9302435, '0101000020E610000086E81038127746C0EA3823EFC12C34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('52b9f019-29dc-4442-a004-00f85546810f', 'Maria Peçanha', '605abb09-9d29-472e-9be5-0edcaf1dd264', '2026-03-01 20:17:39.635135+00', -20.1804787, -44.8795814, '0101000020E6100000014D840D4F7746C075931804561E34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('543ab2bc-245b-451a-9192-c3aa06408186', 'Santa Cruz', '8050b9e3-b371-4340-a846-df9d536e505f', '2026-03-01 20:17:39.635135+00', -20.110854, -44.9799086, '0101000020E610000048E17A14AE6F46C0363CBD52962134C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('544300f2-002c-4b8d-bf9f-5692bd967d56', 'Dona Rosa', '971aadc1-7707-4cc0-b986-471bbe5ec378', '2026-03-01 20:17:39.635135+00', -20.1673327, -44.8554823, '0101000020E61000004767AA71806D46C0270DDA50D62A34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('56e077cb-306b-4cbb-9fd2-82f401dd0fd1', 'Cacôco de Baixo', NULL, '2026-05-12 13:55:08.210319+00', -20.2154, -44.8322, '0101000020E610000098DD9387856A46C0F38E5374243734C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('57247501-fc94-4e44-acfb-4fa08251e4d6', 'Sion', '8050b9e3-b371-4340-a846-df9d536e505f', '2026-03-01 20:17:39.635135+00', -20.1352771, -44.9254585, '0101000020E610000011A7936C757646C0D1652085A12234C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('5784df57-4862-4690-9b6d-f15c5f81399e', 'Vila Minas Gerais', '1214e817-fc60-4a84-a084-0def6f198ddd', '2026-03-01 20:17:39.635135+00', -20.1427548, -44.8965298, '0101000020E6100000D9710D7DC17246C0D6581D948B2434C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('580d7bfc-6bfe-48f7-8414-6f471bf03f82', 'Dom Pedro II', '32f58717-8492-4758-ba9e-e775936e8f78', '2026-03-01 20:17:39.635135+00', -20.1588075, -44.8968683, '0101000020E6100000D9A89894CC7246C00ADCBA9BA72834C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('5a6453a1-e953-4aa3-a47b-14eb5ef3ec62', 'Prolongamento Terra Azul', '605abb09-9d29-472e-9be5-0edcaf1dd264', '2026-03-01 20:17:39.635135+00', -20.184815, -44.881232, '0101000020E61000002618CE35CC7046C06CCF2C09502F34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('5ad4d43f-493d-46d1-b9db-90334c05b394', 'Residencial Leblon', 'c551a112-ef94-4265-b42e-40e314887950', '2026-03-01 20:17:39.635135+00', -20.1324667425348, -44.8783349990845, '0101000020E6100000433FAE68CE7546C0CE22CACD262A34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('5b8c0a6e-e6e7-4295-bdd0-fab00a851530', 'Marajó I', '4cde76ed-250e-485f-8d05-c77e29c9cb01', '2026-03-01 20:17:39.635135+00', -20.1728408, -44.9233471, '0101000020E6100000A0ADDE3C307646C01B6A6F4B3F2C34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('5c087d02-72b3-4ce8-997a-76b6c9415dcf', 'C.H. F Vivendas da Serra', 'd03c2fb6-2f32-4110-8807-c9fce2c7fc40', '2026-03-01 20:17:39.635135+00', NULL, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('5cb38e82-8056-47dd-84d4-d6f192b71e85', 'Residencial Serrano', 'c551a112-ef94-4265-b42e-40e314887950', '2026-03-01 20:17:39.635135+00', -20.1072008715622, -44.8836135864258, '0101000020E6100000CB55E2F0387446C0B317C04AF42834C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('5da50550-b49f-4dfc-83de-9d15764d58db', 'Nova Vista', 'ca01ed34-9647-4d98-b157-9cb350e78235', '2026-03-01 20:17:39.635135+00', -20.1712843, -44.9069727, '0101000020E6100000B26E72AE177446C079D1B249D92B34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('5dc8acb4-13c4-42c9-a2ae-28feda9fd156', 'Liberdade', '1214e817-fc60-4a84-a084-0def6f198ddd', '2026-03-01 20:17:39.635135+00', -20.1227569, -44.897314, '0101000020E6100000191F662FDB7246C0BCDB06FF6C1F34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('5ddaa8db-6b36-4c12-91b6-497a7e40fe80', 'Mangabeiras', 'd03c2fb6-2f32-4110-8807-c9fce2c7fc40', '2026-03-01 20:17:39.635135+00', -20.1523966, -44.8677132, '0101000020E61000005C27E439116F46C08705AD76032734C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('5edff30f-5df7-4853-ab2a-7f0c6504475f', 'Prolongamento Ponte Funda', 'd03c2fb6-2f32-4110-8807-c9fce2c7fc40', '2026-03-01 20:17:39.635135+00', -20.1562408, -44.8643776, '0101000020E61000008EB2D9ECA36E46C0064DA665FF2734C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('604ee77a-b5ff-4c95-be1b-b41f39e5cf27', 'Novo Icaraí', '5ecc6b12-eb98-4331-8717-7387845d5999', '2026-03-01 20:17:39.635135+00', -20.1003900742173, -44.8639041956461, '0101000020E6100000AC1C5A643B7746C0F5DBD781732634C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('61466a0d-1e07-462d-91f9-25dfffb85da7', 'Cidade Jardim', '605abb09-9d29-472e-9be5-0edcaf1dd264', '2026-03-01 20:17:39.635135+00', -20.1667687, -44.8851583, '0101000020E61000003824FFDD4C7146C0167F805AB12A34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('61a58277-0853-4a0f-98cf-20270ab271d4', 'Itacolomi', 'ca01ed34-9647-4d98-b157-9cb350e78235', '2026-03-01 20:17:39.635135+00', -20.1912081, -44.9040437, '0101000020E6100000D2D336B4B77346C0F53A9803F33034C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('62da305f-9634-4059-984a-3d52144b47db', 'Savassi', '5ecc6b12-eb98-4331-8717-7387845d5999', '2026-03-01 20:17:39.635135+00', -20.1378155, -44.8262704, '0101000020E610000090D37C3AC36946C0C36169E0472334C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('63e729d3-525b-4ea9-a9d9-73b284989857', 'Jardim Belvedere II', 'ca01ed34-9647-4d98-b157-9cb350e78235', '2026-03-01 20:17:39.635135+00', -20.1762915, -44.9080035, '0101000020E6100000A7936C75397446C013109370212D34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('643ea907-19b1-4be7-83d6-47ebf234d8bd', 'Fábio Notini', 'ac623dfd-ed4c-47ca-be91-e5e1b0d40a6c', '2026-03-01 20:17:39.635135+00', -20.147319, -44.9216175, '0101000020E6100000EDF5EE8FF77546C05514AFB2B62534C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('64cd12ee-88be-4938-8a98-0bd35463629f', 'Novo Paraíso', '971aadc1-7707-4cc0-b986-471bbe5ec378', '2026-03-01 20:17:39.635135+00', -20.1738183, -44.8584005, '0101000020E61000005E2F4D11E06D46C042F2295B7F2C34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('652ea19a-5402-4c0d-862a-f5ac04aeaa84', 'Residencial São Miguel', '5ecc6b12-eb98-4331-8717-7387845d5999', '2026-03-01 20:17:39.635135+00', -20.1038156602182, -44.8621559143066, '0101000020E61000003B922639BB6E46C0BE13B35E0C1B34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('65500104-80f6-4bc2-bcce-05a5d348ecf4', 'Residencial Campina Verde', '4cde76ed-250e-485f-8d05-c77e29c9cb01', '2026-03-01 20:17:39.635135+00', -20.1503105, -44.9254799, '0101000020E61000007CCD1720767646C0D3BEB9BF7A2634C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('66fd0b14-dba6-4947-bc19-89bce1d4e9dd', 'Dulphe Pinto de Aguiar', 'ac623dfd-ed4c-47ca-be91-e5e1b0d40a6c', '2026-03-01 20:17:39.635135+00', -20.1412312, -44.9207884, '0101000020E6100000A144F064DC7546C0C22C59BA272434C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('694b7a4d-3a86-4a53-8c21-17ada0b63076', 'Prolongamento São Lucas', '7152fd6e-c5d1-410d-bcfa-96257a80d2fa', '2026-03-01 20:17:39.635135+00', -20.1346576, -44.8602863, '0101000020E610000032D989DC1D6E46C06928A4EB782234C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('6aed3280-da50-475e-9221-c68f804da958', 'Prolongamento Morada Nova', 'ca01ed34-9647-4d98-b157-9cb350e78235', '2026-03-01 20:17:39.635135+00', -20.1701903, -44.9084349, '0101000020E6100000C4054598477446C0B0986C97912B34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('6b92ddd7-9221-4fff-b711-e06d095c104e', 'Jardim das Oliveiras', 'c551a112-ef94-4265-b42e-40e314887950', '2026-03-01 20:17:39.635135+00', -20.1047085, -44.877412, '0101000020E6100000198F52094F7046C0FC1C1F2DCE1A34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('6bb449bd-25fd-4dd0-9f5d-ab7faa6e7e61', 'Condomínio Ville Royale', 'ca01ed34-9647-4d98-b157-9cb350e78235', '2026-03-01 20:17:39.635135+00', -20.1218, -44.8512, '0101000020E6100000772D211FF46C46C01EA7E8482E1F34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('6df80db0-6b09-40c0-9562-b5c32e4191ef', 'Santa Tereza', '605abb09-9d29-472e-9be5-0edcaf1dd264', '2026-03-01 20:17:39.635135+00', -20.1652581, -44.8763606, '0101000020E610000060408A952C7046C02BE6D65A4E2A34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('6f117868-2419-4292-a57a-b512e40a90da', 'Chanadours', 'ca01ed34-9647-4d98-b157-9cb350e78235', '2026-03-01 20:17:39.635135+00', -20.1792753, -44.9163604, '0101000020E6100000BCAC2E4C4B7546C0087B6EFCE42D34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('6f181af1-c2ca-4513-b72f-a8fbbc2bf6a2', 'Icaraí', '5ecc6b12-eb98-4331-8717-7387845d5999', '2026-03-01 20:17:39.635135+00', -20.1178257, -44.8508904, '0101000020E61000007C3D04FAE96C46C0D92038D3291E34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('6f1d562d-0c26-454b-a968-2298c2a59601', 'Vila E. G.', NULL, '2026-05-12 14:08:36.231227+00', -20.1384, -44.8982, '0101000020E610000034A2B437F87246C033C4B12E6E2334C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('702be8c0-b01c-4910-a046-9def38df03bb', 'Bom Pastor', 'c551a112-ef94-4265-b42e-40e314887950', '2026-03-01 20:17:39.635135+00', -20.1191, -44.8885593, '0101000020E61000004007A74FBC7146C01FF46C567D1E34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('70426f4f-3081-485d-9235-3d07b3c3b3c0', 'Mar e Terra', '605abb09-9d29-472e-9be5-0edcaf1dd264', '2026-03-01 20:17:39.635135+00', -20.1663256, -44.8818323, '0101000020E61000003A877CE1DF7046C0D27C8450942A34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('720babc8-b63e-4051-a43f-db25e383727a', 'Jardim Dona Quita', 'd03c2fb6-2f32-4110-8807-c9fce2c7fc40', '2026-03-01 20:17:39.635135+00', -20.1678564, -44.8681852, '0101000020E6100000846F50B1206F46C09F6C14A3F82A34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('73375757-9981-4dfd-b543-ab3697feed24', 'Prolongamento Sion', '8050b9e3-b371-4340-a846-df9d536e505f', '2026-03-01 20:17:39.635135+00', -20.134541, -44.9251057, '0101000020E6100000EE6B13DD697646C09CF86A47712234C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('749123bc-190e-416c-ba88-cc839834a56f', 'Vila Castelo', 'ca01ed34-9647-4d98-b157-9cb350e78235', '2026-03-01 20:17:39.635135+00', -20.1876989352981, -44.9186325073242, '0101000020E6100000674E4D38AA7546C086BBC4A2333034C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('75db166e-d751-4a9d-8536-76dc3dc2df6b', 'Conjunto Habitacional Serra Verde', 'c551a112-ef94-4265-b42e-40e314887950', '2026-03-01 20:17:39.635135+00', -20.1151157, -44.9065945, '0101000020E6100000E21DE0490B7446C093C1F638781D34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('75e02976-937a-4037-b1ee-05220412212c', 'Residencial Costa Azul', '605abb09-9d29-472e-9be5-0edcaf1dd264', '2026-03-01 20:17:39.635135+00', -20.1892861, -44.8866818, '0101000020E6100000AD7A0ACA7E7146C05F16C90D753034C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('763215f1-a03f-4a2a-8c33-1694aefeae71', 'Ponte Funda', 'd03c2fb6-2f32-4110-8807-c9fce2c7fc40', '2026-03-01 20:17:39.635135+00', -20.1565261, -44.8646018, '0101000020E610000008889345AB6E46C06E783018122834C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('77ec4541-4ecc-4c91-b9d5-857fcbcfb21f', 'Altaville', '4cde76ed-250e-485f-8d05-c77e29c9cb01', '2026-03-01 20:17:39.635135+00', -20.1437484283309, -44.9275159835816, '0101000020E61000002AA913D0447046C0AAF1D24D622034C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('781750c1-403a-4021-b6b6-221c9f36c135', 'Centro Industrial Santo Antônio dos Campos', '8050b9e3-b371-4340-a846-df9d536e505f', '2026-03-01 20:17:39.635135+00', -20.1065963749062, -44.9784564971924, '0101000020E6100000BB1CC06C4C7D46C03A89528C3D1B34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('782fc425-e9b6-4dcc-89fc-1e79f7d24c5c', 'Santa Luzia', '32f58717-8492-4758-ba9e-e775936e8f78', '2026-03-01 20:17:39.635135+00', -20.1487597, -44.9066417, '0101000020E61000004D58D1D50C7446C078769E1D152634C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('7a979b63-d000-4a72-9c2a-9610e57f834e', 'Residencial São Frei Galvão', '5ecc6b12-eb98-4331-8717-7387845d5999', '2026-03-01 20:17:39.635135+00', -20.1433455250088, -44.8385095596314, '0101000020E61000009FCDAACFD57646C096438B6CE72B34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('7aa077e8-80e2-4f57-a963-c8af39b796f7', 'Prolongamento Afonso Pena', '1214e817-fc60-4a84-a084-0def6f198ddd', '2026-03-01 20:17:39.635135+00', -20.1322709, -44.8886226, '0101000020E610000045BEA662BE7146C066B67581DC2134C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('7b7081a7-005d-4c85-9547-b317132db498', 'Condomínio Horizontal Fechado Vale da Liberdade', '1214e817-fc60-4a84-a084-0def6f198ddd', '2026-03-01 20:17:39.635135+00', -20.1252540952138, -44.8944067955017, '0101000020E6100000AB3E575BB17746C094F6065F982C34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('7b7afe1f-68a5-4acf-bb61-dd86237826dc', 'Prolongamento Alvorada I e II', '1214e817-fc60-4a84-a084-0def6f198ddd', '2026-03-01 20:17:39.635135+00', -20.1154217942583, -44.889600276947, '0101000020E61000005BD3BCE3146D46C037894160E52034C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('7bee1717-47ec-4837-90d4-3efa76121195', 'Distrito Industrial Coronel Jovelino Rabelo', '5ecc6b12-eb98-4331-8717-7387845d5999', '2026-03-01 20:17:39.635135+00', -20.1181417, -44.8363984, '0101000020E61000009F364F1A0F6B46C039CBD1883E1E34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('7d968878-bdf8-465c-ac4d-7f0e1d6d366a', 'São José', '32f58717-8492-4758-ba9e-e775936e8f78', '2026-03-01 20:17:39.635135+00', -20.1584219, -44.9062321, '0101000020E6100000EE0AD869FF7346C05E786F568E2834C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('813f4773-1405-426b-a319-56b78b7091ba', 'São Francisco', '4cde76ed-250e-485f-8d05-c77e29c9cb01', '2026-03-01 20:17:39.635135+00', -20.1086009, -44.9093488, '0101000020E610000013549E8A657446C0F0D0C144CD1B34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('843380bc-b5a9-4f23-931a-5b83fc7dd417', 'São Luiz', '7152fd6e-c5d1-410d-bcfa-96257a80d2fa', '2026-03-01 20:17:39.635135+00', -20.1443187, -44.8684213, '0101000020E61000002D53DD6D286F46C084B30012F22434C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('856283e6-817d-41c3-9703-b396052a3a5d', 'Grajaú', '5ecc6b12-eb98-4331-8717-7387845d5999', '2026-03-01 20:17:39.635135+00', -20.1362604, -44.8441312, '0101000020E610000041C4BC7D0C6C46C069BD29F6E12234C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('8589a7b5-799a-4e3b-9e24-bb2e6abeb80c', 'Chácara Sambeca', '971aadc1-7707-4cc0-b986-471bbe5ec378', '2026-03-01 20:17:39.635135+00', -20.0854, -44.9125, '0101000020E6100000CDCCCCCCCC7446C012143FC6DC1534C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('8603f63d-667a-4691-8176-a1addbcd0dc6', 'Novo Horizonte', NULL, '2026-05-12 14:06:01.234045+00', -20.186104, -44.8140046, '0101000020E610000093E57F4D316846C0A0A70183A42F34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('87b7f2d7-3783-413f-b3f5-a813164a0a82', 'Sagrada Família', 'd03c2fb6-2f32-4110-8807-c9fce2c7fc40', '2026-03-01 20:17:39.635135+00', -20.1628107, -44.8544953, '0101000020E6100000F90A1C1A606D46C05AF047F6AD2934C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('89d33caf-d8b1-4aad-8f03-27531d9b8a3d', 'São Sebastião', '1214e817-fc60-4a84-a084-0def6f198ddd', '2026-03-01 20:17:39.635135+00', -20.1280557, -44.8901257, '0101000020E6100000206A91A3EF7146C0FF902342C82034C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('8a43d896-6e66-4ede-aff2-a5d686e67646', 'Catalão', '32f58717-8492-4758-ba9e-e775936e8f78', '2026-03-01 20:17:39.635135+00', -20.1533371, -44.9008033, '0101000020E61000007FD0C4854D7346C074C3A519412734C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('8a676b0d-8086-416f-80f1-f37e3d349938', 'Planalto', '32f58717-8492-4758-ba9e-e775936e8f78', '2026-03-01 20:17:39.635135+00', -20.1470319, -44.9091184, '0101000020E61000008E18E2FD5D7446C000F8F1E1A32534C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('8ad620fc-8a5d-43b1-9b67-f37de906e177', 'Ipiranga', 'ac623dfd-ed4c-47ca-be91-e5e1b0d40a6c', '2026-03-01 20:17:39.635135+00', -20.1387294, -44.9064404, '0101000020E6100000F7E2303D067446C063FE1BC5832334C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('8c92abcd-b84d-4330-b59e-7e31a4e53956', 'Prolongamento Vila Romana', '7152fd6e-c5d1-410d-bcfa-96257a80d2fa', '2026-03-01 20:17:39.635135+00', -20.1133445, -44.8680553, '0101000020E61000004B4FA26F1C6F46C075AE2825041D34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('8d75f115-df27-449f-9bf4-a066e79b879b', 'Chácaras Campo Grande', '971aadc1-7707-4cc0-b986-471bbe5ec378', '2026-03-01 20:17:39.635135+00', -20.1705391659188, -44.8327159881592, '0101000020E6100000C8540B36BF6A46C048C2BE9D442C34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('8e367931-ccd5-4ff6-ac15-3fcb9c498a9e', 'Prolongamento Bela Vista', '32f58717-8492-4758-ba9e-e775936e8f78', '2026-03-01 20:17:39.635135+00', -20.1738574, -44.9062603, '0101000020E6100000E2146756007446C0E72A27EB812C34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('8e38784c-f766-443b-900e-8d856f492f4c', 'Realengo', 'ca01ed34-9647-4d98-b157-9cb350e78235', '2026-03-01 20:17:39.635135+00', -20.1852166, -44.9049449, '0101000020E61000004B17073CD57346C023ADE75A6A2F34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('8fb0486d-d427-40c2-8889-0504f67a612d', 'Prolongamento Bom Pastor III', 'c551a112-ef94-4265-b42e-40e314887950', '2026-03-01 20:17:39.635135+00', -20.1102636187342, -44.8797512054443, '0101000020E610000083C0CAA1456E46C083C0CAA1452634C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('9105112c-79fc-4b15-b2b7-f2d220759899', 'Alfavile', '971aadc1-7707-4cc0-b986-471bbe5ec378', '2026-03-01 20:17:39.635135+00', -20.1667587, -44.8374364, '0101000020E6100000703DAF1D316B46C0CFD2BAB2B02A34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('91869f03-be5b-419c-8cd9-7a6471073b4a', 'Porto Velho', '3106de99-1c0e-469e-bf07-a37c60410632', '2026-03-01 20:17:39.635135+00', -20.1463965, -44.8809205, '0101000020E610000020F0C000C27046C0B6BFB33D7A2534C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('93b1c4b4-9e94-439a-b48a-021b8b9d5a5a', 'Danilo Passos I', '7152fd6e-c5d1-410d-bcfa-96257a80d2fa', '2026-03-01 20:17:39.635135+00', -20.1211753, -44.8754701, '0101000020E61000001C107C670F7046C03F952E58051F34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('93ebc36e-4147-412b-ba5e-bf39836f6e70', 'Florermida', '8050b9e3-b371-4340-a846-df9d536e505f', '2026-03-01 20:17:39.635135+00', -20.1043324, -44.970698, '0101000020E6100000742502D53F7C46C0C7E93587B51A34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('945051ff-104d-47a9-b143-402a0f1b9a37', 'Prolongamento Catalão', '32f58717-8492-4758-ba9e-e775936e8f78', '2026-03-01 20:17:39.635135+00', -20.1525912, -44.9009583, '0101000020E6100000A6C7009A527346C04BA88537102734C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('96075f07-a97b-456a-8950-7372470c39e6', 'Jardim Pacaembú', NULL, '2026-05-12 14:04:26.360099+00', -20.1601, -44.8352, '0101000020E610000042CF66D5E76A46C0F0164850FC2834C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('96c2c937-98a4-4cfd-9a79-95789832a0e6', 'Yanes', '4cde76ed-250e-485f-8d05-c77e29c9cb01', '2026-03-01 20:17:39.635135+00', -20.1769289, -44.9221111, '0101000020E6100000A9E38CBC077646C09E375F364B2D34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('97a14564-1d98-483b-b795-bfd556a12e22', 'Porto Velho - Vila Guiomar', NULL, '2026-05-12 14:06:33.129597+00', -20.1372, -44.8734, '0101000020E6100000C7293A92CB6F46C0DE02098A1F2334C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('97b74a79-8863-4ce9-a652-8b5b5b28bc94', 'Residencial Casa Nova', '4cde76ed-250e-485f-8d05-c77e29c9cb01', '2026-03-01 20:17:39.635135+00', -20.1576428, -44.9274969, '0101000020E61000001952EA37B87646C02B734E475B2834C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('982a775f-4379-4fc0-93e5-0bbb5ab0aaf1', 'Dona Ceci', 'ac623dfd-ed4c-47ca-be91-e5e1b0d40a6c', '2026-03-01 20:17:39.635135+00', -20.1240968, -44.9121842, '0101000020E6100000C676AD73C27446C0CB89D1CEC41F34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('98eb842e-5b17-43dc-987d-d13759b07503', 'Chácaras Beira Rio', '5ecc6b12-eb98-4331-8717-7387845d5999', '2026-03-01 20:17:39.635135+00', -20.155422, -44.8205626, '0101000020E61000000EA9FD31086946C0341477BCC92734C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('997debf1-4c82-4258-b19d-20cad53eced2', 'Prolongamento Manoel Valinhas', '3106de99-1c0e-469e-bf07-a37c60410632', '2026-03-01 20:17:39.635135+00', -20.130584, -44.8653265, '0101000020E61000005BEECC04C36E46C08061F9F36D2134C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('998454dc-8ca8-4f6a-8809-0635d50e670f', 'Residêncial Quinta das Palmeiras', '605abb09-9d29-472e-9be5-0edcaf1dd264', '2026-03-01 20:17:39.635135+00', -20.1806662, -44.8848364, '0101000020E6100000BA27B451427146C01B7EDC23402E34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('9bf43aff-3d76-4ce8-af72-251bc968b0f5', 'Bela Vista', '32f58717-8492-4758-ba9e-e775936e8f78', '2026-03-01 20:17:39.635135+00', -20.1718684, -44.9047411, '0101000020E61000006DEC6D8ECE7346C042374591FF2B34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('9c72f49b-3e2a-458a-a055-850e60f93f1e', 'Vila Santo Antônio', 'ac623dfd-ed4c-47ca-be91-e5e1b0d40a6c', '2026-03-01 20:17:39.635135+00', -20.142304, -44.9063049, '0101000020E61000002FDA88CC017446C00917F2086E2434C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('9d057e78-b15b-4db9-8fd1-bb516b7be389', 'Geraldo Pereira', '4cde76ed-250e-485f-8d05-c77e29c9cb01', '2026-03-01 20:17:39.635135+00', -20.1814605, -44.9224329, '0101000020E610000091200148127646C00C040132742E34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('9deadc9f-8671-4bf5-8ffa-421e6c5e69db', 'João Paulo II', 'ca01ed34-9647-4d98-b157-9cb350e78235', '2026-03-01 20:17:39.635135+00', -20.1982062, -44.9229479, '0101000020E6100000B8342328237646C04CDD3AA4BD3234C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('9f446ce9-e155-4d26-8c9f-55c25c4e50eb', 'Prolongamento Tietê', 'ac623dfd-ed4c-47ca-be91-e5e1b0d40a6c', '2026-03-01 20:17:39.635135+00', -20.1437822, -44.9151016, '0101000020E610000036429A0C227546C037BF06E9CE2434C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('9f478930-9c63-4642-80be-040199dc3db1', 'Prolongamento Residencial Walchir Resende', 'ac623dfd-ed4c-47ca-be91-e5e1b0d40a6c', '2026-03-01 20:17:39.635135+00', -20.1268827, -44.9100066, '0101000020E61000007412A5187B7446C09DED76627B2034C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('a13305b3-b9bf-456c-873c-56152e9f0a44', 'Eldorado', '5ecc6b12-eb98-4331-8717-7387845d5999', '2026-03-01 20:17:39.635135+00', -20.0983091, -44.8685217, '0101000020E6100000E4AE14B82B6F46C0326601C92A1934C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('a1739629-173f-4f81-b1d2-32e61e71464e', 'Golden Sul', '971aadc1-7707-4cc0-b986-471bbe5ec378', '2026-03-01 20:17:39.635135+00', -20.1892, -44.8874, '0101000020E6100000363CBD52967146C0386744696F3034C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('a1a83e04-0306-4f8a-a60f-d71c29b48f1b', 'Padre Libério', 'c551a112-ef94-4265-b42e-40e314887950', '2026-03-01 20:17:39.635135+00', -20.1182941, -44.8816499, '0101000020E6100000C68267E7D97046C04CCFAA85481E34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('a1f96d33-303b-444d-b443-4281eb6a2e3e', 'Nova América', '3106de99-1c0e-469e-bf07-a37c60410632', '2026-03-01 20:17:39.635135+00', -20.1338717, -44.893327, '0101000020E610000020D1048A587246C0245C6D6A452234C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('a24b31b0-a841-42cf-95e2-eb177586b137', 'São Miguel', '32f58717-8492-4758-ba9e-e775936e8f78', '2026-03-01 20:17:39.635135+00', -20.158232, -44.900471, '0101000020E61000008BFF3BA2427346C0412E71E4812834C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('a30a4b7e-4b95-4d96-a408-0da2b4dd5838', 'Alterosa', 'ca01ed34-9647-4d98-b157-9cb350e78235', '2026-03-01 20:17:39.635135+00', -20.1852368, -44.9103523, '0101000020E6100000502B966C867446C00404CEAD6B2F34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('a3a112ac-d5e3-491d-8054-9fac42ff783e', 'São Cristóvão', '4cde76ed-250e-485f-8d05-c77e29c9cb01', '2026-03-01 20:17:39.635135+00', -20.1967261, -44.9408865, '0101000020E6100000BB5F05F86E7846C006C545A45C3234C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('a3d3d503-7442-4a66-8a51-1e7a161d4d2e', 'Jardim Capitão Silva', '3106de99-1c0e-469e-bf07-a37c60410632', '2026-03-01 20:17:39.635135+00', -20.138533, -44.8958564, '0101000020E6100000C6F4296CAB7246C0B16A10E6762334C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('a59ec6b1-2767-4d33-ae3a-bae3b90caab6', 'Vila Belo Horizonte', '3106de99-1c0e-469e-bf07-a37c60410632', '2026-03-01 20:17:39.635135+00', -20.1466012, -44.8969829, '0101000020E61000001E49EE55D07246C0EA8DFFA7872534C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('a6fe9c11-db15-40b8-a15b-d7dded138d8b', 'Aeroporto', '605abb09-9d29-472e-9be5-0edcaf1dd264', '2026-03-01 20:17:39.635135+00', -20.1763964, -44.8770687, '0101000020E6100000316C83C9437046C0D4218150282D34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('a7e75cf8-a891-4136-bc72-b386751075af', 'Tietê', 'ac623dfd-ed4c-47ca-be91-e5e1b0d40a6c', '2026-03-01 20:17:39.635135+00', -20.1441512, -44.9148047, '0101000020E6100000115D0652187546C0DDADD117E72434C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('a825da6a-38b3-4299-b781-618c159339cf', 'Santos Dumont', '605abb09-9d29-472e-9be5-0edcaf1dd264', '2026-03-01 20:17:39.635135+00', -20.1747448, -44.879193, '0101000020E6100000A2EF6E65897046C064254113BC2C34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('a96febae-4bd8-4073-8cd2-76ecc8182cc1', 'Erminópolis', '8050b9e3-b371-4340-a846-df9d536e505f', '2026-03-01 20:17:39.635135+00', -20.1078184, -44.9717709, '0101000020E61000002D5A25FD627C46C034E895FC991B34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('ac28e369-ec33-4a3c-9909-4aa9980d10c7', 'Ipanema', '5ecc6b12-eb98-4331-8717-7387845d5999', '2026-03-01 20:17:39.635135+00', -20.137473, -44.8382652, '0101000020E6100000FDAF29464C6B46C04015376E312334C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('ae272140-f73d-4de1-8b1d-8e07d9a551c3', 'Vila das Oliveiras', 'c551a112-ef94-4265-b42e-40e314887950', '2026-03-01 20:17:39.635135+00', -20.1220304580938, -44.8821973800659, '0101000020E610000092C19B7F057146C0330DD4731C1F34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('aebbb54d-db59-4de0-a787-54c78c9e679f', 'Jardinópolis', '4cde76ed-250e-485f-8d05-c77e29c9cb01', '2026-03-01 20:17:39.635135+00', -20.1939871, -44.9410266, '0101000020E610000042D5438F737846C08C587A23A93134C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('af48f2e6-2238-4964-ac1a-d3d817008732', 'Residencial Totonho Carvalho', '8050b9e3-b371-4340-a846-df9d536e505f', '2026-03-01 20:17:39.635135+00', -20.1245, -44.8451, '0101000020E6100000C0EC9E3C2C6C46C01D5A643BDF1F34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('b523ca11-a5e7-4fea-9255-89958a4266a9', 'Prolongamento Nações', 'd03c2fb6-2f32-4110-8807-c9fce2c7fc40', '2026-03-01 20:17:39.635135+00', -20.1580528, -44.8563057, '0101000020E61000006F70D86C9B6D46C08E0AF725762834C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('b5e1e882-357c-4860-9277-6bc27d318bcd', 'C. H. F Vesper', 'ca01ed34-9647-4d98-b157-9cb350e78235', '2026-03-01 20:17:39.635135+00', -20.1856849757006, -44.9209499359131, '0101000020E6100000D578E926317046C0910F7A36AB1E34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('b6d40805-2e7d-413e-a296-dbe66d949276', 'L. P. Pereira', 'ac623dfd-ed4c-47ca-be91-e5e1b0d40a6c', '2026-03-01 20:17:39.635135+00', -20.1327626, -44.9095924, '0101000020E6100000575815866D7446C0C621D1BAFC2134C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('b8dc6535-23a4-4ac5-b387-178695d85158', 'Jardim Betânia', '8050b9e3-b371-4340-a846-df9d536e505f', '2026-03-01 20:17:39.635135+00', -20.1344309, -44.9301577, '0101000020E6100000B1CF52680F7746C065123F106A2234C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('b8f12c69-16c4-41aa-8262-318f508dbde4', 'São Mateus', '971aadc1-7707-4cc0-b986-471bbe5ec378', '2026-03-01 20:17:39.635135+00', -20.1810987, -44.8521227, '0101000020E6100000F1564C5B126D46C01ED9017C5C2E34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('b91be2f6-bfdd-4239-8f79-13eb26ac5ea5', 'São Paulo', 'ca01ed34-9647-4d98-b157-9cb350e78235', '2026-03-01 20:17:39.635135+00', -20.1889928, -44.9220467, '0101000020E61000003FF152A0057646C0F22D07D5613034C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('bbe296f4-3b7b-415a-ba05-c969defd8399', 'Conjunto Habitacional Nilda Barros', '4cde76ed-250e-485f-8d05-c77e29c9cb01', '2026-03-01 20:17:39.635135+00', -20.1613962, -44.9376256, '0101000020E610000039F29B1D047846C0DCB2E842512934C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('bc3dd583-5e19-4ead-a009-2147267b1118', 'São Geraldo', '7152fd6e-c5d1-410d-bcfa-96257a80d2fa', '2026-03-01 20:17:39.635135+00', -20.1293905, -44.8595593, '0101000020E6100000803C050A066E46C0C0E95DBC1F2134C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('bca4a32f-682b-4722-9da9-7624e495466e', 'Prolongamento São José', '32f58717-8492-4758-ba9e-e775936e8f78', '2026-03-01 20:17:39.635135+00', -20.1593443, -44.903489, '0101000020E6100000DBA50D87A57346C0D44DBDC9CA2834C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('bfef9e6f-f644-4c8d-b364-eb2b13c613d2', 'Prolongamento Jardim Capitão Silva', '1214e817-fc60-4a84-a084-0def6f198ddd', '2026-03-01 20:17:39.635135+00', -20.1295656059669, -44.9173021316528, '0101000020E610000071EA5E82AE7246C0185124A9962234C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('c2c34d7b-d0d6-4254-b183-e8940b941175', 'Chácaras Bom Retiro', '4cde76ed-250e-485f-8d05-c77e29c9cb01', '2026-03-01 20:17:39.635135+00', -20.183837, -44.9491048, '0101000020E6100000023D1E447C7946C075CB0EF10F2F34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('c4d9017e-498b-4f62-911d-6bcc70b247ac', 'Residencial Alto das Oliveiras', 'c551a112-ef94-4265-b42e-40e314887950', '2026-03-01 20:17:39.635135+00', -20.1057299, -44.902904, '0101000020E6100000BBB6B75B927346C098B55E1D111B34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('c500ef80-7c5b-4adf-b1d1-f6cffe443853', 'Industrial', 'c551a112-ef94-4265-b42e-40e314887950', '2026-03-01 20:17:39.635135+00', -20.1236837, -44.8867139, '0101000020E61000004DB450D77F7146C05C8C26BCA91F34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('c5237e31-d94b-4b5e-bfcd-6ef4c839e62b', 'Morumbi', 'ca01ed34-9647-4d98-b157-9cb350e78235', '2026-03-01 20:17:39.635135+00', -20.2007709, -44.9225341, '0101000020E610000059B44AFAC56A46C0C666ECF07C2534C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('c6122411-04d6-4eee-baee-4e169d8c6f89', 'Chácara Vale das Flores', '4cde76ed-250e-485f-8d05-c77e29c9cb01', '2026-03-01 20:17:39.635135+00', -20.1012, -44.9458, '0101000020E6100000454772F90F7946C0EE5A423EE81934C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('c61a2cf0-96d2-4672-b8bc-58179a948fbb', 'Chácara Siarom', '4cde76ed-250e-485f-8d05-c77e29c9cb01', '2026-03-01 20:17:39.635135+00', -20.1890331, -44.9477744, '0101000020E610000036FEE9AB507946C08B5C2679643034C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('c710f4fc-3a64-4ddc-b49d-cc57ac4ed23c', 'Santa Rosa', 'd03c2fb6-2f32-4110-8807-c9fce2c7fc40', '2026-03-01 20:17:39.635135+00', -20.1640577, -44.8596187, '0101000020E6100000D8C34DFC076E46C0302878AFFF2934C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('c75fd0d8-442f-4ad4-ba46-3099587c421e', 'Centro', '3106de99-1c0e-469e-bf07-a37c60410632', '2026-03-01 20:17:39.635135+00', -20.145, -44.891, '0101000020E6100000355EBA490C7246C085EB51B81E2534C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('c93fee51-ae7c-4f80-afda-f0b820cf6f21', 'Prolongamento Halim Souki', '7152fd6e-c5d1-410d-bcfa-96257a80d2fa', '2026-03-01 20:17:39.635135+00', -20.1348227, -44.8660151, '0101000020E6100000CC2B3295D96E46C028428FBD832234C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('ca1469d2-285d-48b1-bdd1-0aeb53844138', 'Oliveiras', 'c551a112-ef94-4265-b42e-40e314887950', '2026-03-01 20:17:39.635135+00', -20.1116589, -44.8850637, '0101000020E61000003A306FC4497146C0ADCE7BAD951C34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('ca67f4ed-bbb3-4837-a174-9ace58f8f829', 'Prolongamento Vila Operária', '605abb09-9d29-472e-9be5-0edcaf1dd264', '2026-03-01 20:17:39.635135+00', -20.1532569, -44.8918683, '0101000020E6100000686B8EBD287246C0E7621DD83B2734C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('ca93dd1f-438d-46ea-ab96-28724aea6219', 'Nova Holanda', '605abb09-9d29-472e-9be5-0edcaf1dd264', '2026-03-01 20:17:39.635135+00', -20.1712201, -44.8819182, '0101000020E6100000A45F11B2E27046C0F8EA9914D52B34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('cb68d628-c0ea-4059-a084-789015f7001e', 'Prolongamento Quintino', '4cde76ed-250e-485f-8d05-c77e29c9cb01', '2026-03-01 20:17:39.635135+00', -20.1606811, -44.9312465, '0101000020E6100000DA01D715337746C0D7958565222934C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('cbd3b103-d19e-4c02-afe4-11de189abc49', 'Vila Rica', '7152fd6e-c5d1-410d-bcfa-96257a80d2fa', '2026-03-01 20:17:39.635135+00', -20.1287357, -44.8623058, '0101000020E610000058135509606E46C0E253A5D2F42034C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('cc35e31c-1f0f-4643-b618-628c050ba635', 'Maria Helena', 'd03c2fb6-2f32-4110-8807-c9fce2c7fc40', '2026-03-01 20:17:39.635135+00', -20.1512081, -44.8582718, '0101000020E61000001E0AB0D9DB6D46C0EB63F492B52634C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('cc6d8284-30a8-4771-9c14-68ab9f0eadaf', 'Vivendas da Exposição', 'ca01ed34-9647-4d98-b157-9cb350e78235', '2026-03-01 20:17:39.635135+00', -20.1910067, -44.9165321, '0101000020E6100000FA9D81EC507546C01FD1A9D0E53034C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('cdb7ba05-d3ee-4587-82c1-951e2ed13320', 'C. H. F Residencial Aquaville', '4cde76ed-250e-485f-8d05-c77e29c9cb01', '2026-03-01 20:17:39.635135+00', -20.1537803858927, -44.9370431900024, '0101000020E61000004A7B832F4C7646C0029A081B9E2E34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('d0c9436e-76f3-422c-9166-5d31f60ed420', 'Jardim das Mansões', '7152fd6e-c5d1-410d-bcfa-96257a80d2fa', '2026-03-01 20:17:39.635135+00', -20.1184754, -44.8605785, '0101000020E61000000492B06F276E46C06A616067541E34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('d2c64369-1ffe-4565-8140-125b207999bd', 'Jardim Belvedere', 'ca01ed34-9647-4d98-b157-9cb350e78235', '2026-03-01 20:17:39.635135+00', -20.1771857, -44.9018228, '0101000020E6100000C164F4ED6E7346C0A1D1C20A5C2D34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('d5013934-094d-4ff2-b2db-55e5ce923ee8', 'Paraíso', 'd03c2fb6-2f32-4110-8807-c9fce2c7fc40', '2026-03-01 20:17:39.635135+00', -20.1719653, -44.8656103, '0101000020E610000056CA7C51CC6E46C0FD8BFBEA052C34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('d5353505-c5eb-4820-8510-881213ed6e15', 'Alvorada', '1214e817-fc60-4a84-a084-0def6f198ddd', '2026-03-01 20:17:39.635135+00', -20.1167326, -44.8965308, '0101000020E6100000A9ED7085C17246C086600B30E21D34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('d6f7ed3a-fb71-4d65-ba87-093db73beee0', 'Residencial Boa Vista', 'c551a112-ef94-4265-b42e-40e314887950', '2026-03-01 20:17:39.635135+00', -20.2211554, -44.8844637, '0101000020E6100000E4FF441B367146C07455EAA39D3834C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('d80b97ae-e9c8-4b15-9509-3cb4e4c2c025', 'Vista Alegre', '8050b9e3-b371-4340-a846-df9d536e505f', '2026-03-01 20:17:39.635135+00', -20.1060049, -44.9634453, '0101000020E6100000117EF32C527B46C03BB71A23231B34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('d93e2e57-ed05-463b-ba31-737c26ed223b', 'Orion', 'ac623dfd-ed4c-47ca-be91-e5e1b0d40a6c', '2026-03-01 20:17:39.635135+00', -20.1390242, -44.9132061, '0101000020E6100000FC00FFEFE37446C0425A0817972334C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('d96750a4-79c1-4355-a706-8e63f5989095', 'Cidade Industrial Coronel Jovelino Rabelo', '5ecc6b12-eb98-4331-8717-7387845d5999', '2026-03-01 20:17:39.635135+00', -20.1234632, -44.8475754, '0101000020E610000072F2C7597D6C46C06F42C6489B1F34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('d974e715-0d68-414e-a7f1-3257485274b4', 'Do Carmo', '7152fd6e-c5d1-410d-bcfa-96257a80d2fa', '2026-03-01 20:17:39.635135+00', -20.1270232, -44.8688075, '0101000020E610000080828B15356F46C051D5A997842034C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('d980bb14-67ca-4bbf-b9e0-2f8fb0979c22', 'Prolongamento Planalto', '32f58717-8492-4758-ba9e-e775936e8f78', '2026-03-01 20:17:39.635135+00', -20.1456416, -44.9096187, '0101000020E61000003F2AB4626E7446C0E7EF94C4482534C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('deb7c979-136c-47b7-8c8d-78e92ae6d317', 'Jardim Zona Sul', '4cde76ed-250e-485f-8d05-c77e29c9cb01', '2026-03-01 20:17:39.635135+00', -20.1863948, -44.9400926, '0101000020E6100000161B4EF4547846C0FB24D291B72F34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('e00d4975-a99a-43f6-8ed6-e6d958640116', 'Santo André', 'ca01ed34-9647-4d98-b157-9cb350e78235', '2026-03-01 20:17:39.635135+00', -20.1976021, -44.9182058, '0101000020E6100000AFFF84C4877546C0F51E1D0D963234C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('e02cc854-342c-4992-85c1-11d5c7c49457', 'Halim Souki', '7152fd6e-c5d1-410d-bcfa-96257a80d2fa', '2026-03-01 20:17:39.635135+00', -20.1339839, -44.8652885, '0101000020E61000006D8D08C6C16E46C0C7B0D4C44C2234C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('e0bb4ae5-5d51-44c8-8b88-9171ff3f98d7', 'Nossa Senhora da Conceição', 'c551a112-ef94-4265-b42e-40e314887950', '2026-03-01 20:17:39.635135+00', -20.11299, -44.8929689, '0101000020E61000002CEC0ECE4C7246C069C6A2E9EC1C34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('e0e33747-a02d-432d-b72f-e371ba4aeb59', 'Ibirapuera', '8050b9e3-b371-4340-a846-df9d536e505f', '2026-03-01 20:17:39.635135+00', -20.1551, -44.9124, '0101000020E6100000696FF085C97446C00F9C33A2B42734C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('e13363df-4288-4453-a8b4-204d9fdbd07b', 'Prolongamento Jardim dos Candidés', '5ecc6b12-eb98-4331-8717-7387845d5999', '2026-03-01 20:17:39.635135+00', -20.1315074, -44.8382804, '0101000020E61000005C70ABC54C6B46C0972E0E78AA2134C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('e1c4197d-b5b4-4da8-9cdf-bb646af458f2', 'Manoel Valinhas', '3106de99-1c0e-469e-bf07-a37c60410632', '2026-03-01 20:17:39.635135+00', -20.12843, -44.8721963, '0101000020E610000016D1C0D9F76F46C0B00DCB55E22034C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('e2fd5eb5-312a-41d2-9a34-af510916e6e6', 'Vale do Sol', '971aadc1-7707-4cc0-b986-471bbe5ec378', '2026-03-01 20:17:39.635135+00', -20.1604339, -44.8479077, '0101000020E610000067C3503D886C46C074AB3132122934C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('e44f6941-c5c5-47d0-b1ed-ce2ad5aff7c4', 'Vila Concórdia', '1214e817-fc60-4a84-a084-0def6f198ddd', '2026-03-01 20:17:39.635135+00', -20.1383139, -44.8874369, '0101000020E6100000BE614788977146C00C152D8A682334C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('e45aff47-bb39-4eae-8a35-6e7e159058a5', 'Quintino', '4cde76ed-250e-485f-8d05-c77e29c9cb01', '2026-03-01 20:17:39.635135+00', -20.1624167, -44.9300075, '0101000020E610000072C45A7C0A7746C002D30E24942934C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('e5b2897b-1c67-4ffe-b9ee-6280e7a847d2', 'Residencial Morumbi', NULL, '2026-05-12 14:07:00.07182+00', -20.1464377, -44.8341668, '0101000020E610000059B44AFAC56A46C0C666ECF07C2534C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('e6fa6dcf-a532-43b0-8bbe-64eb2eabfd2b', 'Esplanada', '3106de99-1c0e-469e-bf07-a37c60410632', '2026-05-13 11:33:06.98885+00', -20.1523015, -44.8904982, '0101000020E6100000CD1253D8FB7146C0BAA1293BFD2634C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('e72913e0-5795-49eb-b973-c35ab62e0543', 'Prologamento Francisco Machado Filho', '605abb09-9d29-472e-9be5-0edcaf1dd264', '2026-03-01 20:17:39.635135+00', -20.1552018, -44.8872456, '0101000020E61000008CC28943917146C0C4471F4EBB2734C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('e743bc79-252d-40b0-8b12-f50556aa0fc2', 'Jardim Primavera', '8050b9e3-b371-4340-a846-df9d536e505f', '2026-03-01 20:17:39.635135+00', -20.1167646, -44.9674579, '0101000020E6100000E06014A9D57B46C09D54EA48E41D34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('e7ff10d7-b040-4e7f-9b51-350c423e504d', 'Jardim Real', '4cde76ed-250e-485f-8d05-c77e29c9cb01', '2026-03-01 20:17:39.635135+00', -20.1697792, -44.9451776, '0101000020E6100000B5746094FB7846C0828A4FA6762B34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('e9834a42-260a-454b-9ead-054d84b75f59', 'Residencial Walchir Resende', 'ac623dfd-ed4c-47ca-be91-e5e1b0d40a6c', '2026-03-01 20:17:39.635135+00', -20.1283076, -44.9094591, '0101000020E610000059C6E127697446C008D451C4D82034C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('ea2330a9-2aa7-426b-9545-1f85edec34bc', 'Jardim Copacabana', '3106de99-1c0e-469e-bf07-a37c60410632', '2026-03-01 20:17:39.635135+00', -20.2077715, -44.922669, '0101000020E61000003A048E041A7646C0768A5583303534C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('ebace4bc-22e1-4e60-8e8a-0e6ae12dfa3f', 'Jussara', 'ca01ed34-9647-4d98-b157-9cb350e78235', '2026-03-01 20:17:39.635135+00', -20.1833436, -44.9038935, '0101000020E610000093C83EC8B27346C050EE2D9BEF2E34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('ec2a175f-05a9-42c5-bd66-adaabf37deec', 'Xavante', 'ac623dfd-ed4c-47ca-be91-e5e1b0d40a6c', '2026-03-01 20:17:39.635135+00', -20.1213969, -44.9081716, '0101000020E6100000F8938CF73E7446C0F65503DE131F34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('ed63c0d1-88dc-443b-8676-06a62151425b', 'Santa Clara', '1214e817-fc60-4a84-a084-0def6f198ddd', '2026-03-01 20:17:39.635135+00', -20.130064, -44.8844677, '0101000020E610000026EFD23C367146C00F63D2DF4B2134C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('eefe68a3-3eb4-41ca-9a5b-336f893a17d2', 'Residencial Castelo', 'ca01ed34-9647-4d98-b157-9cb350e78235', '2026-03-01 20:17:39.635135+00', -20.1888115, -44.9087215, '0101000020E610000006D671FC507446C0D49B51F3553034C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('ef485299-f220-44fa-95d1-d12bf3b1bd23', 'Chácara Belo Horizonte', '971aadc1-7707-4cc0-b986-471bbe5ec378', '2026-03-01 20:17:39.635135+00', -20.1853387, -44.8070309, '0101000020E6100000442EDDC94C6746C0E32E675B722F34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('ef89a243-9626-4176-a274-4c910882c08d', 'Exposição', '32f58717-8492-4758-ba9e-e775936e8f78', '2026-03-01 20:17:39.635135+00', -20.1910067, -44.9165321, '0101000020E6100000FA9D81EC507546C01FD1A9D0E53034C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('f01fb1a8-546a-407b-8b91-0caeafe2c118', 'Prolongamento Icaraí', '5ecc6b12-eb98-4331-8717-7387845d5999', '2026-03-01 20:17:39.635135+00', -20.1163275, -44.8524314, '0101000020E6100000B08ADC781C6D46C01D2098A3C71D34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('f048cbd4-5e13-475d-990e-f51d16c0bcd4', 'Chácaras Santa Monica', NULL, '2026-05-12 13:57:45.771316+00', -20.0828125, -44.934417, '0101000020E6100000C9E9EBF99A7746C033333333331534C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('f06b50eb-c24c-46dd-9f0c-e528aa7a2ace', 'Nova Fortaleza', 'c551a112-ef94-4265-b42e-40e314887950', '2026-03-01 20:17:39.635135+00', -20.1087838, -44.9075064, '0101000020E61000009274722B297446C0A9554F41D91B34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('f0b45282-d997-4f83-ad3c-8523aba2c510', 'Nossa Senhora de Lourdes', '605abb09-9d29-472e-9be5-0edcaf1dd264', '2026-03-01 20:17:39.635135+00', -20.1706158, -44.8784849, '0101000020E6100000D1C37531727046C04E2E217AAD2B34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('f28ce53a-cf49-483b-9c3b-6ca0f6bd4554', 'Belo Vale', '8050b9e3-b371-4340-a846-df9d536e505f', '2026-03-01 20:17:39.635135+00', -20.1239696, -44.9310911, '0101000020E6100000600C40FE2D7746C0BDB2C178BC1F34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('f33d7ac5-1507-4689-ba53-1be8d5abe1c1', 'Jardim Floramar', '5ecc6b12-eb98-4331-8717-7387845d5999', '2026-03-01 20:17:39.635135+00', -20.1238336, -44.8324502, '0101000020E61000003A4668BA8D6A46C05D250E8FB31F34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('f485013e-3bf6-4f46-97bc-1c1253a0b6ec', 'Jusa Fonseca', 'd03c2fb6-2f32-4110-8807-c9fce2c7fc40', '2026-03-01 20:17:39.635135+00', -20.1707971, -44.8712322, '0101000020E61000006F1C6789846F46C06CC0D65BB92B34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('f579a137-89e5-47eb-a23d-91778e20a0ba', 'Jardim Brasília', 'ac623dfd-ed4c-47ca-be91-e5e1b0d40a6c', '2026-03-01 20:17:39.635135+00', -20.1331214, -44.9126053, '0101000020E610000001D41E40D07446C0D2657B3E142234C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('f5dca6fd-3449-48ab-80fb-7d619ad20d03', 'Nações', 'd03c2fb6-2f32-4110-8807-c9fce2c7fc40', '2026-03-01 20:17:39.635135+00', -20.1575131, -44.8586795, '0101000020E6100000711FB935E96D46C00B314DC7522834C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('f7a24760-381d-44a4-b5a3-590f6c761d0e', 'Fazenda da Usina', '5ecc6b12-eb98-4331-8717-7387845d5999', '2026-03-01 20:17:39.635135+00', -20.1037715, -44.8527357, '0101000020E6100000DAD08371266D46C0C2C1DEC4901A34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('f7d0a95d-f9e2-4d9b-8c01-56a55138e031', 'Residencial Lagoa Park', '971aadc1-7707-4cc0-b986-471bbe5ec378', '2026-03-01 20:17:39.635135+00', -20.1667587, -44.8374364, '0101000020E6100000703DAF1D316B46C0CFD2BAB2B02A34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('f7e802ce-9327-4bea-bea1-f9fd5e0f104a', 'Prolongamento Jardim das Acácias', '4cde76ed-250e-485f-8d05-c77e29c9cb01', '2026-03-01 20:17:39.635135+00', -20.1811863, -44.9247035, '0101000020E6100000957F2DAF5C7646C0B6FBB039622E34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('f836bc3d-e43e-4eca-b6fd-9445d165dae7', 'São Simão', '5ecc6b12-eb98-4331-8717-7387845d5999', '2026-03-01 20:17:39.635135+00', -20.1480895, -44.8421061, '0101000020E61000008DA1F721CA6B46C089618731E92534C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('f95fe2f1-806f-448e-8163-53464d304dec', 'Danilo Passos II', '7152fd6e-c5d1-410d-bcfa-96257a80d2fa', '2026-03-01 20:17:39.635135+00', -20.11773, -44.8726806, '0101000020E6100000456D76FFB36F46C012C2A38D231E34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('fc332943-214e-47bf-9f01-cc0b8e2206d8', 'Buritis', NULL, '2026-05-12 13:52:00.677961+00', -20.25102, -44.873477, '0101000020E610000073672618CE6F46C055A4C2D8424034C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('fe21f7f3-037c-45fe-961d-8d47f9e25f40', 'Condomínio Recanto das Águas', '8050b9e3-b371-4340-a846-df9d536e505f', '2026-03-01 20:17:39.635135+00', -20.1137342, -44.934417, '0101000020E6100000C9E9EBF99A7746C0CD6F3DAF1D1D34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('fee5e067-5292-4ad9-9eaa-4039ecc72469', 'Conjunto Habitacional Oswaldo Machado Gontijo', 'c551a112-ef94-4265-b42e-40e314887950', '2026-03-01 20:17:39.635135+00', -20.1138904786486, -44.9048566818237, '0101000020E610000021B07268917546C027C286A7572A34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('ff124bc4-c482-4786-9521-00e749d0e0c5', 'Santa Martha', 'c551a112-ef94-4265-b42e-40e314887950', '2026-03-01 20:17:39.635135+00', -20.1104248142933, -44.8828625679016, '0101000020E610000036AB3E575B7146C0D734EF38452734C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
INSERT INTO bairros (id, nome, area_id, created_at, latitude, longitude, geolocalizacao)
VALUES ('ff4bef7f-7419-4ed4-9368-6b1c159bf2e6', 'Jardim das Acácias', '4cde76ed-250e-485f-8d05-c77e29c9cb01', '2026-03-01 20:17:39.635135+00', -20.178802, -44.9260164, '0101000020E6100000A3C794B4877646C09B75C6F7C52D34C0'::geometry)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    area_id = EXCLUDED.area_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geolocalizacao = EXCLUDED.geolocalizacao;
```
