/**
 * =========================================================================
 * MÓDULO DE SINCRONIZAÇÃO AUTOMÁTICA DE PRODUTIVIDADE (FLUXOGRAMA -> SEMAC)
 * =========================================================================
 * 
 * Este arquivo sincroniza a produtividade buscando os documentos emitidos no
 * banco MESTRE (Fluxograma - tabela 'documentos') e inserindo nas tabelas
 * 'controle_processual' e 'registros_produtividade' do banco SEMAC.
 * 
 * Regras de Negócio:
 * - Notificação Preliminar -> 'controle_processual' (Cat 1.1 - 5 pts) E 'registros_produtividade' (Cat 14 - 15 pts)
 * - Auto de Infração       -> 'controle_processual' (Cat 1.2 - 5 pts) E 'registros_produtividade' (Cat 16 - 15 pts)
 * - Relatório Fiscal      -> 'controle_processual' (Cat 1.5 - 5 pts) E 'registros_produtividade' (Cat 7 - 10 pts)
 * - Réplica                -> APENAS em 'controle_processual' (Cat 1.7 - 5 pts)
 * - Certidão               -> APENAS em 'controle_processual' (Cat 1.8 - 5 pts)
 */

(function () {
    /**
     * Executa a sincronização buscando do Fluxograma e salvando no SEMAC.
     * @param {string} [dataAlvo] - Data no formato YYYY-MM-DD (padrão: hoje).
     */
    async function executarSincronizacaoDiaria(dataAlvo) {
        const dataFormatada = dataAlvo || new Date().toISOString().split('T')[0];
        console.log(`[Sincronização SEMAC] Iniciando busca de documentos no FLUXOGRAMA para a data: ${dataFormatada}...`);

        try {
            const masterClient = window.supabaseMaster || (typeof supabaseMaster !== 'undefined' ? supabaseMaster : null);
            const semacClient = window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);

            if (!masterClient || !semacClient) {
                console.error('[Sincronização SEMAC] Clientes Supabase (Master ou SEMAC) indisponíveis.');
                return { sucesso: false, erro: 'Clientes Supabase indisponíveis' };
            }

            // 1. Buscar documentos criados na data alvo no banco FLUXOGRAMA (Master)
            const startOfDay = `${dataFormatada}T00:00:00.000Z`;
            const endOfDay = `${dataFormatada}T23:59:59.999Z`;

            const { data: documentos, error: errDocs } = await masterClient
                .from('documentos')
                .select(`
                    id,
                    usuario_id,
                    processo_id,
                    tipo,
                    numero_sequencial,
                    created_at,
                    gerado_automaticamente,
                    profiles:usuario_id (id, nome),
                    processos:processo_id (numero_processo)
                `)
                .gte('created_at', startOfDay)
                .lte('created_at', endOfDay);

            if (errDocs) {
                console.error('[Sincronização SEMAC] Erro ao buscar documentos no Fluxograma:', errDocs.message);
                return { sucesso: false, erro: errDocs.message };
            }

            if (!documentos || documentos.length === 0) {
                console.log(`[Sincronização SEMAC] Nenhum documento encontrado no Fluxograma para a data ${dataFormatada}.`);
                return { sucesso: true, inseridosControle: 0, inseridosProdutividade: 0 };
            }

            let inseridosControle = 0;
            let inseridosProdutividade = 0;

            for (const doc of documentos) {
                // Ignora documentos gerados automaticamente se marcada a flag
                if (doc.gerado_automaticamente === true) continue;

                const tipo = (doc.tipo || '').trim();
                const userId = doc.usuario_id;
                const fiscalNome = doc.profiles?.nome || 'Fiscal de Posturas';
                const numSeq = doc.numero_sequencial || 'S/N';
                const numProc = doc.processos?.numero_processo || '';
                const docId = doc.id;
                const createdAt = doc.created_at;

                // Definir categorias baseadas no tipo do documento
                let catControle = null;
                let catProdutividade = null;

                const tipoLower = tipo.toLowerCase();

                if (tipoLower.includes('auto de infração') || tipoLower.includes('auto de infracao')) {
                    catControle = { id: '1.2', nome: 'Auto de Infração', pontuacao: 5 };
                    catProdutividade = { id: '16', nome: 'Auto de Infração', pontuacao: 15, campoChave: 'n_auto' };
                } else if (tipoLower.includes('notificação preliminar') || tipoLower.includes('notificacao preliminar')) {
                    catControle = { id: '1.1', nome: 'Notificação Preliminar', pontuacao: 5 };
                    catProdutividade = { id: '14', nome: 'Notificação Preliminar', pontuacao: 15, campoChave: 'n_notificacao' };
                } else if (tipoLower.includes('relatório fiscal') || tipoLower.includes('relatorio fiscal')) {
                    catControle = { id: '1.5', nome: 'Relatório Fiscal', pontuacao: 5 };
                    catProdutividade = { id: '7', nome: 'Elaboração de Relatório Fiscal', pontuacao: 10, campoChave: 'n_relatorio' };
                } else if (tipoLower.includes('réplica') || tipoLower.includes('replica')) {
                    catControle = { id: '1.7', nome: 'Réplica da Defesa', pontuacao: 5 };
                } else if (tipoLower.includes('certidão') || tipoLower.includes('certidao')) {
                    catControle = { id: '1.8', nome: 'Certidão Sem Defesa', pontuacao: 5 };
                }

                // 2. Inserir em controle_processual (SEMAC) se não existir (evita duplicatas)
                if (catControle && userId) {
                    const { data: existeCP } = await semacClient
                        .from('controle_processual')
                        .select('id')
                        .eq('user_id', userId)
                        .eq('categoria_id', catControle.id)
                        .eq('numero_sequencial', numSeq)
                        .maybeSingle();

                    if (!existeCP) {
                        const payloadCP = {
                            user_id: userId,
                            fiscal_nome: fiscalNome,
                            categoria_id: catControle.id,
                            categoria_nome: catControle.nome,
                            numero_sequencial: numSeq,
                            pontuacao: catControle.pontuacao,
                            campos: { numero_processo: numProc, doc_id: docId },
                            created_at: createdAt
                        };

                        const { error: errInsCP } = await semacClient
                            .from('controle_processual')
                            .insert([payloadCP]);

                        if (!errInsCP) inseridosControle++;
                        else console.warn('[Sincronização SEMAC] Erro ao inserir controle_processual:', errInsCP.message);
                    }
                }

                // 3. Inserir em registros_produtividade (SEMAC) se não existir (evita duplicatas)
                if (catProdutividade && userId) {
                    const { data: existeRP } = await semacClient
                        .from('registros_produtividade')
                        .select('id')
                        .eq('user_id', userId)
                        .eq('categoria_id', catProdutividade.id)
                        .contains('campos', { doc_id: docId })
                        .maybeSingle();

                    if (!existeRP) {
                        const camposObj = { doc_id: docId };
                        camposObj[catProdutividade.campoChave] = numSeq;

                        const payloadRP = {
                            user_id: userId,
                            categoria_id: catProdutividade.id,
                            categoria_nome: catProdutividade.nome,
                            pontuacao: catProdutividade.pontuacao,
                            campos: camposObj,
                            created_at: createdAt
                        };

                        const { error: errInsRP } = await semacClient
                            .from('registros_produtividade')
                            .insert([payloadRP]);

                        if (!errInsRP) inseridosProdutividade++;
                        else console.warn('[Sincronização SEMAC] Erro ao inserir registros_produtividade:', errInsRP.message);
                    }
                }
            }

            console.log(`[Sincronização SEMAC] Sucesso para ${dataFormatada}! Novos registros: ${inseridosControle} em Controle, ${inseridosProdutividade} em Produtividade.`);
            return { sucesso: true, inseridosControle, inseridosProdutividade };
        } catch (err) {
            console.error('[Sincronização SEMAC] Exceção durante a sincronização:', err);
            return { sucesso: false, erro: err.message };
        }
    }

    // Expor globalmente para uso manual ou em modais/painéis
    window.executarSincronizacaoDiaria = executarSincronizacaoDiaria;

    /**
     * Agendamento Automático no Navegador
     */
    function iniciarAgendamentoAutomatico() {
        const HOJE = new Date().toISOString().split('T')[0];
        const ULTIMA_SYNC = localStorage.getItem('semac_ultima_sincronizacao_produtividade');

        if (ULTIMA_SYNC !== HOJE) {
            const ontem = new Date();
            ontem.setDate(ontem.getDate() - 1);
            const dataOntem = ontem.toISOString().split('T')[0];

            console.log('[Sincronização SEMAC] Executando sincronização preventiva a partir do Fluxograma...');

            executarSincronizacaoDiaria(dataOntem).then(() => {
                executarSincronizacaoDiaria(HOJE).then(res => {
                    if (res && res.sucesso) {
                        localStorage.setItem('semac_ultima_sincronizacao_produtividade', HOJE);
                    }
                });
            });
        }
    }

    // Inicialização ao carregar a página
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciarAgendamentoAutomatico);
    } else {
        iniciarAgendamentoAutomatico();
    }
})();
