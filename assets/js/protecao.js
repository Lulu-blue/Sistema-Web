// =============================================
// PROTEÇÃO DE ROTA + CONEXÃO SUPABASE CENTRAL
// =============================================
// Este arquivo é carregado PRIMEIRO no painel.
// Cria a conexão e verifica se o usuário está logado.

const supabaseUrl = 'https://marmpnusgmbjphffaynr.supabase.co';
const supabaseKey = 'sb_publishable_ZVtndwPOvY2dA4Qzlwkl2A_H0-TeUgu';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

window.supabaseUrl = supabaseUrl;
window.supabaseKey = supabaseKey;
window.supabaseClient = supabaseClient;

// =============================================
// CONEXÃO SUPABASE MASTER (FLUXOGRAMA) - CENTRAL DE NUMERAÇÃO
// =============================================
const MASTER_FLUXOGRAMA_URL = 'https://mqjlbgbbvesyagwxqgox.supabase.co';
const MASTER_FLUXOGRAMA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xamxiZ2JidmVzeWFnd3hxZ294Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMTE5MDUsImV4cCI6MjA5ODg4NzkwNX0.V9Loy1ZarXn7wB00QYfuKhVgVK2chKg3-X8XHdvAgvU';
const supabaseMaster = supabase.createClient(MASTER_FLUXOGRAMA_URL, MASTER_FLUXOGRAMA_KEY);

window.MASTER_FLUXOGRAMA_URL = MASTER_FLUXOGRAMA_URL;
window.MASTER_FLUXOGRAMA_KEY = MASTER_FLUXOGRAMA_KEY;
window.supabaseMaster = supabaseMaster;

// Mapeamento central de categorias SEMAC -> Categoria Mestre Fluxograma
const MAPA_CATEGORIAS_MESTRE = {
    // Processo / Dívida Ativa -> "Processo"
    '1.0': 'Processo',
    'processo': 'Processo',
    'Processo': 'Processo',
    '11': 'Processo',
    'divida': 'Processo',
    'divida_ativa': 'Processo',
    'Dívida Ativa': 'Processo',
    'Montagem de processo para encaminhamento, exclusivamente para inscrição em dívida ativa': 'Processo',

    // Auto de Infração -> "Auto de Infração"
    '1.2': 'Auto de Infração',
    '1.2.MA': 'Auto de Infração',
    '1.9': 'Auto de Infração',
    'ai': 'Auto de Infração',
    'ai-ma': 'Auto de Infração',
    'Auto de Infração': 'Auto de Infração',
    'Controle Processual: Auto de Infração': 'Auto de Infração',

    // Certidão -> "Certidão Sem Defesa"
    '1.8': 'Certidão Sem Defesa',
    'certidao': 'Certidão Sem Defesa',
    'Certidão': 'Certidão Sem Defesa',
    'Certidão Sem Defesa': 'Certidão Sem Defesa',

    // Relatório Fiscal -> "Relatório Fiscal"
    '1.5': 'Relatório Fiscal',
    '1.5.MA': 'Relatório Fiscal',
    'rf': 'Relatório Fiscal',
    'relatorio': 'Relatório Fiscal',
    'relatorio-ma': 'Relatório Fiscal',
    'Relatório Fiscal': 'Relatório Fiscal',
    'Controle Processual: Relatório': 'Relatório Fiscal',

    // Réplica -> "Réplica"
    '1.7': 'Réplica',
    'replica': 'Réplica',
    'Réplica': 'Réplica',

    // Ofício -> "Ofício"
    '1.4': 'Ofício',
    'oficio': 'Ofício',
    'Ofício': 'Ofício',

    // Notificação Preliminar -> "Notificação Preliminar"
    '1.1': 'Notificação Preliminar',
    'np': 'Notificação Preliminar',
    'Notificação Preliminar': 'Notificação Preliminar',

    // Aviso de Recebimento -> "Aviso de Recebimento"
    '1.3': 'Aviso de Recebimento',
    'ar': 'Aviso de Recebimento',
    'Aviso de Recebimento': 'Aviso de Recebimento',

    // Protocolo -> "Protocolo"
    '1.6': 'Protocolo',
    'protocolo': 'Protocolo',
    'Protocolo': 'Protocolo'
};

