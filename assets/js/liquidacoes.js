// liquidacoes.js - Lógica para a aba Liquidação de Recebimentos

window.liquidacoesDados = [];
var hojeLiq = new Date();
window.mesAtualLiq = hojeLiq.getMonth();
window.anoAtualLiq = hojeLiq.getFullYear();
window.dataFiltroLiqSelecionada = null; // Para filtrar os cards quando clica no calendário

const CORES_ATA = ['#ff748eff', '#F94144', '#F3722C', '#F8961E', '#F9C74F', '#66de74ff', '#43AA8B', '#00B4D8', '#0077B6', '#7209B7'];

document.addEventListener('DOMContentLoaded', function () {
    var observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            if (mutation.attributeName === 'style') {
                var aba = document.getElementById('aba-liquidacoes');
                if (aba && aba.style.display === 'block') {
                    carregarLiquidacoes();
                }
            }
        });
    });

    var abaTarget = document.getElementById('aba-liquidacoes');
    if (abaTarget) observer.observe(abaTarget, { attributes: true });
});

// Helper para ordenar por ata para as cores
function atribuirCoresAtas(lista) {
    // Ordenar atas por created_at para manter a cor consistente
    var atasAntigasPrimeiro = [...lista].reverse();
    var mapaCores = {};
    var corIndex = 0;

    atasAntigasPrimeiro.forEach(liq => {
        var ataStr = liq.ata ? liq.ata.trim().toUpperCase() : 'SEM_ATA_' + liq.id;
        if (!mapaCores[ataStr]) {
            mapaCores[ataStr] = CORES_ATA[corIndex % CORES_ATA.length];
            corIndex++;
        }
        liq._corFixa = mapaCores[ataStr];
    });
}

async function carregarLiquidacoes() {
    var container = document.getElementById('lista-liquidacoes-container');
    if (!container) return;

    container.innerHTML = '<div style="text-align: center; color: #94a3b8; padding: 40px; font-size: 1rem;">Carregando liquidações...</div>';

    try {
        var { data: liquidacoes, error } = await supabaseClient
            .from('liquidacoes')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        window.liquidacoesDados = liquidacoes || [];
        atribuirCoresAtas(window.liquidacoesDados);

        renderizarCardsLiquidacoes();
        renderizarCalendarioLiq();

    } catch (err) {
        console.error('Erro ao carregar liquidações:', err);
        container.innerHTML = '<div style="text-align: center; color: #ef4444; padding: 40px;">Erro ao carregar os dados.</div>';
    }
}

