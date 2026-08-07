package es.ciudadela.habilidades;

import es.ciudadela.dominio.Jugador;
import es.ciudadela.motor.ContextoJuego;

public class ComiteEticaHabilidad implements HabilidadPersonaje {

    @Override
    public void ejecutar(ContextoJuego contexto, Jugador actor, String objetivo) {
        contexto.vetarJugador(objetivo);
        contexto.publicarEvento("habilidad.comite_etica", java.util.Map.of(
                "actor", actor.nombre(),
                "objetivo", objetivo
        ));
    }
}