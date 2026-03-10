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

// ==========================================
// INICIALIZAÇÃO
// ==========================================
async function carregarModuloTarefas() {
    try {
        var authResult = await supabaseClient.auth.getUser();
        var user = authResult.data.user;
        if (user) {
            userIdGlobal = user.id;
            var { data: perfil } = await supabaseClient.from('profiles').select('role').eq('id', user.id).single();
            userRoleGlobal = perfil ? perfil.role.toLowerCase() : '';
        }
    } catch (e) { console.error(e); }

    // Ocultar sub-abas para Fiscais e Administradores de Posturas
    var btnTabAtribuidas = document.getElementById('btn-tab-atribuidas');
    if (btnTabAtribuidas && btnTabAtribuidas.parentElement) {
        if (userRoleGlobal === 'fiscal de posturas' || userRoleGlobal === 'administrador de posturas' || userRoleGlobal === 'fiscal') {
            btnTabAtribuidas.parentElement.style.display = 'none';
        } else {
            btnTabAtribuidas.parentElement.style.display = 'flex';
        }
    }

    renderizarCalendario();
    carregarEventos();
    carregarTarefas();
}

// ==========================================
// CALENDÁRIO MENSAL
// ==========================================
function renderizarCalendario() {
    var container = document.getElementById('calendario-container');
    if (!container) return;

    var meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    var diasSemana = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

    var primeiroDia = new Date(calendarioAnoAtual, calendarioMesAtual, 1);
    var ultimoDia = new Date(calendarioAnoAtual, calendarioMesAtual + 1, 0);
    var diaInicio = primeiroDia.getDay();
    var totalDias = ultimoDia.getDate();
    var hoje = new Date();

    var html = '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">';
    html += '<button onclick="navegarMes(-1)" style="background:none; border:1px solid #e2e8f0; border-radius:8px; padding:4px 10px; cursor:pointer; color:#475569; font-size:16px;">‹</button>';
    html += '<h3 style="margin:0; font-size:1rem; color:#1e293b;">' + meses[calendarioMesAtual] + ' ' + calendarioAnoAtual + '</h3>';
    html += '<button onclick="navegarMes(1)" style="background:none; border:1px solid #e2e8f0; border-radius:8px; padding:4px 10px; cursor:pointer; color:#475569; font-size:16px;">›</button>';
    html += '</div>';

    html += '<div style="display:grid; grid-template-columns:repeat(7,1fr); gap:2px; text-align:center;">';
    diasSemana.forEach(function (d) {
        html += '<div style="font-size:14px; font-weight:700; color:#94a3b8; padding:4px 0;">' + d + '</div>';
    });

    for (var i = 0; i < diaInicio; i++) {
        html += '<div></div>';
    }

    for (var dia = 1; dia <= totalDias; dia++) {
        var dataStr = calendarioAnoAtual + '-' + String(calendarioMesAtual + 1).padStart(2, '0') + '-' + String(dia).padStart(2, '0');
        var temEvento = eventosMesCache.some(function (ev) {
            return ev.data_inicio && ev.data_inicio.substring(0, 10) === dataStr;
        });
        var ehHoje = (dia === hoje.getDate() && calendarioMesAtual === hoje.getMonth() && calendarioAnoAtual === hoje.getFullYear());

        var estiloCell = 'font-size:14px; padding:6px 2px; border-radius:8px; cursor:default; ';
        if (ehHoje) estiloCell += 'background:#0c3e2b; color:white; font-weight:700;';
        else if (temEvento) estiloCell += 'background:#dcfce7; color:#166534; font-weight:600;';
        else estiloCell += 'color:#475569;';

        html += '<div style="' + estiloCell + '">';
        html += dia;
        if (temEvento) html += '<div style="width:5px;height:5px;background:#10b981;border-radius:50%;margin:2px auto 0;"></div>';
        html += '</div>';
    }
    html += '</div>';

    container.innerHTML = html;
}

