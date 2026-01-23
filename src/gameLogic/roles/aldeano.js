// src/logicaJuego/roles/aldeano.js

class Aldeano { // El nombre de la clase es "Aldeano" (por el archivo), pero la propiedad "name" es "Aldeano"
    constructor() {
        this.name = 'Aldeano';
        this.description = 'Un habitante común del pueblo sin habilidades especiales, cuyo objetivo es descubrir a los Lobos.';
        this.canActAtNight = false;
        this.nightActionText = null;
    }

    // El aldeano no realiza acciones nocturnas
    async performNightAction(game, player, targetPlayerId) {
        return { success: false, message: "El Aldeano no tiene acciones nocturnas." };
    }
}

module.exports = Aldeano;
