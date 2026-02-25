// Adicione isso no topo do seu HTML ou via CDN no JS
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js"></script>

const supabaseUrl = 'https://marmpnusgmbjphffaynr.supabase.co';
const supabaseKey = 'sb_publishable_ZVtndwPOvY2dA4Qzlwkl2A_H0-TeUgu';

const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// Máscara de CPF: 000.000.000-00
const cpfInput = document.getElementById('cpf');
cpfInput.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
    else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
    else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, '$1.$2');
    e.target.value = v;
});

const form = document.getElementById('loginForm');

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Carregando...';
    submitBtn.disabled = true;

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
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
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
            window.location.href = "painel.html";
        }
    }
});

