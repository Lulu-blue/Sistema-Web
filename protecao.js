// =============================================
// PROTEÇÃO DE ROTA + CONEXÃO SUPABASE CENTRAL
// =============================================
// Este arquivo é carregado PRIMEIRO no painel.
// Cria a conexão e verifica se o usuário está logado.

const supabaseUrl = 'https://marmpnusgmbjphffaynr.supabase.co';
const supabaseKey = 'sb_publishable_ZVtndwPOvY2dA4Qzlwkl2A_H0-TeUgu';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

async function verificarAcesso() {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        alert("Acesso restrito! Identifique-se primeiro.");
        window.location.href = "index.html";
    }
}

// Executa a verificação imediatamente
verificarAcesso();

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
