// src/Handler/gameCreationHandler.js
const { Game } = require('../models/models');

class GameCreationHandler {
    constructor(db, userStates, botUtils) {
        this.db = db;
        this.userStates = userStates;
        this.botUtils = botUtils;
    }

    async handle(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const username = msg.from.username || msg.from.first_name || `Usuario_${userId}`;
        const gameName = msg.text.trim();

        if (gameName.length < 3 || gameName.length > 50) {
            await this.botUtils.sendMessage(chatId, 'El nombre de la partida debe tener entre 3 y 50 caracteres. Intenta de nuevo.');
            return;
        }

        try {
            const newGame = new Game(null, gameName, userId);
            newGame.save(this.db);
            newGame.addPlayer(this.db, userId, username); // El creador se une automáticamente

            delete this.userStates[userId];

            const responseText = `¡Partida *"${gameName}"* creada con éxito! 🎉\n` +
                `Código de invitación: \`${newGame.invitationCode}\`\n` +
                `Actualmente hay 1 jugador (tú). Mínimo: ${newGame.minPlayers}, Máximo: ${newGame.maxPlayers}.\n\n` +
                `¡Comparte el código con tus amigos para que se unan!`;

            // ¡Corrección aquí! El keyboard debe ir en el sendMessage
            const keyboard = {
                inline_keyboard: [
                    [{ text: '▶️ Iniciar Partida', callback_data: `start_game:${newGame.id}` }],
                    [{ text: '↩️ Volver al menú principal', callback_data: 'start_menu' }]
                ]
            };

            await this.botUtils.sendMessage(chatId, responseText, { parse_mode: 'Markdown', reply_markup: keyboard });
            console.log(`INFO: Partida "${gameName}" (${newGame.id}) creada por ${username} (${userId}).`);

        } catch (error) {
            console.error('ERROR: Fallo al crear la partida:', error);
            await this.botUtils.sendMessage(chatId, '¡Ups! No pude crear la partida. ¿Ya tienes una partida en curso? Intenta de nuevo más tarde o revisa tu última partida.');
        }
    }
}

module.exports = GameCreationHandler;
