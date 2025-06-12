// src/index.js
// 1. Cargar el módulo para manejar variables de entorno (si usas un archivo .env)
require('dotenv').config();
// Asegúrate de  Game
const { Game, Player, games, players } = require('./models');
// 2. Importar la librería del bot de Telegram
const TelegramBot = require('node-telegram-bot-api');
const userStates = {}; // { chatId: 'EXPECTING_GAME_NAME' }

// 3. Obtener el token del bot desde las variables de entorno
// ¡IMPORTANTE: Crea un archivo .env en la raíz de tu proyecto con una línea como:
// TELEGRAM_BOT_TOKEN=TU_TOKEN_AQUI
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// 4. Verificar que el token esté definido
if (!TOKEN) {
    console.error('Error: El token del bot de Telegram no está definido. Asegúrate de configurar la variable de entorno TELEGRAM_BOT_TOKEN.');
    process.exit(1); // Salir de la aplicación si no hay token
}

// 5. Crear una nueva instancia del bot
// El polling: true hace que el bot escuche los mensajes entrantes constantemente.
console.log('Bot de Luna Aullante iniciando...');
const bot = new TelegramBot(TOKEN, { polling: true }); // <--- ¡AQUÍ ESTÁ EL CAMBIO CLAVE! Mueve esta línea aquí.

// 6. Manejar el comando /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userName = msg.from.first_name || 'jugador'; // Obtiene el nombre del usuario
    // Mensaje de bienvenida con Markdown para un toque más bonito
    const welcomeMessage = `¡Hola, *${userName}*! 👋\n\n¡Bienvenido al
juego del Lobo en Telegram!\n\nSoy el *Bot Luna Aullante*, tu guía en
este misterio. ¿Estás listo para desenmascarar a los lobos o sembrar
el terror en el pueblo?\n\nUsa los botones para empezar.`;
    // Opciones de botones para el menú principal
    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🐺 Crear Partida', callback_data:
                        'create_game' }],
                [{ text: '🔍 Unirse a Partida', callback_data:
                        'join_game' }],
// Futuros botones aquí, como 'Mis Partidas' o 'Ayuda'
// [{ text: '📚 Ayuda', callback_data: 'help' }]
            ]
        }
    };
    bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown',
        ...keyboard });
    console.log(`Comando /start recibido de ${userName} (${chatId})`);
});

// 7. Manejar las acciones de los botones (callback_data)
bot.on('callback_query', (callbackQuery) => {
    const message = callbackQuery.message;
    const data = callbackQuery.data;
    const chatId = message.chat.id;
    const userName = callbackQuery.from.first_name || 'jugador';

    console.log(`Callback Query recibido: ${data} de ${userName} (${chatId})`);
    bot.answerCallbackQuery(callbackQuery.id);

    switch (data) {
      case 'create_game':
        // Establecer el estado del usuario para esperar el nombre de la partida
        userStates[chatId] = 'EXPECTING_GAME_NAME';
        bot.sendMessage(chatId, '¡Excelente! Vas a crear una nueva partida. ¿Cómo te gustaría llamarla? (Puedes escribir el nombre o enviar "omitir" para un nombre automático)');
        break;
        case 'join_game':
            bot.sendMessage(chatId, '¡Perfecto! ¿Cómo te gustaría unirte a una partida? Elige una opción:', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔎 Buscar Partida Pública', callback_data: 'search_public_game' }],
                        [{ text: '🔑 Introducir Código', callback_data: 'enter_code' }]
                    ]
                }
            });
            break;
        case 'search_public_game':
            bot.sendMessage(chatId, 'Buscando partidas públicas...(Esta función estará disponible pronto).');
            break;
        case 'enter_code':
            bot.sendMessage(chatId, 'Por favor, introduce el código de la partida a la que quieres unirte.');
            break;
        default:
            bot.sendMessage(chatId, '¡Ups! Esa opción no la reconozco aún. Intenta de nuevo.');
            break;
    }
});
// src/index.js
// 9. Manejar mensajes de texto
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const userName = msg.from.first_name || 'jugador';

    // Ignorar comandos (ya los maneja onText) y callback queries
    if (text && text.startsWith('/')) {
        return;
    }

    console.log(`Mensaje de texto recibido de ${userName} (${chatId}): "${text}"`);

    // Lógica basada en el estado del usuario
    if (userStates[chatId] === 'EXPECTING_GAME_NAME') {
        let gameName = text.trim();
        if (gameName.toLowerCase() === 'omitir') {
            gameName = `Partida de ${userName}`; // Nombre automático si se omite
        }

        try {
            // Crear una nueva instancia de Game
            const newGame = new Game(chatId, gameName);
            games[newGame.id] = newGame; // Almacenar en nuestra memoria global

            // Limpiar el estado del usuario
            delete userStates[chatId];

            const confirmationMessage = `¡Partida *"${newGame.name}"* creada con éxito! 🎉\n\n` +
                                        `Código de invitación: \`${newGame.invitationCode}\`\n\n` +
                                        `Invita a tus amigos y cuando estén listos, iniciaremos el juego.`;

            bot.sendMessage(chatId, confirmationMessage, { parse_mode: 'Markdown' });
            console.log(`Partida creada: ${newGame.name} (${newGame.id}) por ${userName}`);

        } catch (error) {
            console.error('Error al crear la partida:', error);
            bot.sendMessage(chatId, '¡Uy! Hubo un problema al crear la partida. Inténtalo de nuevo.');
        }

    } else {
        // Si el bot no espera una respuesta específica, puede responder con algo genérico
        // O simplemente no responder si solo quieres que actúe bajo comandos y botones
        bot.sendMessage(chatId, `No entendí "${text}". Usa /start para ver las opciones.`);
    }
});

// 8. Manejar cualquier error
bot.on('polling_error', (error) => {
    console.error('Error de polling:', error.code, error.message);
});
console.log('Bot de Luna Aullante conectado y listo para recibir mensajes...');
