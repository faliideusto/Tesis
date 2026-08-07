package es.ciudadela.acciones;

import es.ciudadela.motor.ContextoJuego;

public class CobrarAccion implements AccionTurno {

    @Override
    public String nombre() {
        return "cobrar";
    }

    @Override
    public void ejecutar(ContextoJuego contexto) {
        contexto.jugadorActual().sumarMonedas(2);
        contexto.publicarEvento("accion.cobrar", java.util.Map.of(
                "jugador", contexto.jugadorActual().nombre(),
                "monedas", contexto.jugadorActual().monedas()
        ));
    }
}