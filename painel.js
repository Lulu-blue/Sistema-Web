// painel.js
// Usa o supabaseClient ja criado pelo protecao.js

async function sair() {
    console.log("Botao sair clicado!");
    try {
        var resultado = await supabaseClient.auth.signOut();
        if (resultado.error) throw resultado.error;
        console.log("Deslogado com sucesso");
        window.location.replace("index.html");
    } catch (error) {
        console.error("Erro ao sair:", error.message);
        alert("Erro ao encerrar a sessao.");
    }
}

async function carregarDadosIniciais() {
    try {
        var authResult = await supabaseClient.auth.getUser();
        var user = authResult.data.user;
        if (!user) return;

        var resultado = await supabaseClient
            .from('profiles')
            .select('full_name, role, cpf, avatar_url, matricula')
            .eq('id', user.id)
            .single();

        var perfil = resultado.data;
        var erro = resultado.error;

        if (erro) {
            console.error("Erro na busca de perfil: ", erro);
            return;
        }

        if (perfil) {
            document.getElementById('user-name').innerText = perfil.full_name || "Usuario";
            document.getElementById('user-role-display').innerText = perfil.role || "Cargo";
            document.getElementById('user-matricula').innerText = "Matricula: " + (perfil.matricula || '---');

            if (perfil.avatar_url) {
                document.getElementById('user-photo').src = perfil.avatar_url;
                var fotoPreview = document.getElementById('perfil-foto-preview');
                if (fotoPreview) fotoPreview.src = perfil.avatar_url;
            }

            var inputNome = document.getElementById('perfil-nome');
            if (inputNome) inputNome.value = perfil.full_name || '';

            var inputCpf = document.getElementById('perfil-cpf');
            if (inputCpf) inputCpf.value = perfil.cpf || '';

            var inputMatricula = document.getElementById('perfil-matricula');
            if (inputMatricula) inputMatricula.value = perfil.matricula || '';

            var inputCargo = document.getElementById('perfil-cargo');
            if (inputCargo) inputCargo.value = (perfil.role || '').toUpperCase();

            var userRole = (perfil.role || '').toLowerCase();
            window.userRoleGlobal = userRole;

            if (userRole === 'admin') {
                document.getElementById('admin-options').style.display = 'block';
                var cardAdmin = document.getElementById('card-admin-stats');
                if (cardAdmin) cardAdmin.style.display = 'block';
            }

            if (userRole === 'gerente fiscal' || userRole === 'gerente' || userRole === 'admin') {
                // Exibe as opcoes de gerencia na sidebar
                var gOpts = document.getElementById('gerente-options');
                if (gOpts) gOpts.style.display = 'block';

                // Gerente ve apenas Historico Geral (sem Produtividade e Historico pessoal)
                var ghg = document.getElementById('gerente-historico-geral');
                if (ghg) ghg.style.display = 'block';
                // Mostra grafico de fiscais na Home
                var hgc = document.getElementById('home-gerente-container');
                if (hgc) hgc.style.display = 'block';
                // Mostra botões de criar evento/tarefa
                var btnEvento = document.getElementById('btn-novo-evento');
                if (btnEvento) btnEvento.style.display = 'inline-block';
                var btnTarefa = document.getElementById('btn-nova-tarefa');
                if (btnTarefa) btnTarefa.style.display = 'inline-block';
                // Carrega dados do grafico
                if (typeof carregarGraficoFiscais === 'function') carregarGraficoFiscais();
            }

            if (userRole === 'fiscal') {
                var fOpts2 = document.getElementById('fiscal-options');
                if (fOpts2) fOpts2.style.display = 'block';
                var hc = document.getElementById('home-produtividade-container');
                if (hc) hc.style.display = 'block';
            }
        }
    } catch (erroGeral) {
        console.error("Erro Critico no carregamento inicial:", erroGeral);
        document.getElementById('user-name').innerText = "Falha no DB";
    }
}

function mudarAba(idAba) {
    document.querySelectorAll('.content-section').forEach(function (s) { s.style.display = 'none'; });
    document.querySelectorAll('.nav-btn').forEach(function (b) { b.classList.remove('active'); });

    var abaEl = document.getElementById('aba-' + idAba);
    if (abaEl) abaEl.style.display = 'block';

    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }

    if (idAba === 'historico-geral' && typeof mudarSubAbaCP === 'function') {
        var btnAtiva = document.querySelector('.sub-aba-btn.active');
        mudarSubAbaCP(subAbaAtual || '1.1', btnAtiva);
    }

    if (idAba === 'bairros') {
        if (typeof carregarGraficoBairros === 'function') carregarGraficoBairros();
        if (typeof carregarGestaoBairrosAreas === 'function') carregarGestaoBairrosAreas();
    }

    if (idAba === 'tarefas') {
        if (typeof carregarModuloTarefas === 'function') carregarModuloTarefas();
    }
}

// Inicializa
carregarDadosIniciais();

// Carregar minhas tarefas na Home (aguarda tarefas.js carregar)
window.addEventListener('load', function () {
    if (typeof carregarMinhasTarefasHome === 'function') carregarMinhasTarefasHome();
});

// --- RAMINHOS DECORATIVOS NO FUNDO ---
function gerarRaminhos() {
    var main = document.querySelector('.main-content');
    if (!main) return;

    main.querySelectorAll('.raminho-bg').forEach(function (el) { el.remove(); });

    var largura = main.clientWidth;
    var altura = main.clientHeight;
    main.style.overflowX = 'hidden';
    var celula = 280;
    var colunas = Math.ceil(largura / celula);
    var linhas = Math.ceil(altura / celula);

    for (var col = 0; col < colunas; col++) {
        for (var lin = 0; lin < linhas; lin++) {
            var tamanho = 124 + Math.random() * 147;
            var x = col * celula + Math.random() * (celula - tamanho * 0.5);
            var y = lin * celula + Math.random() * (celula - tamanho * 0.5);

            var img = document.createElement('img');
            img.src = 'raminho.png';
            img.className = 'raminho-bg';
            img.style.width = tamanho + 'px';
            img.style.left = x + 'px';
            img.style.top = y + 'px';
            img.style.transform = 'rotate(' + (Math.random() * 360) + 'deg)';
            main.appendChild(img);
        }
    }
}

