/**
 * =========================================================================
 * LIMPEZA DE REGISTROS SINCRONIZADOS INCORRETAMENTE
 * =========================================================================
 *
 * A sincronização passou a aplicar quatro regras que antes não existiam:
 *
 *   1. Notificação Preliminar de processo POR DECRETO nunca foi expedida
 *      (o processo nasce como Auto de Infração) — não deve virar registro.
 *   2. Processo CANCELADO não pontua nada.
 *   3. Dívida Ativa (10°) só vale quando o processo virou Auto de Infração;
 *      processo ainda em notificação preliminar não conta, mesmo em etapa >= 15.
 *   4. Registro que ficou com "S/N" e depois foi recriado com o número correto
 *      virou um par duplicado — fica só o numerado.
 *
 * Este módulo encontra os registros que já estão no banco violando essas regras.
 * Por padrão ele só RELATA (simulação). A remoção só acontece quando o usuário
 * confirma no aviso que aparece ao final.
 *
 * Uso:
 *   limparRegistrosSincronizados()               → simula e pergunta antes de apagar
 *   limparRegistrosSincronizados({ aplicar: true }) → apaga direto, sem perguntar
 */

(function () {

    const TABELAS = ['controle_processual', 'registros_produtividade'];

    // Categorias criadas pela sincronização
    const CATS_NP = ['1.1', '14'];          // Notificação Preliminar (controle + produtividade)
    const CATS_AI = ['1.2', '16'];          // Auto de Infração
    const CAT_DIVIDA_ATIVA = '11';          // 10° - Montagem de processo para dívida ativa

    const LOG = '[Limpeza Sincronização]';

    function chunk(lista, tamanho) {
        const out = [];
        for (let i = 0; i < lista.length; i += tamanho) out.push(lista.slice(i, i + tamanho));
        return out;
    }

    function numeroDoRegistro(reg) {
        const n = reg.campos?.n_notificacao || reg.campos?.n_auto || reg.numero_sequencial;
        return (!n || String(n).toUpperCase() === 'S/N') ? null : String(n);
    }

    function veioDaSincronizacao(reg) {
        return reg.campos?.sincronizado === true || reg.campos?.origem === 'sincronizacao_fluxograma';
    }

    /** Busca linhas leves do Fluxograma por id, em lotes (evita URL longa demais). */
    async function buscarPorIds(masterClient, tabela, colunas, ids) {
        const resultado = [];
        for (const lote of chunk([...new Set(ids.filter(Boolean))], 80)) {
            const { data, error } = await masterClient.from(tabela).select(colunas).in('id', lote);
            if (error) {
                console.warn(`${LOG} falha ao ler ${tabela}:`, error.message);
                continue;
            }
            (data || []).forEach(l => resultado.push(l));
        }
        return resultado;
    }

    async function limparRegistrosSincronizados(opcoes = {}) {
        const aplicarDireto = opcoes.aplicar === true;

        const masterClient = window.supabaseMaster;
        const semacClient = window.supabaseClient;
        if (!masterClient || !semacClient) {
            console.error(`${LOG} clientes Supabase indisponíveis.`);
            return null;
        }

        const { data: { user } } = await window.getAuthUser();
        if (!user) {
            console.error(`${LOG} usuário não autenticado.`);
            return null;
        }

        const situacao = window.SemacSituacaoProcesso;
        if (!situacao) {
            console.error(`${LOG} sincronizacao-cron.js não foi carregado — regras de situação indisponíveis.`);
            return null;
        }

        console.log(`${LOG} lendo registros sincronizados do usuário...`);

        // 1. Registros do próprio usuário que vieram da sincronização
        const registros = [];
        for (const tabela of TABELAS) {
            // numero_sequencial só existe em controle_processual; em registros_produtividade
            // o número fica dentro de campos (n_notificacao / n_auto).
            const colunas = tabela === 'controle_processual'
                ? 'id, categoria_id, categoria_nome, numero_sequencial, pontuacao, campos, created_at'
                : 'id, categoria_id, categoria_nome, pontuacao, campos, created_at';

            const { data, error } = await semacClient
                .from(tabela)
                .select(colunas)
                .eq('user_id', user.id);

            if (error) {
                console.error(`${LOG} erro ao ler ${tabela}:`, error.message);
                return null;
            }
            (data || []).filter(veioDaSincronizacao).forEach(r => registros.push({ ...r, _tabela: tabela }));
        }

        if (registros.length === 0) {
            console.log(`${LOG} nenhum registro sincronizado encontrado.`);
            return { analisados: 0, paraRemover: [] };
        }

        // 2. Descobrir o processo de origem de cada registro.
        //    Registros antigos não têm proc_id: chega-se nele por notif_id / doc_id / auto_id.
        const idsPorOrigem = { notificacoes: [], documentos: [], autos_infracao: [] };
        registros.forEach(r => {
            if (r.campos?.proc_id) return;
            if (r.campos?.notif_id) idsPorOrigem.notificacoes.push(r.campos.notif_id);
            else if (r.campos?.doc_id) idsPorOrigem.documentos.push(r.campos.doc_id);
            else if (r.campos?.auto_id) idsPorOrigem.autos_infracao.push(r.campos.auto_id);
        });

        const processoPorOrigem = {};
        for (const [tabela, ids] of Object.entries(idsPorOrigem)) {
            if (ids.length === 0) continue;
            // Só colunas leves: nada de `dados` ou `url` (base64 de vários MB).
            const linhas = await buscarPorIds(masterClient, tabela, 'id, processo_id', ids);
            linhas.forEach(l => { processoPorOrigem[`${tabela}:${l.id}`] = l.processo_id; });
        }

        const processoDoRegistro = (r) => {
            if (r.campos?.proc_id) return r.campos.proc_id;
            if (r.campos?.notif_id) return processoPorOrigem[`notificacoes:${r.campos.notif_id}`];
            if (r.campos?.doc_id) return processoPorOrigem[`documentos:${r.campos.doc_id}`];
            if (r.campos?.auto_id) return processoPorOrigem[`autos_infracao:${r.campos.auto_id}`];
            return null;
        };

        // 3. Situação dos processos envolvidos (colunas leves)
        const procIds = registros.map(processoDoRegistro).filter(Boolean);
        const processos = await buscarPorIds(
            masterClient, 'processos',
            'id, numero_processo, status, possui_decreto, etapa_atual_id',
            procIds
        );
        const processoPorId = {};
        processos.forEach(p => { processoPorId[p.id] = p; });

        // 4. Classificar
        const paraRemover = [];
        const semProcesso = [];

        registros.forEach(r => {
            const procId = processoDoRegistro(r);
            const proc = procId ? processoPorId[procId] : null;

            // Sem como identificar o processo: não se mexe (pode ser lançamento legítimo).
            if (!proc) {
                semProcesso.push(r);
                return;
            }

            r._proc = proc;

            if (situacao.cancelado(proc)) {
                paraRemover.push({ ...r, _motivo: 'processo cancelado' });
                return;
            }
            if (CATS_NP.includes(r.categoria_id) && situacao.porDecreto(proc)) {
                paraRemover.push({ ...r, _motivo: 'NP de processo por decreto (nunca foi expedida)' });
                return;
            }
            if (r.categoria_id === CAT_DIVIDA_ATIVA && situacao.aindaEmNotificacao(proc)) {
                paraRemover.push({ ...r, _motivo: 'Dívida Ativa de processo ainda em notificação preliminar' });
                return;
            }
        });

        // 5. Pares duplicados "S/N" + numerado (mesmo processo, mesma categoria, mesma tabela)
        const jaMarcado = new Set(paraRemover.map(r => `${r._tabela}:${r.id}`));
        const grupos = {};
        registros.forEach(r => {
            if (jaMarcado.has(`${r._tabela}:${r.id}`)) return;
            if (!r._proc) return;
            if (!CATS_NP.includes(r.categoria_id) && !CATS_AI.includes(r.categoria_id)) return;
            const chave = `${r._tabela}|${r.categoria_id}|${r._proc.id}`;
            (grupos[chave] = grupos[chave] || []).push(r);
        });

        Object.values(grupos).forEach(grupo => {
            if (grupo.length < 2) return;
            const numerados = grupo.filter(numeroDoRegistro);
            const semNumero = grupo.filter(r => !numeroDoRegistro(r));
            // Só remove o S/N quando existe o equivalente numerado — nunca apaga o único registro.
            if (numerados.length > 0 && semNumero.length > 0) {
                semNumero.forEach(r => paraRemover.push({ ...r, _motivo: `duplicado: já existe o mesmo registro com número ${numeroDoRegistro(numerados[0])}` }));
            }
        });

        // 6. Relatório
        const pontosRemovidos = paraRemover.reduce((s, r) => s + (Number(r.pontuacao) || 0), 0);

        console.log(`${LOG} ${registros.length} registros sincronizados analisados.`);
        if (semProcesso.length > 0) {
            console.log(`${LOG} ${semProcesso.length} sem processo identificável no Fluxograma — mantidos como estão.`);
        }

        if (paraRemover.length === 0) {
            console.log(`${LOG} ✅ nenhum registro irregular encontrado.`);
            if (typeof Swal !== 'undefined') {
                Swal.fire('Tudo certo', 'Nenhum registro sincronizado irregular foi encontrado.', 'success');
            }
            return { analisados: registros.length, paraRemover: [] };
        }

        console.table(paraRemover.map(r => ({
            tabela: r._tabela,
            categoria: r.categoria_id,
            numero: numeroDoRegistro(r) || 'S/N',
            pontos: r.pontuacao,
            processo: r._proc?.numero_processo,
            situacao: situacao.status(r._proc),
            motivo: r._motivo
        })));

        const resumoPorMotivo = {};
        paraRemover.forEach(r => { resumoPorMotivo[r._motivo] = (resumoPorMotivo[r._motivo] || 0) + 1; });

        // 7. Confirmação e remoção
        if (!aplicarDireto) {
            if (typeof Swal === 'undefined') {
                console.warn(`${LOG} simulação concluída. Para remover, rode: limparRegistrosSincronizados({ aplicar: true })`);
                return { analisados: registros.length, paraRemover, removidos: 0 };
            }

            const listaHtml = Object.entries(resumoPorMotivo)
                .map(([motivo, qtd]) => `<li style="text-align:left">${qtd} × ${motivo}</li>`)
                .join('');

            const confirmacao = await Swal.fire({
                icon: 'warning',
                title: 'Remover registros irregulares?',
                html: `<p style="text-align:left">Foram encontrados <b>${paraRemover.length}</b> registros, somando <b>${pontosRemovidos} pontos</b>:</p>
                       <ul style="margin-top:8px">${listaHtml}</ul>
                       <p style="text-align:left; margin-top:10px">O detalhamento completo está no console (F12). Esta ação não pode ser desfeita.</p>`,
                showCancelButton: true,
                confirmButtonText: 'Sim, remover',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#ef4444'
            });

            if (!confirmacao.isConfirmed) {
                console.log(`${LOG} remoção cancelada pelo usuário.`);
                return { analisados: registros.length, paraRemover, removidos: 0 };
            }
        }

        let removidos = 0;
        for (const tabela of TABELAS) {
            const ids = paraRemover.filter(r => r._tabela === tabela).map(r => r.id);
            for (const lote of chunk(ids, 100)) {
                const { error } = await semacClient.from(tabela).delete().in('id', lote);
                if (error) console.error(`${LOG} erro ao remover de ${tabela}:`, error.message);
                else removidos += lote.length;
            }
        }

        console.log(`${LOG} ✅ ${removidos} registros removidos (${pontosRemovidos} pontos).`);

        if (typeof Swal !== 'undefined') {
            await Swal.fire('Limpeza concluída', `${removidos} registros removidos (${pontosRemovidos} pontos).`, 'success');
        }
        if (typeof carregarHistorico === 'function') await carregarHistorico();

        return { analisados: registros.length, paraRemover, removidos };
    }

    window.limparRegistrosSincronizados = limparRegistrosSincronizados;

})();