/**
 * Normaliza o formato de numeração mestre para o padrão SEMAC (ex: 001/2026)
 */
/**
 * Normaliza o formato de numeração mestre para o padrão SEMAC (ex: 001/2026)
 */
function normalizarFormatoNumeroMestre(numeroMestre, ano = new Date().getFullYear()) {
    if (!numeroMestre) return null;
    const str = numeroMestre.toString().trim();
    if (str.includes('/')) {
        const partes = str.split('/');
        // Se estiver no formato ANO/NUMERO (ex: 2026/001 -> 001/2026)
        if (partes[0].length === 4 && (partes[0].startsWith('20') || partes[0].startsWith('19'))) {
            return `${partes[1]}/${partes[0]}`;
        }
    }
    return str.includes('/') ? str : `${str}/${ano}`;
}
window.normalizarFormatoNumeroMestre = normalizarFormatoNumeroMestre;

/**
 * Função mestre para geração/reserva atômica de números unificados (SEMAC + Fluxograma)
 */
async function gerarNumeroMestre(categoria, ano = new Date().getFullYear()) {
    const categoriaNome = MAPA_CATEGORIAS_MESTRE[categoria] || categoria;

    // 1. PRIMEIRA CONSULTA: Verificar se existe algum número descartado na tabela local numeros_disponiveis
    try {
        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            const { data: disponivel, error: errDisp } = await supabaseClient
                .from('numeros_disponiveis')
                .select('id, numero_sequencial')
                .or(`categoria_id.eq.${categoria},categoria_id.eq.${categoriaNome}`)
                .eq('ano', ano)
                .order('created_at', { ascending: true })
                .limit(1)
                .maybeSingle();

            if (!errDisp && disponivel && disponivel.numero_sequencial) {
                // Remover da fila de descartados/disponíveis para utilizar este número
                await supabaseClient
                    .from('numeros_disponiveis')
                    .delete()
                    .eq('id', disponivel.id);

                console.log(`[Numeração SEMAC] Número reutilizado da fila de descartados (numeros_disponiveis): ${disponivel.numero_sequencial}`);
                return normalizarFormatoNumeroMestre(disponivel.numero_sequencial, ano);
            }
        }
    } catch (e) {
        console.warn('[Numeração SEMAC] Erro/aviso ao consultar numeros_disponiveis local:', e);
    }

    // 2. FILA DE DISPONÍVEIS VAZIA: Consultar a API do Banco Mestre (Fluxograma)
    // No Fluxograma, a procedure 'reservar_numero' lê a tabela 'sequenciais_contadores', incrementa +1 e atualiza o ultimo_numero.
    const { data, error } = await supabaseMaster.rpc('reservar_numero', { p_ano: ano, p_categoria: categoriaNome });
    if (error) {
        console.error('Erro ao buscar número mestre no Fluxograma:', error);
        throw error;
    }
    return normalizarFormatoNumeroMestre(data, ano);
}
window.gerarNumeroMestre = gerarNumeroMestre;

/**
 * Guarda um número cancelado/descartado na tabela numeros_disponiveis para ser reutilizado na próxima reserva
 */
async function devolverNumeroMestre(categoria, numero, ano = new Date().getFullYear()) {
    if (!numero) return;
    const categoriaNome = MAPA_CATEGORIAS_MESTRE[categoria] || categoria;
    try {
        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            const { error } = await supabaseClient
                .from('numeros_disponiveis')
                .insert([{
                    categoria_id: categoria,
                    numero_sequencial: numero.toString(),
                    ano: ano
                }]);

            if (error) {
                console.warn('Falha ao inserir número em numeros_disponiveis:', error);
            } else {
                console.log(`[Numeração SEMAC] Número ${numero} (${categoriaNome}) salvo na fila numeros_disponiveis.`);
            }
        }
    } catch (err) {
        console.warn('Aviso ao devolver número mestre:', err);
    }
}
window.devolverNumeroMestre = devolverNumeroMestre;

