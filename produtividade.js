// =============================================
// PRODUTIVIDADE.JS — Sistema de Produtividade
// =============================================

// --- DEFINIÇÃO DAS CATEGORIAS ---
// Cada categoria espelha uma aba da planilha original
// Começando com 1 categoria de teste (2°)
const CATEGORIAS = [
    // === CONTROLE PROCESSUAL (1.1° a 1.7°) — Destaque ===
    {
        id: '1.1',
        nome: 'Notificação Preliminar',
        pontos: 20,
        destaque: true,
        campos: [
            { nome: 'n_notificacao', label: 'N° da Notificação', tipo: 'text', obrigatorio: true },
            { nome: 'nome', label: 'Nome do Contribuinte', tipo: 'text', obrigatorio: true },
            { nome: 'n_inscricao', label: 'N° de Inscrição', tipo: 'text', obrigatorio: true },
            { nome: 'bairro', label: 'Bairro', tipo: 'text', obrigatorio: true },
            { nome: 'motivo', label: 'Motivo', tipo: 'select_custom', obrigatorio: true, opcoes: ['Limpeza', 'Construção de Muro', 'Construção de Passeio', 'Reconstrução de Muro ou Passeio'] },
            { nome: 'anexo_pdf', label: 'Anexo (PDF/Docx)', tipo: 'file', obrigatorio: true, aceitar: '.pdf,.doc,.docx' }
        ]
    },
    {
        id: '1.2',
        nome: 'Auto de Infração',
        pontos: 60,
        destaque: true,
        campos: [
            { nome: 'nome', label: 'Contribuinte', tipo: 'text', obrigatorio: true },
            { nome: 'endereco_infrator', label: 'Endereço do Infrator', tipo: 'text', obrigatorio: true, ignorarNoBanco: true },
            { nome: 'endereco_imovel', label: 'Endereço do Imóvel Autuado', tipo: 'text', obrigatorio: true, ignorarNoBanco: true },
            { nome: 'bairro', label: 'Bairro do Imóvel Autuado', tipo: 'text', obrigatorio: true },
            { nome: 'inscricao_zona', label: 'Zona', tipo: 'text', obrigatorio: true, agrupar: 'inscricao', ignorarNoBanco: true },
            { nome: 'inscricao_quadra', label: 'Quadra', tipo: 'text', obrigatorio: true, agrupar: 'inscricao', ignorarNoBanco: true },
            { nome: 'inscricao_lote', label: 'Lote', tipo: 'text', obrigatorio: true, agrupar: 'inscricao', ignorarNoBanco: true },
            { nome: 'inscricao_area', label: 'Área', tipo: 'text', obrigatorio: true, agrupar: 'inscricao', ignorarNoBanco: true },
            { nome: 'motivo', label: 'Motivo', tipo: 'select_custom', obrigatorio: true, opcoes: ['Limpeza', 'Construção de Muro', 'Construção de Passeio'] },
            { nome: 'data', label: 'Data da Fiscalização', tipo: 'date', obrigatorio: true },
            { nome: 'n_notificacao', label: 'Nº da notificação', tipo: 'text', obrigatorio: false, ignorarNoBanco: true },
            { nome: 'prazo_defesa', label: 'Prazo p/ Defesa (Dias)', tipo: 'number', obrigatorio: true, ignorarNoBanco: true },
            { nome: 'fundamentacao_legal', label: 'Fundamentação Legal (Lei/Decreto Descumprido)', tipo: 'text', obrigatorio: true, ignorarNoBanco: true },
            { nome: 'valor_multa', label: 'Valor da Multa (R$)', tipo: 'text', obrigatorio: true, ignorarNoBanco: true }
        ]
    },
    {
        id: '1.3',
        nome: 'Aviso de Recebimento (AR)',
        pontos: 10,
        destaque: true,
        campos: [
            { nome: 'n_ar', label: 'N° do AR', tipo: 'text', obrigatorio: true },
            { nome: 'nome', label: 'Nome', tipo: 'text', obrigatorio: true },
            { nome: 'data_chegada', label: 'Data de Chegada', tipo: 'date', obrigatorio: true },
            { nome: 'bairro', label: 'Bairro Notificada', tipo: 'text', obrigatorio: true }
        ]
    },
    {
        id: '1.4',
        nome: 'Ofício',
        pontos: 15,
        destaque: true,
        campos: [
            { nome: 'nome', label: 'Nome', tipo: 'text', obrigatorio: true },
            { nome: 'assunto', label: 'Assunto', tipo: 'text', obrigatorio: true }
        ]
    },
    {
        id: '1.5',
        nome: 'Relatório',
        pontos: 15,
        destaque: true,
        campos: [
            { nome: 'atendimento', label: 'Para o atendimento...', tipo: 'textarea', obrigatorio: true }
        ]
    },
    {
        id: '1.6',
        nome: 'Protocolo',
        pontos: 15,
        destaque: true,
        campos: [
            { nome: 'n_protocolo', label: 'N° do Protocolo', tipo: 'text', obrigatorio: true },
            { nome: 'nome', label: 'Nome', tipo: 'text', obrigatorio: true },
            { nome: 'data', label: 'Data de Finalização', tipo: 'date', obrigatorio: true },
            { nome: 'bairro', label: 'Bairro', tipo: 'text', obrigatorio: true },
            { nome: 'anexo_pdf', label: 'Anexo (PDF/Docx)', tipo: 'file', obrigatorio: true, aceitar: '.pdf,.doc,.docx' }
        ]
    },
    {
        id: '1.7',
        nome: 'Réplica',
        pontos: 15,
        destaque: true,
        campos: [
            { nome: 'nome', label: 'Nome', tipo: 'text', obrigatorio: true },
            { nome: 'bairro', label: 'Bairro', tipo: 'text', obrigatorio: true }
        ]
    },
    // === CATEGORIAS GERAIS (2° a 30°) ===
    {
        id: '2',
        nome: 'Vistorias de limpeza de vias, praças e passeios públicos',
        pontos: 10,
        campos: [
            { nome: 'n_protocolo', label: 'N° de Protocolo', tipo: 'text', obrigatorio: true },
            { nome: 'n_inscricao', label: 'Nº de Inscrição', tipo: 'text', obrigatorio: true },
            { nome: 'data_vistoria', label: 'Data da Vistoria', tipo: 'date', obrigatorio: true }
        ]
    },
    {
        id: '3',
        nome: 'Vistorias de denúncias de imóveis particulares para limpeza, construção de muros e passeios',
        pontos: 10,
        campos: [
            { nome: 'n_protocolo', label: 'N° do Protocolo', tipo: 'text', obrigatorio: true },
            { nome: 'n_inscricao', label: 'Nº de Inscrição', tipo: 'text', obrigatorio: true },
            { nome: 'data_vistoria', label: 'Data da Vistoria', tipo: 'date', obrigatorio: true }
        ]
    },
    {
        id: '4',
        nome: 'Vistoria de diligência profilática in loco para cumprimento de leis pertinentes',
        pontos: 10,
        campos: [
            { nome: 'n_protocolo', label: 'N° do Protocolo', tipo: 'text', obrigatorio: true },
            { nome: 'n_inscricao', label: 'Nº de Inscrição', tipo: 'text', obrigatorio: true },
            { nome: 'data_vistoria', label: 'Data da Vistoria', tipo: 'date', obrigatorio: true }
        ]
    },
    {
        id: '5',
        nome: 'Serviços internos ou externos (em horário de expediente), por HORA',
        pontos: 10,
        por_hora: true,
        campo_horas: 'duracao',
        campos: [
            { nome: 'data_servico', label: 'Data do Serviço', tipo: 'date', obrigatorio: true },
            { nome: 'duracao', label: 'Duração (horas)', tipo: 'number', obrigatorio: true }
        ]
    },
    {
        id: '6',
        nome: 'Prestação de serviço extraordinário',
        pontos: 20,
        pontos_por_tipo: { 'Diurno': 20, 'Noturno': 30 },
        por_hora: true,
        campo_horas: 'n_horas',
        campos: [
            { nome: 'tipo', label: 'Tipo', tipo: 'select', obrigatorio: true, opcoes: ['Diurno', 'Noturno'] },
            { nome: 'responsavel', label: 'Responsável', tipo: 'text', obrigatorio: true },
            { nome: 'n_horas', label: 'N° de Horas', tipo: 'number', obrigatorio: true },
            { nome: 'data', label: 'Data', tipo: 'date', obrigatorio: true }
        ]
    },
    {
        id: '7',
        nome: 'Elaboração de Certidão e Relatório Fiscal',
        pontos: 50,
        campos: [
            { nome: 'tipo', label: 'Tipo', tipo: 'select', obrigatorio: true, opcoes: ['Certidão', 'Relatório Fiscal'] },
            { nome: 'descricao', label: 'Descrição', tipo: 'text', obrigatorio: true },
            { nome: 'data', label: 'Data', tipo: 'date', obrigatorio: true }
        ]
    },
    {
        id: '8',
        nome: 'Elaboração de Ofícios',
        pontos: 15,
        campos: [
            { nome: 'n_oficio', label: 'N° do Ofício', tipo: 'text', obrigatorio: true },
            { nome: 'descricao', label: 'Descrição', tipo: 'text', obrigatorio: true },
            { nome: 'data', label: 'Data', tipo: 'date', obrigatorio: true }
        ]
    },
    {
        id: '9',
        nome: 'Processos (via protocolo municipal) de Alvarás de Localização vistoriados e informados',
        pontos: 20,
        campos: [
            { nome: 'n_processo', label: 'N° do Processo', tipo: 'text', obrigatorio: true },
            { nome: 'descricao', label: 'Descrição', tipo: 'text', obrigatorio: true },
            { nome: 'data', label: 'Data', tipo: 'date', obrigatorio: true }
        ]
    },
    {
        id: '10',
        nome: 'Processos (via protocolo municipal) de Alvarás de Localização vistoriados e informados',
        pontos: 10,
        campos: [
            { nome: 'n_processo', label: 'N° do Processo', tipo: 'text', obrigatorio: true },
            { nome: 'descricao', label: 'Descrição', tipo: 'text', obrigatorio: true },
            { nome: 'data', label: 'Data', tipo: 'date', obrigatorio: true }
        ]
    },
    {
        id: '11',
        nome: 'Montagem de processo para encaminhamento, exclusivamente para inscrição em dívida ativa',
        pontos: 100,
        campos: [
            { nome: 'n_processo', label: 'N° do Processo', tipo: 'text', obrigatorio: true },
            { nome: 'descricao', label: 'Descrição', tipo: 'text', obrigatorio: true },
            { nome: 'data', label: 'Data', tipo: 'date', obrigatorio: true }
        ]
    },
    {
        id: '12',
        nome: 'Processos (via UAI) vistoriados para Alvarás de Localização',
        pontos: 10,
        campos: [
            { nome: 'n_processo', label: 'N° do Processo', tipo: 'text', obrigatorio: true },
            { nome: 'descricao', label: 'Descrição', tipo: 'text', obrigatorio: true },
            { nome: 'data', label: 'Data', tipo: 'date', obrigatorio: true }
        ]
    },
    {
        id: '13',
        nome: 'Processos respondidos (vistoriados)',
        pontos: 20,
        campos: [
            { nome: 'n_processo', label: 'N° do Processo', tipo: 'text', obrigatorio: true },
            { nome: 'descricao', label: 'Descrição', tipo: 'text', obrigatorio: true },
            { nome: 'data', label: 'Data', tipo: 'date', obrigatorio: true }
        ]
    },
    {
        id: '14',
        nome: 'Notificação Preliminar expedidos',
        pontos: 20,
        campos: [
            { nome: 'n_notificacao', label: 'N° da Notificação', tipo: 'text', obrigatorio: true },
            { nome: 'descricao', label: 'Descrição', tipo: 'text', obrigatorio: true },
            { nome: 'data', label: 'Data', tipo: 'date', obrigatorio: true }
        ]
    },
    {
        id: '15',
        nome: 'Notificação Preliminar regularizados (atendidos)',
        pontos: 20,
        campos: [
            { nome: 'n_notificacao', label: 'N° da Notificação', tipo: 'text', obrigatorio: true },
            { nome: 'descricao', label: 'Descrição', tipo: 'text', obrigatorio: true },
            { nome: 'data', label: 'Data', tipo: 'date', obrigatorio: true }
        ]
    },
    {
        id: '16',
        nome: 'Autos de Infração expedidos',
        pontos: 30,
        campos: [
            { nome: 'n_auto', label: 'N° do Auto', tipo: 'text', obrigatorio: true },
            { nome: 'descricao', label: 'Descrição', tipo: 'text', obrigatorio: true },
            { nome: 'data', label: 'Data', tipo: 'date', obrigatorio: true }
        ]
    },
    {
        id: '17',
        nome: 'Informação à Fiscalização de Obras de imóveis não cadastrados',
        pontos: 5,
        campos: [
            { nome: 'descricao', label: 'Descrição do Imóvel', tipo: 'text', obrigatorio: true },
            { nome: 'endereco', label: 'Endereço', tipo: 'text', obrigatorio: true },
            { nome: 'data', label: 'Data', tipo: 'date', obrigatorio: true }
        ]
    },
    {
        id: '18',
        nome: 'Vistoria de Rotina no Camelódromo e em Feiras (por hora)',
        pontos: 15,
        por_hora: true,
        campo_horas: 'duracao',
        campos: [
            { nome: 'local', label: 'Local', tipo: 'text', obrigatorio: true },
            { nome: 'duracao', label: 'Duração (horas)', tipo: 'number', obrigatorio: true },
            { nome: 'data', label: 'Data', tipo: 'date', obrigatorio: true }
        ]
    },
    {
        id: '19',
        nome: 'Emissão de Licenças (Bancas, Barracas, Panfletagem, Mesa e Cadeira, Propaganda Sonora)',
        pontos: 80,
        campos: [
            { nome: 'tipo_licenca', label: 'Tipo de Licença', tipo: 'text', obrigatorio: true },
            { nome: 'n_licenca', label: 'N° da Licença', tipo: 'text', obrigatorio: true },
            { nome: 'data', label: 'Data', tipo: 'date', obrigatorio: true }
        ]
    },
    {
        id: '20',
        nome: 'Vistoria de Controle de Caçambas',
        pontos: 10,
        campos: [
            { nome: 'local', label: 'Local', tipo: 'text', obrigatorio: true },
            { nome: 'descricao', label: 'Descrição', tipo: 'text', obrigatorio: true },
            { nome: 'data', label: 'Data', tipo: 'date', obrigatorio: true }
        ]
    },
    {
        id: '21',
        nome: 'Vistoria de água servida em via pública e ligação de esgoto irregular',
        pontos: 30,
        campos: [
            { nome: 'local', label: 'Local / Endereço', tipo: 'text', obrigatorio: true },
            { nome: 'descricao', label: 'Descrição', tipo: 'text', obrigatorio: true },
            { nome: 'data', label: 'Data', tipo: 'date', obrigatorio: true }
        ]
    },
    {
        id: '22',
        nome: 'Levantamento para arquivo fotográfico de irregularidades',
        pontos: 5,
        campos: [
            { nome: 'local', label: 'Local', tipo: 'text', obrigatorio: true },
            { nome: 'descricao', label: 'Descrição da Irregularidade', tipo: 'text', obrigatorio: true },
            { nome: 'data', label: 'Data', tipo: 'date', obrigatorio: true }
        ]
    },
    {
        id: '23',
        nome: 'Apreensão de mercadorias e objetos expostos em via pública sem autorização',
        pontos: 50,
        campos: [
            { nome: 'local', label: 'Local', tipo: 'text', obrigatorio: true },
            { nome: 'especie', label: 'Espécie de Mercadoria', tipo: 'text', obrigatorio: true },
            { nome: 'descricao', label: 'Descrição', tipo: 'text', obrigatorio: true },
            { nome: 'data', label: 'Data', tipo: 'date', obrigatorio: true }
        ]
    },
    {
        id: '24',
        nome: 'Expedição de Termo de Interdição de estabelecimentos',
        pontos: 50,
        campos: [
            { nome: 'estabelecimento', label: 'Nome do Estabelecimento', tipo: 'text', obrigatorio: true },
            { nome: 'tipo', label: 'Tipo (Comercial / Industrial / Educacional / Público)', tipo: 'text', obrigatorio: true },
            { nome: 'data', label: 'Data', tipo: 'date', obrigatorio: true }
        ]
    },
    {
        id: '25',
        nome: 'Cumprimento do Termo de Interdição de estabelecimentos',
        pontos: 50,
        campos: [
            { nome: 'estabelecimento', label: 'Nome do Estabelecimento', tipo: 'text', obrigatorio: true },
            { nome: 'tipo', label: 'Tipo (Comercial / Industrial / Educacional / Público)', tipo: 'text', obrigatorio: true },
            { nome: 'data', label: 'Data', tipo: 'date', obrigatorio: true }
        ]
    },
    {
        id: '26',
        nome: 'Cassação de Alvarás de Localização e funcionamento, devido a irregularidades',
        pontos: 30,
        campos: [
            { nome: 'estabelecimento', label: 'Nome do Estabelecimento', tipo: 'text', obrigatorio: true },
            { nome: 'n_alvara', label: 'N° do Alvará', tipo: 'text', obrigatorio: true },
            { nome: 'data', label: 'Data', tipo: 'date', obrigatorio: true }
        ]
    },
    {
        id: '27',
        nome: 'Cassação de Licenças (Bancas, Barracas, Panfletagem, Mesa e Cadeira, Propaganda Sonora)',
        pontos: 30,
        campos: [
            { nome: 'tipo_licenca', label: 'Tipo de Licença', tipo: 'text', obrigatorio: true },
            { nome: 'n_licenca', label: 'N° da Licença', tipo: 'text', obrigatorio: true },
            { nome: 'data', label: 'Data', tipo: 'date', obrigatorio: true }
        ]
    },
    {
        id: '28',
        nome: 'Plantão fiscal na repartição, por hora trabalhada',
        pontos: 10,
        por_hora: true,
        campo_horas: 'duracao',
        campos: [
            { nome: 'descricao', label: 'Descrição do Serviço', tipo: 'text', obrigatorio: true },
            { nome: 'duracao', label: 'Duração (horas)', tipo: 'number', obrigatorio: true },
            { nome: 'data', label: 'Data', tipo: 'date', obrigatorio: true }
        ]
    },
    {
        id: '29',
        nome: 'Treinamento e/ou aperfeiçoamento (cursos, seminários, reuniões), por hora',
        pontos: 10,
        por_hora: true,
        campo_horas: 'duracao',
        campos: [
            { nome: 'descricao', label: 'Descrição do Treinamento', tipo: 'text', obrigatorio: true },
            { nome: 'duracao', label: 'Duração (horas)', tipo: 'number', obrigatorio: true },
            { nome: 'data', label: 'Data', tipo: 'date', obrigatorio: true }
        ]
    },
    {
        id: '30',
        nome: 'Operações diversas de fiscalização, por hora trabalhada',
        pontos: 10,
        por_hora: true,
        campo_horas: 'duracao',
        campos: [
            { nome: 'descricao', label: 'Descrição da Operação', tipo: 'text', obrigatorio: true },
            { nome: 'duracao', label: 'Duração (horas)', tipo: 'number', obrigatorio: true },
            { nome: 'data', label: 'Data', tipo: 'date', obrigatorio: true }
        ]
    }
];

