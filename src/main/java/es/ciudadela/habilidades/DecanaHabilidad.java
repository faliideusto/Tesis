package es.ciudadela.habilidades;

import es.ciudadela.dominio.Jugador;
import es.ciudadela.motor.ContextoJuego;

public class DecanaHabilidad implements HabilidadPersonaje {

    // La inmunidad existe desde la asignación del rol, antes de su turno, y desaparece al cambiarlo.
    @Override
    public boolean esInmune() { return true; }

    @Override
    public void alInicioDeTurno(ContextoJuego contexto, Jugador actor) {
        contexto.publicarEvento("habilidad.decana", java.util.Map.of(
                "actor", actor.nombre()
        ));
    }
}
