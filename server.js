require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const mongoose = require('mongoose');

const app = express();
app.use(express.json());
app.use(cors());

// Conexão com o Banco de Dados
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('📦 BANCO DE DADOS ATIVO!'))
  .catch((err) => console.error('❌ ERRO MONGO:', err));

// Modelo da Memória
const MensagemSchema = new mongoose.Schema({
    role: String,
    parts: [{ text: String }],
    dataHora: { type: Date, default: Date.now }
});
const MensagemDbModel = mongoose.model('MemoriaSessao', MensagemSchema);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/api/chat', async (req, res) => {
    try {
        const { pergunta } = req.body;
        if (!pergunta) return res.status(400).json({ erro: "Envie uma pergunta." });

        // 1. Busca o histórico no banco
        const docs = await MensagemDbModel.find().sort({ dataHora: 1 }).limit(10).lean();
        
        // 2. Limpeza profunda do histórico para o Google não reclamar
        const historicoSeguro = docs.map(d => ({
            role: d.role === "model" ? "model" : "user",
            parts: [{ text: d.parts[0]?.text || "" }]
        }));

        // 3. Configura a IA (Usando o 1.5-flash que é o mais estável para contas novas)
        const modelIA = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash", 
            systemInstruction: "Você é o N.E.O.N. Responda de forma curta." 
        });

        const chatSession = modelIA.startChat({ history: historicoSeguro });

        // 4. Tenta enviar a mensagem
        const result = await chatSession.sendMessage(pergunta);
        const respostaTexto = result.response.text();

        // 5. SE DEU CERTO, SALVA NO BANCO
        await MensagemDbModel.create({ role: "user", parts: [{ text: pergunta }] });
        await MensagemDbModel.create({ role: "model", parts: [{ text: respostaTexto }] });

        return res.status(200).json({ sucesso: true, resposta: respostaTexto });

    } catch (erro) {
        console.error("❌ ERRO NO PROCESSO:", erro.message);
        // Se der erro de histórico, avisa o usuário para resetar
        return res.status(500).json({ 
            sucesso: false, 
            erro: "O histórico de mensagens travou. Clique no botão vermelho 'FORMAT' para limpar e tente novamente." 
        });
    }
});

// Rota de Limpeza
app.delete('/api/chat/limpar', async (req, res) => {
    try {
        await MensagemDbModel.deleteMany({});
        res.json({ sucesso: true });
    } catch (e) { res.status(500).json({ erro: e }); }
});

// Localize o final do seu server.js e mude o PORTA para:
const PORTA = process.env.PORT || 3000;

app.listen(PORTA, () => {
    console.log(`🚀 SERVIDOR OPERACIONAL`);
    console.log(`📡 LOCAL: http://localhost:${PORTA}`);
    console.log(`☁️ NUVEM: Pronto para conexão via PaaS (Render)`);
});