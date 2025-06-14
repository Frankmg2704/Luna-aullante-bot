// src/handlers/messageHandler.js
const GameCreationHandler = require('./gameCreationHandler');
const GameJoinHandler = require('./gameJoinHandler');

class MessageHandler {
    constructor(db, userStates, botUtils) {
        this.db = db;
        this.userStates = userStates;
        this.botUtils = botUtils;
        this.gameCreationHandler = new GameCreationHandler(db, userStates, botUtils);
        this.gameJoinHandler = new GameJoinHandler(db, userStates, botUtils);
    }

    async handle(msg) {
        const chatId = msg.chat.id;
        const text = msg.text;
        const userName = msg.from.first_name || 'jugador';

        if (text && text.startsWith('/')) {
            return; // Ignorar comandos, ya se manejan con bot.onText
        }

        console.log(`INFO: Mensaje de texto recibido de ${userName} (${chatId}): "${text}"`);

        if (this.userStates[chatId] === 'EXPECTING_GAME_NAME') {
            await this.gameCreationHandler.handle(msg);
        } else if (this.userStates[chatId] === 'EXPECTING_JOIN_CODE') {
            await this.gameJoinHandler.handle(msg);
        } else {
            this.botUtils.sendMessage(chatId, `No entendí "${text}". Usa /start para ver las opciones.`);
        }
    }
}

module.exports = MessageHandler;
