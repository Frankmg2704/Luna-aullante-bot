// src/models.js
const { v4: uuidv4 } = require('uuid');
// Importa getDb, pero no la llamas aquí directamente para no inicializarla dos veces.
// La instancia se pasa cuando se necesitan hacer operaciones de DB.

/**
 * Clase que representa una partida del juego.
 */
class Game {
    constructor(creatorId, name = "Partida sin nombre") {
        this.id = uuidv4();
        this.name = name;
        this.creatorId = creatorId;
        this.state = "LOBBY";
        this.invitationCode = Math.random().toString(36).substr(2, 6).toUpperCase();
        this.maxPlayers = 12;
        this.minPlayers = 5;
    }

    // Método para guardar una nueva partida en la base de datos
    save(db) {
        db.prepare(`
            INSERT INTO games (id, name, creatorId, state, invitationCode, maxPlayers, minPlayers)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(this.id, this.name, this.creatorId, this.state, this.invitationCode, this.maxPlayers, this.minPlayers);
    }

    // Método estático para encontrar una partida por su código de invitación
    static findByCode(db, code) {
        const gameData = db.prepare(`SELECT * FROM games WHERE invitationCode = ?`).get(code);
        if (gameData) {
            // Recrear una instancia de Game a partir de los datos de la DB
            const game = new Game(gameData.creatorId, gameData.name);
            Object.assign(game, gameData); // Copiar el resto de las propiedades
            return game;
        }
        return null;
    }

    // Método para obtener los jugadores de una partida
    getPlayers(db) {
        const playersData = db.prepare(`SELECT * FROM players WHERE gameId = ?`).all(this.id);
        return playersData.map(p => {
            const player = new Player(p.userId, p.gameId);
            Object.assign(player, p);
            return player;
        });
    }

    // Método para añadir un jugador a la partida y guardarlo en la DB
    addPlayer(db, userId) {
        const newPlayer = new Player(userId, this.id);
        newPlayer.save(db); // Guardar el jugador en la DB
        return newPlayer;
    }

    // Método para actualizar el estado de la partida
    updateState(db, newState) {
        this.state = newState;
        db.prepare(`UPDATE games SET state = ? WHERE id = ?`).run(this.state, this.id);
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
        this.id = uuidv4(); // ID único del jugador en la base de datos
        this.userId = userId; // ID de usuario de Telegram
        this.gameId = gameId; // ID de la partida a la que está unido
        this.role = null; // Rol asignado (Aldeano, Lobo, Vidente, etc.)
        this.isAlive = true; // Estado de vida del jugador (1 para true, 0 para false en SQLite)
    }

    // Método para guardar un nuevo jugador en la base de datos
    save(db) {
        db.prepare(`
            INSERT INTO players (id, userId, gameId, role, isAlive)
            VALUES (?, ?, ?, ?, ?)
        `).run(this.id, this.userId, this.gameId, this.role, this.isAlive ? 1 : 0);
    }

    // Método para actualizar el estado de vida del jugador
    updateLifeStatus(db, isAlive) {
        this.isAlive = isAlive;
        db.prepare(`UPDATE players SET isAlive = ? WHERE id = ?`).run(this.isAlive ? 1 : 0, this.id);
    }
}

// Exporta las clases
module.exports = {
    Game,
    Player,
};
