// src/manejadores/consultaCallbackManejador.js

const { Game, Player } = require('../models/models');

class CallbackQueryHandler {
    constructor(bot, userStates, botUtils, db, gamePhaseHandler, createGameHandler, joinGameHandler, manejadorSalaEspera) {
        this.bot = bot;
        this.userStates = userStates;
        this.botUtils = botUtils;
        this.db = db;
        this.gamePhaseHandler = gamePhaseHandler;
        this.createGameHandler = createGameHandler;
        this.joinGameHandler = joinGameHandler;
        this.manejadorSalaEspera = manejadorSalaEspera;
    }

    async handle(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const userId = callbackQuery.from.id;
        const username = callbackQuery.from.username || callbackQuery.from.first_name || `Usuario_${userId}`;
        const callbackData = callbackQuery.data;

        await this.bot.answerCallbackQuery(callbackQuery.id);

        console.log(`DEBUG: Callback Query recibido: ${callbackData} de usuario ${username} (${userId})`);

        switch (true) {
            case callbackData === 'create_game':
                await this.createGameHandler.requestGameName(chatId, userId, messageId);
                break;

            case callbackData === 'search_public_game':
                // ... (lógica de búsqueda de partidas públicas, sin cambios aquí) ...
                console.log('INFO: Buscando partidas públicas...');
                try {
                    const lobbyGames = Game.getLobbyGames(this.db);

                    if (lobbyGames.length > 0) {
                        let responseText = '🐺 ¡Mira estas partidas públicas disponibles para unirte!\n\n';
                        const keyboard = lobbyGames.map(game => {
                            const playerCount = game.currentPlayersCount;
                            const isUserInGame = Player.findByUserIdAndGameId(this.db, userId, game.id);
                            return [{
                                text: `${game.name} (${playerCount}/${game.maxPlayers} jugadores) ${isUserInGame ? '✅' : ''}`,
                                callback_data: isUserInGame ? `view_game_details:${game.id}` : `join_game_by_id:${game.id}`
                            }];
                        });

                        keyboard.push([{ text: '↩️ Volver al menú principal', callback_data: 'start_menu' }]);

                        await this.botUtils.editMessage(chatId, messageId, responseText, {
                            reply_markup: {
                                inline_keyboard: keyboard
                            }
                        });
                    } else {
                        const keyboard = [
                            [{ text: '➕ Crear nueva partida', callback_data: 'create_game' }],
                            [{ text: '↩️ Volver al menú principal', callback_data: 'start_menu' }]
                        ];
                        await this.botUtils.editMessage(chatId, messageId, '💔 No hay partidas públicas disponibles ahora mismo. ¡Sé el primero en crear una!', {
                            reply_markup: {
                                inline_keyboard: keyboard
                            }
                        });
                    }
                } catch (error) {
                    console.error('ERROR: Fallo al buscar partidas públicas:', error);
                    await this.botUtils.editMessage(chatId, messageId, '¡Ups! Hubo un error al buscar partidas públicas. Intenta de nuevo más tarde.');
                }
                break;


            case callbackData === 'enter_code':
                await this.joinGameHandler.requestJoinCode(chatId, userId, messageId);
                break;

            case callbackData === 'start_menu':
                delete this.userStates[userId];
                await this.botUtils.sendMainMenu(chatId, messageId, '¡Bienvenido de nuevo al menú principal!');
                break;

            case callbackData === 'join_game':
                console.warn('ADVERTENCIA: Recibido callback_data "join_game". Esto es un remanente del menú antiguo. Redirigiendo al menú principal.');
                await this.botUtils.sendMainMenu(chatId, null, 'Parece que hiciste clic en una opción antigua. Aquí tienes el menú principal actualizado.');
                break;

            case callbackData.startsWith('start_game:'):
                await this.manejadorSalaEspera.handleStartGame(callbackQuery); // ¡Delegado!
                break;

            case callbackData.startsWith('join_game_by_id:'):
                const gameIdToJoin = callbackData.split(':')[1];
                console.log(`INFO: Usuario ${username} (${userId}) intentando unirse a la partida con ID: ${gameIdToJoin}`);

                try {
                    const game = Game.findById(this.db, gameIdToJoin);

                    if (game && game.state === 'LOBBY') {
                        let playersInGame = game.getPlayers(this.db);
                        const playerExists = playersInGame.some(p => p.userId === userId);

                        if (playerExists) {
                            // Si el jugador ya está en la partida, simplemente le mostramos el lobby
                            await this.manejadorSalaEspera.sendLobbyMenu(chatId, game.id, userId, messageId);
                        } else if (playersInGame.length >= game.maxPlayers) {
                            await this.botUtils.editMessage(chatId, messageId, `🚫 La partida "${game.name}" está llena. Busca otra o crea una nueva. 😬`);
                        } else {
                            game.addPlayer(this.db, userId, username);
                            playersInGame = game.getPlayers(this.db);

                            await this.botUtils.editMessage(chatId, messageId, `✅ ¡Te has unido a la partida "${game.name}"!\n\nAhora hay ${playersInGame.length} jugadores. Esperando a más...`, {
                                parse_mode: 'Markdown'
                            });

                            for (const p of playersInGame) {
                                if (p.userId !== userId) {
                                    await this.botUtils.sendMessage(p.userId, `🎉 ¡${username} se ha unido a la partida "${game.name}"! Ahora sois ${playersInGame.length}.`, { parse_mode: 'Markdown' });
                                }
                            }
                            // Muestra el menú de la sala de espera al nuevo jugador
                            await this.manejadorSalaEspera.sendLobbyMenu(chatId, game.id, userId, null);
                        }
                    } else {
                        await this.botUtils.editMessage(chatId, messageId, '❌ ¡Ups! Esa partida ya no existe o no está disponible para unirse.');
                    }
                } catch (error) {
                    console.error('ERROR: Fallo al unirse a la partida por ID:', error);
                    await this.botUtils.editMessage(chatId, messageId, '¡Ups! Hubo un error al intentar unirte a la partida. Intenta de nuevo más tarde.');
                }
                break;

            case callbackData.startsWith('leave_game:'):
                await this.manejadorSalaEspera.handleLeaveGame(callbackQuery); // ¡Delegado!
                break;

            case callbackData.startsWith('view_game_details:'):
                const gameIdToView = callbackData.split(':')[1];
                await this.manejadorSalaEspera.sendLobbyMenu(chatId, gameIdToView, userId, messageId); // ¡Delegado!
                break;

            case callbackData.startsWith('wolf_kill:'):
                await this.gamePhaseHandler.handleWolfKill(callbackQuery);
                break;

            case callbackData.startsWith('show_wolf_kill_options:'):
                const gameIdShowWolfOptions = callbackData.split(':')[1];
                try {
                    const game = Game.findById(this.db, gameIdShowWolfOptions);
                    const wolfPlayer = Player.findByUserIdAndGameId(this.db, userId, gameIdShowWolfOptions);

                    if (!game || !wolfPlayer || wolfPlayer.role.name !== 'Lobo' || !wolfPlayer.isAlive || game.currentPhase !== 'night') {
                        await this.botUtils.sendMessage(chatId, '🚫 No puedes ver estas opciones ahora mismo.');
                        return;
                    }

                    if (wolfPlayer.hasVoted) {
                        await this.botUtils.editMessage(chatId, messageId, 'Ya has realizado tu acción de lobo esta noche. Espera el amanecer...', {
                            reply_markup: { inline_keyboard: [[{ text: '🔄 Actualizar Estado', callback_data: `view_game_details:${game.id}` }]] }
                        });
                        return;
                    }

                    const otherAlivePlayers = game.getPlayers(this.db).filter(p => p.isAlive && p.userId !== userId && p.role.name !== 'Lobo');

                    if (otherAlivePlayers.length === 0) {
                        await this.botUtils.editMessage(chatId, messageId, 'No hay aldeanos vivos para devorar esta noche. ¡Esperemos al amanecer!', {
                            reply_markup: { inline_keyboard: [[{ text: '🔄 Actualizar Estado', callback_data: `view_game_details:${game.id}` }]] }
                        });
                        return;
                    }

                    const wolfKillKeyboard = otherAlivePlayers.map(p => ([{ text: `🔪 ${p.username}`, callback_data: `wolf_kill:${game.id}:${p.id}` }]));
                    wolfKillKeyboard.push([{ text: '↩️ Volver a Detalles de Partida', callback_data: `view_game_details:${game.id}` }]);

                    await this.botUtils.editMessage(chatId, messageId, '¿A quién deseas devorar esta noche, Lobo?', {
                        reply_markup: { inline_keyboard: wolfKillKeyboard }
                    });

                } catch (error) {
                    console.error('ERROR: Fallo al mostrar opciones de lobo:', error);
                    await this.botUtils.sendMessage(chatId, '¡Ups! Hubo un error al mostrar las opciones de lobo.');
                }
                break;

            case callbackData.startsWith('show_day_vote_options:'):
                await this.gamePhaseHandler.showDayVoteOptions(callbackQuery);
                break;

            case callbackData.startsWith('day_vote:'):
                await this.gamePhaseHandler.handleDayVote(callbackQuery);
                break;

            default:
                await this.botUtils.editMessage(chatId, messageId, '¡Ups! Esa opción no la reconozco aún. Intenta de nuevo.', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '↩️ Volver al menú principal', callback_data: 'start_menu' }]
                        ]
                    }
                });
                break;
        }
    }
}

module.exports = CallbackQueryHandler;
