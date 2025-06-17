// src/utils/botUtils.js

class BotUtils { // Nombre de la clase en inglés
    constructor(bot, db) {
        this.bot = bot;
        this.db = db;
    }

    /**
     * Envía un mensaje de texto a un chat.
     * @param {number} chatId - El ID del chat.
     * @param {string} text - El texto del mensaje.
     * @param {object} options - Opciones adicionales para el mensaje (ej: reply_markup).
     */
    async sendMessage(chatId, text, options = {}) { // Función en inglés
        try {
            // ¡IMPORTANTE: Retorna el resultado de la llamada al bot!
            return await this.bot.sendMessage(chatId, text, options);
        } catch (error) {
            console.error(`ERROR: Fallo al enviar mensaje a ${chatId}:`, error.message);
            return null; // Devuelve null en caso de error
        }
    }

    /**
     * Edita un mensaje existente en un chat.
     * @param {number} chatId - El ID del chat.
     * @param {number} messageId - El ID del mensaje a editar.
     * @param {string} text - El nuevo texto del mensaje.
     * @param {object} options - Opciones adicionales para el mensaje (ej: reply_markup).
     */
    async editMessage(chatId, messageId, text, options = {}) { // Función en inglés
        try {
            await this.bot.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                ...options,
            });
        } catch (error) {
            if (error.message.includes('message is not modified')) {
                console.log(`DEBUG: Intento de editar mensaje pero no fue modificado para ${chatId}:${messageId}`);
                return { message_id: messageId, chat: { id: chatId }, text: text };
            } else {
                console.error(`ERROR: Fallo al editar mensaje ${messageId} en ${chatId}:`, error.message);
                return null;
            }
        }
    }

    /**
     * Envía o edita el menú principal del bot.
     * @param {number} chatId - El ID del chat.
     * @param {number|null} messageId - El ID del mensaje a editar (si es null, envía uno nuevo).
     * @param {string} text - El texto a mostrar en el menú.
     */
    async sendMainMenu(chatId, messageId = null, text = '¡Bienvenido al bot de Luna Aullante! ¿Qué quieres hacer?') { // Función en inglés
        const keyboard = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '➕ Crear nueva partida', callback_data: 'create_game' }],
                    [{ text: '🔍 Buscar partida pública', callback_data: 'search_public_game' }],
                    [{ text: '➡️ Unirse por código', callback_data: 'enter_code' }]
                ]
            }
        };

        try {
            if (messageId) {
                // Intentar editar el mensaje existente
                const editedMessage = await this.editMessage(chatId, messageId, text, { parse_mode: 'Markdown', ...keyboard });
                return editedMessage; // Retorna el mensaje editado
            } else {
                // Si no hay messageId, enviar un nuevo mensaje
                const newMessage = await this.sendMessage(chatId, text, { parse_mode: 'Markdown', ...keyboard });
                return newMessage; // Retorna el mensaje nuevo
            }
        } catch (error) {
            console.error(`ERROR: Fallo al enviar/editar el menú principal en ${chatId}:`, error);
            // Si editar falla (ej. mensaje muy viejo), podemos intentar enviar uno nuevo como fallback.
            try {
                const newMessage = await this.sendMessage(chatId, text, { parse_mode: 'Markdown', ...keyboard });
                return newMessage;
            } catch (fallbackError) {
                console.error(`ERROR: Fallo incluso en el fallback al enviar menú principal a ${chatId}:`, fallbackError);
                throw fallbackError; // Re-lanza el error final
            }
        }
    }
}

module.exports = BotUtils; // Exportar la clase con el nombre en inglés
