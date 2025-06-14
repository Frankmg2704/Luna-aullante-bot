// src/utils/botUtils.js
class BotUtils {
    constructor(bot) {
        this.bot = bot;
    }

    sendMessage(chatId, text, options = {}) {
        try {
            this.bot.sendMessage(chatId, text, options);
        } catch (error) {
            console.error(`ERROR: No se pudo enviar mensaje a ${chatId}:`, error.message);
        }
    }

    // Puedes añadir más funciones aquí, por ejemplo, para editar mensajes, etc.
}

module.exports = BotUtils;
