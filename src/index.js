// src/index.js
console.log('DEBUG: Iniciando index.js...');

require('dotenv').config();
console.log('DEBUG: dotenv cargado.');


let Game, Player;
let initializeDb, getDb;
try {
    const models = require('./models/models');
    Game = models.Game;
    Player = models.Player;
    ({ initializeDb, getDb } = require('./data/bdPrincipal'));
    console.log('DEBUG: models.js y database.js cargados correctamente. Clases Game y Player disponibles.');
} catch (error) {
    console.error('ERROR FATAL: No se pudo cargar módulos esenciales:', error.message);
    process.exit(1);
}

const BotUtils = require('./utils/botUtils');
const StartHandler = require('./Handler/startHandler');
const MessageHandler = require('./Handler/messageHandler');
const CallbackQueryHandler = require('./Handler/callbackQueryHandler');
const GamePhaseHandler = require('./gameLogic/fases/manejadorFasesJuego');

// Importando los manejadores de partida
const CreateGameHandler = require('./gameLogic/partidas/crearPartida');
const JoinGameHandler = require('./gameLogic/partidas/unirsePartida');
const ManejadorSalaEspera = require('./gameLogic/partidas/manejadorSalaEspera'); // ¡Nuevo import!

let db;
let estadosUsuario = {};
const userStates = estadosUsuario;

let TelegramBot;
try {
    TelegramBot = require('node-telegram-bot-api');
    console.log('DEBUG: node-telegram-bot-api cargado.');
} catch (error) {
    console.error('ERROR FATAL: No se pudo cargar node-telegram-bot-api:', error.message);
    process.exit(1);
}
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function main() {
    console.log('DEBUG: Ejecutando función principal (main).');
    try {
        db = initializeDb();
        console.log('DEBUG: Base de datos inicializada y accesible.');

        console.log('INFO: Bot de Luna Aullante iniciando...');
        const bot = new TelegramBot(TOKEN, { polling: true });
        console.log('DEBUG: Instancia del bot de Telegram creada.');

        const botUtils = new BotUtils(bot, db);
        const gamePhaseHandler = new GamePhaseHandler(bot, db, botUtils);

        // Instanciando el nuevo manejador de sala de espera
        const manejadorSalaEspera = new ManejadorSalaEspera(db, botUtils, gamePhaseHandler);

        // Pasamos manejadorSalaEspera a CreateGameHandler porque aún tiene la lógica inicial de sendLobbyMenu
        const createGameHandler = new CreateGameHandler(db, estadosUsuario, botUtils, manejadorSalaEspera); // ¡Nuevo parámetro!
        const joinGameHandler = new JoinGameHandler(db, estadosUsuario, botUtils, manejadorSalaEspera);     // ¡Nuevo parámetro!
        const startHandler = new StartHandler(botUtils, userStates, manejadorSalaEspera);

        const callbackQueryHandler = new CallbackQueryHandler(
            bot, estadosUsuario, botUtils, db, gamePhaseHandler,
            createGameHandler, joinGameHandler, manejadorSalaEspera // ¡Nuevo parámetro!
        );
        const messageHandler = new MessageHandler(db, estadosUsuario, botUtils, joinGameHandler);

        messageHandler.setGameHandlers(createGameHandler, joinGameHandler);


        bot.onText(/\/start/, async (msg) => {
            await startHandler.handle(msg); // Llama al StartHandler.handle
        });
        bot.on('callback_query', async (callbackQuery) => callbackQueryHandler.handle(callbackQuery));
        bot.on('message', async (msg) => {
            if (msg.text && !msg.via_bot && !msg.text.startsWith('/')) {
                messageHandler.handle(msg);
            } else if (msg.text && msg.text.startsWith('/')) {
                console.log(`INFO: Comando "${msg.text}" recibido, ignorado por el manejador general de mensajes.`);
            }
        });

        bot.on('polling_error', (error) => {
            console.error('ERROR: Error de polling:', error.code, error.message);
        });

        console.log('INFO: Bot de Luna Aullante conectado y listo para recibir mensajes...');

    } catch (error) {
        console.error('ERROR FATAL: El bot no pudo iniciar:', error.message);
        process.exit(1);
    }
}

main();
