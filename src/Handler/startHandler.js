// src/manejadores/inicioManejador.js

const {Player, Game} = require("../models/models");

class StartHandler { // Clase en inglés
    constructor(botUtils, userStates, manejadorSalaEspera) {
        this.botUtils = botUtils;
        this.userStates = userStates;
        this.manejadorSalaEspera = manejadorSalaEspera;
    }

    /**
     * Maneja el comando /start.
     * @param {object} msg - El objeto de mensaje de Telegram.
     */
    async handle(msg) { // Función en inglés
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const userName = msg.from.first_name || msg.from.username;

        const currentMessageId = this.userStates[userId]?.currentMessageId || null;
        this.userStates[userId] = { currentMessageId: currentMessageId };

        const playerInGame = Player.findByUserId(this.botUtils.db, userId); // Asume que db está disponible via botUtils o se pasa
        if (playerInGame) {
            const game = Game.findById(this.botUtils.db, playerInGame.gameId);
            if (game && (game.state === 'LOBBY' || game.state === 'IN_PROGRESS')) {
                // Si está en una partida activa, redirigir al lobby o a los detalles de la partida
                const redirectText = `¡Bienvenido de nuevo, *${userName}*! Parece que ya estás en la partida *"${game.name}"*. Redirigiendo...`;
                // Guarda el messageId del mensaje enviado/editado
                const sentMessage = await this.botUtils.sendMainMenu(chatId, currentMessageId, redirectText);
                if (sentMessage && sentMessage.message_id) {
                    this.userStates[userId].currentMessageId = sentMessage.message_id;
                }
                await this.manejadorSalaEspera.sendLobbyMenu(chatId, game.id, userId, null); // Pasamos null messageId para que envíe nuevo
                return;
            }
        }


        const welcomeText = `¡Hola, *${userName}*! 👋\n\n` +
            '¡Bienvenido al bot de *Luna Aullante*, tu juego de Hombres Lobo interactivo en Telegram! 🐺🌕\n\n' +
            'Soy tu anfitrión en este misterioso pueblo. Aquí, cada noche esconde un secreto y cada día una acusación. ' +
            '¿Podrás sobrevivir a la noche o desenmascarar a los lobos a tiempo?';

        // Aquí es donde capturamos el message_id
        // Asumiendo que sendMainMenu ahora devuelve el objeto de mensaje enviado/editado
        const sentMessage = await this.botUtils.sendMainMenu(chatId, currentMessageId, welcomeText);

        // Guardar el message_id en el userStates para futuras ediciones
        if (sentMessage && sentMessage.message_id) {
            this.userStates[userId].currentMessageId = sentMessage.message_id;
            console.log(`INFO: Menú principal enviado/editado. messageId: ${this.userStates[userId].currentMessageId}`);
        } else {
            console.warn(`ADVERTENCIA: No se pudo obtener el message_id del menú principal para ${userId}.`);
        }
        console.log(`INFO: Comando /start manejado para ${userName} (${chatId}).`);

    }
}

module.exports = StartHandler;
