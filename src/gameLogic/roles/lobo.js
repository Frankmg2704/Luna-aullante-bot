// src/logicaJuego/roles/lobo.js

class Lobo { // El nombre de la clase es "Lobo" (por el archivo), pero la propiedad "name" es "Lobo"
    constructor() {
        this.name = 'Lobo';
        this.description = 'Un depredador que se transforma por la noche para devorar a los aldeanos.';
        this.canActAtNight = true;
        this.nightActionText = 'Devorar a un aldeano';
    }

    /**
     * Realiza la acción nocturna del Lobo.
     * @param {object} game - La instancia del juego actual.
     * @param {object} player - La instancia del jugador Lobo.
     * @param {string} targetPlayerId - El ID del jugador objetivo a matar.
     * @param {object} db - La instancia de la base de datos.
     * @returns {{success: boolean, message: string, targetPlayer: object|null}}
     */
    async performNightAction(game, player, targetPlayerId, db) {
        // Asegúrate de que el objetivo existe y es un jugador válido en la partida.
        const targetPlayer = db.prepare('SELECT * FROM players WHERE id = ? AND gameId = ? AND isAlive = 1').get(targetPlayerId, game.id);

        if (!targetPlayer) {
            return { success: false, message: "El objetivo no es válido o ya no está en la partida.", targetPlayer: null };
        }

        // Un lobo no puede matarse a sí mismo ni a otro lobo.
        const targetRoleName = new (require(`./${targetPlayer.role.toLowerCase()}`)).name; // Asumiendo que `role` en la DB es 'aldeano' o 'lobo'
        if (targetPlayer.userId === player.userId || targetRoleName === 'Lobo') {
            return { success: false, message: "No puedes atacar a ese objetivo." };
        }

        // Aquí la lógica de cómo el lobo "mata"
        // Por ahora, solo marcamos al jugador como "no vivo"
        db.prepare('UPDATE players SET isAlive = 0 WHERE id = ?').run(targetPlayerId);

        return {
            success: true,
            message: `¡Has devorado a ${targetPlayer.username}!`,
            targetPlayer: targetPlayer
        };
    }
}

module.exports = Lobo;