// --- VARIÁVEIS GLOBAIS ---
let categoriaAtual = null;

// --- RENDERIZAR BOTÕES DE CATEGORIAS ---
function renderizarCategorias() {
    const grid = document.getElementById('categorias-grid');
    if (!grid) return;

    grid.innerHTML = '';

    const destaques = CATEGORIAS.filter(c => c.destaque);
    const normais = CATEGORIAS.filter(c => !c.destaque);

    // Seção: Controle Processual
    if (destaques.length > 0) {
        const tituloSec = document.createElement('div');
        tituloSec.className = 'grid-secao-titulo';
        tituloSec.textContent = 'Controle Processual';
        grid.appendChild(tituloSec);

        destaques.forEach(cat => {
            grid.appendChild(criarCard(cat));
        });
    }

    // Separador
    if (destaques.length > 0 && normais.length > 0) {
        const separador = document.createElement('div');
        separador.className = 'grid-secao-titulo';
        separador.textContent = 'Categorias Gerais';
        grid.appendChild(separador);
    }

    // Seção: Categorias gerais
    normais.forEach(cat => {
        grid.appendChild(criarCard(cat));
    });
}

function criarCard(cat) {
    const card = document.createElement('div');
    card.className = cat.destaque ? 'categoria-card categoria-destaque' : 'categoria-card';
    card.onclick = () => abrirFormulario(cat);
    card.innerHTML = `
        ${cat.icone ? `<div class="card-icon">${cat.icone}</div>` : ''}
        <div class="card-title">${cat.id}° - ${cat.nome}</div>
        <div class="card-pontos">${cat.pontos} pts ${cat.por_hora ? 'por hora' : 'por unidade'}</div>
    `;
    return card;
}

// --- ABRIR MODAL COM FORMULÁRIO ---
function abrirFormulario(categoria) {
    categoriaAtual = categoria;
    const overlay = document.getElementById('modal-produtividade');
    const titulo = document.getElementById('modal-titulo');
    const corpo = document.getElementById('modal-campos');

    titulo.textContent = categoria.nome;
    corpo.innerHTML = '';
    window.arquivoWordSubmissao = null; // Zera anexo em memória ao abrir novo form

    // SE for Notificação Preliminar (1.1) ou Protocolo (1.6), adicionar botão extra de Autopreenchimento de Word no topo
    if (categoria.id === '1.1' || categoria.id === '1.6') {
        const divWord = document.createElement('div');
        divWord.className = 'campo-grupo';
        divWord.style.background = 'rgba(46, 204, 113, 0.1)';
        divWord.style.padding = '15px';
        divWord.style.borderRadius = '10px';
        divWord.style.border = '1px dashed #2ecc71';
        divWord.style.marginBottom = '20px';

        divWord.innerHTML = `
            <label style="color: #166534; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                Preenchimento Automático (Word)
            </label>
            <p style="font-size: 0.8rem; color: #475569; margin-bottom: 10px;">Anexe o modelo preenchido (.docx) para que o sistema digite os campos automaticamente para você:</p>
            <input type="file" id="input-word-autopreencher" accept=".docx" onchange="processarWordNotificacao(event)" style="font-size: 0.85rem; padding: 8px;">
            <p id="msg-word-status" style="font-size: 0.8rem; margin-top: 8px; font-weight: 600;"></p>
        `;
        corpo.appendChild(divWord);
    }

    // Gerar campos dinamicamente
    categoria.campos.forEach(campo => {
        const grupo = document.createElement('div');
        grupo.className = 'campo-grupo';

        let inputHTML = '';
        if (campo.tipo === 'textarea') {
            inputHTML = `<textarea id="campo-${campo.nome}" rows="3" ${campo.obrigatorio ? 'required' : ''}></textarea>`;
        } else if (campo.tipo === 'select') {
            const opcoes = campo.opcoes.map(op => `<option value="${op}">${op}</option>`).join('');
            inputHTML = `<select id="campo-${campo.nome}" ${campo.obrigatorio ? 'required' : ''}><option value="">Selecione...</option>${opcoes}</select>`;
        } else if (campo.tipo === 'select_custom') {
            const storageKey = `custom_opts_${categoria.id}_${campo.nome}`;
            const customOpts = JSON.parse(localStorage.getItem(storageKey) || '[]');

            // Opções fixas (sem lixeira) + customizadas (com lixeira)
            let opcoesListHTML = campo.opcoes.map(op =>
                `<div class="dropdown-item" onclick="selecionarOpcao('${campo.nome}', '${op.replace(/'/g, "\\'")}')">${op}</div>`
            ).join('');

            customOpts.forEach(op => {
                opcoesListHTML += `<div class="dropdown-item dropdown-item-custom" onclick="selecionarOpcao('${campo.nome}', '${op.replace(/'/g, "\\'")}')">
                    <span>${op}</span>
                    <button class="dropdown-delete" onclick="event.stopPropagation(); removerOpcaoCustom('${categoria.id}', '${campo.nome}', '${op.replace(/'/g, "\\'")}')">🗑</button>
                </div>`;
            });

            opcoesListHTML += `<div class="dropdown-item dropdown-item-outro" onclick="mostrarInputOutro('${campo.nome}')">Outro...</div>`;

            inputHTML = `
                <input type="hidden" id="campo-${campo.nome}" value="">
                <div class="dropdown-custom" id="dropdown-${campo.nome}">
                    <div class="dropdown-trigger" onclick="toggleDropdown('${campo.nome}')">
                        <span class="dropdown-texto">Selecione...</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </div>
                    <div class="dropdown-lista" id="dropdown-lista-${campo.nome}">
                        ${opcoesListHTML}
                    </div>
                </div>
                <div id="outro-container-${campo.nome}" style="display:none; margin-top:8px;">
                    <input type="text" id="outro-input-${campo.nome}" placeholder="Digite o novo motivo...">
                    <button type="button" class="btn-add-outro" onclick="adicionarOpcaoCustom('${categoria.id}', '${campo.nome}')">Adicionar</button>
                </div>
            `;
        } else if (campo.tipo === 'file') {
            inputHTML = `<input type="file" id="campo-${campo.nome}" accept="${campo.aceitar || '*'}" ${campo.obrigatorio ? 'required' : ''}>`;
        } else {
            inputHTML = `<input type="${campo.tipo}" id="campo-${campo.nome}" ${campo.obrigatorio ? 'required' : ''}>`;
        }

        grupo.innerHTML = `
            <label for="campo-${campo.nome}">${campo.label} ${campo.obrigatorio ? '*' : ''}</label>
            ${inputHTML}
        `;

        if (campo.agrupar) {
            let containerAgrupador = document.getElementById(`grupo-${campo.agrupar}`);
            if (!containerAgrupador) {
                // Criação do Row-Flex
                const wrapper = document.createElement('div');
                wrapper.style.marginBottom = '15px';

                const labelAgrupada = document.createElement('label');
                labelAgrupada.textContent = campo.agrupar === 'inscricao' ? 'Inscrição Imobiliária Municipal' : '';
                labelAgrupada.style.fontWeight = '600';
                labelAgrupada.style.color = '#475569';
                labelAgrupada.style.display = 'block';
                labelAgrupada.style.marginBottom = '5px';

                containerAgrupador = document.createElement('div');
                containerAgrupador.id = `grupo-${campo.agrupar}`;
                containerAgrupador.style.display = 'flex';
                containerAgrupador.style.gap = '10px';
                containerAgrupador.style.width = '100%';

                wrapper.appendChild(labelAgrupada);
                wrapper.appendChild(containerAgrupador);
                corpo.appendChild(wrapper);
            }
            grupo.style.flex = '1';
            grupo.style.marginBottom = '0';
            // Simplificar label em agrupados pequenos
            const grpLabel = grupo.querySelector('label');
            grpLabel.style.fontSize = '0.75rem';
            containerAgrupador.appendChild(grupo);
        } else {
            corpo.appendChild(grupo);
        }
    });

    // Se for Auto de Infração/Ofício/Relatório/Réplica, troca o botão Salvar por Gerar Documento
    const btnSalvarForm = document.querySelector('#modal-produtividade .btn-salvar');
    if (categoria.id === '1.2') {
        btnSalvarForm.textContent = 'Gerar Documento';
        btnSalvarForm.onclick = () => abrirEditorAutoInfracao();
    } else if (categoria.id === '1.4') {
        btnSalvarForm.textContent = 'Gerar Documento';
        btnSalvarForm.onclick = () => abrirEditorOficio();
    } else if (categoria.id === '1.5') {
        btnSalvarForm.textContent = 'Gerar Documento';
        btnSalvarForm.onclick = () => abrirEditorRelatorio();
    } else if (categoria.id === '1.7') {
        btnSalvarForm.textContent = 'Gerar Documento';
        btnSalvarForm.onclick = () => abrirEditorReplica();
    } else {
        btnSalvarForm.textContent = 'Salvar';
        btnSalvarForm.onclick = () => salvarRegistro();
    }

    overlay.classList.add('ativo');
}

