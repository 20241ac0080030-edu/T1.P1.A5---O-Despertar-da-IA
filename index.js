/**
 * SISTEMA N.E.O.N. 3.5 VISION - ENGINE DE INTERFACE MULTIMODAL
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

// Elementos de Upload de Imagem
const inputImagem = document.getElementById("inputImagem");
const containerPreview = document.getElementById("containerPreview");
const imgPreview = document.getElementById("imgPreview");
const btnRemoverImagem = document.getElementById("btnRemoverImagem");

let arquivoImagemSelecionado = null;
let estaProcessando = false;

const URL_LOCAL = "http://localhost:3000";
const URL_NUVEM = "https://t1-p1-a5-o-despertar-da-ia.onrender.com";

const URL_ATIVA = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.protocol === "file:") 
    ? URL_LOCAL 
    : URL_NUVEM;

// Gerenciamento de Preview da Imagem
inputImagem.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
        if (!file.type.startsWith("image/")) {
            alert("⚠️ Por favor, selecione apenas arquivos de imagem!");
            inputImagem.value = "";
            return;
        }
        arquivoImagemSelecionado = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            imgPreview.src = e.target.result;
            containerPreview.style.display = "flex";
        };
        reader.readAsDataURL(file);
    }
});

btnRemoverImagem.addEventListener("click", () => {
    limparSelecaoImagem();
});

function limparSelecaoImagem() {
    arquivoImagemSelecionado = null;
    inputImagem.value = "";
    imgPreview.src = "";
    containerPreview.style.display = "none";
}

function adicionarMensagem(remetente, texto, urlImagem = null) {
    const div = document.createElement("div");
    div.classList.add("mensagem", remetente === "usuario" ? "msg-usuario" : "msg-ia");
    
    let htmlConteudo = "";

    // Renderiza imagem caso exista (URL do Cloudinary ou Preview local)
    if (urlImagem) {
        htmlConteudo += `<img src="${urlImagem}" class="chat-img-anexada" alt="Anexo Visual" />`;
    }

    if (texto) {
        const textoFormatado = texto
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
        htmlConteudo += `<div>${textoFormatado}</div>`;
    }

    div.innerHTML = htmlConteudo;
    chatBox.appendChild(div);

    if (remetente === "ia") {
        const textoLowerCase = (texto || "").toLowerCase();
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
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
}

function mostrarLoading() {
    const loadingDiv = document.createElement("div");
    loadingDiv.classList.add("mensagem", "msg-ia");
    loadingDiv.id = "loading-neon";
    loadingDiv.innerHTML = `<span class="pulso">.</span><span class="pulso" style="animation-delay: 0.2s">.</span><span class="pulso" style="animation-delay: 0.4s">.</span> Processando visão neural...`;
    chatBox.appendChild(loadingDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function removerLoading() {
    const loading = document.getElementById("loading-neon");
    if (loading) loading.remove();
}

async function processarEnvioIA() {
    const mensagem = campoTexto.value.trim();
    const versaoModelo = seletorVersao ? seletorVersao.value : "gemini-2.5-flash";
    const nick = nicknameInput ? nicknameInput.value.trim() : "";

    if (!nick) {
        alert("⚠️ ATENÇÃO OPERADOR: Digite o seu NICK (apelido) no cabeçalho antes de enviar!");
        nicknameInput.focus();
        return;
    }

    if ((mensagem === "" && !arquivoImagemSelecionado) || estaProcessando) return;

    try {
        estaProcessando = true;
        btnEnviar.disabled = true;
        btnEnviar.style.opacity = "0.5";

        // Cria a URL temporária da imagem para o balão do usuário
        const urlPreviewLocal = arquivoImagemSelecionado ? URL.createObjectURL(arquivoImagemSelecionado) : null;

        adicionarMensagem("usuario", mensagem, urlPreviewLocal);
        
        // Monta o FormData para o envio multipart
        const formData = new FormData();
        formData.append("pergunta", mensagem);
        formData.append("nickname", nick);
        formData.append("modelo", versaoModelo);

        if (arquivoImagemSelecionado) {
            formData.append("imagem", arquivoImagemSelecionado);
        }

        campoTexto.value = ""; 
        limparSelecaoImagem();
        mostrarLoading();

        const respostaServidor = await fetch(`${URL_ATIVA}/api/chat`, {
            method: "POST",
            body: formData // Envio automático em multipart/form-data
        });

        const dados = await respostaServidor.json();

        if (!respostaServidor.ok) {
            throw new Error(dados.erro || "Falha na análise da imagem pelo servidor.");
        }

        removerLoading();
        adicionarMensagem("ia", dados.resposta);

    } catch (erro) {
        removerLoading();
        console.error("Falha Crítica:", erro);
        adicionarMensagem("ia", `<span style="color: #ff5555">⚠️ FALHA NO NÚCLEO: ${erro.message}</span>`);
    } finally {
        estaProcessando = false;
        btnEnviar.disabled = false;
        btnEnviar.style.opacity = "1";
        campoTexto.focus(); 
    }
}

async function carregarRankingGlobal() {
    rankingTabela.innerHTML = `<span style="color: #00f2ff">📡 Estabelecendo conexão...</span>`;
    modalRanking.style.display = "flex";

    try {
        const resposta = await fetch(`${URL_ATIVA}/api/ranking`);
        if (!resposta.ok) throw new Error("Erro de rede ao buscar Leaderboard.");

        const jogadores = await resposta.json();
        
        if (jogadores.length === 0) {
            rankingTabela.innerHTML = `<p style="text-align: center; color: #888;">Nenhum jogador registrado ainda.</p>`;
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

const btnLimparMemoria = document.getElementById("btnLimpar");
if (btnLimparMemoria) {
    btnLimparMemoria.addEventListener("click", async () => {
        if (confirm("⚠️ ALERTA: Deseja apagar o Banco de Dados e as mídias salvas?")) {
            try {
                adicionarMensagem("ia", `<span style="color: #ffcc00">⚠️ Solicitando limpeza do banco...</span>`);
                const rotaLimpeza = await fetch(`${URL_ATIVA}/api/chat/limpar`, { method: 'DELETE' });
                if (rotaLimpeza.ok) {
                    chatBox.innerHTML += `<div class="mensagem msg-ia" style="background-color: #330000; border-color: red; color: white;">🔥 Dados e histórico zerados!</div>`;
                }
            } catch (err) {
                adicionarMensagem("ia", `<span style="color: #ff5555">⚠️ FORMAT FALHOU: ${err.message}</span>`);
            }
        }
    });
}