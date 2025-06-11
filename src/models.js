// src/models.js
class Game {
    constructor(creatorId, name = "Partida sin nombre") {
        this.id = uuidv4(); // Usar el paquete uuid instalado
        this.name = name;
        this.creatorId = creatorId;
        this.state = "LOBBY"; // LOBBY, IN_PROGRESS, ENDED
        this.players = [];
        this.invitationCode = Math.random().toString(36).substr(2, 6).toUpperCase();
        this.maxPlayers = 12;
        this.minPlayers = 5;
    }
}

class Player {
    constructor(userId, gameId) {
        this.id = uuidv4();
        this.userId = userId;
        this.gameId = gameId;
        this.role = null;
        this.isAlive = true;
    }
}

// Almacenamiento en memoria (luego migrar a LowDB)
const games = {};
const players = {};
