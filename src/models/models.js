// src/models/models.js
// Asume que tienes las importaciones necesarias
const { v4: uuidv4 } = require('uuid');
const Role = require('../gameLogic/roles/rol'); // Asegúrate de que Role esté bien definido

class Game {
    constructor(id, name, creatorId, invitationCode, state = 'LOBBY', maxPlayers = 10, minPlayers = 4, currentPhase = 'night', rolesAssigned = '[]', voteCount = '{}', day = 0, lastActivity = Date.now()) {
        this.id = id;
        this.name = name;
        this.creatorId = creatorId;
        this.invitationCode = invitationCode;
        this.state = state; // 'LOBBY', 'IN_PROGRESS', 'ENDED'
        this.maxPlayers = maxPlayers;
        this.minPlayers = minPlayers; // Mínimo de jugadores para iniciar
        this.currentPhase = currentPhase; // 'day', 'night'
        this.rolesAssigned = JSON.parse(rolesAssigned); // Almacenará los IDs de jugadores con sus roles asignados
        this.voteCount = JSON.parse(voteCount); // Conteo de votos para el día
        this.day = day; // Contador de días
        this.lastActivity = lastActivity; // Timestamp de la última actividad
    }

    save(db) {
        db.prepare(`
            INSERT OR REPLACE INTO games (id, name, creatorId, invitationCode, state, maxPlayers, minPlayers, currentPhase, rolesAssigned, voteCount, day, lastActivity)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            this.id, this.name, this.creatorId, this.invitationCode,
            this.state, this.maxPlayers, this.minPlayers,
            this.currentPhase, JSON.stringify(this.rolesAssigned),
            JSON.stringify(this.voteCount), this.day, this.lastActivity
        );
    }

    static findById(db, id) {
        const row = db.prepare('SELECT * FROM games WHERE id = ?').get(id);
        if (!row) return null;
        return new Game(
            row.id, row.name, row.creatorId, row.invitationCode,
            row.state, row.maxPlayers, row.minPlayers, row.currentPhase,
            row.rolesAssigned, row.voteCount, row.day, row.lastActivity
        );
    }

    static findByInvitationCode(db, invitationCode) {
        const codeUpper = invitationCode.toUpperCase(); // Convertir a mayúsculas
        const stmt = db.prepare('SELECT * FROM games WHERE invitationCode = ?');
        const data = stmt.get(codeUpper); // Buscar en mayúsculas
        if (data) {
            return new Game(
                data.id, data.name, data.creatorId, data.invitationCode,
                data.state, data.maxPlayers, data.minPlayers,
                data.currentPhase, data.rolesAssigned, data.voteCount, data.day, data.lastActivity
            );
        }
        return null;
    }

    static getLobbyGames(db) {
        const rows = db.prepare('SELECT * FROM games WHERE state = "LOBBY"').all();
        return rows.map(row => new Game(
            row.id, row.name, row.creatorId, row.invitationCode,
            row.state, row.maxPlayers, row.minPlayers, row.currentPhase,
            row.rolesAssigned, row.voteCount, row.day, row.lastActivity
        ));
    }

    addPlayer(db, userId, username) {
        const existingPlayer = db.prepare('SELECT * FROM players WHERE userId = ? AND gameId = ?').get(userId, this.id);
        if (existingPlayer) {
            return;
        }
        const newPlayer = new Player(uuidv4(), this.id, userId, username, 'Aldeano', true); // 'Aldeano' es un string aquí
        newPlayer.save(db);
        this.updateLastActivity(db);
    }

    getPlayers(db) {
        const playerRows = db.prepare('SELECT * FROM players WHERE gameId = ?').all();
        return playerRows.map(row => new Player(row.id, row.gameId, row.userId, row.username, row.role, row.isAlive, row.votesFor, row.hasVoted));
    }

    updateState(db, newState) {
        this.state = newState;
        this.save(db);
        this.updateLastActivity(db);
    }

    updateLastActivity(db) {
        this.lastActivity = Date.now();
        db.prepare('UPDATE games SET lastActivity = ? WHERE id = ?').run(this.lastActivity, this.id);
    }

    addVote(db, targetPlayerId, voterId) {
        if (typeof this.voteCount === 'string') {
            this.voteCount = JSON.parse(this.voteCount);
        }

        const targetPlayer = Player.findByUserIdAndGameId(db, targetPlayerId, this.id);
        if (!targetPlayer) {
            console.error(`ERROR: Jugador objetivo de voto no encontrado con ID: ${targetPlayerId}`);
            return;
        }

        if (!this.voteCount[targetPlayerId]) {
            this.voteCount[targetPlayerId] = { count: 0, username: targetPlayer.username };
        }
        this.voteCount[targetPlayerId].count++;

        this.save(db);
    }

    resetVotes(db) {
        this.voteCount = {};
        db.prepare('UPDATE players SET votesFor = NULL, hasVoted = 0 WHERE gameId = ?').run(this.id);
        this.save(db);
    }

    startGame(db) {
        if (this.state !== 'LOBBY') {
            return { success: false, message: 'La partida ya ha comenzado o ha terminado.', playerIds: [] };
        }

        const players = this.getPlayers(db);
        if (players.length < this.minPlayers) {
            return { success: false, message: `Necesitas al menos ${this.minPlayers} jugadores para iniciar. Solo hay ${players.length}.`, playerIds: [] };
        }

        const shuffledPlayers = players.sort(() => 0.5 - Math.random());
        const totalPlayers = shuffledPlayers.length;

        let numWolves;
        if (totalPlayers >= 8 && totalPlayers <= 10) {
            numWolves = 3;
        } else if (totalPlayers >= 5 && totalPlayers <= 7) {
            numWolves = 2;
        } else { // Para 4 jugadores
            numWolves = 1;
        }


        let wolfPlayers = [];
        this.rolesAssigned = [];

        for (let i = 0; i < totalPlayers; i++) {
            const player = shuffledPlayers[i];
            let roleName;
            if (i < numWolves) {
                roleName = 'Lobo';
                wolfPlayers.push(player.username);
            } else {
                roleName = 'Aldeano';
            }
            player.assignRole(db, roleName);
            this.rolesAssigned.push({ userId: player.userId, role: roleName });
        }

        this.currentPhase = 'night';
        this.day = 1;
        this.updateState(db, 'IN_PROGRESS');

        this.save(db);

        console.log(`INFO: Partida "${this.name}" (${this.id}) iniciada. ${numWolves} Lobos, ${totalPlayers - numWolves} Aldeanos.`);
        console.log(`INFO: Lobos en esta partida: ${wolfPlayers.join(', ')}`);

        return {
            success: true,
            message: `🎉 ¡La partida *"${this.name}"* ha comenzado! 🎉\n` +
                `El pueblo se duerme. ¡Es hora de la noche 🌑!`,
            playerIds: players.map(p => p.userId)
        };
    }
}

class Player {
    constructor(id, gameId, userId, username, role, isAlive = true, votesFor = null, hasVoted = false) {
        this.id = id;
        this.gameId = gameId;
        this.userId = userId;
        this.username = username;
        // ¡Importante!: Asegurarnos de que `this.role` siempre sea una instancia de Role.
        // Si 'role' ya es una instancia de Role, la usamos directamente.
        // Si es un string, creamos una nueva instancia.
        this.role = (role instanceof Role) ? role : new Role(role);
        this.isAlive = isAlive;
        this.votesFor = votesFor;
        this.hasVoted = hasVoted;
    }

    save(db) {
        db.prepare(`
            INSERT OR REPLACE INTO players (id, gameId, userId, username, role, isAlive, votesFor, hasVoted)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            this.id, this.gameId, this.userId, this.username,
            this.role.name, // Siempre accedemos a .name para guardar el string
            this.isAlive, this.hasVoted ? 1 : 0, this.votesFor // ¡Corrección del orden aquí! votesFor y hasVoted
        );
    }

