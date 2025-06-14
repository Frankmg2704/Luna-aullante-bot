// src/handlers/callbackQueryHandler.js
class CallbackQueryHandler {
    constructor(bot, userStates, botUtils) {
        this.bot = bot;
        this.userStates = userStates;
        this.botUtils = botUtils;
    }

    async handle(callbackQuery) {
        const message = callbackQuery.message;
        const data = callbackQuery.data;
        const chatId = message.chat.id;
        const userName = callbackQuery.from.first_name || 'jugador';

        console.log(`INFO: Callback Query recibido: ${data} de ${userName} (${chatId})`);
        this.bot.answerCallbackQuery(callbackQuery.id); // Siempre responder para quitar el reloj de carga

        switch (data) {
            case 'create_game':
                this.userStates[chatId] = 'EXPECTING_GAME_NAME';
                this.botUtils.sendMessage(chatId, '¡Excelente! Vas a crear una nueva partida. ¿Cómo te gustaría llamarla? (Puedes escribir el nombre o enviar "omitir" para un nombre automático)');
                break;
            case 'join_game':
                this.botUtils.sendMessage(chatId, '¡Perfecto! ¿Cómo te gustaría unirte a una partida? Elige una opción:', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔎 Buscar Partida Pública', callback_data: 'search_public_game' }],
                            [{ text: '🔑 Introducir Código', callback_data: 'enter_code' }]
                        ]
                    }
                });
                break;
            case 'search_public_game':
                // TODO: Implementar lógica para buscar partidas públicas.
                this.botUtils.sendMessage(chatId, 'Buscando partidas públicas...(Esta función estará disponible pronto).');
                break;
            case 'enter_code':
                this.userStates[chatId] = 'EXPECTING_JOIN_CODE';
                this.botUtils.sendMessage(chatId, 'Por favor, introduce el código de la partida a la que quieres unirte.');
                break;
            default:
                // Si la data empieza con 'start_game:', la manejamos aquí directamente o la delegamos
                if (data.startsWith('start_game:')) {
                    const gameIdToStart = data.split(':')[1];
                    // TODO: Implementar lógica para iniciar partida
                    // Para obtener la partida, usarías: const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameIdToStart);
                    this.botUtils.sendMessage(chatId, `Función para iniciar partida *${gameIdToStart}* en desarrollo.`, { parse_mode: 'Markdown' });
                } else {
                    this.botUtils.sendMessage(chatId, '¡Ups! Esa opción no la reconozco aún. Intenta de nuevo.');
                }
                break;
        }
    }
}

module.exports = CallbackQueryHandler;
