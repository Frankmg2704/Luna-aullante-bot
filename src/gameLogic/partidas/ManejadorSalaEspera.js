// src/logicaJuego/partidas/manejadorSalaEspera.js

const { Game, Player } = require('../../models/models');

class ManejadorSalaEspera {
    constructor(db, botUtils, gamePhaseHandler) {
        this.db = db;
        this.botUtils = botUtils;
        this.gamePhaseHandler = gamePhaseHandler;
    }

    // ... (Método sendLobbyMenu sin cambios significativos en esta sección) ...
    async sendLobbyMenu(chatId, gameId, userId, messageId = null) {
        const game = Game.findById(this.db, gameId);
        if (!game) {
            await this.botUtils.sendMessage(chatId, 'La partida no fue encontrada.');
            return;
        }

        const playersInGame = game.getPlayers(this.db);
        const isCreator = game.creatorId === userId;
        const currentPlayersCount = playersInGame.length;

        let playersListText = playersInGame.map(p => {
            return `- ${p.username}${p.userId === game.creatorId ? ' (Creador)' : ''}`;
        }).join('\n');

        let text = `🛋️ Estás en el lobby de *"${game.name}"*\n\n` +
            `*Código de invitación*: \`${game.invitationCode}\`\n` +
            `*Jugadores* (${currentPlayersCount}/${game.maxPlayers}):\n${playersListText}\n\n`;

        const keyboard = [];

        if (isCreator) {
            text += '¡Como creador, puedes iniciar la partida cuando haya suficientes jugadores!';
            if (currentPlayersCount >= game.minPlayers) {
                keyboard.push([{ text: '▶️ Iniciar Partida', callback_data: `start_game:${game.id}` }]);
            } else {
                keyboard.push([{ text: `(Necesitas ${game.minPlayers - currentPlayersCount} más para iniciar)`, callback_data: 'dummy_button' }]);
            }
        } else {
            text += 'Esperando a que el creador inicie la partida o se unan más jugadores.';
        }

        keyboard.push([{ text: '🔄 Actualizar lista de jugadores', callback_data: `view_game_details:${game.id}` }]);
        keyboard.push([{ text: '🚪 Salir de esta partida', callback_data: `leave_game:${game.id}` }]);
        keyboard.push([{ text: '↩️ Volver al menú principal', callback_data: 'start_menu' }]);


        if (messageId) {
            await this.botUtils.editMessage(chatId, messageId, text, {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: keyboard }
            });
        } else {
            await this.botUtils.sendMessage(chatId, text, {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: keyboard }
            });
        }
    }


    /**
     * Maneja el intento de iniciar una partida.
     * @param {object} callbackQuery - El objeto de la consulta de callback.
     */
    async handleStartGame(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const userId = callbackQuery.from.id;
        const gameIdToStart = callbackQuery.data.split(':')[1];

        console.log(`INFO: Intentando iniciar la partida con ID: ${gameIdToStart}`);
        try {
            const game = Game.findById(this.db, gameIdToStart);
            if (game && game.creatorId === userId) {
                const result = game.startGame(this.db); // Llama a startGame
                if (result.success) {
                    await this.botUtils.editMessage(chatId, messageId, result.message, { parse_mode: 'Markdown' });

                    // ENVÍO DE ROLES A CADA JUGADOR (se ha movido del CallbackQueryHandler original)
                    if (result.playerIds) {
                        for (const playerId of result.playerIds) {
                            const player = Player.findByUserIdAndGameId(this.db, playerId, game.id);
                            if (player) {
                                let roleMessage;
                                if (player.role.name === 'Lobo') {
                                    roleMessage = `¡Eres un **Lobo**! 🐺 Tu objetivo es eliminar a los aldeanos sin ser descubierto. ¡La noche es tuya!`;
                                    // Los lobos necesitan saber a quién matar al inicio de la noche
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
                                    roleMessage = `Tu rol es **${player.role.name}**.`; // Fallback para otros roles
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
    }

    // ... (handleLeaveGame y otros métodos sin cambios en esta sección) ...
    async handleLeaveGame(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const userId = callbackQuery.from.id;
        const username = callbackQuery.from.username || callbackQuery.from.first_name || `Usuario_${userId}`;
        const gameIdToLeave = callbackQuery.data.split(':')[1];

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
                    await this.botUtils.sendMessage(p.userId, `🚪 *${username}* ha salido de la partida *"${game.name}"*. Ahora sois ${remainingPlayers.length}.`, { parse_mode: 'Markdown' });
                }
            }

            let responseToLeaver = `👋 Has salido de la partida *"${game.name}"*.`;

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
                            responseToLeaver += `\n\n¡Atención! Eras el creador de la partida. Ahora *${newCreator.username}* es el nuevo creador y puede iniciar el juego.`;
                            await this.botUtils.sendMessage(newCreator.userId, `👑 ¡Felicidades! Ahora eres el creador de la partida *"${game.name}"*, ya que el creador anterior se ha ido. Tú puedes iniciar el juego.`, { parse_mode: 'Markdown' });
                        } else {
                            responseToLeaver += '\n\n¡Atención! Eras el creador de la partida. La partida ha quedado sin creador y no podrá iniciarse.';
                        }
                    }
                } else if (game.state === 'IN_PROGRESS') {
                    player.updateLifeStatus(this.db, false);
                    responseToLeaver += `\n\nHas abandonado la partida en curso. Tu personaje ha sido eliminado del juego.`;
                    // Comprobar si la partida puede continuar sin el creador o si es el último en pie
                    if (remainingPlayers.filter(p => p.isAlive).length <= 1) {
                        game.updateState(this.db, 'ENDED');
                        console.log(`INFO: Partida ${game.name} (${game.id}) finalizada por abandono del creador.`);
                        for (const p of remainingPlayers) {
                            await this.botUtils.sendMessage(p.userId, `La partida *"${game.name}"* ha terminado debido a que quedan muy pocos jugadores vivos.`, { parse_mode: 'Markdown' });
                        }
                    }
                }
            } else if (game.state === 'IN_PROGRESS') {
                player.updateLifeStatus(this.db, false);
                responseToLeaver += `\n\nHas abandonado la partida en curso. Tu personaje ha sido eliminado del juego.`;
                // Comprobar si la partida puede continuar
                if (remainingPlayers.filter(p => p.isAlive).length <= 1) {
                    game.updateState(this.db, 'ENDED');
                    console.log(`INFO: Partida *${game.name}* (${game.id}) finalizada por abandono de jugador.`);
                    for (const p of remainingPlayers) {
                        await this.botUtils.sendMessage(p.userId, `La partida *"${game.name}"* ha terminado debido a que quedan muy pocos jugadores vivos.`, { parse_mode: 'Markdown' });
                    }
                }
            }

            await this.botUtils.editMessage(chatId, messageId, responseToLeaver, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '↩️ Volver al menú principal', callback_data: 'start_menu' }]
                    ]
                }
            });

            if (game.state === 'ENDED' || (game.creatorId !== userId && game.creatorId)) {
                // Notificar al nuevo creador o a todos si la partida terminó
            }

        } catch (error) {
            console.error('ERROR: Fallo al salir de la partida:', error);
            await this.botUtils.editMessage(chatId, messageId, '¡Ups! Hubo un error al intentar salir de la partida. Intenta de nuevo más tarde.');
        }
    }
}

module.exports = ManejadorSalaEspera;
