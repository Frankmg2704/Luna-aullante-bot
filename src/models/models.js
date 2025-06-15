// src/models/models.js

const { v4: uuidv4 } = require('uuid');
const Aldeano = require('../roles/aldeano'); // ¡IMPORTAR LA NUEVA CLASE!
const Lobo = require('../roles/lobo');     // ¡IMPORTAR LA NUEVA CLASE!

/**
 * Clase que representa una partida del juego.
 */
class Game {
    /**
     * Constructor para una nueva partida.
     * Puede usarse para crear una nueva partida o para reconstruir una desde la DB.
     * @param {string} id - El ID único de la partida (UUID).
     * @param {string} name - El nombre de la partida.
     * @param {number} creatorId - El ID de usuario de Telegram del creador.
     * @param {string} invitationCode - El código de invitación único.
     * @param {string} [state="LOBBY"] - Estado actual de la partida (LOBBY, IN_PROGRESS, ENDED).
     * @param {number} [maxPlayers=12] - Número máximo de jugadores permitidos.
     * @param {number} [minPlayers=5] - Número mínimo de jugadores para iniciar.
     * @param {string} [currentPhase="day"] - Fase actual del juego (day, night, voting, etc.).
     * @param {number} [rolesAssigned=0] - 0 si los roles no han sido asignados, 1 si sí.
     * @param {string} [voteCountString="{}"] - Cadena JSON para el objeto de conteo de votos.
     * @param {number} [day=0] - Día actual del juego.
     * @param {number} [lastActivity=Date.now()] - Timestamp de la última actividad en la partida.
     */
    constructor(id, name, creatorId, invitationCode, state = "LOBBY", maxPlayers = 12, minPlayers = 5, currentPhase = 'day', rolesAssigned = 0, voteCountString = '{}', day = 0, lastActivity = Date.now()) {
        this.id = id || uuidv4();
        this.name = name;
        this.creatorId = creatorId;
        this.state = state;
        this.invitationCode = invitationCode || Math.random().toString(36).substr(2, 6).toUpperCase();
        this.maxPlayers = maxPlayers;
        this.minPlayers = minPlayers;
        this.currentPhase = currentPhase;
        this.rolesAssigned = rolesAssigned === 1; // Convertir de 0/1 a booleano
        this.voteCount = JSON.parse(voteCountString || '{}'); // Convertir de string JSON a objeto
        this.day = day;
        this.lastActivity = lastActivity;
    }

    /**
     * Guarda la instancia de la partida en la base de datos (INSERT o UPDATE si existe).
     * @param {object} db - La instancia de la base de datos.
     */
    save(db) {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO games (id, name, creatorId, state, invitationCode, maxPlayers, minPlayers, currentPhase, rolesAssigned, voteCount, day, lastActivity)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const voteCountJson = JSON.stringify(this.voteCount);

        stmt.run(
            this.id,
            this.name,
            this.creatorId,
            this.state,
            this.invitationCode,
            this.maxPlayers,
            this.minPlayers,
            this.currentPhase,
            this.rolesAssigned ? 1 : 0, // Booleano a INTEGER para DB
            voteCountJson,
            this.day,
            this.lastActivity
        );
        console.log(`INFO: Partida "${this.name}" (${this.id}) guardada/actualizada.`);
    }

    /**
     * Busca una partida por su ID y la reconstruye.
     * @param {object} db - La instancia de la base de datos.
     * @returns {Game|null} La instancia de la partida o null si no se encuentra.
     */
    static findById(db, id) {
        const stmt = db.prepare('SELECT * FROM games WHERE id = ?');
        const data = stmt.get(id);
        if (data) {
            return new Game(
                data.id, data.name, data.creatorId, data.invitationCode,
                data.state, data.maxPlayers, data.minPlayers,
                data.currentPhase, data.rolesAssigned, data.voteCount, data.day, data.lastActivity
            );
        }
        return null;
    }

