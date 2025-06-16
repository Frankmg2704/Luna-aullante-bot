// src/logicaJuego/partidas/unirsePartida.js

const { Game, Player } = require('../../models/models');

class JoinGameHandler {
    // Añadimos manejadorSalaEspera al constructor
    constructor(db, userStates, botUtils, manejadorSalaEspera) {
        this.db = db;
        this.userStates = userStates;
        this.botUtils = botUtils;
        this.manejadorSalaEspera = manejadorSalaEspera; // Guardamos la instancia
    }

    /**
     * Inicia el proceso de unirse a una partida por código.
     * Es llamada desde CallbackQueryHandler cuando se selecciona 'enter_code'.
     * Pide al usuario el código de la partida.
     * @param {number} chatId - ID del chat.
     * @param {number} userId - ID del usuario.
     * @param {number} messageId - ID del mensaje a editar.
     */
    async requestJoinCode(chatId, userId, messageId) {
        this.userStates[userId] = { state: 'awaiting_join_code' };
        await this.botUtils.editMessage(chatId, messageId,
            'Por favor, introduce el código de la partida a la que quieres unirte:',
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '↩️ Cancelar', callback_data: 'start_menu' }]
                    ]
                }
            }
        );
    }

    /**
     * Maneja el código de la partida enviado por el usuario.
     * Es llamada desde MessageHandler cuando el estado es 'awaiting_join_code'.
     * Intenta unir al jugador a la partida.
     * @param {object} msg - El objeto de mensaje de Telegram con el código.
     */
    async handleJoinCode(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const username = msg.from.first_name || msg.from.username;
        const invitationCode = msg.text.trim().toUpperCase();

        delete this.userStates[userId];

        try {
            const existingPlayer = Player.findByUserId(this.db, userId);
            if (existingPlayer && Game.findById(this.db, existingPlayer.gameId)?.state === 'LOBBY') {
                await this.botUtils.sendMessage(chatId, `🚫 Ya estás en el lobby de la partida "${Game.findById(this.db, existingPlayer.gameId).name}". Sal de esa partida primero o únete a ella.`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🚪 Salir de mi partida actual', callback_data: `leave_game:${existingPlayer.gameId}` }],
                            [{ text: '↩️ Volver al menú principal', callback_data: 'start_menu' }]
                        ]
                    }
                });
                return;
            }

            const game = Game.findByInvitationCode(this.db, invitationCode);

            if (!game) {
                await this.botUtils.sendMessage(chatId, '❌ El código de partida es inválido o la partida no existe. Por favor, verifica el código e intenta de nuevo.', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '➡️ Volver a unirse por código', callback_data: 'enter_code' }],
                            [{ text: '↩️ Volver al menú principal', callback_data: 'start_menu' }]
                        ]
                    }
                });
                return;
            }

            if (game.state !== 'LOBBY') {
                await this.botUtils.sendMessage(chatId, `🚫 La partida "${game.name}" ya está en curso o ha terminado. No puedes unirte en este momento.`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔍 Buscar partida pública', callback_data: 'search_public_game' }],
                            [{ text: '↩️ Volver al menú principal', callback_data: 'start_menu' }]
                        ]
                    }
                });
                return;
            }

            const playersInGame = game.getPlayers(this.db);
            if (playersInGame.length >= game.maxPlayers) {
                await this.botUtils.sendMessage(chatId, `🚫 La partida "${game.name}" está llena. Busca otra o crea una nueva. 😬`);
                return;
            }

            game.addPlayer(this.db, userId, username);
            const updatedPlayersInGame = game.getPlayers(this.db);

            await this.botUtils.sendMessage(chatId, `✅ ¡Te has unido a la partida *"${game.name}"*!\n\n` +
                `Ahora hay ${updatedPlayersInGame.length} jugadores. Esperando a más...`,
                { parse_mode: 'Markdown' }
            );

            for (const p of updatedPlayersInGame) {
                if (p.userId !== userId) {
                    await this.botUtils.sendMessage(p.userId, `🎉 ¡*${username}* se ha unido a la partida *"${game.name}"*! Ahora sois ${updatedPlayersInGame.length}.`, { parse_mode: 'Markdown' });
                }
            }

            // Delegamos al ManejadorSalaEspera
            await this.manejadorSalaEspera.sendLobbyMenu(chatId, game.id, userId, null);


        } catch (error) {
            console.error('ERROR: Fallo al unirse a la partida por código:', error);
            await this.botUtils.sendMessage(chatId, '¡Ups! Hubo un error al intentar unirte a la partida. Intenta de nuevo más tarde.');
        }
    }
}

module.exports = JoinGameHandler;
