/**
 * =========================================================================
 * MÓDULO DE SINCRONIZAÇÃO AUTOMÁTICA DE PRODUTIVIDADE (FLUXOGRAMA -> SEMAC)
 * =========================================================================
 * 
 * Busca dados no banco MESTRE (Fluxograma) e insere no banco SEMAC.
 * O vínculo entre usuários é feito pelo CPF:
 *   - No SEMAC, o email de login é "cpf@email.com"
 *   - No Fluxograma, o CPF está na tabela profiles.cpf
 * 
 * Tabelas sincronizadas:
 * 
 * 1. NOTIFICAÇÕES (Fluxograma: notificacoes)
 *    -> controle_processual  (1.1 - NP - 5 pts)
 *    -> registros_produtividade (14 - NP expedidos - 20 pts)
 * 
 * 2. DOCUMENTOS (Fluxograma: documentos)
 *    tipo "Auto de Infração":
 *      -> controle_processual  (1.2 - Auto de Infração - 5 pts)
 *      -> registros_produtividade (16 - Autos expedidos - 30 pts)
 *    tipo "Relatório Fiscal":
 *      -> controle_processual  (1.5 - Relatório - 10 pts)
 *    tipo "Réplica":
 *      -> controle_processual  (1.7 - Réplica - 50 pts)
 *    tipo "Certidão" / "Certidão Sem Defesa":
 *      -> controle_processual  (1.8 - Certidão - 50 pts)
 * 
 * 3. PROCESSOS (Fluxograma: processos, apenas etapa >= 15)
 *    -> controle_processual  (11 - Dívida Ativa - 100 pts)
 */

