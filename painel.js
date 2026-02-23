
// painel.js
// Usa o supabaseClient já criado pelo protecao.js


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
            const fotoPreview = document.getElementById('perfil-foto-preview');
            if (fotoPreview) fotoPreview.src = perfil.avatar_url;
        }

        // Preencher inputs na aba Configurações
        const inputNome = document.getElementById('perfil-nome');
        if (inputNome) inputNome.value = perfil.full_name || '';

        const inputCpf = document.getElementById('perfil-cpf');
        if (inputCpf) inputCpf.value = perfil.cpf || '';

        const inputCargo = document.getElementById('perfil-cargo');
        if (inputCargo) inputCargo.value = (perfil.role || '').toUpperCase();

        // Libera visão Admin
        if (perfil.role.toLowerCase() === 'admin') {
            document.getElementById('admin-options').style.display = 'block';
            document.getElementById('card-admin-stats').style.display = 'block';
        }

        // Libera visão Fiscal (Produtividade + Histórico + Home Stats)
        if (perfil.role.toLowerCase() === 'fiscal') {
            document.getElementById('fiscal-options').style.display = 'block';
            document.getElementById('home-produtividade-container').style.display = 'block';
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
    // Marca o botão como ativo
    event.currentTarget.classList.add('active');

    // Se abriu Histórico Geral, carregar dados da sub-aba ativa
    if (idAba === 'historico-geral' && typeof mudarSubAbaCP === 'function') {
        const btnAtiva = document.querySelector('.sub-aba-btn.active');
        mudarSubAbaCP(subAbaAtual || '1.1', btnAtiva);
    }
}

// Inicializa
carregarDadosIniciais();

// --- RAMINHOS DECORATIVOS NO FUNDO ---
function gerarRaminhos() {
    const main = document.querySelector('.main-content');
    if (!main) return;

    main.querySelectorAll('.raminho-bg').forEach(el => el.remove());

    const largura = main.scrollWidth;
    const altura = main.scrollHeight;

    // Grade com células de ~280px, raminho posicionado aleatoriamente dentro de cada célula
    const celula = 280;
    const colunas = Math.ceil(largura / celula);
    const linhas = Math.ceil(altura / celula);

    for (let col = 0; col < colunas; col++) {
        for (let lin = 0; lin < linhas; lin++) {
            const tamanho = 124 + Math.random() * 147;

            // Posição base da célula + variação aleatória dentro dela
            const x = col * celula + Math.random() * (celula - tamanho * 0.5);
            const y = lin * celula + Math.random() * (celula - tamanho * 0.5);

            const img = document.createElement('img');
            img.src = 'raminho.png';
            img.className = 'raminho-bg';
            img.style.width = tamanho + 'px';
            img.style.left = x + 'px';
            img.style.top = y + 'px';
            img.style.transform = `rotate(${Math.random() * 360}deg)`;
            main.appendChild(img);
        }
    }
}

// Gerar após carregar e ao redimensionar
window.addEventListener('load', () => setTimeout(gerarRaminhos, 300));
window.addEventListener('resize', gerarRaminhos);

// --- UPLOAD DE AVATAR ---
async function uploadAvatarLocal(event) {
    try {
        const file = event.target.files[0];
        if (!file) return;

        const statusMsg = document.getElementById('upload-status');
        if (statusMsg) {
            statusMsg.textContent = "Fazendo upload... Aguarde.";
            statusMsg.style.color = "#eab308"; // Amarelo
        }

        // Pega user ativo
        const { data: { user }, error: authErr } = await supabaseClient.auth.getUser();
        if (authErr || !user) throw new Error("Usuário não autenticado.");

        // Definir caminho seguro: pastadousuario/timestamp_nome_original
        const extensao = file.name.split('.').pop();
        const filePath = `${user.id}/${Date.now()}_avatar.${extensao}`;

        // Subir p/ Storage
        const { data, error: uploadErr } = await supabaseClient
            .storage
            .from('avatars')
            .upload(filePath, file, { upsert: true });

        if (uploadErr) throw uploadErr;

        // Pegar URL Pública
        const { data: publicUrlData } = supabaseClient
            .storage
            .from('avatars')
            .getPublicUrl(filePath);

        const urlAvatar = publicUrlData.publicUrl;

        // Atualizar URL na tabela profiles
        const { error: updateErr } = await supabaseClient
            .from('profiles')
            .update({ avatar_url: urlAvatar })
            .eq('id', user.id);

        if (updateErr) throw updateErr;

        // Sucesso — Atualiza interface
        const fotoSide = document.getElementById('user-photo');
        const fotoPrev = document.getElementById('perfil-foto-preview');

        if (fotoSide) fotoSide.src = urlAvatar;
        if (fotoPrev) fotoPrev.src = urlAvatar;

        if (statusMsg) {
            statusMsg.textContent = "Foto atualizada com sucesso!";
            statusMsg.style.color = "#22c55e"; // Verde
            setTimeout(() => statusMsg.textContent = "", 4000);
        }

    } catch (err) {
        console.error("Erro no upload do avatar:", err);
        const statusMsg = document.getElementById('upload-status');
        if (statusMsg) {
            statusMsg.textContent = "Falha ao enviar arquivo.";
            statusMsg.style.color = "#ef4444"; // Vermelho
        }
        alert("Erro ao enviar imagem. Verifique se escolheu um arquivo válido.");
    }
}

