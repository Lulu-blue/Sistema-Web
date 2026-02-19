// Adicione isso no topo do seu HTML ou via CDN no JS
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js"></script>

const supabaseUrl = 'https://marmpnusgmbjphffaynr.supabase.co';
const supabaseKey = 'sb_publishable_ZVtndwPOvY2dA4Qzlwkl2A_H0-TeUgu';

const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

const form = document.getElementById('loginForm');

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // 1. Pega o CPF e limpa pontos e traços (deixa só números)
    let cpfLimpo = document.getElementById('cpf').value.replace(/\D/g, '');
    const password = document.getElementById('password').value;

    // 2. Transforma o CPF em um "e-mail fictício" para o Supabase aceitar
    const emailFicticio = `${cpfLimpo}@email.com`;

    // 3. Tenta o login
    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: emailFicticio, // Enviamos o CPF mascarado de e-mail
        password: password,
    });

    if (error) {
        alert("Erro no login: CPF ou senha incorretos.");
    } else {
        // Busca o cargo na tabela profiles usando o ID do usuário logado
        const { data: perfil } = await supabaseClient
            .from('profiles')
            .select('role, cpf')
            .eq('id', data.user.id)
            .single();

        if (perfil) {
            alert(`Logado! CPF: ${perfil.cpf} | Cargo: ${perfil.role}`);
            // Redirecionamento baseado no cargo
            window.location.href = perfil.role === 'admin' ? "painel.html" : "usuario.html";
        }
    }
});

