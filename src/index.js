// src/index.jsAdd commentMore actions
console.log('DEBUG: Iniciando index.js...');

// 1. Cargar el módulo para manejar variables de entorno
require('dotenv').config();
console.log('DEBUG: dotenv cargado.');

// Importar clases y funciones esenciales
let Game, Player;
let initializeDb, getDb;
try {
    const models = require('./models/models');
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


let db; // Declara db aquí para que sea accesible en todo el archivo después de inicializada
let userStates = {}; // Declara userStates aquí para que sea accesible (considerar persistencia para producción)

// 2. Importar la librería del bot de Telegram
let TelegramBot;
try {
    TelegramBot = require('node-telegram-bot-api');
    console.log('DEBUG: node-telegram-bot-api cargado.');
} catch (error) {
    console.error('ERROR FATAL: No se pudo cargar node-telegram-bot-api:', error.message);
    process.exit(1);
}

// 3. Obtener el token del bot desde las variables de entorno
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;


// ** -- Función principal asíncrona para iniciar todo el bot -- **
async function main() {
    console.log('DEBUG: Ejecutando función main().');
    try {
        db = initializeDb();
        console.log('DEBUG: Base de datos inicializada y accesible.');

        console.log('INFO: Bot de Luna Aullante iniciando...');
        const bot = new TelegramBot(TOKEN, { polling: true });
        console.log('DEBUG: Instancia del bot de Telegram creada.');

        // Instanciar utilidades y manejadores
        const botUtils = new BotUtils(bot);
        const startHandler = new StartHandler(botUtils);
        // ¡CAMBIO AQUÍ! Pasamos 'db' al constructor
        const callbackQueryHandler = new CallbackQueryHandler(bot, userStates, botUtils, db);
        const messageHandler = new MessageHandler(db, userStates, botUtils);

        // 6. Manejar el comando /start
        bot.onText(/\/start/, (msg) => startHandler.handle(msg));

        // 7. Manejar las acciones de los botones (callback_data)
        bot.on('callback_query', async (callbackQuery) => callbackQueryHandler.handle(callbackQuery));

        // 9. Manejar mensajes de texto
        bot.on('message', async (msg) => {
            // Evitar que el messageHandler procese callbacks como texto
            if (msg.text && !msg.via_bot && !msg.text.startsWith('/')) { // <-- ¡CAMBIO CLAVE AQUÍ!
                messageHandler.handle(msg);
            } else if (msg.text && msg.text.startsWith('/')) {
                // Si es un comando que no tiene un manejador específico (como /start lo tiene),
                // podrías poner aquí una respuesta genérica para comandos no reconocidos.
                // Por ahora, con !msg.text.startsWith('/') es suficiente para el /start.
                console.log(`INFO: Comando "${msg.text}" recibido, ignorado por el messageHandler general.`);
            }
        });

        // 8. Manejar cualquier error de polling
        bot.on('polling_error', (error) => {
            console.error('ERROR: Error de polling:', error.code, error.message);
        });

        console.log('INFO: Bot de Luna Aullante conectado y listo para recibir mensajes...');

    } catch (error) {
        console.error('ERROR FATAL: El bot no pudo iniciar:', error.message);
        process.exit(1);
    }
}

// Llama a la función principal para iniciar todo el proceso
main();
