/**
 * SISTEMA N.E.O.N. - ENGINE DE INTERFACE (JS) FINAL
 * Versão: 2.3 - Sincronização e Diagnóstico de Erros
 */

// 1. MAPEAMENTO DE SENSORES (ELEMENTOS DA INTERFACE)
const chatBox = document.getElementById("caixa-chat");
const campoTexto = document.getElementById("campoTexto");
const btnEnviar = document.getElementById("btnEnviar");
const seletorVersao = document.getElementById("seletor-versao");

// Estado global para evitar sobrecarga no link neural
let estaProcessando = false;

// ====================================================================
// CONFIGURAÇÃO DE CONEXÃO (Escolha qual servidor deseja consumir)
// ====================================================================
// Para testar localmente no seu computador (com o Node.js rodando no terminal)
const URL_LOCAL = "http://localhost:3000";

// Para usar a API que você publicou no Render
const URL_NUVEM = "https://t1-p1-a5-o-despertar-da-ia.onrender.com";

// --- SELECIONE A URL ATIVA ---
const URL_ATIVA = URL_NUVEM; // Altere para URL_LOCAL se estiver rodando localmente
// ====================================================================

/**
 * Função Mestra de Renderização
 * Adiciona mensagens à tela convertendo Markdown básico para HTML.
 */
function adicionarMensagem(remetente, texto) {
    const div = document.createElement("div");
    div.classList.add("mensagem", remetente === "usuario" ? "msg-usuario" : "msg-ia");
    
    // Tratamento de Texto: Converte quebras de linha (\n) e Negritos (**)
    const textoFormatado = texto
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

    div.innerHTML = textoFormatado;
    chatBox.appendChild(div);

    // Scroll Suave para a última entrada de dados
    chatBox.scrollTo({
        top: chatBox.scrollHeight,
        behavior: 'smooth'
    });
}

/**
 * Sinalizador Visual de Processamento
 * Cria os pontinhos pulsantes de sincronização.
 */
