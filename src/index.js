// src/index.js

//"lowdb": "^7.0.0",
//     "node-telegram-bot-api": "^0.66.0",
//     "uuid": "^10.0.0"
// devdependecis
//     "nodemon": "^3.1.4"
// 1. Cargar el módulo para manejar variables de entorno (si usas un archivo .env)
require('dotenv').config();
// 2. Importar la librería del bot de Telegram
const TelegramBot = require('node-telegram-bot-api');
// 3. Obtener el token del bot desde las variables de entorno
// ¡IMPORTANTE: Crea un archivo .env en la raíz de tu proyecto conuna línea como:
// TELEGRAM_BOT_TOKEN=TU_TOKEN_AQUI
    const TOKEN ='7712891835:AAElQdFhbJUBA5ZISgYZJK6uOewJB5gDG7s'
    ;// 4. Verificar que el token esté definido
if (!TOKEN) {
    console.error('Error: El token del bot de Telegram no está definido. Asegúrate de configurar la variable de entornoTELEGRAM_BOT_TOKEN.');
    process.exit(1); // Salir de la aplicación si no hay token
}
// 5. Crear una nueva instancia del bot
// El polling: true hace que el bot escuche los mensajes entrantes constantemente.
    const bot = new TelegramBot(TOKEN, { polling: true });
console.log('Bot de Luna Aullante iniciando...');
// 6. Manejar el comando /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userName = msg.from.first_name || 'jugador'; // Obtiene el nombre del usuario
// Mensaje de bienvenida con Markdown para un toque más bonito
    const welcomeMessage = `¡Hola, *${userName}*! 👋\n\n¡Bienvenido al
juego del Lobo en Telegram!\n\nSoy el *Bot Luna Aullante*, tu guía en
este misterio. ¿Estás listo para desenmascarar a los lobos o sembrar
el terror en el pueblo?\n\nUsa los botones para empezar.`;
// Opciones de botones para el menú principal
    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🐺 Crear Partida', callback_data:
                        'create_game' }],
                [{ text: '🔍 Unirse a Partida', callback_data:
                        'join_game' }],
// Futuros botones aquí, como 'Mis Partidas' o 'Ayuda'
// [{ text: '📚 Ayuda', callback_data: 'help' }]
            ]
        }
    };
    bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown',
        ...keyboard });
    console.log(`Comando /start recibido de ${userName} (${chatId})`);
});
// 7. Manejar las acciones de los botones (callback_data)bot.on('callback_query', (callbackQuery) => {
bot.on('callback_query', (callbackQuery) => {
    const message = callbackQuery.message;
    const data = callbackQuery.data;
    const chatId = message.chat.id;
    const userName = callbackQuery.from.first_name || 'jugador';

    console.log(`Callback Query recibido: ${data} de ${userName} (${chatId})`);
    bot.answerCallbackQuery(callbackQuery.id);

    switch (data) {
        case 'create_game':
            bot.sendMessage(chatId, '¡Excelente! Vas a crear una nueva partida. ¿Cómo te gustaría llamarla? (Puedes escribir el nombre o enviar "omitir" para un nombre automático)');
            break;
        case 'join_game':
            bot.sendMessage(chatId, '¡Perfecto! ¿Cómo te gustaría unirte a una partida? Elige una opción:', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔎 Buscar Partida Pública', callback_data: 'search_public_game' }],
                        [{ text: '🔑 Introducir Código', callback_data: 'enter_code' }]
                    ]
                }
            });
            break;
        case 'search_public_game':
            bot.sendMessage(chatId, 'Buscando partidas públicas...(Esta función estará disponible pronto).');
            break;
        case 'enter_code':
            bot.sendMessage(chatId, 'Por favor, introduce el código de la partida a la que quieres unirte.');
            break;
        default:
            bot.sendMessage(chatId, '¡Ups! Esa opción no la reconozco aún. Intenta de nuevo.');
            break;
    }
});
// 8. Manejar cualquier error
bot.on('polling_error', (error) => {
    console.error('Error de polling:', error.code, error.message);
});
console.log('Bot de Luna Aullante conectado y listo para recibirmensajes...');