function navegarMes(direcao) {
    calendarioMesAtual += direcao;
    if (calendarioMesAtual < 0) { calendarioMesAtual = 11; calendarioAnoAtual--; }
    if (calendarioMesAtual > 11) { calendarioMesAtual = 0; calendarioAnoAtual++; }
    renderizarCalendario();
    carregarEventos();
}

// ==========================================
// EVENTOS
// ==========================================
async function carregarEventos() {
    var container = document.getElementById('lista-eventos');
    if (!container) return;

    try {
        var inicioMes = new Date(calendarioAnoAtual, calendarioMesAtual, 1).toISOString();
        var fimMes = new Date(calendarioAnoAtual, calendarioMesAtual + 1, 0, 23, 59, 59).toISOString();

        var { data, error } = await supabaseClient
            .from('eventos')
            .select('*')
            .gte('data_inicio', inicioMes)
            .lte('data_inicio', fimMes)
            .order('data_inicio', { ascending: true });

        if (error) throw error;
        eventosMesCache = data || [];
        renderizarCalendario();

        if (eventosMesCache.length === 0) {
            container.innerHTML = '<p style="color:#94a3b8; font-size:15px; text-align:center; padding:16px;">Nenhum evento neste mês.</p>';
            return;
        }

        var html = '';
        eventosMesCache.forEach(function (ev) {
            var dataEv = new Date(ev.data_inicio);
            var diaStr = String(dataEv.getDate()).padStart(2, '0') + '/' + String(dataEv.getMonth() + 1).padStart(2, '0');
            html += '<div style="display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:8px; background:#f8fafc; margin-bottom:6px; border-left:3px solid ' + (ev.cor || '#3b82f6') + ';">';
            html += '<span style="font-weight:700; color:#1e293b; font-size:15px; min-width:40px;">' + diaStr + '</span>';
            html += '<div style="flex:1;">';
            html += '<div style="font-size:15px; font-weight:500; color:#334155;">' + ev.titulo + '</div>';
            if (ev.descricao) html += '<div style="font-size:14px; color:#94a3b8;">' + ev.descricao + '</div>';
            html += '</div>';
            if (userRoleGlobal === 'gerente' || userRoleGlobal === 'gerente fiscal' || userRoleGlobal === 'gerente de posturas' || userRoleGlobal === 'admin') {
                html += '<button onclick="excluirEvento(\'' + ev.id + '\')" style="background:none; border:none; cursor:pointer; color:#ef4444; font-size:14px;" title="Excluir">✕</button>';
            }
            html += '</div>';
        });
        container.innerHTML = html;

    } catch (err) {
        container.innerHTML = '<p style="color:#ef4444; font-size:15px;">Erro ao carregar eventos.</p>';
        console.error(err);
    }
}

function abrirModalNovoEvento() {
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
    if (!confirm('Excluir este evento?')) return;
    try {
        await supabaseClient.from('eventos').delete().eq('id', id);
        carregarEventos();
    } catch (err) { alert('Erro: ' + err.message); }
}

