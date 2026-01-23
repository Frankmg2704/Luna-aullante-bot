// src/logicaJuego/fases/manejadorFasesJuego.js

const { Game, Player } = require('../../models/models'); // Ruta relativa a models
// Importar los roles. Asegúrate de que las rutas sean correctas.
const Aldeano = require('../roles/aldeano');
const Lobo = require('../roles/lobo');
// Añade aquí otros roles cuando los crees:
// const Vidente = require('../roles/vidente');
// const Doctor = require('../roles/doctor');

class GamePhaseHandler {
    constructor(bot, db, botUtils) {
        this.bot = bot;
        this.db = db;
        this.botUtils = botUtils;
        this.rolesMap = { // Un mapa para obtener instancias de roles por su nombre
            'Aldeano': Aldeano,
            'Lobo': Lobo,
            // Agrega aquí otros roles cuando los implementes
        };
    }

    /**
     * Avanza la fase actual del juego (Día -> Noche -> Día...).
     * También maneja el conteo de votos y los resultados al final del día.
     * @param {string} gameId - El ID de la partida.
     */
    async advancePhase(gameId) {
        const game = Game.findById(this.db, gameId);
        if (!game) {
            console.error(`ERROR: No se encontró la partida con ID: ${gameId} para avanzar la fase.`);
            return;
        }

        let messageToPlayers = '';

        if (game.currentPhase === 'day') {
            // Lógica para el final del día: Conteo de votos y linchamiento
            const alivePlayers = game.getPlayers(this.db).filter(p => p.isAlive);

            if (Object.keys(game.voteCount).length > 0) {
                const voteResults = this.getVoteResults(game.voteCount);
                const lynchedPlayerId = voteResults.mostVotedPlayerId;
                const lynchedPlayerName = voteResults.mostVotedPlayerName;

                if (lynchedPlayerId) {
                    const lynchedPlayer = Player.findByUserIdAndGameId(this.db, lynchedPlayerId, game.id);
                    if (lynchedPlayer) {
                        lynchedPlayer.updateLifeStatus(this.db, false);
                        messageToPlayers = `☀️ El pueblo ha votado y ha decidido linchar a *${lynchedPlayerName}*.\n\n` +
                            `¡Lamentablemente, ${lynchedPlayerName} era un *${lynchedPlayer.role.name}*! 😵`;
                        console.log(`INFO: Jugador linchado: ${lynchedPlayerName} (${lynchedPlayer.role.name}) en partida ${game.name}.`);
                    } else {
                        messageToPlayers = `☀️ El pueblo ha votado, pero no se encontró al jugador linchado.`;
                    }
                } else {
                    messageToPlayers = '☀️ No se llegó a un consenso en la votación. ¡Nadie fue linchado esta vez!';
                }
            } else {
                messageToPlayers = '☀️ El día termina sin votos. ¡Nadie ha sido linchado!';
            }

            // Reiniciar votos para la próxima fase
            game.resetVotes(this.db);
            game.currentPhase = 'night';
            game.day++; // Avanzar al siguiente día/noche

        } else if (game.currentPhase === 'night') {
            // Lógica para el final de la noche: Acciones de los roles (ej. ataques de lobos)
            // Aquí puedes implementar la lógica para los lobos maten, el doctor cure, el vidente vea, etc.
            // Por ahora, solo implementaremos un ejemplo básico para los lobos.

            const wolves = game.getPlayers(this.db).filter(p => p.isAlive && p.role.name === 'Lobo');
            let killedPlayer = null;

            if (wolves.length > 0) {
                // Simplificado: si hay votos de lobos, elige el más votado.
                // En un juego real, los lobos tendrían un chat privado para coordinar.
                const wolfVotes = {};
                for (const player of game.getPlayers(this.db)) {
                    if (player.role.name === 'Lobo' && player.votesFor) {
                        wolfVotes[player.votesFor] = (wolfVotes[player.votesFor] || 0) + 1;
                    }
                }

                let targetPlayerId = null;
                let maxVotes = 0;
                for (const id in wolfVotes) {
                    if (wolfVotes[id] > maxVotes) {
                        maxVotes = wolfVotes[id];
                        targetPlayerId = id;
                    }
                }

                if (targetPlayerId) {
                    const targetPlayer = Player.findByUserIdAndGameId(this.db, targetPlayerId, game.id);
                    if (targetPlayer && targetPlayer.isAlive && targetPlayer.role.name !== 'Lobo') {
                        killedPlayer = targetPlayer;
                        killedPlayer.updateLifeStatus(this.db, false);
                        messageToPlayers += `🌑 Durante la noche, los lobos han devorado a *${killedPlayer.username}*! Lamentablemente, ${killedPlayer.username} era un *${killedPlayer.role.name}*! 💀`;
                        console.log(`INFO: Jugador ${killedPlayer.username} asesinado por lobos en partida ${game.name}.`);
                    } else {
                        messageToPlayers += '🌑 Los lobos intentaron atacar, pero su objetivo no era válido o ya estaba muerto.';
                    }
                } else {
                    messageToPlayers += '🌑 Los lobos no llegaron a un acuerdo o no atacaron esta noche.';
                }
            } else {
                messageToPlayers += '🌑 No hay lobos en el juego o no hay nadie a quien atacar. La noche pasa tranquilamente...';
            }

            // Reiniciar hasVoted para todos los jugadores para la siguiente fase de votación.
            game.resetVotes(this.db); // Asegura que `hasVoted` se resetee para todos.
            game.currentPhase = 'day'; // Vuelve al día
        }

        // Actualizar el estado de la partida
        game.save(this.db);

        // Notificar a todos los jugadores sobre el avance de la fase
        const allPlayers = game.getPlayers(this.db);
        for (const player of allPlayers) {
            await this.botUtils.sendMessage(player.userId, messageToPlayers, { parse_mode: 'Markdown' });
        }

        // Comprobar condiciones de victoria
        await this.checkWinCondition(gameId);

        // Si el juego no ha terminado, y es de día, enviar opciones de votación
        if (game.state === 'IN_PROGRESS' && game.currentPhase === 'day') {
            for (const player of allPlayers.filter(p => p.isAlive)) {
                await this.showDayVoteOptionsInternal(player.userId, gameId);
            }
        }
    }


