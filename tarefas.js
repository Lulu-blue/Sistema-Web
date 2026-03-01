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
            if (userRoleGlobal === 'gerente' || userRoleGlobal === 'gerente fiscal' || userRoleGlobal === 'admin') {
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
        var { data: responsaveis } = await supabaseClient
            .from('tarefa_responsaveis')
            .select('*')
            .in('tarefa_id', ids.length > 0 ? ids : ['__none__']);

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
        var { data: subtarefas } = await supabaseClient
            .from('tarefas')
            .select('*')
            .in('tarefa_pai_id', ids.length > 0 ? ids : ['__none__']);

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

        var hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        var atrasadas = [];
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

        ehGerenteKanban = (userRoleGlobal === 'gerente' || userRoleGlobal === 'gerente fiscal' || userRoleGlobal === 'admin');
        console.log('[Tarefas] role:', userRoleGlobal, '| ehGerente:', ehGerenteKanban, '| total tarefas:', tarefasCache.length);

        tarefasCache.forEach(function (t) {
            t._responsaveis = respMap[t.id] || [];
            t._respUserIds = respUserIds[t.id] || [];
            t._subtarefas = subtarefasCache[t.id] || [];

            // Fiscal só vê tarefas onde é responsável
            if (!ehGerenteKanban && t._respUserIds.indexOf(userIdGlobal) === -1) return;

            if (t.status === 'concluida') {
                concluidas.push(t);
            } else if (t.prazo && new Date(t.prazo) < hoje) {
                atrasadas.push(t);
            } else if (t.status === 'em_progresso') {
                emProgresso.push(t);
            } else {
                // pendente e não atrasada vai pra em_progresso
                emProgresso.push(t);
            }
        });

        renderizarColunaTarefas('coluna-atrasadas', atrasadas, '#ef4444', 'Atrasadas');
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
        var ehMinha = t._respUserIds && t._respUserIds.indexOf(userIdGlobal) !== -1;
        var extraStyle = ehMinha ? 'box-shadow:0 0 0 2px #8b5cf6, 0 2px 8px rgba(139,92,246,0.15);' : 'box-shadow:0 1px 3px rgba(0,0,0,0.06);';

        html += '<div onclick="abrirDetalheTarefa(\'' + t.id + '\')" style="background:white; border-radius:10px; padding:12px; margin-bottom:8px; border-left:4px solid ' + borderColor + '; cursor:pointer; ' + extraStyle + ' transition:transform 0.15s;" onmouseover="this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.transform=\'none\'">';

        html += '<div style="font-size:15px; font-weight:600; color:#1e293b; margin-bottom:4px;">' + t.titulo;
        if (ehMinha) html += ' <span style="font-size:14px; background:#8b5cf6; color:white; padding:1px 5px; border-radius:8px; margin-left:4px; vertical-align:1px;">VOCÊ</span>';
        html += '</div>';

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
            var ehMinhaTarefa = (t._respUserIds && t._respUserIds.indexOf(userIdGlobal) !== -1) || ehGerenteKanban;
            t._subtarefas.forEach(function (sub) {
                var subDone = sub.status === 'concluida';
                html += '<div style="display:flex; align-items:center; gap:5px; padding:2px 0;" onclick="event.stopPropagation()">';
                if (ehMinhaTarefa) {
                    html += '<input type="checkbox" ' + (subDone ? 'checked' : '') + ' onchange="toggleSubtarefa(\'' + sub.id + '\', this.checked)" style="width:14px; height:14px; accent-color:#10b981; cursor:pointer;">';
                } else {
                    html += '<input type="checkbox" ' + (subDone ? 'checked' : '') + ' disabled style="width:14px; height:14px; accent-color:#10b981; opacity:0.5;">';
                }
                html += '<span style="font-size:13px; color:' + (subDone ? '#94a3b8' : '#475569') + '; ' + (subDone ? 'text-decoration:line-through;' : '') + '">' + sub.titulo + '</span>';
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
            .in('role', ['fiscal', 'gerente', 'gerente fiscal', 'admin'])
            .order('full_name', { ascending: true });

        if (error) throw error;

        var html = '';
        (users || []).forEach(function (u) {
            html += '<label style="display:flex; align-items:center; gap:8px; padding:5px 4px; cursor:pointer; font-size:15px; color:#334155;">';
            html += '<input type="checkbox" class="cb-responsavel" value="' + u.id + '" data-name="' + u.full_name + '" style="width:16px; height:16px; accent-color:#10b981;">';
            html += u.full_name + ' <span style="font-size:14px; color:#94a3b8;">(' + u.role + ')</span></label>';
        });
        container.innerHTML = html || '<p style="color:#94a3b8;">Nenhum usuário encontrado.</p>';
    } catch (err) {
        container.innerHTML = '<p style="color:#ef4444;">Erro: ' + err.message + '</p>';
    }
}

async function salvarTarefa() {
    var titulo = document.getElementById('tarefa-titulo').value.trim();
    var descricao = document.getElementById('tarefa-descricao').value.trim();
    var prazo = document.getElementById('tarefa-prazo').value;

    if (!titulo) { alert('Preencha o título da tarefa.'); return; }

    var responsaveisCBs = document.querySelectorAll('.cb-responsavel:checked');
    var responsaveis = [];
    responsaveisCBs.forEach(function (cb) {
        responsaveis.push({ user_id: cb.value, user_name: cb.getAttribute('data-name') });
    });

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

        fecharModal('modal-nova-tarefa');
        carregarTarefas();
    } catch (err) {
        alert('Erro ao criar tarefa: ' + err.message);
    }
}

