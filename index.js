/**
 * SISTEMA N.E.O.N. - ENGINE DE INTERFACE (JS) FINAL
 * Versão: 3.5 - Adaptado para o Gemini 3.5 Core
 */

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

const URL_LOCAL = "http://localhost:3000";
const URL_NUVEM = "https://t1-p1-a5-o-despertar-da-ia.onrender.com";
const URL_ATIVA = URL_NUVEM; // Altere para URL_LOCAL se estiver rodando localmente

function adicionarMensagem(remetente, texto) {
    const div = document.createElement("div");
    div.classList.add("mensagem", remetente === "usuario" ? "msg-usuario" : "msg-ia");
    
    const textoFormatado = texto
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

    div.innerHTML = textoFormatado;
    chatBox.appendChild(div);

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

async function processarEnvioIA() {
    const mensagem = campoTexto.value.trim();
    const versaoModelo = seletorVersao ? seletorVersao.value : "gemini-3.5-flash"; // Ajustado fallback de modelo
    const nick = nicknameInput ? nicknameInput.value.trim() : "";

    if (!nick) {
        alert("⚠️ ATENÇÃO OPERADOR: Digite o seu NICK (apelido) antes de enviar comandos para participar do Ranking!");
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

btnEnviar.addEventListener("click", processarEnvioIA);
campoTexto.addEventListener("keypress", (e) => {
    if (e.key === "Enter") processarEnvioIA();
});

btnRanking.addEventListener("click", carregarRankingGlobal);
fecharRanking.addEventListener("click", () => modalRanking.style.display = "none");
window.addEventListener("click", (e) => {
    if (e.target === modalRanking) modalRanking.style.display = "none";
});

console.log("💠 Sistemas N.E.O.N. operando em carga total. Operação Gamificada.");

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
                chatBox.innerHTML += `<div class="mensagem msg-ia" style="background-color: #330000; border-color: red; color: white;">🔥 FIREWALL BYPASS: Coleção limpa no Atlas. FORMAT realizado!</div>`;
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