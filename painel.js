// painel.js
// Usa o supabaseClient ja criado pelo protecao.js

// Variável global para modo de visualização do Diretor
window.diretorModoVisualizacao = window.diretorModoVisualizacao || 'direcao';

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

// --- FUNÇÕES DE HIERARQUIA DE PERMISSÕES ---
function getNivelHierarquico(role) {
    if (!role) return 0;
    const roleLower = role.toLowerCase();
    if (roleLower.includes('secretário') || roleLower.includes('secretario')) return 3;
    if (roleLower.includes('diretor')) return 2;
    if (roleLower.includes('gerente')) return 1;
    return 0;
}

function isGerenteOuSuperior(role) {
    return getNivelHierarquico(role) >= 1;
}

function isDiretorOuSuperior(role) {
    return getNivelHierarquico(role) >= 2;
}

function isSecretario(role) {
    return getNivelHierarquico(role) >= 3;
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
            .maybeSingle(); // Usar maybeSingle para evitar erro PGRST116 se não houver perfil

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

        if (!perfil) {
            console.warn("Perfil não encontrado para o usuário:", user.id);
            Swal.fire({
                title: 'Perfil não encontrado',
                text: 'Não localizamos seu registro de perfil. Por favor, entre em contato com o suporte ou tente logar novamente.',
                icon: 'error',
                confirmButtonText: 'Sair e Logar'
            }).then(() => {
                sair();
            });
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

            var userRole = perfil ? perfil.role : '';
            window.userRoleGlobal = userRole;
            console.log("DEBUG - window.userRoleGlobal:", window.userRoleGlobal);

            if (userRole === 'administrativo de posturas') {
                document.getElementById('admin-options').style.display = 'block';
                var cardAdmin = document.getElementById('card-admin-stats');
                if (cardAdmin) cardAdmin.style.display = 'block';
            }

            // Verificação flexível para Gerente, Diretor e Secretário (hierarquia)
            var roleLower = (userRole || '').toLowerCase();
            var isGerente = roleLower.includes('gerente');
            var isDiretor = roleLower.includes('diretor');
            var isSecretario = roleLower.includes('secretário') || roleLower.includes('secretario');
            var isCargoGerencia = isGerente || isDiretor || isSecretario;
            
            console.log("DEBUG - Cargo:", roleLower, "| Gerencia:", isCargoGerencia);
            
            if (isCargoGerencia) {
                console.log("DEBUG - Cargo de gerência detectado! Ativando opções.");
                
                // Apenas Gerente (puro) vê menus standalone
                // Diretor e Secretário têm seus próprios menus estruturados
                var isGerentePuro = isGerente && !isDiretor && !isSecretario;
                
                if (isGerentePuro) {
                    console.log("DEBUG - Gerente puro detectado, ativando container");
                    
                    // Verificar se é Gerente de Posturas ou Gerente de Regularização Ambiental
                    var isGerentePosturas = roleLower.includes('postura');
                    var isGerenteAmbiental = roleLower.includes('regularizacao') || roleLower.includes('regularização');
                    
                    // Exibe as opcoes de gerencia na sidebar (apenas Gerente de Posturas)
                    if (isGerentePosturas) {
                        var gOpts = document.getElementById('gerente-options');
                        if (gOpts) gOpts.style.display = 'block';
                    }

                    // Ambos os gerentes veem Projetos (mas cada um só vê os seus)
                    if (isGerentePosturas || isGerenteAmbiental) {
                        var pOpts = document.getElementById('gerente-posturas-options');
                        if (pOpts) pOpts.style.display = 'block';
                    }

                    // APENAS Gerente de Posturas vê: Historico Geral, Bairros, Home de Fiscais
                    if (isGerentePosturas) {
                        // Gerente veem Historico Geral standalone
                        var ghg = document.getElementById('gerente-historico-geral');
                        if (ghg) ghg.style.display = 'block';
                        
                        // Mostra grafico de fiscais na Home (apenas Gerente de Posturas)
                        var hgc = document.getElementById('home-gerente-container');
                        if (hgc) hgc.style.display = 'block';
                        
                        // Carrega dados do grafico
                        if (typeof carregarGraficoFiscais === 'function') carregarGraficoFiscais();
                        if (typeof carregarRankingFiscaisHome === 'function') carregarRankingFiscaisHome();
                    }
                    
                    // Garante que containers de outros cargos estejam ocultos
                    var hdc = document.getElementById('home-diretor-container');
                    if (hdc) hdc.style.display = 'none';
                    var hsc = document.getElementById('home-secretario-container');
                    if (hsc) hsc.style.display = 'none';
                    
                    // Para Gerente de Regularização Ambiental, garante que home-gerente-container (fiscais) esteja oculto
                    // E mostra o container da equipe de regularização ambiental
                    if (isGerenteAmbiental) {
                        var hgc = document.getElementById('home-gerente-container');
                        if (hgc) hgc.style.display = 'none';
                        // Mostra container da equipe
                        var hga = document.getElementById('home-gerente-ambiental-container');
                        if (hga) {
                            hga.style.display = 'block';
                            // Carrega a equipe
                            if (typeof carregarDashboardGerenteAmbiental === 'function') carregarDashboardGerenteAmbiental();
                        }
                    }
                    
                    // Mostra o wrapper comum de minhas tarefas (todos os gerentes)
                    var mtWrapper = document.getElementById('minhas-tarefas-wrapper');
                    if (mtWrapper) mtWrapper.style.display = 'block';
                    
                    // Carrega tarefas do gerente
                    if (typeof carregarMinhasTarefasHome === 'function') {
                        carregarMinhasTarefasHome('home-minhas-tarefas');
                    }
                }
                
                // Mostra botões de criar evento/tarefa (todos os cargos de gerência)
                var btnEvento = document.getElementById('btn-novo-evento-diretor');
                if (btnEvento) btnEvento.style.display = 'inline-block';
                var btnTarefa = document.getElementById('btn-nova-tarefa');
                if (btnTarefa) btnTarefa.style.display = 'inline-block';
            }

            // Verificação flexível para Fiscal (qualquer variante)
            var roleLowerFiscal = (userRole || '').toLowerCase();
            if (roleLowerFiscal === 'fiscal' || roleLowerFiscal.includes('fiscal') && roleLowerFiscal.includes('postura')) {
                var fOpts2 = document.getElementById('fiscal-options');
                if (fOpts2) fOpts2.style.display = 'block';
                var hc = document.getElementById('home-produtividade-container');
                if (hc) hc.style.display = 'block';
                var npai = document.getElementById('home-npai-container');
                if (npai) npai.style.display = 'block';
                if (typeof carregarNPAIHome === 'function') carregarNPAIHome();
            }

            var roleLower = (perfil.role || '').toLowerCase().trim();
            console.log("DEBUG - roleLower (trimmed):", roleLower);
            console.log("DEBUG - perfil.role original:", perfil.role);
            // Verificação flexível para qualquer variante de administrativo/administrador de postura(s)
            var isAdminPostura = roleLower.includes('administrativo') && roleLower.includes('postura') ||
                                 roleLower.includes('administrador') && roleLower.includes('postura');
            if (isAdminPostura) {
                // Apenas exibe o botão do Histórico Geral no menu lateral.
                console.log("DEBUG - Cargo admin reconhecido! Exibindo Histórico Geral.");
                var ghg = document.getElementById('gerente-historico-geral');
                if (ghg) {
                    ghg.style.display = 'block';
                    console.log("DEBUG - Menu Histórico Geral ativado.");
                } else {
                    console.error("DEBUG - Elemento gerente-historico-geral não encontrado!");
                }
            } else {
                console.log("DEBUG - Cargo não corresponde ao admin:", roleLower);
            }

            // Controle de visibilidade do botão "Fechamento Anual"
            // Apenas Fiscal e Administrativo de Postura NÃO devem ver o botão
            var isFiscal = roleLower === 'fiscal' || (roleLower.includes('fiscal') && roleLower.includes('postura'));
            var btnFechamento = document.getElementById('btn-fechamento-anual');
            if (btnFechamento) {
                // Mostra o botão apenas se NÃO for Fiscal e NÃO for Admin de Postura
                if (!isFiscal && !isAdminPostura) {
                    btnFechamento.style.display = 'inline-flex';
                } else {
                    btnFechamento.style.display = 'none';
                }
            }

            if (userRole === 'Diretor(a) de Meio Ambiente' || userRole === 'Diretor(a)' || isDiretor) {
                document.getElementById('diretor-options').style.display = 'block';
                document.getElementById('tarefas-comum').style.display = 'none';
                // Mostra dashboard específico do Diretor na Home
                var hdc = document.getElementById('home-diretor-container');
                if (hdc) hdc.style.display = 'block';
                // Garante que o container do Gerente esteja oculto (evita flash)
                var hgc = document.getElementById('home-gerente-container');
                if (hgc) hgc.style.display = 'none';
                // Garante que menus standalone do Gerente estejam ocultos
                var gOpts = document.getElementById('gerente-options');
                if (gOpts) gOpts.style.display = 'none';
                var ghg = document.getElementById('gerente-historico-geral');
                if (ghg) ghg.style.display = 'none';
                // Oculta o wrapper comum de minhas tarefas (Diretor tem o próprio)
                var mtWrapper = document.getElementById('minhas-tarefas-wrapper');
                if (mtWrapper) mtWrapper.style.display = 'none';
                // Oculta containers do Fiscal
                var hpc = document.getElementById('home-produtividade-container');
                if (hpc) hpc.style.display = 'none';
                var npai = document.getElementById('home-npai-container');
                if (npai) npai.style.display = 'none';
                // Carrega dashboard do Diretor (gestão de gerentes)
                if (typeof carregarDashboardDiretor === 'function') carregarDashboardDiretor();
            }

            if (userRole === 'Secretário(a)' || isSecretario) {
                console.log("DEBUG - Secretario detectado, ativando container");
                document.getElementById('secretario-options').style.display = 'block';
                document.getElementById('tarefas-comum').style.display = 'none';
                // Mostra dashboard específico do Secretário na Home
                var hsc = document.getElementById('home-secretario-container');
                if (hsc) hsc.style.display = 'block';
                // Garante que containers de outros cargos estejam ocultos
                var hgc = document.getElementById('home-gerente-container');
                if (hgc) hgc.style.display = 'none';
                var hdc = document.getElementById('home-diretor-container');
                if (hdc) hdc.style.display = 'none';
                // Oculta o wrapper comum de minhas tarefas (Secretário tem o próprio)
                var mtWrapper = document.getElementById('minhas-tarefas-wrapper');
                if (mtWrapper) mtWrapper.style.display = 'none';
                // Oculta containers do Fiscal
                var hpc = document.getElementById('home-produtividade-container');
                if (hpc) hpc.style.display = 'none';
                var npai = document.getElementById('home-npai-container');
                if (npai) npai.style.display = 'none';
                // Garante que menus standalone do Gerente estejam ocultos
                var gOpts = document.getElementById('gerente-options');
                if (gOpts) gOpts.style.display = 'none';
                var ghg = document.getElementById('gerente-historico-geral');
                if (ghg) ghg.style.display = 'none';
                // Inicializa modo do secretário - modo 'direcao' para ver tarefas dos Diretores
                window.secretarioModoVisualizacao = window.secretarioModoVisualizacao || 'direcao';
                window.secretarioModoGerencia = window.secretarioModoGerencia || false;
                // Carrega dashboard do Secretário (gestão de diretores)
                if (typeof carregarDashboardSecretario === 'function') carregarDashboardSecretario();
            }
        }
    } catch (erroGeral) {
        console.error("Erro Critico no carregamento inicial:", erroGeral);
        document.getElementById('user-name').innerText = "Falha no DB";
    }
}