    /**
     * Busca una partida por su código de invitación.
     * @param {object} db - La instancia de la base de datos.
     * @param {string} invitationCode - El código de invitación.
     * @returns {Game|null} La instancia de la partida o null si no se encuentra.
     */
    static findByInvitationCode(db, invitationCode) {
        const stmt = db.prepare('SELECT * FROM games WHERE invitationCode = ?');
        const data = stmt.get(invitationCode);
        if (data) {
            return new Game(
                data.id, data.name, data.creatorId, data.invitationCode,
                data.state, data.maxPlayers, data.minPlayers,
                data.currentPhase, data.rolesAssigned, data.voteCount, data.day, data.lastActivity
            );
        }
        return null;
    }

    /**
     * Recupera todas las partidas en estado LOBBY que no están llenas.
     * @param {object} db - La instancia de la base de datos.
     * @returns {Array<Game>} Lista de objetos Game en estado LOBBY y disponibles para unirse.
     */
    static getLobbyGames(db) {
        const stmt = db.prepare(`
            SELECT
                g.id, g.name, g.creatorId, g.state, g.invitationCode, g.maxPlayers, g.minPlayers,
                g.currentPhase, g.rolesAssigned, g.voteCount, g.day, g.lastActivity,
                COUNT(p.userId) AS currentPlayersCount
            FROM games g
            LEFT JOIN players p ON g.id = p.gameId
            WHERE g.state = 'LOBBY'
            GROUP BY g.id, g.name, g.creatorId, g.state, g.invitationCode, g.maxPlayers, g.minPlayers,
                     g.currentPhase, g.rolesAssigned, g.voteCount, g.day, g.lastActivity
            HAVING COUNT(p.userId) < g.maxPlayers
            ORDER BY g.name ASC;
        `);
        const gamesData = stmt.all();

        return gamesData.map(g => {
            const game = new Game(
                g.id, g.name, g.creatorId, g.invitationCode,
                g.state, g.maxPlayers, g.minPlayers,
                g.currentPhase, g.rolesAssigned, g.voteCount, g.day, g.lastActivity
            );
            game.currentPlayersCount = g.currentPlayersCount;
            return game;
        });
    }

    /**
     * Obtiene los jugadores de esta partida desde la tabla 'players'.
     * @param {object} db - La instancia de la base de datos.
     * @returns {Player[]} Un array de instancias de Player.
     */
    getPlayers(db) {
        return Player.findByGameId(db, this.id);
    }

    /**
     * Añade un jugador a la partida (guardándolo en la tabla 'players').
     * @param {object} db - La instancia de la base de datos.
     * @param {number} userId - El ID del usuario de Telegram.
     * @param {string} username - El nombre de usuario de Telegram.
     * @returns {Player} La instancia del nuevo jugador.
     */
    addPlayer(db, userId, username) {
        const newPlayer = new Player(userId, this.id, username);
        newPlayer.save(db); // Guarda el jugador en la tabla 'players'
        this.updateLastActivity(db); // Actualiza la actividad de la partida
        return newPlayer;
    }

    /**
     * Actualiza el estado de la partida en la base de datos y la propiedad de la instancia.
     * @param {object} db - La instancia de la base de datos.
     * @param {string} newState - El nuevo estado de la partida.
     */
    updateState(db, newState) {
        this.state = newState;
        db.prepare('UPDATE games SET state = ? WHERE id = ?').run(newState, this.id);
        console.log(`INFO: Estado de la partida "${this.name}" (${this.id}) actualizado a ${newState}.`);
        this.updateLastActivity(db);
    }

    /**
     * Actualiza el timestamp de la última actividad de la partida.
     * @param {object} db - La instancia de la base de datos.
     */
    updateLastActivity(db) {
        this.lastActivity = Date.now();
        db.prepare('UPDATE games SET lastActivity = ? WHERE id = ?').run(this.lastActivity, this.id);
    }

