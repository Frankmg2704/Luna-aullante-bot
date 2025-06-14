// src/index.js
// ... (require's iniciales no cambian)

// Importar manejadores
const BotUtils = require('./utils/botUtils');
const StartHandler = require('./handlers/startHandler');
const CallbackQueryHandler = require('./handlers/callbackQueryHandler');
const MessageHandler = require('./handlers/messageHandler');

let db;
let userStates = {};

// ... (El resto del código hasta la función main() no cambia)

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
            if (msg.text && !msg.via_bot) {
                messageHandler.handle(msg);
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