// ==========================================
// TAREFAS — KANBAN (3 COLUNAS)
// ==========================================
async function carregarTarefas() {
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

        // Buscar avatares dos responsáveis
        var userIdsResp = [];
        (responsaveis || []).forEach(function (r) {
            if (r.user_id && userIdsResp.indexOf(r.user_id) === -1) userIdsResp.push(r.user_id);
        });
        var avatarMap = {};
        if (userIdsResp.length > 0) {
            var { data: perfis } = await supabaseClient.from('profiles').select('id, avatar_url').in('id', userIdsResp);
            (perfis || []).forEach(function (p) { avatarMap[p.id] = p.avatar_url || ''; });
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
        subRespData.forEach(function (r) {
            if (r.user_id === userIdGlobal) {
                minhasSubIds[r.tarefa_id] = true;
                // Encontrar a subtarefa e pegar o tarefa_pai_id
                var sub = (subtarefas || []).find(function (s) { return s.id === r.tarefa_id; });
                if (sub && sub.tarefa_pai_id) {
                    ehMinhaViaSubMap[sub.tarefa_pai_id] = true;
                }
            }
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
                var authCheck = await supabaseClient.auth.getUser();
                var uCheck = authCheck.data.user;
                if (uCheck) {
                    userIdGlobal = uCheck.id;
                    var { data: pCheck } = await supabaseClient.from('profiles').select('role').eq('id', uCheck.id).single();
                    userRoleGlobal = pCheck ? pCheck.role.toLowerCase() : '';
                }
            } catch (e) { console.error(e); }
        }

        ehGerenteKanban = (userRoleGlobal === 'gerente' || userRoleGlobal === 'gerente fiscal' || userRoleGlobal === 'gerente de posturas' || userRoleGlobal === 'admin');
        console.log('[Tarefas] role:', userRoleGlobal, '| ehGerente:', ehGerenteKanban, '| total tarefas:', tarefasCache.length);

        tarefasCache.forEach(function (t) {
            t._responsaveis = respMap[t.id] || [];
            t._respUserIds = respUserIds[t.id] || [];
            t._subtarefas = subtarefasCache[t.id] || [];
            t._ehMinhaViaSub = !!ehMinhaViaSubMap[t.id];
            t._minhasSubIds = minhasSubIds;

            // Fiscal só vê tarefas onde é responsável (diretamente ou via subtarefa)
            if (!ehGerenteKanban && t._respUserIds.indexOf(userIdGlobal) === -1 && !t._ehMinhaViaSub) return;

            // Filtrar do Kanban tarefas concluídas há mais de 30 dias (vão só pro histórico)
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

    } catch (err) {
        console.error('Erro ao carregar tarefas:', err);
    }
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

        html += '<div style="font-size:15px; font-weight:600; color:#1e293b; margin-bottom:2px;">' + t.titulo;
        if (ehMinhaDireta) html += ' <span style="font-size:14px; background:#8b5cf6; color:white; padding:1px 5px; border-radius:8px; margin-left:4px; vertical-align:1px;">VOCÊ</span>';
        html += '</div>';

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
function abrirModalNovaTarefa() {
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
    html += '<input type="file" id="tarefa-anexos-input" multiple style="display:none;" onchange="previewAnexosCriacao(this)">';
    html += '</label>';
    html += '<div id="tarefa-anexos-preview" style="margin-top:8px;"></div>';
    html += '</div>';
    html += '<div class="campo-grupo"><label>Prazo</label><input type="date" id="tarefa-prazo"></div>';
    html += '<div class="campo-grupo"><label>Responsáveis</label><div id="tarefa-responsaveis-list" style="max-height:180px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:10px; padding:8px; background:#f8fafc;">Carregando...</div></div>';
    html += '</div><div class="modal-footer"><button class="btn-cancelar" onclick="fecharModal(\'modal-nova-tarefa\')">Cancelar</button>';
    html += '<button class="btn-salvar" onclick="salvarTarefa()">Criar Tarefa</button></div></div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
    carregarListaResponsaveis();
}

async function carregarListaResponsaveis() {
    var container = document.getElementById('tarefa-responsaveis-list');
    if (!container) return;

    try {
        var { data: users, error } = await supabaseClient
            .from('profiles')
            .select('id, full_name, role')
            .order('full_name', { ascending: true });

        if (error) throw error;

        var html = '';
        var validRoles = ['fiscal', 'fiscal de posturas', 'administrador de posturas', 'gerente', 'gerente fiscal', 'gerente de posturas', 'admin'];

        (users || []).forEach(function (u) {
            var roleLower = (u.role || '').toLowerCase();
            if (roleLower === 'inativo') return;

            var isValidRole = validRoles.indexOf(roleLower) !== -1;

            // Aceitar se bate com a lista ou se contém partes da palavra p/ previnir erros de digitação leves
            if (isValidRole || roleLower.includes('administrador') || roleLower.includes('fiscal') || roleLower.includes('gerente')) {
                var checked = (u.id === userIdGlobal) ? ' checked' : '';
                html += '<label style="display:flex; align-items:center; gap:8px; padding:5px 4px; cursor:pointer; font-size:15px; color:#334155;">';
                html += '<input type="checkbox" class="cb-responsavel" value="' + u.id + '" data-name="' + u.full_name + '"' + checked + ' style="width:16px; height:16px; accent-color:#10b981;">';
                html += u.full_name + ' <span style="font-size:14px; color:#94a3b8;">(' + (u.role || 'Sem Cargo') + ')</span></label>';
            }
        });
        container.innerHTML = html || '<p style="color:#94a3b8;">Nenhum usuário encontrado.</p>';
    } catch (err) {
        container.innerHTML = '<p style="color:#ef4444;">Erro: ' + err.message + '</p>';
    }
}

// Preview dos anexos selecionados na criação
function previewAnexosCriacao(inputEl) {
    var container = document.getElementById('tarefa-anexos-preview');
    if (!container) return;
    var files = inputEl.files;
    if (!files || files.length === 0) { container.innerHTML = ''; return; }
    var html = '';
    for (var i = 0; i < files.length; i++) {
        var f = files[i];
        var sizeMB = (f.size / (1024 * 1024)).toFixed(2);
        html += '<div style="display:flex; align-items:center; gap:8px; padding:6px 10px; background:#f1f5f9; border-radius:8px; margin-bottom:4px; font-size:14px; color:#334155;">';
        html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" style="flex-shrink:0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
        html += '<span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + f.name + '</span>';
        html += '<span style="color:#94a3b8; font-size:12px;">' + sizeMB + ' MB</span>';
        html += '</div>';
    }
    container.innerHTML = html;
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
    var anexosInput = document.getElementById('tarefa-anexos-input');
    var arquivos = anexosInput ? anexosInput.files : [];

    try {
        var { data: novaTarefa, error } = await supabaseClient
            .from('tarefas')
            .insert({
                titulo: titulo,
                descricao: descricao,
                status: 'pendente',
                prazo: prazo ? prazo + 'T23:59:59' : null,
                criado_por: userIdGlobal
            })
            .select()
            .single();

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
                var filePath = novaTarefa.id + '/' + Date.now() + '_' + file.name;
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

    try {
        var tarefa = tarefasCache.find(function (t) { return t.id === id; });
        if (!tarefa) { _abrindoDetalhe = false; return; }

        // Buscar subtarefas atualizadas
        var { data: subtarefas } = await supabaseClient
            .from('tarefas')
            .select('*')
            .eq('tarefa_pai_id', id)
            .order('created_at', { ascending: true });

        // Buscar responsáveis das subtarefas
        var subIds = (subtarefas || []).map(function (s) { return s.id; });
        var { data: subResps } = await supabaseClient
            .from('tarefa_responsaveis')
            .select('*')
            .in('tarefa_id', subIds.length > 0 ? subIds : ['__none__']);
        var subRespMap = {};
        var subRespUserIdMap = {};
        (subResps || []).forEach(function (r) {
            subRespMap[r.tarefa_id] = r.user_name || 'Fiscal';
            subRespUserIdMap[r.tarefa_id] = r.user_id;
        });

        // Buscar anexos das subtarefas
        var { data: subAnexos } = await supabaseClient
            .from('tarefa_anexos')
            .select('*')
            .in('tarefa_id', subIds.length > 0 ? subIds : ['__none__']);
        var subAnexoMap = {};
        (subAnexos || []).forEach(function (a) {
            if (!subAnexoMap[a.tarefa_id]) subAnexoMap[a.tarefa_id] = [];
            subAnexoMap[a.tarefa_id].push(a);
        });

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

        var ehGerente = (userRoleGlobal === 'gerente' || userRoleGlobal === 'gerente fiscal' || userRoleGlobal === 'gerente de posturas' || userRoleGlobal === 'admin');
        var ehResponsavel = resps.some(function (r) { return r.user_id === userIdGlobal; });
        var podeEditar = ehGerente || ehResponsavel;

        var html = '<div class="modal-overlay ativo" id="modal-detalhe-tarefa" onclick="if(event.target===this)fecharModal(\'modal-detalhe-tarefa\')">';
        html += '<div class="modal-container" style="max-width:600px;">';
        html += '<div class="modal-header"><h2>' + tarefa.titulo + '</h2>';
        html += '<button class="modal-close" onclick="fecharModal(\'modal-detalhe-tarefa\')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
        html += '</div><div class="modal-body" style="display:flex; flex-direction:column; gap:16px;">';

        // Verificar se todas as subtarefas estão concluídas
        var todasSubConcluidas = subs.length === 0 || subs.every(function (s) { return s.status === 'concluida'; });

        // Status — só quem pode editar a TAREFA PRINCIPAL (apenas gerente)
        if (ehGerente) {
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
        if (ehGerente) {
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
                var subRespUserId = subRespUserIdMap[s.id] || '';
                var podeConcluirSub = ehGerente || (subRespUserId === userIdGlobal);
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
                if (ehGerente) {
                    html += '<button onclick="excluirSubtarefa(\'' + s.id + '\',\'' + id + '\')" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:14px;">✕</button>';
                }
                html += '</div>';
                // Mostrar anexos da subtarefa
                if (subAnx.length > 0) {
                    subAnx.forEach(function (a) {
                        html += '<div style="display:flex; align-items:center; gap:6px; margin-left:28px; margin-top:3px;">';
                        html += '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" style="flex-shrink:0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
                        html += '<a href="' + a.url + '" target="_blank" style="font-size:14px; color:#3b82f6; text-decoration:none;">' + a.nome_arquivo + '</a>';
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
            if (ehGerente) {
                html += '<button onclick="excluirAnexo(\'' + a.id + '\',\'' + id + '\')" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:14px;">✕</button>';
            }
            html += '</div>';
        });
        html += '</div>';

        // Botão excluir tarefa (gerente)
        if (ehGerente) {
            html += '<button onclick="excluirTarefa(\'' + id + '\')" style="margin-top:8px; background:#fee2e2; color:#ef4444; border:1px solid #fca5a5; border-radius:8px; padding:8px; font-size:15px; font-weight:600; cursor:pointer; width:100%; display:flex; align-items:center; justify-content:center; gap:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Excluir Tarefa</button>';
        }

        html += '</div></div></div>';

        document.body.insertAdjacentHTML('beforeend', html);
    } catch (err) {
        console.error('Erro ao abrir detalhe:', err);
    } finally {
        _abrindoDetalhe = false;
    }
}

async function alterarStatusTarefa(id, novoStatus) {
    try {
        await supabaseClient.from('tarefas').update({ status: novoStatus }).eq('id', id);
        fecharModal('modal-detalhe-tarefa');
        carregarTarefas();
    } catch (err) { alert('Erro: ' + err.message); }
}

async function excluirTarefa(id) {
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

        var validRoles = ['fiscal', 'fiscal de posturas', 'administrador de posturas', 'gerente', 'gerente fiscal', 'gerente de posturas', 'admin'];

        var html = '';
        (users || []).forEach(function (u) {
            var roleLower = (u.role || '').toLowerCase();
            if (roleLower === 'inativo') return; // Double check for 'inativo' just in case

            var isValidRole = validRoles.indexOf(roleLower) !== -1;

            // Also allow roles that contain 'administrador', 'fiscal', or 'gerente'
            if (isValidRole || roleLower.includes('administrador') || roleLower.includes('fiscal') || roleLower.includes('gerente')) {
                html += '<label style="display:flex; align-items:center; gap:8px; padding:5px 4px; cursor:pointer; font-size:15px; color:#334155;">';
                html += '<input type="checkbox" class="cb-resp-sub" value="' + u.id + '" data-name="' + u.full_name + '" style="width:16px; height:16px; accent-color:#10b981;">';
                html += u.full_name + ' <span style="font-size:14px; color:#94a3b8;">(' + (u.role || 'Sem Cargo') + ')</span></label>';
            }
        });
        container.innerHTML = html || '<p style="color:#94a3b8;">Nenhum usuário encontrado.</p>';
    } catch (err) {
        container.innerHTML = '<p style="color:#ef4444;">Erro: ' + err.message + '</p>';
    }
}

async function confirmarSubtarefa(tarefaPaiId) {
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
                }).select().single();
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
        // Se marcando como concluída, verificar se tem anexo
        if (checked) {
            var { data: anexos } = await supabaseClient
                .from('tarefa_anexos')
                .select('id')
                .eq('tarefa_id', subId);
            if (!anexos || anexos.length === 0) {
                alert('Anexe pelo menos um documento antes de concluir esta subtarefa.');
                var { data: sub2 } = await supabaseClient.from('tarefas').select('tarefa_pai_id').eq('id', subId).single();
                if (sub2 && sub2.tarefa_pai_id) {
                    fecharModal('modal-detalhe-tarefa');
                    abrirDetalheTarefa(sub2.tarefa_pai_id);
                }
                return;
            }
        }
        await supabaseClient.from('tarefas').update({ status: novoStatus }).eq('id', subId);
        var { data: sub } = await supabaseClient.from('tarefas').select('tarefa_pai_id').eq('id', subId).single();
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
        var filePath = tarefaId + '/' + Date.now() + '_' + file.name;
        var { error: uploadErr } = await supabaseClient.storage.from('tarefa_anexos').upload(filePath, file);
        if (uploadErr) throw uploadErr;

        var publicUrl = supabaseClient.storage.from('tarefa_anexos').getPublicUrl(filePath).data.publicUrl;

        await supabaseClient.from('tarefa_anexos').insert({
            tarefa_id: tarefaId,
            nome_arquivo: file.name,
            url: publicUrl
        });

        // Detectar se é subtarefa para reabrir o modal correto
        var { data: tarefaInfo } = await supabaseClient.from('tarefas').select('tarefa_pai_id').eq('id', tarefaId).single();
        var modalId = (tarefaInfo && tarefaInfo.tarefa_pai_id) ? tarefaInfo.tarefa_pai_id : tarefaId;
        fecharModal('modal-detalhe-tarefa');
        abrirDetalheTarefa(modalId);
        carregarTarefas(); // Atualiza Kanban em background
    } catch (err) {
        alert('Erro no upload: ' + err.message);
    }
}

async function excluirAnexo(anexoId, tarefaId) {
    if (!confirm('Excluir este anexo?')) return;
    try {
        await supabaseClient.from('tarefa_anexos').delete().eq('id', anexoId);
        fecharModal('modal-detalhe-tarefa');
        abrirDetalheTarefa(tarefaId);
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

            // Regra Específica: Gerente de Posturas só vê o que ELE criou
            if (userRoleGlobal === 'gerente de posturas') {
                historicoTarefasDados = historicoTarefasDados.filter(function (t) {
                    return t.criado_por === userIdGlobal;
                });
            }
            // Regra Específica: Fiscal e outros não-gerentes só veem o que foram ATRIBUÍDOS
            else if (!ehGerenteKanban && userRoleGlobal !== 'admin') {
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
// MINHAS TAREFAS — HOME
// ==========================================
async function carregarMinhasTarefasHome() {
    var container = document.getElementById('home-minhas-tarefas');
    if (!container) return;

    try {
        var authResult = await supabaseClient.auth.getUser();
        var user = authResult.data.user;
        if (!user) return;

        // Buscar tarefas onde o usuário é responsável
        var { data: minhasResps, error: errR } = await supabaseClient
            .from('tarefa_responsaveis')
            .select('tarefa_id')
            .eq('user_id', user.id);

        if (errR) throw errR;
        if (!minhasResps || minhasResps.length === 0) {
            container.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:20px; font-size:15px;">Nenhuma tarefa atribuída a você.</div>';
            return;
        }

        var tarefaIds = minhasResps.map(function (r) { return r.tarefa_id; });

        var { data: tarefasDiretas, error: errT } = await supabaseClient
            .from('tarefas')
            .select('*')
            .in('id', tarefaIds)
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
    }
}
