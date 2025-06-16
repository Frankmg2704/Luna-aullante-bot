// src/logicaJuego/roles/rol.js
class Role {
    constructor(name) {
        this.name = name;
        // Puedes añadir más propiedades aquí si quieres:
        // this.description = this.getDescription(name);
        // this.nightAction = this.getNightAction(name);
    }

    // Opcional: puedes tener métodos para obtener la descripción, acción nocturna, etc.
    // getDescription(name) {
    //     switch (name) {
    //         case 'Aldeano': return 'Un ciudadano común sin habilidades especiales.';
    //         case 'Lobo': return 'Un depredador que mata por la noche.';
    //         default: return 'Rol desconocido.';
    //     }
    // }
}

module.exports = Role;
