// =============================================
// PRODUTIVIDADE.JS — Sistema de Produtividade
// =============================================

// --- FUNÇÃO AUXILIAR: VERIFICAR CONEXÃO ---
async function verificarConexaoAntesDeSalvar() {
    // 1. Checagem básica do navegador
    if (!navigator.onLine) {
        alert('⚠️ Você está offline. Não é possível salvar os dados sem conexão com a internet.\n\nVerifique sua conexão e tente novamente.');
        return false;
    }

    // 2. Checagem de Sessão (Supabase)
    // Isso evita o erro de RLS (Row Level Security) se a sessão tiver expirado silenciosamente
    if (window.garantirSessaoAtiva) {
        const sessaoOK = await window.garantirSessaoAtiva();
        if (!sessaoOK) return false; // O próprio garantirSessaoAtiva já redireciona se falhar criticamente
    }

    // 3. Checagem de resposta do servidor (Ping)
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s para o ping

        const response = await fetch('https://marmpnusgmbjphffaynr.supabase.co/rest/v1/', {
            method: 'HEAD',
            signal: controller.signal,
            cache: 'no-store'
        });

        clearTimeout(timeoutId);
        return true;
    } catch (error) {
        console.warn("Ping falhou, mas pode ser apenas lentidão:", error);
        const continuar = confirm('⚠️ Sua conexão parece estar instável ou muito lenta.\n\nDeseja tentar salvar mesmo assim?\n\n• Sim: Tentar salvar (pode falhar)\n• Não: Cancelar e verificar a conexão');
        return continuar;
    }
}

// --- FUNÇÕES AUXILIARES: HIERARQUIA DE PERMISSÕES ---
// Retorna o nível hierárquico do cargo (maior = mais permissões)
function getNivelHierarquico(role) {
    if (!role) return 0;
    const roleLower = role.toLowerCase();
    if (roleLower.includes('secretário') || roleLower.includes('secretario')) return 3;
    if (roleLower.includes('diretor')) return 2;
    if (roleLower.includes('gerente')) return 1;
    return 0;
}

// Verifica se o usuário é Gerente ou acima (Diretor, Secretário)
function isGerenteOuSuperior(role) {
    return getNivelHierarquico(role) >= 1;
}

// Verifica se o usuário é Diretor ou acima (Diretor, Secretário)
function isDiretorOuSuperior(role) {
    return getNivelHierarquico(role) >= 2;
}

