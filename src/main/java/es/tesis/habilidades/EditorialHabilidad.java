package es.tesis.habilidades;

import es.tesis.dominio.Jugador;
import es.tesis.motor.ContextoJuego;

public class EditorialHabilidad implements HabilidadPersonaje {

    @Override
    public boolean repetible() { return true; }

    @Override
    public void alInicioDeTurno(ContextoJuego contexto, Jugador actor) {
        var publicados = contexto.partida().tablero().cantidadEstudiosPublicados();
        actor.sumarMonedas(publicados);
        contexto.publicarEvento("habilidad.editorial.inicio", java.util.Map.of(
                "actor", actor.nombre(),
                "monedasRecibidas", publicados
        ));
    }

    @Override
    public void ejecutar(ContextoJuego contexto, Jugador actor, String objetivo) {
        throw new IllegalArgumentException("Editorial requiere el índice de un estudio propio");
    }

    @Override
    public void ejecutarEnEstudio(ContextoJuego contexto, Jugador actor, int indiceEstudio) {
        var estudio = actor.estudioEnDesarrollo(indiceEstudio);
        if (!actor.gastarMonedas(3)) {
            throw new IllegalStateException("Se necesitan tres monedas para el trabajo de Editorial");
        }
        actor.trabajarEstudio(indiceEstudio, 1);
        contexto.publicarEvento("habilidad.editorial.trabajo", java.util.Map.of(
                "actor", actor.nombre(),
                "articulo", estudio.carta().nombre(),
                "prestigio", estudio.carta().prestigio(),
                "estado", estudio.estado().name()
        ));
    }
}
