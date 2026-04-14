// tarefas.js — Módulo de Tarefas e Calendário
// Usa supabaseClient do protecao.js

var calendarioMesAtual = new Date().getMonth();
var calendarioAnoAtual = new Date().getFullYear();
var eventosMesCache = [];
var tarefasCache = [];
var subtarefasCache = {};
var userRoleGlobal = '';
var userIdGlobal = '';
var ehGerenteKanban = false;
var _abrindoDetalhe = false;
var diretorModoVisualizacao = 'direcao'; // 'direcao', 'gerencia_posturas' ou 'gerencia_ambiental'
var carregandoTarefas = false;
var idsGerentesGlobal = []; // Gerentes de Posturas
var idsFiscaisPosturasGlobal = [];
var idsGerentesAmbientalGlobal = []; // Gerentes de Regularização Ambiental
var idsEquipeAmbientalGlobal = []; // Toda a equipe técnica (RA)
var idsDiretoresGlobal = [];
var idsEquipeCAGlobal = []; // Toda a equipe de Cuidado Animal
var idsGerentesCAGlobal = [];
var idsCuidadoAnimalGlobal = []; // Coordenadores/Equipe básica
var idsJuridicoGlobal = [];
var idsRHGlobal = [];
var moduloIniciado = false;
var inicializacaoPromise = null;

// Calendário de Tarefas
var dataCalendarioTarefasAtual = new Date();
var dataFiltroTarefasSelecionada = null;

// ==========================================
// INICIALIZAÇÃO
// ==========================================
async function carregarModuloTarefas() {
    if (moduloIniciado) {
        carregarTarefas();
        return;
    }
    if (inicializacaoPromise) return inicializacaoPromise;

    inicializacaoPromise = (async () => {
        try {
            var authResult = await getAuthUser();
            var user = authResult.data.user;
            if (user) {
                userIdGlobal = user.id;
                var { data: perfil } = await supabaseClient.from('profiles').select('role').eq('id', user.id).maybeSingle();
                userRoleGlobal = perfil ? perfil.role : '';
            }

            // Ocultar sub-abas para Fiscais e equipe do Gerente de Regularização Ambiental
            var btnTabAtribuidas = document.getElementById('btn-tab-atribuidas');
            if (btnTabAtribuidas && btnTabAtribuidas.parentElement) {
                var roleLowerRaw = (userRoleGlobal || '').toLowerCase();
                var isFiscal = roleLowerRaw.includes('fiscal');
                var isAdminPostura = (roleLowerRaw.includes('administrativo') || roleLowerRaw.includes('administrador')) && roleLowerRaw.includes('postura');
                // Novos cargos que não podem criar/editar tarefas
                var isEquipeAmbiental = roleLowerRaw.includes('engenheiro') || 
                                        roleLowerRaw.includes('agrônomo') || 
                                        roleLowerRaw.includes('agronomo') ||
                                        roleLowerRaw.includes('analista ambiental') ||
                                        roleLowerRaw.includes('auxiliar de serviços');
                if (isFiscal || isAdminPostura || isEquipeAmbiental) {
                    btnTabAtribuidas.parentElement.style.display = 'none';
                } else {
                    btnTabAtribuidas.parentElement.style.display = 'flex';
                }
            }

            // Botão de Novo Evento apenas para DIRETOR e SECRETÁRIO
            var btnNovoEvento = document.getElementById('btn-novo-evento-diretor');
            var btnNovaTarefa = document.getElementById('btn-nova-tarefa');
            var roleLowerRaw = (userRoleGlobal || '').toLowerCase();
            // Verificação flexível para Diretor (qualquer variação)
            var ehDiretor = roleLowerRaw.includes('diretor');
            var ehSecretario = (userRoleGlobal === 'Secretário(a)' || userRoleGlobal === 'Secretário(a) do Secretário(a)');
            // Gerentes podem criar tarefas, mas não projetos/eventos
            var ehGerente = roleLowerRaw.includes('gerente');

            if (btnNovoEvento) {
                btnNovoEvento.style.display = (ehDiretor || ehSecretario) ? 'block' : 'none';
            }
            if (btnNovaTarefa) {
                btnNovaTarefa.style.display = (ehDiretor || ehSecretario || ehGerente) ? 'block' : 'none';
            }

            // Mapear IDs para filtros hierárquicos via normalização
            try {
                var { data: profiles } = await supabaseClient.from('profiles').select('id, role');
                if (profiles) {
                    var normalizeStr = function(str) {
                        return (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    };

                    // Equipe Cuidado Animal
                    idsEquipeCAGlobal = profiles.filter(p => normalizeStr(p.role).includes('cuidado animal')).map(p => p.id);
                    idsGerentesCAGlobal = profiles.filter(p => {
                        var n = normalizeStr(p.role);
                        return n.includes('gerente') && n.includes('cuidado animal');
                    }).map(p => p.id);
                    idsCuidadoAnimalGlobal = profiles.filter(p => {
                        var n = normalizeStr(p.role);
                        return n.includes('cuidado animal') && !n.includes('gerente') && !n.includes('diretor');
                    }).map(p => p.id);

                    // Equipe Ambiental (RA)
                    idsEquipeAmbientalGlobal = profiles.filter(p => {
                        var n = normalizeStr(p.role);
                        return n.includes('regularizacao') || n.includes('regularização') || 
                               n.includes('engenheiro') || n.includes('agronomo') || 
                               n.includes('analista ambiental') || n.includes('auxiliar de servicos');
                    }).map(p => p.id);
                    
                    idsGerentesAmbientalGlobal = profiles.filter(p => {
                        var n = normalizeStr(p.role);
                        return n.includes('gerente') && (n.includes('regularizacao') || n.includes('regularização'));
                    }).map(p => p.id);

                    // Posturas
                    idsGerentesGlobal = profiles.filter(p => {
                        var n = normalizeStr(p.role);
                        if (n.includes('regularizacao') || n.includes('regularização') || n.includes('cuidado animal') || n.includes('juridica') || n.includes('administracao')) return false;
                        return n.includes('gerente') || n.includes('administrativo') || n.includes('administrador');
                    }).map(p => p.id);

                    idsFiscaisPosturasGlobal = profiles.filter(p => {
                        var n = normalizeStr(p.role);
                        return n.includes('fiscal') && !n.includes('gerente') && !n.includes('diretor');
                    }).map(p => p.id);

                    // Outros
                    idsJuridicoGlobal = profiles.filter(p => normalizeStr(p.role).includes('juridica')).map(p => p.id);
                    idsRHGlobal = profiles.filter(p => normalizeStr(p.role).includes('administracao')).map(p => p.id);
                    
                    idsDiretoresGlobal = profiles.filter(p => {
                        var n = normalizeStr(p.role);
                        return n.includes('diretor') && !n.includes('cuidado animal');
                    }).map(p => p.id);

                    console.log('[Tarefas] IDs Mapeados:', {
                        CA: idsEquipeCAGlobal.length,
                        Ambiental: idsEquipeAmbientalGlobal.length,
                        Diretores: idsDiretoresGlobal.length,
                        GerentesPosturas: idsGerentesGlobal.length,
                        FiscaisPosturas: idsFiscaisPosturasGlobal.length
                    });
                }
            } catch (e) {
                console.error("Erro ao mapear cargos globais:", e);
            }

            moduloIniciado = true;
            if (typeof renderizarCalendario === 'function') renderizarCalendario();
            carregarEventos();
            if (typeof carregarTarefas === 'function') carregarTarefas();
            if (typeof carregarMinhasTarefasHome === 'function') carregarMinhasTarefasHome();
        } catch (err) {
            console.error("Erro na inicialização do módulo:", err);
        } finally {
            inicializacaoPromise = null;
        }
    })();
    return inicializacaoPromise;
}

// ==========================================
// CALENDÁRIO MENSAL
// ==========================================

// ==========================================
// EVENTOS
// ==========================================
async function carregarEventos() {
    var containerCards = document.getElementById('lista-eventos-container');
    if (!containerCards) return;

    try {
        // Buscar todos os eventos com tarefas e responsáveis
        // A filtragem para gerentes será feita no lado do cliente
        var { data, error } = await supabaseClient
            .from('eventos')
            .select(`
                *,
                responsavel:profiles!responsavel_id(full_name),
                tarefas:tarefas!evento_id(
                    *,
                    tarefa_responsaveis(
                        user_id,
                        profiles(full_name)
                    )
                )
            `)
            .order('data_inicio', { ascending: true });

        if (error) throw error;

        var todosEventos = data || [];

        // Filtrar eventos baseado no perfil do usuário
        var roleLower = (userRoleGlobal || '').toLowerCase();
        var ehDiretor = roleLower.includes('diretor');
        var ehFiscal = (userRoleGlobal === 'Fiscal' || userRoleGlobal === 'fiscal' || 
                        roleLower.includes('fiscal') && roleLower.includes('postura'));
        var roleLowerRaw = (userRoleGlobal || '').toLowerCase();
        var roleLowerNormFilter = roleLowerRaw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        var isCargoEspecial = (roleLowerNormFilter.includes('agente') && roleLowerNormFilter.includes('administracao')) || 
                              (roleLowerNormFilter.includes('gerente') && roleLowerNormFilter.includes('interface') && roleLowerNormFilter.includes('juridica'));

        var ehGerente = (roleLowerRaw.includes('gerente') || roleLowerRaw === 'administrativo' || 
                         roleLowerRaw.includes('administrativo') && roleLowerRaw.includes('postura') ||
                         roleLowerRaw.includes('administrador') && roleLowerRaw.includes('postura') ||
                         isCargoEspecial);

        // Determinar IDs de interesse baseado no modo
        var idsInteresse = [userIdGlobal];
        var isModoEspecialSecretario = false;

        if (roleLower.includes('secretario') || roleLower.includes('secretário')) {
            if (window.secretarioModoVisualizacao === 'juridico') {
                idsInteresse = (idsJuridicoGlobal && idsJuridicoGlobal.length > 0) ? idsJuridicoGlobal : [userIdGlobal];
                isModoEspecialSecretario = true;
            } else if (window.secretarioModoVisualizacao === 'recursos_humanos') {
                idsInteresse = (idsRHGlobal && idsRHGlobal.length > 0) ? idsRHGlobal : [userIdGlobal];
                isModoEspecialSecretario = true;
            } else if (window.secretarioModoVisualizacao === 'cuidado_animal') {
                idsInteresse = (idsCuidadoAnimalGlobal && idsCuidadoAnimalGlobal.length > 0) ? idsCuidadoAnimalGlobal : [userIdGlobal];
                isModoEspecialSecretario = true;
            } else if (window.secretarioModoVisualizacao === 'direcao' || !window.secretarioModoVisualizacao || window.secretarioModoVisualizacao === 'normal') {
                // Modo Direção/Normal: Vê tudo
                eventosMesCache = todosEventos;
            } else {
                // Outros modos do secretário (ex: gerencia_ambiental) - Vê tudo por padrão ou podemos filtrar se necessário
                eventosMesCache = todosEventos;
            }
        }

        if (ehDiretor || ehFiscal || (roleLower.includes('secretario') && !isModoEspecialSecretario)) {
            // Diretor, Fiscal e Secretário (em modo normal) veem todos os eventos
            if (!isModoEspecialSecretario) eventosMesCache = todosEventos;
        } else if (ehGerente || isModoEspecialSecretario) {
            // Gerentes e Secretário em modo especial veem apenas eventos onde:
            // 1. Um dos IDs de interesse é o responsável direto do evento, OU
            // 2. Um dos IDs de interesse é responsável por pelo menos uma tarefa vinculada
            eventosMesCache = todosEventos.filter(function (ev) {
                // Verifica se algum ID de interesse é responsável direto do evento
                if (idsInteresse.indexOf(ev.responsavel_id) !== -1) {
                    return true;
                }

                // Verifica se algum ID de interesse é responsável por alguma tarefa vinculada
                if (ev.tarefas && ev.tarefas.length > 0) {
                    for (var i = 0; i < ev.tarefas.length; i++) {
                        var tarefa = ev.tarefas[i];
                        if (tarefa.tarefa_responsaveis && tarefa.tarefa_responsaveis.length > 0) {
                            for (var j = 0; j < tarefa.tarefa_responsaveis.length; j++) {
                                if (idsInteresse.indexOf(tarefa.tarefa_responsaveis[j].user_id) !== -1) {
                                    return true;
                                }
                            }
                        }
                    }
                }

                return false;
            });
        } else {
            // Comportamento padrão: vê tudo
            eventosMesCache = todosEventos;
        }
        if (typeof renderizarCalendario === 'function') renderizarCalendario();

        var hojeStr = new Date().toISOString().substring(0, 10);
        var eventosParaExibir = [];

        if (window.dataFiltroSelecionada) {
            // Filtrar apenas eventos que ocorrem no dia selecionado
            eventosParaExibir = eventosMesCache.filter(ev => {
                if (!ev.data_inicio) return false;
                var inicio = ev.data_inicio.substring(0, 10);
                var fim = ev.data_fim ? ev.data_fim.substring(0, 10) : inicio;
                return window.dataFiltroSelecionada >= inicio && window.dataFiltroSelecionada <= fim;
            });
        } else {
            // Mostrar todos, exceto os que já passaram (considerando data_fim se houver)
            eventosParaExibir = eventosMesCache.filter(ev => {
                if (!ev.data_inicio) return false;
                var fim = ev.data_fim ? ev.data_fim.substring(0, 10) : ev.data_inicio.substring(0, 10);
                return fim >= hojeStr;
            });
        }

        if (eventosParaExibir.length === 0) {
            var msg = window.dataFiltroSelecionada ? 'Nenhum evento neste dia.' : 'Nenhum evento futuro cadastrado.';
            var emptyHtml = '<div style="text-align:center; color:#94a3b8; padding:40px; font-size:1rem;">' + msg + '</div>';
            if (containerCards) containerCards.innerHTML = emptyHtml;
            
            var homeContainerCards = document.getElementById('home-lista-eventos-container');
            if (homeContainerCards) homeContainerCards.innerHTML = emptyHtml;
        } else {
            var htmlCards = '';
            eventosParaExibir.forEach(function (ev) {
                var dataObj = new Date(ev.data_inicio);
                var diaNum = dataObj.getDate();
                var mesAbrev = dataObj.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '');

                var dataFimObj = ev.data_fim ? new Date(ev.data_fim) : null;
                var diasExibicao = diaNum;
                if (dataFimObj && dataFimObj.getDate() !== diaNum) {
                    diasExibicao = diaNum + '/' + dataFimObj.getDate();
                }

                var corBase = ev.cor || '#3b82f6';
                var statusObj = calcularStatusEvento(ev);

                // Agregar responsáveis de todas as tarefas vinculadas
                var nomesResponsaveis = new Set();
                if (ev.tarefas && ev.tarefas.length > 0) {
                    ev.tarefas.forEach(function (t) {
                        if (t.tarefa_responsaveis && t.tarefa_responsaveis.length > 0) {
                            t.tarefa_responsaveis.forEach(function (tr) {
                                if (tr.profiles && tr.profiles.full_name) {
                                    nomesResponsaveis.add(tr.profiles.full_name);
                                }
                            });
                        }
                    });
                }

                var resp = nomesResponsaveis.size > 0
                    ? Array.from(nomesResponsaveis).join(', ')
                    : (ev.responsavel ? ev.responsavel.full_name : 'Não atribuído');

                // Wrapper para card + detalhe
                htmlCards += '<div style="margin-bottom: 20px;">';

                // Card Principal
                htmlCards += '<div onclick="toggleDetalheEventoCard(\'' + ev.id + '\')" style="background: white; border-radius: 12px; display: flex; box-shadow: 0 4px 15px rgba(0,0,0,0.06); overflow: hidden; position: relative; border: 1px solid #f1f5f9; transition: all 0.2s; cursor: pointer;" onmouseover="this.style.transform=\'translateY(-2px)\'; this.style.borderColor=\'' + corBase + '44\'" onmouseout="this.style.transform=\'none\'; this.style.borderColor=\'#f1f5f9\'">';

                // Lado Esquerdo: Data Colorida
                htmlCards += '<div style="background:' + corBase + '; width: 80px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; padding: 10px; flex-shrink: 0;">';
                htmlCards += '<span style="font-size: 1.8rem; font-weight: 800; line-height: 1;">' + diasExibicao + '</span>';
                htmlCards += '<span style="font-size: 0.8rem; font-weight: 600; text-transform: uppercase;">' + mesAbrev + '</span>';
                htmlCards += '<div style="position: absolute; left: 80px; top: 50%; transform: translateY(-50%); width: 0; height: 0; border-top: 10px solid transparent; border-bottom: 10px solid transparent; border-left: 10px solid ' + corBase + ';"></div>';
                htmlCards += '</div>';

                // Centro: Informações
                htmlCards += '<div style="flex: 1; padding: 15px 25px; display: flex; flex-direction: column; justify-content: center; gap: 4px; min-width: 0;">';
                htmlCards += '<div style="display: flex; justify-content: space-between; align-items: flex-start;">';
                htmlCards += '<h3 style="margin: 0; color: #1e293b; font-size: 1.1rem; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">' + ev.titulo + '</h3>';
                htmlCards += '<svg id="seta-card-' + ev.id + '" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2.5" style="transition:0.3s;"><path d="M6 9l6 6 6-6"/></svg>';
                htmlCards += '</div>';
                htmlCards += '<div style="display: flex; align-items: center; gap: 8px; color: #64748b; font-size: 0.85rem;">';
                htmlCards += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
                htmlCards += 'Prazo: ' + (dataFimObj ? dataFimObj.toLocaleDateString('pt-BR') : dataObj.toLocaleDateString('pt-BR'));
                htmlCards += statusObj.badge;
                htmlCards += '</div>';
                htmlCards += '<div style="color: #94a3b8; font-size: 0.8rem; font-style: italic;">Resp: ' + resp + '</div>';
                htmlCards += '</div>';

                // Lado Direito: Barra Lateral de Status Vertical
                htmlCards += '<div style="background:' + corBase + '22; width: 40px; display: flex; align-items: center; justify-content: center; border-left: 1px solid ' + corBase + '22; flex-shrink: 0;">';
                htmlCards += '<span style="writing-mode: vertical-rl; transform: rotate(180deg); color: ' + corBase + '; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">' + statusObj.text + '</span>';
                htmlCards += '</div>';

                htmlCards += '</div>'; // Fecha Card Principal

                // Área de Detalhes (Oculta)
                htmlCards += '<div id="detalhe-evento-card-' + ev.id + '" style="display:none; background:#fcfdfe; border: 1px solid #f1f5f9; border-top:none; border-radius: 0 0 12px 12px; padding: 25px; margin-top: -5px; box-shadow: inset 0 2px 10px rgba(0,0,0,0.02);">';
                htmlCards += renderizarConteudoExpandidoEvento(ev);
                htmlCards += '</div>';

                htmlCards += '</div>'; // Fecha Wrapper
            });
            if (containerCards) containerCards.innerHTML = htmlCards;
            
            var homeContainerCards = document.getElementById('home-lista-eventos-container');
            if (homeContainerCards) homeContainerCards.innerHTML = htmlCards;
        }

    } catch (err) {
        console.error(err);
    }
}

function calcularStatusEvento(ev) {
    var hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    var dataInicio = new Date(ev.data_inicio);
    dataInicio.setHours(0, 0, 0, 0);

    var dataFim = ev.data_fim ? new Date(ev.data_fim) : dataInicio;
    dataFim.setHours(23, 59, 59, 999);

    if (hoje > dataFim) {
        return { text: 'Concluído', badge: '<span style="background:#dcfce7; color:#166534; padding:2px 8px; border-radius:10px; font-size:0.7rem; font-weight:700; text-transform:uppercase; margin-left:8px;">Concluído</span>' };
    }

    if (hoje >= dataInicio && hoje <= dataFim) {
        return { text: 'Em Progresso', badge: '<span style="background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:10px; font-size:0.7rem; font-weight:700; text-transform:uppercase; margin-left:8px;">Em Progresso</span>' };
    }

    return { text: 'Pendente', badge: '<span style="background:#f1f5f9; color:#64748b; padding:2px 8px; border-radius:10px; font-size:0.7rem; font-weight:700; text-transform:uppercase; margin-left:8px;">Pendente</span>' };
}

function toggleDetalheEventoCard(id) {
    var el = document.getElementById('detalhe-evento-card-' + id);
    var seta = document.getElementById('seta-card-' + id);
    if (!el) return;

    var estaVisivel = el.style.display === 'block';

    // Fecha todos os outros primeiro para um efeito sanfona (opcional, mas elegante)
    // document.querySelectorAll('[id^="detalhe-evento-card-"]').forEach(d => d.style.display = 'none');
    // document.querySelectorAll('[id^="seta-card-"]').forEach(s => s.style.transform = 'none');

    if (estaVisivel) {
        el.style.display = 'none';
        if (seta) seta.style.transform = 'none';
    } else {
        el.style.display = 'block';
        if (seta) seta.style.transform = 'rotate(180deg)';
    }
}

