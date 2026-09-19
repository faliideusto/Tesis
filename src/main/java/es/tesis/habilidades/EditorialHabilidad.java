package es.tesis.habilidades;

import es.tesis.dominio.Jugador;
import es.tesis.motor.ContextoJuego;

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

}
