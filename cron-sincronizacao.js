/**
 * =========================================================================
 * SCRIPT DE CRON JOB EXTERNO - SINCRONIZAÇÃO DE PRODUTIVIDADE SEMAC
 * =========================================================================
 * 
 * Este script Node.js busca os documentos emitidos no banco MESTRE (Fluxograma)
 * e os registra nas tabelas 'controle_processual' e 'registros_produtividade'
 * no banco SEMAC com verificação estrita de não-duplicação.
 * 
 * Uso via terminal:
 *   node cron-sincronizacao.js [YYYY-MM-DD]
 */

const { createClient } = require('@supabase/supabase-js');

// Configurações Supabase SEMAC
const SEMAC_URL = process.env.SUPABASE_URL || 'https://marmpnusgmbjphffaynr.supabase.co';
const SEMAC_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_publishable_ZVtndwPOvY2dA4Qzlwkl2A_H0-TeUgu';

// Configurações Supabase MASTER (Fluxograma)
const MASTER_URL = process.env.MASTER_FLUXOGRAMA_URL || 'https://mqjlbgbbvesyagwxqgox.supabase.co';
const MASTER_KEY = process.env.MASTER_FLUXOGRAMA_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xamxiZ2JidmVzeWFnd3hxZ294Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMTE5MDUsImV4cCI6MjA5ODg4NzkwNX0.V9Loy1ZarXn7wB00QYfuKhVgVK2chKg3-X8XHdvAgvU';

const semacClient = createClient(SEMAC_URL, SEMAC_KEY);
const masterClient = createClient(MASTER_URL, MASTER_KEY, {
    auth: {
        persistSession: false,
        autoRefreshToken: false
    }
});

/**
 * Normaliza o número sequencial (ex: "0053/2026" -> "53/2026") para servir de chave de
 * correlação ÚNICA no banco (user_id, categoria_id, origem_unica), consistente com a mesma
 * função usada em assets/js/sincronizacao-cron.js. Isso garante que o mesmo evento real
 * processado pelo cron externo ou pela sincronização do navegador nunca seja duplicado.
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
 * Verifica se o fiscal já rodou a "Limpeza Geral" (Home) para o mês anterior ao atual: essa ação
 * apaga permanentemente os registros de `registros_produtividade` de meses passados. Se não sobrou
 * NENHUM registro do fiscal no mês anterior, é sinal de que a limpeza já foi feita — nesse caso a
 * tolerância de reabertura do mês anterior NÃO deve mais se aplicar. Resultado cacheado por userId
 * dentro de uma mesma execução do cron (que processa vários fiscais de uma vez).
 */
const limpezaMesAnteriorCache = new Map();
async function limpezaGeralJaFeitaMesAnterior(userId) {
    if (!userId) return false;
    if (limpezaMesAnteriorCache.has(userId)) return limpezaMesAnteriorCache.get(userId);

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

    const resultado = error ? false : (count || 0) === 0;
    if (error) console.warn('[CRON SEMAC] Erro ao verificar Limpeza Geral do mês anterior:', error.message);
    limpezaMesAnteriorCache.set(userId, resultado);
    return resultado;
}

/**
 * Verifica a elegibilidade para pontuação e inserção nos registros de produtividade:
 * - Mês atual: Pontuação total + Registra em RP.
 * - Mês anterior (1 mês atrás): Pontuação total + Registra em RP, mas SOMENTE até o dia 3 do mês
 *   vigente E somente se o fiscal ainda não tiver rodado a Limpeza Geral daquele mês.
 * - Mês anterior (após dia 3, ou com Limpeza Geral já feita) ou 2+ meses atrás: Apenas insere no
 *   Controle Processual com pontuação 0 (não insere em RP).
 */
