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

<div class="dashboard-container">
    <aside class="sidebar">
        <div class="profile-info">
            <div class="avatar">👤</div>
            <p id="user-cpf">Carregando...</p>
            <span id="user-role" class="badge">Cargo</span>
        </div>
        
        <nav class="menu">
            <a href="#" class="active">🏠 Início</a>
            <a href="#">📋 Minhas Tarefas</a>
            
            <div id="menu-admin" style="display: none;">
                <hr>
                <p class="menu-label">ADMINISTRAÇÃO</p>
                <a href="#">👥 Gerenciar Usuários</a>
                <a href="#">📊 Relatórios Gerais</a>
            </div>
        </nav>

        <button onclick="sair()" class="btn-logout">Sair do Sistema</button>
    </aside>

    <main class="main-content">
        <header>
            <h2 id="saudacao">Bem-vindo</h2>
        </header>

        <section class="cards-grid">
            <div class="card">
                <h3>Resumo de Tarefas</h3>
                <p>Você tem 3 tarefas pendentes.</p>
            </div>

            <div id="card-admin" class="card admin-style" style="display: none;">
                <h3>Status do Sistema</h3>
                <p>Todos os módulos estão online.</p>
                <button class="btn-action">Gerenciar Notificações</button>
            </div>
        </section>
    </main>
</div>

// Executa a verificação imediatamente
verificarAcesso();
