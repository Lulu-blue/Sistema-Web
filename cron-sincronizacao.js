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
const masterClient = createClient(MASTER_URL, MASTER_KEY);

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
                processos:processo_id (numero_processo)
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

        // Buscar contribuintes e imóveis dos processos
        const processoIds = [...new Set(documentos.map(d => d.processo_id).filter(Boolean))];
        const contribuintesPorProcesso = {};
        const imoveisPorProcesso = {};

        if (processoIds.length > 0) {
            const { data: contribs } = await masterClient
                .from('contribuintes')
                .select('processo_id, nome, cpf_cnpj, bairro')
                .in('processo_id', processoIds);
            (contribs || []).forEach(c => {
                if (!contribuintesPorProcesso[c.processo_id]) contribuintesPorProcesso[c.processo_id] = c;
            });

            const { data: imvs } = await masterClient
                .from('imoveis')
                .select('processo_id, bairro, inscricao_imovel')
                .in('processo_id', processoIds);
            (imvs || []).forEach(i => {
                if (!imoveisPorProcesso[i.processo_id]) imoveisPorProcesso[i.processo_id] = i;
            });
        }

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

            const contribuinte = contribuintesPorProcesso[doc.processo_id] || {};
            const imovel = imoveisPorProcesso[doc.processo_id] || {};
            const nomeContribuinte = contribuinte.nome || '';
            const bairroImovel = imovel.bairro || contribuinte.bairro || '';
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
                catControle = { id: '1.2', nome: 'Auto de Infração', pontuacao: 5 };
                catProdutividade = { id: '16', nome: 'Auto de Infração', pontuacao: 15, campoChave: 'n_auto' };
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
                catControle = { id: '1.1', nome: 'Notificação Preliminar', pontuacao: 5 };
                catProdutividade = { id: '14', nome: 'Notificação Preliminar', pontuacao: 15, campoChave: 'n_notificacao' };
                camposCP = {
                    n_notificacao: numSeq,
                    nome: nomeContribuinte,
                    n_inscricao: contribuinte.cpf_cnpj || imovel.inscricao_imovel || '',
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
                catControle = { id: '1.5', nome: 'Relatório Fiscal', pontuacao: 5 };
                catProdutividade = { id: '7', nome: 'Elaboração de Relatório Fiscal', pontuacao: 10, campoChave: 'n_relatorio' };
                camposCP = {
                    atendimento: nomeContribuinte || numSeq,
                    bairro: bairroImovel,
                    anexo_pdf: docUrl
                };
                camposRP = {
                    n_relatorio: numSeq,
                    descricao: nomeContribuinte || 'Expedição Automática',
                    data: dataFormatadaBR
                };
            } else if (tipoLower.includes('réplica') || tipoLower.includes('replica')) {
                catControle = { id: '1.7', nome: 'Réplica da Defesa', pontuacao: 5 };
                camposCP = {
                    nome: nomeContribuinte,
                    bairro: bairroImovel,
                    anexo_pdf: docUrl
                };
            } else if (tipoLower.includes('certidão') || tipoLower.includes('certidao')) {
                catControle = { id: '1.8', nome: 'Certidão Sem Defesa', pontuacao: 5 };
                camposCP = {
                    nome: nomeContribuinte,
                    bairro: bairroImovel,
                    anexo_pdf: docUrl
                };
            }

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
                        campos: {
                            ...camposCP,
                            doc_id: docId,
                            numero_processo: numProc,
                            origem: 'sincronizacao_fluxograma',
                            _created_at: createdAt
                        },
                        created_at: createdAt
                    };
                    const { error } = await semacClient.from('controle_processual').insert([payloadCP]);
                    if (!error) inseridosCP++;
                }
            }

            if (catProdutividade && userId) {
                const { data: existeRP } = await semacClient
                    .from('registros_produtividade')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('categoria_id', catProdutividade.id)
                    .contains('campos', { doc_id: docId })
                    .maybeSingle();

                if (!existeRP) {
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
                        created_at: createdAt
                    };
                    const { error } = await semacClient.from('registros_produtividade').insert([payloadRP]);
                    if (!error) inseridosRP++;
                }
            }
        }

        console.log(`✅ Sincronização concluída para ${dataFormatada}! Inseridos: ${inseridosCP} em Controle, ${inseridosRP} em Produtividade.`);
        process.exit(0);
    } catch (err) {
        console.error(`💥 Exceção na sincronização:`, err);
        process.exit(1);
    }
}

rodarCronSincronizacao();