async function verificarAcesso() {
    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        
        if (error || !session) {
            console.warn("Sessão inválida ou expirada:", error);
            const msg = error ? "Sessão expirada. Por favor, logue novamente." : "Acesso restrito! Identifique-se primeiro.";
            alert(msg);
            window.location.href = "index.html";
            return null;
        }

        // ⏱️ Verificar limite máximo de 12 horas de sessão
        const HORAS_LIMITE = 12;
        const MS_LIMITE = HORAS_LIMITE * 60 * 60 * 1000;
        const sessionStart = parseInt(localStorage.getItem('semac_session_start') || '0');

        if (!sessionStart || (Date.now() - sessionStart > MS_LIMITE)) {
            await supabaseClient.auth.signOut();
            localStorage.removeItem('semac_session_start');
            alert(`Sua sessão expirou após ${HORAS_LIMITE} horas por segurança. Por favor, faça login novamente.`);
            window.location.href = "index.html";
            return null;
        }

        return session;
    } catch (err) {
        console.error("Erro crítico na verificação de acesso:", err);
        return null;
    }
}

// 1. Verificação inicial imediata
verificarAcesso();

// 2. Monitoramento reativo em tempo real
// Se o token expirar ou o usuário for deslogado em outra aba, redireciona aqui também.
supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log(`[Auth Event] ${event}`);
    if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session)) {
        console.warn("Sessão encerrada pelo sistema. Redirecionando...");
        localStorage.removeItem('semac_session_start');
        window.location.href = "index.html";
    }
});

/**
 * Função global para ser chamada antes de operações críticas (como salvar).
 * Tenta garantir que o Supabase está com a sessão reconhecida.
 */
async function garantirSessaoAtiva() {
    const { data: { user }, error } = await supabaseClient.auth.getUser();
    if (error || !user) {
        const sessionCheck = await verificarAcesso();
        return !!sessionCheck;
    }

    // ⏱️ Também validar limite de 12h antes de operações críticas
    const HORAS_LIMITE = 12;
    const MS_LIMITE = HORAS_LIMITE * 60 * 60 * 1000;
    const sessionStart = parseInt(localStorage.getItem('semac_session_start') || '0');
    if (!sessionStart || (Date.now() - sessionStart > MS_LIMITE)) {
        await supabaseClient.auth.signOut();
        localStorage.removeItem('semac_session_start');
        alert(`Sua sessão expirou após ${HORAS_LIMITE} horas por segurança. Por favor, faça login novamente.`);
        window.location.href = "index.html";
        return false;
    }

    return true;
}
window.garantirSessaoAtiva = garantirSessaoAtiva;

// =============================================
// MONITORAMENTO DE CONEXÃO COM A INTERNET
// =============================================

