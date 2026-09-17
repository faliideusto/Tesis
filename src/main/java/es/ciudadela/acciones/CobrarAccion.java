package es.ciudadela.acciones;

import es.ciudadela.motor.ContextoJuego;

public class CobrarAccion extends AccionBase {

    @Override
    public String nombre() {
        return "cobrar";
    }

    @Override
    protected void realizar(ContextoJuego contexto) {
        contexto.jugadorActual().sumarMonedas(2);
        contexto.publicarEvento("accion.cobrar", java.util.Map.of(
                "jugador", contexto.jugadorActual().nombre(),
                "monedas", contexto.jugadorActual().monedas()
        ));
    }
}