// --- FECHAR MODAL ---
function fecharModal() {
    const overlay = document.getElementById('modal-produtividade');
    overlay.classList.remove('ativo');
    categoriaAtual = null;
}

// --- SALVAR REGISTRO ---
let salvando = false;
async function salvarRegistro(blobManual = null, nomeManual = null) {
    if (!categoriaAtual || salvando) return;
    salvando = true;

    // 1. Coletar valores dos campos
    const campos = {};
    let todosPreenchidos = true;
    let arquivoAnexo = null; // para upload de PDF

    if (blobManual && nomeManual) {
        arquivoAnexo = {
            nome: 'anexo_pdf',
            file: new File([blobManual], nomeManual, { type: 'application/pdf' })
        };
    }

    categoriaAtual.campos.forEach(campo => {
        const input = document.getElementById(`campo-${campo.nome}`);

        if (campo.tipo === 'file') {
            if (arquivoAnexo && arquivoAnexo.file) return; // Se ja forneceu um auto-file via prop manual

            // Tratar campo de arquivo
            if (campo.obrigatorio && (!input.files || input.files.length === 0)) {
                todosPreenchidos = false;
                input.style.borderColor = '#ef4444';
            } else if (input.files && input.files.length > 0) {
                const fileSubmit = input.files[0];

                // Validação de segurança anti-burlar extensão:
                if (campo.aceitar) {
                    const permitidos = campo.aceitar.split(',').map(ext => ext.trim().toLowerCase());
                    const extensaoAnexo = fileSubmit.name.substring(fileSubmit.name.lastIndexOf('.')).toLowerCase();

                    if (!permitidos.includes(extensaoAnexo)) {
                        alert(`Arquivo inválido em "${campo.label}". \nPor favor, envie apenas nos formatos permitidos: ${permitidos.join(', ')}`);
                        todosPreenchidos = false;
                        input.style.borderColor = '#ef4444';
                        input.value = ''; // Limpa o input fakeado
                        return; // Trava o envio
                    }
                }

                arquivoAnexo = { nome: campo.nome, file: fileSubmit };
                input.style.borderColor = '#e2e8f0';
            }
            return; // não salvar no campos — será salvo como URL após upload
        }

        let valor = input.value.trim();

        if (campo.obrigatorio && !valor) {
            todosPreenchidos = false;
            if (campo.tipo === 'select_custom') {
                const trigger = document.querySelector(`#dropdown-${campo.nome} .dropdown-trigger`);
                if (trigger) trigger.style.borderColor = '#ef4444';
            } else {
                input.style.borderColor = '#ef4444';
            }
        } else {
            input.style.borderColor = '#e2e8f0';
        }

        if (!campo.ignorarNoBanco) {
            campos[campo.nome] = valor;
        }
    });

    if (!todosPreenchidos) {
        alert('Preencha todos os campos obrigatórios!');
        salvando = false;
        return;
    }

    // 2. Obter usuário logado
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
        alert('Sessão expirada! Faça login novamente.');
        salvando = false;
        window.location.href = 'index.html';
        return;
    }

    // 3. Determinar pontuação (variável por tipo ou fixa)
    let pontosPorUnidade = categoriaAtual.pontos;
    if (categoriaAtual.pontos_por_tipo && campos.tipo) {
        pontosPorUnidade = categoriaAtual.pontos_por_tipo[campos.tipo] || categoriaAtual.pontos;
    }

    // 4. Multiplicar por horas se for categoria por hora
    let pontos = pontosPorUnidade;
    if (categoriaAtual.por_hora && categoriaAtual.campo_horas) {
        const horas = parseFloat(campos[categoriaAtual.campo_horas]) || 0;
        pontos = pontosPorUnidade * horas;
    }

    // 5. Salvar no Supabase
    const btnSalvar = document.querySelector('#modal-produtividade .btn-salvar');
    const oldTexto = btnSalvar ? btnSalvar.textContent : 'Salvar';
    if (btnSalvar) {
        btnSalvar.textContent = 'Carregando...';
        btnSalvar.disabled = true;
    }

    try {
        let data, error;
        const isCP = categoriaAtual.destaque === true;
        const tabela = isCP ? 'controle_processual' : 'registros_produtividade';

        if (modoEdicao && idEditando) {
            // EDIÇÃO: atualizar registro existente
            ({ data, error } = await supabaseClient
                .from(tabela)
                .update({
                    pontuacao: pontos,
                    campos: campos
                })
                .eq('id', idEditando)
                .select());
        } else {
            // CRIAÇÃO
            if (isCP) {
                // Buscar nome do fiscal
                const { data: perfil } = await supabaseClient
                    .from('profiles')
                    .select('full_name')
                    .eq('id', user.id)
                    .single();
                const fiscalNome = perfil?.full_name || 'Fiscal';

                // Gerar número sequencial se necessário (AI, Ofício, Relatório, Réplica)
                let numeroSeq = null;
                const categoriasAutoNum = ['1.2', '1.4', '1.5', '1.7'];
                if (categoriasAutoNum.includes(categoriaAtual.id)) {
                    numeroSeq = await gerarNumeroSequencial(categoriaAtual.id);
                }

                ({ data, error } = await supabaseClient
                    .from('controle_processual')
                    .insert({
                        user_id: user.id,
                        fiscal_nome: fiscalNome,
                        categoria_id: categoriaAtual.id,
                        categoria_nome: categoriaAtual.nome,
                        numero_sequencial: numeroSeq,
                        pontuacao: pontos,
                        campos: campos
                    })
                    .select());
            } else {
                ({ data, error } = await supabaseClient
                    .from('registros_produtividade')
                    .insert({
                        user_id: user.id,
                        categoria_id: categoriaAtual.id,
                        categoria_nome: categoriaAtual.nome,
                        pontuacao: pontos,
                        campos: campos
                    })
                    .select());
            }
        }

        if (error) {
            throw error;
        }

        // Upload de arquivo anexo (se houver)
        if (arquivoAnexo && data && data.length > 0) {
            const registroId = data[0].id;
            // Limpar acentos e espaços do nome para não dar erro no Supabase
            let nomeAnexoLimpo = arquivoAnexo.file.name
                .normalize('NFD')                     // Remove acentos
                .replace(/[\u0300-\u036f]/g, '')      // Limpa os diacríticos
                .replace(/\s+/g, '_')                 // Troca espaços por underscore
                .replace(/[^a-zA-Z0-9_\-\.]/g, '');   // Remove caracteres especiais

            const nomeArquivo = `${registroId}_${nomeAnexoLimpo}`;
            const caminho = `${user.id}/${nomeArquivo}`;
            const tabela = categoriaAtual.destaque ? 'controle_processual' : 'registros_produtividade';

            const { error: uploadError } = await supabaseClient.storage
                .from('anexos')
                .upload(caminho, arquivoAnexo.file, { upsert: true });

            if (uploadError) {
                console.error('Erro no upload:', uploadError);
                alert('Registro salvo, mas erro ao anexar PDF: ' + uploadError.message);
            } else {
                // Salvar caminho do arquivo no registro
                const { data: urlData } = supabaseClient.storage.from('anexos').getPublicUrl(caminho);
                const camposAtualizados = { ...campos, [arquivoAnexo.nome]: urlData.publicUrl };

                await supabaseClient
                    .from(tabela)
                    .update({ campos: camposAtualizados })
                    .eq('id', registroId);
            }
        }

        // Resetar modo edição
        const eraEdicao = modoEdicao;
        modoEdicao = false;
        idEditando = null;

        // Fechar modal e atualizar histórico
        fecharModal();
        carregarHistorico();
        alert(eraEdicao ? 'Registro atualizado com sucesso!' : '✅ Registro salvo com sucesso! (' + pontos + ' pontos)');
    } catch (err) {
        console.error("Erro no salvarRegistro:", err);
        alert('Ocorreu um erro ao salvar o registro no banco de dados.');
    } finally {
        if (btnSalvar) {
            btnSalvar.textContent = oldTexto;
            btnSalvar.disabled = false;
        }
        salvando = false;
    }
}

// --- CARREGAR HISTÓRICO ---
let todosRegistros = []; // Armazena globalmente para filtrar

// --- FUNÇÃO AUXILIAR DE DATA REAL ---
// Procura pela data preenchida nos campos do formulário para exibir a data correta
// da ação, em vez da data em que o registro foi digitado no sistema (created_at)
function obterDataReal(reg) {
    if (!reg.campos) return new Date(reg.created_at);

    // Procura por qualquer campo que tenha "data" no nome e tenha um valor válido
    for (const [chave, valor] of Object.entries(reg.campos)) {
        if (chave.includes('data') && valor && typeof valor === 'string') {
            // Verifica se o formato é YYYY-MM-DD
            if (valor.match(/^\d{4}-\d{2}-\d{2}$/)) {
                // Adiciona T12:00:00 para evitar problemas de fuso horário que movem a data 1 dia pra trás
                return new Date(valor + 'T12:00:00');
            }
        }
    }
    return new Date(reg.created_at);
}

async function carregarHistorico() {
    const container = document.getElementById('historico-lista');
    const pontuacaoEl = document.getElementById('pontuacao-total');
    if (!container) return;

    // Buscar usuário atual
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    // Buscar registros de produtividade (RLS filtra pelo próprio fiscal)
    const { data: regProd, error: errProd } = await supabaseClient
        .from('registros_produtividade')
        .select('*')
        .order('created_at', { ascending: false });

    // Buscar registros de CP do próprio fiscal
    const { data: regCP, error: errCP } = await supabaseClient
        .from('controle_processual')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (errProd || errCP) {
        console.error('Erro ao carregar histórico:', errProd || errCP);
        container.innerHTML = '<div class="historico-vazio">Erro ao carregar histórico.</div>';
        return;
    }

    // Combinar registros (marcando origem para saber a tabela na edição/exclusão)
    const prodMarcados = (regProd || []).map(r => ({ ...r, _tabela: 'registros_produtividade' }));
    const cpMarcados = (regCP || []).map(r => ({ ...r, _tabela: 'controle_processual' }));

    // Juntar e ordenar usando a data REAL do evento (informada no formulário)
    todosRegistros = [...prodMarcados, ...cpMarcados].sort((a, b) =>
        obterDataReal(b) - obterDataReal(a)
    );

    // Calcular pontuação total
    const pontuacaoTotal = todosRegistros.reduce((total, r) => total + r.pontuacao, 0);

    // Atualiza cards de Histórico Pessoal
    if (pontuacaoEl) pontuacaoEl.textContent = pontuacaoTotal;
    const totalRegistrosHistEl = document.getElementById('total-registros-hist');
    if (totalRegistrosHistEl) totalRegistrosHistEl.textContent = todosRegistros.length;

    // Atualiza cards de Resumo (Home)
    const pontuacaoResEl = document.getElementById('pontuacao-resumo-total');
    if (pontuacaoResEl) pontuacaoResEl.textContent = pontuacaoTotal;
    const totalRegistrosEl = document.getElementById('total-registros');
    if (totalRegistrosEl) totalRegistrosEl.textContent = todosRegistros.length;

    // Atualiza cards da Produtividade
    const pontuacaoProdEl = document.getElementById('pontuacao-prod-total');
    if (pontuacaoProdEl) pontuacaoProdEl.textContent = pontuacaoTotal;
    const totalRegistrosProdEl = document.getElementById('total-registros-prod');
    if (totalRegistrosProdEl) totalRegistrosProdEl.textContent = todosRegistros.length;

    popularFiltroCategorias();
    renderizarTabela(todosRegistros);
    renderizarGrafico(todosRegistros);
    verificarMeta2000(pontuacaoTotal);
}

