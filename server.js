require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const mongoose = require('mongoose');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const app = express();
app.use(express.json());
app.use(cors());

mongoose.set('bufferCommands', false);

let memoriaContingencia = [];
let rankingContingencia = {};

// ====================================================================
// 1. CONFIGURAÇÃO DO CLOUDINARY (OBJECT STORAGE)
// ====================================================================
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Helper para Upload de Buffer para o Cloudinary
function uploadParaCloudinary(buffer) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: "neon_multimodal" },
            (error, result) => {
                if (error) reject(error);
                else resolve(result.secure_url);
            }
        );
        stream.end(buffer);
    });
}

// ====================================================================
// 2. CONFIGURAÇÃO DO MULTER (UPLOAD NA RAM) COM VALIDAÇÕES
// ====================================================================
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // Limite de 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Formato inválido! Envie apenas arquivos de imagem (PNG, JPG, WEBP).'), false);
        }
    }
});

// ====================================================================
// 3. CONEXÃO MONGODB & SCHEMAS
// ====================================================================
if (process.env.MONGO_URI && !process.env.MONGO_URI.includes("127.0.0.1")) {
    mongoose.connect(process.env.MONGO_URI)
      .then(() => console.log('📦 BANCO DE DADOS ATIVO (MongoDB Atlas)!'))
      .catch((err) => console.error('⚠️ AVISO MONGO (Modo sem banco ativo):', err.message));
} else {
    console.log('⚠️ MONGO_URI não informada/local. Rodando em Modo de Contingência (RAM).');
}

const MensagemSchema = new mongoose.Schema({
    role: String,
    parts: [{ text: String }],
    imageUrl: { type: String, default: null }, // Campo para armazenar URL do Cloudinary
    dataHora: { type: Date, default: Date.now }
});
const MensagemDbModel = mongoose.model('MemoriaSessao', MensagemSchema);

const JogadorSchema = new mongoose.Schema({
    nome: { type: String, unique: true, required: true },
    xp: { type: Number, default: 0 }
});
const JogadorModel = mongoose.model('Jogador', JogadorSchema);

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

function obterModeloValido(modeloRecebido) {
    if (!modeloRecebido || typeof modeloRecebido !== 'string') return "gemini-2.5-flash";
    const mod = modeloRecebido.toLowerCase().trim();
    if (mod.includes("pro")) return "gemini-2.5-pro";
    if (mod.includes("lite")) return "gemini-2.5-flash-lite";
    return "gemini-2.5-flash";
}

// ====================================================================
// 4. FERRAMENTAS DO AGENTE (TOOLS)
// ====================================================================
async function adicionarXP(nickname, quantidade) {
    try {
        const nomeFormatado = nickname.trim();
        if (!nomeFormatado) return { erro: "Nickname inválido." };

        if (mongoose.connection.readyState === 1) {
            const jogador = await JogadorModel.findOneAndUpdate(
                { nome: nomeFormatado },
                { $inc: { xp: quantidade } },
                { new: true, upsert: true }
            );
            return { nickname: jogador.nome, xpAtual: jogador.xp, quantidadeAlterada: quantidade };
        } else {
            rankingContingencia[nomeFormatado] = (rankingContingencia[nomeFormatado] || 0) + quantidade;
            return { nickname: nomeFormatado, xpAtual: rankingContingencia[nomeFormatado], quantidadeAlterada: quantidade };
        }
    } catch (error) {
        return { erro: `Falha ao processar XP: ${error.message}` };
    }
}

async function buscarClimaTempoReal(cidade) {
    try {
        const weatherApiKey = process.env.WEATHER_API_KEY;
        if (!weatherApiKey) return { info: "Configure WEATHER_API_KEY no .env" };
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cidade)}&units=metric&lang=pt_br&appid=${weatherApiKey}`;
        const response = await fetch(url);
        if (!response.ok) return { erro: `Cidade '${cidade}' não localizada.` };
        const data = await response.json();
        return { cidade: data.name, temperatura: `${Math.round(data.main.temp)}°C`, clima: data.weather[0].description };
    } catch (error) {
        return { erro: `Erro de clima: ${error.message}` };
    }
}

async function converterMoedas(valor, de, para) {
    try {
        const from = de.toUpperCase();
        const to = para.toUpperCase();
        if (from === to) return { valorOriginal: valor, moedaOrigem: from, moedaDestino: to, valorConvertido: valor };
        const url = `https://api.frankfurter.app/latest?amount=${valor}&from=${from}&to=${to}`;
        const response = await fetch(url);
        if (!response.ok) return { erro: `Falha na conversão.` };
        const data = await response.json();
        return { valorOriginal: valor, moedaOrigem: from, moedaDestino: to, valorConvertido: data.rates[to].toFixed(2) };
    } catch (error) {
        return { erro: `Erro na conversão: ${error.message}` };
    }
}

