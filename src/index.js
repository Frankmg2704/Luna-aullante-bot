
// 1. Cargar el módulo para manejar variables de entorno (si usas un archivo .env)
require('dotenv').config();
// 2. Importar la librería del bot de Telegram
const TelegramBot = require('node-telegram-bot-api');
// 3. Obtener el token del bot desde las variables de entorno
// ¡IMPORTANTE: Crea un archivo .env en la raíz de tu proyecto conuna línea como:
// TELEGRAM_BOT_TOKEN=TU_TOKEN_AQUI
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;// 4. Verificar que el token esté definido
let pendingActions = {}; // Almacenar acciones pendientes: { chatId: "create_game" }
if (!TOKEN) {
    console.error('Error: El token del bot de Telegram no está definido. Asegúrate de configurar la variable de entornoTELEGRAM_BOT_TOKEN.');
    process.exit(1); // Salir de la aplicación si no hay token
}
// 5. Crear una nueva instancia del bot
// El polling: true hace que el bot escuche los mensajes entrantes constantemente.
console.log('Bot de Luna Aullante iniciando...');
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
// 7. Manejar las acciones de los botones (callback_data)bot.on('callback_query', (callbackQuery) => {
bot.on('callback_query', (callbackQuery) => {
    const message = callbackQuery.message;
    const data = callbackQuery.data;
    const chatId = message.chat.id;
    const userName = callbackQuery.from.first_name || 'jugador';

    console.log(`Callback Query recibido: ${data} de ${userName} (${chatId})`);
    bot.answerCallbackQuery(callbackQuery.id);

    switch (data) {
        case 'create_game': pendingActions[chatId] = "create_game"; // Registrar acción pendiente
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
            const publicGames = Object.values(games).filter(game =>
                game.state === "LOBBY" && game.players.length < game.maxPlayers
            );

            if (publicGames.length === 0) {
                bot.sendMessage(chatId, "⚠️ No hay partidas públicas disponibles");
                break;
            }

            const buttons = publicGames.map(game => ([
                {
                    text: `${game.name} (${game.players.length}/${game.maxPlayers})`,
                    callback_data: `join_game:${game.id}`
                }
            ]));

            bot.sendMessage(chatId, "🎮 Partidas Públicas:", {
                reply_markup: { inline_keyboard: buttons }
            });
            break;

        case 'enter_code':
            pendingActions[chatId] = "Por favor, introduce el código de la partida a la que quieres unirte.";
            break;
        default:
            bot.sendMessage(chatId, '¡Ups! Esa opción no la reconozco aún. Intenta de nuevo.');
            break;
    }
});
// 8. Manejar cualquier error
bot.on('polling_error', (error) => {
    console.error('Error de polling:', error.code, error.message);
});
console.log('Bot de Luna Aullante conectado y listo para recibirmensajes...');
bot.on("message", (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    if (pendingActions[chatId] === "join_by_code") {
        const code = text.toUpperCase();
        const game = Object.values(games).find(g => g.invitationCode === code && g.state === "LOBBY");

        if (game) {
            const newPlayer = new Player(msg.from.id, game.id);
            players[newPlayer.id] = newPlayer;
            game.players.push(newPlayer.id);

            bot.sendMessage(chatId, `✅ Unido a la partida *"${game.name}"*!`, { parse_mode: "Markdown" });
        } else {
            bot.sendMessage(chatId, "❌ Código inválido o partida llena");
        }
        delete pendingActions[chatId];
    }

    if (pendingActions[chatId] === "create_game") {
        const gameName = text === "omitir" ? `Partida de ${msg.from.first_name}` : text;
        const creatorId = msg.from.id;

        // Crear nueva partida
        const newGame = new Game(creatorId, gameName);
        games[newGame.id] = newGame;

        // Mensaje de confirmación
        const keyboard = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "▶️ Iniciar Partida", callback_data: `start_game:${newGame.id}` }],
                    [{ text: "📤 Compartir Invitación", callback_data: `share_game:${newGame.id}` }],
                    [{ text: "❌ Cancelar Partida", callback_data: `cancel_game:${newGame.id}` }]
                ]
            }
        };

        bot.sendMessage(
            chatId,
            `✅ Partida *"${gameName}"* creada!\nCódigo de invitación: \`${newGame.invitationCode}\``,
            { parse_mode: "Markdown", ...keyboard }
        );

        delete pendingActions[chatId]; // Limpiar estado
    }
});

// Actualizar callback "create_game"

console.log('Bot de Luna Aullante conectado y listo para recibir mensajes...');
