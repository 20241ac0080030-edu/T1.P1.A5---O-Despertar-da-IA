require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const mongoose = require('mongoose');

const app = express();
app.use(express.json());
app.use(cors());

// Previne o travamento de requisições se o MongoDB estiver desconectado
mongoose.set('bufferCommands', false);

let memoriaContingencia = [];
let rankingContingencia = {};

// ====================================================================
// 1. CONEXÃO COM O BANCO DE DADOS MONGODB
// ====================================================================
if (process.env.MONGO_URI && !process.env.MONGO_URI.includes("127.0.0.1")) {
    mongoose.connect(process.env.MONGO_URI)
      .then(() => console.log('📦 BANCO DE DADOS ATIVO (MongoDB Atlas)!'))
      .catch((err) => console.error('⚠️ AVISO MONGO (Modo sem banco ativo):', err.message));
} else {
    console.log('⚠️ MONGO_URI não informada ou apontando para local sem serviço. Rodando em Modo de Contingência (RAM).');
}

// Schemas do Mongoose
const MensagemSchema = new mongoose.Schema({
    role: String,
    parts: [{ text: String }],
    dataHora: { type: Date, default: Date.now }
});
const MensagemDbModel = mongoose.model('MemoriaSessao', MensagemSchema);

const JogadorSchema = new mongoose.Schema({
    nome: { type: String, unique: true, required: true },
    xp: { type: Number, default: 0 }
});
const JogadorModel = mongoose.model('Jogador', JogadorSchema);

// Inicialização da SDK Gemini
const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// ====================================================================
// 2. MAPEADOR SEGURO DE MODELOS
// ====================================================================
function obterModeloValido(modeloRecebido) {
    if (!modeloRecebido || typeof modeloRecebido !== 'string') {
        return "gemini-2.5-flash";
    }
    const mod = modeloRecebido.toLowerCase().trim();
    
    if (mod.includes("pro")) return "gemini-2.5-pro";
    if (mod.includes("lite")) return "gemini-2.5-flash-lite";
    return "gemini-2.5-flash"; // Modelo rápido, moderno e ativo
}