async function verificarElegibilidadePontuacao(userId, dataInput) {
    if (!dataInput) return { pontuar: true, diferencaMeses: 0 };
    const dt = new Date(dataInput);
    if (isNaN(dt.getTime())) return { pontuar: true, diferencaMeses: 0 };

    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth();
    const diaAtual = hoje.getDate();

    const diferencaMeses = (anoAtual - dt.getFullYear()) * 12 + (mesAtual - dt.getMonth());

    if (diferencaMeses <= 0) {
        return { pontuar: true, diferencaMeses };
    }

    if (diferencaMeses === 1) {
        const limpezaFeita = await limpezaGeralJaFeitaMesAnterior(userId);
        if (limpezaFeita) {
            return { pontuar: false, diferencaMeses, motivo: 'Limpeza Geral do mês anterior já realizada pelo fiscal' };
        }
        if (diaAtual <= 3) {
            return { pontuar: true, diferencaMeses };
        }
        return { pontuar: false, diferencaMeses, motivo: 'Passou do dia 3 do mês seguinte' };
    }

    return { pontuar: false, diferencaMeses, motivo: 'Item antigo (2+ meses de atraso)' };
}

async function rodarCronSincronizacao() {
    const dataFormatada = process.argv[2] || new Date().toISOString().split('T')[0];

    console.log(`=======================================================`);
    console.log(`[CRON SEMAC] Sincronizando documentos do Fluxograma -> SEMAC`);
    console.log(`Data alvo: ${dataFormatada}`);
    console.log(`Horário: ${new Date().toLocaleString()}`);
    console.log(`=======================================================`);

    try {
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
                url,
                created_at,
                gerado_automaticamente,
                profiles:usuario_id (id, nome, cpf),
                processos:processo_id (numero_processo, dados)
            `)
            .gte('created_at', startOfDay)
            .lte('created_at', endOfDay);

        if (errDocs) {
            console.error(`❌ Erro ao buscar documentos no Fluxograma:`, errDocs.message);
            process.exit(1);
        }

        if (!documentos || documentos.length === 0) {
            console.log(`ℹ️ Nenhum documento encontrado no Fluxograma para a data ${dataFormatada}.`);
            process.exit(0);
        }

        // Dados de contribuinte/imóvel vêm de dentro de `processos.dados` (JSON já embutido no
        // select de `documentos` acima) — de propósito NÃO consultamos as tabelas `contribuintes`
        // nem `imoveis` diretamente: são cadastros de PII de contribuinte mais amplos que o
        // necessário aqui, e não há necessidade de abrir leitura anônima neles no Fluxograma.
        let inseridosCP = 0;
        let inseridosRP = 0;

        // Cache de mapeamento de IDs: fluxograma/cpf -> semacUserId
        const semacUserCache = {};

        for (const doc of documentos) {
            if (doc.gerado_automaticamente === true) continue;

            const tipo = (doc.tipo || '').trim();
            const fluxoUserId = doc.usuario_id;
            const cpfRaw = doc.profiles?.cpf || '';
            const cpfLimpo = cpfRaw.replace(/\D/g, '');
            const fiscalNome = doc.profiles?.nome || 'Fiscal de Posturas';
            const numSeq = doc.numero_sequencial || 'S/N';
            const numProc = doc.processos?.numero_processo || '';
            const docId = doc.id;
            const docUrl = doc.url || '';
            const createdAt = doc.created_at;

            const dadosProc = doc.processos?.dados || {};
            const nomeContribuinte = dadosProc.contribuinte?.nome || '';
            const bairroImovel = dadosProc.imovel?.bairro || '';
            const inscricaoImovel = dadosProc.contribuinte?.cpf_cnpj || dadosProc.imovel?.inscricao_imovel || '';
            const dataFormatadaBR = createdAt ? new Date(createdAt).toISOString().split('T')[0] : '';

            let semacUserId = semacUserCache[fluxoUserId] || semacUserCache[cpfLimpo];

            if (!semacUserId && (cpfLimpo || fluxoUserId)) {
                const emailBusca = cpfLimpo ? `${cpfLimpo}@email.com` : null;
                let querySEMAC = semacClient.from('profiles').select('id');
                if (emailBusca) {
                    querySEMAC = querySEMAC.or(`email.eq.${emailBusca},id.eq.${fluxoUserId}`);
                } else {
                    querySEMAC = querySEMAC.eq('id', fluxoUserId);
                }

                const { data: semacPerfil } = await querySEMAC.maybeSingle();
                if (semacPerfil) {
                    semacUserId = semacPerfil.id;
                    semacUserCache[fluxoUserId] = semacUserId;
                    if (cpfLimpo) semacUserCache[cpfLimpo] = semacUserId;
                }
            }

            const userId = semacUserId || fluxoUserId;

            let catControle = null;
            let catProdutividade = null;
            let camposCP = {};
            let camposRP = {};
            const tipoLower = tipo.toLowerCase();

            if (tipoLower.includes('auto de infração') || tipoLower.includes('auto de infracao')) {
                catControle = { id: '1.2', nome: 'Controle Processual: Auto de Infração', pontuacao: 5 };
                catProdutividade = { id: '16', nome: 'Autos de Infração expedidos', pontuacao: 30, campoChave: 'n_auto' };
                camposCP = {
                    n_auto: numSeq,
                    nome: nomeContribuinte,
                    bairro: bairroImovel,
                    motivo: '',
                    data: dataFormatadaBR,
                    anexo_pdf: docUrl
                };
                camposRP = {
                    n_auto: numSeq,
                    descricao: nomeContribuinte || 'Expedição Automática',
                    data: dataFormatadaBR
                };
            } else if (tipoLower.includes('notificação preliminar') || tipoLower.includes('notificacao preliminar')) {
                catControle = { id: '1.1', nome: 'Controle Processual: Notificação Preliminar', pontuacao: 5 };
                catProdutividade = { id: '14', nome: 'Notificação Preliminar expedidos', pontuacao: 20, campoChave: 'n_notificacao' };
                camposCP = {
                    n_notificacao: numSeq,
                    nome: nomeContribuinte,
                    n_inscricao: inscricaoImovel,
                    bairro: bairroImovel,
                    motivo: '',
                    anexo_pdf: docUrl
                };
                camposRP = {
                    n_notificacao: numSeq,
                    descricao: nomeContribuinte || 'Expedição Automática',
                    data: dataFormatadaBR
                };
            } else if (tipoLower.includes('relatório fiscal') || tipoLower.includes('relatorio fiscal')) {
                catControle = { id: '1.5', nome: 'Controle Processual: Relatório', pontuacao: 10 };
                // Mesma automação aplicada quando o fiscal preenche a categoria 1.5 manualmente (ver produtividade.js).
                catProdutividade = { id: '7', nome: 'Elaboração de Certidão de Arquivamento e Relatório Fiscal', pontuacao: 50, campoChave: 'n_relatorio' };
                camposCP = {
                    atendimento: nomeContribuinte || numSeq,
                    bairro: bairroImovel,
                    anexo_pdf: docUrl
                };
                camposRP = {
                    n_relatorio: numSeq,
                    tipo: 'Relatório Fiscal',
                    descricao: numSeq,
                    data: dataFormatadaBR
                };
            } else if (tipoLower.includes('réplica') || tipoLower.includes('replica')) {
                catControle = { id: '1.7', nome: 'Réplica', pontuacao: 50 };
                camposCP = {
                    nome: nomeContribuinte,
                    bairro: bairroImovel,
                    anexo_pdf: docUrl
                };
            } else if (tipoLower.includes('certidão') || tipoLower.includes('certidao')) {
                catControle = { id: '1.8', nome: 'Certidão', pontuacao: 50 };
                camposCP = {
                    nome: nomeContribuinte,
                    bairro: bairroImovel,
                    anexo_pdf: docUrl
                };
            }

            // Regra de elegibilidade por data (mês atual / tolerância de 3 dias do mês anterior,
            // sujeita à Limpeza Geral / 2+ meses de atraso): ver verificarElegibilidadePontuacao().
            const elegivel = (catControle || catProdutividade) && userId
                ? await verificarElegibilidadePontuacao(userId, createdAt)
                : { pontuar: true };

            if (catControle && userId) {
                const origemUnicaCP = normalizarNumeroSequencial(numSeq) || `doc_id:${docId}`;
                const payloadCP = {
                    user_id: userId,
                    fiscal_nome: fiscalNome,
                    categoria_id: catControle.id,
                    categoria_nome: catControle.nome,
                    numero_sequencial: numSeq,
                    pontuacao: elegivel.pontuar ? catControle.pontuacao : 0,
                    campos: {
                        ...camposCP,
                        doc_id: docId,
                        numero_processo: numProc,
                        origem: 'sincronizacao_fluxograma',
                        _created_at: createdAt
                    },
                    origem_unica: origemUnicaCP,
                    created_at: createdAt
                };
                // Upsert com ON CONFLICT na constraint UNIQUE(user_id, categoria_id, origem_unica):
                // protege contra duplicidade mesmo se este cron rodar em paralelo com a sincronização
                // do navegador ou for reexecutado para a mesma data.
                const { data: insCP, error: errCP } = await semacClient
                    .from('controle_processual')
                    .upsert([payloadCP], { onConflict: 'user_id,categoria_id,origem_unica', ignoreDuplicates: true })
                    .select('id');
                if (!errCP && insCP && insCP.length > 0) inseridosCP++;
            }

            if (catProdutividade && userId && elegivel.pontuar) {
                const origemUnicaRP = normalizarNumeroSequencial(numSeq) || `doc_id:${docId}`;
                const payloadRP = {
                    user_id: userId,
                    categoria_id: catProdutividade.id,
                    categoria_nome: catProdutividade.nome,
                    pontuacao: catProdutividade.pontuacao,
                    campos: {
                        ...camposRP,
                        doc_id: docId,
                        origem: 'sincronizacao_fluxograma',
                        _created_at: createdAt
                    },
                    origem_unica: origemUnicaRP,
                    created_at: createdAt
                };
                const { data: insRP, error: errRP } = await semacClient
                    .from('registros_produtividade')
                    .upsert([payloadRP], { onConflict: 'user_id,categoria_id,origem_unica', ignoreDuplicates: true })
                    .select('id');
                if (!errRP && insRP && insRP.length > 0) inseridosRP++;
            }
        }

        // =====================================================================
        // PASSO 2: Sincronização de PROCESSOS → Dívida Ativa (Cat. 11 - 100 pts)
        // Processos que atingiram etapa >= 15 no mês da data alvo
        // Pontua apenas para o criador do processo (fiscal_id)
        // =====================================================================

        // Determinar limites do mês da data alvo
        const dataAlvo = new Date(dataFormatada + 'T12:00:00Z');
        const inicioMes = new Date(dataAlvo.getFullYear(), dataAlvo.getMonth(), 1);
        inicioMes.setHours(0, 0, 0, 0);
        const fimMes = new Date(dataAlvo.getFullYear(), dataAlvo.getMonth() + 1, 0);
        fimMes.setHours(23, 59, 59, 999);

        console.log(`\n[CRON SEMAC] Buscando processos com etapa >= 15 no mês ${inicioMes.toISOString().split('T')[0]} a ${fimMes.toISOString().split('T')[0]}...`);

        const { data: todosProcDA, error: errProcDA } = await masterClient
            .from('processos')
            .select(`
                id,
                numero_processo,
                fiscal_id,
                etapa_atual_id,
                dados,
                created_at,
                updated_at,
                profiles:fiscal_id (id, nome, cpf)
            `)
            .gte('updated_at', inicioMes.toISOString())
            .lte('updated_at', fimMes.toISOString());

        if (errProcDA) {
            console.error(`❌ Erro ao buscar processos Dívida Ativa:`, errProcDA.message);
        }

        function extrairEtapaNumeroCron(proc) {
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

        const processosDividaAtiva = (todosProcDA || []).filter(p => {
            return extrairEtapaNumeroCron(p) >= 15;
        });

        if (processosDividaAtiva && processosDividaAtiva.length > 0) {
            console.log(`📋 Processos com etapa >= 15 encontrados: ${processosDividaAtiva.length}`);

            const procIdsDA = processosDividaAtiva.map(p => p.id);

            // Buscar Autos de Infração vinculados
            const autosPorProcesso = {};
            const { data: autosDA } = await masterClient
                .from('documentos')
                .select('processo_id, numero_sequencial, tipo, url')
                .in('processo_id', procIdsDA)
                .or('tipo.ilike.%Auto de Infração%,tipo.ilike.%Auto de Infracao%');

            (autosDA || []).forEach(a => {
                if (!autosPorProcesso[a.processo_id]) autosPorProcesso[a.processo_id] = a;
            });

            // Dados de contribuinte/imóvel vêm de dentro de `proc.dados` (JSON já presente no
            // select de `processos` acima) — mesma decisão de não abrir `contribuintes`/`imoveis`
            // do PASSO 1 (ver comentário lá em cima).
            for (const proc of processosDividaAtiva) {
                const autoDoc = autosPorProcesso[proc.id] || {};
                const dadosProc = proc.dados || {};

                // Identificar o criador do processo (fiscal_id) e mapear para o SEMAC
                const fiscalFluxoId = proc.fiscal_id;
                const cpfFiscalRaw = proc.profiles?.cpf || '';
                const cpfFiscalLimpo = cpfFiscalRaw.replace(/\D/g, '');
                const fiscalNomeDA = proc.profiles?.nome || 'Fiscal de Posturas';

                // Resolver o user_id no SEMAC para o criador do processo
                let semacUserIdDA = semacUserCache[fiscalFluxoId] || semacUserCache[cpfFiscalLimpo];

                if (!semacUserIdDA && (cpfFiscalLimpo || fiscalFluxoId)) {
                    const emailBuscaDA = cpfFiscalLimpo ? `${cpfFiscalLimpo}@email.com` : null;
                    let queryDA = semacClient.from('profiles').select('id');
                    if (emailBuscaDA) {
                        queryDA = queryDA.or(`email.eq.${emailBuscaDA},id.eq.${fiscalFluxoId}`);
                    } else {
                        queryDA = queryDA.eq('id', fiscalFluxoId);
                    }

                    const { data: perfilDA } = await queryDA.maybeSingle();
                    if (perfilDA) {
                        semacUserIdDA = perfilDA.id;
                        semacUserCache[fiscalFluxoId] = semacUserIdDA;
                        if (cpfFiscalLimpo) semacUserCache[cpfFiscalLimpo] = semacUserIdDA;
                    }
                }

                if (!semacUserIdDA) {
                    console.warn(`⚠️ Dívida Ativa: Não foi possível mapear o fiscal ${fiscalNomeDA} para o SEMAC. Pulando...`);
                    continue;
                }

                // Extrair dados do processo
                const numAuto = autoDoc.numero_sequencial
                    || dadosProc.numero_auto_infracao
                    || dadosProc.etapa14?.numero_auto_infracao
                    || '';
                const nomeAutuado = dadosProc.contribuinte?.nome
                    || '';
                const cpfAutuado = dadosProc.contribuinte?.cpf_cnpj
                    || '';
                const bairroDA = dadosProc.imovel?.bairro
                    || '';
                const advogadoAutuado = dadosProc.advogado
                    || dadosProc.contribuinte?.advogado
                    || dadosProc.etapa14?.advogado
                    || dadosProc.etapa15?.advogado
                    || 'S/A';
                const anexoPdf = autoDoc.url || '';
                const numSeqDA = proc.numero_processo || numAuto || 'S/N';

                // Verificar se já existe no SEMAC (por proc_id ou numero_processo)
                const { data: existeDA } = await semacClient
                    .from('controle_processual')
                    .select('id')
                    .eq('user_id', semacUserIdDA)
                    .eq('categoria_id', '11')
                    .contains('campos', { proc_id: proc.id })
                    .maybeSingle();

                if (existeDA) continue; // Já sincronizado

                if (proc.numero_processo) {
                    const { data: existeNumProc } = await semacClient
                        .from('controle_processual')
                        .select('id')
                        .eq('user_id', semacUserIdDA)
                        .eq('categoria_id', '11')
                        .contains('campos', { numero_processo: proc.numero_processo })
                        .maybeSingle();

                    if (existeNumProc) continue;
                }

                // Verificar também por número sequencial
                if (numSeqDA && numSeqDA !== 'S/N') {
                    const { data: existeSeq } = await semacClient
                        .from('controle_processual')
                        .select('id')
                        .eq('user_id', semacUserIdDA)
                        .eq('categoria_id', '11')
                        .eq('numero_sequencial', numSeqDA)
                        .maybeSingle();

                    if (existeSeq) continue;
                }

                // Regra de elegibilidade por data (mesma aplicada aos demais tipos — ver verificarElegibilidadePontuacao()).
                const elegivelDA = await verificarElegibilidadePontuacao(semacUserIdDA, proc.updated_at || proc.created_at);

                // Inserir no controle_processual
                const origemUnicaDA = normalizarNumeroSequencial(numSeqDA) || `proc_id:${proc.id}`;
                const payloadDA = {
                    user_id: semacUserIdDA,
                    fiscal_nome: fiscalNomeDA,
                    categoria_id: '11',
                    categoria_nome: 'Montagem de processo para encaminhamento, exclusivamente para inscrição em dívida ativa',
                    numero_sequencial: numSeqDA,
                    pontuacao: elegivelDA.pontuar ? 100 : 0,
                    campos: {
                        proc_id: proc.id,
                        n_auto: numAuto,
                        nome: nomeAutuado,
                        cpf: cpfAutuado,
                        advogado: advogadoAutuado,
                        bairro: bairroDA,
                        numero_processo: proc.numero_processo || '',
                        etapa_atual: extrairEtapaNumeroCron(proc),
                        anexo_pdf: anexoPdf,
                        origem: 'sincronizacao_fluxograma',
                        sincronizado: true,
                        data_sincronizacao: new Date().toISOString(),
                        _created_at: proc.updated_at || proc.created_at
                    },
                    origem_unica: origemUnicaDA,
                    created_at: proc.updated_at || proc.created_at
                };

                const { data: insDA, error: errInsDA } = await semacClient
                    .from('controle_processual')
                    .upsert([payloadDA], { onConflict: 'user_id,categoria_id,origem_unica', ignoreDuplicates: true })
                    .select('id');
                if (!errInsDA && insDA && insDA.length > 0) {
                    inseridosCP++;
                    console.log(`   ✅ Dívida Ativa: ${nomeAutuado || numSeqDA} → ${fiscalNomeDA} (Processo: ${proc.numero_processo})`);
                } else if (errInsDA) {
                    console.warn(`   ❌ Erro Dívida Ativa: ${errInsDA.message}`);
                }
            }
        } else {
            console.log(`ℹ️ Nenhum processo com etapa >= 15 encontrado no mês.`);
        }

        console.log(`✅ Sincronização concluída para ${dataFormatada}! Inseridos: ${inseridosCP} em Controle, ${inseridosRP} em Produtividade.`);
        process.exit(0);
    } catch (err) {
        console.error(`💥 Exceção na sincronização:`, err);
        process.exit(1);
    }
}

rodarCronSincronizacao();
