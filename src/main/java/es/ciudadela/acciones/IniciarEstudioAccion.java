package es.ciudadela.acciones;

import es.ciudadela.dominio.IdeaCarta;
import es.ciudadela.dominio.Jugador;
import es.ciudadela.motor.ContextoJuego;

public class IniciarEstudioAccion extends AccionBase {

    private final int indiceCarta;

    public IniciarEstudioAccion(int indiceCarta) {
        this.indiceCarta = indiceCarta;
    }

    @Override
    public String nombre() {
        return "iniciar_estudio";
    }

    @Override
    protected void realizar(ContextoJuego contexto) {
        Jugador jugador = contexto.jugadorActual();
        if (indiceCarta < 0 || indiceCarta >= jugador.cartasIdea().size()) {
            throw new IllegalArgumentException("Índice de carta de idea no válido");
        }
        IdeaCarta carta = jugador.cartasIdea().get(indiceCarta);
        if (!jugador.gastarMonedas(carta.costeMonedas())) {
            throw new IllegalStateException("No hay monedas suficientes para iniciar el estudio");
        }
        jugador.retirarCartaIdea(indiceCarta);
        jugador.iniciarEstudio(carta);
        contexto.partida().tablero().agregarEstudio(jugador.estudios().get(jugador.estudios().size() - 1));
        contexto.publicarEvento("accion.iniciar_estudio", java.util.Map.of(
                "jugador", jugador.nombre(),
                "articulo", carta.nombre()
        ));
    }
}