(function () {
    // Criar o elemento de aviso
    const banner = document.createElement('div');
    banner.id = 'offline-banner';
    banner.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        background: #ef4444;
        color: white;
        text-align: center;
        padding: 12px;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        font-size: 14px;
        font-weight: 600;
        z-index: 99999;
        display: none;
        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
        transition: transform 0.3s ease;
    `;
    banner.innerHTML = `
        <span id="offline-icon">📡</span>
        <span id="offline-text">Você está offline. Verifique sua conexão com a internet.</span>
    `;
    document.body.appendChild(banner);

    let isOffline = false;
    let checkInterval = null;

    // Função para mostrar o banner
    function showBanner(message, isError = true) {
        const textEl = document.getElementById('offline-text');
        const iconEl = document.getElementById('offline-icon');

        if (textEl) textEl.textContent = message;
        if (iconEl) iconEl.textContent = isError ? '📡' : '⚠️';

        banner.style.background = isError ? '#ef4444' : '#f59e0b';
        banner.style.display = 'block';
        banner.style.transform = 'translateY(0)';
        isOffline = true;

        // Adicionar padding ao body para não cobrir conteúdo
        document.body.style.paddingTop = banner.offsetHeight + 'px';
        
        startMonitoring();
    }

    // Função para esconder o banner
    function hideBanner() {
        banner.style.transform = 'translateY(-100%)';
        setTimeout(() => {
            banner.style.display = 'none';
            document.body.style.paddingTop = '0';
        }, 300);
        isOffline = false;
        startMonitoring();
    }

    // Verificar conexão com ping ao Supabase
    async function checkConnection() {
        try {
            const startTime = Date.now();
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 segundos timeout

            // Tentar fazer uma requisição simples ao Supabase
            const response = await fetch(`${supabaseUrl}/rest/v1/`, {
                method: 'HEAD',
                headers: {
                    'apikey': supabaseKey
                },
                signal: controller.signal,
                cache: 'no-store'
            });

            clearTimeout(timeoutId);
            const responseTime = Date.now() - startTime;

            if (response.ok || response.status === 401) { // 401 é OK, significa que o servidor está respondendo
                if (responseTime > 10000) {
                    // Conexão lenta (mais de 10 segundos)
                    showBanner('Sua conexão está muito lenta. Algumas funcionalidades podem não funcionar corretamente.', false);
                } else if (isOffline) {
                    // Voltou a ficar online
                    hideBanner();
                }
                return true;
            } else {
                showBanner('Problemas de conexão com o servidor. Verifique sua internet.');
                return false;
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                showBanner('A conexão está muito lenta ou instável. Tentando reconectar...');
            } else if (!navigator.onLine) {
                showBanner('Você está offline. Verifique sua conexão com a internet.');
            } else {
                showBanner('Não foi possível conectar ao servidor. Verifique sua internet.');
            }
            return false;
        }
    }

    // Eventos nativos do navegador
    window.addEventListener('online', () => {
        console.log('[Conexão] Voltou a ficar online');
        checkConnection();
    });

    window.addEventListener('offline', () => {
        console.log('[Conexão] Ficou offline');
        showBanner('Você está offline. Verifique sua conexão com a internet.');
    });

    // Verificar conexão a cada 10 segundos se estiver offline
    // ou a cada 30 segundos se estiver online
    function startMonitoring() {
        if (checkInterval) clearInterval(checkInterval);

        checkInterval = setInterval(() => {
            checkConnection();
        }, isOffline ? 30000 : 120000); // 30s se offline, 120s se online
    }

    // Iniciar monitoramento quando a página carregar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            checkConnection();
            startMonitoring();
        });
    } else {
        checkConnection();
        startMonitoring();
    }

    // Verificar quando a aba volta a ficar visível
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            checkConnection();
        }
    });

    // Expor função global para verificação manual
    window.verificarConexao = checkConnection;
})();

// =============================================
// FUNÇÃO PARA CRIAR USUÁRIOS SEM PERDER A SESSÃO ATUAL
// =============================================
window.criarUsuarioAutenticacaoSemMudarSessao = async function(payload) {
    // 1. Salvar a sessão atual antes de criar o usuário
    var sessaoAtual = await supabaseClient.auth.getSession();
    var refreshG = sessaoAtual.data && sessaoAtual.data.session ? sessaoAtual.data.session.refresh_token : null;
    var tokenG = sessaoAtual.data && sessaoAtual.data.session ? sessaoAtual.data.session.access_token : null;

    // 2. Criar o usuário no Auth (isso automaticamente loga o novo usuário no client)
    var result = await supabaseClient.auth.signUp(payload);

    // 3. Restaurar a sessão original do administrador/gerente
    if (refreshG && tokenG) {
        await supabaseClient.auth.setSession({
            access_token: tokenG,
            refresh_token: refreshG
        });
    }

    return result;
};