    /**
     * Muestra las opciones de voto diurno a un jugador.
     * @param {object} callbackQuery - El objeto de la consulta de callback.
     */
    async showDayVoteOptions(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const userId = callbackQuery.from.id;
        const gameId = callbackQuery.data.split(':')[1];

        const game = Game.findById(this.db, gameId);
        const player = Player.findByUserIdAndGameId(this.db, userId, gameId);

        if (!game || !player || !player.isAlive || game.currentPhase !== 'day') {
            await this.botUtils.sendMessage(chatId, '🚫 No puedes votar ahora mismo.');
            return;
        }

        if (player.hasVoted) {
            await this.botUtils.editMessage(chatId, messageId, 'Ya has votado por hoy. Espera a que el día termine...', {
                reply_markup: { inline_keyboard: [[{ text: '🔄 Actualizar Estado', callback_data: `view_game_details:${game.id}` }]] }
            });
            return;
        }

        await this.showDayVoteOptionsInternal(userId, gameId, messageId);
    }

    /**
     * Lógica interna para mostrar opciones de voto, reutilizable.
     * @param {number} userId - ID del usuario.
     * @param {string} gameId - ID de la partida.
     * @param {number|null} messageId - ID del mensaje a editar (opcional).
     */
    async showDayVoteOptionsInternal(userId, gameId, messageId = null) {
        const game = Game.findById(this.db, gameId);
        const player = Player.findByUserIdAndGameId(this.db, userId, gameId);

        if (!game || !player || !player.isAlive || game.currentPhase !== 'day') {
            // No enviar o editar si el estado es inválido
            if (messageId) {
                await this.botUtils.editMessage(userId, messageId, 'Las opciones de votación no están disponibles ahora mismo.');
            } else {
                await this.botUtils.sendMessage(userId, 'Las opciones de votación no están disponibles ahora mismo.');
            }
            return;
        }

        const alivePlayers = game.getPlayers(this.db).filter(p => p.isAlive && p.userId !== userId); // No puedes votarte a ti mismo

        if (alivePlayers.length === 0) {
            const noVoteMessage = 'No hay otros jugadores vivos para votar. Espera al final del día.';
            if (messageId) {
                await this.botUtils.editMessage(userId, messageId, noVoteMessage, {
                    reply_markup: { inline_keyboard: [[{ text: '↩️ Volver a Detalles de Partida', callback_data: `view_game_details:${game.id}` }]] }
                });
            } else {
                await this.botUtils.sendMessage(userId, noVoteMessage);
            }
            return;
        }

        let voteKeyboard = alivePlayers.map(p => ([{ text: `🗳️ Votar por ${p.username}`, callback_data: `day_vote:${game.id}:${p.id}` }]));
        voteKeyboard.push([{ text: '↩️ Volver a Detalles de Partida', callback_data: `view_game_details:${game.id}` }]);

        const voteText = 'Es de día. ¡Es hora de debatir y votar por quién crees que es un lobo! ¿A quién quieres linchar?';

        if (messageId) {
            await this.botUtils.editMessage(userId, messageId, voteText, {
                reply_markup: { inline_keyboard: voteKeyboard }
            });
        } else {
            await this.botUtils.sendMessage(userId, voteText, {
                reply_markup: { inline_keyboard: voteKeyboard }
            });
        }
    }


