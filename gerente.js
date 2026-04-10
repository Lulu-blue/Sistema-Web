// gerente.js
// Script exclusivo para a aba Gerência Institucional
// Reutiliza a instância do supabaseClient do protecao.js

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

function podeGerenciarFiscais(role) {
    // Gerente, Diretor e Secretário podem gerenciar fiscais
    return isGerenteOuSuperior(role);
}

// --- FUNÇÕES DE TRANSFERÊNCIA DE TAREFAS ---
// Função para buscar usuário por nome e matrícula
async function buscarUsuarioPorNomeMatricula(nome, matricula) {
    try {
        var { data, error } = await supabaseClient
            .from('profiles')
            .select('id, full_name, matricula, role')
            .ilike('full_name', '%' + nome + '%')
            .eq('matricula', matricula)
            .eq('ativo', true)
            .maybeSingle();

        if (error) throw error;
        return data;
    } catch (err) {
        console.error('Erro ao buscar usuário:', err);
        return null;
    }
}

// Função para transferir tarefas de um usuário para outro
async function transferirTarefasUsuario(usuarioOrigemId, usuarioDestinoId, nomeDestino) {
    try {
        var resultados = {
            tarefasCriadas: 0,
            tarefasResponsavel: 0,
            erro: null
        };

        // 1. Transferir tarefas onde o usuário desativado é o criador
        var { data: tarefasCriadas, error: err1 } = await supabaseClient
            .from('tarefas')
            .select('id')
            .eq('criado_por', usuarioOrigemId);

        if (err1) throw err1;

        if (tarefasCriadas && tarefasCriadas.length > 0) {
            var { error: updateErr1 } = await supabaseClient
                .from('tarefas')
                .update({ criado_por: usuarioDestinoId })
                .eq('criado_por', usuarioOrigemId);

            if (updateErr1) throw updateErr1;
            resultados.tarefasCriadas = tarefasCriadas.length;
        }

        // 2. Transferir responsabilidades em tarefa_responsaveis
        // Primeiro, verificar se já existe responsabilidade do novo usuário
        var { data: responsaveisOrigem, error: err2 } = await supabaseClient
            .from('tarefa_responsaveis')
            .select('*')
            .eq('user_id', usuarioOrigemId);

        if (err2) throw err2;

        if (responsaveisOrigem && responsaveisOrigem.length > 0) {
            for (var i = 0; i < responsaveisOrigem.length; i++) {
                var resp = responsaveisOrigem[i];

                // Verificar se o novo usuário já é responsável por esta tarefa
                var { data: existeDestino, error: errExiste } = await supabaseClient
                    .from('tarefa_responsaveis')
                    .select('id')
                    .eq('tarefa_id', resp.tarefa_id)
                    .eq('user_id', usuarioDestinoId)
                    .maybeSingle();

                if (errExiste) throw errExiste;

                if (existeDestino) {
                    // Já existe, apenas remover o antigo
                    await supabaseClient
                        .from('tarefa_responsaveis')
                        .delete()
                        .eq('id', resp.id);
                } else {
                    // Atualizar para o novo usuário
                    var { error: updateErr2 } = await supabaseClient
                        .from('tarefa_responsaveis')
                        .update({
                            user_id: usuarioDestinoId,
                            user_name: nomeDestino
                        })
                        .eq('id', resp.id);

                    if (updateErr2) throw updateErr2;
                }
            }
            resultados.tarefasResponsavel = responsaveisOrigem.length;
        }

        // 3. Transferir subtarefas onde o usuário desativado é o criador
        var { data: subtarefasCriadas, error: err3 } = await supabaseClient
            .from('tarefas')
            .select('id')
            .eq('criado_por', usuarioOrigemId)
            .not('tarefa_pai_id', 'is', null);

        if (err3) throw err3;

        if (subtarefasCriadas && subtarefasCriadas.length > 0) {
            var { error: updateErr3 } = await supabaseClient
                .from('tarefas')
                .update({ criado_por: usuarioDestinoId })
                .eq('criado_por', usuarioOrigemId)
                .not('tarefa_pai_id', 'is', null);

            if (updateErr3) throw updateErr3;
            resultados.subtarefasCriadas = subtarefasCriadas.length;
        }

        return resultados;
    } catch (err) {
        console.error('Erro ao transferir tarefas:', err);
        return { erro: err.message };
    }
}

function podeGerenciarGerentes(role) {
    // Apenas Diretor e Secretário podem gerenciar gerentes
    return isDiretorOuSuperior(role);
}

function podeGerenciarDiretores(role) {
    // Apenas Secretário pode gerenciar diretores
    return isSecretario(role);
}

let graficoBairrosInstance = null;
let graficoFiscaisInstance = null;

// Grafico Home do Gerente: Fiscais x Pontuacao do mes
async function carregarGraficoFiscais() {
    try {
        // 1. Buscar todos os usuarios com role 'fiscal' incluindo avatar
        const { data: fiscais, error: errFiscais } = await supabaseClient
            .from('profiles')
            .select('id, full_name, avatar_url')
            .in('role', ['Fiscal', 'Fiscal de Posturas', 'Fiscal de Postura', 'fiscal de posturas', 'fiscal de postura']);

        if (errFiscais) throw errFiscais;
        if (!fiscais || fiscais.length === 0) {
            console.log("Nenhum fiscal encontrado.");
            return;
        }

        // 2. Ultimos 30 dias
        var hoje = new Date();
        var trintaDiasAtras = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        var idsFiscais = fiscais.map(function (f) { return f.id; });

        // 3. Buscar registros
        const { data: registros } = await supabaseClient
            .from('registros_produtividade')
            .select('user_id, pontuacao')
            .in('user_id', idsFiscais)
            .gte('created_at', trintaDiasAtras);

        const { data: regCP } = await supabaseClient
            .from('controle_processual')
            .select('user_id, pontuacao')
            .in('user_id', idsFiscais)
            .gte('created_at', trintaDiasAtras);

        // 4. Agrupar pontuacao
        var mapPontuacao = {};
        if (registros) {
            registros.forEach(function (r) {
                if (!mapPontuacao[r.user_id]) mapPontuacao[r.user_id] = 0;
                mapPontuacao[r.user_id] += (r.pontuacao || 0);
            });
        }
        if (regCP) {
            regCP.forEach(function (r) {
                if (!mapPontuacao[r.user_id]) mapPontuacao[r.user_id] = 0;
                mapPontuacao[r.user_id] += (r.pontuacao || 0);
            });
        }

        // 5. Montar dados
        var dadosFiscais = [];
        var pontuacaoTotal = 0;
        var maxPontuacao = 0;

        fiscais.forEach(function (f) {
            var pts = mapPontuacao[f.id] || 0;
            pontuacaoTotal += pts;
            if (pts > maxPontuacao) maxPontuacao = pts;
            dadosFiscais.push({ id: f.id, nome: f.full_name || 'Sem Nome', avatar: f.avatar_url || '', pontos: pts });
        });

        dadosFiscais.sort(function (a, b) { return b.pontos - a.pontos; });

        // 6. Atualizar cards
        var elTotalFiscais = document.getElementById('gerente-total-fiscais');
        if (elTotalFiscais) elTotalFiscais.innerText = fiscais.length;
        // Chamar grafico de documentos
        carregarGraficoDocumentos();

        // 7. Renderizar ranking HTML com fotos
        var container = document.getElementById('grafico-fiscais-pontuacao');
        if (!container) return;

        var cores = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1'];
        var html = '';

        dadosFiscais.forEach(function (f, i) {
            var cor = cores[i % cores.length];
            var larguraBarra = maxPontuacao > 0 ? Math.max((f.pontos / maxPontuacao) * 100, 2) : 2;
            var fotoHtml = '';
            if (f.avatar) {
                fotoHtml = '<img src="' + f.avatar + '" style="width:42px;height:42px;border-radius:50%;object-fit:cover;border:2px solid ' + cor + ';">';
            } else {
                fotoHtml = '<div style="width:42px;height:42px;border-radius:50%;background:#334155;display:flex;align-items:center;justify-content:center;font-size:16px;color:#94a3b8;border:2px solid ' + cor + ';">' + f.nome.charAt(0).toUpperCase() + '</div>';
            }
            html += '<div onclick="abrirRelatorioFiscal(\'' + f.id + '\', \'' + f.nome.replace(/'/g, "\\'") + '\')" style="display:flex;align-items:center;gap:12px;margin-bottom:14px;cursor:pointer;padding:6px;border-radius:8px;transition:background 0.2s;" onmouseover="this.style.background=\'rgba(0,0,0,0.04)\'" onmouseout="this.style.background=\'transparent\'">';
            html += fotoHtml;
            html += '<div style="flex:1;min-width:0;">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">';
            html += '<span style="font-weight:600;font-size:14px;color:#1e293b;">' + f.nome + '</span>';
            html += '<span style="font-weight:700;font-size:14px;color:' + cor + ';">' + f.pontos + ' pts</span>';
            html += '</div>';
            html += '<div style="width:100%;height:10px;background:#e2e8f0;border-radius:5px;overflow:hidden;">';
            html += '<div style="width:' + larguraBarra + '%;height:100%;background:' + cor + ';border-radius:5px;transition:width 0.6s ease;"></div>';
            html += '</div></div>';
            html += '<button onclick="event.stopPropagation();abrirEstatisticasFuncionario(\'' + f.id + '\', \'' + f.nome.replace(/'/g, "\\'") + '\', \'Fiscal\')" title="Ver estatísticas" style="background:none;border:none;cursor:pointer;padding:6px;transition:opacity 0.2s;opacity:0.4;" onmouseover="this.style.opacity=\'1\'" onmouseout="this.style.opacity=\'0.4\'"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg></button>';
            html += '<button onclick="event.stopPropagation();abrirExcluirFiscal(\'' + f.id + '\', \'' + f.nome.replace(/'/g, "\\'") + '\')" title="Excluir fiscal" style="background:none;border:none;cursor:pointer;padding:6px;transition:opacity 0.2s;opacity:0.4;" onmouseover="this.style.opacity=\'1\'" onmouseout="this.style.opacity=\'0.4\'"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>';
            html += '</div>';
        });

        // Botao + Novo Fiscal
        html += '<div style="margin-top:16px;text-align:center;">';
        html += '<button onclick="abrirFormNovoFiscal()" style="background:transparent;border:2px dashed #10b981;color:#10b981;padding:10px 24px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;width:100%;transition:all 0.2s;" onmouseover="this.style.background=\'#10b981\';this.style.color=\'white\'" onmouseout="this.style.background=\'transparent\';this.style.color=\'#10b981\'">+ Novo Fiscal</button>';
        html += '</div>';

        container.innerHTML = html;
        console.log("Ranking de fiscais renderizado com sucesso.");

    } catch (err) {
        console.error("Erro ao carregar grafico de fiscais:", err);
    }
}

// Ranking de Fiscais na Home do Gerente — Gráfico de Barras Verticais
let graficoRankingFiscaisInstance = null;

async function carregarRankingFiscaisHome() {
    try {
        // 1. Buscar todos os fiscais
        const { data: fiscais, error: errFiscais } = await supabaseClient
            .from('profiles')
            .select('id, full_name, avatar_url')
            .in('role', ['Fiscal', 'Fiscal de Posturas', 'Fiscal de Postura', 'fiscal de posturas', 'fiscal de postura']);

        if (errFiscais) throw errFiscais;
        if (!fiscais || fiscais.length === 0) {
            console.log("Nenhum fiscal encontrado para o ranking.");
            return;
        }

        // 2. Buscar pontuação total (sem limite de 30 dias)
        const { data: registros } = await supabaseClient
            .from('registros_produtividade')
            .select('user_id, pontuacao')
            .in('user_id', fiscais.map(f => f.id));

        const { data: regCP } = await supabaseClient
            .from('controle_processual')
            .select('user_id, pontuacao')
            .in('user_id', fiscais.map(f => f.id));

        // 3. Agrupar pontuação
        var mapPontuacao = {};
        if (registros) {
            registros.forEach(function (r) {
                if (!mapPontuacao[r.user_id]) mapPontuacao[r.user_id] = 0;
                mapPontuacao[r.user_id] += (r.pontuacao || 0);
            });
        }
        if (regCP) {
            regCP.forEach(function (r) {
                if (!mapPontuacao[r.user_id]) mapPontuacao[r.user_id] = 0;
                mapPontuacao[r.user_id] += (r.pontuacao || 0);
            });
        }

        // 4. Montar dados dos fiscais
        var dadosFiscais = [];

        fiscais.forEach(function (f) {
            var pts = mapPontuacao[f.id] || 0;
            dadosFiscais.push({
                nome: f.full_name || 'Sem Nome',
                pontos: pts
            });
        });

        // Ordenar por pontuação (maior primeiro) e pegar top 10
        dadosFiscais.sort(function (a, b) { return b.pontos - a.pontos; });
        dadosFiscais = dadosFiscais.slice(0, 10);

        // 5. Criar gráfico de barras verticais
        const canvas = document.getElementById('grafico-ranking-fiscais-chart');
        if (!canvas || typeof Chart === 'undefined') return;

        // Destruir gráfico anterior se existir
        if (graficoRankingFiscaisInstance) {
            graficoRankingFiscaisInstance.destroy();
        }

        const cores = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1'];

        graficoRankingFiscaisInstance = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: dadosFiscais.map(f => f.nome.split(' ')[0]), // Primeiro nome apenas
                datasets: [{
                    label: 'Pontuação',
                    data: dadosFiscais.map(f => f.pontos),
                    backgroundColor: dadosFiscais.map((_, i) => cores[i % cores.length]),
                    borderRadius: 6,
                    borderSkipped: false,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            title: function (context) {
                                return dadosFiscais[context[0].dataIndex].nome;
                            },
                            label: function (context) {
                                return context.parsed.y + ' pontos';
                            }
                        },
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        padding: 12,
                        cornerRadius: 8,
                        titleFont: { size: 13, weight: 'bold' },
                        bodyFont: { size: 12 }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0,0,0,0.05)',
                            drawBorder: false
                        },
                        ticks: {
                            font: { size: 11 },
                            color: '#64748b'
                        }
                    },
                    x: {
                        grid: {
                            display: false,
                            drawBorder: false
                        },
                        ticks: {
                            font: { size: 11 },
                            color: '#64748b',
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                }
            }
        });

        console.log("Gráfico de ranking de fiscais (barras verticais) renderizado com sucesso.");

    } catch (err) {
        console.error("Erro ao carregar ranking de fiscais:", err);
    }
}

let graficoDocsInstance = null;

// Grafico Doughnut: Documentos por Tipo
async function carregarGraficoDocumentos() {
    try {
        var hoje = new Date();
        var trintaDiasAtras = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

        // Buscar todos os registros do controle processual dos ultimos 30 dias
        const { data: docs, error } = await supabaseClient
            .from('controle_processual')
            .select('categoria_id')
            .gte('created_at', trintaDiasAtras);

        if (error) throw error;

        // Mapa de nomes por categoria_id
        var nomesTipo = {
            '1.1': 'Notificação Preliminar',
            '1.2': 'Auto de Infração',
            '1.3': 'Aviso de Recebimento',
            '1.4': 'Ofício',
            '1.5': 'Relatório',
            '1.6': 'Protocolo',
            '1.7': 'Réplica'
        };

        // Contar por tipo
        var contagem = {};
        var totalDocs = 0;
        if (docs) {
            docs.forEach(function (d) {
                var tipo = d.categoria_id || 'Outros';
                var nome = nomesTipo[tipo] || ('Cat. ' + tipo);
                if (!contagem[nome]) contagem[nome] = 0;
                contagem[nome]++;
                totalDocs++;
            });
        }

        // Atualizar card total
        var elTotalDocs = document.getElementById('gerente-total-docs');
        if (elTotalDocs) elTotalDocs.innerText = totalDocs;

        // Montar arrays
        var labels = Object.keys(contagem);
        var valores = Object.values(contagem);

        if (labels.length === 0) {
            labels = ['Sem dados'];
            valores = [1];
        }

        var cores = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1'];

        var canvas = document.getElementById('grafico-docs-tipo');
        if (!canvas) return;

        if (graficoDocsInstance) graficoDocsInstance.destroy();

        graficoDocsInstance = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: valores,
                    backgroundColor: cores.slice(0, labels.length),
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#1e293b',
                            font: { size: 12, weight: 'bold' },
                            padding: 15
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                var total = ctx.dataset.data.reduce(function (a, b) { return a + b; }, 0);
                                var pct = Math.round((ctx.raw / total) * 100);
                                return ctx.label + ': ' + ctx.raw + ' (' + pct + '%)';
                            }
                        }
                    }
                }
            }
        });

        console.log("Grafico de documentos renderizado.");

    } catch (err) {
        console.error("Erro ao carregar grafico de documentos:", err);
    }
}

// Inicializa variaveis para graficos de bairros
var chartBairrosNP = null;
var chartBairrosAI = null;

async function carregarGraficoBairros() {
    try {
        var hoje = new Date();
        var trintaDiasAtras = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

        var { data: registrosCP, error } = await supabaseClient
            .from('controle_processual')
            .select('categoria_id, campos')
            .in('categoria_id', ['1.1', '1.2']) // 1.1 = NP, 1.2 = AI
            .gte('created_at', trintaDiasAtras);

        if (error) throw error;
        if (!registrosCP) registrosCP = [];

        var contagemNP = {};
        var contagemAI = {};

        registrosCP.forEach(function (r) {
            var bairro = (r.campos && r.campos.bairro) ? r.campos.bairro.trim().toUpperCase() : 'NÃO INFORMADO';
            if (!bairro) bairro = 'NÃO INFORMADO';

            if (r.categoria_id === '1.1') {
                contagemNP[bairro] = (contagemNP[bairro] || 0) + 1;
            } else if (r.categoria_id === '1.2') {
                contagemAI[bairro] = (contagemAI[bairro] || 0) + 1;
            }
        });

        // Funcao auxiliar para pegar TOP 10
        function pegarTop10(objContagem) {
            var arr = Object.keys(objContagem).map(function (k) { return { bairro: k, qtde: objContagem[k] }; });
            arr.sort(function (a, b) { return b.qtde - a.qtde; });
            return arr.slice(0, 10);
        }

        var topNP = pegarTop10(contagemNP);
        var labelsNP = topNP.map(function (i) { return i.bairro; });
        var dataNP = topNP.map(function (i) { return i.qtde; });

        var topAI = pegarTop10(contagemAI);
        var labelsAI = topAI.map(function (i) { return i.bairro; });
        var dataAI = topAI.map(function (i) { return i.qtde; });

        // Grafico NP
        var ctxNP = document.getElementById('grafico-bairros-np');
        if (ctxNP) {
            if (chartBairrosNP) chartBairrosNP.destroy();
            chartBairrosNP = new Chart(ctxNP, {
                type: 'bar',
                data: {
                    labels: labelsNP,
                    datasets: [{
                        label: 'Notificações Preliminares',
                        data: dataNP,
                        backgroundColor: '#3b82f6', // Azul
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true, ticks: { stepSize: 1 } },
                        x: {
                            ticks: {
                                autoSkip: false,
                                maxRotation: 45,
                                minRotation: 45,
                                font: { size: 11 }
                            }
                        }
                    },
                    plugins: { legend: { display: false } }
                }
            });
        }

        // Grafico AI
        var ctxAI = document.getElementById('grafico-bairros-ai');
        if (ctxAI) {
            if (chartBairrosAI) chartBairrosAI.destroy();
            chartBairrosAI = new Chart(ctxAI, {
                type: 'bar',
                data: {
                    labels: labelsAI,
                    datasets: [{
                        label: 'Autos de Infração',
                        data: dataAI,
                        backgroundColor: '#ef4444', // Vermelho
                        borderRadius: 6
                    }]
                },
                options: {
                    indexAxis: 'y', // Grafico horizontal (mais simples)
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { beginAtZero: true, ticks: { stepSize: 1 } },
                        y: {
                            ticks: { font: { size: 11 } }
                        }
                    },
                    plugins: { legend: { display: false } }
                }
            });
        }

    } catch (err) {
        console.error("Erro ao carregar grafico de documentos:", err);
    }
}


// ============ GESTÃO DE ÁREAS E BAIRROS ============

var globalAreas = [];
var globalBairros = [];

var globalRegistrosCP = []; // Para armazenar todos os documentos e contar

async function carregarGestaoBairrosAreas() {
    try {
        if (typeof garantirSessaoAtiva === 'function') await garantirSessaoAtiva();
        var listaAreasEl = document.getElementById('lista-areas-gerencia');
        var listaBairrosEl = document.getElementById('lista-bairros-gerencia');

        if (!listaAreasEl || !listaBairrosEl) return;

        // 1. Buscar Áreas
        var { data: areasData, error: errAreas } = await supabaseClient
            .from('areas')
            .select('*')
            .order('nome', { ascending: true });

        if (errAreas) throw errAreas;

        // 2. Buscar Bairros
        var { data: bairrosData, error: errBairros } = await supabaseClient
            .from('bairros')
            .select('*')
            .order('nome', { ascending: true });

        if (errBairros) throw errBairros;

        // 3. Buscar Registros Processuais (para contagem igual ao grafico)
        var hoje = new Date();
        var trintaDiasAtras = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        var { data: registrosCP, error: errCP } = await supabaseClient
            .from('controle_processual')
            .select('categoria_id, campos')
            .in('categoria_id', ['1.1', '1.2']) // NP e AI
            .gte('created_at', trintaDiasAtras);

        globalAreas = areasData || [];
        globalBairros = bairrosData || [];
        globalRegistrosCP = registrosCP || [];

        renderizarListaAreas();
        renderizarListaBairros();

    } catch (err) {
        console.error("Erro ao carregar Gestão de Áreas e Bairros. (As tabelas existem?):", err);
        var listaAreasEl = document.getElementById('lista-areas-gerencia');
        if (listaAreasEl) listaAreasEl.innerHTML = '<div style="color:#ef4444; padding:15px; text-align:center;">Erro ao carregar. Execute o script SQL no Supabase.</div>';
    }
}

function processarContagemBairro(nomeBairro) {
    var contNP = 0;
    var contAI = 0;
    var bn = nomeBairro.toUpperCase();
    globalRegistrosCP.forEach(function (r) {
        var rb = (r.campos && r.campos.bairro) ? r.campos.bairro.trim().toUpperCase() : '';
        if (rb === bn) {
            if (r.categoria_id === '1.1') contNP++;
            if (r.categoria_id === '1.2') contAI++;
        }
    });
    return { np: contNP, ai: contAI };
}

function processarContagemArea(areaId) {
    // Todos os bairros da area
    var bairrosArea = globalBairros.filter(function (b) { return b.area_id === areaId; });
    var totais = { np: 0, ai: 0 };
    bairrosArea.forEach(function (b) {
        var c = processarContagemBairro(b.nome);
        totais.np += c.np;
        totais.ai += c.ai;
    });
    return totais;
}

function renderizarListaAreas() {
    var container = document.getElementById('lista-areas-gerencia');
    if (!container) return;

    if (globalAreas.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #94a3b8; padding: 20px;">Nenhuma área cadastrada.</div>';
        return;
    }

    var html = '';
    globalAreas.forEach(function (a) {
        var c = processarContagemArea(a.id);
        var textDocs = '';
        if (c.np > 0 || c.ai > 0) {
            var partes = [];
            if (c.np > 0) partes.push('Notificação Preliminar = ' + c.np);
            if (c.ai > 0) partes.push('Auto de Infração = ' + c.ai);
            textDocs = '<div style="font-size:11px; color:#3b82f6; margin-top:2px;">(' + partes.join(' | ') + ')</div>';
        }

        html += '<div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">';
        html += '<div>';
        html += '<div style="font-weight: 600; color: #1e293b; font-size: 14px;">' + a.nome + '</div>';
        html += '<div style="font-size: 12px; color: #64748b; margin-top: 4px;">Fiscal: <strong style="color:#10b981;">' + (a.fiscal_nome || 'Não atribuído') + '</strong></div>';
        html += textDocs;
        html += '</div>';
        html += '<div style="display:flex; gap:6px;">';
        html += '<button onclick="abrirModalAtribuirFiscal(\'' + a.id + '\', \'' + a.nome + '\', \'' + (a.fiscal_nome || '') + '\')" title="Atribuir Fiscal" style="background:none; border:none; cursor:pointer; color:#3b82f6;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6m-3-3h6"/></svg></button>';
        html += '<button onclick="excluirArea(\'' + a.id + '\', \'' + a.nome + '\')" title="Excluir Área" style="background:none; border:none; cursor:pointer; color:#ef4444;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>';
        html += '</div>';
        html += '</div>';
    });

    container.innerHTML = html;
}

function filtrarListaBairrosGestao() {
    renderizarListaBairros();
}

