// gerente.js
// Script exclusivo para a aba Gerência Institucional
// Reutiliza a instância do supabaseClient do protecao.js

let graficoBairrosInstance = null;
let graficoFiscaisInstance = null;

// Grafico Home do Gerente: Fiscais x Pontuacao do mes
async function carregarGraficoFiscais() {
    try {
        // 1. Buscar todos os usuarios com role 'fiscal' incluindo avatar
        const { data: fiscais, error: errFiscais } = await supabaseClient
            .from('profiles')
            .select('id, full_name, avatar_url')
            .in('role', ['fiscal', 'Fiscal de Posturas', 'fiscal de posturas']);

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

        if (registrosFiltrados.length === 0) {
            alert('Nenhum registro com pontuação encontrado para ' + nomeFiscal);
            return;
        }

        const anoAtual = new Date().getFullYear();

        // 2. Agrupar registros por categoria
        const porCategoria = {};
        registrosFiltrados.forEach(r => {
            const catId = r.categoria_id || 'outros';
            // Tenta encontrar o nome da categoria usando a global CATEGORIAS se disponível
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

        const pontuacaoTotal = registrosFiltrados.reduce((s, r) => s + (r.pontuacao || 0), 0);

        // 3. Gerar tabelas por categoria
        let secoesHTML = '';
        Object.values(porCategoria).forEach(cat => {
            // Tenta obter a definição da categoria para saber quais campos exibir
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
                
                // Formatação de data (usa obterDataReal se disponível, senão fallback)
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

        // 4. Criar modal do relatório (id diferente para não conflitar com o do fiscal caso ambos estejam abertos)
        const modalHTML = `
            <div class="modal-overlay ativo" id="modal-relatorio-gerente" onclick="if(event.target===this)fecharRelatorioGerente()">
                <div class="relatorio-preview" id="relatorio-gerente-conteudo">
                    <h1 contenteditable="true">RELATÓRIO DE PRODUTIVIDADE — ${anoAtual}</h1>
                    <div class="relatorio-info">
                        <div><strong>Fiscal:</strong> <span contenteditable="true">${nomeFiscal}</span></div>
                        <div><strong>Ano:</strong> <span contenteditable="true">${anoAtual}</span></div>
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
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

    } catch (err) {
        console.error("Erro ao gerar relatório do fiscal:", err);
        alert("Erro ao gerar relatório: " + (err.message || err));
    }
}

function fecharRelatorioGerente() {
    var modal = document.getElementById('modal-relatorio-gerente');
    if (modal) modal.remove();
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
        + '<div style="width:50px;height:50px;border-radius:50%;background:#fef2f2;display:inline-flex;align-items:center;justify-content:center;font-size:24px;margin-bottom:10px;">⚠️</div>'
        + '<h2 style="margin:0;color:#dc2626;">Excluir Fiscal</h2>'
        + '<p style="color:#64748b;margin:8px 0 0 0;">Voc\u00ea est\u00e1 prestes a excluir a conta de:</p>'
        + '<p style="font-weight:700;font-size:18px;color:#1e293b;margin:4px 0 0 0;">' + nomeFiscal + '</p>'
        + '</div>'
        + '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin-bottom:16px;">'
        + '<p style="color:#dc2626;font-size:13px;margin:0;"><strong>\u26a0 Esta a\u00e7\u00e3o \u00e9 irrevers\u00edvel!</strong> Todos os dados deste fiscal ser\u00e3o removidos permanentemente.</p>'
        + '</div>'
        + '<div style="margin-bottom:14px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;">Seu CPF (gerente)</label>'
        + '<input type="text" id="excluir-cpf-gerente" placeholder="000.000.000-00" maxlength="14" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;" oninput="mascaraCpfNovoFiscal(this)">'
        + '</div>'
        + '<div style="margin-bottom:14px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;">Sua Senha</label>'
        + '<input type="password" id="excluir-senha-gerente" placeholder="Sua senha" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">'
        + '</div>'
        + '<div style="margin-bottom:16px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;">Digite <strong style="color:#dc2626;">EXCLUIR</strong> para confirmar</label>'
        + '<input type="text" id="excluir-confirmacao" placeholder="EXCLUIR" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">'
        + '</div>'
        + '<div id="msg-excluir-fiscal" style="margin-bottom:12px;font-size:13px;"></div>'
        + '<button onclick="executarExclusaoFiscal(\'' + fiscalId + '\', \'' + nomeFiscal.replace(/'/g, "\\'") + '\')" id="btn-confirmar-exclusao" style="width:100%;padding:12px;background:#dc2626;color:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">Confirmar Exclus\u00e3o</button>'
        + '</div>';

    document.body.appendChild(modal);

    modal.addEventListener('click', function (e) {
        if (e.target === modal) modal.remove();
    });
}

async function executarExclusaoFiscal(fiscalId, nomeFiscal) {
    var cpfGerente = document.getElementById('excluir-cpf-gerente').value.replace(/\D/g, '');
    var senhaGerente = document.getElementById('excluir-senha-gerente').value;
    var confirmacao = document.getElementById('excluir-confirmacao').value.trim();
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
    if (confirmacao !== 'EXCLUIR') {
        msgEl.textContent = 'Digite EXCLUIR (em maiusculo) para confirmar.';
        msgEl.style.color = '#ef4444';
        return;
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

        // Restaurar sessao do gerente antes de deletar
        if (refreshGerente) {
            await supabaseClient.auth.setSession({
                access_token: tokenGerente,
                refresh_token: refreshGerente
            });
        }

        // Desativar perfil do fiscal (Exclusão Lógica)
        var { error: deleteErr } = await supabaseClient
            .from('profiles')
            .update({ role: 'inativo' })
            .eq('id', fiscalId);

        if (deleteErr) throw deleteErr;

        msgEl.innerHTML = '<strong>' + nomeFiscal + '</strong> foi desativado com sucesso.';
        msgEl.style.color = '#10b981';

        // Fechar e atualizar ranking imediatamente
        var modal = document.getElementById('modal-excluir-fiscal');
        if (modal) modal.remove();
        if (typeof carregarGraficoFiscais === 'function') carregarGraficoFiscais();

    } catch (err) {
        console.error('Erro ao excluir fiscal:', err);
        msgEl.textContent = err.message || 'Erro ao excluir fiscal.';
        msgEl.style.color = '#ef4444';
    } finally {
        btnExcluir.textContent = 'Confirmar Exclusao';
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
                    <img src="https://www.anapolis.go.gov.br/wp-content/uploads/2021/01/brasao.png" alt="Brasão Anápolis" style="width: 80px; margin-bottom: 10px;">
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
            .in('role', ['fiscal', 'Fiscal de Posturas', 'fiscal de posturas'])
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
            .in('role', ['gerente', 'Gerente', 'gerente fiscal', 'Gerente Fiscal', 'gerente de posturas', 'Gerente de Posturas']);

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

        gerentes.forEach(function(gerente, index) {
            var cor = cores[index % cores.length];
            
            var fotoHtml = '';
            if (gerente.avatar_url) {
                fotoHtml = '<img src="' + gerente.avatar_url + '" style="width:50px;height:50px;border-radius:50%;object-fit:cover;border:3px solid ' + cor + ';">';
            } else {
                fotoHtml = '<div style="width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,' + cor + ',#666);display:flex;align-items:center;justify-content:center;font-size:20px;color:white;border:3px solid ' + cor + ';">' + (gerente.full_name ? gerente.full_name.charAt(0).toUpperCase() : 'G') + '</div>';
            }

            html += '<div style="background:white;border-radius:12px;padding:16px;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);border-left:4px solid ' + cor + ';">';
            
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
            html += '<div style="display:flex;gap:8px;">';
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
                role: 'gerente de posturas',
                email_real: emailReal,
                email: emailFicticio
            }, { onConflict: 'id' });

        if (profileError) throw profileError;

        msgEl.innerHTML = '<span style="color:#10b981;">Gerente processado com sucesso!</span>';
        
        setTimeout(function() {
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

// Modal de confirmacao para excluir Gerente
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
        + '<div style="width:50px;height:50px;border-radius:50%;background:#fef2f2;display:inline-flex;align-items:center;justify-content:center;font-size:24px;margin-bottom:10px;">\u26a0\ufe0f</div>'
        + '<h2 style="margin:0;color:#dc2626;">Excluir Gerente</h2>'
        + '<p style="color:#64748b;margin:8px 0 0 0;">Você está prestes a excluir:</p>'
        + '<p style="font-weight:700;font-size:18px;color:#1e293b;margin:4px 0 0 0;">' + nomeGerente + '</p>'
        + '</div>'
        + '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin-bottom:16px;">'
        + '<p style="color:#dc2626;font-size:13px;margin:0;"><strong>\u26a0 Esta ação é irreversível!</strong></p>'
        + '</div>'
        + '<div style="margin-bottom:16px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;">Digite <strong style="color:#dc2626;">EXCLUIR</strong> para confirmar</label>'
        + '<input type="text" id="excluir-gerente-confirmacao" placeholder="EXCLUIR" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">'
        + '</div>'
        + '<div id="msg-excluir-gerente" style="margin-bottom:12px;font-size:13px;text-align:center;"></div>'
        + '<button onclick="excluirGerenteDiretor(\'' + gerenteId + '\', \'' + nomeGerente.replace(/'/g, "\\'") + '\')" id="btn-confirmar-excluir-gerente" style="width:100%;padding:12px;background:#dc2626;color:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">Confirmar Exclusão</button>'
        + '</div>';

    document.body.appendChild(modal);
}

// Exclui o Gerente
async function excluirGerenteDiretor(gerenteId, nomeGerente) {
    var confirmacao = document.getElementById('excluir-gerente-confirmacao').value.trim();
    var msgEl = document.getElementById('msg-excluir-gerente');
    var btn = document.getElementById('btn-confirmar-excluir-gerente');

    if (confirmacao !== 'EXCLUIR') {
        msgEl.textContent = 'Digite EXCLUIR para confirmar.';
        msgEl.style.color = '#ef4444';
        return;
    }

    btn.textContent = 'Excluindo...';
    btn.disabled = true;

    try {
        var { error } = await supabaseClient
            .from('profiles')
            .update({ role: 'inativo' })
            .eq('id', gerenteId);

        if (error) throw error;

        msgEl.innerHTML = '<span style="color:#10b981;">Gerente excluído com sucesso!</span>';
        
        setTimeout(function() {
            document.getElementById('modal-excluir-gerente').remove();
            if (typeof carregarDashboardDiretor === 'function') carregarDashboardDiretor();
        }, 1500);

    } catch (err) {
        console.error('Erro ao excluir gerente:', err);
        msgEl.textContent = err.message || 'Erro ao excluir gerente.';
        msgEl.style.color = '#ef4444';
        btn.textContent = 'Confirmar Exclusão';
        btn.disabled = false;
    }
}


// ==========================================
// DASHBOARD DO SECRETÁRIO - GESTÃO DE DIRETORES
// ==========================================

// Funcao principal que carrega o dashboard do Secretario
async function carregarDashboardSecretario() {
    try {
        await carregarDiretoresSecretario();
        // Carregar tarefas do secretario
        if (typeof carregarMinhasTarefasHome === 'function') {
            carregarMinhasTarefasHome('secretario-minhas-tarefas');
        }
    } catch (err) {
        console.error("Erro ao carregar dashboard do secretario:", err);
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
            .in('role', ['diretor', 'Diretor', 'diretor de meio ambiente', 'Diretor de Meio Ambiente']);

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

        diretores.forEach(function(diretor, index) {
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
            html += '<button onclick="abrirExcluirDiretorSecretario(\'' + diretor.id + '\', \'' + (diretor.full_name || '').replace(/'/g, "\\'") + '\')" title="Excluir" style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:8px 12px;cursor:pointer;font-size:12px;color:#dc2626;font-weight:600;">Excluir</button>';
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
        + '<p style="font-size:12px;color:#94a3b8;margin-bottom:16px;">Cargo: <strong>Diretor de Meio Ambiente</strong> | Senha padrão: <strong>123456</strong></p>'
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
                role: 'diretor de meio ambiente',
                email_real: emailReal,
                email: emailFicticio
            }, { onConflict: 'id' });

        if (profileError) throw profileError;

        msgEl.innerHTML = '<span style="color:#10b981;">Diretor processado com sucesso!</span>';
        
        setTimeout(function() {
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
        + '<div style="width:50px;height:50px;border-radius:50%;background:#fef2f2;display:inline-flex;align-items:center;justify-content:center;font-size:24px;margin-bottom:10px;">\u26a0\ufe0f</div>'
        + '<h2 style="margin:0;color:#dc2626;">Excluir Diretor</h2>'
        + '<p style="color:#64748b;margin:8px 0 0 0;">Você está prestes a excluir:</p>'
        + '<p style="font-weight:700;font-size:18px;color:#1e293b;margin:4px 0 0 0;">' + nomeDiretor + '</p>'
        + '</div>'
        + '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin-bottom:16px;">'
        + '<p style="color:#dc2626;font-size:13px;margin:0;"><strong>\u26a0 Esta ação é irreversível!</strong></p>'
        + '</div>'
        + '<div style="margin-bottom:16px;">'
        + '<label style="display:block;font-weight:600;margin-bottom:4px;color:#334155;">Digite <strong style="color:#dc2626;">EXCLUIR</strong> para confirmar</label>'
        + '<input type="text" id="excluir-diretor-confirmacao" placeholder="EXCLUIR" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">'
        + '</div>'
        + '<div id="msg-excluir-diretor" style="margin-bottom:12px;font-size:13px;text-align:center;"></div>'
        + '<button onclick="excluirDiretorSecretario(\'' + diretorId + '\', \'' + nomeDiretor.replace(/'/g, "\\'") + '\')" id="btn-confirmar-excluir-diretor" style="width:100%;padding:12px;background:#dc2626;color:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">Confirmar Exclusão</button>'
        + '</div>';

    document.body.appendChild(modal);
}

// Exclui o Diretor
async function excluirDiretorSecretario(diretorId, nomeDiretor) {
    var confirmacao = document.getElementById('excluir-diretor-confirmacao').value.trim();
    var msgEl = document.getElementById('msg-excluir-diretor');
    var btn = document.getElementById('btn-confirmar-excluir-diretor');

    if (confirmacao !== 'EXCLUIR') {
        msgEl.textContent = 'Digite EXCLUIR para confirmar.';
        msgEl.style.color = '#ef4444';
        return;
    }

    btn.textContent = 'Excluindo...';
    btn.disabled = true;

    try {
        var { error } = await supabaseClient
            .from('profiles')
            .update({ role: 'inativo' })
            .eq('id', diretorId);

        if (error) throw error;

        msgEl.innerHTML = '<span style="color:#10b981;">Diretor excluído com sucesso!</span>';
        
        setTimeout(function() {
            document.getElementById('modal-excluir-diretor').remove();
            if (typeof carregarDashboardSecretario === 'function') carregarDashboardSecretario();
        }, 1500);

    } catch (err) {
        console.error('Erro ao excluir diretor:', err);
        msgEl.textContent = err.message || 'Erro ao excluir diretor.';
        msgEl.style.color = '#ef4444';
        btn.textContent = 'Confirmar Exclusão';
        btn.disabled = false;
    }
}
