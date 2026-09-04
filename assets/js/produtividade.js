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
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s para o ping

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

// Converte imagem para Base64 para garantir visualização em downloads do Word
async function obterBase64Cabecalho() {
    if (typeof CABECALHO_BASE64 !== 'undefined') {
        return CABECALHO_BASE64;
    }
    // Fallback caso o arquivo cabecalho_img.js fale por algum motivo
    return 'assets/img/Cabeçalho.png';
}

// --- DEFINIÇÃO DAS CATEGORIAS ---
// Cada categoria espelha uma aba da planilha original
// Começando com 1 categoria de teste (2°)
const CATEGORIAS = [
    // === CONTROLE PROCESSUAL (16.1° a 16.7°) — Destaque ===
    {
        id: '1.1',
        nome: 'Controle Processual: Notificação Preliminar',
        pontos: 5,
        destaque: true,
        campos: [
            { nome: 'n_notificacao', label: 'N° da Notificação', tipo: 'text', obrigatorio: true },
            { nome: 'nome', label: 'Nome do Contribuinte', tipo: 'text', obrigatorio: true },
            { nome: 'n_inscricao', label: 'N° de Inscrição/CNPJ', tipo: 'text', obrigatorio: true },
            { nome: 'bairro', label: 'Bairro', tipo: 'select_bairro', obrigatorio: true },
            { nome: 'motivo', label: 'Motivo', tipo: 'select_custom', obrigatorio: true, opcoes: ['Limpeza', 'Construção de Muro', 'Construção de Passeio', 'Reconstrução de Muro ou Passeio'] },
            { nome: 'anexo_pdf', label: 'Anexo (PDF/Docx)', tipo: 'file', obrigatorio: true, aceitar: '.pdf,.doc,.docx' }
        ]
    },
    {
        id: '1.2',
        nome: 'Controle Processual: Auto de Infração',
        pontos: 5,
        destaque: true,
        campos: [
            { nome: 'nome', label: 'Contribuinte', tipo: 'text', obrigatorio: true },
            { nome: 'cpf_contribuinte', label: 'CPF/CNPJ do Contribuinte', tipo: 'text', obrigatorio: true, ignorarNoBanco: true },
            { nome: 'endereco_infrator', label: 'Endereço do Infrator', tipo: 'text', obrigatorio: true, ignorarNoBanco: true },
            { nome: 'endereco_imovel', label: 'Endereço do Imóvel Autuado', tipo: 'text', obrigatorio: true, ignorarNoBanco: true },
            { nome: 'bairro', label: 'Bairro do Imóvel Autuado', tipo: 'select_bairro', obrigatorio: true },
            { nome: 'inscricao_zona', label: 'Zona', tipo: 'text', obrigatorio: true, agrupar: 'inscricao', ignorarNoBanco: true },
            { nome: 'inscricao_quadra', label: 'Quadra', tipo: 'text', obrigatorio: true, agrupar: 'inscricao', ignorarNoBanco: true },
            { nome: 'inscricao_lote', label: 'Lote', tipo: 'text', obrigatorio: true, agrupar: 'inscricao', ignorarNoBanco: true },
            { nome: 'inscricao_area', label: 'Área', tipo: 'text', obrigatorio: true, agrupar: 'inscricao', ignorarNoBanco: true },
            { nome: 'motivo', label: 'Motivo', tipo: 'select_custom', obrigatorio: true, opcoes: ['Limpeza', 'Construção de Muro', 'Construção de Passeio'] },
            { nome: 'data', label: 'Data da Fiscalização', tipo: 'date', obrigatorio: true },
            { nome: 'n_notificacao', label: 'Nº da notificação', tipo: 'text', obrigatorio: false, ignorarNoBanco: true },
            { nome: 'prazo_defesa', label: 'Prazo p/ Defesa (Dias)', tipo: 'number', obrigatorio: true, ignorarNoBanco: true },
            { nome: 'fundamentacao_legal', label: 'Fundamentação Legal (Lei/Decreto Descumprido)', tipo: 'text', obrigatorio: true, ignorarNoBanco: true },
            { nome: 'sob_pena', label: 'Sob pena do Artigo', tipo: 'text', obrigatorio: true, ignorarNoBanco: true },
            { nome: 'valor_multa', label: 'Valor da Multa (R$)', tipo: 'text', obrigatorio: true, ignorarNoBanco: true }
        ]
    },
    {
        id: '1.2.MA',
        nome: 'Controle Processual: Auto de Infração Ambiental',
        pontos: 5,
        destaque: true,
        campos: [
            { nome: 'tipo_documento_referencia', label: 'Tipo de Documento de Referência', tipo: 'select', obrigatorio: false, opcoes: ['Auto de Fiscalização', 'REDS/Boletim de Ocorrência', 'Denúncia'] },
            { nome: 'numero_documento_referencia', label: 'Nº do Documento de Referência', tipo: 'text', obrigatorio: false, condicional: { campo: 'tipo_documento_referencia', valor_diferente: '' } },
            { nome: 'processo_administrativo', label: 'Processo Administrativo n°', tipo: 'text', obrigatorio: true },
            { nome: 'nome', label: 'Nome do(a) autuado(a)', tipo: 'text', obrigatorio: true },
            { nome: 'cpf_contribuinte', label: 'CNPJ/CPF', tipo: 'text', obrigatorio: true },
            { nome: 'rua_autuado', label: 'Rua do autuado', tipo: 'text', obrigatorio: true },
            { nome: 'numero_autuado', label: 'Número', tipo: 'text', obrigatorio: false },
            { nome: 'bairro_autuado', label: 'Bairro do autuado', tipo: 'text', obrigatorio: true },
            { nome: 'municipio_autuado', label: 'Município', tipo: 'text', obrigatorio: true },
            { nome: 'cep_autuado', label: 'CEP', tipo: 'text', obrigatorio: true },
            { nome: 'rua_imovel', label: 'Rua do imóvel / local da autuação', tipo: 'text', obrigatorio: true },
            { nome: 'numero_imovel', label: 'Número', tipo: 'text', obrigatorio: false },
            { nome: 'bairro', label: 'Bairro do Imóvel', tipo: 'select_bairro', obrigatorio: true },
            { nome: 'cep_imovel', label: 'CEP do imóvel', tipo: 'text', obrigatorio: true },
            { nome: 'inscricao', label: 'Inscrição', tipo: 'text', obrigatorio: false },
            { nome: 'data', label: 'Data da infração', tipo: 'date', obrigatorio: false },
            { nome: 'hora_infracao', label: 'Hora da infração', tipo: 'text', obrigatorio: false },
            { nome: 'reincidente', label: 'Reincidente?', tipo: 'select', obrigatorio: false, opcoes: ['Sim', 'Não'] },
            { nome: 'irregularidades', label: 'Descrição/Fato Constitutivo da infração', tipo: 'textarea', obrigatorio: true },
            { nome: 'dispositivos', label: 'Dispositivo(s) legal(is) transgredido(s)', tipo: 'textarea', obrigatorio: true },
            { nome: 'penalidades', label: 'Penalidade(s)', tipo: 'textarea', obrigatorio: true },
            { nome: 'prazo_defesa', label: 'Prazo para defesa (dias)', tipo: 'number', obrigatorio: true },
            { nome: 'tem_testemunhas', label: 'Tem testemunhas?', tipo: 'select', obrigatorio: true, opcoes: ['Não', 'Sim'] },
            { nome: 'nome_testemunha_1', label: 'Nome da testemunha 1', tipo: 'text', obrigatorio: false, condicional: { campo: 'tem_testemunhas', valor: 'Sim' } },
            { nome: 'cpf_testemunha_1', label: 'CPF da testemunha 1', tipo: 'text', obrigatorio: false, condicional: { campo: 'tem_testemunhas', valor: 'Sim' } },
            { nome: 'nome_testemunha_2', label: 'Nome da testemunha 2', tipo: 'text', obrigatorio: false, condicional: { campo: 'tem_testemunhas', valor: 'Sim' } },
            { nome: 'cpf_testemunha_2', label: 'CPF da testemunha 2', tipo: 'text', obrigatorio: false, condicional: { campo: 'tem_testemunhas', valor: 'Sim' } }
        ]
    },
    {
        id: '1.3',
        nome: 'Controle Processual: Aviso de Recebimento (AR)',
        pontos: 10,
        destaque: true,
        campos: [
            { nome: 'n_ar', label: 'N° do AR', tipo: 'text', obrigatorio: true },
            { nome: 'nome', label: 'Nome', tipo: 'text', obrigatorio: true },
            { nome: 'data_chegada', label: 'Data de Chegada', tipo: 'date', obrigatorio: true },
            { nome: 'bairro', label: 'Bairro Notificada', tipo: 'select_bairro', obrigatorio: true }
        ]
    },
    {
        id: '1.4',
        nome: 'Controle Processual: Ofício',
        pontos: 10,
        destaque: true,
        campos: [
            { nome: 'nome', label: 'Nome', tipo: 'text', obrigatorio: true },
            { nome: 'cpf_contribuinte', label: 'CPF / CNPJ', tipo: 'text', obrigatorio: false },
            { nome: 'assunto', label: 'Assunto', tipo: 'text', obrigatorio: true }
        ]
    },
    {
        id: '1.5',
        nome: 'Controle Processual: Relatório',
        pontos: 10,
        destaque: true,
        campos: [
            { nome: 'atendimento', label: 'Para o atendimento...', tipo: 'textarea', obrigatorio: true }
        ]
    },
    {
        id: '1.5.MA',
        nome: 'Controle Processual: Relatório / Meio Ambiente',
        pontos: 10,
        destaque: true,
        campos: [
            { nome: 'rua_imovel', label: 'Rua do imóvel', tipo: 'text', obrigatorio: true },
            { nome: 'numero_imovel', label: 'Número', tipo: 'text', obrigatorio: true },
            { nome: 'bairro', label: 'Bairro do Imóvel', tipo: 'select_bairro', obrigatorio: true },
            { nome: 'cep_imovel', label: 'CEP', tipo: 'text', obrigatorio: true },
            { nome: 'inscricao', label: 'Inscrição', tipo: 'text', obrigatorio: false },
            { nome: 'origem_tipo', label: 'Origem', tipo: 'select', opcoes: ['Protocolo', 'Denúncia', 'Comunicação Interna'], obrigatorio: false },
            { nome: 'origem_numero', label: 'Número da Origem', tipo: 'text', obrigatorio: false, condicional: { campo: 'origem_tipo', valor_diferente: '' } },
            { nome: 'assunto', label: 'Assunto', tipo: 'text', obrigatorio: true },
            { nome: 'data_vistoria', label: 'Data da Vistoria', tipo: 'date', obrigatorio: true },
            { nome: 'hora_vistoria', label: 'Hora da Vistoria', tipo: 'time', obrigatorio: true },
            { nome: 'verificacao', label: 'Em vistoria, verificamos', tipo: 'textarea', obrigatorio: true },
            { nome: 'imagens_legenda', label: 'Imagens e Legendas', tipo: 'imagens_com_legenda', obrigatorio: false }
        ]
    },
    {
        id: '1.6',
        nome: 'Controle Processual: Protocolo',
        pontos: 8,
        destaque: true,
        campos: [
            { nome: 'n_protocolo', label: 'N° do Protocolo', tipo: 'text', obrigatorio: true },
            { nome: 'nome', label: 'Nome', tipo: 'text', obrigatorio: true },
            { nome: 'data', label: 'Data de Finalização', tipo: 'date', obrigatorio: true },
            { nome: 'bairro', label: 'Bairro', tipo: 'select_bairro', obrigatorio: true },
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
            { nome: 'bairro', label: 'Bairro', tipo: 'select_bairro', obrigatorio: true }
        ]
    },
    {
        id: '1.8',
        nome: 'Certidão',
        pontos: 50,
        destaque: true,
        campos: [
            { nome: 'nome', label: 'Nome do Autuado', tipo: 'text', obrigatorio: true },
            { nome: 'cpf', label: 'CPF', tipo: 'text', obrigatorio: true, ignorarNoBanco: true },
            { nome: 'endereco_autuado', label: 'Endereço do Autuado', tipo: 'text', obrigatorio: true, ignorarNoBanco: true },
            { nome: 'digitado', label: 'Referente ao', tipo: 'textarea', obrigatorio: true, ignorarNoBanco: true },
            { nome: 'data_ciencia', label: 'Data da Ciência', tipo: 'date', obrigatorio: true, ignorarNoBanco: true },
            { nome: 'data_defesa', label: 'Prazo para Defesa até', tipo: 'date', obrigatorio: true, ignorarNoBanco: true },
            { nome: 'data_vistoria', label: 'Vistoria realizada dia', tipo: 'date', obrigatorio: true, ignorarNoBanco: true },
            { nome: 'obrigacao', label: 'Obrigação não cumprida', tipo: 'text', obrigatorio: true, ignorarNoBanco: true }
        ]
    },
    {
        id: '1.9',
        nome: 'Controle Processual: Auto de Fiscalização/Meio Ambiente',
        pontos: 5,
        destaque: true,
        campos: [
            { nome: 'nome', label: 'Nome do(a) autuado(a)', tipo: 'text', obrigatorio: true },
            { nome: 'cpf_contribuinte', label: 'CNPJ/CPF', tipo: 'text', obrigatorio: true },
            { nome: 'rua_autuado', label: 'Rua do autuado', tipo: 'text', obrigatorio: true },
            { nome: 'numero_autuado', label: 'Número', tipo: 'text', obrigatorio: true },
            { nome: 'bairro_autuado', label: 'Bairro', tipo: 'text', obrigatorio: true },
            { nome: 'municipio_autuado', label: 'Município', tipo: 'text', obrigatorio: true },
            { nome: 'cep_autuado', label: 'CEP', tipo: 'text', obrigatorio: true },
            { nome: 'rua_imovel', label: 'Rua do imóvel', tipo: 'text', obrigatorio: true },
            { nome: 'numero_imovel', label: 'Número', tipo: 'text', obrigatorio: true },
            { nome: 'bairro', label: 'Bairro do Imóvel', tipo: 'select_bairro', obrigatorio: true },
            { nome: 'cep_imovel', label: 'CEP', tipo: 'text', obrigatorio: true },
            { nome: 'inscricao', label: 'Inscrição', tipo: 'text', obrigatorio: false },
            { nome: 'processo_administrativo', label: 'Processo Administrativo n°', tipo: 'text', obrigatorio: true },
            { nome: 'irregularidades', label: 'Irregularidades Constatadas', tipo: 'textarea', obrigatorio: true },
            { nome: 'providencias', label: 'Providências', tipo: 'textarea', obrigatorio: false },
            { nome: 'dispositivos', label: 'Dispositivo(s) legal(is) transgredido(s)', tipo: 'textarea', obrigatorio: true },
            { nome: 'penalidades', label: 'Penalidades previstas no', tipo: 'text', obrigatorio: true },
            { nome: 'prazo_defesa', label: 'Prazo para defesa (dias)', tipo: 'number', obrigatorio: true },
            { nome: 'tem_testemunhas', label: 'Tem testemunhas?', tipo: 'select', obrigatorio: true, opcoes: ['Não', 'Sim'] },
            { nome: 'nome_testemunha_1', label: 'Nome da testemunha 1', tipo: 'text', obrigatorio: false, condicional: { campo: 'tem_testemunhas', valor: 'Sim' } },
            { nome: 'cpf_testemunha_1', label: 'CPF da testemunha 1', tipo: 'text', obrigatorio: false, condicional: { campo: 'tem_testemunhas', valor: 'Sim' } },
            { nome: 'nome_testemunha_2', label: 'Nome da testemunha 2', tipo: 'text', obrigatorio: false, condicional: { campo: 'tem_testemunhas', valor: 'Sim' } },
            { nome: 'cpf_testemunha_2', label: 'CPF da testemunha 2', tipo: 'text', obrigatorio: false, condicional: { campo: 'tem_testemunhas', valor: 'Sim' } }
        ]
    },
    // === CATEGORIAS GERAIS (1° a 29°) ===
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
        nome: 'Elaboração de Certidão de Arquivamento e Relatório Fiscal',
        pontos: 50,
        campos: [
            { nome: 'tipo', label: 'Tipo', tipo: 'select', obrigatorio: true, opcoes: ['Certidão de Arquivamento', 'Relatório Fiscal'] },
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
        nome: 'Por Processos (via protocolo municipal) vistoriados e informados de Prévias para Alvarás de Localização, por unidade.',
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

            { nome: 'nome', label: 'Nome do Autuado', tipo: 'text', obrigatorio: true },

            { nome: 'cpf', label: 'CPF do Autuado', tipo: 'text', obrigatorio: false },

            { nome: 'advogado', label: 'Advogado', tipo: 'text', obrigatorio: false },

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

function obterIdVisual(categoriaId) {
    const mapa = {
        '1.1': '16.1',
        '1.2': '16.2',
        '1.2.MA': '16.2',
        '1.3': '16.3',
        '1.4': '16.4',
        '1.5': '16.5',
        '1.5.MA': '16.5',
        '1.6': '16.6',
        '1.7': '6.1',
        '1.8': '6.2',
        '1.9': '16.7',
        '2': '1',
        '3': '2',
        '4': '3',
        '5': '4',
        '6': '5',
        '7': '6',
        '8': '7',
        '9': '8',
        '10': '9',
        '11': '10',
        '12': '11',
        '13': '12',
        '14': '13',
        '15': '14',
        '16': '15'
    };
    return mapa[categoriaId] || categoriaId;
}

// --- VARIÁVEIS GLOBAIS ---
let bairrosSistema = [];
async function carregarBairrosSistema() {
    try {
        const { data, error } = await supabaseClient
            .from('bairros')
            .select('nome')
            .order('nome');

        if (!error && data) {
            bairrosSistema = data.map(b => b.nome);
        }
    } catch (e) {
        console.error("Erro ao carregar bairros:", e);
    }
}

let categoriaAtual = null;
let rascunhoDocumento = null; // { id, numero_sequencial, categoria_id, campos }

// --- HELPERS DE CARGO ---
function getUserRole() {
    return (window.userRoleGlobal || '').toLowerCase().trim();
}

function isFiscalDeMeioAmbiente() {
    const role = getUserRole();
    return role.includes('fiscal') && role.includes('meio') && role.includes('ambiente');
}

function isFiscalDePosturas() {
    const role = getUserRole();
    return role === 'fiscal' || (role.includes('fiscal') && role.includes('postura'));
}

function isCargoGerencialOuSuperior() {
    const role = getUserRole();
    return role.includes('gerente') || role.includes('diretor') || role.includes('secretário') || role.includes('secretario') || role.includes('administrador') || role.includes('administrativo');
}

function obterTituloFiscal() {
    const role = getUserRole();
    if (role.includes('meio') && role.includes('ambiente')) {
        return 'Fiscal de Meio Ambiente';
    }
    return 'Fiscal de Posturas';
}

// --- RENDERIZAR BOTÕES DE CATEGORIAS ---
function renderizarCategorias() {
    const grid = document.getElementById('categorias-grid');
    if (!grid) return;

    grid.innerHTML = '';

    const role = getUserRole();
    const fiscalMA = isFiscalDeMeioAmbiente();
    const fiscalPosturas = isFiscalDePosturas();
    const gerencial = isCargoGerencialOuSuperior();

    const destaques = CATEGORIAS.filter(c => {
        if (!c.destaque) return false;
        // Regras de visibilidade por cargo
        if (c.id === '1.2.MA' || c.id === '1.5.MA') {
            // Só aparece para Fiscal de Meio Ambiente ou cargos gerenciais+
            return fiscalMA || gerencial;
        }
        if (c.id === '1.2' || c.id === '1.5') {
            // Não aparece para Fiscal de Meio Ambiente
            if (fiscalMA) return false;
            return true;
        }
        if (c.id === '1.9') {
            // Apenas Fiscal de Meio Ambiente ou cargos gerenciais+
            return fiscalMA || gerencial;
        }
        return true;
    }).sort((a, b) => {
        const idA = obterIdVisual(a.id);
        const idB = obterIdVisual(b.id);

        // Ordem dos grupos no Controle Processual: 16.x primeiro, depois 6.x, depois 10
        const grupoA = parseInt(idA, 10);
        const grupoB = parseInt(idB, 10);
        const ordemGrupos = [16, 6, 10];
        const idxGrupoA = ordemGrupos.indexOf(grupoA);
        const idxGrupoB = ordemGrupos.indexOf(grupoB);

        if (idxGrupoA !== idxGrupoB) {
            return idxGrupoA - idxGrupoB;
        }

        // Dentro do mesmo grupo, ordena numericamente
        return parseFloat(idA) - parseFloat(idB);
    });
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

function obterNomeExibicaoCategoria(cat) {
    if (cat.id === '1.2.MA') {
        return 'Controle Processual: Auto de Infração';
    }
    return cat.nome;
}

function criarCard(cat) {
    const card = document.createElement('div');
    card.className = cat.destaque ? 'categoria-card categoria-destaque' : 'categoria-card';
    card.onclick = () => abrirFormulario(cat);
    card.innerHTML = `
        ${cat.icone ? `<div class="card-icon">${cat.icone}</div>` : ''}
        <div class="card-title">${obterIdVisual(cat.id)}° - ${obterNomeExibicaoCategoria(cat)}</div>
        <div class="card-pontos">${cat.pontos} pts ${cat.por_hora ? 'por hora' : 'por unidade'}</div>
    `;
    return card;
}

// --- ABRIR MODAL COM FORMULÁRIO ---
function abrirFormulario(categoria) {
    categoriaAtual = categoria;
    modoEdicao = false;
    idEditando = null;
    const overlay = document.getElementById('modal-produtividade');
    const titulo = document.getElementById('modal-titulo');
    const corpo = document.getElementById('modal-campos');

    titulo.textContent = obterNomeExibicaoCategoria(categoria);
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

    // Campo especial para categoria 1.1 nos primeiros 7 dias do mês
    if ((categoria.id === '1.1' || categoria.id === '1.9') && estaNosPrimeiros7Dias()) {
        adicionarCampoDataRegistrada(corpo, null, false);
    }

    // Configuração exclusiva Fiscais de Meio Ambiente para 1.4 Ofício e 1.5.MA Relatório
    const roleLower = (window.userRoleGlobal || '').toLowerCase();
    if ((categoria.id === '1.4' || categoria.id === '1.5.MA') && roleLower.includes('fiscal') && roleLower.includes('meio ambiente')) {
        const divExtra = document.createElement('div');
        divExtra.className = 'campo-grupo';
        divExtra.style.background = 'rgba(59, 130, 246, 0.1)';
        divExtra.style.padding = '15px';
        divExtra.style.borderRadius = '10px';
        divExtra.style.border = '1px dashed #3b82f6';
        divExtra.style.marginBottom = '20px';

        divExtra.innerHTML = `
            <label style="color: #1d4ed8; font-weight: 600; display: flex; align-items: center; gap: 8px; margin-bottom:10px;">
                Fiscais de Meio Ambiente Adicionais (Assinatura e Pontuação)
            </label>
            <div id="loading-fiscais-ma" style="font-size:12px; color:#64748b;">Carregando fiscais...</div>
            <div id="container-fiscais-ma" style="display:none; flex-direction:column; gap:8px;"></div>
        `;
        corpo.appendChild(divExtra);

        supabaseClient.from('profiles').select('id, full_name, cpf, matricula')
            .ilike('role', '%fiscal%meio ambiente%')
            .eq('ativo', true)
            .then(res => {
                const fiscais = (res.data || []).filter(f => f.id !== window.userIdGlobal);
                document.getElementById('loading-fiscais-ma').style.display = 'none';
                const cont = document.getElementById('container-fiscais-ma');
                cont.style.display = 'grid';
                cont.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
                cont.style.gap = '10px';

                if (fiscais.length === 0) {
                    cont.innerHTML = '<span style="font-size:12px;">Nenhum outro fiscal encontrado.</span>';
                    return;
                }

                // Helper para evitar quebra de aspas duplas no HTML
                const escapeAttr = (str) => (str || '').replace(/"/g, '&quot;');

                fiscais.forEach(f => {
                    if (f.full_name) f.full_name = f.full_name.replace(/Julio Cesar/gi, 'Júlio César');
                    const chkId = `chk-fiscal-${f.id}`;
                    cont.innerHTML += `
                        <label for="${chkId}" style="display:flex; align-items:center; gap:10px; padding:10px 12px; background:white; border:1px solid #cbd5e1; border-radius:8px; cursor:pointer; transition:all 0.2s; user-select:none; box-shadow:0 1px 2px rgba(0,0,0,0.05);" onmouseover="this.style.borderColor='#3b82f6'" onmouseout="this.style.borderColor='#cbd5e1'">
                            <input type="checkbox" id="${chkId}" class="cb-fiscal-extra-ma" value="${f.id}" data-nome="${escapeAttr(f.full_name)}" data-cpf="${escapeAttr(f.cpf)}" data-matricula="${escapeAttr(f.matricula)}" style="width:18px; height:18px; cursor:pointer; accent-color:#3b82f6; flex-shrink:0;">
                            <div style="display:flex; flex-direction:column; overflow:hidden;">
                                <span style="font-weight:600; color:#1e293b; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeAttr(f.full_name)}</span>
                                <span style="font-size:11px; color:#64748b;">CPF: ${escapeAttr(f.cpf) || '---'}</span>
                            </div>
                        </label>
                    `;
                });
            });
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
        } else if (campo.tipo === 'select_bairro') {
            let opcoesListHTML = `<div class="dropdown-search" style="padding: 7px; border-bottom: 1px solid #eee; background-color: #f8fafc;"><input type="text" id="search-${campo.nome}" placeholder="Pesquisar bairro..." oninput="filtrarBairros('${campo.nome}')" onclick="event.stopPropagation()" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; font-size: 0.9rem;"></div>`;
            opcoesListHTML += `<div id="lista-bairros-${campo.nome}" class="bairros-container" style="max-height: 200px; overflow-y: auto;">`;

            if (bairrosSistema.length > 0) {
                bairrosSistema.forEach(bairro => {
                    opcoesListHTML += `<div class="dropdown-item dropdown-bairro-item" onclick="selecionarOpcao('${campo.nome}', '${bairro.replace(/'/g, "\\'")}')">${bairro}</div>`;
                });
            } else {
                opcoesListHTML += `<div class="dropdown-item text-muted" style="padding: 7px;">Carregando bairros...</div>`;
            }
            opcoesListHTML += `</div>`;

            opcoesListHTML += `<div class="dropdown-item dropdown-aviso" style="background-color: #fff3cd; color: #856404; font-size: 0.85rem; border-top: 1px solid #ffeeba; cursor: default; padding: 7px; white-space: normal; line-height: 1.4;">
                ⚠️ Caso não encontre o bairro desejado, avise o Gerente de Posturas para adicioná-lo no sistema.
            </div>`;

            inputHTML = `
                <input type="hidden" id="campo-${campo.nome}" value="">
                <div class="dropdown-custom" id="dropdown-${campo.nome}">
                    <div class="dropdown-trigger" onclick="toggleDropdown('${campo.nome}')">
                        <span class="dropdown-texto">Selecione o bairro...</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </div>
                    <div class="dropdown-lista" id="dropdown-lista-${campo.nome}">
                        ${opcoesListHTML}
                    </div>
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
        } else if (campo.tipo === 'imagens_com_legenda') {
            inputHTML = `
                <div id="container-imagens-legenda" style="display: flex; flex-direction: column; gap: 10px;">
                    <button type="button" onclick="adicionarCampoImagemLegenda()" style="background: #3b82f6; color: white; border: none; border-radius: 6px; padding: 8px 14px; cursor: pointer; font-weight: bold; font-size: 13px;">+ Adicionar Imagem e Legenda</button>
                    <div id="lista-imagens-legenda" style="display: flex; flex-direction: column; gap: 10px; margin-top: 5px;"></div>
                </div>
            `;
        } else {
            let extraAttr = '';
            if (campo.nome === 'cpf' || campo.nome === 'cpf_contribuinte') {
                extraAttr = ` maxlength="18" placeholder="CPF ou CNPJ" oninput="let v=this.value.replace(/\\D/g,''); if(v.length<=11){ v=v.replace(/(\\d{3})(\\d)/,'$1.$2'); v=v.replace(/(\\d{3})(\\d)/,'$1.$2'); v=v.replace(/(\\d{3})(\\d{1,2})/,'$1-$2'); } else { v=v.replace(/^(\\d{2})(\\d)/,'$1.$2'); v=v.replace(/^(\\d{2})\\.(\\d{3})(\\d)/,'$1.$2.$3'); v=v.replace(/\\.(\\d{3})(\\d)/,'.$1/$2'); v=v.replace(/(\\d{4})(\\d)/,'$1-$2'); } this.value=v;"`;
            }
            inputHTML = `<input type="${campo.tipo}" id="campo-${campo.nome}" ${campo.obrigatorio ? 'required' : ''} ${extraAttr}>`;

            if ((campo.nome === 'nome_testemunha_1' || campo.nome === 'nome_testemunha_2') && (categoria.id === '1.2.MA' || categoria.id === '1.9')) {
                const isT1 = campo.nome === 'nome_testemunha_1';
                inputHTML = `
                    <select id="sel_fiscal_t${isT1 ? 1 : 2}" style="margin-bottom: 8px; width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" onchange="
                        const opt = this.options[this.selectedIndex];
                        const nomeInput = document.getElementById('campo-${campo.nome}');
                        const cpfInput = document.getElementById('campo-cpf_testemunha_${isT1 ? 1 : 2}');
                        if (this.value) {
                            nomeInput.value = opt.getAttribute('data-nome');
                            if (cpfInput) {
                                cpfInput.value = opt.getAttribute('data-cpf');
                                let v = cpfInput.value.replace(/\\D/g,'');
                                if(v.length<=11){ v=v.replace(/(\\d{3})(\\d)/,'$1.$2'); v=v.replace(/(\\d{3})(\\d)/,'$1.$2'); v=v.replace(/(\\d{3})(\\d{1,2})/,'$1-$2'); }
                                cpfInput.value = v;
                            }
                            nomeInput.readOnly = true;
                            nomeInput.style.backgroundColor = '#f1f5f9';
                            if (cpfInput) { cpfInput.readOnly = true; cpfInput.style.backgroundColor = '#f1f5f9'; }
                        } else {
                            nomeInput.value = '';
                            if (cpfInput) cpfInput.value = '';
                            nomeInput.readOnly = false;
                            nomeInput.style.backgroundColor = '';
                            if (cpfInput) { cpfInput.readOnly = false; cpfInput.style.backgroundColor = ''; }
                        }
                    ">
                        <option value="">Preencher Manualmente / Outra</option>
                    </select>
                ` + inputHTML;
            }
        }

        grupo.innerHTML = `
            <label for="campo-${campo.nome}">${campo.label} ${campo.obrigatorio ? '*' : ''}</label>
            ${inputHTML}
        `;

        if (campo.condicional) {
            grupo.dataset.condicionalCampo = campo.condicional.campo;
            if (campo.condicional.valor_diferente !== undefined) {
                grupo.dataset.condicionalDiferente = campo.condicional.valor_diferente;
            } else {
                grupo.dataset.condicionalValor = campo.condicional.valor;
            }
            grupo.style.display = 'none';
        }

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

                if (campo.agrupar === 'inscricao') {
                    labelAgrupada.textContent = 'Identificação do Local';
                    const toggleDiv = document.createElement('div');
                    toggleDiv.style.marginBottom = '10px';
                    toggleDiv.innerHTML = `
                        <label style="margin-right: 15px; font-weight: normal; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                            <input type="radio" name="tipo_inscricao" value="imobiliaria" checked onchange="document.getElementById('grupo-inscricao').style.display='flex'; document.getElementById('grupo-cnpj-empresa').style.display='none';"> Inscrição Imobiliária Municipal
                        </label>
                        <label style="font-weight: normal; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                            <input type="radio" name="tipo_inscricao" value="empresa" onchange="
                                document.getElementById('grupo-inscricao').style.display='none'; 
                                document.getElementById('grupo-cnpj-empresa').style.display='block';
                                const docInput = document.getElementById('campo-cpf_contribuinte') || document.getElementById('campo-n_inscricao');
                                const cnpjInput = document.getElementById('campo-cnpj_empresa');
                                if (docInput && cnpjInput && !cnpjInput.value) {
                                    const val = docInput.value.replace(/\\D/g, '');
                                    if (val.length === 14) {
                                        cnpjInput.value = val.replace(/^(\\d{2})(\\d{3})(\\d{3})(\\d{4})(\\d{2})/, '$1.$2.$3/$4-$5');
                                    }
                                }
                            "> Empresa (CNPJ)
                        </label>
                    `;
                    wrapper.appendChild(labelAgrupada);
                    wrapper.appendChild(toggleDiv);

                    const cnpjDiv = document.createElement('div');
                    cnpjDiv.id = 'grupo-cnpj-empresa';
                    cnpjDiv.style.display = 'none';
                    cnpjDiv.style.marginBottom = '10px';
                    cnpjDiv.innerHTML = `
                        <input type="text" id="campo-cnpj_empresa" class="form-control" maxlength="18" placeholder="Digite o CNPJ da Empresa" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" oninput="let v=this.value.replace(/\\D/g,''); v=v.replace(/^(\\d{2})(\\d)/,'$1.$2'); v=v.replace(/^(\\d{2})\\.(\\d{3})(\\d)/,'$1.$2.$3'); v=v.replace(/\\.(\\d{3})(\\d)/,'.$1/$2'); v=v.replace(/(\\d{4})(\\d)/,'$1-$2'); this.value=v;">
                    `;
                    wrapper.appendChild(cnpjDiv);
                } else {
                    wrapper.appendChild(labelAgrupada);
                }

                containerAgrupador = document.createElement('div');
                containerAgrupador.id = `grupo-${campo.agrupar}`;
                containerAgrupador.style.display = 'flex';
                containerAgrupador.style.gap = '10px';
                containerAgrupador.style.width = '100%';

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
    } else if (categoria.id === '1.2.MA') {
        btnSalvarForm.textContent = 'Gerar Documento';
        btnSalvarForm.onclick = () => abrirEditorAutoInfracaoAmbiental();
    } else if (categoria.id === '11') {
        btnSalvarForm.textContent = 'Gerar Documento';
        btnSalvarForm.onclick = () => abrirEditorDividaAtiva();
    } else if (categoria.id === '1.4') {
        btnSalvarForm.textContent = 'Gerar Documento';
        btnSalvarForm.onclick = () => abrirEditorOficio();
    } else if (categoria.id === '1.5' || categoria.id === '1.5.MA') {
        btnSalvarForm.textContent = 'Gerar Documento';
        btnSalvarForm.onclick = () => abrirEditorRelatorio();
    } else if (categoria.id === '1.7') {
        btnSalvarForm.textContent = 'Gerar Documento';
        btnSalvarForm.onclick = () => abrirEditorReplica();
    } else if (categoria.id === '1.8') {
        btnSalvarForm.textContent = 'Gerar Documento';
        btnSalvarForm.onclick = () => abrirEditorCertidao();
    } else if (categoria.id === '1.9') {
        btnSalvarForm.textContent = 'Gerar Documento';
        btnSalvarForm.onclick = () => abrirEditorAutoFiscalizacaoMeioAmbiente();
    } else {
        btnSalvarForm.textContent = 'Salvar';
        btnSalvarForm.onclick = () => salvarRegistro();
    }

    if (categoria.id === '1.2.MA' || categoria.id === '1.9') {
        supabaseClient.from('profiles').select('id, full_name, cpf')
            .ilike('role', '%fiscal%meio ambiente%')
            .eq('ativo', true)
            .then(res => {
                const fiscais = res.data || [];
                ['sel_fiscal_t1', 'sel_fiscal_t2'].forEach(idSel => {
                    const sel = document.getElementById(idSel);
                    if (sel) {
                        fiscais.forEach(f => {
                            if (f.full_name) f.full_name = f.full_name.replace(/Julio Cesar/gi, 'Júlio César');
                            if (f.id !== window.userIdGlobal) {
                                const opt = document.createElement('option');
                                opt.value = f.id;
                                opt.textContent = f.full_name;
                                opt.setAttribute('data-nome', f.full_name);
                                opt.setAttribute('data-cpf', f.cpf || '');
                                sel.appendChild(opt);
                            }
                        });
                    }
                });
            });
    }

    aplicarCamposCondicionais();
    overlay.classList.add('ativo');
}

function aplicarCamposCondicionais() {
    const corpo = document.getElementById('modal-campos');
    if (!corpo) return;

    const gruposCondicionais = corpo.querySelectorAll('[data-condicional-campo]');
    gruposCondicionais.forEach(grupo => {
        const campoNome = grupo.dataset.condicionalCampo;
        const valorEsperado = grupo.dataset.condicionalValor;
        const input = document.getElementById(`campo-${campoNome}`);
        if (!input) return;

        const atualizar = () => {
            let mostrar = false;
            if (grupo.dataset.condicionalDiferente !== undefined) {
                mostrar = input.value !== grupo.dataset.condicionalDiferente;
            } else {
                mostrar = input.value === valorEsperado;
            }
            grupo.style.display = mostrar ? 'block' : 'none';
        };

        input.addEventListener('change', atualizar);
        // Dispara uma vez para refletir valor inicial (edição)
        atualizar();
    });
}

// --- FECHAR MODAL ---
function fecharModalProdutividade() {
    const overlay = document.getElementById('modal-produtividade');
    overlay.classList.remove('ativo');
    categoriaAtual = null;
    rascunhoDocumento = null;
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
    container.appendChild(div);
    div.querySelector('input').focus();
};

// =========================================================
// SALVAR EDIÇÃO DE REGISTRO (ESPECÍFICO PARA NÃO AFETAR ANEXOS E PONTOS)
// =========================================================
async function salvarEdicaoRegistro() {
    console.log("Iniciando salvarEdicaoRegistro...");
    if (!modoEdicao || !registroSelecionado || !idEditando) {
        alert("Erro no estado da edição! modoEdicao: " + modoEdicao + " idEditando: " + idEditando);
        return;
    }

    // Verificar conexão antes de salvar
    const conexaoOK = await verificarConexaoAntesDeSalvar();
    if (!conexaoOK) return;

    if (salvando) {
        console.warn("Bloqueado pois 'salvando' já é true.");
        return;
    }
    salvando = true;

    const btnSalvar = document.querySelector('#modal-produtividade .btn-salvar');
    const oldTexto = btnSalvar ? btnSalvar.textContent : 'Salvar';
    if (btnSalvar) {
        btnSalvar.textContent = 'Salvando Edição...';
        btnSalvar.disabled = true;
    }

    try {
        // 1. Clona perfeitamente o campos original para NÃO PERDER NENHUM ANEXO OU CAMPO EXTRA
        const novosCampos = { ...registroSelecionado.campos };
        let todosPreenchidos = true;

        // 2. Atualiza apenas os campos que estão na tela
        categoriaAtual.campos.forEach(campo => {
            const input = document.getElementById(`campo-${campo.nome}`);

            if (campo.tipo === 'file' || campo.ignorarNoBanco) return;

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
                    novosCampos['_lista_licencas'] = lista;
                }
                return;
            }

            if (!input) return;

            let valor = input.value.trim();

            if (campo.obrigatorio && !valor) {
                todosPreenchidos = false;
                if (campo.tipo === 'select_custom' || campo.tipo === 'select_bairro') {
                    const trigger = document.querySelector(`#dropdown-${campo.nome} .dropdown-trigger`);
                    if (trigger) trigger.style.borderColor = '#ef4444';
                } else {
                    input.style.borderColor = '#ef4444';
                }
            } else {
                if (campo.tipo === 'select_custom' || campo.tipo === 'select_bairro') {
                    const trigger = document.querySelector(`#dropdown-${campo.nome} .dropdown-trigger`);
                    if (trigger) trigger.style.borderColor = '#e2e8f0';
                } else {
                    input.style.borderColor = '#e2e8f0';
                }
                novosCampos[campo.nome] = valor;
            }
        });

        if (!todosPreenchidos) {
            Swal.fire({
                icon: 'warning',
                title: 'Campos Obrigatórios',
                text: 'Por favor, preencha todos os campos obrigatórios marcados em vermelho.',
                confirmButtonColor: '#3b82f6'
            });
            return;
        }

        // 3. Define a pontuação
        // Nunca ganhar pontuação se já tinha sido zerado
        let pontos = registroSelecionado.pontuacao || 0;

        // Apenas recalcula se era uma categoria baseada em horas E se o registro NÃO estava zerado
        if (categoriaAtual.por_hora && categoriaAtual.campo_horas && pontos !== 0) {
            let pontosPorUnidade = categoriaAtual.pontos;
            if (categoriaAtual.pontos_por_tipo && novosCampos.tipo) {
                pontosPorUnidade = categoriaAtual.pontos_por_tipo[novosCampos.tipo] || categoriaAtual.pontos;
            }
            const horas = parseFloat(novosCampos[categoriaAtual.campo_horas]) || 0;
            pontos = pontosPorUnidade * horas;
        }

        let dataRegistradaManual = null;
        if ((categoriaAtual.id === '1.1' || categoriaAtual.id === '1.9') && estaNosPrimeiros7Dias()) {
            const inputDataManual = document.getElementById('campo-data_registrada_manual');
            if (inputDataManual && inputDataManual.value) {
                dataRegistradaManual = new Date(inputDataManual.value).toISOString();
            }
        }

        const isCP = categoriaAtual.destaque === true;
        const tabela = isCP ? 'controle_processual' : 'registros_produtividade';

        const updateData = {
            campos: novosCampos,
            pontuacao: pontos
        };
        if (dataRegistradaManual) {
            updateData.created_at = dataRegistradaManual;
        }

        const { error: updateError } = await supabaseClient
            .from(tabela)
            .update(updateData)
            .eq('id', idEditando);

        if (updateError) throw updateError;

        fecharModalProdutividade();
        Swal.fire({
            icon: 'success',
            title: 'Alteração salva',
            text: 'O registro foi atualizado com sucesso.',
            timer: 2500,
            timerProgressBar: true,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });

        try {
            await new Promise(r => setTimeout(r, 300));
            await carregarHistorico();
            if (typeof window.filtrarHistoricoGeral === 'function') {
                window.filtrarHistoricoGeral();
            }
        } catch (e) {
            console.warn('Erro ao recarregar histórico:', e);
        }

        const secaoHistorico = document.getElementById('aba-historico');
        if (secaoHistorico) secaoHistorico.scrollIntoView({ behavior: 'smooth', block: 'start' });

    } catch (err) {
        console.error("Erro na edição:", err);
        alert('Ocorreu um erro ao salvar a edição no banco de dados: ' + (err?.message || JSON.stringify(err)));
    } finally {
        if (btnSalvar) {
            btnSalvar.textContent = oldTexto;
            btnSalvar.disabled = false;
        }
        salvando = false;
    }
}

// --- SALVAR REGISTRO ---
let salvando = false;
async function salvarRegistro(blobManual = null, nomeManual = null) {
    if (!categoriaAtual || salvando) return;

    // Feedback visual imediato
    const btnSalvar = document.querySelector('#modal-produtividade .btn-salvar');
    const oldTexto = btnSalvar ? btnSalvar.textContent : 'Salvar';
    if (btnSalvar) {
        btnSalvar.textContent = 'Carregando...';
        btnSalvar.disabled = true;
    }

    // Verificar conexão antes de salvar
    const conexaoOK = await verificarConexaoAntesDeSalvar();
    if (!conexaoOK) {
        if (btnSalvar) {
            btnSalvar.textContent = oldTexto;
            btnSalvar.disabled = false;
        }
        return;
    }

    salvando = true;

    // 1. Coletar valores dos campos
    // Na edição, preserva os campos existentes (inclusive anexos) e só sobrescreve o que o usuário alterou
    const campos = (modoEdicao && registroSelecionado && registroSelecionado.campos)
        ? { ...registroSelecionado.campos }
        : {};
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

            // Na edição, o campo file não é renderizado — pula validação e mantém anexo existente
            if (modoEdicao && !input) return;

            // Tratar campo de arquivo
            const temAnexoExistente = modoEdicao && registroSelecionado && registroSelecionado.campos && registroSelecionado.campos[campo.nome];
            if (campo.obrigatorio && (!input.files || input.files.length === 0) && !temAnexoExistente) {
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
            if (campo.tipo === 'select_custom' || campo.tipo === 'select_bairro') {
                const trigger = document.querySelector(`#dropdown-${campo.nome} .dropdown-trigger`);
                if (trigger) trigger.style.borderColor = '#ef4444';
            } else {
                input.style.borderColor = '#ef4444';
            }
        } else {
            if (campo.tipo === 'select_custom' || campo.tipo === 'select_bairro') {
                const trigger = document.querySelector(`#dropdown-${campo.nome} .dropdown-trigger`);
                if (trigger) trigger.style.borderColor = '#e2e8f0';
            } else {
                input.style.borderColor = '#e2e8f0';
            }
        }

        if (!campo.ignorarNoBanco) {
            campos[campo.nome] = valor;
        }
    });

    if (!todosPreenchidos) {
        alert('Preencha todos os campos obrigatórios!');
        salvando = false;
        if (btnSalvar) {
            btnSalvar.textContent = oldTexto;
            btnSalvar.disabled = false;
        }
        return;
    }

    // VALIDAÇÃO DE DUPLICIDADE (CATEGORIAS 1°, 2° e 3°) - N° PROTOCOLO
    // IDs internos: '2' (1°), '3' (2°) e '4' (3°)

    const categoriasComProtocoloUnico = ['2', '3', '4'];

    if (categoriasComProtocoloUnico.includes(categoriaAtual.id) && !modoEdicao) {
        const nProtocoloNovo = campos.n_protocolo ? String(campos.n_protocolo).trim() : '';

        if (nProtocoloNovo !== '') {
            // Buscamos no banco todos os registros da categoria atual
            const { data: historico, error: erroBD } = await supabaseClient
                .from('registros_produtividade')
                .select('campos')
                .eq('categoria_id', categoriaAtual.id);

            if (!erroBD && historico) {
                // Verificação manual no JavaScript pelo N° de Protocolo
                const jaExiste = historico.some(item => {
                    const protocoloExistente = item.campos?.n_protocolo ? String(item.campos.n_protocolo).trim() : '';
                    return protocoloExistente === nProtocoloNovo;
                });

                if (jaExiste) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Protocolo Duplicado!',
                        text: `O N° de Protocolo ${nProtocoloNovo} já existe no histórico desta categoria e não pode ser repetido.`,
                        confirmButtonColor: '#ef4444'
                    });

                    // Reseta o estado para permitir nova tentativa após correção
                    salvando = false;
                    const btnSalvarLocal = document.querySelector('#modal-produtividade .btn-salvar');
                    if (btnSalvarLocal) {
                        btnSalvarLocal.textContent = 'Salvar';
                        btnSalvarLocal.disabled = false;
                    }
                    return; // BLOQUEIO: Impede o salvamento no banco de dados
                }
            }
        }
    }

    // VALIDAÇÃO DE DUPLICIDADE (CATEGORIA 4°) - DATA DO SERVIÇO
    // ID interno: '5' (4° - Serviços internos ou externos)

    if (categoriaAtual.id === '5' && !modoEdicao) {
        const dataServicoNova = campos.data_servico; // Valor da data capturado do formulário

        if (dataServicoNova) {
            // Buscamos no banco todos os registros da categoria 4°
            const { data: historico, error: erroBD } = await supabaseClient
                .from('registros_produtividade')
                .select('campos')
                .eq('categoria_id', '5');

            if (!erroBD && historico) {
                // Verificação manual no JavaScript pela Data do Serviço
                const jaExiste = historico.some(item => {
                    return item.campos?.data_servico === dataServicoNova;
                });

                if (jaExiste) {
                    // Converte a data para o formato brasileiro para exibir no alerta
                    const dataFormatada = dataServicoNova.split('-').reverse().join('/');

                    Swal.fire({
                        icon: 'error',
                        title: 'Data já registrada!',
                        text: `Já existe um registro de serviço para o dia ${dataFormatada}. Não é possível duplicar registros na mesma data.`,
                        confirmButtonColor: '#ef4444'
                    });

                    salvando = false;
                    const btnSalvarLocal = document.querySelector('#modal-produtividade .btn-salvar');
                    if (btnSalvarLocal) {
                        btnSalvarLocal.textContent = 'Salvar';
                        btnSalvarLocal.disabled = false;
                    }
                    return; // BLOQUEIO: Impede o salvamento
                }
            }
        }
    }

    // VALIDAÇÃO DE DUPLICIDADE (CATEGORIA 5°) - RESPONSÁVEL + DATA + TURNO
    // ID interno: '6' (5° - Prestação de serviço extraordinário)

    if (categoriaAtual.id === '6' && !modoEdicao) {
        const responsavelNovo = campos.responsavel ? String(campos.responsavel).trim().toLowerCase() : '';
        const dataNova = campos.data;
        const tipoNovo = campos.tipo; // Captura se é 'Diurno' ou 'Noturno'

        if (responsavelNovo !== '' && dataNova && tipoNovo) {
            // Buscamos no banco todos os registros da categoria 5°
            const { data: historico, error: erroBD } = await supabaseClient
                .from('registros_produtividade')
                .select('campos')
                .eq('categoria_id', '6');

            if (!erroBD && historico) {
                // Verifica se já existe o MESMO responsável, na MESMA data, com o MESMO turno
                const jaExiste = historico.some(item => {
                    const respExistente = item.campos?.responsavel ? String(item.campos.responsavel).trim().toLowerCase() : '';
                    const dataExistente = item.campos?.data;
                    const tipoExistente = item.campos?.tipo;

                    return respExistente === responsavelNovo &&
                        dataExistente === dataNova &&
                        tipoExistente === tipoNovo;
                });

                if (jaExiste) {
                    const dataFormatada = dataNova.split('-').reverse().join('/');
                    Swal.fire({
                        icon: 'error',
                        title: 'Turno já registrado!',
                        text: `O responsável "${campos.responsavel}" já possui um registro ${tipoNovo} para o dia ${dataFormatada}.`,
                        confirmButtonColor: '#ef4444'
                    });

                    salvando = false;
                    const btnSalvarLocal = document.querySelector('#modal-produtividade .btn-salvar');
                    if (btnSalvarLocal) {
                        btnSalvarLocal.textContent = 'Salvar';
                        btnSalvarLocal.disabled = false;
                    }
                    return; // BLOQUEIO: Impede o salvamento
                }
            }
        }
    }

    // VALIDAÇÃO DE DUPLICIDADE (CATEGORIA 6°) - TIPO + N°
    // ID interno: '7' (6° - Elaboração de Certidão e Relatório)

    if (categoriaAtual.id === '7' && !modoEdicao) {
        const tipoNovo = campos.tipo; // 'Certidão de Arquivamento' ou 'Relatório Fiscal'
        const nNovo = campos.descricao ? String(campos.descricao).trim() : '';

        if (tipoNovo && nNovo !== '') {
            // Buscamos no banco todos os registros da categoria 6°
            const { data: historico, error: erroBD } = await supabaseClient
                .from('registros_produtividade')
                .select('campos')
                .eq('categoria_id', '7');

            if (!erroBD && historico) {
                // Verifica se já existe o MESMO N° para o MESMO Tipo
                const jaExiste = historico.some(item => {
                    const tipoExistente = item.campos?.tipo;
                    const nExistente = item.campos?.descricao ? String(item.campos.descricao).trim() : '';
                    return tipoExistente === tipoNovo && nExistente === nNovo;
                });

                if (jaExiste) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Documento já existe!',
                        text: `O ${tipoNovo} de N° ${nNovo} já foi cadastrado no histórico.`,
                        confirmButtonColor: '#ef4444'
                    });

                    salvando = false;
                    const btnSalvarLocal = document.querySelector('#modal-produtividade .btn-salvar');
                    if (btnSalvarLocal) {
                        btnSalvarLocal.textContent = 'Salvar';
                        btnSalvarLocal.disabled = false;
                    }
                    return; // BLOQUEIO: Impede o salvamento
                }
            }
        }
    }

    // VALIDAÇÃO DE DUPLICIDADE (CATEGORIA 7°) - N° DO OFÍCIO
    // ID interno: '8' (7° - Elaboração de Ofícios)

    if (categoriaAtual.id === '8' && !modoEdicao) {
        const nOficioNovo = campos.n_oficio ? String(campos.n_oficio).trim() : '';

        if (nOficioNovo !== '') {
            // Buscamos no banco todos os registros da categoria 7°
            const { data: historico, error: erroBD } = await supabaseClient
                .from('registros_produtividade')
                .select('campos')
                .eq('categoria_id', '8');

            if (!erroBD && historico) {
                // Verifica se já existe o MESMO N° de Ofício
                const jaExiste = historico.some(item => {
                    const nOficioExistente = item.campos?.n_oficio ? String(item.campos.n_oficio).trim() : '';
                    return nOficioExistente === nOficioNovo;
                });

                if (jaExiste) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Ofício já cadastrado!',
                        text: `O Ofício N° ${nOficioNovo} já existe no histórico desta categoria.`,
                        confirmButtonColor: '#ef4444'
                    });

                    salvando = false;
                    const btnSalvarLocal = document.querySelector('#modal-produtividade .btn-salvar');
                    if (btnSalvarLocal) {
                        btnSalvarLocal.textContent = 'Salvar';
                        btnSalvarLocal.disabled = false;
                    }
                    return; // BLOQUEIO: Impede o salvamento
                }
            }
        }
    }

    // VALIDAÇÃO DE DUPLICIDADE (CATEGORIAS 8°, 9°, 11° e 12°) - N° PROCESSO
    // IDs internos corretos: 
    // '9'  (8° - Por Processos via protocolo municipal...)
    // '10' (9° - Processos de Alvarás de Localização...)
    // '12' (11° - Processos via UAI...)
    // '13' (12° - Processos respondidos...)

    const categoriasComProcessoUnico = ['9', '10', '12', '13'];

    if (categoriasComProcessoUnico.includes(categoriaAtual.id) && !modoEdicao) {
        const nProcessoNovo = campos.n_processo ? String(campos.n_processo).trim() : '';

        if (nProcessoNovo !== '') {
            // Buscamos no banco todos os registros da categoria atual
            const { data: historico, error: erroBD } = await supabaseClient
                .from('registros_produtividade')
                .select('campos')
                .eq('categoria_id', categoriaAtual.id);

            if (!erroBD && historico) {
                // Verificação manual no JavaScript pelo N° do Processo
                const jaExiste = historico.some(item => {
                    const processoExistente = item.campos?.n_processo ? String(item.campos.n_processo).trim() : '';
                    return processoExistente === nProcessoNovo;
                });

                if (jaExiste) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Processo já cadastrado!',
                        text: `O Processo N° ${nProcessoNovo} já existe no histórico desta categoria e não pode ser repetido.`,
                        confirmButtonColor: '#ef4444'
                    });

                    salvando = false;
                    const btnSalvarLocal = document.querySelector('#modal-produtividade .btn-salvar');
                    if (btnSalvarLocal) {
                        btnSalvarLocal.textContent = 'Salvar';
                        btnSalvarLocal.disabled = false;
                    }
                    return; // BLOQUEIO: Impede o salvamento
                }
            }
        }
    }

    // VALIDAÇÃO DE DUPLICIDADE (CATEGORIAS 13° e 14°) - N° NOTIFICAÇÃO
    // IDs internos: '14' (13°) e '15' (14°)

    const categoriasComNotificacaoUnica = ['14', '15'];

    if (categoriasComNotificacaoUnica.includes(categoriaAtual.id) && !modoEdicao) {
        const nNotificacaoNova = campos.n_notificacao ? String(campos.n_notificacao).trim() : '';

        if (nNotificacaoNova !== '') {
            // Buscamos no banco todos os registros da categoria atual
            const { data: historico, error: erroBD } = await supabaseClient
                .from('registros_produtividade')
                .select('campos')
                .eq('categoria_id', categoriaAtual.id);

            if (!erroBD && historico) {
                // Verificação manual no JavaScript pelo N° da Notificação
                const jaExiste = historico.some(item => {
                    const notificacaoExistente = item.campos?.n_notificacao ? String(item.campos.n_notificacao).trim() : '';
                    return notificacaoExistente === nNotificacaoNova;
                });

                if (jaExiste) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Notificação já cadastrada!',
                        text: `A Notificação N° ${nNotificacaoNova} já existe no histórico desta categoria e não pode ser repetida.`,
                        confirmButtonColor: '#ef4444'
                    });

                    salvando = false;
                    const btnSalvarLocal = document.querySelector('#modal-produtividade .btn-salvar');
                    if (btnSalvarLocal) {
                        btnSalvarLocal.textContent = 'Salvar';
                        btnSalvarLocal.disabled = false;
                    }
                    return; // BLOQUEIO: Impede o salvamento
                }
            }
        }
    }

    // VALIDAÇÃO DE DUPLICIDADE (CATEGORIA 15°) - N° DO AUTO
    // ID interno: '16' (15° - Autos de Infração expedidos)

    if (categoriaAtual.id === '16' && !modoEdicao) {
        const nAutoNovo = campos.n_auto ? String(campos.n_auto).trim() : '';

        if (nAutoNovo !== '') {
            // Buscamos no banco todos os registros da categoria 15°
            const { data: historico, error: erroBD } = await supabaseClient
                .from('registros_produtividade')
                .select('campos')
                .eq('categoria_id', '16');

            if (!erroBD && historico) {
                // Verifica se já existe o MESMO N° de Auto
                const jaExiste = historico.some(item => {
                    const nAutoExistente = item.campos?.n_auto ? String(item.campos.n_auto).trim() : '';
                    return nAutoExistente === nAutoNovo;
                });

                if (jaExiste) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Auto de Infração já cadastrado!',
                        text: `O Auto de Infração N° ${nAutoNovo} já existe no histórico desta categoria.`,
                        confirmButtonColor: '#ef4444'
                    });

                    salvando = false;
                    const btnSalvarLocal = document.querySelector('#modal-produtividade .btn-salvar');
                    if (btnSalvarLocal) {
                        btnSalvarLocal.textContent = 'Salvar';
                        btnSalvarLocal.disabled = false;
                    }
                    return; // BLOQUEIO: Impede o salvamento
                }
            }
        }
    }

    // VALIDAÇÃO DE DUPLICIDADE (CATEGORIA 17°) - ENDEREÇO + DATA
    // ID interno: '17' (Informação à Fiscalização de Obras...)

    if (categoriaAtual.id === '17' && !modoEdicao) {
        const enderecoNovo = campos.endereco ? String(campos.endereco).trim().toLowerCase() : '';
        const dataNova = campos.data;

        if (enderecoNovo !== '' && dataNova) {
            // Buscamos no banco todos os registros da categoria 17°
            const { data: historico, error: erroBD } = await supabaseClient
                .from('registros_produtividade')
                .select('campos')
                .eq('categoria_id', '17');

            if (!erroBD && historico) {
                // Verifica se já existe o MESMO endereço na MESMA data
                const jaExiste = historico.some(item => {
                    const enderecoExistente = item.campos?.endereco ? String(item.campos.endereco).trim().toLowerCase() : '';
                    const dataExistente = item.campos?.data;
                    return enderecoExistente === enderecoNovo && dataExistente === dataNova;
                });

                if (jaExiste) {
                    const dataFormatada = dataNova.split('-').reverse().join('/');
                    Swal.fire({
                        icon: 'error',
                        title: 'Endereço já registrado!',
                        text: `Já existe uma informação de obra para o endereço "${campos.endereco}" no dia ${dataFormatada}.`,
                        confirmButtonColor: '#ef4444'
                    });

                    salvando = false;
                    const btnSalvarLocal = document.querySelector('#modal-produtividade .btn-salvar');
                    if (btnSalvarLocal) {
                        btnSalvarLocal.textContent = 'Salvar';
                        btnSalvarLocal.disabled = false;
                    }
                    return; // BLOQUEIO: Impede o salvamento
                }
            }
        }
    }

    // VALIDAÇÃO DE DUPLICIDADE (CATEGORIA 18°) - LOCAL + DATA
    // ID interno correto: '18' (18° - Vistoria de Rotina no Camelódromo...)

    if (categoriaAtual.id === '18' && !modoEdicao) {
        const localNovo = campos.local ? String(campos.local).trim().toLowerCase() : '';
        const dataNova = campos.data;

        if (localNovo !== '' && dataNova) {
            // Buscamos no banco todos os registros da categoria 18°
            const { data: historico, error: erroBD } = await supabaseClient
                .from('registros_produtividade')
                .select('campos')
                .eq('categoria_id', '18');

            if (!erroBD && historico) {
                // Verifica se já existe o MESMO local na MESMA data
                const jaExiste = historico.some(item => {
                    const localExistente = item.campos?.local ? String(item.campos.local).trim().toLowerCase() : '';
                    const dataExistente = item.campos?.data;
                    return localExistente === localNovo && dataExistente === dataNova;
                });

                if (jaExiste) {
                    const dataFormatada = dataNova.split('-').reverse().join('/');
                    Swal.fire({
                        icon: 'error',
                        title: 'Local já registrado!',
                        text: `Já existe uma vistoria registrada para o local "${campos.local}" no dia ${dataFormatada}.`,
                        confirmButtonColor: '#ef4444'
                    });

                    salvando = false;
                    const btnSalvarLocal = document.querySelector('#modal-produtividade .btn-salvar');
                    if (btnSalvarLocal) {
                        btnSalvarLocal.textContent = 'Salvar';
                        btnSalvarLocal.disabled = false;
                    }
                    return; // BLOQUEIO: Impede o salvamento
                }
            }
        }
    }

    // VALIDAÇÃO DE DUPLICIDADE (CATEGORIAS 18, 20, 21 e 22) - LOCAL + DATA
    // IDs internos: '18', '20', '21', '22'

    const categoriasComLocalUnico = ['18', '20', '21', '22'];

    if (categoriasComLocalUnico.includes(categoriaAtual.id) && !modoEdicao) {
        const localNovo = campos.local ? String(campos.local).trim().toLowerCase() : '';
        const dataNova = campos.data;

        if (localNovo !== '' && dataNova) {
            // Buscamos no banco todos os registros da categoria atual
            const { data: historico, error: erroBD } = await supabaseClient
                .from('registros_produtividade')
                .select('campos')
                .eq('categoria_id', categoriaAtual.id);

            if (!erroBD && historico) {
                // Verifica se já existe o MESMO local na MESMA data
                const jaExiste = historico.some(item => {
                    const localExistente = item.campos?.local ? String(item.campos.local).trim().toLowerCase() : '';
                    const dataExistente = item.campos?.data;
                    return localExistente === localNovo && dataExistente === dataNova;
                });

                if (jaExiste) {
                    const dataFormatada = dataNova.split('-').reverse().join('/');
                    Swal.fire({
                        icon: 'error',
                        title: 'Local já registrado!',
                        text: `Já existe um registro para o local "${campos.local}" no dia ${dataFormatada} nesta categoria.`,
                        confirmButtonColor: '#ef4444'
                    });

                    salvando = false;
                    const btnSalvarLocal = document.querySelector('#modal-produtividade .btn-salvar');
                    if (btnSalvarLocal) {
                        btnSalvarLocal.textContent = 'Salvar';
                        btnSalvarLocal.disabled = false;
                    }
                    return; // BLOQUEIO: Impede o salvamento
                }
            }
        }
    }

    // VALIDAÇÃO DE DUPLICIDADE (CATEGORIA 23°) - LOCAL + ESPÉCIE + DATA
    // ID interno: '23' (Apreensão de mercadorias...)

    if (categoriaAtual.id === '23' && !modoEdicao) {
        const localNovo = campos.local ? String(campos.local).trim().toLowerCase() : '';
        const especieNova = campos.especie ? String(campos.especie).trim().toLowerCase() : '';
        const dataNova = campos.data;

        if (localNovo !== '' && especieNova !== '' && dataNova) {
            // Buscamos no banco todos os registros da categoria 23°
            const { data: historico, error: erroBD } = await supabaseClient
                .from('registros_produtividade')
                .select('campos')
                .eq('categoria_id', '23');

            if (!erroBD && historico) {
                // Verifica se já existe o MESMO local, MESMA espécie na MESMA data
                const jaExiste = historico.some(item => {
                    const localExistente = item.campos?.local ? String(item.campos.local).trim().toLowerCase() : '';
                    const especieExistente = item.campos?.especie ? String(item.campos.especie).trim().toLowerCase() : '';
                    const dataExistente = item.campos?.data;

                    return localExistente === localNovo &&
                        especieExistente === especieNova &&
                        dataExistente === dataNova;
                });

                if (jaExiste) {
                    const dataFormatada = dataNova.split('-').reverse().join('/');
                    Swal.fire({
                        icon: 'error',
                        title: 'Apreensão já registrada!',
                        text: `Já existe um registro para a mercadoria "${campos.especie}" no local "${campos.local}" no dia ${dataFormatada}.`,
                        confirmButtonColor: '#ef4444'
                    });

                    salvando = false;
                    const btnSalvarLocal = document.querySelector('#modal-produtividade .btn-salvar');
                    if (btnSalvarLocal) {
                        btnSalvarLocal.textContent = 'Salvar';
                        btnSalvarLocal.disabled = false;
                    }
                    return; // BLOQUEIO: Impede o salvamento
                }
            }
        }
    }

    // VALIDAÇÃO DE DUPLICIDADE (CATEGORIAS 24° e 25°) - ESTABELECIMENTO + DATA
    // IDs internos: '24' e '25'

    const categoriasInterdicao = ['24', '25'];

    if (categoriasInterdicao.includes(categoriaAtual.id) && !modoEdicao) {
        const estabelecimentoNovo = campos.estabelecimento ? String(campos.estabelecimento).trim().toLowerCase() : '';
        const dataNova = campos.data;

        if (estabelecimentoNovo !== '' && dataNova) {
            // Buscamos no banco todos os registros da categoria atual
            const { data: historico, error: erroBD } = await supabaseClient
                .from('registros_produtividade')
                .select('campos')
                .eq('categoria_id', categoriaAtual.id);

            if (!erroBD && historico) {
                // Verifica se já existe o MESMO estabelecimento na MESMA data
                const jaExiste = historico.some(item => {
                    const estExistente = item.campos?.estabelecimento ? String(item.campos.estabelecimento).trim().toLowerCase() : '';
                    const dataExistente = item.campos?.data;
                    return estExistente === estabelecimentoNovo && dataExistente === dataNova;
                });

                if (jaExiste) {
                    const dataFormatada = dataNova.split('-').reverse().join('/');
                    Swal.fire({
                        icon: 'error',
                        title: 'Registro já existe!',
                        text: `Já existe um registro para o estabelecimento "${campos.estabelecimento}" no dia ${dataFormatada} nesta categoria.`,
                        confirmButtonColor: '#ef4444'
                    });

                    salvando = false;
                    const btnSalvarLocal = document.querySelector('#modal-produtividade .btn-salvar');
                    if (btnSalvarLocal) {
                        btnSalvarLocal.textContent = 'Salvar';
                        btnSalvarLocal.disabled = false;
                    }
                    return; // BLOQUEIO: Impede o salvamento
                }
            }
        }
    }

    // VALIDAÇÃO DE DUPLICIDADE (CATEGORIA 26°) - N° ALVARÁ + DATA
    // ID interno: '26' (Cassação de Alvarás...)

    if (categoriaAtual.id === '26' && !modoEdicao) {
        const nAlvaraNovo = campos.n_alvara ? String(campos.n_alvara).trim() : '';
        const dataNova = campos.data;

        if (nAlvaraNovo !== '' && dataNova) {
            // Buscamos no banco todos os registros da categoria 26°
            const { data: historico, error: erroBD } = await supabaseClient
                .from('registros_produtividade')
                .select('campos')
                .eq('categoria_id', '26');

            if (!erroBD && historico) {
                // Verifica se já existe o MESMO N° de Alvará na MESMA data
                const jaExiste = historico.some(item => {
                    const alvaraExistente = item.campos?.n_alvara ? String(item.campos.n_alvara).trim() : '';
                    const dataExistente = item.campos?.data;
                    return alvaraExistente === nAlvaraNovo && dataExistente === dataNova;
                });

                if (jaExiste) {
                    const dataFormatada = dataNova.split('-').reverse().join('/');
                    Swal.fire({
                        icon: 'error',
                        title: 'Alvará já registrado!',
                        text: `Já existe um registro para o Alvará N° ${nAlvaraNovo} no dia ${dataFormatada}.`,
                        confirmButtonColor: '#ef4444'
                    });

                    salvando = false;
                    const btnSalvarLocal = document.querySelector('#modal-produtividade .btn-salvar');
                    if (btnSalvarLocal) {
                        btnSalvarLocal.textContent = 'Salvar';
                        btnSalvarLocal.disabled = false;
                    }
                    return; // BLOQUEIO: Impede o salvamento
                }
            }
        }
    }

    // VALIDAÇÃO DE DUPLICIDADE (CATEGORIA 27°) - N° LICENÇA + DATA
    // ID interno: '27' (Cassação de Licenças...)

    if (categoriaAtual.id === '27' && !modoEdicao) {
        const nLicencaNova = campos.n_licenca ? String(campos.n_licenca).trim() : '';
        const dataNova = campos.data;

        if (nLicencaNova !== '' && dataNova) {
            // Buscamos no banco todos os registros da categoria 27°
            const { data: historico, error: erroBD } = await supabaseClient
                .from('registros_produtividade')
                .select('campos')
                .eq('categoria_id', '27');

            if (!erroBD && historico) {
                // Verifica se já existe o MESMO N° de Licença na MESMA data
                const jaExiste = historico.some(item => {
                    const licencaExistente = item.campos?.n_licenca ? String(item.campos.n_licenca).trim() : '';
                    const dataExistente = item.campos?.data;
                    return licencaExistente === nLicencaNova && dataExistente === dataNova;
                });

                if (jaExiste) {
                    const dataFormatada = dataNova.split('-').reverse().join('/');
                    Swal.fire({
                        icon: 'error',
                        title: 'Licença já registrada!',
                        text: `Já existe um registro para a Licença N° ${nLicencaNova} no dia ${dataFormatada}.`,
                        confirmButtonColor: '#ef4444'
                    });

                    salvando = false;
                    const btnSalvarLocal = document.querySelector('#modal-produtividade .btn-salvar');
                    if (btnSalvarLocal) {
                        btnSalvarLocal.textContent = 'Salvar';
                        btnSalvarLocal.disabled = false;
                    }
                    return; // BLOQUEIO: Impede o salvamento
                }
            }
        }
    }

    // VALIDAÇÃO DE DUPLICIDADE (CATEGORIAS 28°, 29° e 30°) - DATA + DURAÇÃO
    // IDs internos: '28', '29', '30'

    const categoriasPorDataDuracao = ['28', '29', '30'];

    if (categoriasPorDataDuracao.includes(categoriaAtual.id) && !modoEdicao) {
        const dataNova = campos.data;
        const duracaoNova = campos.duracao;

        if (dataNova && duracaoNova) {
            // Buscamos no banco todos os registros da categoria atual
            const { data: historico, error: erroBD } = await supabaseClient
                .from('registros_produtividade')
                .select('campos')
                .eq('categoria_id', categoriaAtual.id);

            if (!erroBD && historico) {
                // Verifica se já existe um registro para a MESMA data E MESMA duração
                const jaExiste = historico.some(item => {
                    return item.campos?.data === dataNova && item.campos?.duracao == duracaoNova;
                });

                if (jaExiste) {
                    const dataFormatada = dataNova.split('-').reverse().join('/');
                    Swal.fire({
                        icon: 'error',
                        title: 'Registro duplicado!',
                        text: `Já existe um registro com duração de ${duracaoNova}h para o dia ${dataFormatada} nesta categoria.`,
                        confirmButtonColor: '#ef4444'
                    });

                    salvando = false;
                    const btnSalvarLocal = document.querySelector('#modal-produtividade .btn-salvar');
                    if (btnSalvarLocal) {
                        btnSalvarLocal.textContent = 'Salvar';
                        btnSalvarLocal.disabled = false;
                    }
                    return; // BLOQUEIO: Impede o salvamento
                }
            }
        }
    }
    // ============================================================

    // ============================================================
    // VALIDAÇÃO DE DUPLICIDADE (CATEGORIA 16.1) - N° NOTIFICAÇÃO
    // ============================================================
    // ID interno: '1.1' (16.1 - Controle Processual: Notificação Preliminar)
    if (categoriaAtual.id === '1.1' && !modoEdicao) {
        // Garante que o objeto 'user' esteja disponível antes de qualquer validação que o utilize
        const { data: { user } } = await getAuthUser();
        if (!user) {
            Swal.fire({
                icon: 'error',
                title: 'Sessão Expirada!',
                text: 'Sua sessão expirou. Por favor, faça login novamente.',
                confirmButtonColor: '#ef4444'
            });
            salvando = false;
            const btnSalvarLocal = document.querySelector('#modal-produtividade .btn-salvar');
            if (btnSalvarLocal) {
                btnSalvarLocal.textContent = 'Salvar';
                btnSalvarLocal.disabled = false;
            }
            return; // BLOQUEIO: Impede o salvamento se o usuário não estiver logado
        }

        const nNotificacaoNovo = campos.n_notificacao ? String(campos.n_notificacao).trim() : '';

        if (nNotificacaoNovo !== '') {
            // Buscamos na tabela CORRETA (controle_processual) filtrando por categoria e user_id
            const { data: historico, error: erroBD } = await supabaseClient
                .from('controle_processual')
                .select('campos')
                .eq('categoria_id', '1.1')
                .eq('user_id', user.id); // Filtra apenas os registros do usuário logado

            if (!erroBD && historico) {
                const jaExiste = historico.some(item => {
                    const notificacaoExistente = item.campos?.n_notificacao ? String(item.campos.n_notificacao).trim() : '';
                    return notificacaoExistente === nNotificacaoNovo;
                });

                if (jaExiste) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Notificação já cadastrada!',
                        text: `A Notificação N° ${nNotificacaoNovo} já existe no seu histórico pessoal.`,
                        confirmButtonColor: '#ef4444'
                    });

                    salvando = false;
                    const btnSalvarLocal = document.querySelector('#modal-produtividade .btn-salvar');
                    if (btnSalvarLocal) {
                        btnSalvarLocal.textContent = 'Salvar';
                        btnSalvarLocal.disabled = false;
                    }
                    return; // BLOQUEIO: Impede o salvamento
                }
            }
        }
    }

    // ============================================================
    // VALIDAÇÃO DE DUPLICIDADE (CATEGORIA 16.3) - N° DO AR
    // ============================================================
    // ID interno: '1.3' (16.3 - Controle Processual: Aviso de Recebimento (AR))
    if (categoriaAtual.id === '1.3' && !modoEdicao) {
        // Garantimos o usuário logado
        const { data: { user } } = await getAuthUser();
        if (!user) {
            salvando = false;
            return;
        }

        const nARNovo = campos.n_ar ? String(campos.n_ar).trim() : '';

        if (nARNovo !== '') {
            // Buscamos na tabela controle_processual apenas os registros do usuário para esta categoria
            const { data: historico, error: erroBD } = await supabaseClient
                .from('controle_processual')
                .select('campos')
                .eq('categoria_id', '1.3')
                .eq('user_id', user.id);

            if (!erroBD && historico) {
                const jaExiste = historico.some(item => {
                    const arExistente = item.campos?.n_ar ? String(item.campos.n_ar).trim() : '';
                    return arExistente === nARNovo;
                });

                if (jaExiste) {
                    Swal.fire({
                        icon: 'error',
                        title: 'AR já cadastrado!',
                        text: `O Aviso de Recebimento N° ${nARNovo} já consta no seu histórico pessoal.`,
                        confirmButtonColor: '#ef4444'
                    });

                    salvando = false;
                    const btnSalvarLocal = document.querySelector('#modal-produtividade .btn-salvar');
                    if (btnSalvarLocal) {
                        btnSalvarLocal.textContent = 'Salvar';
                        btnSalvarLocal.disabled = false;
                    }
                    return; // BLOQUEIO
                }
            }
        }
    }

    // ============================================================
    // VALIDAÇÃO DE DUPLICIDADE (CATEGORIA 16.6) - N° DO PROTOCOLO
    // ============================================================
    // ID interno: '1.6' (16.6 - Controle Processual: Protocolo)
    if (categoriaAtual.id === '1.6' && !modoEdicao) {
        const { data: { user } } = await getAuthUser();
        if (!user) {
            salvando = false;
            return;
        }

        const nProtocoloNovo = campos.n_protocolo ? String(campos.n_protocolo).trim() : '';

        if (nProtocoloNovo !== '') {
            const { data: historico, error: erroBD } = await supabaseClient
                .from('controle_processual')
                .select('campos')
                .eq('categoria_id', '1.6')
                .eq('user_id', user.id);

            if (!erroBD && historico) {
                const jaExiste = historico.some(item => {
                    const protocoloExistente = item.campos?.n_protocolo
                        ? String(item.campos.n_protocolo).trim()
                        : '';
                    return protocoloExistente === nProtocoloNovo;
                });

                if (jaExiste) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Protocolo já cadastrado!',
                        text: `O Protocolo N° ${nProtocoloNovo} já consta no seu histórico pessoal.`,
                        confirmButtonColor: '#ef4444'
                    });

                    salvando = false;
                    const btnSalvarLocal = document.querySelector('#modal-produtividade .btn-salvar');
                    if (btnSalvarLocal) {
                        btnSalvarLocal.textContent = 'Salvar';
                        btnSalvarLocal.disabled = false;
                    }
                    return; // BLOQUEIO
                }
            }
        }
    }


    // Campo especial: data registrada manual (categoria 1.1, primeiros 7 dias)
    let dataRegistradaManual = null;
    if ((categoriaAtual.id === '1.1' || categoriaAtual.id === '1.9') && estaNosPrimeiros7Dias()) {
        const inputDataManual = document.getElementById('campo-data_registrada_manual');
        if (inputDataManual && inputDataManual.value) {
            dataRegistradaManual = new Date(inputDataManual.value).toISOString();
        }
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

    // Se estiver em modo edição e a pontuação anterior for 0 (ex: zerado por fechamento/limpeza), mantém 0
    if (modoEdicao && registroSelecionado && registroSelecionado.pontuacao === 0) {
        pontos = 0;
    }

    // 5. Salvar no Supabase
    let numeroSeqRollback = null;
    try {
        console.log('[Salvar] Iniciando salvamento. modoEdicao:', modoEdicao, 'idEditando:', idEditando, 'categoria:', categoriaAtual?.id);
        let data, error;
        const isCP = categoriaAtual.destaque === true;
        const tabela = isCP ? 'controle_processual' : 'registros_produtividade';
        console.log('[Salvar] tabela:', tabela, 'isCP:', isCP);

        if (modoEdicao && idEditando) {
            console.log('[Salvar] Entrou no bloco de EDIÇÃO');
            // EDIÇÃO: atualizar registro existente
            const updateData = {
                pontuacao: pontos,
                campos: campos
            };
            if (dataRegistradaManual) {
                updateData.created_at = dataRegistradaManual;
            }
            const { error: updateError } = await supabaseClient
                .from(tabela)
                .update(updateData)
                .eq('id', idEditando);

            if (updateError) {
                console.error('[Salvar] Erro no update:', updateError);
                throw updateError;
            }

            console.log('[Salvar] Edição salva com sucesso.');
            fecharModalProdutividade();
            Swal.fire({
                icon: 'success',
                title: 'Alteração salva',
                text: 'O registro foi atualizado com sucesso.',
                timer: 2500,
                timerProgressBar: true,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
            try {
                await new Promise(r => setTimeout(r, 300));
                await carregarHistorico();
                if (typeof filtrarHistoricoGeral === 'function') {
                    filtrarHistoricoGeral();
                }
                console.log('[Salvar] Histórico recarregado.');
            } catch (e) {
                console.warn('[Salvar] Erro ao recarregar histórico:', e);
            }
            const secaoHistorico = document.getElementById('aba-historico');
            if (secaoHistorico) secaoHistorico.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        } else {
            // CRIAÇÃO
            if (isCP) {
                // Buscar nome do fiscal
                const { data: perfil } = await supabaseClient
                    .from('profiles')
                    .select('full_name')
                    .eq('id', user.id)
                    .maybeSingle();
                const fiscalNome = (perfil?.full_name || 'Fiscal').replace(/Julio Cesar/gi, 'Júlio César');

                // Gerar número sequencial se necessário (AI, Ofício, Relatório, Réplica, Certidão, Dívida Ativa)
                let numeroSeq = null;
                const categoriasAutoNum = ['1.2', '1.2.MA', '1.4', '1.5', '1.5.MA', '1.7', '1.8', '11'];
                if (categoriasAutoNum.includes(categoriaAtual.id)) {
                    numeroSeq = await gerarNumeroSequencial(categoriaAtual.id);
                    numeroSeqRollback = numeroSeq;
                }

                const insertDataCP = {
                    user_id: user.id,
                    fiscal_nome: fiscalNome,
                    categoria_id: categoriaAtual.id,
                    categoria_nome: categoriaAtual.nome,
                    numero_sequencial: numeroSeq,
                    pontuacao: pontos,
                    campos: campos
                };
                if (dataRegistradaManual) {
                    insertDataCP.created_at = dataRegistradaManual;
                }
                ({ data, error } = await supabaseClient
                    .from('controle_processual')
                    .insert(insertDataCP)
                    .select());

                // AUTOMÁTICO: Gerar a categoria 14 (Notificação Preliminar expedidos - id visual 13) - 20 pts
                if (categoriaAtual.id === '1.1' && !error) {
                    let dataAtual;
                    if (dataRegistradaManual) {
                        dataAtual = dataRegistradaManual.split('T')[0];
                    } else {
                        const hoje = new Date();
                        const ano = hoje.getFullYear();
                        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
                        const dia = String(hoje.getDate()).padStart(2, '0');
                        dataAtual = `${ano}-${mes}-${dia}`;
                    }

                    const startsWithAI = campos.n_notificacao && campos.n_notificacao.toUpperCase().startsWith('AI');

                    if (startsWithAI) {
                        const campos16 = {
                            n_auto: campos.n_notificacao || '',
                            descricao: campos.motivo || 'Expedição Automática',
                            data: dataAtual
                        };

                        const { error: err16 } = await supabaseClient
                            .from('registros_produtividade')
                            .insert({
                                user_id: user.id,
                                categoria_id: '16',
                                categoria_nome: 'Autos de Infração expedidos',
                                pontuacao: 30,
                                campos: campos16
                            });

                        if (!err16) {
                            pontos += 30; // Para mostrar os 35 pontos no alerta de sucesso
                        } else {
                            console.error('Erro ao gerar Autos de Infração expedidos (16):', err16);
                        }
                    } else {
                        const campos14 = {
                            n_notificacao: campos.n_notificacao || '',
                            descricao: campos.motivo || 'Expedição Automática',
                            data: dataAtual
                        };

                        const { error: err14 } = await supabaseClient
                            .from('registros_produtividade')
                            .insert({
                                user_id: user.id,
                                categoria_id: '14',
                                categoria_nome: 'Notificação Preliminar expedidos',
                                pontuacao: 20,
                                campos: campos14
                            });

                        if (!err14) {
                            pontos += 20; // Para mostrar os 25 pontos no alerta de sucesso
                        } else {
                            console.error('Erro ao gerar Notificação Preliminar expedidos (14):', err14);
                        }
                    }
                }

                // AUTOMÁTICO: Gerar a categoria 16 (Autos de Infração expedidos - id visual 15) - 30 pts
                if ((categoriaAtual.id === '1.2' || categoriaAtual.id === '1.2.MA') && !error) {
                    let dataAtual;
                    if (dataRegistradaManual) {
                        dataAtual = dataRegistradaManual.split('T')[0];
                    } else {
                        const hoje = new Date();
                        const ano = hoje.getFullYear();
                        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
                        const dia = String(hoje.getDate()).padStart(2, '0');
                        dataAtual = `${ano}-${mes}-${dia}`;
                    }

                    const campos16 = {
                        n_auto: numeroSeq || '',
                        descricao: campos.motivo || 'Expedição Automática',
                        data: dataAtual
                    };

                    const { error: err16 } = await supabaseClient
                        .from('registros_produtividade')
                        .insert({
                            user_id: user.id,
                            categoria_id: '16',
                            categoria_nome: 'Autos de Infração expedidos',
                            pontuacao: 30,
                            campos: campos16
                        });

                    if (!err16) {
                        pontos += 30; // Para mostrar os 35 pontos no alerta de sucesso
                    } else {
                        console.error('Erro ao gerar Autos de Infração expedidos (16):', err16);
                    }
                }

                // AUTOMÁTICO: Gerar a categoria 14 (Notificação Preliminar expedidos - id visual 13) - 20 pts para Auto de Fiscalização
                if (categoriaAtual.id === '1.9' && !error) {
                    let dataAtual;
                    if (dataRegistradaManual) {
                        dataAtual = dataRegistradaManual.split('T')[0];
                    } else {
                        const hoje = new Date();
                        const ano = hoje.getFullYear();
                        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
                        const dia = String(hoje.getDate()).padStart(2, '0');
                        dataAtual = `${ano}-${mes}-${dia}`;
                    }

                    const campos14 = {
                        n_notificacao: numeroSeq || '',
                        descricao: campos.irregularidades || 'Expedição Automática',
                        data: dataAtual
                    };

                    const { error: err14 } = await supabaseClient
                        .from('registros_produtividade')
                        .insert({
                            user_id: user.id,
                            categoria_id: '14',
                            categoria_nome: 'Notificação Preliminar expedidos',
                            pontuacao: 20,
                            campos: campos14
                        });

                    if (!err14) {
                        pontos += 20; // Para mostrar os 25 pontos no alerta de sucesso
                    } else {
                        console.error('Erro ao gerar Notificação Preliminar expedidos (14) via AF:', err14);
                    }
                }
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
                console.error('[Salvar] Erro no insert/update:', error);
                throw error;
            }
            console.log('[Salvar] Insert/update OK. data:', data);

            // Upload de arquivo anexo (se houver)
            console.log('[Salvar] Chegou no upload. arquivoAnexo:', !!arquivoAnexo, 'data.length:', data?.length);
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

                try {
                    const uploadResult = await cloudinaryUploadComPath(arquivoAnexo.file, 'anexos/' + caminho);
                    const camposAtualizados = { ...campos, [arquivoAnexo.nome]: uploadResult.url };

                    await supabaseClient
                        .from(tabela)
                        .update({ campos: camposAtualizados })
                        .eq('id', registroId);
                } catch (uploadError) {
                    console.error('Erro no upload:', uploadError);
                    alert('Registro salvo, mas erro ao anexar PDF: ' + uploadError.message);
                }
            }

            // Resetar modo edição
            const eraEdicao = modoEdicao;
            modoEdicao = false;
            idEditando = null;
            console.log('[Salvar] Reset modoEdicao. eraEdicao:', eraEdicao);

            // Atualizar histórico aguardando o Supabase com pequena margem de segurança
            await new Promise(r => setTimeout(r, 500));
            if (categoriaAtual.id === '11' && data && data.length > 0) {
                // Para Dívida Ativa, o usuário precisa ver o número gerado para anotar no processo físico
                alert(`Registro salvo com sucesso!\n\nSeu número de Dívida Ativa gerado é: ${data[0].numero_sequencial}`);
            } else if (categoriaAtual.id === '19' && campos._lista_licencas && campos._lista_licencas.length > 1) {
                alert(`${campos._lista_licencas.length} registros salvos com sucesso! (${pontos * campos._lista_licencas.length} pontos no total)`);
            } else if (categoriaAtual.id === '1.1') {
                const startsWithAI = campos.n_notificacao && campos.n_notificacao.toUpperCase().startsWith('AI');
                if (startsWithAI) {
                    alert('Registros salvos com sucesso!\n\n• Notificação Preliminar (5 pontos)\n• Autos de Infração expedidos (30 pontos)\n\n 35 pontos salvos no total!');
                } else {
                    alert('Registros salvos com sucesso!\n\n• Notificação Preliminar (5 pontos)\n• Notificação Preliminar expedidos (20 pontos)\n\n 25 pontos salvos no total!');
                }
            } else if (categoriaAtual.id === '1.2' || categoriaAtual.id === '1.2.MA') {
                alert('Registros salvos com sucesso!\n\n• Auto de Infração (5 pontos)\n• Autos de Infração expedidos (30 pontos)\n\n 35 pontos salvos no total!');
            } else if (categoriaAtual.id === '1.9') {
                alert('Registros salvos com sucesso!\n\n• Auto de Fiscalização (5 pontos)\n• Notificação Preliminar expedidos (20 pontos)\n\n 25 pontos salvos no total!');
            } else {
                alert('Registro salvo com sucesso! (' + pontos + ' pontos)');
            }

            // Fechar modal DEPOIS do alerta (pois zera a categoriaAtual)
            fecharModalProdutividade();

            // Atualizar histórico e pontuação total na tela
            await carregarHistorico();

        } // Fim de else (CRIAÇÃO)
    } catch (err) {
        console.error("[Salvar] Erro capturado:", err);
        if (numeroSeqRollback && categoriaAtual && categoriaAtual.id) {
            try {
                await devolverNumeroSequencialCompleto(categoriaAtual.id, numeroSeqRollback, new Date().getFullYear());
            } catch (e) { console.error('Erro rollback', e); }
        }
        console.error("[Salvar] Tipo do erro:", typeof err, "JSON:", JSON.stringify(err));
        alert('Ocorreu um erro ao salvar o registro no banco de dados: ' + (err?.message || JSON.stringify(err) || 'Erro desconhecido'));
        fecharModalProdutividade();
    } finally {
        console.log('[Salvar] Finally executado.');
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
    if (!reg) return new Date();

    // Controle Processual: sempre tentar created_at primeiro
    if (reg.categoria_id && reg.categoria_id.toString().startsWith('1.')) {
        if (reg.created_at) {
            const dtCP = new Date(reg.created_at);
            if (!isNaN(dtCP.getTime())) return dtCP;
        }
    }

    if (reg.campos && typeof reg.campos === 'object') {
        // Registros comuns: procura por qualquer campo que tenha "data" no nome
        for (const [chave, valor] of Object.entries(reg.campos)) {
            if (chave.includes('data') && valor && typeof valor === 'string') {
                // Formato ISO: YYYY-MM-DD
                if (valor.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    const dtIso = new Date(valor + 'T12:00:00');
                    if (!isNaN(dtIso.getTime())) return dtIso;
                }
                // Formato brasileiro: DD/MM/YYYY
                const matchBr = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
                if (matchBr) {
                    const [, dia, mes, ano] = matchBr;
                    const dtBr = new Date(`${ano}-${mes}-${dia}T12:00:00`);
                    if (!isNaN(dtBr.getTime())) return dtBr;
                }
                // Formato brasileiro curto: DD/MM/YY
                const matchBrCurto = valor.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
                if (matchBrCurto) {
                    const [, dia, mes, anoCurto] = matchBrCurto;
                    const ano = parseInt(anoCurto, 10) >= 50 ? `19${anoCurto}` : `20${anoCurto}`;
                    const dtBrCurto = new Date(`${ano}-${mes}-${dia}T12:00:00`);
                    if (!isNaN(dtBrCurto.getTime())) return dtBrCurto;
                }
            }
        }
    }

    if (reg.created_at) {
        const dtCreated = new Date(reg.created_at);
        if (!isNaN(dtCreated.getTime())) return dtCreated;
    }

    return new Date();
}

function estaNosPrimeiros7Dias() {
    const hoje = new Date();
    return hoje.getDate() <= 7;
}

function adicionarCampoDataRegistrada(container, dataExistenteISO, isEdicao) {
    const grupo = document.createElement('div');
    grupo.className = 'campo-grupo';
    grupo.id = 'grupo-data-registrada-manual';

    const agora = new Date();
    const tzOffsetAgora = agora.getTimezoneOffset() * 60000;
    const agoraLocal = new Date(agora.getTime() - tzOffsetAgora).toISOString().slice(0, 16);

    let valorInicial = agoraLocal;
    let maxValor = agoraLocal;

    if (isEdicao && dataExistenteISO) {
        const dt = new Date(dataExistenteISO);
        const tzOffsetDt = dt.getTimezoneOffset() * 60000;
        const dtLocal = new Date(dt.getTime() - tzOffsetDt).toISOString().slice(0, 16);
        valorInicial = dtLocal;
        maxValor = valorInicial;
    }

    grupo.innerHTML = `
        <label for="campo-data_registrada_manual">Data Registrada <span style="color:#666;font-size:0.8em;">(até dia 7 do mês)</span></label>
        <input type="datetime-local" id="campo-data_registrada_manual" value="${valorInicial}" max="${maxValor}" style="font-size:16px;">
        <small style="color:#64748b; font-size:0.75rem;">Ajuste a data/hora real do registro. Não pode ser futura${isEdicao ? ' nem posterior à data atualmente salva' : ''}.</small>
    `;
    container.appendChild(grupo);
}

async function carregarHistorico() {
    const container = document.getElementById('historico-lista');
    const pontuacaoEl = document.getElementById('pontuacao-total');
    if (!container) return;

    // Usar promessa global via helper em painel.js
    const { data: { user } } = await getAuthUser();
    if (!user) return;

    // Buscar registros de produtividade do próprio fiscal
    const { data: regProd, error: errProd } = await supabaseClient
        .from('registros_produtividade')
        .select('*')
        .eq('user_id', user.id)
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
        const catDef = CATEGORIAS.find(c => c.id === catId);
        option.textContent = `${obterIdVisual(catId)}° - ${catDef ? catDef.nome : registro.categoria_nome}`;
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
                r.numero_sequencial || '',
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
                <td><span class="badge-categoria">${obterIdVisual(reg.categoria_id)}°</span></td>
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

    const catDefTitulo = CATEGORIAS.find(c => c.id === reg.categoria_id);
    titulo.textContent = `${obterIdVisual(reg.categoria_id)}° - ${catDefTitulo ? catDefTitulo.nome : reg.categoria_nome}`;

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
            } else if (chave === 'cnpj_empresa' || chave === 'tipo_inscricao') {
                ignorarExibicao = true;
            }
        }

        if (!ignorarExibicao) {
            html += `<div class="detalhe-item"><span class="detalhe-label">${label}</span><span class="detalhe-valor">${valor}</span></div>`;
        }
    });

    // Pontuação
    html += `<div style="text-align:center; margin-top:8px;"><span class="detalhe-pontuacao">+${reg.pontuacao} pontos</span></div>`;

    corpo.innerHTML = html;

    // Botão "Editar" visível para todas as categorias (edição de campos sem gerar novo documento)
    const btnEditar = overlay.querySelector('.btn-salvar');
    if (btnEditar) {
        btnEditar.style.display = 'inline-block';
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
    salvando = false; // Garante que a flag global de salvamento seja redefinida ao abrir o modal

    const reg = registroSelecionado;

    // Todas as categorias são editáveis (edição de campos sem gerar novo documento)

    const catDef = CATEGORIAS.find(c => c.id === reg.categoria_id);
    if (!catDef) {
        alert('Categoria não encontrada para edição.');
        return;
    }

    // Fechar detalhes
    fecharDetalhes();

    // RESTAURA A VARIÁVEL GLOBAL POIS fecharDetalhes() A ZEROU!
    // (Esse era o bug raiz que apagava os anexos e perdia a pontuação original)
    registroSelecionado = reg;
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
        } else if (campo.tipo === 'select_custom') {
            const storageKey = `custom_opts_${catDef.id}_${campo.nome}`;
            const customOpts = JSON.parse(localStorage.getItem(storageKey) || '[]');
            let opcoesListHTML = campo.opcoes.map(op =>
                `<div class="dropdown-item" onclick="selecionarOpcao('${campo.nome}', '${op.replace(/'/g, "\\'")}')">${op}</div>`
            ).join('');
            customOpts.forEach(op => {
                opcoesListHTML += `<div class="dropdown-item dropdown-item-custom" onclick="selecionarOpcao('${campo.nome}', '${op.replace(/'/g, "\\'")}')">
                    <span>${op}</span>
                    <button class="dropdown-delete" onclick="event.stopPropagation(); removerOpcaoCustom('${catDef.id}', '${campo.nome}', '${op.replace(/'/g, "\\'")}')">🗑</button>
                </div>`;
            });
            opcoesListHTML += `<div class="dropdown-item dropdown-item-outro" onclick="mostrarInputOutro('${campo.nome}')">Outro...</div>`;
            inputHTML = `
                <input type="hidden" id="campo-${campo.nome}" value="${valorAtual}">
                <div class="dropdown-custom" id="dropdown-${campo.nome}">
                    <div class="dropdown-trigger" onclick="toggleDropdown('${campo.nome}')">
                        <span class="dropdown-texto">${valorAtual || 'Selecione...'}</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </div>
                    <div class="dropdown-lista" id="dropdown-lista-${campo.nome}">
                        ${opcoesListHTML}
                    </div>
                </div>
                <div id="outro-container-${campo.nome}" style="display:none; margin-top:8px;">
                    <input type="text" id="outro-input-${campo.nome}" placeholder="Digite o novo motivo...">
                    <button type="button" class="btn-add-outro" onclick="adicionarOpcaoCustom('${catDef.id}', '${campo.nome}')">Adicionar</button>
                </div>`;
        } else if (campo.tipo === 'select_bairro') {
            let opcoesListHTML = `<div class="dropdown-search" style="padding: 7px; border-bottom: 1px solid #eee; background-color: #f8fafc;"><input type="text" id="search-${campo.nome}" placeholder="Pesquisar bairro..." oninput="filtrarBairros('${campo.nome}')" onclick="event.stopPropagation()" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; font-size: 0.9rem;"></div>`;
            opcoesListHTML += `<div id="lista-bairros-${campo.nome}" class="bairros-container" style="max-height: 200px; overflow-y: auto;">`;
            if (bairrosSistema.length > 0) {
                bairrosSistema.forEach(bairro => {
                    opcoesListHTML += `<div class="dropdown-item dropdown-bairro-item" onclick="selecionarOpcao('${campo.nome}', '${bairro.replace(/'/g, "\\'")}')">${bairro}</div>`;
                });
            } else {
                opcoesListHTML += `<div class="dropdown-item text-muted" style="padding: 7px;">Carregando bairros...</div>`;
            }
            opcoesListHTML += `</div>`;
            opcoesListHTML += `<div class="dropdown-item dropdown-aviso" style="background-color: #fff3cd; color: #856404; font-size: 0.85rem; border-top: 1px solid #ffeeba; cursor: default; padding: 7px; white-space: normal; line-height: 1.4;">⚠️ Caso não encontre o bairro desejado, avise o Gerente de Posturas para adicioná-lo no sistema.</div>`;
            inputHTML = `
                <input type="hidden" id="campo-${campo.nome}" value="${valorAtual}">
                <div class="dropdown-custom" id="dropdown-${campo.nome}">
                    <div class="dropdown-trigger" onclick="toggleDropdown('${campo.nome}')">
                        <span class="dropdown-texto">${valorAtual || 'Selecione o bairro...'}</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </div>
                    <div class="dropdown-lista" id="dropdown-lista-${campo.nome}">
                        ${opcoesListHTML}
                    </div>
                </div>`;
        } else if (campo.tipo === 'file') {
            // Na edição, não exibe o campo de anexo (mantém o existente no banco)
            return;
        } else {
            let extraAttr = '';
            if (campo.nome === 'cpf' || campo.nome === 'cpf_contribuinte') {
                extraAttr = ` maxlength="18" placeholder="CPF ou CNPJ" oninput="let v=this.value.replace(/\\D/g,''); if(v.length<=11){ v=v.replace(/(\\d{3})(\\d)/,'$1.$2'); v=v.replace(/(\\d{3})(\\d)/,'$1.$2'); v=v.replace(/(\\d{3})(\\d{1,2})/,'$1-$2'); } else { v=v.replace(/^(\\d{2})(\\d)/,'$1.$2'); v=v.replace(/^(\\d{2})\\.(\\d{3})(\\d)/,'$1.$2.$3'); v=v.replace(/\\.(\\d{3})(\\d)/,'.$1/$2'); v=v.replace(/(\\d{4})(\\d)/,'$1-$2'); } this.value=v;"`;
            }
            inputHTML = `<input type="${campo.tipo}" id="campo-${campo.nome}" value="${valorAtual}" ${campo.obrigatorio ? 'required' : ''} ${extraAttr}>`;
        }

        grupo.innerHTML = `
            <label for="campo-${campo.nome}">${campo.label} ${campo.obrigatorio ? '*' : ''}</label>
            ${inputHTML}
        `;

        if (campo.condicional) {
            grupo.dataset.condicionalCampo = campo.condicional.campo;
            if (campo.condicional.valor_diferente !== undefined) {
                grupo.dataset.condicionalDiferente = campo.condicional.valor_diferente;
            } else {
                grupo.dataset.condicionalValor = campo.condicional.valor;
            }
            grupo.style.display = 'none';
        }

        if (campo.agrupar) {
            let containerAgrupador = document.getElementById(`grupo-${campo.agrupar}`);
            if (!containerAgrupador) {
                const wrapper = document.createElement('div');
                wrapper.style.marginBottom = '15px';
                const labelAgrupada = document.createElement('label');
                labelAgrupada.textContent = campo.agrupar === 'inscricao' ? 'Inscrição Imobiliária Municipal' : '';
                labelAgrupada.style.fontWeight = '600';
                labelAgrupada.style.color = '#475569';
                labelAgrupada.style.display = 'block';
                labelAgrupada.style.marginBottom = '5px';

                if (campo.agrupar === 'inscricao') {
                    labelAgrupada.textContent = 'Identificação do Local';
                    const tipoInscricao = reg.campos.tipo_inscricao || 'imobiliaria';
                    const isEmpresa = tipoInscricao === 'empresa';
                    const cnpjVal = reg.campos.cnpj_empresa || '';

                    const toggleDiv = document.createElement('div');
                    toggleDiv.style.marginBottom = '10px';
                    toggleDiv.innerHTML = `
                        <label style="margin-right: 15px; font-weight: normal; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                            <input type="radio" name="tipo_inscricao_edit" value="imobiliaria" ${!isEmpresa ? 'checked' : ''} onchange="document.getElementById('grupo-inscricao').style.display='flex'; document.getElementById('grupo-cnpj-empresa').style.display='none';"> Inscrição Imobiliária Municipal
                        </label>
                        <label style="font-weight: normal; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                            <input type="radio" name="tipo_inscricao_edit" value="empresa" ${isEmpresa ? 'checked' : ''} onchange="document.getElementById('grupo-inscricao').style.display='none'; document.getElementById('grupo-cnpj-empresa').style.display='block';"> Empresa (CNPJ)
                        </label>
                    `;
                    wrapper.appendChild(labelAgrupada);
                    wrapper.appendChild(toggleDiv);

                    const cnpjDiv = document.createElement('div');
                    cnpjDiv.id = 'grupo-cnpj-empresa';
                    cnpjDiv.style.display = isEmpresa ? 'block' : 'none';
                    cnpjDiv.style.marginBottom = '10px';
                    cnpjDiv.innerHTML = `
                        <input type="text" id="campo-cnpj_empresa" class="form-control" maxlength="18" placeholder="Digite o CNPJ da Empresa" value="${cnpjVal}" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" oninput="let v=this.value.replace(/\\D/g,''); v=v.replace(/^(\\d{2})(\\d)/,'$1.$2'); v=v.replace(/^(\\d{2})\\.(\\d{3})(\\d)/,'$1.$2.$3'); v=v.replace(/\\.(\\d{3})(\\d)/,'.$1/$2'); v=v.replace(/(\\d{4})(\\d)/,'$1-$2'); this.value=v;">
                    `;
                    wrapper.appendChild(cnpjDiv);
                } else {
                    wrapper.appendChild(labelAgrupada);
                }

                containerAgrupador = document.createElement('div');
                containerAgrupador.id = `grupo-${campo.agrupar}`;
                containerAgrupador.style.display = (campo.agrupar === 'inscricao' && reg.campos.tipo_inscricao === 'empresa') ? 'none' : 'flex';
                containerAgrupador.style.gap = '10px';
                containerAgrupador.style.width = '100%';

                wrapper.appendChild(containerAgrupador);
                corpo.appendChild(wrapper);
            }
            grupo.style.flex = '1';
            grupo.style.marginBottom = '0';
            const grpLabel = grupo.querySelector('label');
            if (grpLabel) grpLabel.style.fontSize = '0.75rem';
            containerAgrupador.appendChild(grupo);
        } else {
            corpo.appendChild(grupo);
        }
    });

    // Campo especial para categoria 1.1 nos primeiros 7 dias do mês (edição)
    if ((catDef.id === '1.1' || catDef.id === '1.9') && estaNosPrimeiros7Dias()) {
        adicionarCampoDataRegistrada(corpo, reg.created_at, true);
    }

    // Garante que não haja rascunho de documento pendente de sessões anteriores
    rascunhoDocumento = null;

    // Redefine o botão salvar para evitar que fique com 'Gerar Documento' de outra categoria
    const btnSalvarForm = document.querySelector('#modal-produtividade .btn-salvar');
    if (btnSalvarForm) {
        btnSalvarForm.textContent = 'Salvar Edição';
        // Força remover o listener anterior e setar no HTML
        btnSalvarForm.onclick = null;
        btnSalvarForm.setAttribute('onclick', 'salvarEdicaoRegistro()');
    }

    aplicarCamposCondicionais();
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

        // Nota: Ao excluir um registro do histórico antigo, a numeração NÃO é devolvida
        // para a fila pública para evitar furos ou saltos fora de ordem cronológica.

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
    const outroContainer = document.getElementById(`outro-container-${campoNome}`);
    if (outroContainer) {
        outroContainer.style.display = 'none';
    }
}

function mostrarInputOutro(campoNome) {
    document.getElementById(`dropdown-lista-${campoNome}`).classList.remove('aberto');
    document.getElementById(`outro-container-${campoNome}`).style.display = 'flex';
    document.getElementById(`outro-input-${campoNome}`).focus();
    // Limpar seleção
    document.getElementById(`campo-${campoNome}`).value = '';
    document.querySelector(`#dropdown-${campoNome} .dropdown-texto`).textContent = 'Outro...';
}

window.filtrarBairros = function (campoNome) {
    const input = document.getElementById(`search-${campoNome}`);
    const filter = input.value.toLowerCase();
    const container = document.getElementById(`lista-bairros-${campoNome}`);
    if (!container) return;
    const items = container.getElementsByClassName('dropdown-bairro-item');

    for (let i = 0; i < items.length; i++) {
        let textValue = items[i].textContent || items[i].innerText;
        if (textValue.toLowerCase().indexOf(filter) > -1) {
            items[i].style.display = "";
        } else {
            items[i].style.display = "none";
        }
    }
};

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
// --- GERENCIAMENTO DE IMAGENS COM LEGENDA ---
let contadorImagensLegenda = 0;
window.adicionarCampoImagemLegenda = function () {
    contadorImagensLegenda++;
    const container = document.getElementById('lista-imagens-legenda');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'item-imagem-legenda';
    div.id = `item-imagem-legenda-${contadorImagensLegenda}`;
    div.style = 'display: flex; flex-direction: column; gap: 8px; border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; background: #f8fafc; position: relative;';

    div.innerHTML = `
        <button type="button" onclick="removerCampoImagemLegenda(${contadorImagensLegenda})" style="position: absolute; top: 5px; right: 5px; background: #ef4444; color: white; border: none; border-radius: 50%; width: 22px; height: 22px; cursor: pointer; font-weight: bold; font-size: 11px; display: flex; align-items: center; justify-content: center;" title="Remover">✕</button>
        <div style="display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 12px; font-weight: 600;">Selecione a Imagem *</label>
            <input type="file" class="imagem-arquivo" accept="image/*" required style="padding: 4px; border: 1px solid #cbd5e1; border-radius: 4px; background: white;">
        </div>
        <div style="display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 12px; font-weight: 600;">Legenda da Imagem *</label>
            <input type="text" class="imagem-legenda" placeholder="Ex: Vista frontal do imóvel..." required style="padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 13px;">
        </div>
    `;
    container.appendChild(div);
};

window.removerCampoImagemLegenda = function (id) {
    const el = document.getElementById(`item-imagem-legenda-${id}`);
    if (el) el.remove();
};

// --- NUMERAÇÃO SEQUENCIAL AUTOMÁTICA ---
async function gerarNumeroSequencial(categoriaId) {
    const anoAtual = new Date().getFullYear(); // ex: 2026

    // Ofício ('1.4' ou 'oficio') permanece 100% no banco local (controle_processual + numeros_disponiveis)
    const isOficio = (categoriaId === '1.4' || categoriaId === 'oficio' || categoriaId === 'Ofício');

    if (!isOficio) {
        // Tentar consultar a central atômica de numeração Mestre (Fluxograma)
        try {
            if (typeof window.gerarNumeroMestre === 'function') {
                const numeroMestre = await window.gerarNumeroMestre(categoriaId, anoAtual);
                if (numeroMestre) return numeroMestre;
            }
        } catch (errMestre) {
            console.warn('Aviso: Falha ao consultar Supabase Mestre, utilizando fallback local:', errMestre);
        }
    }

    // Fallback/Local para RPC local (Ofício ou quando o Mestre falhar)
    const { data: numeroSeq, error } = await supabaseClient
        .rpc('reservar_numero_sequencial', {
            p_categoria_id: categoriaId,
            p_ano: anoAtual
        });

    if (error) {
        console.error('Erro ao reservar número sequencial:', error);
        throw new Error('Falha ao gerar número sequencial: ' + error.message);
    }

    return numeroSeq;
}

/**
 * Devolve um número sequencial descartado/cancelado tanto para a central Mestre quanto para a reserva local
 */
async function devolverNumeroSequencialCompleto(categoriaId, numero, ano) {
    if (!numero || !categoriaId) return;
    const anoReg = ano || new Date().getFullYear();

    const isOficio = (categoriaId === '1.4' || categoriaId === 'oficio' || categoriaId === 'Ofício');

    // 1. Devolver no banco Mestre (Fluxograma) - exceto se for Ofício
    if (!isOficio && typeof window.devolverNumeroMestre === 'function') {
        try {
            await window.devolverNumeroMestre(categoriaId, numero);
        } catch (err) {
            console.warn('Aviso ao devolver número no Mestre:', err);
        }
    }

    // 2. Devolver no banco Local (Ofício ou Fallback)
    try {
        await supabaseClient.rpc('devolver_numero_sequencial', {
            p_numero: numero.toString(),
            p_categoria_id: categoriaId.toString(),
            p_ano: anoReg
        });
    } catch (err) {
        console.warn('Aviso ao devolver número no Local:', err);
    }
}
window.devolverNumeroSequencialCompleto = devolverNumeroSequencialCompleto;

// --- HISTÓRICO GERAL (SUB-ABAS) ---
let subAbaAtual = 'np-af';
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

    // Limpar filtros específicos de AI
    const notificacaoVal = document.getElementById('busca-notificacao-ai');
    const loteVal = document.getElementById('busca-lote-ai');
    const zonaVal = document.getElementById('busca-zona-ai');
    const quadraVal = document.getElementById('busca-quadra-ai');
    const enderecoVal = document.getElementById('busca-endereco-ai');
    if (notificacaoVal) notificacaoVal.value = '';
    if (loteVal) loteVal.value = '';
    if (zonaVal) zonaVal.value = '';
    if (quadraVal) quadraVal.value = '';
    if (enderecoVal) enderecoVal.value = '';

    // Exibir/Ocultar painel de filtros extras de AI
    const painelAI = document.getElementById('filtros-extras-ai');
    if (painelAI) {
        painelAI.style.display = (categoriaId === '1.2' || categoriaId === '1.2.MA' || categoriaId === 'ai-ma') ? 'block' : 'none';
    }

    // Exibir/Ocultar painel de filtro AI/MA
    const painelAIMA = document.getElementById('filtro-ai-ma-container');
    if (painelAIMA) {
        painelAIMA.style.display = (categoriaId === 'ai-ma') ? 'block' : 'none';
        const selectFiltroAIMA = document.getElementById('filtro-ai-ma');
        if (selectFiltroAIMA && categoriaId !== subAbaAtual) {
            selectFiltroAIMA.value = 'todos'; // reseta se trocou pra aba
        }
    }

    // Exibir/Ocultar painel de filtro Relatório/MA
    const painelRelatorioMA = document.getElementById('filtro-relatorio-ma-container');
    if (painelRelatorioMA) {
        painelRelatorioMA.style.display = (categoriaId === 'relatorio-ma') ? 'block' : 'none';
        const selectFiltroRelatorioMA = document.getElementById('filtro-relatorio-ma');
        if (selectFiltroRelatorioMA && categoriaId !== subAbaAtual) {
            selectFiltroRelatorioMA.value = 'todos';
        }
    }

    // Exibir/Ocultar painel de filtro NP/AF
    const painelNPAF = document.getElementById('filtro-np-af-container');
    if (painelNPAF) {
        painelNPAF.style.display = (categoriaId === 'np-af') ? 'block' : 'none';
        const selectFiltroNPAF = document.getElementById('filtro-np-af');
        if (selectFiltroNPAF && categoriaId !== subAbaAtual) {
            selectFiltroNPAF.value = 'todos'; // reseta se trocou pra aba
        }
    }

    atualizarIndicadorFiltro();
    carregarHistoricoGeral(categoriaId);
    atualizarVisibilidadeBotoesVencidosAtendidos();
}

let buscaIdGlobal = 0; // Para cancelar buscas sobrepostas

// Detecta registros de NP que na verdade são Autos de Infração
function pareceAutoDeInfracaoNP(reg) {
    const nNotif = (reg.campos && reg.campos.n_notificacao || '').toLowerCase().trim();
    return nNotif.includes('auto de infração') ||
        nNotif.includes('auto de infracao') ||
        nNotif.includes('auto deinfração') ||
        nNotif.includes('auto deinfracao') ||
        nNotif.includes('n.º') && nNotif.includes('auto') ||
        /^ai\s*\d/.test(nNotif) ||
        /^ai\d/.test(nNotif);
}

function normalizarBairro(texto) {
    if (!texto) return '';
    return texto
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/^bairro\s+/i, '')
        .trim();
}

async function carregarHistoricoGeral(categoriaId) {
    const container = document.getElementById('historico-geral-lista');
    if (!container) return;

    container.innerHTML = '<div class="historico-vazio">Carregando...</div>';

    // Recarregar os bairros do sistema para garantir que os filtros estejam atualizados com os bairros ativos
    await carregarBairrosSistema();

    // 1. Coleta filtros da UI
    const termo = (document.getElementById('busca-historico-geral')?.value || '').toLowerCase().trim();
    const termoFiscal = (document.getElementById('busca-fiscal-geral')?.value || '').toLowerCase().trim();
    const bairroSelecionado = document.getElementById('filtro-bairro-historico')?.value || '';
    const bairroNormalizado = normalizarBairro(bairroSelecionado);
    const anoSelecionado = document.getElementById('busca-ano-geral')?.value || '';

    // 2. Constrói Query
    let query = supabaseClient.from('controle_processual').select('*');

    // Categoria
    if (categoriaId !== 'todos') {
        if (categoriaId === 'np-af') {
            const filtroNPAF = document.getElementById('filtro-np-af')?.value || 'todos';
            if (filtroNPAF === '1.1') {
                query = query.eq('categoria_id', '1.1');
            } else if (filtroNPAF === '1.9') {
                query = query.eq('categoria_id', '1.9');
            } else {
                query = query.in('categoria_id', ['1.1', '1.9']);
            }
        } else if (categoriaId === 'ai-ma') {
            const filtroAIMA = document.getElementById('filtro-ai-ma')?.value || 'todos';
            if (filtroAIMA === '1.2') {
                query = query.eq('categoria_id', '1.2');
            } else if (filtroAIMA === '1.2.MA') {
                query = query.eq('categoria_id', '1.2.MA');
            } else {
                query = query.in('categoria_id', ['1.2', '1.2.MA']);
            }
        } else if (categoriaId === 'relatorio-ma') {
            const filtroRelatorioMA = document.getElementById('filtro-relatorio-ma')?.value || 'todos';
            if (filtroRelatorioMA === '1.5') {
                query = query.eq('categoria_id', '1.5');
            } else if (filtroRelatorioMA === '1.5.MA') {
                query = query.eq('categoria_id', '1.5.MA');
            } else {
                query = query.in('categoria_id', ['1.5', '1.5.MA']);
            }
        } else {
            query = query.eq('categoria_id', categoriaId);
        }
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

    // Filtros específicos para Auto de Infração (categoria 1.2, 1.2.MA ou ai-ma)
    if (categoriaId === '1.2' || categoriaId === '1.2.MA' || categoriaId === 'ai-ma') {
        const notificacaoVal = (document.getElementById('busca-notificacao-ai')?.value || '').trim();
        const loteVal = (document.getElementById('busca-lote-ai')?.value || '').trim();
        const zonaVal = (document.getElementById('busca-zona-ai')?.value || '').trim();
        const quadraVal = (document.getElementById('busca-quadra-ai')?.value || '').trim();
        const enderecoVal = (document.getElementById('busca-endereco-ai')?.value || '').trim();

        if (notificacaoVal) {
            query = query.ilike('campos->>n_notificacao', `%${notificacaoVal}%`);
        }
        if (loteVal) {
            query = query.ilike('campos->>inscricao_lote', `%${loteVal}%`);
        }
        if (zonaVal) {
            query = query.ilike('campos->>inscricao_zona', `%${zonaVal}%`);
        }
        if (quadraVal) {
            query = query.ilike('campos->>inscricao_quadra', `%${quadraVal}%`);
        }
        if (enderecoVal) {
            query = query.ilike('campos->>endereco_imovel', `%${enderecoVal}%`);
        }
    }

    // Busca Livre em múltiplos campos JSON + número sequencial nativo
    if (termo) {
        const camposBusca = ['n_notificacao', 'n_auto', 'n_ar', 'n_oficio', 'n_relatorio', 'n_protocolo', 'n_replica', 'n_certidao', 'nome', 'bairro', 'n_inscricao'];
        const orConditions = camposBusca.map(f => `campos->>${f}.ilike.%${termo}%`);
        orConditions.push(`numero_sequencial.ilike.%${termo}%`);
        query = query.or(orConditions.join(','));
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
        renderizarTabelaGeral(todosOsRegistros, categoriaId, `Carregando... (${todosOsRegistros.length} registros)`);

        // Busca o restante se houver (enquanto a página vier cheia)
        let temMaisPaginas = primeiroBloco && primeiroBloco.length === tamanhoPagina;
        while (temMaisPaginas) {
            contadorOffset += tamanhoPagina;
            const { data: proximoBloco, error: proximoErro } = await query.range(contadorOffset, contadorOffset + tamanhoPagina - 1);

            if (proximoErro) throw proximoErro;
            if (buscaIdLocal !== buscaIdGlobal) return; // Nova busca iniciada pelo usuário

            if (!proximoBloco || proximoBloco.length === 0) {
                temMaisPaginas = false;
                break;
            }

            todosOsRegistros = todosOsRegistros.concat(proximoBloco);

            if (proximoBloco.length < tamanhoPagina) {
                temMaisPaginas = false;
            }

            // Atualiza progresso na tela a cada bloco
            renderizarTabelaGeral(todosOsRegistros, categoriaId, `Carregando... (${todosOsRegistros.length} registros)`);
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

    // Reclassificação inteligente: NP com número de AI → tratados como AI
    if (categoriaId === '1.1' || categoriaId === 'np-af') {
        todosOsRegistros = todosOsRegistros.filter(r => !pareceAutoDeInfracaoNP(r));
    } else if (categoriaId === '1.2') {
        // Buscar registros de NP que são na verdade AI (má classificação no banco)
        let queryNP = supabaseClient.from('controle_processual').select('*').eq('categoria_id', '1.1');
        if (termoFiscal) queryNP = queryNP.ilike('fiscal_nome', `%${termoFiscal}%`);
        if (anoSelecionado) {
            queryNP = queryNP.gte('created_at', `${anoSelecionado}-01-01T00:00:00`)
                .lte('created_at', `${anoSelecionado}-12-31T23:59:59`);
        }

        const notificacaoVal = (document.getElementById('busca-notificacao-ai')?.value || '').trim();
        const loteVal = (document.getElementById('busca-lote-ai')?.value || '').trim();
        const zonaVal = (document.getElementById('busca-zona-ai')?.value || '').trim();
        const quadraVal = (document.getElementById('busca-quadra-ai')?.value || '').trim();
        const enderecoVal = (document.getElementById('busca-endereco-ai')?.value || '').trim();

        if (notificacaoVal) {
            queryNP = queryNP.ilike('campos->>n_notificacao', `%${notificacaoVal}%`);
        }
        if (loteVal) {
            queryNP = queryNP.ilike('campos->>inscricao_lote', `%${loteVal}%`);
        }
        if (zonaVal) {
            queryNP = queryNP.ilike('campos->>inscricao_zona', `%${zonaVal}%`);
        }
        if (quadraVal) {
            queryNP = queryNP.ilike('campos->>inscricao_quadra', `%${quadraVal}%`);
        }
        if (enderecoVal) {
            queryNP = queryNP.ilike('campos->>endereco_imovel', `%${enderecoVal}%`);
        }

        if (termo) {
            const camposBusca = ['n_notificacao', 'n_auto', 'n_ar', 'n_oficio', 'n_relatorio', 'n_protocolo', 'n_replica', 'n_certidao', 'nome', 'bairro', 'n_inscricao'];
            const orConditions = camposBusca.map(f => `campos->>${f}.ilike.%${termo}%`);
            orConditions.push(`numero_sequencial.ilike.%${termo}%`);
            queryNP = queryNP.or(orConditions.join(','));
        }

        try {
            const { data: registrosNP, error: erroNP } = await queryNP;
            if (!erroNP && registrosNP && registrosNP.length > 0) {
                if (buscaIdLocal !== buscaIdGlobal) return;
                const npComoAI = registrosNP.filter(r => pareceAutoDeInfracaoNP(r));
                todosOsRegistros = todosOsRegistros.concat(npComoAI);
            }
        } catch (e) {
            console.error('Erro ao buscar NP reclassificados como AI:', e);
        }
    }

    // Filtro por Bairro (client-side: ignora case, acentos e palavra "Bairro")
    if (bairroNormalizado) {
        todosOsRegistros = todosOsRegistros.filter(reg => {
            const bairroReg = normalizarBairro(reg.campos && reg.campos.bairro ? reg.campos.bairro : '');
            return bairroReg.includes(bairroNormalizado);
        });
    }

    // Ordenar final no JS
    const registrosOrdenados = todosOsRegistros.sort((a, b) => obterDataReal(b) - obterDataReal(a));
    registrosGeralAtual = registrosOrdenados;

    // Atualiza dropdown de bairros apenas se não estiver pesquisando especificamente
    if (!termo && !bairroSelecionado && !termoFiscal) {
        popularFiltroBairros(registrosOrdenados);
    }

    renderizarTabelaGeral(registrosOrdenados, categoriaId);
    atualizarVisibilidadeBotoesVencidosAtendidos();
}

// Extrai bairros únicos e preenche o dropdown
function popularFiltroBairros(registros) {
    const datalist = document.getElementById('datalist-bairros-historico');
    if (!datalist) return;

    // Limpar opções
    datalist.innerHTML = '';

    // Utilizar os bairros ativos cadastrados no sistema se estiverem disponíveis
    const fonteBairros = (bairrosSistema && bairrosSistema.length > 0)
        ? bairrosSistema
        : Array.from(new Set(registros.map(reg => reg.campos?.bairro?.trim()).filter(Boolean)));

    // Ordenar alfabeticamente e criar as tags <option>
    Array.from(fonteBairros).sort().forEach(bairro => {
        const option = document.createElement('option');
        option.value = bairro;
        datalist.appendChild(option);
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

// Fecha o painel ao clicar fora dele com um "limite invisível" de segurança
document.addEventListener('click', function (e) {
    const painel = document.getElementById('painel-filtro-popup');
    const btn = document.getElementById('btn-filtro-toggle');
    if (!painel || !btn) return;

    // Só atua se o painel estiver aberto
    if (painel.style.display !== 'block') return;

    if (!painel.contains(e.target) && !btn.contains(e.target)) {
        // Obter as dimensões do painel na tela
        const rect = painel.getBoundingClientRect();
        // Define o limite invisível em pixels (ex: 80px para cada lado)
        const limiteInvisivel = 90;

        // Verifica se o clique ocorreu dentro dessa "bolha" invisível
        if (
            e.clientX >= (rect.left - limiteInvisivel) &&
            e.clientX <= (rect.right + limiteInvisivel) &&
            e.clientY >= (rect.top - limiteInvisivel) &&
            e.clientY <= (rect.bottom + limiteInvisivel)
        ) {
            // Clique foi perto do modal, então não fecha
            return;
        }

        painel.style.display = 'none';
        if (typeof atualizarIndicadorFiltro === 'function') atualizarIndicadorFiltro();
    }
});

// Limpa todos os filtros e atualiza a tabela
function limparFiltrosHistorico() {
    const inputFiscal = document.getElementById('busca-fiscal-geral');
    const selectBairro = document.getElementById('filtro-bairro-historico');
    const selectAno = document.getElementById('busca-ano-geral');
    const notificacaoVal = document.getElementById('busca-notificacao-ai');
    const loteVal = document.getElementById('busca-lote-ai');
    const zonaVal = document.getElementById('busca-zona-ai');
    const quadraVal = document.getElementById('busca-quadra-ai');
    const enderecoVal = document.getElementById('busca-endereco-ai');

    if (inputFiscal) inputFiscal.value = '';
    if (selectBairro) selectBairro.value = '';
    if (selectAno) selectAno.value = '';
    if (notificacaoVal) notificacaoVal.value = '';
    if (loteVal) loteVal.value = '';
    if (zonaVal) zonaVal.value = '';
    if (quadraVal) quadraVal.value = '';
    if (enderecoVal) enderecoVal.value = '';

    filtrarHistoricoGeral();
    atualizarIndicadorFiltro();
}

// Mostra um ponto vermelho no botão Filtro se algum filtro estiver ativo
function atualizarIndicadorFiltro() {
    const btn = document.getElementById('btn-filtro-toggle');
    if (!btn) return;
    const inputFiscal = document.getElementById('busca-fiscal-geral');
    const selectBairro = document.getElementById('filtro-bairro-historico');
    const selectAno = document.getElementById('busca-ano-geral');
    const notificacaoVal = document.getElementById('busca-notificacao-ai');
    const loteVal = document.getElementById('busca-lote-ai');
    const zonaVal = document.getElementById('busca-zona-ai');
    const quadraVal = document.getElementById('busca-quadra-ai');
    const enderecoVal = document.getElementById('busca-endereco-ai');

    const temFiltro = (inputFiscal && inputFiscal.value.trim()) ||
        (selectBairro && selectBairro.value) ||
        (selectAno && selectAno.value) ||
        (notificacaoVal && notificacaoVal.value.trim()) ||
        (loteVal && loteVal.value.trim()) ||
        (zonaVal && zonaVal.value.trim()) ||
        (quadraVal && quadraVal.value.trim()) ||
        (enderecoVal && enderecoVal.value.trim());

    btn.innerHTML = temFiltro
        ? 'Filtro <span style="width:8px;height:8px;background:#10b981;border-radius:50%;display:inline-block;"></span>'
        : 'Filtro';
}

function classeColunaHistorico(label) {
    if (!label) return '';
    const l = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const curtas = ['n°', 'nº', 'numero', 'data', 'pontos', 'prazo', 'valor', 'zona', 'quadra', 'lote', 'area', 'anexo', 'fiscal', 'tipo', 'identificador', 'status'];
    if (curtas.some(p => l.includes(p))) return 'col-curta';
    return '';
}

function renderizarTh(label) {
    const abbrMap = {
        'N° da Notificação': 'N°',
        'Nº da notificação': 'N°'
    };
    const abbr = abbrMap[label];
    if (abbr) {
        return `<span class="th-full">${label}</span><span class="th-abbr">${abbr}</span>`;
    }
    return label;
}

function renderizarTd(conteudo, classe) {
    const isCurta = classe && classe.includes('col-curta');
    const minW = isCurta ? '70px' : '100px';
    const maxW = isCurta ? '140px' : '200px';
    return `<td${isCurta ? ` class="${classe}"` : ''}><span style="display:inline-block;min-width:${minW};max-width:${maxW};word-break:break-all;white-space:normal;">${conteudo}</span></td>`;
}

function renderizarTabelaGeral(registros, categoriaId, statusExtra = '') {
    const container = document.getElementById('historico-geral-lista');
    // Usar nova hierarquia de permissões: Gerente, Diretor e Secretário podem ver anexos
    const roleLower = (window.userRoleGlobal || '').toLowerCase();
    const isFiscal = roleLower === 'fiscal' || (roleLower.includes('fiscal') && roleLower.includes('postura')) || (roleLower.includes('fiscal') && roleLower.includes('meio') && roleLower.includes('ambiente'));
    const isGerenteAdministrativo = isGerenteOuSuperior(window.userRoleGlobal) || roleLower.includes('administrativo') || roleLower.includes('administrador');

    // Todos (Fiscais, Gerentes e Admins) podem ver a coluna
    const podeVerAnexos = isGerenteAdministrativo || isFiscal;

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

            if (vResposta.toLowerCase().includes('atendido') || vResposta.toLowerCase().includes('atendida')) qtdVerde++;
            if (vHistoricoInfo !== '') qtdVermelha++;
            if (dtVencimentoVencida && vResposta === '') qtdCinza++;
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
                            interaction: {
                                mode: 'index',
                                intersect: false,
                            },
                            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
                            plugins: { legend: { display: false } }
                        }
                    });
                }
            }, 150);
        }
    };

    if (categoriaId === 'todos') {
        let headerHTML = '<tr><th class="col-curta">Tipo de Documento</th><th>Identificador / Nome</th><th class="col-curta">Fiscal</th><th class="col-curta">Data</th><th class="col-curta">Pontos</th>';
        if (podeVerAnexos) headerHTML += '<th class="col-curta">Anexo</th>';
        headerHTML += '</tr>';

        let bodyHTML = '';
        registros.forEach((reg) => {
            let nomeCategoria = 'Desconhecido';
            switch (reg.categoria_id) {
                case '1.1': nomeCategoria = 'Controle Processual: NP'; break;
                case '1.2': nomeCategoria = 'Controle Processual: Auto Infração'; break;
                case '1.3': nomeCategoria = 'Controle Processual: AR'; break;
                case '1.4': nomeCategoria = 'Controle Processual: Ofício'; break;
                case '1.5':
                case '1.5.MA': nomeCategoria = 'Controle Processual: Relatório de Vistoria'; break;
                case '1.6': nomeCategoria = 'Controle Processual: Protocolo'; break;
                case '1.7': nomeCategoria = 'Réplica'; break;
                case '1.8': nomeCategoria = 'Certidão'; break;
                case '11': nomeCategoria = 'Controle Processual: Dívida Ativa'; break;
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
            if (['1.1', '1.2', '1.2.MA', '1.3', '1.4', '1.5', '1.5.MA', '1.6', '1.7', '1.9', '11'].includes(reg.categoria_id)) {
                rowAttributes = ` style="background:${bgColor}; cursor:pointer; transition: background 0.2s;" onmouseover="this.dataset.baseBg='${bgColor}'; this.style.background='${hoverColor}'" onmouseout="this.style.background=this.dataset.baseBg || '${bgColor}'" onclick="if(event.target.tagName !== 'BUTTON') abrirDetalhesAdminHist('${reg.id}')" title="Clique para mais detalhes"`;
            } else {
                rowAttributes = ` style="background:${bgColor}; transition: background 0.2s;" onmouseover="this.dataset.baseBg='${bgColor}'; this.style.background='${hoverColor}'" onmouseout="this.style.background=this.dataset.baseBg || '${bgColor}'"`;
            }

            bodyHTML += `<tr${rowAttributes}>`;
            bodyHTML += renderizarTd(`<span style="background:#10b981; color:#ffffff; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:600; box-shadow:0 1px 2px rgba(0,0,0,0.1);">${nomeCategoria}</span>`, 'col-curta');
            bodyHTML += renderizarTd(identificador, '');
            bodyHTML += renderizarTd(reg.fiscal_nome, 'col-curta') + renderizarTd(dataFormatada, 'col-curta') + renderizarTd(reg.pontuacao, 'col-curta');

            if (podeVerAnexos) {
                let primeiroArUrl = '';
                if (reg.campos && reg.campos.anexo_ar) {
                    if (Array.isArray(reg.campos.anexo_ar) && reg.campos.anexo_ar.length > 0) {
                        primeiroArUrl = typeof reg.campos.anexo_ar[0] === 'string' ? reg.campos.anexo_ar[0] : reg.campos.anexo_ar[0].url;
                    } else if (typeof reg.campos.anexo_ar === 'string') {
                        primeiroArUrl = reg.campos.anexo_ar;
                    }
                }
                const temAnexoAR = !!primeiroArUrl;
                let anexoHTML = '';

                const pertenceLogado = pertenceAoFiscalLogado(reg);
                const temPermissaoAnexo = isGerenteAdministrativo || (isFiscal && pertenceLogado);

                if (temPermissaoAnexo) {
                    if (temAnexo) {
                        anexoHTML += `<button onclick="abrirAnexoGerente('${reg.campos.anexo_pdf}')" style="background:#10b981;color:white;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;display:block;margin:0 auto;">📄 Ver</button>`;
                    }
                    if (temAnexoAR) {
                        anexoHTML += `<button onclick="abrirAnexoGerente('${primeiroArUrl}')" style="background:#3b82f6;color:white;border:none;padding:3px 8px;border-radius:5px;cursor:pointer;font-size:11px;font-weight:600;display:block;margin:${temAnexo ? '6px' : '0'} auto 0 auto;width:90%;">📄 AR</button>`;
                    }
                } else {
                    if (temAnexo || temAnexoAR) {
                        anexoHTML = `<span title="Acesso restrito ao responsável" style="color:#cbd5e1;font-size:16px;cursor:help;">🔒</span>`;
                    }
                }

                if (anexoHTML !== '') {
                    bodyHTML += `<td style="vertical-align:middle; text-align:center;">${anexoHTML}</td>`;
                } else {
                    bodyHTML += `<td style="color:#94a3b8;font-size:12px;vertical-align:middle;text-align:center;">—</td>`;
                }
            }
            bodyHTML += '</tr>';
        });

        const wrapperId = 'hist-wrapper-' + Date.now();
        container.innerHTML = `
            ${graficoHTML}
            <div id="${wrapperId}" style="position:relative;">
                <div class="historico-scroll-top" style="position:sticky; top:0; z-index:20; overflow-x:auto; overflow-y:hidden; height:14px; background:#fff; border-bottom:1px solid #e2e8f0; scrollbar-width:thin;">
                    <div class="historico-scroll-dummy" style="height:1px;"></div>
                </div>
                <div class="historico-scroll-bottom" style="overflow-x:auto; overflow-y:visible;">
                    <table class="historico-tabela">
                        <thead>${headerHTML}</thead>
                        <tbody>${bodyHTML}</tbody>
                    </table>
                </div>
            </div>
            <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center;">
                <p style="font-size: 0.85rem; color: #64748b;">
                    Total: ${registros.length} registro(s)
                </p>
                ${statusExtra ? `<p style="font-size: 0.85rem; color: #10b981; font-weight: 600;">${statusExtra}</p>` : ''}
            </div>
        `;
        setTimeout(function () {
            sincronizarScrollHistorico(wrapperId);
        }, 0);
        renderizarChart();
        return;
    }

    let categoria = CATEGORIAS.find(c => c.id === categoriaId);
    if (!categoria && categoriaId === 'np-af') {
        categoria = CATEGORIAS.find(c => c.id === '1.1');
    }
    if (!categoria && categoriaId === 'ai-ma') {
        categoria = CATEGORIAS.find(c => c.id === '1.2');
    }
    if (!categoria && categoriaId === 'relatorio-ma') {
        categoria = CATEGORIAS.find(c => c.id === '1.5');
    }
    if (!categoria) return;

    // Colunas: Nº (se tiver), campos da categoria + Fiscal + Data
    const temNumero = registros.some(r => r.numero_sequencial || (pareceAutoDeInfracaoNP(r) && r.campos && r.campos.n_notificacao));

    let headerHTML = '<tr>';
    if (temNumero) headerHTML += '<th class="col-curta" style="min-width: 95px;">N°</th>';
    categoria.campos.forEach(campo => {
        if (campo.tipo !== 'date' && campo.tipo !== 'file' && !campo.ignorarNoBanco) {
            if ((categoriaId === 'np-af' || categoriaId === '1.1') && campo.nome === 'n_notificacao') return;
            const cls = classeColunaHistorico(campo.label);
            headerHTML += `<th${cls ? ` class="${cls}"` : ''}>${renderizarTh(campo.label)}</th>`;
        }
    });
    headerHTML += '<th class="col-curta">Fiscal</th><th class="col-curta">Data</th><th class="col-curta">Pontos</th>';
    if (podeVerAnexos) headerHTML += '<th class="col-curta">Anexo</th>';
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
        if (['1.1', '1.2', '1.2.MA', '1.3', '1.4', '1.5', '1.5.MA', '1.6', '1.7', '1.9', '11'].includes(categoria.id) || categoriaId === 'np-af' || categoriaId === 'ai-ma' || categoriaId === 'relatorio-ma') {
            rowAttributes = ` style="background:${bgColor}; cursor:pointer; transition: background 0.2s;" onmouseover="this.dataset.baseBg='${bgColor}'; this.style.background='${hoverColor}'" onmouseout="this.style.background=this.dataset.baseBg || '${bgColor}'" onclick="if(event.target.tagName !== 'BUTTON') abrirDetalhesAdminHist('${reg.id}')" title="Clique para mais detalhes"`;
        } else {
            rowAttributes = ` style="background:${bgColor}; transition: background 0.2s;" onmouseover="this.dataset.baseBg='${bgColor}'; this.style.background='${hoverColor}'" onmouseout="this.style.background=this.dataset.baseBg || '${bgColor}'"`;
        }
        bodyHTML += `<tr${rowAttributes}>`;
        if (temNumero) {
            let numExibido = '-';
            if (reg.categoria_id === '1.1') {
                numExibido = 'NP ' + (reg.numero_sequencial || (reg.campos && reg.campos.n_notificacao) || '-');
            } else if (reg.categoria_id === '1.9') {
                numExibido = 'AF ' + (reg.numero_sequencial || '-');
            } else if (reg.categoria_id === '1.2.MA') {
                numExibido = 'MA-AI ' + (reg.numero_sequencial || '-');
            } else if (reg.categoria_id === '1.2') {
                numExibido = 'AI ' + (reg.numero_sequencial || (pareceAutoDeInfracaoNP(reg) && reg.campos && reg.campos.n_notificacao) || '-');
            } else if (reg.categoria_id === '1.3') {
                numExibido = 'AR ' + (reg.numero_sequencial || '-');
            } else if (reg.categoria_id === '1.4') {
                numExibido = 'OF ' + (reg.numero_sequencial || '-');
            } else if (reg.categoria_id === '1.5' || reg.categoria_id === '1.5.MA') {
                numExibido = 'RV ' + (reg.numero_sequencial || '-');
            } else if (reg.categoria_id === '1.6') {
                numExibido = 'PROT ' + (reg.numero_sequencial || '-');
            } else if (reg.categoria_id === '1.7') {
                numExibido = 'REP ' + (reg.numero_sequencial || '-');
            } else if (reg.categoria_id === '1.8') {
                numExibido = 'CERT ' + (reg.numero_sequencial || '-');
            } else if (reg.categoria_id === '11') {
                numExibido = 'DA ' + (reg.numero_sequencial || '-');
            } else {
                numExibido = reg.numero_sequencial || (pareceAutoDeInfracaoNP(reg) && reg.campos && reg.campos.n_notificacao) || '-';
            }
            bodyHTML += renderizarTd(numExibido, 'col-curta');
        }
        categoria.campos.forEach(campo => {
            if (campo.tipo !== 'date' && campo.tipo !== 'file' && !campo.ignorarNoBanco) {
                if ((categoriaId === 'np-af' || categoriaId === '1.1') && campo.nome === 'n_notificacao') return;
                const cls = classeColunaHistorico(campo.label);
                bodyHTML += renderizarTd(reg.campos[campo.nome] || '-', cls);
            }
        });
        const dataFormatada = obterDataReal(reg).toLocaleDateString('pt-BR');
        bodyHTML += renderizarTd(reg.fiscal_nome, 'col-curta') + renderizarTd(dataFormatada, 'col-curta') + renderizarTd(reg.pontuacao, 'col-curta');

        if (podeVerAnexos) {
            let primeiroArUrl = '';
            if (reg.campos && reg.campos.anexo_ar) {
                if (Array.isArray(reg.campos.anexo_ar) && reg.campos.anexo_ar.length > 0) {
                    primeiroArUrl = typeof reg.campos.anexo_ar[0] === 'string' ? reg.campos.anexo_ar[0] : reg.campos.anexo_ar[0].url;
                } else if (typeof reg.campos.anexo_ar === 'string') {
                    primeiroArUrl = reg.campos.anexo_ar;
                }
            }
            const temAnexoAR = !!primeiroArUrl;
            let anexoHTML = '';

            const pertenceLogado = pertenceAoFiscalLogado(reg);
            const temPermissaoAnexo = isGerenteAdministrativo || (isFiscal && pertenceLogado);

            if (temPermissaoAnexo) {
                if (temAnexo) {
                    anexoHTML += `<button onclick="abrirAnexoGerente('${reg.campos.anexo_pdf}')" style="background:#10b981;color:white;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;display:block;margin:0 auto;">📄 Ver</button>`;
                }
                if (temAnexoAR) {
                    anexoHTML += `<button onclick="abrirAnexoGerente('${primeiroArUrl}')" style="background:#3b82f6;color:white;border:none;padding:3px 8px;border-radius:5px;cursor:pointer;font-size:11px;font-weight:600;display:block;margin:${temAnexo ? '6px' : '0'} auto 0 auto;width:90%;">📄 AR</button>`;
                }
            } else {
                if (temAnexo || temAnexoAR) {
                    anexoHTML = `<span title="Acesso restrito ao responsável" style="color:#cbd5e1;font-size:16px;cursor:help;">🔒</span>`;
                }
            }

            if (anexoHTML !== '') {
                bodyHTML += `<td style="vertical-align:middle; text-align:center;">${anexoHTML}</td>`;
            } else {
                bodyHTML += `<td style="color:#94a3b8;font-size:12px;vertical-align:middle;text-align:center;">—</td>`;
            }
        }
        bodyHTML += '</tr>';
    });

    const wrapperId = 'hist-wrapper-' + Date.now();
    container.innerHTML = `
        ${graficoHTML}
        <div id="${wrapperId}" style="position:relative;">
            <div class="historico-scroll-top" style="position:sticky; top:0; z-index:20; overflow-x:auto; overflow-y:hidden; height:14px; background:#fff; border-bottom:1px solid #e2e8f0; scrollbar-width:thin;">
                <div class="historico-scroll-dummy" style="height:1px;"></div>
            </div>
            <div class="historico-scroll-bottom" style="overflow-x:auto; overflow-y:visible;">
                <table class="historico-tabela">
                    <thead>${headerHTML}</thead>
                    <tbody>${bodyHTML}</tbody>
                </table>
            </div>
        </div>
        <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center;">
            <p style="font-size: 0.85rem; color: #64748b;">
                Total: ${registros.length} registro(s)
            </p>
            ${statusExtra ? `<p style="font-size: 0.85rem; color: #10b981; font-weight: 600;">${statusExtra}</p>` : ''}
        </div>
    `;
    setTimeout(function () {
        sincronizarScrollHistorico(wrapperId);
    }, 0);
    renderizarChart();
}

function sincronizarScrollHistorico(wrapperId) {
    var wrapper = document.getElementById(wrapperId);
    if (!wrapper) return;
    var scrollTop = wrapper.querySelector('.historico-scroll-top');
    var scrollBottom = wrapper.querySelector('.historico-scroll-bottom');
    var dummy = wrapper.querySelector('.historico-scroll-dummy');
    var table = wrapper.querySelector('table');
    if (!scrollTop || !scrollBottom || !dummy || !table) return;

    dummy.style.width = table.scrollWidth + 'px';

    scrollTop.addEventListener('scroll', function () {
        scrollBottom.scrollLeft = scrollTop.scrollLeft;
    });

    scrollBottom.addEventListener('scroll', function () {
        scrollTop.scrollLeft = scrollBottom.scrollLeft;
    });
}

window.sincronizarScrollsModais = function () {
    const wrappers = document.querySelectorAll('.scroll-sync-wrapper');
    wrappers.forEach(wrapper => {
        if (wrapper.dataset.synced === 'true') return;
        wrapper.dataset.synced = 'true';

        var top = wrapper.querySelector('.historico-scroll-top');
        var bot = wrapper.querySelector('.historico-scroll-bottom');
        var dummy = wrapper.querySelector('.historico-scroll-dummy');
        var table = wrapper.querySelector('table');

        if (!top || !bot || !dummy || !table) return;

        dummy.style.width = table.scrollWidth + 'px';

        const ro = new ResizeObserver(() => {
            if (table.scrollWidth > 0) {
                dummy.style.width = table.scrollWidth + 'px';
            }
        });
        ro.observe(table);
        ro.observe(wrapper);

        top.addEventListener('scroll', function () {
            bot.scrollLeft = top.scrollLeft;
        });

        bot.addEventListener('scroll', function () {
            top.scrollLeft = bot.scrollLeft;
        });
    });
};

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

    if (campos.anexo_pdf) {
        htmlCampos += `<div style="margin-bottom:8px;">
            <strong>Anexo (Documento PDF):</strong> 
            <a href="${campos.anexo_pdf}" target="_blank" style="color:#0ea5e9; font-weight:600; text-decoration:underline;">📄 Visualizar Documento</a>
        </div>`;
    }

    Object.entries(campos).forEach(([chave, valor]) => {
        if (!valor || chave.startsWith('anexo_') || chave === 'data_entrada' || chave === 'data_vencimento' || chave === 'data_vencimento_original' || chave === 'data_dilacao' || chave === 'data_dilacao_anterior' || chave === 'historico_admin' || chave === 'resposta_fiscal' || chave === 'ar' || chave === 'doc_id' || chave === 'notif_id' || chave === 'proc_id' || chave === 'auto_id' || chave === 'processo_id' || chave === 'sincronizado' || chave === 'origem' || chave === 'data_sincronizacao' || chave === '_created_at') return;
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
                <label style="display:block; font-weight:600; margin-bottom:4px; font-size:14px; color:#3b82f6;">Data de recebimento pelo proprietário: (Admin)</label>
                <input type="date" id="admin-data-entrada" value="${vEntrada}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; outline:none;">
            </div>`;
            if (campos.data_vencimento_original) {
                const vVencOrig = campos.data_vencimento_original.split('-').reverse().join('/');
                htmlCampos += `<div style="margin-bottom:12px; font-size:14px; color:#475569;">
                    <strong>Data de Vencimento Antes da Dilação de Prazo:</strong> ${vVencOrig}
                </div>`;
            }
            htmlCampos += `<div style="margin-bottom:12px;">
                <label style="display:block; font-weight:600; margin-bottom:4px; font-size:14px; color:#3b82f6;">Data de Vencimento (Admin)</label>
                <input type="date" id="admin-data-vencimento" value="${vVencimento}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; outline:none;">
            </div>`;
            htmlCampos += `<div style="margin-bottom:12px;">
                <label style="display:block; font-weight:600; margin-bottom:4px; font-size:14px; color:#3b82f6;">AR (Admin)</label>
                <input type="text" id="admin-ar" value="${vAR}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; outline:none;">
            </div>`;
            if (campos.anexo_ar) {
                let listaAR = Array.isArray(campos.anexo_ar) ? campos.anexo_ar : [{ url: campos.anexo_ar, data: null }];
                if (listaAR.length > 0) {
                    htmlCampos += `<div style="margin-bottom:12px;">
                        <label style="display:block; font-weight:600; margin-bottom:4px; font-size:14px; color:#3b82f6;">Anexos do AR Atuais</label>`;
                    listaAR.forEach((ar, idx) => {
                        const valUrl = typeof ar === 'string' ? ar : ar.url;
                        const valData = (typeof ar === 'object' && ar.data) ? ` (${ar.data.split('-').reverse().join('/')})` : '';
                        htmlCampos += `<div id="container-anexo-ar-${idx}" style="margin-bottom:8px; font-size:13px; display:flex; align-items:center; gap:8px; background:#f8fafc; padding:6px; border-radius:4px; border:1px solid #e2e8f0;">
                            <a href="${valUrl}" target="_blank" style="color:#0ea5e9; text-decoration:underline; font-weight:600;">Ver anexo do AR ${idx + 1}${valData}</a>
                            <button onclick="document.getElementById('container-anexo-ar-${idx}').style.display='none'; document.getElementById('admin-remover-anexo-ar-${idx}').checked = true;" title="Remover anexo" style="background:#ef4444; color:white; border:none; border-radius:50%; width:20px; height:20px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-weight:bold; font-size:12px; line-height:1; transition:0.2s;">✕</button>
                            <input type="checkbox" id="admin-remover-anexo-ar-${idx}" class="remover-ar-checkbox" value="${idx}" style="display:none;">
                        </div>`;
                    });
                    htmlCampos += `</div>`;
                }
            }
            htmlCampos += `<div style="margin-bottom:12px; padding:10px; border:1px dashed #cbd5e1; border-radius:6px; background:#f8fafc;">
                <label style="display:block; font-weight:600; margin-bottom:8px; font-size:14px; color:#3b82f6;">Adicionar Novo Anexo do AR</label>
                <div style="display:flex; gap:10px; margin-bottom:8px;">
                    <div style="flex:1;">
                        <label style="font-size:12px; color:#64748b; margin-bottom:4px; display:block;">Data do AR</label>
                        <input type="date" id="admin-novo-ar-data" style="width:100%; padding:6px; border:1px solid #cbd5e1; border-radius:4px; outline:none;">
                    </div>
                </div>
                <input type="file" id="admin-anexo-ar" accept=".png,.jpg,.jpeg,.doc,.docx,.pdf" multiple capture="environment" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; outline:none; background:white;">
                <div style="font-size:11px; color:#64748b; margin-top:4px;">Pode selecionar mais de uma imagem para gerar PDF.</div>
            </div>`;
            htmlCampos += `<div style="margin-bottom:12px;">
                <label style="display:block; font-weight:600; margin-bottom:4px; font-size:14px; color:#3b82f6;">Histórico (Admin)</label>
                <textarea id="admin-historico-texto" rows="3" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; outline:none; font-family:inherit;">${vHistorico}</textarea>
            </div>`;
        } else {
            htmlCampos += `<div style="margin-bottom:8px;"><strong>Data de recebimento pelo proprietário:</strong> ${vEntrada ? vEntrada.split('-').reverse().join('/') : '—'}</div>`;

            if (campos.data_vencimento_original) {
                const vVencOrig = campos.data_vencimento_original.split('-').reverse().join('/');
                const vDilacao = vVencimento ? vVencimento.split('-').reverse().join('/') : '—';
                htmlCampos += `<div style="margin-bottom:8px;"><strong>Data de Vencimento Original:</strong> ${vVencOrig}</div>`;
                htmlCampos += `<div style="margin-bottom:8px; color:#8b5cf6;"><strong>Dilação de Prazo:</strong> ${vDilacao}`;
                if (campos.data_dilacao_anterior) {
                    const ant = campos.data_dilacao_anterior.split('-').reverse().join('/');
                    htmlCampos += `<br><span style="font-size:11px; color:#64748b;">(Editado: ${ant})</span>`;
                }
                htmlCampos += `</div>`;
            } else {
                htmlCampos += `<div style="margin-bottom:8px;"><strong>Data de Vencimento:</strong> ${vVencimento ? vVencimento.split('-').reverse().join('/') : '—'}</div>`;
            }

            htmlCampos += `<div style="margin-bottom:8px;"><strong>AR:</strong> ${vAR || '—'}</div>`;
            if (campos.anexo_ar) {
                let listaAR = Array.isArray(campos.anexo_ar) ? campos.anexo_ar : [{ url: campos.anexo_ar, data: null }];
                if (listaAR.length > 0) {
                    htmlCampos += `<div style="margin-bottom:8px;"><strong>Anexos AR:</strong><br>`;
                    listaAR.forEach((ar, idx) => {
                        const valUrl = typeof ar === 'string' ? ar : ar.url;
                        const valData = (typeof ar === 'object' && ar.data) ? ` (${ar.data.split('-').reverse().join('/')})` : '';
                        htmlCampos += `<a href="${valUrl}" target="_blank" style="color:#0ea5e9; text-decoration:underline; display:block; margin-top:4px; padding-left:8px;">↳ Visualizar Arquivo AR ${idx + 1}${valData}</a>`;
                    });
                    htmlCampos += `</div>`;
                }
            }
            htmlCampos += `<div style="margin-bottom:8px; white-space:pre-wrap;"><strong>Histórico Administrativo:</strong> ${vHistorico || '—'}</div>`;
        }

        if (isDono) {
            // Prepara visualização de toggle para a resposta
            let dataAtendimento = '';
            let isAtendidoComData = false;
            if (vResposta && vResposta.startsWith('ATENDIDO - ')) {
                isAtendidoComData = true;
                dataAtendimento = vResposta.substring('ATENDIDO - '.length);
            }
            const isOpcaoPadrao = vResposta === 'ATENDIDO' || vResposta === '' || isAtendidoComData;
            const hojeStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

            htmlCampos += `<div style="margin-bottom:12px;">
                <label style="display:block; font-weight:600; margin-bottom:4px; font-size:14px; color:#10b981;">Sua Resposta</label>
                <select id="admin-resposta-select" onchange="
                    const t = document.getElementById('admin-resposta-text-container');
                    const d = document.getElementById('admin-resposta-data-container');
                    if(this.value === 'Outro') {
                        t.style.display = 'block';
                        d.style.display = 'none';
                        document.getElementById('admin-resposta-fiscal').value = '';
                    } else if(this.value === 'ATENDIDO') {
                        t.style.display = 'none';
                        d.style.display = 'block';
                        const dataInput = document.getElementById('admin-resposta-data');
                        if(!dataInput.value) dataInput.value = '${hojeStr}';
                    } else {
                        t.style.display = 'none';
                        d.style.display = 'none';
                        document.getElementById('admin-resposta-fiscal').value = '';
                        document.getElementById('admin-resposta-data').value = '';
                    }
                " style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; outline:none; margin-bottom:8px; background:white;">
                    <option value="">Selecione...</option>
                    <option value="ATENDIDO" ${(vResposta === 'ATENDIDO' || isAtendidoComData) ? 'selected' : ''}>ATENDIDO</option>
                    <option value="Outro" ${(!isOpcaoPadrao) ? 'selected' : ''}>Outro (Escrever manual...)</option>
                </select>
                <div id="admin-resposta-data-container" style="display:${(vResposta === 'ATENDIDO' || isAtendidoComData) ? 'block' : 'none'};">
                    <label style="display:block; font-size:13px; color:#64748b; margin-bottom:3px;">Data do atendimento</label>
                    <input type="text" id="admin-resposta-data" value="${dataAtendimento}" placeholder="dd/mm/aa" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; outline:none; font-family:inherit;">
                </div>
                <div id="admin-resposta-text-container" style="display:${!isOpcaoPadrao ? 'block' : 'none'};">
                    <textarea id="admin-resposta-fiscal" rows="3" placeholder="Digite sua resposta personalizada..." style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; outline:none; font-family:inherit;">${(!isOpcaoPadrao) ? vResposta : ''}</textarea>
                </div>
            </div>`;
        } else {
            htmlCampos += `<div style="margin-bottom:8px; white-space:pre-wrap;"><strong>Resposta do Fiscal:</strong> ${vResposta || '—'}</div>`;
        }

        if (isDono) {
            htmlCampos += `<div style="margin-top:20px; border-top:1px dashed #cbd5e1; padding-top:16px;">`;

            if (reg.categoria_id !== '1.2' && reg.categoria_id !== '1.2.MA') {
                htmlCampos += `
                <h4 style="margin-bottom:12px; color:#8b5cf6; font-size:15px;">Dilação de Prazo</h4>
                <p style="font-size:11px; color:#64748b; margin-bottom:8px; margin-top:0;">Caso queira dilatar o prazo de vencimento, informe a nova data abaixo. A data original será preservada no histórico.</p>
                <input type="date" id="dono-dilacao-prazo" value="${campos.data_dilacao || ''}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; outline:none; margin-bottom:${campos.data_dilacao_anterior ? '4px' : '20px'};">`;

                if (campos.data_dilacao_anterior) {
                    const ant = campos.data_dilacao_anterior.split('-').reverse().join('/');
                    htmlCampos += `<p style="font-size:11px; color:#ef4444; margin-top:0; margin-bottom:20px;">Editado: ${ant}</p>`;
                }
            }

            htmlCampos += `
                <h4 style="margin-bottom:12px; color:#1e293b; font-size:15px;">Gerenciar Documentos</h4>`;

            // Anexo Principal
            htmlCampos += `<div style="margin-bottom:12px; padding:10px; background:#f8fafc; border-radius:6px; border:1px solid #e2e8f0;">
                <strong style="display:block; font-size:13px; color:#475569; margin-bottom:6px;">Documento Principal:</strong>`;
            if (campos.anexo_pdf) {
                htmlCampos += `<div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                    <a href="${campos.anexo_pdf}" target="_blank" style="color:#2563eb; font-size:14px; font-weight:500; text-decoration:underline;">Ver anexo atual</a>
                    <span style="font-size:11px; color:#94a3b8;">(Para substituir, envie um novo abaixo)</span>
                </div>`;
                htmlCampos += `<input type="file" id="dono-substituir-doc" accept=".pdf,.doc,.docx" style="width:100%; font-size:13px;">`;
            } else {
                htmlCampos += `<p style="font-size:12px; color:#ef4444; margin:0 0 6px 0;">Nenhum documento principal anexado.</p>`;
                htmlCampos += `<input type="file" id="dono-novo-doc" accept=".pdf,.doc,.docx" style="width:100%; font-size:13px;">`;
            }
            htmlCampos += `</div>`;

            // Anexos Extras
            let anexosExtras = campos.anexos_extras || [];
            htmlCampos += `<div style="margin-bottom:12px; padding:10px; background:#f8fafc; border-radius:6px; border:1px solid #e2e8f0;">
                <strong style="display:block; font-size:13px; color:#475569; margin-bottom:6px;">Documentos Adicionais:</strong>`;
            if (anexosExtras.length > 0) {
                // Regra: pode remover um anexo extra desde que o registro continue com pelo menos 1 documento
                // (anexo principal ou outro extra)
                const temDocPrincipal = !!campos.anexo_pdf;
                anexosExtras.forEach((urlExtra, i) => {
                    const podeRemover = (anexosExtras.length > 1) || (anexosExtras.length === 1 && temDocPrincipal);
                    htmlCampos += `<div id="cont-extra-${i}" style="display:flex; align-items:center; gap:8px; margin-bottom:6px; background:white; padding:6px; border-radius:4px; border:1px solid #cbd5e1;">
                        <a href="${urlExtra}" target="_blank" style="color:#2563eb; font-size:13px; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">Anexo Extra ${i + 1}</a>
                        ${podeRemover ? `<button onclick="document.getElementById('remover-extra-${i}').checked=true; document.getElementById('cont-extra-${i}').style.display='none';" style="background:#fef2f2; color:#ef4444; border:1px solid #fca5a5; border-radius:4px; padding:4px 8px; font-size:11px; cursor:pointer;" title="Marcar para remoção ao salvar">Remover</button>
                        <input type="checkbox" id="remover-extra-${i}" value="${urlExtra}" style="display:none;">` : ''}
                    </div>`;
                });
            }
            htmlCampos += `<label style="display:block; font-size:12px; color:#64748b; margin-bottom:4px;">Enviar novos extras (pode selecionar vários):</label>
                <input type="file" id="dono-novos-extras" multiple accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" style="width:100%; font-size:13px;">`;
            htmlCampos += `</div></div>`;
        }

        if (isCargoGerencia || isDono) {
            btnSalvar = `<button id="btn-salvar-detalhes" onclick="salvarDetalhesHist('${reg.id}')" style="flex:1; padding:12px; background:#10b981; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:15px; transition:0.2s;" onmouseover="this.style.background='#059669'" onmouseout="this.style.background='#10b981'">Salvar Alterações</button>`;
        }
    }

    // Botões extras para o dono (Excluir e Editar Dados)
    let btsDono = '';
    if (isDono) {
        btsDono += `<button onclick="excluirRegistroHistGeral('${reg.id}', '${reg.categoria_id}')" style="padding:12px 16px; background:#ef4444; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:14px; transition:0.2s;" onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='#ef4444'" title="Excluir Registro Permanente">🗑</button>`;

        // Botão editar disponível para todas as categorias (edição de campos sem gerar novo documento)
        btsDono += `<button onclick="editarRegistroHistoricoGeral('${reg.id}')" style="flex:1; padding:12px; background:#f59e0b; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:15px; transition:0.2s;" onmouseover="this.style.background='#d97706'" onmouseout="this.style.background='#f59e0b'">✏️ Editar Dados</button>`;
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
                ${btsDono}
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
    const inputDilacao = document.getElementById('dono-dilacao-prazo');
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
    if (inputVencimento) {
        novosCampos.data_vencimento = inputVencimento.value;
    }
    if (inputDilacao && inputDilacao.value.trim() !== '') {
        const novaDilacao = inputDilacao.value;
        if (novosCampos.data_dilacao && novosCampos.data_dilacao !== novaDilacao) {
            novosCampos.data_dilacao_anterior = novosCampos.data_dilacao;
        }
        if (!novosCampos.data_vencimento_original) {
            novosCampos.data_vencimento_original = novosCampos.data_vencimento;
        }
        novosCampos.data_vencimento = novaDilacao;
        novosCampos.data_dilacao = novaDilacao;
    }
    if (inputAR) novosCampos.ar = inputAR.value;
    if (inputHistorico) novosCampos.historico_admin = inputHistorico.value;

    let listaARAtual = [];
    if (reg.campos && reg.campos.anexo_ar) {
        listaARAtual = Array.isArray(reg.campos.anexo_ar) ? [...reg.campos.anexo_ar] : [{ url: reg.campos.anexo_ar, data: null }];
    }

    const removerCheckboxes = document.querySelectorAll('.remover-ar-checkbox');
    const indicesRemover = Array.from(removerCheckboxes).filter(cb => cb.checked).map(cb => parseInt(cb.value));
    if (indicesRemover.length > 0) {
        listaARAtual = listaARAtual.filter((_, idx) => !indicesRemover.includes(idx));
    }

    if (inputAnexoAR && inputAnexoAR.files.length > 0) {
        if (btnSalvar) {
            btnSalvar.innerText = 'Processando Anexo AR...';
            btnSalvar.disabled = true;
        }

        const dataARInput = document.getElementById('admin-novo-ar-data');
        const dataAR = dataARInput && dataARInput.value ? dataARInput.value : '';

        // Se houver múltiplas imagens selecionadas, criar um PDF
        let finalFile = inputAnexoAR.files[0];

        if (inputAnexoAR.files.length > 1) {
            try {
                // Carregar jsPDF dinamicamente caso o html2pdf.bundle não exponha a variável global
                if (!window.jspdf) {
                    await new Promise((resolve, reject) => {
                        const script = document.createElement('script');
                        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
                        script.onload = resolve;
                        script.onerror = reject;
                        document.head.appendChild(script);
                    });
                }

                const { jsPDF } = window.jspdf;
                const doc = new jsPDF('p', 'mm', 'a4');
                const pageWidth = doc.internal.pageSize.getWidth();
                const pageHeight = doc.internal.pageSize.getHeight();

                for (let i = 0; i < inputAnexoAR.files.length; i++) {
                    const file = inputAnexoAR.files[i];
                    if (!file.type.startsWith('image/')) continue;

                    // Comprimir para um tamanho menor garantindo que caberá na memória do celular
                    const compressedFile = await comprimirImagem(file, { maxWidth: 1000, maxHeight: 1000, quality: 0.8 });

                    const imgData = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = (e) => resolve(e.target.result);
                        reader.readAsDataURL(compressedFile);
                    });

                    const img = new Image();
                    await new Promise((resolve) => {
                        img.onload = resolve;
                        img.onerror = resolve;
                        img.src = imgData;
                    });

                    if (i > 0) doc.addPage();

                    const imgRatio = img.width / img.height;
                    const pageRatio = pageWidth / pageHeight;

                    let drawWidth = pageWidth;
                    let drawHeight = pageHeight;

                    if (imgRatio > pageRatio) {
                        drawHeight = pageWidth / imgRatio;
                    } else {
                        drawWidth = pageHeight * imgRatio;
                    }

                    const x = (pageWidth - drawWidth) / 2;
                    const y = (pageHeight - drawHeight) / 2;

                    doc.addImage(imgData, 'JPEG', x, y, drawWidth, drawHeight);
                }

                const pdfBlob = doc.output('blob');
                finalFile = new File([pdfBlob], 'AR_Agrupado.pdf', { type: 'application/pdf' });
            } catch (e) {
                console.error("Erro ao gerar PDF das imagens via jsPDF:", e);
                alert("Erro ao tentar agrupar as imagens num PDF. O primeiro arquivo será enviado sozinho.");
            }
        }

        let nomeAnexoLimpo = finalFile.name
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '_')
            .replace(/[^a-zA-Z0-9_\-\.]/g, '');

        const { data: { user } } = await getAuthUser();
        const nomeArquivo = `AR_${id}_${Date.now()}_${nomeAnexoLimpo}`;
        const caminho = `${user.id}/${nomeArquivo}`;

        try {
            const uploadResult = await cloudinaryUploadComPath(finalFile, 'anexos/' + caminho);
            listaARAtual.push({
                url: uploadResult.url,
                data: dataAR,
                name: finalFile.name
            });
        } catch (uploadError) {
            console.error('Erro no upload AR:', uploadError);
            alert('Erro ao anexar arquivo AR: ' + uploadError.message);
            if (btnSalvar) {
                btnSalvar.innerText = 'Salvar Alterações';
                btnSalvar.disabled = false;
            }
            return;
        }
    }

    if (listaARAtual.length > 0) {
        novosCampos.anexo_ar = listaARAtual;
    } else {
        delete novosCampos.anexo_ar;
    }

    // Salvar 'Resposta' lendo o select ou o campo de texto
    if (selectResposta) {
        if (selectResposta.value === 'ATENDIDO') {
            const dataInput = document.getElementById('admin-resposta-data');
            const dataStr = dataInput && dataInput.value ? dataInput.value.trim() : '';
            novosCampos.resposta_fiscal = dataStr ? `ATENDIDO - ${dataStr}` : 'ATENDIDO';
        } else if (selectResposta.value === '') {
            novosCampos.resposta_fiscal = '';
        } else if (selectResposta.value === 'Outro' && inputResposta) {
            novosCampos.resposta_fiscal = inputResposta.value;
        }
    }

    // Gerenciador de Anexos do Dono
    const { data: { user } } = await getAuthUser();
    const isDono = reg.user_id === user.id;

    if (isDono) {
        // Documento Principal
        const inputNovoPrinc = document.getElementById('dono-novo-doc');
        const inputSubstPrinc = document.getElementById('dono-substituir-doc');
        let filePrinc = null;
        if (inputNovoPrinc && inputNovoPrinc.files.length > 0) filePrinc = inputNovoPrinc.files[0];
        if (inputSubstPrinc && inputSubstPrinc.files.length > 0) filePrinc = inputSubstPrinc.files[0];

        if (filePrinc) {
            let nomeAnexoLimpo = filePrinc.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-\.]/g, '');
            const caminho = `${user.id}/DOC_${id}_${Date.now()}_${nomeAnexoLimpo}`;
            try {
                const uploadResult = await cloudinaryUploadComPath(filePrinc, 'anexos/' + caminho);
                novosCampos.anexo_pdf = uploadResult.url;
            } catch (uploadError) {
                alert('Erro ao salvar documento principal: ' + uploadError.message);
            }
        }

        // Remover Anexos Extras
        let anexosExtrasAtual = novosCampos.anexos_extras || [];
        const removidos = [];
        for (let i = 0; i < 50; i++) {
            const chk = document.getElementById(`remover-extra-${i}`);
            if (chk && chk.checked) removidos.push(chk.value);
        }
        if (removidos.length > 0) {
            anexosExtrasAtual = anexosExtrasAtual.filter(u => !removidos.includes(u));
        }

        // Adicionar novos Anexos Extras
        const inputExtras = document.getElementById('dono-novos-extras');
        if (inputExtras && inputExtras.files.length > 0) {
            for (let i = 0; i < inputExtras.files.length; i++) {
                const fileExt = inputExtras.files[i];
                let nomeAnexoLimpo = fileExt.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-\.]/g, '');
                const caminho = `${user.id}/EXTRA_${id}_${Date.now()}_${i}_${nomeAnexoLimpo}`;
                try {
                    const uploadResult = await cloudinaryUploadComPath(fileExt, 'anexos/' + caminho);
                    anexosExtrasAtual.push(uploadResult.url);
                } catch (upErr) {
                    console.error('Erro upload anexo extra:', upErr);
                }
            }
        }

        if (anexosExtrasAtual.length > 0) {
            novosCampos.anexos_extras = anexosExtrasAtual;
        } else {
            delete novosCampos.anexos_extras;
        }
    }

    const isDestaque = ['1.1', '1.2', '1.2.MA', '1.3', '1.4', '1.5', '1.5.MA', '1.6', '1.7', '1.9', '11'].includes(reg.categoria_id);
    const targetTable = isDestaque ? 'controle_processual' : 'registros_produtividade';

    let pontosAdicionadosAutom = false;
    let pontosAddTxt = '';

    // Automação: Se for Notificação Preliminar (1.1) e estiver mudando para ATENDIDO
    if (reg.categoria_id === '1.1') {
        const respostaAntiga = (reg.campos.resposta_fiscal || '').toLowerCase();
        const respostaNova = (novosCampos.resposta_fiscal || '').toLowerCase();

        if (!(respostaAntiga.includes('atendido') || respostaAntiga.includes('atendida')) && (respostaNova.includes('atendido') || respostaNova.includes('atendida'))) {
            const hoje = new Date();
            const ano = hoje.getFullYear();
            const mes = String(hoje.getMonth() + 1).padStart(2, '0');
            const dia = String(hoje.getDate()).padStart(2, '0');
            const dataAtual = `${ano}-${mes}-${dia}`;

            const campos15 = {
                n_notificacao: reg.numero_sequencial || novosCampos.n_notificacao || novosCampos.nome || '',
                descricao: 'Atendimento Automático',
                data: dataAtual
            };

            const { error: err15 } = await supabaseClient
                .from('registros_produtividade')
                .insert({
                    user_id: reg.user_id, // Pontos vão para o fiscal dono do registro
                    categoria_id: '15',
                    categoria_nome: 'Notificação Preliminar regularizados (atendidos)',
                    pontuacao: 20,
                    campos: campos15
                });

            if (!err15) {
                pontosAdicionadosAutom = true;
                pontosAddTxt = '• Notificação Preliminar regularizados (atendidos) (20 pontos)\n\n 20 pontos salvos no total!';
            } else {
                console.error('Erro ao gerar Notificação Preliminar regularizados (atendidos):', err15);
            }
        }
    }

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
        const modalHist = document.getElementById('modal-detalhes-admin-hist');
        if (modalHist) modalHist.remove();

        // Atualizar tabela de histórico imediatamente
        renderizarTabelaGeral(registrosGeralAtual, reg.categoria_id);

        // Atualizar aba NP/AI na Home, se estiver sendo visualizada
        if (typeof carregarNPAIHome === 'function') {
            carregarNPAIHome();
        }

        await carregarHistorico(); // atualiza pontuação e gráfico em tempo real

        if (pontosAdicionadosAutom) {
            alert('Alterações salvas com sucesso!\n\n' + pontosAddTxt);
        } else {
            alert('Alterações salvas com sucesso!');
        }
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

        const isDestaque = ['1.1', '1.2', '1.2.MA', '1.3', '1.4', '1.5', '1.5.MA', '1.6', '1.7', '1.9', '11'].includes(categoriaId) || categoriaId === 'np-af' || categoriaId === 'ai-ma' || categoriaId === 'relatorio-ma';
        const targetTable = isDestaque ? 'controle_processual' : 'registros_produtividade';

        // Nota: Excluir registro do histórico não devolve número para não furar sequência cronológica.

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

        await carregarHistorico(); // atualiza pontuação e gráfico em tempo real
        alert('Registro excluído com sucesso.');
    } catch (err) {
        console.error('Erro ao excluir registro:', err);
        alert('Erro ao excluir. Tente novamente.');
    }
}

// --- EDITAR REGISTRO PELO HISTÓRICO GERAL ---
function editarRegistroHistoricoGeral(id) {
    const reg = registrosGeralAtual.find(r => r.id === id);
    if (!reg) return;

    // Configura o registroSelecionado para a função unificada
    registroSelecionado = reg;

    // Fecha o modal atual sem re-renderizar o painel atrás
    const modal = document.getElementById('modal-detalhes-admin-hist');
    if (modal) modal.remove();

    // Chama o formulário padrão de edição
    editarRegistro();
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

    const nomeFiscal = (perfil?.full_name || 'Fiscal').replace(/Julio Cesar/gi, 'Júlio César');
    const roleFiscal = (window.userRoleGlobal || '').toLowerCase();
    const tituloFiscal = roleFiscal.includes('meio') && roleFiscal.includes('ambiente')
        ? 'Fiscal de Meio Ambiente'
        : 'Fiscal de Posturas';

    const dataAtual = new Date();
    let anoRelatorio = dataAtual.getFullYear();
    let mesIndex = dataAtual.getMonth();

    // Se for dia 1 a 7 do mês, o relatório é referente ao mês anterior
    if (dataAtual.getDate() <= 7) {
        mesIndex -= 1;
        if (mesIndex < 0) {
            mesIndex = 11;
            anoRelatorio -= 1;
        }
    }

    const nomesMeses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const mesRelatorio = nomesMeses[mesIndex];

    // Filtrar registros pelo mês/ano do relatório E omitindo pontuação 0
    const registrosFiltrados = todosRegistros.filter(r => {
        if ((r.pontuacao || 0) === 0) return false;

        // Controle Processual: usar created_at
        // Registros comuns: usar o campo 'data' dos campos
        let dt;
        if (r.categoria_id && r.categoria_id.toString().startsWith('1.')) {
            dt = new Date(r.created_at);
        } else {
            dt = obterDataReal(r);
        }
        return dt.getFullYear() === anoRelatorio && dt.getMonth() === mesIndex;
    });

    // Agrupar registros por categoria
    const porCategoria = {};
    registrosFiltrados.forEach(r => {
        let catIdGrupo = r.categoria_id;
        // Previne erro caso categoria_nome venha nulo/undefined do banco (muito comum no controle_processual)
        let catNomeGrupo = r.categoria_nome || (CATEGORIAS.find(c => c.id === catIdGrupo)?.nome) || ('Categoria ' + catIdGrupo);

        if (catIdGrupo === '1.9') {
            catIdGrupo = '1.1';
            catNomeGrupo = 'Notificações / AF';
        }
        if (catIdGrupo === '1.1' && typeof catNomeGrupo === 'string' && !catNomeGrupo.includes('AF')) {
            catNomeGrupo = 'Notificações / AF';
        }

        if (!porCategoria[catIdGrupo]) {
            porCategoria[catIdGrupo] = { nome: catNomeGrupo, registros: [] };
        }
        porCategoria[catIdGrupo].registros.push(r);
    });

    const pontuacaoTotal = registrosFiltrados.reduce((s, r) => s + r.pontuacao, 0);

    // Gerar tabelas por categoria
    let secoesHTML = '';
    Object.entries(porCategoria).forEach(([catId, cat]) => {
        const catDef = CATEGORIAS.find(c => c.id === catId);

        const temNumero = cat.registros.some(r => r.numero_sequencial);
        const camposDef = catDef?.campos?.filter(c => c.tipo !== 'file' && c.tipo !== 'date' && !c.ignorarNoBanco && !((catId === '1.1' || catId === '1.9') && c.nome === 'n_notificacao')) || [];

        let headerCols = '';
        if (temNumero) headerCols += '<th style="min-width: 95px;">N°</th>';
        headerCols += camposDef.map(c => `<th>${c.label}</th>`).join('');
        headerCols += '<th>Data</th>';
        headerCols += '<th>Pontos</th>';

        let linhas = cat.registros.map(r => {
            let tds = '';
            if (temNumero) {
                let numExibido = '-';
                if (r.categoria_id === '1.1') numExibido = 'NP ' + (r.numero_sequencial || (r.campos && r.campos.n_notificacao) || '-');
                else if (r.categoria_id === '1.9') numExibido = 'AF ' + (r.numero_sequencial || '-');
                else if (r.categoria_id === '1.2.MA') numExibido = 'MA-AI ' + (r.numero_sequencial || '-');
                else numExibido = r.numero_sequencial || (r.campos && r.campos.n_notificacao) || '-';
                tds += `<td contenteditable="true">${numExibido}</td>`;
            }
            tds += camposDef.map(c => `<td contenteditable="true">${(r.campos && r.campos[c.nome]) || '-'}</td>`).join('');
            const dataFormatada = obterDataReal(r).toLocaleDateString('pt-BR');
            tds += `<td contenteditable="true">${dataFormatada}</td>`;
            tds += `<td contenteditable="true">${r.pontuacao}</td>`;
            return `<tr>${tds}</tr>`;
        }).join('');

        const subtotal = cat.registros.reduce((s, r) => s + r.pontuacao, 0);
        const colSpanSubtotal = (temNumero ? 1 : 0) + camposDef.length + 1;

        secoesHTML += `
            <div class="relatorio-secao">
                <h3>${catDef ? catDef.nome : cat.nome}</h3>
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
                            <p style="margin: 2px 0 0 0;">${tituloFiscal}</p>
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
// --- LIMPEZA MENSAL AUTOMÁTICA E MANUAL ---
async function executarLimpezaMensal(silencioso = false) {
    const agora = new Date();
    const inicioMesAtual = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const inicioMesIso = inicioMesAtual.toISOString();

    try {
        const { data: { user } } = await getAuthUser();
        if (!user) return;

        // 1. Zera a pontuação no Controle Processual APENAS para registros anteriores ao mês atual
        const { error: errorCP } = await supabaseClient
            .from('controle_processual')
            .update({ pontuacao: 0 })
            .eq('user_id', user.id)
            .lt('created_at', inicioMesIso);

        if (errorCP) {
            console.warn('[Limpeza Mensal] Erro ao zerar pontuação por created_at:', errorCP);
        }

        // Verificar também registros com pontuação > 0 cuja data real seja anterior ao mês atual
        const { data: regCPCampos } = await supabaseClient
            .from('controle_processual')
            .select('id, campos, created_at, pontuacao')
            .eq('user_id', user.id)
            .gt('pontuacao', 0);

        if (regCPCampos && regCPCampos.length > 0) {
            const idsCPZerar = [];
            regCPCampos.forEach(r => {
                const dt = obterDataReal(r);
                if (dt < inicioMesAtual) {
                    idsCPZerar.push(r.id);
                }
            });
            if (idsCPZerar.length > 0) {
                for (let i = 0; i < idsCPZerar.length; i += 100) {
                    const lote = idsCPZerar.slice(i, i + 100);
                    await supabaseClient
                        .from('controle_processual')
                        .update({ pontuacao: 0 })
                        .in('id', lote);
                }
            }
        }

        // 2. Remove registros de registros_produtividade anteriores ao mês atual
        const { data: registrosProd, error: errorFetch } = await supabaseClient
            .from('registros_produtividade')
            .select('id, campos, created_at')
            .eq('user_id', user.id);

        if (!errorFetch && registrosProd) {
            const idsParaExcluir = [];
            registrosProd.forEach(r => {
                const dt = obterDataReal(r);
                if (dt < inicioMesAtual) {
                    idsParaExcluir.push(r.id);
                }
            });

            if (idsParaExcluir.length > 0) {
                for (let i = 0; i < idsParaExcluir.length; i += 100) {
                    const lote = idsParaExcluir.slice(i, i + 100);
                    await supabaseClient
                        .from('registros_produtividade')
                        .delete()
                        .in('id', lote);
                }
            }
        }

        const chaveMes = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
        localStorage.setItem('semac_ultimo_mes_limpeza_' + user.id, chaveMes);

        if (!silencioso && typeof Swal !== 'undefined') {
            Swal.fire('Concluído!', 'Registros de meses anteriores foram limpos. Os registros do mês atual permanecem intocados.', 'success');
        }

        if (typeof carregarHistorico === 'function') {
            await carregarHistorico();
        }
    } catch (err) {
        console.error('Erro na limpeza mensal:', err);
        if (!silencioso && typeof Swal !== 'undefined') {
            Swal.fire('Erro', 'Ocorreu um erro ao limpar o histórico.', 'error');
        }
    }
}

function confirmarLimpeza() {
    const agora = new Date();
    const nomeMesAtual = agora.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    Swal.fire({
        title: 'Limpeza Geral',
        html: `Tem certeza? Esta ação irá remover <strong>apenas os registros de meses anteriores</strong>.<br><br>Registros de <strong>${nomeMesAtual}</strong> serão mantidos intocados.<br><br>Registros do Controle Processual terão a pontuação zerada (mas permanecem no Histórico Geral). Registros de Produtividade serão excluídos permanentemente.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: 'Sim, limpar meses anteriores',
        cancelButtonText: 'Cancelar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({
                title: 'Limpando histórico...',
                text: 'Por favor, aguarde.',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });
            await executarLimpezaMensal(false);
        }
    });
}
window.confirmarLimpeza = confirmarLimpeza;
window.executarLimpezaMensal = executarLimpezaMensal;

// Fechar dropdowns e modais ao clicar fora
document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown-custom')) {
        document.querySelectorAll('.dropdown-lista.aberto').forEach(el => el.classList.remove('aberto'));
    }
    // if (e.target.id === 'modal-produtividade') fecharModalProdutividade();
    // if (e.target.id === 'modal-detalhes') fecharDetalhes();
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
            const txt = document.querySelector('#dropdown-bairro .dropdown-texto');
            if (txt) txt.textContent = dadosExtraidos.bairro;
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

// =============================================
// FUNÇÕES DE RASCUNHO PARA DOCUMENTOS WYSIWYG
// =============================================

async function criarRascunhoControleProcessual(campos, categoriaId, numeroSeq) {
    const { data: { user } } = await getAuthUser();
    if (!user) throw new Error('Sessão expirada');

    const { data: perfil } = await supabaseClient
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
    const fiscalNome = (perfil?.full_name || 'Fiscal').replace(/Julio Cesar/gi, 'Júlio César');

    const catDef = CATEGORIAS.find(c => c.id === categoriaId);

    const { data, error } = await supabaseClient
        .from('controle_processual')
        .insert({
            user_id: user.id,
            fiscal_nome: fiscalNome,
            categoria_id: categoriaId,
            categoria_nome: catDef ? catDef.nome : 'Documento',
            numero_sequencial: numeroSeq,
            pontuacao: 0,
            campos: campos
        })
        .select();

    if (error) throw error;
    if (!data || data.length === 0) {
        throw new Error('Falha ao criar o rascunho no banco de dados. O registro não foi retornado (possível bloqueio de permissão RLS).');
    }
    return data[0];
}

async function finalizarDocumentoComAnexo(blobPdf, filenameSafe) {
    if (!rascunhoDocumento) {
        throw new Error('Nenhum rascunho ativo para finalizar.');
    }

    const { data: { user } } = await getAuthUser();
    if (!user) throw new Error('Sessão expirada');

    const registroId = rascunhoDocumento.id;
    const catDef = CATEGORIAS.find(c => c.id === rascunhoDocumento.categoria_id);

    // Calcular pontuação final
    let pontos = catDef ? catDef.pontos : 0;

    // Upload do PDF
    let nomeAnexoLimpo = filenameSafe
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_\-\.]/g, '');

    const nomeArquivo = `${registroId}_${nomeAnexoLimpo}`;
    const caminho = `${user.id}/${nomeArquivo}`;

    let camposAtualizados = { ...rascunhoDocumento.campos };
    try {
        const uploadResult = await cloudinaryUploadComPath(blobPdf, 'anexos/' + caminho);
        camposAtualizados.anexo_pdf = uploadResult.url;
    } catch (uploadError) {
        console.error('Erro no upload:', uploadError);
        alert('Documento baixado, mas erro ao anexar PDF: ' + uploadError.message);
        throw uploadError;
    }

    // Atualizar registro com pontuação e anexo
    const { error: updateError } = await supabaseClient
        .from('controle_processual')
        .update({
            pontuacao: pontos,
            campos: camposAtualizados
        })
        .eq('id', registroId);

    if (updateError) throw updateError;

    // AUTOMÁTICO: Gerar a categoria 16 (Autos de Infração expedidos - id visual 15) - 30 pts
    if (rascunhoDocumento.categoria_id === '1.2' || rascunhoDocumento.categoria_id === '1.2.MA') {
        const hoje = new Date();
        const ano = hoje.getFullYear();
        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
        const dia = String(hoje.getDate()).padStart(2, '0');
        const dataAtual = `${ano}-${mes}-${dia}`;

        const campos16 = {
            n_auto: rascunhoDocumento.numero_sequencial || '',
            descricao: rascunhoDocumento.campos?.motivo || 'Expedição Automática',
            data: dataAtual
        };

        const { error: err16 } = await supabaseClient
            .from('registros_produtividade')
            .insert({
                user_id: user.id,
                categoria_id: '16',
                categoria_nome: 'Autos de Infração expedidos',
                pontuacao: 30,
                campos: campos16
            });

        if (err16) {
            console.error('Erro ao gerar Autos de Infração expedidos (16):', err16);
        }
    }

    // AUTOMÁTICO: Gerar a categoria 8 (Elaboração de Ofícios - id visual 7°) - 15 pts
    if (rascunhoDocumento.categoria_id === '1.4') {
        const hoje = new Date();
        const ano = hoje.getFullYear();
        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
        const dia = String(hoje.getDate()).padStart(2, '0');
        const dataAtual = `${ano}-${mes}-${dia}`;

        const campos8 = {
            n_oficio: rascunhoDocumento.numero_sequencial || '',
            descricao: rascunhoDocumento.campos?.assunto || 'Expedição Automática',
            data: dataAtual
        };

        const { error: err8 } = await supabaseClient
            .from('registros_produtividade')
            .insert({
                user_id: user.id,
                categoria_id: '8',
                categoria_nome: 'Elaboração de Ofícios',
                pontuacao: 15,
                campos: campos8
            });

        if (err8) {
            console.error('Erro ao gerar Elaboração de Ofícios (8):', err8);
        }
    }

    // AUTOMÁTICO: Lançar pontuação para Fiscais de Meio Ambiente adicionais (Via RPC para contornar RLS)
    if (rascunhoDocumento.categoria_id === '1.4' && camposAtualizados.fiscais_adicionais && camposAtualizados.fiscais_adicionais.length > 0) {
        for (const fiscalExtra of camposAtualizados.fiscais_adicionais) {
            // 1. Criar registro de Ofício (1.4 - 10 pts) em registros_produtividade via RPC (Evita duplicar no histórico geral)
            const camposOficioExtra = { ...camposAtualizados, n_oficio: rascunhoDocumento.numero_sequencial, fiscal_nome_original: fiscalExtra.nome };

            const { error: errCpExtra } = await supabaseClient.rpc('inserir_registro_equipe', {
                p_tabela: 'registros_produtividade',
                p_user_id: fiscalExtra.id,
                p_categoria_id: '1.4',
                p_categoria_nome: catDef ? catDef.nome : 'Documento',
                p_pontuacao: pontos,
                p_campos: camposOficioExtra
            });
            if (errCpExtra) {
                console.error(`Erro ao salvar Ofício (1.4) para ${fiscalExtra.nome}:`, errCpExtra);
                alert(`Aviso: O sistema não conseguiu salvar a pontuação do Ofício para o fiscal ${fiscalExtra.nome}. É necessário rodar o script SQL liberado. Motivo: ${errCpExtra.message}`);
            }

            // 2. Criar registro de Elaboração de Ofícios (8 - 15 pts) em registros_produtividade via RPC
            const hoje = new Date();
            const dataAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

            const { error: errProdExtra } = await supabaseClient.rpc('inserir_registro_equipe', {
                p_tabela: 'registros_produtividade',
                p_user_id: fiscalExtra.id,
                p_categoria_id: '8',
                p_categoria_nome: 'Elaboração de Ofícios',
                p_pontuacao: 15,
                p_campos: {
                    n_oficio: rascunhoDocumento.numero_sequencial || '',
                    descricao: camposAtualizados.assunto || 'Expedição Automática',
                    data: dataAtual
                }
            });
            if (errProdExtra) {
                console.error(`Erro ao salvar Elaboração (8) para ${fiscalExtra.nome}:`, errProdExtra);
            }
        }
    }

    // AUTOMÁTICO: Lançar pontuação para Fiscais de Meio Ambiente adicionais (Via RPC para contornar RLS) para Relatório de Vistoria (1.5.MA)
    if (rascunhoDocumento.categoria_id === '1.5.MA' && camposAtualizados.fiscais_adicionais && camposAtualizados.fiscais_adicionais.length > 0) {
        for (const fiscalExtra of camposAtualizados.fiscais_adicionais) {
            // 1. Criar registro de Relatório (1.5.MA - 10 pts) em registros_produtividade via RPC
            const camposRelatorioExtra = { ...camposAtualizados, n_relatorio: rascunhoDocumento.numero_sequencial, fiscal_nome_original: fiscalExtra.nome };

            const { error: errCpExtra } = await supabaseClient.rpc('inserir_registro_equipe', {
                p_tabela: 'registros_produtividade',
                p_user_id: fiscalExtra.id,
                p_categoria_id: '1.5.MA',
                p_categoria_nome: catDef ? catDef.nome : 'Documento',
                p_pontuacao: pontos,
                p_campos: camposRelatorioExtra
            });
            if (errCpExtra) {
                console.error(`Erro ao salvar Relatório (1.5.MA) para ${fiscalExtra.nome}:`, errCpExtra);
            }

            // 2. Criar registro de Elaboração de Relatório (7 - 50 pts) em registros_produtividade via RPC
            const hoje = new Date();
            const dataAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

            const { error: errProdExtra } = await supabaseClient.rpc('inserir_registro_equipe', {
                p_tabela: 'registros_produtividade',
                p_user_id: fiscalExtra.id,
                p_categoria_id: '7',
                p_categoria_nome: 'Elaboração de Certidão de Arquivamento e Relatório Fiscal',
                p_pontuacao: 50,
                p_campos: {
                    tipo: 'Relatório Fiscal',
                    descricao: rascunhoDocumento.numero_sequencial || '',
                    data: dataAtual
                }
            });
            if (errProdExtra) {
                console.error(`Erro ao salvar Elaboração de Relatório (7) para ${fiscalExtra.nome}:`, errProdExtra);
            }
        }
    }

    // AUTOMÁTICO: Gerar a categoria 7 (Elaboração de Certidão de Arquivamento e Relatório Fiscal - id visual 6°) - 50 pts
    if (rascunhoDocumento.categoria_id === '1.5' || rascunhoDocumento.categoria_id === '1.5.MA') {
        const hoje = new Date();
        const ano = hoje.getFullYear();
        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
        const dia = String(hoje.getDate()).padStart(2, '0');
        const dataAtual = `${ano}-${mes}-${dia}`;

        const campos7 = {
            tipo: 'Relatório Fiscal',
            descricao: rascunhoDocumento.numero_sequencial || '',
            data: dataAtual
        };

        const { error: err7 } = await supabaseClient
            .from('registros_produtividade')
            .insert({
                user_id: user.id,
                categoria_id: '7',
                categoria_nome: 'Elaboração de Certidão de Arquivamento e Relatório Fiscal',
                pontuacao: 50,
                campos: campos7
            });

        if (err7) {
            console.error('Erro ao gerar Elaboração de Relatório (7):', err7);
        }
    }

    // Limpar rascunho
    rascunhoDocumento = null;
}

async function cancelarRascunhoDocumento() {
    if (!rascunhoDocumento) return;

    const registroId = rascunhoDocumento.id;
    const categoriaId = rascunhoDocumento.categoria_id;
    const numeroSeq = rascunhoDocumento.numero_sequencial;
    const anoAtual = new Date().getFullYear();
    rascunhoDocumento = null;

    try {
        // Devolve o número para a fila global no banco (qualquer categoria que gere número, ex: 1.2, 1.4, 1.5, 1.8, 11)
        if (numeroSeq && categoriaId) {
            await devolverNumeroSequencialCompleto(categoriaId, numeroSeq, anoAtual);
        }

        await supabaseClient
            .from('controle_processual')
            .delete()
            .eq('id', registroId);
    } catch (e) {
        console.error('Erro ao excluir rascunho:', e);
    }
}

// --- HELPERS DE MANIPULAÇÃO XML/DOCX ---
function escapeXml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function textoDoParagrafo(paragrafo) {
    if (!paragrafo) return '';
    return (paragrafo.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [])
        .map(tag => tag.replace(/<[^>]+>/g, ''))
        .join('');
}

function substituirTextoParagrafo(paragrafo, novoTexto) {
    if (!paragrafo) return paragrafo;
    const textoAtual = textoDoParagrafo(paragrafo);
    if (textoAtual === '') return paragrafo;

    const textoEscapado = escapeXml(novoTexto);
    // Localiza a primeira ocorrência de <w:t...>...</w:t> com texto real
    return paragrafo.replace(
        /(<w:t(?:\s+xml:space="preserve")?\s*>)([^<]*)(<\/w:t>)/,
        (match, abertura, conteudo, fechamento) => {
            // Preserva o atributo xml:space="preserve" se houver
            return abertura + textoEscapado + fechamento;
        }
    );
}

function removerParagrafo(paragrafo) {
    return '';
}

function encontrarParagrafos(doc, predicado) {
    const paragrafos = doc.match(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g) || [];
    return paragrafos.filter(p => predicado(textoDoParagrafo(p), p));
}


// --- GERADOR DE AUTO DE INFRAÇÃO (WYSIWYG) ---
async function abrirEditorAutoInfracao() {
    if (!categoriaAtual) return;
    // 1. Coleta e valida dados
    const campos = {};
    let todosPreenchidos = true;

    const tipoInscricaoInput = document.querySelector('input[name="tipo_inscricao"]:checked');
    const tipoInscricao = tipoInscricaoInput ? tipoInscricaoInput.value : 'imobiliaria';
    campos.tipo_inscricao = tipoInscricao;

    if (tipoInscricao === 'empresa') {
        const cnpjInput = document.getElementById('campo-cnpj_empresa');
        if (cnpjInput) {
            campos.cnpj_empresa = cnpjInput.value.trim();
            if (!campos.cnpj_empresa) {
                todosPreenchidos = false;
                cnpjInput.style.borderColor = '#ef4444';
            } else {
                cnpjInput.style.borderColor = '#e2e8f0';
            }
        }
    }

    categoriaAtual.campos.forEach(campo => {
        if (campo.tipo === 'file') return;
        const input = document.getElementById(`campo-${campo.nome}`);
        let valor = input ? input.value.trim() : '';

        // Se for empresa, ignorar a obrigatoriedade dos campos de inscrição municipal
        let isObrigatorio = campo.obrigatorio;
        if (tipoInscricao === 'empresa' && campo.agrupar === 'inscricao') {
            isObrigatorio = false;
            valor = ''; // zera o valor para não ir lixo
        }

        // n_notificacao não é obrigatorio no Auto
        if (isObrigatorio && !valor && campo.nome !== 'n_notificacao') {
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

    let numSequencial = null;
    try {
        // Gera número sequencial online e cria rascunho no banco para reservar o número
        numSequencial = await gerarNumeroSequencial(categoriaAtual.id);
        const tituloDoc = 'AUTO DE INFRAÇÃO Nº';

        // Salva rascunho sem pontuação e sem anexo (reserva o número)
        const rascunho = await criarRascunhoControleProcessual(campos, categoriaAtual.id, numSequencial);
        rascunhoDocumento = {
            id: rascunho.id,
            numero_sequencial: rascunho.numero_sequencial,
            categoria_id: categoriaAtual.id,
            campos: campos
        };

        // 2. Prepara HTML do Documento
        const dataPartes = campos.data ? campos.data.split('-') : ['', '', ''];
        const dataFormatada = campos.data ? `${dataPartes[2]}/${dataPartes[1]}/${dataPartes[0]}` : '';

        let labelIdentificacao = "Inscrição Imobiliária Municipal:";
        let descInscricao = campos.inscricao_zona ? `Zona: ${campos.inscricao_zona}, Quadra: ${campos.inscricao_quadra}, Lote: ${campos.inscricao_lote}, com área de ${campos.inscricao_area} m²` : '---';

        if (campos.tipo_inscricao === 'empresa') {
            labelIdentificacao = "Empresa (CNPJ):";
            descInscricao = campos.cnpj_empresa || '---';
        }
        const numNotificacao = campos.n_notificacao ? campos.n_notificacao : '_____';
        const prazoDefesa = campos.prazo_defesa ? campos.prazo_defesa : '_____';

        // Pegar informações do Fiscal (Nome logado) e Data de Hoje para Assinatura
        const { data: { user } } = await getAuthUser();
        let nomeFiscal = 'Nome do Fiscal';
        let matriculaFiscal = 'XXXXXXXX';
        if (user) {
            const { data: perfil } = await supabaseClient
                .from('profiles')
                .select('full_name, matricula')
                .eq('id', user.id)
                .maybeSingle();
            if (perfil && perfil.full_name) nomeFiscal = perfil.full_name.replace(/Julio Cesar/gi, 'Júlio César');
            if (perfil && perfil.matricula) matriculaFiscal = perfil.matricula;
        }

        const termoDocumento = categoriaAtual.id === '11' ? 'documento de Dívida Ativa' : 'Auto de infração';
        const imgBase64 = await obterBase64Cabecalho();

        const hoje = new Date();
        const diaHoje = String(hoje.getDate()).padStart(2, '0');
        const mesHoje = String(hoje.getMonth() + 1).padStart(2, '0');
        const anoHoje = hoje.getFullYear();
        const dataAssinatura = `${diaHoje}/${mesHoje}/${anoHoje}`;

        const htmlTemplate = `
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
            <tr>
                <td align="center">
                    <img src="${imgBase64}" width="650" style="width: 490pt; height: auto; display: block;">
                </td>
            </tr>
        </table>
        
        <div style="text-align: center; margin-bottom: 25px;">
            <p style="font-weight: bold; font-size: 14pt; margin: 10px 0;">FISCALIZAÇÃO DE POSTURAS AMBIENTAL</p>
            <p style="font-weight: bold; font-size: 16pt; margin: 15px 0;">${tituloDoc}: ${numSequencial}</p>
        </div>
        
        <p style="margin-top: 20px; line-height: 1.5;">
            <strong>Estabelecimento/Proprietário:</strong> ${campos.nome}<br>
            <strong>CPF/CNPJ:</strong> ${campos.cpf_contribuinte || '_________________'}
        </p>
        <p>
            <strong>Endereço:</strong> ${campos.endereco_infrator || '---'}
        </p>

        <p style="text-indent: 30px; margin-top: 20px; line-height: 1.5;">
            Foi fiscalizado da data <strong>${dataFormatada}</strong> pelo motivo descrito: o imóvel situado na <strong>${campos.endereco_imovel || '______________________'}</strong>, Bairro <strong>${campos.bairro}</strong>; ${labelIdentificacao} <strong>${descInscricao}</strong>, necessitava de <strong>${campos.motivo || '...'}</strong>.
        </p>

        <p style="text-indent: 30px; margin-top: 10px;">
            Na presente data deste documento foi verificado: Não cumprimento da obrigação da Notificação Preliminar nº: <strong>${numNotificacao}</strong> - <strong>${campos.motivo || 'Limpeza do imóvel de sua propriedade'}</strong>.
        </p>

        <p style="text-indent: 30px; margin-top: 10px;">
            Motivo da infração baseada na Lei/ Decreto pelo descumprimento do dispositivo: <strong>${campos.fundamentacao_legal || '_______'}, sob pena do Artigo ${campos.sob_pena || '___________'}</strong> .<br><br>
            <strong>MULTA NO VALOR DE R$ ${campos.valor_multa || '__________'}</strong>
        </p>
        
        <p style="text-indent: 30px; margin-top: 20px;">
            O autuado tem o prazo de <strong>${prazoDefesa} DIAS</strong> para apresentação de defesa, por escrito, protocolada via protocolo municipal. Instruções: link (https://servicos.prefeituradivinopolis.com.br/govdigital/Microsservicos/instrucao/201)
        </p>

        <div style="margin-top: 40px; margin-left: 30px;">
            <div style="display: inline-block; text-align: center;">
                <p style="margin: 0;">_________________________________________ Divinópolis, ${dataAssinatura}</p>
                <p style="margin: 5px 0 0 0; margin-right: 170px;">
                    <strong>${nomeFiscal}</strong><br>
                    Matrícula: ${matriculaFiscal}<br>
                    ${obterTituloFiscal()}
                </p>
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
        if (numSequencial && categoriaAtual && categoriaAtual.id) {
            try {
                await devolverNumeroSequencialCompleto(categoriaAtual.id, numSequencial);
            } catch (e) { }
        }
        alert('Ocorreu um erro ao processar os dados do documento.');
    } finally {
        if (btnSalvarForm) {
            btnSalvarForm.textContent = oldTexto;
            btnSalvarForm.disabled = false;
        }
    }
}

// --- GERADOR DE AUTO DE INFRAÇÃO AMBIENTAL (DOCX) ---
async function abrirEditorAutoInfracaoAmbiental() {
    if (!categoriaAtual) return;

    const campos = {};
    let todosPreenchidos = true;
    let primeiroInvalido = null;

    categoriaAtual.campos.forEach(campo => {
        if (campo.tipo === 'file') return;
        const input = document.getElementById(`campo-${campo.nome}`);
        let valor = input ? input.value.trim() : '';

        let isObrigatorio = campo.obrigatorio;

        // numero_documento_referencia só é obrigatório quando há tipo selecionado
        if (campo.nome === 'numero_documento_referencia') {
            const tipoRef = document.getElementById('campo-tipo_documento_referencia');
            isObrigatorio = tipoRef && tipoRef.value.trim() !== '';
        }

        if (isObrigatorio && !valor) {
            todosPreenchidos = false;
            if (input) {
                input.style.borderColor = '#ef4444';
                if (!primeiroInvalido) primeiroInvalido = input;
            }
        } else if (input) {
            input.style.borderColor = '#e2e8f0';
        }
        campos[campo.nome] = valor || '';
    });

    if (!todosPreenchidos) {
        alert('Preencha os dados obrigatórios do Auto de Infração Ambiental antes de gerar o documento.');
        if (primeiroInvalido) primeiroInvalido.focus();
        return;
    }

    const btnSalvarForm = document.querySelector('#modal-produtividade .btn-salvar');
    const oldTexto = btnSalvarForm ? btnSalvarForm.textContent : 'Gerar Documento';
    if (btnSalvarForm) {
        btnSalvarForm.textContent = 'Carregando...';
        btnSalvarForm.disabled = true;
    }

    let numSequencial = null;
    try {
        numSequencial = await gerarNumeroSequencial(categoriaAtual.id);

        const rascunho = await criarRascunhoControleProcessual(campos, categoriaAtual.id, numSequencial);
        rascunhoDocumento = {
            id: rascunho.id,
            numero_sequencial: rascunho.numero_sequencial,
            categoria_id: categoriaAtual.id,
            campos: campos
        };

        // Dados do fiscal logado
        const { data: { user } } = await getAuthUser();
        let nomeFiscal = 'Nome do Fiscal';
        let matriculaFiscal = 'XXXXXXXX';
        if (user) {
            const { data: perfil } = await supabaseClient
                .from('profiles')
                .select('full_name, matricula')
                .eq('id', user.id)
                .maybeSingle();
            if (perfil && perfil.full_name) nomeFiscal = perfil.full_name.replace(/Julio Cesar/gi, 'Júlio César');
            if (perfil && perfil.matricula) matriculaFiscal = perfil.matricula;
        }

        const hoje = new Date();
        const diaHoje = String(hoje.getDate()).padStart(2, '0');
        const mesHoje = String(hoje.getMonth() + 1).padStart(2, '0');
        const anoHoje = hoje.getFullYear();
        const dataAssinatura = `${diaHoje}/${mesHoje}/${anoHoje}`;

        const dataPartes = campos.data ? campos.data.split('-') : ['', '', ''];
        const dataFormatada = campos.data ? `${dataPartes[2]}/${dataPartes[1]}/${dataPartes[0]}` : '';

        const imgBase64 = typeof CABECALHO_AUTO_FISCALIZACAO_BASE64 !== 'undefined'
            ? CABECALHO_AUTO_FISCALIZACAO_BASE64
            : await obterBase64Cabecalho();

        const enderecoAutuadoStr = `${campos.rua_autuado || ''}${campos.rua_autuado && campos.numero_autuado ? ', ' : ''}${campos.numero_autuado || ''}`;
        const enderecoImovelStr = `${campos.rua_imovel || ''}${campos.rua_imovel && campos.numero_imovel ? ', ' : ''}${campos.numero_imovel || ''}`;

        let htmlAssinaturas = '';
        if (campos.tem_testemunhas === 'Sim') {
            htmlAssinaturas = `
            <br><br>
            <p align="center" style="margin: 0;">
                ________________________________________________<br>
                ${nomeFiscal}<br>
                Matrícula: ${matriculaFiscal}
            </p>
            <br><br>
            <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                    <td width="50%" align="center" valign="top">
                        ____________________________________<br>
                        Testemunha 1<br>
                        ${campos.nome_testemunha_1 || ''}<br>
                        CPF: ${campos.cpf_testemunha_1 || ''}
                    </td>
                    <td width="50%" align="center" valign="top">
                        ____________________________________<br>
                        Testemunha 2<br>
                        ${campos.nome_testemunha_2 || ''}<br>
                        CPF: ${campos.cpf_testemunha_2 || ''}
                    </td>
                </tr>
            </table>
            <br><br>`;
        } else {
            htmlAssinaturas = `
            <br><br>
            <p align="center" style="margin: 0;">
                ________________________________________________<br>
                ${nomeFiscal}<br>
                Matrícula: ${matriculaFiscal}
            </p>
            <br><br>`;
        }

        const htmlPreview = `
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
            <tr>
                <td align="center">
                    <img src="${imgBase64}" width="650" style="width: 490pt; height: auto; display: block;">
                </td>
            </tr>
        </table>
        
        <p align="center" style="font-weight: bold; font-size: 14pt; margin: 0;">AUTO DE INFRAÇÃO- N°${numSequencial}</p>
        <p align="center" style="font-weight: bold; font-size: 14pt; margin: 0;">Fiscalização Ambiental</p>
        <p align="right" style="margin: 0;">Divinópolis - MG &nbsp;&nbsp; ${dataAssinatura}</p>
        <br>
        
        ${campos.tipo_documento_referencia ? `
        <table width="100%" border="1" cellspacing="0" cellpadding="8" style="border-collapse: collapse; border: 1px solid black; margin-bottom: 20px;">
            <tr>
                <td width="50%" style="border: 1px solid black; padding: 8px;">Processo Administrativo n° ${campos.processo_administrativo || ''}</td>
                <td width="50%" style="border: 1px solid black; padding: 8px;">${campos.tipo_documento_referencia} - Nº ${campos.numero_documento_referencia || ''}</td>
            </tr>
        </table>` : `
        <table width="100%" border="1" cellspacing="0" cellpadding="8" style="border-collapse: collapse; border: 1px solid black; margin-bottom: 20px;">
            <tr>
                <td style="border: 1px solid black; padding: 8px;">Processo Administrativo n° ${campos.processo_administrativo || ''}</td>
            </tr>
        </table>`}
        
        <p style="margin-top: 20px; margin-bottom: 5px;"><strong>Informações do Autuado</strong></p>
        <table width="100%" border="1" cellspacing="0" cellpadding="8" style="border-collapse: collapse; border: 1px solid black;">
            <tr>
                <td style="border: 1px solid black; padding: 8px;">Nome do(a) autuado(a): ${campos.nome}</td>
                <td style="border: 1px solid black; padding: 8px;">CNPJ/CPF: ${campos.cpf_contribuinte}</td>
            </tr>
            <tr>
                <td style="border: 1px solid black; padding: 7px;">Endereço: ${enderecoAutuadoStr}</td>
                <td style="border: 1px solid black; padding: 7px;">Bairro: ${campos.bairro_autuado}</td>
            </tr>
            <tr>
                <td style="border: 1px solid black; padding: 7px;">Município: ${campos.municipio_autuado}</td>
                <td style="border: 1px solid black; padding: 7px;">CEP: ${campos.cep_autuado}</td>
            </tr>
        </table>

        <p style="margin-top: 20px; margin-bottom: 5px;"><strong>Local da Autuação</strong></p>
        <table width="100%" border="1" cellspacing="0" cellpadding="7" style="border-collapse: collapse; border: 1px solid black;">
            <tr>
                <td style="border: 1px solid black; padding: 7px;">Endereço: ${enderecoImovelStr}</td>
                <td style="border: 1px solid black; padding: 7px;">Bairro: ${campos.bairro}</td>
            </tr>
            <tr>
                ${campos.inscricao ? `
                <td width="50%" style="border: 1px solid black; padding: 7px;">CEP: ${campos.cep_imovel}</td>
                <td width="50%" style="border: 1px solid black; padding: 7px;">Inscrição: ${campos.inscricao}</td>
                ` : `
                <td colspan="2" style="border: 1px solid black; padding: 7px;">CEP: ${campos.cep_imovel}</td>
                `}
            </tr>
        </table>

        <p style="margin-top: 20px; margin-bottom: 5px;"><strong>Informações da Infração</strong></p>
        <table width="100%" border="1" cellspacing="0" cellpadding="7" style="border-collapse: collapse; border: 1px solid black;">
            ${(campos.data || campos.hora_infracao) ? `
            <tr>
                ${campos.data ? `<td ${campos.hora_infracao ? 'width="50%"' : 'colspan="2"'} style="border: 1px solid black; padding: 7px;">Data: ${dataFormatada}</td>` : ''}
                ${campos.hora_infracao ? `<td ${campos.data ? 'width="50%"' : 'colspan="2"'} style="border: 1px solid black; padding: 7px;">Hora: ${campos.hora_infracao}</td>` : ''}
            </tr>` : ''}
            ${campos.reincidente ? `
            <tr>
                <td colspan="2" style="border: 1px solid black; padding: 7px;">Reincidente ? ${campos.reincidente}</td>
            </tr>` : ''}
            <tr>
                <td colspan="2" style="border: 1px solid black; padding: 7px; text-align: justify;">Descrição/Fato Constitutivo da infração: ${campos.irregularidades || ''}</td>
            </tr>
        </table>

        <p style="margin-top: 20px; margin-bottom: 5px;"><strong>Dispositivo(s) legal(is) transgredido(s):</strong></p>
        <table width="100%" border="0" cellspacing="0" cellpadding="7" style="border-collapse: collapse;">
            <tr>
                <td style="border-bottom: 1px solid black; padding: 9px; text-align: justify;">${campos.dispositivos || ''}</td>
            </tr>
        </table>

        <p style="margin-top: 20px; margin-bottom: 5px;"><strong>PENALIDADE(S):</strong></p>
        <table width="100%" border="0" cellspacing="0" cellpadding="7" style="border-collapse: collapse; margin-bottom: 20px;">
            <tr>
                <td style="border-bottom: 1px solid black; padding: 9px; text-align: justify;">${campos.penalidades || ''}</td>
            </tr>
        </table>

        <p style="margin-top: 20px; text-align: justify;">O(a) autuado(a) deverá apresentar defesa, por escrito, no Processo Administrativo n° ${campos.processo_administrativo}, no prazo máximo de <strong>${campos.prazo_defesa} dias</strong>, a contar da data do recebimento deste. A defesa e documentos deverão ser encaminhados pelo link:<br>
        <a href="https://servicos.prefeituradivinopolis.com.br/govdigital/Microsservicos/instrucao/200" target="_blank" style="color: blue; text-decoration: none;">https://servicos.prefeituradivinopolis.com.br/govdigital/Microsservicos/instrucao/200</a></p>

        <p style="margin-top: 20px; text-align: justify;">${campos.tem_testemunhas === 'Sim' ? 'O Auto de Infração, lavrado em três vias, que vai assinado pelo fiscal, pelo representante ou técnico do estabelecimento, e na ausência ou recusa destes últimos, será assinado por duas testemunhas.' : 'O Auto de Infração, lavrado em três vias, que vai assinado pelo fiscal, pelo representante ou técnico do estabelecimento, e na ausência ou recusa destes últimos, será assinado por duas testemunhas.'}</p>

        ${htmlAssinaturas}

        <table width="100%" border="1" cellspacing="0" cellpadding="7" style="border-collapse: collapse; border: 1px solid black; margin-top: 40px;">
            <tr>
                <td width="75%" valign="top" style="border: 1px solid black; padding: 7px;">
                    <p style="margin: 0;">Assinatura do Autuado:</p>
                    <br><br><br>
                </td>
                <td width="25%" valign="top" style="border: 1px solid black; padding: 7px;">
                    <p style="margin: 0;">Ciente em:</p>
                    <br><br>
                    <p style="margin: 0; text-align: center;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/</p>
                </td>
            </tr>
        </table>
        `;

        const editor = document.getElementById('editor-texto');
        if (editor) editor.innerHTML = htmlPreview;

        // Abre o modal do editor
        const modal = document.getElementById('modal-editor-documento');
        if (modal) modal.style.display = 'flex';

    } catch (error) {
        console.error('Erro ao gerar Auto de Infração Ambiental:', error);
        if (numSequencial && categoriaAtual && categoriaAtual.id) {
            try {
                await devolverNumeroSequencialCompleto(categoriaAtual.id, numSequencial);
            } catch (e) { }
        }
        alert('Ocorreu um erro ao gerar o Auto de Infração Ambiental: ' + (error.message || 'Erro desconhecido'));
    } finally {
        if (btnSalvarForm) {
            btnSalvarForm.textContent = oldTexto;
            btnSalvarForm.disabled = false;
        }
    }
}

// --- GERADOR DE AUTO DE FISCALIZAÇÃO / MEIO AMBIENTE (WYSIWYG) ---
async function abrirEditorAutoFiscalizacaoMeioAmbiente() {
    if (!categoriaAtual) return;
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
        alert(`Preencha os dados obrigatórios do Auto de Fiscalização / Meio Ambiente antes de gerar o documento.`);
        return;
    }

    const btnSalvarForm = document.querySelector('#modal-produtividade .btn-salvar');
    const oldTexto = btnSalvarForm ? btnSalvarForm.textContent : 'Gerar Documento';
    if (btnSalvarForm) {
        btnSalvarForm.textContent = 'Carregando...';
        btnSalvarForm.disabled = true;
    }

    let numSequencial = null;
    try {
        numSequencial = await gerarNumeroSequencial(categoriaAtual.id);

        const rascunho = await criarRascunhoControleProcessual(campos, categoriaAtual.id, numSequencial);
        rascunhoDocumento = {
            id: rascunho.id,
            numero_sequencial: rascunho.numero_sequencial,
            categoria_id: categoriaAtual.id,
            campos: campos
        };

        const { data: { user } } = await getAuthUser();
        let nomeFiscal = 'Nome do Fiscal';
        let matriculaFiscal = 'XXXXXXXX';
        if (user) {
            const { data: perfil } = await supabaseClient
                .from('profiles')
                .select('full_name, matricula')
                .eq('id', user.id)
                .maybeSingle();
            if (perfil && perfil.full_name) nomeFiscal = perfil.full_name.replace(/Julio Cesar/gi, 'Júlio César');
            if (perfil && perfil.matricula) matriculaFiscal = perfil.matricula;
        }

        const imgBase64 = typeof CABECALHO_AUTO_FISCALIZACAO_BASE64 !== 'undefined'
            ? CABECALHO_AUTO_FISCALIZACAO_BASE64
            : await obterBase64Cabecalho();

        const hoje = new Date();
        const diaHoje = String(hoje.getDate()).padStart(2, '0');
        const mesHoje = String(hoje.getMonth() + 1).padStart(2, '0');
        const anoHoje = hoje.getFullYear();
        const dataAssinatura = `${diaHoje}/${mesHoje}/${anoHoje}`;

        const enderecoAutuadoStr = `${campos.rua_autuado || ''}${campos.rua_autuado && campos.numero_autuado ? ', ' : ''}${campos.numero_autuado || ''}`;
        const enderecoImovelStr = `${campos.rua_imovel || ''}${campos.rua_imovel && campos.numero_imovel ? ', ' : ''}${campos.numero_imovel || ''}`;

        let htmlAssinaturas = '';
        if (campos.tem_testemunhas === 'Sim') {
            htmlAssinaturas = `
            <br><br>
            <p align="center" style="margin: 0;">
                ________________________________________________<br>
                ${nomeFiscal}<br>
                Matrícula: ${matriculaFiscal}
            </p>
            <br><br>
            <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                    <td width="50%" align="center" valign="top">
                        ____________________________________<br>
                        Testemunha 1<br>
                        ${campos.nome_testemunha_1 || ''}<br>
                        CPF: ${campos.cpf_testemunha_1 || ''}
                    </td>
                    <td width="50%" align="center" valign="top">
                        ____________________________________<br>
                        Testemunha 2<br>
                        ${campos.nome_testemunha_2 || ''}<br>
                        CPF: ${campos.cpf_testemunha_2 || ''}
                    </td>
                </tr>
            </table>
            <br><br>`;
        } else {
            htmlAssinaturas = `
            <br><br>
            <p align="center" style="margin: 0;">
                ________________________________________________<br>
                ${nomeFiscal}<br>
                Matrícula: ${matriculaFiscal}
            </p>
            <br><br>`;
        }

        const htmlTemplate = `
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
            <tr>
                <td align="center">
                    <img src="${imgBase64}" width="650" style="width: 490pt; height: auto; display: block;">
                </td>
            </tr>
        </table>
        
        <p align="center" style="font-weight: bold; font-size: 14pt; margin: 0;">AUTO DE FISCALIZAÇÃO- N°${numSequencial}</p>
        <p align="center" style="font-weight: bold; font-size: 14pt; margin: 0;">Fiscalização Ambiental</p>
        <p align="right" style="margin: 0;">Divinópolis - MG &nbsp;&nbsp; ${dataAssinatura}</p>
        
        <p style="margin-top: 20px; margin-bottom: 5px;"><strong>Informações do Autuado</strong></p>
        <table width="100%" border="1" cellspacing="0" cellpadding="8" style="border-collapse: collapse; border: 1px solid black;">
            <tr>
                <td style="border: 1px solid black; padding: 8px;">Nome do(a) autuado(a): ${campos.nome}</td>
                <td style="border: 1px solid black; padding: 8px;">CNPJ/CPF: ${campos.cpf_contribuinte}</td>
            </tr>
            <tr>
                <td style="border: 1px solid black; padding: 7px;">Endereço: ${enderecoAutuadoStr}</td>
                <td style="border: 1px solid black; padding: 7px;">Bairro: ${campos.bairro_autuado}</td>
            </tr>
            <tr>
                <td style="border: 1px solid black; padding: 7px;">Município: ${campos.municipio_autuado}</td>
                <td style="border: 1px solid black; padding: 7px;">CEP: ${campos.cep_autuado}</td>
            </tr>
        </table>

        <p style="margin-top: 20px; margin-bottom: 5px;"><strong>Local da Autuação</strong></p>
        <table width="100%" border="1" cellspacing="0" cellpadding="7" style="border-collapse: collapse; border: 1px solid black;">
            <tr>
                <td style="border: 1px solid black; padding: 7px;">Endereço: ${enderecoImovelStr}</td>
                <td style="border: 1px solid black; padding: 7px;">Bairro: ${campos.bairro}</td>
            </tr>
            <tr>
                ${campos.inscricao ? `
                <td width="50%" style="border: 1px solid black; padding: 7px;">CEP: ${campos.cep_imovel}</td>
                <td width="50%" style="border: 1px solid black; padding: 7px;">Inscrição: ${campos.inscricao}</td>
                ` : `
                <td colspan="2" style="border: 1px solid black; padding: 7px;">CEP: ${campos.cep_imovel}</td>
                `}
            </tr>
        </table>

        <p style="margin-top: 20px; margin-bottom: 5px;"><strong>Irregularidades Constatadas:</strong></p>
        <table width="100%" border="1" cellspacing="0" cellpadding="7" style="border-collapse: collapse; border: 1px solid black;">
            <tr>
                <td style="border: 1px solid black; padding: 7px; text-align: justify;">${campos.irregularidades}</td>
            </tr>
        </table>

        <p style="margin-top: 20px; margin-bottom: 5px;"><strong>Providências:</strong></p>
        <table width="100%" border="1" cellspacing="0" cellpadding="7" style="border-collapse: collapse; border: 1px solid black;">
            <tr>
                <td style="border: 1px solid black; padding: 7px; text-align: justify;">${campos.providencias || ''}</td>
            </tr>
        </table>

        <p style="margin-top: 20px; margin-bottom: 5px;"><strong>Dispositivo(s) legal(is) transgredido(s):</strong></p>
        <table width="100%" border="0" cellspacing="0" cellpadding="7" style="border-collapse: collapse;">
            <tr>
                <td style="border-bottom: 1px solid black; padding: 9px; text-align: justify;">${campos.dispositivos}</td>
            </tr>
        </table>

        <table width="100%" border="0" cellspacing="0" cellpadding="7" style="border-collapse: collapse; margin-top: 20px;">
            <tr>
                <td style="border-bottom: 1px solid black; padding: 9px; text-align: justify;">O não cumprimento do presente auto de fiscalização, sujeitará o infrator às penalidades previstas no <strong>${campos.penalidades}</strong>.</td>
            </tr>
        </table>

        <p style="margin-top: 20px; text-align: justify;">O(a) autuado(a) deverá apresentar defesa, por escrito, no Processo Administrativo n° ${campos.processo_administrativo}, no prazo máximo de <strong>${campos.prazo_defesa} dias</strong>, a contar da data do recebimento deste. A defesa e documentos deverão ser encaminhados pelo link:<br>
        <a href="https://servicos.prefeituradivinopolis.com.br/govdigital/Microsservicos/instrucao/200" target="_blank" style="color: blue; text-decoration: none;">https://servicos.prefeituradivinopolis.com.br/govdigital/Microsservicos/instrucao/200</a></p>

        <p style="margin-top: 20px; text-align: justify;">${campos.tem_testemunhas === 'Sim' ? 'O Auto de Fiscalização, lavrado em três vias, que vai assinado pelo fiscal, pelo representante ou técnico do estabelecimento, e na ausência ou recusa destes últimos, será assinado por duas testemunhas.' : 'O Auto de Fiscalização, lavrado em três vias, que vai assinado pelo fiscal, pelo representante ou técnico do estabelecimento, e na ausência ou recusa destes últimos, será assinado por duas testemunhas.'}</p>

        ${htmlAssinaturas}

        <table width="100%" border="1" cellspacing="0" cellpadding="7" style="border-collapse: collapse; border: 1px solid black; margin-top: 40px;">
            <tr>
                <td width="75%" valign="top" style="border: 1px solid black; padding: 7px;">
                    <p style="margin: 0;">Assinatura do Autuado:</p>
                    <br><br><br>
                </td>
                <td width="25%" valign="top" style="border: 1px solid black; padding: 7px;">
                    <p style="margin: 0;">Ciente em:</p>
                    <br><br>
                    <p style="margin: 0; text-align: center;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/</p>
                </td>
            </tr>
        </table>
        `;

        const editor = document.getElementById('editor-texto');
        editor.innerHTML = htmlTemplate;

        document.getElementById('modal-produtividade').classList.remove('ativo');
        document.getElementById('modal-editor-documento').style.display = 'flex';

    } catch (error) {
        console.error('Erro ao preparar documento:', error);
        if (numSequencial && categoriaAtual && categoriaAtual.id) {
            try {
                await devolverNumeroSequencialCompleto(categoriaAtual.id, numSequencial);
            } catch (e) { }
        }
        alert('Ocorreu um erro ao gerar o documento. O número sequencial foi revertido. Tente novamente.');
    } finally {
        if (btnSalvarForm) {
            btnSalvarForm.textContent = oldTexto;
            btnSalvarForm.disabled = false;
        }
    }
}

// --- GERADOR DE DOCX (AUTO DE FISCALIZACAO AMBIENTAL) ---
async function gerarDocxAutoFiscalizacaoAmbiental(campos, numSequencial, nomeFiscal, matriculaFiscal, dataAssinatura) {
    const base64 = typeof MODELO_AUTO_INFRACAO_AMBIENTAL_BASE64 !== 'undefined' ? MODELO_AUTO_INFRACAO_AMBIENTAL_BASE64 : '';
    if (!base64) throw new Error('Modelo DOCX para Auto de Fiscalização Ambiental não encontrado.');

    const zip = await JSZip.loadAsync(base64, { base64: true });
    let docXml = await zip.file('word/document.xml').async('string');

    // Mudar "Auto de Infração" para "Auto de Fiscalização"
    docXml = docXml.replace(/AUTO DE INFRAÇÃO/g, 'AUTO DE FISCALIZAÇÃO');
    docXml = docXml.replace(/Auto de Infração/g, 'Auto de Fiscalização');
    docXml = docXml.replace(/auto de infração/g, 'auto de fiscalização');

    let dataInfracaoFormatada = '';
    if (campos.data) {
        const p = campos.data.split('-');
        if (p.length === 3) dataInfracaoFormatada = `${p[2]}/${p[1]}/${p[0]}`;
    }

    const enderecoAutuado = `${campos.rua_autuado || ''}${campos.numero_autuado ? ', ' + campos.numero_autuado : ''}`;
    const enderecoImovel = `${campos.rua_imovel || ''}${campos.numero_imovel ? ', ' + campos.numero_imovel : ''}`;

    let textoReferencia = '';
    if (campos.tipo_documento_referencia) {
        const numRef = campos.numero_documento_referencia || '';
        textoReferencia = `${campos.tipo_documento_referencia}${numRef ? ' nº ' + numRef : ''}`;
    }

    const processo = campos.processo_administrativo || '';
    const prazoDefesa = campos.prazo_defesa || '20';

    let idxEndereco = 0;
    let idxBairro = 0;
    let idxCep = 0;
    let paragrafoTestemunha1 = '';

    docXml = docXml.replace(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g, (match) => {
        const texto = textoDoParagrafo(match);

        if (texto.trim() === 'Endereço:' || texto === 'Endereço: ') {
            idxEndereco++;
            const novo = idxEndereco === 1 ? `Endereço: ${enderecoAutuado}` : `Endereço: ${enderecoImovel}`;
            return substituirTextoParagrafo(match, novo);
        }
        if (texto.trim() === 'Bairro:' || texto === 'Bairro: ') {
            idxBairro++;
            const novo = idxBairro === 1 ? `Bairro: ${campos.bairro_autuado || ''}` : `Bairro: ${campos.bairro || ''}`;
            return substituirTextoParagrafo(match, novo);
        }
        if (texto.trim() === 'CEP:' || texto === 'CEP: ') {
            idxCep++;
            const novo = idxCep === 1 ? `CEP: ${campos.cep_autuado || ''}` : `CEP: ${campos.cep_imovel || ''}`;
            return substituirTextoParagrafo(match, novo);
        }
        if (texto.includes('N°XXXX/20XX')) {
            return substituirTextoParagrafo(match, texto.replace('N°XXXX/20XX', `N°${numSequencial}`));
        }
        if (texto.includes('XX/XX/20XX')) {
            return substituirTextoParagrafo(match, texto.replace('XX/XX/20XX', dataAssinatura));
        }
        if (texto.includes('Processo Administrativo n°')) {
            return substituirTextoParagrafo(match, `Processo Administrativo n° ${processo}`);
        }
        if (texto.includes('Auto de Fiscalização xxxx (Campo Opcional)')) {
            return substituirTextoParagrafo(match, textoReferencia || texto);
        }
        if (texto.includes('Nome do(a) autuado(a):')) {
            return substituirTextoParagrafo(match, `Nome do(a) autuado(a): ${campos.nome || ''}`);
        }
        if (texto.includes('CNPJ/CPF:')) {
            return substituirTextoParagrafo(match, `CNPJ/CPF: ${campos.cpf_contribuinte || ''}`);
        }
        if (texto.includes('Município:')) {
            return substituirTextoParagrafo(match, `Município: ${campos.municipio_autuado || ''}`);
        }
        if (texto.includes('Inscrição:')) {
            if (!campos.inscricao) return removerParagrafo(match);
            return substituirTextoParagrafo(match, `Inscrição: ${campos.inscricao}`);
        }
        if (texto === 'Data:' || texto === 'Data: ') {
            if (!campos.data) return removerParagrafo(match);
            return substituirTextoParagrafo(match, `Data: ${dataInfracaoFormatada}`);
        }
        if (texto === 'Hora:' || texto === 'Hora: ') {
            if (!campos.hora_infracao) return removerParagrafo(match);
            return substituirTextoParagrafo(match, `Hora: ${campos.hora_infracao}`);
        }
        if (texto.includes('Reincidente')) {
            if (!campos.reincidente) return removerParagrafo(match);
            return substituirTextoParagrafo(match, `Reincidente: ${campos.reincidente}`);
        }
        if (texto.includes('Descrição/Fato Constitutivo')) {
            return substituirTextoParagrafo(match, `Descrição/Fato Constitutivo da infração: ${campos.irregularidades || ''}`);
        }
        if (texto.includes('Providências') || texto.includes('Providencias')) {
            return substituirTextoParagrafo(match, `Providências: ${campos.providencias || ''}`);
        }
        if (texto.includes('Dispositivo(s) legal(is) transgredido(s)')) {
            return substituirTextoParagrafo(match, `Dispositivo(s) legal(is) transgredido(s): ${campos.dispositivos || ''}`);
        }
        if (texto.includes('PENALIDADE(S)')) {
            return substituirTextoParagrafo(match, `PENALIDADE(S): ${campos.penalidades || ''}`);
        }
        if (texto.includes('prazo máximo de')) {
            let novo = texto.replace(/Processo Administrativo n°\s*XXXX/, `Processo Administrativo n° ${processo}`);
            novo = novo.replace(/(\d+)\s*dias/, `${prazoDefesa} dias`);
            return substituirTextoParagrafo(match, novo);
        }
        if (texto.includes('Testemunha 1 NOME')) {
            if (campos.tem_testemunhas !== 'Sim') return removerParagrafo(match);
            paragrafoTestemunha1 = match;
            return substituirTextoParagrafo(match, `Testemunha 1 ${campos.nome_testemunha_1 || ''}`);
        }
        if (texto.includes('CPF :')) {
            if (campos.tem_testemunhas !== 'Sim') return removerParagrafo(match);
            return substituirTextoParagrafo(match, `CPF: ${campos.cpf_testemunha_1 || ''}`);
        }
        if (texto === 'NOME') {
            return substituirTextoParagrafo(match, nomeFiscal || '');
        }
        if (texto.includes('Matrícula')) {
            return substituirTextoParagrafo(match, `Matrícula: ${matriculaFiscal || ''}`);
        }
        return match;
    });

    if (campos.tem_testemunhas === 'Sim' && paragrafoTestemunha1 && (campos.nome_testemunha_2 || campos.cpf_testemunha_2)) {
        const pTestemunha2 = substituirTextoParagrafo(paragrafoTestemunha1, `Testemunha 2 ${campos.nome_testemunha_2 || ''}`);
        const pCpf1 = encontrarParagrafos(docXml, t => t.includes('CPF:'));
        if (pCpf1.length > 0) {
            const ultimoCpf = pCpf1[pCpf1.length - 1];
            const pCpf2 = substituirTextoParagrafo(ultimoCpf, `CPF: ${campos.cpf_testemunha_2 || ''}`);
            docXml = docXml.replace(ultimoCpf, ultimoCpf + pTestemunha2 + pCpf2);
        } else {
            docXml = docXml.replace(paragrafoTestemunha1, paragrafoTestemunha1 + pTestemunha2);
        }
    }

    zip.file('word/document.xml', docXml);
    return await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
}

// --- GERADOR DE OFÍCIO (WYSIWYG) ---
async function abrirEditorOficio() {
    if (!categoriaAtual) return;
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

    const extraCheckboxes = document.querySelectorAll('.cb-fiscal-extra-ma:checked');
    if (extraCheckboxes.length > 0) {
        campos.fiscais_adicionais = Array.from(extraCheckboxes).map(cb => ({
            id: cb.value,
            nome: cb.getAttribute('data-nome'),
            cpf: cb.getAttribute('data-cpf'),
            matricula: cb.getAttribute('data-matricula')
        }));
    }

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

    let numSequencial = null;
    try {
        // Gera número sequencial online e cria rascunho no banco para reservar o número
        numSequencial = await gerarNumeroSequencial('1.4');

        // Salva rascunho sem pontuação e sem anexo (reserva o número)
        const rascunho = await criarRascunhoControleProcessual(campos, categoriaAtual.id, numSequencial);
        rascunhoDocumento = {
            id: rascunho.id,
            numero_sequencial: rascunho.numero_sequencial,
            categoria_id: categoriaAtual.id,
            campos: campos
        };

        // Pegar informações do Fiscal (Nome logado e Matrícula) e Data de Hoje para Assinatura
        const authResponse = await getAuthUser();
        const user = authResponse?.data?.user;
        let nomeFiscal = 'Nome do Fiscal';
        let matriculaFiscal = 'XXXXXXXX';
        if (user) {
            const { data: perfil } = await supabaseClient
                .from('profiles')
                .select('full_name, matricula')
                .eq('id', user.id)
                .maybeSingle();
            if (perfil && perfil.full_name) nomeFiscal = perfil.full_name.replace(/Julio Cesar/gi, 'Júlio César');
            if (perfil && perfil.matricula) matriculaFiscal = perfil.matricula;
        }

        const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
        const hoje = new Date();
        const diaHoje = hoje.getDate();
        const mesHoje = meses[hoje.getMonth()];
        const anoHoje = hoje.getFullYear();
        const dataPorExtenso = `Divinópolis, ${diaHoje} de ${mesHoje} de ${anoHoje}.`;


        // 2. Prepara HTML do Documento
        const imgBase64 = await obterBase64Cabecalho();
        let htmlTemplate = `
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
            <tr>
                <td align="center">
                    <img src="${imgBase64}" width="650" style="width: 490pt; height: auto; display: block;">
                </td>
            </tr>
        </table>

        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 40px;">
            <p style="font-weight: bold; margin: 0;">OFÍCIO SEMAC- DMA Nº ${numSequencial}</p>
            <p style="margin: 0;">${dataPorExtenso}</p>
        </div>

        <p style="margin-bottom: 20px;">
            Ao Senhor(a)<br>
            <strong>${campos.nome}</strong><br>
            <strong>CPF/CNPJ:</strong> ${campos.cpf_contribuinte || '_________________'}
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
    `;

        const todosFiscais = [
            { nome: nomeFiscal, cargo: obterTituloFiscal(), matricula: matriculaFiscal },
            ...(campos.fiscais_adicionais || []).map(f => ({ nome: f.nome, cargo: 'Fiscal de Meio Ambiente', matricula: f.matricula || 'XXXXXXXX' }))
        ];

        let assinaturasHtml = '';
        let itensPorLinha = (todosFiscais.length === 4) ? 2 : 3;
        let widthStr = (itensPorLinha === 2) ? "50%" : "33%";
        for (let i = 0; i < todosFiscais.length; i += itensPorLinha) {
            const rowFiscais = todosFiscais.slice(i, i + itensPorLinha);
            assinaturasHtml += '<table width="100%" style="margin-top: 60px; border-collapse: collapse; text-align: center; page-break-inside: avoid; break-inside: avoid;"><tr>';
            rowFiscais.forEach(f => {
                assinaturasHtml += `
                    <td align="center" style="width: ${widthStr}; vertical-align: top; padding: 0 5px; text-align: center;">
                        <p align="center" style="margin: 0; text-align: center;">_________________________________</p>
                        <p align="center" style="margin: 5px 0 0 0; text-align: center;"><strong>${f.nome}</strong></p>
                        <p align="center" style="margin: 2px 0 0 0; text-align: center;">${f.cargo}</p>
                        <p align="center" style="margin: 2px 0 0 0; text-align: center;">Matrícula: ${f.matricula}</p>
                    </td>
                `;
            });
            for (let j = rowFiscais.length; j < itensPorLinha; j++) {
                assinaturasHtml += '<td style="width: ' + widthStr + ';"></td>';
            }
            assinaturasHtml += '</tr></table>';
        }

        htmlTemplate += assinaturasHtml;

        // 3. Exibe Modal
        const editor = document.getElementById('editor-texto');
        editor.innerHTML = htmlTemplate;

        document.getElementById('modal-editor-documento').style.display = 'flex';

    } catch (error) {
        console.error('Erro ao preparar ofício:', error);
        if (numSequencial && categoriaAtual && categoriaAtual.id) {
            try {
                await devolverNumeroSequencialCompleto(categoriaAtual.id, numSequencial);
            } catch (e) { }
        }
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
    if (!categoriaAtual) return;
    // 1. Coleta e valida dados
    const campos = {};
    let todosPreenchidos = true;

    categoriaAtual.campos.forEach(campo => {
        if (campo.tipo === 'file' || campo.tipo === 'imagens_com_legenda') return;
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

    const extraCheckboxes = document.querySelectorAll('.cb-fiscal-extra-ma:checked');
    if (extraCheckboxes.length > 0) {
        campos.fiscais_adicionais = Array.from(extraCheckboxes).map(cb => ({
            id: cb.value,
            nome: cb.getAttribute('data-nome'),
            cpf: cb.getAttribute('data-cpf'),
            matricula: cb.getAttribute('data-matricula')
        }));
    }

    // Coleta imagens com legenda (lê como base64)
    campos.imagensExtras = [];
    const itensImg = document.querySelectorAll('.item-imagem-legenda');
    for (const item of itensImg) {
        const fileInput = item.querySelector('.imagem-arquivo');
        const legendaInput = item.querySelector('.imagem-legenda');
        if (fileInput && fileInput.files && fileInput.files[0] && legendaInput && legendaInput.value) {
            const file = fileInput.files[0];
            const base64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result);
                reader.readAsDataURL(file);
            });
            campos.imagensExtras.push({
                base64: base64,
                legenda: legendaInput.value.trim()
            });
        }
    }

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

    let numSequencial = null;
    try {
        // Gera número sequencial online e cria rascunho no banco para reservar o número
        numSequencial = await gerarNumeroSequencial(categoriaAtual.id);

        // Salva rascunho sem pontuação e sem anexo (reserva o número)
        const rascunho = await criarRascunhoControleProcessual(campos, categoriaAtual.id, numSequencial);
        rascunhoDocumento = {
            id: rascunho.id,
            numero_sequencial: rascunho.numero_sequencial,
            categoria_id: categoriaAtual.id,
            campos: campos
        };

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
            if (perfil && perfil.full_name) nomeFiscal = perfil.full_name.replace(/Julio Cesar/gi, 'Júlio César');
            if (perfil && perfil.matricula) matriculaFiscal = perfil.matricula;
        }

        const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
        const hoje = new Date();
        const diaHoje = hoje.getDate();
        const mesHoje = meses[hoje.getMonth()];
        const anoHoje = hoje.getFullYear();
        const dataPorExtenso = `Divinópolis, ${diaHoje} de ${mesHoje} de ${anoHoje}.`;
        const dataFormatada = `${String(diaHoje).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${anoHoje}`;

        const imgBase64 = await obterBase64Cabecalho();
        let htmlTemplate = '';
        let imagensExtrasHtml = '';

        if (categoriaAtual.id === '1.5.MA') {
            const enderecoImovelStr = `${campos.rua_imovel || ''}${campos.rua_imovel && campos.numero_imovel ? ', ' : ''}${campos.numero_imovel || ''}`;
            const dataAssinatura = `${String(diaHoje).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${anoHoje}`;

            if (campos.imagensExtras && campos.imagensExtras.length > 0) {
                // Margem superior maior pois as imagens ficarão após as assinaturas
                imagensExtrasHtml += '<div style="margin-top: 60px; text-align: center; font-size: 0;">';
                campos.imagensExtras.forEach(img => {
                    imagensExtrasHtml += `
                    <div style="display: inline-block; width: 48%; margin: 1%; vertical-align: top; font-size: 12pt; page-break-inside: avoid; break-inside: avoid;">
                        <p style="font-size: 12pt; margin-bottom: 10px; font-weight: bold; text-align: center;">Foto do Local</p>
                        <img src="${img.base64}" title="Clique para redimensionar" onclick="const p = prompt('Largura da imagem (ex: 100% para linha inteira, 48% para lado a lado):', this.parentElement.style.width); if(p) this.parentElement.style.width = p;" style="max-width: 100%; height: auto; border: 1px solid #ccc; display: block; margin: 0 auto; cursor: pointer;">
                        <p style="font-size: 11pt; margin-top: 10px; font-style: italic;">${img.legenda}</p>
                        <p style="font-size: 11pt; margin-top: 5px; text-align: center;">Fonte: Autoria Própria, ${anoHoje}</p>
                    </div>`;
                });
                imagensExtrasHtml += '</div>';
            }

            let dataVistoriaFmt = campos.data_vistoria ? campos.data_vistoria.split('-').reverse().join('/') : 'XX/XX/XXXX';
            let horaVistoriaFmt = campos.hora_vistoria || '__:__';

            htmlTemplate = `
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
            <tr>
                <td align="center">
                    <img src="${imgBase64}" width="650" style="width: 490pt; height: auto; display: block;">
                </td>
            </tr>
        </table>
        
        <p align="center" style="font-weight: bold; font-size: 14pt; margin: 0;">RELATÓRIO FISCAL N°${numSequencial}</p>
        <p align="center" style="font-weight: bold; font-size: 14pt; margin: 0;">Fiscalização Ambiental</p>
        <p align="right" style="margin: 0;">Divinópolis - MG &nbsp;&nbsp; ${dataAssinatura}</p>
        
        <p style="margin-top: 20px; margin-bottom: 5px;"><strong>Local da Autuação</strong></p>
        <table width="100%" border="1" cellspacing="0" cellpadding="7" style="border-collapse: collapse; border: 1px solid black;">
            <tr>
                <td style="border: 1px solid black; padding: 7px;">Endereço: ${enderecoImovelStr}</td>
                <td style="border: 1px solid black; padding: 7px;">Bairro: ${campos.bairro || ''}</td>
            </tr>
            <tr>
                ${campos.inscricao ? `
                <td width="50%" style="border: 1px solid black; padding: 7px;">CEP: ${campos.cep_imovel || ''}</td>
                <td width="50%" style="border: 1px solid black; padding: 7px;">Inscrição: ${campos.inscricao || ''}</td>
                ` : `
                <td colspan="2" style="border: 1px solid black; padding: 7px;">CEP: ${campos.cep_imovel || ''}</td>
                `}
            </tr>
        </table>

        ${campos.origem_tipo ? `<p style="margin-top: 20px; text-align: justify;"><strong>${campos.origem_tipo}${campos.origem_numero ? ' N°' : ''}: </strong> ${campos.origem_numero || ''}</p>` : ''}
        
        <p style="margin-top: 10px; text-align: justify;"><strong>Assunto: </strong> ${campos.assunto || ''}</p>

        <p style="margin-top: 20px; text-align: justify;">Em atendimento à denúncia acima descrita, estivemos no local no dia ${dataVistoriaFmt}, às ${horaVistoriaFmt}h para averiguar a situação. Em vistoria, verificamos ${campos.verificacao || ''}</p>
            `;
        } else {
            htmlTemplate = `
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
            <tr>
                <td align="center">
                    <img src="${imgBase64}" width="650" style="width: 490pt; height: auto; display: block;">
                </td>
            </tr>
        </table>

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
    `;
        }

        const todosFiscais = [
            { nome: nomeFiscal, cargo: obterTituloFiscal(), matricula: matriculaFiscal },
            ...(campos.fiscais_adicionais || []).map(f => ({ nome: f.nome, cargo: 'Fiscal de Meio Ambiente', matricula: f.matricula || 'XXXXXXXX' }))
        ];

        let assinaturasHtml = '';
        let itensPorLinha = (todosFiscais.length === 4) ? 2 : 3;
        let widthStr = (itensPorLinha === 2) ? "50%" : "33%";
        for (let i = 0; i < todosFiscais.length; i += itensPorLinha) {
            const rowFiscais = todosFiscais.slice(i, i + itensPorLinha);
            assinaturasHtml += '<table width="100%" style="margin-top: 60px; border-collapse: collapse; text-align: center; page-break-inside: avoid; break-inside: avoid;"><tr>';
            rowFiscais.forEach(f => {
                assinaturasHtml += `
                    <td align="center" style="width: ${widthStr}; vertical-align: top; padding: 0 5px; text-align: center;">
                        <p align="center" style="margin: 0; text-align: center;">_________________________________</p>
                        <p align="center" style="margin: 5px 0 0 0; text-align: center;"><strong>${f.nome}</strong></p>
                        <p align="center" style="margin: 2px 0 0 0; text-align: center;">${f.cargo}</p>
                        <p align="center" style="margin: 2px 0 0 0; text-align: center;">Matrícula: ${f.matricula}</p>
                    </td>
                `;
            });
            for (let j = rowFiscais.length; j < itensPorLinha; j++) {
                assinaturasHtml += '<td style="width: ' + widthStr + ';"></td>';
            }
            assinaturasHtml += '</tr></table>';
        }
        htmlTemplate += assinaturasHtml;
        htmlTemplate += imagensExtrasHtml;

        // 3. Exibe Modal
        const editor = document.getElementById('editor-texto');
        editor.innerHTML = htmlTemplate;

        document.getElementById('modal-produtividade').classList.remove('ativo'); // esconde o form
        document.getElementById('modal-editor-documento').style.display = 'flex';

    } catch (error) {
        console.error('Erro ao preparar relatório:', error);
        if (numSequencial && categoriaAtual && categoriaAtual.id) {
            try {
                await devolverNumeroSequencialCompleto(categoriaAtual.id, numSequencial);
            } catch (e) { }
        }
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
    if (!categoriaAtual) return;
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

    let numSequencial = null;
    try {
        // Gera número sequencial online e cria rascunho no banco para reservar o número
        numSequencial = await gerarNumeroSequencial('1.7');

        // Salva rascunho sem pontuação e sem anexo (reserva o número)
        const rascunho = await criarRascunhoControleProcessual(campos, categoriaAtual.id, numSequencial);
        rascunhoDocumento = {
            id: rascunho.id,
            numero_sequencial: rascunho.numero_sequencial,
            categoria_id: categoriaAtual.id,
            campos: campos
        };

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
            if (perfil && perfil.full_name) nomeFiscal = perfil.full_name.replace(/Julio Cesar/gi, 'Júlio César');
            if (perfil && perfil.matricula) matriculaFiscal = perfil.matricula;
        }

        const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
        const hoje = new Date();
        const diaHoje = hoje.getDate();
        const mesHoje = meses[hoje.getMonth()];
        const anoHoje = hoje.getFullYear();
        const dataPorExtenso = `Divinópolis, ${diaHoje} de ${mesHoje} de ${anoHoje}.`;

        const imgBase64 = await obterBase64Cabecalho();
        const htmlTemplate = `
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
            <tr>
                <td align="center">
                    <img src="${imgBase64}" width="650" style="width: 490pt; height: auto; display: block;">
                </td>
            </tr>
        </table>

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
        if (numSequencial && categoriaAtual && categoriaAtual.id) {
            try {
                await devolverNumeroSequencialCompleto('1.7', numSequencial);
            } catch (e) { }
        }
        alert('Ocorreu um erro ao processar os dados da réplica.');
    } finally {
        if (btnSalvarForm) {
            btnSalvarForm.textContent = oldTexto;
            btnSalvarForm.disabled = false;
        }
    }
}

// FUNÇÃO: ABRIR EDITOR CERTIDÃO DO FISCAL
// ==========================================
async function abrirEditorCertidao() {
    if (!categoriaAtual) return;
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
        alert('Preencha os dados obrigatórios da Certidão antes de gerar o documento.');
        return;
    }

    const btnSalvarForm = document.querySelector('#modal-produtividade .btn-salvar');
    const oldTexto = btnSalvarForm ? btnSalvarForm.textContent : 'Gerar Documento';
    if (btnSalvarForm) {
        btnSalvarForm.textContent = 'Carregando...';
        btnSalvarForm.disabled = true;
    }

    let numSequencial = null;
    try {
        numSequencial = await gerarNumeroSequencial('1.8');

        const rascunho = await criarRascunhoControleProcessual(campos, categoriaAtual.id, numSequencial);
        rascunhoDocumento = {
            id: rascunho.id,
            numero_sequencial: rascunho.numero_sequencial,
            categoria_id: categoriaAtual.id,
            campos: campos
        };

        const { data: { user } } = await getAuthUser();
        let nomeFiscal = 'Nome do Fiscal';
        let matriculaFiscal = 'XXXXXXXX';

        if (user) {
            const { data: perfil } = await supabaseClient
                .from('profiles')
                .select('full_name, matricula')
                .eq('id', user.id)
                .maybeSingle();
            if (perfil && perfil.full_name) nomeFiscal = perfil.full_name.replace(/Julio Cesar/gi, 'Júlio César');
            if (perfil && perfil.matricula) matriculaFiscal = perfil.matricula;
        }

        const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
        const hoje = new Date();
        const diaHoje = hoje.getDate();
        const mesHoje = meses[hoje.getMonth()];
        const anoHoje = hoje.getFullYear();
        const dataPorExtenso = `Divinópolis, ${diaHoje} de ${mesHoje} de ${anoHoje}.`;

        const imgBase64 = await obterBase64Cabecalho();

        // Format dates correctly from YYYY-MM-DD to DD/MM/YYYY
        const formatData = (d) => {
            if (!d) return '';
            const p = d.split('-');
            if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
            return d;
        };

        const dataCienciaFmt = formatData(campos.data_ciencia);
        const dataDefesaFmt = formatData(campos.data_defesa);
        const dataVistoriaFmt = formatData(campos.data_vistoria);

        const htmlTemplate = `
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
            <tr>
                <td align="center">
                    <img src="${imgBase64}" width="650" style="width: 490pt; height: auto; display: block;">
                </td>
            </tr>
        </table>

        <div style="text-align: center; margin-top: 30px; margin-bottom: 50px;">
            <p style="font-weight: bold; font-size: 14pt; margin: 0;">CERTIDÃO N° ${numSequencial}</p>
        </div>

        <p style="text-indent: 0px; line-height: 1.5; margin-bottom: 20px; text-align: justify;">
            Certifico que o autuado ${campos.nome} CPF ${campos.cpf}, com endereço de correspondência: ${campos.endereco_autuado}, não manifestou sobre a interposição de defesa <b>referente ao ${campos.digitado}</b> que teve ciência dia ${dataCienciaFmt} através dos correios aviso de recebimento (AR), com prazo para defesa até ${dataDefesaFmt}.
        </p>

        <p style="text-indent: 0px; line-height: 1.5; margin-bottom: 20px; text-align: justify;">
            Contudo, em vistoria realizada dia ${dataVistoriaFmt}, certificamos não cumprimento da obrigação de ${campos.obrigacao}. Conforme levantamento fotográfico.
        </p>
        <p style="margin-top: 60px; margin-bottom: 60px;">
            ${dataPorExtenso}
        </p>

        <div style="text-align: center; margin-top: 60px;">
            <p style="margin: 0;">_________________________________________</p>
            <p style="margin: 5px 0 0 0; font-weight: bold;">${nomeFiscal}</p>
            <p style="margin: 2px 0 0 0;">${obterTituloFiscal()}</p>
            <p style="margin: 2px 0 0 0;">Matrícula: ${matriculaFiscal}</p>
        </div>
    `;

        // 3. Exibe Modal
        const editor = document.getElementById('editor-texto');
        editor.innerHTML = htmlTemplate;

        document.getElementById('modal-produtividade').classList.remove('ativo'); // esconde o form
        document.getElementById('modal-editor-documento').style.display = 'flex';

    } catch (error) {
        console.error('Erro ao preparar a certidão:', error);
        if (numSequencial && categoriaAtual && categoriaAtual.id) {
            try {
                await devolverNumeroSequencialCompleto('1.8', numSequencial);
            } catch (e) { }
        }
        alert('Ocorreu um erro ao processar os dados da certidão.');
    } finally {
        if (btnSalvarForm) {
            btnSalvarForm.textContent = oldTexto;
            btnSalvarForm.disabled = false;
        }
    }
}

async function abrirEditorDividaAtiva() {
    if (!categoriaAtual) return;
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
        alert('Preencha os dados obrigatórios da Dívida Ativa antes de gerar o documento.');
        return;
    }

    const btnSalvarForm = document.querySelector('#modal-produtividade .btn-salvar');
    const oldTexto = btnSalvarForm ? btnSalvarForm.textContent : 'Gerar Documento';
    if (btnSalvarForm) {
        btnSalvarForm.textContent = 'Carregando...';
        btnSalvarForm.disabled = true;
    }

    let numSequencial = null;
    try {
        numSequencial = await gerarNumeroSequencial('11');

        const rascunho = await criarRascunhoControleProcessual(campos, categoriaAtual.id, numSequencial);
        rascunhoDocumento = {
            id: rascunho.id,
            numero_sequencial: rascunho.numero_sequencial,
            categoria_id: categoriaAtual.id,
            campos: campos
        };

        const { data: { user } } = await getAuthUser();
        let nomeFiscal = 'Nome do Fiscal';
        let matriculaFiscal = 'XXXXXXXX';
        if (user) {
            const { data: perfil } = await supabaseClient
                .from('profiles')
                .select('full_name, matricula')
                .eq('id', user.id)
                .maybeSingle();
            if (perfil && perfil.full_name) nomeFiscal = perfil.full_name.replace(/Julio Cesar/gi, 'Júlio César');
            if (perfil && perfil.matricula) matriculaFiscal = perfil.matricula;
        }

        const dataPartes = campos.data ? campos.data.split('-') : ['', '', ''];
        const dataFormatada = campos.data ? `${dataPartes[2]}/${dataPartes[1]}/${dataPartes[0]}` : '';

        const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
        const hoje = new Date();
        const diaHoje = hoje.getDate();
        const mesHoje = meses[hoje.getMonth()];
        const anoHoje = hoje.getFullYear();
        const dataPorExtenso = `Divinópolis, ${diaHoje} de ${mesHoje} de ${anoHoje}.`;

        const imgBase64 = await obterBase64Cabecalho();

        const htmlTemplate = `
    <table width="100%" border="1" cellspacing="0" cellpadding="0" style="border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12pt; margin-top: 25px;">
        <tr>
            <td align="center" style="height: 70px; padding: 8px;">
                <img src="${imgBase64}" width="650" style="width: 490pt; height: auto; display: block;">
            </td>
        </tr>

        <tr>
            <td style="text-align: center; font-weight: bold; font-size: 13pt; line-height: 1.5; padding: 18px;">
                PROCESSO ADMINISTRATIVO - SEMAC<br>
                Nº: ${numSequencial}
            </td>
        </tr>

        <tr>
            <td style="line-height: 1.5; padding: 7px;">
                <strong>Autuado(a):</strong> ${campos.nome || ''}
                <strong>cpf/cnpj:</strong> ${campos.cpf || '_________________'}<br>
                <strong>Advogado:</strong> ${campos.advogado || 'Não Apresentou'}</strong><br>
                <strong>Assunto:</strong> ${campos.n_auto || ''}
            </td>
        </tr>

        <tr>
            <td style="padding: 7px; font-weight: bold;">
                Data de Geração: ${new Date().toLocaleDateString('pt-BR')}<br>
                Agente Fiscal Responsável: ${nomeFiscal} - Matrícula: ${matriculaFiscal}
            </td>
        </tr>
    </table>
`;
        const editor = document.getElementById('editor-texto');
        editor.innerHTML = htmlTemplate;

        document.getElementById('modal-produtividade').classList.remove('ativo');
        document.getElementById('modal-editor-documento').style.display = 'flex';

    } catch (error) {
        console.error('Erro ao preparar Dívida Ativa:', error);
        if (numSequencial && categoriaAtual && categoriaAtual.id) {
            try {
                await devolverNumeroSequencialCompleto('11', numSequencial);
            } catch (e) { }
        }
        alert('Ocorreu um erro ao processar os dados do documento.');
    } finally {
        if (btnSalvarForm) {
            btnSalvarForm.textContent = oldTexto;
            btnSalvarForm.disabled = false;
        }
    }
}

async function fecharEditorDocumento() {
    if (rascunhoDocumento) {
        const confirmar = confirm('Você tem um documento em andamento. Se voltar ao formulário, o registro será cancelado e o número não será reservado. Deseja continuar?');
        if (!confirmar) return;
        await cancelarRascunhoDocumento();
    }
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
        } else if (catId === '1.9') {
            tipoNome = 'Auto_Fiscalizacao_MA';
            catNome = 'Auto de Fiscalização - MA';
        } else if (catId === '1.4') {
            tipoNome = 'Oficio';
            catNome = 'Ofício';
        } else if (catId === '1.5' || catId === '1.5.MA') {
            tipoNome = 'Relatorio';
            catNome = 'Relatório Fiscal';
        } else if (catId === '1.7') {
            tipoNome = 'Replica';
            catNome = 'Réplica Fiscal';
        } else if (catId === '1.8') {
            tipoNome = 'Certidao';
            catNome = 'Certidão Fiscal';
        } else if (catId === '11') {
            tipoNome = 'Divida_Ativa';
            catNome = 'Dívida Ativa';
        }

        // Adiciona as Metatags da Microsoft Office para interpretar o HTML como Word Nativo
        let fontStyle = "@page { size: 21cm 29.7cm; margin: 2cm } body { font-family: 'Times New Roman'; font-size: 12pt } table { font-family: 'Times New Roman'; font-size: 12pt }";
        if (catId === '1.9') {
            fontStyle = "@page { size: 21cm 29.7cm; margin: 2cm } body { font-family: 'Calibri', sans-serif; font-size: 10pt } table { font-family: 'Calibri', sans-serif; font-size: 10pt } td { font-size: 10pt }";
        }

        const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' " +
            "xmlns:w='urn:schemas-microsoft-com:office:word' " +
            "xmlns='http://www.w3.org/TR/REC-html40'>" +
            "<head><meta charset='utf-8'><title>" + catNome + "</title>" +
            "<style> " + fontStyle + " </style>" +
            "</head><body>";
        const footer = "</body></html>";

        // Clona para injetar tamanhos reais nas imagens para o MS Word
        const tempEditor = editor.cloneNode(true);
        const origImgs = editor.querySelectorAll('img');
        const cloneImgs = tempEditor.querySelectorAll('img');
        for (let i = 0; i < origImgs.length; i++) {
            if (origImgs[i].clientWidth > 0) {
                cloneImgs[i].setAttribute('width', origImgs[i].clientWidth);
                cloneImgs[i].setAttribute('height', origImgs[i].clientHeight);
                cloneImgs[i].style.width = origImgs[i].clientWidth + 'px';
                cloneImgs[i].style.height = origImgs[i].clientHeight + 'px';
                // Remove restrições de max-width para o Word
                cloneImgs[i].style.maxWidth = 'none';
            }
        }
        const sourceHTML = header + tempEditor.innerHTML + footer;

        // Usa o número do rascunho se existir; senão, gera um novo (compatibilidade com Ofício)
        const numSeqDownload = (rascunhoDocumento && rascunhoDocumento.categoria_id === catId)
            ? rascunhoDocumento.numero_sequencial
            : await gerarNumeroSequencial(catId);
        let nomeArquivo = `${tipoNome}_${numSeqDownload.replace('/', '-')}`;

        let blobDoc = null;
        let extensao = '.doc';

        if (rascunhoDocumento && rascunhoDocumento.blobDocx) {
            blobDoc = rascunhoDocumento.blobDocx;
            extensao = '.docx';
        } else {
            // Tratamento para caracteres UTF-8 no Blob MS-WORD HTML
            blobDoc = new Blob(['\ufeff', sourceHTML], { type: 'text/html;charset=utf-8' });
        }

        const url = URL.createObjectURL(blobDoc);
        const fileDownload = document.createElement("a");
        document.body.appendChild(fileDownload);
        fileDownload.href = url;
        fileDownload.download = `${nomeArquivo}${extensao}`;
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

        // Se há rascunho ativo, finaliza-o (anexo + pontuação). Senão, usa fluxo antigo.
        let usouRascunho = false;
        if (rascunhoDocumento && rascunhoDocumento.categoria_id === catId) {
            await finalizarDocumentoComAnexo(blobPdf, filenameSafe);
            usouRascunho = true;
        } else {
            await salvarRegistro(blobPdf, filenameSafe);
        }
        fecharEditorDocumento(); // fecha o frame do documento
        fecharModalProdutividade(); // fecha o formulário pai imediatamente
        await carregarHistorico(); // atualiza pontuação, gráfico e meta em tempo real

        if (usouRascunho) {
            if (catId === '1.2' || catId === '1.2.MA') {
                alert('Registros salvos com sucesso!\n\n• Auto de Infração (5 pontos)\n• Autos de Infração expedidos (30 pontos)\n\n 35 pontos salvos no total!');
            } else if (catId === '1.4') {
                alert('Registros salvos com sucesso!\n\n• Ofício (10 pontos)\n• Elaboração de Ofícios (15 pontos)\n\n 25 pontos salvos no total!');
            } else if (catId === '1.5' || catId === '1.5.MA') {
                alert('Registros salvos com sucesso!\n\n• Relatório (10 pontos)\n• Elaboração de Relatório Fiscal (50 pontos)\n\n 60 pontos salvos no total!');
            } else if (catId === '11') {
                alert(`Registro salvo com sucesso!\n\nSeu número de Dívida Ativa gerado é: ${numSeqDownload}`);
            } else {
                const pts = CATEGORIAS.find(c => c.id === catId)?.pontos || 0;
                alert('Registro salvo com sucesso! (' + pts + ' pontos)');
            }
        }
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
        .in('categoria_id', ['1.1', '1.2', '1.2.MA', '1.9'])
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
        const catDefNPAI = CATEGORIAS.find(c => c.id === reg.categoria_id);
        const catNome = catDefNPAI ? catDefNPAI.nome : (reg.categoria_nome || (reg.categoria_id === '1.1' ? 'Notificação Preliminar' : 'Auto de Infração'));
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

// ============================
// MODAL VENCIDOS / ATENDIDOS (Histórico Geral — GP+)
// ============================

let registrosModalAtual = []; // registros filtrados do modal aberto
let tipoModalAtual = ''; // 'vencidos' ou 'atendidos'
let vencidosComAIGlobal = [];
let vencidosSemAIGlobal = [];
let aisVinculadosGlobal = [];
let registrosModalOriginal = []; // backup da ordem original para reset

function reordenarModalVencidos(criterio) {
    const ordenar = (a, b) => {
        switch (criterio) {
            case 'data_desc': {
                const da = a.campos && a.campos.data_vencimento ? new Date(a.campos.data_vencimento) : new Date(0);
                const db = b.campos && b.campos.data_vencimento ? new Date(b.campos.data_vencimento) : new Date(0);
                return db - da;
            }
            case 'data_asc': {
                const da = a.campos && a.campos.data_vencimento ? new Date(a.campos.data_vencimento) : new Date(0);
                const db = b.campos && b.campos.data_vencimento ? new Date(b.campos.data_vencimento) : new Date(0);
                return da - db;
            }
            case 'fiscal':
                return (a.fiscal_nome || '').localeCompare(b.fiscal_nome || '');
            case 'fiscal_desc':
                return (b.fiscal_nome || '').localeCompare(a.fiscal_nome || '');
            case 'bairro':
                return ((a.campos && a.campos.bairro) || '').localeCompare((b.campos && b.campos.bairro) || '');
            case 'bairro_desc':
                return ((b.campos && b.campos.bairro) || '').localeCompare((a.campos && a.campos.bairro) || '');
            case 'nome':
                return ((a.campos && a.campos.nome) || '').localeCompare((b.campos && b.campos.nome) || '');
            case 'nome_desc':
                return ((b.campos && b.campos.nome) || '').localeCompare((a.campos && a.campos.nome) || '');
            default:
                return 0;
        }
    };

    if (vencidosComAIGlobal.length > 0 || vencidosSemAIGlobal.length > 0) {
        // Modal customizado com duas seções
        vencidosComAIGlobal.sort(ordenar);
        vencidosSemAIGlobal.sort(ordenar);
        renderizarModalVencidosComAI('Notificações Preliminares Vencidas', vencidosComAIGlobal, vencidosSemAIGlobal, aisVinculadosGlobal);
    } else {
        // Modal padrão (AI ou sem NP reclassificados)
        const ordenados = [...registrosModalOriginal].sort(ordenar);
        const tipoDoc = (subAbaAtual === '1.1' || subAbaAtual === 'np-af') ? 'Notificações / AF' : 'Autos de Infração';
        renderizarModalRelatorio(`${tipoDoc} Vencidas`, ordenados, 'vencidos');
    }
}

function atualizarVisibilidadeBotoesVencidosAtendidos() {
    const container = document.getElementById('botoes-vencidos-atendidos');
    if (!container) return;

    const role = window.userRoleGlobal || '';
    const roleLower = role.toLowerCase();
    const isFiscalPosturas = roleLower === 'fiscal' || (roleLower.includes('fiscal') && roleLower.includes('postura'));
    const isFiscalMA = roleLower.includes('fiscal') && roleLower.includes('meio') && roleLower.includes('ambiente');
    const podeVer = isGerenteOuSuperior(role) || isFiscalPosturas || isFiscalMA;
    const abaNPouAI = (subAbaAtual === '1.1' || subAbaAtual === 'np-af' || subAbaAtual === '1.2' || subAbaAtual === '1.2.MA' || subAbaAtual === 'ai-ma');

    if (podeVer && abaNPouAI) {
        container.style.display = 'flex';
    } else {
        container.style.display = 'none';
    }
}

async function buscarAIsPorNumerosNP(numerosNP) {
    if (!numerosNP || numerosNP.length === 0) return [];

    const chunkSize = 20;
    let todosAIs = [];

    for (let i = 0; i < numerosNP.length; i += chunkSize) {
        const chunk = numerosNP.slice(i, i + chunkSize);
        // Colocar aspas em volta do valor previne erros de sintaxe no PostgREST caso o numero contenha barras ou espaços
        const orConditions = chunk.map(n => `campos->>n_notificacao.eq."${n.replace(/"/g, '')}"`);

        const { data, error } = await supabaseClient
            .from('controle_processual')
            .select('*')
            .eq('categoria_id', '1.2')
            .or(orConditions.join(','));

        if (error) {
            console.error('Erro ao buscar AIs vinculados:', error);
            continue;
        }
        if (data) todosAIs = todosAIs.concat(data);
    }

    return todosAIs;
}

function ordenarVencidos(criterio) {
    const ordenar = (a, b) => {
        switch (criterio) {
            case 'data_desc': {
                const da = a.campos && a.campos.data_vencimento ? new Date(a.campos.data_vencimento) : new Date(0);
                const db = b.campos && b.campos.data_vencimento ? new Date(b.campos.data_vencimento) : new Date(0);
                return db - da; // mais recente/próxima primeiro
            }
            case 'data_asc': {
                const da = a.campos && a.campos.data_vencimento ? new Date(a.campos.data_vencimento) : new Date(0);
                const db = b.campos && b.campos.data_vencimento ? new Date(b.campos.data_vencimento) : new Date(0);
                return da - db; // mais antiga/distante primeiro
            }
            case 'fiscal':
                return (a.fiscal_nome || '').localeCompare(b.fiscal_nome || '');
            case 'fiscal_desc':
                return (b.fiscal_nome || '').localeCompare(a.fiscal_nome || '');
            case 'bairro':
                return ((a.campos && a.campos.bairro) || '').localeCompare((b.campos && b.campos.bairro) || '');
            case 'bairro_desc':
                return ((b.campos && b.campos.bairro) || '').localeCompare((a.campos && a.campos.bairro) || '');
            case 'nome':
                return ((a.campos && a.campos.nome) || '').localeCompare((b.campos && b.campos.nome) || '');
            case 'nome_desc':
                return ((b.campos && b.campos.nome) || '').localeCompare((a.campos && a.campos.nome) || '');
            default:
                return 0;
        }
    };
    vencidosComAIGlobal.sort(ordenar);
    vencidosSemAIGlobal.sort(ordenar);
    renderizarModalVencidosComAI('Notificações Preliminares Vencidas', vencidosComAIGlobal, vencidosSemAIGlobal, aisVinculadosGlobal);
}

function renderizarModalVencidosComAI(titulo, comAI, semAI, aisVinculados) {
    registrosModalAtual = comAI.concat(semAI);
    tipoModalAtual = 'vencidos';
    vencidosComAIGlobal = comAI;
    vencidosSemAIGlobal = semAI;
    aisVinculadosGlobal = aisVinculados;

    const modalExistente = document.getElementById('modal-vencidos-atendidos');
    if (modalExistente) modalExistente.remove();

    const hojeFmt = new Date().toLocaleDateString('pt-BR');
    const mapaAI = {};
    aisVinculados.forEach(ai => {
        const n = ai.campos && ai.campos.n_notificacao ? ai.campos.n_notificacao.trim() : '';
        if (n) mapaAI[n] = ai;
    });

    const total = comAI.length + semAI.length;

    const semAIComDilacao = [];
    const semAISemDilacao = [];
    semAI.forEach(reg => {
        if (reg.campos && (reg.campos.data_dilacao || reg.campos.data_vencimento_original)) {
            semAIComDilacao.push(reg);
        } else {
            semAISemDilacao.push(reg);
        }
    });

    function montarTabela(registros, secaoId, corBadge, textoBadge, bgSecao, tipo = 'padrao') {
        let headerHTML = '<tr>';
        headerHTML += '<th class="col-curta" style="min-width: 95px;">N°</th>';
        headerHTML += '<th>Nome / Identificador</th>';
        headerHTML += '<th class="col-curta">Bairro</th>';
        headerHTML += '<th class="col-curta">Fiscal</th>';

        if (tipo === 'com_dilacao') {
            headerHTML += '<th class="col-curta">Venc. Original</th>';
            headerHTML += '<th class="col-curta">Dilação de Prazo</th>';
        } else {
            headerHTML += '<th class="col-curta">Data Venc.</th>';
        }

        headerHTML += '<th class="col-curta">AI Vinculado</th>';
        headerHTML += '<th class="col-curta">Anexos</th>';
        headerHTML += '</tr>';

        let bodyHTML = '';
        registros.forEach(reg => {
            const nome = (reg.campos && reg.campos.nome) || '-';
            const bairro = (reg.campos && reg.campos.bairro) || '-';
            const fiscal = reg.fiscal_nome || '-';
            const numSeq = (reg.campos && reg.campos.n_notificacao) || (reg.numero_sequencial || '-');

            let colsDataHTML = '';
            if (tipo === 'com_dilacao') {
                const dvo = reg.campos && reg.campos.data_vencimento_original ? reg.campos.data_vencimento_original.split('-').reverse().join('/') : '-';
                const dd = reg.campos && reg.campos.data_dilacao ? reg.campos.data_dilacao.split('-').reverse().join('/') : (reg.campos && reg.campos.data_vencimento ? reg.campos.data_vencimento.split('-').reverse().join('/') : '-');
                colsDataHTML = `<td style="text-align:center; vertical-align:middle;">${dvo}</td><td style="text-align:center; vertical-align:middle; color:#8b5cf6; font-weight:bold;">${dd}</td>`;
            } else {
                const dataVenc = reg.campos && reg.campos.data_vencimento ? reg.campos.data_vencimento.split('-').reverse().join('/') : '-';
                colsDataHTML = `<td style="text-align:center; vertical-align:middle;">${dataVenc}</td>`;
            }

            const aiVinculado = mapaAI[numSeq];
            let aiHTML = '<span style="color:#94a3b8;font-size:12px;">—</span>';
            if (aiVinculado) {
                const numAI = aiVinculado.numero_sequencial || '-';
                aiHTML = `<span style="background:#f59e0b; color:white; padding:3px 8px; border-radius:6px; font-size:11px; font-weight:600;">${numAI}</span>`;
                if (aiVinculado.campos && aiVinculado.campos.anexo_pdf) {
                    aiHTML += ` <button onclick="abrirAnexoGerente('${aiVinculado.campos.anexo_pdf}')" style="background:#10b981;color:white;border:none;padding:3px 8px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;margin-left:4px;">📎</button>`;
                }
            }

            const anexos = coletarTodosAnexos(reg);
            let anexoHTML = '';
            if (anexos.length === 0) {
                anexoHTML = '<span style="color:#94a3b8;font-size:12px;">—</span>';
            } else if (anexos.length === 1) {
                anexoHTML = `<button onclick="abrirAnexoGerente('${anexos[0]}')" style="background:#10b981;color:white;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">📎 Abrir</button>`;
            } else {
                anexoHTML = anexos.map((url, i) =>
                    `<button onclick="abrirAnexoGerente('${url}')" style="background:#10b981;color:white;border:none;padding:4px 8px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;margin:2px;">${i + 1}</button>`
                ).join('');
            }

            bodyHTML += `<tr style="transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">`;
            bodyHTML += `<td style="text-align:center; vertical-align:middle;">${numSeq}</td>`;
            bodyHTML += `<td style="vertical-align:middle;">${nome}</td>`;
            bodyHTML += `<td style="vertical-align:middle;">${bairro}</td>`;
            bodyHTML += `<td style="vertical-align:middle;">${fiscal}</td>`;
            bodyHTML += colsDataHTML;
            bodyHTML += `<td style="text-align:center; vertical-align:middle;">${aiHTML}</td>`;
            bodyHTML += `<td style="text-align:center; vertical-align:middle;">${anexoHTML}</td>`;
            bodyHTML += `</tr>`;
        });

        return `
            <div style="margin-bottom: 24px; padding: 16px; background: ${bgSecao}; border-radius: 10px; border: 1px solid #e2e8f0;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
                    <h3 style="margin:0; color:#1e293b; font-size:16px;">${textoBadge}</h3>
                    <span style="background:${corBadge}; color:white; padding:4px 12px; border-radius:20px; font-size:13px; font-weight:700;">
                        ${registros.length} registro(s)
                    </span>
                </div>
                <div class="scroll-sync-wrapper" style="position:relative;">
                    <div class="historico-scroll-top" style="position:sticky; top:0; z-index:20; overflow-x:auto; overflow-y:hidden; height:14px; background:#fff; border-bottom:1px solid #e2e8f0; scrollbar-width:thin;">
                        <div class="historico-scroll-dummy" style="height:1px;"></div>
                    </div>
                    <div class="historico-scroll-bottom" style="overflow-x:auto; overflow-y:visible;">
                        <table class="historico-tabela" style="min-width:700px;">
                            <thead>${headerHTML}</thead>
                            <tbody>${bodyHTML}</tbody>
                        </table>
                    </div>
                </div>
                ${registros.length === 0 ? '<div style="text-align:center; padding:20px; color:#64748b; font-size:13px;">Nenhum registro nesta seção.</div>' : ''}
            </div>
        `;
    }

    const modal = document.createElement('div');
    modal.id = 'modal-vencidos-atendidos';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;';

    modal.innerHTML = `
        <div style="background:white;border-radius:12px;width:95%;max-width:1100px;max-height:90vh;overflow:auto;padding:24px;position:relative;">
            <button onclick="document.getElementById('modal-vencidos-atendidos').remove()" style="position:absolute;top:14px;right:18px;background:none;border:none;font-size:24px;cursor:pointer;color:#64748b;">✕</button>
            
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
                <div>
                    <h2 style="margin:0; color:#1e293b; font-size:20px;">${titulo}</h2>
                    <p style="margin:4px 0 0 0; color:#64748b; font-size:13px;">Gerado em ${hojeFmt}</p>
                </div>
                <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                    <span style="background:#dc2626; color:white; padding:6px 14px; border-radius:20px; font-size:14px; font-weight:700;">
                        ${total} Vencidos
                    </span>
                    <select id="select-ordenar-vencidos" onchange="reordenarModalVencidos(this.value)" style="padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; outline: none; background: white; cursor: pointer; color: #334155;">
                        <option value="">Ordenar por...</option>
                        <option value="data_desc">Data Venc. (próxima → distante)</option>
                        <option value="data_asc">Data Venc. (distante → próxima)</option>
                        <option value="fiscal">Fiscal (A → Z)</option>
                        <option value="fiscal_desc">Fiscal (Z → A)</option>
                        <option value="bairro">Bairro (A → Z)</option>
                        <option value="bairro_desc">Bairro (Z → A)</option>
                        <option value="nome">Nome (A → Z)</option>
                        <option value="nome_desc">Nome (Z → A)</option>
                    </select>
                    <div style="position:relative;">
                        <button id="btn-baixar-modal-rel" style="padding: 0.55rem 1.2rem; background: #0f172a; color: white; border: none; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;" onclick="toggleMenuDownloadModal()">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            Baixar Relatório
                        </button>
                        <div id="menu-download-modal" style="display:none; position:absolute; right:0; top:calc(100% + 8px); background:white; border-radius:10px; box-shadow:0 8px 30px rgba(0,0,0,0.18); padding:10px; z-index:101; min-width:220px; border:1px solid #e2e8f0;">
                            <button onclick="baixarRelatorioModal('relatorio')" style="width:100%; text-align:left; padding:10px 12px; background:none; border:none; border-radius:6px; font-size:13px; cursor:pointer; color:#334155; font-weight:500; display:flex; align-items:center; gap:8px;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='none'">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                Somente Relatório
                            </button>
                            <button onclick="baixarRelatorioModal('completo')" style="width:100%; text-align:left; padding:10px 12px; background:none; border:none; border-radius:6px; font-size:13px; cursor:pointer; color:#334155; font-weight:500; display:flex; align-items:center; gap:8px;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='none'">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                                Relatório + Anexos (ZIP)
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            ${montarTabela(comAI, 'secao-com-ai', '#f59e0b', '⚠️ Notificações Preliminares vencidas com Auto de Infração vinculado', '#fffbeb')}
            ${montarTabela(semAIComDilacao, 'secao-sem-ai-dilacao', '#8b5cf6', '⏳ Notificações Preliminares com Dilação de Prazo vencidos', '#f5f3ff', 'com_dilacao')}
            ${montarTabela(semAISemDilacao, 'secao-sem-ai', '#dc2626', '🔴 Notificações Preliminares vencidas sem Auto de Infração', '#fef2f2')}
        </div>
    `;

    document.body.appendChild(modal);
    setTimeout(window.sincronizarScrollsModais, 100);

    if (window.criterioAtual) {
        const select = document.getElementById('select-ordenar-vencidos');
        if (select) select.value = window.criterioAtual;
    }
    modal.addEventListener('click', function (e) {
        if (e.target === modal) modal.remove();
    });
    document.addEventListener('click', function fecharMenu(e) {
        const menu = document.getElementById('menu-download-modal');
        const btn = document.getElementById('btn-baixar-modal-rel');
        if (!menu || !btn) {
            document.removeEventListener('click', fecharMenu);
            return;
        }
        if (!menu.contains(e.target) && !btn.contains(e.target)) {
            menu.style.display = 'none';
        }
    });
}

function usuarioDeveVerApenasSeusRegistros() {
    const role = (window.userRoleGlobal || '').toLowerCase();
    const isFiscal = role.includes('fiscal');
    return isFiscal && !isGerenteOuSuperior(window.userRoleGlobal);
}

function pertenceAoFiscalLogado(reg) {
    if (reg.user_id && window.userIdGlobal) {
        return reg.user_id === window.userIdGlobal;
    }
    // Fallback para registros ou instâncias muito antigas
    const nomeFiscal = (reg.fiscal_nome || '').trim();
    const nomeUsuario = (window.userNameGlobal || '').trim();
    return nomeFiscal === nomeUsuario;
}

async function abrirModalVencidos() {
    if (!registrosGeralAtual || registrosGeralAtual.length === 0) {
        Swal.fire('Aviso', 'Nenhum registro carregado para análise.', 'info');
        return;
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const filtrarPorFiscal = usuarioDeveVerApenasSeusRegistros();

    let vencidos = registrosGeralAtual.filter(reg => {
        const venc = reg.campos && reg.campos.data_vencimento ? reg.campos.data_vencimento.trim() : '';
        if (!venc) return false;
        const partes = venc.split('-');
        if (partes.length !== 3) return false;
        const dtVenc = new Date(partes[0], partes[1] - 1, partes[2]);
        if (dtVenc >= hoje) return false;
        const resp = reg.campos && reg.campos.resposta_fiscal ? reg.campos.resposta_fiscal.trim() : '';
        if (resp !== '') return false;
        if (filtrarPorFiscal && !pertenceAoFiscalLogado(reg)) return false;
        return true;
    });

    // Se for aba NP, verificar se há AIs vinculados às NPs vencidas
    if ((subAbaAtual === '1.1' || subAbaAtual === 'np-af') && vencidos.length > 0) {
        const numerosNP = vencidos
            .map(r => {
                let val = r.campos && r.campos.n_notificacao ? r.campos.n_notificacao.trim() : '';
                if (!val && r.numero_sequencial) val = r.numero_sequencial.trim();
                return val;
            })
            .filter(n => n !== '');

        if (numerosNP.length > 0) {
            Swal.fire({
                title: 'Verificando vínculos...',
                text: 'Buscando os dados...',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });

            const aisVinculados = await buscarAIsPorNumerosNP(numerosNP);
            Swal.close();

            const numerosComAI = new Set(aisVinculados.map(ai =>
                ai.campos && ai.campos.n_notificacao ? ai.campos.n_notificacao.trim() : ''
            ).filter(n => n !== ''));

            const vencidosComAI = vencidos.filter(r => {
                let val = r.campos && r.campos.n_notificacao ? r.campos.n_notificacao.trim() : '';
                if (!val && r.numero_sequencial) val = r.numero_sequencial.trim();
                return numerosComAI.has(val);
            });
            const vencidosSemAI = vencidos.filter(r => {
                let val = r.campos && r.campos.n_notificacao ? r.campos.n_notificacao.trim() : '';
                if (!val && r.numero_sequencial) val = r.numero_sequencial.trim();
                return !numerosComAI.has(val);
            });

            renderizarModalVencidosComAI('Notificações Preliminares Vencidas', vencidosComAI, vencidosSemAI, aisVinculados);
            return;
        }
    }

    const tipoDoc = (subAbaAtual === '1.1' || subAbaAtual === 'np-af') ? 'Notificações / AF' : 'Autos de Infração';
    renderizarModalRelatorio(`${tipoDoc} Vencidas`, vencidos, 'vencidos');
}

function abrirModalAtendidos() {
    if (!registrosGeralAtual || registrosGeralAtual.length === 0) {
        Swal.fire('Aviso', 'Nenhum registro carregado para análise.', 'info');
        return;
    }

    const filtrarPorFiscal = usuarioDeveVerApenasSeusRegistros();
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const efetivados = registrosGeralAtual.filter(reg => {
        if (filtrarPorFiscal && !pertenceAoFiscalLogado(reg)) return false;

        const resp = reg.campos && reg.campos.resposta_fiscal ? reg.campos.resposta_fiscal.trim() : '';
        if (resp !== '') return true;

        if (subAbaAtual === '1.1' || subAbaAtual === 'np-af') {
            const venc = reg.campos && reg.campos.data_vencimento ? reg.campos.data_vencimento.trim() : '';
            if (venc) {
                const partes = venc.split('-');
                if (partes.length === 3) {
                    const dtVenc = new Date(partes[0], partes[1] - 1, partes[2]);
                    if (dtVenc >= hoje) {
                        return true;
                    }
                }
            }
        }
        return false;
    });

    if (subAbaAtual === '1.1' || subAbaAtual === 'np-af') {
        renderizarModalRespondidosNP(efetivados);
    } else {
        const tipoDoc = 'Autos de Infração';
        const respondidos = efetivados.filter(reg => {
            const resp = reg.campos && reg.campos.resposta_fiscal ? reg.campos.resposta_fiscal.trim() : '';
            return resp !== '';
        });
        renderizarModalRelatorio(`${tipoDoc} Respondidos`, respondidos, 'atendidos');
    }
}

function abrirModalPendentes() {
    if (!registrosGeralAtual || registrosGeralAtual.length === 0) {
        Swal.fire('Aviso', 'Nenhum registro carregado para análise.', 'info');
        return;
    }

    const filtrarPorFiscal = usuarioDeveVerApenasSeusRegistros();

    const pendentes = registrosGeralAtual.filter(reg => {
        if (filtrarPorFiscal && !pertenceAoFiscalLogado(reg)) return false;

        const dataEntrada = reg.campos && reg.campos.data_entrada ? reg.campos.data_entrada.trim() : '';
        const dataVenc = reg.campos && reg.campos.data_vencimento ? reg.campos.data_vencimento.trim() : '';
        const histAdmin = reg.campos && reg.campos.historico_admin ? reg.campos.historico_admin.trim() : '';
        const resp = reg.campos && reg.campos.resposta_fiscal ? reg.campos.resposta_fiscal.trim() : '';

        return dataEntrada === '' && dataVenc === '' && histAdmin === '' && resp === '';
    });

    renderizarModalPendentes(pendentes);
}

function renderizarModalPendentes(lista) {
    registrosModalAtual = lista;
    tipoModalAtual = 'pendentes';

    if (window.criterioAtual === 'data_asc') {
        lista.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    } else if (window.criterioAtual === 'data_desc') {
        lista.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    } else if (window.criterioAtual === 'fiscal') {
        lista.sort((a, b) => (a.fiscal_nome || '').localeCompare(b.fiscal_nome || ''));
    } else if (window.criterioAtual === 'fiscal_desc') {
        lista.sort((a, b) => (b.fiscal_nome || '').localeCompare(a.fiscal_nome || ''));
    } else if (window.criterioAtual === 'bairro') {
        lista.sort((a, b) => ((a.campos && a.campos.bairro) || '').localeCompare((b.campos && b.campos.bairro) || ''));
    } else if (window.criterioAtual === 'bairro_desc') {
        lista.sort((a, b) => ((b.campos && b.campos.bairro) || '').localeCompare((a.campos && a.campos.bairro) || ''));
    } else if (window.criterioAtual === 'nome') {
        lista.sort((a, b) => ((a.campos && a.campos.nome) || '').localeCompare((b.campos && b.campos.nome) || ''));
    } else if (window.criterioAtual === 'nome_desc') {
        lista.sort((a, b) => ((b.campos && b.campos.nome) || '').localeCompare((a.campos && a.campos.nome) || ''));
    }

    const gerarLinhasPendentes = (registros) => {
        if (registros.length === 0) {
            return `<tr><td colspan="8" style="text-align:center; padding:20px; color:#94a3b8;">Nenhum registro encontrado.</td></tr>`;
        }

        let html = '';
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        registros.forEach((reg, idx) => {
            const nome = (reg.campos && reg.campos.nome) || '-';
            const fiscal = reg.fiscal_nome || '-';
            const numSeq = reg.campos && reg.campos.n_notificacao ? reg.campos.n_notificacao : (reg.numero_sequencial || '-');
            const dataRegistrada = reg.created_at ? new Date(reg.created_at).toLocaleDateString('pt-BR') : '-';
            const ar = (reg.campos && reg.campos.ar) ? reg.campos.ar : '-';

            let periodoTexto = '-';
            let periodoColor = '#64748b';
            let periodoFontWeight = 'normal';
            if (reg.created_at) {
                const dataCriacao = new Date(reg.created_at);
                dataCriacao.setHours(0, 0, 0, 0);
                const diffTime = Math.abs(hoje - dataCriacao);
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                periodoTexto = `${diffDays} dia(s)`;
                if (diffDays > 180) {
                    periodoColor = '#dc2626';
                    periodoFontWeight = 'bold';
                }
            }

            const anexos = coletarTodosAnexos(reg);
            let anexoHTML = '';
            if (anexos.length === 0) {
                anexoHTML = '<span style="color:#94a3b8;font-size:12px;">—</span>';
            } else if (anexos.length === 1) {
                anexoHTML = `<button onclick="abrirAnexoGerente('${anexos[0]}')" style="background:#10b981;color:white;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">📎 Abrir</button>`;
            } else {
                anexos.forEach((url, i) => {
                    anexoHTML += `<button onclick="abrirAnexoGerente('${url}')" style="background:#10b981;color:white;border:none;padding:4px 8px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;margin-right:4px;">📎 ${i + 1}</button>`;
                });
            }

            html += `<tr style="border-bottom: 1px solid #e2e8f0;">`;
            html += `<td style="padding:10px 12px; border:1px solid #cbd5e1; text-align:center; color:#64748b; font-size:13px;">${idx + 1}</td>`;
            html += `<td style="padding:10px 12px; border:1px solid #cbd5e1; font-weight:600; color:#1e293b;">${numSeq}</td>`;
            html += `<td style="padding:10px 12px; border:1px solid #cbd5e1;">${nome}</td>`;
            html += `<td style="padding:10px 12px; border:1px solid #cbd5e1;">${fiscal}</td>`;
            html += `<td style="padding:10px 12px; border:1px solid #cbd5e1; text-align:center;">${dataRegistrada}</td>`;
            html += `<td style="padding:10px 12px; border:1px solid #cbd5e1; text-align:center; color:${periodoColor}; font-weight:${periodoFontWeight};">${periodoTexto}</td>`;
            html += `<td style="padding:10px 12px; border:1px solid #cbd5e1; text-align:center;">${ar}</td>`;
            html += `<td style="padding:10px 12px; border:1px solid #cbd5e1; text-align:center;">${anexoHTML}</td>`;
            html += `</tr>`;
        });
        return html;
    };

    const headerHTML = `<tr>
        <th style="width:40px; text-align:center;">#</th>
        <th class="col-curta" style="min-width: 95px;">N°</th>
        <th>Nome / Identificador</th>
        <th class="col-curta">Fiscal</th>
        <th class="col-curta">Data Registrada</th>
        <th class="col-curta">Período Pendente</th>
        <th class="col-curta">AR</th>
        <th class="col-curta">Anexos</th>
    </tr>`;

    const modalExistente = document.getElementById('modal-vencidos-atendidos');
    if (modalExistente) modalExistente.remove();

    let tituloPendentes = 'Documentos Pendentes';
    if (subAbaAtual === '1.1' || subAbaAtual === 'np-af') tituloPendentes = 'Notificações e AFs Pendentes';
    else if (subAbaAtual === '1.2' || subAbaAtual === '1.2.MA' || subAbaAtual === 'ai-ma') tituloPendentes = 'Autos de Infração Pendentes';

    const modal = document.createElement('div');
    modal.id = 'modal-vencidos-atendidos';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;';

    const montarTabelaPendentes = (subLista) => {
        if (subLista.length === 0) return '';
        return `
            <div class="scroll-sync-wrapper" style="position:relative;">
                <div class="historico-scroll-top" style="position:sticky; top:0; z-index:20; overflow-x:auto; overflow-y:hidden; height:14px; background:#fff; border-bottom:1px solid #e2e8f0; scrollbar-width:thin;">
                    <div class="historico-scroll-dummy" style="height:1px;"></div>
                </div>
                <div class="historico-scroll-bottom" style="overflow-x:auto; overflow-y:visible;">
                    <table class="historico-tabela" style="min-width:900px;">
                        <thead>${headerHTML}</thead>
                        <tbody>${gerarLinhasPendentes(subLista)}</tbody>
                    </table>
                </div>
            </div>
        `;
    };

    let tabelasHTML = montarTabelaPendentes(lista);
    if (lista.length === 0) {
        tabelasHTML = `<div style="text-align:center; padding:40px; color:#94a3b8;">Nenhum documento pendente encontrado.</div>`;
    }

    const total = lista.length;
    const hojeFmt = new Date().toLocaleDateString('pt-BR');

    modal.innerHTML = `
        <div style="background:white;border-radius:12px;width:95%;max-width:1100px;max-height:90vh;overflow:auto;padding:24px;position:relative;">
            <button onclick="document.getElementById('modal-vencidos-atendidos').remove()" style="position:absolute;top:14px;right:18px;background:none;border:none;font-size:24px;cursor:pointer;color:#64748b;">✕</button>
            
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
                <div>
                    <h2 style="margin:0; color:#1e293b; font-size:20px;">${tituloPendentes}</h2>
                    <p style="margin:4px 0 0 0; color:#64748b; font-size:13px;">Gerado em ${hojeFmt}</p>
                </div>
                <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                    <span style="background:#3b82f6; color:white; padding:6px 14px; border-radius:20px; font-size:14px; font-weight:700;">
                        ${total} registro(s)
                    </span>
                    <select id="select-ordenar-pendentes" onchange="window.reordenarModalPendentes(this.value)" style="padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; outline: none; background: white; cursor: pointer; color: #334155;">
                        <option value="">Ordenar por...</option>
                        <option value="data_desc">Data (mais recente)</option>
                        <option value="data_asc">Data (mais antiga)</option>
                        <option value="fiscal">Fiscal (A → Z)</option>
                        <option value="fiscal_desc">Fiscal (Z → A)</option>
                        <option value="nome">Nome (A → Z)</option>
                        <option value="nome_desc">Nome (Z → A)</option>
                    </select>
                    <div style="position:relative;">
                        <button id="btn-baixar-modal-rel" style="padding: 0.55rem 1.2rem; background: #0f172a; color: white; border: none; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;" onclick="toggleMenuDownloadModal()">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            Baixar Relatório
                        </button>
                        <div id="menu-download-modal" style="display:none; position:absolute; right:0; top:calc(100% + 8px); background:white; border-radius:10px; box-shadow:0 8px 30px rgba(0,0,0,0.18); padding:10px; z-index:101; min-width:220px; border:1px solid #e2e8f0;">
                            <button onclick="baixarRelatorioModal('relatorio')" style="width:100%; text-align:left; padding:10px 12px; background:none; border:none; border-radius:6px; font-size:13px; cursor:pointer; color:#334155; font-weight:500; display:flex; align-items:center; gap:8px;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='none'">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                Somente Relatório
                            </button>
                            <button onclick="baixarRelatorioModal('completo')" style="width:100%; text-align:left; padding:10px 12px; background:none; border:none; border-radius:6px; font-size:13px; cursor:pointer; color:#334155; font-weight:500; display:flex; align-items:center; gap:8px;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='none'">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                                Relatório + Anexos (ZIP)
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            ${tabelasHTML}
        </div>
    `;

    document.body.appendChild(modal);
    sincronizarScrollsModais();

    // Preserve the select value if it was ordered
    if (window.criterioAtual) {
        const select = document.getElementById('select-ordenar-pendentes');
        if (select) select.value = window.criterioAtual;
    }
}

window.reordenarModalPendentes = function (criterio) {
    if (!criterio) return;
    window.criterioAtual = criterio;
    // O select é atualizado dentro da função renderizar
    renderizarModalPendentes(registrosModalAtual);
};

function abrirModalNaoEfetivados() {
    if (!registrosGeralAtual || registrosGeralAtual.length === 0) {
        Swal.fire('Aviso', 'Nenhum registro carregado para análise.', 'info');
        return;
    }

    const filtrarPorFiscal = usuarioDeveVerApenasSeusRegistros();

    const naoEfetivados = registrosGeralAtual.filter(reg => {
        if (filtrarPorFiscal && !pertenceAoFiscalLogado(reg)) return false;

        const hist = reg.campos && reg.campos.historico_admin ? reg.campos.historico_admin.trim() : '';
        const resp = reg.campos && reg.campos.resposta_fiscal ? reg.campos.resposta_fiscal.trim() : '';

        return hist !== '';
    });

    renderizarModalNaoEfetivados(naoEfetivados);
}

function renderizarModalNaoEfetivados(lista) {
    registrosModalAtual = lista;
    tipoModalAtual = 'nao_efetivados';

    if (window.criterioAtual === 'data_venc_asc') {
        lista.sort((a, b) => {
            const da = a.created_at ? new Date(a.created_at) : new Date(0);
            const db = b.created_at ? new Date(b.created_at) : new Date(0);
            return da - db;
        });
    } else if (window.criterioAtual === 'data_venc_desc') {
        lista.sort((a, b) => {
            const da = a.created_at ? new Date(a.created_at) : new Date(0);
            const db = b.created_at ? new Date(b.created_at) : new Date(0);
            return db - da;
        });
    } else if (window.criterioAtual === 'fiscal_asc') {
        lista.sort((a, b) => (a.fiscal_nome || '').localeCompare(b.fiscal_nome || ''));
    } else if (window.criterioAtual === 'fiscal_desc') {
        lista.sort((a, b) => (b.fiscal_nome || '').localeCompare(a.fiscal_nome || ''));
    } else if (window.criterioAtual === 'bairro_asc') {
        lista.sort((a, b) => ((a.campos && a.campos.bairro) || '').localeCompare((b.campos && b.campos.bairro) || ''));
    } else if (window.criterioAtual === 'bairro_desc') {
        lista.sort((a, b) => ((b.campos && b.campos.bairro) || '').localeCompare((a.campos && a.campos.bairro) || ''));
    } else if (window.criterioAtual === 'nome_asc') {
        lista.sort((a, b) => ((a.campos && a.campos.nome) || '').localeCompare((b.campos && b.campos.nome) || ''));
    } else if (window.criterioAtual === 'nome_desc') {
        lista.sort((a, b) => ((b.campos && b.campos.nome) || '').localeCompare((a.campos && a.campos.nome) || ''));
    }

    const gerarLinhasNaoEfetivados = (registros, tipo) => {
        if (registros.length === 0) {
            return `<tr><td colspan="10" style="text-align:center; padding:20px; color:#94a3b8;">Nenhum registro encontrado.</td></tr>`;
        }

        let html = '';
        registros.forEach((reg, idx) => {
            const nome = (reg.campos && reg.campos.nome) || '-';
            const fiscal = reg.fiscal_nome || '-';
            const numSeq = reg.campos && reg.campos.n_notificacao ? reg.campos.n_notificacao : (reg.numero_sequencial || '-');
            const dataRegistrada = reg.created_at ? new Date(reg.created_at).toLocaleDateString('pt-BR') : '-';
            const historicoAdmin = (reg.campos && reg.campos.motivo) ? reg.campos.motivo : ((reg.campos && reg.campos.descricao) ? reg.campos.descricao : '-');
            const dataEntrada = (reg.campos && reg.campos.data_entrada) ? reg.campos.data_entrada.split('-').reverse().join('/') : '-';
            const dataVenc = (reg.campos && reg.campos.data_vencimento) ? reg.campos.data_vencimento.split('-').reverse().join('/') : '-';
            const resposta = (reg.campos && reg.campos.resposta_fiscal) ? reg.campos.resposta_fiscal : '-';

            const anexos = coletarTodosAnexos(reg);
            let anexoHTML = '';
            if (anexos.length === 0) {
                anexoHTML = '<span style="color:#94a3b8;font-size:12px;">—</span>';
            } else if (anexos.length === 1) {
                anexoHTML = `<button onclick="abrirAnexoGerente('${anexos[0]}')" style="background:#10b981;color:white;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">📎 Abrir</button>`;
            } else {
                anexos.forEach((url, i) => {
                    anexoHTML += `<button onclick="abrirAnexoGerente('${url}')" style="background:#10b981;color:white;border:none;padding:4px 8px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;margin-right:4px;">📎 ${i + 1}</button>`;
                });
            }

            html += `<tr style="border-bottom: 1px solid #e2e8f0;">`;
            html += `<td style="padding:10px 12px; border:1px solid #cbd5e1; text-align:center; color:#64748b; font-size:13px;">${idx + 1}</td>`;
            html += `<td style="padding:10px 12px; border:1px solid #cbd5e1; font-weight:600; color:#1e293b;">${numSeq}</td>`;
            html += `<td style="padding:10px 12px; border:1px solid #cbd5e1;">${nome}</td>`;
            html += `<td style="padding:10px 12px; border:1px solid #cbd5e1;">${fiscal}</td>`;

            if (tipo === 'sem_prosseguimento') {
                html += `<td style="padding:10px 12px; border:1px solid #cbd5e1; text-align:center;">${dataRegistrada}</td>`;
                html += `<td style="padding:10px 12px; border:1px solid #cbd5e1;">${historicoAdmin}</td>`;
            } else if (tipo === 'com_prosseguimento') {
                html += `<td style="padding:10px 12px; border:1px solid #cbd5e1; text-align:center;">${dataRegistrada}</td>`;
                html += `<td style="padding:10px 12px; border:1px solid #cbd5e1;">${historicoAdmin}</td>`;
                html += `<td style="padding:10px 12px; border:1px solid #cbd5e1; text-align:center;">${dataEntrada}</td>`;
                html += `<td style="padding:10px 12px; border:1px solid #cbd5e1; text-align:center;">${dataVenc}</td>`;
            } else if (tipo === 'com_resposta') {
                html += `<td style="padding:10px 12px; border:1px solid #cbd5e1;">${historicoAdmin}</td>`;
                html += `<td style="padding:10px 12px; border:1px solid #cbd5e1; text-align:center;">${dataEntrada}</td>`;
                html += `<td style="padding:10px 12px; border:1px solid #cbd5e1;">${resposta}</td>`;
            }

            html += `<td style="padding:10px 12px; border:1px solid #cbd5e1; text-align:center;">${anexoHTML}</td>`;
            html += `</tr>`;
        });
        return html;
    };

    const obterHeaderNaoEfetivados = (tipo) => {
        let html = `<tr>
            <th style="width:40px; text-align:center;">#</th>
            <th class="col-curta" style="min-width: 95px;">N°</th>
            <th>Nome / Identificador</th>
            <th class="col-curta">Fiscal</th>`;

        if (tipo === 'sem_prosseguimento') {
            html += `<th class="col-curta">Data Registrada</th>
                     <th>Histórico (Admin)</th>`;
        } else if (tipo === 'com_prosseguimento') {
            html += `<th class="col-curta">Data Registrada</th>
                     <th>Histórico (Admin)</th>
                     <th class="col-curta">Data de recebimento pelo proprietário: (Admin)</th>
                     <th class="col-curta">Data de Vencimento</th>`;
        } else if (tipo === 'com_resposta') {
            html += `<th>Histórico (Admin)</th>
                     <th class="col-curta">Data de Recebimento</th>
                     <th>Resposta</th>`;
        }

        html += `<th class="col-curta">Anexos</th></tr>`;
        return html;
    };

    const modalExistente = document.getElementById('modal-vencidos-atendidos');
    if (modalExistente) modalExistente.remove();

    const hojeFmt = new Date().toLocaleDateString('pt-BR');
    const total = lista.length;

    let tituloNaoEfetivados = 'Documentos Não Efetivados';
    if (subAbaAtual === '1.1' || subAbaAtual === 'np-af') tituloNaoEfetivados = 'Notificação / AF Não Efetivado';
    else if (subAbaAtual === '1.2' || subAbaAtual === '1.2.MA' || subAbaAtual === 'ai-ma') tituloNaoEfetivados = 'Auto de Infração Não Efetivado';

    const modal = document.createElement('div');
    modal.id = 'modal-vencidos-atendidos';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;';

    const semProsseguimento = [];
    const comProsseguimento = [];
    const comResposta = [];

    lista.forEach(reg => {
        const resp = reg.campos && reg.campos.resposta_fiscal ? reg.campos.resposta_fiscal.trim() : '';
        const dataEntrada = reg.campos && reg.campos.data_entrada ? reg.campos.data_entrada.trim() : '';
        const dataVenc = reg.campos && reg.campos.data_vencimento ? reg.campos.data_vencimento.trim() : '';

        if (resp !== '') {
            comResposta.push(reg);
        } else if (dataEntrada !== '' || dataVenc !== '') {
            comProsseguimento.push(reg);
        } else {
            semProsseguimento.push(reg);
        }
    });

    const montarTabelaNaoEfetivados = (subLista, idSecao, titulo, corBadge, bgSecao, tipoSecao) => {
        if (subLista.length === 0) return '';
        const headerHTML = obterHeaderNaoEfetivados(tipoSecao);

        let minW = '700px';
        if (tipoSecao === 'com_prosseguimento') minW = '1050px';
        else if (tipoSecao === 'com_resposta') minW = '900px';

        return `
            <div id="${idSecao}" class="secao-filtro-nao-efetivados" style="margin-bottom: 24px; padding: 16px; background: ${bgSecao}; border-radius: 10px; border: 1px solid #e2e8f0;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
                    <h3 style="margin:0; color:#1e293b; font-size:16px; display: flex; align-items: center; gap: 8px;">
                        ${titulo}
                    </h3>
                    <span style="background:${corBadge}; color:white; padding:4px 12px; border-radius:20px; font-size:13px; font-weight:700;">
                        ${subLista.length} registro(s)
                    </span>
                </div>
                <div class="scroll-sync-wrapper" style="position:relative;">
                    <div class="historico-scroll-top" style="position:sticky; top:0; z-index:20; overflow-x:auto; overflow-y:hidden; height:14px; background:#fff; border-bottom:1px solid #e2e8f0; scrollbar-width:thin;">
                        <div class="historico-scroll-dummy" style="height:1px;"></div>
                    </div>
                    <div class="historico-scroll-bottom" style="overflow-x:auto; overflow-y:visible;">
                        <table class="historico-tabela" style="min-width:${minW};">
                            <thead>${headerHTML}</thead>
                            <tbody>${gerarLinhasNaoEfetivados(subLista, tipoSecao)}</tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    };

    let isAutoInf = subAbaAtual === '1.2' || subAbaAtual === '1.2.MA' || subAbaAtual === 'ai-ma';
    let strSemProsseguimento = isAutoInf ? '🔴 Autos de Infração Devolvidos Ainda Sem Prosseguimento' : '🔴 Notificações Devolvidas Ainda Sem Prosseguimento';
    let strComProsseguimento = isAutoInf ? '⏳ Auto de Infração Devolvido Mas Com Prosseguimento' : '⏳ Notificação Devolvida Mas Com Prosseguimento';
    let strComResposta = isAutoInf ? '✅ Autos de Infração Devolvidos Que Tiveram Prosseguimento E Já Tiveram Resposta Do Fiscal' : '✅ Notificações Devolvidas Que Tiveram Prosseguimento E Já Tiveram Resposta Do Fiscal';

    let tabelasHTML = '';
    tabelasHTML += montarTabelaNaoEfetivados(semProsseguimento, 'secao-sem-prosseguimento', strSemProsseguimento, '#dc2626', '#fef2f2', 'sem_prosseguimento');
    tabelasHTML += montarTabelaNaoEfetivados(comProsseguimento, 'secao-com-prosseguimento', strComProsseguimento, '#f59e0b', '#fffbeb', 'com_prosseguimento');
    tabelasHTML += montarTabelaNaoEfetivados(comResposta, 'secao-com-resposta', strComResposta, '#16a34a', '#f0fdf4', 'com_resposta');

    modal.innerHTML = `
        <div style="background:white;border-radius:12px;width:95%;max-width:1100px;max-height:90vh;overflow:auto;padding:24px;position:relative;">
            <button onclick="document.getElementById('modal-vencidos-atendidos').remove()" style="position:absolute;top:14px;right:18px;background:none;border:none;font-size:24px;cursor:pointer;color:#64748b;">✕</button>
            
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
                <div>
                    <h2 style="margin:0; color:#1e293b; font-size:20px;">${tituloNaoEfetivados}</h2>
                    <p style="margin:4px 0 0 0; color:#64748b; font-size:13px;">Gerado em ${hojeFmt}</p>
                </div>
                <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                    <span style="background:#f59e0b; color:white; padding:6px 14px; border-radius:20px; font-size:14px; font-weight:700;">
                        ${total} Devolvidos
                    </span>
                    <select id="select-ordenar-nao-efetivados" onchange="window.criterioAtual = this.value; renderizarModalNaoEfetivados(registrosModalAtual);" style="padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; outline: none; background: white; cursor: pointer; color: #334155;">
                        <option value="data_venc_asc" ${window.criterioAtual === 'data_venc_asc' ? 'selected' : ''}>Data Registrada (mais antiga primeiro)</option>
                        <option value="data_venc_desc" ${window.criterioAtual === 'data_venc_desc' ? 'selected' : ''}>Data Registrada (mais recente primeiro)</option>
                        <option value="fiscal_asc" ${window.criterioAtual === 'fiscal_asc' ? 'selected' : ''}>Fiscal (A-Z)</option>
                        <option value="fiscal_desc" ${window.criterioAtual === 'fiscal_desc' ? 'selected' : ''}>Fiscal (Z-A)</option>
                        <option value="bairro_asc" ${window.criterioAtual === 'bairro_asc' ? 'selected' : ''}>Bairro (A-Z)</option>
                        <option value="bairro_desc" ${window.criterioAtual === 'bairro_desc' ? 'selected' : ''}>Bairro (Z-A)</option>
                        <option value="nome_asc" ${window.criterioAtual === 'nome_asc' ? 'selected' : ''}>Nome (A-Z)</option>
                        <option value="nome_desc" ${window.criterioAtual === 'nome_desc' ? 'selected' : ''}>Nome (Z-A)</option>
                    </select>
                    <div style="position:relative;">
                        <button id="btn-baixar-modal-rel" style="padding: 0.55rem 1.2rem; background: #0f172a; color: white; border: none; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;" onclick="toggleMenuDownloadModal()">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            Baixar Relatório
                        </button>
                        <div id="menu-download-modal" style="display:none; position:absolute; right:0; top:calc(100% + 8px); background:white; border-radius:10px; box-shadow:0 8px 30px rgba(0,0,0,0.18); padding:10px; z-index:101; min-width:220px; border:1px solid #e2e8f0;">
                            <button onclick="baixarRelatorioModal('relatorio')" style="width:100%; text-align:left; padding:10px 12px; background:none; border:none; border-radius:6px; font-size:13px; cursor:pointer; color:#334155; font-weight:500; display:flex; align-items:center; gap:8px;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='none'">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                Somente Relatório
                            </button>
                            <button onclick="baixarRelatorioModal('zip')" style="width:100%; text-align:left; padding:10px 12px; background:none; border:none; border-radius:6px; font-size:13px; cursor:pointer; color:#334155; font-weight:500; display:flex; align-items:center; gap:8px;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='none'">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                                Relatório + Anexos (ZIP)
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:20px;">
                <button onclick="filtrarSecaoModalNaoEfetivados('todas')" style="padding:6px 12px; border-radius:6px; border:1px solid #cbd5e1; background:#f8fafc; color:#334155; cursor:pointer; font-weight:600; font-size:13px; transition:0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='#f8fafc'">Todas</button>
                <button onclick="filtrarSecaoModalNaoEfetivados('secao-sem-prosseguimento')" style="padding:6px 12px; border-radius:6px; border:1px solid #dc2626; background:#fef2f2; color:#dc2626; cursor:pointer; font-weight:600; font-size:13px; transition:0.2s;" onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='#fef2f2'">Sem Prosseguimento</button>
                <button onclick="filtrarSecaoModalNaoEfetivados('secao-com-prosseguimento')" style="padding:6px 12px; border-radius:6px; border:1px solid #f59e0b; background:#fffbeb; color:#d97706; cursor:pointer; font-weight:600; font-size:13px; transition:0.2s;" onmouseover="this.style.background='#fef3c7'" onmouseout="this.style.background='#fffbeb'">Com Prosseguimento</button>
                <button onclick="filtrarSecaoModalNaoEfetivados('secao-com-resposta')" style="padding:6px 12px; border-radius:6px; border:1px solid #16a34a; background:#f0fdf4; color:#16a34a; cursor:pointer; font-weight:600; font-size:13px; transition:0.2s;" onmouseover="this.style.background='#dcfce7'" onmouseout="this.style.background='#f0fdf4'">Com Resposta</button>
            </div>

            ${tabelasHTML}

            ${total === 0 ? '<div style="text-align:center; padding:30px; color:#64748b;">Nenhum registro encontrado.</div>' : ''}
        </div>
    `;

    document.body.appendChild(modal);
    setTimeout(window.sincronizarScrollsModais, 100);

    if (window.criterioAtual) {
        const select = document.getElementById('select-ordenar-nao-efetivados');
        if (select) select.value = window.criterioAtual;
    }

    modal.addEventListener('click', function (e) {
        if (e.target === modal) modal.remove();
    });

    document.addEventListener('click', function fecharMenu(e) {
        const menu = document.getElementById('menu-download-modal');
        const btn = document.getElementById('btn-baixar-modal-rel');
        if (!menu || !btn) {
            document.removeEventListener('click', fecharMenu);
            return;
        }
        if (!menu.contains(e.target) && !btn.contains(e.target)) {
            menu.style.display = 'none';
        }
    });
}

function renderizarModalRespondidosNP(registros) {
    registrosModalAtual = registros;
    tipoModalAtual = 'respondidos_np';

    if (window.criterioRespondidosAtual) {
        const criterio = window.criterioRespondidosAtual;
        const ordenar = (a, b) => {
            switch (criterio) {
                case 'data_desc': {
                    const da = a.campos && a.campos.data_vencimento ? new Date(a.campos.data_vencimento) : new Date(0);
                    const db = b.campos && b.campos.data_vencimento ? new Date(b.campos.data_vencimento) : new Date(0);
                    return db - da;
                }
                case 'data_asc': {
                    const da = a.campos && a.campos.data_vencimento ? new Date(a.campos.data_vencimento) : new Date(0);
                    const db = b.campos && b.campos.data_vencimento ? new Date(b.campos.data_vencimento) : new Date(0);
                    return da - db;
                }
                case 'data_rec_desc': {
                    const da = a.campos && a.campos.data_entrada ? new Date(a.campos.data_entrada) : new Date(0);
                    const db = b.campos && b.campos.data_entrada ? new Date(b.campos.data_entrada) : new Date(0);
                    return db - da;
                }
                case 'data_rec_asc': {
                    const da = a.campos && a.campos.data_entrada ? new Date(a.campos.data_entrada) : new Date(0);
                    const db = b.campos && b.campos.data_entrada ? new Date(b.campos.data_entrada) : new Date(0);
                    return da - db;
                }
                case 'fiscal': return (a.fiscal_nome || '').localeCompare(b.fiscal_nome || '');
                case 'fiscal_desc': return (b.fiscal_nome || '').localeCompare(a.fiscal_nome || '');
                case 'bairro': return ((a.campos && a.campos.bairro) || '').localeCompare((b.campos && b.campos.bairro) || '');
                case 'bairro_desc': return ((b.campos && b.campos.bairro) || '').localeCompare((a.campos && a.campos.bairro) || '');
                case 'nome': return ((a.campos && a.campos.nome) || '').localeCompare((b.campos && b.campos.nome) || '');
                case 'nome_desc': return ((b.campos && b.campos.nome) || '').localeCompare((a.campos && a.campos.nome) || '');
                default: return 0;
            }
        };
        registros.sort(ordenar);
    }

    const atendidos = [];
    const viraramAI = [];
    const outros = [];
    const noPrazoSemDilacao = [];
    const noPrazoComDilacao = [];

    registros.forEach(reg => {
        const resp = reg.campos && reg.campos.resposta_fiscal ? reg.campos.resposta_fiscal.toLowerCase().trim() : '';
        if (resp === '') {
            if (reg.campos && (reg.campos.data_dilacao || reg.campos.data_vencimento_original)) {
                noPrazoComDilacao.push(reg);
            } else {
                noPrazoSemDilacao.push(reg);
            }
        } else if (resp.includes('atendido') || resp.includes('atendida')) {
            atendidos.push(reg);
        } else if (resp.includes('ai') || resp.includes('auto de infra')) {
            viraramAI.push(reg);
        } else {
            outros.push(reg);
        }
    });

    const modalExistente = document.getElementById('modal-vencidos-atendidos');
    if (modalExistente) modalExistente.remove();

    const hojeFmt = new Date().toLocaleDateString('pt-BR');
    const total = registros.length;

    function montarTabelaRespondidos(lista, secaoId, corBadge, textoBadge, bgSecao, tipo = 'padrao') {
        if (lista.length === 0) return '';
        let headerHTML = '<tr>';
        headerHTML += '<th class="col-curta" style="min-width: 95px;">N°</th>';
        headerHTML += '<th>Nome / Identificador</th>';
        headerHTML += '<th class="col-curta">Bairro</th>';
        headerHTML += '<th class="col-curta">Fiscal</th>';
        headerHTML += '<th class="col-curta">Data de Recebimento</th>';

        if (tipo === 'no_prazo_sem_dilacao') {
            headerHTML += '<th class="col-curta">Data Vencimento</th>';
        } else if (tipo === 'no_prazo_com_dilacao') {
            headerHTML += '<th class="col-curta">Venc. Original</th>';
            headerHTML += '<th class="col-curta">Dilação de Prazo</th>';
        }

        headerHTML += '<th>Resposta</th>';
        headerHTML += '<th class="col-curta">Anexos</th>';
        headerHTML += '</tr>';

        let bodyHTML = '';
        lista.forEach(reg => {
            const nome = (reg.campos && reg.campos.nome) || '-';
            const bairro = (reg.campos && reg.campos.bairro) || '-';
            const fiscal = reg.fiscal_nome || '-';
            const numSeq = reg.campos && reg.campos.n_notificacao ? reg.campos.n_notificacao : (reg.numero_sequencial || '-');
            const dataEntrada = (reg.campos && reg.campos.data_entrada) ? reg.campos.data_entrada.split('-').reverse().join('/') : '-';
            const resposta = reg.campos && reg.campos.resposta_fiscal ? reg.campos.resposta_fiscal : '-';

            const anexos = coletarTodosAnexos(reg);
            let anexoHTML = '';
            if (anexos.length === 0) {
                anexoHTML = '<span style="color:#94a3b8;font-size:12px;">—</span>';
            } else if (anexos.length === 1) {
                anexoHTML = `<button onclick="abrirAnexoGerente('${anexos[0]}')" style="background:#10b981;color:white;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">📎 Abrir</button>`;
            } else {
                anexoHTML = anexos.map((url, i) =>
                    `<button onclick="abrirAnexoGerente('${url}')" style="background:#10b981;color:white;border:none;padding:4px 8px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;margin:2px;">${i + 1}</button>`
                ).join('');
            }

            let colsDataAdicionais = '';
            if (tipo === 'no_prazo_sem_dilacao') {
                const dv = reg.campos && reg.campos.data_vencimento ? reg.campos.data_vencimento.split('-').reverse().join('/') : '-';
                colsDataAdicionais = `<td style="text-align:center; vertical-align:middle; color:#1e293b; font-weight:600;">${dv}</td>`;
            } else if (tipo === 'no_prazo_com_dilacao') {
                const dvo = reg.campos && reg.campos.data_vencimento_original ? reg.campos.data_vencimento_original.split('-').reverse().join('/') : '-';
                const dd = reg.campos && reg.campos.data_dilacao ? reg.campos.data_dilacao.split('-').reverse().join('/') : (reg.campos && reg.campos.data_vencimento ? reg.campos.data_vencimento.split('-').reverse().join('/') : '-');
                colsDataAdicionais = `<td style="text-align:center; vertical-align:middle;">${dvo}</td><td style="text-align:center; vertical-align:middle; color:#8b5cf6; font-weight:bold;">${dd}</td>`;
            }

            bodyHTML += `<tr style="transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">`;
            bodyHTML += `<td style="text-align:center; vertical-align:middle;">${numSeq}</td>`;
            bodyHTML += `<td style="vertical-align:middle;">${nome}</td>`;
            bodyHTML += `<td style="vertical-align:middle;">${bairro}</td>`;
            bodyHTML += `<td style="vertical-align:middle;">${fiscal}</td>`;
            bodyHTML += `<td style="text-align:center; vertical-align:middle;">${dataEntrada}</td>`;
            bodyHTML += colsDataAdicionais;
            bodyHTML += `<td style="vertical-align:middle;">${resposta}</td>`;
            bodyHTML += `<td style="text-align:center; vertical-align:middle;">${anexoHTML}</td>`;
            bodyHTML += `</tr>`;
        });

        return `
            <div id="${secaoId}" class="secao-filtro-np" style="margin-bottom: 24px; padding: 16px; background: ${bgSecao}; border-radius: 10px; border: 1px solid #e2e8f0;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
                    <h3 style="margin:0; color:#1e293b; font-size:16px;">${textoBadge}</h3>
                    <span style="background:${corBadge}; color:white; padding:4px 12px; border-radius:20px; font-size:13px; font-weight:700;">
                        ${lista.length} registro(s)
                    </span>
                </div>
                <div class="scroll-sync-wrapper" style="position:relative;">
                    <div class="historico-scroll-top" style="position:sticky; top:0; z-index:20; overflow-x:auto; overflow-y:hidden; height:14px; background:#fff; border-bottom:1px solid #e2e8f0; scrollbar-width:thin;">
                        <div class="historico-scroll-dummy" style="height:1px;"></div>
                    </div>
                    <div class="historico-scroll-bottom" style="overflow-x:auto; overflow-y:visible;">
                        <table class="historico-tabela" style="min-width:700px;">
                            <thead>${headerHTML}</thead>
                            <tbody>${bodyHTML}</tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }

    const modal = document.createElement('div');
    modal.id = 'modal-vencidos-atendidos';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;';

    modal.innerHTML = `
        <div style="background:white;border-radius:12px;width:95%;max-width:1100px;max-height:90vh;overflow:auto;padding:24px;position:relative;">
            <button onclick="document.getElementById('modal-vencidos-atendidos').remove()" style="position:absolute;top:14px;right:18px;background:none;border:none;font-size:24px;cursor:pointer;color:#64748b;">✕</button>
            
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
                <div>
                    <h2 style="margin:0; color:#1e293b; font-size:20px;">Notificações Preliminares Efetivadas</h2>
                    <p style="margin:4px 0 0 0; color:#64748b; font-size:13px;">Gerado em ${hojeFmt}</p>
                </div>
                <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                    <span style="background:#16a34a; color:white; padding:6px 14px; border-radius:20px; font-size:14px; font-weight:700;">
                        ${total} Respondidos
                    </span>
                    <select id="select-ordenar-respondidos" onchange="reordenarModalRespondidosNP(this.value)" style="padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; outline: none; background: white; cursor: pointer; color: #334155;">
                        <option value="" ${!window.criterioRespondidosAtual ? 'selected' : ''}>Ordenar por...</option>
                        <option value="data_rec_desc" ${window.criterioRespondidosAtual === 'data_rec_desc' ? 'selected' : ''}>Data Receb. (recente → antiga)</option>
                        <option value="data_rec_asc" ${window.criterioRespondidosAtual === 'data_rec_asc' ? 'selected' : ''}>Data Receb. (antiga → recente)</option>
                        <option value="data_desc" ${window.criterioRespondidosAtual === 'data_desc' ? 'selected' : ''}>Data Venc. (distante → próxima)</option>
                        <option value="data_asc" ${window.criterioRespondidosAtual === 'data_asc' ? 'selected' : ''}>Data Venc. (próxima → distante)</option>
                        <option value="fiscal" ${window.criterioRespondidosAtual === 'fiscal' ? 'selected' : ''}>Fiscal (A → Z)</option>
                        <option value="fiscal_desc" ${window.criterioRespondidosAtual === 'fiscal_desc' ? 'selected' : ''}>Fiscal (Z → A)</option>
                        <option value="bairro" ${window.criterioRespondidosAtual === 'bairro' ? 'selected' : ''}>Bairro (A → Z)</option>
                        <option value="bairro_desc" ${window.criterioRespondidosAtual === 'bairro_desc' ? 'selected' : ''}>Bairro (Z → A)</option>
                        <option value="nome" ${window.criterioRespondidosAtual === 'nome' ? 'selected' : ''}>Nome (A → Z)</option>
                        <option value="nome_desc" ${window.criterioRespondidosAtual === 'nome_desc' ? 'selected' : ''}>Nome (Z → A)</option>
                    </select>
                    <div style="position:relative;">
                        <button id="btn-baixar-modal-rel" style="padding: 0.55rem 1.2rem; background: #0f172a; color: white; border: none; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;" onclick="toggleMenuDownloadModal()">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            Baixar Relatório
                        </button>
                        <div id="menu-download-modal" style="display:none; position:absolute; right:0; top:calc(100% + 8px); background:white; border-radius:10px; box-shadow:0 8px 30px rgba(0,0,0,0.18); padding:10px; z-index:101; min-width:220px; border:1px solid #e2e8f0;">
                            <button onclick="baixarRelatorioModal('relatorio')" style="width:100%; text-align:left; padding:10px 12px; background:none; border:none; border-radius:6px; font-size:13px; cursor:pointer; color:#334155; font-weight:500; display:flex; align-items:center; gap:8px;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='none'">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                Somente Relatório
                            </button>
                            <button onclick="baixarRelatorioModal('completo')" style="width:100%; text-align:left; padding:10px 12px; background:none; border:none; border-radius:6px; font-size:13px; cursor:pointer; color:#334155; font-weight:500; display:flex; align-items:center; gap:8px;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='none'">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                                Relatório + Anexos (ZIP)
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:20px;">
                <button onclick="filtrarSecaoModalNP('todas')" style="padding:6px 12px; border-radius:6px; border:1px solid #cbd5e1; background:#f8fafc; color:#334155; cursor:pointer; font-weight:600; font-size:13px; transition:0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='#f8fafc'">Todas</button>
                <button onclick="filtrarSecaoModalNP('secao-atendidos')" style="padding:6px 12px; border-radius:6px; border:1px solid #16a34a; background:#f0fdf4; color:#16a34a; cursor:pointer; font-weight:600; font-size:13px; transition:0.2s;" onmouseover="this.style.background='#dcfce7'" onmouseout="this.style.background='#f0fdf4'">Atendidas</button>
                <button onclick="filtrarSecaoModalNP('secao-no-prazo')" style="padding:6px 12px; border-radius:6px; border:1px solid #8b5cf6; background:#f5f3ff; color:#8b5cf6; cursor:pointer; font-weight:600; font-size:13px; transition:0.2s;" onmouseover="this.style.background='#ede9fe'" onmouseout="this.style.background='#f5f3ff'">No prazo de cumprimento</button>
                <button onclick="filtrarSecaoModalNP('secao-viraram-ai')" style="padding:6px 12px; border-radius:6px; border:1px solid #f59e0b; background:#fffbeb; color:#d97706; cursor:pointer; font-weight:600; font-size:13px; transition:0.2s;" onmouseover="this.style.background='#fef3c7'" onmouseout="this.style.background='#fffbeb'">Viraram AI</button>
                <button onclick="filtrarSecaoModalNP('secao-outros')" style="padding:6px 12px; border-radius:6px; border:1px solid #3b82f6; background:#eff6ff; color:#2563eb; cursor:pointer; font-weight:600; font-size:13px; transition:0.2s;" onmouseover="this.style.background='#dbeafe'" onmouseout="this.style.background='#eff6ff'">Outras respostas</button>
            </div>

            ${montarTabelaRespondidos(atendidos, 'secao-atendidos', '#16a34a', '✅ Notificações Preliminares Atendidas', '#f0fdf4')}
            ${montarTabelaRespondidos(noPrazoComDilacao, 'secao-no-prazo-com-dilacao', '#8b5cf6', '⏳ Notificações Preliminares com Dilação de Prazo', '#f5f3ff', 'no_prazo_com_dilacao')}
            ${montarTabelaRespondidos(noPrazoSemDilacao, 'secao-no-prazo-sem-dilacao', '#8b5cf6', '⏳ Notificação Preliminar com data de Vencimento mas sem resposta e ainda no prazo', '#f5f3ff', 'no_prazo_sem_dilacao')}
            ${montarTabelaRespondidos(viraramAI, 'secao-viraram-ai', '#f59e0b', '⚠️ Notificações Preliminares que Viraram AI', '#fffbeb')}
            ${montarTabelaRespondidos(outros, 'secao-outros', '#3b82f6', 'ℹ️ Outras Respostas', '#eff6ff')}
            
            ${total === 0 ? '<div style="text-align:center; padding:30px; color:#64748b;">Nenhum registro encontrado.</div>' : ''}
        </div>
    `;

    document.body.appendChild(modal);
    setTimeout(window.sincronizarScrollsModais, 100);

    if (window.criterioRespondidosAtual) {
        const select = document.getElementById('select-ordenar-respondidos');
        if (select) select.value = window.criterioRespondidosAtual;
    }

    modal.addEventListener('click', function (e) {
        if (e.target === modal) modal.remove();
    });

    document.addEventListener('click', function fecharMenu(e) {
        const menu = document.getElementById('menu-download-modal');
        const btn = document.getElementById('btn-baixar-modal-rel');
        if (!menu || !btn) {
            document.removeEventListener('click', fecharMenu);
            return;
        }
        if (!menu.contains(e.target) && !btn.contains(e.target)) {
            menu.style.display = 'none';
        }
    });
}

window.filtrarSecaoModalNP = function (idMostrar) {
    const secoes = document.querySelectorAll('.secao-filtro-np');
    secoes.forEach(secao => {
        if (idMostrar === 'todas' || secao.id.startsWith(idMostrar)) {
            secao.style.display = 'block';
        } else {
            secao.style.display = 'none';
        }
    });
};

window.filtrarSecaoModalNaoEfetivados = function (idMostrar) {
    const secoes = document.querySelectorAll('.secao-filtro-nao-efetivados');
    secoes.forEach(secao => {
        if (idMostrar === 'todas' || secao.id === idMostrar) {
            secao.style.display = 'block';
        } else {
            secao.style.display = 'none';
        }
    });
};

window.reordenarModalRespondidosNP = function (criterio) {
    if (!registrosModalAtual) return;
    window.criterioRespondidosAtual = criterio;

    // Identificar filtro ativo
    let secaoAtiva = 'todas';
    const secoes = document.querySelectorAll('.secao-filtro-np');
    let visiveis = 0;
    secoes.forEach(secao => {
        if (secao.style.display !== 'none') {
            visiveis++;
            secaoAtiva = secao.id;
        }
    });
    if (visiveis > 1) secaoAtiva = 'todas';

    // Recriar a janela (removendo e rodando de novo)
    const modalExistente = document.getElementById('modal-vencidos-atendidos');
    if (modalExistente) modalExistente.remove();

    renderizarModalRespondidosNP(registrosModalAtual);

    if (secaoAtiva !== 'todas') {
        window.filtrarSecaoModalNP(secaoAtiva);
    }
};

function coletarTodosAnexos(reg) {
    const anexos = [];
    if (reg.campos) {
        if (reg.campos.anexo_pdf) anexos.push(reg.campos.anexo_pdf);
        if (reg.campos.anexo_ar) {
            if (Array.isArray(reg.campos.anexo_ar)) {
                reg.campos.anexo_ar.forEach(ar => {
                    if (ar && typeof ar === 'object' && ar.url) anexos.push(ar.url);
                    else if (typeof ar === 'string') anexos.push(ar);
                });
            } else {
                anexos.push(reg.campos.anexo_ar);
            }
        }
        if (Array.isArray(reg.campos.anexos_extras)) {
            reg.campos.anexos_extras.forEach(url => {
                if (url && typeof url === 'string') anexos.push(url);
            });
        }
    }
    return [...new Set(anexos)]; // remover duplicatas
}

function renderizarModalRelatorio(titulo, registros, tipo) {
    registrosModalAtual = registros;
    tipoModalAtual = tipo;
    if (tipo === 'vencidos') {
        registrosModalOriginal = [...registros];
        vencidosComAIGlobal = [];
        vencidosSemAIGlobal = [];
        aisVinculadosGlobal = [];
    }

    const modalExistente = document.getElementById('modal-vencidos-atendidos');
    if (modalExistente) modalExistente.remove();

    const hojeFmt = new Date().toLocaleDateString('pt-BR');

    let headerHTML = '<tr>';
    headerHTML += '<th class="col-curta" style="min-width: 95px;">N°</th>';
    headerHTML += '<th>Nome / Identificador</th>';
    headerHTML += '<th class="col-curta">Bairro</th>';
    headerHTML += '<th class="col-curta">Fiscal</th>';
    headerHTML += '<th class="col-curta">Data Venc.</th>';
    headerHTML += '<th class="col-curta">Resposta</th>';
    headerHTML += '<th class="col-curta">Anexos</th>';
    headerHTML += '</tr>';

    let bodyHTML = '';
    registros.forEach(reg => {
        const nome = (reg.campos && reg.campos.nome) || '-';
        const bairro = (reg.campos && reg.campos.bairro) || '-';
        const fiscal = reg.fiscal_nome || '-';
        const numSeq = ((subAbaAtual === '1.1' || subAbaAtual === 'np-af') && reg.campos && (reg.numero_sequencial || reg.campos.n_notificacao))
            ? reg.campos.n_notificacao
            : (reg.numero_sequencial || (reg.campos && reg.campos.n_notificacao) || '-');
        const dataVenc = reg.campos && reg.campos.data_vencimento
            ? reg.campos.data_vencimento.split('-').reverse().join('/')
            : '-';
        const resposta = reg.campos && reg.campos.resposta_fiscal ? reg.campos.resposta_fiscal : '-';

        const anexos = coletarTodosAnexos(reg);
        let anexoHTML = '';
        if (anexos.length === 0) {
            anexoHTML = '<span style="color:#94a3b8;font-size:12px;">—</span>';
        } else if (anexos.length === 1) {
            anexoHTML = `<button onclick="abrirAnexoGerente('${anexos[0]}')" style="background:#10b981;color:white;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">📎 Abrir</button>`;
        } else {
            anexoHTML = anexos.map((url, i) =>
                `<button onclick="abrirAnexoGerente('${url}')" style="background:#10b981;color:white;border:none;padding:4px 8px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;margin:2px;">${i + 1}</button>`
            ).join('');
        }

        bodyHTML += `<tr style="transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">`;
        bodyHTML += `<td style="text-align:center; vertical-align:middle;">${numSeq}</td>`;
        bodyHTML += `<td style="vertical-align:middle;">${nome}</td>`;
        bodyHTML += `<td style="vertical-align:middle;">${bairro}</td>`;
        bodyHTML += `<td style="vertical-align:middle;">${fiscal}</td>`;
        bodyHTML += `<td style="text-align:center; vertical-align:middle;">${dataVenc}</td>`;
        bodyHTML += `<td style="vertical-align:middle;">${resposta}</td>`;
        bodyHTML += `<td style="text-align:center; vertical-align:middle;">${anexoHTML}</td>`;
        bodyHTML += `</tr>`;
    });

    const total = registros.length;
    const corBadge = tipo === 'vencidos' ? '#dc2626' : '#16a34a';
    const textoBadge = tipo === 'vencidos' ? 'Vencidos' : 'Atendidos';

    const modal = document.createElement('div');
    modal.id = 'modal-vencidos-atendidos';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;';

    modal.innerHTML = `
        <div style="background:white;border-radius:12px;width:95%;max-width:1100px;max-height:90vh;overflow:auto;padding:24px;position:relative;">
            <button onclick="document.getElementById('modal-vencidos-atendidos').remove()" style="position:absolute;top:14px;right:18px;background:none;border:none;font-size:24px;cursor:pointer;color:#64748b;">✕</button>
            
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
                <div>
                    <h2 style="margin:0; color:#1e293b; font-size:20px;">${titulo}</h2>
                    <p style="margin:4px 0 0 0; color:#64748b; font-size:13px;">Gerado em ${hojeFmt}</p>
                </div>
                <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                    <span style="background:${corBadge}; color:white; padding:6px 14px; border-radius:20px; font-size:14px; font-weight:700;">
                        ${total} ${textoBadge}
                    </span>
                    ${tipo === 'vencidos' ? `
                    <select id="select-ordenar-vencidos" onchange="reordenarModalVencidos(this.value)" style="padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; outline: none; background: white; cursor: pointer; color: #334155;">
                        <option value="">Ordenar por...</option>
                        <option value="data_desc">Data Venc. (próxima → distante)</option>
                        <option value="data_asc">Data Venc. (distante → próxima)</option>
                        <option value="fiscal">Fiscal (A → Z)</option>
                        <option value="fiscal_desc">Fiscal (Z → A)</option>
                        <option value="bairro">Bairro (A → Z)</option>
                        <option value="bairro_desc">Bairro (Z → A)</option>
                        <option value="nome">Nome (A → Z)</option>
                        <option value="nome_desc">Nome (Z → A)</option>
                    </select>` : ''}
                    <div style="position:relative;">
                        <button id="btn-baixar-modal-rel" style="padding: 0.55rem 1.2rem; background: #0f172a; color: white; border: none; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;" onclick="toggleMenuDownloadModal()">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            Baixar Relatório
                        </button>
                        <div id="menu-download-modal" style="display:none; position:absolute; right:0; top:calc(100% + 8px); background:white; border-radius:10px; box-shadow:0 8px 30px rgba(0,0,0,0.18); padding:10px; z-index:101; min-width:220px; border:1px solid #e2e8f0;">
                            <button onclick="baixarRelatorioModal('relatorio')" style="width:100%; text-align:left; padding:10px 12px; background:none; border:none; border-radius:6px; font-size:13px; cursor:pointer; color:#334155; font-weight:500; display:flex; align-items:center; gap:8px;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='none'">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                Somente Relatório
                            </button>
                            <button onclick="baixarRelatorioModal('completo')" style="width:100%; text-align:left; padding:10px 12px; background:none; border:none; border-radius:6px; font-size:13px; cursor:pointer; color:#334155; font-weight:500; display:flex; align-items:center; gap:8px;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='none'">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                                Relatório + Anexos (ZIP)
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div style="overflow-x:auto;">
                <table class="historico-tabela" style="min-width:700px;">
                    <thead>${headerHTML}</thead>
                    <tbody>${bodyHTML}</tbody>
                </table>
            </div>

            ${total === 0 ? '<div style="text-align:center; padding:30px; color:#64748b;">Nenhum registro encontrado.</div>' : ''}
        </div>
    `;

    document.body.appendChild(modal);

    if (window.criterioAtual) {
        const select = document.getElementById('select-ordenar-vencidos');
        if (select) select.value = window.criterioAtual;
    }

    // Fechar ao clicar fora
    modal.addEventListener('click', function (e) {
        if (e.target === modal) modal.remove();
    });

    // Fechar menu ao clicar fora
    document.addEventListener('click', function fecharMenu(e) {
        const menu = document.getElementById('menu-download-modal');
        const btn = document.getElementById('btn-baixar-modal-rel');
        if (!menu || !btn) {
            document.removeEventListener('click', fecharMenu);
            return;
        }
        if (!menu.contains(e.target) && !btn.contains(e.target)) {
            menu.style.display = 'none';
        }
    });
}

function toggleMenuDownloadModal() {
    const menu = document.getElementById('menu-download-modal');
    if (menu) menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
}

async function baixarRelatorioModal(tipoDownload) {
    const menu = document.getElementById('menu-download-modal');
    if (menu) menu.style.display = 'none';

    if (!registrosModalAtual || registrosModalAtual.length === 0) {
        Swal.fire('Aviso', 'Nenhum registro para gerar relatório.', 'info');
        return;
    }

    const titulo = tipoModalAtual === 'vencidos' ? 'Relatório de Vencidos' : 'Relatório de Atendidos';
    const tipoDoc = (subAbaAtual === '1.1' || subAbaAtual === 'np-af') ? 'Notificação / AF' : 'Auto de Infração';
    const hoje = new Date().toLocaleDateString('pt-BR');

    let htmlRelatorio = '';

    if (tipoModalAtual === 'respondidos_np') {
        const atendidos = [];
        const viraramAI = [];
        const outros = [];
        const noPrazoSemDilacao = [];
        const noPrazoComDilacao = [];
        registrosModalAtual.forEach(reg => {
            const resp = reg.campos && reg.campos.resposta_fiscal ? reg.campos.resposta_fiscal.toLowerCase().trim() : '';
            if (resp === '') {
                if (reg.campos && (reg.campos.data_dilacao || reg.campos.data_vencimento_original)) noPrazoComDilacao.push(reg);
                else noPrazoSemDilacao.push(reg);
            }
            else if (resp.includes('atendido') || resp.includes('atendida')) atendidos.push(reg);
            else if (resp.includes('ai') || resp.includes('auto de infra')) viraramAI.push(reg);
            else outros.push(reg);
        });

        const gerarLinhas = (lista, tipo = 'padrao') => {
            if (lista.length === 0) return '';
            let html = '';
            lista.forEach((reg, idx) => {
                const nome = (reg.campos && reg.campos.nome) || '-';
                const bairro = (reg.campos && reg.campos.bairro) || '-';
                const fiscal = reg.fiscal_nome || '-';
                const numSeq = reg.campos && reg.campos.n_notificacao ? reg.campos.n_notificacao : (reg.numero_sequencial || '-');
                const dataEntrada = (reg.campos && reg.campos.data_entrada) ? reg.campos.data_entrada.split('-').reverse().join('/') : '-';
                const resposta = reg.campos && reg.campos.resposta_fiscal ? reg.campos.resposta_fiscal : '-';

                let colsData = '';
                if (tipo === 'no_prazo_sem_dilacao') {
                    const dv = reg.campos && reg.campos.data_vencimento ? reg.campos.data_vencimento.split('-').reverse().join('/') : '-';
                    colsData = `<td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${dv}</td>`;
                } else if (tipo === 'no_prazo_com_dilacao') {
                    const dvo = reg.campos && reg.campos.data_vencimento_original ? reg.campos.data_vencimento_original.split('-').reverse().join('/') : '-';
                    const dd = reg.campos && reg.campos.data_dilacao ? reg.campos.data_dilacao.split('-').reverse().join('/') : (reg.campos && reg.campos.data_vencimento ? reg.campos.data_vencimento.split('-').reverse().join('/') : '-');
                    colsData = `<td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${dvo}</td><td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${dd}</td>`;
                }

                html += `
                    <tr>
                        <td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${idx + 1}</td>
                        <td style="border:1px solid #cbd5e1; padding:8px;">${numSeq}</td>
                        <td style="border:1px solid #cbd5e1; padding:8px;">${nome}</td>
                        <td style="border:1px solid #cbd5e1; padding:8px;">${bairro}</td>
                        <td style="border:1px solid #cbd5e1; padding:8px;">${fiscal}</td>
                        <td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${dataEntrada}</td>
                        ${colsData}
                        <td style="border:1px solid #cbd5e1; padding:8px;">${resposta}</td>
                    </tr>
                `;
            });
            return html;
        };

        htmlRelatorio = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Relatório de Notificações Respondidas</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 30px; color: #1e293b; }
                h1 { font-size: 18px; margin-bottom: 6px; }
                h2 { font-size: 14px; color: #64748b; margin-bottom: 20px; font-weight: normal; }
                h3 { font-size: 15px; margin-top: 25px; margin-bottom: 10px; color: #334155; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px; }
                table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; }
                th { background: #0f172a; color: white; padding: 7px; text-align: left; border: 1px solid #cbd5e1; }
                td { border: 1px solid #cbd5e1; padding: 8px; }
                tr:nth-child(even) { background: #f8fafc; }
                .footer { margin-top: 20px; font-size: 11px; color: #64748b; text-align: right; }
                @media print { body { margin: 15px; } }
            </style>
        </head>
        <body>
            <h1>Notificações Preliminares Efetivadas</h1>
            <h2>Total: ${registrosModalAtual.length} registro(s) &nbsp;|&nbsp; Emitido em ${hoje}</h2>
            
            ${atendidos.length > 0 ? `
                <h3>✅ Notificações Preliminares Atendidas (${atendidos.length})</h3>
                <table>
                    <thead>
                        <tr><th>#</th><th style="min-width: 95px;">N°</th><th>Nome / Identificador</th><th>Bairro</th><th>Fiscal</th><th>Data de Recebimento</th><th>Resposta</th></tr>
                    </thead>
                    <tbody>${gerarLinhas(atendidos)}</tbody>
                </table>
            ` : ''}

            ${noPrazoComDilacao.length > 0 ? `
                <h3>⏳ Notificações Preliminares com Dilação de Prazo (${noPrazoComDilacao.length})</h3>
                <table>
                    <thead>
                        <tr><th>#</th><th style="min-width: 95px;">N°</th><th>Nome / Identificador</th><th>Bairro</th><th>Fiscal</th><th>Data de Recebimento</th><th>Venc. Original</th><th>Dilação de Prazo</th><th>Resposta</th></tr>
                    </thead>
                    <tbody>${gerarLinhas(noPrazoComDilacao, 'no_prazo_com_dilacao')}</tbody>
                </table>
            ` : ''}

            ${noPrazoSemDilacao.length > 0 ? `
                <h3>⏳ Notificação Preliminar com data de Vencimento mas sem resposta e ainda no prazo (${noPrazoSemDilacao.length})</h3>
                <table>
                    <thead>
                        <tr><th>#</th><th style="min-width: 95px;">N°</th><th>Nome / Identificador</th><th>Bairro</th><th>Fiscal</th><th>Data de Recebimento</th><th>Data Venc.</th><th>Resposta</th></tr>
                    </thead>
                    <tbody>${gerarLinhas(noPrazoSemDilacao, 'no_prazo_sem_dilacao')}</tbody>
                </table>
            ` : ''}

            ${viraramAI.length > 0 ? `
                <h3>⚠️ Notificações Preliminares que Viraram AI (${viraramAI.length})</h3>
                <table>
                    <thead>
                        <tr><th>#</th><th style="min-width: 95px;">N°</th><th>Nome / Identificador</th><th>Bairro</th><th>Fiscal</th><th>Data de Recebimento</th><th>Resposta</th></tr>
                    </thead>
                    <tbody>${gerarLinhas(viraramAI)}</tbody>
                </table>
            ` : ''}

            ${outros.length > 0 ? `
                <h3>ℹ️ Outras Respostas (${outros.length})</h3>
                <table>
                    <thead>
                        <tr><th>#</th><th style="min-width: 95px;">N°</th><th>Nome / Identificador</th><th>Bairro</th><th>Fiscal</th><th>Data de Recebimento</th><th>Resposta</th></tr>
                    </thead>
                    <tbody>${gerarLinhas(outros)}</tbody>
                </table>
            ` : ''}
            
            <div class="footer">SEMAC — Sistema de Gestão da Fiscalização de Posturas</div>
        </body>
        </html>
        `;
    } else if (tipoModalAtual === 'vencidos' && (subAbaAtual === '1.1' || subAbaAtual === 'np-af')) {
        const comAI = vencidosComAIGlobal || [];
        const semAI = vencidosSemAIGlobal || [];
        const semAIComDilacao = [];
        const semAISemDilacao = [];
        semAI.forEach(reg => {
            if (reg.campos && (reg.campos.data_dilacao || reg.campos.data_vencimento_original)) {
                semAIComDilacao.push(reg);
            } else {
                semAISemDilacao.push(reg);
            }
        });

        const gerarLinhasV = (lista, tipo = 'padrao') => {
            if (lista.length === 0) return '';
            let html = '';
            lista.forEach((reg, idx) => {
                const nome = (reg.campos && reg.campos.nome) || '-';
                const bairro = (reg.campos && reg.campos.bairro) || '-';
                const fiscal = reg.fiscal_nome || '-';
                const numSeq = (reg.campos && reg.campos.n_notificacao) ? reg.campos.n_notificacao : (reg.numero_sequencial || '-');
                const dataEntrada = (reg.campos && reg.campos.data_entrada) ? reg.campos.data_entrada.split('-').reverse().join('/') : '-';
                const resposta = reg.campos && reg.campos.resposta_fiscal ? reg.campos.resposta_fiscal : '-';

                let colsData = '';
                if (tipo === 'com_dilacao') {
                    const dvo = reg.campos && reg.campos.data_vencimento_original ? reg.campos.data_vencimento_original.split('-').reverse().join('/') : '-';
                    const dd = reg.campos && reg.campos.data_dilacao ? reg.campos.data_dilacao.split('-').reverse().join('/') : (reg.campos && reg.campos.data_vencimento ? reg.campos.data_vencimento.split('-').reverse().join('/') : '-');
                    colsData = `<td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${dvo}</td><td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${dd}</td>`;
                } else {
                    const dataVenc = reg.campos && reg.campos.data_vencimento ? reg.campos.data_vencimento.split('-').reverse().join('/') : '-';
                    colsData = `<td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${dataVenc}</td>`;
                }

                html += `
                    <tr>
                        <td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${idx + 1}</td>
                        <td style="border:1px solid #cbd5e1; padding:8px;">${numSeq}</td>
                        <td style="border:1px solid #cbd5e1; padding:8px;">${nome}</td>
                        <td style="border:1px solid #cbd5e1; padding:8px;">${bairro}</td>
                        <td style="border:1px solid #cbd5e1; padding:8px;">${fiscal}</td>
                        <td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${dataEntrada}</td>
                        ${colsData}
                        <td style="border:1px solid #cbd5e1; padding:8px;">${resposta}</td>
                    </tr>
                `;
            });
            return html;
        };

        htmlRelatorio = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>${titulo}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 30px; color: #1e293b; }
                h1 { font-size: 18px; margin-bottom: 6px; }
                h2 { font-size: 14px; color: #64748b; margin-bottom: 20px; font-weight: normal; }
                h3 { font-size: 15px; margin-top: 25px; margin-bottom: 10px; color: #334155; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px; }
                table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; }
                th { background: #0f172a; color: white; padding: 7px; text-align: left; border: 1px solid #cbd5e1; }
                td { border: 1px solid #cbd5e1; padding: 8px; }
                tr:nth-child(even) { background: #f8fafc; }
                .footer { margin-top: 20px; font-size: 11px; color: #64748b; text-align: right; }
                @media print { body { margin: 15px; } }
            </style>
        </head>
        <body>
            <h1>${titulo} — ${tipoDoc}</h1>
            <h2>Total: ${registrosModalAtual.length} registro(s) &nbsp;|&nbsp; Emitido em ${hoje}</h2>
            
            ${comAI.length > 0 ? `
                <h3>⚠️ Notificações Preliminares vencidas com Auto de Infração vinculado (${comAI.length})</h3>
                <table>
                    <thead>
                        <tr><th>#</th><th style="min-width: 95px;">N°</th><th>Nome / Identificador</th><th>Bairro</th><th>Fiscal</th><th>Data de Recebimento</th><th>Data Venc.</th><th>Resposta</th></tr>
                    </thead>
                    <tbody>${gerarLinhasV(comAI)}</tbody>
                </table>
            ` : ''}

            ${semAIComDilacao.length > 0 ? `
                <h3>⏳ Notificações Preliminares com Dilação de Prazo vencidos (${semAIComDilacao.length})</h3>
                <table>
                    <thead>
                        <tr><th>#</th><th style="min-width: 95px;">N°</th><th>Nome / Identificador</th><th>Bairro</th><th>Fiscal</th><th>Data de Recebimento</th><th>Venc. Original</th><th>Dilação de Prazo</th><th>Resposta</th></tr>
                    </thead>
                    <tbody>${gerarLinhasV(semAIComDilacao, 'com_dilacao')}</tbody>
                </table>
            ` : ''}

            ${semAISemDilacao.length > 0 ? `
                <h3>🔴 Notificações Preliminares vencidas sem Auto de Infração (${semAISemDilacao.length})</h3>
                <table>
                    <thead>
                        <tr><th>#</th><th style="min-width: 95px;">N°</th><th>Nome / Identificador</th><th>Bairro</th><th>Fiscal</th><th>Data de Recebimento</th><th>Data Venc.</th><th>Resposta</th></tr>
                    </thead>
                    <tbody>${gerarLinhasV(semAISemDilacao)}</tbody>
                </table>
            ` : ''}

            <div class="footer">SEMAC — Sistema de Gestão da Fiscalização de Posturas</div>
        </body>
        </html>
        `;
    } else if (tipoModalAtual !== 'nao_efetivados') {
        // Logica antiga para Vencidos sem AI ou AI Respondidos
        let rowsHTML = '';
        registrosModalAtual.forEach((reg, idx) => {
            const nome = (reg.campos && reg.campos.nome) || '-';
            const bairro = (reg.campos && reg.campos.bairro) || '-';
            const fiscal = reg.fiscal_nome || '-';
            const numSeq = ((subAbaAtual === '1.1' || subAbaAtual === 'np-af') && reg.campos && (reg.numero_sequencial || reg.campos.n_notificacao))
                ? reg.campos.n_notificacao
                : (reg.numero_sequencial || (reg.campos && reg.campos.n_notificacao) || '-');
            const dataVenc = reg.campos && reg.campos.data_vencimento
                ? reg.campos.data_vencimento.split('-').reverse().join('/')
                : '-';
            const resposta = reg.campos && reg.campos.resposta_fiscal ? reg.campos.resposta_fiscal : '-';
            const dataEntrada = (reg.campos && reg.campos.data_entrada) ? reg.campos.data_entrada.split('-').reverse().join('/') : '-';

            rowsHTML += `
                <tr>
                    <td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${idx + 1}</td>
                    <td style="border:1px solid #cbd5e1; padding:8px;">${numSeq}</td>
                    <td style="border:1px solid #cbd5e1; padding:8px;">${nome}</td>
                    <td style="border:1px solid #cbd5e1; padding:8px;">${bairro}</td>
                    <td style="border:1px solid #cbd5e1; padding:8px;">${fiscal}</td>
                    <td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${dataEntrada}</td>
                    <td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${dataVenc}</td>
                    <td style="border:1px solid #cbd5e1; padding:8px;">${resposta}</td>
                </tr>
            `;
        });

        htmlRelatorio = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <title>${titulo}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 30px; color: #1e293b; }
                    h1 { font-size: 18px; margin-bottom: 6px; }
                    h2 { font-size: 14px; color: #64748b; margin-bottom: 20px; font-weight: normal; }
                    table { width: 100%; border-collapse: collapse; font-size: 12px; }
                    th { background: #0f172a; color: white; padding: 7px; text-align: left; border: 1px solid #cbd5e1; }
                    td { border: 1px solid #cbd5e1; padding: 8px; }
                    tr:nth-child(even) { background: #f8fafc; }
                    .footer { margin-top: 20px; font-size: 11px; color: #64748b; text-align: right; }
                    @media print { body { margin: 15px; } }
                </style>
            </head>
            <body>
                <h1>${titulo} — ${tipoDoc}</h1>
                <h2>Total: ${registrosModalAtual.length} registro(s) &nbsp;|&nbsp; Emitido em ${hoje}</h2>
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th style="min-width: 95px;">N°</th>
                            <th>Nome / Identificador</th>
                            <th>Bairro</th>
                            <th>Fiscal</th>
                            <th>Data de Recebimento</th>
                            <th>Data Venc.</th>
                            <th>Resposta</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHTML}</tbody>
                </table>
                <div class="footer">SEMAC — Sistema de Gestão da Fiscalização de Posturas</div>
            </body>
            </html>
        `;
    } else if (tipoModalAtual === 'pendentes') {
        let tituloPendentes = 'Relatório de Documentos Pendentes';
        let tituloH1 = 'Relatório de Documentos Pendentes';
        if (subAbaAtual === '1.1' || subAbaAtual === 'np-af') {
            tituloPendentes = 'Notificações Preliminares Pendentes';
            tituloH1 = 'Relatório de Notificações Preliminares Pendentes';
        } else if (subAbaAtual === '1.2' || subAbaAtual === '1.2.MA' || subAbaAtual === 'ai-ma') {
            tituloPendentes = 'Autos de Infração Pendentes';
            tituloH1 = 'Relatório de Autos de Infração Pendentes';
        }

        const gerarLinhasPdfPendentes = (lista) => {
            if (lista.length === 0) return '';
            let html = '';
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            lista.forEach((reg, idx) => {
                const nome = (reg.campos && reg.campos.nome) || '-';
                const fiscal = reg.fiscal_nome || '-';
                const numSeq = (reg.campos && reg.campos.n_notificacao) ? reg.campos.n_notificacao : (reg.numero_sequencial || '-');
                const dataRegistrada = reg.created_at ? new Date(reg.created_at).toLocaleDateString('pt-BR') : '-';
                const ar = (reg.campos && reg.campos.ar) ? reg.campos.ar : '-';

                let periodoTexto = '-';
                let periodoColor = '#1e293b';
                let periodoFontWeight = 'normal';
                if (reg.created_at) {
                    const dataCriacao = new Date(reg.created_at);
                    dataCriacao.setHours(0, 0, 0, 0);
                    const diffTime = Math.abs(hoje - dataCriacao);
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    periodoTexto = `${diffDays} dia(s)`;
                    if (diffDays > 180) {
                        periodoColor = '#dc2626';
                        periodoFontWeight = 'bold';
                    }
                }

                html += `<tr>`;
                html += `<td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${idx + 1}</td>`;
                html += `<td style="border:1px solid #cbd5e1; padding:8px;">${numSeq}</td>`;
                html += `<td style="border:1px solid #cbd5e1; padding:8px;">${nome}</td>`;
                html += `<td style="border:1px solid #cbd5e1; padding:8px;">${fiscal}</td>`;
                html += `<td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${dataRegistrada}</td>`;
                html += `<td style="border:1px solid #cbd5e1; padding:8px; text-align:center; color:${periodoColor}; font-weight:${periodoFontWeight};">${periodoTexto}</td>`;
                html += `<td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${ar}</td>`;
                html += `</tr>`;
            });
            return html;
        };

        const theadHtml = `<tr>
            <th style="background: #0f172a; color: white; padding: 7px; text-align: left; border: 1px solid #cbd5e1;">#</th>
            <th style="background: #0f172a; color: white; padding: 7px; text-align: left; border: 1px solid #cbd5e1; min-width: 95px;">N°</th>
            <th style="background: #0f172a; color: white; padding: 7px; text-align: left; border: 1px solid #cbd5e1;">Nome / Identificador</th>
            <th style="background: #0f172a; color: white; padding: 7px; text-align: left; border: 1px solid #cbd5e1;">Fiscal</th>
            <th style="background: #0f172a; color: white; padding: 7px; text-align: left; border: 1px solid #cbd5e1;">Data Registrada</th>
            <th style="background: #0f172a; color: white; padding: 7px; text-align: left; border: 1px solid #cbd5e1;">Período Pendente</th>
            <th style="background: #0f172a; color: white; padding: 7px; text-align: left; border: 1px solid #cbd5e1;">AR</th>
        </tr>`;

        htmlRelatorio = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <title>${tituloPendentes}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 30px; color: #1e293b; }
                    h1 { font-size: 18px; margin-bottom: 6px; }
                    h2 { font-size: 14px; color: #64748b; margin-bottom: 20px; font-weight: normal; }
                    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; }
                    th { background: #0f172a; color: white; padding: 7px; text-align: left; border: 1px solid #cbd5e1; }
                    td { border: 1px solid #cbd5e1; padding: 8px; }
                    tr:nth-child(even) { background: #f8fafc; }
                    .footer { margin-top: 20px; font-size: 11px; color: #64748b; text-align: right; }
                    @media print { body { margin: 15px; } }
                </style>
            </head>
            <body>
                <h1>${tituloH1}</h1>
                <h2>Total: ${registrosModalAtual.length} registro(s) &nbsp;|&nbsp; Emitido em ${hoje}</h2>
                
                <table>
                    <thead>${theadHtml}</thead>
                    <tbody>${gerarLinhasPdfPendentes(registrosModalAtual)}</tbody>
                </table>
                
                <div class="footer">SEMAC — Sistema de Gestão da Fiscalização de Posturas</div>
            </body>
            </html>
        `;
    } else if (tipoModalAtual === 'nao_efetivados') {
        let tituloNaoEfetivados = 'Relatório de Não Efetivados';
        let tituloH1 = 'Relatório de Registros Devolvidos (Não Efetivados)';
        if (subAbaAtual === '1.1' || subAbaAtual === 'np-af') {
            tituloNaoEfetivados = 'Notificação Preliminar Não Efetivada';
            tituloH1 = 'Relatório de Notificações Preliminares Não Efetivadas';
        } else if (subAbaAtual === '1.2' || subAbaAtual === '1.2.MA' || subAbaAtual === 'ai-ma') {
            tituloNaoEfetivados = 'Auto de Infração Não Efetivado';
            tituloH1 = 'Relatório de Autos de Infração Não Efetivados';
        }

        const semProsseguimento = [];
        const comProsseguimento = [];
        const comResposta = [];

        registrosModalAtual.forEach(reg => {
            const resp = reg.campos && reg.campos.resposta_fiscal ? reg.campos.resposta_fiscal.trim() : '';
            const dataEntrada = reg.campos && reg.campos.data_entrada ? reg.campos.data_entrada.trim() : '';
            const dataVenc = reg.campos && reg.campos.data_vencimento ? reg.campos.data_vencimento.trim() : '';

            if (resp !== '') {
                comResposta.push(reg);
            } else if (dataEntrada !== '' || dataVenc !== '') {
                comProsseguimento.push(reg);
            } else {
                semProsseguimento.push(reg);
            }
        });

        const gerarLinhasPdf = (registros, tipo) => {
            if (registros.length === 0) return '';
            let html = '';
            registros.forEach((reg, idx) => {
                const nome = (reg.campos && reg.campos.nome) || '-';
                const fiscal = reg.fiscal_nome || '-';
                const numSeq = (reg.campos && reg.campos.n_notificacao) ? reg.campos.n_notificacao : (reg.numero_sequencial || '-');
                const historicoAdmin = (reg.campos && reg.campos.motivo) ? reg.campos.motivo : ((reg.campos && reg.campos.descricao) ? reg.campos.descricao : '-');
                const dataRegistrada = reg.created_at ? new Date(reg.created_at).toLocaleDateString('pt-BR') : '-';
                const dataEntrada = (reg.campos && reg.campos.data_entrada) ? reg.campos.data_entrada.split('-').reverse().join('/') : '-';
                const dataVenc = (reg.campos && reg.campos.data_vencimento) ? reg.campos.data_vencimento.split('-').reverse().join('/') : '-';
                const resposta = (reg.campos && reg.campos.resposta_fiscal) ? reg.campos.resposta_fiscal : '-';

                html += `<tr>`;
                html += `<td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${idx + 1}</td>`;
                html += `<td style="border:1px solid #cbd5e1; padding:8px;">${numSeq}</td>`;
                html += `<td style="border:1px solid #cbd5e1; padding:8px;">${nome}</td>`;
                html += `<td style="border:1px solid #cbd5e1; padding:8px;">${fiscal}</td>`;

                if (tipo === 'sem_prosseguimento') {
                    html += `<td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${dataRegistrada}</td>`;
                    html += `<td style="border:1px solid #cbd5e1; padding:8px;">${historicoAdmin}</td>`;
                } else if (tipo === 'com_prosseguimento') {
                    html += `<td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${dataRegistrada}</td>`;
                    html += `<td style="border:1px solid #cbd5e1; padding:8px;">${historicoAdmin}</td>`;
                    html += `<td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${dataEntrada}</td>`;
                    html += `<td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${dataVenc}</td>`;
                } else if (tipo === 'com_resposta') {
                    html += `<td style="border:1px solid #cbd5e1; padding:8px;">${historicoAdmin}</td>`;
                    html += `<td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${dataEntrada}</td>`;
                    html += `<td style="border:1px solid #cbd5e1; padding:8px;">${resposta}</td>`;
                }
                html += `</tr>`;
            });
            return html;
        };

        const htmlTabelaPdf = (titulo, subLista, tipo) => {
            if (subLista.length === 0) return '';
            let theadHtml = `<tr>
                <th style="background: #0f172a; color: white; padding: 7px; text-align: left; border: 1px solid #cbd5e1;">#</th>
                <th style="background: #0f172a; color: white; padding: 7px; text-align: left; border: 1px solid #cbd5e1; min-width: 95px;">N°</th>
                <th style="background: #0f172a; color: white; padding: 7px; text-align: left; border: 1px solid #cbd5e1;">Nome / Identificador</th>
                <th style="background: #0f172a; color: white; padding: 7px; text-align: left; border: 1px solid #cbd5e1;">Fiscal</th>`;

            if (tipo === 'sem_prosseguimento') {
                theadHtml += `<th style="background: #0f172a; color: white; padding: 7px; text-align: left; border: 1px solid #cbd5e1;">Data Registrada</th><th style="background: #0f172a; color: white; padding: 7px; text-align: left; border: 1px solid #cbd5e1;">Histórico (Admin)</th>`;
            } else if (tipo === 'com_prosseguimento') {
                theadHtml += `<th style="background: #0f172a; color: white; padding: 7px; text-align: left; border: 1px solid #cbd5e1;">Data Registrada</th><th style="background: #0f172a; color: white; padding: 7px; text-align: left; border: 1px solid #cbd5e1;">Histórico (Admin)</th><th style="background: #0f172a; color: white; padding: 7px; text-align: left; border: 1px solid #cbd5e1;">Data de receb. (Admin)</th><th style="background: #0f172a; color: white; padding: 7px; text-align: left; border: 1px solid #cbd5e1;">Data Venc.</th>`;
            } else if (tipo === 'com_resposta') {
                theadHtml += `<th style="background: #0f172a; color: white; padding: 7px; text-align: left; border: 1px solid #cbd5e1;">Histórico (Admin)</th><th style="background: #0f172a; color: white; padding: 7px; text-align: left; border: 1px solid #cbd5e1;">Data Receb.</th><th style="background: #0f172a; color: white; padding: 7px; text-align: left; border: 1px solid #cbd5e1;">Resposta</th>`;
            }
            theadHtml += `</tr>`;

            return `
                <h3>${titulo} (${subLista.length})</h3>
                <table>
                    <thead>
                        ${theadHtml}
                    </thead>
                    <tbody>${gerarLinhasPdf(subLista, tipo)}</tbody>
                </table>
            `;
        };

        htmlRelatorio = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <title>${tituloNaoEfetivados}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 30px; color: #1e293b; }
                    h1 { font-size: 18px; margin-bottom: 6px; }
                    h2 { font-size: 14px; color: #64748b; margin-bottom: 20px; font-weight: normal; }
                    h3 { font-size: 15px; color: #334155; margin-top: 25px; margin-bottom: 10px; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px; }
                    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; }
                    th { background: #0f172a; color: white; padding: 7px; text-align: left; border: 1px solid #cbd5e1; }
                    td { border: 1px solid #cbd5e1; padding: 8px; }
                    tr:nth-child(even) { background: #f8fafc; }
                    .footer { margin-top: 20px; font-size: 11px; color: #64748b; text-align: right; }
                    @media print { body { margin: 15px; } }
                </style>
            </head>
            <body>
                <h1>${tituloH1}</h1>
                <h2>Total: ${registrosModalAtual.length} registro(s) &nbsp;|&nbsp; Emitido em ${hoje}</h2>
                
                ${htmlTabelaPdf('🔴 Notificações Devolvidas Ainda Sem Prosseguimento', semProsseguimento, 'sem_prosseguimento')}
                ${htmlTabelaPdf('⏳ Notificação Devolvida Mas Com Prosseguimento', comProsseguimento, 'com_prosseguimento')}
                ${htmlTabelaPdf('✅ Notificações Devolvidas Que Tiveram Prosseguimento E Já Tiveram Resposta Do Fiscal', comResposta, 'com_resposta')}
                
                <div class="footer">SEMAC — Sistema de Gestão da Fiscalização de Posturas</div>
            </body>
            </html>
        `;
    }

    if (tipoDownload === 'relatorio') {
        // Abrir em iframe e imprimir
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;';
        document.body.appendChild(iframe);
        iframe.contentDocument.open();
        iframe.contentDocument.write(htmlRelatorio);
        iframe.contentDocument.close();
        iframe.onload = function () {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            setTimeout(() => { iframe.remove(); }, 1000);
        };
        return;
    }

    if (tipoDownload === 'completo') {
        // ZIP com relatório HTML + anexos
        if (typeof JSZip === 'undefined') {
            Swal.fire('Erro', 'Biblioteca JSZip não carregada. Não é possível gerar o ZIP.', 'error');
            return;
        }

        const zip = new JSZip();
        const pastaAnexos = zip.folder('anexos');
        const nomeArquivoRelatorio = `${tipoModalAtual === 'vencidos' ? 'Vencidos' : 'Atendidos'}_${tipoDoc.replace(/\s+/g, '_')}_${Date.now()}.html`;
        zip.file(nomeArquivoRelatorio, htmlRelatorio);

        Swal.fire({
            title: 'Baixando anexos...',
            text: 'Isso pode levar alguns instantes.',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        let processados = 0;
        let falhas = 0;
        const totalAnexos = registrosModalAtual.reduce((acc, reg) => acc + coletarTodosAnexos(reg).length, 0);

        for (const reg of registrosModalAtual) {
            const anexos = coletarTodosAnexos(reg);
            const numSeq = (((subAbaAtual === '1.1' || subAbaAtual === 'np-af') && reg.campos && (reg.numero_sequencial || reg.campos.n_notificacao))
                ? reg.campos.n_notificacao
                : (reg.numero_sequencial || reg.id)).toString().replace(/[\\\\/:*?"<>|]/g, '-');
            for (let i = 0; i < anexos.length; i++) {
                const url = anexos[i];
                try {
                    const response = await fetch(url);
                    if (!response.ok) throw new Error('Falha no download');
                    const blob = await response.blob();
                    const extensao = url.split('.').pop().split('?')[0] || 'pdf';
                    const nomeArq = `${numSeq}_anexo${i + 1}.${extensao}`;
                    pastaAnexos.file(nomeArq, blob);
                    processados++;
                } catch (err) {
                    console.error(`Erro ao baixar anexo ${url}:`, err);
                    falhas++;
                }
            }
        }

        Swal.close();

        const blobZip = await zip.generateAsync({ type: 'blob' });
        const urlZip = URL.createObjectURL(blobZip);
        const a = document.createElement('a');
        a.href = urlZip;
        a.download = `${tipoModalAtual === 'vencidos' ? 'Vencidos' : 'Atendidos'}_${tipoDoc.replace(/\s+/g, '_')}_${Date.now()}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(urlZip);

        if (falhas > 0) {
            Swal.fire('Aviso', `ZIP gerado, mas ${falhas} de ${totalAnexos} anexos falharam.`, 'warning');
        }
    }
}

// --- LÓGICA DA BUSCA PROFUNDA EM PDFs ---
async function abrirBuscaProfunda() {
    Swal.fire({
        title: 'Busca Profunda em Documentos',
        html: `
            <div style="text-align:left; font-size:14px; margin-bottom:15px; color:#64748b;">
                Selecione as categorias que deseja buscar (a busca vai verificar informações no banco e varrer PDFs).
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 15px; font-size:13px; text-align:left;">
                <label><input type="checkbox" id="chk-cat-todas" checked onchange="document.querySelectorAll('.chk-cat').forEach(c => c.disabled = this.checked)"> <b>Todas as Categorias</b></label>
                <label><input type="checkbox" class="chk-cat" value="1.1" disabled> Notificação Preliminar (1.1)</label>
                <label><input type="checkbox" class="chk-cat" value="1.9" disabled> Auto de Fiscalização (1.9)</label>
                <label><input type="checkbox" class="chk-cat" value="1.2" disabled> Auto Infração - Posturas (1.2)</label>
                <label><input type="checkbox" class="chk-cat" value="1.2.MA" disabled> Auto Infração - Ambiental (1.2.MA)</label>
                <label><input type="checkbox" class="chk-cat" value="1.5" disabled> Relatório Vistoria (1.5)</label>
                <label><input type="checkbox" class="chk-cat" value="1.5.MA" disabled> Relatório Vistoria Ambiental (1.5.MA)</label>
                <label><input type="checkbox" class="chk-cat" value="1.7" disabled> Certidão (1.7)</label>
            </div>
            <input type="text" id="input-busca-profunda" class="swal2-input" placeholder="Palavras-chave (separe por vírgula p/ buscar várias)">
        `,
        showCancelButton: true,
        confirmButtonText: 'Iniciar Busca',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#4f46e5',
        preConfirm: () => {
            const termo = document.getElementById('input-busca-profunda').value.trim();
            const chkTodas = document.getElementById('chk-cat-todas').checked;
            let categorias = [];
            if (!chkTodas) {
                document.querySelectorAll('.chk-cat:checked').forEach(chk => categorias.push(chk.value));
            }
            if (!termo) {
                Swal.showValidationMessage('Digite um termo para buscar');
                return false;
            }
            if (!chkTodas && categorias.length === 0) {
                Swal.showValidationMessage('Selecione pelo menos uma categoria ou marque "Todas"');
                return false;
            }
            return { termo, categorias };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            executarBuscaProfunda(result.value);
        }
    });
}
window.abrirBuscaProfunda = abrirBuscaProfunda;

async function executarBuscaProfunda(config) {
    const termoBusca = config.termo;
    const categoriasSelecionadas = config.categorias;
    let aba = typeof subAbaAtual !== 'undefined' ? subAbaAtual : '1.1';

    Swal.fire({
        title: 'Preparando Busca...',
        html: '<b>Buscando registros no banco de dados...</b><br><small>Buscando todos os registros sem limite.</small>',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        let query = supabaseClient.from('controle_processual').select('*');
        if (categoriasSelecionadas && categoriasSelecionadas.length > 0) {
            query = query.in('categoria_id', categoriasSelecionadas);
        } else if (aba !== 'todos') {
            // Fallback para aba atual se quiser (mas "Todas" foi marcado)
            // Como "Todas as Categorias" ignora a aba visual atual, não precisamos filtrar.
        }
        // Buscando todos os registros através de blocos (paginação)
        let todosOsRegistros = [];
        let offset = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
            Swal.update({ html: `<b>Buscando registros no banco de dados...</b><br><small>Carregados: ${todosOsRegistros.length}</small>` });
            const { data, error } = await query.order('created_at', { ascending: false }).range(offset, offset + pageSize - 1);
            if (error) throw error;

            if (data && data.length > 0) {
                todosOsRegistros = todosOsRegistros.concat(data);
                offset += pageSize;
                if (data.length < pageSize) {
                    hasMore = false;
                }
            } else {
                hasMore = false;
            }
        }

        if (todosOsRegistros.length === 0) {
            Swal.fire('Nenhum Registro', 'Não há registros nesta aba para pesquisar.', 'info');
            return;
        }

        const termosOriginais = termoBusca.split(',').map(t => t.trim()).filter(Boolean);
        const termosNormalizados = termosOriginais.map(t => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
        const registrosEncontrados = [];

        let i = 0;
        const total = todosOsRegistros.length;

        for (const reg of todosOsRegistros) {
            i++;
            if (i % 5 === 0) {
                Swal.update({ html: `<b>Analisando registro ${i} de ${total}...</b><br><small>Verificando PDF/DB</small>` });
            }

            let countJSON = 0;
            let countPDF = 0;

            // 1. Verifica e conta no JSON do banco
            if (reg.campos) {
                const strJSON = JSON.stringify(reg.campos).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                termosNormalizados.forEach(t => {
                    countJSON += (strJSON.split(t).length - 1);
                });
            }

            // 2. Verifica e conta dentro do PDF anexo
            if (reg.campos && reg.campos.anexo_pdf) {
                const pdfUrl = reg.campos.anexo_pdf;
                if (pdfUrl.includes('.pdf') || pdfUrl.includes('res.cloudinary.com')) {
                    try {
                        const pdfResult = await lerTextoDoPdfUrl(pdfUrl);
                        reg.texto_pdf_extraido = pdfResult;
                        const strPDF = pdfResult.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                        termosNormalizados.forEach(t => {
                            countPDF += (strPDF.split(t).length - 1);
                        });
                        // Dá uma pausa para o navegador limpar a memória (Garbage Collection)
                        await new Promise(resolve => setTimeout(resolve, 50));
                    } catch (e) {
                        // Silenciar erro de leitura (link quebrado, etc)
                    }
                }
            }

            // Considera a maior contagem (evita duplicar contagem se o PDF for igual ao JSON)
            const maxOcorrencias = Math.max(countJSON, countPDF);

            if (maxOcorrencias > 0) {
                reg.ocorrencias_busca = maxOcorrencias;
                reg.termos_originais_busca = termosOriginais;
                registrosEncontrados.push(reg);
            }
        }

        Swal.close();

        window.termoBuscaProfundaAtual = termoBusca;
        window.termosBuscaProfundaOriginais = termosOriginais;

        if (registrosEncontrados.length === 0) {
            Swal.fire('Nenhum resultado', `A palavra "${termoBusca}" não foi encontrada nos documentos verificados.`, 'info');
        } else {
            let listaHTML = '<ul style="text-align:left; max-height:250px; overflow-y:auto; margin-top:15px; padding:10px; background:#f8fafc; border-radius:6px; border:1px solid #e2e8f0; list-style-type:none;">';
            registrosEncontrados.forEach((r, idx) => {
                let docNum = r.numero_sequencial || (r.campos && (r.campos.n_notificacao || r.campos.n_auto || r.campos.n_ar || r.campos.n_oficio)) || 'Sem Número';
                listaHTML += `<li style="margin-bottom:8px; font-size:14px; border-bottom:1px solid #e2e8f0; padding-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
                                <div>
                                    <strong style="color:#0f172a;">${docNum}</strong> (Cat: ${r.categoria_id}) 
                                    <span style="background:#e0e7ff; color:#4338ca; padding:2px 6px; border-radius:12px; font-size:11px; margin-left:6px; font-weight:600;">${r.ocorrencias_busca} ocorrências</span><br>
                                    <span style="font-size:12px; color:#64748b;">Fiscal: ${r.fiscal_nome || 'N/A'}</span>
                                </div>
                                <button onclick="abrirVisualizadorBuscaProfunda(${idx})" style="padding:4px 10px; background:#4f46e5; color:white; border:none; border-radius:4px; font-size:12px; cursor:pointer; min-width:100px; text-align:center;">🔍 Grifar & Ver</button>
                              </li>`;
            });
            listaHTML += '</ul>';

            window.resultadosBuscaProfundaTemp = registrosEncontrados;

            Swal.fire({
                title: 'Busca Concluída',
                html: `Foram encontrados <b>${registrosEncontrados.length}</b> documentos com a palavra "${termoBusca}".<br>${listaHTML}`,
                icon: 'success',
                width: '650px',
                showDenyButton: true,
                showCancelButton: true,
                confirmButtonText: '🔍 Navegar & Grifar (Setinhas)',
                denyButtonText: '📊 Baixar Planilha (Excel)',
                cancelButtonText: 'Fechar',
                confirmButtonColor: '#4f46e5',
                denyButtonColor: '#10b981'
            }).then((res) => {
                if (res.isConfirmed) {
                    abrirVisualizadorBuscaProfunda(0);
                } else if (res.isDenied) {
                    exportarResultadosBuscaProfunda(termoBusca, window.resultadosBuscaProfundaTemp);
                }
            });

            // Garantir que a tabela e os registros atuais sejam renderizados
            registrosGeralAtual = registrosEncontrados; // para que o visualizar funcione
            renderizarTabelaGeral(registrosEncontrados, 'todos', `Resultado da Busca Profunda: "${termoBusca}"`);
        }
    } catch (err) {
        console.error('Erro na Busca Profunda:', err);
        Swal.fire('Erro', 'Ocorreu um erro ao realizar a busca profunda.', 'error');
    }
}

function exportarResultadosBuscaProfunda(termo, registros) {
    if (!registros || registros.length === 0) return;
    try {
        const dados = registros.map(r => ({
            "Ocorrências": r.ocorrencias_busca || 0,
            "ID Registro": r.id,
            "Nº Sequencial (Banco)": r.numero_sequencial || '',
            "Categoria ID": r.categoria_id,
            "Nº Documento": (r.campos && (r.campos.n_notificacao || r.campos.n_auto || r.campos.n_ar || r.campos.n_oficio)) || '',
            "Bairro": r.campos?.bairro || '',
            "Nome Envolvido": r.campos?.nome || '',
            "Fiscal": r.fiscal_nome || '',
            "Data Criação": r.created_at ? new Date(r.created_at).toLocaleString('pt-BR') : ''
        }));

        const ws = XLSX.utils.json_to_sheet(dados);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Resultados");
        XLSX.writeFile(wb, `BuscaProfunda_${termo.replace(/[^a-z0-9]/gi, '_')}.xlsx`);
    } catch (e) {
        console.error(e);
        Swal.fire('Erro', 'Falha ao gerar a planilha Excel', 'error');
    }
}

// --- VISUALIZADOR INTERATIVO DA BUSCA PROFUNDA (GRIFO, NAVEGAÇÃO E DESCARTE) ---
let indiceVisualizadorBuscaProfunda = 0;

function grifarTexto(texto, termos) {
    if (!texto || !termos || termos.length === 0) return texto || '';

    let regexPattern = termos.map(t => {
        let escaped = String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        escaped = escaped
            .replace(/a/gi, '[aáàãâäAÁÀÃÂÄ]')
            .replace(/e/gi, '[eéèêëEÉÈÊË]')
            .replace(/i/gi, '[iíìîïIÍÌÎÏ]')
            .replace(/o/gi, '[oóòõôöOÓÒÕÔÖ]')
            .replace(/u/gi, '[uúùûüUÚÙÛÜ]')
            .replace(/c/gi, '[cCçÇ]');
        return escaped;
    }).join('|');

    try {
        const re = new RegExp(`(${regexPattern})`, 'gi');
        return String(texto).replace(re, '<mark style="background:#fef08a; color:#854d0e; font-weight:bold; padding:1px 5px; border-radius:4px; box-shadow:0 0 0 1px #facc15;">$1</mark>');
    } catch (e) {
        return texto;
    }
}

function extrairTrechosGrifados(texto, termos) {
    if (!texto || !termos || termos.length === 0) return [];

    const partes = texto.split(/(?<=[.!?\n])\s+/);
    const trechos = [];
    const termosNorm = termos.map(t => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));

    for (const parte of partes) {
        const parteNorm = parte.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (termosNorm.some(t => parteNorm.includes(t))) {
            if (parte.trim().length > 3) {
                trechos.push(parte.trim());
            }
        }
    }
    return trechos;
}

function formatarCamposGrifados(campos, termosOriginais) {
    if (!campos || typeof campos !== 'object') return '<div style="color:#94a3b8;">Nenhum campo disponível.</div>';

    let html = '<ul style="margin:0; padding-left:16px; list-style-type:disc;">';
    let temCampo = false;

    for (const [chave, valor] of Object.entries(campos)) {
        if (!valor || typeof valor === 'object' || chave === 'anexo_pdf' || chave.startsWith('imagem')) continue;

        temCampo = true;
        const valorStr = String(valor);
        const valorGrifado = grifarTexto(valorStr, termosOriginais);
        const chaveFormatada = chave.replace(/_/g, ' ').toUpperCase();

        const contemTermo = termosOriginais.some(t => {
            const tNorm = String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const vNorm = valorStr.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            return vNorm.includes(tNorm);
        });

        if (contemTermo) {
            html += `<li style="margin-bottom:6px; background:#fef9c3; padding:6px 10px; border-radius:6px; border-left:4px solid #eab308; list-style:none; font-size:13px;">
                        <strong style="color:#854d0e;">${chaveFormatada}:</strong> <span style="color:#1e293b;">${valorGrifado}</span>
                     </li>`;
        } else {
            html += `<li style="margin-bottom:4px; color:#475569; font-size:13px;">
                        <strong>${chaveFormatada}:</strong> <span>${valorGrifado}</span>
                     </li>`;
        }
    }

    html += '</ul>';
    return temCampo ? html : '<div style="color:#94a3b8;">Sem campos de texto.</div>';
}

function formatarTrechosPdfGrifados(textoPdf, termosOriginais) {
    if (!textoPdf) {
        return `
            <div style="margin-top:16px;">
                <h5 style="margin:0 0 8px 0; font-size:11px; text-transform:uppercase; color:#64748b; letter-spacing:0.5px;">Texto do PDF:</h5>
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px; font-size:13px; color:#94a3b8; text-align:center;">
                    Nenhum texto extraído do PDF (ou registro sem PDF).
                </div>
            </div>
        `;
    }

    const trechos = extrairTrechosGrifados(textoPdf, termosOriginais);

    let html = `
        <div style="margin-top:16px;">
            <h5 style="margin:0 0 8px 0; font-size:11px; text-transform:uppercase; color:#64748b; letter-spacing:0.5px;">
                Ocorrências Encontradas no Corpo do PDF (${trechos.length} trecho(s)):
            </h5>
    `;

    if (trechos.length === 0) {
        html += `
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px; font-size:13px; color:#64748b;">
                A palavra-chave não foi identificada no corpo textual do PDF (pode estar apenas nos campos).
            </div>
        `;
    } else {
        const maxTrechos = trechos.slice(0, 30);
        maxTrechos.forEach(t => {
            const trechoGrifado = grifarTexto(t, termosOriginais);
            html += `
                <div style="margin-bottom:8px; background:#fefce8; border-left:4px solid #eab308; padding:10px; border-radius:0 8px 8px 0; font-size:13px; line-height:1.6; color:#1e293b; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
                    "${trechoGrifado}"
                </div>
            `;
        });
        if (trechos.length > 30) {
            html += `<div style="font-size:12px; color:#64748b; text-align:center; margin-top:6px;">... e mais ${trechos.length - 30} trecho(s).</div>`;
        }
    }

    html += `</div>`;
    return html;
}

function abrirVisualizadorBuscaProfunda(index) {
    const registros = window.resultadosBuscaProfundaTemp;
    if (!registros || registros.length === 0) {
        Swal.fire('Aviso', 'Nenhum resultado de busca disponível.', 'info');
        return;
    }

    if (index < 0) index = 0;
    if (index >= registros.length) index = registros.length - 1;
    indiceVisualizadorBuscaProfunda = index;

    const reg = registros[index];
    const total = registros.length;
    const termosOriginais = reg.termos_originais_busca || window.termosBuscaProfundaOriginais || [window.termoBuscaProfundaAtual];
    const termoBusca = window.termoBuscaProfundaAtual || termosOriginais.join(', ');

    let docNum = reg.numero_sequencial || (reg.campos && (reg.campos.n_notificacao || reg.campos.n_auto || reg.campos.n_ar || reg.campos.n_oficio)) || 'Sem Número';
    let pdfUrl = reg.campos && reg.campos.anexo_pdf ? reg.campos.anexo_pdf : null;

    const modalAntigo = document.getElementById('modal-visualizador-busca-profunda');
    if (modalAntigo) modalAntigo.remove();

    const camposHTML = formatarCamposGrifados(reg.campos, termosOriginais);
    const trechosPdfHTML = formatarTrechosPdfGrifados(reg.texto_pdf_extraido, termosOriginais);

    let pdfIframeHTML = '';
    if (pdfUrl) {
        const pdfViewerUrl = `${pdfUrl}#search=${encodeURIComponent(termoBusca)}`;
        pdfIframeHTML = `
            <iframe src="${pdfViewerUrl}" style="width:100%; height:100%; border:none; background:#525659;" title="Documento PDF"></iframe>
        `;
    } else {
        pdfIframeHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#94a3b8; padding:30px; text-align:center;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                <p style="margin-top:12px; font-size:15px;">Nenhum anexo PDF associado a este registro.</p>
            </div>
        `;
    }

    const modal = document.createElement('div');
    modal.id = 'modal-visualizador-busca-profunda';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.85); backdrop-filter:blur(4px); z-index:99999; display:flex; align-items:center; justify-content:center; padding:15px; box-sizing:border-box;';

    modal.innerHTML = `
        <div style="background:#ffffff; border-radius:16px; width:100%; max-width:1250px; height:92vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 25px 50px -12px rgba(0,0,0,0.37);">
            
            <!-- BARRA SUPERIOR DE NAVEGAÇÃO E CONTROLE -->
            <div style="background:#0f172a; color:#f8fafc; padding:12px 20px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #1e293b; flex-wrap:wrap; gap:10px;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <span style="font-size:20px;">🔍</span>
                    <div>
                        <h3 style="margin:0; font-size:15px; font-weight:600; color:#f8fafc;">Busca Profunda: "${termoBusca}"</h3>
                        <span style="font-size:12px; color:#94a3b8;">Documento ${index + 1} de ${total} (Use as setinhas ⬅️ ➡️ do teclado)</span>
                    </div>
                </div>

                <!-- CONTROLES NAVEGAÇÃO / DESCARTAR / FECHAR -->
                <div style="display:flex; align-items:center; gap:8px;">
                    <button onclick="navegarVisualizadorBuscaProfunda(-1)" ${index === 0 ? 'disabled' : ''} style="padding:7px 13px; background:#334155; color:white; border:none; border-radius:8px; font-size:12px; font-weight:600; cursor:${index === 0 ? 'not-allowed' : 'pointer'}; opacity:${index === 0 ? '0.4' : '1'}; display:flex; align-items:center; gap:4px;" title="Documento Anterior (Seta Esquerda)">
                        ⬅️ Anterior
                    </button>

                    <button onclick="navegarVisualizadorBuscaProfunda(1)" ${index === total - 1 ? 'disabled' : ''} style="padding:7px 13px; background:#334155; color:white; border:none; border-radius:8px; font-size:12px; font-weight:600; cursor:${index === total - 1 ? 'not-allowed' : 'pointer'}; opacity:${index === total - 1 ? '0.4' : '1'}; display:flex; align-items:center; gap:4px;" title="Próximo Documento (Seta Direita)">
                        Próximo ➡️
                    </button>

                    <button onclick="descartarRegistroBuscaProfunda(${index})" style="padding:7px 13px; background:#ef4444; color:white; border:none; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:4px; margin-left:6px;" title="Descartar este anexo da contagem da busca e da planilha Excel">
                        🗑️ Descartar da Busca
                    </button>

                    <button onclick="exportarResultadosBuscaProfunda(window.termoBuscaProfundaAtual, window.resultadosBuscaProfundaTemp)" style="padding:7px 13px; background:#10b981; color:white; border:none; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:4px;" title="Baixar planilha Excel atualizada sem os descartados">
                        📊 Excel
                    </button>

                    <button onclick="fecharVisualizadorBuscaProfunda()" style="padding:6px 10px; background:transparent; color:#94a3b8; border:none; font-size:20px; cursor:pointer; border-radius:8px; margin-left:4px;" title="Fechar">
                        ✕
                    </button>
                </div>
            </div>

            <!-- CABEÇALHO DETALHES DO DOCUMENTO -->
            <div style="background:#f8fafc; padding:10px 20px; border-bottom:1px solid #e2e8f0; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
                <div>
                    <strong style="font-size:15px; color:#0f172a;">${docNum}</strong>
                    <span style="font-size:13px; color:#475569; margin-left:8px;">| Cat: ${reg.categoria_id} | Fiscal: ${reg.fiscal_nome || 'N/A'}</span>
                </div>
                <div style="display:flex; align-items:center; gap:12px;">
                    <span style="background:#e0e7ff; color:#4338ca; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:700;">
                        ${reg.ocorrencias_busca} ocorrência(s) encontrada(s)
                    </span>
                    ${pdfUrl ? `<a href="${pdfUrl}" target="_blank" style="font-size:12px; color:#2563eb; text-decoration:none; font-weight:600; display:flex; align-items:center; gap:4px;">Abrir PDF em nova aba ↗</a>` : ''}
                </div>
            </div>

            <!-- CONTEÚDO PRINCIPAL (DIVIDIDO EM DUAS COLUNAS) -->
            <div style="display:flex; flex:1; overflow:hidden; background:#f1f5f9;">
                
                <!-- COLUNA DA ESQUERDA: CAMPOS E TRECHOS GRIFADOS -->
                <div style="width:45%; min-width:340px; background:#ffffff; border-right:1px solid #e2e8f0; padding:16px; overflow-y:auto; box-sizing:border-box;">
                    <h4 style="margin:0 0 12px 0; font-size:14px; color:#0f172a; display:flex; align-items:center; gap:6px;">
                        <span>📝</span> Palavras-Chave Grifadas no Documento
                    </h4>

                    <!-- CAMPOS DO FORMULÁRIO -->
                    <div style="margin-bottom:16px;">
                        <h5 style="margin:0 0 8px 0; font-size:11px; text-transform:uppercase; color:#64748b; letter-spacing:0.5px;">Dados do Banco (Campos do Formulário):</h5>
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px; font-size:13px; line-height:1.5;">
                            ${camposHTML}
                        </div>
                    </div>

                    <!-- TRECHOS DO PDF -->
                    ${trechosPdfHTML}
                </div>

                <!-- COLUNA DA DIREITA: VISUALIZADOR DE PDF -->
                <div style="flex:1; background:#334155; display:flex; flex-direction:column; position:relative;">
                    ${pdfIframeHTML}
                </div>

            </div>

        </div>
    `;

    document.body.appendChild(modal);

    document.removeEventListener('keydown', tratarTecladoBuscaProfunda);
    document.addEventListener('keydown', tratarTecladoBuscaProfunda);
}

function fecharVisualizadorBuscaProfunda() {
    const modal = document.getElementById('modal-visualizador-busca-profunda');
    if (modal) modal.remove();
    document.removeEventListener('keydown', tratarTecladoBuscaProfunda);
}

function navegarVisualizadorBuscaProfunda(delta) {
    const novoIndex = indiceVisualizadorBuscaProfunda + delta;
    if (window.resultadosBuscaProfundaTemp && novoIndex >= 0 && novoIndex < window.resultadosBuscaProfundaTemp.length) {
        abrirVisualizadorBuscaProfunda(novoIndex);
    }
}

function descartarRegistroBuscaProfunda(index) {
    if (!window.resultadosBuscaProfundaTemp || window.resultadosBuscaProfundaTemp.length === 0) return;

    window.resultadosBuscaProfundaTemp.splice(index, 1);

    registrosGeralAtual = window.resultadosBuscaProfundaTemp;
    renderizarTabelaGeral(window.resultadosBuscaProfundaTemp, 'todos', `Resultado da Busca Profunda: "${window.termoBuscaProfundaAtual}"`);

    const restante = window.resultadosBuscaProfundaTemp.length;

    if (restante === 0) {
        fecharVisualizadorBuscaProfunda();
        Swal.fire('Busca Limpa', 'Todos os documentos da busca foram descartados.', 'info');
        return;
    }

    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: true
    });
    Toast.fire({
        icon: 'success',
        title: 'Anexo descartado da contagem!'
    });

    let novoIndex = index;
    if (novoIndex >= restante) {
        novoIndex = restante - 1;
    }
    abrirVisualizadorBuscaProfunda(novoIndex);
}

function tratarTecladoBuscaProfunda(e) {
    const modal = document.getElementById('modal-visualizador-busca-profunda');
    if (!modal) return;

    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;

    if (e.key === 'ArrowLeft') {
        navegarVisualizadorBuscaProfunda(-1);
    } else if (e.key === 'ArrowRight') {
        navegarVisualizadorBuscaProfunda(1);
    } else if (e.key === 'Escape') {
        fecharVisualizadorBuscaProfunda();
    }
}

window.abrirVisualizadorBuscaProfunda = abrirVisualizadorBuscaProfunda;
window.fecharVisualizadorBuscaProfunda = fecharVisualizadorBuscaProfunda;
window.navegarVisualizadorBuscaProfunda = navegarVisualizadorBuscaProfunda;
window.descartarRegistroBuscaProfunda = descartarRegistroBuscaProfunda;

async function lerTextoDoPdfUrl(url) {
    let loadingTask = null;
    let pdf = null;
    try {
        if (typeof pdfjsLib === 'undefined') {
            throw new Error('Biblioteca PDF.js não carregada na página.');
        }

        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        loadingTask = pdfjsLib.getDocument(url);
        pdf = await loadingTask.promise;
        let numPages = pdf.numPages;
        let textoCompleto = '';

        const maxPages = numPages > 30 ? 30 : numPages;
        for (let i = 1; i <= maxPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            textoCompleto += pageText + ' ';
            page.cleanup();
        }

        return textoCompleto;
    } catch (e) {
        // Ignoramos silenciosamente erros de rede ou PDFs corrompidos 
        // para não poluir o console do navegador
        return '';
    } finally {
        // CRÍTICO: Garantir que a memória seja liberada MESMO se o PDF estiver corrompido
        if (pdf) {
            try { await pdf.destroy(); } catch (err) { }
        }
        if (loadingTask) {
            try { loadingTask.destroy(); } catch (err) { }
        }
    }
}

// Executa quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    carregarBairrosSistema();
    inicializarProdutividade();
});