const declaracaoXP = {
    name: "adicionarXP",
    description: "Adiciona ou remove XP de um usuário baseado no nickname.",
    parameters: {
        type: "OBJECT",
        properties: { nickname: { type: "STRING" }, quantidade: { type: "INTEGER" } },
        required: ["nickname", "quantidade"]
    }
};

const declaracaoClima = {
    name: "buscarClimaTempoReal",
    description: "Obtém a temperatura e clima atual de uma cidade.",
    parameters: {
        type: "OBJECT",
        properties: { cidade: { type: "STRING" } },
        required: ["cidade"]
    }
};

const declaracaoMoeda = {
    name: "converterMoedas",
    description: "Converte valores entre moedas internacionais.",
    parameters: {
        type: "OBJECT",
        properties: { valor: { type: "NUMBER" }, de: { type: "STRING" }, para: { type: "STRING" } },
        required: ["valor", "de", "para"]
    }
};

// ====================================================================
// 5. ROTAS
// ====================================================================

// Rota de Leaderboard
app.get('/api/ranking', async (req, res) => {
    try {
        let listaRanking = [];
        if (mongoose.connection.readyState === 1) {
            listaRanking = await JogadorModel.find().sort({ xp: -1 }).limit(10).lean();
        } else {
            listaRanking = Object.keys(rankingContingencia).map(nome => ({ nome, xp: rankingContingencia[nome] })).sort((a, b) => b.xp - a.xp).slice(0, 10);
        }
        const rankingGamificado = listaRanking.map(j => {
            let titulo = "Novato";
            if (j.xp >= 500) titulo = "Lenda";
            else if (j.xp >= 300) titulo = "Mestre";
            else if (j.xp >= 100) titulo = "Guerreiro";
            return { nome: `${titulo}: ${j.nome}`, xp: j.xp };
        });
        res.status(200).json(rankingGamificado);
    } catch (e) {
        res.status(500).json({ erro: `Falha ao processar ranking: ${e.message}` });
    }
});

