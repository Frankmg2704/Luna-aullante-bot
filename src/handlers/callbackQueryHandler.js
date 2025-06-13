// src/handlers/callbackQueryHandler.js
const { Game, Player } = require('../models/models');

class CallbackQueryHandler {
    constructor(bot, userStates, botUtils, db) { // <-- Añadido db
        this.bot = bot;
        this.userStates = userStates;
        this.botUtils = botUtils;
        this.db = db; // <-- Añadido db
    }

    async handle(callbackQuery) {
        const message = callbackQuery.message;
        const data = callbackQuery.data;
        const chatId = message.chat.id;
        const userId = callbackQuery.from.id;
        const userName = callbackQuery.from.first_name || 'jugador';

        console.log(`INFO: Callback Query recibido: ${data} de ${userName} (${chatId})`);
        this.bot.answerCallbackQuery(callbackQuery.id);

        try {
            // Flujo para unirse a una partida desde la lista de partidas públicas
            if (data.startsWith('join_game_id:')) {
                const gameIdToJoin = data.split(':')[1];
                const gameToJoin = Game.findById(this.db, gameIdToJoin);

                if (gameToJoin && gameToJoin.state === 'LOBBY') {
                    const playersInGame = gameToJoin.getPlayers(this.db);
                    const playerExists = playersInGame.some(p => p.userId === userId);

                    if (playerExists) {
                        this.botUtils.sendMessage(chatId, '¡Ya estás en esta partida! 🤷‍♂️');
                    } else if (playersInGame.length >= gameToJoin.maxPlayers) {
                        this.botUtils.sendMessage(chatId, '¡Uy! La partida está llena. 😬');
                    } else {
                        gameToJoin.addPlayer(this.db, userId);
                        const newPlayerCount = playersInGame.length + 1;
                        this.botUtils.sendMessage(chatId, `¡Te has unido a la partida *"${gameToJoin.name}"*! 🎉`, { parse_mode: 'Markdown' });
                        if (gameToJoin.creatorId !== userId) {
                            this.botUtils.sendMessage(gameToJoin.creatorId, `¡*${userName}* se ha unido a tu partida! Ahora sois ${newPlayerCount}.`, { parse_mode: 'Markdown' });
                        }
                    }
                } else {
                    this.botUtils.sendMessage(chatId, 'Esta partida ya no está disponible o ha comenzado.');
                }
                return;
            }

            // Flujo para iniciar una partida
            if (data.startsWith('start_game:')) {
                const gameIdToStart = data.split(':')[1];
                const game = Game.findById(this.db, gameIdToStart);

                if (game && game.creatorId === userId) {
                    const result = game.startGame(this.db);
                    if (result.success) {
                        // Notificar al creador
                        this.botUtils.sendMessage(chatId, result.message);
                        // Notificar a todos los demás jugadores
                        result.playerIds.forEach(playerId => {
                            if (playerId !== userId) {
                                this.botUtils.sendMessage(playerId, `¡*${game.name}* ha comenzado!`, { parse_mode: 'Markdown' });
                            }
                        });
                        // Eliminar el botón de "Iniciar Partida" editando el mensaje original
                        this.bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
                            chat_id: message.chat.id,
                            message_id: message.message_id
                        });
                        
                    } else {
                        this.botUtils.sendMessage(chatId, result.message);
                    }
                } else {
                    this.botUtils.sendMessage(chatId, 'No puedes iniciar una partida que no creaste o que no existe.');
                }
                return;
            }

            // Switch para los botones del menú principal
            switch (data) {
                case 'create_game':
                    this.userStates[chatId] = 'EXPECTING_GAME_NAME';
                    this.botUtils.sendMessage(chatId, '¡Excelente! ¿Cómo quieres llamar a la partida? (Escribe el nombre o envía "omitir" para uno automático)');
                    break;
                case 'join_game':
                    this.botUtils.sendMessage(chatId, 'Elige una opción para unirte:', {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🔎 Buscar Partida Pública', callback_data: 'search_public_game' }],
                                [{ text: '🔑 Introducir Código', callback_data: 'enter_code' }]
                            ]
                        }
                    });
                    break;
                case 'search_public_game':
                    const publicGames = Game.findLobbyGames(this.db);
                    if (publicGames.length > 0) {
                        const keyboard = publicGames.map(game => ([
                            {
                                text: `🐺 ${game.name} (${game.currentPlayers}/${game.maxPlayers})`,
                                callback_data: `join_game_id:${game.id}`
                            }
                        ]));

                        this.botUtils.sendMessage(chatId, 'Estas son las partidas disponibles. ¡Únete a una!', {
                            reply_markup: { inline_keyboard: keyboard }
                        });
                    } else {
                        this.botUtils.sendMessage(chatId, 'No hay partidas públicas disponibles en este momento. ¡Anímate y crea una!');
                    }
                    break;
                case 'enter_code':
                    this.userStates[chatId] = 'EXPECTING_JOIN_CODE';
                    this.botUtils.sendMessage(chatId, 'Por favor, introduce el código de la partida.');
                    break;
                default:
                    this.botUtils.sendMessage(chatId, '¡Ups! Opción no reconocida.');
                    break;
            }
        } catch (error) {
            console.error('ERROR en CallbackQueryHandler:', error);
            this.botUtils.sendMessage(chatId, '¡Uy! Algo salió mal. Por favor, intenta de nuevo.');
        }
    }
}

module.exports = CallbackQueryHandler;

