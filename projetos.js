// projetos.js - Lógica do Calendário Vanilla JS

let dataCalendarioAtual = new Date(); // Data usada para navegar pelos meses

function inicializarCalendario() {
    renderizarCalendario();
}

function renderizarCalendario() {
    const grid = document.getElementById('calendario-grid');
    const titulo = document.getElementById('calendario-mes-ano');

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

    // Preenche espaços vazios antes do dia 1 começarem (dias do mês anterior que caem na primeira semana)
    for (let i = 0; i < primeiroDia; i++) {
        const divVazio = document.createElement('div');
        divVazio.style.background = '#f8fafc'; // Cor mais clara para indicar que é vazio/inativo
        divVazio.style.borderRadius = '8px';
        divVazio.style.border = '1px solid #f1f5f9';
        grid.appendChild(divVazio);
    }

    // Preenche os dias do mês atual
    for (let dia = 1; dia <= diasNoMes; dia++) {
        const diaCell = document.createElement('div');
        diaCell.style.background = '#ffffff';
        diaCell.style.borderRadius = '8px';
        diaCell.style.border = '1px solid #e2e8f0';
        diaCell.style.padding = '8px';
        diaCell.style.position = 'relative';
        diaCell.style.minHeight = '80px';
        diaCell.style.display = 'flex';
        diaCell.style.flexDirection = 'column';

        // Estilo do número do dia
        const numeroSpan = document.createElement('span');
        numeroSpan.textContent = dia;
        numeroSpan.style.fontWeight = '600';
        numeroSpan.style.fontSize = '0.9rem';
        numeroSpan.style.color = '#475569';
        numeroSpan.style.alignSelf = 'flex-start';

        // Destaca se for o dia de HOJE
        if (isMesAtual && dia === hoje.getDate()) {
            numeroSpan.style.background = '#3b82f6';
            numeroSpan.style.color = 'white';
            numeroSpan.style.width = '24px';
            numeroSpan.style.height = '24px';
            numeroSpan.style.display = 'flex';
            numeroSpan.style.alignItems = 'center';
            numeroSpan.style.justifyContent = 'center';
            numeroSpan.style.borderRadius = '50%';
            diaCell.style.border = '2px solid #bfdbfe';
            diaCell.style.background = '#eff6ff'; // Fundo levemente azul
        }

        diaCell.appendChild(numeroSpan);

        // Área para futuros eventos (Tarefas do dia, etc)
        const areaEventos = document.createElement('div');
        areaEventos.style.flex = '1';
        areaEventos.style.marginTop = '4px';
        areaEventos.style.overflowY = 'auto';
        areaEventos.style.fontSize = '0.75rem';

        // (Exemplo Vazio) Opcional: injetar eventos reais do BD aqui futuramente

        diaCell.appendChild(areaEventos);
        grid.appendChild(diaCell);
    }

    // Opcional: preencher os últimos dias da grade (para manter o quadrado de 6 linhas completo se preferir)
    // Para simplificar, o CSS Grid com grid-auto-rows cuidará da altura das linhas.
}

function mudarMesCalendario(direcao) {
    // Adiciona ou subtrai 1 mês
    dataCalendarioAtual.setMonth(dataCalendarioAtual.getMonth() + direcao);
    renderizarCalendario();
}
