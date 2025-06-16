// src/manejadores/inicioManejador.js

class StartHandler { // Clase en inglés
    constructor(botUtils) {
        this.botUtils = botUtils;
    }

    /**
     * Maneja el comando /start.
     * @param {object} msg - El objeto de mensaje de Telegram.
     */
    async handle(msg) { // Función en inglés
        const chatId = msg.chat.id;
        const userName = msg.from.first_name || msg.from.username;

        const welcomeText = `¡Hola, *${userName}*! 👋\n\n` +
            '¡Bienvenido al bot de *Luna Aullante*, tu juego de Hombres Lobo interactivo en Telegram! 🐺🌕\n\n' +
            'Soy tu anfitrión en este misterioso pueblo. Aquí, cada noche esconde un secreto y cada día una acusación. ' +
            '¿Podrás sobrevivir a la noche o desenmascarar a los lobos a tiempo?';

        await this.botUtils.sendMainMenu(chatId, null, welcomeText);
        console.log(`INFO: Comando /start manejado para ${userName} (${chatId}).`);
    }
}

module.exports = StartHandler; // Exporta la clase en inglés
