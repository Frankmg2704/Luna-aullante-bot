// src/index.js (sin cambios significativos, solo para referencia)

console.log('DEBUG: Iniciando index.js...');

require('dotenv').config();
console.log('DEBUG: dotenv cargado.');

let Game, Player;
let initializeDb, getDb;
try {
    const models = require('./models/models'); // Asegúrate que la ruta es correcta
    Game = models.Game;
    Player = models.Player;
    ({ initializeDb, getDb } = require('./data/database'));
    console.log('DEBUG: modules.js y database.js cargados correctamente. Clases Game y Player disponibles.');
} catch (error) {
    console.error('ERROR FATAL: No se pudo cargar módulos esenciales:', error.message);
    process.exit(1);
}

const BotUtils = require('./utils/botUtils');
const StartHandler = require('./handlers/startHandler');
const CallbackQueryHandler = require('./handlers/callbackQueryHandler');
const MessageHandler = require('./handlers/messageHandler');
const GamePhaseHandler = require('./handlers/gamePhaseHandler');

let db;
let userStates = {};

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
    console.log('DEBUG: Ejecutando función main().');
    try {
        db = initializeDb();
        console.log('DEBUG: Base de datos inicializada y accesible.');

        console.log('INFO: Bot de Luna Aullante iniciando...');
        const bot = new TelegramBot(TOKEN, { polling: true });
        console.log('DEBUG: Instancia del bot de Telegram creada.');

        const botUtils = new BotUtils(bot);
        const startHandler = new StartHandler(botUtils);
        const gamePhaseHandler = new GamePhaseHandler(bot, db, botUtils);
        const callbackQueryHandler = new CallbackQueryHandler(bot, userStates, botUtils, db, gamePhaseHandler);
        const messageHandler = new MessageHandler(db, userStates, botUtils);

        bot.onText(/\/start/, (msg) => startHandler.handle(msg));
        bot.on('callback_query', async (callbackQuery) => callbackQueryHandler.handle(callbackQuery));
        bot.on('message', async (msg) => {
            if (msg.text && !msg.via_bot && !msg.text.startsWith('/')) {
                messageHandler.handle(msg);
            } else if (msg.text && msg.text.startsWith('/')) {
                console.log(`INFO: Comando "${msg.text}" recibido, ignorado por el messageHandler general.`);
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
