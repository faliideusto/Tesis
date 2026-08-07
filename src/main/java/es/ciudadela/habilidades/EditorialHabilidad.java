package es.ciudadela.habilidades;

import es.ciudadela.dominio.Jugador;
import es.ciudadela.motor.ContextoJuego;

public class EditorialHabilidad implements HabilidadPersonaje {

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
    public int modificarPuntosTrabajo(ContextoJuego contexto, Jugador actor, int puntosBase) {
        return puntosBase + 1;
    }
}