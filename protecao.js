// =============================================
// PROTEÇÃO DE ROTA + CONEXÃO SUPABASE CENTRAL
// =============================================
// Este arquivo é carregado PRIMEIRO no painel.
// Cria a conexão e verifica se o usuário está logado.

const supabaseUrl = 'https://marmpnusgmbjphffaynr.supabase.co';
const supabaseKey = 'sb_publishable_ZVtndwPOvY2dA4Qzlwkl2A_H0-TeUgu';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

async function verificarAcesso() {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        alert("Acesso restrito! Identifique-se primeiro.");
        window.location.href = "index.html";
    }
}

// Executa a verificação imediatamente
verificarAcesso();
