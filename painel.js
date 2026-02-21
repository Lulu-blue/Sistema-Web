
const supabaseUrl = 'https://marmpnusgmbjphffaynr.supabase.co';
const supabaseKey = 'sb_publishable_ZVtndwPOvY2dA4Qzlwkl2A_H0-TeUgu';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);


// painel.js

async function sair() {
    console.log("Botão sair clicado!"); // Para você ver no F12 se ele responde
    
    try {
        // Use o nome exato da variável que você usou para conectar ao Supabase
        const { error } = await supabaseClient.auth.signOut();

        if (error) throw error;

        console.log("Deslogado com sucesso");
        window.location.replace("index.html"); // Volta para o login
    } catch (error) {
        console.error("Erro ao sair:", error.message);
        alert("Erro ao encerrar a sessão.");
    }
}
// 1. Defina a conexão novamente (necessário em cada arquivo novo)

async function carregarDadosIniciais() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const { data: perfil } = await supabaseClient
        .from('profiles')
        .select('full_name, role, cpf, avatar_url')
        .eq('id', user.id)
        .single();

    if (perfil) {
        // Preenche o Perfil
        document.getElementById('user-name').innerText = perfil.full_name || "Usuário";
        document.getElementById('user-role-display').innerText = perfil.role;
        
        if (perfil.avatar_url) {
            document.getElementById('user-photo').src = perfil.avatar_url;
        }

        // Libera visão Admin
        if (perfil.role.toLowerCase() === 'admin') {
            document.getElementById('admin-options').style.display = 'block';
            document.getElementById('card-admin-stats').style.display = 'block';
        }
    }
}

// Função para trocar de abas (Visualização)
function mudarAba(idAba) {
    // Esconde todas as seções
    document.querySelectorAll('.content-section').forEach(s => s.style.display = 'none');
    // Remove classe ativa dos botões
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    // Mostra a aba clicada
    document.getElementById('aba-' + idAba).style.display = 'block';
    // Marca o botão como ativo (exemplo simples)
    event.currentTarget.classList.add('active');
}

// Inicializa
carregarDadosIniciais();
