// src/utils/botUtils.js

class BotUtils {
    constructor(bot) {
        this.bot = bot;
    }

    /**
     * Envía un mensaje de texto a un chat.
     * @param {number} chatId - El ID del chat.
     * @param {string} text - El texto del mensaje.
     * @param {object} options - Opciones adicionales para el mensaje (ej: reply_markup).
     */
    async sendMessage(chatId, text, options = {}) {
        try {
            await this.bot.sendMessage(chatId, text, options);
        } catch (error) {
            console.error(`ERROR: Fallo al enviar mensaje a ${chatId}:`, error.message);
        }
    }

    /**
     * Edita un mensaje existente en un chat.
     * @param {number} chatId - El ID del chat.
     * @param {number} messageId - El ID del mensaje a editar.
     * @param {string} text - El nuevo texto del mensaje.
     * @param {object} options - Opciones adicionales para el mensaje (ej: reply_markup).
     */
    async editMessage(chatId, messageId, text, options = {}) {
        try {
            await this.bot.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                ...options,
            });
        } catch (error) {
            if (error.message.includes('message is not modified')) {
                console.log(`DEBUG: Intento de editar mensaje pero no fue modificado para ${chatId}:${messageId}`);
            } else {
                console.error(`ERROR: Fallo al editar mensaje ${messageId} en ${chatId}:`, error.message);
            }
        }
    }

    /**
     * Envía o edita el menú principal del bot.
     * ¡ESTA ES LA PARTE CLAVE QUE DEBE ESTAR CORRECTA!
     * @param {number} chatId - El ID del chat.
     * @param {number|null} messageId - El ID del mensaje a editar (si es null, envía uno nuevo).
     * @param {string} text - El texto a mostrar en el menú.
     */
    async sendMainMenu(chatId, messageId = null, text = '¡Bienvenido al bot de Luna Aullante! ¿Qué quieres hacer?') {
        const keyboard = {
            inline_keyboard: [
                [{ text: '➕ Crear nueva partida', callback_data: 'create_game' }],
                // ¡AQUÍ ESTÁN LOS BOTONES DIRECTOS PARA UNIRSE!
                [{ text: '🔍 Buscar partida pública', callback_data: 'search_public_game' }],
                [{ text: '➡️ Unirse por código', callback_data: 'enter_code' }]
            ]
        };

        if (messageId) {
            await this.editMessage(chatId, messageId, text, { reply_markup: keyboard });
        } else {
            await this.sendMessage(chatId, text, { reply_markup: keyboard });
        }
    }
}

module.exports = BotUtils;