function renderizarConteudoExpandidoEvento(ev) {
    var html = '<div style="display:grid; grid-template-columns: 1fr 1fr; gap:30px;">';

    // Lado 1: Detalhes do Evento
    html += '<div>';
    html += '<h4 style="margin:0 0 10px 0; color:#1e293b; font-size:0.95rem;">Descrição do Projeto</h4>';
    html += '<p style="margin:0; color:#64748b; font-size:0.9rem; line-height:1.5;">' + (ev.descricao || 'Sem descrição detalhada.') + '</p>';

    html += '<h4 style="margin:20px 0 10px 0; color:#1e293b; font-size:0.95rem;">Documentos</h4>';
    html += '<div id="anexos-evento-' + ev.id + '" style="display:flex; flex-wrap:wrap; gap:8px;">';
    html += '<span style="color:#94a3b8; font-size:0.85rem;">Carregando anexos...</span>';
    html += '</div>';
    html += '</div>';

    // Lado 2: Lista de Tarefas Vinculadas
    html += '<div>';
    html += '<h4 style="margin:0 0 10px 0; color:#1e293b; font-size:0.95rem;">Tarefas e Acompanhamento</h4>';

    var tarefas = ev.tarefas || [];
    if (tarefas.length > 0) {
        tarefas.forEach(function (tarefa) {
            html += '<div style="background:white; padding:15px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:12px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">';
            html += '<div style="display:flex; justify-content:space-between; margin-bottom:5px;">';
            html += '<span style="font-weight:700; color:#334155; font-size:0.9rem;">' + tarefa.titulo + '</span>';
            html += '<span style="color:#64748b; font-size:0.85rem; font-weight:600;">' + (tarefa.progresso || 0) + '%</span>';
            html += '</div>';

            html += '<div style="width:100%; background:#f1f5f9; border-radius:4px; height:6px; overflow:hidden; margin-bottom:10px;">';
            html += '<div style="width:' + (tarefa.progresso || 0) + '%; background:#10b981; height:100%;"></div>';
            html += '</div>';

            html += '<div style="display:flex; justify-content:space-between; align-items:center;">';
            html += '<span style="font-size:0.75rem; color:#94a3b8;">Ref: #' + (tarefa.id.substring(0, 6)) + '</span>';
            html += '<button onclick="abrirDetalheTarefa(\'' + tarefa.id + '\')" style="padding:5px 10px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; cursor:pointer; color:#0c3e2b; font-weight:700; font-size:0.75rem; transition:0.2s;" onmouseover="this.style.background=\'#edf2f7\'" onmouseout="this.style.background=\'#f8fafc\'">Acessar Kanban</button>';
            html += '</div>';
            html += '</div>';
        });
    } else {
        html += '<p style="color:#94a3b8; font-size:0.85rem;">Nenhuma tarefa vinculada a este projeto.</p>';
    }
    html += '</div>';

    // Controles Administrativos
    var roleLower = (userRoleGlobal || '').toLowerCase();
    var ehDiretor = roleLower.includes('diretor');
    var ehSecretario = (userRoleGlobal === 'Secretário(a)' || userRoleGlobal === 'Secretário(a) do Secretário(a)');
    // Apenas Diretor e Secretário podem editar/excluir eventos e inserir tarefas em projetos
    var podeEditarEvento = ehDiretor || ehSecretario;
    
    if (podeEditarEvento) {
        html += '<div style="grid-column: span 2; display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #f1f5f9;">';
        html += '<button onclick="abrirModalNovaTarefa(false, \'' + ev.id + '\')" style="background: #f8fafc; color: #475569; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 18px; font-size: 0.9rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.2s;" onmouseover="this.style.background=\'#f1f5f9\'" onmouseout="this.style.background=\'#f8fafc\'"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Inserir Tarefa</button>';
        html += '<button onclick="abrirModalEditarEvento(\'' + ev.id + '\')" style="background: white; color: #3b82f6; border: 1px solid #3b82f6; border-radius: 8px; padding: 10px 18px; font-size: 0.9rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.2s;" onmouseover="this.style.background=\'#eff6ff\'" onmouseout="this.style.background=\'white\'"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Editar Projeto</button>';
        html += '<button onclick="excluirEvento(\'' + ev.id + '\')" style="background: white; color: #ef4444; border: 1px solid #ef4444; border-radius: 8px; padding: 10px 18px; font-size: 0.9rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.2s;" onmouseover="this.style.background=\'#fef2f2\'" onmouseout="this.style.background=\'white\'"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Excluir</button>';
        html += '</div>';
    }
    html += '</div>';

    setTimeout(function () { carregarAnexosEvento(ev.id); }, 100);
    return html;
}

async function carregarAnexosEvento(eventoId) {
    var container = document.getElementById('anexos-evento-' + eventoId);
    if (!container) return;
    try {
        var { data, error } = await supabaseClient.from('evento_anexos').select('*').eq('evento_id', eventoId);
        if (error) throw error;
        if (!data || data.length === 0) {
            container.innerHTML = '<span style="color:#94a3b8; font-size:0.85rem;">Nenhum anexo enviado.</span>';
            return;
        }
        var html = '';
        data.forEach(function (anexo) {
            html += '<a href="' + anexo.url + '" target="_blank" style="display:flex; align-items:center; gap:5px; background:white; border:1px solid #e2e8f0; padding:5px 10px; border-radius:6px; color:#334155; text-decoration:none; font-size:0.85rem;">';
            html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>';
            html += anexo.nome_arquivo + '</a>';
        });
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = '<span style="color:#ef4444; font-size:0.85rem;">Erro ao carregar.</span>';
    }
}

function abrirModalNovoEvento() {
    // Verificação de segurança: apenas Diretor e Secretário podem criar eventos
    var roleLowerRaw = (userRoleGlobal || '').toLowerCase();
    var ehDiretor = roleLowerRaw.includes('diretor');
    var ehSecretario = (userRoleGlobal === 'Secretário(a)' || userRoleGlobal === 'Secretário(a) do Secretário(a)');
    if (!ehDiretor && !ehSecretario) {
        Swal.fire('Acesso Negado', 'Apenas o Diretor ou Secretário(a) podem criar eventos.', 'error');
        return;
    }
    
    var html = '<div class="modal-overlay ativo" id="modal-novo-evento" onclick="if(event.target===this)fecharModal(\'modal-novo-evento\')">';
    html += '<div class="modal-container" style="max-width:460px;">';
    html += '<div class="modal-header"><h2>Novo Evento</h2>';
    html += '<button class="modal-close" onclick="fecharModal(\'modal-novo-evento\')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
    html += '</div><div class="modal-body">';
    html += '<div class="campo-grupo"><label>Título</label><input type="text" id="evento-titulo" placeholder="Nome do evento"></div>';
    html += '<div class="campo-grupo"><label>Descrição</label><textarea id="evento-descricao" rows="2" placeholder="Detalhes (opcional)"></textarea></div>';
    html += '<div class="campo-grupo"><label>Data</label><input type="date" id="evento-data"></div>';
    html += '<div class="campo-grupo"><label>Cor</label><select id="evento-cor" style="padding:10px;">';
    html += '<option value="#3b82f6">Azul</option><option value="#10b981">Verde</option><option value="#f59e0b">Amarelo</option><option value="#ef4444">Vermelho</option><option value="#8b5cf6">Roxo</option>';
    html += '</select></div>';
    html += '</div><div class="modal-footer"><button class="btn-cancelar" onclick="fecharModal(\'modal-novo-evento\')">Cancelar</button>';
    html += '<button class="btn-salvar" onclick="salvarEvento()">Salvar Evento</button></div></div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
}

async function salvarEvento() {
    // Verificação de segurança: apenas Diretor e Secretário podem criar eventos
    var roleLowerRaw = (userRoleGlobal || '').toLowerCase();
    var ehDiretor = roleLowerRaw.includes('diretor');
    var ehSecretario = (userRoleGlobal === 'Secretário(a)' || userRoleGlobal === 'Secretário(a) do Secretário(a)');
    if (!ehDiretor && !ehSecretario) {
        Swal.fire('Acesso Negado', 'Apenas o Diretor ou Secretário(a) podem criar eventos.', 'error');
        return;
    }
    
    var titulo = document.getElementById('evento-titulo').value.trim();
    var descricao = document.getElementById('evento-descricao').value.trim();
    var data = document.getElementById('evento-data').value;
    var cor = document.getElementById('evento-cor').value;

    if (!titulo || !data) { alert('Preencha título e data.'); return; }

    try {
        var { error } = await supabaseClient.from('eventos').insert({
            titulo: titulo,
            descricao: descricao,
            data_inicio: data + 'T00:00:00',
            cor: cor,
            criado_por: userIdGlobal
        });
        if (error) throw error;
        fecharModal('modal-novo-evento');
        carregarEventos();
    } catch (err) {
        alert('Erro ao salvar evento: ' + err.message);
    }
}

async function excluirEvento(id) {
    var roleLower = (userRoleGlobal || '').toLowerCase();
    var ehDiretor = roleLower.includes('diretor');
    var ehSecretario = (userRoleGlobal === 'Secretário(a)' || userRoleGlobal === 'Secretário(a) do Secretário(a)');
    
    // Apenas Diretor e Secretário podem excluir eventos
    if (!ehDiretor && !ehSecretario) {
        Swal.fire('Acesso Negado', 'Apenas o Diretor ou Secretário(a) podem excluir eventos.', 'error'); 
        return; 
    }

    if (!confirm('Excluir este evento e todas as tarefas vinculadas?')) return;
    try {
        await supabaseClient.from('eventos').delete().eq('id', id);
        carregarEventos();
    } catch (err) { alert('Erro: ' + err.message); }
}

// ==========================================
// TAREFAS — KANBAN (3 COLUNAS)
// ==========================================

function tarefaVisivelParaUsuario(t) {
    var ehCriador = t.criado_por === userIdGlobal;
    var ehResponsavel = (t._respUserIds && t._respUserIds.indexOf(userIdGlobal) !== -1) || t._ehMinhaViaSub;
    var roleFiltro = (userRoleGlobal || '').toLowerCase();
    var isDiretor = roleFiltro.includes('diretor');
    var isSecretario = userRoleGlobal === 'Secretário(a)' || userRoleGlobal === 'Secretário(a) do Secretário(a)';

    var vinculadaAoGrupo = function(task, idSet) {
        if (!idSet || idSet.length === 0) return false;
        if (idSet.indexOf(task.criado_por) !== -1) return true;
        if (!task._respUserIds) return false;
        return task._respUserIds.some(function(uid) { return idSet.indexOf(uid) !== -1; });
    };

    if (isSecretario) {
        var secMode = window.secretarioModoVisualizacao || 'normal';
        if (secMode === 'normal') {
            return ehCriador || ehResponsavel;
        } else if (secMode === 'direcao') {
            if (window.secretarioModoGerencia) {
                var idsPosturasSec = idsGerentesGlobal.concat(idsFiscaisPosturasGlobal);
                return vinculadaAoGrupo(t, idsPosturasSec) || (ehCriador && t._respUserIds.some(function(uid) { return idsPosturasSec.indexOf(uid) !== -1; }));
            } else {
                return vinculadaAoGrupo(t, idsDiretoresGlobal) || (ehCriador && t._respUserIds.some(function(uid) { return idsDiretoresGlobal.indexOf(uid) !== -1; }));
            }
        } else if (secMode === 'gerencia_ambiental') {
            return vinculadaAoGrupo(t, idsEquipeAmbientalGlobal) || (ehCriador && t._respUserIds.some(function(uid) { return idsEquipeAmbientalGlobal.indexOf(uid) !== -1; }));
        } else if (secMode === 'cuidado_animal') {
            return vinculadaAoGrupo(t, idsEquipeCAGlobal) || (ehCriador && t._respUserIds.some(function(uid) { return idsEquipeCAGlobal.indexOf(uid) !== -1; }));
        } else if (secMode === 'juridico') {
            return vinculadaAoGrupo(t, idsJuridicoGlobal) || (ehCriador && t._respUserIds.some(function(uid) { return idsJuridicoGlobal.indexOf(uid) !== -1; }));
        } else if (secMode === 'recursos_humanos') {
            return vinculadaAoGrupo(t, idsRHGlobal) || (ehCriador && t._respUserIds.some(function(uid) { return idsRHGlobal.indexOf(uid) !== -1; }));
        }
        return false;
    }
    else if (isDiretor) {
        if (diretorModoVisualizacao === 'direcao' || !diretorModoVisualizacao) {
            return ehCriador || ehResponsavel;
        } else if (diretorModoVisualizacao === 'gerencia_ambiental') {
            return vinculadaAoGrupo(t, idsEquipeAmbientalGlobal) || (ehCriador && t._respUserIds.some(function(uid) { return idsEquipeAmbientalGlobal.indexOf(uid) !== -1; }));
        } else if (diretorModoVisualizacao === 'cuidado_animal') {
            return vinculadaAoGrupo(t, idsEquipeCAGlobal) || (ehCriador && t._respUserIds.some(function(uid) { return idsEquipeCAGlobal.indexOf(uid) !== -1; }));
        } else {
            var idsPosturas = idsGerentesGlobal.concat(idsFiscaisPosturasGlobal);
            return vinculadaAoGrupo(t, idsPosturas) || (ehCriador && t._respUserIds.some(function(uid) { return idsPosturas.indexOf(uid) !== -1; }));
        }
    }
    else if (roleFiltro.includes('gerente')) {
        var roleNorm = roleFiltro.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        var isRA = roleNorm.includes('regularizacao');
        var isCA = roleNorm.includes('cuidado') && roleNorm.includes('animal');
        var isJuridicoAuto = roleNorm.includes('interface') && roleNorm.includes('juridica');

        if (isJuridicoAuto) {
            return ehCriador || ehResponsavel;
        } else if (isRA) {
            return vinculadaAoGrupo(t, idsEquipeAmbientalGlobal);
        } else if (isCA) {
            return vinculadaAoGrupo(t, idsEquipeCAGlobal);
        } else {
            var idsPosturasGer = idsGerentesGlobal.concat(idsFiscaisPosturasGlobal);
            return vinculadaAoGrupo(t, idsPosturasGer);
        }
    }
    else {
        return ehCriador || ehResponsavel;
    }
}

async function carregarTarefas() {
    if (carregandoTarefas) return;

    // Se ainda estiver iniciando o módulo, espera um pouco ou retorna
    if (!moduloIniciado && !inicializacaoPromise) {
        await carregarModuloTarefas();
        return;
    }

    carregandoTarefas = true;

    // Limpeza imediata para evitar "flash" de contexto anterior
    ['coluna-atrasadas', 'coluna-pendentes', 'coluna-em-progresso', 'coluna-concluidas'].forEach(id => {
        var el = document.getElementById(id);
        if (el) el.innerHTML = '<div style="text-align:center; color:#cbd5e1; padding:30px 10px; font-size:15px;">Carregando...</div>';
    });

    try {
        var { data: tarefas, error } = await supabaseClient
            .from('tarefas')
            .select('*')
            .is('tarefa_pai_id', null)
            .order('prazo', { ascending: true });

        if (error) throw error;
        tarefasCache = tarefas || [];

        // Buscar responsáveis de todas as tarefas
        var ids = tarefasCache.map(function (t) { return t.id; });
        var responsaveis = [];
        if (ids.length > 0) {
            var resResp = await supabaseClient.from('tarefa_responsaveis').select('*').in('tarefa_id', ids);
            responsaveis = resResp.data || [];
        }

        // Buscar avatares dos responsáveis e nomes dos criadores
        var userIdsResp = [];
        (responsaveis || []).forEach(function (r) {
            if (r.user_id && userIdsResp.indexOf(r.user_id) === -1) userIdsResp.push(r.user_id);
        });
        var avatarMap = {};
        if (userIdsResp.length > 0) {
            var { data: perfis } = await supabaseClient.from('profiles').select('id, avatar_url').in('id', userIdsResp);
            (perfis || []).forEach(function (p) { avatarMap[p.id] = p.avatar_url || ''; });
        }

        var criadorIds = [];
        (tarefasCache || []).forEach(function (t) {
            if (t.criado_por && criadorIds.indexOf(t.criado_por) === -1) criadorIds.push(t.criado_por);
        });
        var criadorMap = {};
        if (criadorIds.length > 0) {
            var { data: perfisCriadores } = await supabaseClient.from('profiles').select('id, full_name').in('id', criadorIds);
            (perfisCriadores || []).forEach(function (p) { criadorMap[p.id] = p.full_name || ''; });
        }

        // Buscar subtarefas de todas
        var subtarefas = [];
        if (ids.length > 0) {
            var resSub = await supabaseClient.from('tarefas').select('*').in('tarefa_pai_id', ids);
            subtarefas = resSub.data || [];
        }

        // Organizar subtarefas por tarefa_pai_id
        subtarefasCache = {};
        (subtarefas || []).forEach(function (s) {
            if (!subtarefasCache[s.tarefa_pai_id]) subtarefasCache[s.tarefa_pai_id] = [];
            subtarefasCache[s.tarefa_pai_id].push(s);
        });

        // Mapear responsáveis com avatar e user_id
        var respMap = {};
        var respUserIds = {};
        (responsaveis || []).forEach(function (r) {
            if (!respMap[r.tarefa_id]) { respMap[r.tarefa_id] = []; respUserIds[r.tarefa_id] = []; }
            respMap[r.tarefa_id].push({ name: r.user_name || 'Fiscal', avatar: avatarMap[r.user_id] || '', user_id: r.user_id });
            respUserIds[r.tarefa_id].push(r.user_id);
        });

        // Buscar responsáveis das subtarefas para identificar "minha tarefa via subtarefa"
        var subIds = (subtarefas || []).map(function (s) { return s.id; });
        var subRespData = [];
        if (subIds.length > 0) {
            var resSubR = await supabaseClient.from('tarefa_responsaveis').select('*').in('tarefa_id', subIds);
            subRespData = resSubR.data || [];
        }
        // Mapear: para cada tarefa-pai, verificar se o user é responsável de alguma subtarefa
        var ehMinhaViaSubMap = {};
        var minhasSubIds = {};
        var subRespMap = {};
        subRespData.forEach(function (r) {
            if (!subRespMap[r.tarefa_id]) subRespMap[r.tarefa_id] = [];
            subRespMap[r.tarefa_id].push(r.user_id);
            if (r.user_id === userIdGlobal) {
                minhasSubIds[r.tarefa_id] = true;
                // Encontrar a subtarefa e pegar o tarefa_pai_id
                var sub = (subtarefas || []).find(function (s) { return s.id === r.tarefa_id; });
                if (sub && sub.tarefa_pai_id) {
                    ehMinhaViaSubMap[sub.tarefa_pai_id] = true;
                }
            }
        });

        // Marcar subtarefas como "minhas" para uso no calendário
        (subtarefas || []).forEach(function (s) {
            var ehCriador = s.criado_por === userIdGlobal;
            var ehResp = subRespMap[s.id] && subRespMap[s.id].indexOf(userIdGlobal) !== -1;
            s._ehMinha = ehCriador || ehResp;
        });

        var hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        var atrasadas = [];
        var pendentes = [];
        var emProgresso = [];
        var concluidas = [];

        // Garantir que temos o role atualizado
        if (!userRoleGlobal || !userIdGlobal) {
            try {
                var authCheck = await getAuthUser();
                var uCheck = authCheck.data.user;
                if (uCheck) {
                    userIdGlobal = uCheck.id;
                    var { data: pCheck } = await supabaseClient.from('profiles').select('role').eq('id', uCheck.id).maybeSingle();
                    userRoleGlobal = pCheck ? pCheck.role : '';
                }
            } catch (e) { console.error(e); }
        }

        // Verifica se é gerente (mas NÃO é Gerente de Regularização Ambiental)
        var roleLowerRaw = (userRoleGlobal || '').toLowerCase();
        var roleLowerNorm = roleLowerRaw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        var ehGerenteAmbiental = roleLowerRaw.includes('regularizacao') || roleLowerRaw.includes('regularização');
        var isJuridico = roleLowerNorm.includes('gerente') && roleLowerNorm.includes('interface') && roleLowerNorm.includes('juridica');
        var isAgenteAdmin = roleLowerNorm.includes('agente') && roleLowerNorm.includes('administracao');
        
        ehGerenteKanban = (roleLowerRaw.includes('gerente') && !ehGerenteAmbiental) || isJuridico || isAgenteAdmin;

        // Se for diretor no modo 'gerencia' ou 'gerencia_posturas', ele atua como gerente (vê tudo dos gerentes de posturas)
        if ((roleLowerRaw === 'diretor(a)' || roleLowerRaw === 'diretor(a) de meio ambiente' || roleLowerRaw === 'diretor' || roleLowerRaw === 'diretor de meio ambiente') && 
            (diretorModoVisualizacao === 'gerencia' || diretorModoVisualizacao === 'gerencia_posturas')) {
            ehGerenteKanban = true;
        }

        // Se for secretario no sub-modo 'gerencia', também atua como gerente
        var ehSecretarioReal = userRoleGlobal === 'Secretário(a)' || userRoleGlobal === 'Secretário(a) do Secretário(a)';
        if (ehSecretarioReal && window.secretarioModoVisualizacao === 'direcao' && window.secretarioModoGerencia) {
            ehGerenteKanban = true;
        }

        console.log('[Tarefas] role:', userRoleGlobal, '| modo:', diretorModoVisualizacao, '| ehGerente:', ehGerenteKanban, '| total tarefas:', tarefasCache.length);

        // Função helper interna para verificar se a tarefa pertence a um conjunto de IDs (criador ou responsável)
        var vinculadaAoGrupo = function(task, idSet) {
            if (!idSet || idSet.length === 0) return false;
            if (idSet.indexOf(task.criado_por) !== -1) return true;
            return task._respUserIds.some(function(uid) { return idSet.indexOf(uid) !== -1; });
        };

        tarefasCache.forEach(function (t) {
            t._responsaveis = respMap[t.id] || [];
            t._respUserIds = respUserIds[t.id] || [];
            t._subtarefas = subtarefasCache[t.id] || [];
            t._ehMinhaViaSub = !!ehMinhaViaSubMap[t.id];
            t._minhasSubIds = minhasSubIds;
            t._nomeCriador = criadorMap[t.criado_por] || '';

            if (!tarefaVisivelParaUsuario(t)) return;

            // Filtrar do Kanban tarefas concluídas há mais de 30 dias
            if (t.status === 'concluida') {
                var dataConclusao = new Date(t.updated_at || t.created_at);
                var diffTempo = hoje - dataConclusao;
                var diasPassados = Math.floor(diffTempo / (1000 * 60 * 60 * 24));

                if (diasPassados <= 30) {
                    concluidas.push(t);
                }
            } else if (t.prazo && new Date(t.prazo) < hoje) {
                atrasadas.push(t);
            } else if (t.status === 'em_progresso') {
                emProgresso.push(t);
            } else {
                pendentes.push(t);
            }
        });

        renderizarColunaTarefas('coluna-atrasadas', atrasadas, '#ef4444', 'Atrasadas');
        renderizarColunaTarefas('coluna-pendentes', pendentes, '#f59e0b', 'Pendentes');
        renderizarColunaTarefas('coluna-em-progresso', emProgresso, '#3b82f6', 'Em Progresso');
        renderizarColunaTarefas('coluna-concluidas', concluidas, '#10b981', 'Concluídas');

        // Atualiza calendário de tarefas
        renderizarCalendarioTarefas();

    } catch (err) {
        console.error('Erro ao carregar tarefas:', err);
    } finally {
        carregandoTarefas = false;
    }
}

