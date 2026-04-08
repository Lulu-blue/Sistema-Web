# 🔐 Configuração de Permissões Hierárquicas

Este guia explica como configurar as permissões para que Gerentes, Diretores e Secretários possam excluir funcionários.

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

Permissões de Gestão de Bairros e Áreas:
Secretário(a), Diretor(a) e Gerente podem gerenciar (criar, editar e excluir) bairros e áreas.
(Requer aplicação do script SQL de RLS para Direção e Secretaria).
```

## 🚀 Opção 1: SQL Simples (Recomendado para começar)

Execute o arquivo `setup_permissoes_simples.sql` no SQL Editor do Supabase:

1. Acesse seu projeto no Supabase Dashboard
2. Vá em "SQL Editor"
3. Cole o conteúdo do arquivo
4. Clique em "Run"

Isso vai:
- ✅ Habilitar exclusão na tabela `profiles` para Gerente+
- ✅ Criar função de "soft delete" (desativar usuário)
- ✅ Adicionar colunas para controle de ativação

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

## ✅ Testando

1. Faça login como Gerente
2. Clique no ícone de lixeira ao lado de um Fiscal
3. Digite seu CPF, senha e "EXCLUIR"
4. O usuário deve ser removido completamente

## 📝 Logs de Exclusão

Para manter um registro de quem excluiu quem, use a tabela `log_exclusoes` do primeiro SQL:

```sql
SELECT * FROM public.log_exclusoes ORDER BY excluido_em DESC;
```

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

## 🔒 Segurança

⚠️ **IMPORTANTE:**
- Nunca exponha a `service_role_key` no frontend
- Sempre use Edge Functions para operações administrativas
- Mantenha logs de todas as exclusões
- Considere implementar um sistema de aprovação para exclusões

---

## 🏗️ Anexo A: Configuração de Novo Cargo - Secretário(a) do Secretário(a)
*Consolidado do arquivo setup_secretario_do_secretario.sql*

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

## 🛡️ Anexo B: Resumo Definitivo de Políticas RLS do Controle Processual
*Consolidação dos arquivos fix_rls_definitivo.sql e controle_processual.sql*

Para corrigir problemas com `UUIDs` ou bloqueios no `INSERT` da tabela `controle_processual`, os seguintes scripts foram criados para garantir que todo usuário possa inserir o seu próprio registro e gerenciar seus anexos no storage (`anexos`):

```sql
-- Políticas Tabela (Controle Processual)
DROP POLICY IF EXISTS "Permitir insert para o proprio usuario" ON public.controle_processual;
CREATE POLICY "Permitir insert para o proprio usuario" ON public.controle_processual FOR INSERT TO authenticated WITH CHECK (user_id::uuid = auth.uid()::uuid);

CREATE POLICY "Permitir update para o proprio usuario" ON public.controle_processual FOR UPDATE TO authenticated USING (user_id::uuid = auth.uid()::uuid) WITH CHECK (user_id::uuid = auth.uid()::uuid);

CREATE POLICY "Fiscal deleta próprios registros CP" ON public.controle_processual FOR DELETE TO authenticated USING (user_id::uuid = auth.uid()::uuid);

-- Políticas Storage (Anexos AR)
DROP POLICY IF EXISTS "Permitir upload no bucket anexos para todos" ON storage.objects;
CREATE POLICY "Permitir upload no bucket anexos para todos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'anexos');

DROP POLICY IF EXISTS "Permitir update no bucket anexos para todos" ON storage.objects;
CREATE POLICY "Permitir update no bucket anexos para todos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'anexos');
```

## 🗃️ Anexo C: Tabela de Regras Supabase Resumidas
*Consolidado de planilhas CSV*
| Política | Comando | Restrição Principal |
|---|---|---|
| Todos veem registros CP | SELECT | N/A (Permissivo para `public`) |
| Gerencia pode ver todos os registros CP | SELECT | `get_nivel_hierarquico() >= 1` ou dono do log |
| Permitir update para o proprio usuario | UPDATE | `user_id = auth.uid()` |
| Gerentes podem deletar CP | DELETE | Função de Perfil = `Gerente de Posturas` |
| Admin_Update_Processual_Completa | UPDATE | Perfis `admin` ou `administrador` |
| Bairros e Áreas (Direção/Secretaria) | ALL | Ver Anexo D |

---

## 🗺️ Anexo D: Permissões de Bairros e Áreas (Direção e Secretaria)
*Adicionado em Abril/2026*

Para habilitar que Diretores e Secretários gerenciem as tabelas de bairros e áreas, execute o script abaixo:

```sql
-- Atualiza permissões de Bairros e Áreas para cargos graduados
DROP POLICY IF EXISTS "Gerencia altera bairros" ON public.bairros;
CREATE POLICY "Gerencia altera bairros" ON public.bairros FOR ALL TO authenticated
USING (auth.uid() IN (SELECT id FROM profiles WHERE role = ANY (ARRAY['gerente fiscal','gerente','Gerente de Posturas','admin','Diretor(a) de Meio Ambiente','Secretário(a)','Secretário(a) do Secretário(a)'])));

DROP POLICY IF EXISTS "Gerencia altera areas" ON public.areas;
CREATE POLICY "Gerencia altera areas" ON public.areas FOR ALL TO authenticated
USING (auth.uid() IN (SELECT id FROM profiles WHERE role = ANY (ARRAY['gerente fiscal','gerente','Gerente de Posturas','admin','Diretor(a) de Meio Ambiente','Secretário(a)','Secretário(a) do Secretário(a)'])));
```
