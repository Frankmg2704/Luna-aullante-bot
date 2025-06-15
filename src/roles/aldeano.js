// src/roles/aldeano.js

/**
 * Clase que representa el rol de Aldeano.
 * Por ahora, los aldeanos no tienen una acción nocturna especial,
 * pero esta clase sirve para encapsular cualquier lógica o propiedades futuras
 * específicas de los aldeanos.
 */
class Aldeano {
    constructor() {
        this.name = 'Aldeano';
        this.description = 'Eres un ciudadano común de la aldea. Tu objetivo es encontrar y linchar a los lobos.';
        this.canActAtNight = false; // Los aldeanos no tienen acción nocturna por defecto
    }

    // Puedes añadir métodos específicos del aldeano aquí en el futuro,
    // como por ejemplo, lógicas para su participación en la votación diurna.
}

module.exports = Aldeano;
