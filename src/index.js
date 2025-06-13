// src/index.js
console.log('DEBUG: Iniciando index.js...');

// 1. Cargar el módulo para manejar variables de entorno
require('dotenv').config();
console.log('DEBUG: dotenv cargado.');

// Importar las clases Game y Player y las funciones de DB
let Game, Player;
let initializeDb, getDb;
try {
    const models = require('./models');
    Game = models.Game;
    Player = models.Player;
    ({ initializeDb, getDb } = require('./data/database')); // Importamos ambas
    console.log('DEBUG: modules.js y database.js cargados correctamente. Clases Game y Player disponibles.');
} catch (error) {
    console.error('ERROR FATAL: No se pudo cargar módulos esenciales:', error.message);
    process.exit(1);
}

let db; // Declara db aquí para que sea accesible en todo el archivo después de inicializada
let userStates = {}; // Declara userStates aquí para que sea accesible

// 2. Importar la librería del bot de Telegram
let TelegramBot;
try {
    TelegramBot = require('node-telegram-bot-api');
    console.log('DEBUG: node-telegram-bot-api cargado.');
} catch (error) {
    console.error('ERROR FATAL: No se pudo cargar node-telegram-bot-api:', error.message);
    process.exit(1);
}

// 3. Obtener el token del bot desde las variables de entorno
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// 4. Verificar que el token esté definido
if (!TOKEN) {
    console.error('ERROR FATAL: El token del bot de Telegram no está definido. Asegúrate de configurar la variable de entorno TELEGRAM_BOT_TOKEN.');
    process.exit(1);
}
console.log('DEBUG: Token de Telegram cargado.');

