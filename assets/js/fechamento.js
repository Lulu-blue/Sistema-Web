// fechamento.js
// Lógica para consolidar anexos do ano em um arquivo ZIP

const safeSwalUpdate = (options) => {
    if (Swal.isVisible()) {
        Swal.update(options);
    }
};

async function executarFechamentoAnual() {
    console.log("[Fechamento] Iniciando execução anual...");
    const anoAtual = new Date().getFullYear();

    // 1. Mostrar feedback de carregamento
    Swal.fire({
        title: 'Gerando Fechamento ' + anoAtual,
        html: 'Buscando registros e preparando documentos...<br><b>Aguarde, isso pode demorar um pouco.</b>',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        // 2. Buscar todos os registros de controle_processual do ano atual
        // Nota: A coluna de data real pode variar, usaremos created_at como base se obterDataReal não filtrar no banco
        // Mas o ideal é carregar tudo e filtrar no JS para garantir paridade com as regras do sistema
        const { data: registros, error } = await supabaseClient
            .from('controle_processual')
            .select('*');

        if (error) throw error;

        // Filtrar pelo ano atual usando a lógica do sistema (obterDataReal)
        const registrosDoAno = registros.filter(reg => {
            const dt = typeof obterDataReal === 'function' ? obterDataReal(reg) : new Date(reg.created_at);
            return dt.getFullYear() === anoAtual;
        });

        if (registrosDoAno.length === 0) {
            Swal.fire('Aviso', 'Nenhum registro encontrado para o ano de ' + anoAtual, 'info');
            return;
        }

        // 3. Inicializar o ZIP
        const zip = new JSZip();
        const folderDocumentos = zip.folder(anoAtual.toString()).folder("Documentos");

        // 4. Agrupar por categoria e baixar arquivos
        const categoriasMap = {}; // ID -> Nome
        if (typeof CATEGORIAS !== 'undefined') {
            CATEGORIAS.forEach(c => categoriasMap[c.id] = c.nome);
        }

        let processados = 0;
        let falhas = 0;

        for (const reg of registrosDoAno) {
            const urlAnexo = reg.campos && reg.campos.anexo_pdf;
            if (!urlAnexo) continue;

            const catId = reg.categoria_id || 'Outros';
            const catNome = categoriasMap[catId] || ('Categoria ' + catId);
            const folderCategoria = folderDocumentos.folder(catNome.replace(/[\\\/:*?"<>|]/g, ''));

            // Definir nome do arquivo (Número Sequencial)
            const numero = (reg.numero_sequencial || reg.id).toString().replace(/[\\\/:*?"<>|]/g, '-');
            const extensao = urlAnexo.split('.').pop().split('?')[0]; // Pegar extensão antes de query params
            const fileName = `${numero}.${extensao}`;

            try {
                // Baixar o arquivo
                const response = await fetch(urlAnexo);
                if (!response.ok) throw new Error('Falha no download');
                const blob = await response.blob();

                // Salvar o arquivo diretamente na pasta da categoria
                folderCategoria.file(fileName, blob);
                processados++;
            } catch (err) {
                console.error(`Erro ao baixar anexo de ${numero}:`, err);
                falhas++;
            }

            // Atualizar progresso no Swal
            safeSwalUpdate({
                html: `Processando: ${processados} arquivos...<br>${falhas > 0 ? falhas + ' falhas.' : ''}`
            });
        }

        if (processados === 0) {
            Swal.fire('Aviso', 'Nenhum anexo encontrado nos registros de ' + anoAtual, 'info');
            return;
        }

        // 5. Gerar Planilha ODS
        safeSwalUpdate({
            title: 'Gerando Planilha...',
            html: 'Criando tabelas de dados.'
        });

        const workbook = XLSX.utils.book_new();
        const folderTabela = zip.folder(anoAtual.toString()).folder("Tabela");

        // Agrupar registros para a planilha
        const regsPorCategoria = {};
        registrosDoAno.forEach(r => {
            const catId = r.categoria_id || 'Outros';
            if (!regsPorCategoria[catId]) regsPorCategoria[catId] = [];
            regsPorCategoria[catId].push(r);
        });

        // Criar uma aba para cada categoria que possui registros
        for (const [catId, lista] of Object.entries(regsPorCategoria)) {
            const catDef = typeof CATEGORIAS !== 'undefined' ? CATEGORIAS.find(c => c.id === catId) : null;
            const catNome = catDef ? catDef.nome : ("Categoria " + catId);
            const nomeAba = catNome.substring(0, 31).replace(/[\\\/:*?"<>|]/g, ''); // Limite de 31 caracteres para abas

            // Definir Cabeçalhos
            let headers = [];
            const temNumero = lista.some(r => r.numero_sequencial);
            if (temNumero) headers.push("N°");

            // Campos específicos da categoria (filtrando como na tabela do painel)
            const camposDef = catDef?.campos?.filter(c => c.tipo !== 'file' && c.tipo !== 'date' && !c.ignorarNoBanco) || [];
            camposDef.forEach(c => headers.push(c.label));

            headers.push("Fiscal", "Data", "Pontos");

            // Colunas extras para NP (1.1) e Auto de Infração (1.2)
            const isNPOuAuto = catId === '1.1' || catId === '1.2';
            if (isNPOuAuto) {
                headers.push("Data de Entrada", "Data de Vencimento", "Histórico Administrativo", "Resposta do Fiscal");
            }

            // Criar Matriz de Dados (AOA)
            const rows = [headers];

            lista.forEach(reg => {
                const row = [];
                if (temNumero) row.push(reg.numero_sequencial || '-');

                camposDef.forEach(c => {
                    row.push(reg.campos?.[c.nome] || '-');
                });

                const dataFmt = typeof obterDataReal === 'function' ? obterDataReal(reg).toLocaleDateString('pt-BR') : new Date(reg.created_at).toLocaleDateString('pt-BR');
                row.push(reg.fiscal_nome || '-', dataFmt, reg.pontuacao || 0);

                if (isNPOuAuto) {
                    const c = reg.campos || {};
                    row.push(
                        c.data_entrada ? c.data_entrada.split('-').reverse().join('/') : '-',
                        c.data_vencimento ? c.data_vencimento.split('-').reverse().join('/') : '-',
                        c.historico_admin || '-',
                        c.resposta_fiscal || '-'
                    );
                }
                rows.push(row);
            });

            const worksheet = XLSX.utils.aoa_to_sheet(rows);

            // --- APLICAR ESTILOS (Cabeçalho) ---
            const range = XLSX.utils.decode_range(worksheet['!ref']);
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const address = XLSX.utils.encode_col(C) + "1"; // Primeira linha
                if (!worksheet[address]) continue;
                worksheet[address].s = {
                    fill: { fgColor: { rgb: "E2E2E2" } }, // Fundo Cinza
                    font: { sz: 14, bold: true },        // Letra maior e Negrito
                    alignment: { vertical: "center", horizontal: "center" }
                };
            }

            // --- CONFIGURAÇÕES DA ABA ---
            const rowHeights = [];
            for (let R = range.s.r; R <= range.e.r; ++R) {
                if (R === 0) {
                    rowHeights.push({ hpt: 30 }); // Cabeçalho: 30pt
                } else {
                    rowHeights.push({ hpt: 20 }); // Demais: 20pt (2/3 de 30)
                }
            }
            worksheet['!rows'] = rowHeights;
            worksheet['!views'] = [{ state: 'frozen', ySplit: 1 }]; // Congelar primeira linha

            // Ajustar largura das colunas
            const colWidths = [];
            for (let C = range.s.c; C <= range.e.c; ++C) {
                colWidths.push({ wch: 30 });
            }
            worksheet['!cols'] = colWidths;

            XLSX.utils.book_append_sheet(workbook, worksheet, nomeAba);
        }

        const xlsxBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        folderTabela.file(`Fechamento_${anoAtual}.xlsx`, xlsxBuffer);

        // --- 5.1 Gerar Planilha "Banco de Dados.xlsx" ---
        // Exportação bruta (todas as colunas do Supabase)
        const workbookDB = XLSX.utils.book_new();

        // Flattening the data (opcional: transformar o objeto 'campos' em colunas individuais se necessário, 
        // mas o pedido diz "igual ao supabase", que geralmente implica as colunas da tabela)
        const rawRows = registrosDoAno.map(r => {
            const flat = { ...r };
            // Transformar o JSON 'campos' em strings para caber na planilha se necessário,
            // ou deixar as colunas originais
            if (flat.campos) flat.campos = JSON.stringify(flat.campos);
            return flat;
        });

        const worksheetDB = XLSX.utils.json_to_sheet(rawRows);
        XLSX.utils.book_append_sheet(workbookDB, worksheetDB, "controle_processual");

        const dbBuffer = XLSX.write(workbookDB, { bookType: 'xlsx', type: 'array' });
        folderTabela.file(`Banco de Dados.xlsx`, dbBuffer);

        // 6. Gerar o ZIP final e baixar
        safeSwalUpdate({
            title: 'Compactando...',
            html: 'Quase pronto! Gerando arquivo ZIP final.'
        });

        const zipBlob = await zip.generateAsync({ type: "blob" });
        console.log("[Fechamento] ZIP gerado com sucesso. Tamanho:", zipBlob.size, "bytes");

        // --- 7. Salvar com Verificação (Exige novo gesto do usuário para evitar SecurityError) ---
        Swal.fire({
            title: 'Fechamento Gerado!',
            text: 'O arquivo ZIP está pronto. Clique no botão abaixo para escolher onde salvar no seu computador.',
            icon: 'success',
            confirmButtonText: '📁 Escolher local e Salvar',
            showCancelButton: true,
            cancelButtonText: 'Cancelar',
            allowOutsideClick: false
        }).then(async (result) => {
            if (result.isConfirmed) {
                if ('showSaveFilePicker' in window) {
                    try {
                        const handle = await window.showSaveFilePicker({
                            suggestedName: `${anoAtual}.zip`,
                            types: [{
                                description: 'Arquivo ZIP',
                                accept: { 'application/zip': ['.zip'] },
                            }],
                        });

                        const writable = await handle.createWritable();
                        await writable.write(zipBlob);
                        await writable.close();

                        await Swal.fire('Sucesso!', `O arquivo ${anoAtual}.zip foi salvo com sucesso.`, 'success');
                        iniciarFluxoEmail(zipBlob, anoAtual);
                    } catch (err) {
                        if (err.name === 'AbortError') {
                            Swal.fire('Cancelado', 'O salvamento foi cancelado.', 'info');
                        } else {
                            console.error("Erro ao usar File Picker:", err);
                            saveAs(zipBlob, `${anoAtual}.zip`);
                            iniciarFluxoEmail(zipBlob, anoAtual);
                        }
                    }
                } else {
                    // Fallback para navegadores sem File System Access API
                    saveAs(zipBlob, `${anoAtual}.zip`);
                    iniciarFluxoEmail(zipBlob, anoAtual);
                }
            }
        });

    } catch (err) {
        console.error("Erro no fechamento anual:", err);
        Swal.fire('Erro', 'Ocorreu um erro ao gerar o fechamento: ' + err.message, 'error');
    }
}

// --- NOVO FLUXO DE E-MAIL COM VERIFICAÇÃO REAL (OTP) ---
function validarEmailFmt(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

async function iniciarFluxoEmail(zipBlob, anoAtual) {
    try {
        const { data: { user } } = await getAuthUser();
        const { data: perfil, error: errPerfil } = await supabaseClient
            .from('profiles')
            .select('email_real, email_verificado')
            .eq('id', user.id)
            .maybeSingle();

        if (errPerfil) {
            if (errPerfil.status === 400) {
                throw new Error("As colunas 'email_real' ou 'email_verificado' não existem no seu banco de dados. Rode o SQL fornecido no Dashboard.");
            }
            throw errPerfil;
        }

        let emailDestino = perfil?.email_real;
        let verificado = perfil?.email_verificado || false;

        // Loop de obrigatoriedade: Garante e-mail válido E verificado
        while (true) {
            // 1. Validar ou Registrar E-mail (Loop até ser válido)
            while (!emailDestino || !validarEmailFmt(emailDestino)) {
                emailDestino = await registrarEmailNoAto(user.id);
                if (!emailDestino) {
                    const { isConfirmed } = await Swal.fire({
                        title: 'E-mail Obrigatório',
                        text: 'O envio por e-mail é obrigatório para concluir o fechamento e liberar a limpeza de dados.',
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'Informar E-mail',
                        cancelButtonText: 'Cancelar Fechamento'
                    });
                    if (!isConfirmed) return; // Cancela tudo se desistir do fechamento
                }
                verificado = false; // Novo e-mail exige nova verificação
            }

            // 2. Fluxo de Verificação (Garante que o e-mail "realmente existe")
            if (!verificado) {
                const sucessoV = await realizarVerificacaoOTP(user.id, emailDestino);
                if (!sucessoV) {
                    // Se clicou em "Voltar", limpa para pedir um novo no início do loop
                    emailDestino = null;
                    continue;
                }
            }
            
            // Se chegou aqui, está validado e verificado
            break;
        }

        // 3. Envio Obrigatório do ZIP
        await enviarZipPorEmail(zipBlob, emailDestino, anoAtual);

        // 4. Prosseguir para a limpeza
        perguntarAgendamentoLimpeza(anoAtual);

    } catch (err) {
        console.error("Erro no fluxo de e-mail:", err);
        Swal.fire('Erro', 'Falha no processo de segurança de e-mail: ' + err.message, 'error');
        perguntarAgendamentoLimpeza(anoAtual);
    }
}

async function realizarVerificacaoOTP(userId, email) {
    // Gerar código de 6 dígitos
    const codigoGerado = Math.floor(100000 + Math.random() * 900000).toString();
    const remetenteOficial = "gerenciasemac.documentacao@gmail.com";

    console.log(`[Verificação] Enviando código ${codigoGerado} para ${email}`);

    try {
        // Disparar e-mail com o código via Google Apps Script (sem anexo)
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            cache: 'no-cache',
            body: JSON.stringify({
                to: email,
                subject: `Código de Verificação SEMAC: ${codigoGerado}`,
                body: `Olá,\n\nSeu código de verificação para o sistema SEMAC é: ${codigoGerado}\n\nEste código é necessário para validar seu e-mail e permitir o fechamento anual.`
            })
        });
    } catch (err) {
        console.error("Erro ao enviar código via Google:", err);
    }

    const { value: codigoInserido } = await Swal.fire({
        title: 'Verificando E-mail',
        html: `O remetente <b>${remetenteOficial}</b> enviou um código para <b>${email}</b>.<br><br>Verifique sua caixa de entrada e insira o código:`,
        icon: 'info',
        input: 'text',
        inputAttributes: { maxlength: 6, style: 'text-align: center; letter-spacing: 5px; font-size: 2rem;' },
        showCancelButton: true,
        confirmButtonText: 'Verificar Código',
        cancelButtonText: 'Voltar',
        allowOutsideClick: false,
        inputValidator: (value) => {
            if (!value) return 'Você precisa digitar o código!';
            if (value !== codigoGerado) return 'Código incorreto!';
        }
    });

    if (codigoInserido === codigoGerado) {
        await Swal.fire({
            title: 'E-mail Confirmado!',
            text: 'A posse do e-mail foi validada com sucesso.',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
        });

        // Salvar status no banco
        await supabaseClient.from('profiles').update({ email_verificado: true }).eq('id', userId);
        return true;
    }
    return false;
}

async function registrarEmailNoAto(userId) {
    const { value: email } = await Swal.fire({
        title: 'Registro de E-mail',
        text: 'O fechamento exige o envio para um e-mail válido:',
        input: 'email',
        inputPlaceholder: 'seu@email.com',
        allowOutsideClick: false,
        inputValidator: (value) => {
            if (!value) return 'O e-mail é necessário!';
            if (!validarEmailFmt(value)) return 'Formato de e-mail inválido!';
        }
    });

    if (email) {
        await supabaseClient.from('profiles').update({ email_real: email, email_verificado: false }).eq('id', userId);
        const inputE = document.getElementById('perfil-email');
        if (inputE) inputE.value = email;
        return email;
    }
    return null;
}

// Cole aqui o URL que você copiou do Google Apps Script
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwc-q6uBW3DigEvoQWOImXIlgPsBizoUwquUmaU2RXyHbjSVEvx4fLtAyBzIqNuveQR/exec";

async function enviarZipPorEmail(blob, email, ano) {
    console.log("[E-mail] Iniciando fluxo de envio via Google Apps Script para:", email);
    try {
        if (Swal.isVisible()) {
            Swal.update({
                title: 'Preparando E-mail...',
                html: `Convertendo arquivo e preparando envio direto para <b>${email}</b>...`
            });
        } else {
            Swal.fire({
                title: 'Preparando E-mail...',
                html: `Convertendo arquivo e preparando envio direto para <b>${email}</b>...`,
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });
        }

        // 1. Converter Blob para Base64
        const reader = new FileReader();
        const base64Promise = new Promise((resolve) => {
            reader.onloadend = () => {
                console.log("[E-mail] Conversão para Base64 concluída.");
                resolve(reader.result);
            };
            reader.readAsDataURL(blob);
        });
        const base64Data = await base64Promise;

        safeSwalUpdate({
            title: 'Enviando...',
            html: `O Google está processando o envio do e-mail direto para <b>${email}</b>.`
        });
        if (Swal.isVisible()) Swal.showLoading();

        // 2. Disparo via Google Apps Script (Sem intermediários externos)
        console.log("[E-mail] Chamando Google Apps Script...");
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', // Necessário para Google Scripts de navegador
            cache: 'no-cache',
            body: JSON.stringify({
                to: email,
                subject: `Fechamento Anual SEMAC - ${ano}`,
                body: `Olá,\n\nSegue em anexo o arquivo ZIP do fechamento anual de ${ano}.\n\nEste é um envio direto via Google Apps Script.`,
                fileName: `fechamento_${ano}.zip`,
                attachmentBase64: base64Data
            })
        });

        // Como usamos 'no-cors', não conseguimos ler a resposta exata, 
        // mas se não deu erro no fetch, o Google recebeu a tarefa.
        console.log("[E-mail] Solicitação enviada ao Google.");

        await Swal.fire({
            title: 'E-mail em Processamento!',
            html: `O arquivo ZIP foi enviado para o seu script pessoal do Google. Verifique o seu Gmail enviado em instantes para confirmar o recebimento em <b>${email}</b>.`,
            icon: 'success'
        });

        return true;

    } catch (err) {
        console.error("Erro no envio via Google:", err);
        Swal.fire({
            title: 'Erro no Envio',
            html: `Não foi possível conectar ao Google Script: <br><br><b>${err.message}</b>`,
            icon: 'error'
        });
        return false;
    }
}

// Nova função para agendar a limpeza
function perguntarAgendamentoLimpeza(anoAtual) {
    const anoAnterior = anoAtual - 1;
    Swal.fire({
        title: 'Agendar Limpeza?',
        text: `Deseja agendar a limpeza automática dos dados de ${anoAnterior} para daqui a 30 dias (1 minuto para teste)? Isso removerá permanentemente os registros do ano anterior do banco de dados.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sim, agendar',
        cancelButtonText: 'Não agora',
        confirmButtonColor: '#10b981'
    }).then((result) => {
        if (result.isConfirmed) {
            // Para teste: 1 minuto (60000ms)
            // Para produção: 30 dias (30 * 24 * 60 * 60 * 1000)
            const tempoEspera = 60 * 1000;
            const dataExecucao = Date.now() + tempoEspera;

            localStorage.setItem('agendamento_limpeza_data', dataExecucao.toString());
            localStorage.setItem('agendamento_limpeza_ano', anoAnterior.toString());

            Swal.fire('Agendado!', `A limpeza dos dados de ${anoAnterior} ocorrerá em 1 minuto. Mantenha o site aberto ou retorne em breve.`, 'success');
        }
    });
}