    /**
     * Inicia la partida, cambia su estado y asigna roles.
     * @param {object} db - La instancia de la base de datos.
     * @returns {object} Un objeto con { success: boolean, message: string, playerIds?: number[] }.
     */
    startGame(db) {
        const players = this.getPlayers(db);
        const currentMinPlayers = this.minPlayers;

        if (players.length < currentMinPlayers) {
            return { success: false, message: `Se necesitan al menos ${currentMinPlayers} jugadores para empezar. Actualmente hay ${players.length}.` };
        }

        try {
            let numWolves;
            if (players.length <= 6) {
                numWolves = 1;
            } else {
                numWolves = 1; // Para 7-12 jugadores, sigue siendo 1 lobo según tus requisitos.
            }

            const shuffledPlayers = [...players].sort(() => 0.5 - Math.random());

            const wolfPlayers = shuffledPlayers.slice(0, numWolves);
            const civilianPlayers = shuffledPlayers.slice(numWolves);

            const assignedRoles = {};

            wolfPlayers.forEach(player => {
                // Aquí usamos el string del nombre del rol, que Player transformará en una instancia
                player.updateRole(db, 'Lobo');
                assignedRoles[player.userId] = 'Lobo';
            });

            civilianPlayers.forEach(player => {
                player.updateRole(db, 'Aldeano');
                assignedRoles[player.userId] = 'Aldeano';
            });

            this.rolesAssigned = true;
            this.updateState(db, 'IN_PROGRESS');
            this.day = 1;
            this.currentPhase = 'night';

            this.save(db);

            console.log(`INFO: Partida "${this.name}" (${this.id}) ha iniciado. Roles asignados.`);

            const playerIds = players.map(p => p.userId);
            return {
                success: true,
                message: `¡La partida *"${this.name}"* ha comenzado! La noche cae sobre la aldea...`,
                playerIds,
                assignedRoles
            };
        } catch (error) {
            console.error(`ERROR: No se pudo iniciar la partida ${this.id}:`, error);
            return { success: false, message: 'Ocurrió un error al intentar iniciar la partida.' };
        }
    }
}

/**
 * Clase que representa un jugador en una partida.
 */
class Player {
    /**
     * Constructor para un nuevo jugador.
     * @param {number} userId - El ID de usuario de Telegram.
     * @param {string} gameId - El ID de la partida a la que pertenece el jugador.
     * @param {string} username - El nombre de usuario de Telegram.
     * @param {string|object} [role=null] - El rol asignado al jugador (nombre del rol como string o instancia de la clase de rol).
     * @param {boolean} [isAlive=true] - Estado de vida del jugador (true para vivo, false para muerto).
     * @param {string} [id=uuidv4()] - Opcional: ID del jugador (se genera si no se provee).
     * @param {string} [votesFor=null] - El ID del jugador por el que votó.
     * @param {boolean} [hasVoted=false] - Indica si el jugador ya ha votado.
     */
    constructor(userId, gameId, username, role = null, isAlive = true, id = uuidv4(), votesFor = null, hasVoted = false) {
        this.id = id;
        this.userId = userId;
        this.gameId = gameId;
        this.username = username;
        this.isAlive = isAlive;
        this.votesFor = votesFor;
        this.hasVoted = hasVoted;

        // ¡CAMBIO CLAVE AQUÍ! Instanciar la clase de rol
        if (typeof role === 'string') {
            switch (role) {
                case 'Aldeano':
                    this.role = new Aldeano();
                    break;
                case 'Lobo':
                    this.role = new Lobo();
                    break;
                default:
                    this.role = null; // O un rol por defecto si lo prefieres
            }
        } else if (role instanceof Aldeano || role instanceof Lobo) {
            this.role = role; // Si ya es una instancia, la usamos directamente
        } else {
            this.role = null; // En caso de rol desconocido o nulo
        }
    }