// Middleware Wrapper de Tratamento de Erros de Upload do Multer
const tratarUpload = (req, res, next) => {
    upload.single('imagem')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ sucesso: false, erro: '⚠️ ARQUIVO MUITO GRANDE: O limite máximo por imagem é de 5MB.' });
            }
            return res.status(400).json({ sucesso: false, erro: `⚠️ Erro de Upload: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ sucesso: false, erro: `⚠️ ${err.message}` });
        }
        next();
    });
};

// Rota Principal de Chat (Aceita Texto + Imagem via Multipart/FormData)
app.post('/api/chat', tratarUpload, async (req, res) => {
    try {
        if (!genAI) {
            return res.status(500).json({ sucesso: false, erro: "⚙️ CONFIGURAÇÃO PENDENTE: Configure GEMINI_API_KEY no .env" });
        }

        const { pergunta, nickname, modelo } = req.body || {};
        if (!pergunta && !req.file) {
            return res.status(400).json({ sucesso: false, erro: "Envie pelo menos um texto ou uma imagem." });
        }

        const perguntaSanitizada = pergunta ? pergunta.trim() : "Analise esta imagem enviada.";
        const nomeDoJogador = (nickname && nickname.trim()) ? nickname.trim() : "Visitante";
        const modeloFinal = obterModeloValido(modelo);

        let urlImagemCloudinary = null;

        // Se houver arquivo de imagem, faz upload no Cloudinary
        if (req.file) {
            if (!process.env.CLOUDINARY_CLOUD_NAME) {
                return res.status(500).json({ sucesso: false, erro: "⚙️ Credenciais do Cloudinary ausentes no servidor!" });
            }
            console.log(`📸 [STORAGE] Fazendo upload de imagem de '${nomeDoJogador}' para o Cloudinary...`);
            urlImagemCloudinary = await uploadParaCloudinary(req.file.buffer);
            console.log(`🔗 [STORAGE] Upload Concluído: ${urlImagemCloudinary}`);
        }

        // Monta o array de partes para a IA Multimodal (inlineData)
        const partesPrompt = [];
        if (req.file) {
            partesPrompt.push({
                inlineData: {
                    mimeType: req.file.mimetype,
                    data: req.file.buffer.toString('base64')
                }
            });
        }
        partesPrompt.push({ text: perguntaSanitizada });

        // Instruções de Sistema N.E.O.N. Visão
        const systemInstruction = `Você é o N.E.O.N. 3.5 - Agente Neural Multimodal com capacidade de Visão Computacional.
            Trate o usuário pelo apelido: "${nomeDoJogador}".
            Se o usuário enviar uma imagem: analise os pixels detalhadamente, descreva, leia cupons/OCR se solicitado, ou proponha uma charada cyberpunk baseada na foto.
            Se for uma charada resolvida, chame 'adicionarXP' (+50). Se desistir/errar, (-10).
            Não exiba valores numéricos brutos de XP no texto.`;

        // Histórico recente
        let docs = [];
        if (mongoose.connection.readyState === 1) {
            try { docs = await MensagemDbModel.find().sort({ dataHora: 1 }).limit(10).lean(); }
            catch (e) { docs = memoriaContingencia.slice(-10); }
        } else { docs = memoriaContingencia.slice(-10); }

        const historicoSeguro = docs.map(d => ({
            role: d.role === "model" ? "model" : "user",
            parts: [{ text: d.parts?.[0]?.text || "" }]
        }));

        const modelIA = genAI.getGenerativeModel({ 
            model: modeloFinal, 
            systemInstruction: systemInstruction,
            generationConfig: { temperature: 0.7, maxOutputTokens: 1000 },
            tools: [{ functionDeclarations: [declaracaoClima, declaracaoMoeda, declaracaoXP] }]
        });

        const chatSession = modelIA.startChat({ history: historicoSeguro });

        let result = await chatSession.sendMessage(partesPrompt);
        let parts = result.response.candidates?.[0]?.content?.parts;
        let functionCallPart = parts?.find(p => p.functionCall);

        while (functionCallPart) {
            const { name, args } = functionCallPart.functionCall;
            console.log(`🤖 [TOOL EXECUTADA]: ${name}`, args);

            let functionResult = {};
            if (name === "buscarClimaTempoReal") functionResult = await buscarClimaTempoReal(args.cidade);
            else if (name === "converterMoedas") functionResult = await converterMoedas(args.valor, args.de, args.para);
            else if (name === "adicionarXP") functionResult = await adicionarXP(args.nickname || nomeDoJogador, args.quantidade);

            result = await chatSession.sendMessage([
                { functionResponse: { name: name, response: { result: functionResult } } }
            ]);

            parts = result.response.candidates?.[0]?.content?.parts;
            functionCallPart = parts?.find(p => p.functionCall);
        }

        const respostaTexto = result.response.text();

        // Salva histórico no Mongo (incluindo URL do Cloudinary se houver)
        if (mongoose.connection.readyState === 1) {
            try {
                await MensagemDbModel.create({ 
                    role: "user", 
                    parts: [{ text: perguntaSanitizada }], 
                    imageUrl: urlImagemCloudinary 
                });
                await MensagemDbModel.create({ 
                    role: "model", 
                    parts: [{ text: respostaTexto }] 
                });
            } catch (errDb) {
                console.error("❌ Erro ao salvar no Mongo:", errDb.message);
            }
        } else {
            memoriaContingencia.push({ role: "user", parts: [{ text: perguntaSanitizada }], imageUrl: urlImagemCloudinary });
            memoriaContingencia.push({ role: "model", parts: [{ text: respostaTexto }] });
        }

        return res.status(200).json({ 
            sucesso: true, 
            resposta: respostaTexto, 
            imageUrl: urlImagemCloudinary,
            modeloUtilizado: modeloFinal 
        });

    } catch (erro) {
        console.error("❌ ERRO NO CHAT MULTIMODAL:", erro.message);
        return res.status(500).json({ sucesso: false, erro: `Falha no Servidor: ${erro.message}` });
    }
});

// Rota de Limpeza
app.delete('/api/chat/limpar', async (req, res) => {
    try {
        memoriaContingencia = [];
        rankingContingencia = {};
        if (mongoose.connection.readyState === 1) {
            await MensagemDbModel.deleteMany({});
            await JogadorModel.deleteMany({});
        }
        res.json({ sucesso: true });
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

const PORTA = process.env.PORT || 3000;
app.listen(PORTA, () => {
    console.log(`🚀 SERVIDOR MULTIMODAL OPERACIONAL NA PORTA ${PORTA}`);
});