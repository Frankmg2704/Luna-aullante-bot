// src/roles/lobo.js

/**
 * Clase que representa el rol de Lobo.
 * Los lobos tienen una acción nocturna para eliminar a un aldeano.
 */
class Lobo {
    constructor() {
        this.name = 'Lobo';
        this.description = 'Eres un lobo sádico disfrazado de humano. Tu objetivo es eliminar a los aldeanos.';
        this.canActAtNight = true; // Los lobos sí tienen acción nocturna
    }

    /**
     * Define la acción principal del lobo para la noche.
     * En una implementación más compleja, este método podría contener la lógica para
     * elegir una víctima y aplicarla al juego.
     * Por ahora, sirve como indicador de capacidad.
     * @param {Player} targetPlayer - El jugador objetivo.
     * @returns {string} Un mensaje de confirmación de la acción.
     */
    async performNightAction(targetPlayer) {
        // En un sistema futuro, aquí se podría tener lógica más compleja
        // Por ahora, la votación se maneja a través de Player.updateVote en GamePhaseHandler.
        return `Has elegido devorar a ${targetPlayer.username} esta noche.`;
    }
}

module.exports = Lobo;
