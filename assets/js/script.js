// Adicione isso no topo do seu HTML ou via CDN no JS
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js"></script>

const supabaseUrl = 'https://marmpnusgmbjphffaynr.supabase.co';
const supabaseKey = 'sb_publishable_ZVtndwPOvY2dA4Qzlwkl2A_H0-TeUgu';

const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// Máscara de CPF: 000.000.000-00
const cpfInput = document.getElementById('cpf');
cpfInput.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
    else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
    else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, '$1.$2');
    e.target.value = v;
});

const form = document.getElementById('loginForm');

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Carregando...';
    submitBtn.disabled = true;

    try {
        // 1. Pega o CPF e limpa pontos e traços (deixa só números)
        let cpfLimpo = document.getElementById('cpf').value.replace(/\D/g, '');
        const password = document.getElementById('password').value;

        // 2. Transforma o CPF em um "e-mail fictício" para o Supabase aceitar
        const emailFicticio = `${cpfLimpo}@email.com`;

        // 3. Tenta o login
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: emailFicticio, // Enviamos o CPF mascarado de e-mail
            password: password,
        });

        if (error) {
            alert("Erro no login: CPF ou senha incorretos.");
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        } else {
            // Busca o cargo na tabela profiles usando o ID do usuário logado
            const { data: perfil, error: perfilErr } = await supabaseClient
                .from('profiles')
                .select('role, cpf')
                .eq('id', data.user.id)
                .maybeSingle();

            if (perfilErr) {
                console.error("Erro ao buscar perfil:", perfilErr);
                alert("Erro ao carregar seu perfil. Tente novamente.");
            } else if (perfil) {
                // Redirecionamento baseado no cargo
                window.location.href = "painel.html";
            } else {
                console.warn("Perfil não encontrado após login.");
                alert("Cadastro incompleto. Favor procurar um administrador.");
                await supabaseClient.auth.signOut();
            }
        }
    } catch (err) {
        console.error("Erro de requisição login:", err);
        alert("Erro crítico no login, verifique o console.");
    } finally {
        if (submitBtn && window.location.href.indexOf('painel.html') === -1) {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }
});

// =============================================
// RECUPERAÇÃO DE SENHA
// =============================================

const GOOGLE_SCRIPT_URL_RESET = "https://script.google.com/macros/s/AKfycbwc-q6uBW3DigEvoQWOImXIlgPsBizoUwquUmaU2RXyHbjSVEvx4fLtAyBzIqNuveQR/exec";

