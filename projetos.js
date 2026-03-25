// projetos.js - Lógica do Calendário Vanilla JS

let dataCalendarioAtual = new Date(); // Data usada para navegar pelos meses
window.dataFiltroSelecionada = null; // Estado global do filtro

function inicializarCalendario() {
    renderizarCalendario();
}

function renderizarCalendario() {
    renderizarCalendarioEspecifico('calendario-grid', 'calendario-mes-ano');
    renderizarCalendarioEspecifico('home-calendario-grid', 'home-calendario-mes-ano');
}

function renderizarCalendarioEspecifico(gridId, tituloId) {
    const grid = document.getElementById(gridId);
    const titulo = document.getElementById(tituloId);

    if (!grid || !titulo) return;

    grid.innerHTML = ''; // Limpa o grid antigo

    const ano = dataCalendarioAtual.getFullYear();
    const mes = dataCalendarioAtual.getMonth();

    // Nomes dos meses em português
    const nomesMeses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    titulo.textContent = `${nomesMeses[mes]} ${ano}`;

    // Primeiro dia do mês (0 = Domingo, 1 = Segunda, etc)
    const primeiroDia = new Date(ano, mes, 1).getDay();
    // Quantidade de dias no mês atual
    const diasNoMes = new Date(ano, mes + 1, 0).getDate();

    const hoje = new Date();
    const isMesAtual = hoje.getFullYear() === ano && hoje.getMonth() === mes;

    // Preenche espaços vazios antes do dia 1 começarem
    for (let i = 0; i < primeiroDia; i++) {
        const divVazio = document.createElement('div');
        divVazio.style.background = 'rgba(255, 255, 255, 0.1)'; 
        divVazio.style.borderRadius = '8px';
        divVazio.style.border = '1px solid rgba(255, 255, 255, 0.1)';
        grid.appendChild(divVazio);
    }

    // Preenche os dias do mês atual
    for (let dia = 1; dia <= diasNoMes; dia++) {
        const dataStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        const isSelecionado = window.dataFiltroSelecionada === dataStr;

        const diaCell = document.createElement('div');
        diaCell.style.background = isSelecionado ? '#e0f2fe' : 'rgba(255, 255, 255, 0.3)';
        diaCell.style.borderRadius = '8px';
        diaCell.style.border = isSelecionado ? '2px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.2)';
        diaCell.style.padding = '8px';
        diaCell.style.position = 'relative';
        diaCell.style.minHeight = '60px';
        diaCell.style.display = 'flex';
        diaCell.style.flexDirection = 'column';
        diaCell.style.cursor = 'pointer';
        diaCell.style.transition = 'all 0.2s';
        diaCell.onclick = () => selecionarDataCalendario(dataStr);

        // Estilo do número do dia
        const numeroSpan = document.createElement('span');
        numeroSpan.textContent = dia;
        numeroSpan.style.fontWeight = '600';
        numeroSpan.style.fontSize = '0.9rem';
        numeroSpan.style.color = isSelecionado ? '#1e40af' : '#475569';
        numeroSpan.style.alignSelf = 'flex-start';

        // Destaca se for o dia de HOJE
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

        const areaEventos = document.createElement('div');
        areaEventos.style.flex = '1';
        areaEventos.style.marginTop = '4px';
        areaEventos.style.display = 'flex';
        areaEventos.style.flexWrap = 'wrap';
        areaEventos.style.gap = '3px';
        areaEventos.style.overflowY = 'hidden';

        const listaEventosGlobal = window.eventosMesCache || [];
        const eventosNoDia = listaEventosGlobal.filter(ev => {
            if (!ev.data_inicio) return false;
            const inicio = ev.data_inicio.substring(0, 10);
            const fim = ev.data_fim ? ev.data_fim.substring(0, 10) : inicio;
            return dataStr >= inicio && dataStr <= (fim || inicio);
        });

        if (eventosNoDia.length > 0 && !isSelecionado) {
            const corBase = eventosNoDia[0].cor || '#3b82f6';
            diaCell.style.background = `${corBase}0a`;
            diaCell.style.borderColor = `${corBase}40`;
        }

        eventosNoDia.forEach(ev => {
            const bar = document.createElement('div');
            bar.style.width = '100%';
            bar.style.height = '6px';
            bar.style.borderRadius = '3px';
            bar.style.background = ev.cor || '#3b82f6';
            bar.style.marginBottom = '2px';
            bar.title = ev.titulo;
            areaEventos.appendChild(bar);
        });

        diaCell.appendChild(areaEventos);
        grid.appendChild(diaCell);
    }
}

function selecionarDataCalendario(dataStr) {
    if (window.dataFiltroSelecionada === dataStr) {
        window.dataFiltroSelecionada = null;
    } else {
        window.dataFiltroSelecionada = dataStr;
    }
    renderizarCalendario();
    if (typeof carregarEventos === 'function') carregarEventos();
}


function mudarMesCalendario(direcao) {
    // Adiciona ou subtrai 1 mês
    dataCalendarioAtual.setMonth(dataCalendarioAtual.getMonth() + direcao);
    renderizarCalendario();
}