// Abre o modal de redefinição de senha
function mostrarFormSenha() {
    const modal = document.getElementById('modal-senha');
    if (modal) {
        modal.style.display = 'flex';
        // Limpa os campos toda vez que abrir
        document.getElementById('senha-antiga').value = '';
        document.getElementById('nova-senha').value = '';
        document.getElementById('confirmar-senha').value = '';
        document.getElementById('msg-senha').textContent = '';
    }
}

// Fecha o modal de redefinição de senha
function fecharModalSenha() {
    const modal = document.getElementById('modal-senha');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('msg-senha').textContent = '';
    }
}

// --- REDEFINIR SENHA NA CONFIGURAÇÃO ---
async function alterarSenha() {
    const senhaAntiga = document.getElementById('senha-antiga').value;
    const novaSenha = document.getElementById('nova-senha').value;
    const confirmarSenha = document.getElementById('confirmar-senha').value;
    const msgSenha = document.getElementById('msg-senha');

    if (!senhaAntiga || !novaSenha || !confirmarSenha) {
        msgSenha.textContent = "Por favor, preencha todos os campos corretamente.";
        msgSenha.style.color = "#ef4444"; // Vermelho
        return;
    }

    if (novaSenha !== confirmarSenha) {
        msgSenha.textContent = "As senhas não coincidem. Digite novamente!";
        msgSenha.style.color = "#ef4444"; // Vermelho
        return;
    }

    if (novaSenha.length < 6) {
        msgSenha.textContent = "A nova senha deve ter no mínimo 6 caracteres.";
        msgSenha.style.color = "#eab308"; // Amarelo
        return;
    }

    msgSenha.textContent = "Autenticando e verificando credenciais...";
    msgSenha.style.color = "#64748b"; // Cinza

    try {
        // 1. Pegar info básica do usuário conectado
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user || !user.email) throw new Error("Erro de sessão, saia e faça login novamente.");

        // 2. Realizar login oculto para PROVAR que a pessoa sabe a senha atual
        const { error: signInErr } = await supabaseClient.auth.signInWithPassword({
            email: user.email,
            password: senhaAntiga
        });

        // 3. Rejeitar se for diferente
        if (signInErr) {
            throw new Error("A senha antiga está incorreta. Tente novamente.");
        }

        // 4. Se a credencial for idêntica, aprovar a nova senha!
        msgSenha.textContent = "Senha validada! Trocando sua senha...";

        const { error: updateErr } = await supabaseClient.auth.updateUser({
            password: novaSenha
        });

        if (updateErr) throw new Error("Ocorreu um erro no servidor ao trocar.");

        // 5. Limpar os inputs e comemorar
        document.getElementById('senha-antiga').value = "";
        document.getElementById('nova-senha').value = "";
        document.getElementById('confirmar-senha').value = "";

        msgSenha.textContent = "Senha alterada com sucesso! 🛡️";
        msgSenha.style.color = "#22c55e"; // Verde

        // Fechar a telinha modal de senha após 2 segundos
        setTimeout(() => {
            fecharModalSenha();
        }, 2000);

    } catch (err) {
        msgSenha.textContent = err.message;
        msgSenha.style.color = "#ef4444";
    }
}