    /**
     * Guarda la instancia del jugador en la base de datos o la actualiza si ya existe.
     * @param {object} db - La instancia de la base de datos.
     */
    save(db) {
        db.prepare(`
            INSERT OR REPLACE INTO players (id, userId, gameId, username, role, isAlive, votesFor, hasVoted)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            this.id,
            this.userId,
            this.gameId,
            this.username,
            this.role ? this.role.name : null, // Guarda el NOMBRE del rol en la DB
            this.isAlive ? 1 : 0,
            this.votesFor,
            this.hasVoted ? 1 : 0
        );
        console.log(`INFO: Jugador "${this.username}" (${this.userId}) en partida ${this.gameId} guardado/actualizado.`);
    }

    /**
     * Busca un jugador por su ID único (UUID).
     * @param {object} db - La instancia de la base de datos.
     * @param {string} id - El ID (UUID) del jugador.
     * @returns {Player|null} La instancia del jugador o null si no se encuentra.
     */
    static findById(db, id) {
        const stmt = db.prepare('SELECT * FROM players WHERE id = ?');
        const data = stmt.get(id);
        if (data) {
            // Reconstruye el rol del string guardado en la DB
            return new Player(data.userId, data.gameId, data.username, data.role, data.isAlive === 1, data.id, data.votesFor, data.hasVoted === 1);
        }
        return null;
    }

    /**
     * Busca un jugador por su ID de usuario y el ID de la partida.
     * @param {object} db - La instancia de la base de datos.
     * @param {number} userId - El ID del usuario de Telegram.
     * @param {string} gameId - El ID de la partida.
     * @returns {Player|null} La instancia del jugador o null si no se encuentra.
     */
    static findByUserIdAndGameId(db, userId, gameId) {
        const stmt = db.prepare('SELECT * FROM players WHERE userId = ? AND gameId = ?');
        const data = stmt.get(userId, gameId);
        if (data) {
            // Reconstruye el rol del string guardado en la DB
            return new Player(data.userId, data.gameId, data.username, data.role, data.isAlive === 1, data.id, data.votesFor, data.hasVoted === 1);
        }
        return null;
    }

    /**
     * Busca todos los jugadores de una partida específica.
     * @param {object} db - La instancia de la base de datos.
     * @param {string} gameId - El ID de la partida.
     * @returns {Array<Player>} Lista de jugadores de la partida.
     */
    static findByGameId(db, gameId) {
        const stmt = db.prepare('SELECT * FROM players WHERE gameId = ?');
        return stmt.all(gameId).map(p => {
            // Reconstruye el rol del string guardado en la DB para cada jugador
            return new Player(p.userId, p.gameId, p.username, p.role, p.isAlive === 1, p.id, p.votesFor, p.hasVoted === 1);
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
        console.log(`INFO: Estado de vida de "${this.username}" (${this.userId}) actualizado a ${isAlive}.`);
    }

    /**
     * Actualiza el rol del jugador en la base de datos y la instancia del Player.
     * @param {object} db - La instancia de la base de datos.
     * @param {string} roleName - El nombre del rol (ej. "Aldeano", "Lobo").
     */
    updateRole(db, roleName) {
        // Al actualizar, se crea una nueva instancia del rol
        switch (roleName) {
            case 'Aldeano':
                this.role = new Aldeano();
                break;
            case 'Lobo':
                this.role = new Lobo();
                break;
            default:
                this.role = null;
        }
        db.prepare(`UPDATE players SET role = ? WHERE id = ?`).run(roleName, this.id); // Guarda el nombre en la DB
        console.log(`INFO: Rol de "${this.username}" (${this.userId}) actualizado a "${roleName}".`);
    }

    /**
     * Actualiza el voto de un jugador.
     * @param {object} db - La instancia de la base de datos.
     * @param {string} votesForPlayerId - El ID del jugador por el que se votó.
     * @param {boolean} hasVoted - true si ya votó, false si no.
     */
    updateVote(db, votesForPlayerId, hasVoted) {
        this.votesFor = votesForPlayerId;
        this.hasVoted = hasVoted;
        db.prepare(`UPDATE players SET votesFor = ?, hasVoted = ? WHERE id = ?`).run(this.votesFor, this.hasVoted ? 1 : 0, this.id);
        console.log(`INFO: Voto de "${this.username}" (${this.userId}) registrado para ${votesForPlayerId}.`);
    }

    /**
     * Resetea el voto del jugador.
     * @param {object} db - La instancia de la base de datos.
     */
    resetVote(db) {
        this.votesFor = null;
        this.hasVoted = false;
        db.prepare(`UPDATE players SET votesFor = NULL, hasVoted = 0 WHERE id = ?`).run(this.id);
        console.log(`INFO: Voto de "${this.username}" (${this.userId}) reseteado.`);
    }
}

// Exporta las clases para que puedan ser usadas en otras partes del bot.
module.exports = {
    Game,
    Player,
};
