package es.tesis.habilidades;

import es.tesis.dominio.Jugador;
import es.tesis.motor.ContextoJuego;

public interface HabilidadPersonaje {

    // Las habilidades activas se usan una vez por turno.
    default boolean repetible() { return false; }

    default boolean esInmune() { return false; }

    default boolean requiereResolucionAlInicio() { return false; }

    default void alInicioDeTurno(ContextoJuego contexto, Jugador actor) {
    }

    default void ejecutar(ContextoJuego contexto, Jugador actor, String objetivo) {
        throw new IllegalArgumentException("Esta habilidad no admite un jugador o rol como objetivo");
    }

    default void ejecutarEnEstudio(ContextoJuego contexto, Jugador actor, int indiceEstudio) {
        throw new IllegalArgumentException("Esta habilidad no admite un estudio como objetivo");
    }

    default void ejecutarSobreEstudio(ContextoJuego contexto, Jugador actor, String objetivo, int indiceEstudio) {
        throw new IllegalArgumentException("Esta habilidad no admite estudios ajenos como objetivo");
    }

    default int modificarPuntosTrabajo(ContextoJuego contexto, Jugador actor, int puntosBase) {
        return puntosBase;
    }
}
