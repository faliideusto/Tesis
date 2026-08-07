package es.ciudadela.reglas;

import es.ciudadela.dominio.Jugador;
import es.ciudadela.motor.ContextoJuego;

public class ReglasAcademicas implements ReglasJuego {

    @Override
    public void prepararPartida(ContextoJuego contexto) {
        for (Jugador jugador : contexto.partida().jugadores()) {
            jugador.sumarMonedas(monedasIniciales());
            for (int i = 0; i < cartasIdeaIniciales(); i++) {
                if (!contexto.partida().mazoIdeas().estaVacio()) {
                    jugador.añadirCartaIdea(contexto.partida().mazoIdeas().robar());
                }
            }
        }
    }

    @Override
    public boolean debeFinalizarPartida(ContextoJuego contexto) {
        return contexto.partida().jugadores().stream().anyMatch(jugador -> jugador.cantidadPublicados() >= 3);
    }

    @Override
    public int monedasIniciales() {
        return 2;
    }

    @Override
    public int cartasIdeaIniciales() {
        return 2;
    }

    @Override
    public int puntosTrabajoBase() {
        return 1;
    }
}