// src/data/database.js
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const path = require('path');

let db; // La instancia de LowDB será accesible desde aquí

/**
 * Inicializa la base de datos LowDB.
 * Asegura que el archivo db.json existe y tiene la estructura básica.
 */
async function initializeDb() {
    console.log('DEBUG: DB (data/database.js): Intentando inicializar db...');
    try {
        // Define la ruta del archivo de la base de datos de forma segura
        // Lo mantenemos en la raíz del proyecto para simplificar, como se discutió.
        const file = path.join(process.cwd(), 'db.json');
        console.log(`DEBUG: DB (data/database.js): La ruta del archivo db.json es: ${file}`);

        const adapter = new JSONFile(file);
        db = new Low(adapter); // Asigna la instancia a la variable 'db' global en este módulo

        console.log('DEBUG: DB (data/database.js): Antes de db.read(), db.data es:', JSON.stringify(db.data));
        await db.read(); // Intenta leer el archivo db.json
        console.log('DEBUG: DB (data/database.js): Después de db.read(), db.data es:', JSON.stringify(db.data));

        // IMPORTANTE: Asegura que db.data no es null/undefined antes de usarlo
        if (db.data === null) { // Si el archivo estaba vacío o no existía, db.data será null
            console.log('DEBUG: DB (data/database.js): db.data es null, inicializando con estructura por defecto.');
            db.data = { games: [], players: [] }; // Inicializa con la estructura por defecto
        } else if (!Array.isArray(db.data.games) || !Array.isArray(db.data.players)) {
            // Si db.data existe pero le faltan las colecciones principales
            console.log('DEBUG: DB (data/database.js): db.data existe pero le faltan colecciones, ajustando estructura.');
            db.data.games = db.data.games || [];
            db.data.players = db.data.players || [];
        } else {
            console.log('DEBUG: DB (data/database.js): db.data ya tiene la estructura esperada.');
        }

        console.log('DEBUG: DB (data/database.js): Contenido FINAL de db.data ANTES de write:', JSON.stringify(db.data));
        await db.write(); // Guarda los cambios (esto creará el archivo si no existe, o actualizará si se inicializó)
        console.log('DEBUG: DB (data/database.js): Contenido FINAL de db.data DESPUÉS de write:', JSON.stringify(db.data));
        console.log('DEBUG: DB (data/database.js): db.json escrito (o actualizado si se inicializó).');
    } catch (error) {
        console.error('ERROR FATAL: DB (data/database.js): Error al inicializar o leer la base de datos:', error.message);
        throw new Error('Error crítico al iniciar la base de datos: ' + error.message);
    }
}

/**
 * Retorna la instancia de LowDB.
 * Asegúrate de haber llamado a initializeDb() primero.
 */
function getDb() {
    if (!db) {
        // Esto debería ser un error fatal si se llama getDb antes de initializeDb
        console.error('ERROR FATAL: DB (data/database.js): La base de datos no ha sido inicializada. Llama a initializeDb() primero.');
        process.exit(1); // Salir si la DB no está lista
    }
    return db;
}

module.exports = {
    initializeDb,
    getDb
};
