// src/handlers/gameCreationHandler.js
const { Game, Player } = require('../models');

class GameCreationHandler {
    constructor(db, userStates, botUtils) {
        this.db = db;
        this.userStates = userStates;
        this.botUtils = botUtils;
    }

    async handle(msg) {
        const chatId = msg.chat.id;
        const text = msg.text;
        const userName = msg.from.first_name || 'jugador';
        const userId = msg.from.id;

        let gameName = text.trim();
        if (gameName.toLowerCase() === 'omitir') {
            gameName = `Partida de ${userName}`;
        }

        try {
            const newGame = new Game(userId, gameName);
            newGame.save(this.db);
            console.log(`DEBUG: Nueva partida creada y guardada: ${newGame.name}, Código: ${newGame.invitationCode}`);

            const creatorPlayer = new Player(userId, newGame.id);
            creatorPlayer.save(this.db);
            console.log(`DEBUG: Jugador creador (${userName}) añadido a la partida.`);

            delete this.userStates[chatId]; // Limpiar el estado después de la creación exitosa

            const confirmationMessage = `¡Partida *"${newGame.name}"* creada con éxito! 🎉\n\n` +
                `Código de invitación: \`${newGame.invitationCode}\`\n\n` +
                `Invita a tus amigos y cuando estén listos, iniciaremos el juego.`;

            const keyboard = {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '▶️ Iniciar Partida', callback_data: `start_game:${newGame.id}` }]
                    ]
                }
            };

            this.botUtils.sendMessage(chatId, confirmationMessage, { parse_mode: 'Markdown', ...keyboard });
            console.log(`INFO: Partida creada: ${newGame.name} (${newGame.id}) por ${userName}`);

        } catch (error) {
            console.error('ERROR: Error al crear la partida:', error);
            // Podrías añadir lógica para comprobar si el nombre ya existe, etc.
            this.botUtils.sendMessage(chatId, '¡Uy! Hubo un problema al crear la partida. Inténtalo de nuevo. Asegúrate que el nombre no sea muy largo.');
        }
    }
}

module.exports = GameCreationHandler;
