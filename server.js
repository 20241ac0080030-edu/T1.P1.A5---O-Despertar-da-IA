require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(express.json());
app.use(cors());

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("❌ ERRO CRÍTICO: GEMINI_API_KEY não encontrada no .env.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

app.post('/api/chat', async (req, res) => {
    try {
        const { pergunta } = req.body;

        if (!pergunta || pergunta.trim() === "") {
            return res.status(400).json({ 
                sucesso: false,
                erro: "Você precisa enviar uma 'pergunta' no formato JSON." 
            });
        }

        console.log(`📩 Comando recebido via API: "${pergunta}"`);

        // 🔥 AQUI ESTÁ A SOLUÇÃO: Usando a versão que funciona na sua API KEY
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        const promptFinal = `Você é um robô sarcástico. Responda à pergunta: ${pergunta}`;
        
        const result = await model.generateContent(promptFinal);
        const respostaDaIA = result.response.text();

        return res.status(200).json({ 
            sucesso: true,
            resposta: respostaDaIA 
        });

    } catch (erro) {
        console.error("❌ ERRO NO MOTOR DE IA:", erro.message);
        return res.status(500).json({ 
            sucesso: false,
            erro: "Falha catastrófica no motor de IA.",
            detalhe: erro.message
        });
    }
});

app.listen(3000, () => {
    console.log(`🚀 AGENTE N.E.O.N. API | ONLINE COM GEMINI-2.0-FLASH NA PORTA 3000...`);
});