function mostrarLoading() {
    const loadingDiv = document.createElement("div");
    loadingDiv.classList.add("mensagem", "msg-ia");
    loadingDiv.id = "loading-neon";
    loadingDiv.innerHTML = `
        <span class="pulso">.</span>
        <span class="pulso" style="animation-delay: 0.2s">.</span>
        <span class="pulso" style="animation-delay: 0.4s">.</span>
    `;
    chatBox.appendChild(loadingDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

/**
 * Remove o sinalizador de processamento da interface.
 */
function removerLoading() {
    const loading = document.getElementById("loading-neon");
    if (loading) loading.remove();
}

/**
 * Fluxo de Comunicação Neural
 * Captura dados, envia para o Back-end e gerencia a resposta.
 */
async function processarEnvioIA() {
    const mensagem = campoTexto.value.trim();
    const versaoModelo = seletorVersao ? seletorVersao.value : "gemini-2.0-flash";

    // Validação de entrada e estado do sistema
    if (mensagem === "" || estaProcessando) return;

    try {
        // Bloqueio de segurança da interface
        estaProcessando = true;
        btnEnviar.disabled = true;
        btnEnviar.style.opacity = "0.5";

        // Feedback Visual do Operador
        adicionarMensagem("usuario", mensagem);
        campoTexto.value = ""; 
        mostrarLoading();

        // Conecta ao endpoint correto (/api/chat)
        const respostaServidor = await fetch(`${URL_ATIVA}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                pergunta: mensagem, 
                modelo: versaoModelo 
            })
        });

        if (!respostaServidor.ok) {
            // Tenta ler o JSON de erro do backend para diagnosticar na interface
            const dadosErro = await respostaServidor.json().catch(() => ({}));
            throw new Error(dadosErro.erro || "Falha no link neural.");
        }

        const dados = await respostaServidor.json();

        // Exibição do resultado obtido da nuvem
        removerLoading();
        adicionarMensagem("ia", dados.resposta);

    } catch (erro) {
        removerLoading();
        console.error("Falha Crítica:", erro);
        
        let msgErro = erro.message || "⚠️ FALHA NO NÚCLEO: Link neural interrompido. Verifique o servidor Node.js no terminal.";
        if (erro.name === 'TimeoutError') msgErro = "⚠️ TIMEOUT: O sinal demorou muito a retornar da nuvem.";
        
        adicionarMensagem("ia", `<span style="color: #ff5555">${msgErro}</span>`);
    } finally {
        // Liberação dos controles do Operador
        estaProcessando = false;
        btnEnviar.disabled = false;
        btnEnviar.style.opacity = "1";
        campoTexto.focus(); 
    }
}

// GATILHOS DE COMANDO
btnEnviar.addEventListener("click", processarEnvioIA);

campoTexto.addEventListener("keypress", (e) => {
    if (e.key === "Enter") processarEnvioIA();
});

// ESTILIZAÇÃO DINÂMICA (Para o pulso do loading)
const styleNode = document.createElement('style');
styleNode.innerHTML = `
    .pulso {
        animation: pulsoAnim 1.4s infinite;
        font-size: 26px;
        font-weight: bold;
        display: inline-block;
        color: #00e5ff;
    }
    @keyframes pulsoAnim {
        0%, 100% { opacity: 0.2; transform: scale(1); }
        50% { opacity: 1; transform: scale(1.3); }
    }
`;
document.head.appendChild(styleNode);

console.log("💠 Sistemas N.E.O.N. operando em carga total. Aguardando comandos, Operador.");

// ====================================================================
// [DESAFIO HACKER] - ROTINA DE ANOSMIA FORÇADA (LIMPEZA DO MONGODB)
// ====================================================================
const btnLimparMemoria = document.getElementById("btnLimpar");

btnLimparMemoria.addEventListener("click", async () => {
    const confirmacao = confirm("⚠️ ALERTA HACKER: Deseja apagar todo o Banco de Dados MongoDb? Isso matará as memórias de Longo Prazo do N.E.O.N. !");
    
    if (confirmacao) {
        try {
            adicionarMensagem("ia", `<span style="color: #ffcc00">⚠️ Solicitando limpeza do MongoDB na Cloud...</span>`);
            btnLimparMemoria.disabled = true;

            const rotaLimpeza = await fetch(`${URL_ATIVA}/api/chat/limpar`, {
                method: 'DELETE'
            });

            if (rotaLimpeza.ok) {
                chatBox.innerHTML += `<div class="mensagem msg-ia" style="background-color: #330000; border-color: red; color: white;">🔥 FIREWALL BYPASS: Coleção limpa no Atlas. FORMAT realizado!</div>`;
                chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
                console.log("Banco Dropado Com Sucesso.");
            } else {
                const erroResposta = await rotaLimpeza.json().catch(() => ({}));
                throw new Error(erroResposta.erro || "Erro HTTP na rota de limpeza.");
            }
        } catch (erroDelete) {
            adicionarMensagem("ia", `<span style="color: #ff5555">⚠️ FORMAT FALHOU: ${erroDelete.message}</span>`);
        } finally {
            btnLimparMemoria.disabled = false;
            campoTexto.focus();
        }
    }
});

/**
 * SISTEMA N.E.O.N. - ENGINE DE INTERFACE (JS) FINAL
 * Versão: 2.4 - Gamificação, Nickname e Ranking
 */

// 1. MAPEAMENTO DE SENSORES
const chatBox = document.getElementById("caixa-chat");
const campoTexto = document.getElementById("campoTexto");
const btnEnviar = document.getElementById("btnEnviar");
const seletorVersao = document.getElementById("seletor-versao");
const nicknameInput = document.getElementById("nickname");
const btnRanking = document.getElementById("btnRanking");
const modalRanking = document.getElementById("modalRanking");
const fecharRanking = document.getElementById("fecharRanking");
const rankingTabela = document.getElementById("rankingTabela");

let estaProcessando = false;

// ====================================================================
// CONFIGURAÇÃO DE ENDPOINTS
// ====================================================================
const URL_LOCAL = "http://localhost:3000";
const URL_NUVEM = "https://t1-p1-a5-o-despertar-da-ia.onrender.com";

// --- SELECIONE A URL ATIVA ---
const URL_ATIVA = URL_NUVEM; // Altere para URL_LOCAL se estiver rodando localmente
// ====================================================================

/**
 * Função Mestra de Renderização com Gatilho de Confetes (Desafio Hacker)
 */
function adicionarMensagem(remetente, texto) {
    const div = document.createElement("div");
    div.classList.add("mensagem", remetente === "usuario" ? "msg-usuario" : "msg-ia");
    
    const textoFormatado = texto
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

    div.innerHTML = textoFormatado;
    chatBox.appendChild(div);

    // DESAFIO HACKER: Estourar confete se a IA disser palavras festivas/acertos
    if (remetente === "ia") {
        const textoLowerCase = texto.toLowerCase();
        if (textoLowerCase.includes("parabéns") || textoLowerCase.includes("acertou") || textoLowerCase.includes("correto") || textoLowerCase.includes("parabens")) {
            executarConfete();
        }
    }

    chatBox.scrollTo({
        top: chatBox.scrollHeight,
        behavior: 'smooth'
    });
}

function executarConfete() {
    if (typeof confetti === "function") {
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        });
    }
}

function mostrarLoading() {
    const loadingDiv = document.createElement("div");
    loadingDiv.classList.add("mensagem", "msg-ia");
    loadingDiv.id = "loading-neon";
    loadingDiv.innerHTML = `<span class="pulso">.</span><span class="pulso" style="animation-delay: 0.2s">.</span><span class="pulso" style="animation-delay: 0.4s">.</span>`;
    chatBox.appendChild(loadingDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function removerLoading() {
    const loading = document.getElementById("loading-neon");
    if (loading) loading.remove();
}

/**
 * Fluxo de Comunicação Neural
 */
async function processarEnvioIA() {
    const mensagem = campoTexto.value.trim();
    const versaoModelo = seletorVersao ? seletorVersao.value : "gemini-2.0-flash";
    const nick = nicknameInput ? nicknameInput.value.trim() : "";

    // FASE 1: Validação de Nickname Obrigatório
    if (!nick) {
        alert("⚠️ ATENÇÃO OPERADOR: Você precisa digitar um apelido (NICK) no cabeçalho antes de enviar sua mensagem!");
        nicknameInput.focus();
        return;
    }

    if (mensagem === "" || estaProcessando) return;

    try {
        estaProcessando = true;
        btnEnviar.disabled = true;
        btnEnviar.style.opacity = "0.5";

        adicionarMensagem("usuario", mensagem);
        campoTexto.value = ""; 
        mostrarLoading();

        // Envia pergunta + nickname atual do operador
        const respostaServidor = await fetch(`${URL_ATIVA}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                pergunta: mensagem, 
                modelo: versaoModelo,
                nickname: nick
            })
        });

        if (!respostaServidor.ok) {
            const dadosErro = await respostaServidor.json().catch(() => ({}));
            throw new Error(dadosErro.erro || "Falha no link neural.");
        }

        const dados = await respostaServidor.json();

        removerLoading();
        adicionarMensagem("ia", dados.resposta);

    } catch (erro) {
        removerLoading();
        console.error("Falha Crítica:", erro);
        let msgErro = erro.message || "⚠️ FALHA NO NÚCLEO: Link neural interrompido. Verifique o servidor Node.js.";
        adicionarMensagem("ia", `<span style="color: #ff5555">${msgErro}</span>`);
    } finally {
        estaProcessando = false;
        btnEnviar.disabled = false;
        btnEnviar.style.opacity = "1";
        campoTexto.focus(); 
    }
}

