// Importando dependências
require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

// readline é uma ferramenta embutida no Node.js para capturar digitação no terminal
const readline = require('readline'); 

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("❌ ERRO: A chave do .env não foi encontrada.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const instrucaoSistema = "Você é o Barba Negra, um pirata dos sete mares especialista em tecnologia da informação. Explique os conceitos mesclando termos piratas, chamando o usuário de 'Marujo'.";

// Configurando a interface para podermos digitar e ver as respostas no terminal
const interfaceTerminal = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function iniciarNavio() {
    console.clear(); // Limpa o terminal para ficar bonito
    console.log("==================================================");
    console.log("⚓ CHAT COM O CAPITÃO BARBA NEGRA (Digite 'sair' para fechar)");
    console.log("==================================================\n");

    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        systemInstruction: instrucaoSistema
    });

    // Inovação: Iniciar um CHAT contínuo (A IA agora tem memória)
    const chat = model.startChat({ history:[] });

    // Criamos uma função repetitiva para perguntar continuamente
    const fazerPergunta = () => {
        interfaceTerminal.question("🧑‍💻 Você: ", async (mensagemMarujo) => {
            
            // Condição para encerrar o programa se você digitar 'sair'
            if (mensagemMarujo.toLowerCase() === 'sair') {
                console.log("\n🏴‍☠️ [CAPITÃO BARBA NEGRA]: Levantando âncora, Marujo! Até a próxima aventura!");
                interfaceTerminal.close();
                return;
            }

            console.log("   ⏳ Aguardando a resposta cruzar os oceanos do Google...\n");

            try {
                // Envia a mensagem digitada no terminal para o modelo
                const resultado = await chat.sendMessage(mensagemMarujo);
                
                console.log(`🏴‍☠️ [BARBA NEGRA]: ${resultado.response.text()}\n`);
                console.log("--------------------------------------------------");
                
                // A função chama a si mesma para continuarmos conversando infinitamente!
                fazerPergunta();
            } catch (erro) {
                console.error("❌ Os canhões falharam!", erro.message);
                interfaceTerminal.close();
            }
        });
    };

    // Dar o pontapé inicial na primeira pergunta
    fazerPergunta();
}

// Inicia o programa interativo!
iniciarNavio();