# 🔐 Configuração de Permissões Hierárquicas

Este guia documenta as permissões reais do banco de dados Supabase do SEMAC, consolidando políticas RLS, hierarquia de cargos e tabelas do sistema.

> **Última atualização:** Abril/2026 (sincronizado com os CSVs de políticas do Supabase)

---

## 📋 Resumo da Hierarquia

```
Secretário(a) (nível 4)
 ├── Diretor(a) de Meio Ambiente (nível 3)
 │    ├── Gerente de Posturas (nível 2) → Fiscal (nível 1)
 │    └── Gerente de Regularização Ambiental (nível 2) → Equipe Ambiental (nível 1)
 ├── Diretor(a) do Cuidado Animal (nível 3)
 │    └── Gerente do Cuidado Animal (nível 2)
 │         └── Coordenador(a) do Cuidado Animal (nível 1)
 ├── Gerente de Interface Jurídica (Cargo Especial)
 └── Agente de Administração (Cargo Especial)

Permissões de exclusão:
Secretário(a) → pode excluir: Diretor, Gerente, Fiscal, Equipe Ambiental
Diretor(a) → pode excluir: Gerente, Fiscal, Equipe Ambiental
Gerente → pode excluir: Fiscal, Equipe Ambiental
```

---

## 🚀 Opção 1: SQL Simples (Legado)

Execute no SQL Editor do Supabase:

1. Acesse seu projeto no Supabase Dashboard
2. Vá em "SQL Editor"
3. Cole o conteúdo do arquivo
4. Clique em "Run"

Isso vai:
- ✅ Habilitar exclusão na tabela `profiles` para Gerente+
- ✅ Criar função de "soft delete" (desativar usuário)
- ✅ Adicionar colunas para controle de ativação

---

## 🔧 Opção 2: Edge Function (Exclusão Completa)

Para deletar completamente o usuário do sistema (incluindo auth.users):

### Passo 1: Instalar Supabase CLI
```bash
npm install -g supabase
```

### Passo 2: Login e Link
```bash
supabase login
supabase link --project-ref seu-project-ref-aqui
```

### Passo 3: Criar a Edge Function
```bash
supabase functions new delete-user
```

### Passo 4: Criar o arquivo da função

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

## 🔐 Opção 3: Permissões Especiais do Secretário e Desenvolvedores

Para permitir que **Secretários** e **Desenvolvedores** possam **criar e excluir qualquer usuário** no sistema:

### Executar o SQL

Execute o arquivo `setup_permissoes_secretario.sql` no SQL Editor do Supabase:

```sql
-- 1. Isso cria funções para verificar se é Secretário ou Dev
-- 2. Adiciona políticas RLS para DELETE/UPDATE em qualquer perfil
-- 3. Cria funções seguras para criar/desativar/excluir usuários
-- 4. Adiciona colunas 'ativo' e 'data_desativacao' na tabela profiles
```

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

Execute este bloco no SQL Editor do Supabase para recriar/atualizar as tabelas e políticas de segurança do módulo de Tarefas:

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