/**
 * FASE 5: Busca e Desenho do Ranking Global (Tabela)
 */
async function carregarRankingGlobal() {
    rankingTabela.innerHTML = `<span style="color: #00f2ff">📡 Estabelecendo conexão de dados com o Ranking...</span>`;
    modalRanking.style.display = "flex";

    try {
        const resposta = await fetch(`${URL_ATIVA}/api/ranking`);
        if (!resposta.ok) throw new Error("Erro de rede ao buscar Leaderboard.");

        const jogadores = await resposta.json();
        
        if (jogadores.length === 0) {
            rankingTabela.innerHTML = `<p style="text-align: center; color: #888;">Nenhum jogador registrado no Hall da Fama ainda.</p>`;
            return;
        }

        let htmlTabela = `<table>
            <thead>
                <tr>
                    <th style="width: 20%;">RANK</th>
                    <th style="text-align: left;">JOGADOR / TÍTULO</th>
                    <th style="text-align: right;">XP</th>
                </tr>
            </thead>
            <tbody>`;

        jogadores.forEach((jogador, index) => {
            // Desenha as medalhas para os 3 primeiros lugares
            let rankMedalha = index + 1;
            if (index === 0) rankMedalha = "🥇";
            else if (index === 1) rankMedalha = "🥈";
            else if (index === 2) rankMedalha = "🥉";

            htmlTabela += `
                <tr>
                    <td style="text-align: center; font-weight: bold;">${rankMedalha}</td>
                    <td style="text-align: left; color: #fff;">${jogador.nome}</td>
                    <td style="text-align: right; color: #e1b12c; font-weight: bold;">${jogador.xp} XP</td>
                </tr>`;
        });

        htmlTabela += `</tbody></table>`;
        rankingTabela.innerHTML = htmlTabela;

    } catch (e) {
        rankingTabela.innerHTML = `<span style="color: #ff5555">❌ Falha ao carregar ranking: ${e.message}</span>`;
    }
}

