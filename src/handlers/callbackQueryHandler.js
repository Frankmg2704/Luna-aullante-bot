// src/handlers/callbackQueryHandler.js

const { Game, Player } = require('../models/models');

class CallbackQueryHandler {
    constructor(bot, userStates, botUtils, db, gamePhaseHandler) {
        this.bot = bot;
        this.userStates = userStates;
        this.botUtils = botUtils;
        this.db = db;
        this.gamePhaseHandler = gamePhaseHandler;
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
                break;

            case callbackData === 'search_public_game':
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
                const gameIdToStart = callbackData.split(':')[1];
                console.log(`INFO: Intentando iniciar la partida con ID: ${gameIdToStart}`);
                try {
                    const game = Game.findById(this.db, gameIdToStart);
                    if (game && game.creatorId === userId) {
                        const result = game.startGame(this.db);
                        if (result.success) {
                            await this.botUtils.editMessage(chatId, messageId, result.message, { parse_mode: 'Markdown' });

                            if (result.playerIds) {
                                for (const playerId of result.playerIds) {
                                    const player = Player.findByUserIdAndGameId(this.db, playerId, game.id);
                                    if (player) {
                                        let roleMessage;
                                        // Accediendo al nombre del rol a través de la instancia
                                        if (player.role.name === 'Lobo') {
                                            roleMessage = `¡Eres un **Lobo**! 🐺 Tu objetivo es eliminar a los aldeanos sin ser descubierto. ¡La noche es tuya!`;
                                            const otherAlivePlayers = game.getPlayers(this.db).filter(p => p.isAlive && p.userId !== player.userId && p.role.name !== 'Lobo');
                                            const wolfActionKeyboard = otherAlivePlayers.map(p => ([{ text: `🔪 Matar a ${p.username}`, callback_data: `wolf_kill:${game.id}:${p.id}` }]));

                                            if (wolfActionKeyboard.length > 0) {
                                                await this.botUtils.sendMessage(playerId, roleMessage + '\n\n¿A quién devorarás esta noche?', {
                                                    parse_mode: 'Markdown',
                                                    reply_markup: { inline_keyboard: wolfActionKeyboard }
                                                });
                                            } else {
                                                await this.botUtils.sendMessage(playerId, roleMessage + '\n\nNo hay objetivos válidos para matar esta noche.');
                                            }

                                        } else if (player.role.name === 'Aldeano') {
                                            roleMessage = `¡Eres un **Aldeano**! 🧑‍🌾 Tu objetivo es encontrar a los lobos. ¡Mucha suerte!`;
                                            await this.botUtils.sendMessage(playerId, roleMessage, { parse_mode: 'Markdown' });
                                        } else {
                                            roleMessage = `Tu rol es **${player.role.name}**.`; // Fallback
                                            await this.botUtils.sendMessage(playerId, roleMessage, { parse_mode: 'Markdown' });
                                        }
                                        console.log(`INFO: Rol "${player.role.name}" enviado a ${player.username} (${playerId}) para partida ${game.name}.`);
                                    }
                                }
                            }
                        } else {
                            const keyboard = {
                                reply_markup: {
                                    inline_keyboard: [
                                        [{ text: '▶️ Intentar Iniciar Partida de Nuevo', callback_data: `start_game:${game.id}` }],
                                        [{ text: '↩️ Volver al menú principal', callback_data: 'start_menu' }]
                                    ]
                                }
                            };
                            await this.botUtils.editMessage(chatId, messageId, result.message, keyboard);
                        }
                    } else {
                        await this.botUtils.editMessage(chatId, messageId, '🚫 No tienes permiso para iniciar esta partida o no existe.');
                        await this.botUtils.sendMainMenu(chatId, null, '¿Qué quieres hacer ahora?');
                    }
                } catch (error) {
                    console.error('ERROR: Fallo al iniciar la partida:', error);
                    await this.botUtils.editMessage(chatId, messageId, '¡Ups! Hubo un error al intentar iniciar la partida.');
                }
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
                            await this.botUtils.editMessage(chatId, messageId, `ℹ️ ¡Ya estás en la partida "${game.name}"!`, {
                                reply_markup: {
                                    inline_keyboard: [
                                        [{ text: '🚪 Salir de esta partida', callback_data: `leave_game:${game.id}` }],
                                        [{ text: '↩️ Volver al menú principal', callback_data: 'start_menu' }]
                                    ]
                                }
                            });
                        } else if (playersInGame.length >= game.maxPlayers) {
                            await this.botUtils.editMessage(chatId, messageId, `🚫 La partida "${game.name}" está llena. Busca otra o crea una nueva. 😬`);
                        } else {
                            game.addPlayer(this.db, userId, username);
                            playersInGame = game.getPlayers(this.db);

                            await this.botUtils.editMessage(chatId, messageId, `✅ ¡Te has unido a la partida "${game.name}"!\n\nAhora hay ${playersInGame.length} jugadores. Esperando a más...`, {
                                reply_markup: {
                                    inline_keyboard: [
                                        [{ text: '🚪 Salir de esta partida', callback_data: `leave_game:${game.id}` }],
                                        [{ text: '↩️ Volver al menú principal', callback_data: 'start_menu' }]
                                    ]
                                }
                            });

                            for (const p of playersInGame) {
                                if (p.userId !== userId) {
                                    await this.botUtils.sendMessage(p.userId, `🎉 ¡${username} se ha unido a la partida "${game.name}"! Ahora sois ${playersInGame.length}.`);
                                }
                            }
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
                const gameIdToLeave = callbackData.split(':')[1];
                try {
                    const game = Game.findById(this.db, gameIdToLeave);
                    if (!game) {
                        await this.botUtils.editMessage(chatId, messageId, '🚫 Esa partida ya no existe.');
                        await this.botUtils.sendMainMenu(chatId, null, '¿Qué quieres hacer ahora?');
                        return;
                    }

                    const player = Player.findByUserIdAndGameId(this.db, userId, game.id);
                    if (!player) {
                        await this.botUtils.editMessage(chatId, messageId, 'ℹ️ No estás en esa partida.');
                        await this.botUtils.sendMainMenu(chatId, null, '¿Qué quieres hacer ahora?');
                        return;
                    }

                    this.db.prepare('DELETE FROM players WHERE id = ?').run(player.id);
                    console.log(`INFO: Jugador ${username} (${userId}) ha salido de la partida ${game.name} (${game.id}).`);

                    const remainingPlayers = game.getPlayers(this.db);

                    if (game.state === 'LOBBY' || game.state === 'IN_PROGRESS') {
                        for (const p of remainingPlayers) {
                            await this.botUtils.sendMessage(p.userId, `🚪 ${username} ha salido de la partida "${game.name}". Ahora sois ${remainingPlayers.length}.`);
                        }
                    }

                    let responseToLeaver = `👋 Has salido de la partida "${game.name}".`;

                    if (game.creatorId === userId) {
                        if (game.state === 'LOBBY') {
                            if (remainingPlayers.length === 0) {
                                this.db.prepare('DELETE FROM games WHERE id = ?').run(game.id);
                                console.log(`INFO: Partida ${game.name} (${game.id}) eliminada porque el creador era el último jugador en lobby.`);
                                responseToLeaver += '\n\nLa partida se ha disuelto al ser el último jugador en el lobby.';
                            } else {
                                const newCreator = remainingPlayers[0];
                                if (newCreator) {
                                    game.creatorId = newCreator.userId;
                                    game.save(this.db);
                                    responseToLeaver += `\n\n¡Atención! Eras el creador de la partida. Ahora ${newCreator.username} es el nuevo creador y puede iniciar el juego.`;
                                    await this.botUtils.sendMessage(newCreator.userId, `👑 ¡Felicidades! Ahora eres el creador de la partida "${game.name}", ya que el creador anterior se ha ido. Tú puedes iniciar el juego.`);
                                } else {
                                    responseToLeaver += '\n\n¡Atención! Eras el creador de la partida. La partida ha quedado sin creador y no podrá iniciarse.';
                                }
                            }
                        } else if (game.state === 'IN_PROGRESS') {
                            player.updateLifeStatus(this.db, false);
                            responseToLeaver += `\n\nHas abandonado la partida en curso. Tu personaje ha sido eliminado del juego.`;
                            if (remainingPlayers.filter(p => p.isAlive).length <= 1) {
                                game.updateState(this.db, 'ENDED');
                                console.log(`INFO: Partida ${game.name} (${game.id}) finalizada por abandono del creador.`);
                                for (const p of remainingPlayers) {
                                    await this.botUtils.sendMessage(p.userId, `La partida "${game.name}" ha terminado debido a que quedan muy pocos jugadores vivos.`);
                                }
                            }
                        }
                    } else if (game.state === 'IN_PROGRESS') {
                        player.updateLifeStatus(this.db, false);
                        responseToLeaver += `\n\nHas abandonado la partida en curso. Tu personaje ha sido eliminado del juego.`;
                        if (remainingPlayers.filter(p => p.isAlive).length <= 1) {
                            game.updateState(this.db, 'ENDED');
                            console.log(`INFO: Partida ${game.name} (${game.id}) finalizada por abandono de jugador.`);
                            for (const p of remainingPlayers) {
                                await this.botUtils.sendMessage(p.userId, `La partida "${game.name}" ha terminado debido a que quedan muy pocos jugadores vivos.`);
                            }
                        }
                    }

                    await this.botUtils.editMessage(chatId, messageId, responseToLeaver, {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '↩️ Volver al menú principal', callback_data: 'start_menu' }]
                            ]
                        }
                    });

                } catch (error) {
                    console.error('ERROR: Fallo al salir de la partida:', error);
                    await this.botUtils.editMessage(chatId, messageId, '¡Ups! Hubo un error al intentar salir de la partida. Intenta de nuevo más tarde.');
                }
                break;


            case callbackData.startsWith('view_game_details:'):
                const gameIdToView = callbackData.split(':')[1];
                try {
                    const game = Game.findById(this.db, gameIdToView);
                    if (!game) {
                        await this.botUtils.editMessage(chatId, messageId, '🚫 Esa partida ya no existe.');
                        await this.botUtils.sendMainMenu(chatId, null, '¿Qué quieres hacer ahora?');
                        return;
                    }
                    const playersInGame = game.getPlayers(this.db);
                    const isCreator = game.creatorId === userId;
                    const creatorUsername = playersInGame.find(p => p.userId === game.creatorId)?.username || 'Desconocido';

                    let detailsText = `Detalles de la partida *"${game.name}"*:\n` +
                        `Código: \`${game.invitationCode}\`\n` +
                        `Creador: ${creatorUsername}\n` +
                        `Jugadores: ${playersInGame.length}/${game.maxPlayers}\n` +
                        `Estado: ${game.state === 'LOBBY' ? 'En espera' : game.state}\n` +
                        `Fase actual: ${game.currentPhase === 'night' ? 'Noche 🌑' : 'Día ☀️'}\n` +
                        `Día del juego: ${game.day}\n\n`;

                    if (playersInGame.length > 0) {
                        detailsText += 'Jugadores actuales:\n';
                        playersInGame.forEach(player => {
                            detailsText += `- ${player.username} ${player.userId === game.creatorId ? '(Creador)' : ''} ${player.isAlive ? '' : '(💀 Muerto)'} ${player.role ? `[${player.role.name}]` : ''}\n`; // Accediendo a .name
                        });
                    }

                    const keyboard = [];
                    if (game.state === 'LOBBY') {
                        if (isCreator) {
                            const currentPlayersCount = playersInGame.length;
                            if (currentPlayersCount >= game.minPlayers) {
                                keyboard.push([{ text: '▶️ Iniciar Partida', callback_data: `start_game:${game.id}` }]);
                            } else {
                                keyboard.push([{ text: `(Necesitas ${game.minPlayers - currentPlayersCount} más para iniciar)`, callback_data: 'dummy_button' }]);
                            }
                        }
                        keyboard.push([{ text: '🚪 Salir de esta partida', callback_data: `leave_game:${game.id}` }]);
                    } else if (game.state === 'IN_PROGRESS') {
                        const currentPlayer = Player.findByUserIdAndGameId(this.db, userId, game.id);
                        if (currentPlayer && currentPlayer.isAlive) {
                            // Aquí usamos currentPlayer.role.canActAtNight
                            if (game.currentPhase === 'night' && currentPlayer.role.canActAtNight && !currentPlayer.hasVoted) {
                                keyboard.push([{ text: '🔪 Realizar Acción Nocturna', callback_data: `show_wolf_kill_options:${game.id}` }]);
                            } else if (game.currentPhase === 'day' && !currentPlayer.hasVoted) {
                                keyboard.push([{ text: '🗳️ Votar por un Sospechoso', callback_data: `show_day_vote_options:${game.id}` }]);
                            }
                            keyboard.push([{ text: '🔄 Actualizar Estado', callback_data: `view_game_details:${game.id}` }]);
                        }
                        keyboard.push([{ text: '🚪 Salir de esta partida (Rendirse)', callback_data: `leave_game:${game.id}` }]);
                    }
                    keyboard.push([{ text: '↩️ Volver al menú principal', callback_data: 'start_menu' }]);

                    await this.botUtils.editMessage(chatId, messageId, detailsText, {
                        parse_mode: 'Markdown',
                        reply_markup: { inline_keyboard: keyboard }
                    });

                } catch (error) {
                    console.error('ERROR: Fallo al ver detalles de la partida:', error);
                    await this.botUtils.editMessage(chatId, messageId, '¡Ups! Hubo un error al obtener los detalles de la partida.');
                }
                break;

            // --- DELEGANDO CASOS DE ACCIONES DEL JUEGO AL GamePhaseHandler ---
            case callbackData.startsWith('wolf_kill:'):
                await this.gamePhaseHandler.handleWolfKill(callbackQuery);
                break;

            case callbackData.startsWith('show_wolf_kill_options:'):
                // Esta lógica se mantiene aquí por ahora, ya que es más una UI/interacción directa.
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
                            reply_markup: { inline_keyboard: [[{ text: '↩️ Volver a Detalles de Partida', callback_data: `view_game_details:${game.id}` }]] }
                        });
                        return;
                    }

                    const otherAlivePlayers = game.getPlayers(this.db).filter(p => p.isAlive && p.userId !== userId && p.role.name !== 'Lobo');

                    if (otherAlivePlayers.length === 0) {
                        await this.botUtils.editMessage(chatId, messageId, 'No hay aldeanos vivos para devorar esta noche. ¡Esperemos al amanecer!', {
                            reply_markup: { inline_keyboard: [[{ text: '↩️ Volver a Detalles de Partida', callback_data: `view_game_details:${game.id}` }]] }
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
