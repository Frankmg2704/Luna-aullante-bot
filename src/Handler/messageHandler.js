// src/manejadores/mensajeManejador.js

const { Game, Player } = require('../models/models');

class MessageHandler {
    constructor(db, userStates, botUtils) {
        this.db = db;
        this.userStates = userStates;
        this.botUtils = botUtils;

        this.createGameHandler = null; // Se inyectará después
        this.joinGameHandler = null;   // Se inyectará después
    }

    // Método para inyectar dependencias
    setGameHandlers(createGameHandler, joinGameHandler) {
        this.createGameHandler = createGameHandler;
        this.joinGameHandler = joinGameHandler;
    }

    /**
     * Maneja los mensajes de texto del usuario.
     * @param {object} msg - El objeto de mensaje de Telegram.
     */
    async handle(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const messageText = msg.text;

        console.log(`DEBUG: Mensaje recibido: "${messageText}" de usuario ${userId}`);

        const currentUserState = this.userStates[userId];

        if (currentUserState) {
            switch (currentUserState.state) {
                case 'awaiting_game_name':
                    if (this.createGameHandler) {
                        await this.createGameHandler.handleGameName(msg); // Llama al método del nuevo manejador
                    } else {
                        console.error("ERROR: createGameHandler no está configurado.");
                        await this.botUtils.sendMessage(chatId, '¡Ups! Algo salió mal al intentar crear la partida. Intenta de nuevo.');
                        delete this.userStates[userId];
                    }
                    break;
                case 'awaiting_join_code':
                    if (this.joinGameHandler) {
                        await this.joinGameHandler.handleJoinCode(msg); // Llama al método del nuevo manejador
                    } else {
                        console.error("ERROR: joinGameHandler no está configurado.");
                        await this.botUtils.sendMessage(chatId, '¡Ups! Algo salió mal al intentar unirte a la partida. Intenta de nuevo.');
                        delete this.userStates[userId];
                    }
                    break;
                default:
                    console.log(`DEBUG: Estado de usuario desconocido o no manejado: ${currentUserState.state}`);
                    await this.botUtils.sendMessage(chatId, 'No entiendo eso. ¿Necesitas ayuda o quieres volver al menú principal?', {
                        reply_markup: {
                            inline_keyboard: [[{ text: '↩️ Menú Principal', callback_data: 'start_menu' }]]
                        }
                    });
                    delete this.userStates[userId];
                    break;
            }
        } else {
            await this.botUtils.sendMessage(chatId, '¡Hola! No entendí ese mensaje. Usa el menú para interactuar conmigo. 👇', {
                reply_markup: {
                    inline_keyboard: [[{ text: '↩️ Menú Principal', callback_data: 'start_menu' }]]
                }
            });
        }
    }
}

module.exports = MessageHandler;
