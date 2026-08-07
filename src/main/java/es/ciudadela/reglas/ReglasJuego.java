package es.ciudadela.reglas;

import es.ciudadela.motor.ContextoJuego;

public interface ReglasJuego {

    void prepararPartida(ContextoJuego contexto);

    boolean debeFinalizarPartida(ContextoJuego contexto);

    int monedasIniciales();

    int cartasIdeaIniciales();

    int puntosTrabajoBase();
}