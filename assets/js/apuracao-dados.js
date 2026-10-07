// =============================================================================
// APURAÇÃO DE DADOS (Secretário e Diretor(a) de Meio Ambiente)
// =============================================================================
// Fonte dos processos/fiscais/valor de multa: consulta ao VIVO no banco Fluxograma
// (tabela `processos`, mesmo masterClient usado pela sincronização de produtividade),
// incluindo a coluna `valor_total_multas` (criada lá para já trazer o valor somado
// dos Autos de cada processo).
//
// Por cima disso, a tabela própria do SEMAC (`controle_multas_fazenda` — preenchida
// manualmente, importada de .csv/.ods/.xlsx da planilha "PROCESSOS ENVIADOS PARA A
// FAZENDA - AUTO DE INFRAÇÃO COM GUIA DE PG") funciona como CAMADA DE CORREÇÃO: quando
// existe um registro para o mesmo PA (numero_processo), o VALOR e o FISCAL RESPONSÁVEL
// de lá PREVALECEM sobre o que vem do Fluxograma — cobre tanto valores que ainda não
// foram preenchidos/estavam errados no Fluxograma, quanto a atribuição correta do
// fiscal (a coluna "Responsável" da planilha é cruzada com o cadastro de usuários do
// SEMAC por nome — ex: "LUIZA" na planilha resolve pro cadastro "Luiza Magalhães ...").
// Cada inserção/edição/exclusão/importação atualiza a tela automaticamente.

