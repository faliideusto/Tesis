package es.ciudadela.acciones;

import es.ciudadela.motor.ContextoJuego;

public class PensarAccion implements AccionTurno {

    @Override
    public String nombre() {
        return "pensar";
    }

    @Override
    public void ejecutar(ContextoJuego contexto) {
        if (!contexto.partida().mazoIdeas().estaVacio()) {
            contexto.jugadorActual().añadirCartaIdea(contexto.partida().mazoIdeas().robar());
        }
        contexto.publicarEvento("accion.pensar", java.util.Map.of(
                "jugador", contexto.jugadorActual().nombre(),
                "mano", contexto.jugadorActual().cartasIdea().size()
        ));
    }
}