window.addEventListener('load', function () { setTimeout(gerarRaminhos, 300); });

// --- UPLOAD DE AVATAR ---
async function uploadAvatarLocal(event) {
    try {
        var file = event.target.files[0];
        if (!file) return;

        var statusMsg = document.getElementById('upload-status');
        if (statusMsg) {
            statusMsg.textContent = "Fazendo upload... Aguarde.";
            statusMsg.style.color = "#eab308";
        }

        var authResult = await supabaseClient.auth.getUser();
        var user = authResult.data.user;
        var authErr = authResult.error;
        if (authErr || !user) throw new Error("Usuario nao autenticado.");

        var extensao = file.name.split('.').pop();
        var filePath = user.id + '/' + Date.now() + '_avatar.' + extensao;

        var uploadResult = await supabaseClient
            .storage
            .from('avatars')
            .upload(filePath, file, { upsert: true });

        if (uploadResult.error) throw uploadResult.error;

        var publicUrlData = supabaseClient
            .storage
            .from('avatars')
            .getPublicUrl(filePath);

        var urlAvatar = publicUrlData.data.publicUrl;

        var updateResult = await supabaseClient
            .from('profiles')
            .update({ avatar_url: urlAvatar })
            .eq('id', user.id);

        if (updateResult.error) throw updateResult.error;

        var fotoSide = document.getElementById('user-photo');
        var fotoPrev = document.getElementById('perfil-foto-preview');

        if (fotoSide) fotoSide.src = urlAvatar;
        if (fotoPrev) fotoPrev.src = urlAvatar;

        if (statusMsg) {
            statusMsg.textContent = "Foto atualizada com sucesso!";
            statusMsg.style.color = "#22c55e";
            setTimeout(function () { statusMsg.textContent = ""; }, 4000);
        }

    } catch (err) {
        console.error("Erro no upload do avatar:", err);
        var statusMsg2 = document.getElementById('upload-status');
        if (statusMsg2) {
            statusMsg2.textContent = "Falha ao enviar arquivo.";
            statusMsg2.style.color = "#ef4444";
        }
        alert("Erro ao enviar imagem. Verifique se escolheu um arquivo valido.");
    } finally {
        if (event.target) event.target.disabled = false;
    }
}

function mostrarFormSenha() {
    var modal = document.getElementById('modal-senha');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('senha-antiga').value = '';
        document.getElementById('nova-senha').value = '';
        document.getElementById('confirmar-senha').value = '';
        document.getElementById('msg-senha').textContent = '';
    }
}

function fecharModalSenha() {
    var modal = document.getElementById('modal-senha');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('msg-senha').textContent = '';
    }
}

async function alterarSenha() {
    var senhaAntiga = document.getElementById('senha-antiga').value;
    var novaSenha = document.getElementById('nova-senha').value;
    var confirmarSenha = document.getElementById('confirmar-senha').value;
    var msgSenha = document.getElementById('msg-senha');

    if (!senhaAntiga || !novaSenha || !confirmarSenha) {
        msgSenha.textContent = "Por favor, preencha todos os campos corretamente.";
        msgSenha.style.color = "#ef4444";
        return;
    }

    if (novaSenha !== confirmarSenha) {
        msgSenha.textContent = "As senhas nao coincidem. Digite novamente!";
        msgSenha.style.color = "#ef4444";
        return;
    }

    if (novaSenha.length < 6) {
        msgSenha.textContent = "A nova senha deve ter no minimo 6 caracteres.";
        msgSenha.style.color = "#eab308";
        return;
    }

    var btnSalvar = document.querySelector('#modal-senha .btn-salvar');
    var oldTexto = btnSalvar ? btnSalvar.textContent : 'Alterar Senha';

    if (btnSalvar) {
        btnSalvar.textContent = "Carregando...";
        btnSalvar.disabled = true;
    }

    msgSenha.textContent = "Autenticando e verificando credenciais...";
    msgSenha.style.color = "#64748b";

    try {
        var authResult = await supabaseClient.auth.getUser();
        var user = authResult.data.user;
        if (!user || !user.email) throw new Error("Erro de sessao, saia e faca login novamente.");

        var signInResult = await supabaseClient.auth.signInWithPassword({
            email: user.email,
            password: senhaAntiga
        });

        if (signInResult.error) {
            throw new Error("A senha antiga esta incorreta. Tente novamente.");
        }

        msgSenha.textContent = "Senha validada! Trocando sua senha...";

        var updateResult = await supabaseClient.auth.updateUser({
            password: novaSenha
        });

        if (updateResult.error) throw new Error("Ocorreu um erro no servidor ao trocar.");

        document.getElementById('senha-antiga').value = "";
        document.getElementById('nova-senha').value = "";
        document.getElementById('confirmar-senha').value = "";

        msgSenha.textContent = "Senha alterada com sucesso!";
        msgSenha.style.color = "#22c55e";

        setTimeout(function () {
            fecharModalSenha();
        }, 2000);

    } catch (err) {
        msgSenha.textContent = err.message;
        msgSenha.style.color = "#ef4444";
    } finally {
        if (btnSalvar) {
            btnSalvar.textContent = oldTexto;
            btnSalvar.disabled = false;
        }
    }
}
