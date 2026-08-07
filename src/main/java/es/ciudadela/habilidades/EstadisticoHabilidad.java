package es.ciudadela.habilidades;

import es.ciudadela.dominio.Jugador;
import es.ciudadela.motor.ContextoJuego;

public class EstadisticoHabilidad implements HabilidadPersonaje {

    @Override
    public void ejecutar(ContextoJuego contexto, Jugador actor, String objetivo) {
        actor.sumarPrestigio(1);
        contexto.publicarEvento("habilidad.estadistico", java.util.Map.of(
                "actor", actor.nombre(),
                "objetivo", objetivo
        ));
    }
}