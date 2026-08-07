package es.ciudadela.habilidades;

import es.ciudadela.dominio.Jugador;
import es.ciudadela.motor.ContextoJuego;

public class DecanaHabilidad implements HabilidadPersonaje {

    @Override
    public void alInicioDeTurno(ContextoJuego contexto, Jugador actor) {
        contexto.protegerJugador(actor.nombre());
        contexto.publicarEvento("habilidad.decana", java.util.Map.of(
                "actor", actor.nombre()
        ));
    }
}