package es.tesis.habilidades;

import es.tesis.dominio.Jugador;
import es.tesis.motor.ContextoJuego;

public class PreDoctoralHabilidad implements HabilidadPersonaje {

    @Override
    public void ejecutarEnEstudio(ContextoJuego contexto, Jugador actor, int indiceEstudio) {
        var estudio = actor.estudioEnDesarrollo(indiceEstudio);
        actor.trabajarEstudio(indiceEstudio, 1);
        contexto.publicarEvento("habilidad.pre_doctoral", java.util.Map.of(
                "actor", actor.nombre(), "articulo", estudio.carta().nombre(),
                "trabajo", 1, "estado", estudio.estado().name(),
                "prestigio", estudio.carta().prestigio() + estudio.prestigioExtra()));
    }

    @Override
    public void ejecutarSobreEstudio(ContextoJuego contexto, Jugador actor, String objetivo, int indiceEstudio) {
        if (contexto.buscarJugador(objetivo) != actor) {
            throw new IllegalArgumentException("Pre-Doctoral solo puede trabajar en artículos propios");
        }
        ejecutarEnEstudio(contexto, actor, indiceEstudio);
    }
}