// --- POPULAR DROPDOWN DE CATEGORIAS ---
function popularFiltroCategorias() {
    const select = document.getElementById('filtro-categoria');
    if (!select) return;

    // Pegar categorias únicas dos registros
    const categoriasUsadas = [...new Set(todosRegistros.map(r => r.categoria_id))];

    // Manter o valor selecionado
    const valorAtual = select.value;

    // Limpar e re-popular
    select.innerHTML = '<option value="">Todas</option>';

    categoriasUsadas.sort((a, b) => {
        const numA = parseInt(a) || 0;
        const numB = parseInt(b) || 0;
        return numA - numB;
    });

    categoriasUsadas.forEach(catId => {
        const registro = todosRegistros.find(r => r.categoria_id === catId);
        const option = document.createElement('option');
        option.value = catId;
        option.textContent = `${catId}° - ${registro.categoria_nome}`;
        select.appendChild(option);
    });

    select.value = valorAtual;
}

// --- FILTRAR HISTÓRICO ---
function filtrarHistorico() {
    const categoriaFiltro = document.getElementById('filtro-categoria').value;
    const buscaFiltro = document.getElementById('filtro-busca').value.toLowerCase().trim();

    let filtrados = todosRegistros;

    // Filtrar por categoria
    if (categoriaFiltro) {
        filtrados = filtrados.filter(r => r.categoria_id === categoriaFiltro);
    }

    // Filtrar por busca
    if (buscaFiltro) {
        filtrados = filtrados.filter(r => {
            const campos = r.campos || {};
            const textoCompleto = [
                r.categoria_nome,
                r.categoria_id,
                ...Object.values(campos)
            ].join(' ').toLowerCase();
            return textoCompleto.includes(buscaFiltro);
        });
    }

    renderizarTabela(filtrados);
}

// --- RENDERIZAR TABELA ---
function renderizarTabela(registros) {
    const container = document.getElementById('historico-lista');
    if (!container) return;

    if (!registros || registros.length === 0) {
        container.innerHTML = '<div class="historico-vazio">Nenhum registro encontrado.</div>';
        return;
    }

    let html = `
        <table class="tabela-historico">
            <thead>
                <tr>
                    <th>Data</th>
                    <th>Categoria</th>
                    <th>Detalhes</th>
                    <th>Pontos</th>
                </tr>
            </thead>
            <tbody>
    `;

    registros.forEach(reg => {
        const dataReal = obterDataReal(reg);
        const data = dataReal.toLocaleDateString('pt-BR');
        const hora = new Date(reg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        // Montar resumo dos campos (excluindo datas)
        const campos = reg.campos || {};
        const resumo = Object.entries(campos)
            .filter(([k, v]) => !k.includes('data') && !k.startsWith('anexo_') && v)
            .map(([k, v]) => v)
            .join(' · ');

        html += `
            <tr onclick="abrirDetalhes('${reg.id}')">
                <td>${data}<br><small style="color:#94a3b8">${hora}</small></td>
                <td><span class="badge-categoria">${reg.categoria_id}°</span></td>
                <td>${resumo || '—'}</td>
                <td><span class="badge-pontos">+${reg.pontuacao}</span></td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

// --- DETALHES DO REGISTRO ---
let registroSelecionado = null;

function abrirDetalhes(id) {
    const reg = todosRegistros.find(r => r.id === id);
    if (!reg) return;
    registroSelecionado = reg;

    const overlay = document.getElementById('modal-detalhes');
    const titulo = document.getElementById('detalhe-titulo');
    const corpo = document.getElementById('detalhe-campos');

    titulo.textContent = `${reg.categoria_id}° - ${reg.categoria_nome}`;

    // Buscar definição dos campos da categoria
    const catDef = CATEGORIAS.find(c => c.id === reg.categoria_id);
    const campos = reg.campos || {};

    let html = '';

    // Data do registro no sistema
    const dataReg = new Date(reg.created_at).toLocaleDateString('pt-BR');
    const horaReg = new Date(reg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    html += `<div class="detalhe-item"><span class="detalhe-label">Registrado em</span><span class="detalhe-valor">${dataReg} às ${horaReg}</span></div>`;

    // Campos com labels descritivos
    Object.entries(campos).forEach(([chave, valor]) => {
        if (!valor) return;

        // Campos de anexo — mostrar botão de visualização (NÃO no histórico geral)
        if (chave.startsWith('anexo_')) {
            html += `<div class="detalhe-item" style="margin-top: 12px;">
                <a href="${valor}" target="_blank" class="btn-ver-anexo">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    Ver Anexo (PDF)
                </a>
            </div>`;
            return;
        }

        // Buscar label da definição
        let label = chave;
        let ignorarExibicao = false;
        if (catDef) {
            const campoDef = catDef.campos.find(c => c.nome === chave);
            if (campoDef) {
                label = campoDef.label;
                ignorarExibicao = campoDef.ignorarNoBanco;
            }
        }

        if (!ignorarExibicao) {
            html += `<div class="detalhe-item"><span class="detalhe-label">${label}</span><span class="detalhe-valor">${valor}</span></div>`;
        }
    });

    // Pontuação
    html += `<div style="text-align:center; margin-top:8px;"><span class="detalhe-pontuacao">+${reg.pontuacao} pontos</span></div>`;

    corpo.innerHTML = html;

    // Ocultar botão "Editar" se for categoria geradora de documentos (1.2, 1.4, 1.5, 1.7)
    // No modal html, esse botão possui a class .btn-salvar e fica no footer.
    const btnEditar = overlay.querySelector('.btn-salvar');
    const categoriasBloqueadas = ['1.2', '1.4', '1.5', '1.7'];

    if (btnEditar) {
        if (categoriasBloqueadas.includes(reg.categoria_id)) {
            btnEditar.style.display = 'none';
        } else {
            btnEditar.style.display = 'inline-block'; // ou o block original dependendo do css
        }
    }

    overlay.classList.add('ativo');
}

function fecharDetalhes() {
    document.getElementById('modal-detalhes').classList.remove('ativo');
    registroSelecionado = null;
}

// --- EDITAR REGISTRO ---
let modoEdicao = false;
let idEditando = null;

function editarRegistro() {
    if (!registroSelecionado) return;

    const reg = registroSelecionado;

    // Trava de segurança extra para categorias geradoras de documentos
    const categoriasBloqueadas = ['1.2', '1.4', '1.5', '1.7'];
    if (categoriasBloqueadas.includes(reg.categoria_id)) {
        alert('Registros que geram documentos oficiais não podem ser editados. Exclua e crie um novo se houver erro.');
        return;
    }

    const catDef = CATEGORIAS.find(c => c.id === reg.categoria_id);
    if (!catDef) {
        alert('Categoria não encontrada para edição.');
        return;
    }

    // Fechar detalhes
    fecharDetalhes();

    // Abrir formulário em modo edição
    modoEdicao = true;
    idEditando = reg.id;
    categoriaAtual = catDef;

    const overlay = document.getElementById('modal-produtividade');
    const titulo = document.getElementById('modal-titulo');
    const corpo = document.getElementById('modal-campos');

    titulo.textContent = 'Editando: ' + catDef.nome;
    corpo.innerHTML = '';

    // Gerar campos dinamicamente e preencher com valores existentes
    catDef.campos.forEach(campo => {
        const grupo = document.createElement('div');
        grupo.className = 'campo-grupo';
        const valorAtual = reg.campos[campo.nome] || '';

        let inputHTML = '';
        if (campo.tipo === 'textarea') {
            inputHTML = `<textarea id="campo-${campo.nome}" rows="3" ${campo.obrigatorio ? 'required' : ''}>${valorAtual}</textarea>`;
        } else if (campo.tipo === 'select') {
            const opcoes = campo.opcoes.map(op =>
                `<option value="${op}" ${op === valorAtual ? 'selected' : ''}>${op}</option>`
            ).join('');
            inputHTML = `<select id="campo-${campo.nome}" ${campo.obrigatorio ? 'required' : ''}><option value="">Selecione...</option>${opcoes}</select>`;
        } else {
            inputHTML = `<input type="${campo.tipo}" id="campo-${campo.nome}" value="${valorAtual}" ${campo.obrigatorio ? 'required' : ''}>`;
        }

        grupo.innerHTML = `
            <label for="campo-${campo.nome}">${campo.label} ${campo.obrigatorio ? '*' : ''}</label>
            ${inputHTML}
        `;
        corpo.appendChild(grupo);
    });

    overlay.classList.add('ativo');
}

// --- EXCLUIR REGISTRO ---
async function excluirRegistro() {
    if (!registroSelecionado) return;

    const confirma = confirm('Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.');
    if (!confirma) return;

    const btnExcluir = document.querySelector('#modal-detalhes .btn-excluir');
    const oldTexto = btnExcluir ? btnExcluir.textContent : 'Excluir';

    if (btnExcluir) {
        btnExcluir.textContent = 'Excluindo...';
        btnExcluir.disabled = true;
    }

    try {
        const tabela = registroSelecionado._tabela || 'registros_produtividade';
        const { error } = await supabaseClient
            .from(tabela)
            .delete()
            .eq('id', registroSelecionado.id);

        if (error) {
            console.error('Erro ao excluir:', error);
            alert('Erro ao excluir: ' + error.message);
            return;
        }

        fecharDetalhes();
        carregarHistorico();
        alert('Registro excluído com sucesso.');
    } finally {
        if (btnExcluir) {
            btnExcluir.textContent = oldTexto;
            btnExcluir.disabled = false;
        }
    }
}

// --- DROPDOWN CUSTOMIZADO ---
function toggleDropdown(campoNome) {
    const lista = document.getElementById(`dropdown-lista-${campoNome}`);
    // Fechar outros dropdowns abertos
    document.querySelectorAll('.dropdown-lista.aberto').forEach(el => {
        if (el.id !== `dropdown-lista-${campoNome}`) el.classList.remove('aberto');
    });
    lista.classList.toggle('aberto');
}

function selecionarOpcao(campoNome, valor) {
    document.getElementById(`campo-${campoNome}`).value = valor;
    document.querySelector(`#dropdown-${campoNome} .dropdown-texto`).textContent = valor;
    document.getElementById(`dropdown-lista-${campoNome}`).classList.remove('aberto');
    // Esconder "Outro" se estava aberto
    document.getElementById(`outro-container-${campoNome}`).style.display = 'none';
}

function mostrarInputOutro(campoNome) {
    document.getElementById(`dropdown-lista-${campoNome}`).classList.remove('aberto');
    document.getElementById(`outro-container-${campoNome}`).style.display = 'flex';
    document.getElementById(`outro-input-${campoNome}`).focus();
    // Limpar seleção
    document.getElementById(`campo-${campoNome}`).value = '';
    document.querySelector(`#dropdown-${campoNome} .dropdown-texto`).textContent = 'Outro...';
}

function adicionarOpcaoCustom(catId, campoNome) {
    const input = document.getElementById(`outro-input-${campoNome}`);
    const novoValor = input.value.trim();
    if (!novoValor) return;

    const storageKey = `custom_opts_${catId}_${campoNome}`;
    const customOpts = JSON.parse(localStorage.getItem(storageKey) || '[]');

    if (!customOpts.includes(novoValor)) {
        customOpts.push(novoValor);
        localStorage.setItem(storageKey, JSON.stringify(customOpts));
    }

    // Fecha o campo texto e insere a nova opção na lista
    input.value = '';
    const containerOutro = document.getElementById(`outro-container-${campoNome}`);
    if (containerOutro) containerOutro.style.display = 'none';

    // Insere visualmente na lista sem recarregar o form
    const dropdownLista = document.getElementById(`dropdown-lista-${campoNome}`);
    if (dropdownLista) {
        const novoItemHTML = document.createElement('div');
        novoItemHTML.className = 'dropdown-item dropdown-item-custom';
        novoItemHTML.onclick = () => selecionarOpcao(campoNome, novoValor.replace(/'/g, "\\'"));
        novoItemHTML.innerHTML = `
            <span>${novoValor}</span>
            <button class="dropdown-delete" onclick="event.stopPropagation(); removerOpcaoCustom('${catId}', '${campoNome}', '${novoValor.replace(/'/g, "\\'")}')">🗑</button>
        `;
        // insere antes do botão 'Outro...'
        const btnOutro = dropdownLista.querySelector('.dropdown-item-outro');
        if (btnOutro) dropdownLista.insertBefore(novoItemHTML, btnOutro);
    }

    // Já deixa o novo valor selecionado
    selecionarOpcao(campoNome, novoValor);
}

function removerOpcaoCustom(catId, campoNome, valor) {
    const storageKey = `custom_opts_${catId}_${campoNome}`;
    let customOpts = JSON.parse(localStorage.getItem(storageKey) || '[]');
    customOpts = customOpts.filter(op => op !== valor);
    localStorage.setItem(storageKey, JSON.stringify(customOpts));

    // Re-abrir formulário
    const categoria = CATEGORIAS.find(c => c.id === catId);
    if (categoria) abrirFormulario(categoria);
}
// --- NUMERAÇÃO SEQUENCIAL AUTOMÁTICA ---
async function gerarNumeroSequencial(categoriaId) {
    const anoAtual = new Date().getFullYear().toString().slice(-2); // ex: "26"
    const digitos = categoriaId === '1.4' ? 4 : 3; // Ofício = 4 dígitos, resto = 3

    // Buscar o maior número do ano atual nessa categoria
    const { data: registros } = await supabaseClient
        .from('controle_processual')
        .select('numero_sequencial')
        .eq('categoria_id', categoriaId)
        .like('numero_sequencial', `%/${anoAtual}`)
        .order('numero_sequencial', { ascending: false })
        .limit(1);

    let proximo = 1;
    if (registros && registros.length > 0 && registros[0].numero_sequencial) {
        const partes = registros[0].numero_sequencial.split('/');
        proximo = parseInt(partes[0]) + 1;
    }

    return proximo.toString().padStart(digitos, '0') + '/' + anoAtual;
}

// --- HISTÓRICO GERAL (SUB-ABAS) ---
let subAbaAtual = '1.1';
let registrosGeralAtual = []; // Cache para filtro

function mudarSubAbaCP(categoriaId, btnEl) {
    subAbaAtual = categoriaId;
    document.querySelectorAll('.sub-aba-btn').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    // Limpar busca ao trocar sub-aba
    const buscaInput = document.getElementById('busca-historico-geral');
    if (buscaInput) buscaInput.value = '';
    carregarHistoricoGeral(categoriaId);
}

async function carregarHistoricoGeral(categoriaId) {
    const container = document.getElementById('historico-geral-lista');
    if (!container) return;

    container.innerHTML = '<div class="historico-vazio">Carregando...</div>';

    const { data: registros, error } = await supabaseClient
        .from('controle_processual')
        .select('*')
        .eq('categoria_id', categoriaId);

    if (error) {
        container.innerHTML = '<div class="historico-vazio">Erro ao carregar.</div>';
        return;
    }

    if (!registros || registros.length === 0) {
        registrosGeralAtual = [];
        container.innerHTML = '<div class="historico-vazio">Nenhum registro encontrado.</div>';
        return;
    }

    // Ordenar pela data informada no formulário
    const registrosOrdenados = registros.sort((a, b) => obterDataReal(b) - obterDataReal(a));

    registrosGeralAtual = registrosOrdenados;
    popularFiltroBairros(registrosOrdenados); // Popula o dropdown
    renderizarTabelaGeral(registrosOrdenados, categoriaId);
}

// Extrai bairros únicos e preenche o dropdown
function popularFiltroBairros(registros) {
    const select = document.getElementById('filtro-bairro-historico');
    if (!select) return;

    // Guardar a opção "Todos os Bairros"
    select.innerHTML = '<option value="">Todos os Bairros</option>';

    // Extrair os bairros que existem dentro do campo JSON "campos"
    const bairros = new Set();
    registros.forEach(reg => {
        if (reg.campos && reg.campos.bairro) {
            const b = reg.campos.bairro.trim();
            if (b) bairros.add(b);
        }
    });

    // Ordenar alfabeticamente e criar as tags <option>
    Array.from(bairros).sort().forEach(bairro => {
        const option = document.createElement('option');
        option.value = bairro;
        option.textContent = bairro;
        select.appendChild(option);
    });
}

// Filtro de busca misto: Texto Livre + Dropdown de Bairro
function filtrarHistoricoGeral() {
    const termo = document.getElementById('busca-historico-geral').value.toLowerCase().trim();
    const bairroSelecionado = document.getElementById('filtro-bairro-historico').value;

    let filtrados = registrosGeralAtual;

    // 1. Filtrar pelo Dropdown de Bairro (Exato)
    if (bairroSelecionado) {
        filtrados = filtrados.filter(reg =>
            reg.campos && reg.campos.bairro === bairroSelecionado
        );
    }

    // 2. Filtrar pelo Texto (Contém)
    if (termo) {
        const camposBusca = ['n_notificacao', 'n_auto', 'n_ar', 'n_oficio', 'n_relatorio', 'n_protocolo', 'n_replica', 'nome', 'bairro', 'n_inscricao'];

        filtrados = filtrados.filter(reg => {
            // Buscar no numero_sequencial
            if (reg.numero_sequencial && reg.numero_sequencial.toLowerCase().includes(termo)) return true;
            // Buscar nos campos do contribuinte (não fiscal)
            for (const campo of camposBusca) {
                if (reg.campos && reg.campos[campo] && reg.campos[campo].toString().toLowerCase().includes(termo)) return true;
            }
            return false;
        });
    }

    // Renderizar
    if (filtrados.length === 0) {
        document.getElementById('historico-geral-lista').innerHTML = '<div class="historico-vazio">Nenhum resultado para a busca.</div>';
    } else {
        renderizarTabelaGeral(filtrados, subAbaAtual);
    }
}

function renderizarTabelaGeral(registros, categoriaId) {
    const container = document.getElementById('historico-geral-lista');
    const categoria = CATEGORIAS.find(c => c.id === categoriaId);
    if (!categoria) return;

    const isGerente = window.userRoleGlobal === 'gerente fiscal' || window.userRoleGlobal === 'gerente' || window.userRoleGlobal === 'admin';

    // Colunas: Nº (se tiver), campos da categoria + Fiscal + Data
    const temNumero = registros.some(r => r.numero_sequencial);

    let headerHTML = '<tr>';
    if (temNumero) headerHTML += '<th>N°</th>';
    categoria.campos.forEach(campo => {
        if (campo.tipo !== 'date' && !campo.ignorarNoBanco) {
            headerHTML += `<th>${campo.label}</th>`;
        }
    });
    headerHTML += '<th>Fiscal</th><th>Data</th><th>Pontos</th>';
    if (isGerente) headerHTML += '<th>Anexo</th>';
    headerHTML += '</tr>';

    let bodyHTML = '';
    registros.forEach((reg, idx) => {
        const temAnexo = reg.campos && reg.campos.anexo_pdf;

        bodyHTML += '<tr>';
        if (temNumero) bodyHTML += `<td>${reg.numero_sequencial || '-'}</td>`;
        categoria.campos.forEach(campo => {
            if (campo.tipo !== 'date' && !campo.ignorarNoBanco) {
                bodyHTML += `<td>${reg.campos[campo.nome] || '-'}</td>`;
            }
        });
        const dataFormatada = obterDataReal(reg).toLocaleDateString('pt-BR');
        bodyHTML += `<td>${reg.fiscal_nome}</td><td>${dataFormatada}</td><td>${reg.pontuacao}</td>`;

        if (isGerente) {
            if (temAnexo) {
                bodyHTML += `<td><button onclick="abrirAnexoGerente('${reg.campos.anexo_pdf}')" style="background:#10b981;color:white;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">📄 Ver</button></td>`;
            } else {
                bodyHTML += `<td style="color:#94a3b8;font-size:12px;">—</td>`;
            }
        }
        bodyHTML += '</tr>';
    });

    container.innerHTML = `
        <div style="overflow-x: auto;">
            <table class="historico-tabela">
                <thead>${headerHTML}</thead>
                <tbody>${bodyHTML}</tbody>
            </table>
        </div>
        <p style="margin-top: 12px; font-size: 0.85rem; color: #64748b;">
            Total: ${registros.length} registro(s)
        </p>
    `;
}

// Modal para visualizar anexo do fiscal (apenas gerente)
function abrirAnexoGerente(url) {
    if (!url) {
        alert('Nenhum anexo encontrado.');
        return;
    }

    // Remover modal anterior se existir
    const existente = document.getElementById('modal-anexo-gerente');
    if (existente) existente.remove();

    const isPdf = url.toLowerCase().endsWith('.pdf');

    let conteudoHTML = '';
    if (isPdf) {
        conteudoHTML = '<iframe src="' + url + '" style="width:100%;height:70vh;border:none;border-radius:8px;"></iframe>';
    } else {
        conteudoHTML = '<div style="text-align:center;padding:40px;">'
            + '<p style="font-size:16px;color:#1e293b;margin-bottom:20px;">Este documento não pode ser visualizado diretamente.</p>'
            + '<a href="' + url + '" target="_blank" download style="background:#3b82f6;color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;">⬇ Baixar Documento</a>'
            + '</div>';
    }

    const modal = document.createElement('div');
    modal.id = 'modal-anexo-gerente';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;';

    modal.innerHTML = '<div style="background:white;border-radius:12px;width:90%;max-width:900px;max-height:90vh;overflow:auto;padding:20px;position:relative;">'
        + '<button onclick="document.getElementById(\'modal-anexo-gerente\').remove()" style="position:absolute;top:10px;right:14px;background:none;border:none;font-size:24px;cursor:pointer;color:#64748b;">✕</button>'
        + '<h3 style="margin-bottom:16px;color:#1e293b;">Documento Anexado</h3>'
        + conteudoHTML
        + '</div>';

    document.body.appendChild(modal);

    // Fechar ao clicar fora
    modal.addEventListener('click', function (e) {
        if (e.target === modal) modal.remove();
    });
}

// --- GRÁFICO DE PRODUTIVIDADE POR DIA ---
let graficoChart = null;

function renderizarGrafico(registros) {
    const canvas = document.getElementById('grafico-produtividade');
    if (!canvas || typeof Chart === 'undefined') return;

    // Agrupar pontos por dia
    const porDia = {};
    registros.forEach(r => {
        const dia = obterDataReal(r).toLocaleDateString('pt-BR');
        porDia[dia] = (porDia[dia] || 0) + r.pontuacao;
    });

    // Ordenar por data (mais antigo primeiro) formando as labels
    // Como os labels são "DD/MM/YYYY", precisamos converter pra Date pra ordenar corretamente
    const entradas = Object.entries(porDia).sort((a, b) => {
        const dataA = a[0].split('/').reverse().join('-');
        const dataB = b[0].split('/').reverse().join('-');
        return dataA.localeCompare(dataB);
    });
    const labels = entradas.map(e => e[0]);
    const dados = entradas.map(e => e[1]);

    // Acumulado
    let soma = 0;
    const acumulado = dados.map(v => { soma += v; return soma; });

    if (graficoChart) graficoChart.destroy();

    graficoChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Pontos no dia',
                    data: dados,
                    backgroundColor: 'rgba(46, 204, 113, 0.6)',
                    borderColor: '#2ecc71',
                    borderWidth: 1,
                    borderRadius: 6
                },
                {
                    label: 'Acumulado',
                    data: acumulado,
                    type: 'line',
                    borderColor: '#0c3e2b',
                    backgroundColor: 'rgba(12, 62, 43, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 4,
                    pointBackgroundColor: '#0c3e2b',
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: { display: true, position: 'top' },
                annotation: {
                    annotations: {
                        meta: {
                            type: 'line',
                            yMin: 2000,
                            yMax: 2000,
                            borderColor: '#f59e0b',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            label: {
                                display: true,
                                content: 'Meta: 2000',
                                position: 'end'
                            }
                        }
                    }
                }
            },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Pontos/dia' } },
                y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Acumulado' } }
            }
        }
    });
}

