// src/handlers/messageHandler.js

const { Game, Player } = require('../models/models'); // Asegúrate que la ruta sea correcta
const GameCreationHandler = require('./gameCreationHandler'); // Necesitarás este
const GameJoinHandler = require('./gameJoinHandler'); // Y este

class MessageHandler {
    constructor(db, userStates, botUtils) {
        this.db = db;
        this.userStates = userStates; // Aquí se guarda el estado del usuario
        this.botUtils = botUtils;
        this.gameCreationHandler = new GameCreationHandler(db, userStates, botUtils); // Instanciarlo aquí
        this.gameJoinHandler = new GameJoinHandler(db, userStates, botUtils); // Instanciarlo aquí
    }

    async handle(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const userText = msg.text;

        console.log(`DEBUG: Mensaje de texto recibido: "${userText}" de usuario ${userId}`);

        // Verificar el estado del usuario
        const userState = this.userStates[userId];

        if (userState && userState.state) {
            switch (userState.state) {
                case 'awaiting_game_name':
                    console.log(`INFO: Usuario ${userId} está creando una partida. Nombre recibido: "${userText}"`);
                    await this.gameCreationHandler.handle(msg); // Pasa el mensaje completo al handler
                    break;

                case 'awaiting_join_code':
                    console.log(`INFO: Usuario ${userId} está introduciendo código de unión. Código recibido: "${userText}"`);
                    await this.gameJoinHandler.handle(msg); // Pasa el mensaje completo al handler
                    break;

                default:
                    console.warn(`ADVERTENCIA: Estado de usuario desconocido para ${userId}: ${userState.state}.`);
                    await this.botUtils.sendMessage(chatId, 'No entendí lo que querías hacer con ese mensaje. Usa /start para ver las opciones principales.');
                    delete this.userStates[userId]; // Limpiar el estado inválido
                    break;
            }
        } else {
            // Si no hay estado definido para el usuario, o no es un comando conocido
            // Este es el mensaje que probablemente te está saliendo
            console.log(`INFO: Mensaje de texto sin estado de usuario definido: "${userText}" de ${userId}`);
            await this.botUtils.sendMessage(chatId, `No entendí "${userText}". Usa /start para ver más opciones.`);
        }
    }
}

module.exports = MessageHandler;