function renderizarListaBairros() {
    var container = document.getElementById('lista-bairros-gerencia');
    var contador = document.getElementById('contador-bairros');
    var busca = document.getElementById('busca-bairro-gestao');
    if (!container) return;

    var termoBusca = busca ? busca.value.toLowerCase() : '';
    var bairrosFiltrados = globalBairros.filter(function (b) {
        return b.nome.toLowerCase().includes(termoBusca);
    });

    if (contador) {
        contador.textContent = bairrosFiltrados.length + ' bairros encontrados';
    }

    if (bairrosFiltrados.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #94a3b8; padding: 20px;">Nenhum bairro encontrado.</div>';
        return;
    }

    var html = '';
    bairrosFiltrados.forEach(function (b) {
        var areaVinculada = globalAreas.find(function (a) { return a.id === b.area_id; });
        var nomeArea = areaVinculada ? areaVinculada.nome : 'Sem Área';
        var corArea = areaVinculada ? '#10b981' : '#94a3b8';

        var c = processarContagemBairro(b.nome);
        var textDocs = '';
        if (c.np > 0 || c.ai > 0) {
            var partes = [];
            if (c.np > 0) partes.push('Notificação Preliminar = ' + c.np);
            if (c.ai > 0) partes.push('Auto de Infração = ' + c.ai);
            textDocs = '<div style="font-size:11px; color:#3b82f6; margin-top:2px;">(' + partes.join(' | ') + ')</div>';
        }

        html += '<div style="border-bottom: 1px solid #f1f5f9; padding: 10px 4px; display: flex; justify-content: space-between; align-items: center;">';
        html += '<div>';
        html += '<div style="font-weight: 500; color: #334155; font-size: 13px;">' + b.nome + '</div>';
        html += '<div style="font-size: 11px; color: ' + corArea + '; font-weight:600; margin-top: 2px;">' + nomeArea + '</div>';
        html += textDocs;
        html += '</div>';
        html += '<div style="display:flex; gap:6px;">';
        // Dropdown map
        html += '<select onchange="vincularBairroArea(\'' + b.id + '\', this.value)" style="font-size:11px; padding:2px; border-radius:4px; max-width:80px; border:1px solid #cbd5e1;">';
        html += '<option value="">Sem Área</option>';
        globalAreas.forEach(function (a) {
            var selected = (b.area_id === a.id) ? 'selected' : '';
            html += '<option value="' + a.id + '" ' + selected + '>' + a.nome + '</option>';
        });
        html += '</select>';
        html += '<button onclick="excluirBairro(\'' + b.id + '\', \'' + b.nome.replace(/'/g, "\\'") + '\')" title="Excluir Bairro" style="background:none; border:none; cursor:pointer; color:#ef4444;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>';
        html += '</div>';
        html += '</div>';
    });

    container.innerHTML = html;
}

// ACOES DE BANCO (CRUD BASICO)

async function abrirModalNovaArea() {
    var nomeArea = prompt("Digite o nome da nova Área:");
    if (!nomeArea || nomeArea.trim() === '') return;

    try {
        if (typeof garantirSessaoAtiva === 'function') await garantirSessaoAtiva();
        var { error } = await supabaseClient
            .from('areas')
            .insert([{ nome: nomeArea.trim() }]);
        if (error) throw error;
        carregarGestaoBairrosAreas();
    } catch (err) {
        alert("Erro ao criar área: " + err.message);
    }
}

async function excluirArea(id, nome) {
    if (!confirm("Tem certeza que deseja excluir a área '" + nome + "'? Os bairros vinculados voltarão a ficar 'Sem Área'.")) return;
    try {
        if (typeof garantirSessaoAtiva === 'function') await garantirSessaoAtiva();

        var { error } = await supabaseClient.from('areas').delete().eq('id', id);
        if (error) throw error;
        carregarGestaoBairrosAreas();
    } catch (err) {
        alert("Erro ao excluir área: " + err.message);
    }
}

async function abrirModalNovoBairro() {
    var nomeBairro = prompt("Digite o nome do novo Bairro:");
    if (!nomeBairro || nomeBairro.trim() === '') return;

    try {
        if (typeof garantirSessaoAtiva === 'function') await garantirSessaoAtiva();
        var { error } = await supabaseClient
            .from('bairros')
            .insert([{ nome: nomeBairro.trim() }]);
        if (error) throw error;
        carregarGestaoBairrosAreas();
    } catch (err) {
        alert("Erro ao criar bairro: " + err.message);
    }
}

async function excluirBairro(id, nome) {
    if (!confirm("Excluir o bairro '" + nome + "'?")) return;
    try {
        if (typeof garantirSessaoAtiva === 'function') await garantirSessaoAtiva();

        var { error } = await supabaseClient.from('bairros').delete().eq('id', id);
        if (error) throw error;
        carregarGestaoBairrosAreas();
    } catch (err) {
        alert("Erro ao excluir bairro: " + err.message);
    }
}

async function vincularBairroArea(bairroId, novaAreaId) {
    var area_id = novaAreaId === "" ? null : novaAreaId;
    try {
        if (typeof garantirSessaoAtiva === 'function') await garantirSessaoAtiva();

        var { error } = await supabaseClient
            .from('bairros')
            .update({ area_id: area_id })
            .eq('id', bairroId);
        if (error) throw error;
        carregarGestaoBairrosAreas();
    } catch (err) {
        alert("Erro ao vincular bairro: " + err.message);
        carregarGestaoBairrosAreas(); // reverter visualmente
    }
}

async function abrirModalAtribuirFiscal(areaId, areaNome, fiscalAtual) {
    var novoFiscal = prompt("Digite o NOME do Fiscal para a " + areaNome + ":\n(Deixe em branco para remover o fiscal atual)", fiscalAtual);
    if (novoFiscal === null) return; // Cancelou

    try {
        if (typeof garantirSessaoAtiva === 'function') await garantirSessaoAtiva();
        var { error } = await supabaseClient
            .from('areas')
            .update({ fiscal_nome: novoFiscal.trim() === '' ? null : novoFiscal.trim() })
            .eq('id', areaId);
        if (error) throw error;
        carregarGestaoBairrosAreas();
    } catch (err) {
        alert("Erro ao atribuir fiscal: " + err.message);
    }
}




// Relatorio individual de um fiscal (chamado ao clicar no ranking)
async function abrirRelatorioFiscal(fiscalId, nomeFiscal) {
    try {
        // 1. Buscar todos os registros do fiscal (Produtividade e Controle Processual)
        const { data: regProd } = await supabaseClient
            .from('registros_produtividade')
            .select('*')
            .eq('user_id', fiscalId)
            .order('created_at', { ascending: false });

        const { data: regCP } = await supabaseClient
            .from('controle_processual')
            .select('*')
            .eq('user_id', fiscalId)
            .order('created_at', { ascending: false });

        const todosRegs = (regProd || []).concat(regCP || []);

        // Filtrar registros omitindo pontuação 0
        const registrosFiltrados = todosRegs.filter(r => (r.pontuacao || 0) !== 0);

        // 2. Buscar tarefas do fiscal
        const { data: tarefasFiscal } = await supabaseClient
            .from('tarefa_responsaveis')
            .select('tarefa_id')
            .eq('user_id', fiscalId);

        let tarefasStatus = { concluidas: 0, emProgresso: 0, atrasadas: 0 };

        if (tarefasFiscal && tarefasFiscal.length > 0) {
            const tarefaIds = tarefasFiscal.map(t => t.tarefa_id);
            const { data: tarefas } = await supabaseClient
                .from('tarefas')
                .select('status, prazo')
                .in('id', tarefaIds);

            if (tarefas) {
                const hoje = new Date().toISOString().split('T')[0];
                tarefas.forEach(t => {
                    const prazoVencido = t.prazo && t.prazo < hoje;
                    if (t.status === 'concluida') {
                        tarefasStatus.concluidas++;
                    } else if (prazoVencido) {
                        tarefasStatus.atrasadas++;
                    } else {
                        tarefasStatus.emProgresso++;
                    }
                });
            }
        }

        const mesesNome = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        const dataObj = new Date();
        const anoAtual = dataObj.getFullYear();
        const mesAtual = mesesNome[dataObj.getMonth()];
        const pontuacaoTotal = registrosFiltrados.reduce((s, r) => s + (r.pontuacao || 0), 0);

        // 3. Preparar dados para gráfico de pizza (tipos de documentos)
        const docPorTipo = {};
        registrosFiltrados.forEach(r => {
            const catId = r.categoria_id || 'outros';
            let catNome = 'Outros';
            if (typeof CATEGORIAS !== 'undefined') {
                const cDef = CATEGORIAS.find(c => c.id === catId);
                if (cDef) catNome = cDef.nome;
            }
            docPorTipo[catNome] = (docPorTipo[catNome] || 0) + 1;
        });

        // 4. Gerar tabelas por categoria
        const porCategoria = {};
        registrosFiltrados.forEach(r => {
            const catId = r.categoria_id || 'outros';
            let catNome = 'Categoria ' + catId;
            if (typeof CATEGORIAS !== 'undefined') {
                const cDef = CATEGORIAS.find(c => c.id === catId);
                if (cDef) catNome = cDef.nome;
            } else if (r.categoria_nome) {
                catNome = r.categoria_nome;
            }

            if (!porCategoria[catId]) {
                porCategoria[catId] = { nome: catNome, registros: [] };
            }
            porCategoria[catId].registros.push(r);
        });

        let secoesHTML = '';
        Object.values(porCategoria).forEach(cat => {
            const catDef = (typeof CATEGORIAS !== 'undefined') ? CATEGORIAS.find(c => c.nome === cat.nome) : null;
            const temNumero = cat.registros.some(r => r.numero_sequencial);
            const camposDef = catDef?.campos?.filter(c => c.tipo !== 'file' && c.tipo !== 'date' && !c.ignorarNoBanco) || [];

            let headerCols = '';
            if (temNumero) headerCols += '<th>N°</th>';
            headerCols += camposDef.map(c => `<th>${c.label}</th>`).join('');
            headerCols += '<th>Data</th>';
            headerCols += '<th>Pontos</th>';

            let linhas = cat.registros.map(r => {
                let tds = '';
                if (temNumero) tds += `<td contenteditable="true">${r.numero_sequencial || '-'}</td>`;
                tds += camposDef.map(c => `<td contenteditable="true">${(r.campos && r.campos[c.nome]) || '-'}</td>`).join('');

                let dataFormatada = '-';
                if (typeof obterDataReal === 'function') {
                    dataFormatada = obterDataReal(r).toLocaleDateString('pt-BR');
                } else {
                    dataFormatada = r.created_at ? new Date(r.created_at).toLocaleDateString('pt-BR') : '-';
                }

                tds += `<td contenteditable="true">${dataFormatada}</td>`;
                tds += `<td contenteditable="true">${r.pontuacao || 0}</td>`;
                return `<tr>${tds}</tr>`;
            }).join('');

            const subtotal = cat.registros.reduce((s, r) => s + (r.pontuacao || 0), 0);
            const colSpanSubtotal = (temNumero ? 1 : 0) + camposDef.length + 1;

            secoesHTML += `
                <div class="relatorio-secao">
                    <h3>${cat.nome}</h3>
                    <table>
                        <thead><tr>${headerCols}</tr></thead>
                        <tbody>${linhas}</tbody>
                        <tfoot><tr><td colspan="${colSpanSubtotal}" style="text-align:right; font-weight:600;">Subtotal:</td><td style="font-weight:600;">${subtotal}</td></tr></tfoot>
                    </table>
                </div>
            `;
        });

        // 5. Criar modal com layout de duas colunas
        const modalHTML = `
            <div class="modal-overlay ativo" id="modal-relatorio-gerente" onclick="if(event.target===this)fecharRelatorioGerente()" style="overflow-y:auto;">
                <div style="display:flex;gap:20px;padding:20px;max-width:1400px;margin:0 auto;align-items:flex-start;">
                    <!-- COLUNA ESQUERDA: Relatório -->
                    <div class="relatorio-preview" id="relatorio-gerente-conteudo" style="flex:1.5;max-height:90vh;overflow-y:auto;">
                        <h1 contenteditable="true">RELATÓRIO DE PRODUTIVIDADE — ${mesAtual}/${anoAtual}</h1>
                        <div class="relatorio-info">
                            <div><strong>Fiscal:</strong> <span contenteditable="true">${nomeFiscal}</span></div>
                            <div><strong>Período:</strong> <span contenteditable="true">${mesAtual}/${anoAtual}</span></div>
                            <div><strong>Pontuação Total:</strong> <span contenteditable="true">${pontuacaoTotal}</span></div>
                            <div><strong>Total de Registros:</strong> ${todosRegs.length}</div>
                        </div>
                        ${secoesHTML}

                        <div class="relatorio-assinaturas" style="display: flex; justify-content: space-around; margin-top: 60px; padding-bottom: 30px; text-align: center; page-break-inside: avoid;">
                            <div>
                                <p style="margin: 0;">_________________________________________</p>
                                <p style="margin: 5px 0 0 0;"><strong><span contenteditable="true">${nomeFiscal}</span></strong></p>
                                <p style="margin: 2px 0 0 0;">Fiscal de Posturas</p>
                            </div>
                            <div>
                                <p style="margin: 0;">_________________________________________</p>
                                <p style="margin: 5px 0 0 0;"><strong>Gerente de Alvarás e Posturas</strong></p>
                            </div>
                        </div>

                        <div class="relatorio-acoes" id="relatorio-gerente-acoes">
                            <button class="btn-cancelar-rel" onclick="fecharRelatorioGerente()">Cancelar</button>
                            <button class="btn-salvar-pdf" onclick="salvarPDFGerente()">💾 Salvar como PDF</button>
                        </div>
                    </div>

                    <!-- COLUNA DIREITA: Gráficos -->
                    <div style="flex:0.8;display:flex;flex-direction:column;gap:20px;max-height:90vh;">
                        <!-- Gráfico de Pizza: Tipos de Documentos -->
                        <div style="background:white;border-radius:12px;padding:20px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
                            <h3 style="margin:0 0 15px 0;color:#1e293b;font-size:16px;text-align:center;">Documentos por Tipo</h3>
                            <div style="position:relative;height:250px;">
                                <canvas id="grafico-pizza-docs"></canvas>
                            </div>
                        </div>

                        <!-- Gráfico de Colunas: Status das Tarefas -->
                        <div style="background:white;border-radius:12px;padding:20px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
                            <h3 style="margin:0 0 15px 0;color:#1e293b;font-size:16px;text-align:center;">Status das Tarefas</h3>
                            <div style="position:relative;height:200px;">
                                <canvas id="grafico-colunas-tarefas"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // 6. Renderizar gráficos
        renderizarGraficosFiscal(docPorTipo, tarefasStatus);

    } catch (err) {
        console.error("Erro ao gerar relatório do fiscal:", err);
        alert("Erro ao gerar relatório: " + (err.message || err));
    }
}

// Função para renderizar gráficos do fiscal
function renderizarGraficosFiscal(docPorTipo, tarefasStatus) {
    // Gráfico de Pizza - Documentos por Tipo
    const canvasPizza = document.getElementById('grafico-pizza-docs');
    if (canvasPizza && typeof Chart !== 'undefined' && Object.keys(docPorTipo).length > 0) {
        // Destruir gráfico anterior se existir
        if (canvasPizza.chartInstance) {
            canvasPizza.chartInstance.destroy();
        }

        const cores = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

        canvasPizza.chartInstance = new Chart(canvasPizza, {
            type: 'doughnut',
            data: {
                labels: Object.keys(docPorTipo),
                datasets: [{
                    data: Object.values(docPorTipo),
                    backgroundColor: cores.slice(0, Object.keys(docPorTipo).length),
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: { size: 11 },
                            padding: 10,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    } else if (canvasPizza) {
        canvasPizza.parentElement.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:40px;">Nenhum documento encontrado</div>';
    }

    // Gráfico de Colunas - Status das Tarefas
    const canvasColunas = document.getElementById('grafico-colunas-tarefas');
    if (canvasColunas && typeof Chart !== 'undefined') {
        // Destruir gráfico anterior se existir
        if (canvasColunas.chartInstance) {
            canvasColunas.chartInstance.destroy();
        }

        canvasColunas.chartInstance = new Chart(canvasColunas, {
            type: 'bar',
            data: {
                labels: ['Concluídas', 'Em Progresso', 'Atrasadas'],
                datasets: [{
                    label: 'Quantidade',
                    data: [tarefasStatus.concluidas, tarefasStatus.emProgresso, tarefasStatus.atrasadas],
                    backgroundColor: ['#10b981', '#3b82f6', '#ef4444'],
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 },
                        grid: { color: 'rgba(0,0,0,0.05)' }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    }
}

function fecharRelatorioGerente() {
    var modal = document.getElementById('modal-relatorio-gerente');
    if (modal) {
        // Destruir gráficos antes de remover o modal para liberar memória
        var canvasPizza = document.getElementById('grafico-pizza-docs');
        var canvasColunas = document.getElementById('grafico-colunas-tarefas');

        if (canvasPizza && canvasPizza.chartInstance) {
            canvasPizza.chartInstance.destroy();
        }
        if (canvasColunas && canvasColunas.chartInstance) {
            canvasColunas.chartInstance.destroy();
        }

        modal.remove();
    }
}

function salvarPDFGerente() {
    var conteudo = document.getElementById('relatorio-gerente-conteudo');
    var acoes = document.getElementById('relatorio-gerente-acoes');
    if (!conteudo || typeof html2pdf === 'undefined') {
        alert('Funcao de PDF nao disponivel.');
        return;
    }

    if (acoes) acoes.style.display = 'none';

    html2pdf().set({
        margin: [10, 10, 10, 10],
        filename: 'relatorio_fiscal.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(conteudo).save().then(function () {
        if (acoes) acoes.style.display = '';
    });
}


// ============ CADASTRO DE NOVO FISCAL ============

function abrirFormNovoFiscal() {
    // Remover modal anterior se existir
    var existente = document.getElementById('modal-novo-fiscal');
    if (existente) existente.remove();

    var modal = document.createElement('div');
    modal.id = 'modal-novo-fiscal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;';

    modal.innerHTML = ''
        + '<div style="background:white;border-radius:12px;width:90%;max-width:420px;padding:30px;position:relative;">'
        + '<button onclick="document.getElementById(\'modal-novo-fiscal\').remove()" style="position:absolute;top:10px;right:14px;background:none;border:none;font-size:24px;cursor:pointer;color:#64748b;">\u2715</button>'
        + '<h2 style="margin:0 0 20px 0;color:#1e293b;">Cadastrar Novo Fiscal</h2>'
        + '<div style="margin-bottom:14px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;">CPF</label>'
        + '<input type="text" id="novo-fiscal-cpf" placeholder="000.000.000-00" maxlength="14" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;" oninput="mascaraCpfNovoFiscal(this)">'
        + '</div>'
        + '<div style="margin-bottom:14px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;">Nome Completo</label>'
        + '<input type="text" id="novo-fiscal-nome" placeholder="Nome do fiscal" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">'
        + '</div>'
        + '<div style="margin-bottom:20px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;">Matr\u00edcula</label>'
        + '<input type="text" id="novo-fiscal-matricula" placeholder="Matr\u00edcula" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">'
        + '</div>'
        + '<p style="font-size:12px;color:#94a3b8;margin-bottom:16px;">Cargo: <strong>Fiscal</strong> | Senha padr\u00e3o: <strong>123456</strong></p>'
        + '<div id="msg-novo-fiscal" style="margin-bottom:12px;font-size:13px;"></div>'
        + '<button onclick="salvarNovoFiscal()" id="btn-salvar-novo-fiscal" style="width:100%;padding:12px;background:#10b981;color:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">Cadastrar Fiscal</button>'
        + '</div>';

    document.body.appendChild(modal);

    modal.addEventListener('click', function (e) {
        if (e.target === modal) modal.remove();
    });
}

function mascaraCpfNovoFiscal(input) {
    var v = input.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
    else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
    else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, '$1.$2');
    input.value = v;
}

async function salvarNovoFiscal() {
    var cpfRaw = document.getElementById('novo-fiscal-cpf').value.replace(/\D/g, '');
    var nome = document.getElementById('novo-fiscal-nome').value.trim();
    var matricula = document.getElementById('novo-fiscal-matricula').value.trim();
    var msgEl = document.getElementById('msg-novo-fiscal');
    var btnSalvar = document.getElementById('btn-salvar-novo-fiscal');

    if (!cpfRaw || cpfRaw.length < 11) {
        msgEl.textContent = 'CPF deve ter 11 digitos.';
        msgEl.style.color = '#ef4444';
        return;
    }
    if (!nome) {
        msgEl.textContent = 'Preencha o nome do fiscal.';
        msgEl.style.color = '#ef4444';
        return;
    }

    btnSalvar.textContent = 'Processando...';
    btnSalvar.disabled = true;
    msgEl.textContent = '';

    try {
        // Padronização universal: email sempre @email.com (usado no login)
        var emailFicticio = cpfRaw + '@email.com';

        // 1. Verificar se o perfil já existe (Idempotência)
        var { data: existingProfile, error: searchErr } = await supabaseClient
            .from('profiles')
            .select('id, role')
            .eq('cpf', cpfRaw)
            .maybeSingle();

        if (searchErr) throw searchErr;

        var userId;

        if (existingProfile) {
            // Se já existe, apenas reativamos e atualizamos dados
            userId = existingProfile.id;
            console.log("Perfil encontrado. Atualizando/Reativando...");
        } else {
            // Se não existe, criamos no Auth
            console.log("Novo perfil. Criando no Auth...");
            var { data: signUpData, error: signUpErr } = await supabaseClient.auth.signUp({
                email: emailFicticio,
                password: '123456'
            });

            if (signUpErr) {
                if (signUpErr.message && signUpErr.message.includes('already registered')) {
                    throw new Error('Usuário já registrado no Auth. Contate o suporte.');
                }
                throw signUpErr;
            }
            userId = signUpData.user ? signUpData.user.id : null;
        }

        if (!userId) throw new Error('Falha ao obter ID do usuário.');

        // 2. Upsert no Perfil (Funciona tanto para novo quanto para atualização)
        var { error: profileErr } = await supabaseClient
            .from('profiles')
            .upsert({
                id: userId,
                email: emailFicticio,
                full_name: nome,
                cpf: cpfRaw,
                matricula: matricula,
                role: 'Fiscal de Posturas'
            }, { onConflict: 'id' });

        if (profileErr) throw profileErr;

        msgEl.textContent = 'Fiscal processado com sucesso!';
        msgEl.style.color = '#10b981';

        setTimeout(function () {
            var modal = document.getElementById('modal-novo-fiscal');
            if (modal) modal.remove();
            if (typeof carregarGraficoFiscais === 'function') carregarGraficoFiscais();
            if (typeof carregarRankingFiscaisHome === 'function') carregarRankingFiscaisHome();
            if (typeof carregarRankingFiscaisHome === 'function') carregarRankingFiscaisHome();
        }, 1500);

    } catch (err) {
        console.error('Erro ao cadastrar fiscal:', err);
        msgEl.textContent = 'Erro: ' + (err.message || err);
        msgEl.style.color = '#ef4444';
    } finally {
        btnSalvar.textContent = 'Cadastrar Fiscal';
        btnSalvar.disabled = false;
    }
}


// ============ EXCLUSÃO DE FISCAL ============

function abrirExcluirFiscal(fiscalId, nomeFiscal) {
    var existente = document.getElementById('modal-excluir-fiscal');
    if (existente) existente.remove();

    var modal = document.createElement('div');
    modal.id = 'modal-excluir-fiscal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;';

    modal.innerHTML = ''
        + '<div style="background:white;border-radius:12px;width:90%;max-width:420px;padding:30px;position:relative;">'
        + '<button onclick="document.getElementById(\'modal-excluir-fiscal\').remove()" style="position:absolute;top:10px;right:14px;background:none;border:none;font-size:24px;cursor:pointer;color:#64748b;">\u2715</button>'
        + '<div style="text-align:center;margin-bottom:20px;">'
        + '<div style="width:50px;height:50px;border-radius:50%;background:#fff7ed;display:inline-flex;align-items:center;justify-content:center;font-size:24px;margin-bottom:10px;">🚫</div>'
        + '<h2 style="margin:0;color:#c2410c;">Desativar Fiscal</h2>'
        + '<p style="color:#64748b;margin:8px 0 0 0;">Você está prestes a desativar:</p>'
        + '<p style="font-weight:700;font-size:18px;color:#1e293b;margin:4px 0 0 0;">' + nomeFiscal + '</p>'
        + '</div>'
        + '<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px;margin-bottom:16px;">'
        + '<p style="color:#c2410c;font-size:13px;margin:0;"><strong>ℹ️ Atenção:</strong> O fiscal será desativado e não poderá mais acessar o sistema. O histórico de documentos será preservado.</p>'
        + '</div>'
        + '<div style="margin-bottom:14px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;">Seu CPF (gerente)</label>'
        + '<input type="text" id="excluir-cpf-gerente" placeholder="000.000.000-00" maxlength="14" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;" oninput="mascaraCpfNovoFiscal(this)">'
        + '</div>'
        + '<div style="margin-bottom:14px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;">Sua Senha</label>'
        + '<input type="password" id="excluir-senha-gerente" placeholder="Sua senha" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">'
        + '</div>'
        + '<div style="margin-bottom:14px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">'
        + '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;">'
        + '<input type="checkbox" id="chk-transferir-tarefas" style="width:18px;height:18px;accent-color:#c2410c;" onchange="toggleTransferenciaTarefas()">'
        + '<span style="font-weight:600;color:#334155;">Transferir tarefas para outro usuário</span>'
        + '</label>'
        + '</div>'
        + '<div id="secao-transferencia" style="display:none;margin-bottom:14px;padding:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;">'
        + '<p style="color:#166534;font-size:12px;margin:0 0 10px 0;"><strong>ℹ️ Nova funcionalidade:</strong> As tarefas deste usuário serão transferidas para o novo responsável.</p>'
        + '<div style="margin-bottom:10px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;font-size:13px;">Nome do novo responsável</label>'
        + '<input type="text" id="transferir-nome" placeholder="Nome completo" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">'
        + '</div>'
        + '<div style="margin-bottom:10px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;font-size:13px;">Matrícula do novo responsável</label>'
        + '<input type="text" id="transferir-matricula" placeholder="Número da matrícula" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">'
        + '</div>'
        + '<button onclick="buscarNovoResponsavel()" style="width:100%;padding:8px;background:#16a34a;color:white;border:none;border-radius:6px;font-size:13px;cursor:pointer;">Buscar Usuário</button>'
        + '<div id="resultado-busca-usuario" style="margin-top:10px;"></div>'
        + '</div>'
        + '<div style="margin-bottom:16px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;">Digite <strong style="color:#dc2626;">DESATIVAR</strong> para confirmar</label>'
        + '<input type="text" id="excluir-confirmacao" placeholder="DESATIVAR" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">'
        + '</div>'
        + '<div id="msg-excluir-fiscal" style="margin-bottom:12px;font-size:13px;"></div>'
        + '<button onclick="executarExclusaoFiscal(\'' + fiscalId + '\', \'' + nomeFiscal.replace(/'/g, "\\'") + '\')" id="btn-confirmar-exclusao" style="width:100%;padding:12px;background:#c2410c;color:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">Confirmar Desativação</button>'
        + '</div>';

    document.body.appendChild(modal);

    modal.addEventListener('click', function (e) {
        if (e.target === modal) modal.remove();
    });
}

// Toggle para mostrar/ocultar seção de transferência
function toggleTransferenciaTarefas() {
    var chk = document.getElementById('chk-transferir-tarefas');
    var secao = document.getElementById('secao-transferencia');
    if (chk && secao) {
        secao.style.display = chk.checked ? 'block' : 'none';
    }
}

// Buscar novo responsável para transferência
var novoResponsavelSelecionado = null;
async function buscarNovoResponsavel() {
    var nome = document.getElementById('transferir-nome').value.trim();
    var matricula = document.getElementById('transferir-matricula').value.trim();
    var resultadoDiv = document.getElementById('resultado-busca-usuario');

    if (!nome || !matricula) {
        resultadoDiv.innerHTML = '<p style="color:#ef4444;font-size:12px;">Preencha nome e matrícula.</p>';
        return;
    }

    resultadoDiv.innerHTML = '<p style="color:#64748b;font-size:12px;">Buscando...</p>';

    var usuario = await buscarUsuarioPorNomeMatricula(nome, matricula);

    if (usuario) {
        novoResponsavelSelecionado = usuario;
        resultadoDiv.innerHTML = '<p style="color:#16a34a;font-size:12px;"><strong>✓ Usuário encontrado:</strong> ' + usuario.full_name + ' (' + usuario.role + ')</p>';
    } else {
        novoResponsavelSelecionado = null;
        resultadoDiv.innerHTML = '<p style="color:#ef4444;font-size:12px;">Usuário não encontrado. Verifique nome e matrícula.</p>';
    }
}

// DESATIVAR FISCAL (Soft Delete - apenas muda o cargo para inativo)
async function executarExclusaoFiscal(fiscalId, nomeFiscal) {
    var cpfGerente = document.getElementById('excluir-cpf-gerente').value.replace(/\D/g, '');
    var senhaGerente = document.getElementById('excluir-senha-gerente').value;
    var confirmacao = document.getElementById('excluir-confirmacao').value.trim();
    var chkTransferir = document.getElementById('chk-transferir-tarefas');
    var msgEl = document.getElementById('msg-excluir-fiscal');
    var btnExcluir = document.getElementById('btn-confirmar-exclusao');

    // Validacoes
    if (!cpfGerente || cpfGerente.length < 11) {
        msgEl.textContent = 'Informe seu CPF completo.';
        msgEl.style.color = '#ef4444';
        return;
    }
    if (!senhaGerente) {
        msgEl.textContent = 'Informe sua senha.';
        msgEl.style.color = '#ef4444';
        return;
    }
    if (confirmacao !== 'DESATIVAR') {
        msgEl.textContent = 'Digite DESATIVAR (em maiusculo) para confirmar.';
        msgEl.style.color = '#ef4444';
        return;
    }

    // Validar transferência se checkbox marcado
    if (chkTransferir && chkTransferir.checked) {
        if (!novoResponsavelSelecionado) {
            msgEl.textContent = 'Busque e selecione um novo responsável para transferir as tarefas.';
            msgEl.style.color = '#ef4444';
            return;
        }
    }

    btnExcluir.textContent = 'Verificando...';
    btnExcluir.disabled = true;
    msgEl.textContent = '';

    try {
        // Salvar sessao do gerente atual
        var sessaoAtual = await supabaseClient.auth.getSession();
        var refreshGerente = sessaoAtual.data.session ? sessaoAtual.data.session.refresh_token : null;
        var tokenGerente = sessaoAtual.data.session ? sessaoAtual.data.session.access_token : null;

        // Verificar credenciais do gerente
        var emailGerente = cpfGerente + '@email.com';
        var { error: loginErr } = await supabaseClient.auth.signInWithPassword({
            email: emailGerente,
            password: senhaGerente
        });

        if (loginErr) {
            // Restaurar sessao original
            if (refreshGerente) {
                await supabaseClient.auth.setSession({
                    access_token: tokenGerente,
                    refresh_token: refreshGerente
                });
            }
            throw new Error('CPF ou senha incorretos. Verifique suas credenciais.');
        }

        // Restaurar sessao do gerente antes de desativar
        if (refreshGerente) {
            await supabaseClient.auth.setSession({
                access_token: tokenGerente,
                refresh_token: refreshGerente
            });
        }

        // TRANSFERIR TAREFAS se solicitado
        if (chkTransferir && chkTransferir.checked && novoResponsavelSelecionado) {
            btnExcluir.textContent = 'Transferindo tarefas...';
            var resultadoTransferencia = await transferirTarefasUsuario(
                fiscalId,
                novoResponsavelSelecionado.id,
                novoResponsavelSelecionado.full_name
            );

            if (resultadoTransferencia.erro) {
                throw new Error('Erro na transferência de tarefas: ' + resultadoTransferencia.erro);
            }
        }

        // DESATIVAR fiscal (Soft Delete - apenas muda o cargo para inativo)
        // O histórico de documentos é preservado
        var { error: deleteErr } = await supabaseClient
            .from('profiles')
            .update({
                role: 'inativo',
                ativo: false
            })
            .eq('id', fiscalId);

        if (deleteErr) throw deleteErr;

        var msgSucesso = '<strong>' + nomeFiscal + '</strong> foi desativado com sucesso.';
        if (chkTransferir && chkTransferir.checked && novoResponsavelSelecionado) {
            msgSucesso += '<br><small>Tarefas transferidas para ' + novoResponsavelSelecionado.full_name + '.</small>';
        }
        msgSucesso += '<br><small>O histórico de documentos foi preservado.</small>';
        msgEl.innerHTML = msgSucesso;
        msgEl.style.color = '#10b981';

        // Limpar variável global
        novoResponsavelSelecionado = null;

        // Fechar e atualizar ranking
        setTimeout(function () {
            var modal = document.getElementById('modal-excluir-fiscal');
            if (modal) modal.remove();
            if (typeof carregarGraficoFiscais === 'function') carregarGraficoFiscais();
        }, 2500);

    } catch (err) {
        console.error('Erro ao desativar fiscal:', err);
        msgEl.textContent = err.message || 'Erro ao desativar fiscal.';
        msgEl.style.color = '#ef4444';
        btnExcluir.textContent = 'Confirmar Desativação';
        btnExcluir.disabled = false;
    }
}



// So eh chamado quando o gerente clica na aba "Gerencia"
async function carregarDadosGerencia() {
    try {
        console.log("Carregando Painel Institucional...");

        // Pegar data atual para filtrar o mês
        const hoje = new Date();
        const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString();

        // 1. Buscar Registros Totais do Controle Processual (A tabela que todos podem ler)
        const { data: processos, error } = await supabaseClient
            .from('controle_processual')
            .select('categoria_id, campos')
            .gte('created_at', primeiroDiaMes);

        if (error) throw error;

        // Processamento Mestre (Agrupamentos)
        let totalAI = 0;
        let totalNP = 0;
        let totalOutros = 0;
        let mapBairros = {};

        processos.forEach(p => {
            // Contagem dos Cards
            if (p.categoria_id === '1.2') { totalAI++; }
            else if (p.categoria_id === '1.1') { totalNP++; }
            else { totalOutros++; }

            // Cruzamento Geográfico: Buscar campos de bairro (NPs e AIs geralmente registram Bairro)
            // Extrair o Bairro preenchido, tolerando chaves variadas nos HashMaps da JSONB
            let bairro = p.campos['Bairro'] || p.campos['bairro'] || p.campos['Local / Bairro'];

            if (bairro && typeof bairro === 'string') {
                bairro = bairro.trim().toUpperCase(); // Normalização pesada
                if (bairro.length > 2) {
                    if (!mapBairros[bairro]) mapBairros[bairro] = 0;
                    mapBairros[bairro]++;
                }
            }
        });

        // 2. Atualizar UI Cards
        const elTotalAI = document.getElementById('geral-total-ai');
        const elTotalNP = document.getElementById('geral-total-np');
        const elTotalOutros = document.getElementById('geral-total-outros');

        if (elTotalAI) elTotalAI.innerText = totalAI;
        if (elTotalNP) elTotalNP.innerText = totalNP;
        if (elTotalOutros) elTotalOutros.innerText = totalOutros;

        // 3. Renderizar Gráfico (Top 10 Bairros)
        renderizarGraficoBairrosMaster(mapBairros);

    } catch (err) {
        console.error("Erro ao carregar dados da gerência:", err);
        alert("Falha ao puxar os dados: " + (err.message || err));
    }
}

function renderizarGraficoBairrosMaster(mapBairros) {
    const canvas = document.getElementById('grafico-bairros');
    if (!canvas) return;

    // Converter Objeto Hash num Array de tuplas para ordenação e pegar Top 10
    const arrayBairros = Object.entries(mapBairros)
        .map(([bairro, qtd]) => ({ bairro, qtd }))
        .sort((a, b) => b.qtd - a.qtd)
        .slice(0, 10); // Somente o Top 10

    const labels = arrayBairros.map(item => item.bairro);
    const dataVals = arrayBairros.map(item => item.qtd);

    if (graficoBairrosInstance) {
        graficoBairrosInstance.destroy();
    }

    const ctx = canvas.getContext('2d');

    // Paleta Premium Gradient para o Gráfico
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(37, 99, 235, 0.8)'); // Blue-600
    gradient.addColorStop(1, 'rgba(56, 189, 248, 0.3)'); // Sky-400 dissipado

    graficoBairrosInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Ocorrências (Multas, NPs, etc)',
                data: dataVals,
                backgroundColor: gradient,
                borderColor: '#1d4ed8',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return ` ${context.raw} processos neste bairro`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        precision: 0
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
}

// Interligação Externa - Oculte/Mostre do menu Sidebar chama esta função 
// Para instanciar as coisas ao vivo. Modifica o loop em painel.js se possível, ou usamos EventListener.
document.addEventListener('DOMContentLoaded', () => {
    // Escuta cliques no botão do painel lateral da "Gerência Fiscal"
    const botoesMenu = document.querySelectorAll('.nav-btn');
    botoesMenu.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Se clicou no botão aba-gerencia
            if (btn.innerText.includes('Painel Institucional')) {
                carregarDadosGerencia();
            }
        });
    });
});

// Funções de Relatório Análise Estatística (Exportação PDF/ODT substituta)
function abrirConsoleGerente() {
    // Buscar totalizadores atuais da tela
    const totalAI = document.getElementById('geral-total-ai').innerText;
    const totalNP = document.getElementById('geral-total-np').innerText;
    const totalOutros = document.getElementById('geral-total-outros').innerText;

    // Obter data em português
    const dataAtual = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const tituloData = dataAtual.charAt(0).toUpperCase() + dataAtual.slice(1);

    // Pegar Tabela Top 10 Bairros da instância do Chart.js
    let linhasBairrosHTML = '';
    if (graficoBairrosInstance && graficoBairrosInstance.data) {
        const labels = graficoBairrosInstance.data.labels;
        const data = graficoBairrosInstance.data.datasets[0].data;

        for (let i = 0; i < labels.length; i++) {
            linhasBairrosHTML += `
                <tr>
                    <td style="border: 1px solid #cbd5e1; padding: 8px;">${i + 1}º</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px;">${labels[i]}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${data[i]}</td>
                </tr>
            `;
        }
    }

    if (!linhasBairrosHTML) {
        linhasBairrosHTML = '<tr><td colspan="3" style="text-align: center; padding: 10px;">Sem dados de bairros no mês vigente.</td></tr>';
    }

    const modalHTML = `
        <div class="modal-overlay ativo" id="modal-relatorio-gerente" onclick="if(event.target===this)fecharConsoleGerente()">
            <div class="relatorio-preview" id="relatorio-gerente-conteudo" style="max-width: 800px;">
                
                <div style="text-align: center; margin-bottom: 20px;">
                    <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #0c3e2b, #062117); border-radius: 50%; margin-bottom: 10px; display: flex; align-items: center; center; justify-content: center; color: white; font-size: 32px; font-weight: bold;">S</div>
                    <h3 style="margin: 0; font-size: 1.1rem; text-transform: uppercase;">Prefeitura do Município de Anápolis</h3>
                    <h4 style="margin: 5px 0 0 0; font-weight: normal; color: #475569;">Secretaria Municipal de Economia e Planejamento</h4>
                    <h4 style="margin: 2px 0 0 0; font-weight: normal; color: #475569;">Gerência Fiscalização de Posturas</h4>
                </div>

                <h1 contenteditable="true" style="text-align: center; font-size: 1.5rem; margin-top: 30px; margin-bottom: 30px; border-bottom: 2px solid #1e293b; padding-bottom: 10px;">
                    ANÁLISE ESTATÍSTICA GERAL — ${tituloData}
                </h1>
                
                <p style="text-indent: 40px; text-align: justify; line-height: 1.6;">
                    O presente relatório consolida as atividades da Gerência de Fiscalização de Posturas realizadas durante o mês vigente, englobando todas as denúncias, despachos, emissões de Notificações Preliminares, Autos de Infração e demais peças processuais mapeadas eletronicamente na base de controle geral.
                </p>

                <div class="relatorio-secao" style="margin-top: 30px;">
                    <h3>1. Totalizadores Mensais (Produção Unificada)</h3>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                        <thead>
                            <tr style="background-color: #f1f5f9;">
                                <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: left;">Tipo de Ação</th>
                                <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; width: 120px;">Quantidade</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="border: 1px solid #cbd5e1; padding: 10px;">Autos de Infração Lavrados</td>
                                <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; font-weight: bold;">${totalAI}</td>
                            </tr>
                            <tr>
                                <td style="border: 1px solid #cbd5e1; padding: 10px;">Notificações Preliminares Emitidas</td>
                                <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; font-weight: bold;">${totalNP}</td>
                            </tr>
                            <tr>
                                <td style="border: 1px solid #cbd5e1; padding: 10px;">ARs, Ofícios e Protocolos Respondidos</td>
                                <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; font-weight: bold;">${totalOutros}</td>
                            </tr>
                        </tbody>
                        <tfoot>
                            <tr style="background-color: #e2e8f0;">
                                <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; font-weight: bold;">Total Operacional:</td>
                                <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; font-weight: bold;">${parseInt(totalAI) + parseInt(totalNP) + parseInt(totalOutros)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div class="relatorio-secao" style="margin-top: 30px;">
                    <h3>2. Mapeamento Geográfico Analítico (Top 10 Bairros)</h3>
                    <p style="font-size: 0.9rem; color: #64748b; margin-bottom: 10px;">Distribuição quantitativa das incidências processuais nos bairros do município, baseada em preenchimentos dinâmicos.</p>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background-color: #f1f5f9;">
                                <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left; width: 60px;">Posição</th>
                                <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Bairro / Loteamento</th>
                                <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; width: 150px;">Nº de Incidências</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${linhasBairrosHTML}
                        </tbody>
                    </table>
                </div>

                <div class="relatorio-assinaturas" style="display: flex; justify-content: space-around; margin-top: 80px; padding-bottom: 20px; text-align: center; page-break-inside: avoid;">
                    <div>
                        <p style="margin: 0;">_________________________________________</p>
                        <p style="margin: 5px 0 0 0;"><strong contenteditable="true">[Digite o Nome da Chefia]</strong></p>
                        <p style="margin: 2px 0 0 0;">Gerente de Alvarás e Posturas</p>
                    </div>
                </div>

                <div class="relatorio-acoes" id="acoes-gerente-modal">
                    <button class="btn-cancelar-rel" onclick="fecharConsoleGerente()">Voltar</button>
                    <button class="btn-salvar-pdf" onclick="exportarRelatorioGerentePDF()">💾 Extrair Relatório</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    // Trava scroll de fundo
    document.body.style.overflow = 'hidden';
}

function fecharConsoleGerente() {
    const m = document.getElementById('modal-relatorio-gerente');
    if (m) m.remove();
    document.body.style.overflow = '';
}

function exportarRelatorioGerentePDF() {
    const conteudo = document.getElementById('relatorio-gerente-conteudo');
    const botoes = document.getElementById('acoes-gerente-modal');

    // Esconde os botões para não estragar a impressão visual
    if (botoes) botoes.style.display = 'none';

    // Opções baseadas no mesmo padrão de produtividade
    const opt = {
        margin: [10, 10, 10, 10], // top, left, bottom, right
        filename: `Analise_Estatistica_Consolidada.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(conteudo).save().then(() => {
        // Retorna botões pra tela
        if (botoes) botoes.style.display = 'flex';
    });
}

// ==========================================
// MÓDULO ALGORITMO DE SERPENTE (DISTRIBUIÇÃO)
// ==========================================

let dadosBairrosGlobais = []; // Cache do último select

function abrirPainelSerpente() {
    // 1. Extrair os bairros contados do gráfico atual
    // Se o gráfico não estiver carregado ou vazio, avisar
    if (!graficoBairrosInstance || !graficoBairrosInstance.data.labels.length) {
        alert("Para rodar a roleta, primeiro certifique-se de que há bairros listados no gráfico deste mês.");
        return;
    }

    // Pega TODOS os bairros (daquela lógica que agrupamos, não só o Top 10)
    // Para isso, precisamos recriar o mapa ou armazenar globalmente, vamos pegar do canvas para o V1
    dadosBairrosGlobais = graficoBairrosInstance.data.labels.map((label, idx) => {
        return { nome: label, peso: graficoBairrosInstance.data.datasets[0].data[idx] };
    });

    const modalHTML = `
        <div class="modal-overlay ativo" id="modal-serpente" onclick="if(event.target===this)fecharPainelSerpente()">
            <div class="modal-container" style="max-width: 650px;">
                <div class="modal-header">
                    <h2>Distribuição de Áreas (Algoritmo Serpente)</h2>
                    <button class="modal-close" onclick="fecharPainelSerpente()">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <div class="modal-body" style="padding-top: 10px;">
                    <p style="font-size: 0.9rem; color: #64748b; margin-bottom: 20px;">
                        O algoritmo ZigZag distribui os bairros mais problemáticos unindo as pedreiras (os + pesados com os - pesados) igualando a balança mensal de todos os Fiscais.
                    </p>
                    
                    <div style="background: #f1f5f9; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <label style="font-weight: 600; margin-bottom: 5px; display: block;">Fiscais na Rotação (Separados por vírgula):</label>
                        <textarea id="ipt-fiscais" rows="2" style="width: 100%; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; outline: none; resize: vertical;" placeholder="Ex: João, Maria, Pedro, Antonio"></textarea>
                    </div>

                    <div id="resultado-serpente" style="display: none; width: 100%;">
                        <h3 style="margin-bottom: 10px; color: #0f172a;">Rotas Geradas:</h3>
                        <div id="grid-rotas" style="display: flex; flex-direction: column; gap: 10px; max-height: 40vh; overflow-y: auto; padding-right: 5px;">
                            <!-- Rotas injetadas aqui -->
                        </div>
                    </div>
                </div>
                <div class="modal-footer" style="justify-content: space-between;">
                    <button class="btn-cancelar" onclick="fecharPainelSerpente()">Fechar</button>
                    <button class="btn-salvar" style="background:#10b981;" onclick="executarSerpente()">🐍 Calcular Separação</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    // Trava scroll de fundo
    document.body.style.overflow = 'hidden';
}

function fecharPainelSerpente() {
    const m = document.getElementById('modal-serpente');
    if (m) m.remove();
    document.body.style.overflow = '';
}

function executarSerpente() {
    const ipt = document.getElementById('ipt-fiscais').value;
    if (!ipt.trim()) {
        alert("Digite ao menos dois fiscais para o rodízio.");
        return;
    }

    // 1. Limpa os fiscais
    const fiscais = ipt.split(',').map(f => f.trim().toUpperCase()).filter(f => f);
    const nFiscais = fiscais.length;

    if (nFiscais < 2) {
        alert("Digite ao menos 2 nomes de Fiscais para rodar.");
        return;
    }

    // 2. Classifica bairros pelo peso DESC
    let bairros = [...dadosBairrosGlobais].sort((a, b) => b.peso - a.peso);

    // 3. Montar a Balança (N Áreas)
    let areas = Array.from({ length: nFiscais }, () => ({
        bairros: [],
        pesoTotal: 0
    }));

    // Algoritmo: ZIG ZAG Bins (Serpente LibreOffice original)
    // Direção da cobra: 1 = indo (0, 1, 2), -1 = voltando (2, 1, 0)
    let idxArea = 0;
    let direcao = 1;

    bairros.forEach(bairroObj => {
        // Encaixa o bairro na área atual
        areas[idxArea].bairros.push(bairroObj.nome);
        areas[idxArea].pesoTotal += bairroObj.peso;

        // Move a serpente
        idxArea += direcao;

        // Se bater no muro direito, vira e desce pra próxima camadinha (Mesmo índice no zigzag)
        if (idxArea >= nFiscais) {
            idxArea = nFiscais - 1;
            direcao = -1;
        }
        // Se bater no muro esquerdo voltando
        else if (idxArea < 0) {
            idxArea = 0;
            direcao = 1;
        }
    });

    // 4. Renderizar Resultado associando O Fiscal a Área (Simplificado 1x1)
    let rotasHTML = '';

    for (let i = 0; i < nFiscais; i++) {
        const area = areas[i];
        rotasHTML += `
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; margin-bottom: 8px;">
                    <strong style="color: #1e293b;">Rota ${i + 1}&nbsp;&nbsp;→&nbsp;&nbsp;<span style="color:#2563eb;">${fiscais[i]}</span></strong>
                    <span style="background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; font-weight: 600;">Peso Ocorrências: ${area.pesoTotal}</span>
                </div>
                <p style="margin: 0; font-size: 0.85rem; color: #64748b; line-height: 1.5;">
                    ${area.bairros.join(', ')}
                </p>
            </div>
        `;
    }

    const containerRes = document.getElementById('resultado-serpente');
    const gridRotas = document.getElementById('grid-rotas');

    containerRes.style.display = 'block';
    gridRotas.innerHTML = rotasHTML;
}

// ==========================================
// MÓDULO ROTAÇÃO DE BAIRROS (DISTRIBUIÇÃO)
// ==========================================

function abrirModalRotacaoBairros() {
    const modalHTML = `
        <div class="modal-overlay ativo" id="modal-rotacao-bairros" onclick="if(event.target===this)fecharModalRotacao()">
            <div class="modal-container" style="max-width: 500px;">
                <div class="modal-header">
                    <h2>Rotação Automática de Bairros</h2>
                    <button class="modal-close" onclick="fecharModalRotacao()">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <div class="modal-body" style="padding-top: 10px; display: flex; flex-direction: column; gap: 12px;">
                    <p style="font-size: 0.9rem; color: #64748b; margin-bottom: 10px;">
                        Gerencie a distribuição inteligente de bairros nas áreas de atuação existentes com base no peso processual dos últimos 30 dias.
                    </p>
                    
                    <button onclick="baixarRotacaoAtual()" style="background: white; border: 1px solid #cbd5e1; color: #334155; padding: 12px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 500; font-size: 14px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Baixar Rotação Atual (CSV)
                    </button>

                    <button onclick="atualizarRotacaoInteligente()" style="background: #10b981; border: none; color: white; padding: 12px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; font-size: 14px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.21l5.5 5.5"/></svg>
                        Atualizar Rotação (Distribuir Bairros)
                    </button>

                    <button onclick="reverterRotacaoAntiga()" style="background: #ef4444; border: none; color: white; padding: 12px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; font-size: 14px; margin-top: 10px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                        Voltar Rotação Antiga
                    </button>
                    
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.body.style.overflow = 'hidden';
}

function fecharModalRotacao() {
    const m = document.getElementById('modal-rotacao-bairros');
    if (m) m.remove();
    document.body.style.overflow = '';
}

function baixarRotacaoAtual() {
    var bairrosPorArea = {};
    var indiceArea = 1;
    globalAreas.forEach(function (a) {
        bairrosPorArea[a.id] = { idx: indiceArea++, nome: a.nome, fiscal: a.fiscal_nome || 'Não atribuído', bairros: [] };
    });

    globalBairros.forEach(function (b) {
        if (b.area_id && bairrosPorArea[b.area_id]) {
            bairrosPorArea[b.area_id].bairros.push(b.nome);
        }
    });

    var dataISO = new Date().toISOString().split('T')[0];
    var dataHoje = new Date().toLocaleDateString('pt-BR');

    var html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">';
    html += '<head><meta charset="utf-8"><title>Plano de Distribuição</title>';
    html += '<style>';
    html += 'body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }';
    html += 'h1 { text-align: center; font-size: 16pt; color: #0c3e2b; margin-bottom: 6px; }';
    html += 'h2 { text-align: center; font-size: 11pt; color: #475569; font-weight: normal; margin-bottom: 24px; }';
    html += '.area-titulo { font-size: 12pt; color: #000080; font-weight: bold; margin-top: 18px; margin-bottom: 2px; }';
    html += '.area-fiscal { font-size: 11pt; font-weight: bold; margin-bottom: 6px; }';
    html += '.bairro-lista { margin: 4px 0 4px 20px; padding: 0; }';
    html += '.bairro-lista li { font-size: 10pt; color: #000000; margin-bottom: 2px; }';
    html += '.total-area { font-size: 10pt; font-weight: bold; margin-top: 6px; margin-bottom: 4px; }';
    html += '.separador { border: none; border-top: 1px solid #999; margin: 12px 0; }';
    html += '.rodape { margin-top: 30px; font-size: 9pt; color: #94a3b8; text-align: center; }';
    html += '</style></head><body>';

    html += '<h1>Relação de Áreas e Bairros — Rotação Atual</h1>';
    html += '<h2>Gerado em ' + dataHoje + '</h2>';

    Object.keys(bairrosPorArea).forEach(function (chave) {
        var grupo = bairrosPorArea[chave];
        if (grupo.bairros.length === 0) return;

        html += '<p class="area-titulo">ÁREA ' + grupo.idx + ':</p>';
        html += '<p class="area-fiscal">RESPONSÁVEL: ' + grupo.fiscal + '</p>';

        grupo.bairros.sort();
        html += '<ul class="bairro-lista">';
        grupo.bairros.forEach(function (nome) {
            html += '<li>' + nome + '</li>';
        });
        html += '</ul>';

        // Contar ocorrências da área
        var totalArea = 0;
        grupo.bairros.forEach(function (nomeBairro) {
            var c = processarContagemBairro(nomeBairro);
            totalArea += c.np + c.ai;
        });

        html += '<p class="total-area">&gt;&gt; Total de ocorrências na área: ' + totalArea + '</p>';
        html += '<hr class="separador">';
    });

    html += '<p class="rodape">Documento gerado automaticamente pelo Sistema SEMAC.</p>';
    html += '</body></html>';

    var blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'Relacao_Areas_' + dataISO + '.doc';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

async function atualizarRotacaoInteligente() {
    if (!confirm("Atenção: Isso redistribuirá todos os bairros baseando-se no número de processos ativos dos últimos 30 dias. A distribuição atual será substituída. Deseja continuar?")) return;

    // 1. Snapshot do estado atual p/ localStorage (Backup)
    const backupAnterior = globalBairros.map(b => ({ id: b.id, area_id: b.area_id }));
    localStorage.setItem('backup_rotacao_bairros', JSON.stringify(backupAnterior));

    // 2. Calcular pesos
    let bairrosComPeso = globalBairros.map(b => {
        let cont = processarContagemBairro(b.nome);
        return {
            id: b.id,
            nome: b.nome,
            area_id: b.area_id,
            peso: cont.np + cont.ai
        };
    });

    // Filtro os que tem peso e os que não tem.
    // Order: Descending weight
    bairrosComPeso.sort((a, b) => b.peso - a.peso);

    // 3. Montar as áreas disponíveis
    if (globalAreas.length === 0) {
        alert("Não há áreas cadastradas para distribuir os bairros.");
        return;
    }

    let areasBalanca = globalAreas.map(a => ({ id: a.id, pesoTotal: 0, bairrosAtribuidos: [] }));

    // 4. Algoritmo Serpente
    let idxArea = 0;
    let direcao = 1;
    let nAreas = areasBalanca.length;

    bairrosComPeso.forEach(b => {
        areasBalanca[idxArea].bairrosAtribuidos.push(b.id);
        areasBalanca[idxArea].pesoTotal += (b.peso || 1); // Mesmo sem doc conta 1 pra n ficar vazio

        // Move zig zag
        idxArea += direcao;
        if (idxArea >= nAreas) {
            idxArea = nAreas - 1;
            direcao = -1;
        } else if (idxArea < 0) {
            idxArea = 0;
            direcao = 1;
        }
    });

    // 5. Preparar Updates async pro Supabase 
    let updates = [];
    areasBalanca.forEach(ab => {
        ab.bairrosAtribuidos.forEach(b_id => {
            let bairroRef = globalBairros.find(gb => gb.id === b_id);
            if (bairroRef) {
                updates.push({
                    id: bairroRef.id,
                    nome: bairroRef.nome,
                    area_id: ab.id
                });
            }
        });
    });

    try {
        if (typeof garantirSessaoAtiva === 'function') await garantirSessaoAtiva();
        const { error } = await supabaseClient.from('bairros').upsert(updates, { onConflict: 'id' });
        if (error) throw error;

        alert("Distribuição concluída com sucesso! Os bairros foram realocados.");
        fecharModalRotacao();
        carregarGestaoBairrosAreas(); // re-render
    } catch (err) {
        alert("Erro ao salvar nova distribuição: " + err.message);
    }
}

async function reverterRotacaoAntiga() {
    let backupString = localStorage.getItem('backup_rotacao_bairros');
    if (!backupString) {
        alert("Não há registros de uma rotação anterior salva neste computador.");
        return;
    }

    if (!confirm("Isso apagará a distribuição atual e restaurará a versão anterior exata. Confirma?")) return;

    try {
        if (typeof garantirSessaoAtiva === 'function') await garantirSessaoAtiva();
        let backupData = JSON.parse(backupString);
        let updates = backupData.map(up => {
            let bn = globalBairros.find(gb => gb.id === up.id);
            return {
                id: up.id,
                nome: bn ? bn.nome : "Desconhecido", // fallback q nunca rola
                area_id: up.area_id
            };
        });

        const { error } = await supabaseClient.from('bairros').upsert(updates, { onConflict: 'id' });
        if (error) throw error;

        alert("Rotação antiga restaurada com sucesso!");
        fecharModalRotacao();
        carregarGestaoBairrosAreas();
    } catch (err) {
        alert("Erro ao restaurar backup: " + err.message);
    }
}

// ==========================================
// MÓDULO ROTAÇÃO DE ÁREAS → FISCAIS
// ==========================================

function abrirModalRotacaoAreas() {
    var modalHTML = '<div class="modal-overlay ativo" id="modal-rotacao-areas" onclick="if(event.target===this)fecharModalRotacaoAreas()">';
    modalHTML += '<div class="modal-container" style="max-width: 500px;">';
    modalHTML += '<div class="modal-header"><h2>Rotação de Fiscais nas Áreas</h2>';
    modalHTML += '<button class="modal-close" onclick="fecharModalRotacaoAreas()">';
    modalHTML += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    modalHTML += '</button></div>';
    modalHTML += '<div class="modal-body" style="padding-top: 10px; display: flex; flex-direction: column; gap: 12px;">';
    modalHTML += '<p style="font-size: 0.9rem; color: #64748b; margin-bottom: 10px;">Redistribua os fiscais nas áreas existentes usando o algoritmo de carta e inversão (rotacional) idêntico ao sistema antigo.</p>';

    modalHTML += '<button onclick="baixarRotacaoAreasAtual()" style="background: white; border: 1px solid #cbd5e1; color: #334155; padding: 12px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 500; font-size: 14px;">';
    modalHTML += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
    modalHTML += 'Baixar Rotação Atual (Word)</button>';

    modalHTML += '<button onclick="mostrarSelecaoFiscais()" style="background: #10b981; border: none; color: white; padding: 12px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; font-size: 14px;">';
    modalHTML += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6m-3-3h6"/></svg>';
    modalHTML += 'Atualizar Rotação (Selecionar Fiscais)</button>';

    modalHTML += '<div id="painel-selecao-fiscais" style="display:none; background: #f8fafc; border-radius: 8px; padding: 14px; border: 1px solid #e2e8f0;">';
    modalHTML += '<p style="font-size: 0.85rem; font-weight: 600; color: #334155; margin-bottom: 10px;">Selecione os fiscais que participarão da rotação:</p>';
    modalHTML += '<div id="lista-checkboxes-fiscais" style="max-height: 200px; overflow-y: auto;"></div>';
    modalHTML += '<button onclick="executarRotacaoAreas()" style="margin-top: 12px; width: 100%; background: #2563eb; color: white; border: none; padding: 10px; border-radius: 6px; font-weight: 600; font-size: 14px; cursor: pointer;">Confirmar e Distribuir</button>';
    modalHTML += '</div>';

    modalHTML += '<button onclick="reverterRotacaoAreas()" style="background: #ef4444; border: none; color: white; padding: 12px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; font-size: 14px; margin-top: 10px;">';
    modalHTML += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>';
    modalHTML += 'Voltar Rotação Antiga</button>';

    modalHTML += '</div></div></div>';

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.body.style.overflow = 'hidden';
}

function fecharModalRotacaoAreas() {
    var m = document.getElementById('modal-rotacao-areas');
    if (m) m.remove();
    document.body.style.overflow = '';
}

function baixarRotacaoAreasAtual() {
    // Reutiliza a mesma função que já gera o Word no formato do Relacao_Áreas
    baixarRotacaoAtual();
}

async function mostrarSelecaoFiscais() {
    var painel = document.getElementById('painel-selecao-fiscais');
    var container = document.getElementById('lista-checkboxes-fiscais');
    if (!painel || !container) return;

    container.innerHTML = '<p style="color:#94a3b8; font-size:13px;">Carregando fiscais...</p>';
    painel.style.display = 'block';

    try {
        var { data: fiscais, error } = await supabaseClient
            .from('profiles')
            .select('id, full_name, role')
            .in('role', ['fiscal', 'Fiscal', 'Fiscal de Posturas', 'fiscal de posturas', 'Fiscal de Postura', 'fiscal de postura'])
            .order('full_name', { ascending: true });

        if (error) throw error;

        if (!fiscais || fiscais.length === 0) {
            container.innerHTML = '<p style="color:#ef4444; font-size:13px;">Nenhum fiscal encontrado.</p>';
            return;
        }

        var html = '';
        fiscais.forEach(function (f) {
            html += '<label style="display: flex; align-items: center; gap: 8px; padding: 6px 4px; cursor: pointer; font-size: 13px; color: #334155;">';
            html += '<input type="checkbox" class="checkbox-fiscal-rotacao" value="' + f.full_name + '" checked style="width:16px; height:16px; accent-color:#10b981;">';
            html += f.full_name;
            html += '</label>';
        });
        container.innerHTML = html;

    } catch (err) {
        container.innerHTML = '<p style="color:#ef4444; font-size:13px;">Erro: ' + err.message + '</p>';
    }
}

// Algoritmo TransformarFila — réplica fiel da macro original
// Realiza shift rotacional: divide no meio, inverte a 2ª metade, intercala
function transformarFila(arr, nRotacao) {
    if (arr.length <= 1) return arr;

    var resultado = arr.slice(); // cópia

    for (var r = 0; r < nRotacao; r++) {
        var meio = Math.floor(resultado.length / 2);
        var metade1 = resultado.slice(0, meio);
        var metade2 = resultado.slice(meio);
        metade2.reverse();

        var novoArray = [];
        var maxLen = Math.max(metade1.length, metade2.length);
        for (var i = 0; i < maxLen; i++) {
            if (i < metade2.length) novoArray.push(metade2[i]);
            if (i < metade1.length) novoArray.push(metade1[i]);
        }
        resultado = novoArray;
    }

    return resultado;
}

async function executarRotacaoAreas() {
    var checkboxes = document.querySelectorAll('.checkbox-fiscal-rotacao:checked');
    var fiscaisSelecionados = [];
    checkboxes.forEach(function (cb) { fiscaisSelecionados.push(cb.value); });

    if (fiscaisSelecionados.length === 0) {
        alert('Selecione pelo menos um fiscal para a rotação.');
        return;
    }

    if (globalAreas.length === 0) {
        alert('Não há áreas cadastradas para distribuir.');
        return;
    }

    if (!confirm('Isso redistribuirá os fiscais nas ' + globalAreas.length + ' áreas existentes usando ' + fiscaisSelecionados.length + ' fiscais selecionados. Confirma?')) return;

    // 1. Backup do estado atual
    var backupAreas = globalAreas.map(function (a) { return { id: a.id, fiscal_nome: a.fiscal_nome }; });
    localStorage.setItem('backup_rotacao_areas', JSON.stringify(backupAreas));

    // 2. Obter o nº da rotação atual e incrementar
    var nRotacao = parseInt(localStorage.getItem('rotacao_areas_contador') || '0', 10);
    nRotacao++;
    localStorage.setItem('rotacao_areas_contador', String(nRotacao));

    // 3. Aplicar TransformarFila (carta e inversão)
    var filaRotacionada = transformarFila(fiscaisSelecionados, nRotacao);

    // 4. Distribuir fiscais nas áreas (estilo carta)
    var updates = [];
    for (var i = 0; i < globalAreas.length; i++) {
        var fiscalIdx = i % filaRotacionada.length;
        updates.push({
            id: globalAreas[i].id,
            nome: globalAreas[i].nome,
            fiscal_nome: filaRotacionada[fiscalIdx]
        });
    }

    // 5. Salvar no Supabase
    try {
        if (typeof garantirSessaoAtiva === 'function') await garantirSessaoAtiva();
        var { error } = await supabaseClient.from('areas').upsert(updates, { onConflict: 'id' });
        if (error) throw error;

        alert('Rotação concluída! Rodada Nº ' + nRotacao + '. Os fiscais foram redistribuídos nas áreas.');
        fecharModalRotacaoAreas();
        carregarGestaoBairrosAreas();
    } catch (err) {
        alert('Erro ao salvar rotação: ' + err.message);
    }
}

async function reverterRotacaoAreas() {
    var backupString = localStorage.getItem('backup_rotacao_areas');
    if (!backupString) {
        alert('Não há registros de uma rotação anterior de áreas salva neste computador.');
        return;
    }

    if (!confirm('Isso restaurará a atribuição anterior dos fiscais nas áreas. Confirma?')) return;

    try {
        if (typeof garantirSessaoAtiva === 'function') await garantirSessaoAtiva();
        var backupData = JSON.parse(backupString);
        var updates = backupData.map(function (up) {
            var areaRef = globalAreas.find(function (a) { return a.id === up.id; });
            return {
                id: up.id,
                nome: areaRef ? areaRef.nome : 'Área',
                fiscal_nome: up.fiscal_nome
            };
        });

        var { error } = await supabaseClient.from('areas').upsert(updates, { onConflict: 'id' });
        if (error) throw error;

        // Decrementar o contador de rotação
        var nRotacao = parseInt(localStorage.getItem('rotacao_areas_contador') || '1', 10);
        if (nRotacao > 0) localStorage.setItem('rotacao_areas_contador', String(nRotacao - 1));

        alert('Rotação anterior restaurada com sucesso!');
        fecharModalRotacaoAreas();
        carregarGestaoBairrosAreas();
    } catch (err) {
        alert('Erro ao restaurar backup: ' + err.message);
    }
}


// ==========================================
// DASHBOARD DO DIRETOR - GESTAO DE GERENTES
// ==========================================

// Funcao principal que carrega o dashboard do Diretor
async function carregarDashboardDiretor() {
    try {
        await carregarGerentesHierarquiaDiretor();
        await carregarGerentesAmbientalHierarquiaDiretor();
        // Carregar tarefas do diretor
        if (typeof carregarMinhasTarefasHome === 'function') {
            carregarMinhasTarefasHome('diretor-minhas-tarefas');
        }
    } catch (err) {
        console.error("Erro ao carregar dashboard do diretor:", err);
    }
}

// Carrega a lista de Gerentes
async function carregarGerentesHierarquiaDiretor() {
    var container = document.getElementById('diretor-gerentes-hierarquia');
    if (!container) return;

    try {
        // Buscar todos os gerentes
        var { data: gerentes, error: errGerentes } = await supabaseClient
            .from('profiles')
            .select('id, full_name, avatar_url, email_real, matricula')
            .in('role', ['Gerente', 'Gerente de Posturas', 'Gerente de Postura', 'gerente de posturas', 'gerente de postura']);

        if (errGerentes) throw errGerentes;

        // Atualizar contador
        var elTotal = document.getElementById('diretor-total-gerentes');
        if (elTotal) elTotal.innerText = gerentes ? gerentes.length : 0;

        if (!gerentes || gerentes.length === 0) {
            container.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:40px;">Nenhum gerente cadastrado.</div>';
            return;
        }

        var html = '';
        var cores = ['#8b5cf6', '#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#ec4899', '#06b6d4'];

        gerentes.forEach(function (gerente, index) {
            var cor = cores[index % cores.length];

            var fotoHtml = '';
            if (gerente.avatar_url) {
                fotoHtml = '<img src="' + gerente.avatar_url + '" style="width:50px;height:50px;border-radius:50%;object-fit:cover;border:3px solid ' + cor + ';">';
            } else {
                fotoHtml = '<div style="width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,' + cor + ',#666);display:flex;align-items:center;justify-content:center;font-size:20px;color:white;border:3px solid ' + cor + ';">' + (gerente.full_name ? gerente.full_name.charAt(0).toUpperCase() : 'G') + '</div>';
            }

            html += '<div style="background:white;border-radius:12px;padding:16px;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);border-left:4px solid ' + cor + ';cursor:pointer;transition:transform 0.2s,box-shadow 0.2s;" onmouseover="this.style.transform=\'translateY(-2px)\';this.style.boxShadow=\'0 4px 12px rgba(0,0,0,0.1)\'" onmouseout="this.style.transform=\'none\';this.style.boxShadow=\'0 2px 8px rgba(0,0,0,0.06)\'" onclick="abrirEstatisticasFuncionario(\'' + gerente.id + '\', \'' + (gerente.full_name || '').replace(/'/g, "\\'") + '\', \'Gerente de Posturas\')">';

            html += '<div style="display:flex;align-items:center;gap:12px;">';
            html += fotoHtml;
            html += '<div style="flex:1;">';
            html += '<div style="font-weight:700;font-size:16px;color:#1e293b;">' + (gerente.full_name || 'Sem Nome') + '</div>';
            html += '<div style="font-size:12px;color:#64748b;">Matrícula: ' + (gerente.matricula || '---') + '</div>';
            if (gerente.email_real) {
                html += '<div style="font-size:11px;color:#94a3b8;">' + gerente.email_real + '</div>';
            }
            html += '</div>';

            // Botao de exclusao
            html += '<div style="display:flex;gap:8px;" onclick="event.stopPropagation();">';
            html += '<button onclick="abrirExcluirGerenteDiretor(\'' + gerente.id + '\', \'' + (gerente.full_name || '').replace(/'/g, "\\'") + '\')" title="Excluir" style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:8px 12px;cursor:pointer;font-size:12px;color:#dc2626;font-weight:600;">Excluir</button>';
            html += '</div>';
            html += '</div>';

            html += '</div>';
        });

        // Botao + Novo Gerente no final
        html += '<div style="margin-top:16px;text-align:center;">';
        html += '<button onclick="abrirFormNovoGerente()" style="background:transparent;border:2px dashed #8b5cf6;color:#8b5cf6;padding:12px 24px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;width:100%;transition:all 0.2s;" onmouseover="this.style.background=\'#8b5cf6\';this.style.color=\'white\'" onmouseout="this.style.background=\'transparent\';this.style.color=\'#8b5cf6\'">+ Novo Gerente</button>';
        html += '</div>';

        container.innerHTML = html;

    } catch (err) {
        console.error("Erro ao carregar gerentes:", err);
        container.innerHTML = '<div style="text-align:center; color:#ef4444; padding:40px;">Erro ao carregar gerentes.</div>';
    }
}

// Carrega a lista de Gerentes de Regularização Ambiental
async function carregarGerentesAmbientalHierarquiaDiretor() {
    var container = document.getElementById('diretor-gerentes-ambiental-hierarquia');
    if (!container) return;

    try {
        // Buscar todos os gerentes de regularização ambiental
        var { data: gerentes, error: errGerentes } = await supabaseClient
            .from('profiles')
            .select('id, full_name, avatar_url, email_real, matricula')
            .in('role', ['Gerente de Regularização Ambiental', 'gerente de regularização ambiental',
                'Gerente de Regularizacao Ambiental', 'gerente de regularizacao ambiental']);

        if (errGerentes) throw errGerentes;

        // Atualizar contador
        var elTotal = document.getElementById('diretor-total-gerentes-ambiental');
        if (elTotal) elTotal.innerText = gerentes ? gerentes.length : 0;

        if (!gerentes || gerentes.length === 0) {
            container.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:40px;">Nenhum gerente de regularização ambiental cadastrado.</div>';
            return;
        }

        var html = '';
        var cores = ['#3b82f6', '#06b6d4', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981', '#ec4899'];

        gerentes.forEach(function (gerente, index) {
            var cor = cores[index % cores.length];

            var fotoHtml = '';
            if (gerente.avatar_url) {
                fotoHtml = '<img src="' + gerente.avatar_url + '" style="width:50px;height:50px;border-radius:50%;object-fit:cover;border:3px solid ' + cor + '">';
            } else {
                fotoHtml = '<div style="width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,' + cor + ',#666);display:flex;align-items:center;justify-content:center;font-size:20px;color:white;border:3px solid ' + cor + '">' + (gerente.full_name ? gerente.full_name.charAt(0).toUpperCase() : 'G') + '</div>';
            }

            html += '<div style="background:white;border-radius:12px;padding:16px;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);border-left:4px solid ' + cor + ';cursor:pointer;transition:transform 0.2s,box-shadow 0.2s;" onmouseover="this.style.transform=\'translateY(-2px)\';this.style.boxShadow=\'0 4px 12px rgba(0,0,0,0.1)\'" onmouseout="this.style.transform=\'none\';this.style.boxShadow=\'0 2px 8px rgba(0,0,0,0.06)\'" onclick="abrirEstatisticasFuncionario(\'' + gerente.id + '\', \'' + (gerente.full_name || '').replace(/'/g, "\\'") + '\', \'Gerente de Regularização Ambiental\')">';

            html += '<div style="display:flex;align-items:center;gap:12px;">';
            html += fotoHtml;
            html += '<div style="flex:1;">';
            html += '<div style="font-weight:700;font-size:16px;color:#1e293b;">' + (gerente.full_name || 'Sem Nome') + '</div>';
            html += '<div style="font-size:12px;color:#64748b;">Matrícula: ' + (gerente.matricula || '---') + '</div>';
            if (gerente.email_real) {
                html += '<div style="font-size:11px;color:#94a3b8;">' + gerente.email_real + '</div>';
            }
            html += '</div>';

            // Botao de exclusao
            html += '<div style="display:flex;gap:8px;" onclick="event.stopPropagation();">';
            html += '<button onclick="abrirExcluirGerenteAmbientalDiretor(\'' + gerente.id + '\', \'' + (gerente.full_name || '').replace(/'/g, "\\'") + '\')" title="Excluir" style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:8px 12px;cursor:pointer;font-size:12px;color:#dc2626;font-weight:600;">Excluir</button>';
            html += '</div>';
            html += '</div>';

            html += '</div>';
        });

        // Botao + Novo Gerente no final
        html += '<div style="margin-top:16px;text-align:center;">';
        html += '<button onclick="abrirFormNovoGerenteAmbiental()" style="background:transparent;border:2px dashed #3b82f6;color:#3b82f6;padding:12px 24px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;width:100%;transition:all 0.2s;" onmouseover="this.style.background=\'#3b82f6\';this.style.color=\'white\'" onmouseout="this.style.background=\'transparent\';this.style.color=\'#3b82f6\'">+ Novo Gerente Ambiental</button>';
        html += '</div>';

        container.innerHTML = html;

    } catch (err) {
        console.error("Erro ao carregar gerentes de regularização ambiental:", err);
        container.innerHTML = '<div style="text-align:center; color:#ef4444; padding:40px;">Erro ao carregar gerentes.</div>';
    }
}

// Abre modal para criar novo Gerente
function abrirFormNovoGerente() {
    var existente = document.getElementById('modal-novo-gerente');
    if (existente) existente.remove();

    var modal = document.createElement('div');
    modal.id = 'modal-novo-gerente';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;';

    modal.innerHTML = ''
        + '<div style="background:white;border-radius:12px;width:90%;max-width:420px;padding:30px;position:relative;">'
        + '<button onclick="document.getElementById(\'modal-novo-gerente\').remove()" style="position:absolute;top:10px;right:14px;background:none;border:none;font-size:24px;cursor:pointer;color:#64748b;">\u2715</button>'
        + '<h2 style="margin:0 0 20px 0;color:#1e293b;">Cadastrar Novo Gerente</h2>'
        + '<div style="margin-bottom:14px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;">CPF</label>'
        + '<input type="text" id="novo-gerente-cpf" placeholder="000.000.000-00" maxlength="14" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;" oninput="mascaraCpfNovoFiscal(this)">'
        + '</div>'
        + '<div style="margin-bottom:14px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;">Nome Completo</label>'
        + '<input type="text" id="novo-gerente-nome" placeholder="Nome do gerente" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">'
        + '</div>'
        + '<div style="margin-bottom:14px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;">E-mail</label>'
        + '<input type="email" id="novo-gerente-email" placeholder="email@exemplo.com" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">'
        + '</div>'
        + '<div style="margin-bottom:20px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;">Matrícula</label>'
        + '<input type="text" id="novo-gerente-matricula" placeholder="Matrícula" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">'
        + '</div>'
        + '<p style="font-size:12px;color:#94a3b8;margin-bottom:16px;">Cargo: <strong>Gerente de Posturas</strong> | Senha padrão: <strong>123456</strong></p>'
        + '<div id="msg-novo-gerente" style="margin-bottom:12px;font-size:13px;"></div>'
        + '<button onclick="salvarNovoGerente()" id="btn-salvar-novo-gerente" style="width:100%;padding:12px;background:#8b5cf6;color:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">Cadastrar Gerente</button>'
        + '</div>';

    document.body.appendChild(modal);
}

// Salva o novo Gerente no banco
async function salvarNovoGerente() {
    var cpfInput = document.getElementById('novo-gerente-cpf').value.trim();
    var nome = document.getElementById('novo-gerente-nome').value.trim();
    var emailReal = document.getElementById('novo-gerente-email').value.trim();
    var matricula = document.getElementById('novo-gerente-matricula').value.trim();
    var msgEl = document.getElementById('msg-novo-gerente');
    var btn = document.getElementById('btn-salvar-novo-gerente');

    var cpfLimpo = cpfInput.replace(/\D/g, '');

    if (!cpfLimpo || cpfLimpo.length < 11) {
        msgEl.textContent = 'CPF inválido.';
        msgEl.style.color = '#ef4444';
        return;
    }
    if (!nome) {
        msgEl.textContent = 'Nome é obrigatório.';
        msgEl.style.color = '#ef4444';
        return;
    }

    btn.textContent = 'Processando...';
    btn.disabled = true;

    try {
        // PADRONIZAÇÃO: Usar @email.com para bater com o login (script.js)
        var emailFicticio = cpfLimpo + '@email.com';

        // 1. Verificar se o perfil já existe
        var { data: existingProfile, error: searchErr } = await supabaseClient
            .from('profiles')
            .select('id')
            .eq('cpf', cpfLimpo)
            .maybeSingle();

        if (searchErr) throw searchErr;

        var userId;

        if (existingProfile) {
            userId = existingProfile.id;
        } else {
            var { data: authData, error: authError } = await supabaseClient.auth.signUp({
                email: emailFicticio,
                password: '123456'
            });

            if (authError) throw authError;
            userId = authData.user.id;
        }

        // 2. Atualizar perfil (upsert)
        var { error: profileError } = await supabaseClient
            .from('profiles')
            .upsert({
                id: userId,
                full_name: nome,
                cpf: cpfLimpo,
                matricula: matricula,
                role: 'Gerente de Posturas',
                email_real: emailReal,
                email: emailFicticio
            }, { onConflict: 'id' });

        if (profileError) throw profileError;

        msgEl.innerHTML = '<span style="color:#10b981;">Gerente processado com sucesso!</span>';

        setTimeout(function () {
            var modal = document.getElementById('modal-novo-gerente');
            if (modal) modal.remove();
            if (typeof carregarDashboardDiretor === 'function') carregarDashboardDiretor();
        }, 1500);

    } catch (err) {
        console.error('Erro ao salvar gerente:', err);
        msgEl.textContent = err.message || 'Erro ao cadastrar gerente.';
        msgEl.style.color = '#ef4444';
        btn.textContent = 'Cadastrar Gerente';
        btn.disabled = false;
    }
}

// Modal de confirmacao para desativar Gerente
function abrirExcluirGerenteDiretor(gerenteId, nomeGerente) {
    var existente = document.getElementById('modal-excluir-gerente');
    if (existente) existente.remove();

    var modal = document.createElement('div');
    modal.id = 'modal-excluir-gerente';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;';

    modal.innerHTML = ''
        + '<div style="background:white;border-radius:12px;width:90%;max-width:420px;padding:30px;position:relative;">'
        + '<button onclick="document.getElementById(\'modal-excluir-gerente\').remove()" style="position:absolute;top:10px;right:14px;background:none;border:none;font-size:24px;cursor:pointer;color:#64748b;">\u2715</button>'
        + '<div style="text-align:center;margin-bottom:20px;">'
        + '<div style="width:50px;height:50px;border-radius:50%;background:#fff7ed;display:inline-flex;align-items:center;justify-content:center;font-size:24px;margin-bottom:10px;">🚫</div>'
        + '<h2 style="margin:0;color:#c2410c;">Desativar Gerente</h2>'
        + '<p style="color:#64748b;margin:8px 0 0 0;">Você está prestes a desativar:</p>'
        + '<p style="font-weight:700;font-size:18px;color:#1e293b;margin:4px 0 0 0;">' + nomeGerente + '</p>'
        + '</div>'
        + '<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px;margin-bottom:16px;">'
        + '<p style="color:#c2410c;font-size:13px;margin:0;"><strong>ℹ️ Atenção:</strong> O gerente será desativado e não poderá mais acessar o sistema. O histórico será preservado.</p>'
        + '</div>'
        + '<div style="margin-bottom:14px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">'
        + '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;">'
        + '<input type="checkbox" id="chk-transferir-tarefas-gerente" style="width:18px;height:18px;accent-color:#c2410c;" onchange="toggleTransferenciaTarefasGerente()">'
        + '<span style="font-weight:600;color:#334155;">Transferir tarefas para outro usuário</span>'
        + '</label>'
        + '</div>'
        + '<div id="secao-transferencia-gerente" style="display:none;margin-bottom:14px;padding:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;">'
        + '<p style="color:#166534;font-size:12px;margin:0 0 10px 0;"><strong>ℹ️ Transferência:</strong> As tarefas serão transferidas para o novo responsável.</p>'
        + '<div style="margin-bottom:10px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;font-size:13px;">Nome do novo responsável</label>'
        + '<input type="text" id="transferir-gerente-nome" placeholder="Nome completo" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">'
        + '</div>'
        + '<div style="margin-bottom:10px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;font-size:13px;">Matrícula do novo responsável</label>'
        + '<input type="text" id="transferir-gerente-matricula" placeholder="Número da matrícula" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">'
        + '</div>'
        + '<button onclick="buscarNovoResponsavelGerente()" style="width:100%;padding:8px;background:#16a34a;color:white;border:none;border-radius:6px;font-size:13px;cursor:pointer;">Buscar Usuário</button>'
        + '<div id="resultado-busca-usuario-gerente" style="margin-top:10px;"></div>'
        + '</div>'
        + '<div style="margin-bottom:16px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;">Digite <strong style="color:#c2410c;">DESATIVAR</strong> para confirmar</label>'
        + '<input type="text" id="excluir-gerente-confirmacao" placeholder="DESATIVAR" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">'
        + '</div>'
        + '<div id="msg-excluir-gerente" style="margin-bottom:12px;font-size:13px;text-align:center;"></div>'
        + '<button onclick="excluirGerenteDiretor(\'' + gerenteId + '\', \'' + nomeGerente.replace(/'/g, "\\'") + '\')" id="btn-confirmar-excluir-gerente" style="width:100%;padding:12px;background:#c2410c;color:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">Confirmar Desativação</button>'
        + '</div>';

    document.body.appendChild(modal);
}

// Toggle para mostrar/ocultar seção de transferência (Gerente)
function toggleTransferenciaTarefasGerente() {
    var chk = document.getElementById('chk-transferir-tarefas-gerente');
    var secao = document.getElementById('secao-transferencia-gerente');
    if (chk && secao) {
        secao.style.display = chk.checked ? 'block' : 'none';
    }
}

// Variável para armazenar novo responsável do gerente
var novoResponsavelGerenteSelecionado = null;

// Buscar novo responsável para transferência (Gerente)
async function buscarNovoResponsavelGerente() {
    var nome = document.getElementById('transferir-gerente-nome').value.trim();
    var matricula = document.getElementById('transferir-gerente-matricula').value.trim();
    var resultadoDiv = document.getElementById('resultado-busca-usuario-gerente');

    if (!nome || !matricula) {
        resultadoDiv.innerHTML = '<p style="color:#ef4444;font-size:12px;">Preencha nome e matrícula.</p>';
        return;
    }

    resultadoDiv.innerHTML = '<p style="color:#64748b;font-size:12px;">Buscando...</p>';

    var usuario = await buscarUsuarioPorNomeMatricula(nome, matricula);

    if (usuario) {
        novoResponsavelGerenteSelecionado = usuario;
        resultadoDiv.innerHTML = '<p style="color:#16a34a;font-size:12px;"><strong>✓ Usuário encontrado:</strong> ' + usuario.full_name + ' (' + usuario.role + ')</p>';
    } else {
        novoResponsavelGerenteSelecionado = null;
        resultadoDiv.innerHTML = '<p style="color:#ef4444;font-size:12px;">Usuário não encontrado. Verifique nome e matrícula.</p>';
    }
}

// DESATIVAR GERENTE (Soft Delete)
async function excluirGerenteDiretor(gerenteId, nomeGerente) {
    var confirmacao = document.getElementById('excluir-gerente-confirmacao').value.trim();
    var chkTransferir = document.getElementById('chk-transferir-tarefas-gerente');
    var msgEl = document.getElementById('msg-excluir-gerente');
    var btn = document.getElementById('btn-confirmar-excluir-gerente');

    if (confirmacao !== 'DESATIVAR') {
        msgEl.textContent = 'Digite DESATIVAR para confirmar.';
        msgEl.style.color = '#ef4444';
        return;
    }

    // Validar transferência se checkbox marcado
    if (chkTransferir && chkTransferir.checked) {
        if (!novoResponsavelGerenteSelecionado) {
            msgEl.textContent = 'Busque e selecione um novo responsável para transferir as tarefas.';
            msgEl.style.color = '#ef4444';
            return;
        }
    }

    btn.textContent = 'Desativando...';
    btn.disabled = true;

    try {
        // TRANSFERIR TAREFAS se solicitado
        if (chkTransferir && chkTransferir.checked && novoResponsavelGerenteSelecionado) {
            btn.textContent = 'Transferindo tarefas...';
            var resultadoTransferencia = await transferirTarefasUsuario(
                gerenteId,
                novoResponsavelGerenteSelecionado.id,
                novoResponsavelGerenteSelecionado.full_name
            );

            if (resultadoTransferencia.erro) {
                throw new Error('Erro na transferência: ' + resultadoTransferencia.erro);
            }
        }

        // Desativar gerente (Soft Delete)
        var { error } = await supabaseClient
            .from('profiles')
            .update({ role: 'inativo', ativo: false })
            .eq('id', gerenteId);

        if (error) throw error;

        var msgSucesso = '<span style="color:#10b981;">Gerente desativado com sucesso!';
        if (chkTransferir && chkTransferir.checked && novoResponsavelGerenteSelecionado) {
            msgSucesso += '<br><small>Tarefas transferidas para ' + novoResponsavelGerenteSelecionado.full_name + '.</small>';
        }
        msgSucesso += '<br><small>Histórico preservado.</small></span>';
        msgEl.innerHTML = msgSucesso;

        // Limpar variável
        novoResponsavelGerenteSelecionado = null;

        setTimeout(function () {
            document.getElementById('modal-excluir-gerente').remove();
            if (typeof carregarDashboardDiretor === 'function') carregarDashboardDiretor();
        }, 2500);

    } catch (err) {
        console.error('Erro ao desativar gerente:', err);
        msgEl.textContent = err.message || 'Erro ao desativar gerente.';
        msgEl.style.color = '#ef4444';
        btn.textContent = 'Confirmar Desativação';
        btn.disabled = false;
    }
}

// ==========================================
// FUNÇÕES PARA GERENTE DE REGULARIZAÇÃO AMBIENTAL
// ==========================================

// Abre modal para criar novo Gerente de Regularização Ambiental
function abrirFormNovoGerenteAmbiental() {
    var existente = document.getElementById('modal-novo-gerente-ambiental');
    if (existente) existente.remove();

    var modal = document.createElement('div');
    modal.id = 'modal-novo-gerente-ambiental';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;';

    modal.innerHTML = ''
        + '<div style="background:white;border-radius:12px;width:90%;max-width:420px;padding:30px;position:relative;">'
        + '<button onclick="document.getElementById(\'modal-novo-gerente-ambiental\').remove()" style="position:absolute;top:10px;right:14px;background:none;border:none;font-size:24px;cursor:pointer;color:#64748b;">\u2715</button>'
        + '<h2 style="margin:0 0 20px 0;color:#1e293b;">Cadastrar Novo Gerente de Regularização Ambiental</h2>'
        + '<div style="margin-bottom:14px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;">CPF</label>'
        + '<input type="text" id="novo-gerente-amb-cpf" placeholder="000.000.000-00" maxlength="14" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;" oninput="mascaraCpfNovoFiscal(this)">'
        + '</div>'
        + '<div style="margin-bottom:14px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;">Nome Completo</label>'
        + '<input type="text" id="novo-gerente-amb-nome" placeholder="Nome do gerente" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">'
        + '</div>'
        + '<div style="margin-bottom:14px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;">E-mail</label>'
        + '<input type="email" id="novo-gerente-amb-email" placeholder="email@exemplo.com" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">'
        + '</div>'
        + '<div style="margin-bottom:20px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;">Matrícula</label>'
        + '<input type="text" id="novo-gerente-amb-matricula" placeholder="Matrícula" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">'
        + '</div>'
        + '<p style="font-size:12px;color:#94a3b8;margin-bottom:16px;">Cargo: <strong>Gerente de Regularização Ambiental</strong> | Senha padrão: <strong>123456</strong></p>'
        + '<div id="msg-novo-gerente-amb" style="margin-bottom:12px;font-size:13px;"></div>'
        + '<button onclick="salvarNovoGerenteAmbiental()" id="btn-salvar-novo-gerente-amb" style="width:100%;padding:12px;background:#3b82f6;color:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">Cadastrar Gerente</button>'
        + '</div>';

    document.body.appendChild(modal);
}

// Salva o novo Gerente de Regularização Ambiental no banco
async function salvarNovoGerenteAmbiental() {
    var cpfInput = document.getElementById('novo-gerente-amb-cpf').value.trim();
    var nome = document.getElementById('novo-gerente-amb-nome').value.trim();
    var emailReal = document.getElementById('novo-gerente-amb-email').value.trim();
    var matricula = document.getElementById('novo-gerente-amb-matricula').value.trim();
    var msgEl = document.getElementById('msg-novo-gerente-amb');
    var btn = document.getElementById('btn-salvar-novo-gerente-amb');

    var cpfLimpo = cpfInput.replace(/\D/g, '');

    if (!cpfLimpo || cpfLimpo.length < 11) {
        msgEl.textContent = 'CPF inválido.';
        msgEl.style.color = '#ef4444';
        return;
    }
    if (!nome) {
        msgEl.textContent = 'Nome é obrigatório.';
        msgEl.style.color = '#ef4444';
        return;
    }

    btn.textContent = 'Processando...';
    btn.disabled = true;

    try {
        // PADRONIZAÇÃO: Usar @email.com para bater com o login (script.js)
        var emailFicticio = cpfLimpo + '@email.com';

        // 1. Verificar se o perfil já existe
        var { data: existingProfile, error: searchErr } = await supabaseClient
            .from('profiles')
            .select('id')
            .eq('cpf', cpfLimpo)
            .maybeSingle();

        if (searchErr) throw searchErr;

        var userId;

        if (existingProfile) {
            userId = existingProfile.id;
        } else {
            var { data: authData, error: authError } = await supabaseClient.auth.signUp({
                email: emailFicticio,
                password: '123456'
            });

            if (authError) throw authError;
            userId = authData.user.id;
        }

        // 2. Atualizar perfil (upsert)
        var { error: profileError } = await supabaseClient
            .from('profiles')
            .upsert({
                id: userId,
                full_name: nome,
                cpf: cpfLimpo,
                matricula: matricula,
                role: 'Gerente de Regularização Ambiental',
                email_real: emailReal,
                email: emailFicticio
            }, { onConflict: 'id' });

        if (profileError) throw profileError;

        msgEl.innerHTML = '<span style="color:#10b981;">Gerente de Regularização Ambiental processado com sucesso!</span>';

        setTimeout(function () {
            var modal = document.getElementById('modal-novo-gerente-ambiental');
            if (modal) modal.remove();
            if (typeof carregarDashboardDiretor === 'function') carregarDashboardDiretor();
        }, 1500);

    } catch (err) {
        console.error('Erro ao salvar gerente de regularização ambiental:', err);
        msgEl.textContent = err.message || 'Erro ao cadastrar gerente.';
        msgEl.style.color = '#ef4444';
        btn.textContent = 'Cadastrar Gerente';
        btn.disabled = false;
    }
}

// Modal de confirmacao para desativar Gerente de Regularização Ambiental
function abrirExcluirGerenteAmbientalDiretor(gerenteId, nomeGerente) {
    var existente = document.getElementById('modal-excluir-gerente-amb');
    if (existente) existente.remove();

    var modal = document.createElement('div');
    modal.id = 'modal-excluir-gerente-amb';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;';

    modal.innerHTML = ''
        + '<div style="background:white;border-radius:12px;width:90%;max-width:420px;padding:30px;position:relative;">'
        + '<button onclick="document.getElementById(\'modal-excluir-gerente-amb\').remove()" style="position:absolute;top:10px;right:14px;background:none;border:none;font-size:24px;cursor:pointer;color:#64748b;">\u2715</button>'
        + '<div style="text-align:center;margin-bottom:20px;">'
        + '<div style="width:50px;height:50px;border-radius:50%;background:#eff6ff;display:inline-flex;align-items:center;justify-content:center;font-size:24px;margin-bottom:10px;">🚫</div>'
        + '<h2 style="margin:0;color:#1e40af;">Desativar Gerente de Regularização Ambiental</h2>'
        + '<p style="color:#64748b;margin:8px 0 0 0;">Você está prestes a desativar:</p>'
        + '<p style="font-weight:700;font-size:18px;color:#1e293b;margin:4px 0 0 0;">' + nomeGerente + '</p>'
        + '</div>'
        + '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px;margin-bottom:16px;">'
        + '<p style="color:#1e40af;font-size:13px;margin:0;"><strong>ℹ️ Atenção:</strong> O gerente será desativado e não poderá mais acessar o sistema. O histórico será preservado.</p>'
        + '</div>'
        + '<div style="margin-bottom:14px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">'
        + '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;">'
        + '<input type="checkbox" id="chk-transferir-tarefas-gerente-amb" style="width:18px;height:18px;accent-color:#3b82f6;" onchange="toggleTransferenciaTarefasGerenteAmb()">'
        + '<span style="font-weight:600;color:#334155;">Transferir tarefas para outro usuário</span>'
        + '</label>'
        + '</div>'
        + '<div id="secao-transferencia-gerente-amb" style="display:none;margin-bottom:14px;padding:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;">'
        + '<p style="color:#166534;font-size:12px;margin:0 0 10px 0;"><strong>ℹ️ Transferência:</strong> As tarefas serão transferidas para o novo responsável.</p>'
        + '<div style="margin-bottom:10px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;font-size:13px;">Nome do novo responsável</label>'
        + '<input type="text" id="transferir-gerente-amb-nome" placeholder="Nome completo" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">'
        + '</div>'
        + '<div style="margin-bottom:10px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;font-size:13px;">Matrícula do novo responsável</label>'
        + '<input type="text" id="transferir-gerente-amb-matricula" placeholder="Número da matrícula" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">'
        + '</div>'
        + '<button onclick="buscarNovoResponsavelGerenteAmb()" style="width:100%;padding:8px;background:#16a34a;color:white;border:none;border-radius:6px;font-size:13px;cursor:pointer;">Buscar Usuário</button>'
        + '<div id="resultado-busca-usuario-gerente-amb" style="margin-top:10px;"></div>'
        + '</div>'
        + '<div style="margin-bottom:16px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;">Digite <strong style="color:#dc2626;">DESATIVAR</strong> para confirmar</label>'
        + '<input type="text" id="excluir-gerente-amb-confirmacao" placeholder="DESATIVAR" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">'
        + '</div>'
        + '<div id="msg-excluir-gerente-amb" style="margin-bottom:12px;font-size:13px;text-align:center;"></div>'
        + '<button onclick="excluirGerenteAmbientalDiretor(\'' + gerenteId + '\', \'' + nomeGerente.replace(/'/g, "\\'") + '\')" id="btn-confirmar-excluir-gerente-amb" style="width:100%;padding:12px;background:#dc2626;color:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">Confirmar Desativação</button>'
        + '</div>';

    document.body.appendChild(modal);
}

// Toggle para mostrar/ocultar seção de transferência (Gerente Ambiental)
function toggleTransferenciaTarefasGerenteAmb() {
    var chk = document.getElementById('chk-transferir-tarefas-gerente-amb');
    var secao = document.getElementById('secao-transferencia-gerente-amb');
    if (chk && secao) {
        secao.style.display = chk.checked ? 'block' : 'none';
    }
}

// Variável para armazenar novo responsável do gerente ambiental
var novoResponsavelGerenteAmbSelecionado = null;

// Buscar novo responsável para transferência (Gerente Ambiental)
async function buscarNovoResponsavelGerenteAmb() {
    var nome = document.getElementById('transferir-gerente-amb-nome').value.trim();
    var matricula = document.getElementById('transferir-gerente-amb-matricula').value.trim();
    var resultadoDiv = document.getElementById('resultado-busca-usuario-gerente-amb');

    if (!nome || !matricula) {
        resultadoDiv.innerHTML = '<p style="color:#ef4444;font-size:12px;">Preencha nome e matrícula.</p>';
        return;
    }

    resultadoDiv.innerHTML = '<p style="color:#64748b;font-size:12px;">Buscando...</p>';

    var usuario = await buscarUsuarioPorNomeMatricula(nome, matricula);

    if (usuario) {
        novoResponsavelGerenteAmbSelecionado = usuario;
        resultadoDiv.innerHTML = '<p style="color:#16a34a;font-size:12px;"><strong>✓ Usuário encontrado:</strong> ' + usuario.full_name + ' (' + usuario.role + ')</p>';
    } else {
        novoResponsavelGerenteAmbSelecionado = null;
        resultadoDiv.innerHTML = '<p style="color:#ef4444;font-size:12px;">Usuário não encontrado. Verifique nome e matrícula.</p>';
    }
}

// DESATIVAR GERENTE DE REGULARIZAÇÃO AMBIENTAL (Soft Delete)
async function excluirGerenteAmbientalDiretor(gerenteId, nomeGerente) {
    var confirmacao = document.getElementById('excluir-gerente-amb-confirmacao').value.trim();
    var chkTransferir = document.getElementById('chk-transferir-tarefas-gerente-amb');
    var msgEl = document.getElementById('msg-excluir-gerente-amb');
    var btn = document.getElementById('btn-confirmar-excluir-gerente-amb');

    if (confirmacao !== 'DESATIVAR') {
        msgEl.textContent = 'Digite DESATIVAR para confirmar.';
        msgEl.style.color = '#ef4444';
        return;
    }

    // Validar transferência se checkbox marcado
    if (chkTransferir && chkTransferir.checked) {
        if (!novoResponsavelGerenteAmbSelecionado) {
            msgEl.textContent = 'Busque e selecione um novo responsável para transferir as tarefas.';
            msgEl.style.color = '#ef4444';
            return;
        }
    }

    btn.textContent = 'Desativando...';
    btn.disabled = true;

    try {
        // TRANSFERIR TAREFAS se solicitado
        if (chkTransferir && chkTransferir.checked && novoResponsavelGerenteAmbSelecionado) {
            btn.textContent = 'Transferindo tarefas...';
            var resultadoTransferencia = await transferirTarefasUsuario(
                gerenteId,
                novoResponsavelGerenteAmbSelecionado.id,
                novoResponsavelGerenteAmbSelecionado.full_name
            );

            if (resultadoTransferencia.erro) {
                throw new Error('Erro na transferência: ' + resultadoTransferencia.erro);
            }
        }

        // Desativar gerente (Soft Delete)
        var { error } = await supabaseClient
            .from('profiles')
            .update({ role: 'inativo', ativo: false })
            .eq('id', gerenteId);

        if (error) throw error;

        var msgSucesso = '<span style="color:#10b981;">Gerente de Regularização Ambiental desativado com sucesso!';
        if (chkTransferir && chkTransferir.checked && novoResponsavelGerenteAmbSelecionado) {
            msgSucesso += '<br><small>Tarefas transferidas para ' + novoResponsavelGerenteAmbSelecionado.full_name + '.</small>';
        }
        msgSucesso += '<br><small>Histórico preservado.</small></span>';
        msgEl.innerHTML = msgSucesso;

        // Limpar variável
        novoResponsavelGerenteAmbSelecionado = null;

        setTimeout(function () {
            document.getElementById('modal-excluir-gerente-amb').remove();
            if (typeof carregarDashboardDiretor === 'function') carregarDashboardDiretor();
        }, 2500);

    } catch (err) {
        console.error('Erro ao desativar gerente de regularização ambiental:', err);
        msgEl.textContent = err.message || 'Erro ao desativar gerente.';
        msgEl.style.color = '#ef4444';
        btn.textContent = 'Confirmar Desativação';
        btn.disabled = false;
    }
}


// ==========================================
// DASHBOARD DO SECRETÁRIO - HIERARQUIA COMPLETA
// ==========================================

// Funcao principal que carrega o dashboard do Secretario
async function carregarDashboardSecretario() {
    console.log("DEBUG - Iniciando carregarDashboardSecretario");
    try {
        console.log("DEBUG - Chamando carregarHierarquiaCompletaSecretario");
        await carregarHierarquiaCompletaSecretario();

        console.log("DEBUG - Chamando carregarResumoTarefasSecretario");
        await carregarResumoTarefasSecretario();

        console.log("DEBUG - Chamando carregarGraficoDocumentosSecretario");
        await carregarGraficoDocumentosSecretario();

        console.log("DEBUG - Chamando carregarCalendarioProjetosSecretario");
        await carregarCalendarioProjetosSecretario();

        console.log("DEBUG - Dashboard do secretario carregado com sucesso");
    } catch (err) {
        console.error("Erro ao carregar dashboard do secretario:", err);
    }
}

// Carrega a hierarquia completa de funcionários em formato de árvore
async function carregarHierarquiaCompletaSecretario() {
    console.log("DEBUG - Iniciando carregarHierarquiaCompletaSecretario");
    var container = document.getElementById('secretario-arvore-hierarquia');
    console.log("DEBUG - Container:", container);
    if (!container) return;

    try {
        container.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:40px;">Carregando estrutura...</div>';

        // Buscar todos os funcionários ativos
        var { data: funcionarios, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .neq('role', 'inativo')
            .order('full_name', { ascending: true });

        if (error) throw error;

        if (!funcionarios || funcionarios.length === 0) {
            container.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:40px;">Nenhum funcionário cadastrado.</div>';
            return;
        }

        // Separar por hierarquia
        var diretoresMA = [];
        var diretoresCA = [];
        var gerentesJuridico = [];
        var equipeRH = [];
        var equipeSecDoSec = []; // NOVO CARGO

        var gerentesPosturas = [];
        var gerentesAmbiental = [];
        var gerentesCuidadoAnimal = [];
        var fiscais = [];
        var equipeAmbiental = [];
        var equipeCuidadoAnimal = [];

        funcionarios.forEach(function (f) {
            var roleRaw = (f.role || '').toLowerCase();
            var roleNorm = roleRaw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

            if (roleRaw === 'secretário(a)' || roleRaw === 'secretario(a)' || roleRaw === 'secretario') {
                return; // Não mostrar secretário
            }

            // LÍDERES (Nível 1)
            if (roleNorm.includes('secretario') && roleNorm.includes('do') && roleNorm.includes('secretario')) {
                equipeSecDoSec.push(f);
            } else if (roleNorm.includes('diretor') && roleNorm.includes('cuidado') && roleNorm.includes('animal')) {
                diretoresCA.push(f);
            } else if (roleNorm.includes('diretor')) {
                diretoresMA.push(f);
            } else if (roleNorm.includes('gerente') && roleNorm.includes('interface') && roleNorm.includes('juridica')) {
                gerentesJuridico.push(f);
            } else if (roleNorm.includes('agente') && roleNorm.includes('administracao')) {
                equipeRH.push(f);
            }
            // GERENTES E EQUIPES (Nível 2 e 3)
            else if (roleNorm.includes('gerente') && roleNorm.includes('cuidado') && roleNorm.includes('animal')) {
                gerentesCuidadoAnimal.push(f);
            } else if (roleNorm.includes('gerente') && roleNorm.includes('postura')) {
                gerentesPosturas.push(f);
            } else if (roleNorm.includes('gerente') && (roleNorm.includes('ambiental') || roleNorm.includes('regulariza'))) {
                gerentesAmbiental.push(f);
            } else if (roleNorm.includes('coordenador') && roleNorm.includes('cuidado') && roleNorm.includes('animal')) {
                equipeCuidadoAnimal.push(f);
            } else if (roleNorm.includes('fiscal') || roleNorm.includes('administrativo')) {
                fiscais.push(f);
            }
            // EQUIPE DE REGULARIZAÇÃO AMBIENTAL
            else if (roleNorm.includes('agronomo') || roleNorm.includes('agrônomo') ||
                     roleNorm.includes('engenheiro') || roleNorm.includes('engenheira') ||
                     roleNorm.includes('analista') || roleNorm.includes('auxiliar')) {
                equipeAmbiental.push(f);
            }
        });

        console.log("DEBUG - Funcionários processados:", {
            diretoresMA: diretoresMA.length,
            diretoresCA: diretoresCA.length,
            gerentesJuridico: gerentesJuridico.length,
            equipeRH: equipeRH.length,
            gerentesPosturas: gerentesPosturas.length,
            gerentesAmbiental: gerentesAmbiental.length,
            fiscais: fiscais.length,
            equipeAmbiental: equipeAmbiental.length,
            equipeCuidadoAnimal: equipeCuidadoAnimal.length
        });

        // Criar árvore visual hierárquica com linhas de conexão
        var html = '<div style="display: flex; flex-direction: column; align-items: center; width: 100%; padding: 0px 5px; position: relative; font-size: 12px; background: transparent; box-sizing: border-box;">';
        
        // ===== NÍVEL 1: SECRETÁRIO =====
        html += '<div style="text-align: center; position: relative; z-index: 2;">';
        html += '<div style="display: inline-block; background: #1e3a5f; color: white; padding: 5px 14px; border-radius: 16px; font-size: 10px; font-weight: 700;">SEMAC</div>';
        html += '</div>';
        
        // Linha vertical Secretaria -> Diretores
        html += '<div style="width: 2px; height: 15px; background: #1e3a5f; margin: 0 auto;"></div>';
        
        // ===== NÍVEL 2: DIRETORES E CARGOS =====
        html += '<div style="display: flex; justify-content: center; gap: 35px; width: 100%; margin-top: 5px; flex-wrap: wrap; align-items: flex-start;">';
        
        // === DIRETOR DE MEIO AMBIENTE ===
        html += '<div style="display: flex; flex-direction: column; align-items: center; width: 100%; max-width: 700px; flex: 1;">';
        html += '<span style="background: #7c3aed; color: white; padding: 3px 10px; border-radius: 10px; font-size: 9px; font-weight: 700; margin-bottom: 6px;">DIRETOR(A) DE MEIO AMBIENTE</span>';
        diretoresMA.forEach(function (d) { html += renderizarCardArvore(d, '#7c3aed', 'diretor'); });
        if (diretoresMA.length === 0) html += '<div style="padding: 10px; border: 1px dashed #cbd5e1; border-radius: 8px; color: #94a3b8; font-size: 11px;">Nenhum</div>';
        html += '<button onclick="abrirFormNovoFuncionarioPorCargo(\'Diretor(a) de Meio Ambiente\')" style="margin-top: 10px; background: #7c3aed15; border: 1px dashed #7c3aed; color: #7c3aed; padding: 4px 12px; border-radius: 6px; font-size: 10px; cursor: pointer;">+ Novo</button>';
        
        // Linha vertical para subníveis
        html += '<div style="width: 2px; height: 15px; background: #7c3aed; margin: 8px 0 0 0;"></div>';
        
        // Container das duas gerências lado a lado
        html += '<div style="display: flex; justify-content: center; gap: 45px; width: 100%; align-items: flex-start; padding: 0 10px; box-sizing: border-box;">';
        
        // Gerência de Posturas
        html += '<div style="display: flex; flex-direction: column; align-items: center; width: 280px; flex: 0 0 auto;">';
        html += '<div style="width: 2px; height: 15px; background: #0c3e2b;"></div>';
        html += '<span style="background: #0c3e2b; color: white; padding: 2px 8px; border-radius: 8px; font-size: 8px; font-weight: 700;">GERÊNCIA POSTURAS</span>';
        html += '<div style="width: 2px; height: 10px; background: #0c3e2b; margin: 2px 0;"></div>';
        html += '<div style="display: flex; flex-direction: column; gap: 6px; width: 100%;">';
        gerentesPosturas.forEach(function (g) { html += renderizarCardArvoreCompacto(g, '#0c3e2b', 'gerente_posturas'); });
        html += '</div>';
        html += '<button onclick="abrirFormNovoFuncionarioPorCargo(\'Gerente de Posturas\')" style="margin-top: 8px; background: #0c3e2b15; border: 1px dashed #0c3e2b; color: #0c3e2b; padding: 3px 8px; border-radius: 5px; font-size: 9px; cursor: pointer;">+ Novo</button>';
        
        // Fiscais
        if (fiscais.length > 0) {
            html += '<div style="width: 2px; height: 10px; background: #b45309; margin: 4px 0 2px 0;"></div>';
            html += '<span style="background: #b45309; color: white; padding: 2px 6px; border-radius: 6px; font-size: 7px; font-weight: 700;">FISCAIS (' + fiscais.length + ')</span>';
            html += '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; width: 100%; margin-top: 4px;">';
            fiscais.forEach(function (f) { html += renderizarCardArvoreCompacto(f, '#b45309', 'fiscal'); });
            html += '</div>';
        }
        html += '<button onclick="abrirFormNovoFuncionarioPorCargo(\'Fiscal de Posturas\')" style="margin-top: 8px; background: #b4530915; border: 1px dashed #b45309; color: #b45309; padding: 3px 8px; border-radius: 5px; font-size: 9px; cursor: pointer;">+ Novo</button>';
        html += '</div>';
        
        // Gerência Ambiental
        html += '<div style="display: flex; flex-direction: column; align-items: center; width: 280px; flex: 0 0 auto;">';
        html += '<div style="width: 2px; height: 15px; background: #1e3a5f;"></div>';
        html += '<span style="background: #1e3a5f; color: white; padding: 2px 8px; border-radius: 8px; font-size: 8px; font-weight: 700;">GERÊNCIA AMBIENTAL</span>';
        html += '<div style="width: 2px; height: 10px; background: #1e3a5f; margin: 2px 0;"></div>';
        html += '<div style="display: flex; flex-direction: column; gap: 6px; width: 100%;">';
        gerentesAmbiental.forEach(function (g) { html += renderizarCardArvoreCompacto(g, '#1e3a5f', 'gerente_ambiental'); });
        html += '</div>';
        html += '<button onclick="abrirFormNovoFuncionarioPorCargo(\'Gerente de Regularização Ambiental\')" style="margin-top: 8px; background: #1e3a5f15; border: 1px dashed #1e3a5f; color: #1e3a5f; padding: 3px 8px; border-radius: 5px; font-size: 9px; cursor: pointer;">+ Novo</button>';
        
        // Equipe RA
        if (equipeAmbiental.length > 0) {
            html += '<div style="width: 2px; height: 10px; background: #065f46; margin: 4px 0 2px 0;"></div>';
            html += '<span style="background: #065f46; color: white; padding: 2px 6px; border-radius: 6px; font-size: 7px; font-weight: 700;">EQUIPE (' + equipeAmbiental.length + ')</span>';
            html += '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; width: 100%; margin-top: 4px;">';
            equipeAmbiental.forEach(function (e) { html += renderizarCardArvoreCompacto(e, '#065f46', 'equipe_ambiental'); });
            html += '</div>';
        }
        // Dropdown para Equipe RA
        html += '<div style="position: relative; margin-top: 8px;">';
        html += '<button id="btn-novo-equipe-ra" style="background: #065f4615; border: 1px dashed #065f46; color: #065f46; padding: 3px 8px; border-radius: 5px; font-size: 9px; cursor: pointer;" onclick="toggleMenuEquipeRA()">+ Novo ▼</button>';
        html += '<div id="menu-equipe-ra" style="display: none; position: absolute; top: 100%; left: 50%; transform: translateX(-50%); background: white; border: 1px solid #065f46; border-radius: 5px; padding: 3px; z-index: 100; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">';
        html += '<div style="padding: 3px 6px; cursor: pointer; font-size: 9px; white-space: nowrap;" onclick="abrirFormNovoFuncionarioPorCargo(\'Engenheiro(a) Agrônomo(a)\')">Eng. Agrônomo</div>';
        html += '<div style="padding: 3px 6px; cursor: pointer; font-size: 9px; white-space: nowrap;" onclick="abrirFormNovoFuncionarioPorCargo(\'Engenheiro(a) Civil\')">Eng. Civil</div>';
        html += '<div style="padding: 3px 6px; cursor: pointer; font-size: 9px; white-space: nowrap;" onclick="abrirFormNovoFuncionarioPorCargo(\'Analista Ambiental\')">Analista</div>';
        html += '<div style="padding: 3px 6px; cursor: pointer; font-size: 9px; white-space: nowrap;" onclick="abrirFormNovoFuncionarioPorCargo(\'Auxiliar de Serviços II\')">Auxiliar</div>';
        html += '</div>';
        html += '</div>';
        html += '</div>';
        
        html += '</div>'; // Fim container das duas gerências
        html += '</div>'; // Fim Diretor MA
        
        // === DIRETOR CUIDADO ANIMAL ===
        html += '<div style="display: flex; flex-direction: column; align-items: center; min-width: 220px; flex: 0 0 auto;">';
        html += '<span style="background: #db2777; color: white; padding: 3px 10px; border-radius: 10px; font-size: 9px; font-weight: 700; margin-bottom: 6px;">DIRETOR(A) CUIDADO ANIMAL</span>';
        diretoresCA.forEach(function (d) { html += renderizarCardArvore(d, '#db2777', 'diretor_ca'); });
        if (diretoresCA.length === 0) html += '<div style="padding: 10px; border: 1px dashed #cbd5e1; border-radius: 8px; color: #94a3b8; font-size: 11px;">Nenhum</div>';
        html += '<button onclick="abrirFormNovoFuncionarioPorCargo(\'Diretor(a) do Cuidado Animal\')" style="margin-top: 10px; background: #db277715; border: 1px dashed #db2777; color: #db2777; padding: 4px 12px; border-radius: 6px; font-size: 10px; cursor: pointer;">+ Novo</button>';
        
        html += '<div style="width: 2px; height: 15px; background: #db2777; margin: 8px 0 0 0;"></div>';
        html += '<span style="background: #be185d; color: white; padding: 2px 8px; border-radius: 8px; font-size: 8px; font-weight: 700;">GERENTE CA</span>';
        html += '<div style="width: 2px; height: 10px; background: #be185d; margin: 2px 0;"></div>';
        html += '<div style="display: flex; flex-direction: column; gap: 12px; width: 100%;">';
        gerentesCuidadoAnimal.forEach(function (g) { html += renderizarCardArvoreCompacto(g, '#be185d', 'gerente_ca'); });
        html += '</div>';
        html += '<button onclick="abrirFormNovoFuncionarioPorCargo(\'Gerente do Cuidado Animal\')" style="margin-top: 8px; background: #be185d15; border: 1px dashed #be185d; color: #be185d; padding: 3px 8px; border-radius: 5px; font-size: 9px; cursor: pointer;">+ Novo</button>';
        
        if (equipeCuidadoAnimal.length > 0) {
            html += '<div style="width: 2px; height: 10px; background: #c026d3; margin: 4px 0 2px 0;"></div>';
            html += '<span style="background: #c026d3; color: white; padding: 2px 6px; border-radius: 6px; font-size: 7px; font-weight: 700;">COORD. (' + equipeCuidadoAnimal.length + ')</span>';
            html += '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; width: 100%; margin-top: 8px;">';
            equipeCuidadoAnimal.forEach(function (e) { html += renderizarCardArvoreCompacto(e, '#c026d3', 'coordenador_ca'); });
            html += '</div>';
        }
        html += '<button onclick="abrirFormNovoFuncionarioPorCargo(\'Coordenador(a) do Cuidado Animal\')" style="margin-top: 8px; background: #c026d315; border: 1px dashed #c026d3; color: #c026d3; padding: 3px 8px; border-radius: 5px; font-size: 9px; cursor: pointer;">+ Novo</button>';
        html += '</div>';
        
        html += '</div>'; // Fim nível 2 (apenas diretores e hierarquia)
        
        // ===== CARGOS ESPECIAIS (RH/ADM, JURÍDICO e SEC DO SEC) - EMBAIXO DE TUDO =====
        html += '<div style="display: flex; justify-content: center; gap: 40px; width: 100%; margin-top: 25px; padding-top: 20px; border-top: 1px dashed #cbd5e1; flex-wrap: wrap;">';
        
        // === RH / ADM ===
        html += '<div style="display: flex; flex-direction: column; align-items: center; min-width: 160px;">';
        html += '<span style="background: #0d9488; color: white; padding: 3px 10px; border-radius: 10px; font-size: 9px; font-weight: 700; margin-bottom: 8px;">RH / ADM</span>';
        html += '<div style="display: flex; flex-direction: column; gap: 12px;">';
        equipeRH.forEach(function (e) { html += renderizarCardArvore(e, '#0d9488', 'rh'); });
        if (equipeRH.length === 0) html += '<div style="padding: 10px; border: 1px dashed #cbd5e1; border-radius: 8px; color: #94a3b8; font-size: 11px;">Nenhum</div>';
        html += '</div>';
        html += '<button onclick="abrirFormNovoFuncionarioPorCargo(\'Agente de Administração\')" style="margin-top: 10px; background: #0d948815; border: 1px dashed #0d9488; color: #0d9488; padding: 4px 12px; border-radius: 6px; font-size: 10px; cursor: pointer;">+ Novo</button>';
        html += '</div>';
        
        // === JURÍDICO ===
        html += '<div style="display: flex; flex-direction: column; align-items: center; min-width: 160px;">';
        html += '<span style="background: #4f46e5; color: white; padding: 3px 10px; border-radius: 10px; font-size: 9px; font-weight: 700; margin-bottom: 8px;">JURÍDICO</span>';
        html += '<div style="display: flex; flex-direction: column; gap: 12px;">';
        gerentesJuridico.forEach(function (g) { html += renderizarCardArvore(g, '#4f46e5', 'juridico'); });
        if (gerentesJuridico.length === 0) html += '<div style="padding: 10px; border: 1px dashed #cbd5e1; border-radius: 8px; color: #94a3b8; font-size: 11px;">Nenhum</div>';
        html += '</div>';
        html += '<button onclick="abrirFormNovoFuncionarioPorCargo(\'Gerente de Interface Jurídica\')" style="margin-top: 10px; background: #4f46e515; border: 1px dashed #4f46e5; color: #4f46e5; padding: 4px 12px; border-radius: 6px; font-size: 10px; cursor: pointer;">+ Novo</button>';
        html += '</div>';

        // === SECRETÁRIO(A) DO SECRETÁRIO(A) ===
        html += '<div style="display: flex; flex-direction: column; align-items: center; min-width: 160px;">';
        html += '<span style="background: #e11d48; color: white; padding: 3px 10px; border-radius: 10px; font-size: 9px; font-weight: 700; margin-bottom: 8px;">SEC. DO SECRETÁRIO(A)</span>';
        html += '<div style="display: flex; flex-direction: column; gap: 12px;">';
        equipeSecDoSec.forEach(function (e) { html += renderizarCardArvore(e, '#e11d48', 'sec_sec'); });
        if (equipeSecDoSec.length === 0) html += '<div style="padding: 10px; border: 1px dashed #cbd5e1; border-radius: 8px; color: #94a3b8; font-size: 11px;">Nenhum</div>';
        html += '</div>';
        html += '<button onclick="abrirFormNovoFuncionarioPorCargo(\'Secretário(a) do Secretário(a)\')" style="margin-top: 10px; background: #e11d4815; border: 1px dashed #e11d48; color: #e11d48; padding: 4px 12px; border-radius: 6px; font-size: 10px; cursor: pointer;">+ Novo</button>';
        html += '</div>';
        
        html += '</div>'; // Fim cargos especiais
        
        html += '</div>'; // Fim container

        console.log("DEBUG - HTML gerado para hierarquia (comprimento):", html.length);
        container.innerHTML = html;

    } catch (err) {
        console.error("Erro ao carregar hierarquia:", err);
        container.innerHTML = '<div style="text-align:center; color:#ef4444; padding:40px;">Erro ao carregar estrutura.</div>';
    }
}

// Renderiza card GRANDE (Diretores - nível 1)
function renderizarCardArvore(funcionario, cor, tipo) {
    var nomeAbreviado = (funcionario.full_name || 'Sem Nome');
    if (nomeAbreviado.length > 22) nomeAbreviado = nomeAbreviado.substring(0, 21) + '...';
    var onclickAction = 'onclick="abrirEstatisticasFuncionario(\'' + funcionario.id + '\', \'' + (funcionario.full_name || 'Sem nome').replace(/'/g, "\\'") + '\', \'' + (funcionario.role || 'Sem cargo').replace(/'/g, "\\'") + '\')"';

    // Card diretor - tamanho padrão
    var html = '<div style="background: rgba(255,255,255,0.8); border-radius: 14px; padding: 14px 16px; border: 2px solid ' + cor + '; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; gap: 12px; min-width: 220px; box-shadow: 0 3px 10px rgba(0,0,0,0.08); position: relative;" onmouseover="this.style.background=\'white\';this.style.boxShadow=\'0 5px 15px ' + cor + '50\';this.style.transform=\'translateY(-3px)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.8)\';this.style.boxShadow=\'0 3px 10px rgba(0,0,0,0.08)\';this.style.transform=\'none\'" title="' + (funcionario.full_name || 'Sem Nome') + '">';

    if (funcionario.avatar_url) {
        html += '<img src="' + funcionario.avatar_url + '" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 2px solid ' + cor + ';">';
    } else {
        html += '<div style="width: 44px; height: 44px; border-radius: 50%; background: ' + cor + '; display: flex; align-items: center; justify-content: center; font-size: 16px; color: white; font-weight: 600;">' + (funcionario.full_name ? funcionario.full_name.charAt(0).toUpperCase() : 'U') + '</div>';
    }

    html += '<div style="flex: 1; min-width: 0; overflow: hidden;" ' + onclickAction + '>';
    html += '<div style="font-weight: 600; color: #1e293b; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + nomeAbreviado + '</div>';
    html += '<div style="font-size: 11px; color: ' + cor + '; font-weight: 600;">' + (funcionario.role || '---') + '</div>';
    html += '</div>';

    html += '<button onclick="event.stopPropagation(); confirmarDesativarFuncionarioArvore(\'' + funcionario.id + '\', \'' + (funcionario.full_name || 'Sem nome').replace(/'/g, "\\'") + '\', \'' + (funcionario.role || '').replace(/'/g, "\\'") + '\')" style="background: transparent; border: none; cursor: pointer; padding: 5px; border-radius: 5px;" onmouseover="this.style.background=\'rgba(239,68,68,0.1)\'" onmouseout="this.style.background=\'transparent\'">';
    html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>';
    html += '</button>';

    html += '</div>';
    return html;
}

// Renderiza card MÉDIO (Gerentes - nível 2) - 10% menor que o grande
function renderizarCardArvoreMedio(funcionario, cor, tipo) {
    var nomeAbreviado = (funcionario.full_name || 'Sem Nome');
    if (nomeAbreviado.length > 16) nomeAbreviado = nomeAbreviado.substring(0, 15) + '...';
    var onclickAction = 'onclick="abrirEstatisticasFuncionario(\'' + funcionario.id + '\', \'' + (funcionario.full_name || 'Sem nome').replace(/'/g, "\\'") + '\', \'' + (funcionario.role || 'Sem cargo').replace(/'/g, "\\'") + '\')"';

    // Card médio (90% do tamanho do grande)
    var html = '<div style="background: rgba(255,255,255,0.75); border-radius: 11px; padding: 9px 10px; border: 2px solid ' + cor + '; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; gap: 9px; min-width: 175px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); position: relative;" onmouseover="this.style.background=\'white\';this.style.boxShadow=\'0 4px 12px ' + cor + '40\';this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.75)\';this.style.boxShadow=\'0 2px 8px rgba(0,0,0,0.06)\';this.style.transform=\'none\'" title="' + (funcionario.full_name || 'Sem Nome') + '">';

    if (funcionario.avatar_url) {
        html += '<img src="' + funcionario.avatar_url + '" style="width: 34px; height: 34px; border-radius: 50%; object-fit: cover; border: 2px solid ' + cor + ';">';
    } else {
        html += '<div style="width: 34px; height: 34px; border-radius: 50%; background: ' + cor + '; display: flex; align-items: center; justify-content: center; font-size: 13px; color: white; font-weight: 600;">' + (funcionario.full_name ? funcionario.full_name.charAt(0).toUpperCase() : 'U') + '</div>';
    }

    html += '<div style="flex: 1; min-width: 0; overflow: hidden;" ' + onclickAction + '>';
    html += '<div style="font-weight: 600; color: #1e293b; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + nomeAbreviado + '</div>';
    html += '<div style="font-size: 9px; color: ' + cor + '; font-weight: 600;">' + (funcionario.role || '---') + '</div>';
    html += '</div>';

    html += '<button onclick="event.stopPropagation(); confirmarDesativarFuncionarioArvore(\'' + funcionario.id + '\', \'' + (funcionario.full_name || 'Sem nome').replace(/'/g, "\\'") + '\', \'' + (funcionario.role || '').replace(/'/g, "\\'") + '\')" style="background: transparent; border: none; cursor: pointer; padding: 4px; border-radius: 5px;" onmouseover="this.style.background=\'rgba(239,68,68,0.1)\'" onmouseout="this.style.background=\'transparent\'">';
    html += '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>';
    html += '</button>';

    html += '</div>';
    return html;
}

// Renderiza card PEQUENO (Fiscais/Equipe - nível 3) - Tamanho adequado para não sobrepor
function renderizarCardArvoreCompacto(funcionario, cor, tipo) {
    var nomeAbreviado = (funcionario.full_name || 'Sem Nome');
    if (nomeAbreviado.length > 18) nomeAbreviado = nomeAbreviado.substring(0, 17) + '...';
    var onclickAction = 'onclick="abrirEstatisticasFuncionario(\'' + funcionario.id + '\', \'' + (funcionario.full_name || 'Sem nome').replace(/'/g, "\\'") + '\', \'' + (funcionario.role || 'Sem cargo').replace(/'/g, "\\'") + '\')"';

    // Card compacto para Fiscais e Equipe RA
    var html = '<div style="background: rgba(255,255,255,0.75); border-radius: 8px; padding: 6px 8px; border: 2px solid ' + cor + '; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; gap: 6px; min-width: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.08);" onmouseover="this.style.background=\'white\';this.style.boxShadow=\'0 4px 12px ' + cor + '40\'" onmouseout="this.style.background=\'rgba(255,255,255,0.75)\';this.style.boxShadow=\'0 2px 8px rgba(0,0,0,0.08)\'" title="' + (funcionario.full_name || 'Sem Nome') + '">';

    if (funcionario.avatar_url) {
        html += '<img src="' + funcionario.avatar_url + '" style="width: 26px; height: 26px; border-radius: 50%; object-fit: cover; border: 2px solid ' + cor + ';">';
    } else {
        html += '<div style="width: 26px; height: 26px; border-radius: 50%; background: ' + cor + '; display: flex; align-items: center; justify-content: center; font-size: 11px; color: white; font-weight: 600;">' + (funcionario.full_name ? funcionario.full_name.charAt(0).toUpperCase() : 'U') + '</div>';
    }

    html += '<div style="flex: 1; min-width: 0; overflow: hidden;" ' + onclickAction + '>';
    html += '<div style="font-weight: 600; color: #1e293b; font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + nomeAbreviado + '</div>';
    html += '<div style="font-size: 8px; color: ' + cor + '; font-weight: 600;">' + (funcionario.matricula || '---') + '</div>';
    html += '</div>';

    html += '<button onclick="event.stopPropagation(); confirmarDesativarFuncionarioArvore(\'' + funcionario.id + '\', \'' + (funcionario.full_name || 'Sem nome').replace(/'/g, "\\'") + '\', \'' + (funcionario.role || '').replace(/'/g, "\\'") + '\')" style="background: transparent; border: none; cursor: pointer; padding: 2px; border-radius: 4px;" onmouseover="this.style.background=\'rgba(239,68,68,0.1)\'" onmouseout="this.style.background=\'transparent\'">';
    html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>';
    html += '</button>';

    html += '</div>';
    return html;
}

// Renderiza card mini para equipes (mais compacto ainda)
function renderizarCardArvoreMini(funcionario, cor, tipo) {
    var nomeAbreviado = (funcionario.full_name || 'Sem Nome');
    if (nomeAbreviado.length > 10) nomeAbreviado = nomeAbreviado.substring(0, 9) + '...';
    
    var html = '<div style="background: transparent; border-radius: 8px; padding: 6px 8px; border: 1px solid ' + cor + '; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; gap: 4px;" onmouseover="this.style.background=\'rgba(255,255,255,0.1)\'" onmouseout="this.style.background=\'transparent\'" onclick="mostrarTarefasFuncionario(\'' + funcionario.id + '\', \'' + (funcionario.full_name || 'Sem nome').replace(/'/g, "\\'") + '\', \'' + (funcionario.role || 'Sem cargo').replace(/'/g, "\\'") + '\')" title="' + (funcionario.full_name || 'Sem Nome') + '">';
    
    // Avatar mini
    if (funcionario.avatar_url) {
        html += '<img src="' + funcionario.avatar_url + '" style="width: 20px; height: 20px; border-radius: 50%; object-fit: cover; border: 1px solid ' + cor + ';">';
    } else {
        html += '<div style="width: 20px; height: 20px; border-radius: 50%; background: ' + cor + '; display: flex; align-items: center; justify-content: center; font-size: 9px; color: white; font-weight: 600;">' + (funcionario.full_name ? funcionario.full_name.charAt(0).toUpperCase() : 'U') + '</div>';
    }
    
    // Info mini
    html += '<div style="flex: 1; min-width: 0; overflow: hidden;">';
    html += '<div style="font-weight: 600; color: #1e293b; font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 70px;">' + nomeAbreviado + '</div>';
    html += '</div>';
    
    html += '</div>';
    return html;
}

// Função para toggle do menu dropdown da Equipe RA
function toggleMenuEquipeRA() {
    var menu = document.getElementById('menu-equipe-ra');
    if (menu) {
        if (menu.style.display === 'none' || menu.style.display === '') {
            menu.style.display = 'block';
            // Fechar ao clicar fora
            setTimeout(function() {
                document.addEventListener('click', function closeMenu(e) {
                    if (!e.target.closest('#btn-novo-equipe-ra') && !e.target.closest('#menu-equipe-ra')) {
                        menu.style.display = 'none';
                        document.removeEventListener('click', closeMenu);
                    }
                });
            }, 100);
        } else {
            menu.style.display = 'none';
        }
    }
}

// Renderiza uma seção da hierarquia
function renderizarSecaoHierarquia(titulo, funcionarios, cor, tipo) {
    var html = '<div style="margin-bottom: 24px;">';
    html += '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid ' + cor + ';">';
    html += '<div style="width: 12px; height: 12px; background: ' + cor + '; border-radius: 50%;"></div>';
    html += '<h4 style="margin: 0; color: ' + cor + '; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">' + titulo + '</h4>';
    html += '<span style="background: ' + cor + '20; color: ' + cor + '; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600;">' + funcionarios.length + '</span>';
    html += '</div>';

    html += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px;">';

    funcionarios.forEach(function (f) {
        var isFiscalPosturas = (f.role || '').toLowerCase().includes('fiscal') && (f.role || '').toLowerCase().includes('postura');
        var isFiscal = (f.role || '').toLowerCase().includes('fiscal');

        // Determinar ação ao clicar
        var onclickAction = '';
        if (isFiscalPosturas) {
            // Fiscais de posturas mostram relatório de produtividade
            onclickAction = 'onclick="abrirRelatorioFiscal(\'' + f.id + '\', \'' + (f.full_name || 'Sem nome').replace(/'/g, "\\'") + '\')"';
        } else {
            // Outros cargos mostram tarefas
            onclickAction = 'onclick="mostrarTarefasFuncionario(\'' + f.id + '\', \'' + (f.full_name || 'Sem nome').replace(/'/g, "\\'") + '\')"';
        }

        html += '<div ' + onclickAction + ' style="background: white; border-radius: 10px; padding: 14px; border: 1px solid #e2e8f0; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 12px;" onmouseover="this.style.boxShadow=\'0 4px 12px rgba(0,0,0,0.1)\';this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.boxShadow=\'none\';this.style.transform=\'none\'">';

        // Avatar
        if (f.avatar_url) {
            html += '<img src="' + f.avatar_url + '" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 3px solid ' + cor + ';">';
        } else {
            html += '<div style="width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, ' + cor + ', #666); display: flex; align-items: center; justify-content: center; font-size: 18px; color: white; font-weight: 600;">' + (f.full_name ? f.full_name.charAt(0).toUpperCase() : 'U') + '</div>';
        }

        // Info
        html += '<div style="flex: 1; min-width: 0;">';
        html += '<div style="font-weight: 600; color: #1e293b; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + (f.full_name || 'Sem Nome') + '</div>';
        html += '<div style="font-size: 12px; color: #64748b;">' + (f.role || '---') + '</div>';
        if (f.matricula) {
            html += '<div style="font-size: 11px; color: #94a3b8;">Matrícula: ' + f.matricula + '</div>';
        }
        html += '</div>';

        // Ícone de ação
        if (isFiscalPosturas) {
            html += '<div style="color: ' + cor + ';" title="Ver relatório de produtividade">';
            html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>';
            html += '</div>';
        } else {
            html += '<div style="color: ' + cor + ';" title="Ver tarefas">';
            html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
            html += '</div>';
        }

        html += '</div>';
    });

    html += '</div>';
    html += '</div>';

    return html;
}

// Carrega resumo de tarefas para o Secretário
async function carregarResumoTarefasSecretario() {
    var container = document.getElementById('secretario-resumo-tarefas');
    if (!container) return;

    // Garantir que as variáveis globais de hierarquia estejam carregadas para resolver o getTaskPath
    if (typeof carregarModuloTarefas === 'function') {
        try { await carregarModuloTarefas(); } catch(e) { console.error('Erro ao inicializar módulos de tarefas em background:', e); }
    }

    try {
        // Buscar todas as tarefas não concluídas
        var { data: tarefas, error } = await supabaseClient
            .from('tarefas')
            .select('*, tarefa_responsaveis(user_id, user_name), criador:profiles!criado_por(full_name)')
            .neq('status', 'concluida')
            .order('prazo', { ascending: true });

        if (error) throw error;

        if (!tarefas || tarefas.length === 0) {
            container.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:20px;">Nenhuma tarefa pendente.</div>';
            return;
        }

        // Contadores por status
        var pendentes = tarefas.filter(t => t.status === 'pendente').length;
        var emProgresso = tarefas.filter(t => t.status === 'em_progresso').length;
        var atrasadas = tarefas.filter(t => t.prazo && new Date(t.prazo) < new Date()).length;

        var html = '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px;">';
        html += '<div style="text-align: center; padding: 16px; background: #fef3c7; border-radius: 10px;"><div style="font-size: 24px; font-weight: 700; color: #d97706;">' + pendentes + '</div><div style="font-size: 12px; color: #92400e;">Pendentes</div></div>';
        html += '<div style="text-align: center; padding: 16px; background: #dbeafe; border-radius: 10px;"><div style="font-size: 24px; font-weight: 700; color: #2563eb;">' + emProgresso + '</div><div style="font-size: 12px; color: #1e40af;">Em Progresso</div></div>';
        html += '<div style="text-align: center; padding: 16px; background: #fee2e2; border-radius: 10px;"><div style="font-size: 24px; font-weight: 700; color: #dc2626;">' + atrasadas + '</div><div style="font-size: 12px; color: #991b1b;">Atrasadas</div></div>';
        html += '</div>';

        // Últimas 5 tarefas
        html += '<div style="font-weight: 600; color: #1e293b; margin-bottom: 12px; font-size: 14px;">Próximas Tarefas:</div>';
        html += '<div style="display: flex; flex-direction: column; gap: 8px;">';

        var getTaskPath = function(task) {
            var c = task.criado_por;
            if (typeof idsEquipeAmbientalGlobal !== 'undefined' && idsEquipeAmbientalGlobal.includes(c)) return 'Tarefas > Reg. Ambiental';
            if (typeof idsEquipeCAGlobal !== 'undefined' && idsEquipeCAGlobal.includes(c)) return 'Tarefas > Cuidado Animal';
            if (typeof idsFiscaisPosturasGlobal !== 'undefined' && idsFiscaisPosturasGlobal.includes(c)) return 'Tarefas > Gerência de Posturas';
            if (typeof idsGerentesGlobal !== 'undefined' && idsGerentesGlobal.includes(c)) return 'Tarefas > Gerência de Posturas';
            if (typeof idsJuridicoGlobal !== 'undefined' && idsJuridicoGlobal.includes(c)) return 'Tarefas > Interface Jurídica';
            if (typeof idsRHGlobal !== 'undefined' && idsRHGlobal.includes(c)) return 'Tarefas > Recursos Humanos';
            if (typeof idsDiretoresGlobal !== 'undefined' && idsDiretoresGlobal.includes(c)) return 'Tarefas > Direção';
            
            var reps = task.tarefa_responsaveis || [];
            for (var i = 0; i < reps.length; i++) {
                var r = reps[i].user_id;
                if (typeof idsEquipeAmbientalGlobal !== 'undefined' && idsEquipeAmbientalGlobal.includes(r)) return 'Tarefas > Reg. Ambiental';
                if (typeof idsEquipeCAGlobal !== 'undefined' && idsEquipeCAGlobal.includes(r)) return 'Tarefas > Cuidado Animal';
                if (typeof idsFiscaisPosturasGlobal !== 'undefined' && idsFiscaisPosturasGlobal.includes(r)) return 'Tarefas > Gerência de Posturas';
                if (typeof idsGerentesGlobal !== 'undefined' && idsGerentesGlobal.includes(r)) return 'Tarefas > Gerência de Posturas';
                if (typeof idsJuridicoGlobal !== 'undefined' && idsJuridicoGlobal.includes(r)) return 'Tarefas > Interface Jurídica';
                if (typeof idsRHGlobal !== 'undefined' && idsRHGlobal.includes(r)) return 'Tarefas > Recursos Humanos';
            }
            return 'Tarefas > Resumo Geral';
        };

        tarefas.slice(0, 5).forEach(function (t) {
            var statusColor = t.status === 'em_progresso' ? '#3b82f6' : '#f59e0b';
            var statusLabel = t.status === 'em_progresso' ? 'Em Progresso' : 'Pendente';
            var atrasada = t.prazo && new Date(t.prazo) < new Date();

            var criadorNome = (t.criador && t.criador.full_name) ? t.criador.full_name : 'Desconhecido';
            var taskPath = getTaskPath(t);

            html += '<div onclick="if(typeof abrirDetalheTarefa === \'function\') abrirDetalheTarefa(\'' + t.id + '\');" style="padding: 12px; background: #f8fafc; border-radius: 8px; border-left: 3px solid ' + statusColor + '; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background=\'#f1f5f9\'" onmouseout="this.style.background=\'#f8fafc\'">';
            html += '<div>';
            html += '<div style="font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.5px;">📍 ' + taskPath + '</div>';
            html += '<div style="font-weight: 600; color: #1e293b; font-size: 14px; margin-bottom: 4px;">' + (t.titulo || 'Sem título') + '</div>';
            if (t.prazo) {
                html += '<div style="font-size: 11px; color: ' + (atrasada ? '#dc2626' : '#64748b') + ';">Prazo: ' + new Date(t.prazo).toLocaleDateString('pt-BR') + (atrasada ? ' (ATRASADA)' : '') + ' • Criador: <strong style="color:#475569;">' + criadorNome.split(' ')[0] + '</strong></div>';
            } else {
                html += '<div style="font-size: 11px; color: #64748b;">Criador: <strong style="color:#475569;">' + criadorNome.split(' ')[0] + '</strong></div>';
            }
            html += '</div>';
            html += '<span style="padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; background: ' + statusColor + '20; color: ' + statusColor + '; white-space: nowrap;">' + statusLabel + '</span>';
            html += '</div>';
        });

        if (tarefas.length > 5) {
            html += '<div style="text-align: center; padding: 10px; color: #94a3b8; font-size: 13px;">+' + (tarefas.length - 5) + ' tarefas pendentes</div>';
        }

        html += '</div>';

        container.innerHTML = html;

    } catch (err) {
        console.error("Erro ao carregar resumo de tarefas:", err);
        container.innerHTML = '<div style="text-align:center; color:#ef4444; padding:20px;">Erro ao carregar tarefas.</div>';
    }
}

// Carrega grafico de documentos do Controle Processual para o Secretario
async function carregarGraficoDocumentosSecretario() {
    var container = document.getElementById('secretario-grafico-documentos');
    var canvas = document.getElementById('secretario-canvas-docs');
    var elTotal = document.getElementById('secretario-total-docs');
    if (!canvas) return;

    try {
        var hoje = new Date();
        var trintaDiasAtras = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const { data: docs, error } = await supabaseClient
            .from('controle_processual')
            .select('categoria_id')
            .gte('created_at', trintaDiasAtras);

        if (error) throw error;

        var nomesTipo = {
            '1.1': 'Notificação',
            '1.2': 'Auto de Infração',
            '1.3': 'AR',
            '1.4': 'Ofício',
            '1.5': 'Relatório',
            '1.6': 'Protocolo',
            '1.7': 'Réplica'
        };

        var contagem = {};
        var totalDocs = 0;
        if (docs) {
            docs.forEach(function (d) {
                var tipo = d.categoria_id || 'Outros';
                var nome = nomesTipo[tipo] || ('Cat. ' + tipo);
                if (!contagem[nome]) contagem[nome] = 0;
                contagem[nome]++;
                totalDocs++;
            });
        }

        if (elTotal) {
            elTotal.innerHTML = '<span style="color: #64748b; font-size: 13px;">Total: <strong style="color: #1e293b;">' + totalDocs + '</strong> registros</span>';
        }

        var labels = Object.keys(contagem);
        var valores = Object.values(contagem);

        if (labels.length === 0) {
            container.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:40px; font-size:13px;">Nenhum documento nos últimos 30 dias</div>';
            return;
        }

        var cores = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

        if (window.secretarioGraficoDocs) {
            window.secretarioGraficoDocs.destroy();
        }

        window.secretarioGraficoDocs = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: valores,
                    backgroundColor: cores.slice(0, labels.length),
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#1e293b',
                            font: { size: 11 },
                            padding: 10,
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                var label = context.label || '';
                                var value = context.raw || 0;
                                var pct = totalDocs > 0 ? Math.round((value / totalDocs) * 100) : 0;
                                return label + ': ' + value + ' (' + pct + '%)';
                            }
                        }
                    }
                },
                cutout: '60%'
            }
        });

    } catch (err) {
        console.error("Erro ao carregar grafico de documentos:", err);
        container.innerHTML = '<div style="text-align:center; color:#ef4444; padding:20px; font-size:13px;">Erro ao carregar gráfico</div>';
    }
}

// Carrega calendario de projetos para o Secretario (versao compacta)
async function carregarCalendarioProjetosSecretario() {
    var container = document.getElementById('secretario-calendario-projetos');
    if (!container) return;

    try {
        // Buscar projetos/eventos do mes atual
        var hoje = new Date();
        var ano = hoje.getFullYear();
        var mes = hoje.getMonth();
        var primeiroDia = new Date(ano, mes, 1).toISOString();
        var ultimoDia = new Date(ano, mes + 1, 0).toISOString();

        var { data: eventos, error } = await supabaseClient
            .from('eventos')
            .select('*')
            .or('data_inicio.gte.' + primeiroDia + ',data_fim.gte.' + primeiroDia)
            .or('data_inicio.lte.' + ultimoDia + ',data_fim.lte.' + ultimoDia)
            .order('data_inicio', { ascending: true });

        if (error) throw error;

        var nomesMeses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        var nomeMes = nomesMeses[mes];

        var html = '<div style="margin-bottom: 10px; text-align: center;">';
        html += '<span style="font-weight: 600; color: #1e293b; font-size: 14px;">' + nomeMes + ' ' + ano + '</span>';
        html += '</div>';

        // Grid do calendario (7 colunas)
        html += '<div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; margin-bottom: 12px;">';

        // Cabecalho dos dias da semana
        var diasSemana = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
        diasSemana.forEach(function (dia) {
            html += '<div style="text-align: center; font-size: 10px; color: #94a3b8; font-weight: 600; padding: 4px;">' + dia + '</div>';
        });

        // Calcular dias
        var primeiroDiaSemana = new Date(ano, mes, 1).getDay();
        var diasNoMes = new Date(ano, mes + 1, 0).getDate();
        var isMesAtual = true;

        // Espacos vazios antes do dia 1
        for (var i = 0; i < primeiroDiaSemana; i++) {
            html += '<div style="aspect-ratio: 1;"></div>';
        }

        // Dias do mes
        for (var dia = 1; dia <= diasNoMes; dia++) {
            var dataStr = ano + '-' + String(mes + 1).padStart(2, '0') + '-' + String(dia).padStart(2, '0');
            var isHoje = isMesAtual && dia === hoje.getDate();

            // Verificar se tem evento neste dia
            var eventosNoDia = [];
            if (eventos) {
                eventos.forEach(function (ev) {
                    var inicio = ev.data_inicio ? ev.data_inicio.substring(0, 10) : null;
                    var fim = ev.data_fim ? ev.data_fim.substring(0, 10) : inicio;
                    if (dataStr >= inicio && dataStr <= fim) {
                        eventosNoDia.push(ev);
                    }
                });
            }

            var temEvento = eventosNoDia.length > 0;
            var bgColor = isHoje ? '#3b82f6' : (temEvento ? (eventosNoDia[0].cor || '#3b82f6') + '20' : '#f1f5f9');
            var textColor = isHoje ? '#ffffff' : (temEvento ? '#1e293b' : '#64748b');
            var border = isHoje ? '2px solid #2563eb' : (temEvento ? '1px solid ' + (eventosNoDia[0].cor || '#3b82f6') : '1px solid #e2e8f0');
            var cursor = temEvento ? 'pointer' : 'default';

            html += '<div style="aspect-ratio: 1; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; background: ' + bgColor + '; color: ' + textColor + '; border: ' + border + '; cursor: ' + cursor + ';"';

            if (temEvento) {
                html += ' onclick="irParaProjetos()" title="' + eventosNoDia[0].titulo + '"';
            }

            html += '>' + dia + '</div>';
        }

        html += '</div>';

        // Lista dos proximos 3 eventos
        if (eventos && eventos.length > 0) {
            html += '<div style="border-top: 1px solid #e2e8f0; padding-top: 12px;">';
            html += '<div style="font-size: 11px; color: #94a3b8; font-weight: 600; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Próximos eventos</div>';

            eventos.slice(0, 3).forEach(function (ev) {
                var dataInicio = new Date(ev.data_inicio);
                var dataStr = dataInicio.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                var cor = ev.cor || '#3b82f6';

                html += '<div style="display: flex; align-items: center; gap: 8px; padding: 6px 0; cursor: pointer;" onclick="irParaProjetos()">';
                html += '<div style="width: 8px; height: 8px; border-radius: 50%; background: ' + cor + ';"></div>';
                html += '<div style="flex: 1; min-width: 0;">';
                html += '<div style="font-size: 12px; color: #1e293b; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + (ev.titulo || 'Sem título') + '</div>';
                html += '<div style="font-size: 10px; color: #94a3b8;">' + dataStr + '</div>';
                html += '</div>';
                html += '</div>';
            });

            if (eventos.length > 3) {
                html += '<div style="text-align: center; margin-top: 8px;">';
                html += '<span style="font-size: 11px; color: #94a3b8;">+' + (eventos.length - 3) + ' eventos</span>';
                html += '</div>';
            }

            html += '</div>';
        } else {
            html += '<div style="text-align: center; padding: 15px; color: #94a3b8; font-size: 12px;">Nenhum evento este mês</div>';
        }

        container.innerHTML = html;

    } catch (err) {
        console.error("Erro ao carregar calendario de projetos:", err);
        container.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:20px; font-size:13px;">Erro ao carregar calendário</div>';
    }
}

// Navega para a aba de projetos (expandindo o menu de direcao se necessario)
function irParaProjetos() {
    // Abrir o submenu de direcao se estiver fechado
    var submenu = document.getElementById('diretor-submenu-gerencia');
    if (submenu && submenu.style.display === 'none') {
        submenu.style.display = 'block';
    }
    // Mudar para a aba projetos
    mudarAba('projetos');
}

// Carrega tarefas dos Diretores para o Secretário (modo direcao)
async function carregarTarefasDiretoresSecretario() {
    var container = document.getElementById('secretario-minhas-tarefas');
    if (!container) return;

    try {
        // Buscar IDs dos diretores
        var { data: diretores, error: errD } = await supabaseClient
            .from('profiles')
            .select('id')
            .in('role', ['Diretor(a)', 'Diretor(a) de Meio Ambiente', 'diretor', 'Diretor', 'diretor de meio ambiente', 'Diretor de Meio Ambiente']);

        if (errD) throw errD;

        if (!diretores || diretores.length === 0) {
            container.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:20px; font-size:15px;">Nenhum diretor encontrado.</div>';
            return;
        }

        var diretorIds = diretores.map(function (d) { return d.id; });

        // Buscar tarefas criadas pelos diretores ou onde diretor é responsável
        // Primeiro buscar responsabilidades
        var { data: respDiretores, error: errR } = await supabaseClient
            .from('tarefa_responsaveis')
            .select('tarefa_id')
            .in('user_id', diretorIds);

        // Buscar tarefas criadas pelos diretores
        var { data: tarefasCriadas, error: errC } = await supabaseClient
            .from('tarefas')
            .select('*')
            .in('criado_por', diretorIds)
            .neq('status', 'concluida')
            .order('prazo', { ascending: true });

        if (errC) throw errC;

        var tarefas = tarefasCriadas || [];

        // Adicionar tarefas onde diretor é responsável (evitando duplicatas)
        if (respDiretores && respDiretores.length > 0) {
            var tarefaIdsResp = respDiretores.map(function (r) { return r.tarefa_id; });
            var idsExistentes = {};
            tarefas.forEach(function (t) { idsExistentes[t.id] = true; });

            // Filtrar apenas IDs que não estão na lista
            var idsNovos = tarefaIdsResp.filter(function (id) { return !idsExistentes[id]; });

            if (idsNovos.length > 0) {
                var { data: tarefasResp, error: errT } = await supabaseClient
                    .from('tarefas')
                    .select('*')
                    .in('id', idsNovos)
                    .neq('status', 'concluida')
                    .order('prazo', { ascending: true });

                if (errT) throw errT;
                (tarefasResp || []).forEach(function (t) { tarefas.push(t); });
            }
        }

        if (tarefas.length === 0) {
            container.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:20px; font-size:15px;">Nenhuma tarefa dos diretores.</div>';
            return;
        }

        // Ordenar por prazo
        tarefas.sort(function (a, b) {
            if (!a.prazo && !b.prazo) return 0;
            if (!a.prazo) return 1;
            if (!b.prazo) return -1;
            return new Date(a.prazo) - new Date(b.prazo);
        });

        // Renderizar (simplificado)
        renderizarTarefasSecretario(container, tarefas);

    } catch (err) {
        console.error("Erro ao carregar tarefas dos diretores:", err);
        container.innerHTML = '<div style="text-align:center; color:#ef4444; padding:20px; font-size:15px;">Erro ao carregar tarefas.</div>';
    }
}

// Renderiza tarefas na home do Secretário
async function renderizarTarefasSecretario(container, tarefas) {
    try {
        // Buscar nomes dos criadores
        var criadorIds = [];
        tarefas.forEach(function (t) {
            if (t.criado_por && criadorIds.indexOf(t.criado_por) === -1) {
                criadorIds.push(t.criado_por);
            }
        });

        var criadorMap = {};
        if (criadorIds.length > 0) {
            var { data: criadores } = await supabaseClient
                .from('profiles')
                .select('id, full_name')
                .in('id', criadorIds);
            (criadores || []).forEach(function (c) { criadorMap[c.id] = c.full_name; });
        }

        var html = '<div style="max-height: 400px; overflow-y: auto;">';

        tarefas.slice(0, 10).forEach(function (t) {
            var prazo = t.prazo ? new Date(t.prazo).toLocaleDateString('pt-BR') : 'Sem prazo';
            var criador = criadorMap[t.criado_por] || 'Desconhecido';
            var statusColor = t.status === 'em_progresso' ? '#3b82f6' : (t.status === 'pendente' ? '#f59e0b' : '#10b981');
            var statusText = t.status === 'em_progresso' ? 'Em progresso' : (t.status === 'pendente' ? 'Pendente' : 'Concluída');

            html += '<div style="padding: 12px; border-bottom: 1px solid #e2e8f0; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background=\'#f8fafc\'" onmouseout="this.style.background=\'transparent\'" onclick="if(typeof abrirDetalheTarefa===\'function\')abrirDetalheTarefa(' + t.id + ')">';
            html += '<div style="font-weight: 600; color: #1e293b; margin-bottom: 4px;">' + (t.titulo || 'Sem título') + '</div>';
            html += '<div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #64748b;">';
            html += '<span>Criado por: ' + criador + '</span>';
            html += '<span style="display: flex; align-items: center; gap: 8px;">';
            html += '<span style="color: ' + (t.prazo && new Date(t.prazo) < new Date() ? '#ef4444' : '#64748b') + ';">📅 ' + prazo + '</span>';
            html += '<span style="background: ' + statusColor + '; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px;">' + statusText + '</span>';
            html += '</span>';
            html += '</div>';
            html += '</div>';
        });

        if (tarefas.length > 10) {
            html += '<div style="text-align: center; padding: 12px; color: #94a3b8; font-size: 13px;">+' + (tarefas.length - 10) + ' tarefas - veja mais na aba Tarefas</div>';
        }

        html += '</div>';
        container.innerHTML = html;

    } catch (err) {
        console.error("Erro ao renderizar tarefas:", err);
        container.innerHTML = '<div style="text-align:center; color:#ef4444; padding:20px;">Erro ao exibir tarefas.</div>';
    }
}

// Carrega a lista de Diretores
async function carregarDiretoresSecretario() {
    var container = document.getElementById('secretario-diretores-lista');
    if (!container) return;

    try {
        // Buscar todos os diretores
        var { data: diretores, error: errDiretores } = await supabaseClient
            .from('profiles')
            .select('id, full_name, avatar_url, email_real, matricula')
            .in('role', ['Diretor(a)', 'Diretor(a) de Meio Ambiente']);

        if (errDiretores) throw errDiretores;

        // Atualizar contador
        var elTotal = document.getElementById('secretario-total-diretores');
        if (elTotal) elTotal.innerText = diretores ? diretores.length : 0;

        if (!diretores || diretores.length === 0) {
            container.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:40px;">Nenhum diretor cadastrado.</div>';
            return;
        }

        var html = '';
        var cores = ['#7c3aed', '#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#ec4899', '#06b6d4'];

        diretores.forEach(function (diretor, index) {
            var cor = cores[index % cores.length];

            var fotoHtml = '';
            if (diretor.avatar_url) {
                fotoHtml = '<img src="' + diretor.avatar_url + '" style="width:50px;height:50px;border-radius:50%;object-fit:cover;border:3px solid ' + cor + ';">';
            } else {
                fotoHtml = '<div style="width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,' + cor + ',#666);display:flex;align-items:center;justify-content:center;font-size:20px;color:white;border:3px solid ' + cor + ';">' + (diretor.full_name ? diretor.full_name.charAt(0).toUpperCase() : 'D') + '</div>';
            }

            html += '<div style="background:white;border-radius:12px;padding:16px;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);border-left:4px solid ' + cor + ';">';

            html += '<div style="display:flex;align-items:center;gap:12px;">';
            html += fotoHtml;
            html += '<div style="flex:1;">';
            html += '<div style="font-weight:700;font-size:16px;color:#1e293b;">' + (diretor.full_name || 'Sem Nome') + '</div>';
            html += '<div style="font-size:12px;color:#64748b;">Matrícula: ' + (diretor.matricula || '---') + '</div>';
            if (diretor.email_real) {
                html += '<div style="font-size:11px;color:#94a3b8;">' + diretor.email_real + '</div>';
            }
            html += '</div>';

            // Botao de exclusao
            html += '<div style="display:flex;gap:8px;">';
            html += '<button onclick="abrirExcluirDiretorSecretario(\'' + diretor.id + '\', \'' + (diretor.full_name || '').replace(/'/g, "\\'") + '\')" title="Desativar" style="background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;padding:8px 12px;cursor:pointer;font-size:12px;color:#c2410c;font-weight:600;">Desativar</button>';
            html += '</div>';
            html += '</div>';

            html += '</div>';
        });

        // Botao + Novo Diretor no final
        html += '<div style="margin-top:16px;text-align:center;">';
        html += '<button onclick="abrirFormNovoDiretor()" style="background:transparent;border:2px dashed #7c3aed;color:#7c3aed;padding:12px 24px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;width:100%;transition:all 0.2s;" onmouseover="this.style.background=\'#7c3aed\';this.style.color=\'white\'" onmouseout="this.style.background=\'transparent\';this.style.color=\'#7c3aed\'">+ Novo Diretor</button>';
        html += '</div>';

        container.innerHTML = html;

    } catch (err) {
        console.error("Erro ao carregar diretores:", err);
        container.innerHTML = '<div style="text-align:center; color:#ef4444; padding:40px;">Erro ao carregar diretores.</div>';
    }
}

// Abre modal para criar novo Diretor
function abrirFormNovoDiretor() {
    var existente = document.getElementById('modal-novo-diretor');
    if (existente) existente.remove();

    var modal = document.createElement('div');
    modal.id = 'modal-novo-diretor';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;';

    modal.innerHTML = ''
        + '<div style="background:white;border-radius:12px;width:90%;max-width:420px;padding:30px;position:relative;">'
        + '<button onclick="document.getElementById(\'modal-novo-diretor\').remove()" style="position:absolute;top:10px;right:14px;background:none;border:none;font-size:24px;cursor:pointer;color:#64748b;">\u2715</button>'
        + '<h2 style="margin:0 0 20px 0;color:#1e293b;">Cadastrar Novo Diretor</h2>'
        + '<div style="margin-bottom:14px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;">CPF</label>'
        + '<input type="text" id="novo-diretor-cpf" placeholder="000.000.000-00" maxlength="14" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;" oninput="mascaraCpfNovoFiscal(this)">'
        + '</div>'
        + '<div style="margin-bottom:14px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;">Nome Completo</label>'
        + '<input type="text" id="novo-diretor-nome" placeholder="Nome do diretor" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">'
        + '</div>'
        + '<div style="margin-bottom:14px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;">E-mail</label>'
        + '<input type="email" id="novo-diretor-email" placeholder="email@exemplo.com" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">'
        + '</div>'
        + '<div style="margin-bottom:20px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;">Matrícula</label>'
        + '<input type="text" id="novo-diretor-matricula" placeholder="Matrícula" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">'
        + '</div>'
        + '<p style="font-size:12px;color:#94a3b8;margin-bottom:16px;">Cargo: <strong>Diretor(a) de Meio Ambiente</strong> | Senha padrão: <strong>123456</strong></p>'
        + '<div id="msg-novo-diretor" style="margin-bottom:12px;font-size:13px;"></div>'
        + '<button onclick="salvarNovoDiretor()" id="btn-salvar-novo-diretor" style="width:100%;padding:12px;background:#7c3aed;color:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">Cadastrar Diretor</button>'
        + '</div>';

    document.body.appendChild(modal);
}

// Salva o novo Diretor no banco
async function salvarNovoDiretor() {
    var cpfInput = document.getElementById('novo-diretor-cpf').value.trim();
    var nome = document.getElementById('novo-diretor-nome').value.trim();
    var emailReal = document.getElementById('novo-diretor-email').value.trim();
    var matricula = document.getElementById('novo-diretor-matricula').value.trim();
    var msgEl = document.getElementById('msg-novo-diretor');
    var btn = document.getElementById('btn-salvar-novo-diretor');

    var cpfLimpo = cpfInput.replace(/\D/g, '');

    if (!cpfLimpo || cpfLimpo.length < 11) {
        msgEl.textContent = 'CPF inválido.';
        msgEl.style.color = '#ef4444';
        return;
    }
    if (!nome) {
        msgEl.textContent = 'Nome é obrigatório.';
        msgEl.style.color = '#ef4444';
        return;
    }

    btn.textContent = 'Processando...';
    btn.disabled = true;

    try {
        // PADRONIZAÇÃO: Usar @email.com para bater com o login
        var emailFicticio = cpfLimpo + '@email.com';

        // 1. Verificar se o perfil já existe
        var { data: existingProfile, error: searchErr } = await supabaseClient
            .from('profiles')
            .select('id')
            .eq('cpf', cpfLimpo)
            .maybeSingle();

        if (searchErr) throw searchErr;

        var userId;

        if (existingProfile) {
            userId = existingProfile.id;
        } else {
            var { data: authData, error: authError } = await supabaseClient.auth.signUp({
                email: emailFicticio,
                password: '123456'
            });

            if (authError) throw authError;
            userId = authData.user.id;
        }

        // 2. Atualizar perfil
        var { error: profileError } = await supabaseClient
            .from('profiles')
            .upsert({
                id: userId,
                full_name: nome,
                cpf: cpfLimpo,
                matricula: matricula,
                role: 'Diretor(a) de Meio Ambiente',
                email_real: emailReal,
                email: emailFicticio
            }, { onConflict: 'id' });

        if (profileError) throw profileError;

        msgEl.innerHTML = '<span style="color:#10b981;">Diretor processado com sucesso!</span>';

        setTimeout(function () {
            var modal = document.getElementById('modal-novo-diretor');
            if (modal) modal.remove();
            if (typeof carregarDashboardSecretario === 'function') carregarDashboardSecretario();
        }, 1500);

    } catch (err) {
        console.error('Erro ao salvar diretor:', err);
        msgEl.textContent = err.message || 'Erro ao cadastrar diretor.';
        msgEl.style.color = '#ef4444';
        btn.textContent = 'Cadastrar Diretor';
        btn.disabled = false;
    }
}

// Modal de confirmacao para excluir Diretor
function abrirExcluirDiretorSecretario(diretorId, nomeDiretor) {
    var existente = document.getElementById('modal-excluir-diretor');
    if (existente) existente.remove();

    var modal = document.createElement('div');
    modal.id = 'modal-excluir-diretor';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;';

    modal.innerHTML = ''
        + '<div style="background:white;border-radius:12px;width:90%;max-width:420px;padding:30px;position:relative;">'
        + '<button onclick="document.getElementById(\'modal-excluir-diretor\').remove()" style="position:absolute;top:10px;right:14px;background:none;border:none;font-size:24px;cursor:pointer;color:#64748b;">\u2715</button>'
        + '<div style="text-align:center;margin-bottom:20px;">'
        + '<div style="width:50px;height:50px;border-radius:50%;background:#fff7ed;display:inline-flex;align-items:center;justify-content:center;font-size:24px;margin-bottom:10px;">🚫</div>'
        + '<h2 style="margin:0;color:#c2410c;">Desativar Diretor</h2>'
        + '<p style="color:#64748b;margin:8px 0 0 0;">Você está prestes a desativar:</p>'
        + '<p style="font-weight:700;font-size:18px;color:#1e293b;margin:4px 0 0 0;">' + nomeDiretor + '</p>'
        + '</div>'
        + '<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px;margin-bottom:16px;">'
        + '<p style="color:#c2410c;font-size:13px;margin:0;"><strong>ℹ️ Atenção:</strong> O diretor será desativado e não poderá mais acessar o sistema. O histórico será preservado.</p>'
        + '</div>'
        + '<div style="margin-bottom:14px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">'
        + '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;">'
        + '<input type="checkbox" id="chk-transferir-tarefas-diretor" style="width:18px;height:18px;accent-color:#c2410c;" onchange="toggleTransferenciaTarefasDiretor()">'
        + '<span style="font-weight:600;color:#334155;">Transferir tarefas para outro usuário</span>'
        + '</label>'
        + '</div>'
        + '<div id="secao-transferencia-diretor" style="display:none;margin-bottom:14px;padding:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;">'
        + '<p style="color:#166534;font-size:12px;margin:0 0 10px 0;"><strong>ℹ️ Transferência:</strong> As tarefas serão transferidas para o novo responsável.</p>'
        + '<div style="margin-bottom:10px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;font-size:13px;">Nome do novo responsável</label>'
        + '<input type="text" id="transferir-diretor-nome" placeholder="Nome completo" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">'
        + '</div>'
        + '<div style="margin-bottom:10px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;font-size:13px;">Matrícula do novo responsável</label>'
        + '<input type="text" id="transferir-diretor-matricula" placeholder="Número da matrícula" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">'
        + '</div>'
        + '<button onclick="buscarNovoResponsavelDiretor()" style="width:100%;padding:8px;background:#16a34a;color:white;border:none;border-radius:6px;font-size:13px;cursor:pointer;">Buscar Usuário</button>'
        + '<div id="resultado-busca-usuario-diretor" style="margin-top:10px;"></div>'
        + '</div>'
        + '<div style="margin-bottom:16px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;">Digite <strong style="color:#c2410c;">DESATIVAR</strong> para confirmar</label>'
        + '<input type="text" id="excluir-diretor-confirmacao" placeholder="DESATIVAR" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">'
        + '</div>'
        + '<div id="msg-excluir-diretor" style="margin-bottom:12px;font-size:13px;text-align:center;"></div>'
        + '<button onclick="excluirDiretorSecretario(\'' + diretorId + '\', \'' + nomeDiretor.replace(/'/g, "\\'") + '\')" id="btn-confirmar-excluir-diretor" style="width:100%;padding:12px;background:#c2410c;color:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">Confirmar Desativação</button>'
        + '</div>';

    document.body.appendChild(modal);
}

// Toggle para mostrar/ocultar seção de transferência (Diretor)
function toggleTransferenciaTarefasDiretor() {
    var chk = document.getElementById('chk-transferir-tarefas-diretor');
    var secao = document.getElementById('secao-transferencia-diretor');
    if (chk && secao) {
        secao.style.display = chk.checked ? 'block' : 'none';
    }
}

// Variável para armazenar novo responsável do diretor
var novoResponsavelDiretorSelecionado = null;

// Buscar novo responsável para transferência (Diretor)
async function buscarNovoResponsavelDiretor() {
    var nome = document.getElementById('transferir-diretor-nome').value.trim();
    var matricula = document.getElementById('transferir-diretor-matricula').value.trim();
    var resultadoDiv = document.getElementById('resultado-busca-usuario-diretor');

    if (!nome || !matricula) {
        resultadoDiv.innerHTML = '<p style="color:#ef4444;font-size:12px;">Preencha nome e matrícula.</p>';
        return;
    }

    resultadoDiv.innerHTML = '<p style="color:#64748b;font-size:12px;">Buscando...</p>';

    var usuario = await buscarUsuarioPorNomeMatricula(nome, matricula);

    if (usuario) {
        novoResponsavelDiretorSelecionado = usuario;
        resultadoDiv.innerHTML = '<p style="color:#16a34a;font-size:12px;"><strong>✓ Usuário encontrado:</strong> ' + usuario.full_name + ' (' + usuario.role + ')</p>';
    } else {
        novoResponsavelDiretorSelecionado = null;
        resultadoDiv.innerHTML = '<p style="color:#ef4444;font-size:12px;">Usuário não encontrado. Verifique nome e matrícula.</p>';
    }
}

// Exclui o Diretor
// DESATIVAR DIRETOR (Soft Delete)
async function excluirDiretorSecretario(diretorId, nomeDiretor) {
    var confirmacao = document.getElementById('excluir-diretor-confirmacao').value.trim();
    var chkTransferir = document.getElementById('chk-transferir-tarefas-diretor');
    var msgEl = document.getElementById('msg-excluir-diretor');
    var btn = document.getElementById('btn-confirmar-excluir-diretor');

    if (confirmacao !== 'DESATIVAR') {
        msgEl.textContent = 'Digite DESATIVAR para confirmar.';
        msgEl.style.color = '#ef4444';
        return;
    }

    // Validar transferência se checkbox marcado
    if (chkTransferir && chkTransferir.checked) {
        if (!novoResponsavelDiretorSelecionado) {
            msgEl.textContent = 'Busque e selecione um novo responsável para transferir as tarefas.';
            msgEl.style.color = '#ef4444';
            return;
        }
    }

    btn.textContent = 'Desativando...';
    btn.disabled = true;

    try {
        // TRANSFERIR TAREFAS se solicitado
        if (chkTransferir && chkTransferir.checked && novoResponsavelDiretorSelecionado) {
            btn.textContent = 'Transferindo tarefas...';
            var resultadoTransferencia = await transferirTarefasUsuario(
                diretorId,
                novoResponsavelDiretorSelecionado.id,
                novoResponsavelDiretorSelecionado.full_name
            );

            if (resultadoTransferencia.erro) {
                throw new Error('Erro na transferência: ' + resultadoTransferencia.erro);
            }
        }

        // Desativar diretor (Soft Delete)
        var { error } = await supabaseClient
            .from('profiles')
            .update({ role: 'inativo', ativo: false })
            .eq('id', diretorId);

        if (error) throw error;

        var msgSucesso = '<span style="color:#10b981;">Diretor desativado com sucesso!';
        if (chkTransferir && chkTransferir.checked && novoResponsavelDiretorSelecionado) {
            msgSucesso += '<br><small>Tarefas transferidas para ' + novoResponsavelDiretorSelecionado.full_name + '.</small>';
        }
        msgSucesso += '<br><small>Histórico preservado.</small></span>';
        msgEl.innerHTML = msgSucesso;

        // Limpar variável
        novoResponsavelDiretorSelecionado = null;

        setTimeout(function () {
            document.getElementById('modal-excluir-diretor').remove();
            if (typeof carregarDashboardSecretario === 'function') carregarDashboardSecretario();
        }, 2500);

    } catch (err) {
        console.error('Erro ao desativar diretor:', err);
        msgEl.textContent = err.message || 'Erro ao desativar diretor.';
        msgEl.style.color = '#ef4444';
        btn.textContent = 'Confirmar Desativação';
        btn.disabled = false;
    }
}


// ==========================================
// GERENTE DE REGULARIZAÇÃO AMBIENTAL - GESTÃO DE EQUIPE
// ==========================================

// Cargos permitidos para o Gerente de Regularização Ambiental
var CARGOS_EQUIPE_AMBIENTAL = [
    'Engenheiro(a) Agrônomo(a)',
    'Engenheiro(a) Civil',
    'Analista Ambiental',
    'Auxiliar de Serviços II'
];

var CARGOS_EQUIPE_AMBIENTAL_LOWER = [
    'engenheiro(a) agrônomo(a)',
    'engenheiro agronomo',
    'engenheiro(a) civil',
    'engenheiro civil',
    'analista ambiental',
    'auxiliar de serviços ii',
    'auxiliar de servicos ii'
];

// Carrega a lista da equipe do Gerente de Regularização Ambiental
async function carregarEquipeAmbiental() {
    var container = document.getElementById('gerente-ambiental-equipe-lista');
    if (!container) return;

    try {
        // Buscar todos os funcionários dos cargos permitidos
        var { data: funcionarios, error: errFunc } = await supabaseClient
            .from('profiles')
            .select('id, full_name, avatar_url, email_real, matricula, role')
            .in('role', CARGOS_EQUIPE_AMBIENTAL)
            .eq('ativo', true);

        if (errFunc) throw errFunc;

        // Atualizar contadores por cargo
        var contadores = {
            'Engenheiro(a) Agrônomo(a)': 0,
            'Engenheiro(a) Civil': 0,
            'Analista Ambiental': 0,
            'Auxiliar de Serviços II': 0
        };

        (funcionarios || []).forEach(function (f) {
            if (contadores.hasOwnProperty(f.role)) {
                contadores[f.role]++;
            }
        });

        // Atualizar elementos HTML
        var elAgronomos = document.getElementById('gerente-amb-total-agronomos');
        var elCivis = document.getElementById('gerente-amb-total-civis');
        var elAnalistas = document.getElementById('gerente-amb-total-analistas');
        var elAuxiliares = document.getElementById('gerente-amb-total-auxiliares');

        if (elAgronomos) elAgronomos.innerText = contadores['Engenheiro(a) Agrônomo(a)'] || 0;
        if (elCivis) elCivis.innerText = contadores['Engenheiro(a) Civil'] || 0;
        if (elAnalistas) elAnalistas.innerText = contadores['Analista Ambiental'] || 0;
        if (elAuxiliares) elAuxiliares.innerText = contadores['Auxiliar de Serviços II'] || 0;

        if (!funcionarios || funcionarios.length === 0) {
            container.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:40px;">Nenhum funcionário cadastrado na equipe.</div>';
            return;
        }

        var html = '';
        var coresPorCargo = {
            'Engenheiro(a) Agrônomo(a)': '#10b981',   // Verde esmeralda
            'Engenheiro(a) Civil': '#0ea5e9',          // Azul ciano
            'Analista Ambiental': '#84cc16',           // Verde lima
            'Auxiliar de Serviços II': '#8b5cf6'       // Roxo
        };

        funcionarios.forEach(function (func) {
            var cor = coresPorCargo[func.role] || '#64748b';

            var fotoHtml = '';
            if (func.avatar_url) {
                fotoHtml = '<img src="' + func.avatar_url + '" style="width:50px;height:50px;border-radius:50%;object-fit:cover;border:3px solid ' + cor + '">';
            } else {
                var inicial = func.full_name ? func.full_name.charAt(0).toUpperCase() : 'F';
                fotoHtml = '<div style="width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,' + cor + ',#666);display:flex;align-items:center;justify-content:center;font-size:20px;color:white;border:3px solid ' + cor + '">' + inicial + '</div>';
            }

            html += '<div onclick="abrirDashboardFuncionarioAmbiental(\'' + func.id + '\', \'' + (func.full_name || '').replace(/'/g, "\\'") + '\', \'' + (func.role || '').replace(/'/g, "\\'") + '\', \'' + cor + '\')" style="background:white;border-radius:12px;padding:16px;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);border-left:4px solid ' + cor + ';cursor:pointer;transition:transform 0.2s,box-shadow 0.2s;" onmouseover="this.style.transform=\'translateY(-2px)\';this.style.boxShadow=\'0 4px 12px rgba(0,0,0,0.1)\'" onmouseout="this.style.transform=\'none\';this.style.boxShadow=\'0 2px 8px rgba(0,0,0,0.06)\'">';
            html += '<div style="display:flex;align-items:center;gap:12px;">';
            html += fotoHtml;
            html += '<div style="flex:1;">';
            html += '<div style="font-weight:700;font-size:16px;color:#1e293b;">' + (func.full_name || 'Sem Nome') + '</div>';
            html += '<div style="font-size:12px;color:#64748b;">' + (func.role || '---') + '</div>';
            html += '<div style="font-size:12px;color:#94a3b8;">Matrícula: ' + (func.matricula || '---') + '</div>';
            if (func.email_real) {
                html += '<div style="font-size:11px;color:#94a3b8;">' + func.email_real + '</div>';
            }
            html += '</div>';

            // Botao de exclusao (para de propagar o click)
            html += '<div style="display:flex;gap:8px;" onclick="event.stopPropagation();">';
            html += '<button onclick="abrirExcluirFuncionarioAmbiental(\'' + func.id + '\', \'' + (func.full_name || '').replace(/'/g, "\\'") + '\', \'' + (func.role || '').replace(/'/g, "\\'") + '\')" title="Excluir" style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:8px 12px;cursor:pointer;font-size:12px;color:#dc2626;font-weight:600;">Excluir</button>';
            html += '</div>';
            html += '</div>';
            html += '</div>';
        });

        container.innerHTML = html;

    } catch (err) {
        console.error("Erro ao carregar equipe:", err);
        container.innerHTML = '<div style="text-align:center; color:#ef4444; padding:40px;">Erro ao carregar equipe.</div>';
    }
}

// Abre modal para criar novo funcionário da equipe ambiental
function abrirFormNovoFuncionarioAmbiental() {
    var existente = document.getElementById('modal-novo-func-ambiental');
    if (existente) existente.remove();

    var modal = document.createElement('div');
    modal.id = 'modal-novo-func-ambiental';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;';

    var optionsCargos = CARGOS_EQUIPE_AMBIENTAL.map(function (c) {
        return '<option value="' + c + '">' + c + '</option>';
    }).join('');

    modal.innerHTML = ''
        + '<div style="background:white;border-radius:12px;width:90%;max-width:420px;padding:30px;position:relative;">'
        + '<button onclick="document.getElementById(\'modal-novo-func-ambiental\').remove()" style="position:absolute;top:10px;right:14px;background:none;border:none;font-size:24px;cursor:pointer;color:#64748b;">\u2715</button>'
        + '<h2 style="margin:0 0 20px 0;color:#1e293b;">Cadastrar Novo Funcionário</h2>'
        + '<div style="margin-bottom:14px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;">CPF</label>'
        + '<input type="text" id="novo-func-amb-cpf" placeholder="000.000.000-00" maxlength="14" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;" oninput="mascaraCpfNovoFiscal(this)">'
        + '</div>'
        + '<div style="margin-bottom:14px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;">Nome Completo</label>'
        + '<input type="text" id="novo-func-amb-nome" placeholder="Nome do funcionário" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">'
        + '</div>'
        + '<div style="margin-bottom:14px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;">E-mail</label>'
        + '<input type="email" id="novo-func-amb-email" placeholder="email@exemplo.com" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">'
        + '</div>'
        + '<div style="margin-bottom:14px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;">Matrícula</label>'
        + '<input type="text" id="novo-func-amb-matricula" placeholder="Matrícula" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">'
        + '</div>'
        + '<div style="margin-bottom:20px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;">Cargo</label>'
        + '<select id="novo-func-amb-cargo" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;background:white;">'
        + optionsCargos
        + '</select>'
        + '</div>'
        + '<p style="font-size:12px;color:#94a3b8;margin-bottom:16px;">Senha padrão: <strong>123456</strong></p>'
        + '<div id="msg-novo-func-amb" style="margin-bottom:12px;font-size:13px;"></div>'
        + '<button onclick="salvarNovoFuncionarioAmbiental()" id="btn-salvar-novo-func-amb" style="width:100%;padding:12px;background:#1e3a5f;color:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">Cadastrar Funcionário</button>'
        + '</div>';

    document.body.appendChild(modal);
}

// Salva o novo funcionário da equipe ambiental
async function salvarNovoFuncionarioAmbiental() {
    var cpfInput = document.getElementById('novo-func-amb-cpf').value.trim();
    var nome = document.getElementById('novo-func-amb-nome').value.trim();
    var emailReal = document.getElementById('novo-func-amb-email').value.trim();
    var matricula = document.getElementById('novo-func-amb-matricula').value.trim();
    var cargo = document.getElementById('novo-func-amb-cargo').value;
    var msgEl = document.getElementById('msg-novo-func-amb');
    var btn = document.getElementById('btn-salvar-novo-func-amb');

    var cpfLimpo = cpfInput.replace(/\D/g, '');

    if (!cpfLimpo || cpfLimpo.length < 11) {
        msgEl.textContent = 'CPF inválido.';
        msgEl.style.color = '#ef4444';
        return;
    }
    if (!nome) {
        msgEl.textContent = 'Nome é obrigatório.';
        msgEl.style.color = '#ef4444';
        return;
    }
    if (!cargo) {
        msgEl.textContent = 'Cargo é obrigatório.';
        msgEl.style.color = '#ef4444';
        return;
    }

    btn.textContent = 'Processando...';
    btn.disabled = true;

    try {
        var emailFicticio = cpfLimpo + '@email.com';

        // 1. Verificar se o perfil já existe
        var { data: existingProfile, error: searchErr } = await supabaseClient
            .from('profiles')
            .select('id')
            .eq('cpf', cpfLimpo)
            .maybeSingle();

        if (searchErr) throw searchErr;

        var userId;

        if (existingProfile) {
            userId = existingProfile.id;
        } else {
            var { data: authData, error: authError } = await supabaseClient.auth.signUp({
                email: emailFicticio,
                password: '123456'
            });

            if (authError) throw authError;
            userId = authData.user.id;
        }

        // 2. Atualizar perfil (upsert)
        var { error: profileError } = await supabaseClient
            .from('profiles')
            .upsert({
                id: userId,
                full_name: nome,
                cpf: cpfLimpo,
                matricula: matricula,
                role: cargo,
                email_real: emailReal,
                email: emailFicticio,
                ativo: true
            }, { onConflict: 'id' });

        if (profileError) throw profileError;

        msgEl.innerHTML = '<span style="color:#10b981;">Funcionário cadastrado com sucesso!</span>';

        setTimeout(function () {
            var modal = document.getElementById('modal-novo-func-ambiental');
            if (modal) modal.remove();
            if (typeof carregarEquipeAmbiental === 'function') carregarEquipeAmbiental();
        }, 1500);

    } catch (err) {
        console.error('Erro ao salvar funcionário:', err);
        msgEl.textContent = err.message || 'Erro ao cadastrar funcionário.';
        msgEl.style.color = '#ef4444';
        btn.textContent = 'Cadastrar Funcionário';
        btn.disabled = false;
    }
}

// Modal de confirmação para desativar funcionário
function abrirExcluirFuncionarioAmbiental(funcId, nomeFunc, cargoFunc) {
    var existente = document.getElementById('modal-excluir-func-amb');
    if (existente) existente.remove();

    var modal = document.createElement('div');
    modal.id = 'modal-excluir-func-amb';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;';

    modal.innerHTML = ''
        + '<div style="background:white;border-radius:12px;width:90%;max-width:420px;padding:30px;position:relative;">'
        + '<button onclick="document.getElementById(\'modal-excluir-func-amb\').remove()" style="position:absolute;top:10px;right:14px;background:none;border:none;font-size:24px;cursor:pointer;color:#64748b;">\u2715</button>'
        + '<div style="text-align:center;margin-bottom:20px;">'
        + '<div style="width:50px;height:50px;border-radius:50%;background:#eff6ff;display:inline-flex;align-items:center;justify-content:center;font-size:24px;margin-bottom:10px;">🚫</div>'
        + '<h2 style="margin:0;color:#1e40af;">Desativar Funcionário</h2>'
        + '<p style="color:#64748b;margin:8px 0 0 0;">Você está prestes a desativar:</p>'
        + '<p style="font-weight:700;font-size:18px;color:#1e293b;margin:4px 0 0 0;">' + nomeFunc + '</p>'
        + '<p style="font-size:14px;color:#64748b;margin:4px 0 0 0;">' + cargoFunc + '</p>'
        + '</div>'
        + '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px;margin-bottom:16px;">'
        + '<p style="color:#1e40af;font-size:13px;margin:0;"><strong>ℹ️ Atenção:</strong> O funcionário será desativado e não poderá mais acessar o sistema.</p>'
        + '</div>'
        + '<div style="margin-bottom:16px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;">Digite <strong style="color:#dc2626;">DESATIVAR</strong> para confirmar</label>'
        + '<input type="text" id="excluir-func-amb-confirmacao" placeholder="DESATIVAR" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">'
        + '</div>'
        + '<div id="msg-excluir-func-amb" style="margin-bottom:12px;font-size:13px;text-align:center;"></div>'
        + '<button onclick="excluirFuncionarioAmbiental(\'' + funcId + '\', \'' + nomeFunc.replace(/'/g, "\\'") + '\')" id="btn-confirmar-excluir-func-amb" style="width:100%;padding:12px;background:#dc2626;color:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">Confirmar Desativação</button>'
        + '</div>';

    document.body.appendChild(modal);
}

// Desativa funcionário da equipe ambiental
async function excluirFuncionarioAmbiental(funcId, nomeFunc) {
    var confirmacao = document.getElementById('excluir-func-amb-confirmacao').value.trim();
    var msgEl = document.getElementById('msg-excluir-func-amb');
    var btn = document.getElementById('btn-confirmar-excluir-func-amb');

    if (confirmacao !== 'DESATIVAR') {
        msgEl.textContent = 'Digite DESATIVAR para confirmar.';
        msgEl.style.color = '#ef4444';
        return;
    }

    btn.textContent = 'Desativando...';
    btn.disabled = true;

    try {
        // Desativar funcionário (Soft Delete)
        var { error } = await supabaseClient
            .from('profiles')
            .update({ role: 'inativo', ativo: false })
            .eq('id', funcId);

        if (error) throw error;

        msgEl.innerHTML = '<span style="color:#10b981;">Funcionário desativado com sucesso!<br><small>Histórico preservado.</small></span>';

        setTimeout(function () {
            document.getElementById('modal-excluir-func-amb').remove();
            if (typeof carregarEquipeAmbiental === 'function') carregarEquipeAmbiental();
        }, 2500);

    } catch (err) {
        console.error('Erro ao desativar funcionário:', err);
        msgEl.textContent = err.message || 'Erro ao desativar funcionário.';
        msgEl.style.color = '#ef4444';
        btn.textContent = 'Confirmar Desativação';
        btn.disabled = false;
    }
}


// ==========================================
// DASHBOARD DO FUNCIONÁRIO - DESENVENHO
// ==========================================

// Abre dashboard de desempenho do funcionário
async function abrirDashboardFuncionarioAmbiental(funcId, nomeFunc, cargoFunc, cor) {
    // Remover modal existente
    var existente = document.getElementById('modal-dashboard-func-amb');
    if (existente) existente.remove();

    // Criar modal
    var modal = document.createElement('div');
    modal.id = 'modal-dashboard-func-amb';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;';

    // Conteúdo inicial com loading
    modal.innerHTML = ''
        + '<div style="background:white;border-radius:12px;width:90%;max-width:600px;padding:30px;position:relative;max-height:90vh;overflow-y:auto;">'
        + '<button onclick="document.getElementById(\'modal-dashboard-func-amb\').remove()" style="position:absolute;top:10px;right:14px;background:none;border:none;font-size:24px;cursor:pointer;color:#64748b;">\u2715</button>'
        + '<div style="text-align:center;margin-bottom:20px;">'
        + '<div style="width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,' + cor + ',#666);display:inline-flex;align-items:center;justify-content:center;font-size:24px;color:white;margin-bottom:10px;">' + (nomeFunc ? nomeFunc.charAt(0).toUpperCase() : 'F') + '</div>'
        + '<h2 style="margin:0;color:#1e293b;">' + nomeFunc + '</h2>'
        + '<p style="color:#64748b;margin:4px 0 0 0;">' + cargoFunc + '</p>'
        + '</div>'
        + '<div id="dashboard-conteudo" style="text-align:center;padding:40px;">'
        + '<div style="color:#94a3b8;">Carregando estatísticas...</div>'
        + '</div>'
        + '</div>';

    document.body.appendChild(modal);

    // Buscar estatísticas
    try {
        var stats = await buscarEstatisticasFuncionario(funcId);
        renderizarDashboardFuncionario(stats, nomeFunc, cor);
    } catch (err) {
        console.error('Erro ao carregar estatísticas:', err);
        document.getElementById('dashboard-conteudo').innerHTML = '<div style="color:#ef4444;">Erro ao carregar estatísticas.</div>';
    }
}

// Busca estatísticas de tarefas do funcionário
async function buscarEstatisticasFuncionario(funcId) {
    var stats = {
        tarefas: { concluidas: 0, emProgresso: 0, atrasadas: 0, pendentes: 0 },
        subtarefas: { concluidas: 0, emProgresso: 0, atrasadas: 0, pendentes: 0 }
    };

    var hoje = new Date().toISOString().split('T')[0];

    // Buscar tarefas onde o funcionário é responsável
    var { data: tarefasResp } = await supabaseClient
        .from('tarefa_responsaveis')
        .select('tarefa_id')
        .eq('user_id', funcId);

    var tarefaIds = (tarefasResp || []).map(function (r) { return r.tarefa_id; });

    if (tarefaIds.length > 0) {
        // Buscar detalhes das tarefas
        var { data: tarefas } = await supabaseClient
            .from('tarefas')
            .select('id, status, prazo, tarefa_pai_id')
            .in('id', tarefaIds);

        (tarefas || []).forEach(function (t) {
            // Separar tarefas principais de subtarefas
            if (t.tarefa_pai_id) {
                // É subtarefa
                if (t.status === 'concluida') {
                    stats.subtarefas.concluidas++;
                } else if (t.status === 'em_progresso') {
                    stats.subtarefas.emProgresso++;
                } else if (t.prazo && t.prazo < hoje) {
                    stats.subtarefas.atrasadas++;
                } else {
                    stats.subtarefas.pendentes++;
                }
            } else {
                // É tarefa principal
                if (t.status === 'concluida') {
                    stats.tarefas.concluidas++;
                } else if (t.status === 'em_progresso') {
                    stats.tarefas.emProgresso++;
                } else if (t.prazo && t.prazo < hoje) {
                    stats.tarefas.atrasadas++;
                } else {
                    stats.tarefas.pendentes++;
                }
            }
        });
    }

    return stats;
}

// Renderiza o dashboard com gráfico
function renderizarDashboardFuncionario(stats, nomeFunc, cor) {
    var container = document.getElementById('dashboard-conteudo');
    if (!container) return;

    // Cores para o gráfico
    var cores = {
        concluidas: '#10b981',
        emProgresso: '#3b82f6',
        atrasadas: '#ef4444',
        pendentes: '#f59e0b'
    };

    // Calcular totais
    var totalTarefas = stats.tarefas.concluidas + stats.tarefas.emProgresso + stats.tarefas.atrasadas + stats.tarefas.pendentes;
    var totalSubtarefas = stats.subtarefas.concluidas + stats.subtarefas.emProgresso + stats.subtarefas.atrasadas + stats.subtarefas.pendentes;

    // HTML do dashboard
    var html = '';

    // Seção de Tarefas
    html += '<div style="margin-bottom:30px;">';
    html += '<h3 style="margin:0 0 16px 0;color:#1e293b;font-size:18px;">Tarefas</h3>';

    if (totalTarefas === 0) {
        html += '<div style="color:#94a3b8;text-align:center;padding:20px;">Nenhuma tarefa atribuída</div>';
    } else {
        html += '<div style="display:flex;align-items:flex-end;justify-content:center;gap:20px;height:200px;margin-bottom:16px;">';

        // Barra Concluídas
        var alturaConc = totalTarefas > 0 ? (stats.tarefas.concluidas / totalTarefas) * 180 : 0;
        html += '<div style="display:flex;flex-direction:column;align-items:center;">';
        html += '<div style="font-size:14px;font-weight:700;color:' + cores.concluidas + ';margin-bottom:8px;">' + stats.tarefas.concluidas + '</div>';
        html += '<div style="width:60px;background:' + cores.concluidas + ';border-radius:8px 8px 0 0;height:' + alturaConc + 'px;"></div>';
        html += '<div style="font-size:12px;color:#64748b;margin-top:8px;">Concluídas</div>';
        html += '</div>';

        // Barra Em Progresso
        var alturaProg = totalTarefas > 0 ? (stats.tarefas.emProgresso / totalTarefas) * 180 : 0;
        html += '<div style="display:flex;flex-direction:column;align-items:center;">';
        html += '<div style="font-size:14px;font-weight:700;color:' + cores.emProgresso + ';margin-bottom:8px;">' + stats.tarefas.emProgresso + '</div>';
        html += '<div style="width:60px;background:' + cores.emProgresso + ';border-radius:8px 8px 0 0;height:' + alturaProg + 'px;"></div>';
        html += '<div style="font-size:12px;color:#64748b;margin-top:8px;">Em Progresso</div>';
        html += '</div>';

        // Barra Atrasadas
        var alturaAtras = totalTarefas > 0 ? (stats.tarefas.atrasadas / totalTarefas) * 180 : 0;
        html += '<div style="display:flex;flex-direction:column;align-items:center;">';
        html += '<div style="font-size:14px;font-weight:700;color:' + cores.atrasadas + ';margin-bottom:8px;">' + stats.tarefas.atrasadas + '</div>';
        html += '<div style="width:60px;background:' + cores.atrasadas + ';border-radius:8px 8px 0 0;height:' + alturaAtras + 'px;"></div>';
        html += '<div style="font-size:12px;color:#64748b;margin-top:8px;">Atrasadas</div>';
        html += '</div>';

        // Barra Pendentes
        var alturaPend = totalTarefas > 0 ? (stats.tarefas.pendentes / totalTarefas) * 180 : 0;
        html += '<div style="display:flex;flex-direction:column;align-items:center;">';
        html += '<div style="font-size:14px;font-weight:700;color:' + cores.pendentes + ';margin-bottom:8px;">' + stats.tarefas.pendentes + '</div>';
        html += '<div style="width:60px;background:' + cores.pendentes + ';border-radius:8px 8px 0 0;height:' + alturaPend + 'px;"></div>';
        html += '<div style="font-size:12px;color:#64748b;margin-top:8px;">Pendentes</div>';
        html += '</div>';

        html += '</div>';
    }
    html += '</div>';

    // Seção de Subtarefas
    html += '<div style="margin-bottom:30px;">';
    html += '<h3 style="margin:0 0 16px 0;color:#1e293b;font-size:18px;">Subtarefas</h3>';

    if (totalSubtarefas === 0) {
        html += '<div style="color:#94a3b8;text-align:center;padding:20px;">Nenhuma subtarefa atribuída</div>';
    } else {
        html += '<div style="display:flex;align-items:flex-end;justify-content:center;gap:20px;height:200px;margin-bottom:16px;">';

        // Barra Concluídas
        var alturaConcSub = totalSubtarefas > 0 ? (stats.subtarefas.concluidas / totalSubtarefas) * 180 : 0;
        html += '<div style="display:flex;flex-direction:column;align-items:center;">';
        html += '<div style="font-size:14px;font-weight:700;color:' + cores.concluidas + ';margin-bottom:8px;">' + stats.subtarefas.concluidas + '</div>';
        html += '<div style="width:60px;background:' + cores.concluidas + ';border-radius:8px 8px 0 0;height:' + alturaConcSub + 'px;"></div>';
        html += '<div style="font-size:12px;color:#64748b;margin-top:8px;">Concluídas</div>';
        html += '</div>';

        // Barra Em Progresso
        var alturaProgSub = totalSubtarefas > 0 ? (stats.subtarefas.emProgresso / totalSubtarefas) * 180 : 0;
        html += '<div style="display:flex;flex-direction:column;align-items:center;">';
        html += '<div style="font-size:14px;font-weight:700;color:' + cores.emProgresso + ';margin-bottom:8px;">' + stats.subtarefas.emProgresso + '</div>';
        html += '<div style="width:60px;background:' + cores.emProgresso + ';border-radius:8px 8px 0 0;height:' + alturaProgSub + 'px;"></div>';
        html += '<div style="font-size:12px;color:#64748b;margin-top:8px;">Em Progresso</div>';
        html += '</div>';

        // Barra Atrasadas
        var alturaAtrasSub = totalSubtarefas > 0 ? (stats.subtarefas.atrasadas / totalSubtarefas) * 180 : 0;
        html += '<div style="display:flex;flex-direction:column;align-items:center;">';
        html += '<div style="font-size:14px;font-weight:700;color:' + cores.atrasadas + ';margin-bottom:8px;">' + stats.subtarefas.atrasadas + '</div>';
        html += '<div style="width:60px;background:' + cores.atrasadas + ';border-radius:8px 8px 0 0;height:' + alturaAtrasSub + 'px;"></div>';
        html += '<div style="font-size:12px;color:#64748b;margin-top:8px;">Atrasadas</div>';
        html += '</div>';

        // Barra Pendentes
        var alturaPendSub = totalSubtarefas > 0 ? (stats.subtarefas.pendentes / totalSubtarefas) * 180 : 0;
        html += '<div style="display:flex;flex-direction:column;align-items:center;">';
        html += '<div style="font-size:14px;font-weight:700;color:' + cores.pendentes + ';margin-bottom:8px;">' + stats.subtarefas.pendentes + '</div>';
        html += '<div style="width:60px;background:' + cores.pendentes + ';border-radius:8px 8px 0 0;height:' + alturaPendSub + 'px;"></div>';
        html += '<div style="font-size:12px;color:#64748b;margin-top:8px;">Pendentes</div>';
        html += '</div>';

        html += '</div>';
    }
    html += '</div>';

    // Resumo
    html += '<div style="background:#f8fafc;border-radius:12px;padding:20px;margin-top:20px;">';
    html += '<h4 style="margin:0 0 12px 0;color:#1e293b;font-size:16px;">Resumo</h4>';
    html += '<div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:16px;">';
    html += '<div style="text-align:center;">';
    html += '<div style="font-size:24px;font-weight:700;color:' + cor + ';">' + (stats.tarefas.concluidas + stats.subtarefas.concluidas) + '</div>';
    html += '<div style="font-size:13px;color:#64748b;">Total Concluídas</div>';
    html += '</div>';
    html += '<div style="text-align:center;">';
    html += '<div style="font-size:24px;font-weight:700;color:#64748b;">' + (totalTarefas + totalSubtarefas) + '</div>';
    html += '<div style="font-size:13px;color:#64748b;">Total Atribuídas</div>';
    html += '</div>';
    html += '</div>';
    html += '</div>';

    container.innerHTML = html;
}


// ============================================
// ESTATÍSTICAS DO FUNCIONÁRIO (DIRETOR)
// ============================================

async function abrirEstatisticasFuncionario(userId, nome, cargo) {
    // Criar modal
    var modalId = 'modal-estatisticas-funcionario';
    var existente = document.getElementById(modalId);
    if (existente) existente.remove();

    var modal = document.createElement('div');
    modal.id = modalId;
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;';

    modal.innerHTML = ''
        + '<div style="background:white;border-radius:16px;width:95%;max-width:800px;max-height:90vh;overflow-y:auto;position:relative;">'
        + '<button onclick="document.getElementById(\'' + modalId + '\').remove()" style="position:absolute;top:16px;right:16px;background:none;border:none;font-size:24px;cursor:pointer;color:#64748b;z-index:10;">✕</button>'
        + '<div style="padding:30px;">'
        + '<div style="text-align:center;margin-bottom:24px;">'
        + '<h2 style="margin:0 0 8px 0;color:#1e293b;font-size:22px;">' + nome + '</h2>'
        + '<span style="background:#e0e7ff;color:#4f46e5;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600;">' + cargo + '</span>'
        + '</div>'
        + '<div id="estatisticas-conteudo">'
        + '<div style="text-align:center;padding:40px;color:#64748b;"><i class="fas fa-spinner fa-spin"></i> Carregando estatísticas...</div>'
        + '</div>'
        + '</div>'
        + '</div>';

    document.body.appendChild(modal);

    try {
        await carregarEstatisticasFuncionario(userId, nome, cargo);
    } catch (err) {
        console.error("Erro ao carregar estatísticas:", err);
        document.getElementById('estatisticas-conteudo').innerHTML = '<div style="text-align:center;padding:40px;color:#ef4444;">Erro ao carregar estatísticas. Tente novamente.</div>';
    }
}

async function carregarEstatisticasFuncionario(userId, nome, cargo) {
    var container = document.getElementById('estatisticas-conteudo');
    if (!container) return;

    // Buscar IDs das tarefas onde o usuário é responsável
    var { data: responsaveis, error: errResp } = await supabaseClient
        .from('tarefa_responsaveis')
        .select('tarefa_id')
        .eq('user_id', userId);

    if (errResp) throw errResp;

    var tarefaIds = responsaveis ? responsaveis.map(function (r) { return r.tarefa_id; }) : [];

    // Buscar tarefas principais (não subtarefas)
    var tarefasPrincipais = [];
    if (tarefaIds.length > 0) {
        var { data: tarefas, error: errTarefas } = await supabaseClient
            .from('tarefas')
            .select('*')
            .in('id', tarefaIds)
            .is('tarefa_pai_id', null);

        if (errTarefas) throw errTarefas;
        tarefasPrincipais = tarefas || [];
    }

    // Buscar tarefas criadas pelo usuário (que ele criou para outros)
    var { data: tarefasCriadas, error: errCriadas } = await supabaseClient
        .from('tarefas')
        .select('*')
        .eq('criado_por', userId)
        .is('tarefa_pai_id', null);

    if (errCriadas) throw errCriadas;

    // Combinar tarefas (evitando duplicatas)
    var tarefasMap = {};
    (tarefasPrincipais || []).forEach(function (t) { tarefasMap[t.id] = t; });
    (tarefasCriadas || []).forEach(function (t) { if (!tarefasMap[t.id]) tarefasMap[t.id] = t; });
    var todasTarefas = Object.values(tarefasMap);

    // Buscar subtarefas das tarefas principais
    var paiIds = todasTarefas.map(function (t) { return t.id; });
    var subtarefas = [];
    if (paiIds.length > 0) {
        var { data: subs, error: errSubs } = await supabaseClient
            .from('tarefas')
            .select('*')
            .in('tarefa_pai_id', paiIds);

        if (errSubs) throw errSubs;
        subtarefas = subs || [];
    }

    // Buscar subtarefas onde o usuário é responsável diretamente
    var subtarefaIds = tarefaIds.filter(function (id) {
        return !todasTarefas.some(function (t) { return t.id === id; });
    });
    if (subtarefaIds.length > 0) {
        var { data: subsResp, error: errSubsResp } = await supabaseClient
            .from('tarefas')
            .select('*')
            .in('id', subtarefaIds);

        if (errSubsResp) throw errSubsResp;
        (subsResp || []).forEach(function (s) {
            if (!subtarefas.some(function (sub) { return sub.id === s.id; })) {
                subtarefas.push(s);
            }
        });
    }

    // Buscar projetos/eventos onde o usuário é responsável
    var { data: eventos, error: errEventos } = await supabaseClient
        .from('eventos')
        .select('*')
        .eq('responsavel_id', userId);

    if (errEventos) throw errEventos;

    // Calcular estatísticas
    var hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    var stats = {
        tarefas: { atrasadas: 0, concluidas: 0, emProgresso: 0, pendentes: 0 },
        subtarefas: { atrasadas: 0, concluidas: 0, emProgresso: 0, pendentes: 0 },
        projetos: eventos ? eventos.length : 0
    };

    todasTarefas.forEach(function (t) {
        var prazo = t.prazo ? new Date(t.prazo) : null;
        var atrasada = prazo && prazo < hoje && t.status !== 'concluida';

        if (t.status === 'concluida') {
            stats.tarefas.concluidas++;
        } else if (t.status === 'em_progresso') {
            if (atrasada) {
                stats.tarefas.atrasadas++;
            } else {
                stats.tarefas.emProgresso++;
            }
        } else {
            if (atrasada) {
                stats.tarefas.atrasadas++;
            } else {
                stats.tarefas.pendentes++;
            }
        }
    });

    subtarefas.forEach(function (s) {
        var prazo = s.prazo ? new Date(s.prazo) : null;
        var atrasada = prazo && prazo < hoje && s.status !== 'concluida';

        if (s.status === 'concluida') {
            stats.subtarefas.concluidas++;
        } else if (s.status === 'em_progresso') {
            if (atrasada) {
                stats.subtarefas.atrasadas++;
            } else {
                stats.subtarefas.emProgresso++;
            }
        } else {
            if (atrasada) {
                stats.subtarefas.atrasadas++;
            } else {
                stats.subtarefas.pendentes++;
            }
        }
    });

    // Gerar HTML
    var html = '';

    // Cards de resumo
    html += '<div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:16px;margin-bottom:30px;">';

    html += '<div style="background:linear-gradient(135deg,#ef4444,#dc2626);border-radius:12px;padding:20px;text-align:center;color:white;">';
    html += '<div style="font-size:32px;font-weight:700;">' + (stats.tarefas.atrasadas + stats.subtarefas.atrasadas) + '</div>';
    html += '<div style="font-size:13px;opacity:0.9;">Atrasadas</div>';
    html += '</div>';

    html += '<div style="background:linear-gradient(135deg,#10b981,#059669);border-radius:12px;padding:20px;text-align:center;color:white;">';
    html += '<div style="font-size:32px;font-weight:700;">' + (stats.tarefas.concluidas + stats.subtarefas.concluidas) + '</div>';
    html += '<div style="font-size:13px;opacity:0.9;">Concluídas</div>';
    html += '</div>';

    html += '<div style="background:linear-gradient(135deg,#3b82f6,#2563eb);border-radius:12px;padding:20px;text-align:center;color:white;">';
    html += '<div style="font-size:32px;font-weight:700;">' + (stats.tarefas.emProgresso + stats.subtarefas.emProgresso) + '</div>';
    html += '<div style="font-size:13px;opacity:0.9;">Em Progresso</div>';
    html += '</div>';

    html += '<div style="background:linear-gradient(135deg,#8b5cf6,#7c3aed);border-radius:12px;padding:20px;text-align:center;color:white;">';
    html += '<div style="font-size:32px;font-weight:700;">' + stats.projetos + '</div>';
    html += '<div style="font-size:13px;opacity:0.9;">Eventos</div>';
    html += '</div>';

    html += '</div>';

    // Gráfico de barras
    html += '<div style="background:#f8fafc;border-radius:12px;padding:24px;margin-bottom:24px;">';
    html += '<h3 style="margin:0 0 20px 0;color:#1e293b;font-size:16px;text-align:center;">Distribuição por Status</h3>';
    html += '<div style="height:300px;position:relative;">';
    html += '<canvas id="grafico-estatisticas-funcionario"></canvas>';
    html += '</div>';
    html += '</div>';

    // Tabela detalhada
    html += '<div style="background:#f8fafc;border-radius:12px;padding:20px;">';
    html += '<h3 style="margin:0 0 16px 0;color:#1e293b;font-size:16px;">Detalhamento</h3>';
    html += '<table style="width:100%;border-collapse:collapse;font-size:14px;">';
    html += '<thead><tr style="border-bottom:2px solid #e2e8f0;">';
    html += '<th style="text-align:left;padding:10px;color:#64748b;font-weight:600;">Tipo</th>';
    html += '<th style="text-align:center;padding:10px;color:#64748b;font-weight:600;">Atrasadas</th>';
    html += '<th style="text-align:center;padding:10px;color:#64748b;font-weight:600;">Concluídas</th>';
    html += '<th style="text-align:center;padding:10px;color:#64748b;font-weight:600;">Em Progresso</th>';
    html += '<th style="text-align:center;padding:10px;color:#64748b;font-weight:600;">Pendentes</th>';
    html += '<th style="text-align:center;padding:10px;color:#64748b;font-weight:600;">Total</th>';
    html += '</tr></thead>';
    html += '<tbody>';

    html += '<tr style="border-bottom:1px solid #e2e8f0;">';
    html += '<td style="padding:12px 10px;font-weight:600;color:#1e293b;">Tarefas</td>';
    html += '<td style="text-align:center;padding:12px 10px;color:#ef4444;font-weight:600;">' + stats.tarefas.atrasadas + '</td>';
    html += '<td style="text-align:center;padding:12px 10px;color:#10b981;font-weight:600;">' + stats.tarefas.concluidas + '</td>';
    html += '<td style="text-align:center;padding:12px 10px;color:#3b82f6;font-weight:600;">' + stats.tarefas.emProgresso + '</td>';
    html += '<td style="text-align:center;padding:12px 10px;color:#f59e0b;font-weight:600;">' + stats.tarefas.pendentes + '</td>';
    html += '<td style="text-align:center;padding:12px 10px;color:#1e293b;font-weight:700;">' + (stats.tarefas.atrasadas + stats.tarefas.concluidas + stats.tarefas.emProgresso + stats.tarefas.pendentes) + '</td>';
    html += '</tr>';

    html += '<tr>';
    html += '<td style="padding:12px 10px;font-weight:600;color:#1e293b;">Subtarefas</td>';
    html += '<td style="text-align:center;padding:12px 10px;color:#ef4444;font-weight:600;">' + stats.subtarefas.atrasadas + '</td>';
    html += '<td style="text-align:center;padding:12px 10px;color:#10b981;font-weight:600;">' + stats.subtarefas.concluidas + '</td>';
    html += '<td style="text-align:center;padding:12px 10px;color:#3b82f6;font-weight:600;">' + stats.subtarefas.emProgresso + '</td>';
    html += '<td style="text-align:center;padding:12px 10px;color:#f59e0b;font-weight:600;">' + stats.subtarefas.pendentes + '</td>';
    html += '<td style="text-align:center;padding:12px 10px;color:#1e293b;font-weight:700;">' + (stats.subtarefas.atrasadas + stats.subtarefas.concluidas + stats.subtarefas.emProgresso + stats.subtarefas.pendentes) + '</td>';
    html += '</tr>';

    html += '</tbody></table>';
    html += '</div>';

    container.innerHTML = html;

    // Criar gráfico
    setTimeout(function () {
        var ctx = document.getElementById('grafico-estatisticas-funcionario');
        if (!ctx) return;

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Atrasadas', 'Concluídas', 'Em Progresso', 'Pendentes'],
                datasets: [
                    {
                        label: 'Tarefas',
                        data: [stats.tarefas.atrasadas, stats.tarefas.concluidas, stats.tarefas.emProgresso, stats.tarefas.pendentes],
                        backgroundColor: ['#ef4444', '#10b981', '#3b82f6', '#f59e0b'],
                        borderRadius: 6,
                        barPercentage: 0.7
                    },
                    {
                        label: 'Subtarefas',
                        data: [stats.subtarefas.atrasadas, stats.subtarefas.concluidas, stats.subtarefas.emProgresso, stats.subtarefas.pendentes],
                        backgroundColor: ['#f87171', '#34d399', '#60a5fa', '#fbbf24'],
                        borderRadius: 6,
                        barPercentage: 0.7
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            font: { size: 12 }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        padding: 12,
                        cornerRadius: 8,
                        titleFont: { size: 14 },
                        bodyFont: { size: 13 }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            font: { size: 11 }
                        },
                        grid: {
                            color: 'rgba(0,0,0,0.05)'
                        }
                    },
                    x: {
                        ticks: {
                            font: { size: 12 }
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }, 100);
}

// ==========================================
// FORMULÁRIOS DE NOVO FUNCIONÁRIO POR CARGO
// ==========================================

// Abre formulário para novo funcionário com cargo específico
function abrirFormNovoFuncionarioPorCargo(cargo) {
    var existente = document.getElementById('modal-novo-funcionario-cargo');
    if (existente) existente.remove();

    var cor = '#7c3aed';
    if (cargo.includes('Posturas')) cor = '#0c3e2b';
    else if (cargo.includes('Ambiental')) cor = '#1e3a5f';
    else if (cargo.includes('Fiscal')) cor = '#b45309';

    var modal = document.createElement('div');
    modal.id = 'modal-novo-funcionario-cargo';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;';

    modal.innerHTML = ''
        + '<div style="background:white;border-radius:16px;width:90%;max-width:420px;padding:30px;position:relative;box-shadow:0 20px 60px rgba(0,0,0,0.3);">'
        + '<button onclick="document.getElementById(\'modal-novo-funcionario-cargo\').remove()" style="position:absolute;top:12px;right:16px;background:none;border:none;font-size:24px;cursor:pointer;color:#64748b;">&times;</button>'
        + '<h2 style="margin:0 0 8px 0;color:' + cor + ';font-size:20px;">Novo ' + cargo + '</h2>'
        + '<p style="color:#64748b;font-size:13px;margin:0 0 20px 0;">Preencha os dados do novo funcionário</p>'
        + '<div style="margin-bottom:14px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;font-size:13px;">CPF</label>'
        + '<input type="text" id="novo-func-cpf" placeholder="000.000.000-00" maxlength="14" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;" oninput="mascaraCpfNovoFiscal(this)">'
        + '</div>'
        + '<div style="margin-bottom:14px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;font-size:13px;">Nome Completo</label>'
        + '<input type="text" id="novo-func-nome" placeholder="Nome completo" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">'
        + '</div>'
        + '<div style="margin-bottom:14px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;font-size:13px;">E-mail</label>'
        + '<input type="email" id="novo-func-email" placeholder="email@exemplo.com" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">'
        + '</div>'
        + '<div style="margin-bottom:20px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;font-size:13px;">Matrícula</label>'
        + '<input type="text" id="novo-func-matricula" placeholder="Número da matrícula" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">'
        + '</div>'
        + '<p style="font-size:12px;color:#94a3b8;margin-bottom:16px;">Cargo: <strong style="color:' + cor + ';">' + cargo + '</strong> | Senha padrão: <strong>123456</strong></p>'
        + '<div id="msg-novo-func-cargo" style="margin-bottom:12px;font-size:13px;"></div>'
        + '<button onclick="salvarNovoFuncionarioPorCargo(\'' + cargo.replace(/'/g, "\\'") + '\')" id="btn-salvar-novo-func-cargo" style="width:100%;padding:12px;background:' + cor + ';color:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;transition:opacity 0.2s;" onmouseover="this.style.opacity=\'0.9\'" onmouseout="this.style.opacity=\'1\'">Cadastrar Funcionário</button>'
        + '</div>';

    document.body.appendChild(modal);
}

// Salva novo funcionário com cargo específico
async function salvarNovoFuncionarioPorCargo(cargo) {
    var cpfInput = document.getElementById('novo-func-cpf').value.trim();
    var nome = document.getElementById('novo-func-nome').value.trim();
    var emailReal = document.getElementById('novo-func-email').value.trim();
    var matricula = document.getElementById('novo-func-matricula').value.trim();
    var msgEl = document.getElementById('msg-novo-func-cargo');
    var btn = document.getElementById('btn-salvar-novo-func-cargo');

    var cpfLimpo = cpfInput.replace(/\D/g, '');

    if (!cpfLimpo || cpfLimpo.length < 11) {
        msgEl.textContent = 'CPF inválido.';
        msgEl.style.color = '#ef4444';
        return;
    }
    if (!nome) {
        msgEl.textContent = 'Nome é obrigatório.';
        msgEl.style.color = '#ef4444';
        return;
    }

    btn.textContent = 'Processando...';
    btn.disabled = true;

    try {
        var emailFicticio = cpfLimpo + '@email.com';

        var { data: existingProfile, error: searchErr } = await supabaseClient
            .from('profiles')
            .select('id')
            .eq('cpf', cpfLimpo)
            .maybeSingle();

        if (searchErr) throw searchErr;

        var userId;

        if (existingProfile) {
            userId = existingProfile.id;
        } else {
            var { data: authData, error: authError } = await supabaseClient.auth.signUp({
                email: emailFicticio,
                password: '123456'
            });

            if (authError) throw authError;
            userId = authData.user.id;
        }

        var { error: profileError } = await supabaseClient
            .from('profiles')
            .upsert({
                id: userId,
                full_name: nome,
                cpf: cpfLimpo,
                matricula: matricula,
                role: cargo,
                email_real: emailReal,
                email: emailFicticio
            }, { onConflict: 'id' });

        if (profileError) throw profileError;

        msgEl.innerHTML = '<span style="color:#10b981;">Funcionário cadastrado com sucesso!</span>';

        setTimeout(function () {
            var modal = document.getElementById('modal-novo-funcionario-cargo');
            if (modal) modal.remove();
            if (typeof carregarHierarquiaCompletaSecretario === 'function') carregarHierarquiaCompletaSecretario();
        }, 1500);

    } catch (err) {
        console.error('Erro ao salvar funcionário:', err);
        msgEl.textContent = err.message || 'Erro ao cadastrar funcionário.';
        msgEl.style.color = '#ef4444';
        btn.textContent = 'Cadastrar Funcionário';
        btn.disabled = false;
    }
}

// Abre formulário para novo membro da equipe ambiental (com seleção de cargo)
function abrirFormNovoFuncionarioEquipeAmbiental() {
    var existente = document.getElementById('modal-novo-funcionario-equipe');
    if (existente) existente.remove();

    var cor = '#065f46';

    var modal = document.createElement('div');
    modal.id = 'modal-novo-funcionario-equipe';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;';

    modal.innerHTML = ''
        + '<div style="background:white;border-radius:16px;width:90%;max-width:420px;padding:30px;position:relative;box-shadow:0 20px 60px rgba(0,0,0,0.3);">'
        + '<button onclick="document.getElementById(\'modal-novo-funcionario-equipe\').remove()" style="position:absolute;top:12px;right:16px;background:none;border:none;font-size:24px;cursor:pointer;color:#64748b;">&times;</button>'
        + '<h2 style="margin:0 0 8px 0;color:' + cor + ';font-size:20px;">Novo Membro da Equipe</h2>'
        + '<p style="color:#64748b;font-size:13px;margin:0 0 20px 0;">Selecione o cargo e preencha os dados</p>'
        + '<div style="margin-bottom:14px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;font-size:13px;">Cargo</label>'
        + '<select id="novo-equipe-cargo" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;background:white;">'
        + '<option value="Engenheiro(a) Agrônomo(a)">Engenheiro(a) Agrônomo(a)</option>'
        + '<option value="Engenheiro(a) Civil">Engenheiro(a) Civil</option>'
        + '<option value="Analista Ambiental">Analista Ambiental</option>'
        + '<option value="Auxiliar de Serviços II">Auxiliar de Serviços II</option>'
        + '</select>'
        + '</div>'
        + '<div style="margin-bottom:14px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;font-size:13px;">CPF</label>'
        + '<input type="text" id="novo-equipe-cpf" placeholder="000.000.000-00" maxlength="14" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;" oninput="mascaraCpfNovoFiscal(this)">'
        + '</div>'
        + '<div style="margin-bottom:14px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;font-size:13px;">Nome Completo</label>'
        + '<input type="text" id="novo-equipe-nome" placeholder="Nome completo" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">'
        + '</div>'
        + '<div style="margin-bottom:14px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;font-size:13px;">E-mail</label>'
        + '<input type="email" id="novo-equipe-email" placeholder="email@exemplo.com" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">'
        + '</div>'
        + '<div style="margin-bottom:20px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;font-size:13px;">Matrícula</label>'
        + '<input type="text" id="novo-equipe-matricula" placeholder="Número da matrícula" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">'
        + '</div>'
        + '<p style="font-size:12px;color:#94a3b8;margin-bottom:16px;">Senha padrão: <strong>123456</strong></p>'
        + '<div id="msg-novo-equipe" style="margin-bottom:12px;font-size:13px;"></div>'
        + '<button onclick="salvarNovoFuncionarioEquipe()" id="btn-salvar-novo-equipe" style="width:100%;padding:12px;background:' + cor + ';color:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;transition:opacity 0.2s;" onmouseover="this.style.opacity=\'0.9\'" onmouseout="this.style.opacity=\'1\'">Cadastrar Membro</button>'
        + '</div>';

    document.body.appendChild(modal);
}

// Salva novo membro da equipe ambiental
async function salvarNovoFuncionarioEquipe() {
    var cargo = document.getElementById('novo-equipe-cargo').value;
    var cpfInput = document.getElementById('novo-equipe-cpf').value.trim();
    var nome = document.getElementById('novo-equipe-nome').value.trim();
    var emailReal = document.getElementById('novo-equipe-email').value.trim();
    var matricula = document.getElementById('novo-equipe-matricula').value.trim();
    var msgEl = document.getElementById('msg-novo-equipe');
    var btn = document.getElementById('btn-salvar-novo-equipe');

    var cpfLimpo = cpfInput.replace(/\D/g, '');

    if (!cpfLimpo || cpfLimpo.length < 11) {
        msgEl.textContent = 'CPF inválido.';
        msgEl.style.color = '#ef4444';
        return;
    }
    if (!nome) {
        msgEl.textContent = 'Nome é obrigatório.';
        msgEl.style.color = '#ef4444';
        return;
    }

    btn.textContent = 'Processando...';
    btn.disabled = true;

    try {
        var emailFicticio = cpfLimpo + '@email.com';

        var { data: existingProfile, error: searchErr } = await supabaseClient
            .from('profiles')
            .select('id')
            .eq('cpf', cpfLimpo)
            .maybeSingle();

        if (searchErr) throw searchErr;

        var userId;

        if (existingProfile) {
            userId = existingProfile.id;
        } else {
            var { data: authData, error: authError } = await supabaseClient.auth.signUp({
                email: emailFicticio,
                password: '123456'
            });

            if (authError) throw authError;
            userId = authData.user.id;
        }

        var { error: profileError } = await supabaseClient
            .from('profiles')
            .upsert({
                id: userId,
                full_name: nome,
                cpf: cpfLimpo,
                matricula: matricula,
                role: cargo,
                email_real: emailReal,
                email: emailFicticio
            }, { onConflict: 'id' });

        if (profileError) throw profileError;

        msgEl.innerHTML = '<span style="color:#10b981;">Membro cadastrado com sucesso!</span>';

        setTimeout(function () {
            var modal = document.getElementById('modal-novo-funcionario-equipe');
            if (modal) modal.remove();
            if (typeof carregarHierarquiaCompletaSecretario === 'function') carregarHierarquiaCompletaSecretario();
        }, 1500);

    } catch (err) {
        console.error('Erro ao salvar membro:', err);
        msgEl.textContent = err.message || 'Erro ao cadastrar membro.';
        msgEl.style.color = '#ef4444';
        btn.textContent = 'Cadastrar Membro';
        btn.disabled = false;
    }
}

// Confirma desativação de funcionário na árvore (com opção de transferir tarefas)
function confirmarDesativarFuncionarioArvore(funcionarioId, nomeFuncionario, cargoFuncionario) {
    var existente = document.getElementById('modal-desativar-funcionario-arvore');
    if (existente) existente.remove();

    var modal = document.createElement('div');
    modal.id = 'modal-desativar-funcionario-arvore';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;';

    modal.innerHTML = ''
        + '<div style="background:white;border-radius:16px;width:90%;max-width:420px;padding:30px;position:relative;box-shadow:0 20px 60px rgba(0,0,0,0.3);text-align:center;">'
        + '<button onclick="document.getElementById(\'modal-desativar-funcionario-arvore\').remove()" style="position:absolute;top:12px;right:16px;background:none;border:none;font-size:24px;cursor:pointer;color:#64748b;">&times;</button>'
        + '<div style="width:60px;height:60px;background:#fee2e2;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px auto;">'
        + '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>'
        + '</div>'
        + '<h2 style="margin:0 0 8px 0;color:#1e293b;font-size:20px;">Desativar Funcionário</h2>'
        + '<p style="color:#64748b;font-size:14px;margin:0 0 20px 0;">Você está prestes a desativar:</p>'
        + '<div style="background:#f8fafc;border-radius:12px;padding:16px;margin-bottom:20px;">'
        + '<div style="font-weight:700;color:#1e293b;font-size:16px;margin-bottom:4px;">' + nomeFuncionario + '</div>'
        + '<div style="color:#64748b;font-size:13px;">' + cargoFuncionario + '</div>'
        + '</div>'
        + '<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px;margin-bottom:16px;">'
        + '<p style="color:#c2410c;font-size:13px;margin:0;"><strong>Atenção:</strong> O funcionário será desativado e não poderá mais acessar o sistema. O histórico será preservado.</p>'
        + '</div>'
        + '<div style="margin-bottom:14px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;text-align:left;">'
        + '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;">'
        + '<input type="checkbox" id="chk-transferir-tarefas-arvore" style="width:18px;height:18px;accent-color:#16a34a;" onchange="toggleTransferenciaTarefasArvore()">'
        + '<span style="font-weight:600;color:#334155;">Transferir tarefas para outro usuário</span>'
        + '</label>'
        + '</div>'
        + '<div id="secao-transferencia-arvore" style="display:none;margin-bottom:16px;padding:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;text-align:left;">'
        + '<p style="color:#166534;font-size:12px;margin:0 0 10px 0;"><strong>Info:</strong> As tarefas e responsabilidades serão transferidas para o novo usuário.</p>'
        + '<div style="margin-bottom:10px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;font-size:13px;">Nome do novo responsável</label>'
        + '<input type="text" id="transferir-arvore-nome" placeholder="Nome completo" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">'
        + '</div>'
        + '<div style="margin-bottom:10px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;font-size:13px;">Matrícula do novo responsável</label>'
        + '<input type="text" id="transferir-arvore-matricula" placeholder="Número da matrícula" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">'
        + '</div>'
        + '<button onclick="buscarNovoResponsavelArvore()" style="width:100%;padding:8px;background:#16a34a;color:white;border:none;border-radius:6px;font-size:13px;cursor:pointer;font-weight:600;">Buscar Usuário</button>'
        + '<div id="resultado-busca-arvore" style="margin-top:10px;"></div>'
        + '</div>'
        + '<div style="margin-bottom:16px;text-align:left;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;">Digite <strong style="color:#dc2626;">DESATIVAR</strong> para confirmar</label>'
        + '<input type="text" id="confirmar-desativar-arvore" placeholder="DESATIVAR" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;text-align:center;">'
        + '</div>'
        + '<div id="msg-desativar-arvore" style="margin-bottom:12px;font-size:13px;"></div>'
        + '<div style="display:flex;gap:12px;">'
        + '<button onclick="document.getElementById(\'modal-desativar-funcionario-arvore\').remove()" style="flex:1;padding:12px;background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:all 0.2s;" onmouseover="this.style.background=\'#e2e8f0\'" onmouseout="this.style.background=\'#f1f5f9\'">Cancelar</button>'
        + '<button onclick="executarDesativarFuncionarioArvoreComTransferencia(\'' + funcionarioId + '\')" id="btn-desativar-arvore" style="flex:1;padding:12px;background:#ef4444;color:white;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:opacity 0.2s;" onmouseover="this.style.opacity=\'0.9\'" onmouseout="this.style.opacity=\'1\'">Desativar</button>'
        + '</div>'
        + '</div>';

    document.body.appendChild(modal);
}

// Toggle para mostrar/ocultar seção de transferência na árvore
function toggleTransferenciaTarefasArvore() {
    var chk = document.getElementById('chk-transferir-tarefas-arvore');
    var secao = document.getElementById('secao-transferencia-arvore');
    if (chk && secao) {
        secao.style.display = chk.checked ? 'block' : 'none';
    }
}

// Buscar novo responsável para transferência na árvore
var novoResponsavelArvoreSelecionado = null;
async function buscarNovoResponsavelArvore() {
    var nome = document.getElementById('transferir-arvore-nome').value.trim();
    var matricula = document.getElementById('transferir-arvore-matricula').value.trim();
    var resultadoDiv = document.getElementById('resultado-busca-arvore');

    if (!nome || !matricula) {
        resultadoDiv.innerHTML = '<p style="color:#ef4444;font-size:12px;">Preencha nome e matrícula.</p>';
        return;
    }

    resultadoDiv.innerHTML = '<p style="color:#64748b;font-size:12px;">Buscando...</p>';

    var usuario = await buscarUsuarioPorNomeMatricula(nome, matricula);

    if (usuario) {
        novoResponsavelArvoreSelecionado = usuario;
        resultadoDiv.innerHTML = '<p style="color:#16a34a;font-size:12px;"><strong>Usuário encontrado:</strong> ' + usuario.full_name + ' (' + usuario.role + ')</p>';
    } else {
        novoResponsavelArvoreSelecionado = null;
        resultadoDiv.innerHTML = '<p style="color:#ef4444;font-size:12px;">Usuário não encontrado. Verifique nome e matrícula.</p>';
    }
}

// Executa desativação do funcionário (com ou sem transferência de tarefas)
async function executarDesativarFuncionarioArvoreComTransferencia(funcionarioId) {
    var confirmacao = document.getElementById('confirmar-desativar-arvore').value.trim();
    var chkTransferir = document.getElementById('chk-transferir-tarefas-arvore');
    var msgEl = document.getElementById('msg-desativar-arvore');
    var btn = document.getElementById('btn-desativar-arvore');

    if (confirmacao !== 'DESATIVAR') {
        msgEl.textContent = 'Digite DESATIVAR para confirmar.';
        msgEl.style.color = '#ef4444';
        return;
    }

    // Validar transferência se checkbox marcado
    if (chkTransferir && chkTransferir.checked) {
        if (!novoResponsavelArvoreSelecionado) {
            msgEl.textContent = 'Busque e selecione um novo responsável para transferir as tarefas.';
            msgEl.style.color = '#ef4444';
            return;
        }
    }

    btn.textContent = 'Processando...';
    btn.disabled = true;

    try {
        // TRANSFERIR TAREFAS se solicitado
        if (chkTransferir && chkTransferir.checked && novoResponsavelArvoreSelecionado) {
            btn.textContent = 'Transferindo tarefas...';
            var resultadoTransferencia = await transferirTarefasUsuario(
                funcionarioId,
                novoResponsavelArvoreSelecionado.id,
                novoResponsavelArvoreSelecionado.full_name
            );

            if (resultadoTransferencia.erro) {
                throw new Error('Erro na transferência: ' + resultadoTransferencia.erro);
            }
        }

        // Desativar funcionário (Soft Delete)
        var { error } = await supabaseClient
            .from('profiles')
            .update({ role: 'inativo', ativo: false })
            .eq('id', funcionarioId);

        if (error) throw error;

        var mensagemSucesso = 'Funcionário desativado com sucesso!';
        if (chkTransferir && chkTransferir.checked && novoResponsavelArvoreSelecionado) {
            mensagemSucesso += ' Tarefas transferidas para ' + novoResponsavelArvoreSelecionado.full_name + '.';
        }

        // Limpar variável
        novoResponsavelArvoreSelecionado = null;

        var modal = document.getElementById('modal-desativar-funcionario-arvore');
        if (modal) modal.remove();

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Desativado!',
                text: mensagemSucesso,
                icon: 'success',
                timer: 2500,
                showConfirmButton: false
            });
        } else {
            alert(mensagemSucesso);
        }

        // Recarregar a árvore
        if (typeof carregarHierarquiaCompletaSecretario === 'function') {
            carregarHierarquiaCompletaSecretario();
        }

    } catch (err) {
        console.error('Erro ao desativar funcionário:', err);
        msgEl.textContent = err.message || 'Erro ao desativar funcionário.';
        msgEl.style.color = '#ef4444';
        btn.textContent = 'Desativar';
        btn.disabled = false;
    }
}

// Abre modal combinado com Estatísticas (esquerda) e Relatório de Produtividade (direita) para Fiscais de Posturas
async function abrirEstatisticasComRelatorioFiscal(fiscalId, nomeFiscal) {
    var modalId = 'modal-estatisticas-relatorio-fiscal';
    var existente = document.getElementById(modalId);
    if (existente) existente.remove();

    var modal = document.createElement('div');
    modal.id = modalId;
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';

    modal.innerHTML = ''
        + '<div style="background:white;border-radius:16px;width:100%;max-width:1200px;max-height:95vh;overflow-y:auto;position:relative;">'
        + '<button onclick="document.getElementById(\'' + modalId + '\').remove()" style="position:absolute;top:16px;right:16px;background:none;border:none;font-size:24px;cursor:pointer;color:#64748b;z-index:10;">&times;</button>'
        + '<div style="padding:30px;">'
        + '<div style="text-align:center;margin-bottom:24px;">'
        + '<h2 style="margin:0 0 8px 0;color:#1e293b;font-size:22px;">' + nomeFiscal + '</h2>'
        + '<span style="background:#b45309;color:white;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600;">Fiscal de Posturas</span>'
        + '</div>'
        + '<div style="display:flex;gap:20px;flex-wrap:wrap;">'
        // Coluna da Esquerda - Estatísticas de Tarefas
        + '<div style="flex:1;min-width:350px;">'
        + '<h3 style="margin:0 0 16px 0;color:#1e293b;font-size:16px;font-weight:700;text-align:center;">Estatísticas de Tarefas</h3>'
        + '<div id="estatisticas-tarefas-fiscal" style="min-height:300px;">'
        + '<div style="text-align:center;padding:40px;color:#64748b;">Carregando estatísticas...</div>'
        + '</div>'
        + '</div>'
        // Coluna da Direita - Relatório de Produtividade
        + '<div style="flex:1;min-width:350px;">'
        + '<h3 style="margin:0 0 16px 0;color:#1e293b;font-size:16px;font-weight:700;text-align:center;">Relatório de Produtividade</h3>'
        + '<div id="relatorio-produtividade-fiscal" style="min-height:300px;">'
        + '<div style="text-align:center;padding:40px;color:#64748b;">Carregando relatório...</div>'
        + '</div>'
        + '</div>'
        + '</div>'
        + '</div>'
        + '</div>';

    document.body.appendChild(modal);

    // Carregar ambos os dados em paralelo
    await Promise.all([
        carregarEstatisticasTarefasParaFiscal(fiscalId),
        carregarRelatorioProdutividadeParaFiscal(fiscalId, nomeFiscal)
    ]);
}

// Carrega estatísticas de tarefas para o modal combinado
async function carregarEstatisticasTarefasParaFiscal(fiscalId) {
    var container = document.getElementById('estatisticas-tarefas-fiscal');
    if (!container) return;

    try {
        // Buscar tarefas do fiscal (mesma lógica de abrirEstatisticasFuncionario)
        var { data: responsaveis, error: errResp } = await supabaseClient
            .from('tarefa_responsaveis')
            .select('tarefa_id')
            .eq('user_id', fiscalId);

        if (errResp) throw errResp;

        var tarefaIds = responsaveis ? responsaveis.map(function (r) { return r.tarefa_id; }) : [];

        var tarefasPrincipais = [];
        if (tarefaIds.length > 0) {
            var { data: tarefas, error: errTarefas } = await supabaseClient
                .from('tarefas')
                .select('*')
                .in('id', tarefaIds)
                .is('tarefa_pai_id', null);

            if (errTarefas) throw errTarefas;
            tarefasPrincipais = tarefas || [];
        }

        var { data: tarefasCriadas, error: errCriadas } = await supabaseClient
            .from('tarefas')
            .select('*')
            .eq('criado_por', fiscalId)
            .is('tarefa_pai_id', null);

        if (errCriadas) throw errCriadas;

        var tarefasMap = {};
        (tarefasPrincipais || []).forEach(function (t) { tarefasMap[t.id] = t; });
        (tarefasCriadas || []).forEach(function (t) { if (!tarefasMap[t.id]) tarefasMap[t.id] = t; });
        var todasTarefas = Object.values(tarefasMap);

        // Calcular estatísticas
        var stats = {
            total: todasTarefas.length,
            concluidas: 0,
            emProgresso: 0,
            pendentes: 0,
            atrasadas: 0
        };

        var hoje = new Date().toISOString().split('T')[0];
        todasTarefas.forEach(function (t) {
            if (t.status === 'concluida') {
                stats.concluidas++;
            } else if (t.prazo && t.prazo < hoje) {
                stats.atrasadas++;
            } else if (t.status === 'em_progresso') {
                stats.emProgresso++;
            } else {
                stats.pendentes++;
            }
        });

        // Renderizar resumo
        var html = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:20px;">';
        html += '<div style="background:#f0fdf4;border-radius:12px;padding:16px;text-align:center;border:1px solid #bbf7d0;"><div style="font-size:24px;font-weight:700;color:#16a34a;">' + stats.total + '</div><div style="font-size:12px;color:#166534;">Total Tarefas</div></div>';
        html += '<div style="background:#dbeafe;border-radius:12px;padding:16px;text-align:center;border:1px solid #93c5fd;"><div style="font-size:24px;font-weight:700;color:#2563eb;">' + stats.concluidas + '</div><div style="font-size:12px;color:#1e40af;">Concluídas</div></div>';
        html += '<div style="background:#fef3c7;border-radius:12px;padding:16px;text-align:center;border:1px solid #fcd34d;"><div style="font-size:24px;font-weight:700;color:#d97706;">' + stats.emProgresso + '</div><div style="font-size:12px;color:#92400e;">Em Progresso</div></div>';
        html += '<div style="background:#fee2e2;border-radius:12px;padding:16px;text-align:center;border:1px solid #fca5a5;"><div style="font-size:24px;font-weight:700;color:#dc2626;">' + stats.atrasadas + '</div><div style="font-size:12px;color:#991b1b;">Atrasadas</div></div>';
        html += '</div>';

        // Gráfico de status
        html += '<div style="background:#f8fafc;border-radius:12px;padding:16px;">';
        html += '<canvas id="grafico-status-tarefas-fiscal" style="max-height:200px;"></canvas>';
        html += '</div>';

        container.innerHTML = html;

        // Criar gráfico
        setTimeout(function () {
            var ctx = document.getElementById('grafico-status-tarefas-fiscal');
            if (ctx && typeof Chart !== 'undefined') {
                new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Concluídas', 'Em Progresso', 'Pendentes', 'Atrasadas'],
                        datasets: [{
                            data: [stats.concluidas, stats.emProgresso, stats.pendentes, stats.atrasadas],
                            backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'],
                            borderWidth: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'bottom', labels: { usePointStyle: true, padding: 10, font: { size: 11 } } }
                        }
                    }
                });
            }
        }, 100);

    } catch (err) {
        console.error("Erro ao carregar estatísticas:", err);
        container.innerHTML = '<div style="text-align:center;padding:40px;color:#ef4444;">Erro ao carregar estatísticas.</div>';
    }
}

// Carrega relatório de produtividade para o modal combinado
async function carregarRelatorioProdutividadeParaFiscal(fiscalId, nomeFiscal) {
    var container = document.getElementById('relatorio-produtividade-fiscal');
    if (!container) return;

    try {
        // Buscar registros do fiscal (mesma lógica de abrirRelatorioFiscal)
        var { data: regProd } = await supabaseClient
            .from('registros_produtividade')
            .select('*')
            .eq('user_id', fiscalId)
            .order('created_at', { ascending: false });

        var { data: regCP } = await supabaseClient
            .from('controle_processual')
            .select('*')
            .eq('user_id', fiscalId)
            .order('created_at', { ascending: false });

        var todosRegs = (regProd || []).concat(regCP || []);
        var registrosFiltrados = todosRegs.filter(function (r) { return (r.pontuacao || 0) !== 0; });

        // Calcular totais
        var pontuacaoTotal = registrosFiltrados.reduce(function (sum, r) { return sum + (r.pontuacao || 0); }, 0);
        var totalDocumentos = registrosFiltrados.length;

        // Agrupar por tipo
        var docPorTipo = {};
        registrosFiltrados.forEach(function (r) {
            var tipo = r.categoria || 'Outros';
            if (!docPorTipo[tipo]) docPorTipo[tipo] = 0;
            docPorTipo[tipo]++;
        });

        // Renderizar resumo
        var html = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:20px;">';
        html += '<div style="background:#f0fdf4;border-radius:12px;padding:16px;text-align:center;border:1px solid #bbf7d0;"><div style="font-size:24px;font-weight:700;color:#16a34a;">' + pontuacaoTotal + '</div><div style="font-size:12px;color:#166534;">Pontuação Total</div></div>';
        html += '<div style="background:#e0e7ff;border-radius:12px;padding:16px;text-align:center;border:1px solid #a5b4fc;"><div style="font-size:24px;font-weight:700;color:#4f46e5;">' + totalDocumentos + '</div><div style="font-size:12px;color:#3730a3;">Documentos</div></div>';
        html += '</div>';

        // Gráfico de documentos por tipo
        if (Object.keys(docPorTipo).length > 0) {
            html += '<div style="background:#f8fafc;border-radius:12px;padding:16px;margin-bottom:16px;">';
            html += '<canvas id="grafico-docs-tipo-fiscal" style="max-height:180px;"></canvas>';
            html += '</div>';
        }

        // Lista dos últimos registros
        html += '<div style="max-height:200px;overflow-y:auto;">';
        html += '<h4 style="margin:0 0 12px 0;color:#1e293b;font-size:14px;">Últimos Registros</h4>';
        if (registrosFiltrados.length === 0) {
            html += '<p style="color:#64748b;font-size:13px;text-align:center;">Nenhum registro encontrado.</p>';
        } else {
            html += '<div style="display:flex;flex-direction:column;gap:8px;">';
            registrosFiltrados.slice(0, 5).forEach(function (r) {
                var data = r.created_at ? new Date(r.created_at).toLocaleDateString('pt-BR') : '-';
                html += '<div style="background:#f8fafc;border-radius:8px;padding:10px;border:1px solid #e2e8f0;">';
                html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
                html += '<span style="font-weight:600;color:#1e293b;font-size:13px;">' + (r.categoria || 'Sem categoria') + '</span>';
                html += '<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">+' + (r.pontuacao || 0) + ' pts</span>';
                html += '</div>';
                html += '<div style="font-size:11px;color:#64748b;margin-top:4px;">' + data + '</div>';
                html += '</div>';
            });
            html += '</div>';
        }
        html += '</div>';

        container.innerHTML = html;

        // Criar gráfico de documentos
        if (Object.keys(docPorTipo).length > 0) {
            setTimeout(function () {
                var ctx = document.getElementById('grafico-docs-tipo-fiscal');
                if (ctx && typeof Chart !== 'undefined') {
                    var labels = Object.keys(docPorTipo).slice(0, 5);
                    var data = Object.values(docPorTipo).slice(0, 5);
                    new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: labels,
                            datasets: [{
                                label: 'Quantidade',
                                data: data,
                                backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'],
                                borderRadius: 6
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { display: false } },
                            scales: {
                                y: { beginAtZero: true, ticks: { stepSize: 1 } },
                                x: { ticks: { font: { size: 10 } } }
                            }
                        }
                    });
                }
            }, 100);
        }

    } catch (err) {
        console.error("Erro ao carregar relatório:", err);
        container.innerHTML = '<div style="text-align:center;padding:40px;color:#ef4444;">Erro ao carregar relatório.</div>';
    }
}


// Expor funções globalmente
window.abrirEstatisticasFuncionario = abrirEstatisticasFuncionario;
window.abrirRelatorioFiscal = abrirRelatorioFiscal;
window.carregarDashboardSecretario = carregarDashboardSecretario;
window.carregarHierarquiaCompletaSecretario = carregarHierarquiaCompletaSecretario;
window.carregarResumoTarefasSecretario = carregarResumoTarefasSecretario;
window.carregarGraficoDocumentosSecretario = carregarGraficoDocumentosSecretario;
window.carregarCalendarioProjetosSecretario = carregarCalendarioProjetosSecretario;
window.irParaProjetos = irParaProjetos;
window.renderizarCardArvore = renderizarCardArvore;
window.renderizarCardArvoreCompacto = renderizarCardArvoreCompacto;
window.carregarDiretoresSecretario = carregarDiretoresSecretario;
window.abrirFormNovoDiretor = abrirFormNovoDiretor;
window.abrirFormNovoFuncionarioPorCargo = abrirFormNovoFuncionarioPorCargo;
window.salvarNovoFuncionarioPorCargo = salvarNovoFuncionarioPorCargo;
window.abrirFormNovoFuncionarioEquipeAmbiental = abrirFormNovoFuncionarioEquipeAmbiental;
window.salvarNovoFuncionarioEquipe = salvarNovoFuncionarioEquipe;
window.confirmarDesativarFuncionarioArvore = confirmarDesativarFuncionarioArvore;
window.executarDesativarFuncionarioArvoreComTransferencia = executarDesativarFuncionarioArvoreComTransferencia;
window.toggleTransferenciaTarefasArvore = toggleTransferenciaTarefasArvore;
window.buscarNovoResponsavelArvore = buscarNovoResponsavelArvore;
window.abrirEstatisticasComRelatorioFiscal = abrirEstatisticasComRelatorioFiscal;
window.carregarEstatisticasTarefasParaFiscal = carregarEstatisticasTarefasParaFiscal;
window.carregarRelatorioProdutividadeParaFiscal = carregarRelatorioProdutividadeParaFiscal;