(function () {

    // =============================================
    // HELPERS
    // =============================================

    /**
     * Extrai o CPF limpo (somente dígitos) do email de login do SEMAC.
     * Formato esperado: "00000000000@email.com"
     */
    function extrairCpfDoEmail(email) {
        if (!email) return null;
        const partes = email.split('@');
        if (partes.length < 2) return null;
        const cpfLimpo = partes[0].replace(/\D/g, '');
        return cpfLimpo.length >= 11 ? cpfLimpo : null;
    }

    /**
     * Formata CPF de 11 dígitos para o padrão "000.000.000-00"
     */
    function formatarCpf(cpfLimpo) {
        if (!cpfLimpo || cpfLimpo.length < 11) return cpfLimpo;
        return cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }

    /**
     * Insere no controle_processual do SEMAC se ainda não existir (verifica por doc_id/notif_id OU numero_sequencial).
     * Retorna true se inseriu, false se já existia ou houve erro.
     */
    async function inserirControleProcessual(semacClient, userId, fiscalNome, catId, catNome, numSeq, pontuacao, campos) {
        // Garantir marcação clara de identificação da sincronização
        campos.sincronizado = true;
        campos.origem = 'sincronizacao_fluxograma';
        campos.data_sincronizacao = new Date().toISOString();

        // 1. Verificar se já existe pelo identificador único do Mestre (doc_id, notif_id ou proc_id)
        const chaveUnica = campos.doc_id || campos.notif_id || campos.proc_id;
        const campoChave = campos.doc_id ? 'doc_id' : (campos.notif_id ? 'notif_id' : 'proc_id');

        if (chaveUnica) {
            const { data: existeChave } = await semacClient
                .from('controle_processual')
                .select('id')
                .eq('user_id', userId)
                .eq('categoria_id', catId)
                .contains('campos', { [campoChave]: chaveUnica })
                .maybeSingle();

            if (existeChave) return false; // Já sincronizado
        }

        // 2. Verificar por numero_processo (se existir nos campos)
        if (campos.numero_processo && campos.numero_processo !== 'S/N' && campos.numero_processo !== '') {
            const { data: existeNumProc } = await semacClient
                .from('controle_processual')
                .select('id')
                .eq('user_id', userId)
                .eq('categoria_id', catId)
                .contains('campos', { numero_processo: campos.numero_processo })
                .maybeSingle();

            if (existeNumProc) return false;
        }

        // 3. Verificar por número sequencial (evita duplicar o que o fiscal já lançou manualmente no SEMAC)
        if (numSeq && numSeq !== 'S/N' && numSeq !== '') {
            const { data: existeSeq } = await semacClient
                .from('controle_processual')
                .select('id')
                .eq('user_id', userId)
                .eq('categoria_id', catId)
                .eq('numero_sequencial', numSeq)
                .maybeSingle();

            if (existeSeq) return false;
        }

        const { error } = await semacClient
            .from('controle_processual')
            .insert([{
                user_id: userId,
                fiscal_nome: fiscalNome,
                categoria_id: catId,
                categoria_nome: catNome,
                numero_sequencial: numSeq || 'S/N',
                pontuacao: pontuacao,
                campos: campos,
                created_at: campos._created_at || new Date().toISOString()
            }]);

        if (error) {
            console.warn(`[Sincronização] Erro ao inserir CP (${catId}):`, error.message);
            return false;
        }
        return true;
    }

    /**
     * Insere em registros_produtividade do SEMAC se ainda não existir.
     * Retorna true se inseriu, false se já existia ou houve erro.
     */
    async function inserirRegistroProdutividade(semacClient, userId, catId, catNome, pontuacao, campos) {
        // Garantir marcação clara de identificação da sincronização
        campos.sincronizado = true;
        campos.origem = 'sincronizacao_fluxograma';
        campos.data_sincronizacao = new Date().toISOString();

        const chaveUnica = campos.doc_id || campos.notif_id || campos.proc_id;
        const campoChave = campos.doc_id ? 'doc_id' : (campos.notif_id ? 'notif_id' : 'proc_id');

        if (chaveUnica) {
            const { data: existeChave } = await semacClient
                .from('registros_produtividade')
                .select('id')
                .eq('user_id', userId)
                .eq('categoria_id', catId)
                .contains('campos', { [campoChave]: chaveUnica })
                .maybeSingle();

            if (existeChave) return false;
        }

        const numSeqRP = campos.n_auto || campos.n_notificacao || campos.n_relatorio || campos.numero_sequencial;
        if (numSeqRP && numSeqRP !== 'S/N' && numSeqRP !== '') {
            const campoBusca = catId === '16' ? 'n_auto' : 'n_notificacao';
            const { data: existeSeqRP } = await semacClient
                .from('registros_produtividade')
                .select('id')
                .eq('user_id', userId)
                .eq('categoria_id', catId)
                .contains('campos', { [campoBusca]: numSeqRP })
                .maybeSingle();

            if (existeSeqRP) return false;
        }

        const { error } = await semacClient
            .from('registros_produtividade')
            .insert([{
                user_id: userId,
                categoria_id: catId,
                categoria_nome: catNome,
                pontuacao: pontuacao,
                campos: campos,
                created_at: campos._created_at || new Date().toISOString()
            }]);

        if (error) {
            console.warn(`[Sincronização] Erro ao inserir RP (${catId}):`, error.message);
            return false;
        }
        return true;
    }

    // =============================================
    // FUNÇÃO PRINCIPAL
    // =============================================

    let sincronizacaoEmAndamento = false;

    async function executarSincronizacaoDiaria(dataAlvo) {
        if (sincronizacaoEmAndamento) {
            console.log('[Sincronização SEMAC] ⚠️ Sincronização já em andamento. Ignorando chamada concorrente.');
            return { sucesso: true, emAndamento: true, inseridosControle: 0, inseridosProdutividade: 0 };
        }
        sincronizacaoEmAndamento = true;

        const dataFormatada = dataAlvo || new Date().toISOString().split('T')[0];
        console.log(`[Sincronização SEMAC] Iniciando sincronização para: ${dataFormatada}...`);

        try {
            const masterClient = window.supabaseMaster || (typeof supabaseMaster !== 'undefined' ? supabaseMaster : null);
            const semacClient = window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);

            if (!masterClient || !semacClient) {
                console.error('[Sincronização SEMAC] Clientes Supabase (Master ou SEMAC) indisponíveis.');
                return { sucesso: false, erro: 'Clientes Supabase indisponíveis' };
            }

            // ------------------------------------------------------------------
            // PASSO 1: Identificar o usuário no Fluxograma via CPF
            // ------------------------------------------------------------------
            const { data: { user: authUser } } = await semacClient.auth.getUser();
            if (!authUser) {
                console.warn('[Sincronização SEMAC] Usuário não autenticado.');
                return { sucesso: false, erro: 'Não autenticado' };
            }

            const cpfLimpo = extrairCpfDoEmail(authUser.email);
            if (!cpfLimpo) {
                console.warn('[Sincronização SEMAC] Não foi possível extrair CPF do email:', authUser.email);
                return { sucesso: false, erro: 'CPF não encontrado no email' };
            }

            // Buscar o perfil no Fluxograma pelo CPF (formato com pontos ou sem)
            const cpfFormatado = formatarCpf(cpfLimpo);
            const { data: perfilFluxograma, error: errPerfil } = await masterClient
                .from('profiles')
                .select('id, nome, cpf')
                .or(`cpf.eq.${cpfFormatado},cpf.eq.${cpfLimpo}`)
                .maybeSingle();

            if (errPerfil || !perfilFluxograma) {
                console.warn(`[Sincronização SEMAC] Perfil não encontrado no Fluxograma para CPF ${cpfFormatado}.`);
                return { sucesso: true, inseridosControle: 0, inseridosProdutividade: 0 };
            }

            const fluxoUserId = perfilFluxograma.id;
            const fiscalNome = perfilFluxograma.nome || 'Fiscal';
            const semacUserId = authUser.id;

            console.log(`[Sincronização SEMAC] Usuário encontrado: ${fiscalNome} (Fluxograma: ${fluxoUserId})`);

            let inseridosControle = 0;
            let inseridosProdutividade = 0;

            // ------------------------------------------------------------------
            // PASSO 2: Sincronizar DOCUMENTOS
            // ------------------------------------------------------------------
            const { data: documentos, error: errDocs } = await masterClient
                .from('documentos')
                .select('id, processo_id, tipo, numero_sequencial, url, created_at')
                .eq('usuario_id', fluxoUserId)
                .eq('gerado_automaticamente', false);

            if (errDocs) {
                console.error('[Sincronização SEMAC] Erro ao buscar documentos:', errDocs.message);
            }

            // Coletar processo_ids únicos para buscar contribuintes e imóveis em lote
            const processoIdsFromDocs = [...new Set((documentos || []).map(d => d.processo_id).filter(Boolean))];

            // Buscar contribuintes e imóveis separadamente
            const contribuintesPorProcesso = {};
            const imoveisPorProcesso = {};

            if (processoIdsFromDocs.length > 0) {
                const { data: contribs } = await masterClient
                    .from('contribuintes')
                    .select('processo_id, nome, cpf_cnpj, bairro')
                    .in('processo_id', processoIdsFromDocs);
                (contribs || []).forEach(c => {
                    if (!contribuintesPorProcesso[c.processo_id]) contribuintesPorProcesso[c.processo_id] = c;
                });

                const { data: imvs } = await masterClient
                    .from('imoveis')
                    .select('processo_id, bairro, inscricao_imovel')
                    .in('processo_id', processoIdsFromDocs);
                (imvs || []).forEach(i => {
                    if (!imoveisPorProcesso[i.processo_id]) imoveisPorProcesso[i.processo_id] = i;
                });
            }

            for (const doc of (documentos || [])) {
                const tipoLower = (doc.tipo || '').toLowerCase().trim();
                const numSeq = doc.numero_sequencial || 'S/N';
                const docUrl = doc.url || '';
                const createdAt = doc.created_at;
                const contribuinte = contribuintesPorProcesso[doc.processo_id] || {};
                const imovel = imoveisPorProcesso[doc.processo_id] || {};
                const nomeContribuinte = contribuinte.nome || '';
                const bairroImovel = imovel.bairro || contribuinte.bairro || '';
                const dataFormatadaBR = createdAt ? new Date(createdAt).toISOString().split('T')[0] : '';

                // --- Auto de Infração ---
                if (tipoLower.includes('auto de infração') || tipoLower.includes('auto de infracao')) {
                    // CP 1.2 - 5 pts
                    const camposCP = {
                        doc_id: doc.id,
                        n_auto: numSeq,
                        nome: nomeContribuinte,
                        bairro: bairroImovel,
                        motivo: '',
                        anexo_pdf: docUrl,
                        _created_at: createdAt
                    };
                    if (await inserirControleProcessual(semacClient, semacUserId, fiscalNome, '1.2', 'Controle Processual: Auto de Infração', numSeq, 5, camposCP)) {
                        inseridosControle++;
                    }

                    // RP 16 - 30 pts
                    const camposRP = {
                        doc_id: doc.id,
                        n_auto: numSeq,
                        descricao: nomeContribuinte || 'Expedição Automática',
                        data: dataFormatadaBR,
                        _created_at: createdAt
                    };
                    if (await inserirRegistroProdutividade(semacClient, semacUserId, '16', 'Autos de Infração expedidos', 30, camposRP)) {
                        inseridosProdutividade++;
                    }
                }

                // --- Relatório Fiscal ---
                else if (tipoLower.includes('relatório fiscal') || tipoLower.includes('relatorio fiscal')) {
                    const camposCP = {
                        doc_id: doc.id,
                        atendimento: nomeContribuinte || numSeq,
                        bairro: bairroImovel,
                        anexo_pdf: docUrl,
                        _created_at: createdAt
                    };
                    if (await inserirControleProcessual(semacClient, semacUserId, fiscalNome, '1.5', 'Controle Processual: Relatório', numSeq, 10, camposCP)) {
                        inseridosControle++;
                    }
                }

                // --- Réplica ---
                else if (tipoLower.includes('réplica') || tipoLower.includes('replica')) {
                    const camposCP = {
                        doc_id: doc.id,
                        nome: nomeContribuinte,
                        bairro: bairroImovel,
                        anexo_pdf: docUrl,
                        _created_at: createdAt
                    };
                    if (await inserirControleProcessual(semacClient, semacUserId, fiscalNome, '1.7', 'Réplica', numSeq, 50, camposCP)) {
                        inseridosControle++;
                    }
                }

                // --- Certidão ---
                else if (tipoLower.includes('certidão') || tipoLower.includes('certidao')) {
                    const camposCP = {
                        doc_id: doc.id,
                        nome: nomeContribuinte,
                        bairro: bairroImovel,
                        anexo_pdf: docUrl,
                        _created_at: createdAt
                    };
                    if (await inserirControleProcessual(semacClient, semacUserId, fiscalNome, '1.8', 'Certidão', numSeq, 50, camposCP)) {
                        inseridosControle++;
                    }
                }
            }

            // ------------------------------------------------------------------
            // PASSO 3: Sincronizar NOTIFICAÇÕES
            // ------------------------------------------------------------------
            // Buscar processos do fiscal para pegar as notificações vinculadas
            const { data: processosDoFiscal, error: errProc } = await masterClient
                .from('processos')
                .select('id, dados, possui_decreto')
                .eq('fiscal_id', fluxoUserId);

            if (errProc) {
                console.error('[Sincronização SEMAC] Erro ao buscar processos:', errProc.message);
            }

            // Excluir processos por decreto (não possuem Notificação Preliminar)
            const processosIds = (processosDoFiscal || [])
                .filter(p => {
                    const ehDecreto = p.possui_decreto
                        || p.dados?.possui_decreto
                        || p.dados?.fiscal?.decreto === 'sim'
                        || p.dados?.fiscal?.fiscDecreto === 'sim';
                    return !ehDecreto;
                })
                .map(p => p.id);

            if (processosIds.length > 0) {
                // Buscar notificações dos processos desse fiscal
                const { data: notificacoes, error: errNotif } = await masterClient
                    .from('notificacoes')
                    .select('id, numero, descricao, created_at, processo_id')
                    .in('processo_id', processosIds);

                if (errNotif) {
                    console.error('[Sincronização SEMAC] Erro ao buscar notificações:', errNotif.message);
                }

                // Buscar contribuintes e imóveis dos processos para as notificações
                const contribsNotif = {};
                const imoveisNotif = {};

                const { data: cNotif } = await masterClient
                    .from('contribuintes')
                    .select('processo_id, nome, cpf_cnpj, bairro')
                    .in('processo_id', processosIds);
                (cNotif || []).forEach(c => {
                    if (!contribsNotif[c.processo_id]) contribsNotif[c.processo_id] = c;
                });

                const { data: iNotif } = await masterClient
                    .from('imoveis')
                    .select('processo_id, bairro, inscricao_imovel')
                    .in('processo_id', processosIds);
                (iNotif || []).forEach(i => {
                    if (!imoveisNotif[i.processo_id]) imoveisNotif[i.processo_id] = i;
                });

                // Buscar documentos das notificações para obter o URL do anexo
                const { data: docsNotif } = await masterClient
                    .from('documentos')
                    .select('notificacao_id, url')
                    .in('processo_id', processosIds)
                    .not('notificacao_id', 'is', null);

                const urlPorNotificacao = {};
                (docsNotif || []).forEach(d => {
                    if (d.notificacao_id && d.url) {
                        urlPorNotificacao[d.notificacao_id] = d.url;
                    }
                });

                for (const notif of (notificacoes || [])) {
                    const contribuinte = contribsNotif[notif.processo_id] || {};
                    const imovel = imoveisNotif[notif.processo_id] || {};
                    const createdAt = notif.created_at;
                    const dataFormatadaBR = createdAt ? new Date(createdAt).toISOString().split('T')[0] : '';
                    const anexoUrl = urlPorNotificacao[notif.id] || '';

                    // CP 1.1 - Notificação Preliminar - 5 pts
                    const camposCP = {
                        notif_id: notif.id,
                        n_notificacao: notif.numero || 'S/N',
                        nome: contribuinte.nome || '',
                        n_inscricao: contribuinte.cpf_cnpj || imovel.inscricao_imovel || '',
                        bairro: imovel.bairro || contribuinte.bairro || '',
                        motivo: notif.descricao || '',
                        anexo_pdf: anexoUrl,
                        _created_at: createdAt
                    };
                    if (await inserirControleProcessual(semacClient, semacUserId, fiscalNome, '1.1', 'Controle Processual: Notificação Preliminar', notif.numero || 'S/N', 5, camposCP)) {
                        inseridosControle++;
                    }

                    // RP 14 - Notificação Preliminar expedidos - 20 pts
                    const camposRP = {
                        notif_id: notif.id,
                        n_notificacao: notif.numero || 'S/N',
                        descricao: notif.descricao || '',
                        data: dataFormatadaBR,
                        _created_at: createdAt
                    };
                    if (await inserirRegistroProdutividade(semacClient, semacUserId, '14', 'Notificação Preliminar expedidos', 20, camposRP)) {
                        inseridosProdutividade++;
                    }
                }
            }

            // ------------------------------------------------------------------
            // PASSO 4: Encaminhamento para Dívida Ativa (Cat. 10 - 100 pts)
            // Roda INDEPENDENTE do PASSO 3 (Notificações)
            // Sincroniza processos que atingiram etapa >= 15 no Fluxograma
            // Pontua apenas para o criador do processo (fiscal_id)
            // ------------------------------------------------------------------

            // Determinar limites do mês atual
            const agora = new Date();
            const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
            inicioMes.setHours(0, 0, 0, 0);
            const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0);
            fimMes.setHours(23, 59, 59, 999);

            console.log(`[Sincronização SEMAC] Buscando processos Dívida Ativa (etapa >= 15) do mês ${inicioMes.toISOString().split('T')[0]} a ${fimMes.toISOString().split('T')[0]}...`);

            // Buscar TODOS os processos do fiscal (inclui etapa_atual_id)
            const { data: todosProcessosDA, error: errDA } = await masterClient
                .from('processos')
                .select('id, numero_processo, fiscal_id, etapa_atual_id, dados, created_at, updated_at')
                .eq('fiscal_id', fluxoUserId);

            if (errDA) {
                console.warn('[Sincronização SEMAC] Erro ao buscar processos Dívida Ativa:', errDA.message);
            }

            // Função auxiliar para extrair o número da etapa do processo
            function extrairEtapaNumero(proc) {
                if (!proc) return 0;
                if (proc.etapa_atual_id !== undefined && proc.etapa_atual_id !== null) {
                    const num = parseInt(proc.etapa_atual_id, 10);
                    if (!isNaN(num)) return num;
                    const match = String(proc.etapa_atual_id).match(/\d+/);
                    if (match) return parseInt(match[0], 10);
                }
                if (proc.etapa !== undefined && proc.etapa !== null) {
                    const num = parseInt(proc.etapa, 10);
                    if (!isNaN(num)) return num;
                    const match = String(proc.etapa).match(/\d+/);
                    if (match) return parseInt(match[0], 10);
                }
                const d = proc.dados || {};
                const camposEtapa = [d.etapa_atual_id, d.etapa_atual, d.etapa, d.etapa_id, d.etapaAtual, d.etapa_numero, d.etapa_codigo];
                for (const val of camposEtapa) {
                    if (val !== undefined && val !== null) {
                        const num = parseInt(val, 10);
                        if (!isNaN(num)) return num;
                        const match = String(val).match(/\d+/);
                        if (match) return parseInt(match[0], 10);
                    }
                }
                let maiorEtapaKey = 0;
                for (const key of Object.keys(d)) {
                    const match = key.match(/etapa_?(\d+)/i);
                    if (match) {
                        const numKey = parseInt(match[1], 10);
                        if (numKey > maiorEtapaKey) maiorEtapaKey = numKey;
                    }
                }
                return maiorEtapaKey;
            }

            // Filtrar no JS: etapa >= 15 E atualizado no mês atual
            const processosDividaAtiva = (todosProcessosDA || []).filter(p => {
                const etapaNum = extrairEtapaNumero(p);
                if (etapaNum < 15) return false;

                // Verificar se o updated_at ou created_at está no mês atual
                const dataUpdate = new Date(p.updated_at || p.created_at);
                return dataUpdate >= inicioMes && dataUpdate <= fimMes;
            });

            console.log(`[Sincronização SEMAC] Total processos do fiscal: ${(todosProcessosDA || []).length}, com etapa >= 15 no mês: ${processosDividaAtiva.length}`);

            if (processosDividaAtiva.length > 0) {
                const procIdsDA = processosDividaAtiva.map(p => p.id);

                // Buscar Autos de Infração vinculados a esses processos
                const autosPorProcesso = {};
                const { data: autosDA } = await masterClient
                    .from('documentos')
                    .select('processo_id, numero_sequencial, tipo, url')
                    .in('processo_id', procIdsDA)
                    .or('tipo.ilike.%Auto de Infração%,tipo.ilike.%Auto de Infracao%');

                (autosDA || []).forEach(a => {
                    if (!autosPorProcesso[a.processo_id]) autosPorProcesso[a.processo_id] = a;
                });

                // Buscar Contribuintes desses processos
                const contribsDAPorProcesso = {};
                const { data: contribsDA } = await masterClient
                    .from('contribuintes')
                    .select('processo_id, nome, cpf_cnpj, bairro, logradouro, numero')
                    .in('processo_id', procIdsDA);

                (contribsDA || []).forEach(c => {
                    if (!contribsDAPorProcesso[c.processo_id]) contribsDAPorProcesso[c.processo_id] = c;
                });

                // Buscar Imóveis desses processos
                const imoveisDAPorProcesso = {};
                const { data: imvsDA } = await masterClient
                    .from('imoveis')
                    .select('processo_id, bairro, inscricao_imovel, logradouro, numero')
                    .in('processo_id', procIdsDA);

                (imvsDA || []).forEach(i => {
                    if (!imoveisDAPorProcesso[i.processo_id]) imoveisDAPorProcesso[i.processo_id] = i;
                });

                for (const proc of processosDividaAtiva) {
                    const autoDoc = autosPorProcesso[proc.id] || {};
                    const contribDA = contribsDAPorProcesso[proc.id] || {};
                    const imovelDA = imoveisDAPorProcesso[proc.id] || {};
                    const dadosProc = proc.dados || {};

                    // Extrair dados relevantes
                    const numAuto = autoDoc.numero_sequencial
                        || dadosProc.numero_auto_infracao
                        || dadosProc.etapa14?.numero_auto_infracao
                        || '';
                    const nomeAutuado = contribDA.nome
                        || dadosProc.contribuinte?.nome
                        || '';
                    const cpfAutuado = contribDA.cpf_cnpj
                        || dadosProc.contribuinte?.cpf_cnpj
                        || '';
                    const bairroDA = imovelDA.bairro
                        || contribDA.bairro
                        || dadosProc.imovel?.bairro
                        || '';
                    const anexoPdf = autoDoc.url || '';

                    const camposCP = {
                        proc_id: proc.id,
                        n_auto: numAuto,
                        nome: nomeAutuado,
                        cpf: cpfAutuado,
                        bairro: bairroDA,
                        numero_processo: proc.numero_processo || '',
                        etapa_atual: extrairEtapaNumero(proc),
                        anexo_pdf: anexoPdf,
                        _created_at: proc.updated_at || proc.created_at
                    };

                    const numSeqDA = proc.numero_processo || numAuto || 'S/N';

                    if (await inserirControleProcessual(
                        semacClient,
                        semacUserId,
                        fiscalNome,
                        '11',
                        'Montagem de processo para encaminhamento, exclusivamente para inscrição em dívida ativa',
                        numSeqDA,
                        100,
                        camposCP
                    )) {
                        inseridosControle++;
                        console.log(`[Sincronização SEMAC] ✅ Dívida Ativa registrada: ${nomeAutuado || numSeqDA} (Processo: ${proc.numero_processo})`);
                    }
                }
            } else {
                console.log(`[Sincronização SEMAC] ℹ️ Nenhum processo com etapa >= 15 encontrado no mês.`);
            }

            console.log(`[Sincronização SEMAC] Concluído! CP: ${inseridosControle}, RP: ${inseridosProdutividade}`);
            
            // Recarregar o histórico na UI se novos registros foram inseridos
            if ((inseridosControle > 0 || inseridosProdutividade > 0) && typeof carregarHistorico === 'function') {
                carregarHistorico();
            }

            return { sucesso: true, inseridosControle, inseridosProdutividade };

        } catch (err) {
            console.error('[Sincronização SEMAC] Exceção durante a sincronização:', err);
            return { sucesso: false, erro: err.message };
        } finally {
            sincronizacaoEmAndamento = false;
        }
    }

    window.executarSincronizacaoDiaria = executarSincronizacaoDiaria;

    // =============================================
    // AGENDAMENTO AUTOMÁTICO (roda 1x por dia)
    // =============================================
    function iniciarAgendamentoAutomatico() {
        const HOJE = new Date().toISOString().split('T')[0];
        const ULTIMA_SYNC = localStorage.getItem('semac_ultima_sincronizacao_produtividade');

        if (ULTIMA_SYNC !== HOJE) {
            console.log('[Sincronização SEMAC] Executando sincronização automática...');

            executarSincronizacaoDiaria().then(res => {
                if (res && res.sucesso) {
                    localStorage.setItem('semac_ultima_sincronizacao_produtividade', HOJE);
                    if (typeof carregarHistorico === 'function') {
                        carregarHistorico();
                    }
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciarAgendamentoAutomatico);
    } else {
        iniciarAgendamentoAutomatico();
    }
})();