// ==========================================
// CALENDÁRIO DE TAREFAS
// ==========================================
function corArcoIrisTarefa(id) {
    var cores = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#6366f1', '#a855f7'];
    var hash = 0;
    for (var i = 0; i < id.length; i++) {
        hash += id.charCodeAt(i);
    }
    return cores[hash % cores.length];
}

function renderizarCalendarioTarefas() {
    var grid = document.getElementById('tarefas-calendario-grid');
    var titulo = document.getElementById('tarefas-calendario-mes-ano');
    if (!grid || !titulo) return;

    grid.innerHTML = '';
    var ano = dataCalendarioTarefasAtual.getFullYear();
    var mes = dataCalendarioTarefasAtual.getMonth();
    var nomesMeses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    titulo.textContent = nomesMeses[mes] + ' ' + ano;

    var primeiroDia = new Date(ano, mes, 1).getDay();
    var diasNoMes = new Date(ano, mes + 1, 0).getDate();
    var hoje = new Date();
    var isMesAtual = hoje.getFullYear() === ano && hoje.getMonth() === mes;

    for (var i = 0; i < primeiroDia; i++) {
        var divVazio = document.createElement('div');
        divVazio.style.background = 'rgba(255,255,255,0.1)';
        divVazio.style.borderRadius = '8px';
        divVazio.style.border = '1px solid rgba(255,255,255,0.1)';
        grid.appendChild(divVazio);
    }

    for (var dia = 1; dia <= diasNoMes; dia++) {
        var dataStr = ano + '-' + String(mes + 1).padStart(2, '0') + '-' + String(dia).padStart(2, '0');
        var isSelecionado = dataFiltroTarefasSelecionada === dataStr;

        var diaCell = document.createElement('div');
        diaCell.style.background = isSelecionado ? '#e0f2fe' : 'rgba(255,255,255,0.3)';
        diaCell.style.borderRadius = '8px';
        diaCell.style.border = isSelecionado ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.2)';
        diaCell.style.padding = '8px';
        diaCell.style.position = 'relative';
        diaCell.style.minHeight = '45px';
        diaCell.style.display = 'flex';
        diaCell.style.flexDirection = 'column';
        diaCell.style.cursor = 'pointer';
        diaCell.style.transition = 'all 0.2s';
        diaCell.onclick = (function(d) { return function() { selecionarDataCalendarioTarefas(d); }; })(dataStr);

        var numeroSpan = document.createElement('span');
        numeroSpan.textContent = dia;
        numeroSpan.style.fontWeight = '600';
        numeroSpan.style.fontSize = '0.9rem';
        numeroSpan.style.color = isSelecionado ? '#1e40af' : '#475569';
        numeroSpan.style.alignSelf = 'flex-start';

        if (isMesAtual && dia === hoje.getDate() && !isSelecionado) {
            numeroSpan.style.background = '#3b82f6';
            numeroSpan.style.color = 'white';
            numeroSpan.style.width = '24px';
            numeroSpan.style.height = '24px';
            numeroSpan.style.display = 'flex';
            numeroSpan.style.alignItems = 'center';
            numeroSpan.style.justifyContent = 'center';
            numeroSpan.style.borderRadius = '50%';
            diaCell.style.border = '2px solid #bfdbfe';
            diaCell.style.background = '#eff6ff';
        }

        diaCell.appendChild(numeroSpan);

        var areaBarras = document.createElement('div');
        areaBarras.style.flex = '1';
        areaBarras.style.marginTop = '4px';
        areaBarras.style.display = 'flex';
        areaBarras.style.flexWrap = 'wrap';
        areaBarras.style.gap = '3px';
        areaBarras.style.overflowY = 'hidden';

        // Coletar todas as tarefas e subtarefas visíveis não concluídas
        var todasTarefasVisiveis = [];
        tarefasCache.forEach(function(t) {
            if (t.status === 'concluida') return;
            if (tarefaVisivelParaUsuario(t)) todasTarefasVisiveis.push(t);
        });
        Object.keys(subtarefasCache).forEach(function(paiId) {
            (subtarefasCache[paiId] || []).forEach(function(s) {
                if (s.status === 'concluida') return;
                if (s._ehMinha) todasTarefasVisiveis.push(s);
            });
        });

        var tarefasNoDia = [];
        todasTarefasVisiveis.forEach(function(t) {
            if (!t.created_at) return;
            var criacao = t.created_at.substring(0, 10);
            var prazo = t.prazo ? t.prazo.substring(0, 10) : criacao;
            if (dataStr >= criacao && dataStr <= prazo) {
                tarefasNoDia.push(t);
            }
        });

        if (tarefasNoDia.length > 0 && !isSelecionado) {
            var corBase = corArcoIrisTarefa(tarefasNoDia[0].id);
            diaCell.style.background = corBase + '0a';
            diaCell.style.borderColor = corBase + '40';
        }

        tarefasNoDia.forEach(function(t) {
            var bar = document.createElement('div');
            bar.style.width = '100%';
            bar.style.height = '6px';
            bar.style.borderRadius = '3px';
            bar.style.background = corArcoIrisTarefa(t.id);
            bar.style.marginBottom = '2px';
            bar.title = t.titulo || 'Tarefa';
            areaBarras.appendChild(bar);
        });

        diaCell.appendChild(areaBarras);
        grid.appendChild(diaCell);
    }
}

function selecionarDataCalendarioTarefas(dataStr) {
    if (dataFiltroTarefasSelecionada === dataStr) {
        dataFiltroTarefasSelecionada = null;
    } else {
        dataFiltroTarefasSelecionada = dataStr;
    }
    renderizarCalendarioTarefas();
    renderizarTarefasDoDia(dataStr);
}

function mudarMesCalendarioTarefas(direcao) {
    dataCalendarioTarefasAtual.setMonth(dataCalendarioTarefasAtual.getMonth() + direcao);
    dataFiltroTarefasSelecionada = null;
    renderizarCalendarioTarefas();
    var secao = document.getElementById('tarefas-dia-selecionado');
    if (secao) secao.style.display = 'none';
}

function renderizarTarefasDoDia(dataStr) {
    var secao = document.getElementById('tarefas-dia-selecionado');
    var titulo = document.getElementById('tarefas-dia-titulo');
    var lista = document.getElementById('tarefas-dia-lista');
    if (!secao || !titulo || !lista) return;

    // Coletar todas as tarefas e subtarefas visíveis não concluídas
    var todasTarefasVisiveis = [];
    tarefasCache.forEach(function(t) {
        if (t.status === 'concluida') return;
        if (tarefaVisivelParaUsuario(t)) todasTarefasVisiveis.push(t);
    });
    Object.keys(subtarefasCache).forEach(function(paiId) {
        (subtarefasCache[paiId] || []).forEach(function(s) {
            if (s.status === 'concluida') return;
            if (s._ehMinha) todasTarefasVisiveis.push(s);
        });
    });

    var tarefasDoDia = [];
    todasTarefasVisiveis.forEach(function(t) {
        if (!t.created_at) return;
        var criacao = t.created_at.substring(0, 10);
        var prazo = t.prazo ? t.prazo.substring(0, 10) : criacao;
        if (dataStr >= criacao && dataStr <= prazo) {
            tarefasDoDia.push(t);
        }
    });

    if (tarefasDoDia.length === 0) {
        secao.style.display = 'none';
        return;
    }

    var dataFmt = new Date(dataStr + 'T00:00:00').toLocaleDateString('pt-BR');
    titulo.textContent = 'Tarefas de ' + dataFmt;

    var html = '<div style="display:flex; flex-direction:column; gap:8px;">';
    tarefasDoDia.forEach(function(t) {
        var cor = corArcoIrisTarefa(t.id);
        var prazoStr = t.prazo ? formatarDataBRTarefa(t.prazo) : '-';
        var statusColor = t.status === 'concluida' ? '#10b981' : (t.status === 'em_progresso' ? '#3b82f6' : '#f59e0b');
        var statusLabel = t.status === 'concluida' ? 'Concluída' : (t.status === 'em_progresso' ? 'Em Progresso' : 'Pendente');
        html += '<div style="background:white; border-radius:8px; padding:10px 12px; border:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; border-left:3px solid ' + cor + ';">';
        html += '<div>';
        html += '<div style="font-weight:600; font-size:0.85rem; color:#1e293b;">' + escapeHtmlTarefa(t.titulo || 'Sem título') + '</div>';
        html += '<div style="font-size:0.75rem; color:#64748b;">Prazo: ' + prazoStr + '</div>';
        html += '</div>';
        html += '<span style="background:' + statusColor + '15; color:' + statusColor + '; border:1px solid ' + statusColor + '40; border-radius:6px; padding:2px 8px; font-size:0.7rem; font-weight:700;">' + statusLabel + '</span>';
        html += '</div>';
    });
    html += '</div>';

    lista.innerHTML = html;
    secao.style.display = 'block';
}

function formatarDataBRTarefa(dataStr) {
    if (!dataStr) return '-';
    var d = new Date(dataStr + 'T00:00:00');
    return d.toLocaleDateString('pt-BR');
}

function escapeHtmlTarefa(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function sanitizarNomeArquivo(nome) {
    if (!nome) return 'arquivo';
    // Remove acentos
    var semAcentos = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    // Substitui espaços por underscore
    var semEspacos = semAcentos.replace(/\s+/g, '_');
    // Remove caracteres que não sejam letras, números, underscore, hífen e ponto
    var limpo = semEspacos.replace(/[^a-zA-Z0-9_\-.]/g, '');
    // Evita nome vazio
    return limpo || 'arquivo';
}

function renderizarColunaTarefas(containerId, tarefas, cor, titulo) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var html = '<div style="font-size:15px; font-weight:700; color:' + cor + '; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:10px; display:flex; align-items:center; gap:6px;">';
    html += '<span style="width:10px; height:10px; border-radius:50%; background:' + cor + '; display:inline-block;"></span>';
    html += titulo + ' <span style="font-weight:400; color:#94a3b8;">(' + tarefas.length + ')</span></div>';

    if (tarefas.length === 0) {
        html += '<div style="text-align:center; color:#cbd5e1; padding:30px 10px; font-size:15px;">Nenhuma tarefa</div>';
        container.innerHTML = html;
        return;
    }

    tarefas.forEach(function (t) {
        var prazoDt = t.prazo ? new Date(t.prazo) : null;
        var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
        var atrasada = prazoDt && prazoDt < hoje && t.status !== 'concluida';

        var borderColor = t.status === 'concluida' ? '#10b981' : (atrasada ? '#ef4444' : '#3b82f6');
        var ehMinhaDireta = t._respUserIds && t._respUserIds.indexOf(userIdGlobal) !== -1;
        var extraStyle = ehMinhaDireta ? 'box-shadow:0 0 0 2px #8b5cf6, 0 2px 8px rgba(139,92,246,0.15);' : 'box-shadow:0 1px 3px rgba(0,0,0,0.06);';

        html += '<div onclick="abrirDetalheTarefa(\'' + t.id + '\')" style="background:white; border-radius:10px; padding:12px; margin-bottom:8px; border-left:4px solid ' + borderColor + '; cursor:pointer; ' + extraStyle + ' transition:transform 0.15s;" onmouseover="this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.transform=\'none\'">';

        html += '<div style="font-size:15px; font-weight:600; color:#1e293b; margin-bottom:2px;">' + escapeHtmlTarefa(t.titulo);
        if (ehMinhaDireta) html += ' <span style="font-size:14px; background:#8b5cf6; color:white; padding:1px 5px; border-radius:8px; margin-left:4px; vertical-align:1px;">VOCÊ</span>';
        html += '</div>';

        if (t._nomeCriador) {
            html += '<div style="font-size:12px; color:#94a3b8; margin-bottom:4px;">Por ' + escapeHtmlTarefa(t._nomeCriador) + '</div>';
        }

        // Aviso de prazo próximo (≤5 dias)
        if (prazoDt && t.status !== 'concluida') {
            var diasFaltam = Math.ceil((prazoDt - hoje) / (1000 * 60 * 60 * 24));
            if (diasFaltam <= 5 && diasFaltam >= 0) {
                var avisoTexto = diasFaltam === 0 ? '⚠ Vence hoje' : (diasFaltam === 1 ? '⚠ Vence amanhã' : '⚠ Faltam ' + diasFaltam + ' dias');
                html += '<div style="font-size:12px; color:#dc2626; font-weight:500; margin-bottom:4px;">' + avisoTexto + '</div>';
            }
        }

        // Responsáveis com avatar
        if (t._responsaveis.length > 0) {
            html += '<div style="display:flex; align-items:center; gap:4px; flex-wrap:wrap; margin-bottom:4px;">';
            t._responsaveis.forEach(function (r) {
                if (r.avatar) {
                    html += '<img src="' + r.avatar + '" style="width:18px; height:18px; border-radius:50%; object-fit:cover; border:1px solid #e2e8f0;">';
                } else {
                    html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="#cbd5e1" stroke="none" style="flex-shrink:0;"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>';
                }
                html += '<span style="font-size:14px; color:#64748b;">' + r.name + '</span>';
            });
            html += '</div>';
        }

        // Prazo
        if (prazoDt) {
            var prazoStr = String(prazoDt.getDate()).padStart(2, '0') + '/' + String(prazoDt.getMonth() + 1).padStart(2, '0') + '/' + prazoDt.getFullYear();
            var diasRestantes = Math.ceil((prazoDt - hoje) / (1000 * 60 * 60 * 24));
            var prazoColor = atrasada ? '#ef4444' : (diasRestantes <= 2 ? '#f59e0b' : '#64748b');
            var prazoLabel = atrasada ? 'ATRASADA (' + Math.abs(diasRestantes) + 'd)' : (diasRestantes === 0 ? 'Hoje' : prazoStr);

            html += '<div style="font-size:14px; color:' + prazoColor + '; font-weight:' + (atrasada ? '700' : '500') + ';">' + prazoLabel + '</div>';
        }

        // Barra de progresso de subtarefas
        if (t._subtarefas.length > 0) {
            var totalSub = t._subtarefas.length;
            var concluidasSub = t._subtarefas.filter(function (s) { return s.status === 'concluida'; }).length;
            var pct = Math.round((concluidasSub / totalSub) * 100);
            var barColor = pct === 100 ? '#10b981' : (pct >= 50 ? '#3b82f6' : '#f59e0b');

            html += '<div style="margin-top:6px;">';
            html += '<div style="display:flex; justify-content:space-between; font-size:13px; color:#94a3b8; margin-bottom:3px;"><span>Subtarefas</span><span>' + concluidasSub + '/' + totalSub + ' (' + pct + '%)</span></div>';
            html += '<div style="background:#e2e8f0; border-radius:10px; height:6px; overflow:hidden; margin-bottom:6px;">';
            html += '<div style="background:' + barColor + '; height:100%; width:' + pct + '%; border-radius:10px; transition:width 0.3s;"></div>';
            html += '</div>';

            // Lista de subtarefas
            t._subtarefas.forEach(function (sub) {
                var subDone = sub.status === 'concluida';
                var ehMinhaSubtarefa = t._minhasSubIds && t._minhasSubIds[sub.id];
                var subBg = ehMinhaSubtarefa ? 'background:rgba(139,92,246,0.08); border:1px solid rgba(139,92,246,0.3); border-radius:6px; padding:3px 6px;' : 'padding:2px 0;';
                html += '<div style="display:flex; align-items:flex-start; gap:5px; ' + subBg + ' margin-bottom:2px;" onclick="event.stopPropagation()">';
                if (ehMinhaSubtarefa || ehGerenteKanban) {
                    html += '<input type="checkbox" ' + (subDone ? 'checked' : '') + ' disabled title="Abra a tarefa para concluir a subtarefa" style="width:14px; height:14px; accent-color:#10b981; margin-top:2px; flex-shrink:0;">';
                } else {
                    html += '<input type="checkbox" ' + (subDone ? 'checked' : '') + ' disabled style="width:14px; height:14px; accent-color:#10b981; opacity:0.5; margin-top:2px; flex-shrink:0;">';
                }
                html += '<span style="font-size:13px; color:' + (subDone ? '#94a3b8' : '#475569') + '; ' + (subDone ? 'text-decoration:line-through;' : '') + ' word-break:break-word; min-width:0;">' + sub.titulo + '</span>';
                if (ehMinhaSubtarefa) html += ' <span style="font-size:10px; background:#8b5cf6; color:white; padding:1px 5px; border-radius:6px; margin-left:2px; flex-shrink:0; white-space:nowrap;">VOCÊ</span>';
                html += '</div>';
            });
            html += '</div>';
        }

        html += '</div>';
    });

    container.innerHTML = html;
}

// ==========================================
// MODAL CRIAR TAREFA
// ==========================================
let _isSubMode = false;
let _vincularEventoId = null;
function abrirModalNovaTarefa(isSub = false, vincularEventoId = null) {
    // Verificação de segurança: Diretor, Gerente e Secretario podem criar tarefas
    var roleLowerRaw = (userRoleGlobal || '').toLowerCase();
    var ehDiretor = roleLowerRaw.includes('diretor');
    
    var roleLowerNormFilter = roleLowerRaw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    var isCargoEspecial = (roleLowerNormFilter.includes('agente') && roleLowerNormFilter.includes('administracao')) || 
                          (roleLowerNormFilter.includes('gerente') && roleLowerNormFilter.includes('interface') && roleLowerNormFilter.includes('juridica'));

    var ehGerente = (roleLowerRaw.includes('gerente') || 
                     roleLowerRaw === 'administrativo' || 
                     roleLowerRaw.includes('administrativo') && roleLowerRaw.includes('postura') ||
                     roleLowerRaw.includes('administrador') && roleLowerRaw.includes('postura') ||
                     isCargoEspecial);
                     
    var ehSecretario = (userRoleGlobal === 'Secretário(a)' || userRoleGlobal === 'Secretário(a) do Secretário(a)');
    console.log('[Tarefas] abrirModalNovaTarefa - role:', userRoleGlobal, 'ehDiretor:', ehDiretor, 'ehGerente:', ehGerente, 'ehSecretario:', ehSecretario);
    if (!ehDiretor && !ehGerente && !ehSecretario) {
        Swal.fire('Acesso Negado', 'Apenas Diretores, Gerentes e Cargos Especiais podem criar tarefas.', 'error');
        return;
    }
    
    // Gerentes não podem criar tarefas dentro de projetos (apenas tarefas avulsas)
    if (ehGerente && vincularEventoId) {
        Swal.fire('Acesso Negado', 'Gerentes não podem inserir tarefas em projetos. Apenas Diretor e Secretário podem.', 'error');
        return;
    }

    _isSubMode = isSub;
    _vincularEventoId = vincularEventoId;
    arquivosTemporariosTarefa = []; // Reset arquivos tarefa ao abrir
    var html = '<div class="modal-overlay ativo" id="modal-nova-tarefa" onclick="if(event.target===this)fecharModal(\'modal-nova-tarefa\')">';
    html += '<div class="modal-container" style="max-width:520px;">';
    html += '<div class="modal-header"><h2>Nova Tarefa</h2>';
    html += '<button class="modal-close" onclick="fecharModal(\'modal-nova-tarefa\')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
    html += '</div><div class="modal-body">';
    html += '<div class="campo-grupo"><label>Título da Tarefa</label><input type="text" id="tarefa-titulo" placeholder="Ex: Vistoria no Bairro Centro"></div>';
    html += '<div class="campo-grupo"><label>Observações</label><textarea id="tarefa-descricao" rows="3" placeholder="Descrição ou instruções..."></textarea></div>';
    html += '<div class="campo-grupo"><label>Anexos</label>';
    html += '<label style="display:flex; align-items:center; gap:8px; padding:10px; border:2px dashed #cbd5e1; border-radius:10px; cursor:pointer; background:#f8fafc; transition:border-color 0.2s;" onmouseover="this.style.borderColor=\'#8b5cf6\'" onmouseout="this.style.borderColor=\'#cbd5e1\'">';
    html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>';
    html += '<span style="font-size:14px; color:#64748b;">Clique para selecionar arquivos (qualquer formato)</span>';
    html += '<input type="file" id="tarefa-anexos-input" multiple style="display:none;" onchange="adicionarArquivosTarefa(this)">';
    html += '</label>';
    html += '<div id="tarefa-anexos-preview" style="margin-top:8px; display:flex; flex-wrap:wrap; gap:5px;"></div>';
    html += '</div>';
    html += '<div class="campo-grupo"><label>Prazo</label><input type="date" id="tarefa-prazo"></div>';
    html += '<div class="campo-grupo"><label>Responsáveis</label><div id="tarefa-responsaveis-list" style="max-height:180px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:10px; padding:8px; background:#f8fafc;">Carregando...</div></div>';
    html += '</div><div class="modal-footer"><button class="btn-cancelar" onclick="fecharModal(\'modal-nova-tarefa\')">Cancelar</button>';
    html += '<button class="btn-salvar" onclick="salvarTarefa()">Criar Tarefa</button></div></div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
    carregarListaResponsaveis();
}

// Variável global para armazenar a lista completa de responsáveis
var _responsaveisCache = [];

