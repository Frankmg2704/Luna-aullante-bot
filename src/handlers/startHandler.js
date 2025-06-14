// src/handlers/startHandler.js
class StartHandler {
    constructor(botUtils) {
        this.botUtils = botUtils;
    }

    handle(msg) {
        const chatId = msg.chat.id;
        const userName = msg.from.first_name || 'jugador';
        const welcomeMessage = `¡Hola, *${userName}*! 👋\n\n¡Bienvenido al juego del Lobo en Telegram!\n\nSoy el *Bot Luna Aullante*, tu guía en este misterio. ¿Estás listo para desenmascarar a los lobos o sembrar el terror en el pueblo?\n\nUsa los botones para empezar.`;
        const keyboard = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🐺 Crear Partida', callback_data: 'create_game' }],
                    [{ text: '🔍 Unirse a Partida', callback_data: 'join_game' }],
                ]
            }
        };
        this.botUtils.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown', ...keyboard });
        console.log(`INFO: Comando /start recibido de ${userName} (${chatId})`);
    }
}

module.exports = StartHandler;
