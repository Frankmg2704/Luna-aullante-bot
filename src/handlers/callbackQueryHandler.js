// src/handlers/callbackQueryHandler.js

const { Game, Player } = require('../models/models');

class CallbackQueryHandler {
    constructor(bot, userStates, botUtils, db) {
        this.bot = bot;
        this.userStates = userStates;
        this.botUtils = botUtils;
        this.db = db;
    }

    async handle(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const userId = callbackQuery.from.id;
        const username = callbackQuery.from.username || callbackQuery.from.first_name || `Usuario_${userId}`;
        const callbackData = callbackQuery.data;

        await this.bot.answerCallbackQuery(callbackQuery.id); // Siempre responder a la callback query

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
                                // El texto del botón muestra los jugadores actuales
                                text: `${game.name} (${playerCount}/${game.maxPlayers} jugadores) ${isUserInGame ? '✅' : ''}`,
                                // La acción es unirse o ver detalles/salir si ya está dentro
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
                await this.botUtils.sendMainMenu(chatId, messageId, '¡Bienvenido de nuevo al menú principal!');
                break;

            // Parche para el callback antiguo que no debería existir
            case callbackData === 'join_game':
                console.warn('ADVERTENCIA: Recibido callback_data "join_game". Esto es un remanente del menú antiguo. Redirigiendo al menú principal.');
                await this.botUtils.sendMainMenu(chatId, messageId, 'Parece que hiciste clic en una opción antigua. Aquí tienes el menú principal actualizado.');
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
                            // Notificar a todos los jugadores que el juego ha comenzado
                            if (result.playerIds) {
                                for (const playerId of result.playerIds) {
                                    if (playerId !== userId) {
                                        await this.botUtils.sendMessage(playerId, `¡La partida *"${game.name}"* ha comenzado! La noche cae sobre la aldea...`, { parse_mode: 'Markdown' });
                                    }
                                }
                            }
                            // Opcional: Podrías limpiar el mensaje o enviar un nuevo estado del juego
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
                        let playersInGame = game.getPlayers(this.db); // Obtener antes de posible unión
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
                            // Obtener jugadores de nuevo para el conteo actualizado
                            playersInGame = game.getPlayers(this.db); // ¡Actualizar después de añadir!

                            await this.botUtils.editMessage(chatId, messageId, `✅ ¡Te has unido a la partida "${game.name}"!\n\nAhora hay ${playersInGame.length} jugadores. Esperando a más...`, {
                                reply_markup: {
                                    inline_keyboard: [
                                        [{ text: '🚪 Salir de esta partida', callback_data: `leave_game:${game.id}` }],
                                        [{ text: '↩️ Volver al menú principal', callback_data: 'start_menu' }]
                                    ]
                                }
                            });

                            // Notificar a otros jugadores: ¡Esta es la lógica para la notificación!
                            for (const p of playersInGame) {
                                if (p.userId !== userId) { // No notificar al que acaba de unirse
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

            // ... (caso 'leave_game' sin cambios, asumo que ya lo tienes correcto) ...

            // NUEVO CASO: Ver detalles de la partida (cuando el usuario ya está en ella)
            case callbackData.startsWith('view_game_details:'):
                const gameIdToView = callbackData.split(':')[1];
                try {
                    const game = Game.findById(this.db, gameIdToView);
                    const playersInGame = game.getPlayers(this.db);
                    const isCreator = game.creatorId === userId;
                    const creatorUsername = playersInGame.find(p => p.userId === game.creatorId)?.username || 'Desconocido';

                    let detailsText = `Detalles de la partida *"${game.name}"*:\n` +
                        `Código: \`${game.invitationCode}\`\n` +
                        `Creador: ${creatorUsername}\n` +
                        `Jugadores: ${playersInGame.length}/${game.maxPlayers}\n` +
                        `Estado: ${game.state === 'LOBBY' ? 'En espera' : game.state}\n\n`;

                    if (playersInGame.length > 0) {
                        detailsText += 'Jugadores actuales:\n';
                        playersInGame.forEach(player => {
                            detailsText += `- ${player.username} ${player.userId === game.creatorId ? '(Creador)' : ''}\n`;
                        });
                    }

                    const keyboard = [];
                    if (game.state === 'LOBBY') {
                        if (isCreator) {
                            keyboard.push([{ text: '▶️ Iniciar Partida', callback_data: `start_game:${game.id}` }]);
                        }
                        keyboard.push([{ text: '🚪 Salir de esta partida', callback_data: `leave_game:${game.id}` }]);
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

            default:
                await this.botUtils.editMessage(chatId, messageId, '¡Ups! Esa opción no la reconozco aún. Intenta de nuevo.');
                break;
        }
    }
}

module.exports = CallbackQueryHandler;
