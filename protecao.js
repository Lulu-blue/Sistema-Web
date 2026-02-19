// Substitua pelas suas chaves (as mesmas do script.js)
const supabaseUrl = 'https://marmpnusgmbjphffaynr.supabase.co';
const supabaseKey = 'sb_publishable_ZVtndwPOvY2dA4Qzlwkl2A_H0-TeUgu';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

async function verificarAcesso() {
    // Busca a sessão atual do usuário
    const { data: { session } } = await _supabase.auth.getSession();

    // Se não houver sessão, o usuário não está logado
    if (!session) {
        alert("Acesso restrito! Identifique-se primeiro.");
        window.location.href = "index.html"; // Manda de volta pro login
    }
}

// Executa a verificação imediatamente
verificarAcesso();