(function () {

    var _apuracaoChartProcessos = null;
    var _apuracaoChartMultas = null;
    var _apuracaoMultaEditandoId = null;
    var _apuracaoTodasMultas = []; // cache da tabela controle_multas_fazenda (sem filtro de data)

    function normalizarPA(numero) {
        if (!numero) return '';
        var str = String(numero).trim();
        var partes = str.split('/');
        if (partes.length === 2) {
            var num = partes[0].replace(/\D/g, '').replace(/^0+(?=\d)/, '');
            var ano = partes[1].replace(/\D/g, '');
            if (num) return num + '/' + ano;
        }
        var soDigitos = str.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
        return soDigitos || str.toLowerCase();
    }

    function formatarMoeda(valor) {
        var n = Number(valor) || 0;
        return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function parseValorBR(str) {
        if (str === null || str === undefined) return 0;
        if (typeof str === 'number') return str;
        var s = String(str).trim().replace(/[^\d,.-]/g, '');
        if (!s) return 0;
        // Formato brasileiro: ponto = milhar, vírgula = decimal
        if (s.indexOf(',') !== -1) {
            s = s.replace(/\./g, '').replace(',', '.');
        }
        var n = parseFloat(s);
        return isNaN(n) ? 0 : n;
    }

    function parseDataBR(valor) {
        if (!valor) return null;
        if (valor instanceof Date) {
            // SheetJS entrega datas de .ods/.xlsx já como Date em UTC-meia-noite — usar
            // toISOString() em vez de getFullYear()/getDate() evita voltar um dia em
            // fusos atrás de UTC (como o nosso).
            return isNaN(valor.getTime()) ? null : valor.toISOString().slice(0, 10);
        }
        var s = String(valor).trim();
        if (!s) return null;
        // Já em formato YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
        // Formato DD/MM/YYYY ou DD/MM/YY
        var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
        if (m) {
            var dia = m[1].padStart(2, '0');
            var mes = m[2].padStart(2, '0');
            var ano = m[3].length === 2 ? ('20' + m[3]) : m[3];
            return ano + '-' + mes + '-' + dia;
        }
        return null;
    }

    function escapeHtmlApuracao(text) {
        if (text === null || text === undefined) return '';
        return String(text)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    // ---------------------------------------------------------------------------
    // Cadastro de fiscais do SEMAC + resolução do texto livre "Responsável" pra um
    // fiscal real — ex: "LUIZA" na planilha deve achar "Luiza Magalhães ..." no cadastro.
    // ---------------------------------------------------------------------------
    function normalizarTexto(s) {
        if (!s) return '';
        return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ');
    }

    // Só fiscais (Posturas e Meio Ambiente) entram como candidatos a "Responsável" —
    // reduz risco de casar o texto da planilha com um Gerente/Secretário por acaso.
    var _apuracaoCacheFiscais = null;
    async function buscarFiscaisSemac() {
        if (_apuracaoCacheFiscais) return _apuracaoCacheFiscais;
        var { data, error } = await supabaseClient.from('profiles').select('id, full_name, role');
        if (error) {
            console.error('[Apuração de Dados] Erro ao buscar cadastro de usuários do SEMAC:', error.message);
            return [];
        }
        _apuracaoCacheFiscais = (data || [])
            .filter(function (p) { return p.full_name && (p.role || '').toLowerCase().indexOf('fiscal') !== -1; })
            .sort(function (a, b) { return a.full_name.localeCompare(b.full_name, 'pt-BR'); });
        return _apuracaoCacheFiscais;
    }

    // Candidatos do cadastro que podem corresponder ao texto digitado em "Responsável".
    // Prioriza correspondência exata > primeiro nome > nome contido em algum lugar — assim
    // que um nível encontra QUALQUER candidato, para ali (não desce pro nível seguinte, mais
    // frouxo). É o que diferencia corretamente "LUIZ" de "LUIZA": o nível de primeiro nome
    // já acha exatamente 1 ("Luiz ...") e nem chega a testar o nível de conteúdo, que bateria
    // errado com "Luiza ...".
    function candidatosPorResponsavel(responsavelTexto, listaFiscais) {
        var alvo = normalizarTexto(responsavelTexto);
        if (!alvo || !listaFiscais || listaFiscais.length === 0) return [];

        var exatos = listaFiscais.filter(function (f) { return normalizarTexto(f.full_name) === alvo; });
        if (exatos.length > 0) return exatos;

        var porPrimeiroNome = listaFiscais.filter(function (f) {
            return normalizarTexto(f.full_name).split(' ')[0] === alvo;
        });
        if (porPrimeiroNome.length > 0) return porPrimeiroNome;

        return listaFiscais.filter(function (f) { return normalizarTexto(f.full_name).indexOf(alvo) !== -1; });
    }

    // Versão "silenciosa": só retorna um fiscal quando a correspondência é inequívoca (exatamente
    // 1 candidato no melhor nível). Usada na tela (merge com o Fluxograma) — quando é ambíguo ou
    // não acha ninguém, mantém o texto original em vez de arriscar atribuir à pessoa errada; casos
    // assim são perguntados ao usuário no momento da IMPORTAÇÃO (ver resolverResponsaveisPendentes).
    function encontrarFiscalPorResponsavel(responsavelTexto, listaFiscais) {
        var candidatos = candidatosPorResponsavel(responsavelTexto, listaFiscais);
        return candidatos.length === 1 ? candidatos[0] : null;
    }

    // ---------------------------------------------------------------------------
    // Mapa de correção: numero_processo normalizado -> { valor, nomeFiscal } do nosso
    // controle (controle_multas_fazenda). O nome do fiscal é resolvido a partir da
    // coluna "Responsável" contra o cadastro de usuários do SEMAC; quando não acha
    // ninguém correspondente, mantém o texto digitado mesmo (melhor que perder o dado).
    //
    // Um mesmo PA pode ter mais de um Auto de Infração (cada um com sua própria multa) —
    // quando isso acontece, cada Auto fica como linha separada no controle, mas aqui
    // SOMAMOS os valores dos Autos do mesmo PA: é essa soma que entra nos gráficos/KPIs
    // "por processo".
    // ---------------------------------------------------------------------------
    // ---------------------------------------------------------------------------
    // Sincronização: a tabela controle_multas_fazenda é a fonte ÚNICA dos gráficos/KPIs —
    // isso aqui só CRIA LINHAS pros processos do Fluxograma que ainda não existem na tabela
    // (por PA, independente de data). PA que já está na tabela nunca é buscado de novo nem
    // sobrescrito automaticamente — quem decide se um valor está certo é quem edita a linha
    // ou importa a planilha de verdade por cima.
    // ---------------------------------------------------------------------------
    async function sincronizarProcessosFaltantesDoFluxograma(dataInicio, dataFim) {
        var masterClient = window.supabaseMaster;
        if (!masterClient) return;

        var { data: existentesData, error: errExistentes } = await supabaseClient.from('controle_multas_fazenda').select('numero_processo');
        if (errExistentes) {
            console.error('[Apuração de Dados] Erro ao conferir PAs já cadastrados:', errExistentes.message);
            return;
        }
        var pasJaNaTabela = new Set((existentesData || []).map(function (r) { return normalizarPA(r.numero_processo); }));

        var todos = [];
        var offset = 0;
        var tamanhoLote = 500;
        var colunaValorDisponivel = true;
        // Buscar a coluna `dados` inteira (JSON grande, com etapas/infrações/etc.) pra tirar só o
        // nome/CPF do contribuinte estourava o tempo limite do Postgres em períodos largos (ex: ano
        // inteiro). `contribuinte:dados->contribuinte` pede só esse pedacinho do JSON ao banco, bem
        // mais leve — e se mesmo assim travar, cai pra trás: tenta sem contribuinte, depois com lote
        // menor, antes de desistir.
        var incluirContribuinte = true;
        while (true) {
            var camposBase = colunaValorDisponivel
                ? 'id, fiscal_id, numero_processo, valor_total_multas, created_at'
                : 'id, fiscal_id, numero_processo, created_at';
            var campos = incluirContribuinte ? (camposBase + ', contribuinte:dados->contribuinte') : camposBase;
            var query = masterClient.from('processos').select(campos);
            if (dataInicio) query = query.gte('created_at', dataInicio + 'T00:00:00');
            if (dataFim) query = query.lte('created_at', dataFim + 'T23:59:59');
            var { data: lote, error } = await query.range(offset, offset + tamanhoLote - 1);

            if (error) {
                // A coluna valor_total_multas pode ainda não existir no banco (migração pendente) —
                // nesse caso, tenta de novo sem ela em vez de não sincronizar nada.
                if (colunaValorDisponivel && /valor_total_multas/i.test(error.message || '')) {
                    console.warn('[Apuração de Dados] Coluna processos.valor_total_multas indisponível — sincronizando processos com valor 0 por enquanto.');
                    colunaValorDisponivel = false;
                    continue;
                }
                var ehTimeout = /timeout/i.test(error.message || '') || error.code === '57014';
                if (ehTimeout && incluirContribuinte) {
                    console.warn('[Apuração de Dados] Consulta lenta buscando nome/CPF do contribuinte — tentando sem esse dado (fica em branco nas linhas sincronizadas; a importação da planilha completa depois).');
                    incluirContribuinte = false;
                    continue;
                }
                if (ehTimeout && tamanhoLote > 100) {
                    tamanhoLote = Math.floor(tamanhoLote / 2);
                    console.warn('[Apuração de Dados] Consulta ainda lenta — reduzindo o lote para ' + tamanhoLote + ' e tentando de novo.');
                    continue;
                }
                console.error('[Apuração de Dados] Erro ao buscar processos do Fluxograma:', error.message);
                break;
            }
            if (!lote || lote.length === 0) break;
            todos = todos.concat(lote);
            if (lote.length < tamanhoLote) break;
            offset += tamanhoLote;
        }

        var faltantes = todos.filter(function (p) {
            var pa = normalizarPA(p.numero_processo);
            return pa && !pasJaNaTabela.has(pa);
        });
        if (faltantes.length === 0) return;

        var fiscalIds = [...new Set(faltantes.map(function (p) { return p.fiscal_id; }).filter(Boolean))];
        var nomesPorFiscalId = {};
        if (fiscalIds.length > 0) {
            var { data: perfis } = await masterClient.from('profiles').select('id, nome').in('id', fiscalIds);
            (perfis || []).forEach(function (p) { nomesPorFiscalId[p.id] = p.nome || ''; });
        }
        var listaFiscaisSemac = await buscarFiscaisSemac();

        var novasLinhas = [];
        var pasNestaLeva = new Set(); // evita duas linhas se o mesmo PA aparecer 2x no lote do Fluxograma
        faltantes.forEach(function (p) {
            var pa = normalizarPA(p.numero_processo);
            if (pasNestaLeva.has(pa)) return;
            pasNestaLeva.add(pa);

            var contribuinte = p.contribuinte || {};
            var nomeFluxograma = nomesPorFiscalId[p.fiscal_id] || '';
            var fiscalResolvido = encontrarFiscalPorResponsavel(nomeFluxograma, listaFiscaisSemac);

            novasLinhas.push({
                data_envio_fazenda: p.created_at ? p.created_at.substring(0, 10) : new Date().toISOString().slice(0, 10),
                numero_processo: p.numero_processo,
                tipo_fiscalizacao: null,
                nome_razao_social: contribuinte.nome || '',
                cpf_cnpj: contribuinte.cpf_cnpj || '',
                valor_multa: colunaValorDisponivel ? (Number(p.valor_total_multas) || 0) : 0,
                data_vencimento: null,
                numero_ar: '',
                numero_processo_betha: '',
                responsavel: fiscalResolvido ? fiscalResolvido.full_name : nomeFluxograma,
                defesa: '',
                observacoes: '',
                origem: 'fluxograma',
                created_by: window.userIdGlobal || null
            });
        });

        for (var off = 0; off < novasLinhas.length; off += 200) {
            var lote2 = novasLinhas.slice(off, off + 200);
            // upsert com ignoreDuplicates: se por acaso outra aba/sincronização já criou esse PA
            // entre a checagem acima e agora, só ignora em vez de falhar o lote inteiro.
            var { error: errIns } = await supabaseClient
                .from('controle_multas_fazenda')
                .upsert(lote2, { onConflict: 'numero_processo,valor_multa', ignoreDuplicates: true });
            if (errIns) console.error('[Apuração de Dados] Erro ao sincronizar processos do Fluxograma pro controle:', errIns.message);
        }
    }

    // Agrega a tabela controle_multas_fazenda (já carregada em _apuracaoTodasMultas) pro
    // período selecionado. Um mesmo PA pode ter mais de um Auto de Infração (cada um com sua
    // própria multa, linha separada no controle) — aqui SOMAMOS os valores dos Autos do mesmo
    // PA, e cada PA conta como 1 processo só (não 1 por Auto).
    function calcularAgregadosApuracao(dataInicio, dataFim) {
        var linhasNoPeriodo = _apuracaoTodasMultas.filter(function (m) {
            var d = m.data_envio_fazenda;
            if (dataInicio && (!d || d < dataInicio)) return false;
            if (dataFim && (!d || d > dataFim)) return false;
            return true;
        });

        var porProcesso = {}; // chave = PA normalizado
        linhasNoPeriodo.forEach(function (m) {
            var pa = normalizarPA(m.numero_processo);
            if (!pa) return;
            if (!porProcesso[pa]) porProcesso[pa] = { valor: 0, responsavel: null };
            porProcesso[pa].valor += parseValorBR(m.valor_multa);
            if (!porProcesso[pa].responsavel && m.responsavel) porProcesso[pa].responsavel = m.responsavel;
        });

        var porFiscal = {};
        var totalProcessos = 0;
        var totalValorMultas = 0;
        Object.values(porProcesso).forEach(function (p) {
            totalProcessos++;
            var chaveFiscal = normalizarTexto(p.responsavel) || 'sem-responsavel';
            if (!porFiscal[chaveFiscal]) porFiscal[chaveFiscal] = { nome: p.responsavel || 'Sem responsável', totalProcessos: 0, multasGeradas: 0, totalValor: 0 };
            porFiscal[chaveFiscal].totalProcessos++;
            if (p.valor > 0) {
                porFiscal[chaveFiscal].multasGeradas++;
                porFiscal[chaveFiscal].totalValor += p.valor;
                totalValorMultas += p.valor;
            }
        });

        return { totalProcessos: totalProcessos, totalValorMultas: totalValorMultas, porFiscal: porFiscal };
    }

    // ---------------------------------------------------------------------------
    // controle_multas_fazenda (SEMAC) — registro manual/importado (camada de correção
    // + tabela de baixo da tela, sempre carregada por completo, sem filtro de período)
    // ---------------------------------------------------------------------------
    async function carregarTodasMultasFazenda() {
        var { data, error } = await supabaseClient
            .from('controle_multas_fazenda')
            .select('*')
            .order('data_envio_fazenda', { ascending: false });
        if (error) {
            console.error('[Apuração de Dados] Erro ao carregar controle completo:', error.message);
            _apuracaoTodasMultas = [];
            return;
        }
        _apuracaoTodasMultas = data || [];
    }

    // ---------------------------------------------------------------------------
    // CARREGAMENTO PRINCIPAL
    // ---------------------------------------------------------------------------
    // Preenche o select de ano (ano atual + 4 anteriores) e, se o usuário editar as datas
    // na mão, volta o select pra "Personalizado" — evita mostrar um ano selecionado que já
    // não corresponde mais ao período de fato filtrado.
    function prepararFiltroAnoApuracao() {
        var select = document.getElementById('apuracao-filtro-ano');
        if (!select || select.options.length > 1) return; // já preparado
        var anoAtual = new Date().getFullYear();
        for (var ano = anoAtual; ano >= anoAtual - 4; ano--) {
            var opt = document.createElement('option');
            opt.value = String(ano);
            opt.textContent = String(ano);
            select.appendChild(opt);
        }
        ['apuracao-data-inicio', 'apuracao-data-fim'].forEach(function (id) {
            var input = document.getElementById(id);
            if (input) input.addEventListener('change', function () { select.value = ''; });
        });
    }

    window.aplicarFiltroAnoApuracao = function aplicarFiltroAnoApuracao(ano) {
        if (!ano) return; // "Personalizado" — não mexe nas datas já escolhidas
        var inputInicio = document.getElementById('apuracao-data-inicio');
        var inputFim = document.getElementById('apuracao-data-fim');
        if (inputInicio) inputInicio.value = ano + '-01-01';
        if (inputFim) inputFim.value = ano + '-12-31';
        carregarApuracaoDados();
    };

    window.carregarApuracaoDados = async function carregarApuracaoDados() {
        prepararFiltroAnoApuracao();
        var inputInicio = document.getElementById('apuracao-data-inicio');
        var inputFim = document.getElementById('apuracao-data-fim');
        if (inputInicio && !inputInicio.value) {
            var hoje = new Date();
            var inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
            inputInicio.value = inicioMes.toISOString().slice(0, 10);
        }
        if (inputFim && !inputFim.value) {
            inputFim.value = new Date().toISOString().slice(0, 10);
        }
        var dataInicio = inputInicio ? inputInicio.value : '';
        var dataFim = inputFim ? inputFim.value : '';

        try {
            // Só cria linhas pros PA que ainda não existem na tabela — não sobrescreve nada.
            await sincronizarProcessosFaltantesDoFluxograma(dataInicio, dataFim);
            await carregarTodasMultasFazenda();
            renderizarApuracaoDados(calcularAgregadosApuracao(dataInicio, dataFim));
        } catch (err) {
            console.error('[Apuração de Dados] Erro ao carregar:', err);
        }

        renderizarTabelaMultasFazenda();
    };

    function renderizarApuracaoDados(dadosAgregados) {
        var totalProcessos = dadosAgregados.totalProcessos || 0;
        var porFiscal = dadosAgregados.porFiscal || {};
        var totalMultasValor = dadosAgregados.totalValorMultas || 0;
        var fiscaisAtivos = Object.keys(porFiscal).length;
        var fiscaisComMulta = Object.values(porFiscal).filter(function (f) { return f.totalValor > 0; }).length;
        var mediaMultaFiscal = fiscaisComMulta > 0 ? (totalMultasValor / fiscaisComMulta) : 0;
        var mediaProcFiscal = fiscaisAtivos > 0 ? (totalProcessos / fiscaisAtivos) : 0;

        // KPIs
        setTextoEl('apuracao-kpi-total-processos', totalProcessos);
        setTextoEl('apuracao-kpi-total-multas', formatarMoeda(totalMultasValor));
        setTextoEl('apuracao-kpi-fiscais-ativos', fiscaisAtivos);
        setTextoEl('apuracao-kpi-media-proc', 'Média: ' + mediaProcFiscal.toFixed(1) + ' proc/fiscal');
        setTextoEl('apuracao-kpi-media-multa', formatarMoeda(mediaMultaFiscal));

        // Gráficos (mesma fonte/mesma chave de fiscal para os dois — sem risco de nomes não baterem)
        renderizarGraficoProcessos(porFiscal);
        renderizarGraficoMultas(porFiscal);

        // Tabela de detalhamento
        renderizarTabelaDetalhamento(porFiscal, totalMultasValor);
    }

    function setTextoEl(id, texto) {
        var el = document.getElementById(id);
        if (el) el.textContent = texto;
    }

    var CORES_GRAFICO = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1'];

    function renderizarGraficoProcessos(porFiscal) {
        var canvas = document.getElementById('apuracao-grafico-processos');
        if (!canvas || typeof Chart === 'undefined') return;
        if (_apuracaoChartProcessos) _apuracaoChartProcessos.destroy();

        var ordenado = Object.values(porFiscal).sort(function (a, b) { return b.totalProcessos - a.totalProcessos; });

        _apuracaoChartProcessos = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: ordenado.map(function (f) { return f.nome.split(' ')[0]; }),
                datasets: [{
                    label: 'Processos',
                    data: ordenado.map(function (f) { return f.totalProcessos; }),
                    backgroundColor: ordenado.map(function (_, i) { return CORES_GRAFICO[i % CORES_GRAFICO.length]; }),
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: { title: function (ctx) { return ordenado[ctx[0].dataIndex].nome; } },
                        backgroundColor: 'rgba(15, 23, 42, 0.9)', padding: 12, cornerRadius: 8
                    }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 11 }, color: '#64748b' } },
                    x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#64748b' } }
                }
            }
        });
    }

    function renderizarGraficoMultas(porFiscal) {
        var canvas = document.getElementById('apuracao-grafico-multas');
        if (!canvas || typeof Chart === 'undefined') return;
        if (_apuracaoChartMultas) _apuracaoChartMultas.destroy();

        var ordenado = Object.values(porFiscal).sort(function (a, b) { return b.totalValor - a.totalValor; });

        _apuracaoChartMultas = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: ordenado.map(function (f) { return f.nome.split(' ')[0]; }),
                datasets: [{
                    label: 'Valor de Multas (R$)',
                    data: ordenado.map(function (f) { return f.totalValor; }),
                    backgroundColor: ordenado.map(function (_, i) { return CORES_GRAFICO[(i + 3) % CORES_GRAFICO.length]; }),
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title: function (ctx) { return ordenado[ctx[0].dataIndex].nome; },
                            label: function (ctx) { return formatarMoeda(ctx.parsed.y); }
                        },
                        backgroundColor: 'rgba(15, 23, 42, 0.9)', padding: 12, cornerRadius: 8
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' },
                        ticks: { font: { size: 11 }, color: '#64748b', callback: function (v) { return 'R$ ' + v.toLocaleString('pt-BR'); } }
                    },
                    x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#64748b' } }
                }
            }
        });
    }

    function renderizarTabelaDetalhamento(porFiscal, totalMultasValor) {
        var tbody = document.getElementById('apuracao-tabela-fiscais-body');
        if (!tbody) return;

        var linhas = Object.values(porFiscal).slice();
        linhas.sort(function (a, b) { return b.totalValor - a.totalValor || b.totalProcessos - a.totalProcessos; });

        if (linhas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="padding:20px; text-align:center; color:#94a3b8;">Nenhum dado no período selecionado.</td></tr>';
            return;
        }

        var html = '';
        linhas.forEach(function (l) {
            var pct = totalMultasValor > 0 ? ((l.totalValor / totalMultasValor) * 100).toFixed(1) : '0.0';
            html += '<tr style="border-bottom:1px solid #f1f5f9;">';
            html += '<td style="padding:8px 10px; font-weight:600; color:#1e293b;">' + escapeHtmlApuracao(l.nome) + '</td>';
            html += '<td style="padding:8px 10px; color:#3b82f6; font-weight:700;">' + l.totalProcessos + '</td>';
            html += '<td style="padding:8px 10px;">' + l.multasGeradas + '</td>';
            html += '<td style="padding:8px 10px; color:#16a34a; font-weight:700;">' + formatarMoeda(l.totalValor) + '</td>';
            html += '<td style="padding:8px 10px;"><span style="background:#f1f5f9; padding:3px 8px; border-radius:20px; font-size:12px; font-weight:600;">' + pct + '%</span></td>';
            html += '</tr>';
        });
        tbody.innerHTML = html;
    }

    // ---------------------------------------------------------------------------
    // TABELA DE BAIXO: registro completo (controle_multas_fazenda), com CRUD
    // ---------------------------------------------------------------------------
    var CAMPOS_MULTA_FAZENDA = [
        { chave: 'data_envio_fazenda', label: 'DATA ENVIO PARA A FAZENDA', tipo: 'data' },
        { chave: 'numero_processo', label: 'PROCESSO ADMINISTRATIVO/AUTO DE INFRAÇÃO', tipo: 'texto' },
        { chave: 'tipo_fiscalizacao', label: 'MEIO AMBIENTE OU FISCALIZAÇÃO DE POSTURAS', tipo: 'texto' },
        { chave: 'nome_razao_social', label: 'NOME/RAZÃO SOCIAL', tipo: 'texto' },
        { chave: 'cpf_cnpj', label: 'CPF/CNPJ', tipo: 'texto' },
        { chave: 'valor_multa', label: 'VALOR MULTA', tipo: 'valor' },
        { chave: 'data_vencimento', label: 'DATA VENCIMENTO', tipo: 'data' },
        { chave: 'numero_ar', label: 'Nº AR', tipo: 'texto' },
        { chave: 'numero_processo_betha', label: 'Nº PROCESSO BETHA', tipo: 'texto' },
        { chave: 'responsavel', label: 'RESPONSÁVEL', tipo: 'texto' },
        { chave: 'defesa', label: 'DEFESA', tipo: 'texto' },
        { chave: 'observacoes', label: 'OBSERVAÇÕES', tipo: 'texto' }
    ];

    function renderizarTabelaMultasFazenda() {
        var tbody = document.getElementById('apuracao-tabela-multas-body');
        if (!tbody) return;

        if (_apuracaoTodasMultas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="13" style="padding:20px; text-align:center; color:#94a3b8;">Nenhum registro ainda. Use "Nova Linha" ou importe a planilha.</td></tr>';
            return;
        }

        var html = '';
        _apuracaoTodasMultas.forEach(function (m) {
            var naoConferido = m.origem === 'fluxograma';
            html += '<tr style="border-bottom:1px solid #f1f5f9;' + (naoConferido ? ' background:#fffbeb;' : '') + '">';
            html += '<td style="padding:7px 10px;">' + (m.data_envio_fazenda ? formatarDataExibicao(m.data_envio_fazenda) : '-') + '</td>';
            html += '<td style="padding:7px 10px; font-weight:600;">' + escapeHtmlApuracao(m.numero_processo);
            if (naoConferido) html += ' <span title="Criado automaticamente pela sincronização com o Fluxograma — ainda não conferido" style="background:#fef3c7; color:#92400e; font-size:10px; font-weight:700; padding:1px 5px; border-radius:6px; margin-left:4px;">NÃO CONFERIDO</span>';
            html += '</td>';
            html += '<td style="padding:7px 10px;">' + escapeHtmlApuracao(m.tipo_fiscalizacao) + '</td>';
            html += '<td style="padding:7px 10px;">' + escapeHtmlApuracao(m.nome_razao_social) + '</td>';
            html += '<td style="padding:7px 10px;">' + escapeHtmlApuracao(m.cpf_cnpj) + '</td>';
            html += '<td style="padding:7px 10px; color:#16a34a; font-weight:600;">' + formatarMoeda(m.valor_multa) + '</td>';
            html += '<td style="padding:7px 10px;">' + (m.data_vencimento ? formatarDataExibicao(m.data_vencimento) : '-') + '</td>';
            html += '<td style="padding:7px 10px;">' + escapeHtmlApuracao(m.numero_ar) + '</td>';
            html += '<td style="padding:7px 10px;">' + escapeHtmlApuracao(m.numero_processo_betha) + '</td>';
            html += '<td style="padding:7px 10px;">' + escapeHtmlApuracao(m.responsavel) + '</td>';
            html += '<td style="padding:7px 10px; max-width:160px; white-space:normal;">' + escapeHtmlApuracao(m.defesa) + '</td>';
            html += '<td style="padding:7px 10px; max-width:160px; white-space:normal;">' + escapeHtmlApuracao(m.observacoes) + '</td>';
            html += '<td style="padding:7px 10px; white-space:nowrap;">';
            html += '<button onclick="abrirModalNovaMultaFazenda(\'' + m.id + '\')" title="Editar" style="background:none; border:none; cursor:pointer; color:#3b82f6; padding:4px;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>';
            html += '<button onclick="excluirMultaFazenda(\'' + m.id + '\')" title="Excluir" style="background:none; border:none; cursor:pointer; color:#ef4444; padding:4px;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>';
            html += '</td>';
            html += '</tr>';
        });
        tbody.innerHTML = html;
    }

    function formatarDataExibicao(dataIso) {
        if (!dataIso) return '-';
        var partes = String(dataIso).substring(0, 10).split('-');
        if (partes.length !== 3) return dataIso;
        return partes[2] + '/' + partes[1] + '/' + partes[0];
    }

    // ---------------------------------------------------------------------------
    // MODAL "NOVA LINHA" / EDIÇÃO
    // ---------------------------------------------------------------------------
    window.abrirModalNovaMultaFazenda = async function abrirModalNovaMultaFazenda(idEdicao) {
        _apuracaoMultaEditandoId = idEdicao || null;
        var registro = idEdicao ? _apuracaoTodasMultas.find(function (m) { return m.id === idEdicao; }) : null;
        var listaFiscaisSemac = await buscarFiscaisSemac();

        var html = '<div class="modal-overlay ativo" id="modal-multa-fazenda" onclick="if(event.target===this)fecharModal(\'modal-multa-fazenda\')">';
        html += '<div class="modal-container" style="max-width:560px;">';
        html += '<div class="modal-header"><h2>' + (idEdicao ? 'Editar Registro' : 'Nova Linha — Controle de Multas') + '</h2>';
        html += '<button class="modal-close" onclick="fecharModal(\'modal-multa-fazenda\')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
        html += '</div><div class="modal-body">';

        html += campoModal('Data de Envio para a Fazenda', 'mf-data-envio', 'date', registro ? (registro.data_envio_fazenda || '') : '');
        html += campoModal('Processo Administrativo / Auto de Infração (PA)', 'mf-numero-processo', 'text', registro ? (registro.numero_processo || '') : '', 'Ex: 2026/000123');
        html += '<div class="campo-grupo"><label>Meio Ambiente ou Fiscalização de Posturas</label><select id="mf-tipo-fiscalizacao" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:10px; font-size:14px; background:#f8fafc;">';
        html += '<option value="">Selecione...</option>';
        html += '<option value="Meio Ambiente"' + (registro && registro.tipo_fiscalizacao === 'Meio Ambiente' ? ' selected' : '') + '>Meio Ambiente</option>';
        html += '<option value="Fiscalização de Posturas"' + (registro && registro.tipo_fiscalizacao === 'Fiscalização de Posturas' ? ' selected' : '') + '>Fiscalização de Posturas</option>';
        html += '</select></div>';
        html += campoModal('Nome / Razão Social', 'mf-nome', 'text', registro ? (registro.nome_razao_social || '') : '');
        html += campoModal('CPF/CNPJ', 'mf-cpf-cnpj', 'text', registro ? (registro.cpf_cnpj || '') : '');
        html += campoModal('Valor da Multa (R$)', 'mf-valor', 'text', registro ? (registro.valor_multa != null ? String(registro.valor_multa).replace('.', ',') : '') : '', 'Ex: 1050,00');
        html += campoModal('Data de Vencimento', 'mf-data-vencimento', 'date', registro ? (registro.data_vencimento || '') : '');
        html += campoModal('Nº AR (Aviso de Recebimento)', 'mf-numero-ar', 'text', registro ? (registro.numero_ar || '') : '');
        html += campoModal('Nº Processo BETHA', 'mf-numero-betha', 'text', registro ? (registro.numero_processo_betha || '') : '');
        html += construirCampoResponsavel(listaFiscaisSemac, registro ? (registro.responsavel || '') : '');
        html += '<div class="campo-grupo"><label>Defesa</label><textarea id="mf-defesa" rows="2">' + escapeHtmlApuracao(registro ? registro.defesa : '') + '</textarea></div>';
        html += '<div class="campo-grupo"><label>Observações</label><textarea id="mf-observacoes" rows="2">' + escapeHtmlApuracao(registro ? registro.observacoes : '') + '</textarea></div>';

        html += '</div><div class="modal-footer"><button class="btn-cancelar" onclick="fecharModal(\'modal-multa-fazenda\')">Cancelar</button>';
        html += '<button id="btn-salvar-multa-fazenda" class="btn-salvar" onclick="salvarMultaFazenda()">' + (idEdicao ? 'Salvar Alterações' : 'Adicionar') + '</button></div></div></div>';

        document.body.insertAdjacentHTML('beforeend', html);
    };

    function campoModal(label, id, tipo, valor, placeholder) {
        return '<div class="campo-grupo"><label>' + label + '</label><input type="' + tipo + '" id="' + id + '" value="' + escapeHtmlApuracao(valor) + '"' + (placeholder ? ' placeholder="' + placeholder + '"' : '') + ' style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:10px; font-size:14px; box-sizing:border-box;"></div>';
    }

    // Select de "Responsável" com os fiscais cadastrados + opção de digitar manualmente
    // pra quem não está na lista (ex: alguém que ainda não tem cadastro no sistema).
    function construirCampoResponsavel(listaFiscaisSemac, valorAtual) {
        // Correspondência aproximada (não só nome idêntico) — se o valor salvo for só "LUIZ"
        // em vez do nome completo, isso já acha e pré-seleciona o fiscal certo no dropdown.
        var fiscalCorrespondente = listaFiscaisSemac.find(function (f) { return f.full_name === valorAtual; })
            || encontrarFiscalPorResponsavel(valorAtual, listaFiscaisSemac);
        var ehOutro = valorAtual && !fiscalCorrespondente;

        var html = '<div class="campo-grupo"><label>Responsável</label>';
        html += '<select id="mf-responsavel" onchange="document.getElementById(\'mf-responsavel-outro-wrap\').style.display = this.value===\'__outro__\' ? \'block\' : \'none\';" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:10px; font-size:14px; background:#f8fafc; box-sizing:border-box;">';
        html += '<option value="">Selecione...</option>';
        listaFiscaisSemac.forEach(function (f) {
            html += '<option value="' + f.id + '"' + (fiscalCorrespondente && fiscalCorrespondente.id === f.id ? ' selected' : '') + '>' + escapeHtmlApuracao(f.full_name) + '</option>';
        });
        html += '<option value="__outro__"' + (ehOutro ? ' selected' : '') + '>Outro (não está na lista)</option>';
        html += '</select>';
        html += '<div id="mf-responsavel-outro-wrap" style="display:' + (ehOutro ? 'block' : 'none') + '; margin-top:6px;">';
        html += '<input type="text" id="mf-responsavel-outro" value="' + escapeHtmlApuracao(ehOutro ? valorAtual : '') + '" placeholder="Digite o nome" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:10px; font-size:14px; box-sizing:border-box;">';
        html += '</div></div>';
        return html;
    }

    function lerResponsavelSelecionado() {
        var select = document.getElementById('mf-responsavel');
        if (!select || !select.value) return '';
        if (select.value === '__outro__') {
            var outro = document.getElementById('mf-responsavel-outro');
            return outro ? outro.value.trim() : '';
        }
        var fiscal = (_apuracaoCacheFiscais || []).find(function (f) { return f.id === select.value; });
        return fiscal ? fiscal.full_name : '';
    }

    window.salvarMultaFazenda = async function salvarMultaFazenda() {
        var btn = document.getElementById('btn-salvar-multa-fazenda');
        if (btn && btn.disabled) return;

        var numeroProcesso = (document.getElementById('mf-numero-processo').value || '').trim();
        var dataEnvio = document.getElementById('mf-data-envio').value || null;
        var valorMulta = parseValorBR(document.getElementById('mf-valor').value);

        if (!numeroProcesso) { alert('Preencha o Processo Administrativo / Auto de Infração (PA).'); return; }
        if (!dataEnvio) { alert('Preencha a Data de Envio para a Fazenda.'); return; }

        if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

        try {
            // Verificação de duplicata por PA + valor da multa (ignora o próprio registro
            // quando em edição) — o mesmo PA pode legitimamente ter mais de uma multa com
            // valores diferentes, então só bloqueia quando PA e valor são iguais.
            var queryDup = supabaseClient.from('controle_multas_fazenda').select('id')
                .eq('numero_processo', numeroProcesso).eq('valor_multa', valorMulta);
            if (_apuracaoMultaEditandoId) queryDup = queryDup.neq('id', _apuracaoMultaEditandoId);
            var { data: existentes } = await queryDup;
            if (existentes && existentes.length > 0) {
                alert('Já existe um registro para o PA "' + numeroProcesso + '" com esse mesmo valor de multa. Se for uma multa diferente, confira se o valor está certo; se for a mesma, edite o registro existente em vez de duplicar.');
                return;
            }

            var payload = {
                data_envio_fazenda: dataEnvio,
                numero_processo: numeroProcesso,
                tipo_fiscalizacao: document.getElementById('mf-tipo-fiscalizacao').value || null,
                nome_razao_social: (document.getElementById('mf-nome').value || '').trim(),
                cpf_cnpj: (document.getElementById('mf-cpf-cnpj').value || '').trim(),
                valor_multa: valorMulta,
                data_vencimento: document.getElementById('mf-data-vencimento').value || null,
                numero_ar: (document.getElementById('mf-numero-ar').value || '').trim(),
                numero_processo_betha: (document.getElementById('mf-numero-betha').value || '').trim(),
                responsavel: lerResponsavelSelecionado(),
                defesa: (document.getElementById('mf-defesa').value || '').trim(),
                observacoes: (document.getElementById('mf-observacoes').value || '').trim(),
                origem: 'manual' // criar ou editar na tela sempre conta como conferido por alguém
            };

            var result;
            if (_apuracaoMultaEditandoId) {
                result = await supabaseClient.from('controle_multas_fazenda').update(payload).eq('id', _apuracaoMultaEditandoId);
            } else {
                payload.created_by = window.userIdGlobal || null;
                result = await supabaseClient.from('controle_multas_fazenda').insert([payload]);
            }
            if (result.error) throw result.error;

            fecharModal('modal-multa-fazenda');
            await carregarApuracaoDados();
        } catch (err) {
            console.error('[Apuração de Dados] Erro ao salvar:', err);
            alert('Não foi possível salvar. Tente novamente.');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = _apuracaoMultaEditandoId ? 'Salvar Alterações' : 'Adicionar'; }
        }
    };

    window.excluirMultaFazenda = async function excluirMultaFazenda(id) {
        if (!confirm('Excluir este registro do controle de multas? Essa ação não pode ser desfeita.')) return;
        var { error } = await supabaseClient.from('controle_multas_fazenda').delete().eq('id', id);
        if (error) {
            alert('Não foi possível excluir: ' + error.message);
            return;
        }
        await carregarApuracaoDados();
    };

    // ---------------------------------------------------------------------------
    // EXPORTAÇÃO CSV (registro completo)
    // ---------------------------------------------------------------------------
    // Corrige em massa o campo "Responsável" dos registros JÁ importados (ex: planilha
    // antiga que entrou com "LUIZ"/"MARIELLE" em vez do nome completo) — sem precisar editar
    // linha por linha. Resolve sozinho o que bate com certeza; o que for ambíguo/sem
    // correspondência, pergunta ao usuário (mesmo modal da importação), aplicando a escolha
    // a TODOS os registros que tiverem aquele texto exato.
    window.corrigirResponsaveisExistentes = async function corrigirResponsaveisExistentes() {
        if (_apuracaoTodasMultas.length === 0) {
            alert('Não há registros no controle pra corrigir.');
            return;
        }

        var listaFiscaisSemac = await buscarFiscaisSemac();

        // Textos que já são exatamente o nome completo de um fiscal não precisam de nada.
        var nomesCompletos = new Set(listaFiscaisSemac.map(function (f) { return f.full_name; }));
        var textosDistintos = new Set();
        _apuracaoTodasMultas.forEach(function (m) {
            var texto = (m.responsavel || '').trim();
            if (texto && !nomesCompletos.has(texto)) textosDistintos.add(texto);
        });

        if (textosDistintos.size === 0) {
            alert('Todos os responsáveis já estão com o nome completo do cadastro — nada pra corrigir.');
            return;
        }

        var resolucoesAutomaticas = {};
        var pendentes = [];
        var contagemPorTexto = {};
        _apuracaoTodasMultas.forEach(function (m) {
            var texto = (m.responsavel || '').trim();
            if (texto) contagemPorTexto[texto] = (contagemPorTexto[texto] || 0) + 1;
        });

        textosDistintos.forEach(function (texto) {
            var fiscalAuto = encontrarFiscalPorResponsavel(texto, listaFiscaisSemac);
            if (fiscalAuto) {
                resolucoesAutomaticas[texto] = fiscalAuto.full_name;
            } else {
                var candidatos = candidatosPorResponsavel(texto, listaFiscaisSemac);
                pendentes.push({ texto: texto, ocorrencias: contagemPorTexto[texto] || 0, candidatos: candidatos });
            }
        });

        var mapaManual = {};
        if (pendentes.length > 0) {
            mapaManual = await new Promise(function (resolve) {
                abrirModalResolverResponsaveis(pendentes, listaFiscaisSemac, resolve);
            });
            if (mapaManual === null) {
                // Usuário cancelou a parte manual — ainda aplica as correções automáticas que já achou.
                mapaManual = {};
            }
        }

        var mapaFinal = Object.assign({}, resolucoesAutomaticas, mapaManual);
        var textosParaAtualizar = Object.keys(mapaFinal).filter(function (texto) { return mapaFinal[texto] && mapaFinal[texto] !== texto; });

        if (textosParaAtualizar.length === 0) {
            alert('Nada pra atualizar — nenhum nome foi resolvido pra um cadastro diferente do que já estava.');
            return;
        }

        var atualizados = 0;
        for (var i = 0; i < textosParaAtualizar.length; i++) {
            var textoOriginal = textosParaAtualizar[i];
            var nomeFinal = mapaFinal[textoOriginal];
            var { data, error } = await supabaseClient
                .from('controle_multas_fazenda')
                .update({ responsavel: nomeFinal })
                .eq('responsavel', textoOriginal)
                .select('id');
            if (error) {
                console.error('[Apuração de Dados] Erro ao corrigir responsável "' + textoOriginal + '":', error.message);
                continue;
            }
            atualizados += (data || []).length;
        }

        alert(atualizados + ' registro(s) atualizado(s) com o nome completo do responsável.');
        await carregarApuracaoDados();
    };

    window.baixarCSVMultasFazenda = function baixarCSVMultasFazenda() {
        if (_apuracaoTodasMultas.length === 0) {
            alert('Não há registros para exportar.');
            return;
        }
        var linhas = [];
        linhas.push(CAMPOS_MULTA_FAZENDA.map(function (c) { return '"' + c.label + '"'; }).join(';'));

        _apuracaoTodasMultas.forEach(function (reg) {
            var linha = CAMPOS_MULTA_FAZENDA.map(function (c) {
                var val = reg[c.chave];
                if (c.tipo === 'data') val = val ? formatarDataExibicao(val) : '';
                else if (c.tipo === 'valor') val = val != null ? String(val).replace('.', ',') : '0,00';
                val = (val === null || val === undefined) ? '' : String(val);
                val = val.replace(/"/g, '""');
                return '"' + val + '"';
            }).join(';');
            linhas.push(linha);
        });

        var csv = '﻿' + linhas.join('\r\n');
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = 'controle_multas_fazenda_' + new Date().toISOString().slice(0, 10) + '.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // ---------------------------------------------------------------------------
    // IMPORTAÇÃO CSV (planilha de controle)
    // ---------------------------------------------------------------------------
    function normalizarCabecalho(h) {
        return (h || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/º|°/g, '').toUpperCase().trim();
    }

    function mapearColuna(cabecalhoNormalizado) {
        var h = cabecalhoNormalizado;
        if (h.indexOf('BETHA') !== -1) return 'numero_processo_betha';
        if (h.indexOf('PROCESSO') !== -1 && (h.indexOf('ADMINISTRATIVO') !== -1 || h.indexOf('AUTO') !== -1 || h.indexOf('INFRA') !== -1)) return 'numero_processo';
        if (h.indexOf('FAZENDA') !== -1 || (h.indexOf('DATA') !== -1 && h.indexOf('ENVIO') !== -1)) return 'data_envio_fazenda';
        if (h.indexOf('MEIO AMBIENTE') !== -1 || h.indexOf('POSTURAS') !== -1 || h.indexOf('FISCALIZACAO') !== -1) return 'tipo_fiscalizacao';
        if (h.indexOf('RAZAO SOCIAL') !== -1 || h === 'NOME' || h.indexOf('NOME/') !== -1) return 'nome_razao_social';
        if (h.indexOf('CPF') !== -1 || h.indexOf('CNPJ') !== -1) return 'cpf_cnpj';
        if (h.indexOf('VALOR') !== -1 && h.indexOf('MULTA') !== -1) return 'valor_multa';
        if (h.indexOf('VENCIMENTO') !== -1) return 'data_vencimento';
        if (h === 'AR' || h === 'N AR' || h === 'NO AR' || h.indexOf('AVISO') !== -1) return 'numero_ar';
        if (h.indexOf('RESPONSAVEL') !== -1) return 'responsavel';
        if (h.indexOf('DEFESA') !== -1) return 'defesa';
        if (h.indexOf('OBSERVA') !== -1) return 'observacoes';
        return null;
    }

    // A planilha real costuma ter uma linha de título mesclada ANTES do cabeçalho de
    // verdade (ex: "PROCESSOS ENVIADOS PARA FAZENDA – AUTO DE INFRAÇÃO..."). Em vez de
    // assumir que a primeira linha é sempre o cabeçalho, procura nas primeiras linhas
    // qual delas realmente parece um cabeçalho (bate com o PA + pelo menos mais 1 coluna
    // reconhecida — evita confundir uma linha de dado qualquer com o cabeçalho).
    function localizarIndiceCabecalho(todasAsLinhas) {
        var limite = Math.min(todasAsLinhas.length, 10);
        for (var i = 0; i < limite; i++) {
            var mapeado = (todasAsLinhas[i] || []).map(function (c) { return mapearColuna(normalizarCabecalho(String(c || ''))); });
            var reconhecidas = mapeado.filter(Boolean).length;
            if (mapeado.indexOf('numero_processo') !== -1 && reconhecidas >= 2) return i;
        }
        return -1;
    }

    // Parser simples de linha CSV com suporte a campos entre aspas
    function parseLinhaCsv(linha, delimitador) {
        var campos = [];
        var atual = '';
        var dentroAspas = false;
        for (var i = 0; i < linha.length; i++) {
            var ch = linha[i];
            if (ch === '"') {
                if (dentroAspas && linha[i + 1] === '"') { atual += '"'; i++; }
                else dentroAspas = !dentroAspas;
            } else if (ch === delimitador && !dentroAspas) {
                campos.push(atual); atual = '';
            } else {
                atual += ch;
            }
        }
        campos.push(atual);
        return campos.map(function (c) { return c.trim(); });
    }

    function mostrarStatusImportacao(html, cor) {
        var el = document.getElementById('apuracao-import-status');
        if (!el) return;
        el.style.display = 'block';
        el.style.background = cor === 'erro' ? '#fef2f2' : (cor === 'alerta' ? '#fffbeb' : '#f0fdf4');
        el.style.color = cor === 'erro' ? '#b91c1c' : (cor === 'alerta' ? '#92400e' : '#166534');
        el.innerHTML = html;
    }

    // Olha todos os textos distintos da coluna "Responsável" nas linhas a importar e separa
    // os que batem com segurança (exatamente 1 candidato) dos que precisam de confirmação
    // (ambíguos ou sem nenhum candidato). Se não sobrar nenhum pendente, resolve na hora sem
    // mostrar nada pro usuário. Retorna um mapa texto-digitado -> nome final escolhido (só
    // para os textos que o usuário de fato trocou); null se o usuário cancelar a importação.
    function resolverResponsaveisPendentes(registrosBrutos, listaFiscaisSemac) {
        var contagem = {};
        registrosBrutos.forEach(function (r) {
            var texto = (r.responsavel || '').toString().trim();
            if (texto) contagem[texto] = (contagem[texto] || 0) + 1;
        });

        var pendentes = [];
        Object.keys(contagem).forEach(function (texto) {
            var candidatos = candidatosPorResponsavel(texto, listaFiscaisSemac);
            if (candidatos.length !== 1) {
                pendentes.push({ texto: texto, ocorrencias: contagem[texto], candidatos: candidatos });
            }
        });

        if (pendentes.length === 0) return Promise.resolve({});

        return new Promise(function (resolve) {
            abrirModalResolverResponsaveis(pendentes, listaFiscaisSemac, resolve);
        });
    }

    function abrirModalResolverResponsaveis(pendentes, listaFiscaisSemac, resolve) {
        var html = '<div class="modal-overlay ativo" id="modal-resolver-responsaveis">';
        html += '<div class="modal-container" style="max-width:560px;">';
        html += '<div class="modal-header"><h2>Confirme os responsáveis</h2></div>';
        html += '<div class="modal-body">';
        html += '<p style="color:#64748b; font-size:13px; margin:0 0 14px;">Não dá pra saber com certeza quem é o fiscal responsável nestes nomes da planilha. Escolha o cadastro certo pra cada um (ou deixe como está digitado).</p>';

        pendentes.forEach(function (item, idx) {
            var motivo = item.candidatos.length > 1 ? 'bate com mais de um cadastro' : 'não achei ninguém parecido no cadastro';
            html += '<div class="campo-grupo"><label>"' + escapeHtmlApuracao(item.texto) + '" — ' + item.ocorrencias + ' linha(s), ' + motivo + '</label>';
            html += '<select id="resolver-resp-' + idx + '" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:10px; font-size:14px; background:#f8fafc; box-sizing:border-box;">';
            html += '<option value="">Manter como está: "' + escapeHtmlApuracao(item.texto) + '"</option>';
            listaFiscaisSemac.forEach(function (f) {
                var sel = (item.candidatos.length === 1 && item.candidatos[0].id === f.id) ? ' selected' : '';
                html += '<option value="' + f.id + '"' + sel + '>' + escapeHtmlApuracao(f.full_name) + '</option>';
            });
            html += '</select></div>';
        });

        html += '</div><div class="modal-footer">';
        html += '<button class="btn-cancelar" id="btn-cancelar-resolver-responsaveis">Cancelar Importação</button>';
        html += '<button class="btn-salvar" id="btn-confirmar-resolver-responsaveis">Confirmar e Importar</button>';
        html += '</div></div></div>';

        document.body.insertAdjacentHTML('beforeend', html);

        document.getElementById('btn-cancelar-resolver-responsaveis').addEventListener('click', function () {
            fecharModal('modal-resolver-responsaveis');
            resolve(null);
        });
        document.getElementById('btn-confirmar-resolver-responsaveis').addEventListener('click', function () {
            var mapa = {};
            pendentes.forEach(function (item, idx) {
                var select = document.getElementById('resolver-resp-' + idx);
                var escolhidoId = select ? select.value : '';
                if (escolhidoId) {
                    var fiscal = listaFiscaisSemac.find(function (f) { return f.id === escolhidoId; });
                    if (fiscal) mapa[item.texto] = fiscal.full_name;
                }
            });
            fecharModal('modal-resolver-responsaveis');
            resolve(mapa);
        });
    }

    window.importarPlanilhaMultasFazenda = function importarPlanilhaMultasFazenda(inputEl) {
        var arquivo = inputEl.files && inputEl.files[0];
        if (!arquivo) return;

        var nomeArquivo = (arquivo.name || '').toLowerCase();
        var ehBinaria = /\.(ods|xlsx|xls)$/.test(nomeArquivo);

        var reader = new FileReader();
        reader.onload = async function (e) {
            try {
                if (ehBinaria) {
                    if (typeof XLSX === 'undefined') {
                        mostrarStatusImportacao('Biblioteca de leitura de planilha não carregou. Atualize a página e tente de novo.', 'erro');
                        return;
                    }
                    var workbook = XLSX.read(e.target.result, { type: 'array', cellDates: true });
                    var primeiraAba = workbook.SheetNames[0];
                    var linhasPlanilha = XLSX.utils.sheet_to_json(workbook.Sheets[primeiraAba], { header: 1, defval: '' });
                    linhasPlanilha = linhasPlanilha.filter(function (l) { return l.some(function (c) { return String(c).trim() !== ''; }); });
                    if (linhasPlanilha.length < 2) {
                        mostrarStatusImportacao('Planilha vazia ou sem linhas de dados.', 'alerta');
                    } else {
                        await processarLinhasMultasFazenda(linhasPlanilha);
                    }
                } else {
                    var texto = String(e.target.result).replace(/^﻿/, '');
                    var linhasCsv = texto.split(/\r\n|\n|\r/).filter(function (l) { return l.trim() !== ''; });
                    if (linhasCsv.length < 2) {
                        mostrarStatusImportacao('Planilha vazia ou sem linhas de dados.', 'alerta');
                    } else {
                        var amostra = linhasCsv.slice(0, 5).join('\n');
                        var delimitador = (amostra.split(';').length >= amostra.split(',').length) ? ';' : ',';
                        var todasAsLinhas = linhasCsv.map(function (l) { return parseLinhaCsv(l, delimitador); });
                        await processarLinhasMultasFazenda(todasAsLinhas);
                    }
                }
            } catch (err) {
                console.error('[Apuração de Dados] Erro ao importar planilha:', err);
                mostrarStatusImportacao('Erro ao processar o arquivo: ' + err.message, 'erro');
            }
            inputEl.value = ''; // Permite reimportar o mesmo arquivo depois
        };
        reader.onerror = function () {
            mostrarStatusImportacao('Não foi possível ler o arquivo.', 'erro');
            inputEl.value = '';
        };

        if (ehBinaria) reader.readAsArrayBuffer(arquivo);
        else reader.readAsText(arquivo, 'UTF-8');
    };

    // Processamento genérico: recebe o cabeçalho e as linhas já quebradas em colunas —
    // usado tanto para .csv (quebrado por parseLinhaCsv) quanto para .ods/.xlsx (via SheetJS).
    async function processarLinhasMultasFazenda(todasAsLinhas) {
        var indiceCabecalho = localizarIndiceCabecalho(todasAsLinhas);
        if (indiceCabecalho === -1) {
            mostrarStatusImportacao('Não encontrei a coluna do Processo Administrativo/Auto de Infração (PA) nas primeiras linhas da planilha. Confira se os nomes das colunas batem com os da planilha de controle.', 'erro');
            return;
        }
        var linhaCabecalho = todasAsLinhas[indiceCabecalho];
        var linhasDeDados = todasAsLinhas.slice(indiceCabecalho + 1);
        var mapaColunas = linhaCabecalho.map(function (c) { return mapearColuna(normalizarCabecalho(String(c || ''))); });
        var CAMPOS_DATA_OU_VALOR = { valor_multa: true, data_envio_fazenda: true, data_vencimento: true };

        var registrosBrutos = linhasDeDados.map(function (valores) {
            var registro = {};
            mapaColunas.forEach(function (chave, idx) {
                if (!chave) return;
                var bruto = valores[idx];
                // Datas/valor seguem "crus" (aceitam Date/number vindos do SheetJS) — os demais
                // campos de texto são normalizados pra string já aqui.
                registro[chave] = CAMPOS_DATA_OU_VALOR[chave] ? bruto : (bruto === null || bruto === undefined ? '' : String(bruto).trim());
            });
            return registro;
        });

        // Antes de importar, resolve nomes ambíguos/não encontrados em "Responsável" perguntando
        // ao usuário — evita atribuir à pessoa errada (ex: "LUIZ" x "LUIZA") e evita perder a
        // informação de quem é o responsável quando o nome na planilha está incompleto.
        var listaFiscaisSemac = await buscarFiscaisSemac();
        var mapaResolucaoResponsavel = await resolverResponsaveisPendentes(registrosBrutos, listaFiscaisSemac);
        if (mapaResolucaoResponsavel === null) {
            mostrarStatusImportacao('Importação cancelada.', 'alerta');
            return;
        }

        mostrarStatusImportacao('Importando, aguarde...', 'alerta');

        // Busca os registros já cadastrados pra cada PA (pode ter mais de um — vários Autos).
        // Três desfechos possíveis por linha da planilha:
        // 1) já existe um registro com o mesmo PA+valor -> duplicata, ignora.
        // 2) existe um registro desse PA com origem='fluxograma' (criado pela sincronização,
        //    ainda não conferido) -> a planilha ATUALIZA essa linha com o dado real.
        // 3) nenhum dos dois -> é um Auto novo mesmo, insere linha nova.
        var { data: existentesData } = await supabaseClient.from('controle_multas_fazenda').select('id, numero_processo, valor_multa, origem');
        var existentesPorPA = {};
        (existentesData || []).forEach(function (r) {
            var pa = normalizarPA(r.numero_processo);
            if (!existentesPorPA[pa]) existentesPorPA[pa] = [];
            existentesPorPA[pa].push({ id: r.id, valor: Number(r.valor_multa) || 0, origem: r.origem, consumido: false });
        });

        var linhasParaInserir = [];
        var linhasParaAtualizar = [];
        var ignoradas = 0;
        var invalidas = 0;
        var chavesNestaImportacao = new Set();

        registrosBrutos.forEach(function (registro) {
            var pa = registro.numero_processo || ''; // já veio como string "trimada" do mapeamento acima
            if (!pa) { invalidas++; return; }

            var paNorm = normalizarPA(pa);
            var valorFinal = parseValorBR(registro.valor_multa);
            var chave = paNorm + '||' + valorFinal;
            var existentesDoPA = existentesPorPA[paNorm] || [];

            var jaExisteExato = existentesDoPA.some(function (e) { return e.valor === valorFinal; });
            if (jaExisteExato || chavesNestaImportacao.has(chave)) { ignoradas++; return; }
            chavesNestaImportacao.add(chave);

            var respOriginal = (registro.responsavel || '').trim();
            var respFinal;
            if (mapaResolucaoResponsavel.hasOwnProperty(respOriginal)) {
                respFinal = mapaResolucaoResponsavel[respOriginal]; // escolhido pelo usuário no modal de ambiguidade
            } else {
                // Não era ambíguo — resolve direto pro nome do cadastro quando bate com certeza.
                var fiscalAuto = encontrarFiscalPorResponsavel(respOriginal, listaFiscaisSemac);
                respFinal = fiscalAuto ? fiscalAuto.full_name : respOriginal;
            }

            var payload = {
                data_envio_fazenda: parseDataBR(registro.data_envio_fazenda) || new Date().toISOString().slice(0, 10),
                numero_processo: pa,
                tipo_fiscalizacao: registro.tipo_fiscalizacao || null,
                nome_razao_social: registro.nome_razao_social || '',
                cpf_cnpj: registro.cpf_cnpj || '',
                valor_multa: valorFinal,
                data_vencimento: parseDataBR(registro.data_vencimento),
                numero_ar: registro.numero_ar || '',
                numero_processo_betha: registro.numero_processo_betha || '',
                responsavel: respFinal,
                defesa: registro.defesa || '',
                observacoes: registro.observacoes || '',
                origem: 'planilha'
            };

            var placeholder = existentesDoPA.find(function (e) { return !e.consumido && e.origem === 'fluxograma'; });
            if (placeholder) {
                placeholder.consumido = true;
                linhasParaAtualizar.push({ id: placeholder.id, payload: payload });
            } else {
                payload.created_by = window.userIdGlobal || null;
                linhasParaInserir.push(payload);
            }
        });

        var inseridos = 0;
        if (linhasParaInserir.length > 0) {
            // Insere em lotes de 200 para não estourar o payload
            for (var offset = 0; offset < linhasParaInserir.length; offset += 200) {
                var lote = linhasParaInserir.slice(offset, offset + 200);
                var { error } = await supabaseClient.from('controle_multas_fazenda').insert(lote);
                if (error) {
                    console.error('[Apuração de Dados] Erro ao inserir lote da importação:', error.message);
                    mostrarStatusImportacao('Erro ao salvar parte dos registros: ' + error.message + '. ' + inseridos + ' linha(s) já foram salvas antes do erro.', 'erro');
                    await carregarApuracaoDados();
                    return;
                }
                inseridos += lote.length;
            }
        }

        var atualizadas = 0;
        for (var i = 0; i < linhasParaAtualizar.length; i++) {
            var item = linhasParaAtualizar[i];
            var { error: errUpd } = await supabaseClient.from('controle_multas_fazenda').update(item.payload).eq('id', item.id);
            if (errUpd) { console.error('[Apuração de Dados] Erro ao atualizar PA sincronizado automaticamente:', errUpd.message); continue; }
            atualizadas++;
        }

        var resumo = inseridos + ' linha(s) importada(s).';
        if (atualizadas > 0) resumo += ' ' + atualizadas + ' linha(s) que tinham sido criadas pela sincronização foram atualizadas com o dado real da planilha.';
        if (ignoradas > 0) resumo += ' ' + ignoradas + ' ignorada(s) por já existir o mesmo PA com o mesmo valor de multa.';
        if (invalidas > 0) resumo += ' ' + invalidas + ' linha(s) sem PA preenchido foram ignoradas.';
        mostrarStatusImportacao(resumo, (ignoradas > 0 || invalidas > 0) ? 'alerta' : 'ok');

        await carregarApuracaoDados();
    }

})();