function renderizarCardsLiquidacoes() {
    var container = document.getElementById('lista-liquidacoes-container');
    if (!window.liquidacoesDados || window.liquidacoesDados.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #94a3b8; padding: 40px; font-size: 1rem;">Nenhuma liquidação registrada.</div>';
        return;
    }

    var html = '<div style="display: flex; flex-direction: column; gap: 12px;">';
    var hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    var countFiltrados = 0;

    window.liquidacoesDados.forEach(function (liq) {
        var dataRecebimento = liq.data_recebimento ? new Date(liq.data_recebimento + 'T00:00:00') : null;
        var dataVencimento = null;
        if (dataRecebimento) {
            dataVencimento = new Date(dataRecebimento);
            dataVencimento.setDate(dataVencimento.getDate() + 30);
        }

        // Filtro por data no calendário
        if (window.dataFiltroLiqSelecionada) {
            if (!dataRecebimento) return; // se não tem data de recebimento, não tem como estar no intervalo
            var inicioIso = dataRecebimento.toISOString().split('T')[0];
            var fimIso = dataVencimento.toISOString().split('T')[0];
            if (window.dataFiltroLiqSelecionada < inicioIso || window.dataFiltroLiqSelecionada > fimIso) {
                return;
            }
        }

        // Filtro por texto da barra de pesquisa
        var inputPesquisa = document.getElementById('input-pesquisa-liq');
        if (inputPesquisa && inputPesquisa.value.trim() !== '') {
            var termo = inputPesquisa.value.trim().toLowerCase();
            var textoLiq = [
                liq.ficha, liq.ata, liq.fornecedor, liq.cnpj, liq.valor, liq.nota_fiscal,
                liq.solicitacao_fornecimento, liq.empenho, liq.numero_liquidacao,
                liq.pagamento, liq.protocolo, liq.observacao
            ].join(' ').toLowerCase();

            var itensText = (liq.itens || []).map(i => (i.nome || '') + ' ' + (i.quantidade || '')).join(' ').toLowerCase();
            if (!textoLiq.includes(termo) && !itensText.includes(termo)) {
                return;
            }
        }

        countFiltrados++;

        var atrasado = false;
        if (liq.status !== 'concluida' && dataVencimento && dataVencimento < hoje) {
            atrasado = true;
        }

        var borderCor = liq._corFixa;
        var bgCor = 'white';
        var tituloCor = liq._corFixa;

        if (liq.status === 'concluida') {
            borderCor = '#16a34a';
            bgCor = '#f0fdf4';
            tituloCor = '#15803d';
        } else if (atrasado) {
            borderCor = '#dc2626';
            bgCor = '#fef2f2';
            tituloCor = '#b91c1c';
        }

        var itensTxt = '';
        if (liq.itens && liq.itens.length > 0) {
            itensTxt = '<div style="margin-top: 8px; font-size: 0.85rem; color: #475569;"><strong>Itens:</strong><ul>';
            liq.itens.forEach(function (item) {
                itensTxt += '<li>' + (item.nome || 'Item') + ' - ' + (item.quantidade || '') + ' ' + (item.unidade || '') + '</li>';
            });
            itensTxt += '</ul></div>';
        }

        html += `
            <div style="border: 1px solid ${borderCor}; border-left: 5px solid ${borderCor}; background: ${bgCor}; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); overflow: hidden;">
                <!-- Header (Always visible) -->
                <div onclick="toggleLiquidacaoDetalhes('${liq.id}')" style="padding: 16px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='rgba(0,0,0,0.02)'" onmouseout="this.style.background='transparent'">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="display:inline-block; width:12px; height:12px; background:${liq._corFixa}; border-radius:50%;"></span>
                        <div>
                            <h3 style="margin: 0 0 4px 0; color: ${tituloCor}; font-size: 1.1rem;">
                                Ata: ${liq.ata || 'Não informada'}
                            </h3>
                            <div style="font-size: 0.85rem; color: #64748b;">
                                <strong>Fornecedor:</strong> ${liq.fornecedor || '---'} ${liq.cnpj ? '<span style="font-size: 0.8rem; background: #e2e8f0; padding: 2px 6px; border-radius: 4px; margin-left: 4px;">CNPJ: ' + liq.cnpj + '</span>' : ''} | <strong>Recebimento:</strong> ${liq.data_recebimento ? formatarDataBR(liq.data_recebimento) : '---'}
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        ${liq.status !== 'concluida' ? (atrasado ? '<span style="color: #ef4444; font-size: 0.85rem; font-weight: bold;">⚠️ Atrasado</span>' : '<span style="color: #f59e0b; font-size: 0.85rem; font-weight: bold;">Pendente</span>') : '<span style="color: #16a34a; font-size: 0.85rem; font-weight: bold;">✓ Concluída</span>'}
                        <svg id="icone-expand-liq-${liq.id}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" style="transition: 0.3s;"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>
                </div>

                <!-- Detalhes (Hidden by default) -->
                <div id="detalhes-liq-${liq.id}" style="display: none; border-top: 1px solid #f1f5f9; padding: 16px; background: #fafafa;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 20px;">
                        <div style="flex: 1; min-width: 250px;">
                            <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 4px;"><strong>Vencimento (30 dias):</strong> ${dataVencimento ? formatarDataBR(dataVencimento.toISOString().split('T')[0]) : '---'}</div>
                            <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 4px;"><strong>Valor:</strong> ${liq.valor ? 'R$ ' + parseFloat(liq.valor).toFixed(2).replace('.', ',') : '---'}</div>
                            ${itensTxt}
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; font-size: 0.8rem; background: rgba(0,0,0,0.03); padding: 10px; border-radius: 6px;">
                                <div><strong>NF/Doc:</strong> ${liq.nota_fiscal || '---'}</div>
                                <div><strong>Sol. Fornecimento:</strong> ${liq.solicitacao_fornecimento || '---'}</div>
                                <div><strong>Empenho:</strong> ${liq.empenho || '---'}</div>
                                <div><strong>Liquidação:</strong> ${liq.numero_liquidacao || '---'}</div>
                                <div><strong>Pagamento:</strong> ${liq.pagamento || '---'}</div>
                                <div><strong>Protocolo:</strong> ${liq.protocolo || '---'}</div>
                                <div><strong>Ficha:</strong> ${liq.ficha || '---'}</div>
                            </div>
                            ${liq.observacao ? `<div style="margin-top: 12px; font-size: 0.85rem; color: #475569; background: white; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0;"><strong>Obs:</strong> ${liq.observacao}</div>` : ''}
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 8px; min-width: 140px;">
                            ${liq.status !== 'concluida' ?
                `<button onclick="marcarLiquidacaoConcluida('${liq.id}')" style="background: #16a34a; color: white; border: none; padding: 8px 12px; border-radius: 6px; font-size: 0.85rem; cursor: pointer; font-weight: bold; transition: 0.2s;" onmouseover="this.style.opacity=0.9" onmouseout="this.style.opacity=1">✓ Concluir</button>`
                : ''
            }
                            <button onclick="abrirModalNovaLiquidacao('${liq.id}')" style="background: #eab308; color: white; border: none; padding: 8px 12px; border-radius: 6px; font-size: 0.85rem; cursor: pointer; font-weight: bold; transition: 0.2s;" onmouseover="this.style.opacity=0.9" onmouseout="this.style.opacity=1">Editar</button>
                            <button onclick="excluirLiquidacao('${liq.id}')" style="background: #ef4444; color: white; border: none; padding: 8px 12px; border-radius: 6px; font-size: 0.85rem; cursor: pointer; font-weight: bold; transition: 0.2s;" onmouseover="this.style.opacity=0.9" onmouseout="this.style.opacity=1">Excluir</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    html += '</div>';

    if (countFiltrados === 0) {
        container.innerHTML = `<div style="text-align: center; color: #94a3b8; padding: 40px; font-size: 1rem;">Nenhuma liquidação na data selecionada (${formatarDataBR(window.dataFiltroLiqSelecionada)}).</div>`;
        return;
    }

    container.innerHTML = html;
}

function toggleLiquidacaoDetalhes(id) {
    var detalhes = document.getElementById('detalhes-liq-' + id);
    var icone = document.getElementById('icone-expand-liq-' + id);
    if (!detalhes || !icone) return;

    if (detalhes.style.display === 'none') {
        detalhes.style.display = 'block';
        icone.style.transform = 'rotate(180deg)';
    } else {
        detalhes.style.display = 'none';
        icone.style.transform = 'rotate(0deg)';
    }
}

function mudarMesCalendarioLiq(delta) {
    window.mesAtualLiq += delta;
    if (window.mesAtualLiq < 0) {
        window.mesAtualLiq = 11;
        window.anoAtualLiq--;
    } else if (window.mesAtualLiq > 11) {
        window.mesAtualLiq = 0;
        window.anoAtualLiq++;
    }
    renderizarCalendarioLiq();
}

function renderizarCalendarioLiq() {
    var grid = document.getElementById('calendario-liq-grid');
    var titulo = document.getElementById('calendario-liq-mes-ano');
    if (!grid || !titulo) return;

    var mesesStr = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    titulo.innerText = mesesStr[window.mesAtualLiq] + ' ' + window.anoAtualLiq;

    var primeiroDia = new Date(window.anoAtualLiq, window.mesAtualLiq, 1).getDay();
    var ultimoDiaData = new Date(window.anoAtualLiq, window.mesAtualLiq + 1, 0).getDate();

    grid.innerHTML = '';

    // Dias vazios (mês anterior)
    for (var i = 0; i < primeiroDia; i++) {
        var elVazio = document.createElement('div');
        elVazio.style.background = 'rgba(255, 255, 255, 0.1)';
        elVazio.style.borderRadius = '8px';
        elVazio.style.border = '1px solid rgba(255, 255, 255, 0.1)';
        grid.appendChild(elVazio);
    }

    var hoje = new Date();
    var isMesAtual = (hoje.getFullYear() === window.anoAtualLiq && hoje.getMonth() === window.mesAtualLiq);

    var liqsPorDia = {};
    if (window.liquidacoesDados) {
        window.liquidacoesDados.forEach(function (liq) {
            if (liq.data_recebimento) {
                var dataRec = new Date(liq.data_recebimento + 'T00:00:00');
                var dataVenc = new Date(dataRec);
                dataVenc.setDate(dataVenc.getDate() + 30);

                var strRec = dataRec.toISOString().split('T')[0];
                var strVenc = dataVenc.toISOString().split('T')[0];

                // Mapear dia a dia
                var curr = new Date(dataRec);
                while (curr <= dataVenc) {
                    var strCurr = curr.toISOString().split('T')[0];
                    if (!liqsPorDia[strCurr]) liqsPorDia[strCurr] = [];
                    liqsPorDia[strCurr].push(liq);
                    curr.setDate(curr.getDate() + 1);
                }
            }
        });
    }

    for (var d = 1; d <= ultimoDiaData; d++) {
        var dataStr = window.anoAtualLiq + '-' + String(window.mesAtualLiq + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        var isSelecionado = (window.dataFiltroLiqSelecionada === dataStr);
        var liqsDoDia = liqsPorDia[dataStr] || [];

        var diaCell = document.createElement('div');
        diaCell.style.background = isSelecionado ? '#e0f2fe' : 'rgba(255, 255, 255, 0.3)';
        diaCell.style.borderRadius = '8px';
        diaCell.style.border = isSelecionado ? '2px solid #3b82f6' : '1px solid #e2e8f0';
        diaCell.style.padding = '8px';
        diaCell.style.position = 'relative';
        diaCell.style.minHeight = '60px';
        diaCell.style.display = 'flex';
        diaCell.style.flexDirection = 'column';
        diaCell.style.cursor = 'pointer';
        diaCell.style.transition = 'all 0.2s';
        diaCell.onclick = (function (dataClicada) {
            return function () {
                if (window.dataFiltroLiqSelecionada === dataClicada) {
                    window.dataFiltroLiqSelecionada = null; // desativa
                } else {
                    window.dataFiltroLiqSelecionada = dataClicada;
                }
                renderizarCalendarioLiq();
                renderizarCardsLiquidacoes();
            }
        })(dataStr);

        var numSpan = document.createElement('span');
        numSpan.textContent = d;
        numSpan.style.fontWeight = '600';
        numSpan.style.fontSize = '0.9rem';
        numSpan.style.color = isSelecionado ? '#1e40af' : '#475569';
        numSpan.style.alignSelf = 'flex-start';

        if (isMesAtual && d === hoje.getDate() && !isSelecionado) {
            numSpan.style.background = '#3b82f6';
            numSpan.style.color = 'white';
            numSpan.style.width = '24px';
            numSpan.style.height = '24px';
            numSpan.style.display = 'flex';
            numSpan.style.alignItems = 'center';
            numSpan.style.justifyContent = 'center';
            numSpan.style.borderRadius = '50%';
            diaCell.style.border = '2px solid #bfdbfe';
            diaCell.style.background = '#eff6ff';
        }

        diaCell.appendChild(numSpan);

        var areaBarras = document.createElement('div');
        areaBarras.style.flex = '1';
        areaBarras.style.marginTop = '4px';
        areaBarras.style.display = 'flex';
        areaBarras.style.flexWrap = 'wrap';
        areaBarras.style.gap = '3px';
        areaBarras.style.overflowY = 'hidden';

        if (liqsDoDia.length > 0 && !isSelecionado) {
            var corBase = liqsDoDia[0]._corFixa;
            diaCell.style.background = corBase + '0a';
            diaCell.style.borderColor = corBase + '40';
        }

        liqsDoDia.forEach(function (l) {
            var bar = document.createElement('div');
            bar.style.width = '100%';
            bar.style.height = '6px';
            bar.style.borderRadius = '3px';
            bar.style.background = l._corFixa || '#3b82f6';
            bar.style.marginBottom = '2px';
            bar.title = 'Ata: ' + (l.ata || 'S/A') + ' | ' + (l.status === 'concluida' ? 'Concluída' : 'Pendente');

            if (l.status === 'concluida') {
                bar.style.opacity = '0.4';
            }
            areaBarras.appendChild(bar);
        });

        diaCell.appendChild(areaBarras);
        grid.appendChild(diaCell);
    }
}

function formatarDataBR(dataYYYYMMDD) {
    if (!dataYYYYMMDD) return '';
    var partes = dataYYYYMMDD.split('-');
    if (partes.length !== 3) return dataYYYYMMDD;
    return partes[2] + '/' + partes[1] + '/' + partes[0];
}

function abrirModalNovaLiquidacao(idEdit = null) {
    var existente = document.getElementById('modal-nova-liquidacao');
    if (existente) existente.remove();

    var liqObj = null;
    if (typeof idEdit === 'string' && idEdit) {
        liqObj = window.liquidacoesDados.find(x => x.id === idEdit);
    }

    var modal = document.createElement('div');
    modal.id = 'modal-nova-liquidacao';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px; box-sizing:border-box;';

    var tituloModal = liqObj ? 'Editar Liquidação de Recebimentos' : 'Nova Liquidação de Recebimentos';
    var txtBtnSalvar = liqObj ? 'Salvar Alterações' : 'Salvar Liquidação';

    var html = `
        <div style="background: white; border-radius: 12px; width: 100%; max-width: 700px; max-height: 90vh; display: flex; flex-direction: column; position: relative;">
            <div style="padding: 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                <h2 style="margin: 0; color: #1e293b; font-size: 1.3rem;">${tituloModal}</h2>
                <button onclick="document.getElementById('modal-nova-liquidacao').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #64748b;">&times;</button>
            </div>
            
            <div style="padding: 20px; overflow-y: auto; flex: 1;">
                <input type="hidden" id="liq-id" value="${liqObj ? liqObj.id : ''}">
                <div style="display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 16px;">
                    <div style="flex: 1; min-width: 200px;">
                        <label style="display:block; font-weight:600; font-size:0.9rem; margin-bottom:4px;">Ata</label>
                        <input type="text" id="liq-ata" value="${liqObj && liqObj.ata ? liqObj.ata.replace(/"/g, '&quot;') : ''}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;">
                    </div>
                    <div style="flex: 1; min-width: 200px;">
                        <label style="display:block; font-weight:600; font-size:0.9rem; margin-bottom:4px;">Data de Recebimento</label>
                        <input type="date" id="liq-data" value="${liqObj && liqObj.data_recebimento ? liqObj.data_recebimento : ''}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;">
                    </div>
                </div>

                <div style="margin-bottom: 16px; padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <label style="display:block; font-weight:600; font-size:0.9rem; margin-bottom:10px;">Item(s)</label>
                    <div id="container-itens-liq" style="display:flex; flex-direction:column; gap:8px;">
                        <!-- Linhas de itens inseridas aqui -->
                    </div>
                    <button onclick="adicionarLinhaItemLiquidacao()" style="margin-top:10px; background:#e2e8f0; color:#334155; border:none; padding:6px 12px; border-radius:6px; font-size:0.85rem; font-weight:600; cursor:pointer;">+ Adicionar Item</button>
                </div>

                <div style="display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 16px;">
                    <div style="flex: 1; min-width: 200px;">
                        <label style="display:block; font-weight:600; font-size:0.9rem; margin-bottom:4px;">Fornecedor</label>
                        <input type="text" id="liq-fornecedor" value="${liqObj && liqObj.fornecedor ? liqObj.fornecedor.replace(/"/g, '&quot;') : ''}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;">
                    </div>
                    <div style="flex: 1; min-width: 200px;">
                        <label style="display:block; font-weight:600; font-size:0.9rem; margin-bottom:4px;">CNPJ</label>
                        <input type="text" id="liq-cnpj" value="${liqObj && liqObj.cnpj ? liqObj.cnpj.replace(/"/g, '&quot;') : ''}" placeholder="00.000.000/0000-00" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;">
                    </div>
                    <div style="flex: 1; min-width: 200px;">
                        <label style="display:block; font-weight:600; font-size:0.9rem; margin-bottom:4px;">Valor (R$)</label>
                        <input type="number" step="0.01" id="liq-valor" value="${liqObj && liqObj.valor !== null ? liqObj.valor : ''}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;" placeholder="0.00">
                    </div>
                </div>

                <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px;">
                    <div style="flex: 1; min-width: 150px;">
                        <label style="display:block; font-weight:600; font-size:0.85rem; margin-bottom:4px;">Nota Fiscal/Doc</label>
                        <input type="text" id="liq-nf" value="${liqObj && liqObj.nota_fiscal ? liqObj.nota_fiscal.replace(/"/g, '&quot;') : ''}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;">
                    </div>
                    <div style="flex: 1; min-width: 150px;">
                        <label style="display:block; font-weight:600; font-size:0.85rem; margin-bottom:4px;">Nº Sol. Fornecimento</label>
                        <input type="text" id="liq-solicitacao" value="${liqObj && liqObj.solicitacao_fornecimento ? liqObj.solicitacao_fornecimento.replace(/"/g, '&quot;') : ''}" placeholder="Ex: 123/2026" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;">
                    </div>
                    <div style="flex: 1; min-width: 150px;">
                        <label style="display:block; font-weight:600; font-size:0.85rem; margin-bottom:4px;">Empenho</label>
                        <input type="text" id="liq-empenho" value="${liqObj && liqObj.empenho ? liqObj.empenho.replace(/"/g, '&quot;') : ''}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;">
                    </div>
                    <div style="flex: 1; min-width: 150px;">
                        <label style="display:block; font-weight:600; font-size:0.85rem; margin-bottom:4px;">Liquidação (Nº)</label>
                        <input type="text" id="liq-numero" value="${liqObj && liqObj.numero_liquidacao ? liqObj.numero_liquidacao.replace(/"/g, '&quot;') : ''}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;">
                    </div>
                    <div style="flex: 1; min-width: 150px;">
                        <label style="display:block; font-weight:600; font-size:0.85rem; margin-bottom:4px;">Pagamento (Nº)</label>
                        <input type="text" id="liq-pagamento" value="${liqObj && liqObj.pagamento ? liqObj.pagamento.replace(/"/g, '&quot;') : ''}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;">
                    </div>
                    <div style="flex: 1; min-width: 150px;">
                        <label style="display:block; font-weight:600; font-size:0.85rem; margin-bottom:4px;">Protocolo</label>
                        <input type="text" id="liq-protocolo" value="${liqObj && liqObj.protocolo ? liqObj.protocolo.replace(/"/g, '&quot;') : ''}" placeholder="Ex: 456/2026" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;">
                    </div>
                    <div style="flex: 1; min-width: 150px;">
                        <label style="display:block; font-weight:600; font-size:0.85rem; margin-bottom:4px;">Ficha</label>
                        <input type="text" id="liq-ficha" value="${liqObj && liqObj.ficha ? liqObj.ficha.replace(/"/g, '&quot;') : ''}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;" placeholder="Opcional">
                    </div>
                </div>

                <div style="margin-bottom: 16px;">
                    <label style="display:block; font-weight:600; font-size:0.9rem; margin-bottom:4px;">Observação</label>
                    <textarea id="liq-obs" rows="3" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box; resize:vertical;">${liqObj && liqObj.observacao ? liqObj.observacao : ''}</textarea>
                </div>
            </div>

            <div style="padding: 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 12px; background: #f8fafc; border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;">
                <button onclick="document.getElementById('modal-nova-liquidacao').remove()" style="padding: 10px 16px; border: 1px solid #cbd5e1; background: white; color: #475569; border-radius: 8px; font-weight: 600; cursor: pointer;">Cancelar</button>
                <button id="btn-salvar-liq" onclick="salvarLiquidacao()" style="padding: 10px 20px; background: #0c3e2b; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">${txtBtnSalvar}</button>
            </div>
        </div>
    `;
    modal.innerHTML = html;
    document.body.appendChild(modal);

    if (liqObj && liqObj.itens && liqObj.itens.length > 0) {
        liqObj.itens.forEach(i => adicionarLinhaItemLiquidacao(i.nome, i.quantidade, i.unidade));
    } else {
        adicionarLinhaItemLiquidacao();
    }
}

function adicionarLinhaItemLiquidacao(nome = '', qtd = '', un = 'UN') {
    var container = document.getElementById('container-itens-liq');
    if (!container) return;

    var div = document.createElement('div');
    div.className = 'linha-item-liq';
    div.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px; align-items: center; border-bottom: 1px dashed #cbd5e1; padding-bottom: 8px;';

    var options = ['UN', 'KG', 'G', 'M', 'L', 'CX', 'PCT', 'OUTRO'].map(o => {
        var label = o === 'KG' ? 'Kilos' : (o === 'G' ? 'Gramas' : (o === 'M' ? 'Metros' : (o === 'L' ? 'Litros' : (o === 'CX' ? 'Caixa' : (o === 'PCT' ? 'Pacote' : (o === 'OUTRO' ? 'Outro' : 'UN'))))));
        return `<option value="${o}" ${un === o ? 'selected' : ''}>${label}</option>`;
    }).join('');

    div.innerHTML = `
        <input type="text" class="liq-item-nome" placeholder="Nome do item" value="${nome.replace(/"/g, '&quot;')}" style="flex: 1 1 120px; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; box-sizing: border-box; font-size: 0.85rem;">
        <input type="number" step="0.01" class="liq-item-qtd" placeholder="Qtd" value="${qtd}" style="flex: 1 1 60px; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; box-sizing: border-box; font-size: 0.85rem;">
        <select class="liq-item-unidade" style="flex: 1 1 80px; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; box-sizing: border-box; font-size: 0.85rem; background: white;">
            ${options}
        </select>
        <button onclick="this.parentElement.remove()" style="background: none; border: none; color: #ef4444; font-size: 16px; cursor: pointer; padding: 4px;" title="Remover item">&times;</button>
    `;

    container.appendChild(div);
}

async function salvarLiquidacao() {
    var btnSalvar = document.getElementById('btn-salvar-liq');
    btnSalvar.disabled = true;
    btnSalvar.textContent = 'Salvando...';

    try {
        var idEdit = document.getElementById('liq-id').value;
        var ficha = document.getElementById('liq-ficha').value.trim();
        var ata = document.getElementById('liq-ata').value.trim();
        var data_recebimento = document.getElementById('liq-data').value;
        var fornecedor = document.getElementById('liq-fornecedor').value.trim();
        var cnpj = document.getElementById('liq-cnpj').value.trim();
        var valorTxt = document.getElementById('liq-valor').value;
        var valor = valorTxt ? parseFloat(valorTxt) : null;
        var nota_fiscal = document.getElementById('liq-nf').value.trim();
        var solicitacao = document.getElementById('liq-solicitacao').value.trim();
        var empenho = document.getElementById('liq-empenho').value.trim();
        var numero_liquidacao = document.getElementById('liq-numero').value.trim();
        var pagamento = document.getElementById('liq-pagamento').value.trim();
        var protocolo = document.getElementById('liq-protocolo').value.trim();
        var obs = document.getElementById('liq-obs').value.trim();

        // Extrair itens
        var itens = [];
        var linhasItens = document.querySelectorAll('.linha-item-liq');
        linhasItens.forEach(function (linha) {
            var nome = linha.querySelector('.liq-item-nome').value.trim();
            var qtd = linha.querySelector('.liq-item-qtd').value.trim();
            var un = linha.querySelector('.liq-item-unidade').value;
            if (nome || qtd) {
                itens.push({
                    nome: nome,
                    quantidade: qtd,
                    unidade: un
                });
            }
        });

        var payload = {
            ficha: ficha,
            ata: ata,
            itens: itens,
            data_recebimento: data_recebimento || null,
            fornecedor: fornecedor,
            cnpj: cnpj,
            valor: valor,
            nota_fiscal: nota_fiscal,
            solicitacao_fornecimento: solicitacao,
            empenho: empenho,
            numero_liquidacao: numero_liquidacao,
            pagamento: pagamento,
            protocolo: protocolo,
            observacao: obs
        };

        if (idEdit) {
            var { error } = await supabaseClient.from('liquidacoes').update(payload).eq('id', idEdit);
            if (error) throw error;
        } else {
            payload.owner_id = window.userIdGlobal;
            var { error } = await supabaseClient.from('liquidacoes').insert([payload]);
            if (error) throw error;
        }

        document.getElementById('modal-nova-liquidacao').remove();
        carregarLiquidacoes();

    } catch (err) {
        console.error('Erro ao salvar liquidação:', err);
        alert('Erro ao salvar liquidação: ' + (err.message || JSON.stringify(err)) + '\\n\\nIsto pode ser causado por um AdBlocker ou Antivírus bloqueando a conexão. Tente desativá-los ou usar aba anônima.');
        btnSalvar.disabled = false;
        btnSalvar.textContent = document.getElementById('liq-id').value ? 'Salvar Alterações' : 'Salvar Liquidação';
    }
}

async function marcarLiquidacaoConcluida(id) {
    if (!confirm('Deseja marcar esta liquidação como concluída?')) return;
    try {
        var { error } = await supabaseClient
            .from('liquidacoes')
            .update({ status: 'concluida' })
            .eq('id', id);

        if (error) throw error;
        carregarLiquidacoes();
    } catch (err) {
        console.error('Erro ao concluir:', err);
        alert('Erro ao concluir liquidação.');
    }
}

async function excluirLiquidacao(id) {
    if (!confirm('Tem certeza que deseja excluir esta liquidação?')) return;
    try {
        var { error } = await supabaseClient
            .from('liquidacoes')
            .delete()
            .eq('id', id);

        if (error) throw error;
        carregarLiquidacoes();
    } catch (err) {
        console.error('Erro ao excluir:', err);
        alert('Erro ao excluir liquidação.');
    }
}

async function executarDownloadLiquidacoesAno() {
    const { value: anoEscolhido } = await Swal.fire({
        title: 'Selecione o Ano',
        text: 'Qual ano de liquidação deseja baixar e fechar (baseado na data de recebimento)?',
        input: 'number',
        inputValue: new Date().getFullYear(),
        showCancelButton: true,
        confirmButtonText: 'Continuar',
        cancelButtonText: 'Cancelar',
        inputValidator: (value) => {
            if (!value) return 'O ano é obrigatório!';
        }
    });

    if (!anoEscolhido) return;

    const ano = parseInt(anoEscolhido);
    const anoPassado = ano - 1;

    var liquidadas = window.liquidacoesDados || [];
    var registrosAno = liquidadas.filter(l => l.data_recebimento && l.data_recebimento.startsWith(ano.toString()));

    if (registrosAno.length === 0) {
        Swal.fire('Aviso', 'Nenhuma liquidação encontrada para o ano ' + ano, 'info');
        return;
    }

    let csvContent = "Ata,Fornecedor,CNPJ,Data de Recebimento,Data de Vencimento,Valor (R$),Itens,NF/Doc,Sol. Fornecimento,Empenho,Liquidação,Pagamento,Protocolo,Ficha,Status,Observação\n";

    registrosAno.forEach(liq => {
        let dataRecebimento = liq.data_recebimento ? new Date(liq.data_recebimento + 'T00:00:00') : null;
        let dataVencimento = null;
        if (dataRecebimento) {
            dataVencimento = new Date(dataRecebimento);
            dataVencimento.setDate(dataVencimento.getDate() + 30);
        }

        let vencimentoStr = dataVencimento ? dataVencimento.toLocaleDateString('pt-BR') : '';
        let recebimentoStr = dataRecebimento ? dataRecebimento.toLocaleDateString('pt-BR') : '';

        let statusStr = liq.status === 'concluida' ? 'Concluída' : 'Pendente';
        let valorStr = liq.valor ? liq.valor.toFixed(2).replace('.', ',') : '';

        let itensStr = (liq.itens || []).map(i => `${i.nome || ''} (${i.quantidade || ''} ${i.unidade || ''})`).join('; ');

        let escapeCSV = (str) => {
            if (str === null || str === undefined) return '""';
            return '"' + str.toString().replace(/"/g, '""') + '"';
        };

        let row = [
            escapeCSV(liq.ata),
            escapeCSV(liq.fornecedor),
            escapeCSV(liq.cnpj),
            escapeCSV(recebimentoStr),
            escapeCSV(vencimentoStr),
            escapeCSV(valorStr),
            escapeCSV(itensStr),
            escapeCSV(liq.nota_fiscal),
            escapeCSV(liq.solicitacao_fornecimento),
            escapeCSV(liq.empenho),
            escapeCSV(liq.numero_liquidacao),
            escapeCSV(liq.pagamento),
            escapeCSV(liq.protocolo),
            escapeCSV(liq.ficha),
            escapeCSV(statusStr),
            escapeCSV(liq.observacao)
        ].join(',');

        csvContent += row + "\n";
    });

    let blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });

    // Download para o usuário
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `liquidacoes_${ano}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // -- Validação de E-mail do Usuário --
    let emailDestino = null;
    try {
        const user = window.userIdGlobal ? { id: window.userIdGlobal } : (await getAuthUser()).data.user;
        const { data: perfil } = await supabaseClient.from('profiles').select('email_real, email_verificado').eq('id', user.id).maybeSingle();
        emailDestino = perfil?.email_real;
        let verificado = perfil?.email_verificado || false;

        while (true) {
            while (!emailDestino || !validarEmailFmt(emailDestino)) {
                emailDestino = await registrarEmailNoAto(user.id);
                if (!emailDestino) {
                    const { isConfirmed } = await Swal.fire({
                        title: 'E-mail Obrigatório',
                        text: 'O envio por e-mail é obrigatório para concluir o backup.',
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'Informar E-mail',
                        cancelButtonText: 'Cancelar'
                    });
                    if (!isConfirmed) return; // Aborta
                }
                verificado = false;
            }
            if (!verificado) {
                const sucessoV = await realizarVerificacaoOTP(user.id, emailDestino);
                if (!sucessoV) {
                    emailDestino = null;
                    continue;
                }
            }
            break;
        }
    } catch (err) {
        console.error("Erro na validação do email:", err);
        Swal.fire('Erro', 'Não foi possível validar seu e-mail: ' + (err.message || 'Erro desconhecido'), 'error');
        return;
    }

    Swal.fire({
        title: 'Enviando E-mail...',
        html: `Enviando backup para <b>${emailDestino}</b>...`,
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    const reader = new FileReader();
    const base64Promise = new Promise((resolve) => {
        reader.onloadend = () => {
            resolve(reader.result);
        };
        reader.readAsDataURL(blob);
    });
    const base64Data = await base64Promise;
    const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwc-q6uBW3DigEvoQWOImXIlgPsBizoUwquUmaU2RXyHbjSVEvx4fLtAyBzIqNuveQR/exec";

    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            cache: 'no-cache',
            body: JSON.stringify({
                to: emailDestino,
                subject: `Backup Liquidações SEMAC - ${ano}`,
                body: `Olá,\n\nSegue em anexo o arquivo CSV contendo todas as liquidações registradas no ano de ${ano}.\n\nEste é um backup automático do sistema SEMAC.`,
                fileName: `liquidacoes_${ano}.csv`,
                attachmentBase64: base64Data
            })
        });
        await Swal.fire('Enviado!', `As liquidações do ano foram baixadas e enviadas para ${emailDestino} com sucesso.`, 'success');
    } catch (err) {
        console.error("Erro ao enviar e-mail:", err);
        await Swal.fire('Aviso', 'O download foi feito, mas houve um erro ao enviar por e-mail.', 'warning');
    }

    const { value: opcaoExclusao } = await Swal.fire({
        title: `Excluir dados de ${ano}?`,
        text: `Deseja excluir as liquidações do ano de ${ano} do banco de dados?`,
        icon: 'question',
        input: 'radio',
        inputOptions: {
            'todas': 'Excluir TODAS as liquidações deste ano',
            'concluidas': 'Excluir APENAS as liquidações Concluídas'
        },
        showCancelButton: true,
        confirmButtonText: 'Confirmar Exclusão',
        cancelButtonText: 'Manter Dados no Banco',
        confirmButtonColor: '#dc2626'
    });

    if (opcaoExclusao) {
        Swal.fire({ title: 'Excluindo...', allowOutsideClick: false });
        Swal.showLoading();

        try {
            var limiteStr = `${ano}-12-31`;
            var limiteInferior = `${ano}-01-01`;

            let query = supabaseClient
                .from('liquidacoes')
                .delete()
                .gte('data_recebimento', limiteInferior)
                .lte('data_recebimento', limiteStr);

            if (opcaoExclusao === 'concluidas') {
                query = query.eq('status', 'concluida');
            }

            var { error } = await query;

            if (error) throw error;

            await Swal.fire('Sucesso!', `As liquidações selecionadas de ${ano} foram excluídas do banco de dados.`, 'success');
            carregarLiquidacoes();
        } catch (err) {
            console.error("Erro ao excluir dados antigos:", err);
            Swal.fire('Erro', 'Não foi possível excluir os dados.', 'error');
        }
    }
}
