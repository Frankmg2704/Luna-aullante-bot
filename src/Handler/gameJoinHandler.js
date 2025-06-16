// src/Handler/gameJoinHandler.js
const { Game, Player } = require('../models/models'); // Asegúrate que la ruta sea correcta

class GameJoinHandler {
    constructor(db, userStates, botUtils) {
        this.db = db;
        this.userStates = userStates;
        this.botUtils = botUtils;
    }

    async handle(msg) {
        const chatId = msg.chat.id;
        const text = msg.text;
        const username = msg.from.username || msg.from.first_name || `Usuario_${msg.from.id}`;
        const userId = msg.from.id;
        const joinCode = text.trim().toUpperCase();

        try {
            // Usa findByInvitationCode que ya verifica el estado LOBBY
            const gameToJoin = Game.findByInvitationCode(this.db, joinCode);

            if (gameToJoin) {
                const playersInGame = gameToJoin.getPlayers(this.db); // Obtiene jugadores de la tabla 'players'
                const playerExists = playersInGame.some(player => player.userId === userId);

                if (playerExists) {
                    this.botUtils.sendMessage(chatId, '¡Ya estás en esta partida! 🤷‍♂️');
                } else if (playersInGame.length >= gameToJoin.maxPlayers) {
                    this.botUtils.sendMessage(chatId, '¡Uy! La partida está llena. Busca otra o crea una nueva. 😬');
                } else {
                    // Añadir el jugador a la tabla 'players'
                    gameToJoin.addPlayer(this.db, userId, username); // Usa el método actualizado

                    delete this.userStates[userId]; // Limpiar el estado del usuario (usando userId)

                    const joinConfirmation = `¡Te has unido a la partida *"${gameToJoin.name}"*! 🎉\n\n` +
                        `Ahora hay ${playersInGame.length + 1} jugadores. Espera a que el creador inicie el juego.`;

                    this.botUtils.sendMessage(chatId, joinConfirmation, { parse_mode: 'Markdown' });

                    if (gameToJoin.creatorId !== userId) {
                        this.botUtils.sendMessage(gameToJoin.creatorId, `¡${username} se ha unido a tu partida *"${gameToJoin.name}"*! Ahora sois ${playersInGame.length + 1}.`, { parse_mode: 'Markdown' });
                    }
                    console.log(`INFO: ${username} (${userId}) se unió a la partida ${gameToJoin.name} (${gameToJoin.id})`);
                }

            } else {
                this.botUtils.sendMessage(chatId, 'El código de invitación no es válido o la partida ya no está en el lobby. Inténtalo de nuevo. 🤔');
            }

        } catch (error) {
            console.error('ERROR: Error al unirse a la partida:', error);
            this.botUtils.sendMessage(chatId, '¡Uy! Hubo un problema al unirte a la partida. Inténtalo de nuevo.');
        }
    }
}

module.exports = GameJoinHandler;
