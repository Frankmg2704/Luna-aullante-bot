// src/data/database.js
const path = require('path');
const Database = require('better-sqlite3');

// ¡CAMBIO AQUÍ! Usamos 'db.sqlite' en lugar de 'database.sqlite'
const dbPath = path.join(__dirname, 'db.sqlite');
let dbInstance;

function initializeDb() {
    if (!dbInstance) {
        dbInstance = new Database(dbPath, { verbose: console.log });

        dbInstance.exec(`
            CREATE TABLE IF NOT EXISTS games (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                creatorId INTEGER NOT NULL,
                state TEXT DEFAULT 'LOBBY',
                invitationCode TEXT NOT NULL UNIQUE,
                maxPlayers INTEGER DEFAULT 12,
                minPlayers INTEGER DEFAULT 5,
                currentPhase TEXT DEFAULT 'day',
                rolesAssigned INTEGER DEFAULT 0, -- 0 para false, 1 para true
                voteCount TEXT DEFAULT '{}', -- JSON string para el objeto de conteo de votos
                day INTEGER DEFAULT 0,
                lastActivity INTEGER -- Timestamp
            );

            CREATE TABLE IF NOT EXISTS players (
                id TEXT PRIMARY KEY, -- ¡Ahora sí usaremos UUID para el ID del jugador aquí!
                userId INTEGER NOT NULL,
                gameId TEXT NOT NULL,
                username TEXT, -- Asegurarte de guardar el username aquí
                role TEXT DEFAULT NULL,
                isAlive INTEGER DEFAULT 1,
                votesFor TEXT DEFAULT NULL, -- ID del jugador votado
                hasVoted INTEGER DEFAULT 0, -- 0 para false, 1 para true
                FOREIGN KEY (gameId) REFERENCES games(id) ON DELETE CASCADE
            );
        `);
        console.log('DEBUG: Base de datos SQLite inicializada y tablas creadas/verificadas.');
    }
    return dbInstance;
}

function getDb() {
    if (!dbInstance) {
        throw new Error("La base de datos no ha sido inicializada. Llama a initializeDb() primero.");
    }
    return dbInstance;
}

module.exports = { initializeDb, getDb };
