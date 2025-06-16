// src/logicaJuego/partidas/crearPartida.js

const { Game, Player } = require('../../models/models');
const { v4: uuidv4 } = require('uuid');
const { generateRandomCode } = require('../../utils/codeGenerator');

class CreateGameHandler {
    // Añadimos manejadorSalaEspera al constructor
    constructor(db, userStates, botUtils, manejadorSalaEspera) {
        this.db = db;
        this.userStates = userStates;
        this.botUtils = botUtils;
        this.manejadorSalaEspera = manejadorSalaEspera; // Guardamos la instancia
    }

    /**
     * Inicia el proceso de creación de una partida.
     * Es llamada desde CallbackQueryHandler cuando se selecciona 'create_game'.
     * Pide al usuario el nombre de la partida.
     * @param {number} chatId - ID del chat.
     * @param {number} userId - ID del usuario.
     * @param {number} messageId - ID del mensaje a editar.
     */
    async requestGameName(chatId, userId, messageId) {
        this.userStates[userId] = { state: 'awaiting_game_name' };
        await this.botUtils.editMessage(chatId, messageId,
            '¡Excelente! ¿Cómo quieres llamar a tu nueva partida de Luna Aullante?\n\n(Ej: "La Manada Salvaje", "Noche de Lobos")',
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
     * Maneja el nombre de la partida enviado por el usuario.
     * Es llamada desde MessageHandler cuando el estado es 'awaiting_game_name'.
     * Crea la partida y el jugador creador, luego envía el menú del lobby.
     * @param {object} msg - El objeto de mensaje de Telegram con el nombre de la partida.
     */
    async handleGameName(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const username = msg.from.first_name || msg.from.username;
        const gameName = msg.text.trim();

        if (gameName.length < 3 || gameName.length > 50) {
            await this.botUtils.sendMessage(chatId, 'El nombre de la partida debe tener entre 3 y 50 caracteres. Por favor, intenta de nuevo.');
            return;
        }

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

            const gameId = uuidv4();
            let invitationCode;
            let isCodeUnique = false;
            let attempts = 0;

            while (!isCodeUnique && attempts < 5) {
                invitationCode = generateRandomCode(6);
                const existingGame = Game.findByInvitationCode(this.db, invitationCode);
                if (!existingGame) {
                    isCodeUnique = true;
                }
                attempts++;
            }

            if (!isCodeUnique) {
                await this.botUtils.sendMessage(chatId, "😵 No se pudo crear la partida. Inténtalo de nuevo.");
                return;
            }

            const game = new Game(gameId, gameName, userId, invitationCode);
            game.save(this.db);

            game.addPlayer(this.db, userId, username);

            console.log(`INFO: Partida "${gameName}" (${gameId}) creada por ${username}. Código: ${invitationCode}`);

            await this.botUtils.sendMessage(chatId,
                `🎉 ¡Partida *"${gameName}"* creada con éxito! 🎉\n\n` +
                `Comparte este *código* para que tus amigos se unan: \`${invitationCode}\`\n\n` +
                'Ahora mismo eres el único jugador. ¡Necesitamos más gente para empezar a jugar! 😉',
                { parse_mode: 'Markdown' }
            );

            // Delegamos al ManejadorSalaEspera
            await this.manejadorSalaEspera.sendLobbyMenu(chatId, gameId, userId);

        } catch (error) {
            console.error('ERROR: Fallo al crear la partida:', error);
            await this.botUtils.sendMessage(chatId, '¡Ups! Hubo un error al crear la partida. Por favor, inténtalo de nuevo más tarde.');
            delete this.userStates[userId];
        }
    }

    // Eliminamos sendLobbyMenu de aquí, ahora vive en ManejadorSalaEspera
}

module.exports = CreateGameHandler;