function mudarAba(idAba) {
    console.log('DEBUG - mudarAba chamada com:', idAba, 'userRoleGlobal:', window.userRoleGlobal);
    
    // Se for Diretor, fechar submenu ao mudar para abas fora dele
    var roleLower = (window.userRoleGlobal || '').toLowerCase();
    var isDiretor = roleLower === 'diretor(a)' || roleLower === 'diretor(a) de meio ambiente' || 
                    roleLower === 'diretor' || roleLower === 'diretor de meio ambiente';
    console.log('DEBUG - isDiretor:', isDiretor, 'roleLower:', roleLower);
    
    if (isDiretor) {
        var btnClicado = (typeof event !== 'undefined' && event) ? event.currentTarget : null;
        var btnClicadoId = btnClicado ? btnClicado.id : null;
        
        // Fechar submenu Gerência de Posturas
        var submenu = document.getElementById('diretor-submenu-gerencia');
        console.log('DEBUG - submenu display:', submenu ? submenu.style.display : 'null');
        if (submenu && submenu.style.display === 'block') {
            var dentroSubmenu = btnClicado ? submenu.contains(btnClicado) : false;
            var ehBotaoToggle = btnClicadoId === 'btn-toggle-gerencia';
            var ehBotaoToggleAmbiental = btnClicadoId === 'btn-toggle-gerencia-ambiental'; // Fechar se clicar no outro botão
            console.log('DEBUG - btnClicado:', btnClicadoId, 'ehBotaoToggle:', ehBotaoToggle, 'dentroSubmenu:', dentroSubmenu);

            if (!dentroSubmenu && !ehBotaoToggle || ehBotaoToggleAmbiental) {
                console.log('DEBUG - Fechando submenu do Diretor');
                fecharGerenciaDiretor();
            }
        }
        
        // Fechar submenu Gerência de Regularização Ambiental
        var submenuAmbiental = document.getElementById('diretor-submenu-gerencia-ambiental');
        if (submenuAmbiental && submenuAmbiental.style.display === 'block') {
            var dentroSubmenu = btnClicado ? submenuAmbiental.contains(btnClicado) : false;
            var ehBotaoToggle = btnClicadoId === 'btn-toggle-gerencia-ambiental';
            var ehBotaoTogglePosturas = btnClicadoId === 'btn-toggle-gerencia'; // Fechar se clicar no outro botão

            if (!dentroSubmenu && !ehBotaoToggle || ehBotaoTogglePosturas) {
                fecharGerenciaAmbientalDiretor();
            }
        }
    }

    // Se for Secretario, fechar submenu ao mudar para abas fora dele
    if (window.userRoleGlobal === 'Secretário(a)') {
        var submenu = document.getElementById('secretario-submenu-direcao');
        var submenuGerencia = document.getElementById('secretario-submenu-gerencia');
        var submenuGerenciaAmbiental = document.getElementById('secretario-submenu-gerencia-ambiental');
        if (submenu && submenu.style.display === 'block') {
            var btnClicado = (typeof event !== 'undefined' && event) ? event.currentTarget : null;
            var dentroSubmenu = btnClicado ? submenu.contains(btnClicado) : false;
            var ehBotaoToggle = btnClicado ? (btnClicado.id === 'btn-toggle-direcao') : false;
            var ehBotaoGerencia = btnClicado ? (btnClicado.id === 'btn-toggle-gerencia-secretario') : false;
            var ehBotaoGerenciaAmbiental = btnClicado ? (btnClicado.id === 'btn-toggle-gerencia-ambiental-secretario') : false;
            var dentroSubmenuGerencia = btnClicado && submenuGerencia ? submenuGerencia.contains(btnClicado) : false;
            var dentroSubmenuGerenciaAmbiental = btnClicado && submenuGerenciaAmbiental ? submenuGerenciaAmbiental.contains(btnClicado) : false;

            // Se clicou dentro do submenu mas FORA dos sub-submenus, fechar os sub-submenus
            if (dentroSubmenu && !dentroSubmenuGerencia && !ehBotaoGerencia && !dentroSubmenuGerenciaAmbiental && !ehBotaoGerenciaAmbiental) {
                // Fechar sub-submenus
                if (submenuGerencia) submenuGerencia.style.display = 'none';
                if (submenuGerenciaAmbiental) submenuGerenciaAmbiental.style.display = 'none';
                window.secretarioModoGerencia = false;
                var btnGerencia = document.getElementById('btn-toggle-gerencia-secretario');
                if (btnGerencia && btnGerencia.querySelector('svg')) {
                    btnGerencia.querySelector('svg').innerHTML = '<path d="M12 5v14M5 12h14"></path>';
                }
                var btnGerenciaAmbiental = document.getElementById('btn-toggle-gerencia-ambiental-secretario');
                if (btnGerenciaAmbiental && btnGerenciaAmbiental.querySelector('svg')) {
                    btnGerenciaAmbiental.querySelector('svg').innerHTML = '<path d="M12 5v14M5 12h14"></path>';
                }
            }

            // Se clicou fora de tudo, fechar o submenu principal também
            if (!dentroSubmenu && !ehBotaoToggle && !ehBotaoGerencia && !dentroSubmenuGerencia && !ehBotaoGerenciaAmbiental && !dentroSubmenuGerenciaAmbiental) {
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
        var hga = document.getElementById('home-gerente-ambiental-container');
        var hdc = document.getElementById('home-diretor-container');
        var hsc = document.getElementById('home-secretario-container');
        var mtWrapper = document.getElementById('minhas-tarefas-wrapper');

        // SECRETARIO: tem prioridade pois é nivel mais alto
        if (window.userRoleGlobal === 'Secretário(a)') {
            // Manter submenu aberto se estiver em modo direcao
            var submenuSec = document.getElementById('secretario-submenu-direcao');
            var btnSec = document.getElementById('btn-toggle-direcao');
            var submenuGerenciaSec = document.getElementById('secretario-submenu-gerencia');

            // Pegar referência ao container do gerente ambiental (sempre necessário)
            var hga = document.getElementById('home-gerente-ambiental-container');
            
            if (window.secretarioModoVisualizacao === 'direcao') {
                if (window.secretarioModoGerencia) {
                    // Sub-modo GERENCIA: mostra home do gerente (igual Diretor)
                    if (hsc) hsc.style.display = 'none';
                    if (hdc) hdc.style.display = 'none';
                    if (hga) hga.style.display = 'none';  // OCULTAR container ambiental
                    if (hgc) {
                        hgc.style.display = 'block';
                        if (typeof carregarGraficoFiscais === 'function') carregarGraficoFiscais();
                        if (typeof carregarRankingFiscaisHome === 'function') carregarRankingFiscaisHome();
                    }
                    if (mtWrapper) mtWrapper.style.display = 'none';
                    // Manter submenus abertos
                    if (submenuSec) submenuSec.style.display = 'block';
                    if (submenuGerenciaSec) submenuGerenciaSec.style.display = 'block';
                    if (btnSec && btnSec.querySelector('svg')) btnSec.querySelector('svg').innerHTML = '<path d="M18 15l-6-6-6 6"></path>';
                } else {
                    // Modo DIRECAO normal: espelha o modo Diretor (gerencia)
                    if (hsc) hsc.style.display = 'none';
                    if (hgc) hgc.style.display = 'none';  // OCULTAR container gerente posturas
                    if (hga) hga.style.display = 'none';  // OCULTAR container ambiental
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
            } else if (window.secretarioModoVisualizacao === 'gerencia_ambiental') {
                // Modo GERENCIA AMBIENTAL: mostra dashboard da equipe ambiental
                var submenuGerenciaAmbiental = document.getElementById('secretario-submenu-gerencia-ambiental');
                var btnGerenciaAmbiental = document.getElementById('btn-toggle-gerencia-ambiental-secretario');
                
                if (hsc) hsc.style.display = 'none';
                if (hdc) hdc.style.display = 'none';
                if (hgc) hgc.style.display = 'none';
                if (hga) {
                    hga.style.display = 'block';
                    if (typeof carregarDashboardGerenteAmbiental === 'function') carregarDashboardGerenteAmbiental();
                }
                if (mtWrapper) mtWrapper.style.display = 'none';
                // Manter submenus abertos
                if (submenuSec) submenuSec.style.display = 'block';
                if (submenuGerenciaSec) submenuGerenciaSec.style.display = 'none';
                if (submenuGerenciaAmbiental) submenuGerenciaAmbiental.style.display = 'block';
                if (btnSec && btnSec.querySelector('svg')) btnSec.querySelector('svg').innerHTML = '<path d="M18 15l-6-6-6 6"></path>';
                if (btnGerenciaAmbiental && btnGerenciaAmbiental.querySelector('svg')) {
                    btnGerenciaAmbiental.querySelector('svg').innerHTML = '<path d="M18 15l-6-6-6 6"></path>';
                }
            } else {
                // Modo normal: mostra gestao de diretores
                if (hdc) hdc.style.display = 'none';
                if (hgc) hgc.style.display = 'none';
                if (hga) hga.style.display = 'none';  // OCULTAR container ambiental
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
        else if (isDiretor) {
            console.log('DEBUG - Diretor detectado, modo:', window.diretorModoVisualizacao, 'userRoleGlobal:', window.userRoleGlobal);
            
            // Pegar referência ao container do gerente ambiental
            var hga = document.getElementById('home-gerente-ambiental-container');
            
            if (window.diretorModoVisualizacao === 'gerencia' || window.diretorModoVisualizacao === 'gerencia_posturas') {
                // Modo GERENCIA POSTURAS: mostra o painel do Gerente de Posturas
                console.log('DEBUG - Modo GERENCIA POSTURAS: exibindo container do Gerente');
                if (hdc) hdc.style.display = 'none';
                if (hsc) hsc.style.display = 'none';
                if (hga) hga.style.display = 'none';
                if (hgc) {
                    hgc.style.display = 'block';
                    console.log('DEBUG - home-gerente-container display:', hgc.style.display);
                    // Carrega os gráficos
                    setTimeout(function() {
                        console.log('DEBUG - Timeout executando, carregando graficos...');
                        if (typeof carregarGraficoFiscais === 'function') {
                            console.log('DEBUG - Chamando carregarGraficoFiscais');
                            carregarGraficoFiscais();
                        }
                        if (typeof carregarRankingFiscaisHome === 'function') {
                            console.log('DEBUG - Chamando carregarRankingFiscaisHome');
                            carregarRankingFiscaisHome();
                        }
                    }, 100);
                } else {
                    console.error('DEBUG - home-gerente-container nao encontrado!');
                }
                // Mostra tabela minhas tarefas original
                if (mtWrapper) mtWrapper.style.display = 'block';
            } else if (window.diretorModoVisualizacao === 'gerencia_ambiental') {
                // Modo GERENCIA AMBIENTAL: mostra o painel do Gerente de Regularização Ambiental
                console.log('DEBUG - Modo GERENCIA AMBIENTAL: exibindo container do Gerente RA');
                if (hdc) hdc.style.display = 'none';
                if (hsc) hsc.style.display = 'none';
                if (hgc) hgc.style.display = 'none';
                if (hga) {
                    hga.style.display = 'block';
                    // Carrega os dados do gerente ambiental
                    setTimeout(function() {
                        if (typeof carregarDashboardGerenteAmbiental === 'function') {
                            carregarDashboardGerenteAmbiental();
                        }
                    }, 100);
                }
                // Mostra tabela minhas tarefas original
                if (mtWrapper) mtWrapper.style.display = 'block';
            } else {
                // Modo DIRECAO (normal): mostra gestao de gerentes
                console.log('DEBUG - Modo DIRECAO: exibindo container do Diretor');
                if (hgc) hgc.style.display = 'none';
                if (hga) hga.style.display = 'none';
                if (hsc) hsc.style.display = 'none';
                if (hdc) {
                    hdc.style.display = 'block';
                    if (typeof carregarDashboardDiretor === 'function') carregarDashboardDiretor();
                }
                // Oculta tabela minhas tarefas original (esta embaixo na gestao)
                if (mtWrapper) mtWrapper.style.display = 'none';
            }
        }
        // GERENTE: mantem comportamento original (mas NÃO inclui Gerente de Regularização Ambiental)
        else if ((window.userRoleGlobal || '').toLowerCase().includes('gerente') && 
                 !(window.userRoleGlobal || '').toLowerCase().includes('regularizacao') && 
                 !(window.userRoleGlobal || '').toLowerCase().includes('regularização')) {
            console.log('DEBUG - Gerente de Posturas detectado');
            if (hgc) hgc.style.display = 'block';
            if (hdc) hdc.style.display = 'none';
            if (hsc) hsc.style.display = 'none';
            if (mtWrapper) mtWrapper.style.display = 'block';
        }
        // GERENTE DE REGULARIZAÇÃO AMBIENTAL: só vê minhas tarefas + equipe
        else if ((window.userRoleGlobal || '').toLowerCase().includes('regularizacao') || 
                 (window.userRoleGlobal || '').toLowerCase().includes('regularização')) {
            console.log('DEBUG - Gerente de Regularizacao Ambiental detectado');
            if (hgc) hgc.style.display = 'none';
            if (hdc) hdc.style.display = 'none';
            if (hsc) hsc.style.display = 'none';
            if (mtWrapper) mtWrapper.style.display = 'block';
            // Mostra container da equipe
            var hga = document.getElementById('home-gerente-ambiental-container');
            if (hga) {
                hga.style.display = 'block';
                if (typeof carregarDashboardGerenteAmbiental === 'function') carregarDashboardGerenteAmbiental();
            }
        } else {
            console.log('DEBUG - Cargo nao reconhecido. userRoleGlobal:', window.userRoleGlobal);
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

// Listener para quando o modo de tarefas mudar (torna o painel reativo às mudanças do tarefas.js)
window.addEventListener('modoTarefasMudou', function(e) {
    var modo = e.detail.modo;
    console.log('DEBUG - Evento modoTarefasMudou recebido:', modo);
    
    var roleLower = (window.userRoleGlobal || '').toLowerCase();
    var isDiretor = roleLower === 'diretor(a)' || roleLower === 'diretor(a) de meio ambiente' || 
                    roleLower === 'diretor' || roleLower === 'diretor de meio ambiente';
    var isSecretario = window.userRoleGlobal === 'Secretário(a)';
    
    var abaHome = document.getElementById('aba-home');
    var naHome = abaHome && abaHome.style.display === 'block';
    
    if (naHome) {
        var hgc = document.getElementById('home-gerente-container');
        var hga = document.getElementById('home-gerente-ambiental-container');
        var hdc = document.getElementById('home-diretor-container');
        var hsc = document.getElementById('home-secretario-container');
        var mtWrapper = document.getElementById('minhas-tarefas-wrapper');
        
        if (isDiretor) {
            // Lógica para Diretor
            if (modo === 'gerencia' || modo === 'gerencia_posturas') {
                if (hdc) hdc.style.display = 'none';
                if (hga) hga.style.display = 'none';
                if (hgc) hgc.style.display = 'block';
                if (mtWrapper) mtWrapper.style.display = 'block';
            } else if (modo === 'gerencia_ambiental') {
                if (hdc) hdc.style.display = 'none';
                if (hgc) hgc.style.display = 'none';
                if (hga) {
                    hga.style.display = 'block';
                    if (typeof carregarDashboardGerenteAmbiental === 'function') carregarDashboardGerenteAmbiental();
                }
                if (mtWrapper) mtWrapper.style.display = 'block';
            } else if (modo === 'direcao') {
                if (hgc) hgc.style.display = 'none';
                if (hga) hga.style.display = 'none';
                if (hdc) {
                    hdc.style.display = 'block';
                    if (typeof carregarDashboardDiretor === 'function') carregarDashboardDiretor();
                }
                if (mtWrapper) mtWrapper.style.display = 'none';
            }
        } else if (isSecretario) {
            // Lógica para Secretário
            if (modo === 'gerencia' || modo === 'gerencia_posturas') {
                // Modo gerência de posturas
                if (hsc) hsc.style.display = 'none';
                if (hdc) hdc.style.display = 'none';
                if (hga) hga.style.display = 'none';
                if (hgc) {
                    hgc.style.display = 'block';
                    if (typeof carregarGraficoFiscais === 'function') carregarGraficoFiscais();
                    if (typeof carregarRankingFiscaisHome === 'function') carregarRankingFiscaisHome();
                }
                if (mtWrapper) mtWrapper.style.display = 'none';
                window.secretarioModoVisualizacao = 'direcao';
                window.secretarioModoGerencia = true;
            } else if (modo === 'gerencia_ambiental') {
                // Modo gerência ambiental
                if (hsc) hsc.style.display = 'none';
                if (hdc) hdc.style.display = 'none';
                if (hgc) hgc.style.display = 'none';
                if (hga) {
                    hga.style.display = 'block';
                    if (typeof carregarDashboardGerenteAmbiental === 'function') carregarDashboardGerenteAmbiental();
                }
                if (mtWrapper) mtWrapper.style.display = 'none';
                window.secretarioModoVisualizacao = 'gerencia_ambiental';
                window.secretarioModoGerencia = false;
            } else if (modo === 'direcao') {
                // Modo direção
                if (hsc) hsc.style.display = 'none';
                if (hgc) hgc.style.display = 'none';
                if (hga) hga.style.display = 'none';
                if (hdc) {
                    hdc.style.display = 'block';
                    if (typeof carregarDashboardDiretor === 'function') carregarDashboardDiretor();
                }
                if (mtWrapper) mtWrapper.style.display = 'none';
                window.secretarioModoVisualizacao = 'direcao';
                window.secretarioModoGerencia = false;
            }
        }
    }
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
    // Atualiza o home para mostrar o dashboard do diretor
    atualizarHomeDiretor();
}

function toggleGerenciaPosturas() {
    try {
        var submenu = document.getElementById('diretor-submenu-gerencia');
        var btn = document.getElementById('btn-toggle-gerencia');

        if (!submenu || !btn) {
            console.error('DEBUG - submenu ou btn nao encontrado');
            return;
        }

        var estaAberto = submenu.style.display === 'block';
        var abaHome = document.getElementById('aba-home');
        var homeGerente = document.getElementById('home-gerente-container');
        var naHomeGerente = estaAberto && abaHome && abaHome.style.display === 'block' && homeGerente && homeGerente.style.display === 'block';

        console.log('DEBUG - toggleGerenciaPosturas: estaAberto=' + estaAberto + ', naHomeGerente=' + naHomeGerente);
        console.log('DEBUG - abaHome display:', abaHome ? abaHome.style.display : 'null');
        console.log('DEBUG - homeGerente display:', homeGerente ? homeGerente.style.display : 'null');

        if (!estaAberto) {
            // ABRIR
            console.log('DEBUG - Abrindo submenu Gerencia');
            
            // Fechar o outro submenu (Gerência Ambiental) se estiver aberto
            fecharGerenciaAmbientalDiretor();
            
            submenu.style.display = 'block';
            if (btn.querySelector('svg')) {
                btn.querySelector('svg').innerHTML = '<path d="M18 15l-6-6-6 6"></path>'; // Seta pra cima
            }

            // Mudar para Home e mostrar containers de gerente
            console.log('DEBUG - Configurando modo gerencia posturas, typeof configurarModoTarefas:', typeof configurarModoTarefas);
            if (typeof configurarModoTarefas === 'function') {
                configurarModoTarefas('gerencia_posturas');
                console.log('DEBUG - Modo configurado, diretorModoVisualizacao:', window.diretorModoVisualizacao);
            } else {
                // Fallback se a função não estiver disponível
                window.diretorModoVisualizacao = 'gerencia_posturas';
                console.log('DEBUG - Fallback: modo definido manualmente');
            }
            console.log('DEBUG - Chamando mudarAba home');
            mudarAba('home');
        } else if (estaAberto && !naHomeGerente) {
            // JÁ ESTÁ ABERTO, MAS O USUÁRIO ESTÁ EM OUTRA ABA (ex: Projetos)
            // Apenas volta para a Home do Gerente sem fechar a barra
            console.log('DEBUG - Submenu aberto mas nao na home, mudando para home');
            if (typeof configurarModoTarefas === 'function') configurarModoTarefas('gerencia_posturas');
            else window.diretorModoVisualizacao = 'gerencia_posturas';
            mudarAba('home');
        } else {
            // FECHAR (Só se já estiver na aba dele)
            console.log('DEBUG - Fechando submenu Gerencia');
            fecharGerenciaDiretor();
            mudarAba('home');
        }
    } catch (err) {
        console.error('DEBUG - Erro em toggleGerenciaPosturas:', err);
    }
}
window.toggleGerenciaPosturas = toggleGerenciaPosturas;
window.fecharGerenciaDiretor = fecharGerenciaDiretor;

// --- LÓGICA DE DIRETOR: TOGGLE GERENCIA REGULARIZAÇÃO AMBIENTAL ---
function fecharGerenciaAmbientalDiretor() {
    var submenu = document.getElementById('diretor-submenu-gerencia-ambiental');
    var btn = document.getElementById('btn-toggle-gerencia-ambiental');
    if (submenu) submenu.style.display = 'none';
    if (btn) {
        var svg = btn.querySelector('svg');
        if (svg) svg.innerHTML = '<path d="M12 5v14M5 12h14"></path>';
    }
    if (typeof window.configurarModoTarefas === 'function') {
        window.configurarModoTarefas('direcao');
    }
    // Atualiza o home para mostrar o dashboard do diretor
    atualizarHomeDiretor();
}

function toggleGerenciaAmbiental() {
    try {
        var submenu = document.getElementById('diretor-submenu-gerencia-ambiental');
        var btn = document.getElementById('btn-toggle-gerencia-ambiental');

        if (!submenu || !btn) {
            console.error('DEBUG - submenu ambiental ou btn nao encontrado');
            return;
        }

        var estaAberto = submenu.style.display === 'block';
        var abaHome = document.getElementById('aba-home');
        var homeGerente = document.getElementById('home-gerente-ambiental-container');
        var naHomeGerente = estaAberto && abaHome && abaHome.style.display === 'block' && homeGerente && homeGerente.style.display === 'block';

        console.log('DEBUG - toggleGerenciaAmbiental: estaAberto=' + estaAberto + ', naHomeGerente=' + naHomeGerente);

        if (!estaAberto) {
            // ABRIR
            console.log('DEBUG - Abrindo submenu Gerencia Ambiental');
            
            // Fechar o outro submenu (Gerência de Posturas) se estiver aberto
            fecharGerenciaDiretor();
            
            submenu.style.display = 'block';
            if (btn.querySelector('svg')) {
                btn.querySelector('svg').innerHTML = '<path d="M18 15l-6-6-6 6"></path>'; // Seta pra cima
            }

            // Mudar para Home e mostrar containers de gerente RA
            if (typeof configurarModoTarefas === 'function') {
                configurarModoTarefas('gerencia_ambiental');
            } else {
                window.diretorModoVisualizacao = 'gerencia_ambiental';
            }
            mudarAba('home');
        } else if (estaAberto && !naHomeGerente) {
            // JÁ ESTÁ ABERTO, MAS O USUÁRIO ESTÁ EM OUTRA ABA
            if (typeof configurarModoTarefas === 'function') configurarModoTarefas('gerencia_ambiental');
            else window.diretorModoVisualizacao = 'gerencia_ambiental';
            mudarAba('home');
        } else {
            // FECHAR (Só se já estiver na aba dele)
            fecharGerenciaAmbientalDiretor();
            mudarAba('home');
        }
    } catch (err) {
        console.error('DEBUG - Erro em toggleGerenciaAmbiental:', err);
    }
}
window.toggleGerenciaAmbiental = toggleGerenciaAmbiental;
window.fecharGerenciaAmbientalDiretor = fecharGerenciaAmbientalDiretor;

// --- FUNÇÃO PARA ATUALIZAR HOME DO DIRETOR ---
function atualizarHomeDiretor() {
    var hgc = document.getElementById('home-gerente-container');
    var hga = document.getElementById('home-gerente-ambiental-container');
    var hdc = document.getElementById('home-diretor-container');
    
    if (hgc) hgc.style.display = 'none';
    if (hga) hga.style.display = 'none';
    if (hdc) {
        hdc.style.display = 'block';
        if (typeof carregarDashboardDiretor === 'function') carregarDashboardDiretor();
    }
}
window.atualizarHomeDiretor = atualizarHomeDiretor;

// --- FUNÇÃO PARA CARREGAR DASHBOARD DO GERENTE AMBIENTAL ---
async function carregarDashboardGerenteAmbiental() {
    console.log('DEBUG - carregarDashboardGerenteAmbiental chamado');
    
    // Contadores por cargo
    var totalAgronomos = document.getElementById('gerente-amb-total-agronomos');
    var totalCivis = document.getElementById('gerente-amb-total-civis');
    var totalAnalistas = document.getElementById('gerente-amb-total-analistas');
    var totalAuxiliares = document.getElementById('gerente-amb-total-auxiliares');
    var containerLista = document.getElementById('gerente-ambiental-equipe-lista');
    
    try {
        // Buscar membros da equipe ambiental (incluindo Gerente RA)
        var { data: equipe, error } = await supabaseClient
            .from('profiles')
            .select('id, full_name, role, ativo')
            .in('role', ['Engenheiro(a) Agrônomo(a)', 'Engenheiro(a) Civil', 'Analista Ambiental', 
                         'Auxiliar de Serviços II', 'Gerente de Regularização Ambiental',
                         'gerente de regularização ambiental'])
            .eq('ativo', true);
        
        if (error) throw error;
        
        var membros = equipe || [];
        
        // Buscar estatísticas de tarefas para cada membro
        var membrosComStats = await Promise.all(membros.map(async function(m) {
            var { data: tarefas } = await supabaseClient
                .from('tarefas')
                .select('status')
                .eq('criado_por', m.id);
            
            var stats = { total: 0, concluidas: 0, pendentes: 0 };
            if (tarefas) {
                stats.total = tarefas.length;
                stats.concluidas = tarefas.filter(t => t.status === 'concluida').length;
                stats.pendentes = tarefas.filter(t => t.status !== 'concluida').length;
            }
            return { ...m, stats };
        }));
        
        // Contar por cargo
        var countAgronomos = membros.filter(m => m.role && m.role.includes('Agrônomo')).length;
        var countCivis = membros.filter(m => m.role && m.role.includes('Civil')).length;
        var countAnalistas = membros.filter(m => m.role && m.role.includes('Analista')).length;
        var countAuxiliares = membros.filter(m => m.role && m.role.includes('Auxiliar')).length;
        
        // Atualizar contadores
        if (totalAgronomos) totalAgronomos.textContent = countAgronomos;
        if (totalCivis) totalCivis.textContent = countCivis;
        if (totalAnalistas) totalAnalistas.textContent = countAnalistas;
        if (totalAuxiliares) totalAuxiliares.textContent = countAuxiliares;
        
        // Renderizar lista da equipe
        if (containerLista) {
            if (membros.length === 0) {
                containerLista.innerHTML = '<p style="color:#94a3b8; text-align:center; padding: 40px;">Nenhum membro da equipe encontrado.</p>';
            } else {
                var html = '<div style="display:flex; flex-direction:column; gap:8px;">';
                membrosComStats.forEach(function(m) {
                    html += '<div onclick="if(typeof abrirEstatisticasFuncionario === \'function\') abrirEstatisticasFuncionario(\'' + m.id + '\', \'' + (m.full_name || 'Sem nome').replace(/'/g, "\\'") + '\', \'' + (m.role || 'Sem cargo').replace(/'/g, "\\'") + '\'); else mostrarTarefasFuncionario(\'' + m.id + '\', \'' + (m.full_name || 'Sem nome') + '\');" style="cursor:pointer; display:flex; align-items:center; justify-content:space-between; padding:12px 16px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0; transition:all 0.2s;" onmouseover="this.style.background=\'#f1f5f9\'" onmouseout="this.style.background=\'#f8fafc\'">';
                    html += '<div style="display:flex; align-items:center; gap:12px;">';
                    html += '<div style="width:40px; height:40px; background:linear-gradient(135deg, #065f46, #047857); border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-weight:600; font-size:16px;">' + (m.full_name ? m.full_name.charAt(0).toUpperCase() : '?') + '</div>';
                    html += '<div>';
                    html += '<div style="font-weight:600; color:#1e293b; font-size:15px;">' + (m.full_name || 'Sem nome') + '</div>';
                    html += '<div style="font-size:13px; color:#64748b;">' + (m.role || 'Sem cargo') + '</div>';
                    html += '</div>';
                    html += '</div>';
                    // Botão desativar
                    html += '<button onclick="event.stopPropagation(); desativarFuncionarioAmbiental(\'' + m.id + '\')" style="background:#fee2e2; color:#ef4444; border:none; border-radius:6px; padding:6px 12px; font-size:12px; font-weight:600; cursor:pointer;">Desativar</button>';
                    html += '</div>';
                });
                html += '</div>';
                containerLista.innerHTML = html;
            }
        }
        
    } catch (err) {
        console.error('Erro ao carregar dashboard gerente ambiental:', err);
        if (containerLista) {
            containerLista.innerHTML = '<p style="color:#ef4444; text-align:center; padding: 40px;">Erro ao carregar equipe.</p>';
        }
    }
}

// Função para mostrar tarefas de um funcionário específico
async function mostrarTarefasFuncionario(userId, userName) {
    try {
        // Buscar tarefas criadas PELO usuário
        var { data: tarefasCriadas, error: errorCriadas } = await supabaseClient
            .from('tarefas')
            .select('*, tarefa_responsaveis(user_id, user_name)')
            .eq('criado_por', userId);
        
        if (errorCriadas) throw errorCriadas;
        
        // Buscar tarefas onde o usuário é responsável
        var { data: tarefasResponsavel, error: errorResp } = await supabaseClient
            .from('tarefa_responsaveis')
            .select('tarefa_id')
            .eq('user_id', userId);
        
        if (errorResp) throw errorResp;
        
        // Se houver tarefas onde é responsável, buscar detalhes
        var tarefasRespDetalhadas = [];
        if (tarefasResponsavel && tarefasResponsavel.length > 0) {
            var tarefaIds = tarefasResponsavel.map(tr => tr.tarefa_id);
            var { data: tarefasResp } = await supabaseClient
                .from('tarefas')
                .select('*, tarefa_responsaveis(user_id, user_name)')
                .in('id', tarefaIds);
            
            if (tarefasResp) {
                tarefasRespDetalhadas = tarefasResp;
            }
        }
        
        // Combinar e remover duplicatas
        var todasTarefas = [...(tarefasCriadas || [])];
        tarefasRespDetalhadas.forEach(function(t) {
            if (!todasTarefas.some(tc => tc.id === t.id)) {
                todasTarefas.push(t);
            }
        });
        
        // Ordenar por data de criação
        todasTarefas.sort(function(a, b) {
            return new Date(b.created_at) - new Date(a.created_at);
        });
        
        var lista = todasTarefas;
        var concluidas = lista.filter(t => t.status === 'concluida');
        var pendentes = lista.filter(t => t.status !== 'concluida');
        var atrasadas = pendentes.filter(t => t.prazo && new Date(t.prazo) < new Date());
        
        var html = '<div style="max-height:400px; overflow-y:auto;">';
        html += '<div style="display:flex; gap:16px; margin-bottom:16px;">';
        html += '<div style="flex:1; text-align:center; padding:12px; background:#e0f2fe; border-radius:8px;"><div style="font-size:20px; font-weight:700; color:#0284c7;">' + lista.length + '</div><div style="font-size:12px; color:#0369a1;">Total</div></div>';
        html += '<div style="flex:1; text-align:center; padding:12px; background:#dcfce7; border-radius:8px;"><div style="font-size:20px; font-weight:700; color:#16a34a;">' + concluidas.length + '</div><div style="font-size:12px; color:#166534;">Concluídas</div></div>';
        html += '<div style="flex:1; text-align:center; padding:12px; background:#fef3c7; border-radius:8px;"><div style="font-size:20px; font-weight:700; color:#d97706;">' + pendentes.length + '</div><div style="font-size:12px; color:#92400e;">Pendentes</div></div>';
        html += '<div style="flex:1; text-align:center; padding:12px; background:#fee2e2; border-radius:8px;"><div style="font-size:20px; font-weight:700; color:#dc2626;">' + atrasadas.length + '</div><div style="font-size:12px; color:#991b1b;">Atrasadas</div></div>';
        html += '</div>';
        
        if (lista.length === 0) {
            html += '<p style="color:#94a3b8; text-align:center; padding:20px;">Nenhuma tarefa encontrada.</p>';
        } else {
            html += '<div style="display:flex; flex-direction:column; gap:8px;">';
            lista.forEach(function(t) {
                var statusColor = t.status === 'concluida' ? '#10b981' : (t.status === 'em_progresso' ? '#3b82f6' : '#f59e0b');
                var statusLabel = t.status === 'concluida' ? 'Concluída' : (t.status === 'em_progresso' ? 'Em Progresso' : 'Pendente');
                var atrasada = t.prazo && new Date(t.prazo) < new Date() && t.status !== 'concluida';
                
                html += '<div style="padding:12px; background:#f8fafc; border-radius:8px; border-left:4px solid ' + statusColor + ';">';
                html += '<div style="display:flex; justify-content:space-between; align-items:center;">';
                html += '<div style="font-weight:600; color:#1e293b;">' + t.titulo + '</div>';
                html += '<span style="padding:4px 8px; border-radius:12px; font-size:11px; font-weight:600; background:' + statusColor + '20; color:' + statusColor + ';">' + statusLabel + '</span>';
                html += '</div>';
                if (t.prazo) {
                    html += '<div style="font-size:12px; color:' + (atrasada ? '#dc2626' : '#64748b') + '; margin-top:4px;">Prazo: ' + new Date(t.prazo).toLocaleDateString('pt-BR') + (atrasada ? ' (ATRASADA)' : '') + '</div>';
                }
                html += '</div>';
            });
            html += '</div>';
        }
        html += '</div>';
        
        Swal.fire({
            title: 'Tarefas de ' + userName,
            html: html,
            width: '600px',
            showCloseButton: true,
            showConfirmButton: false
        });
    } catch (err) {
        console.error('Erro ao carregar tarefas:', err);
        Swal.fire('Erro', 'Não foi possível carregar as tarefas.', 'error');
    }
}
window.mostrarTarefasFuncionario = mostrarTarefasFuncionario;

// Função para desativar funcionário da equipe ambiental
async function desativarFuncionarioAmbiental(userId) {
    var result = await Swal.fire({
        title: 'Desativar Funcionário?',
        text: 'O funcionário será marcado como inativo e não aparecerá mais na lista.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sim, desativar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#ef4444'
    });
    
    if (!result.isConfirmed) return;
    
    try {
        // Atualiza o role para 'inativo' - conforme política de permissões do Diretor/Secretário
        var { error } = await supabaseClient
            .from('profiles')
            .update({ role: 'inativo', ativo: false })
            .eq('id', userId);
        
        if (error) throw error;
        
        Swal.fire('Sucesso', 'Funcionário desativado com sucesso.', 'success');
        carregarDashboardGerenteAmbiental();
    } catch (err) {
        console.error('Erro ao desativar funcionário:', err);
        Swal.fire('Erro', 'Não foi possível desativar o funcionário. Verifique se você tem permissões.', 'error');
    }
}
window.desativarFuncionarioAmbiental = desativarFuncionarioAmbiental;

// Função para abrir form de novo funcionário (placeholder)
function abrirFormNovoFuncionarioAmbiental() {
    Swal.fire({
        title: 'Novo Funcionário',
        html:
            '<input id="swal-nome" class="swal2-input" placeholder="Nome completo">' +
            '<select id="swal-cargo" class="swal2-select" style="width: 80%; margin-top: 10px; padding: 10px;">' +
            '<option value="">Selecione o cargo...</option>' +
            '<option value="Engenheiro(a) Agrônomo(a)">Engenheiro(a) Agrônomo(a)</option>' +
            '<option value="Engenheiro(a) Civil">Engenheiro(a) Civil</option>' +
            '<option value="Analista Ambiental">Analista Ambiental</option>' +
            '<option value="Auxiliar de Serviços II">Auxiliar de Serviços II</option>' +
            '</select>',
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Adicionar',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            return {
                nome: document.getElementById('swal-nome').value,
                cargo: document.getElementById('swal-cargo').value
            }
        }
    }).then((result) => {
        if (result.isConfirmed) {
            // Aqui você implementaria a criação do usuário
            Swal.fire('Info', 'Funcionalidade de criar usuário será implementada aqui.', 'info');
        }
    });
}
window.abrirFormNovoFuncionarioAmbiental = abrirFormNovoFuncionarioAmbiental;
window.carregarDashboardGerenteAmbiental = carregarDashboardGerenteAmbiental;

// --- LÓGICA DE SECRETÁRIO: TOGGLE DIREÇÃO ---
window.secretarioModoVisualizacao = 'normal'; // 'normal' ou 'direcao'

function fecharDirecaoSecretario() {
    var submenu = document.getElementById('secretario-submenu-direcao');
    var btn = document.getElementById('btn-toggle-direcao');
    var submenuGerencia = document.getElementById('secretario-submenu-gerencia');
    var submenuGerenciaAmbiental = document.getElementById('secretario-submenu-gerencia-ambiental');
    var btnGerenciaAmbiental = document.getElementById('btn-toggle-gerencia-ambiental-secretario');
    
    if (submenu) submenu.style.display = 'none';
    if (submenuGerencia) submenuGerencia.style.display = 'none';
    if (submenuGerenciaAmbiental) submenuGerenciaAmbiental.style.display = 'none';
    if (btn) {
        var svg = btn.querySelector('svg');
        if (svg) svg.innerHTML = '<path d="M12 5v14M5 12h14"></path>';
    }
    if (btnGerenciaAmbiental && btnGerenciaAmbiental.querySelector('svg')) {
        btnGerenciaAmbiental.querySelector('svg').innerHTML = '<path d="M12 5v14M5 12h14"></path>';
    }
    window.secretarioModoVisualizacao = 'normal';
    window.secretarioModoGerencia = false;
}

// Função para ir para Home respeitando o perfil do usuário
function irParaHome() {
    var role = window.userRoleGlobal || '';
    var roleLower = role.toLowerCase();
    
    // Secretário: vai para modo normal (dashboard de diretores)
    if (role === 'Secretário(a)') {
        fecharDirecaoSecretario();
        mudarAba('home');
    }
    // Diretor: vai para modo direcao
    else if (roleLower.includes('diretor')) {
        fecharGerenciaDiretor();
        fecharGerenciaAmbientalDiretor();
        if (typeof configurarModoTarefas === 'function') configurarModoTarefas('direcao');
        mudarAba('home');
    }
    // Gerente de Posturas: vai para modo gerencia_posturas
    else if (roleLower.includes('gerente') && !roleLower.includes('regularizacao') && !roleLower.includes('regularização')) {
        if (typeof configurarModoTarefas === 'function') configurarModoTarefas('gerencia_posturas');
        mudarAba('home');
    }
    // Gerente de Regularização Ambiental: vai para modo gerencia_ambiental
    else if (roleLower.includes('regularizacao') || roleLower.includes('regularização')) {
        if (typeof configurarModoTarefas === 'function') configurarModoTarefas('gerencia_ambiental');
        mudarAba('home');
    }
    // Fiscal e outros: modo normal
    else {
        mudarAba('home');
    }
}
window.irParaHome = irParaHome;

// Toggle Gerência de Posturas para Secretário (sub-submenu)
function toggleGerenciaPosturasSecretario() {
    var submenuGerencia = document.getElementById('secretario-submenu-gerencia');
    var btnGerencia = document.getElementById('btn-toggle-gerencia-secretario');
    var submenuGerenciaAmbiental = document.getElementById('secretario-submenu-gerencia-ambiental');
    var btnGerenciaAmbiental = document.getElementById('btn-toggle-gerencia-ambiental-secretario');

    if (!submenuGerencia) return;

    var estaAberto = submenuGerencia.style.display === 'block';

    if (!estaAberto) {
        // ABRIR - modo gerencia
        // Fechar o submenu de Gerência Ambiental se estiver aberto
        if (submenuGerenciaAmbiental) submenuGerenciaAmbiental.style.display = 'none';
        if (btnGerenciaAmbiental && btnGerenciaAmbiental.querySelector('svg')) {
            btnGerenciaAmbiental.querySelector('svg').innerHTML = '<path d="M12 5v14M5 12h14"></path>';
        }
        
        submenuGerencia.style.display = 'block';
        if (btnGerencia && btnGerencia.querySelector('svg')) {
            btnGerencia.querySelector('svg').innerHTML = '<path d="M18 15l-6-6-6 6"></path>';
        }
        window.secretarioModoVisualizacao = 'direcao';
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
    var submenuGerenciaAmbiental = document.getElementById('secretario-submenu-gerencia-ambiental');
    var btnGerencia = document.getElementById('btn-toggle-gerencia-secretario');
    var btnGerenciaAmbiental = document.getElementById('btn-toggle-gerencia-ambiental-secretario');

    if (!submenu || !btn) return;

    var estaAberto = submenu.style.display === 'block';
    var algumSubmenuAberto = (submenuGerencia && submenuGerencia.style.display === 'block') || 
                              (submenuGerenciaAmbiental && submenuGerenciaAmbiental.style.display === 'block');

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
    } else if (algumSubmenuAberto) {
        // Se algum sub-submenu está aberto, fechar apenas os sub-submenus (não o menu principal)
        // Isso requer um segundo clique para fechar o menu principal
        if (submenuGerencia) submenuGerencia.style.display = 'none';
        if (submenuGerenciaAmbiental) submenuGerenciaAmbiental.style.display = 'none';
        if (btnGerencia && btnGerencia.querySelector('svg')) {
            btnGerencia.querySelector('svg').innerHTML = '<path d="M12 5v14M5 12h14"></path>';
        }
        if (btnGerenciaAmbiental && btnGerenciaAmbiental.querySelector('svg')) {
            btnGerenciaAmbiental.querySelector('svg').innerHTML = '<path d="M12 5v14M5 12h14"></path>';
        }
        window.secretarioModoGerencia = false;
        window.secretarioModoVisualizacao = 'direcao';
        // Mantém o modo direcao (home do diretor)
        if (typeof configurarModoTarefas === 'function') configurarModoTarefas('direcao');
        mudarAba('home');
    } else {
        // FECHAR - volta para modo normal (gestao de diretores)
        // Fechar também os sub-submenus de gerencia
        if (submenuGerencia) submenuGerencia.style.display = 'none';
        if (submenuGerenciaAmbiental) submenuGerenciaAmbiental.style.display = 'none';
        window.secretarioModoGerencia = false;
        fecharDirecaoSecretario();
        mudarAba('home');
    }
}
window.toggleDirecaoMeioAmbiente = toggleDirecaoMeioAmbiente;
window.fecharDirecaoSecretario = fecharDirecaoSecretario;

// --- LÓGICA DE SECRETÁRIO: TOGGLE GERENCIA REGULARIZAÇÃO AMBIENTAL ---
function fecharGerenciaAmbientalSecretario() {
    var submenu = document.getElementById('secretario-submenu-gerencia-ambiental');
    var btn = document.getElementById('btn-toggle-gerencia-ambiental-secretario');
    if (submenu) submenu.style.display = 'none';
    if (btn) {
        var svg = btn.querySelector('svg');
        if (svg) svg.innerHTML = '<path d="M12 5v14M5 12h14"></path>';
    }
    // Atualiza para modo direção
    window.secretarioModoVisualizacao = 'direcao';
    if (typeof configurarModoTarefas === 'function') configurarModoTarefas('direcao');
}

// Toggle Gerência de Regularização Ambiental para Secretário (sub-submenu)
function toggleGerenciaAmbientalSecretario() {
    var submenu = document.getElementById('secretario-submenu-gerencia-ambiental');
    var btn = document.getElementById('btn-toggle-gerencia-ambiental-secretario');
    var submenuGerencia = document.getElementById('secretario-submenu-gerencia');
    
    if (!submenu) return;
    
    var estaAberto = submenu.style.display === 'block';
    
    if (!estaAberto) {
        // ABRIR - modo gerencia ambiental
        // Fechar o outro submenu (Gerência de Posturas) se estiver aberto
        if (submenuGerencia) submenuGerencia.style.display = 'none';
        var btnGerencia = document.getElementById('btn-toggle-gerencia-secretario');
        if (btnGerencia && btnGerencia.querySelector('svg')) {
            btnGerencia.querySelector('svg').innerHTML = '<path d="M12 5v14M5 12h14"></path>';
        }
        window.secretarioModoGerencia = false;
        
        submenu.style.display = 'block';
        if (btn && btn.querySelector('svg')) {
            btn.querySelector('svg').innerHTML = '<path d="M18 15l-6-6-6 6"></path>';
        }
        
        // Configurar modo e ir para home
        window.secretarioModoVisualizacao = 'gerencia_ambiental';
        if (typeof configurarModoTarefas === 'function') configurarModoTarefas('gerencia_ambiental');
        mudarAba('home');
    } else {
        // FECHAR
        fecharGerenciaAmbientalSecretario();
        mudarAba('home');
    }
}
window.toggleGerenciaAmbientalSecretario = toggleGerenciaAmbientalSecretario;
window.fecharGerenciaAmbientalSecretario = fecharGerenciaAmbientalSecretario;

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

    const isGerencial = (userRole || '').toLowerCase().includes('gerente');

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
