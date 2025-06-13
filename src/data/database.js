// src/data/database.js
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, 'database.sqlite');
let dbInstance; // Declara la instancia de la base de datos aquí

function initializeDb() {
    if (!dbInstance) {
        dbInstance = new Database(dbPath, { verbose: console.log });

        dbInstance.exec(`
            CREATE TABLE IF NOT EXISTS games (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                creatorId INTEGER NOT NULL,
                state TEXT DEFAULT 'LOBBY',
                invitationCode TEXT NOT NULL UNIQUE, -- Añadimos UNIQUE para el código
                maxPlayers INTEGER DEFAULT 12,
                minPlayers INTEGER DEFAULT 5
            );

            CREATE TABLE IF NOT EXISTS players (
                id TEXT PRIMARY KEY,
                userId INTEGER NOT NULL,
                gameId TEXT NOT NULL,
                role TEXT DEFAULT NULL,
                isAlive INTEGER DEFAULT 1,
                FOREIGN KEY (gameId) REFERENCES games(id) ON DELETE CASCADE -- Agregamos ON DELETE CASCADE
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