// GATILHOS DE COMANDO
btnEnviar.addEventListener("click", processarEnvioIA);
campoTexto.addEventListener("keypress", (e) => {
    if (e.key === "Enter") processarEnvioIA();
});

// Eventos do Modal de Ranking
btnRanking.addEventListener("click", carregarRankingGlobal);
fecharRanking.addEventListener("click", () => modalRanking.style.display = "none");
window.addEventListener("click", (e) => {
    if (e.target === modalRanking) modalRanking.style.display = "none";
});

console.log("💠 Sistemas N.E.O.N. operando em carga total. Operação Gamificada.");

// ====================================================================
// ROTINA DE LIMPEZA
// ====================================================================
const btnLimparMemoria = document.getElementById("btnLimpar");
btnLimparMemoria.addEventListener("click", async () => {
    const confirmacao = confirm("⚠️ ALERTA HACKER: Deseja apagar todo o Banco de Dados MongoDb? Isso removerá o histórico e as memórias de XP de todos os jogadores!");
    
    if (confirmacao) {
        try {
            adicionarMensagem("ia", `<span style="color: #ffcc00">⚠️ Solicitando limpeza do MongoDB na Cloud...</span>`);
            btnLimparMemoria.disabled = true;

            const rotaLimpeza = await fetch(`${URL_ATIVA}/api/chat/limpar`, {
                method: 'DELETE'
            });

            if (rotaLimpeza.ok) {
                chatBox.innerHTML += `<div class="mensagem msg-ia" style="background-color: #330000; border-color: red; color: white;">🔥 FIREWALL BYPASS: Coleções limpas no Atlas. FORMAT realizado!</div>`;
                chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
            } else {
                const erroResposta = await rotaLimpeza.json().catch(() => ({}));
                throw new Error(erroResposta.erro || "Erro HTTP na rota de limpeza.");
            }
        } catch (erroDelete) {
            adicionarMensagem("ia", `<span style="color: #ff5555">⚠️ FORMAT FALHOU: ${erroDelete.message}</span>`);
        } finally {
            btnLimparMemoria.disabled = false;
            campoTexto.focus();
        }
    }
});