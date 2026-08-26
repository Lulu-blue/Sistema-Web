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
                created_at,
                gerado_automaticamente,
                profiles:usuario_id (id, nome),
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

        let inseridosCP = 0;
        let inseridosRP = 0;

        for (const doc of documentos) {
            if (doc.gerado_automaticamente === true) continue;

            const tipo = (doc.tipo || '').trim();
            const userId = doc.usuario_id;
            const fiscalNome = doc.profiles?.nome || 'Fiscal de Posturas';
            const numSeq = doc.numero_sequencial || 'S/N';
            const numProc = doc.processos?.numero_processo || '';
            const docId = doc.id;
            const createdAt = doc.created_at;

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
