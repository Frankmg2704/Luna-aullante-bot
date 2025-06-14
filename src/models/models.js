const { v4: uuidv4 } = require('uuid');

/**
 * Clase que representa una partida del juego.
 */
class Game {
    /**
     * @param {number} creatorId - El ID de usuario de Telegram del creador de la partida.
     * @param {string} name - El nombre de la partida.
     */
    constructor(creatorId, name = "Partida sin nombre") {
        this.id = uuidv4();
        this.name = name;
        this.creatorId = creatorId;
        this.state = "LOBBY"; // Estados: LOBBY, IN_PROGRESS, ENDED
        // Genera un código de invitación de 6 caracteres alfanuméricos en mayúsculas
        this.invitationCode = Math.random().toString(36).substr(2, 6).toUpperCase();
        this.maxPlayers = 12; // Requisito
        this.minPlayers = 5;  // Requisito
    }

    /**
     * Guarda una nueva partida en la base de datos.
     * @param {object} db - La instancia de la base de datos.
     */
    save(db) {
        db.prepare(`
            INSERT INTO games (id, name, creatorId, state, invitationCode, maxPlayers, minPlayers)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(this.id, this.name, this.creatorId, this.state, this.invitationCode, this.maxPlayers, this.minPlayers);
    }

    /**
     * Busca una partida por su código de invitación en estado LOBBY.
     * @param {object} db - La instancia de la base de datos.
     * @param {string} code - El código de invitación de la partida.
     * @returns {Game|null} La instancia de la partida si se encuentra, de lo contrario null.
     */
    static findByCode(db, code) {
        // Asegúrate de que solo se busquen partidas en estado LOBBY para unirse.
        const stmt = db.prepare('SELECT * FROM games WHERE invitationCode = ? AND state = ?');
        const gameData = stmt.get(code, 'LOBBY');
        if (!gameData) return null;

        const game = new Game(gameData.creatorId, gameData.name);
        // Copiar todas las propiedades del objeto gameData a la instancia de Game
        // Esto es importante para cargar el 'id' existente y otros datos.
        Object.assign(game, gameData);
        return game;
    }

    /**
     * Busca una partida por su ID.
     * @param {object} db - La instancia de la base de datos.
     * @param {string} id - El ID de la partida.
     * @returns {Game|null} La instancia de la partida si se encuentra, de lo contrario null.
     */
    static findById(db, id) {
        const stmt = db.prepare('SELECT * FROM games WHERE id = ?');
        const gameData = stmt.get(id);
        if (!gameData) return null;

        const game = new Game(gameData.creatorId, gameData.name);
        Object.assign(game, gameData);
        return game;
    }

    /**
     * Obtiene todos los jugadores de esta partida.
     * @param {object} db - La instancia de la base de datos.
     * @returns {Player[]} Un array de instancias de Player.
     */
    getPlayers(db) {
        // Usa el método estático de Player para encontrar jugadores por gameId
        return Player.findByGameId(db, this.id);
    }

    /**
     * Añade un jugador a la partida y lo guarda en la base de datos.
     * @param {object} db - La instancia de la base de datos.
     * @param {number} userId - El ID de usuario de Telegram del jugador.
     * @returns {Player} La instancia del nuevo jugador añadido.
     */
    addPlayer(db, userId) {
        const newPlayer = new Player(userId, this.id);
        newPlayer.save(db); // Guardar el jugador en la DB
        return newPlayer;
    }

    /**
     * Actualiza el estado de la partida en la base de datos.
     * @param {object} db - La instancia de la base de datos.
     * @param {string} newState - El nuevo estado de la partida (e.g., 'IN_PROGRESS', 'ENDED').
     */
    updateState(db, newState) {
        this.state = newState;
        db.prepare(`UPDATE games SET state = ? WHERE id = ?`).run(this.state, this.id);
    }

    /**
     * Busca partidas en estado LOBBY junto con el conteo actual de jugadores.
     * @param {object} db - La instancia de la base de datos.
     * @returns {Array<object>} Un array de objetos con id, name, maxPlayers y currentPlayers.
     */
    static findLobbyGames(db) {
        const stmt = db.prepare(`
            SELECT g.id, g.name, g.maxPlayers, COUNT(p.userId) as currentPlayers
            FROM games g
            LEFT JOIN players p ON g.id = p.gameId
            WHERE g.state = 'LOBBY'
            GROUP BY g.id
            HAVING COUNT(p.userId) < g.maxPlayers
        `);
        return stmt.all();
    }

    /**
     * Inicia la partida, cambia su estado y notifica a los jugadores.
     * @param {object} db - La instancia de la base de datos.
     * @returns {object} Un objeto con { success: boolean, message: string, playerIds?: number[] }.
     */
    startGame(db) {
        const players = this.getPlayers(db);
        if (players.length < this.minPlayers) {
            return { success: false, message: `Se necesitan al menos ${this.minPlayers} jugadores para empezar. Actualmente hay ${players.length}.` };
        }

        try {
            // TODO: Implementar la asignación de roles aquí. (¡Tu próximo gran paso, Franky!)
            this.updateState(db, 'IN_PROGRESS'); // Usa el nuevo método updateState
            console.log(`INFO: Partida ${this.name} (${this.id}) ha iniciado.`);

            const playerIds = players.map(p => p.userId);
            return { success: true, message: '¡La partida ha comenzado! La noche cae sobre la aldea...', playerIds };
        } catch (error) {
            console.error(`ERROR: No se pudo iniciar la partida ${this.id}:`, error);
            return { success: false, message: 'Ocurrió un error al intentar iniciar la partida.' };
        }
    }
}

/**
 * Clase que representa a un jugador en una partida.
 */
class Player {
    /**
     * @param {number} userId - El ID de usuario de Telegram del jugador.
     * @param {string} gameId - El ID de la partida a la que pertenece este jugador.
     */
    constructor(userId, gameId) {
        this.id = uuidv4(); // ID único del jugador en la base de datos (PRIMARY KEY)
        this.userId = userId; // ID de usuario de Telegram
        this.gameId = gameId; // ID de la partida a la que está unido
        this.role = null; // Rol asignado (Aldeano, Lobo, Vidente, etc.)
        this.isAlive = true; // Estado de vida del jugador (true para vivo, false para muerto)
    }

    /**
     * Guarda un nuevo jugador en la base de datos.
     * @param {object} db - La instancia de la base de datos.
     */
    save(db) {
        db.prepare(`
            INSERT INTO players (id, userId, gameId, role, isAlive)
            VALUES (?, ?, ?, ?, ?)
        `).run(this.id, this.userId, this.gameId, this.role, this.isAlive ? 1 : 0);
    }

    /**
     * Busca jugadores por ID de partida.
     * @param {object} db - La instancia de la base de datos.
     * @param {string} gameId - El ID de la partida.
     * @returns {Player[]} Un array de instancias de Player.
     */
    static findByGameId(db, gameId) {
        const stmt = db.prepare('SELECT * FROM players WHERE gameId = ?');
        return stmt.all(gameId).map(p => {
            const player = new Player(p.userId, p.gameId);
            // Asegúrate de copiar el 'id' de la base de datos y otros atributos
            Object.assign(player, p);
            player.isAlive = p.isAlive === 1; // Convertir 0/1 de SQLite a booleano
            return player;
        });
    }

    /**
     * Actualiza el estado de vida del jugador en la base de datos.
     * @param {object} db - La instancia de la base de datos.
     * @param {boolean} isAlive - El nuevo estado de vida (true para vivo, false para muerto).
     */
    updateLifeStatus(db, isAlive) {
        this.isAlive = isAlive;
        db.prepare(`UPDATE players SET isAlive = ? WHERE id = ?`).run(this.isAlive ? 1 : 0, this.id);
    }
}

// Exporta las clases para que puedan ser usadas en otras partes del bot.
module.exports = {
    Game,
    Player,
};
