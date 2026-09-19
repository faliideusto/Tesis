package es.tesis.acciones;

import es.tesis.dominio.Personaje;
import es.tesis.motor.ContextoJuego;

public class SeleccionarPersonajeAccion implements AccionTurno {

    private final int indice;

    public SeleccionarPersonajeAccion(int indice) {
        this.indice = indice;
    }

    @Override
    public String nombre() {
        return "seleccionar_personaje";
    }

    @Override
    public void ejecutar(ContextoJuego contexto) {
        contexto.reglas().validarSeleccion(contexto);
        String nombreJugador = contexto.jugadorActual().nombre();

        Personaje personaje = contexto.partida().mazoRoles().retirar(indice);
        contexto.jugadorActual().asignarPersonaje(personaje);

        contexto.publicarEvento("accion.seleccionar_personaje", java.util.Map.of(
                "jugador", nombreJugador,
                "personaje", personaje.nombre()
        ));

        contexto.partida().avanzarSelector();
    }
}