async function carregarListaResponsaveis() {
    var container = document.getElementById('tarefa-responsaveis-list');
    if (!container) return;
    
    console.log('[Tarefas] carregarListaResponsaveis - userIdGlobal:', userIdGlobal, 'userRoleGlobal:', userRoleGlobal);

    try {
        var { data: users, error } = await supabaseClient
            .from('profiles')
            .select('id, full_name, role')
            .order('full_name', { ascending: true });

        if (error) throw error;
        
        console.log('[Tarefas] Total de usuários carregados:', users ? users.length : 0);
        console.log('[Tarefas] Usuários:', users ? users.map(u => ({ id: u.id, name: u.full_name, role: u.role })) : []);

        // Filtrar usuários válidos e armazenar em cache
        var roleLowerRaw = (userRoleGlobal || '').toLowerCase();
        var ehDiretor = (roleLowerRaw === 'diretor(a)' || roleLowerRaw === 'diretor(a) de meio ambiente' || roleLowerRaw === 'diretor' || roleLowerRaw === 'diretor de meio ambiente');
        var ehGerenteAmbiental = roleLowerRaw.includes('regularizacao') || roleLowerRaw.includes('regularização');
        var ehGerentePosturas = roleLowerRaw.includes('gerente') && (roleLowerRaw.includes('postura') || roleLowerRaw.includes('posturas'));
        // Cargos que podem ser atribuídos em tarefas
        var validRoles = ['Fiscal', 'Fiscal de Posturas', 'Fiscal de Postura', 'Administrativo de Posturas', 'Administrativo de Postura', 'Gerente de Posturas', 'Gerente de Postura', 'Gerente de Regularização Ambiental', 'Diretor(a)', 'Diretor(a) de Meio Ambiente', 'Secretário(a)', 'Secretário(a) do Secretário(a)', 'secretário(a)', 'Secretario(a)', 'secretario(a)'];
        // Cargos da equipe do Gerente de Regularização Ambiental
        var cargosEquipeAmbiental = ['Engenheiro(a) Agrônomo(a)', 'Engenheiro(a) Civil', 'Analista Ambiental', 'Auxiliar de Serviços II'];

        _responsaveisCache = [];
        
        (users || []).forEach(function (u) {
            var roleLower = (u.role || '').toLowerCase();
            if (roleLower === 'inativo') return;

            // Se for Diretor, pode atribuir tarefas para qualquer pessoa na hierarquia:
            // - Ele mesmo (Diretor)
            // - Secretário(a)
            // - Gerentes (de Posturas, de Regularização Ambiental)
            // - Equipe de RA (Fiscais, Administrativos de Posturas)
            // - Equipe Ambiental (Engenheiros, Agrônomos, Analistas, Auxiliares)
            // Não há exclusão para Diretor - ele vê todos

            // Se for Gerente de Posturas, só pode atribuir para si mesmo, Fiscais e Administrativos de Posturas
            if (ehGerentePosturas) {
                var isEleMesmo = u.id === userIdGlobal;
                var isFiscalPostura = roleLower.includes('fiscal') && roleLower.includes('postura');
                var isAdminPostura = roleLower.includes('administrativo') && roleLower.includes('postura');
                var isGerentePostura = roleLower.includes('gerente') && roleLower.includes('postura') && u.id === userIdGlobal;
                // Só mostra se for ele mesmo, Fiscal ou Administrativo de Posturas
                if (!isEleMesmo && !isFiscalPostura && !isAdminPostura && !isGerentePostura) return;
                console.log('[Tarefas] Gerente Posturas - Responsável incluído:', u.full_name, u.role, 'isEleMesmo:', isEleMesmo);
            }

            // Se for Gerente de Regularização Ambiental, pode atribuir para si mesmo ou para sua equipe
            if (ehGerenteAmbiental) {
                // Verifica se é ele mesmo
                var isEleMesmo = u.id === userIdGlobal;
                // Verifica se é da equipe ambiental
                var isEquipeAmbiental = cargosEquipeAmbiental.indexOf(u.role) !== -1 ||
                                        roleLower.includes('engenheiro') || 
                                        roleLower.includes('agrônomo') || 
                                        roleLower.includes('agronomo') ||
                                        roleLower.includes('analista ambiental') ||
                                        roleLower.includes('auxiliar de serviços');
                // Só mostra se for ele mesmo ou da sua equipe
                if (!isEleMesmo && !isEquipeAmbiental) return;
                // Debug: mostra quem está sendo incluído
                console.log('[Tarefas] Gerente R.A. - Responsável incluído:', u.full_name, u.role, 'isEleMesmo:', isEleMesmo);
            }

            // Verifica se é um cargo válido (comparação case-insensitive)
            var isValidRole = validRoles.some(function(r) { return r.toLowerCase() === roleLower; }) ||
                              roleLower.includes('gerente') ||
                              roleLower.includes('fiscal') ||
                              roleLower.includes('administrativo') ||
                              roleLower.includes('diretor') ||
                              roleLower.includes('secretário') ||
                              roleLower.includes('secretario') ||
                              roleLower.includes('coordenador') ||
                              roleLower.includes('agente');
            // Verifica se é da equipe do Gerente de Regularização Ambiental
            var isEquipeAmbiental = cargosEquipeAmbiental.indexOf(u.role) !== -1 ||
                                    roleLower.includes('engenheiro') || 
                                    roleLower.includes('agrônomo') || 
                                    roleLower.includes('agronomo') ||
                                    roleLower.includes('analista ambiental') ||
                                    roleLower.includes('auxiliar de serviços');
            // Verifica se é o próprio usuário logado (para Gerente R.A. se incluir na lista)
            var isProprioUsuario = String(u.id) === String(userIdGlobal);

            if (isValidRole || isEquipeAmbiental || isProprioUsuario) {
                _responsaveisCache.push({
                    id: u.id,
                    full_name: u.full_name,
                    role: u.role,
                    isProprioUsuario: isProprioUsuario
                });
            }
        });

        // Renderizar com campo de pesquisa
        renderizarListaResponsaveisComPesquisa('');
        
    } catch (err) {
        container.innerHTML = '<p style="color:#ef4444;">Erro: ' + err.message + '</p>';
    }
}

// Variável para guardar o valor atual da pesquisa
var _pesquisaResponsavelValor = '';

