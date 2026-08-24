/**
 * =========================================================================
 * SCRIPT DE CRON JOB EXTERNO - SINCRONIZAÇÃO DE PRODUTIVIDADE SEMAC
 * =========================================================================
 * 
 * Este script Node.js é projetado para ser executado por um serviço de Cron
 * (ex: Linux crontab, GitHub Actions, Vercel Cron, ou servidor backend).
 * 
 * Uso via terminal:
 *   node cron-sincronizacao.js [YYYY-MM-DD]
 * 
 * Exemplo:
 *   node cron-sincronizacao.js
 *   node cron-sincronizacao.js 2026-08-24
 */

const { createClient } = require('@supabase/supabase-js');

// Configurações do Supabase SEMAC
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://marmpnusgmbjphffaynr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_publishable_ZVtndwPOvY2dA4Qzlwkl2A_H0-TeUgu';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function rodarCronSincronizacao() {
    // Pega a data informada por argumento ou usa a data atual (YYYY-MM-DD)
    const dataAlvo = process.argv[2] || new Date().toISOString().split('T')[0];

    console.log(`=======================================================`);
    console.log(`[CRON SEMAC] Iniciando sincronização diária de produtividade`);
    console.log(`Data alvo: ${dataAlvo}`);
    console.log(`Horário de execução: ${new Date().toLocaleString()}`);
    console.log(`=======================================================`);

    try {
        const { data, error } = await supabase.rpc('sincronizar_produtividade_diaria', {
            p_data: dataAlvo
        });

        if (error) {
            console.error(`❌ Erro ao executar procedure 'sincronizar_produtividade_diaria':`, error);
            process.exit(1);
        }

        console.log(`✅ Sincronização concluída com sucesso para a data ${dataAlvo}!`);
        process.exit(0);
    } catch (err) {
        console.error(`💥 Exceção não tratada na sincronização:`, err);
        process.exit(1);
    }
}

rodarCronSincronizacao();