function abrirRecuperacaoSenha() {
    const existente = document.getElementById('modal-recuperacao');
    if (existente) existente.remove();

    const modal = document.createElement('div');
    modal.id = 'modal-recuperacao';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';

    modal.innerHTML = `
        <div style="background:white; border-radius:20px; width:90%; max-width:440px; padding:32px; position:relative; box-shadow:0 25px 60px rgba(0,0,0,0.15); font-family:'Inter',system-ui,sans-serif;">
            <button onclick="document.getElementById('modal-recuperacao').remove()" style="position:absolute;top:14px;right:18px;background:none;border:none;font-size:20px;cursor:pointer;color:#94a3b8;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#94a3b8'">✕</button>
            
            <h2 style="margin:0 0 6px 0;color:#0f172a;font-size:1.3rem;">🔑 Recuperar Senha</h2>
            <p style="margin:0 0 20px 0;color:#64748b;font-size:0.85rem;">Confirme sua identidade para receber o link de redefinição.</p>
            
            <div id="etapa-verificacao">
                <div style="margin-bottom:14px;">
                    <label style="display:block;font-size:0.85rem;font-weight:600;color:#475569;margin-bottom:5px;">Nome Completo</label>
                    <input type="text" id="rec-nome" placeholder="Exatamente como cadastrado" style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:0.95rem;outline:none;font-family:inherit;box-sizing:border-box;" />
                </div>
                <div style="margin-bottom:20px;">
                    <label style="display:block;font-size:0.85rem;font-weight:600;color:#475569;margin-bottom:5px;">CPF</label>
                    <input type="text" id="rec-cpf" placeholder="000.000.000-00" maxlength="14" style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:0.95rem;outline:none;font-family:inherit;box-sizing:border-box;" />
                </div>
                <button id="btn-verificar-identidade" onclick="verificarIdentidadeRecuperacao()" style="width:100%;padding:13px;background:linear-gradient(135deg,#062117,#0c3e2b);color:white;border:none;border-radius:12px;font-size:0.95rem;font-weight:600;cursor:pointer;font-family:inherit;transition:all 0.2s;" onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 6px 20px rgba(6,33,23,0.3)'" onmouseout="this.style.transform='';this.style.boxShadow=''">Verificar Identidade</button>
            </div>
            
            <div id="etapa-email" style="display:none;">
                <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;padding:14px;margin-bottom:16px;">
                    <p style="margin:0;font-size:0.85rem;color:#92400e;font-weight:500;">⚠️ Você ainda não cadastrou um email no sistema. Digite seu email abaixo para continuar:</p>
                </div>
                <div style="margin-bottom:20px;">
                    <label style="display:block;font-size:0.85rem;font-weight:600;color:#475569;margin-bottom:5px;">Seu Email</label>
                    <input type="email" id="rec-email-novo" placeholder="seuemail@exemplo.com" style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:0.95rem;outline:none;font-family:inherit;box-sizing:border-box;" />
                </div>
                <button id="btn-salvar-email-enviar" onclick="salvarEmailEEnviarReset()" style="width:100%;padding:13px;background:linear-gradient(135deg,#062117,#0c3e2b);color:white;border:none;border-radius:12px;font-size:0.95rem;font-weight:600;cursor:pointer;font-family:inherit;transition:all 0.2s;">Salvar Email e Enviar Link</button>
            </div>
            
            <div id="etapa-sucesso" style="display:none; text-align:center;">
                <div style="font-size:3rem;margin-bottom:12px;">📧</div>
                <p style="color:#166534;font-weight:600;font-size:1rem;margin-bottom:6px;">Link enviado com sucesso!</p>
                <p id="msg-email-enviado" style="color:#64748b;font-size:0.85rem;margin-bottom:20px;"></p>
                <button onclick="document.getElementById('modal-recuperacao').remove()" style="padding:10px 24px;background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;border-radius:10px;font-size:0.9rem;cursor:pointer;font-family:inherit;">Fechar</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Máscara de CPF no modal
    const recCpf = document.getElementById('rec-cpf');
    recCpf.addEventListener('input', (e) => {
        let v = e.target.value.replace(/\D/g, '').slice(0, 11);
        if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
        else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
        else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, '$1.$2');
        e.target.value = v;
    });

    // Fechar ao clicar fora
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

// Dados temporários da recuperação
let dadosRecuperacao = {};

async function verificarIdentidadeRecuperacao() {
    const nome = document.getElementById('rec-nome').value.trim();
    const cpf = document.getElementById('rec-cpf').value.trim();

    if (!nome || !cpf) {
        alert('Preencha o nome completo e o CPF.');
        return;
    }

    const btn = document.getElementById('btn-verificar-identidade');
    btn.textContent = 'Verificando...';
    btn.disabled = true;

    try {
        const { data, error } = await supabaseClient.rpc('verificar_identidade_recuperacao', {
            p_nome: nome,
            p_cpf: cpf
        });

        if (error) throw error;

        if (!data.sucesso) {
            alert(data.mensagem);
            btn.textContent = 'Verificar Identidade';
            btn.disabled = false;
            return;
        }

        // Salvar dados para uso posterior
        dadosRecuperacao = {
            nome: nome,
            cpf: cpf,
            user_id: data.user_id,
            email_mascarado: data.email_mascarado || ''
        };

        if (!data.tem_email) {
            // Não tem email — mostrar etapa de cadastro
            document.getElementById('etapa-verificacao').style.display = 'none';
            document.getElementById('etapa-email').style.display = 'block';
        } else {
            // Tem email — gerar token e enviar
            await gerarTokenEEnviarEmail(data.user_id, data.email_mascarado);
        }

    } catch (err) {
        console.error('Erro na verificação:', err);
        alert('Erro ao verificar identidade: ' + (err.message || 'Tente novamente.'));
        btn.textContent = 'Verificar Identidade';
        btn.disabled = false;
    }
}

async function salvarEmailEEnviarReset() {
    const email = document.getElementById('rec-email-novo').value.trim();

    if (!email || !email.includes('@')) {
        alert('Digite um email válido.');
        return;
    }

    const btn = document.getElementById('btn-salvar-email-enviar');
    btn.textContent = 'Salvando...';
    btn.disabled = true;

    try {
        // Salvar email no perfil via RPC
        const { data, error } = await supabaseClient.rpc('salvar_email_recuperacao', {
            p_nome: dadosRecuperacao.nome,
            p_cpf: dadosRecuperacao.cpf,
            p_email: email
        });

        if (error) throw error;

        if (!data.sucesso) {
            alert(data.mensagem);
            btn.textContent = 'Salvar Email e Enviar Link';
            btn.disabled = false;
            return;
        }

        // Gerar token e enviar email
        await gerarTokenEEnviarEmail(data.user_id, data.email_mascarado);

    } catch (err) {
        console.error('Erro ao salvar email:', err);
        alert('Erro ao salvar email: ' + (err.message || 'Tente novamente.'));
        btn.textContent = 'Salvar Email e Enviar Link';
        btn.disabled = false;
    }
}

async function gerarTokenEEnviarEmail(userId, emailMascarado) {
    try {
        // 1. Gerar token via RPC
        const { data, error } = await supabaseClient.rpc('gerar_token_redefinicao', {
            p_user_id: userId
        });

        if (error) throw error;

        if (!data.sucesso) {
            alert(data.mensagem);
            return;
        }

        // 2. Montar link de redefinição
        const baseUrl = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/');
        const linkRedefinicao = `${baseUrl}redefinir-senha.html?token=${data.token}`;

        // 3. Enviar email via Google Apps Script
        await fetch(GOOGLE_SCRIPT_URL_RESET, {
            method: 'POST',
            mode: 'no-cors',
            cache: 'no-cache',
            body: JSON.stringify({
                to: data.email,
                subject: 'Redefinição de Senha - SEMAC',
                body: `Olá,\n\nVocê solicitou a redefinição de senha no sistema SEMAC.\n\nClique no link abaixo para criar uma nova senha (válido por 1 hora):\n\n${linkRedefinicao}\n\nSe você não solicitou esta redefinição, ignore este email.\n\nAtenciosamente,\nSistema SEMAC`
            })
        });

        // 4. Mostrar sucesso
        document.getElementById('etapa-verificacao').style.display = 'none';
        document.getElementById('etapa-email').style.display = 'none';
        document.getElementById('etapa-sucesso').style.display = 'block';
        document.getElementById('msg-email-enviado').textContent = 
            `Um link de redefinição foi enviado para ${emailMascarado}. Verifique sua caixa de entrada e spam.`;

    } catch (err) {
        console.error('Erro ao gerar token/enviar:', err);
        alert('Erro ao enviar link de redefinição: ' + (err.message || 'Tente novamente.'));
    }
}

