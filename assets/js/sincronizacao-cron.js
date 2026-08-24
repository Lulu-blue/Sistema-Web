/**
 * =========================================================================
 * MÓDULO DE SINCRONIZAÇÃO AUTOMÁTICA DE PRODUTIVIDADE (CRON JOB / FRONTEND)
 * =========================================================================
 * 
 * Este arquivo executa a sincronização diária entre os documentos emitidos no
 * Fluxograma/SEMAC e as tabelas 'controle_processual' e 'registros_produtividade'.
 * 
 * Regras de Negócio Implementadas:
 * - Notificação Preliminar -> 'controle_processual' (Cat 1.1) E 'registros_produtividade' (Cat 14)
 * - Auto de Infração       -> 'controle_processual' (Cat 1.2) E 'registros_produtividade' (Cat 16)
 * - Relatório Fiscal      -> 'controle_processual' (Cat 1.5) E 'registros_produtividade' (Cat 7)
 * - Réplica                -> APENAS em 'controle_processual' (Cat 1.7)
 * - Certidão               -> APENAS em 'controle_processual' (Cat 1.8)
 */

(function () {
    /**
     * Executa a sincronização chamando a função RPC 'sincronizar_produtividade_diaria' do Supabase.
     * @param {string} [dataAlvo] - Data no formato YYYY-MM-DD (padrão: hoje).
     */
    async function executarSincronizacaoDiaria(dataAlvo) {
        const dataFormatada = dataAlvo || new Date().toISOString().split('T')[0];
        console.log(`[Sincronização SEMAC] Iniciando sincronização para a data: ${dataFormatada}...`);

        try {
            // Garante que o Supabase Client está acessível
            const client = window.supabaseClient || (typeof supabase !== 'undefined' ? supabase : null);
            if (!client) {
                console.error('[Sincronização SEMAC] Cliente Supabase não encontrado.');
                return { sucesso: false, erro: 'Cliente Supabase ausente' };
            }

            // Chamada da procedure armazenada no banco
            const { data, error } = await client.rpc('sincronizar_produtividade_diaria', {
                p_data: dataFormatada
            });

            if (error) {
                console.error('[Sincronização SEMAC] Erro ao sincronizar via RPC:', error.message);
                return { sucesso: false, erro: error.message };
            }

            console.log(`[Sincronização SEMAC] Sincronização finalizada com sucesso para ${dataFormatada}!`);
            return { sucesso: true, data };
        } catch (err) {
            console.error('[Sincronização SEMAC] Falha inesperada durante a execução:', err);
            return { sucesso: false, erro: err.message };
        }
    }

    // Expor globalmente para uso manual ou em modais/painéis
    window.executarSincronizacaoDiaria = executarSincronizacaoDiaria;

    /**
     * Agendamento Automático no Navegador:
     * Verifica se o relógio local atinge o fim do dia (23:55) ou se a última sincronização 
     * foi feita hoje. Caso contrário, executa uma verificação ao carregar o painel.
     */
    function iniciarAgendamentoAutomatico() {
        const HOJE = new Date().toISOString().split('T')[0];
        const ULTIMA_SYNC = localStorage.getItem('semac_ultima_sincronizacao_produtividade');

        // Se ainda não foi sincronizado hoje, roda a sincronização de ontem e de hoje
        if (ULTIMA_SYNC !== HOJE) {
            const ontem = new Date();
            ontem.setDate(ontem.getDate() - 1);
            const dataOntem = ontem.toISOString().split('T')[0];

            console.log('[Sincronização SEMAC] Executando sincronização preventiva...');
            
            executarSincronizacaoDiaria(dataOntem).then(() => {
                executarSincronizacaoDiaria(HOJE).then(res => {
                    if (res && res.sucesso) {
                        localStorage.setItem('semac_ultima_sincronizacao_produtividade', HOJE);
                    }
                });
            });
        }

        // Loop de verificação a cada 1 hora no cliente ativo
        setInterval(() => {
            const agora = new Date();
            const dataHoje = agora.toISOString().split('T')[0];
            const hora = agora.getHours();

            // Se for entre 23:00 e 23:59 e ainda não rodou hoje
            if (hora >= 23 && localStorage.getItem('semac_ultima_sincronizacao_produtividade') !== dataHoje) {
                executarSincronizacaoDiaria(dataHoje).then(res => {
                    if (res && res.sucesso) {
                        localStorage.setItem('semac_ultima_sincronizacao_produtividade', dataHoje);
                    }
                });
            }
        }, 60 * 60 * 1000); // 1 hora
    }

    // Inicialização ao carregar a página
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciarAgendamentoAutomatico);
    } else {
        iniciarAgendamentoAutomatico();
    }
})();