// ==========================================
// DETALHE DA TAREFA (MODAL COMPLETO)
// ==========================================
async function abrirDetalheTarefa(id) {
    var tarefa = tarefasCache.find(function (t) { return t.id === id; });
    if (!tarefa) return;

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
    (subResps || []).forEach(function (r) {
        subRespMap[r.tarefa_id] = r.user_name || 'Fiscal';
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

    var ehGerente = (userRoleGlobal === 'gerente' || userRoleGlobal === 'gerente fiscal' || userRoleGlobal === 'admin');
    var ehResponsavel = resps.some(function (r) { return r.user_id === userIdGlobal; });
    var podeEditar = ehGerente || ehResponsavel;

    var html = '<div class="modal-overlay ativo" id="modal-detalhe-tarefa" onclick="if(event.target===this)fecharModal(\'modal-detalhe-tarefa\')">';
    html += '<div class="modal-container" style="max-width:600px;">';
    html += '<div class="modal-header"><h2>' + tarefa.titulo + '</h2>';
    html += '<button class="modal-close" onclick="fecharModal(\'modal-detalhe-tarefa\')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
    html += '</div><div class="modal-body" style="display:flex; flex-direction:column; gap:16px;">';

    // Status — só quem pode editar
    if (podeEditar) {
        html += '<div style="display:flex; gap:8px; flex-wrap:wrap;">';
        var statusOpts = [
            { val: 'pendente', label: 'Pendente', cor: '#f59e0b' },
            { val: 'em_progresso', label: 'Em Progresso', cor: '#3b82f6' },
            { val: 'concluida', label: 'Concluída', cor: '#10b981' }
        ];
        statusOpts.forEach(function (s) {
            var ativo = tarefa.status === s.val;
            html += '<button onclick="alterarStatusTarefa(\'' + id + '\',\'' + s.val + '\')" style="padding:6px 14px; border-radius:20px; font-size:14px; font-weight:600; cursor:pointer; border:2px solid ' + s.cor + '; background:' + (ativo ? s.cor : 'white') + '; color:' + (ativo ? 'white' : s.cor) + ';">' + s.label + '</button>';
        });
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
            if (podeEditar) {
                html += '<input type="checkbox" ' + subCheck + ' onchange="toggleSubtarefa(\'' + s.id + '\', this.checked)" style="width:16px; height:16px; accent-color:#10b981;">';
            } else {
                html += '<input type="checkbox" ' + subCheck + ' disabled style="width:16px; height:16px; accent-color:#10b981; opacity:0.5;">';
            }
            html += '<div style="flex:1;">';
            html += '<span style="font-size:15px; color:' + (s.status === 'concluida' ? '#94a3b8' : '#334155') + '; ' + (s.status === 'concluida' ? 'text-decoration:line-through;' : '') + '">' + s.titulo + '</span>';
            if (subResp) html += '<div style="font-size:15px; color:#64748b;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> ' + subResp + '</div>';
            html += '</div>';
            if (podeEditar) {
                html += '<label style="background:#8b5cf6; color:white; border:none; border-radius:4px; padding:2px 6px; font-size:15px; cursor:pointer; white-space:nowrap; display:inline-flex; align-items:center;" title="Anexar PDF"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg><input type="file" accept=".pdf" onchange="uploadAnexo(\'' + s.id + '\', this)" style="display:none;"></label>';
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
    html += '<label style="background:#8b5cf6; color:white; border:none; border-radius:6px; padding:4px 10px; font-size:14px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:4px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg> Anexar PDF<input type="file" accept=".pdf" onchange="uploadAnexo(\'' + id + '\', this)" style="display:none;"></label>';
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
    var html = '<div class="modal-overlay ativo" id="modal-nova-subtarefa" onclick="if(event.target===this)fecharModal(\'modal-nova-subtarefa\')"\'>';
    html += '<div class="modal-container" style="max-width:420px;">';
    html += '<div class="modal-header"><h2>Nova Subtarefa</h2>';
    html += '<button class="modal-close" onclick="fecharModal(\'modal-nova-subtarefa\')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
    html += '</div><div class="modal-body">';
    html += '<div class="campo-grupo"><label>Título da Subtarefa</label><input type="text" id="subtarefa-titulo" placeholder="Ex: Verificar documentos"></div>';
    html += '<div class="campo-grupo"><label>Responsável</label><select id="subtarefa-responsavel" style="padding:10px; width:100%; border:1px solid #e2e8f0; border-radius:8px;"><option value="">Nenhum (opcional)</option></select></div>';
    html += '</div><div class="modal-footer">';
    html += '<button class="btn-cancelar" onclick="fecharModal(\'modal-nova-subtarefa\')">Cancelar</button>';
    html += '<button class="btn-salvar" onclick="confirmarSubtarefa(\'' + tarefaPaiId + '\')">Criar</button>';
    html += '</div></div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
    carregarSelectResponsavelSubtarefa();
}

async function carregarSelectResponsavelSubtarefa() {
    var select = document.getElementById('subtarefa-responsavel');
    if (!select) return;
    try {
        var { data: users } = await supabaseClient
            .from('profiles')
            .select('id, full_name, role')
            .in('role', ['fiscal', 'gerente', 'gerente fiscal'])
            .order('full_name', { ascending: true });
        (users || []).forEach(function (u) {
            var opt = document.createElement('option');
            opt.value = u.id + '|' + u.full_name;
            opt.textContent = u.full_name + ' (' + u.role + ')';
            select.appendChild(opt);
        });
    } catch (e) { console.error(e); }
}

async function confirmarSubtarefa(tarefaPaiId) {
    var titulo = document.getElementById('subtarefa-titulo').value.trim();
    if (!titulo) { alert('Preencha o título da subtarefa.'); return; }

    var respVal = document.getElementById('subtarefa-responsavel').value;
    fecharModal('modal-nova-subtarefa');

    try {
        var { data: nova, error } = await supabaseClient.from('tarefas').insert({
            titulo: titulo,
            status: 'pendente',
            tarefa_pai_id: tarefaPaiId,
            criado_por: userIdGlobal
        }).select().single();
        if (error) throw error;

        if (respVal) {
            var parts = respVal.split('|');
            await supabaseClient.from('tarefa_responsaveis').insert({
                tarefa_id: nova.id,
                user_id: parts[0],
                user_name: parts[1]
            });
        }

        fecharModal('modal-detalhe-tarefa');
        carregarTarefas();
        setTimeout(function () { abrirDetalheTarefa(tarefaPaiId); }, 300);
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
        carregarTarefas();
        setTimeout(function () { abrirDetalheTarefa(tarefaPaiId); }, 300);
    } catch (err) { alert('Erro: ' + err.message); }
}

async function toggleSubtarefa(subId, checked) {
    var novoStatus = checked ? 'concluida' : 'pendente';
    try {
        await supabaseClient.from('tarefas').update({ status: novoStatus }).eq('id', subId);
        // Recarregar o detalhe da tarefa pai
        var { data: sub } = await supabaseClient.from('tarefas').select('tarefa_pai_id').eq('id', subId).single();
        if (sub && sub.tarefa_pai_id) {
            fecharModal('modal-detalhe-tarefa');
            carregarTarefas();
            setTimeout(function () { abrirDetalheTarefa(sub.tarefa_pai_id); }, 300);
        }
    } catch (err) { console.error(err); }
}

async function excluirSubtarefa(subId, tarefaPaiId) {
    try {
        await supabaseClient.from('tarefas').delete().eq('id', subId);
        fecharModal('modal-detalhe-tarefa');
        carregarTarefas();
        setTimeout(function () { abrirDetalheTarefa(tarefaPaiId); }, 300);
    } catch (err) { alert('Erro: ' + err.message); }
}

// ==========================================
// ANEXOS (PDF)
// ==========================================
async function uploadAnexo(tarefaId, inputEl) {
    var file = inputEl.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
        alert('Apenas arquivos PDF são permitidos.');
        return;
    }

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

        fecharModal('modal-detalhe-tarefa');
        setTimeout(function () { abrirDetalheTarefa(tarefaId); }, 300);
    } catch (err) {
        alert('Erro no upload: ' + err.message);
    }
}

async function excluirAnexo(anexoId, tarefaId) {
    if (!confirm('Excluir este anexo?')) return;
    try {
        await supabaseClient.from('tarefa_anexos').delete().eq('id', anexoId);
        fecharModal('modal-detalhe-tarefa');
        setTimeout(function () { abrirDetalheTarefa(tarefaId); }, 300);
    } catch (err) { alert('Erro: ' + err.message); }
}

// ==========================================
// UTILITÁRIOS
// ==========================================
function fecharModal(id) {
    var m = document.getElementById(id);
    if (m) m.remove();
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
        var { data: subs } = await supabaseClient
            .from('tarefas')
            .select('id, tarefa_pai_id, status')
            .in('tarefa_pai_id', ids);

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