    /**
     * Maneja el voto diurno de un jugador.
     * @param {object} callbackQuery - El objeto de la consulta de callback.
     */
    async handleDayVote(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const userId = callbackQuery.from.id;
        const [, gameId, targetPlayerId] = callbackQuery.data.split(':');

        const game = Game.findById(this.db, gameId);
        const player = Player.findByUserIdAndGameId(this.db, userId, gameId);
        const targetPlayer = Player.findByUserIdAndGameId(this.db, targetPlayerId, gameId);

        if (!game || !player || !player.isAlive || game.currentPhase !== 'day') {
            await this.botUtils.editMessage(chatId, messageId, '🚫 No puedes votar ahora mismo. Asegúrate de que es de día y estás vivo.', {
                reply_markup: { inline_keyboard: [[{ text: '↩️ Volver a Detalles de Partida', callback_data: `view_game_details:${gameId}` }]] }
            });
            return;
        }

        if (player.hasVoted) {
            await this.botUtils.editMessage(chatId, messageId, 'Ya has votado por hoy. Espera a que el día termine...', {
                reply_markup: { inline_keyboard: [[{ text: '↩️ Volver a Detalles de Partida', callback_data: `view_game_details:${gameId}` }]] }
            });
            return;
        }

        if (!targetPlayer || !targetPlayer.isAlive || targetPlayer.userId === userId) {
            await this.botUtils.editMessage(chatId, messageId, '🚫 Objetivo de voto inválido. Vota por un jugador vivo que no seas tú mismo.', {
                reply_markup: { inline_keyboard: [[{ text: '↩️ Reintentar Voto', callback_data: `show_day_vote_options:${gameId}` }]] }
            });
            return;
        }

        game.addVote(this.db, targetPlayerId, userId); // Añadir el voto
        player.updateVoteStatus(this.db, targetPlayerId, true); // Marcar como votado

        await this.botUtils.editMessage(chatId, messageId, `✅ Has votado por *${targetPlayer.username}*. Espera a que todos voten.`, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '🔄 Actualizar Estado', callback_data: `view_game_details:${gameId}` }]] }
        });

        // Informar a todos los jugadores que alguien ha votado (opcional, puede ser spammy)
        // for (const p of game.getPlayers(this.db)) {
        //     if (p.userId !== userId) {
        //         await this.botUtils.sendMessage(p.userId, `¡${player.username} ha emitido su voto!`);
        //     }
        // }

        console.log(`INFO: Jugador ${player.username} (${userId}) votó por ${targetPlayer.username} (${targetPlayerId}) en partida ${game.id}.`);

        // Comprobar si todos los jugadores vivos han votado
        const alivePlayers = game.getPlayers(this.db).filter(p => p.isAlive);
        const playersWhoVoted = alivePlayers.filter(p => p.hasVoted);

        if (playersWhoVoted.length === alivePlayers.length) {
            console.log(`INFO: Todos los jugadores han votado en partida ${game.id}. Avanzando fase...`);
            await this.advancePhase(gameId); // Avanza la fase si todos han votado
        }
    }


    /**
     * Maneja la acción de matar del lobo.
     * @param {object} callbackQuery - El objeto de la consulta de callback.
     */
    async handleWolfKill(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const userId = callbackQuery.from.id;
        const [, gameId, targetPlayerId] = callbackQuery.data.split(':');

        const game = Game.findById(this.db, gameId);
        const wolfPlayer = Player.findByUserIdAndGameId(this.db, userId, gameId);
        const targetPlayer = Player.findByUserIdAndGameId(this.db, targetPlayerId, gameId);

        if (!game || !wolfPlayer || wolfPlayer.role.name !== 'Lobo' || !wolfPlayer.isAlive || game.currentPhase !== 'night') {
            await this.botUtils.editMessage(chatId, messageId, '🚫 No puedes realizar esta acción ahora mismo.', {
                reply_markup: { inline_keyboard: [[{ text: '↩️ Volver a Detalles de Partida', callback_data: `view_game_details:${gameId}` }]] }
            });
            return;
        }

        if (wolfPlayer.hasVoted) {
            await this.botUtils.editMessage(chatId, messageId, 'Ya has realizado tu acción de lobo esta noche. Espera el amanecer...', {
                reply_markup: { inline_keyboard: [[{ text: '↩️ Volver a Detalles de Partida', callback_data: `view_game_details:${gameId}` }]] }
            });
            return;
        }

        if (!targetPlayer || !targetPlayer.isAlive || targetPlayer.role.name === 'Lobo') {
            await this.botUtils.editMessage(chatId, messageId, '🚫 Objetivo inválido para devorar. Debes elegir un aldeano vivo.', {
                reply_markup: { inline_keyboard: [[{ text: '↩️ Reintentar Acción', callback_data: `show_wolf_kill_options:${gameId}` }]] }
            });
            return;
        }

        // Aquí guardamos el "voto" del lobo por su objetivo.
        // En una implementación más robusta, los lobos discutirían y luego un líder o todos votarían.
        // Por ahora, simplemente el primer lobo que actúe, o el último voto, podría determinar la víctima.
        // O podríamos contar todos los votos de lobos si hay varios.
        // Para simplificar, marcaremos que el lobo ha actuado y quién fue su objetivo preferido.
        wolfPlayer.updateVoteStatus(this.db, targetPlayerId, true); // Usamos 'votesFor' para el objetivo y 'hasVoted' para marcar la acción.

        await this.botUtils.editMessage(chatId, messageId, `✅ Has elegido devorar a *${targetPlayer.username}*. Espera a que la noche termine.`, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '🔄 Actualizar Estado', callback_data: `view_game_details:${gameId}` }]] }
        });

        console.log(`INFO: Lobo ${wolfPlayer.username} (${userId}) eligió a ${targetPlayer.username} (${targetPlayerId}) para devorar en partida ${game.id}.`);

        // Comprobar si todos los lobos han votado/actuado
        const aliveWolves = game.getPlayers(this.db).filter(p => p.isAlive && p.role.name === 'Lobo');
        const wolvesWhoActed = aliveWolves.filter(p => p.hasVoted);

        if (wolvesWhoActed.length === aliveWolves.length) {
            console.log(`INFO: Todos los lobos han realizado su acción en partida ${game.id}. Avanzando fase...`);
            await this.advancePhase(gameId); // Avanza la fase si todos los lobos han actuado
        }
    }


    /**
     * Calcula los resultados de la votación del día.
     * @param {object} voteCounts - Objeto con los conteos de votos.
     * @returns {{mostVotedPlayerId: string|null, mostVotedPlayerName: string|null, isTie: boolean}}
     */
    getVoteResults(voteCounts) {
        let mostVotedPlayerId = null;
        let mostVotedPlayerName = null;
        let maxVotes = 0;
        let isTie = false;

        for (const playerId in voteCounts) {
            const votes = voteCounts[playerId].count;
            if (votes > maxVotes) {
                maxVotes = votes;
                mostVotedPlayerId = playerId;
                mostVotedPlayerName = voteCounts[playerId].username;
                isTie = false;
            } else if (votes === maxVotes && maxVotes > 0) {
                isTie = true; // Hay un empate
            }
        }
        return { mostVotedPlayerId, mostVotedPlayerName, isTie };
    }

    /**
     * Comprueba las condiciones de victoria del juego.
     * @param {string} gameId - El ID de la partida.
     */
    async checkWinCondition(gameId) {
        const game = Game.findById(this.db, gameId);
        if (!game || game.state !== 'IN_PROGRESS') {
            return; // Solo comprobamos si la partida está en curso
        }

        const alivePlayers = game.getPlayers(this.db).filter(p => p.isAlive);
        const aliveVillagers = alivePlayers.filter(p => p.role.name !== 'Lobo');
        const aliveWolves = alivePlayers.filter(p => p.role.name === 'Lobo');

        let winMessage = null;
        let winnerType = null;

        if (aliveWolves.length === 0) {
            winMessage = '🎉 ¡Felicidades, Aldeanos! Han eliminado a todos los Lobos. ¡El pueblo está a salvo! 🎉';
            winnerType = 'Aldeanos';
        } else if (aliveWolves.length >= aliveVillagers.length) {
            winMessage = '🐺 ¡Los Lobos han superado en número a los Aldeanos! ¡El pueblo ha sido devorado! 😈';
            winnerType = 'Lobos';
        } else if (alivePlayers.length === 0) { // Si todos mueren por alguna razón
            winMessage = '💀 ¡Nadie ha sobrevivido! Fin del juego sin vencedores.';
            winnerType = 'Ninguno';
        }

        if (winMessage) {
            game.updateState(this.db, 'ENDED'); // Marcar la partida como terminada
            game.save(this.db); // Guardar el estado
            console.log(`INFO: Partida ${game.name} (${game.id}) ha terminado. Ganador: ${winnerType}.`);

            for (const player of game.getPlayers(this.db)) {
                await this.botUtils.sendMessage(player.userId, winMessage, { parse_mode: 'Markdown' });
                // Enviar menú principal después del mensaje de victoria
                await this.botUtils.sendMainMenu(player.userId, null, '¿Quieres jugar de nuevo?');
            }
        } else {
            console.log(`INFO: Partida ${game.name} (${game.id}) continúa. Vivos: ${alivePlayers.length} (Aldeanos: ${aliveVillagers.length}, Lobos: ${aliveWolves.length}).`);
        }
    }
}

module.exports = GamePhaseHandler;