// ** -- Función principal asíncrona para iniciar todo el bot -- **
async function main() {
    console.log('DEBUG: Ejecutando función main().');
    try {
        // Inicializa la base de datos y obtén la instancia
        db = initializeDb();
        console.log('DEBUG: Base de datos inicializada y accesible.');

        console.log('INFO: Bot de Luna Aullante iniciando...');
        const bot = new TelegramBot(TOKEN, { polling: true });
        console.log('DEBUG: Instancia del bot de Telegram creada.');

        // 6. Manejar el comando /start
        bot.onText(/\/start/, (msg) => {
            const chatId = msg.chat.id;
            const userName = msg.from.first_name || 'jugador';
            const welcomeMessage = `¡Hola, *${userName}*! 👋\n\n¡Bienvenido al juego del Lobo en Telegram!\n\nSoy el *Bot Luna Aullante*, tu guía en este misterio. ¿Estás listo para desenmascarar a los lobos o sembrar el terror en el pueblo?\n\nUsa los botones para empezar.`;
            const keyboard = {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🐺 Crear Partida', callback_data: 'create_game' }],
                        [{ text: '🔍 Unirse a Partida', callback_data: 'join_game' }],
                    ]
                }
            };
            bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown', ...keyboard });
            console.log(`INFO: Comando /start recibido de ${userName} (${chatId})`);
        });

        // 7. Manejar las acciones de los botones (callback_data)
        bot.on('callback_query', async (callbackQuery) => {
            const message = callbackQuery.message;
            const data = callbackQuery.data;
            const chatId = message.chat.id;
            const userName = callbackQuery.from.first_name || 'jugador';
            const userId = callbackQuery.from.id;

            console.log(`INFO: Callback Query recibido: ${data} de ${userName} (${chatId})`);
            bot.answerCallbackQuery(callbackQuery.id);

            switch (data) {
                case 'create_game':
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
                    // TODO: Implementar lógica para buscar partidas públicas.
                    bot.sendMessage(chatId, 'Buscando partidas públicas...(Esta función estará disponible pronto).');
                    break;
                case 'enter_code':
                    userStates[chatId] = 'EXPECTING_JOIN_CODE';
                    bot.sendMessage(chatId, 'Por favor, introduce el código de la partida a la que quieres unirte.');
                    break;
                case data.startsWith('start_game:'):
                    const gameIdToStart = data.split(':')[1];
                    // TODO: Implementar lógica para iniciar partida
                    // Para obtener la partida, usarías: const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameIdToStart);
                    bot.sendMessage(chatId, `Función para iniciar partida *${gameIdToStart}* en desarrollo.`, { parse_mode: 'Markdown' });
                    break;
                default:
                    bot.sendMessage(chatId, '¡Ups! Esa opción no la reconozco aún. Intenta de nuevo.');
                    break;
            }
        });

        // 9. Manejar mensajes de texto
        bot.on('message', async (msg) => {
            const chatId = msg.chat.id;
            const text = msg.text;
            const userName = msg.from.first_name || 'jugador';
            const userId = msg.from.id;

            if (text && text.startsWith('/')) {
                return; // Ignorar comandos, ya se manejan con bot.onText
            }

            console.log(`INFO: Mensaje de texto recibido de ${userName} (${chatId}): "${text}"`);

            if (userStates[chatId] === 'EXPECTING_GAME_NAME') {
                let gameName = text.trim();
                if (gameName.toLowerCase() === 'omitir') {
                    gameName = `Partida de ${userName}`;
                }

                try {
                    const newGame = new Game(userId, gameName);
                    newGame.save(db); // ¡Aquí se guarda la partida en la DB!
                    console.log(`DEBUG: Nueva partida creada y guardada: ${newGame.name}, Código: ${newGame.invitationCode}`);

                    // Añadir el creador como el primer jugador de la partida
                    const creatorPlayer = new Player(userId, newGame.id);
                    creatorPlayer.save(db); // Guardar el jugador creador
                    console.log(`DEBUG: Jugador creador (${userName}) añadido a la partida.`);

                    delete userStates[chatId];

                    const confirmationMessage = `¡Partida *"${newGame.name}"* creada con éxito! 🎉\n\n` +
                        `Código de invitación: \`${newGame.invitationCode}\`\n\n` +
                        `Invita a tus amigos y cuando estén listos, iniciaremos el juego.`;

                    const keyboard = {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '▶️ Iniciar Partida', callback_data: `start_game:${newGame.id}` }]
                            ]
                        }
                    };

                    bot.sendMessage(chatId, confirmationMessage, { parse_mode: 'Markdown', ...keyboard });
                    console.log(`INFO: Partida creada: ${newGame.name} (${newGame.id}) por ${userName}`);

                } catch (error) {
                    console.error('ERROR: Error al crear la partida:', error);
                    bot.sendMessage(chatId, '¡Uy! Hubo un problema al crear la partida. Inténtalo de nuevo.');
                }

            } else if (userStates[chatId] === 'EXPECTING_JOIN_CODE') {
                const joinCode = text.trim().toUpperCase();

                try {
                    const gameToJoin = Game.findByCode(db, joinCode); // Usar el método estático

                    if (gameToJoin) {
                        // Obtener los jugadores de la partida para verificar si ya está unido
                        const playersInGame = gameToJoin.getPlayers(db);
                        const playerExists = playersInGame.some(player => player.userId === userId);

                        if (playerExists) {
                            bot.sendMessage(chatId, '¡Ya estás en esta partida! 🤷‍♂️');
                        } else if (playersInGame.length >= gameToJoin.maxPlayers) {
                            bot.sendMessage(chatId, '¡Uy! La partida está llena. Busca otra o crea una nueva. 😬');
                        } else {
                            // Añadir el nuevo jugador a la partida
                            const newPlayer = gameToJoin.addPlayer(db, userId); // Añade el jugador y lo guarda

                            delete userStates[chatId];

                            const joinConfirmation = `¡Te has unido a la partida *"${gameToJoin.name}"*! 🎉\n\n` +
                                `Ahora hay ${playersInGame.length + 1} jugadores. Espera a que el creador inicie el juego.`; // +1 porque ya se añadió

                            bot.sendMessage(chatId, joinConfirmation, { parse_mode: 'Markdown' });

                            // Notificar al creador de la partida
                            if (gameToJoin.creatorId !== userId) {
                                bot.sendMessage(gameToJoin.creatorId, `¡${userName} se ha unido a tu partida *"${gameToJoin.name}"*! Ahora sois ${playersInGame.length + 1}.`, { parse_mode: 'Markdown' });
                            }
                            console.log(`INFO: ${userName} (${userId}) se unió a la partida ${gameToJoin.name} (${gameToJoin.id})`);
                        }

                    } else {
                        bot.sendMessage(chatId, 'El código de invitación no es válido o la partida ya no está en el lobby. Inténtalo de nuevo. 🤔');
                    }

                } catch (error) {
                    console.error('ERROR: Error al unirse a la partida:', error);
                    bot.sendMessage(chatId, '¡Uy! Hubo un problema al unirte a la partida. Inténtalo de nuevo.');
                }
            } else {
                bot.sendMessage(chatId, `No entendí "${text}". Usa /start para ver las opciones.`);
            }
        });

        // 8. Manejar cualquier error de polling
        bot.on('polling_error', (error) => {
            console.error('ERROR: Error de polling:', error.code, error.message);
        });

        console.log('INFO: Bot de Luna Aullante conectado y listo para recibir mensajes...');

    } catch (error) {
        console.error('ERROR FATAL: El bot no pudo iniciar:', error.message);
        process.exit(1);
    }
}

// Llama a la función principal para iniciar todo el proceso
main();
