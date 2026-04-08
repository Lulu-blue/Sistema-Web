// =============================================
// PROTEÇÃO DE ROTA + CONEXÃO SUPABASE CENTRAL
// =============================================
// Este arquivo é carregado PRIMEIRO no painel.
// Cria a conexão e verifica se o usuário está logado.

const supabaseUrl = 'https://marmpnusgmbjphffaynr.supabase.co';
const supabaseKey = 'sb_publishable_ZVtndwPOvY2dA4Qzlwkl2A_H0-TeUgu';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

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
        window.location.href = "index.html";
    }
});

/**
 * Função global para ser chamada antes de operações críticas (como salvar).
 * Tenta garantir que o Supabase está com a sessão reconhecida de forma rápida.
 */
async function garantirSessaoAtiva() {
    try {
        // 1. Tentar obter a sessão local (muito rápido)
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        
        // Se temos uma sessão válida e não está prestes a expirar (margem de 10s), já retornamos true
        if (session && !sessionError) {
            const expiresAt = session.expires_at; // unix timestamp
            const now = Math.floor(Date.now() / 1000);
            if (expiresAt > now + 10) {
                return true;
            }
        }

        // 2. Se não tem sessão ou está expirando, tenta verificar acesso completo (requisita servidor se necessário)
        const sessionCheck = await verificarAcesso();
        return !!sessionCheck;
    } catch (err) {
        console.error("Erro ao garantir sessão:", err);
        return false;
    }
}
window.garantirSessaoAtiva = garantirSessaoAtiva;

// =============================================
// MONITORAMENTO DE CONEXÃO COM A INTERNET
// =============================================

(function () {
    // ... cache de elementos omitido para brevidade no replace_file_content se possível, 
    // mas vou manter a estrutura completa para precisão
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

    function showBanner(message, isError = true) {
        const textEl = document.getElementById('offline-text');
        const iconEl = document.getElementById('offline-icon');
        if (textEl) textEl.textContent = message;
        if (iconEl) iconEl.textContent = isError ? '📡' : '⚠️';
        banner.style.background = isError ? '#ef4444' : '#f59e0b';
        banner.style.display = 'block';
        banner.style.transform = 'translateY(0)';
        isOffline = true;
        document.body.style.paddingTop = banner.offsetHeight + 'px';
        startMonitoring();
    }

    function hideBanner() {
        banner.style.transform = 'translateY(-100%)';
        setTimeout(() => {
            banner.style.display = 'none';
            document.body.style.paddingTop = '0';
        }, 300);
        isOffline = false;
        startMonitoring();
    }

    async function checkConnection() {
        try {
            const startTime = Date.now();
            const controller = new AbortController();
            // Timeout reduzido para 5s para não prender a fila de conexões do browser
            const timeoutId = setTimeout(() => controller.abort(), 5000); 

            const response = await fetch(`${supabaseUrl}/rest/v1/`, {
                method: 'HEAD',
                signal: controller.signal,
                cache: 'no-store'
            });

            clearTimeout(timeoutId);
            const responseTime = Date.now() - startTime;

            if (response.ok || response.status === 401) {
                if (responseTime > 5000) {
                    showBanner('Sua conexão está lenta. Algumas funcionalidades podem demorar.', false);
                } else if (isOffline) {
                    hideBanner();
                }
                return true;
            } else {
                showBanner('Problemas de conexão com o servidor.');
                return false;
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                showBanner('A conexão está muito lenta. Tentando reconectar...', false);
            } else if (!navigator.onLine) {
                showBanner('Você está offline. Verifique sua conexão.');
            } else {
                // Se der erro mas o fetch não abortou e navigator.onLine é true, 
                // pode ser CORS ou erro de DNS no Supabase.
                console.warn("[Conexão] Erro no fetch:", error);
            }
            return false;
        }
    }

    window.addEventListener('online', checkConnection);
    window.addEventListener('offline', () => showBanner('Você está offline. Verifique sua conexão.'));

    function startMonitoring() {
        if (checkInterval) clearInterval(checkInterval);
        // Intervalo aumentado p/ diminuir overhead: 1min se offline, 5min se online
        checkInterval = setInterval(checkConnection, isOffline ? 60000 : 300000); 
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
