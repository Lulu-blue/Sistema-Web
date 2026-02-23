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
            { nome: 'data', label: 'Data da Notificação', tipo: 'date', obrigatorio: true },
            { nome: 'anexo_pdf', label: 'Anexo (PDF)', tipo: 'file', obrigatorio: true, aceitar: '.pdf' }
        ]
    },
    {
        id: '1.2',
        nome: 'Auto de Infração',
        pontos: 30,
        destaque: true,
        campos: [
            { nome: 'nome', label: 'Nome do Contribuinte', tipo: 'text', obrigatorio: true },
            { nome: 'n_inscricao', label: 'N° de Inscrição', tipo: 'text', obrigatorio: true },
            { nome: 'bairro', label: 'Bairro', tipo: 'text', obrigatorio: true },
            { nome: 'motivo', label: 'Motivo', tipo: 'text', obrigatorio: true },
            { nome: 'data', label: 'Data do Auto', tipo: 'date', obrigatorio: true },
            { nome: 'artigo', label: 'Artigo Infringido', tipo: 'text', obrigatorio: true },
            { nome: 'valor_multa', label: 'Valor da Multa (R$)', tipo: 'text', obrigatorio: true }
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
            { nome: 'data', label: 'Data do Ofício', tipo: 'date', obrigatorio: true },
            { nome: 'bairro', label: 'Bairro', tipo: 'text', obrigatorio: true }
        ]
    },
    {
        id: '1.5',
        nome: 'Relatório',
        pontos: 15,
        destaque: true,
        campos: [
            { nome: 'nome', label: 'Nome', tipo: 'text', obrigatorio: true },
            { nome: 'data', label: 'Data do Relatório', tipo: 'date', obrigatorio: true },
            { nome: 'bairro', label: 'Bairro', tipo: 'text', obrigatorio: true }
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
            { nome: 'bairro', label: 'Bairro', tipo: 'text', obrigatorio: true }
        ]
    },
    {
        id: '1.7',
        nome: 'Réplica',
        pontos: 15,
        destaque: true,
        campos: [
            { nome: 'nome', label: 'Nome', tipo: 'text', obrigatorio: true },
            { nome: 'data', label: 'Data da Réplica', tipo: 'date', obrigatorio: true },
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
        corpo.appendChild(grupo);
    });

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
async function salvarRegistro() {
    if (!categoriaAtual || salvando) return;
    salvando = true;

    // 1. Coletar valores dos campos
    const campos = {};
    let todosPreenchidos = true;
    let arquivoAnexo = null; // para upload de PDF

    categoriaAtual.campos.forEach(campo => {
        const input = document.getElementById(`campo-${campo.nome}`);

        if (campo.tipo === 'file') {
            // Tratar campo de arquivo
            if (campo.obrigatorio && (!input.files || input.files.length === 0)) {
                todosPreenchidos = false;
                input.style.borderColor = '#ef4444';
            } else if (input.files && input.files.length > 0) {
                arquivoAnexo = { nome: campo.nome, file: input.files[0] };
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
        campos[campo.nome] = valor;
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
    btnSalvar.textContent = 'Salvando...';
    btnSalvar.disabled = true;

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

    btnSalvar.textContent = 'Salvar';
    btnSalvar.disabled = false;

    if (error) {
        console.error('Erro ao salvar:', error);
        alert('Erro ao salvar: ' + error.message);
        salvando = false;
        return;
    }

    // Upload de arquivo anexo (se houver)
    if (arquivoAnexo && data && data.length > 0) {
        const registroId = data[0].id;
        const nomeArquivo = `${registroId}_${arquivoAnexo.file.name}`;
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
    salvando = false;
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
    if (pontuacaoEl) pontuacaoEl.textContent = pontuacaoTotal;

    const pontuacaoResEl = document.getElementById('pontuacao-resumo-total');
    if (pontuacaoResEl) pontuacaoResEl.textContent = pontuacaoTotal;

    const totalRegistrosEl = document.getElementById('total-registros');
    if (totalRegistrosEl) totalRegistrosEl.textContent = todosRegistros.length;

    const totalRegistrosHistEl = document.getElementById('total-registros-hist');
    if (totalRegistrosHistEl) totalRegistrosHistEl.textContent = todosRegistros.length;

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
        if (catDef) {
            const campoDef = catDef.campos.find(c => c.nome === chave);
            if (campoDef) label = campoDef.label;
        }

        html += `<div class="detalhe-item"><span class="detalhe-label">${label}</span><span class="detalhe-valor">${valor}</span></div>`;
    });

    // Pontuação
    html += `<div style="text-align:center; margin-top:8px;"><span class="detalhe-pontuacao">+${reg.pontuacao} pontos</span></div>`;

    corpo.innerHTML = html;
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

    // Re-abrir formulário com nova opção selecionada
    const categoria = CATEGORIAS.find(c => c.id === catId);
    if (categoria) {
        abrirFormulario(categoria);
        setTimeout(() => selecionarOpcao(campoNome, novoValor), 50);
    }
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
    renderizarTabelaGeral(registrosOrdenados, categoriaId);
}

// Filtro de busca — busca por N°, nome, bairro, n_inscricao (NÃO por fiscal)
function filtrarHistoricoGeral() {
    const termo = document.getElementById('busca-historico-geral').value.toLowerCase().trim();
    if (!termo) {
        renderizarTabelaGeral(registrosGeralAtual, subAbaAtual);
        return;
    }

    const camposBusca = ['n_notificacao', 'n_auto', 'n_ar', 'n_oficio', 'n_relatorio', 'n_protocolo', 'n_replica', 'nome', 'bairro', 'n_inscricao'];

    const filtrados = registrosGeralAtual.filter(reg => {
        // Buscar no numero_sequencial
        if (reg.numero_sequencial && reg.numero_sequencial.toLowerCase().includes(termo)) return true;
        // Buscar nos campos do contribuinte (não fiscal)
        for (const campo of camposBusca) {
            if (reg.campos[campo] && reg.campos[campo].toString().toLowerCase().includes(termo)) return true;
        }
        return false;
    });

    if (filtrados.length === 0) {
        document.getElementById('historico-geral-lista').innerHTML = '<div class="historico-vazio">Nenhum resultado para a busca.</div>';
        return;
    }

    renderizarTabelaGeral(filtrados, subAbaAtual);
}

function renderizarTabelaGeral(registros, categoriaId) {
    const container = document.getElementById('historico-geral-lista');
    const categoria = CATEGORIAS.find(c => c.id === categoriaId);
    if (!categoria) return;

    // Colunas: Nº (se tiver), campos da categoria + Fiscal + Data
    const temNumero = registros.some(r => r.numero_sequencial);

    let headerHTML = '<tr>';
    if (temNumero) headerHTML += '<th>N°</th>';
    categoria.campos.forEach(campo => {
        if (campo.tipo !== 'date') {
            headerHTML += `<th>${campo.label}</th>`;
        }
    });
    headerHTML += '<th>Fiscal</th><th>Data</th><th>Pontos</th></tr>';

    let bodyHTML = '';
    registros.forEach(reg => {
        bodyHTML += '<tr>';
        if (temNumero) bodyHTML += `<td>${reg.numero_sequencial || '-'}</td>`;
        categoria.campos.forEach(campo => {
            if (campo.tipo !== 'date') {
                bodyHTML += `<td>${reg.campos[campo.nome] || '-'}</td>`;
            }
        });
        const dataFormatada = obterDataReal(reg).toLocaleDateString('pt-BR');
        bodyHTML += `<td>${reg.fiscal_nome}</td><td>${dataFormatada}</td><td>${reg.pontuacao}</td></tr>`;
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
        const camposDef = catDef?.campos?.filter(c => c.tipo !== 'file') || [];

        let headerCols = camposDef.map(c => `<th>${c.label}</th>`).join('');
        headerCols += '<th>Pontos</th>';

        let linhas = cat.registros.map(r => {
            let tds = camposDef.map(c => `<td contenteditable="true">${r.campos[c.nome] || '-'}</td>`).join('');
            tds += `<td>${r.pontuacao}</td>`;
            return `<tr>${tds}</tr>`;
        }).join('');

        const subtotal = cat.registros.reduce((s, r) => s + r.pontuacao, 0);

        secoesHTML += `
            <div class="relatorio-secao">
                <h3>${cat.nome}</h3>
                <table>
                    <thead><tr>${headerCols}</tr></thead>
                    <tbody>${linhas}</tbody>
                    <tfoot><tr><td colspan="${camposDef.length}" style="text-align:right; font-weight:600;">Subtotal:</td><td style="font-weight:600;">${subtotal}</td></tr></tfoot>
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

// Executa quando a página carregar
document.addEventListener('DOMContentLoaded', inicializarProdutividade);
