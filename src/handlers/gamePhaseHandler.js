const { Game, Player } = require('../models/models');

/**
 * GamePhaseHandler se encarga de la lógica de avance de fases del juego (noche, día, etc.).
 */
class GamePhaseHandler {
    constructor(bot, db, botUtils) {
        this.bot = bot;
        this.db = db;
        this.botUtils = botUtils;
    }

    /**
     * Avanza la fase actual de una partida y notifica a los jugadores.
     * @param {string} gameId - El ID de la partida a avanzar.
     * @returns {Promise<void>}
     */
    async advancePhase(gameId) {
        const game = Game.findById(this.db, gameId);
        if (!game) {
            console.error(`ERROR: No se encontró la partida con ID ${gameId} para avanzar de fase.`);
            return;
        }

        const players = game.getPlayers(this.db);
        let notificationMessage = '';

        switch (game.currentPhase) {
            case 'night':
                // --- Lógica de la Noche ---
                const wolfPlayers = players.filter(p => p.role === 'Lobo' && p.isAlive);
                let victimPlayer = null;

                // En V1 con un solo lobo o si todos los lobos votan por lo mismo (a futuro)
                // Por ahora, si un lobo votó, esa es la víctima.
                // Podríamos buscar el Player.votesFor del lobo que ha actuado.
                const actingWolf = wolfPlayers.find(w => w.hasVoted);
                if (actingWolf && actingWolf.votesFor) {
                    victimPlayer = players.find(p => p.id === actingWolf.votesFor);
                }

                if (victimPlayer && victimPlayer.isAlive) {
                    victimPlayer.updateLifeStatus(this.db, false); // La víctima muere
                    notificationMessage = `¡Ha amanecido! Lamentablemente, **${victimPlayer.username}** ha sido encontrado muerto. Era un **${victimPlayer.role}**.`;
                    console.log(`INFO: ${victimPlayer.username} (${victimPlayer.userId}) ha muerto en la partida ${game.id}.`);
                } else {
                    notificationMessage = '¡Ha amanecido! Parece que nadie ha muerto esta noche... ¿Los lobos se distrajeron o no llegaron a un acuerdo?';
                }

                // Resetear votos de todos los jugadores para la siguiente fase (diurna)
                players.forEach(p => p.resetVote(this.db));

                game.currentPhase = 'day';
                game.day++; // Avanza el día
                game.save(this.db); // Guarda el nuevo estado de la partida

                // Notificar a todos los jugadores sobre el resultado de la noche y el inicio del día
                for (const p of players) {
                    await this.botUtils.sendMessage(p.userId, notificationMessage, { parse_mode: 'Markdown' });
                    // Mensaje para iniciar la discusión y votación del día
                    if (p.isAlive) {
                        await this.botUtils.sendMessage(p.userId, 'Es de día. ¡Ahora es momento de discutir y decidir a quién linchar! 🗳️', {
                            reply_markup: { // Opciones para el día
                                inline_keyboard: [
                                    [{ text: '🗳️ Votar por un Sospechoso', callback_data: `show_day_vote_options:${game.id}` }],
                                    [{ text: '📋 Ver Estado de Partida', callback_data: `view_game_details:${game.id}` }]
                                ]
                            }
                        });
                    }
                }
                break;

            case 'day':
                // --- Lógica del Día (Votación Diurna) ---
                // TODO: Aquí iría la lógica para procesar los votos del día y el linchamiento.
                // Por ahora, solo avanzamos a la noche para completar el ciclo básico.

                const alivePlayers = players.filter(p => p.isAlive);
                const votedPlayers = alivePlayers.filter(p => p.hasVoted);

                if (votedPlayers.length < alivePlayers.length) {
                    // Si no todos han votado, podríamos enviar un recordatorio o esperar.
                    // Para V1, si el tiempo se agota o se decide avanzar manualmente.
                    console.log(`INFO: No todos han votado en la partida ${game.id}. ${votedPlayers.length}/${alivePlayers.length} han votado.`);
                    // Podrías decidir si forzar el avance de fase o esperar más.
                    // Por simplicidad, y para seguir el ciclo, asumiremos que avanzamos.
                }

                // TODO: Implementar el conteo de votos del día y determinar el linchado.
                // Por ahora, para la V1, el día simplemente termina y pasa a la noche.

                // Resetear votos para la siguiente fase (nocturna)
                players.forEach(p => p.resetVote(this.db));

                notificationMessage = `La tarde cae... es hora de dormir.`;
                game.currentPhase = 'night';
                game.save(this.db); // Guarda el nuevo estado

                // Notificar a todos que es de noche
                for (const p of players) {
                    await this.botUtils.sendMessage(p.userId, notificationMessage + '\n\nEs noche cerrada. Los lobos acechan... 🌑', {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '📋 Ver Estado de Partida', callback_data: `view_game_details:${game.id}` }]
                            ]
                        }
                    });
                    // Si el jugador es lobo y está vivo, darle la opción de matar.
                    if (p.isAlive && p.role === 'Lobo') {
                        const otherAlivePlayers = players.filter(ap => ap.isAlive && ap.userId !== p.userId && ap.role !== 'Lobo');
                        if (otherAlivePlayers.length > 0) {
                            await this.botUtils.sendMessage(p.userId, 'Lobo, ¿a quién devorarás esta noche? 🐺', {
                                reply_markup: {
                                    inline_keyboard: otherAlivePlayers.map(target => ([
                                        { text: `🔪 Matar a ${target.username}`, callback_data: `wolf_kill:${game.id}:${target.id}` }
                                    ]))
                                }
                            });
                        } else {
                            await this.botUtils.sendMessage(p.userId, 'No hay aldeanos para devorar esta noche. ¡Esperemos al amanecer!');
                        }
                    }
                }
                break;

            default:
                console.warn(`ADVERTENCIA: Fase desconocida o no manejada para avanzar: ${game.currentPhase}`);
                break;
        }
    }

    /**
     * Maneja la acción de matar de un lobo.
     * @param {object} callbackQuery - El objeto de la callback query de Telegram.
     */
    async handleWolfKill(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const userId = callbackQuery.from.id;
        const callbackData = callbackQuery.data;
        const [, gameIdWolf, targetPlayerId] = callbackData.split(':');

        await this.bot.answerCallbackQuery(callbackQuery.id);

        try {
            const game = Game.findById(this.db, gameIdWolf);
            const wolfPlayer = Player.findByUserIdAndGameId(this.db, userId, gameIdWolf);

            if (!game || !wolfPlayer || wolfPlayer.role !== 'Lobo' || !wolfPlayer.isAlive || game.currentPhase !== 'night') {
                await this.botUtils.sendMessage(chatId, '🚫 No puedes realizar esa acción ahora mismo o no eres un lobo activo.');
                return;
            }

            if (wolfPlayer.hasVoted) {
                await this.botUtils.sendMessage(chatId, '🚫 Ya has realizado tu acción de lobo esta noche. Espera el amanecer...');
                return;
            }

            const targetPlayer = Player.findById(this.db, targetPlayerId);
            // Asegúrate de que Player.findById exista y busque por el ID único del jugador (UUID)
            // Si tu Player.findById solo busca por userId y gameId, necesitarás uno nuevo o modificar el existente.
            // Asumo que el `targetPlayerId` es el `Player.id` (UUID) del objetivo.

            if (!targetPlayer || !targetPlayer.isAlive || targetPlayer.gameId !== game.id || targetPlayer.role === 'Lobo') {
                await this.botUtils.sendMessage(chatId, '🚫 Objetivo inválido o ya ha muerto.');
                return;
            }

            wolfPlayer.updateVote(this.db, targetPlayer.id, true);
            await this.botUtils.editMessage(chatId, messageId, `🔪 Has elegido devorar a **${targetPlayer.username}** esta noche. Espera el amanecer...`, { parse_mode: 'Markdown' });

            // En V1 con un solo lobo, su acción termina la noche.
            // Si hubiera múltiples lobos, aquí se esperaría a que todos voten.
            // Luego, una vez que todos los lobos hayan votado:
            const allWolvesVoted = game.getPlayers(this.db).filter(p => p.role === 'Lobo' && p.isAlive).every(p => p.hasVoted);

            if (allWolvesVoted) { // O si es un solo lobo, siempre será true aquí
                await this.advancePhase(game.id); // Llama al método que avanza la fase
            } else {
                console.log(`INFO: Aún esperando el voto de otros lobos en partida ${game.id}.`);
                // Aquí podrías enviar un mensaje a otros lobos si aún no han votado.
            }

        } catch (error) {
            console.error('ERROR: Fallo al procesar acción de lobo:', error);
            await this.botUtils.sendMessage(chatId, '¡Ups! Hubo un error al intentar realizar tu acción nocturna.');
        }
    }

    // TODO: Método para manejar la votación diurna (handleDayVote)
    // async handleDayVote(callbackQuery) { ... }
}

module.exports = GamePhaseHandler;
