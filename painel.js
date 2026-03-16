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

// Helper global para buscar o usuário de forma segura evitando erros de Lock do Supabase
async function getAuthUser() {
    if (!window.authUserPromise) {
        window.authUserPromise = supabaseClient.auth.getUser();
    }
    try {
        const res = await window.authUserPromise;
        if (res.error) window.authUserPromise = null; 
        return res;
    } catch (err) {
        window.authUserPromise = null;
        throw err;
    }
}
window.getAuthUser = getAuthUser;

async function carregarDadosIniciais() {
    // Verificar se há limpeza agendada
    verificarLimpezaAgendada();

    try {
        var authResult = await getAuthUser();
        var user = authResult.data.user;
        if (!user) return;

        var resultado = await supabaseClient
            .from('profiles')
            .select('full_name, role, cpf, avatar_url, matricula, email_real')
            .eq('id', user.id)
            .single();

        var perfil = resultado.data;
        var erro = resultado.error;

        if (erro) {
            if (erro.code === 'PGRST106' || (erro.status === 400 && erro.message.includes('email_real'))) {
                console.error("Erro: Colunas email_real/email_verificado não encontradas. Rode o SQL de atualização!");
                Swal.fire('Banco Desatualizado', 'As colunas de e-mail não foram encontradas no banco de dados. Por favor, execute o SQL de atualização no Dashboard.', 'warning');
            } else {
                console.error("Erro na busca de perfil: ", erro);
            }
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

            var inputEmail = document.getElementById('perfil-email');
            if (inputEmail) inputEmail.value = perfil.email_real || '';

            var inputCargo = document.getElementById('perfil-cargo');
            if (inputCargo) inputCargo.value = (perfil.role || '').toUpperCase();

            var userRole = (perfil.role || '').toLowerCase();
            window.userRoleGlobal = userRole;

            if (userRole === 'admin') {
                document.getElementById('admin-options').style.display = 'block';
                var cardAdmin = document.getElementById('card-admin-stats');
                if (cardAdmin) cardAdmin.style.display = 'block';
            }

            if (userRole === 'gerente fiscal' || userRole === 'gerente de posturas') {
                // Exibe as opcoes de gerencia na sidebar
                var gOpts = document.getElementById('gerente-options');
                if (gOpts) gOpts.style.display = 'block';

                if (userRole === 'gerente de posturas') {
                    var pOpts = document.getElementById('gerente-posturas-options');
                    if (pOpts) pOpts.style.display = 'block';
                }

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

            if (userRole === 'fiscal' || userRole === 'fiscal de posturas') {
                var fOpts2 = document.getElementById('fiscal-options');
                if (fOpts2) fOpts2.style.display = 'block';
                var hc = document.getElementById('home-produtividade-container');
                if (hc) hc.style.display = 'block';
                var npai = document.getElementById('home-npai-container');
                if (npai) npai.style.display = 'block';
                if (typeof carregarNPAIHome === 'function') carregarNPAIHome();
            }

            if (userRole === 'administrador de posturas') {
                // Apenas exibe o botão do Histórico Geral no menu lateral.
                // A home só mostrará o container padrão "Minhas Tarefas", que não está oculto.
                var ghg = document.getElementById('gerente-historico-geral');
                if (ghg) ghg.style.display = 'block';
            }

            if (userRole === 'diretor de meio ambiente' || userRole === 'Diretor de Meio Ambiente') {
                document.getElementById('diretor-options').style.display = 'block';
                document.getElementById('tarefas-comum').style.display = 'none';
            }

            if (userRole === 'secretario' || userRole === 'secretaria' || userRole === 'secretário' || userRole === 'secretária' || userRole === 'secretário(a)') {
                document.getElementById('secretario-options').style.display = 'block';
                document.getElementById('tarefas-comum').style.display = 'none';
                // Inicializa modo do secretário
                window.secretarioModoVisualizacao = window.secretarioModoVisualizacao || 'normal';
                window.secretarioModoGerencia = window.secretarioModoGerencia || false;
            }
        }
    } catch (erroGeral) {
        console.error("Erro Critico no carregamento inicial:", erroGeral);
        document.getElementById('user-name').innerText = "Falha no DB";
    }
}

function mudarAba(idAba) {
    // Se for Diretor, fechar submenu ao mudar para abas fora dele
    if (window.userRoleGlobal === 'diretor de meio ambiente' || window.userRoleGlobal === 'diretor') {
        var submenu = document.getElementById('diretor-submenu-gerencia');
        if (submenu && submenu.style.display === 'block') {
            var btnClicado = (typeof event !== 'undefined' && event) ? event.currentTarget : null;
            var dentroSubmenu = btnClicado ? submenu.contains(btnClicado) : false;
            var ehBotaoToggle = btnClicado ? (btnClicado.id === 'btn-toggle-gerencia') : false;
            
            if (!dentroSubmenu && !ehBotaoToggle) {
                fecharGerenciaDiretor();
            }
        }
    }

    // Se for Secretario, fechar submenu ao mudar para abas fora dele
    if (window.userRoleGlobal === 'secretario' || window.userRoleGlobal === 'secretaria' || 
        window.userRoleGlobal === 'secretário' || window.userRoleGlobal === 'secretária' ||
        window.userRoleGlobal === 'secretário(a)') {
        var submenu = document.getElementById('secretario-submenu-direcao');
        var submenuGerencia = document.getElementById('secretario-submenu-gerencia');
        if (submenu && submenu.style.display === 'block') {
            var btnClicado = (typeof event !== 'undefined' && event) ? event.currentTarget : null;
            var dentroSubmenu = btnClicado ? submenu.contains(btnClicado) : false;
            var ehBotaoToggle = btnClicado ? (btnClicado.id === 'btn-toggle-direcao') : false;
            var ehBotaoGerencia = btnClicado ? (btnClicado.id === 'btn-toggle-gerencia-secretario') : false;
            var dentroSubmenuGerencia = btnClicado && submenuGerencia ? submenuGerencia.contains(btnClicado) : false;
            
            // Se clicou dentro do submenu mas FORA do sub-submenu, fechar o sub-submenu
            if (dentroSubmenu && !dentroSubmenuGerencia && !ehBotaoGerencia) {
                // Fechar apenas o sub-submenu de gerencia
                if (submenuGerencia) submenuGerencia.style.display = 'none';
                window.secretarioModoGerencia = false;
                var btnGerencia = document.getElementById('btn-toggle-gerencia-secretario');
                if (btnGerencia && btnGerencia.querySelector('svg')) {
                    btnGerencia.querySelector('svg').innerHTML = '<path d="M12 5v14M5 12h14"></path>';
                }
            }
            
            // Se clicou fora de tudo, fechar o submenu principal também
            if (!dentroSubmenu && !ehBotaoToggle && !ehBotaoGerencia && !dentroSubmenuGerencia) {
                fecharDirecaoSecretario();
            }
        }
    }

    document.querySelectorAll('.content-section').forEach(function (s) { s.style.display = 'none'; });
    document.querySelectorAll('.nav-btn').forEach(function (b) { b.classList.remove('active'); });

    var abaEl = document.getElementById('aba-' + idAba);
    if (abaEl) abaEl.style.display = 'block';

    if (idAba === 'home') {
        var hgc = document.getElementById('home-gerente-container');
        var hdc = document.getElementById('home-diretor-container');
        var hsc = document.getElementById('home-secretario-container');
        var mtWrapper = document.getElementById('minhas-tarefas-wrapper');
        
        // SECRETARIO: tem prioridade pois é nivel mais alto
        if (window.userRoleGlobal === 'secretario' || window.userRoleGlobal === 'secretaria' || 
            window.userRoleGlobal === 'secretário' || window.userRoleGlobal === 'secretária' ||
            window.userRoleGlobal === 'secretário(a)') {
            // Manter submenu aberto se estiver em modo direcao
            var submenuSec = document.getElementById('secretario-submenu-direcao');
            var btnSec = document.getElementById('btn-toggle-direcao');
            var submenuGerenciaSec = document.getElementById('secretario-submenu-gerencia');
            
            if (window.secretarioModoVisualizacao === 'direcao') {
                if (window.secretarioModoGerencia) {
                    // Sub-modo GERENCIA: mostra home do gerente (igual Diretor)
                    if (hsc) hsc.style.display = 'none';
                    if (hdc) hdc.style.display = 'none';
                    if (hgc) {
                        hgc.style.display = 'block';
                        if (typeof carregarGraficoFiscais === 'function') carregarGraficoFiscais();
                    }
                    if (mtWrapper) mtWrapper.style.display = 'none';
                    // Manter submenus abertos
                    if (submenuSec) submenuSec.style.display = 'block';
                    if (submenuGerenciaSec) submenuGerenciaSec.style.display = 'block';
                    if (btnSec && btnSec.querySelector('svg')) btnSec.querySelector('svg').innerHTML = '<path d="M18 15l-6-6-6 6"></path>';
                } else {
                    // Modo DIRECAO normal: espelha o modo Diretor (gerencia)
                    if (hsc) hsc.style.display = 'none';
                    if (hdc) {
                        hdc.style.display = 'block';
                        if (typeof carregarDashboardDiretor === 'function') carregarDashboardDiretor();
                    }
                    if (mtWrapper) mtWrapper.style.display = 'none';
                    // Manter submenu direcao aberto, fechar submenu gerencia
                    if (submenuSec) submenuSec.style.display = 'block';
                    if (submenuGerenciaSec) submenuGerenciaSec.style.display = 'none';
                    if (btnSec && btnSec.querySelector('svg')) btnSec.querySelector('svg').innerHTML = '<path d="M18 15l-6-6-6 6"></path>';
                }
            } else {
                // Modo normal: mostra gestao de diretores
                if (hdc) hdc.style.display = 'none';
                if (hgc) hgc.style.display = 'none';
                if (hsc) {
                    hsc.style.display = 'block';
                    if (typeof carregarDashboardSecretario === 'function') carregarDashboardSecretario();
                }
                if (mtWrapper) mtWrapper.style.display = 'none';
                // Garantir submenus fechados
                if (submenuSec) submenuSec.style.display = 'none';
                if (submenuGerenciaSec) submenuGerenciaSec.style.display = 'none';
                if (btnSec && btnSec.querySelector('svg')) btnSec.querySelector('svg').innerHTML = '<path d="M12 5v14M5 12h14"></path>';
            }
        }
        // DIRETOR: Verifica o modo de visualizacao
        else if (window.userRoleGlobal === 'diretor de meio ambiente' || window.userRoleGlobal === 'diretor') {
            if (window.diretorModoVisualizacao === 'gerencia') {
                // Modo GERENCIA: mostra o mesmo painel do Gerente (fiscais)
                if (hdc) hdc.style.display = 'none';
                if (hsc) hsc.style.display = 'none';
                if (hgc) {
                    hgc.style.display = 'block';
                    if (typeof carregarGraficoFiscais === 'function') carregarGraficoFiscais();
                }
                // Mostra tabela minhas tarefas original
                if (mtWrapper) mtWrapper.style.display = 'block';
            } else {
                // Modo DIRECAO (normal): mostra gestao de gerentes
                if (hgc) hgc.style.display = 'none';
                if (hsc) hsc.style.display = 'none';
                if (hdc) {
                    hdc.style.display = 'block';
                    if (typeof carregarDashboardDiretor === 'function') carregarDashboardDiretor();
                }
                // Oculta tabela minhas tarefas original (esta embaixo na gestao)
                if (mtWrapper) mtWrapper.style.display = 'none';
            }
        }
        // GERENTE: mantem comportamento original
        else if (userRoleGlobal === 'gerente fiscal' || userRoleGlobal === 'gerente de posturas') {
            if (hgc) hgc.style.display = 'block';
            if (hdc) hdc.style.display = 'none';
            if (hsc) hsc.style.display = 'none';
            if (mtWrapper) mtWrapper.style.display = 'block';
        }
    }

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

    if (idAba === 'projetos') {
        if (typeof inicializarCalendario === 'function') inicializarCalendario();
        if (typeof carregarEventos === 'function') carregarEventos();
    }
}

// Inicializa
carregarDadosIniciais();

// Carregar minhas tarefas na Home (aguarda tarefas.js carregar)
window.addEventListener('load', function () {
    if (typeof carregarMinhasTarefasHome === 'function') carregarMinhasTarefasHome();
});

// --- LÓGICA DE DIRETOR: TOGGLE GERENCIA ---
function fecharGerenciaDiretor() {
    var submenu = document.getElementById('diretor-submenu-gerencia');
    var btn = document.getElementById('btn-toggle-gerencia');
    if (submenu) submenu.style.display = 'none';
    if (btn) {
        var svg = btn.querySelector('svg');
        if (svg) svg.innerHTML = '<path d="M12 5v14M5 12h14"></path>';
    }
    if (typeof window.configurarModoTarefas === 'function') {
        window.configurarModoTarefas('direcao');
    }
}

function toggleGerenciaPosturas() {
    var submenu = document.getElementById('diretor-submenu-gerencia');
    var btn = document.getElementById('btn-toggle-gerencia');
    
    if (!submenu || !btn) return;

    var estaAberto = submenu.style.display === 'block';
    var naHomeGerente = estaAberto && document.getElementById('aba-home').style.display === 'block' && document.getElementById('home-gerente-container').style.display === 'block';

    if (!estaAberto) {
        // ABRIR
        submenu.style.display = 'block';
        if (btn.querySelector('svg')) {
            btn.querySelector('svg').innerHTML = '<path d="M18 15l-6-6-6 6"></path>'; // Seta pra cima
        }
        
        // Mudar para Home e mostrar containers de gerente
        if (typeof configurarModoTarefas === 'function') configurarModoTarefas('gerencia');
        mudarAba('home');
    } else if (estaAberto && !naHomeGerente) {
        // JÁ ESTÁ ABERTO, MAS O USUÁRIO ESTÁ EM OUTRA ABA (ex: Projetos)
        // Apenas volta para a Home do Gerente sem fechar a barra
        if (typeof configurarModoTarefas === 'function') configurarModoTarefas('gerencia');
        mudarAba('home');
    } else {
        // FECHAR (Só se já estiver na aba dele)
        fecharGerenciaDiretor();
        mudarAba('home');
    }
}
window.toggleGerenciaPosturas = toggleGerenciaPosturas;
window.fecharGerenciaDiretor = fecharGerenciaDiretor;

// --- LÓGICA DE SECRETÁRIO: TOGGLE DIREÇÃO ---
window.secretarioModoVisualizacao = 'normal'; // 'normal' ou 'direcao'

function fecharDirecaoSecretario() {
    var submenu = document.getElementById('secretario-submenu-direcao');
    var btn = document.getElementById('btn-toggle-direcao');
    var submenuGerencia = document.getElementById('secretario-submenu-gerencia');
    if (submenu) submenu.style.display = 'none';
    if (submenuGerencia) submenuGerencia.style.display = 'none';
    if (btn) {
        var svg = btn.querySelector('svg');
        if (svg) svg.innerHTML = '<path d="M12 5v14M5 12h14"></path>';
    }
    window.secretarioModoVisualizacao = 'normal';
    window.secretarioModoGerencia = false;
}

// Toggle Gerência de Posturas para Secretário (sub-submenu)
function toggleGerenciaPosturasSecretario() {
    var submenuGerencia = document.getElementById('secretario-submenu-gerencia');
    var btnGerencia = document.getElementById('btn-toggle-gerencia-secretario');
    
    if (!submenuGerencia) return;

    var estaAberto = submenuGerencia.style.display === 'block';

    if (!estaAberto) {
        // ABRIR - modo gerencia
        submenuGerencia.style.display = 'block';
        if (btnGerencia && btnGerencia.querySelector('svg')) {
            btnGerencia.querySelector('svg').innerHTML = '<path d="M18 15l-6-6-6 6"></path>';
        }
        window.secretarioModoGerencia = true;
        // Mudar para home do gerente
        mudarAba('home');
    } else {
        // FECHAR
        submenuGerencia.style.display = 'none';
        if (btnGerencia && btnGerencia.querySelector('svg')) {
            btnGerencia.querySelector('svg').innerHTML = '<path d="M12 5v14M5 12h14"></path>';
        }
        window.secretarioModoGerencia = false;
        mudarAba('home');
    }
}
window.toggleGerenciaPosturasSecretario = toggleGerenciaPosturasSecretario;

function toggleDirecaoMeioAmbiente() {
    var submenu = document.getElementById('secretario-submenu-direcao');
    var btn = document.getElementById('btn-toggle-direcao');
    var submenuGerencia = document.getElementById('secretario-submenu-gerencia');
    
    if (!submenu || !btn) return;

    var estaAberto = submenu.style.display === 'block';

    if (!estaAberto) {
        // ABRIR - modo direcao (espelha o modo diretor)
        submenu.style.display = 'block';
        if (btn.querySelector('svg')) {
            btn.querySelector('svg').innerHTML = '<path d="M18 15l-6-6-6 6"></path>'; // Seta pra cima
        }
        
        window.secretarioModoVisualizacao = 'direcao';
        window.secretarioModoGerencia = false;
        if (typeof configurarModoTarefas === 'function') configurarModoTarefas('direcao');
        mudarAba('home');
    } else {
        // FECHAR - volta para modo normal (gestao de diretores)
        // Fechar também o sub-submenu de gerencia
        if (submenuGerencia) submenuGerencia.style.display = 'none';
        window.secretarioModoGerencia = false;
        fecharDirecaoSecretario();
        mudarAba('home');
    }
}
window.toggleDirecaoMeioAmbiente = toggleDirecaoMeioAmbiente;
window.fecharDirecaoSecretario = fecharDirecaoSecretario;

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

        var authResult = await getAuthUser();
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
        var authResult = await getAuthUser();
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

// --- ALERTA DE ÚLTIMO DIA DO MÊS ---
function verificarUltimoDiaMes() {
    const alerta = document.getElementById('alerta-ultimo-dia');
    if (!alerta) return;

    const hoje = new Date();
    const diaAtual = hoje.getDate();

    // Calcula o último dia do mês atual (mês + 1 no dia 0 retrocede para o último dia do mês atual)
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();

    if (diaAtual === ultimoDia) {
        alerta.style.display = 'flex';
    }
}
window.addEventListener('load', verificarUltimoDiaMes);

// Trava para evitar execuções paralelas do fechamento
let fechamentoEmAndamento = false;

async function executarFechamentoAnualWrapper() {
    if (fechamentoEmAndamento) {
        console.warn("Fechamento já está em andamento.");
        return;
    }

    if (typeof executarFechamentoAnual === 'function') {
        try {
            fechamentoEmAndamento = true;
            await executarFechamentoAnual();
        } catch (err) {
            console.error("Erro no wrapper do fechamento:", err);
        } finally {
            fechamentoEmAndamento = false;
        }
    } else {
        console.error("Função executarFechamentoAnual não carregada.");
        alert("Erro: O módulo de fechamento ainda não foi carregado.");
    }
}

console.log("painel.js carregado com sucesso.");
if (typeof supabaseClient === 'undefined') {
    console.error("ERRO: supabaseClient não foi definido! Verifique se protecao.js está sendo carregado corretamente.");
} else {
    console.log("supabaseClient detectado.");
}

async function verificarLimpezaAgendada() {
    const dataAgendada = localStorage.getItem('agendamento_limpeza_data');
    const anoParaLimpar = localStorage.getItem('agendamento_limpeza_ano');

    if (!dataAgendada || !anoParaLimpar) return;

    const agora = Date.now();
    if (agora < parseInt(dataAgendada)) {
        const falta = Math.ceil((parseInt(dataAgendada) - agora) / 1000);
        console.log(`[Limpeza] Agendamento para ${anoParaLimpar} ainda não venceu. Faltam ~${falta} segundos.`);
        return;
    }

    console.log(`[Limpeza] Prazo vencido! Iniciando processo para o ano ${anoParaLimpar}...`);

    // Tentar pegar o papel do usuário (role)
    let userRole = 'fiscal';
    try {
        const { data: { user } } = await getAuthUser();
        if (user) {
            const { data: profile } = await supabaseClient.from('profiles').select('role').eq('id', user.id).single();
            if (profile && profile.role) userRole = profile.role;
        }
    } catch (e) { console.error("[Limpeza] Falha ao verificar role:", e); }

    const isGerencial = userRole.trim() === 'Gerente de Posturas';

    let swalActive = false;
    try {
        Swal.fire({
            title: 'Executando Limpeza Agendada',
            text: `Removendo dados de ${anoParaLimpar}. Isso pode levar um momento...`,
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });
        swalActive = true;
    } catch (e) { }

    try {
        // Usar fuso horário local para o filtro se necessário, ou manter Z para UTC
        const inicioAno = `${anoParaLimpar}-01-01T00:00:00.000Z`;
        const fimAno = `${anoParaLimpar}-12-31T23:59:59.999Z`;

        console.log(`[Limpeza] Perfil Detectado: "${userRole}"`);
        console.log(`[Limpeza] Modo Gerencial?: ${isGerencial ? 'SIM' : 'NÃO (RLS pode limitar a exclusão apenas aos SEUS próprios dados)'}`);
        console.log(`[Limpeza] Filtro de Data: ${inicioAno} até ${fimAno}`);

        // TESTE DE VISIBILIDADE: Ver se o usuário consegue ver algum registro antes de tentar deletar
        const { data: visivelCP } = await supabaseClient
            .from('controle_processual')
            .select('id')
            .gte('created_at', inicioAno)
            .lte('created_at', fimAno)
            .limit(5);

        console.log(`[Limpeza] Registros CP visíveis para este filtro: ${visivelCP ? visivelCP.length : 0}`);

        // 1. Limpar Controle Processual
        console.log("[Limpeza] Tentando deletar de controle_processual...");
        const resCP = await supabaseClient
            .from('controle_processual')
            .delete()
            .gte('created_at', inicioAno)
            .lte('created_at', fimAno)
            .select('id');

        if (resCP.error) {
            console.error("[Limpeza] Erro CP:", resCP.error);
            if (resCP.error.code === '42501') {
                throw new Error("Permissão negada (42501). Você não tem autorização no Supabase para deletar estes registros. Verifique as políticas de RLS.");
            }
            throw resCP.error;
        }

        // 2. Limpar Produtividade
        console.log("[Limpeza] Tentando deletar de registros_produtividade...");
        const resProd = await supabaseClient
            .from('registros_produtividade')
            .delete()
            .gte('created_at', inicioAno)
            .lte('created_at', fimAno)
            .select('id');

        if (resProd.error) {
            console.error("[Limpeza] Erro Produtividade:", resProd.error);
            throw resProd.error;
        }

        const deletadosCP = resCP.data?.length || 0;
        const deletadosProd = resProd.data?.length || 0;
        console.log(`[Limpeza] Resultado: ${deletadosCP} registros CP deletados, ${deletadosProd} registros Prod deletados.`);

        // --- DIAGNÓSTICO DE RLS ---
        if (deletadosCP === 0 && visivelCP && visivelCP.length > 0) {
            const msgRLS = "[Limpeza] ATENÇÃO: Os registros são VISÍVEIS mas NÃO puderam ser DELETADOS. " +
                          "Isso indica bloqueio por RLS (Row Level Security) no Supabase. " +
                          "Apenas o criador do registro ou um usuário com permissão de DELETE na política do banco pode excluir.";
            console.error(msgRLS);
            console.info("%c[SUPABASE FIX] Execute este SQL no Dashboard do Supabase para corrigir:\n\n" +
                         "ALTER POLICY \"Permitir exclusão para gerentes\" ON controle_processual \n" +
                         "FOR DELETE TO authenticated \n" +
                         "USING ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'Gerente de Posturas' );", "color: orange; font-weight: bold;");
            
            if (swalActive) {
                Swal.fire({
                    title: 'Bloqueio de Permissão',
                    html: `O sistema encontrou ${visivelCP.length} registros de ${anoParaLimpar}, mas o <b>Supabase</b> não permitiu a exclusão.<br><br>` +
                          `Certifique-se de que a política RLS da tabela <code>controle_processual</code> permite o <i>DELETE</i> para o seu cargo.`,
                    icon: 'warning'
                });
            }
            return;
        }

        // Se realmente não havia nada para deletar
        if (deletadosCP === 0 && deletadosProd === 0) {
            console.warn(`[Limpeza] Aviso: Nenhum registro encontrado para o ano ${anoParaLimpar}.`);
            if (swalActive) {
                Swal.fire('Nada para Limpar', `Não foram encontrados registros do ano de ${anoParaLimpar} no seu histórico.`, 'info');
            }
        } else {
            if (swalActive) {
                Swal.fire('Limpeza Concluída', `Foram removidos ${deletadosCP} registros de Controle Processual e ${deletadosProd} de Produtividade do ano de ${anoParaLimpar}.`, 'success');
            }
        }

        // Remover agendamento apenas se o processo rodou (para não ficar em loop se o erro for permissão permanente)
        localStorage.removeItem('agendamento_limpeza_data');
        localStorage.removeItem('agendamento_limpeza_ano');

        if (typeof carregarHistorico === 'function') carregarHistorico();
        if (typeof renderizarHistoricoGeral === 'function') renderizarHistoricoGeral();

    } catch (err) {
        console.error('[Limpeza] Falha Crítica:', err);
        if (swalActive) {
            Swal.fire('Erro na Limpeza', err.message || 'Ocorreu um erro ao tentar limpar os dados antigos.', 'error');
        }
    }
}
window.verificarLimpezaAgendada = verificarLimpezaAgendada;

async function salvarDadosPerfil() {
    try {
        var authResult = await getAuthUser();
        var user = authResult.data.user;
        if (!user) {
            Swal.fire('Erro', 'Usuário não autenticado.', 'error');
            return;
        }

        var novoNome = document.getElementById('perfil-nome').value;
        var novoEmail = document.getElementById('perfil-email').value;

        Swal.fire({
            title: 'Salvando...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        var { error } = await supabaseClient
            .from('profiles')
            .update({
                full_name: novoNome,
                email_real: novoEmail,
                email_verificado: false // Resetar para obrigar nova verificação no fechamento
            })
            .eq('id', user.id);

        if (error) throw error;

        // Atualizar o nome na barra lateral
        document.getElementById('user-name').innerText = novoNome || "Usuario";

        Swal.fire('Sucesso!', 'Seus dados foram atualizados.', 'success');

    } catch (err) {
        console.error("Erro ao salvar perfil:", err);
        Swal.fire('Erro', 'Não foi possível salvar as alterações: ' + err.message, 'error');
    }
}
window.salvarDadosPerfil = salvarDadosPerfil;
