/**
 * SISTEMA N.E.O.N. - NÚCLEO DE PROCESSAMENTO (BACK-END)
 * Reator Node.js v1.0 - Protocolo Cliente-Servidor Seguro
 */

// 1. CARGA DE SISTEMAS CRÍTICOS
require('dotenv').config(); // Lê o arquivo secreto .env
const express = require('express'); // Framework do servidor
const cors = require('cors'); // Permite que o navegador acesse este servidor
const { GoogleGenerativeAI } = require("@google/generative-ai"); // Biblioteca oficial do Google

// 2. CONFIGURAÇÃO DO SERVIDOR
const app = express();
app.use(cors()); // Protocolo de compartilhamento entre origens
app.use(express.json()); // Habilita o recebimento de mensagens em JSON

// 3. VALIDAÇÃO DE SEGURANÇA DA CHAVE
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("❌ ERRO CRÍTICO: GEMINI_API_KEY não encontrada no cofre (.env).");
    process.exit(1);
}

// 4. INICIALIZAÇÃO DO REATOR DE IA
const genAI = new GoogleGenerativeAI(apiKey);

// PERSONALIDADE DO AGENTE N.E.O.N.
const instrucaoSistema = `Você é o Agente N.E.O.N., um sistema de inteligência artificial de altíssima fidelidade. 
Trate o usuário como 'Operador'. Mantenha uma comunicação técnica, futurista e altamente precisa. 
Sua missão é auxiliar na infraestrutura de TI e codificação de software com sabedoria e clareza.`;

/**
 * ROTA DE COMANDO NEURAL (Onde o seu script.js conecta)
 */
app.post('/api/chat', async (req, res) => {
    try {
        // Recebe a mensagem e a escolha de núcleo enviadas pelo Front-end
        const { mensagem, modelo } = req.body;
        
        console.log(`📡 [PROCURA]: Comando do Operador recebido via Núcleo ${modelo}`);

        // Instancia o modelo dinamicamente conforme solicitado na aba de versões
        const modelIA = genAI.getGenerativeModel({ 
            model: modelo || "gemini-1.5-flash", // Versão padrão se nada for enviado
            systemInstruction: instrucaoSistema
        });

        // TENTA CONECTAR AO GOOGLE E GERAR RESPOSTA
        const resultado = await modelIA.generateContent(mensagem);
        const respostaIa = resultado.response.text();

        console.log(`✅ [SUCESSO]: Resposta do Núcleo gerada com êxito.`);

        // Envia o JSON com a resposta de volta para o Front-end
        res.json({ resposta: respostaIa });

    } catch (erro) {
        console.error("⚠️ [ALERTA DE SISTEMA] Falha no processamento:", erro.message);
        
        // Envia o erro de volta para ser plotado na tela do navegador
        res.status(500).json({ 
            resposta: "🚨 ERRO NO REATOR: Não foi possível processar o sinal da IA. Verifique se o núcleo solicitado está disponível para sua API KEY." 
        });
    }
});

// 5. ATIVAÇÃO DO PONTO DE ACESSO (Porta 3000)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
    =======================================================
    💠 SISTEMA N.E.O.N. - MOTOR BACK-END EM OPERAÇÃO 💠
    =======================================================
    🟢 Reator online na porta ${PORT}
    📡 Protocolo: http://localhost:${PORT}/api/chat
    🤖 Status IA: Pronta para sincronização de rede.
    =======================================================
    `);
});