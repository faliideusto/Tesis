package es.ciudadela.acciones;

import es.ciudadela.motor.ContextoJuego;

public class PensarAccion extends AccionBase {

    @Override
    public String nombre() {
        return "pensar";
    }

    @Override
    protected void realizar(ContextoJuego contexto) {
        if (contexto.partida().mazoIdeas().estaVacio()) {
            throw new IllegalStateException("No quedan cartas de idea para pensar");
        }
        contexto.jugadorActual().añadirCartaIdea(contexto.partida().mazoIdeas().robar());
        contexto.publicarEvento("accion.pensar", java.util.Map.of(
                "jugador", contexto.jugadorActual().nombre(),
                "mano", contexto.jugadorActual().cartasIdea().size()
        ));
    }
}