    static findByUserId(db, userId) {
        const row = db.prepare('SELECT * FROM players WHERE userId = ?').get(userId);
        if (!row) return null;
        // Cuando leemos de la DB, 'row.role' es un string, lo convertimos a Role.
        return new Player(row.id, row.gameId, row.userId, row.username, row.role, row.isAlive === 1, row.votesFor, row.hasVoted === 1);
    }

    static findByUserIdAndGameId(db, userId, gameId) {
        const row = db.prepare('SELECT * FROM players WHERE userId = ? AND gameId = ?').get(userId, gameId);
        if (!row) return null;
        // Cuando leemos de la DB, 'row.role' es un string, lo convertimos a Role.
        return new Player(row.id, row.gameId, row.userId, row.username, row.role, row.isAlive === 1, row.votesFor, row.hasVoted === 1);
    }

    updateLifeStatus(db, status) {
        this.isAlive = status;
        this.save(db);
    }

    assignRole(db, roleName) {
        this.role = new Role(roleName); // Siempre creamos una nueva instancia de Role aquí.
        this.save(db);
    }

    updateVoteStatus(db, votesFor = null, hasVoted = false) {
        this.votesFor = votesFor;
        this.hasVoted = hasVoted;
        this.save(db);
    }
}

module.exports = { Game, Player };