// --- META 2000 PONTOS ---
function verificarMeta2000(pontuacaoTotal) {
    const badge = document.getElementById('meta-2000');
    const card = badge?.closest('.pontuacao-card');
    if (!badge) return;

    if (pontuacaoTotal >= 2000) {
        badge.style.display = 'inline-block';
        if (card) card.classList.add('meta-atingida');
    } else {
        badge.style.display = 'none';
        if (card) card.classList.remove('meta-atingida');
    }
}

// --- RELATÓRIO DE PRODUTIVIDADE ---
async function abrirRelatorio() {
    // Pegar dados do fiscal
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const { data: perfil } = await supabaseClient
        .from('profiles')
        .select('full_name, cpf')
        .eq('id', user.id)
        .single();

    const nomeFiscal = perfil?.full_name || 'Fiscal';
    const anoAtual = new Date().getFullYear();

    // Agrupar registros por categoria
    const porCategoria = {};
    todosRegistros.forEach(r => {
        if (!porCategoria[r.categoria_id]) {
            porCategoria[r.categoria_id] = { nome: r.categoria_nome, registros: [] };
        }
        porCategoria[r.categoria_id].registros.push(r);
    });

    const pontuacaoTotal = todosRegistros.reduce((s, r) => s + r.pontuacao, 0);

    // Gerar tabelas por categoria
    let secoesHTML = '';
    Object.values(porCategoria).forEach(cat => {
        const catDef = CATEGORIAS.find(c => c.nome === cat.nome);

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
            tds += camposDef.map(c => `<td contenteditable="true">${r.campos[c.nome] || '-'}</td>`).join('');
            const dataFormatada = obterDataReal(r).toLocaleDateString('pt-BR');
            tds += `<td contenteditable="true">${dataFormatada}</td>`;
            tds += `<td contenteditable="true">${r.pontuacao}</td>`;
            return `<tr>${tds}</tr>`;
        }).join('');

        const subtotal = cat.registros.reduce((s, r) => s + r.pontuacao, 0);
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

    // Criar modal do relatório
    const modalHTML = `
        <div class="modal-overlay ativo" id="modal-relatorio" onclick="if(event.target===this)fecharRelatorio()">
            <div class="relatorio-preview" id="relatorio-conteudo">
                <h1 contenteditable="true">RELATÓRIO DE PRODUTIVIDADE — ${anoAtual}</h1>
                <div class="relatorio-info">
                    <div><strong>Fiscal:</strong> <span contenteditable="true">${nomeFiscal}</span></div>
                    <div><strong>Ano:</strong> <span contenteditable="true">${anoAtual}</span></div>
                    <div><strong>Pontuação Total:</strong> <span contenteditable="true">${pontuacaoTotal}</span></div>
                    <div><strong>Total de Registros:</strong> ${todosRegistros.length}</div>
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

                <div class="relatorio-acoes" id="relatorio-acoes">
                    <button class="btn-cancelar-rel" onclick="fecharRelatorio()">Cancelar</button>
                    <button class="btn-salvar-pdf" onclick="salvarPDF()">💾 Salvar como PDF</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function fecharRelatorio() {
    const modal = document.getElementById('modal-relatorio');
    if (modal) modal.remove();
}

function salvarPDF() {
    // Esconder botões antes de imprimir
    const acoes = document.getElementById('relatorio-acoes');
    if (acoes) acoes.style.display = 'none';

    // Salvar título original
    const tituloOriginal = document.title;

    // Pegar nome do fiscal (primeiro span editável da info)
    const spansInfo = document.querySelectorAll('.relatorio-info span[contenteditable="true"]');
    let nome = 'Fiscal';
    if (spansInfo.length > 0) nome = spansInfo[0].textContent.trim();

    // Pegar Mês e Ano atual
    const dataAtual = new Date();
    const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
    const ano = dataAtual.getFullYear();

    // Mudar título (navegadores usam isso como nome padrão do PDF)
    // Usa traço no lugar de barra no MM/YYYY para evitar problemas de nome de arquivo
    document.title = `Produtividade ${mes}-${ano} - ${nome}`;

    window.print();

    // Restaurar botões, título e fechar o modal após imprimir
    setTimeout(() => {
        document.title = tituloOriginal;
        if (acoes) acoes.style.display = 'flex';
        fecharRelatorio(); // Fecha o modal automaticamente
    }, 500);
}

// Fechar dropdowns e modais ao clicar fora
document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown-custom')) {
        document.querySelectorAll('.dropdown-lista.aberto').forEach(el => el.classList.remove('aberto'));
    }
    if (e.target.id === 'modal-produtividade') fecharModal();
    if (e.target.id === 'modal-detalhes') fecharDetalhes();
});

// Fechar com ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        fecharModal();
        fecharDetalhes();
    }
});

// --- INICIALIZAÇÃO ---
function inicializarProdutividade() {
    renderizarCategorias();
    carregarHistorico();
}

// --- MAMMOTH / EXTRAÇÃO DE WORD E CONVERSÃO PDF ---
async function processarWordNotificacao(event) {
    const file = event.target.files[0];
    const statusMsg = document.getElementById('msg-word-status');

    if (!file) return;

    // Proteção Javascript para forçar que só .doc ou .docx passem
    const extensao = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (extensao !== '.docx' && extensao !== '.doc') {
        statusMsg.textContent = "❌ Arquivo Inválido! Anexe somente um documento Word (.docx ou .doc).";
        statusMsg.style.color = "#ef4444";
        event.target.value = ''; // Remove o arquivo rejeitado
        return;
    }

    statusMsg.textContent = "Processando arquivo aguarde...";
    statusMsg.style.color = "#eab308"; // Amarelo

    try {
        const arrayBuffer = await file.arrayBuffer();

        statusMsg.textContent = "1. Lendo formulário e extraindo o texto...";

        // mammoth js (extração limpa para as Regex)
        const resultRaw = await mammoth.extractRawText({ arrayBuffer: arrayBuffer.slice(0) });
        const text = resultRaw.value;

        // Roda as RegEx e Preenche os Inputs em tela
        let dadosExtraidos = {};
        if (categoriaAtual.id === '1.1') {
            dadosExtraidos = extrairDadosNotificacaoWord(text);
        } else if (categoriaAtual.id === '1.6') {
            dadosExtraidos = extrairDadosProtocoloWord(text);
        }

        if (dadosExtraidos.n_notificacao) {
            const el = document.getElementById('campo-n_notificacao');
            if (el) el.value = dadosExtraidos.n_notificacao;
        }

        if (dadosExtraidos.nome) {
            const el = document.getElementById('campo-nome');
            if (el) el.value = dadosExtraidos.nome;
        }

        if (dadosExtraidos.n_inscricao) {
            const el = document.getElementById('campo-n_inscricao');
            if (el) el.value = dadosExtraidos.n_inscricao;
        }

        if (dadosExtraidos.bairro) {
            const el = document.getElementById('campo-bairro');
            if (el) el.value = dadosExtraidos.bairro;
        }

        if (dadosExtraidos.data) {
            const el = document.getElementById('campo-data');
            if (el) el.value = dadosExtraidos.data;
        }

        if (dadosExtraidos.n_protocolo) {
            const el = document.getElementById('campo-n_protocolo');
            if (el) el.value = dadosExtraidos.n_protocolo;
        }

        // Procura o input oficial de anexo obrigatório
        const inputAnexoFinal = document.getElementById('campo-anexo_pdf');
        if (inputAnexoFinal) {
            // Repassa o arquivo Word cru diretamente para a validação oficial do form
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            inputAnexoFinal.files = dataTransfer.files;

            // Dispara o evento de validação para tirar a borda vermelha
            inputAnexoFinal.dispatchEvent(new Event('change'));
            inputAnexoFinal.style.borderColor = '#e2e8f0';
        }

        statusMsg.textContent = "✔ Formulário pré-preenchido e Word enviado como anexo com sucesso!";
        statusMsg.style.color = "#22c55e"; // Verde

    } catch (err) {
        console.error("Erro Mammoth JS / html2pdf:", err);
        statusMsg.textContent = "❌ Falha ao tentar processar arquivo. Preencha manualmente.";
        statusMsg.style.color = "#ef4444"; // Vermelho
    }
}

function extrairDadosNotificacaoWord(texto) {
    const dados = {};
    const trimAll = str => str.replace(/\s+/g, ' ').trim();

    // 1. N° Notificacao
    const mNotif = texto.match(/NOTIFICAÇÃO\s*PRELIMINAR\s*N[º°]?\s*(\d+)/i);
    if (mNotif) dados.n_notificacao = mNotif[1].trim();

    // 2. Data
    const mData = texto.match(/Data:\s*(\d{2})\/(\d{2})\/(\d{4})/i);
    if (mData) {
        // Converte DD/MM/YYYY para YYYY-MM-DD (Padrão de input type=date)
        dados.data = `${mData[3]}-${mData[2]}-${mData[1]}`;
    }

    // 3. Nome (Remove String Contribuinte Repetida)
    const mNome = texto.match(/Contribuinte\s+([\s\S]+?)\s+Logradouro:/i);
    if (mNome) {
        let nomeLido = trimAll(mNome[1]);
        nomeLido = nomeLido.replace(/^Contribuinte\s*/i, '');
        dados.nome = nomeLido;
    }

    // 3. Inscrição do Imóvel
    const mInscricao = texto.match(/Inscrição\s*do\s*Imóvel:\s*([\d\.\s]+)/i);
    if (mInscricao) dados.n_inscricao = mInscricao[1].replace(/\s+/g, '').trim();

    // 4. Bairro
    const regexBairro = /Bairro:\s*([\s\S]+?)\s*(?:Número:|Inscrição|Observacão|Observação|\d{5})/gi;
    let match;
    const bairros = [];
    while ((match = regexBairro.exec(texto)) !== null) {
        bairros.push(trimAll(match[1]));
    }

    // Tenta pegar o 2° bairro (geralmente Imóvel), senão o 1°
    if (bairros.length > 1) {
        dados.bairro = bairros[1];
    } else if (bairros.length === 1) {
        dados.bairro = bairros[0];
    }

    return dados;
}

function extrairDadosProtocoloWord(texto) {
    const dados = {};
    const trimAll = str => str.replace(/\s+/g, ' ').trim();

    // 1. N° Protocolo
    const mProt = texto.match(/Protocolo\s*(?:N[º°]?)?\s*[:\-]?\s*([\d\.\-\/]+)/i);
    if (mProt) dados.n_protocolo = mProt[1].trim();

    // 2. Data
    const mData = texto.match(/Data:\s*(\d{2})\/(\d{2})\/(\d{4})/i);
    if (mData) {
        dados.data = `${mData[3]}-${mData[2]}-${mData[1]}`;
    }

    // 3. Nome (Busca genérica por Requerente/Nome/Contribuinte)
    const mNome = texto.match(/(?:Requerente|Nome|Contribuinte)\s*[:\-]?\s*([A-Za-zÀ-ÿ\s]+?)(?:\s+(?:CPF|Endereço|Bairro|Telefone|Celular|Data|Protocolo|CNPJ))/i);
    if (mNome) dados.nome = trimAll(mNome[1]);

    // 4. Bairro
    const mBairro = texto.match(/Bairro\s*[:\-]?\s*([A-Za-zÀ-ÿ\s]+?)(?:\s+(?:CEP|Cidade|Município|Estado|Telefone|Referência|Logradouro))/i);
    if (mBairro) dados.bairro = trimAll(mBairro[1]);

    return dados;
}

// --- GERADOR DE AUTO DE INFRAÇÃO (WYSIWYG) ---
async function abrirEditorAutoInfracao() {
    // 1. Coleta e valida dados
    const campos = {};
    let todosPreenchidos = true;

    categoriaAtual.campos.forEach(campo => {
        if (campo.tipo === 'file') return;
        const input = document.getElementById(`campo-${campo.nome}`);
        let valor = input ? input.value.trim() : '';

        // n_notificacao não é obrigatorio no Auto
        if (campo.obrigatorio && !valor && campo.nome !== 'n_notificacao') {
            todosPreenchidos = false;
            if (input) input.style.borderColor = '#ef4444';
        } else if (input) {
            input.style.borderColor = '#e2e8f0';
        }
        campos[campo.nome] = valor || '';
    });

    if (!todosPreenchidos) {
        alert('Preencha os dados obrigatórios do Auto de Infração antes de gerar o documento.');
        return;
    }

    const btnSalvarForm = document.querySelector('#modal-produtividade .btn-salvar');
    const oldTexto = btnSalvarForm ? btnSalvarForm.textContent : 'Gerar Documento';
    if (btnSalvarForm) {
        btnSalvarForm.textContent = 'Carregando...';
        btnSalvarForm.disabled = true;
    }

    try {
        // Puxa do Banco de Dados offline o provável sequencial desse Auto e injeta
        const numSequencial = await gerarNumeroSequencial('1.2');

        // 2. Prepara HTML do Documento
        const dataPartes = campos.data ? campos.data.split('-') : ['', '', ''];
        const dataFormatada = campos.data ? `${dataPartes[2]}/${dataPartes[1]}/${dataPartes[0]}` : '';
        const descInscricao = campos.inscricao_zona ? `Zona: ${campos.inscricao_zona}, Quadra: ${campos.inscricao_quadra}, Lote: ${campos.inscricao_lote}, com área de ${campos.inscricao_area} m²` : '---';
        const numNotificacao = campos.n_notificacao ? campos.n_notificacao : '_____';
        const prazoDefesa = campos.prazo_defesa ? campos.prazo_defesa : '_____';

        // Pegar informações do Fiscal (Nome logado) e Data de Hoje para Assinatura
        const { data: { user } } = await supabaseClient.auth.getUser();
        let nomeFiscal = 'Nome do Fiscal';
        if (user) {
            const { data: perfil } = await supabaseClient
                .from('profiles')
                .select('full_name')
                .eq('id', user.id)
                .single();
            if (perfil && perfil.full_name) nomeFiscal = perfil.full_name;
        }

        const hoje = new Date();
        const diaHoje = String(hoje.getDate()).padStart(2, '0');
        const mesHoje = String(hoje.getMonth() + 1).padStart(2, '0');
        const anoHoje = hoje.getFullYear();
        const dataAssinatura = `${diaHoje}-${mesHoje}-${anoHoje}`;

        const base64Logo = "iVBORw0KGgoAAAANSUhEUgAAAm4AAABTCAIAAACpsRweAAAIbElEQVR4nO3dW7LbKhBAUflWJpaRpTKyzCkT8P1wolJ4NvQDpLPXl2NLgKCtNkg6eb3f7wMAAMz6b3UDAAC4N1IpAAAqpNKv7vfv36ubAAD39uJaKQAAGsxKAQBQIZUCAKDybXUDjtfr5VQya9cAgACLU+nr5Xix1rVwAAA+WOAFAEBlZSr1njW+32+/1WMAAD6WLYEmeVSY8yZayzIvAMDV+tuOjpE7j/wyLgAAc9Ys8HrPFK8Zl2VeAICr9bcdkecAALe2IJXGXLxkYgoAiBGdSufuNpqu63xNNgUAOFn8MMzC2gEAMBGaSuOfS2FiCgDwFpdKI5d2k3rP12RTAIC5ZQ/DLKkXAABzQSuuyilp3khNCfz9IwCAoYhZqXkerb0pL5BpMQDAyvo/0TBtKJuSOwEATtxTqceUdLol12JJrgAAE76pdNVduxJkUwCAia0XeLtT0tE5K7kTAGDOMZXqp6TdXZRlMjEFAOgFzUrJWACAp/JKpTHPbs5VwcQUAGDIJZVa3W3kl4zJpgAAK99WN6BMnkQ/W5ILAQCr2C/Drn2QdKg6/pogAEDPOH/cOiHduvEAgFW2fq4UAID9WabSu8/quP8IADDBMpXePRXd/acAAGCJTe/gtffze+HNH79Gi5H/VliYlZNGTrTkLOHZvy0aoyk88FoJO4y+1R18S46l2LH658iVRU1UVCSp3bb/A0YzecLQqRZ5G06N/+7asJ3GqfQzMf2nfXkOG09gLv5thnBKWnv25tz3/OjzIjikkhD5/HO0Jdeja3fL3efxyiepws7RcvKxiylnmuFDbmHPy3VPDse/X8mjHi22/R8wmjvk0UM21k69YX/bUbrMmyfO4gTRVa/G0Q5tbJx8FLnifevV9YUMv/m3/mEBE+0YWHh+iPFlvwJf4w7ePJ17zoz3WRB7WI2RJP+Vwpc9a0Djwdn0K38jXFJpf2Iar94G73Piwq/KeVzTc27JAtQzPOMsIBm7yHJQ1M2mtv3vPZpLLmZNc+qNqNuOfvz6s8q6d1p9nrlYae/1vDxa1PiNtfOU1Kph2x7gI+URZdv/rqN5u1DxaLDXAm/1wZj4C6WJqbuNcHpwHiUSAMxxnJWmd/OeE9MlSlUH59H2DZ+Nm/raD7cUi20suTRK696Smm9wbXZjd+Gxtz/t9kxxGw2rm2BP3d6QfyQJA/n6/OhYJJ8OPX/lPWpJLaOF658lk8g77RNsE/0v30aypSTYEpKNTSJntGHCNnTLl5wH3C8TpuUnKc17rbVZneGJsjEe3aGS3D1/ZCE+9O2Sl1ZsYbeixmaSkmufds/4kkolrpHQLWp049oGQx+NPjDX3SA/Y06PVFHjfGrSew3JQc39yGh8QYYaIKkr33Lo926t34T9PB1sR6l/2j02HTlDdY0eb/JRsd+6AeB7B291mTdGcxLsNyUdOuRPM+TRUwyjfPfim5LSGhoVOc0qaiV3zyaGUbfDgvbZFcrDbATARGlXkrbFjFp++pMHp/ILEkN4OJpJgjDYiplstMeEUW1SV1sxPuXd6P4wTJpNk2lo5JLvpeqwPKqpxfbbu8+5QMn7QNpD5hc5DSY1+vVbMTGH1S4h6cD7fkFsWz4x9Z/eRhI5VnXJzRW1wXOlTtk09rrs66/zHeEvmjyYJn5Em9jtVKLpGUww7974iHKtcZ8vyIa/9mwt7+qhpd2PiFTamZg6XS6t1+IRau/MdCGf189Ok6OuPRN/mrh77x29C+pOS/RJLa7lK919iIPbL69O37DIupLShq6UB81KO9nUW8jSrqvXxW6lxUvO/uYHUouQmwbPJrxHzdD+XxDi0FzttgxhDOy0wKtfkv353bK0neSzXs1Mwra0hT6BHtD4bU+pdxQ2atPu+AX5hCi/9jQav6G7+0Y/WPlPdbVsNzdnFZRmGGfTtxcJdxwtv739UGnKohobeDSytiQ+NNDFwCje0dfexqo3zPswLJyEOwobZths24qmmyHcbLoESSTrR9MjPAzrsj2DNba8Cp2VvoXLvNfJpYRse36vPQZzRKUlHcioXXn0Bqc4E3MrEBss8Lp6yp/b5S6kU1jjOSsZulfIxbd2LthWhai8Xn0Lw+rKZ6tDBUb9Ofu/0iUI4V8TrP3/4e1973y3UTqDL5EflG1pHrvv79ZHlwdAPl7mI7i8x7b6giRFJbWbFPsYqzokH2JJYPzZN77RhYh0ukXIM5V6XyvNtzyySwtDF1fkpc1dnOju3r30qLnCJLmu2dAIj/zyXrcxkg26wzHxkebToXASNq9boFVIdHeZuOx9NPtnog21Debiqrjx3I0Xhle+u+2ZiJyJupT3ExS3747+ggVeeZ5XCcyjxXf0ivF0Gj0iq9LyOEt2L27gN+K19ssrff299bGxjeR8V3wnuDeGaMIpKSd5cQjO/spRq+nGZ60iqy9Iu/1JvbeejxZ/F3bz+pU8cvR1yRWr6FpzrVR6/5EF2zza+Kp3zwLFDdp7FdfrkzflxXZLExaVr4HkZUqqPkse6pm89s87tfcbkipqndbdsf3RUG/UuiJ5kVcn6UPbcLqW0M0Qo6M20YxGXfkGkq5ovFlUa14+srUG1Arp9v8xEqjdmEleNEpLTh3XA6y1Ntm9GzlDdc0dbzIuSRXCAFh2fevlusx756ukwOa6vxWAogdHzso0E5DkyKOAuQefEOHqwZGz8mGYdJnXGnkUABDg6c+VAgDgLPq50oTrxJQpKQAgwOJUepDwAAA3x9VEAFLdRzKAosdHDqkUAAAVbjsCAECFVAoAgAqpFAAAFVIpAAAqpFIAAFRIpQAAqJBKAQBQIZUCAKBCKgUAQIVUCgCACqkUAAAVUikAACqkUgAAVEilAACokEoBAFAhlQIAoPI/A6SDFES+1esAAAAASUVORK5CYII=";
        const htmlTemplate = `
        <div style="border: 1px solid #999; padding: 20px; display: flex; align-items: center; justify-content: center; margin-bottom: 25px;">
            <img src="data:image/png;base64,${base64Logo}" alt="Prefeitura Municipal de Divinópolis" style="max-height: 90px; width: auto; max-width: 100%;">
        </div>
        
        <div style="text-align: center; margin-bottom: 25px;">
            <p style="font-weight: bold; font-size: 14pt; margin: 10px 0;">FISCALIZAÇÃO DE POSTURAS AMBIENTAL</p>
            <p style="font-weight: bold; font-size: 16pt; margin: 15px 0;">AUTO DE INFRAÇÃO Nº: ${numSequencial}</p>
        </div>
        
        <p style="margin-top: 20px;">
            <strong>Estabelecimento/Proprietário:</strong> ${campos.nome}
        </p>
        <p>
            <strong>Endereço:</strong> ${campos.endereco_infrator || '---'}
        </p>

        <p style="text-indent: 30px; margin-top: 20px; line-height: 1.5;">
            Foi fiscalizado da data <strong>${dataFormatada}</strong> pelo motivo descrito: o imóvel situado na <strong>${campos.endereco_imovel || '______________________'}</strong>, Bairro <strong>${campos.bairro}</strong>; Inscrição Imobiliária Municipal: <strong>${descInscricao}</strong>, necessitava de <strong>${campos.motivo || '...'}</strong>.
        </p>

        <p style="text-indent: 30px; margin-top: 10px;">
            Na presente data deste documento foi verificado: Não cumprimento da obrigação da Notificação Preliminar nº: <strong>${numNotificacao}</strong> - <strong>${campos.motivo || 'Limpeza do imóvel de sua propriedade'}</strong>.
        </p>

        <p style="text-indent: 30px; margin-top: 10px;">
            Motivo da infração baseada na Lei/ Decreto pelo descumprimento do dispositivo: <strong>${campos.fundamentacao_legal || '_______'}</strong>.<br><br>
            <strong>MULTA NO VALOR DE R$ ${campos.valor_multa || '__________'}</strong>
        </p>
        
        <p style="text-indent: 30px; margin-top: 20px;">
            O autuado tem o prazo de <strong>${prazoDefesa} DIAS</strong> para apresentação de defesa, por escrito, protocolada via protocolo municipal. Instruções: link (https://servicos.prefeituradivinopolis.com.br/govdigital/Microsservicos/instrucao/201)
        </p>

        <div style="margin-top: 40px; margin-left: 30px;">
            <div style="display: inline-block; text-align: center;">
                <p style="margin: 0;">_________________________________________ Divinópolis, ${dataAssinatura}</p>
                <p style="margin: 5px 0 0 0; margin-right: 170px;"><strong>${nomeFiscal}</strong></p>
            </div>
        </div>
        
        <p style="margin-top: 50px; text-indent: 30px;">
            Recebi a 2ª via do presente Auto de infração do qual fico ciente.
        </p>
        
        <div style="margin-top: 40px; margin-left: 30px;">
            <div style="display: inline-block; text-align: center;">
                <p style="margin: 0;">_________________________________________ Divinópolis, _____/_____/_________.</p>
                <p style="margin: 5px 0 0 0; margin-right: 170px;"><strong>ASSINATURA DO AUTUADO</strong></p>
            </div>
        </div>
    `;

        // 3. Exibe Modal
        const editor = document.getElementById('editor-texto');
        editor.innerHTML = htmlTemplate;

        document.getElementById('modal-produtividade').classList.remove('ativo'); // esconde o form
        document.getElementById('modal-editor-documento').style.display = 'flex';

    } catch (error) {
        console.error('Erro ao preparar documento:', error);
        alert('Ocorreu um erro ao processar os dados do documento.');
    } finally {
        if (btnSalvarForm) {
            btnSalvarForm.textContent = oldTexto;
            btnSalvarForm.disabled = false;
        }
    }
}

// --- GERADOR DE OFÍCIO (WYSIWYG) ---
async function abrirEditorOficio() {
    // 1. Coleta e valida dados
    const campos = {};
    let todosPreenchidos = true;

    categoriaAtual.campos.forEach(campo => {
        if (campo.tipo === 'file') return;
        const input = document.getElementById(`campo-${campo.nome}`);
        let valor = input ? input.value.trim() : '';

        if (campo.obrigatorio && !valor) {
            todosPreenchidos = false;
            if (input) input.style.borderColor = '#ef4444';
        } else if (input) {
            input.style.borderColor = '#e2e8f0';
        }
        campos[campo.nome] = valor || '';
    });

    if (!todosPreenchidos) {
        alert('Preencha os dados obrigatórios do Ofício antes de gerar o documento.');
        return;
    }

    const btnSalvarForm = document.querySelector('#modal-produtividade .btn-salvar');
    const oldTexto = btnSalvarForm ? btnSalvarForm.textContent : 'Gerar Documento';
    if (btnSalvarForm) {
        btnSalvarForm.textContent = 'Carregando...';
        btnSalvarForm.disabled = true;
    }

    try {
        // Puxa do Banco de Dados offline o provável sequencial desse Ofício e injeta
        const numSequencial = await gerarNumeroSequencial('1.4');

        // Pegar informações do Fiscal (Nome logado e Matrícula) e Data de Hoje para Assinatura
        const { data: { user } } = await supabaseClient.auth.getUser();
        let nomeFiscal = 'Nome do Fiscal';
        let matriculaFiscal = 'XXXXXXXX';
        if (user) {
            const { data: perfil } = await supabaseClient
                .from('profiles')
                .select('full_name, matricula')
                .eq('id', user.id)
                .single();
            if (perfil && perfil.full_name) nomeFiscal = perfil.full_name;
            if (perfil && perfil.matricula) matriculaFiscal = perfil.matricula;
        }

        const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
        const hoje = new Date();
        const diaHoje = hoje.getDate();
        const mesHoje = meses[hoje.getMonth()];
        const anoHoje = hoje.getFullYear();
        const dataPorExtenso = `Divinópolis, ${diaHoje} de ${mesHoje} de ${anoHoje}.`;

        const base64LogoPref = "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";

        // 2. Prepara HTML do Documento
        const htmlTemplate = `
        <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 25px; width: 100%;">
            <img src="data:image/png;base64,${base64LogoPref}" alt="Prefeitura Municipal de Divinópolis" style="width: 100%; max-width: 100%; height: auto;">
        </div>

        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 40px;">
            <p style="font-weight: bold; margin: 0;">OFÍCIO SEMAC- DMA Nº ${numSequencial}</p>
            <p style="margin: 0;">${dataPorExtenso}</p>
        </div>

        <p style="margin-bottom: 20px;">
            Ao Senhor(a)<br>
            <strong>${campos.nome}</strong>
        </p>

        <p style="margin-bottom: 40px;">
            Assunto: <strong>${campos.assunto}</strong>
        </p>

        <p style="margin-bottom: 15px;">
            Prezado Senhor(a),
        </p>

        <p style="text-indent: 30px; line-height: 1.5; margin-bottom: 40px; min-height: 60px;">
            escreva...
        </p>

        <p style="margin-bottom: 40px;">
            Atenciosamente,
        </p>

        <div style="margin-top: 60px; text-align: center;">
            <p style="margin: 0;">_________________________________________</p>
            <p style="margin: 5px 0 0 0;"><strong>${nomeFiscal}</strong></p>
            <p style="margin: 2px 0 0 0;">Fiscal de Posturas</p>
            <p style="margin: 2px 0 0 0;">Matrícula: ${matriculaFiscal}</p>
        </div>
    `;

        // 3. Exibe Modal
        const editor = document.getElementById('editor-texto');
        editor.innerHTML = htmlTemplate;

        document.getElementById('modal-editor-documento').style.display = 'flex';

    } catch (error) {
        console.error('Erro ao preparar ofício:', error);
        alert('Ocorreu um erro ao processar os dados do ofício.');
    } finally {
        if (btnSalvarForm) {
            btnSalvarForm.textContent = oldTexto;
            btnSalvarForm.disabled = false;
        }
    }
}

// ==========================================
// FUNÇÃO: ABRIR EDITOR RELATÓRIO DO FISCAL
// ==========================================
async function abrirEditorRelatorio() {
    // 1. Coleta e valida dados
    const campos = {};
    let todosPreenchidos = true;

    categoriaAtual.campos.forEach(campo => {
        if (campo.tipo === 'file') return;
        const input = document.getElementById(`campo-${campo.nome}`);
        let valor = input ? input.value.trim() : '';

        if (campo.obrigatorio && !valor) {
            todosPreenchidos = false;
            if (input) input.style.borderColor = '#ef4444';
        } else if (input) {
            input.style.borderColor = '#e2e8f0';
        }
        campos[campo.nome] = valor || '';
    });

    if (!todosPreenchidos) {
        alert('Preencha os dados obrigatórios do Relatório antes de gerar o documento.');
        return;
    }

    const btnSalvarForm = document.querySelector('#modal-produtividade .btn-salvar');
    const oldTexto = btnSalvarForm ? btnSalvarForm.textContent : 'Gerar Documento';
    if (btnSalvarForm) {
        btnSalvarForm.textContent = 'Carregando...';
        btnSalvarForm.disabled = true;
    }

    try {
        // Puxa do Banco de Dados offline o provável sequencial
        const numSequencial = await gerarNumeroSequencial('1.5');

        // Pegar informações do Fiscal (Nome logado e Matrícula) e Data de Hoje para Assinatura
        const { data: { user } } = await supabaseClient.auth.getUser();
        let nomeFiscal = 'Nome do Fiscal';
        let matriculaFiscal = 'XXXXXXXX';
        if (user) {
            const { data: perfil } = await supabaseClient
                .from('profiles')
                .select('full_name, matricula')
                .eq('id', user.id)
                .single();
            if (perfil && perfil.full_name) nomeFiscal = perfil.full_name;
            if (perfil && perfil.matricula) matriculaFiscal = perfil.matricula;
        }

        const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
        const hoje = new Date();
        const diaHoje = hoje.getDate();
        const mesHoje = meses[hoje.getMonth()];
        const anoHoje = hoje.getFullYear();
        const dataPorExtenso = `Divinópolis, ${diaHoje} de ${mesHoje} de ${anoHoje}.`;
        const dataFormatada = `${String(diaHoje).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${anoHoje}`;

        const base64LogoPref = "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";
        const htmlTemplate = `
        <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 25px; width: 100%;">
            <img src="data:image/png;base64,${base64LogoPref}" alt="Prefeitura Municipal de Divinópolis" style="width: 100%; max-width: 100%; height: auto;">
        </div>

        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; margin-bottom: 40px;">
            <p style="font-weight: bold; margin: 0;">RELATÓRIO FISCAL Nº ${numSequencial}</p>
        </div>

        <p style="margin-bottom: 20px;">
            <strong>Data do Relatório:</strong> ${dataFormatada}
        </p>

        <p style="margin-bottom: 20px;">
            <strong>Para o atendimento:</strong> ${campos.atendimento}
        </p>

        <p style="margin-bottom: 20px;">
            complete aqui...
        </p>

        <p style="text-indent: 30px; line-height: 1.5; margin-bottom: 40px; min-height: 60px;">
            
        </p>

        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 40px;">
            <p style="margin: 0;"></p>
            <p style="margin: 0;">${dataPorExtenso}</p>
        </div>

        <div style="margin-top: 60px; text-align: center;">
            <p style="margin: 0;">_________________________________________</p>
            <p style="margin: 5px 0 0 0;"><strong>${nomeFiscal}</strong></p>
            <p style="margin: 2px 0 0 0;">Fiscal de Posturas</p>
            <p style="margin: 2px 0 0 0;">Matrícula: ${matriculaFiscal}</p>
        </div>
    `;

        // 3. Exibe Modal
        const editor = document.getElementById('editor-texto');
        editor.innerHTML = htmlTemplate;

        document.getElementById('modal-produtividade').classList.remove('ativo'); // esconde o form
        document.getElementById('modal-editor-documento').style.display = 'flex';

    } catch (error) {
        console.error('Erro ao preparar relatório:', error);
        alert('Ocorreu um erro ao processar os dados do relatório.');
    } finally {
        if (btnSalvarForm) {
            btnSalvarForm.textContent = oldTexto;
            btnSalvarForm.disabled = false;
        }
    }
}


// FUNÇÃO: ABRIR EDITOR RÉPLICA DO FISCAL
// ==========================================
async function abrirEditorReplica() {
    // 1. Validação de Campos
    const campos = {};
    let todosPreenchidos = true;

    categoriaAtual.campos.forEach(campo => {
        if (campo.tipo === 'file') return;
        const input = document.getElementById(`campo-${campo.nome}`);
        let valor = input ? input.value.trim() : '';

        if (campo.obrigatorio && !valor) {
            todosPreenchidos = false;
            if (input) input.style.borderColor = '#ef4444';
        } else if (input) {
            input.style.borderColor = '#e2e8f0';
        }
        campos[campo.nome] = valor || '';
    });

    if (!todosPreenchidos) {
        alert('Preencha os dados obrigatórios da Réplica antes de gerar o documento.');
        return;
    }

    const btnSalvarForm = document.querySelector('#modal-produtividade .btn-salvar');
    const oldTexto = btnSalvarForm ? btnSalvarForm.textContent : 'Gerar Documento';
    if (btnSalvarForm) {
        btnSalvarForm.textContent = 'Carregando...';
        btnSalvarForm.disabled = true;
    }

    try {
        const numSequencial = await gerarNumeroSequencial('1.7');

        // Pegar informações do Fiscal (Nome logado e Matrícula)
        const { data: { user } } = await supabaseClient.auth.getUser();
        let nomeFiscal = 'Nome do Fiscal';
        let matriculaFiscal = 'XXXXXXXX';

        if (user) {
            const { data: perfil } = await supabaseClient
                .from('profiles')
                .select('full_name, matricula')
                .eq('id', user.id)
                .single();
            if (perfil && perfil.full_name) nomeFiscal = perfil.full_name;
            if (perfil && perfil.matricula) matriculaFiscal = perfil.matricula;
        }

        const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
        const hoje = new Date();
        const diaHoje = hoje.getDate();
        const mesHoje = meses[hoje.getMonth()];
        const anoHoje = hoje.getFullYear();
        const dataPorExtenso = `Divinópolis, ${diaHoje} de ${mesHoje} de ${anoHoje}.`;

        const base64LogoPref = "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";
        const htmlTemplate = `
        <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 25px; width: 100%;">
            <img src="data:image/png;base64,${base64LogoPref}" alt="Prefeitura Municipal de Divinópolis" style="width: 100%; max-width: 100%; height: auto;">
        </div>

        <div style="text-align: right; margin-bottom: 20px;">
            <p style="margin: 0;">${dataPorExtenso}</p>
        </div>

        <div style="margin-bottom: 30px;">
            <p style="font-weight: bold; margin: 0;">Réplica ${numSequencial}</p>
        </div>

        <p style="margin-bottom: 10px;">
            <strong>AUTUADA(O):</strong> ${campos.nome}
        </p>
        <p style="margin-bottom: 30px;">
            <strong>PA ________</strong>
        </p>

        <p style="text-indent: 30px; line-height: 1.5; margin-bottom: 20px;">
            O contribuinte acima qualificado com base no artigo 231 da Lei 6.907/08, inconformado com ___________________________________ do imóvel de sua propriedade, apresentou a sua defesa (doc. anexo).
        </p>

        <p style="font-weight: bold; margin-bottom: 10px;">REPLICANDO:</p>
        
        <p style="text-indent: 30px; line-height: 1.5; margin-bottom: 20px;">
            Conforme vistoria no local, constamos que o imóvel de propriedade do contribuinte acima citado, necessitava de ___________________________________, uma vez que houve denúncias de moradores próximos ao local, sendo o mesmo autuado preliminarmente para execução do serviço. Assim, foi enviada a notificação para o endereço de correspondência, sendo essa recebida via Aviso de Recebimento (AR). Porém, o mesmo protocolou defesa no dia ____________.
        </p>

        <p style="margin-bottom: 10px;">Senhora Gerente de Alvará,</p>
        
        <p style="text-indent: 30px; line-height: 1.5; margin-bottom: 40px;">
            Após a análise da defesa apresentada pelo contribuinte destacamos que: ____________________________________________________________________________________________________________________________________________________
        </p>

        <div style="margin-top: 60px;">
            <p style="margin: 0;">Atenciosamente,</p>
            <br><br>
            <p style="margin: 0; font-weight: bold;">${nomeFiscal}</p>
            <p style="margin: 2px 0 0 0;">Fiscalização de Posturas</p>
            <p style="margin: 2px 0 0 0;">Matrícula: ${matriculaFiscal}</p>
        </div>
    `;

        // 3. Exibe Modal
        const editor = document.getElementById('editor-texto');
        editor.innerHTML = htmlTemplate;

        document.getElementById('modal-produtividade').classList.remove('ativo'); // esconde o form
        document.getElementById('modal-editor-documento').style.display = 'flex';

    } catch (error) {
        console.error('Erro ao preparar a réplica:', error);
        alert('Ocorreu um erro ao processar os dados da réplica.');
    } finally {
        if (btnSalvarForm) {
            btnSalvarForm.textContent = oldTexto;
            btnSalvarForm.disabled = false;
        }
    }
}

function fecharEditorDocumento() {
    document.getElementById('modal-editor-documento').style.display = 'none';
    document.getElementById('modal-produtividade').classList.add('ativo');
}

async function baixarDocumentoWord() {
    const btnDown = document.querySelector('#modal-editor-documento .btn-salvar');
    const oldText = btnDown ? btnDown.textContent : 'Baixar Word / PDF';

    if (btnDown) {
        btnDown.textContent = "Carregando...";
        btnDown.disabled = true;
    }

    try {
        const editor = document.getElementById('editor-texto');

        let tipoNome = 'Documento';
        let catNome = 'Documento';
        let catId = categoriaAtual ? categoriaAtual.id : '1.2';

        if (catId === '1.2') {
            tipoNome = 'Auto_Infracao';
            catNome = 'Auto de Infração';
        } else if (catId === '1.4') {
            tipoNome = 'Oficio';
            catNome = 'Ofício';
        } else if (catId === '1.5') {
            tipoNome = 'Relatorio';
            catNome = 'Relatório Fiscal';
        } else if (catId === '1.7') {
            tipoNome = 'Replica';
            catNome = 'Réplica Fiscal';
        }

        // Adiciona as Metatags da Microsoft Office para interpretar o HTML como Word Nativo
        const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' " +
            "xmlns:w='urn:schemas-microsoft-com:office:word' " +
            "xmlns='http://www.w3.org/TR/REC-html40'>" +
            "<head><meta charset='utf-8'><title>" + catNome + "</title>" +
            "<style> @page { size: 21cm 29.7cm; margin: 2cm } body { font-family: 'Times New Roman'; font-size: 12pt } </style>" +
            "</head><body>";
        const footer = "</body></html>";
        const sourceHTML = header + editor.innerHTML + footer;

        const numSeqDownload = await gerarNumeroSequencial(catId);
        let nomeArquivo = `${tipoNome}_${numSeqDownload.replace('/', '-')}`;

        // Tratamento para caracteres UTF-8 no Blob MS-WORD
        const blobDoc = new Blob(['\ufeff', sourceHTML], { type: 'application/msword;charset=utf-8' });
        const url = URL.createObjectURL(blobDoc);
        const fileDownload = document.createElement("a");
        document.body.appendChild(fileDownload);
        fileDownload.href = url;
        fileDownload.download = `${nomeArquivo}.doc`;
        fileDownload.click();
        document.body.removeChild(fileDownload);
        URL.revokeObjectURL(url);

        // Gerando PDF Anexo e Salvando no Histórico In-background
        if (typeof html2pdf === 'undefined') {
            alert("Baixado DOC com sucesso, mas o html2pdf não iniciou para criar o Anexo do banco.");
            fecharEditorDocumento();
            return;
        }

        if (btnDown) {
            btnDown.textContent = "Salvando Histórico...";
        }

        const opt = {
            margin: 10,
            filename: `${nomeArquivo}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        const blobPdf = await html2pdf().set(opt).from(editor).output('blob');
        const filenameSafe = `${nomeArquivo}.pdf`;

        // Executa lógica de banco de dados completa (incluindo Storage)
        await salvarRegistro(blobPdf, filenameSafe);
        fecharEditorDocumento(); // fecha o frame do documento
        fecharModal(); // fecha o formulário pai imediatamente
    } catch (err) {
        console.error(err);
        alert('O DOCX/PDF foi gerado, mas ocorreu um erro ao salvar o Histórico e Storage.');
    } finally {
        if (btnDown) {
            btnDown.textContent = oldText;
            btnDown.disabled = false;
        }
    }
}



// Executa quando a página carregar
document.addEventListener('DOMContentLoaded', inicializarProdutividade);
