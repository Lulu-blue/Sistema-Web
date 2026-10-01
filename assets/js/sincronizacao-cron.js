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
     * Verifica se o cargo (profiles.role no SEMAC) é elegível para a sincronização automática
     * de produtividade (somente Fiscais de Posturas e de Meio Ambiente possuem contrapartida
     * de documentos no banco Fluxograma).
     */
    function ehCargoFiscalSincronizavel(role) {
        if (!role) return false;
        const normalizado = role
            .normalize('NFD').replace(/\p{Diacritic}/gu, '')
            .toLowerCase().trim();
        return normalizado === 'fiscal'
            || normalizado.includes('fiscal de postura')
            || normalizado.includes('fiscal de meio ambiente');
    }

    /**
     * Normaliza o número sequencial (ex: "0053/2026" -> "53/2026") para servir de chave de
     * correlação ENTRE tabelas diferentes do Fluxograma (documentos / autos_infracao / notificacoes)
     * que podem descrever o mesmo evento real com formatação ligeiramente diferente.
     * Retorna null para valores não confiáveis (vazio, "S/N"), caso em que a deduplicação cai
     * para o id interno da tabela de origem (doc_id/auto_id/notif_id/proc_id).
     */
    function normalizarNumeroSequencial(numero) {
        if (!numero) return null;
        const str = String(numero).trim();
        if (!str || str.toUpperCase() === 'S/N') return null;
        const partes = str.split('/');
        if (partes.length === 2) {
            const num = partes[0].replace(/\D/g, '').replace(/^0+(?=\d)/, '');
            const ano = partes[1].replace(/\D/g, '');
            if (num) return `${num}/${ano}`;
        }
        const soDigitos = str.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
        return soDigitos || str.toLowerCase();
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
     * Verifica se o fiscal já rodou a "Limpeza Geral" (Home) para o mês anterior ao atual: essa
     * ação apaga permanentemente os registros de `registros_produtividade` de meses passados. Se
     * não sobrou NENHUM registro do fiscal no mês anterior, é sinal de que a limpeza já foi feita
     * — nesse caso a tolerância de reabertura do mês anterior NÃO deve mais se aplicar, senão a
     * sincronização reinsere pontos que o fiscal já fechou/zerou deliberadamente.
     */
    async function limpezaGeralJaFeitaMesAnterior(semacClient, userId) {
        if (!userId) return false;
        const hoje = new Date();
        const anoRef = hoje.getMonth() === 0 ? hoje.getFullYear() - 1 : hoje.getFullYear();
        const mesRef = hoje.getMonth() === 0 ? 11 : hoje.getMonth() - 1; // 0-indexed
        const inicioMesAnterior = new Date(anoRef, mesRef, 1, 0, 0, 0, 0).toISOString();
        const fimMesAnterior = new Date(anoRef, mesRef + 1, 0, 23, 59, 59, 999).toISOString();

        const { count, error } = await semacClient
            .from('registros_produtividade')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gte('created_at', inicioMesAnterior)
            .lte('created_at', fimMesAnterior);

        if (error) {
            console.warn('[Sincronização SEMAC] Erro ao verificar Limpeza Geral do mês anterior:', error.message);
            return false; // Em caso de erro, não bloquear a tolerância (comportamento conservador)
        }
        return (count || 0) === 0;
    }

    /**
     * Verifica a elegibilidade para pontuação e inserção nos registros de produtividade:
     * - Mês atual: Pontuação total + Registra em RP.
     * - Mês anterior (1 mês atrás): Pontuação total + Registra em RP, mas SOMENTE até o dia 3 do
     *   mês vigente E somente se o fiscal ainda não tiver rodado a Limpeza Geral daquele mês.
     * - Mês anterior (após dia 3, ou com Limpeza Geral já feita) ou 2+ meses atrás: Apenas insere
     *   no Controle Processual com pontuação 0 (não insere em RP).
     */
    function verificarElegibilidadePontuacao(dataInput, limpezaMesAnteriorFeita) {
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
            if (limpezaMesAnteriorFeita) {
                return { pontuar: false, diferencaMeses, motivo: 'Limpeza Geral do mês anterior já realizada pelo fiscal' };
            }
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

    // Registra se alguma consulta ao Fluxograma falhou por tempo esgotado (Postgres 57014).
    // Serve para não acusar "problema de RLS" quando na verdade a consulta só demorou demais.
    let houveTimeoutNoFluxograma = false;

    function ehErroDeTimeout(error) {
        if (!error) return false;
        return error.code === '57014' || String(error.message || '').includes('statement timeout');
    }

    // =============================================
    // SITUAÇÃO DO PROCESSO NO FLUXOGRAMA
    // =============================================
    // processos.status assume três valores no Fluxograma:
    //   'auto_infracao'         → virou Auto de Infração (processos por decreto nascem assim)
    //   'notificacao_preliminar'→ ainda é Notificação Preliminar, não virou AI
    //   'cancelado'             → processo cancelado
    function statusDoProcesso(proc) {
        return String(proc?.status || '').toLowerCase().trim();
    }

    /**
     * Processo por decreto: nasce direto como Auto de Infração, então a Notificação
     * Preliminar nunca existiu de fato e não deve ser puxada. Notificações legítimas que
     * viraram AI depois já foram capturadas numa sincronização anterior, porque há um
     * intervalo entre a expedição da NP e a conversão em AI.
     */
    function processoPorDecreto(proc) {
        if (!proc) return false;
        return proc.possui_decreto === true || statusDoProcesso(proc) === 'auto_infracao';
    }

    /** Processo cancelado: não gera pontuação nenhuma. */
    function processoCancelado(proc) {
        return statusDoProcesso(proc).includes('cancelad');
    }

    /** Processo ainda em Notificação Preliminar: não chegou a virar Auto de Infração. */
    function processoAindaEmNotificacao(proc) {
        return statusDoProcesso(proc) === 'notificacao_preliminar';
    }

    function dividirEmLotes(lista, tamanho) {
        const lotes = [];
        for (let i = 0; i < lista.length; i += tamanho) {
            lotes.push(lista.slice(i, i + tamanho));
        }
        return lotes;
    }

    /**
     * Busca linhas do Fluxograma em lotes pequenos, por ID.
     *
     * Algumas linhas guardam vários MB em base64 (processos.dados e documentos.url),
     * então uma consulta única com todos os IDs estoura o statement timeout do Postgres
     * (erro 57014 → HTTP 500). Ao dar timeout, o lote é dividido ao meio e tentado de novo;
     * uma linha sozinha que ainda falhe é pulada com aviso, para não travar a sincronização
     * inteira por causa de um anexo gigante.
     */
    // O cliente do Fluxograma é criado em protecao.js; aqui ele é resolvido sob demanda
    // porque estas funções auxiliares vivem fora de executarSincronizacaoDiaria().
    function obterMasterClient() {
        return window.supabaseMaster || (typeof supabaseMaster !== 'undefined' ? supabaseMaster : null);
    }

    async function buscarLinhasPorIds(tabela, colunas, ids, tamanhoLote = 4) {
        const resultado = [];
        const cliente = obterMasterClient();
        if (!cliente) {
            console.error('[Sincronização SEMAC] ❌ Cliente do Fluxograma indisponível.');
            return resultado;
        }

        const totalLotes = Math.ceil(ids.length / tamanhoLote);
        let loteAtual = 0;

        async function buscarLote(lote) {
            const { data, error } = await executarQueryComRetry(() =>
                cliente.from(tabela).select(colunas).in('id', lote)
            );

            if (!error) {
                (data || []).forEach(linha => { if (linha) resultado.push(linha); });
                return;
            }

            if (ehErroDeTimeout(error)) houveTimeoutNoFluxograma = true;

            // Qualquer falha (timeout do Postgres, 500 ou queda de conexão no meio do
            // download) é tratada do mesmo jeito: divide o lote e tenta de novo menor.
            if (lote.length === 1) {
                console.warn(`[Sincronização SEMAC] ⏱️ ${tabela}: registro ${lote[0]} ignorado (${error.message || error}). Provavelmente guarda um anexo em base64 grande demais.`);
                return;
            }

            const meio = Math.ceil(lote.length / 2);
            await buscarLote(lote.slice(0, meio));
            await buscarLote(lote.slice(meio));
        }

        for (const lote of dividirEmLotes(ids, tamanhoLote)) {
            loteAtual++;
            await buscarLote(lote);
            console.log(`[Sincronização SEMAC] 📦 ${tabela}: lote ${loteAtual}/${totalLotes} (${resultado.length}/${ids.length} registros lidos)`);
        }
        return resultado;
    }

    /**
     * Busca primeiro só os IDs (consulta leve, sem as colunas pesadas) e depois as linhas
     * completas em lotes. Retorna no mesmo formato do Supabase: { data, error }.
     */
    async function buscarEmLotesPorFiltro(tabela, colunas, campoFiltro, valores, tamanhoLote = 4) {
        if (!valores || valores.length === 0) return { data: [], error: null };

        const cliente = obterMasterClient();
        if (!cliente) return { data: null, error: { message: 'Cliente do Fluxograma indisponível' } };

        const { data: linhasId, error: erroIds } = await executarQueryComRetry(() =>
            cliente.from(tabela).select('id').in(campoFiltro, valores)
        );

        if (erroIds) {
            if (ehErroDeTimeout(erroIds)) houveTimeoutNoFluxograma = true;
            return { data: null, error: erroIds };
        }

        const ids = (linhasId || []).map(l => l.id).filter(Boolean);
        if (ids.length === 0) return { data: [], error: null };

        return { data: await buscarLinhasPorIds(tabela, colunas, ids, tamanhoLote), error: null };
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
        const chaveUnica = campos.doc_id || campos.notif_id || campos.auto_id || campos.proc_id;
        const campoChave = campos.doc_id ? 'doc_id' : (campos.notif_id ? 'notif_id' : (campos.auto_id ? 'auto_id' : 'proc_id'));

        // Chave de correlação usada pela constraint UNIQUE do banco (user_id, categoria_id, origem_unica).
        // Prioriza o número sequencial normalizado (funciona mesmo quando o MESMO evento real aparece
        // em tabelas diferentes do Fluxograma com ids internos distintos, ex: documentos x autos_infracao);
        // cai para o id interno da tabela de origem quando não há número sequencial confiável.
        const origemUnica = normalizarNumeroSequencial(numSeq) || (chaveUnica ? `${campoChave}:${chaveUnica}` : null);

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

        // 4. Reconciliar com um registro anterior que ficou sem número (ver função)
        const campoNumeroCP = campos.n_notificacao !== undefined ? 'n_notificacao'
            : (campos.n_auto !== undefined ? 'n_auto' : null);
        if (campoNumeroCP && await reconciliarRegistroSemNumero(semacClient, 'controle_processual', userId, catId, campoNumeroCP, numSeq, campos)) {
            return false;
        }

        // Upsert com ON CONFLICT na constraint UNIQUE(user_id, categoria_id, origem_unica): mesmo que
        // duas execuções concorrentes (abas/dispositivos diferentes) passem pelas checagens acima ao
        // mesmo tempo, o banco garante que só uma delas efetivamente insere a linha.
        const { data: linhaInserida, error } = await semacClient
            .from('controle_processual')
            .upsert([{
                user_id: userId,
                fiscal_nome: fiscalNome,
                categoria_id: catId,
                categoria_nome: catNome,
                numero_sequencial: numSeq || 'S/N',
                pontuacao: pontuacao,
                campos: campos,
                origem_unica: origemUnica,
                created_at: campos._created_at || new Date().toISOString()
            }], { onConflict: 'user_id,categoria_id,origem_unica', ignoreDuplicates: true })
            .select('id');

        if (error) {
            console.warn(`[Sincronização] Erro ao inserir CP (${catId}):`, error.message);
            return false;
        }
        return !!(linhaInserida && linhaInserida.length > 0);
    }

    /**
     * Resolve o caso do registro que ficou com "S/N".
     *
     * O número nem sempre vem na primeira sincronização (o documento é criado antes da
     * numeração). Antes, a sincronização seguinte via o número novo como um evento diferente
     * e criava uma segunda linha — uma com S/N e outra numerada, para o mesmo fato.
     *
     * Aqui as duas linhas são reconciliadas pelo processo de origem (proc_id):
     *   - chegou o número e existe linha com S/N  → completa a linha existente;
     *   - chegou S/N e já existe linha numerada   → não cria nada.
     *
     * Retorna true quando não se deve inserir nada novo.
     */
    async function reconciliarRegistroSemNumero(semacClient, tabela, userId, catId, campoNumero, numSeq, campos) {
        const procId = campos.proc_id;
        if (!procId) return false;

        const { data: existentes } = await semacClient
            .from(tabela)
            .select('id, campos' + (tabela === 'controle_processual' ? ', numero_sequencial' : ''))
            .eq('user_id', userId)
            .eq('categoria_id', catId)
            .contains('campos', { proc_id: procId });

        if (!existentes || existentes.length === 0) return false;

        // Um processo pode, em tese, ter mais de um documento da mesma categoria. Nesse caso
        // não há como saber qual linha completar, então é melhor não mexer em nada.
        if (existentes.length > 1) {
            console.warn(`[Sincronização SEMAC] ⚠️ ${tabela} (${catId}): processo ${procId} tem ${existentes.length} registros; reconciliação de número ignorada por ambiguidade.`);
            return false;
        }

        const semNumero = numeroConfiavel => (existentes || []).find(linha => {
            const n = linha.campos?.[campoNumero] || linha.numero_sequencial;
            return numeroConfiavel ? (!n || String(n).toUpperCase() === 'S/N') : (n && String(n).toUpperCase() !== 'S/N');
        });

        const temNumeroNovo = numSeq && String(numSeq).toUpperCase() !== 'S/N';

        if (temNumeroNovo) {
            const linhaSemNumero = semNumero(true);
            if (!linhaSemNumero) return false;

            const novosCampos = { ...(linhaSemNumero.campos || {}), [campoNumero]: numSeq };
            if (campos.anexo_pdf) novosCampos.anexo_pdf = campos.anexo_pdf;

            const atualizacao = { campos: novosCampos };
            if (tabela === 'controle_processual') atualizacao.numero_sequencial = numSeq;

            await semacClient.from(tabela).update(atualizacao).eq('id', linhaSemNumero.id);
            console.log(`[Sincronização SEMAC] 🔢 ${tabela} (${catId}): registro que estava como S/N recebeu o número ${numSeq}.`);
            return true;
        }

        // Sem número agora, mas já existe a mesma coisa numerada: não duplicar.
        return !!semNumero(false);
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

        const chaveUnica = campos.doc_id || campos.notif_id || campos.auto_id || campos.proc_id;
        const campoChave = campos.doc_id ? 'doc_id' : (campos.notif_id ? 'notif_id' : (campos.auto_id ? 'auto_id' : 'proc_id'));

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

        // Mesma lógica de chave de correlação usada em inserirControleProcessual (ver comentário lá).
        const origemUnica = normalizarNumeroSequencial(numSeqRP) || (chaveUnica ? `${campoChave}:${chaveUnica}` : null);

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

        // Reconciliar com um registro anterior que ficou sem número (ver função)
        const campoNumeroRP = campos.n_notificacao !== undefined ? 'n_notificacao'
            : (campos.n_auto !== undefined ? 'n_auto' : null);
        if (campoNumeroRP && await reconciliarRegistroSemNumero(semacClient, 'registros_produtividade', userId, catId, campoNumeroRP, numSeqRP, campos)) {
            return false;
        }

        // Upsert com ON CONFLICT na constraint UNIQUE(user_id, categoria_id, origem_unica) — mesma
        // proteção contra corrida descrita em inserirControleProcessual.
        const { data: linhaInserida, error } = await semacClient
            .from('registros_produtividade')
            .upsert([{
                user_id: userId,
                categoria_id: catId,
                categoria_nome: catNome,
                pontuacao: pontuacao,
                campos: campos,
                origem_unica: origemUnica,
                created_at: campos._created_at || new Date().toISOString()
            }], { onConflict: 'user_id,categoria_id,origem_unica', ignoreDuplicates: true })
            .select('id');

        if (error) {
            console.warn(`[Sincronização] Erro ao inserir RP (${catId}):`, error.message);
            return false;
        }
        return !!(linhaInserida && linhaInserida.length > 0);
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
            // PASSO 1: Identificar o usuário no Fluxograma via Auth ID / CPF / Email (nunca por nome)
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
                    .select('id, cpf, full_name, email_real, role')
                    .eq('id', authUser.id)
                    .maybeSingle();
                semacPerfil = pSemac;
            } catch (e) {
                console.warn('[Sincronização SEMAC] Erro ao buscar perfil SEMAC:', e);
            }

            // Esta sincronização só se aplica a Fiscais (os únicos cargos com contrapartida
            // de documentos no banco Fluxograma). Gerentes, Diretores, Secretário(a) etc. nunca
            // devem disparar a busca no Fluxograma.
            if (!ehCargoFiscalSincronizavel(semacPerfil?.role)) {
                console.log(`[Sincronização SEMAC] Cargo "${semacPerfil?.role || 'desconhecido'}" não é Fiscal de Posturas/Meio Ambiente. Sincronização ignorada para este usuário.`);
                return { sucesso: true, bloqueadoPorCargo: true, inseridosControle: 0, inseridosProdutividade: 0 };
            }

            const userEmail = authUser.email || semacPerfil?.email_real || '';
            const cpfDoEmail = extrairCpfDoEmail(userEmail);
            const cpfDoPerfil = semacPerfil?.cpf ? String(semacPerfil.cpf).replace(/\D/g, '') : null;
            const cpfLimpo = cpfDoPerfil && cpfDoPerfil.length >= 11 ? cpfDoPerfil : cpfDoEmail;
            const cpfFormatado = cpfLimpo ? formatarCpf(cpfLimpo) : null;
            const userNome = semacPerfil?.full_name || authUser.user_metadata?.full_name || authUser.user_metadata?.nome || '';

            console.log(`[Sincronização SEMAC] Tentando identificar usuário (Email: ${userEmail}, CPF: ${cpfLimpo || 'N/A'}, Nome: ${userNome || 'N/A'})...`);

            // Montar condições de busca no Fluxograma (profiles).
            // Identificação feita SOMENTE por identificadores únicos e confiáveis (auth_id, CPF, e-mail).
            // Um fallback por nome (ilike) foi removido deliberadamente: além de falhar com diferenças
            // de acentuação (ex: "José" x "Jose"), corria o risco de casar com MAIS DE UM perfil por
            // nome parecido, misturando/duplicando documentos entre fiscais diferentes.
            let perfisFluxograma = [];

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

            if (perfisFluxograma.length === 0) {
                console.warn(`[Sincronização SEMAC] ⚠️ CPF não encontrado no Fluxograma para "${userNome || 'usuário'}" (Email: ${userEmail}, CPF: ${cpfFormatado || cpfLimpo || 'N/A'}). A sincronização não pode prosseguir com segurança sem um CPF correspondente — verifique/corrija o cadastro deste fiscal em um dos dois sistemas.`);
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

            // Calculado uma única vez por execução: usado pela tolerância do mês anterior em
            // verificarElegibilidadePontuacao() (ver comentário na definição da função).
            const limpezaMesAnteriorFeita = await limpezaGeralJaFeitaMesAnterior(semacClient, semacUserId);

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
                const { data: p1, error: errP1 } = await buscarEmLotesPorFiltro(
                    'processos',
                    'id, numero_processo, fiscal_id, etapa_atual_id, status, dados, possui_decreto, created_at, updated_at',
                    'fiscal_id',
                    allUserIds
                );
                if (errP1) console.error('[Sincronização SEMAC] ❌ ERRO ao buscar processos:', errP1.message, errP1);
                if (p1) procsFiscal = p1;
                console.log(`[Sincronização SEMAC] 📋 processos (fiscal_id IN [${allUserIds.join(', ')}]): ${(p1 || []).length} registros`);
            }

            const procIdsDoFiscal = (procsFiscal || []).map(p => p.id).filter(Boolean);

            // 1.2 Documentos
            let docsUser = [], docsProc = [];
            if (allUserIds.length > 0) {
                const { data: d1, error: errD1 } = await buscarEmLotesPorFiltro(
                    'documentos',
                    'id, processo_id, tipo, numero_sequencial, url, created_at, nome_arquivo, usuario_id',
                    'usuario_id',
                    allUserIds
                );
                if (errD1) console.error('[Sincronização SEMAC] ❌ ERRO ao buscar documentos (usuario_id):', errD1.message, errD1);
                if (d1) docsUser = d1;
                console.log(`[Sincronização SEMAC] 📄 documentos (usuario_id IN [...]): ${(d1 || []).length} registros`);
            }
            if (procIdsDoFiscal.length > 0) {
                const { data: d2, error: errD2 } = await buscarEmLotesPorFiltro(
                    'documentos',
                    'id, processo_id, tipo, numero_sequencial, url, created_at, nome_arquivo, usuario_id',
                    'processo_id',
                    procIdsDoFiscal
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
                const { data: a1, error: errA1 } = await buscarEmLotesPorFiltro(
                    'autos_infracao',
                    'id, processo_id, notificacao_id, usuario_id, numero, status, created_at, dados',
                    'usuario_id',
                    allUserIds
                );
                if (errA1) console.error('[Sincronização SEMAC] ❌ ERRO ao buscar autos_infracao (usuario_id):', errA1.message, errA1);
                if (a1) autosUser = a1;
                console.log(`[Sincronização SEMAC] ⚖️ autos_infracao (usuario_id IN [...]): ${(a1 || []).length} registros`);
            }
            if (procIdsDoFiscal.length > 0) {
                const { data: a2, error: errA2 } = await buscarEmLotesPorFiltro(
                    'autos_infracao',
                    'id, processo_id, notificacao_id, usuario_id, numero, status, created_at, dados',
                    'processo_id',
                    procIdsDoFiscal
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
                const { data: notifs, error: errN } = await buscarEmLotesPorFiltro(
                    'notificacoes',
                    'id, numero, descricao, status, created_at, processo_id',
                    'processo_id',
                    procIdsDoFiscal
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
                const pExtra = await buscarLinhasPorIds(
                    'processos',
                    'id, numero_processo, fiscal_id, etapa_atual_id, status, dados, possui_decreto, created_at, updated_at',
                    procIdsFaltantes
                );
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

            if (houveTimeoutNoFluxograma) {
                console.warn('⏱️ [Sincronização SEMAC] Alguma consulta ao Fluxograma estourou o tempo limite (Postgres 57014). Isso acontece quando processos.dados ou documentos.url guardam arquivos em base64 de vários MB — a leitura foi feita em lotes menores e os registros grandes demais foram pulados. Solução definitiva: gravar no Fluxograma apenas o link do arquivo (Cloudinary/Storage), não o base64.');
            }

            if (!houveTimeoutNoFluxograma && todosProcessosDoFiscal.length === 0 && documentos.length === 0 && autosTabela.length > 0) {
                console.error('🚨🚨🚨 [Sincronização SEMAC] PROBLEMA DE RLS DETECTADO! A tabela autos_infracao (RLS=OFF) retorna dados, mas processos e documentos (RLS=ON) não. O masterClient está usando a anon key SEM sessão autenticada, e as políticas RLS bloqueiam o acesso. SOLUÇÃO: No banco Fluxograma, adicione políticas de leitura anônima SOMENTE nestas 3 tabelas (contribuintes/imoveis não precisam — os dados de contribuinte/imóvel já vêm embutidos em processos.dados):\n' +
                    "CREATE POLICY \"anon_read_processos\" ON processos FOR SELECT TO anon USING (true);\n" +
                    "CREATE POLICY \"anon_read_documentos\" ON documentos FOR SELECT TO anon USING (true);\n" +
                    "CREATE POLICY \"anon_read_notificacoes\" ON notificacoes FOR SELECT TO anon USING (true);\n" +
                    "(NÃO use ALTER TABLE ... DISABLE ROW LEVEL SECURITY — isso desliga toda a proteção da tabela, não só a leitura.)");
            }

            // Dados de contribuinte/imóvel vêm de dentro de `processos.dados` (JSON já carregado
            // em processosPorId acima) — de propósito NÃO consultamos as tabelas `contribuintes`
            // nem `imoveis` diretamente: são cadastros de PII de contribuinte mais amplos que o
            // necessário aqui, sem necessidade de abrir leitura anônima neles no Fluxograma.

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

            // Número da notificação por processo: serve de segunda fonte quando o documento
            // de notificação vem sem numero_sequencial.
            const numeroNotificacaoPorProcesso = {};
            (notificacoes || []).forEach(n => {
                if (n && n.processo_id && n.numero && !numeroNotificacaoPorProcesso[n.processo_id]) {
                    numeroNotificacaoPorProcesso[n.processo_id] = n.numero;
                }
            });

            // ------------------------------------------------------------------
            // PASSO 2: SINCRONIZAR TABELA DOCUMENTOS
            // ------------------------------------------------------------------
            for (const doc of (documentos || [])) {
                const tipoLower = (doc.tipo || '').toLowerCase().trim();
                const procDoDoc = processosPorId[doc.processo_id] || {};

                // Processo cancelado não gera pontuação.
                if (processoCancelado(procDoDoc)) {
                    console.log(`[Sincronização SEMAC] 🚫 documento ${doc.id} ignorado: processo ${procDoDoc.numero_processo || doc.processo_id} está cancelado.`);
                    continue;
                }

                // Quando o número não vem no documento, tenta a notificação do mesmo processo
                // antes de cair para "S/N" (um registro com S/N acaba duplicado quando o número
                // aparece numa sincronização posterior).
                const numSeq = doc.numero_sequencial
                    || (tipoLower.includes('notific') ? numeroNotificacaoPorProcesso[doc.processo_id] : null)
                    || 'S/N';

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
                const nomeContribuinte = dadosProc.contribuinte?.nome || '';
                const bairroImovel = dadosProc.imovel?.bairro || '';
                const dataFormatadaBR = createdAt ? new Date(createdAt).toISOString().split('T')[0] : '';
                const elegivel = verificarElegibilidadePontuacao(createdAt, limpezaMesAnteriorFeita);

                // --- Auto de Infração ---
                if (tipoLower.includes('auto de infração') || tipoLower.includes('auto de infracao') || (tipoLower.includes('auto') && tipoLower.includes('infra'))) {
                    const ptsCP = elegivel.pontuar ? 5 : 0;
                    const camposCP = {
                        doc_id: doc.id,
                        proc_id: doc.processo_id,
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
                            proc_id: doc.processo_id,
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
                    // Processo por decreto nasce como Auto de Infração: a NP nunca foi expedida.
                    if (processoPorDecreto(procDoDoc)) {
                        console.log(`[Sincronização SEMAC] 🚫 NP do documento ${doc.id} ignorada: processo ${procDoDoc.numero_processo || doc.processo_id} é por decreto.`);
                        continue;
                    }

                    const ptsCP = elegivel.pontuar ? 5 : 0;
                    const camposCP = {
                        doc_id: doc.id,
                        proc_id: doc.processo_id,
                        n_notificacao: numSeq,
                        nome: nomeContribuinte,
                        n_inscricao: dadosProc.contribuinte?.cpf_cnpj || dadosProc.imovel?.inscricao_imovel || '',
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
                            proc_id: doc.processo_id,
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

                    // Mesma automação aplicada quando o fiscal preenche a categoria 1.5 manualmente
                    // (ver produtividade.js): gera também a Elaboração de Relatório Fiscal (cat. 7, 50 pts).
                    if (elegivel.pontuar) {
                        const camposRP = {
                            doc_id: doc.id,
                            n_relatorio: numSeq,
                            tipo: 'Relatório Fiscal',
                            descricao: numSeq,
                            data: dataFormatadaBR,
                            anexo_pdf: docUrl,
                            _created_at: createdAt
                        };
                        if (await inserirRegistroProdutividade(semacClient, semacUserId, '7', 'Elaboração de Certidão de Arquivamento e Relatório Fiscal', 50, camposRP)) {
                            inseridosProdutividade++;
                        }
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
                const procDoAuto = processosPorId[auto.processo_id] || {};

                if (processoCancelado(procDoAuto)) {
                    console.log(`[Sincronização SEMAC] 🚫 auto ${auto.id} ignorado: processo ${procDoAuto.numero_processo || auto.processo_id} está cancelado.`);
                    continue;
                }

                const numSeq = auto.numero || 'S/N';
                const createdAt = auto.created_at;
                const dadosProcAuto = procDoAuto.dados || {};
                const nomeContribuinte = auto.dados?.contribuinte?.nome || dadosProcAuto.contribuinte?.nome || '';
                const bairroImovel = auto.dados?.imovel?.bairro || dadosProcAuto.imovel?.bairro || '';
                const dataFormatadaBR = createdAt ? new Date(createdAt).toISOString().split('T')[0] : '';
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

                const elegivel = verificarElegibilidadePontuacao(createdAt, limpezaMesAnteriorFeita);
                const ptsCP = elegivel.pontuar ? 5 : 0;

                const camposCP = {
                    auto_id: auto.id,
                    proc_id: auto.processo_id,
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
                        proc_id: auto.processo_id,
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

                const procDoNotif = processosPorId[notif.processo_id] || {};

                if (processoCancelado(procDoNotif)) {
                    console.log(`[Sincronização SEMAC] 🚫 notificação ${notif.id} ignorada: processo ${procDoNotif.numero_processo || notif.processo_id} está cancelado.`);
                    continue;
                }

                // Processo por decreto: a NP nunca foi expedida, só o Auto de Infração.
                if (processoPorDecreto(procDoNotif)) {
                    console.log(`[Sincronização SEMAC] 🚫 notificação ${notif.id} ignorada: processo ${procDoNotif.numero_processo || notif.processo_id} é por decreto.`);
                    continue;
                }

                const createdAt = notif.created_at;
                const dataFormatadaBR = createdAt ? new Date(createdAt).toISOString().split('T')[0] : '';
                const dadosProcNotif = procDoNotif.dados || {};
                const notifUrl = extrairUrlCloudinary(
                    docQualquerUrlPorProcesso[notif.processo_id],
                    dadosProcNotif
                );

                const elegivel = verificarElegibilidadePontuacao(createdAt, limpezaMesAnteriorFeita);
                const ptsCP = elegivel.pontuar ? 5 : 0;

                const camposCP = {
                    notif_id: notif.id,
                    proc_id: notif.processo_id,
                    n_notificacao: notif.numero || 'S/N',
                    nome: dadosProcNotif.contribuinte?.nome || '',
                    n_inscricao: dadosProcNotif.contribuinte?.cpf_cnpj || dadosProcNotif.imovel?.inscricao_imovel || '',
                    bairro: dadosProcNotif.imovel?.bairro || '',
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
                        proc_id: notif.processo_id,
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
                // A etapa sozinha não basta: há processo em etapa 16 que continua como
                // Notificação Preliminar (nunca virou Auto de Infração) e, portanto, não houve
                // montagem de processo para inscrição em dívida ativa. Cancelado também não conta.
                if (processoCancelado(p)) {
                    console.log(`[Sincronização SEMAC] 🚫 Dívida Ativa ignorada: processo ${p.numero_processo || p.id} está cancelado.`);
                    return false;
                }
                if (processoAindaEmNotificacao(p)) {
                    console.log(`[Sincronização SEMAC] 🚫 Dívida Ativa ignorada: processo ${p.numero_processo || p.id} ainda está em Notificação Preliminar.`);
                    return false;
                }
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
                    const dadosProc = proc.dados || {};

                    // Extrair dados relevantes conforme especificação
                    const numAuto = autoDoc.numero_sequencial
                        || dadosProc.numero_auto_infracao
                        || dadosProc.etapa14?.numero_auto_infracao
                        || proc.numero_processo
                        || 'S/N';
                    const nomeAutuado = dadosProc.contribuinte?.nome
                        || '';
                    const cpfAutuado = dadosProc.contribuinte?.cpf_cnpj
                        || '';
                    const advogadoAutuado = dadosProc.advogado
                        || dadosProc.contribuinte?.advogado
                        || dadosProc.etapa14?.advogado
                        || dadosProc.etapa15?.advogado
                        || 'S/A';
                    const bairroDA = dadosProc.imovel?.bairro
                        || '';
                    const anexoPdf = autoDoc.url
                        || dadosProc.anexo_pdf
                        || dadosProc.url_capa
                        || dadosProc.capa_pdf
                        || dadosProc.etapa15?.anexo_pdf
                        || '';

                    const dataDA = proc.created_at;
                    const dataFormatadaBR = dataDA ? new Date(dataDA).toISOString().split('T')[0] : '';
                    const elegivel = verificarElegibilidadePontuacao(dataDA, limpezaMesAnteriorFeita);
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

    // Regras de situação do processo, expostas para a limpeza de registros antigos
    // (limpeza-sincronizacao.js) usar exatamente os mesmos critérios desta sincronização.
    window.SemacSituacaoProcesso = {
        status: statusDoProcesso,
        porDecreto: processoPorDecreto,
        cancelado: processoCancelado,
        aindaEmNotificacao: processoAindaEmNotificacao
    };

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