// ====================================================================
// 3. FERRAMENTAS DA IA (TOOLS)
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
        if (!weatherApiKey) return { info: "A funcionalidade de clima precisa da chave WEATHER_API_KEY no .env" };
        
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cidade)}&units=metric&lang=pt_br&appid=${weatherApiKey}`;
        const response = await fetch(url);
        if (!response.ok) return { erro: `Cidade '${cidade}' não localizada.` };
        
        const data = await response.json();
        return {
            cidade: data.name,
            temperatura: `${Math.round(data.main.temp)}°C`,
            clima: data.weather[0].description
        };
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

// Declaração de Schemas para Tool Calling
const declaracaoXP = {
    name: "adicionarXP",
    description: "Adiciona ou remove XP de um usuário baseado no nickname. Adicione 50 pontos se ele acertar a charada, ou subtraia 10 pontos se ele errar/desistir.",
    parameters: {
        type: "OBJECT",
        properties: {
            nickname: { type: "STRING", description: "O apelido do usuário." },
            quantidade: { type: "INTEGER", description: "Pontos (+50 ou -10)." }
        },
        required: ["nickname", "quantidade"]
    }
};

const declaracaoClima = {
    name: "buscarClimaTempoReal",
    description: "Obtém a temperatura e clima atual de uma cidade.",
    parameters: {
        type: "OBJECT",
        properties: { cidade: { type: "STRING", description: "Nome da cidade." } },
        required: ["cidade"]
    }
};

const declaracaoMoeda = {
    name: "converterMoedas",
    description: "Converte valores entre moedas internacionais.",
    parameters: {
        type: "OBJECT",
        properties: {
            valor: { type: "NUMBER", description: "Valor numérico." },
            de: { type: "STRING", description: "Moeda origem (ex: USD)." },
            para: { type: "STRING", description: "Moeda destino (ex: BRL)." }
        },
        required: ["valor", "de", "para"]
    }
};

// ====================================================================
// 4. ROTAS DA APLICAÇÃO
// ====================================================================

// Rota de Leaderboard
app.get('/api/ranking', async (req, res) => {
    try {
        let listaRanking = [];
        if (mongoose.connection.readyState === 1) {
            listaRanking = await JogadorModel.find().sort({ xp: -1 }).limit(10).lean();
        } else {
            listaRanking = Object.keys(rankingContingencia).map(nome => ({
                nome, xp: rankingContingencia[nome]
            })).sort((a, b) => b.xp - a.xp).slice(0, 10);
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

// Rota do Chat Principal (Gamificado e Aprimorado)
app.post('/api/chat', async (req, res) => {
    try {
        if (!genAI) {
            return res.status(500).json({ 
                sucesso: false,
                erro: "⚙️ CONFIGURAÇÃO PENDENTE: Configure a chave GEMINI_API_KEY no arquivo .env!" 
            });
        }

        const { pergunta, nickname, modelo } = req.body || {};
        if (!pergunta || typeof pergunta !== 'string' || pergunta.trim() === '') {
            return res.status(400).json({ sucesso: false, erro: "Envie uma pergunta válida." });
        }

        const perguntaSanitizada = pergunta.trim();
        const nomeDoJogador = (nickname && typeof nickname === 'string' && nickname.trim() !== '') 
            ? nickname.trim() 
            : "Visitante";
            
        const modeloFinal = obterModeloValido(modelo);
        console.log(`📡 [N.E.O.N. CORE] Jogador: '${nomeDoJogador}' | Núcleo: '${modeloFinal}'`);

        // Instrução do Sistema Gamificada e Futurista
        const systemInstruction = `Você é o Mestre do Jogo e Guardião do SISTEMA N.E.O.N. 3.5.
            Trate o usuário sempre pelo apelido informado: "${nomeDoJogador}".
            Regra do Jogo: Proponha desafios, charadas e enigmas sobre hacking, programação e tecnologia. 
            - Se o usuário acertar a charada de forma justa, chame 'adicionarXP' com nickname="${nomeDoJogador}" e quantidade=50.
            - Se o usuário errar muito, desistir ou pedir a resposta, chame 'adicionarXP' com nickname="${nomeDoJogador}" e quantidade=-10.
            - Nunca revele a quantidade exata numérica de XP no texto da resposta, apenas parabenize ou lamente o ajuste de pontos.
            - Responda também a outras perguntas e utilize as ferramentas de clima e conversão de moedas quando solicitado.`;

        // Configuração de Geração (Respostas rápidas e dinâmicas)
        const generationConfig = {
            temperature: 0.7,
            topP: 0.9,
            maxOutputTokens: 1000
        };

        // Histórico de Conversação com Contingência
        let docs = [];
        if (mongoose.connection.readyState === 1) {
            try {
                docs = await MensagemDbModel.find().sort({ dataHora: 1 }).limit(10).lean();
            } catch (e) {
                docs = memoriaContingencia.slice(-10);
            }
        } else {
            docs = memoriaContingencia.slice(-10);
        }

        const historicoSeguro = docs.map(d => ({
            role: d.role === "model" ? "model" : "user",
            parts: [{ text: d.parts?.[0]?.text || "" }]
        }));

        // Instanciação da IA no SDK do Gemini
        const modelIA = genAI.getGenerativeModel({ 
            model: modeloFinal, 
            systemInstruction: systemInstruction,
            generationConfig: generationConfig,
            tools: [{ functionDeclarations: [declaracaoClima, declaracaoMoeda, declaracaoXP] }]
        });

        const chatSession = modelIA.startChat({ history: historicoSeguro });

        let result = await chatSession.sendMessage(perguntaSanitizada);
        let parts = result.response.candidates?.[0]?.content?.parts;
        let functionCallPart = parts?.find(p => p.functionCall);

        // Processamento de Ferramentas (Tool Calling Loop)
        while (functionCallPart) {
            const { name, args } = functionCallPart.functionCall;
            console.log(`🤖 [TOOL ACIONADA]: ${name}`, args);

            let functionResult = {};
            if (name === "buscarClimaTempoReal") {
                functionResult = await buscarClimaTempoReal(args.cidade);
            } else if (name === "converterMoedas") {
                functionResult = await converterMoedas(args.valor, args.de, args.para);
            } else if (name === "adicionarXP") {
                const nickAlvo = args.nickname || nomeDoJogador;
                functionResult = await adicionarXP(nickAlvo, args.quantidade);
            }

            result = await chatSession.sendMessage([
                { functionResponse: { name: name, response: { result: functionResult } } }
            ]);

            parts = result.response.candidates?.[0]?.content?.parts;
            functionCallPart = parts?.find(p => p.functionCall);
        }

        const respostaTexto = result.response.text();

        // Armazenamento da mensagem
        if (mongoose.connection.readyState === 1) {
            try {
                await MensagemDbModel.create({ role: "user", parts: [{ text: perguntaSanitizada }] });
                await MensagemDbModel.create({ role: "model", parts: [{ text: respostaTexto }] });
            } catch (err) {
                console.error("❌ Erro ao salvar histórico no Mongo:", err.message);
            }
        } else {
            memoriaContingencia.push({ role: "user", parts: [{ text: perguntaSanitizada }] });
            memoriaContingencia.push({ role: "model", parts: [{ text: respostaTexto }] });
        }

        return res.status(200).json({ sucesso: true, resposta: respostaTexto, modeloUtilizado: modeloFinal });

    } catch (erro) {
        console.error("❌ ERRO NO PROCESSO:", erro.message);
        return res.status(500).json({ sucesso: false, erro: `Falha no Servidor: ${erro.message}` });
    }
});

// Rota de Limpeza do Banco/Memória
app.delete('/api/chat/limpar', async (req, res) => {
    try {
        memoriaContingencia = [];
        rankingContingencia = {};
        if (mongoose.connection.readyState === 1) {
            await MensagemDbModel.deleteMany({});
            await JogadorModel.deleteMany({});
        }
        res.json({ sucesso: true });
    } catch (e) { 
        res.status(500).json({ erro: e.message }); 
    }
});

// Inicialização do Servidor
const PORTA = process.env.PORT || 3000;
app.listen(PORTA, () => {
    console.log(`🚀 SERVIDOR OPERACIONAL NA PORTA ${PORTA}`);
});