// Função para renderizar a lista de responsáveis com campo de pesquisa
function renderizarListaResponsaveisComPesquisa(filtro) {
    var container = document.getElementById('tarefa-responsaveis-list');
    if (!container) return;
    
    _pesquisaResponsavelValor = filtro || '';
    var filtroLower = _pesquisaResponsavelValor.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // Na primeira renderização, cria a estrutura completa
    if (!document.getElementById('pesquisa-responsavel')) {
        // Campo de pesquisa fixo
        var html = '<div style="position:sticky; top:0; background:#f8fafc; padding-bottom:8px; border-bottom:1px solid #e2e8f0; margin-bottom:8px;">';
        html += '<div style="position:relative;">';
        html += '<svg style="position:absolute; left:10px; top:50%; transform:translateY(-50%); width:16px; height:16px; color:#94a3b8; pointer-events:none;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>';
        html += '<input type="text" id="pesquisa-responsavel" placeholder="Pesquisar nome ou cargo..." ';
        html += 'style="width:100%; padding:8px 12px 8px 36px; border:1px solid #e2e8f0; border-radius:8px; font-size:14px; outline:none; box-sizing:border-box;">';
        html += '</div></div>';
        
        // Lista de responsáveis (será preenchida dinamicamente)
        html += '<div id="responsaveis-items" style="max-height:140px; overflow-y:auto;"></div>';
        
        // Contador
        html += '<div style="padding-top:8px; border-top:1px solid #e2e8f0; margin-top:8px; font-size:12px; color:#64748b; text-align:center;">';
        html += 'Selecionados: <span id="contador-selecionados">0</span> | ';
        html += 'Mostrando: <span id="mostrando-responsaveis">0</span> de ' + _responsaveisCache.length;
        html += '</div>';
        
        container.innerHTML = html;
        
        // Adicionar event listener no input
        document.getElementById('pesquisa-responsavel').addEventListener('input', function(e) {
            filtrarResponsaveis(e.target.value);
        });
    }
    
    // Atualizar valor do input
    var inputPesquisa = document.getElementById('pesquisa-responsavel');
    if (inputPesquisa && filtro !== undefined) {
        inputPesquisa.value = filtro;
    }
    
    // Renderizar apenas a lista de itens
    var listaContainer = document.getElementById('responsaveis-items');
    if (!listaContainer) return;
    
    var usuariosFiltrados = _responsaveisCache.filter(function(u) {
        if (!filtroLower) return true;
        var nomeNormalizado = u.full_name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        var cargoNormalizado = (u.role || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return nomeNormalizado.includes(filtroLower) || cargoNormalizado.includes(filtroLower);
    });
    
    var html = '';
    if (usuariosFiltrados.length === 0) {
        html = '<p style="color:#94a3b8; text-align:center; padding:20px;">Nenhum responsável encontrado.</p>';
    } else {
        usuariosFiltrados.forEach(function(u) {
            var checked = u.isProprioUsuario ? ' checked' : '';
            html += '<label style="display:flex; align-items:center; gap:8px; padding:5px 4px; cursor:pointer; font-size:15px; color:#334155;">';
            html += '<input type="checkbox" class="cb-responsavel" value="' + u.id + '" data-name="' + u.full_name + '"' + checked + ' style="width:16px; height:16px; accent-color:#10b981;">';
            html += u.full_name + ' <span style="font-size:14px; color:#94a3b8;">(' + (u.role || 'Sem Cargo') + ')</span></label>';
        });
    }
    
    listaContainer.innerHTML = html;
    
    // Atualizar contadores
    atualizarContadorSelecionados();
    var mostrandoEl = document.getElementById('mostrando-responsaveis');
    if (mostrandoEl) {
        mostrandoEl.textContent = usuariosFiltrados.length;
    }
    
    // Adicionar listeners nos checkboxes
    var checkboxes = listaContainer.querySelectorAll('.cb-responsavel');
    checkboxes.forEach(function(cb) {
        cb.addEventListener('change', atualizarContadorSelecionados);
    });
}

// Função para filtrar responsáveis conforme usuário digita
function filtrarResponsaveis(valor) {
    renderizarListaResponsaveisComPesquisa(valor);
    // Restaurar foco no input após renderização
    setTimeout(function() {
        var input = document.getElementById('pesquisa-responsavel');
        if (input) {
            input.focus();
            // Posicionar cursor no final do texto
            var len = input.value.length;
            input.setSelectionRange(len, len);
        }
    }, 0);
}

// Função para atualizar o contador de selecionados
function atualizarContadorSelecionados() {
    var container = document.getElementById('tarefa-responsaveis-list');
    if (!container) return;
    var checkboxes = container.querySelectorAll('.cb-responsavel:checked');
    var contador = document.getElementById('contador-selecionados');
    if (contador) {
        contador.textContent = checkboxes.length;
    }
}

// Preview dos anexos selecionados na criação
let arquivosTemporariosTarefa = [];

function adicionarArquivosTarefa(input) {
    if (!input.files) return;
    for (var i = 0; i < input.files.length; i++) {
        arquivosTemporariosTarefa.push(input.files[i]);
    }
    input.value = '';
    renderizarPreviewArquivosTarefa();
}

function removerArquivoTarefa(index) {
    arquivosTemporariosTarefa.splice(index, 1);
    renderizarPreviewArquivosTarefa();
}

function renderizarPreviewArquivosTarefa() {
    var container = document.getElementById('tarefa-anexos-preview');
    if (!container) return;
    container.innerHTML = '';
    arquivosTemporariosTarefa.forEach((f, idx) => {
        var sizeMB = (f.size / (1024 * 1024)).toFixed(2);
        container.innerHTML += `
            <div style="display:flex; align-items:center; gap:8px; padding:6px 10px; background:#f1f5f9; border-radius:8px; margin-bottom:4px; font-size:14px; color:#334155; width:100%;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" style="flex-shrink:0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${f.name}</span>
                <span style="color:#94a3b8; font-size:12px;">${sizeMB} MB</span>
                <button onclick="removerArquivoTarefa(${idx})" style="background:none; border:none; color:#f43f5e; cursor:pointer; font-weight:bold; padding:0 4px;">×</button>
            </div>`;
    });
}

async function salvarTarefa() {
    var titulo = document.getElementById('tarefa-titulo').value.trim();
    var descricao = document.getElementById('tarefa-descricao').value.trim();
    var prazo = document.getElementById('tarefa-prazo').value;

    if (!titulo) { alert('Preencha o título da tarefa.'); return; }

    var btnSalvar = document.querySelector('#modal-nova-tarefa .btn-salvar');
    var oldText = '';
    if (btnSalvar) {
        oldText = btnSalvar.textContent;
        btnSalvar.textContent = 'Carregando...';
        btnSalvar.disabled = true;
        btnSalvar.style.opacity = '0.7';
    }

    var responsaveisCBs = document.querySelectorAll('.cb-responsavel:checked');
    var responsaveis = [];
    responsaveisCBs.forEach(function (cb) {
        responsaveis.push({ user_id: cb.value, user_name: cb.getAttribute('data-name') });
    });

    // Capturar arquivos selecionados antes de fechar o modal
    // Usar array em memória
    var arquivos = arquivosTemporariosTarefa;

    try {
        if (_isSubMode) {
            // Se estiver em modo vinculado ao evento, apenas guarda na lista temporária
            tarefasTemporariasEvento.push({
                titulo: titulo,
                descricao: descricao,
                prazo: prazo,
                responsaveis: responsaveis,
                arquivos: arquivosTemporariosTarefa // Usa o array em memória
            });
            fecharModal('modal-nova-tarefa');
            renderizarListaTarefasTemporarias();
            return;
        }

        var { data: novaTarefa, error } = await supabaseClient
            .from('tarefas')
            .insert({
                titulo: titulo,
                descricao: descricao,
                status: 'pendente',
                prazo: prazo ? prazo + 'T23:59:59' : null,
                criado_por: userIdGlobal,
                evento_id: _vincularEventoId
            })
            .select()
            .maybeSingle();

        if (error) throw error;

        // Inserir responsáveis
        if (responsaveis.length > 0) {
            var resps = responsaveis.map(function (r) {
                return { tarefa_id: novaTarefa.id, user_id: r.user_id, user_name: r.user_name };
            });
            await supabaseClient.from('tarefa_responsaveis').insert(resps);
        }

        // Upload de anexos em paralelo (Otimização de velocidade)
        if (arquivos.length > 0) {
            var uploadPromises = [];
            for (var i = 0; i < arquivos.length; i++) {
                var file = arquivos[i];
                var filePath = novaTarefa.id + '/' + Date.now() + '_' + sanitizarNomeArquivo(file.name);
                uploadPromises.push((async function (f, fPath) {
                    var { error: uploadErr } = await supabaseClient.storage.from('tarefa_anexos').upload(fPath, f);
                    if (uploadErr) { console.error('Erro upload anexo:', uploadErr); return null; }
                    var publicUrl = supabaseClient.storage.from('tarefa_anexos').getPublicUrl(fPath).data.publicUrl;
                    return { tarefa_id: novaTarefa.id, nome_arquivo: f.name, url: publicUrl };
                })(file, filePath));
            }

            var resultadosUploads = await Promise.all(uploadPromises);
            var anexosValidos = resultadosUploads.filter(function (r) { return r !== null; });

            if (anexosValidos.length > 0) {
                await supabaseClient.from('tarefa_anexos').insert(anexosValidos);
            }
        }

        fecharModal('modal-nova-tarefa');
        carregarTarefas();
    } catch (err) {
        alert('Erro ao criar tarefa: ' + err.message);
    } finally {
        if (btnSalvar) {
            btnSalvar.textContent = oldText;
            btnSalvar.disabled = false;
            btnSalvar.style.opacity = '1';
        }
    }
}

// ==========================================
// DETALHE DA TAREFA (MODAL COMPLETO)
// ==========================================
async function abrirDetalheTarefa(id) {
    if (_abrindoDetalhe) return;
    _abrindoDetalhe = true;

    var loadingId = 'loading-detalhe-' + id;
    try {
        var loadingHtml = '<div id="' + loadingId + '" class="modal-overlay ativo" style="z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.6);"><div style="background:white;padding:24px 32px;border-radius:12px;display:flex;flex-direction:column;align-items:center;gap:16px;box-shadow:0 10px 25px rgba(0,0,0,0.1);"><div style="width:36px;height:36px;border:4px solid #e2e8f0;border-top:4px solid #10b981;border-radius:50%;animation:spinLoading 1s linear infinite;"></div><div style="color:#334155;font-weight:600;font-size:15px;">Carregando tarefa...</div></div></div>';
        if (!document.getElementById('spin-style-loading')) {
            document.head.insertAdjacentHTML('beforeend', '<style id="spin-style-loading">@keyframes spinLoading { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>');
        }
        document.body.insertAdjacentHTML('beforeend', loadingHtml);

        var tarefa = tarefasCache.find(function (t) { return t.id === id; });
        if (!tarefa) {
            // Se a tarefa não estiver no cache (ex: abrindo direto da Home), busca do banco
            var { data: tData } = await supabaseClient.from('tarefas').select('*').eq('id', id).maybeSingle();
            if (!tData) {
                var loadingElErr = document.getElementById(loadingId);
                if (loadingElErr) loadingElErr.remove();
                _abrindoDetalhe = false;
                return;
            }
            tarefa = tData;
        }

        // Buscar nome de quem criou a tarefa
        var nomeCriador = '';
        if (tarefa.criado_por) {
            var { data: perfilCriador } = await supabaseClient.from('profiles').select('full_name').eq('id', tarefa.criado_por).maybeSingle();
            nomeCriador = perfilCriador ? perfilCriador.full_name : '';
        }

        // Buscar subtarefas atualizadas
        var { data: subtarefas } = await supabaseClient
            .from('tarefas')
            .select('*')
            .eq('tarefa_pai_id', id)
            .order('created_at', { ascending: true });

        // Buscar responsáveis das subtarefas
        var subIds = (subtarefas || []).map(function (s) { return s.id; });
        var subRespMap = {};
        var subRespUserIdMap = {};
        if (subIds.length > 0) {
            var { data: subResps } = await supabaseClient
                .from('tarefa_responsaveis')
                .select('*')
                .in('tarefa_id', subIds);
            (subResps || []).forEach(function (r) {
                if (!subRespMap[r.tarefa_id]) subRespMap[r.tarefa_id] = r.user_name || 'Fiscal';
                if (!subRespUserIdMap[r.tarefa_id]) subRespUserIdMap[r.tarefa_id] = [];
                subRespUserIdMap[r.tarefa_id].push(r.user_id);
            });
        }

        // Buscar anexos das subtarefas
        var subAnexoMap = {};
        if (subIds.length > 0) {
            var { data: subAnexos } = await supabaseClient
                .from('tarefa_anexos')
                .select('*')
                .in('tarefa_id', subIds);
            (subAnexos || []).forEach(function (a) {
                if (!subAnexoMap[a.tarefa_id]) subAnexoMap[a.tarefa_id] = [];
                subAnexoMap[a.tarefa_id].push(a);
            });
        }

        // Buscar anexos
        var { data: anexos } = await supabaseClient
            .from('tarefa_anexos')
            .select('*')
            .eq('tarefa_id', id)
            .order('uploaded_at', { ascending: true });

        // Buscar responsáveis
        var { data: responsaveis } = await supabaseClient
            .from('tarefa_responsaveis')
            .select('*')
            .eq('tarefa_id', id);

        var subs = subtarefas || [];
        var anx = anexos || [];
        var resps = responsaveis || [];

        var roleLowerRaw = (userRoleGlobal || '').toLowerCase();
        var ehGerente = (roleLowerRaw.includes('gerente') || roleLowerRaw.includes('diretor'));
        var ehResponsavel = resps.some(function (r) { return r.user_id === userIdGlobal; });
        var ehDiretor = roleLowerRaw.includes('diretor');
        var ehSecretario = (userRoleGlobal === 'Secretário(a)' || userRoleGlobal === 'Secretário(a) do Secretário(a)');
        var gerenteCriouTarefa = roleLowerRaw.includes('gerente') && tarefa.criado_por === userIdGlobal;
        var podeEditar = ehDiretor || ehSecretario || gerenteCriouTarefa || ehResponsavel;

        var html = '<div class="modal-overlay ativo" id="modal-detalhe-tarefa" onclick="if(event.target===this)fecharModal(\'modal-detalhe-tarefa\')">';
        html += '<div class="modal-container" style="max-width:600px;">';
        html += '<div class="modal-header">';
        html += '<div style="display:flex; flex-direction:column; gap:2px;">';
        if (nomeCriador) {
            html += '<div style="font-size:12px; color:#64748b; font-weight:500;">Criado por ' + escapeHtmlTarefa(nomeCriador) + '</div>';
        }
        html += '<h2 style="margin:0;">' + escapeHtmlTarefa(tarefa.titulo) + '</h2>';
        html += '</div>';
        html += '<button class="modal-close" onclick="fecharModal(\'modal-detalhe-tarefa\')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
        html += '</div><div class="modal-body" style="display:flex; flex-direction:column; gap:16px;">';

        // Verificar se todas as subtarefas estão concluídas
        var todasSubConcluidas = subs.length === 0 || subs.every(function (s) { return s.status === 'concluida'; });

        // Status — Diretor, Secretário ou Gerente que criou a tarefa podem alterar
        if (ehDiretor || ehSecretario || gerenteCriouTarefa) {
            html += '<div style="display:flex; gap:8px; flex-wrap:wrap;">';
            var statusOpts = [
                { val: 'pendente', label: 'Pendente', cor: '#f59e0b' },
                { val: 'em_progresso', label: 'Em Progresso', cor: '#3b82f6' },
                { val: 'concluida', label: 'Concluída', cor: '#10b981' }
            ];
            statusOpts.forEach(function (s) {
                var ativo = tarefa.status === s.val;
                var bloqueado = (s.val === 'concluida' && !todasSubConcluidas);
                if (bloqueado) {
                    html += '<button disabled style="padding:6px 14px; border-radius:20px; font-size:14px; font-weight:600; cursor:not-allowed; border:2px solid #cbd5e1; background:#f1f5f9; color:#94a3b8; opacity:0.6;" title="Conclua todas as subtarefas primeiro">' + s.label + '</button>';
                } else {
                    html += '<button onclick="alterarStatusTarefa(\'' + id + '\',\'' + s.val + '\')" style="padding:6px 14px; border-radius:20px; font-size:14px; font-weight:600; cursor:pointer; border:2px solid ' + s.cor + '; background:' + (ativo ? s.cor : 'white') + '; color:' + (ativo ? 'white' : s.cor) + ';">' + s.label + '</button>';
                }
            });
            if (!todasSubConcluidas) {
                html += '<div style="font-size:12px; color:#94a3b8; align-self:center; margin-left:4px;">Conclua as subtarefas para finalizar</div>';
            }
            html += '</div>';
        } else {
            // Só mostra o status atual
            var statusAtualLabel = tarefa.status === 'em_progresso' ? 'Em Progresso' : (tarefa.status === 'concluida' ? 'Concluída' : 'Pendente');
            var statusAtualCor = tarefa.status === 'em_progresso' ? '#3b82f6' : (tarefa.status === 'concluida' ? '#10b981' : '#f59e0b');
            html += '<div><span style="padding:6px 14px; border-radius:20px; font-size:14px; font-weight:600; background:' + statusAtualCor + '; color:white;">' + statusAtualLabel + '</span></div>';
        }

        // Observações
        if (tarefa.descricao) {
            html += '<div style="background:#f8fafc; padding:12px; border-radius:8px; font-size:15px; color:#475569; border:1px solid #e2e8f0;">';
            html += '<strong style="color:#1e293b;">Observações:</strong><br>' + tarefa.descricao.replace(/\n/g, '<br>');
            html += '</div>';
        }

        // Responsáveis com avatar
        if (resps.length > 0) {
            // Buscar avatares
            var respIds = resps.map(function (r) { return r.user_id; });
            var { data: respPerfis } = await supabaseClient.from('profiles').select('id, avatar_url').in('id', respIds);
            var avMap = {};
            (respPerfis || []).forEach(function (p) { avMap[p.id] = p.avatar_url || ''; });

            html += '<div style="font-size:15px; color:#475569;"><strong>Responsáveis:</strong></div>';
            html += '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:4px;">';
            resps.forEach(function (r) {
                html += '<div style="display:flex; align-items:center; gap:5px; background:#f8fafc; padding:4px 10px 4px 4px; border-radius:20px; border:1px solid #e2e8f0;">';
                var av = avMap[r.user_id] || '';
                if (av) {
                    html += '<img src="' + av + '" style="width:22px; height:22px; border-radius:50%; object-fit:cover;">';
                } else {
                    html += '<svg width="22" height="22" viewBox="0 0 24 24" fill="#cbd5e1" stroke="none"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>';
                }
                html += '<span style="font-size:14px;">' + r.user_name + '</span>';
                html += '</div>';
            });
            html += '</div>';
        }

        // Prazo
        if (tarefa.prazo) {
            var pDt = new Date(tarefa.prazo);
            html += '<div style="font-size:15px; color:#475569;"><strong>Prazo:</strong> ' + pDt.toLocaleDateString('pt-BR') + '</div>';
        }

        // Subtarefas
        html += '<div>';
        html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">';
        html += '<strong style="font-size:15px; color:#1e293b;">Subtarefas (' + subs.length + ')</strong>';
        // Diretor, Secretário e Gerente (se criou a tarefa pai) podem criar subtarefas
        var roleLowerRaw = (userRoleGlobal || '').toLowerCase();
        var ehDiretorReal = (roleLowerRaw === 'diretor(a)' || roleLowerRaw === 'diretor(a) de meio ambiente' || roleLowerRaw === 'diretor' || roleLowerRaw === 'diretor de meio ambiente');
        var ehSecretario = (userRoleGlobal === 'Secretário(a)' || userRoleGlobal === 'Secretário(a) do Secretário(a)');
        var ehGerente = roleLowerRaw.includes('gerente');
        var gerenteCriouTarefa = ehGerente && tarefa.criado_por === userIdGlobal;
        if (ehDiretorReal || ehSecretario || gerenteCriouTarefa) {
            html += '<button onclick="abrirCriarSubtarefa(\'' + id + '\')" style="background:#3b82f6; color:white; border:none; border-radius:6px; padding:4px 10px; font-size:14px; font-weight:600; cursor:pointer;">+ Subtarefa</button>';
        }
        html += '</div>';

        if (subs.length > 0) {
            var conclSub = subs.filter(function (s) { return s.status === 'concluida'; }).length;
            var pctSub = Math.round((conclSub / subs.length) * 100);
            var barC = pctSub === 100 ? '#10b981' : (pctSub >= 50 ? '#3b82f6' : '#f59e0b');

            html += '<div style="margin-bottom:8px;">';
            html += '<div style="display:flex; justify-content:space-between; font-size:14px; color:#94a3b8; margin-bottom:3px;"><span>Progresso</span><span>' + conclSub + '/' + subs.length + ' (' + pctSub + '%)</span></div>';
            html += '<div style="background:#e2e8f0; border-radius:10px; height:8px; overflow:hidden;">';
            html += '<div style="background:' + barC + '; height:100%; width:' + pctSub + '%; border-radius:10px; transition:width 0.3s;"></div>';
            html += '</div></div>';

            subs.forEach(function (s) {
                var subCheck = s.status === 'concluida' ? 'checked' : '';
                var subResp = subRespMap[s.id] || '';
                var subAnx = subAnexoMap[s.id] || [];

                html += '<div style="padding:8px 0; border-bottom:1px solid #f1f5f9;">';
                html += '<div style="display:flex; align-items:center; gap:8px;">';
                var subRespUserIds = subRespUserIdMap[s.id] || [];
                var podeConcluirSub = ehGerente || (subRespUserIds.indexOf(userIdGlobal) !== -1);
                var subTemAnexo = subAnx.length > 0;
                var subJaConcluida = s.status === 'concluida';
                if (podeConcluirSub && (subTemAnexo || subJaConcluida)) {
                    html += '<input type="checkbox" ' + subCheck + ' onchange="toggleSubtarefa(\'' + s.id + '\', this.checked)" style="width:16px; height:16px; accent-color:#10b981;">';
                } else if (podeConcluirSub && !subTemAnexo) {
                    html += '<input type="checkbox" disabled style="width:16px; height:16px; accent-color:#10b981; opacity:0.4;" title="Anexe um documento antes de concluir">';
                } else {
                    // Não é responsável: mostra apenas um indicador visual
                    html += '<span style="width:16px; height:16px; display:inline-flex; align-items:center; justify-content:center; color:' + (subJaConcluida ? '#10b981' : '#cbd5e1') + '; font-size:14px;">' + (subJaConcluida ? '✔' : '○') + '</span>';
                }
                html += '<div style="flex:1;">';
                html += '<span style="font-size:15px; color:' + (s.status === 'concluida' ? '#94a3b8' : '#334155') + '; ' + (s.status === 'concluida' ? 'text-decoration:line-through;' : '') + '">' + s.titulo + '</span>';
                if (subResp) html += '<div style="font-size:15px; color:#64748b;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> ' + subResp + '</div>';
                html += '</div>';
                if (podeConcluirSub) {
                    html += '<label style="background:#8b5cf6; color:white; border:none; border-radius:4px; padding:2px 6px; font-size:15px; cursor:pointer; white-space:nowrap; display:inline-flex; align-items:center;" title="Anexar arquivo"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg><input type="file" onchange="uploadAnexo(\'' + s.id + '\', this)" style="display:none;"></label>';
                    if (!subTemAnexo && !subJaConcluida) {
                        html += '<span style="font-size:11px; color:#ef4444; white-space:nowrap;">Anexe um doc</span>';
                    }
                }
                // Botão excluir subtarefa - Diretor, Secretário e Gerente (se criou a tarefa pai)
                if (ehDiretorReal || ehSecretario || gerenteCriouTarefa) {
                    html += '<button onclick="excluirSubtarefa(\'' + s.id + '\',\'' + id + '\')" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:14px;">✕</button>';
                }
                html += '</div>';
                // Mostrar anexos da subtarefa
                if (subAnx.length > 0) {
                    subAnx.forEach(function (a) {
                        html += '<div style="display:flex; align-items:center; gap:6px; margin-left:28px; margin-top:3px;">';
                        html += '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" style="flex-shrink:0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
                        html += '<a href="' + a.url + '" target="_blank" style="font-size:14px; color:#3b82f6; text-decoration:none; flex:1;">' + a.nome_arquivo + '</a>';
                        if (ehDiretorReal || ehSecretario || subRespUserIds.indexOf(userIdGlobal) !== -1) {
                            html += '<button onclick="excluirAnexo(\'' + a.id + '\',\'' + s.id + '\')" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:12px;">✕</button>';
                        }
                        html += '</div>';
                    });
                }
                html += '</div>';
            });
        }
        html += '</div>';

        // Anexos
        html += '<div>';
        html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">';
        html += '<strong style="font-size:15px; color:#1e293b;">Anexos (' + anx.length + ')</strong>';
        html += '<label style="background:#8b5cf6; color:white; border:none; border-radius:6px; padding:4px 10px; font-size:14px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:4px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg> Anexar<input type="file" onchange="uploadAnexo(\'' + id + '\', this)" style="display:none;"></label>';
        html += '</div>';

        anx.forEach(function (a) {
            html += '<div style="display:flex; align-items:center; gap:8px; padding:6px 8px; background:#f8fafc; border-radius:6px; margin-bottom:4px;">';
            html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" style="flex-shrink:0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
            html += '<a href="' + a.url + '" target="_blank" style="font-size:15px; color:#3b82f6; text-decoration:none; flex:1;">' + a.nome_arquivo + '</a>';
            // Diretor, Secretário ou responsável podem excluir anexos
            if (ehDiretorReal || ehSecretario || ehResponsavel) {
                html += '<button onclick="excluirAnexo(\'' + a.id + '\',\'' + id + '\')" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:14px;">✕</button>';
            }
            html += '</div>';
        });
        html += '</div>';

        // Botão excluir tarefa — apenas quem criou pode excluir
        if (tarefa.criado_por === userIdGlobal) {
            html += '<button onclick="excluirTarefa(\'' + id + '\')" style="margin-top:8px; background:#fee2e2; color:#ef4444; border:1px solid #fca5a5; border-radius:8px; padding:8px; font-size:15px; font-weight:600; cursor:pointer; width:100%; display:flex; align-items:center; justify-content:center; gap:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Excluir Tarefa</button>';
        }

        html += '</div></div></div>';

        var loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();

        document.body.insertAdjacentHTML('beforeend', html);
    } catch (err) {
        console.error('Erro ao abrir detalhe:', err);
    } finally {
        var loadingElFinal = document.getElementById('loading-detalhe-' + id);
        if (loadingElFinal) loadingElFinal.remove();
        _abrindoDetalhe = false;
    }
}

async function alterarStatusTarefa(id, novoStatus) {
    try {
        // Verificação de segurança: Diretor, Secretário ou Gerente que criou a tarefa podem alterar status
        var roleLower = (userRoleGlobal || '').toLowerCase();
        var ehDiretor = roleLower.includes('diretor');
        var ehSecretario = (userRoleGlobal === 'Secretário(a)' || userRoleGlobal === 'Secretário(a) do Secretário(a)');
        
        if (!ehDiretor && !ehSecretario) {
            var { data: tarefa } = await supabaseClient.from('tarefas').select('criado_por').eq('id', id).maybeSingle();
            if (!tarefa || tarefa.criado_por !== userIdGlobal) {
                Swal.fire('Acesso Negado', 'Apenas o Diretor, Secretário(a) ou o Gerente que criou a tarefa podem alterar o status.', 'error');
                return;
            }
        }
        
        if (novoStatus === 'concluida') {
            // Verificar se há subtarefas pendentes
            var { data: subtarefas } = await supabaseClient
                .from('tarefas')
                .select('id, status')
                .eq('tarefa_pai_id', id);
            
            if (subtarefas && subtarefas.length > 0) {
                var subtarefasPendentes = subtarefas.filter(function(s) { return s.status !== 'concluida'; });
                if (subtarefasPendentes.length > 0) {
                    Swal.fire('Ação Bloqueada', 'Existem ' + subtarefasPendentes.length + ' subtarefa(s) pendente(s). Conclua todas as subtarefas antes de concluir esta tarefa.', 'warning');
                    return;
                }
            }
            
            // Verificar anexos
            const { data: anexos } = await supabaseClient.from('tarefa_anexos').select('id').eq('tarefa_id', id).limit(1);
            // Verificar resposta (supondo que resposta seja um campo na tabela tarefas ou em outra vinculada)
            // Por enquanto, verificamos se há anexos ou se a tarefa tem algum metadado de resposta se existir
            const { data: tarefa } = await supabaseClient.from('tarefas').select('resposta').eq('id', id).maybeSingle();

            if ((!anexos || anexos.length === 0) && (!tarefa || !tarefa.resposta)) {
                Swal.fire('Ação Bloqueada', 'Para concluir esta tarefa, é obrigatório anexar um documento ou inserir uma resposta detalhada.', 'warning');
                return;
            }
        }

        await supabaseClient.from('tarefas').update({ status: novoStatus }).eq('id', id);
        fecharModal('modal-detalhe-tarefa');
        carregarTarefas();
    } catch (err) { alert('Erro: ' + err.message); }
}

async function excluirTarefa(id) {
    var { data: tarefa } = await supabaseClient.from('tarefas').select('criado_por').eq('id', id).maybeSingle();
    if (!tarefa || tarefa.criado_por !== userIdGlobal) {
        Swal.fire('Acesso Negado', 'Apenas quem criou a tarefa pode excluí-la.', 'error'); 
        return; 
    }

    if (!confirm('Excluir esta tarefa e todas as subtarefas?')) return;
    try {
        await supabaseClient.from('tarefas').delete().eq('id', id);
        fecharModal('modal-detalhe-tarefa');
        carregarTarefas();
    } catch (err) { alert('Erro: ' + err.message); }
}

// ==========================================
// SUBTAREFAS
// ==========================================
function abrirCriarSubtarefa(tarefaPaiId) {
    var html = '<div class="modal-overlay ativo" id="modal-nova-subtarefa" onclick="if(event.target===this)fecharModal(\'modal-nova-subtarefa\')">';
    html += '<div class="modal-container" style="max-width:420px;">';
    html += '<div class="modal-header"><h2>Nova Subtarefa</h2>';
    html += '<button class="modal-close" onclick="fecharModal(\'modal-nova-subtarefa\')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
    html += '</div><div class="modal-body">';
    html += '<div class="campo-grupo"><label>Título da Subtarefa</label><input type="text" id="subtarefa-titulo" placeholder="Ex: Verificar documentos"></div>';
    html += '<div class="campo-grupo"><label>Responsáveis</label><div id="subtarefa-responsaveis-list" style="max-height:180px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:10px; padding:8px; background:#f8fafc;">Carregando...</div></div>';
    html += '</div><div class="modal-footer">';
    html += '<button class="btn-cancelar" onclick="fecharModal(\'modal-nova-subtarefa\')">Cancelar</button>';
    html += '<button class="btn-salvar" onclick="confirmarSubtarefa(\'' + tarefaPaiId + '\')">Criar</button>';
    html += '</div></div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
    carregarListaResponsaveisSubtarefa();
}

// Variável global para cache de responsáveis de subtarefa
var _responsaveisSubCache = [];

async function carregarListaResponsaveisSubtarefa() {
    var container = document.getElementById('subtarefa-responsaveis-list');
    if (!container) return;
    try {
        var { data: users, error } = await supabaseClient
            .from('profiles')
            .select('id, full_name, role')
            .neq('role', 'inativo') // Fetch all active users
            .order('full_name', { ascending: true });

        if (error) throw error;

        var roleLowerRaw = (userRoleGlobal || '').toLowerCase();
        var ehDiretor = (roleLowerRaw === 'diretor(a)' || roleLowerRaw === 'diretor(a) de meio ambiente' || roleLowerRaw === 'diretor' || roleLowerRaw === 'diretor de meio ambiente');
        var ehGerenteAmbiental = roleLowerRaw.includes('regularizacao') || roleLowerRaw.includes('regularização');
        var ehGerentePosturas = roleLowerRaw.includes('gerente') && (roleLowerRaw.includes('postura') || roleLowerRaw.includes('posturas'));
        var validRoles = ['Fiscal', 'Fiscal de Posturas', 'Fiscal de Postura', 'Administrativo de Posturas', 'Administrativo de Postura', 'Gerente de Posturas', 'Gerente de Postura', 'Gerente de Regularização Ambiental', 'Diretor(a)', 'Diretor(a) de Meio Ambiente', 'Secretário(a)', 'Secretário(a) do Secretário(a)', 'secretário(a)', 'Secretario(a)', 'secretario(a)'];
        // Cargos da equipe do Gerente de Regularização Ambiental
        var cargosEquipeAmbiental = ['Engenheiro(a) Agrônomo(a)', 'Engenheiro(a) Civil', 'Analista Ambiental', 'Auxiliar de Serviços II'];

        _responsaveisSubCache = [];
        
        (users || []).forEach(function (u) {
            var roleLower = (u.role || '').toLowerCase();
            if (roleLower === 'inativo') return;

            // Se for Diretor, pode atribuir para qualquer pessoa na hierarquia (inclusive ele mesmo)

            // Se for Gerente de Posturas, só pode atribuir para si mesmo, Fiscais e Administrativos de Posturas
            if (ehGerentePosturas) {
                var isEleMesmo = u.id === userIdGlobal;
                var isFiscalPostura = roleLower.includes('fiscal') && roleLower.includes('postura');
                var isAdminPostura = roleLower.includes('administrativo') && roleLower.includes('postura');
                var isGerentePostura = roleLower.includes('gerente') && roleLower.includes('postura') && u.id === userIdGlobal;
                if (!isEleMesmo && !isFiscalPostura && !isAdminPostura && !isGerentePostura) return;
            }

            // Se for Gerente de Regularização Ambiental, pode atribuir para si mesmo ou para sua equipe
            if (ehGerenteAmbiental) {
                var isEquipeAmbiental = cargosEquipeAmbiental.indexOf(u.role) !== -1 ||
                                        roleLower.includes('engenheiro') || 
                                        roleLower.includes('agrônomo') || 
                                        roleLower.includes('agronomo') ||
                                        roleLower.includes('analista ambiental') ||
                                        roleLower.includes('auxiliar de serviços');
                if (u.id !== userIdGlobal && !isEquipeAmbiental) return;
            }

            // Verifica se é um cargo válido (comparação case-insensitive)
            var isValidRole = validRoles.some(function(r) { return r.toLowerCase() === roleLower; }) ||
                              roleLower.includes('gerente') ||
                              roleLower.includes('fiscal') ||
                              roleLower.includes('administrativo') ||
                              roleLower.includes('diretor') ||
                              roleLower.includes('secretário') ||
                              roleLower.includes('secretario');
            // Verifica se é da equipe do Gerente de Regularização Ambiental
            var isEquipeAmbiental = cargosEquipeAmbiental.indexOf(u.role) !== -1 ||
                                    roleLower.includes('engenheiro') || 
                                    roleLower.includes('agrônomo') || 
                                    roleLower.includes('agronomo') ||
                                    roleLower.includes('analista ambiental') ||
                                    roleLower.includes('auxiliar de serviços');

            if (isValidRole || isEquipeAmbiental) {
                _responsaveisSubCache.push({
                    id: u.id,
                    full_name: u.full_name,
                    role: u.role
                });
            }
        });

        // Renderizar com pesquisa
        renderizarListaResponsaveisSubComPesquisa('');
        
    } catch (err) {
        container.innerHTML = '<p style="color:#ef4444;">Erro: ' + err.message + '</p>';
    }
}

// Variável para guardar o valor atual da pesquisa de subtarefa
var _pesquisaResponsavelSubValor = '';

// Função para renderizar a lista de responsáveis da subtarefa com campo de pesquisa
function renderizarListaResponsaveisSubComPesquisa(filtro) {
    var container = document.getElementById('subtarefa-responsaveis-list');
    if (!container) return;
    
    _pesquisaResponsavelSubValor = filtro || '';
    var filtroLower = _pesquisaResponsavelSubValor.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // Na primeira renderização, cria a estrutura completa
    if (!document.getElementById('pesquisa-responsavel-sub')) {
        // Campo de pesquisa fixo
        var html = '<div style="position:sticky; top:0; background:#f8fafc; padding-bottom:8px; border-bottom:1px solid #e2e8f0; margin-bottom:8px;">';
        html += '<div style="position:relative;">';
        html += '<svg style="position:absolute; left:10px; top:50%; transform:translateY(-50%); width:16px; height:16px; color:#94a3b8; pointer-events:none;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>';
        html += '<input type="text" id="pesquisa-responsavel-sub" placeholder="Pesquisar nome ou cargo..." ';
        html += 'style="width:100%; padding:8px 12px 8px 36px; border:1px solid #e2e8f0; border-radius:8px; font-size:14px; outline:none; box-sizing:border-box;">';
        html += '</div></div>';
        
        // Lista de responsáveis (será preenchida dinamicamente)
        html += '<div id="responsaveis-sub-items" style="max-height:140px; overflow-y:auto;"></div>';
        
        // Contador
        html += '<div style="padding-top:8px; border-top:1px solid #e2e8f0; margin-top:8px; font-size:12px; color:#64748b; text-align:center;">';
        html += 'Selecionados: <span id="contador-selecionados-sub">0</span> | ';
        html += 'Mostrando: <span id="mostrando-responsaveis-sub">0</span> de ' + _responsaveisSubCache.length;
        html += '</div>';
        
        container.innerHTML = html;
        
        // Adicionar event listener no input
        document.getElementById('pesquisa-responsavel-sub').addEventListener('input', function(e) {
            filtrarResponsaveisSub(e.target.value);
        });
    }
    
    // Atualizar valor do input
    var inputPesquisa = document.getElementById('pesquisa-responsavel-sub');
    if (inputPesquisa && filtro !== undefined) {
        inputPesquisa.value = filtro;
    }
    
    // Renderizar apenas a lista de itens
    var listaContainer = document.getElementById('responsaveis-sub-items');
    if (!listaContainer) return;
    
    var usuariosFiltrados = _responsaveisSubCache.filter(function(u) {
        if (!filtroLower) return true;
        var nomeNormalizado = u.full_name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        var cargoNormalizado = (u.role || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return nomeNormalizado.includes(filtroLower) || cargoNormalizado.includes(filtroLower);
    });
    
    var html = '';
    if (usuariosFiltrados.length === 0) {
        html = '<p style="color:#94a3b8; text-align:center; padding:20px;">Nenhum responsável encontrado.</p>';
    } else {
        usuariosFiltrados.forEach(function(u) {
            html += '<label style="display:flex; align-items:center; gap:8px; padding:5px 4px; cursor:pointer; font-size:15px; color:#334155;">';
            html += '<input type="checkbox" class="cb-resp-sub" value="' + u.id + '" data-name="' + u.full_name + '" style="width:16px; height:16px; accent-color:#10b981;">';
            html += u.full_name + ' <span style="font-size:14px; color:#94a3b8;">(' + (u.role || 'Sem Cargo') + ')</span></label>';
        });
    }
    
    listaContainer.innerHTML = html;
    
    // Atualizar contadores
    atualizarContadorSelecionadosSub();
    var mostrandoEl = document.getElementById('mostrando-responsaveis-sub');
    if (mostrandoEl) {
        mostrandoEl.textContent = usuariosFiltrados.length;
    }
    
    // Adicionar listeners nos checkboxes
    var checkboxes = listaContainer.querySelectorAll('.cb-resp-sub');
    checkboxes.forEach(function(cb) {
        cb.addEventListener('change', atualizarContadorSelecionadosSub);
    });
}

// Função para filtrar responsáveis da subtarefa
function filtrarResponsaveisSub(valor) {
    renderizarListaResponsaveisSubComPesquisa(valor);
    // Restaurar foco no input após renderização
    setTimeout(function() {
        var input = document.getElementById('pesquisa-responsavel-sub');
        if (input) {
            input.focus();
            // Posicionar cursor no final do texto
            var len = input.value.length;
            input.setSelectionRange(len, len);
        }
    }, 0);
}

// Função para atualizar o contador de selecionados da subtarefa
function atualizarContadorSelecionadosSub() {
    var container = document.getElementById('subtarefa-responsaveis-list');
    if (!container) return;
    var checkboxes = container.querySelectorAll('.cb-resp-sub:checked');
    var contador = document.getElementById('contador-selecionados-sub');
    if (contador) {
        contador.textContent = checkboxes.length;
    }
}

async function confirmarSubtarefa(tarefaPaiId) {
    // Verificação de segurança: Diretor, Secretário e Gerente (se criou a tarefa pai) podem criar subtarefas
    var roleLowerRaw = (userRoleGlobal || '').toLowerCase();
    var ehDiretor = roleLowerRaw.includes('diretor');
    var ehSecretario = (userRoleGlobal === 'Secretário(a)' || userRoleGlobal === 'Secretário(a) do Secretário(a)');
    var ehGerente = roleLowerRaw.includes('gerente');
    
    // Se for Gerente, verificar se criou a tarefa pai
    var gerentePodeCriar = false;
    if (ehGerente && !ehDiretor && !ehSecretario) {
        var { data: tarefaPai } = await supabaseClient.from('tarefas').select('criado_por').eq('id', tarefaPaiId).maybeSingle();
        gerentePodeCriar = tarefaPai && tarefaPai.criado_por === userIdGlobal;
    }
    
    if (!ehDiretor && !ehSecretario && !gerentePodeCriar) {
        Swal.fire('Acesso Negado', 'Apenas o Diretor, Secretário(a) ou o Gerente que criou a tarefa podem criar subtarefas.', 'error');
        return;
    }
    
    var titulo = document.getElementById('subtarefa-titulo').value.trim();
    if (!titulo) { alert('Preencha o título da subtarefa.'); return; }

    var responsaveisCBs = document.querySelectorAll('.cb-resp-sub:checked');
    var responsaveis = [];
    responsaveisCBs.forEach(function (cb) {
        responsaveis.push({ user_id: cb.value, user_name: cb.getAttribute('data-name') });
    });

    fecharModal('modal-nova-subtarefa');

    try {
        if (responsaveis.length === 0) {
            // Sem responsável: cria uma única subtarefa
            var { error } = await supabaseClient.from('tarefas').insert({
                titulo: titulo,
                status: 'pendente',
                tarefa_pai_id: tarefaPaiId,
                criado_por: userIdGlobal
            });
            if (error) throw error;
        } else {
            // Cria uma subtarefa para cada responsável selecionado
            for (var i = 0; i < responsaveis.length; i++) {
                var r = responsaveis[i];
                var { data: nova, error: errSub } = await supabaseClient.from('tarefas').insert({
                    titulo: titulo,
                    status: 'pendente',
                    tarefa_pai_id: tarefaPaiId,
                    criado_por: userIdGlobal
                }).select().maybeSingle();
                if (errSub) throw errSub;

                await supabaseClient.from('tarefa_responsaveis').insert({
                    tarefa_id: nova.id,
                    user_id: r.user_id,
                    user_name: r.user_name
                });
            }
        }

        fecharModal('modal-detalhe-tarefa');
        abrirDetalheTarefa(tarefaPaiId);
        carregarTarefas(); // background
    } catch (err) { alert('Erro: ' + err.message); }
}

async function salvarSubtarefa(tarefaPaiId, titulo) {
    try {
        await supabaseClient.from('tarefas').insert({
            titulo: titulo,
            status: 'pendente',
            tarefa_pai_id: tarefaPaiId,
            criado_por: userIdGlobal
        });
        fecharModal('modal-detalhe-tarefa');
        abrirDetalheTarefa(tarefaPaiId);
        carregarTarefas(); // background
    } catch (err) { alert('Erro: ' + err.message); }
}

async function toggleSubtarefa(subId, checked) {
    var novoStatus = checked ? 'concluida' : 'pendente';
    try {
        // Buscar informações da subtarefa e seus responsáveis
        var { data: subInfo } = await supabaseClient
            .from('tarefas')
            .select('tarefa_pai_id, tarefa_responsaveis(user_id)')
            .eq('id', subId)
            .maybeSingle();
        
        if (!subInfo) return;
        
        // Verificar se o usuário é responsável pela subtarefa
        var responsaveis = subInfo.tarefa_responsaveis || [];
        var ehResponsavel = responsaveis.some(function(r) { return r.user_id === userIdGlobal; });
        var roleLower = (userRoleGlobal || '').toLowerCase();
        var ehDiretor = roleLower.includes('diretor');
        var ehSecretario = (userRoleGlobal === 'Secretário(a)' || userRoleGlobal === 'Secretário(a) do Secretário(a)');
        
        // Só permite concluir se for responsável ou Diretor/Secretário
        if (!ehResponsavel && !ehDiretor && !ehSecretario) {
            Swal.fire('Acesso Negado', 'Apenas o responsável pela subtarefa pode concluí-la.', 'error');
            return;
        }
        
        // Se marcando como concluída, verificar se tem anexo
        if (checked) {
            var { data: anexos } = await supabaseClient
                .from('tarefa_anexos')
                .select('id')
                .eq('tarefa_id', subId);
            if (!anexos || anexos.length === 0) {
                Swal.fire('Ação Bloqueada', 'Anexe pelo menos um documento antes de concluir esta subtarefa.', 'warning');
                if (subInfo.tarefa_pai_id) {
                    fecharModal('modal-detalhe-tarefa');
                    abrirDetalheTarefa(subInfo.tarefa_pai_id);
                }
                return;
            }
        }
        await supabaseClient.from('tarefas').update({ status: novoStatus }).eq('id', subId);
        var { data: sub } = await supabaseClient.from('tarefas').select('tarefa_pai_id').eq('id', subId).maybeSingle();
        if (sub && sub.tarefa_pai_id) {
            // Atualizar status da tarefa pai automaticamente
            if (checked) {
                var { data: todasSubs } = await supabaseClient
                    .from('tarefas')
                    .select('id, status')
                    .eq('tarefa_pai_id', sub.tarefa_pai_id);
                var todasConcluidas = (todasSubs || []).every(function (s) { return s.status === 'concluida'; });
                if (todasConcluidas && todasSubs && todasSubs.length > 0) {
                    await supabaseClient.from('tarefas').update({ status: 'concluida' }).eq('id', sub.tarefa_pai_id);
                } else {
                    await supabaseClient.from('tarefas').update({ status: 'em_progresso' }).eq('id', sub.tarefa_pai_id);
                }
            }
            fecharModal('modal-detalhe-tarefa');
            abrirDetalheTarefa(sub.tarefa_pai_id);
            carregarTarefas(); // Atualiza Kanban em background
        }
    } catch (err) { console.error(err); }
}

async function excluirSubtarefa(subId, tarefaPaiId) {
    var roleLowerRaw = (userRoleGlobal || '').toLowerCase();
    var ehDiretor = (roleLowerRaw === 'diretor(a)' || roleLowerRaw === 'diretor(a) de meio ambiente' || roleLowerRaw === 'diretor' || roleLowerRaw === 'diretor de meio ambiente');
    var ehSecretario = (userRoleGlobal === 'Secretário(a)' || userRoleGlobal === 'Secretário(a) do Secretário(a)');
    var ehGerente = roleLowerRaw.includes('gerente');
    
    // Se for Gerente, verificar se criou a tarefa pai
    var gerentePodeExcluir = false;
    if (ehGerente && !ehDiretor && !ehSecretario) {
        var { data: tarefaPai } = await supabaseClient.from('tarefas').select('criado_por').eq('id', tarefaPaiId).maybeSingle();
        gerentePodeExcluir = tarefaPai && tarefaPai.criado_por === userIdGlobal;
    }
    
    // Apenas Diretor, Secretário e Gerente (se criou a tarefa pai) podem excluir subtarefas
    if (!ehDiretor && !ehSecretario && !gerentePodeExcluir) {
        Swal.fire('Acesso Negado', 'Apenas o Diretor, Secretário(a) ou o Gerente que criou a tarefa podem excluir subtarefas.', 'error'); 
        return; 
    }

    try {
        await supabaseClient.from('tarefas').delete().eq('id', subId);
        fecharModal('modal-detalhe-tarefa');
        abrirDetalheTarefa(tarefaPaiId);
        carregarTarefas(); // Atualiza Kanban em background
    } catch (err) { alert('Erro: ' + err.message); }
}

// ==========================================
// ANEXOS
// ==========================================
async function uploadAnexo(tarefaId, inputEl) {
    var file = inputEl.files[0];
    if (!file) return;

    try {
        // Verificar se o usuário é responsável, criador ou é Diretor/Secretário
        var { data: tarefaInfo } = await supabaseClient
            .from('tarefas')
            .select('tarefa_pai_id, criado_por, tarefa_responsaveis(user_id)')
            .eq('id', tarefaId)
            .maybeSingle();
        
        if (!tarefaInfo) { Swal.fire('Erro', 'Tarefa não encontrada.', 'error'); return; }
        
        var responsaveis = tarefaInfo.tarefa_responsaveis || [];
        var ehResponsavel = responsaveis.some(function(r) { return r.user_id === userIdGlobal; });
        var ehCriador = tarefaInfo.criado_por === userIdGlobal;
        var roleLower = (userRoleGlobal || '').toLowerCase();
        var ehDiretor = roleLower.includes('diretor');
        var ehSecretario = (userRoleGlobal === 'Secretário(a)' || userRoleGlobal === 'Secretário(a) do Secretário(a)');
        
        // Só permite anexar se for responsável, criador ou Diretor/Secretário
        if (!ehResponsavel && !ehCriador && !ehDiretor && !ehSecretario) {
            Swal.fire('Acesso Negado', 'Apenas o responsável ou criador da tarefa pode anexar arquivos.', 'error');
            return;
        }
        
        var filePath = tarefaId + '/' + Date.now() + '_' + sanitizarNomeArquivo(file.name);
        var { error: uploadErr } = await supabaseClient.storage.from('tarefa_anexos').upload(filePath, file);
        if (uploadErr) {
            console.error('Erro no upload do storage:', uploadErr);
            if (uploadErr.message && uploadErr.message.toLowerCase().includes('policy')) {
                Swal.fire('Erro de Permissão', 'Falha ao enviar arquivo para o Storage. Verifique se as políticas do bucket "tarefa_anexos" permitem upload para usuários autenticados.', 'error');
            } else {
                Swal.fire('Erro no Upload', 'Falha ao enviar arquivo para o Storage: ' + uploadErr.message, 'error');
            }
            return;
        }

        var publicUrl = supabaseClient.storage.from('tarefa_anexos').getPublicUrl(filePath).data.publicUrl;

        var { error: insertErr } = await supabaseClient.from('tarefa_anexos').insert({
            tarefa_id: tarefaId,
            nome_arquivo: file.name,
            url: publicUrl
        });

        if (insertErr) {
            console.error('Erro ao salvar registro do anexo:', insertErr);
            Swal.fire('Erro no Banco', 'Arquivo enviado, mas não foi possível salvar o registro: ' + insertErr.message, 'error');
            return;
        }

        // Detectar se é subtarefa para reabrir o modal correto
        var modalId = (tarefaInfo && tarefaInfo.tarefa_pai_id) ? tarefaInfo.tarefa_pai_id : tarefaId;
        fecharModal('modal-detalhe-tarefa');
        abrirDetalheTarefa(modalId);
        carregarTarefas(); // Atualiza Kanban em background
    } catch (err) {
        console.error('Erro inesperado no upload:', err);
        Swal.fire('Erro Inesperado', err.message || 'Ocorreu um erro ao processar o anexo.', 'error');
    }
}

async function excluirAnexo(anexoId, tarefaId) {
    var roleLowerRaw = (userRoleGlobal || '').toLowerCase();
    var ehDiretor = (roleLowerRaw === 'diretor(a)' || roleLowerRaw === 'diretor(a) de meio ambiente' || roleLowerRaw === 'diretor' || roleLowerRaw === 'diretor de meio ambiente');
    var ehSecretario = (userRoleGlobal === 'Secretário(a)' || userRoleGlobal === 'Secretário(a) do Secretário(a)');
    
    // Se não for Diretor ou Secretário, verificar se é responsável pela tarefa
    if (!ehDiretor && !ehSecretario) {
        var { data: responsaveis } = await supabaseClient.from('tarefa_responsaveis').select('user_id').eq('tarefa_id', tarefaId);
        var ehResponsavel = (responsaveis || []).some(function(r) { return r.user_id === userIdGlobal; });
        if (!ehResponsavel) {
            Swal.fire('Acesso Negado', 'Apenas o responsável pela tarefa pode excluir anexos.', 'error'); 
            return; 
        }
    }

    if (!confirm('Excluir este anexo?')) return;
    try {
        // Buscar info da tarefa para saber se é subtarefa
        var { data: tarefaInfo } = await supabaseClient
            .from('tarefas')
            .select('tarefa_pai_id, status')
            .eq('id', tarefaId)
            .maybeSingle();

        await supabaseClient.from('tarefa_anexos').delete().eq('id', anexoId);

        // Se for subtarefa, verificar se ainda tem anexos
        if (tarefaInfo && tarefaInfo.tarefa_pai_id) {
            var { data: anexosRestantes } = await supabaseClient
                .from('tarefa_anexos')
                .select('id')
                .eq('tarefa_id', tarefaId);

            // Se não tem mais anexos e estava concluída, voltar para pendente
            if ((!anexosRestantes || anexosRestantes.length === 0) && tarefaInfo.status === 'concluida') {
                await supabaseClient.from('tarefas').update({ status: 'pendente' }).eq('id', tarefaId);

                // Atualizar status da tarefa pai
                var { data: todasSubs } = await supabaseClient
                    .from('tarefas')
                    .select('id, status')
                    .eq('tarefa_pai_id', tarefaInfo.tarefa_pai_id);
                var todasConcluidas = (todasSubs || []).every(function (s) { return s.status === 'concluida'; });
                if (todasConcluidas && todasSubs && todasSubs.length > 0) {
                    await supabaseClient.from('tarefas').update({ status: 'concluida' }).eq('id', tarefaInfo.tarefa_pai_id);
                } else {
                    await supabaseClient.from('tarefas').update({ status: 'em_progresso' }).eq('id', tarefaInfo.tarefa_pai_id);
                }
            }

            fecharModal('modal-detalhe-tarefa');
            abrirDetalheTarefa(tarefaInfo.tarefa_pai_id);
        } else {
            fecharModal('modal-detalhe-tarefa');
            abrirDetalheTarefa(tarefaId);
        }
        carregarTarefas(); // Atualiza em background
    } catch (err) { alert('Erro: ' + err.message); }
}

// ==========================================
// UTILITÁRIOS
// ==========================================
function fecharModal(id) {
    var m = document.getElementById(id);
    if (m) m.remove();
    if (id === 'modal-detalhe-tarefa') _abrindoDetalhe = false;
}

// ==========================================
// HISTÓRICO DE TAREFAS
// ==========================================
var historicoTarefasDados = [];

async function abrirHistoricoTarefas() {
    var html = '<div class="modal-overlay ativo" id="modal-historico-tarefas" onclick="if(event.target===this)fecharModal(\'modal-historico-tarefas\')">';
    html += '<div class="modal-container" style="max-width:700px; width:95%; height:80vh; display:flex; flex-direction:column;">';
    html += '<div class="modal-header"><h2>Histórico de Tarefas Concluídas</h2>';
    html += '<button class="modal-close" onclick="fecharModal(\'modal-historico-tarefas\')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
    html += '</div>';

    html += '<div style="padding:16px; border-bottom:1px solid #e2e8f0; display:flex; gap:12px; background:#f8fafc;">';
    html += '<input type="text" id="filtro-hist-nome" placeholder="Pesquisar por título..." style="flex:1; padding:10px; border:1px solid #cbd5e1; border-radius:8px;" oninput="filtrarHistoricoTarefas()">';
    html += '<input type="date" id="filtro-hist-data" style="padding:10px; border:1px solid #cbd5e1; border-radius:8px;" onchange="filtrarHistoricoTarefas()">';
    html += '</div>';

    html += '<div class="modal-body" id="modal-historico-lista" style="flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:12px;">';
    html += '<div id="hst-msg" style="text-align:center; padding:40px; color:#64748b;">Carregando histórico... <i class="fas fa-spinner fa-spin"></i></div>';
    html += '</div>';

    html += '<div class="modal-footer">';
    html += '<button class="btn-cancelar" onclick="fecharModal(\'modal-historico-tarefas\')">Fechar</button>';
    html += '</div></div></div>';

    document.body.insertAdjacentHTML('beforeend', html);

    var container = document.getElementById('modal-historico-lista');

    try {
        if (container) container.innerHTML = '<div style="padding:20px;">Buscando dados no servidor...</div>';

        // Buscar tarefas concluídas (limitado as 200 mais recentes)
        var query = supabaseClient
            .from('tarefas')
            .select('*')
            .eq('status', 'concluida')
            .is('tarefa_pai_id', null)
            .order('created_at', { ascending: false })
            .limit(200);

        var { data: tarefas, error } = await query;
        if (error) {
            throw new Error(error.message || JSON.stringify(error));
        }

        historicoTarefasDados = tarefas || [];

        if (container) container.innerHTML = '<div style="padding:20px;">Filtrando dados (' + historicoTarefasDados.length + ' encontrados)...</div>';

        // Filtragem Baseada no Papel do Usuário
        if (typeof userRoleGlobal !== 'undefined') {

            // Regra Específica: Gerente de Posturas vê o que criou OU onde é responsável
            var roleLowerHist = (userRoleGlobal || '').toLowerCase();
            if (roleLowerHist.includes('gerente') && roleLowerHist.includes('postur')) {
                var { data: respPosturas } = await supabaseClient.from('tarefa_responsaveis').select('tarefa_id').eq('user_id', userIdGlobal);
                var idsRespPosturas = respPosturas ? respPosturas.map(function (r) { return r.tarefa_id; }) : [];
                
                historicoTarefasDados = historicoTarefasDados.filter(function (t) {
                    return t.criado_por === userIdGlobal || idsRespPosturas.indexOf(t.id) !== -1;
                });
            }
            // Regra Específica: Gerente de Regularização Ambiental vê o que criou OU onde é responsável
            else if (roleLowerHist.includes('regularizacao') || roleLowerHist.includes('regularização')) {
                var { data: respAmbiental } = await supabaseClient.from('tarefa_responsaveis').select('tarefa_id').eq('user_id', userIdGlobal);
                var idsRespAmbiental = respAmbiental ? respAmbiental.map(function (r) { return r.tarefa_id; }) : [];
                
                historicoTarefasDados = historicoTarefasDados.filter(function (t) {
                    return t.criado_por === userIdGlobal || idsRespAmbiental.indexOf(t.id) !== -1;
                });
            }
            // Regra Específica: Fiscal e outros não-gerentes só veem o que foram ATRIBUÍDOS
            else if (!ehGerenteKanban && !roleLowerHist.includes('diretor') && !roleLowerHist.includes('secretário')) {
                var { data: minhasResp } = await supabaseClient.from('tarefa_responsaveis').select('tarefa_id').eq('user_id', userIdGlobal);
                var meusIdsTasks = minhasResp ? minhasResp.map(function (r) { return r.tarefa_id; }) : [];

                var meusIdsPai = [];
                if (meusIdsTasks.length > 0) {
                    var { data: minhasSub } = await supabaseClient.from('tarefas').select('tarefa_pai_id').in('id', meusIdsTasks).not('tarefa_pai_id', 'is', null);
                    meusIdsPai = minhasSub ? minhasSub.map(function (s) { return s.tarefa_pai_id; }) : [];
                }

                var idsPermitidos = meusIdsTasks.concat(meusIdsPai);

                historicoTarefasDados = historicoTarefasDados.filter(function (t) {
                    return idsPermitidos.indexOf(t.id) !== -1;
                });
            }
            // OBS: Adiministradores e outros Gerentes continuam enxergando tudo.
        }

        filtrarHistoricoTarefas();
    } catch (err) {
        console.error("Erro abrirHistoricoTarefas:", err);
        if (container) {
            container.innerHTML = '<div style="color:red; padding:20px;">Erro ao carregar histórico: ' + String(err) + '</div>';
        } else {
            alert('Erro ao carregar histórico: ' + String(err));
        }
    }
}

function filtrarHistoricoTarefas() {
    var container = document.getElementById('modal-historico-lista');
    if (!container) return;

    try {
        var elNome = document.getElementById('filtro-hist-nome');
        var termo = (elNome ? elNome.value.toLowerCase().trim() : '');

        var elData = document.getElementById('filtro-hist-data');
        var dataFiltro = (elData ? elData.value : '');

        var filtradas = (historicoTarefasDados || []).filter(function (t) {
            var tit = (t && t.titulo) ? String(t.titulo).toLowerCase() : '';
            var desc = (t && t.descricao) ? String(t.descricao).toLowerCase() : '';
            var matchNome = tit.includes(termo) || desc.includes(termo);

            var matchData = true;
            if (dataFiltro && t) {
                var dataT = t.updated_at ? String(t.updated_at).substring(0, 10) : (t.created_at ? String(t.created_at).substring(0, 10) : '');
                matchData = (dataT === dataFiltro);
            }
            return matchNome && matchData;
        });

        if (filtradas.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:40px; color:#94a3b8;">Nenhuma tarefa encontrada neste filtro.</div>';
            return;
        }

        var html = '';
        filtradas.forEach(function (t) {
            if (!t) return;
            var dataD = t.updated_at || t.created_at;
            var dataFeita = dataD ? new Date(dataD).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Data indefinida';

            html += '<div style="background:white; border:1px solid #e2e8f0; border-radius:10px; padding:16px; cursor:pointer; transition:all 0.2s; margin-bottom:8px;" onmouseover="this.style.borderColor=\'#cbd5e1\';this.style.boxShadow=\'0 2px 4px rgba(0,0,0,0.05)\'" onmouseout="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'" onclick="abrirDetalheTarefa(\'' + t.id + '\')">';
            html += '<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">';
            html += '<h4 style="margin:0; font-size:16px; color:#1e293b; font-weight:600;">' + (t.titulo || 'Sem título') + '</h4>';
            html += '<span style="background:#dcfce7; color:#166534; font-size:12px; font-weight:600; padding:4px 8px; border-radius:20px;">Concluída</span>';
            html += '</div>';

            if (t.descricao) {
                html += '<p style="margin:0 0 12px 0; font-size:14px; color:#64748b; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">' + t.descricao + '</p>';
            }

            html += '<div style="display:flex; gap:16px; font-size:13px; color:#94a3b8;">';
            html += '<span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px; margin-right:4px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' + dataFeita + '</span>';

            if (t.prioridade) {
                var prioStr = String(t.prioridade);
                var prioFormatada = prioStr.charAt(0).toUpperCase() + prioStr.slice(1);
                html += '<span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px; margin-right:4px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' + prioFormatada + '</span>';
            }
            html += '</div>';
            html += '</div>';
        });

        container.innerHTML = html;
    } catch (e) {
        console.error("Erro filtrarHistoricoTarefas:", e);
        var container = document.getElementById('modal-historico-lista');
        if (container) {
            container.innerHTML = '<div style="color:red; padding:20px; text-align:center;">Erro na formatação da lista: ' + String(e) + '</div>';
        }
    }
}

// ==========================================
// TAREFAS DE EVENTOS — HOME
// ==========================================
async function carregarMinhasTarefasHome(containerId) {
    var containerId = containerId || 'home-minhas-tarefas';
    var container = document.getElementById(containerId);
    if (!container) return;

    console.log('[Tarefas] carregarMinhasTarefasHome iniciado para container:', containerId);


    try {
        var authResult = await getAuthUser();
        var user = authResult.data.user;
        if (!user) return;

        // Buscar tarefas onde o usuário é responsável OU é o criador
        var { data: minhasResps, error: errR } = await supabaseClient
            .from('tarefa_responsaveis')
            .select('tarefa_id')
            .eq('user_id', user.id);

        if (errR) throw errR;
        var idsResponsavel = (minhasResps || []).map(function (r) { return r.tarefa_id; });

        // Query dinâmica para incluir tarefas criadas por ele
        var filterStr = 'criado_por.eq.' + user.id;
        if (idsResponsavel.length > 0) {
            filterStr = 'or(criado_por.eq.' + user.id + ',id.in.(' + idsResponsavel.join(',') + '))';
        }

        var { data: tarefasDiretas, error: errT } = await supabaseClient
            .from('tarefas')
            .select('*')
            .or(filterStr)
            .neq('status', 'concluida')
            .order('prazo', { ascending: true });

        if (errT) throw errT;
        var tarefas = tarefasDiretas || [];

        // Buscar subtarefas das tarefas-pai
        var paiIdsList = tarefas.filter(function (t) { return !t.tarefa_pai_id; }).map(function (t) { return t.id; });
        if (paiIdsList.length > 0) {
            var { data: subFilhas } = await supabaseClient
                .from('tarefas')
                .select('*')
                .in('tarefa_pai_id', paiIdsList)
                .neq('status', 'concluida');
            var idsJaTem = {};
            tarefas.forEach(function (t) { idsJaTem[t.id] = true; });
            (subFilhas || []).forEach(function (s) {
                if (!idsJaTem[s.id]) tarefas.push(s);
            });
        }

        // Ordenar por prazo
        tarefas.sort(function (a, b) {
            if (!a.prazo && !b.prazo) return 0;
            if (!a.prazo) return 1;
            if (!b.prazo) return -1;
            return new Date(a.prazo) - new Date(b.prazo);
        });

        // Buscar nomes das tarefas-pai para subtarefas
        var paiNomeIds = [];
        (tarefas || []).forEach(function (t) {
            if (t.tarefa_pai_id && paiNomeIds.indexOf(t.tarefa_pai_id) === -1) paiNomeIds.push(t.tarefa_pai_id);
        });
        var paiMap = {};
        if (paiNomeIds.length > 0) {
            var { data: pais } = await supabaseClient.from('tarefas').select('id, titulo').in('id', paiNomeIds);
            (pais || []).forEach(function (p) { paiMap[p.id] = p.titulo; });
        }

        if (!tarefas || tarefas.length === 0) {
            container.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:20px; font-size:15px;">Nenhuma tarefa pendente.</div>';
            return;
        }

        // Buscar subtarefas para calcular progresso
        var ids = tarefas.map(function (t) { return t.id; });
        var subs = [];
        if (ids.length > 0) {
            var { data: sData } = await supabaseClient
                .from('tarefas')
                .select('id, tarefa_pai_id, status')
                .in('tarefa_pai_id', ids);
            subs = sData || [];
        }

        var subMap = {};
        (subs || []).forEach(function (s) {
            if (!subMap[s.tarefa_pai_id]) subMap[s.tarefa_pai_id] = { total: 0, done: 0 };
            subMap[s.tarefa_pai_id].total++;
            if (s.status === 'concluida') subMap[s.tarefa_pai_id].done++;
        });

        var hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        // Separar e ordenar: atrasadas primeiro (by prazo asc), depois pendentes (by prazo asc)
        var atrasadas = [];
        var pendentes = [];
        tarefas.forEach(function (t) {
            if (t.prazo && new Date(t.prazo) < hoje) {
                atrasadas.push(t);
            } else {
                pendentes.push(t);
            }
        });
        var ordenadas = atrasadas.concat(pendentes);

        // Renderizar tabela
        var html = '<table style="width:100%; border-collapse:collapse; font-size:15px;">';
        html += '<thead><tr style="border-bottom:2px solid #e2e8f0;">';
        html += '<th style="text-align:left; padding:8px 10px; color:#64748b; font-weight:600;">Tarefa</th>';
        html += '<th style="text-align:center; padding:8px 10px; color:#64748b; font-weight:600; width:100px;">Prazo</th>';
        html += '<th style="text-align:center; padding:8px 10px; color:#64748b; font-weight:600; width:110px;">Status</th>';
        html += '<th style="text-align:center; padding:8px 10px; color:#64748b; font-weight:600; width:100px;">Progresso</th>';
        html += '</tr></thead><tbody>';

        ordenadas.forEach(function (t) {
            var prazoDt = t.prazo ? new Date(t.prazo) : null;
            var atrasada = prazoDt && prazoDt < hoje;
            var diasRestantes = prazoDt ? Math.ceil((prazoDt - hoje) / (1000 * 60 * 60 * 24)) : null;

            var rowBg = atrasada ? '#fef2f2' : 'white';
            var rowBorder = atrasada ? '#fca5a5' : '#f1f5f9';
            var textColor = atrasada ? '#dc2626' : '#334155';

            html += '<tr style="background:' + rowBg + '; border-bottom:1px solid ' + rowBorder + '; cursor:pointer;" onclick="mudarAba(\'tarefas\')">';

            // Tarefa
            var ehSub = !!t.tarefa_pai_id;
            var nomePai = ehSub ? (paiMap[t.tarefa_pai_id] || '') : '';
            html += '<td style="padding:10px; color:' + textColor + '; font-weight:500;">';
            if (ehSub) html += '<span style="font-size:15px; color:#94a3b8; display:block;">' + nomePai + '</span>↳ ';
            html += t.titulo;
            if (atrasada) html += ' <span style="font-size:15px; background:#ef4444; color:white; padding:1px 6px; border-radius:10px; font-weight:700; margin-left:6px;">ATRASADA</span>';
            html += '</td>';

            // Prazo
            if (prazoDt) {
                var prazoStr = String(prazoDt.getDate()).padStart(2, '0') + '/' + String(prazoDt.getMonth() + 1).padStart(2, '0');
                var prazoColor = atrasada ? '#dc2626' : (diasRestantes <= 2 ? '#f59e0b' : '#64748b');
                html += '<td style="text-align:center; padding:10px; color:' + prazoColor + '; font-weight:' + (atrasada ? '700' : '500') + ';">' + prazoStr + '</td>';
            } else {
                html += '<td style="text-align:center; padding:10px; color:#cbd5e1;">—</td>';
            }

            // Status
            var statusLabel = t.status === 'em_progresso' ? 'Em progresso' : 'Pendente';
            var statusColor = t.status === 'em_progresso' ? '#3b82f6' : '#f59e0b';
            html += '<td style="text-align:center; padding:10px;"><span style="background:' + statusColor + '15; color:' + statusColor + '; padding:3px 10px; border-radius:12px; font-size:14px; font-weight:600;">' + statusLabel + '</span></td>';

            // Progresso subtarefas
            var sub = subMap[t.id];
            if (sub && sub.total > 0) {
                var pct = Math.round((sub.done / sub.total) * 100);
                var barColor = pct === 100 ? '#10b981' : (pct >= 50 ? '#3b82f6' : '#f59e0b');
                html += '<td style="padding:10px;">';
                html += '<div style="display:flex; align-items:center; gap:6px;">';
                html += '<div style="flex:1; background:#e2e8f0; border-radius:10px; height:6px; overflow:hidden;">';
                html += '<div style="background:' + barColor + '; height:100%; width:' + pct + '%; border-radius:10px;"></div></div>';
                html += '<span style="font-size:15px; color:#94a3b8; white-space:nowrap;">' + pct + '%</span>';
                html += '</div></td>';
            } else {
                html += '<td style="text-align:center; padding:10px; color:#cbd5e1; font-size:14px;">—</td>';
            }

            html += '</tr>';
        });

        html += '</tbody></table>';
        container.innerHTML = html;

    } catch (err) {
        console.error('Erro ao carregar minhas tarefas:', err);
        container.innerHTML = '<div style="text-align:center; color:#ef4444; padding:20px; font-size:15px;">Erro ao carregar tarefas.</div>';
    }
}

// ==========================================
// PROJETOS (TAREFAS DE EVENTOS NO MODULO)
// ==========================================
async function carregarMinhasTarefasModulo() {
    // Se ainda estiver iniciando o módulo, espera
    if (!moduloIniciado && !inicializacaoPromise) {
        await carregarModuloTarefas();
    }

    var container = document.getElementById('minhas-tarefas-container');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:30px; font-size:15px;">Processando eventos...</div>';

    try {
        var idsInteresse = [];
        var roleLowerRaw = (userRoleGlobal || '').toLowerCase();
        console.log('[Tarefas] carregarMinhasTarefasModulo - modo:', diretorModoVisualizacao, 'role:', userRoleGlobal);
        console.log('[Tarefas] idsGerentesGlobal:', idsGerentesGlobal.length, 'idsGerentesAmbientalGlobal:', idsGerentesAmbientalGlobal.length);
        
        if (roleLowerRaw.includes('diretor')) {
            if (diretorModoVisualizacao === 'direcao') {
                idsInteresse = [userIdGlobal];
            } else if (diretorModoVisualizacao === 'gerencia_ambiental') {
                idsInteresse = idsEquipeAmbientalGlobal;
            } else if (diretorModoVisualizacao === 'cuidado_animal') {
                idsInteresse = idsEquipeCAGlobal;
            } else {
                // Gerência de Posturas
                idsInteresse = idsGerentesGlobal.concat(idsFiscaisPosturasGlobal);
            }
        } else if (userRoleGlobal === 'Secretário(a)' || userRoleGlobal === 'Secretário(a) do Secretário(a)') {
            var modeSec = window.secretarioModoVisualizacao || 'normal';
            if (modeSec === 'direcao') {
                if (window.secretarioModoGerencia) {
                    idsInteresse = idsGerentesGlobal.concat(idsFiscaisPosturasGlobal);
                } else {
                    idsInteresse = idsDiretoresGlobal;
                }
            } else if (modeSec === 'gerencia_ambiental') {
                idsInteresse = idsEquipeAmbientalGlobal;
            } else if (modeSec === 'cuidado_animal') {
                idsInteresse = idsEquipeCAGlobal;
            } else if (modeSec === 'juridico') {
                idsInteresse = idsJuridicoGlobal;
            } else if (modeSec === 'recursos_humanos') {
                idsInteresse = idsRHGlobal;
            } else {
                idsInteresse = [userIdGlobal]; // No modo normal, vê as próprias
            }
        } else if (roleLowerRaw.includes('gerente')) {
            var roleNormMod = roleLowerRaw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            var isRA = roleNormMod.includes('regularizacao');
            var isCA = roleNormMod.includes('cuidado') && roleNormMod.includes('animal');
            var isJuridicoAutoMod = roleNormMod.includes('interface') && roleNormMod.includes('juridica');

            if (isJuridicoAutoMod) {
                idsInteresse = [userIdGlobal];
            } else if (isRA) {
                idsInteresse = idsEquipeAmbientalGlobal;
            } else if (isCA) {
                idsInteresse = idsEquipeCAGlobal;
            } else {
                // Gerente de Posturas
                idsInteresse = idsGerentesGlobal.concat(idsFiscaisPosturasGlobal);
            }
        } else {
            idsInteresse = [userIdGlobal];
        }

        console.log('[Tarefas] idsInteresse final:', idsInteresse.length);

        if (idsInteresse.length === 0) {
            container.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:30px; font-size:15px;">Nenhum responsável mapeado.</div>';
            return;
        }

        // Buscar tarefas de interesse com projeto vinculado
        var { data: tarefas, error } = await supabaseClient
            .from('tarefas')
            .select('*, evento:eventos!evento_id(titulo)')
            .not('evento_id', 'is', null)
            .order('prazo', { ascending: true });

        if (error) throw error;

        // Filtrar no JS por responsabilidade (mais seguro para joins complexos)
        var { data: resps } = await supabaseClient.from('tarefa_responsaveis').select('tarefa_id, user_id').in('user_id', idsInteresse);
        var respIdsSet = new Set((resps || []).map(r => r.tarefa_id));

        var filtradas = (tarefas || []).filter(t => respIdsSet.has(t.id) || t.criado_por === userIdGlobal);

        if (filtradas.length === 0) {
            var msg = 'Você não possui tarefas de eventos.';
            if (diretorModoVisualizacao === 'gerencia' || diretorModoVisualizacao === 'gerencia_posturas') {
                msg = 'Os gerentes de posturas não possuem tarefas de eventos.';
            } else if (diretorModoVisualizacao === 'gerencia_ambiental') {
                msg = 'Os gerentes de regularização ambiental não possuem tarefas de eventos.';
            }
            container.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:30px; font-size:15px;">' + msg + '</div>';
            return;
        }

        var html = '<table style="width:100%; border-collapse:collapse; font-size:14px; background:white; border-radius:10px; overflow:hidden;">';
        html += '<thead style="background:#f8fafc;"><tr style="border-bottom:2px solid #e2e8f0;">';
        html += '<th style="text-align:left; padding:12px; color:#64748b; font-weight:600;">Projeto</th>';
        html += '<th style="text-align:left; padding:12px; color:#64748b; font-weight:600;">Tarefa</th>';
        html += '<th style="text-align:center; padding:12px; color:#64748b; font-weight:600; width:100px;">Prazo</th>';
        html += '<th style="text-align:center; padding:12px; color:#64748b; font-weight:600; width:120px;">Status</th>';
        html += '</tr></thead><tbody>';

        var hoje = new Date(); hoje.setHours(0, 0, 0, 0);

        filtradas.forEach(function (t) {
            var prazoDt = t.prazo ? new Date(t.prazo) : null;
            var atrasada = prazoDt && prazoDt < hoje && t.status !== 'concluida';
            var corStatus = t.status === 'concluida' ? '#10b981' : (t.status === 'em_progresso' ? '#3b82f6' : '#f59e0b');
            var labelStatus = t.status === 'concluida' ? 'Concluída' : (t.status === 'em_progresso' ? 'Em progresso' : 'Pendente');

            html += '<tr style="border-bottom:1px solid #f1f5f9; cursor:pointer;" onclick="abrirDetalheTarefa(\'' + t.id + '\')">';
            html += '<td style="padding:12px; font-weight:600; color:#0c3e2b;">' + (t.evento ? t.evento.titulo : 'Sem Nome') + '</td>';
            html += '<td style="padding:12px; color:#1e293b;">' + t.titulo + '</td>';
            html += '<td style="text-align:center; padding:12px; color:' + (atrasada ? '#ef4444' : '#64748b') + '; font-weight:' + (atrasada ? '700' : '400') + ';">' + (prazoDt ? prazoDt.toLocaleDateString('pt-BR') : '—') + '</td>';
            html += '<td style="text-align:center; padding:12px;"><span style="background:' + corStatus + '15; color:' + corStatus + '; padding:4px 10px; border-radius:12px; font-weight:600; font-size:13px;">' + labelStatus + '</span></td>';
            html += '</tr>';
        });

        html += '</tbody></table>';
        container.innerHTML = html;

    } catch (err) {
        console.error(err);
        container.innerHTML = '<div style="text-align:center; color:#ef4444; padding:20px;">Erro ao carregar lista de eventos.</div>';
    }
}

function trocarAbaTarefas(aba) {
    var btnAtribuidas = document.getElementById('btn-tab-atribuidas');
    var btnMinhas = document.getElementById('btn-tab-minhas');
    var contAtribuidas = document.getElementById('tarefas-atribuidas-container');
    var contMinhas = document.getElementById('minhas-tarefas-container');

    if (!btnAtribuidas || !btnMinhas || !contAtribuidas || !contMinhas) return;

    // Reset styles
    btnAtribuidas.className = 'sub-aba-btn';
    btnAtribuidas.style.background = 'transparent';
    btnAtribuidas.style.color = '#475569';
    btnAtribuidas.style.border = '1px solid #cbd5e1';
    btnAtribuidas.style.boxShadow = 'none';

    btnMinhas.className = 'sub-aba-btn';
    btnMinhas.style.background = 'transparent';
    btnMinhas.style.color = '#475569';
    btnMinhas.style.border = '1px solid #cbd5e1';
    btnMinhas.style.boxShadow = 'none';

    var btnAtivo = aba === 'atribuidas' ? btnAtribuidas : btnMinhas;
    btnAtivo.className = 'sub-aba-btn active';
    btnAtivo.style.background = 'linear-gradient(135deg, #062117, #0c3e2b)';
    btnAtivo.style.color = 'white';
    btnAtivo.style.border = 'none';
    btnAtivo.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';

    if (aba === 'atribuidas') {
        contAtribuidas.style.display = 'block';
        contMinhas.style.display = 'none';
        carregarTarefas(); // Refresh
    } else {
        contAtribuidas.style.display = 'none';
        contMinhas.style.display = 'block';
        carregarMinhasTarefasModulo();
    }
}

let tarefasTemporariasEvento = [];

function renderizarListaTarefasTemporarias() {
    const cont = document.getElementById('ev-tarefas-lista');
    if (!cont) return;

    if (tarefasTemporariasEvento.length === 0) {
        cont.innerHTML = '<p style="color: #94a3b8; font-size: 13px; font-style: italic;">Nenhuma tarefa adicionada ainda.</p>';
        return;
    }

    let html = '';
    tarefasTemporariasEvento.forEach((t, idx) => {
        const resps = t.responsaveis.map(r => r.user_name).join(', ');
        html += `<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 15px; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
            <div style="flex: 1;">
                <div style="font-weight: 700; color: #1e293b; font-size: 14px;">${t.titulo}</div>
                <div style="font-size: 12px; color: #64748b;">Prazo: ${t.prazo || 'Não definido'} | Resp: ${resps}</div>
            </div>
            <button onclick="removerTarefaTemporaria(${idx})" style="background: none; border: none; color: #94a3b8; cursor: pointer; transition: 0.2s;" onmouseover="this.style.color='#ef4444'">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>`;
    });
    cont.innerHTML = html;
}

function removerTarefaTemporaria(idx) {
    tarefasTemporariasEvento.splice(idx, 1);
    renderizarListaTarefasTemporarias();
}

function abrirModalNovoEventoAvancado() {
    // Verificação de segurança: apenas Diretor e Secretário podem criar eventos
    var roleLowerRaw = (userRoleGlobal || '').toLowerCase();
    var ehDiretor = roleLowerRaw.includes('diretor');
    var ehSecretario = (userRoleGlobal === 'Secretário(a)' || userRoleGlobal === 'Secretário(a) do Secretário(a)');
    if (!ehDiretor && !ehSecretario) {
        Swal.fire('Acesso Negado', 'Apenas o Diretor ou Secretário(a) podem criar eventos.', 'error');
        return;
    }

    tarefasTemporariasEvento = [];
    arquivosTemporariosEvento = []; // Reset arquivos evento
    _vincularEventoId = null; // Reset vínculo ao abrir novo
    var html = '<div class="modal-overlay ativo" id="modal-evento-avancado" onclick="if(event.target===this)fecharModal(\'modal-evento-avancado\')">';
    html += '<div class="modal-container" style="max-width:700px;">';

    html += '<div class="modal-header"><h2>Novo Projeto / Evento</h2>';
    html += '<button class="modal-close" onclick="fecharModal(\'modal-evento-avancado\')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
    html += '</div>';

    html += '<div class="modal-body" style="background: #fff; padding: 25px;">';

    // Seção Superior: Título e Descrição
    html += '<div class="campo-grupo"><label>Título do Evento / Projeto</label><input type="text" id="ev-titulo" placeholder="Ex: Mutirão de Limpeza Vila Nova"></div>';
    html += '<div class="campo-grupo"><label>Descrição Detalhada</label><textarea id="ev-descricao" rows="2" placeholder="Objetivos e informações base..."></textarea></div>';

    // Grid: Data, Cor e Documentos
    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px;">';

    // Coluna Esquerda: Data e Documentos
    html += '<div>';
    html += '<div class="campo-grupo"><label>Data do evento</label><input type="date" id="ev-data-inicio"></div>';

    html += '<div class="campo-grupo" style="margin-top: 15px;">';
    html += '<label>Documentos</label>';
    html += '<label style="display:flex; align-items:center; gap:8px; padding:10px; border:2px dashed #cbd5e1; border-radius:10px; cursor:pointer; background:#f8fafc; transition:0.2s;" onmouseover="this.style.borderColor=\'#10b981\'" onmouseout="this.style.borderColor=\'#cbd5e1\'">';
    html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>';
    html += '<span style="font-size:13px; color:#64748b;">Anexar arquivos (PDF, Imagens)</span>';
    html += '<input type="file" id="ev-anexos-input" multiple style="display:none;" onchange="adicionarArquivosEvento(this)">';
    html += '</label>';
    html += '<div id="ev-anexos-preview" style="margin-top:8px; display:flex; flex-wrap:wrap; gap:5px;"></div>';
    html += '</div>';
    html += '</div>';

    // Coluna Direita: Cores (2 carreiras = 5 colunas para as 10 novas cores)
    html += '<div style="background: #f8fafc; padding: 15px; border-radius: 12px; border: 1px solid #f1f5f9; height: fit-content;">';
    html += '<label style="font-weight: 700; color: #475569; display: block; margin-bottom: 10px; font-size: 13px;">Cor do Evento</label>';
    html += '<div id="ev-cor-grid" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px;">';
    const cores = ['#FF4D6D', '#F94144', '#F3722C', '#F8961E', '#F9C74F', '#90BE6D', '#43AA8B', '#00B4D8', '#0077B6', '#7209B7'];
    cores.forEach((c, idx) => {
        const selected = idx === 0 ? 'border: 2px solid #334155; transform: scale(1.1);' : 'border: 1px solid #e2e8f0;';
        html += `<div onclick="selecionarCorEvento('${c}', this)" style="width: 30px; height: 30px; background: ${c}; border-radius: 6px; cursor: pointer; transition: 0.2s; ${selected}" class="ev-cor-dot"></div>`;
    });
    html += '<input type="hidden" id="ev-cor" value="#FF4D6D">';
    html += '</div>';
    html += '</div>';

    html += '</div>'; // Fecha grid superior

    // Seção Tarefas do Projeto
    html += '<div style="border-top: 1px solid #f1f5f9; padding-top: 20px; margin-top: 20px;">';
    html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">';
    html += '<div><label style="font-weight: 700; color: #1e293b; font-size: 14px; display: block;">Tarefas Vinculadas</label><span style="font-size: 12px; color: #64748b;">Clique abaixo para adicionar tarefas ao projeto.</span></div>';
    html += '<button onclick="abrirModalNovaTarefa(true)" style="background: #10b981; border: none; color: white; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 12px rgba(16,185,129,0.2);">+ Inserir Tarefa</button>';
    html += '</div>';

    html += '<div id="ev-tarefas-lista" style="display: flex; flex-direction: column; gap: 10px;">';
    html += '<p style="color: #94a3b8; font-size: 13px; font-style: italic;">Nenhuma tarefa adicionada ainda.</p>';
    html += '</div>';
    html += '</div>';

    html += '</div>'; // Fecha modal-body

    html += '<div class="modal-footer" style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 15px 25px;">';
    html += '<button class="btn-cancelar" onclick="fecharModal(\'modal-evento-avancado\')">Cancelar</button>';
    html += '<button class="btn-salvar" onclick="salvarEventoAvancado()" id="btn-salvar-ev" style="background: #10b981; padding: 8px 30px;">Criar Projeto / Evento</button>';
    html += '</div>';

    html += '</div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
    carregarResponsaveisEmTodosSelects();
}

function selecionarCorEvento(cor, el) {
    document.querySelectorAll('.ev-cor-dot').forEach(d => {
        d.style.border = 'none';
        d.style.transform = 'none';
    });
    el.style.border = '3px solid #004d40';
    el.style.transform = 'scale(1.15)';
    document.getElementById('ev-cor').value = cor;
}

async function carregarResponsaveisEmTodosSelects() {
    var selects = document.querySelectorAll('.ev-task-responsaveis');
    try {
        var { data: users, error } = await supabaseClient.from('profiles').select('id, full_name, role').order('full_name', { ascending: true });
        if (error) throw error;

        selects.forEach(sel => {
            popularSelectResponsaveis(sel, users);
        });
    } catch (e) { console.error("Erro ao carregar responsáveis:", e); }
}

function popularSelectResponsaveis(select, users) {
    var html = '';
    (users || []).forEach(function (u) {
        var role = (u.role || '').toLowerCase();
        if (role.includes('gerente') || role.includes('administrativo') || role.includes('diretor')) {
            html += '<option value="' + u.id + '">' + u.full_name + '</option>';
        }
    });
    select.innerHTML = html;
}


let arquivosTemporariosEvento = [];

function adicionarArquivosEvento(input) {
    if (!input.files) return;
    for (var i = 0; i < input.files.length; i++) {
        arquivosTemporariosEvento.push(input.files[i]);
    }
    input.value = ''; // Limpa o input para permitir selecionar o mesmo arquivo se quiser
    renderizarPreviewArquivosEvento();
}

function removerArquivoEvento(index) {
    arquivosTemporariosEvento.splice(index, 1);
    renderizarPreviewArquivosEvento();
}

function renderizarPreviewArquivosEvento() {
    var container = document.getElementById('ev-anexos-preview');
    if (!container) return;
    container.innerHTML = '';
    arquivosTemporariosEvento.forEach((f, idx) => {
        container.innerHTML += `
            <span style="background:#e8f5e9; color:#2e7d32; padding:5px 10px; border-radius:10px; font-size:13px; border:1px solid #c8e6c9; display:flex; align-items:center; gap:6px;">
                ${f.name}
                <button onclick="removerArquivoEvento(${idx})" style="background:none; border:none; color:#2e7d32; cursor:pointer; font-weight:bold; font-size:14px; padding:0 2px;">×</button>
            </span>`;
    });
}

async function salvarEventoAvancado() {
    // Verificação de segurança: apenas Diretor e Secretário podem criar eventos
    var roleLowerRaw = (userRoleGlobal || '').toLowerCase();
    var ehDiretor = roleLowerRaw.includes('diretor');
    var ehSecretario = (userRoleGlobal === 'Secretário(a)' || userRoleGlobal === 'Secretário(a) do Secretário(a)');
    if (!ehDiretor && !ehSecretario) {
        Swal.fire('Acesso Negado', 'Apenas o Diretor ou Secretário(a) podem criar eventos.', 'error');
        return;
    }
    
    var titulo = document.getElementById('ev-titulo').value.trim();
    var descricao = document.getElementById('ev-descricao').value.trim();
    var dataInicio = document.getElementById('ev-data-inicio').value;
    var cor = document.getElementById('ev-cor').value;
    var arquivos = arquivosTemporariosEvento; // Usar array em memória

    if (!titulo || !dataInicio) { Swal.fire('Atenção', 'Título e Data são obrigatórios.', 'warning'); return; }

    var btn = document.getElementById('btn-salvar-ev');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    try {
        // 1. Inserir Evento
        var { data: evData, error: evError } = await supabaseClient.from('eventos').insert({
            titulo: titulo,
            descricao: descricao,
            data_inicio: dataInicio + 'T09:00:00',
            cor: cor,
            criado_por: userIdGlobal
        }).select('*').maybeSingle();

        if (evError) throw evError;
        var eventoId = evData.id;

        // 2. Upload de Arquivos
        if (arquivos && arquivos.length > 0) {
            await uploadArquivosEvento(eventoId, arquivos);
        }

        // 3. Processar Tarefas Temporárias
        var listaGerentesNomes = [];

        for (var t of tarefasTemporariasEvento) {
            // Criar a Tarefa Base
            var { data: tData, error: tError } = await supabaseClient.from('tarefas').insert({
                titulo: t.titulo,
                descricao: (t.descricao || '') + '\n\n[VINCULADA AO PROJETO: ' + titulo + ']',
                prazo: t.prazo ? t.prazo + 'T23:59:59' : (dataInicio + 'T23:59:59'),
                status: 'pendente',
                criado_por: userIdGlobal,
                evento_id: eventoId
            }).select().maybeSingle();

            if (tError) throw tError;

            // Inserir Responsáveis da Tarefa
            if (t.responsaveis && t.responsaveis.length > 0) {
                var resps = t.responsaveis.map(function (r) {
                    if (!listaGerentesNomes.includes(r.user_name)) listaGerentesNomes.push(r.user_name);
                    return { tarefa_id: tData.id, user_id: r.user_id, user_name: r.user_name };
                });
                await supabaseClient.from('tarefa_responsaveis').insert(resps);
            }

            // Inserir Anexos da Tarefa (se houver arquivos pendentes)
            if (t.arquivos && t.arquivos.length > 0) {
                // Aqui poderíamos chamar uma função de upload específica para tarefas
                // Por simplicidade, vamos usar o mesmo bucket
                for (var f of t.arquivos) {
                    var path = 'tarefas/' + tData.id + '/' + Date.now() + '_' + sanitizarNomeArquivo(f.name);
                    var { error: upErr } = await supabaseClient.storage.from('tarefa_anexos').upload(path, f);
                    if (upErr) continue;
                    var { data: urlData } = supabaseClient.storage.from('tarefa_anexos').getPublicUrl(path);
                    await supabaseClient.from('tarefa_anexos').insert({
                        tarefa_id: tData.id,
                        nome_arquivo: f.name,
                        url: urlData.publicUrl
                    });
                }
            }
        }

        // 4. Atualizar Responsáveis do Evento (Campo texto para exibição)
        if (listaGerentesNomes.length > 0) {
            await supabaseClient.from('eventos').update({ responsaveis: listaGerentesNomes.join(', ') }).eq('id', eventoId);
        }

        fecharModal('modal-evento-avancado');
        Swal.fire('Sucesso!', 'Projeto e tarefas criados com sucesso.', 'success');
        carregarEventos();

    } catch (err) {
        console.error(err);
        Swal.fire('Erro', 'Falha ao salvar: ' + err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Criar Projeto';
    }
}

async function uploadArquivosEvento(eventoId, files) {
    for (var i = 0; i < files.length; i++) {
        var file = files[i];
        var path = eventoId + '/' + Date.now() + '_' + sanitizarNomeArquivo(file.name);
        var { data, error } = await supabaseClient.storage.from('tarefa_anexos').upload(path, file);
        if (error) continue;

        var { data: urlData } = supabaseClient.storage.from('tarefa_anexos').getPublicUrl(path);

        await supabaseClient.from('evento_anexos').insert({
            evento_id: eventoId,
            nome_arquivo: file.name,
            url: urlData.publicUrl
        });
    }
}
async function abrirModalEditarEvento(id) {
    // Verificação de segurança: apenas Diretor e Secretário podem editar eventos
    var roleLowerRaw = (userRoleGlobal || '').toLowerCase();
    var ehDiretor = (roleLowerRaw === 'diretor(a)' || roleLowerRaw === 'diretor(a) de meio ambiente' || roleLowerRaw === 'diretor' || roleLowerRaw === 'diretor de meio ambiente');
    var ehSecretario = (userRoleGlobal === 'Secretário(a)' || userRoleGlobal === 'Secretário(a) do Secretário(a)');
    
    // Apenas Diretor e Secretário podem editar eventos
    if (!ehDiretor && !ehSecretario) {
        Swal.fire('Acesso Negado', 'Apenas o Diretor ou Secretário(a) podem editar eventos.', 'error');
        return;
    }
    
    var ev = eventosMesCache.find(e => e.id === id);
    if (!ev) return;

    arquivosTemporariosEvento = []; // Reset para novos anexos

    var dataFormatada = ev.data_inicio ? ev.data_inicio.split('T')[0] : '';

    var html = '<div class="modal-overlay ativo" id="modal-editar-evento" onclick="if(event.target===this)fecharModal(\'modal-editar-evento\')">';
    html += '<div class="modal-container" style="max-width:500px;">';
    html += '<div class="modal-header"><h2>Editar Projeto / Evento</h2>';
    html += '<button class="modal-close" onclick="fecharModal(\'modal-editar-evento\')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
    html += '</div><div class="modal-body">';

    html += '<div class="campo-grupo"><label>Título</label><input type="text" id="edit-ev-titulo" value="' + (ev.titulo || '') + '" style="width:100%; border:1px solid #cbd5e1; border-radius:8px; padding:10px;"></div>';
    html += '<div class="campo-grupo"><label>Data do evento</label><input type="date" id="edit-ev-data" value="' + dataFormatada + '" style="width:100%; border:1px solid #cbd5e1; border-radius:8px; padding:10px;"></div>';
    html += '<div class="campo-grupo"><label>Descrição</label><textarea id="edit-ev-descricao" rows="3" style="width:100%; border:1px solid #cbd5e1; border-radius:8px; padding:10px;">' + (ev.descricao || '') + '</textarea></div>';

    html += '<div class="campo-grupo"><label style="font-weight:700; color:#475569; display:block; margin-bottom:8px;">Anexar mais Documentos</label>';
    html += '<label style="display:flex; align-items:center; gap:8px; padding:10px; border:2px dashed #cbd5e1; border-radius:10px; cursor:pointer; background:#f8fafc;">';
    html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>';
    html += '<span style="font-size:13px; color:#64748b;">Selecionar novos arquivos</span>';
    html += '<input type="file" id="edit-ev-anexos-input" multiple style="display:none;" onchange="adicionarArquivosEvento(this, true)">';
    html += '</label>';
    html += '<div id="edit-ev-anexos-preview" style="margin-top:8px; display:flex; flex-wrap:wrap; gap:5px;"></div>';
    html += '</div>';

    html += '</div><div class="modal-footer">';
    html += '<button class="btn-cancelar" onclick="fecharModal(\'modal-editar-evento\')">Cancelar</button>';
    html += '<button class="btn-salvar" id="btn-salvar-edit-ev" onclick="salvarEdicaoEvento(\'' + id + '\')">Salvar Alterações</button>';
    html += '</div></div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
}

// Sobrecarga para suportar preview no modal de edição
function adicionarArquivosEvento(input, isEdit = false) {
    if (!input.files) return;
    for (var i = 0; i < input.files.length; i++) {
        arquivosTemporariosEvento.push(input.files[i]);
    }
    input.value = '';
    if (isEdit) renderizarPreviewArquivosEventoEdit();
    else renderizarPreviewArquivosEvento();
}

function renderizarPreviewArquivosEventoEdit() {
    var container = document.getElementById('edit-ev-anexos-preview');
    if (!container) return;
    container.innerHTML = '';
    arquivosTemporariosEvento.forEach((f, idx) => {
        container.innerHTML += `
            <span style="background:#e8f5e9; color:#2e7d32; padding:5px 10px; border-radius:10px; font-size:13px; border:1px solid #c8e6c9; display:flex; align-items:center; gap:6px;">
                ${f.name}
                <button onclick="removerArquivoEventoEdit(${idx})" style="background:none; border:none; color:#2e7d32; cursor:pointer; font-weight:bold; font-size:14px; padding:0 2px;">×</button>
            </span>`;
    });
}

function removerArquivoEventoEdit(idx) {
    arquivosTemporariosEvento.splice(idx, 1);
    renderizarPreviewArquivosEventoEdit();
}

async function salvarEdicaoEvento(id) {
    // Verificação de segurança: apenas Diretor e Secretário podem editar eventos
    var roleLowerRaw = (userRoleGlobal || '').toLowerCase();
    var ehDiretor = roleLowerRaw.includes('diretor');
    var ehSecretario = (userRoleGlobal === 'Secretário(a)' || userRoleGlobal === 'Secretário(a) do Secretário(a)');
    if (!ehDiretor && !ehSecretario) {
        Swal.fire('Acesso Negado', 'Apenas o Diretor ou Secretário(a) podem editar eventos.', 'error');
        return;
    }
    
    var titulo = document.getElementById('edit-ev-titulo').value.trim();
    var data = document.getElementById('edit-ev-data').value;
    var descricao = document.getElementById('edit-ev-descricao').value.trim();

    if (!titulo || !data) { Swal.fire('Atenção', 'Título e Data são obrigatórios.', 'warning'); return; }

    var btn = document.getElementById('btn-salvar-edit-ev');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    try {
        var { error } = await supabaseClient.from('eventos').update({
            titulo: titulo,
            data_inicio: data + 'T09:00:00',
            descricao: descricao
        }).eq('id', id);

        if (error) throw error;

        // Upload de novos anexos se houver
        if (arquivosTemporariosEvento.length > 0) {
            for (let file of arquivosTemporariosEvento) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `eventos/${id}/${fileName}`;

                const { error: uploadError } = await supabaseClient.storage.from('tarefa-anexos').upload(filePath, file);
                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabaseClient.storage.from('tarefa-anexos').getPublicUrl(filePath);

                await supabaseClient.from('evento_anexos').insert({
                    evento_id: id,
                    nome_arquivo: file.name,
                    url: publicUrl,
                    path: filePath
                });
            }
        }

        fecharModal('modal-editar-evento');
        Swal.fire('Sucesso', 'Projeto atualizado com sucesso!', 'success');
        carregarEventos();
    } catch (e) {
        console.error(e);
        Swal.fire('Erro', 'Erro ao salvar alterações: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Salvar Alterações';
    }
}
function configurarModoTarefas(modo) {
    diretorModoVisualizacao = modo;
    
    // Sincroniza com variável global para uso em painel.js
    window.diretorModoVisualizacao = modo;
    
    console.log('[Tarefas] Modo configurado:', modo);

    // Atualiza a aba que estiver visível
    var contMinhas = document.getElementById('minhas-tarefas-container');
    if (contMinhas && contMinhas.style.display === 'block') {
        if (typeof carregarMinhasTarefasModulo === 'function') carregarMinhasTarefasModulo();
    } else {
        if (typeof carregarTarefas === 'function') carregarTarefas();
    }
    
    // Atualizar calendário também
    if (typeof carregarEventos === 'function') carregarEventos();

    // Dispara evento para notificar painel.js que o modo mudou
    window.dispatchEvent(new CustomEvent('modoTarefasMudou', { detail: { modo: modo } }));
}

// Expõe funções globalmente
window.configurarModoTarefas = configurarModoTarefas;
window.abrirModalNovoEventoAvancado = abrirModalNovoEventoAvancado;
window.abrirModalNovoEvento = abrirModalNovoEvento;
window.salvarEvento = salvarEvento;
window.excluirEvento = excluirEvento;
window.abrirModalEditarEvento = abrirModalEditarEvento;
window.salvarEdicaoEvento = salvarEdicaoEvento;
window.salvarEventoAvancado = salvarEventoAvancado;
window.abrirModalNovaTarefa = abrirModalNovaTarefa;
window.salvarTarefa = salvarTarefa;
window.excluirTarefa = excluirTarefa;
window.abrirDetalheTarefa = abrirDetalheTarefa;
window.alterarStatusTarefa = alterarStatusTarefa;
window.abrirCriarSubtarefa = abrirCriarSubtarefa;
window.confirmarSubtarefa = confirmarSubtarefa;
window.excluirSubtarefa = excluirSubtarefa;
window.toggleSubtarefa = toggleSubtarefa;
window.uploadAnexo = uploadAnexo;
window.excluirAnexo = excluirAnexo;
window.carregarTarefas = carregarTarefas;
window.carregarEventos = carregarEventos;
