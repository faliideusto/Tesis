package es.ciudadela.habilidades;

import es.ciudadela.dominio.Jugador;
import es.ciudadela.motor.ContextoJuego;

public interface HabilidadPersonaje {

    default void alInicioDeTurno(ContextoJuego contexto, Jugador actor) {
    }

    default void ejecutar(ContextoJuego contexto, Jugador actor, String objetivo) {
    }

    default int modificarPuntosTrabajo(ContextoJuego contexto, Jugador actor, int puntosBase) {
        return puntosBase;
    }
}