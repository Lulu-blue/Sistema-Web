# 🔐 Configuração de Permissões Hierárquicas

Este guia explica como configurar as permissões para que Gerentes, Diretores e Secretários possam excluir funcionários.

## 📋 Resumo da Hierarquia

```
Secretário(a) → pode excluir: Diretor, Gerente, Fiscal
Diretor(a) → pode excluir: Gerente, Fiscal
Gerente → pode excluir: Fiscal
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
