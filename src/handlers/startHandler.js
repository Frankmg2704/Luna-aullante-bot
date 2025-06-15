// src/handlers/startHandler.js

class StartHandler {
    constructor(botUtils) {
        this.botUtils = botUtils;
    }

    async handle(msg) {
        const chatId = msg.chat.id;
        const userName = msg.from.first_name || msg.from.username || 'invitado'; // Nombre de usuario

        const welcomeMessage = `¡Hola, *${userName}*! 👋\n\n` +
            '¡Bienvenido al\n' +
            'juego del Lobo en Telegram v0.9!\n' +
            '\n' +
            'Soy el Bot Luna Aullante, tu guía en\n' +
            'este misterio. ¿Estás listo para desenmascarar a los lobos o sembrar\n' +
            'el terror en el pueblo?\n' ;

        // Llama a sendMainMenu sin messageId para enviar un mensaje nuevo o con msg.message_id
        // para editar el mensaje del /start si ya existía.
        // Lo más común para /start es enviar un mensaje nuevo, a menos que quieras editar
        // el propio mensaje del comando /start que el usuario envió.
        // Para simplicidad y claridad, lo enviaremos como un mensaje nuevo.
        await this.botUtils.sendMainMenu(chatId, null, welcomeMessage);
        console.log(`INFO: Comando /start recibido de ${userName} (${chatId}).`);
    }
}

module.exports = StartHandler;
