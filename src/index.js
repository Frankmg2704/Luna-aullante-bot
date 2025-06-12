// src/index.js
console.log('DEBUG: Iniciando index.js...');

// 1. Cargar el módulo para manejar variables de entorno
require('dotenv').config();
console.log('DEBUG: dotenv cargado.');

// Importar las clases Game y Player
let Game, Player;
try {
    const models = require('./models');
    Game = models.Game;
    Player = models.Player;
    console.log('DEBUG: models.js cargado correctamente. Clases Game y Player disponibles.');
} catch (error) {
    console.error('ERROR FATAL: No se pudo cargar src/models.js:', error.message);
    process.exit(1);
}

// ** -- SECCIÓN CLAVE: AHORA USAMOS EL MÓDULO DE DB -- **
const { initializeDb, getDb } = require('./data/database'); // Importamos nuestras funciones de DB
let db; // Declara db aquí para que sea accesible en este archivo
let userStates = {}; // Declara userStates aquí para que sea accesible

// ** -- FIN SECCIÓN LOWDB -- **


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
console.log('DEBUG: Token de Telegram cargado (si existe).');


// ** -- Función principal asíncrona para iniciar todo el bot -- **
async function main() {
    console.log('DEBUG: Ejecutando función main().');
    try {
        await initializeDb(); // Llama a la función de inicialización de la base de datos
        db = getDb(); // Obtiene la instancia de la base de datos una vez inicializada
        console.log('DEBUG: index.js (main): db.data después de initializeDb y getDb:', JSON.stringify(db.data));

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
                    bot.sendMessage(chatId, 'Buscando partidas públicas...(Esta función estará disponible pronto).');
                    break;
                case 'enter_code':
                    userStates[chatId] = 'EXPECTING_JOIN_CODE';
                    bot.sendMessage(chatId, 'Por favor, introduce el código de la partida a la que quieres unirte.');
                    break;
                case data.startsWith('start_game:'):
                    const gameIdToStart = data.split(':')[1];
                    // TODO: Implementar lógica para iniciar partida
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
                return;
            }

            console.log(`INFO: Mensaje de texto recibido de ${userName} (${chatId}): "${text}"`);

            if (userStates[chatId] === 'EXPECTING_GAME_NAME') {
                let gameName = text.trim();
                if (gameName.toLowerCase() === 'omitir') {
                    gameName = `Partida de ${userName}`;
                }

                try {
                    const newGame = new Game(userId, gameName);
                    
                    // ¡Puntos de depuración clave antes de hacer push!
                    console.log('DEBUG: index.js (EXPECTING_GAME_NAME): Antes de push, db.data es:', JSON.stringify(db.data));
                    console.log('DEBUG: index.js (EXPECTING_GAME_NAME): Antes de push, db.data.games es:', JSON.stringify(db.data.games));

                    // Asegura que db.data.games es un array antes de hacer push (doble chequeo)
                    if (!db.data || !Array.isArray(db.data.games)) {
                        console.warn('WARN: db.data o db.data.games no es un array, inicializando para evitar TypeError.');
                        db.data = db.data || {}; // Asegura que db.data es un objeto
                        db.data.games = []; // Asegura que games es un array
                    }

                    db.data.games.push(newGame);
                    await db.write();

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
                    // ¡Puntos de depuración clave antes de acceder a db.data.games!
                    console.log('DEBUG: index.js (EXPECTING_JOIN_CODE): Antes de find, db.data es:', JSON.stringify(db.data));
                    console.log('DEBUG: index.js (EXPECTING_JOIN_CODE): Antes de find, db.data.games es:', JSON.stringify(db.data.games));

                    // Asegura que db.data.games es un array antes de intentar buscar en él
                    if (!db.data || !Array.isArray(db.data.games)) {
                        console.warn('WARN: db.data o db.data.games no es un array, evitando TypeError en la búsqueda.');
                        // Si no es un array, no podemos buscar, salimos o inicializamos para evitar el error
                        bot.sendMessage(chatId, '¡Uy! No se pudieron cargar las partidas. Intenta de nuevo más tarde.');
                        return; 
                    }

                    const gameToJoin = db.data.games.find(game => game.invitationCode === joinCode && game.state === 'LOBBY');

                    if (gameToJoin) {
                        const playerExists = gameToJoin.players.some(player => player.userId === userId);

                        if (playerExists) {
                            bot.sendMessage(chatId, '¡Ya estás en esta partida! 🤷‍♂️');
                        } else if (gameToJoin.players.length >= gameToJoin.maxPlayers) {
                            bot.sendMessage(chatId, '¡Uy! La partida está llena. Busca otra o crea una nueva. 😬');
                        } else {
                            const newPlayer = new Player(userId, gameToJoin.id);
                            gameToJoin.players.push(newPlayer);
                            
                            // db.data.players.push(newPlayer); // Comentado por si decides no usar el array global de players

                            await db.write();

                            delete userStates[chatId];

                            const joinConfirmation = `¡Te has unido a la partida *"${gameToJoin.name}"*! 🎉\n\n` +
                                                     `Ahora hay ${gameToJoin.players.length} jugadores. Espera a que el creador inicie el juego.`;
                            bot.sendMessage(chatId, joinConfirmation, { parse_mode: 'Markdown' });
                            
                            if (gameToJoin.creatorId !== userId) {
                                bot.sendMessage(gameToJoin.creatorId, `¡${userName} se ha unido a tu partida *"${gameToJoin.name}"*! Ahora sois ${gameToJoin.players.length}.`, { parse_mode: 'Markdown' });
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
