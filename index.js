/**
 * Agente N.E.O.N - Central de Comando Neural
 * Desenvolvido para interface Full-Stack com Google Gemini
 */

const chatBox = document.getElementById("caixa-chat");
const campoTexto = document.getElementById("campoTexto");
const btnEnviar = document.getElementById("btnEnviar");

// Variável para evitar múltiplos envios simultâneos
let estaProcessando = false;

/**
 * Adiciona uma mensagem na interface com animação
 * @param {string} remetente - 'usuario' ou 'ia'
 * @param {string} texto - Conteúdo da mensagem
 */
function adicionarMensagem(remetente, texto) {
    const div = document.createElement("div");
    div.classList.add("mensagem", remetente === "usuario" ? "msg-usuario" : "msg-ia");
    
    // Formatação básica: Transforma \n em <br> e **texto** em <b>texto</b>
    const textoFormatado = texto
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

    div.innerHTML = textoFormatado;
    chatBox.appendChild(div);

    // Scroll Suave para a última mensagem
    chatBox.scrollTo({
        top: chatBox.scrollHeight,
        behavior: 'smooth'
    });
}

/**
 * Cria o elemento visual de "IA pensando" (pontinhos animados)
 */
function mostrarLoading() {
    const loadingDiv = document.createElement("div");
    loadingDiv.classList.add("mensagem", "msg-ia");
    loadingDiv.id = "loading-neon";
    loadingDiv.innerHTML = `<span class="pulso">.</span><span class="pulso" style="animation-delay: 0.2s">.</span><span class="pulso" style="animation-delay: 0.4s">.</span>`;
    chatBox.appendChild(loadingDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

/**
 * Remove o elemento de loading
 */
function removerLoading() {
    const loading = document.getElementById("loading-neon");
    if (loading) loading.remove();
}

/**
 * Função Principal de Comunicação
 */
async function enviarParaIA() {
    const mensagem = campoTexto.value.trim();

    // Validações de segurança
    if (mensagem === "" || estaProcessando) return;

    try {
        estaProcessando = true;
        btnEnviar.disabled = true;
        btnEnviar.style.opacity = "0.5";

        // 1. Mostra a mensagem do usuário na tela
        adicionarMensagem("usuario", mensagem);
        campoTexto.value = ""; // Limpa o input imediatamente

        // 2. Mostra indicador de processamento
        mostrarLoading();

        // 3. Chamada AJAX ao Back-end local (Porta 3000)
        const respostaServidor = await fetch("http://localhost:3000/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mensagem: mensagem }),
            // Define um tempo limite (timeout) de 30 segundos
            signal: AbortSignal.timeout(30000)
        });

        if (!respostaServidor.ok) throw new Error("Falha na comunicação com o servidor.");

        const data = await respostaServidor.json();

        // 4. Remove loading e exibe a resposta da IA N.E.O.N.
        removerLoading();
        adicionarMensagem("ia", data.resposta);

    } catch (erro) {
        removerLoading();
        console.error("Erro N.E.O.N:", erro);
        
        let msgErro = "⚠️ FALHA NA REDE: Link neural interrompido. Verifique o servidor Node.js.";
        if (erro.name === 'TimeoutError') msgErro = "⚠️ TIMEOUT: O sinal demorou muito a retornar da nuvem.";
        
        adicionarMensagem("ia", `<span style="color: #ff5555">${msgErro}</span>`);
    } finally {
        // Libera a interface para a próxima mensagem
        estaProcessando = false;
        btnEnviar.disabled = false;
        btnEnviar.style.opacity = "1";
        campoTexto.focus(); // Devolve o foco para o teclado
    }
}

// Event Listeners (Gatilhos)
btnEnviar.addEventListener("click", enviarParaIA);

campoTexto.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        enviarParaIA();
    }
});

// Estilização extra para o "Digitando..." via JS
const estiloLoading = document.createElement('style');
estiloLoading.innerHTML = `
    .pulso {
        animation: pulsoAnim 1.4s infinite;
        font-size: 24px;
        font-weight: bold;
        display: inline-block;
        margin-right: 2px;
        color: #00e5ff;
    }
    @keyframes pulsoAnim {
        0%, 100% { opacity: 0.2; transform: scale(1); }
        50% { opacity: 1; transform: scale(1.2); }
    }
`;
document.head.appendChild(estiloLoading);

console.log("💠 Sistemas N.E.O.N. ativos e aguardando conexão.");