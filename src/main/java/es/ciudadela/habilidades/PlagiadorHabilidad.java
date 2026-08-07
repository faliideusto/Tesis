package es.ciudadela.habilidades;

import es.ciudadela.dominio.Jugador;
import es.ciudadela.motor.ContextoJuego;

public class PlagiadorHabilidad implements HabilidadPersonaje {

    @Override
    public void ejecutar(ContextoJuego contexto, Jugador actor, String objetivo) {
        Jugador otro = contexto.buscarJugador(objetivo);
        if (otro == null) {
            throw new IllegalArgumentException("No existe el jugador objetivo: " + objetivo);
        }
        actor.intercambiarManoCon(otro);
        contexto.publicarEvento("habilidad.plagiador", java.util.Map.of(
                "actor", actor.nombre(),
                "objetivo", otro.nombre()
        ));
    }
}