// Verifica se o usuário é Secretário (topo da hierarquia)
function isSecretario(role) {
    return getNivelHierarquico(role) >= 3;
}
// --- FUNÇÕES AUXILIARES GERAIS ---
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// --- DEFINIÇÃO DAS CATEGORIAS ---
// Cada categoria espelha uma aba da planilha original
// Começando com 1 categoria de teste (2°)
const CATEGORIAS = [
    // === CONTROLE PROCESSUAL (1.1° a 1.7°) — Destaque ===
    {
        id: '1.1',
        nome: 'Notificação Preliminar',
        pontos: 5,
        destaque: true,
        campos: [
            { nome: 'n_notificacao', label: 'N° da Notificação', tipo: 'text', obrigatorio: true },
            { nome: 'nome', label: 'Nome do Contribuinte', tipo: 'text', obrigatorio: true },
            { nome: 'n_inscricao', label: 'N° de Inscrição', tipo: 'text', obrigatorio: true },
            { nome: 'bairro', label: 'Bairro', tipo: 'text', obrigatorio: true },
            { nome: 'motivo', label: 'Motivo', tipo: 'select_custom', obrigatorio: true, opcoes: ['Limpeza', 'Construção de Muro', 'Construção de Passeio', 'Reconstrução de Muro ou Passeio'] },
            { nome: 'anexo_pdf', label: 'Anexo (PDF/Docx)', tipo: 'file', obrigatorio: false, aceitar: '.pdf,.doc,.docx' }
        ]
    },
    {
        id: '1.2',
        nome: 'Auto de Infração',
        pontos: 5,
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
        pontos: 10,
        destaque: true,
        campos: [
            { nome: 'nome', label: 'Nome', tipo: 'text', obrigatorio: true },
            { nome: 'assunto', label: 'Assunto', tipo: 'text', obrigatorio: true }
        ]
    },
    {
        id: '1.5',
        nome: 'Relatório',
        pontos: 10,
        destaque: true,
        campos: [
            { nome: 'atendimento', label: 'Para o atendimento...', tipo: 'textarea', obrigatorio: true }
        ]
    },
    {
        id: '1.6',
        nome: 'Protocolo',
        pontos: 8,
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
        pontos: 50,
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
            { nome: 'descricao', label: 'N°', tipo: 'text', obrigatorio: true },
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
        destaque: true,
        campos: [
            { nome: 'n_auto', label: 'N° do Auto de Infração', tipo: 'text', obrigatorio: true },
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
        pontos: 80,
        campos: [
            { nome: 'estabelecimento', label: 'Nome do Estabelecimento', tipo: 'text', obrigatorio: true },
            { nome: 'tipo', label: 'Tipo (Comercial / Industrial / Educacional / Público)', tipo: 'text', obrigatorio: true },
            { nome: 'data', label: 'Data', tipo: 'date', obrigatorio: true }
        ]
    },
    {
        id: '25',
        nome: 'Cumprimento do Termo de Interdição de estabelecimentos',
        pontos: 150,
        campos: [
            { nome: 'estabelecimento', label: 'Nome do Estabelecimento', tipo: 'text', obrigatorio: true },
            { nome: 'tipo', label: 'Tipo (Comercial / Industrial / Educacional / Público)', tipo: 'text', obrigatorio: true },
            { nome: 'data', label: 'Data', tipo: 'date', obrigatorio: true }
        ]
    },
    {
        id: '26',
        nome: 'Cassação de Alvarás de Localização e funcionamento, devido a irregularidades',
        pontos: 100,
        campos: [
            { nome: 'estabelecimento', label: 'Nome do Estabelecimento', tipo: 'text', obrigatorio: true },
            { nome: 'n_alvara', label: 'N° do Alvará', tipo: 'text', obrigatorio: true },
            { nome: 'data', label: 'Data', tipo: 'date', obrigatorio: true }
        ]
    },
    {
        id: '27',
        nome: 'Cassação de Licenças (Bancas, Barracas, Panfletagem, Mesa e Cadeira, Propaganda Sonora)',
        pontos: 40,
        campos: [
            { nome: 'tipo_licenca', label: 'Tipo de Licença', tipo: 'text', obrigatorio: true },
            { nome: 'n_licenca', label: 'N° da Licença', tipo: 'text', obrigatorio: true },
            { nome: 'data', label: 'Data', tipo: 'date', obrigatorio: true }
        ]
    },
    {
        id: '28',
        nome: 'Plantão fiscal na repartição, por hora trabalhada',
        pontos: 20,
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
        pontos: 40,
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
        pontos: 20,
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

    // SE for Notificação Preliminar (1.1) adicionar botão extra de Autopreenchimento de Word no topo
    if (categoria.id === '1.1') {
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
        } else if (campo.nome === 'n_licenca' && categoria.id === '19') {
            // Caso especial: Categoria 19 com múltiplos campos de licença
            inputHTML = `
                <div id="container-licencas" style="display: flex; flex-direction: column; gap: 8px;">
                    <div class="licenca-item" style="display: flex; gap: 8px;">
                        <input type="text" class="campo-licenca-multi" placeholder="N° da Licença" required style="flex: 1;">
                        <button type="button" class="btn-add-licenca" onclick="adicionarCampoLicenca()" style="background: #2ecc71; color: white; border: none; border-radius: 6px; padding: 0 14px; cursor: pointer; font-weight: bold; font-size: 1.1rem; height: 42px;">+</button>
                    </div>
                </div>
            `;
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
    } else if (categoria.id === '11') {
        btnSalvarForm.textContent = 'Gerar Número';
        btnSalvarForm.onclick = () => salvarRegistro();
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
function fecharModalProdutividade() {
    const overlay = document.getElementById('modal-produtividade');
    overlay.classList.remove('ativo');
    categoriaAtual = null;
}

// --- FUNÇÃO PARA ADICIONAR CAMPO DE LICENÇA (CATEGORIA 19) ---
window.adicionarCampoLicenca = function () {
    const container = document.getElementById('container-licencas');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'licenca-item';
    div.style.display = 'flex';
    div.style.gap = '8px';
    div.style.marginTop = '8px';
    div.innerHTML = `
        <input type="text" class="campo-licenca-multi" placeholder="N° da Licença" style="flex: 1;">
        <button type="button" onclick="this.parentElement.remove()" style="background: #ef4444; color: white; border: none; border-radius: 6px; padding: 0 14px; cursor: pointer; font-weight: bold; font-size: 1.1rem; height: 42px;">×</button>
    `;
    container.appendChild(div);
    div.querySelector('input').focus();
};

// --- SALVAR REGISTRO ---
let salvando = false;
async function salvarRegistro(blobManual = null, nomeManual = null) {
    if (!categoriaAtual || salvando) return;

    // Verificar conexão antes de salvar
    const conexaoOK = await verificarConexaoAntesDeSalvar();
    if (!conexaoOK) {
        return;
    }

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

        // CASO ESPECIAL: Múltiplas licenças (Categoria 19)
        if (categoriaAtual.id === '19' && campo.nome === 'n_licenca') {
            const inputsMulti = document.querySelectorAll('.campo-licenca-multi');
            const lista = [];
            inputsMulti.forEach(inp => {
                const val = inp.value.trim();
                if (val) {
                    lista.push(val);
                    inp.style.borderColor = '#e2e8f0';
                } else if (campo.obrigatorio && lista.length === 0) {
                    inp.style.borderColor = '#ef4444';
                }
            });

            if (lista.length === 0 && campo.obrigatorio) {
                todosPreenchidos = false;
            } else {
                campos['_lista_licencas'] = lista;
            }
            return;
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
    const { data: { user } } = await getAuthUser();
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
                    .maybeSingle();
                const fiscalNome = perfil?.full_name || 'Fiscal';

                // Gerar número sequencial se necessário (AI, Ofício, Relatório, Réplica, Dívida Ativa)
                let numeroSeq = null;
                const categoriasAutoNum = ['1.2', '1.4', '1.5', '1.7', '11'];
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
                // NÃO É CP (Registros Produtividade)
                if (categoriaAtual.id === '19' && campos._lista_licencas && campos._lista_licencas.length > 1) {
                    // MULTIPLOS INSERTS (Categoria 19)
                    const registrosMulti = campos._lista_licencas.map(lic => {
                        const camposIndiv = { ...campos };
                        delete camposIndiv._lista_licencas;
                        camposIndiv.n_licenca = lic;
                        return {
                            user_id: user.id,
                            categoria_id: categoriaAtual.id,
                            categoria_nome: categoriaAtual.nome,
                            pontuacao: pontos,
                            campos: camposIndiv
                        };
                    });
                    ({ data, error } = await supabaseClient
                        .from('registros_produtividade')
                        .insert(registrosMulti)
                        .select());
                } else {
                    // INSERT NORMAL
                    const camposLimpos = { ...campos };
                    if (camposLimpos._lista_licencas) {
                        camposLimpos.n_licenca = camposLimpos._lista_licencas[0];
                        delete camposLimpos._lista_licencas;
                    }
                    ({ data, error } = await supabaseClient
                        .from('registros_produtividade')
                        .insert({
                            user_id: user.id,
                            categoria_id: categoriaAtual.id,
                            categoria_nome: categoriaAtual.nome,
                            pontuacao: pontos,
                            campos: camposLimpos
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

            // Atualizar histórico aguardando o Supabase com pequena margem de segurança
            await new Promise(r => setTimeout(r, 500));
            await carregarHistorico();

            if (eraEdicao) {
                alert('Registro atualizado com sucesso!');
            } else if (categoriaAtual.id === '11' && data && data.length > 0) {
                // Para Dívida Ativa, o usuário precisa ver o número gerado para anotar no processo físico
                alert(`✅ Registro salvo com sucesso!\n\nSeu número de Dívida Ativa gerado é: ${data[0].numero_sequencial}`);
            } else if (categoriaAtual.id === '19' && campos._lista_licencas && campos._lista_licencas.length > 1) {
                alert(`✅ ${campos._lista_licencas.length} registros salvos com sucesso! (${pontos * campos._lista_licencas.length} pontos no total)`);
            } else {
                alert('✅ Registro salvo com sucesso! (' + pontos + ' pontos)');
            }

            // Fechar modal DEPOIS do alerta (pois zera a categoriaAtual)
            fecharModalProdutividade();

        } // Fim de else (CRIAÇÃO)
    } catch (err) {
        console.error("Erro no salvarRegistro:", err);
        alert('Ocorreu um erro ao salvar o registro no banco de dados: ' + (err.message || JSON.stringify(err)));
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

    // Usar promessa global via helper em painel.js
    const { data: { user } } = await getAuthUser();
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

    // Unir ambos e filtrar para o histórico pessoal:
    // Não deve aparecer nenhum registro que tenha pontuação 0
    todosRegistros = [...prodMarcados, ...cpMarcados]
        .filter(r => r.pontuacao > 0)
        .sort((a, b) => obterDataReal(b) - obterDataReal(a));

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
    filtrarHistorico();
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

    if (categoriasUsadas.includes(valorAtual)) {
        select.value = valorAtual;
    } else {
        select.value = "";
    }
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

    // Número Sequencial (se houver, ex: 001/2026)
    if (reg.numero_sequencial) {
        html += `<div class="detalhe-item">
            <span class="detalhe-label">Número Sequencial</span>
            <span class="detalhe-valor" style="font-weight: bold; color: #1e293b;">${reg.numero_sequencial}</span>
        </div>`;
    }

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

    // Verificar conexão antes de excluir
    const conexaoOK = await verificarConexaoAntesDeSalvar();
    if (!conexaoOK) {
        return;
    }

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
    const anoAtual = new Date().getFullYear(); // ex: 2026
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
    // Limpar TODOS os filtros ao trocar sub-aba
    const buscaInput = document.getElementById('busca-historico-geral');
    if (buscaInput) buscaInput.value = '';
    const inputFiscal = document.getElementById('busca-fiscal-geral');
    if (inputFiscal) inputFiscal.value = '';
    const selectBairro = document.getElementById('filtro-bairro-historico');
    if (selectBairro) selectBairro.value = '';
    const selectAno = document.getElementById('busca-ano-geral');
    if (selectAno) selectAno.value = '';
    atualizarIndicadorFiltro();
    carregarHistoricoGeral(categoriaId);
}

let buscaIdGlobal = 0; // Para cancelar buscas sobrepostas

async function carregarHistoricoGeral(categoriaId) {
    const container = document.getElementById('historico-geral-lista');
    if (!container) return;

    container.innerHTML = '<div class="historico-vazio">Carregando...</div>';

    // 1. Coleta filtros da UI
    const termo = (document.getElementById('busca-historico-geral')?.value || '').toLowerCase().trim();
    const termoFiscal = (document.getElementById('busca-fiscal-geral')?.value || '').toLowerCase().trim();
    const bairroSelecionado = document.getElementById('filtro-bairro-historico')?.value || '';
    const anoSelecionado = document.getElementById('busca-ano-geral')?.value || '';

    // 2. Constrói Query
    let query = supabaseClient.from('controle_processual').select('*');

    // Categoria
    if (categoriaId !== 'todos') {
        query = query.eq('categoria_id', categoriaId);
    }

    // Filtro por Bairro (Remoto via JSON field)
    if (bairroSelecionado) {
        query = query.filter('campos->>bairro', 'eq', bairroSelecionado);
    }

    // Filtro por Fiscal
    if (termoFiscal) {
        query = query.ilike('fiscal_nome', `%${termoFiscal}%`);
    }

    // Filtro por Ano (via created_at para performance remota)
    if (anoSelecionado) {
        query = query.gte('created_at', `${anoSelecionado}-01-01T00:00:00`)
                    .lte('created_at', `${anoSelecionado}-12-31T23:59:59`);
    }

    // Busca Livre em múltiplos campos JSON
    if (termo) {
        const camposBusca = ['n_notificacao', 'n_auto', 'n_ar', 'n_oficio', 'n_relatorio', 'n_protocolo', 'n_replica', 'nome', 'bairro', 'n_inscricao'];
        const orConditions = camposBusca.map(f => `campos->>${f}.ilike.%${termo}%`).join(',');
        query = query.or(orConditions);
    }

    // 3. Execução em blocos (Batch Fetching) até o fim
    buscaIdGlobal++;
    const buscaIdLocal = buscaIdGlobal;
    
    let todosOsRegistros = [];
    let contadorOffset = 0;
    const tamanhoPagina = 1000;
    let totalEncontrado = 0;
    let erroOcorrido = false;

    try {
        // Primeiro bloco para pegar o total (count: exact)
        let queryInicial = query.range(0, tamanhoPagina - 1);
        const { data: primeiroBloco, error: erroInicial, count } = await queryInicial;
        
        if (erroInicial) throw erroInicial;
        if (buscaIdLocal !== buscaIdGlobal) return; // Busca obsoleta

        totalEncontrado = count || 0;
        todosOsRegistros = primeiroBloco || [];

        // Renderização parcial (Feedback rápido)
        renderizarTabelaGeral(todosOsRegistros, categoriaId, `Carregando... (${todosOsRegistros.length} / ${totalEncontrado})`);

        // Busca o restante se houver
        while (todosOsRegistros.length < totalEncontrado) {
            contadorOffset += tamanhoPagina;
            const { data: proximoBloco, error: proximoErro } = await query.range(contadorOffset, contadorOffset + tamanhoPagina - 1);
            
            if (proximoErro) throw proximoErro;
            if (buscaIdLocal !== buscaIdGlobal) return; // Nova busca iniciada pelo usuário

            if (!proximoBloco || proximoBloco.length === 0) break;
            
            todosOsRegistros = todosOsRegistros.concat(proximoBloco);
            
            // Atualiza progresso na tela a cada bloco
            renderizarTabelaGeral(todosOsRegistros, categoriaId, `Carregando... (${todosOsRegistros.length} / ${totalEncontrado})`);
        }
    } catch (err) {
        console.error('Erro na busca limitless:', err);
        container.innerHTML = '<div class="historico-vazio">Erro ao carregar do servidor.</div>';
        return;
    }

    if (todosOsRegistros.length === 0) {
        registrosGeralAtual = [];
        container.innerHTML = '<div class="historico-vazio">Nenhum registro encontrado no banco de dados.</div>';
        return;
    }

    // Ordenar final no JS
    const registrosOrdenados = todosOsRegistros.sort((a, b) => obterDataReal(b) - obterDataReal(a));
    registrosGeralAtual = registrosOrdenados;
    
    // Atualiza dropdown de bairros apenas se não estiver pesquisando especificamente
    if (!termo && !bairroSelecionado && !termoFiscal) {
        popularFiltroBairros(registrosOrdenados);
    }

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

// Filtro de busca misto: Real-time no Supabase
const filtrarHistoricoGeral = debounce(() => {
    // subAbaAtual é uma variável global que deve estar definida em produtividade.js ou painel.js
    let aba = typeof subAbaAtual !== 'undefined' ? subAbaAtual : '1.1';
    
    carregarHistoricoGeral(aba);
    
    // Atualizar bolinha indicadora no botão Filtro instantaneamente
    atualizarIndicadorFiltro();
}, 400);

// Expõe para o HTML
window.filtrarHistoricoGeral = filtrarHistoricoGeral;

// Abre/Fecha o painel de filtros
function togglePainelFiltro() {
    const painel = document.getElementById('painel-filtro-popup');
    if (!painel) return;
    const aberto = painel.style.display === 'block';
    painel.style.display = aberto ? 'none' : 'block';
    atualizarIndicadorFiltro();
}

// Fecha o painel ao clicar fora dele
document.addEventListener('click', function (e) {
    const painel = document.getElementById('painel-filtro-popup');
    const btn = document.getElementById('btn-filtro-toggle');
    if (!painel || !btn) return;
    if (!painel.contains(e.target) && !btn.contains(e.target)) {
        painel.style.display = 'none';
    }
});

// Limpa todos os filtros e atualiza a tabela
function limparFiltrosHistorico() {
    const inputFiscal = document.getElementById('busca-fiscal-geral');
    const selectBairro = document.getElementById('filtro-bairro-historico');
    if (inputFiscal) inputFiscal.value = '';
    if (selectBairro) selectBairro.value = '';
    filtrarHistoricoGeral();
    atualizarIndicadorFiltro();
}

// Mostra um ponto vermelho no botão Filtro se algum filtro estiver ativo
function atualizarIndicadorFiltro() {
    const btn = document.getElementById('btn-filtro-toggle');
    if (!btn) return;
    const inputFiscal = document.getElementById('busca-fiscal-geral');
    const selectBairro = document.getElementById('filtro-bairro-historico');
    const temFiltro = (inputFiscal && inputFiscal.value.trim()) || (selectBairro && selectBairro.value);
    btn.innerHTML = temFiltro
        ? 'Filtro <span style="width:8px;height:8px;background:#10b981;border-radius:50%;display:inline-block;"></span>'
        : 'Filtro';
}

function renderizarTabelaGeral(registros, categoriaId, statusExtra = '') {
    const container = document.getElementById('historico-geral-lista');
    // Usar nova hierarquia de permissões: Gerente, Diretor e Secretário podem ver anexos
    const podeVerAnexos = isGerenteOuSuperior(window.userRoleGlobal) ||
        (window.userRoleGlobal || '').toLowerCase().includes('administrativo') ||
        (window.userRoleGlobal || '').toLowerCase().includes('administrador');

    const inputFiscal = document.getElementById('busca-fiscal-geral');
    const termoFiscal = inputFiscal ? inputFiscal.value.trim() : '';
    const aplicandoFiltroFiscal = typeof termoFiscal === 'string' && termoFiscal.length > 0;

    let qtdVerde = 0;
    let qtdVermelha = 0;
    let qtdCinza = 0;

    if (aplicandoFiltroFiscal) {
        registros.forEach(reg => {
            const vResposta = reg.campos && reg.campos.resposta_fiscal ? reg.campos.resposta_fiscal.trim() : '';
            const vHistoricoInfo = reg.campos && reg.campos.historico_admin ? reg.campos.historico_admin.trim() : '';
            const vVencimento = reg.campos && reg.campos.data_vencimento ? reg.campos.data_vencimento : null;

            let dtVencimentoVencida = false;
            if (vVencimento) {
                const hj = new Date();
                hj.setHours(0, 0, 0, 0);
                const partes = vVencimento.split('-');
                if (partes.length === 3) {
                    const dVence = new Date(partes[0], partes[1] - 1, partes[2]);
                    if (dVence < hj) dtVencimentoVencida = true;
                }
            }

            if (vResposta !== '') {
                qtdVerde++;
            } else if (vHistoricoInfo !== '') {
                qtdVermelha++;
            } else if (dtVencimentoVencida) {
                qtdCinza++;
            }
        });
    }

    let graficoHTML = '';
    if (aplicandoFiltroFiscal) {
        graficoHTML = `
            <div style="margin-bottom: 20px; padding: 15px; background: white; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <h3 style="margin-top:0; margin-bottom:15px; color:#1e293b; font-size:16px;">Status das Pendências do Fiscal</h3>
                <div style="height: 200px; position: relative;">
                    <canvas id="grafico-status-fiscal"></canvas>
                </div>
            </div>
        `;
    }

    const renderizarChart = () => {
        if (aplicandoFiltroFiscal) {
            setTimeout(() => {
                const ctx = document.getElementById('grafico-status-fiscal');
                if (ctx && typeof Chart !== 'undefined') {
                    if (window.graficoStatusFiscalChart) {
                        try { window.graficoStatusFiscalChart.destroy(); } catch (e) { }
                    }
                    window.graficoStatusFiscalChart = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: ['Atendidos (Verde)', 'Com Histórico (Vermelho)', 'Vencidos (Cinza)'],
                            datasets: [{
                                label: 'Registros',
                                data: [qtdVerde, qtdVermelha, qtdCinza],
                                backgroundColor: ['#86efac', '#fca5a5', '#cbd5e1'],
                                borderColor: ['#4ade80', '#f87171', '#94a3b8'],
                                borderWidth: 1,
                                borderRadius: 4,
                                maxBarThickness: 60
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
                            plugins: { legend: { display: false } }
                        }
                    });
                }
            }, 50);
        }
    };

    if (categoriaId === 'todos') {
        let headerHTML = '<tr><th>Tipo de Documento</th><th>Identificador / Nome</th><th>Fiscal</th><th>Data</th><th>Pontos</th>';
        if (podeVerAnexos) headerHTML += '<th>Anexo</th>';
        headerHTML += '</tr>';

        let bodyHTML = '';
        registros.forEach((reg) => {
            let nomeCategoria = 'Desconhecido';
            switch (reg.categoria_id) {
                case '1.1': nomeCategoria = 'NP'; break;
                case '1.2': nomeCategoria = 'Auto Infração'; break;
                case '1.3': nomeCategoria = 'AR'; break;
                case '1.4': nomeCategoria = 'Ofício'; break;
                case '1.5': nomeCategoria = 'Relatório de Vistoria'; break;
                case '1.6': nomeCategoria = 'Protocolo'; break;
                case '1.7': nomeCategoria = 'Réplica'; break;
                case '11': nomeCategoria = 'Dívida Ativa'; break;
                default:
                    const catObj = CATEGORIAS.find(c => c.id === reg.categoria_id);
                    nomeCategoria = catObj ? catObj.nome : 'Desconhecido';
            }

            // Tenta pegar o identificador principal (numero ou nome)
            let identificador = reg.numero_sequencial || (reg.campos && reg.campos.nome) || '-';

            const temAnexo = reg.campos && reg.campos.anexo_pdf;
            const dataFormatada = obterDataReal(reg).toLocaleDateString('pt-BR');

            // --- Lógica de cor (Filtro Fiscal) ---
            const vResposta = reg.campos && reg.campos.resposta_fiscal ? reg.campos.resposta_fiscal.trim() : '';
            const vHistoricoInfo = reg.campos && reg.campos.historico_admin ? reg.campos.historico_admin.trim() : '';
            const vVencimento = reg.campos && reg.campos.data_vencimento ? reg.campos.data_vencimento : null;

            let dtVencimentoVencida = false;
            if (vVencimento) {
                const hj = new Date();
                hj.setHours(0, 0, 0, 0);
                const partes = vVencimento.split('-');
                if (partes.length === 3) {
                    const dVence = new Date(partes[0], partes[1] - 1, partes[2]);
                    if (dVence < hj) dtVencimentoVencida = true;
                }
            }

            let bgColor = 'transparent';
            let hoverColor = '#f8fafc';

            if (aplicandoFiltroFiscal) {
                if (vResposta !== '') {
                    bgColor = '#86efac';
                    hoverColor = '#4ade80';
                } else if (vHistoricoInfo !== '') {
                    bgColor = '#fca5a5';
                    hoverColor = '#f87171';
                } else if (dtVencimentoVencida) {
                    bgColor = '#cbd5e1';
                    hoverColor = '#94a3b8';
                }
            }

            let rowAttributes = '';
            if (['1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '11'].includes(reg.categoria_id)) {
                rowAttributes = ` style="background:${bgColor}; cursor:pointer; transition: background 0.2s;" onmouseover="this.dataset.baseBg='${bgColor}'; this.style.background='${hoverColor}'" onmouseout="this.style.background=this.dataset.baseBg || '${bgColor}'" onclick="if(event.target.tagName !== 'BUTTON') abrirDetalhesAdminHist('${reg.id}')" title="Clique para mais detalhes"`;
            } else {
                rowAttributes = ` style="background:${bgColor}; transition: background 0.2s;" onmouseover="this.dataset.baseBg='${bgColor}'; this.style.background='${hoverColor}'" onmouseout="this.style.background=this.dataset.baseBg || '${bgColor}'"`;
            }

            bodyHTML += `<tr${rowAttributes}>`;
            bodyHTML += `<td><span style="background:#10b981; color:#ffffff; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:600; box-shadow:0 1px 2px rgba(0,0,0,0.1);">${nomeCategoria}</span></td>`;
            bodyHTML += `<td>${identificador}</td>`;
            bodyHTML += `<td>${reg.fiscal_nome}</td><td>${dataFormatada}</td><td>${reg.pontuacao}</td>`;

            if (podeVerAnexos) {
                const temAnexoAR = reg.campos && reg.campos.anexo_ar;
                let anexoHTML = '';

                if (temAnexo) {
                    anexoHTML += `<button onclick="abrirAnexoGerente('${reg.campos.anexo_pdf}')" style="background:#10b981;color:white;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;display:block;margin:0 auto;">📄 Ver</button>`;
                }
                if (temAnexoAR) {
                    anexoHTML += `<button onclick="abrirAnexoGerente('${reg.campos.anexo_ar}')" style="background:#3b82f6;color:white;border:none;padding:3px 8px;border-radius:5px;cursor:pointer;font-size:11px;font-weight:600;display:block;margin:${temAnexo ? '6px' : '0'} auto 0 auto;width:90%;">📄 AR</button>`;
                }

                if (anexoHTML !== '') {
                    bodyHTML += `<td style="vertical-align:middle; text-align:center;">${anexoHTML}</td>`;
                } else {
                    bodyHTML += `<td style="color:#94a3b8;font-size:12px;vertical-align:middle;text-align:center;">—</td>`;
                }
            }
            bodyHTML += '</tr>';
        });

        container.innerHTML = `
            ${graficoHTML}
            <div style="overflow-x: auto;">
                <table class="historico-tabela">
                    <thead>${headerHTML}</thead>
                    <tbody>${bodyHTML}</tbody>
                </table>
            </div>
            <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center;">
                <p style="font-size: 0.85rem; color: #64748b;">
                    Total: ${registros.length} registro(s)
                </p>
                ${statusExtra ? `<p style="font-size: 0.85rem; color: #10b981; font-weight: 600;">${statusExtra}</p>` : ''}
            </div>
        `;
        renderizarChart();
        return;
    }

    const categoria = CATEGORIAS.find(c => c.id === categoriaId);
    if (!categoria) return;

    // Colunas: Nº (se tiver), campos da categoria + Fiscal + Data
    const temNumero = registros.some(r => r.numero_sequencial);

    let headerHTML = '<tr>';
    if (temNumero) headerHTML += '<th>N°</th>';
    categoria.campos.forEach(campo => {
        if (campo.tipo !== 'date' && campo.tipo !== 'file' && !campo.ignorarNoBanco) {
            headerHTML += `<th>${campo.label}</th>`;
        }
    });
    headerHTML += '<th>Fiscal</th><th>Data</th><th>Pontos</th>';
    if (podeVerAnexos) headerHTML += '<th>Anexo</th>';
    headerHTML += '</tr>';

    let bodyHTML = '';
    registros.forEach((reg, idx) => {
        const temAnexo = reg.campos && reg.campos.anexo_pdf;

        // --- Lógica de cor (Filtro Fiscal) ---
        const vResposta = reg.campos && reg.campos.resposta_fiscal ? reg.campos.resposta_fiscal.trim() : '';
        const vHistoricoInfo = reg.campos && reg.campos.historico_admin ? reg.campos.historico_admin.trim() : '';
        const vVencimento = reg.campos && reg.campos.data_vencimento ? reg.campos.data_vencimento : null;

        let dtVencimentoVencida = false;
        if (vVencimento) {
            const hj = new Date();
            hj.setHours(0, 0, 0, 0);
            const partes = vVencimento.split('-');
            if (partes.length === 3) {
                const dVence = new Date(partes[0], partes[1] - 1, partes[2]);
                if (dVence < hj) dtVencimentoVencida = true;
            }
        }

        let bgColor = 'transparent';
        let hoverColor = '#f8fafc';

        if (aplicandoFiltroFiscal) {
            if (vResposta !== '') {
                bgColor = '#86efac';
                hoverColor = '#4ade80';
            } else if (vHistoricoInfo !== '') {
                bgColor = '#fca5a5';
                hoverColor = '#f87171';
            } else if (dtVencimentoVencida) {
                bgColor = '#cbd5e1';
                hoverColor = '#94a3b8';
            }
        }

        let rowAttributes = '';
        if (['1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '11'].includes(categoria.id)) {
            rowAttributes = ` style="background:${bgColor}; cursor:pointer; transition: background 0.2s;" onmouseover="this.dataset.baseBg='${bgColor}'; this.style.background='${hoverColor}'" onmouseout="this.style.background=this.dataset.baseBg || '${bgColor}'" onclick="if(event.target.tagName !== 'BUTTON') abrirDetalhesAdminHist('${reg.id}')" title="Clique para mais detalhes"`;
        } else {
            rowAttributes = ` style="background:${bgColor}; transition: background 0.2s;" onmouseover="this.dataset.baseBg='${bgColor}'; this.style.background='${hoverColor}'" onmouseout="this.style.background=this.dataset.baseBg || '${bgColor}'"`;
        }
        bodyHTML += `<tr${rowAttributes}>`;
        if (temNumero) bodyHTML += `<td>${reg.numero_sequencial || '-'}</td>`;
        categoria.campos.forEach(campo => {
            if (campo.tipo !== 'date' && campo.tipo !== 'file' && !campo.ignorarNoBanco) {
                bodyHTML += `<td>${reg.campos[campo.nome] || '-'}</td>`;
            }
        });
        const dataFormatada = obterDataReal(reg).toLocaleDateString('pt-BR');
        bodyHTML += `<td>${reg.fiscal_nome}</td><td>${dataFormatada}</td><td>${reg.pontuacao}</td>`;

        if (podeVerAnexos) {
            const temAnexoAR = reg.campos && reg.campos.anexo_ar;
            let anexoHTML = '';

            if (temAnexo) {
                anexoHTML += `<button onclick="abrirAnexoGerente('${reg.campos.anexo_pdf}')" style="background:#10b981;color:white;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;display:block;margin:0 auto;">📄 Ver</button>`;
            }
            if (temAnexoAR) {
                anexoHTML += `<button onclick="abrirAnexoGerente('${reg.campos.anexo_ar}')" style="background:#3b82f6;color:white;border:none;padding:3px 8px;border-radius:5px;cursor:pointer;font-size:11px;font-weight:600;display:block;margin:${temAnexo ? '6px' : '0'} auto 0 auto;width:90%;">📄 AR</button>`;
            }

            if (anexoHTML !== '') {
                bodyHTML += `<td style="vertical-align:middle; text-align:center;">${anexoHTML}</td>`;
            } else {
                bodyHTML += `<td style="color:#94a3b8;font-size:12px;vertical-align:middle;text-align:center;">—</td>`;
            }
        }
        bodyHTML += '</tr>';
    });

    container.innerHTML = `
        ${graficoHTML}
        <div style="overflow-x: auto;">
            <table class="historico-tabela">
                <thead>${headerHTML}</thead>
                <tbody>${bodyHTML}</tbody>
            </table>
        </div>
        <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center;">
            <p style="font-size: 0.85rem; color: #64748b;">
                Total: ${registros.length} registro(s)
            </p>
            ${statusExtra ? `<p style="font-size: 0.85rem; color: #10b981; font-weight: 600;">${statusExtra}</p>` : ''}
        </div>
    `;
    renderizarChart();
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

// --- DETALHES GERAIS (MODAL CLICÁVEL) ---
async function abrirDetalhesAdminHist(id) {
    if (!registrosGeralAtual) return;
    const reg = registrosGeralAtual.find(r => r.id === id);
    if (!reg) return;

    const existente = document.getElementById('modal-detalhes-admin-hist');
    if (existente) existente.remove();

    const catDef = CATEGORIAS.find(c => c.id === reg.categoria_id);
    const campos = reg.campos || {};

    let htmlCampos = '';

    const dataReg = new Date(reg.created_at).toLocaleDateString('pt-BR');
    htmlCampos += `<div style="margin-bottom:8px;"><strong>Registrado em:</strong> ${dataReg}</div>`;
    htmlCampos += `<div style="margin-bottom:8px;"><strong>Fiscal:</strong> ${reg.fiscal_nome}</div>`;

    // Número Sequencial (se houver, ex: 001/2026)
    if (reg.numero_sequencial) {
        htmlCampos += `<div style="margin-bottom:8px;">
            <strong>Número Sequencial:</strong> 
            <span style="font-weight: bold; color: #1e293b;">${reg.numero_sequencial}</span>
        </div>`;
    }

    Object.entries(campos).forEach(([chave, valor]) => {
        if (!valor || chave.startsWith('anexo_') || chave === 'data_entrada' || chave === 'data_vencimento' || chave === 'historico_admin' || chave === 'resposta_fiscal' || chave === 'ar') return;
        let label = chave;
        if (catDef) {
            const campoDef = catDef.campos.find(c => c.nome === chave);
            if (campoDef) label = campoDef.label;
        }
        htmlCampos += `<div style="margin-bottom:8px;"><strong>${label}:</strong> ${valor}</div>`;
    });

    htmlCampos += '<hr style="border:0; border-top:1px dashed #cbd5e1; margin:16px 0;">';

    const { data: { user } } = await getAuthUser();
    const userIdAtual = user ? user.id : null;

    var roleLowerRaw = (window.userRoleGlobal || '').toLowerCase();
    // Hierarquia de permissões: Secretário > Diretor > Gerente > Administrativo/Outros
    const isCargoGerencia = isGerenteOuSuperior(window.userRoleGlobal) ||
        roleLowerRaw.includes('administrativo') && roleLowerRaw.includes('postura') ||
        roleLowerRaw.includes('administrador') && roleLowerRaw.includes('postura');
    const isDono = reg.user_id === userIdAtual;

    const vEntrada = campos.data_entrada || '';
    const vVencimento = campos.data_vencimento || '';
    const vAR = campos.ar || '';
    const vHistorico = campos.historico_admin || '';
    const vResposta = campos.resposta_fiscal || '';

    let btnSalvar = '';

    if (reg.categoria_id !== '11') {
        if (isCargoGerencia) {
            htmlCampos += `<div style="margin-bottom:12px;">
                <label style="display:block; font-weight:600; margin-bottom:4px; font-size:14px; color:#3b82f6;">Data de Entrada (Admin)</label>
                <input type="date" id="admin-data-entrada" value="${vEntrada}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; outline:none;">
            </div>`;
            htmlCampos += `<div style="margin-bottom:12px;">
                <label style="display:block; font-weight:600; margin-bottom:4px; font-size:14px; color:#3b82f6;">Data de Vencimento (Admin)</label>
                <input type="date" id="admin-data-vencimento" value="${vVencimento}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; outline:none;">
            </div>`;
            htmlCampos += `<div style="margin-bottom:12px;">
                <label style="display:block; font-weight:600; margin-bottom:4px; font-size:14px; color:#3b82f6;">AR (Admin)</label>
                <input type="text" id="admin-ar" value="${vAR}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; outline:none;">
            </div>`;
            if (campos.anexo_ar) {
                htmlCampos += `<div id="container-anexo-ar-atual" style="margin-bottom:12px; font-size:14px; display:flex; align-items:center; gap:8px;">
                    <a href="${campos.anexo_ar}" target="_blank" style="color:#0ea5e9; text-decoration:underline; font-weight:600;">Ver anexo do AR atual</a>
                    <button onclick="document.getElementById('container-anexo-ar-atual').style.display='none'; document.getElementById('admin-remover-anexo-ar').checked = true;" title="Remover anexo" style="background:#ef4444; color:white; border:none; border-radius:50%; width:20px; height:20px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-weight:bold; font-size:12px; line-height:1; transition:0.2s;" onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='#ef4444'">✕</button>
                    <input type="checkbox" id="admin-remover-anexo-ar" style="display:none;">
                </div>`;
            }
            htmlCampos += `<div style="margin-bottom:12px;">
                <label style="display:block; font-weight:600; margin-bottom:4px; font-size:14px; color:#3b82f6;">Anexar Arquivo do AR</label>
                <input type="file" id="admin-anexo-ar" accept=".png,.jpg,.jpeg,.doc,.docx,.pdf" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; outline:none; background:white;">
            </div>`;
            htmlCampos += `<div style="margin-bottom:12px;">
                <label style="display:block; font-weight:600; margin-bottom:4px; font-size:14px; color:#3b82f6;">Histórico (Admin)</label>
                <textarea id="admin-historico-texto" rows="3" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; outline:none; font-family:inherit;">${vHistorico}</textarea>
            </div>`;
        } else {
            htmlCampos += `<div style="margin-bottom:8px;"><strong>Data de Entrada:</strong> ${vEntrada ? vEntrada.split('-').reverse().join('/') : '—'}</div>`;
            htmlCampos += `<div style="margin-bottom:8px;"><strong>Data de Vencimento:</strong> ${vVencimento ? vVencimento.split('-').reverse().join('/') : '—'}</div>`;
            htmlCampos += `<div style="margin-bottom:8px;"><strong>AR:</strong> ${vAR || '—'}</div>`;
            if (campos.anexo_ar) {
                htmlCampos += `<div style="margin-bottom:8px;"><strong>Anexo AR:</strong> <a href="${campos.anexo_ar}" target="_blank" style="color:#0ea5e9; text-decoration:underline;">Visualizar Arquivo</a></div>`;
            }
            htmlCampos += `<div style="margin-bottom:8px; white-space:pre-wrap;"><strong>Histórico Administrativo:</strong> ${vHistorico || '—'}</div>`;
        }

        if (isDono) {
            // Prepara visualização de toggle para a resposta
            const isOpcaoPadrao = vResposta === 'ATENDIDO' || vResposta === '';

            htmlCampos += `<div style="margin-bottom:12px;">
                <label style="display:block; font-weight:600; margin-bottom:4px; font-size:14px; color:#10b981;">Sua Resposta</label>
                <select id="admin-resposta-select" onchange="const t = document.getElementById('admin-resposta-text-container'); if(this.value === 'Outro') { t.style.display = 'block'; } else { t.style.display = 'none'; document.getElementById('admin-resposta-fiscal').value = ''; }" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; outline:none; margin-bottom:8px; background:white;">
                    <option value="">Selecione...</option>
                    <option value="ATENDIDO" ${vResposta === 'ATENDIDO' ? 'selected' : ''}>ATENDIDO</option>
                    <option value="Outro" ${!isOpcaoPadrao ? 'selected' : ''}>Outro (Escrever manual...)</option>
                </select>
                <div id="admin-resposta-text-container" style="display:${!isOpcaoPadrao ? 'block' : 'none'};">
                    <textarea id="admin-resposta-fiscal" rows="3" placeholder="Digite sua resposta personalizada..." style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; outline:none; font-family:inherit;">${!isOpcaoPadrao ? vResposta : ''}</textarea>
                </div>
            </div>`;
        } else {
            htmlCampos += `<div style="margin-bottom:8px; white-space:pre-wrap;"><strong>Resposta do Fiscal:</strong> ${vResposta || '—'}</div>`;
        }

        if (isCargoGerencia || isDono) {
            btnSalvar = `<button id="btn-salvar-detalhes" onclick="salvarDetalhesHist('${reg.id}')" style="flex:1; padding:12px; background:#10b981; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:15px; transition:0.2s;" onmouseover="this.style.background='#059669'" onmouseout="this.style.background='#10b981'">Salvar Alterações</button>`;
        }
    }

    // Botão de excluir apenas para o dono do registro
    let btnExcluir = '';
    if (isDono) {
        btnExcluir = `<button onclick="excluirRegistroHistGeral('${reg.id}', '${reg.categoria_id}')" style="flex:1; padding:12px; background:#ef4444; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:15px; transition:0.2s;" onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='#ef4444'">Excluir</button>`;
    }

    const modal = document.createElement('div');
    modal.id = 'modal-detalhes-admin-hist';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center; backdrop-filter:blur(2px);';

    modal.innerHTML = `
        <div style="background:white; border-radius:16px; width:90%; max-width:550px; padding:28px; position:relative; box-shadow:0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);">
            <button onclick="document.getElementById('modal-detalhes-admin-hist').remove()" style="position:absolute; top:16px; right:20px; background:none; border:none; font-size:22px; cursor:pointer; color:#94a3b8; transition:color 0.2s;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#94a3b8'">✕</button>
            <h3 style="margin-top:0; margin-bottom:20px; color:#0f172a; font-size:20px; border-bottom:2px solid #f1f5f9; padding-bottom:12px;">Detalhes do Documento</h3>
            <div style="max-height:65vh; overflow-y:auto; font-size:15px; color:#334155; padding-right:8px;">
                ${htmlCampos}
            </div>
            <div style="display:flex; gap:10px; margin-top:20px;">
                ${btnSalvar}
                ${btnExcluir}
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener('click', function (e) {
        if (e.target === modal) modal.remove();
    });
}

async function salvarDetalhesHist(id) {
    // Verificar conexão antes de salvar
    const conexaoOK = await verificarConexaoAntesDeSalvar();
    if (!conexaoOK) {
        return;
    }

    const reg = registrosGeralAtual.find(r => r.id === id);
    if (!reg) return;

    let novosCampos = { ...reg.campos };

    const inputEntrada = document.getElementById('admin-data-entrada');
    const inputVencimento = document.getElementById('admin-data-vencimento');
    const inputAR = document.getElementById('admin-ar');
    const inputAnexoAR = document.getElementById('admin-anexo-ar');
    const checkboxRemoverAR = document.getElementById('admin-remover-anexo-ar');
    const inputHistorico = document.getElementById('admin-historico-texto');
    const selectResposta = document.getElementById('admin-resposta-select');
    const inputResposta = document.getElementById('admin-resposta-fiscal');

    const btnSalvar = document.getElementById('btn-salvar-detalhes');
    if (btnSalvar) {
        btnSalvar.innerText = 'Salvando...';
        btnSalvar.disabled = true;
    }

    if (inputEntrada) novosCampos.data_entrada = inputEntrada.value;
    if (inputVencimento) novosCampos.data_vencimento = inputVencimento.value;
    if (inputAR) novosCampos.ar = inputAR.value;
    if (inputHistorico) novosCampos.historico_admin = inputHistorico.value;

    if (checkboxRemoverAR && checkboxRemoverAR.checked) {
        delete novosCampos.anexo_ar;
    }

    if (inputAnexoAR && inputAnexoAR.files.length > 0) {
        const arquivoAR = inputAnexoAR.files[0];
        let nomeAnexoLimpo = arquivoAR.name
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '_')
            .replace(/[^a-zA-Z0-9_\-\.]/g, '');

        const { data: { user } } = await getAuthUser();
        const nomeArquivo = `AR_${id}_${nomeAnexoLimpo}`;
        const caminho = `${user.id}/${nomeArquivo}`;

        const { error: uploadError } = await supabaseClient.storage
            .from('anexos')
            .upload(caminho, arquivoAR, { upsert: true });

        if (uploadError) {
            console.error('Erro no upload AR:', uploadError);
            alert('Erro ao anexar arquivo AR: ' + uploadError.message);
            if (btnSalvar) {
                btnSalvar.innerText = 'Salvar Alterações';
                btnSalvar.disabled = false;
            }
            return;
        } else {
            const { data: urlData } = supabaseClient.storage.from('anexos').getPublicUrl(caminho);
            novosCampos.anexo_ar = urlData.publicUrl;
        }
    }

    // Salvar 'Resposta' lendo o select ou o campo de texto
    if (selectResposta) {
        if (selectResposta.value === 'ATENDIDO' || selectResposta.value === '') {
            novosCampos.resposta_fiscal = selectResposta.value;
        } else if (selectResposta.value === 'Outro' && inputResposta) {
            novosCampos.resposta_fiscal = inputResposta.value;
        }
    }

    const isDestaque = ['1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '11'].includes(reg.categoria_id);
    const targetTable = isDestaque ? 'controle_processual' : 'registros_produtividade';

    try {
        // Tenta usar a RPC (Stored Procedure) para burlar o RLS
        const { error } = await supabaseClient
            .rpc('atualizar_campos_admin', {
                p_id: id,
                p_campos: novosCampos,
                p_tabela: targetTable
            });

        if (error) {
            console.warn("RPC falhou, tentando update direto:", error);
            const fallback = await supabaseClient
                .from(targetTable)
                .update({ campos: novosCampos })
                .eq('id', id)
                .select();

            if (fallback.error) throw fallback.error;
            if (!fallback.data || fallback.data.length === 0) {
                throw new Error("Permissão negada pelo banco de dados (RLS). O registro não foi atualizado.");
            }
        }

        reg.campos = novosCampos;
        document.getElementById('modal-detalhes-admin-hist').remove();

        // Atualizar tabela de histórico imediatamente
        renderizarTabelaGeral(registrosGeralAtual, reg.categoria_id);

        // Atualizar aba NP/AI na Home, se estiver sendo visualizada
        if (typeof carregarNPAIHome === 'function') {
            carregarNPAIHome();
        }

        alert('Alterações salvas com sucesso!');
    } catch (err) {
        console.error("Erro ao salvar detalhes:", err);
        alert(err.message || 'Erro ao salvar no banco de dados. Tente novamente.');
    }
}

// --- EXCLUIR REGISTRO DO HISTÓRICO GERAL ---
async function excluirRegistroHistGeral(id, categoriaId) {
    // Verificar conexão antes de excluir
    const conexaoOK = await verificarConexaoAntesDeSalvar();
    if (!conexaoOK) {
        return;
    }

    const confirma = confirm('Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.');
    if (!confirma) return;

    try {
        // Verificar se o usuário é o dono do registro
        const reg = registrosGeralAtual.find(r => r.id === id);
        if (!reg) {
            alert('Registro não encontrado.');
            return;
        }

        const { data: { user } } = await getAuthUser();
        if (reg.user_id !== user.id) {
            alert('Você só pode excluir registros criados por você.');
            return;
        }

        const isDestaque = ['1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '11'].includes(categoriaId);
        const targetTable = isDestaque ? 'controle_processual' : 'registros_produtividade';

        const { error } = await supabaseClient
            .from(targetTable)
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Erro ao excluir:', error);
            alert('Erro ao excluir: ' + error.message);
            return;
        }

        // Fechar modal
        const modal = document.getElementById('modal-detalhes-admin-hist');
        if (modal) modal.remove();

        // Atualizar tabela
        registrosGeralAtual = registrosGeralAtual.filter(r => r.id !== id);
        renderizarTabelaGeral(registrosGeralAtual, categoriaId);

        alert('Registro excluído com sucesso.');
    } catch (err) {
        console.error('Erro ao excluir registro:', err);
        alert('Erro ao excluir. Tente novamente.');
    }
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

    // Dinamicamente ajustar largura para não esmagar barras quando tem muitos dias
    const wrapper = document.getElementById('grafico-produtividade-wrapper');
    if (wrapper) {
        // Usa max(100%, px) para garantir que sempre ocupe a tela toda se houver poucos dias,
        // mas crie barra de rolagem se houver muitos dias
        wrapper.style.minWidth = `max(100 %, ${labels.length * 60}px)`;
    }

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
                    borderRadius: 6,
                    maxBarThickness: 60
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
            maintainAspectRatio: false,
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
    const { data: { user } } = await getAuthUser();
    if (!user) return;

    const { data: perfil } = await supabaseClient
        .from('profiles')
        .select('full_name, cpf')
        .eq('id', user.id)
        .maybeSingle();

    const nomeFiscal = perfil?.full_name || 'Fiscal';

    const dataAtual = new Date();
    let anoRelatorio = dataAtual.getFullYear();
    let mesIndex = dataAtual.getMonth();

    // Se for dia 1, 2 ou 3 do mês, o relatório é referente ao mês anterior
    if (dataAtual.getDate() <= 3) {
        mesIndex -= 1;
        if (mesIndex < 0) {
            mesIndex = 11;
            anoRelatorio -= 1;
        }
    }

    const nomesMeses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const mesRelatorio = nomesMeses[mesIndex];

    // Filtrar registros omitindo pontuação 0
    const registrosFiltrados = todosRegistros.filter(r => (r.pontuacao || 0) !== 0);

    // Agrupar registros por categoria
    const porCategoria = {};
    registrosFiltrados.forEach(r => {
        if (!porCategoria[r.categoria_id]) {
            porCategoria[r.categoria_id] = { nome: r.categoria_nome, registros: [] };
        }
        porCategoria[r.categoria_id].registros.push(r);
    });

    const pontuacaoTotal = registrosFiltrados.reduce((s, r) => s + r.pontuacao, 0);

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
                    <h1 contenteditable="true">RELATÓRIO DE PRODUTIVIDADE — ${mesRelatorio}/${anoRelatorio}</h1>
                    <div class="relatorio-info">
                        <div><strong>Fiscal:</strong> <span contenteditable="true">${nomeFiscal}</span></div>
                        <div><strong>Período:</strong> <span contenteditable="true">${mesRelatorio}/${anoRelatorio}</span></div>
                        <div><strong>Pontuação Total:</strong> <span contenteditable="true">${pontuacaoTotal}</span></div>
                        <div><strong>Total de Registros:</strong> ${registrosFiltrados.length}</div>
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
    document.title = `Produtividade ${mes} -${ano} - ${nome} `;

    // Disparar impressão
    window.print();

    setTimeout(() => {
        document.title = tituloOriginal;
        if (acoes) acoes.style.display = 'flex';
        fecharRelatorio();
    }, 500);
}

// --- NOVA LIMPEZA GERAL ---
function confirmarLimpeza() {
    Swal.fire({
        title: 'Limpeza Geral',
        text: 'Tem certeza? Isso zerará sua pontuação atual em todos os registros do Controle Processual vinculados a você. Eles não aparecerão mais no seu Histórico pessoal, mas continuarão visíveis no Histórico Geral. Esta ação não tem volta.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: 'Sim, zerar minha pontuação',
        cancelButtonText: 'Cancelar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({
                title: 'Limpando histórico...',
                text: 'Por favor, aguarde.',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });

            try {
                const { data: { user } } = await getAuthUser();
                if (!user) {
                    Swal.fire('Erro', 'Usuário não autenticado.', 'error');
                    return;
                }

                // 1. Zera a pontuação no Controle Processual
                const { error: errorCP } = await supabaseClient
                    .from('controle_processual')
                    .update({ pontuacao: 0 })
                    .eq('user_id', user.id);

                if (errorCP) throw errorCP;

                // 2. Remove registros da produtividade normal (se houver política de limpeza total)
                const { error: errorProd } = await supabaseClient
                    .from('registros_produtividade')
                    .delete()
                    .eq('user_id', user.id);

                if (errorProd) throw errorProd;

                Swal.fire('Concluído!', 'Sua pontuação foi zerada com sucesso.', 'success');
                carregarHistorico();
            } catch (err) {
                console.error('Erro ao limpar produtividade:', err);
                Swal.fire('Erro', 'Ocorreu um erro ao limpar o histórico.', 'error');
            }
        }
    });
}
window.confirmarLimpeza = confirmarLimpeza;

// Fechar dropdowns e modais ao clicar fora
document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown-custom')) {
        document.querySelectorAll('.dropdown-lista.aberto').forEach(el => el.classList.remove('aberto'));
    }
    if (e.target.id === 'modal-produtividade') fecharModalProdutividade();
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
    console.log("Inicializando produtividade...");
    renderizarCategorias();

    // Explicitamente lincar o botão de limpeza geral para evitar erros de escopo do HTML
    const btnLimpeza = document.getElementById('btn-limpeza-geral');
    if (btnLimpeza) {
        btnLimpeza.addEventListener('click', confirmarLimpeza);
    }

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
        dados.data = `${mData[3]} -${mData[2]} -${mData[1]} `;
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
        dados.data = `${mData[3]} -${mData[2]} -${mData[1]} `;
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
        const nomeAlerta = categoriaAtual.id === '11' ? 'Dívida Ativa' : 'Auto de Infração';
        alert(`Preencha os dados obrigatórios do ${nomeAlerta} antes de gerar o documento.`);
        return;
    }

    const btnSalvarForm = document.querySelector('#modal-produtividade .btn-salvar');
    const oldTexto = btnSalvarForm ? btnSalvarForm.textContent : 'Gerar Documento';
    if (btnSalvarForm) {
        btnSalvarForm.textContent = 'Carregando...';
        btnSalvarForm.disabled = true;
    }

    try {
        // Puxa do Banco de Dados offline o provável sequencial desse documento e injeta
        const numSequencial = await gerarNumeroSequencial(categoriaAtual.id);
        const tituloDoc = categoriaAtual.id === '11' ? 'DÍVIDA ATIVA Nº' : 'AUTO DE INFRAÇÃO Nº';

        // 2. Prepara HTML do Documento
        const dataPartes = campos.data ? campos.data.split('-') : ['', '', ''];
        const dataFormatada = campos.data ? `${dataPartes[2]}/${dataPartes[1]}/${dataPartes[0]}` : '';
        const descInscricao = campos.inscricao_zona ? `Zona: ${campos.inscricao_zona}, Quadra: ${campos.inscricao_quadra}, Lote: ${campos.inscricao_lote}, com área de ${campos.inscricao_area} m²` : '---';
        const numNotificacao = campos.n_notificacao ? campos.n_notificacao : '_____';
        const prazoDefesa = campos.prazo_defesa ? campos.prazo_defesa : '_____';

        // Pegar informações do Fiscal (Nome logado) e Data de Hoje para Assinatura
        const { data: { user } } = await getAuthUser();
        let nomeFiscal = 'Nome do Fiscal';
        if (user) {
            const { data: perfil } = await supabaseClient
                .from('profiles')
                .select('full_name')
                .eq('id', user.id)
                .maybeSingle();
            if (perfil && perfil.full_name) nomeFiscal = perfil.full_name;
        }

        const hoje = new Date();
        const diaHoje = String(hoje.getDate()).padStart(2, '0');
        const mesHoje = String(hoje.getMonth() + 1).padStart(2, '0');
        const anoHoje = hoje.getFullYear();
        const dataAssinatura = `${diaHoje}/${mesHoje}/${anoHoje}`;


        const termoDocumento = categoriaAtual.id === '11' ? 'documento de Dívida Ativa' : 'Auto de infração';

        const htmlTemplate = `
            <div style="border: 1px solid #999; padding: 2px; display: flex; align-items: center; justify-content: center; margin-bottom: 25px;">
            <img src="Cabeçalho.png" alt="Prefeitura Municipal de Divinópolis" style="max-height: 10px; width: auto; max-width: 100%;">
        </div>
        
        <div style="text-align: center; margin-bottom: 25px;">
            <p style="font-weight: bold; font-size: 14pt; margin: 10px 0;">FISCALIZAÇÃO DE POSTURAS AMBIENTAL</p>
            <p style="font-weight: bold; font-size: 16pt; margin: 15px 0;">${tituloDoc}: ${numSequencial}</p>
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
            Recebi a 2ª via do presente ${termoDocumento} do qual fico ciente.
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
        const { data: { user } } = await getAuthUser();
        let nomeFiscal = 'Nome do Fiscal';
        let matriculaFiscal = 'XXXXXXXX';
        if (user) {
            const { data: perfil } = await supabaseClient
                .from('profiles')
                .select('full_name, matricula')
                .eq('id', user.id)
                .maybeSingle();
            if (perfil && perfil.full_name) nomeFiscal = perfil.full_name;
            if (perfil && perfil.matricula) matriculaFiscal = perfil.matricula;
        }

        const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
        const hoje = new Date();
        const diaHoje = hoje.getDate();
        const mesHoje = meses[hoje.getMonth()];
        const anoHoje = hoje.getFullYear();
        const dataPorExtenso = `Divinópolis, ${diaHoje} de ${mesHoje} de ${anoHoje}.`;


        // 2. Prepara HTML do Documento
        const htmlTemplate = `
        <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 25px; width: 100%;">
            <img src="Cabeçalho.png" alt="Prefeitura Municipal de Divinópolis" style="width: 100%; max-width: 100%; height: auto;">
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
        const { data: { user } } = await getAuthUser();
        let nomeFiscal = 'Nome do Fiscal';
        let matriculaFiscal = 'XXXXXXXX';
        if (user) {
            const { data: perfil } = await supabaseClient
                .from('profiles')
                .select('full_name, matricula')
                .eq('id', user.id)
                .maybeSingle();
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

        const htmlTemplate = `
        <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 25px; width: 100%;">
            <img src="Cabeçalho.png" alt="Prefeitura Municipal de Divinópolis" style="width: 100%; max-width: 100%; height: auto;">
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
        const { data: { user } } = await getAuthUser();
        let nomeFiscal = 'Nome do Fiscal';
        let matriculaFiscal = 'XXXXXXXX';

        if (user) {
            const { data: perfil } = await supabaseClient
                .from('profiles')
                .select('full_name, matricula')
                .eq('id', user.id)
                .maybeSingle();
            if (perfil && perfil.full_name) nomeFiscal = perfil.full_name;
            if (perfil && perfil.matricula) matriculaFiscal = perfil.matricula;
        }

        const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
        const hoje = new Date();
        const diaHoje = hoje.getDate();
        const mesHoje = meses[hoje.getMonth()];
        const anoHoje = hoje.getFullYear();
        const dataPorExtenso = `Divinópolis, ${diaHoje} de ${mesHoje} de ${anoHoje}.`;

        const htmlTemplate = `
        <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 25px; width: 100%;">
            <img src="Cabeçalho.png" alt="Prefeitura Municipal de Divinópolis" style="width: 100%; max-width: 100%; height: auto;">
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
        fecharModalProdutividade(); // fecha o formulário pai imediatamente
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


// =============================================
// NP / AI — VENCIDOS E ATENDIDOS (HOME DO FISCAL)
// =============================================
let npaiVencidos = [];
let npaiAtendidos = [];
let npaiAbaAtual = 'vencidos';

async function carregarNPAIHome() {
    const { data: { user } } = await getAuthUser();
    if (!user) return;

    const { data: registros, error } = await supabaseClient
        .from('controle_processual')
        .select('*')
        .in('categoria_id', ['1.1', '1.2'])
        .eq('user_id', user.id);

    if (error || !registros) {
        console.error('Erro ao carregar NP/AI:', error);
        return;
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    npaiVencidos = [];
    npaiAtendidos = [];

    registros.forEach(reg => {
        const campos = reg.campos || {};
        const resposta = (campos.resposta_fiscal || '').trim();
        const dataVenc = campos.data_vencimento;

        if (resposta) {
            // Tem resposta = atendido
            // Só exibe se não tiver passado mais de 30 dias do vencimento (ou da criação, se sem vencimento)
            let dataBase = dataVenc ? new Date(dataVenc + 'T00:00:00') : new Date(reg.created_at);
            const limite30Dias = new Date(dataBase);
            limite30Dias.setDate(limite30Dias.getDate() + 30);

            if (hoje <= limite30Dias) {
                npaiAtendidos.push(reg);
            }
        } else if (dataVenc) {
            // Sem resposta + tem data de vencimento
            const dv = new Date(dataVenc + 'T00:00:00');
            if (dv <= hoje) {
                // Já venceu
                npaiVencidos.push(reg);
            }
        }
    });

    // Atualizar contadores
    const countV = document.getElementById('npai-count-vencidos');
    const countA = document.getElementById('npai-count-atendidos');
    if (countV) countV.textContent = npaiVencidos.length;
    if (countA) countA.textContent = npaiAtendidos.length;

    renderizarListaNPAI();
}

function trocarAbaNPAI(aba) {
    npaiAbaAtual = aba;
    const btnV = document.getElementById('btn-npai-vencidos');
    const btnA = document.getElementById('btn-npai-atendidos');
    if (btnV) btnV.classList.toggle('active', aba === 'vencidos');
    if (btnA) btnA.classList.toggle('active', aba === 'atendidos');
    renderizarListaNPAI();
}

function renderizarListaNPAI() {
    const container = document.getElementById('npai-lista');
    if (!container) return;

    const lista = npaiAbaAtual === 'vencidos' ? npaiVencidos : npaiAtendidos;

    if (lista.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:#94a3b8; padding:30px; font-size:15px;">
            ${npaiAbaAtual === 'vencidos' ? 'Nenhum documento vencido! 🎉' : 'Nenhum documento atendido ainda.'}
        </div>`;
        return;
    }

    let html = '';
    lista.forEach(reg => {
        const campos = reg.campos || {};
        const catNome = reg.categoria_nome || (reg.categoria_id === '1.1' ? 'Notificação Preliminar' : 'Auto de Infração');
        const nome = campos.nome || campos.n_notificacao || '—';
        const bairro = campos.bairro || '—';
        const dataVenc = campos.data_vencimento
            ? campos.data_vencimento.split('-').reverse().join('/')
            : '—';
        const resposta = (campos.resposta_fiscal || '').trim();

        const corBorda = npaiAbaAtual === 'vencidos' ? '#ef4444' : '#10b981';

        const svgNP = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#64748b;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
        const svgAI = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#64748b;"><line x1="12" y1="2" x2="12" y2="22"></line><line x1="4" y1="10" x2="20" y2="10"></line><line x1="2" y1="14" x2="22" y2="14"></line><line x1="2" y1="18" x2="22" y2="18"></line></svg>`;
        const iconeCat = reg.categoria_id === '1.1' ? svgNP : svgAI;

        html += `<div style="display:flex; align-items:flex-start; gap:12px; padding:14px; margin-bottom:10px; background:#f8fafc; border-left:4px solid ${corBorda}; border-radius:8px; cursor:pointer; transition:0.2s;"
            onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='#f8fafc'"
            onclick="registrosGeralAtual = [...npaiVencidos, ...npaiAtendidos]; abrirDetalhesAdminHist('${reg.id}')">
            <div style="font-size:24px; line-height:1;">${iconeCat}</div>
            <div style="flex:1; min-width:0;">
                <div style="font-weight:600; color:#1e293b; font-size:14px; margin-bottom:4px;">
                    ${catNome} ${reg.numero_sequencial ? '— Nº ' + reg.numero_sequencial : ''}
                </div>
                <div style="color:#64748b; font-size:13px; margin-bottom:2px;">
                    <strong>Contribuinte:</strong> ${nome} &nbsp;|&nbsp; <strong>Bairro:</strong> ${bairro}
                </div>
                <div style="color:#64748b; font-size:13px;">
                    <strong>Vencimento:</strong> ${dataVenc}
                    ${resposta ? '&nbsp;|&nbsp; <strong>Resposta:</strong> <span style="color:#10b981;">' + resposta + '</span>' : ''}
                </div>
            </div>
        </div>`;
    });

    container.innerHTML = html;
}

// Executa quando a página carregar
document.addEventListener('DOMContentLoaded', inicializarProdutividade);
