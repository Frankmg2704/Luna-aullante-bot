// src/models.js
// Importa uuid para generar IDs únicos
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
        this.id = uuidv4(); // ID único de la partida
        this.name = name;
        this.creatorId = creatorId; // ID del usuario de Telegram que creó la partida
        this.state = "LOBBY"; // Estados posibles: "LOBBY", "IN_PROGRESS", "ENDED"
        this.players = []; // Array de IDs de jugadores unidos a esta partida (se llenará con objetos Player)
        this.invitationCode = Math.random().toString(36).substr(2, 6).toUpperCase(); // Código corto para unirse
        this.maxPlayers = 12; // Número máximo de jugadores
        this.minPlayers = 5; // Número mínimo de jugadores para empezar
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
        this.isAlive = true; // Estado de vida del jugador
    }
}

// Exporta las clases
module.exports = {
    Game,
    Player,
};
