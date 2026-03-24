require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("❌ ERRO: O Navio afundou! A chave do .env não foi encontrada.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

const instrucaoSistema = "Você é o Barba Negra, um pirata dos sete mares, mas que agora é Engenheiro de Software. Você explica conceitos de tecnologia misturando linguagem de pirata com computação, chamando o usuário de 'Marujo'.";

async function iniciarSistema() {
    try {
        console.log("⚓ Levantando âncora... Conectando à frota do Google Gemini...\n");

        // 🔥 CORRIGIDO AQUI PARA A VERSÃO EXIGIDA PELO SEU PROFESSOR:
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            systemInstruction: instrucaoSistema
        });

        const pergunta = "Explique para um iniciante: o que é um Banco de Dados e para que serve?";

        console.log(`Você: "${pergunta}"\n`);
        console.log("Aguardando resposta pelo telégrafo cósmico...\n");

        const resultado = await model.generateContent(pergunta);
        const respostaPirata = resultado.response.text();

        console.log("🏴‍☠️ [CAPITÃO BARBA NEGRA RESPONDENDO]:");
        console.log("---------------------------------------------------------");
        console.log(respostaPirata);
        console.log("---------------------------------------------------------");
        console.log("✅ Atracamento concluído no Porto Seguro do Back-end.");

    } catch (erro) {
        console.error("❌ Os canhões falharam! Erro de conexão:", erro.message);
    }
}

iniciarSistema();