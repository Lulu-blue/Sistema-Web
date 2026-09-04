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
     * Extrai exaustivamente qualquer URL (Cloudinary / PDF / HTTP) de um objeto ou lista de argumentos.
     */
    function extrairUrlCloudinary(...fontes) {
        for (const fonte of fontes) {
            if (!fonte) continue;
            if (typeof fonte === 'string') {
                const trimmed = fonte.trim();
                if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
                    return trimmed;
                }
            }
            if (typeof fonte === 'object') {
                const chaves = ['url', 'anexo_pdf', 'url_pdf', 'pdf_url', 'capa_pdf', 'url_capa', 'anexo', 'link', 'pdf', 'file_url', 'arquivo_url'];
                for (const k of chaves) {
                    if (fonte[k] && typeof fonte[k] === 'string' && fonte[k].trim().startsWith('http')) {
                        return fonte[k].trim();
                    }
                }
                for (const key in fonte) {
                    const sub = fonte[key];
                    if (sub && typeof sub === 'object') {
                        for (const k of chaves) {
                            if (sub[k] && typeof sub[k] === 'string' && sub[k].trim().startsWith('http')) {
                                return sub[k].trim();
                            }
                        }
                    } else if (sub && typeof sub === 'string' && sub.trim().startsWith('http')) {
                        return sub.trim();
                    }
                }
            }
        }
        return '';
    }

    /**
     * Verifica a elegibilidade para pontuação e inserção nos registros de produtividade:
     * - Mês atual: Pontuação total + Registra em RP.
     * - Mês anterior (1 mês atrás): Pontuação total + Registra em RP se hoje for até o dia 7 do mês vigente.
     * - Mês anterior (após dia 7) ou 2+ meses atrás: Apenas insere no Controle Processual com pontuação 0 (não insere em RP).
     */
    function verificarElegibilidadePontuacao(dataInput) {
        if (!dataInput) return { pontuar: true, diferencaMeses: 0 };
        const dt = new Date(dataInput);
        if (isNaN(dt.getTime())) return { pontuar: true, diferencaMeses: 0 };

        const hoje = new Date();
        const anoAtual = hoje.getFullYear();
        const mesAtual = hoje.getMonth(); // 0 - 11
        const diaAtual = hoje.getDate();   // 1 - 31

        const regAno = dt.getFullYear();
        const regMes = dt.getMonth();

        const diferencaMeses = (anoAtual - regAno) * 12 + (mesAtual - regMes);

        // Mês atual ou datas futuras
        if (diferencaMeses <= 0) {
            return { pontuar: true, diferencaMeses };
        }

        // Exatamente 1 mês atrás (mês anterior) -> Tolerância até o dia 3 do mês atual
        if (diferencaMeses === 1) {
            if (diaAtual <= 3) {
                return { pontuar: true, diferencaMeses };
            } else {
                return { pontuar: false, diferencaMeses, motivo: 'Passou do dia 3 do mês seguinte' };
            }
        }

        // 2 ou mais meses atrás
        return { pontuar: false, diferencaMeses, motivo: 'Item antigo (2+ meses de atraso)' };
    }

    /**
     * Executa uma consulta do Supabase com até maxTentativas em caso de instabilidade de rede (HTTP 522/CORS).
     */
    async function executarQueryComRetry(fnQuery, maxTentativas = 2, delayMs = 1200) {
        for (let t = 1; t <= maxTentativas; t++) {
            try {
                const res = await fnQuery();
                if (res && res.error && (res.error.status >= 500 || String(res.error.message).includes('522'))) {
                    if (t < maxTentativas) {
                        await new Promise(r => setTimeout(r, delayMs));
                        continue;
                    }
                }
                return res || { data: null, error: null };
            } catch (err) {
                if (t < maxTentativas) {
                    await new Promise(r => setTimeout(r, delayMs));
                } else {
                    return { data: null, error: err };
                }
            }
        }
        return { data: null, error: null };
    }

    /**
     * Insere no controle_processual do SEMAC se ainda não existir (verifica por doc_id/notif_id OU numero_sequencial).
     * Retorna true se inseriu, false se já existia ou houve erro.
     */
    /**
     * Insere no controle_processual do SEMAC se ainda não existir (verifica por doc_id/notif_id OU numero_sequencial).
     * Retorna true se inseriu, false se já existia ou houve erro.
     */
    async function inserirControleProcessual(semacClient, userId, fiscalNome, catId, catNome, numSeq, pontuacao, campos) {
        // Garantir marcação clara de identificação da sincronização
        campos.sincronizado = true;
        campos.origem = 'sincronizacao_fluxograma';
        campos.data_sincronizacao = new Date().toISOString();

        // Se o usuário realizou limpeza manual anterior a esta data, ajustar pontuação
        const limpezaIso = localStorage.getItem('semac_limpeza_realizada_ate_' + userId);
        if (limpezaIso) {
            const dtLimpeza = new Date(limpezaIso);
            const dataRegStr = campos._created_at || campos.data || campos.data_vistoria;
            let dtReg = dataRegStr ? new Date(dataRegStr) : new Date();
            if (!isNaN(dtReg.getTime()) && !isNaN(dtLimpeza.getTime()) && dtReg < dtLimpeza) {
                pontuacao = 0;
            }
        }

        // 1. Verificar se já existe pelo identificador único do Mestre (doc_id, notif_id, proc_id ou auto_id)
        const chaveUnica = campos.doc_id || campos.notif_id || campos.proc_id || campos.auto_id;
        const campoChave = campos.doc_id ? 'doc_id' : (campos.notif_id ? 'notif_id' : (campos.proc_id ? 'proc_id' : 'auto_id'));

        if (chaveUnica) {
            const { data: existeChave } = await semacClient
                .from('controle_processual')
                .select('id, campos')
                .eq('user_id', userId)
                .eq('categoria_id', catId)
                .contains('campos', { [campoChave]: chaveUnica })
                .maybeSingle();

            if (existeChave) {
                // Se o registro existente tem anexo_pdf diferente/vazio e agora temos um anexo_pdf, atualizar retroativamente
                if (campos.anexo_pdf && existeChave.campos?.anexo_pdf !== campos.anexo_pdf) {
                    const novosCampos = { ...(existeChave.campos || {}), anexo_pdf: campos.anexo_pdf };
                    await semacClient
                        .from('controle_processual')
                        .update({ campos: novosCampos })
                        .eq('id', existeChave.id);
                }
                return false; // Já sincronizado
            }
        }

        // 2. Verificar por numero_processo (se existir nos campos)
        if (campos.numero_processo && campos.numero_processo !== 'S/N' && campos.numero_processo !== '') {
            const { data: existeNumProc } = await semacClient
                .from('controle_processual')
                .select('id, campos')
                .eq('user_id', userId)
                .eq('categoria_id', catId)
                .contains('campos', { numero_processo: campos.numero_processo })
                .maybeSingle();

            if (existeNumProc) {
                if (campos.anexo_pdf && existeNumProc.campos?.anexo_pdf !== campos.anexo_pdf) {
                    const novosCampos = { ...(existeNumProc.campos || {}), anexo_pdf: campos.anexo_pdf };
                    await semacClient
                        .from('controle_processual')
                        .update({ campos: novosCampos })
                        .eq('id', existeNumProc.id);
                }
                return false;
            }
        }

        // 3. Verificar por número sequencial (evita duplicar o que o fiscal já lançou manualmente no SEMAC)
        if (numSeq && numSeq !== 'S/N' && numSeq !== '') {
            const { data: existeSeq } = await semacClient
                .from('controle_processual')
                .select('id, campos')
                .eq('user_id', userId)
                .eq('categoria_id', catId)
                .eq('numero_sequencial', numSeq)
                .maybeSingle();

            if (existeSeq) {
                if (campos.anexo_pdf && existeSeq.campos?.anexo_pdf !== campos.anexo_pdf) {
                    const novosCampos = { ...(existeSeq.campos || {}), anexo_pdf: campos.anexo_pdf };
                    await semacClient
                        .from('controle_processual')
                        .update({ campos: novosCampos })
                        .eq('id', existeSeq.id);
                }
                return false;
            }
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

        // Se o usuário realizou limpeza manual anterior a esta data, ignorar registros_produtividade já excluídos
        const limpezaIso = localStorage.getItem('semac_limpeza_realizada_ate_' + userId);
        if (limpezaIso) {
            const dtLimpeza = new Date(limpezaIso);
            const dataRegStr = campos._created_at || campos.data || campos.data_vistoria;
            let dtReg = dataRegStr ? new Date(dataRegStr) : new Date();
            if (!isNaN(dtReg.getTime()) && !isNaN(dtLimpeza.getTime()) && dtReg < dtLimpeza) {
                return false;
            }
        }

        const chaveUnica = campos.doc_id || campos.notif_id || campos.proc_id || campos.auto_id;
        const campoChave = campos.doc_id ? 'doc_id' : (campos.notif_id ? 'notif_id' : (campos.proc_id ? 'proc_id' : 'auto_id'));

        if (chaveUnica) {
            const { data: existeChave } = await semacClient
                .from('registros_produtividade')
                .select('id, campos')
                .eq('user_id', userId)
                .eq('categoria_id', catId)
                .contains('campos', { [campoChave]: chaveUnica })
                .maybeSingle();

            if (existeChave) {
                if (campos.anexo_pdf && existeChave.campos?.anexo_pdf !== campos.anexo_pdf) {
                    const novosCampos = { ...(existeChave.campos || {}), anexo_pdf: campos.anexo_pdf };
                    await semacClient
                        .from('registros_produtividade')
                        .update({ campos: novosCampos })
                        .eq('id', existeChave.id);
                }
                return false;
            }
        }

        const numSeqRP = campos.n_auto || campos.n_notificacao || campos.n_relatorio || campos.numero_sequencial;
        if (numSeqRP && numSeqRP !== 'S/N' && numSeqRP !== '') {
            const campoBusca = catId === '16' ? 'n_auto' : 'n_notificacao';
            const { data: existeSeqRP } = await semacClient
                .from('registros_produtividade')
                .select('id, campos')
                .eq('user_id', userId)
                .eq('categoria_id', catId)
                .contains('campos', { [campoBusca]: numSeqRP })
                .maybeSingle();

            if (existeSeqRP) {
                if (campos.anexo_pdf && existeSeqRP.campos?.anexo_pdf !== campos.anexo_pdf) {
                    const novosCampos = { ...(existeSeqRP.campos || {}), anexo_pdf: campos.anexo_pdf };
                    await semacClient
                        .from('registros_produtividade')
                        .update({ campos: novosCampos })
                        .eq('id', existeSeqRP.id);
                }
                return false;
            }
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
            // PASSO 1: Identificar o usuário no Fluxograma via CPF / Email / Auth ID / Nome
            // ------------------------------------------------------------------
            const { data: { user: authUser } } = await semacClient.auth.getUser();
            if (!authUser) {
                console.warn('[Sincronização SEMAC] Usuário não autenticado.');
                return { sucesso: false, erro: 'Não autenticado' };
            }

            // Buscar perfil no SEMAC para obter dados adicionais (CPF, nome, etc)
            let semacPerfil = null;
            try {
                const { data: pSemac } = await semacClient
                    .from('profiles')
                    .select('id, cpf, full_name, email_real')
                    .eq('id', authUser.id)
                    .maybeSingle();
                semacPerfil = pSemac;
            } catch (e) {
                console.warn('[Sincronização SEMAC] Erro ao buscar perfil SEMAC:', e);
            }

            const userEmail = authUser.email || semacPerfil?.email_real || '';
            const cpfDoEmail = extrairCpfDoEmail(userEmail);
            const cpfDoPerfil = semacPerfil?.cpf ? String(semacPerfil.cpf).replace(/\D/g, '') : null;
            const cpfLimpo = cpfDoPerfil && cpfDoPerfil.length >= 11 ? cpfDoPerfil : cpfDoEmail;
            const cpfFormatado = cpfLimpo ? formatarCpf(cpfLimpo) : null;
            const userNome = semacPerfil?.full_name || authUser.user_metadata?.full_name || authUser.user_metadata?.nome || '';

            console.log(`[Sincronização SEMAC] Tentando identificar usuário (Email: ${userEmail}, CPF: ${cpfLimpo || 'N/A'}, Nome: ${userNome || 'N/A'})...`);

            // Montar condições de busca no Fluxograma (profiles)
            let perfisFluxograma = [];

            // 1. Tentar buscar por auth_id ou CPF no Fluxograma
            const orConditions = [];
            if (authUser.id) orConditions.push(`auth_id.eq.${authUser.id}`);
            if (cpfFormatado) orConditions.push(`cpf.eq.${cpfFormatado}`);
            if (cpfLimpo) orConditions.push(`cpf.eq.${cpfLimpo}`);
            if (userEmail) orConditions.push(`email.eq.${userEmail}`);

            if (orConditions.length > 0) {
                const { data: resPerfis, error: errPerfil } = await executarQueryComRetry(() =>
                    masterClient
                        .from('profiles')
                        .select('id, auth_id, nome, cpf, email')
                        .or(orConditions.join(','))
                );

                if (!errPerfil && resPerfis && resPerfis.length > 0) {
                    perfisFluxograma = resPerfis;
                }
            }

            // 2. Se ainda não encontrou e temos nome, tentar buscar por nome aproximado
            if (perfisFluxograma.length === 0 && userNome && userNome.length > 3) {
                const { data: resNome } = await executarQueryComRetry(() =>
                    masterClient
                        .from('profiles')
                        .select('id, auth_id, nome, cpf, email')
                        .ilike('nome', `%${userNome.trim()}%`)
                );

                if (resNome && resNome.length > 0) {
                    perfisFluxograma = resNome;
                }
            }

            if (perfisFluxograma.length === 0) {
                console.warn(`[Sincronização SEMAC] Perfil não encontrado no Fluxograma para Email: ${userEmail}, CPF: ${cpfFormatado || cpfLimpo}.`);
                return { sucesso: true, inseridosControle: 0, inseridosProdutividade: 0 };
            }

            const perfilPrincipal = perfisFluxograma[0];
            const fiscalNome = perfilPrincipal.nome || userNome || 'Fiscal';
            const semacUserId = authUser.id;
            const allUserIds = [...new Set(
                perfisFluxograma.flatMap(p => [p.id, p.auth_id]).concat(semacUserId).filter(Boolean)
            )];

            console.log(`[Sincronização SEMAC] Usuário identificado com sucesso: ${fiscalNome} (IDs Fluxograma: ${allUserIds.join(', ')})`);

            let inseridosControle = 0;
            let inseridosProdutividade = 0;

            // ------------------------------------------------------------------
            // PASSO 1: BUSCA E DIAGNÓSTICO EM TODAS AS TABELAS DO FLUXOGRAMA
            // ------------------------------------------------------------------
            
            // ⚠️ Verificar se o masterClient tem sessão autenticada
            let masterAuthCheck = null;
            try {
                const { data: authCheck } = await masterClient.auth.getUser();
                masterAuthCheck = authCheck?.user || null;
            } catch(e) { /* sem sessão */ }
            
            console.log(`[Sincronização SEMAC] 🔑 masterClient auth.uid(): ${masterAuthCheck?.id || 'NULL (sem sessão - RLS pode bloquear!)'}`);
            if (!masterAuthCheck) {
                console.warn('[Sincronização SEMAC] ⚠️ ATENÇÃO: O masterClient NÃO tem sessão autenticada. Tabelas com RLS habilitado (processos, documentos, notificacoes) podem retornar 0 registros! A tabela autos_infracao tem RLS DESABILITADO, por isso funciona.');
            }

            // 1.1 Processos do Fiscal
            let procsFiscal = [];
            if (allUserIds.length > 0) {
                const { data: p1, error: errP1 } = await executarQueryComRetry(() =>
                    masterClient
                        .from('processos')
                        .select('id, numero_processo, fiscal_id, etapa_atual_id, dados, possui_decreto, created_at, updated_at')
                        .in('fiscal_id', allUserIds)
                );
                if (errP1) console.error('[Sincronização SEMAC] ❌ ERRO ao buscar processos:', errP1.message, errP1);
                if (p1) procsFiscal = p1;
                console.log(`[Sincronização SEMAC] 📋 processos (fiscal_id IN [${allUserIds.join(', ')}]): ${(p1 || []).length} registros`);
            }

            const procIdsDoFiscal = (procsFiscal || []).map(p => p.id).filter(Boolean);

            // 1.2 Documentos
            let docsUser = [], docsProc = [];
            if (allUserIds.length > 0) {
                const { data: d1, error: errD1 } = await executarQueryComRetry(() =>
                    masterClient
                        .from('documentos')
                        .select('id, processo_id, tipo, numero_sequencial, url, created_at, nome_arquivo, usuario_id')
                        .in('usuario_id', allUserIds)
                );
                if (errD1) console.error('[Sincronização SEMAC] ❌ ERRO ao buscar documentos (usuario_id):', errD1.message, errD1);
                if (d1) docsUser = d1;
                console.log(`[Sincronização SEMAC] 📄 documentos (usuario_id IN [...]): ${(d1 || []).length} registros`);
            }
            if (procIdsDoFiscal.length > 0) {
                const { data: d2, error: errD2 } = await executarQueryComRetry(() =>
                    masterClient
                        .from('documentos')
                        .select('id, processo_id, tipo, numero_sequencial, url, created_at, nome_arquivo, usuario_id')
                        .in('processo_id', procIdsDoFiscal)
                );
                if (errD2) console.error('[Sincronização SEMAC] ❌ ERRO ao buscar documentos (processo_id):', errD2.message, errD2);
                if (d2) docsProc = d2;
                console.log(`[Sincronização SEMAC] 📄 documentos (processo_id IN [...]): ${(d2 || []).length} registros`);
            }
            const docsMap = {};
            [...docsUser, ...docsProc].forEach(d => { if (d && d.id) docsMap[d.id] = d; });
            const documentos = Object.values(docsMap);

            // 1.3 Autos de Infração (Tabela autos_infracao) - RLS DESABILITADO
            let autosUser = [], autosProc = [];
            if (allUserIds.length > 0) {
                const { data: a1, error: errA1 } = await executarQueryComRetry(() =>
                    masterClient
                        .from('autos_infracao')
                        .select('id, processo_id, notificacao_id, usuario_id, numero, status, created_at, dados')
                        .in('usuario_id', allUserIds)
                );
                if (errA1) console.error('[Sincronização SEMAC] ❌ ERRO ao buscar autos_infracao (usuario_id):', errA1.message, errA1);
                if (a1) autosUser = a1;
                console.log(`[Sincronização SEMAC] ⚖️ autos_infracao (usuario_id IN [...]): ${(a1 || []).length} registros`);
            }
            if (procIdsDoFiscal.length > 0) {
                const { data: a2, error: errA2 } = await executarQueryComRetry(() =>
                    masterClient
                        .from('autos_infracao')
                        .select('id, processo_id, notificacao_id, usuario_id, numero, status, created_at, dados')
                        .in('processo_id', procIdsDoFiscal)
                );
                if (errA2) console.error('[Sincronização SEMAC] ❌ ERRO ao buscar autos_infracao (processo_id):', errA2.message, errA2);
                if (a2) autosProc = a2;
                console.log(`[Sincronização SEMAC] ⚖️ autos_infracao (processo_id IN [...]): ${(a2 || []).length} registros`);
            }
            const autosMap = {};
            [...autosUser, ...autosProc].forEach(a => { if (a && a.id) autosMap[a.id] = a; });
            const autosTabela = Object.values(autosMap);

            // 1.4 Notificações (Tabela notificacoes)
            let notificacoes = [];
            if (procIdsDoFiscal.length > 0) {
                const { data: notifs, error: errN } = await executarQueryComRetry(() =>
                    masterClient
                        .from('notificacoes')
                        .select('id, numero, descricao, status, created_at, processo_id')
                        .in('processo_id', procIdsDoFiscal)
                );
                if (errN) console.error('[Sincronização SEMAC] ❌ ERRO ao buscar notificacoes:', errN.message, errN);
                if (notifs) notificacoes = notifs;
                console.log(`[Sincronização SEMAC] 📬 notificacoes (processo_id IN [...]): ${(notifs || []).length} registros`);
            }

            // Buscar processos faltantes vinculados a documentos, autos ou notificações
            const procIdsRelacionados = [...new Set([
                ...documentos.map(d => d.processo_id),
                ...autosTabela.map(a => a.processo_id),
                ...notificacoes.map(n => n.processo_id)
            ].filter(Boolean))];

            const procIdsFaltantes = procIdsRelacionados.filter(id => !procIdsDoFiscal.includes(id));
            if (procIdsFaltantes.length > 0) {
                console.log(`[Sincronização SEMAC] 🔗 Buscando ${procIdsFaltantes.length} processos faltantes vinculados a autos/docs/notifs...`);
                const { data: pExtra, error: errPE } = await executarQueryComRetry(() =>
                    masterClient
                        .from('processos')
                        .select('id, numero_processo, fiscal_id, etapa_atual_id, dados, possui_decreto, created_at, updated_at')
                        .in('id', procIdsFaltantes)
                );
                if (errPE) console.error('[Sincronização SEMAC] ❌ ERRO ao buscar processos faltantes:', errPE.message, errPE);
                if (pExtra) {
                    console.log(`[Sincronização SEMAC] 📋 processos faltantes encontrados: ${pExtra.length}`);
                    pExtra.forEach(p => { if (p && p.id) procsFiscal.push(p); });
                }
            }

            const processosPorId = {};
            procsFiscal.forEach(p => { if (p && p.id) processosPorId[p.id] = p; });
            const todosProcessosDoFiscal = Object.values(processosPorId);

            // LOG DE DIAGNÓSTICO VISÍVEL NO CONSOLE
            console.log(`[Sincronização SEMAC] 🔍 DIAGNÓSTICO DAS TABELAS DO FLUXOGRAMA (Fiscal: ${fiscalNome}):`);
            console.table({
                '1. Tabela processos (RLS=ON)': { Encontrados: todosProcessosDoFiscal.length, RLS: 'HABILITADO' },
                '2. Tabela documentos (RLS=ON)': { Encontrados: documentos.length, RLS: 'HABILITADO' },
                '3. Tabela autos_infracao (RLS=OFF)': { Encontrados: autosTabela.length, RLS: 'DESABILITADO' },
                '4. Tabela notificacoes (RLS=ON)': { Encontrados: notificacoes.length, RLS: 'HABILITADO' }
            });

            if (todosProcessosDoFiscal.length === 0 && documentos.length === 0 && autosTabela.length > 0) {
                console.error('🚨🚨🚨 [Sincronização SEMAC] PROBLEMA DE RLS DETECTADO! A tabela autos_infracao (RLS=OFF) retorna dados, mas processos e documentos (RLS=ON) não. O masterClient está usando a anon key SEM sessão autenticada, e as políticas RLS bloqueiam o acesso. SOLUÇÃO: No banco Fluxograma, execute:\n' +
                    "ALTER TABLE processos DISABLE ROW LEVEL SECURITY;\n" +
                    "ALTER TABLE documentos DISABLE ROW LEVEL SECURITY;\n" +
                    "ALTER TABLE notificacoes DISABLE ROW LEVEL SECURITY;\n" +
                    "-- OU adicione políticas de leitura anônima:\n" +
                    "CREATE POLICY \"anon_read_processos\" ON processos FOR SELECT TO anon USING (true);\n" +
                    "CREATE POLICY \"anon_read_documentos\" ON documentos FOR SELECT TO anon USING (true);\n" +
                    "CREATE POLICY \"anon_read_notificacoes\" ON notificacoes FOR SELECT TO anon USING (true);\n" +
                    "CREATE POLICY \"anon_read_contribuintes\" ON contribuintes FOR SELECT TO anon USING (true);\n" +
                    "CREATE POLICY \"anon_read_imoveis\" ON imoveis FOR SELECT TO anon USING (true);");
            }

            // Coletar todos os processo_ids para contribuintes e imóveis
            const todosProcIdsColetados = [...new Set([
                ...todosProcessosDoFiscal.map(p => p.id),
                ...procIdsRelacionados
            ].filter(Boolean))];

            const contribuintesPorProcesso = {};
            const imoveisPorProcesso = {};

            if (todosProcIdsColetados.length > 0) {
                const { data: contribs } = await executarQueryComRetry(() =>
                    masterClient
                        .from('contribuintes')
                        .select('processo_id, nome, cpf_cnpj, bairro')
                        .in('processo_id', todosProcIdsColetados)
                );
                (contribs || []).forEach(c => {
                    if (!contribuintesPorProcesso[c.processo_id]) contribuintesPorProcesso[c.processo_id] = c;
                });

                const { data: imvs } = await executarQueryComRetry(() =>
                    masterClient
                        .from('imoveis')
                        .select('processo_id, bairro, inscricao_imovel')
                        .in('processo_id', todosProcIdsColetados)
                );
                (imvs || []).forEach(i => {
                    if (!imoveisPorProcesso[i.processo_id]) imoveisPorProcesso[i.processo_id] = i;
                });
            }

            // Mapear URLs de documentos por processo
            const docAutoUrlPorProcesso = {};
            const docQualquerUrlPorProcesso = {};

            (documentos || []).forEach(d => {
                const u = extrairUrlCloudinary(d.url);
                if (u && d.processo_id) {
                    const tLower = (d.tipo || '').toLowerCase();
                    if (tLower.includes('auto') || tLower.includes('infra')) {
                        if (!docAutoUrlPorProcesso[d.processo_id]) docAutoUrlPorProcesso[d.processo_id] = u;
                    }
                    if (!docQualquerUrlPorProcesso[d.processo_id]) docQualquerUrlPorProcesso[d.processo_id] = u;
                }
            });

            // ------------------------------------------------------------------
            // PASSO 2: SINCRONIZAR TABELA DOCUMENTOS
            // ------------------------------------------------------------------
            for (const doc of (documentos || [])) {
                const tipoLower = (doc.tipo || '').toLowerCase().trim();
                const numSeq = doc.numero_sequencial || 'S/N';
                const procDoDoc = processosPorId[doc.processo_id] || {};
                const dadosProc = procDoDoc.dados || {};
                const docUrl = extrairUrlCloudinary(
                    doc.url,
                    docAutoUrlPorProcesso[doc.processo_id],
                    docQualquerUrlPorProcesso[doc.processo_id],
                    dadosProc.auto_infracao,
                    dadosProc.etapa14,
                    dadosProc.etapa15,
                    dadosProc
                );
                const createdAt = doc.created_at;
                const contribuinte = contribuintesPorProcesso[doc.processo_id] || {};
                const imovel = imoveisPorProcesso[doc.processo_id] || {};
                const nomeContribuinte = contribuinte.nome || dadosProc.contribuinte?.nome || '';
                const bairroImovel = imovel.bairro || contribuinte.bairro || dadosProc.imovel?.bairro || '';
                const dataFormatadaBR = createdAt ? new Date(createdAt).toISOString().split('T')[0] : '';
                const elegivel = verificarElegibilidadePontuacao(createdAt);

                // --- Auto de Infração ---
                if (tipoLower.includes('auto de infração') || tipoLower.includes('auto de infracao') || (tipoLower.includes('auto') && tipoLower.includes('infra'))) {
                    const ptsCP = elegivel.pontuar ? 5 : 0;
                    const camposCP = {
                        doc_id: doc.id,
                        n_auto: numSeq,
                        nome: nomeContribuinte,
                        bairro: bairroImovel,
                        motivo: doc.nome_arquivo || dadosProc.motivo || dadosProc.descricao || '',
                        data: dataFormatadaBR,
                        anexo_pdf: docUrl,
                        _created_at: createdAt
                    };
                    if (await inserirControleProcessual(semacClient, semacUserId, fiscalNome, '1.2', 'Controle Processual: Auto de Infração', numSeq, ptsCP, camposCP)) {
                        inseridosControle++;
                    }

                    if (elegivel.pontuar) {
                        const camposRP = {
                            doc_id: doc.id,
                            n_auto: numSeq,
                            descricao: doc.nome_arquivo || dadosProc.motivo || dadosProc.descricao || nomeContribuinte || 'Expedição Automática',
                            data: dataFormatadaBR,
                            anexo_pdf: docUrl,
                            _created_at: createdAt
                        };
                        if (await inserirRegistroProdutividade(semacClient, semacUserId, '16', 'Autos de Infração expedidos', 30, camposRP)) {
                            inseridosProdutividade++;
                        }
                    }
                }

                // --- Notificação Preliminar ---
                else if (tipoLower.includes('notific')) {
                    const ptsCP = elegivel.pontuar ? 5 : 0;
                    const camposCP = {
                        doc_id: doc.id,
                        n_notificacao: numSeq,
                        nome: nomeContribuinte,
                        n_inscricao: contribuinte.cpf_cnpj || imovel.inscricao_imovel || '',
                        bairro: bairroImovel,
                        motivo: doc.nome_arquivo || dadosProc.motivo || dadosProc.descricao || '',
                        anexo_pdf: docUrl,
                        _created_at: createdAt
                    };
                    if (await inserirControleProcessual(semacClient, semacUserId, fiscalNome, '1.1', 'Controle Processual: Notificação Preliminar', numSeq, ptsCP, camposCP)) {
                        inseridosControle++;
                    }

                    if (elegivel.pontuar) {
                        const camposRP = {
                            doc_id: doc.id,
                            n_notificacao: numSeq,
                            descricao: doc.nome_arquivo || dadosProc.motivo || dadosProc.descricao || nomeContribuinte || 'Notificação Preliminar',
                            data: dataFormatadaBR,
                            anexo_pdf: docUrl,
                            _created_at: createdAt
                        };
                        if (await inserirRegistroProdutividade(semacClient, semacUserId, '14', 'Notificação Preliminar expedidos', 20, camposRP)) {
                            inseridosProdutividade++;
                        }
                    }
                }

                // --- Relatório Fiscal ---
                else if (tipoLower.includes('relatório') || tipoLower.includes('relatorio')) {
                    const ptsCP = elegivel.pontuar ? 10 : 0;
                    const camposCP = {
                        doc_id: doc.id,
                        n_relatorio: numSeq,
                        atendimento: nomeContribuinte || doc.nome_arquivo || numSeq,
                        bairro: bairroImovel,
                        data: dataFormatadaBR,
                        anexo_pdf: docUrl,
                        _created_at: createdAt
                    };
                    if (await inserirControleProcessual(semacClient, semacUserId, fiscalNome, '1.5', 'Controle Processual: Relatório', numSeq, ptsCP, camposCP)) {
                        inseridosControle++;
                    }
                }

                // --- Réplica ---
                else if (tipoLower.includes('réplica') || tipoLower.includes('replica')) {
                    const ptsCP = elegivel.pontuar ? 50 : 0;
                    const camposCP = {
                        doc_id: doc.id,
                        n_replica: numSeq,
                        nome: nomeContribuinte,
                        bairro: bairroImovel,
                        data: dataFormatadaBR,
                        anexo_pdf: docUrl,
                        _created_at: createdAt
                    };
                    if (await inserirControleProcessual(semacClient, semacUserId, fiscalNome, '1.7', 'Réplica', numSeq, ptsCP, camposCP)) {
                        inseridosControle++;
                    }
                }

                // --- Certidão ---
                else if (tipoLower.includes('certidão') || tipoLower.includes('certidao')) {
                    const ptsCP = elegivel.pontuar ? 50 : 0;
                    const camposCP = {
                        doc_id: doc.id,
                        n_certidao: numSeq,
                        nome: nomeContribuinte,
                        bairro: bairroImovel,
                        data: dataFormatadaBR,
                        anexo_pdf: docUrl,
                        _created_at: createdAt
                    };
                    if (await inserirControleProcessual(semacClient, semacUserId, fiscalNome, '1.8', 'Certidão', numSeq, ptsCP, camposCP)) {
                        inseridosControle++;
                    }
                }
            }

            // ------------------------------------------------------------------
            // PASSO 2.5: SINCRONIZAR TABELA AUTOS_INFRACAO
            // ------------------------------------------------------------------
            for (const auto of (autosTabela || [])) {
                const numSeq = auto.numero || 'S/N';
                const createdAt = auto.created_at;
                const contribuinte = contribuintesPorProcesso[auto.processo_id] || {};
                const imovel = imoveisPorProcesso[auto.processo_id] || {};
                const nomeContribuinte = contribuinte.nome || auto.dados?.contribuinte?.nome || '';
                const bairroImovel = imovel.bairro || contribuinte.bairro || auto.dados?.imovel?.bairro || '';
                const dataFormatadaBR = createdAt ? new Date(createdAt).toISOString().split('T')[0] : '';
                const procDoAuto = processosPorId[auto.processo_id] || {};
                const dadosProcAuto = procDoAuto.dados || {};
                const autoUrl = extrairUrlCloudinary(
                    auto.dados,
                    auto.url,
                    docAutoUrlPorProcesso[auto.processo_id],
                    docQualquerUrlPorProcesso[auto.processo_id],
                    dadosProcAuto.auto_infracao,
                    dadosProcAuto.etapa14,
                    dadosProcAuto.etapa15,
                    dadosProcAuto
                );

                const elegivel = verificarElegibilidadePontuacao(createdAt);
                const ptsCP = elegivel.pontuar ? 5 : 0;

                const camposCP = {
                    auto_id: auto.id,
                    n_auto: numSeq,
                    nome: nomeContribuinte,
                    bairro: bairroImovel,
                    motivo: auto.dados?.motivo || auto.dados?.descricao || '',
                    data: dataFormatadaBR,
                    anexo_pdf: autoUrl,
                    _created_at: createdAt
                };

                if (await inserirControleProcessual(semacClient, semacUserId, fiscalNome, '1.2', 'Controle Processual: Auto de Infração', numSeq, ptsCP, camposCP)) {
                    inseridosControle++;
                }

                if (elegivel.pontuar) {
                    const camposRP = {
                        auto_id: auto.id,
                        n_auto: numSeq,
                        descricao: auto.dados?.motivo || auto.dados?.descricao || nomeContribuinte || 'Expedição Automática',
                        data: dataFormatadaBR,
                        anexo_pdf: autoUrl,
                        _created_at: createdAt
                    };
                    if (await inserirRegistroProdutividade(semacClient, semacUserId, '16', 'Autos de Infração expedidos', 30, camposRP)) {
                        inseridosProdutividade++;
                    }
                }
            }

            // ------------------------------------------------------------------
            // PASSO 2.6: SINCRONIZAR TABELA NOTIFICACOES
            // ------------------------------------------------------------------
            for (const notif of (notificacoes || [])) {
                const statusLower = String(notif.status || '').toLowerCase().trim();
                const isAutoInfracao = statusLower.includes('auto_infracao')
                    || statusLower.includes('auto_infração')
                    || statusLower.includes('auto de infração')
                    || statusLower.includes('auto de infracao');

                if (isAutoInfracao) continue;

                const contribuinte = contribuintesPorProcesso[notif.processo_id] || {};
                const imovel = imoveisPorProcesso[notif.processo_id] || {};
                const createdAt = notif.created_at;
                const dataFormatadaBR = createdAt ? new Date(createdAt).toISOString().split('T')[0] : '';
                const procDoNotif = processosPorId[notif.processo_id] || {};
                const dadosProcNotif = procDoNotif.dados || {};
                const notifUrl = extrairUrlCloudinary(
                    docQualquerUrlPorProcesso[notif.processo_id],
                    dadosProcNotif
                );

                const elegivel = verificarElegibilidadePontuacao(createdAt);
                const ptsCP = elegivel.pontuar ? 5 : 0;

                const camposCP = {
                    notif_id: notif.id,
                    n_notificacao: notif.numero || 'S/N',
                    nome: contribuinte.nome || '',
                    n_inscricao: contribuinte.cpf_cnpj || imovel.inscricao_imovel || '',
                    bairro: imovel.bairro || contribuinte.bairro || '',
                    motivo: notif.descricao || '',
                    anexo_pdf: notifUrl,
                    _created_at: createdAt
                };
                if (await inserirControleProcessual(semacClient, semacUserId, fiscalNome, '1.1', 'Controle Processual: Notificação Preliminar', notif.numero || 'S/N', ptsCP, camposCP)) {
                    inseridosControle++;
                }

                if (elegivel.pontuar) {
                    const camposRP = {
                        notif_id: notif.id,
                        n_notificacao: notif.numero || 'S/N',
                        descricao: notif.descricao || '',
                        data: dataFormatadaBR,
                        anexo_pdf: notifUrl,
                        _created_at: createdAt
                    };
                    if (await inserirRegistroProdutividade(semacClient, semacUserId, '14', 'Notificação Preliminar expedidos', 20, camposRP)) {
                        inseridosProdutividade++;
                    }
                }
            }

            // ------------------------------------------------------------------
            // PASSO 3: Encaminhamento para Dívida Ativa (etapa >= 15)
            // Sincroniza processos que atingiram etapa >= 15 no Fluxograma
            // Pontua apenas para o criador do processo (fiscal_id)
            // ------------------------------------------------------------------
            console.log(`[Sincronização SEMAC] Buscando processos Dívida Ativa (etapa >= 15)...`);

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

            // Filtrar no JS: etapa >= 15 (sem bloquear por data)
            const processosDividaAtiva = (todosProcessosDoFiscal || []).filter(p => {
                const etapaNum = extrairEtapaNumero(p);
                return etapaNum >= 15;
            });

            console.log(`[Sincronização SEMAC] Total processos do fiscal: ${todosProcessosDoFiscal.length}, com etapa >= 15: ${processosDividaAtiva.length}`);

            if (processosDividaAtiva.length > 0) {
                const procIdsDA = processosDividaAtiva.map(p => p.id);

                // Buscar documentos dos processos de Dívida Ativa
                const docsDAPorProcesso = {};
                const { data: docsDA } = await masterClient
                    .from('documentos')
                    .select('processo_id, numero_sequencial, tipo, url')
                    .in('processo_id', procIdsDA);

                (docsDA || []).forEach(d => {
                    const tLower = (d.tipo || '').toLowerCase();
                    if (tLower.includes('auto') || tLower.includes('infra') || !docsDAPorProcesso[d.processo_id]) {
                        docsDAPorProcesso[d.processo_id] = d;
                    }
                });

                for (const proc of processosDividaAtiva) {
                    const autoDoc = docsDAPorProcesso[proc.id] || {};
                    const contribDA = contribuintesPorProcesso[proc.id] || {};
                    const imovelDA = imoveisPorProcesso[proc.id] || {};
                    const dadosProc = proc.dados || {};

                    // Extrair dados relevantes conforme especificação
                    const numAuto = autoDoc.numero_sequencial
                        || dadosProc.numero_auto_infracao
                        || dadosProc.etapa14?.numero_auto_infracao
                        || proc.numero_processo
                        || 'S/N';
                    const nomeAutuado = contribDA.nome
                        || dadosProc.contribuinte?.nome
                        || '';
                    const cpfAutuado = contribDA.cpf_cnpj
                        || dadosProc.contribuinte?.cpf_cnpj
                        || '';
                    const advogadoAutuado = contribDA.advogado
                        || dadosProc.advogado
                        || dadosProc.contribuinte?.advogado
                        || dadosProc.etapa14?.advogado
                        || dadosProc.etapa15?.advogado
                        || 'S/A';
                    const bairroDA = imovelDA.bairro
                        || contribDA.bairro
                        || dadosProc.imovel?.bairro
                        || '';
                    const anexoPdf = autoDoc.url
                        || dadosProc.anexo_pdf
                        || dadosProc.url_capa
                        || dadosProc.capa_pdf
                        || dadosProc.etapa15?.anexo_pdf
                        || '';

                    const dataDA = proc.created_at;
                    const dataFormatadaBR = dataDA ? new Date(dataDA).toISOString().split('T')[0] : '';
                    const elegivel = verificarElegibilidadePontuacao(dataDA);
                    const ptsCP = elegivel.pontuar ? 100 : 0;

                    const camposCP = {
                        proc_id: proc.id,
                        n_auto: numAuto,
                        nome: nomeAutuado,
                        cpf: cpfAutuado,
                        advogado: advogadoAutuado,
                        bairro: bairroDA,
                        numero_processo: proc.numero_processo || '',
                        etapa_atual: extrairEtapaNumero(proc),
                        data: dataFormatadaBR,
                        anexo_pdf: anexoPdf,
                        _created_at: dataDA
                    };

                    const numSeqDA = proc.numero_processo || numAuto || 'S/N';

                    if (await inserirControleProcessual(
                        semacClient,
                        semacUserId,
                        fiscalNome,
                        '11',
                        'Montagem de processo para encaminhamento, exclusivamente para inscrição em dívida ativa',
                        numSeqDA,
                        ptsCP,
                        camposCP
                    )) {
                        inseridosControle++;
                        console.log(`[Sincronização SEMAC] ✅ Dívida Ativa registrada: ${nomeAutuado || numSeqDA} (Processo: ${proc.numero_processo}) - Pontuação: ${ptsCP}`);
                    }
                }
            } else {
                console.log(`[Sincronização SEMAC] ℹ️ Nenhum processo com etapa >= 15 encontrado.`);
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
    window.sincronizarDadosCompleto = executarSincronizacaoDiaria;

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
